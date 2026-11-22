import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type PoseStatus = "DRAFT" | "LISTED" | "UNLISTED";
export type PoseAction = "LIST" | "UNLIST" | "REMOVE";
export type PoseSource = "SEED" | "TEXT" | "PHOTO";
export type ViewAngle = "FRONT" | "THREE_QUARTER" | "SIDE" | "BACK";
export type PoseHitKind = "SUGGESTIVE" | "NUDITY" | "MINOR";
/** joint → [x, y], both 0–1 of a 3:4 frame; joints the picture does not show are absent. */
export type PoseKeypoints = Record<string, [number, number]>;

export type ManagedPose = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  viewAngle: ViewAngle | null;
  keypoints: PoseKeypoints | null;
  status: PoseStatus;
  sort: number;
  source: PoseSource;
  createdAtMs: number;
  updatedAtMs: number;
};
export type PoseEdit = {
  name?: string;
  description?: string;
  tags?: string[];
  viewAngle?: ViewAngle;
  keypoints?: PoseKeypoints;
  status?: PoseStatus;
  sort?: number;
};
export type PoseCreate = PoseEdit & {
  id?: string;
  name: string;
  description: string;
};
export type PoseDraft = {
  name: string;
  description: string;
  tags: string[];
  viewAngle: ViewAngle | null;
  keypoints: PoseKeypoints | null;
};
export type PoseHit = { kind: PoseHitKind; term: string; reason: string };
export type PoseCheckSide = {
  suggestive: boolean;
  nudity: boolean;
  minor: boolean;
};
export type PoseCheckValues = { user: PoseCheckSide; admin: PoseCheckSide };
export type PoseCheckSettings = PoseCheckValues & {
  revision: number;
  updatedAtMs: number | null;
};

const root = "/closet/poses";
const item = (id: string) => `${root}/${encodeURIComponent(id)}`;

export const getPoses = (params: { status?: PoseStatus; q?: string }) =>
  http.request<ApiResponse<{ items: ManagedPose[]; total: number }>>(
    "get",
    root,
    { params }
  );
export const createPose = (data: PoseCreate) =>
  http.request<ApiResponse<ManagedPose>>("post", root, { data });
export const editPose = (id: string, data: PoseEdit) =>
  http.request<ApiResponse<ManagedPose>>("patch", item(id), { data });
export const removePose = (id: string) =>
  http.request<void>("delete", item(id));
export const batchPoses = (ids: string[], action: PoseAction) =>
  http.request<ApiResponse<{ updated: number }>>("post", `${root}/batch`, {
    data: { ids, action }
  });
export const extractPose = (file: File) =>
  http.request<ApiResponse<{ draft: PoseDraft }>>("post", `${root}/extract`, {
    data: file,
    headers: { "Content-Type": file.type },
    timeout: 90000
  });
export const checkPose = (data: { name?: string; description: string }) =>
  http.request<ApiResponse<{ ok: boolean; hits: PoseHit[] }>>(
    "post",
    `${root}/check`,
    { data }
  );
export const getPoseCheckSettings = () =>
  http.request<ApiResponse<PoseCheckSettings>>("get", `${root}/check-settings`);
export const putPoseCheckSettings = (
  data: PoseCheckValues & { revision: number }
) =>
  http.request<ApiResponse<PoseCheckSettings>>(
    "put",
    `${root}/check-settings`,
    { data }
  );

// ── 敏感词表（鱼搭设计 5.3）：存在鱼搭数据库，增、改、停用、删除都立即生效 ──
export type PoseTermSource = "SEED" | "ADMIN";
export type PoseSensitiveTerm = {
  id: string;
  term: string;
  kind: PoseHitKind;
  reason: string;
  enabled: boolean;
  source: PoseTermSource;
  createdAtMs: number;
  updatedAtMs: number;
};
export type PoseTermCreate = {
  term: string;
  kind: PoseHitKind;
  reason: string;
};
export type PoseTermEdit = Partial<PoseTermCreate> & { enabled?: boolean };

const terms = `${root}/sensitive-terms`;
const term = (id: string) => `${terms}/${encodeURIComponent(id)}`;

export const getPoseTerms = (params: {
  kind?: PoseHitKind;
  enabled?: boolean;
  q?: string;
}) =>
  http.request<ApiResponse<{ items: PoseSensitiveTerm[]; total: number }>>(
    "get",
    terms,
    { params }
  );
export const createPoseTerm = (data: PoseTermCreate) =>
  http.request<ApiResponse<PoseSensitiveTerm>>("post", terms, { data });
export const editPoseTerm = (id: string, data: PoseTermEdit) =>
  http.request<ApiResponse<PoseSensitiveTerm>>("patch", term(id), { data });
export const removePoseTerm = (id: string) =>
  http.request<void>("delete", term(id));
