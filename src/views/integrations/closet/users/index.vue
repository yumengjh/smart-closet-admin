<script setup lang="ts">
import {
  listClosetUsers,
  type ClosetUserQuery,
  type RegisteredVia,
  type ClosetRole,
  type ClosetUserStatus,
  type ClosetUserSummary
} from "@/api/closet/users";
import { useClosetRequest } from "../useClosetRequest";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import CreateUserDialog from "./CreateUserDialog.vue";
import TemporaryPasswordDialog from "./TemporaryPasswordDialog.vue";
import UserDetailDrawer from "./UserDetailDrawer.vue";
import { computed, onMounted, ref } from "vue";
import {
  dateTime,
  initial,
  lastSeen,
  registeredViaNames
} from "../accountLabels";

defineOptions({ name: "ClosetUserManagement" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const rows = ref<ClosetUserSummary[]>([]);
const query = ref("");
const status = ref<ClosetUserStatus>();
const role = ref<ClosetRole>();
const registeredVia = ref<RegisteredVia>();
const deactivated = ref<boolean>();
const sort = ref<ClosetUserQuery["sort"]>("createdAt");
const order = ref<"asc" | "desc">("desc");
const page = ref(0);
const size = ref(20);
const total = ref(0);
const detailOpen = ref(false);
const createOpen = ref(false);
const selected = ref<ClosetUserSummary>();
const passwordOpen = ref(false);
const temporaryPassword = ref("");
const filtered = computed(
  () =>
    Boolean(query.value.trim()) ||
    Boolean(status.value) ||
    Boolean(role.value) ||
    Boolean(registeredVia.value) ||
    typeof deactivated.value === "boolean"
);
const load = async () => {
  if (!can("closet:user:read")) return;
  return run(
    () =>
      listClosetUsers({
        q: query.value.trim() || undefined,
        status: status.value || undefined,
        role: role.value || undefined,
        registeredVia: registeredVia.value || undefined,
        deactivated:
          typeof deactivated.value === "boolean"
            ? deactivated.value
            : undefined,
        sort: sort.value,
        order: order.value,
        page: page.value,
        size: size.value
      }),
    ({ data }) => {
      rows.value = data.items;
      total.value = data.totalElements;
    }
  );
};
const search = () => {
  page.value = 0;
  void load();
};
const reset = () => {
  query.value = "";
  status.value = undefined;
  role.value = undefined;
  registeredVia.value = undefined;
  deactivated.value = undefined;
  search();
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
    lastLoginAtMs: "lastLoginAt"
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
  if (!can("closet:user:read")) return;
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
    <el-card shadow="never" class="closet-users">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <div class="mr-auto">
            <h2 class="text-base font-semibold">业务用户</h2>
            <p class="text-xs text-[var(--el-text-color-secondary)]">
              鱼搭用户端的账号，共 {{ total }} 位{{
                filtered ? "（已筛选）" : ""
              }}
            </p>
          </div>
          <el-button
            v-if="can('closet:user:write')"
            type="primary"
            @click="createOpen = true"
            >创建用户</el-button
          >
        </div>
      </template>
      <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
      <el-alert
        v-else-if="errorMessage"
        :title="errorMessage"
        type="error"
        :closable="false"
        ><el-button link @click="load">重试</el-button></el-alert
      >
      <template v-else>
        <div class="toolbar">
          <el-input
            v-model="query"
            class="toolbar-search"
            clearable
            placeholder="搜索用户名或昵称"
            @keyup.enter="search"
            @clear="search"
          />
          <el-select
            v-model="status"
            clearable
            placeholder="账号状态"
            @change="search"
          >
            <el-option label="已启用" value="ENABLED" />
            <el-option label="已禁用" value="DISABLED" />
          </el-select>
          <el-select
            v-model="role"
            clearable
            placeholder="角色"
            @change="search"
          >
            <el-option label="普通用户" value="USER" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
          <el-select
            v-model="registeredVia"
            clearable
            placeholder="注册来源"
            @change="search"
          >
            <el-option
              v-for="(label, value) in registeredViaNames"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
          <el-select
            v-model="deactivated"
            clearable
            placeholder="是否注销"
            @change="search"
          >
            <el-option label="未注销" :value="false" />
            <el-option label="已注销" :value="true" />
          </el-select>
          <el-button type="primary" plain @click="search">查询</el-button>
          <el-button v-if="filtered" link @click="reset">清空筛选</el-button>
        </div>
        <el-table
          v-loading="loading"
          :data="rows"
          row-key="username"
          class="clickable-rows"
          :empty-text="filtered ? '没有符合条件的用户' : '还没有业务用户'"
          @row-click="openDetail"
          @sort-change="onSortChange"
        >
          <el-table-column
            prop="username"
            label="用户"
            min-width="200"
            sortable="custom"
          >
            <template #default="{ row }">
              <div class="user-cell">
                <span
                  class="avatar"
                  :class="{ 'avatar-muted': !row.enabled }"
                  aria-hidden="true"
                  >{{ initial(row.displayName || row.username) }}</span
                >
                <div class="min-w-0">
                  <div class="truncate font-medium">{{ row.username }}</div>
                  <div
                    class="truncate text-xs text-[var(--el-text-color-secondary)]"
                  >
                    {{ row.displayName || "未设置昵称" }}
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="150">
            <template #default="{ row }">
              <div class="flex flex-wrap gap-1">
                <el-tag v-if="row.deactivatedAtMs" type="danger" effect="plain"
                  >已注销</el-tag
                >
                <el-tag
                  v-else
                  :type="row.enabled ? 'success' : 'info'"
                  effect="plain"
                  >{{ row.enabled ? "已启用" : "已禁用" }}</el-tag
                >
                <el-tag
                  v-if="row.role === 'ADMIN'"
                  type="warning"
                  effect="plain"
                  >管理员</el-tag
                >
                <el-tooltip
                  v-if="row.mustChangePassword"
                  content="用户下次登录时必须先修改密码"
                  ><el-tag type="info">待改密</el-tag></el-tooltip
                >
              </div>
            </template>
          </el-table-column>
          <el-table-column label="注册来源" min-width="110">
            <template #default="{ row }">{{
              registeredViaNames[row.registeredVia] ?? row.registeredVia ?? "—"
            }}</template>
          </el-table-column>
          <el-table-column label="衣物 / 搭配" min-width="100" align="right">
            <template #default="{ row }"
              ><span class="tabular-nums"
                >{{ row.garmentCount }} / {{ row.outfitCount }}</span
              ></template
            >
          </el-table-column>
          <el-table-column
            prop="lastLoginAtMs"
            label="最近登录"
            min-width="130"
            sortable="custom"
          >
            <template #default="{ row }">
              <el-tooltip
                :disabled="!lastSeen(row).at"
                :content="dateTime(lastSeen(row).at)"
                ><span>{{ lastSeen(row).label }}</span></el-tooltip
              >
              <div
                v-if="row.activeSessionCount"
                class="text-xs text-[var(--el-text-color-secondary)]"
              >
                {{ row.activeSessionCount }} 个在线会话
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="createdAtMs"
            label="创建时间"
            min-width="150"
            sortable="custom"
          >
            <template #default="{ row }">{{
              dateTime(row.createdAtMs)
            }}</template>
          </el-table-column>
          <el-table-column label="" width="72" fixed="right" align="right">
            <template #default="{ row }"
              ><el-button link type="primary" @click.stop="openDetail(row)"
                >详情</el-button
              ></template
            >
          </el-table-column>
        </el-table>
        <div class="mt-4 flex justify-end">
          <el-pagination
            v-model:page-size="size"
            background
            layout="total, sizes, prev, pager, next"
            :page-sizes="[20, 50, 100]"
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

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns:
    minmax(200px, 2fr) repeat(4, minmax(120px, 1fr))
    auto auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

@media (width <= 1100px) {
  .toolbar {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
}

.user-cell {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 50%;
}

.avatar-muted {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}

.clickable-rows :deep(.el-table__row) {
  cursor: pointer;
}
</style>
