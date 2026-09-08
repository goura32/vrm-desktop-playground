export const VRM_MOUTH_EXPRESSIONS = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;

export type VrmMouth = (typeof VRM_MOUTH_EXPRESSIONS)[number];
export type MouthWeights = Record<VrmMouth, number>;

export type LipSyncState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'stopped' | 'error';

export interface LipSyncKeyframe {
  time: number;
  weights: Partial<Record<VrmMouth, number>>;
  sourcePhone?: string;
}

export interface LipSyncTimeline {
  version: 1;
  testId?: string;
  language: string;
  sourceAudio: string;
  aligner: string;
  alignerVersion?: string;
  acousticModel?: string;
  dictionaryModel?: string;
  g2pModel?: string;
  duration: number;
  audioDuration: number;
  interpolationMs: number;
  keyframes: LipSyncKeyframe[];
}

export interface LipSyncValidationSummary {
  frameCount: number;
  cueCount: number;
  droppedFrameCount: number;
  invalidWeightCount: number;
  mouthStuckEventCount: number;
  missingExpressionCount: number;
  cueLatencyP50Ms: number | null;
  cueLatencyP95Ms: number | null;
  cueLatencyMaxMs: number | null;
  startOffsetMs: number | null;
  endDriftMs: number | null;
  cumulativeDriftMs: number;
  durationDeltaMs: number | null;
  displayRefreshEstimateHz: number | null;
  lateFrameCount: number;
  mouthDistribution: Record<VrmMouth, number>;
}

export interface LipSyncStatus {
  state: LipSyncState;
  message: string;
  currentTime: number;
  audioDuration: number | null;
  timelineDuration: number | null;
  testId: string | null;
  language: string | null;
  sourcePhone: string | null;
  dominantMouth: VrmMouth | null;
  weights: MouthWeights;
  interpolationMs: number;
  aligner: string | null;
  alignerVersion: string | null;
  validation: LipSyncValidationSummary;
}

export function createEmptyMouthWeights(): MouthWeights {
  return { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
}

export function createInitialLipSyncValidation(): LipSyncValidationSummary {
  return {
    frameCount: 0,
    cueCount: 0,
    droppedFrameCount: 0,
    invalidWeightCount: 0,
    mouthStuckEventCount: 0,
    missingExpressionCount: 0,
    cueLatencyP50Ms: null,
    cueLatencyP95Ms: null,
    cueLatencyMaxMs: null,
    startOffsetMs: null,
    endDriftMs: null,
    cumulativeDriftMs: 0,
    durationDeltaMs: null,
    displayRefreshEstimateHz: null,
    lateFrameCount: 0,
    mouthDistribution: createEmptyMouthWeights(),
  };
}

export function createInitialLipSyncStatus(): LipSyncStatus {
  return {
    state: 'idle',
    message: 'Lip sync is idle. Load a WAV and a LipSyncTimeline JSON.',
    currentTime: 0,
    audioDuration: null,
    timelineDuration: null,
    testId: null,
    language: null,
    sourcePhone: null,
    dominantMouth: null,
    weights: createEmptyMouthWeights(),
    interpolationMs: 70,
    aligner: null,
    alignerVersion: null,
    validation: createInitialLipSyncValidation(),
  };
}
