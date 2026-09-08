import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('lip-sync architecture', () => {
  it('keeps audio-clock playback separate from frame rendering and setTimeout chains', () => {
    const controller = readFileSync(new URL('../src/renderer/avatar/lipsync/LipSyncController.ts', import.meta.url), 'utf8');
    const clock = readFileSync(new URL('../src/renderer/avatar/lipsync/AudioClock.ts', import.meta.url), 'utf8');
    expect(controller).toContain('currentTime');
    expect(controller).not.toContain('setTimeout(');
    expect(clock).toContain('AudioContext');
    expect(clock).toContain('currentTime');
  });

  it('uses only the VRM 1.0 five-mouth preset names', () => {
    const mapper = readFileSync(new URL('../src/renderer/avatar/lipsync/PhoneToVrmMouthMapper.ts', import.meta.url), 'utf8');
    expect(mapper).toContain("'aa'");
    expect(mapper).toContain("'ih'");
    expect(mapper).toContain("'ou'");
    expect(mapper).toContain("'ee'");
    expect(mapper).toContain("'oh'");
    expect(mapper).not.toContain('viseme_');
  });
});
