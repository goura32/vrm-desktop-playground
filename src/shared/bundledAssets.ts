export const BUNDLED_ASSETS = {
  'constraint-twist': {
    kind: 'vrm',
    displayName: 'VRM1 Constraint Twist Sample',
    relativePath: 'vrm/VRM1_Constraint_Twist_Sample.vrm',
  },
  'seed-san': {
    kind: 'vrm',
    displayName: 'Seed-san',
    relativePath: 'vrm/Seed-san.vrm',
  },
  'expression-overridden': {
    kind: 'vrm',
    displayName: 'Expression test — overridden',
    relativePath: 'vrm/VRMC_vrm_expressions_isBinary_Overridden.vrm',
  },
  'expression-overrides': {
    kind: 'vrm',
    displayName: 'Expression test — overrides',
    relativePath: 'vrm/VRMC_vrm_expressions_isBinary_Overrides.vrm',
  },
  'test-vrma': {
    kind: 'vrma',
    displayName: 'three-vrm test motion',
    relativePath: 'vrma/test.vrma',
  },
} as const;

export type BundledAssetId = keyof typeof BUNDLED_ASSETS;
export type BundledAssetDescriptor = (typeof BUNDLED_ASSETS)[BundledAssetId];

export function isBundledAssetId(value: unknown): value is BundledAssetId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BUNDLED_ASSETS, value);
}

export function getBundledAsset(id: BundledAssetId): BundledAssetDescriptor {
  return BUNDLED_ASSETS[id];
}
