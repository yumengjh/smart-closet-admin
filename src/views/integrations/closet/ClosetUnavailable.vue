<script setup lang="ts">
defineProps<{ loading?: boolean }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <el-empty description="鱼搭服务暂不可用">
    <el-button type="primary" :loading="loading" @click="$emit('retry')">
      重试
    </el-button>
  </el-empty>
</template>
