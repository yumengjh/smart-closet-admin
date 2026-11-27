import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileTemplate } from "vue/compiler-sfc";

const apiSource = await readFile(
  new URL("../../../../api/closet/models.ts", import.meta.url),
  "utf8"
);
const calls = [];
const api = {};
vm.runInNewContext(
  ts.transpileModule(apiSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText,
  {
    exports: api,
    require: () => ({
      http: {
        request: (...args) => {
          calls.push(args);
        }
      }
    })
  }
);
for (const body of [
  { maxReferenceImages: null, overLimit: "STITCH", revision: 0 },
  { maxReferenceImages: 20, overLimit: "REJECT", revision: 7 }
]) {
  api.putEntryReferences("cfg:image/a", body);
  assert.equal(calls.at(-1)[0], "put");
  assert.equal(
    calls.at(-1)[1],
    "/closet/models/entries/cfg%3Aimage%2Fa/references"
  );
  assert.deepEqual(calls.at(-1)[2].data, body);
}
for (const body of [
  { timeoutSeconds: null, revision: 0 },
  { timeoutSeconds: 600, revision: 7 }
]) {
  api.putEntryTimeout("cfg:image/a", body);
  assert.equal(calls.at(-1)[0], "put");
  assert.equal(
    calls.at(-1)[1],
    "/closet/models/entries/cfg%3Aimage%2Fa/timeout"
  );
  assert.deepEqual(calls.at(-1)[2].data, body);
}
for (const name of ["index.vue", "ModelUsage.vue"]) {
  const source = await readFile(new URL(name, import.meta.url), "utf8");
  const parsed = parse(source, { filename: name });
  assert.deepEqual(parsed.errors, []);
  const compiled = compileTemplate({
    source: parsed.descriptor.template.content,
    filename: name,
    id: name
  });
  assert.deepEqual(compiled.errors, []);
  if (name === "index.vue") {
    assert.match(source, /revision: current\.references!\.revision/);
    assert.match(
      source,
      /maxReferenceImages: referencesForm\.maxReferenceImages \?\? null/
    );
    assert.match(
      source,
      /response\?\.status === 409[\s\S]*?referencesOpen\.value = false;[\s\S]*?void load\(\)/
    );
    assert.match(
      source,
      /v-if="row\.capability === 'IMAGE'"[\s\S]*?@click="openReferences\(row\)"/
    );
    assert.match(source, /options\.overLimit = entryForm\.overLimit/);
    assert.match(source, /v-if="tab !== 'CHAT'"\s+label="等待上限"/);
    assert.match(source, /row\.timeout\.custom == null/);
    assert.match(source, /对话模型的等待由助手整轮时限控制。/);
    assert.match(
      source,
      /v-if="row\.capability !== 'CHAT'"[\s\S]*?:disabled="!writable \|\| busy \|\| !row\.timeout"[\s\S]*?@click="openTimeout\(row\)"/
    );
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
const extract = (start, end) =>
  source.slice(source.indexOf(start), source.indexOf(end));
// A paid test requires confirmation and is unavailable for image models.
const testCode = [
  extract("const tryEntry =", "const toggleEntry ="),
  "globalThis.tryEntry = tryEntry;"
].join("\n");
const testCalls = [];
let confirmed = false;
const testContext = {
  confirm: async (...args) => {
    testCalls.push(["confirm", ...args]);
    return confirmed;
  },
  testEntry: async id => {
    testCalls.push(["test", id]);
    return { data: { ok: true, latencyMs: 1 } };
  },
  ElMessageBox: { alert: async () => {} },
  load: async () => {
    testCalls.push(["load"]);
  },
  fail: () => assert.fail("unexpected test failure")
};
vm.runInNewContext(
  ts.transpileModule(testCode, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText,
  testContext
);
await testContext.tryEntry({ id: "image", capability: "IMAGE" });
assert.equal(testCalls.length, 0);
await testContext.tryEntry({ id: "vision", capability: "VISION" });
assert.match(testCalls[0][1], /真实调用费用.*全站模型预算/);
assert.equal(testCalls.length, 1);
confirmed = true;
await testContext.tryEntry({ id: "vision", capability: "VISION" });
assert.deepEqual(testCalls.slice(1), [
  ["confirm", "会产生一次真实调用费用，并计入全站模型预算。", "试一次"],
  ["test", "vision"],
  ["load"]
]);
assert.doesNotMatch(source, /ClosetCreationCapabilities/);

// Both settings use one revision. Each save reloads the model before the
// other dialog is opened, including for deployment-configured entries.
const settingsCode = [
  extract("const fail =", "const confirm ="),
  extract("const referencesOpen =", "const providerOpen ="),
  "globalThis.settings = { openReferences, saveReferences, openTimeout, saveTimeout, referencesOpen, referencesForm, timeoutOpen, timeoutSeconds };"
].join("\n");
let revision = 0;
let custom = null;
let limit = null;
let reloads = 0;
let conflict = false;
const settingsCalls = [];
const messages = [];
const row = () => ({
  id: "cfg:image/a",
  capability: "IMAGE",
  source: "CONFIG",
  editable: false,
  references: { customLimit: limit, overLimit: "STITCH", revision },
  timeout: { custom, seconds: custom ?? 180, providerSeconds: 180, revision }
});
let latest = row();
const settingsContext = {
  ref: value => ({ value }),
  reactive: value => value,
  busy: { value: false },
  writable: { value: true },
  unavailable: { value: false },
  providerOpen: { value: false },
  entryOpen: { value: false },
  isClosetServiceUnavailable: () => false,
  message: (...args) => messages.push(args),
  load: async () => {
    reloads++;
    latest = row();
  },
  putEntryReferences: async (id, body) => {
    settingsCalls.push([id, body]);
    assert.equal(body.revision, revision);
    limit = body.maxReferenceImages;
    revision++;
  },
  putEntryTimeout: async (id, body) => {
    settingsCalls.push([id, body]);
    if (conflict) throw { response: { status: 409 } };
    assert.equal(body.revision, revision);
    custom = body.timeoutSeconds;
    revision++;
  }
};
vm.runInNewContext(
  ts.transpileModule(settingsCode, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText,
  settingsContext
);
const settings = settingsContext.settings;
settings.openTimeout(latest);
assert.equal(settings.timeoutSeconds.value, undefined);
settings.timeoutSeconds.value = 240;
await settings.saveTimeout();
assert.equal(settingsCalls.at(-1)[1].timeoutSeconds, 240);
assert.equal(settings.timeoutOpen.value, false);
settings.openReferences(latest);
settings.referencesForm.maxReferenceImages = 3;
await settings.saveReferences();
assert.equal(settingsCalls.at(-1)[1].revision, 1);
settings.openTimeout(latest);
assert.equal(settings.timeoutSeconds.value, 240);
settings.timeoutSeconds.value = undefined;
await settings.saveTimeout();
assert.equal(settingsCalls.at(-1)[1].revision, 2);
assert.equal(settingsCalls.at(-1)[1].timeoutSeconds, null);
settings.openTimeout(latest);
settings.timeoutSeconds.value = 601;
const beforeInvalid = settingsCalls.length;
await settings.saveTimeout();
assert.equal(settingsCalls.length, beforeInvalid);
settings.timeoutSeconds.value = 5;
conflict = true;
await settings.saveTimeout();
assert.equal(settings.timeoutOpen.value, false);
assert.equal(reloads, 4);
assert.match(messages.at(-1)[0], /重新加载/);
settings.openTimeout({ ...latest, capability: "CHAT" });
assert.equal(settings.timeoutOpen.value, false);
settingsContext.writable.value = false;
settings.openTimeout(latest);
await settings.saveTimeout();
assert.equal(settingsCalls.length, beforeInvalid + 1);
