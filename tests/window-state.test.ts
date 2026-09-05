import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOVE_STEP,
  createInitialWindowState,
  isMoveDirection,
  movePosition,
  resolveEffectiveClickThrough,
} from '../src/shared/windowState';

describe('window state', () => {
  it('creates the documented probe defaults', () => {
    const state = createInitialWindowState();

    expect(state.avatar.width).toBe(600);
    expect(state.avatar.height).toBe(800);
    expect(state.debug.width).toBe(420);
    expect(state.debug.height).toBe(720);
    expect(state.alwaysOnTop).toBe(true);
    expect(state.clickThrough).toBe(false);
    expect(state.interactionMode).toBe(true);
  });

  it('moves the avatar by the configured step in each direction', () => {
    expect(movePosition({ x: 100, y: 200 }, 'up')).toEqual({ x: 100, y: 190 });
    expect(movePosition({ x: 100, y: 200 }, 'down')).toEqual({ x: 100, y: 210 });
    expect(movePosition({ x: 100, y: 200 }, 'left')).toEqual({ x: 90, y: 200 });
    expect(movePosition({ x: 100, y: 200 }, 'right')).toEqual({ x: 110, y: 200 });
    expect(movePosition({ x: 100, y: 200 }, 'right', 25)).toEqual({ x: 125, y: 200 });
    expect(DEFAULT_MOVE_STEP).toBe(10);
  });

  it('lets interaction mode temporarily override click-through', () => {
    expect(resolveEffectiveClickThrough(false, false)).toBe(false);
    expect(resolveEffectiveClickThrough(true, false)).toBe(true);
    expect(resolveEffectiveClickThrough(true, true)).toBe(false);
  });

  it('recognizes only supported movement directions at runtime', () => {
    expect(isMoveDirection('up')).toBe(true);
    expect(isMoveDirection('diagonal')).toBe(false);
    expect(isMoveDirection(null)).toBe(false);
  });
});
