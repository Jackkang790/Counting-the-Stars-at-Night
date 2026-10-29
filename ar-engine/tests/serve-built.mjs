import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
const folder = resolve(process.argv[2] ?? "../.tmp/musical-production");
const port = Number(process.argv[3] ?? 5188), mount = process.argv[4] ?? "/";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".glb": "model/gltf-binary", ".mind": "application/octet-stream" };
createServer((request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (!pathname.startsWith(mount)) { response.writeHead(404).end(); return; }
    pathname = pathname.slice(mount.length); if (!pathname) pathname = "index.html";
    const path = resolve(folder, pathname);
    if (!path.startsWith(folder + sep) || !statSync(path).isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": mime[extname(path)] ?? "text/plain", "cache-control": "no-store" }); response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
}).listen(port, "127.0.0.1", () => console.log(`Built artifact QA server: http://localhost:${port}${mount}`));
