import type { LipSyncStatus } from './lipsync';
import type { WindowStateSnapshot } from './windowState';
import type { BundledAssetId } from './bundledAssets';

export type Capability =
  | 'humanoid'
  | 'presetExpressions'
  | 'customExpressions'
  | 'blink'
  | 'lookAt'
  | 'springBone'
  | 'vrma';

export type CapabilityStatus = 'available' | 'unsupported';
export type VrmMouthOverride = 'none' | 'blend' | 'block' | 'unknown';

export interface ExpressionInfo {
  name: string;
  kind: 'preset' | 'custom';
  value: number;
  supported: boolean;
}

export interface VrmModelInfo {
  fileName: string;
  format: 'VRM 1.0' | 'VRM 0.x' | 'unknown';
  metaName: string;
  humanoidBones: string[];
  expressions: ExpressionInfo[];
  capabilities: Record<Capability, CapabilityStatus>;
  mouthOverride: VrmMouthOverride;
}

export interface MotionInfo {
  id: string;
  fileName: string;
  duration: number;
}

export type AvatarPhase = 'idle' | 'loading' | 'ready' | 'error';
export type MotionPlayback = 'stopped' | 'playing' | 'paused';
export type MotionMode = 'idle' | 'gesture' | 'stopped';

export interface CharacterPosition {
  x: number;
  y: number;
}

export type CharacterMoveDirection = 'up' | 'down' | 'left' | 'right';

export interface AvatarStatus {
  phase: AvatarPhase;
  message: string;
  model: VrmModelInfo | null;
  motions: MotionInfo[];
  activeMotionId: string | null;
  idleMotionId: string | null;
  idleAutoStartSuppressed: boolean;
  motionMode: MotionMode;
  playback: MotionPlayback;
  loop: boolean;
  speed: number;
  autoBlink: boolean;
  manualBlink: boolean;
  lookAt: boolean;
  characterPosition: CharacterPosition;
  lipSync: LipSyncStatus;
}

export interface FilePayload {
  name: string;
  data: ArrayBuffer;
}

export type AvatarCommand =
  | { type: 'load-vrm'; file: FilePayload }
  | { type: 'load-vrma'; file: FilePayload }
  | { type: 'load-audio'; file: FilePayload }
  | { type: 'load-lipsync-timeline'; file: FilePayload }
  | { type: 'lipsync-play' }
  | { type: 'lipsync-pause' }
  | { type: 'lipsync-resume' }
  | { type: 'lipsync-stop' }
  | { type: 'lipsync-set-interpolation'; milliseconds: number }
  | { type: 'set-expression'; name: string; value: number }
  | { type: 'reset-expressions' }
  | { type: 'set-auto-blink'; enabled: boolean }
  | { type: 'blink' }
  | { type: 'set-look-at'; enabled: boolean }
  | { type: 'set-motion'; motionId: string }
  | { type: 'set-idle-motion'; motionId: string }
  | { type: 'start-idle' }
  | { type: 'play-gesture'; motionId: string }
  | { type: 'motion-play' }
  | { type: 'motion-pause' }
  | { type: 'motion-stop' }
  | { type: 'motion-set-loop'; enabled: boolean }
  | { type: 'motion-set-speed'; speed: number }
  | { type: 'set-character-position'; position: CharacterPosition }
  | { type: 'move-character'; direction: CharacterMoveDirection; step: number };

export interface VrmDesktopApi {
  getWindowState(): Promise<WindowStateSnapshot>;
  setAlwaysOnTop(enabled: boolean): Promise<WindowStateSnapshot>;
  openVrmDialog(): Promise<boolean>;
  openVrmaDialog(): Promise<boolean>;
  openAudioDialog(): Promise<boolean>;
  openLipSyncTimelineDialog(): Promise<boolean>;
  loadVrmFile(file: FilePayload): Promise<boolean>;
  loadVrmaFile(file: FilePayload): Promise<boolean>;
  loadAudioFile(file: FilePayload): Promise<boolean>;
  loadLipSyncTimelineFile(file: FilePayload): Promise<boolean>;
  loadBundledAsset(assetId: BundledAssetId): Promise<boolean>;
  onWindowState(listener: (state: WindowStateSnapshot) => void): () => void;
  onAvatarStatus(listener: (status: AvatarStatus) => void): () => void;
  onAvatarCommand(listener: (command: AvatarCommand) => void): () => void;
  reportAvatarStatus(status: AvatarStatus): void;
  sendAvatarCommand(command: AvatarCommand): void;
}

declare global {
  interface Window {
    vrmDesktop: VrmDesktopApi;
  }
}
