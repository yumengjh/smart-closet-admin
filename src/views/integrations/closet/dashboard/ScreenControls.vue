<script setup lang="ts">
import RefreshIcon from "~icons/ri/refresh-line";
import FullscreenIcon from "~icons/ri/fullscreen-line";
import MenuIcon from "~icons/ri/menu-2-line";

defineProps<{ loading: boolean; updatedAt: string }>();
defineEmits<{ refresh: []; fullscreen: []; auto: [value: boolean] }>();
const auto = defineModel<boolean>({ required: true });
</script>

<template>
  <el-popover
    placement="bottom-end"
    trigger="click"
    :width="260"
    :show-arrow="false"
  >
    <template #reference>
      <button class="screen-control" type="button" aria-label="大屏设置与操作">
        <MenuIcon />
      </button>
    </template>
    <div class="control-body">
      <h3>鱼搭业务大屏</h3>
      <p>衣柜、搭配与推荐的实时概览</p>
      <p class="updated">更新于 {{ updatedAt }}</p>
      <el-switch
        v-model="auto"
        active-text="自动刷新"
        aria-label="自动刷新大屏"
        @change="$emit('auto', auto)"
      />
      <div class="actions">
        <el-button
          :icon="RefreshIcon"
          :loading="loading"
          @click="$emit('refresh')"
          >刷新</el-button
        >
        <el-button :icon="FullscreenIcon" @click="$emit('fullscreen')"
          >全屏</el-button
        >
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.screen-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 16px;
  color: var(--screen-sub);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition:
    color 0.2s,
    border-color 0.2s;
}

.screen-control:hover,
.screen-control:focus-visible {
  color: var(--screen-strong);
  outline: none;
  background: var(--screen-chip);
}

.control-body h3 {
  font-size: 15px;
  font-weight: 600;
}

.control-body p {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.control-body .updated {
  margin-bottom: 14px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
</style>
