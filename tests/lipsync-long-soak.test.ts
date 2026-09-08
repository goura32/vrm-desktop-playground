import { describe, expect, it } from 'vitest';
import { LipSyncController } from '../src/renderer/avatar/lipsync/LipSyncController';
import { createEmptyMouthWeights, VRM_MOUTH_EXPRESSIONS } from '../src/shared/lipsync';
import type { MouthWeights } from '../src/shared/lipsync';

class LongSoakClock {
  public currentTime = 0;
  public duration = 37.04;
  public state: 'stopped' | 'playing' | 'paused' = 'stopped';

  public play(): boolean {
    this.state = 'playing';
    return true;
  }

  public pause(): boolean {
    this.state = 'paused';
    return true;
  }

  public stop(): boolean {
    this.state = 'stopped';
    this.currentTime = 0;
    return true;
  }
}

function mouthWeights(index: number): MouthWeights {
  const weights = createEmptyMouthWeights();
  weights[VRM_MOUTH_EXPRESSIONS[index % VRM_MOUTH_EXPRESSIONS.length]] = 0.9;
  return weights;
}

describe('LipSyncController LONG01 soak', () => {
  it('keeps a 37-second audio-clock session bounded and returns to silence', () => {
    const clock = new LongSoakClock();
    const applied: MouthWeights[] = [];
    const controller = new LipSyncController({
      clock,
      applyMouthWeights: (weights) => {
        applied.push({ ...weights });
        return 0;
      },
    });
    const keyframes = [];
    for (let index = 0; index < 93; index += 1) {
      const start = index * 0.4;
      keyframes.push({ time: start, weights: mouthWeights(index), sourcePhone: `vowel-${index}` });
      keyframes.push({ time: start + 0.2, weights: {}, sourcePhone: 'sil' });
    }
    keyframes.push({ time: 37.04, weights: {}, sourcePhone: 'sil' });

    controller.setTimeline({
      version: 1,
      testId: 'LONG01',
      language: 'Japanese',
      sourceAudio: 'LONG01.wav',
      aligner: 'MFA',
      duration: 37.04,
      audioDuration: 37.04,
      interpolationMs: 70,
      keyframes,
    });
    controller.setAudioDuration(37.04);
    expect(controller.play()).toBe(true);

    for (let frame = 0; frame <= Math.ceil(37.04 * 60); frame += 1) {
      clock.currentTime = Math.min(37.04, frame / 60);
      controller.update();
    }

    expect(controller.status.state).toBe('stopped');
    expect(applied.at(-1)).toEqual(createEmptyMouthWeights());
    expect(controller.status.validation.frameCount).toBeGreaterThan(2000);
    expect(controller.status.validation.invalidWeightCount).toBe(0);
    expect(controller.status.validation.mouthStuckEventCount).toBe(0);
    expect(controller.status.validation.endDriftMs).toBe(0);
    expect(controller.status.validation.displayRefreshEstimateHz).toBe(60);
    expect(Object.values(controller.status.validation.mouthDistribution).every((count) => count > 0)).toBe(true);
    expect(Math.abs(controller.status.validation.cumulativeDriftMs)).toBeLessThanOrEqual(1);
  });
});
