import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type SocialProvider = 'google' | 'apple';

/**
 * The client hands over the provider credential it obtained from the native
 * SDK or the web consent flow; the API verifies it before minting our tokens.
 */
export class SocialLoginDto {
  @IsIn(['google', 'apple'])
  provider: SocialProvider;

  /** OIDC identity token from Google or Apple. */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  id_token?: string;

  /** Display name supplied by Apple on the first authorization only. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  full_name?: string;
}
