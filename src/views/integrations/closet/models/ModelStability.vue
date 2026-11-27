<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { EChartsOption } from "echarts";
import { getModels } from "@/api/closet/models";
import { getEvents, getTimeline, getTraces, getTrace, money, time, poolNames, decisions, type Event, type Timeline, type TraceSummary, type Attempt } from "@/api/closet/modelInsights";
import { message } from "@/utils/message";
import { useClosetRequest } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import ChartView from "../insights/ChartView.vue";

const { loading, unavailable, errorMessage, run } = useClosetRequest();
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 6);
const range = ref<[string, string]>([start.toISOString().slice(0, 10), today]);
const bucket = ref("1h"); const pool = ref("VISION"); const entryId = ref("");
const entries = ref<{ id: string; label: string; model: string }[]>([]);
const timeline = ref<Timeline>(); const events = ref<Event[]>([]); const traces = ref<TraceSummary[]>([]);
const eventPage = ref(1); const eventTotal = ref(0); const tracePage = ref(1); const traceTotal = ref(0);
const eventScope = ref(""); const eventKind = ref(""); const eventRef = ref(""); const eventPool = ref(""); const decision = ref("");
const drawer = ref(false); const attempts = ref<Attempt[]>([]); const traceId = ref("");
const kinds: Record<string, string> = { PAUSED: "暂停", RESUMED: "恢复", MANUAL_RESUME: "手动恢复", DRAINED: "手动摘除", UNDRAINED: "放回", REROUTE: "改道", RESEND: "重发", DEGRADE: "降级", UNREACHABLE: "连不上", REACHABLE: "恢复连通", LOW_BALANCE: "余额不足", BALANCE_RECOVERED: "余额恢复", CAP_REACHED: "达到上限", PROBE_OK: "探活成功", PROBE_FAILED: "探活失败", NO_IMAGE_EDIT: "不支持改图" };
const execution: Record<string, string> = { NOT_EXECUTED: "确定没执行", MAYBE_EXECUTED: "可能已执行", REQUEST: "请求" };
const errorName = (code: string | null) => !code ? "—" : /^PROVIDER_HTTP_(401|403)$/.test(code) ? `密钥或权限（${code}）` : code === "PROVIDER_HTTP_429" ? `限流或额度（${code}）` : code.includes("TIMEOUT") ? `超时（${code}）` : code.includes("CONNECTION") ? `连接失败（${code}）` : code;
const dates = () => ({ from: range.value[0], to: range.value[1] });
const loadTimeline = () => {
  const days = (Date.parse(range.value[1]) - Date.parse(range.value[0])) / 86400000 + 1;
  if (days < 1 || days > 31) { message("请选择不超过 31 天的日期范围", { type: "warning" }); return; }
  void run(() => getTimeline({ ...dates(), bucket: bucket.value, pool: entryId.value ? undefined : pool.value, entryId: entryId.value || undefined }), result => { timeline.value = result.data; });
};
const loadEvents = () => void run(() => getEvents({ ...dates(), scope: eventScope.value || undefined, refId: eventRef.value || undefined, pool: eventPool.value || undefined, kind: eventKind.value || undefined, page: eventPage.value, size: 20 }), result => { events.value = result.data.items; eventTotal.value = result.data.total; });
const loadTraces = () => void run(() => getTraces({ ...dates(), decision: decision.value || undefined, page: tracePage.value, size: 20 }), result => { traces.value = result.data.items; traceTotal.value = result.data.total; });
const load = () => { loadTimeline(); loadEvents(); loadTraces(); };
const openTrace = (row: TraceSummary) => { traceId.value = row.traceId; attempts.value = []; drawer.value = true; void run(() => getTrace(row.traceId), result => { attempts.value = result.data.attempts; }); };
const chart = computed<EChartsOption>(() => {
  const series = timeline.value?.series || [];
  const times = [...new Set(series.flatMap(item => item.buckets.map(b => b.startMs)))].sort((a, b) => a - b);
  const bars = (["ok", "notExecutedFailures", "maybeExecutedFailures", "otherFailures"] as const).flatMap((key, index) => series.map(item => ({ name: `${item.label || item.model || item.entryId} · ${["成功", "确定没执行的失败", "可能已执行的失败", "其他失败"][index]}`, type: "bar" as const, stack: item.entryId, data: times.map(t => item.buckets.find(b => b.startMs === t)?.[key] || 0) })));
  return { tooltip: { trigger: "axis" }, legend: { bottom: 0 }, grid: { bottom: 90, right: 70 }, xAxis: { type: "category", data: times.map(time) }, yAxis: [{ type: "value", name: "次数" }, { type: "value", name: "毫秒" }], series: [...bars, ...series.map(item => ({ name: `${item.label || item.model || item.entryId} · P95`, type: "line" as const, yAxisIndex: 1, data: times.map(t => item.buckets.find(b => b.startMs === t)?.p95Ms ?? null) }))] };
});
onMounted(() => { void run(getModels, result => { entries.value = result.data.entries; }); load(); });
</script>
<template>
  <div class="page-root space-y-4">
    <p class="text-xs text-gray-500">看每个池、每个模型这段时间的调用量、成功率和耗时，以及暂停、恢复、改道、重发、降级的记录。</p>
    <ClosetUnavailable v-if="unavailable" /><el-alert v-else-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-date-picker v-model="range" type="daterange" value-format="YYYY-MM-DD" :clearable="false" range-separator="至" @change="load" />
    <el-card><template #header><div><h2 class="text-base">稳定性曲线</h2><p class="text-xs text-gray-500">确定没执行：上游没出图也没扣费；可能已执行：上游可能已扣费。时间范围最长 31 天。</p></div></template>
      <el-select v-model="pool" :disabled="!!entryId" @change="loadTimeline"><el-option v-for="(name, key) in poolNames" :key="key" :label="name" :value="key" /></el-select>
      <el-select v-model="entryId" clearable filterable placeholder="按模型（不选则按池）" @change="loadTimeline"><el-option v-for="item in entries" :key="item.id" :value="item.id" :label="item.label || item.model" /></el-select>
      <el-select v-model="bucket" @change="loadTimeline"><el-option label="5 分钟" value="5m" /><el-option label="1 小时" value="1h" /><el-option label="1 天" value="1d" /></el-select>
      <ChartView v-if="timeline?.series.length" :option="chart" /><el-empty v-else description="这段时间没有调用或暂停记录" />
      <p class="text-xs text-gray-500">{{ timeline?.note }}</p>
    </el-card>
    <el-card><template #header><div><h2 class="text-base">健康事件</h2><p class="text-xs text-gray-500">筛选池、范围、对象或事件类型；还没有事件时这里为空。</p></div></template>
      <el-select v-model="eventScope" clearable placeholder="全部范围"><el-option v-for="s in ['ENTRY', 'PROVIDER', 'POOL', 'VENDOR']" :key="s" :label="s" :value="s" /></el-select><el-select v-model="eventPool" clearable placeholder="全部池"><el-option v-for="(name, key) in poolNames" :key="key" :label="name" :value="key" /></el-select><el-select v-model="eventKind" clearable placeholder="全部类型"><el-option v-for="(name, key) in kinds" :key="key" :label="name" :value="key" /></el-select><el-input v-model="eventRef" placeholder="对象 ID" style="width: 180px" /><el-button @click="eventPage = 1; loadEvents()">筛选</el-button>
      <el-table :data="events" empty-text="还没有健康事件"><el-table-column label="时间" min-width="170"><template #default="{ row }">{{ time(row.atMs) }}</template></el-table-column><el-table-column prop="scope" label="范围" /><el-table-column prop="refId" label="对象" /><el-table-column label="池"><template #default="{ row }">{{ poolNames[row.pool] || row.pool || '—' }}</template></el-table-column><el-table-column label="类型"><template #default="{ row }">{{ kinds[row.kind] || row.kind }}</template></el-table-column><el-table-column prop="code" label="代码" /></el-table><el-pagination v-model:current-page="eventPage" :page-size="20" :total="eventTotal" layout="total, prev, pager, next" @current-change="loadEvents" />
    </el-card>
    <el-card><template #header><div><h2 class="text-base">尝试链</h2><p class="text-xs text-gray-500">一行是一个任务；同一个任务换过几家都在这里。</p></div></template><el-select v-model="decision" clearable placeholder="全部决定" @change="tracePage = 1; loadTraces()"><el-option v-for="key in ['RESEND', 'REROUTE', 'DEGRADE']" :key="key" :label="decisions[key]" :value="key" /></el-select>
      <el-table :data="traces" empty-text="这段时间没有多次尝试的任务" @row-click="openTrace"><el-table-column label="任务"><template #default="{ row }">{{ row.traceId.slice(0, 8) }}</template></el-table-column><el-table-column label="时间" min-width="170"><template #default="{ row }">{{ time(row.firstAtMs) }}</template></el-table-column><el-table-column prop="attempts" label="尝试次数" /><el-table-column label="决定"><template #default="{ row }">{{ row.decisions.map((d: string) => decisions[d] || d).join('、') }}</template></el-table-column><el-table-column prop="finalOutcome" label="结果" /><el-table-column label="费用"><template #default="{ row }">{{ row.costs.map((c: { amountMicro: number; currency: string }) => money(c.amountMicro, c.currency)).join('、') || '—' }}</template></el-table-column></el-table><el-pagination v-model:current-page="tracePage" :page-size="20" :total="traceTotal" layout="total, prev, pager, next" @current-change="loadTraces" />
    </el-card>
    <el-drawer v-model="drawer" :title="`尝试链 ${traceId.slice(0, 8)}`" size="75%"><el-table :data="attempts" :loading="loading"><el-table-column prop="attemptNo" label="次序" /><el-table-column label="时间" min-width="170"><template #default="{ row }">{{ time(row.atMs) }}</template></el-table-column><el-table-column label="池"><template #default="{ row }">{{ poolNames[row.pool] || row.pool || '—' }}</template></el-table-column><el-table-column label="模型"><template #default="{ row }">{{ row.label || row.model }}</template></el-table-column><el-table-column label="决定"><template #default="{ row }">{{ decisions[row.decision] || row.decision || '—' }}</template></el-table-column><el-table-column prop="outcome" label="结果" /><el-table-column label="错误"><template #default="{ row }">{{ errorName(row.errorCode) }}</template></el-table-column><el-table-column label="执行分类"><template #default="{ row }">{{ execution[row.execution] || row.execution || '—' }}</template></el-table-column><el-table-column label="耗时"><template #default="{ row }">{{ row.latencyMs }} ms</template></el-table-column><el-table-column label="费用"><template #default="{ row }">{{ money(row.costMicro, row.costCurrency) }}</template></el-table-column></el-table></el-drawer>
  </div>
</template>
