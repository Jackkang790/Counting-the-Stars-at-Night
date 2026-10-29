"""CC0 MakeHuman-derived clothed humans + reviewed video pose estimates.
No face reconstruction, no paid API, no claim of measured volumetric capture."""
import argparse,json,math,sys,hashlib
from pathlib import Path
import bpy,numpy as np
from mathutils import Vector,Matrix,Quaternion

p=argparse.ArgumentParser();p.add_argument('--mesh',required=True);p.add_argument('--skin',required=True);p.add_argument('--poses',required=True);p.add_argument('--out',required=True);p.add_argument('--render')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
data=json.loads(Path(a.poses).read_text());fps=24;frames=240
if abs(data['fps']-24)>.001 or data['frames']<240 or len(data['actors'])!=4:raise ValueError('This reviewed quartet build requires four tracks, 24fps and at least 240 frames. Resample/review other inputs first.')
vertices=[];uvs=[];groups={};group='';faces=[]
for line in Path(a.mesh).read_text().splitlines():
 if line.startswith('v '):vertices.append(tuple(map(float,line.split()[1:4])))
 elif line.startswith('vt '):uvs.append(tuple(map(float,line.split()[1:3])))
 elif line.startswith('g '):group=line[2:];groups[group]=[]
 elif line.startswith('f '):
  face=[tuple(int(n)-1 if n else -1 for n in part.split('/')) for part in line.split()[1:]];groups[group].append(face)
bodyfaces=groups['body'];used=sorted(set(i[0] for f in bodyfaces for i in f));minimum=min(vertices[i][1] for i in used);maximum=max(vertices[i][1] for i in used)
scale=1.63/(maximum-minimum)
def convert(v):return Vector((v[0]*scale,-v[2]*scale,(v[1]-minimum)*scale))
def joint(name):
 ids=set(v[0] for f in groups['joint-'+name] for v in f);return sum((convert(vertices[i]) for i in ids),Vector())/len(ids)
skin=bpy.data.images.load(str(Path(a.skin).resolve()));skin.scale(1024,1024)
def material(name,color,rough=.7,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;node=m.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=color;node.inputs['Roughness'].default_value=rough;node.inputs['Metallic'].default_value=metal;return m
black=material('Black wool uniform',(.012,.016,.021,1),.83);white=material('Cotton collar and socks',(.88,.86,.8,1),.88);rubber=material('Black rubber shoes',(.007,.009,.012,1),.48);gold=material('Brass school buttons',(.36,.23,.07,1),.34,.8);hair=material('Short dark hair',(.012,.009,.007,1),.9);eye=material('Eye whites',(.65,.61,.54,1),.34);iris=material('Brown iris',(.055,.025,.014,1),.28)
reports=[];scene=bpy.context.scene;scene.render.fps=fps;scene.frame_start=0;scene.frame_end=240
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def segment_distance(v,head,tail):
 direction=tail-head;t=max(0,min(1,(v-head).dot(direction)/max(1e-8,direction.length_squared)));return (v-(head+direction*t)).length
def bind(obj,rig,force=None):
 if force:
  vg=obj.vertex_groups.new(name=force);vg.add(list(range(len(obj.data.vertices))),1,'REPLACE')
 else:
  names=[b.name for b in rig.data.bones];vgs={name:obj.vertex_groups.new(name=name) for name in names}
  for v in obj.data.vertices:
   distances=sorted((segment_distance(v.co,rig.data.bones[n].head_local,rig.data.bones[n].tail_local),n) for n in names if n not in ['Neck'] or v.co.z>1.40)
   if v.co.z>1.49:distances=[(0,'Head')]
   best=distances[:2];weights=[1/max(.012,d)**4 for d,n in best];total=sum(weights)
   for (d,n),weight in zip(best,weights):vgs[n].add([v.index],weight/total,'REPLACE')
 mod=obj.modifiers.new('Humanoid skin','ARMATURE');mod.object=rig;obj.parent=rig
 for face in obj.data.polygons:face.use_smooth=True
 return obj
def mesh(name,verts,faces,mat):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();obj=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(obj);m.materials.append(mat);return obj
def sphere(name,center,size,mat,rig,bone):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=center);o=bpy.context.object;o.name=name;o.scale=size
 bpy.ops.object.transform_apply(location=True,rotation=False,scale=True);o.data.materials.append(mat);return bind(o,rig,bone)

for actor in range(4):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 # Each actor receives its own mesh, skeleton, action and material, not four camera overlays.
 rig=bpy.data.objects.new(f'UniformActor{actor+1:02d}',bpy.data.armatures.new(f'Rig{actor+1:02d}'));bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
 rig['representation']='licensed-human-mesh-with-monocular-pose';rig['sourceVideoSha256']=data['sourceSha256'];rig['actorId']=f'performer-{actor+1:02d}';rig['notFaceReconstruction']=True
 hips=joint('pelvis');spine=joint('spine-3');chest=joint('spine-1');neck=joint('neck');head=joint('head')
 specs=[('Hips',hips,joint('spine-4'),None),('Spine',joint('spine-4'),spine,'Hips'),('Chest',spine,neck,'Spine'),('Neck',neck,head,'Chest'),('Head',head,Vector((0,head.y,1.63)),'Neck')]
 for side,prefix in [('Left','l'),('Right','r')]:
  shoulder=joint(prefix+'-shoulder');elbow=joint(prefix+'-elbow');wrist=joint(prefix+'-hand');hand=joint(prefix+'-hand-2');hip=joint(prefix+'-upper-leg');knee=joint(prefix+'-knee');ankle=joint(prefix+'-ankle');toe=joint(prefix+'-foot-2')
  specs += [(side+'UpperArm',shoulder,elbow,'Chest'),(side+'LowerArm',elbow,wrist,side+'UpperArm'),(side+'Hand',wrist,hand,side+'LowerArm'),(side+'UpperLeg',hip,knee,'Hips'),(side+'LowerLeg',knee,ankle,side+'UpperLeg'),(side+'Foot',ankle,toe,side+'LowerLeg')]
 bpy.ops.object.mode_set(mode='EDIT')
 for name,h,t,parent in specs:
  b=rig.data.edit_bones.new(name);b.head=h;b.tail=t
  if parent:b.parent=rig.data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT')
 indices={old:i for i,old in enumerate(used)};verts=[convert(vertices[i]) for i in used]
 # Small, explicit CC0-mesh variations distinguish bodies/faces, not inferred identities.
 for v in verts:
  if v.z>1.45:v.x*=1+[-.035,.025,-.01,.045][actor];v.y*=1+[.02,-.025,.035,-.015][actor]
 skinmat=material(f'Actor{actor+1} CC0 skin',(1,1,1,1),.64);tex=skinmat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=skin;skinmat.node_tree.links.new(tex.outputs['Color'],skinmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
 body=mesh('CC0 Human body',verts,[[indices[v[0]] for v in f] for f in bodyfaces],skinmat)
 uv=body.data.uv_layers.new(name='MakeHumanUV')
 for polygon,sourceface in zip(body.data.polygons,bodyfaces):
  for loop,v in zip(polygon.loop_indices,sourceface):uv.data[loop].uv=uvs[v[1]]
 bind(body,rig)
 # Fitted jacket: copy skin topology with a small outward offset. No exposed torso.
 jacket_faces=[];jacket_uv=[]
 for face in body.data.polygons:
  c=face.center;dominant=[]
  for i in face.vertices:
   vg=max(body.data.vertices[i].groups,key=lambda x:x.weight);dominant.append(body.vertex_groups[vg.group].name)
  if all(n in ['Hips','Spine','Chest','LeftUpperArm','LeftLowerArm','RightUpperArm','RightLowerArm'] for n in dominant) and c.z>.93:jacket_faces.append(list(face.vertices))
 jacket=mesh('Fitted black uniform jacket',[v.co+v.normal*.009 for v in body.data.vertices],jacket_faces,black);bind(jacket,rig)
 # Hide all covered body polygons, preventing skin intersections during limb movement.
 jacket_set={tuple(f) for f in jacket_faces}
 for m in [black,white,rubber]:body.data.materials.append(m)
 for face in body.data.polygons:
  c=face.center
  if tuple(face.vertices) in jacket_set:face.material_index=1
  elif c.z<.075:face.material_index=3
  elif c.z<.22:face.material_index=2
  elif .75<c.z<1.04 and abs(c.x)<.23:face.material_index=1
 # Pleated knee-length skirt, in the pelvis frame; simple cloth approximation.
 skirtverts=[];N=64
 for z,radius in [(1.02,.185),(.92,.205),(.58,.285)]:
  for k in range(N):
   theta=2*math.pi*k/N;r=radius*(1+.055*math.cos(theta*16));skirtverts.append((math.cos(theta)*r,math.sin(theta)*r*.76,z))
 skirtfaces=[(row*N+k,row*N+(k+1)%N,(row+1)*N+(k+1)%N,(row+1)*N+k) for row in range(2) for k in range(N)]
 skirt=mesh('Black pleated uniform skirt',skirtverts,skirtfaces,black);bind(skirt,rig,'Hips')
 collar=mesh('White pointed collar',[(-.08,-.095,1.43),(-.025,-.14,1.32),(0,-.145,1.38),(.08,-.095,1.43),(.025,-.14,1.32)],[(0,1,2),(2,4,3)],white);bind(collar,rig,'Chest')
 for z in [1.26,1.18,1.10,1.03]:sphere('Brass jacket button',(0,-.128,z),(.009,.006,.009),gold,rig,'Chest' if z>1.1 else 'Spine')
 # Short hair shell and a separate black student cap with a peak and badge.
 scalpfaces=[list(f.vertices) for f in body.data.polygons if f.center.z>1.57 or f.center.z>1.48 and f.center.y>.02]
 scalp=mesh('Short black hair',[v.co+v.normal*.004 for v in body.data.vertices],scalpfaces,hair);bind(scalp,rig,'Head')
 cap=sphere('Black student cap crown',(0,-.005,1.635),(.105,.105,.047),black,rig,'Head')
 brimverts=[(0,-.075,1.614)]+[(math.cos(t)*.112,-.075-math.sin(t)*.08,1.608) for t in [i*math.pi/20 for i in range(21)]]
 brim=mesh('Black cap peak',brimverts,[(0,k+1,k+2) for k in range(20)],rubber);bind(brim,rig,'Head')
 sphere('School cap badge',(0,-.107,1.645),(.012,.003,.01),gold,rig,'Head')
 for side,prefix in [('Left','l'),('Right','r')]:
  e=joint(prefix+'-eye');e.x*=1+[-.035,.025,-.01,.045][actor]
  sphere('Natural eye '+side,e,(.011,.01,.010),eye,rig,'Head');sphere('Brown pupil '+side,e+Vector((0,-.009,0)),(.004,.002,.004),iris,rig,'Head')
  ankle=joint(prefix+'-ankle')
  sphere('Black rubber shoe '+side,(ankle.x,-.11,.05),(.062,.16,.043),rubber,rig,side+'Foot')
  sphere('Rubber sole '+side,(ankle.x,-.11,.017),(.065,.165,.015),rubber,rig,side+'Foot')
 # Distinct discreet school breast pin per actor.
 sphere('Actor school pin',(.08,-.12,1.28),(.01,.005,.01),material(f'Pin {actor}',[(.25,.12,.05,1),(.12,.17,.2,1),(.2,.13,.11,1),(.18,.18,.11,1)][actor],.5,.5),rig,'Chest')
 # One independently skinned human per actor; material batches replace dozens of
 # separate accessory draws while retaining all skin weights and UV coordinates.
 bpy.ops.object.select_all(action='DESELECT')
 for obj in list(scene.objects):
  if obj.type=='MESH':obj.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name=f'UniformHumanSkinned{actor+1:02d}'
 # Recover missing/low-confidence joints transparently, then smooth 5 frames.
 track=data['actors'][actor]['frames'];points=np.zeros((frames,33,3));valid=np.zeros((frames,33),dtype=bool)
 for frame,d in enumerate(track[:frames]):
  if d:
   for j,l in enumerate(d['world']):points[frame,j]=[l[0],l[2],-l[1]];valid[frame,j]=l[3]>=.5
 repaired=0
 for j in range(33):
  indices_valid=np.flatnonzero(valid[:,j]);repaired+=int(np.count_nonzero(~valid[:,j]))
  if len(indices_valid)<2:raise ValueError(f'Actor {actor+1} joint {j} cannot be recovered')
  for axis in range(3):points[:,j,axis]=np.interp(np.arange(frames),indices_valid,points[indices_valid,j,axis]);points[:,j,axis]=np.convolve(np.pad(points[:,j,axis],(2,2),mode='edge'),np.ones(5)/5,mode='valid')
 # Final 0.5 seconds holds the source pose at 9.5 seconds as an authored finale.
 points[228:]=points[228]
 mapping={'LeftUpperArm':(11,13),'LeftLowerArm':(13,15),'LeftHand':(15,19),'RightUpperArm':(12,14),'RightLowerArm':(14,16),'RightHand':(16,20),'LeftUpperLeg':(23,25),'LeftLowerLeg':(25,27),'LeftFoot':(27,31),'RightUpperLeg':(24,26),'RightLowerLeg':(26,28),'RightFoot':(28,32)}
 rests={b.name:b.matrix_local.to_quaternion() for b in rig.data.bones};directions={b.name:(b.tail_local-b.head_local).normalized() for b in rig.data.bones};ordered=sorted(rig.pose.bones,key=lambda b:len(b.parent_recursive));previous={};corrections=[]
 for frame in range(frames+1):
  f=min(frame,frames-1);scene.frame_set(frame)
  for pb in ordered:pb.matrix_basis=Matrix.Identity(4)
  bpy.context.view_layer.update()
  pts=[Vector(p) for p in points[f]];up=((pts[11]+pts[12])-(pts[23]+pts[24])).normalized();right=(pts[11]-pts[12]).normalized();forward=up.cross(right).normalized();right=forward.cross(up).normalized();basis=Matrix((right,forward,up)).transposed().to_quaternion()
  for pb in ordered:
   name=pb.name
   if name in mapping:
    i,j=mapping[name];direction=(pts[j]-pts[i]).normalized();q=directions[name].rotation_difference(direction) @ rests[name]
   elif name=='Head':q=basis @ rests[name]
   else:q=Quaternion().slerp(basis, .65 if name in ['Hips','Spine'] else 1) @ rests[name]
   if name in previous:q=previous[name].copy() if frame>228 else previous[name].slerp(q,.65)
   previous[name]=q.copy();matrix=q.to_matrix().to_4x4();matrix.translation=pb.matrix.translation;pb.matrix=matrix;bpy.context.view_layer.update()
  # Ground the evaluated shoe/foot geometry, not the pelvis origin.
  deps=bpy.context.evaluated_depsgraph_get()
  ground_objects=[body]+[o for o in scene.objects if o.type=='MESH' and (o.name.startswith('Black rubber shoe') or o.name.startswith('Rubber sole'))]
  lowest=min((obj.evaluated_get(deps).matrix_world @ Vector(c)).z for obj in ground_objects for c in obj.evaluated_get(deps).bound_box)
  root=rig.pose.bones['Hips'];m=root.matrix.copy();m.translation.z-=lowest;root.matrix=m;corrections.append(float(-lowest));bpy.context.view_layer.update()
  for pb in ordered:pb.rotation_mode='QUATERNION';pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('location',frame=frame)
 rig.animation_data.action.name=f'UniformQuartet{actor+1:02d}'
 scene.frame_set(0)
 for action in list(bpy.data.actions):
  if action!=rig.animation_data.action:bpy.data.actions.remove(action)
 path=out/f'performer-{actor+1:02d}.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=True,export_frame_range=True,export_extras=True,export_image_format='JPEG',export_jpeg_quality=88)
 reports.append({'id':f'performer-{actor+1:02d}','file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'bones':len(rig.data.bones),'frames':241,'duration':10,'repairedJointSamples':repaired,'groundCorrectionRange':[min(corrections),max(corrections)],'modelSource':'MakeHuman CC0 base + young Asian female skin; authored black uniform','motionSource':'MediaPipe monocular estimates, 5-frame smoothing, low-confidence interpolation, authored 9.5s hold','notOriginalActorIdentity':True})
 if a.render and actor==0:
  scene.frame_set(144);bpy.ops.object.camera_add(location=(2,-4,2));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
  bpy.ops.object.light_add(type='AREA',location=(1,-3,4));bpy.context.object.data.energy=450;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
  scene.world.color=(.16,.16,.16);scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=600;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
(out/'build-report.json').write_text(json.dumps({'actors':reports,'sourceVideoSha256':data['sourceSha256'],'measuredVolumetricCapture':False,'faceReconstruction':False,'wardrobe':'black skirt uniform/cap, white collar/socks, black shoe material; historical accuracy unverified'},indent=2),encoding='utf-8')
