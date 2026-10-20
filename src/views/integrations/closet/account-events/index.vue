<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  listClosetAccountEvents,
  type AccountAuditEvent
} from "@/api/closet/users";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { accountActionName, accountActionNames } from "../accountLabels";
import { useClosetRequest, formatTime } from "../useClosetRequest";
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
const openUser = (value: string) => {
  selected.value = { username: value };
  detailOpen.value = true;
};
onMounted(() => void load());
</script>
<template>
  <div class="page-root space-y-4">
    <el-card shadow="never">
      <h2 class="mb-4 text-lg font-semibold">账号审计</h2>
      <el-form inline @submit.prevent="search">
        <el-form-item label="日期"
          ><el-date-picker
            v-model="dates"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            class="!w-72"
        /></el-form-item>
        <el-form-item label="用户名"
          ><el-input
            v-model="username"
            clearable
            maxlength="80"
            placeholder="业务用户名"
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="动作"
          ><el-select
            v-model="action"
            filterable
            allow-create
            default-first-option
            clearable
            class="!w-60"
            placeholder="选择动作或输入动作码"
            ><el-option
              v-for="(label, value) in accountActionNames"
              :key="value"
              :label="label"
              :value="value" /></el-select
        ></el-form-item>
        <el-form-item label="操作者"
          ><el-input
            v-model="actor"
            clearable
            placeholder="操作者"
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item
          ><el-button
            v-if="can('closet:user:read')"
            type="primary"
            :loading="loading"
            @click="search"
            >查询记录</el-button
          ></el-form-item
        >
      </el-form>
    </el-card>
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      ><el-button link @click="load">重试</el-button></el-alert
    >
    <el-card v-else shadow="never">
      <el-table
        v-loading="loading"
        :data="rows"
        row-key="id"
        empty-text="暂无符合条件的账号记录"
      >
        <el-table-column label="时间" min-width="180"
          ><template #default="{ row }">{{
            formatTime(row.occurredAtMs)
          }}</template></el-table-column
        >
        <el-table-column label="用户名" min-width="150"
          ><template #default="{ row }"
            ><el-button
              v-if="can('closet:user:read')"
              link
              type="primary"
              @click="openUser(row.username)"
              >{{ row.username }}</el-button
            ><span v-else>{{ row.username }}</span></template
          ></el-table-column
        >
        <el-table-column label="动作" min-width="190"
          ><template #default="{ row }"
            ><el-tooltip :content="row.action"
              ><span>{{ accountActionName(row.action) }}</span></el-tooltip
            ></template
          ></el-table-column
        >
        <el-table-column
          prop="actor"
          label="操作者"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="detail"
          label="详情"
          min-width="240"
          show-overflow-tooltip
        />
      </el-table>
      <div class="mt-4 overflow-x-auto">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="load"
          @size-change="search"
        />
      </div>
    </el-card>
    <UserDetailDrawer v-model="detailOpen" :user="selected" @changed="load" />
  </div>
</template>
