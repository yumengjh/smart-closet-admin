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
  [
    "getCreationGenerationOptions",
    [],
    "get",
    "/closet/creations/generation-options"
  ],
  [
    "getCreationUsage",
    ["2026-11-01", "2026-11-02"],
    "get",
    "/closet/creations/usage"
  ],
  ["getTrialGarments", [], "get", "/closet/creations/trial-garments"],
  [
    "getTrialGarmentImage",
    ["g/1"],
    "get",
    "/closet/creations/trial-garments/g%2F1/image"
  ],
  ["getTrialPersons", [], "get", "/closet/creations/trial-persons"],
  [
    "getTrialPersonImage",
    ["p1"],
    "get",
    "/closet/creations/trial-persons/p1/image"
  ],
  ["deleteTrialPerson", ["p1"], "delete", "/closet/creations/trial-persons/p1"],
  [
    "startCreationTrial",
    [id, version, { revision: 3, garmentIds: ["g1"] }],
    "post",
    `${base}/versions/${version}/trials`,
    { revision: 3, garmentIds: ["g1"] }
  ],
  ["getCreationTrials", [id], "get", `${base}/trials`],
  ["getCreationTrial", ["t1"], "get", "/closet/creations/trials/t1"],
  ["getCreationTrialImage", ["t1"], "get", "/closet/creations/trials/t1/image"],
  [
    "getCreationPreviewImage",
    [id, version],
    "get",
    `${base}/versions/${version}/preview-image`
  ],
  ["getCreationPromptSamples", [], "get", "/closet/creations/prompt-samples"],
  [
    "createCreationEffect",
    [{ name: "新效果", personRequired: true, sampleKey: "k" }],
    "post",
    "/closet/creations/templates",
    { name: "新效果", personRequired: true, sampleKey: "k" }
  ],
  ["deleteCreationEffect", [id], "delete", base],
  [
    "reorderCreationEffects",
    [["b", "a"]],
    "put",
    "/closet/creations/templates/order",
    { ids: ["b", "a"] }
  ],
  [
    "setCreationPreview",
    [id, version, { trialId: "t1" }],
    "post",
    `${base}/versions/${version}/preview`,
    { trialId: "t1" }
  ],
  [
    "launchCreationVersion",
    [id, version, { revision: 5, trialId: "t1" }],
    "post",
    `${base}/versions/${version}/launch`,
    { revision: 5, trialId: "t1" }
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
  if (name === "getCreationUsage")
    assert.equal(
      JSON.stringify(calls[0][2].params),
      JSON.stringify({ from: "2026-11-01", to: "2026-11-02" })
    );
  if (name.endsWith("Image"))
    assert.equal(calls[0][2].responseType, "blob", name);
}
await exports.getCreationVersion("sunlit-flatlay", "v/a");
assert.ok(calls.at(-1)[1].endsWith("v%2Fa"), "version IDs must be encoded");

for (const key of ["closet-creation-templates", "closet-creation-usage"]) {
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

const readProjectFile = file =>
  readFile(new URL(file, import.meta.url), "utf8");
const [creationRoutes, dynamicRoutes, offlineIcons] = await Promise.all([
  readProjectFile("../src/router/modules/creation.ts"),
  readProjectFile("../src/router/utils.ts"),
  readProjectFile("../src/components/ReIcon/src/offlineIcon.ts")
]);
assert.ok(
  creationRoutes.includes('redirect: "/creation/templates"'),
  "the creation module must open the effects page by default"
);
assert.ok(!creationRoutes.includes("Guide.vue"), "guide page is removed");

const creationPages = [
  ["templates", "closet-creation-templates", "ri/image-line", "Templates.vue"],
  ["usage", "closet-creation-usage", "ri/bar-chart-line", "Usage.vue"],
  ["showcases", "closet-creation-showcases", "ri/gallery-line", "Showcases.vue"]
];
for (const [route, key, icon, view] of creationPages) {
  const componentPath = `@/views/integrations/closet/creation/${view}`;
  assert.ok(
    creationRoutes.includes(`path: "/creation/${route}"`) &&
      creationRoutes.includes(componentPath) &&
      creationRoutes.includes(`icon: "${icon}"`),
    `static route, component, or icon missing for ${route}`
  );
  assert.ok(
    dynamicRoutes.includes(`"${key}": () =>`) &&
      dynamicRoutes.includes(componentPath),
    `dynamic route component missing for ${key}`
  );
  const symbol = icon
    .split("/")[1]
    .split("-")
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join("");
  const importName = `Ri${symbol}`;
  assert.ok(
    offlineIcons.includes(`import ${importName} from "~icons/${icon}?raw";`) &&
      offlineIcons.includes(`["${icon}", ${importName}]`),
    `offline icon import or registration missing for ${icon}`
  );
}
assert.ok(!creationRoutes.includes("/creation/capabilities"));
for (const file of [
  "../src/router/utils.ts",
  "../src/api/routes.ts",
  "../src/api/navigation.ts",
  "../src/views/system/menu/index.vue"
]) {
  assert.ok(
    !(await readProjectFile(file)).includes("closet-creation-capabilities")
  );
}
assert.equal(exports.getCreationCapabilities, undefined);
assert.equal(exports.saveCreationCapability, undefined);
const editor = await readProjectFile(
  "../src/views/integrations/closet/creation/EffectEditor.vue"
);
assert.match(
  editor,
  /效果用哪个生图模型，在[\s\S]*?<router-link to="\/closet\/models">模型调配<\/router-link>[\s\S]*?里统一设置。/
);
assert.match(editor, /getCreationGenerationOptions/);
const opsPage = await readProjectFile(
  "../src/views/integrations/closet/ops/index.vue"
);
assert.match(
  opsPage,
  /本地模型与服务商[\s\S]*?<router-link\s+v-if="can\('closet:models:read'\)"\s+to="\/closet\/models"\s*>去模型调配<\/router-link\s*>/
);
assert.doesNotMatch(
  opsPage,
  /creation\/capabilities|ClosetCreationCapabilities/
);
const modelsPage = await readProjectFile(
  "../src/views/integrations/closet/models/index.vue"
);
assert.doesNotMatch(
  modelsPage,
  /creation\/capabilities|ClosetCreationCapabilities/
);
console.log(
  "Creation API: 26 operations, static/dynamic navigation, and offline icons verified."
);
