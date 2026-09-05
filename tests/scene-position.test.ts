import { describe, expect, it } from 'vitest';
import {
  clampCharacterPosition,
  DEFAULT_CHARACTER_MOVE_STEP,
  DEFAULT_CHARACTER_POSITION,
  moveCharacterPosition,
} from '../src/shared/scenePosition';

describe('character scene position', () => {
  it('uses a normalized screen-space default', () => {
    expect(DEFAULT_CHARACTER_POSITION).toEqual({ x: 0.5, y: 0.5 });
    expect(DEFAULT_CHARACTER_MOVE_STEP).toBe(0.05);
  });

  it('clamps character coordinates to the Primary Display viewport', () => {
    expect(clampCharacterPosition({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 });
    expect(clampCharacterPosition({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual(DEFAULT_CHARACTER_POSITION);
  });

  it('moves the character in scene/screen-space and clamps at the edges', () => {
    const start = { x: 0.5, y: 0.5 };
    expect(moveCharacterPosition(start, 'up')).toEqual({ x: 0.5, y: 0.45 });
    expect(moveCharacterPosition(start, 'down', 0.2)).toEqual({ x: 0.5, y: 0.7 });
    expect(moveCharacterPosition(start, 'left')).toEqual({ x: 0.45, y: 0.5 });
    expect(moveCharacterPosition(start, 'right', 0.8)).toEqual({ x: 1, y: 0.5 });
    expect(moveCharacterPosition({ x: 0, y: 0 }, 'up')).toEqual({ x: 0, y: 0 });
  });
});
