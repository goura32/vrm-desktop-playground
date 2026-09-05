import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { directionForKey, getFocusableControlOrder, normalizeMoveStep, parseNormalizedCoordinate } from '../src/renderer/debug/controlModel';

describe('debug control model', () => {
  it('keeps the main controls in a keyboard-friendly deterministic order', () => {
    expect(getFocusableControlOrder()).toEqual([
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
    ]);
  });

  it('normalizes a bounded screen-space movement step', () => {
    expect(normalizeMoveStep('0.25')).toBe(0.25);
    expect(normalizeMoveStep('0')).toBe(0.05);
    expect(normalizeMoveStep('2')).toBe(0.05);
    expect(normalizeMoveStep('not-a-number')).toBe(0.05);
  });

  it('parses normalized screen-space coordinates and rejects invalid input', () => {
    expect(parseNormalizedCoordinate('0.125')).toBe(0.125);
    expect(parseNormalizedCoordinate('0')).toBe(0);
    expect(parseNormalizedCoordinate('1')).toBe(1);
    expect(parseNormalizedCoordinate('-0.1')).toBeNull();
    expect(parseNormalizedCoordinate('1.1')).toBeNull();
    expect(parseNormalizedCoordinate('')).toBeNull();
    expect(parseNormalizedCoordinate('Infinity')).toBeNull();
  });

  it('maps keyboard arrow variants to character directions', () => {
    expect(directionForKey('ArrowRight')).toBe('right');
    expect(directionForKey('right')).toBe('right');
    expect(directionForKey('ignored', 'ArrowUp')).toBe('up');
    expect(directionForKey('Enter')).toBeNull();
  });

  it('keeps directional controls in the documented keyboard order', () => {
    const source = readFileSync(new URL('../src/renderer/debug/DebugWindow.tsx', import.meta.url), 'utf8');
    const controlPositions = ['move-character-up', 'move-character-down', 'move-character-left', 'move-character-right']
      .map((id) => source.indexOf(`id="${id}"`));
    expect(controlPositions.every((position) => position >= 0)).toBe(true);
    expect(controlPositions).toEqual([...controlPositions].sort((left, right) => left - right));
    expect(source).not.toContain('Interaction Mode');
    expect(source).not.toContain('api.setPosition');
    expect(source).not.toContain('api.moveBy');
  });
});
