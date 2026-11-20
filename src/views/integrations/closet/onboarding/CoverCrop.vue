<script setup lang="ts">
import { computed, ref, watch, watchEffect } from "vue";

const props = defineProps<{
  source: HTMLImageElement;
  styleName: string;
  disabled: boolean;
}>();

const ratio = 4 / 3;
const editor = ref<HTMLCanvasElement>();
const preview = ref<HTMLCanvasElement>();
const zoom = ref(100);
const center = ref({ x: 0.5, y: 0.5 });
let drag: { id: number; x: number; y: number } | undefined;

const crop = computed(() => {
  const { naturalWidth, naturalHeight } = props.source;
  const width =
    (Math.min(naturalWidth, naturalHeight * ratio) * 100) / zoom.value;
  const height = width / ratio;
  return {
    width,
    height,
    x: clamp(center.value.x * naturalWidth - width / 2, naturalWidth - width),
    y: clamp(
      center.value.y * naturalHeight - height / 2,
      naturalHeight - height
    )
  };
});

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
}

function reset() {
  center.value = { x: 0.5, y: 0.5 };
  zoom.value = 100;
  drag = undefined;
}

function pan(dx: number, dy: number, canvas: HTMLCanvasElement) {
  const { width, height } = canvas.getBoundingClientRect();
  const { x, y, width: cropWidth, height: cropHeight } = crop.value;
  const { naturalWidth, naturalHeight } = props.source;
  center.value = {
    x:
      (clamp(x - (dx * cropWidth) / width, naturalWidth - cropWidth) +
        cropWidth / 2) /
      naturalWidth,
    y:
      (clamp(y - (dy * cropHeight) / height, naturalHeight - cropHeight) +
        cropHeight / 2) /
      naturalHeight
  };
}

function startDrag(event: PointerEvent) {
  if (props.disabled || drag || event.button !== 0) return;
  const canvas = event.currentTarget as HTMLCanvasElement;
  canvas.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
}

function moveDrag(event: PointerEvent) {
  if (props.disabled || drag?.id !== event.pointerId) return;
  pan(
    event.clientX - drag.x,
    event.clientY - drag.y,
    event.currentTarget as HTMLCanvasElement
  );
  drag.x = event.clientX;
  drag.y = event.clientY;
}

function endDrag(event: PointerEvent) {
  if (drag?.id === event.pointerId) drag = undefined;
}

function wheelZoom(event: WheelEvent) {
  if (props.disabled) return;
  const step = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? 0.25 : 5;
  zoom.value =
    100 + clamp(Math.round(zoom.value - event.deltaY * step) - 100, 300);
}

function keyPan(event: KeyboardEvent) {
  if (props.disabled) return;
  const movements: Record<string, [number, number]> = {
    ArrowLeft: [-12, 0],
    ArrowRight: [12, 0],
    ArrowUp: [0, -12],
    ArrowDown: [0, 12]
  };
  const movement = movements[event.key];
  if (!movement) return;
  event.preventDefault();
  pan(...movement, event.currentTarget as HTMLCanvasElement);
}

function render(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const { x, y, width, height } = crop.value;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    props.source,
    x,
    y,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height
  );
}

function exportJpeg(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(
    4,
    Math.floor(Math.min(1200, crop.value.width) / 4) * 4
  );
  canvas.height = (canvas.width * 3) / 4;
  render(canvas);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob)
          resolve(new File([blob], "style-cover.jpg", { type: "image/jpeg" }));
        else reject(new Error("封面编码失败"));
      },
      "image/jpeg",
      0.9
    );
  });
}

watch(() => props.source, reset);
watchEffect(
  () => {
    if (editor.value) render(editor.value);
    if (preview.value) render(preview.value);
  },
  { flush: "post" }
);

defineExpose({ exportJpeg });
</script>

<template>
  <div class="crop-layout">
    <div class="crop-controls">
      <canvas
        ref="editor"
        class="crop-frame"
        width="640"
        height="480"
        tabindex="0"
        aria-label="4:3 裁剪区域，使用方向键移动图片"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @lostpointercapture="endDrag"
        @wheel.prevent="wheelZoom"
        @keydown="keyPan"
      />
      <p class="crop-hint">拖动图片调整位置，滚轮或滑块缩放。</p>
      <div class="zoom-controls">
        <span>缩放</span>
        <el-slider
          v-model="zoom"
          :min="100"
          :max="400"
          :disabled="disabled"
          aria-label="图片缩放"
          :format-tooltip="value => `${value}%`"
        />
        <el-button text :disabled="disabled" @click="reset">重置</el-button>
      </div>
    </div>
    <div class="welcome-preview">
      <p>欢迎页预览</p>
      <div class="welcome-card">
        <canvas
          ref="preview"
          width="320"
          height="240"
          role="img"
          :aria-label="`${styleName}封面裁剪预览`"
        />
        <strong>{{ styleName }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crop-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 175px;
  gap: 24px;
  align-items: start;
}

.crop-frame {
  display: block;
  width: 100%;
  height: auto;
  touch-action: none;
  cursor: grab;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.crop-frame:active {
  cursor: grabbing;
}

.crop-frame:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 3px;
}

.crop-hint {
  margin: 8px 0 4px;
  color: var(--el-text-color-regular);
}

.zoom-controls {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.welcome-preview p {
  margin: 0 0 8px;
  font-weight: 600;
}

.welcome-card {
  box-sizing: border-box;
  display: grid;
  gap: 8px;
  width: 175px;
  max-width: 100%;
  padding: 8px 8px 12px;
  color: #262626;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 16px;
}

.welcome-card canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
}

.welcome-card strong {
  padding-inline: 4px;
  font-size: 15px;
  font-weight: 600;
}

@media (width <= 580px) {
  .crop-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .welcome-card {
    width: 165px;
  }
}
</style>
