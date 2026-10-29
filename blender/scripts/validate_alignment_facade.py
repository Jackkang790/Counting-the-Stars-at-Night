"""Source reopen + independent GLB graph/anchor/material checks + reimport renders."""
import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_alignment_facade import ROOT, MODEL, BLEND, POINTS, LAYERS, bounds, preview_stage, set_camera, render, write_json, xyz

REPORT=ROOT/"blender/reports/alignment_validation.json"
CHECKS=[]


def check(name,passed,evidence=None):
    CHECKS.append({"name":name,"passed":bool(passed),"evidence":evidence})
    if not passed:
        write_json(REPORT,{"passed":False,"checks":CHECKS})
        raise AssertionError(f"{name}: {evidence}")


def node_matrix(node):
    if "matrix" in node:
        return Matrix([node["matrix"][i::4] for i in range(4)])
    x,y,z,w=node.get("rotation",[0,0,0,1])
    return Matrix.LocRotScale(Vector(node.get("translation",[0,0,0])),Quaternion((w,x,y,z)),
                              Vector(node.get("scale",[1,1,1])))


def values(g,b,index):
    acc=g["accessors"][index]
    view=g["bufferViews"][acc["bufferView"]]
    fmt,size={5126:("f",4),5125:("I",4),5123:("H",2),5121:("B",1)}[acc["componentType"]]
    width={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}[acc["type"]]
    start=view.get("byteOffset",0)+acc.get("byteOffset",0)
    stride=view.get("byteStride",size*width)
    return [struct.unpack_from("<"+fmt*width,b,start+i*stride) for i in range(acc["count"])]


def binary_check():
    raw=MODEL.read_bytes()
    magic,version,length=struct.unpack_from("<4sII",raw)
    check("GLB2 header",magic==b"glTF" and version==2 and length==len(raw))
    chunks,cursor={},12
    while cursor<len(raw):
        length,kind=struct.unpack_from("<II",raw,cursor)
        check("Complete aligned chunk",length%4==0 and cursor+length+8<=len(raw))
        chunks[kind]=raw[cursor+8:cursor+8+length]
        cursor+=length+8
    check("Only JSON/BIN",set(chunks)=={0x4E4F534A,0x004E4942})
    g,b=json.loads(chunks[0x4E4F534A]),chunks[0x004E4942]
    check("Self contained, no texture or decoder",not g.get("images") and not g.get("textures") and
          not g.get("extensionsRequired") and all("uri" not in x for x in g["buffers"]))
    check("Static fixture; no camera/light/skin",not any(g.get(k) for k in ["animations","cameras","skins"]) and
          "KHR_lights_punctual" not in g.get("extensionsUsed",[]))
    nodes={n["name"]:i for i,n in enumerate(g["nodes"])}
    check("Anchor/layers/points named",all(n in nodes for n in ["ANCHOR_Facade",*LAYERS,*POINTS]))
    roots=g["scenes"][g.get("scene",0)]["nodes"]
    check("Single scene / root",len(g["scenes"])==1 and roots==[nodes["ANCHOR_Facade"]])
    transforms={}
    all_points=[]
    def walk(index,parent):
        node=g["nodes"][index]
        world=parent@node_matrix(node)
        transforms[node["name"]]=world
        if "mesh" in node:
            for primitive in g["meshes"][node["mesh"]]["primitives"]:
                all_points.extend(world@Vector(p) for p in values(g,b,primitive["attributes"]["POSITION"]))
        for child in node.get("children",[]):
            walk(child,world)
    walk(roots[0],Matrix.Identity(4))
    for name,expected in POINTS.items():
        actual=list(transforms[name].translation)
        check("GLB reference "+name,all(abs(a-b)<1e-5 for a,b in zip(actual,expected)),actual)
        check("Point is empty "+name,"mesh" not in g["nodes"][nodes[name]])
    check("Anchor identity",all(abs(transforms["ANCHOR_Facade"][i][j]-(1 if i==j else 0))<1e-6
          for i in range(4) for j in range(4)))
    check("Front normal metadata",g["nodes"][nodes["ANCHOR_Facade"]]["extras"]["front_gltf"]=="-Z")
    low=[min(p[i] for p in all_points) for i in range(3)]
    high=[max(p[i] for p in all_points) for i in range(3)]
    check("Y-up fixture bounds",abs(low[0]+3.08)<1e-4 and abs(high[0]-3.08)<1e-4 and
          abs(low[1]+.075)<1e-4 and abs(high[1]-3.68)<1e-4 and abs(high[2]-.2)<1e-5,
          {"min":low,"max":high})
    mats=g["materials"]
    transparent=[m for m in mats if m.get("alphaMode","OPAQUE")=="BLEND"]
    check("One transparent PBR material",len(mats)==8 and len(transparent)==1 and
          transparent[0]["name"]=="ALIGN_OverlayCyan" and
          abs(transparent[0]["pbrMetallicRoughness"]["baseColorFactor"][3]-.28)<1e-5)
    check("Culled front faces",all(not m.get("doubleSided",False) for m in mats))
    primitives=[p for mesh in g["meshes"] for p in mesh["primitives"]]
    triangles=sum(g["accessors"][p["indices"]]["count"]//3 for p in primitives)
    vertices=sum(g["accessors"][p["attributes"]["POSITION"]]["count"] for p in primitives)
    check("Mobile budget",triangles<=8000 and vertices<=12000 and len(primitives)<=16 and len(raw)<=1000000,
          {"triangles":triangles,"vertices":vertices,"primitives":len(primitives),"bytes":len(raw)})
    for i,p in enumerate(primitives):
        check(f"Primitive {i} normals / triangles","NORMAL" in p["attributes"] and p.get("mode",4)==4)
        positions=values(g,b,p["attributes"]["POSITION"])
        check(f"Primitive {i} finite positions",all(math.isfinite(v) for row in positions for v in row))
    return g,{"triangles":triangles,"vertices":vertices,"primitives":len(primitives),"materials":len(mats),
              "bytes":len(raw),"bounds_gltf_m":{"min":low,"max":high,"size":[b-a for a,b in zip(low,high)]}}


def pixels(path):
    image=bpy.data.images.load(str(path),check_existing=False)
    data=np.empty(len(image.pixels),dtype=np.float32)
    image.pixels.foreach_get(data)
    data=data.reshape(image.size[1],image.size[0],4)[:,:,:3].copy()
    bpy.data.images.remove(image)
    return data


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--skip-renders",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    scene=bpy.context.scene
    check("BLEND opened in metres",scene.unit_settings.system=="METRIC" and scene.unit_settings.scale_length==1)
    check("Source layers",all(bpy.data.objects.get(n) is not None for n in ["ANCHOR_Facade",*LAYERS]))
    for name,point in POINTS.items():
        actual=bpy.data.objects[name].matrix_world.translation
        check("BLEND point "+name,(actual-Vector(xyz(point))).length<1e-5)
    check("Source preview isolated",bpy.data.collections.get("PREVIEW_ONLY_NOT_EXPORTED") is not None)
    g,stats=binary_check()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(MODEL))
    scene=bpy.context.scene
    meshes=[o for o in scene.objects if o.type=="MESH"]
    check("GLB reimport meshes",len(meshes)==11)
    for name,point in POINTS.items():
        actual=bpy.data.objects[name].matrix_world.translation
        check("Reimport point "+name,(actual-Vector(xyz(point))).length<1e-5)
    actual=bounds(meshes)
    check("Reimport bounds",all(abs(a-b)<1e-5 for a,b in zip(actual["size"],stats["bounds_gltf_m"]["size"])))
    for mat in g["materials"]:
        imported=bpy.data.materials.get(mat["name"])
        pbr=next((n for n in imported.node_tree.nodes if n.type=="BSDF_PRINCIPLED"),None) if imported else None
        check("Reimport PBR "+mat["name"],pbr is not None)
        expected=mat["pbrMetallicRoughness"].get("baseColorFactor",[1]*4)
        check("Reimport colour "+mat["name"],all(abs(a-b)<1e-5 for a,b in zip(pbr.inputs["Base Color"].default_value[:3],expected[:3])))
        check("Reimport alpha "+mat["name"],abs(pbr.inputs["Alpha"].default_value-expected[3])<1e-5)
    if not args.skip_renders:
        preview_stage(scene)
        set_camera(scene,"front")
        render(scene,"alignment_glb_front.png")
        set_camera(scene,"oblique")
        for obj in meshes:
            if obj.parent.name=="REFERENCE_Facade":
                obj.hide_render=True
        render(scene,"alignment_glb_overlay_only.png")
        for source,target in [("alignment_front.png","alignment_glb_front.png"),
                              ("alignment_overlay_only.png","alignment_glb_overlay_only.png")]:
            a=pixels(ROOT/"blender/renders"/source)
            b=pixels(ROOT/"blender/renders"/target)
            rmse=float(np.sqrt(np.mean((a-b)**2)))
            check("Render comparison "+target,rmse<=.025,{"rgb_rmse":rmse,"limit":.025})
    write_json(REPORT,{"passed":True,"blender_version":bpy.app.version_string,"checks":CHECKS,
        "glb_sha256":hashlib.sha256(MODEL.read_bytes()).hexdigest(),
        "source_blend_sha256":hashlib.sha256(BLEND.read_bytes()).hexdigest(),
        "statistics":stats,"reimport_rendered":not args.skip_renders,
        "mobile_device_tested":False,"reference_status":"synthetic_not_a_real_building"})
    print("ALIGNMENT_VALIDATION_OK",json.dumps(stats),flush=True)


if __name__=="__main__":
    main()
