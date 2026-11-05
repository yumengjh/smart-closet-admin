<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import Overview from "./Overview.vue";
import Settings from "./Settings.vue";
import Accounts from "./Accounts.vue";
import Sessions from "./Sessions.vue";
import UserPolicy from "./UserPolicy.vue";
defineOptions({ name: "ClosetTryOn" });
const route = useRoute();
const { can } = useCurrentPermissions();
const tab = ref(
  typeof route.query.username === "string" ? "users" : "overview"
);
</script>
<template>
  <div class="page-root space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">实时试穿</h2>
        <p class="mt-1 text-sm text-[var(--el-text-color-secondary)]">
          管理开通策略、运营资源与会话，查看启动诊断和实际用量。
        </p>
      </div>
    </header>
    <el-empty
      v-if="!can('closet:tryon:read')"
      description="没有查看实时试穿的权限"
    />
    <el-card v-else shadow="never">
      <el-tabs v-model="tab">
        <el-tab-pane label="资源与用量" name="overview"
          ><Overview v-if="tab === 'overview'"
        /></el-tab-pane>
        <el-tab-pane label="试穿设置" name="settings"
          ><Settings v-if="tab === 'settings'"
        /></el-tab-pane>
        <el-tab-pane label="运营账户" name="accounts"
          ><Accounts v-if="tab === 'accounts'"
        /></el-tab-pane>
        <el-tab-pane label="会话诊断" name="sessions"
          ><Sessions v-if="tab === 'sessions'"
        /></el-tab-pane>
        <el-tab-pane label="用户策略" name="users"
          ><UserPolicy v-if="tab === 'users'"
        /></el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>
