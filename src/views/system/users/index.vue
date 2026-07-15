<script setup lang="ts">
import {
  getAdminUser,
  listUsers,
  revokeUserSessions,
  updateUserStatus,
  type AdminUser,
  type UserStatus
} from "@/api/admin-users";
import {
  assignUserRole,
  listRoles,
  removeUserRole,
  type Role
} from "@/api/rbac";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { onMounted, ref } from "vue";
import {
  adminCodeLabel,
  adminCodeTooltip
} from "../admin-code-presentation.mjs";

defineOptions({ name: "UserManagement" });
const { can } = useCurrentPermissions();
const loading = ref(false),
  detailLoading = ref(false),
  drawer = ref(false);
const rows = ref<AdminUser[]>([]),
  selected = ref<AdminUser>(),
  roles = ref<Role[]>([]);
const query = ref(""),
  status = ref<UserStatus | undefined>(),
  page = ref(0),
  size = ref(20),
  total = ref(0),
  assigningRole = ref<string>();
const statusOptions: UserStatus[] = ["ACTIVE", "LOCKED", "DISABLED"];
const load = async () => {
  loading.value = true;
  try {
    const { data } = await listUsers({
      q: query.value || undefined,
      status: status.value,
      page: page.value,
      size: size.value
    });
    rows.value = data.items;
    total.value = data.totalElements;
  } finally {
    loading.value = false;
  }
};
const openDetail = async (row: AdminUser) => {
  drawer.value = true;
  detailLoading.value = true;
  try {
    selected.value = (await getAdminUser(row.id)).data;
    roles.value = (await listRoles()).data;
  } finally {
    detailLoading.value = false;
  }
};
const changeStatus = async (value: UserStatus) => {
  if (!selected.value) return;
  selected.value = (await updateUserStatus(selected.value.id, value)).data;
  await load();
  message("账号状态已更新", { type: "success" });
};
const addRole = async () => {
  if (!selected.value || !assigningRole.value) return;
  await assignUserRole(selected.value.id, assigningRole.value);
  selected.value = (await getAdminUser(selected.value.id)).data;
  assigningRole.value = undefined;
  message("角色已分配", { type: "success" });
};
const removeRole = async (code: string) => {
  if (!selected.value) return;
  await removeUserRole(selected.value.id, code);
  selected.value = (await getAdminUser(selected.value.id)).data;
};
const revoke = async () => {
  if (!selected.value) return;
  await ElMessageBox.confirm(
    "将使该用户的所有登录会话失效，是否继续？",
    "撤销会话",
    { type: "warning" }
  );
  await revokeUserSessions(selected.value.id);
  message("用户会话已撤销", { type: "success" });
};
onMounted(load);
</script>

<template>
  <div class="page-root">
    <el-card shadow="never">
      <template #header
        ><div class="flex flex-wrap items-center gap-2">
          <span class="mr-auto">用户管理</span
          ><el-input
            v-model="query"
            class="!w-52"
            clearable
            placeholder="用户名或显示名"
            @keyup.enter="
              page = 0;
              load();
            "
          /><el-select
            v-model="status"
            class="!w-32"
            clearable
            placeholder="状态"
            @change="
              page = 0;
              load();
            "
            ><el-option
              v-for="item in statusOptions"
              :key="item"
              :label="adminCodeLabel('userStatus', item)"
              :value="item" /></el-select
          ><el-button
            type="primary"
            @click="
              page = 0;
              load();
            "
            >查询</el-button
          >
        </div></template
      >
      <el-table v-loading="loading" :data="rows" @row-click="openDetail"
        ><el-table-column
          prop="username"
          label="用户名"
          min-width="150"
        /><el-table-column
          prop="displayName"
          label="显示名"
          min-width="140"
        /><el-table-column label="状态" width="110"
          ><template #default="{ row }"
            ><el-tooltip :content="adminCodeTooltip('userStatus', row.status)"
              ><el-tag
                :type="
                  row.status === 'ACTIVE'
                    ? 'success'
                    : row.status === 'LOCKED'
                      ? 'warning'
                      : 'danger'
                "
                >{{ adminCodeLabel("userStatus", row.status) }}</el-tag
              ></el-tooltip
            ></template
          ></el-table-column
        ><el-table-column label="角色" min-width="220"
          ><template #default="{ row }"
            ><el-tooltip
              v-for="role in row.roles"
              :key="role"
              :content="adminCodeTooltip('role', role)"
              ><el-tag class="mr-1">{{ adminCodeLabel("role", role) }}</el-tag>
              ></el-tooltip
            ></template
          ></el-table-column
        ><el-table-column label="操作" width="90" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click.stop="openDetail(row)"
              >详情</el-button
            ></template
          ></el-table-column
        ></el-table
      >
      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:page-size="size"
          background
          layout="total, sizes, prev, pager, next"
          :current-page="page + 1"
          :total="total"
          @current-change="
            value => {
              page = value - 1;
              load();
            }
          "
          @size-change="
            value => {
              size = value;
              page = 0;
              load();
            }
          "
        />
      </div>
    </el-card>
    <el-drawer v-model="drawer" title="用户详情" size="480px"
      ><div v-if="selected" v-loading="detailLoading" class="space-y-5">
        <el-descriptions :column="1" border
          ><el-descriptions-item label="用户名">{{
            selected.username
          }}</el-descriptions-item
          ><el-descriptions-item label="显示名">{{
            selected.displayName
          }}</el-descriptions-item></el-descriptions
        ><el-divider content-position="left">账号状态</el-divider
        ><el-select
          :model-value="selected.status"
          :disabled="!can('system:user:write')"
          @update:model-value="changeStatus"
          ><el-option
            v-for="item in statusOptions"
            :key="item"
            :label="adminCodeLabel('userStatus', item)"
            :value="item" /></el-select
        ><el-button
          v-if="can('system:user:write')"
          class="ml-2"
          type="danger"
          plain
          @click="revoke"
          >撤销全部会话</el-button
        ><el-divider content-position="left">角色</el-divider>
        <div>
          <el-tag
            v-for="role in selected.roles"
            :key="role"
            :closable="can('system:role:assign')"
            :disable-transitions="false"
            class="mr-2 mb-2"
            @close="removeRole(role)"
            >{{ adminCodeLabel("role", role) }}</el-tag
          >
        </div>
        <div v-if="can('system:role:assign')" class="flex gap-2">
          <el-select v-model="assigningRole" filterable placeholder="选择角色"
            ><el-option
              v-for="role in roles.filter(
                role => !selected?.roles.includes(role.code)
              )"
              :key="role.code"
              :label="`${role.code} · ${role.displayName}`"
              :value="role.code" /></el-select
          ><el-button type="primary" @click="addRole">分配</el-button>
        </div>
      </div></el-drawer
    >
  </div>
</template>
