<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  createCreationEffect,
  deleteCreationEffect,
  getCreationPreviewImage,
  getCreationPromptSamples,
  getCreationTemplates,
  getCreationTrials,
  getCreationVersion,
  launchCreationVersion,
  reorderCreationEffects,
  retireCreationTemplate,
  type PromptSample,
  type TemplateSummary
} from "@/api/closet/creation";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import EffectEditor from "./EffectEditor.vue";
import {
  clearImageCache,
  effectState,
  errorText,
  useBlobImages
} from "./effectShared";

defineOptions({ name: "ClosetCreationTemplates" });
const { can } = useCurrentPermissions();
const canWrite = computed(() => can("closet:creation:write"));
const canPublish = computed(() => can("closet:creation:publish"));
const templates = ref<TemplateSummary[]>([]);
const loading = ref(false);
const editing = ref<string>();

// 示意图优先取线上版本，没有线上版本取草稿；取不到就用占位，不提示错误。
const key = (t: TemplateSummary) => {
  const v = effectState(t);
  const id = (v.published ?? v.draft)?.versionId;
  return id ? `${t.id}|${id}` : "";
};
const previews = useBlobImages("preview", k => {
  const [t, v] = k.split("|");
  return getCreationPreviewImage(t, v);
});

async function refresh() {
  if (!can("closet:creation:read")) return;
  loading.value = true;
  try {
    templates.value = (await getCreationTemplates()).data.items;
    templates.value.forEach(t => {
      const k = key(t);
      if (k) previews.load(k);
    });
  } catch (e) {
    message(errorText(e), { type: "error" });
  } finally {
    loading.value = false;
  }
}
function back() {
  editing.value = undefined;
  void refresh();
}

// 筛选与搜索
type Filter = "all" | "live" | "draft" | "retired";
const filter = ref<Filter>("all");
const keyword = ref("");
const kindOf = (t: TemplateSummary): Filter => {
  const label = effectState(t).label;
  if (label === "已下架") return "retired";
  return label.startsWith("已上线") ? "live" : "draft";
};
const counts = computed(() => {
  const c = { all: templates.value.length, live: 0, draft: 0, retired: 0 };
  templates.value.forEach(t => c[kindOf(t)]++);
  return c;
});
const visible = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return templates.value.filter(
    t =>
      (filter.value === "all" || kindOf(t) === filter.value) &&
      (!q || effectState(t).name.toLowerCase().includes(q))
  );
});
const infoLine = (t: TemplateSummary) => {
  const s = effectState(t);
  const v = s.published ?? s.draft ?? t.versions[0];
  if (!v) return "";
  return `${v.personRequired ? "需要人物" : "不需要人物"} · 最多 ${v.maxGarments} 件`;
};

// 排序：与当前可见的前一个或后一个交换，立即保存，失败回滚
const moving = ref(false);
async function move(id: string, d: number) {
  const vis = visible.value;
  const at = vis.findIndex(t => t.id === id);
  const other = vis[at + d];
  if (moving.value || !other) return;
  const before = templates.value;
  const next = [...before];
  const i = next.findIndex(t => t.id === id);
  const j = next.findIndex(t => t.id === other.id);
  [next[i], next[j]] = [next[j], next[i]];
  templates.value = next;
  moving.value = true;
  try {
    templates.value = (
      await reorderCreationEffects(next.map(t => t.id))
    ).data.items;
  } catch (e) {
    templates.value = before;
    message(errorText(e), { type: "error" });
  } finally {
    moving.value = false;
  }
}
async function ask(text: string, ok = "确认") {
  try {
    await ElMessageBox.confirm(text, "请确认", {
      type: "warning",
      confirmButtonText: ok,
      cancelButtonText: "取消"
    });
    return true;
  } catch {
    return false;
  }
}
async function command(t: TemplateSummary, c: string) {
  if (c === "up" || c === "down") return move(t.id, c === "up" ? -1 : 1);
  try {
    if (c === "retire") {
      if (!(await ask("下架后用户不能再选这个效果，已提交的作品不受影响。")))
        return;
      await retireCreationTemplate(t.id, t.revision);
      message("已下架", { type: "success" });
    } else if (c === "delete") {
      if (!(await ask("删除后这个效果和它的试做记录都会消失，不能恢复。")))
        return;
      await deleteCreationEffect(t.id);
      message("已删除", { type: "success" });
    }
    await refresh();
  } catch (e) {
    message(errorText(e), { type: "error" });
  }
}
const menuOf = (t: TemplateSummary) => {
  const s = effectState(t);
  return {
    sort: canWrite.value,
    retire: canPublish.value && !!s.published && t.enabled,
    del: canWrite.value && !s.everPublished
  };
};
const hasMenu = (t: TemplateSummary) => Object.values(menuOf(t)).some(Boolean);

// 新建
const dialog = ref(false);
const samples = ref<PromptSample[]>([]);
const sampleKey = ref("");
// 已经用某个示例建过的效果名，用于在“从哪里开始”里标出来（仍可再建一份）。
const usedSamples = computed(() => {
  const used = new Map<string, string[]>();
  for (const t of templates.value)
    if (t.sampleKey)
      used.set(t.sampleKey, [...(used.get(t.sampleKey) ?? []), t.name]);
  return used;
});
const newName = ref("");
const newPerson = ref(true);
const creating = ref(false);
async function openCreate() {
  sampleKey.value = "";
  newName.value = "";
  newPerson.value = true;
  dialog.value = true;
  if (!samples.value.length) {
    try {
      samples.value = (await getCreationPromptSamples()).data.items;
    } catch (e) {
      message(errorText(e), { type: "error" });
    }
  }
}
function pick(sample?: PromptSample) {
  sampleKey.value = sample?.key ?? "";
  if (sample) {
    newName.value = sample.name;
    newPerson.value = sample.personRequired;
  }
}
async function create() {
  if (creating.value) return;
  if (!newName.value.trim()) {
    message("请填写名称", { type: "warning" });
    return;
  }
  creating.value = true;
  try {
    const d = (
      await createCreationEffect({
        name: newName.value.trim(),
        personRequired: newPerson.value,
        ...(sampleKey.value ? { sampleKey: sampleKey.value } : {})
      })
    ).data;
    dialog.value = false;
    editing.value = d.id;
  } catch (e) {
    message(errorText(e), { type: "error" });
  } finally {
    creating.value = false;
  }
}

// 批量管理：前端逐个调用现有接口，串行执行
type Plan = {
  t: TemplateSummary;
  skip: string;
  run?: () => Promise<unknown>;
};
type Outcome = {
  name: string;
  status: "成功" | "跳过" | "失败";
  reason: string;
};
const selecting = ref(false);
const selected = ref<string[]>([]);
const progress = ref("");
const busy = computed(() => !!progress.value);
const report = ref<{ title: string; items: Outcome[] }>();
const canBulk = computed(() => canWrite.value || canPublish.value);
function toggleSelect(id: string) {
  const i = selected.value.indexOf(id);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(id);
}
function selectAll() {
  const ids = visible.value.map(t => t.id);
  selected.value = ids.every(id => selected.value.includes(id)) ? [] : ids;
}
function finishSelecting() {
  selecting.value = false;
  selected.value = [];
}
const chosen = () => templates.value.filter(t => selected.value.includes(t.id));

async function planLaunch(t: TemplateSummary): Promise<Plan> {
  const s = effectState(t);
  const draft = s.draft;
  if (!draft || draft.status !== "DRAFT")
    return { t, skip: "没有可上线的草稿" };
  const d = (await getCreationVersion(t.id, draft.versionId)).data;
  if (!d.previewImage && !d.previewAssetId) return { t, skip: "缺少示意图" };
  const trial = (await getCreationTrials(t.id)).data.items.find(
    x => x.current && x.status === "SUCCEEDED"
  );
  if (!trial) return { t, skip: "没有当前内容的成功试做" };
  return {
    t,
    skip: "",
    run: () =>
      launchCreationVersion(t.id, d.versionId, {
        revision: d.revision,
        trialId: trial.id
      })
  };
}
const planRetire = (t: TemplateSummary): Plan =>
  effectState(t).published && t.enabled
    ? { t, skip: "", run: () => retireCreationTemplate(t.id, t.revision) }
    : { t, skip: "不是已上线的效果" };
const planDelete = (t: TemplateSummary): Plan =>
  effectState(t).everPublished
    ? { t, skip: "上线过，只能下架" }
    : { t, skip: "", run: () => deleteCreationEffect(t.id) };

const verbs = { launch: "上线", retire: "下架", delete: "删除" } as const;
async function bulk(kind: keyof typeof verbs) {
  const list = chosen();
  if (!list.length || busy.value) return;
  const verb = verbs[kind];
  const plans: Plan[] = [];
  try {
    for (const [i, t] of list.entries()) {
      progress.value = `正在检查 ${i + 1}/${list.length}`;
      plans.push(
        kind === "launch"
          ? await planLaunch(t)
          : kind === "retire"
            ? planRetire(t)
            : planDelete(t)
      );
    }
  } catch (e) {
    progress.value = "";
    message(errorText(e), { type: "error" });
    return;
  }
  progress.value = "";
  const todo = plans.filter(p => p.run);
  const out: Outcome[] = plans
    .filter(p => !p.run)
    .map(p => ({
      name: effectState(p.t).name,
      status: "跳过",
      reason: p.skip
    }));
  if (todo.length) {
    const tip = {
      launch: "上线后用户就能使用这些效果。",
      retire: "下架后用户不能再选这些效果，已提交的作品不受影响。",
      delete: "删除后这些效果和它们的试做记录都会消失，不能恢复。"
    }[kind];
    if (
      !(await ask(
        `批量${verb}：将处理 ${todo.length} 个，将跳过 ${out.length} 个。${tip}`,
        `${verb} ${todo.length} 个`
      ))
    )
      return;
  }
  for (const [i, p] of todo.entries()) {
    progress.value = `正在处理 ${i + 1}/${todo.length}`;
    const name = effectState(p.t).name;
    try {
      await p.run!();
      out.push({ name, status: "成功", reason: "" });
    } catch (e) {
      const r = (e as { response?: { status?: number } }).response;
      const text = errorText(e, true);
      if (kind === "delete" && r?.status === 409)
        out.push({ name, status: "跳过", reason: text });
      else out.push({ name, status: "失败", reason: text });
    }
  }
  progress.value = "";
  report.value = { title: `批量${verb}`, items: out };
  selected.value = [];
  await refresh();
}
const summary = computed(() => {
  const items = report.value?.items ?? [];
  const ok = items.filter(i => i.status === "成功").length;
  const skip = items.filter(i => i.status === "跳过");
  const fail = items.filter(i => i.status === "失败").length;
  const reasons = [...new Set(skip.map(i => i.reason))].join("、");
  return (
    `成功 ${ok} 个，跳过 ${skip.length} 个` +
    (skip.length ? `（${reasons}）` : "") +
    (fail ? `，失败 ${fail} 个` : "")
  );
});

onMounted(refresh);
onBeforeUnmount(clearImageCache);
</script>

<template>
  <section class="creation-page">
    <EffectEditor v-if="editing" :template-id="editing" @back="back" />
    <template v-else>
      <div class="top">
        <div class="titles">
          <h1>创作效果</h1>
          <p class="caption">每个效果上线前，先试做一张看看效果。</p>
        </div>
        <div class="tools">
          <el-radio-group v-model="filter" size="small">
            <el-radio-button value="all">全部 {{ counts.all }}</el-radio-button>
            <el-radio-button value="live"
              >已上线 {{ counts.live }}</el-radio-button
            >
            <el-radio-button value="draft"
              >未上线 {{ counts.draft }}</el-radio-button
            >
            <el-radio-button value="retired"
              >已下架 {{ counts.retired }}</el-radio-button
            >
          </el-radio-group>
          <el-input
            v-model="keyword"
            class="search"
            clearable
            placeholder="搜索名称"
          />
          <el-button
            v-if="canBulk && !selecting"
            :disabled="!templates.length"
            @click="selecting = true"
            >批量管理</el-button
          >
          <el-button v-if="canWrite" type="primary" @click="openCreate"
            >新建效果</el-button
          >
        </div>
      </div>

      <div v-if="selecting" class="bar">
        <span>已选 {{ selected.length }} 个</span>
        <el-button link type="primary" :disabled="busy" @click="selectAll"
          >全选</el-button
        >
        <el-button
          v-if="canPublish"
          size="small"
          :disabled="busy || !selected.length"
          @click="bulk('launch')"
          >批量上线</el-button
        >
        <el-button
          v-if="canPublish"
          size="small"
          :disabled="busy || !selected.length"
          @click="bulk('retire')"
          >批量下架</el-button
        >
        <el-button
          v-if="canWrite"
          size="small"
          :disabled="busy || !selected.length"
          @click="bulk('delete')"
          >批量删除</el-button
        >
        <span v-if="progress" class="progress">{{ progress }}</span>
        <el-button
          class="done"
          size="small"
          :disabled="busy"
          @click="finishSelecting"
          >完成</el-button
        >
      </div>

      <el-alert
        v-if="report"
        class="report"
        :title="`${report.title}：${summary}`"
        :type="
          report.items.some(i => i.status === '失败') ? 'warning' : 'success'
        "
        @close="report = undefined"
      >
        <el-collapse>
          <el-collapse-item title="查看每个效果的结果">
            <div v-for="(i, n) in report.items" :key="n" class="result">
              {{ i.name }} · {{ i.status
              }}{{ i.reason ? `（${i.reason}）` : "" }}
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-alert>

      <el-empty
        v-if="!loading && !templates.length"
        description="还没有效果，点右上角新建一个"
      />
      <el-empty
        v-else-if="!loading && !visible.length"
        description="没有符合条件的效果"
      />
      <div v-loading="loading" class="effects">
        <article
          v-for="t in visible"
          :key="t.id"
          class="effect"
          :class="{ picked: selected.includes(t.id) }"
          @click="selecting && toggleSelect(t.id)"
        >
          <div class="thumb">
            <img
              v-if="previews.urls[key(t)]"
              :src="previews.urls[key(t)]"
              alt=""
            />
            <span v-else>暂无示意图</span>
            <el-checkbox
              v-if="selecting"
              class="check"
              :model-value="selected.includes(t.id)"
              @click.stop
              @change="toggleSelect(t.id)"
            />
          </div>
          <div class="body">
            <strong class="name" :title="effectState(t).name">{{
              effectState(t).name
            }}</strong>
            <el-tag size="small" :type="effectState(t).tone" effect="plain">{{
              effectState(t).label
            }}</el-tag>
            <span class="info">{{ infoLine(t) }}</span>
            <div class="ops">
              <el-button
                size="small"
                :disabled="selecting"
                @click.stop="editing = t.id"
                >{{ canWrite ? "编辑" : "查看" }}</el-button
              >
              <el-dropdown
                v-if="hasMenu(t) && !selecting"
                trigger="click"
                @command="(c: string) => command(t, c)"
              >
                <el-button size="small" aria-label="更多操作">⋯</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <template v-if="menuOf(t).sort">
                      <el-dropdown-item
                        command="up"
                        :disabled="visible[0]?.id === t.id"
                        >上移</el-dropdown-item
                      >
                      <el-dropdown-item
                        command="down"
                        :disabled="visible[visible.length - 1]?.id === t.id"
                        >下移</el-dropdown-item
                      >
                    </template>
                    <el-dropdown-item v-if="menuOf(t).retire" command="retire"
                      >下架</el-dropdown-item
                    >
                    <el-dropdown-item v-if="menuOf(t).del" command="delete"
                      >删除</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </article>
      </div>
    </template>
    <el-dialog v-model="dialog" title="新建效果" width="min(560px, 92vw)">
      <div class="label">从哪里开始</div>
      <div class="starts">
        <div
          class="start"
          :class="{ on: !sampleKey }"
          role="radio"
          tabindex="0"
          :aria-checked="!sampleKey"
          @click="pick()"
          @keydown.enter.space.prevent="pick()"
        >
          <strong>从空白开始</strong>
        </div>
        <div
          v-for="x in samples"
          :key="x.key"
          class="start"
          :class="{ on: sampleKey === x.key }"
          role="radio"
          tabindex="0"
          :aria-checked="sampleKey === x.key"
          @click="pick(x)"
          @keydown.enter.space.prevent="pick(x)"
        >
          <strong>{{ x.name }}</strong>
          <span class="hint">{{
            x.personRequired ? "需要人物" : "不需要人物"
          }}</span>
          <el-tag
            v-if="usedSamples.has(x.key)"
            size="small"
            type="info"
            class="used"
            :title="`已用于：${usedSamples.get(x.key)!.join('、')}`"
            >已用过</el-tag
          >
        </div>
      </div>
      <el-form label-position="top" class="new-form">
        <el-form-item label="名称">
          <el-input v-model="newName" maxlength="40" show-word-limit />
        </el-form-item>
        <el-form-item label="需要人物">
          <el-switch v-model="newPerson" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="create"
          >创建并编辑</el-button
        >
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.creation-page {
  padding: 24px;
}
h1 {
  margin: 0 0 8px;
  font-size: 24px;
}
.caption {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
}
.top {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: flex-start;
  justify-content: space-between;
}
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.search {
  width: 180px;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
.progress {
  font-size: 13px;
  color: var(--el-color-primary);
}
.done {
  margin-left: auto;
}
.report {
  margin-bottom: 12px;
}
.result {
  font-size: 13px;
  line-height: 1.8;
}
.label {
  margin-bottom: 8px;
  font-size: 14px;
}
.hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.starts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}
.start .used {
  align-self: flex-start;
}
.start {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.start.on {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary);
}
.new-form {
  margin-top: 16px;
}
.effects {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  min-height: 80px;
}
.effect {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.effect.picked {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary);
}
.thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-height: 240px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.check {
  position: absolute;
  top: 6px;
  left: 8px;
}
.body {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  padding: 8px 10px 10px;
}
.name {
  flex: 1 1 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.info {
  flex: 1 1 100%;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ops {
  display: flex;
  flex: 1 1 100%;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
}
@media (width <= 600px) {
  .creation-page {
    padding: 16px;
  }
  .effects {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .search {
    flex: 1 1 140px;
  }
}
</style>
