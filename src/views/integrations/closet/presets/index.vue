<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  batchPresets,
  closePresetSource,
  editPreset,
  getPresetCoverage,
  getPresetImage,
  getPresets,
  getPresetSourceImage,
  getPresetSources,
  importPresetSources,
  openPresetSource,
  removePreset,
  type ManagedPreset,
  type PresetAction,
  type PresetCoverage,
  type PresetEdit,
  type PresetGroup,
  type PresetSession,
  type PresetSource,
  type PresetStatus
} from "@/api/closet/presets";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import PresetImage from "../PresetImage.vue";
import { useClosetRequest } from "../useClosetRequest";

defineOptions({ name: "ClosetPresets" });

const statuses = {
  DRAFT: "草稿",
  LISTED: "已上架",
  UNLISTED: "已下架",
  REMOVED: "已移除"
};
const groups: Record<PresetGroup, string> = {
  top: "上装",
  bottom: "下装",
  outer: "外套",
  "one-piece": "连体",
  shoes: "鞋",
  accessory: "配件"
};
const genders = ["女款", "男款", "中性", "未标注"];
const seasons = ["春", "夏", "秋", "冬"];
const actions = { LIST: "批量上架", UNLIST: "批量下架", REMOVE: "批量移除" };
const removeText =
  "移除后不会再出现在常见单品和试生成里，已经加入用户衣柜的副本不受影响。";
const size = 48;
const idleMs = 15 * 60 * 1000;
const maxMs = 2 * 60 * 60 * 1000;
const { can } = useCurrentPermissions();
const canWrite = computed(() => can("closet:presets:write"));
const libraryRequest = useClosetRequest();
const sourceRequest = useClosetRequest();
const coverageRequest = useClosetRequest();

const tab = ref("library");
const status = ref<PresetStatus>();
const group = ref<PresetGroup>();
const gender = ref<string>();
const query = ref("");
const libraryPage = ref(1);
const libraryTotal = ref(0);
const library = ref<ManagedPreset[]>([]);
const librarySelection = ref<string[]>([]);
const selected = ref<ManagedPreset>();
const drawer = ref(false);
const edit = ref<PresetEdit>();
const busy = ref(false);

const username = ref("");
const password = ref("");
const sourceError = ref("");
const session = ref<PresetSession>();
const hardExpiry = ref(0);
const now = ref(Date.now());
const sourceGroup = ref<PresetGroup>();
const sourceQuery = ref("");
const sourcePage = ref(1);
const sourceTotal = ref(0);
const sourceRows = ref<PresetSource[]>([]);
const sourceSelection = ref<string[]>([]);
let timer: ReturnType<typeof setInterval>;
let sessionGeneration = 0;
const minutes = computed(() =>
  Math.max(
    0,
    Math.ceil(((session.value?.expiresAtMs ?? 0) - now.value) / 60000)
  )
);
const coverage = ref<PresetCoverage[]>([]);
const styles = computed(() => [
  ...new Set(coverage.value.map(row => row.style))
]);
const coverageRows = computed(() => {
  const rows = new Map<
    string,
    { gender: string; group: string; cells: Map<string, number> }
  >();
  for (const cell of coverage.value) {
    const id = `${cell.gender}-${cell.role}`;
    if (!rows.has(id))
      rows.set(id, {
        gender: cell.gender,
        group: groups[cell.role],
        cells: new Map()
      });
    rows.get(id)?.cells.set(cell.style, cell.count);
  }
  return [...rows.values()];
});

async function errorCode(error: unknown) {
  const data = (error as { response?: { data?: { code?: string } | Blob } })
    .response?.data;
  if (data instanceof Blob) {
    if (!data.type.includes("json")) return;
    return (JSON.parse(await data.text()) as { code?: string }).code;
  }
  return data?.code;
}
function showError(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })
    .response;
  message(response?.data?.message || "操作失败，请重试", { type: "error" });
}
async function confirmRemoval() {
  try {
    await ElMessageBox.confirm(removeText, "移除预设衣物", {
      type: "warning",
      confirmButtonText: "移除",
      cancelButtonText: "取消"
    });
    return true;
  } catch {
    return false;
  }
}
function libraryRefresh(reset = false) {
  if (reset) libraryPage.value = 1;
  librarySelection.value = [];
  return libraryRequest.run(
    () =>
      getPresets({
        page: libraryPage.value - 1,
        size,
        status: status.value || undefined,
        group: group.value || undefined,
        gender: gender.value || undefined,
        q: query.value.trim()
      }),
    ({ data }) => {
      library.value = data.items;
      libraryTotal.value = data.total;
      if (libraryPage.value > 1 && data.items.length === 0) {
        libraryPage.value = Math.max(1, Math.ceil(data.total / size));
        void libraryRefresh();
      }
    }
  );
}
function refreshCoverage() {
  return coverageRequest.run(getPresetCoverage, ({ data }) => {
    coverage.value = data;
  });
}
function openEdit(row: ManagedPreset) {
  selected.value = row;
  edit.value = {
    name: row.name ?? "",
    gender: row.gender,
    status: row.status,
    styles: [...row.styles],
    seasons: [...row.seasons],
    sort: row.sort
  };
  drawer.value = true;
}
async function changeLibrary(action: PresetAction, id?: string) {
  if (busy.value) return;
  const ids = id ? [id] : [...librarySelection.value];
  if (action === "REMOVE" && !(await confirmRemoval())) return;
  busy.value = true;
  try {
    const updated = id
      ? (await removePreset(id), 1)
      : (await batchPresets(ids, action)).data.updated;
    message(`已更新 ${updated} 件`, { type: "success" });
    if (id) drawer.value = false;
    await libraryRefresh();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}
async function saveEdit() {
  if (!edit.value || !selected.value) return;
  const data = { ...edit.value, name: edit.value.name?.trim() };
  if (!data.name && selected.value.name) {
    message("请输入名称", { type: "warning" });
    return;
  }
  if (!data.name) delete data.name;
  busy.value = true;
  try {
    await editPreset(selected.value.id, data);
    drawer.value = false;
    message("已保存", { type: "success" });
    await libraryRefresh();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}
function touch(id: string) {
  if (session.value?.sessionId === id)
    session.value = {
      ...session.value,
      expiresAtMs: Math.min(Date.now() + idleMs, hardExpiry.value)
    };
}
function resetSource() {
  sessionGeneration++;
  const id = session.value?.sessionId;
  session.value = undefined;
  sourceRows.value = [];
  sourceTotal.value = 0;
  sourceSelection.value = [];
  sourcePage.value = 1;
  sourceGroup.value = undefined;
  sourceQuery.value = "";
  password.value = "";
  return id;
}
async function endSource() {
  const id = resetSource();
  if (!id) return;
  try {
    await closePresetSource(id);
  } catch (error) {
    if ((await errorCode(error)) !== "CLOSET_PRESET_SOURCE_SESSION_EXPIRED")
      showError(error);
  }
}
async function expired(error: unknown, id: string) {
  const code = await errorCode(error);
  if (
    session.value?.sessionId !== id ||
    code !== "CLOSET_PRESET_SOURCE_SESSION_EXPIRED"
  )
    return false;
  resetSource();
  sourceError.value = "验证已过期，请重新输入管理账号密码";
  return true;
}
async function sourceRefresh(reset = false) {
  const id = session.value?.sessionId;
  if (!id) return;
  if (reset) sourcePage.value = 1;
  sourceSelection.value = [];
  await sourceRequest.run(
    async () => {
      try {
        const response = await getPresetSources(id, {
          page: sourcePage.value - 1,
          size,
          group: sourceGroup.value || undefined,
          q: sourceQuery.value.trim()
        });
        touch(id);
        return response.data;
      } catch (error) {
        if (await expired(error, id)) return undefined;
        throw error;
      }
    },
    data => {
      if (data && session.value?.sessionId === id) {
        sourceRows.value = data.items;
        sourceTotal.value = data.total;
      }
    }
  );
}
async function verifySource() {
  sourceError.value = "";
  busy.value = true;
  const generation = sessionGeneration;
  try {
    const { data } = await openPresetSource(
      username.value.trim(),
      password.value
    );
    if (generation !== sessionGeneration) {
      await closePresetSource(data.sessionId);
      return;
    }
    session.value = data;
    hardExpiry.value = data.expiresAtMs - idleMs + maxMs;
    await sourceRefresh(true);
  } catch (error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (generation === sessionGeneration)
      sourceError.value = response?.data?.message || "验证失败，请重试";
  } finally {
    password.value = "";
    busy.value = false;
  }
}
async function readSourceImage(garmentId: string) {
  const id = session.value!.sessionId;
  try {
    const image = await getPresetSourceImage(id, garmentId);
    touch(id);
    return image;
  } catch (error) {
    await expired(error, id);
    throw error;
  }
}
async function addSource(list: boolean) {
  const id = session.value?.sessionId;
  if (!id) return;
  busy.value = true;
  try {
    const { data } = await importPresetSources(
      id,
      [...sourceSelection.value],
      list
    );
    touch(id);
    message(`已加入 ${data.length} 件`, { type: "success" });
    await sourceRefresh();
  } catch (error) {
    if ((await expired(error, id)) || session.value?.sessionId !== id) return;
    // 超时或服务暂不可用时，服务端可能已经加完：刷新列表看衣物上的状态，而不是让人再点一次。
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    if (!status || status === 503 || status === 504) {
      message("加入可能仍在完成，已刷新列表，请看衣物上的状态", {
        type: "warning"
      });
      await sourceRefresh();
    } else showError(error);
  } finally {
    busy.value = false;
  }
}
function changeTab(value: string | number) {
  if (value === "library") void libraryRefresh();
  if (value === "coverage") void refreshCoverage();
}
onMounted(() => {
  void libraryRefresh();
  void refreshCoverage();
  timer = setInterval(() => {
    now.value = Date.now();
    if (session.value && now.value >= session.value.expiresAtMs) {
      resetSource();
      sourceError.value = "验证已过期，请重新输入管理账号密码";
    }
  }, 1000);
});
onDeactivated(() => void endSource());
onBeforeUnmount(() => {
  clearInterval(timer);
  void endSource();
});
</script>

<template>
  <main class="preset-page">
    <el-tabs v-model="tab" @tab-change="changeTab">
      <el-tab-pane label="预设库" name="library">
        <ClosetUnavailable v-if="libraryRequest.unavailable.value" />
        <template v-else>
          <el-form
            inline
            class="filters"
            @submit.prevent="libraryRefresh(true)"
          >
            <el-form-item label="状态">
              <el-select
                v-model="status"
                clearable
                placeholder="全部状态"
                @change="libraryRefresh(true)"
              >
                <el-option
                  v-for="value in ['DRAFT', 'LISTED', 'UNLISTED'] as const"
                  :key="value"
                  :label="statuses[value]"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="性别">
              <el-select
                v-model="gender"
                clearable
                placeholder="不限"
                @change="libraryRefresh(true)"
              >
                <el-option
                  v-for="value in genders"
                  :key="value"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="品类组">
              <el-select
                v-model="group"
                clearable
                placeholder="全部品类"
                @change="libraryRefresh(true)"
              >
                <el-option
                  v-for="(label, value) in groups"
                  :key="value"
                  :label="label"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="名称">
              <el-input
                v-model="query"
                clearable
                placeholder="搜索名称"
                @clear="libraryRefresh(true)"
              />
            </el-form-item>
            <el-button native-type="submit">搜索</el-button>
          </el-form>
          <div v-if="canWrite" class="actions">
            <span>已选 {{ librarySelection.length }} 件</span>
            <el-button
              v-for="(label, value) in actions"
              :key="value"
              :disabled="busy || !librarySelection.length"
              @click="changeLibrary(value)"
              >{{ label }}</el-button
            >
          </div>
          <el-alert
            v-if="libraryRequest.errorMessage.value"
            :title="libraryRequest.errorMessage.value"
            type="error"
            :closable="false"
          />
          <el-empty
            v-if="!library.length && !libraryRequest.loading.value"
            description="暂无符合条件的预设衣物"
          />
          <el-checkbox-group
            v-model="librarySelection"
            v-loading="libraryRequest.loading.value"
            class="preset-grid"
          >
            <article v-for="row in library" :key="row.id" class="preset-card">
              <el-button
                text
                class="card-link"
                :aria-label="`查看 ${row.name || '未命名衣物'}`"
                @click="openEdit(row)"
              >
                <PresetImage
                  :key="row.updatedAtMs"
                  :label="row.name || '预设衣物'"
                  :load="() => getPresetImage(row.id)"
                  :src="row.imageUrl"
                />
              </el-button>
              <div class="card-meta">
                <strong>{{ row.name || "未命名衣物" }}</strong>
                <el-tag size="small">{{ statuses[row.status] }}</el-tag>
                <span
                  >{{ row.gender }} · 已导入 {{ row.importedCount }} 次</span
                >
                <el-checkbox
                  v-if="canWrite"
                  :value="row.id"
                  :aria-label="`选择 ${row.name || '未命名衣物'}`"
                  >选择</el-checkbox
                >
              </div>
            </article>
          </el-checkbox-group>
          <el-pagination
            v-if="libraryTotal > size"
            v-model:current-page="libraryPage"
            :page-size="size"
            :total="libraryTotal"
            layout="prev, pager, next"
            @current-change="libraryRefresh()"
          />
        </template>
      </el-tab-pane>

      <el-tab-pane v-if="canWrite" label="从管理账号添加" name="source">
        <ClosetUnavailable
          v-if="
            libraryRequest.unavailable.value || sourceRequest.unavailable.value
          "
        />
        <el-form
          v-else-if="!session"
          class="verify-form"
          label-position="top"
          @submit.prevent="verifySource"
        >
          <el-form-item label="鱼搭管理账号">
            <el-input
              v-model="username"
              autocomplete="username"
              maxlength="80"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="password"
              type="password"
              autocomplete="current-password"
              show-password
            />
          </el-form-item>
          <p>只能用角色为管理员的鱼搭账号。密码只用于这次验证，不会保存。</p>
          <el-alert
            v-if="sourceError"
            :title="sourceError"
            type="error"
            :closable="false"
          />
          <el-button
            type="primary"
            native-type="submit"
            :disabled="!username.trim() || !password"
            :loading="busy"
            >验证</el-button
          >
        </el-form>
        <template v-else>
          <div class="actions">
            <span
              >当前账号 {{ session.displayName || session.username }} · 剩余
              {{ minutes }} 分钟</span
            >
            <el-button @click="endSource">换一个账号</el-button>
          </div>
          <el-form inline class="filters" @submit.prevent="sourceRefresh(true)">
            <el-form-item label="品类组">
              <el-select
                v-model="sourceGroup"
                clearable
                placeholder="全部品类"
                @change="sourceRefresh(true)"
              >
                <el-option
                  v-for="(label, value) in groups"
                  :key="value"
                  :label="label"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="名称">
              <el-input
                v-model="sourceQuery"
                clearable
                placeholder="搜索名称"
                @clear="sourceRefresh(true)"
              />
            </el-form-item>
            <el-button native-type="submit">搜索</el-button>
          </el-form>
          <el-empty
            v-if="!sourceRows.length && !sourceRequest.loading.value"
            description="暂无符合条件的已处理衣物"
          />
          <el-checkbox-group
            v-model="sourceSelection"
            v-loading="sourceRequest.loading.value"
            class="preset-grid"
          >
            <article
              v-for="row in sourceRows"
              :key="row.garmentId"
              class="preset-card"
            >
              <PresetImage
                :label="row.name || '来源衣物'"
                :load="() => readSourceImage(row.garmentId)"
                :src="row.imageUrl"
              />
              <div class="card-meta">
                <strong>{{ row.name || "未命名衣物" }}</strong>
                <el-tag v-if="row.inLibrary" size="small">{{
                  statuses[row.inLibrary]
                }}</el-tag>
                <span>{{ row.gender }}</span>
                <el-checkbox
                  :value="row.garmentId"
                  :disabled="row.inLibrary === 'LISTED'"
                  :aria-label="`选择 ${row.name || '未命名衣物'}`"
                  >选择</el-checkbox
                >
              </div>
            </article>
          </el-checkbox-group>
          <el-pagination
            v-if="sourceTotal > size"
            v-model:current-page="sourcePage"
            :page-size="size"
            :total="sourceTotal"
            layout="prev, pager, next"
            @current-change="sourceRefresh()"
          />
          <div class="actions source-actions">
            <span>已选 {{ sourceSelection.length }} 件</span>
            <el-button
              :disabled="!sourceSelection.length"
              :loading="busy"
              @click="addSource(false)"
              >加入草稿</el-button
            >
            <el-button
              type="primary"
              :disabled="!sourceSelection.length"
              :loading="busy"
              @click="addSource(true)"
              >{{ busy ? "加入中…" : "加入并上架" }}</el-button
            >
            <el-button text @click="tab = 'library'">查看预设库</el-button>
          </div>
        </template>
      </el-tab-pane>

      <el-tab-pane label="覆盖统计" name="coverage">
        <ClosetUnavailable v-if="coverageRequest.unavailable.value" />
        <el-table
          v-else
          v-loading="coverageRequest.loading.value"
          :data="coverageRows"
          border
        >
          <el-table-column prop="gender" label="性别" fixed width="100" />
          <el-table-column prop="group" label="品类组" fixed width="100" />
          <el-table-column
            v-for="style in styles"
            :key="style"
            :label="style"
            min-width="105"
            align="center"
          >
            <template #default="{ row }">
              <span :class="{ missing: row.cells.get(style) === 0 }">{{
                row.cells.get(style)
              }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="drawer" title="预设衣物" size="min(100%, 520px)">
      <template v-if="edit && selected">
        <PresetImage
          :key="selected.id"
          :label="selected.name || '预设衣物'"
          :load="() => getPresetImage(selected!.id)"
          :src="selected!.imageUrl"
        />
        <el-form
          class="edit-form"
          label-position="top"
          :disabled="!canWrite"
          @submit.prevent="saveEdit"
        >
          <el-form-item label="名称"
            ><el-input v-model="edit.name" maxlength="100"
          /></el-form-item>
          <el-form-item label="性别">
            <el-select v-model="edit.gender"
              ><el-option v-for="value in genders" :key="value" :value="value"
            /></el-select>
          </el-form-item>
          <el-form-item label="风格">
            <el-select v-model="edit.styles" multiple filterable>
              <el-option
                v-for="value in styles.filter(value => value !== '未标注')"
                :key="value"
                :value="value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="季节">
            <el-select v-model="edit.seasons" multiple
              ><el-option v-for="value in seasons" :key="value" :value="value"
            /></el-select>
          </el-form-item>
          <el-form-item label="排序"
            ><el-input-number v-model="edit.sort" :precision="0"
          /></el-form-item>
          <el-form-item label="状态">
            <el-select v-model="edit.status">
              <el-option
                v-for="value in ['DRAFT', 'LISTED', 'UNLISTED'] as const"
                :key="value"
                :label="statuses[value]"
                :value="value"
              />
            </el-select>
          </el-form-item>
          <div v-if="canWrite" class="actions">
            <el-button type="primary" native-type="submit" :loading="busy"
              >保存</el-button
            >
            <el-button
              type="danger"
              plain
              :disabled="busy"
              @click="changeLibrary('REMOVE', selected.id)"
              >从库里移除</el-button
            >
          </div>
        </el-form>
      </template>
    </el-drawer>
  </main>
</template>

<style scoped>
.preset-page {
  padding: 16px;
}

.filters :deep(.el-select),
.edit-form :deep(.el-select) {
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

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.preset-card {
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

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  padding: 10px;
}

.card-meta strong,
.card-meta > span {
  overflow-wrap: anywhere;
}

.card-meta > span {
  color: var(--el-text-color-secondary);
}

.verify-form {
  max-width: 420px;
}

.verify-form .el-alert,
.edit-form,
.el-pagination {
  margin-top: 12px;
}

.verify-form .el-button {
  margin-top: 16px;
}

.source-actions {
  position: sticky;
  bottom: 0;
  padding-block: 8px;
  background: var(--el-bg-color);
}

.missing {
  font-weight: 600;
  color: var(--el-color-danger);
}
</style>
