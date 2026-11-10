import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [OrdersModule, RealtimeModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
