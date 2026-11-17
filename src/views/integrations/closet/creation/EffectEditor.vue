<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import {
  createCreationVersion,
  getCreationGenerationOptions,
  getCreationPreviewImage,
  getCreationTemplates,
  getCreationVersion,
  launchCreationVersion,
  retireCreationTemplate,
  saveCreationVersion,
  type CreationGenerationOptions,
  type TemplateSummary,
  type Trial,
  type VersionDetail
} from "@/api/closet/creation";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
import { formatTime } from "../useClosetRequest";
import TrialPanel from "./TrialPanel.vue";
import {
  effectState,
  errorText,
  lightText,
  versionStatusText
} from "./effectShared";

const props = defineProps<{ templateId: string }>();
const emit = defineEmits<{ back: [] }>();
const router = useRouter();
const { can } = useCurrentPermissions();
const canWrite = computed(() => can("closet:creation:write"));
const canPublish = computed(() => can("closet:creation:publish"));

const summary = ref<TemplateSummary>();
const detail = ref<VersionDetail>();
const options = ref<CreationGenerationOptions>();
const trials = ref<Trial[]>([]);
const loading = ref(true);
const busy = ref(false);
const form = reactive({
  name: "",
  description: "",
  maxGarments: 1,
  lights: [] as string[],
  prompt: "",
  modelKey: ""
});
const base = ref("");
const previewUrl = ref("");
let previewSerial = 0;
async function loadPreview() {
  const d = detail.value;
  const serial = ++previewSerial;
  let url = "";
  if (d?.previewImage) {
    try {
      url = URL.createObjectURL(
        await getCreationPreviewImage(props.templateId, d.versionId)
      );
    } catch {
      // 没有示意图时按空处理
    }
  }
  if (serial !== previewSerial) {
    if (url) URL.revokeObjectURL(url);
    return;
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = url;
}
onBeforeUnmount(() => {
  previewSerial++;
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});

const keyOf = (provider: string, model: string) => `${provider}\n${model}`;
const state = computed(() => effectState(summary.value!));
const editable = computed(() => detail.value?.status === "DRAFT");
const canEdit = computed(() => editable.value && canWrite.value);
const snapshot = () =>
  JSON.stringify([
    form.name,
    form.description,
    form.maxGarments,
    [...form.lights].sort(),
    form.prompt,
    form.modelKey
  ]);
const dirty = computed(() => !!detail.value && snapshot() !== base.value);
const choices = computed(() => {
  const list = (options.value?.providers ?? []).map(p => ({
    key: keyOf(p.provider, p.model),
    provider: p.provider,
    model: p.model
  }));
  const d = detail.value;
  if (
    d?.provider &&
    d.model &&
    !list.some(c => c.key === keyOf(d.provider!, d.model!))
  )
    list.push({
      key: keyOf(d.provider, d.model),
      provider: d.provider,
      model: d.model
    });
  const def = options.value?.defaultSelection;
  return list.map(c => ({
    ...c,
    label:
      `${c.provider} / ${c.model}` +
      (def && keyOf(def.provider, def.model) === c.key ? "（生图默认）" : "")
  }));
});
const noProviders = computed(
  () => !!options.value && options.value.providers.length === 0
);
const blockReason = computed(() => {
  if (noProviders.value) return "还没有可用的生图模型";
  if (!form.modelKey) return "先选择模型";
  if (dirty.value) return "先保存改动";
  return "";
});
const readyTrial = computed(() =>
  trials.value.find(t => t.current && t.status === "SUCCEEDED")
);
const history = computed(() =>
  [...(summary.value?.versions ?? [])].sort((a, b) => b.version - a.version)
);

function fill(d: VersionDetail) {
  detail.value = d;
  form.name = d.name;
  form.description = d.description;
  form.maxGarments = d.maxGarments;
  form.lights = d.options.light.filter(l => l !== "DEFAULT");
  form.prompt = d.prompt;
  form.modelKey = d.provider && d.model ? keyOf(d.provider, d.model) : "";
  base.value = snapshot();
  const def = options.value?.defaultSelection;
  if (d.status === "DRAFT" && !form.modelKey && def)
    form.modelKey = keyOf(def.provider, def.model);
}
async function load() {
  loading.value = true;
  try {
    const list = (await getCreationTemplates()).data.items;
    const t = list.find(x => x.id === props.templateId);
    if (!t) throw new Error("missing");
    summary.value = t;
    const s = effectState(t);
    const target = s.draft ?? s.published ?? t.versions[0];
    if (target) fill((await getCreationVersion(t.id, target.versionId)).data);
    else detail.value = undefined;
  } catch (e) {
    message(errorText(e), { type: "error" });
  } finally {
    loading.value = false;
  }
  void loadPreview();
}
async function run(fn: () => Promise<unknown>, success: string) {
  if (busy.value) return false;
  busy.value = true;
  try {
    await fn();
    message(success, { type: "success" });
    return true;
  } catch (e) {
    if (e !== "cancel" && e !== "close")
      message(errorText(e), { type: "error" });
    return false;
  } finally {
    busy.value = false;
  }
}
async function confirm(text: string) {
  try {
    await ElMessageBox.confirm(text, "请确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
    return true;
  } catch {
    return false;
  }
}
async function back() {
  if (dirty.value && !(await confirm("有未保存的改动，确定离开？"))) return;
  emit("back");
}
async function modify(from: string | null) {
  if (!canWrite.value) return;
  if (
    await run(() => createCreationVersion(props.templateId, from), "已创建草稿")
  )
    await load();
}
async function save() {
  const d = detail.value;
  if (!d || !canEdit.value || busy.value) return;
  const choice = choices.value.find(c => c.key === form.modelKey);
  const saved = ref<VersionDetail>();
  const ok = await run(async () => {
    saved.value = (
      await saveCreationVersion(props.templateId, d.versionId, {
        revision: d.revision,
        name: form.name.trim(),
        description: form.description.trim(),
        previewAssetId: d.previewAssetId,
        personRequired: d.personRequired,
        maxGarments: form.maxGarments,
        options: { light: ["DEFAULT", ...form.lights] },
        prompt: form.prompt,
        provider: choice?.provider ?? null,
        model: choice?.model ?? null,
        capabilityVersion: d.capabilityVersion
      })
    ).data;
  }, "已保存");
  if (ok && saved.value) fill(saved.value);
}
async function launch(trial?: Trial) {
  const t = trial ?? readyTrial.value;
  const d = detail.value;
  if (!t || !d || !canPublish.value || dirty.value) return;
  if (!(await confirm("上线后用户就能使用这个效果。确认上线？"))) return;
  if (
    await run(
      () =>
        launchCreationVersion(props.templateId, d.versionId, {
          revision: d.revision,
          trialId: t.id
        }),
      "已上线"
    )
  ) {
    trials.value = [];
    await load();
  }
}
async function retire() {
  const t = summary.value;
  if (!t || !canPublish.value) return;
  if (!(await confirm("下架后用户不能再选这个效果，已提交的作品不受影响。")))
    return;
  if (await run(() => retireCreationTemplate(t.id, t.revision), "已下架"))
    await load();
}
onMounted(async () => {
  try {
    options.value = (await getCreationGenerationOptions()).data;
  } catch (e) {
    message(errorText(e), { type: "error" });
  }
  await load();
});
</script>

<template>
  <div v-loading="loading" class="editor">
    <el-button link type="primary" @click="back">← 全部效果</el-button>
    <template v-if="summary && detail">
      <header class="head">
        <h1>{{ state.name }}</h1>
        <el-tag :type="state.tone" effect="plain">{{ state.label }}</el-tag>
        <el-button
          v-if="state.published && summary.enabled && canPublish"
          class="end"
          :disabled="busy"
          @click="retire"
          >下架</el-button
        >
      </header>

      <div v-if="!editable" class="readonly-bar">
        <span class="caption">{{
          state.draft
            ? "这是之前留下的待上线内容，修改前需要新建一份草稿。"
            : "当前显示线上内容。"
        }}</span>
        <el-button
          v-if="canWrite"
          type="primary"
          :disabled="busy"
          @click="modify(detail.versionId)"
          >修改</el-button
        >
      </div>

      <div class="preview">
        <img v-if="previewUrl" :src="previewUrl" alt="示意图" />
        <div v-else class="ph" />
        <div class="hint">
          {{
            previewUrl
              ? "示意图（用户选效果时看到）"
              : "还没有示意图，试做满意后可以设为示意图"
          }}
        </div>
      </div>

      <section class="step">
        <h2><span class="no">1</span>模型</h2>
        <el-alert
          v-if="noProviders"
          type="warning"
          :closable="false"
          show-icon
          title="还没有可用的生图模型，请先在服务端配置生图服务。"
        />
        <el-select
          v-model="form.modelKey"
          class="field"
          placeholder="选择生图模型"
          :disabled="!canEdit || busy"
        >
          <el-option
            v-for="c in choices"
            :key="c.key"
            :label="c.label"
            :value="c.key"
          />
        </el-select>
        <div class="hint">
          <el-link
            type="primary"
            underline="never"
            @click="router.push('/creation/capabilities')"
            >模型高级设置</el-link
          >
        </div>
      </section>

      <section class="step">
        <h2><span class="no">2</span>画面描述</h2>
        <el-form label-position="top" :disabled="!canEdit || busy" class="form">
          <el-form-item label="名称">
            <el-input v-model="form.name" maxlength="40" />
          </el-form-item>
          <el-form-item label="给用户看的一句话说明">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="2"
              maxlength="200"
            />
          </el-form-item>
          <el-form-item label="需要人物">
            <span>{{
              detail.personRequired ? "需要选择形象" : "不需要人物"
            }}</span>
          </el-form-item>
          <el-form-item label="衣物最多几件">
            <el-input-number v-model="form.maxGarments" :min="1" :max="12" />
          </el-form-item>
          <el-form-item label="可选光线">
            <el-checkbox-group v-model="form.lights">
              <el-checkbox :model-value="true" disabled>{{
                lightText.DEFAULT
              }}</el-checkbox>
              <el-checkbox value="WARM">{{ lightText.WARM }}</el-checkbox>
              <el-checkbox value="COOL">{{ lightText.COOL }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item label="提示词">
            <el-input
              v-model="form.prompt"
              class="prompt"
              type="textarea"
              :autosize="{ minRows: 8, maxRows: 20 }"
              maxlength="8000"
              show-word-limit
            />
            <div class="hint">
              英文效果最好。系统会在末尾自动附上衣物顺序、动作、光线和用户的补充说明。
            </div>
          </el-form-item>
        </el-form>
        <div v-if="canEdit" class="save-row">
          <el-button
            type="primary"
            :loading="busy"
            :disabled="!dirty"
            @click="save"
            >保存</el-button
          >
          <span v-if="dirty" class="warn">有未保存的改动</span>
        </div>
      </section>

      <template v-if="editable">
        <section class="step">
          <h2><span class="no">3</span>试做</h2>
          <TrialPanel
            v-model:trials="trials"
            :template-id="templateId"
            :version="detail"
            :can-start="canWrite"
            :can-set-preview="canWrite"
            :can-launch="canPublish && !dirty"
            :block-reason="blockReason"
            @changed="load"
            @launch="launch"
          />
        </section>

        <section v-if="canPublish" class="step">
          <h2><span class="no">4</span>上线</h2>
          <p class="hint">
            {{
              dirty
                ? "先保存改动，再用当前内容试做。"
                : readyTrial
                  ? "用最新一张成功的试做上线。"
                  : "先用当前内容试做成功一张"
            }}
          </p>
          <el-button
            type="primary"
            :disabled="!readyTrial || dirty || busy"
            @click="launch()"
            >上线</el-button
          >
        </section>
      </template>

      <el-collapse class="history">
        <el-collapse-item title="历史版本" name="history">
          <div v-for="v in history" :key="v.versionId" class="version">
            <span
              >版本 {{ v.version }} · {{ versionStatusText[v.status] }} ·
              {{ formatTime(v.publishedAtMs) }}</span
            >
            <el-button
              v-if="canWrite && !state.draft"
              link
              type="primary"
              :disabled="busy"
              @click="modify(v.versionId)"
              >以此为底稿新建</el-button
            >
          </div>
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>

<style scoped>
.editor {
  min-height: 120px;
  max-width: 960px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin: 8px 0 16px;
}
.head h1 {
  margin: 0;
  font-size: 24px;
}
.end {
  margin-left: auto;
}
.readonly-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  margin-bottom: 8px;
}
.caption,
.hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.hint {
  margin-top: 6px;
}
.step {
  padding: 20px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}
.step h2 {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 12px;
  font-size: 16px;
}
.no {
  color: var(--el-text-color-secondary);
}
.field {
  display: block;
  width: min(100%, 420px);
}
.form {
  max-width: 760px;
}
.prompt :deep(textarea) {
  font-family: var(--el-font-family-monospace, ui-monospace, Menlo, monospace);
  font-size: 13px;
}
.preview {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 8px;
}
.preview img,
.preview .ph {
  width: 96px;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
.save-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.warn {
  font-size: 13px;
  color: var(--el-color-warning);
}
.history {
  margin-top: 8px;
}
.version {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}
</style>
