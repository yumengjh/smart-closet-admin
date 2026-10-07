<script setup lang="ts">
import type { EChartsOption } from "echarts";
import type { WardrobeInsight } from "@/api/closet/insights";
import { closetFamilyLabel } from "@/api/closet/insights";
import ChartView from "./ChartView.vue";
import { computed } from "vue";

const props = defineProps<{ wardrobe: WardrobeInsight }>();
const palette = [
  "--el-color-primary",
  "--el-color-success",
  "--el-color-warning",
  "--el-color-danger",
  "--el-color-info"
]
  .map(token =>
    getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  )
  .filter(Boolean);
const categoryOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "item", formatter: "{b}: {c} 件（{d}%）" },
  legend: { bottom: 0, type: "scroll" },
  color: palette,
  series: [
    {
      type: "pie",
      radius: ["42%", "70%"],
      center: ["50%", "45%"],
      avoidLabelOverlap: true,
      label: { formatter: "{b}\n{c}" },
      data: props.wardrobe.categories.map(item => ({
        name: closetFamilyLabel(item.key),
        value: item.count
      }))
    }
  ]
}));
const colorOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  grid: { left: 90, right: 20, top: 12, bottom: 16 },
  xAxis: { type: "value", minInterval: 1 },
  yAxis: {
    type: "category",
    data: [...props.wardrobe.colors].reverse().map(item => item.key),
    axisLabel: { width: 72, overflow: "truncate" }
  },
  series: [
    {
      type: "bar",
      data: [...props.wardrobe.colors].reverse().map(item => item.count),
      itemStyle: { color: palette[0] ?? "#409eff" },
      label: { show: true, position: "right" }
    }
  ]
}));
const seasonOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  grid: { left: 80, right: 24, top: 12, bottom: 16 },
  xAxis: { type: "value", minInterval: 1 },
  yAxis: {
    type: "category",
    data: [...props.wardrobe.seasons].reverse().map(item => item.key)
  },
  series: [
    {
      type: "bar",
      data: [...props.wardrobe.seasons].reverse().map(item => item.count),
      itemStyle: { color: palette[1] ?? "#67c23a" },
      label: { show: true, position: "right" }
    }
  ]
}));
</script>

<template>
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
    <el-card shadow="never"
      ><template #header>品类构成</template
      ><ChartView :option="categoryOption" :height="300" />
      <p class="mt-2 text-sm text-gray-500">
        有效衣物 {{ wardrobe.totalActive }} 件，未识别品类
        {{ wardrobe.unknownCategoryCount }} 件
      </p></el-card
    >
    <el-card shadow="never"
      ><template #header>颜色分布</template
      ><ChartView :option="colorOption" :height="300" />
      <p class="mt-2 text-sm text-gray-500">
        仅展示常见颜色，尾部计入“其他”。
      </p></el-card
    >
    <el-card shadow="never"
      ><template #header>季节分布</template
      ><ChartView :option="seasonOption" :height="300" />
      <p class="mt-2 text-sm text-gray-500">
        未识别季节 {{ wardrobe.unknownSeasonCount }} 件
      </p></el-card
    >
  </div>
</template>
