import * as THREE from 'three';

/** Explicit estimated placement using a valid tracked viewer pose. Evaluate once
 * on user action and save the WORLD transform, never parent it to the camera. */
export function manualStagePose(camera:THREE.Camera,distance:number):THREE.Matrix4{
  if(!Number.isFinite(distance)||distance<.5||distance>6)throw Error('직접 배치 거리는 0.5~6m로 선택하세요.');
  camera.updateWorldMatrix(true,false);
  const position=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const point=new THREE.Vector3(0,0,-distance).applyMatrix4(camera.matrixWorld);
  point.y-=distance*.18;
  if(![...point.toArray(),...position.toArray()].every(Number.isFinite))throw Error('유효한 공간 추적 위치가 필요합니다.');
  const toward=position.sub(point),yaw=Math.atan2(-toward.x,-toward.z);
  return new THREE.Matrix4().compose(point,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1));
}
