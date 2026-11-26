import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileTemplate } from "vue/compiler-sfc";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const page = await read("src/views/integrations/closet/models/ModelUsage.vue");
const api = await read("src/api/closet/modelUsage.ts");
const { descriptor, errors } = parse(page);
assert.deepEqual(errors, []);
assert.deepEqual(compileTemplate({
  source: descriptor.template.content,
  filename: "ModelUsage.vue",
  id: "usage",
  compilerOptions: { expressionPlugins: ["typescript"] }
}).errors, []);
const helpers = descriptor.scriptSetup.content.match(/const durationSeconds = [\s\S]*?(?=const chart =)/)[0];
const code = ts.transpileModule(`${helpers}\nglobalThis.helpers = { durationSeconds, nearTimeout, timeoutResult, errorHint };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const context = {};
vm.runInNewContext(code, context);
const { durationSeconds, nearTimeout, timeoutResult, errorHint } = context.helpers;
assert.equal(durationSeconds(12345), "12.3 秒");
assert.equal(durationSeconds(0), "0.0 秒");
assert.equal(durationSeconds(null), "—");
assert.equal(nearTimeout(79999, 100), false);
assert.equal(nearTimeout(80000, 100), true);
assert.equal(nearTimeout(100000, 100), true);
assert.equal(nearTimeout(null, 100), false);
assert.equal(nearTimeout(80000, null), false);
assert.equal(timeoutResult(180), "超时（等满 180 秒）");
assert.equal(timeoutResult(null), "超时");
assert.equal(errorHint("PROVIDER_TIMEOUT"), "超时：等满了等待上限还没返回");
assert.equal(errorHint("PROVIDER_CONNECT_TIMEOUT"), "超时");
assert.match(api, /p95LatencyMs: number \| null;\s*timeoutSeconds: number \| null;/);
assert.match(api, /latencyMs: number;\s*timeoutSeconds: number \| null;/);
assert.match(page, /durationSeconds\(row\.p95LatencyMs\)/);
assert.match(page, /v-if="row\.timeoutSeconds != null"/);
assert.match(page, /nearTimeout\(row\.p95LatencyMs, row\.timeoutSeconds\)/);
assert.match(page, /接近超时上限，建议调大该模型的等待上限，或换更快的模型。/);
assert.match(page, /row\.errorCode === "PROVIDER_TIMEOUT"\s*\? timeoutResult\(row\.timeoutSeconds\)/);
assert.match(page, /durationSeconds\(row\.latencyMs\)/);
console.log("closet model usage timeout display");
