<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import {
  createCreationVersion,
  getCreationCapabilities,
  getCreationTemplates,
  getCreationVersion,
  publishCreationVersion,
  retireCreationTemplate,
  saveCreationVersion,
  verifyCreationVersion,
  type TemplateSummary,
  type Capability,
  type VersionDetail,
  type VersionEdit
} from "@/api/closet/creation";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { message } from "@/utils/message";
defineOptions({ name: "ClosetCreationTemplates" });
const { can } = useCurrentPermissions();
const templates = ref<TemplateSummary[]>([]);
const capabilities = ref<Capability[]>([]);
const selected = ref<TemplateSummary>();
const detail = ref<VersionDetail>();
const form = ref<VersionEdit>();
const evidence = ref("");
const loading = ref(false);
const saving = ref(false);
const previews = [
  "sunlit-flatlay",
  "dual-view-editorial",
  "daily-outfit-share"
];
const isDraft = computed(() => detail.value?.status === "DRAFT");
const canPublish = computed(
  () =>
    !!detail.value &&
    capabilities.value.some(
      c =>
        c.provider === detail.value?.provider &&
        c.model === detail.value?.model &&
        c.version === detail.value?.capabilityVersion &&
        c.verified
    )
);
function fail(e: unknown) {
  if (e === "cancel" || e === "close") return;
  const r = (
    e as { response?: { status?: number; data?: { message?: string } } }
  ).response;
  message(
    r?.status === 409
      ? "版本已变化，请重新载入后再操作"
      : r?.data?.message || "请求失败，请重试",
    { type: "error" }
  );
}
async function refresh() {
  loading.value = true;
  try {
    const [templateResponse, capabilityResponse] = await Promise.all([
      getCreationTemplates(),
      getCreationCapabilities()
    ]);
    templates.value = templateResponse.data.items;
    capabilities.value = capabilityResponse.data.items;
    if (selected.value)
      selected.value = templates.value.find(t => t.id === selected.value?.id);
  } catch (e) {
    fail(e);
  } finally {
    loading.value = false;
  }
}
async function inspect(t: TemplateSummary, id: string) {
  try {
    const d = (await getCreationVersion(t.id, id)).data;
    selected.value = t;
    detail.value = d;
    evidence.value = d.evidence || "";
    form.value = {
      revision: d.revision,
      name: d.name,
      description: d.description,
      previewAssetId: d.previewAssetId,
      personRequired: d.personRequired,
      maxGarments: d.maxGarments,
      options: { light: [...d.options.light] },
      prompt: d.prompt,
      provider: d.provider,
      model: d.model,
      capabilityVersion: d.capabilityVersion
    };
  } catch (e) {
    fail(e);
  }
}
function selectCapability(index: number) {
  const capability = capabilities.value[index];
  if (!form.value || !capability) return;
  form.value.provider = capability.provider;
  form.value.model = capability.model;
  form.value.capabilityVersion = capability.version;
}
async function action(
  fn: () => Promise<unknown>,
  success: string,
  reload = true
) {
  if (saving.value) return;
  saving.value = true;
  try {
    await fn();
    message(success, { type: "success" });
    if (reload) {
      const t = selected.value;
      const d = detail.value;
      await refresh();
      if (t && d) {
        const fresh = templates.value.find(x => x.id === t.id);
        if (fresh) await inspect(fresh, d.versionId);
      }
    }
  } catch (e) {
    fail(e);
  } finally {
    saving.value = false;
  }
}
async function copy(t: TemplateSummary, v: string | null) {
  if (!can("closet:creation:write")) return;
  await action(
    async () => {
      const d = (await createCreationVersion(t.id, v)).data;
      await refresh();
      const fresh = templates.value.find(x => x.id === t.id);
      if (fresh) await inspect(fresh, d.versionId);
    },
    "草稿已创建",
    false
  );
}
async function save() {
  if (
    !detail.value ||
    !form.value ||
    !isDraft.value ||
    !can("closet:creation:write")
  )
    return;
  if (!form.value.options.light.includes("DEFAULT")) {
    message("光线选项必须包含默认", { type: "warning" });
    return;
  }
  await action(
    () =>
      saveCreationVersion(
        detail.value!.id,
        detail.value!.versionId,
        form.value!
      ),
    "草稿已保存"
  );
}
async function verify() {
  if (!detail.value || !can("closet:creation:write")) return;
  if (evidence.value.trim().length < 20) {
    message("验证证据至少 20 字", { type: "warning" });
    return;
  }
  await action(
    () =>
      verifyCreationVersion(
        detail.value!.id,
        detail.value!.versionId,
        detail.value!.revision,
        evidence.value.trim()
      ),
    "验证记录已保存"
  );
}
async function publish() {
  if (!detail.value || !can("closet:creation:publish") || !canPublish.value)
    return;
  try {
    await ElMessageBox.confirm(
      "确认发布此版本？服务端将核验模型能力、证据与预览。",
      "发布模板",
      { type: "warning" }
    );
  } catch {
    return;
  }
  await action(
    () =>
      publishCreationVersion(
        detail.value!.id,
        detail.value!.versionId,
        detail.value!.revision
      ),
    "模板已发布"
  );
}
async function retire(t: TemplateSummary) {
  if (!can("closet:creation:publish")) return;
  try {
    await ElMessageBox.confirm(
      "下架后将停止新的创作提交，已提交任务继续执行。",
      "下架模板",
      { type: "warning" }
    );
  } catch {
    return;
  }
  await action(() => retireCreationTemplate(t.id, t.revision), "模板已下架");
}
onMounted(() => {
  if (can("closet:creation:read")) void refresh();
});
</script>
<template>
  <section class="creation-page">
    <h1>穿搭创作模板</h1>
    <p class="caption">
      编辑草稿、记录验证证据并发布。已发布内容通过复制新版本修改。
    </p>
    <el-button @click="refresh">刷新</el-button>
    <el-row :gutter="16" class="content">
      <el-col :xs="24" :lg="10"
        ><div v-loading="loading">
          <el-card
            v-for="t in templates"
            :key="t.id"
            class="template-card"
            shadow="never"
          >
            <template #header
              ><div class="row">
                <strong>{{ t.id }}</strong
                ><el-tag :type="t.enabled ? 'success' : 'info'">{{
                  t.enabled ? "已启用" : "未启用"
                }}</el-tag>
              </div></template
            >
            <div v-for="v in t.versions" :key="v.versionId" class="version">
              <el-button link type="primary" @click="inspect(t, v.versionId)"
                >版本 {{ v.version }} · {{ v.name }}</el-button
              ><span>{{ v.status }}</span
              ><el-button
                v-if="can('closet:creation:write')"
                link
                @click="copy(t, v.versionId)"
                >复制</el-button
              >
            </div>
            <div class="actions">
              <el-button
                v-if="can('closet:creation:write')"
                size="small"
                @click="copy(t, null)"
                >新建草稿</el-button
              ><el-button
                v-if="can('closet:creation:publish') && t.enabled"
                size="small"
                @click="retire(t)"
                >下架</el-button
              >
            </div>
          </el-card>
        </div></el-col
      >
      <el-col :xs="24" :lg="14"
        ><el-card v-if="detail && form" shadow="never">
          <template #header
            ><div class="row">
              <strong>{{ detail.name }} · 版本 {{ detail.version }}</strong
              ><el-tag>{{ detail.status }}</el-tag>
            </div></template
          >
          <el-form
            label-position="top"
            :disabled="!isDraft || !can('closet:creation:write') || saving"
          >
            <el-form-item label="名称"
              ><el-input v-model="form.name"
            /></el-form-item>
            <el-form-item label="说明"
              ><el-input v-model="form.description" type="textarea"
            /></el-form-item>
            <el-form-item label="公开示意素材"
              ><el-select v-model="form.previewAssetId" class="full"
                ><el-option
                  v-for="p in previews"
                  :key="p"
                  :label="p"
                  :value="p" /></el-select
            ></el-form-item>
            <el-form-item label="需要形象"
              ><el-switch v-model="form.personRequired"
            /></el-form-item>
            <el-form-item label="衣物数量上限"
              ><el-input-number v-model="form.maxGarments" :min="1" :max="12"
            /></el-form-item>
            <el-form-item label="光线选项"
              ><el-checkbox-group v-model="form.options.light"
                ><el-checkbox value="DEFAULT" disabled>默认</el-checkbox
                ><el-checkbox value="WARM">暖光</el-checkbox
                ><el-checkbox value="COOL">冷光</el-checkbox></el-checkbox-group
              ></el-form-item
            >
            <el-form-item label="提示词"
              ><el-input v-model="form.prompt" type="textarea" :rows="6"
            /></el-form-item>
            <el-form-item label="模型能力">
              <el-select
                class="full"
                placeholder="选择已登记能力"
                @change="selectCapability"
              >
                <el-option
                  v-for="(c, i) in capabilities"
                  :key="`${c.provider}/${c.model}/${c.version}`"
                  :value="i"
                  :label="`${c.provider} / ${c.model} · v${c.version} · ${c.verified ? '已验证' : '未验证'}`"
                />
              </el-select>
              <span class="caption"
                >当前：{{ form.provider || "未选择" }} /
                {{ form.model || "未选择" }} · 版本
                {{ form.capabilityVersion ?? "—" }}</span
              >
            </el-form-item>
            <el-button
              v-if="isDraft && can('closet:creation:write')"
              type="primary"
              :loading="saving"
              @click="save"
              >保存草稿</el-button
            >
          </el-form>
          <el-divider />
          <el-form-item
            label="人工验证证据（至少 20 字，不填私人路径或图片地址）"
            ><el-input
              v-model="evidence"
              type="textarea"
              :rows="3"
              :disabled="!isDraft || !can('closet:creation:write')"
          /></el-form-item>
          <el-button
            v-if="isDraft && can('closet:creation:write')"
            :loading="saving"
            @click="verify"
            >记录验证</el-button
          >
          <el-button
            v-if="
              detail.status === 'VERIFIED' && can('closet:creation:publish')
            "
            type="primary"
            :loading="saving"
            :disabled="!canPublish"
            @click="publish"
            >发布版本</el-button
          >
          <p v-if="detail.status === 'VERIFIED' && !canPublish" class="caption">
            模型能力未验证或版本已变化，请核对后重新验证模板。
          </p> </el-card
        ><el-empty v-else description="选择一个版本查看详情"
      /></el-col>
    </el-row>
  </section>
</template>
<style scoped>
.creation-page {
  padding: 24px;
}
.caption {
  color: var(--el-text-color-secondary);
}
.content {
  margin-top: 20px;
}
.template-card {
  margin-bottom: 16px;
}
.row,
.version,
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row {
  justify-content: space-between;
}
.version {
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 8px;
}
.actions {
  margin-top: 16px;
}
.full {
  width: 100%;
}
@media (max-width: 600px) {
  .creation-page {
    padding: 16px;
  }
}
</style>
