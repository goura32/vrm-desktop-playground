import { describe, expect, it } from 'vitest';
import {
  clampMotionSpeed,
  createMotionId,
  motionPlaybackTransition,
  motionLoopMode,
  motionModeForPlayback,
  motionPhaseForPlayback,
  shouldRecoverGestureAfterAsyncLoad,
  shouldResetToRestPoseAfterCompletion,
  shouldStartAutomaticIdle,
  shouldReturnToIdle,
  shouldPublishMotionCompletion,
} from '../src/renderer/vrm/motionModel';

describe('motion controls', () => {
  it('clamps speed to a usable range', () => {
    expect(clampMotionSpeed(1.25)).toBe(1.25);
    expect(clampMotionSpeed(0)).toBe(0.1);
    expect(clampMotionSpeed(5)).toBe(2);
    expect(clampMotionSpeed(Number.NaN)).toBe(1);
  });

  it('creates stable motion ids from names and occurrence', () => {
    expect(createMotionId('Walk.vrma', 0)).toBe('Walk.vrma-0');
    expect(createMotionId('Walk.vrma', 1)).toBe('Walk.vrma-1');
  });

  it('maps loop checkbox state to the Three.js loop mode', () => {
    expect(motionLoopMode(true)).toBe('repeat');
    expect(motionLoopMode(false)).toBe('once');
  });

  it('detects one-shot playback completion for status publication', () => {
    expect(motionPlaybackTransition('playing', 'stopped')).toBe('stopped');
    expect(motionPlaybackTransition('playing', 'playing')).toBeNull();
    expect(motionPlaybackTransition('paused', 'stopped')).toBe('stopped');
  });

  it('suppresses stale completion notifications during model loading', () => {
    expect(shouldPublishMotionCompletion('playing', 'stopped', false, true)).toBe(true);
    expect(shouldPublishMotionCompletion('playing', 'stopped', true, true)).toBe(false);
    expect(shouldPublishMotionCompletion('playing', 'stopped', false, false)).toBe(false);
  });

  it('returns to idle only when the current one-shot gesture finishes', () => {
    expect(shouldReturnToIdle('playing', 'stopped', 'gesture', 'Relax.vrma-0', true)).toBe(true);
    expect(shouldReturnToIdle('playing', 'stopped', 'gesture', null, true)).toBe(false);
    expect(shouldReturnToIdle('playing', 'stopped', 'idle', 'Relax.vrma-0', true)).toBe(false);
    expect(shouldReturnToIdle('playing', 'stopped', 'gesture', 'Relax.vrma-0', false)).toBe(false);
    expect(shouldReturnToIdle('paused', 'stopped', 'gesture', 'Relax.vrma-0', true)).toBe(false);
  });

  it('labels a looping configured idle separately from a gesture playback', () => {
    expect(motionModeForPlayback('Relax.vrma-0', 'Relax.vrma-0', true)).toBe('idle');
    expect(motionModeForPlayback('Goodbye.vrma-0', 'Relax.vrma-0', false)).toBe('gesture');
    expect(motionModeForPlayback('Relax.vrma-0', null, true)).toBe('gesture');
  });

  it('starts automatic idle only once for a stopped mode, including an alternate idle selection', () => {
    expect(shouldStartAutomaticIdle('Relax.vrma-0', 'stopped', 'stopped', false)).toBe(true);
    expect(shouldStartAutomaticIdle('Goodbye.vrma-0', 'stopped', 'stopped', false)).toBe(true);
    expect(shouldStartAutomaticIdle('Relax.vrma-0', 'stopped', 'stopped', true)).toBe(false);
    expect(shouldStartAutomaticIdle('Relax.vrma-0', 'gesture', 'stopped', false)).toBe(false);
    expect(shouldStartAutomaticIdle(null, 'stopped', 'stopped', false)).toBe(false);
    expect(shouldStartAutomaticIdle('Relax.vrma-0', 'stopped', 'stopped', false, true)).toBe(false);
  });

  it('keeps motion status loading while a model-backed VRMA operation is pending', () => {
    expect(motionPhaseForPlayback(true, true, 'ready')).toBe('loading');
    expect(motionPhaseForPlayback(true, false, 'loading')).toBe('ready');
    expect(motionPhaseForPlayback(false, true, 'loading')).toBe('loading');
  });

  it('requires a rest-pose reset when completion cannot return to idle', () => {
    expect(shouldResetToRestPoseAfterCompletion('playing', 'stopped', false, true)).toBe(true);
    expect(shouldResetToRestPoseAfterCompletion('playing', 'stopped', true, true)).toBe(false);
    expect(shouldResetToRestPoseAfterCompletion('playing', 'playing', false, true)).toBe(false);
  });

  it('recovers a gesture completion suppressed by an asynchronous motion load', () => {
    expect(shouldRecoverGestureAfterAsyncLoad(true, 'gesture', 'stopped', false, true)).toBe(true);
    expect(shouldRecoverGestureAfterAsyncLoad(false, 'gesture', 'stopped', false, true)).toBe(false);
    expect(shouldRecoverGestureAfterAsyncLoad(true, 'idle', 'stopped', false, true)).toBe(false);
    expect(shouldRecoverGestureAfterAsyncLoad(true, 'gesture', 'playing', false, true)).toBe(false);
    expect(shouldRecoverGestureAfterAsyncLoad(true, 'gesture', 'stopped', true, true)).toBe(false);
    expect(shouldRecoverGestureAfterAsyncLoad(true, 'gesture', 'stopped', false, false)).toBe(false);
  });
});
