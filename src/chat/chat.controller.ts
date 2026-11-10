import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('orders/:order_id/messages')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'List order chat messages' })
  list(
    @Param('order_id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.chat.list(orderId, user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Send an order chat message (@dukaanhub or @seller marks it priority)' })
  send(
    @Param('order_id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chat.send(orderId, user, dto);
  }

  @Patch('read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark the other party messages as read' })
  read(
    @Param('order_id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chat.markRead(orderId, user);
  }
}
