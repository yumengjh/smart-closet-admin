import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pages = [
  "src/views/system/users/index.vue",
  "src/views/system/rbac/index.vue",
  "src/views/system/ip-rules/index.vue",
  "src/views/content/announcements/index.vue"
];

for (const page of pages) {
  const source = await readFile(new URL(`../${page}`, import.meta.url), "utf8");
  assert.match(source, /<template>\s*<div class="page-root">/, `${page} must expose one transition root`);
}

console.log("route page root contracts passed");
