<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  value: number | null | undefined;
  /** Shown as a percentage of a 0–1 ratio. */
  percent?: boolean;
  /** Bump to count up from zero again (e.g. after a data refresh). */
  replay?: number;
}>();
const shown = ref(0);
let frame = 0;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const run = (fromZero: boolean) => {
  cancelAnimationFrame(frame);
  const target = props.value;
  if (target == null) return;
  if (reduced()) {
    shown.value = target;
    return;
  }
  const from = fromZero ? 0 : shown.value;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / 1100);
    shown.value = from + (target - from) * (1 - Math.pow(1 - t, 4));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
};
watch(
  () => props.value,
  () => run(false),
  { immediate: true }
);
watch(
  () => props.replay,
  () => run(true)
);
onBeforeUnmount(() => cancelAnimationFrame(frame));
const text = () =>
  props.value == null
    ? "—"
    : props.percent
      ? `${(shown.value * 100).toFixed(1)}%`
      : Math.round(shown.value).toLocaleString();
</script>

<template>
  <span>{{ text() }}</span>
</template>
