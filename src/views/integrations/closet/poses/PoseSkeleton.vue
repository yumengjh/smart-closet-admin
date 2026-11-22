<script setup lang="ts">
import { computed } from "vue";
import type { PoseKeypoints } from "@/api/closet/poses";
import { CANVAS, JOINTS, skeleton } from "./poseLogic";

const props = defineProps<{ keypoints: PoseKeypoints | null | undefined }>();
const shape = computed(() => skeleton(props.keypoints));
const missing = computed(() => JOINTS.length - shape.value.points.length);
</script>

<template>
  <figure class="pose-skeleton">
    <svg
      :viewBox="`0 0 ${CANVAS.width} ${CANVAS.height}`"
      role="img"
      :aria-label="
        shape.points.length
          ? `关节点预览，共 ${shape.points.length} 个点`
          : '没有关节点'
      "
    >
      <rect :width="CANVAS.width" :height="CANVAS.height" class="frame" />
      <line
        v-for="line in shape.lines"
        :key="`${line.from}-${line.to}`"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
        class="bone"
      />
      <circle
        v-for="point in shape.points"
        :key="point.joint"
        :cx="point.x"
        :cy="point.y"
        :r="point.joint === 'HEAD' ? 9 : 5"
        class="joint"
      >
        <title>{{ point.joint }}</title>
      </circle>
      <text
        v-if="!shape.points.length"
        :x="CANVAS.width / 2"
        :y="CANVAS.height / 2"
        text-anchor="middle"
        class="empty"
      >
        没有关节点
      </text>
    </svg>
    <figcaption v-if="shape.points.length && missing">
      有 {{ missing }} 个关节在图里看不到，未画出
    </figcaption>
  </figure>
</template>

<style scoped>
.pose-skeleton {
  width: min(100%, 240px);
  margin: 0;
}

svg {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
}

.frame {
  fill: var(--el-fill-color-light);
  stroke: var(--el-border-color);
}

.bone {
  stroke: var(--el-color-primary);
  stroke-width: 4;
  stroke-linecap: round;
}

.joint {
  fill: var(--el-bg-color);
  stroke: var(--el-color-primary);
  stroke-width: 3;
}

.empty {
  font-size: 14px;
  fill: var(--el-text-color-secondary);
}

figcaption {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
