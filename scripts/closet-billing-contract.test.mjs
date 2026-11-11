import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const calls = [];
const code = ts.transpileModule(await read("src/api/closet/billing.ts"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const exports = {};
vm.runInNewContext(code, {
  exports,
  require: name => {
    assert.equal(name, "@/utils/http");
    return {
      http: {
        request: (...args) => {
          calls.push(args);
          return Promise.resolve({ data: {} });
        }
      }
    };
  }
});
const cases = [
  ["getSettings", [], "get", "/billing/settings"],
  [
    "putSettings",
    [{ enabled: true }],
    "put",
    "/billing/settings",
    { enabled: true }
  ],
  ["getTiers", [], "get", "/billing/tiers"],
  [
    "putTier",
    ["image.standard", { model: "local-test" }],
    "put",
    "/billing/tiers/image.standard",
    { model: "local-test" }
  ],
  ["getCosts", [], "get", "/billing/cost-rates"],
  [
    "postCost",
    [
      {
        model: "local-test",
        unit: "PER_IMAGE",
        amountMicro: 10,
        currency: "CNY"
      }
    ],
    "post",
    "/billing/cost-rates",
    { model: "local-test", unit: "PER_IMAGE", amountMicro: 10, currency: "CNY" }
  ],
  ["getProducts", [], "get", "/billing/products"],
  [
    "postProduct",
    [{ name: "test", points: 100 }],
    "post",
    "/billing/products",
    { name: "test", points: 100 }
  ],
  [
    "putProduct",
    ["id/1", { enabled: false }],
    "put",
    "/billing/products/id%2F1",
    { enabled: false }
  ],
  ["getOrders", ["FULFILLED", 50], "get", "/billing/orders"],
  ["disputeOrder", ["id/1"], "post", "/billing/orders/id%2F1/sandbox-dispute"],
  ["getBatches", [], "get", "/billing/redemption-batches"],
  [
    "postBatch",
    [{ name: "test", points: 100, quantity: 2 }],
    "post",
    "/billing/redemption-batches",
    { name: "test", points: 100, quantity: 2 }
  ],
  ["getCodes", ["id/1"], "get", "/billing/redemption-batches/id%2F1/codes"],
  [
    "disableBatch",
    ["id/1"],
    "post",
    "/billing/redemption-batches/id%2F1/disable"
  ],
  ["getMargin", ["2026-11-01", "2026-11-11"], "get", "/billing/margin"],
  ["getAlerts", [], "get", "/billing/margin/alerts"],
  [
    "getExplain",
    ["image.standard", "2026-11-01", "2026-11-11", 50],
    "get",
    "/billing/margin/explain"
  ],
  ["getUserBilling", ["a/b"], "get", "/users/a%2Fb/billing"],
  [
    "changePoints",
    ["a/b", { points: 100, note: "test" }, "same-attempt"],
    "post",
    "/users/a%2Fb/points",
    { points: 100, note: "test" }
  ],
  [
    "grantEntitlement",
    ["a/b", { days: 1, imageDailyLimit: 40 }],
    "post",
    "/users/a%2Fb/entitlements",
    { days: 1, imageDailyLimit: 40 }
  ],
  ["revokeEntitlement", ["id/1"], "delete", "/billing/entitlements/id%2F1"]
];
const plain = v => JSON.parse(JSON.stringify(v));
for (const [name, args, verb, path, body] of cases) {
  await exports[name](...args);
  const [method, url, options] = calls.at(-1);
  assert.equal(method, verb, name);
  assert.equal(url, `/closet${path}`, name);
  assert.deepEqual(plain(options?.data ?? null), body ?? null, name);
  if (name === "changePoints")
    assert.equal(options.headers["Idempotency-Key"], "same-attempt");
  if (name === "getOrders")
    assert.deepEqual(plain(options.params), { status: "FULFILLED", limit: 50 });
  if (name === "getExplain")
    assert.deepEqual(plain(options.params), {
      tier: "image.standard",
      from: "2026-11-01",
      to: "2026-11-11",
      limit: 50
    });
}
let path;
const expected = [];
for (const line of (
  await read("docs/integrations/closet/management-api.yaml")
).split("\n")) {
  const p = line.match(/^  (\/[^:]+):/);
  if (p) path = p[1];
  const m = line.match(/^    (get|post|put|patch|delete):/);
  if (
    m &&
    path &&
    (path.includes("/billing") ||
      path.endsWith("/points") ||
      path.endsWith("/entitlements"))
  )
    expected.push(`${m[1]} ${path}`);
}
const normalize = p =>
  p
    .replace("image.standard", "{tier}")
    .replaceAll("id%2F1", "{id}")
    .replace("a%2Fb", "{username}");
assert.deepEqual(
  cases.map(([, , m, p]) => `${m} ${normalize(p)}`).sort(),
  expected.sort(),
  "every billing operation in source contract needs a typed client"
);
for (const [file, names] of [
  [
    "src/views/integrations/closet/billing/Settings.vue",
    ["getSettings", "putSettings"]
  ],
  [
    "src/views/integrations/closet/billing/Tiers.vue",
    ["getTiers", "putTier", "getCosts", "postCost"]
  ],
  [
    "src/views/integrations/closet/billing/Products.vue",
    ["getProducts", "postProduct", "putProduct", "getOrders", "disputeOrder"]
  ],
  [
    "src/views/integrations/closet/billing/Redemptions.vue",
    ["getBatches", "postBatch", "getCodes", "disableBatch"]
  ],
  [
    "src/views/integrations/closet/billing/Margin.vue",
    ["getMargin", "getAlerts", "getExplain"]
  ],
  [
    "src/views/integrations/closet/billing/UserBilling.vue",
    ["getUserBilling", "changePoints", "grantEntitlement", "revokeEntitlement"]
  ]
]) {
  const s = await read(file);
  for (const name of names)
    assert.ok(
      (s.match(new RegExp(`\\b${name}\\b`, "g")) || []).length >= 2,
      `${file} must use ${name}`
    );
}
console.log(
  `PASS: ${cases.length} billing API operations match source contract, payloads, headers and page usage`
);

const dashboard = await read(
  "src/views/integrations/closet/dashboard/index.vue"
);
for (const key of ["ordersToday", "revenueToday", "costToday"])
  assert.ok(dashboard.includes(key), key);
const exportsPage = await read(
  "src/views/integrations/closet/exports/index.vue"
);
for (const key of [
  "billing_order",
  "billing_ledger",
  "JSON.stringify(row.billing"
])
  assert.ok(exportsPage.includes(key), key);
