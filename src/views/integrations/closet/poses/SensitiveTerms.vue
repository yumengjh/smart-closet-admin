<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  createPoseTerm,
  editPoseTerm,
  getPoseTerms,
  removePoseTerm,
  type PoseHitKind,
  type PoseSensitiveTerm
} from "@/api/closet/poses";
import { message } from "@/utils/message";
import { formatTime, useClosetRequest } from "../useClosetRequest";
import { HIT_KINDS, REASON_MAX, TERM_MAX, termProblem } from "./poseLogic";

defineOptions({ name: "ClosetPoseSensitiveTerms" });
const props = defineProps<{ canWrite: boolean }>();

const kindTypes: Record<PoseHitKind, "danger" | "warning" | "info"> = {
  SUGGESTIVE: "warning",
  NUDITY: "danger",
  MINOR: "info"
};
const sources = { SEED: "初始", ADMIN: "后台添加" };
const enabledOptions = { true: "已启用", false: "已停用" } as const;

const request = useClosetRequest();
let active = true;

// ── 列表 ──
const filterKind = ref<PoseHitKind>();
const filterEnabled = ref<keyof typeof enabledOptions>();
const query = ref("");
const rows = ref<PoseSensitiveTerm[]>([]);
const total = ref(0);
const toggling = ref<string>();
function refresh() {
  return request.run(
    () =>
      getPoseTerms({
        kind: filterKind.value || undefined,
        enabled:
          filterEnabled.value === undefined
            ? undefined
            : filterEnabled.value === "true",
        q: query.value.trim() || undefined
      }),
    ({ data }) => {
      rows.value = data.items;
      total.value = data.total;
    }
  );
}
async function toggle(row: PoseSensitiveTerm, enabled: boolean) {
  if (toggling.value) return;
  toggling.value = row.id;
  try {
    const { data } = await editPoseTerm(row.id, { enabled });
    if (!active) return;
    Object.assign(row, data);
    message(enabled ? `已启用“${row.term}”` : `已停用“${row.term}”`, {
      type: "success"
    });
  } catch (error) {
    showError(error);
  } finally {
    toggling.value = undefined;
  }
}
async function remove(row: PoseSensitiveTerm) {
  try {
    await ElMessageBox.confirm(
      `删除“${row.term}”后立即生效，之后的新建和修改不再检查这个词，删除不能撤销。${
        row.source === "SEED"
          ? "这是初始词，删除后不会自动恢复；只想暂时不用，可以关掉启用开关。"
          : ""
      }`,
      "删除敏感词",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  try {
    await removePoseTerm(row.id);
    if (!active) return;
    message("已删除", { type: "success" });
    await refresh();
  } catch (error) {
    if (status(error) === 404) {
      message("这个词已经不在了，已刷新列表", { type: "warning" });
      await refresh();
    } else showError(error);
  }
}

// ── 新增 / 编辑 ──
type Form = { term: string; kind: PoseHitKind | ""; reason: string };
const dialog = ref(false);
const editing = ref<PoseSensitiveTerm>();
const form = ref<Form>({ term: "", kind: "", reason: "" });
const saving = ref(false);
const problem = computed(() => termProblem(form.value));
function openCreate() {
  editing.value = undefined;
  form.value = { term: "", kind: filterKind.value ?? "", reason: "" };
  dialog.value = true;
}
function openEdit(row: PoseSensitiveTerm) {
  editing.value = row;
  form.value = { term: row.term, kind: row.kind, reason: row.reason };
  dialog.value = true;
}
async function save() {
  if (problem.value || saving.value || !form.value.kind) return;
  const body = {
    term: form.value.term.trim(),
    kind: form.value.kind,
    reason: form.value.reason.trim()
  };
  saving.value = true;
  try {
    if (editing.value) await editPoseTerm(editing.value.id, body);
    else await createPoseTerm(body);
    if (!active) return;
    dialog.value = false;
    message("已保存，立即生效", { type: "success" });
    await refresh();
  } catch (error) {
    if (status(error) === 409)
      message("同类型里已经有这个词了（大小写、空格和全角半角视为相同）", {
        type: "warning"
      });
    else showError(error);
  } finally {
    saving.value = false;
  }
}

function status(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}
function showError(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })
    ?.response;
  message(response?.data?.message || "操作失败，请重试", { type: "error" });
}

onMounted(() => void refresh());
onBeforeUnmount(() => {
  active = false;
});
</script>

<template>
  <section class="terms">
    <p class="muted">
      新建、修改动作时按这张词表做文字检查（只查上面已开启的类型）。匹配时不区分大小写，忽略空格，全角半角视为相同。增、改、停用、删除都立即生效，不会回头处理已有动作。
    </p>
    <el-form inline class="filters" @submit.prevent="refresh">
      <el-form-item label="类型">
        <el-select
          v-model="filterKind"
          clearable
          placeholder="全部类型"
          @change="refresh"
        >
          <el-option
            v-for="(label, value) in HIT_KINDS"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="启用">
        <el-select
          v-model="filterEnabled"
          clearable
          placeholder="全部"
          @change="refresh"
        >
          <el-option
            v-for="(label, value) in enabledOptions"
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
          placeholder="词或理由"
          @clear="refresh"
        />
      </el-form-item>
      <el-button native-type="submit">搜索</el-button>
    </el-form>
    <div v-if="props.canWrite" class="actions">
      <el-button type="primary" @click="openCreate">新增敏感词</el-button>
    </div>
    <el-alert
      v-if="request.errorMessage.value"
      :title="request.errorMessage.value"
      type="error"
      :closable="false"
    />
    <el-table
      v-loading="request.loading.value"
      :data="rows"
      row-key="id"
      border
      empty-text="暂无符合条件的敏感词"
    >
      <el-table-column prop="term" label="词" min-width="120" />
      <el-table-column label="类型" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="kindTypes[row.kind as PoseHitKind]">{{
            HIT_KINDS[row.kind as PoseHitKind] ?? row.kind
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="reason"
        label="理由"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="来源" width="90">
        <template #default="{ row }">{{
          sources[row.source as keyof typeof sources] ?? row.source
        }}</template>
      </el-table-column>
      <el-table-column label="启用" width="80" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.enabled"
            :disabled="!props.canWrite || !!toggling"
            :loading="toggling === row.id"
            :aria-label="`启用“${row.term}”`"
            @change="
              (value: string | number | boolean) => toggle(row, value === true)
            "
          />
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">{{
          formatTime(row.updatedAtMs)
        }}</template>
      </el-table-column>
      <el-table-column v-if="props.canWrite" label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <p v-if="total > rows.length" class="muted">
      共 {{ total }} 个，只显示前 {{ rows.length }} 个，请用筛选缩小范围
    </p>

    <el-dialog
      v-model="dialog"
      :title="editing ? '编辑敏感词' : '新增敏感词'"
      width="min(100%, 480px)"
    >
      <el-form label-position="top" @submit.prevent="save">
        <el-form-item label="词" required>
          <el-input
            v-model="form.term"
            :maxlength="TERM_MAX"
            show-word-limit
            placeholder="例如：撩裙"
          />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="form.kind" placeholder="请选择类型">
            <el-option
              v-for="(label, value) in HIT_KINDS"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="理由" required>
          <el-input
            v-model="form.reason"
            :maxlength="REASON_MAX"
            show-word-limit
            placeholder="为什么这个词不适合用来试穿，命中时会展示给管理员"
          />
        </el-form-item>
        <el-alert
          v-if="problem"
          :title="problem"
          type="info"
          :closable="false"
        />
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!!problem"
          :loading="saving"
          @click="save"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.muted {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-block: 12px;
}

.filters :deep(.el-select) {
  min-width: 130px;
}
</style>
