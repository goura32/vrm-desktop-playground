import { describe, expect, it } from 'vitest';
import { LipSyncController } from '../src/renderer/avatar/lipsync/LipSyncController';
import { createEmptyMouthWeights } from '../src/renderer/avatar/lipsync/LipSyncTimeline';
import type { MouthWeights } from '../src/shared/lipsync';

class FakeClock {
  public currentTime = 0;
  public duration = 1;
  public state: 'stopped' | 'playing' | 'paused' = 'stopped';

  public play(): boolean { this.state = 'playing'; return true; }
  public pause(): boolean { this.state = 'paused'; return true; }
  public stop(): boolean { this.state = 'stopped'; this.currentTime = 0; return true; }
}

describe('LipSyncController', () => {
  it('drives five-mouth weights from the audio clock and clears them on stop', () => {
    const clock = new FakeClock();
    const applied: MouthWeights[] = [];
    const controller = new LipSyncController({
      clock,
      applyMouthWeights: (weights) => {
        applied.push(weights);
        return 0;
      },
    });
    controller.setTimeline({
      version: 1,
      testId: 'UNIT',
      language: 'Japanese',
      sourceAudio: 'UNIT.wav',
      aligner: 'MFA',
      duration: 1,
      audioDuration: 1,
      interpolationMs: 0,
      keyframes: [
        { time: 0, weights: { aa: 1 }, sourcePhone: 'a' },
        { time: 1, weights: {}, sourcePhone: 'sil' },
      ],
    });
    controller.setAudioDuration(1);
    expect(controller.play()).toBe(true);
    clock.currentTime = 0.2;
    controller.update();
    expect(applied.at(-1)?.aa).toBe(1);
    expect(controller.status.state).toBe('playing');
    expect(controller.status.dominantMouth).toBe('aa');

    expect(controller.stop()).toBe(true);
    expect(applied.at(-1)).toEqual(createEmptyMouthWeights());
    expect(controller.status.state).toBe('stopped');
  });

  it('clears audio readiness when an audio replacement starts', () => {
    const clock = new FakeClock();
    const controller = new LipSyncController({ clock, applyMouthWeights: () => 0 });
    controller.setTimeline({ version: 1, language: 'English', sourceAudio: 'x.wav', aligner: 'MFA', duration: 1, audioDuration: 1, interpolationMs: 0, keyframes: [{ time: 0, weights: { aa: 1 } }] });
    controller.setAudioDuration(1);

    controller.clearAudioDuration();

    expect(controller.status.audioDuration).toBe(0);
    expect(controller.play()).toBe(false);
  });

  it('records the audio time before a manual stop resets the clock', () => {
    const clock = new FakeClock();
    const controller = new LipSyncController({ clock, applyMouthWeights: () => 0 });
    controller.setTimeline({ version: 1, language: 'English', sourceAudio: 'x.wav', aligner: 'MFA', duration: 1, audioDuration: 1, interpolationMs: 0, keyframes: [{ time: 0, weights: { aa: 1 } }] });
    controller.setAudioDuration(1);
    expect(controller.play()).toBe(true);
    clock.currentTime = 0.5;
    expect(controller.stop()).toBe(true);
    expect(controller.status.validation.endDriftMs).toBe(-500);
    expect(controller.status.validation.cumulativeDriftMs).toBe(-500);
  });

  it('stops the current audio session before replacing its timeline', () => {
    const clock = new FakeClock();
    const controller = new LipSyncController({ clock, applyMouthWeights: () => 0 });
    const timeline = { version: 1 as const, language: 'English', sourceAudio: 'x.wav', aligner: 'MFA', duration: 1, audioDuration: 1, interpolationMs: 0, keyframes: [{ time: 0, weights: { aa: 1 } }] };
    controller.setTimeline(timeline);
    controller.setAudioDuration(1);
    expect(controller.play()).toBe(true);
    expect(controller.setTimeline({ ...timeline, testId: 'replacement' })).toBe(true);
    expect(clock.state).toBe('stopped');
    expect(controller.status.state).toBe('ready');
  });

  it('keeps the final validation summary after natural end and supports replay', () => {
    const clock = new FakeClock();
    const controller = new LipSyncController({ clock, applyMouthWeights: () => 0 });
    controller.setTimeline({ version: 1, language: 'Chinese', sourceAudio: 'x.wav', aligner: 'MFA', duration: 1, audioDuration: 1, interpolationMs: 0, keyframes: [{ time: 0, weights: { ou: 1 } }, { time: 1, weights: {} }] });
    controller.setAudioDuration(1);
    expect(controller.play()).toBe(true);
    clock.currentTime = 1;
    controller.update();
    expect(controller.status.state).toBe('stopped');
    expect(controller.status.validation.endDriftMs).toBe(0);
    controller.stop();
    expect(controller.status.validation.endDriftMs).toBe(0);
    expect(controller.play()).toBe(true);
    expect(controller.status.state).toBe('playing');
  });

  it('ignores stale stop callbacks after a newer playback session starts', () => {
    const clock = new FakeClock();
    const controller = new LipSyncController({ clock, applyMouthWeights: () => 0 });
    controller.setTimeline({ version: 1, language: 'English', sourceAudio: 'x.wav', aligner: 'MFA', duration: 1, audioDuration: 1, interpolationMs: 0, keyframes: [{ time: 0, weights: { ih: 1 } }] });
    controller.setAudioDuration(1);
    expect(controller.play()).toBe(true);
    const firstSession = controller.sessionId;
    expect(controller.stop()).toBe(true);
    expect(controller.play()).toBe(true);
    expect(controller.sessionId).not.toBe(firstSession);
    controller.handleClockEnded(firstSession);
    expect(controller.status.state).toBe('playing');
  });
});
