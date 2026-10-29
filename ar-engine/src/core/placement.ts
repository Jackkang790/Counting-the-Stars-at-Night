// 배치 Group — Codex 인계 규약(blender/README.md, contracts/asset-spec.md §0) 준수.
// "GLB를 배치용 Group으로 감싸고, 그 Group에만 AR hit-test 위치·회전을 적용한다.
//  애니메이션 클립은 내부 Anchor의 로컬 TRS를 제어하므로 배치 변환과 분리된다."
import * as THREE from "three";

export class PlacementGroup {
  /** hit-test 변환이 적용되는 외곽 Group. 내부에 모델을 자식으로 둔다. */
  readonly group: THREE.Group;
  private placed = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    // 배치 전에는 숨김. 배치 시 reticle 포즈에서 보이게 한다.
  }

  /** 로드된 모델을 배치 Group의 자식으로 감싼다(재정규화/축보정 없음). */
  attach(model: THREE.Object3D, scale = 1): void {
    this.group.add(model);
    if (scale !== 1) this.group.scale.setScalar(scale);
  }

  /**
   * reticle 포즈 행렬을 배치 Group에 적용.
   * 바닥 배치에서는 수평 유지를 위해 yaw만 반영(기울어진 평면에서 기울지 않게).
   */
  placeAt(matrix: Float32Array | number[], keepUpright = true): void {
    const m = new THREE.Matrix4().fromArray(matrix as number[]);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    m.decompose(position, quaternion, scale);

    this.group.position.copy(position);
    if (keepUpright) {
      const euler = new THREE.Euler().setFromQuaternion(quaternion, "YXZ");
      this.group.rotation.set(0, euler.y, 0); // yaw만 유지
    } else {
      this.group.quaternion.copy(quaternion);
    }
    this.group.visible = true;
    this.placed = true;
  }

  get isPlaced(): boolean {
    return this.placed;
  }

  reset(): void {
    this.group.visible = false;
    this.placed = false;
  }
}
