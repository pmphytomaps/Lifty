import { notify } from '../components/Dialog';

let lastMessage = '';
let lastAt = 0;

/**
 * Surface a failure instead of leaving the user staring at a button that did
 * nothing. Repeats of the same message inside a few seconds are collapsed so a
 * failing screen cannot stack dialogs.
 */
export function reportError(context: string, e: unknown): void {
  const detail = e instanceof Error ? e.message : String(e);
  const message = `${context}\n\n${detail}`;
  const now = Date.now();
  if (message === lastMessage && now - lastAt < 4000) return;
  lastMessage = message;
  lastAt = now;
  notify('Something went wrong', message).catch(() => undefined);
}

/** Attach to a promise whose failure the user must know about. */
export function surface(context: string): (e: unknown) => void {
  return (e: unknown) => reportError(context, e);
}
