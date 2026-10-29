// 바닥 인식 레티클 — hit-test 결과 포즈를 따라 이동하는 조준 링.
import * as THREE from "three";

export class Reticle {
  readonly mesh: THREE.Mesh;

  constructor() {
    // 바닥에 눕는 링(기본은 XY 평면 → -90° 회전하여 XZ 평면에 눕힘).
    const geometry = new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.visible = false;
  }

  /** hit-test 포즈 행렬로 레티클 위치/방향 갱신. */
  updateFromMatrix(matrix: Float32Array | number[]): void {
    this.mesh.matrix.fromArray(matrix as number[]);
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  get visible(): boolean {
    return this.mesh.visible;
  }
}
