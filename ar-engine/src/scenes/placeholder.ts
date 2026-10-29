// 임시 모델 — Codex GLB를 로드할 수 없을 때의 폴백(프로토타입 개발용).
// Codex 규약(1m, Y-up, 접지 중심 원점, Y=0 지면)에 맞춘 간단한 "새싹" 형상.
// 애니메이션 클립은 포함하지 않으며, 등장/대기는 EmergingArtworkScene이 절차적으로 처리한다.
import * as THREE from "three";
import type { LoadedModel } from "../loaders/gltf";

export function buildPlaceholderArtwork(): LoadedModel {
  const root = new THREE.Group();
  root.name = "Placeholder_Anchor"; // *_Anchor 규약 모사

  // 받침대(지면 Y=0 위)
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.9, metalness: 0.1 })
  );
  plinth.position.y = 0.1;
  root.add(plinth);

  // 줄기/잎
  const stem = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 1.6, 20),
    new THREE.MeshStandardMaterial({ color: 0x3a6b4f, roughness: 0.6, metalness: 0.2 })
  );
  stem.position.y = 1.0;
  root.add(stem);

  // 별(자체 발광 — 야간 가독성)
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xfff2b0,
    emissive: 0xffd770,
    emissiveIntensity: 1.2,
    roughness: 0.3,
  });
  for (let i = 0; i < 5; i++) {
    const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), starMat);
    const a = (i / 5) * Math.PI * 2;
    star.position.set(Math.cos(a) * 0.3, 1.5 + Math.sin(a) * 0.2, Math.sin(a) * 0.3);
    root.add(star);
  }

  return { root, animations: [] };
}
