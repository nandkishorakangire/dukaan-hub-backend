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
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
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
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  throttle: {
    ttl: Number(process.env.THROTTLE_TTL ?? 60),
    limit: Number(process.env.THROTTLE_LIMIT ?? 120),
  },
});
