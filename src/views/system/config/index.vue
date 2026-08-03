<script setup lang="ts">
import {
  listDependencies,
  listRuntimeCaches,
  listRuntimeSettings,
  refreshDependencies,
  refreshDependency,
  refreshRuntimeCache,
  refreshRuntimeCaches,
  settingGroups,
  updateRuntimeSetting,
  type RuntimeCache,
  type RuntimeComponent,
  type RuntimeSetting
} from "@/api/runtime-config";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { computed, onMounted, ref } from "vue";
import {
  runtimeSettingDescription,
  runtimeSettingLabel,
  runtimeSettingTooltip
} from "../runtime-setting-presentation.mjs";

defineOptions({ name: "RuntimeConfig" });
const { can } = useCurrentPermissions();
const loading = ref(false),
  settings = ref<RuntimeSetting[]>([]),
  saving = ref<string>();
const components = ref<RuntimeComponent[]>([]);
const caches = ref<RuntimeCache[]>([]);
const cachesRefreshing = ref(false);
const dependenciesRefreshing = ref(false);
const cacheRefreshing = ref<string>();
const componentRefreshing = ref<string>();
const stringDrafts = ref<Record<string, string>>({});
const labels: Record<string, string> = {
  security: "安全审计",
  rateLimit: "全局限流",
  cors: "跨域策略",
  endpointPolicy: "端点策略",
  ipPolicy: "IP 策略",
  identity: "身份注册",
  runtime: "运行时管理"
};
const byKey = computed(
  () => new Map(settings.value.map(item => [item.key, item]))
);
const groups = computed(() =>
  Object.entries(settingGroups).map(([name, keys]) => ({
    name,
    items: keys
      .map(key => byKey.value.get(key))
      .filter(Boolean) as RuntimeSetting[]
  }))
);
const runtimeGroup = computed(() =>
  groups.value.find(group => group.name === "runtime")
);
const otherGroups = computed(() =>
  groups.value.filter(group => group.name !== "runtime")
);
const load = async () => {
  loading.value = true;
  try {
    const [settingResponse, cacheResponse, dependencyResponse] = await Promise.all([
      listRuntimeSettings(),
      listRuntimeCaches(),
      listDependencies()
    ]);
    const data = settingResponse.data;
    settings.value = data;
    caches.value = cacheResponse.data;
    components.value = dependencyResponse.data;
    stringDrafts.value = Object.fromEntries(
      data
        .filter(item => item.type === "STRING")
        .map(item => [item.key, item.value])
    );
  } finally {
    loading.value = false;
  }
};
const refreshAllCaches = async () => {
  cachesRefreshing.value = true;
  try {
    const response = await refreshRuntimeCaches();
    caches.value = response.data;
    const settingResponse = await listRuntimeSettings();
    settings.value = settingResponse.data;
    message("配置缓存已从数据库重新加载", { type: "success" });
  } finally {
    cachesRefreshing.value = false;
  }
};
const refreshCache = async (code: string) => {
  cacheRefreshing.value = code;
  try {
    const response = await refreshRuntimeCache(code);
    const index = caches.value.findIndex(item => item.code === code);
    if (index >= 0) caches.value[index] = response.data;
    if (code === "RUNTIME_SETTINGS") {
      const settingResponse = await listRuntimeSettings();
      settings.value = settingResponse.data;
    }
    message("配置缓存已重新加载", { type: "success" });
  } finally {
    cacheRefreshing.value = undefined;
  }
};
const refreshAllDependencies = async () => {
  dependenciesRefreshing.value = true;
  try {
    const response = await refreshDependencies();
    components.value = response.data;
    message("服务依赖状态已刷新", { type: "success" });
  } finally {
    dependenciesRefreshing.value = false;
  }
};
const refreshComponent = async (code: string) => {
  componentRefreshing.value = code;
  try {
    const response = await refreshDependency(code);
    const index = components.value.findIndex(item => item.code === code);
    if (index >= 0) components.value[index] = response.data;
    message("服务依赖已重新探测", { type: "success" });
  } finally {
    componentRefreshing.value = undefined;
  }
};
const componentTagType = (status: RuntimeComponent["status"]) =>
  ({
    UP: "success",
    ERROR: "danger",
    DISABLED: "info",
    CHECKING: "warning",
    UNKNOWN: "info"
  })[status] as "success" | "danger" | "info" | "warning";
const formatTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("zh-CN", { hour12: false })
    : "尚无记录";
const displayValue = (item: RuntimeSetting) =>
  item.type === "BOOLEAN"
    ? item.value === "true"
    : item.type === "INTEGER"
      ? Number(item.value)
      : item.value;
const numberValue = (item: RuntimeSetting) => Number(item.value);
const stringDraft = (item: RuntimeSetting) =>
  stringDrafts.value[item.key] ?? item.value;
const updateStringDraft = (item: RuntimeSetting, value: string) => {
  stringDrafts.value[item.key] = value;
};
const save = async (item: RuntimeSetting, value: string | boolean | number) => {
  if (!can("system:config:write")) return;
  if (item.key.includes("cors.") || item.key.includes("ip."))
    await ElMessageBox.confirm(
      "此配置会立即影响请求访问策略，确认保存？",
      "高风险配置",
      { type: "warning" }
    );
  saving.value = item.key;
  try {
    const response = await updateRuntimeSetting(item.key, String(value));
    const index = settings.value.findIndex(current => current.key === item.key);
    settings.value[index] = response.data;
    if (item.type === "STRING")
      stringDrafts.value[item.key] = response.data.value;
    const cacheResponse = await listRuntimeCaches();
    caches.value = cacheResponse.data;
    message("配置已保存", { type: "success" });
  } finally {
    saving.value = undefined;
  }
};
const saveStringDraft = async (item: RuntimeSetting) => {
  const value = stringDraft(item);
  if (value !== item.value) await save(item, value);
};
onMounted(load);
</script>

<template>
  <div v-loading="loading" class="grid gap-4 lg:grid-cols-2">
    <el-card
      data-section="runtime-management"
      shadow="never"
      class="lg:col-span-2"
    >
      <template #header>
        <div>
          <b>{{ labels.runtime }}</b>
          <p class="mt-1 text-xs text-gray-400">
            管理配置缓存自动对账、服务依赖探测以及系统头像生成开关。
          </p>
        </div>
      </template>
      <el-empty
        v-if="!runtimeGroup?.items.length"
        description="暂无运行时管理配置"
      />
      <el-form v-else label-position="top" class="runtime-settings-grid">
        <el-form-item v-for="item in runtimeGroup.items" :key="item.key">
          <template #label>
            <el-tooltip
              :content="runtimeSettingTooltip(item)"
              placement="top-start"
            >
              <span class="runtime-setting-label">{{
                runtimeSettingLabel(item)
              }}</span>
            </el-tooltip>
          </template>
          <el-switch
            v-if="item.type === 'BOOLEAN'"
            :model-value="displayValue(item)"
            :disabled="!can('system:config:write') || saving === item.key"
            @update:model-value="value => save(item, value)"
          />
          <el-input-number
            v-else-if="item.type === 'INTEGER'"
            :model-value="numberValue(item)"
            :disabled="!can('system:config:write') || saving === item.key"
            @change="value => save(item, value ?? 0)"
          />
          <el-input
            v-else
            type="textarea"
            :rows="3"
            :model-value="stringDraft(item)"
            :disabled="!can('system:config:write') || saving === item.key"
            @update:model-value="value => updateStringDraft(item, value)"
            @change="() => saveStringDraft(item)"
          />
          <div class="runtime-setting-help">
            <span>{{ runtimeSettingDescription(item) }}</span>
            <code>{{ item.key }}</code>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card data-section="runtime-caches" shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <b>配置缓存</b>
            <p class="mt-1 text-xs text-gray-400">
              业务请求只读取内存快照；自动任务按 revision 检查数据库变化。
            </p>
          </div>
          <el-button
            type="primary"
            :disabled="!can('system:config:write')"
            :loading="cachesRefreshing"
            @click="refreshAllCaches"
            >从数据库刷新全部</el-button
          >
        </div>
      </template>
      <div class="component-grid">
        <article v-for="item in caches" :key="item.code">
          <div class="flex items-center justify-between gap-2">
            <b>{{ item.displayName }}</b>
            <el-tag :type="item.synchronizedState ? 'success' : 'danger'">
              {{ item.synchronizedState ? "已同步" : "待同步" }}
            </el-tag>
          </div>
          <p v-if="item.lastFailureMessage" class="cache-error">
            {{ item.lastFailureMessage }}
          </p>
          <small>
            内存 revision：{{ item.snapshotRevision }} · 数据库 revision：{{
              item.databaseRevision
            }} · 条目：{{ item.entryCount }}
          </small>
          <small>最近加载：{{ formatTime(item.lastReloadedAt) }}</small>
          <el-button
            link
            type="primary"
            :disabled="!can('system:config:write')"
            :loading="cacheRefreshing === item.code"
            @click="refreshCache(item.code)"
            >从数据库重新加载</el-button
          >
        </article>
      </div>
    </el-card>
    <el-card data-section="service-dependencies" shadow="never">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <b>服务依赖</b>
            <p class="mt-1 text-xs text-gray-400">
              独立探测 DiceBear 头像生成服务和本地存储，不触发配置缓存刷新。
            </p>
          </div>
          <el-button
            type="primary"
            :disabled="!can('system:config:write')"
            :loading="dependenciesRefreshing"
            @click="refreshAllDependencies"
            >探测全部</el-button
          >
        </div>
      </template>
      <div class="component-grid">
        <article v-for="item in components" :key="item.code">
          <div class="flex items-center justify-between gap-2">
            <b>{{ item.displayName }}</b>
            <el-tag :type="componentTagType(item.status)">{{
              item.status
            }}</el-tag>
          </div>
          <p>{{ item.message || "暂无探测详情" }}</p>
          <small>
            失败次数：{{ item.consecutiveFailures }} · 延迟：{{
              item.latencyMs ?? "—"
            }} ms · 最近探测：{{ formatTime(item.lastCheckedAt) }}
          </small>
          <el-button
            link
            type="primary"
            :disabled="!can('system:config:write')"
            :loading="componentRefreshing === item.code"
            @click="refreshComponent(item.code)"
            >重新探测</el-button
          >
        </article>
      </div>
    </el-card>
    <el-card v-for="group in otherGroups" :key="group.name" shadow="never"
      ><template #header>{{ labels[group.name] }}</template
      ><el-empty
        v-if="!group.items.length"
        description="暂无此组配置"
      /><el-form v-else label-position="top"
        ><el-form-item v-for="item in group.items" :key="item.key"
          ><template #label
            ><el-tooltip
              :content="runtimeSettingTooltip(item)"
              placement="top-start"
              ><span class="runtime-setting-label">{{
                runtimeSettingLabel(item)
              }}</span></el-tooltip
            ></template
          ><el-switch
            v-if="item.type === 'BOOLEAN'"
            :model-value="displayValue(item)"
            :disabled="!can('system:config:write') || saving === item.key"
            @update:model-value="value => save(item, value)"
          /><el-input-number
            v-else-if="item.type === 'INTEGER'"
            :model-value="numberValue(item)"
            :disabled="!can('system:config:write') || saving === item.key"
            @change="value => save(item, value ?? 0)"
          /><el-input
            v-else
            type="textarea"
            :rows="3"
            :model-value="stringDraft(item)"
            :disabled="!can('system:config:write') || saving === item.key"
            @update:model-value="value => updateStringDraft(item, value)"
            @change="() => saveStringDraft(item)"
          />
          <div class="runtime-setting-help">
            <span>{{ runtimeSettingDescription(item) }}</span>
            <code>{{ item.key }}</code>
          </div></el-form-item
        ></el-form
      ></el-card
    >
  </div>
</template>

<style scoped>
.component-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.runtime-settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 24px;
}
.component-grid article {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.component-grid p,
.component-grid small {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.component-grid .cache-error {
  color: var(--el-color-danger);
}
@media (max-width: 760px) {
  .component-grid {
    grid-template-columns: 1fr;
  }
  .runtime-settings-grid {
    grid-template-columns: 1fr;
  }
}
.runtime-setting-label {
  cursor: help;
}

.runtime-setting-help {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.runtime-setting-help code {
  font-family: var(--el-font-family);
  color: var(--el-text-color-placeholder);
}
</style>
