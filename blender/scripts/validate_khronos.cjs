// Independent Khronos glTF-Validator. npm install lives only under blender/.tools.
const fs = require('node:fs');
const path = require('node:path');
const validator = require('../.tools/qa/node_modules/gltf-validator');
const root = path.resolve(__dirname, '../..');
const model = path.join(root, 'public/models/starseed_sculpture.glb');
validator.validateBytes(new Uint8Array(fs.readFileSync(model)), {
  uri: 'starseed_sculpture.glb', maxIssues: 1000,
  externalResourceFunction: () => Promise.reject(new Error('External resources forbidden')),
}).then(report => {
  fs.writeFileSync(path.join(root, 'blender/reports/khronos-validation.json'),
    JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ validatorVersion: report.validatorVersion, issues: report.issues }));
  if (report.issues.numErrors || report.issues.numWarnings) process.exitCode = 1;
}).catch(err => { console.error(err); process.exitCode = 1; });
