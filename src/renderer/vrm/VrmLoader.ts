import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import type { VRM } from '@pixiv/three-vrm';
import type { VRMAnimation } from '@pixiv/three-vrm-animation';

type ParsedGltf = {
  userData: {
    vrm?: VRM;
    vrmAnimations?: VRMAnimation[];
  };
};

function createLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  return loader;
}

function asArrayBuffer(data: ArrayBuffer): ArrayBuffer {
  return data.slice(0);
}

export function parseVrm(data: ArrayBuffer): Promise<VRM> {
  return new Promise((resolve, reject) => {
    createLoader().parse(
      asArrayBuffer(data),
      '',
      (gltf) => {
        const parsed = gltf as ParsedGltf;
        const vrm = parsed.userData.vrm;
        if (!vrm) {
          reject(new Error('The file does not contain a VRM model.'));
          return;
        }
        VRMUtils.removeUnnecessaryJoints(vrm.scene);
        resolve(vrm);
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

export function parseVrma(data: ArrayBuffer): Promise<VRMAnimation[]> {
  return new Promise((resolve, reject) => {
    createLoader().parse(
      asArrayBuffer(data),
      '',
      (gltf) => {
        const parsed = gltf as ParsedGltf;
        const animations = parsed.userData.vrmAnimations ?? [];
        if (animations.length === 0) {
          reject(new Error('The file does not contain a VRMA animation.'));
          return;
        }
        resolve(animations);
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}
