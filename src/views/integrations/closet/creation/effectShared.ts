import { onBeforeUnmount, reactive } from "vue";
import type { TemplateSummary, VersionSummary } from "@/api/closet/creation";

export type EffectState = {
  label: string;
  tone: "info" | "success" | "warning";
  name: string;
  published?: VersionSummary;
  draft?: VersionSummary;
};

// 线上版本、待上线草稿与展示状态都由版本列表推出。
export function effectState(t: TemplateSummary): EffectState {
  const versions = [...t.versions].sort((a, b) => b.version - a.version);
  const published = versions.find(v => v.versionId === t.publishedVersionId);
  const draft = versions.find(
    v =>
      (v.status === "DRAFT" || v.status === "VERIFIED") &&
      (!published || v.version > published.version)
  );
  const everPublished = versions.some(
    v => v.status === "PUBLISHED" || v.status === "RETIRED" || v.publishedAtMs
  );
  const name = (published ?? draft ?? versions[0])?.name || "未命名效果";
  if (!t.enabled && everPublished)
    return { label: "已下架", tone: "info", name, published, draft };
  if (published)
    return draft
      ? {
          label: "已上线 · 有改动未上线",
          tone: "warning",
          name,
          published,
          draft
        }
      : { label: "已上线", tone: "success", name, published, draft };
  return { label: "未上线", tone: "info", name, published, draft };
}

export const versionStatusText: Record<string, string> = {
  DRAFT: "草稿",
  VERIFIED: "待上线",
  PUBLISHED: "线上",
  RETIRED: "已下线"
};

export const lightText: Record<string, string> = {
  DEFAULT: "自然",
  WARM: "暖光",
  COOL: "冷光"
};

const roleText: Record<string, string> = {
  TOP: "上衣",
  INNER: "内搭",
  OUTER: "外套",
  BOTTOM: "下装",
  ONE_PIECE: "连衣裙",
  OVERALL: "连体",
  SHOES: "鞋",
  BAG: "包",
  HAT: "帽子",
  HEADWEAR: "帽子",
  SCARF: "围巾",
  ACCESSORY: "配饰"
};
export const roleLabel = (role: string) => roleText[role] ?? "其他";

// 后端的 message 直接给人看；冲突统一提示刷新（试做占用场景可保留后端原话）。
export function errorText(e: unknown, keepServerOn409 = false) {
  const r = (
    e as { response?: { status?: number; data?: { message?: string } } }
  ).response;
  if (r?.status === 409 && !(keepServerOn409 && r.data?.message))
    return "内容已被别人改过，请刷新后再试";
  return r?.data?.message || "请求失败，请重试";
}

// 带鉴权取回的图片转成 object URL，组件卸载时统一释放。
export function useBlobImages(fetcher: (id: string) => Promise<Blob>) {
  const urls = reactive<Record<string, string>>({});
  const pending = new Set<string>();
  let dead = false;
  function load(id: string) {
    if (id in urls || pending.has(id)) return;
    pending.add(id);
    fetcher(id)
      .then(blob => {
        if (!dead) urls[id] = URL.createObjectURL(blob);
      })
      .catch(() => {
        if (!dead) urls[id] = "";
      })
      .finally(() => pending.delete(id));
  }
  function drop(id: string) {
    if (urls[id]) URL.revokeObjectURL(urls[id]);
    delete urls[id];
  }
  onBeforeUnmount(() => {
    dead = true;
    Object.values(urls).forEach(u => u && URL.revokeObjectURL(u));
  });
  return { urls, load, drop };
}
