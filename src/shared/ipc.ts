import type { AvatarCommand, AvatarStatus, FilePayload } from './types';
import type { WindowStateSnapshot } from './windowState';

export const IPC_CHANNELS = {
  getWindowState: 'window:get-state',
  setAlwaysOnTop: 'window:set-always-on-top',
  openVrmDialog: 'dialog:open-vrm',
  openVrmaDialog: 'dialog:open-vrma',
  openAudioDialog: 'dialog:open-audio',
  openLipSyncTimelineDialog: 'dialog:open-lipsync-timeline',
  loadVrmFile: 'file:load-vrm',
  loadVrmaFile: 'file:load-vrma',
  loadAudioFile: 'file:load-audio',
  loadLipSyncTimelineFile: 'file:load-lipsync-timeline',
  loadBundledAsset: 'file:load-bundled-asset',
  sendAvatarCommand: 'avatar:command',
  avatarStatus: 'avatar:status',
  windowState: 'window:state',
} as const;

export type WindowStateListener = (state: WindowStateSnapshot) => void;
export type AvatarStatusListener = (status: AvatarStatus) => void;
export type FileLoader = (file: FilePayload) => Promise<boolean>;
export type AvatarCommandSender = (command: AvatarCommand) => void;
