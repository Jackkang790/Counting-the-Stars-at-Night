"""Local-only reviewer; serves only asset, viewer and its Three.js dependency."""
import argparse
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        allowed = ("/blender/preview/", "/blender/.tools/qa/node_modules/three/", "/public/models/")
        target = (ROOT / path.lstrip("/")).resolve()
        if not path.startswith(allowed) or not target.is_relative_to(ROOT) or target.is_dir() and path != "/blender/preview/":
            self.send_error(403)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/__report":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length < 10000:
            self.send_error(400)
            return
        report = json.loads(self.rfile.read(length))
        report["glb_sha256"] = hashlib.sha256((ROOT / "public/models/starseed_sculpture.glb").read_bytes()).hexdigest()
        (ROOT / "blender/reports/viewer-validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    print(f"Viewer: http://127.0.0.1:{args.port}/blender/preview/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
