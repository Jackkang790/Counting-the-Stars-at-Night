"""Package only the synthetic alignment asset. Never edits the common catalog."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def read(path):
    return json.loads((ROOT/path).read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()


def main():
    build=read("blender/reports/alignment_build.json")
    validation=read("blender/reports/alignment_validation.json")
    three=read("blender/reports/alignment_three.json")
    khronos=read("blender/reports/alignment_khronos.json")
    model="public/models/alignment_test_facade.glb"
    source="blender/scenes/alignment_test_facade.blend"
    digest=sha(model)
    assert validation["passed"] and three["passed"]
    assert validation["glb_sha256"]==three["glb_sha256"]==digest, "Stale GLB report"
    assert validation["source_blend_sha256"]==sha(source), "Stale BLEND report"
    assert khronos["issues"]["numErrors"]==khronos["issues"]["numWarnings"]==0
    stats=validation["statistics"]
    manifest={
        "schema_version":"1.0.0", "id":"alignment_test_facade", "version":"0.1.0",
        "name_ko":"외벽 정합 시험물", "category":"alignment-test", "status":"synthetic_alignment_fixture",
        "reference":{"historical_reconstruction":False,"surveyed_real_building":False,
            "note_ko":"모든 치수는 시험용 합성 값. 관사 16호 등 실제 건물의 형태·치수·역사를 재현하지 않음."},
        "url":"/models/alignment_test_facade.glb", "repository_path":model, "source_blend":source,
        "generator":"blender/scripts/build_alignment_facade.py", "blender_version":build["blender_version"],
        "sha256":digest, "source_blend_sha256":sha(source), "units":"meters", "meters_per_unit":1,
        "coordinates":{"gltf":"right-handed; +Y up; -Z front", "blender":"right-handed; +Z up; +Y front",
                       "conversion":"Blender (x,y,z) -> GLB (x,z,-y)"},
        "anchor":{"node":"ANCHOR_Facade", "type":"facade_front_ground_center", "position_gltf_m":[0,0,0],
                  "contact_plane":"Y=0", "facade_plane":"Z=0", "normal_gltf":[0,0,-1],
                  "placement":"rigid facade registration in a separate parent Group"},
        "recommended_scale":1, "rest_state":"all_layers_visible", "animations":[],
        "animation_policy":"static; calibration points must not move",
        "nominal_reference_wall_m":{"width":6,"height":3.6,"thickness":.2,
                                    "min":[-3,0,0],"max":[3,3.6,.2]},
        "bounds_gltf_m":stats["bounds_gltf_m"],
        "calibration":{
            "points_frame":"GLB local metres relative to ANCHOR_Facade; use node origins, not marker surfaces",
            "reference_points":[{"node":name,"position_gltf_m":p,"position_blender_m":[p[0],-p[2],p[1]],
                                 "normal_gltf":[0,0,-1]} for name,p in build["reference_points_gltf_m"].items()],
            "all_points_coplanar":True,"wall_horizontal_baseline_m":6,"wall_vertical_baseline_m":3.6,
            "grid":{"minor_pitch_m":.5,"major_pitch_m":1,"vernier_pitch_m":.01,
                    "vernier_length_m":.2,"vernier_start_gltf_m":[.15,.23,-.036]},
            "display_layer_offsets":build["layer_depths"],
            "depth_note_ko":"시각 요소의 -Z 간격은 겹침 방지용이며 측정 오차가 아님. 기준점은 모두 Z=0.",
            "automatic_marker_detection":False, "real_world_accuracy_measured":False,
        },
        "layers":[{"node":name,"meshes":names,"default_visible":True,
                   "real_building_mode_visible":name!="REFERENCE_Facade"}
                  for name,names in build["layer_meshes"].items()],
        "materials":{"opaque_count":7,"blend_count":1,"overlay_name":"ALIGN_OverlayCyan",
                     "overlay_alpha":.28,"textures":[],"texture_dimensions_px":[]},
        "performance":{"triangles":stats["triangles"],"vertices_exported":stats["vertices"],
                       "material_count":stats["materials"],"mesh_primitives":stats["primitives"],
                       "estimated_draw_calls_all_layers":11,"estimated_draw_calls_reference_hidden":8,
                       "glb_bytes":stats["bytes"],"textures":0,"backface_culling":True,
                       "compression":"none; no decoder required", "required_extensions":[],
                       "budgets":{"triangles_max":8000,"vertices_max":12000,"primitives_max":16,"glb_bytes_max":1000000}},
        "previews":["blender/renders/alignment_front.png","blender/renders/alignment_oblique.png",
                    "blender/renders/alignment_overlay_only.png","blender/renders/alignment_glb_front.png",
                    "blender/renders/alignment_glb_overlay_only.png"],
        "validation":{"source_blend_reopened":True,"binary_and_reimport_passed":True,
                      "reimport_rendered":validation["reimport_rendered"],
                      "khronos_errors":0,"khronos_warnings":0,"three_loader_passed":True,
                      "three_revision":three["three_revision"],"three_checks":len(three["checks"]),
                      "local_world_transform_passed":True,"mobile_webxr_device_tested":False,
                      "webgl_gpu_render_tested":False,"claude_engine_integrated":False,
                      "reports":["blender/reports/alignment_validation.json","blender/reports/alignment_three.json",
                                 "blender/reports/alignment_khronos.json"]},
    }
    path=ROOT/"public/models/alignment_test_facade.manifest.json"
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("ALIGNMENT_MANIFEST_OK",digest,flush=True)


if __name__=="__main__":
    main()
