<script setup lang="ts">
import { ref } from "vue";
import {
  getTrace,
  money,
  time,
  poolNames,
  decisions,
  errorName,
  type Attempt
} from "@/api/closet/modelInsights";
import { useClosetRequest } from "../useClosetRequest";
import ClosetUnavailable from "../ClosetUnavailable.vue";

const { loading, unavailable, errorMessage, run } = useClosetRequest();
const drawer = ref(false);
const traceId = ref("");
const attempts = ref<Attempt[]>([]);
const outcomes: Record<string, string> = {
  OK: "成功",
  FAILED: "失败",
  CANCELLED: "已取消"
};
const execution: Record<string, string> = {
  NOT_EXECUTED: "确定没执行",
  MAYBE_EXECUTED: "可能已执行",
  REQUEST: "请求"
};
const open = (id: string) => {
  traceId.value = id;
  attempts.value = [];
  drawer.value = true;
  void run(
    () => getTrace(id),
    result => {
      attempts.value = result.data.attempts;
    }
  );
};
defineExpose({ open });
</script>

<template>
  <el-drawer
    v-model="drawer"
    :title="`尝试链 ${traceId.slice(0, 8)}`"
    size="75%"
  >
    <ClosetUnavailable v-if="unavailable" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-table :data="attempts" :loading="loading">
      <el-table-column prop="attemptNo" label="次序" />
      <el-table-column label="时间" min-width="170"
        ><template #default="{ row }">{{
          time(row.atMs)
        }}</template></el-table-column
      >
      <el-table-column label="池"
        ><template #default="{ row }">{{
          poolNames[row.pool] || row.pool || "—"
        }}</template></el-table-column
      >
      <el-table-column label="模型"
        ><template #default="{ row }">{{
          row.label || row.model
        }}</template></el-table-column
      >
      <el-table-column label="决定"
        ><template #default="{ row }">{{
          decisions[row.decision] || row.decision || "—"
        }}</template></el-table-column
      >
      <el-table-column label="结果"
        ><template #default="{ row }">{{
          outcomes[row.outcome] || row.outcome || "—"
        }}</template></el-table-column
      >
      <el-table-column label="错误"
        ><template #default="{ row }">{{
          errorName(row.errorCode)
        }}</template></el-table-column
      >
      <el-table-column label="执行分类"
        ><template #default="{ row }">{{
          execution[row.execution] || row.execution || "—"
        }}</template></el-table-column
      >
      <el-table-column label="耗时"
        ><template #default="{ row }"
          >{{ row.latencyMs }} ms</template
        ></el-table-column
      >
      <el-table-column label="费用"
        ><template #default="{ row }">{{
          money(row.costMicro, row.costCurrency)
        }}</template></el-table-column
      >
    </el-table>
  </el-drawer>
</template>
