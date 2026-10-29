export interface Update { type: "updateMatrix" | "processDone"; targetIndex?: number; worldMatrix?: number[] | null }
export class Compiler {
  compileImageTargets(images: Array<HTMLImageElement | HTMLCanvasElement>, onProgress: (percent: number) => void): Promise<unknown>;
  exportData(): Uint8Array;
}
export class Controller {
  constructor(options: { inputWidth: number; inputHeight: number; maxTrack: number; onUpdate: (data: Update) => void; warmupTolerance: number; missTolerance: number; filterMinCF: number; filterBeta: number });
  addImageTargets(url: string): Promise<{ dimensions: [number, number][] }>;
  addImageTargetsFromBuffer(data: ArrayBuffer): { dimensions: [number, number][] };
  getProjectionMatrix(): number[];
  dummyRun(video: HTMLVideoElement): Promise<void>;
  processVideo(video: HTMLVideoElement): void;
  stopProcessVideo(): void;
  dispose(): void;
  worker: Worker;
}
