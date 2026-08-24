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

/** Exercises created on the custom-exercise screen, collected by the picker on focus. */
let created: string[] = [];

export function pushCreatedExercise(id: string): void {
  created.push(id);
}

export function takeCreatedExercises(): string[] {
  const out = created;
  created = [];
  return out;
}
