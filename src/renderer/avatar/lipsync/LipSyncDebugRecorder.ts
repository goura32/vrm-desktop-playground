import type { LipSyncValidationSummary, VrmMouth } from '../../../shared/lipsync';
import { createInitialLipSyncValidation } from '../../../shared/lipsync';

export interface LipSyncFrameSample {
  audioTime: number;
  keyframeIndex: number;
  cueTime: number;
  mouthOpen: boolean;
  weightsValid: boolean;
  dominantMouth?: VrmMouth | null;
}

function percentileNearestRank(values: number[], percentile: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));
  return Math.round(sorted[index] * 1000) / 1000;
}

export class LipSyncDebugRecorder {
  private readonly initial = createInitialLipSyncValidation();
  private readonly cueLatencies: number[] = [];
  private readonly frameIntervals: number[] = [];
  private summaryState: LipSyncValidationSummary = { ...this.initial };
  private firstAudioTime: number | null = null;
  private lastAudioTime: number | null = null;
  private lastKeyframeIndex: number | null = null;
  private mouthOpenStartedAt: number | null = null;
  private mouthStuckReported = false;
  private lastFrameTime: number | null = null;
  private timelineDuration: number;
  private audioDuration: number;

  public constructor(timelineDuration: number, audioDuration: number) {
    this.timelineDuration = timelineDuration;
    this.audioDuration = audioDuration;
  }

  public start(audioTime: number): void {
    this.summaryState = { ...this.initial };
    this.cueLatencies.length = 0;
    this.frameIntervals.length = 0;
    this.firstAudioTime = audioTime;
    this.lastAudioTime = audioTime;
    this.lastKeyframeIndex = null;
    this.mouthOpenStartedAt = null;
    this.mouthStuckReported = false;
    this.lastFrameTime = null;
  }

  public recordFrame(sample: LipSyncFrameSample): void {
    if (this.firstAudioTime === null) {
      this.start(sample.audioTime);
    }
    if (this.lastFrameTime !== null) {
      const interval = sample.audioTime - this.lastFrameTime;
      if (interval > 0) {
        if (interval > 0.05) {
          this.summaryState.droppedFrameCount += 1;
        }
        if (interval > 0.025) {
          this.summaryState.lateFrameCount += 1;
        }
        if (interval <= 0.1 && this.frameIntervals.length < 10000) {
          this.frameIntervals.push(interval);
        }
      }
    }
    this.lastFrameTime = sample.audioTime;
    this.lastAudioTime = sample.audioTime;
    this.summaryState.frameCount += 1;
    if (!sample.weightsValid) {
      this.summaryState.invalidWeightCount += 1;
    }
    if (sample.dominantMouth) {
      this.summaryState.mouthDistribution[sample.dominantMouth] += 1;
    }
    if (this.lastKeyframeIndex !== sample.keyframeIndex) {
      this.cueLatencies.push(Math.max(0, sample.audioTime - sample.cueTime) * 1000);
      this.summaryState.cueCount += 1;
      this.lastKeyframeIndex = sample.keyframeIndex;
      this.mouthOpenStartedAt = sample.mouthOpen ? sample.audioTime : null;
      this.mouthStuckReported = false;
    } else if (sample.mouthOpen) {
      if (this.mouthOpenStartedAt === null) {
        this.mouthOpenStartedAt = sample.audioTime;
      }
      if (!this.mouthStuckReported && sample.audioTime - this.mouthOpenStartedAt > 0.25) {
        this.summaryState.mouthStuckEventCount += 1;
        this.mouthStuckReported = true;
      }
    } else {
      this.mouthOpenStartedAt = null;
      this.mouthStuckReported = false;
    }
  }

  public addMissingExpressions(count: number): void {
    this.summaryState.missingExpressionCount = Math.max(this.summaryState.missingExpressionCount, Math.max(0, Math.round(count)));
  }

  public finish(audioTime: number, timelineDuration = this.timelineDuration): void {
    this.lastAudioTime = audioTime;
    const start = this.firstAudioTime ?? 0;
    const endDriftMs = Math.round((audioTime - timelineDuration) * 1000 * 1000) / 1000;
    this.summaryState.startOffsetMs = start * 1000;
    this.summaryState.endDriftMs = endDriftMs;
    this.summaryState.cumulativeDriftMs = Math.round((endDriftMs - start * 1000) * 1000) / 1000;
    this.summaryState.durationDeltaMs = (this.audioDuration - timelineDuration) * 1000;
    this.summaryState.cueLatencyP50Ms = percentileNearestRank(this.cueLatencies, 0.5);
    this.summaryState.cueLatencyP95Ms = percentileNearestRank(this.cueLatencies, 0.95);
    this.summaryState.cueLatencyMaxMs = this.cueLatencies.length === 0 ? null : Math.round(Math.max(...this.cueLatencies) * 1000) / 1000;
    const sortedFrameIntervals = [...this.frameIntervals].sort((left, right) => left - right);
    const medianFrameInterval = sortedFrameIntervals.length === 0
      ? null
      : sortedFrameIntervals[Math.min(sortedFrameIntervals.length - 1, Math.ceil(sortedFrameIntervals.length * 0.5) - 1)];
    this.summaryState.displayRefreshEstimateHz = medianFrameInterval && medianFrameInterval > 0
      ? Math.round((1 / medianFrameInterval) * 10) / 10
      : null;
  }

  public get summary(): LipSyncValidationSummary {
    return { ...this.summaryState, mouthDistribution: { ...this.summaryState.mouthDistribution } };
  }
}
