import * as THREE from 'three';

/** A visible stage footprint and a tap target for the exact measured floor pose. */
export class FloorPlacementGuide {
  readonly mesh = new THREE.Group();
  readonly button = document.createElement('button');
  private readonly hint = document.createElement('div');
  private candidate?: {matrix:THREE.Matrix4;time:number};
  private pressed = false;
  private readonly point = new THREE.Vector3();
  private readonly cameraPoint = new THREE.Vector3();
  private readonly pad:THREE.Mesh;
  private readonly raycaster=new THREE.Raycaster();

  constructor(private readonly container:HTMLElement,private readonly select:(matrix:THREE.Matrix4,time:number)=>void,width=1.4){
    this.mesh.name='FloorPlacementGuide';this.mesh.matrixAutoUpdate=false;this.mesh.visible=false;
    const depth=Math.min(1.4,width*.5);
    const pad=this.pad=new THREE.Mesh(new THREE.PlaneGeometry(width,depth).rotateX(-Math.PI/2),
      new THREE.MeshBasicMaterial({color:0xffd376,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));
    pad.position.set(0,.01,-depth*.4);pad.renderOrder=10;this.mesh.add(pad);
    const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width/2,.015,depth*.1),new THREE.Vector3(width/2,.015,depth*.1),
      new THREE.Vector3(width/2,.015,-depth*.9),new THREE.Vector3(-width/2,.015,-depth*.9),
    ]),new THREE.LineBasicMaterial({color:0xffda83,transparent:true,opacity:.95,depthTest:false}));
    outline.renderOrder=11;this.mesh.add(outline);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.07,.11,40).rotateX(-Math.PI/2),
      new THREE.MeshBasicMaterial({color:0xffe5a9,side:THREE.DoubleSide,depthTest:false}));
    ring.position.y=.02;ring.renderOrder=12;this.mesh.add(ring);
    this.button.type='button';this.button.id='musical-place-here';this.button.className='musical-floor-target';
    this.button.textContent='여기에 공연 보기';this.button.hidden=true;
    this.hint.className='musical-floor-hint';this.hint.setAttribute('role','status');this.hint.hidden=true;
    this.button.addEventListener('beforexrselect',event=>event.preventDefault());
    this.button.addEventListener('pointerdown',event=>{if(this.button.disabled)return;this.pressed=true;this.button.setPointerCapture(event.pointerId);});
    this.button.addEventListener('pointercancel',()=>{this.pressed=false;});
    this.button.addEventListener('click',event=>{
      event.stopPropagation();const point=this.candidate;this.pressed=false;
      if(point&&!this.button.disabled)this.select(point.matrix.clone(),point.time);
    });
    container.append(this.hint,this.button);
  }

  show(matrix:THREE.Matrix4,camera:THREE.Camera,time:number,scale:number,ready=true):boolean{
    if(this.pressed)return !this.button.hidden&&!this.button.disabled;
    this.candidate={matrix:matrix.clone(),time};
    this.mesh.matrix.copy(matrix).scale(new THREE.Vector3(scale,scale,scale));this.mesh.matrixWorldNeedsUpdate=true;this.mesh.visible=true;
    this.point.setFromMatrixPosition(matrix);this.cameraPoint.copy(this.point).applyMatrix4(camera.matrixWorldInverse);
    this.point.project(camera);
    const visible=this.cameraPoint.z<0&&Math.abs(this.point.x)<.95&&Math.abs(this.point.y)<.95&&this.point.z<1;
    this.button.hidden=!visible;this.button.disabled=!ready;
    const label=ready?'여기에 공연 보기':'공연 준비 중…';
    if(this.button.textContent!==label)this.button.textContent=label;
    if(visible){
      const x=(this.point.x+1)*.5*this.container.clientWidth,y=(1-this.point.y)*.5*this.container.clientHeight;
      this.button.style.left=`${Math.max(86,Math.min(this.container.clientWidth-86,x))}px`;
      this.button.style.top=`${Math.max(64,Math.min(this.container.clientHeight-12,y))}px`;
    }
    this.hint.hidden=false;
    const hint=visible?(ready?(scale<.75?'표시를 누르세요 · 가까운 곳은 작은 무대로 보여요':'노란 무대 표시를 누르면 공연이 시작돼요'):'무대는 찾았어요 · 공연을 준비하고 있어요'):'휴대폰을 바닥 쪽으로 조금 더 기울여 주세요';
    if(this.hint.textContent!==hint)this.hint.textContent=hint;
    return visible&&ready;
  }
  searching(message='바닥을 천천히 비추면 누를 수 있는 무대가 나타나요'):void{
    this.pressed=false;this.candidate=undefined;this.mesh.visible=false;this.button.hidden=true;this.button.disabled=true;
    this.hint.hidden=false;if(this.hint.textContent!==message)this.hint.textContent=message;
  }
  selectAt(clientX:number,clientY:number,camera:THREE.Camera):boolean{
    if(!this.mesh.visible||this.button.disabled||!this.candidate)return false;
    const rect=this.container.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);
    this.mesh.updateMatrixWorld(true);
    if(!this.raycaster.intersectObject(this.pad,false).length)return false;
    this.select(this.candidate.matrix.clone(),this.candidate.time);return true;
  }
  hide():void{this.pressed=false;this.candidate=undefined;this.mesh.visible=false;this.button.hidden=true;this.hint.hidden=true;}
  dispose():void{
    this.mesh.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
    this.button.remove();this.hint.remove();
  }
}
