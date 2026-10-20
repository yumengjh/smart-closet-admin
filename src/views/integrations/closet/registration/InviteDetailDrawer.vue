<script setup lang="ts">
import { ref, watch } from "vue";
import { getClosetInvite, type InviteDetail } from "@/api/closet/registration";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { formatTime, useClosetRequest } from "../useClosetRequest";
import { inviteStatusNames } from "../accountLabels";
import ClosetUnavailable from "../ClosetUnavailable.vue";
const props = defineProps<{ modelValue: boolean; id?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const detail = ref<InviteDetail>();
const load = () => {
  const id = props.id;
  if (!id || !props.modelValue || !can("closet:registration:read")) return;
  return run(
    () => getClosetInvite(id),
    result => {
      if (props.modelValue && props.id === id) detail.value = result.data;
    }
  );
};
watch(
  () => [props.modelValue, props.id],
  () => {
    detail.value = undefined;
    if (props.modelValue) void load();
  }
);
</script>
<template>
  <el-drawer
    :model-value="modelValue"
    title="邀请码详情"
    size="min(720px, 94vw)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      ><el-button link @click="load">重试</el-button></el-alert
    >
    <div v-else v-loading="loading" class="space-y-4">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="邀请码 ID">{{
            detail.invite.id
          }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{
            detail.invite.note || "无"
          }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{
            inviteStatusNames[detail.invite.status] ?? detail.invite.status
          }}</el-descriptions-item>
          <el-descriptions-item label="已用 / 名额"
            >{{ detail.invite.usedCount }} /
            {{ detail.invite.maxUses }}</el-descriptions-item
          >
          <el-descriptions-item label="创建者">{{
            detail.invite.createdBy
          }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{
            formatTime(detail.invite.createdAtMs)
          }}</el-descriptions-item>
          <el-descriptions-item label="到期时间">{{
            formatTime(detail.invite.expiresAtMs)
          }}</el-descriptions-item>
          <el-descriptions-item
            v-if="detail.invite.revokedAtMs"
            label="撤销时间"
            >{{ formatTime(detail.invite.revokedAtMs) }}</el-descriptions-item
          >
        </el-descriptions>
        <h4 class="font-medium">使用者列表</h4>
        <el-table
          :data="detail.registeredUsers"
          empty-text="尚无用户使用该邀请码"
        >
          <el-table-column
            prop="username"
            label="用户名"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column label="注册时间" min-width="180"
            ><template #default="{ row }">{{
              formatTime(row.createdAtMs)
            }}</template></el-table-column
          >
          <el-table-column label="账号状态" width="100"
            ><template #default="{ row }"
              ><el-tag :type="row.enabled ? 'success' : 'info'">{{
                row.enabled ? "已启用" : "已禁用"
              }}</el-tag></template
            ></el-table-column
          >
        </el-table>
      </template>
    </div>
  </el-drawer>
</template>
