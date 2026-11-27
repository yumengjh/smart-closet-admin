import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const calls = [];
const code = ts.transpileModule(await read("src/api/closet/models.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const api = {};
vm.runInNewContext(code, {
  exports: api,
  require: name => {
    assert.equal(name, "@/utils/http");
    return { http: { request: (...args) => { calls.push(args); return Promise.resolve({ data: {} }); } } };
  }
});
const provider = { id: "test", name: "Test", kind: "OPENAI_COMPATIBLE", baseUrl: "https://example.com/v1", apiKey: "secret", timeoutSeconds: 180, imageHosts: [] };
const providerEdit = { name: "Test", baseUrl: "https://example.com/v1", timeoutSeconds: 180, imageHosts: [], revision: 2 };
const entry = { capability: "VISION", providerId: "test", protocol: "OPENAI_CHAT", model: "test-model", label: null, baseUrl: null, options: { structuredOutput: "JSON_OBJECT" }, enabled: true };
const entryEdit = { label: null, baseUrl: null, options: {}, enabled: true, revision: 3 };
const route = { active: "cfg:vision:test:a/b", fallback: null, revision: 4 };
const cases = [
  ["getModels", [], "get", "/closet/models"],
  ["createProvider", [provider], "post", "/closet/models/providers", provider],
  ["editProvider", ["a/b", providerEdit], "patch", "/closet/models/providers/a%2Fb", providerEdit],
  ["deleteProvider", ["a/b"], "delete", "/closet/models/providers/a%2Fb"],
  ["probeProvider", ["a/b"], "post", "/closet/models/providers/a%2Fb/probe"],
  ["createEntry", [entry], "post", "/closet/models/entries", entry],
  ["editEntry", ["cfg:a/b", entryEdit], "patch", "/closet/models/entries/cfg%3Aa%2Fb", entryEdit],
  ["deleteEntry", ["cfg:a/b"], "delete", "/closet/models/entries/cfg%3Aa%2Fb"],
  ["resumeEntry", ["cfg:a/b"], "post", "/closet/models/entries/cfg%3Aa%2Fb/resume"],
  ["testEntry", ["cfg:a/b"], "post", "/closet/models/entries/cfg%3Aa%2Fb/test"],
  ["putRouting", ["VISION", route], "put", "/closet/models/routing/VISION", route],
  ["deleteRouting", ["VISION"], "delete", "/closet/models/routing/VISION"]
];
for (const [name, args, method, path, body] of cases) {
  await api[name](...args);
  const [actualMethod, actualPath, options] = calls.at(-1);
  assert.equal(actualMethod, method, name);
  assert.equal(actualPath, path, name);
  assert.deepEqual(options?.data ?? null, body ?? null, name);
}
const apiSource = await read("src/api/closet/models.ts");
assert.match(apiSource, /deleteRouting[\s\S]*ApiResponse<ModelRouting>/);
assert.match(apiSource, /resumeEntry[\s\S]*ApiResponse<ModelEntry>/);
const router = await read("src/router/utils.ts");
assert.match(router, /"closet-models":\s*\(\) =>\s*import\("@\/views\/integrations\/closet\/models\/index\.vue"\)/);
const icons = await read("src/components/ReIcon/src/offlineIcon.ts");
assert.match(icons, /\["ri\/settings-3-line", RiSettings3Line\]/);
console.log("closet models contract: request paths, payloads, permissions and UI safeguards");
