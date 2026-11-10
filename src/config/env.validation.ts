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

  UPLOAD_DIR: Joi.string().default('uploads'),
  MAX_UPLOAD_MB: Joi.number().min(1).max(50).default(5),

  PAYMENT_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  PAYMENTS_AUTO_CONFIRM: Joi.boolean().default(false),
  FREE_DELIVERY_THRESHOLD: Joi.number().min(0).default(199),
  DELIVERY_FEE: Joi.number().min(0).default(25),
  HANDLING_FEE: Joi.number().min(0).default(2),

  THROTTLE_TTL: Joi.number().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().min(1).default(120),
});
