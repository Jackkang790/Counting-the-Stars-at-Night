import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, server } from './python.mjs';
if (!existsSync(resolve(root, 'ar-engine/dist/api/ar/v1/catalog.json'))) {
  execFileSync(process.execPath, ['scripts/build.mjs', '--ar-only'], { cwd: root, stdio: 'inherit' });
}
const backend = server();
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', process.env.FRONTEND_HOST || '127.0.0.1',
  '--port', process.env.FRONTEND_PORT || '5173', '--strictPort'], { cwd: root, stdio: 'inherit', env: process.env });
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  backend.kill(); vite.kill(); process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
for (const child of [backend, vite]) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 0));
}
