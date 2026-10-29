"""Synthetic facade registration fixture; NOT a surveyed or historical building.

Geometry is specified in glTF metres, then converted to Blender Z-up for bpy.
Run from any cwd; writes only blender/ and public/models/ in this worktree.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET_ID = "alignment_test_facade"
MODEL = ROOT / "public/models/alignment_test_facade.glb"
BLEND = ROOT / "blender/scenes/alignment_test_facade.blend"
POINTS = {
    "PT_P00_Origin": (0, 0, 0),
    "PT_P01_WallBL": (-3, 0, 0), "PT_P02_WallBR": (3, 0, 0),
    "PT_P03_WallTL": (-3, 3.6, 0), "PT_P04_WallTR": (3, 3.6, 0),
    "PT_P05_DoorTL": (-.5, 2.2, 0), "PT_P06_DoorTR": (.5, 2.2, 0),
    "PT_P07_WindowLBL": (-2.35, 1.15, 0), "PT_P08_WindowLTR": (-1.15, 2.45, 0),
    "PT_P09_WindowRBL": (1.15, 1.15, 0), "PT_P10_WindowRTR": (2.35, 2.45, 0),
}
LAYERS = ("REFERENCE_Facade", "CALIBRATION_Markers", "CALIBRATION_Grid",
          "OVERLAY_Architecture", "POINTS_Facade")
DEPTHS = {"marker_front_z_m": -.024, "grid_front_z_m": -.034,
          "overlay_front_z_m": -.054, "target_plane_z_m": 0}


def xyz(point):
    x, y, z = point
    return (x, -z, y)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")


def empty(name, parent=None, position=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = xyz(position)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = .08
    return obj


def material(name, color, alpha=1, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    mat.diffuse_color = (*color, alpha)
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*color, 1)
    node.inputs["Alpha"].default_value = alpha
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = .7 if alpha == 1 else .38
    node.inputs["Emission Color"].default_value = (*color, 1)
    node.inputs["Emission Strength"].default_value = emission
    if alpha < 1:
        mat.surface_render_method = "BLENDED"
        mat.use_transparency_overlap = False
    return mat


class Geometry:
    def __init__(self):
        self.vertices, self.faces = [], []

    def box(self, low, high):
        x,y,z = low
        a,b,c = high
        assert a > x and b > y and c > z
        vertices = [(x,y,z),(a,y,z),(a,b,z),(x,b,z),
                    (x,y,c),(a,y,c),(a,b,c),(x,b,c)]
        faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]
        offset = len(self.vertices)
        self.vertices.extend(xyz(p) for p in vertices)
        for f in faces:
            self.faces.extend((offset+f[0], offset+f[i], offset+f[i+1]) for i in range(1, len(f)-1))

    def frame(self, x0,y0,x1,y1,width,z0,z1, bottom=True):
        self.box((x0-width,y0,z0),(x0,y1+width,z1))
        self.box((x1,y0,z0),(x1+width,y1+width,z1))
        self.box((x0,y1,z0),(x1,y1+width,z1))
        if bottom:
            self.box((x0-width,y0-width,z0),(x1+width,y0,z1))

    def object(self, name, mat, parent):
        mesh = bpy.data.meshes.new(name+"_Mesh")
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = parent
        obj.data.materials.append(mat)
        return obj


def build_asset():
    root = empty("ANCHOR_Facade")
    root["asset_id"] = ASSET_ID
    root["status"] = "SYNTHETIC_ALIGNMENT_FIXTURE_NOT_A_REAL_BUILDING"
    root["units"] = "meters"
    root["front_gltf"] = "-Z"
    root["anchor_definition"] = "front facade ground midpoint; target plane Z=0"
    groups = {name: empty(name, root) for name in LAYERS}
    mats = {
        "wall": material("ALIGN_Concrete", (.49,.44,.34)),
        "frame": material("ALIGN_Frame", (.15,.21,.25), metallic=.3),
        "panel": material("ALIGN_DoorAndWindow", (.025,.075,.105)),
        "dark": material("ALIGN_MarkerDark", (.012,.018,.02)),
        "marker": material("ALIGN_MarkerLime", (.75,.95,.10), emission=.6),
        "major": material("ALIGN_GridMajor", (.95,.72,.25), emission=.55),
        "minor": material("ALIGN_GridMinor", (.24,.65,.72), emission=.4),
        "overlay": material("ALIGN_OverlayCyan", (.08,.72,.95), alpha=.28, emission=.2),
    }
    wall, frame, panels = Geometry(), Geometry(), Geometry()
    # Modular solid cells leave real door/window holes; no boolean dependency.
    xs = [-3,-2.35,-1.15,-.5,.5,1.15,2.35,3]
    ys = [0,1.15,2.2,2.45,3.6]
    openings = [(-.5,0,.5,2.2),(-2.35,1.15,-1.15,2.45),(1.15,1.15,2.35,2.45)]
    for x0,x1 in zip(xs,xs[1:]):
        for y0,y1 in zip(ys,ys[1:]):
            cx,cy = (x0+x1)/2,(y0+y1)/2
            if not any(a < cx < c and b < cy < d for a,b,c,d in openings):
                wall.box((x0,y0,0),(x1,y1,.2))
    for i,(x0,y0,x1,y1) in enumerate(openings):
        frame.frame(x0,y0,x1,y1,.045,-.018,.035,bottom=i != 0)
        panels.box((x0+.012,y0+.012,.065),(x1-.012,y1-.012,.095))
        if i:
            mid = (x0+x1)/2
            frame.box((mid-.018,y0,-.016),(mid+.018,y1,.07))
            frame.box((x0,(y0+y1)/2-.018,-.016),(x1,(y0+y1)/2+.018,.07))
    frame.box((.32,1.01,-.045),(.36,1.16,.07))
    meshes = [wall.object("REF_Wall",mats["wall"],groups["REFERENCE_Facade"]),
              frame.object("REF_Frames",mats["frame"],groups["REFERENCE_Facade"]),
              panels.object("REF_Panels",mats["panel"],groups["REFERENCE_Facade"])]

    dark, markers = Geometry(), Geometry()
    for name,p in POINTS.items():
        point = empty(name,groups["POINTS_Facade"],p)
        point["position_gltf_m"] = list(p)
        point["plane_normal_gltf"] = [0,0,-1]
        x,y,_ = p
        dark.box((x-.075,y-.075,-.022),(x+.075,y+.075,-.018))
        # Broken cross/checker is for human inspection, NOT an optical tag family.
        markers.box((x-.063,y+.006,-.024),(x-.006,y+.063,-.0225))
        markers.box((x+.006,y-.063,-.024),(x+.063,y-.006,-.0225))
        markers.box((x-.022,y-.003,-.024),(x+.022,y+.003,-.0225))
        markers.box((x-.003,y-.022,-.024),(x+.003,y+.022,-.0225))
    meshes.extend([dark.object("MARKERS_Dark",mats["dark"],groups["CALIBRATION_Markers"]),
                   markers.object("MARKERS_Lime",mats["marker"],groups["CALIBRATION_Markers"])])

    major,minor = Geometry(),Geometry()
    for i in range(13):
        x=-3+i*.5
        geom=major if i%2==0 else minor
        width=.003 if i%2==0 else .0015
        geom.box((x-width/2,0,-.034),(x+width/2,3.6,-.032))
    for i in range(8):
        y=i*.5
        geom=major if i%2==0 else minor
        width=.003 if i%2==0 else .0015
        geom.box((-3,y-width/2,-.034),(3,y+width/2,-.032))
    # 20cm vernier with exact 10mm pitch and a 5cm major tick, near the origin.
    major.box((.15,.23,-.036),(.35,.232,-.0345))
    for i in range(21):
        x=.15+i*.01
        height=.045 if i%5==0 else .025
        major.box((x-.0005,.23,-.036),(x+.0005,.23+height,-.0345))
    meshes.extend([major.object("GRID_MajorAndVernier",mats["major"],groups["CALIBRATION_Grid"]),
                   minor.object("GRID_Minor",mats["minor"],groups["CALIBRATION_Grid"])])

    for i,(x0,y0,x1,y1) in enumerate(openings):
        ghost = Geometry()
        ghost.frame(x0,y0,x1,y1,.09,-.054,-.046,bottom=i!=0)
        name = ("OVERLAY_Door","OVERLAY_WindowLeft","OVERLAY_WindowRight")[i]
        meshes.append(ghost.object(name,mats["overlay"],groups["OVERLAY_Architecture"]))
    ghost = Geometry()
    ghost.box((-3.08,3.48,-.054),(3.08,3.68,-.046))
    meshes.append(ghost.object("OVERLAY_Cornice",mats["overlay"],groups["OVERLAY_Architecture"]))
    return root, groups, meshes


def bounds(meshes):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(p) for obj in meshes for p in obj.bound_box]
    points = [(p.x,p.z,-p.y) for p in points]
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    return {"min":low,"max":high,"size":[b-a for a,b in zip(low,high)]}


def look_at(obj,point):
    obj.rotation_euler=(Vector(xyz(point))-obj.location).to_track_quat("-Z","Y").to_euler()


def preview_stage(scene):
    col=bpy.data.collections.new("PREVIEW_ONLY_NOT_EXPORTED")
    scene.collection.children.link(col)
    cam=bpy.data.objects.new("PREVIEW_Camera",bpy.data.cameras.new("PREVIEW_Camera"))
    col.objects.link(cam)
    cam.data.type="ORTHO"
    cam.data.ortho_scale=7.4
    scene.camera=cam
    set_camera(scene,"oblique")
    for name,point,energy,size,color in [
        ("Key",(-3,6,-4),1600,5,(1,.90,.76)),
        ("Fill",(4,3,-2),1000,4,(.62,.8,1)),
        ("Rim",(0,5,3),1400,3,(1,.72,.43)),
    ]:
        data=bpy.data.lights.new("PREVIEW_"+name,"AREA")
        data.energy,data.size,data.color=energy,size,color
        light=bpy.data.objects.new(data.name,data)
        col.objects.link(light)
        light.location=xyz(point)
        look_at(light,(0,1.8,0))
    scene.world=bpy.data.worlds.new("PREVIEW_World")
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value=(.035,.055,.075,1)
    bg.inputs["Strength"].default_value=.6
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1280
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.view_settings.view_transform="AgX"


def set_camera(scene,view):
    point=(0,1.8,-10) if view=="front" else (6.2,4.4,-10)
    scene.camera.location=xyz(point)
    look_at(scene.camera,(0,1.8,0))


def render(scene,filename):
    scene.render.filepath=str(ROOT/"blender/renders"/filename)
    bpy.ops.render.render(write_still=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--skip-renders",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    for directory in ("blender/scenes","blender/renders","blender/reports","public/models"):
        (ROOT/directory).mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene
    scene.unit_settings.system="METRIC"
    scene.unit_settings.scale_length=1
    root,groups,meshes=build_asset()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root,*groups.values(),*meshes,*groups["POINTS_Facade"].children]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(MODEL),export_format="GLB",use_selection=True,
        export_yup=True,export_apply=True,export_materials="EXPORT",export_normals=True,
        export_texcoords=False,export_vertex_color="NONE",export_cameras=False,export_lights=False,
        export_animations=False,export_extras=True)
    write_json(ROOT/"blender/reports/alignment_build.json",{
        "asset_id":ASSET_ID,"status":"synthetic_alignment_fixture","blender_version":bpy.app.version_string,
        "historical_reconstruction":False,"nominal_wall_dimensions_m":[6,3.6,.2],
        "bounds_gltf_m":bounds(meshes),"triangles":sum(len(o.data.polygons) for o in meshes),
        "mesh_objects":len(meshes),"material_count":8,"textures":0,"animations":[],
        "reference_points_gltf_m":POINTS,"layer_depths":DEPTHS,"render_samples":24,
        "layer_meshes":{name:[o.name for o in group.children if o.type=="MESH"] for name,group in groups.items()},
    })
    preview_stage(scene)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    if not args.skip_renders:
        set_camera(scene,"front")
        render(scene,"alignment_front.png")
        set_camera(scene,"oblique")
        render(scene,"alignment_oblique.png")
        for obj in meshes:
            if obj.parent==groups["REFERENCE_Facade"]:
                obj.hide_render=True
        render(scene,"alignment_overlay_only.png")
    print("ALIGNMENT_BUILD_OK",flush=True)


if __name__=="__main__":
    main()
