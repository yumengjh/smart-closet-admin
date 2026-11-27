import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "vue/compiler-sfc";

// The shared request helper keeps only its latest request's result. Sections of one page that load at the same time
// must therefore each use their own helper; this runs the real helper with out-of-order responses.
const transpile = source =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
const vue = {
  ref: value => ({ value }),
  computed: fn => ({
    get value() {
      return fn();
    }
  }),
  onMounted: () => {},
  onBeforeUnmount: () => {}
};
const helperCode = transpile(
  await readFile(new URL("../useClosetRequest.ts", import.meta.url), "utf8")
);
function realHelper() {
  const context = {
    exports: {},
    require: name =>
      name === "vue"
        ? vue
        : name === "@/api/closet/errors"
          ? { isClosetServiceUnavailable: () => false }
          : { message: () => {} }
  };
  vm.runInNewContext(helperCode, context);
  return context.exports;
}
const deferred = () => {
  let resolve;
  const promise = new Promise(r => (resolve = r));
  return { promise, resolve };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

async function mount(file, expose, api) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const code = transpile(
    `${parse(source).descriptor.scriptSetup.content}\nglobalThis.component = { ${expose} };`
  );
  const modules = {
    vue,
    "@/composables/useCurrentPermissions": {
      useCurrentPermissions: () => ({ can: () => true })
    },
    "@/api/closet/modelInsights": api,
    "@/api/closet/models": api,
    "@/utils/message": { message: () => {} },
    "../useClosetRequest": realHelper(),
    "../ClosetUnavailable.vue": { default: {} },
    "../insights/ChartView.vue": { default: {} },
    "./TraceDrawer.vue": { default: {} }
  };
  const context = { exports: {}, require: name => modules[name] ?? {} };
  vm.runInNewContext(code, context);
  return context.component;
}

test("告警页同时读列表和设置，先发后到的列表不会被丢掉", async () => {
  const rows = deferred();
  const c = await mount("ModelAlerts.vue", "load, rows, settings", {
    getAlerts: () => rows.promise,
    getAlertSettings: async () => ({ data: { rules: [], revision: 1 } }),
    time: () => ""
  });
  c.load();
  await flush();
  rows.resolve({ data: { firingCount: 1, items: [{ id: "a1" }] } });
  await flush();
  assert.equal(c.settings.value.revision, 1);
  assert.deepEqual(
    c.rows.value.map(r => r.id),
    ["a1"]
  );
});

test("探活与余额页同时读探活和余额，两块都显示", async () => {
  const probe = deferred();
  const c = await mount("ModelProbeBalance.vue", "load, probe, balances", {
    getProbe: () => probe.promise,
    getBalances: async () => ({ data: { providers: [{ providerId: "p" }] } }),
    money: () => "",
    time: () => ""
  });
  c.load();
  await flush();
  probe.resolve({
    data: {
      settings: { paidSpendCapMicro: {} },
      revision: 3,
      paidUsage: { calls: 0, spendMicro: {} },
      free: [],
      paid: []
    }
  });
  await flush();
  assert.equal(c.balances.value.length, 1);
  assert.equal(c.probe.value.revision, 3);
});

test("告警邮件开关一拨就保存，请求里带 sendMail 和原有设置", async () => {
  const saved = [];
  const c = await mount("ModelAlerts.vue", "load, settings, toggleMail", {
    getAlerts: async () => ({ data: { firingCount: 0, items: [] } }),
    getAlertSettings: async () => ({
      data: {
        rules: [{ rule: "pool-exhausted", enabled: true }],
        repeatMinutes: 60,
        sendMail: true,
        revision: 4
      }
    }),
    saveAlertSettings: async body => {
      saved.push(body);
      return { data: { ...body, rules: [], revision: 5 } };
    },
    time: () => ""
  });
  c.load();
  await flush();
  c.settings.value.sendMail = false;
  c.toggleMail();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), [
    {
      rules: { "pool-exhausted": true },
      repeatMinutes: 60,
      sendMail: false,
      revision: 4
    }
  ]);
  assert.equal(c.settings.value.revision, 5);
});
