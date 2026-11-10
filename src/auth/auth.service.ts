import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { JwtPayload } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../users/user.select';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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
      phone: dto.phone,
    });

    return { user, ...(await this.issueTokens(user)) };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

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
    return { id: user.id, email: user.email, name: user.name, role: user.role };
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

  private async issueTokens(user: { id: string; email: string; role: Role }): Promise<AuthTokens> {
    const accessSecret = this.config.getOrThrow<string>('jwt.accessSecret');
    const refreshSecret = this.config.getOrThrow<string>('jwt.refreshSecret');
    const accessTtl = this.config.getOrThrow<string>('jwt.accessTtl');
    const refreshTtl = this.config.getOrThrow<string>('jwt.refreshTtl');
    const jti = randomUUID();

    const basePayload = { sub: user.id, email: user.email, role: user.role };
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
