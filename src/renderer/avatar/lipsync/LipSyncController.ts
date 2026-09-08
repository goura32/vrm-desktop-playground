import type { LipSyncStatus, LipSyncTimeline, MouthWeights } from '../../../shared/lipsync';
import { createEmptyMouthWeights, createInitialLipSyncStatus } from '../../../shared/lipsync';
import type { AudioClockLike } from './AudioClock';
import { LipSyncDebugRecorder } from './LipSyncDebugRecorder';
import {
  dominantMouthForWeights,
  keyframeIndexAtTime,
  parseLipSyncTimeline,
  sampleLipSyncTimeline,
  sourcePhoneAtTime,
} from './LipSyncTimeline';

interface LipSyncControllerOptions {
  clock: AudioClockLike;
  applyMouthWeights: (weights: MouthWeights) => number;
  onStatus?: (status: LipSyncStatus) => void;
}

export class LipSyncController {
  private readonly clock: AudioClockLike;
  private readonly applyMouthWeights: (weights: MouthWeights) => number;
  private readonly onStatus?: (status: LipSyncStatus) => void;
  private timeline: LipSyncTimeline | null = null;
  private audioDuration = 0;
  private interpolationMs = 70;
  private recorder: LipSyncDebugRecorder | null = null;
  private currentSessionId = 0;
  private currentStatus: LipSyncStatus = createInitialLipSyncStatus();

  public constructor(options: LipSyncControllerOptions) {
    this.clock = options.clock;
    this.applyMouthWeights = options.applyMouthWeights;
    this.onStatus = options.onStatus;
  }

  public get status(): LipSyncStatus {
    return this.currentStatus;
  }

  public get sessionId(): number {
    return this.currentSessionId;
  }

  public setTimeline(input: LipSyncTimeline | unknown): boolean {
    if (this.currentStatus.state === 'playing' || this.currentStatus.state === 'paused' || this.clock.state !== 'stopped') {
      this.stop();
    }
    try {
      this.timeline = parseLipSyncTimeline(input);
      this.interpolationMs = this.timeline.interpolationMs;
      this.publish({
        state: this.audioDuration > 0 ? 'ready' : 'idle',
        message: this.audioDuration > 0 ? `Timeline ready: ${this.timeline.testId ?? this.timeline.sourceAudio}.` : 'Timeline loaded; load its audio before playback.',
        timelineDuration: this.timeline.duration,
        testId: this.timeline.testId ?? null,
        language: this.timeline.language,
        aligner: this.timeline.aligner,
        alignerVersion: this.timeline.alignerVersion ?? null,
        interpolationMs: this.interpolationMs,
        validation: { ...this.currentStatus.validation, durationDeltaMs: this.audioDuration > 0 ? (this.audioDuration - this.timeline.duration) * 1000 : null },
      });
      return true;
    } catch (error) {
      this.timeline = null;
      this.publish({ state: 'error', message: `Timeline load failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  }

  public clearAudioDuration(): void {
    this.audioDuration = 0;
    this.currentStatus = {
      ...this.currentStatus,
      audioDuration: 0,
      validation: { ...this.currentStatus.validation, durationDeltaMs: null },
    };
  }

  public setAudioDuration(duration: number): void {
    if (!Number.isFinite(duration) || duration <= 0) {
      this.clearAudioDuration();
      this.publish({ state: 'error', message: 'Decoded audio has no positive duration.' });
      return;
    }
    this.audioDuration = duration;
    this.publish({
      state: this.timeline ? 'ready' : 'idle',
      message: this.timeline ? 'Audio and timeline are ready.' : 'Audio loaded; load a LipSyncTimeline JSON.',
      audioDuration: duration,
      validation: { ...this.currentStatus.validation, durationDeltaMs: this.timeline ? (duration - this.timeline.duration) * 1000 : null },
    });
  }

  public setInterpolation(milliseconds: number): void {
    if (!Number.isFinite(milliseconds)) {
      return;
    }
    this.interpolationMs = Math.min(1000, Math.max(0, milliseconds));
    this.publish({ interpolationMs: this.interpolationMs, message: `Lip-sync interpolation set to ${this.interpolationMs} ms.` });
  }

  public play(): boolean {
    if (!this.timeline || this.audioDuration <= 0 || !this.clock.play()) {
      this.publish({ state: 'error', message: 'Load a valid audio file and LipSyncTimeline before playing.' });
      return false;
    }
    this.currentSessionId += 1;
    this.recorder = new LipSyncDebugRecorder(this.timeline.duration, this.audioDuration);
    this.recorder.start(this.clock.currentTime);
    this.publish({ state: 'playing', message: `Lip sync playing: ${this.timeline.testId ?? this.timeline.sourceAudio}.`, currentTime: this.clock.currentTime, validation: this.recorder.summary });
    return true;
  }

  public pause(): boolean {
    if (this.currentStatus.state !== 'playing' || !this.clock.pause()) {
      return false;
    }
    this.publish({ state: 'paused', currentTime: this.clock.currentTime, message: 'Lip sync paused.' });
    return true;
  }

  public resume(): boolean {
    if (this.currentStatus.state !== 'paused' || !this.clock.play()) {
      return false;
    }
    this.publish({ state: 'playing', currentTime: this.clock.currentTime, message: 'Lip sync resumed.' });
    return true;
  }

  public stop(): boolean {
    const endTime = this.clock.currentTime;
    const hadPlayback = this.clock.stop() || this.currentStatus.state === 'playing' || this.currentStatus.state === 'paused';
    this.currentSessionId += 1;
    this.applyMouthWeights(createEmptyMouthWeights());
    const shouldFinishRecorder = this.recorder !== null && this.timeline !== null && (this.currentStatus.state === 'playing' || this.currentStatus.state === 'paused');
    if (shouldFinishRecorder && this.recorder && this.timeline) {
      this.recorder.finish(endTime, this.timeline.duration);
    }
    this.publish({
      state: 'stopped',
      currentTime: 0,
      sourcePhone: null,
      dominantMouth: null,
      weights: createEmptyMouthWeights(),
      message: 'Lip sync stopped; mouth expressions reset.',
      validation: this.recorder?.summary ?? this.currentStatus.validation,
    });
    return hadPlayback;
  }

  public handleClockEnded(sessionId: number): void {
    if (sessionId !== this.currentSessionId || (this.currentStatus.state !== 'playing' && this.currentStatus.state !== 'paused')) {
      return;
    }
    const endTime = this.timeline?.duration ?? this.clock.currentTime;
    if (this.recorder) {
      this.recorder.finish(endTime, this.timeline?.duration ?? endTime);
    }
    this.applyMouthWeights(createEmptyMouthWeights());
    this.publish({ state: 'stopped', currentTime: endTime, sourcePhone: null, dominantMouth: null, weights: createEmptyMouthWeights(), message: 'Audio ended; mouth expressions reset.', validation: this.recorder?.summary ?? this.currentStatus.validation });
  }

  public update(): void {
    if (this.currentStatus.state !== 'playing' || !this.timeline) {
      return;
    }
    const currentTime = this.clock.currentTime;
    if (currentTime >= this.timeline.duration || (this.audioDuration > 0 && currentTime >= this.audioDuration)) {
      const endTime = currentTime;
      this.clock.stop();
      this.recorder?.finish(endTime, this.timeline.duration);
      this.applyMouthWeights(createEmptyMouthWeights());
      this.publish({ state: 'stopped', currentTime: endTime, sourcePhone: null, dominantMouth: null, weights: createEmptyMouthWeights(), message: 'Audio ended; mouth expressions reset.', validation: this.recorder?.summary ?? this.currentStatus.validation });
      return;
    }

    const weights = sampleLipSyncTimeline(this.timeline, currentTime, this.interpolationMs);
    const dominantMouth = dominantMouthForWeights(weights);
    const missingExpressions = this.applyMouthWeights(weights);
    this.recorder?.addMissingExpressions(missingExpressions);
    const weightsValid = Object.values(weights).every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 1);
    const keyframeIndex = keyframeIndexAtTime(this.timeline, currentTime);
    const cueTime = this.timeline.keyframes[keyframeIndex]?.time ?? currentTime;
    this.recorder?.recordFrame({ audioTime: currentTime, keyframeIndex, cueTime, mouthOpen: Object.values(weights).some((weight) => weight > 0.05), weightsValid, dominantMouth });
    this.publish({
      currentTime,
      sourcePhone: sourcePhoneAtTime(this.timeline, currentTime),
      dominantMouth,
      weights,
      validation: this.recorder?.summary ?? this.currentStatus.validation,
    });
  }

  public dispose(): void {
    this.stop();
  }

  private publish(patch: Partial<LipSyncStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...patch };
    this.onStatus?.(this.currentStatus);
  }
}
