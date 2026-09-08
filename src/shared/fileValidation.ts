import type { FilePayload } from './types';

export const MAX_FILE_BYTES = 250 * 1024 * 1024;

export type FileKind = 'vrm' | 'vrma' | 'audio' | 'timeline';

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) || codePoint === 0x2028 || codePoint === 0x2029;
  });
}

export function isLikelyAssetName(name: string, kind: FileKind): boolean {
  if (hasControlCharacters(name) || !/^[^/\\]+\.[a-z0-9]+$/i.test(name)) {
    return false;
  }
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (kind === 'vrm' || kind === 'vrma') {
    return extension === kind;
  }
  if (kind === 'audio') {
    return ['wav', 'mp3', 'ogg', 'm4a', 'webm'].includes(extension);
  }
  return extension === 'json';
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
  return !name.includes('/') && !name.includes('\\') && !hasControlCharacters(name) && name !== '.' && name !== '..';
}
