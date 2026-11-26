import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type Capability = "VISION" | "IMAGE" | "CHAT";
export type RoutingSlot = Capability | "PORTRAIT";
export type ProviderKind = "OPENAI_COMPATIBLE" | "GEMINI";
export type ModelProtocol =
  | "OPENAI_CHAT"
  | "OPENAI_IMAGES"
  | "GEMINI"
  | "DASHSCOPE_IMAGE";
export type ModelSource = "CONFIG" | "DATABASE";
export type ReferenceOverLimit = "STITCH" | "REJECT";
export type ModelReferences = {
  limit: number;
  defaultLimit: number;
  customLimit: number | null;
  overLimit: ReferenceOverLimit;
  revision: number;
};
export type ModelTimeout = {
  seconds: number;
  custom: number | null;
  providerSeconds: number;
  appliesToChat: boolean;
  revision: number;
};
export type ModelHealth = {
  state: "OK" | "PAUSED";
  consecutiveFailures: number;
  lastFailureCode: string | null;
  lastFailureAtMs: number | null;
  pausedUntilMs: number | null;
  lastSuccessAtMs: number | null;
};
export type ModelProvider = {
  id: string;
  name: string;
  kind: ProviderKind;
  source: ModelSource;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyHint: string | null;
  timeoutSeconds: number;
  imageHosts: string[];
  status: "READY" | "NO_KEY" | "KEY_UNREADABLE" | "SHADOWED";
  revision: number;
  deletable: boolean;
  editable: boolean;
};
export type ModelEntry = {
  id: string;
  capability: Capability;
  providerId: string;
  protocol: ModelProtocol;
  model: string;
  label: string | null;
  baseUrl: string | null;
  options: Record<string, unknown>;
  enabled: boolean;
  source: ModelSource;
  revision: number;
  inUse: "ACTIVE" | "FALLBACK" | "PORTRAIT_ACTIVE" | "PORTRAIT_FALLBACK" | null;
  deletable: boolean;
  editable: boolean;
  references?: ModelReferences;
  timeout: ModelTimeout;
  health: ModelHealth;
};
export type ModelRouting = {
  active: string | null;
  fallback: string | null;
  effective: string | null;
  configured: boolean;
  followsImage?: boolean;
  revision: number;
  updatedAtMs: number | null;
};
export type ModelOverview = {
  masterKeyConfigured: boolean;
  failoverEnabled: boolean;
  providers: ModelProvider[];
  entries: ModelEntry[];
  routing: Partial<Record<RoutingSlot, ModelRouting>>;
  events: {
    atMs: number;
    capability: Capability;
    entryId: string;
    kind: "PAUSED" | "RESUMED" | "REROUTED" | "MANUAL_RESUME";
    code: string | null;
  }[];
};
export type ProviderCreate = {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey?: string;
  timeoutSeconds: number;
  imageHosts: string[];
};
export type ProviderEdit = Omit<ProviderCreate, "id" | "kind"> & {
  revision: number;
};
export type EntryCreate = {
  capability: Capability;
  providerId: string;
  protocol: ModelProtocol;
  model: string;
  label: string | null;
  baseUrl: string | null;
  options: Record<string, unknown>;
  enabled: boolean;
};
export type EntryEdit = Pick<
  EntryCreate,
  "label" | "baseUrl" | "options" | "enabled"
> & { revision: number };
export type ProbeResult = {
  ok: boolean;
  httpStatus: number | null;
  models: string[];
  latencyMs: number;
};
export type ModelTestResult = {
  ok: boolean;
  code: string | null;
  latencyMs: number;
};

const root = "/closet/models";
const part = (id: string) => encodeURIComponent(id);
export const getModels = () =>
  http.request<ApiResponse<ModelOverview>>("get", root);
export const createProvider = (data: ProviderCreate) =>
  http.request<ApiResponse<ModelProvider>>("post", `${root}/providers`, {
    data
  });
export const editProvider = (id: string, data: ProviderEdit) =>
  http.request<ApiResponse<ModelProvider>>(
    "patch",
    `${root}/providers/${part(id)}`,
    { data }
  );
export const deleteProvider = (id: string) =>
  http.request<ApiResponse<void>>("delete", `${root}/providers/${part(id)}`);
export const probeProvider = (id: string) =>
  http.request<ApiResponse<ProbeResult>>(
    "post",
    `${root}/providers/${part(id)}/probe`,
    { timeout: 190000 }
  );
export const createEntry = (data: EntryCreate) =>
  http.request<ApiResponse<ModelEntry>>("post", `${root}/entries`, { data });
export const editEntry = (
  id: string,
  data: Partial<EntryEdit> & { revision: number }
) =>
  http.request<ApiResponse<ModelEntry>>(
    "patch",
    `${root}/entries/${part(id)}`,
    { data }
  );
export const putEntryReferences = (
  id: string,
  data: {
    maxReferenceImages: number | null;
    overLimit: ReferenceOverLimit | null;
    revision: number;
  }
) =>
  http.request<ApiResponse<ModelEntry>>(
    "put",
    `${root}/entries/${part(id)}/references`,
    { data }
  );
export const putEntryTimeout = (
  id: string,
  data: { timeoutSeconds: number | null; revision: number }
) =>
  http.request<ApiResponse<ModelEntry>>(
    "put",
    `${root}/entries/${part(id)}/timeout`,
    { data }
  );
export const deleteEntry = (id: string) =>
  http.request<ApiResponse<void>>("delete", `${root}/entries/${part(id)}`);
export const resumeEntry = (id: string) =>
  http.request<ApiResponse<ModelEntry>>(
    "post",
    `${root}/entries/${part(id)}/resume`
  );
export const testEntry = (id: string) =>
  http.request<ApiResponse<ModelTestResult>>(
    "post",
    `${root}/entries/${part(id)}/test`,
    { timeout: 190000 }
  );
export const putRouting = (
  capability: RoutingSlot,
  data: { active: string; fallback: string | null; revision: number }
) =>
  http.request<ApiResponse<ModelRouting>>(
    "put",
    `${root}/routing/${capability}`,
    { data }
  );
export const deleteRouting = (capability: RoutingSlot) =>
  http.request<ApiResponse<ModelRouting>>(
    "delete",
    `${root}/routing/${capability}`
  );
