import { describe, expect, it } from 'vitest';
import { isAvatarCommand, isAvatarStatus } from '../src/shared/ipcValidation';

describe('IPC runtime validation', () => {
  it('accepts bounded commands and rejects malformed renderer input', () => {
    expect(isAvatarCommand({ type: 'set-expression', name: 'happy', value: 0.5 })).toBe(true);
    expect(isAvatarCommand({ type: 'set-character-position', position: { x: 0.25, y: 0.75 } })).toBe(true);
    expect(isAvatarCommand({ type: 'move-character', direction: 'right', step: 0.05 })).toBe(true);
    expect(isAvatarCommand({ type: 'set-character-position', position: { x: 2, y: 0.5 } })).toBe(false);
    expect(isAvatarCommand({ type: 'move-character', direction: 'diagonal', step: 0.05 })).toBe(false);
    expect(isAvatarCommand({ type: 'move-character', direction: 'right', step: 2 })).toBe(false);
    expect(isAvatarCommand({ type: 'load-vrm', file: { name: 'character.vrm', data: new ArrayBuffer(1) } })).toBe(true);
    expect(isAvatarCommand({ type: 'load-vrm', file: { name: 'character.txt', data: new ArrayBuffer(1) } })).toBe(false);
    expect(isAvatarCommand({ type: 'set-expression', name: 'happy', value: Number.NaN })).toBe(false);
    expect(isAvatarCommand({ type: 'unknown-command' })).toBe(false);
  });

  it('accepts the serializable avatar status shape and rejects invalid values', () => {
    const status = {
      phase: 'ready',
      message: 'Loaded',
      model: null,
      motions: [],
      activeMotionId: null,
      playback: 'stopped',
      loop: true,
      speed: 1,
      autoBlink: true,
      manualBlink: false,
      lookAt: true,
      characterPosition: { x: 0.5, y: 0.5 },
    };
    expect(isAvatarStatus(status)).toBe(true);
    expect(isAvatarStatus({ ...status, speed: 99 })).toBe(false);
    expect(isAvatarStatus({ ...status, phase: 'broken' })).toBe(false);
    expect(isAvatarStatus({ ...status, characterPosition: { x: -1, y: 0.5 } })).toBe(false);
  });
});
