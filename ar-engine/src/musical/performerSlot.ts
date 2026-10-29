import * as THREE from "three";
import { VideoPerformer } from "./performer";
import { MeshSequencePerformer, type FrameReader } from "./meshSequence";
import type { ActorConfig, PerformerRenderer, VideoMode } from "./types";

/** Stable building-local object: changing renderer never changes placement/calibration. */
export class PerformerSlot implements PerformerRenderer {
  readonly group = new THREE.Group();
  private readonly plane: VideoPerformer;
  private volume?: MeshSequencePerformer;
  private current: PerformerRenderer;
  private generation = 0;
  private busy = false;
  private disposed = false;
  constructor(readonly config: ActorConfig, onError: (message: string) => void) {
    this.group.name = `PERFORMER_${config.id}`;
    this.plane = new VideoPerformer(config, onError);
    this.plane.group.position.set(0, 0, 0); this.plane.group.rotation.set(0, 0, 0); this.plane.group.scale.setScalar(1);
    this.current = this.plane; this.group.add(this.plane.group); this.applyTransform();
  }
  get video(): HTMLVideoElement { return this.plane.video; }
  get representation(): PerformerRenderer["representation"] { return this.current.representation; }
  get contentKind(): PerformerRenderer["contentKind"] { return this.current.contentKind; }
  get loaded(): boolean { return !this.disposed && !this.busy && this.current.loaded; }
  get frameIndex(): number | null { return this.current === this.volume ? this.volume!.currentFrame : null; }
  get frameCount(): number | null { return this.current === this.volume ? this.volume!.frameCount : null; }
  applyTransform(): void { this.group.position.fromArray(this.config.position); this.group.rotation.set(...this.config.rotation); this.group.scale.setScalar(1); }
  async load(file: File, mode: VideoMode): Promise<void> {
    const generation = ++this.generation; this.busy = true; this.pause();
    try {
      await this.plane.load(file, mode);
      if (this.disposed || generation !== this.generation) return;
      this.volume?.group.removeFromParent(); this.volume?.dispose(); this.volume = undefined;
      this.current = this.plane; this.plane.group.visible = true;
    } finally { if (generation === this.generation) this.busy = false; }
  }
  async loadSequence(manifest: unknown, read: FrameReader): Promise<void> {
    const generation = ++this.generation; this.busy = true; this.pause();
    try {
      const next = await MeshSequencePerformer.load(this.config, manifest, read, () => this.disposed || generation !== this.generation);
      if (this.disposed || generation !== this.generation) { next.dispose(); return; }
      this.volume?.group.removeFromParent(); this.volume?.dispose(); this.volume = next;
      this.plane.pause(); this.plane.group.visible = false; this.current = next; this.group.add(next.group);
    } finally { if (generation === this.generation) this.busy = false; }
  }
  async loadSequenceFiles(files: FileList | File[]): Promise<void> {
    const list = Array.from(files), manifests = list.filter(f => /\.vseq\.json$/i.test(f.name));
    if (manifests.length !== 1) throw new Error(".vseq.json 한 개와 해당 GLB 프레임들을 함께 선택하세요.");
    const map = new Map<string, File>();
    for (const file of list) { if (map.has(file.name)) throw new Error("같은 이름의 프레임 파일이 중복됐습니다."); map.set(file.name, file); if (file.webkitRelativePath) map.set(file.webkitRelativePath, file); }
    await this.loadSequence(JSON.parse(await manifests[0].text()), async path => {
      const file = map.get(path); if (!file) throw new Error(`3D 프레임 누락: ${path}`); return file.arrayBuffer();
    });
  }
  prime(): Promise<void> { return this.current.prime(); }
  sample(time: number, playing: boolean): void { this.current.sample(time, playing); }
  pause(): void { this.current.pause(); }
  dispose(): void { this.disposed = true; this.generation++; this.plane.dispose(); this.volume?.dispose(); this.group.clear(); }
}
