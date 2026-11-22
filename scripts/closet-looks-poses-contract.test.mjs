import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

// Values created inside the vm context have their own prototypes; compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
function loadTs(source, dependencies = {}) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  });
  const exports = {};
  vm.runInNewContext(result.outputText, {
    exports,
    require: name => {
      assert.ok(name in dependencies, `unexpected dependency ${name}`);
      return dependencies[name];
    }
  });
  return exports;
}
const calls = [];
const http = {
  http: {
    request: (...args) => {
      calls.push(args);
      return Promise.resolve({ data: {} });
    }
  }
};
const file = new File(["PNG"], "look.png", { type: "image/png" });

// ── API paths: the admin server proxies /api/manage/v1/looks* and /poses* under /closet ──
const looks = loadTs(await read("src/api/closet/looks.ts"), {
  "@/utils/http": http
});
const filters = { page: 0, size: 48, status: "LISTED", verified: true };
const look = { name: "春日通勤", category: "spring", coverage: "FULL" };
for (const [name, args, method, path, data] of [
  ["getLookCategories", [], "get", "/categories"],
  ["createLookCategory", [{ key: "outdoor", name: "户外" }], "post", "/categories", { key: "outdoor", name: "户外" }],
  ["editLookCategory", ["a/b", { enabled: true }], "patch", "/categories/a%2Fb", { enabled: true }],
  ["removeLookCategory", ["a/b"], "delete", "/categories/a%2Fb"],
  ["getLooks", [filters], "get", ""],
  ["createLook", [look], "post", "", look],
  ["composeLook", [{ ...look, presetIds: ["p1", "p2"] }], "post", "/compose", { ...look, presetIds: ["p1", "p2"] }],
  ["getLookImage", ["id/1"], "get", "/id%2F1/image"],
  ["putLookImage", ["id/1", file], "put", "/id%2F1/image"],
  ["editLook", ["id/1", { verified: true }], "patch", "/id%2F1", { verified: true }],
  ["removeLook", ["id/1"], "delete", "/id%2F1"],
  ["batchLooks", [["a", "b"], "VERIFY"], "post", "/batch", { ids: ["a", "b"], action: "VERIFY" }]
]) {
  await looks[name](...args);
  const [actualMethod, actualPath, options] = calls.at(-1);
  assert.equal(actualMethod, method, name);
  assert.equal(actualPath, `/closet/looks${path}`, name);
  if (data) assert.deepEqual(plain(options.data), data, name);
  if (name === "getLooks") assert.deepEqual(plain(options.params), filters);
  if (name === "getLookImage") assert.equal(options.responseType, "blob");
  if (name === "putLookImage") {
    assert.equal(options.data, file, "image upload sends raw bytes");
    assert.equal(options.headers["Content-Type"], "image/png");
  }
}

const poses = loadTs(await read("src/api/closet/poses.ts"), {
  "@/utils/http": http
});
const pose = { name: "自然站立", description: "正面自然站立" };
const settings = {
  user: { suggestive: true, nudity: true, minor: false },
  admin: { suggestive: true, nudity: true, minor: false },
  revision: 3
};
for (const [name, args, method, path, data] of [
  ["getPoses", [{ status: "LISTED" }], "get", ""],
  ["createPose", [pose], "post", "", pose],
  ["editPose", ["stand", { sort: 10 }], "patch", "/stand", { sort: 10 }],
  ["removePose", ["a/b"], "delete", "/a%2Fb"],
  ["batchPoses", [["a"], "UNLIST"], "post", "/batch", { ids: ["a"], action: "UNLIST" }],
  ["extractPose", [file], "post", "/extract"],
  ["checkPose", [pose], "post", "/check", pose],
  ["getPoseCheckSettings", [], "get", "/check-settings"],
  ["putPoseCheckSettings", [settings], "put", "/check-settings", settings]
]) {
  await poses[name](...args);
  const [actualMethod, actualPath, options] = calls.at(-1);
  assert.equal(actualMethod, method, name);
  assert.equal(actualPath, `/closet/poses${path}`, name);
  if (data) assert.deepEqual(plain(options.data), data, name);
  if (name === "extractPose") {
    assert.equal(options.data, file, "extraction sends raw bytes");
    assert.equal(options.headers["Content-Type"], "image/png");
  }
}

// ── Pose logic: settings diff and 3:4 skeleton mapping ──
const logic = loadTs(
  await read("src/views/integrations/closet/poses/poseLogic.ts")
);
assert.deepEqual(
  plain(logic.JOINTS),
  ["HEAD", "NECK", "L_SHOULDER", "R_SHOULDER", "L_ELBOW", "R_ELBOW", "L_WRIST", "R_WRIST", "L_HIP", "R_HIP", "L_KNEE", "R_KNEE", "L_ANKLE", "R_ANKLE"],
  "joints follow PoseCards.JOINTS"
);
const before = { user: { ...settings.user }, admin: { ...settings.admin } };
assert.deepEqual(plain(logic.checkChanges(before, structuredClone(before))), []);
const after = structuredClone(before);
after.user.minor = true;
after.admin.suggestive = false;
assert.deepEqual(
  plain(logic.checkChanges(before, after).map(change => change.text)),
  ["用户端 · 疑似未成年：关 → 开", "管理端 · 性感动作：开 → 关"]
);

assert.deepEqual(plain(logic.toCanvas([0.5, 0.25])), { x: 150, y: 100 });
assert.deepEqual(plain(logic.toCanvas([0.5, 0.5], 30, 40)), { x: 15, y: 20 });
assert.deepEqual(plain(logic.toCanvas([-0.2, 1.4])), { x: 0, y: 400 }, "out-of-frame points are clamped");
for (const bad of [null, [0.1], ["0.1", 0.2], [Number.NaN, 0.2], { x: 1, y: 1 }])
  assert.equal(logic.toCanvas(bad), null);

const full = Object.fromEntries(logic.JOINTS.map((joint, i) => [joint, [0.5, (i + 1) / 20]]));
const shape = logic.skeleton(full);
assert.equal(shape.points.length, 14);
assert.equal(shape.lines.length, logic.BONES.length);
const partial = logic.skeleton({ HEAD: [0.5, 0.1], NECK: [0.5, 0.2], L_WRIST: [0.6, 0.5], NOSE: [0.5, 0.1] });
assert.deepEqual(plain(partial.points.map(p => p.joint)), ["HEAD", "NECK", "L_WRIST"], "unknown joints are ignored");
assert.deepEqual(plain(partial.lines.map(l => `${l.from}-${l.to}`)), ["HEAD-NECK"], "bones need both ends");
assert.deepEqual(plain(logic.skeleton(null)), { points: [], lines: [] });

assert.ok(logic.POSE_ID.test("hand-on-hip"));
assert.ok(!logic.POSE_ID.test("Hand"));
assert.ok(!logic.POSE_ID.test("a"));
assert.deepEqual(plain(logic.cleanTags([" 站姿", "站姿", "", "休闲"])), ["站姿", "休闲"]);

// ── Look logic ──
const lookLogic = loadTs(
  await read("src/views/integrations/closet/looks/lookLogic.ts")
);
assert.equal(lookLogic.categoryProblem("outdoor", "户外"), "");
assert.notEqual(lookLogic.categoryProblem("Outdoor", "户外"), "");
assert.notEqual(lookLogic.categoryProblem("o", "户外"), "");
assert.notEqual(lookLogic.categoryProblem("outdoor", "九个字的分类名称啊"), "");
assert.equal(lookLogic.categoryProblem(null, "户外"), "", "existing keys are not rechecked");
assert.equal(lookLogic.composeProblem(1), "至少选 2 件");
assert.equal(lookLogic.composeProblem(2), "");
assert.equal(lookLogic.composeProblem(6), "");
assert.equal(lookLogic.composeProblem(7), "最多选 6 件");
assert.equal(lookLogic.imageProblem({ type: "image/webp", size: 1 }), "");
assert.notEqual(lookLogic.imageProblem({ type: "image/gif", size: 1 }), "");
assert.notEqual(lookLogic.imageProblem({ type: "image/png", size: 21 * 1024 * 1024 }), "");
assert.equal(lookLogic.lookProblem({ name: "春日通勤", category: "spring", tags: ["通勤"] }), "");
assert.notEqual(lookLogic.lookProblem({ name: "", category: "spring", tags: [] }), "");
assert.notEqual(lookLogic.lookProblem({ name: "春日", category: "", tags: [] }), "");
assert.notEqual(lookLogic.lookProblem({ name: "春日", category: "spring", tags: ["九个字的标签名称啊"] }), "");
assert.equal(lookLogic.lookTags(Array.from({ length: 10 }, (_, i) => `t${i}`)).length, 8);

// ── Route registration and permissions ──
for (const key of ["closet-looks", "closet-poses"])
  for (const path of ["src/router/utils.ts", "src/api/routes.ts", "src/api/navigation.ts", "src/views/system/menu/index.vue"])
    assert.ok((await read(path)).includes(`"${key}"`), `${key} missing from ${path}`);
const looksPage = await read("src/views/integrations/closet/looks/index.vue");
assert.ok(looksPage.includes('can("closet:looks:write")'));
assert.ok(looksPage.includes("请使用无人物、你有权使用的整套平铺图"));
assert.ok(looksPage.includes("标记已验证前，请先用鱼搭管理员账号在镜头试穿里试一下"));
const posesPage = await read("src/views/integrations/closet/poses/index.vue");
assert.ok(posesPage.includes('can("closet:poses:write")'));
assert.ok(posesPage.includes("ElMessageBox.confirm"), "check settings are confirmed before saving");
console.log("Closet looks and poses: API paths, settings diff, skeleton mapping and routes covered.");
