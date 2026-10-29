"""CC0 anatomical shapes and fitted assets. No guessed mannequin eyes/foot ellipsoids.
Proxy fitting uses the published MHCLO barycentric/offset data format."""
from pathlib import Path
from collections import defaultdict
import json, math
import bpy, bmesh
from mathutils import Vector

def apply_phenotype(vertices,folder):
    original=[Vector(v) for v in vertices]
    result=[v.copy() for v in original]
    for filename,strength in [('asian-female-young.target',1),('mouth-angles-up.target',.22)]:
        for line in (Path(folder)/filename).read_text(encoding='utf-8').splitlines():
            values=line.split()
            if len(values)==4 and values[0].isdigit():
                index=int(values[0]);result[index]+=Vector(tuple(map(float,values[1:])))*strength
    return original,result

def anatomical_weights(folder,count):
    weights=[defaultdict(float) for _ in range(count)]
    def name(bone):
        side='Left' if bone.endswith('.L') else 'Right'
        if bone.startswith('upperarm'):return side+'UpperArm'
        if bone.startswith('lowerarm'):return side+'LowerArm'
        if bone.startswith(('finger','metacarpal','wrist','hand')):return side+'Hand'
        if bone.startswith('upperleg'):return side+'UpperLeg'
        if bone.startswith('lowerleg'):return side+'LowerLeg'
        if bone.startswith(('foot','toe')):return side+'Foot'
        if bone.startswith(('pelvis','root')):return 'Hips'
        if bone in ['spine05']:return 'Hips'
        if bone in ['spine03','spine04']:return 'Spine'
        if bone.startswith(('spine','breast','shoulder','clavicle')):return 'Chest'
        if bone.startswith('neck'):return 'Neck'
        return 'Head'
    source=json.loads((Path(folder)/'default_weights.mhw').read_text(encoding='utf-8'))['weights']
    for bone,values in source.items():
        for index,weight in values:
            if index<count:weights[index][name(bone)]+=weight
    return weights

def proxy_data(path,original,morphed):
    mapping=[];delete=set();scales=[1.,1.,1.];mode=None
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        v=line.split()
        if not v or v[0].startswith('#'):continue
        if v[0] in ['x_scale','y_scale','z_scale']:
            axis=['x_scale','y_scale','z_scale'].index(v[0]);scales[axis]=abs(morphed[int(v[1])][axis]-morphed[int(v[2])][axis])/float(v[3])
        elif v[0]=='verts':mode='verts'
        elif v[0]=='delete_verts':mode='delete'
        elif mode=='verts' and v[0].isdigit():
            if len(v)==1:mapping.append(([int(v[0])],[1.],Vector()))
            elif len(v)==9:mapping.append((list(map(int,v[:3])),list(map(float,v[3:6])),Vector(tuple(map(float,v[6:9])))))
        elif mode=='delete' and v[0].isdigit():
            if len(v)==3 and v[1]=='-':delete.update(range(int(v[0]),int(v[2])+1))
            else:delete.update(int(i) for i in v if i.isdigit())
    points=[]
    for indices,bary,offset in mapping:
        point=sum((morphed[i]*w for i,w in zip(indices,bary)),Vector())
        point+=Vector(tuple(offset[i]*scales[i] for i in range(3)));points.append(point)
    return points,mapping,delete

def obj_data(path):
    vertices=[];uv=[];faces=[]
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if line.startswith('v '):vertices.append(Vector(tuple(map(float,line.split()[1:4]))))
        elif line.startswith('vt '):uv.append(tuple(map(float,line.split()[1:3])))
        elif line.startswith('f '):faces.append([tuple(int(n)-1 if n else -1 for n in word.split('/')) for word in line.split()[1:]])
    return vertices,uv,faces

def texture_material(name,path,color=(1,1,1,1),rough=.7,alpha=False):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Roughness'].default_value=rough
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(Path(path).resolve()),check_existing=True)
    if color[:3]!=(1,1,1):
        mix=mat.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=color;mat.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);mat.node_tree.links.new(mix.outputs[0],bsdf.inputs['Base Color'])
    else:mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    if alpha:
        mat.node_tree.links.new(tex.outputs['Alpha'],bsdf.inputs['Alpha']);mat.surface_render_method='DITHERED';mat.use_backface_culling=False
    return mat

def dress(body,rig,folder,original,morphed,convert,source_weights,raw_body_indices,bind,mesh,material,sphere,joint,actor):
    folder=Path(folder)/'appearance';body_delete=set();items=[]
    def asset(relative,mat,force=None):
        path=folder/relative;raw,uv,faces=obj_data(path.with_suffix('.obj'));points,mapping,deleted=proxy_data(path.with_suffix('.mhclo'),original,morphed)
        if len(points)!=len(raw):raise ValueError(f'Proxy/mesh vertex count mismatch: {relative}')
        obj=mesh(path.stem,[convert(v) for v in points],[[v[0] for v in f] for f in faces],mat)
        layer=obj.data.uv_layers.new(name='MakeHumanUV')
        for polygon,face in zip(obj.data.polygons,faces):
            for loop,v in zip(polygon.loop_indices,face):layer.data[loop].uv=uv[v[1]]
        proxyweights=[]
        for indices,bary,offset in mapping:
            d=defaultdict(float)
            for index,weight in zip(indices,bary):
                for bone,w in source_weights[index].items():d[bone]+=max(0,weight)*w
            proxyweights.append(d)
        bind(obj,rig,force,weights=None if force else proxyweights);body_delete.update(deleted);items.append(obj);return obj
    cloth=material('Tailored black school uniform',(.012,.015,.019,1),.8)
    white=material('Cotton collar and socks',(.79,.79,.75,1),.93)
    shoesmat=material('Black rubber shoes',(.009,.010,.012,1),.65)
    garment=asset('clothes/female_elegantsuit01/female_elegantsuit01',cloth)
    garment.data.materials.append(white)
    neck=joint('neck');hips=joint('pelvis');waist=hips.z+.06
    for vertex in garment.data.vertices:
        if vertex.co.z<waist:
            for group in garment.vertex_groups:group.remove([vertex.index])
            garment.vertex_groups['Hips'].add([vertex.index],1,'REPLACE')
            t=max(0,min(1,(waist-vertex.co.z)/.37));angle=math.atan2(vertex.co.y,vertex.co.x)
            flare=1+.2*t*t+.012*t*math.cos(angle*16);vertex.co.x*=flare;vertex.co.y*=flare
    shoe=asset('clothes/shoes02/shoes02',shoesmat)
    shoe.name='BlackRubberSchoolShoes';shoe.data.materials.append(white)
    for face in shoe.data.polygons:
        if face.center.z>.105:face.material_index=1
    hairmat=texture_material('Natural dark short hair',folder/'hair/short02/short02_diffuse.png',(.055,.043,.032,1),.83,True)
    asset('hair/short02/short02',hairmat,'Head')
    eyemat=texture_material('Natural brown eyes',folder/'eyes/materials/brown_eye.png',rough=.42,alpha=True)
    asset('eyes/high-poly/high-poly',eyemat,'Head')
    browmat=texture_material('Natural eyebrows',folder/'eyebrows/eyebrow001/eyebrow001.png',(.07,.045,.025,1),.9,True)
    asset('eyebrows/eyebrow001/eyebrow001',browmat,'Head')
    # Remove the actual body faces hidden by the fitted clothing/footwear masks.
    # A dark fitted underlayer avoids bright skin/white triangles at jacket
    # intersections. Keep the real neck skin instead of painting a jagged collar.
    body.data.materials.append(cloth);undershirt_material=len(body.data.materials)-1
    for face in body.data.polygons:
        c=face.center
        if neck.z-.135<c.z<neck.z-.07 and abs(c.x)<.035 and c.y<neck.y-.005:face.material_index=undershirt_material
    bm=bmesh.new();bm.from_mesh(body.data);bm.faces.ensure_lookup_table();bm.verts.ensure_lookup_table()
    lower_hem=min(v.co.z for v in garment.data.vertices)
    covered={'Hips','Spine','Chest','LeftUpperArm','LeftLowerArm','RightUpperArm','RightLowerArm','LeftUpperLeg','RightUpperLeg'}
    dominant={v.index:body.vertex_groups[max(v.groups,key=lambda g:g.weight).group].name for v in body.data.vertices if v.groups}
    hidden=[f for f in bm.faces if not (f.calc_center_median().z>neck.z-.065 and abs(f.calc_center_median().x)<.065) and f.material_index!=undershirt_material and (all(raw_body_indices[v.index] in body_delete for v in f.verts) or
        all(dominant.get(v.index) in covered for v in f.verts) and lower_hem+.01<f.calc_center_median().z<neck.z-.01)]
    bmesh.ops.delete(bm,geom=hidden,context='FACES_ONLY');bm.to_mesh(body.data);bm.free();body.data.update()
    # A modest peaked student cap, seated on the hair rather than floating.
    top=max(convert(v).z for v in morphed[:13380]);eyeL=joint('l-eye');eyeR=joint('r-eye');head=joint('head')
    capz=top+.006;capblack=material('Matte black student cap',(.01,.012,.016,1),.85)
    def ring(name,levels):
        verts=[];N=48
        for z,rx,ry in levels:
            verts.extend((rx*math.cos(i*2*math.pi/N),head.y+ry*math.sin(i*2*math.pi/N),z) for i in range(N))
        faces=[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(len(levels)-1) for i in range(N)]
        faces.append(tuple(range((len(levels)-1)*N,len(levels)*N)))
        obj=mesh(name,verts,faces,capblack);bind(obj,rig,'Head');return obj
    radius=max(.082,abs(eyeL.x-eyeR.x)*1.65)
    ring('Tailored student cap',[(capz-.039,radius*.94,.084),(capz-.014,radius,.09),(capz+.01,radius*.96,.086)])
    points=[(0,head.y-.072,capz-.028)]+[(radius*math.cos(t),head.y-.072-.062*math.sin(t),capz-.034-.006*math.sin(t)) for t in [i*math.pi/24 for i in range(25)]]
    visor=mesh('Student cap visor',points,[(0,i+1,i+2) for i in range(24)],capblack);bind(visor,rig,'Head')
    brass=material('Subtle brass buttons',(.25,.17,.07,1),.55,.6)
    # The underlayer follows the anatomical skin weights. Avoid floating
    # planar collar/bib polygons that separate from the neck during animation.
    # Find the actual front of the fitted shirt for each small button.
    for z in [neck.z-.09,neck.z-.17,neck.z-.25,neck.z-.33]:
        candidates=[v.co for v in garment.data.vertices if abs(v.co.x)<.035 and abs(v.co.z-z)<.03]
        if candidates:sphere('Uniform button',(0,min(v.y for v in candidates)-.003,z),(.0045,.0025,.0045),brass,rig,'Chest' if z>hips.z+.18 else 'Spine')
    return shoe
