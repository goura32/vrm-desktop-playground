import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type ManifestAsset = {
  path: string | null;
  sha256: string | null;
  status: string;
  redistributable: boolean;
  license: string;
};

type Manifest = { assets: ManifestAsset[] };

const projectRoot = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'assets/manifest.json'), 'utf8')) as Manifest;

function sha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

describe('asset manifest', () => {
  it('matches every committed binary to its recorded checksum and redistribution decision', () => {
    const obtained = manifest.assets.filter((asset) => asset.status === 'obtained');
    expect(obtained.length).toBeGreaterThanOrEqual(5);
    for (const asset of obtained) {
      expect(asset.path).not.toBeNull();
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
      const absolutePath = path.join(projectRoot, 'assets', asset.path!);
      expect(existsSync(absolutePath)).toBe(true);
      expect(sha256(absolutePath)).toBe(asset.sha256);
      expect(asset.redistributable).toBe(true);
      expect(asset.license.length).toBeGreaterThan(0);
    }
  });

  it('keeps login or consent gated candidates out of the repository', () => {
    const blocked = manifest.assets.filter((asset) => asset.status === 'BLOCKED_ASSET');
    expect(blocked.length).toBeGreaterThanOrEqual(4);
    for (const asset of blocked) {
      expect(asset.path).toBeNull();
      expect(asset.sha256).toBeNull();
    }
  });
});
