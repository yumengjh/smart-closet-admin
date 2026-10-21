import { http } from "@/utils/http";
import { stringify } from "qs";
import type { ApiResponse } from "../user";
import type { CountItem, TrendMetric } from "./insights";

export type Page<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type TaskStatus =
  | "QUEUED"
  | "RUNNING"
  | "WAITING_QUOTA"
  | "FAILED"
  | "SUCCEEDED"
  | "CANCELLED";
export type Task = {
  id: string;
  kind: string;
  ownerUsername: string | null;
  status: TaskStatus;
  stage: number;
  pool: string;
  priority: number;
  waitReason: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAtMs: number;
  updatedAtMs: number;
  nextRunAtMs: number;
};
export type OperationLog = {
  id: string;
  occurredAtMs: number;
  keyId: string;
  operator: string | null;
  requestId: string | null;
  action: string;
  targetUsername: string | null;
  result: string;
  detail: string | null;
};
export type OpsStatus = {
  status: string;
  issues: Array<{ code: string; message: string }>;
  app: { version: string; startedAtMs: number; uptimeMs: number; java: string };
  jvm: {
    heapUsedBytes: number;
    heapMaxBytes: number;
    nonHeapUsedBytes: number;
    threads: number;
    processors: number;
    systemLoadAverage: number;
    processCpuLoad: number | null;
    processRssBytes: number | null;
    systemMemoryTotalBytes?: number;
    systemMemoryFreeBytes?: number;
  };
  storage: {
    totalBytes?: number;
    usableBytes?: number;
    usedRatio?: number;
    databaseBytes: number | null;
    error?: string;
  };
  models: Record<string, Record<string, unknown>>;
  indexes: Record<
    string,
    { coverage: number; total: number; indexed?: number; measured?: number }
  >;
  queue: {
    byStatus: Record<string, number>;
    byKind: Array<{
      kind: string;
      queued: number;
      running: number;
      waitingQuota: number;
      failed24h: number;
    }>;
    oldestQueuedAgeMs: number | null;
    failed24h: number;
  };
  providers: Record<string, unknown>;
  sessions: { active: number; onlineLast5Min: number };
  generatedAtMs: number;
};
export type Series = Array<{ metric: TrendMetric; values: number[] }>;
export type DashboardSnapshot = {
  generatedAtMs: number;
  refreshAfterMs: number;
  tiles: Record<string, number | null>;
  hourly: { hours: string[]; series: Series };
  daily: { days: string[]; series: Series };
  distributions: {
    categories: CountItem[];
    colors: CountItem[];
    seasons: CountItem[];
    recommendationSources7d: Array<{
      source: string;
      shown: number;
      adopted: number;
    }>;
    styles?: CountItem[];
    genderFits?: CountItem[];
    closetSizes?: CountItem[];
    registeredVia?: CountItem[];
    aiFeatures30d?: Array<{ key: string; calls: number; tokens: number }>;
  };
  growth?: { days: string[]; newUsers: number[]; cumulative: number[] };
  heatmap?: { days: number; cells: Array<[number, number, number]> };
  feed?: Array<{
    atMs: number;
    kind:
      | "GARMENT_ADDED"
      | "OUTFIT_SAVED"
      | "WEAR_LOGGED"
      | "RECOMMENDATION_LIKED"
      | "USER_REGISTERED";
    label: string | null;
  }>;
  ops: {
    status: string;
    issues: number;
    queueBacklog: number;
    failed24h: number;
  };
};
export type DailyExport = {
  from: string;
  to: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
};
export type EventType =
  | "garment_created"
  | "model_usage"
  | "outfit_created"
  | "quick_intake"
  | "recommendation_feedback"
  | "recommendation_shown"
  | "user_created"
  | "wear_logged";
export type EventPage = {
  items: Array<{
    type: EventType;
    id: string;
    atMs: number;
    userKey: string;
    attrs: Record<string, unknown>;
  }>;
  nextCursor: string;
  hasMore: boolean;
  watermarkMs: number;
};
export type TemplateReview = {
  reviewStatus?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  enabled?: boolean;
  bonus?: number;
};
export type OutfitTemplate = Required<TemplateReview> & {
  id: string;
  text: string;
  source: "FILE" | "SAMPLE";
  active: boolean;
  defaultBonus: number;
  reviewedBy: string | null;
  reviewedAtMs: number;
  kind: string;
  audience: string[];
  seasons: string[];
  occasions: string[];
  validFrom: string | null;
  validUntil: string | null;
  reference: string;
  slots: unknown[];
};
export type TemplateList = {
  version: string;
  maxBonus: number;
  active: number;
  items: OutfitTemplate[];
};
const root = "/closet";
const repeatParams = {
  serialize: (query: Record<string, unknown>) =>
    stringify(query, { arrayFormat: "repeat" })
};
export const getClosetOps = () =>
  http.request<ApiResponse<OpsStatus>>("get", `${root}/ops/status`);
export const getClosetTasks = (params: {
  status?: TaskStatus[];
  kind?: string;
  page: number;
  size: number;
}) =>
  http.request<ApiResponse<Page<Task>>>("get", `${root}/ops/tasks`, {
    params,
    paramsSerializer: repeatParams
  });
export const getClosetOperationLog = (params: {
  from?: string;
  to?: string;
  action?: string;
  targetUsername?: string;
  page: number;
  size: number;
}) =>
  http.request<ApiResponse<Page<OperationLog>>>(
    "get",
    `${root}/ops/operation-log`,
    { params }
  );
export const getClosetDashboard = () =>
  http.request<ApiResponse<DashboardSnapshot>>(
    "get",
    `${root}/dashboard/snapshot`
  );
export const getClosetDailyExport = (params: { from?: string; to?: string }) =>
  http.request<ApiResponse<DailyExport>>("get", `${root}/exports/daily`, {
    params: { ...params, format: "json" }
  });
export const downloadClosetDailyCsv = (params: {
  from?: string;
  to?: string;
}) =>
  http.request<Blob>("get", `${root}/exports/daily`, {
    params: { ...params, format: "csv" },
    responseType: "blob"
  });
export const getClosetEvents = (params: {
  cursor?: string;
  since?: number;
  limit?: number;
  types?: EventType[];
}) =>
  http.request<ApiResponse<EventPage>>("get", `${root}/exports/events`, {
    params,
    paramsSerializer: repeatParams
  });
export const getClosetTemplates = () =>
  http.request<ApiResponse<TemplateList>>("get", `${root}/templates`);
export const reviewClosetTemplate = (id: string, data: TemplateReview) =>
  http.request<ApiResponse<OutfitTemplate>>(
    "patch",
    `${root}/templates/${encodeURIComponent(id)}`,
    { data }
  );
