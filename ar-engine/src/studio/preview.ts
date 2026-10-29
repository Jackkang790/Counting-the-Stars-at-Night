import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export class ModelPreview {
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(40,1,.01,100);
  private renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  private controls:OrbitControls;
  private model?:THREE.Group;
  private mixer?:THREE.AnimationMixer;
  private elapsed=0;
  private previous=performance.now();
  private generation=0;
  private observer:ResizeObserver;
  constructor(private host:HTMLElement){
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.replaceChildren(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x555566,3));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(2,4,3);this.scene.add(key);
    this.scene.add(new THREE.GridHelper(4,20,0x667788,0x303947));
    this.camera.position.set(0,1.3,3.5);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,.9,0);this.controls.update();
    this.observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/Math.max(1,h);this.camera.updateProjectionMatrix();});this.observer.observe(host);
    this.renderer.setAnimationLoop(()=>{const now=performance.now();this.elapsed+=Math.min(.1,(now-this.previous)/1000);this.previous=now;this.mixer?.setTime(this.elapsed);this.controls.update();this.renderer.render(this.scene,this.camera);});
  }
  async load(url:string):Promise<void>{
    const generation=++this.generation,r=await fetch(url);if(!r.ok)throw new Error("미리보기 파일 로드 실패");const bytes=await r.arrayBuffer();
    if(bytes.byteLength>64*1024*1024||bytes.byteLength<20)throw new Error("미리보기 GLB 크기 오류");
    const view=new DataView(bytes),length=view.getUint32(12,true);if(view.getUint32(0,true)!==0x46546c67||length>4*1024*1024||20+length>bytes.byteLength)throw new Error("GLB 형식 오류");
    const json=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+length)));for(const item of [...(json.buffers??[]),...(json.images??[])])if(item.uri&&!item.uri.startsWith("data:"))throw new Error("내장 리소스 GLB만 지원합니다");
    const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes,"");
    if(generation!==this.generation){this.release(gltf.scene);return;}
    if(this.model){this.scene.remove(this.model);this.release(this.model);}this.mixer?.stopAllAction();this.model=gltf.scene;
    const box=new THREE.Box3().setFromObject(this.model),height=box.max.y-box.min.y;if(height<.01)throw new Error("유효한 모델 높이가 없습니다");const scale=1.7/height;
    this.model.scale.multiplyScalar(scale);this.model.position.add(new THREE.Vector3(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2).multiplyScalar(scale));this.scene.add(this.model);
    this.mixer=new THREE.AnimationMixer(this.model);if(gltf.animations[0])this.mixer.clipAction(gltf.animations[0]).play();this.elapsed=0;
    this.host.dataset.animations=String(gltf.animations.length);
  }
  private release(root:THREE.Object3D):void{root.traverse(n=>{if(n instanceof THREE.Mesh){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material]){for(const v of Object.values(m))if(v instanceof THREE.Texture)v.dispose();m.dispose();}}});}
  dispose():void{this.generation++;this.observer.disconnect();this.renderer.setAnimationLoop(null);this.controls.dispose();if(this.model)this.release(this.model);this.renderer.dispose();}
}
