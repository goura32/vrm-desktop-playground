import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getFocusableControlOrder, normalizeMoveStep, parseCoordinate } from '../src/renderer/debug/controlModel';

describe('debug control model', () => {
  it('keeps the main controls in a keyboard-friendly deterministic order', () => {
    expect(getFocusableControlOrder()).toEqual([
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
    ]);
  });

  it('normalizes a safe positive movement step', () => {
    expect(normalizeMoveStep('25')).toBe(25);
    expect(normalizeMoveStep('0')).toBe(10);
    expect(normalizeMoveStep('-4')).toBe(10);
    expect(normalizeMoveStep('not-a-number')).toBe(10);
  });

  it('parses finite coordinates and rejects invalid input', () => {
    expect(parseCoordinate('12.5')).toBe(12.5);
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('Infinity')).toBeNull();
  });

  it('keeps directional controls in the documented keyboard order', () => {
    const source = readFileSync(new URL('../src/renderer/debug/DebugWindow.tsx', import.meta.url), 'utf8');
    const controlPositions = ['move-up', 'move-down', 'move-left', 'move-right'].map((id) => source.indexOf(`id="${id}"`));
    expect(controlPositions.every((position) => position >= 0)).toBe(true);
    expect(controlPositions).toEqual([...controlPositions].sort((left, right) => left - right));
  });
});
