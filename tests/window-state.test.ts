import { describe, expect, it } from 'vitest';
import { createInitialWindowState } from '../src/shared/windowState';

describe('window state', () => {
  it('uses a display-derived avatar fallback instead of fixed small-window dimensions', () => {
    const state = createInitialWindowState();

    expect(state.avatar).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(state.avatar.width).not.toBe(600);
    expect(state.avatar.height).not.toBe(800);
    expect(state.debug.width).toBe(420);
    expect(state.debug.height).toBe(720);
    expect(state.alwaysOnTop).toBe(true);
  });

  it('does not expose click-through or BrowserWindow movement state', () => {
    const state = createInitialWindowState();
    expect('clickThrough' in state).toBe(false);
    expect('interactionMode' in state).toBe(false);
    expect('moveStep' in state).toBe(false);
  });
});
