<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getTryOnPool,
  getTryOnUsage,
  getTryOnReferenceSource,
  getTryOnVendors,
  type TryOnVendor,
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
const vendors = ref<TryOnVendor[]>([]);
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
      Promise.all([getTryOnPool(), getTryOnReferenceSource(), getTryOnUsage(), getTryOnVendors()]),
    ([p, s, u, v]) => {
      pool.value = p.data;
      source.value = s.data;
      usage.value = u.data;
      vendors.value = v.data;
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
      <el-card shadow="never">
        <template #header>
          <h2 class="text-base">供应商概况</h2>
          <p class="mt-1 text-xs text-[var(--el-text-color-secondary)]">标准和高质量分别用不同供应商，互不切换；这里看两边今天的会话、时长、花费和余额。</p>
        </template>
        <el-table :data="vendors" empty-text="还没配置供应商账户，登记账户后可查看用量和余额。">
          <el-table-column label="供应商" min-width="150"><template #default="{ row }">{{ row.vendor === 'DECART' ? '高质量 · decart' : '标准 · XMax' }}</template></el-table-column>
          <el-table-column label="健康 / 账户数" min-width="120"><template #default="{ row }">{{ row.healthyAccounts }} / {{ row.accounts }}</template></el-table-column>
          <el-table-column prop="activeSessions" label="在用连接" min-width="100" />
          <el-table-column prop="sessionsToday" label="今日会话" min-width="100" />
          <el-table-column prop="secondsToday" label="今日时长（秒）" min-width="130" />
          <el-table-column prop="consumedPointsToday" label="今日花费（积分）" min-width="140" />
          <el-table-column prop="balancePoints" label="余额（积分）" min-width="120" />
          <el-table-column label="供应商连接 / 上限" min-width="160"><template #default="{ row }">{{ row.vendor === 'DECART' ? `${row.remoteConcurrencyActive ?? '—'} / ${row.remoteConcurrencyLimit ?? '—'}` : '—' }}</template></el-table-column>
        </el-table>
        <p v-if="vendors.length && vendors.every(item => !item.accounts)" class="mt-3 text-xs text-[var(--el-text-color-secondary)]">还没登记账户，对应档位无法提供试穿。</p>
      </el-card>
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
