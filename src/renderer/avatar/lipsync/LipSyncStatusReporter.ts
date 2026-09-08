import type { LipSyncStatus } from '../../../shared/lipsync';

export interface LipSyncReportGate {
  lastReportedTimeMs: number;
  lastCueKey: string;
}

export function createLipSyncReportGate(): LipSyncReportGate {
  return { lastReportedTimeMs: Number.NEGATIVE_INFINITY, lastCueKey: '' };
}

export function shouldReportLipSyncStatus(status: LipSyncStatus, gate: LipSyncReportGate, minimumIntervalMs = 50): boolean {
  const cueKey = `${status.state}|${status.testId ?? ''}|${status.sourcePhone ?? ''}|${status.dominantMouth ?? ''}`;
  const currentTimeMs = status.currentTime * 1000;
  const isTerminalOrTransition = status.state !== 'playing';
  const cueChanged = cueKey !== gate.lastCueKey;
  const cadenceReached = currentTimeMs < gate.lastReportedTimeMs || currentTimeMs - gate.lastReportedTimeMs >= minimumIntervalMs;
  if (!isTerminalOrTransition && !cueChanged && !cadenceReached) {
    return false;
  }
  gate.lastReportedTimeMs = currentTimeMs;
  gate.lastCueKey = cueKey;
  return true;
}
