import assert from "node:assert/strict";
import {
  permissionOptionLabel,
  permissionOptionTooltip
} from "../src/views/system/rbac/permission-option.mjs";

const permission = {
  code: "system:user:read",
  description: "查看用户列表与用户资料"
};

assert.equal(permissionOptionLabel(permission), "查看用户列表与用户资料");
assert.equal(
  permissionOptionTooltip(permission),
  "查看用户列表与用户资料（system:user:read）"
);
assert.equal(
  permissionOptionLabel({ code: "custom:report:read", description: null }),
  "custom:report:read"
);

console.log("rbac permission option contracts passed");
