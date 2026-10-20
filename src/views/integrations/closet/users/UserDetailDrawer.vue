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
import { computed, reactive, ref, watch } from "vue";
import CloseIcon from "~icons/ep/close";
import { useRouter } from "vue-router";
import { useClosetRequest } from "../useClosetRequest";
import {
  accountActionName,
  actionSource,
  actionSourceTypes,
  actorLabel,
  dateTime,
  eventDetailText,
  garmentStatusNames,
  initial,
  lastSeen,
  registeredViaNames,
  relativeTime
} from "../accountLabels";

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
const editingName = ref(false);
const saving = ref(false);
const tempPasswordOpen = ref(false);
const temporaryPassword = ref("");
const quotaForm = reactive<{ image: number; agent: number }>({
  image: 0,
  agent: 0
});

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
const saveProfile = async () => {
  await writeAccount(
    username => updateClosetUserProfile(username, displayName.value.trim()),
    displayName.value.trim() ? "昵称已保存" : "昵称已清除"
  );
  editingName.value = false;
};
const cancelName = () => {
  displayName.value = detail.value?.displayName ?? "";
  editingName.value = false;
};
const garmentTotal = computed(() =>
  Object.values(detail.value?.garments ?? {}).reduce((sum, n) => sum + n, 0)
);
const quotaPercent = (used: number, limit: number) =>
  limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
const statusText = computed(() =>
  !detail.value
    ? ""
    : detail.value.deactivatedAtMs
      ? "已注销"
      : detail.value.enabled
        ? "已启用"
        : "已禁用"
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
      editingName.value = false;
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
      : "升级后该用户获得鱼搭内的管理员权限，全部会话会失效并要求重新登录。"
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
    size="min(760px, 96vw)"
    class="closet-user-drawer"
    :with-header="false"
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
    <div v-else v-loading="loading" class="drawer-body">
      <el-skeleton v-if="!detail" :rows="8" animated />
      <template v-else>
        <header class="profile">
          <span
            class="avatar"
            :class="{ 'avatar-muted': !detail.enabled }"
            aria-hidden="true"
            >{{ initial(detail.displayName || detail.username) }}</span
          >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="truncate text-lg font-semibold">
                {{ detail.username }}
              </h3>
              <el-tag
                :type="
                  detail.deactivatedAtMs
                    ? 'danger'
                    : detail.enabled
                      ? 'success'
                      : 'info'
                "
                effect="plain"
                >{{ statusText }}</el-tag
              >
              <el-tag
                v-if="detail.role === 'ADMIN'"
                type="warning"
                effect="plain"
                >管理员</el-tag
              >
              <el-tag v-if="detail.mustChangePassword" type="info"
                >待改密</el-tag
              >
              <el-tag v-if="loginLock?.locked" type="danger">登录已锁定</el-tag>
            </div>
            <div v-if="!editingName" class="name-line">
              <span :class="{ 'text-placeholder': !detail.displayName }">{{
                detail.displayName || "未设置昵称"
              }}</span>
              <el-button
                v-if="can('closet:user:write')"
                link
                type="primary"
                size="small"
                @click="editingName = true"
                >修改</el-button
              >
            </div>
            <div v-else class="name-edit">
              <el-input
                v-model="displayName"
                maxlength="40"
                show-word-limit
                placeholder="留空则清除昵称"
                :disabled="saving"
                @keyup.enter="saveProfile"
                @keyup.esc="cancelName"
              />
              <el-button type="primary" :loading="saving" @click="saveProfile"
                >保存</el-button
              >
              <el-button :disabled="saving" @click="cancelName">取消</el-button>
            </div>
            <p class="meta">
              {{
                registeredViaNames[detail.registeredVia] ?? detail.registeredVia
              }}
              · 创建于 {{ dateTime(detail.createdAtMs) }} ·
              {{
                detail.lastLoginAtMs
                  ? `最近登录 ${lastSeen(detail).label}`
                  : lastSeen(detail).label
              }}
            </p>
          </div>
          <el-button
            class="close-button"
            text
            circle
            aria-label="关闭"
            @click="emit('update:modelValue', false)"
            ><IconifyIconOffline :icon="CloseIcon"
          /></el-button>
        </header>

        <div v-if="detail.deactivatedAtMs" class="mb-4">
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            :title="`用户于 ${dateTime(detail.deactivatedAtMs)} 自助注销，账号已停用，数据保留。启用账号即可恢复。`"
          />
        </div>

        <div class="actions">
          <el-button
            v-if="can('closet:user:reset-password')"
            :disabled="saving"
            @click="resetPassword"
            >重置密码</el-button
          >
          <el-button
            v-if="can('closet:user:write')"
            :disabled="saving || sessions.length === 0"
            @click="revokeSessions"
            >强制下线</el-button
          >
          <el-button
            v-if="can('closet:user:write')"
            :disabled="saving"
            @click="updateRole(detail.role === 'ADMIN' ? 'USER' : 'ADMIN')"
            >{{
              detail.role === "ADMIN" ? "设为普通用户" : "设为管理员"
            }}</el-button
          >
          <el-button @click="openReport">衣柜报告</el-button>
          <span class="flex-1" />
          <el-button
            v-if="can('closet:user:write')"
            :type="detail.enabled ? 'danger' : 'success'"
            :plain="detail.enabled"
            :disabled="saving"
            @click="updateStatus"
            >{{ detail.enabled ? "禁用用户" : "启用用户" }}</el-button
          >
        </div>

        <div class="stats">
          <div class="stat">
            <span>衣物</span><strong>{{ garmentTotal }}</strong>
          </div>
          <div class="stat">
            <span>搭配</span><strong>{{ detail.outfitCount }}</strong>
          </div>
          <div class="stat">
            <span>穿搭计划</span><strong>{{ detail.outfitPlanCount }}</strong>
          </div>
          <div class="stat">
            <span>快速入柜</span><strong>{{ detail.quickIntakeCount }}</strong>
          </div>
          <div class="stat">
            <span>在线会话</span
            ><strong>{{ detail.activeSessionCount }}</strong>
          </div>
        </div>

        <el-tabs v-model="tab">
          <el-tab-pane label="概览" name="overview">
            <el-descriptions :column="2" border size="small" class="mb-4">
              <el-descriptions-item label="注册来源">{{
                registeredViaNames[detail.registeredVia] ?? detail.registeredVia
              }}</el-descriptions-item>
              <el-descriptions-item label="注册邀请码">
                <el-tooltip v-if="detail.inviteId" :content="detail.inviteId"
                  ><span class="font-mono text-xs">{{
                    detail.inviteId.slice(0, 8)
                  }}</span></el-tooltip
                ><span v-else class="text-placeholder">未使用</span>
              </el-descriptions-item>
              <el-descriptions-item label="最近登录">{{
                dateTime(detail.lastLoginAtMs)
              }}</el-descriptions-item>
              <el-descriptions-item label="最近活跃">{{
                dateTime(detail.lastActiveAtMs)
              }}</el-descriptions-item>
              <el-descriptions-item label="身材资料">{{
                detail.hasWearerProfile ? "已填写" : "未填写"
              }}</el-descriptions-item>
              <el-descriptions-item label="有效便携链接">{{
                detail.activePortableLinkCount
              }}</el-descriptions-item>
            </el-descriptions>
            <h4 class="section-title">衣物分布</h4>
            <div v-if="garmentTotal" class="flex flex-wrap gap-2">
              <el-tag
                v-for="(count, key) in detail.garments"
                :key="key"
                type="info"
                effect="plain"
                >{{ garmentStatusNames[key] ?? key }} {{ count }}</el-tag
              >
            </div>
            <p v-else class="text-placeholder text-sm">还没有衣物</p>
          </el-tab-pane>

          <el-tab-pane name="sessions">
            <template #label
              >登录与会话<el-badge v-if="loginLock?.locked" is-dot class="ml-1"
            /></template>
            <div
              v-if="loginLock"
              class="lock"
              :class="{ locked: loginLock.locked }"
            >
              <div class="flex-1">
                <strong>{{
                  loginLock.locked ? "登录已锁定" : "登录正常"
                }}</strong>
                <p>
                  {{
                    loginLock.locked
                      ? `连续输错密码 ${loginLock.recentFailures} 次，约 ${Math.ceil(loginLock.retryAfterSeconds / 60)} 分钟后自动解除。`
                      : loginLock.recentFailures
                        ? `近 15 分钟输错密码 ${loginLock.recentFailures} 次，达到 5 次将锁定 15 分钟。`
                        : "近 15 分钟没有登录失败。"
                  }}
                </p>
              </div>
              <el-button
                v-if="
                  can('closet:user:write') &&
                  (loginLock.locked || loginLock.recentFailures)
                "
                :type="loginLock.locked ? 'primary' : 'default'"
                :loading="saving"
                @click="unlock"
                >{{ loginLock.locked ? "解除锁定" : "清除失败次数" }}</el-button
              >
              <el-button link :disabled="saving" @click="load">刷新</el-button>
            </div>

            <div class="section-head">
              <h4 class="section-title">登录会话</h4>
              <el-button
                v-if="can('closet:user:write') && sessions.length"
                link
                type="danger"
                :disabled="saving"
                @click="revokeSessions"
                >退出全部设备</el-button
              >
            </div>
            <el-table
              :data="sessions"
              size="small"
              empty-text="当前没有在线会话"
            >
              <el-table-column label="类型" width="96">
                <template #default="{ row }"
                  ><el-tag
                    :type="row.portable ? 'warning' : 'info'"
                    size="small"
                    >{{ row.portable ? "便携登录" : "密码登录" }}</el-tag
                  ></template
                >
              </el-table-column>
              <el-table-column label="登录时间" min-width="140">
                <template #default="{ row }">{{
                  dateTime(row.createdAtMs)
                }}</template>
              </el-table-column>
              <el-table-column label="最近活跃" min-width="100">
                <template #default="{ row }">{{
                  relativeTime(row.lastAccessAtMs)
                }}</template>
              </el-table-column>
              <el-table-column label="到期" min-width="140">
                <template #default="{ row }">{{
                  dateTime(row.expiresAtMs)
                }}</template>
              </el-table-column>
              <el-table-column
                v-if="can('closet:user:write')"
                label=""
                width="76"
                align="right"
              >
                <template #default="{ row }"
                  ><el-button
                    link
                    type="danger"
                    :disabled="saving"
                    @click="revokeSession(row)"
                    >退出</el-button
                  ></template
                >
              </el-table-column>
            </el-table>

            <h4 class="section-title mt-5">便携登录链接</h4>
            <el-table :data="links" size="small" empty-text="没有便携登录链接">
              <el-table-column label="状态" width="96">
                <template #default="{ row }"
                  ><el-tag
                    size="small"
                    :type="
                      row.status === 'PENDING'
                        ? 'success'
                        : row.status === 'USED'
                          ? 'warning'
                          : 'info'
                    "
                    >{{
                      {
                        PENDING: "待使用",
                        USED: "已登录",
                        EXPIRED: "已过期",
                        REVOKED: "已吊销"
                      }[row.status as string] ?? row.status
                    }}</el-tag
                  ></template
                >
              </el-table-column>
              <el-table-column label="创建时间" min-width="140">
                <template #default="{ row }">{{
                  dateTime(row.createdAtMs)
                }}</template>
              </el-table-column>
              <el-table-column label="到期" min-width="140">
                <template #default="{ row }">{{
                  dateTime(row.sessionExpiresAtMs ?? row.expiresAtMs)
                }}</template>
              </el-table-column>
              <el-table-column
                v-if="can('closet:user:write')"
                label=""
                width="76"
                align="right"
              >
                <template #default="{ row }"
                  ><el-button
                    v-if="row.status === 'PENDING' || row.status === 'USED'"
                    link
                    type="danger"
                    :disabled="saving"
                    @click="revokeLink(row)"
                    >吊销</el-button
                  ></template
                >
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="AI 额度" name="quota">
            <p class="mb-3 text-sm text-[var(--el-text-color-secondary)]">
              按北京时间每日重置，下次重置
              {{ dateTime(detail.quota.resetAtMs) }}。
            </p>
            <div class="quota-grid">
              <div
                v-for="item in [
                  {
                    key: 'image',
                    title: '图片处理',
                    unit: '次/日',
                    bucket: detail.quota.image
                  },
                  {
                    key: 'agent',
                    title: '助手消息',
                    unit: '条/日',
                    bucket: detail.quota.agent
                  }
                ]"
                :key="item.key"
                class="quota-card"
              >
                <div class="flex items-center justify-between">
                  <strong>{{ item.title }}</strong>
                  <el-tag
                    size="small"
                    :type="item.bucket.overridden ? 'warning' : 'info'"
                    >{{ item.bucket.overridden ? "自定义" : "默认" }}</el-tag
                  >
                </div>
                <div class="quota-usage">
                  今日已用 <b>{{ item.bucket.used }}</b> /
                  {{ item.bucket.limit }}
                </div>
                <el-progress
                  :percentage="
                    quotaPercent(item.bucket.used, item.bucket.limit)
                  "
                  :status="
                    item.bucket.used >= item.bucket.limit
                      ? 'exception'
                      : undefined
                  "
                  :show-text="false"
                />
                <label class="quota-limit">
                  <span>每日上限（{{ item.unit }}）</span>
                  <el-input-number
                    v-model="quotaForm[item.key as 'image' | 'agent']"
                    :min="0"
                    :max="1000"
                    controls-position="right"
                    :disabled="saving || !can('closet:quota:write')"
                  />
                </label>
              </div>
            </div>
            <div v-if="can('closet:quota:write')" class="mt-4 flex gap-2">
              <el-button type="primary" :loading="saving" @click="saveQuota()"
                >保存额度</el-button
              >
              <el-button
                :disabled="
                  saving ||
                  (!detail.quota.image.overridden &&
                    !detail.quota.agent.overridden)
                "
                @click="saveQuota(true)"
                >恢复默认</el-button
              >
            </div>
          </el-tab-pane>

          <el-tab-pane label="账号记录" name="events">
            <el-empty
              v-if="!events.length"
              description="暂无账号记录"
              :image-size="72"
            />
            <el-timeline v-else class="pl-1 pt-1">
              <el-timeline-item
                v-for="(event, index) in events"
                :key="index"
                :timestamp="dateTime(event.occurredAtMs)"
                placement="top"
                :type="actionSourceTypes[actionSource(event.action)]"
              >
                <div class="flex flex-wrap items-baseline gap-2">
                  <strong>{{ accountActionName(event.action) }}</strong>
                  <span class="text-xs text-[var(--el-text-color-secondary)]">{{
                    actorLabel(event.actor, detail.username)
                  }}</span>
                </div>
                <p
                  v-if="event.detail"
                  class="text-sm text-[var(--el-text-color-regular)]"
                >
                  {{ eventDetailText(event.detail) }}
                </p>
              </el-timeline-item>
            </el-timeline>
            <p class="text-xs text-[var(--el-text-color-secondary)]">
              显示最近 50 条，完整记录见“账号审计”。
            </p>
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

<style scoped>
.drawer-body {
  min-height: 240px;
}

.profile {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding-right: 32px;
  margin-bottom: 16px;
}

.close-button {
  position: absolute;
  top: -4px;
  right: -8px;
}

.avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 50%;
}

.avatar-muted {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}

.name-line {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 2px;
  color: var(--el-text-color-regular);
}

.name-edit {
  display: flex;
  gap: 8px;
  max-width: 420px;
  margin-top: 6px;
}

.meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.text-placeholder {
  color: var(--el-text-color-placeholder);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

@media (width <= 560px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.stat span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lock {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 20px;
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-7);
  border-radius: 8px;
}

.lock.locked {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}

.lock p {
  margin-top: 2px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.quota-card {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.quota-usage {
  margin: 10px 0 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.quota-limit {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.quota-usage b {
  font-size: 18px;
  color: var(--el-text-color-primary);
}
</style>
