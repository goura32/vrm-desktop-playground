import type { CharacterMoveDirection, CharacterPosition } from './types';

export const DEFAULT_CHARACTER_POSITION: CharacterPosition = { x: 0.5, y: 0.87 };
export const DEFAULT_CHARACTER_MOVE_STEP = 0.05;

export interface ProjectedModelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ProjectedAnchor {
  x: number;
  y: number;
}

function clampProjectedValue(value: number, min: number, max: number): number {
  if (min <= max) {
    return Math.min(max, Math.max(min, value));
  }
  return (min + max) / 2;
}

export function clampCharacterPositionToProjectedBounds(
  position: CharacterPosition,
  anchor: ProjectedAnchor,
  modelBounds: ProjectedModelBounds,
  edgeMargin = 0.02,
): CharacterPosition {
  const normalized = clampCharacterPosition(position);
  if (![anchor.x, anchor.y, modelBounds.minX, modelBounds.maxX, modelBounds.minY, modelBounds.maxY].every(Number.isFinite)) {
    return normalized;
  }

  const margin = Number.isFinite(edgeMargin) && edgeMargin >= 0 && edgeMargin < 1 ? edgeMargin : 0.02;
  const targetX = normalized.x * 2 - 1;
  const targetY = 1 - normalized.y * 2;
  const minTargetX = -1 + margin - (modelBounds.minX - anchor.x);
  const maxTargetX = 1 - margin - (modelBounds.maxX - anchor.x);
  const minTargetY = -1 + margin - (modelBounds.minY - anchor.y);
  const maxTargetY = 1 - margin - (modelBounds.maxY - anchor.y);
  const safeTargetX = clampProjectedValue(targetX, minTargetX, maxTargetX);
  const safeTargetY = clampProjectedValue(targetY, minTargetY, maxTargetY);

  return {
    x: (safeTargetX + 1) / 2,
    y: (1 - safeTargetY) / 2,
  };
}

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
