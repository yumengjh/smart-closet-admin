<script setup lang="ts">
import type { EChartsOption } from "echarts";
import type { TrendInsight, TrendMetric } from "@/api/closet/insights";
import ChartView from "./ChartView.vue";
import { computed } from "vue";

const props = defineProps<{
  trends: TrendInsight;
  metrics: TrendMetric[];
  granularity: "day" | "week";
}>();
const emit = defineEmits<{
  "update:metrics": [value: TrendMetric[]];
  "update:granularity": [value: "day" | "week"];
}>();
const metricNames: Record<TrendMetric, string> = {
  garments_created: "新增衣物",
  garments_adopted: "采纳衣物",
  outfits_created: "新增搭配",
  quick_intakes: "快速入柜",
  image_units: "图片处理用量",
  agent_messages: "Agent 消息",
  users_created: "新增用户"
};
const options = Object.entries(metricNames).map(([value, label]) => ({
  value,
  label
}));
const chartColors = [
  "--el-color-primary",
  "--el-color-success",
  "--el-color-warning",
  "--el-color-danger",
  "--el-color-info",
  "--el-color-primary-light-3",
  "--el-color-success-light-3"
]
  .map(token =>
    getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  )
  .filter(Boolean);
const setMetrics = (value: TrendMetric[]) => {
  if (value.length) emit("update:metrics", value);
};
const setGranularity = (value: string | number | boolean) => {
  if (value === "day" || value === "week") emit("update:granularity", value);
};
const option = computed<EChartsOption>(() => ({
  color: chartColors,
  tooltip: { trigger: "axis" },
  legend: {
    type: "scroll",
    top: 0,
    data: props.trends.series.map(item => metricNames[item.metric])
  },
  grid: { left: 52, right: 24, top: 44, bottom: 42 },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: props.trends.buckets,
    axisLabel: { hideOverlap: true }
  },
  yAxis: {
    type: "value",
    minInterval: 1,
    splitLine: { lineStyle: { type: "dashed" } }
  },
  series: props.trends.series.map(item => ({
    name: metricNames[item.metric],
    type: "line",
    smooth: false,
    showSymbol: props.trends.buckets.length < 40,
    emphasis: { focus: "series" },
    data: item.values
  }))
}));
</script>

<template>
  <el-card shadow="never">
    <template #header
      ><div class="flex flex-wrap items-center gap-3">
        <span class="mr-auto">趋势</span>
        <el-select
          :model-value="metrics"
          multiple
          collapse-tags
          :max-collapse-tags="2"
          class="!w-64"
          aria-label="趋势指标"
          @update:model-value="setMetrics"
        >
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-radio-group
          :model-value="granularity"
          @update:model-value="setGranularity"
        >
          <el-radio-button label="day">按日</el-radio-button
          ><el-radio-button label="week">按周</el-radio-button>
        </el-radio-group>
      </div></template
    >
    <ChartView :option="option" :height="340" />
  </el-card>
</template>
