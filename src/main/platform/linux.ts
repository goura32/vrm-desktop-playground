import type { WindowStateSnapshot } from '../../shared/windowState';

export function getElectronPlatformSwitches(platform: NodeJS.Platform): string[] {
  return platform === 'linux' ? ['--ozone-platform=x11'] : [];
}

export function isWaylandSession(environment: NodeJS.ProcessEnv): boolean {
  return environment.XDG_SESSION_TYPE === 'wayland' || Boolean(environment.WAYLAND_DISPLAY);
}

export function describeElectronBackend(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
): 'Xwayland' | 'native Wayland' | 'platform default' {
  if (platform === 'linux' && isWaylandSession(environment)) {
    return 'Xwayland';
  }
  if (platform === 'linux') {
    return 'platform default';
  }
  return 'platform default';
}

export function platformStateNote(state: WindowStateSnapshot): string {
  return state.effectiveClickThrough
    ? 'Click Through is active at the OS window level.'
    : 'Avatar accepts pointer input while Interaction Mode is active.';
}
