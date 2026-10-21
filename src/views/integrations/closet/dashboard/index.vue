<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  ref
} from "vue";

import {
  getClosetDashboard,
  type DashboardSnapshot
} from "@/api/closet/management";
import { metricNames, closetFamilyLabel } from "@/api/closet/insights";
import { sourceLabel } from "../insights/chartOptions";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useClosetRequest, formatTime } from "../useClosetRequest";
import CountUp from "./CountUp.vue";
import ScreenChart from "./ScreenChart.vue";
import ScreenControls from "./ScreenControls.vue";
import {
  barOption,
  columnOption,
  donutOption,
  growthOption,
  heatmapOption,
  ringOption,
  roseOption,
  sparkOption,
  trendOption,
  type ScreenTheme
} from "./screenOptions";
import { featureLabel } from "../insights/chartOptions";
defineOptions({ name: "ClosetDashboard" });
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const snapshot = ref<DashboardSnapshot>();
// Bumped on every refresh so numbers and charts play their entrance again.
const replay = ref(0);
const auto = ref(true);
const host = ref<HTMLElement>();
const height = ref<number>();
let timer: ReturnType<typeof setTimeout> | undefined;
let active = true;
const period = ref("daily");
// Follow the platform's light/dark switch (an html.dark class).
const readTheme = (): ScreenTheme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";
const theme = ref<ScreenTheme>(readTheme());
const themeObserver = new MutationObserver(() => {
  theme.value = readTheme();
});

const kpis = [
  {
    key: "usersTotal",
    label: "业务用户",
    sub: "今日新增",
    subKey: "usersNewToday",
    spark: "active_users"
  },
  {
    key: "garmentsActive",
    label: "有效衣物",
    sub: "今日入柜",
    subKey: "garmentsToday",
    spark: "garments_created"
  },
  {
    key: "outfitsTotal",
    label: "保存搭配",
    sub: "今日保存",
    subKey: "outfitsToday",
    spark: "outfits_created"
  },
  {
    key: "recommendationsToday",
    label: "今日推荐",
    sub: "七日采用率",
    subKey: "adoptionRate7d",
    spark: "recommendations_shown"
  }
] as const;
const tile = (key: string) => snapshot.value?.tiles[key];
const dailySeries = (metric: string) =>
  snapshot.value?.daily.series.find(item => item.metric === metric)?.values ??
  [];
const sparkFor = (metric: string, index: number) =>
  sparkOption(theme.value, dailySeries(metric), index);

const clearTimer = () => {
  if (timer) clearTimeout(timer);
  timer = undefined;
};
const load = async () => {
  if (loading.value) return;
  clearTimer();
  const ok = await run(getClosetDashboard, result => {
    if (snapshot.value) replay.value++;
    snapshot.value = result.data;
  });
  if (ok && active && auto.value && !document.hidden)
    timer = setTimeout(
      () => void load(),
      Math.max(30000, snapshot.value?.refreshAfterMs ?? 30000)
    );
};
const toggleAuto = () => {
  clearTimer();
  if (auto.value) void load();
};
const visibility = () => {
  clearTimer();
  if (!document.hidden && active && auto.value) void load();
};
// The screen fills the visible content area so everything shows without scrolling.
const fit = async () => {
  if (!host.value || document.fullscreenElement) return;
  const top = host.value.getBoundingClientRect().top;
  // Four rows of panels need about 860px; shorter windows scroll instead of squashing the charts.
  height.value = Math.max(860, Math.floor(window.innerHeight - top - 24));
  // Layout chrome below the content (e.g. the footer) must not cause a scrollbar either.
  await nextTick();
  const wrap = host.value?.closest(".el-scrollbar__wrap");
  const extra = wrap ? wrap.scrollHeight - wrap.clientHeight : 0;
  if (extra > 0 && height.value)
    height.value = Math.max(860, height.value - extra);
};
onMounted(() => {
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("resize", fit);
  fit();
  void load();
});
onActivated(() => {
  fit();
  if (!active) {
    active = true;
    void load();
  }
});
onDeactivated(() => {
  active = false;
  clearTimer();
});
onBeforeUnmount(() => {
  themeObserver.disconnect();
  active = false;
  clearTimer();
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("resize", fit);
});

const trend = computed(() => {
  const data =
    period.value === "daily" ? snapshot.value?.daily : snapshot.value?.hourly;
  const buckets =
    period.value === "daily"
      ? snapshot.value?.daily.days.map(day => day.slice(5))
      : snapshot.value?.hourly.hours.map(hour => hour.slice(11, 16));
  // Token quantities have a different unit; they get their own chart below.
  return trendOption(
    theme.value,
    buckets ?? [],
    (data?.series ?? [])
      .filter(item => item.metric !== "model_tokens")
      .map(item => ({
        name: metricNames[item.metric] ?? item.metric,
        values: item.values
      }))
  );
});
const categories = computed(() =>
  ringOption(
    theme.value,
    snapshot.value?.distributions.categories.map(item => ({
      name: closetFamilyLabel(item.key),
      value: item.count
    })) ?? [],
    "有效衣物"
  )
);
const colors = computed(() =>
  barOption(
    theme.value,
    (snapshot.value?.distributions.colors ?? [])
      .slice(0, 8)
      .map(item => ({ name: item.key, value: item.count })),
    true
  )
);
const seasons = computed(() =>
  roseOption(
    theme.value,
    snapshot.value?.distributions.seasons.map(item => ({
      name: item.key,
      value: item.count
    })) ?? []
  )
);
const sourceRows = computed(
  () => snapshot.value?.distributions.recommendationSources7d ?? []
);
// Each source is one row: the track is scaled to the busiest source, the inner bar is what got adopted.
const sources = computed(() => {
  const max = Math.max(1, ...sourceRows.value.map(item => item.shown));
  return sourceRows.value.map(item => ({
    name: sourceLabel(item.source),
    shown: item.shown,
    adopted: item.adopted,
    shownWidth: (item.shown / max) * 100,
    adoptedWidth: item.shown ? (item.adopted / item.shown) * 100 : 0
  }));
});
const adoptionTotals = computed(() =>
  sourceRows.value.reduce(
    (sum, item) => ({
      shown: sum.shown + item.shown,
      adopted: sum.adopted + item.adopted
    }),
    { shown: 0, adopted: 0 }
  )
);
const trendCount = computed(() =>
  period.value === "daily"
    ? (snapshot.value?.daily.days.length ?? 0)
    : (snapshot.value?.hourly.hours.length ?? 0)
);
const categoryCount = computed(
  () =>
    snapshot.value?.distributions.categories.filter(item => item.count > 0)
      .length ?? 0
);
const seasonCount = computed(
  () =>
    snapshot.value?.distributions.seasons.filter(item => item.count > 0)
      .length ?? 0
);
const tokens = computed(() =>
  columnOption(
    theme.value,
    snapshot.value?.daily.days.map(day => day.slice(5)) ?? [],
    dailySeries("model_tokens"),
    "模型 Token"
  )
);
const tokenTotal = computed(() =>
  dailySeries("model_tokens").reduce((sum, value) => sum + value, 0)
);
const styles = computed(() =>
  barOption(
    theme.value,
    (snapshot.value?.distributions.styles ?? [])
      .slice(0, 8)
      .map(item => ({ name: item.key, value: item.count }))
  )
);
const heat = computed(() =>
  heatmapOption(theme.value, snapshot.value?.heatmap?.cells ?? [])
);
const heatTotal = computed(() =>
  (snapshot.value?.heatmap?.cells ?? []).reduce((sum, cell) => sum + cell[2], 0)
);
const peak = computed(() => {
  const cells = snapshot.value?.heatmap?.cells ?? [];
  const top = cells.reduce<[number, number, number] | undefined>(
    (best, cell) => (!best || cell[2] > best[2] ? cell : best),
    undefined
  );
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  return top && top[2] ? `${days[top[0] - 1]} ${top[1]}:00` : "—";
});
const growth = computed(() =>
  growthOption(
    theme.value,
    snapshot.value?.growth?.days ?? [],
    snapshot.value?.growth?.newUsers ?? [],
    snapshot.value?.growth?.cumulative ?? []
  )
);
const newUsers30d = computed(() =>
  (snapshot.value?.growth?.newUsers ?? []).reduce((sum, n) => sum + n, 0)
);
const viaNames: Record<string, string> = {
  INVITE: "邀请码",
  OPEN: "自助注册",
  ADMIN: "管理员创建"
};
const via = computed(() =>
  (snapshot.value?.distributions.registeredVia ?? []).map(item => ({
    label: viaNames[item.key] ?? item.key,
    count: item.count
  }))
);
const sizeColors = ["#cbd5e1", "#93c5fd", "#60a5fa", "#2563eb", "#1e3a8a"];
const closetSizes = computed(() => {
  const items = snapshot.value?.distributions.closetSizes ?? [];
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  return items.map((item, index) => ({
    label: item.key === "0" ? "空衣柜" : `${item.key} 件`,
    count: item.count,
    width: (item.count / total) * 100,
    color: sizeColors[index % sizeColors.length]
  }));
});
const fitColors: Record<string, string> = {
  女款: "#e11d48",
  男款: "#2563eb",
  中性: "#0d9488"
};
const genderFits = computed(() =>
  donutOption(
    theme.value,
    (snapshot.value?.distributions.genderFits ?? []).map(item => ({
      name: item.key,
      value: item.count
    })),
    fitColors
  )
);
const aiFeatures = computed(() => {
  const rows = snapshot.value?.distributions.aiFeatures30d ?? [];
  const max = Math.max(1, ...rows.map(row => row.tokens));
  return rows.slice(0, 4).map(row => ({
    label: featureLabel(row.key),
    calls: row.calls,
    tokens: row.tokens,
    width: (row.tokens / max) * 100
  }));
});
const compactNumber = (value: number) =>
  value >= 100_000_000
    ? `${(value / 100_000_000).toFixed(1)} 亿`
    : value >= 10_000
      ? `${(value / 10_000).toFixed(1)} 万`
      : value.toLocaleString();
const feedText = (item: NonNullable<DashboardSnapshot["feed"]>[number]) => {
  switch (item.kind) {
    case "GARMENT_ADDED": {
      const name =
        item.label && item.label !== "UNKNOWN"
          ? closetFamilyLabel(item.label)
          : "衣物";
      return `有人新入柜了一件${name}`;
    }
    case "OUTFIT_SAVED":
      return "有人保存了一套搭配";
    case "WEAR_LOGGED":
      return "有人记录了今日穿搭";
    case "RECOMMENDATION_LIKED":
      return "有人点赞了一套推荐";
    case "USER_REGISTERED":
      return `新用户${item.label === "INVITE" ? "凭邀请码" : item.label === "OPEN" ? "自助" : "由管理员开通"}注册`;
  }
};
const feedKinds = {
  GARMENT_ADDED: "#2563eb",
  OUTFIT_SAVED: "#d97706",
  WEAR_LOGGED: "#0d9488",
  RECOMMENDATION_LIKED: "#e11d48",
  USER_REGISTERED: "#7c3aed"
} as const;
const ago = (at: number) => {
  const diff = Math.max(0, (snapshot.value?.generatedAtMs ?? Date.now()) - at);
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
};
// Long feeds scroll as a loop: the list is doubled and the track moves by half its height.
const rolledFeed = computed(() =>
  feed.value.length > 6 ? [...feed.value, ...feed.value] : feed.value
);
const feed = computed(() =>
  (snapshot.value?.feed ?? []).map((item, index) => ({
    key: `${item.atMs}-${index}`,
    text: feedText(item),
    when: ago(item.atMs),
    color: feedKinds[item.kind]
  }))
);
const usage = computed(() => [
  { label: "打卡", value: tile("wearLogsToday") },
  { label: "助手消息", value: tile("agentMessagesToday") },
  { label: "图片用量", value: tile("imageUnitsToday") },
  { label: "Token", value: tile("modelTokensToday") }
]);
const healthy = computed(() => snapshot.value?.ops.status === "UP");
const fullscreen = async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await host.value?.requestFullscreen();
};
</script>
<template>
  <section
    ref="host"
    class="screen closet-screen"
    :style="height ? { height: `${height}px` } : undefined"
  >
    <template v-if="snapshot && !unavailable && !errorMessage">
      <div class="kpi-row">
        <div v-for="(kpi, index) in kpis" :key="kpi.key" class="kpi">
          <div class="kpi-text">
            <span class="kpi-label">{{ kpi.label }}</span>
            <strong class="kpi-value"
              ><CountUp :value="tile(kpi.key)" :replay="replay"
            /></strong>
            <span class="kpi-sub"
              >{{ kpi.sub }}
              <b
                ><CountUp
                  :value="tile(kpi.subKey)"
                  :percent="kpi.subKey === 'adoptionRate7d'"
                  :replay="replay"
              /></b>
            </span>
          </div>
          <div class="kpi-spark">
            <ScreenChart
              :option="sparkFor(kpi.spark, index)"
              :replay="replay"
            />
          </div>
        </div>
        <div class="kpi">
          <div class="kpi-text">
            <span class="kpi-label">今日活跃</span>
            <strong class="kpi-value"
              ><CountUp :value="tile('activeToday')" :replay="replay"
            /></strong>
            <span class="kpi-sub"
              >7 日 <b>{{ tile("active7d") ?? 0 }}</b> · 30 日
              <b>{{ tile("active30d") ?? 0 }}</b> · 在线
              <b>{{ tile("onlineNow") ?? 0 }}</b></span
            >
          </div>
        </div>
        <div class="kpi live">
          <ScreenControls
            v-model="auto"
            class="live-control"
            :loading="loading"
            :updated-at="formatTime(snapshot.generatedAtMs)"
            @refresh="load"
            @fullscreen="fullscreen"
            @auto="toggleAuto"
          />
          <div class="kpi-text">
            <span class="kpi-label"
              ><i class="dot" :class="{ ok: healthy }" />运行状态</span
            >
            <strong class="kpi-value status" :class="{ warn: !healthy }">{{
              healthy ? "服务正常" : "需要关注"
            }}</strong>
            <span class="kpi-sub"
              >健康问题 <b>{{ snapshot.ops.issues }}</b> · 积压
              <b>{{ snapshot.ops.queueBacklog }}</b> · 失败
              <b :class="{ warn: snapshot.ops.failed24h > 0 }">{{
                snapshot.ops.failed24h
              }}</b></span
            >
          </div>
        </div>
      </div>

      <div class="panel p-categories">
        <h3>衣柜品类构成</h3>
        <div class="body">
          <ScreenChart
            :option="categories"
            :replay="replay"
            cycle="slice"
            :count="categoryCount"
          />
        </div>
      </div>
      <div class="panel p-trend">
        <div class="panel-head">
          <h3>业务活动趋势</h3>
          <el-radio-group
            v-model="period"
            size="small"
            aria-label="趋势时间范围"
          >
            <el-radio-button value="hourly">24 小时</el-radio-button>
            <el-radio-button value="daily">30 天</el-radio-button>
          </el-radio-group>
        </div>
        <div class="body">
          <ScreenChart
            :option="trend"
            :replay="replay"
            cycle="tip"
            :count="trendCount"
          />
        </div>
      </div>
      <div class="panel p-adoption">
        <h3>推荐采用 · 近 7 天</h3>
        <div class="adoption-head">
          <div class="adoption-rate">
            <strong
              ><CountUp
                :value="tile('adoptionRate7d')"
                percent
                :replay="replay"
            /></strong>
            <span class="adoption-label">七日采用率</span>
          </div>
          <dl class="adoption-totals">
            <div>
              <dt><i class="swatch shown" />展示</dt>
              <dd>{{ adoptionTotals.shown.toLocaleString() }}</dd>
            </div>
            <div>
              <dt><i class="swatch adopted" />采用</dt>
              <dd>{{ adoptionTotals.adopted.toLocaleString() }}</dd>
            </div>
          </dl>
        </div>
        <ul v-if="sources.length" class="sources">
          <li v-for="item in sources" :key="item.name">
            <span class="source-name" :title="item.name"
              >{{ item.name
              }}<small>{{
                item.shown
                  ? `${((item.adopted / item.shown) * 100).toFixed(1)}%`
                  : "—"
              }}</small></span
            >
            <span class="source-track"
              ><span
                class="source-shown"
                :style="{ width: `${item.shownWidth}%` }"
                ><i :style="{ width: `${item.adoptedWidth}%` }" /></span
            ></span>
            <span class="source-count"
              ><b>{{ item.adopted }}</b> / {{ item.shown }}</span
            >
          </li>
        </ul>
        <p v-else class="empty">过去七天暂无推荐记录</p>
      </div>

      <div class="panel p-styles">
        <div class="panel-head">
          <h3>风格偏好 TOP</h3>
          <span class="hint">按衣物风格标签</span>
        </div>
        <div class="body">
          <ScreenChart
            v-if="snapshot.distributions.styles?.length"
            :option="styles"
            :replay="replay"
          />
          <p v-else class="empty">入柜后显示风格分布</p>
        </div>
      </div>
      <div class="panel p-heat">
        <div class="panel-head">
          <h3>活跃时段热力 · 近 {{ snapshot.heatmap?.days ?? 28 }} 天</h3>
          <span class="hint"
            >共 {{ compactNumber(heatTotal) }} 次操作 · 高峰 {{ peak }}</span
          >
        </div>
        <div class="body">
          <ScreenChart :option="heat" :replay="replay" />
        </div>
      </div>
      <div class="panel p-feed">
        <div class="panel-head">
          <h3>实时动态</h3>
          <span class="hint live-hint"><i class="dot ok" />去标识展示</span>
        </div>
        <div v-if="feed.length" class="feed">
          <ul class="feed-track" :class="{ rolling: feed.length > 6 }">
            <li v-for="(item, index) in rolledFeed" :key="index">
              <i :style="{ background: item.color }" />
              <span class="feed-text">{{ item.text }}</span>
              <time>{{ item.when }}</time>
            </li>
          </ul>
        </div>
        <p v-else class="empty">还没有动态</p>
      </div>

      <div class="panel p-colors">
        <h3>衣物颜色 TOP</h3>
        <div class="body">
          <ScreenChart
            v-if="snapshot.distributions.colors.length"
            :option="colors"
            :replay="replay"
          />
          <p v-else class="empty">入柜后显示颜色分布</p>
        </div>
      </div>
      <div class="panel p-growth">
        <div class="panel-head">
          <h3>用户增长 · 近 30 天</h3>
          <span class="hint">新增 {{ newUsers30d }}</span>
        </div>
        <div class="via">
          <span v-for="item in via" :key="item.label"
            >{{ item.label }} <b>{{ item.count }}</b></span
          >
        </div>
        <div class="body">
          <ScreenChart :option="growth" :replay="replay" />
        </div>
        <div class="sizes" aria-label="衣柜规模分布">
          <div class="sizes-bar">
            <i
              v-for="item in closetSizes"
              :key="item.label"
              :style="{ width: `${item.width}%`, background: item.color }"
              :title="`${item.label}：${item.count} 位用户`"
            />
          </div>
          <div class="sizes-legend">
            <span v-for="item in closetSizes" :key="item.label"
              ><i :style="{ background: item.color }" />{{ item.label }}
              {{ item.count }}</span
            >
          </div>
        </div>
      </div>
      <div class="panel p-seasons">
        <h3>适穿季节 · 版型</h3>
        <div class="body pair">
          <ScreenChart
            v-if="snapshot.distributions.seasons.length"
            :option="seasons"
            :replay="replay"
            cycle="slice"
            :count="seasonCount"
          />
          <ScreenChart
            v-if="snapshot.distributions.genderFits?.length"
            :option="genderFits"
            :replay="replay"
          />
        </div>
      </div>
      <div class="panel p-usage">
        <div class="panel-head">
          <h3>AI 用量</h3>
          <span class="hint">30 天 Token {{ compactNumber(tokenTotal) }}</span>
        </div>
        <div class="chips">
          <div v-for="item in usage" :key="item.label">
            <span>{{ item.label }}</span
            ><b><CountUp :value="item.value" :replay="replay" /></b>
          </div>
        </div>
        <ul v-if="aiFeatures.length" class="features">
          <li v-for="item in aiFeatures" :key="item.label">
            <span class="feature-name">{{ item.label }}</span>
            <span class="feature-track"
              ><i :style="{ width: `${item.width}%` }"
            /></span>
            <span class="feature-count">{{ compactNumber(item.tokens) }}</span>
          </li>
        </ul>
        <div class="body">
          <ScreenChart :option="tokens" :replay="replay" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="state">
        <ScreenControls
          v-model="auto"
          :loading="loading"
          :updated-at="formatTime(snapshot?.generatedAtMs)"
          class="state-control"
          @refresh="load"
          @fullscreen="fullscreen"
          @auto="toggleAuto"
        />
        <ClosetUnavailable
          v-if="unavailable"
          :loading="loading"
          @retry="load"
        />
        <el-alert
          v-else-if="errorMessage"
          :title="errorMessage"
          type="error"
          :closable="false"
        />
        <el-skeleton v-else :rows="12" animated />
      </div>
    </template>
  </section>
</template>
<style scoped>
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

@keyframes roll {
  to {
    transform: translateY(-50%);
  }
}

@keyframes sweep {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(260%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dot.ok,
  .feature-track i::after,
  .feed-track.rolling {
    animation: none;
  }

  .feature-track i,
  .sizes-bar i,
  .source-shown,
  .source-shown i {
    transition: none;
  }
}

/* Fixed-height screen only where there is room; smaller windows scroll as a normal page. */
@media (width <= 1279px), (height <= 640px) {
  .screen {
    display: flex;
    flex-direction: column;
    height: auto !important;
    overflow: visible;
  }

  .kpi-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel {
    min-height: 260px;
  }

  .kpi {
    min-height: 80px;
  }
}

/* Cards sit directly on the layout's page background; the screen itself has none. */
.screen {
  --screen-bg: var(--el-bg-color-page);
  --screen-panel: #fff;
  --screen-strong: #111827;
  --screen-text: #4b5563;
  --screen-sub: #9ca3af;
  --screen-chip: rgb(0 0 0 / 5%);
  --screen-accent: #2563eb;
  --screen-ok: #16a34a;
  --screen-warn: #d97706;
  --screen-glow: none;

  position: relative;
  display: grid;
  grid-template:
    92px minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr)
    / repeat(12, minmax(0, 1fr));
  gap: 14px;
  min-height: 0;
  padding: 4px 0;
  overflow: hidden;
  color: var(--screen-text);
}

.screen:fullscreen {
  height: 100vh !important;
  padding: 20px;
  background: var(--screen-bg);
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 14px 16px;
  background: var(--screen-panel);
  border-radius: 12px;
}

.panel h3 {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--screen-strong);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.hint {
  font-size: 12px;
  color: var(--screen-sub);
}

.body {
  flex: 1;
  min-height: 0;
}

.empty {
  padding-top: 24px;
  font-size: 13px;
  color: var(--screen-sub);
  text-align: center;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-column: 1 / -1;
  gap: 14px;
  align-items: stretch;
  min-height: 0;
}

/* Screen settings live in the corner of the status card instead of taking a column of their own. */
.kpi.live {
  position: relative;
}

.live-control {
  position: absolute;
  top: 8px;
  right: 8px;
}

.kpi {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 10px 16px;
  overflow: hidden;
  background: var(--screen-panel);
  border-radius: 12px;
}

.kpi-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.kpi-label {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  color: var(--screen-sub);
}

.kpi-value {
  margin: 2px 0;
  font-size: 34px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: var(--screen-strong);
  text-shadow: var(--screen-glow);
}

.kpi-value.status {
  font-size: 24px;
  color: var(--screen-ok);
}

.kpi-sub {
  font-size: 12px;
  color: var(--screen-sub);
}

.kpi-sub b {
  margin-left: 2px;
  font-weight: 500;
  color: var(--screen-text);
}

.kpi-value.status.warn,
.kpi-sub b.warn {
  color: var(--screen-warn);
}

.kpi-spark {
  flex: 0 1 44%;
  min-width: 60px;
  height: 52px;
}

.dot {
  width: 8px;
  height: 8px;
  background: var(--screen-warn);
  border-radius: 50%;
}

.dot.ok {
  background: var(--screen-ok);
  animation: pulse 2s ease-in-out infinite;
}

.p-categories {
  grid-column: span 3;
}

.p-trend {
  grid-column: span 6;
}

.p-adoption {
  grid-column: span 3;
}

.adoption-head {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 6px 0 14px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--screen-chip);
}

.adoption-rate {
  display: flex;
  flex-direction: column;
}

.adoption-rate strong {
  font-size: 34px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: var(--screen-strong);
  text-shadow: var(--screen-glow);
}

.adoption-label {
  font-size: 12px;
  color: var(--screen-sub);
}

.adoption-totals {
  display: flex;
  gap: 16px;
}

.adoption-totals dt {
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 12px;
  color: var(--screen-sub);
}

.adoption-totals dd {
  font-size: 16px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--screen-strong);
  text-align: right;
}

.swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.swatch.shown,
.source-shown {
  background: color-mix(in srgb, var(--screen-accent) 22%, transparent);
}

.swatch.adopted,
.source-shown i {
  background: var(--screen-accent);
}

.sources {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  justify-content: space-around;
  min-height: 0;
  overflow: hidden;
}

.sources li {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.source-name {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--screen-text);
  white-space: nowrap;
}

.source-name small {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--screen-sub);
}

.source-track {
  height: 8px;
  overflow: hidden;
  background: var(--screen-chip);
  border-radius: 4px;
}

.source-shown {
  display: block;
  min-width: 4px;
  height: 100%;
  border-radius: 4px;
  transition: width 0.9s ease;
}

.source-shown i {
  display: block;
  height: 100%;
  border-radius: 4px;
  transition: width 0.9s ease;
}

.source-count {
  font-variant-numeric: tabular-nums;
  color: var(--screen-sub);
  white-space: nowrap;
}

.source-count b {
  font-weight: 500;
  color: var(--screen-strong);
}

.p-styles,
.p-feed,
.p-colors,
.p-growth,
.p-seasons,
.p-usage {
  grid-column: span 3;
}

.p-heat {
  grid-column: span 6;
}

.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.live-hint {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.feed {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 8%,
    #000 88%,
    transparent
  );
}

.feed-track li {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  height: 30px;
  font-size: 12px;
  border-bottom: 1px dashed var(--screen-chip);
}

.feed-track li i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.feed-text {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--screen-text);
  white-space: nowrap;
}

.feed-track time {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--screen-sub);
}

/* The list is doubled, so moving by half its height loops seamlessly. */
.feed-track.rolling {
  animation: roll 40s linear infinite;
}

.feed:hover .feed-track.rolling {
  animation-play-state: paused;
}

.via {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--screen-sub);
}

.via b,
.sizes-legend {
  font-variant-numeric: tabular-nums;
}

.via b {
  font-weight: 500;
  color: var(--screen-strong);
}

.sizes {
  margin-top: 8px;
}

.sizes-bar {
  display: flex;
  gap: 2px;
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
}

.sizes-bar i {
  display: block;
  min-width: 2px;
  height: 100%;
  transition: width 0.9s ease;
}

.sizes-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--screen-sub);
}

.sizes-legend span {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.sizes-legend i {
  width: 6px;
  height: 6px;
  border-radius: 2px;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}

.features li {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) 52px;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.feature-name {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--screen-text);
  white-space: nowrap;
}

.feature-track {
  height: 6px;
  overflow: hidden;
  background: var(--screen-chip);
  border-radius: 3px;
}

.feature-track i {
  position: relative;
  display: block;
  height: 100%;
  overflow: hidden;
  background: var(--screen-accent);
  border-radius: 3px;
  transition: width 0.9s ease;
}

/* A light sweep running along each bar keeps the panel feeling live. */
.feature-track i::after {
  position: absolute;
  inset: 0;
  width: 40%;
  content: "";
  background: linear-gradient(
    90deg,
    transparent,
    rgb(255 255 255 / 55%),
    transparent
  );
  animation: sweep 2.8s ease-in-out infinite;
}

.feature-count {
  font-variant-numeric: tabular-nums;
  color: var(--screen-strong);
  text-align: right;
}

.chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 8px;
}

.chips div {
  display: flex;
  gap: 6px;
  align-items: baseline;
  justify-content: space-between;
  padding: 5px 10px;
  background: var(--screen-chip);
  border-radius: 8px;
}

.chips span {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--screen-sub);
  white-space: nowrap;
}

.chips b {
  font-size: 15px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--screen-strong);
}

.state {
  position: relative;
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  padding-top: 8px;
}

.state-control {
  position: absolute;
  top: 0;
  right: 0;
}
</style>
<!-- Unscoped: the platform switches theme with an html.dark class. -->
<style>
html.dark .closet-screen {
  --screen-bg: var(--el-bg-color-page);
  --screen-panel: #141414;
  --screen-strong: #f5f7fa;
  --screen-text: #a9bddb;
  --screen-sub: #6f86ab;
  --screen-chip: rgb(255 255 255 / 7%);
  --screen-accent: #22d3ee;
  --screen-ok: #4ade80;
  --screen-warn: #fbbf24;
  --screen-glow: 0 0 14px rgb(34 211 238 / 40%);
}
</style>
