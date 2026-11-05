import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type TryOnSettingsValue = {
  mode: "FOLLOW_USER" | "FORCE_ON" | "FORCE_OFF";
  defaultEnabled: boolean;
  dailySeconds: number;
  dailyPoints: number;
  totalPoints: number;
  sessionSeconds: number;
  startupSeconds: number;
  firstFrameSeconds: number;
  queueSeconds: number;
  offerSeconds: number;
  recordingSeconds: number;
  recordingBytes: number;
  storageBytes: number;
  accountConcurrency: number;
  accountGuardPoints: number;
};
export type TryOnSettings = { revision: number; value: TryOnSettingsValue };
export type TryOnPolicy = {
  accessMode: "INHERIT" | "ENABLED" | "DISABLED";
  dailySeconds: number | null;
  startupFailureLimit: number | null;
};
export type TryOnUserUsage = {
  quota: { limit: number; used: number; reserved: number; remaining: number };
  storageBytes: number;
  startup: {
    enabled: boolean;
    failures: number;
    limit: number;
    remaining: number;
  };
};
export type TryOnCredentialInput = {
  name: string;
  environment: "china" | "global";
  apiKey: string;
};
export type TryOnAccountChange = {
  name: string;
  accepting: boolean;
  weight: number;
  concurrencyLimit: number;
};
// Account and daily usage fields are snake_case in the source contract's current implementation.
export type TryOnAccount = {
  id: string;
  name: string;
  environment: "china" | "global";
  provider_user_id: string;
  accepting: number;
  healthy: number;
  weight: number;
  concurrency_limit: number;
  balance_points: number;
  balance_at_ms: number;
  budget_points: number;
  availablePoints: number;
  activeSessions: number;
  credentials: Array<{
    id: string;
    masked_key: string;
    active: number;
    created_at_ms: number;
  }>;
};
export type TryOnPool = {
  totalPoints: number;
  availablePoints: number;
  availableSlots: number;
  globalRemainingPoints: number;
  accounts: TryOnAccount[];
};
export type TryOnDailyUsage = {
  quota_day: string;
  sessions: number;
  consumed_points: number;
  reserved_points: number;
  user_seconds: number;
};
export type TryOnReferenceSource = {
  source: "NONE" | "BUCKET" | "PUBLIC_SITE" | "XMAX_STORAGE";
  devOnly: boolean;
  bucket: {
    endpointHost: string;
    bucket: string;
    prefix: string;
    pathStyle: boolean;
  } | null;
  publicOrigin: string | null;
  linkTtlSeconds: number | null;
  references: Record<string, number>;
};
export type TryOnSession = {
  id: string;
  state: string;
  preparationId: string;
  reservedPoints: number;
  consumedPoints: number;
  userSeconds: number;
  firstFrame: boolean;
  createdAtMs: number;
  connectedAtMs: number | null;
  rtcConnectedAtMs: number | null;
  deadlineAtMs: number;
  remainingSeconds: number;
  reason: string | null;
  environment: string;
  diagnostic: {
    stage: string;
    timings: Record<string, number> | null;
    video: Record<string, number> | null;
    uplink: string | null;
    downlink: string | null;
  } | null;
};
const root = "/closet/tryon";
export const getTryOnSettings = () =>
  http.request<ApiResponse<TryOnSettings>>("get", `${root}/settings`);
export const updateTryOnSettings = (data: TryOnSettings) =>
  http.request<ApiResponse<TryOnSettings>>("put", `${root}/settings`, { data });
export const resetTryOnSettings = (revision: number) =>
  http.request<ApiResponse<TryOnSettings>>("post", `${root}/settings/reset`, {
    data: { revision }
  });
export const getTryOnUserPolicy = (username: string) =>
  http.request<ApiResponse<TryOnPolicy>>(
    "get",
    `${root}/users/${encodeURIComponent(username)}/policy`
  );
export const updateTryOnUserPolicy = (username: string, data: TryOnPolicy) =>
  http.request<ApiResponse<TryOnPolicy>>(
    "put",
    `${root}/users/${encodeURIComponent(username)}/policy`,
    { data }
  );
export const getTryOnUserUsage = (username: string) =>
  http.request<ApiResponse<TryOnUserUsage>>(
    "get",
    `${root}/users/${encodeURIComponent(username)}/usage`
  );
export const resetTryOnStartupFailures = (username: string) =>
  http.request<
    ApiResponse<{ resetAtMs: number; startup: TryOnUserUsage["startup"] }>
  >(
    "post",
    `${root}/users/${encodeURIComponent(username)}/startup-failures/reset`
  );
export const listTryOnAccounts = () =>
  http.request<ApiResponse<TryOnAccount[]>>("get", `${root}/accounts`);
export const registerTryOnAccount = (data: TryOnCredentialInput) =>
  http.request<ApiResponse<TryOnAccount>>("post", `${root}/accounts`, { data });
export const getTryOnAccount = (id: string) =>
  http.request<ApiResponse<TryOnAccount>>(
    "get",
    `${root}/accounts/${encodeURIComponent(id)}`
  );
export const updateTryOnAccount = (id: string, data: TryOnAccountChange) =>
  http.request<ApiResponse<TryOnAccount>>(
    "patch",
    `${root}/accounts/${encodeURIComponent(id)}`,
    { data }
  );
export const rotateTryOnCredential = (id: string, data: TryOnCredentialInput) =>
  http.request<ApiResponse<TryOnAccount>>(
    "post",
    `${root}/accounts/${encodeURIComponent(id)}/credentials`,
    { data }
  );
export const removeTryOnCredential = (id: string, credentialId: string) =>
  http.request<ApiResponse<{ removed: boolean }>>(
    "delete",
    `${root}/accounts/${encodeURIComponent(id)}/credentials/${encodeURIComponent(credentialId)}`
  );
export const probeTryOnAccount = (id: string) =>
  http.request<ApiResponse<TryOnAccount>>(
    "post",
    `${root}/accounts/${encodeURIComponent(id)}/probe`
  );
export const updateTryOnAccountBudget = (id: string, budgetPoints: number) =>
  http.request<ApiResponse<TryOnAccount>>(
    "post",
    `${root}/accounts/${encodeURIComponent(id)}/budget`,
    { data: { budgetPoints } }
  );
export const getTryOnPool = () =>
  http.request<ApiResponse<TryOnPool>>("get", `${root}/pool`);
export const getTryOnReferenceSource = () =>
  http.request<ApiResponse<TryOnReferenceSource>>(
    "get",
    `${root}/reference-source`
  );
export const getTryOnUsage = () =>
  http.request<ApiResponse<TryOnDailyUsage[]>>("get", `${root}/usage`);
export const listTryOnSessions = () =>
  http.request<ApiResponse<TryOnSession[]>>("get", `${root}/sessions`);
export const getTryOnSession = (id: string) =>
  http.request<ApiResponse<TryOnSession>>(
    "get",
    `${root}/sessions/${encodeURIComponent(id)}`
  );
export const stopTryOnSession = (id: string) =>
  http.request<ApiResponse<TryOnSession>>(
    "post",
    `${root}/sessions/${encodeURIComponent(id)}/stop`
  );
export const stopTryOnAccountSessions = (id: string) =>
  http.request<ApiResponse<{ stopping: boolean }>>(
    "post",
    `${root}/accounts/${encodeURIComponent(id)}/stop-sessions`
  );
