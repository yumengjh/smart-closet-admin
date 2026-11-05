import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
function loadTs(source, dependencies) {
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(result.outputText, { exports, require: name => {
    assert.ok(name in dependencies, `unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const calls = [];
const api = loadTs(await read("src/api/closet/tryon.ts"), { "@/utils/http": { http: { request: (...args) => { calls.push(args); return Promise.resolve({ data: {} }); } } } });
const settings = { revision: 12, value: { mode: "FOLLOW_USER", dailySeconds: 180 } };
const policy = { accessMode: "INHERIT", dailySeconds: null, startupFailureLimit: 0 };
const credential = { name: "测试账户", environment: "china", apiKey: "uk-test-only-secret" };
const account = { name: "运营账户", accepting: false, weight: 2, concurrencyLimit: 1 };
const cases = [
  ["getTryOnSettings", [], "get", "/settings"],
  ["updateTryOnSettings", [settings], "put", "/settings", settings],
  ["resetTryOnSettings", [12], "post", "/settings/reset", { revision: 12 }],
  ["getTryOnUserPolicy", ["a/b"], "get", "/users/a%2Fb/policy"],
  ["updateTryOnUserPolicy", ["a/b", policy], "put", "/users/a%2Fb/policy", policy],
  ["getTryOnUserUsage", ["a/b"], "get", "/users/a%2Fb/usage"],
  ["resetTryOnStartupFailures", ["a/b"], "post", "/users/a%2Fb/startup-failures/reset"],
  ["listTryOnAccounts", [], "get", "/accounts"],
  ["registerTryOnAccount", [credential], "post", "/accounts", credential],
  ["getTryOnAccount", ["id/1"], "get", "/accounts/id%2F1"],
  ["updateTryOnAccount", ["id/1", account], "patch", "/accounts/id%2F1", account],
  ["rotateTryOnCredential", ["id/1", credential], "post", "/accounts/id%2F1/credentials", credential],
  ["removeTryOnCredential", ["id/1", "key/2"], "delete", "/accounts/id%2F1/credentials/key%2F2"],
  ["probeTryOnAccount", ["id/1"], "post", "/accounts/id%2F1/probe"],
  ["updateTryOnAccountBudget", ["id/1", 3000], "post", "/accounts/id%2F1/budget", { budgetPoints: 3000 }],
  ["getTryOnPool", [], "get", "/pool"],
  ["getTryOnReferenceSource", [], "get", "/reference-source"],
  ["getTryOnUsage", [], "get", "/usage"],
  ["listTryOnSessions", [], "get", "/sessions"],
  ["getTryOnSession", ["id/1"], "get", "/sessions/id%2F1"],
  ["stopTryOnSession", ["id/1"], "post", "/sessions/id%2F1/stop"],
  ["stopTryOnAccountSessions", ["id/1"], "post", "/accounts/id%2F1/stop-sessions"]
];
for (const [name, args, method, path, data] of cases) {
  await api[name](...args);
  const [actualMethod, actualPath, options] = calls.at(-1);
  assert.equal(actualMethod, method, name);
  assert.equal(actualPath, `/closet/tryon${path}`, name);
  assert.deepEqual(JSON.parse(JSON.stringify(options?.data ?? null)), data ?? null, name);
}
const contract = await read("docs/integrations/closet/management-api.yaml");
const sourceOperations = [];
let path;
for (const line of contract.split("\n")) {
  const p = line.match(/^  (\/tryon\/[^:]+):/);
  if (/^  \//.test(line)) path = p?.[1];
  const m = line.match(/^    (get|put|post|patch|delete):/);
  if (path && m) sourceOperations.push(`${m[1]} ${path}`);
}
const normalize = path => path.replace(/a%2Fb/g, "{username}").replace(/id%2F1/g, "{id}").replace(/key%2F2/g, "{credentialId}");
assert.deepEqual(cases.map(([, , method, path]) => `${method} /tryon${normalize(path)}`).sort(), sourceOperations.sort(), "every current try-on contract operation needs a typed API client");

let allowed = false;
let confirmations = 0;
let operationCalls = 0;
let dispose;
let confirm = async () => { confirmations++; };
const action = loadTs(await read("src/views/integrations/closet/tryon/useTryOnAction.ts"), {
  vue: { ref: value => ({ value }), onBeforeUnmount: fn => { dispose = fn; } },
  "element-plus": { ElMessageBox: { confirm: (...args) => confirm(...args) } },
  "@/composables/useCurrentPermissions": { useCurrentPermissions: () => ({ can: () => allowed }) },
  "@/api/closet/errors": { isClosetServiceUnavailable: e => e.response?.status === 503 },
  "@/utils/message": { message: () => {} }
}).useTryOnAction();
const operation = async () => { operationCalls++; return { data: true }; };
await action.act("stop", "停止会话", "确认", operation);
assert.equal(confirmations, 0); assert.equal(operationCalls, 0);
allowed = true;
confirm = async () => { throw "cancel"; };
await action.act("stop", "停止会话", "确认", operation);
assert.equal(operationCalls, 0); assert.equal(action.saving.value, false);
let release;
confirm = () => new Promise(resolve => { release = resolve; });
const pending = action.act("stop", "停止会话", "确认", operation);
await action.act("stop", "停止会话", "确认", operation);
allowed = false;
release(); await pending;
assert.equal(operationCalls, 0, "permission must be rechecked after confirmation; duplicate clicks must not write");
allowed = true; confirm = async () => {};
await action.act("stop", "停止会话", "确认", operation);
assert.equal(operationCalls, 1);
await action.act("credentials", "轮换凭证", "确认", async () => { throw { response: { status: 409, data: { message: credential.apiKey } } }; });
assert.ok(action.actionError.value.includes("冲突"));
assert.ok(!action.actionError.value.includes(credential.apiKey));
await action.act("credentials", "轮换凭证", "确认", async () => { throw { response: { status: 503 } }; });
assert.ok(action.actionError.value.includes("暂不可用"));
const beforeDispose = operationCalls;
confirm = () => new Promise(resolve => { release = resolve; });
const abandoned = action.act("write", "保存设置", "确认", operation);
dispose(); release(); await abandoned;
assert.equal(operationCalls, beforeDispose, "leaving a page during confirmation must not submit a write");
for (const file of ["src/router/utils.ts", "src/api/routes.ts", "src/api/navigation.ts", "src/views/system/menu/index.vue"]) assert.ok((await read(file)).includes('"closet-tryon"'));
console.log("Try-on: 22 API operations, complete contract coverage, encoded paths, full policy payloads, permission checks, cancellation, duplicate clicks, conflicts and unavailable errors passed.");
