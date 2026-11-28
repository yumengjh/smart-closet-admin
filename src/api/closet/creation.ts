import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

// P1 draft 3f01e97b; align with the published OpenAPI before integration.
export type CreationUsageRow = {
  templateId: string;
  templateVersion: number;
  provider: string;
  model: string;
  currency: string | null;
  requests: number;
  dispatchedAttempts: number;
  succeeded: number;
  failed: number;
  unknown: number;
  recreates: number;
  recreateRatio: number | null;
  estimatedCostMicro: number | null;
  unknownCostAttempts: number;
};
export type CreationUsage = {
  from: string;
  to: string;
  timeZone: string;
  asOfMs: number;
  items: CreationUsageRow[];
};
export const getCreationUsage = (from: string, to: string) =>
  http.request<ApiResponse<CreationUsage>>("get", "/closet/creations/usage", {
    params: { from, to }
  });

export type VersionSummary = {
  versionId: string;
  version: number;
  revision: number;
  status: "DRAFT" | "VERIFIED" | "PUBLISHED" | "RETIRED";
  name: string;
  description: string;
  personRequired: boolean;
  maxGarments: number;
  publishedAtMs: number | null;
};
export type TemplateSummary = {
  id: string;
  name: string;
  revision: number;
  enabled: boolean;
  sortOrder: number;
  publishedVersionId: string | null;
  versions: VersionSummary[];
  /** 起步示例；空白新建为 null。 */
  sampleKey: string | null;
  /** 线上版本（否则最新草稿）示意图的直连缩略图；为空时走 preview-image。 */
  previewUrl?: string | null;
};
export type VersionDetail = VersionSummary & {
  id: string;
  previewAssetId: string;
  previewImage: boolean;
  /** 示意图直连缩略图（存储桶 / CDN）；为空时走 preview-image。 */
  previewUrl?: string | null;
  options: { light: string[] };
  prompt: string;
  provider: string | null;
  model: string | null;
  capabilityVersion: number | null;
  evidence: string | null;
};
export type VersionEdit = Pick<
  VersionDetail,
  | "revision"
  | "name"
  | "description"
  | "previewAssetId"
  | "personRequired"
  | "maxGarments"
  | "options"
  | "prompt"
  | "provider"
  | "model"
  | "capabilityVersion"
>;
export type CreationGenerationOption = {
  provider: string;
  model: string;
  protocol: string;
};
export type CreationGenerationOptions = {
  defaultSelection: { provider: string; model: string } | null;
  providers: CreationGenerationOption[];
};
const root = "/closet/creations";
const template = (id: string) => `${root}/templates/${encodeURIComponent(id)}`;
const version = (id: string, v: string) =>
  `${template(id)}/versions/${encodeURIComponent(v)}`;
export const getCreationTemplates = () =>
  http.request<ApiResponse<{ items: TemplateSummary[] }>>(
    "get",
    `${root}/templates`
  );
export const getCreationVersion = (id: string, v: string) =>
  http.request<ApiResponse<VersionDetail>>("get", version(id, v));
export const createCreationVersion = (
  id: string,
  fromVersionId: string | null
) =>
  http.request<ApiResponse<VersionDetail>>("post", `${template(id)}/versions`, {
    data: { fromVersionId }
  });
export const saveCreationVersion = (id: string, v: string, data: VersionEdit) =>
  http.request<ApiResponse<VersionDetail>>("put", version(id, v), { data });
export const verifyCreationVersion = (
  id: string,
  v: string,
  revision: number,
  evidence: string
) =>
  http.request<ApiResponse<VersionDetail>>("post", `${version(id, v)}/verify`, {
    data: { revision, evidence }
  });
export const publishCreationVersion = (
  id: string,
  v: string,
  revision: number
) =>
  http.request<ApiResponse<VersionDetail>>(
    "post",
    `${version(id, v)}/publish`,
    { data: { revision } }
  );
export const retireCreationTemplate = (id: string, revision: number) =>
  http.request<ApiResponse<unknown>>("post", `${template(id)}/retire`, {
    data: { revision }
  });
export const getCreationGenerationOptions = () =>
  http.request<ApiResponse<CreationGenerationOptions>>(
    "get",
    `${root}/generation-options`
  );

export type TrialGarment = {
  id: string;
  name: string;
  role: string;
  gender: string;
  /** 直连缩略图；为空时走图片接口。 */
  imageUrl?: string | null;
};
export type TrialPerson = {
  id: string;
  note: string;
  width: number;
  height: number;
  createdAtMs: number;
  /** 5 分钟有效的直连链接；为空时走图片接口。 */
  imageUrl?: string | null;
};
export type TrialLight = "DEFAULT" | "WARM" | "COOL";
export type TrialStart = {
  revision: number;
  garmentIds: string[];
  personId?: string | null;
  light?: TrialLight;
  pose?: string | null;
};
export type Trial = {
  id: string;
  templateId: string;
  versionId: string;
  versionRevision: number;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  provider: string;
  model: string;
  garmentCount: number;
  withPerson: boolean;
  light: string;
  pose: string | null;
  errorMessage: string | null;
  width: number | null;
  height: number | null;
  /** 模型、提示词、是否需要人物与当前草稿一致，可用于上线。 */
  current: boolean;
  /** 当前草稿的示意图来自这次试做。 */
  preview?: boolean;
  createdAtMs: number;
  finishedAtMs: number | null;
  /** 原图直连（放大看）与列表缩略图直连；为空时走图片接口。 */
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
};
export type UseTrial = { revision?: number; trialId: string };
const trialImage = (path: string) =>
  http.request<Blob>("get", `${root}/${path}/image`, { responseType: "blob" });
const uuid = encodeURIComponent;
export const getTrialGarments = () =>
  http.request<ApiResponse<{ items: TrialGarment[] }>>(
    "get",
    `${root}/trial-garments`
  );
export const getTrialGarmentImage = (id: string) =>
  trialImage(`trial-garments/${uuid(id)}`);
export const getTrialPersons = () =>
  http.request<ApiResponse<{ items: TrialPerson[] }>>(
    "get",
    `${root}/trial-persons`
  );
export const uploadTrialPerson = (file: File, sourceNote: string) => {
  const data = new FormData();
  data.append("file", file);
  data.append("sourceNote", sourceNote);
  return http.request<ApiResponse<TrialPerson>>(
    "post",
    `${root}/trial-persons`,
    { data, headers: { "Content-Type": undefined }, timeout: 60000 }
  );
};
export const getTrialPersonImage = (id: string) =>
  trialImage(`trial-persons/${uuid(id)}`);
export const deleteTrialPerson = (id: string) =>
  http.request<ApiResponse<{ deleted: boolean }>>(
    "delete",
    `${root}/trial-persons/${uuid(id)}`
  );
export const startCreationTrial = (id: string, v: string, data: TrialStart) =>
  http.request<ApiResponse<Trial>>("post", `${version(id, v)}/trials`, {
    data
  });
export const getCreationTrials = (id: string) =>
  http.request<ApiResponse<{ items: Trial[] }>>(
    "get",
    `${template(id)}/trials`
  );
export const getCreationTrial = (trialId: string) =>
  http.request<ApiResponse<Trial>>("get", `${root}/trials/${uuid(trialId)}`);
export const getCreationTrialImage = (trialId: string) =>
  trialImage(`trials/${uuid(trialId)}`);
export const setCreationPreview = (id: string, v: string, data: UseTrial) =>
  http.request<ApiResponse<VersionDetail>>(
    "post",
    `${version(id, v)}/preview`,
    {
      data
    }
  );
export const launchCreationVersion = (id: string, v: string, data: UseTrial) =>
  http.request<ApiResponse<VersionDetail>>("post", `${version(id, v)}/launch`, {
    data
  });
export const getCreationPreviewImage = (id: string, v: string) =>
  http.request<Blob>("get", `${version(id, v)}/preview-image`, {
    responseType: "blob"
  });
export type PromptSample = {
  key: string;
  name: string;
  description: string;
  personRequired: boolean;
  maxGarments: number;
  light: string[];
  prompt: string;
};
export type NewEffect = {
  name: string;
  description?: string;
  personRequired: boolean;
  maxGarments?: number;
  light?: string[];
  prompt?: string;
  sampleKey?: string;
};
export const getCreationPromptSamples = () =>
  http.request<ApiResponse<{ items: PromptSample[] }>>(
    "get",
    `${root}/prompt-samples`
  );
export const createCreationEffect = (data: NewEffect) =>
  http.request<ApiResponse<VersionDetail & { id: string }>>(
    "post",
    `${root}/templates`,
    { data }
  );
export const deleteCreationEffect = (id: string) =>
  http.request<ApiResponse<{ deleted: boolean }>>("delete", template(id));
export const reorderCreationEffects = (ids: string[]) =>
  http.request<ApiResponse<{ items: TemplateSummary[] }>>(
    "put",
    `${root}/templates/order`,
    { data: { ids } }
  );

/** 用户端“做张图”是否能选创作效果：override 为空时跟随部署配置。 */
export type CreationSettings = {
  userEnabled: boolean;
  override: boolean | null;
  deploymentDefault: boolean;
};
export const getCreationSettings = () =>
  http.request<ApiResponse<CreationSettings>>("get", `${root}/settings`);
export const putCreationSettings = (userEnabled: boolean | null) =>
  http.request<ApiResponse<CreationSettings>>("put", `${root}/settings`, {
    data: { userEnabled }
  });
