import { Module } from '@nestjs/common';
import { AdminEmailChangeController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, AdminEmailChangeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
