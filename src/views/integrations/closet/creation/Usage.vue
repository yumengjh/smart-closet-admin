<script setup lang="ts">
import { ref } from "vue";
import { getCreationUsage, type CreationUsage } from "@/api/closet/creation";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";

defineOptions({ name: "ClosetCreationUsage" });
const { can } = useCurrentPermissions();
const dates = ref<[string, string] | null>(null);
const result = ref<CreationUsage>();
const loading = ref(false);
async function search() {
  if (!dates.value || !can("closet:creation:read") || loading.value) return;
  const [from, to] = dates.value;
  const days =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86400000;
  if (days < 0 || days > 30) {
    message("请选择不超过 31 天的日期范围", { type: "warning" });
    return;
  }
  loading.value = true;
  result.value = undefined;
  try {
    result.value = (await getCreationUsage(from, to)).data;
  } catch (cause) {
    const body = (cause as { response?: { data?: { message?: string } } })
      .response?.data;
    message(body?.message || "用量查询失败，请重试", { type: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="creation-usage">
    <div class="heading">
      <h1>穿搭创作用量</h1>
      <p>按模板版本、模型和币种查看调用与估算费用。</p>
    </div>
    <el-alert
      title="仅包含模型估算费用；存储、带宽和服务器固定成本尚未统计。不同币种分别展示。"
      type="info"
      :closable="false"
    />
    <div class="filters">
      <el-date-picker
        v-model="dates"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
      />
      <el-button
        type="primary"
        :loading="loading"
        :disabled="!dates || !can('closet:creation:read')"
        @click="search"
        >查询</el-button
      >
    </div>
    <template v-if="result">
      <p class="caption">
        {{ result.from }} 至 {{ result.to }} · {{ result.timeZone }} · 截至
        {{
          new Date(result.asOfMs).toLocaleString("zh-CN", {
            timeZone: result.timeZone
          })
        }}
      </p>
      <el-table :data="result.items" empty-text="所选日期没有用量" stripe>
        <el-table-column prop="templateId" label="模板" min-width="165" />
        <el-table-column prop="templateVersion" label="版本" width="75" />
        <el-table-column prop="provider" label="供应商" min-width="110" />
        <el-table-column prop="model" label="模型" min-width="140" />
        <el-table-column prop="requests" label="请求" width="75" />
        <el-table-column prop="dispatchedAttempts" label="已派发" width="85" />
        <el-table-column prop="succeeded" label="成功" width="75" />
        <el-table-column prop="failed" label="失败" width="75" />
        <el-table-column prop="unknown" label="结果未知" width="95" />
        <el-table-column label="重做 / 比例" min-width="120"
          ><template #default="{ row }"
            >{{ row.recreates }} /
            {{
              row.recreateRatio == null
                ? "—"
                : `${(row.recreateRatio * 100).toFixed(1)}%`
            }}</template
          ></el-table-column
        >
        <el-table-column label="估算费用" min-width="150"
          ><template #default="{ row }"
            >{{ row.currency ?? "币种未知" }}
            {{
              row.currency == null || row.estimatedCostMicro == null
                ? "未定价"
                : `已知估算 ${(row.estimatedCostMicro / 1000000).toFixed(6)}`
            }}</template
          ></el-table-column
        >
        <el-table-column
          prop="unknownCostAttempts"
          label="费用未知次数"
          min-width="115"
        />
      </el-table>
    </template>
    <el-empty v-else-if="!loading" description="选择日期范围后查询" />
  </section>
</template>

<style scoped>
.creation-usage {
  padding: 24px;
}
.heading h1 {
  margin: 0 0 8px;
  font-size: 24px;
}
.heading p,
.caption {
  color: var(--el-text-color-secondary);
}
.heading {
  margin-bottom: 20px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px 0;
}
@media (max-width: 600px) {
  .creation-usage {
    padding: 16px;
  }
  .filters :deep(.el-date-editor) {
    max-width: 100%;
  }
}
</style>
