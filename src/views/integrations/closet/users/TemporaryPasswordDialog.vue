<script setup lang="ts">
import { message } from "@/utils/message";

const props = defineProps<{ modelValue: boolean; password: string }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  closed: [];
}>();
const copyPassword = async () => {
  try {
    await navigator.clipboard.writeText(props.password);
    message("临时密码已复制", { type: "success" });
  } catch {
    message("复制失败，请手动选择密码", { type: "warning" });
  }
};
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="临时密码仅显示一次"
    width="460px"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <el-alert
      title="请通过安全渠道告知用户，首次登录后必须修改密码。关闭后将无法再次查看。"
      type="warning"
      :closable="false"
      show-icon
    />
    <div class="mt-4 flex gap-2">
      <el-input class="temp-password" :model-value="password" readonly />
      <el-button type="primary" @click="copyPassword">复制</el-button>
    </div>
    <template #footer>
      <el-button type="primary" @click="emit('update:modelValue', false)"
        >我已保存</el-button
      >
    </template>
  </el-dialog>
</template>
