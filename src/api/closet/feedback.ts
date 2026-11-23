import { http } from "@/utils/http";
import type { ApiResponse } from "../user";
import type { Page } from "./management";

/** 鱼搭用户反馈（鱼搭 docs/design/2026-11-23-用户反馈：匿名提交与后台处理设计.md）。 */
export type FeedbackStatus = "NEW" | "PROCESSING" | "RESOLVED" | "CLOSED";
export type FeedbackCategory = "PROBLEM" | "IDEA" | "OTHER";
export type FeedbackSubmitter = "ACCOUNT" | "HIDDEN" | "ANONYMOUS";
export type ClosetFeedback = {
  id: string;
  createdAtMs: number;
  updatedAtMs: number;
  revision: number;
  category: FeedbackCategory;
  status: FeedbackStatus;
  submitter: FeedbackSubmitter;
  username: string | null;
  userKey: string | null;
  content: string;
  contact: string | null;
  page: string | null;
  platform: "MOBILE" | "DESKTOP" | "PWA" | null;
  webVersion: string | null;
  serverVersion: string | null;
  reply: string | null;
  repliedAtMs: number | null;
  note: string | null;
};
export type FeedbackPage = Page<ClosetFeedback> & {
  counts: Record<FeedbackStatus, number>;
};
export type FeedbackQuery = {
  page: number;
  size: number;
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  submitter?: FeedbackSubmitter;
  q?: string;
  from?: string;
  to?: string;
};
export type FeedbackEdit = {
  revision: number;
  status?: FeedbackStatus;
  reply?: string;
  note?: string;
};
export type FeedbackSettings = {
  anonymousEnabled: boolean;
  defaultAnonymousEnabled: boolean;
  revision: number;
  updatedAtMs: number;
};

export const FEEDBACK_STATUS: Record<FeedbackStatus, string> = {
  NEW: "已收到",
  PROCESSING: "处理中",
  RESOLVED: "已解决",
  CLOSED: "已关闭"
};
export const FEEDBACK_CATEGORY: Record<FeedbackCategory, string> = {
  PROBLEM: "遇到问题",
  IDEA: "想要的功能",
  OTHER: "其他"
};
export const FEEDBACK_SUBMITTER: Record<FeedbackSubmitter, string> = {
  ACCOUNT: "附带账号",
  HIDDEN: "已登录未附账号",
  ANONYMOUS: "未登录"
};
export const FEEDBACK_PLATFORM: Record<string, string> = {
  MOBILE: "手机",
  DESKTOP: "电脑",
  PWA: "桌面应用"
};

const root = "/closet/feedback";
export const getClosetFeedback = (params: FeedbackQuery) =>
  http.request<ApiResponse<FeedbackPage>>("get", root, { params });
export const editClosetFeedback = (id: string, data: FeedbackEdit) =>
  http.request<ApiResponse<ClosetFeedback>>(
    "patch",
    `${root}/${encodeURIComponent(id)}`,
    { data }
  );
export const deleteClosetFeedback = (id: string) =>
  http.request<ApiResponse<void>>(
    "delete",
    `${root}/${encodeURIComponent(id)}`
  );
export const getClosetFeedbackSettings = () =>
  http.request<ApiResponse<FeedbackSettings>>("get", `${root}/settings`);
export const putClosetFeedbackSettings = (data: {
  anonymousEnabled: boolean;
  revision: number;
}) =>
  http.request<ApiResponse<FeedbackSettings>>("put", `${root}/settings`, {
    data
  });
