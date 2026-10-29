export interface MeshSequenceManifest {
  version: 1;
  type: "volumetric-mesh-sequence";
  units: "meters";
  up: "+Y";
  front: "-Z";
  origin: "ground-center";
  fps: number;
  source: { kind: "human-capture" | "synthetic-calibration"; title: string; license: string };
  frames: string[];
}
export const VOLUME_LIMITS = { frames: 900, inputBytes: 48 * 1024 * 1024, decodedBytes: 48 * 1024 * 1024, trianglesPerFrame: 100000 } as const;
export function validateMeshSequence(value: unknown): MeshSequenceManifest {
  const v = value as MeshSequenceManifest;
  if (!v || v.version !== 1 || v.type !== "volumetric-mesh-sequence" || v.units !== "meters" || v.up !== "+Y" || v.front !== "-Z" || v.origin !== "ground-center") throw new Error("3D 시퀀스는 v1, 미터, Y-up, 정면 -Z, 발 접지 원점을 명시해야 합니다.");
  if (!Number.isFinite(v.fps) || v.fps < 1 || v.fps > 30 || !Array.isArray(v.frames) || v.frames.length < 2 || v.frames.length > VOLUME_LIMITS.frames) throw new Error("3D 시퀀스는 1~30fps, 2~900 프레임이 필요합니다.");
  if (!v.source || !["human-capture", "synthetic-calibration"].includes(v.source.kind) || typeof v.source.title !== "string" || !v.source.title.trim() || typeof v.source.license !== "string" || !v.source.license.trim()) throw new Error("실사 캡처/검증 도형 구분과 출처·이용 조건을 명시하세요.");
  for (const path of v.frames) if (typeof path !== "string" || !/\.glb$/i.test(path) || /(^\/|\\|:|[?#]|(^|\/)\.\.?($|\/))/.test(path)) throw new Error("프레임은 같은 묶음 안의 상대 GLB 경로여야 합니다.");
  return v;
}
export function sequenceFrame(time: number, fps: number, frames: number, loop: boolean): number {
  const n = Math.max(0, Math.floor(time * fps + 1e-7));
  return loop ? n % frames : Math.min(frames - 1, n);
}
