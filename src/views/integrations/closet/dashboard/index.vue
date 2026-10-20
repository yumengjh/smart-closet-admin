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
  ringOption,
  roseOption,
  sparkOption,
  seriesColors,
  trendOption,
  type ScreenTheme
} from "./screenOptions";
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
  height.value = Math.max(560, Math.floor(window.innerHeight - top - 24));
  // Layout chrome below the content (e.g. the footer) must not cause a scrollbar either.
  await nextTick();
  const wrap = host.value?.closest(".el-scrollbar__wrap");
  const extra = wrap ? wrap.scrollHeight - wrap.clientHeight : 0;
  if (extra > 0 && height.value)
    height.value = Math.max(560, height.value - extra);
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
const layers = computed(() => {
  const total = tile("usersTotal") || 0;
  return [
    { label: "当前在线", value: tile("onlineNow") ?? 0 },
    { label: "今日活跃", value: tile("activeToday") ?? 0 },
    { label: "七日活跃", value: tile("active7d") ?? 0 },
    { label: "三十日活跃", value: tile("active30d") ?? 0 },
    { label: "业务用户", value: total }
  ].map((layer, index) => ({
    ...layer,
    width: total ? Math.min(100, (layer.value / total) * 100) : 0,
    color: seriesColors(theme.value)[index % 5]
  }));
});
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
        <div class="kpi live">
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
        <ScreenControls
          v-model="auto"
          :loading="loading"
          :updated-at="formatTime(snapshot.generatedAtMs)"
          @refresh="load"
          @fullscreen="fullscreen"
          @auto="toggleAuto"
        />
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
      <div class="panel p-seasons">
        <h3>适穿季节</h3>
        <div class="body">
          <ScreenChart
            v-if="snapshot.distributions.seasons.length"
            :option="seasons"
            :replay="replay"
            cycle="slice"
            :count="seasonCount"
          />
          <p v-else class="empty">入柜后显示季节分布</p>
        </div>
      </div>
      <div class="panel p-layers">
        <h3>用户活跃分层</h3>
        <ul class="layers">
          <li v-for="layer in layers" :key="layer.label">
            <span class="layer-label">{{ layer.label }}</span>
            <span class="layer-track"
              ><i
                :style="{
                  width: `${layer.width}%`,
                  background: layer.color
                }"
            /></span>
            <b><CountUp :value="layer.value" :replay="replay" /></b>
          </li>
        </ul>
      </div>
      <div class="panel p-usage">
        <div class="panel-head">
          <h3>今日用量与 Token</h3>
          <span class="hint">30 天合计 {{ tokenTotal.toLocaleString() }}</span>
        </div>
        <div class="chips">
          <div v-for="item in usage" :key="item.label">
            <span>{{ item.label }}</span
            ><b><CountUp :value="item.value" :replay="replay" /></b>
          </div>
        </div>
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
  .layer-track i::after {
    animation: none;
  }

  .layer-track i,
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
  grid-template: 92px minmax(0, 1.3fr) minmax(0, 1fr) / repeat(
      12,
      minmax(0, 1fr)
    );
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
  grid-template-columns: repeat(5, minmax(0, 1fr)) 34px;
  grid-column: 1 / -1;
  gap: 14px;
  align-items: stretch;
  min-height: 0;
}

.kpi-row > :last-child {
  align-self: start;
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

.p-colors,
.p-seasons,
.p-layers,
.p-usage {
  grid-column: span 3;
}

.layers {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  justify-content: space-around;
  min-height: 0;
}

.layers li {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) 42px;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.layer-label {
  color: var(--screen-text);
}

.layer-track {
  height: 8px;
  overflow: hidden;
  background: var(--screen-chip);
  border-radius: 4px;
}

.layer-track i {
  position: relative;
  display: block;
  height: 100%;
  overflow: hidden;
  border-radius: 4px;
  transition: width 0.9s ease;
}

/* A light sweep running along each bar keeps the panel feeling live. */
.layer-track i::after {
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

.layers b {
  font-weight: 500;
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
