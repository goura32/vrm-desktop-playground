import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_RENDERER_DOCUMENTS = new Set(['index.html', 'avatar.html']);

export function isAllowedRendererFileUrl(url: string, distRoot: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') {
      return false;
    }
    const relativePath = path.relative(path.resolve(distRoot), path.resolve(fileURLToPath(parsed)));
    return !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath) && ALLOWED_RENDERER_DOCUMENTS.has(relativePath);
  } catch {
    return false;
  }
}
