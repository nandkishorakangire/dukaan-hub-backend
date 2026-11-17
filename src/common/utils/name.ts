export type NameParts = {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
};

function clean(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

/** Joins the identity parts into the single display name the app renders. */
export function composeName(parts: NameParts): string {
  return [parts.first_name, parts.middle_name, parts.last_name]
    .map(clean)
    .filter(Boolean)
    .join(' ');
}

/**
 * Best-effort split for accounts created before name parts existed, or for
 * social/phone sign-ups that only carry a single display name.
 */
export function splitName(name: string): Required<NameParts> {
  const parts = clean(name).split(' ').filter(Boolean);
  return {
    first_name: parts[0] ?? '',
    middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    last_name: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}
