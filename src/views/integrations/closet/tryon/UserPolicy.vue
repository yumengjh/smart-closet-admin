<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import {
  getTryOnUserPolicy,
  getTryOnUserUsage,
  updateTryOnUserPolicy,
  resetTryOnStartupFailures,
  type TryOnPolicy,
  type TryOnUserUsage
} from "@/api/closet/tryon";
import { useClosetRequest, bytes } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useTryOnAction } from "./useTryOnAction";
const route = useRoute();
const username = ref(
  typeof route.query.username === "string" ? route.query.username : ""
);
const loadedUsername = ref("");
const usage = ref<TryOnUserUsage>();
const form = reactive<TryOnPolicy>({
  accessMode: "INHERIT",
  dailySeconds: null,
  startupFailureLimit: null
});
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const { can, saving, actionError, act } = useTryOnAction();
const dailyInput = computed({
  get: () => form.dailySeconds ?? undefined,
  set: (value: number | undefined) => {
    form.dailySeconds = value ?? null;
  }
});
const failureInput = computed({
  get: () => form.startupFailureLimit ?? undefined,
  set: (value: number | undefined) => {
    form.startupFailureLimit = value ?? null;
  }
});
const load = async () => {
  const target = username.value.trim();
  if (!target || saving.value) return;
  loadedUsername.value = "";
  await run(
    () => Promise.all([getTryOnUserPolicy(target), getTryOnUserUsage(target)]),
    ([p, u]) => {
      Object.assign(form, p.data);
      usage.value = u.data;
      loadedUsername.value = target;
    }
  );
};
const valid = computed(
  () =>
    (form.dailySeconds === null ||
      (Number.isInteger(form.dailySeconds) &&
        form.dailySeconds >= 0 &&
        form.dailySeconds <= 86400)) &&
    (form.startupFailureLimit === null ||
      (Number.isInteger(form.startupFailureLimit) &&
        form.startupFailureLimit >= 0 &&
        form.startupFailureLimit <= 999))
);
const save = async () => {
  if (!loadedUsername.value || !valid.value) return;
  const target = loadedUsername.value;
  const data = { ...form };
  const result = await act(
    "write",
    "保存用户策略",
    `为 ${target} 保存完整试穿策略。明确停用可能回收其当前会话。确认保存？`,
    () => updateTryOnUserPolicy(target, data)
  );
  if (result) {
    Object.assign(form, result.data);
    username.value = target;
    await load();
  }
};
const reset = async () => {
  if (!loadedUsername.value) return;
  const target = loadedUsername.value;
  const result = await act(
    "write",
    "解除重试保护",
    `允许 ${target} 重新尝试启动。此操作只重置当日失败计数基准，历史费用、时长、预算和会话均保留。确认解除？`,
    () => resetTryOnStartupFailures(target)
  );
  if (result) {
    username.value = target;
    await load();
  }
};
onMounted(() => {
  if (username.value) void load();
});
</script>
<template>
  <section class="space-y-5">
    <el-form inline @submit.prevent="load"
      ><el-form-item label="业务用户名"
        ><el-input
          v-model="username"
          placeholder="输入完整用户名"
          :disabled="saving"
          clearable
          maxlength="160" /></el-form-item
      ><el-form-item
        ><el-button
          type="primary"
          native-type="submit"
          :disabled="!username.trim() || saving"
          :loading="loading"
          >查询用户策略</el-button
        ></el-form-item
      ></el-form
    >
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
    <el-empty
      v-if="!loadedUsername && !loading && !errorMessage && !unavailable"
      description="输入业务用户名，查看开通策略与当日用量"
    />
    <template v-if="loadedUsername && usage">
      <h3 class="font-semibold">{{ loadedUsername }} 的试穿策略</h3>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="当日时长"
          >已用 {{ usage.quota.used }} 秒，预留
          {{ usage.quota.reserved }} 秒，剩余 {{ usage.quota.remaining }} /
          {{ usage.quota.limit }} 秒</el-descriptions-item
        >
        <el-descriptions-item label="已用存储">{{
          bytes(usage.storageBytes)
        }}</el-descriptions-item>
        <el-descriptions-item label="启动失败保护">{{
          usage.startup.enabled
            ? `已失败 ${usage.startup.failures} 次，剩余 ${usage.startup.remaining} / ${usage.startup.limit} 次`
            : `未启用次数限制，失败记录 ${usage.startup.failures} 次`
        }}</el-descriptions-item>
      </el-descriptions>
      <el-form
        label-position="top"
        :disabled="!can('closet:tryon:write') || saving"
        @submit.prevent="save"
      >
        <el-form-item label="开通策略"
          ><el-select v-model="form.accessMode" class="!w-full md:!w-80"
            ><el-option label="继承默认" value="INHERIT" /><el-option
              label="开通"
              value="ENABLED" /><el-option
              label="停用"
              value="DISABLED" /></el-select
        ></el-form-item>
        <el-form-item label="每日时长"
          ><div class="flex flex-wrap items-center gap-4">
            <el-switch
              :model-value="form.dailySeconds === null"
              active-text="继承全站时长"
              @change="
                value => (form.dailySeconds = value ? null : usage!.quota.limit)
              "
            /><el-input-number
              v-if="form.dailySeconds !== null"
              v-model="dailyInput"
              :min="0"
              :max="86400"
              :precision="0"
              aria-label="每日时长（秒）"
            /><span v-if="form.dailySeconds !== null"
              >秒，0 表示无可用时长</span
            >
          </div></el-form-item
        >
        <el-form-item label="每日启动失败上限"
          ><div class="flex flex-wrap items-center gap-4">
            <el-switch
              :model-value="form.startupFailureLimit === null"
              active-text="继承默认 3 次"
              @change="value => (form.startupFailureLimit = value ? null : 3)"
            /><el-input-number
              v-if="form.startupFailureLimit !== null"
              v-model="failureInput"
              :min="0"
              :max="999"
              :precision="0"
              aria-label="每日启动失败上限"
            /><span v-if="form.startupFailureLimit !== null"
              >0 关闭该用户的次数限制</span
            >
          </div></el-form-item
        >
        <div v-if="can('closet:tryon:write')" class="flex flex-wrap gap-3">
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!valid"
            @click="save"
            >保存用户策略</el-button
          ><el-button :disabled="saving" @click="reset">解除重试保护</el-button>
        </div>
      </el-form>
    </template>
  </section>
</template>
