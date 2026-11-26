<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import { useCurrentPermissions } from "@/composables/useCurrentPermissions";
import { isClosetServiceUnavailable } from "@/api/closet/errors";
import {
  createEntry,
  createProvider,
  deleteEntry,
  deleteProvider,
  deleteRouting,
  editEntry,
  editProvider,
  getModels,
  probeProvider,
  putEntryReferences,
  putEntryTimeout,
  putRouting,
  resumeEntry,
  testEntry,
  type Capability,
  type ModelEntry,
  type ModelHealth,
  type ModelOverview,
  type ModelProtocol,
  type ModelProvider,
  type ProviderKind,
  type ReferenceOverLimit,
  type RoutingSlot
} from "@/api/closet/models";
import ClosetUnavailable from "../ClosetUnavailable.vue";
import { formatTime, useClosetRequest } from "../useClosetRequest";
import ModelUsage from "./ModelUsage.vue";

defineOptions({ name: "ClosetModels" });
const { can } = useCurrentPermissions();
const writable = computed(() => can("closet:models:write"));
const { loading, unavailable, errorMessage, run } = useClosetRequest();
const overview = ref<ModelOverview>();
const capabilities: Capability[] = ["VISION", "IMAGE", "CHAT"];
const routingSlots: RoutingSlot[] = [...capabilities, "PORTRAIT"];
const capabilityNames: Record<Capability, string> = {
  VISION: "识图",
  IMAGE: "生图",
  CHAT: "对话"
};
const routingNames: Record<RoutingSlot, string> = {
  ...capabilityNames,
  PORTRAIT: "形象图"
};
const descriptions: Record<RoutingSlot, string> = {
  VISION: "识图用于衣物识别、整套样本和穿搭收藏拆解。",
  IMAGE: "生图用于整理衣物照、上身图和创作。",
  CHAT: "对话用于鱼搭助手。",
  PORTRAIT: "生成‘我的形象’底图时用的模型。不单独选就跟随生图。"
};
const statusNames = {
  READY: "正常",
  NO_KEY: "缺密钥",
  KEY_UNREADABLE: "密钥无法解开",
  SHADOWED: "被部署配置覆盖"
};
const eventNames = {
  PAUSED: "暂停",
  RESUMED: "恢复",
  REROUTED: "改用备用",
  MANUAL_RESUME: "手动恢复"
};
const routingForms = reactive<
  Record<RoutingSlot, { active: string; fallback: string | null }>
>({
  VISION: { active: "", fallback: null },
  IMAGE: { active: "", fallback: null },
  CHAT: { active: "", fallback: null },
  PORTRAIT: { active: "", fallback: null }
});
const tab = ref<Capability>("VISION");
const pageTab = ref("config");
const busy = ref(false);
const load = () =>
  run(getModels, ({ data }) => {
    overview.value = data;
    for (const capability of routingSlots) {
      const routing = data.routing[capability];
      routingForms[capability] = {
        active: routing?.active ?? "",
        fallback: routing?.fallback ?? null
      };
    }
  });
const providerName = (id: string) =>
  overview.value?.providers.find(item => item.id === id)?.name ?? id;
const entryName = (id?: string | null) => {
  const entry = overview.value?.entries.find(item => item.id === id);
  return entry
    ? `${entry.label || entry.model} · ${providerName(entry.providerId)}`
    : id || "—";
};
const eligible = (capability: RoutingSlot) =>
  overview.value?.entries.filter(
    entry =>
      entry.capability === (capability === "PORTRAIT" ? "IMAGE" : capability) &&
      entry.enabled &&
      overview.value?.providers.some(
        provider =>
          provider.id === entry.providerId && provider.status === "READY"
      )
  ) ?? [];
const healthText = (health?: ModelHealth) => {
  if (!health) return "—";
  const state =
    health.state === "PAUSED"
      ? `暂停至 ${health.pausedUntilMs ? new Date(health.pausedUntilMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}${health.lastFailureCode ? ` · ${health.lastFailureCode}` : ""}`
      : "正常";
  return `${state}${health.consecutiveFailures > 0 ? ` · 连续失败 ${health.consecutiveFailures} 次` : ""}`;
};
const fail = (error: unknown, fallback: string) => {
  if (isClosetServiceUnavailable(error)) {
    unavailable.value = true;
    return;
  }
  const response = (
    error as {
      response?: {
        status?: number;
        data?: { code?: string; message?: string };
      };
    }
  )?.response;
  if (response?.status === 409) {
    message("这条记录刚被改过，已重新加载，请再改一次。", { type: "warning" });
    providerOpen.value = false;
    entryOpen.value = false;
    referencesOpen.value = false;
    timeoutOpen.value = false;
    void load();
  } else message(response?.data?.message || fallback, { type: "error" });
};
const mutate = async (action: () => Promise<unknown>, success = "已保存") => {
  if (busy.value || !writable.value) return false;
  busy.value = true;
  try {
    await action();
    message(success, { type: "success" });
    await load();
    return true;
  } catch (error) {
    fail(error, "操作失败，请重试");
    return false;
  } finally {
    busy.value = false;
  }
};
const confirm = async (text: string, title: string) => {
  try {
    await ElMessageBox.confirm(text, title, {
      type: "warning",
      confirmButtonText: "确定",
      cancelButtonText: "取消"
    });
    return true;
  } catch {
    return false;
  }
};
const saveRouting = async (capability: RoutingSlot) => {
  const form = routingForms[capability];
  if (!form.active || form.active === form.fallback) {
    message("请选择不同的生效模型和备用模型", { type: "warning" });
    return;
  }
  await mutate(() =>
    putRouting(capability, {
      active: form.active,
      fallback: form.fallback || null,
      revision: overview.value?.routing[capability]?.revision ?? 0
    })
  );
};
const followImage = async (value: string) => {
  if (value) return;
  if (overview.value?.routing.PORTRAIT?.followsImage) {
    routingForms.PORTRAIT.fallback = null;
    return;
  }
  if (!(await mutate(() => deleteRouting("PORTRAIT")))) {
    routingForms.PORTRAIT.active =
      overview.value?.routing.PORTRAIT?.active ?? "";
  }
};
const resetRouting = async (capability: Capability) => {
  if (
    await confirm(
      "将改回部署配置里的默认模型，并清除备用设置。",
      "恢复部署默认"
    )
  )
    await mutate(() => deleteRouting(capability));
};
const probe = async (id: string, suggestions = false) => {
  try {
    const { data } = await probeProvider(id);
    if (suggestions) modelSuggestions.value = data.models;
    await ElMessageBox.alert(
      data.ok
        ? `连接正常，找到 ${data.models.length} 个模型，用时 ${data.latencyMs} ms`
        : `连接失败，HTTP 状态：${data.httpStatus ?? "未知"}`,
      "测试连接"
    );
  } catch (error) {
    fail(error, "连接测试失败");
  }
};
const removeProvider = async (row: ModelProvider) => {
  if (await confirm(`确定删除服务商 ${row.name}？`, "删除服务商"))
    await mutate(() => deleteProvider(row.id), "已删除");
};
const removeEntry = async (row: ModelEntry) => {
  if (await confirm(`确定删除模型 ${row.label || row.model}？`, "删除模型"))
    await mutate(() => deleteEntry(row.id), "已删除");
};
const tryEntry = async (row: ModelEntry) => {
  if (row.capability === "IMAGE") return;
  if (
    !(await confirm(
      "会向上游发一次真实请求，可能产生少量费用，并计入全站模型预算。",
      "试一次"
    ))
  )
    return;
  try {
    const { data } = await testEntry(row.id);
    await ElMessageBox.alert(
      data.ok
        ? `请求成功，用时 ${data.latencyMs} ms`
        : `请求失败：${data.code || "未知"}`,
      "测试结果"
    );
    await load();
  } catch (error) {
    fail(error, "模型测试失败");
  }
};
const toggleEntry = async (
  row: ModelEntry,
  value: boolean | string | number
) => {
  await mutate(() =>
    editEntry(row.id, { enabled: Boolean(value), revision: row.revision })
  );
};

const referencesOpen = ref(false);
const referencesCurrent = ref<ModelEntry>();
const referencesForm = reactive<{
  maxReferenceImages: number | undefined;
  overLimit: ReferenceOverLimit;
}>({ maxReferenceImages: undefined, overLimit: "STITCH" });
const openReferences = (row: ModelEntry) => {
  if (!row.references) return;
  referencesCurrent.value = row;
  referencesForm.maxReferenceImages = row.references.customLimit ?? undefined;
  referencesForm.overLimit = row.references.overLimit;
  referencesOpen.value = true;
};
const saveReferences = async () => {
  const current = referencesCurrent.value;
  if (!current?.references) return;
  if (
    await mutate(() =>
      putEntryReferences(current.id, {
        maxReferenceImages: referencesForm.maxReferenceImages ?? null,
        overLimit: referencesForm.overLimit,
        revision: current.references!.revision
      })
    )
  )
    referencesOpen.value = false;
};

const timeoutOpen = ref(false);
const timeoutCurrent = ref<ModelEntry>();
const timeoutSeconds = ref<number>();
const openTimeout = (row: ModelEntry) => {
  if (row.capability === "CHAT" || !row.timeout) return;
  timeoutCurrent.value = row;
  timeoutSeconds.value = row.timeout.custom ?? undefined;
  timeoutOpen.value = true;
};
const saveTimeout = async () => {
  const current = timeoutCurrent.value;
  if (!current?.timeout || current.capability === "CHAT") return;
  const seconds = timeoutSeconds.value;
  if (
    seconds != null &&
    (!Number.isInteger(seconds) || seconds < 5 || seconds > 600)
  ) {
    message("请输入 5 到 600 之间的整数，或清空以跟随服务商", {
      type: "warning"
    });
    return;
  }
  if (
    await mutate(() =>
      putEntryTimeout(current.id, {
        timeoutSeconds: seconds ?? null,
        revision: current.timeout.revision
      })
    )
  )
    timeoutOpen.value = false;
};

const providerOpen = ref(false);
const providerCurrent = ref<ModelProvider>();
const preset = ref("");
const providerForm = reactive<{
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  timeoutSeconds: number;
  imageHosts: string[];
}>({
  id: "",
  name: "",
  kind: "OPENAI_COMPATIBLE",
  baseUrl: "",
  apiKey: "",
  timeoutSeconds: 180,
  imageHosts: []
});
const hostInput = ref("");
const openProvider = (row?: ModelProvider) => {
  providerCurrent.value = row;
  preset.value = "";
  hostInput.value = "";
  Object.assign(
    providerForm,
    row
      ? {
          id: row.id,
          name: row.name,
          kind: row.kind,
          baseUrl: row.baseUrl,
          apiKey: "",
          timeoutSeconds: row.timeoutSeconds,
          imageHosts: [...row.imageHosts]
        }
      : {
          id: "",
          name: "",
          kind: "OPENAI_COMPATIBLE",
          baseUrl: "",
          apiKey: "",
          timeoutSeconds: 180,
          imageHosts: []
        }
  );
  providerOpen.value = true;
};
const applyPreset = (value: string) => {
  if (!value) return;
  providerForm.kind = "OPENAI_COMPATIBLE";
  providerForm.baseUrl =
    value === "sg"
      ? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      : "https://dashscope.aliyuncs.com/compatible-mode/v1";
  providerForm.timeoutSeconds = 180;
  providerForm.imageHosts = [
    "dashscope-result-*.oss-*.aliyuncs.com",
    "dashscope-*.oss-accelerate.aliyuncs.com"
  ];
};
const addHost = () => {
  const host = hostInput.value.trim();
  if (host && !providerForm.imageHosts.includes(host))
    providerForm.imageHosts.push(host);
  hostInput.value = "";
};
const saveProvider = async () => {
  if (
    (!providerCurrent.value &&
      (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(providerForm.id) ||
        providerForm.id.startsWith("cfg") ||
        providerForm.apiKey.length < 8 ||
        providerForm.apiKey.length > 400)) ||
    !providerForm.name.trim() ||
    !providerForm.baseUrl.trim()
  ) {
    message("请填写有效的 ID、名称、地址和密钥（密钥至少 8 位）", {
      type: "warning"
    });
    return;
  }
  const common = {
    name: providerForm.name.trim(),
    baseUrl: providerForm.baseUrl.trim(),
    timeoutSeconds: providerForm.timeoutSeconds,
    imageHosts: providerForm.imageHosts,
    ...(providerForm.apiKey ? { apiKey: providerForm.apiKey } : {})
  };
  const current = providerCurrent.value;
  if (
    await mutate(() =>
      current
        ? editProvider(current.id, { ...common, revision: current.revision })
        : createProvider({
            ...common,
            id: providerForm.id,
            kind: providerForm.kind
          })
    )
  ) {
    providerForm.apiKey = "";
    providerOpen.value = false;
  }
};

const entryOpen = ref(false);
const entryCurrent = ref<ModelEntry>();
const modelSuggestions = ref<string[]>([]);
const entryForm = reactive<{
  capability: Capability;
  providerId: string;
  protocol: ModelProtocol;
  model: string;
  label: string;
  baseUrl: string;
  enabled: boolean;
  structuredOutput: string;
  maxOutputTokens: number;
  tokenParam: string;
  reasoningEffort: string;
  extraParams: string;
  maxReferenceImages: number | undefined;
  overLimit: ReferenceOverLimit;
  defaults: string;
}>({
  capability: "VISION",
  providerId: "",
  protocol: "OPENAI_CHAT",
  model: "",
  label: "",
  baseUrl: "",
  enabled: true,
  structuredOutput: "JSON_SCHEMA",
  maxOutputTokens: 4096,
  tokenParam: "max_completion_tokens",
  reasoningEffort: "",
  extraParams: "",
  maxReferenceImages: undefined,
  overLimit: "STITCH",
  defaults: ""
});
const protocols = computed<ModelProtocol[]>(() => {
  const kind = overview.value?.providers.find(
    p => p.id === entryForm.providerId
  )?.kind;
  if (kind === "GEMINI")
    return entryForm.capability === "CHAT" ? [] : ["GEMINI"];
  if (entryForm.capability === "VISION" || entryForm.capability === "CHAT")
    return ["OPENAI_CHAT"];
  return ["OPENAI_IMAGES", "DASHSCOPE_IMAGE"];
});
const protocolNames: Record<ModelProtocol, string> = {
  OPENAI_CHAT: "OpenAI Chat",
  OPENAI_IMAGES: "OpenAI Images",
  GEMINI: "Gemini",
  DASHSCOPE_IMAGE: "百炼 Qwen-Image"
};
const updateProtocol = () => {
  if (!protocols.value.includes(entryForm.protocol))
    entryForm.protocol = protocols.value[0] ?? "OPENAI_CHAT";
};
const openEntry = (row?: ModelEntry) => {
  entryCurrent.value = row;
  modelSuggestions.value = [];
  const options = row?.options ?? {};
  Object.assign(entryForm, {
    capability: row?.capability ?? tab.value,
    providerId: row?.providerId ?? overview.value?.providers[0]?.id ?? "",
    protocol: row?.protocol ?? "OPENAI_CHAT",
    model: row?.model ?? "",
    label: row?.label ?? "",
    baseUrl: row?.baseUrl ?? "",
    enabled: row?.enabled ?? true,
    structuredOutput: options.structuredOutput ?? "JSON_SCHEMA",
    maxOutputTokens: options.maxOutputTokens ?? 4096,
    tokenParam: options.tokenParam ?? "max_completion_tokens",
    reasoningEffort: options.reasoningEffort ?? "",
    extraParams: options.extraParams
      ? JSON.stringify(options.extraParams, null, 2)
      : "",
    maxReferenceImages: options.maxReferenceImages ?? undefined,
    overLimit: options.overLimit ?? "STITCH",
    defaults: options.defaults ? JSON.stringify(options.defaults, null, 2) : ""
  });
  if (!row) updateProtocol();
  entryOpen.value = true;
};
const jsonObject = (text: string): Record<string, unknown> | undefined => {
  if (!text.trim()) return undefined;
  const value: unknown = JSON.parse(text);
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error("JSON 必须是对象");
  return value as Record<string, unknown>;
};
const saveEntry = async () => {
  if (
    !entryForm.providerId ||
    !entryForm.model.trim() ||
    !protocols.value.includes(entryForm.protocol)
  ) {
    message("请填写服务商、协议和模型名", { type: "warning" });
    return;
  }
  let extra: Record<string, unknown> | undefined,
    defaults: Record<string, unknown> | undefined;
  try {
    extra = jsonObject(entryForm.extraParams);
    defaults = jsonObject(entryForm.defaults);
  } catch {
    message("扩展参数和默认参数必须是有效的 JSON 对象", { type: "warning" });
    return;
  }
  const options: Record<string, unknown> = {
    ...(entryCurrent.value?.options ?? {})
  };
  if (entryForm.protocol === "OPENAI_CHAT") {
    if (entryForm.capability === "VISION") {
      options.structuredOutput = entryForm.structuredOutput;
      options.maxOutputTokens = entryForm.maxOutputTokens;
    }
    options.tokenParam = entryForm.tokenParam;
    if (entryForm.reasoningEffort)
      options.reasoningEffort = entryForm.reasoningEffort;
    else delete options.reasoningEffort;
    if (extra) options.extraParams = extra;
    else delete options.extraParams;
  }
  if (entryForm.capability === "IMAGE") {
    if (entryForm.maxReferenceImages != null)
      options.maxReferenceImages = entryForm.maxReferenceImages;
    else delete options.maxReferenceImages;
    options.overLimit = entryForm.overLimit;
    if (defaults) options.defaults = defaults;
    else delete options.defaults;
  }
  const common = {
    label: entryForm.label.trim() || null,
    baseUrl: entryForm.baseUrl.trim() || null,
    options,
    enabled: entryForm.enabled
  };
  const current = entryCurrent.value;
  if (
    await mutate(() =>
      current
        ? editEntry(current.id, { ...common, revision: current.revision })
        : createEntry({
            ...common,
            capability: entryForm.capability,
            providerId: entryForm.providerId,
            protocol: entryForm.protocol,
            model: entryForm.model.trim()
          })
    )
  )
    entryOpen.value = false;
};
const keyParameters = (row: ModelEntry) => {
  const options = row.options;
  if (row.capability === "IMAGE")
    return `尺寸：${(options.defaults as Record<string, unknown> | undefined)?.size ?? "—"}`;
  return `${row.capability === "VISION" ? `输出：${options.structuredOutput ?? "JSON_SCHEMA"} · ` : ""}reasoning：${options.reasoningEffort ?? "不发送"}`;
};
onMounted(() => {
  void load();
});
</script>

<template>
  <div v-loading="loading" class="page-root space-y-4">
    <div>
      <h1 class="text-xl font-semibold">模型调配</h1>
      <p class="text-sm text-gray-500">
        为识图、生图、对话分别选择正在使用的模型和备用模型，管理上游平台的连接。
      </p>
    </div>
    <ClosetUnavailable v-if="unavailable" />
    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
    />
    <template v-if="overview && !unavailable">
      <el-tabs v-model="pageTab">
        <el-tab-pane label="配置" name="config" class="space-y-4">
          <el-alert
            v-if="!overview.masterKeyConfigured"
            title="未设置 CLOSET_MODEL_MASTER_KEY（或试穿主密钥 CLOSET_TRYON_MASTER_KEY），只能查看和切换部署配置里的模型，不能新增或更换带密钥的服务商。"
            type="warning"
            :closable="false"
            show-icon
          />
          <el-alert
            v-if="!overview.failoverEnabled"
            title="自动备用已在部署配置中关闭，生效模型失败时不会自动切换。"
            type="info"
            :closable="false"
            show-icon
          />
          <el-card>
            <template #header
              ><div>
                <h2 class="text-base">正在使用</h2>
                <p class="text-xs text-gray-500">
                  新任务立即使用这里选的模型；已经排队的任务继续用提交时的模型。生效模型连续失败
                  3 次会暂停 10
                  分钟，期间新任务和排队中的整理、识图任务改用备用，到期自动试回；上身图和创作不改用备用。上身图和创作跟随生图。
                </p>
              </div></template
            >
            <div class="routing-grid">
              <div
                v-for="capability in routingSlots"
                :key="capability"
                class="space-y-3"
              >
                <h3 class="font-medium">{{ routingNames[capability] }}</h3>
                <p class="text-xs text-gray-500">
                  {{ descriptions[capability] }}
                </p>
                <div>
                  生效模型
                  <el-select
                    v-model="routingForms[capability].active"
                    class="w-full"
                    :disabled="!writable || busy"
                    placeholder="请选择"
                    @change="capability === 'PORTRAIT' && followImage($event)"
                    ><el-option
                      v-if="capability === 'PORTRAIT'"
                      value=""
                      label="跟随生图" /><el-option
                      v-for="entry in eligible(capability)"
                      :key="entry.id"
                      :value="entry.id"
                      :label="entryName(entry.id)"
                  /></el-select>
                </div>
                <div>
                  备用模型
                  <el-select
                    v-model="routingForms[capability].fallback"
                    class="w-full"
                    :disabled="
                      !writable ||
                      busy ||
                      (capability === 'PORTRAIT' &&
                        !routingForms.PORTRAIT.active)
                    "
                    clearable
                    placeholder="不设备用"
                    ><el-option
                      v-for="entry in eligible(capability)"
                      :key="entry.id"
                      :value="entry.id"
                      :label="entryName(entry.id)"
                      :disabled="entry.id === routingForms[capability].active"
                  /></el-select>
                </div>
                <div>
                  实际在用：<template
                    v-if="
                      capability === 'PORTRAIT' &&
                      overview.routing.PORTRAIT?.followsImage
                    "
                    >跟随生图：</template
                  >{{
                    entryName(
                      capability === "PORTRAIT" &&
                        overview.routing.PORTRAIT?.followsImage
                        ? overview.routing.IMAGE?.effective
                        : overview.routing[capability]?.effective
                    )
                  }}
                  <el-tag
                    v-if="
                      !(
                        capability === 'PORTRAIT' &&
                        overview.routing.PORTRAIT?.followsImage
                      ) &&
                      overview.routing[capability]?.effective &&
                      overview.routing[capability]?.effective !==
                        overview.routing[capability]?.active
                    "
                    type="warning"
                    >已切到备用</el-tag
                  >
                </div>
                <div>
                  健康：{{
                    healthText(
                      overview.entries.find(
                        entry =>
                          entry.id ===
                          (capability === "PORTRAIT" &&
                          overview.routing.PORTRAIT?.followsImage
                            ? overview.routing.IMAGE?.active
                            : overview.routing[capability]?.active)
                      )?.health
                    )
                  }}
                </div>
                <div>
                  <el-button
                    type="primary"
                    :disabled="
                      !writable ||
                      busy ||
                      (capability === 'PORTRAIT' &&
                        !routingForms.PORTRAIT.active)
                    "
                    @click="saveRouting(capability)"
                    >保存</el-button
                  ><el-button
                    v-if="capability !== 'PORTRAIT'"
                    :disabled="
                      !writable ||
                      busy ||
                      !overview.routing[capability]?.configured
                    "
                    @click="resetRouting(capability)"
                    >恢复部署默认</el-button
                  >
                </div>
              </div>
            </div>
          </el-card>
          <el-card>
            <template #header
              ><div class="card-heading">
                <div>
                  <h2 class="text-base">服务商</h2>
                  <p class="text-xs text-gray-500">
                    一个服务商是一套上游平台的地址和密钥，可以同时给多类能力提供模型。来自部署配置的服务商只能查看。
                  </p>
                </div>
                <el-button
                  type="primary"
                  :disabled="!writable"
                  @click="openProvider()"
                  >新增服务商</el-button
                >
              </div></template
            >
            <el-table :data="overview.providers">
              <el-table-column label="名称" min-width="140"
                ><template #default="{ row }"
                  >{{ row.name }}
                  <div class="text-xs text-gray-500">
                    {{ row.id }}
                  </div></template
                ></el-table-column
              >
              <el-table-column label="类型" width="120"
                ><template #default="{ row }">{{
                  row.kind === "GEMINI" ? "Gemini" : "OpenAI 兼容"
                }}</template></el-table-column
              >
              <el-table-column
                prop="baseUrl"
                label="地址"
                min-width="190"
                show-overflow-tooltip
              /><el-table-column label="密钥"
                ><template #default="{ row }">{{
                  row.apiKeyHint || "未配置"
                }}</template></el-table-column
              >
              <el-table-column label="状态" width="130"
                ><template #default="{ row }">{{
                  statusNames[row.status as keyof typeof statusNames]
                }}</template></el-table-column
              >
              <el-table-column label="来源" width="100"
                ><template #default="{ row }"
                  ><el-tooltip
                    v-if="row.source === 'CONFIG'"
                    content="来自环境变量或部署配置文件，只能在部署时修改"
                    ><el-tag type="info">部署配置</el-tag></el-tooltip
                  ><el-tag v-else>后台添加</el-tag></template
                ></el-table-column
              >
              <el-table-column label="操作" width="230" fixed="right"
                ><template #default="{ row }"
                  ><el-button
                    link
                    type="primary"
                    :disabled="!writable"
                    @click="probe(row.id)"
                    >测试连接</el-button
                  ><el-button
                    v-if="row.editable"
                    link
                    type="primary"
                    :disabled="!writable"
                    @click="openProvider(row)"
                    >编辑</el-button
                  ><el-tooltip
                    :content="
                      row.source === 'CONFIG'
                        ? '部署配置不能删除'
                        : '先删除这个服务商下的模型'
                    "
                    :disabled="row.deletable"
                    ><span
                      ><el-button
                        link
                        type="danger"
                        :disabled="!writable || !row.deletable"
                        @click="removeProvider(row)"
                        >删除</el-button
                      ></span
                    ></el-tooltip
                  ></template
                ></el-table-column
              >
            </el-table>
          </el-card>
          <el-card>
            <template #header
              ><div class="card-heading">
                <div>
                  <h2 class="text-base">模型</h2>
                  <p class="text-xs text-gray-500">
                    每个模型属于一个服务商和一类能力。关闭的模型不能被选为生效或备用；对话里开启的模型会出现在用户的助手模型列表中。
                  </p>
                </div>
                <el-button
                  type="primary"
                  :disabled="!writable"
                  @click="openEntry()"
                  >新增模型</el-button
                >
              </div></template
            >
            <el-tabs v-model="tab"
              ><el-tab-pane
                v-for="capability in capabilities"
                :key="capability"
                :label="capabilityNames[capability]"
                :name="capability"
            /></el-tabs>
            <p v-if="tab === 'IMAGE'" class="help">
              上身图和创作跟随生图；形象图可单独选择模型。参考图超过上限时按每个模型的“参考图设置”处理。
            </p>
            <p v-if="tab === 'CHAT'" class="help">
              对话模型的等待由助手整轮时限控制。
            </p>
            <el-table
              :data="overview.entries.filter(entry => entry.capability === tab)"
            >
              <el-table-column label="名称" min-width="150"
                ><template #default="{ row }"
                  >{{ row.label || row.model }}
                  <div class="text-xs text-gray-500">
                    {{ row.model }}
                  </div></template
                ></el-table-column
              >
              <el-table-column label="服务商"
                ><template #default="{ row }">{{
                  providerName(row.providerId)
                }}</template></el-table-column
              ><el-table-column prop="protocol" label="协议" min-width="140" />
              <el-table-column label="关键参数" min-width="210"
                ><template #default="{ row }">{{
                  keyParameters(row)
                }}</template></el-table-column
              >
              <el-table-column
                v-if="tab === 'IMAGE'"
                label="参考图"
                min-width="210"
              >
                <template #default="{ row }">
                  <template v-if="row.references">
                    最多 {{ row.references.limit }} 张<span
                      v-if="row.references.customLimit == null"
                      class="text-gray-500"
                      >（默认）</span
                    >
                    · 超出{{
                      row.references.overLimit === "STITCH" ? "拼图" : "报错"
                    }}
                  </template>
                </template>
              </el-table-column>
              <el-table-column
                v-if="tab !== 'CHAT'"
                label="等待上限"
                min-width="170"
              >
                <template #default="{ row }">
                  <template v-if="row.timeout">
                    {{ row.timeout.seconds }} 秒<span
                      v-if="row.timeout.custom == null"
                      class="text-gray-500"
                      >（跟随服务商）</span
                    >
                  </template>
                </template>
              </el-table-column>
              <el-table-column label="路由" width="90"
                ><template #default="{ row }">{{
                  row.inUse === "ACTIVE"
                    ? "生效"
                    : row.inUse === "FALLBACK"
                      ? "备用"
                      : row.inUse === "PORTRAIT_ACTIVE"
                        ? "形象图生效"
                        : row.inUse === "PORTRAIT_FALLBACK"
                          ? "形象图备用"
                          : "—"
                }}</template></el-table-column
              >
              <el-table-column label="开启" width="75"
                ><template #default="{ row }"
                  ><el-switch
                    :model-value="row.enabled"
                    :disabled="!writable || !row.editable || busy"
                    @change="toggleEntry(row, $event)" /></template
              ></el-table-column>
              <el-table-column label="健康" min-width="150"
                ><template #default="{ row }">{{
                  healthText(row.health)
                }}</template></el-table-column
              >
              <el-table-column label="来源" width="100"
                ><template #default="{ row }"
                  ><el-tag
                    :type="row.source === 'CONFIG' ? 'info' : 'primary'"
                    >{{
                      row.source === "CONFIG" ? "部署配置" : "后台添加"
                    }}</el-tag
                  ></template
                ></el-table-column
              >
              <el-table-column label="操作" width="300" fixed="right"
                ><template #default="{ row }"
                  ><el-button
                    v-if="row.capability === 'IMAGE'"
                    link
                    type="primary"
                    :disabled="!writable || busy || !row.references"
                    @click="openReferences(row)"
                    >参考图设置</el-button
                  ><el-button
                    v-if="row.capability !== 'CHAT'"
                    link
                    type="primary"
                    :disabled="!writable || busy || !row.timeout"
                    @click="openTimeout(row)"
                    >等待上限</el-button
                  ><el-button
                    v-if="row.capability !== 'IMAGE'"
                    link
                    type="primary"
                    :disabled="!writable"
                    @click="tryEntry(row)"
                    >试一次</el-button
                  ><el-button
                    v-if="row.health.state === 'PAUSED'"
                    link
                    type="primary"
                    :disabled="!writable"
                    @click="mutate(() => resumeEntry(row.id), '已恢复')"
                    >恢复</el-button
                  ><el-button
                    v-if="row.editable"
                    link
                    type="primary"
                    :disabled="!writable"
                    @click="openEntry(row)"
                    >编辑</el-button
                  ><el-tooltip
                    :content="
                      row.source === 'CONFIG'
                        ? '部署配置不能删除'
                        : '正在被选为生效或备用（含形象图）的模型不能删除'
                    "
                    :disabled="row.deletable"
                    ><span
                      ><el-button
                        link
                        type="danger"
                        :disabled="!writable || !row.deletable"
                        @click="removeEntry(row)"
                        >删除</el-button
                      ></span
                    ></el-tooltip
                  ></template
                ></el-table-column
              >
            </el-table>
          </el-card>
          <el-card>
            <template #header
              ><div>
                <h2 class="text-base">最近切换记录</h2>
                <p class="text-xs text-gray-500">
                  自动暂停、恢复和执行前改道的记录，只保留进程内最近 20
                  条，重启后清空。
                </p>
              </div></template
            >
            <el-table :data="overview.events"
              ><el-table-column label="时间" min-width="160"
                ><template #default="{ row }">{{
                  formatTime(row.atMs)
                }}</template></el-table-column
              ><el-table-column label="能力"
                ><template #default="{ row }">{{
                  capabilityNames[row.capability as Capability]
                }}</template></el-table-column
              ><el-table-column label="模型" min-width="180"
                ><template #default="{ row }">{{
                  entryName(row.entryId)
                }}</template></el-table-column
              ><el-table-column label="事件"
                ><template #default="{ row }">{{
                  eventNames[row.kind as keyof typeof eventNames]
                }}</template></el-table-column
              ><el-table-column label="原因 / 改用模型" min-width="180"
                ><template #default="{ row }">{{
                  row.kind === "REROUTED"
                    ? entryName(row.code)
                    : row.code || "—"
                }}</template></el-table-column
              >
            </el-table>
          </el-card>
        </el-tab-pane>
        <el-tab-pane label="调用与消耗" name="usage" lazy>
          <ModelUsage :providers="overview.providers" />
        </el-tab-pane>
      </el-tabs>
    </template>
    <el-dialog
      v-model="providerOpen"
      :title="providerCurrent ? '编辑服务商' : '新增服务商'"
      width="min(640px, 95vw)"
      @closed="providerForm.apiKey = ''"
    >
      <el-form label-position="top">
        <el-form-item v-if="!providerCurrent" label="预设"
          ><el-select v-model="preset" @change="applyPreset"
            ><el-option label="不使用预设" value="" /><el-option
              label="阿里云百炼（北京）"
              value="bj" /><el-option label="阿里云百炼（新加坡）" value="sg"
          /></el-select>
          <p class="help">北京和新加坡的密钥不通用。</p></el-form-item
        >
        <el-form-item v-if="!providerCurrent" label="ID"
          ><el-input
            v-model="providerForm.id"
            placeholder="小写字母、数字或短横线，2～32 位"
          />
          <p class="help">创建后不能修改，任务记录里会用到。</p></el-form-item
        >
        <el-form-item label="名称"
          ><el-input v-model="providerForm.name" maxlength="60"
        /></el-form-item>
        <el-form-item label="类型"
          ><el-select v-model="providerForm.kind" :disabled="!!providerCurrent"
            ><el-option
              label="OpenAI 兼容"
              value="OPENAI_COMPATIBLE" /><el-option
              label="Gemini"
              value="GEMINI" /></el-select
        ></el-form-item>
        <el-form-item label="地址"
          ><el-input v-model="providerForm.baseUrl" /></el-form-item
        ><el-form-item label="密钥"
          ><el-input
            v-model="providerForm.apiKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="providerCurrent ? '留空则不更换' : '请输入密钥'"
        /></el-form-item>
        <el-form-item label="超时秒数"
          ><el-input-number
            v-model="providerForm.timeoutSeconds"
            :min="1"
            :max="600"
        /></el-form-item>
        <el-form-item label="可信图片域名"
          ><div class="host-list">
            <el-tag
              v-for="host in providerForm.imageHosts"
              :key="host"
              closable
              @close="
                providerForm.imageHosts = providerForm.imageHosts.filter(
                  item => item !== host
                )
              "
              >{{ host }}</el-tag
            >
          </div>
          <el-input
            v-model="hostInput"
            placeholder="输入域名后按回车"
            @keydown.enter.prevent="addHost"
          /><el-button @click="addHost">添加域名</el-button>
          <p class="help">
            上游返回图片地址而不是图片数据时，只从这些域名下载；* 只匹配一段。
          </p></el-form-item
        > </el-form
      ><template #footer
        ><el-button @click="providerOpen = false">取消</el-button
        ><el-button type="primary" :loading="busy" @click="saveProvider"
          >保存</el-button
        ></template
      >
    </el-dialog>
    <el-dialog
      v-model="entryOpen"
      :title="entryCurrent ? '编辑模型' : '新增模型'"
      width="min(680px, 95vw)"
    >
      <el-form label-position="top">
        <p v-if="!entryCurrent" class="help">
          百炼推荐填法：{{
            entryForm.capability === "VISION"
              ? "qwen3-vl-plus + JSON 对象 + 不发送 reasoning"
              : entryForm.capability === "CHAT"
                ? "qwen-plus + 不发送 reasoning"
                : "qwen-image-2.1-pro + 百炼 Qwen-Image + 地址覆盖"
          }}
        </p>
        <el-form-item label="能力"
          ><el-select
            v-model="entryForm.capability"
            :disabled="!!entryCurrent"
            @change="updateProtocol"
            ><el-option
              v-for="capability in capabilities"
              :key="capability"
              :label="capabilityNames[capability]"
              :value="capability" /></el-select
        ></el-form-item>
        <el-form-item label="服务商"
          ><el-select
            v-model="entryForm.providerId"
            :disabled="!!entryCurrent"
            @change="updateProtocol"
            ><el-option
              v-for="provider in overview?.providers"
              :key="provider.id"
              :label="provider.name"
              :value="provider.id" /></el-select
        ></el-form-item>
        <el-form-item label="协议"
          ><el-select v-model="entryForm.protocol" :disabled="!!entryCurrent"
            ><el-option
              v-for="protocol in protocols"
              :key="protocol"
              :label="protocolNames[protocol]"
              :value="protocol" /></el-select
        ></el-form-item>
        <el-form-item label="模型名"
          ><el-autocomplete
            v-model="entryForm.model"
            :disabled="!!entryCurrent"
            :fetch-suggestions="
              (query: string, cb: (items: { value: string }[]) => void) =>
                cb(
                  modelSuggestions
                    .filter(item =>
                      item.toLowerCase().includes(query.toLowerCase())
                    )
                    .map(value => ({ value }))
                )
            "
          /><el-button
            v-if="!entryCurrent"
            :disabled="!entryForm.providerId"
            @click="probe(entryForm.providerId, true)"
            >从上游列出</el-button
          ></el-form-item
        >
        <el-form-item label="显示名"
          ><el-input v-model="entryForm.label" maxlength="60" /></el-form-item
        ><el-form-item label="地址覆盖"
          ><el-input v-model="entryForm.baseUrl" />
          <p class="help">
            留空使用服务商地址；百炼生图要填
            https://dashscope.aliyuncs.com/api/v1
          </p></el-form-item
        >
        <template v-if="entryForm.protocol === 'OPENAI_CHAT'"
          ><template v-if="entryForm.capability === 'VISION'"
            ><el-form-item label="输出方式"
              ><el-select v-model="entryForm.structuredOutput"
                ><el-option
                  label="严格 JSON Schema"
                  value="JSON_SCHEMA" /><el-option
                  label="JSON 对象（百炼 Qwen-VL 选这个）"
                  value="JSON_OBJECT" /></el-select></el-form-item
            ><el-form-item label="最大输出 token"
              ><el-input-number
                v-model="entryForm.maxOutputTokens"
                :min="512"
                :max="16384" /></el-form-item
          ></template>
          <el-form-item label="token 参数名"
            ><el-select v-model="entryForm.tokenParam"
              ><el-option
                label="max_completion_tokens"
                value="max_completion_tokens" /><el-option
                label="max_tokens"
                value="max_tokens"
            /></el-select>
            <p v-if="entryForm.capability === 'CHAT'" class="help">
              对话模型的 token 参数名只影响“试一次”，不影响用户助手对话。
            </p></el-form-item
          ><el-form-item label="reasoning"
            ><el-select v-model="entryForm.reasoningEffort"
              ><el-option label="不发送" value="" /><el-option
                v-for="level in ['none', 'minimal', 'low', 'medium', 'high']"
                :key="level"
                :label="level"
                :value="level" /></el-select></el-form-item
          ><el-form-item label="扩展参数"
            ><el-input
              v-model="entryForm.extraParams"
              type="textarea"
              :rows="3"
              placeholder='例如 {"enable_thinking": false}'
          /></el-form-item>
        </template>
        <template v-if="entryForm.capability === 'IMAGE'"
          ><el-form-item label="参考图上限"
            ><el-input-number
              v-model="entryForm.maxReferenceImages"
              :min="1"
              :max="20"
              :step="1"
              step-strictly
              placeholder="使用协议默认值"
            />
            <p class="help">
              按服务商文档填写。例如百炼 Qwen-Image 3.0 是 3 张，2.1 是 10 张。
            </p></el-form-item
          ><el-form-item label="超出时">
            <el-radio-group v-model="entryForm.overLimit">
              <el-radio value="STITCH">拼成一张编号拼图再传（推荐）</el-radio>
              <el-radio value="REJECT">直接报错，不生成</el-radio>
            </el-radio-group>
            <p class="help">
              拼图会把多出来的衣物缩小放进一张图，单件细节会变弱；上限够用时不会拼。
            </p> </el-form-item
          ><el-form-item label="默认参数"
            ><el-input
              v-model="entryForm.defaults"
              type="textarea"
              :rows="3"
              placeholder='例如 {"size": "1024*1024"}' /></el-form-item
        ></template>
        <el-form-item label="开启"
          ><el-switch v-model="entryForm.enabled"
        /></el-form-item> </el-form
      ><template #footer
        ><el-button @click="entryOpen = false">取消</el-button
        ><el-button type="primary" :loading="busy" @click="saveEntry"
          >保存</el-button
        ></template
      >
    </el-dialog>
    <el-dialog
      v-model="referencesOpen"
      title="参考图设置"
      width="min(600px, 95vw)"
    >
      <el-form label-position="top">
        <el-form-item label="单次最多参考图">
          <el-input-number
            v-model="referencesForm.maxReferenceImages"
            :min="1"
            :max="20"
            :step="1"
            step-strictly
            :placeholder="`默认 ${referencesCurrent?.references?.defaultLimit} 张`"
          />
          <p class="help">
            按服务商文档填写。例如百炼 Qwen-Image 3.0 是 3 张，2.1 是 10 张。
          </p>
        </el-form-item>
        <el-form-item label="超出时">
          <el-radio-group v-model="referencesForm.overLimit">
            <el-radio value="STITCH">拼成一张编号拼图再传（推荐）</el-radio>
            <el-radio value="REJECT">直接报错，不生成</el-radio>
          </el-radio-group>
          <p class="help">
            拼图会把多出来的衣物缩小放进一张图，单件细节会变弱；上限够用时不会拼。
          </p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="referencesOpen = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="saveReferences"
          >保存</el-button
        >
      </template>
    </el-dialog>
    <el-dialog v-model="timeoutOpen" title="等待上限" width="min(600px, 95vw)">
      <el-form label-position="top">
        <el-form-item label="等待上限（秒）">
          <el-input-number
            v-model="timeoutSeconds"
            :min="5"
            :max="600"
            :step="1"
            step-strictly
            :placeholder="`跟随服务商：${timeoutCurrent?.timeout?.providerSeconds} 秒`"
          />
          <p class="help">
            超过这个时间还没返回就算超时（PROVIDER_TIMEOUT）。超时不代表服务商已经取消，可能照样计费；建议设成这个模型平时
            P95 耗时的 1.5～2 倍。
          </p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="timeoutOpen = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!writable"
          :loading="busy"
          @click="saveTimeout"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.card-heading {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.routing-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.5rem;
}

.help {
  width: 100%;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.host-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
}

@media (width <= 900px) {
  .routing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
