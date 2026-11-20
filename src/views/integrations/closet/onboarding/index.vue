<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessageBox, type UploadFile } from "element-plus";
import {
  getStyleCoverImage,
  getStyleCovers,
  putStyleCover,
  removeStyleCover,
  type StyleCover
} from "@/api/closet/presets";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import PresetImage from "../PresetImage.vue";
import { useClosetRequest } from "../useClosetRequest";

defineOptions({ name: "ClosetOnboarding" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const canWrite = computed(() => can("closet:onboarding:write"));
const items = ref<StyleCover[]>([]);
const selected = ref<StyleCover>();
const file = ref<File>();
const preview = ref("");
const dialog = ref(false);
const busy = ref(false);

function refresh() {
  return run(getStyleCovers, ({ data }) => {
    items.value = data.items;
  });
}
function clearPreview() {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = "";
  file.value = undefined;
}
function begin(row: StyleCover) {
  clearPreview();
  selected.value = row;
  dialog.value = true;
}
function choose(upload: UploadFile) {
  clearPreview();
  if (!upload.raw) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(upload.raw.type)) {
    message("请选择 PNG、JPEG 或 WebP 图片", { type: "warning" });
    return;
  }
  if (!upload.raw.size || upload.raw.size > 8 * 1024 * 1024) {
    message("图片不能为空，且不能超过 8 MB", { type: "warning" });
    return;
  }
  file.value = upload.raw;
  preview.value = URL.createObjectURL(upload.raw);
}
function errorMessageFor(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })
    .response;
  return response?.data?.message || "操作失败，请重试";
}
async function save() {
  if (!selected.value || !file.value) return;
  busy.value = true;
  try {
    await putStyleCover(selected.value.key, file.value);
    dialog.value = false;
    message("已保存封面", { type: "success" });
    await refresh();
  } catch (error) {
    message(errorMessageFor(error), { type: "error" });
  } finally {
    busy.value = false;
  }
}
async function remove(row: StyleCover) {
  try {
    await ElMessageBox.confirm(
      `移除后，「${row.style}」将使用引导页原有的展示方式。`,
      "移除引导封面",
      { type: "warning", confirmButtonText: "移除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  busy.value = true;
  try {
    await removeStyleCover(row.key);
    message("已移除封面", { type: "success" });
    await refresh();
  } catch (error) {
    message(errorMessageFor(error), { type: "error" });
  } finally {
    busy.value = false;
  }
}
onMounted(refresh);
onBeforeUnmount(clearPreview);
</script>

<template>
  <main class="cover-page">
    <ClosetUnavailable v-if="unavailable" />
    <template v-else>
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        :closable="false"
      />
      <div v-loading="loading" class="cover-grid">
        <article v-for="row in items" :key="row.key" class="cover-card">
          <PresetImage
            v-if="row.configured"
            :key="row.updatedAtMs ?? row.key"
            :label="row.style"
            :load="() => getStyleCoverImage(row.key)"
          />
          <div v-else class="cover-empty">未设置（显示文字）</div>
          <div class="card-footer">
            <strong>{{ row.style }}</strong>
            <div v-if="canWrite">
              <el-button
                text
                type="primary"
                :disabled="busy"
                @click="begin(row)"
                >{{ row.configured ? "更换" : "上传" }}</el-button
              >
              <el-button
                v-if="row.configured"
                text
                type="danger"
                :disabled="busy"
                @click="remove(row)"
                >移除</el-button
              >
            </div>
          </div>
        </article>
      </div>
    </template>

    <el-dialog
      v-model="dialog"
      :title="`${selected?.style ?? ''}封面`"
      width="min(92%, 520px)"
      :close-on-click-modal="!busy"
      :close-on-press-escape="!busy"
      :show-close="!busy"
      @closed="clearPreview"
    >
      <div v-if="preview" class="cover-preview">
        <img :src="preview" alt="待上传的封面" />
      </div>
      <p>建议比例 4:3。PNG、JPEG 或 WebP，最多 8 MB。</p>
      <el-upload
        accept="image/png,image/jpeg,image/webp"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="choose"
      >
        <el-button :disabled="busy">{{
          preview ? "重新选择" : "选择图片"
        }}</el-button>
      </el-upload>
      <template #footer>
        <el-button :disabled="busy" @click="dialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!file"
          :loading="busy"
          @click="save"
          >上传封面</el-button
        >
      </template>
    </el-dialog>
  </main>
</template>

<style scoped>
.cover-page {
  padding: 16px;
}

.cover-grid {
  --preset-image-ratio: 4 / 3;
  --preset-image-fit: cover;

  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.cover-card {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
}

.cover-empty,
.cover-preview {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding-inline: 10px;
}

@media (width <= 1100px) {
  .cover-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width <= 750px) {
  .cover-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 440px) {
  .cover-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
