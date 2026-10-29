import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const run = (file, env = process.env) => execFileSync(process.execPath, [file], { cwd: root, env, stdio: 'inherit' });
run('ar-engine/scripts/stage-web-slam.mjs');
run('ar-engine/scripts/stage-tracking-lab.mjs');
run('ar-engine/scripts/build-app-api.mjs', { ...process.env, AR_BASE: '/ar/' });
run('ar-engine/tests/app-api.mjs');
if (!process.argv.includes('--ar-only')) execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: root, stdio: 'inherit' });
