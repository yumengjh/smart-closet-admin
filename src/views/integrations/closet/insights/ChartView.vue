<script setup lang="ts">
import echarts from "@/plugins/echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { EChartsOption } from "echarts";

const props = defineProps<{ option: EChartsOption; height?: number }>();
const host = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | undefined;
let observer: ResizeObserver | undefined;
watch(
  () => props.option,
  option => chart?.setOption(option, true),
  { deep: true }
);
onMounted(() => {
  if (!host.value) return;
  chart = echarts.init(host.value);
  chart.setOption(props.option);
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(host.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>

<template>
  <div ref="host" class="w-full" :style="{ height: `${height ?? 280}px` }" />
</template>
