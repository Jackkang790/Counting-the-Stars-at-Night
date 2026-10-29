"""Offline four-person pose extraction. Lane identity is valid only for the reviewed,
fixed-camera, non-crossing supplied clip. Not a general identity/re-identification model."""
import argparse, hashlib, json, math
from pathlib import Path
import cv2, numpy as np, mediapipe as mp
from scipy.optimize import linear_sum_assignment

p=argparse.ArgumentParser();p.add_argument('--video',required=True);p.add_argument('--model',required=True);p.add_argument('--out',required=True);p.add_argument('--frames',type=int,default=240)
a=p.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
cap=cv2.VideoCapture(a.video);fps=cap.get(cv2.CAP_PROP_FPS);w=int(cap.get(3));h=int(cap.get(4));total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
if not cap.isOpened() or fps<=0:raise ValueError('Invalid video')
V=mp.tasks.vision;B=mp.tasks.BaseOptions
def detector(n):return V.PoseLandmarker.create_from_options(V.PoseLandmarkerOptions(base_options=B(model_asset_path=a.model),running_mode=V.RunningMode.VIDEO,num_poses=n,min_pose_detection_confidence=.35,min_pose_presence_confidence=.35,min_tracking_confidence=.5))
full=detector(4);crops=[detector(1) for _ in range(4)]
centers=np.array([.18,.39,.60,.81]);tracks=[[] for _ in range(4)];counts=[];costs=[];samples=[]
edges=[(11,13),(13,15),(12,14),(14,16),(11,12),(11,23),(12,24),(23,24),(23,25),(25,27),(24,26),(26,28)]
def rows(result,index,left=0,width=1):
 image=result.pose_landmarks[index];world=result.pose_world_landmarks[index]
 return {'image':[[round(left+l.x*width,6),round(l.y,6),round(l.visibility,5)] for l in image],
 'world':[[round(l.x,6),round(l.y,6),round(l.z,6),round(l.visibility,5)] for l in world]}
try:
 for frame in range(min(total,a.frames)):
  ok,bgr=cap.read()
  if not ok:break
  time=round(frame/fps*1000);rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB)
  result=full.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb),time)
  detections=[rows(result,i) for i in range(len(result.pose_landmarks))]
  hips=np.array([(.5*(d['image'][23][0]+d['image'][24][0])) for d in detections]);assigned={}
  if len(hips):
   cost=np.abs(centers[:,None]-hips[None,:]);rr,cc=linear_sum_assignment(cost)
   for i,j in zip(rr,cc):
    if cost[i,j]<.105:assigned[int(i)]={**detections[j],'source':'full','assignmentCost':round(float(cost[i,j]),5)};costs.append(float(cost[i,j]))
  for i in range(4):
   if i not in assigned:
    left=max(0,centers[i]-.155);right=min(1,centers[i]+.155);crop=np.ascontiguousarray(rgb[:,int(left*w):int(right*w)])
    r=crops[i].detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=crop),time)
    if r.pose_landmarks:
     d=rows(r,0,left,right-left);x=.5*(d['image'][23][0]+d['image'][24][0])
     if abs(x-centers[i])<.09:assigned[i]={**d,'source':'crop','assignmentCost':round(float(abs(x-centers[i])),5)}
   d=assigned.get(i);tracks[i].append(d)
   if d:
    x=.5*(d['image'][23][0]+d['image'][24][0]);centers[i]=.85*centers[i]+.15*x
    if frame in [0,60,120,180,228]:
     for b,c in edges:
      q1=d['image'][b];q2=d['image'][c];cv2.line(bgr,(int(q1[0]*w),int(q1[1]*h)),(int(q2[0]*w),int(q2[1]*h)),[(40,200,255),(80,230,80),(255,130,80),(220,80,220)][i],2)
     cv2.putText(bgr,f'ID {i+1:02d}',(int(x*w)-30,50),cv2.FONT_HERSHEY_SIMPLEX,.8,(255,255,255),2)
  if np.any(np.diff(centers)<.10):raise ValueError('Ambiguous identity lanes: manual tracking required')
  counts.append(len(result.pose_landmarks))
  if frame in [0,60,120,180,228]:samples.append(cv2.resize(bgr,(640,360)))
  if frame%48==0:print(f'frame {frame}: full detections={len(detections)}, assigned={len(assigned)}',flush=True)
finally:
 full.close();[d.close() for d in crops];cap.release()
frames=len(counts);report=[]
for i,track in enumerate(tracks):
 visible=sum(d is not None for d in track);joint_reliable=[sum(bool(d and d['world'][j][3]>=.5) for d in track)/max(1,frames) for j in range(33)]
 report.append({'id':f'performer-{i+1:02d}','observedFrames':visible,'totalFrames':frames,'detectionCoverage':round(visible/max(1,frames),4),'cropRecoveries':sum(bool(d and d['source']=='crop') for d in track),'reliableJointCoverage':joint_reliable,'missingFrames':[j for j,d in enumerate(track) if not d]})
payload={'schema':1,'fps':fps,'frames':frames,'duration':frames/fps,'sourceSha256':hashlib.sha256(Path(a.video).read_bytes()).hexdigest(),'identityMethod':'reviewed non-crossing left-to-right lanes + Hungarian centroid assignment + crop recovery; not face recognition','coordinateSystem':'MediaPipe hip-relative world meters, x right, y down, z camera depth; inferred monocular 3D','actors':[{'id':r['id'],'frames':t} for r,t in zip(report,tracks)]}
(out/'poses.json').write_text(json.dumps(payload,separators=(',',':')),encoding='utf-8')
summary={'source':{'width':w,'height':h,'fps':fps,'decodedFrames':total,'processedFrames':frames,'sha256':payload['sourceSha256']},'detectedPeopleHistogram':{str(n):counts.count(n) for n in set(counts)},'actors':report,'identity':payload['identityMethod'],'limits':['monocular estimated depth, not measured volumetric motion','skirt hides hip/knee landmarks; inspect confidence','mouth/fingers not captured; no verified singing lip-sync','camera-static/no-crossing assumption is specific to this video']}
(out/'analysis.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
if samples:cv2.imwrite(str(out/'tracked-contact.jpg'),np.vstack(samples))
print(json.dumps({'frames':frames,'coverage':[r['detectionCoverage'] for r in report]}))
