<script setup lang="ts">
import {
  getClosetUser,
  getClosetUserLoginLock,
  clearClosetUserLoginLock,
  getClosetUserEvents,
  updateClosetUserProfile,
  revokeClosetUserSession,
  type AccountEvent,
  type LoginLock,
  listClosetUserSessions,
  listPortableLinks,
  resetClosetUserPassword,
  revokeClosetUserSessions,
  revokePortableLink,
  updateClosetUserQuota,
  updateClosetUserRole,
  updateClosetUserStatus,
  type ClosetSession,
  type ClosetUserDetail,
  type ClosetUserSummary,
  type PortableLink
} from "@/api/closet/users";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import TemporaryPasswordDialog from "./TemporaryPasswordDialog.vue";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useClosetRequest } from "../useClosetRequest";
import { accountActionName, registeredViaNames } from "../accountLabels";

const props = defineProps<{
  modelValue: boolean;
  user?: Pick<ClosetUserSummary, "username">;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  changed: [];
}>();
const router = useRouter();
const { can } = useCurrentPermissions();
const detail = ref<ClosetUserDetail>();
const sessions = ref<ClosetSession[]>([]);
const links = ref<PortableLink[]>([]);
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const displayName = ref("");
const loginLock = ref<LoginLock>();
const events = ref<AccountEvent[]>([]);
const tab = ref("overview");
const saving = ref(false);
const tempPasswordOpen = ref(false);
const temporaryPassword = ref("");
const quotaForm = reactive<{ image: number; agent: number }>({
  image: 0,
  agent: 0
});
const dateText = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : "暂无";

const load = async () => {
  if (!props.user || !props.modelValue || !can("closet:user:read")) return;
  const username = props.user.username;
  return run(
    () =>
      Promise.all([
        getClosetUser(username),
        listClosetUserSessions(username),
        listPortableLinks(username),
        getClosetUserLoginLock(username),
        getClosetUserEvents(username)
      ]),
    ([
      userResponse,
      sessionResponse,
      linkResponse,
      lockResponse,
      eventResponse
    ]) => {
      if (!props.modelValue || props.user?.username !== username) return;
      detail.value = userResponse.data;
      displayName.value = detail.value.displayName ?? "";
      sessions.value = sessionResponse.data;
      links.value = linkResponse.data;
      loginLock.value = lockResponse.data;
      events.value = eventResponse.data;
      quotaForm.image = detail.value.quota.image.limit;
      quotaForm.agent = detail.value.quota.agent.limit;
    }
  );
};
const writeAccount = async (
  operation: (username: string) => Promise<unknown>,
  success: string,
  confirmation?: string,
  permission = "closet:user:write"
) => {
  if (!detail.value || !can(permission) || saving.value) return;
  const username = detail.value.username;
  saving.value = true;
  try {
    if (confirmation)
      await ElMessageBox.confirm(confirmation, success, {
        type: "warning",
        confirmButtonText: "确认操作",
        cancelButtonText: "取消"
      });
    await operation(username);
    message(success, { type: "success" });
    emit("changed");
    await load();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("操作失败，请刷新后重试", { type: "error" });
  } finally {
    saving.value = false;
  }
};
const saveProfile = () =>
  writeAccount(
    username => updateClosetUserProfile(username, displayName.value.trim()),
    "昵称已保存"
  );
const unlock = () =>
  writeAccount(
    clearClosetUserLoginLock,
    "登录锁定已解除",
    "解除该账号的登录锁定并清除近期失败次数？"
  );
const revokeSession = (session: ClosetSession) =>
  writeAccount(
    username => revokeClosetUserSession(username, session.sessionRef),
    "会话已退出",
    "该会话将立即失效，该设备需要重新登录。"
  );
watch(
  () => [props.modelValue, props.user?.username] as const,
  ([open]) => {
    if (open) {
      detail.value = undefined;
      tab.value = "overview";
      void load();
    } else {
      detail.value = undefined;
      sessions.value = [];
      links.value = [];
      events.value = [];
      loginLock.value = undefined;
      displayName.value = "";
    }
  }
);
const updateStatus = () => {
  if (!detail.value) return;
  const enabled = !detail.value.enabled;
  return writeAccount(
    username => updateClosetUserStatus(username, enabled),
    enabled ? "用户已启用" : "用户已禁用",
    enabled
      ? undefined
      : "禁用后该用户全部会话和便携登录链接将失效，用户会立即退出全部设备。"
  );
};
const updateRole = (role: "USER" | "ADMIN") => {
  if (!detail.value || role === detail.value.role) return;
  return writeAccount(
    username => updateClosetUserRole(username, role),
    "用户角色已更新",
    detail.value.role === "ADMIN"
      ? "降级后该用户将失去管理员权限，全部会话会失效并要求重新登录。"
      : undefined
  );
};
const resetPassword = () =>
  writeAccount(
    async username => {
      const { data } = await resetClosetUserPassword(username);
      if (data.temporaryPassword) {
        temporaryPassword.value = data.temporaryPassword;
        tempPasswordOpen.value = true;
      }
    },
    "用户密码已重置",
    "现有便携登录链接和全部会话将失效，用户需要用新密码登录并立即修改密码。",
    "closet:user:reset-password"
  );
const revokeSessions = () =>
  writeAccount(
    revokeClosetUserSessions,
    "已退出该用户全部设备",
    "将立即退出该用户全部设备。"
  );
const revokeLink = (link: PortableLink) =>
  writeAccount(
    username => revokePortableLink(username, link.id),
    "便携登录链接已吊销",
    "该便携登录链接将立即失效。"
  );
const saveQuota = (restore = false) =>
  writeAccount(
    username =>
      updateClosetUserQuota(username, {
        imageDailyLimit: restore ? null : quotaForm.image,
        agentDailyLimit: restore ? null : quotaForm.agent
      }),
    restore ? "额度已恢复默认" : "额度已保存",
    undefined,
    "closet:quota:write"
  );
const openReport = () => {
  if (!detail.value) return;
  emit("update:modelValue", false);
  void router.push({
    path: "/closet/insights",
    query: { username: detail.value.username }
  });
};
const clearTemporaryPassword = () => {
  temporaryPassword.value = "";
};
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="业务用户详情"
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
    <div v-else v-loading="loading" class="space-y-5">
      <template v-if="detail">
        <div class="flex flex-wrap items-center gap-3">
          <div class="mr-auto">
            <h3 class="text-lg font-semibold">{{ detail.username }}</h3>
            <p class="text-sm text-gray-500">
              创建于 {{ dateText(detail.createdAtMs) }}
            </p>
          </div>
          <el-button @click="openReport">查看衣柜报告</el-button>
        </div>
        <el-tabs v-model="tab">
          <el-tab-pane label="账号详情" name="overview"
            ><div class="space-y-5">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="昵称">{{
                  detail.displayName || "未设置"
                }}</el-descriptions-item>
                <el-descriptions-item label="注册来源">{{
                  registeredViaNames[detail.registeredVia] ??
                  detail.registeredVia
                }}</el-descriptions-item>
                <el-descriptions-item label="最近登录">{{
                  dateText(detail.lastLoginAtMs)
                }}</el-descriptions-item>
                <el-descriptions-item label="注销时间">{{
                  dateText(detail.deactivatedAtMs)
                }}</el-descriptions-item>
                <el-descriptions-item label="邀请码 ID" :span="2">{{
                  detail.inviteId || "无"
                }}</el-descriptions-item>
                <el-descriptions-item label="角色">{{
                  detail.role === "ADMIN" ? "管理员" : "普通用户"
                }}</el-descriptions-item>
                <el-descriptions-item label="账号状态">{{
                  detail.deactivatedAtMs
                    ? "已注销"
                    : detail.enabled
                      ? "已启用"
                      : "已禁用"
                }}</el-descriptions-item>
                <el-descriptions-item label="首次登录改密">{{
                  detail.mustChangePassword ? "需要" : "不需要"
                }}</el-descriptions-item>
                <el-descriptions-item label="最近会话活跃">{{
                  dateText(detail.lastActiveAtMs)
                }}</el-descriptions-item>
                <el-descriptions-item label="衣柜资料">{{
                  detail.hasWearerProfile ? "已填写" : "未填写"
                }}</el-descriptions-item>
                <el-descriptions-item label="搭配 / 计划"
                  >{{ detail.outfitCount }} /
                  {{ detail.outfitPlanCount }}</el-descriptions-item
                >
                <el-descriptions-item label="快速入柜">{{
                  detail.quickIntakeCount
                }}</el-descriptions-item>
                <el-descriptions-item label="有效便携链接">{{
                  detail.activePortableLinkCount
                }}</el-descriptions-item>
              </el-descriptions>
              <el-form
                v-if="can('closet:user:write')"
                inline
                @submit.prevent="saveProfile"
              >
                <el-form-item label="昵称"
                  ><el-input
                    v-model="displayName"
                    maxlength="40"
                    show-word-limit
                    clearable
                    placeholder="留空则清除昵称"
                    :disabled="saving"
                /></el-form-item>
                <el-form-item
                  ><el-button
                    type="primary"
                    :loading="saving"
                    @click="saveProfile"
                    >保存昵称</el-button
                  ></el-form-item
                >
              </el-form>
              <section v-if="loginLock">
                <div class="flex flex-wrap items-center gap-3">
                  <h4 class="font-medium">登录锁定</h4>
                  <el-tag :type="loginLock.locked ? 'danger' : 'success'">{{
                    loginLock.locked ? "已锁定" : "未锁定"
                  }}</el-tag>
                  <el-button
                    v-if="can('closet:user:write')"
                    :disabled="!loginLock.locked && !loginLock.recentFailures"
                    :loading="saving"
                    @click="unlock"
                    >解除锁定</el-button
                  >
                  <el-button link :disabled="saving" @click="load"
                    >刷新状态</el-button
                  >
                </div>
                <p class="mt-2 text-sm">
                  近 15 分钟失败 {{ loginLock.recentFailures }} 次，读取时剩余
                  {{ loginLock.retryAfterSeconds }} 秒。状态以刷新结果为准。
                </p>
              </section>
              <div class="flex flex-wrap gap-2">
                <el-button
                  v-if="can('closet:user:write')"
                  :type="detail.enabled ? 'danger' : 'success'"
                  plain
                  :disabled="saving || loading"
                  @click="updateStatus"
                >
                  {{ detail.enabled ? "禁用用户" : "启用用户" }}
                </el-button>
                <el-button
                  v-if="can('closet:user:write')"
                  @click="revokeSessions"
                  >强制下线</el-button
                >
                <el-button
                  v-if="can('closet:user:reset-password')"
                  type="warning"
                  plain
                  :disabled="saving || loading"
                  @click="resetPassword"
                  >重置密码</el-button
                >
                <el-select
                  v-if="can('closet:user:write')"
                  :model-value="detail.role"
                  class="!w-36"
                  aria-label="用户角色"
                  :disabled="saving || loading"
                  @change="updateRole"
                >
                  <el-option label="普通用户" value="USER" /><el-option
                    label="管理员"
                    value="ADMIN"
                  />
                </el-select>
              </div>
              <section>
                <h4 class="mb-2 font-medium">衣物状态</h4>
                <el-table
                  :data="
                    Object.entries(detail.garments).map(([status, count]) => ({
                      status,
                      count
                    }))
                  "
                  size="small"
                >
                  <el-table-column prop="status" label="状态" /><el-table-column
                    prop="count"
                    label="数量"
                    width="110"
                  />
                </el-table>
              </section>
              <section>
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h4 class="font-medium">登录会话</h4>
                  <el-button
                    v-if="can('closet:user:write')"
                    link
                    type="danger"
                    :disabled="saving || loading || sessions.length === 0"
                    @click="revokeSessions"
                    >退出全部设备</el-button
                  >
                </div>
                <el-table
                  :data="sessions"
                  size="small"
                  empty-text="没有有效会话"
                >
                  <el-table-column label="创建时间" min-width="165"
                    ><template #default="{ row }">{{
                      dateText(row.createdAtMs)
                    }}</template></el-table-column
                  >
                  <el-table-column label="最近活跃" min-width="165"
                    ><template #default="{ row }">{{
                      dateText(row.lastAccessAtMs)
                    }}</template></el-table-column
                  >
                  <el-table-column label="过期时间" min-width="165"
                    ><template #default="{ row }">{{
                      dateText(row.expiresAtMs)
                    }}</template></el-table-column
                  >
                  <el-table-column label="类型" width="110"
                    ><template #default="{ row }">{{
                      row.portable ? "便携登录" : "常规登录"
                    }}</template></el-table-column
                  >
                  <el-table-column
                    v-if="can('closet:user:write')"
                    label="操作"
                    width="90"
                    fixed="right"
                    ><template #default="{ row }"
                      ><el-button
                        link
                        type="danger"
                        :disabled="saving"
                        @click="revokeSession(row)"
                        >退出会话</el-button
                      ></template
                    ></el-table-column
                  >
                </el-table>
              </section>
              <section>
                <h4 class="mb-2 font-medium">便携登录链接</h4>
                <el-table
                  :data="links"
                  size="small"
                  empty-text="没有便携登录链接"
                >
                  <el-table-column label="创建时间" min-width="165"
                    ><template #default="{ row }">{{
                      dateText(row.createdAtMs)
                    }}</template></el-table-column
                  >
                  <el-table-column label="过期时间" min-width="165"
                    ><template #default="{ row }">{{
                      dateText(row.expiresAtMs)
                    }}</template></el-table-column
                  >
                  <el-table-column prop="status" label="状态" width="100" />
                  <el-table-column
                    v-if="can('closet:user:write')"
                    label="操作"
                    width="90"
                    ><template #default="{ row }"
                      ><el-button
                        link
                        type="danger"
                        :disabled="saving || loading"
                        @click="revokeLink(row)"
                        >吊销</el-button
                      ></template
                    ></el-table-column
                  >
                </el-table>
              </section>
              <section>
                <div class="mb-2 flex items-center justify-between">
                  <h4 class="font-medium">每日 AI 额度</h4>
                  <span class="text-sm text-gray-500"
                    >重置于 {{ dateText(detail.quota.resetAtMs) }}</span
                  >
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <el-form-item label="图片处理 / 日"
                    ><el-input-number
                      v-model="quotaForm.image"
                      :min="0"
                      :max="1000"
                      :disabled="
                        saving || loading || !can('closet:quota:write')
                      "
                  /></el-form-item>
                  <el-form-item label="Agent 消息 / 日"
                    ><el-input-number
                      v-model="quotaForm.agent"
                      :min="0"
                      :max="1000"
                      :disabled="
                        saving || loading || !can('closet:quota:write')
                      "
                  /></el-form-item>
                </div>
                <p class="mb-3 text-sm text-gray-500">
                  今日已用：图片 {{ detail.quota.image.used }}，Agent
                  {{ detail.quota.agent.used }}。图片额度{{
                    detail.quota.image.overridden
                      ? "为自定义值"
                      : "使用系统默认值"
                  }}，Agent 额度{{
                    detail.quota.agent.overridden
                      ? "为自定义值"
                      : "使用系统默认值"
                  }}。
                </p>
                <div v-if="can('closet:quota:write')" class="flex gap-2">
                  <el-button
                    type="primary"
                    :loading="saving"
                    @click="saveQuota()"
                    >保存额度</el-button
                  ><el-button
                    :disabled="saving || loading"
                    @click="saveQuota(true)"
                    >恢复默认</el-button
                  >
                </div>
              </section>
            </div></el-tab-pane
          >
          <el-tab-pane label="账号记录" name="events">
            <p class="mb-3 text-sm">最近 50 条账号记录</p>
            <el-table :data="events" empty-text="暂无账号记录">
              <el-table-column label="时间" min-width="180"
                ><template #default="{ row }">{{
                  dateText(row.occurredAtMs)
                }}</template></el-table-column
              >
              <el-table-column
                prop="actor"
                label="操作者"
                min-width="140"
                show-overflow-tooltip
              />
              <el-table-column label="动作" min-width="190"
                ><template #default="{ row }">{{
                  accountActionName(row.action)
                }}</template></el-table-column
              >
              <el-table-column
                prop="detail"
                label="详情"
                min-width="220"
                show-overflow-tooltip
              />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </div>
    <TemporaryPasswordDialog
      v-model="tempPasswordOpen"
      :password="temporaryPassword"
      @closed="clearTemporaryPassword"
    />
  </el-drawer>
</template>
