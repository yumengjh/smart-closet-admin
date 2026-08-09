<script setup lang="ts">
import {
  listRuntimeCaches,
  listRuntimeSettings,
  refreshRuntimeCache,
  refreshRuntimeCaches,
  updateRuntimeSetting,
  type RuntimeCache,
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
const loading = ref(false);
const settings = ref<RuntimeSetting[]>([]);
const caches = ref<RuntimeCache[]>([]);
const saving = ref<string>();
const cachesRefreshing = ref(false);
const cacheRefreshing = ref<string>();
const stringDrafts = ref<Record<string, string>>({});

const labels: Record<string, string> = {
  security: "安全审计",
  rateLimit: "全局限流",
  ipProtection: "自动 IP 防护",
  controlPlane: "管理控制面",
  cors: "跨域策略",
  endpointPolicy: "端点策略",
  identity: "身份注册",
  maintenance: "数据清理",
  runtime: "运行时管理"
};

const preferredGroupOrder = [
  "runtime",
  "security",
  "rateLimit",
  "ipProtection",
  "controlPlane",
  "endpointPolicy",
  "cors",
  "identity",
  "maintenance"
];
const groupRank = (name: string) => {
  const rank = preferredGroupOrder.indexOf(name);
  return rank < 0 ? preferredGroupOrder.length : rank;
};
const groups = computed(() => {
  const grouped = new Map<string, RuntimeSetting[]>();
  settings.value.forEach(item => {
    const items = grouped.get(item.group) || [];
    items.push(item);
    grouped.set(item.group, items);
  });
  return [...grouped.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort(
      (left, right) =>
        groupRank(left.name) - groupRank(right.name) ||
        left.name.localeCompare(right.name)
    );
});
const runtimeGroup = computed(() =>
  groups.value.find(group => group.name === "runtime")
);
const otherGroups = computed(() =>
  groups.value.filter(group => group.name !== "runtime")
);

const load = async () => {
  loading.value = true;
  try {
    const [settingResponse, cacheResponse] = await Promise.all([
      listRuntimeSettings(),
      listRuntimeCaches()
    ]);
    settings.value = settingResponse.data;
    caches.value = cacheResponse.data;
    stringDrafts.value = Object.fromEntries(
      settingResponse.data
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
  if (item.dangerous)
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
    caches.value = (await listRuntimeCaches()).data;
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
  <div v-loading="loading" class="page-root config-page">
    <el-card data-section="runtime-management" shadow="never">
      <template #header>
        <div class="section-heading">
          <div>
            <b>{{ labels.runtime }}</b>
            <p>管理配置缓存自动对账、运行状态检查周期和头像生成开关。</p>
          </div>
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
            :min="item.minValue"
            :max="item.maxValue"
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
        <div class="section-heading">
          <div>
            <b>配置缓存</b>
            <p>查看最近一次检查时的 revision 结果，并按需重新加载。</p>
          </div>
          <el-button
            :disabled="!can('system:config:write')"
            :loading="cachesRefreshing"
            @click="refreshAllCaches"
          >
            刷新全部
          </el-button>
        </div>
      </template>
      <el-table :data="caches" row-key="code" empty-text="暂无配置缓存">
        <el-table-column label="缓存" min-width="190">
          <template #default="{ row }">
            <div class="cache-name">
              <b>{{ row.displayName }}</b>
              <code>{{ row.code }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.synchronizedState ? 'success' : 'danger'"
              effect="plain"
            >
              {{ row.synchronizedState ? "一致" : "待同步" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="snapshotRevision"
          label="内存 revision"
          width="125"
        />
        <el-table-column
          prop="databaseRevision"
          label="数据库 revision"
          width="135"
        />
        <el-table-column prop="entryCount" label="条目数" width="90" />
        <el-table-column label="最近加载" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.lastReloadedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="异常" min-width="180">
          <template #default="{ row }">
            <span :class="{ 'cache-error': row.lastFailureMessage }">
              {{ row.lastFailureMessage || "—" }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="!can('system:config:write')"
              :loading="cacheRefreshing === row.code"
              @click="refreshCache(row.code)"
            >
              重新加载
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card data-section="configuration-groups" shadow="never">
      <template #header>
        <div class="section-heading">
          <div>
            <b>服务配置</b>
            <p>按功能分类管理安全、访问控制和身份策略。</p>
          </div>
        </div>
      </template>
      <el-tabs class="configuration-tabs">
        <el-tab-pane
          v-for="group in otherGroups"
          :key="group.name"
          :label="labels[group.name]"
        >
          <el-empty v-if="!group.items.length" description="暂无此组配置" />
          <el-form v-else label-position="top" class="setting-grid">
            <el-form-item v-for="item in group.items" :key="item.key">
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
                :min="item.minValue"
                :max="item.maxValue"
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
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.config-page {
  display: grid;
  gap: 16px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-heading p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.runtime-settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 24px;
}

.setting-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 24px;
  padding-top: 8px;
}

.cache-name {
  display: grid;
  gap: 2px;
}

.cache-name code,
.runtime-setting-help code {
  font-family: var(--el-font-family);
  color: var(--el-text-color-placeholder);
}

.cache-error {
  color: var(--el-color-danger);
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

@media (max-width: 760px) {
  .runtime-settings-grid,
  .setting-grid {
    grid-template-columns: 1fr;
  }

  .section-heading {
    align-items: flex-start;
  }
}
</style>
