import assert from "node:assert/strict";
import { avatarSessionMenu } from "../src/layout/hooks/session-actions.mjs";

assert.deepEqual(avatarSessionMenu, ["account", "refresh", "logout"]);
assert.equal(avatarSessionMenu.includes("token"), false);

console.log("avatar session menu contract passed");
