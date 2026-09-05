import { describe, expect, it } from 'vitest';
import {
  buildExpressionInfos,
  detectVrmFormat,
  toCapability,
} from '../src/renderer/vrm/vrmModelInfo';

describe('VRM model metadata helpers', () => {
  it('separates preset and custom expressions while preserving values', () => {
    expect(buildExpressionInfos({ happy: 0.4, aa: 0 }, { wink: 0.8 })).toEqual([
      { name: 'happy', kind: 'preset', value: 0.4, supported: true },
      { name: 'aa', kind: 'preset', value: 0, supported: true },
      { name: 'wink', kind: 'custom', value: 0.8, supported: true },
    ]);
  });

  it('recognizes VRM 1.0 and reports unsupported capabilities explicitly', () => {
    expect(detectVrmFormat('1')).toBe('VRM 1.0');
    expect(detectVrmFormat('0')).toBe('VRM 0.x');
    expect(detectVrmFormat(undefined)).toBe('unknown');
    expect(toCapability(true)).toBe('available');
    expect(toCapability(false)).toBe('unsupported');
  });
});
