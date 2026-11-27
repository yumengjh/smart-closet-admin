import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "vue/compiler-sfc";

const source = await readFile(
  new URL("ModelProbeBalance.vue", import.meta.url),
  "utf8"
);
const script = parse(source).descriptor.scriptSetup.content;
const code = ts.transpileModule(
  `${script}\nglobalThis.component = { form, paidSpendCaps, rawOpen, rawSnapshot, setProbe, editBilling, saveSource, saveSettings };`,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText;

function setup() {
  const calls = [];
  const snapshot = {
    id: "snapshot",
    atMs: 1,
    source: "NEWAPI",
    raw: { unit: "QUOTA", json: { total: 500000 } },
    converted: { balanceMicro: 1000000, currency: "CNY" }
  };
  const row = {
    providerId: "provider",
    providerName: "服务商",
    reported: snapshot,
    billing: {
      source: "NEWAPI",
      unit: "QUOTA",
      quotaPerUnit: 500000,
      lowBalanceMicro: 2500000,
      currency: "CNY",
      autoRemove: false,
      revision: 3
    }
  };
  const settings = {
    freeEnabled: true,
    freeIntervalMinutes: 5,
    freeFailures: 3,
    paidEnabled: true,
    paidDailyCalls: 10,
    paidPerEntry: 2,
    paidSpendCapMicro: { VISION: 1250000, CHAT: 10000, IMAGE: 0 },
    usdToCny: 7
  };
  const probe = {
    settings,
    revision: 7,
    paidUsage: { calls: 0, spendMicro: {} },
    free: []
  };
  const api = {
    saveBilling: async (id, body) => {
      calls.push(["billing", id, body]);
      return { data: row };
    },
    saveProbe: async body => {
      calls.push(["probe", body]);
      return { data: { ...probe, settings: body } };
    },
    getBalances: async () => ({ data: { providers: [row] } })
  };
  const modules = {
    vue: {
      ref: value => ({ value }),
      computed: fn => ({
        get value() {
          return fn();
        }
      }),
      onMounted: () => {}
    },
    "@/composables/useCurrentPermissions": {
      useCurrentPermissions: () => ({ can: () => true })
    },
    "@/api/closet/modelInsights": api,
    "@/utils/message": { message: () => {} },
    "../useClosetRequest": {
      useClosetRequest: () => ({
        loading: { value: false },
        unavailable: { value: false },
        errorMessage: { value: "" },
        run: async (request, success) => success(await request())
      })
    },
    "../ClosetUnavailable.vue": { default: {} }
  };
  const context = { exports: {}, require: name => modules[name] };
  vm.runInNewContext(code, context);
  return { ...context.component, calls, row, probe, snapshot };
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

test("NewAPI 保存单位和额度，空令牌省略并打开余额对照", async () => {
  const c = setup();
  c.editBilling(c.row);
  c.saveSource();
  await flush();
  assert.deepEqual(plain(c.calls[0]), [
    "billing",
    "provider",
    {
      source: "NEWAPI",
      unit: "QUOTA",
      quotaPerUnit: 500000,
      lowBalanceMicro: 2500000,
      currency: "CNY",
      autoRemove: false,
      revision: 3
    }
  ]);
  assert.equal(c.rawOpen.value, true);
  assert.equal(c.rawSnapshot.value, c.snapshot);
});

test("NewAPI 非额度单位保留单位并清空额度比例", async () => {
  const c = setup();
  c.editBilling(c.row);
  c.form.value.unit = "USD";
  c.saveSource();
  await flush();
  assert.equal(c.calls[0][2].unit, "USD");
  assert.equal(c.calls[0][2].quotaPerUnit, null);
  assert.equal("token" in c.calls[0][2], false);
});

test("其他来源不发送 NewAPI 单位，填写的令牌正常发送", async () => {
  for (const source of ["OPENROUTER", "MANUAL", "NONE"]) {
    const c = setup();
    c.editBilling(c.row);
    c.form.value.source = source;
    c.form.value.token = "secret";
    c.saveSource();
    await flush();
    const body = c.calls[0][2];
    const empty = setup();
    empty.editBilling(empty.row);
    empty.form.value.source = source;
    empty.saveSource();
    await flush();
    assert.equal("token" in empty.calls[0][2], false);
    assert.equal(body.source, source);
    assert.equal(body.token, "secret");
    assert.equal("unit" in body, false);
    assert.equal("quotaPerUnit" in body, false);
    assert.equal("token" in body, true);
  }
});

test("付费探活上限以元显示并转换为微元保存", async () => {
  const c = setup();
  c.setProbe(c.probe);
  assert.deepEqual(plain(c.paidSpendCaps.value), {
    VISION: 1.25,
    CHAT: 0.01,
    IMAGE: 0
  });
  c.paidSpendCaps.value.VISION = 2.3456;
  c.paidSpendCaps.value.CHAT = 0.01;
  c.paidSpendCaps.value.IMAGE = 0.0001;
  c.saveSettings();
  await flush();
  assert.deepEqual(plain(c.calls[0][1].paidSpendCapMicro), {
    VISION: 2345600,
    CHAT: 10000,
    IMAGE: 100
  });
  assert.equal(c.calls[0][1].revision, 7);
});
