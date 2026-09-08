#!/usr/bin/env node
/* Test-only hidden Electron harness; it is not part of the production window path. */
import { promises as fs, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { build } from 'esbuild';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultAudio = '/home/ws1/.cache/vrm-phase9-artifacts/LONG01.wav';
const defaultTimeline = '/home/ws1/.cache/vrm-phase9-timelines/LONG01.json';
const audioPath = process.argv[2] ?? process.env.PHASE9_AUDIO ?? defaultAudio;
const timelinePath = process.argv[3] ?? process.env.PHASE9_TIMELINE ?? defaultTimeline;
const minimumDuration = Number(process.env.PHASE9_MIN_DURATION ?? 30);
if (!Number.isFinite(minimumDuration) || minimumDuration < 0) {
  throw new Error('PHASE9_MIN_DURATION must be a finite non-negative number');
}
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vrm-phase9-real-audio-'));
process.on('exit', () => rmSync(temporaryRoot, { recursive: true, force: true }));
const cleanupTemporaryRoot = () => fs.rm(temporaryRoot, { recursive: true, force: true });
const entryPath = path.join(temporaryRoot, 'entry.ts');
const bundlePath = path.join(temporaryRoot, 'entry.js');
const htmlPath = path.join(temporaryRoot, 'index.html');
const preloadPath = path.join(temporaryRoot, 'preload.cjs');
const userDataPath = path.join(temporaryRoot, 'user-data');
const mainPath = path.join(temporaryRoot, 'main.cjs');

const browserEntry = `
import { AudioClock } from ${JSON.stringify(path.join(repositoryRoot, 'src/renderer/avatar/lipsync/AudioClock.ts'))};
import { LipSyncController } from ${JSON.stringify(path.join(repositoryRoot, 'src/renderer/avatar/lipsync/LipSyncController.ts'))};

const audioPath = ${JSON.stringify(audioPath)};
const timelinePath = ${JSON.stringify(timelinePath)};
const phase9 = window.phase9;
const sleep = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const decodeBase64 = (value) => {
  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer;
};
const readAudioFile = (filePath) => {
  const chunkSize = 256 * 1024;
  let offset = 0;
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const chunk = phase9.readBase64Chunk(filePath, offset, chunkSize);
    offset += chunk.byteLength;
    const bytes = new Uint8Array(decodeBase64(chunk.base64));
    chunks.push(bytes);
    totalBytes += bytes.byteLength;
    if (chunk.byteLength < chunkSize) {
      const result = new Uint8Array(totalBytes);
      let resultOffset = 0;
      for (const part of chunks) {
        result.set(part, resultOffset);
        resultOffset += part.byteLength;
      }
      return result.buffer;
    }
  }
};

async function run() {
  const audioData = readAudioFile(audioPath);
  const timeline = JSON.parse(phase9.readText(timelinePath));
  const mouthsSeen = new Set();
  const clock = new AudioClock();
  const controller = new LipSyncController({
    clock,
    applyMouthWeights: (weights) => {
      for (const [mouth, weight] of Object.entries(weights)) {
        if (weight > 0.05) mouthsSeen.add(mouth);
      }
      return 0;
    },
  });
  controller.setTimeline(timeline);
  const duration = await clock.load(audioData);
  controller.setAudioDuration(duration);
  const started = performance.now();
  const played = controller.play();
  await sleep(100);
  let frames = 0;
  while (controller.status.state === 'playing' && performance.now() - started < (duration + 5) * 1000) {
    controller.update();
    frames += 1;
    await sleep(1000 / 60);
  }
  controller.update();
  const result = {
    duration,
    played,
    finalState: controller.status.state,
    frames,
    elapsedMs: Math.round(performance.now() - started),
    endDriftMs: controller.status.validation.endDriftMs,
    cumulativeDriftMs: controller.status.validation.cumulativeDriftMs,
    droppedFrameCount: controller.status.validation.droppedFrameCount,
    mouthDistribution: controller.status.validation.mouthDistribution,
    mouthsSeen: [...mouthsSeen].sort(),
  };
  await clock.dispose();
  phase9.sendResult(result);
  window.close();
}

run().catch((error) => {
  phase9?.sendError(error?.stack ?? String(error));
  window.close();
});
`;

const preloadSource = `
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('node:fs');
contextBridge.exposeInMainWorld('phase9', {
  readBase64Chunk: (filePath, offset, length) => {
    const descriptor = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(length);
    const byteLength = fs.readSync(descriptor, buffer, 0, length, offset);
    fs.closeSync(descriptor);
    return { base64: buffer.subarray(0, byteLength).toString('base64'), byteLength };
  },
  readText: (filePath) => fs.readFileSync(filePath, 'utf8'),
  sendResult: (result) => ipcRenderer.send('phase9-result', result),
  sendError: (message) => ipcRenderer.send('phase9-error', message),
});
`;

const electronMain = `
const { app, BrowserWindow, ipcMain } = require('electron');
app.setPath('userData', ${JSON.stringify(userDataPath)});
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
ipcMain.on('phase9-result', (_event, result) => {
  process.stdout.write('PHASE9_REAL_AUDIO_SOAK ' + JSON.stringify(result) + '\\n');
  app.exit(0);
});
ipcMain.on('phase9-error', (_event, message) => {
  process.stderr.write('PHASE9_REAL_AUDIO_SOAK_ERROR ' + message + '\\n');
  process.exitCode = 1;
  app.exit(1);
});
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, preload: ${JSON.stringify(preloadPath)} },
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    process.stderr.write('PHASE9_REAL_AUDIO_SOAK_RENDERER_GONE ' + JSON.stringify(details) + '\\n');
    process.exitCode = 1;
    app.exit(1);
  });
  await window.loadFile(${JSON.stringify(htmlPath)});
});
app.on('window-all-closed', () => app.quit());
`;

await fs.writeFile(entryPath, browserEntry, 'utf8');
await fs.writeFile(htmlPath, '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'"></head><body><script src="./entry.js"></script></body></html>\n', 'utf8');
await fs.writeFile(preloadPath, preloadSource, 'utf8');
await fs.writeFile(mainPath, electronMain, 'utf8');
await build({
  absWorkingDir: repositoryRoot,
  bundle: true,
  entryPoints: [entryPath],
  format: 'iife',
  outfile: bundlePath,
  platform: 'browser',
  sourcemap: false,
  target: 'es2022',
});

const child = spawn(electronPath, ['--ozone-platform=x11', '--no-sandbox', mainPath], {
  cwd: repositoryRoot,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  output += text;
  process.stdout.write(text);
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
const exitCode = await new Promise((resolve, reject) => {
  const timeout = globalThis.setTimeout(() => {
    child.kill('SIGTERM');
    reject(new Error('real audio soak timed out after 120 seconds'));
  }, 120_000);
  child.on('error', (error) => {
    globalThis.clearTimeout(timeout);
    reject(error);
  });
  child.on('exit', (code) => {
    globalThis.clearTimeout(timeout);
    resolve(code ?? 1);
  });
});
const match = output.match(/PHASE9_REAL_AUDIO_SOAK (\{.*\})/);
if (exitCode !== 0 || !match) {
  await cleanupTemporaryRoot();
  throw new Error(`real audio soak did not produce a result (exit ${exitCode})`);
}
const result = JSON.parse(match[1]);
const expectedMouths = ['aa', 'ih', 'ou', 'ee', 'oh'];
const allMouthsSeen = expectedMouths.every((mouth) => result.mouthsSeen.includes(mouth));
const accepted = result.played && result.finalState === 'stopped' && result.duration >= minimumDuration && result.frames >= Math.max(1, Math.floor(result.duration * 10)) && result.endDriftMs === 0 && result.cumulativeDriftMs === 0 && result.droppedFrameCount === 0 && allMouthsSeen;
await cleanupTemporaryRoot();
if (!accepted) {
  throw new Error(`real audio soak acceptance failed: ${JSON.stringify(result)}`);
}
process.stdout.write(JSON.stringify({ accepted: true, ...result }) + '\n');
