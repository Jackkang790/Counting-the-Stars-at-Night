import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const root = resolve(import.meta.dirname, '..');
export function python() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const local = resolve(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
  if (existsSync(local)) return local;
  return process.platform === 'win32'
    ? execFileSync('py', ['-3', '-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).trim()
    : 'python3';
}
export function server(port = process.env.BACKEND_PORT || '8000') {
  return spawn(python(), ['-m', 'uvicorn', 'app.integrated:app', '--app-dir', 'backend',
    '--host', process.env.BACKEND_HOST || '127.0.0.1', '--port', port],
  { cwd: root, stdio: 'inherit', env: process.env });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const child = spawn(python(), ['-m', 'unittest', 'discover', '-s', 'backend/tests', '-v'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, PYTHONPATH: resolve(root, 'backend') },
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
