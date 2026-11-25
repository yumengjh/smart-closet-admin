import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Closet menus are seeded by smart-closet-admin-server; their icons only render when registered offline here.
const bootstrap = new URL(
  "../../smart-closet-admin-server/src/main/java/com/yumg/starter/modules/integrations/closet/application/ClosetNavigationBootstrap.java",
  import.meta.url
);
const offline = await readFile(
  new URL("../src/components/ReIcon/src/offlineIcon.ts", import.meta.url),
  "utf8"
);
if (!existsSync(bootstrap)) {
  console.log("closet nav icons: admin-server checkout not found, skipped");
} else {
  const source = await readFile(bootstrap, "utf8");
  const icons = [
    ...new Set([...source.matchAll(/"(ri\/[a-z0-9-]+)"/g)].map(m => m[1]))
  ];
  assert.ok(icons.length > 0, "no closet menu icons found in the bootstrap");
  const missing = icons.filter(icon => !offline.includes(`["${icon}", `));
  assert.deepEqual(
    missing,
    [],
    `closet menu icons not registered offline: ${missing.join(", ")}`
  );
  console.log(`closet nav icons: ${icons.length} menu icons registered`);
}
