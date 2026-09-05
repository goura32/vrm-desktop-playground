import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(-1, value)) : 0;
}

export class LookAtController {
  private readonly target = new THREE.Object3D();
  private enabled = true;

  public constructor(
    private readonly vrm: VRM,
    private readonly scene: THREE.Scene,
  ) {
    this.target.position.set(0, 1.45, 2);
    this.scene.add(this.target);
    this.apply();
  }

  public get supported(): boolean {
    return Boolean(this.vrm.lookAt);
  }

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.apply();
  }

  public setNormalizedTarget(x: number, y: number): void {
    this.target.position.set(clamp(x) * 0.9, 1.45 + clamp(y) * 0.55, 2);
  }

  public dispose(): void {
    if (this.vrm.lookAt) {
      this.vrm.lookAt.target = null;
      this.vrm.lookAt.autoUpdate = false;
    }
    this.scene.remove(this.target);
  }

  private apply(): void {
    if (!this.vrm.lookAt) {
      return;
    }
    this.vrm.lookAt.autoUpdate = this.enabled;
    this.vrm.lookAt.target = this.enabled ? this.target : null;
  }
}
