import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type Announcement = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  publishedAt: number | null;
  authorId: string;
  version: number;
};
export const announcementPayload = (title: string, content: string) => {
  if (!title.trim() || !content.trim())
    throw new Error("title and content are required");
  return { title: title.trim(), content: content.trim() };
};
export const listAnnouncements = () =>
  http.request<ApiResponse<Announcement[]>>("get", "/announcements/manage");
export const createAnnouncement = (title: string, content: string) =>
  http.request<ApiResponse<Announcement>>("post", "/announcements", {
    data: announcementPayload(title, content)
  });
export const updateAnnouncement = (
  id: string,
  title: string,
  content: string
) =>
  http.request<ApiResponse<Announcement>>("put", `/announcements/${id}`, {
    data: announcementPayload(title, content)
  });
export const setAnnouncementPublication = (id: string, published: boolean) =>
  http.request<ApiResponse<Announcement>>(
    "put",
    `/announcements/${id}/publication`,
    { params: { published } }
  );
export const deleteAnnouncement = (id: string) =>
  http.request<void>("delete", `/announcements/${id}`);
