<script setup lang="ts">
import { computed } from "vue";
import { message } from "@/utils/message";
const props = defineProps<{ modelValue: boolean; code: string }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  closed: [];
}>();
const link = computed(() => {
  const base = import.meta.env.VITE_CLOSET_PUBLIC_URL?.trim().replace(
    /\/+$/,
    ""
  );
  return base && props.code
    ? `${base}/register?invite=${encodeURIComponent(props.code)}`
    : "";
});
const copy = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    message("已复制", { type: "success" });
  } catch {
    message("复制失败，请手动选择内容复制", { type: "warning" });
  }
};
</script>
<template>
  <el-dialog
    :model-value="modelValue"
    title="邀请码仅显示一次"
    width="min(580px, 94vw)"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <el-alert
      title="关闭后不会再次显示邀请码或注册链接，请立即复制并妥善保存。"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-form label-position="top" class="mt-4">
      <el-form-item label="邀请码"
        ><div class="flex w-full gap-2">
          <el-input :model-value="code" readonly /><el-button
            type="primary"
            @click="copy(code)"
            >复制邀请码</el-button
          >
        </div></el-form-item
      >
      <el-form-item v-if="link" label="注册链接"
        ><div class="flex w-full gap-2">
          <el-input :model-value="link" readonly /><el-button
            @click="copy(link)"
            >复制链接</el-button
          >
        </div></el-form-item
      >
    </el-form>
    <template #footer
      ><el-button type="primary" @click="emit('update:modelValue', false)"
        >我已保存</el-button
      ></template
    >
  </el-dialog>
</template>
