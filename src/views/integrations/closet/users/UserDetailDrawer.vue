<script setup lang="ts">
import {
  getClosetUser,
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

const props = defineProps<{ modelValue: boolean; user?: ClosetUserSummary }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  changed: [];
}>();
const router = useRouter();
const { can } = useCurrentPermissions();
const detail = ref<ClosetUserDetail>();
const sessions = ref<ClosetSession[]>([]);
const links = ref<PortableLink[]>([]);
const loading = ref(false);
const unavailable = ref(false);
const tempPasswordOpen = ref(false);
const temporaryPassword = ref("");
const quotaForm = reactive<{ image: number; agent: number }>({
  image: 0,
  agent: 0
});
const dateText = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : "暂无";

const load = async () => {
  if (!props.user) return;
  loading.value = true;
  unavailable.value = false;
  try {
    const username = props.user.username;
    const [userResponse, sessionResponse, linkResponse] = await Promise.all([
      getClosetUser(username),
      listClosetUserSessions(username),
      listPortableLinks(username)
    ]);
    detail.value = userResponse.data;
    sessions.value = sessionResponse.data;
    links.value = linkResponse.data;
    quotaForm.image = detail.value.quota.image.limit;
    quotaForm.agent = detail.value.quota.agent.limit;
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("读取用户详情失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};
watch(
  () => [props.modelValue, props.user?.username] as const,
  ([open]) => {
    if (open) void load();
    else {
      detail.value = undefined;
      sessions.value = [];
      links.value = [];
    }
  }
);
const updateStatus = async () => {
  if (!detail.value) return;
  const enabled = !detail.value.enabled;
  if (!enabled)
    await ElMessageBox.confirm(
      "禁用后将撤销该用户的便携登录链接和全部会话，用户会立即退出全部设备。",
      "禁用业务用户",
      { type: "warning", confirmButtonText: "确认禁用" }
    );
  try {
    await updateClosetUserStatus(detail.value.username, enabled);
    message(enabled ? "用户已启用" : "用户已禁用", { type: "success" });
    await load();
    emit("changed");
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("更新账号状态失败", { type: "error" });
  }
};
const updateRole = async (role: "USER" | "ADMIN") => {
  if (!detail.value || role === detail.value.role) return;
  if (detail.value.role === "ADMIN" && role === "USER")
    await ElMessageBox.confirm(
      "降级后该用户将失去管理员权限，全部会话会被删除并要求重新登录。",
      "降级管理员",
      { type: "warning", confirmButtonText: "确认降级" }
    );
  try {
    await updateClosetUserRole(detail.value.username, role);
    message("用户角色已更新", { type: "success" });
    await load();
    emit("changed");
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else
      message("更新角色失败，最后一个启用的管理员不能降级", { type: "error" });
  }
};
const resetPassword = async () => {
  if (!detail.value) return;
  await ElMessageBox.confirm(
    "重置后现有便携登录链接和全部会话会失效，用户需要用新密码登录并立即修改密码。",
    "重置用户密码",
    { type: "warning", confirmButtonText: "重置密码" }
  );
  try {
    const { data } = await resetClosetUserPassword(detail.value.username);
    if (data.temporaryPassword) {
      temporaryPassword.value = data.temporaryPassword;
      tempPasswordOpen.value = true;
    }
    message("用户密码已重置", { type: "success" });
    await load();
    emit("changed");
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("重置密码失败", { type: "error" });
  }
};
const revokeSessions = async () => {
  if (!detail.value) return;
  await ElMessageBox.confirm("将立即退出该用户全部设备。", "强制下线", {
    type: "warning",
    confirmButtonText: "退出全部设备"
  });
  try {
    await revokeClosetUserSessions(detail.value.username);
    message("已退出该用户全部设备", { type: "success" });
    await load();
    emit("changed");
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("撤销会话失败", { type: "error" });
  }
};
const revokeLink = async (link: PortableLink) => {
  if (!detail.value) return;
  await ElMessageBox.confirm("该便携登录链接将立即失效。", "吊销便携链接", {
    type: "warning",
    confirmButtonText: "吊销链接"
  });
  try {
    await revokePortableLink(detail.value.username, link.id);
    await load();
    message("便携登录链接已吊销", { type: "success" });
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("吊销便携链接失败", { type: "error" });
  }
};
const saveQuota = async (restore = false) => {
  if (!detail.value) return;
  try {
    const { data } = await updateClosetUserQuota(detail.value.username, {
      imageDailyLimit: restore ? null : quotaForm.image,
      agentDailyLimit: restore ? null : quotaForm.agent
    });
    detail.value.quota = data;
    quotaForm.image = data.image.limit;
    quotaForm.agent = data.agent.limit;
    message(restore ? "额度已恢复默认" : "额度已保存", { type: "success" });
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("保存额度失败，请确认数值在 0–1000 之间", { type: "error" });
  }
};
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
        <el-descriptions :column="2" border>
          <el-descriptions-item label="角色">{{
            detail.role === "ADMIN" ? "管理员" : "普通用户"
          }}</el-descriptions-item>
          <el-descriptions-item label="账号状态">{{
            detail.enabled ? "已启用" : "已禁用"
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
        <div class="flex flex-wrap gap-2">
          <el-button
            v-if="can('closet:user:write')"
            :type="detail.enabled ? 'danger' : 'success'"
            plain
            @click="updateStatus"
          >
            {{ detail.enabled ? "禁用用户" : "启用用户" }}
          </el-button>
          <el-button v-if="can('closet:user:write')" @click="revokeSessions"
            >强制下线</el-button
          >
          <el-button
            v-if="can('closet:user:reset-password')"
            type="warning"
            plain
            @click="resetPassword"
            >重置密码</el-button
          >
          <el-select
            v-if="can('closet:user:write')"
            :model-value="detail.role"
            class="!w-36"
            aria-label="用户角色"
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
              :disabled="sessions.length === 0"
              @click="revokeSessions"
              >退出全部设备</el-button
            >
          </div>
          <el-table :data="sessions" size="small" empty-text="没有有效会话">
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
          </el-table>
        </section>
        <section>
          <h4 class="mb-2 font-medium">便携登录链接</h4>
          <el-table :data="links" size="small" empty-text="没有便携登录链接">
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
                ><el-button link type="danger" @click="revokeLink(row)"
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
                :disabled="!can('closet:quota:write')"
            /></el-form-item>
            <el-form-item label="Agent 消息 / 日"
              ><el-input-number
                v-model="quotaForm.agent"
                :min="0"
                :max="1000"
                :disabled="!can('closet:quota:write')"
            /></el-form-item>
          </div>
          <p class="mb-3 text-sm text-gray-500">
            今日已用：图片 {{ detail.quota.image.used }}，Agent
            {{ detail.quota.agent.used }}。图片额度{{
              detail.quota.image.overridden ? "为自定义值" : "使用系统默认值"
            }}，Agent 额度{{
              detail.quota.agent.overridden ? "为自定义值" : "使用系统默认值"
            }}。
          </p>
          <div v-if="can('closet:quota:write')" class="flex gap-2">
            <el-button type="primary" @click="saveQuota()">保存额度</el-button
            ><el-button @click="saveQuota(true)">恢复默认</el-button>
          </div>
        </section>
      </template>
    </div>
    <TemporaryPasswordDialog
      v-model="tempPasswordOpen"
      :password="temporaryPassword"
      @closed="clearTemporaryPassword"
    />
  </el-drawer>
</template>
