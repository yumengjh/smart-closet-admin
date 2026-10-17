<script setup lang="ts">
import { lineChart } from "./chartOptions";
import {
  metricNames,
  type TrendInsight,
  type TrendMetric
} from "@/api/closet/insights";
import ChartView from "./ChartView.vue";
import { computed } from "vue";

const props = defineProps<{
  trends: TrendInsight;
  metrics: TrendMetric[];
  granularity: "day" | "week" | "month";
}>();
const emit = defineEmits<{
  "update:metrics": [value: TrendMetric[]];
  "update:granularity": [value: "day" | "week" | "month"];
}>();
const options = Object.entries(metricNames).map(([value, label]) => ({
  value,
  label
}));
const setMetrics = (value: TrendMetric[]) => {
  if (value.length) emit("update:metrics", value);
};
const setGranularity = (value: string | number | boolean) => {
  if (value === "day" || value === "week" || value === "month")
    emit("update:granularity", value);
};
const option = computed(() =>
  lineChart(
    props.trends.buckets.map(bucket =>
      bucket.length === 10 ? bucket.slice(5) : bucket
    ),
    props.trends.series.map(item => ({
      name: metricNames[item.metric],
      values: item.values
    }))
  )
);
</script>

<template>
  <el-card shadow="never">
    <template #header
      ><div class="flex flex-wrap items-center gap-3">
        <div class="mr-auto chart-heading">
          <div>
            <h3>业务趋势分析</h3>
            <p>切换指标与粒度，比较区间变化</p>
          </div>
        </div>
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
          <el-radio-button value="day">按日</el-radio-button
          ><el-radio-button value="week">按周</el-radio-button
          ><el-radio-button value="month">按月</el-radio-button>
        </el-radio-group>
      </div></template
    >
    <ChartView :option="option" :height="340" />
  </el-card>
</template>
