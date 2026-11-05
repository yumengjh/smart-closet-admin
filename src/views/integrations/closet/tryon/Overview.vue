<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getTryOnPool,
  getTryOnUsage,
  getTryOnReferenceSource,
  type TryOnPool,
  type TryOnDailyUsage,
  type TryOnReferenceSource
} from "@/api/closet/tryon";
import { useClosetRequest } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const pool = ref<TryOnPool>();
const source = ref<TryOnReferenceSource>();
const usage = ref<TryOnDailyUsage[]>([]);
const sourceNames = {
  NONE: "未配置",
  BUCKET: "试穿专用存储桶",
  PUBLIC_SITE: "本站公网站点",
  XMAX_STORAGE: "XMax 存储（仅本地开发）"
};
const referenceNames: Record<string, string> = {
  PENDING: "待生成",
  ACTIVE: "使用中",
  DELETING: "清理中",
  DELETED: "已清理"
};
const load = () =>
  run(
    () =>
      Promise.all([getTryOnPool(), getTryOnReferenceSource(), getTryOnUsage()]),
    ([p, s, u]) => {
      pool.value = p.data;
      source.value = s.data;
      usage.value = u.data;
    }
  );
onMounted(() => void load());
</script>
<template>
  <section class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="font-semibold">资源池</h3>
      <el-button :loading="loading" @click="load">刷新资源</el-button>
    </div>
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-skeleton v-else-if="loading && !pool" :rows="5" animated />
    <template v-else-if="pool && source">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="账户余额合计"
          >{{ pool.totalPoints }} 积分</el-descriptions-item
        >
        <el-descriptions-item label="当前可用预算"
          >{{ pool.availablePoints }} 积分</el-descriptions-item
        >
        <el-descriptions-item label="全站剩余授权"
          >{{ pool.globalRemainingPoints }} 积分</el-descriptions-item
        >
        <el-descriptions-item label="可用并发名额">{{
          pool.availableSlots
        }}</el-descriptions-item>
        <el-descriptions-item label="已登记运营账户">{{
          pool.accounts.length
        }}</el-descriptions-item>
        <el-descriptions-item label="参考图来源">{{
          sourceNames[source.source] ?? source.source
        }}</el-descriptions-item>
        <el-descriptions-item v-if="source.bucket" label="存储桶"
          >{{ source.bucket.endpointHost }} / {{ source.bucket.bucket }} /
          {{ source.bucket.prefix }}</el-descriptions-item
        >
        <el-descriptions-item v-if="source.publicOrigin" label="公网站点">{{
          source.publicOrigin
        }}</el-descriptions-item>
        <el-descriptions-item v-if="source.linkTtlSeconds" label="地址有效期"
          >{{ source.linkTtlSeconds }} 秒</el-descriptions-item
        >
        <el-descriptions-item label="参考图记录"
          ><span
            v-for="(count, state) in source.references"
            :key="state"
            class="mr-4"
            >{{ referenceNames[state] ?? state }} {{ count }}</span
          ></el-descriptions-item
        >
      </el-descriptions>
      <el-alert
        v-if="source.source === 'NONE' || source.devOnly"
        :title="
          source.source === 'NONE'
            ? '请在部署配置中设置试穿参考图来源后再开通使用。'
            : '当前使用仅限本地开发的 XMax 存储，请为正式部署配置自有来源。'
        "
        type="warning"
        :closable="false"
      />
      <h3 class="font-semibold">最近 90 天的每日用量</h3>
      <p class="text-sm text-[var(--el-text-color-secondary)]">
        实际费用与预留分开显示。余额探测和恢复设置不会抹除累计支出。
      </p>
      <el-table :data="usage" empty-text="暂无试穿用量" row-key="quota_day">
        <el-table-column prop="quota_day" label="日期" min-width="120" />
        <el-table-column prop="sessions" label="会话数" min-width="90" />
        <el-table-column
          prop="consumed_points"
          label="实际消耗（积分）"
          min-width="150"
        />
        <el-table-column
          prop="reserved_points"
          label="在途预留（积分）"
          min-width="150"
        />
        <el-table-column
          prop="user_seconds"
          label="用户已用时长（秒）"
          min-width="160"
        />
      </el-table>
    </template>
  </section>
</template>
