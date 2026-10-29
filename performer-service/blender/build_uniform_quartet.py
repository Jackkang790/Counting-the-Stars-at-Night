"""CC0 MakeHuman-derived clothed humans + reviewed video pose estimates.
No face reconstruction, no paid API, no claim of measured volumetric capture."""
import argparse,json,math,sys,hashlib
from pathlib import Path
import bpy,numpy as np
from mathutils import Vector,Matrix,Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
from uniform_appearance import apply_phenotype, anatomical_weights, dress

p=argparse.ArgumentParser();p.add_argument('--mesh',required=True);p.add_argument('--skin',required=True);p.add_argument('--poses',required=True);p.add_argument('--out',required=True);p.add_argument('--render');p.add_argument('--actors',type=int,default=4)
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
original_vertices,vertices=apply_phenotype(vertices,Path(a.mesh).parent)
source_weights=anatomical_weights(Path(a.mesh).parent,len(vertices))
bodyfaces=groups['body'];used=sorted(set(i[0] for f in bodyfaces for i in f));minimum=min(vertices[i][1] for i in used);maximum=max(vertices[i][1] for i in used)
scale=1.63/(maximum-minimum)
def convert(v):return Vector((v[0]*scale,-v[2]*scale,(v[1]-minimum)*scale))
def joint(name):
 ids=set(v[0] for f in groups['joint-'+name] for v in f);return sum((convert(vertices[i]) for i in ids),Vector())/len(ids)
skin=bpy.data.images.load(str(Path(a.skin).resolve()))
def material(name,color,rough=.7,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;node=m.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=color;node.inputs['Roughness'].default_value=rough;node.inputs['Metallic'].default_value=metal;return m
black=material('Black wool uniform',(.012,.016,.021,1),.83);white=material('Cotton collar and socks',(.88,.86,.8,1),.88);rubber=material('Black rubber shoes',(.007,.009,.012,1),.48);gold=material('Brass school buttons',(.36,.23,.07,1),.34,.8);hair=material('Short dark hair',(.012,.009,.007,1),.9);eye=material('Eye whites',(.65,.61,.54,1),.34);iris=material('Brown iris',(.055,.025,.014,1),.28)
reports=[];scene=bpy.context.scene;scene.render.fps=fps;scene.frame_start=0;scene.frame_end=240
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def segment_distance(v,head,tail):
 direction=tail-head;t=max(0,min(1,(v-head).dot(direction)/max(1e-8,direction.length_squared)));return (v-(head+direction*t)).length
def bind(obj,rig,force=None,weights=None):
 if force:
  vg=obj.vertex_groups.new(name=force);vg.add(list(range(len(obj.data.vertices))),1,'REPLACE')
 else:
  names=[b.name for b in rig.data.bones];vgs={name:obj.vertex_groups.new(name=name) for name in names}
  for v in obj.data.vertices:
   if weights is not None and weights[v.index]:
    values=sorted([(n,w) for n,w in weights[v.index].items() if n in vgs and w>0],key=lambda item:-item[1])[:4];total=sum(w for n,w in values)
    if total>0:
     for n,w in values:vgs[n].add([v.index],w/total,'REPLACE')
     continue
   distances=sorted((segment_distance(v.co,rig.data.bones[n].head_local,rig.data.bones[n].tail_local),n) for n in names if n not in ['Neck'] or v.co.z>1.40)
   if v.co.z>1.49:distances=[(0,'Head')]
   best=distances[:2];fallback_weights=[1/max(.012,d)**4 for d,n in best];total=sum(fallback_weights)
   for (d,n),weight in zip(best,fallback_weights):vgs[n].add([v.index],weight/total,'REPLACE')
 mod=obj.modifiers.new('Humanoid skin','ARMATURE');mod.object=rig;obj.parent=rig
 for face in obj.data.polygons:face.use_smooth=True
 return obj
def mesh(name,verts,faces,mat):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();obj=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(obj);m.materials.append(mat);return obj
def sphere(name,center,size,mat,rig,bone):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=center);o=bpy.context.object;o.name=name;o.scale=size
 bpy.ops.object.transform_apply(location=True,rotation=False,scale=True);o.data.materials.append(mat);return bind(o,rig,bone)

for actor in range(a.actors):
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
 # All fitted facial assets use the same anatomical surface; do not scale only
 # the skin independently of the eyes/hair and create misaligned doll faces.
 skinmat=material(f'Actor{actor+1} CC0 skin',(1,1,1,1),.64);tex=skinmat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=skin;skinmat.node_tree.links.new(tex.outputs['Color'],skinmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
 body=mesh('CC0 Human body',verts,[[indices[v[0]] for v in f] for f in bodyfaces],skinmat)
 uv=body.data.uv_layers.new(name='MakeHumanUV')
 for polygon,sourceface in zip(body.data.polygons,bodyfaces):
  for loop,v in zip(polygon.loop_indices,sourceface):uv.data[loop].uv=uvs[v[1]]
 bind(body,rig,weights=[source_weights[index] for index in used])
 ground_shoe=dress(body,rig,Path(a.mesh).parent,original_vertices,vertices,convert,source_weights,used,bind,mesh,material,sphere,joint,actor)
 sole_group=ground_shoe.vertex_groups.new(name='GroundSoles');sole_group.add(list(range(len(ground_shoe.data.vertices))),1,'REPLACE')
 # One independently skinned human per actor; material batches replace dozens of
 # separate accessory draws while retaining all skin weights and UV coordinates.
 bpy.ops.object.select_all(action='DESELECT')
 for obj in list(scene.objects):
  if obj.type=='MESH':obj.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name=f'UniformHumanSkinned{actor+1:02d}'
 sole_index=body.vertex_groups['GroundSoles'].index
 sole_vertices=[v.index for v in body.data.vertices if any(g.group==sole_index and g.weight>.5 for g in v.groups)]
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
   if name.endswith('Hand'):
    forearm=name.replace('Hand','LowerArm');i,j=mapping[forearm];direction=(pts[j]-pts[i]).normalized();q=directions[forearm].rotation_difference(direction) @ rests[name]
   elif name in mapping:
    i,j=mapping[name];direction=(pts[j]-pts[i]).normalized();q=directions[name].rotation_difference(direction) @ rests[name]
   elif name=='Head':q=basis @ rests[name]
   else:q=Quaternion().slerp(basis, .65 if name in ['Hips','Spine'] else 1) @ rests[name]
   if name in previous:q=previous[name].copy() if frame>228 else previous[name].slerp(q,.65)
   previous[name]=q.copy();matrix=q.to_matrix().to_4x4();matrix.translation=pb.matrix.translation;pb.matrix=matrix;bpy.context.view_layer.update()
  # Ground the evaluated shoe/foot geometry, not the pelvis origin.
  deps=bpy.context.evaluated_depsgraph_get()
  evaluated=body.evaluated_get(deps)
  lowest=min((evaluated.matrix_world @ evaluated.data.vertices[i].co).z for i in sole_vertices)
  root=rig.pose.bones['Hips'];m=root.matrix.copy();m.translation.z-=lowest;root.matrix=m;corrections.append(float(-lowest));bpy.context.view_layer.update()
  for pb in ordered:pb.rotation_mode='QUATERNION';pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('location',frame=frame)
 rig.animation_data.action.name=f'UniformQuartet{actor+1:02d}'
 scene.frame_set(0)
 for action in list(bpy.data.actions):
  if action!=rig.animation_data.action:bpy.data.actions.remove(action)
 path=out/f'performer-{actor+1:02d}.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=True,export_frame_range=True,export_extras=True,export_image_format='JPEG',export_jpeg_quality=88)
 reports.append({'id':f'performer-{actor+1:02d}','file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'bones':len(rig.data.bones),'frames':241,'duration':10,'repairedJointSamples':repaired,'groundCorrectionRange':[min(corrections),max(corrections)],'modelSource':'MakeHuman CC0 female macro, 2K Asian female skin, fitted CC0 short hair/brown eyes/eyebrows/suit/shoes, anatomical weights; authored student cap/buttons','motionSource':'MediaPipe monocular estimates, 5-frame smoothing, low-confidence interpolation, authored 9.5s hold','notOriginalActorIdentity':True})
 if a.render and actor==0:
  scene.frame_set(0);bpy.ops.object.camera_add(location=(.7,-3.4,1.5));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
  bpy.ops.object.light_add(type='AREA',location=(1,-3,4));bpy.context.object.data.energy=450;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
  scene.world.color=(.16,.16,.16);scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=600;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
  camera.location=(.12,-.9,1.48);camera.rotation_euler=(Vector((0,-.02,1.48))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=720;scene.render.resolution_y=720;scene.render.filepath=str(Path(a.render).resolve().with_name('portrait.png'));bpy.ops.render.render(write_still=True)
(out/'build-report.json').write_text(json.dumps({'actors':reports,'sourceVideoSha256':data['sourceSha256'],'measuredVolumetricCapture':False,'faceReconstruction':False,'wardrobe':'black tailored jacket/skirt/cap and fitted shoes, white socks, dark underlayer; historical accuracy unverified'},indent=2),encoding='utf-8')
