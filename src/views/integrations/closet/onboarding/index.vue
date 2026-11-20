<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { ElMessageBox } from "element-plus";
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
import CoverCrop from "./CoverCrop.vue";

defineOptions({ name: "ClosetOnboarding" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const canWrite = computed(() => can("closet:onboarding:write"));
const items = ref<StyleCover[]>([]);
const selected = ref<StyleCover>();
const fileInput = ref<HTMLInputElement>();
const crop = ref<InstanceType<typeof CoverCrop>>();
const image = shallowRef<HTMLImageElement>();
const dialog = ref(false);
const busy = ref(false);
const decoding = ref(false);
let active = true;

function refresh() {
  return run(getStyleCovers, ({ data }) => {
    items.value = data.items;
  });
}
function begin(row: StyleCover) {
  selected.value = row;
  fileInput.value?.click();
}
async function choose(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    message("请选择 PNG、JPEG 或 WebP 图片", { type: "warning" });
    return;
  }
  if (!file.size || file.size > 8 * 1024 * 1024) {
    message("图片不能为空，且不能超过 8 MB", { type: "warning" });
    return;
  }
  decoding.value = true;
  const url = URL.createObjectURL(file);
  try {
    const source = new Image();
    source.src = url;
    await source.decode();
    if (active) {
      image.value = source;
      dialog.value = true;
    }
  } catch {
    if (active) message("无法读取这张图片，请重新选择", { type: "error" });
  } finally {
    URL.revokeObjectURL(url);
    decoding.value = false;
  }
}
function clearImage() {
  if (!dialog.value) image.value = undefined;
}
function errorMessageFor(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })
    .response;
  return response?.data?.message || "操作失败，请重试";
}
async function save() {
  if (!selected.value || !crop.value) return;
  busy.value = true;
  try {
    const file = await crop.value.exportJpeg();
    await putStyleCover(selected.value.key, file);
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
onBeforeUnmount(() => {
  active = false;
});
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
                :disabled="busy || decoding"
                @click="begin(row)"
                >{{ row.configured ? "更换" : "上传" }}</el-button
              >
              <el-button
                v-if="row.configured"
                text
                type="danger"
                :disabled="busy || decoding"
                @click="remove(row)"
                >移除</el-button
              >
            </div>
          </div>
        </article>
      </div>
    </template>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      @change="choose"
    />
    <el-dialog
      v-model="dialog"
      :title="`裁剪${selected?.style ?? ''}封面`"
      width="min(94%, 720px)"
      :close-on-click-modal="!busy"
      :close-on-press-escape="!busy"
      :show-close="!busy"
      @closed="clearImage"
    >
      <CoverCrop
        v-if="image && selected"
        ref="crop"
        :source="image"
        :style-name="selected.style"
        :disabled="busy"
      />
      <template #footer>
        <el-button :disabled="busy || decoding" @click="fileInput?.click()"
          >重新选择</el-button
        >
        <el-button :disabled="busy" @click="dialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!image || decoding"
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

.cover-empty {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
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
