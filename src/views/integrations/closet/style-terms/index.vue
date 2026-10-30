<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  approveClosetStyleTerm,
  batchReviewClosetStyleTerms,
  getClosetPendingStyleTerms,
  rejectClosetStyleTerm,
  type PendingStyleTerm
} from "@/api/closet/management";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { useClosetRequest, formatTime } from "../useClosetRequest";
import { message } from "@/utils/message";
defineOptions({ name: "ClosetStyleTerms" });
const { can } = useCurrentPermissions();
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const writable = computed(() => can("closet:styleterms:write"));
const rows = ref<PendingStyleTerm[]>([]);
const vocabulary = ref<string[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const selection = ref<PendingStyleTerm[]>([]);
const saving = ref(false);
const query = ref("");
const editing = ref<PendingStyleTerm>();
const styles = ref<string[]>([]);
const visibleRows = computed(() =>
  rows.value.filter(
    row => !query.value || row.term.includes(query.value.trim())
  )
);
const keyOf = (row: PendingStyleTerm) => `${row.term}|${row.styles.join(",")}`;
const target = (row: PendingStyleTerm) => ({
  term: row.term,
  proposedStyles: row.styles
});
const load = () =>
  run(
    () =>
      getClosetPendingStyleTerms({ page: page.value - 1, size: size.value }),
    ({ data }) => {
      rows.value = data.items;
      vocabulary.value = data.vocabulary;
      total.value = data.totalElements;
      selection.value = [];
    }
  );
const changePage = (value: number) => {
  page.value = value;
  void load();
};
const changeSize = (value: number) => {
  size.value = value;
  page.value = 1;
  void load();
};
const failed = (error: unknown, fallback: string) => {
  if (isClosetServiceUnavailable(error)) unavailable.value = true;
  else if (
    (error as { response?: { status?: number } })?.response?.status === 404
  ) {
    message("该风格词已被审核，列表已刷新", { type: "warning" });
    void load();
  } else message(fallback, { type: "error" });
};
const confirm = async (title: string, text: string, button: string) => {
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
};
const approve = async (row: PendingStyleTerm, corrected?: string[]) => {
  if (!writable.value || saving.value) return;
  const mapping = corrected?.length ? corrected : row.styles;
  const replace = row.sharedStyles?.length
    ? `全站词表里已有“${row.sharedStyles.join("、")}”，批准会替换它。`
    : "";
  if (
    !(await confirm(
      "批准风格词",
      `将“${row.term}”映射为“${mapping.join("、")}”并对全站生效？${replace}`,
      "批准"
    ))
  )
    return;
  saving.value = true;
  try {
    await approveClosetStyleTerm({
      ...target(row),
      ...(corrected?.length ? { styles: corrected } : {})
    });
    message(`“${row.term}”已批准，对全站生效`, { type: "success" });
    editing.value = undefined;
    await load();
  } catch (error) {
    failed(error, "批准失败，请刷新后重试");
  } finally {
    saving.value = false;
  }
};
const reject = async (row: PendingStyleTerm) => {
  if (!writable.value || saving.value) return;
  if (
    !(await confirm(
      "驳回风格词",
      `驳回“${row.term}”？驳回后它不进入全站词表，对提出的用户也不再生效。`,
      "驳回"
    ))
  )
    return;
  saving.value = true;
  try {
    await rejectClosetStyleTerm(target(row));
    message(`“${row.term}”已驳回`, { type: "success" });
    await load();
  } catch (error) {
    failed(error, "驳回失败，请刷新后重试");
  } finally {
    saving.value = false;
  }
};
const batch = async (action: "APPROVE" | "REJECT") => {
  if (!writable.value || saving.value || !selection.value.length) return;
  const approve = action === "APPROVE";
  const count = selection.value.length;
  if (
    !(await confirm(
      approve ? "批量批准" : "批量驳回",
      approve
        ? `批准选中的 ${count} 个风格词？按助手给出的映射对全站生效；要改映射请单个批准。`
        : `驳回选中的 ${count} 个风格词？驳回后对提出的用户也不再生效。`,
      approve ? "批准" : "驳回"
    ))
  )
    return;
  saving.value = true;
  try {
    const { data } = await batchReviewClosetStyleTerms({
      action,
      items: selection.value.map(target)
    });
    message(
      data.failed
        ? `${data.succeeded} 个已处理，${data.failed} 个失败（可能已被审核），列表已刷新`
        : `${data.succeeded} 个风格词已${approve ? "批准" : "驳回"}`,
      { type: data.failed ? "warning" : "success" }
    );
    await load();
  } catch (error) {
    failed(error, "批量处理失败，请刷新后重试");
  } finally {
    saving.value = false;
  }
};
const edit = (row: PendingStyleTerm) => {
  editing.value = row;
  styles.value = [...row.styles];
};
const mappingChanged = computed(
  () =>
    !!editing.value &&
    styles.value.length > 0 &&
    styles.value.join(",") !== editing.value.styles.join(",")
);
onMounted(() => void load());
</script>
<template>
  <div class="page-root space-y-4">
    <ClosetUnavailable v-if="unavailable" :loading="loading" @retry="load" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      ><el-button link @click="load">重试</el-button></el-alert
    >
    <el-card v-else shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <div class="mr-auto">
            <h2 class="text-base font-semibold">风格词审核</h2>
            <p class="text-xs text-[var(--el-text-color-secondary)]">
              助手从用户对话学到的风格词，批准后才对所有人生效；批准前只对提出者本人有效，驳回后对提出者也不再生效。共
              {{ total }} 项待审核。
            </p>
          </div>
          <el-input
            v-model="query"
            class="!w-52"
            placeholder="筛选本页的词"
            clearable
          />
          <template v-if="writable">
            <el-button
              type="primary"
              :disabled="!selection.length || saving"
              @click="batch('APPROVE')"
              >批量批准{{
                selection.length ? `（${selection.length}）` : ""
              }}</el-button
            >
            <el-button
              type="danger"
              plain
              :disabled="!selection.length || saving"
              @click="batch('REJECT')"
              >批量驳回{{
                selection.length ? `（${selection.length}）` : ""
              }}</el-button
            >
          </template>
          <el-button :loading="loading" :disabled="saving" @click="load"
            >刷新</el-button
          >
        </div>
      </template>
      <el-table
        v-loading="loading"
        :data="visibleRows"
        :row-key="keyOf"
        empty-text="没有待审核的风格词"
        @selection-change="selection = $event"
      >
        <el-table-column
          v-if="writable"
          type="selection"
          width="48"
          :reserve-selection="false"
        />
        <el-table-column prop="term" label="风格词" min-width="120">
          <template #default="{ row }"
            ><span class="font-medium">{{ row.term }}</span>
            <el-tag
              v-if="row.legacy"
              class="ml-2"
              size="small"
              type="warning"
              effect="plain"
              >迁移遗留</el-tag
            ></template
          >
        </el-table-column>
        <el-table-column label="映射到的风格" min-width="170">
          <template #default="{ row }">
            <el-tag
              v-for="style in row.styles"
              :key="style"
              class="mr-1"
              type="primary"
              effect="plain"
              >{{ style }}</el-tag
            >
            <div
              v-if="row.sharedStyles?.length"
              class="mt-1 text-xs text-[var(--el-color-warning)]"
            >
              全站已有：{{ row.sharedStyles.join("、") }}（批准将替换）
            </div>
          </template>
        </el-table-column>
        <el-table-column label="提出次数" width="110" align="right">
          <template #default="{ row }"
            ><span class="tabular-nums">{{ row.hits }}</span>
            <div class="text-xs text-[var(--el-text-color-secondary)]">
              {{ row.proposers ? `${row.proposers} 位用户` : "无归属" }}
            </div></template
          >
        </el-table-column>
        <el-table-column label="首次提出" min-width="150">
          <template #default="{ row }">{{
            formatTime(row.firstProposedAtMs)
          }}</template>
        </el-table-column>
        <el-table-column label="最近提出" min-width="150">
          <template #default="{ row }">{{
            formatTime(row.lastProposedAtMs)
          }}</template>
        </el-table-column>
        <el-table-column v-if="writable" label="操作" fixed="right" width="190">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="saving"
              @click="approve(row)"
              >批准</el-button
            >
            <el-button link :disabled="saving" @click="edit(row)"
              >改映射</el-button
            >
            <el-button
              link
              type="danger"
              :disabled="saving"
              @click="reject(row)"
              >驳回</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > size" class="mt-4 flex justify-end">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :current-page="page"
          :page-size="size"
          :page-sizes="[20, 50, 100]"
          :disabled="loading || saving"
          @current-change="changePage"
          @size-change="changeSize"
        />
      </div>
    </el-card>
    <el-dialog
      :model-value="!!editing"
      :title="`修改“${editing?.term ?? ''}”的映射`"
      width="min(480px, 94vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      @close="!saving && (editing = undefined)"
    >
      <p class="mb-3 text-sm text-[var(--el-text-color-secondary)]">
        助手给出的映射是“{{
          editing?.styles.join("、")
        }}”。可改为标准风格中的至多 2 个，批准后对全站生效。
      </p>
      <el-select
        v-model="styles"
        class="w-full"
        multiple
        :multiple-limit="2"
        placeholder="选择标准风格"
        :disabled="saving"
      >
        <el-option
          v-for="style in vocabulary"
          :key="style"
          :label="style"
          :value="style"
        />
      </el-select>
      <template #footer>
        <el-button :disabled="saving" @click="editing = undefined"
          >取消</el-button
        >
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!styles.length"
          @click="
            editing && approve(editing, mappingChanged ? styles : undefined)
          "
          >批准{{ mappingChanged ? "修改后的映射" : "" }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>
