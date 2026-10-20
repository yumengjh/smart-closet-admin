<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  listClosetAccountEvents,
  type AccountAuditEvent
} from "@/api/closet/users";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import {
  accountActionName,
  accountActionNames,
  actionSource,
  actionSourceTypes,
  actorLabel,
  dateTime,
  eventDetailText
} from "../accountLabels";
import { useClosetRequest } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import UserDetailDrawer from "../users/UserDetailDrawer.vue";
import { message } from "@/utils/message";
defineOptions({ name: "ClosetAccountEvents" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const dates = ref<[string, string]>();
const username = ref("");
const actor = ref("");
const action = ref("");
const page = ref(1);
const size = ref(20);
const total = ref(0);
const rows = ref<AccountAuditEvent[]>([]);
const detailOpen = ref(false);
const selected = ref<{ username: string }>();
const load = () => {
  if (!can("closet:user:read")) return;
  const actionCode = action.value.trim();
  if (actionCode && !/^[A-Z_]{1,48}$/.test(actionCode)) {
    message("动作码需为 1–48 位大写字母或下划线", { type: "warning" });
    return;
  }
  return run(
    () =>
      listClosetAccountEvents({
        from: dates.value?.[0],
        to: dates.value?.[1],
        username: username.value.trim() || undefined,
        actor: actor.value.trim() || undefined,
        action: actionCode || undefined,
        page: page.value - 1,
        size: size.value
      }),
    result => {
      rows.value = result.data.items;
      total.value = result.data.totalElements;
    }
  );
};
const search = () => {
  page.value = 1;
  void load();
};
const filtered = () =>
  Boolean(
    dates.value || username.value.trim() || actor.value.trim() || action.value
  );
const reset = () => {
  dates.value = undefined;
  username.value = "";
  actor.value = "";
  action.value = "";
  search();
};
const sourceNames = {
  self: "用户本人",
  admin: "鱼搭管理员",
  platform: "管理平台"
};
const openUser = (value: string) => {
  selected.value = { username: value };
  detailOpen.value = true;
};
onMounted(() => void load());
</script>
<template>
  <div class="page-root">
    <el-card shadow="never">
      <template #header>
        <div>
          <h2 class="text-base font-semibold">账号审计</h2>
          <p class="text-xs text-[var(--el-text-color-secondary)]">
            注册、登录、改密码、资料修改，以及鱼搭管理员和管理平台的账号操作；保留
            180 天。
          </p>
        </div>
      </template>
      <div class="toolbar">
        <el-date-picker
          v-model="dates"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          unlink-panels
          @change="search"
        />
        <el-input
          v-model="username"
          clearable
          maxlength="80"
          placeholder="用户名"
          @keyup.enter="search"
          @clear="search"
        />
        <el-select
          v-model="action"
          filterable
          allow-create
          default-first-option
          clearable
          placeholder="全部动作"
          @change="search"
          ><el-option
            v-for="(label, value) in accountActionNames"
            :key="value"
            :label="label"
            :value="value"
        /></el-select>
        <el-input
          v-model="actor"
          clearable
          placeholder="操作者账号"
          @keyup.enter="search"
          @clear="search"
        />
        <el-button
          v-if="can('closet:user:read')"
          type="primary"
          plain
          :loading="loading"
          @click="search"
          >查询</el-button
        >
        <el-button v-if="filtered()" link @click="reset">清空筛选</el-button>
      </div>
      <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
      <el-alert
        v-else-if="errorMessage"
        :title="errorMessage"
        type="error"
        :closable="false"
        ><el-button link @click="load">重试</el-button></el-alert
      >
      <template v-else>
        <el-table
          v-loading="loading"
          :data="rows"
          row-key="id"
          :empty-text="filtered() ? '没有符合条件的记录' : '暂无账号记录'"
        >
          <el-table-column label="时间" width="150">
            <template #default="{ row }"
              ><span class="tabular-nums">{{
                dateTime(row.occurredAtMs)
              }}</span></template
            >
          </el-table-column>
          <el-table-column label="用户" min-width="130">
            <template #default="{ row }"
              ><el-link
                v-if="can('closet:user:read')"
                type="primary"
                :underline="false"
                @click="openUser(row.username)"
                >{{ row.username }}</el-link
              ><span v-else>{{ row.username }}</span></template
            >
          </el-table-column>
          <el-table-column label="动作" min-width="190">
            <template #default="{ row }">
              <el-tooltip :content="row.action" placement="top-start"
                ><el-tag
                  :type="actionSourceTypes[actionSource(row.action)]"
                  effect="plain"
                  >{{ accountActionName(row.action) }}</el-tag
                ></el-tooltip
              >
            </template>
          </el-table-column>
          <el-table-column label="操作者" min-width="150">
            <template #default="{ row }">
              <div class="truncate">
                {{ actorLabel(row.actor, row.username) }}
              </div>
              <div
                v-if="actionSource(row.action) !== 'self'"
                class="text-xs text-[var(--el-text-color-secondary)]"
              >
                {{ sourceNames[actionSource(row.action)] }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="详情" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{
              eventDetailText(row.detail) || "—"
            }}</template>
          </el-table-column>
        </el-table>
        <div class="mt-4 flex justify-end">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="size"
            background
            :total="total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="load"
            @size-change="search"
          />
        </div>
      </template>
    </el-card>
    <UserDetailDrawer v-model="detailOpen" :user="selected" @changed="load" />
  </div>
</template>

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns:
    minmax(240px, 1.6fr) repeat(3, minmax(140px, 1fr))
    auto auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.toolbar :deep(.el-date-editor) {
  width: 100%;
}

@media (width <= 1100px) {
  .toolbar {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}
</style>
