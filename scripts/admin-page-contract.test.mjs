import assert from "node:assert/strict";
import {
  roleCodeError,
  rolePayload,
  userStatusPayload
} from "../src/views/system/admin-contracts.mjs";

assert.deepEqual(userStatusPayload("DISABLED"), { status: "DISABLED" });
assert.deepEqual(rolePayload("OPS_ADMIN", "运维管理员"), {
  code: "OPS_ADMIN",
  displayName: "运维管理员"
});
assert.equal(roleCodeError("CONTENT_EDITOR"), undefined);
assert.equal(roleCodeError("editor"), "角色编码只能使用 2–64 位大写字母和下划线");
assert.equal(roleCodeError("A1"), "角色编码只能使用 2–64 位大写字母和下划线");

console.log("admin page contracts passed");
