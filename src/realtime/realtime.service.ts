import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Thin wrapper around the Socket.IO server so domain services can publish
 * realtime events without depending on the gateway.
 *
 * Rooms:
 *  - `user:<id>`      private, joined after a valid handshake token
 *  - `marketplace:<id>`  public updates for a storefront
 *  - `order:<id>`     private, joined only by the buyer, owner or admin
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  emitOrderUpdate(orderId: string, payload: unknown, participantIds: string[] = []): void {
    this.emitToRoom(`order:${orderId}`, 'order:update', payload);
    for (const participantId of new Set(participantIds.filter(Boolean))) {
      this.emitToRoom(`user:${participantId}`, 'order:update', payload);
    }
  }

  emitMarketplaceUpdate(marketplaceId: string, payload: unknown): void {
    this.emitToRoom(`marketplace:${marketplaceId}`, 'marketplace:update', payload);
    this.emitToRoom('public', 'marketplace:update', payload);
  }

  emitProductStock(marketplaceId: string, payload: unknown): void {
    this.emitToRoom(`marketplace:${marketplaceId}`, 'product:stock', payload);
  }

  emitNotification(userId: string, payload: unknown): void {
    this.emitToRoom(`user:${userId}`, 'notification:new', payload);
  }

  emitChatMessage(orderId: string, payload: unknown): void {
    this.emitToRoom(`order:${orderId}`, 'chat:message', payload);
  }

  emitToRoom(room: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.debug(`Realtime server not ready; dropping ${event} -> ${room}`);
      return;
    }
    this.server.to(room).emit(event, payload);
  }
}
