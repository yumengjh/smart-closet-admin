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

const portraitBody = { active: "image-a", fallback: null, revision: 7 };
api.putRouting("PORTRAIT", portraitBody);
assert.equal(calls.at(-1)[0], "put");
assert.equal(calls.at(-1)[1], "/closet/models/routing/PORTRAIT");
assert.deepEqual(calls.at(-1)[2].data, portraitBody);
api.deleteRouting("PORTRAIT");
assert.equal(calls.at(-1)[0], "delete");
assert.equal(calls.at(-1)[1], "/closet/models/routing/PORTRAIT");

const source = await readFile(new URL("index.vue", import.meta.url), "utf8");
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const routingCode = [
  extract("const eligible =", "const healthText ="),
  extract("const saveRouting =", "const resetRouting ="),
  "globalThis.routing = { eligible, saveRouting, followImage };"
].join("\n");
const routingCalls = [];
const overview = { value: {
  providers: [{ id: "ready", status: "READY" }, { id: "down", status: "NO_KEY" }],
  entries: [
    { id: "image-a", capability: "IMAGE", enabled: true, providerId: "ready" },
    { id: "disabled", capability: "IMAGE", enabled: false, providerId: "ready" },
    { id: "unavailable", capability: "IMAGE", enabled: true, providerId: "down" },
    { id: "vision", capability: "VISION", enabled: true, providerId: "ready" }
  ],
  routing: { PORTRAIT: { active: "image-a", revision: 7, followsImage: false } }
} };
const routingForms = { PORTRAIT: { active: "image-a", fallback: null } };
const context = {
  overview, routingForms,
  mutate: async action => { await action(); return true; },
  putRouting: (...args) => routingCalls.push(["put", ...args]),
  deleteRouting: (...args) => routingCalls.push(["delete", ...args]),
  message: () => assert.fail("unexpected routing validation error")
};
vm.runInNewContext(ts.transpileModule(routingCode, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText, context);
assert.deepEqual(Array.from(context.routing.eligible("PORTRAIT"), entry => entry.id), ["image-a"]);
await context.routing.saveRouting("PORTRAIT");
assert.equal(routingCalls[0][0], "put");
assert.equal(routingCalls[0][1], "PORTRAIT");
assert.equal(routingCalls[0][2].active, "image-a");
assert.equal(routingCalls[0][2].fallback, null);
assert.equal(routingCalls[0][2].revision, 7);
await context.routing.followImage("");
assert.deepEqual(routingCalls[1], ["delete", "PORTRAIT"]);
assert.match(source, /routingSlots: RoutingSlot\[\] = \[\.\.\.capabilities, "PORTRAIT"\]/);
assert.match(source, /overview\.routing\.IMAGE\?\.effective/);
assert.match(source, /PORTRAIT_ACTIVE"[\s\S]*?形象图生效[\s\S]*?PORTRAIT_FALLBACK"[\s\S]*?形象图备用/);
assert.doesNotMatch(source, /ClosetCreationCapabilities/);
