import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

export class SceneController {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

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
    this.scene.add(vrm.scene);
    const bounds = new THREE.Box3().setFromObject(vrm.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const height = Math.max(size.y, 1);

    vrm.scene.position.x -= center.x;
    vrm.scene.position.y -= bounds.min.y;
    vrm.scene.position.z -= center.z;
    this.camera.position.set(0, height * 0.53, Math.max(2.2, height * 1.65));
    this.camera.near = Math.max(0.01, height / 100);
    this.camera.far = Math.max(100, height * 10);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, height * 0.52, 0);
  }

  public removeModel(vrm: VRM): void {
    this.scene.remove(vrm.scene);
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
    const width = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || 600);
    const height = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 800);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer.dispose();
  }
}
