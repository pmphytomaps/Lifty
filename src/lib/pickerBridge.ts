/** Hand-off between screens and the exercise picker modal, avoiding param serialisation. */
type Handler = (exerciseIds: string[]) => void;
let handler: Handler | null = null;

export function setPickerHandler(h: Handler): void {
  handler = h;
}

export function firePickerHandler(ids: string[]): void {
  handler?.(ids);
  handler = null;
}
