import { http } from "@/utils/http";
import type { ApiResponse } from "../user";
import type { ClosetPage } from "./users";

export type RegistrationMode = "CLOSED" | "INVITE" | "OPEN";
export type RegistrationState = {
  mode: RegistrationMode;
  configuredMode: RegistrationMode;
  overridden: boolean;
  updatedBy: string | null;
  updatedAtMs: number | null;
  activeInviteCount: number;
};
export type InviteStatus = "ACTIVE" | "USED_UP" | "EXPIRED" | "REVOKED";
export type Invite = {
  id: string;
  note: string | null;
  maxUses: number;
  usedCount: number;
  createdBy: string;
  createdAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  status: InviteStatus;
};
export type InviteDetail = {
  invite: Invite;
  registeredUsers: Array<{
    username: string;
    createdAtMs: number;
    enabled: boolean;
  }>;
};
export type InviteCreate = {
  note?: string;
  maxUses?: number;
  expiresInDays?: number;
};
export type InviteUpdate = {
  note?: string;
  maxUses?: number;
  expiresAtMs?: number;
};
const root = "/closet";
export const getClosetRegistration = () =>
  http.request<ApiResponse<RegistrationState>>("get", `${root}/registration`);
export const updateClosetRegistration = (mode: RegistrationMode | null) =>
  http.request<ApiResponse<RegistrationState>>("put", `${root}/registration`, {
    data: { mode }
  });
export const listClosetInvites = (params: {
  status?: InviteStatus;
  page: number;
  size: number;
}) =>
  http.request<ApiResponse<ClosetPage<Invite>>>("get", `${root}/invites`, {
    params
  });
export const createClosetInvite = (data: InviteCreate) =>
  http.request<ApiResponse<Invite & { code: string }>>(
    "post",
    `${root}/invites`,
    { data }
  );
export const getClosetInvite = (id: string) =>
  http.request<ApiResponse<InviteDetail>>(
    "get",
    `${root}/invites/${encodeURIComponent(id)}`
  );
export const updateClosetInvite = (id: string, data: InviteUpdate) =>
  http.request<ApiResponse<Invite>>(
    "patch",
    `${root}/invites/${encodeURIComponent(id)}`,
    { data }
  );
export const revokeClosetInvite = (id: string) =>
  http.request<void>("delete", `${root}/invites/${encodeURIComponent(id)}`);
