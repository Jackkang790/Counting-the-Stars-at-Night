"""Procedural concept sculpture. Run with Blender 4.5 LTS --background --python.

All coordinates are metres in Blender Z-up. The glTF exporter converts to Y-up.
Only blender/ and public/models/ are written. No reference architecture is inferred.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSET_ID = "starseed_sculpture"
FPS = 30
CLIPS = {"Emerge": (1, 91), "Idle": (121, 241), "Disappear": (301, 346)}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def material(name, color, metallic, roughness, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    mat.diffuse_color = (*color, 1)
    pbr = mat.node_tree.nodes.get("Principled BSDF")
    pbr.inputs["Base Color"].default_value = (*color, 1)
    pbr.inputs["Metallic"].default_value = metallic
    pbr.inputs["Roughness"].default_value = roughness
    if emission:
        pbr.inputs["Emission Color"].default_value = (*emission, 1)
        pbr.inputs["Emission Strength"].default_value = 0.3
    return mat


class Geometry:
    def __init__(self):
        self.vertices = []
        self.faces = []

    def add(self, vertices, faces):
        offset = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(i + offset for i in face) for face in faces)

    def tube(self, points, radii, sides=8):
        """Parallel sampled circular sections, capped, with stable outward winding."""
        vertices, faces = [], []
        previous_u = None
        for i, point in enumerate(points):
            tangent = (Vector(points[min(i + 1, len(points)-1)]) -
                       Vector(points[max(0, i - 1)])).normalized()
            if previous_u is None:
                ref = Vector((0, 0, 1)) if abs(tangent.z) < 0.93 else Vector((0, 1, 0))
                u = tangent.cross(ref).normalized()
            else:
                # Transport the previous section: switching reference axes mid-curve
                # twists elliptical ribbons and creates visible cracks/pinches.
                u = (previous_u - tangent * previous_u.dot(tangent)).normalized()
            v = tangent.cross(u).normalized()
            previous_u = u
            rx, ry = radii[i]
            for j in range(sides):
                angle = 2 * math.pi * j / sides
                vertices.append(tuple(Vector(point) + u * rx * math.cos(angle) + v * ry * math.sin(angle)))
        for i in range(len(points)-1):
            for j in range(sides):
                k = i * sides + j
                n = i * sides + (j+1) % sides
                faces.append((k, n, n+sides, k+sides))
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple((len(points)-1)*sides + j for j in range(sides)))
        self.add(vertices, faces)

    def star(self, center, radius, depth, rotation=0):
        # A solid, five-point star facing Blender -Y / glTF +Z.
        vertices = []
        for y in (-depth/2, depth/2):
            for i in range(10):
                a = math.pi/2 + i * math.pi/5 + rotation
                r = radius if i % 2 == 0 else radius * 0.44
                vertices.append((center[0] + r*math.cos(a), center[1]+y, center[2] + r*math.sin(a)))
        faces = [tuple(range(10)), tuple(reversed(range(10, 20)))]
        faces.extend((i, i+10, (i+1) % 10+10, (i+1) % 10) for i in range(10))
        self.add(vertices, faces)

    def object(self, name, mat, parent):
        mesh = bpy.data.meshes.new(name + "_Mesh")
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat)
        obj.parent = parent
        for poly in mesh.polygons:
            poly.use_smooth = len(poly.vertices) == 4
        return obj


def merge(objects, name, parent):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    return obj


def build_asset():
    root = bpy.data.objects.new("ANCHOR_Ground", None)
    bpy.context.scene.collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root["asset_id"] = ASSET_ID
    root["reference_status"] = "PROVISIONAL_CONCEPT_WIREFRAME_NOT_AVAILABLE"
    root["anchor"] = "ground_center"
    root["units"] = "meters"
    root["front_blender"] = "+Y"
    root["front_gltf"] = "-Z"
    basalt = material("MAT_Basalt", (0.028, 0.047, 0.061), 0.15, 0.62)
    bronze = material("MAT_PatinatedBronze", (0.075, 0.23, 0.21), 0.58, 0.33)
    brass = material("MAT_BrushedBrass", (0.65, 0.39, 0.12), 0.62, 0.3)
    light = material("MAT_Starlight", (0.95, 0.76, 0.4), 0.15, 0.3, (1, 0.63, 0.17))

    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.62, depth=0.10, location=(0, 0, 0.05))
    plinth = bpy.context.object
    plinth.name = "Starseed_Plinth"
    plinth.data.materials.append(basalt)
    plinth.parent = root
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = plinth.modifiers.new("Baked_edge_bevel", "BEVEL")
    bevel.width = 0.012
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in plinth.data.polygons:
        p.use_smooth = len(p.vertices) == 4

    leaf = Geometry()
    gold = Geometry()
    stars = Geometry()
    # Two curved leaves with an elliptical section; all geometry is baked.
    for side in (-1, 1):
        points, radii = [], []
        for i in range(81):
            t = i / 80
            radius = 0.08 + 0.48 * math.sin(math.pi * t) ** 0.85
            angle = side * math.pi/2 + 1.65*t
            x = radius * math.cos(angle)
            y = 0.65 * radius * math.sin(angle)
            z = 0.105 + 2.10 * t
            points.append((x, y, z))
            width = 0.012 + 0.105 * math.sin(math.pi * t) ** 0.7
            radii.append((width, 0.012 + 0.006*math.sin(math.pi*t)))
        leaf.tube(points, radii, sides=8)
        # A fine gold seam follows each leaf without a texture map.
        seam = [(x, y - 0.022, z) for x, y, z in points]
        gold.tube(seam, [(0.007, 0.007)]*len(seam), sides=6)

    # An open orbit, tilted in depth, frames the star and keeps negative space.
    orbit = []
    for i in range(113):
        angle = math.radians(-65 + i / 112 * 300)
        orbit.append((0.57*math.cos(angle), 0.25*math.sin(angle)+0.06,
                      1.52 + 0.65*math.sin(angle)))
    gold.tube(orbit, [(0.016, 0.016)]*len(orbit), sides=8)
    # A small constellation grows upwards through the open centre.
    constellation = [(-0.13, -0.12, 0.42), (0.17, -0.13, 0.78),
                     (-0.16, -0.12, 1.12), (0.12, -0.13, 1.47), (0, -0.12, 1.87)]
    gold.tube(constellation, [(0.008, 0.008)]*len(constellation), sides=6)
    for i, pt in enumerate(constellation):
        stars.star(pt, 0.065 if i < 4 else 0.23, 0.035 if i < 4 else 0.065, (i % 2)*0.13)
    # A gold inset in the plinth is joined with all other brass: one draw call.
    ring = [(0.56*math.cos(i*2*math.pi/96), 0.56*math.sin(i*2*math.pi/96), 0.10) for i in range(97)]
    gold.tube(ring, [(0.006, 0.006)]*len(ring), sides=6)

    meshes = [plinth, leaf.object("Starseed_Leaves", bronze, root),
              gold.object("Starseed_Orbit", brass, root),
              stars.object("Starseed_Stars", light, root)]
    for obj in meshes:
        # Engine draft asset-spec: artwork front faces glTF -Z (Blender +Y).
        # Bake the 180-degree yaw into meshes, leaving the anchor and clips at identity.
        for vertex in obj.data.vertices:
            vertex.co.x = -vertex.co.x
            vertex.co.y = -vertex.co.y
        bpy.context.view_layer.objects.active = obj
        # Triangulation is baked, making budgets match the shipped GLB exactly.
        tri = obj.modifiers.new("Export_triangles", "TRIANGULATE")
        bpy.ops.object.modifier_apply(modifier=tri.name)
    return root, meshes


def smoothstep(t):
    return t*t*(3-2*t)


def animate(root):
    """Three non-overlapping NLA tracks, exported as separate zero-based clips.

    Local scale always starts at the ground anchor. No underground translation or
    occlusion mesh is required: even without real-world depth the emergence works.
    Scale 0 is intentional so the asset is fully invisible at both hidden endpoints.
    """
    root.animation_data_create()
    for name, (start, end) in CLIPS.items():
        root.animation_data.action = None
        root.scale = (1, 1, 1)
        root.rotation_euler = (0, 0, 0)
        for f in range(start, end+1):
            t = (f-start)/(end-start)
            if name == "Emerge":
                height = smoothstep(min(1, t/0.94))
                width = smoothstep(min(1, t/0.82))
                root.scale = (width, width, height)
                root.rotation_euler.z = math.radians(-14)*(1-height)
            elif name == "Idle":
                root.scale = (1, 1, 1)
                root.rotation_euler.z = math.radians(2)*math.sin(2*math.pi*t)
            else:
                height = 1-smoothstep(t)
                width = 1-smoothstep(min(1, t/0.94))
                root.scale = (width, width, height)
                root.rotation_euler.z = math.radians(8)*(1-height)
            root.keyframe_insert(data_path="scale", frame=f)
            root.keyframe_insert(data_path="rotation_euler", frame=f)
        action = root.animation_data.action
        action.name = name
        # Values already contain easing. Linear interpolation gives deterministic
        # Blender/glTF sampling with no Bezier overshoot and no negative scale.
        for curve in action.fcurves:
            for key in curve.keyframe_points:
                key.interpolation = "LINEAR"
        root.animation_data.action = None
        track = root.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, start, action)
        strip.extrapolation = "NOTHING"
        strip.blend_type = "REPLACE"
    root.scale = (1, 1, 1)
    root.rotation_euler = (0, 0, 0)


def look_at(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z", "Y").to_euler()


def stage(scene):
    """Render-only camera, neutral ground and lights, excluded from GLB selection."""
    col = bpy.data.collections.new("PREVIEW_ONLY_NOT_EXPORTED")
    scene.collection.children.link(col)
    bpy.ops.mesh.primitive_plane_add(size=200)
    ground = bpy.context.object
    ground.name = "Preview_Ground"
    ground.location.z = -0.003
    ground.data.materials.append(material("PREVIEW_Ground", (0.075, 0.092, 0.115), 0, 0.84))
    for parent in list(ground.users_collection):
        parent.objects.unlink(ground)
    col.objects.link(ground)
    cam_data = bpy.data.cameras.new("Preview_Camera")
    cam = bpy.data.objects.new("Preview_Camera", cam_data)
    col.objects.link(cam)
    cam.location = (-3.0, 5.8, 2.85)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 3.25
    look_at(cam, (0, 0, 1.05))
    scene.camera = cam
    for name, loc, energy, color, size in [
        ("Key", (-1, 3, 5), 850, (1, .84, .64), 4),
        ("Fill", (3, 1, 3), 600, (.52, .72, 1), 3),
        ("Rim", (-1.5, -2, 4), 1100, (1, .66, .32), 2.5),
    ]:
        data = bpy.data.lights.new("Preview_"+name, "AREA")
        data.energy, data.color, data.shape, data.size = energy, color, "DISK", size
        light = bpy.data.objects.new("Preview_"+name, data)
        col.objects.link(light)
        light.location = loc
        look_at(light, (0, 0, 1.0))
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Preview_World")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.22, 0.22, 0.22, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.render.film_transparent = False


def bounds(meshes):
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ Vector(p) for o in meshes for p in o.bound_box]
    minimum = [min(v[i] for v in corners) for i in range(3)]
    maximum = [max(v[i] for v in corners) for i in range(3)]
    return {"min": minimum, "max": maximum, "size": [b-a for a, b in zip(minimum, maximum)]}


def render(scene, name, frame):
    scene.frame_set(math.floor(frame), subframe=frame-math.floor(frame))
    scene.render.filepath = str(ROOT / "blender/renders" / name)
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-renders", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    for folder in ("blender/scenes", "blender/renders", "blender/reports", "public/models"):
        (ROOT / folder).mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, 346
    root, meshes = build_asset()
    animate(root)
    scene.frame_set(91)
    rest_bounds = bounds(meshes)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(ROOT / "public/models/starseed_sculpture.glb"),
        export_format="GLB", use_selection=True, export_yup=True,
        export_apply=True, export_texcoords=False, export_normals=True,
        export_materials="EXPORT", export_vertex_color="NONE",
        export_cameras=False, export_lights=False, export_extras=True,
        export_animations=True, export_animation_mode="NLA_TRACKS",
        export_frame_range=False, export_force_sampling=True,
        export_optimize_animation_keep_anim_object=True,
        export_anim_slide_to_zero=True,
    )
    stage(scene)
    scene.frame_set(91)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "blender/scenes/starseed_sculpture.blend"))
    write_json(ROOT / "blender/reports/build.json", {
        "asset_id": ASSET_ID, "blender_version": bpy.app.version_string,
        "units": "meters", "blender_bounds_z_up": rest_bounds,
        "triangles": sum(len(o.data.polygons) for o in meshes),
        "mesh_objects": len(meshes), "export_materials": [o.data.materials[0].name for o in meshes],
        "clips": {name: {"blender_frames": [a,b], "duration_seconds": (b-a)/FPS}
                  for name, (a,b) in CLIPS.items()},
        "reference_status": "provisional_concept_wireframe_not_available",
        "historical_reconstruction": False,
        "render_engine": "Cycles CPU", "render_samples": 32,
        "glb_includes_preview_stage": False,
    })
    if not args.skip_renders:
        for name, frame in [("starseed_emerge_0.png", 1), ("starseed_emerge_1.5.png", 46),
                            ("starseed_hero.png", 91), ("starseed_disappear_0.75.png", 323.5)]:
            render(scene, name, frame)
    print("STARSEED_BUILD_OK", flush=True)


if __name__ == "__main__":
    main()
