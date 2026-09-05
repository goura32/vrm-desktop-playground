export const DEFAULT_MOVE_STEP = 10;

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

export interface WindowBounds extends Position {
  width: number;
  height: number;
}

export interface WindowStateSnapshot {
  avatar: WindowBounds;
  debug: WindowBounds;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  interactionMode: boolean;
  effectiveClickThrough: boolean;
  moveStep: number;
}

export function isMoveDirection(value: unknown): value is MoveDirection {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

export function createInitialWindowState(): WindowStateSnapshot {
  return {
    avatar: { x: 100, y: 80, width: 600, height: 800 },
    debug: { x: 720, y: 80, width: 420, height: 720 },
    alwaysOnTop: true,
    clickThrough: false,
    interactionMode: true,
    effectiveClickThrough: false,
    moveStep: DEFAULT_MOVE_STEP,
  };
}

export function movePosition(
  position: Position,
  direction: MoveDirection,
  step = DEFAULT_MOVE_STEP,
): Position {
  const distance = Number.isFinite(step) && step > 0 ? step : DEFAULT_MOVE_STEP;

  switch (direction) {
    case 'up':
      return { x: position.x, y: position.y - distance };
    case 'down':
      return { x: position.x, y: position.y + distance };
    case 'left':
      return { x: position.x - distance, y: position.y };
    case 'right':
      return { x: position.x + distance, y: position.y };
  }
}

export function resolveEffectiveClickThrough(
  clickThrough: boolean,
  interactionMode: boolean,
): boolean {
  return clickThrough && !interactionMode;
}
