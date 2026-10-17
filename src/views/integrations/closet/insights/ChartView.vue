<script setup lang="ts">
import echarts from "@/plugins/echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { EChartsOption } from "echarts";

const props = defineProps<{ option: EChartsOption; height?: number }>();
const host = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | undefined;
let observer: ResizeObserver | undefined;
let themeObserver: MutationObserver | undefined;
const render = () => {
  if (!host.value?.clientWidth || !host.value.clientHeight) return;
  chart?.dispose();
  const css = getComputedStyle(document.documentElement);
  const color = css.getPropertyValue("--el-text-color-secondary").trim();
  const border = css.getPropertyValue("--el-border-color-lighter").trim();
  const background = css.getPropertyValue("--el-bg-color-overlay").trim();
  const axis = {
    axisLabel: { color },
    splitLine: { lineStyle: { color: border } }
  };
  chart = echarts.init(host.value, {
    textStyle: { color, fontFamily: css.fontFamily },
    title: {
      textStyle: {
        color: css.getPropertyValue("--el-text-color-primary").trim()
      },
      subtextStyle: { color }
    },
    legend: { textStyle: { color } },
    categoryAxis: axis,
    valueAxis: axis,
    pie: { itemStyle: { borderColor: background } },
    tooltip: {
      backgroundColor: background,
      borderColor: border,
      textStyle: {
        color: css.getPropertyValue("--el-text-color-primary").trim()
      },
      extraCssText: "border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.08)"
    }
  });
  chart.setOption({
    animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    animationDuration: 250,
    animationDurationUpdate: 250,
    ...props.option
  });
};
watch(
  () => props.option,
  option =>
    chart?.setOption(
      {
        animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        animationDuration: 250,
        animationDurationUpdate: 250,
        ...option
      },
      true
    ),
  { deep: true }
);
onMounted(() => {
  if (!host.value) return;
  render();
  themeObserver = new MutationObserver(render);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"]
  });
  observer = new ResizeObserver(() => {
    if (chart) chart.resize();
    else render();
  });
  observer.observe(host.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  themeObserver?.disconnect();
  chart?.dispose();
});
</script>

<template>
  <div ref="host" class="w-full" :style="{ height: `${height ?? 280}px` }" />
</template>
