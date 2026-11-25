<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  extractSample,
  getSampleImage,
  getSamples,
  getSampleStats,
  removeSample,
  reviewSample,
  sampleTemplateDraft,
  saveSampleResult,
  uploadSample,
  type OutfitSample,
  type SampleDecision,
  type SampleLicense,
  type SampleStats
} from "@/api/closet/samples";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import PresetImage from "../PresetImage.vue";
import { formatTime, useClosetRequest } from "../useClosetRequest";

defineOptions({ name: "ClosetSamples" });

const statusNames: Record<string, string> = {
  PENDING: "待提取",
  FAILED: "提取失败",
  EXTRACTED: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝"
};
const statusTypes: Record<string, "info" | "danger" | "warning" | "success"> = {
  PENDING: "info",
  FAILED: "danger",
  EXTRACTED: "warning",
  APPROVED: "success",
  REJECTED: "info"
};
const licenseNames: Record<SampleLicense, string> = {
  OWN: "自己拍摄",
  PERMITTED: "已获授权",
  OPEN: "开放许可",
  RESEARCH: "仅研究",
  UNKNOWN: "不确定（只参与统计）"
};
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg"];

const { can } = useCurrentPermissions();
const canWrite = computed(() => can("closet:samples:write"));
const request = useClosetRequest();
let active = true;

const status = ref<string>();
const samples = ref<OutfitSample[]>([]);
const stats = ref<SampleStats>();
const busy = ref(false);

function refresh() {
  return request.run(
    async () => {
      const [list, summary] = await Promise.all([
        getSamples({ status: status.value || undefined, limit: 200 }),
        getSampleStats().catch(() => undefined)
      ]);
      return { list: list.data.items, summary: summary?.data };
    },
    ({ list, summary }) => {
      samples.value = list;
      stats.value = summary;
    }
  );
}
function showError(error: unknown, fallback = "操作失败，请重试") {
  const response = (error as { response?: { data?: { message?: string } } })
    ?.response;
  message(response?.data?.message || fallback, { type: "error" });
}
async function confirm(text: string, title: string, button: string) {
  try {
    await ElMessageBox.confirm(text, title, {
      type: "warning",
      confirmButtonText: button,
      cancelButtonText: "取消"
    });
    return true;
  } catch {
    return false;
  }
}

// ── 上传 ──
const uploadDialog = ref(false);
const fileInput = ref<HTMLInputElement>();
const uploadFile = ref<File>();
const uploadPreview = ref("");
const uploadForm = ref<{
  sourceUrl: string;
  license: SampleLicense;
  note: string;
}>({
  sourceUrl: "",
  license: "UNKNOWN",
  note: ""
});
function setPreview(file?: File) {
  if (uploadPreview.value) URL.revokeObjectURL(uploadPreview.value);
  uploadFile.value = file;
  uploadPreview.value = file ? URL.createObjectURL(file) : "";
}
function openUpload() {
  uploadForm.value = { sourceUrl: "", license: "UNKNOWN", note: "" };
  setPreview();
  uploadDialog.value = true;
}
function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!IMAGE_TYPES.includes(file.type))
    return message("请选择 PNG 或 JPEG 图片", { type: "warning" });
  if (!file.size || file.size > MAX_BYTES)
    return message("图片不能为空，且不能超过 10 MB", { type: "warning" });
  setPreview(file);
}
const uploadError = computed(() => {
  if (!uploadFile.value) return "请先选择图片";
  const url = uploadForm.value.sourceUrl.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) return "来源链接须为 http(s) 地址";
  if (url.length > 1000) return "来源链接最长 1000 字";
  if (uploadForm.value.note.length > 500) return "备注最多 500 字";
  return "";
});
async function submitUpload() {
  if (uploadError.value || busy.value) return;
  busy.value = true;
  try {
    await uploadSample({
      image: uploadFile.value!,
      sourceUrl: uploadForm.value.sourceUrl.trim() || undefined,
      license: uploadForm.value.license,
      note: uploadForm.value.note.trim() || undefined
    });
    message("已上传并提取，请到详情里核对结果", { type: "success" });
    if (!active) return;
    uploadDialog.value = false;
    setPreview();
    await refresh();
  } catch (error) {
    showError(error, "上传失败，请检查图片后重试");
  } finally {
    busy.value = false;
  }
}

// ── 详情 ──
const drawer = ref(false);
const selected = ref<OutfitSample>();
const resultText = ref("");
const resultError = ref("");
const draftText = ref("");
const draftKind = ref("CLASSIC");
const draftResult = ref("");
const canEdit = computed(
  () => canWrite.value && selected.value?.status === "EXTRACTED"
);
function setSelected(sample: OutfitSample) {
  selected.value = sample;
  const current = sample.reviewed ?? sample.extraction;
  resultText.value = current ? JSON.stringify(current, null, 2) : "";
  resultError.value = "";
  const index = samples.value.findIndex(item => item.id === sample.id);
  if (index >= 0) samples.value[index] = sample;
}
function openDetail(sample: OutfitSample) {
  draftResult.value = "";
  draftText.value = "";
  draftKind.value = "CLASSIC";
  setSelected(sample);
  drawer.value = true;
}
function parseResult(): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(resultText.value);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    resultError.value = "";
    return value;
  } catch {
    resultError.value = "提取结果不是有效的 JSON 对象";
    return undefined;
  }
}
async function act(task: () => Promise<void>, fallback?: string) {
  if (busy.value) return;
  busy.value = true;
  try {
    await task();
  } catch (error) {
    showError(error, fallback);
  } finally {
    busy.value = false;
  }
}
const saveResult = () =>
  act(async () => {
    const body = parseResult();
    if (!body) return;
    const { data } = await saveSampleResult(selected.value!.id, body);
    setSelected(data);
    message("提取结果已保存", { type: "success" });
  });
const extract = () =>
  act(async () => {
    if (
      selected.value!.extraction &&
      !(await confirm(
        "重新提取会调用模型，并覆盖当前的提取结果。",
        "重新提取",
        "提取"
      ))
    )
      return;
    const { data } = await extractSample(selected.value!.id);
    setSelected(data);
    message("提取完成，请核对结果", { type: "success" });
    await refresh();
  }, "提取失败，请稍后重试");
const review = (decision: SampleDecision) =>
  act(async () => {
    const approve = decision === "APPROVED";
    if (
      !(await confirm(
        approve
          ? "通过后样本参与统计，并且原图会立即删除，之后不能再改提取结果。"
          : "拒绝后原图会立即删除，样本不再参与统计。",
        approve ? "审核通过" : "审核拒绝",
        approve ? "通过" : "拒绝"
      ))
    )
      return;
    if (approve && canEdit.value) {
      const body = parseResult();
      if (!body) return;
      const saved = await saveSampleResult(selected.value!.id, body);
      setSelected(saved.data);
    }
    const { data } = await reviewSample(selected.value!.id, decision);
    setSelected(data);
    message(approve ? "已通过" : "已拒绝", { type: "success" });
    await refresh();
  });
const canDraft = computed(
  () =>
    canWrite.value &&
    selected.value?.status === "APPROVED" &&
    selected.value.license !== "UNKNOWN" &&
    !selected.value.templateId
);
const createDraft = () =>
  act(async () => {
    const { data } = await sampleTemplateDraft(selected.value!.id, {
      kind: draftKind.value,
      text: draftText.value.trim() || undefined
    });
    draftResult.value = JSON.stringify(data, null, 2);
    message("已生成模板草稿，到“模板审核”里审核后才生效", { type: "success" });
    selected.value = {
      ...selected.value!,
      templateId: String(data.templateId)
    };
    await refresh();
  });
const remove = () =>
  act(async () => {
    if (
      !(await confirm(
        "删除后样本、提取结果和原图都不再保留，已生成的模板草稿不受影响。",
        "删除样本",
        "删除"
      ))
    )
      return;
    await removeSample(selected.value!.id);
    message("已删除", { type: "success" });
    drawer.value = false;
    await refresh();
  });

const statusCounts = computed(() =>
  Object.entries(stats.value?.byStatus ?? {}).map(([key, count]) => ({
    key,
    label: statusNames[key] ?? key,
    count
  }))
);

onMounted(() => void refresh());
onBeforeUnmount(() => {
  active = false;
  if (uploadPreview.value) URL.revokeObjectURL(uploadPreview.value);
});
</script>

<template>
  <main class="space-y-4">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="mr-auto text-lg font-semibold">整套样本</h2>
        <el-select
          v-model="status"
          clearable
          placeholder="全部状态"
          class="!w-40"
          aria-label="状态筛选"
          @change="refresh"
        >
          <el-option
            v-for="(label, value) in statusNames"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
        <el-button :loading="request.loading.value" @click="refresh"
          >刷新</el-button
        >
        <el-button v-if="canWrite" type="primary" @click="openUpload"
          >上传样本</el-button
        >
      </div>
      <p class="mt-2 text-sm">
        上传无人物、你有权使用的整套穿搭图，提取后人工审核。审核完成后原图立即删除，只保留去标识的提取结果。
      </p>
      <div v-if="stats" class="mt-3 flex flex-wrap gap-2">
        <el-tag type="success">已通过 {{ stats.approved }}</el-tag>
        <el-tag
          v-for="item in statusCounts"
          :key="item.key"
          :type="statusTypes[item.key] ?? 'info'"
          effect="plain"
          >{{ item.label }} {{ item.count }}</el-tag
        >
        <el-tag
          v-for="(count, name) in stats.presentation"
          :key="name"
          type="info"
          effect="plain"
          >{{ name || "未标注" }} {{ count }}</el-tag
        >
      </div>
    </el-card>

    <ClosetUnavailable
      v-if="request.unavailable.value"
      :loading="request.loading.value"
      @retry="refresh"
    />
    <el-alert
      v-else-if="request.errorMessage.value"
      :title="request.errorMessage.value"
      type="error"
      :closable="false"
    />
    <el-card v-else v-loading="request.loading.value" shadow="never">
      <el-table :data="samples" row-key="id" empty-text="还没有样本">
        <el-table-column label="状态" width="110">
          <template #default="{ row }"
            ><el-tag :type="statusTypes[row.status] ?? 'info'">{{
              statusNames[row.status] ?? row.status
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="授权" min-width="130">
          <template #default="{ row }">{{
            licenseNames[row.license as SampleLicense] ?? row.license
          }}</template>
        </el-table-column>
        <el-table-column label="形象" width="100">
          <template #default="{ row }">{{ row.presentation || "—" }}</template>
        </el-table-column>
        <el-table-column
          prop="note"
          label="备注"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column label="原图" width="80">
          <template #default="{ row }">{{
            row.hasImage ? "保留中" : "已删除"
          }}</template>
        </el-table-column>
        <el-table-column label="模板" width="90">
          <template #default="{ row }">{{
            row.templateId ? "已生成" : "—"
          }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="170">
          <template #default="{ row }">{{
            formatTime(row.updatedAtMs)
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }"
            ><el-button link type="primary" @click="openDetail(row)"
              >详情</el-button
            ></template
          >
        </el-table-column>
      </el-table>
      <p
        v-if="samples.length >= 200"
        class="mt-3 text-xs text-[var(--el-text-color-secondary)]"
      >
        只显示最近 200 条，可用状态筛选缩小范围。
      </p>
    </el-card>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg"
      hidden
      @change="chooseFile"
    />

    <el-dialog
      v-model="uploadDialog"
      title="上传样本"
      width="min(94%, 520px)"
      :close-on-click-modal="!busy"
      :show-close="!busy"
      destroy-on-close
    >
      <el-alert
        title="请使用无人物、你有权使用的整套图"
        type="warning"
        :closable="false"
        show-icon
        class="mb-3"
      >
        PNG 或 JPEG，最大 10
        MB。上传后会立即调用识图模型提取一次，疑似未成年的图片会被自动拒收，重复图片会提示已收过。
      </el-alert>
      <div class="upload-box">
        <img v-if="uploadPreview" :src="uploadPreview" alt="待上传的样本" />
        <el-button :disabled="busy" @click="fileInput?.click()">{{
          uploadFile ? "重新选择" : "选择图片"
        }}</el-button>
      </div>
      <el-form label-position="top" class="mt-3" @submit.prevent="submitUpload">
        <el-form-item label="来源链接">
          <el-input
            v-model="uploadForm.sourceUrl"
            maxlength="1000"
            placeholder="可不填，须为 http(s) 地址"
            clearable
          />
        </el-form-item>
        <el-form-item label="授权">
          <el-select v-model="uploadForm.license">
            <el-option
              v-for="(label, value) in licenseNames"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="uploadForm.note"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span v-if="uploadError" class="mr-3 text-sm">{{ uploadError }}</span>
        <el-button :disabled="busy" @click="uploadDialog = false"
          >取消</el-button
        >
        <el-button
          type="primary"
          :disabled="!!uploadError"
          :loading="busy"
          @click="submitUpload"
          >上传</el-button
        >
      </template>
    </el-dialog>

    <el-drawer v-model="drawer" title="样本详情" size="min(100%, 640px)">
      <template v-if="selected">
        <div class="sample-image">
          <PresetImage
            v-if="selected.hasImage"
            :key="`${selected.id}-${selected.updatedAtMs}`"
            label="样本原图"
            :load="() => getSampleImage(selected!.id)"
          />
          <span v-else>原图已删除（审核完成即删除）</span>
        </div>
        <el-descriptions :column="1" border size="small" class="mt-3">
          <el-descriptions-item label="状态"
            ><el-tag :type="statusTypes[selected.status] ?? 'info'">{{
              statusNames[selected.status] ?? selected.status
            }}</el-tag></el-descriptions-item
          >
          <el-descriptions-item label="授权">{{
            licenseNames[selected.license as SampleLicense] ?? selected.license
          }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{
            selected.sourceUrl || "—"
          }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{
            selected.note || "—"
          }}</el-descriptions-item>
          <el-descriptions-item label="提取">{{
            selected.model
              ? `${selected.model} · ${selected.extractorVersion ?? ""}`
              : "尚未提取"
          }}</el-descriptions-item>
          <el-descriptions-item v-if="selected.rejectReason" label="拒收原因">{{
            selected.rejectReason
          }}</el-descriptions-item>
          <el-descriptions-item v-if="selected.error" label="错误">{{
            selected.error
          }}</el-descriptions-item>
          <el-descriptions-item label="审核">{{
            selected.reviewedBy
              ? `${selected.reviewedBy} · ${formatTime(selected.reviewedAtMs)}`
              : "未审核"
          }}</el-descriptions-item>
          <el-descriptions-item label="创建">{{
            `${selected.createdBy ?? "—"} · ${formatTime(selected.createdAtMs)}`
          }}</el-descriptions-item>
        </el-descriptions>

        <h3 class="mt-4 mb-2 font-semibold">提取结果</h3>
        <el-input
          v-model="resultText"
          type="textarea"
          :rows="14"
          :readonly="!canEdit"
          placeholder="还没有提取结果"
          class="font-mono"
          aria-label="提取结果 JSON"
        />
        <el-alert
          v-if="resultError"
          :title="resultError"
          type="error"
          :closable="false"
          class="mt-2"
        />
        <div v-if="canWrite" class="mt-3 flex flex-wrap gap-2">
          <el-button
            v-if="['PENDING', 'FAILED', 'EXTRACTED'].includes(selected.status)"
            :disabled="busy || !selected.hasImage"
            @click="extract"
            >{{ selected.extraction ? "重新提取" : "提取" }}</el-button
          >
          <template v-if="canEdit">
            <el-button :disabled="busy" @click="saveResult">保存修改</el-button>
            <el-button
              type="success"
              :disabled="busy"
              @click="review('APPROVED')"
              >审核通过</el-button
            >
            <el-button
              type="warning"
              :disabled="busy"
              @click="review('REJECTED')"
              >审核拒绝</el-button
            >
          </template>
          <el-button type="danger" plain :disabled="busy" @click="remove"
            >删除</el-button
          >
        </div>

        <template v-if="selected.status === 'APPROVED'">
          <h3 class="mt-5 mb-2 font-semibold">模板草稿</h3>
          <p v-if="selected.templateId" class="text-sm">
            已生成草稿（{{ selected.templateId }}），请到“模板审核”处理。
          </p>
          <p v-else-if="selected.license === 'UNKNOWN'" class="text-sm">
            授权不确定的样本只参与统计，不能生成模板。
          </p>
          <el-form v-else-if="canDraft" label-position="top">
            <el-form-item label="类型">
              <el-select v-model="draftKind">
                <el-option label="经典" value="CLASSIC" />
                <el-option label="流行" value="TREND" />
              </el-select>
            </el-form-item>
            <el-form-item label="模板文案（可不填）">
              <el-input
                v-model="draftText"
                maxlength="60"
                show-word-limit
                placeholder="只写具体单品，不写风格形容词"
              />
            </el-form-item>
            <el-button type="primary" :loading="busy" @click="createDraft"
              >生成模板草稿</el-button
            >
          </el-form>
          <el-input
            v-if="draftResult"
            :model-value="draftResult"
            type="textarea"
            :rows="8"
            readonly
            class="mt-3 font-mono"
            aria-label="模板草稿"
          />
        </template>
      </template>
    </el-drawer>
  </main>
</template>

<style scoped>
.upload-box {
  display: grid;
  gap: 12px;
  justify-items: center;
}

.upload-box img {
  max-width: 100%;
  max-height: 260px;
  object-fit: contain;
}

.sample-image {
  --preset-image-ratio: 3 / 4;

  display: grid;
  place-items: center;
  width: min(100%, 360px);
  margin: 0 auto;
  overflow: hidden;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}
</style>
