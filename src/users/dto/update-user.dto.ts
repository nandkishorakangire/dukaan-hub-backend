import { IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class UpdateUserDto {
  /** Legacy single-field name. New clients send the split fields below. */
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  middle_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  last_name?: string;

  // Mobile numbers are changed through the verified OTP flow
  // (`POST /auth/otp/request` then `POST /auth/otp/link`), never here.

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  avatar_url?: string;
}
