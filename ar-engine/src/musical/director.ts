import { cueAt } from "./timeline";
import type { ShowConfig, PlaybackState, PerformerRenderer } from "./types";

/** One audio clock for video synchronization and all stage effects. */
export class ShowDirector {
  state: PlaybackState = "ready";
  testMode = false;
  audioLabel = "합성 테스트 음악";
  private context?: AudioContext;
  private buffer?: AudioBuffer;
  private source?: AudioBufferSourceNode;
  private offset = 0;
  private startedAt = 0;
  private generation = 0;
  private preparing = false;
  constructor(readonly config: ShowConfig, private readonly actors: PerformerRenderer[], private readonly update: (time: number, state: PlaybackState) => void) {}
  get time(): number { return Math.min(this.config.duration, this.offset + (this.state === "playing" && this.context ? this.context.currentTime - this.startedAt : 0)); }
  private ensureAudio(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * this.config.duration), this.context.sampleRate);
      const data = this.buffer.getChannelData(0), notes = [220, 261.63, 329.63, 293.66];
      for (let i = 0; i < data.length; i++) {
        const t = i / this.context.sampleRate, beat = t % 0.5, f = notes[Math.floor(t / 0.5) % notes.length];
        const envelope = Math.min(1, beat / 0.015) * Math.exp(-beat * 8) * Math.min(1, (this.config.duration - t) / 2);
        data[i] = 0.09 * envelope * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t));
      }
    }
    return this.context;
  }
  async loadAudio(file: File): Promise<void> {
    this.pause(); const context = this.ensureAudio();
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    if (buffer.duration + 0.1 < this.config.duration) throw new Error(`음악은 ${this.config.duration}초 이상이어야 합니다.`);
    this.buffer = buffer; this.audioLabel = file.name;
  }
  async play(testMode: boolean): Promise<void> {
    if (!testMode && this.actors.some(a => !a.loaded)) throw new Error("두 배우의 실사 영상을 먼저 선택하세요. 카드 테스트는 별도 버튼을 사용하세요.");
    if (!testMode && this.actors.some(a => a.contentKind === "synthetic-calibration")) throw new Error("3D 검증 도형은 실사 공연자가 아닙니다. 기술 테스트 버튼을 사용하세요.");
    if (this.state === "playing" || this.preparing) return;
    this.preparing = true;
    const generation = ++this.generation, context = this.ensureAudio();
    // Invoke gated APIs during the user click, before awaiting either result.
    const resume = context.resume(), media = Promise.all(this.actors.map(a => a.prime()));
    try { await Promise.all([resume, media]); }
    catch (error) { if (generation !== this.generation) return; throw error; }
    finally { this.preparing = false; }
    if (generation !== this.generation) { this.actors.forEach(a => a.pause()); return; }
    if (context.state !== "running") throw new Error("음성 재생을 허용한 뒤 다시 시작하세요.");
    if (this.offset >= this.config.duration) this.offset = 0;
    this.testMode = testMode;
    this.source = context.createBufferSource(); this.source.buffer = this.buffer!; this.source.connect(context.destination);
    this.source.start(0, this.offset); this.startedAt = context.currentTime; this.state = "playing";
    this.tick();
  }
  pause(): void {
    this.generation++; this.offset = this.time; this.source?.stop(); this.source?.disconnect(); this.source = undefined;
    if (this.state === "playing") this.state = this.offset>=this.config.duration ? "completed" : "paused";
    this.actors.forEach(a => a.pause()); this.tick();
  }
  restart(): void { this.pause(); this.offset = 0; this.state = "ready"; this.tick(); }
  tick(): void {
    const time = this.time;
    if (this.state === "playing" && time >= this.config.duration) { this.offset = this.config.duration; this.state = "completed"; this.source?.stop(); this.source?.disconnect(); this.source = undefined; }
    this.actors.forEach(a => a.sample(time, this.state === "playing")); this.update(time, this.state);
  }
  get cue(): string { return cueAt(this.config, this.time).label; }
  dispose(): void { this.pause(); void this.context?.close(); this.context = undefined; }
}
