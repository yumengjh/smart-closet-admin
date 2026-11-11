import { http } from "@/utils/http";
import type { ApiResponse } from "../user";

export type Switches = {
  enabled: boolean;
  tryon: boolean;
  image: boolean;
  agent: boolean;
  showPrices: boolean;
};
export type SettingsInput = {
  enabled: boolean | null;
  tryonEnabled: boolean | null;
  imageEnabled: boolean | null;
  agentEnabled: boolean | null;
  showPrices: boolean | null;
};
export type Settings = {
  billingActive: boolean;
  state: {
    effective: Switches;
    defaults: Switches;
    overridden: Record<string, boolean>;
  };
};
export type Tier = {
  tier: string;
  name: string;
  unit: string;
  model: string;
  milliPointsPerUnit: number | null;
  priceVersionId: string | null;
};
export type TierInput = {
  model?: string;
  milliPointsPerUnit?: number;
  effectiveFromMs?: number;
};
export type CostInput = {
  model: string;
  unit: "PER_IMAGE" | "PER_MTOK_IN" | "PER_MTOK_OUT" | "PER_SECOND";
  amountMicro: number;
  currency: string;
  effectiveFromMs?: number;
  note?: string;
};
export type CostRate = CostInput & { id: string; effectiveFromMs: number };
export type ProductInput = {
  kind: "POINTS" | "SUBSCRIPTION";
  name: string;
  currency: string;
  priceMinor: number;
  points?: number;
  entDays?: number;
  entImageDailyLimit?: number;
  entAgentDailyLimit?: number;
  enabled: boolean;
  sortOrder: number;
};
export type ProductChange = Pick<
  ProductInput,
  "name" | "priceMinor" | "enabled" | "sortOrder"
>;
export type Product = ProductInput & { id: string };
export type OrderStatus =
  | "CREATED"
  | "PAID"
  | "FULFILLED"
  | "CLOSED"
  | "FAILED"
  | "DISPUTED";
export type Order = {
  id: string;
  userKey: string;
  productName: string;
  currency: string;
  amountMinor: number;
  channel: string;
  status: OrderStatus;
  feeMinor: number;
  feeEstimated: boolean;
  createdAtMs: number;
};
export type BatchInput = {
  name: string;
  points: number;
  quantity: number;
  unitPriceMicro: number;
  currency?: string;
  imageDailyLimit?: number;
  agentDailyLimit?: number;
  entitlementDays?: number;
  validFromMs?: number;
  validUntilMs?: number;
};
export type Batch = BatchInput & {
  id: string;
  batchNo: string;
  status: string;
  available: number;
  redeemed: number;
};
export type Code = {
  id: string;
  mask: string;
  status: string;
  redeemedByUserKey: string | null;
  redeemedAtMs: number | null;
};
export type ReportRow = Record<string, string | number | boolean | null>;
export type Margin = {
  fromMs: number;
  toMs: number;
  totals: ReportRow[];
  orderLines: ReportRow[];
  lines: ReportRow[];
  liabilities: ReportRow[];
  notes: string[];
};
const root = "/closet/billing";
export const getSettings = () =>
  http.request<ApiResponse<Settings>>("get", `${root}/settings`);
export const putSettings = (data: SettingsInput) =>
  http.request<ApiResponse<Settings>>("put", `${root}/settings`, { data });
export const getTiers = () =>
  http.request<ApiResponse<Tier[]>>("get", `${root}/tiers`);
export const putTier = (tier: string, data: TierInput) =>
  http.request<ApiResponse<Tier>>(
    "put",
    `${root}/tiers/${encodeURIComponent(tier)}`,
    { data }
  );
export const getCosts = () =>
  http.request<ApiResponse<CostRate[]>>("get", `${root}/cost-rates`);
export const postCost = (data: CostInput) =>
  http.request<ApiResponse<CostRate>>("post", `${root}/cost-rates`, { data });
export const getProducts = () =>
  http.request<ApiResponse<Product[]>>("get", `${root}/products`);
export const postProduct = (data: ProductInput) =>
  http.request<ApiResponse<Product>>("post", `${root}/products`, { data });
export const putProduct = (id: string, data: ProductChange) =>
  http.request<ApiResponse<Product>>(
    "put",
    `${root}/products/${encodeURIComponent(id)}`,
    { data }
  );
export const getOrders = (status?: OrderStatus, limit = 100) =>
  http.request<ApiResponse<Order[]>>("get", `${root}/orders`, {
    params: { status, limit }
  });
export const disputeOrder = (id: string) =>
  http.request<ApiResponse<Order>>(
    "post",
    `${root}/orders/${encodeURIComponent(id)}/sandbox-dispute`
  );
export const getBatches = () =>
  http.request<ApiResponse<Batch[]>>("get", `${root}/redemption-batches`);
export const postBatch = (data: BatchInput) =>
  http.request<ApiResponse<{ batch: Batch; codes: string[] }>>(
    "post",
    `${root}/redemption-batches`,
    { data }
  );
export const getCodes = (id: string) =>
  http.request<ApiResponse<Code[]>>(
    "get",
    `${root}/redemption-batches/${encodeURIComponent(id)}/codes`
  );
export const disableBatch = (id: string) =>
  http.request<ApiResponse<Batch>>(
    "post",
    `${root}/redemption-batches/${encodeURIComponent(id)}/disable`
  );
export const getMargin = (from: string, to: string) =>
  http.request<ApiResponse<Margin>>("get", `${root}/margin`, {
    params: { from, to }
  });
export const getAlerts = () =>
  http.request<ApiResponse<ReportRow[]>>("get", `${root}/margin/alerts`);

export type Entitlement = {
  id: string;
  source: string;
  imageDailyLimit: number | null;
  agentDailyLimit: number | null;
  startsAtMs: number;
  endsAtMs: number;
  active: boolean;
  revokedAtMs: number | null;
};
export type UserBilling = {
  userKey: string;
  balance: number;
  reserved: number;
  entitlements: Entitlement[];
  recent: {
    id: string;
    kind: string;
    points: number;
    note: string;
    createdAtMs: number;
  }[];
};
export type Usage = {
  id: string;
  userKey: string;
  tier: string;
  model: string;
  unitsIn: number;
  unitsOut: number;
  source: string;
  points: number;
  revenueMicro: number;
  revenueCurrency: string;
  costMicro: number | null;
  costCurrency: string | null;
  failed: boolean;
  atMs: number;
  costRates: CostRate[];
};
export type Explain = {
  tier: string;
  fromMs: number;
  toMs: number;
  items: Usage[];
};
export const getExplain = (
  tier: string,
  from: string,
  to: string,
  limit = 100
) =>
  http.request<ApiResponse<Explain>>("get", `${root}/margin/explain`, {
    params: { tier, from, to, limit }
  });
export const getUserBilling = (username: string) =>
  http.request<ApiResponse<UserBilling>>(
    "get",
    `/closet/users/${encodeURIComponent(username)}/billing`
  );
export const changePoints = (
  username: string,
  data: { points: number; note?: string },
  key: string
) =>
  http.request<ApiResponse<unknown>>(
    "post",
    `/closet/users/${encodeURIComponent(username)}/points`,
    {
      data,
      headers: { "Idempotency-Key": key }
    }
  );
export const grantEntitlement = (
  username: string,
  data: {
    imageDailyLimit?: number;
    agentDailyLimit?: number;
    days: number;
    note?: string;
  }
) =>
  http.request<ApiResponse<Entitlement>>(
    "post",
    `/closet/users/${encodeURIComponent(username)}/entitlements`,
    { data }
  );
export const revokeEntitlement = (id: string) =>
  http.request<ApiResponse<Entitlement>>(
    "delete",
    `${root}/entitlements/${encodeURIComponent(id)}`
  );
