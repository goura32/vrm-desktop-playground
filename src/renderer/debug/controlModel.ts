export const DEBUG_FOCUSABLE_CONTROL_ORDER = [
  'always-on-top',
  'click-through',
  'interaction-mode',
  'position-x',
  'position-y',
  'move-step',
  'set-position',
  'move-up',
  'move-down',
  'move-left',
  'move-right',
  'open-vrm',
  'open-vrma',
] as const;

export function getFocusableControlOrder(): string[] {
  return [...DEBUG_FOCUSABLE_CONTROL_ORDER];
}

export function normalizeMoveStep(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export function parseCoordinate(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
