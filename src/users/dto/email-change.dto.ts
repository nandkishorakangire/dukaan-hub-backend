import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { EmailChangeStatus } from '@prisma/client';

export class RequestEmailChangeDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;
}

export class ListEmailChangesQueryDto {
  @IsOptional()
  @IsIn([EmailChangeStatus.pending, EmailChangeStatus.approved, EmailChangeStatus.rejected])
  status?: EmailChangeStatus;
}
