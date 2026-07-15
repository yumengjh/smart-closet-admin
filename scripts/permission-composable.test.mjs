import assert from "node:assert/strict";
import { hasPermission } from "../src/composables/permissions.mjs";

assert.equal(hasPermission(["system:user:read"], "system:user:read"), true);
assert.equal(hasPermission(["system:user:read"], "system:user:write"), false);
assert.equal(hasPermission([], "system:user:read"), false);

console.log("permission composable contract passed");
