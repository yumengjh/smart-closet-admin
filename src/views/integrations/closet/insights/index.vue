<script setup lang="ts">
import {
  getClosetOverview,
  getClosetRecommendations,
  getClosetAi,
  type RecommendationKpi,
  type AiUsage,
  getClosetTrends,
  getClosetUsage,
  getClosetWardrobe,
  type InsightOverview,
  type TrendInsight,
  type TrendMetric,
  type UsageInsight,
  type WardrobeInsight
} from "@/api/closet/insights";
import { listClosetUsers, type ClosetUserSummary } from "@/api/closet/users";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import "../analytics.css";
import InsightIcon from "~icons/ri/bar-chart-box-line";
import RefreshIcon from "~icons/ri/refresh-line";
import OverviewCards from "./OverviewCards.vue";
import WardrobeCharts from "./WardrobeCharts.vue";
import UsagePanel from "./UsagePanel.vue";
import KpiPanel from "./KpiPanel.vue";
import TrendChart from "./TrendChart.vue";
import { message } from "@/utils/message";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

defineOptions({ name: "ClosetInsights" });
type DateRange = [string, string];
const route = useRoute();
const router = useRouter();
const { can } = useCurrentPermissions();
const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
const dateRange = ref<DateRange>([localDate(start), localDate(now)]);
const lastValidRange = ref<DateRange>([...dateRange.value]);
const username = ref(
  typeof route.query.username === "string" ? route.query.username : ""
);
const users = ref<ClosetUserSummary[]>([]);
const userLoading = ref(false);
const loading = ref(false);
const unavailable = ref(false);
const errorMessage = ref("");
const overview = ref<InsightOverview>();
const wardrobe = ref<WardrobeInsight>();
const usage = ref<UsageInsight>();
const trends = ref<TrendInsight>();
const recommendations = ref<RecommendationKpi>();
const ai = ref<AiUsage>();
const metrics = ref<TrendMetric[]>([
  "garments_created",
  "garments_adopted",
  "outfits_created",
  "quick_intakes"
]);
const granularity = ref<"day" | "week" | "month">("day");
let requestId = 0;

const loadUsers = async (q = "") => {
  if (!can("closet:user:read")) return;
  userLoading.value = true;
  try {
    const { data } = await listClosetUsers({
      q: q || undefined,
      sort: "username",
      order: "asc",
      page: 0,
      size: 20
    });
    users.value = data.items;
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("搜索业务用户失败", { type: "error" });
  } finally {
    userLoading.value = false;
  }
};
const remoteSearch = (query: string) => {
  void loadUsers(query.trim());
};
const retry = () => {
  void load();
  if (can("closet:user:read")) void loadUsers(username.value);
};
const setDateRange = (value: DateRange | null) => {
  if (!value) return;
  const days =
    Math.floor(
      (new Date(`${value[1]}T00:00:00`).getTime() -
        new Date(`${value[0]}T00:00:00`).getTime()) /
        86400000
    ) + 1;
  if (days < 1 || days > 366) {
    message("日期范围最多为 366 天", { type: "warning" });
    return;
  }
  lastValidRange.value = [...value];
  dateRange.value = [...value];
};
const load = async () => {
  const current = ++requestId;
  loading.value = true;
  unavailable.value = false;
  errorMessage.value = "";
  const scope = username.value || undefined;
  const [from, to] = dateRange.value;
  try {
    const [
      overviewResult,
      wardrobeResult,
      usageResult,
      trendsResult,
      recommendationResult,
      aiResult
    ] = await Promise.all([
      getClosetOverview({ username: scope, from, to }),
      getClosetWardrobe({ username: scope }),
      getClosetUsage({ username: scope }),
      getClosetTrends({
        username: scope,
        from,
        to,
        metric: metrics.value,
        granularity: granularity.value
      }),
      getClosetRecommendations({ username: scope, from, to }),
      getClosetAi({ username: scope, from, to })
    ]);
    if (current !== requestId) return;
    overview.value = overviewResult.data;
    wardrobe.value = wardrobeResult.data;
    usage.value = usageResult.data;
    trends.value = trendsResult.data;
    recommendations.value = recommendationResult.data;
    ai.value = aiResult.data;
  } catch (error) {
    if (current !== requestId) return;
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else {
      errorMessage.value = "读取衣柜洞察失败，请检查日期范围和筛选条件";
      message(errorMessage.value, { type: "error" });
    }
  } finally {
    if (current === requestId) loading.value = false;
  }
};
const changeScope = async (value: string) => {
  username.value = value;
  await router.replace({
    query: { ...route.query, username: value || undefined }
  });
  void load();
};
watch(
  () => route.query.username,
  value => {
    const next = typeof value === "string" ? value : "";
    if (next !== username.value) {
      username.value = next;
      void load();
    }
  }
);
watch(
  [dateRange, metrics, granularity],
  () => {
    if (overview.value) void load();
  },
  { deep: true }
);
onBeforeUnmount(() => {
  requestId++;
});
onMounted(() => {
  if (can("closet:user:read")) void loadUsers(username.value);
  void load();
});
</script>

<template>
  <div class="closet-analytics space-y-5">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center gap-3">
        <span class="analytics-symbol"><InsightIcon /></span>
        <div class="analytics-title">
          <h2>衣柜洞察</h2>
          <p>推荐转化、资源消耗与衣柜构成</p>
        </div>
        <el-select
          v-if="can('closet:user:read')"
          :model-value="username"
          class="scope-select"
          filterable
          remote
          clearable
          reserve-keyword
          :remote-method="remoteSearch"
          :loading="userLoading"
          placeholder="全站"
          aria-label="洞察范围"
          @visible-change="visible => visible && !users.length && loadUsers()"
          @update:model-value="changeScope"
        >
          <el-option
            v-for="user in users"
            :key="user.username"
            :value="user.username"
            :label="user.username"
          >
            <span>{{ user.username }}</span
            ><span class="float-right text-sm text-gray-400">{{
              user.role === "ADMIN" ? "管理员" : "普通用户"
            }}</span>
          </el-option>
        </el-select>
        <el-tag v-else type="info">{{
          username ? `用户：${username}` : "全站范围"
        }}</el-tag>
        <el-date-picker
          :model-value="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          :clearable="false"
          :unlink-panels="true"
          @update:model-value="setDateRange"
        />
        <el-button
          type="primary"
          :icon="RefreshIcon"
          :loading="loading"
          @click="load"
          >刷新</el-button
        >
      </div>
      <el-collapse class="analytics-detail"
        ><el-collapse-item title="统计口径说明"
          ><p class="analytics-note">
            使用次数 =
            出现在已保存搭配中的次数；穿搭打卡另计。采纳率按区间内录入且当前仍为有效状态的衣物计算，后续状态变化会影响结果。衣柜构成与搭配使用统计当前有效衣物，不受日期范围影响。
          </p>
        </el-collapse-item></el-collapse
      >
    </el-card>
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="retry" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <template v-else>
      <div v-loading="loading" class="space-y-4">
        <template v-if="overview && wardrobe && usage && trends">
          <OverviewCards :overview="overview" />
          <TrendChart
            v-model:metrics="metrics"
            v-model:granularity="granularity"
            :trends="trends"
          />
          <KpiPanel
            v-if="recommendations && ai"
            :recommendations="recommendations"
            :ai="ai"
          />
          <WardrobeCharts :wardrobe="wardrobe" />
          <UsagePanel :usage="usage" />
          <p class="px-1 text-sm text-gray-500">
            数据映射版本：{{ overview.mappingVersion }} · 更新于
            {{ new Date(overview.generatedAtMs).toLocaleString() }}
          </p>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.scope-select {
  width: 200px;
}

@media (width <= 767px) {
  .scope-select {
    width: 100%;
  }

  :deep(.el-date-editor--daterange) {
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
  }
}
</style>
