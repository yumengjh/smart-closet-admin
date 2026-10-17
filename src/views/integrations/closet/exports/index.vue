<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  getClosetDailyExport,
  downloadClosetDailyCsv,
  getClosetEvents,
  type DailyExport,
  type EventPage,
  type EventType
} from "@/api/closet/management";
import { metricNames } from "@/api/closet/insights";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useClosetRequest, formatTime, dateRange } from "../useClosetRequest";
import { message } from "@/utils/message";
defineOptions({ name: "ClosetExports" });
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const tab = ref("daily");
const range = ref<[string, string]>(dateRange());
const daily = ref<DailyExport>();
const events = ref<EventPage>();
const types = ref<EventType[]>([]);
const since = ref<string>();
const limit = ref(100);
const cursor = ref("");
const eventTypes: EventType[] = [
  "user_created",
  "garment_created",
  "outfit_created",
  "quick_intake",
  "recommendation_shown",
  "recommendation_feedback",
  "wear_logged",
  "model_usage"
];
const validRange = () => {
  const days =
    (Date.parse(range.value?.[1]) - Date.parse(range.value?.[0])) / 86400000 +
    1;
  if (!Number.isFinite(days) || days < 1 || days > 366) {
    message("请选择 1 至 366 天的日期范围", { type: "warning" });
    return false;
  }
  return true;
};
const loadDaily = () => {
  if (validRange())
    void run(
      () => getClosetDailyExport({ from: range.value[0], to: range.value[1] }),
      result => {
        daily.value = result.data;
      }
    );
};
const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const csv = () => {
  if (validRange())
    void run(
      () =>
        downloadClosetDailyCsv({ from: range.value[0], to: range.value[1] }),
      blob =>
        download(blob, `closet-daily-${range.value[0]}-${range.value[1]}.csv`)
    );
};
const downloadEvents = () => {
  if (events.value)
    download(
      new Blob([JSON.stringify(events.value, null, 2)], {
        type: "application/json"
      }),
      "closet-events.json"
    );
};
const loadEvents = (next = false) =>
  run(
    () =>
      getClosetEvents({
        cursor: next ? events.value?.nextCursor : undefined,
        since: !next && since.value ? Number(since.value) : undefined,
        types: types.value.length ? types.value : undefined,
        limit: limit.value
      }),
    result => {
      events.value = result.data;
      cursor.value = result.data.nextCursor;
    }
  );
const resetEvents = () => {
  events.value = undefined;
  cursor.value = "";
};
watch([types, since, limit], resetEvents, { deep: true });
const retry = () => {
  if (tab.value === "daily") loadDaily();
  else void loadEvents();
};
onMounted(loadDaily);
const label = (column: string) =>
  ({ date: "日期", input_tokens: "输入 Token", output_tokens: "输出 Token" })[
    column
  ] ??
  metricNames[column as keyof typeof metricNames] ??
  column;
</script>
<template>
  <div class="space-y-4">
    <el-card shadow="never"
      ><h2 class="text-lg font-semibold">数据导出</h2>
      <p class="mt-2 text-sm">
        按天汇总适合 BI 分析；事件明细使用不可逆的
        userKey，不包含用户名、衣物名称、图片或聊天内容。日期按上海时区统计。
      </p>
      <el-tabs v-model="tab"
        ><el-tab-pane label="按天宽表" name="daily" /><el-tab-pane
          label="增量事件"
          name="events"
      /></el-tabs>
      <div v-if="tab === 'daily'" class="flex flex-wrap gap-3">
        <el-date-picker
          v-model="range"
          type="daterange"
          :clearable="false"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        /><el-button type="primary" :loading="loading" @click="loadDaily"
          >查询</el-button
        ><el-button :disabled="loading" @click="csv">下载 CSV</el-button>
      </div>
      <div v-else class="flex flex-wrap gap-3">
        <el-date-picker
          v-model="since"
          type="datetime"
          value-format="x"
          placeholder="起始时间，留空从最早开始"
        /><el-select
          v-model="types"
          multiple
          collapse-tags
          class="!w-72"
          aria-label="事件类型"
          ><el-option
            v-for="type in eventTypes"
            :key="type"
            :label="type"
            :value="type" /></el-select
        ><el-input-number
          v-model="limit"
          :min="1"
          :max="1000"
          aria-label="每页事件数"
        /><el-button
          type="primary"
          :loading="loading"
          @click="loadEvents(false)"
          >从起点读取</el-button
        >
      </div>
    </el-card>
    <ClosetUnavailable
      v-if="unavailable"
      :loading="loading"
      @retry="retry"
    /><el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-card v-else v-loading="loading" shadow="never">
      <template v-if="tab === 'daily' && daily"
        ><p class="mb-3 text-sm">
          {{ daily.from }} 至 {{ daily.to }} · {{ daily.rows.length }} 天
        </p>
        <el-table :data="daily.rows" max-height="620"
          ><el-table-column
            v-for="column in ['date', ...daily.columns]"
            :key="column"
            :prop="column"
            :label="label(column)"
            min-width="125"
            :fixed="column === 'date' ? 'left' : undefined" /></el-table
      ></template>
      <template v-else-if="tab === 'events' && events"
        ><div class="mb-3 flex flex-wrap items-center gap-3">
          <span class="mr-auto text-sm"
            >水位线 {{ formatTime(events.watermarkMs) }} · 本页
            {{ events.items.length }} 条</span
          ><el-button
            :disabled="loading || !events.items.length"
            @click="downloadEvents"
            >下载本页 JSON</el-button
          ><el-button
            :disabled="!events.hasMore || loading"
            @click="loadEvents(true)"
            >下一页</el-button
          >
        </div>
        <el-table :data="events.items"
          ><el-table-column
            prop="type"
            label="事件"
            min-width="180"
          /><el-table-column
            prop="id"
            label="ID"
            min-width="170"
            show-overflow-tooltip
          /><el-table-column label="时间" min-width="180"
            ><template #default="{ row }">{{
              formatTime(row.atMs)
            }}</template></el-table-column
          ><el-table-column
            prop="userKey"
            label="userKey"
            min-width="160"
          /><el-table-column label="属性" min-width="260"
            ><template #default="{ row }">{{
              JSON.stringify(row.attrs)
            }}</template></el-table-column
          ></el-table
        ><el-collapse class="mt-4"
          ><el-collapse-item title="下次增量游标"
            ><p class="break-all text-sm">
              {{ cursor || "—" }}
            </p></el-collapse-item
          ></el-collapse
        ></template
      >
      <el-empty v-else description="选择筛选条件后读取数据" />
    </el-card>
  </div>
</template>
