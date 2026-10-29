"""Export the same provisional photo facade used by the web stage, plus a separate
depth proxy. These are authored 2.5D surfaces, not a metric building reconstruction."""
import argparse,json,sys
from pathlib import Path
import bpy
p=argparse.ArgumentParser();p.add_argument('--photo',required=True);p.add_argument('--data',required=True);p.add_argument('--out',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
data=json.loads(Path(a.data).read_text());out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True);w=data['widthMeters'];h=data['heightMeters']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
image=bpy.data.images.load(str(Path(a.photo).resolve()));mat=bpy.data.materials.new('Supplied room photo');mat.use_nodes=True;tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
root=bpy.data.objects.new('BuildingGroup',None);root['provisionalDimensions']=True;root['units']='meters';root['opaqueInCameraByDefault']=False;bpy.context.collection.objects.link(root)
for s in data['segments']:
 u0,u1=s['u'];v0,v1=s['v'];coords=[(u0,v0),(u1,v0),(u1,v1),(u0,v1)];depth=.065 if s['kind']=='column' else .02
 mesh=bpy.data.meshes.new(s['id']);mesh.from_pydata([(w*(.5-u),depth,h*v) for u,v in coords],[],[(0,1,2,3)]);mesh.update();uv=mesh.uv_layers.new()
 for loop,coord in zip(mesh.polygons[0].loop_indices,coords):uv.data[loop].uv=coord
 obj=bpy.data.objects.new('PHOTO_'+s['id'],mesh);obj.parent=root;obj['structure']=s['kind'];bpy.context.collection.objects.link(obj);mesh.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=str(out/'facade.glb'),export_format='GLB',export_animations=False,export_extras=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=bpy.data.objects.new('DepthOcclusionModel',None);root['depthOnlyProxy']=True;root['requiresColorWriteFalse']=True;root['provisionalDimensions']=True;bpy.context.collection.objects.link(root)
for s in data['segments']:
 if s['kind']!='column':continue
 u0,u1=s['u'];bpy.ops.mesh.primitive_cube_add(size=1,location=(w*(.5-(u0+u1)/2),.06,h/2));obj=bpy.context.object;obj.name='MASK_'+s['id'];obj.scale=(w*(u1-u0),.12,h);obj.parent=root
bpy.ops.export_scene.gltf(filepath=str(out/'facade-depth.glb'),export_format='GLB',export_animations=False,export_extras=True)
