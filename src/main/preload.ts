import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { AvatarCommand, AvatarStatus, FilePayload, VrmDesktopApi } from '../shared/types';
import type { WindowStateSnapshot } from '../shared/windowState';

const api: VrmDesktopApi = {
  getWindowState: () => ipcRenderer.invoke(IPC_CHANNELS.getWindowState),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.setAlwaysOnTop, enabled),
  openVrmDialog: () => ipcRenderer.invoke(IPC_CHANNELS.openVrmDialog),
  openVrmaDialog: () => ipcRenderer.invoke(IPC_CHANNELS.openVrmaDialog),
  loadVrmFile: (file: FilePayload) => ipcRenderer.invoke(IPC_CHANNELS.loadVrmFile, file),
  loadVrmaFile: (file: FilePayload) => ipcRenderer.invoke(IPC_CHANNELS.loadVrmaFile, file),
  loadBundledAsset: (kind) => ipcRenderer.invoke(IPC_CHANNELS.loadBundledAsset, kind),
  onWindowState: (listener) => {
    const handler = (_event: IpcRendererEvent, state: WindowStateSnapshot) => listener(state);
    ipcRenderer.on(IPC_CHANNELS.windowState, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.windowState, handler);
  },
  onAvatarStatus: (listener) => {
    const handler = (_event: IpcRendererEvent, status: AvatarStatus) => listener(status);
    ipcRenderer.on(IPC_CHANNELS.avatarStatus, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.avatarStatus, handler);
  },
  onAvatarCommand: (listener) => {
    const handler = (_event: IpcRendererEvent, command: AvatarCommand) => listener(command);
    ipcRenderer.on(IPC_CHANNELS.sendAvatarCommand, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.sendAvatarCommand, handler);
  },
  reportAvatarStatus: (status: AvatarStatus) => {
    ipcRenderer.send(IPC_CHANNELS.avatarStatus, status);
  },
  sendAvatarCommand: (command: AvatarCommand) => {
    ipcRenderer.send(IPC_CHANNELS.sendAvatarCommand, command);
  },
};

contextBridge.exposeInMainWorld('vrmDesktop', api);
