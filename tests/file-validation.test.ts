import { describe, expect, it } from 'vitest';
import { isLikelyAssetName } from '../src/renderer/vrm/fileValidation';
import { isFilePayload } from '../src/shared/fileValidation';

describe('asset validation', () => {
  it('accepts only the expected VRM/VRMA extensions', () => {
    expect(isLikelyAssetName('character.vrm', 'vrm')).toBe(true);
    expect(isLikelyAssetName('motion.VRMA', 'vrma')).toBe(true);
    expect(isLikelyAssetName('character.gltf', 'vrm')).toBe(false);
    expect(isLikelyAssetName('motion.vrm', 'vrma')).toBe(false);
    expect(isLikelyAssetName('../motion.vrma', 'vrma')).toBe(false);
  });

  it('rejects malformed or oversized IPC file payloads', () => {
    expect(isFilePayload({ name: 'character.vrm', data: new ArrayBuffer(1) })).toBe(true);
    expect(isFilePayload({ name: '../character.vrm', data: new ArrayBuffer(1) })).toBe(false);
    expect(isFilePayload({ name: 'character.vrm', data: new ArrayBuffer(0) })).toBe(false);
    expect(isFilePayload({ name: 'character.vrm', data: new ArrayBuffer(5) }, 4)).toBe(false);
  });
});
