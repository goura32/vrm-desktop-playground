export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowStateSnapshot {
  avatar: WindowBounds;
  debug: WindowBounds;
  alwaysOnTop: boolean;
}

export function createInitialWindowState(): WindowStateSnapshot {
  return {
    avatar: { x: 0, y: 0, width: 0, height: 0 },
    debug: { x: 720, y: 80, width: 420, height: 720 },
    alwaysOnTop: true,
  };
}
