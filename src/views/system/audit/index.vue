<script setup lang="ts">
import { listAuditEvents, type AuditEvent } from "@/api/security";
import { onMounted, ref } from "vue";
import {
  adminCodeLabel,
  adminCodeTooltip
} from "../admin-code-presentation.mjs";
defineOptions({ name: "AuditLog" });
const loading = ref(false),
  rows = ref<AuditEvent[]>([]),
  page = ref(0),
  size = ref(20),
  total = ref(0);
const load = async () => {
  loading.value = true;
  try {
    const { data } = await listAuditEvents(page.value, size.value);
    rows.value = data.items;
    total.value = data.totalElements;
  } finally {
    loading.value = false;
  }
};
onMounted(load);
</script>
<template>
  <el-card shadow="never"
    ><template #header>审计日志</template
    ><el-table v-loading="loading" :data="rows"
      ><el-table-column type="expand"
        ><template #default="{ row }">
          <pre class="whitespace-pre-wrap break-all">{{
            row.metadata || "无附加元数据"
          }}</pre>
        </template></el-table-column
      ><el-table-column label="时间" min-width="180"
        ><template #default="{ row }">{{
          new Date(row.occurredAt).toLocaleString()
        }}</template></el-table-column
      ><el-table-column label="动作" min-width="180"
        ><template #default="{ row }"
          ><el-tooltip :content="adminCodeTooltip('auditAction', row.action)">{{
            adminCodeLabel("auditAction", row.action)
          }}</el-tooltip></template
        ></el-table-column
      ><el-table-column label="结果" width="100"
        ><template #default="{ row }"
          ><el-tooltip :content="adminCodeTooltip('auditResult', row.result)"
            ><el-tag :type="row.result === 'SUCCESS' ? 'success' : 'danger'">{{
              adminCodeLabel("auditResult", row.result)
            }}</el-tag></el-tooltip
          ></template
        ></el-table-column
      ><el-table-column
        prop="actorId"
        label="操作者"
        min-width="180" /><el-table-column label="目标" min-width="180"
        ><template #default="{ row }"
          ><el-tooltip
            :content="adminCodeTooltip('auditTargetType', row.targetType)"
            >{{ adminCodeLabel("auditTargetType", row.targetType) }}
            {{ row.targetId || "" }}</el-tooltip
          ></template
        ></el-table-column
      ><el-table-column prop="traceId" label="Trace ID" min-width="180"
    /></el-table>
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
      /></div
  ></el-card>
</template>
