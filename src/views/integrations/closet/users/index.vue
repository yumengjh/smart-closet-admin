<script setup lang="ts">
import {
  listClosetUsers,
  type ClosetRole,
  type ClosetUserStatus,
  type ClosetUserSummary
} from "@/api/closet/users";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import CreateUserDialog from "./CreateUserDialog.vue";
import TemporaryPasswordDialog from "./TemporaryPasswordDialog.vue";
import UserDetailDrawer from "./UserDetailDrawer.vue";
import { message } from "@/utils/message";
import { onMounted, ref } from "vue";

defineOptions({ name: "ClosetUserManagement" });
const { can } = useCurrentPermissions();
const loading = ref(false);
const unavailable = ref(false);
const rows = ref<ClosetUserSummary[]>([]);
const query = ref("");
const status = ref<ClosetUserStatus>();
const role = ref<ClosetRole>();
const sort = ref<"createdAt" | "username" | "lastActiveAt">("createdAt");
const order = ref<"asc" | "desc">("desc");
const page = ref(0);
const size = ref(20);
const total = ref(0);
const detailOpen = ref(false);
const createOpen = ref(false);
const selected = ref<ClosetUserSummary>();
const passwordOpen = ref(false);
const temporaryPassword = ref("");
const dateText = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : "暂无";
const load = async () => {
  loading.value = true;
  unavailable.value = false;
  try {
    const { data } = await listClosetUsers({
      q: query.value.trim() || undefined,
      status: status.value,
      role: role.value,
      sort: sort.value,
      order: order.value,
      page: page.value,
      size: size.value
    });
    rows.value = data.items;
    total.value = data.totalElements;
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("读取业务用户失败", { type: "error" });
  } finally {
    loading.value = false;
  }
};
const search = () => {
  page.value = 0;
  void load();
};
const onSortChange = ({
  prop,
  order: direction
}: {
  prop?: string;
  order?: string;
}) => {
  const sortMap: Record<string, typeof sort.value> = {
    createdAtMs: "createdAt",
    username: "username",
    lastActiveAtMs: "lastActiveAt"
  };
  if (!prop || !direction || !sortMap[prop]) {
    sort.value = "createdAt";
    order.value = "desc";
  } else {
    sort.value = sortMap[prop];
    order.value = direction === "ascending" ? "asc" : "desc";
  }
  page.value = 0;
  void load();
};
const openDetail = (row: ClosetUserSummary) => {
  selected.value = row;
  detailOpen.value = true;
};
const onCreated = (result: {
  username: string;
  temporaryPassword: string | null;
}) => {
  if (result.temporaryPassword) {
    temporaryPassword.value = result.temporaryPassword;
    passwordOpen.value = true;
  }
  void load();
};
const clearPassword = () => {
  temporaryPassword.value = "";
};
onMounted(load);
</script>

<template>
  <div class="page-root">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-auto font-medium">业务用户</span>
          <el-input
            v-model="query"
            class="!w-56"
            clearable
            placeholder="按用户名搜索"
            @keyup.enter="search"
          />
          <el-select
            v-model="status"
            class="!w-32"
            clearable
            placeholder="账号状态"
            @change="search"
          >
            <el-option label="已启用" value="ENABLED" /><el-option
              label="已禁用"
              value="DISABLED"
            />
          </el-select>
          <el-select
            v-model="role"
            class="!w-32"
            clearable
            placeholder="角色"
            @change="search"
          >
            <el-option label="普通用户" value="USER" /><el-option
              label="管理员"
              value="ADMIN"
            />
          </el-select>
          <el-button type="primary" @click="search">查询</el-button>
          <el-button v-if="can('closet:user:write')" @click="createOpen = true"
            >创建用户</el-button
          >
        </div>
      </template>
      <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
      <template v-else>
        <el-table
          v-loading="loading"
          :data="rows"
          row-key="username"
          @row-click="openDetail"
          @sort-change="onSortChange"
        >
          <el-table-column
            prop="username"
            label="用户名"
            min-width="150"
            sortable="custom"
          />
          <el-table-column label="角色" width="120"
            ><template #default="{ row }">{{
              row.role === "ADMIN" ? "管理员" : "普通用户"
            }}</template></el-table-column
          >
          <el-table-column label="状态" width="110"
            ><template #default="{ row }"
              ><el-tag :type="row.enabled ? 'success' : 'info'">{{
                row.enabled ? "已启用" : "已禁用"
              }}</el-tag></template
            ></el-table-column
          >
          <el-table-column label="首次登录改密" width="135"
            ><template #default="{ row }">{{
              row.mustChangePassword ? "需要" : "不需要"
            }}</template></el-table-column
          >
          <el-table-column
            prop="lastActiveAtMs"
            min-width="180"
            sortable="custom"
            ><template #header>
              <el-tooltip
                content="取未过期会话的最近访问时间，会话清理后该时间可能不可见。"
              >
                <span>最近会话活跃</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">{{
              dateText(row.lastActiveAtMs)
            }}</template></el-table-column
          >
          <el-table-column prop="activeSessionCount" label="会话" width="82" />
          <el-table-column prop="garmentCount" label="衣物" width="82" />
          <el-table-column prop="outfitCount" label="搭配" width="82" />
          <el-table-column
            prop="createdAtMs"
            label="创建时间"
            min-width="180"
            sortable="custom"
            ><template #default="{ row }">{{
              dateText(row.createdAtMs)
            }}</template></el-table-column
          >
          <el-table-column label="操作" width="80" fixed="right"
            ><template #default="{ row }"
              ><el-button link type="primary" @click.stop="openDetail(row)"
                >详情</el-button
              ></template
            ></el-table-column
          >
        </el-table>
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
      </template>
    </el-card>
    <UserDetailDrawer v-model="detailOpen" :user="selected" @changed="load" />
    <CreateUserDialog
      v-model="createOpen"
      @created="onCreated"
      @unavailable="unavailable = true"
    />
    <TemporaryPasswordDialog
      v-model="passwordOpen"
      :password="temporaryPassword"
      @closed="clearPassword"
    />
  </div>
</template>
