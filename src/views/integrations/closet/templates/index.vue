<script setup lang="ts">
import { useWindowSize } from "@vueuse/core";
const { width } = useWindowSize();
import { computed, onMounted, reactive, ref } from "vue";
import {
  getClosetTemplates,
  reviewClosetTemplate,
  type TemplateList,
  type OutfitTemplate,
  type TemplateReview
} from "@/api/closet/management";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useClosetRequest, formatTime } from "../useClosetRequest";
import { message } from "@/utils/message";
defineOptions({ name: "ClosetTemplates" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const catalog = ref<TemplateList>();
const selected = ref<OutfitTemplate>();
const query = ref("");
const status = ref("");
const source = ref("");
const saving = ref(false);
const form = reactive<Required<TemplateReview>>({
  reviewStatus: "PENDING_REVIEW",
  enabled: false,
  bonus: 0
});
const statusNames = {
  PENDING_REVIEW: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝"
};
const rows = computed(
  () =>
    catalog.value?.items.filter(
      row =>
        (!query.value ||
          `${row.id} ${row.text}`
            .toLowerCase()
            .includes(query.value.toLowerCase())) &&
        (!status.value || row.reviewStatus === status.value) &&
        (!source.value || row.source === source.value)
    ) ?? []
);
const load = () =>
  run(getClosetTemplates, result => {
    catalog.value = result.data;
  });
const edit = (row: OutfitTemplate) => {
  selected.value = row;
  Object.assign(form, {
    reviewStatus: row.reviewStatus,
    enabled: row.enabled,
    bonus: row.bonus
  });
};
const save = async () => {
  if (!selected.value || !can("closet:templates:write")) return;
  saving.value = true;
  try {
    const { data } = await reviewClosetTemplate(selected.value.id, { ...form });
    const oldActive = selected.value.active;
    if (catalog.value) {
      catalog.value.items = catalog.value.items.map(row =>
        row.id === data.id ? data : row
      );
      catalog.value.active += Number(data.active) - Number(oldActive);
    }
    selected.value = undefined;
    message("模板审核已保存", { type: "success" });
  } catch {
    message("保存失败，请检查接入状态和审核权限后重试", { type: "error" });
  } finally {
    saving.value = false;
  }
};
onMounted(() => void load());
</script>
<template>
  <div class="space-y-4">
    <el-card shadow="never"
      ><div class="flex flex-wrap items-center gap-3">
        <h2 class="mr-auto text-lg font-semibold">模板审核</h2>
        <el-button type="primary" :loading="loading" @click="load"
          >刷新</el-button
        >
      </div>
      <p class="my-3 text-sm">
        审核通过且启用的模板才参与搭配，样本生成模板同样需要人工审核。{{
          catalog ? `当前生效 ${catalog.active} 个 · ${catalog.version}` : ""
        }}
      </p>
      <div class="flex flex-wrap gap-3">
        <el-input
          v-model="query"
          class="!w-72"
          placeholder="搜索模板 ID 或描述"
          clearable
        /><el-select
          v-model="status"
          class="!w-40"
          placeholder="全部状态"
          clearable
          ><el-option
            v-for="(label, value) in statusNames"
            :key="value"
            :label="label"
            :value="value" /></el-select
        ><el-select
          v-model="source"
          class="!w-40"
          placeholder="全部来源"
          clearable
          ><el-option label="内置模板" value="FILE" /><el-option
            label="样本模板"
            value="SAMPLE"
        /></el-select></div
    ></el-card>
    <ClosetUnavailable
      v-if="unavailable"
      :loading="loading"
      @retry="load"
    /><el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-card v-else v-loading="loading" shadow="never"
      ><el-table :data="rows" row-key="id"
        ><el-table-column
          prop="id"
          label="模板"
          min-width="190"
        /><el-table-column
          prop="text"
          label="描述"
          min-width="240"
          show-overflow-tooltip
        /><el-table-column label="来源"
          ><template #default="{ row }">{{
            row.source === "FILE" ? "内置" : "样本"
          }}</template></el-table-column
        ><el-table-column label="审核"
          ><template #default="{ row }">{{
            statusNames[row.reviewStatus as keyof typeof statusNames]
          }}</template></el-table-column
        ><el-table-column label="生效"
          ><template #default="{ row }"
            ><el-tag :type="row.active ? 'success' : 'info'">{{
              row.active ? "生效" : "未生效"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column prop="bonus" label="加分" /><el-table-column
          label="操作"
          fixed="right"
          width="110"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="edit(row)">{{
              can("closet:templates:write") ? "审核" : "查看"
            }}</el-button></template
          ></el-table-column
        ></el-table
      ></el-card
    >
    <el-dialog
      :model-value="!!selected"
      :title="selected?.id"
      width="min(720px, 94vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      @close="!saving && (selected = undefined)"
    >
      <template v-if="selected"
        ><p class="mb-4">{{ selected.text }}</p>
        <el-descriptions :column="width < 768 ? 1 : 2" border
          ><el-descriptions-item label="类型">{{
            selected.kind
          }}</el-descriptions-item
          ><el-descriptions-item label="默认加分">{{
            selected.defaultBonus
          }}</el-descriptions-item
          ><el-descriptions-item label="受众">{{
            selected.audience.join("、") || "不限"
          }}</el-descriptions-item
          ><el-descriptions-item label="季节">{{
            selected.seasons.join("、") || "不限"
          }}</el-descriptions-item
          ><el-descriptions-item label="场合">{{
            selected.occasions.join("、") || "不限"
          }}</el-descriptions-item
          ><el-descriptions-item label="有效期"
            >{{ selected.validFrom ?? "不限" }} 至
            {{ selected.validUntil ?? "不限" }}</el-descriptions-item
          ><el-descriptions-item label="审核人">{{
            selected.reviewedBy ?? "—"
          }}</el-descriptions-item
          ><el-descriptions-item label="审核时间">{{
            formatTime(selected.reviewedAtMs)
          }}</el-descriptions-item
          ><el-descriptions-item label="参考">{{
            selected.reference || "—"
          }}</el-descriptions-item></el-descriptions
        ><el-collapse class="my-4"
          ><el-collapse-item title="搭配槽位">
            <pre class="overflow-auto text-sm">{{
              JSON.stringify(selected.slots, null, 2)
            }}</pre>
          </el-collapse-item></el-collapse
        >
        <el-form
          label-position="top"
          :disabled="!can('closet:templates:write') || saving"
          ><el-form-item label="审核状态"
            ><el-select v-model="form.reviewStatus"
              ><el-option
                v-for="(label, value) in statusNames"
                :key="value"
                :label="label"
                :value="value" /></el-select></el-form-item
          ><el-form-item label="启用"
            ><el-switch v-model="form.enabled" /></el-form-item
          ><el-form-item label="推荐加分"
            ><el-input-number
              v-model="form.bonus"
              :min="0"
              :max="catalog?.maxBonus ?? 5"
              :step="0.5" /></el-form-item
        ></el-form> </template
      ><template #footer
        ><el-button :disabled="saving" @click="selected = undefined"
          >关闭</el-button
        ><el-button
          v-if="can('closet:templates:write')"
          type="primary"
          :loading="saving"
          @click="save"
          >保存审核</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
