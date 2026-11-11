<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getSettings,
  putSettings,
  type Settings,
  type SettingsInput,
  type Switches
} from "@/api/closet/billing";
import BillingFrame from "./BillingFrame.vue";
import { useBilling } from "./useBilling";
defineOptions({ name: "ClosetBillingSettings" });
const { can, loading, saving, error, load, write } = useBilling();
const state = ref<Settings>();
const form = ref<SettingsInput>();
const fields: {
  key: keyof SettingsInput;
  source: keyof Switches;
  override: string;
  label: string;
}[] = [
  {
    key: "enabled",
    source: "enabled",
    override: "billing.enabled",
    label: "收费总开关"
  },
  {
    key: "tryonEnabled",
    source: "tryon",
    override: "billing.cap.tryon",
    label: "实时试穿收费"
  },
  {
    key: "imageEnabled",
    source: "image",
    override: "billing.cap.image",
    label: "图片生成收费"
  },
  {
    key: "agentEnabled",
    source: "agent",
    override: "billing.cap.agent",
    label: "助手收费"
  },
  {
    key: "showPrices",
    source: "showPrices",
    override: "billing.show-prices",
    label: "显示价格"
  }
];
function apply(data: Settings) {
  state.value = data;
  form.value = Object.fromEntries(
    fields.map(f => [
      f.key,
      data.state.overridden[f.override] ? data.state.effective[f.source] : null
    ])
  ) as SettingsInput;
}
const refresh = () => load(getSettings, r => apply(r.data));
const save = () => {
  if (!form.value) return;
  const data = { ...form.value };
  void write(
    "保存收费设置",
    () => putSettings(data),
    r => apply(r.data),
    "本次将完整替换全部开关覆盖，确认提交？"
  );
};
const reset = () =>
  write(
    "恢复全部默认",
    () =>
      putSettings({
        enabled: null,
        tryonEnabled: null,
        imageEnabled: null,
        agentEnabled: null,
        showPrices: null
      }),
    r => apply(r.data),
    "确认清除全部管理覆盖并恢复部署默认？多实例最多延迟 5 秒生效。"
  );
onMounted(() => {
  if (can("closet:billing:read")) void refresh();
});
</script>
<template>
  <BillingFrame
    title="总开关与能力开关"
    :error="error"
    :loading="loading"
    :saving="saving"
    @refresh="refresh"
  >
    <el-card v-if="form && state" shadow="never">
      <el-alert
        title="保存会完整替换全部覆盖。选择部署默认即提交 null，多实例最多延迟 5 秒生效。"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <el-form
        label-position="top"
        :disabled="saving || loading || !can('closet:billing:write')"
      >
        <div class="grid gap-4 md:grid-cols-2">
          <el-form-item
            v-for="field in fields"
            :key="field.key"
            :label="field.label"
          >
            <el-select
              :model-value="
                form[field.key] === null
                  ? 'default'
                  : form[field.key]
                    ? 'on'
                    : 'off'
              "
              class="w-full"
              @update:model-value="
                value => {
                  if (form)
                    form[field.key] =
                      value === 'default' ? null : value === 'on';
                }
              "
            >
              <el-option value="default" label="部署默认" /><el-option
                value="on"
                label="开启"
              /><el-option value="off" label="关闭" />
            </el-select>
            <span class="mt-2 text-sm text-[var(--el-text-color-secondary)]"
              >当前生效
              {{ state.state.effective[field.source] ? "开启" : "关闭" }} ·
              部署默认
              {{ state.state.defaults[field.source] ? "开启" : "关闭" }}</span
            >
          </el-form-item>
        </div>
        <el-button
          v-if="can('closet:billing:write')"
          type="primary"
          :loading="saving"
          @click="save"
          >保存设置</el-button
        >
        <el-button v-if="can('closet:billing:write')" @click="reset"
          >恢复全部默认</el-button
        >
      </el-form>
    </el-card>
  </BillingFrame>
</template>
