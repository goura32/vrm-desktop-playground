import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import type { Display, IpcMainEvent, IpcMainInvokeEvent, OpenDialogOptions, Rectangle } from 'electron';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUNDLED_ASSETS, getBundledAsset, isBundledAssetId } from '../shared/bundledAssets';
import { isFilePayload, isLikelyAssetName, MAX_FILE_BYTES } from '../shared/fileValidation';
import type { FileKind } from '../shared/fileValidation';
import { IPC_CHANNELS } from '../shared/ipc';
import { isAvatarCommand, isAvatarStatus } from '../shared/ipcValidation';
import type { AvatarCommand, AvatarStatus, FilePayload } from '../shared/types';
import type { BundledAssetId } from '../shared/bundledAssets';
import type { WindowStateSnapshot } from '../shared/windowState';
import { createInitialWindowState } from '../shared/windowState';
import { DEFAULT_CHARACTER_POSITION } from '../shared/scenePosition';
import { createInitialLipSyncStatus } from '../shared/lipsync';
import { getElectronPlatformSwitches } from './platform/linux';

const DEV_SERVER_URL = 'http://127.0.0.1:5173';
let avatarWindow: BrowserWindow | null = null;
let debugWindow: BrowserWindow | null = null;
let windowState = createInitialWindowState();
let lastAvatarStatus = createInitialAvatarStatus();
let lastLipSyncLogKey = '';
let windowLayoutInitialized = false;

function log(message: string): void {
  console.info(`[vrm-desktop-playground] ${message}`);
}

function createInitialAvatarStatus(): AvatarStatus {
  return {
    phase: 'idle',
    message: 'Avatar window ready. Loading the bundled VRM sample…',
    model: null,
    motions: [],
    activeMotionId: null,
    idleMotionId: null,
    idleAutoStartSuppressed: false,
    motionMode: 'stopped',
    playback: 'stopped',
    loop: true,
    speed: 1,
    autoBlink: true,
    manualBlink: false,
    lookAt: true,
    characterPosition: { ...DEFAULT_CHARACTER_POSITION },
    lipSync: createInitialLipSyncStatus(),
  };
}

function isDevMode(): boolean {
  return process.argv.includes('--dev');
}

function isAllowedRendererUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (isDevMode()) {
      return parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.port === '5173' &&
        (parsed.pathname === '/index.html' || parsed.pathname === '/avatar.html');
    }

    const distRoot = pathToFileURL(`${path.join(app.getAppPath(), 'dist')}${path.sep}`).href;
    return parsed.protocol === 'file:' && url.startsWith(distRoot);
  } catch {
    return false;
  }
}

function protectWebContents(browserWindow: BrowserWindow): void {
  browserWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedRendererUrl(url)) {
      event.preventDefault();
      log(`blocked renderer navigation: ${url}`);
    }
  });
  browserWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedRendererUrl(url)) {
      event.preventDefault();
      log(`blocked renderer redirect: ${url}`);
    }
  });
  browserWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

function isSender(event: IpcMainEvent | IpcMainInvokeEvent, browserWindow: BrowserWindow | null): boolean {
  return Boolean(
    browserWindow &&
    !browserWindow.isDestroyed() &&
    event.sender === browserWindow.webContents &&
    event.senderFrame &&
    event.senderFrame === event.sender.mainFrame &&
    isAllowedRendererUrl(event.senderFrame.url),
  );
}

function isDebugSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return isSender(event, debugWindow);
}

function isAvatarSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return isSender(event, avatarWindow);
}

function rejectIpcSender(channel: string): void {
  log(`rejected IPC sender for ${channel}`);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}


function enforceAvatarOverlayPolicy(): void {
  if (!avatarWindow || avatarWindow.isDestroyed()) {
    return;
  }

  avatarWindow.setAlwaysOnTop(windowState.alwaysOnTop);
  avatarWindow.setIgnoreMouseEvents(true, { forward: true });
}

function formatBounds(bounds: Rectangle): string {
  return `${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`;
}

function logPrimaryDisplayGeometry(display: Display, avatarBounds: Rectangle): void {
  log(`primary display geometry: bounds=${formatBounds(display.bounds)} workArea=${formatBounds(display.workArea)} scaleFactor=${display.scaleFactor} avatarWindow.getBounds=${formatBounds(avatarBounds)}`);
}

function applyPrimaryDisplayBounds(): void {
  if (!avatarWindow || avatarWindow.isDestroyed()) {
    return;
  }

  const display = screen.getPrimaryDisplay();
  const bounds = display.bounds;
  avatarWindow.setBounds(bounds);
  avatarWindow.setFullScreen(true);
  windowState = {
    ...windowState,
    avatar: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
  };
  enforceAvatarOverlayPolicy();
  logPrimaryDisplayGeometry(display, avatarWindow.getBounds());
  broadcastWindowState();
}

function currentWindowState(): WindowStateSnapshot {
  const avatarBounds = avatarWindow && !avatarWindow.isDestroyed()
    ? avatarWindow.getBounds()
    : windowState.avatar;
  const debugBounds = debugWindow && !debugWindow.isDestroyed()
    ? debugWindow.getBounds()
    : windowState.debug;

  return {
    ...windowState,
    avatar: {
      x: avatarBounds.x,
      y: avatarBounds.y,
      width: avatarBounds.width,
      height: avatarBounds.height,
    },
    debug: {
      x: debugBounds.x,
      y: debugBounds.y,
      width: debugBounds.width,
      height: debugBounds.height,
    },
    alwaysOnTop: windowState.alwaysOnTop,
  };
}

function broadcastWindowState(): WindowStateSnapshot {
  windowState = currentWindowState();
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send(IPC_CHANNELS.windowState, windowState);
  }
  return windowState;
}

function logLipSyncCue(status: AvatarStatus): void {
  const lipSync = status.lipSync;
  const validation = lipSync.validation;
  const baseKey = `${lipSync.state}|${lipSync.testId ?? ''}|${lipSync.sourcePhone ?? ''}|${lipSync.dominantMouth ?? ''}`;
  const key = lipSync.state === 'playing'
    ? baseKey
    : `${baseKey}|${validation.frameCount}|${validation.endDriftMs ?? ''}`;
  if (key === lastLipSyncLogKey) {
    return;
  }
  lastLipSyncLogKey = key;
  if (lipSync.state === 'playing') {
    log(`lip-sync cue: test=${lipSync.testId ?? 'unknown'} language=${lipSync.language ?? 'unknown'} audio_time=${lipSync.currentTime.toFixed(3)} phone=${lipSync.sourcePhone ?? 'sil'} dominant=${lipSync.dominantMouth ?? 'closed'} weights=${JSON.stringify(lipSync.weights)}`);
  } else if (lipSync.state === 'stopped' || lipSync.state === 'error') {
    log(`lip-sync summary: test=${lipSync.testId ?? 'unknown'} state=${lipSync.state} duration_delta_ms=${validation.durationDeltaMs ?? 'n/a'} p50_ms=${validation.cueLatencyP50Ms ?? 'n/a'} p95_ms=${validation.cueLatencyP95Ms ?? 'n/a'} max_ms=${validation.cueLatencyMaxMs ?? 'n/a'} end_drift_ms=${validation.endDriftMs ?? 'n/a'} cumulative_drift_ms=${validation.cumulativeDriftMs} stuck=${validation.mouthStuckEventCount} invalid=${validation.invalidWeightCount} missing=${validation.missingExpressionCount} dropped=${validation.droppedFrameCount} late=${validation.lateFrameCount} mouth_distribution=${JSON.stringify(validation.mouthDistribution)}`);
  }
}

function broadcastAvatarStatus(status: AvatarStatus): void {
  lastAvatarStatus = status;
  logLipSyncCue(status);
  log(`avatar status: ${status.phase} — ${status.message}`);
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send(IPC_CHANNELS.avatarStatus, status);
  }
}

function sendAvatarCommand(command: AvatarCommand): void {
  log(`route avatar command: ${command.type}`);
  if (avatarWindow && !avatarWindow.isDestroyed()) {
    avatarWindow.webContents.send(IPC_CHANNELS.sendAvatarCommand, command);
  }
}

async function readBundledAsset(assetId: BundledAssetId): Promise<FilePayload> {
  const descriptor = getBundledAsset(assetId);
  const relativePath = path.normalize(descriptor.relativePath);
  const candidatePaths = [
    path.join(app.getAppPath(), 'assets', relativePath),
    path.join(app.getAppPath(), 'dist', relativePath),
    path.join(__dirname, '..', 'assets', relativePath),
  ];

  for (const candidate of candidatePaths) {
    try {
      await access(candidate);
      const data = await readFile(candidate);
      return { name: path.basename(candidate), data: toArrayBuffer(data) };
    } catch {
      // Try the next known, application-owned location.
    }
  }

  throw new Error(`Bundled asset “${descriptor.displayName}” is not available.`);
}

async function routeFile(kind: FileKind, file: FilePayload): Promise<boolean> {
  if (!isFilePayload(file) || !isLikelyAssetName(file.name, kind)) {
    broadcastAvatarStatus({
      ...lastAvatarStatus,
      phase: 'error',
      message: `Rejected ${kind.toUpperCase()} file: expected a safe filename and a valid, bounded payload.`,
    });
    return false;
  }

  if (kind === 'vrm') {
    sendAvatarCommand({ type: 'load-vrm', file });
  } else if (kind === 'vrma') {
    sendAvatarCommand({ type: 'load-vrma', file });
  } else if (kind === 'audio') {
    sendAvatarCommand({ type: 'load-audio', file });
  } else {
    sendAvatarCommand({ type: 'load-lipsync-timeline', file });
  }
  return true;
}

async function chooseAndRouteFile(kind: FileKind): Promise<boolean> {
  const owner = debugWindow && !debugWindow.isDestroyed() ? debugWindow : undefined;
  const labels: Record<FileKind, { title: string; name: string; extensions: string[] }> = {
    vrm: { title: 'Open VRM 1.0 model', name: 'VRM model', extensions: ['vrm'] },
    vrma: { title: 'Open VRMA motion', name: 'VRMA motion', extensions: ['vrma'] },
    audio: { title: 'Open lip-sync audio', name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'm4a', 'webm'] },
    timeline: { title: 'Open LipSyncTimeline JSON', name: 'LipSyncTimeline', extensions: ['json'] },
  };
  const label = labels[kind];
  const options: OpenDialogOptions = {
    title: label.title,
    properties: ['openFile'],
    filters: [{ name: label.name, extensions: label.extensions }],
  };
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return false;
  }

  try {
    const filePath = result.filePaths[0];
    const name = path.basename(filePath);
    if (!isLikelyAssetName(name, kind)) {
      broadcastAvatarStatus({
        ...lastAvatarStatus,
        phase: 'error',
        message: `Rejected file: select a .${kind} asset.`,
      });
      return false;
    }
    const fileStats = await stat(filePath);
    if (fileStats.size > MAX_FILE_BYTES) {
      broadcastAvatarStatus({
        ...lastAvatarStatus,
        phase: 'error',
        message: `Rejected file: assets larger than ${MAX_FILE_BYTES / (1024 * 1024)} MiB are not accepted.`,
      });
      return false;
    }
    const data = await readFile(filePath);
    return routeFile(kind, { name, data: toArrayBuffer(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    broadcastAvatarStatus({ ...lastAvatarStatus, phase: 'error', message: `Could not read file: ${message}` });
    return false;
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getWindowState, (event: IpcMainInvokeEvent) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.getWindowState);
      return currentWindowState();
    }
    return broadcastWindowState();
  });
  ipcMain.handle(IPC_CHANNELS.setAlwaysOnTop, (event: IpcMainInvokeEvent, enabled: unknown) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.setAlwaysOnTop);
      return currentWindowState();
    }
    if (!isBoolean(enabled)) {
      log('rejected malformed always-on-top value from renderer');
      return currentWindowState();
    }
    windowState = { ...windowState, alwaysOnTop: enabled };
    avatarWindow?.setAlwaysOnTop(windowState.alwaysOnTop);
    return broadcastWindowState();
  });

  ipcMain.handle(IPC_CHANNELS.openVrmDialog, (event: IpcMainInvokeEvent) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.openVrmDialog);
      return false;
    }
    return chooseAndRouteFile('vrm');
  });
  ipcMain.handle(IPC_CHANNELS.openVrmaDialog, (event: IpcMainInvokeEvent) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.openVrmaDialog);
      return false;
    }
    return chooseAndRouteFile('vrma');
  });
  ipcMain.handle(IPC_CHANNELS.openAudioDialog, (event: IpcMainInvokeEvent) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.openAudioDialog);
      return false;
    }
    return chooseAndRouteFile('audio');
  });
  ipcMain.handle(IPC_CHANNELS.openLipSyncTimelineDialog, (event: IpcMainInvokeEvent) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.openLipSyncTimelineDialog);
      return false;
    }
    return chooseAndRouteFile('timeline');
  });
  ipcMain.handle(IPC_CHANNELS.loadVrmFile, (event: IpcMainInvokeEvent, file: FilePayload) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.loadVrmFile);
      return false;
    }
    return routeFile('vrm', file);
  });
  ipcMain.handle(IPC_CHANNELS.loadVrmaFile, (event: IpcMainInvokeEvent, file: FilePayload) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.loadVrmaFile);
      return false;
    }
    return routeFile('vrma', file);
  });
  ipcMain.handle(IPC_CHANNELS.loadAudioFile, (event: IpcMainInvokeEvent, file: FilePayload) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.loadAudioFile);
      return false;
    }
    return routeFile('audio', file);
  });
  ipcMain.handle(IPC_CHANNELS.loadLipSyncTimelineFile, (event: IpcMainInvokeEvent, file: FilePayload) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.loadLipSyncTimelineFile);
      return false;
    }
    return routeFile('timeline', file);
  });
  ipcMain.handle(IPC_CHANNELS.loadBundledAsset, async (event: IpcMainInvokeEvent, assetId: BundledAssetId) => {
    if (!isDebugSender(event) && !isAvatarSender(event)) {
      rejectIpcSender(IPC_CHANNELS.loadBundledAsset);
      return false;
    }
    if (!isBundledAssetId(assetId)) {
      return false;
    }

    try {
      const descriptor = BUNDLED_ASSETS[assetId];
      return await routeFile(descriptor.kind, await readBundledAsset(assetId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      broadcastAvatarStatus({ ...lastAvatarStatus, phase: 'error', message });
      return false;
    }
  });
  ipcMain.on(IPC_CHANNELS.sendAvatarCommand, (event: IpcMainEvent, command: unknown) => {
    if (!isDebugSender(event)) {
      rejectIpcSender(IPC_CHANNELS.sendAvatarCommand);
      return;
    }
    if (!isAvatarCommand(command)) {
      log('rejected malformed avatar command from renderer');
      return;
    }
    sendAvatarCommand(command);
  });
  ipcMain.on(IPC_CHANNELS.avatarStatus, (event: IpcMainEvent, status: unknown) => {
    if (!isAvatarSender(event)) {
      rejectIpcSender(IPC_CHANNELS.avatarStatus);
      return;
    }
    if (!isAvatarStatus(status)) {
      log('rejected malformed avatar status from renderer');
      return;
    }
    broadcastAvatarStatus(status);
  });
}

function rendererPath(fileName: string): string {
  return path.join(app.getAppPath(), 'dist', fileName);
}

function loadRenderer(window: BrowserWindow, fileName: string): void {
  if (isDevMode()) {
    void window.loadURL(`${DEV_SERVER_URL}/${fileName}`);
  } else {
    void window.loadFile(rendererPath(fileName));
  }
}

function createWindows(): void {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  if (!windowLayoutInitialized) {
    windowState = {
      ...windowState,
      debug: { ...windowState.debug, x: workArea.x + 20, y: workArea.y + 40 },
    };
    windowLayoutInitialized = true;
  }
  windowState = {
    ...windowState,
    avatar: { ...display.bounds },
  };

  const preload = path.join(__dirname, 'preload.cjs');
  const webPreferences = {
    preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };

  avatarWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: windowState.alwaysOnTop,
    resizable: false,
    movable: false,
    fullscreen: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences,
  });
  protectWebContents(avatarWindow);
  avatarWindow.setAlwaysOnTop(windowState.alwaysOnTop);
  avatarWindow.setSkipTaskbar(true);
  avatarWindow.on('closed', () => { avatarWindow = null; });
  avatarWindow.webContents.on('did-finish-load', () => {
    avatarWindow?.showInactive();
    enforceAvatarOverlayPolicy();
    if (avatarWindow && !avatarWindow.isDestroyed()) {
      logPrimaryDisplayGeometry(display, avatarWindow.getBounds());
    }
  });

  debugWindow = new BrowserWindow({
    x: windowState.debug.x,
    y: windowState.debug.y,
    width: windowState.debug.width,
    height: windowState.debug.height,
    minWidth: 380,
    minHeight: 600,
    title: 'VRM Desktop Playground — Debug',
    backgroundColor: '#111827',
    webPreferences,
  });
  protectWebContents(debugWindow);
  debugWindow.on('move', () => broadcastWindowState());
  debugWindow.on('resize', () => broadcastWindowState());
  debugWindow.on('closed', () => {
    debugWindow = null;
    if (avatarWindow && !avatarWindow.isDestroyed()) {
      avatarWindow.close();
    }
  });
  debugWindow.webContents.on('did-finish-load', () => {
    broadcastWindowState();
    broadcastAvatarStatus(lastAvatarStatus);
  });

  loadRenderer(avatarWindow, 'avatar.html');
  loadRenderer(debugWindow, 'index.html');
  enforceAvatarOverlayPolicy();
  logPrimaryDisplayGeometry(display, avatarWindow.getBounds());
}

if (process.platform === 'linux') {
  for (const argument of getElectronPlatformSwitches(process.platform)) {
    const [key, value] = argument.replace(/^--/, '').split('=');
    app.commandLine.appendSwitch(key, value);
  }
}

app.whenReady().then(() => {
  log(`Electron ready on ${process.platform}; Linux uses --ozone-platform=x11.`);
  registerIpcHandlers();
  screen.on('display-metrics-changed', () => applyPrimaryDisplayBounds());
  screen.on('display-added', () => applyPrimaryDisplayBounds());
  screen.on('display-removed', () => applyPrimaryDisplayBounds());
  createWindows();
  app.on('activate', () => {
    if (debugWindow === null) {
      createWindows();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
