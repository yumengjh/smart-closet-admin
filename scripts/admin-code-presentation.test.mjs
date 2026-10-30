import assert from "node:assert/strict";
import {
  adminCodeLabel,
  adminCodeTooltip
} from "../src/views/system/admin-code-presentation.mjs";

assert.equal(adminCodeLabel("userStatus", "ACTIVE"), "正常");
assert.equal(adminCodeLabel("role", "SUPER_ADMIN"), "超级管理员");
assert.equal(
  adminCodeTooltip("userStatus", "LOCKED"),
  "账号因安全策略暂时锁定，不能登录。（LOCKED）"
);
assert.equal(adminCodeLabel("ipRuleType", "DENY"), "拒绝访问");
assert.equal(adminCodeLabel("permission", "system:menu:read"), "查看后台菜单配置");
assert.equal(adminCodeLabel("navigationComponent", "runtime-config"), "运行时配置");
assert.equal(
  adminCodeLabel("auditAction", "ROLE_PERMISSION_GRANTED"),
  "授予角色权限"
);
assert.equal(adminCodeLabel("permission", "closet:styleterms:write"), "审核鱼搭风格词");
assert.equal(adminCodeLabel("navigationComponent", "closet-style-terms"), "风格词审核");
assert.equal(adminCodeLabel("auditAction", "CLOSET_STYLE_TERM_REJECT"), "驳回鱼搭风格词");
assert.equal(adminCodeLabel("auditResult", "SUCCESS"), "成功");
assert.equal(adminCodeLabel("auditTargetType", "RuntimeSetting"), "运行时配置");
assert.equal(adminCodeLabel("auditAction", "CUSTOM_EVENT"), "CUSTOM_EVENT");

console.log("admin code presentation contracts passed");
