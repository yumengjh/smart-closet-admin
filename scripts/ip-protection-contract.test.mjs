import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../src/api/security.ts", import.meta.url), "utf8");
const page = await readFile(
  new URL("../src/views/system/ip-rules/index.vue", import.meta.url),
  "utf8"
);

for (const field of [
  "source",
  "status",
  "violationCount",
  "lastTriggeredAt",
  "revokedAt"
]) assert.match(api, new RegExp(field));

assert.match(page, />自动临时封禁</);
assert.match(page, /ipRuleSource/);
assert.match(page, /ipRuleStatus/);
assert.match(page, /row\.violationCount/);
assert.match(page, /row\.lastTriggeredAt/);
assert.match(page, /row\.status === 'ACTIVE'/);
assert.match(page, />解除</);

console.log("ip protection contracts passed");
