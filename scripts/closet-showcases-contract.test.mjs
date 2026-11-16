import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
const calls = [];
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    await readFile(
      new URL("../src/api/closet/showcases.ts", import.meta.url),
      "utf8"
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  {
    exports,
    FormData,
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
  }
);
const root = "/closet/creations/showcases",
  content = { title: "official", description: "", sortOrder: 0 };
for (const [name, args, method, path, data] of [
  ["getShowcases", [1, 20], "get", root],
  [
    "createShowcase",
    ["upload-1", content],
    "post",
    root,
    { uploadId: "upload-1", ...content }
  ],
  [
    "editShowcase",
    ["id/1", 2, content],
    "put",
    `${root}/id%2F1`,
    { revision: 2, ...content }
  ],
  [
    "publishShowcase",
    ["id-1", 2],
    "post",
    `${root}/id-1/publish`,
    { revision: 2 }
  ],
  [
    "retireShowcase",
    ["id-1", 2],
    "post",
    `${root}/id-1/retire`,
    { revision: 2 }
  ],
  ["getShowcaseImage", ["id-1"], "get", `${root}/id-1/image`]
]) {
  await exports[name](...args);
  const call = calls.at(-1);
  assert.equal(call[0], method);
  assert.equal(call[1], path);
  if (data) assert.equal(JSON.stringify(call[2].data), JSON.stringify(data));
  if (name === "getShowcases")
    assert.equal(
      JSON.stringify(call[2].params),
      JSON.stringify({ page: 1, size: 20 })
    );
  if (name === "getShowcaseImage") assert.equal(call[2].responseType, "blob");
}
await exports.uploadShowcase(
  new File(["PNG"], "official.png", { type: "image/png" }),
  "source"
);
const upload = calls.at(-1);
assert.equal(upload[1], `${root}/uploads`);
assert.deepEqual([...upload[2].data.keys()], ["file", "sourceNote"]);
assert.equal(upload[2].data.get("sourceNote"), "source");
assert.equal(
  upload[2].headers["Content-Type"],
  undefined,
  "browser must generate multipart boundary"
);
for (const file of [
  "src/router/utils.ts",
  "src/api/routes.ts",
  "src/api/navigation.ts",
  "src/views/system/menu/index.vue"
])
  assert.ok(
    (await readFile(new URL(`../${file}`, import.meta.url), "utf8")).includes(
      "closet-creation-showcases"
    ),
    file
  );
console.log(
  "Showcase: 7 request contracts, raw multipart boundary, binary preview and independent navigation verified."
);
