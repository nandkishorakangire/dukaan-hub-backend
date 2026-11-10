import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

type SocketData = {
  user?: AuthenticatedUser;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.setServer(server);
    this.logger.log('Socket.IO gateway ready');
  }

  async handleConnection(client: Socket): Promise<void> {
    client.join('public');

    const rawAuth = client.handshake.auth as { token?: string } | undefined;
    const header = client.handshake.headers.authorization;
    const token = rawAuth?.token ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) return;

    try {
      const user = await this.auth.verifyAccessToken(token);
      (client.data as SocketData).user = user;
      await client.join(`user:${user.id}`);
      client.emit('authenticated', { id: user.id, role: user.role });
    } catch {
      client.emit('unauthorized', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('business:join')
  async joinBusiness(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { business_id?: string },
  ) {
    if (!body?.business_id) return { ok: false, error: 'business_id is required' };
    await client.join(`business:${body.business_id}`);
    return { ok: true };
  }

  @SubscribeMessage('business:leave')
  async leaveBusiness(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { business_id?: string },
  ) {
    if (body?.business_id) await client.leave(`business:${body.business_id}`);
    return { ok: true };
  }

  @SubscribeMessage('order:join')
  async joinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { order_id?: string },
  ) {
    const user = (client.data as SocketData).user;
    if (!user) return { ok: false, error: 'Authentication required' };
    if (!body?.order_id) return { ok: false, error: 'order_id is required' };

    const allowed = await this.canAccessOrder(body.order_id, user);
    if (!allowed) return { ok: false, error: 'Order not found' };

    await client.join(`order:${body.order_id}`);
    return { ok: true };
  }

  @SubscribeMessage('order:leave')
  async leaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { order_id?: string },
  ) {
    if (body?.order_id) await client.leave(`order:${body.order_id}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:typing')
  typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { order_id?: string; typing?: boolean },
  ) {
    if (!body?.order_id || !client.rooms.has(`order:${body.order_id}`)) return;
    client.to(`order:${body.order_id}`).emit('chat:typing', {
      order_id: body.order_id,
      typing: Boolean(body.typing),
    });
  }

  private async canAccessOrder(orderId: string, user: AuthenticatedUser): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { buyer_id: true, business: { select: { owner_id: true } } },
    });
    if (!order) return false;
    return (
      user.role === Role.admin ||
      order.buyer_id === user.id ||
      order.business.owner_id === user.id
    );
  }
}
