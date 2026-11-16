/** Strips formatting and keeps the last ten digits of an Indian mobile number. */
export function normalizePhone(value: string): string {
  return (value ?? '').replace(/\D/g, '').slice(-10);
}

/**
 * Placeholder address for accounts that only ever sign in with a phone number.
 * The domain never receives mail; it exists because `User.email` is unique and
 * required by the database.
 */
export function phoneAccountEmail(phone: string): string {
  return `phone.${normalizePhone(phone)}@otp.dukaanhub.local`;
}

export const PHONE_ACCOUNT_DOMAIN = '@otp.dukaanhub.local';
