<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  getMargin,
  getAlerts,
  getExplain,
  type Explain,
  type Margin,
  type ReportRow
} from "@/api/closet/billing";
import { dateRange } from "../useClosetRequest";
import BillingFrame from "./BillingFrame.vue";
import ReportTable from "./ReportTable.vue";
import { useBilling } from "./useBilling";
defineOptions({ name: "ClosetBillingMargin" });
const { can, loading, error, load } = useBilling();
const range = ref<[string, string]>(dateRange());
const report = ref<Margin>();
const explanation = ref<Explain>();
const tier = ref("image.standard");
const explainLimit = ref(100);
const explainLoading = ref(false);
const explainError = ref("");
const explainUsage = async () => {
  if (!valid.value || !can("closet:billing:read") || explainLoading.value)
    return;
  explainLoading.value = true;
  explainError.value = "";
  try {
    explanation.value = (
      await getExplain(
        tier.value,
        range.value[0],
        range.value[1],
        explainLimit.value
      )
    ).data;
  } catch {
    explanation.value = undefined;
    explainError.value = "明细暂时无法加载，请重试。";
  } finally {
    explainLoading.value = false;
  }
};
const alerts = ref<ReportRow[]>([]);
const valid = computed(
  () =>
    range.value?.length === 2 &&
    range.value[0] <= range.value[1] &&
    (Date.parse(range.value[1]) - Date.parse(range.value[0])) / 86400000 <= 366
);
const refresh = () => {
  if (!valid.value) return;
  void load(
    () => Promise.all([getMargin(range.value[0], range.value[1]), getAlerts()]),
    ([r, a]) => {
      report.value = r.data;
      alerts.value = a.data;
    }
  );
};
const reportDate = (value: number) =>
  new Date(value).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
const totals = [
  { key: "currency", label: "币种" },
  { key: "pointsRevenueMicro", label: "点数收入（元）", format: "micro" },
  { key: "subscriptionRevenueMicro", label: "订阅收入（元）", format: "micro" },
  { key: "costMicro", label: "上游成本（元）", format: "micro" },
  { key: "feeMicro", label: "手续费（元）", format: "micro" },
  { key: "profitMicro", label: "利润底线（元）", format: "micro" },
  { key: "marginRate", label: "毛利率", format: "percent" }
];
const orderLines = [
  { key: "day", label: "日期" },
  { key: "currency", label: "币种" },
  { key: "subscriptionRevenueMicro", label: "订阅收入（元）", format: "micro" },
  { key: "feeMicro", label: "手续费（元）", format: "micro" },
  { key: "feeEstimatedOrders", label: "未报手续费订单数" },
  { key: "paidOrders", label: "已支付订单数" },
  { key: "disputedOrders", label: "拒付订单数" },
  { key: "disputedMicro", label: "拒付金额（元）", format: "micro" }
];
const lines = [
  { key: "day", label: "日期" },
  { key: "tier", label: "档位" },
  { key: "uses", label: "用量次数" },
  { key: "unitsIn", label: "输入单位" },
  { key: "unitsOut", label: "输出单位" },
  { key: "pointsSpent", label: "消耗点数" },
  { key: "revenueCurrency", label: "收入币种" },
  { key: "revenueMicro", label: "收入（元）", format: "micro" },
  { key: "costCurrency", label: "成本币种" },
  { key: "costMicro", label: "成本（元）", format: "micro" },
  { key: "freeCostMicro", label: "免费用量成本（元）", format: "micro" },
  { key: "failedCostMicro", label: "失败成本（元）", format: "micro" },
  { key: "unknownCostUses", label: "成本未知次数" },
  { key: "profitMicro", label: "利润（元）", format: "micro" },
  { key: "marginRate", label: "毛利率", format: "percent" }
];
const liabilities = [
  { key: "currency", label: "币种" },
  { key: "points", label: "未消耗点数" },
  { key: "valueMicro", label: "负债金额（元）", format: "micro" }
];
const alertColumns = [
  { key: "tier", label: "档位" },
  { key: "model", label: "模型" },
  { key: "status", label: "告警状态" },
  { key: "priceMilliPoints", label: "单价（千分点）" },
  { key: "revenuePerUnitMicro", label: "单位收入（百万分之一币种）" },
  { key: "costPerUnitMicro", label: "单位成本（百万分之一币种）" },
  { key: "assumedMix", label: "使用预设输入输出占比" }
];
onMounted(() => {
  if (can("closet:billing:read")) refresh();
});
</script>
<template>
  <BillingFrame
    title="利润报表"
    :error="error"
    :loading="loading"
    @refresh="refresh"
  >
    <el-form inline
      ><el-form-item label="日期范围（Asia/Shanghai，包含结束日）"
        ><el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期" /></el-form-item
      ><el-button type="primary" :disabled="!valid" @click="refresh"
        >查询</el-button
      ></el-form
    >
    <el-alert
      v-if="!valid"
      title="请选择有效日期范围，跨度最多 366 天。"
      type="warning"
      :closable="false"
    />
    <template v-if="report">
      <p class="text-sm text-[var(--el-text-color-secondary)]">
        已加载报表范围 {{ reportDate(report.fromMs) }} 至
        {{ reportDate(report.toMs - 1) }}
      </p>
      <el-card shadow="never"
        ><h3 class="mb-3 font-semibold">各币种底线</h3>
        <p class="mb-3 text-sm text-[var(--el-text-color-secondary)]">
          金额按原币种显示，各币种分别核算。负债为当前未消耗点数。
        </p>
        <ReportTable :rows="report.totals || []" :columns="totals"
      /></el-card>
      <el-card shadow="never"
        ><h3 class="mb-3 font-semibold">订单收入与手续费</h3>
        <ReportTable :rows="report.orderLines || []" :columns="orderLines"
      /></el-card>
      <el-card shadow="never"
        ><h3 class="mb-3 font-semibold">档位用量与利润</h3>
        <ReportTable :rows="report.lines" :columns="lines"
      /></el-card>
      <el-card shadow="never"
        ><h3 class="mb-3 font-semibold">未消耗点数负债</h3>
        <ReportTable :rows="report.liabilities" :columns="liabilities"
      /></el-card>
      <el-card shadow="never"
        ><h3 class="mb-3 font-semibold">核算说明</h3>
        <ul class="list-disc space-y-2 pl-5">
          <li v-for="(note, index) in report.notes" :key="index">{{ note }}</li>
        </ul></el-card
      >
    </template>
    <el-card shadow="never">
      <h3 class="mb-3 font-semibold">利润明细追溯</h3>
      <el-form inline
        ><el-form-item label="档位"
          ><el-select v-model="tier" class="!w-48"
            ><el-option
              v-for="t in ['image.standard', 'agent.chat', 'tryon.realtime']"
              :key="t"
              :value="t"
              :label="t" /></el-select
        ></el-form-item>
        <el-form-item label="最多条数"
          ><el-input-number
            v-model="explainLimit"
            :min="1"
            :max="500"
            :precision="0"
        /></el-form-item>
        <el-button
          :disabled="!valid"
          :loading="explainLoading"
          @click="explainUsage"
          >查询明细</el-button
        >
      </el-form>
      <el-alert
        v-if="explainError"
        :title="explainError"
        type="error"
        :closable="false"
      />
      <el-table v-if="explanation" :data="explanation.items" stripe>
        <el-table-column
          prop="userKey"
          label="userKey"
          min-width="170"
        /><el-table-column prop="model" label="模型" min-width="170" />
        <el-table-column prop="source" label="来源" /><el-table-column
          prop="points"
          label="消耗点数"
        />
        <el-table-column
          prop="revenueCurrency"
          label="收入币种"
        /><el-table-column
          prop="revenueMicro"
          label="收入（百万分之一币种）"
          min-width="180"
        />
        <el-table-column prop="costCurrency" label="成本币种" /><el-table-column
          prop="costMicro"
          label="成本（百万分之一币种）"
          min-width="180"
        />
        <el-table-column label="成本版本" min-width="240"
          ><template #default="{ row }"
            ><div v-for="cost in row.costRates" :key="cost.id">
              {{ cost.id }} · {{ cost.model }} · {{ cost.unit }} ·
              {{ cost.amountMicro }} {{ cost.currency }}
            </div>
            <span v-if="!row.costRates.length">未配置成本</span></template
          ></el-table-column
        >
      </el-table>
    </el-card>
    <el-card shadow="never"
      ><h3 class="mb-3 font-semibold">价格与成本告警</h3>
      <p class="mb-3 text-sm text-[var(--el-text-color-secondary)]">
        告警反映当前价格与成本，币种与核算假设以服务端为准。
      </p>
      <ReportTable :rows="alerts" :columns="alertColumns"
    /></el-card>
  </BillingFrame>
</template>
