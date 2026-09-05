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

export function platformStateNote(): string {
  return 'Avatar follows Primary Display bounds and is always Click Through.';
}
