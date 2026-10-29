"""Package validated measurements and checksums; compare source/reimport PNGs."""
import hashlib
import json
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def write(path, value):
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def pixels(path):
    img = bpy.data.images.load(str(ROOT / path), check_existing=False)
    data = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(data)
    result = data.reshape(img.size[1], img.size[0], 4)[:, :, :3].copy()
    bpy.data.images.remove(img)
    return result


def main():
    report = read("blender/reports/asset-validation.json")
    khronos = read("blender/reports/khronos-validation.json")
    three = read("blender/reports/three-validation.json")
    source = read("blender/reports/source-validation.json")
    assert report["passed"]
    assert not khronos["issues"]["numErrors"] and not khronos["issues"]["numWarnings"]
    glb = "public/models/starseed_sculpture.glb"
    assert report["glb_sha256"] == digest(glb), "Validation report is stale"
    assert three["passed"] and three["glb_sha256"] == digest(glb), "Three.js report is stale or failed"
    assert source["passed"] and source["source_blend_sha256"] == digest("blender/scenes/starseed_sculpture.blend")
    viewer = None
    viewer_path = ROOT / "blender/reports/viewer-validation.json"
    if viewer_path.exists():
        candidate = read("blender/reports/viewer-validation.json")
        if candidate.get("glb_sha256") == digest(glb):
            viewer = candidate
    comparisons = []
    if report["roundtrip_rendered"]:
        for a,b in [("starseed_hero.png", "starseed_glb_roundtrip.png"),
                    ("starseed_emerge_1.5.png", "starseed_glb_emerge_mid.png"),
                    ("starseed_disappear_0.75.png", "starseed_glb_disappear_mid.png")]:
            source = pixels("blender/renders/" + a)
            imported = pixels("blender/renders/" + b)
            assert source.shape == imported.shape
            delta = np.abs(source-imported)
            # Loose enough for Cycles stochastic differences and normal splitting,
            # strict enough to catch missing meshes/materials or a wrong animation pose.
            rmse = float(np.sqrt(np.mean(delta**2)))
            comparisons.append({"source": a, "glb_reimport": b, "rgb_rmse_0_to_1": rmse,
                                "max_rmse": .025, "passed": rmse <= .025})
        write("blender/reports/render-comparison.json", {
            "glb_sha256": digest(glb), "passed": all(x["passed"] for x in comparisons),
            "comparisons": comparisons, "metric": "linear RGB RMSE from Blender PNG image load",
            "note": "Automated image comparison supplements visual review; not a mobile renderer benchmark."})
        assert all(x["passed"] for x in comparisons), comparisons
    stats = report["statistics"]
    animations = [
        {"name": "Emerge", "duration_seconds": 3, "loop": "once", "clamp_when_finished": True,
         "next": "Idle", "start_state": "hidden", "end_state": "visible"},
        {"name": "Idle", "duration_seconds": 4, "loop": "repeat", "clamp_when_finished": False,
         "start_state": "visible", "end_state": "visible", "motion": "yaw +/- 2 degrees"},
        {"name": "Disappear", "duration_seconds": 1.5, "loop": "once", "clamp_when_finished": True,
         "start_state": "visible", "end_state": "hidden"},
    ]
    write("public/models/asset-manifest.json", {
        "schema_version": "1.0.0", "project": "별 헤는 밤 · 테미오래 AR",
        "assets": [{
            "id": "starseed_sculpture", "version": "0.1.0", "name_ko": "별의 새싹",
            "category": "emergent-artwork", "status": "provisional_concept",
            "reference": {"wireframe_available": False, "historical_reconstruction": False,
                          "note_ko": "첨부 와이어프레임 미확인 상태의 창작 임시 조형물. 실존 작품·건물의 재현이 아님."},
            "url": "/models/starseed_sculpture.glb", "repository_path": glb,
            "source_blend": "blender/scenes/starseed_sculpture.blend",
            "generator": "blender/scripts/build_starseed.py", "blender_version": report["blender_version"],
            "sha256": digest(glb), "source_blend_sha256": digest("blender/scenes/starseed_sculpture.blend"),
            "units": "meters", "meters_per_unit": 1,
            "coordinates": {"gltf": "right-handed; +Y up; -Z front",
                            "blender": "right-handed; +Z up; +Y front",
                            "gltf_conversion": "(x,y,z) Blender -> (x,z,-y) glTF"},
            "anchor": {"node": "ANCHOR_Ground", "type": "ground_center", "position_gltf_m": [0,0,0],
                       "contact_plane": "Y=0", "placement": "horizontal surface",
                       "instruction_ko": "별도 배치용 Group으로 GLB를 감싸고 그 Group에 AR hit-test 변환을 적용한다."},
            "rest_state": "visible_full_size", "bounds_gltf_m": stats["bounds_gltf_y_up"],
            "footprint_diameter_m": 1.24, "recommended_scale": 1,
            "animations": animations, "animation_fps": 30,
            "meshes": ["Starseed_Plinth", "Starseed_Leaves", "Starseed_Orbit", "Starseed_Stars"],
            "materials": ["MAT_Basalt", "MAT_PatinatedBronze", "MAT_BrushedBrass", "MAT_Starlight"],
            "performance": {"triangles": stats["triangles"], "vertices_exported": stats["vertices"],
                            "mesh_primitives": 4, "estimated_draw_calls_per_main_pass": 4,
                            "material_count": 4, "textures": 0, "glb_bytes": stats["bytes"],
                            "alpha_mode": "OPAQUE", "backface_culling": True,
                            "skinning": False, "morph_targets": False, "required_extensions": [],
                            "compression": "none; no decoder required",
                            "budgets": {"triangles_max": 12000, "vertices_max": 15000, "glb_bytes_max": 1500000}},
            "render_preview": "blender/renders/starseed_hero.png",
            "validation": {"binary_and_reimport_passed": True,
                           "source_blend_reopened": True,
                           "khronos_errors": 0, "khronos_warnings": 0,
                           "roundtrip_rendered": report["roundtrip_rendered"],
                           "three_loader_and_animation_passed": True, "three_revision": three["three_revision"],
                           "desktop_webgl_viewer_passed": viewer.get("passed", False) if viewer else False,
                           "image_comparison_passed": all(x["passed"] for x in comparisons) if comparisons else None,
                           "reports": ["blender/reports/asset-validation.json", "blender/reports/khronos-validation.json",
                                       "blender/reports/render-comparison.json", "blender/reports/three-validation.json",
                                       "blender/reports/source-validation.json", "blender/reports/viewer-validation.json"],
                           "mobile_webxr_device_tested": False}
        }]
    })
    # Scene sidecar follows the engine's draft field names without changing that contract.
    write("public/models/starseed_sculpture.manifest.json", {
        "sceneId": "starseed-sculpture", "type": "emergent-artwork", "title": "[임시 작품] 별의 새싹",
        "model": "starseed_sculpture.glb", "anchor": "horizontal", "defaultScale": 1.0,
        "bounds": {"size": stats["bounds_gltf_y_up"]["size"]},
        "animations": {"intro": "Emerge", "idle": "Idle", "outro": "Disappear"},
        "timePhase": {"enabled": False}, "scenes": [], "audio": [],
        "credits": {"artist": "[작가 미확정]", "work": "[임시 작품] 별의 새싹"},
    })
    print("STARSEED_MANIFEST_OK", json.dumps(comparisons), flush=True)


if __name__ == "__main__":
    main()
