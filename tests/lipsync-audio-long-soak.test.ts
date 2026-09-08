import { describe, expect, it, afterEach } from 'vitest';
import { AudioClock } from '../src/renderer/avatar/lipsync/AudioClock';
import { LipSyncController } from '../src/renderer/avatar/lipsync/LipSyncController';
import { createEmptyMouthWeights, type LipSyncTimeline, VRM_MOUTH_EXPRESSIONS } from '../src/shared/lipsync';

class SoakSource {
  public buffer: { duration: number } | null = null;
  public onended: (() => void) | null = null;

  public connect(): void {
    // The production clock only needs the source to expose connect/start/stop.
  }

  public start(): void {
    // Time is advanced by the fake context below, not by a wall-clock timer.
  }

  public stop(): void {
    this.onended?.();
  }
}

class SoakAudioContext {
  public static instances: SoakAudioContext[] = [];
  public currentTime = 0;
  public readonly destination = {};
  public state = 'running';

  public constructor() {
    SoakAudioContext.instances.push(this);
  }

  public async decodeAudioData(): Promise<{ duration: number }> {
    return { duration: 37.04 };
  }

  public createBufferSource(): SoakSource {
    return new SoakSource();
  }

  public async resume(): Promise<void> {
    this.state = 'running';
  }

  public async close(): Promise<void> {
    this.state = 'closed';
  }
}

const originalAudioContext = globalThis.AudioContext;

afterEach(() => {
  globalThis.AudioContext = originalAudioContext;
  SoakAudioContext.instances.length = 0;
});

describe('AudioClock-backed long soak', () => {
  it('keeps a 37.04 second session at zero drift over simulated 60 Hz frames', async () => {
    globalThis.AudioContext = SoakAudioContext as unknown as typeof AudioContext;
    const clock = new AudioClock();
    const controller = new LipSyncController({ clock, applyMouthWeights: () => 0 });
    const keyframes: LipSyncTimeline['keyframes'] = [];

    for (let index = 0; index < 93; index += 1) {
      const time = index * 0.4;
      const mouth = VRM_MOUTH_EXPRESSIONS[index % VRM_MOUTH_EXPRESSIONS.length];
      keyframes.push({ time, weights: { ...createEmptyMouthWeights(), [mouth]: 1 }, sourcePhone: mouth });
      keyframes.push({ time: time + 0.2, weights: createEmptyMouthWeights(), sourcePhone: 'sil' });
    }
    keyframes.push({ time: 37.04, weights: createEmptyMouthWeights(), sourcePhone: 'sil' });

    controller.setTimeline({ version: 1, testId: 'AUDIO-LONG01', language: 'Japanese', sourceAudio: 'LONG01.wav', aligner: 'MFA', duration: 37.04, audioDuration: 37.04, interpolationMs: 70, keyframes });
    await clock.load(new ArrayBuffer(1));
    controller.setAudioDuration(clock.duration);
    expect(controller.play()).toBe(true);

    const context = SoakAudioContext.instances[0];
    for (let frame = 0; frame <= Math.ceil(37.04 * 60); frame += 1) {
      context.currentTime = frame / 60;
      controller.update();
    }

    expect(controller.status.state).toBe('stopped');
    expect(controller.status.validation.endDriftMs).toBe(0);
    expect(controller.status.validation.displayRefreshEstimateHz).toBe(60);
    expect(controller.status.validation.droppedFrameCount).toBe(0);
    expect(controller.status.validation.mouthDistribution.aa).toBeGreaterThan(0);
    expect(controller.status.validation.mouthDistribution.oh).toBeGreaterThan(0);
    expect(clock.state).toBe('stopped');
    await clock.dispose();
  });
});
