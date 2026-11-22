<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  batchLooks,
  composeLook,
  createLook,
  editLook,
  getLookImage,
  getLooks,
  putLookImage,
  removeLook,
  type LookAction,
  type LookCategory,
  type LookCoverage,
  type LookStatus,
  type ManagedLook
} from "@/api/closet/looks";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import PresetImage from "../PresetImage.vue";
import { formatTime, useClosetRequest } from "../useClosetRequest";
import Categories from "./Categories.vue";
import LookFields from "./LookFields.vue";
import PresetPicker from "./PresetPicker.vue";
import {
  composeProblem,
  imageProblem,
  lookProblem,
  lookTags,
  type LookForm
} from "./lookLogic";

defineOptions({ name: "ClosetLooks" });

const statuses: Record<LookStatus, string> = {
  DRAFT: "草稿",
  LISTED: "已上架",
  UNLISTED: "已下架"
};
const statusTypes: Record<LookStatus, "info" | "success" | "warning"> = {
  DRAFT: "info",
  LISTED: "success",
  UNLISTED: "warning"
};
const coverages: Record<LookCoverage, string> = {
  FULL: "全身",
  UPPER: "上半身",
  LOWER: "下半身"
};
const actions: Record<LookAction, string> = {
  LIST: "上架",
  UNLIST: "下架",
  VERIFY: "标记已验证",
  UNVERIFY: "取消验证",
  REMOVE: "移除"
};
const verifyNote = "标记已验证前，请先用鱼搭管理员账号在镜头试穿里试一下";
const uploadNote = "请使用无人物、你有权使用的整套平铺图";
const size = 48;

const { can } = useCurrentPermissions();
const canWrite = computed(() => can("closet:looks:write"));
const request = useClosetRequest();
const categoryPanel = ref<InstanceType<typeof Categories>>();
const categories = ref<LookCategory[]>([]);
let active = true;

// ── 整套网格 ──
const status = ref<LookStatus>();
const category = ref<string>();
const verified = ref<"true" | "false">();
const query = ref("");
const page = ref(1);
const total = ref(0);
const looks = ref<ManagedLook[]>([]);
const selection = ref<string[]>([]);
const busy = ref(false);

function refresh(reset = false) {
  if (reset) page.value = 1;
  selection.value = [];
  return request.run(
    () =>
      getLooks({
        page: page.value - 1,
        size,
        status: status.value || undefined,
        category: category.value || undefined,
        verified: verified.value ? verified.value === "true" : undefined,
        q: query.value.trim() || undefined
      }),
    ({ data }) => {
      looks.value = data.items;
      total.value = data.total;
      if (page.value > 1 && data.items.length === 0) {
        page.value = Math.max(1, Math.ceil(data.total / size));
        void refresh();
      }
    }
  );
}
async function refreshAll() {
  await refresh();
  await categoryPanel.value?.refresh();
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
async function confirmAction(action: LookAction, count: number) {
  if (action === "REMOVE")
    return confirm(
      "移除后这些整套不再出现在任何列表里，也不能再上架。已经在进行的试穿不受影响。",
      `移除 ${count} 套`,
      "移除"
    );
  if (action === "VERIFY")
    return confirm(
      `${verifyNote}。确认这 ${count} 套都在镜头里试过、效果好？`,
      "标记已验证",
      "标记已验证"
    );
  if (action === "LIST")
    return confirm(
      `上架后，启用分类里的这 ${count} 套会出现在用户的镜头试穿里。`,
      "上架",
      "上架"
    );
  return true;
}
async function batch(action: LookAction) {
  const ids = [...selection.value];
  if (busy.value || !ids.length || !(await confirmAction(action, ids.length)))
    return;
  busy.value = true;
  try {
    const { data } = await batchLooks(ids, action);
    message(`已更新 ${data.updated} 套`, { type: "success" });
    await refreshAll();
  } catch (error) {
    const code = (error as { response?: { status?: number } })?.response
      ?.status;
    showError(
      error,
      action === "LIST" && code === 400
        ? "有整套还没有图片，不能上架；这一批都没有改动"
        : undefined
    );
  } finally {
    busy.value = false;
  }
}

// ── 新建：上传图片 / 用预设衣物拼一套 ──
const createMode = ref<"upload" | "compose">("upload");
const createForm = ref<LookForm>(emptyForm());
const createFile = ref<File>();
const createPreview = ref("");
const presetIds = ref<string[]>([]);
const fileInput = ref<HTMLInputElement>();
let fileTarget: "create" | "replace" = "create";
const createDialog = ref(false);
const createError = computed(() => {
  const problem = lookProblem(createForm.value);
  if (problem) return problem;
  if (createMode.value === "upload" && !createFile.value)
    return "请选择一张图片";
  if (createMode.value === "compose")
    return composeProblem(presetIds.value.length);
  return "";
});
function emptyForm(): LookForm {
  const first =
    categories.value.find(item => item.enabled) ?? categories.value[0];
  return {
    name: "",
    category: category.value || first?.key || "",
    tags: [],
    coverage: "FULL",
    gender: "UNISEX"
  };
}
function setPreview(file?: File) {
  if (createPreview.value) URL.revokeObjectURL(createPreview.value);
  createFile.value = file;
  createPreview.value = file ? URL.createObjectURL(file) : "";
}
function openCreate(mode: "upload" | "compose") {
  createForm.value = emptyForm();
  presetIds.value = [];
  setPreview();
  createMode.value = mode;
  createDialog.value = true;
}
function pickFile(target: "create" | "replace") {
  fileTarget = target;
  fileInput.value?.click();
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const problem = imageProblem(file);
  if (problem) {
    message(problem, { type: "warning" });
    return;
  }
  if (fileTarget === "create") setPreview(file);
  else await replaceImage(file);
}
function formBody(form: LookForm) {
  return {
    name: form.name.trim(),
    category: form.category,
    tags: lookTags(form.tags),
    coverage: form.coverage,
    gender: form.gender
  };
}
async function submitCreate() {
  if (createError.value || busy.value) return;
  busy.value = true;
  try {
    if (createMode.value === "compose") {
      await composeLook({
        ...formBody(createForm.value),
        presetIds: [...presetIds.value]
      });
      message("已拼好一套草稿，看看效果再上架", { type: "success" });
    } else {
      const file = createFile.value!;
      const { data } = await createLook(formBody(createForm.value));
      try {
        await putLookImage(data.id, file);
        message("已上传，整套是草稿，验证后再上架", { type: "success" });
      } catch (error) {
        showError(error, "草稿已建好，但图片没有传上去，可在编辑里换图");
      }
    }
    if (!active) return;
    createDialog.value = false;
    setPreview();
    await refreshAll();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}

// ── 编辑抽屉 ──
const drawer = ref(false);
const selected = ref<ManagedLook>();
const editForm = ref<LookForm>(emptyForm());
const editSort = ref(0);
const editStatus = ref<LookStatus>("DRAFT");
const editError = computed(() => lookProblem(editForm.value));
function openEdit(row: ManagedLook) {
  selected.value = row;
  editForm.value = {
    name: row.name,
    category: row.category,
    tags: [...row.tags],
    coverage: row.coverage,
    gender: row.gender
  };
  editSort.value = row.sort;
  editStatus.value = row.status;
  drawer.value = true;
}
function applySelected(row: ManagedLook) {
  selected.value = row;
  if (!row.hasImage && editStatus.value === "LISTED")
    editStatus.value = row.status;
}
async function saveEdit() {
  if (!selected.value || editError.value || busy.value) return;
  busy.value = true;
  try {
    await editLook(selected.value.id, {
      ...formBody(editForm.value),
      sort: editSort.value,
      status: editStatus.value
    });
    if (!active) return;
    drawer.value = false;
    message("已保存", { type: "success" });
    await refreshAll();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}
async function setVerified(value: boolean) {
  const row = selected.value;
  if (!row || busy.value) return;
  if (
    value &&
    !(await confirm(
      `${verifyNote}。确认这套在镜头里效果好？`,
      "标记已验证",
      "标记已验证"
    ))
  )
    return;
  busy.value = true;
  try {
    const { data } = await editLook(row.id, { verified: value });
    if (!active) return;
    applySelected(data);
    message(value ? "已标记已验证" : "已取消验证", { type: "success" });
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}
async function beginReplace() {
  if (
    await confirm(
      `${uploadNote}。换图后“已验证”标记会取消，需要在镜头里重新试一下。`,
      "换图",
      "选择图片"
    )
  )
    pickFile("replace");
}
async function replaceImage(file: File) {
  const row = selected.value;
  if (!row) return;
  busy.value = true;
  try {
    const { data } = await putLookImage(row.id, file);
    if (!active) return;
    applySelected(data);
    message("已换图，记得在镜头里重新验证", { type: "success" });
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}
async function removeSelected() {
  const row = selected.value;
  if (!row || busy.value) return;
  if (
    !(await confirm(
      "移除后这套不再出现在任何列表里，也不能再上架。",
      "移除整套",
      "移除"
    ))
  )
    return;
  busy.value = true;
  try {
    await removeLook(row.id);
    if (!active) return;
    drawer.value = false;
    message("已移除", { type: "success" });
    await refreshAll();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}

function changeCategories(items: LookCategory[]) {
  categories.value = items;
  if (category.value && !items.some(item => item.key === category.value)) {
    category.value = undefined;
    void refresh(true);
  }
}
onMounted(() => void refresh());
onBeforeUnmount(() => {
  active = false;
  setPreview();
});
</script>

<template>
  <main class="look-page">
    <ClosetUnavailable v-if="request.unavailable.value" />
    <template v-else>
      <el-alert type="info" :closable="false" show-icon class="note">
        <template #title>{{ verifyNote }}。</template>
        精选整套只在镜头试穿里使用，不进推荐、衣柜和统计。图片不会做人物检测，上传时{{
          uploadNote
        }}。
      </el-alert>

      <Categories
        ref="categoryPanel"
        :can-write="canWrite"
        @change="changeCategories"
      />

      <section class="looks">
        <el-form inline class="filters" @submit.prevent="refresh(true)">
          <el-form-item label="状态">
            <el-select
              v-model="status"
              clearable
              placeholder="全部状态"
              @change="refresh(true)"
            >
              <el-option
                v-for="(label, value) in statuses"
                :key="value"
                :label="label"
                :value="value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="分类">
            <el-select
              v-model="category"
              clearable
              placeholder="全部分类"
              @change="refresh(true)"
            >
              <el-option
                v-for="item in categories"
                :key="item.key"
                :label="item.enabled ? item.name : `${item.name}（已停用）`"
                :value="item.key"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="验证">
            <el-select
              v-model="verified"
              clearable
              placeholder="不限"
              @change="refresh(true)"
            >
              <el-option label="已验证" value="true" />
              <el-option label="未验证" value="false" />
            </el-select>
          </el-form-item>
          <el-form-item label="名称">
            <el-input
              v-model="query"
              clearable
              placeholder="搜索名称"
              @clear="refresh(true)"
            />
          </el-form-item>
          <el-button native-type="submit">搜索</el-button>
        </el-form>

        <div v-if="canWrite" class="actions">
          <el-button type="primary" @click="openCreate('upload')"
            >上传图片</el-button
          >
          <el-button @click="openCreate('compose')">用预设衣物拼一套</el-button>
          <span class="muted">已选 {{ selection.length }} 套</span>
          <el-button
            v-for="(label, value) in actions"
            :key="value"
            :type="value === 'REMOVE' ? 'danger' : undefined"
            plain
            :disabled="busy || !selection.length"
            @click="batch(value)"
            >{{ label }}</el-button
          >
        </div>
        <el-alert
          v-if="request.errorMessage.value"
          :title="request.errorMessage.value"
          type="error"
          :closable="false"
        />
        <el-empty
          v-if="!looks.length && !request.loading.value"
          description="暂无符合条件的整套"
        />
        <el-checkbox-group
          v-model="selection"
          v-loading="request.loading.value"
          class="look-grid"
        >
          <article v-for="row in looks" :key="row.id" class="look-card">
            <el-button
              text
              class="card-link"
              :aria-label="`编辑 ${row.name}`"
              @click="openEdit(row)"
            >
              <PresetImage
                v-if="row.hasImage"
                :key="`${row.id}-${row.imageVersion}`"
                :label="row.name"
                :load="() => getLookImage(row.id)"
              />
              <span v-else class="no-image">还没有图片</span>
            </el-button>
            <div class="card-meta">
              <strong>{{ row.name }}</strong>
              <div class="tags">
                <el-tag size="small" :type="statusTypes[row.status]">{{
                  statuses[row.status]
                }}</el-tag>
                <el-tag v-if="row.verified" size="small" type="success"
                  >已验证</el-tag
                >
                <el-tag v-if="!row.categoryEnabled" size="small" type="info"
                  >分类已停用</el-tag
                >
              </div>
              <span class="muted"
                >{{ row.categoryName }} · {{ coverages[row.coverage] }} ·
                {{ row.source === "COMPOSE" ? "拼图" : "上传" }} · 试过
                {{ row.tryCount }} 次</span
              >
              <el-checkbox
                v-if="canWrite"
                :value="row.id"
                :aria-label="`选择 ${row.name}`"
                >选择</el-checkbox
              >
            </div>
          </article>
        </el-checkbox-group>
        <el-pagination
          v-if="total > size"
          v-model:current-page="page"
          :page-size="size"
          :total="total"
          layout="prev, pager, next"
          @current-change="refresh()"
        />
      </section>
    </template>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      @change="chooseFile"
    />

    <el-dialog
      v-model="createDialog"
      :title="createMode === 'compose' ? '用预设衣物拼一套' : '上传整套图片'"
      :width="createMode === 'compose' ? 'min(96%, 900px)' : 'min(94%, 560px)'"
      :close-on-click-modal="!busy"
      :close-on-press-escape="!busy"
      :show-close="!busy"
      destroy-on-close
    >
      <el-alert
        v-if="createMode === 'upload'"
        :title="uploadNote"
        type="warning"
        :closable="false"
        show-icon
        class="note"
      >
        PNG、JPEG 或 WebP，最大 20 MB。服务端会去掉 EXIF，最长边缩到 1024。
      </el-alert>
      <el-alert
        v-else
        title="从已上架的预设衣物里挑 2–6 件，程序按试穿网格拼成一张图，不调用模型"
        type="info"
        :closable="false"
        class="note"
      />
      <div :class="createMode === 'compose' ? 'compose-layout' : ''">
        <div v-if="createMode === 'upload'" class="upload-box">
          <img v-if="createPreview" :src="createPreview" alt="待上传的整套" />
          <el-button :disabled="busy" @click="pickFile('create')">{{
            createFile ? "重新选择" : "选择图片"
          }}</el-button>
        </div>
        <PresetPicker v-else v-model="presetIds" />
        <el-form label-position="top" @submit.prevent="submitCreate">
          <LookFields v-model="createForm" :categories="categories" />
        </el-form>
      </div>
      <template #footer>
        <span v-if="createError" class="muted footer-hint">{{
          createError
        }}</span>
        <el-button :disabled="busy" @click="createDialog = false"
          >取消</el-button
        >
        <el-button
          type="primary"
          :disabled="!!createError"
          :loading="busy"
          @click="submitCreate"
          >{{ createMode === "compose" ? "拼图并保存草稿" : "上传" }}</el-button
        >
      </template>
    </el-dialog>

    <el-drawer v-model="drawer" title="编辑整套" size="min(100%, 520px)">
      <template v-if="selected">
        <div class="drawer-image">
          <PresetImage
            v-if="selected.hasImage"
            :key="`${selected.id}-${selected.imageVersion}`"
            :label="selected.name"
            :load="() => getLookImage(selected!.id)"
          />
          <span v-else class="no-image">还没有图片</span>
        </div>
        <p class="muted">
          {{
            selected.source === "COMPOSE"
              ? `用 ${selected.composePresetIds.length} 件预设衣物拼成`
              : "上传"
          }}
          <template v-if="selected.width && selected.height">
            · {{ selected.width }}×{{ selected.height }}</template
          >
          · 第 {{ selected.imageVersion }} 版图 · 试过
          {{ selected.tryCount }} 次 · 更新于
          {{ formatTime(selected.updatedAtMs) }}
        </p>
        <div class="verify-line">
          <el-tag :type="selected.verified ? 'success' : 'info'">{{
            selected.verified
              ? `已验证 · ${formatTime(selected.verifiedAtMs)}`
              : "未验证"
          }}</el-tag>
          <template v-if="canWrite">
            <el-button
              v-if="!selected.verified"
              size="small"
              :disabled="busy || !selected.hasImage"
              @click="setVerified(true)"
              >标记已验证</el-button
            >
            <el-button
              v-else
              size="small"
              :disabled="busy"
              @click="setVerified(false)"
              >取消验证</el-button
            >
            <el-button size="small" :disabled="busy" @click="beginReplace"
              >换图</el-button
            >
          </template>
        </div>
        <el-form
          label-position="top"
          :disabled="!canWrite"
          @submit.prevent="saveEdit"
        >
          <LookFields v-model="editForm" :categories="categories" />
          <div class="form-grid">
            <el-form-item label="排序">
              <el-input-number v-model="editSort" :precision="0" />
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="editStatus">
                <el-option
                  v-for="(label, value) in statuses"
                  :key="value"
                  :label="label"
                  :value="value"
                  :disabled="value === 'LISTED' && !selected.hasImage"
                />
              </el-select>
            </el-form-item>
          </div>
          <el-alert
            v-if="editError"
            :title="editError"
            type="info"
            :closable="false"
          />
          <div v-if="canWrite" class="actions">
            <el-button
              type="primary"
              native-type="submit"
              :disabled="!!editError"
              :loading="busy"
              >保存</el-button
            >
            <el-button
              type="danger"
              plain
              :disabled="busy"
              @click="removeSelected"
              >移除</el-button
            >
          </div>
        </el-form>
      </template>
    </el-drawer>
  </main>
</template>

<style scoped>
.look-page {
  --preset-image-ratio: 3 / 4;

  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.note {
  margin-bottom: 4px;
}

.muted {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.filters :deep(.el-select) {
  min-width: 130px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-block: 12px;
}

.actions .el-button {
  margin-left: 0;
}

.look-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;

  /* el-checkbox-group 自带 font-size: 0; line-height: 0，卡片里的文字会继承成看不见、挤成一团，这里恢复正常排版。 */
  font-size: var(--el-font-size-base);
  line-height: 1.5;
}

.look-card {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
}

.card-link {
  display: block;
  width: 100%;
  height: auto;
  padding: 0;
}

.card-link :deep(span) {
  display: block;
  width: 100%;
}

.no-image {
  display: grid;
  place-items: center;
  aspect-ratio: 3 / 4;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  padding: 10px 12px 12px;
}

.card-meta strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.card-meta .muted {
  font-size: 12px;
}

.card-meta .el-checkbox {
  height: 24px;
  margin-right: 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.el-pagination {
  margin-top: 12px;
}

.upload-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  margin-block: 12px;
}

.upload-box img {
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
  background: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-base);
}

.compose-layout {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(220px, 2fr);
  gap: 16px;
  margin-top: 12px;
}

.footer-hint {
  margin-right: 12px;
}

.drawer-image {
  --preset-image-ratio: 3 / 4;

  width: min(100%, 300px);
  margin-bottom: 8px;
}

.verify-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-block: 8px 16px;
}

.verify-line .el-button {
  margin-left: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

@media (width <= 760px) {
  .compose-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
