import { http } from "@/utils/http";
import type { ApiResponse } from "../user";
import type { Capability } from "./models";

export type UsageCost = { currency: string; amountMicro: number };
type UsageCounts = {
  calls: number;
  ok: number;
  failed: number;
  successRate: number | null;
  inputTokens: number;
  outputTokens: number;
  images: number;
  costs: UsageCost[];
  unpricedCalls: number;
};
export type ModelUsage = {
  scope: { from: string; to: string };
  totals: UsageCounts & { requests: number; cancelled: number };
  byProvider: (UsageCounts & {
    providerId: string;
    providerName: string;
    lastCallAtMs: number | null;
  })[];
  byModel: (UsageCounts & {
    capability: Capability;
    providerId: string;
    model: string;
    entryId: string | null;
    label: string | null;
    requests: number;
    cancelled: number;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    reroutedCalls: number;
    stitchedCalls: number;
    lastCallAtMs: number | null;
  })[];
  byPurpose: {
    capability: Capability;
    purpose: string;
    calls: number;
    failed: number;
  }[];
  daily: {
    date: string;
    calls: number;
    failed: number;
    inputTokens: number;
    outputTokens: number;
    images: number;
    costs: UsageCost[];
  }[];
  errors: {
    providerId: string;
    model: string;
    errorCode: string | null;
    count: number;
    lastAtMs: number;
  }[];
  recent: {
    atMs: number;
    capability: Capability;
    providerId: string;
    model: string;
    purpose: string;
    outcome: string;
    errorCode: string | null;
    latencyMs: number;
    requests: number;
    inputTokens: number | null;
    outputTokens: number | null;
    images: number;
    rerouted: boolean;
    stitched: number;
    costMicro: number | null;
    costCurrency: string | null;
  }[];
  note: string;
};
export type ModelUsageQuery = {
  from: string;
  to: string;
  capability?: Capability;
  providerId?: string;
  model?: string;
};
export const getModelUsage = (params: ModelUsageQuery) =>
  http.request<ApiResponse<ModelUsage>>("get", "/closet/models/usage", {
    params
  });
