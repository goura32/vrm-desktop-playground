import type {
  AvatarCommand,
  AvatarStatus,
  CharacterPosition,
  ExpressionInfo,
  MotionInfo,
  VrmModelInfo,
} from './types';
import { isFilePayload, isLikelyAssetName } from './fileValidation';

const CAPABILITY_NAMES = ['humanoid', 'presetExpressions', 'customExpressions', 'blink', 'lookAt', 'springBone', 'vrma'] as const;
const AVATAR_PHASES = ['idle', 'loading', 'ready', 'error'] as const;
const MOTION_PLAYBACKS = ['stopped', 'playing', 'paused'] as const;
const MOTION_MODES = ['idle', 'gesture', 'stopped'] as const;
const MOVE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBoundedString(value: unknown, maxLength = 255): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
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
  return CAPABILITY_NAMES.every((name) => capabilities[name] === 'available' || capabilities[name] === 'unsupported');
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
    typeof value.message === 'string' && value.message.length <= 1000 &&
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
    isCharacterPosition(value.characterPosition)
  );
}
