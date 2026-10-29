"""Bounded offline humanoid retarget. Inputs are data; automatic script execution is disabled."""
import argparse, json, re, sys, math
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--motion',required=True);p.add_argument('--output',required=True);p.add_argument('--report',required=True)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def load(path):
    before=set(bpy.data.objects);suffix=Path(path).suffix.lower()
    if suffix=='.glb':bpy.ops.import_scene.gltf(filepath=str(Path(path).resolve()))
    elif suffix=='.fbx':bpy.ops.import_scene.fbx(filepath=str(Path(path).resolve()),use_anim=True)
    elif suffix=='.bvh':
        import addon_utils
        addon_utils.enable('io_anim_bvh',default_set=False,persistent=False)
        bpy.ops.import_anim.bvh(filepath=str(Path(path).resolve()),axis_forward='-Z',axis_up='Y',frame_start=0,use_fps_scale=True,update_scene_fps=False)
    else:raise ValueError('Only self-contained GLB, FBX or BVH supported')
    objects=set(bpy.data.objects)-before;rigs=[o for o in objects if o.type=='ARMATURE']
    if len(rigs)!=1:raise ValueError('Each input must contain exactly one armature')
    return objects,rigs[0]
target_objects,target=load(args.model);source_objects,source=load(args.motion)
if source.animation_data and not source.animation_data.action:
    strips=[strip for track in source.animation_data.nla_tracks for strip in track.strips if strip.action]
    if len(strips)==1:
        source.animation_data.action=strips[0].action
        for track in source.animation_data.nla_tracks:track.mute=True
if not source.animation_data or not source.animation_data.action:raise ValueError('Motion input has no action')
aliases={'hips':['hips','pelvis'],'spine':['spine'],'chest':['chest','spine1','spine2'],'neck':['neck'],'head':['head']}
for side,prefix in [('left','l'),('right','r')]:
    for part,names in [('upperarm',[side+'upperarm',side+'arm','upperarm'+prefix]),('lowerarm',[side+'lowerarm',side+'forearm','forearm'+prefix]),('hand',[side+'hand','hand'+prefix]),('upperleg',[side+'upperleg',side+'upleg','thigh'+prefix]),('lowerleg',[side+'lowerleg',side+'leg','calf'+prefix,'shin'+prefix]),('foot',[side+'foot','foot'+prefix])]:aliases[side+part]=names
def canonical(rig):
    result={}
    for bone in rig.pose.bones:
        normalized=re.sub('[^a-z]','',bone.name.split(':')[-1].lower()).removeprefix('mixamorig')
        for key,names in aliases.items():
            if normalized in names and key not in result:result[key]=bone.name
    return result
tm,sm=canonical(target),canonical(source)
required=['hips','head','leftupperarm','rightupperarm','leftlowerarm','rightlowerarm','leftupperleg','rightupperleg','leftlowerleg','rightlowerleg','leftfoot','rightfoot']
missing=[key for key in required if key not in tm or key not in sm]
if missing:raise ValueError('Unsupported humanoid bone mapping: '+','.join(missing))
mapping={tm[key]:sm[key] for key in tm if key in sm}
rest_s={name:(source.matrix_world @ source.data.bones[name].matrix_local).to_quaternion() for name in mapping.values()}
rest_t={name:(target.matrix_world @ target.data.bones[name].matrix_local).to_quaternion() for name in mapping}
root=target.pose.bones[tm['hips']];root_rest=root.bone.matrix_local.translation.copy()
source_root=source.pose.bones[sm['hips']];source_rest=source_root.bone.matrix_local.translation.copy()
ratio=(target.dimensions.z/source.dimensions.z) if source.dimensions.z>.1 else 1
start,end=source.animation_data.action.frame_range
fps=bpy.context.scene.render.fps or 24
# glTF import uses the scene FPS; output is resampled to a bounded 30-second window.
frames=min(720,max(2,int(end-start)+1));scene=bpy.context.scene
target.animation_data_clear();target.animation_data_create();action=bpy.data.actions.new('RetargetedPerformance');target.animation_data.action=action
ordered=sorted(mapping,key=lambda name:len(target.pose.bones[name].parent_recursive))
previous, anchors = {}, {}
max_correction=0.0;stance_samples=0;residual=[]
floor=None
for frame in range(frames):
    scene.frame_set(int(start)+frame)
    for name in ordered:
        pb=target.pose.bones[name];src=source.pose.bones[mapping[name]]
        delta=(source.matrix_world @ src.matrix).to_quaternion() @ rest_s[src.name].inverted()
        current_world=target.matrix_world @ pb.matrix
        desired=(delta @ rest_t[name]).to_matrix().to_4x4();desired.translation=current_world.translation
        pb.matrix=target.matrix_world.inverted() @ desired;bpy.context.view_layer.update()
    # Keep root X/Y at its rest position (Blender Z is vertical). Preserve vertical motion.
    vertical=(source_root.matrix.translation.z-source_rest.z)*ratio
    matrix=root.matrix.copy();matrix.translation=Vector((root_rest.x,root_rest.y,root_rest.z+vertical));root.matrix=matrix;bpy.context.view_layer.update()
    feet={key:(target.matrix_world @ target.pose.bones[tm[key]].matrix).translation.copy() for key in ['leftfoot','rightfoot']}
    if floor is None:floor=min(v.z for v in feet.values())
    adjustments=[]
    for key,pos in feet.items():
        speed=(pos-previous.get(key,pos)).length
        if pos.z<=floor+.06 and speed<.03:
            anchors.setdefault(key,pos.copy());adjustments.append(anchors[key]-pos);stance_samples+=1
        else:anchors.pop(key,None)
        previous[key]=pos.copy()
    if adjustments:
        delta=sum(adjustments,Vector())/len(adjustments)
        delta.z=max(0,floor-min(v.z for v in feet.values()))
        if delta.length>.15:delta=delta.normalized()*.15
        matrix=root.matrix.copy();matrix.translation+=target.matrix_world.inverted().to_3x3() @ delta;root.matrix=matrix;bpy.context.view_layer.update();max_correction=max(max_correction,delta.length)
        for key in anchors:
            pos=(target.matrix_world @ target.pose.bones[tm[key]].matrix).translation
            residual.append((pos-anchors[key]).length)
    for name in ordered:
        pb=target.pose.bones[name];pb.rotation_mode='QUATERNION';pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('location',frame=frame)
for obj in source_objects:bpy.data.objects.remove(obj,do_unlink=True)
# glTF's default exporter considers all compatible actions, including imported source
# actions. Export only the newly baked action so preview and AR select the same motion.
for other in list(bpy.data.actions):
    if other != action:bpy.data.actions.remove(other)
scene.frame_start=0;scene.frame_end=frames-1;scene.frame_set(0)
for obj in bpy.context.selected_objects:obj.select_set(False)
for obj in target_objects:obj.select_set(True)
bpy.context.view_layer.objects.active=target
out=Path(args.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_frame_range=True,export_extras=True)
report={'boneMap':mapping,'frames':frames,'fps':fps,'durationSeconds':(frames-1)/fps,'rootMotion':'horizontal root locked; vertical retained','footCorrection':'bounded stance stabilization, not guaranteed cleanup','stanceSamples':stance_samples,'maxCorrectionMeters':max_correction,'maxStanceResidualMeters':max(residual,default=0),'manualMotionAndFootReviewRequired':True}
Path(args.report).write_text(json.dumps(report,indent=2),encoding='utf-8')
