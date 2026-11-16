import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type SocialProvider = 'google' | 'apple' | 'facebook' | 'x';

/**
 * The client hands over the provider credential it obtained from the native
 * SDK or the web consent flow; the API verifies it before minting our tokens.
 */
export class SocialLoginDto {
  @IsIn(['google', 'apple', 'facebook', 'x'])
  provider: SocialProvider;

  /** OIDC identity token (Google, Apple). */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  id_token?: string;

  /** OAuth access token (Facebook, X). */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  access_token?: string;
}
