import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

for (const page of [
  "src/views/system/ip-rules/index.vue",
  "src/views/system/menu/index.vue",
  "src/views/content/announcements/index.vue",
  "src/views/account/security/index.vue"
]) {
  const source = await readFile(new URL(`../${page}`, import.meta.url), "utf8");
  assert.match(source, /flex flex-wrap items-center justify-between gap-3/);
  assert.doesNotMatch(source, /class="ml-auto"/);
}

const menuPage = await readFile(
  new URL("../src/views/system/menu/index.vue", import.meta.url),
  "utf8"
);
assert.match(menuPage, /async function toggleEnabled\(row: NavigationMenu\)/);
assert.match(menuPage, /row\.enabled \? "停用" : "启用"/);
assert.match(menuPage, /@click="toggleEnabled\(row\)"/);

console.log("admin page header contracts passed");
