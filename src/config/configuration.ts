export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  publicBaseUrl: string;
  uploadDir: string;
  maxUploadMb: number;
  payments: {
    webhookSecret: string;
    autoConfirm: boolean;
    freeDeliveryThreshold: number;
    deliveryFee: number;
    handlingFee: number;
    /** Added on top of the standard fee when the buyer picks fast delivery. */
    fastDeliveryFee: number;
    /** Pay-later settlements allowed per shopper per calendar month. */
    payLaterMonthlyLimit: number;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  auth: {
    otpTtlMinutes: number;
    otpMaxAttempts: number;
    /** Local builds echo the OTP/reset token back so no SMS/email gateway is needed. */
    exposeCodes: boolean;
    resetTtlMinutes: number;
    googleClientId: string;
    facebookAppId: string;
    facebookAppSecret: string;
    appleClientId: string;
    appleTeamId: string;
    appleKeyId: string;
    applePrivateKey: string;
  };
  notifications: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFrom: string;
    fast2smsApiKey: string;
  };
  throttle: {
    ttl: number;
    limit: number;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 5),
  payments: {
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? '',
    autoConfirm: (process.env.PAYMENTS_AUTO_CONFIRM ?? 'false') === 'true',
    freeDeliveryThreshold: Number(process.env.FREE_DELIVERY_THRESHOLD ?? 199),
    deliveryFee: Number(process.env.DELIVERY_FEE ?? 25),
    handlingFee: Number(process.env.HANDLING_FEE ?? 2),
    fastDeliveryFee: Number(process.env.FAST_DELIVERY_FEE ?? 50),
    payLaterMonthlyLimit: Number(process.env.PAY_LATER_MONTHLY_LIMIT ?? 3),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  auth: {
    otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 10),
    otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    exposeCodes:
      (process.env.AUTH_EXPOSE_CODES ?? String((process.env.NODE_ENV ?? 'development') !== 'production')) ===
      'true',
    resetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30),
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    facebookAppId: process.env.FACEBOOK_APP_ID ?? '',
    facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? '',
    appleClientId: process.env.APPLE_CLIENT_ID ?? '',
    appleTeamId: process.env.APPLE_TEAM_ID ?? '',
    appleKeyId: process.env.APPLE_KEY_ID ?? '',
    applePrivateKey: process.env.APPLE_PRIVATE_KEY ?? '',
  },
  notifications: {
    smtpHost: process.env.SMTP_HOST ?? '',
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpSecure: (process.env.SMTP_SECURE ?? 'false') === 'true',
    smtpUser: process.env.SMTP_USER ?? '',
    smtpPassword: process.env.SMTP_PASSWORD ?? '',
    smtpFrom: process.env.SMTP_FROM ?? '',
    fast2smsApiKey: process.env.FAST2SMS_API_KEY ?? '',
  },
  throttle: {
    ttl: Number(process.env.THROTTLE_TTL ?? 60),
    limit: Number(process.env.THROTTLE_LIMIT ?? 120),
  },
});
