import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type RuntimeSetting = {
  key: string;
  displayName: string;
  description: string;
  type: "BOOLEAN" | "INTEGER" | "STRING";
  value: string;
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
  identity: ["identity.registration.enabled"]
} as const;
export const listRuntimeSettings = () =>
  http.request<ApiResponse<RuntimeSetting[]>>("get", "/system/runtime-config");
export const updateRuntimeSetting = (key: string, value: string) =>
  http.request<ApiResponse<RuntimeSetting>>(
    "put",
    `/system/runtime-config/${key}`,
    { data: { value } }
  );
