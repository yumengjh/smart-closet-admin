<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{ label: string; load: () => Promise<Blob> }>();
const anchor = ref<HTMLElement>();
const url = ref("");
const failed = ref(false);
let observer: IntersectionObserver;
let active = true;

async function loadImage() {
  try {
    const blob = await props.load();
    if (active) url.value = URL.createObjectURL(blob);
  } catch {
    if (active) failed.value = true;
  }
}
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      void loadImage();
    }
  });
  if (anchor.value) observer.observe(anchor.value);
});
onBeforeUnmount(() => {
  active = false;
  observer?.disconnect();
  if (url.value) URL.revokeObjectURL(url.value);
});
</script>

<template>
  <div ref="anchor" class="preset-image">
    <img v-if="url" :src="url" :alt="label" />
    <span v-else-if="failed">预览加载失败</span>
    <el-skeleton-item v-else variant="image" class="skeleton" />
  </div>
</template>

<style scoped>
.preset-image {
  display: grid;
  place-items: center;
  aspect-ratio: var(--preset-image-ratio, 1);
  overflow: hidden;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

img,
.skeleton {
  width: 100%;
  height: 100%;
}

img {
  object-fit: var(--preset-image-fit, contain);
}
</style>
