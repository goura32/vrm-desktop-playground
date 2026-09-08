import type {
  AvatarCommand,
  AvatarStatus,
  CharacterPosition,
  ExpressionInfo,
  MotionInfo,
  VrmModelInfo,
} from './types';
import type { LipSyncStatus, VrmMouth } from './lipsync';
import { VRM_MOUTH_EXPRESSIONS } from './lipsync';
import { isFilePayload, isLikelyAssetName } from './fileValidation';

const CAPABILITY_NAMES = ['humanoid', 'presetExpressions', 'customExpressions', 'blink', 'lookAt', 'springBone', 'vrma'] as const;
const AVATAR_PHASES = ['idle', 'loading', 'ready', 'error'] as const;
const MOTION_PLAYBACKS = ['stopped', 'playing', 'paused'] as const;
const MOTION_MODES = ['idle', 'gesture', 'stopped'] as const;
const LIP_SYNC_STATES = ['idle', 'loading', 'ready', 'playing', 'paused', 'stopped', 'error'] as const;
const MOVE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) || codePoint === 0x2028 || codePoint === 0x2029;
  });
}

function isSafeString(value: unknown, maxLength: number, requireNonEmpty = false): value is string {
  return typeof value === 'string' && (!requireNonEmpty || value.length > 0) && value.length <= maxLength && !hasControlCharacters(value);
}

function isBoundedString(value: unknown, maxLength = 255): value is string {
  return isSafeString(value, maxLength, true);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isCharacterPosition(value: unknown): value is CharacterPosition {
  return isRecord(value) &&
    isFiniteNumber(value.x) && value.x >= 0 && value.x <= 1 &&
    isFiniteNumber(value.y) && value.y >= 0 && value.y <= 1;
}

function isExpressionInfo(value: unknown): value is ExpressionInfo {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isBoundedString(value.name) &&
    (value.kind === 'preset' || value.kind === 'custom') &&
    isFiniteNumber(value.value) &&
    value.value >= 0 &&
    value.value <= 1 &&
    isBoolean(value.supported)
  );
}

function isMotionInfo(value: unknown): value is MotionInfo {
  if (!isRecord(value)) {
    return false;
  }
  return isBoundedString(value.id) && isBoundedString(value.fileName) && isFiniteNumber(value.duration) && value.duration >= 0;
}

function isVrmModelInfo(value: unknown): value is VrmModelInfo {
  if (!isRecord(value) || !isBoundedString(value.fileName) || !isBoundedString(value.metaName)) {
    return false;
  }
  if (value.format !== 'VRM 1.0' && value.format !== 'VRM 0.x' && value.format !== 'unknown') {
    return false;
  }
  if (!Array.isArray(value.humanoidBones) || !value.humanoidBones.every((bone) => isBoundedString(bone))) {
    return false;
  }
  if (!Array.isArray(value.expressions) || !value.expressions.every((expression) => isExpressionInfo(expression))) {
    return false;
  }
  const capabilities = value.capabilities;
  if (!isRecord(capabilities)) {
    return false;
  }
  return CAPABILITY_NAMES.every((name) => capabilities[name] === 'available' || capabilities[name] === 'unsupported') &&
    (value.mouthOverride === 'none' || value.mouthOverride === 'blend' || value.mouthOverride === 'block' || value.mouthOverride === 'unknown');
}

function isLipSyncWeights(value: unknown): value is Record<VrmMouth, number> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.keys(value).length === VRM_MOUTH_EXPRESSIONS.length &&
    VRM_MOUTH_EXPRESSIONS.every((mouth) => isFiniteNumber(value[mouth]) && value[mouth] >= 0 && value[mouth] <= 1);
}

function isMouthDistribution(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return Object.keys(value).length === VRM_MOUTH_EXPRESSIONS.length &&
    VRM_MOUTH_EXPRESSIONS.every((mouth) => isFiniteNumber(value[mouth]) && value[mouth] >= 0);
}

function isLipSyncValidation(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const requiredNumbers = ['frameCount', 'cueCount', 'droppedFrameCount', 'invalidWeightCount', 'mouthStuckEventCount', 'missingExpressionCount'];
  if (!requiredNumbers.every((name) => isFiniteNumber(value[name]) && value[name] >= 0)) {
    return false;
  }
  if (!isFiniteNumber(value.cumulativeDriftMs) || !isFiniteNumber(value.lateFrameCount) || value.lateFrameCount < 0) {
    return false;
  }
  const nullableNonNegativeNumbers = ['cueLatencyP50Ms', 'cueLatencyP95Ms', 'cueLatencyMaxMs', 'startOffsetMs'];
  if (!nullableNonNegativeNumbers.every((name) => value[name] === null || (isFiniteNumber(value[name]) && value[name] >= 0))) {
    return false;
  }
  return ['endDriftMs', 'durationDeltaMs'].every((name) => value[name] === null || isFiniteNumber(value[name])) &&
    (value.displayRefreshEstimateHz === null || (isFiniteNumber(value.displayRefreshEstimateHz) && value.displayRefreshEstimateHz > 0)) &&
    isMouthDistribution(value.mouthDistribution);
}

function isLipSyncStatus(value: unknown): value is LipSyncStatus {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.state === 'string' && LIP_SYNC_STATES.includes(value.state as (typeof LIP_SYNC_STATES)[number]) &&
    isSafeString(value.message, 1000) &&
    isFiniteNumber(value.currentTime) && value.currentTime >= 0 &&
    (value.audioDuration === null || (isFiniteNumber(value.audioDuration) && value.audioDuration > 0)) &&
    (value.timelineDuration === null || (isFiniteNumber(value.timelineDuration) && value.timelineDuration > 0)) &&
    (value.testId === null || isSafeString(value.testId, 128)) &&
    (value.language === null || isSafeString(value.language, 64)) &&
    (value.sourcePhone === null || isSafeString(value.sourcePhone, 64)) &&
    (value.dominantMouth === null || VRM_MOUTH_EXPRESSIONS.includes(value.dominantMouth as VrmMouth)) &&
    isLipSyncWeights(value.weights) && isFiniteNumber(value.interpolationMs) && value.interpolationMs >= 0 && value.interpolationMs <= 1000 &&
    (value.aligner === null || isSafeString(value.aligner, 128)) &&
    (value.alignerVersion === null || isSafeString(value.alignerVersion, 128)) &&
    isLipSyncValidation(value.validation);
}

export function isAvatarCommand(value: unknown): value is AvatarCommand {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'load-vrm':
      return isFilePayload(value.file) && isLikelyAssetName(value.file.name, 'vrm');
    case 'load-vrma':
      return isFilePayload(value.file) && isLikelyAssetName(value.file.name, 'vrma');
    case 'load-audio':
      return isFilePayload(value.file) && isLikelyAssetName(value.file.name, 'audio');
    case 'load-lipsync-timeline':
      return isFilePayload(value.file) && isLikelyAssetName(value.file.name, 'timeline');
    case 'lipsync-play':
    case 'lipsync-pause':
    case 'lipsync-resume':
    case 'lipsync-stop':
      return true;
    case 'lipsync-set-interpolation':
      return isFiniteNumber(value.milliseconds) && value.milliseconds >= 0 && value.milliseconds <= 1000;
    case 'set-expression':
      return isBoundedString(value.name) && isFiniteNumber(value.value);
    case 'reset-expressions':
    case 'blink':
      return true;
    case 'set-auto-blink':
    case 'set-look-at':
    case 'motion-set-loop':
      return isBoolean(value.enabled);
    case 'set-motion':
    case 'set-idle-motion':
    case 'play-gesture':
      return isBoundedString(value.motionId);
    case 'start-idle':
    case 'motion-play':
    case 'motion-pause':
    case 'motion-stop':
      return true;
    case 'motion-set-speed':
      return isFiniteNumber(value.speed) && value.speed > 0 && value.speed <= 10;
    case 'set-character-position':
      return isCharacterPosition(value.position);
    case 'move-character':
      return typeof value.direction === 'string' && MOVE_DIRECTIONS.includes(value.direction as (typeof MOVE_DIRECTIONS)[number]) &&
        isFiniteNumber(value.step) && value.step > 0 && value.step <= 1;
    default:
      return false;
  }
}

export function isAvatarStatus(value: unknown): value is AvatarStatus {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.phase === 'string' && AVATAR_PHASES.includes(value.phase as (typeof AVATAR_PHASES)[number]) &&
    isSafeString(value.message, 1000) &&
    (value.model === null || isVrmModelInfo(value.model)) &&
    Array.isArray(value.motions) && value.motions.length <= 100 && value.motions.every((motion) => isMotionInfo(motion)) &&
    (value.activeMotionId === null || isBoundedString(value.activeMotionId)) &&
    (value.idleMotionId === null || isBoundedString(value.idleMotionId)) &&
    isBoolean(value.idleAutoStartSuppressed) &&
    typeof value.motionMode === 'string' && MOTION_MODES.includes(value.motionMode as (typeof MOTION_MODES)[number]) &&
    typeof value.playback === 'string' && MOTION_PLAYBACKS.includes(value.playback as (typeof MOTION_PLAYBACKS)[number]) &&
    isBoolean(value.loop) &&
    isFiniteNumber(value.speed) && value.speed >= 0.1 && value.speed <= 2 &&
    isBoolean(value.autoBlink) &&
    isBoolean(value.manualBlink) &&
    isBoolean(value.lookAt) &&
    isCharacterPosition(value.characterPosition) &&
    isLipSyncStatus(value.lipSync)
  );
}
