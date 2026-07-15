import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type UserStatus = "ACTIVE" | "LOCKED" | "DISABLED";
export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  status: UserStatus;
  roles: string[];
};
export type PageResponse<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type UserListParams = {
  q?: string;
  status?: UserStatus;
  page: number;
  size: number;
};
export const userStatusPayload = (status: UserStatus) => ({ status });
export const listUsers = (params: UserListParams) =>
  http.request<ApiResponse<PageResponse<AdminUser>>>("get", "/admin/users", {
    params
  });
export const getAdminUser = (id: string) =>
  http.request<ApiResponse<AdminUser>>("get", `/admin/users/${id}`);
export const updateUserStatus = (id: string, status: UserStatus) =>
  http.request<ApiResponse<AdminUser>>("patch", `/admin/users/${id}/status`, {
    data: userStatusPayload(status)
  });
export const revokeUserSessions = (id: string) =>
  http.request<void>("post", `/admin/users/${id}/sessions/revoke`);
