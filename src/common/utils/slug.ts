/** URL-safe slug used for businesses, pages and categories. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Finds the first free slug by suffixing -2, -3, ... when needed. */
export async function uniqueSlug(
  desired: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(desired) || 'item';
  let candidate = base;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
