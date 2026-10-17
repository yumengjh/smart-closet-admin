<script setup lang="ts">
import echarts from "@/plugins/echarts";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { EChartsOption } from "echarts";

const props = defineProps<{
  option: EChartsOption;
  /** Bump to play the entrance animation again (e.g. after a data refresh). */
  replay?: number;
  /** Walk through the data on a timer: `slice` highlights pie slices, `tip` moves the axis tooltip. */
  cycle?: "slice" | "tip";
  /** Data points to walk through. */
  count?: number;
}>();
const host = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | undefined;
let observer: ResizeObserver | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;
let step = -1;
let hovering = false;
const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
const apply = (option: EChartsOption) =>
  chart?.setOption(
    {
      animation: motion(),
      animationDuration: 900,
      animationEasing: "cubicOut",
      animationDurationUpdate: 500,
      ...option
    },
    true
  );
const mount = () => {
  if (chart || !host.value?.clientWidth || !host.value.clientHeight) return;
  chart = echarts.init(host.value);
  chart.on("mouseover", () => (hovering = true));
  chart.on("globalout", () => (hovering = false));
  apply(props.option);
};
const advance = () => {
  const total = props.count ?? 0;
  if (!chart || hovering || !total || document.hidden) return;
  if (props.cycle === "slice") {
    chart.dispatchAction({
      type: "downplay",
      seriesIndex: 0,
      dataIndex: step
    });
    step = (step + 1) % total;
    chart.dispatchAction({
      type: "highlight",
      seriesIndex: 0,
      dataIndex: step
    });
  } else {
    step = (step + 1) % total;
    chart.dispatchAction({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: step
    });
  }
};
const restart = () => {
  clearInterval(ticker);
  step = -1;
  if (props.cycle && motion())
    ticker = setInterval(advance, props.cycle === "slice" ? 2600 : 1400);
};
watch(() => props.option, apply);
watch(
  () => props.replay,
  () => {
    chart?.clear();
    apply(props.option);
  }
);
watch(() => props.cycle, restart);
onMounted(() => {
  mount();
  restart();
  observer = new ResizeObserver(() => (chart ? chart.resize() : mount()));
  if (host.value) observer.observe(host.value);
});
onBeforeUnmount(() => {
  clearInterval(ticker);
  observer?.disconnect();
  chart?.dispose();
});
</script>

<template>
  <div ref="host" class="screen-chart" />
</template>

<style scoped>
.screen-chart {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
