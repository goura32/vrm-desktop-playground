import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { AvatarStatus } from '../../shared/types';
import type { BundledAssetId } from '../../shared/bundledAssets';
import { AvatarRuntime, getInitialAvatarStatus } from './AvatarRuntime';
import { shouldStartAutomaticIdle } from '../vrm/motionModel';
import './styles.css';

const DEFAULT_MOTION_ASSETS: readonly { assetId: BundledAssetId; fileName: string }[] = [
  { assetId: 'test-vrma', fileName: 'test.vrma' },
  { assetId: 'idle-relax', fileName: 'Relax.vrma' },
  { assetId: 'gesture-goodbye', fileName: 'Goodbye.vrma' },
  { assetId: 'regression-jump', fileName: 'Jump.vrma' },
];

export function AvatarWindow(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<AvatarStatus>(getInitialAvatarStatus());

  useEffect(() => {
    const canvas = canvasRef.current;
    const api = typeof window === 'undefined' ? undefined : window.vrmDesktop;
    if (!canvas || !api) {
      setStatus({ ...getInitialAvatarStatus(), phase: 'error', message: 'Electron preload bridge is unavailable.' });
      return undefined;
    }

    let bundledMotionModel: string | null = null;
    let requestedMotionAssets = new Set<BundledAssetId>();
    let automaticIdleStarted = false;
    const runtime = new AvatarRuntime(canvas, (nextStatus) => {
      setStatus(nextStatus);
      api.reportAvatarStatus(nextStatus);
      if (nextStatus.phase === 'loading' && nextStatus.message.startsWith('Loading VRM 1.0 model:')) {
        bundledMotionModel = null;
        requestedMotionAssets = new Set();
        automaticIdleStarted = false;
      }
      if (nextStatus.phase !== 'ready' || !nextStatus.model) {
        return;
      }
      if (bundledMotionModel !== nextStatus.model.fileName) {
        bundledMotionModel = nextStatus.model.fileName;
        requestedMotionAssets = new Set();
        automaticIdleStarted = false;
      }
      const idleMotion = nextStatus.motions.find((motion) => motion.fileName === 'Relax.vrma');
      if (idleMotion && nextStatus.idleMotionId === null) {
        runtime.handleCommand({ type: 'set-idle-motion', motionId: idleMotion.id });
        return;
      }
      if (shouldStartAutomaticIdle(
        nextStatus.idleMotionId,
        nextStatus.motionMode,
        nextStatus.playback,
        automaticIdleStarted,
        nextStatus.idleAutoStartSuppressed,
      )) {
        automaticIdleStarted = true;
        runtime.handleCommand({ type: 'start-idle' });
        return;
      }
      const missingAsset = DEFAULT_MOTION_ASSETS.find(({ assetId, fileName }) =>
        !requestedMotionAssets.has(assetId) && !nextStatus.motions.some((motion) => motion.fileName === fileName),
      );
      if (missingAsset) {
        requestedMotionAssets.add(missingAsset.assetId);
        void api.loadBundledAsset(missingAsset.assetId);
      }
    });
    const removeCommandListener = api.onAvatarCommand((command) => runtime.handleCommand(command));
    const onPointerMove = (event: PointerEvent): void => {
      const bounds = canvas.getBoundingClientRect();
      const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const normalizedY = 1 - ((event.clientY - bounds.top) / bounds.height) * 2;
      runtime.setLookAtTarget(normalizedX, normalizedY);
    };
    canvas.addEventListener('pointermove', onPointerMove);
    api.reportAvatarStatus(runtime.currentStatus);
    void api.loadBundledAsset('constraint-twist');

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      removeCommandListener();
      runtime.dispose();
    };
  }, []);

  return (
    <main className="avatar-root" aria-label="VRM avatar window">
      <canvas ref={canvasRef} className="avatar-canvas" aria-label="Rendered VRM 1.0 avatar" />
      {!status.model && (
        <div className={`avatar-loading avatar-loading-${status.phase}`} role="status">
          <div className="loading-orb" aria-hidden="true"><span>VRM</span></div>
          <p>{status.phase === 'error' ? 'VRM load error' : 'Loading VRM 1.0'}</p>
          <small>{status.message}</small>
        </div>
      )}
      {status.model && (
        <div className="avatar-hud" aria-live="polite">
          <span>{status.model.metaName}</span>
          {status.playback === 'playing' && <span> · ▶</span>}
        </div>
      )}
    </main>
  );
}
