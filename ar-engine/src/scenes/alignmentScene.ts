// 04-B 건물 정합 시험 — Codex `alignment_test_facade` 소비.
// 정적 외벽 + 레이어(기준벽/격자/마커/오버레이/기준점)를 개별 토글.
// 수동 보정(위치·회전·크기)은 PlacementGroup이 담당하고, 이 컨트롤러는 레이어 가시성만 관리.
import * as THREE from "three";
import type { LoadedModel } from "../loaders/gltf";
import type { StandaloneAssetManifest, LayerDef, ReferencePoint } from "../loaders/manifest";

export interface LayerState {
  node: string;
  visible: boolean;
}

export class AlignmentScene {
  readonly object: THREE.Object3D;
  readonly layers: LayerDef[];
  readonly referencePoints: ReferencePoint[];
  private layerNodes = new Map<string, THREE.Object3D>();

  constructor(model: LoadedModel, manifest: StandaloneAssetManifest) {
    this.object = model.root;
    this.layers = manifest.layers ?? [];
    this.referencePoints = manifest.calibration?.reference_points ?? [];

    for (const layer of this.layers) {
      const node = this.object.getObjectByName(layer.node);
      if (node) {
        this.layerNodes.set(layer.node, node);
        node.visible = layer.default_visible; // 매니페스트 기본 가시성
      } else {
        console.warn(`[ar-engine] 정합 레이어 노드 없음: ${layer.node}`);
      }
    }
    this.object.visible = true;
  }

  setLayerVisible(node: string, visible: boolean): void {
    const n = this.layerNodes.get(node);
    if (n) n.visible = visible;
  }

  getLayerStates(): LayerState[] {
    return this.layers.map((l) => ({
      node: l.node,
      visible: this.layerNodes.get(l.node)?.visible ?? false,
    }));
  }

  /**
   * 실제 카메라 위 합성 모드 토글.
   * on=true → 각 레이어의 real_building_mode_visible 적용(REFERENCE_Facade 숨김 등).
   * on=false → default_visible 복귀(시험물 단독 관찰).
   */
  applyRealBuildingMode(on: boolean): void {
    for (const layer of this.layers) {
      const n = this.layerNodes.get(layer.node);
      if (n) n.visible = on ? layer.real_building_mode_visible : layer.default_visible;
    }
  }

  dispose(): void {
    this.layerNodes.clear();
  }
}
