import { afterEach, describe, expect, it } from 'vitest';
import { AudioClock } from '../src/renderer/avatar/lipsync/AudioClock';

class FailureSource {
  public buffer: { duration: number } | null = null;
  public onended: (() => void) | null = null;
  public connect(): this { return this; }
  public start(): void {}
  public stop(): void { this.onended?.(); }
}

class FailureAudioContext {
  public static current: FailureAudioContext | null = null;
  public readonly destination = {};
  public currentTime = 0;
  public failDecode = false;
  public pendingDecode: Promise<{ duration: number }> | null = null;
  public resolvePending: ((value: { duration: number }) => void) | null = null;

  public constructor() {
    FailureAudioContext.current = this;
  }

  public decodeAudioData(data: ArrayBuffer): Promise<{ duration: number }> {
    if (this.failDecode) {
      return Promise.reject(new Error('decode failed'));
    }
    if (data.byteLength === 30) {
      this.pendingDecode = new Promise((resolve) => {
        this.resolvePending = resolve;
      });
      return this.pendingDecode;
    }
    return Promise.resolve({ duration: data.byteLength / 10 });
  }

  public createBufferSource(): FailureSource {
    return new FailureSource();
  }

  public async resume(): Promise<void> {}
  public async close(): Promise<void> {}
}

describe('AudioClock load invalidation', () => {
  const originalAudioContext = globalThis.AudioContext;

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    FailureAudioContext.current = null;
  });

  it('clears the previous buffer after a decode failure', async () => {
    globalThis.AudioContext = FailureAudioContext as unknown as typeof AudioContext;
    const clock = new AudioClock();
    expect(await clock.load(new ArrayBuffer(20))).toBe(2);
    FailureAudioContext.current!.failDecode = true;
    await expect(clock.load(new ArrayBuffer(40))).rejects.toThrow('decode failed');
    expect(clock.duration).toBe(0);
    expect(clock.play()).toBe(false);
    await clock.dispose();
  });

  it('does not play the previous buffer while a replacement is decoding', async () => {
    globalThis.AudioContext = FailureAudioContext as unknown as typeof AudioContext;
    const clock = new AudioClock();
    expect(await clock.load(new ArrayBuffer(20))).toBe(2);
    const pending = clock.load(new ArrayBuffer(30));
    await Promise.resolve();
    expect(clock.play()).toBe(false);
    FailureAudioContext.current!.resolvePending?.({ duration: 3 });
    await expect(pending).resolves.toBe(3);
    expect(clock.duration).toBe(3);
    await clock.dispose();
  });
});
