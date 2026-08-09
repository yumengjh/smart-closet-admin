import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type RuntimeSetting = {
  key: string;
  displayName: string;
  description: string;
  group: string;
  type: "BOOLEAN" | "INTEGER" | "STRING";
  value: string;
  minValue?: number;
  maxValue?: number;
  dangerous: boolean;
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
