import type { CapabilityStatus, ExpressionInfo, VrmModelInfo } from '../../shared/types';

export function buildExpressionInfos(
  presetExpressions: Record<string, number>,
  customExpressions: Record<string, number>,
): ExpressionInfo[] {
  const preset = Object.entries(presetExpressions).map(([name, value]) => ({
    name,
    kind: 'preset' as const,
    value,
    supported: true,
  }));
  const custom = Object.entries(customExpressions).map(([name, value]) => ({
    name,
    kind: 'custom' as const,
    value,
    supported: true,
  }));
  return [...preset, ...custom];
}

export function detectVrmFormat(metaVersion: string | undefined): VrmModelInfo['format'] {
  if (metaVersion === '1') {
    return 'VRM 1.0';
  }
  if (metaVersion === '0') {
    return 'VRM 0.x';
  }
  return 'unknown';
}

export function toCapability(available: boolean): CapabilityStatus {
  return available ? 'available' : 'unsupported';
}
