import type { EChartsOption } from "echarts";

// Business series use the same colors on the dashboard and insight pages.
export const chartPalette = [
  "#3488e8",
  "#22a99a",
  "#e9a445",
  "#8a78d6",
  "#e37781",
  "#7894ad"
];
export const number = (value: number | null | undefined) =>
  value?.toLocaleString() ?? "—";
export const sourceLabel = (key: string) =>
  ({
    INSPIRATION: "今日灵感",
    PAGE: "推荐页面",
    AGENT: "智能助手",
    SWAP: "换一件",
    MORE: "换一批",
    today: "今日灵感",
    agent: "智能助手",
    manual: "手动搭配",
    recommendation: "搭配推荐",
    engine: "推荐引擎",
    template: "模板推荐",
    rule: "规则推荐"
  })[key] ?? key;

export const featureLabel = (key: string) =>
  ({
    AGENT: "智能助手",
    OOTD_EXTRACT: "穿搭样本提取",
    RECOGNITION: "衣物识别"
  })[key] ?? key;

export function lineChart(
  buckets: string[],
  series: { name: string; values: number[] }[]
): EChartsOption {
  return {
    color: chartPalette,
    tooltip: { trigger: "axis" },
    legend: {
      type: "scroll",
      bottom: 0,
      icon: "roundRect",
      itemWidth: 14,
      itemHeight: 4,
      itemGap: 20
    },
    grid: {
      left: 12,
      right: 16,
      top: 24,
      bottom: 48,
      outerBoundsMode: "same",
      outerBoundsContain: "axisLabel"
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: buckets,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { hideOverlap: true, margin: 16 }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      splitLine: { lineStyle: { type: "dashed" } }
    },
    series: series.map((item, index) => ({
      name: item.name,
      type: "line",
      smooth: false,
      showSymbol: buckets.length < 3,
      symbolSize: 7,
      lineStyle: { width: 2.5 },
      areaStyle: {
        color: chartPalette[index % chartPalette.length],
        opacity: index === 0 ? 0.09 : 0.025
      },
      emphasis: { focus: "series" },
      data: item.values
    }))
  };
}

export function donutChart(
  data: { name: string; value: number }[],
  title: string,
  value?: string
): EChartsOption {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return {
    color: chartPalette,
    tooltip: { trigger: "item", formatter: "{b}：{c}（{d}%）" },
    legend: {
      bottom: 0,
      type: "scroll",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8
    },
    title: {
      text: total ? (value ?? number(total)) : "—",
      subtext: total ? title : "暂无数据",
      left: "center",
      top: "32%",
      textStyle: { fontSize: 28, fontWeight: 600 },
      subtextStyle: { fontSize: 12 }
    },
    series: [
      {
        type: "pie",
        radius: ["57%", "76%"],
        center: ["50%", "43%"],
        label: { show: false },
        itemStyle: { borderRadius: 5, borderWidth: 3 },
        emphasis: { scaleSize: 3 },
        stillShowZeroSum: false,
        data: data.filter(item => item.value > 0)
      }
    ]
  };
}

export function barChart(
  labels: string[],
  series: { name: string; values: number[] }[],
  stacked = false
): EChartsOption {
  return {
    color: chartPalette,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend:
      series.length > 1
        ? { bottom: 0, icon: "circle", itemWidth: 8, itemHeight: 8 }
        : undefined,
    grid: {
      left: 12,
      right: 32,
      top: 12,
      bottom: series.length > 1 ? 40 : 12,
      outerBoundsMode: "same",
      outerBoundsContain: "axisLabel"
    },
    xAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { type: "dashed" } },
      axisLabel: { hideOverlap: true }
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: labels,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { width: 94, overflow: "truncate" }
    },
    series: series.map(item => ({
      name: item.name,
      type: "bar",
      stack: stacked ? "total" : undefined,
      barMaxWidth: 16,
      itemStyle: { borderRadius: 3 },
      label: { show: series.length === 1, position: "right" },
      emphasis: { focus: "series" },
      data: item.values
    }))
  };
}
