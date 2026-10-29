// GLB 로더 + 애니메이션 레지스트리.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface LoadedModel {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export async function loadGLB(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<LoadedModel> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url, (e) => {
    // ProgressEvent.total이 0이면 길이 미상(Content-Length 없음).
    onProgress?.(e.loaded, e.total ?? 0);
  });
  return { root: gltf.scene, animations: gltf.animations };
}

export function findClip(
  clips: THREE.AnimationClip[],
  name: string
): THREE.AnimationClip | undefined {
  return THREE.AnimationClip.findByName(clips, name) ?? clips.find((c) => c.name === name);
}

/**
 * 네이밍 규약 불일치에 견고한 클립 탐색.
 * Codex 에셋은 `Emerge`/`Idle`/`Disappear`를 사용하고, 계약 초안은 `AR_` 접두사를
 * 제안했다. 어느 쪽이든 동작하도록 `AR_` 접두사 제거 + 대소문자 무시로 비교한다.
 * (에셋을 수정하지 않고 엔진에서 호환 — 작업 지시 #4)
 */
export function findClipLoose(
  clips: THREE.AnimationClip[],
  canonical: string
): THREE.AnimationClip | undefined {
  const norm = (s: string) => s.replace(/^ar[_-]?/i, "").toLowerCase();
  const target = norm(canonical);
  return clips.find((c) => norm(c.name) === target);
}
