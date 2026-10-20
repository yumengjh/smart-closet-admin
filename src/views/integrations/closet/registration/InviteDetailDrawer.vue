<script setup lang="ts">
import { ref, watch } from "vue";
import { getClosetInvite, type InviteDetail } from "@/api/closet/registration";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { useClosetRequest } from "../useClosetRequest";
import {
  actorLabel,
  dateTime,
  inviteStatusNames,
  inviteStatusTypes,
  remainingText
} from "../accountLabels";
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
    size="min(640px, 94vw)"
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
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="mr-1 text-lg font-semibold">
            {{ detail.invite.note || "未填写备注" }}
          </h3>
          <el-tag
            :type="
              inviteStatusTypes[
                detail.invite.status as keyof typeof inviteStatusTypes
              ] ?? 'info'
            "
            effect="plain"
            >{{
              inviteStatusNames[
                detail.invite.status as keyof typeof inviteStatusNames
              ] ?? detail.invite.status
            }}</el-tag
          >
        </div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="已用 / 名额"
            >{{ detail.invite.usedCount }} /
            {{ detail.invite.maxUses }}</el-descriptions-item
          >
          <el-descriptions-item label="到期"
            >{{ dateTime(detail.invite.expiresAtMs)
            }}<span
              v-if="detail.invite.status === 'ACTIVE'"
              class="ml-2 text-xs text-[var(--el-text-color-secondary)]"
              >{{ remainingText(detail.invite.expiresAtMs) }}</span
            ></el-descriptions-item
          >
          <el-descriptions-item label="创建者">{{
            actorLabel(detail.invite.createdBy)
          }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{
            dateTime(detail.invite.createdAtMs)
          }}</el-descriptions-item>
          <el-descriptions-item
            v-if="detail.invite.revokedAtMs"
            label="撤销时间"
            >{{ dateTime(detail.invite.revokedAtMs) }}</el-descriptions-item
          >
          <el-descriptions-item
            label="ID"
            :span="detail.invite.revokedAtMs ? 1 : 2"
            ><span class="font-mono text-xs">{{
              detail.invite.id
            }}</span></el-descriptions-item
          >
        </el-descriptions>
        <h4 class="text-sm font-semibold">
          用它注册的账号（{{ detail.registeredUsers.length }}）
        </h4>
        <el-table
          :data="detail.registeredUsers"
          size="small"
          empty-text="还没有人使用这个邀请码"
        >
          <el-table-column
            prop="username"
            label="用户名"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column label="注册时间" min-width="150"
            ><template #default="{ row }">{{
              dateTime(row.createdAtMs)
            }}</template></el-table-column
          >
          <el-table-column label="状态" width="90"
            ><template #default="{ row }"
              ><el-tag
                :type="row.enabled ? 'success' : 'info'"
                size="small"
                effect="plain"
                >{{ row.enabled ? "已启用" : "已禁用" }}</el-tag
              ></template
            ></el-table-column
          >
        </el-table>
      </template>
    </div>
  </el-drawer>
</template>
