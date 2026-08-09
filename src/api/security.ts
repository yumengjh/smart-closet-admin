import { http } from "@/utils/http";
import type { ApiResponse } from "./user";
import type { PageResponse } from "./admin-users";

export type IpAccessRule = {
  id: string;
  type: "ALLOW" | "DENY";
  source: "MANUAL" | "AUTO_RATE_LIMIT" | "AUTO_LOGIN_ABUSE" | "MIGRATED";
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  network: string;
  scope: string;
  expiresAt: number | null;
  reason: string;
  triggerType: string | null;
  violationCount: number;
  firstTriggeredAt: number | null;
  lastTriggeredAt: number | null;
  blockedAt: number | null;
  revokedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
};
export type IpAccessRulePayload = {
  type: "ALLOW" | "DENY";
  network: string;
  expiresAt: number | null;
  reason: string;
};
export type AuditEvent = {
  id: string;
  actorId: string | null;
  action: string;
  result: string;
  targetType: string | null;
  targetId: string | null;
  occurredAt: number;
  traceId: string | null;
  metadata: string | null;
};
export type SystemInfo = {
  version: string;
  gitCommit: string;
  buildTime: number | null;
};
export const toEpochOrNull = (value?: Date | null) =>
  value ? value.getTime() : null;
export const listIpRules = () =>
  http.request<ApiResponse<IpAccessRule[]>>("get", "/system/ip-access-rules");
export const createIpRule = (data: IpAccessRulePayload) =>
  http.request<ApiResponse<IpAccessRule>>("post", "/system/ip-access-rules", {
    data
  });
export const deleteIpRule = (id: string) =>
  http.request<void>("delete", `/system/ip-access-rules/${id}`);
export const listAuditEvents = (page: number, size: number) =>
  http.request<ApiResponse<PageResponse<AuditEvent>>>(
    "get",
    "/system/audit-events",
    { params: { page, size } }
  );
export const getSystemInfo = () =>
  http.request<ApiResponse<SystemInfo>>("get", "/system/info");
export const getHealth = () =>
  http.request<{ status: string; components?: Record<string, unknown> }>(
    "get",
    "/actuator/health",
    undefined,
    { baseURL: "/" }
  );
