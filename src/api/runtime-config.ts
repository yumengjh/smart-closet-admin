import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type RuntimeSetting = {
  key: string;
  displayName: string;
  description: string;
  type: "BOOLEAN" | "INTEGER" | "STRING";
  value: string;
};
export type RuntimeComponent = {
  code: string;
  displayName: string;
  kind: "SERVICE_DEPENDENCY" | "LOCAL_RESOURCE";
  status: "UNKNOWN" | "CHECKING" | "UP" | "ERROR" | "DISABLED";
  lastCheckedAt?: string;
  lastSucceededAt?: string;
  latencyMs?: number;
  consecutiveFailures: number;
  message?: string;
};
export type RuntimeCache = {
  code: string;
  displayName: string;
  snapshotRevision: number;
  databaseRevision: number;
  synchronizedState: boolean;
  loadedAt?: string;
  lastCheckedAt?: string;
  lastReloadedAt?: string;
  lastFailedAt?: string;
  lastFailureMessage?: string;
  entryCount: number;
};
export const settingGroups = {
  security: [
    "security.brute-force.enabled",
    "security.audit.enabled",
    "security.request-log.enabled"
  ],
  rateLimit: [
    "security.rate-limit.enabled",
    "security.rate-limit.capacity",
    "security.rate-limit.window-seconds"
  ],
  cors: ["security.cors.allowed-origins", "security.cors.allowed-methods"],
  endpointPolicy: [
    "security.endpoint.disabled-patterns",
    "security.endpoint.rate-limit.patterns",
    "security.endpoint.rate-limit.capacity",
    "security.endpoint.rate-limit.window-seconds"
  ],
  ipPolicy: ["security.ip.allow-list", "security.ip.deny-list"],
  identity: ["identity.registration.enabled"],
  runtime: [
    "runtime.config-refresh.enabled",
    "runtime.config-refresh.interval-seconds",
    "runtime.health-check.enabled",
    "runtime.health-check.interval-seconds",
    "avatar.generator.enabled"
  ]
} as const;
export const listRuntimeSettings = () =>
  http.request<ApiResponse<RuntimeSetting[]>>("get", "/system/runtime-config");
export const updateRuntimeSetting = (key: string, value: string) =>
  http.request<ApiResponse<RuntimeSetting>>(
    "put",
    `/system/runtime-config/${key}`,
    { data: { value } }
  );
export const listRuntimeCaches = () =>
  http.request<ApiResponse<RuntimeCache[]>>("get", "/system/runtime-caches");
export const refreshRuntimeCaches = () =>
  http.request<ApiResponse<RuntimeCache[]>>("post", "/system/runtime-caches/refresh");
export const refreshRuntimeCache = (code: string) =>
  http.request<ApiResponse<RuntimeCache>>(
    "post",
    "/system/runtime-caches/" + code + "/refresh"
  );
export const listRuntimeChecks = () =>
  http.request<ApiResponse<RuntimeComponent[]>>("get", "/system/runtime-checks");
export const refreshRuntimeChecks = () =>
  http.request<ApiResponse<RuntimeComponent[]>>(
    "post",
    "/system/runtime-checks/refresh"
  );
export const refreshRuntimeCheck = (code: string) =>
  http.request<ApiResponse<RuntimeComponent>>(
    "post",
    "/system/runtime-checks/" + code + "/refresh"
  );
