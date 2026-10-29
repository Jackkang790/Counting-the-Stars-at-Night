export interface PlacementPolicy { minHorizontalMeters:number; maxDistanceMeters:number; minDropMeters:number }
export type Point3={x:number;y:number;z:number};
export const quartetPlacementPolicy:PlacementPolicy={minHorizontalMeters:2,maxDistanceMeters:12,minDropMeters:.25};
export function placementIssue(camera:Point3,point:Point3,policy:PlacementPolicy):string|null{
  if(![camera.x,camera.y,camera.z,point.x,point.y,point.z].every(Number.isFinite))return "유효한 공간 좌표가 아닙니다.";
  const horizontal=Math.hypot(point.x-camera.x,point.z-camera.z),distance=Math.hypot(horizontal,point.y-camera.y);
  if(horizontal<policy.minHorizontalMeters)return `너무 가까운 기준점입니다. ${policy.minHorizontalMeters}m 이상 앞의 바닥을 탭하세요.`;
  if(distance>policy.maxDistanceMeters)return "기준점이 너무 멉니다. 건물 앞 바닥을 선택하세요.";
  if(camera.y-point.y<policy.minDropMeters)return "배우 발이 설 바닥 기준점을 선택하세요. 벽·눈높이 점은 피하세요.";
  return null;
}
