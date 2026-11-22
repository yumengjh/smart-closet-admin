<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  batchPoses,
  checkPose,
  createPose,
  editPose,
  extractPose,
  getPoseCheckSettings,
  getPoses,
  putPoseCheckSettings,
  removePose,
  type ManagedPose,
  type PoseAction,
  type PoseCheckSettings,
  type PoseCheckValues,
  type PoseHit,
  type PoseKeypoints,
  type PoseStatus,
  type ViewAngle
} from "@/api/closet/poses";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { formatTime, useClosetRequest } from "../useClosetRequest";
import PoseSkeleton from "./PoseSkeleton.vue";
import {
  CHECK_KINDS,
  HIT_KINDS,
  POSE_ID,
  SIDES,
  checkChanges,
  cleanTags
} from "./poseLogic";

defineOptions({ name: "ClosetPoses" });

const statuses: Record<PoseStatus, string> = {
  DRAFT: "草稿",
  LISTED: "已上架",
  UNLISTED: "已下架"
};
const statusTypes: Record<PoseStatus, "info" | "success" | "warning"> = {
  DRAFT: "info",
  LISTED: "success",
  UNLISTED: "warning"
};
const angles: Record<ViewAngle, string> = {
  FRONT: "正面",
  THREE_QUARTER: "四分之三侧",
  SIDE: "侧面",
  BACK: "背面"
};
const sources = { SEED: "初始", TEXT: "文字", PHOTO: "照片" };
const actions: Record<PoseAction, string> = {
  LIST: "批量上架",
  UNLIST: "批量下架",
  REMOVE: "批量移除"
};
const removeText =
  "移除后用户在做张图里不能再选这个动作，已经生成的上身图不受影响。";
const maxPhotoBytes = 8 * 1024 * 1024;

const { can } = useCurrentPermissions();
const canWrite = computed(() => can("closet:poses:write"));
const listRequest = useClosetRequest();
const settingsRequest = useClosetRequest();
let active = true;

// ── 敏感检查 ──
const settings = ref<PoseCheckSettings>();
const draftSettings = ref<PoseCheckValues>();
const savingSettings = ref(false);
const settingChanges = computed(() =>
  settings.value && draftSettings.value
    ? checkChanges(settings.value, draftSettings.value)
    : []
);
function applySettings(data: PoseCheckSettings) {
  settings.value = data;
  draftSettings.value = { user: { ...data.user }, admin: { ...data.admin } };
}
function loadSettings() {
  return settingsRequest.run(getPoseCheckSettings, ({ data }) =>
    applySettings(data)
  );
}
async function saveSettings() {
  if (!settings.value || !draftSettings.value || savingSettings.value) return;
  const changes = settingChanges.value;
  if (!changes.length) return;
  try {
    await ElMessageBox.confirm(
      h("div", [
        h("p", "这次会改动下面几项，只影响之后的新建和修改："),
        h(
          "ul",
          { class: "change-list" },
          changes.map(change => h("li", change.text))
        )
      ]),
      "保存敏感检查",
      { type: "warning", confirmButtonText: "保存", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  savingSettings.value = true;
  try {
    const { data } = await putPoseCheckSettings({
      user: { ...draftSettings.value.user },
      admin: { ...draftSettings.value.admin },
      revision: settings.value.revision
    });
    if (!active) return;
    applySettings(data);
    message("已保存敏感检查", { type: "success" });
  } catch (error) {
    if (status(error) === 409) {
      message("设置已被其他管理员修改，已重新读取，请确认后再改", {
        type: "warning"
      });
      await loadSettings();
    } else showError(error);
  } finally {
    savingSettings.value = false;
  }
}

// ── 动作列表 ──
const filterStatus = ref<PoseStatus>();
const query = ref("");
const rows = ref<ManagedPose[]>([]);
const total = ref(0);
const selection = ref<ManagedPose[]>([]);
const busy = ref(false);
function refresh() {
  selection.value = [];
  return listRequest.run(
    () =>
      getPoses({
        status: filterStatus.value || undefined,
        q: query.value.trim() || undefined
      }),
    ({ data }) => {
      rows.value = data.items;
      total.value = data.total;
    }
  );
}
async function confirmRemoval(count: number) {
  try {
    await ElMessageBox.confirm(
      removeText,
      count > 1 ? `移除 ${count} 个动作` : "移除动作",
      { type: "warning", confirmButtonText: "移除", cancelButtonText: "取消" }
    );
    return true;
  } catch {
    return false;
  }
}
async function change(action: PoseAction, id?: string) {
  if (busy.value) return;
  const ids = id ? [id] : selection.value.map(row => row.id);
  if (!ids.length) return;
  if (action === "REMOVE" && !(await confirmRemoval(ids.length))) return;
  busy.value = true;
  try {
    const updated = id
      ? (await removePose(id), 1)
      : (await batchPoses(ids, action)).data.updated;
    message(`已更新 ${updated} 个动作`, { type: "success" });
    if (id) drawer.value = false;
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}

// ── 新建 / 编辑抽屉 ──
type Form = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  viewAngle: ViewAngle;
  status: PoseStatus;
  sort: number;
  keypoints: PoseKeypoints | null;
};
const drawer = ref(false);
const editing = ref<ManagedPose>();
const form = ref<Form>(emptyForm());
const hits = ref<PoseHit[]>();
const checking = ref(false);
const extracting = ref(false);
const photoInput = ref<HTMLInputElement>();
function emptyForm(): Form {
  return {
    id: "",
    name: "",
    description: "",
    tags: [],
    viewAngle: "FRONT",
    status: "DRAFT",
    sort: 0,
    keypoints: null
  };
}
function openCreate() {
  editing.value = undefined;
  form.value = emptyForm();
  hits.value = undefined;
  drawer.value = true;
}
function openEdit(row: ManagedPose) {
  editing.value = row;
  form.value = {
    id: row.id,
    name: row.name,
    description: row.description,
    tags: [...row.tags],
    viewAngle: row.viewAngle ?? "FRONT",
    status: row.status,
    sort: row.sort,
    keypoints: row.keypoints
  };
  hits.value = undefined;
  drawer.value = true;
}
const formError = computed(() => {
  const value = form.value;
  if (!editing.value && value.id && !POSE_ID.test(value.id))
    return "编号以小写字母开头，只用小写字母、数字和短横线，2–40 个字符";
  const name = value.name.trim();
  if (name.length < 1 || name.length > 12) return "名称 1–12 个字";
  const description = value.description.trim();
  if (description.length < 4 || description.length > 300)
    return "描述 4–300 个字";
  return "";
});
async function runCheck() {
  checking.value = true;
  try {
    const { data } = await checkPose({
      name: form.value.name.trim() || undefined,
      description: form.value.description.trim()
    });
    if (active) hits.value = data.hits;
    return data.hits;
  } catch (error) {
    showError(error);
  } finally {
    checking.value = false;
  }
}
async function save() {
  if (formError.value || busy.value) return;
  const value = form.value;
  const body = {
    name: value.name.trim(),
    description: value.description.trim(),
    tags: cleanTags(value.tags),
    viewAngle: value.viewAngle,
    status: value.status,
    sort: value.sort
  };
  busy.value = true;
  try {
    if (editing.value) {
      // Keypoints are a read-only preview here; editing never rewrites them.
      await editPose(editing.value.id, body);
    } else {
      await createPose({
        ...body,
        ...(value.id ? { id: value.id } : {}),
        ...(value.keypoints ? { keypoints: value.keypoints } : {})
      });
    }
    if (!active) return;
    drawer.value = false;
    message("已保存", { type: "success" });
    await refresh();
  } catch (error) {
    const returned = responseHits(error);
    if (returned?.length) {
      hits.value = returned;
      message("描述里有不适合用来试穿的内容，请按提示修改", {
        type: "warning"
      });
    } else {
      showError(error);
      // The proxy may drop the hits; a 4xx on save is most often the sensitive check.
      const code = status(error);
      if (code === 400 || code === 422) await runCheck();
    }
  } finally {
    busy.value = false;
  }
}
function pickPhoto() {
  photoInput.value?.click();
}
async function choosePhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    message("请选择 PNG、JPEG 或 WebP 图片", { type: "warning" });
    return;
  }
  if (!file.size || file.size > maxPhotoBytes) {
    message("图片不能为空，且不能超过 8 MB", { type: "warning" });
    return;
  }
  extracting.value = true;
  try {
    const { data } = await extractPose(file);
    if (!active) return;
    const draft = data.draft;
    if (!drawer.value || editing.value) openCreate();
    form.value = {
      ...form.value,
      name: draft.name ?? "",
      description: draft.description ?? "",
      tags: cleanTags(draft.tags ?? []),
      viewAngle: draft.viewAngle ?? "FRONT",
      keypoints: draft.keypoints ?? null
    };
    hits.value = undefined;
    message("已填入提取结果，确认后再保存", { type: "success" });
  } catch (error) {
    if (status(error) === 429)
      message("今天的提取次数已用完，明天再试", { type: "warning" });
    else showError(error);
  } finally {
    extracting.value = false;
  }
}

function status(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}
function responseHits(error: unknown) {
  const data = (error as { response?: { data?: { hits?: unknown } } })?.response
    ?.data;
  return Array.isArray(data?.hits) ? (data.hits as PoseHit[]) : undefined;
}
function showError(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })
    ?.response;
  message(response?.data?.message || "操作失败，请重试", { type: "error" });
}

onMounted(() => {
  void loadSettings();
  void refresh();
});
onBeforeUnmount(() => {
  active = false;
});
</script>

<template>
  <main class="pose-page">
    <ClosetUnavailable
      v-if="settingsRequest.unavailable.value || listRequest.unavailable.value"
    />
    <template v-else>
      <el-card shadow="never" class="check-card">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <strong>敏感检查</strong>
            <span class="muted">
              只影响之后的新建和修改，不会回头删除已有动作
              <template v-if="settings">
                · 版本 {{ settings.revision }} ·
                {{ formatTime(settings.updatedAtMs) }}</template
              >
            </span>
          </div>
        </template>
        <el-alert
          v-if="settingsRequest.errorMessage.value"
          :title="settingsRequest.errorMessage.value"
          type="error"
          :closable="false"
        />
        <div
          v-if="draftSettings"
          v-loading="settingsRequest.loading.value"
          class="check-columns"
        >
          <section v-for="(sideLabel, side) in SIDES" :key="side">
            <h4>{{ sideLabel }}</h4>
            <p class="muted">
              {{
                side === "user"
                  ? "用户自建动作、照片提取和改名"
                  : "管理员新增、修改预设和照片提取"
              }}
            </p>
            <div
              v-for="(kindLabel, kind) in CHECK_KINDS"
              :key="kind"
              class="check-row"
            >
              <span>{{ kindLabel }}</span>
              <el-switch
                v-model="draftSettings[side][kind]"
                :disabled="!canWrite || savingSettings"
                :aria-label="`${sideLabel}${kindLabel}检查`"
              />
            </div>
          </section>
        </div>
        <div v-if="canWrite && draftSettings" class="actions">
          <el-button
            type="primary"
            :disabled="!settingChanges.length"
            :loading="savingSettings"
            @click="saveSettings"
            >保存{{
              settingChanges.length ? `（${settingChanges.length} 项改动）` : ""
            }}</el-button
          >
          <el-button
            :disabled="!settingChanges.length || savingSettings"
            @click="settings && applySettings(settings)"
            >撤销改动</el-button
          >
        </div>
      </el-card>

      <el-form inline class="filters" @submit.prevent="refresh">
        <el-form-item label="状态">
          <el-select
            v-model="filterStatus"
            clearable
            placeholder="全部状态"
            @change="refresh"
          >
            <el-option
              v-for="(label, value) in statuses"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input
            v-model="query"
            clearable
            placeholder="名称或描述"
            @clear="refresh"
          />
        </el-form-item>
        <el-button native-type="submit">搜索</el-button>
      </el-form>
      <div v-if="canWrite" class="actions">
        <el-button type="primary" @click="openCreate">新建动作</el-button>
        <el-button :loading="extracting" @click="pickPhoto"
          >从照片提取</el-button
        >
        <span class="muted">已选 {{ selection.length }} 个</span>
        <el-button
          v-for="(label, value) in actions"
          :key="value"
          :disabled="busy || !selection.length"
          @click="change(value)"
          >{{ label }}</el-button
        >
      </div>
      <el-alert
        v-if="listRequest.errorMessage.value"
        :title="listRequest.errorMessage.value"
        type="error"
        :closable="false"
      />
      <el-table
        v-loading="listRequest.loading.value"
        :data="rows"
        row-key="id"
        border
        empty-text="暂无符合条件的动作"
        @selection-change="(value: ManagedPose[]) => (selection = value)"
      >
        <el-table-column v-if="canWrite" type="selection" width="44" />
        <el-table-column label="名称" min-width="130">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">{{
              row.name
            }}</el-button>
            <div class="muted mono">{{ row.id }}</div>
          </template>
        </el-table-column>
        <el-table-column
          prop="description"
          label="描述"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column label="标签" min-width="140">
          <template #default="{ row }">
            <el-tag
              v-for="tag in row.tags"
              :key="tag"
              size="small"
              class="tag"
              >{{ tag }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column label="视角" width="110">
          <template #default="{ row }">{{
            row.viewAngle ? angles[row.viewAngle as ViewAngle] : "—"
          }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="statusTypes[row.status as PoseStatus]"
              >{{ statuses[row.status as PoseStatus] }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="70" align="center" />
        <el-table-column label="来源" width="70">
          <template #default="{ row }">{{
            sources[row.source as keyof typeof sources] ?? row.source
          }}</template>
        </el-table-column>
        <el-table-column label="关节点" width="80" align="center">
          <template #default="{ row }">{{
            row.keypoints && Object.keys(row.keypoints).length ? "有" : "—"
          }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{
            formatTime(row.updatedAtMs)
          }}</template>
        </el-table-column>
      </el-table>
      <p v-if="total > rows.length" class="muted">
        共 {{ total }} 个，只显示前 {{ rows.length }} 个，请用筛选缩小范围
      </p>
    </template>

    <input
      ref="photoInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      @change="choosePhoto"
    />
    <el-drawer
      v-model="drawer"
      :title="editing ? '编辑动作' : '新建动作'"
      size="min(100%, 560px)"
    >
      <el-form
        label-position="top"
        :disabled="!canWrite"
        @submit.prevent="save"
      >
        <el-form-item label="编号">
          <el-input
            v-if="!editing"
            v-model="form.id"
            maxlength="40"
            placeholder="不填时自动生成"
          />
          <span v-else class="mono">{{ form.id }}</span>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" maxlength="12" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            maxlength="300"
            show-word-limit
            placeholder="写清身体朝向、重心、手臂和腿的位置，以及构图"
          />
        </el-form-item>
        <div class="check-line">
          <el-button
            :loading="checking"
            :disabled="form.description.trim().length < 1"
            @click="runCheck"
            >检查一下</el-button
          >
          <span class="muted">只做文字检查，不受开关影响</span>
        </div>
        <template v-if="hits">
          <el-alert
            v-if="!hits.length"
            title="没有命中敏感词"
            type="success"
            :closable="false"
            class="hit"
          />
          <el-alert
            v-for="(hit, index) in hits"
            :key="`${hit.kind}-${hit.term}-${index}`"
            :title="`${HIT_KINDS[hit.kind] ?? hit.kind}：${hit.term}`"
            :description="hit.reason"
            type="warning"
            :closable="false"
            class="hit"
          />
        </template>
        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            :multiple-limit="8"
            placeholder="输入后回车"
          />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="视角">
            <el-select v-model="form.viewAngle">
              <el-option
                v-for="(label, value) in angles"
                :key="value"
                :label="label"
                :value="value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status">
              <el-option
                v-for="(label, value) in statuses"
                :key="value"
                :label="label"
                :value="value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="form.sort" :precision="0" />
          </el-form-item>
        </div>
        <el-form-item label="关节点（只读预览）">
          <PoseSkeleton :keypoints="form.keypoints" />
        </el-form-item>
        <el-alert
          v-if="formError"
          :title="formError"
          type="info"
          :closable="false"
          class="hit"
        />
        <div v-if="canWrite" class="actions">
          <el-button
            type="primary"
            native-type="submit"
            :disabled="!!formError"
            :loading="busy"
            >保存</el-button
          >
          <el-button v-if="!editing" :loading="extracting" @click="pickPhoto"
            >从照片提取</el-button
          >
          <el-button
            v-if="editing"
            type="danger"
            plain
            :disabled="busy"
            @click="change('REMOVE', editing.id)"
            >移除</el-button
          >
        </div>
      </el-form>
    </el-drawer>
  </main>
</template>

<style scoped>
.pose-page {
  padding: 16px;
}

.muted {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.mono {
  font-family: var(--el-font-family-mono, monospace);
  font-size: 12px;
}

.check-card {
  margin-bottom: 16px;
}

.check-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.check-columns h4 {
  margin: 0 0 4px;
}

.check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 280px;
  padding-block: 6px;
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

.filters :deep(.el-select) {
  min-width: 130px;
}

.tag {
  margin: 2px 4px 2px 0;
}

.check-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.hit {
  margin-bottom: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 12px;
}

@media (width <= 640px) {
  .check-columns,
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

:global(.change-list) {
  padding-left: 18px;
  margin: 8px 0 0;
}
</style>
