import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

// Exercise the public API functions against a recording transport, without a backend.
const source = await readFile(
  new URL("../src/api/closet/creation.ts", import.meta.url),
  "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;
const calls = [];
const exports = {};
const context = {
  exports,
  require: id => {
    assert.equal(id, "@/utils/http");
    return {
      http: {
        request: (...args) => {
          calls.push(args);
          return Promise.resolve({ data: {} });
        }
      }
    };
  }
};
vm.runInNewContext(compiled, context);

const id = "sunlit-flatlay";
const version = "version-1";
const base = `/closet/creations/templates/${id}`;
const cases = [
  ["getCreationTemplates", [], "get", "/closet/creations/templates"],
  [
    "createCreationVersion",
    [id, null],
    "post",
    `${base}/versions`,
    { fromVersionId: null }
  ],
  ["getCreationVersion", [id, version], "get", `${base}/versions/${version}`],
  [
    "saveCreationVersion",
    [id, version, { revision: 3 }],
    "put",
    `${base}/versions/${version}`,
    { revision: 3 }
  ],
  [
    "verifyCreationVersion",
    [id, version, 3, "evidence"],
    "post",
    `${base}/versions/${version}/verify`,
    { revision: 3, evidence: "evidence" }
  ],
  [
    "publishCreationVersion",
    [id, version, 3],
    "post",
    `${base}/versions/${version}/publish`,
    { revision: 3 }
  ],
  [
    "retireCreationTemplate",
    [id, 4],
    "post",
    `${base}/retire`,
    { revision: 4 }
  ],
  ["getCreationCapabilities", [], "get", "/closet/creations/capabilities"],
  [
    "saveCreationCapability",
    [{ purpose: "ART_CREATION", version: 0 }],
    "put",
    "/closet/creations/capabilities",
    { purpose: "ART_CREATION", version: 0 }
  ],
  [
    "getCreationUsage",
    ["2026-11-01", "2026-11-02"],
    "get",
    "/closet/creations/usage"
  ]
];
for (const [name, args, method, path, data] of cases) {
  calls.length = 0;
  await exports[name](...args);
  assert.equal(calls.length, 1, `${name}: request count`);
  assert.equal(calls[0][0], method, name);
  assert.equal(calls[0][1], path, name);
  if (data)
    assert.equal(JSON.stringify(calls[0][2].data), JSON.stringify(data), name);
}
assert.equal(
  JSON.stringify(calls[0][2].params),
  JSON.stringify({ from: "2026-11-01", to: "2026-11-02" })
);
await exports.getCreationVersion("sunlit-flatlay", "v/a");
assert.ok(calls.at(-1)[1].endsWith("v%2Fa"), "version IDs must be encoded");

for (const key of [
  "closet-creation-templates",
  "closet-creation-capabilities",
  "closet-creation-usage"
]) {
  for (const file of [
    "../src/router/utils.ts",
    "../src/api/routes.ts",
    "../src/api/navigation.ts",
    "../src/views/system/menu/index.vue"
  ])
    assert.ok(
      (await readFile(new URL(file, import.meta.url), "utf8")).includes(key),
      `${key} missing in ${file}`
    );
}
console.log(
  "Creation API: 10 operations and 3 navigation keys verified against recording transport."
);
