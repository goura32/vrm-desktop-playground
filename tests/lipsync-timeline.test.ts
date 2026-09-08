import { describe, expect, it } from 'vitest';
import {
  createEmptyMouthWeights,
  dominantMouthForWeights,
  parseLipSyncTimeline,
  sampleLipSyncTimeline,
} from '../src/renderer/avatar/lipsync/LipSyncTimeline';

describe('LipSyncTimeline', () => {
  const timeline = parseLipSyncTimeline({
    version: 1,
    testId: 'UNIT',
    language: 'English',
    sourceAudio: 'UNIT.wav',
    aligner: 'MFA',
    duration: 1,
    audioDuration: 1,
    interpolationMs: 70,
    keyframes: [
      { time: 0, weights: { aa: 1 }, sourcePhone: 'a' },
      { time: 0.5, weights: {}, sourcePhone: 'sil' },
      { time: 1, weights: {}, sourcePhone: 'sil' },
    ],
  });

  it('returns all-zero weights for silence and clamps invalid values', () => {
    expect(sampleLipSyncTimeline(timeline, 0.75, 0)).toEqual(createEmptyMouthWeights());
    expect(sampleLipSyncTimeline(timeline, -1, 0)).toEqual({ aa: 1, ih: 0, ou: 0, ee: 0, oh: 0 });
  });

  it('uses only bounded five-mouth weights and exposes the dominant mouth', () => {
    const weights = sampleLipSyncTimeline(timeline, 0.1, 0);
    expect(Object.keys(weights)).toEqual(['aa', 'ih', 'ou', 'ee', 'oh']);
    expect(Object.values(weights).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(dominantMouthForWeights(weights)).toBe('aa');
    expect(dominantMouthForWeights(createEmptyMouthWeights())).toBeNull();
  });

  it('smooths a cue boundary only within the requested interpolation window', () => {
    const noSmoothing = sampleLipSyncTimeline(timeline, 0.5, 0);
    const smoothing = sampleLipSyncTimeline(timeline, 0.5, 100);
    expect(noSmoothing).toEqual(createEmptyMouthWeights());
    expect(smoothing.aa).toBeGreaterThan(0);
    expect(smoothing.aa).toBeLessThan(1);
  });

  it('rejects control characters and oversized metadata before loading', () => {
    expect(() => parseLipSyncTimeline({ ...timeline, language: 'English\nInjected' })).toThrow();
    expect(() => parseLipSyncTimeline({ ...timeline, testId: 'x'.repeat(129) })).toThrow();
    expect(() => parseLipSyncTimeline({ ...timeline, aligner: 'x'.repeat(129) })).toThrow();
    expect(() => parseLipSyncTimeline({ ...timeline, keyframes: [{ time: 0, weights: {}, sourcePhone: '\u0000' }] })).toThrow();
  });

  it('rejects a timeline that is not version 1 or has out-of-range weights', () => {
    expect(() => parseLipSyncTimeline({ ...timeline, version: 2 })).toThrow();
    expect(() => parseLipSyncTimeline({ ...timeline, keyframes: [{ time: 0, weights: { aa: 2 } }] })).toThrow();
  });
});
