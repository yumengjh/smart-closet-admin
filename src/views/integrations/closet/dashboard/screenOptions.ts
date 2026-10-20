import type { EChartsOption, SeriesOption } from "echarts";

// Only the card surface follows the theme (white or near-black); charts keep their colors.
export type ScreenTheme = "light" | "dark";
type Tone = {
  text: string;
  strong: string;
  sub: string;
  line: string;
  track: string;
  surface: string;
  tooltipBg: string;
  tooltipBorder: string;
  glow: boolean;
  /** Series colors, strongest first. */
  series: string[];
  /** Slice colors for pies; more of them than series. */
  ramp: string[];
};
const tones: Record<ScreenTheme, Tone> = {
  light: {
    text: "#4b5563",
    strong: "#111827",
    sub: "#9ca3af",
    line: "rgba(0, 0, 0, 0.08)",
    track: "rgba(0, 0, 0, 0.06)",
    surface: "#ffffff",
    tooltipBg: "#ffffff",
    tooltipBorder: "rgba(0, 0, 0, 0.14)",
    glow: false,
    series: ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#e11d48"],
    ramp: [
      "#2563eb",
      "#0d9488",
      "#d97706",
      "#7c3aed",
      "#e11d48",
      "#0891b2",
      "#64748b",
      "#16a34a",
      "#db2777"
    ]
  },
  dark: {
    text: "#a9bddb",
    strong: "#eaf3ff",
    sub: "#6f86ab",
    line: "rgba(255, 255, 255, 0.1)",
    track: "rgba(255, 255, 255, 0.08)",
    surface: "#141414",
    tooltipBg: "#141414",
    tooltipBorder: "rgba(255, 255, 255, 0.2)",
    glow: true,
    series: ["#22d3ee", "#4f8cff", "#a78bfa", "#2dd4bf", "#fbbf24"],
    ramp: [
      "#22d3ee",
      "#4f8cff",
      "#a78bfa",
      "#2dd4bf",
      "#fbbf24",
      "#f472b6",
      "#8aa0c2",
      "#4ade80",
      "#fb923c"
    ]
  }
};
export const seriesColors = (theme: ScreenTheme) => tones[theme].series;

// A breathing marker on the latest point so the chart reads as live.
const rippleSeries = (color: string, values: number[]) => ({
  type: "effectScatter" as const,
  silent: true,
  z: 5,
  symbolSize: 8,
  rippleEffect: { scale: 3.2, brushType: "stroke" as const, period: 3 },
  itemStyle: { color },
  data: values.length ? [[values.length - 1, values[values.length - 1]]] : []
});

const tooltipOf = (t: Tone) => ({
  backgroundColor: t.tooltipBg,
  borderColor: t.tooltipBorder,
  textStyle: { color: t.strong, fontSize: 12 }
});
function hexAlpha(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
const gradient = (color: string, from: number, to = 0) => ({
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: hexAlpha(color, from) },
    { offset: 1, color: hexAlpha(color, to) }
  ]
});

export function trendOption(
  theme: ScreenTheme,
  buckets: string[],
  series: { name: string; values: number[] }[]
): EChartsOption {
  const t = tones[theme];
  return {
    color: t.series,
    tooltip: {
      ...tooltipOf(t),
      trigger: "axis",
      // The ripple marker is decoration only; keep it out of the tooltip.
      formatter: (params: unknown) => {
        const rows = (
          params as Array<{
            seriesType: string;
            seriesName: string;
            marker: string;
            value: number;
            axisValueLabel: string;
          }>
        ).filter(row => row.seriesType === "line");
        return `${rows[0]?.axisValueLabel ?? ""}<br/>${rows
          .map(row => `${row.marker}${row.seriesName}：${row.value}`)
          .join("<br/>")}`;
      }
    },
    legend: {
      data: series.map(item => item.name),
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 14,
      itemHeight: 4,
      itemGap: 16,
      textStyle: { color: t.text, fontSize: 12 }
    },
    // Room on the right for the ripple on the latest point.
    grid: { left: 4, right: 18, top: 30, bottom: 2, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: buckets,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.line } },
      axisLabel: { color: t.sub, hideOverlap: true }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: t.sub },
      splitLine: { lineStyle: { color: t.line, type: "dashed" } }
    },
    series: [
      ...series.map(
        (item, index): SeriesOption => ({
          name: item.name,
          type: "line",
          smooth: 0.3,
          showSymbol: buckets.length < 3,
          symbolSize: 6,
          lineStyle: {
            width: 2.2,
            shadowBlur: t.glow ? 10 : 0,
            shadowColor: hexAlpha(t.series[index % t.series.length], 0.55)
          },
          areaStyle: {
            color: gradient(
              t.series[index % t.series.length],
              index === 0 ? 0.28 : 0.08
            )
          },
          emphasis: { focus: "series" },
          data: item.values
        })
      ),
      // Ripple on the latest point of the lead series.
      ...(series[0]
        ? [{ ...rippleSeries(t.series[0], series[0].values), name: "" }]
        : [])
    ]
  };
}

export function ringOption(
  theme: ScreenTheme,
  data: { name: string; value: number }[],
  centerLabel: string
): EChartsOption {
  const t = tones[theme];
  const items = data.filter(item => item.value > 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const counts = new Map(items.map(item => [item.name, item.value]));
  return {
    color: t.ramp,
    tooltip: {
      ...tooltipOf(t),
      trigger: "item",
      formatter: "{b}：{c}（{d}%）"
    },
    legend: {
      orient: "vertical",
      right: 0,
      top: "middle",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 7,
      textStyle: { color: t.text, fontSize: 12 },
      formatter: (name: string) => `${name}  ${counts.get(name) ?? 0}`
    },
    title: {
      text: total.toLocaleString(),
      subtext: total ? centerLabel : "暂无数据",
      left: "32%",
      top: "40%",
      textAlign: "center",
      textStyle: { color: t.strong, fontSize: 24, fontWeight: 600 },
      subtextStyle: { color: t.sub, fontSize: 12 }
    },
    series: [
      {
        type: "pie",
        radius: ["50%", "68%"],
        center: ["32%", "50%"],
        label: { show: false },
        itemStyle: { borderRadius: 3, borderWidth: 2, borderColor: t.surface },
        emphasis: { scaleSize: 4 },
        data: items
      }
    ]
  };
}

// Garment color names to display swatches so the bars read as the wardrobe's actual colors.
const swatches: Array<[RegExp, string]> = [
  [/藏蓝|深蓝/, "#1e3a8a"],
  [/灰蓝/, "#64748b"],
  [/浅蓝|天蓝/, "#93c5fd"],
  [/蓝/, "#3b82f6"],
  [/米白|奶白|奶油/, "#f1e8d4"],
  [/米|杏/, "#e6d5b0"],
  [/浅灰/, "#cbd5e1"],
  [/深灰|炭/, "#475569"],
  [/灰/, "#94a3b8"],
  [/黑/, "#1a1a1a"],
  [/白/, "#fafafa"],
  [/粉/, "#f9a8d4"],
  [/红|酒/, "#ef4444"],
  [/橙/, "#fb923c"],
  [/黄/, "#facc15"],
  [/绿/, "#22c55e"],
  [/紫/, "#8b5cf6"],
  [/卡其|驼/, "#c3a572"],
  [/棕|咖|褐/, "#92613a"]
];

export function barOption(
  theme: ScreenTheme,
  items: { name: string; value: number }[],
  colorByName = false
): EChartsOption {
  const t = tones[theme];
  const swatch = (name: string, index: number) =>
    swatches.find(([pattern]) => pattern.test(name))?.[1] ??
    t.ramp[index % t.ramp.length];
  return {
    tooltip: {
      ...tooltipOf(t),
      trigger: "axis",
      axisPointer: { type: "none" }
    },
    grid: { left: 2, right: 34, top: 4, bottom: 2, containLabel: true },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      inverse: true,
      data: items.map(item => item.name),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: t.text, fontSize: 12 }
    },
    series: [
      {
        type: "bar",
        barWidth: 9,
        showBackground: true,
        backgroundStyle: { color: t.track, borderRadius: 5 },
        label: { show: true, position: "right", color: t.text, fontSize: 12 },
        data: items.map((item, index) => ({
          value: item.value,
          itemStyle: {
            borderRadius: 5,
            color: colorByName
              ? swatch(item.name, index)
              : gradient(t.ramp[index % t.ramp.length], 0.95, 0.55),
            // Pale and black swatches would vanish into the surface without an outline.
            borderColor: colorByName ? t.tooltipBorder : undefined,
            borderWidth: colorByName ? 1 : 0
          }
        }))
      }
    ]
  };
}

export function roseOption(
  theme: ScreenTheme,
  data: { name: string; value: number }[]
): EChartsOption {
  const t = tones[theme];
  const seasonColors: Record<string, string> = {
    春: theme === "dark" ? "#4ade80" : "#16a34a",
    夏: theme === "dark" ? "#22d3ee" : "#0891b2",
    秋: theme === "dark" ? "#fbbf24" : "#d97706",
    冬: theme === "dark" ? "#a78bfa" : "#7c3aed"
  };
  return {
    color: t.ramp,
    tooltip: {
      ...tooltipOf(t),
      trigger: "item",
      formatter: "{b}：{c}（{d}%）"
    },
    series: [
      {
        type: "pie",
        roseType: "area",
        radius: ["14%", "70%"],
        center: ["50%", "52%"],
        itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: t.surface },
        label: { color: t.text, fontSize: 12, formatter: "{b} {c}" },
        labelLine: { lineStyle: { color: t.line }, length: 8, length2: 8 },
        data: data
          .filter(item => item.value > 0)
          .map((item, index) => ({
            ...item,
            itemStyle: {
              color: seasonColors[item.name] ?? t.ramp[index % t.ramp.length]
            }
          }))
      }
    ]
  };
}

/** 300000 → 30万, 1500 → 1.5k: keeps value axes narrow. */
const compact = (value: number) =>
  value >= 10000
    ? `${+(value / 10000).toFixed(1)}万`
    : value >= 1000
      ? `${+(value / 1000).toFixed(1)}k`
      : `${value}`;

export function columnOption(
  theme: ScreenTheme,
  buckets: string[],
  values: number[],
  name: string
): EChartsOption {
  const t = tones[theme];
  return {
    tooltip: { ...tooltipOf(t), trigger: "axis" },
    grid: { left: 2, right: 6, top: 8, bottom: 0, containLabel: true },
    xAxis: {
      type: "category",
      data: buckets,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.line } },
      axisLabel: { color: t.sub, hideOverlap: true, fontSize: 11 }
    },
    yAxis: {
      type: "value",
      splitNumber: 3,
      axisLabel: { color: t.sub, fontSize: 11, formatter: compact },
      splitLine: { lineStyle: { color: t.line, type: "dashed" } }
    },
    series: [
      {
        name,
        type: "bar",
        barMaxWidth: 10,
        itemStyle: {
          borderRadius: [3, 3, 0, 0],
          color: gradient(t.series[2], 0.95, 0.25)
        },
        data: values
      }
    ]
  };
}

export function sparkOption(
  theme: ScreenTheme,
  values: number[],
  index: number
): EChartsOption {
  const t = tones[theme];
  const color = t.series[index % t.series.length];
  return {
    // Inset so the ripple on the last point is not clipped by the chart edge.
    grid: { left: 2, right: 14, top: 12, bottom: 4 },
    xAxis: {
      type: "category",
      show: false,
      boundaryGap: false,
      data: values.map((_, i) => i)
    },
    yAxis: { type: "value", show: false, min: 0 },
    series: [
      rippleSeries(color, values),
      {
        type: "line",
        smooth: 0.35,
        showSymbol: false,
        silent: true,
        lineStyle: {
          width: 2,
          color,
          shadowBlur: t.glow ? 8 : 0,
          shadowColor: hexAlpha(color, 0.6)
        },
        areaStyle: { color: gradient(color, 0.3) },
        data: values
      }
    ]
  };
}
