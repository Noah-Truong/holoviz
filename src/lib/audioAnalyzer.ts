export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dataArray: any = null;
  private bufferLength: number = 0;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private audioBuffer: AudioBuffer | null = null;
  public duration: number = 0;

  private async initContext(): Promise<void> {
    this.stop();
    if (this.audioContext) {
      await this.audioContext.close();
    }
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.82;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1;
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  async loadFile(file: File): Promise<void> {
    await this.initContext();
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    this.duration = this.audioBuffer.duration;
    this.pauseOffset = 0;
  }

  async loadArrayBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
    await this.initContext();
    this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    this.duration = this.audioBuffer.duration;
    this.pauseOffset = 0;
  }

  async loadUrl(url: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    const buffer = await res.arrayBuffer();
    await this.loadArrayBuffer(buffer);
  }

  play(): void {
    if (!this.audioContext || !this.analyser || !this.audioBuffer) return;
    if (this.isPlaying) return;

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.analyser);
    this.source.start(0, this.pauseOffset);
    this.startTime = this.audioContext.currentTime - this.pauseOffset;
    this.isPlaying = true;

    this.source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pauseOffset = 0;
      }
    };
  }

  pause(): void {
    if (!this.isPlaying || !this.audioContext || !this.source) return;
    this.pauseOffset = this.audioContext.currentTime - this.startTime;
    this.source.stop();
    this.isPlaying = false;
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source = null;
    }
    this.isPlaying = false;
    this.pauseOffset = 0;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser || !this.dataArray) return new Uint8Array(256);
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray as Uint8Array;
  }

  getCurrentTime(): number {
    if (!this.audioContext) return 0;
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pauseOffset;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  setVolume(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  destroy(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.gainNode = null;
    this.dataArray = null;
    this.audioBuffer = null;
  }
}
