import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type Showcase = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  revision: number;
  sourceNote: string;
  hash: string;
  width: number;
  height: number;
  aiGenerated: true;
  imageUrl: string;
  createdAtMs: number;
  updatedAtMs: number;
};
export type ShowcaseContent = Pick<
  Showcase,
  "title" | "description" | "sortOrder"
>;
export type ShowcaseUpload = {
  uploadId: string;
  hash: string;
  width: number;
  height: number;
};
export type ShowcasePage = {
  items: Showcase[];
  total: number;
  page: number;
  size: number;
};
const root = "/closet/creations/showcases";
const item = (id: string) => `${root}/${encodeURIComponent(id)}`;
export const getShowcases = (page = 0, size = 20) =>
  http.request<ApiResponse<ShowcasePage>>("get", root, {
    params: { page, size }
  });
export const uploadShowcase = (file: File, sourceNote: string) => {
  const data = new FormData();
  data.append("file", file);
  data.append("sourceNote", sourceNote);
  return http.request<ApiResponse<ShowcaseUpload>>("post", `${root}/uploads`, {
    data,
    headers: { "Content-Type": undefined },
    timeout: 60000
  });
};
export const createShowcase = (uploadId: string, content: ShowcaseContent) =>
  http.request<ApiResponse<Showcase>>("post", root, {
    data: { uploadId, ...content }
  });
export const editShowcase = (
  id: string,
  revision: number,
  content: ShowcaseContent
) =>
  http.request<ApiResponse<Showcase>>("put", item(id), {
    data: { revision, ...content }
  });
export const publishShowcase = (id: string, revision: number) =>
  http.request<ApiResponse<Showcase>>("post", `${item(id)}/publish`, {
    data: { revision }
  });
export const retireShowcase = (id: string, revision: number) =>
  http.request<ApiResponse<Showcase>>("post", `${item(id)}/retire`, {
    data: { revision }
  });
// Derive a whitelisted gateway URL from id; never use a supplied upstream image URL.
export const getShowcaseImage = (id: string) =>
  http.request<Blob>("get", `${item(id)}/image`, { responseType: "blob" });
