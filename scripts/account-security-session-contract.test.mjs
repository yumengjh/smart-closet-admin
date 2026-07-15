import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/views/account/security/index.vue", import.meta.url),
  "utf8"
);

assert.doesNotMatch(source, /async function refreshSession/);
assert.doesNotMatch(source, /会话 ID/);
assert.match(source, /最近活动/);
assert.match(source, /首次登录/);

console.log("account security session contract passed");
