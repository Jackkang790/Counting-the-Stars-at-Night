export interface PlacementPolicy { minHorizontalMeters:number; maxDistanceMeters:number; minDropMeters:number; stageWidthMeters?:number }
export type Point3={x:number;y:number;z:number};
export const quartetPlacementPolicy:PlacementPolicy={minHorizontalMeters:0,maxDistanceMeters:12,minDropMeters:.1,stageWidthMeters:3.8};
export function placementIssue(camera:Point3,point:Point3,policy:PlacementPolicy):string|null{
  if(![camera.x,camera.y,camera.z,point.x,point.y,point.z].every(Number.isFinite))return "유효한 공간 좌표가 아닙니다.";
  const horizontal=Math.hypot(point.x-camera.x,point.z-camera.z),distance=Math.hypot(horizontal,point.y-camera.y);
  if(horizontal<policy.minHorizontalMeters)return "발 바로 아래보다 조금 앞의 바닥을 비춰 주세요.";
  if(distance>policy.maxDistanceMeters)return "기준점이 너무 멉니다. 건물 앞 바닥을 선택하세요.";
  if(camera.y-point.y<policy.minDropMeters)return "배우 발이 설 바닥 기준점을 선택하세요. 벽·눈높이 점은 피하세요.";
  return null;
}

/** Fit a nearby floor stage into the camera view, without changing its world anchor. */
export function floorStageScale(horizontalMeters:number,projectionX:number,stageWidthMeters?:number):number{
  if(!stageWidthMeters||!Number.isFinite(stageWidthMeters)||stageWidthMeters<=0||!Number.isFinite(horizontalMeters))return 1;
  if(!Number.isFinite(projectionX))projectionX=1.5;
  const viewWidth=2*horizontalMeters/Math.max(Math.abs(projectionX),.1);
  return Math.max(.12,Math.min(1,viewWidth*.82/stageWidthMeters));
}
