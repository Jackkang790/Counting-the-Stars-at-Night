import * as THREE from "three";
import type { MusicalStage } from "./stage";
type Segment={id:string;u:[number,number];v:[number,number];kind:string};
/** Split photo-based 2.5D calibration model; never an unavoidable camera background. */
export function installPhotoFacade(stage:MusicalStage,image:HTMLImageElement,segments:Segment[]):void{
  for(const child of stage.building.children)child.visible=false;
  const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
  const {width:w,height:h}=stage.config;
  for(const segment of segments){
    const [u0,u1]=segment.u,[v0,v1]=segment.v;
    if(![u0,u1,v0,v1].every(Number.isFinite)||u0<0||u1>1||u0>=u1||v0<0||v1>1||v0>=v1)throw new Error("외벽 사진 영역 오류");
    const geometry=new THREE.PlaneGeometry(w*(u1-u0),h*(v1-v0)),uv=geometry.getAttribute("uv");
    for(let i=0;i<uv.count;i++)uv.setXY(i,u0+uv.getX(i)*(u1-u0),v0+uv.getY(i)*(v1-v0));
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`PHOTO_${segment.id}`;mesh.rotation.y=Math.PI;
    mesh.position.set(w*(.5-(u0+u1)/2),h*(v0+v1)/2,segment.kind==="column"?-.065:-.02);stage.building.add(mesh);
  }
  // The second supplied photo provides the clearer landscape panel detail.
  const panel=stage.building.getObjectByName("PANEL_Landscape");if(panel){panel.visible=true;panel.position.z=-.035;}
}
