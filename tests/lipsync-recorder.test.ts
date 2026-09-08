import { describe, expect, it } from 'vitest';
import { LipSyncDebugRecorder } from '../src/renderer/avatar/lipsync/LipSyncDebugRecorder';

describe('LipSyncDebugRecorder', () => {
  it('summarizes cue latency, drift, invalid weights, and stuck-mouth events', () => {
    const recorder = new LipSyncDebugRecorder(1, 1);
    recorder.start(0);
    recorder.recordFrame({ audioTime: 0, keyframeIndex: 0, cueTime: 0, mouthOpen: false, weightsValid: true, dominantMouth: null });
    recorder.recordFrame({ audioTime: 0.2, keyframeIndex: 1, cueTime: 0.18, mouthOpen: true, weightsValid: true, dominantMouth: 'aa' });
    recorder.recordFrame({ audioTime: 0.4, keyframeIndex: 1, cueTime: 0.18, mouthOpen: true, weightsValid: false, dominantMouth: 'aa' });
    recorder.recordFrame({ audioTime: 0.6, keyframeIndex: 1, cueTime: 0.18, mouthOpen: true, weightsValid: true, dominantMouth: 'aa' });
    recorder.recordFrame({ audioTime: 0.8, keyframeIndex: 2, cueTime: 0.75, mouthOpen: false, weightsValid: true });
    recorder.finish(1.01, 1);
    const summary = recorder.summary;

    expect(summary.frameCount).toBe(5);
    expect(summary.invalidWeightCount).toBe(1);
    expect(summary.mouthStuckEventCount).toBe(1);
    expect(summary.cueLatencyP50Ms).toBe(20);
    expect(summary.cueLatencyMaxMs).toBe(50);
    expect(summary.endDriftMs).toBe(10);
    expect(summary.cumulativeDriftMs).toBe(10);
    expect(summary.mouthDistribution).toEqual({ aa: 3, ih: 0, ou: 0, ee: 0, oh: 0 });
  });
});
