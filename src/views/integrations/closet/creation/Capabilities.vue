<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getCreationCapabilities,
  saveCreationCapability,
  type Capability,
  type CapabilityEdit
} from "@/api/closet/creation";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
defineOptions({ name: "ClosetCreationCapabilities" });
const { can } = useCurrentPermissions();
const rows = ref<Capability[]>([]);
const loading = ref(false);
const saving = ref(false);
const open = ref(false);
const editing = ref(false);
const form = ref<CapabilityEdit>();
const optionsText = ref("{}");
async function refresh() {
  loading.value = true;
  try {
    rows.value = (await getCreationCapabilities()).data.items;
  } catch (e) {
    fail(e);
  } finally {
    loading.value = false;
  }
}
function fail(e: unknown) {
  const response = (
    e as { response?: { status?: number; data?: { message?: string } } }
  ).response;
  message(
    response?.status === 409
      ? "数据已变化，请重新载入后编辑"
      : response?.data?.message || "请求失败，请重试",
    { type: "error" }
  );
}
async function copyPricingKey(key: string) {
  try {
    await navigator.clipboard.writeText(key);
    message("成本标识已复制", { type: "success" });
  } catch {
    message("复制失败，请手动选择成本标识复制", { type: "warning" });
  }
}
function edit(row?: Capability) {
  editing.value = !!row;
  form.value = row
    ? {
        provider: row.provider,
        model: row.model,
        purpose: "ART_CREATION",
        maxReferences: row.maxReferences,
        verified: row.verified,
        version: row.version,
        notes: row.notes,
        outputOptions: row.outputOptions
      }
    : {
        provider: "",
        model: "",
        purpose: "ART_CREATION",
        maxReferences: 1,
        verified: false,
        version: 0,
        notes: "",
        outputOptions: {}
      };
  optionsText.value = JSON.stringify(form.value.outputOptions, null, 2);
  open.value = true;
}
async function save() {
  if (!form.value || saving.value || !can("closet:creation:write")) return;
  try {
    const options = JSON.parse(optionsText.value);
    if (!options || Array.isArray(options) || typeof options !== "object")
      throw new Error("invalid");
    saving.value = true;
    await saveCreationCapability({ ...form.value, outputOptions: options });
    open.value = false;
    message("模型能力已保存", { type: "success" });
    await refresh();
  } catch (e) {
    if (
      e instanceof SyntaxError ||
      (e instanceof Error && e.message === "invalid")
    )
      message("输出配置须为 JSON 对象", { type: "warning" });
    else fail(e);
  } finally {
    saving.value = false;
  }
}
onMounted(() => {
  if (can("closet:creation:read")) void refresh();
});
</script>
<template>
  <section class="creation-page">
    <h1>模型能力</h1>
    <p class="caption">人工记录穿搭创作能力与验证结论；此操作不会调用模型。</p>
    <p class="caption">
      在收费管理的成本费率中使用成本标识配置对应模型的费率。
    </p>
    <div class="toolbar">
      <el-button @click="refresh">刷新</el-button
      ><el-button
        v-if="can('closet:creation:write')"
        type="primary"
        @click="edit()"
        >新增能力</el-button
      >
    </div>
    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column
        prop="provider"
        label="供应商"
        min-width="120"
      /><el-table-column prop="model" label="模型" min-width="140" />
      <el-table-column label="成本标识" min-width="240">
        <template #default="{ row }">
          <template v-if="row.pricingKey">
            <span class="pricing-key">{{ row.pricingKey }}</span>
            <el-button
              link
              type="primary"
              @click="copyPricingKey(row.pricingKey)"
              >复制</el-button
            >
          </template>
          <span v-else>未提供</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="maxReferences"
        label="参考图上限"
        width="110"
      /><el-table-column label="验证状态" width="100"
        ><template #default="{ row }"
          ><el-tag :type="row.verified ? 'success' : 'info'">{{
            row.verified ? "已验证" : "未验证"
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column prop="version" label="版本" width="80" /><el-table-column
        prop="providerRevision"
        label="供应商版本"
        min-width="120"
      /><el-table-column label="验证时间" min-width="160"
        ><template #default="{ row }">{{
          row.verifiedAt == null
            ? "—"
            : new Date(row.verifiedAt).toLocaleString()
        }}</template></el-table-column
      >
      <el-table-column
        v-if="can('closet:creation:write')"
        label="操作"
        width="90"
        fixed="right"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="edit(row)"
            >编辑</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-dialog v-model="open" title="模型能力" width="min(680px, 94vw)">
      <el-form v-if="form" label-position="top">
        <el-form-item label="供应商"
          ><el-input v-model="form.provider" :disabled="editing"
        /></el-form-item>
        <el-form-item label="模型"
          ><el-input v-model="form.model" :disabled="editing"
        /></el-form-item>
        <el-form-item label="参考图上限"
          ><el-input-number v-model="form.maxReferences" :min="1" :max="20"
        /></el-form-item>
        <el-form-item label="人工验证"
          ><el-switch
            v-model="form.verified"
            active-text="已验证"
            inactive-text="未验证"
        /></el-form-item>
        <el-form-item label="验证说明"
          ><el-input v-model="form.notes" type="textarea" :rows="3"
        /></el-form-item>
        <el-form-item label="输出配置（JSON 对象）"
          ><el-input v-model="optionsText" type="textarea" :rows="6"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="open = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>
<style scoped>
.creation-page {
  padding: 24px;
}
.caption {
  color: var(--el-text-color-secondary);
}
.toolbar {
  display: flex;
  gap: 8px;
  margin: 20px 0;
}
.pricing-key {
  overflow-wrap: anywhere;
  user-select: all;
}
@media (max-width: 600px) {
  .creation-page {
    padding: 16px;
  }
}
</style>
