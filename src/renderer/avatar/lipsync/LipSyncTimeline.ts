import type { LipSyncKeyframe, LipSyncTimeline, MouthWeights, VrmMouth } from '../../../shared/lipsync';
import { createEmptyMouthWeights, VRM_MOUTH_EXPRESSIONS } from '../../../shared/lipsync';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function fullWeights(value: Partial<Record<VrmMouth, number>> | undefined): MouthWeights {
  const weights = createEmptyMouthWeights();
  for (const mouth of VRM_MOUTH_EXPRESSIONS) {
    const candidate = value?.[mouth] ?? 0;
    if (!finite(candidate) || candidate < 0 || candidate > 1) {
      throw new Error(`Invalid lip-sync weight for ${mouth}.`);
    }
    weights[mouth] = candidate;
  }
  return weights;
}

function normalizeKeyframe(value: unknown, index: number): LipSyncKeyframe {
  if (!isRecord(value) || !finite(value.time) || value.time < 0 || !isRecord(value.weights)) {
    throw new Error(`Invalid lip-sync keyframe at index ${index}.`);
  }
  const weights: Partial<Record<VrmMouth, number>> = {};
  for (const [name, candidate] of Object.entries(value.weights)) {
    if (!VRM_MOUTH_EXPRESSIONS.includes(name as VrmMouth) || !finite(candidate) || candidate < 0 || candidate > 1) {
      throw new Error(`Invalid lip-sync keyframe weight at index ${index}.`);
    }
    weights[name as VrmMouth] = candidate;
  }
  const sourcePhone = value.sourcePhone;
  if (sourcePhone !== undefined && (typeof sourcePhone !== 'string' || sourcePhone.length > 64)) {
    throw new Error(`Invalid source phone at keyframe ${index}.`);
  }
  return { time: value.time, weights, ...(sourcePhone === undefined ? {} : { sourcePhone }) };
}

export function parseLipSyncTimeline(value: unknown): LipSyncTimeline {
  if (!isRecord(value) || value.version !== 1 || typeof value.language !== 'string' || value.language.length === 0 ||
      typeof value.sourceAudio !== 'string' || value.sourceAudio.length === 0 || typeof value.aligner !== 'string' ||
      value.aligner.length === 0 || !finite(value.duration) || value.duration <= 0 ||
      !finite(value.audioDuration) || value.audioDuration <= 0 || !finite(value.interpolationMs) ||
      value.interpolationMs < 0 || value.interpolationMs > 1000 || !Array.isArray(value.keyframes) ||
      value.keyframes.length === 0 || value.keyframes.length > 100000) {
    throw new Error('Invalid LipSyncTimeline v1 metadata.');
  }
  const keyframes = value.keyframes.map(normalizeKeyframe);
  if (keyframes[0].time > value.duration) {
    throw new Error('Lip-sync keyframes must be inside the timeline duration.');
  }
  for (let index = 1; index < keyframes.length; index += 1) {
    if (keyframes[index].time < keyframes[index - 1].time || keyframes[index].time > value.duration) {
      throw new Error('Lip-sync keyframes must be sorted and inside the timeline duration.');
    }
  }
  return {
    version: 1,
    ...(typeof value.testId === 'string' && value.testId.length > 0 ? { testId: value.testId } : {}),
    language: value.language,
    sourceAudio: value.sourceAudio,
    aligner: value.aligner,
    ...(typeof value.alignerVersion === 'string' ? { alignerVersion: value.alignerVersion } : {}),
    ...(typeof value.acousticModel === 'string' ? { acousticModel: value.acousticModel } : {}),
    ...(typeof value.dictionaryModel === 'string' ? { dictionaryModel: value.dictionaryModel } : {}),
    ...(typeof value.g2pModel === 'string' ? { g2pModel: value.g2pModel } : {}),
    duration: value.duration,
    audioDuration: value.audioDuration,
    interpolationMs: value.interpolationMs,
    keyframes,
  };
}

function lerpWeights(left: MouthWeights, right: MouthWeights, amount: number): MouthWeights {
  const result = createEmptyMouthWeights();
  const clamped = Math.min(1, Math.max(0, amount));
  for (const mouth of VRM_MOUTH_EXPRESSIONS) {
    result[mouth] = left[mouth] + (right[mouth] - left[mouth]) * clamped;
  }
  return result;
}

export function keyframeIndexAtTime(timeline: LipSyncTimeline, time: number): number {
  const clampedTime = Math.max(0, Math.min(timeline.duration, time));
  let index = 0;
  for (let candidate = 1; candidate < timeline.keyframes.length; candidate += 1) {
    if (timeline.keyframes[candidate].time > clampedTime) {
      break;
    }
    index = candidate;
  }
  return index;
}

export function sourcePhoneAtTime(timeline: LipSyncTimeline, time: number): string | null {
  return timeline.keyframes[keyframeIndexAtTime(timeline, time)]?.sourcePhone ?? null;
}

export function sampleLipSyncTimeline(timeline: LipSyncTimeline, time: number, interpolationMs = timeline.interpolationMs): MouthWeights {
  if (time >= timeline.duration) {
    return createEmptyMouthWeights();
  }
  const clampedTime = Math.max(0, time);
  const first = timeline.keyframes[0];
  if (clampedTime < first.time) {
    return fullWeights(first.weights);
  }

  let rightIndex = timeline.keyframes.findIndex((keyframe) => keyframe.time >= clampedTime);
  if (rightIndex === -1) {
    rightIndex = timeline.keyframes.length - 1;
  }
  if (rightIndex === 0) {
    return fullWeights(timeline.keyframes[0].weights);
  }

  const right = timeline.keyframes[rightIndex];
  const left = timeline.keyframes[rightIndex - 1];
  const leftWeights = fullWeights(left.weights);
  const rightWeights = fullWeights(right.weights);
  const window = Math.max(0, interpolationMs) / 1000;
  if (window === 0 || right.time === left.time) {
    return right.time === clampedTime ? rightWeights : leftWeights;
  }

  const halfWindow = window / 2;
  const start = right.time - halfWindow;
  const end = right.time + halfWindow;
  if (clampedTime < start) {
    return leftWeights;
  }
  if (clampedTime > end) {
    return rightWeights;
  }
  return lerpWeights(leftWeights, rightWeights, (clampedTime - start) / window);
}

export function dominantMouthForWeights(weights: MouthWeights): VrmMouth | null {
  let dominant: VrmMouth | null = null;
  let maximum = 0;
  for (const mouth of VRM_MOUTH_EXPRESSIONS) {
    if (weights[mouth] > maximum) {
      dominant = mouth;
      maximum = weights[mouth];
    }
  }
  return dominant;
}

export { createEmptyMouthWeights };
