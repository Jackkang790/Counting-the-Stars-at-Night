// 04-A 빈 땅 · 작가 작품이 땅에서 솟아남 (three.js)
// TODO(작가): 실제 작품 3D 모델(glTF)을 받으면 GLTFLoader 로 교체. 지금은 자리표시 조형물.
import * as THREE from 'three';

export function buildArtwork() {
  const group = new THREE.Group();
  const piece = new THREE.Group();
  group.add(piece);

  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 32), mat('#3b3f52'));
  base.position.y = 0.04;
  piece.add(base);
  const colors = ['#f4c54a', '#e8e1cf', '#6d7bd6', '#f4c54a'];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.12 - i * 0.018, 0.03, 80, 10), mat(colors[i]));
    m.position.y = 0.22 + i * 0.2;
    m.rotation.y = i * 0.7;
    piece.add(m);
  }

  // 솟아오를 때 땅에서 튀는 별가루
  const N = 120;
  const pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.4;
    pts.set([Math.cos(a) * r, Math.random() * 1.2, Math.sin(a) * r], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff3c4', size: 0.02, transparent: true }));
  group.add(stars);

  piece.scale.set(1, 0.001, 1);
  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      const k = Math.min(t / 2.2, 1);
      const e = 1 - Math.pow(1 - k, 3);
      piece.scale.set(1, Math.max(e, 0.001), 1);
      piece.position.y = -0.4 * (1 - e);
      piece.rotation.y += dt * 0.3;
      stars.material.opacity = 0.4 + 0.6 * Math.abs(Math.sin(t * 2));
      stars.rotation.y -= dt * 0.15;
    },
  };
}
