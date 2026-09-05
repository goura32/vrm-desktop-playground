import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  clampCharacterPosition,
  clampCharacterPositionToProjectedBounds,
  DEFAULT_CHARACTER_MOVE_STEP,
  DEFAULT_CHARACTER_POSITION,
  moveCharacterPosition,
} from '../src/shared/scenePosition';
import { getFeetAnchorLocal } from '../src/renderer/scene/SceneController';

describe('character scene position', () => {
  it('uses a normalized screen-space feet-anchor default near the bottom', () => {
    expect(DEFAULT_CHARACTER_POSITION).toEqual({ x: 0.5, y: 0.87 });
    expect(DEFAULT_CHARACTER_MOVE_STEP).toBe(0.05);
  });

  it('keeps the model visible when a requested feet position reaches the viewport edge', () => {
    const safePosition = clampCharacterPositionToProjectedBounds(
      { x: 0, y: 0 },
      { x: 0, y: 0.2 },
      { minX: -0.6, maxX: 0.5, minY: -0.8, maxY: 0.8 },
    );
    expect(safePosition.x).toBeCloseTo(0.31, 8);
    expect(safePosition.y).toBeCloseTo(0.31, 8);
  });

  it('maps a transformed model feet point back to its local anchor', () => {
    const root = new THREE.Object3D();
    root.position.set(3, 4, 5);
    root.rotation.set(0.2, -0.3, 0.1);
    root.scale.set(1.2, 2, 0.8);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
    mesh.position.set(0, 1, 0);
    root.add(mesh);
    root.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    const anchor = getFeetAnchorLocal(root, bounds);

    root.position.x -= center.x;
    root.position.y -= bounds.min.y;
    root.position.z -= center.z;
    root.updateWorldMatrix(true, true);
    const normalizedFeet = root.localToWorld(anchor.clone());

    expect(normalizedFeet.x).toBeCloseTo(0, 6);
    expect(normalizedFeet.y).toBeCloseTo(0, 6);
    expect(normalizedFeet.z).toBeCloseTo(0, 6);
    mesh.geometry.dispose();
  });

  it('clamps character coordinates to the Primary Display viewport', () => {
    expect(clampCharacterPosition({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 });
    expect(clampCharacterPosition({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual(DEFAULT_CHARACTER_POSITION);
  });

  it('moves the character in scene/screen-space and clamps at the edges', () => {
    const start = { x: 0.5, y: 0.5 };
    expect(moveCharacterPosition(start, 'up')).toEqual({ x: 0.5, y: 0.45 });
    expect(moveCharacterPosition(start, 'down', 0.2)).toEqual({ x: 0.5, y: 0.7 });
    expect(moveCharacterPosition(start, 'left')).toEqual({ x: 0.45, y: 0.5 });
    expect(moveCharacterPosition(start, 'right', 0.8)).toEqual({ x: 1, y: 0.5 });
    expect(moveCharacterPosition({ x: 0, y: 0 }, 'up')).toEqual({ x: 0, y: 0 });
  });
});
