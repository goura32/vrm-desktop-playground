import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { CharacterMoveDirection, CharacterPosition } from '../../shared/types';
import {
  clampCharacterPosition,
  clampCharacterPositionToProjectedBounds,
  DEFAULT_CHARACTER_MOVE_STEP,
  DEFAULT_CHARACTER_POSITION,
  moveCharacterPosition,
} from '../../shared/scenePosition';
import type { ProjectedModelBounds } from '../../shared/scenePosition';

export function getFeetAnchorLocal(scene: THREE.Object3D, bounds: THREE.Box3): THREE.Vector3 {
  scene.updateWorldMatrix(true, false);
  const center = bounds.getCenter(new THREE.Vector3());
  return scene.worldToLocal(new THREE.Vector3(center.x, bounds.min.y, center.z));
}

export class SceneController {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private model: VRM | null = null;
  private modelAnchor = new THREE.Vector3();
  private characterPosition: CharacterPosition = { ...DEFAULT_CHARACTER_POSITION };

  public constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 1.35, 3.2);
    this.camera.lookAt(0, 1.25, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x172554, 1.6);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(1.5, 2.5, 3);
    this.scene.add(hemiLight, keyLight);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  public setModel(vrm: VRM): void {
    this.model = vrm;
    this.scene.add(vrm.scene);
    const bounds = new THREE.Box3().setFromObject(vrm.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const feetAnchorLocal = getFeetAnchorLocal(vrm.scene, bounds);
    const height = Math.max(size.y, 1);

    vrm.scene.position.x -= center.x;
    vrm.scene.position.y -= bounds.min.y;
    vrm.scene.position.z -= center.z;
    this.modelAnchor.copy(feetAnchorLocal);
    this.camera.position.set(0, height * 0.53, Math.max(3.2, height * 2.6));
    this.camera.near = Math.max(0.01, height / 100);
    this.camera.far = Math.max(100, height * 10);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, height * 0.52, 0);
    this.camera.updateMatrixWorld(true);
    this.applyCharacterPosition();
  }

  public get currentCharacterPosition(): CharacterPosition {
    return { ...this.characterPosition };
  }

  public setCharacterPosition(position: CharacterPosition): CharacterPosition {
    this.characterPosition = clampCharacterPosition(position);
    this.applyCharacterPosition();
    return this.currentCharacterPosition;
  }

  public moveCharacter(direction: CharacterMoveDirection, step = DEFAULT_CHARACTER_MOVE_STEP): CharacterPosition {
    return this.setCharacterPosition(moveCharacterPosition(this.characterPosition, direction, step));
  }

  public removeModel(vrm: VRM): void {
    this.scene.remove(vrm.scene);
    if (this.model === vrm) {
      this.model = null;
      this.modelAnchor.set(0, 0, 0);
    }
  }

  public start(onUpdate: (delta: number) => void): void {
    this.stop();
    this.clock.start();
    const tick = (): void => {
      const delta = this.clock.getDelta();
      onUpdate(delta);
      this.renderer.render(this.scene, this.camera);
      this.frameId = window.requestAnimationFrame(tick);
    };
    tick();
  }

  public stop(): void {
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  public resize(): void {
    const canvas = this.renderer.domElement;
    const width = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || 1);
    const height = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyCharacterPosition();
  }

  public dispose(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.model = null;
    this.modelAnchor.set(0, 0, 0);
    this.renderer.dispose();
  }

  private applyCharacterPosition(): void {
    if (!this.model) {
      return;
    }

    this.model.scene.updateWorldMatrix(true, true);
    const modelBounds = new THREE.Box3().setFromObject(this.model.scene);
    const anchor = this.modelAnchor.clone();
    this.model.scene.localToWorld(anchor);
    const projectedAnchor = anchor.clone().project(this.camera);
    const projectedBounds = this.projectModelBounds(modelBounds);
    this.characterPosition = clampCharacterPositionToProjectedBounds(
      this.characterPosition,
      projectedAnchor,
      projectedBounds,
    );
    const target = new THREE.Vector3(
      this.characterPosition.x * 2 - 1,
      1 - this.characterPosition.y * 2,
      projectedAnchor.z,
    ).unproject(this.camera);
    this.model.scene.position.x += target.x - anchor.x;
    this.model.scene.position.y += target.y - anchor.y;
  }

  private projectModelBounds(bounds: THREE.Box3): ProjectedModelBounds {
    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ].map((corner) => corner.project(this.camera));
    return {
      minX: Math.min(...corners.map((corner) => corner.x)),
      maxX: Math.max(...corners.map((corner) => corner.x)),
      minY: Math.min(...corners.map((corner) => corner.y)),
      maxY: Math.max(...corners.map((corner) => corner.y)),
    };
  }
}
