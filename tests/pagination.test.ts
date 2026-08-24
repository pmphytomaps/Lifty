import { describe, expect, it } from 'vitest';
import { mergePage, shouldSkipPage } from '../src/lib/paginate';

const rows = (...ids: number[]) => ids.map((id) => ({ id, name: `w${id}` }));

describe('appending a page', () => {
  it('appends genuinely new rows in order', () => {
    expect(mergePage(rows(3, 2), rows(1))).toEqual(rows(3, 2, 1));
  });

  it('re-appending the same page is a no-op', () => {
    const first = rows(3, 2, 1);
    expect(mergePage(first, rows(3, 2, 1))).toBe(first);
  });

  it('drops only the overlap when a page partly repeats', () => {
    expect(mergePage(rows(3, 2), rows(2, 1))).toEqual(rows(3, 2, 1));
  });

  it('an empty page changes nothing', () => {
    const first = rows(3);
    expect(mergePage(first, [])).toBe(first);
  });

  it('survives the same page arriving many times', () => {
    let list = rows(3, 2, 1);
    for (let i = 0; i < 10; i++) list = mergePage(list, rows(3, 2, 1));
    expect(list).toHaveLength(3);
  });
});

describe('deciding whether to request a page', () => {
  it('refuses before the first page exists — the duplicate-page bug', () => {
    expect(shouldSkipPage({ hasMore: true, loading: false, currentCount: 0 })).toBe(true);
  });

  it('refuses while a request is already in flight', () => {
    expect(shouldSkipPage({ hasMore: true, loading: true, currentCount: 30 })).toBe(true);
  });

  it('refuses when the list is complete', () => {
    expect(shouldSkipPage({ hasMore: false, loading: false, currentCount: 30 })).toBe(true);
  });

  it('allows a genuine next page', () => {
    expect(shouldSkipPage({ hasMore: true, loading: false, currentCount: 30 })).toBe(false);
  });
});
