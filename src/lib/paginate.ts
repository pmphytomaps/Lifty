/**
 * Appending a page to a list is where duplicates creep in: a list view fires
 * "end reached" as soon as its content is shorter than the screen, which is
 * before the first page has landed, so page 0 can be fetched twice and appended
 * to itself. Merging by identity makes that harmless.
 */
export function mergePage<T extends { id: number }>(previous: T[], page: T[]): T[] {
  if (page.length === 0) return previous;
  const seen = new Set(previous.map((row) => row.id));
  const fresh = page.filter((row) => !seen.has(row.id));
  return fresh.length === 0 ? previous : [...previous, ...fresh];
}

/** True when a page request would duplicate work or run before there is a list. */
export function shouldSkipPage(opts: {
  hasMore: boolean;
  loading: boolean;
  currentCount: number;
}): boolean {
  return !opts.hasMore || opts.loading || opts.currentCount === 0;
}
