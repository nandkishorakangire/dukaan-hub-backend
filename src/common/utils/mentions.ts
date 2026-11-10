const MENTION_RE = /(?:^|[^a-z0-9._@-])@([a-z0-9._-]{2,30})/gi;

/** Extracts @handles from a chat message, lowercased and de-duplicated. */
export function extractMentions(text: string): string[] {
  const handles = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    handles.add(match[1].toLowerCase());
  }
  return [...handles];
}

/** Handles that flag a message as priority: the platform and this seller. */
export function priorityHandles(sellerName: string): Set<string> {
  const compact = sellerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const first = sellerName.toLowerCase().split(/\s+/)[0];
  return new Set(['dukaanhub', 'seller', compact, first]);
}

export function isPriorityMessage(text: string, sellerName: string): boolean {
  const handles = priorityHandles(sellerName);
  return extractMentions(text).some((handle) => handles.has(handle));
}
