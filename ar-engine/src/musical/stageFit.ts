import * as THREE from 'three';

/** Fit all four actors in the usable view at placement time. A downward-looking
 * camera must use projected depth, not the much shorter horizontal distance.
 * This never runs on a placed stage, so walking cannot resize/follow the viewer. */
export function fitFloorStage(pose:THREE.Matrix4,camera:THREE.Camera,width?:number):number{
  if(!width)return 1;
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  pose.decompose(position,rotation,scale);
  const yaw=new THREE.Euler().setFromQuaternion(rotation,'YXZ').y;
  const upright=new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1));
  const point=new THREE.Vector3();
  const fits=(s:number)=>{
    for(const x of [-width/2,width/2])for(const y of [0,1.8])for(const z of [-.95,0]){
      point.set(x*s,y*s,z*s).applyMatrix4(upright).applyMatrix4(camera.matrixWorldInverse);
      if(point.z>=-.03)return false;
      point.applyMatrix4(camera.projectionMatrix);
      if(!Number.isFinite(point.x)||Math.abs(point.x)>.88||point.y<-.97||point.y>.72)return false;
    }
    return true;
  };
  if(fits(1))return 1;
  let low=.03,high=1;
  for(let i=0;i<12;i++){const mid=(low+high)/2;if(fits(mid))low=mid;else high=mid;}
  return low;
}
