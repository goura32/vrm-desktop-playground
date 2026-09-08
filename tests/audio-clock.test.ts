import { describe, expect, it, afterEach } from 'vitest';
import { AudioClock } from '../src/renderer/avatar/lipsync/AudioClock';

class FakeBufferSource {
  public buffer: { duration: number } | null = null;
  public onended: (() => void) | null = null;
  public startedOffset: number | null = null;

  public connect(): this {
    return this;
  }

  public start(_when: number, offset: number): void {
    this.startedOffset = offset;
  }

  public stop(): void {
    this.onended?.();
  }
}

class FakeAudioContext {
  public static last: FakeAudioContext | null = null;
  public currentTime = 0;
  public readonly destination = {};
  public readonly sources: FakeBufferSource[] = [];

  public constructor() {
    FakeAudioContext.last = this;
  }

  public async decodeAudioData(data: ArrayBuffer): Promise<{ duration: number }> {
    return { duration: data.byteLength / 10 };
  }

  public createBufferSource(): FakeBufferSource {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source;
  }

  public async resume(): Promise<void> {}
  public async close(): Promise<void> {}
}

describe('AudioClock', () => {
  const originalAudioContext = globalThis.AudioContext;

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    FakeAudioContext.last = null;
  });

  it('loads audio, pauses by offset, and restarts a completed buffer from zero', async () => {
    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const clock = new AudioClock();
    expect(await clock.load(new ArrayBuffer(20))).toBe(2);
    expect(clock.duration).toBe(2);

    expect(clock.play()).toBe(true);
    const context = FakeAudioContext.last;
    expect(context).not.toBeNull();
    context!.currentTime = 0.75;
    expect(clock.currentTime).toBe(0.75);
    expect(clock.pause()).toBe(true);
    expect(clock.currentTime).toBe(0.75);

    expect(clock.play()).toBe(true);
    clock.stop();
    expect(clock.play()).toBe(true);
    expect(context!.sources.at(-1)?.startedOffset).toBe(0);
    await clock.dispose();
  });
});
