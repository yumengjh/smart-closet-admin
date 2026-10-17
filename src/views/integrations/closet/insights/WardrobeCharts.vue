<script setup lang="ts">
import { donutChart, barChart } from "./chartOptions";
import type { WardrobeInsight } from "@/api/closet/insights";
import { closetFamilyLabel } from "@/api/closet/insights";
import ChartView from "./ChartView.vue";
import { computed } from "vue";

const props = defineProps<{ wardrobe: WardrobeInsight }>();
const categoryOption = computed(() =>
  donutChart(
    props.wardrobe.categories.map(item => ({
      name: closetFamilyLabel(item.key),
      value: item.count
    })),
    "有效衣物"
  )
);
const colorOption = computed(() =>
  barChart(
    props.wardrobe.colors.map(item => item.key),
    [{ name: "衣物", values: props.wardrobe.colors.map(item => item.count) }]
  )
);
const seasonOption = computed(() =>
  barChart(
    props.wardrobe.seasons.map(item => item.key),
    [{ name: "衣物", values: props.wardrobe.seasons.map(item => item.count) }]
  )
);
</script>

<template>
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
    <el-card shadow="never"
      ><template #header>品类构成</template
      ><ChartView :option="categoryOption" :height="300" />
      <p class="mt-2 analytics-note">
        有效衣物 {{ wardrobe.totalActive }} 件，未识别品类
        {{ wardrobe.unknownCategoryCount }} 件
      </p></el-card
    >
    <el-card shadow="never"
      ><template #header>颜色分布</template
      ><ChartView :option="colorOption" :height="300" />
      <p class="mt-2 analytics-note">
        仅展示常见颜色，尾部计入“其他”。
      </p></el-card
    >
    <el-card shadow="never"
      ><template #header>季节分布</template
      ><ChartView :option="seasonOption" :height="300" />
      <p class="mt-2 analytics-note">
        未识别季节 {{ wardrobe.unknownSeasonCount }} 件
      </p></el-card
    >
  </div>
</template>
