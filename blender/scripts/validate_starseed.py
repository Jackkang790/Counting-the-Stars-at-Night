"""Binary contract checks + independent Blender re-import/animation/material/render QA."""
import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_starseed import ROOT, ASSET_ID, FPS, bounds, stage, write_json

FILE = ROOT / "public/models/starseed_sculpture.glb"
EXPECTED = {"Emerge": 3.0, "Idle": 4.0, "Disappear": 1.5}
MATERIALS = {"MAT_Basalt", "MAT_PatinatedBronze", "MAT_BrushedBrass", "MAT_Starlight"}
CHECKS = []


def check(name, condition, evidence=None):
    CHECKS.append({"name": name, "passed": bool(condition), "evidence": evidence})
    if not condition:
        write_json(ROOT / "blender/reports/asset-validation.json", {"passed": False, "checks": CHECKS})
        raise AssertionError(f"{name}: {evidence}")


def glb_read():
    raw = FILE.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw)
    check("GLB 2.0 header", magic == b"glTF" and version == 2 and length == len(raw))
    chunks, cursor = {}, 12
    while cursor < len(raw):
        length, kind = struct.unpack_from("<II", raw, cursor)
        check("Aligned complete chunk", length % 4 == 0 and cursor+8+length <= len(raw))
        chunks[kind] = raw[cursor+8:cursor+8+length]
        cursor += length+8
    check("JSON and BIN only", set(chunks) == {0x4E4F534A, 0x004E4942})
    return json.loads(chunks[0x4E4F534A]), chunks[0x004E4942], raw


def validate_source():
    source = ROOT / "blender/scenes/starseed_sculpture.blend"
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    check("Source uses metres", scene.unit_settings.system == "METRIC" and scene.unit_settings.scale_length == 1)
    anchor = bpy.data.objects.get("ANCHOR_Ground")
    check("Source anchor loads", anchor is not None)
    meshes = [o for o in anchor.children if o.type == "MESH"]
    check("Source four meshes", len(meshes) == 4)
    check("Source NLA clips", {t.name for t in anchor.animation_data.nla_tracks} == set(EXPECTED))
    scene.frame_set(91)
    dimensions = bounds(meshes)
    check("Source rest pose dimensions", abs(dimensions["min"][2]) < 1e-5 and
          abs(dimensions["size"][2]-2.2138741) < 1e-4, dimensions)
    check("Source preview isolated", bpy.data.collections.get("PREVIEW_ONLY_NOT_EXPORTED") is not None)
    write_json(ROOT / "blender/reports/source-validation.json", {
        "passed": True, "source_blend_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "checks": list(CHECKS), "blender_version": bpy.app.version_string})
    print("BLEND_REOPEN_OK", flush=True)


def values(gltf, binary, index):
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    fmt, size = {5126: ("f", 4), 5125: ("I", 4), 5123: ("H", 2), 5121: ("B", 1)}[acc["componentType"]]
    count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    offset = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride", count*size)
    return [struct.unpack_from("<"+fmt*count, binary, offset+i*stride) for i in range(acc["count"])]


def node_matrix(node):
    if "matrix" in node:
        return Matrix([node["matrix"][i::4] for i in range(4)])
    x, y, z, w = node.get("rotation", [0,0,0,1])
    return Matrix.LocRotScale(Vector(node.get("translation", [0,0,0])),
                              Quaternion((w,x,y,z)), Vector(node.get("scale", [1,1,1])))


def binary_contract(gltf, binary, raw):
    check("Self-contained GLB", all("uri" not in x for x in gltf.get("buffers", [])) and not gltf.get("images"))
    check("No cameras/lights/skins/morphs", not any(gltf.get(x) for x in ["cameras", "skins"]) and
          "KHR_lights_punctual" not in gltf.get("extensionsUsed", []) and
          not any("targets" in p for m in gltf["meshes"] for p in m["primitives"]))
    check("No required extensions", not gltf.get("extensionsRequired"), gltf.get("extensionsRequired", []))
    check("Four opaque PBR materials", {m["name"] for m in gltf["materials"]} == MATERIALS and
          all(m.get("alphaMode", "OPAQUE") == "OPAQUE" and "pbrMetallicRoughness" in m for m in gltf["materials"]))
    check("Four meshes / four primitives", len(gltf["meshes"]) == 4 and
          sum(len(m["primitives"]) for m in gltf["meshes"]) == 4)
    primitives = [p for mesh in gltf["meshes"] for p in mesh["primitives"]]
    triangles = sum(gltf["accessors"][p["indices"]]["count"] // 3 for p in primitives)
    vertices = sum(gltf["accessors"][p["attributes"]["POSITION"]]["count"] for p in primitives)
    check("Mobile geometry budget", triangles <= 12000 and vertices <= 15000, {"triangles": triangles, "vertices": vertices})
    check("Mobile transfer budget", len(raw) <= 1500000, {"bytes": len(raw), "limit": 1500000})
    check("Positions/normals/indices exported", all("NORMAL" in p["attributes"] and
          "indices" in p and p.get("mode", 4) == 4 for p in primitives))
    check("Unified clip names", {a["name"] for a in gltf["animations"]} == set(EXPECTED))
    anchor_index = next(i for i, n in enumerate(gltf["nodes"]) if n.get("name") == "ANCHOR_Ground")
    samples = {}
    for anim in gltf["animations"]:
        times = [row[0] for s in anim["samplers"] for row in values(gltf, binary, s["input"])]
        duration = max(times)-min(times)
        check(anim["name"]+" time range", abs(min(times)) < 1e-6 and abs(duration-EXPECTED[anim["name"]]) < 1e-5,
              {"start": min(times), "duration": duration})
        check(anim["name"]+" anchor channels", all(c["target"]["node"] == anchor_index for c in anim["channels"]))
        sample = {}
        for channel in anim["channels"]:
            sampler = anim["samplers"][channel["sampler"]]
            output = values(gltf, binary, sampler["output"])
            sample[channel["target"]["path"]] = {"first": output[0], "last": output[-1], "keys": len(output)}
            check(anim["name"]+" finite "+channel["target"]["path"], all(math.isfinite(v) for row in output for v in row))
        scales = sample["scale"]
        first, last = scales["first"], scales["last"]
        desired = {"Emerge": (0,1), "Idle": (1,1), "Disappear": (1,0)}[anim["name"]]
        check(anim["name"]+" visibility endpoints", all(abs(v-desired[0]) < 1e-6 for v in first) and
              all(abs(v-desired[1]) < 1e-6 for v in last), scales)
        samples[anim["name"]] = sample

    # Traverse exported glTF transforms, not Blender source transforms.
    points = []
    def walk(index, parent):
        node = gltf["nodes"][index]
        world = parent @ node_matrix(node)
        if "mesh" in node:
            for p in gltf["meshes"][node["mesh"]]["primitives"]:
                points.extend(world @ Vector(v) for v in values(gltf, binary, p["attributes"]["POSITION"]))
        for child in node.get("children", []):
            walk(child, world)
    for index in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
        walk(index, Matrix.Identity(4))
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    size = [b-a for a,b in zip(low, high)]
    check("Metres / Y-up / ground anchor", abs(low[1]) < 1e-5 and 2.1 <= size[1] <= 2.3 and
          1.2 <= size[0] <= 1.4 and 1.2 <= size[2] <= 1.4,
          {"min": low, "max": high, "size": size})
    return {"triangles": triangles, "vertices": vertices, "primitives": len(primitives),
            "materials": len(gltf["materials"]), "bytes": len(raw),
            "bounds_gltf_y_up": {"min": low, "max": high, "size": size}, "animation_samples": samples}


def roundtrip(gltf, skip_renders):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=str(FILE))
    meshes = [o for o in scene.objects if o.type == "MESH"]
    anchor = bpy.data.objects.get("ANCHOR_Ground")
    check("Reimport mesh and root", len(meshes) == 4 and anchor is not None)
    exported = {m["name"]: m for m in gltf["materials"]}
    for name in MATERIALS:
        imported = bpy.data.materials.get(name)
        pbr = next((n for n in imported.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if imported else None
        check("Reimport PBR "+name, pbr is not None)
        expected = exported[name]["pbrMetallicRoughness"]
        check("Reimport base color "+name,
              all(abs(a-b) < 1e-5 for a,b in zip(pbr.inputs["Base Color"].default_value,
                                                              expected.get("baseColorFactor", [1]*4))))
        for socket, prop, default in [("Metallic", "metallicFactor", 1), ("Roughness", "roughnessFactor", 1)]:
            check("Reimport "+socket+" "+name, abs(pbr.inputs[socket].default_value-expected.get(prop, default)) < 1e-5)
        emissive = exported[name].get("emissiveFactor", [0,0,0])
        effective = [x*pbr.inputs["Emission Strength"].default_value
                     for x in pbr.inputs["Emission Color"].default_value[:3]]
        check("Reimport emission "+name, all(abs(a-b) < 1e-5 for a,b in zip(effective, emissive)),
              {"expected": emissive, "actual": effective})

    anchor.animation_data.use_nla = False
    animation_results = {}
    for clip in EXPECTED:
        candidates = [a for a in bpy.data.actions if a.name.startswith(clip)]
        check("Reimport action "+clip, len(candidates) == 1, [a.name for a in candidates])
        action = candidates[0]
        anchor.animation_data.action = action
        if action.slots:
            anchor.animation_data.action_slot = action.slots[0]
        a, b = action.frame_range
        samples = []
        for frame in (a, (a+b)/2, b):
            scene.frame_set(math.floor(frame), subframe=frame-math.floor(frame))
            samples.append({"frame": frame, "scale": list(anchor.scale), "bounds_z_up": bounds(meshes)})
        expected = {"Emerge": (0,1), "Idle": (1,1), "Disappear": (1,0)}[clip]
        check("Reimport endpoints "+clip, all(abs(v-expected[0]) < 1e-5 for v in samples[0]["scale"]) and
              all(abs(v-expected[1]) < 1e-5 for v in samples[-1]["scale"]), samples)
        if clip == "Idle":
            check("Reimport physical height", abs(samples[0]["bounds_z_up"]["size"][2]-2.215) < 0.02)
        animation_results[clip] = {"frames": [a,b], "samples": samples}
    if not skip_renders:
        stage(scene)
        for clip, fraction, filename in [
            ("Emerge", 1, "starseed_glb_roundtrip.png"),
            ("Emerge", .5, "starseed_glb_emerge_mid.png"),
            ("Disappear", .5, "starseed_glb_disappear_mid.png"),
        ]:
            action = next(a for a in bpy.data.actions if a.name.startswith(clip))
            anchor.animation_data.action = action
            if action.slots:
                anchor.animation_data.action_slot = action.slots[0]
            a,b = action.frame_range
            frame = a+(b-a)*fraction
            scene.frame_set(math.floor(frame), subframe=frame-math.floor(frame))
            scene.render.filepath = str(ROOT / "blender/renders" / filename)
            bpy.ops.render.render(write_still=True)
    return animation_results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-renders", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    validate_source()
    gltf, binary, raw = glb_read()
    stats = binary_contract(gltf, binary, raw)
    reimport = roundtrip(gltf, args.skip_renders)
    report = {"asset_id": ASSET_ID, "passed": True, "blender_version": bpy.app.version_string,
              "glb_sha256": hashlib.sha256(raw).hexdigest(), "statistics": stats,
              "checks": CHECKS, "roundtrip_animations": reimport,
              "roundtrip_rendered": not args.skip_renders,
              "scope": "GLB binary + Blender reimport; mobile device/WebXR performance not measured"}
    write_json(ROOT / "blender/reports/asset-validation.json", report)
    print("STARSEED_VALIDATION_OK", json.dumps(stats, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
