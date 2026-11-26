import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("index.vue", import.meta.url), "utf8");
const start = source.indexOf("const providerOpen = ref(false);");
const end = source.indexOf("const saveProvider = async", start);
assert.ok(start >= 0 && end > start);
const script = source.slice(start, end) + "\nglobalThis.hosts = { providerForm, hostInput, anyPublicImageHost, openProvider, addRejectedHosts, addHost, providerCurrent, providerOpen };";
const context = {
  ref: value => ({ value }),
  reactive: value => value,
  computed: options => ({ get value() { return options.get(); }, set value(value) { options.set(value); } })
};
vm.runInNewContext(ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const h = context.hosts;
const row = { id: "example", name: "Example", kind: "OPENAI_COMPATIBLE", baseUrl: "https://example.com", timeoutSeconds: 180, revision: 3, imageHosts: ["old.example"], rejectedImageHosts: [{ host: "new.example", count: 3 }, { host: "old.example", count: 1 }, { host: "third.example", count: 1 }] };
h.addRejectedHosts(row);
assert.equal(h.providerOpen.value, true);
assert.equal(h.providerCurrent.value.revision, 3);
assert.deepEqual(Array.from(h.providerForm.imageHosts), ["old.example", "new.example", "third.example"]);
assert.deepEqual(row.imageHosts, ["old.example"]);
h.anyPublicImageHost.value = true;
assert.deepEqual(Array.from(h.providerForm.imageHosts), ["*"]);
h.anyPublicImageHost.value = false;
assert.deepEqual(Array.from(h.providerForm.imageHosts), []);
h.hostInput.value = "*";
h.addHost();
assert.equal(h.anyPublicImageHost.value, true);
h.hostInput.value = "specific.example";
h.addHost();
assert.deepEqual(Array.from(h.providerForm.imageHosts), ["specific.example"]);
assert.equal(h.anyPublicImageHost.value, false);
