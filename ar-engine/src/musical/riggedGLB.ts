import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { actorOpacity, mediaTime } from "./timeline";
import type { ActorConfig, PerformerRenderer } from "./types";

/** A real skinned 3D object in the building frame, driven solely by the show clock. */
export class RiggedGLBPerformer implements PerformerRenderer {
  readonly representation = "rigged-glb" as const;
  readonly group = new THREE.Group();
  readonly loaded = true;
  private readonly mixer: THREE.AnimationMixer;
  private readonly materials: {material: THREE.Material; opacity: number}[] = [];
  private constructor(readonly config: ActorConfig, readonly model: THREE.Group, readonly clip: THREE.AnimationClip,
    readonly contentKind: "generated-human" | "synthetic-calibration" | "licensed-human") {
    this.group.add(model);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y < .01 || size.x < .005 || size.z < .005) throw new Error("입체 인물의 유효한 크기가 필요합니다");
    const scale = config.height / size.y;
    model.scale.multiplyScalar(scale);
    model.position.add(new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2).multiplyScalar(scale));
    model.traverse(node => { if (node instanceof THREE.Mesh) for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
      this.materials.push({material:m, opacity:m.opacity}); m.transparent = true;
      if(contentKind==="licensed-human")m.forceSinglePass=true;
    }});
    this.mixer = new THREE.AnimationMixer(model); this.mixer.clipAction(clip).play();
  }
  static async load(config: ActorConfig, bytes: ArrayBuffer, kind: "generated-human" | "synthetic-calibration" | "licensed-human" = "generated-human", clipName=config.clipName): Promise<RiggedGLBPerformer> {
    if (bytes.byteLength < 20 || bytes.byteLength > 64 * 1024 * 1024) throw new Error("GLB는 64MiB 이하이어야 합니다");
    const view = new DataView(bytes);
    if (view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2 || view.getUint32(8,true)!==bytes.byteLength || view.getUint32(16,true)!==0x4e4f534a) throw new Error("GLB 2.0 파일이 필요합니다");
    const length=view.getUint32(12,true); if (length>4*1024*1024 || 20+length>bytes.byteLength) throw new Error("GLB JSON 범위 오류");
    const json=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+length)));
    for (const r of [...(json.buffers??[]),...(json.images??[])]) if (r.uri && !r.uri.startsWith("data:")) throw new Error("텍스처·버퍼가 내장된 GLB만 지원합니다");
    if (json.asset?.extras?.syntheticCalibration || json.nodes?.some((n: {extras?: {syntheticCalibration?: boolean}})=>n.extras?.syntheticCalibration)) kind="synthetic-calibration";
    const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes, "");
    const joints=new Set<string>(); let skins=0;
    gltf.scene.traverse(n=>{ if (n instanceof THREE.SkinnedMesh) { skins++; n.skeleton.bones.forEach(b=>{joints.add(b.name);joints.add(b.uuid);}); }});
    const clip=gltf.animations.find(c=>(!clipName||c.name===clipName) && c.duration>0 && c.tracks.every(t=>t.values.every(Number.isFinite)) && c.tracks.some(t=>{
      if(!joints.has(t.name.split(".")[0]))return false;const size=t.getValueSize();
      return t.values.some((v,i)=>i>=size&&Math.abs(v-t.values[i%size])>1e-5);
    }));
    if (!skins || !clip) { disposeTree(gltf.scene); throw new Error("본 동작이 포함된 리깅 GLB가 필요합니다"); }
    try { return new RiggedGLBPerformer(config,gltf.scene,clip,kind); } catch(e) { disposeTree(gltf.scene); throw e; }
  }
  async prime(): Promise<void> {}
  sample(time: number, _playing: boolean): void {
    const alpha=actorOpacity(this.config,time); this.group.visible=alpha>0;
    this.mixer.setTime(mediaTime(this.config,time,this.clip.duration));
    for (const {material,opacity} of this.materials) material.opacity=opacity*alpha;
    this.group.updateMatrixWorld(true);
  }
  pause(): void {}
  dispose(): void { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); disposeTree(this.model); this.group.clear(); }
}
function disposeTree(root: THREE.Object3D): void {
  const textures=new Set<THREE.Texture>(),materials=new Set<THREE.Material>();
  root.traverse(n=>{if(n instanceof THREE.Mesh){n.geometry.dispose(); for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});
  for(const m of materials){for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);m.dispose();}
  textures.forEach(t=>t.dispose());
}
