import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ActorConfig, PerformerRenderer } from "./types";
import { actorOpacity } from "./timeline";
import { disposeTree } from "./stage";
import { validateMeshSequence, sequenceFrame, VOLUME_LIMITS, type MeshSequenceManifest } from "./volumeManifest";

export type FrameReader = (path: string) => Promise<ArrayBuffer>;

function checkSelfContainedGLB(bytes: ArrayBuffer): void {
  const view = new DataView(bytes);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw new Error("유효한 glTF 2.0 GLB가 아닙니다.");
  const end = 20 + view.getUint32(12, true);
  if (end > bytes.byteLength) throw new Error("GLB JSON 범위가 파일 밖입니다.");
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, end - 20)));
  if (json.scenes?.length !== 1) throw new Error("캡처 프레임은 하나의 장면만 포함해야 합니다.");
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])]) if (resource.uri && !resource.uri.startsWith("data:")) throw new Error("각 GLB는 외부 파일 참조 없이 텍스처·버퍼를 내장해야 합니다.");
  if ((json.extensionsRequired ?? []).some((x: string) => ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"].includes(x))) throw new Error("현재 시퀀스 로더에는 Draco/Meshopt/KTX2 디코더가 없습니다.");
}

function spatialShape(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  const samples: THREE.Vector3[] = [], point = new THREE.Vector3(); let hash = 2166136261;
  root.traverse(o => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute("position"); if (!positions) return;
    const stride = Math.max(1, Math.ceil(positions.count / 128));
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      if (![point.x, point.y, point.z].every(Number.isFinite) || point.length() > 20) throw new Error("3D 프레임의 좌표·미터 단위를 확인하세요.");
      for (const n of [point.x, point.y, point.z]) hash = Math.imul(hash ^ Math.round(n * 100000), 16777619);
      if (i % stride === 0) samples.push(point.clone());
    }
  });
  const first = samples[0]; if (!first) throw new Error("3D 정점이 없습니다.");
  const far = samples.reduce((a, b) => b.distanceToSquared(first) > a.distanceToSquared(first) ? b : a);
  const axis = far.clone().sub(first); let normal = new THREE.Vector3();
  for (const p of samples) { const n = new THREE.Vector3().crossVectors(axis, p.clone().sub(first)); if (n.lengthSq() > normal.lengthSq()) normal = n; }
  normal.normalize();
  if (!samples.some(p => Math.abs(normal.dot(p.clone().sub(first))) >= 0.005)) throw new Error("평면 파일은 입체 캡처로 표시할 수 없습니다. 비평면 3D 형상이 필요합니다.");
  return hash;
}

function disposeFrame(root: THREE.Object3D): void {
  const images = new Set<{ close: () => void }>();
  root.traverse(o => { const m = (o as THREE.Mesh).material; if (m) for (const material of Array.isArray(m) ? m : [m]) for (const item of Object.values(material)) if ((item as THREE.Texture)?.isTexture) {
    const image = (item as THREE.Texture).image as { close?: () => void } | undefined; if (image && typeof image.close === "function") images.add(image as { close: () => void });
  } });
  disposeTree(root); images.forEach(image => image.close());
}

/** Bounded, preloaded changing-topology GLB frames. Not an MP4 on a plane or a billboard. */
export class MeshSequencePerformer implements PerformerRenderer {
  readonly group = new THREE.Group();
  readonly representation = "mesh-sequence" as const;
  readonly contentKind: "human-capture" | "synthetic-calibration";
  readonly loaded = true;
  readonly frameCount: number;
  currentFrame = -1;
  private disposed = false;
  private materialDefaults = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  private constructor(readonly config: ActorConfig, readonly manifest: MeshSequenceManifest, private readonly frames: THREE.Object3D[], readonly decodedBytes: number) {
    this.contentKind = manifest.source.kind; this.frameCount = frames.length;
    this.group.name = `MESH_SEQUENCE_${config.id}`;
    for (const frame of frames) {
      frame.visible = false; this.group.add(frame);
      frame.traverse(o => { const m = (o as THREE.Mesh).material; if (m) for (const material of Array.isArray(m) ? m : [m]) this.materialDefaults.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }); });
    }
    this.group.visible = false;
  }
  static async load(config: ActorConfig, value: unknown, read: FrameReader, cancelled: () => boolean = () => false): Promise<MeshSequencePerformer> {
    const manifest = validateMeshSequence(value), loader = new GLTFLoader(), frames: THREE.Object3D[] = [];
    let inputBytes = 0, decodedBytes = 0; const shapes = new Set<number>();
    try {
      for (const path of manifest.frames) {
        if (cancelled()) throw new Error("3D 시퀀스 로드를 취소했습니다.");
        const bytes = await read(path); inputBytes += bytes.byteLength;
        if (inputBytes > VOLUME_LIMITS.inputBytes) throw new Error("3D 입력 파일의 합계가 배우당 48MiB를 초과했습니다.");
        checkSelfContainedGLB(bytes);
        const model = await loader.parseAsync(bytes, ""); frames.push(model.scene);
        if (model.animations.length) throw new Error("시퀀스의 각 GLB는 해당 시점의 정적 캡처여야 합니다.");
        const seen = new Set<object>(); let triangles = 0, meshes = 0;
        model.scene.traverse(o => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          meshes++; const geometry = mesh.geometry;
          if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || Object.keys(geometry.morphAttributes).length) throw new Error("시퀀스 프레임은 본·모프를 평가한 정적 메시로 베이크하세요.");
          triangles += (geometry.index?.count ?? geometry.getAttribute("position")?.count ?? 0) / 3;
          for (const attribute of [...Object.values(geometry.attributes), ...(geometry.index ? [geometry.index] : [])]) {
            const array = (attribute as THREE.BufferAttribute).array ?? (attribute as THREE.InterleavedBufferAttribute).data?.array;
            if (array && !seen.has(array)) { seen.add(array); decodedBytes += array.byteLength; }
          }
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) for (const item of Object.values(material)) if ((item as THREE.Texture)?.isTexture && !seen.has(item)) {
            seen.add(item); const image = (item as THREE.Texture).image as { width?: number; height?: number } | undefined;
            decodedBytes += Math.ceil((image?.width ?? 0) * (image?.height ?? 0) * 4 * 4 / 3);
          }
        });
        if (!meshes || triangles > VOLUME_LIMITS.trianglesPerFrame) throw new Error("3D 프레임이 비어 있거나 프레임당 100,000삼각형을 초과합니다.");
        if (decodedBytes > VOLUME_LIMITS.decodedBytes) throw new Error("사전 로드하는 3D 리소스가 배우당 48MiB를 초과했습니다. 짧은 저용량 시퀀스로 시험하세요.");
        shapes.add(spatialShape(model.scene));
      }
      if (cancelled()) throw new Error("3D 시퀀스 로드를 취소했습니다.");
      if (shapes.size < 2) throw new Error("같은 정적 형상의 반복은 동적 3D 공연으로 표시할 수 없습니다.");
      return new MeshSequencePerformer(config, manifest, frames, decodedBytes);
    } catch (error) { for (const frame of frames) disposeFrame(frame); throw error; }
  }
  async prime(): Promise<void> { if (this.disposed) throw new Error("해제된 3D 시퀀스입니다."); }
  sample(showTime: number, _playing: boolean): void {
    if (this.disposed) return;
    const opacity = actorOpacity(this.config, showTime); this.group.visible = opacity > 0;
    const time = Math.max(0, showTime - this.config.start) + this.config.mediaOffset;
    const index = sequenceFrame(time, this.manifest.fps, this.frames.length, this.config.loop);
    if (index !== this.currentFrame) { if (this.currentFrame >= 0) this.frames[this.currentFrame].visible = false; this.frames[index].visible = true; this.currentFrame = index; }
    this.frames[index].traverse(o => {
      const m = (o as THREE.Mesh).material;
      if (m) for (const material of Array.isArray(m) ? m : [m]) {
        const base = this.materialDefaults.get(material)!; const transparent = base.transparent || opacity < 0.999;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.opacity = base.opacity * opacity; material.depthWrite = base.depthWrite && opacity >= 0.999;
      }
    });
  }
  pause(): void { /* The shared show clock selects the frame; there is no independent animation loop. */ }
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const frame of this.frames) disposeFrame(frame); this.group.clear(); this.materialDefaults.clear(); }
}
