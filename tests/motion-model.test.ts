import { describe, expect, it } from 'vitest';
import {
  clampMotionSpeed,
  createMotionId,
  motionLoopMode,
} from '../src/renderer/vrm/motionModel';

describe('motion controls', () => {
  it('clamps speed to a usable range', () => {
    expect(clampMotionSpeed(1.25)).toBe(1.25);
    expect(clampMotionSpeed(0)).toBe(0.1);
    expect(clampMotionSpeed(5)).toBe(2);
    expect(clampMotionSpeed(Number.NaN)).toBe(1);
  });

  it('creates stable motion ids from names and occurrence', () => {
    expect(createMotionId('Walk.vrma', 0)).toBe('Walk.vrma-0');
    expect(createMotionId('Walk.vrma', 1)).toBe('Walk.vrma-1');
  });

  it('maps loop checkbox state to the Three.js loop mode', () => {
    expect(motionLoopMode(true)).toBe('repeat');
    expect(motionLoopMode(false)).toBe('once');
  });
});
