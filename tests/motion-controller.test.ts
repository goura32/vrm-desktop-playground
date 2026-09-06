import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { VRM } from '@pixiv/three-vrm';
import { MotionController } from '../src/renderer/vrm/MotionController';

describe('motion controller rest pose handling', () => {
  it('resets the normalized humanoid pose even when no action is selected', () => {
    const resetNormalizedPose = vi.fn();
    const vrm = {
      scene: new THREE.Object3D(),
      humanoid: { resetNormalizedPose },
    } as unknown as VRM;
    const controller = new MotionController(vrm);

    expect(controller.stop()).toBe(false);
    expect(resetNormalizedPose).toHaveBeenCalledOnce();
  });
});