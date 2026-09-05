import type { MotionPlayback } from '../../shared/types';

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
