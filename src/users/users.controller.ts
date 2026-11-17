import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ListEmailChangesQueryDto, RequestEmailChangeDto } from './dto/email-change.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the signed-in user profile' })
  me(@CurrentUser('id') userId: string) {
    return this.users.getById(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the signed-in user profile' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.users.update(user.id, dto);
  }

  @Get('me/email-change')
  @ApiOperation({ summary: 'Get the latest email change request for the signed-in user' })
  latestEmailChange(@CurrentUser('id') userId: string) {
    return this.users.latestEmailChange(userId);
  }

  @Post('me/email-change')
  @ApiOperation({
    summary: 'Request an email change with a verified address; a DukaanHub admin must approve it',
  })
  requestEmailChange(@CurrentUser('id') userId: string, @Body() dto: RequestEmailChangeDto) {
    return this.users.requestEmailChange(userId, dto.email, dto.verification_token);
  }
}

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin/email-change-requests')
export class AdminEmailChangeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List email change requests awaiting or after review' })
  list(@Query() query: ListEmailChangesQueryDto) {
    return this.users.listEmailChanges(query.status);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve an email change and apply the new address' })
  approve(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.reviewEmailChange(id, adminId, true);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an email change request' })
  reject(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.reviewEmailChange(id, adminId, false);
  }
}
