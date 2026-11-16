import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  DATABASE_URL: Joi.string().min(1).required(),
  CORS_ORIGINS: Joi.string().default('*'),
  PUBLIC_BASE_URL: Joi.string().uri().default('http://localhost:4000'),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  OTP_TTL_MINUTES: Joi.number().min(1).max(60).default(10),
  OTP_MAX_ATTEMPTS: Joi.number().min(1).max(10).default(5),
  /** Returns the OTP/reset token in the response so a local build can test the flow. */
  AUTH_EXPOSE_CODES: Joi.boolean().optional(),
  PASSWORD_RESET_TTL_MINUTES: Joi.number().min(5).max(1440).default(30),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  FACEBOOK_APP_ID: Joi.string().allow('').default(''),
  FACEBOOK_APP_SECRET: Joi.string().allow('').default(''),

  UPLOAD_DIR: Joi.string().default('uploads'),
  MAX_UPLOAD_MB: Joi.number().min(1).max(50).default(5),

  PAYMENT_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  PAYMENTS_AUTO_CONFIRM: Joi.boolean().default(false),
  FREE_DELIVERY_THRESHOLD: Joi.number().min(0).default(199),
  DELIVERY_FEE: Joi.number().min(0).default(25),
  HANDLING_FEE: Joi.number().min(0).default(2),
  FAST_DELIVERY_FEE: Joi.number().min(0).default(50),
  PAY_LATER_MONTHLY_LIMIT: Joi.number().min(1).max(50).default(3),

  THROTTLE_TTL: Joi.number().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().min(1).default(120),
});
