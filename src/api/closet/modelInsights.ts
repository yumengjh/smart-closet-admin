import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

const root = "/closet/models";
const part = encodeURIComponent;
type Query = Record<string, string | number | undefined>;
export type Cost = { currency: string; amountMicro: number };
export type Page<T> = { page: number; size: number; total: number; items: T[] };
export type Event = {
  id: string;
  atMs: number;
  scope: string;
  refId: string;
  pool: string | null;
  kind: string;
  code: string | null;
};
export type Bucket = {
  startMs: number;
  ok: number;
  notExecutedFailures: number;
  maybeExecutedFailures: number;
  otherFailures: number;
  p95Ms: number | null;
};
export type Timeline = {
  series: {
    entryId: string;
    label: string | null;
    model: string | null;
    buckets: Bucket[];
  }[];
  note: string;
};
export type TraceSummary = {
  traceId: string;
  attempts: number;
  firstAtMs: number;
  decisions: string[];
  finalOutcome: string;
  pool: string | null;
  costs: Cost[];
};
export type Attempt = {
  attemptNo: number;
  atMs: number;
  pool: string | null;
  label: string | null;
  model: string;
  decision: string | null;
  outcome: string;
  errorCode: string | null;
  execution: string | null;
  latencyMs: number;
  costMicro: number | null;
  costCurrency: string | null;
};
export type ProbeSettings = {
  freeEnabled: boolean;
  freeIntervalMinutes: number;
  freeFailures: number;
  paidEnabled: boolean;
  paidDailyCalls: number;
  paidPerEntry: number;
  paidSpendCapMicro: Record<string, number>;
  usdToCny: number;
};
export type Probe = {
  settings: ProbeSettings;
  revision: number;
  paidUsage: { calls: number; spendMicro: Record<string, number> };
  free: {
    providerId: string;
    atMs: number;
    ok: boolean;
    code: string | null;
    latencyMs: number;
    unreachable: boolean;
  }[];
};
export type Snapshot = {
  id: string;
  atMs: number;
  source: string;
  raw: { unit: string | null; json: unknown };
  converted: { balanceMicro: number; currency: string };
};
export type Billing = {
  source: string;
  tokenConfigured: boolean;
  tokenHint: string | null;
  unit: string | null;
  quotaPerUnit: number | null;
  lowBalanceMicro: number | null;
  currency: string | null;
  autoRemove: boolean;
  revision: number | null;
};
export type Balance = {
  providerId: string;
  providerName: string;
  billing: Billing;
  reported: Snapshot | null;
  estimatedMicro: number | null;
  differenceMicro: number | null;
  differenceWarning: boolean;
  low: boolean;
  removed: boolean;
  lastError: string | null;
};
export type AlertSettings = {
  rules: { rule: string; name: string; trigger: string; enabled: boolean }[];
  repeatMinutes: number;
  mailEnabled: boolean;
  recipientsConfigured: boolean;
  revision: number;
};
export type Alert = {
  id: string;
  rule: string;
  ruleName: string;
  refId: string;
  state: string;
  atMs: number;
  mailResult: string | null;
  reading: string | null;
};
const get = <T>(path: string, params?: Query) =>
  http.request<ApiResponse<T>>("get", `${root}${path}`, { params });
const post = <T>(path: string, data?: object) =>
  http.request<ApiResponse<T>>("post", `${root}${path}`, {
    data,
    timeout: 190000
  });
const put = <T>(path: string, data: object) =>
  http.request<ApiResponse<T>>("put", `${root}${path}`, { data });
export const getEvents = (params: Query) =>
  get<Page<Event>>("/health/events", params);
export const getTimeline = (params: Query) =>
  get<Timeline>("/health/timeline", params);
export const getTraces = (params: Query) =>
  get<Page<TraceSummary>>("/traces", params);
export const getTrace = (id: string) =>
  get<{ traceId: string; attempts: Attempt[] }>(`/traces/${part(id)}`);
export const getProbe = () => get<Probe>("/probe");
export const saveProbe = (data: ProbeSettings & { revision: number }) =>
  put<Probe>("/probe", data);
export const freeProbe = (id: string) => post(`/providers/${part(id)}/probe`);
export const getBalances = () => get<{ providers: Balance[] }>("/balances");
export const saveBilling = (id: string, data: object) =>
  put<Balance>(`/providers/${part(id)}/billing`, data);
export const refreshBalance = (id: string) =>
  post<Balance>(`/providers/${part(id)}/balance/refresh`);
export const manualBalance = (id: string, data: object) =>
  post<Balance>(`/providers/${part(id)}/balance/manual`, data);
export const balanceHistory = (id: string) =>
  get<{ items: Snapshot[] }>(`/providers/${part(id)}/balance/history`);
export const getAlerts = (params: Query) =>
  get<{ firingCount: number; items: Alert[] }>("/alerts", params);
export const getAlertSettings = () => get<AlertSettings>("/alerts/settings");
export const saveAlertSettings = (data: {
  rules: Record<string, boolean>;
  repeatMinutes: number;
  revision: number;
}) => put<AlertSettings>("/alerts/settings", data);
export const testAlert = () => post<{ result: string }>("/alerts/test");
export const money = (
  micro: number | null | undefined,
  currency: string | null | undefined
) =>
  micro == null
    ? "—"
    : `${(micro / 1000000).toFixed(4)} ${currency || "币种未知"}`;
export const time = (ms: number | null | undefined) =>
  ms == null ? "—" : new Date(ms).toLocaleString("zh-CN");
export const poolNames: Record<string, string> = {
  VISION: "识图",
  CHAT: "对话",
  IMAGE_PREMIUM: "生图·高质量",
  IMAGE_STANDARD: "生图·标准",
  PORTRAIT_PREMIUM: "形象图·高质量",
  PORTRAIT_STANDARD: "形象图·标准"
};
export const decisions: Record<string, string> = {
  FIRST: "首发",
  REROUTE: "改道",
  RESEND: "重发",
  DEGRADE: "降级",
  PROBE: "探活",
  MANUAL: "手动"
};

const errorNames: Record<string, string> = {
  PROVIDER_CONNECT_TIMEOUT: "连接超时",
  PROVIDER_UNREACHABLE: "连不上",
  PROVIDER_CONNECTION_FAILED: "连接中断",
  PROVIDER_NO_CHANNEL: "中转没有可用渠道",
  PROVIDER_TIMEOUT: "等待超时",
  PROVIDER_HTTP_401: "密钥或权限被拒",
  PROVIDER_HTTP_403: "密钥或权限被拒",
  PROVIDER_HTTP_402: "余额不足",
  PROVIDER_HTTP_429: "限流",
  PROVIDER_HTTP_500: "上游错误 500",
  PROVIDER_HTTP_502: "上游错误 502",
  PROVIDER_HTTP_503: "上游错误 503",
  PROVIDER_HTTP_504: "上游错误 504",
  PROVIDER_HTTP_529: "上游错误 529",
  PROVIDER_HTTP_400: "请求被拒",
  PROVIDER_HTTP_404: "请求被拒",
  PROVIDER_HTTP_413: "请求被拒",
  PROVIDER_HTTP_422: "请求被拒",
  PROVIDER_CONTENT_FILTERED: "内容被拦截",
  PROVIDER_EDITS_UNSUPPORTED: "不支持改图",
  PROVIDER_NO_IMAGE: "没有返回图片",
  PROVIDER_INVALID_RESPONSE: "返回格式不对",
  PROVIDER_INVALID_IMAGE: "图片无效",
  PROVIDER_IMAGE_DOWNLOAD_FAILED: "图片下载失败",
  PROVIDER_IMAGE_HOST_NOT_ALLOWED: "图片域名不在可信列表",
  PROVIDER_UPSTREAM_ERROR: "上游报错",
  PROVIDER_ERROR: "上游报错",
  PROVIDER_UNAVAILABLE: "暂不可用",
  PROVIDER_INTERRUPTED: "被中断",
  PROVIDER_NOT_CONFIGURED: "未配置",
  PROVIDER_CONFIG_CHANGED: "配置已变化"
};

export const errorName = (code: string | null | undefined) =>
  !code ? "—" : errorNames[code] ? `${errorNames[code]}（${code}）` : code;
