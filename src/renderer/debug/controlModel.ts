import { DEFAULT_CHARACTER_MOVE_STEP } from '../../shared/scenePosition';
import type { CharacterMoveDirection } from '../../shared/types';

export const DEBUG_FOCUSABLE_CONTROL_ORDER = [
  'always-on-top',
  'character-position-x',
  'character-position-y',
  'character-move-step',
  'set-character-position',
  'move-character-up',
  'move-character-down',
  'move-character-left',
  'move-character-right',
  'open-vrm',
  'open-vrma',
] as const;

export function getFocusableControlOrder(): string[] {
  return [...DEBUG_FOCUSABLE_CONTROL_ORDER];
}

export function normalizeMoveStep(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : DEFAULT_CHARACTER_MOVE_STEP;
}

export function parseNormalizedCoordinate(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

export function directionForKey(key: string, code = key): CharacterMoveDirection | null {
  const directions: Record<string, CharacterMoveDirection> = {
    arrowup: 'up',
    up: 'up',
    arrowdown: 'down',
    down: 'down',
    arrowleft: 'left',
    left: 'left',
    arrowright: 'right',
    right: 'right',
  };
  return directions[key.toLowerCase()] ?? directions[code.toLowerCase()] ?? null;
}
