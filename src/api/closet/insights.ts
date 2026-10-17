import { http } from "@/utils/http";
import { stringify } from "qs";
import type { ApiResponse } from "../user";

export type InsightScope = {
  username: string | null;
  from?: string;
  to?: string;
};
export type CountItem = { key: string; count: number };
export type InsightOverview = {
  scope: InsightScope;
  users?: {
    total: number;
    enabled: number;
    activeInRange: number;
    createdInRange: number;
  };
  garments: {
    active: number;
    draft: number;
    createdInRange: number;
    adoptedInRange: number;
    adoptionRate: number | null;
  };
  outfits: { total: number; createdInRange: number };
  outfitPlans: { createdInRange: number };
  quickIntakes: { createdInRange: number };
  ai: { imageUnitsInRange: number; agentMessagesInRange: number };
  generatedAtMs: number;
  mappingVersion: string;
};
export type WardrobeInsight = {
  scope: InsightScope;
  totalActive: number;
  categories: CountItem[];
  colors: CountItem[];
  seasons: CountItem[];
  unknownCategoryCount: number;
  unknownSeasonCount: number;
  favoriteCount: number;
  wearingConfirmedCount: number;
  mappingVersion: string;
};
export type GarmentInsight = {
  garmentId: string;
  owner: string;
  name: string | null;
  family: string;
  createdAtMs: number;
  outfitCount?: number;
};
export type UsageInsight = {
  scope: InsightScope;
  outfitCount: number;
  topUsed: GarmentInsight[];
  idle: { count: number; ratio: number | null; sample: GarmentInsight[] };
  byFamily: Array<{ key: string; active: number; usedInOutfits: number }>;
};
export type TrendMetric =
  | "garments_created"
  | "garments_adopted"
  | "outfits_created"
  | "quick_intakes"
  | "image_units"
  | "agent_messages"
  | "users_created"
  | "active_users"
  | "recommendations_shown"
  | "recommendation_likes"
  | "recommendation_dislikes"
  | "wear_logs"
  | "model_calls"
  | "model_tokens"
  | "ootd_samples";
export type TrendInsight = {
  granularity: "day" | "week" | "month";
  buckets: string[];
  series: Array<{ metric: TrendMetric; values: number[] }>;
};
export type InsightDateParams = {
  username?: string;
  from?: string;
  to?: string;
};
export type TrendParams = InsightDateParams & {
  metric: TrendMetric[];
  granularity: "day" | "week" | "month";
};

const root = "/closet/insights";
export const getClosetOverview = (params: InsightDateParams) =>
  http.request<ApiResponse<InsightOverview>>("get", `${root}/overview`, {
    params
  });
export const getClosetWardrobe = (
  params: Pick<InsightDateParams, "username">
) =>
  http.request<ApiResponse<WardrobeInsight>>("get", `${root}/wardrobe`, {
    params
  });
export const getClosetUsage = (params: Pick<InsightDateParams, "username">) =>
  http.request<ApiResponse<UsageInsight>>("get", `${root}/usage`, { params });
export const getClosetTrends = (params: TrendParams) =>
  http.request<ApiResponse<TrendInsight>>("get", `${root}/trends`, {
    params,
    paramsSerializer: {
      serialize: query => stringify(query, { arrayFormat: "repeat" })
    }
  });

/** Display names for closet-families-v1 category codes; unknown codes fall back to the code itself. */
export const closetFamilyLabels: Record<string, string> = {
  TOP: "上装",
  SHIRT: "衬衫",
  OUTER: "外套",
  PANTS: "裤装",
  SKIRT: "半身裙",
  DRESS: "连衣裙",
  ONE_PIECE: "连体衣",
  SHOES: "鞋履",
  ACCESSORY: "配饰",
  UNKNOWN: "未分类"
};

export const closetFamilyLabel = (code: string) =>
  closetFamilyLabels[code] ?? code;

export type AdoptionRow = {
  shown: number;
  adopted: number;
  adoptionRate: number | null;
};
export type RecommendationKpi = AdoptionRow & {
  scope: InsightScope;
  liked: number;
  disliked: number;
  likeRate: number | null;
  openedInWorkspace: number;
  wornWithin3Days: number;
  swaps: number;
  users: number;
  bySource: Array<AdoptionRow & { source: string }>;
  byRank: Array<AdoptionRow & { rank: number }>;
  templates: Array<AdoptionRow & { template: string }>;
  daily: Array<{ date: string; shown: number; adopted: number }>;
  definition: string;
};
export type AiUsage = {
  scope: InsightScope;
  byFeature: Array<{
    feature: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    unknownUsage: number;
  }>;
  totals: { calls: number; inputTokens: number; outputTokens: number };
  imageUnits: number;
  agentMessages: number;
  recommendations: {
    total: number;
    zeroModel: number;
    zeroModelRatio: number | null;
  };
  topUsers?: Array<{ username: string; calls: number; tokens: number }>;
  note: string;
};
export const getClosetRecommendations = (params: InsightDateParams) =>
  http.request<ApiResponse<RecommendationKpi>>(
    "get",
    `${root}/recommendations`,
    { params }
  );
export const getClosetAi = (params: InsightDateParams) =>
  http.request<ApiResponse<AiUsage>>("get", `${root}/ai`, { params });

export const metricNames: Record<TrendMetric, string> = {
  garments_created: "新增衣物",
  garments_adopted: "采纳衣物",
  outfits_created: "新增搭配",
  quick_intakes: "快速入柜",
  image_units: "图片用量",
  agent_messages: "助手消息",
  users_created: "新增用户",
  active_users: "活跃用户",
  recommendations_shown: "推荐展示",
  recommendation_likes: "推荐点赞",
  recommendation_dislikes: "推荐点踩",
  wear_logs: "穿搭打卡",
  model_calls: "模型调用",
  model_tokens: "模型 Token",
  ootd_samples: "穿搭样本"
};
