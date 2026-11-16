import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email: string;
}

/**
 * Accepts either the six-digit code that arrives by email (`email` + `code`)
 * or an opaque reset token from a reset link (`token`).
 */
export class ResetPasswordDto {
  @ValidateIf((dto: ResetPasswordDto) => !dto.token)
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ValidateIf((dto: ResetPasswordDto) => !dto.token)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
