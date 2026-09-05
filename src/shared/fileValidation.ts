import type { FilePayload } from './types';

export const MAX_FILE_BYTES = 250 * 1024 * 1024;

export function isLikelyAssetName(name: string, kind: 'vrm' | 'vrma'): boolean {
  return /^[^/\\]+\.(vrm|vrma)$/i.test(name) && name.toLowerCase().endsWith(`.${kind}`);
}

export function isFilePayload(value: unknown, maxBytes = MAX_FILE_BYTES): value is FilePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<FilePayload>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    candidate.name.length <= 255 &&
    isSafeFileName(candidate.name) &&
    candidate.data instanceof ArrayBuffer &&
    candidate.data.byteLength > 0 &&
    candidate.data.byteLength <= maxBytes
  );
}

function isSafeFileName(name: string): boolean {
  return !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..';
}
