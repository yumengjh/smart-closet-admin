import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "vue/compiler-sfc";

const source = await readFile(
  new URL("ModelPoolConfig.vue", import.meta.url),
  "utf8"
);
const script = parse(source).descriptor.scriptSetup.content;
const code = ts.transpileModule(
  `${script}\nglobalThis.subject = { edit, savePool, status, memberAction, members, open };`,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText;

function setup() {
  const requests = [];
  const messages = [];
  const confirms = [];
  const events = [];
  let rejectRequest = false;
  let cancelConfirm = false;
  const overview = {
    providers: [],
    entries: [],
    pools: [],
    tiers: { units: {} },
    resend: { notExecutedMarkers: [], builtInMarkers: [] }
  };
  const context = {
    exports: {},
    defineProps: () => ({ overview, writable: true }),
    defineEmits:
      () =>
      (...args) =>
        events.push(args),
    require(id) {
      if (id === "vue")
        return {
          ref: value => ({ value }),
          watch: (getter, callback) => callback(getter())
        };
      if (id === "element-plus")
        return {
          ElMessageBox: {
            confirm: async (...args) => {
              confirms.push(args);
              if (cancelConfirm) throw new Error("cancel");
            },
            alert: async () => {}
          }
        };
      if (id === "@/utils/http")
        return {
          http: {
            request: async (...args) => {
              requests.push(args);
              if (rejectRequest) throw { response: { status: 409 } };
              return { data: { sent: true, ok: true } };
            }
          }
        };
      if (id === "@/utils/message")
        return { message: (...args) => messages.push(args) };
      throw new Error(`Unexpected import: ${id}`);
    }
  };
  vm.runInNewContext(code, context);
  return {
    ...context.subject,
    overview,
    requests,
    messages,
    confirms,
    events,
    conflict: () => {
      rejectRequest = true;
    },
    cancel: () => {
      cancelConfirm = true;
    }
  };
}

const member = {
  entryId: "model/one",
  label: null,
  providerId: null,
  model: null,
  priority: 2,
  weight: 75,
  enabled: true,
  drain: false,
  maxConcurrency: 4,
  dailyCallCap: 20,
  dailySpendCapMicro: 1234500,
  spendCurrency: "USD",
  paidProbeIntervalMinutes: 30,
  inFlight: 0,
  today: { calls: 0, spend: [] },
  unavailable: null
};
const pool = (name, configured = true) => ({
  pool: name,
  configured,
  revision: 7,
  members: [member]
});
const plain = value => JSON.parse(JSON.stringify(value));

test("pool save sends contract fields, converts money and forces CHAT concurrency to zero", async () => {
  const vm = setup();
  vm.edit(pool("CHAT"));
  assert.equal(vm.members.value[0].dailySpendCap, 1.2345);
  await vm.savePool();
  assert.deepEqual(plain(vm.requests[0]), [
    "put",
    "/closet/models/pools/CHAT",
    {
      data: {
        revision: 7,
        members: [
          {
            entryId: "model/one",
            priority: 2,
            weight: 75,
            enabled: true,
            drain: false,
            maxConcurrency: 0,
            dailyCallCap: 20,
            dailySpendCapMicro: 1234500,
            spendCurrency: "USD",
            paidProbeIntervalMinutes: 30
          }
        ]
      }
    }
  ]);
  assert.equal(vm.open.value, false);
  assert.deepEqual(plain(vm.events[0]), ["refresh"]);
});

test("unconfigured pool omits revision and absent caps and probe interval become null", async () => {
  const vm = setup();
  vm.edit(pool("VISION", false));
  vm.members.value.push({
    entryId: "model",
    priority: 1,
    weight: 100,
    enabled: true,
    drain: false,
    maxConcurrency: 3,
    dailyCallCap: 0,
    dailySpendCap: undefined,
    spendCurrency: "CNY",
    paidProbeIntervalMinutes: undefined
  });
  await vm.savePool();
  assert.deepEqual(plain(vm.requests[0]), [
    "put",
    "/closet/models/pools/VISION",
    {
      data: {
        members: [
          {
            entryId: "model",
            priority: 1,
            weight: 100,
            enabled: true,
            drain: false,
            maxConcurrency: 3,
            dailyCallCap: 0,
            dailySpendCapMicro: null,
            spendCurrency: null,
            paidProbeIntervalMinutes: null
          }
        ]
      }
    }
  ]);
});

test("invalid or duplicate members and invalid currencies are not saved", async () => {
  const vm = setup();
  vm.edit(pool("VISION", false));
  await vm.savePool();
  vm.edit(pool("VISION"));
  vm.members.value[0].entryId = "";
  await vm.savePool();
  vm.members.value[0].entryId = "model";
  vm.members.value[0].spendCurrency = "cny";
  await vm.savePool();
  vm.members.value[0].spendCurrency = "CNY";
  vm.members.value.push({ ...vm.members.value[0] });
  await vm.savePool();
  assert.equal(vm.requests.length, 0);
  assert.equal(vm.messages.length, 4);
});

test("pool conflict reports the specific message and leaves the editor open", async () => {
  const vm = setup();
  vm.edit(pool("VISION"));
  vm.conflict();
  await vm.savePool();
  assert.equal(vm.messages.at(-1)[0], "这个池刚被改过，请刷新后再改");
  assert.equal(vm.open.value, true);
  assert.equal(vm.events.length, 0);
});

test("member status describes each unavailable reason and pause time", () => {
  const vm = setup();
  const reasons = {
    DISABLED: "不可用：已关闭",
    DRAINED: "已摘除",
    MISSING: "不可用：模型已删除",
    UNUSABLE: "不可用：服务商密钥不可用",
    UNREACHABLE: "不可用：探活连不上",
    LOW_BALANCE: "不可用：余额不足已移出",
    PAUSED: "不可用：连续失败暂停中",
    CONCURRENCY: "不可用：并发已满",
    CALL_CAP: "不可用：今日调用已达上限",
    SPEND_CAP: "不可用：今日花费已达上限"
  };
  for (const [reason, expected] of Object.entries(reasons))
    assert.equal(vm.status({ ...member, unavailable: reason }), expected);
  assert.equal(vm.status(member), "正常");
  const until = new Date(2026, 0, 1, 14, 5).getTime();
  vm.overview.entries.push({
    id: member.entryId,
    health: { pausedUntilMs: until }
  });
  assert.equal(
    vm.status({ ...member, unavailable: "PAUSED" }),
    `暂停到 ${new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  );
});

test("cancelling paid probe confirmation sends no request", async () => {
  const vm = setup();
  vm.cancel();
  await vm.memberAction(member, "probe-paid");
  assert.equal(vm.confirms.length, 1);
  assert.equal(vm.requests.length, 0);
  assert.equal(vm.events.length, 0);
});
