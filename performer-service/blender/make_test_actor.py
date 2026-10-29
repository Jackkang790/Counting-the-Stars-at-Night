"""Project-owned synthetic calibration actor. Not a reconstructed person."""
import argparse, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--output', required=True)
args.add_argument('--rig-output', required=True)
opts = args.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
arm = bpy.data.objects.new('TEST_SYNTHETIC_ACTOR', bpy.data.armatures.new('CalibrationRig'))
bpy.context.collection.objects.link(arm); bpy.context.view_layer.objects.active=arm; arm.select_set(True)
arm['syntheticCalibration']=True
bpy.ops.object.mode_set(mode='EDIT')
spec = [('Hips',(0,0,.9),(0,0,1.02),None),('Spine',(0,0,1.02),(0,0,1.2),'Hips'),('Chest',(0,0,1.2),(0,0,1.38),'Spine'),('Neck',(0,0,1.38),(0,0,1.48),'Chest'),('Head',(0,0,1.48),(0,0,1.7),'Neck')]
for side,s in [('Left',1),('Right',-1)]:
    spec += [(side+'UpperArm',(.14*s,0,1.34),(.43*s,0,1.25),'Chest'),(side+'LowerArm',(.43*s,0,1.25),(.65*s,0,1.2),side+'UpperArm'),(side+'Hand',(.65*s,0,1.2),(.75*s,0,1.2),side+'LowerArm'),(side+'UpperLeg',(.09*s,0,.94),(.12*s,0,.53),'Hips'),(side+'LowerLeg',(.12*s,0,.53),(.12*s,0,.12),side+'UpperLeg'),(side+'Foot',(.12*s,0,.12),(.12*s,.16,.06),side+'LowerLeg')]
for name,head,tail,parent in spec:
    bone=arm.data.edit_bones.new(name);bone.head=head;bone.tail=tail
    if parent:bone.parent=arm.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
materials=[]
for name,color in [('orange',(.95,.32,.06,1)),('cyan',(.03,.6,.7,1)),('dark',(.02,.03,.05,1))]:
    m=bpy.data.materials.new(name);m.diffuse_color=color;materials.append(m)
def part(name,center,scale,bone,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Skin','ARMATURE');mod.object=arm;obj.parent=arm;obj.data.materials.append(material)
part('TestHead',(0,0,1.59),(.12,.11,.15),'Head',materials[1])
part('TestBody',(0,0,1.2),(.19,.11,.22),'Chest',materials[0])
part('TestPelvis',(0,0,.92),(.17,.1,.12),'Hips',materials[1])
for name,head,tail,_ in spec[5:]:
    midpoint=(Vector(head)+Vector(tail))/2
    part('Segment_'+name,midpoint,(.065,.065,max(.06,(Vector(tail)-Vector(head)).length/2)),name,materials[0 if 'Leg' in name else 1])
for x in [-.045,.045]:part('TestEye',(x,.1,1.63),(.018,.02,.018),'Head',materials[2])
bpy.context.scene.render.fps=24;bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=720
for frame in range(0,721,12):
    t=frame/24
    for bone in arm.pose.bones:
        bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0);bone.location=(0,0,0)
        if 'UpperArm' in bone.name:bone.rotation_euler.y=.7*math.sin(t*math.pi)*(1 if bone.name.startswith('Left') else -1)
        if bone.name=='Chest':bone.rotation_euler.z=.18*math.sin(t*math.pi)
        if bone.name=='Hips':bone.location.y=.025*math.sin(t*math.pi*2)
        bone.keyframe_insert('rotation_euler',frame=frame);bone.keyframe_insert('location',frame=frame)
arm.animation_data.action.name='SyntheticCalibrationDance'
bpy.context.scene.frame_set(0)
for path,animated in [(opts.output,True),(opts.rig_output,False)]:
    Path(path).resolve().parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',export_animations=animated,export_frame_range=True,export_extras=True)
print('Synthetic calibration actor exported; no real-person reconstruction performed.')
