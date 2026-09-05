import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Electron security boundary', () => {
  it('keeps Node access behind an isolated preload bridge', () => {
    const main = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const preload = readFileSync(new URL('../src/main/preload.ts', import.meta.url), 'utf8');
    const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const avatar = readFileSync(new URL('../avatar.html', import.meta.url), 'utf8');
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      main: string;
      scripts: Record<string, string>;
    };

    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(preload).toContain('contextBridge.exposeInMainWorld');
    expect(preload).not.toContain('window.require');
    expect(main).toContain('sandbox: true');
    expect(main).toContain("webContents.on('will-navigate'");
    expect(main).toContain('setWindowOpenHandler');
    expect(main).toContain('event.sender ===');
    expect(index).toContain('Content-Security-Policy');
    expect(avatar).toContain('Content-Security-Policy');
    expect(packageJson.main).toBe('dist-electron/main.cjs');
    expect(packageJson.scripts.predev).toContain('build:electron');
    expect(packageJson.scripts.prestart).toContain('build:electron');
  });
});
