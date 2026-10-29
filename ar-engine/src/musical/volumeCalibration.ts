import manifestUrl from "../../musical-assets/volume-calibration/calibration.vseq.json?url";
import type { PerformerSlot } from "./performerSlot";
const urls = import.meta.glob<string>("../../musical-assets/volume-calibration/frame-*.glb", { eager: true, query: "?url", import: "default" });
export async function loadVolumeCalibration(actors: PerformerSlot[]): Promise<void> {
  const response = await fetch(manifestUrl); if (!response.ok) throw new Error("3D 검증 시퀀스 매니페스트를 읽지 못했습니다.");
  const manifest: unknown = await response.json();
  const byName = new Map(Object.entries(urls).map(([path, url]) => [path.split("/").pop()!, url]));
  await Promise.all(actors.map(actor => actor.loadSequence(manifest, async path => {
    const url = byName.get(path); if (!url) throw new Error(`3D 검증 프레임 누락: ${path}`);
    const frame = await fetch(url); if (!frame.ok) throw new Error(`3D 프레임 로드 실패: ${path}`); return frame.arrayBuffer();
  })));
}
