import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AvatarCommand, AvatarStatus, Capability, ExpressionInfo } from '../../shared/types';
import { DEFAULT_CHARACTER_MOVE_STEP, DEFAULT_CHARACTER_POSITION } from '../../shared/scenePosition';
import { createInitialWindowState } from '../../shared/windowState';
import { createInitialLipSyncStatus } from '../../shared/lipsync';
import type { WindowStateSnapshot } from '../../shared/windowState';
import { directionForKey, normalizeMoveStep, parseNormalizedCoordinate } from './controlModel';
import './styles.css';

const EMPTY_STATUS: AvatarStatus = {
  phase: 'idle',
  message: 'Waiting for the avatar renderer…',
  model: null,
  motions: [],
  activeMotionId: null,
  idleMotionId: null,
  idleAutoStartSuppressed: false,
  motionMode: 'stopped',
  playback: 'stopped',
  loop: true,
  speed: 1,
  autoBlink: true,
  manualBlink: false,
  lookAt: true,
  characterPosition: { ...DEFAULT_CHARACTER_POSITION },
  lipSync: createInitialLipSyncStatus(),
};

const CAPABILITY_LABELS: Record<string, string> = {
  humanoid: 'Humanoid',
  presetExpressions: 'Preset Expressions',
  customExpressions: 'Custom Expressions',
  blink: 'Blink',
  lookAt: 'LookAt',
  springBone: 'Spring Bone',
  vrma: 'VRMA',
};

const MOUTH_PRESETS = ['aa', 'ih', 'ou', 'ee', 'oh'];

function send(api: Window['vrmDesktop'] | undefined, command: AvatarCommand): void {
  api?.sendAvatarCommand(command);
}

function expressionTitle(expression: ExpressionInfo): string {
  return `${expression.kind === 'preset' ? 'Preset' : 'Custom'}: ${expression.name}`;
}

export function DebugWindow(): ReactElement {
  const [windowState, setWindowState] = useState<WindowStateSnapshot>(createInitialWindowState());
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>(EMPTY_STATUS);
  const [moveStep, setMoveStep] = useState(String(DEFAULT_CHARACTER_MOVE_STEP));
  const [positionX, setPositionX] = useState(String(EMPTY_STATUS.characterPosition.x));
  const [positionY, setPositionY] = useState(String(EMPTY_STATUS.characterPosition.y));
  const [idleSelection, setIdleSelection] = useState('');
  const [coordinateError, setCoordinateError] = useState('');
  const api = typeof window === 'undefined' ? undefined : window.vrmDesktop;

  useEffect(() => {
    if (!api) {
      setAvatarStatus((current) => ({ ...current, phase: 'error', message: 'Electron preload bridge is unavailable.' }));
      return undefined;
    }

    let active = true;
    void api.getWindowState().then((state) => {
      if (active) {
        setWindowState(state);
      }
    });
    const removeWindowStateListener = api.onWindowState((state) => {
      if (active) {
        setWindowState(state);
      }
    });
    const removeAvatarStatusListener = api.onAvatarStatus((status) => {
      if (active) {
        setAvatarStatus(status);
        setPositionX(status.characterPosition.x.toFixed(2));
        setPositionY(status.characterPosition.y.toFixed(2));
        setIdleSelection(status.idleMotionId ?? '');
      }
    });

    return () => {
      active = false;
      removeWindowStateListener();
      removeAvatarStatusListener();
    };
  }, [api]);

  useEffect(() => {
    if (!api) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        event.altKey || event.ctrlKey || event.metaKey
      ) {
        return;
      }

      const direction = directionForKey(event.key, event.code);
      if (!direction) {
        return;
      }
      event.preventDefault();
      send(api, { type: 'move-character', direction, step: normalizeMoveStep(moveStep) });
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [api, moveStep]);

  const applyWindowState = async (next: Promise<WindowStateSnapshot>): Promise<void> => {
    setWindowState(await next);
  };

  const handleMove = (direction: 'up' | 'down' | 'left' | 'right'): void => {
    const step = normalizeMoveStep(moveStep);
    setMoveStep(String(step));
    send(api, { type: 'move-character', direction, step });
  };

  const handleSetPosition = (): void => {
    const x = parseNormalizedCoordinate(positionX);
    const y = parseNormalizedCoordinate(positionY);
    if (x === null || y === null) {
      setCoordinateError('Character X and Y must be numbers from 0 to 1.');
      return;
    }
    setCoordinateError('');
    send(api, { type: 'set-character-position', position: { x, y } });
  };


  const changeExpression = (expression: ExpressionInfo, value: number): void => {
    send(api, { type: 'set-expression', name: expression.name, value });
  };

  const motionState = avatarStatus.phase === 'loading' || avatarStatus.phase === 'error'
    ? avatarStatus.phase
    : avatarStatus.motionMode;
  const activeMotion = avatarStatus.motions.find((motion) => motion.id === avatarStatus.activeMotionId);

  return (
    <main className="debug-shell">
      <header className="debug-header">
        <div>
          <p className="eyebrow">VRM DESKTOP PLAYGROUND</p>
          <h1>Debug panel</h1>
        </div>
        <span className={`phase-badge phase-${avatarStatus.phase}`}>{avatarStatus.phase}</span>
      </header>

      <section className="panel-section" aria-labelledby="window-heading">
        <div className="section-heading">
          <h2 id="window-heading">Window probe</h2>
          <span className="mono">Avatar + Debug</span>
        </div>
        <div className="toggle-grid">
          <label className="toggle-control" htmlFor="always-on-top">
            <input
              id="always-on-top"
              type="checkbox"
              checked={windowState.alwaysOnTop}
              onChange={(event) => {
                if (api) void applyWindowState(api.setAlwaysOnTop(event.target.checked));
              }}
            />
            <span>Always on Top</span>
          </label>
        </div>
        <p className="hint">Avatar overlay: Primary Display bounds · transparent · always Click Through. Window movement controls are disabled.</p>

        <div className="state-grid" aria-label="Current window state">
          <div><span>avatar overlay bounds</span><strong>{windowState.avatar.x}, {windowState.avatar.y} · {windowState.avatar.width} × {windowState.avatar.height}</strong></div>
          <div><span>debug window</span><strong>{windowState.debug.width} × {windowState.debug.height}</strong></div>
        </div>

        <div className="position-grid">
          <label htmlFor="character-position-x">Character X (0..1)<input id="character-position-x" type="number" min="0" max="1" step="0.01" value={positionX} autoFocus onChange={(event) => setPositionX(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSetPosition(); }} /></label>
          <label htmlFor="character-position-y">Character Y (0..1)<input id="character-position-y" type="number" min="0" max="1" step="0.01" value={positionY} onChange={(event) => setPositionY(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSetPosition(); }} /></label>
          <label htmlFor="character-move-step">Move step<input id="character-move-step" type="number" min="0.01" max="1" step="0.01" value={moveStep} onChange={(event) => setMoveStep(event.target.value)} /></label>
          <button id="set-character-position" type="button" className="secondary-button" onClick={handleSetPosition}>Set character position</button>
        </div>
        {coordinateError && <p className="error-text" role="alert">{coordinateError}</p>}
        <div className="move-grid" aria-label="Move character in scene space">
          <button id="move-character-up" type="button" onClick={() => handleMove('up')} aria-label="Move character up">▲</button>
          <button id="move-character-down" type="button" onClick={() => handleMove('down')} aria-label="Move character down">▼</button>
          <button id="move-character-left" type="button" onClick={() => handleMove('left')} aria-label="Move character left">◀</button>
          <button id="move-character-right" type="button" onClick={() => handleMove('right')} aria-label="Move character right">▶</button>
        </div>
      </section>

      <section className="panel-section" aria-labelledby="asset-heading">
        <div className="section-heading">
          <h2 id="asset-heading">Assets</h2>
          <span className="mono">VRM 1.0 / VRMA</span>
        </div>
        <div className="button-row wrap">
          <button id="open-vrm" type="button" onClick={() => api && void api.openVrmDialog()}>Open VRM</button>
          <button type="button" className="secondary-button" onClick={() => api && void api.loadBundledAsset('constraint-twist')}>Load constraint sample</button>
          <button type="button" className="secondary-button" onClick={() => api && void api.loadBundledAsset('seed-san')}>Load Seed-san</button>
          <button type="button" className="secondary-button" onClick={() => api && void api.loadBundledAsset('expression-overridden')}>Load expression test A</button>
          <button type="button" className="secondary-button" onClick={() => api && void api.loadBundledAsset('expression-overrides')}>Load expression test B</button>
          <button id="open-vrma" type="button" onClick={() => api && void api.openVrmaDialog()}>Open VRMA</button>
          <button type="button" className="secondary-button" onClick={() => api && void api.loadBundledAsset('test-vrma')}>Load bundled VRMA</button>
        </div>
        <p className="hint">The bundled samples are the only assets committed to this PoC. See <span className="mono">assets/manifest.json</span>.</p>
      </section>

      <section className="panel-section" aria-labelledby="lipsync-heading">
        <div className="section-heading">
          <h2 id="lipsync-heading">Qwen3-TTS lip sync</h2>
          <span className={`phase-badge phase-${avatarStatus.lipSync.state}`}>{avatarStatus.lipSync.state}</span>
        </div>
        <div className="button-row wrap">
          <button id="open-audio" type="button" onClick={() => api && void api.openAudioDialog()}>Load Audio</button>
          <button id="open-lipsync-timeline" type="button" className="secondary-button" onClick={() => api && void api.openLipSyncTimelineDialog()}>Load LipSyncTimeline</button>
        </div>
        <div className="button-row wrap lip-sync-playback-controls">
          <button id="lipsync-play" type="button" onClick={() => send(api, { type: 'lipsync-play' })}>Play</button>
          <button id="lipsync-pause" type="button" className="secondary-button" onClick={() => send(api, { type: 'lipsync-pause' })}>Pause</button>
          <button id="lipsync-resume" type="button" className="secondary-button" onClick={() => send(api, { type: 'lipsync-resume' })}>Resume</button>
          <button id="lipsync-stop" type="button" className="secondary-button" onClick={() => send(api, { type: 'lipsync-stop' })}>Stop</button>
        </div>
        <div className="lip-sync-time" aria-live="polite">
          <strong>{avatarStatus.lipSync.currentTime.toFixed(3)}s</strong>
          <span>/ {avatarStatus.lipSync.audioDuration?.toFixed(3) ?? '—'}s audio · {avatarStatus.lipSync.timelineDuration?.toFixed(3) ?? '—'}s timeline</span>
        </div>
        <div className="lip-sync-details">
          <div><span>source phone</span><strong className="mono">{avatarStatus.lipSync.sourcePhone ?? 'sil'}</strong></div>
          <div><span>dominant mouth</span><strong className="mono">{avatarStatus.lipSync.dominantMouth ?? 'closed'}</strong></div>
          <div><span>aligner</span><strong className="mono">{avatarStatus.lipSync.aligner ?? '—'} {avatarStatus.lipSync.alignerVersion ?? ''}</strong></div>
          <div><span>test / language</span><strong className="mono">{avatarStatus.lipSync.testId ?? '—'} / {avatarStatus.lipSync.language ?? '—'}</strong></div>
        </div>
        <div className="lip-sync-weights" aria-label="Current VRM mouth weights">
          {Object.entries(avatarStatus.lipSync.weights).map(([mouth, weight]) => (
            <div key={mouth}><span className="mono">{mouth}</span><strong>{weight.toFixed(2)}</strong><meter min="0" max="1" value={weight} aria-label={`${mouth} weight`} /></div>
          ))}
        </div>
        <div className="sub-control">
          <span className="control-label">Interpolation: <span className="mono">{avatarStatus.lipSync.interpolationMs} ms</span></span>
          <input id="lipsync-interpolation" type="range" min="0" max="1000" step="10" value={avatarStatus.lipSync.interpolationMs} onChange={(event) => send(api, { type: 'lipsync-set-interpolation', milliseconds: Number(event.target.value) })} />
          <div className="button-row wrap interpolation-presets">
            {[0, 40, 70, 100].map((milliseconds) => <button type="button" className={avatarStatus.lipSync.interpolationMs === milliseconds ? '' : 'secondary-button'} key={milliseconds} onClick={() => send(api, { type: 'lipsync-set-interpolation', milliseconds })}>{milliseconds} ms</button>)}
          </div>
        </div>
        <div className="lip-sync-validation" aria-label="Lip sync validation summary">
          <div><span>frames / cues</span><strong>{avatarStatus.lipSync.validation.frameCount} / {avatarStatus.lipSync.validation.cueCount}</strong></div>
          <div><span>latency p50 / p95 / max</span><strong>{avatarStatus.lipSync.validation.cueLatencyP50Ms ?? '—'} / {avatarStatus.lipSync.validation.cueLatencyP95Ms ?? '—'} / {avatarStatus.lipSync.validation.cueLatencyMaxMs ?? '—'} ms</strong></div>
          <div><span>end / cumulative drift</span><strong>{avatarStatus.lipSync.validation.endDriftMs ?? '—'} / {avatarStatus.lipSync.validation.cumulativeDriftMs} ms</strong></div>
          <div><span>refresh / dropped / late</span><strong>{avatarStatus.lipSync.validation.displayRefreshEstimateHz ?? '—'} Hz / {avatarStatus.lipSync.validation.droppedFrameCount} / {avatarStatus.lipSync.validation.lateFrameCount}</strong></div>
          <div><span>invalid / stuck / missing</span><strong>{avatarStatus.lipSync.validation.invalidWeightCount} / {avatarStatus.lipSync.validation.mouthStuckEventCount} / {avatarStatus.lipSync.validation.missingExpressionCount}</strong></div>
          <div><span>mouth distribution</span><strong className="mono">{Object.entries(avatarStatus.lipSync.validation.mouthDistribution).map(([mouth, count]) => `${mouth}:${count}`).join(' ')}</strong></div>
        </div>
        <p className={avatarStatus.lipSync.state === 'error' ? 'error-text' : 'hint'} role="status">{avatarStatus.lipSync.message}</p>
      </section>

      <section className="panel-section" aria-labelledby="model-heading">
        <div className="section-heading">
          <h2 id="model-heading">Model</h2>
          <span className="mono">{avatarStatus.model?.format ?? 'no model'}</span>
        </div>
        <div className="model-summary" aria-live="polite">
          <strong>{avatarStatus.model?.metaName || avatarStatus.model?.fileName || 'No VRM loaded'}</strong>
          <span>{avatarStatus.model ? `${avatarStatus.model.humanoidBones.length} humanoid bones · ${avatarStatus.model.expressions.length} expressions · ${avatarStatus.motions.length} motions · mouth override: ${avatarStatus.model.mouthOverride}` : 'Load a VRM file to inspect it.'}</span>
        </div>
        <div className="capability-grid">
          {Object.entries(CAPABILITY_LABELS).map(([key, label]) => {
            const value = avatarStatus.model?.capabilities[key as Capability] ?? 'unsupported';
            return <span className={`capability capability-${value}`} key={key}>{label}: {value}</span>;
          })}
        </div>
      </section>

      <section className="panel-section" aria-labelledby="expression-heading">
        <div className="section-heading">
          <h2 id="expression-heading">Expressions</h2>
          <button type="button" className="text-button" onClick={() => send(api, { type: 'reset-expressions' })}>Reset all</button>
        </div>
        <div className="expression-list">
          {avatarStatus.model?.expressions.map((expression, index) => (
            <div className="expression-row" key={`${expression.kind}-${expression.name}`}>
              <label htmlFor={`expression-range-${index}`} title={expressionTitle(expression)}>{expression.name}</label>
              <input
                id={`expression-range-${index}`}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={expression.value}
                disabled={!expression.supported}
                onChange={(event) => changeExpression(expression, Number(event.target.value))}
              />
              <input
                aria-label={`${expression.name} numeric value`}
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={expression.value}
                disabled={!expression.supported}
                onChange={(event) => changeExpression(expression, Math.min(1, Math.max(0, Number(event.target.value))))}
              />
            </div>
          )) ?? <p className="hint">Expressions appear here after a VRM 1.0 model loads.</p>}
        </div>
        <div className="sub-control">
          <span className="control-label">Manual mouth presets</span>
          <div className="button-row wrap">
            {MOUTH_PRESETS.map((name) => (
              <button type="button" className="small-button" key={name} onClick={() => send(api, { type: 'set-expression', name, value: 1 })}>{name}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-section" aria-labelledby="behavior-heading">
        <div className="section-heading"><h2 id="behavior-heading">Behavior</h2><span className="mono">runtime controls</span></div>
        <div className="toggle-grid">
          <label className="toggle-control" htmlFor="auto-blink">
            <input id="auto-blink" type="checkbox" checked={avatarStatus.autoBlink} onChange={(event) => send(api, { type: 'set-auto-blink', enabled: event.target.checked })} />
            <span>Auto Blink</span>
          </label>
          <label className="toggle-control" htmlFor="look-at">
            <input id="look-at" type="checkbox" checked={avatarStatus.lookAt} onChange={(event) => send(api, { type: 'set-look-at', enabled: event.target.checked })} />
            <span>LookAt</span>
          </label>
        </div>
        <button type="button" onClick={() => send(api, { type: 'blink' })}>Manual blink</button>
      </section>

      <section className="panel-section" aria-labelledby="motion-heading">
        <div className="section-heading"><h2 id="motion-heading">VRMA behavior</h2><span className="mono">{motionState}</span></div>
        <div className="behavior-grid">
          <label className="wide-label" htmlFor="idle-motion-select">Idle motion
            <select id="idle-motion-select" value={idleSelection} onChange={(event) => setIdleSelection(event.target.value)}>
              <option value="">No idle configured</option>
              {avatarStatus.motions.map((motion) => <option value={motion.id} key={`idle-${motion.id}`}>{motion.fileName} ({motion.duration.toFixed(2)}s)</option>)}
            </select>
          </label>
          <div className="button-row wrap">
            <button id="set-idle-motion" type="button" className="secondary-button" disabled={!idleSelection} onClick={() => send(api, { type: 'set-idle-motion', motionId: idleSelection })}>Set as Idle</button>
            <button id="start-idle" type="button" onClick={() => send(api, { type: 'start-idle' })}>Start / Restart Idle</button>
          </div>
        </div>
        <div className="gesture-list" aria-label="Available gestures">
          <span className="control-label">Gestures</span>
          {avatarStatus.motions.filter((motion) => motion.id !== avatarStatus.idleMotionId).map((motion) => (
            <div className="gesture-row" key={`gesture-${motion.id}`}>
              <span>{motion.fileName} <span className="mono">({motion.duration.toFixed(2)}s)</span></span>
              <button type="button" className="small-button" onClick={() => send(api, { type: 'play-gesture', motionId: motion.id })}>Play Gesture</button>
            </div>
          ))}
          {avatarStatus.motions.length === 0 && <p className="hint">Gestures appear after bundled or local VRMA assets load.</p>}
        </div>
        <p className="hint">Motion state: <span className="mono">{motionState}</span> · current: <span className="mono">{activeMotion?.fileName ?? 'rest pose'}</span> · idle: <span className="mono">{avatarStatus.motions.find((motion) => motion.id === avatarStatus.idleMotionId)?.fileName ?? 'none'}</span></p>
        <div className="section-heading motion-tools-heading"><h2>Technical motion controls</h2><span className="mono">AnimationMixer</span></div>
        <label className="wide-label" htmlFor="motion-select">Motion
          <select id="motion-select" value={avatarStatus.activeMotionId ?? ''} onChange={(event) => send(api, { type: 'set-motion', motionId: event.target.value })}>
            <option value="">No motion selected</option>
            {avatarStatus.motions.map((motion) => <option value={motion.id} key={motion.id}>{motion.fileName} ({motion.duration.toFixed(2)}s)</option>)}
          </select>
        </label>
        <div className="button-row wrap">
          <button type="button" onClick={() => send(api, { type: 'motion-play' })}>Play</button>
          <button type="button" className="secondary-button" onClick={() => send(api, { type: 'motion-pause' })}>Pause</button>
          <button id="stop-all-motion" type="button" className="secondary-button" onClick={() => send(api, { type: 'motion-stop' })}>Stop all motion</button>
          <label className="inline-toggle" htmlFor="motion-loop"><input id="motion-loop" type="checkbox" checked={avatarStatus.loop} onChange={(event) => send(api, { type: 'motion-set-loop', enabled: event.target.checked })} /> Loop</label>
        </div>
        <div className="speed-row">
          <label htmlFor="motion-speed">Speed</label>
          <input id="motion-speed" type="range" min="0.1" max="2" step="0.1" value={avatarStatus.speed} onChange={(event) => send(api, { type: 'motion-set-speed', speed: Number(event.target.value) })} />
          <input aria-label="Motion speed numeric value" type="number" min="0.1" max="2" step="0.1" value={avatarStatus.speed} onChange={(event) => send(api, { type: 'motion-set-speed', speed: Number(event.target.value) })} />
        </div>
      </section>

      <section className="status-section" aria-labelledby="status-heading">
        <div className="section-heading"><h2 id="status-heading">Status / errors</h2><span className="mono">playback: {avatarStatus.playback}</span></div>
        <p className={avatarStatus.phase === 'error' ? 'error-text' : 'status-text'} role="status">{avatarStatus.message}</p>
        <p className="hint">Character feet position: <span className="mono">{avatarStatus.characterPosition.x.toFixed(2)}, {avatarStatus.characterPosition.y.toFixed(2)}</span> · normalized screen-space (0,0 = top-left) · Y anchors the feet · Arrow keys move the character · backend: <span className="mono">Xwayland</span></p>
      </section>
    </main>
  );
}
