import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Prisma returns `Decimal` instances. The mobile client expects plain numbers,
 * so convert them (recursively) before the response is serialized.
 */
export function serializeDecimals<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return Number(value) as unknown as T;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((item) => serializeDecimals(item)) as unknown as T;
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serializeDecimals(nested);
    }
    return result as T;
  }
  return value;
}

@Injectable()
export class DecimalSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeDecimals(data)));
  }
}
