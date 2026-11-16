import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export type OtpPurpose = 'signin' | 'profile';

const PHONE_MESSAGE = 'phone must be a 10-digit Indian mobile number';

export class RequestOtpDto {
  @Transform(({ value }: { value: string }) => value?.replace(/[\s()-]/g, ''))
  @IsString()
  @Matches(/^(?:\+?91)?[6-9]\d{9}$/, { message: PHONE_MESSAGE })
  phone: string;

  @IsOptional()
  @IsIn(['signin', 'profile'])
  purpose?: OtpPurpose;
}

export class VerifyOtpDto {
  @Transform(({ value }: { value: string }) => value?.replace(/[\s()-]/g, ''))
  @IsString()
  @Matches(/^(?:\+?91)?[6-9]\d{9}$/, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  code: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}

export class LinkPhoneDto {
  @Transform(({ value }: { value: string }) => value?.replace(/[\s()-]/g, ''))
  @IsString()
  @Matches(/^(?:\+?91)?[6-9]\d{9}$/, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  code: string;
}
