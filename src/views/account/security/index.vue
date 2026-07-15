<script setup lang="ts">
import {
  changeMyPassword,
  getCurrentUser,
  listMySessions,
  revokeAllMySessions,
  updateMyProfile,
  type Session
} from "@/api/user";
import { router } from "@/router";
import { useUserStoreHook } from "@/store/modules/user";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import {
  adminCodeLabel,
  adminCodeTooltip
} from "../../system/admin-code-presentation.mjs";
defineOptions({ name: "AccountSecurity" });
const profile = reactive({
  username: "",
  displayName: "",
  roles: [] as string[]
});
const password = reactive({ currentPassword: "", newPassword: "" });
const sessions = ref<Session[]>([]),
  loading = ref(false);
const load = async () => {
  loading.value = true;
  try {
    const [user, currentSessions] = await Promise.all([
      getCurrentUser(),
      listMySessions()
    ]);
    Object.assign(profile, {
      username: user.data.username,
      displayName: user.data.displayName,
      roles: user.data.roles
    });
    sessions.value = currentSessions.data;
  } finally {
    loading.value = false;
  }
};
const saveProfile = async () => {
  await updateMyProfile(profile.displayName);
  await useUserStoreHook().loadProfile();
  message("个人资料已保存", { type: "success" });
};
const savePassword = async () => {
  await changeMyPassword(password.currentPassword, password.newPassword);
  Object.assign(password, { currentPassword: "", newPassword: "" });
  message("密码已修改，请妥善保管", { type: "success" });
};
const logout = () => useUserStoreHook().logOut();
const sessionStatus = (status: Session["status"]) =>
  ({
    ACTIVE: ["有效", "success"],
    REVOKED: ["已退出", "info"],
    EXPIRED: ["已过期", "warning"],
    ROTATED: ["已轮换", "info"]
  })[status] as [string, "success" | "info" | "warning"];
const revokeAll = async () => {
  await ElMessageBox.confirm(
    "这会立即退出包括当前设备在内的所有登录会话，是否继续？",
    "退出全部设备",
    { type: "warning" }
  );
  await revokeAllMySessions();
  useUserStoreHook().clearSession();
  await router.replace("/login");
};
onMounted(load);
</script>
<template>
  <div v-loading="loading" class="grid gap-4 xl:grid-cols-2">
    <el-card shadow="never"
      ><template #header>个人资料</template
      ><el-form label-width="90px"
        ><el-form-item label="用户名"
          ><el-input :model-value="profile.username" disabled /></el-form-item
        ><el-form-item label="显示名"
          ><el-input v-model="profile.displayName" /></el-form-item
        ><el-form-item label="角色"
          ><el-tooltip
            v-for="role in profile.roles"
            :key="role"
            :content="adminCodeTooltip('role', role)"
            ><el-tag class="mr-2">{{ adminCodeLabel("role", role) }}</el-tag>
            ></el-tooltip
          ></el-form-item
        ><el-form-item
          ><el-button type="primary" @click="saveProfile"
            >保存资料</el-button
          ></el-form-item
        ></el-form
      ></el-card
    ><el-card shadow="never"
      ><template #header>修改密码</template
      ><el-form label-width="100px"
        ><el-form-item label="当前密码"
          ><el-input
            v-model="password.currentPassword"
            type="password"
            show-password /></el-form-item
        ><el-form-item label="新密码"
          ><el-input
            v-model="password.newPassword"
            type="password"
            show-password
          />
          <div class="text-xs text-gray-400">至少 10 个字符</div></el-form-item
        ><el-form-item
          ><el-button type="primary" @click="savePassword"
            >更新密码</el-button
          ></el-form-item
        ></el-form
      ></el-card
    ><el-card class="xl:col-span-2" shadow="never"
      ><template #header
        ><div class="flex flex-wrap items-center justify-between gap-3">
          <span>登录会话</span>
          <div class="flex flex-wrap gap-2">
            <el-button type="warning" plain @click="logout"
              >退出当前登录</el-button
            ><el-button type="danger" plain @click="revokeAll"
              >退出全部设备</el-button
            >
          </div>
        </div></template
      ><el-alert
        title="每个登录设备只显示一条会话。令牌轮换不会新增会话；刷新令牌由 HttpOnly Cookie 管理，访问令牌仅保存在内存。"
        type="info"
        :closable="false"
        class="mb-4"
      /><el-empty
        v-if="sessions.length === 0"
        description="暂无登录会话"
      /><el-table v-else :data="sessions"
        ><el-table-column label="首次登录" min-width="180"
          ><template #default="{ row }">{{
            new Date(row.firstIssuedAt).toLocaleString()
          }}</template></el-table-column
        ><el-table-column label="最近活动" min-width="180"
          ><template #default="{ row }">{{
            new Date(row.lastActiveAt).toLocaleString()
          }}</template></el-table-column
        ><el-table-column label="到期时间" min-width="180"
          ><template #default="{ row }">{{
            new Date(row.expiresAt).toLocaleString()
          }}</template></el-table-column
        ><el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag :type="sessionStatus(row.status)[1]">{{
              sessionStatus(row.status)[0]
            }}</el-tag></template
          ></el-table-column
        ></el-table
      ></el-card
    >
  </div>
</template>
