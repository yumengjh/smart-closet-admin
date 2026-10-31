<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  checkClosetSecurityAuditIntegrity,
  listClosetSecurityAudit,
  type SecurityAuditCategory,
  type SecurityAuditIntegrity,
  type SecurityAuditItem
} from "@/api/closet/management";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { accountActionName, dateTime } from "../accountLabels";
import { useClosetRequest } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import UserDetailDrawer from "../users/UserDetailDrawer.vue";
defineOptions({ name: "ClosetSecurityAudit" });

const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const categoryNames: Record<SecurityAuditCategory, string> = {
  AUTH: "登录认证",
  ACCESS: "越权访问",
  ACCOUNT: "账号变更",
  INVITE: "邀请码",
  ASSISTANT: "助手操作",
  MANAGEMENT: "管理接口",
  MODEL: "模型调用"
};
const sourceNames: Record<SecurityAuditItem["source"], string> = {
  ACCOUNT_EVENT: "账号事件",
  MANAGEMENT_LOG: "管理日志",
  MODEL_USAGE: "模型用量",
  GENERATION_ATTEMPT: "生成尝试"
};
const integrityNames = {
  INTACT: ["记录完整", "success"],
  TAMPERED: ["发现篡改", "error"],
  EMPTY: ["尚无已封存的日子", "info"]
} as const;
const problemNames = {
  ROWS_MODIFIED: "当日记录被改动",
  CHAIN_BROKEN: "摘要链断开",
  DIGEST_ALTERED: "摘要被改动"
};
const resultType = (value?: string | null) =>
  !value
    ? "info"
    : ["SUCCESS", "OK", "SUCCEEDED"].includes(value)
      ? "success"
      : ["FAILURE", "FAILED"].includes(value)
        ? "danger"
        : "warning";

const dates = ref<[string, string]>();
const username = ref("");
const category = ref<SecurityAuditCategory>();
const type = ref("");
const page = ref(1);
const size = ref(20);
const total = ref(0);
const rows = ref<SecurityAuditItem[]>([]);
const integrity = ref<SecurityAuditIntegrity>();
const checking = ref(false);
const detailOpen = ref(false);
const selected = ref<{ username: string }>();

const load = () => {
  if (!can("closet:security:read")) return;
  const typeCode = type.value.trim();
  if (typeCode && !/^[A-Za-z0-9_]{1,64}$/.test(typeCode)) {
    message("事件类型需为 1–64 位字母、数字或下划线", { type: "warning" });
    return;
  }
  const name = username.value.trim();
  if (name && !/^[A-Za-z0-9_.-]{2,80}$/.test(name)) {
    message("用户名需为 2–80 位字母、数字、点、下划线或短横线", {
      type: "warning"
    });
    return;
  }
  return run(
    () =>
      listClosetSecurityAudit({
        from: dates.value?.[0],
        to: dates.value?.[1],
        username: name || undefined,
        category: category.value || undefined,
        type: typeCode || undefined,
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
    dates.value || username.value.trim() || category.value || type.value.trim()
  );
const reset = () => {
  dates.value = undefined;
  username.value = "";
  category.value = undefined;
  type.value = "";
  search();
};
const checkIntegrity = async () => {
  if (!can("closet:security:read") || checking.value) return;
  checking.value = true;
  try {
    integrity.value = (await checkClosetSecurityAuditIntegrity()).data;
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
    else message("校验失败，请稍后重试", { type: "error" });
  } finally {
    checking.value = false;
  }
};
/** Login failures carry a one-way key (~…) and system events use "-"; neither is an account to open. */
const isAccount = (subject: string) =>
  subject !== "-" && !subject.startsWith("~");
const openUser = (value: string) => {
  selected.value = { username: value };
  detailOpen.value = true;
};
onMounted(() => void load());
</script>

<template>
  <div class="page-root space-y-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">安全审计</h2>
            <p class="text-xs text-[var(--el-text-color-secondary)]">
              合并账号事件、管理接口操作日志与模型调用明细，新的在前；明细含用户名，仅限本页查看，不进大屏与数仓。
            </p>
          </div>
          <el-button
            v-if="can('closet:security:read')"
            :loading="checking"
            @click="checkIntegrity"
            >防篡改校验</el-button
          >
        </div>
      </template>
      <div v-if="integrity" class="mb-4">
        <el-alert
          :title="`校验结果：${integrityNames[integrity.status][0]}`"
          :type="integrityNames[integrity.status][1]"
          :closable="false"
          show-icon
        >
          <p class="text-sm">
            已封存 {{ integrity.sealedDays }} 天 · 记录与摘要均核对
            {{ integrity.verifiedDays }} 天 · 仅核对摘要链
            {{ integrity.expiredDays }} 天 · 待封存
            {{ integrity.unsealedDays }} 天
            <template v-if="integrity.latestDay">
              · 最后封存日 {{ integrity.latestDay }}</template
            >
          </p>
          <p
            v-if="integrity.latestDigest"
            class="break-all font-mono text-xs text-[var(--el-text-color-secondary)]"
          >
            最新摘要 {{ integrity.latestDigest }}
          </p>
        </el-alert>
        <el-table
          v-if="integrity.problems.length"
          class="mt-3"
          :data="integrity.problems"
          size="small"
        >
          <el-table-column prop="day" label="日期" width="120" />
          <el-table-column label="问题" width="160">
            <template #default="{ row }">
              <el-tooltip :content="row.kind" placement="top-start"
                ><el-tag type="danger" effect="plain">{{
                  problemNames[row.kind as keyof typeof problemNames] ??
                  row.kind
                }}</el-tag></el-tooltip
              >
            </template>
          </el-table-column>
          <el-table-column
            prop="message"
            label="说明"
            min-width="240"
            show-overflow-tooltip
          />
        </el-table>
      </div>
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
          v-model="category"
          clearable
          placeholder="全部类别"
          @change="search"
          ><el-option
            v-for="(label, value) in categoryNames"
            :key="value"
            :label="label"
            :value="value"
        /></el-select>
        <el-input
          v-model="type"
          clearable
          maxlength="64"
          placeholder="事件类型，如 LOGIN_FAILED"
          @keyup.enter="search"
          @clear="search"
        />
        <el-button
          v-if="can('closet:security:read')"
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
          :empty-text="filtered() ? '没有符合条件的记录' : '暂无安全审计记录'"
        >
          <el-table-column label="时间" width="150">
            <template #default="{ row }"
              ><span class="tabular-nums">{{
                dateTime(row.occurredAtMs)
              }}</span></template
            >
          </el-table-column>
          <el-table-column label="类别" width="110">
            <template #default="{ row }">
              <el-tag effect="plain">{{
                categoryNames[row.category as SecurityAuditCategory] ??
                row.category
              }}</el-tag>
              <div class="text-xs text-[var(--el-text-color-secondary)]">
                {{
                  sourceNames[row.source as SecurityAuditItem["source"]] ??
                  row.source
                }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="事件" min-width="170">
            <template #default="{ row }">
              <el-tooltip :content="row.type" placement="top-start"
                ><span>{{ accountActionName(row.type) }}</span></el-tooltip
              >
            </template>
          </el-table-column>
          <el-table-column label="账号" min-width="140">
            <template #default="{ row }">
              <el-link
                v-if="isAccount(row.subject) && can('closet:user:read')"
                type="primary"
                :underline="false"
                @click="openUser(row.subject)"
                >{{ row.subject }}</el-link
              >
              <el-tooltip
                v-else-if="row.subject.startsWith('~')"
                content="登录名的单向键，不还原登录名"
                placement="top-start"
                ><span class="font-mono text-xs">{{
                  row.subject
                }}</span></el-tooltip
              >
              <span v-else>{{ row.subject }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="actor"
            label="操作者"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column label="结果" width="110">
            <template #default="{ row }">
              <el-tag
                v-if="row.result"
                :type="resultType(row.result)"
                effect="plain"
                >{{ row.result }}</el-tag
              ><span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="详情" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ row.detail || "—" }}</template>
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
