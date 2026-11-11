<script setup lang="ts">
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
defineProps<{
  title: string;
  error: string;
  loading: boolean;
  saving?: boolean;
}>();
defineEmits<{ refresh: [] }>();
const { can } = useCurrentPermissions();
</script>
<template>
  <div class="page-root space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">{{ title }}</h2>
      <el-button
        v-if="can('closet:billing:read')"
        :loading="loading"
        :disabled="saving"
        @click="$emit('refresh')"
        >刷新</el-button
      >
    </header>
    <el-empty
      v-if="!can('closet:billing:read')"
      description="没有查看收费管理的权限"
    />
    <template v-else>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <div v-loading="loading" class="space-y-4"><slot /></div>
    </template>
  </div>
</template>
