import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatSender, Prisma, Role } from '@prisma/client';
import { paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { extractMentions, isPriorityMessage } from '../common/utils/mentions';
import { OrdersService } from '../orders/orders.service';
import { OrderWithRelations } from '../orders/order.include';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

const messageInclude = {
  sender_user: { select: { id: true, name: true, avatar_url: true } },
} satisfies Prisma.ChatMessageInclude;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(orderId: string, user: AuthenticatedUser, query: PaginationQueryDto) {
    await this.orders.getById(orderId, user);

    const where: Prisma.ChatMessageWhereInput = { order_id: orderId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({
        where,
        include: messageInclude,
        orderBy: { created_at: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.chatMessage.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async send(orderId: string, user: AuthenticatedUser, dto: SendChatMessageDto) {
    const order = await this.orders.findOrder(orderId);
    const sender = this.partyOf(order, user);
    if (!sender) throw new ForbiddenException('You do not have access to this chat');

    const text = dto.text?.trim() ?? '';
    if (!text && !dto.image) {
      throw new BadRequestException('A message needs text or an image');
    }

    let replyTo: Prisma.InputJsonValue | undefined;
    if (dto.reply_to_id) {
      const original = await this.prisma.chatMessage.findFirst({
        where: { id: dto.reply_to_id, order_id: orderId },
        select: { id: true, sender: true, text: true, image: true },
      });
      if (!original) throw new NotFoundException('The quoted message was not found');
      replyTo = {
        id: original.id,
        sender: original.sender,
        text: original.text || (original.image ? 'Photo' : ''),
      };
    }

    const mentions = extractMentions(text);
    const priority = isPriorityMessage(text, order.business.name);

    const message = await this.prisma.chatMessage.create({
      data: {
        order_id: orderId,
        sender_id: user.id,
        sender,
        text,
        image: dto.image,
        image_width: dto.image_width,
        image_height: dto.image_height,
        reply_to: replyTo,
        mentions,
        priority,
      },
      include: messageInclude,
    });

    this.realtime.emitChatMessage(orderId, message);

    const recipientId = sender === ChatSender.buyer ? order.business.owner_id : order.buyer_id;
    this.realtime.emitNotification(recipientId, {
      type: 'chat:message',
      order_id: orderId,
      priority,
      title: sender === ChatSender.buyer ? 'New message from buyer' : 'New message from seller',
      body: text.slice(0, 140) || 'Photo',
    });

    return message;
  }

  async markRead(orderId: string, user: AuthenticatedUser) {
    const order = await this.orders.findOrder(orderId);
    const sender = this.partyOf(order, user);
    if (!sender) throw new ForbiddenException('You do not have access to this chat');

    const result = await this.prisma.chatMessage.updateMany({
      where: {
        order_id: orderId,
        sender: { not: sender },
        read_at: null,
      },
      data: { read_at: new Date() },
    });

    return { updated: result.count };
  }

  private partyOf(order: OrderWithRelations, user: AuthenticatedUser): ChatSender | null {
    if (order.buyer_id === user.id) return ChatSender.buyer;
    if (user.role === Role.admin || order.business.owner_id === user.id) return ChatSender.seller;
    return null;
  }
}
