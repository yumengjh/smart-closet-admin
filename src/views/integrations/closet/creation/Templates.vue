<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  createCreationEffect,
  getCreationPreviewImage,
  getCreationPromptSamples,
  getCreationTemplates,
  reorderCreationEffects,
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

const canWrite = computed(() => can("closet:creation:write"));
const moving = ref(false);
async function move(i: number, d: number) {
  const j = i + d;
  if (moving.value || j < 0 || j >= templates.value.length) return;
  const before = templates.value;
  const next = [...before];
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

const dialog = ref(false);
const samples = ref<PromptSample[]>([]);
const sampleKey = ref("");
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
onMounted(refresh);
onBeforeUnmount(clearImageCache);
</script>

<template>
  <section class="creation-page">
    <EffectEditor v-if="editing" :template-id="editing" @back="back" />
    <template v-else>
      <div class="top">
        <div>
          <h1>创作效果</h1>
          <p class="caption">每个效果上线前，先试做一张看看效果。</p>
        </div>
        <el-button v-if="canWrite" type="primary" @click="openCreate"
          >新建效果</el-button
        >
      </div>
      <el-empty
        v-if="!loading && !templates.length"
        description="还没有效果，点右上角新建一个"
      />
      <div v-loading="loading" class="effects">
        <article v-for="(t, i) in templates" :key="t.id" class="effect">
          <div class="thumb">
            <img
              v-if="previews.urls[key(t)]"
              :src="previews.urls[key(t)]"
              alt=""
            />
            <span v-else>暂无示意图</span>
          </div>
          <div class="body">
            <strong class="name">{{ effectState(t).name }}</strong>
            <el-tag :type="effectState(t).tone" effect="plain">{{
              effectState(t).label
            }}</el-tag>
            <span v-if="canWrite" class="order">
              <el-button
                size="small"
                :disabled="moving || i === 0"
                @click="move(i, -1)"
                >上移</el-button
              ><el-button
                size="small"
                :disabled="moving || i === templates.length - 1"
                @click="move(i, 1)"
                >下移</el-button
              >
            </span>
            <el-button class="open" @click="editing = t.id">{{
              canWrite ? "编辑" : "查看"
            }}</el-button>
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
  margin: 0 0 20px;
  color: var(--el-text-color-secondary);
}
.top {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: flex-start;
  justify-content: space-between;
}
.order {
  display: inline-flex;
  gap: 4px;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  min-height: 80px;
}
.effect {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.body {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 12px 16px 16px;
}
.name {
  flex: 1 1 100%;
  font-size: 16px;
}
.open {
  margin-left: auto;
}
@media (width <= 900px) {
  .effects {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (width <= 600px) {
  .creation-page {
    padding: 16px;
  }
}
</style>
