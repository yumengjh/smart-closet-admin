import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type LookStatus = "DRAFT" | "LISTED" | "UNLISTED";
export type LookCoverage = "FULL" | "UPPER" | "LOWER";
export type LookGender = "FEMALE" | "MALE" | "UNISEX";
export type LookSource = "UPLOAD" | "COMPOSE";
export type LookAction = "LIST" | "UNLIST" | "REMOVE" | "VERIFY" | "UNVERIFY";

export type LookCategory = {
  key: string;
  name: string;
  sort: number;
  enabled: boolean;
  lookCount: number;
  listedCount: number;
  createdAtMs: number;
  updatedAtMs: number;
};
export type LookCategoryCreate = { key: string; name: string; sort?: number };
export type LookCategoryEdit = {
  name?: string;
  sort?: number;
  enabled?: boolean;
};

export type ManagedLook = {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  categoryEnabled: boolean;
  tags: string[];
  coverage: LookCoverage;
  gender: LookGender;
  status: LookStatus;
  verified: boolean;
  verifiedAtMs: number | null;
  sort: number;
  source: LookSource;
  composePresetIds: string[];
  hasImage: boolean;
  imageVersion: number;
  width: number | null;
  height: number | null;
  tryCount: number;
  createdAtMs: number;
  updatedAtMs: number;
};
export type LookCreate = {
  name: string;
  category: string;
  tags?: string[];
  coverage: LookCoverage;
  gender?: LookGender;
};
export type LookCompose = LookCreate & { presetIds: string[] };
export type LookEdit = Partial<LookCreate> & {
  status?: LookStatus;
  sort?: number;
  verified?: boolean;
};
export type LookFilters = {
  /** 0-based; the admin server adds 1 before calling the closet service. */
  page: number;
  size: number;
  status?: LookStatus;
  category?: string;
  verified?: boolean;
  q?: string;
};

const root = "/closet/looks";
const categories = `${root}/categories`;
const category = (key: string) => `${categories}/${encodeURIComponent(key)}`;
const item = (id: string) => `${root}/${encodeURIComponent(id)}`;

export const getLookCategories = () =>
  http.request<ApiResponse<{ items: LookCategory[] }>>("get", categories);
export const createLookCategory = (data: LookCategoryCreate) =>
  http.request<ApiResponse<LookCategory>>("post", categories, { data });
export const editLookCategory = (key: string, data: LookCategoryEdit) =>
  http.request<ApiResponse<LookCategory>>("patch", category(key), { data });
export const removeLookCategory = (key: string) =>
  http.request<void>("delete", category(key));

export const getLooks = (params: LookFilters) =>
  http.request<ApiResponse<{ items: ManagedLook[]; total: number }>>(
    "get",
    root,
    { params }
  );
export const createLook = (data: LookCreate) =>
  http.request<ApiResponse<ManagedLook>>("post", root, { data });
export const composeLook = (data: LookCompose) =>
  http.request<ApiResponse<ManagedLook>>("post", `${root}/compose`, {
    data,
    timeout: 60000
  });
export const getLookImage = (id: string) =>
  http.request<Blob>("get", `${item(id)}/image`, { responseType: "blob" });
export const putLookImage = (id: string, file: File) =>
  http.request<ApiResponse<ManagedLook>>("put", `${item(id)}/image`, {
    data: file,
    headers: { "Content-Type": file.type },
    timeout: 60000
  });
export const editLook = (id: string, data: LookEdit) =>
  http.request<ApiResponse<ManagedLook>>("patch", item(id), { data });
export const removeLook = (id: string) =>
  http.request<void>("delete", item(id));
export const batchLooks = (ids: string[], action: LookAction) =>
  http.request<ApiResponse<{ updated: number }>>("post", `${root}/batch`, {
    data: { ids, action }
  });
