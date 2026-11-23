<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  deleteClosetFeedback,
  editClosetFeedback,
  FEEDBACK_CATEGORY,
  FEEDBACK_PLATFORM,
  FEEDBACK_STATUS,
  FEEDBACK_SUBMITTER,
  getClosetFeedback,
  getClosetFeedbackSettings,
  putClosetFeedbackSettings,
  type ClosetFeedback,
  type FeedbackCategory,
  type FeedbackEdit,
  type FeedbackSettings,
  type FeedbackStatus,
  type FeedbackSubmitter
} from "@/api/closet/feedback";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useClosetRequest, formatTime } from "../useClosetRequest";
import { message } from "@/utils/message";

defineOptions({ name: "ClosetFeedback" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const writable = computed(() => can("closet:feedback:write"));

type Tab = FeedbackStatus | "ALL";
const statuses = Object.keys(FEEDBACK_STATUS) as FeedbackStatus[];
const tab = ref<Tab>("NEW");
const filters = reactive<{
  category?: FeedbackCategory;
  submitter?: FeedbackSubmitter;
  q: string;
  range: [string, string] | null;
}>({ q: "", range: null });
const rows = ref<ClosetFeedback[]>([]);
const counts = ref<Record<FeedbackStatus, number>>({
  NEW: 0,
  PROCESSING: 0,
  RESOLVED: 0,
  CLOSED: 0
});
const total = ref(0);
const page = ref(1);
const size = ref(20);
const allCount = computed(() =>
  statuses.reduce((sum, status) => sum + (counts.value[status] ?? 0), 0)
);

const load = () =>
  run(
    () =>
      getClosetFeedback({
        page: page.value - 1,
        size: size.value,
        status: tab.value === "ALL" ? undefined : tab.value,
        category: filters.category || undefined,
        submitter: filters.submitter || undefined,
        q: filters.q.trim() || undefined,
        from: filters.range?.[0],
        to: filters.range?.[1]
      }),
    ({ data }) => {
      rows.value = data.items;
      total.value = data.totalElements;
      counts.value = { ...counts.value, ...data.counts };
    }
  );
const search = () => {
  page.value = 1;
  void load();
};
const changePage = (value: number) => {
  page.value = value;
  void load();
};
const changeSize = (value: number) => {
  size.value = value;
  page.value = 1;
  void load();
};

const settings = ref<FeedbackSettings>();
const switching = ref(false);
const loadSettings = async () => {
  try {
    settings.value = (await getClosetFeedbackSettings()).data;
  } catch (error) {
    if (isClosetServiceUnavailable(error)) unavailable.value = true;
  }
};
const toggleAnonymous = async (value: boolean | string | number) => {
  if (!settings.value || !writable.value) return;
  const enabled = Boolean(value);
  if (!enabled) {
    try {
      await ElMessageBox.confirm(
        "关闭后，没登录的人打开反馈页会看到“现在要登录后才能反馈”，已登录用户不受影响。",
        "关闭未登录反馈",
        { type: "warning", confirmButtonText: "关闭", cancelButtonText: "取消" }
      );
    } catch {
      return;
    }
  }
  switching.value = true;
  try {
    settings.value = (
      await putClosetFeedbackSettings({
        anonymousEnabled: enabled,
        revision: settings.value.revision
      })
    ).data;
    message(enabled ? "已允许未登录反馈" : "已关闭未登录反馈", {
      type: "success"
    });
  } catch (error) {
    failed(error, "设置没有保存，请刷新后重试");
    await loadSettings();
  } finally {
    switching.value = false;
  }
};

const current = ref<ClosetFeedback>();
const form = reactive<{ status: FeedbackStatus; reply: string; note: string }>({
  status: "NEW",
  reply: "",
  note: ""
});
const saving = ref(false);
const canReply = computed(() => current.value?.submitter === "ACCOUNT");
const open = (row: ClosetFeedback) => {
  current.value = row;
  form.status = row.status;
  form.reply = row.reply ?? "";
  form.note = row.note ?? "";
};
const changes = computed<FeedbackEdit | null>(() => {
  const row = current.value;
  if (!row) return null;
  const edit: FeedbackEdit = { revision: row.revision };
  if (form.status !== row.status) edit.status = form.status;
  if (canReply.value && form.reply.trim() !== (row.reply ?? ""))
    edit.reply = form.reply;
  if (form.note.trim() !== (row.note ?? "")) edit.note = form.note;
  return Object.keys(edit).length > 1 ? edit : null;
});
const failed = (error: unknown, fallback: string) => {
  if (isClosetServiceUnavailable(error)) {
    unavailable.value = true;
    return;
  }
  const response = (
    error as { response?: { status?: number; data?: { message?: string } } }
  )?.response;
  if (response?.status === 409 || response?.status === 404) {
    message(response.data?.message || "这条反馈刚有变化，列表已刷新", {
      type: "warning"
    });
    current.value = undefined;
    void load();
  } else message(response?.data?.message || fallback, { type: "error" });
};
const save = async () => {
  const row = current.value;
  const edit = changes.value;
  if (!row || !edit || saving.value) return;
  saving.value = true;
  try {
    const { data } = await editClosetFeedback(row.id, edit);
    message(edit.reply ? "已保存，用户会收到回复通知" : "已保存", {
      type: "success"
    });
    current.value = data;
    await load();
  } catch (error) {
    failed(error, "保存失败，请刷新后重试");
  } finally {
    saving.value = false;
  }
};
const remove = async () => {
  const row = current.value;
  if (!row || saving.value) return;
  try {
    await ElMessageBox.confirm(
      "删除后无法恢复，用户的“我的反馈”里也会消失。垃圾内容也可以改为“已关闭”保留。",
      "删除这条反馈",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  saving.value = true;
  try {
    await deleteClosetFeedback(row.id);
    message("已删除", { type: "success" });
    current.value = undefined;
    await load();
  } catch (error) {
    failed(error, "删除失败，请刷新后重试");
  } finally {
    saving.value = false;
  }
};

const statusType = (status: FeedbackStatus) =>
  status === "NEW"
    ? "danger"
    : status === "PROCESSING"
      ? "warning"
      : status === "RESOLVED"
        ? "success"
        : "info";
const who = (row: ClosetFeedback) =>
  row.submitter === "ACCOUNT" && row.username
    ? row.username
    : FEEDBACK_SUBMITTER[row.submitter];

onMounted(() => {
  void load();
  void loadSettings();
});
</script>

<template>
  <div class="page-root space-y-4">
    <ClosetUnavailable
      v-if="unavailable"
      :loading="loading"
      @retry="
        load();
        loadSettings();
      "
    />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      ><el-button link @click="load">重试</el-button></el-alert
    >
    <el-card v-else shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <div class="mr-auto">
            <h2 class="text-base font-semibold">用户反馈</h2>
            <p class="text-xs text-[var(--el-text-color-secondary)]">
              用户在“我的 →
              意见反馈”提交的问题与建议。只有附带账号的反馈能回复，回复会以站内消息通知用户；内部备注用户看不到。
            </p>
          </div>
          <div
            v-if="settings"
            class="flex items-center gap-2 text-sm"
            :title="`部署默认：${settings.defaultAnonymousEnabled ? '允许' : '不允许'}`"
          >
            <span>允许未登录反馈</span>
            <el-switch
              :model-value="settings.anonymousEnabled"
              :disabled="!writable"
              :loading="switching"
              @change="toggleAnonymous"
            />
          </div>
          <el-button :loading="loading" @click="load">刷新</el-button>
        </div>
      </template>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <el-radio-group v-model="tab" @change="search">
          <el-radio-button value="NEW"
            >{{ FEEDBACK_STATUS.NEW }} {{ counts.NEW }}</el-radio-button
          >
          <el-radio-button value="PROCESSING"
            >{{ FEEDBACK_STATUS.PROCESSING }}
            {{ counts.PROCESSING }}</el-radio-button
          >
          <el-radio-button value="RESOLVED"
            >{{ FEEDBACK_STATUS.RESOLVED }}
            {{ counts.RESOLVED }}</el-radio-button
          >
          <el-radio-button value="CLOSED"
            >{{ FEEDBACK_STATUS.CLOSED }} {{ counts.CLOSED }}</el-radio-button
          >
          <el-radio-button value="ALL">全部 {{ allCount }}</el-radio-button>
        </el-radio-group>
        <el-select
          v-model="filters.category"
          class="!w-36"
          placeholder="类型"
          clearable
          @change="search"
        >
          <el-option
            v-for="(label, value) in FEEDBACK_CATEGORY"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
        <el-select
          v-model="filters.submitter"
          class="!w-40"
          placeholder="来源"
          clearable
          @change="search"
        >
          <el-option
            v-for="(label, value) in FEEDBACK_SUBMITTER"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
        <el-date-picker
          v-model="filters.range"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="!w-64"
          @change="search"
        />
        <el-input
          v-model="filters.q"
          class="!w-56"
          placeholder="搜正文、回复、备注"
          clearable
          @keyup.enter="search"
          @clear="search"
        />
      </div>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="id"
        empty-text="没有符合条件的反馈"
        class="cursor-pointer"
        @row-click="open"
      >
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{
            formatTime(row.createdAtMs)
          }}</template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }"
            ><el-tag effect="plain">{{
              FEEDBACK_CATEGORY[row.category as FeedbackCategory]
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="来源" min-width="140">
          <template #default="{ row }"
            ><span :class="{ 'font-medium': row.submitter === 'ACCOUNT' }">{{
              who(row)
            }}</span></template
          >
        </el-table-column>
        <el-table-column label="内容" min-width="300">
          <template #default="{ row }"
            ><div class="feedback-excerpt">{{ row.content }}</div></template
          >
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="light">{{
              FEEDBACK_STATUS[row.status as FeedbackStatus]
            }}</el-tag>
            <div
              v-if="row.reply"
              class="mt-1 text-xs text-[var(--el-text-color-secondary)]"
            >
              已回复
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > size" class="mt-4 flex justify-end">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :current-page="page"
          :page-size="size"
          :page-sizes="[20, 50, 100]"
          :disabled="loading"
          @current-change="changePage"
          @size-change="changeSize"
        />
      </div>
    </el-card>

    <el-drawer
      :model-value="!!current"
      title="反馈详情"
      size="min(560px, 100vw)"
      :close-on-press-escape="!saving"
      @close="!saving && (current = undefined)"
    >
      <template v-if="current">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="时间">{{
            formatTime(current.createdAtMs)
          }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{
            FEEDBACK_CATEGORY[current.category]
          }}</el-descriptions-item>
          <el-descriptions-item label="来源">
            {{ FEEDBACK_SUBMITTER[current.submitter] }}
            <template v-if="current.username">
              ·
              <span class="font-medium">{{ current.username }}</span></template
            >
            <span
              v-if="current.userKey"
              class="ml-1 text-xs text-[var(--el-text-color-secondary)]"
              >{{ current.userKey }}</span
            >
          </el-descriptions-item>
          <el-descriptions-item v-if="current.contact" label="联系方式">{{
            current.contact
          }}</el-descriptions-item>
          <el-descriptions-item label="所在页面">{{
            current.page || "—"
          }}</el-descriptions-item>
          <el-descriptions-item label="设备与版本"
            >{{
              current.platform ? FEEDBACK_PLATFORM[current.platform] : "—"
            }}
            · 前端 {{ current.webVersion || "—" }} · 服务端
            {{ current.serverVersion || "—" }}</el-descriptions-item
          >
        </el-descriptions>
        <div class="feedback-content">{{ current.content }}</div>

        <el-form
          label-position="top"
          class="mt-4"
          :disabled="!writable || saving"
        >
          <el-form-item label="状态">
            <el-select v-model="form.status" class="w-full">
              <el-option
                v-for="status in statuses"
                :key="status"
                :label="FEEDBACK_STATUS[status]"
                :value="status"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="回复用户">
            <el-input
              v-model="form.reply"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }"
              maxlength="1000"
              show-word-limit
              :disabled="!canReply || !writable || saving"
              :placeholder="
                canReply
                  ? '用户会在“我的反馈”里看到，并收到站内消息'
                  : '这条反馈没有附带账号，没法回复'
              "
            />
            <div
              v-if="current.repliedAtMs"
              class="mt-1 text-xs text-[var(--el-text-color-secondary)]"
            >
              上次回复 {{ formatTime(current.repliedAtMs) }}
            </div>
          </el-form-item>
          <el-form-item label="内部备注（用户看不到）">
            <el-input
              v-model="form.note"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              maxlength="1000"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <el-button
            v-if="writable"
            type="danger"
            plain
            :disabled="saving"
            @click="remove"
            >删除</el-button
          >
          <span class="mr-auto" />
          <el-button :disabled="saving" @click="current = undefined"
            >关闭</el-button
          >
          <el-button
            v-if="writable"
            type="primary"
            :loading="saving"
            :disabled="!changes"
            @click="save"
            >保存</el-button
          >
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.feedback-excerpt {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  word-break: break-word;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
}

.feedback-content {
  padding: 12px 14px;
  margin-top: 16px;
  line-height: 1.7;
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}
</style>
