import assert from "node:assert/strict";
import {
  filterRegisteredRoutePaths,
  toAsyncRouteRecords
} from "../src/router/navigation.mjs";

const registry = Object.fromEntries([
  "menu-management", "user-management", "rbac-management", "runtime-config",
  "ip-rule-management", "audit-log", "announcement-management", "account-security",
  "closet-users", "closet-insights"
].map(key => [key, `${key}Component`]));
const routes = toAsyncRouteRecords(
  [{
    code: "menu-management",
    path: "/system/menu",
    componentKey: "menu-management",
    title: "菜单管理",
    icon: "Menu",
    rank: 100,
    keepAlive: false,
    requiredPermission: "system:menu:read",
    children: []
  }],
  registry,
  "DirectoryComponent"
);

assert.equal(routes.length, 1);
assert.equal(routes[0].path, "/system/menu");
assert.equal("children" in routes[0], false, "叶子页面不应携带空 children 数组");

for (const componentKey of Object.keys(registry)) {
  const [record] = toAsyncRouteRecords([{ ...routes[0], code: componentKey, path: `/${componentKey}`, componentKey, children: [] }], registry, "DirectoryComponent");
  assert.equal(record.component, registry[componentKey]);
  assert.equal("children" in record, false);
}

const navigation = filterRegisteredRoutePaths([
  { path: "/welcome", name: "home" },
  { path: "/system/menu", name: "menu-management" }
], new Set(["/", "/welcome"]));

assert.deepEqual(navigation, [{ path: "/system/menu", name: "menu-management" }]);
