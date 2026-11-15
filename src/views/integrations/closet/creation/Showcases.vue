<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessageBox, type UploadFile } from "element-plus";
import {
  createShowcase,
  editShowcase,
  getShowcaseImage,
  getShowcases,
  publishShowcase,
  retireShowcase,
  uploadShowcase,
  type Showcase,
  type ShowcaseContent,
  type ShowcaseUpload
} from "@/api/closet/showcases";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useClosetRequest } from "../useClosetRequest";
import { message } from "@/utils/message";

defineOptions({ name: "ClosetCreationShowcases" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const items = ref<Showcase[]>([]);
const total = ref(0);
const page = ref(1);
const busy = ref(false);
const dialog = ref(false);
const selected = ref<Showcase>();
const content = ref<ShowcaseContent>({
  title: "",
  description: "",
  sortOrder: 0
});
const sourceNote = ref("");
const file = ref<File>();
const uploaded = ref<ShowcaseUpload>();
const preview = ref("");
const previewLoading = ref(false);
const conflict = ref(false);
let previewSerial = 0;
const labels = { DRAFT: "草稿", PUBLISHED: "已发布", RETIRED: "已下架" };
const editable = computed(
  () => !selected.value || selected.value.status !== "PUBLISHED"
);
function clearPreview() {
  previewSerial++;
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = "";
}
function reset() {
  clearPreview();
  previewLoading.value = false;
  selected.value = undefined;
  file.value = undefined;
  uploaded.value = undefined;
  sourceNote.value = "";
  content.value = { title: "", description: "", sortOrder: 0 };
  conflict.value = false;
}
async function refresh() {
  if (!can("closet:showcase:read")) return;
  await run(
    () => getShowcases(page.value - 1, 20),
    response => {
      items.value = response.data.items;
      total.value = response.data.total;
    }
  );
}
function create() {
  if (!can("closet:showcase:write")) return;
  reset();
  dialog.value = true;
}
async function inspect(row: Showcase) {
  reset();
  selected.value = row;
  content.value = {
    title: row.title,
    description: row.description,
    sortOrder: row.sortOrder
  };
  sourceNote.value = row.sourceNote;
  dialog.value = true;
  previewLoading.value = true;
  const serial = ++previewSerial;
  try {
    const image = await getShowcaseImage(row.id);
    if (serial === previewSerial) preview.value = URL.createObjectURL(image);
  } catch {
    if (serial === previewSerial)
      message("预览读取失败，可重新打开查看", { type: "error" });
  } finally {
    if (serial === previewSerial) previewLoading.value = false;
  }
}
function choose(upload: UploadFile) {
  if (!upload.raw) return;
  if (
    upload.raw.type !== "image/png" ||
    !upload.raw.name.toLowerCase().endsWith(".png")
  ) {
    message("请选择 PNG 图片", { type: "warning" });
    return;
  }
  if (upload.raw.size > 10 * 1024 * 1024) {
    message("PNG 图片不能超过 10 MiB", { type: "warning" });
    return;
  }
  clearPreview();
  file.value = upload.raw;
  uploaded.value = undefined;
  preview.value = URL.createObjectURL(upload.raw);
}
async function failed(error: unknown) {
  const response = (
    error as { response?: { status?: number; data?: { message?: string } } }
  ).response;
  if (response?.status === 409) {
    conflict.value = true;
    await refresh();
    message("版本或状态已变化，请点击重新载入后再操作", { type: "warning" });
    return;
  }
  message(
    response?.data?.message || "操作失败，请检查图片、生成标识和来源说明后重试",
    { type: "error" }
  );
}
async function save() {
  if (
    busy.value ||
    conflict.value ||
    !editable.value ||
    !can("closet:showcase:write")
  )
    return;
  if (!content.value.title.trim() || /[\r\n]/.test(content.value.title)) {
    message("请填写单行标题", { type: "warning" });
    return;
  }
  if (
    !selected.value &&
    (!file.value || !sourceNote.value.trim() || /[\r\n]/.test(sourceNote.value))
  ) {
    message("请选择 PNG 并填写单行来源说明", { type: "warning" });
    return;
  }
  busy.value = true;
  try {
    if (selected.value) {
      await editShowcase(
        selected.value.id,
        selected.value.revision,
        content.value
      );
    } else {
      // Keep a successful upload in memory if draft creation fails; do not upload twice on retry.
      uploaded.value ??= (
        await uploadShowcase(file.value!, sourceNote.value.trim())
      ).data;
      await createShowcase(uploaded.value.uploadId, content.value);
    }
    message(selected.value ? "草稿已保存" : "草稿已创建", { type: "success" });
    dialog.value = false;
    await refresh();
  } catch (error) {
    await failed(error);
  } finally {
    busy.value = false;
  }
}
async function changeStatus(row: Showcase, publish: boolean) {
  if (busy.value || !can("closet:showcase:publish")) return;
  try {
    await ElMessageBox.confirm(
      publish
        ? "发布后将在登录区域公开展示此官方素材。"
        : "下架后停止新的公开访问，已保存的图片无法撤回。",
      publish ? "发布官方素材" : "下架官方素材",
      { type: "warning" }
    );
  } catch {
    return;
  }
  busy.value = true;
  try {
    if (publish) await publishShowcase(row.id, row.revision);
    else await retireShowcase(row.id, row.revision);
    message(publish ? "素材已发布" : "素材已下架", { type: "success" });
    dialog.value = false;
    await refresh();
  } catch (error) {
    await failed(error);
  } finally {
    busy.value = false;
  }
}
async function reload() {
  const id = selected.value?.id;
  await refresh();
  const fresh = items.value.find(row => row.id === id);
  if (fresh) await inspect(fresh);
  else {
    dialog.value = false;
    message("素材已不在当前列表，请刷新后查看", { type: "warning" });
  }
}
onMounted(refresh);
onBeforeUnmount(clearPreview);
</script>
<template>
  <section class="showcases-page">
    <div class="toolbar">
      <div>
        <h1>官方素材</h1>
        <p>专门准备的可公开图片，用于登录区域精选展示。</p>
      </div>
      <div class="actions">
        <el-button :loading="loading" @click="refresh">刷新</el-button
        ><el-button
          v-if="can('closet:showcase:write')"
          type="primary"
          @click="create"
          >新建素材</el-button
        >
      </div>
    </div>
    <el-alert
      title="仅上传可公开的 PNG，保留显式 AI 生成标识与隐式生成信息。缺少隐式标识的图片会被拒绝。"
      type="info"
      :closable="false"
      show-icon
    />
    <ClosetUnavailable v-if="unavailable" @retry="refresh" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <el-table
      v-else
      v-loading="loading"
      :data="items"
      empty-text="暂无官方素材，创建草稿后可审核发布"
    >
      <el-table-column prop="title" label="标题" min-width="170" />
      <el-table-column label="状态" width="100"
        ><template #default="{ row }"
          ><el-tag :type="row.status === 'PUBLISHED' ? 'success' : 'info'">{{
            labels[row.status as keyof typeof labels]
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column label="生成标识" width="110"
        ><template #default>AI 生成</template></el-table-column
      >
      <el-table-column
        prop="sourceNote"
        label="来源说明"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column prop="sortOrder" label="排序" width="80" />
      <el-table-column label="操作" width="240"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="inspect(row)">{{
            can("closet:showcase:write") && row.status !== "PUBLISHED"
              ? "查看与编辑"
              : "查看"
          }}</el-button
          ><el-button
            v-if="can('closet:showcase:publish') && row.status === 'DRAFT'"
            link
            type="primary"
            :disabled="busy"
            @click="changeStatus(row, true)"
            >发布</el-button
          ><el-button
            v-if="can('closet:showcase:publish') && row.status === 'PUBLISHED'"
            link
            type="danger"
            :disabled="busy"
            @click="changeStatus(row, false)"
            >下架</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-pagination
      v-if="total > 20"
      v-model:current-page="page"
      :page-size="20"
      :total="total"
      layout="prev, pager, next, total"
      @current-change="refresh"
    />
    <el-dialog
      v-model="dialog"
      :title="selected ? '官方素材详情' : '新建官方素材'"
      width="min(760px, calc(100vw - 32px))"
      :close-on-click-modal="!busy"
      :close-on-press-escape="!busy"
      :show-close="!busy"
      @closed="reset"
    >
      <el-alert
        v-if="conflict"
        title="版本或状态已变化，请重新载入后编辑。"
        type="warning"
        :closable="false"
        ><el-button @click="reload">重新载入</el-button></el-alert
      >
      <div class="editor">
        <div v-loading="previewLoading" class="preview">
          <el-image
            v-if="preview"
            :src="preview"
            fit="contain"
            alt="官方素材预览"
          /><el-empty v-else description="选择图片后显示本地预览" />
        </div>
        <el-form
          label-position="top"
          :disabled="
            busy || conflict || !editable || !can('closet:showcase:write')
          "
        >
          <el-form-item
            v-if="!selected"
            label="PNG 图片（最多 10 MiB、2000 万像素）"
            ><el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept="image/png,.png"
              :on-change="choose"
              ><el-button>选择图片</el-button></el-upload
            ><span v-if="file" class="filename">{{
              file.name
            }}</span></el-form-item
          >
          <el-form-item label="来源说明" required
            ><el-input
              v-model="sourceNote"
              :disabled="!!selected || !!uploaded"
              :maxlength="1000"
              placeholder="说明素材的准备来源与可公开依据"
          /></el-form-item>
          <el-form-item label="标题" required
            ><el-input v-model="content.title" :maxlength="80" show-word-limit
          /></el-form-item>
          <el-form-item label="说明"
            ><el-input
              v-model="content.description"
              type="textarea"
              :rows="3"
              :maxlength="500"
              show-word-limit
          /></el-form-item>
          <el-form-item label="排序（小值优先）"
            ><el-input-number
              v-model="content.sortOrder"
              :min="0"
              :max="10000"
              :precision="0"
          /></el-form-item>
        </el-form>
      </div>
      <p v-if="selected" class="metadata">
        AI 生成 · {{ labels[selected.status] }} · {{ selected.width }} ×
        {{ selected.height }} · 修订 {{ selected.revision }}
      </p>
      <p v-if="selected?.status === 'PUBLISHED'">
        已发布素材需先下架，编辑后成为草稿，再重新发布。
      </p>
      <p v-if="selected?.status === 'RETIRED'">
        保存编辑后将恢复为草稿，可重新审核发布。
      </p>
      <template #footer
        ><el-button :disabled="busy" @click="dialog = false">关闭</el-button
        ><el-button
          v-if="editable && can('closet:showcase:write')"
          type="primary"
          :loading="busy"
          :disabled="conflict"
          @click="save"
          >{{ selected ? "保存草稿" : "创建草稿" }}</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>
<style scoped>
.showcases-page {
  padding: 24px;
}

.toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

p {
  color: var(--el-text-color-regular);
}

.actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.el-table {
  margin-top: 20px;
}

.el-pagination {
  margin-top: 20px;
}

.editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  margin-top: 16px;
}

.preview {
  display: grid;
  place-items: center;
  min-height: 260px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.preview .el-image {
  width: 100%;
  height: 360px;
}

.filename {
  margin-left: 8px;
  overflow-wrap: anywhere;
}

.metadata {
  overflow-wrap: anywhere;
}

@media (width <= 600px) {
  .showcases-page {
    padding: 16px;
  }

  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .editor {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview .el-image {
    height: 240px;
  }
}
</style>
