"""Produce owned FBX/BVH test inputs from the synthetic actor, never an API result."""
import bpy, sys, argparse
from pathlib import Path
import addon_utils
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--folder',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=Path(a.folder).resolve();folder.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(a.input).resolve()))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');bpy.context.view_layer.objects.active=rig
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True);bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=719
bpy.ops.export_scene.fbx(filepath=str(folder/'synthetic-motion.fbx'),use_selection=True,object_types={'ARMATURE'},add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=True)
addon_utils.enable('io_anim_bvh',default_set=False,persistent=False)
bpy.ops.export_anim.bvh(filepath=str(folder/'synthetic-motion.bvh'),frame_start=0,frame_end=719,root_transform_only=True)
