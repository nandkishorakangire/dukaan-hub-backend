import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { normalizePhone } from '../common/utils/phone';

export type VerificationChannel = 'email' | 'phone';
export type VerificationPurpose = 'signup' | 'email-change';

/** Short-lived proof that a target (email or phone) received a verification code. */
export interface VerificationTokenPayload {
  target: string;
  channel: VerificationChannel;
  purpose: VerificationPurpose;
  type: 'verification';
}

const VERIFICATION_TOKEN_TTL = '15m';

/** Emails and phone numbers are stored in their canonical form inside OTP codes and tokens. */
export function normalizeVerificationTarget(channel: VerificationChannel, target: string): string {
  return channel === 'phone' ? normalizePhone(target) : (target ?? '').toLowerCase().trim();
}

export async function signVerificationToken(
  jwt: JwtService,
  config: ConfigService,
  data: { target: string; channel: VerificationChannel; purpose: VerificationPurpose },
): Promise<string> {
  return jwt.signAsync(
    {
      target: data.target,
      channel: data.channel,
      purpose: data.purpose,
      type: 'verification',
    },
    {
      secret: config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: VERIFICATION_TOKEN_TTL as never,
    },
  );
}

/**
 * Verifies the signature/expiry plus the target and purpose the token was issued for.
 * Shared by AuthService (signup) and UsersService (email change) so they never
 * need to depend on each other.
 */
export async function verifyVerificationToken(
  jwt: JwtService,
  config: ConfigService,
  token: string,
  expected: { target: string; purpose: VerificationPurpose; channel?: VerificationChannel },
): Promise<VerificationTokenPayload> {
  let payload: VerificationTokenPayload;
  try {
    payload = await jwt.verifyAsync<VerificationTokenPayload>(token, {
      secret: config.getOrThrow<string>('jwt.accessSecret'),
    });
  } catch {
    throw new BadRequestException('Invalid or expired verification token');
  }

  const invalid =
    payload?.type !== 'verification' ||
    (payload.channel !== 'email' && payload.channel !== 'phone') ||
    !payload.target ||
    payload.purpose !== expected.purpose ||
    (expected.channel !== undefined && payload.channel !== expected.channel) ||
    normalizeVerificationTarget(payload.channel, payload.target) !==
      normalizeVerificationTarget(payload.channel, expected.target);

  if (invalid) throw new BadRequestException('Invalid or expired verification token');
  return payload;
}
