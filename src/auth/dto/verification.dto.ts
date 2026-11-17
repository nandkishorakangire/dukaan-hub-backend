import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { VerificationChannel, VerificationPurpose } from '../verification-token';

export class RequestVerificationDto {
  /** Email address or mobile number, depending on `channel`. */
  @IsString()
  @MaxLength(254)
  target: string;

  @IsIn(['email', 'phone'])
  channel: VerificationChannel;

  @IsIn(['signup', 'email-change'])
  purpose: VerificationPurpose;
}

export class VerifyVerificationDto extends RequestVerificationDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  code: string;
}
