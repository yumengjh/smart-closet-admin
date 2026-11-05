<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useWindowSize } from "@vueuse/core";
import {
  listTryOnSessions,
  getTryOnSession,
  stopTryOnSession,
  type TryOnSession
} from "@/api/closet/tryon";
import { useClosetRequest, formatTime } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useTryOnAction } from "./useTryOnAction";
const { width } = useWindowSize();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const detailRequest = useClosetRequest();
const { can, saving, actionError, act } = useTryOnAction();
const sessions = ref<TryOnSession[]>([]);
const selected = ref<TryOnSession>();
const drawer = ref(false);
const query = ref("");
const state = ref("");
const stateNames: Record<string, string> = {
  QUEUED: "排队中",
  OFFERED: "等待确认",
  RESERVED: "已预留",
  SIGNING: "准备授权",
  CONNECTING: "连接中",
  WAITING_FRAME: "等待首帧",
  GENERATING: "生成中",
  STOPPING: "停止中",
  SETTLING: "结算中",
  UNKNOWN: "费用待核对",
  CLOSED: "已结束",
  FAILED: "已失败",
  CANCELLED: "已取消"
};
const stageNames: Record<string, string> = {
  CREATING_SESSION: "创建供应商会话",
  JOINING_RTC: "加入 RTC",
  PUBLISHING: "发布视频",
  WAITING_FRAME: "等待生成画面",
  GENERATING: "已收到画面",
  STOPPING: "停止中",
  FAILED: "已失败"
};
const timingNames: Record<string, string> = {
  sessionMs: "创建凭证",
  rtcJoinMs: "RTC 入房",
  publishMs: "发布视频",
  firstFrameMs: "首帧"
};
const videoNames: Record<string, string> = {
  sendFps: "发送帧率（fps）",
  decodeFps: "解码帧率（fps）",
  uplinkKbps: "上行码率（Kbps）",
  downlinkKbps: "下行码率（Kbps）",
  uplinkLoss: "上行丢包",
  downlinkLoss: "下行丢包",
  mediaDelayMs: "媒体延迟（ms）"
};
const qualityNames: Record<string, string> = {
  Unknown: "未知",
  Excellent: "极佳",
  Good: "良好",
  Poor: "较差",
  Bad: "差",
  VeryBad: "很差",
  Down: "断开"
};
const rows = computed(() =>
  sessions.value.filter(
    row =>
      (!state.value || row.state === state.value) &&
      (!query.value || row.id.toLowerCase().includes(query.value.toLowerCase()))
  )
);
const live = (row: TryOnSession) =>
  !["CLOSED", "FAILED", "CANCELLED"].includes(row.state);
const load = () =>
  run(listTryOnSessions, ({ data }) => {
    sessions.value = data;
  });
const detail = async (id: string) => {
  drawer.value = true;
  selected.value = undefined;
  await detailRequest.run(
    () => getTryOnSession(id),
    ({ data }) => {
      selected.value = data;
    }
  );
};
const stop = async (row: TryOnSession) => {
  if (!live(row)) return;
  const result = await act(
    "stop",
    "停止试穿会话",
    `停止会话 ${row.id}。未确认的费用仍保留预算并继续核对，不代表立即结清。确认停止？`,
    () => stopTryOnSession(row.id)
  );
  if (result) {
    if (selected.value?.id === row.id) selected.value = result.data;
    await load();
  }
};
onMounted(() => void load());
</script>
<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <el-input
        v-model="query"
        class="!w-64"
        placeholder="筛选会话 ID"
        clearable
      /><el-select
        v-model="state"
        class="!w-44"
        placeholder="全部状态"
        clearable
        ><el-option
          v-for="(label, value) in stateNames"
          :key="value"
          :label="label"
          :value="value" /></el-select
      ><el-button :loading="loading" :disabled="saving" @click="load"
        >刷新会话</el-button
      >
    </div>
    <p class="text-sm text-[var(--el-text-color-secondary)]">
      展示最近 200 条记录。创建凭证、RTC
      连接和收到首帧分别显示；客户端诊断不作为计费证据。
    </p>
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
    <el-table
      v-loading="loading"
      :data="rows"
      row-key="id"
      empty-text="暂无符合条件的试穿会话"
    >
      <el-table-column
        prop="id"
        label="会话 ID"
        min-width="230"
        show-overflow-tooltip
      />
      <el-table-column label="状态" min-width="120"
        ><template #default="{ row }"
          ><el-tag :type="row.state === 'UNKNOWN' ? 'warning' : 'info'">{{
            stateNames[row.state] ?? row.state
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column label="最近阶段" min-width="140"
        ><template #default="{ row }">{{
          stageNames[row.diagnostic?.stage] ?? row.diagnostic?.stage ?? "未上报"
        }}</template></el-table-column
      >
      <el-table-column label="首帧" min-width="80"
        ><template #default="{ row }">{{
          row.firstFrame ? "已收到" : "未收到"
        }}</template></el-table-column
      >
      <el-table-column
        prop="reservedPoints"
        label="预留积分"
        min-width="100"
      /><el-table-column
        prop="consumedPoints"
        label="实际积分"
        min-width="100"
      />
      <el-table-column label="创建时间" min-width="165"
        ><template #default="{ row }">{{
          formatTime(row.createdAtMs)
        }}</template></el-table-column
      >
      <el-table-column label="操作" fixed="right" min-width="125"
        ><template #default="{ row }"
          ><el-button
            link
            type="primary"
            :disabled="saving"
            @click="detail(row.id)"
            >诊断</el-button
          ><el-button
            v-if="live(row) && can('closet:tryon:stop')"
            link
            type="danger"
            :disabled="saving"
            @click="stop(row)"
            >停止</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-drawer
      v-model="drawer"
      title="会话诊断与结算"
      :size="width < 768 ? '100%' : '640px'"
      :show-close="!saving"
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
    >
      <el-skeleton v-if="detailRequest.loading.value" :rows="6" animated />
      <el-alert
        v-if="
          detailRequest.errorMessage.value || detailRequest.unavailable.value
        "
        title="会话详情读取失败，请关闭后重新打开。"
        type="error"
        :closable="false"
      />
      <el-alert
        v-if="actionError"
        :title="actionError"
        type="error"
        :closable="false"
        class="mb-4"
      />
      <template v-if="selected">
        <el-descriptions :column="1" border
          ><el-descriptions-item label="会话 ID">{{
            selected.id
          }}</el-descriptions-item
          ><el-descriptions-item label="状态">{{
            stateNames[selected.state] ?? selected.state
          }}</el-descriptions-item
          ><el-descriptions-item label="结束原因">{{
            selected.reason ?? "—"
          }}</el-descriptions-item
          ><el-descriptions-item label="供应商环境">{{
            selected.environment === "china" ? "国内" : "海外"
          }}</el-descriptions-item
          ><el-descriptions-item label="HTTP 会话创建">{{
            formatTime(selected.connectedAtMs)
          }}</el-descriptions-item
          ><el-descriptions-item label="RTC 入房与发布完成">{{
            formatTime(selected.rtcConnectedAtMs)
          }}</el-descriptions-item
          ><el-descriptions-item label="首帧">{{
            selected.firstFrame ? "已收到" : "未收到"
          }}</el-descriptions-item
          ><el-descriptions-item label="最后上报阶段">{{
            stageNames[selected.diagnostic?.stage ?? ""] ??
            selected.diagnostic?.stage ??
            "未上报"
          }}</el-descriptions-item
          ><el-descriptions-item label="费用"
            >预留 {{ selected.reservedPoints }} / 实际
            {{ selected.consumedPoints }} 积分</el-descriptions-item
          ><el-descriptions-item label="用户时长"
            >{{ selected.userSeconds }} 秒</el-descriptions-item
          ></el-descriptions
        >
        <h3 class="mb-3 mt-5 font-semibold">客户端阶段耗时</h3>
        <el-descriptions :column="1" border
          ><el-descriptions-item
            v-for="(label, key) in timingNames"
            :key="key"
            :label="label"
            >{{
              selected.diagnostic?.timings?.[key] == null
                ? "未完成或未上报"
                : `${selected.diagnostic.timings[key]} ms`
            }}</el-descriptions-item
          ></el-descriptions
        >
        <h3 class="mb-3 mt-5 font-semibold">网络与视频观测</h3>
        <el-descriptions :column="1" border
          ><el-descriptions-item label="上行质量">{{
            qualityNames[selected.diagnostic?.uplink ?? ""] ?? "未上报"
          }}</el-descriptions-item
          ><el-descriptions-item label="下行质量">{{
            qualityNames[selected.diagnostic?.downlink ?? ""] ?? "未上报"
          }}</el-descriptions-item
          ><el-descriptions-item
            v-for="(label, key) in videoNames"
            :key="key"
            :label="label"
            >{{
              selected.diagnostic?.video?.[key] ?? "未上报"
            }}</el-descriptions-item
          ></el-descriptions
        >
        <div class="mt-5 flex flex-wrap gap-3">
          <el-button :disabled="saving" @click="detail(selected.id)"
            >刷新诊断</el-button
          ><el-button
            v-if="live(selected) && can('closet:tryon:stop')"
            type="danger"
            :loading="saving"
            @click="stop(selected)"
            >停止试穿会话</el-button
          >
        </div>
      </template>
    </el-drawer>
  </section>
</template>
