import * as THREE from 'three';
import { createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import type { VRM } from '@pixiv/three-vrm';
import type { VRMAnimation } from '@pixiv/three-vrm-animation';
import type { MotionInfo, MotionPlayback } from '../../shared/types';
import { clampMotionSpeed, createMotionId } from './motionModel';

interface MotionSource {
  fileName: string;
  animations: readonly VRMAnimation[];
}

interface MotionEntry {
  info: MotionInfo;
  clip: THREE.AnimationClip;
}

export class MotionController {
  private readonly mixer: THREE.AnimationMixer;
  private readonly entries = new Map<string, MotionEntry>();
  private readonly sources: MotionSource[] = [];
  private activeMotionId: string | null = null;
  private action: THREE.AnimationAction | null = null;
  private playback: MotionPlayback = 'stopped';
  private loop = true;
  private speed = 1;

  public constructor(private readonly vrm: VRM) {
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  public get motionInfos(): MotionInfo[] {
    return [...this.entries.values()].map((entry) => entry.info);
  }

  public get activeId(): string | null {
    return this.activeMotionId;
  }

  public get playbackState(): MotionPlayback {
    return this.playback;
  }

  public get loopEnabled(): boolean {
    return this.loop;
  }

  public get playbackSpeed(): number {
    return this.speed;
  }

  public get sourceFiles(): readonly MotionSource[] {
    return this.sources;
  }

  public addAnimations(fileName: string, animations: readonly VRMAnimation[]): MotionInfo[] {
    this.sources.push({ fileName, animations });
    return this.addAnimationEntries(fileName, animations);
  }

  public addSource(source: MotionSource): MotionInfo[] {
    this.sources.push(source);
    return this.addAnimationEntries(source.fileName, source.animations);
  }

  public selectMotion(motionId: string): boolean {
    const entry = this.entries.get(motionId);
    if (!entry) {
      return false;
    }

    this.action?.stop();
    this.activeMotionId = motionId;
    this.action = this.mixer.clipAction(entry.clip);
    this.applyActionOptions();
    this.playback = 'stopped';
    return true;
  }

  public play(): boolean {
    if (!this.action && this.activeMotionId) {
      this.selectMotion(this.activeMotionId);
    }
    if (!this.action) {
      return false;
    }
    this.action.reset().play();
    this.action.paused = false;
    this.playback = 'playing';
    return true;
  }

  public pause(): boolean {
    if (!this.action || this.playback !== 'playing') {
      return false;
    }
    this.action.paused = true;
    this.playback = 'paused';
    return true;
  }

  public stop(): boolean {
    if (!this.action) {
      return false;
    }
    this.action.stop();
    this.action.paused = false;
    this.playback = 'stopped';
    return true;
  }

  public setLoop(enabled: boolean): void {
    this.loop = enabled;
    this.applyActionOptions();
  }

  public setSpeed(value: number): void {
    this.speed = clampMotionSpeed(value);
    if (this.action) {
      this.action.setEffectiveTimeScale(this.speed);
    }
  }

  public update(delta: number): void {
    this.mixer.update(Math.max(0, delta));
    if (this.playback === 'playing' && !this.loop && this.action && !this.action.isRunning()) {
      this.playback = 'stopped';
    }
  }

  public dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.vrm.scene);
    for (const entry of this.entries.values()) {
      this.mixer.uncacheClip(entry.clip);
    }
    this.entries.clear();
    this.sources.length = 0;
    this.action = null;
    this.activeMotionId = null;
    this.playback = 'stopped';
  }

  private addAnimationEntries(fileName: string, animations: readonly VRMAnimation[]): MotionInfo[] {
    const added: MotionInfo[] = [];
    for (const [index, animation] of animations.entries()) {
      let occurrence = index;
      let id = createMotionId(fileName, occurrence);
      while (this.entries.has(id)) {
        occurrence += 1;
        id = createMotionId(fileName, occurrence);
      }
      try {
        const clip = createVRMAnimationClip(animation, this.vrm);
        const info: MotionInfo = { id, fileName, duration: clip.duration };
        this.entries.set(id, { info, clip });
        added.push(info);
      } catch {
        // One incompatible animation must not take down the avatar renderer.
      }
    }

    if (!this.activeMotionId && added[0]) {
      this.selectMotion(added[0].id);
    }
    return added;
  }

  private applyActionOptions(): void {
    if (!this.action) {
      return;
    }
    this.action.setLoop(this.loop ? THREE.LoopRepeat : THREE.LoopOnce, this.loop ? Infinity : 1);
    this.action.clampWhenFinished = !this.loop;
    this.action.setEffectiveTimeScale(this.speed);
  }
}
