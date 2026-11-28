<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessageBox, type UploadFile } from "element-plus";
import {
  deleteTrialPerson,
  getCreationTrialImage,
  getCreationTrials,
  getTrialGarmentImage,
  getTrialGarments,
  getTrialPersonImage,
  getTrialPersons,
  setCreationPreview,
  startCreationTrial,
  uploadTrialPerson,
  type Trial,
  type TrialGarment,
  type TrialLight,
  type TrialPerson,
  type VersionDetail
} from "@/api/closet/creation";
import { message } from "@/utils/message";
import { formatTime } from "../useClosetRequest";
import { errorText, lightText, roleLabel, useBlobImages } from "./effectShared";

const props = defineProps<{
  templateId: string;
  version: VersionDetail;
  canStart: boolean;
  canSetPreview: boolean;
  canLaunch: boolean;
  blockReason: string;
}>();
const emit = defineEmits<{ changed: []; launch: [trial: Trial] }>();
const trials = defineModel<Trial[]>("trials", { required: true });

const garments = ref<TrialGarment[]>([]);
const persons = ref<TrialPerson[]>([]);
const garmentsReady = ref(false);
const picked = ref<string[]>([]);
const role = ref("");
const personId = ref("");
const light = ref<TrialLight>("DEFAULT");
const pose = ref("");
const starting = ref(false);
const busy = ref(false);
const garmentImages = useBlobImages("garment", getTrialGarmentImage);
const personImages = useBlobImages("person", getTrialPersonImage);
const trialImages = useBlobImages("trial", getCreationTrialImage);

const max = computed(() => props.version.maxGarments);
const needPerson = computed(() => props.version.personRequired);
const roles = computed(() => {
  const seen = new Map<string, string>();
  for (const g of garments.value)
    seen.set(roleLabel(g.role), roleLabel(g.role));
  return [...seen.keys()];
});
const pageSize = 24;
const count = ref(pageSize);
const filtered = computed(() =>
  role.value
    ? garments.value.filter(g => roleLabel(g.role) === role.value)
    : garments.value
);
const shown = computed(() => filtered.value.slice(0, count.value));
watch(role, () => (count.value = pageSize));
// 衣物缩略图只在进入视口时才取。
const observer =
  typeof IntersectionObserver === "undefined"
    ? undefined
    : new IntersectionObserver(
        entries =>
          entries.forEach(e => {
            if (!e.isIntersecting) return;
            observer?.unobserve(e.target);
            (e.target as HTMLElement & { _load?: () => void })._load?.();
          }),
        { rootMargin: "120px" }
      );
const vInView = {
  mounted(el: HTMLElement & { _load?: () => void }, b: { value: () => void }) {
    el._load = b.value;
    if (observer) observer.observe(el);
    else b.value();
  },
  unmounted(el: HTMLElement) {
    observer?.unobserve(el);
  }
};
const active = computed(() =>
  trials.value.some(t => t.status === "QUEUED" || t.status === "RUNNING")
);
const lights = computed(() => props.version.options.light);
const reason = computed(() => {
  if (props.blockReason) return props.blockReason;
  if (!picked.value.length) return "先选几件衣物";
  if (picked.value.length > max.value) return `衣物最多 ${max.value} 件`;
  if (needPerson.value && !personId.value) return "先选一个试做形象";
  if (active.value) return "已有一张在试做中";
  return "";
});

function toggle(g: TrialGarment) {
  const i = picked.value.indexOf(g.id);
  if (i >= 0) picked.value.splice(i, 1);
  else if (picked.value.length < max.value) picked.value.push(g.id);
}
async function loadTrials() {
  try {
    trials.value = (await getCreationTrials(props.templateId)).data.items;
  } catch (e) {
    message(errorText(e), { type: "error" });
  }
}
let timer: ReturnType<typeof setInterval> | undefined;
let polling = false;
watch(
  active,
  on => {
    if (on && !timer)
      timer = setInterval(async () => {
        if (polling) return;
        polling = true;
        try {
          trials.value = (await getCreationTrials(props.templateId)).data.items;
        } catch {
          // 下一轮再试
        } finally {
          polling = false;
        }
      }, 4000);
    else if (!on && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  },
  { immediate: true }
);
// 有直连地址（存储桶 / CDN）的图直接用，其余经后台取。
watch(
  trials,
  list =>
    list.forEach(
      t =>
        t.status === "SUCCEEDED" &&
        !t.thumbnailUrl &&
        !t.imageUrl &&
        trialImages.load(t.id)
    ),
  { immediate: true }
);
watch(
  persons,
  list => list.forEach(p => !p.imageUrl && personImages.load(p.id)),
  { immediate: true }
);
const garmentSrc = (g: TrialGarment) =>
  g.imageUrl || garmentImages.urls[g.id] || "";
const personSrc = (p: TrialPerson) =>
  p.imageUrl || personImages.urls[p.id] || "";
const trialThumb = (t: Trial) =>
  t.thumbnailUrl || t.imageUrl || trialImages.urls[t.id] || "";
const trialFull = (t: Trial) =>
  t.imageUrl || t.thumbnailUrl || trialImages.urls[t.id] || "";

// 计时：排队中 / 生成中每秒刷新已等时长；“一般约 N 秒”取最近成功试做的平均用时。
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | undefined;
watch(
  active,
  on => {
    if (on && !ticker)
      ticker = setInterval(() => (now.value = Date.now()), 1000);
    else if (!on && ticker) {
      clearInterval(ticker);
      ticker = undefined;
    }
  },
  { immediate: true }
);
const typical = computed(() => {
  const done = trials.value
    .filter(t => t.status === "SUCCEEDED" && t.finishedAtMs)
    .map(t => (t.finishedAtMs! - t.createdAtMs) / 1000)
    .filter(s => s > 0 && s < 900);
  return done.length
    ? Math.round(done.reduce((a, b) => a + b, 0) / done.length)
    : 60;
});
const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const waited = (t: Trial) => (now.value - t.createdAtMs) / 1000;
const percent = (t: Trial) =>
  Math.min(95, Math.round((waited(t) / typical.value) * 100));
const took = (t: Trial) =>
  t.finishedAtMs ? clock((t.finishedAtMs - t.createdAtMs) / 1000) : "";

// 完成时提示；页面在后台时把标签页标题改成提醒，回到页面再恢复。
const watching = new Set<string>();
const baseTitle = document.title;
function restoreTitle() {
  if (!document.hidden) document.title = baseTitle;
}
document.addEventListener("visibilitychange", restoreTitle);
watch(trials, list => {
  for (const t of list) {
    const running = t.status === "QUEUED" || t.status === "RUNNING";
    if (running) watching.add(t.id);
    else if (watching.delete(t.id)) {
      const ok = t.status === "SUCCEEDED";
      message(
        ok
          ? `试做完成，用时 ${took(t)}`
          : `试做没有成功：${t.errorMessage || "请稍后再试"}`,
        { type: ok ? "success" : "error" }
      );
      if (document.hidden)
        document.title = `${ok ? "【试做完成】" : "【试做失败】"}${baseTitle}`;
    }
  }
});
const records = ref<HTMLElement>();
watch(needPerson, on => {
  if (on && !personId.value && persons.value.length)
    personId.value = persons.value[0].id;
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (ticker) clearInterval(ticker);
  observer?.disconnect();
  document.removeEventListener("visibilitychange", restoreTitle);
  document.title = baseTitle;
});
onMounted(async () => {
  void loadTrials();
  try {
    const [g, p] = await Promise.all([getTrialGarments(), getTrialPersons()]);
    garments.value = g.data.items;
    persons.value = p.data.items;
    if (needPerson.value && persons.value.length)
      personId.value = persons.value[0].id;
  } catch (e) {
    message(errorText(e), { type: "error" });
  } finally {
    garmentsReady.value = true;
  }
});

async function start() {
  if (reason.value || starting.value) return;
  starting.value = true;
  try {
    await startCreationTrial(props.templateId, props.version.versionId, {
      revision: props.version.revision,
      garmentIds: picked.value,
      personId: needPerson.value ? personId.value : null,
      light: light.value,
      pose: needPerson.value && pose.value.trim() ? pose.value.trim() : null
    });
    message("已开始试做，完成后会提示你，可以先看别的", { type: "success" });
    await loadTrials();
    records.value?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    message(errorText(e, true), { type: "error" });
  } finally {
    starting.value = false;
  }
}

const dialog = ref(false);
const upload = ref<File>();
const note = ref("");
function choose(f: UploadFile) {
  const raw = f.raw;
  if (!raw) return;
  if (!["image/png", "image/jpeg"].includes(raw.type)) {
    message("请选择 PNG 或 JPEG 图片", { type: "warning" });
    return;
  }
  if (raw.size > 10 * 1024 * 1024) {
    message("图片不能超过 10 MiB", { type: "warning" });
    return;
  }
  upload.value = raw;
  note.value = "";
  dialog.value = true;
}
async function submitPerson() {
  if (!upload.value || busy.value) return;
  if (!note.value.trim()) {
    message("请填写说明", { type: "warning" });
    return;
  }
  busy.value = true;
  try {
    const p = (await uploadTrialPerson(upload.value, note.value.trim())).data;
    persons.value = [p, ...persons.value];
    personId.value = p.id;
    dialog.value = false;
    message("已上传", { type: "success" });
  } catch (e) {
    message(errorText(e), { type: "error" });
  } finally {
    busy.value = false;
  }
}
async function removePerson(p: TrialPerson) {
  try {
    await ElMessageBox.confirm("删除这张试做形象？", "请确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  try {
    await deleteTrialPerson(p.id);
    persons.value = persons.value.filter(x => x.id !== p.id);
    personImages.drop(p.id);
    if (personId.value === p.id) personId.value = "";
  } catch (e) {
    message(errorText(e), { type: "error" });
  }
}
async function setPreview(t: Trial) {
  if (busy.value) return;
  busy.value = true;
  try {
    await setCreationPreview(props.templateId, props.version.versionId, {
      trialId: t.id
    });
    message("已设为示意图", { type: "success" });
    emit("changed");
    void loadTrials();
  } catch (e) {
    message(errorText(e), { type: "error" });
  } finally {
    busy.value = false;
  }
}
const statusText = (t: Trial) =>
  ({
    QUEUED: "排队中",
    RUNNING: "生成中…",
    SUCCEEDED: "完成",
    FAILED: "失败"
  })[t.status];
</script>

<template>
  <div class="trial">
    <template v-if="canStart">
      <h3>衣物</h3>
      <div v-if="garmentsReady && !garments.length" class="hint">
        预设衣物库还没有上架的衣物。
      </div>
      <template v-else>
        <div class="bar">
          <el-radio-group v-model="role" size="small">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button v-for="r in roles" :key="r" :value="r">{{
              r
            }}</el-radio-button>
          </el-radio-group>
          <span class="hint">已选 {{ picked.length }} / {{ max }} 件</span>
        </div>
        <div class="garments">
          <div
            v-for="g in shown"
            :key="g.id"
            v-in-view="() => !g.imageUrl && garmentImages.load(g.id)"
            class="garment"
            :class="{
              on: picked.includes(g.id),
              off: !picked.includes(g.id) && picked.length >= max
            }"
            role="checkbox"
            tabindex="0"
            :aria-checked="picked.includes(g.id)"
            @click="toggle(g)"
            @keydown.enter.space.prevent="toggle(g)"
          >
            <img
              v-if="garmentSrc(g)"
              :src="garmentSrc(g)"
              :alt="g.name"
              loading="lazy"
            />
            <div v-else class="ph" />
            <span class="gname">{{ g.name }}</span>
            <span class="hint">{{ roleLabel(g.role) }}</span>
          </div>
        </div>
        <el-button
          v-if="filtered.length > shown.length"
          class="more"
          @click="count += pageSize"
          >显示更多（还有 {{ filtered.length - shown.length }} 件）</el-button
        >
      </template>

      <template v-if="needPerson">
        <h3>试做形象</h3>
        <div class="persons">
          <div
            v-for="p in persons"
            :key="p.id"
            class="person"
            :class="{ on: personId === p.id }"
            :title="p.note"
            role="radio"
            tabindex="0"
            :aria-checked="personId === p.id"
            @click="personId = p.id"
            @keydown.enter.space.prevent="personId = p.id"
          >
            <img v-if="personSrc(p)" :src="personSrc(p)" :alt="p.note" />
            <div v-else class="ph" />
            <el-button
              class="del"
              size="small"
              circle
              aria-label="删除形象"
              @click.stop="removePerson(p)"
              >×</el-button
            >
          </div>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept="image/png,image/jpeg"
            :on-change="choose"
          >
            <el-button>上传试做形象</el-button>
          </el-upload>
        </div>
        <div class="hint">
          仅用于后台试做，请使用已获授权、可用于测试的人像照片。
        </div>
      </template>

      <h3>光线与动作</h3>
      <el-radio-group v-model="light">
        <el-radio v-for="l in lights" :key="l" :value="l">{{
          lightText[l] ?? l
        }}</el-radio>
      </el-radio-group>
      <el-input
        v-if="needPerson"
        v-model="pose"
        class="pose"
        maxlength="80"
        show-word-limit
        placeholder="例如：单手插兜，自然站立"
      />

      <div class="go">
        <el-tooltip :disabled="!reason" :content="reason" placement="top">
          <span>
            <el-button
              type="primary"
              :loading="starting"
              :disabled="!!reason"
              @click="start"
              >试做一张</el-button
            >
          </span>
        </el-tooltip>
        <span class="hint"
          >会真实调用一次模型，一般约 {{ typical }} 秒，产生平台费用。</span
        >
      </div>
      <div v-if="reason" class="hint">{{ reason }}</div>
    </template>

    <h3 ref="records">试做记录</h3>
    <div v-if="!trials.length" class="hint">还没有试做过。</div>
    <div class="records">
      <article v-for="t in trials" :key="t.id" class="record">
        <div class="shot">
          <el-image
            v-if="t.status === 'SUCCEEDED' && trialThumb(t)"
            :src="trialThumb(t)"
            :preview-src-list="[trialFull(t)]"
            preview-teleported
            fit="cover"
            class="img"
          />
          <div
            v-else-if="t.status === 'QUEUED' || t.status === 'RUNNING'"
            class="wait"
          >
            <strong>{{ statusText(t) }}</strong>
            <span class="clock">已等 {{ clock(waited(t)) }}</span>
            <el-progress
              :percentage="percent(t)"
              :show-text="false"
              :indeterminate="waited(t) > typical"
              :stroke-width="6"
              class="bar-progress"
            />
            <span class="hint">{{
              waited(t) > typical
                ? "比平时慢一些，还在等模型返回"
                : `一般约 ${typical} 秒`
            }}</span>
          </div>
          <span v-else-if="t.status === 'FAILED'" class="err">{{
            t.errorMessage || "失败"
          }}</span>
        </div>
        <div class="meta">
          <div class="line">
            <el-tag
              size="small"
              :type="t.status === 'FAILED' ? 'danger' : 'info'"
              effect="plain"
              >{{ statusText(t) }}</el-tag
            >
            <el-tag
              size="small"
              :type="t.current ? 'success' : 'info'"
              effect="plain"
              :title="
                t.current
                  ? '模型、提示词与现在的草稿一致，可以用来上线'
                  : '模型、提示词或“需要人物”在这之后改过'
              "
              >{{ t.current ? "当前内容" : "内容已改过" }}</el-tag
            >
            <el-tag v-if="t.preview" size="small" type="warning" effect="plain"
              >示意图</el-tag
            >
          </div>
          <div class="hint">{{ t.provider }} / {{ t.model }}</div>
          <div class="hint">
            {{ t.garmentCount }} 件衣物 · {{ formatTime(t.createdAtMs) }}
            <template
              v-if="t.status !== 'QUEUED' && t.status !== 'RUNNING' && took(t)"
            >
              · 用时 {{ took(t) }}</template
            >
          </div>
          <div v-if="t.status === 'SUCCEEDED'" class="ops">
            <el-button
              v-if="canSetPreview && !t.preview"
              size="small"
              :disabled="busy"
              @click="setPreview(t)"
              >设为示意图</el-button
            >
            <el-button
              v-if="canLaunch && t.current"
              size="small"
              type="primary"
              @click="emit('launch', t)"
              >用这张上线</el-button
            >
          </div>
        </div>
      </article>
    </div>

    <el-dialog v-model="dialog" title="上传试做形象" width="min(420px, 92vw)">
      <el-input
        v-model="note"
        maxlength="200"
        show-word-limit
        placeholder="填写说明，例如人像来源或授权情况"
      />
      <div class="hint">
        仅用于后台试做，请使用已获授权、可用于测试的人像照片。
      </div>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitPerson"
          >上传</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
h3 {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  margin-bottom: 8px;
}
.garments {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}
.garment,
.person {
  position: relative;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  outline-offset: 2px;
}
.garment {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
}
.garment.on,
.person.on {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary);
}
.garment.off {
  cursor: not-allowed;
  opacity: 0.5;
}
.garment img,
.garment .ph {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
.gname {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.more {
  margin-top: 8px;
}
.persons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.person {
  width: 72px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
}
.person img,
.person .ph {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--el-fill-color-light);
}
.del {
  position: absolute;
  top: 2px;
  right: 2px;
}
.pose {
  display: block;
  max-width: 420px;
  margin-top: 8px;
}
.go {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin-top: 16px;
}
.records {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.record {
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.shot {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 4;
  max-height: 260px;
  padding: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-fill-color-light);
}
.img {
  width: 100%;
  height: 100%;
}
.err {
  color: var(--el-color-danger);
}
.wait {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
}
.clock {
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  color: var(--el-text-color-primary);
}
.bar-progress {
  width: 80%;
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px 10px;
}
.line,
.ops {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}
.ops {
  margin-top: 4px;
}
</style>
