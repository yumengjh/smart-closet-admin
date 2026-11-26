import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileTemplate } from "vue/compiler-sfc";

const apiSource = await readFile(new URL("../../../../api/closet/models.ts", import.meta.url), "utf8");
const calls = [];
const api = {};
vm.runInNewContext(ts.transpileModule(apiSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, {
  exports: api,
  require: () => ({ http: { request: (...args) => { calls.push(args); } } })
});
for (const body of [
  { maxReferenceImages: null, overLimit: "STITCH", revision: 0 },
  { maxReferenceImages: 20, overLimit: "REJECT", revision: 7 }
]) {
  api.putEntryReferences("cfg:image/a", body);
  assert.equal(calls.at(-1)[0], "put");
  assert.equal(calls.at(-1)[1], "/closet/models/entries/cfg%3Aimage%2Fa/references");
  assert.deepEqual(calls.at(-1)[2].data, body);
}
for (const name of ["index.vue", "ModelUsage.vue"]) {
  const source = await readFile(new URL(name, import.meta.url), "utf8");
  const parsed = parse(source, { filename: name });
  assert.deepEqual(parsed.errors, []);
  const compiled = compileTemplate({ source: parsed.descriptor.template.content, filename: name, id: name });
  assert.deepEqual(compiled.errors, []);
  if (name === "index.vue") {
    assert.match(source, /revision: current\.references!\.revision/);
    assert.match(source, /maxReferenceImages: referencesForm\.maxReferenceImages \?\? null/);
    assert.match(source, /response\?\.status === 409[\s\S]*?referencesOpen\.value = false;[\s\S]*?void load\(\)/);
    assert.match(source, /v-if="row\.capability === 'IMAGE'"[\s\S]*?@click="openReferences\(row\)"/);
    assert.match(source, /options\.overLimit = entryForm\.overLimit/);
  } else {
    assert.match(source, /prop="stitchedCalls"/);
    assert.match(source, /v-if="row\.stitched > 0"/);
  }
}
