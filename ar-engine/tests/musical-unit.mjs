import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";
const root = resolve(import.meta.dirname, "..");
const loadTS = async (path, replacements = {}) => {
  let source = ts.transpileModule(readFileSync(resolve(root, path), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [a, b] of Object.entries(replacements)) source = source.replaceAll(a, b);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
};
const { validateShow, actorOpacity, mediaTime, cueAt } = await loadTS("src/musical/timeline.ts");
const show = validateShow(JSON.parse(readFileSync(resolve(root, "musical-assets/show.json"), "utf8")));
assert.equal(show.duration, 30); assert.equal(show.actors.length, 2);
for (const [time, id] of [[0,"wake"],[5,"entrance-a"],[10,"duet"],[20,"climax"],[27,"finale"],[30,"finale"]]) assert.equal(cueAt(show, time).id, id);
const [a, b] = show.actors;
assert.equal(actorOpacity(a, 4.99), 0); assert.equal(actorOpacity(b, 9.99), 0);
assert.equal(actorOpacity(a, 6), 1); assert.equal(actorOpacity(b, 11), 1);
assert.equal(actorOpacity(a, 29.6), 0); assert.ok(actorOpacity(a, 29) < actorOpacity(a, 28.1));
assert.ok(Math.abs(mediaTime(a, 8.1, 2) - 1.1) < 1e-8);
assert.throws(() => validateShow({ ...show, duration: NaN }));
assert.throws(() => validateShow({ ...show, actors: [a, a] }));
assert.throws(() => validateShow({ ...show, cues: show.cues.slice(1) }));
assert.throws(() => validateShow({ ...show, actors: [{ ...a, end: 31 }, b] }));
// An actor moving locally must not move the existing placement group.
const threeURL = pathToFileURL(resolve(root, "node_modules/three/build/three.module.js")).href;
const THREE = await import(threeURL);
const { PlacementGroup } = await loadTS("src/core/placement.ts", { 'from "three"': `from "${threeURL}"` });
const placement = new PlacementGroup(), actor = new THREE.Group(); placement.attach(actor);
placement.placeAt(new THREE.Matrix4().compose(new THREE.Vector3(1, 0.3, -2), new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.7,.1,"YXZ")), new THREE.Vector3(1,1,1)).elements, true);
placement.group.updateMatrixWorld(true); const before = placement.group.matrix.elements.slice();
actor.position.set(0.8, 1, 0.2); actor.rotation.y = 0.2; placement.group.updateMatrixWorld(true);
assert.deepEqual(before, placement.group.matrix.elements); assert.equal(placement.group.rotation.x, 0); assert.equal(placement.group.rotation.z, 0);
// The old runtime/assets must be byte-identical to the preceding analysis baseline.
const baseline = JSON.parse(readFileSync(resolve(root, "contracts/iphone-tracking-compatibility.json"), "utf8"));
const { createHash } = await import("node:crypto"); let protectedCount = 0;
// Git checkouts may use LF or CRLF. Permit only that reversible text conversion;
// binary assets and every other content byte remain protected by the baseline hash.
function matchesBaseline(data, expected) {
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  if (digest(data) === expected) return true;
  if (Buffer.isBuffer(data) && data.includes(0)) return false;
  const lf = data.toString("utf8").replace(/\r\n/g,"\n");
  return digest(lf) === expected || digest(lf.replace(/\n/g,"\r\n")) === expected;
}
for (const entry of baseline.protectedFileVerification.files) {
  if (entry.path === "ar-engine/index.html") {
    const restored = readFileSync(resolve(root, "index.html"), "utf8").replace('/src/bootstrap.ts', '/src/main.ts');
    assert.ok(matchesBaseline(restored,entry.sha256), "HTML differs beyond the additive bootstrap entry");
  } else assert.ok(matchesBaseline(readFileSync(resolve(root, "..", entry.path)),entry.sha256), `Protected file changed: ${entry.path}`);
  protectedCount++;
}
console.log(JSON.stringify({ result: "PASS", timelineBoundaryCases: 10, invalidManifestsRejected: 4, placementAnimationSeparation: true, protectedFiles: protectedCount, htmlOnlyChange: "main.ts entry -> bootstrap.ts", deviceARVerified: false }, null, 2));
