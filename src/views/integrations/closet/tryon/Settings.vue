<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  getTryOnSettings,
  updateTryOnSettings,
  resetTryOnSettings,
  type TryOnSettings,
  type TryOnSettingsValue
} from "@/api/closet/tryon";
import { useClosetRequest } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useTryOnAction } from "./useTryOnAction";
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const { can, saving, actionError, act } = useTryOnAction();
const snapshot = ref<TryOnSettings>();
const form = ref<TryOnSettingsValue>();
type NumericKey = Exclude<keyof TryOnSettingsValue, "mode" | "defaultEnabled">;
const groups: Array<{
  title: string;
  fields: Array<{ key: NumericKey; label: string; min: number; max: number }>;
}> = [
  {
    title: "授权与预算",
    fields: [
      {
        key: "dailySeconds",
        label: "每用户每日时长（秒）",
        min: 0,
        max: 86400
      },
      {
        key: "dailyPoints",
        label: "全站每日预算（积分）",
        min: 0,
        max: 1000000000
      },
      {
        key: "totalPoints",
        label: "全站累计预算（积分）",
        min: 0,
        max: 1000000000000
      },
      { key: "sessionSeconds", label: "单次最长时长（秒）", min: 1, max: 3600 }
    ]
  },
  {
    title: "启动与排队",
    fields: [
      { key: "startupSeconds", label: "启动总时限（秒）", min: 1, max: 120 },
      { key: "firstFrameSeconds", label: "首帧等待（秒）", min: 1, max: 120 },
      { key: "queueSeconds", label: "排队时限（秒）", min: 1, max: 600 },
      { key: "offerSeconds", label: "名额确认时限（秒）", min: 1, max: 60 }
    ]
  },
  {
    title: "录像、存储与账户",
    fields: [
      {
        key: "recordingSeconds",
        label: "单段录像时长（秒）",
        min: 1,
        max: 600
      },
      {
        key: "recordingBytes",
        label: "单段录像上限（字节）",
        min: 1024,
        max: 536870912
      },
      {
        key: "storageBytes",
        label: "每用户存储上限（字节）",
        min: 0,
        max: 1099511627776
      },
      { key: "accountConcurrency", label: "新账户默认并发", min: 1, max: 100 },
      {
        key: "accountGuardPoints",
        label: "账户保护余量（积分）",
        min: 0,
        max: 3600
      }
    ]
  }
];
const dirty = computed(
  () => JSON.stringify(form.value) !== JSON.stringify(snapshot.value?.value)
);
const valid = computed(
  () =>
    form.value &&
    groups.every(group =>
      group.fields.every(field => {
        const value = form.value![field.key];
        return (
          Number.isInteger(value) && value >= field.min && value <= field.max
        );
      })
    ) &&
    form.value.firstFrameSeconds <= form.value.startupSeconds
);
const apply = (data: TryOnSettings) => {
  snapshot.value = data;
  form.value = { ...data.value };
};
const load = () => run(getTryOnSettings, ({ data }) => apply(data));
const save = async () => {
  if (!snapshot.value || !form.value || !valid.value) return;
  const data = { revision: snapshot.value.revision, value: { ...form.value } };
  const result = await act(
    "write",
    "保存试穿设置",
    data.value.mode === "FORCE_OFF"
      ? "全站关闭会回收进行中的会话，确认保存？"
      : "新设置会改变后续授权与预算上限。确认保存？",
    () => updateTryOnSettings(data)
  );
  if (result) apply(result.data);
};
const reset = async () => {
  if (!snapshot.value) return;
  const revision = snapshot.value.revision;
  const result = await act(
    "write",
    "恢复初始设置",
    "恢复默认开关、额度与时限；累计历史支出保留。确认恢复？",
    () => resetTryOnSettings(revision)
  );
  if (result) apply(result.data);
};
onMounted(() => void load());
</script>
<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="font-semibold">试穿开通与限额</h3>
      <el-button :loading="loading" :disabled="saving" @click="load"
        >重新读取设置</el-button
      >
    </div>
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-alert
      v-if="actionError"
      :title="actionError"
      type="error"
      :closable="false"
    />
    <el-skeleton v-if="loading && !form" :rows="6" animated />
    <el-form
      v-if="form"
      label-position="top"
      :disabled="!can('closet:tryon:write') || saving || loading"
      @submit.prevent="save"
    >
      <div class="grid gap-x-6 md:grid-cols-2">
        <el-form-item label="全站模式"
          ><el-select v-model="form.mode" class="w-full"
            ><el-option label="遵循用户策略" value="FOLLOW_USER" /><el-option
              label="全站开启"
              value="FORCE_ON" /><el-option
              label="全站关闭并回收会话"
              value="FORCE_OFF" /></el-select
        ></el-form-item>
        <el-form-item label="遵循用户策略时，默认开通"
          ><el-switch
            v-model="form.defaultEnabled"
            active-text="默认开通"
            inactive-text="默认关闭"
        /></el-form-item>
      </div>
      <p class="mb-5 text-sm text-[var(--el-text-color-secondary)]">
        全站开启仍检查账号、额度、预算与资源。暂停某个账户接单可让已有会话自然结束。
      </p>
      <section v-for="group in groups" :key="group.title" class="mb-5">
        <h4 class="mb-3 font-medium">{{ group.title }}</h4>
        <div class="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
          <el-form-item
            v-for="field in group.fields"
            :key="field.key"
            :label="field.label"
            ><el-input-number
              v-model="form[field.key]"
              class="!w-full"
              :min="field.min"
              :max="field.max"
              :precision="0"
              controls-position="right"
          /></el-form-item>
        </div>
      </section>
      <el-alert
        v-if="!valid"
        title="请填写范围内的整数；首帧等待不能超过启动总时限。"
        type="warning"
        :closable="false"
        class="mb-4"
      />
      <div class="flex flex-wrap items-center gap-3">
        <el-button
          v-if="can('closet:tryon:write')"
          type="primary"
          :disabled="!valid || !dirty"
          :loading="saving"
          @click="save"
          >保存试穿设置</el-button
        ><el-button v-if="can('closet:tryon:write')" @click="reset"
          >恢复初始设置</el-button
        ><span class="text-sm text-[var(--el-text-color-secondary)]"
          >版本 {{ snapshot?.revision
          }}{{ dirty ? " · 有未保存的修改" : "" }}</span
        >
      </div>
    </el-form>
  </section>
</template>
