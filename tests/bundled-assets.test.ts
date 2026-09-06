import { describe, expect, it } from 'vitest';
import { BUNDLED_ASSETS, getBundledAsset, isBundledAssetId } from '../src/shared/bundledAssets';

describe('bundled asset allowlist', () => {
  it('exposes only repository-owned, license-reviewed smoke assets', () => {
    expect(Object.keys(BUNDLED_ASSETS)).toEqual([
      'constraint-twist',
      'seed-san',
      'expression-overridden',
      'expression-overrides',
      'test-vrma',
      'idle-relax',
      'gesture-goodbye',
      'regression-jump',
    ]);
    expect(getBundledAsset('seed-san')).toMatchObject({ kind: 'vrm', relativePath: 'vrm/Seed-san.vrm' });
    expect(getBundledAsset('test-vrma')).toMatchObject({ kind: 'vrma', relativePath: 'vrma/test.vrma' });
    expect(getBundledAsset('idle-relax')).toMatchObject({ kind: 'vrma', relativePath: 'vrma/Relax.vrma' });
    expect(getBundledAsset('gesture-goodbye')).toMatchObject({ kind: 'vrma', relativePath: 'vrma/Goodbye.vrma' });
    expect(getBundledAsset('regression-jump')).toMatchObject({ kind: 'vrma', relativePath: 'vrma/Jump.vrma' });
  });

  it('rejects inherited object keys instead of treating them as allowlisted assets', () => {
    expect(isBundledAssetId('toString')).toBe(false);
    expect(isBundledAssetId('__proto__')).toBe(false);
    expect(isBundledAssetId('not-an-asset')).toBe(false);
  });
});
