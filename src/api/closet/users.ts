import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type ClosetRole = "USER" | "ADMIN";
export type ClosetUserStatus = "ENABLED" | "DISABLED";
export type ClosetUserSummary = {
  username: string;
  role: ClosetRole;
  enabled: boolean;
  mustChangePassword: boolean;
  createdAtMs: number;
  lastActiveAtMs: number | null;
  activeSessionCount: number;
  garmentCount: number;
  outfitCount: number;
};
export type ClosetUserDetail = ClosetUserSummary & {
  garments: Record<string, number>;
  outfitPlanCount: number;
  quickIntakeCount: number;
  hasWearerProfile: boolean;
  activePortableLinkCount: number;
  quota: ClosetQuota;
};
export type ClosetPage<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type ClosetUserQuery = {
  q?: string;
  status?: ClosetUserStatus;
  role?: ClosetRole;
  sort?: "createdAt" | "username" | "lastActiveAt";
  order?: "asc" | "desc";
  page: number;
  size: number;
};
export type ClosetSession = {
  sessionRef: string;
  createdAtMs: number;
  lastAccessAtMs: number;
  expiresAtMs: number;
  portable: boolean;
};
export type PortableLink = {
  id: string;
  createdAtMs: number;
  expiresAtMs: number;
  sessionExpiresAtMs: number | null;
  status: string;
};
export type ClosetQuotaItem = {
  limit: number;
  used: number;
  overridden: boolean;
};
export type ClosetQuota = {
  image: ClosetQuotaItem;
  agent: ClosetQuotaItem;
  resetAtMs: number;
};
export type CredentialResult = {
  username: string;
  temporaryPassword: string | null;
};

const root = "/closet/users";
export const listClosetUsers = (params: ClosetUserQuery) =>
  http.request<ApiResponse<ClosetPage<ClosetUserSummary>>>("get", root, {
    params
  });
export const getClosetUser = (username: string) =>
  http.request<ApiResponse<ClosetUserDetail>>(
    "get",
    `${root}/${encodeURIComponent(username)}`
  );
export const createClosetUser = (data: {
  username: string;
  role: ClosetRole;
  password: string | null;
}) => http.request<ApiResponse<CredentialResult>>("post", root, { data });
export const updateClosetUserStatus = (username: string, enabled: boolean) =>
  http.request<
    ApiResponse<{ username: string; enabled: boolean; revokedSessions: number }>
  >("patch", `${root}/${encodeURIComponent(username)}/status`, {
    data: { enabled }
  });
export const updateClosetUserRole = (username: string, role: ClosetRole) =>
  http.request<
    ApiResponse<{ username: string; role: ClosetRole; revokedSessions: number }>
  >("patch", `${root}/${encodeURIComponent(username)}/role`, {
    data: { role }
  });
export const resetClosetUserPassword = (
  username: string,
  password: string | null = null
) =>
  http.request<ApiResponse<CredentialResult & { revokedSessions: number }>>(
    "post",
    `${root}/${encodeURIComponent(username)}/password-reset`,
    { data: { password } }
  );
export const listClosetUserSessions = (username: string) =>
  http.request<ApiResponse<ClosetSession[]>>(
    "get",
    `${root}/${encodeURIComponent(username)}/sessions`
  );
export const revokeClosetUserSessions = (username: string) =>
  http.request<ApiResponse<{ revokedSessions: number }>>(
    "delete",
    `${root}/${encodeURIComponent(username)}/sessions`
  );
export const listPortableLinks = (username: string) =>
  http.request<ApiResponse<PortableLink[]>>(
    "get",
    `${root}/${encodeURIComponent(username)}/portable-links`
  );
export const revokePortableLink = (username: string, id: string) =>
  http.request<void>(
    "delete",
    `${root}/${encodeURIComponent(username)}/portable-links/${encodeURIComponent(id)}`
  );
export const getClosetUserQuota = (username: string) =>
  http.request<ApiResponse<ClosetQuota>>(
    "get",
    `${root}/${encodeURIComponent(username)}/quota`
  );
export const updateClosetUserQuota = (
  username: string,
  data: { imageDailyLimit: number | null; agentDailyLimit: number | null }
) =>
  http.request<ApiResponse<ClosetQuota>>(
    "put",
    `${root}/${encodeURIComponent(username)}/quota`,
    { data }
  );
