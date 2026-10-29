import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, server } from './python.mjs';
for (const file of ['dist/index.html', 'ar-engine/dist/api/ar/v1/catalog.json']) {
  if (!existsSync(resolve(root, file))) throw new Error('먼저 npm run build를 실행해 주세요: ' + file);
}
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1]))) throw new Error('사용법: npm start -- --port 8190');
const child = server(args[1]);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
