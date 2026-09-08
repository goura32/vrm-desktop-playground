export type AudioClockState = 'stopped' | 'playing' | 'paused';

export interface AudioClockLike {
  readonly currentTime: number;
  readonly duration: number;
  readonly state: AudioClockState;
  play(): boolean;
  pause(): boolean;
  stop(): boolean;
}

export class AudioClock implements AudioClockLike {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private generation = 0;
  private offset = 0;
  private startedAt = 0;
  private playbackState: AudioClockState = 'stopped';
  private loadingGeneration: number | null = null;

  private get audioContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }

  public get currentTime(): number {
    if (!this.buffer) {
      return 0;
    }
    if (this.playbackState === 'playing') {
      return Math.min(this.buffer.duration, Math.max(0, this.audioContext.currentTime - this.startedAt));
    }
    return Math.min(this.buffer.duration, Math.max(0, this.offset));
  }

  public get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  public get state(): AudioClockState {
    return this.playbackState;
  }

  public async load(data: ArrayBuffer): Promise<number> {
    this.generation += 1;
    const generation = this.generation;
    this.loadingGeneration = generation;
    this.stopSource();
    this.buffer = null;
    try {
      const decoded = await this.audioContext.decodeAudioData(data.slice(0));
      if (generation !== this.generation) {
        return 0;
      }
      this.buffer = decoded;
      this.offset = 0;
      this.playbackState = 'stopped';
      return decoded.duration;
    } finally {
      if (this.loadingGeneration === generation) {
        this.loadingGeneration = null;
      }
    }
  }

  public play(): boolean {
    if (this.loadingGeneration !== null || !this.buffer) {
      return false;
    }
    if (this.playbackState === 'playing') {
      return true;
    }
    this.offset = Math.min(this.offset, this.buffer.duration);
    if (this.offset >= this.buffer.duration) {
      this.offset = 0;
    }
    const context = this.audioContext;
    void context.resume();
    const source = context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(context.destination);
    const generation = this.generation;
    source.onended = () => {
      if (generation !== this.generation || this.source !== source) {
        return;
      }
      this.offset = this.buffer?.duration ?? 0;
      this.source = null;
      this.playbackState = 'stopped';
    };
    this.source = source;
    this.startedAt = context.currentTime - this.offset;
    this.playbackState = 'playing';
    source.start(0, this.offset);
    return true;
  }

  public pause(): boolean {
    if (!this.source || this.playbackState !== 'playing') {
      return false;
    }
    this.offset = this.currentTime;
    const source = this.source;
    this.source = null;
    this.playbackState = 'paused';
    try {
      source.stop();
    } catch {
      // The source may have ended between the clock read and stop call.
    }
    return true;
  }

  public stop(): boolean {
    const hadAudio = Boolean(this.buffer || this.source);
    this.generation += 1;
    this.loadingGeneration = null;
    this.stopSource();
    return hadAudio;
  }

  public async dispose(): Promise<void> {
    this.stop();
    this.buffer = null;
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  private stopSource(): void {
    const source = this.source;
    this.source = null;
    this.offset = 0;
    this.playbackState = 'stopped';
    if (source) {
      try {
        source.stop();
      } catch {
        // The source may already be stopped.
      }
    }
  }
}
