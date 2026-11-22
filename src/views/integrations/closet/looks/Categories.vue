<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  createLookCategory,
  editLookCategory,
  getLookCategories,
  removeLookCategory,
  type LookCategory
} from "@/api/closet/looks";
import { message } from "@/utils/message";
import { useClosetRequest } from "../useClosetRequest";
import { categoryProblem } from "./lookLogic";

const props = defineProps<{ canWrite: boolean }>();
const emit = defineEmits<{ change: [items: LookCategory[]] }>();

type Row = LookCategory & { draftName: string; draftSort: number };
const request = useClosetRequest();
const rows = ref<Row[]>([]);
const busy = ref<string>();
const dialog = ref(false);
const form = ref({ key: "", name: "", sort: 0 });
const formError = computed(() =>
  categoryProblem(form.value.key, form.value.name)
);
let active = true;
onBeforeUnmount(() => {
  active = false;
});

function refresh() {
  return request.run(getLookCategories, ({ data }) => {
    rows.value = data.items.map(item => ({
      ...item,
      draftName: item.name,
      draftSort: item.sort
    }));
    emit("change", data.items);
  });
}
const dirty = (row: Row) =>
  row.draftName.trim() !== row.name || row.draftSort !== row.sort;
function showError(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })
    ?.response;
  message(response?.data?.message || "操作失败，请重试", { type: "error" });
}
async function saveRow(row: Row) {
  const problem = categoryProblem(null, row.draftName);
  if (problem) {
    message(problem, { type: "warning" });
    return;
  }
  busy.value = row.key;
  try {
    await editLookCategory(row.key, {
      name: row.draftName.trim(),
      sort: row.draftSort
    });
    if (!active) return;
    message("已保存分类", { type: "success" });
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = undefined;
  }
}
async function toggle(row: Row, enabled: boolean) {
  if (!enabled && row.listedCount > 0) {
    try {
      await ElMessageBox.confirm(
        `停用后，「${row.name}」和其中 ${row.listedCount} 套已上架的整套在用户端都不再出现。`,
        "停用分类",
        { type: "warning", confirmButtonText: "停用", cancelButtonText: "取消" }
      );
    } catch {
      return;
    }
  }
  busy.value = row.key;
  try {
    await editLookCategory(row.key, { enabled });
    if (!active) return;
    message(enabled ? "已启用分类" : "已停用分类", { type: "success" });
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = undefined;
  }
}
async function remove(row: Row) {
  try {
    await ElMessageBox.confirm(`删除分类「${row.name}」？`, "删除分类", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  busy.value = row.key;
  try {
    await removeLookCategory(row.key);
    if (!active) return;
    message("已删除分类", { type: "success" });
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = undefined;
  }
}
function openCreate() {
  const top = rows.value.reduce((max, row) => Math.max(max, row.sort), 0);
  form.value = { key: "", name: "", sort: top + 10 };
  dialog.value = true;
}
async function create() {
  if (formError.value) return;
  busy.value = "__create";
  try {
    await createLookCategory({
      key: form.value.key,
      name: form.value.name.trim(),
      sort: form.value.sort
    });
    if (!active) return;
    dialog.value = false;
    message("已新增分类，默认停用，确认后再启用", { type: "success" });
    await refresh();
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    if (status === 409) message("这个标识已经存在", { type: "error" });
    else showError(error);
  } finally {
    busy.value = undefined;
  }
}
onMounted(refresh);
defineExpose({ refresh });
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <strong>分类</strong>
        <div class="header-actions">
          <span class="muted">停用的分类和其中的整套在用户端完全不出现</span>
          <el-button v-if="props.canWrite" @click="openCreate"
            >新增分类</el-button
          >
        </div>
      </div>
    </template>
    <el-alert
      v-if="request.errorMessage.value"
      :title="request.errorMessage.value"
      type="error"
      :closable="false"
    />
    <el-table
      v-loading="request.loading.value"
      :data="rows"
      row-key="key"
      border
      size="small"
      empty-text="还没有分类"
    >
      <el-table-column prop="key" label="标识" width="120" />
      <el-table-column label="名称" min-width="140">
        <template #default="{ row }">
          <el-input
            v-model="row.draftName"
            maxlength="8"
            size="small"
            :disabled="!props.canWrite"
            :aria-label="`${row.key} 的名称`"
          />
        </template>
      </el-table-column>
      <el-table-column label="排序" width="150">
        <template #default="{ row }">
          <el-input-number
            v-model="row.draftSort"
            :precision="0"
            size="small"
            controls-position="right"
            :disabled="!props.canWrite"
            :aria-label="`${row.key} 的排序`"
          />
        </template>
      </el-table-column>
      <el-table-column label="启用" width="80" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.enabled"
            :disabled="!props.canWrite || !!busy"
            :aria-label="`启用 ${row.name}`"
            @change="(value: string | number | boolean) => toggle(row, !!value)"
          />
        </template>
      </el-table-column>
      <el-table-column label="整套 / 已上架" width="120" align="center">
        <template #default="{ row }"
          >{{ row.lookCount }} / {{ row.listedCount }}</template
        >
      </el-table-column>
      <el-table-column v-if="props.canWrite" label="操作" width="150">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :disabled="!dirty(row) || !!busy"
            :loading="busy === row.key"
            @click="saveRow(row)"
            >保存</el-button
          >
          <el-tooltip
            :disabled="row.lookCount === 0"
            content="分类下还有整套，先移走或移除"
          >
            <span>
              <el-button
                link
                type="danger"
                :disabled="row.lookCount > 0 || !!busy"
                @click="remove(row)"
                >删除</el-button
              >
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" title="新增分类" width="min(94%, 420px)">
      <el-form label-position="top" @submit.prevent="create">
        <el-form-item label="标识（创建后不能改）">
          <el-input
            v-model="form.key"
            maxlength="24"
            placeholder="例如 outdoor"
          />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" maxlength="8" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :precision="0" />
        </el-form-item>
        <p class="muted">新分类默认停用，放好整套并验证后再启用。</p>
        <el-alert
          v-if="formError && (form.key || form.name)"
          :title="formError"
          type="info"
          :closable="false"
        />
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!!formError"
          :loading="busy === '__create'"
          @click="create"
          >新增</el-button
        >
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.muted {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
</style>
