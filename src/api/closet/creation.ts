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
  revision: number;
  enabled: boolean;
  sortOrder: number;
  publishedVersionId: string | null;
  versions: VersionSummary[];
};
export type VersionDetail = VersionSummary & {
  id: string;
  previewAssetId: string;
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
export type Capability = {
  provider: string;
  model: string;
  purpose: "ART_CREATION";
  maxReferences: number;
  verified: boolean;
  version: number;
  verifiedAt: number | null;
  providerRevision: string | null;
  notes: string;
  outputOptions: Record<string, unknown>;
  outputCount: number;
  pricingKey: string;
};
export type CapabilityEdit = Pick<
  Capability,
  | "provider"
  | "model"
  | "purpose"
  | "maxReferences"
  | "verified"
  | "version"
  | "notes"
  | "outputOptions"
>;
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
export const getCreationCapabilities = () =>
  http.request<ApiResponse<{ items: Capability[] }>>(
    "get",
    `${root}/capabilities`
  );
export const saveCreationCapability = (data: CapabilityEdit) =>
  http.request<ApiResponse<Capability>>("put", `${root}/capabilities`, {
    data
  });
