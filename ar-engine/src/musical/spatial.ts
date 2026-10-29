import * as THREE from "three";
import type { PerformerSlot } from "./performerSlot";

export function mountSpatialPerformer(stage: THREE.Group, anchors: Map<string, THREE.Vector3>, actor: PerformerSlot): void {
  const position = anchors.get(actor.config.anchor);
  if (!position) throw new Error(`건물 앵커 없음: ${actor.config.anchor}`);
  const anchor = new THREE.Group(); anchor.name = `ANCHOR_${actor.config.anchor}_${actor.config.id}`;
  anchor.position.copy(position); anchor.add(actor.group); stage.add(anchor);
}
export function spatialSnapshot(stage: THREE.Group, actors: PerformerSlot[], camera?: THREE.Camera) {
  stage.updateWorldMatrix(true, true);
  const inverse = stage.matrixWorld.clone().invert();
  return actors.map(actor => {
    let node: THREE.Object3D | null = actor.group, belongsToStage = false, attachedToCamera = false;
    while (node) { if (node === stage) belongsToStage = true; if (node === camera || (node as THREE.Camera).isCamera) attachedToCamera = true; node = node.parent; }
    return { id: actor.config.id, anchor: actor.config.anchor, representation: actor.representation, contentKind: actor.contentKind,
      buildingRelativeMatrix: inverse.clone().multiply(actor.group.matrixWorld).elements,
      worldMatrix: actor.group.matrixWorld.elements.slice(), belongsToStage, attachedToCamera, frameIndex: actor.frameIndex, frameCount: actor.frameCount };
  });
}
