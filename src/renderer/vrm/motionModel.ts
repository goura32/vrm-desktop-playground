import type { AvatarPhase, MotionMode, MotionPlayback } from '../../shared/types';

export type MotionLoopMode = 'repeat' | 'once';

export function clampMotionSpeed(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(2, Math.max(0.1, value));
}

export function createMotionId(fileName: string, occurrence: number): string {
  return `${fileName}-${occurrence}`;
}

export function motionLoopMode(loop: boolean): MotionLoopMode {
  return loop ? 'repeat' : 'once';
}

export function motionPlaybackTransition(previous: MotionPlayback, current: MotionPlayback): MotionPlayback | null {
  return previous === current ? null : current;
}

export function shouldPublishMotionCompletion(
  previous: MotionPlayback,
  current: MotionPlayback,
  loading: boolean,
  ownerIsCurrent: boolean,
): boolean {
  return !loading && ownerIsCurrent && previous === 'playing' && motionPlaybackTransition(previous, current) === 'stopped';
}

export function shouldResetToRestPoseAfterCompletion(
  previous: MotionPlayback,
  current: MotionPlayback,
  loading: boolean,
  ownerIsCurrent: boolean,
): boolean {
  return shouldPublishMotionCompletion(previous, current, loading, ownerIsCurrent);
}

export function shouldRecoverGestureAfterAsyncLoad(
  completionWasSuppressed: boolean,
  mode: MotionMode,
  playback: MotionPlayback,
  loading: boolean,
  ownerIsCurrent: boolean,
): boolean {
  return completionWasSuppressed && !loading && ownerIsCurrent && mode === 'gesture' && playback === 'stopped';
}

export function shouldReturnToIdle(
  previous: MotionPlayback,
  current: MotionPlayback,
  mode: MotionMode,
  idleMotionId: string | null,
  ownerIsCurrent: boolean,
): boolean {
  return shouldPublishMotionCompletion(previous, current, false, ownerIsCurrent) && mode === 'gesture' && idleMotionId !== null;
}

export function motionModeForPlayback(motionId: string, idleMotionId: string | null, loop: boolean): MotionMode {
  return motionId === idleMotionId && loop ? 'idle' : 'gesture';
}

export function shouldStartAutomaticIdle(
  idleMotionId: string | null,
  mode: MotionMode,
  playback: MotionPlayback,
  alreadyStarted: boolean,
  suppressed: boolean = false,
): boolean {
  return !alreadyStarted && !suppressed && idleMotionId !== null && mode === 'stopped' && playback === 'stopped';
}

export function motionPhaseForPlayback(hasModel: boolean, loading: boolean, currentPhase: AvatarPhase): AvatarPhase {
  if (loading) {
    return 'loading';
  }
  return hasModel ? 'ready' : currentPhase;
}
