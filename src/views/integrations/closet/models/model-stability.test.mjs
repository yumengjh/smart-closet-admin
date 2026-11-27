import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "vue/compiler-sfc";

const source = await readFile(
  new URL("ModelStability.vue", import.meta.url),
  "utf8"
);
const script = parse(source).descriptor.scriptSetup.content;
const declarations = script.slice(
  script.indexOf("const kinds:"),
  script.indexOf("const dates =")
);
const context = {};
vm.runInNewContext(
  ts.transpileModule(
    `${declarations}\nglobalThis.labels = { kinds, scopes, outcomes };`,
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022 }
    }
  ).outputText,
  context
);

const apiSource = await readFile(
  new URL("../../../../api/closet/modelInsights.ts", import.meta.url),
  "utf8"
);
const api = {};
vm.runInNewContext(
  ts.transpileModule(apiSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText,
  { exports: api, require: () => ({ http: {} }) }
);

test("health event filter and display cover every server event", () => {
  const expected = {
    PAUSED: "暂停",
    RESUMED: "恢复",
    MANUAL_RESUME: "手动恢复",
    MANUAL_DRAIN: "手动摘除",
    MANUAL_UNDRAIN: "放回",
    REROUTED: "改道",
    RESENT: "重发",
    DEGRADED: "降级",
    UNREACHABLE: "连不上",
    REACHABLE: "恢复连通",
    LOW_BALANCE: "余额不足",
    BALANCE_OK: "余额恢复",
    CAP_REACHED: "达到上限",
    PROBE_OK: "探活成功",
    PROBE_FAILED: "探活失败",
    EDITS_UNSUPPORTED: "不支持改图"
  };
  assert.deepEqual(
    Object.entries(context.labels.kinds),
    Object.entries(expected)
  );
  for (const [kind, name] of Object.entries(expected)) {
    const events = [{ kind }, { kind: "OTHER" }];
    assert.equal(
      events
        .filter(event => event.kind === kind)
        .map(event => context.labels.kinds[event.kind] || event.kind)[0],
      name
    );
  }
});

test("scope and outcome labels preserve unknown values", () => {
  for (const [key, name] of Object.entries({
    ENTRY: "模型",
    PROVIDER: "服务商",
    POOL: "池",
    VENDOR: "实时试穿供应商"
  })) {
    assert.equal(context.labels.scopes[key], name);
  }
  for (const [key, name] of Object.entries({
    OK: "成功",
    FAILED: "失败",
    CANCELLED: "已取消"
  })) {
    assert.equal(context.labels.outcomes[key], name);
  }
  assert.equal(context.labels.outcomes.UNKNOWN || "UNKNOWN", "UNKNOWN");
});

test("every provider error has the required Chinese description", () => {
  const expected = {
    PROVIDER_CONNECT_TIMEOUT: "连接超时",
    PROVIDER_UNREACHABLE: "连不上",
    PROVIDER_CONNECTION_FAILED: "连接中断",
    PROVIDER_NO_CHANNEL: "中转没有可用渠道",
    PROVIDER_TIMEOUT: "等待超时",
    PROVIDER_HTTP_401: "密钥或权限被拒",
    PROVIDER_HTTP_403: "密钥或权限被拒",
    PROVIDER_HTTP_402: "余额不足",
    PROVIDER_HTTP_429: "限流",
    PROVIDER_HTTP_500: "上游错误 500",
    PROVIDER_HTTP_502: "上游错误 502",
    PROVIDER_HTTP_503: "上游错误 503",
    PROVIDER_HTTP_504: "上游错误 504",
    PROVIDER_HTTP_529: "上游错误 529",
    PROVIDER_HTTP_400: "请求被拒",
    PROVIDER_HTTP_404: "请求被拒",
    PROVIDER_HTTP_413: "请求被拒",
    PROVIDER_HTTP_422: "请求被拒",
    PROVIDER_CONTENT_FILTERED: "内容被拦截",
    PROVIDER_EDITS_UNSUPPORTED: "不支持改图",
    PROVIDER_NO_IMAGE: "没有返回图片",
    PROVIDER_INVALID_RESPONSE: "返回格式不对",
    PROVIDER_INVALID_IMAGE: "图片无效",
    PROVIDER_IMAGE_DOWNLOAD_FAILED: "图片下载失败",
    PROVIDER_IMAGE_HOST_NOT_ALLOWED: "图片域名不在可信列表",
    PROVIDER_UPSTREAM_ERROR: "上游报错",
    PROVIDER_ERROR: "上游报错",
    PROVIDER_UNAVAILABLE: "暂不可用",
    PROVIDER_INTERRUPTED: "被中断",
    PROVIDER_NOT_CONFIGURED: "未配置",
    PROVIDER_CONFIG_CHANGED: "配置已变化"
  };
  for (const [code, name] of Object.entries(expected)) {
    assert.equal(api.errorName(code), `${name}（${code}）`);
  }
  assert.equal(
    api.errorName("PROVIDER_UNKNOWN_TIMEOUT"),
    "PROVIDER_UNKNOWN_TIMEOUT"
  );
  assert.equal(api.errorName(null), "—");
});
