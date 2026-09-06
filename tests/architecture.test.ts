import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Electron security boundary', () => {
  it('keeps Node access behind an isolated preload bridge', () => {
    const main = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const preload = readFileSync(new URL('../src/main/preload.ts', import.meta.url), 'utf8');
    const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const avatar = readFileSync(new URL('../avatar.html', import.meta.url), 'utf8');
    const avatarWindow = readFileSync(new URL('../src/renderer/avatar/AvatarWindow.tsx', import.meta.url), 'utf8');
    const scene = readFileSync(new URL('../src/renderer/scene/SceneController.ts', import.meta.url), 'utf8');
    const debug = readFileSync(new URL('../src/renderer/debug/DebugWindow.tsx', import.meta.url), 'utf8');
    const debugStyles = readFileSync(new URL('../src/renderer/debug/styles.css', import.meta.url), 'utf8');
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
    expect(packageJson.scripts.prestart).toBe('npm run build');
    expect(main).toContain('screen.getPrimaryDisplay()');
    expect(main).toContain("screen.on('display-metrics-changed'");
    expect(main).toContain('setIgnoreMouseEvents(true, { forward: true })');
    expect(main).toContain('resizable: false');
    expect(main).toContain('movable: false');
    expect(main).toContain('fullscreen: true');
    expect(main).toContain('avatarWindow.setFullScreen(true)');
    expect(main).toContain('width: display.bounds.width');
    expect(main).toContain('height: display.bounds.height');
    expect(main).toContain('display.workArea');
    expect(main).toContain('display.scaleFactor');
    expect(main).toContain('avatarWindow.getBounds()');
    expect(main).not.toContain('IPC_CHANNELS.setPosition');
    expect(main).not.toContain('IPC_CHANNELS.moveBy');
    expect(avatarWindow).toContain('setLookAtTarget');
    expect(scene).toContain('setCharacterPosition');
    expect(scene).toContain('moveCharacter');
    expect(scene).toContain('.project(this.camera)');
    expect(debug).toContain('set-character-position');
    expect(debug).toContain("document.addEventListener('keydown'");
    expect(debug).toContain('autoFocus');
    expect(debugStyles).toContain('.move-grid #move-character-up');
    expect(debugStyles).toContain('.move-grid #move-character-right');
    expect(debugStyles).not.toContain('.move-grid #move-up');
    expect(debug).not.toContain('click-through');
    expect(debug).not.toContain('interaction-mode');
  });
});
