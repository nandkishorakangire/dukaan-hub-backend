import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { EmailChangeStatus } from '@prisma/client';

export class RequestEmailChangeDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  /** Token returned by POST /auth/verification/verify for this email + email-change. */
  @IsString()
  verification_token!: string;
}

export class ListEmailChangesQueryDto {
  @IsOptional()
  @IsIn([EmailChangeStatus.pending, EmailChangeStatus.approved, EmailChangeStatus.rejected])
  status?: EmailChangeStatus;
}
