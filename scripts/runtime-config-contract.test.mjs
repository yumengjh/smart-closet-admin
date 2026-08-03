import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { toEpochOrNull } from "../src/views/system/runtime-contracts.mjs";
import {
  runtimeSettingDescription,
  runtimeSettingLabel,
  runtimeSettingTooltip
} from "../src/views/system/runtime-setting-presentation.mjs";

assert.equal(toEpochOrNull(undefined), null);
const date = new Date("2026-01-01T00:00:00Z");
assert.equal(toEpochOrNull(date), date.getTime());
const setting = {
  key: "identity.registration.enabled",
  displayName: "开放自助注册",
  description: "控制访客是否可以自行注册新账号。"
};
assert.equal(runtimeSettingLabel(setting), "开放自助注册");
assert.equal(
  runtimeSettingTooltip(setting),
  "控制访客是否可以自行注册新账号。（identity.registration.enabled）"
);
const legacySetting = { key: "security.rate-limit.capacity" };
assert.equal(runtimeSettingLabel(legacySetting), "全局请求上限");
assert.equal(
  runtimeSettingDescription(legacySetting),
  "每个客户端在全局限流窗口内最多可发起的请求次数。"
);
assert.equal(
  runtimeSettingTooltip(legacySetting),
  "每个客户端在全局限流窗口内最多可发起的请求次数。（security.rate-limit.capacity）"
);

const configPage = await readFile(
  new URL("../src/views/system/config/index.vue", import.meta.url),
  "utf8"
);
assert.match(configPage, /const stringDrafts = ref<Record<string, string>>\(\{\}\)/);
assert.match(configPage, /@update:model-value="value => updateStringDraft\(item, value\)"/);
assert.match(configPage, /@change="\(\) => saveStringDraft\(item\)"/);
assert.match(configPage, />配置缓存</);
assert.match(configPage, />服务依赖</);
assert.doesNotMatch(configPage, />运行组件</);
assert.ok(
  configPage.indexOf('data-section="runtime-management"') <
    configPage.indexOf('data-section="runtime-caches"'),
  "运行时管理配置卡应位于配置缓存之前"
);

const runtimeApi = await readFile(
  new URL("../src/api/runtime-config.ts", import.meta.url),
  "utf8"
);
assert.match(runtimeApi, /\/system\/runtime-caches/);
assert.match(runtimeApi, /\/system\/dependencies/);
assert.doesNotMatch(runtimeApi, /\/system\/runtime\/components/);

console.log("runtime config contracts passed");
