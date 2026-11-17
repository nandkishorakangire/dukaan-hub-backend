import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  /** Legacy display name; new clients should send the individual name parts. */
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsString()
  @Length(2, 40)
  first_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  middle_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  last_name?: string;

  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+0-9()\-\s]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  /** Token returned by POST /auth/verification/verify for this email + signup. */
  @IsString()
  @MinLength(1)
  email_verification_token: string;

  /** Required when `phone` is supplied: token for this phone + signup. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  phone_verification_token?: string;
}
