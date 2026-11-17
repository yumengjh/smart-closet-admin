<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  getCreationCapabilities,
  getCreationGenerationOptions,
  saveCreationCapability,
  type Capability,
  type CapabilityEdit,
  type CreationGenerationOptions
} from "@/api/closet/creation";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
defineOptions({ name: "ClosetCreationCapabilities" });
const { can } = useCurrentPermissions();
const rows = ref<Capability[]>([]);
const loading = ref(false);
const saving = ref(false);
const optionsLoading = ref(false);
const optionsFailed = ref(false);
const generationOptions = ref<CreationGenerationOptions | null>(null);
const open = ref(false);
const editing = ref(false);
const selectionMode = ref<"default" | "single" | "existing">("default");
const form = ref<CapabilityEdit>();
const optionsText = ref("{}");
const defaultSelection = computed(
  () => generationOptions.value?.defaultSelection ?? null
);
const providerOptions = computed(() => {
  const seen = new Set<string>();
  return (generationOptions.value?.providers ?? []).filter(option => {
    if (seen.has(option.provider)) return false;
    seen.add(option.provider);
    return true;
  });
});
const modelsForProvider = computed(() =>
  (generationOptions.value?.providers ?? []).filter(
    option => option.provider === form.value?.provider
  )
);
const hasConfiguredSelection = computed(
  () =>
    !!form.value &&
    (generationOptions.value?.providers ?? []).some(
      option =>
        option.provider === form.value?.provider &&
        option.model === form.value?.model
    )
);
const canSave = computed(
  () =>
    !!form.value &&
    can("closet:creation:write") &&
    !saving.value &&
    !optionsLoading.value &&
    !optionsFailed.value &&
    hasConfiguredSelection.value
);

function applyDefaultSelection() {
  if (!form.value || editing.value || selectionMode.value !== "default") return;
  form.value.provider = defaultSelection.value?.provider ?? "";
  form.value.model = defaultSelection.value?.model ?? "";
}
async function refreshCapabilities() {
  loading.value = true;
  try {
    rows.value = (await getCreationCapabilities()).data.items;
  } catch (e) {
    fail(e);
  } finally {
    loading.value = false;
  }
}
async function refreshGenerationOptions() {
  optionsLoading.value = true;
  optionsFailed.value = false;
  try {
    generationOptions.value = (await getCreationGenerationOptions()).data;
    applyDefaultSelection();
  } catch {
    generationOptions.value = null;
    optionsFailed.value = true;
  } finally {
    optionsLoading.value = false;
  }
}
function refreshAll() {
  void refreshCapabilities();
  void refreshGenerationOptions();
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
  selectionMode.value = row ? "existing" : "default";
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
  applyDefaultSelection();
  optionsText.value = JSON.stringify(form.value.outputOptions, null, 2);
  open.value = true;
}
function changeSelectionMode(mode: "default" | "single") {
  if (!form.value || editing.value) return;
  selectionMode.value = mode;
  if (mode === "default") {
    applyDefaultSelection();
  } else {
    form.value.provider = "";
    form.value.model = "";
  }
}
function changeProvider(provider: string) {
  if (!form.value) return;
  const choices = (generationOptions.value?.providers ?? []).filter(
    option => option.provider === provider
  );
  const defaultForProvider = choices.find(
    option =>
      option.provider === defaultSelection.value?.provider &&
      option.model === defaultSelection.value?.model
  );
  form.value.model = defaultForProvider?.model ?? choices[0]?.model ?? "";
}
async function save() {
  if (!form.value || !canSave.value) return;
  try {
    const text = optionsText.value.trim();
    const options = text ? JSON.parse(text) : {};
    if (!options || Array.isArray(options) || typeof options !== "object")
      throw new Error("invalid");
    saving.value = true;
    await saveCreationCapability({ ...form.value, outputOptions: options });
    open.value = false;
    message("模型能力已保存", { type: "success" });
    await refreshCapabilities();
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
  if (can("closet:creation:read")) refreshAll();
});
</script>
<template>
  <section class="creation-page">
    <h1>模型高级设置</h1>
    <p class="caption">人工记录穿搭创作能力与验证结论；此操作不会调用模型。</p>
    <p class="caption">
      在收费管理的成本费率中使用成本标识配置对应模型的费率。
    </p>
    <div class="toolbar">
      <el-button @click="refreshAll">刷新</el-button
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
    <el-dialog
      v-model="open"
      :title="editing ? '编辑模型能力' : '新增模型能力'"
      width="min(680px, 94vw)"
    >
      <el-form v-if="form" label-position="top">
        <el-alert
          v-if="optionsLoading"
          title="正在读取已配置的生图模型。"
          type="info"
          :closable="false"
        />
        <el-alert
          v-else-if="optionsFailed"
          title="生图配置读取失败，当前不能新增或保存模型能力。"
          type="error"
          :closable="false"
        />
        <el-alert
          v-else-if="
            !optionsLoading &&
            generationOptions &&
            generationOptions.providers.length === 0
          "
          title="尚未配置可用的生图模型，请先配置生图服务。"
          type="warning"
          :closable="false"
        />
        <el-alert
          v-else-if="
            editing &&
            !optionsLoading &&
            generationOptions &&
            !hasConfiguredSelection
          "
          title="此能力使用的供应商或模型已不在当前可选配置中，暂不能保存。请恢复该生图配置后再编辑。"
          type="warning"
          :closable="false"
        />
        <el-button
          v-if="optionsFailed"
          link
          type="primary"
          :disabled="optionsLoading"
          @click="refreshGenerationOptions"
        >
          重新读取生图配置
        </el-button>
        <el-form-item v-if="!editing" label="模型来源">
          <el-radio-group
            v-model="selectionMode"
            :disabled="
              optionsLoading || optionsFailed || !providerOptions.length
            "
            @change="changeSelectionMode"
          >
            <el-radio-button label="default">复用生图默认</el-radio-button>
            <el-radio-button label="single">单独选择</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editing" label="已记录模型">
          <span>{{ form.provider }} / {{ form.model }}</span>
        </el-form-item>
        <el-form-item
          v-else-if="selectionMode === 'default'"
          label="当前生效选择"
        >
          <span v-if="optionsLoading">正在读取生图配置…</span>
          <span v-else-if="defaultSelection">
            {{ defaultSelection.provider }} / {{ defaultSelection.model }}
          </span>
          <span v-else>尚无可用的生图默认模型</span>
        </el-form-item>
        <template v-else-if="selectionMode === 'single'">
          <el-form-item label="供应商">
            <el-select
              v-model="form.provider"
              filterable
              placeholder="选择已配置供应商"
              :disabled="
                optionsLoading || optionsFailed || !providerOptions.length
              "
              @change="changeProvider"
            >
              <el-option
                v-for="option in providerOptions"
                :key="option.provider"
                :label="option.provider"
                :value="option.provider"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="模型">
            <el-select
              v-model="form.model"
              placeholder="选择该供应商的可用模型"
              :disabled="
                optionsLoading || optionsFailed || !modelsForProvider.length
              "
            >
              <el-option
                v-for="option in modelsForProvider"
                :key="`${option.provider}:${option.model}`"
                :label="option.model"
                :value="option.model"
              />
            </el-select>
          </el-form-item>
        </template>
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
        <el-form-item label="输出参数覆盖（JSON 对象，可留空继承供应商默认值）">
          <el-input v-model="optionsText" type="textarea" :rows="6" />
          <p class="caption">
            这里只保存本条能力的覆盖参数；留空或填写 {} 都会继承供应商默认参数。
          </p>
        </el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="open = false">取消</el-button
        ><el-button
          v-if="can('closet:creation:write')"
          type="primary"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
          >保存</el-button
        ><span v-else class="caption"
          >当前账号没有模型能力编辑权限。</span
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
