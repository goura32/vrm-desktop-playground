import { describe, expect, it } from 'vitest';
import { createInitialLipSyncStatus } from '../src/shared/lipsync';
import { createLipSyncReportGate, shouldReportLipSyncStatus } from '../src/renderer/avatar/lipsync/LipSyncStatusReporter';

describe('lip-sync status reporting gate', () => {
  it('limits repeated playing updates to the configured cadence', () => {
    const gate = createLipSyncReportGate();
    const playing = { ...createInitialLipSyncStatus(), state: 'playing' as const, currentTime: 0 };
    expect(shouldReportLipSyncStatus(playing, gate)).toBe(true);
    expect(shouldReportLipSyncStatus({ ...playing, currentTime: 0.01 }, gate)).toBe(false);
    expect(shouldReportLipSyncStatus({ ...playing, currentTime: 0.05 }, gate)).toBe(true);
  });

  it('forwards cue changes and terminal states immediately', () => {
    const gate = createLipSyncReportGate();
    const playing = { ...createInitialLipSyncStatus(), state: 'playing' as const, currentTime: 0, sourcePhone: 'a' };
    expect(shouldReportLipSyncStatus(playing, gate)).toBe(true);
    expect(shouldReportLipSyncStatus({ ...playing, currentTime: 0.01, sourcePhone: 'i' }, gate)).toBe(true);
    expect(shouldReportLipSyncStatus({ ...playing, currentTime: 0.02, sourcePhone: 'i' }, gate)).toBe(false);
    expect(shouldReportLipSyncStatus({ ...playing, state: 'stopped' as const, currentTime: 0.02 }, gate)).toBe(true);
  });
});
