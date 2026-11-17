import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { VerificationPurpose } from '../auth/verification-token';

/** Delivery is best-effort: code requests must succeed even when a gateway is down. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async sendEmailCode(email: string, code: string, purpose: VerificationPurpose): Promise<void> {
    const host = this.config.get<string>('notifications.smtpHost');
    const from = this.config.get<string>('notifications.smtpFrom');
    if (!host || !from) {
      this.logger.warn(
        `SMTP is not configured (set SMTP_HOST and SMTP_FROM); skipping verification email to ${email}`,
      );
      return;
    }

    try {
      await this.getTransporter().sendMail({
        from,
        to: email,
        subject: 'DukaanHub verification code',
        text: [
          `Your DukaanHub verification code for ${purpose} is ${code}.`,
          `This code expires in ${this.codeTtlMinutes()} minutes.`,
          'If you did not request this code, you can ignore this message.',
        ].join('\n'),
      });
    } catch (error) {
      this.logger.warn(`Could not send verification email to ${email}: ${this.describe(error)}`);
    }
  }

  async sendSmsCode(phone: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('notifications.fast2smsApiKey');
    if (!apiKey) {
      this.logger.warn('FAST2SMS_API_KEY is not configured; skipping verification SMS');
      return;
    }

    try {
      const message = `Your DukaanHub verification code is ${code}. It expires in ${this.codeTtlMinutes()} minutes.`;
      const url =
        'https://www.fast2sms.com/dev/bulkV2' +
        `?route=q&message=${encodeURIComponent(message)}&numbers=${encodeURIComponent(phone)}`;
      const response = await fetch(url, { headers: { Authorization: apiKey } });
      if (!response.ok) {
        this.logger.warn(`Fast2SMS responded ${response.status} for a verification code request`);
        return;
      }

      const body = (await response.json().catch(() => null)) as { return?: boolean; message?: unknown } | null;
      if (body?.return === false) {
        this.logger.warn(`Fast2SMS rejected a verification code request: ${JSON.stringify(body.message ?? body)}`);
      }
    } catch (error) {
      this.logger.warn(`Could not send verification SMS to ${phone}: ${this.describe(error)}`);
    }
  }

  /** Created on first use so local/dev builds never open an unused SMTP connection. */
  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('notifications.smtpHost'),
        port: this.config.get<number>('notifications.smtpPort') ?? 587,
        secure: this.config.get<boolean>('notifications.smtpSecure') ?? false,
        ...(this.config.get<string>('notifications.smtpUser')
          ? {
              auth: {
                user: this.config.get<string>('notifications.smtpUser'),
                pass: this.config.get<string>('notifications.smtpPassword'),
              },
            }
          : {}),
      });
    }
    return this.transporter;
  }

  private codeTtlMinutes(): number {
    return this.config.get<number>('auth.otpTtlMinutes') ?? 10;
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
