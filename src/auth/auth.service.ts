import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { JwtPayload } from '../common/types/authenticated-user';
import { normalizePhone, phoneAccountEmail } from '../common/utils/phone';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../users/user.select';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LinkPhoneDto, RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social.dto';

const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

export interface OtpAuthResponse extends AuthResponse {
  /** True when the phone number had no account and one was just created. */
  created: boolean;
  /** True when the account still needs a name before shopping. */
  needs_profile: boolean;
}

type OtpPurpose = 'signin' | 'profile' | 'reset';

type SocialProfile = {
  provider: 'google' | 'facebook';
  subject: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
};

/** A phone sign-up without a name keeps this placeholder until the profile is completed. */
function isPlaceholderName(name: string): boolean {
  return !name.trim() || /^Shopper \d{4}$/.test(name.trim());
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('An account with this email already exists');

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      name: dto.name,
      email,
      password_hash,
      phone: dto.phone ? normalizePhone(dto.phone) : undefined,
    });

    return { user, ...(await this.issueTokens(user)) };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.password_hash) {
      throw new UnauthorizedException('This account uses phone or social sign-in');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const publicUser = await this.users.getById(user.id);
    return { user: publicUser, ...(await this.issueTokens(publicUser)) };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { token_hash: this.hashToken(refreshToken) },
    });
    if (!record || record.revoked_at || record.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Account no longer exists');

    // Rotate: the old token can only be used once.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked_at: new Date() },
    });

    return { user, ...(await this.issueTokens(user)) };
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.prisma.refreshToken.updateMany({
      where: { token_hash: this.hashToken(refreshToken), revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return { success: true };
  }

  async getAuthenticatedUser(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles: user.roles?.length ? user.roles : [user.role],
    };
  }

  /** Verifies a bearer token presented during a Socket.IO handshake. */
  async verifyAccessToken(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
      if (payload.type !== 'access') throw new Error('Wrong token type');
      return await this.getAuthenticatedUser(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Phone OTP                                                           */
  /* ------------------------------------------------------------------ */

  async requestOtp(dto: RequestOtpDto) {
    const phone = normalizePhone(dto.phone);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new BadRequestException('Enter a valid 10-digit mobile number');
    }
    const purpose = dto.purpose ?? 'signin';
    const expiresIn = this.otpTtlSeconds();
    const code = this.newOtpCode();

    // Only the freshest code should work; clear anything still pending.
    await this.prisma.otpCode.deleteMany({
      where: { phone, purpose, consumed_at: null },
    });
    await this.prisma.otpCode.create({
      data: {
        phone,
        purpose,
        code_hash: this.hashOtp(phone, purpose, code),
        expires_at: new Date(Date.now() + expiresIn * 1000),
      },
    });

    return {
      phone,
      purpose,
      expires_in: expiresIn,
      ...(this.exposeCodes() ? { code } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<OtpAuthResponse> {
    const phone = normalizePhone(dto.phone);
    const name = dto.name?.trim();
    await this.consumeOtp(phone, 'signin', dto.code);

    let user = await this.users.findByPhone(phone);
    let created = false;

    if (!user) {
      await this.users.create({
        name: name || `Shopper ${phone.slice(-4)}`,
        email: phoneAccountEmail(phone),
        phone,
        password_hash: null,
      });
      user = await this.users.findByPhone(phone);
      created = true;
    } else if (name && isPlaceholderName(user.name)) {
      await this.users.update(user.id, { name });
      user = await this.users.findByPhone(phone);
    }

    const publicUser = await this.users.getById(user!.id);
    return {
      user: publicUser,
      created,
      needs_profile: isPlaceholderName(publicUser.name),
      ...(await this.issueTokens(publicUser)),
    };
  }

  /** Adds a verified mobile number to an authenticated account. */
  async linkPhone(userId: string, dto: LinkPhoneDto): Promise<PublicUser> {
    const phone = normalizePhone(dto.phone);
    await this.consumeOtp(phone, 'profile', dto.code);

    const owner = await this.users.findByPhone(phone);
    if (owner && owner.id !== userId) {
      throw new ConflictException('This mobile number is linked to another account');
    }

    return this.users.setPhone(userId, phone);
  }

  /* ------------------------------------------------------------------ */
  /* Password reset                                                      */
  /* ------------------------------------------------------------------ */

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundException('No account found with this email');
    if (!user.password_hash) {
      throw new BadRequestException(
        'This account signs in with a mobile number or a social provider, so it has no password to reset',
      );
    }

    const expiresIn = this.resetTtlSeconds();
    const code = this.newOtpCode();
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await this.prisma.otpCode.deleteMany({ where: { phone: email, purpose: 'reset', consumed_at: null } });
    await this.prisma.otpCode.create({
      data: {
        phone: email,
        purpose: 'reset',
        code_hash: this.hashOtp(email, 'reset', code),
        expires_at: expiresAt,
      },
    });

    const resetToken = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    });
    await this.prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: this.hashToken(resetToken),
        expires_at: expiresAt,
      },
    });

    return {
      success: true,
      expires_in: expiresIn,
      ...(this.exposeCodes() ? { code, reset_token: resetToken } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    let userId: string;

    if (dto.token) {
      const record = await this.prisma.passwordResetToken.findUnique({
        where: { token_hash: this.hashToken(dto.token) },
      });
      if (!record || record.used_at || record.expires_at.getTime() <= Date.now()) {
        throw new BadRequestException('This reset link has expired. Request a new one.');
      }
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used_at: new Date() },
      });
      userId = record.user_id;
    } else {
      if (!dto.email || !dto.code) {
        throw new BadRequestException('Provide the emailed code or a reset token');
      }
      const email = dto.email.toLowerCase().trim();
      await this.consumeOtp(email, 'reset', dto.code);
      const user = await this.users.findByEmail(email);
      if (!user) throw new NotFoundException('No account found with this email');
      userId = user.id;
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.users.setPasswordHash(userId, passwordHash);

    // Sign out every existing session so the old password cannot be replayed.
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    return { success: true };
  }

  /* ------------------------------------------------------------------ */
  /* Social sign-in                                                      */
  /* ------------------------------------------------------------------ */

  async socialLogin(dto: SocialLoginDto): Promise<OtpAuthResponse> {
    const profile = await this.verifySocialCredential(dto);

    let user = await this.users.findByOAuth(profile.provider, profile.subject);
    let created = false;

    if (!user) {
      const byEmail = await this.users.findByEmail(profile.email);
      if (byEmail) {
        if (
          byEmail.oauth_provider &&
          (byEmail.oauth_provider !== profile.provider || byEmail.oauth_subject !== profile.subject)
        ) {
          throw new ConflictException('This email is already linked to a different sign-in method');
        }
        user = await this.users.linkOAuth(byEmail.id, profile.provider, profile.subject);
      } else {
        user = await this.users.create({
          name: profile.name,
          email: profile.email,
          avatar_url: profile.avatarUrl ?? null,
          oauth_provider: profile.provider,
          oauth_subject: profile.subject,
        });
        created = true;
      }
    }

    const publicUser = await this.users.getById(user.id);
    return {
      user: publicUser,
      created,
      needs_profile: isPlaceholderName(publicUser.name),
      ...(await this.issueTokens(publicUser)),
    };
  }

  private async verifySocialCredential(dto: SocialLoginDto): Promise<SocialProfile> {
    if (dto.provider === 'google') {
      return this.verifyGoogle(dto.id_token);
    }
    if (dto.provider === 'facebook') {
      return this.verifyFacebook(dto.access_token);
    }
    const label = dto.provider === 'apple' ? 'Apple' : 'X';
    throw new ServiceUnavailableException(
      `${label} sign-in is not configured on this server. Use email or mobile instead.`,
    );
  }

  private async verifyGoogle(idToken?: string): Promise<SocialProfile> {
    const clientId = this.config.get<string>('auth.googleClientId');
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this server. Use email or mobile instead.',
      );
    }
    if (!idToken) throw new BadRequestException('A Google ID token is required');

    let payload: {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
    };
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!response.ok) throw new Error(`Google responded ${response.status}`);
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new UnauthorizedException('Google could not verify this sign-in');
    }

    if (payload.aud !== clientId) {
      throw new UnauthorizedException('This Google token was issued for another app');
    }
    if (payload.email_verified === 'false' || payload.email_verified === false) {
      throw new UnauthorizedException('This Google email is not verified');
    }
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Google did not return an email address');
    }

    return {
      provider: 'google',
      subject: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name?.trim() || payload.email.split('@')[0],
      avatarUrl: payload.picture ?? null,
    };
  }

  private async verifyFacebook(accessToken?: string): Promise<SocialProfile> {
    const appId = this.config.get<string>('auth.facebookAppId');
    const appSecret = this.config.get<string>('auth.facebookAppSecret');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException(
        'Facebook sign-in is not configured on this server. Use email or mobile instead.',
      );
    }
    if (!accessToken) throw new BadRequestException('A Facebook access token is required');

    try {
      const debugResponse = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
          accessToken,
        )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
      );
      const debug = (await debugResponse.json()) as {
        data?: { app_id?: string; user_id?: string; is_valid?: boolean };
      };
      const info = debug.data;
      if (!debugResponse.ok || !info?.is_valid || info.app_id !== appId || !info.user_id) {
        throw new UnauthorizedException('Facebook could not verify this sign-in');
      }

      const profileResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(
          accessToken,
        )}`,
      );
      const profile = (await profileResponse.json()) as {
        id?: string;
        name?: string;
        email?: string;
        picture?: { data?: { url?: string } };
      };
      if (!profileResponse.ok || !profile.id) {
        throw new UnauthorizedException('Facebook did not return a profile');
      }

      return {
        provider: 'facebook',
        subject: info.user_id,
        email: (profile.email ?? `facebook.${info.user_id}@social.dukaanhub.local`).toLowerCase(),
        name: profile.name?.trim() || 'Shopper',
        avatarUrl: profile.picture?.data?.url ?? null,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Facebook could not verify this sign-in');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  private async consumeOtp(target: string, purpose: OtpPurpose, code: string): Promise<void> {
    const record = await this.prisma.otpCode.findFirst({
      where: { phone: target, purpose, consumed_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    if (!record) {
      throw new BadRequestException('That code has expired. Request a new one.');
    }

    const maxAttempts = this.config.get<number>('auth.otpMaxAttempts') ?? 5;
    if (record.attempts >= maxAttempts) {
      throw new ForbiddenException('Too many incorrect attempts. Request a new code.');
    }

    if (!this.safeEqual(record.code_hash, this.hashOtp(target, purpose, code))) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('That code is not correct');
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumed_at: new Date(), attempts: { increment: 1 } },
    });
  }

  private newOtpCode(): string {
    return String(randomInt(100000, 1000000));
  }

  private hashOtp(target: string, purpose: OtpPurpose, code: string): string {
    const secret = this.config.getOrThrow<string>('jwt.accessSecret');
    return createHmac('sha256', secret).update(`${purpose}:${target}:${code}`).digest('hex');
  }

  private otpTtlSeconds(): number {
    return (this.config.get<number>('auth.otpTtlMinutes') ?? 10) * 60;
  }

  private resetTtlSeconds(): number {
    return (this.config.get<number>('auth.resetTtlMinutes') ?? 30) * 60;
  }

  private exposeCodes(): boolean {
    return this.config.get<boolean>('auth.exposeCodes') === true;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, 'hex');
    const bufferB = Buffer.from(b, 'hex');
    return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    role: Role;
    roles: Role[];
  }): Promise<AuthTokens> {
    const accessSecret = this.config.getOrThrow<string>('jwt.accessSecret');
    const refreshSecret = this.config.getOrThrow<string>('jwt.refreshSecret');
    const accessTtl = this.config.getOrThrow<string>('jwt.accessTtl');
    const refreshTtl = this.config.getOrThrow<string>('jwt.refreshTtl');
    const jti = randomUUID();

    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
    };
    const accessToken = await this.jwt.signAsync(
      { ...basePayload, type: 'access', jti },
      { secret: accessSecret, expiresIn: accessTtl as never },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, type: 'refresh', jti },
      { secret: refreshSecret, expiresIn: refreshTtl as never },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: this.hashToken(refreshToken),
        expires_at: new Date(decoded.exp * 1000),
      },
    });

    const accessDecoded = this.jwt.decode(accessToken) as { exp: number };
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: Math.max(0, accessDecoded.exp - Math.floor(Date.now() / 1000)),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
