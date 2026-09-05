import { describe, expect, it } from 'vitest';
import { getElectronPlatformSwitches } from '../src/main/platform/linux';

describe('Linux Electron launch', () => {
  it('uses X11 through Xwayland on Linux', () => {
    expect(getElectronPlatformSwitches('linux')).toEqual(['--ozone-platform=x11']);
  });

  it('does not force a Linux switch on other platforms', () => {
    expect(getElectronPlatformSwitches('darwin')).toEqual([]);
    expect(getElectronPlatformSwitches('win32')).toEqual([]);
  });
});
