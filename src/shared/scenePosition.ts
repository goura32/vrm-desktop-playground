import type { CharacterMoveDirection, CharacterPosition } from './types';

export const DEFAULT_CHARACTER_POSITION: CharacterPosition = { x: 0.5, y: 0.5 };
export const DEFAULT_CHARACTER_MOVE_STEP = 0.05;

export function clampCharacterPosition(position: CharacterPosition): CharacterPosition {
  return {
    x: Math.min(1, Math.max(0, Number.isFinite(position.x) ? position.x : DEFAULT_CHARACTER_POSITION.x)),
    y: Math.min(1, Math.max(0, Number.isFinite(position.y) ? position.y : DEFAULT_CHARACTER_POSITION.y)),
  };
}

export function moveCharacterPosition(
  position: CharacterPosition,
  direction: CharacterMoveDirection,
  step = DEFAULT_CHARACTER_MOVE_STEP,
): CharacterPosition {
  const distance = Number.isFinite(step) && step > 0 ? Math.min(1, step) : DEFAULT_CHARACTER_MOVE_STEP;
  const next = { ...position };

  switch (direction) {
    case 'up':
      next.y -= distance;
      break;
    case 'down':
      next.y += distance;
      break;
    case 'left':
      next.x -= distance;
      break;
    case 'right':
      next.x += distance;
      break;
  }

  return clampCharacterPosition(next);
}
