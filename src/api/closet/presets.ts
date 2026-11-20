import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type PresetStatus = "DRAFT" | "LISTED" | "UNLISTED";
export type PresetGroup =
  | "top"
  | "bottom"
  | "outer"
  | "one-piece"
  | "shoes"
  | "accessory";
export type PresetName = string | null;
export type PresetEdit = {
  name?: string;
  status: PresetStatus;
  gender: string;
  styles: string[];
  seasons: string[];
  sort: number;
};
export type ManagedPreset = Omit<PresetEdit, "name"> & {
  id: string;
  name: PresetName;
  group: PresetGroup | "other";
  category: string[];
  color: string[];
  sourceOwner: string | null;
  importedCount: number;
  createdAtMs: number;
  updatedAtMs: number;
};
export type PresetSource = Pick<
  ManagedPreset,
  "name" | "group" | "category" | "color" | "gender"
> & {
  garmentId: string;
  inLibrary: PresetStatus | "REMOVED" | null;
  presetId: string | null;
};
export type PresetSession = {
  sessionId: string;
  username: string;
  displayName: string | null;
  expiresAtMs: number;
};
export type PresetCoverage = {
  gender: string;
  role: PresetGroup;
  style: string;
  count: number;
  missing: boolean;
};
type Page<T> = { items: T[]; total: number };
type Filters = {
  page: number;
  size: number;
  q?: string;
  group?: PresetGroup;
};
export type PresetAction = "LIST" | "UNLIST" | "REMOVE";
const root = "/closet/presets";
const item = (id: string) => `${root}/${encodeURIComponent(id)}`;
const source = (sessionId: string) =>
  `${root}/source-sessions/${encodeURIComponent(sessionId)}`;

export const getPresets = (
  params: Filters & { status?: PresetStatus; gender?: string }
) => http.request<ApiResponse<Page<ManagedPreset>>>("get", root, { params });
export const getPresetImage = (id: string) =>
  http.request<Blob>("get", `${item(id)}/image`, { responseType: "blob" });
export const editPreset = (id: string, data: PresetEdit) =>
  http.request<ApiResponse<ManagedPreset>>("patch", item(id), { data });
export const removePreset = (id: string) =>
  http.request<void>("delete", item(id));
export const batchPresets = (ids: string[], action: PresetAction) =>
  http.request<ApiResponse<{ updated: number }>>("post", `${root}/batch`, {
    data: { ids, action }
  });
export const getPresetCoverage = () =>
  http.request<ApiResponse<PresetCoverage[]>>("get", `${root}/coverage`);
export const openPresetSource = (username: string, password: string) =>
  http.request<ApiResponse<PresetSession>>("post", `${root}/source-sessions`, {
    data: { username, password }
  });
export const closePresetSource = (sessionId: string) =>
  http.request<void>("delete", source(sessionId));
export const getPresetSources = (sessionId: string, params: Filters) =>
  http.request<ApiResponse<Page<PresetSource>>>(
    "get",
    `${source(sessionId)}/garments`,
    { params }
  );
export const getPresetSourceImage = (sessionId: string, id: string) =>
  http.request<Blob>(
    "get",
    `${source(sessionId)}/garments/${encodeURIComponent(id)}/image`,
    {
      responseType: "blob"
    }
  );
export const importPresetSources = (
  sessionId: string,
  garmentIds: string[],
  list: boolean
) =>
  http.request<ApiResponse<ManagedPreset[]>>(
    "post",
    `${source(sessionId)}/import`,
    { data: { garmentIds, list } }
  );

export type StyleCover = {
  key: string;
  style: string;
  configured: boolean;
  updatedAtMs: number | null;
};

const covers = "/closet/onboarding/style-covers";
const coverImage = (key: string) =>
  `${covers}/${encodeURIComponent(key)}/image`;
export const getStyleCovers = () =>
  http.request<ApiResponse<{ items: StyleCover[] }>>("get", covers);
export const getStyleCoverImage = (key: string) =>
  http.request<Blob>("get", coverImage(key), { responseType: "blob" });
export const putStyleCover = (key: string, file: File) =>
  http.request<ApiResponse<StyleCover>>("put", coverImage(key), {
    data: file,
    headers: { "Content-Type": file.type },
    timeout: 60000
  });
export const removeStyleCover = (key: string) =>
  http.request<void>("delete", coverImage(key));
