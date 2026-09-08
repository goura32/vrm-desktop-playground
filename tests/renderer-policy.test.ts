import { describe, expect, it } from 'vitest';
import { isAllowedRendererFileUrl } from '../src/main/rendererPolicy';

describe('renderer file policy', () => {
  const distRoot = '/app/dist';

  it('allows only the two renderer documents inside dist', () => {
    expect(isAllowedRendererFileUrl('file:///app/dist/index.html', distRoot)).toBe(true);
    expect(isAllowedRendererFileUrl('file:///app/dist/avatar.html', distRoot)).toBe(true);
    expect(isAllowedRendererFileUrl('file:///app/dist/assets/avatar.js', distRoot)).toBe(false);
  });

  it('rejects traversal and sibling-prefix paths', () => {
    expect(isAllowedRendererFileUrl('file:///app/dist/../package.json', distRoot)).toBe(false);
    expect(isAllowedRendererFileUrl('file:///app/dist-other/index.html', distRoot)).toBe(false);
    expect(isAllowedRendererFileUrl('http://127.0.0.1:5173/avatar.html', distRoot)).toBe(false);
  });
});
