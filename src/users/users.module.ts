import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminEmailChangeController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [UsersController, AdminEmailChangeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
