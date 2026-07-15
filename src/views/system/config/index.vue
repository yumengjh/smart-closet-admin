<script setup lang="ts">
import {
  listRuntimeSettings,
  settingGroups,
  updateRuntimeSetting,
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
const stringDrafts = ref<Record<string, string>>({});
const labels: Record<string, string> = {
  security: "安全审计",
  rateLimit: "全局限流",
  cors: "跨域策略",
  endpointPolicy: "端点策略",
  ipPolicy: "IP 策略",
  identity: "身份注册"
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
const load = async () => {
  loading.value = true;
  try {
    const data = (await listRuntimeSettings()).data;
    settings.value = data;
    stringDrafts.value = Object.fromEntries(
      data
        .filter(item => item.type === "STRING")
        .map(item => [item.key, item.value])
    );
  } finally {
    loading.value = false;
  }
};
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
    <el-card v-for="group in groups" :key="group.name" shadow="never"
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
