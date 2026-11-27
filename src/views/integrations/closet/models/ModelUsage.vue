<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { EChartsOption } from "echarts";
import type { Capability, ModelProvider } from "@/api/closet/models";
import {
  getModelUsage,
  type ModelUsage,
  type UsageCost
} from "@/api/closet/modelUsage";
import { message } from "@/utils/message";
import ChartView from "../insights/ChartView.vue";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { formatTime, percent, useClosetRequest } from "../useClosetRequest";

const props = defineProps<{ providers: ModelProvider[] }>();
const names: Record<Capability, string> = {
  VISION: "识图",
  IMAGE: "生图",
  CHAT: "对话"
};
const purposes: Record<string, string> = {
  RECOGNIZE: "识别衣物",
  BATCH_RECOGNIZE: "批量识别",
  OOTD_EXTRACT: "整套样本提取",
  POSE_EXTRACT: "动作提取",
  INSPIRATION_EXTRACT: "穿搭拆解",
  TEXT_TO_IMAGE: "文生图",
  IMAGE_EDIT: "改图/整理",
  AGENT: "助手对话",
  TEST: "试一次"
};
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const start = new Date(`${today}T00:00:00Z`);
start.setUTCDate(start.getUTCDate() - 6);
const range = ref<[string, string]>([start.toISOString().slice(0, 10), today]);
let validRange: [string, string] = [...range.value];
const capability = ref<Capability | "">("");
const providerId = ref("");
const data = ref<ModelUsage>();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const load = () => {
  const [from, to] = range.value;
  data.value = undefined;
  return run(
    () =>
      getModelUsage({
        from,
        to,
        capability: capability.value || undefined,
        providerId: providerId.value || undefined
      }),
    result => {
      data.value = result.data;
    }
  );
};
const changeRange = (value: [string, string] | null) => {
  const days = value
    ? (Date.parse(`${value[1]}T00:00:00Z`) -
        Date.parse(`${value[0]}T00:00:00Z`)) /
        86400000 +
      1
    : 0;
  if (!value || !Number.isFinite(days) || days < 1 || days > 92) {
    range.value = [...validRange];
    message("请选择不超过 92 天的日期范围", { type: "warning" });
    return;
  }
  validRange = [...value];
  void load();
};
const providerName = (id: string) =>
  props.providers.find(item => item.id === id)?.name || id;
const amount = (currency: string, micro: number) =>
  `${(micro / 1000000).toFixed(4)} ${currency === "CNY" ? "元" : currency}`;
const costs = (items: UsageCost[]) =>
  items.length
    ? items.map(item => amount(item.currency, item.amountMicro))
    : ["—"];
const duration = (ms: number | null) =>
  ms == null ? "—" : `${Math.round(ms)} ms`;
const durationSeconds = (ms: number | null) =>
  ms == null ? "—" : `${(ms / 1000).toFixed(1)} 秒`;
const nearTimeout = (ms: number | null, timeoutSeconds: number | null) =>
  ms != null && timeoutSeconds != null && ms >= timeoutSeconds * 800;
const timeoutResult = (timeoutSeconds: number | null) =>
  timeoutSeconds == null ? "超时" : `超时（等满 ${timeoutSeconds} 秒）`;
const errorHint = (code: string | null) => {
  if (!code) return "";
  if (/^PROVIDER_HTTP_(401|403)$/.test(code)) return "密钥或权限";
  if (code === "PROVIDER_HTTP_429") return "限流或额度";
  if (/^PROVIDER_HTTP_5\d\d$/.test(code)) return "上游故障";
  if (code === "PROVIDER_TIMEOUT") return "超时：等满了等待上限还没返回";
  if (code === "PROVIDER_CONNECT_TIMEOUT") return "超时";
  if (code === "PROVIDER_CONNECTION_FAILED") return "连接失败";
  return "";
};
const chart = computed<EChartsOption>(() => {
  const daily = data.value?.daily ?? [];
  const currencies = [
    ...new Set(daily.flatMap(day => day.costs.map(cost => cost.currency)))
  ];
  return {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: {
      left: 55,
      right: Math.max(55, currencies.length * 65),
      top: 30,
      bottom: 65
    },
    xAxis: { type: "category", data: daily.map(day => day.date) },
    yAxis: [
      { type: "value", name: "次数", minInterval: 1 },
      ...currencies.map((currency, index) => ({
        type: "value" as const,
        name: currency === "CNY" ? "元" : currency,
        position: "right" as const,
        offset: index * 65
      }))
    ],
    series: [
      { name: "调用次数", type: "line", data: daily.map(day => day.calls) },
      { name: "失败次数", type: "line", data: daily.map(day => day.failed) },
      ...currencies.map((currency, index) => ({
        name: `费用（${currency === "CNY" ? "元" : currency}）`,
        type: "bar" as const,
        yAxisIndex: index + 1,
        data: daily.map(
          day =>
            (day.costs.find(cost => cost.currency === currency)?.amountMicro ??
              0) / 1000000
        )
      }))
    ]
  };
});
onMounted(() => {
  void load();
});
</script>

<template>
  <div class="usage-page space-y-4">
    <div class="filters">
      <el-date-picker
        v-model="range"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        :clearable="false"
        @change="changeRange"
      />
      <el-select v-model="capability" placeholder="全部能力" @change="load">
        <el-option label="全部能力" value="" />
        <el-option
          v-for="(name, key) in names"
          :key="key"
          :label="name"
          :value="key"
        />
      </el-select>
      <el-select
        v-model="providerId"
        placeholder="全部服务商"
        filterable
        @change="load"
      >
        <el-option label="全部服务商" value="" />
        <el-option
          v-for="provider in providers"
          :key="provider.id"
          :label="provider.name"
          :value="provider.id"
        />
      </el-select>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>
    <p class="text-xs text-gray-500">
      只统计真实发给上游的请求。费用是调用时按成本价折算的快照，没有成本价的模型不计价。
    </p>
    <ClosetUnavailable v-if="unavailable" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <div v-if="loading" class="text-sm text-gray-500">正在加载调用数据…</div>
    <template v-if="data">
      <div class="summary-grid">
        <el-card
          ><div class="text-gray-500">调用次数</div>
          <template v-if="data.totals.calls"
            ><div class="metric">{{ data.totals.calls }}</div>
            <div class="text-xs text-gray-500">
              上游请求 {{ data.totals.requests }} 次
            </div></template
          ><el-empty v-else description="这段时间没有调用记录" :image-size="48"
        /></el-card>
        <el-card
          ><div class="text-gray-500">成功率</div>
          <template v-if="data.totals.calls"
            ><div class="metric">{{ percent(data.totals.successRate) }}</div>
            <div class="text-xs text-gray-500">
              失败 {{ data.totals.failed }} 次
            </div></template
          ><el-empty v-else description="这段时间没有调用记录" :image-size="48"
        /></el-card>
        <el-card
          ><div class="text-gray-500">Token（输入 / 输出）</div>
          <div v-if="data.totals.calls" class="metric">
            {{ data.totals.inputTokens }} / {{ data.totals.outputTokens }}
          </div>
          <el-empty v-else description="这段时间没有调用记录" :image-size="48"
        /></el-card>
        <el-card
          ><div class="text-gray-500">出图张数</div>
          <div v-if="data.totals.calls" class="metric">
            {{ data.totals.images }}
          </div>
          <el-empty v-else description="这段时间没有调用记录" :image-size="48"
        /></el-card>
        <el-card
          ><div class="text-gray-500">费用</div>
          <div v-if="data.totals.calls" class="metric">
            <div v-for="cost in costs(data.totals.costs)" :key="cost">
              {{ cost }}
            </div>
          </div>
          <el-empty v-else description="这段时间没有调用记录" :image-size="48"
        /></el-card>
        <el-card
          ><div class="text-gray-500">未计价调用</div>
          <template v-if="data.totals.calls"
            ><div class="metric">{{ data.totals.unpricedCalls }}</div>
            <div v-if="data.totals.unpricedCalls" class="text-xs warning">
              有
              {{ data.totals.unpricedCalls }}
              次调用没有成本价，去收费后台的成本价里给对应模型加价格。
            </div></template
          ><el-empty v-else description="这段时间没有调用记录" :image-size="48"
        /></el-card>
      </div>
      <el-card>
        <template #header
          ><div>
            <h2 class="text-base">按服务商</h2>
            <p class="text-xs text-gray-500">同一个服务商下所有模型的合计</p>
          </div></template
        >
        <el-table v-if="data.byProvider.length" :data="data.byProvider">
          <el-table-column label="服务商" min-width="130"
            ><template #default="{ row }">{{
              row.providerName || providerName(row.providerId)
            }}</template></el-table-column
          >
          <el-table-column prop="calls" label="调用" /><el-table-column
            label="成功率"
            ><template #default="{ row }">{{
              percent(row.successRate)
            }}</template></el-table-column
          >
          <el-table-column prop="failed" label="失败" /><el-table-column
            prop="inputTokens"
            label="输入 Token"
            min-width="110"
          /><el-table-column
            prop="outputTokens"
            label="输出 Token"
            min-width="110"
          /><el-table-column prop="images" label="出图" />
          <el-table-column label="费用" min-width="130"
            ><template #default="{ row }"
              ><div v-for="cost in costs(row.costs)" :key="cost">
                {{ cost }}
              </div></template
            ></el-table-column
          >
          <el-table-column label="最近调用" min-width="170"
            ><template #default="{ row }">{{
              formatTime(row.lastCallAtMs)
            }}</template></el-table-column
          > </el-table
        ><el-empty v-else description="这段时间没有调用记录" />
      </el-card>
      <el-card><template #header><div><h2 class="text-base">按池</h2><p class="text-xs text-gray-500">查看各模型池的调用次数和费用；没有调用时为空。</p></div></template><el-table :data="data.byPool || []" empty-text="这段时间没有模型池调用"><el-table-column prop="pool" label="池" /><el-table-column prop="calls" label="调用次数" /><el-table-column label="费用"><template #default="{ row }">{{ costs(row.costs).join('、') }}</template></el-table-column></el-table></el-card>
      <el-card><template #header><div><h2 class="text-base">按档位</h2><p class="text-xs text-gray-500">请求档位与实际档位不同的调用为降级。</p></div></template><el-table :data="data.byTier || []" empty-text="这段时间没有档位调用"><el-table-column label="请求 → 实际"><template #default="{ row }">{{ row.tierRequested }} → {{ row.tierUsed || '—' }}</template></el-table-column><el-table-column prop="calls" label="次数" /><el-table-column label="降级次数"><template #default="{ row }">{{ row.degraded ? row.calls : 0 }}</template></el-table-column><el-table-column label="费用"><template #default="{ row }">{{ costs(row.costs).join('、') }}</template></el-table-column></el-table></el-card>
      <el-card><template #header><div><h2 class="text-base">调用决定</h2><p class="text-xs text-gray-500">查看首发、改道、重发和降级的次数与花费。</p></div></template><el-table :data="data.decisions || []" empty-text="这段时间没有调用决定"><el-table-column label="决定"><template #default="{ row }">{{ ({ FIRST: '首发', REROUTE: '改道', RESEND: '重发', DEGRADE: '降级' } as Record<string, string>)[row.decision] || row.decision }}</template></el-table-column><el-table-column prop="calls" label="次数" /><el-table-column label="费用"><template #default="{ row }">{{ costs(row.costs).join('、') }}</template></el-table-column></el-table></el-card>
      <el-card><template #header><div><h2 class="text-base">探活花费</h2><p class="text-xs text-gray-500">免费和付费探活分别统计；未调用时为零。</p></div></template><div v-for="kind in (['free', 'paid'] as const)" :key="kind">{{ kind === 'free' ? '免费' : '付费' }}：{{ data.probe?.[kind]?.calls || 0 }} 次，{{ costs(data.probe?.[kind]?.costs || []).join('、') }}</div></el-card>
      <el-card>
        <template #header
          ><div>
            <h2 class="text-base">按模型</h2>
            <p class="text-xs text-gray-500">
              一行是一个服务商的一个模型；改用备用的调用单独计数
            </p>
          </div></template
        >
        <el-table v-if="data.byModel.length" :data="data.byModel">
          <el-table-column label="模型" min-width="180"
            ><template #default="{ row }"
              >{{ row.label || row.model }}
              <div class="text-xs text-gray-500">
                {{ providerName(row.providerId) }} ·
                {{ names[row.capability as Capability] || row.capability }}
              </div></template
            ></el-table-column
          >
          <el-table-column prop="calls" label="调用" /><el-table-column
            label="成功率"
            min-width="85"
            ><template #default="{ row }"
              ><span
                :class="{
                  danger: row.successRate != null && row.successRate < 0.9
                }"
                >{{ percent(row.successRate) }}</span
              ></template
            ></el-table-column
          >
          <el-table-column label="确定没执行失败率" min-width="150"><template #default="{ row }">{{ percent(row.notExecutedRate) }}</template></el-table-column>
          <el-table-column label="可能已执行失败率" min-width="150"><template #default="{ row }">{{ percent(row.maybeExecutedRate) }}</template></el-table-column>
          <el-table-column label="平均耗时" min-width="100"
            ><template #default="{ row }">{{
              duration(row.avgLatencyMs)
            }}</template></el-table-column
          ><el-table-column label="P95 耗时" min-width="190"
            ><template #default="{ row }">
              <el-tooltip
                :disabled="!nearTimeout(row.p95LatencyMs, row.timeoutSeconds)"
                content="接近超时上限，建议调大该模型的等待上限，或换更快的模型。"
                placement="top"
              >
                <span
                  :class="{
                    'timeout-warning': nearTimeout(
                      row.p95LatencyMs,
                      row.timeoutSeconds
                    )
                  }"
                >
                  {{ durationSeconds(row.p95LatencyMs)
                  }}<template v-if="row.timeoutSeconds != null">
                    / 上限 {{ row.timeoutSeconds }} 秒</template
                  >
                </span>
              </el-tooltip>
            </template></el-table-column
          >
          <el-table-column label="Token（输入/输出）" min-width="150"
            ><template #default="{ row }"
              >{{ row.inputTokens }} / {{ row.outputTokens }}</template
            ></el-table-column
          ><el-table-column prop="images" label="出图" />
          <el-table-column label="费用" min-width="130"
            ><template #default="{ row }"
              ><div v-for="cost in costs(row.costs)" :key="cost">
                {{ cost }}
              </div></template
            ></el-table-column
          ><el-table-column
            prop="unpricedCalls"
            label="未计价"
            min-width="80"
          /><el-table-column
            prop="reroutedCalls"
            label="改用备用"
            min-width="90"
          />
          <el-table-column
            prop="stitchedCalls"
            label="拼图次数"
            min-width="90"
          />
          <el-table-column label="最近调用" min-width="170"
            ><template #default="{ row }">{{
              formatTime(row.lastCallAtMs)
            }}</template></el-table-column
          > </el-table
        ><el-empty v-else description="这段时间没有调用记录" />
      </el-card>
      <el-card>
        <template #header
          ><div>
            <h2 class="text-base">每日趋势</h2>
            <p class="text-xs text-gray-500">按北京时间分日</p>
          </div></template
        >
        <ChartView
          v-if="data.totals.calls"
          :option="chart"
          :height="320"
        /><el-empty v-else description="这段时间没有调用记录" />
      </el-card>
      <el-card>
        <template #header
          ><div>
            <h2 class="text-base">错误排行</h2>
            <p class="text-xs text-gray-500">
              失败最多的错误码，帮助判断是密钥、额度还是上游故障
            </p>
          </div></template
        >
        <el-table v-if="data.errors.length" :data="data.errors">
          <el-table-column label="服务商" min-width="130"
            ><template #default="{ row }">{{
              providerName(row.providerId)
            }}</template></el-table-column
          ><el-table-column prop="model" label="模型" min-width="160" />
          <el-table-column label="错误码" min-width="220"
            ><template #default="{ row }"
              >{{ row.errorCode ?? "—"
              }}<span
                v-if="errorHint(row.errorCode)"
                class="text-xs text-gray-500"
              >
                · {{ errorHint(row.errorCode) }}</span
              ></template
            ></el-table-column
          ><el-table-column prop="count" label="次数" /><el-table-column
            label="最近一次"
            min-width="170"
            ><template #default="{ row }">{{
              formatTime(row.lastAtMs)
            }}</template></el-table-column
          > </el-table
        ><el-empty v-else description="这段时间没有调用记录" />
      </el-card>
      <el-card>
        <template #header
          ><div>
            <h2 class="text-base">最近调用</h2>
            <p class="text-xs text-gray-500">最近 50 次，不含提示词和图片</p>
          </div></template
        >
        <el-table v-if="data.recent.length" :data="data.recent">
          <el-table-column label="时间" min-width="170"
            ><template #default="{ row }">{{
              formatTime(row.atMs)
            }}</template></el-table-column
          ><el-table-column label="能力" min-width="75"
            ><template #default="{ row }">{{
              names[row.capability as Capability] || row.capability
            }}</template></el-table-column
          >
          <el-table-column label="服务商" min-width="120"
            ><template #default="{ row }">{{
              providerName(row.providerId)
            }}</template></el-table-column
          ><el-table-column
            prop="model"
            label="模型"
            min-width="150"
          /><el-table-column label="用途" min-width="120"
            ><template #default="{ row }">{{
              purposes[row.purpose] || row.purpose
            }}</template></el-table-column
          >
          <el-table-column label="结果" min-width="160"
            ><template #default="{ row }"
              >{{
                row.errorCode === "PROVIDER_TIMEOUT"
                  ? timeoutResult(row.timeoutSeconds)
                  : row.outcome === "OK"
                    ? "成功"
                    : row.outcome === "FAILED"
                      ? `失败${row.errorCode ? `（${row.errorCode}）` : ""}`
                      : row.outcome === "CANCELLED"
                        ? "用户中止"
                        : row.outcome
              }}
              <el-tag v-if="row.rerouted" size="small" type="warning"
                >备用</el-tag
              ><el-tag v-if="row.stitched > 0" size="small" type="info"
                >拼图 {{ row.stitched }} 张</el-tag
              ></template
            ></el-table-column
          >
          <el-table-column label="耗时" min-width="90"
            ><template #default="{ row }">{{
              durationSeconds(row.latencyMs)
            }}</template></el-table-column
          ><el-table-column label="Token（输入/输出）" min-width="145"
            ><template #default="{ row }"
              >{{ row.inputTokens ?? "—" }} /
              {{ row.outputTokens ?? "—" }}</template
            ></el-table-column
          ><el-table-column prop="images" label="出图" />
          <el-table-column label="费用" min-width="130"
            ><template #default="{ row }">{{
              row.costMicro == null || !row.costCurrency
                ? "未计价"
                : amount(row.costCurrency, row.costMicro)
            }}</template></el-table-column
          > </el-table
        ><el-empty v-else description="这段时间没有调用记录" />
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.filters :deep(.el-select) {
  width: 160px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.metric {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.warning {
  margin-top: 8px;
  color: var(--el-color-warning);
}

.danger {
  color: var(--el-color-danger);
}

.timeout-warning {
  color: var(--el-color-warning);
}

@media (width <= 1200px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width <= 700px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
