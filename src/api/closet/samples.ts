import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type SampleStatus =
  | "PENDING"
  | "EXTRACTED"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";
export type SampleLicense =
  | "OWN"
  | "PERMITTED"
  | "OPEN"
  | "RESEARCH"
  | "UNKNOWN";
export type SampleDecision = "APPROVED" | "REJECTED";

export type OutfitSample = {
  id: string;
  status: SampleStatus | string;
  sourceUrl: string;
  license: SampleLicense | string;
  note: string;
  hasImage: boolean;
  extractorVersion: string | null;
  model: string | null;
  extraction: Record<string, unknown> | null;
  reviewed: Record<string, unknown> | null;
  error: string | null;
  rejectReason: string | null;
  presentation: string | null;
  createdBy: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  reviewedBy: string | null;
  reviewedAtMs: number | null;
  templateId: string | null;
};
export type SampleStats = {
  approved: number;
  byStatus: Record<string, number>;
  presentation: Record<string, number>;
  [key: string]: unknown;
};
export type SampleUpload = {
  image: File;
  sourceUrl?: string;
  license?: SampleLicense;
  note?: string;
};

const root = "/closet/samples";
const item = (id: string) => `${root}/${encodeURIComponent(id)}`;

export const getSamples = (params: { status?: string; limit?: number }) =>
  http.request<ApiResponse<{ items: OutfitSample[] }>>("get", root, { params });
export const getSampleStats = (presentation?: string) =>
  http.request<ApiResponse<SampleStats>>("get", `${root}/stats`, {
    params: { presentation }
  });
export const uploadSample = (input: SampleUpload) => {
  const data = new FormData();
  data.append("image", input.image);
  if (input.sourceUrl) data.append("sourceUrl", input.sourceUrl);
  if (input.license) data.append("license", input.license);
  if (input.note) data.append("note", input.note);
  return http.request<ApiResponse<OutfitSample>>("post", root, {
    data,
    headers: { "Content-Type": undefined },
    timeout: 120000
  });
};
export const getSample = (id: string) =>
  http.request<ApiResponse<OutfitSample>>("get", item(id));
export const getSampleImage = (id: string) =>
  http.request<Blob>("get", `${item(id)}/image`, { responseType: "blob" });
export const saveSampleResult = (id: string, data: Record<string, unknown>) =>
  http.request<ApiResponse<OutfitSample>>("put", item(id), { data });
export const extractSample = (id: string) =>
  http.request<ApiResponse<OutfitSample>>("post", `${item(id)}/extract`, {
    timeout: 120000
  });
export const reviewSample = (id: string, decision: SampleDecision) =>
  http.request<ApiResponse<OutfitSample>>("post", `${item(id)}/review`, {
    data: { decision }
  });
export const sampleTemplateDraft = (
  id: string,
  data: { kind?: string; text?: string }
) =>
  http.request<ApiResponse<Record<string, unknown>>>(
    "post",
    `${item(id)}/template-draft`,
    { data }
  );
export const removeSample = (id: string) =>
  http.request<void>("delete", item(id));
