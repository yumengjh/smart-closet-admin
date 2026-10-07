import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const users = await readFile(new URL("../src/api/closet/users.ts", import.meta.url), "utf8");
const insights = await readFile(new URL("../src/api/closet/insights.ts", import.meta.url), "utf8");

function assertApi(source, name, method, suffix, root) {
  const start = source.indexOf(`export const ${name} =`);
  assert.notEqual(start, -1, `missing API function ${name}`);
  const end = source.indexOf("\nexport const ", start + 1);
  const body = source.slice(start, end < 0 ? source.length : end);
  assert.ok(body.includes(`"${method}",`), `${name} must use ${method.toUpperCase()}`);
  assert.ok(source.includes(root), `${name} API must use ${root}`);
  assert.ok(body.includes("root"), `${name} must build its path from the closet API root`);
  if (suffix) assert.ok(body.includes(suffix), `${name} must target ${suffix}`);
}

const userRoutes = [
  ["listClosetUsers", "get", "", 'const root = "/closet/users"'],
  ["getClosetUser", "get", "${root}/${encodeURIComponent(username)}", 'const root = "/closet/users"'],
  ["createClosetUser", "post", "", 'const root = "/closet/users"'],
  ["updateClosetUserStatus", "patch", "/status", 'const root = "/closet/users"'],
  ["updateClosetUserRole", "patch", "/role", 'const root = "/closet/users"'],
  ["resetClosetUserPassword", "post", "/password-reset", 'const root = "/closet/users"'],
  ["listClosetUserSessions", "get", "/sessions", 'const root = "/closet/users"'],
  ["revokeClosetUserSessions", "delete", "/sessions", 'const root = "/closet/users"'],
  ["listPortableLinks", "get", "/portable-links", 'const root = "/closet/users"'],
  ["revokePortableLink", "delete", "/portable-links/${encodeURIComponent(id)}", 'const root = "/closet/users"'],
  ["getClosetUserQuota", "get", "/quota", 'const root = "/closet/users"'],
  ["updateClosetUserQuota", "put", "/quota", 'const root = "/closet/users"']
];
for (const [name, method, suffix, root] of userRoutes) assertApi(users, name, method, suffix, root);

const insightRoutes = [
  ["getClosetOverview", "get", "/overview"],
  ["getClosetWardrobe", "get", "/wardrobe"],
  ["getClosetUsage", "get", "/usage"],
  ["getClosetTrends", "get", "/trends"]
];
for (const [name, method, suffix] of insightRoutes) assertApi(insights, name, method, suffix, 'const root = "/closet/insights"');

console.log("Closet API contract: 16 methods and paths match design 4.4.");
