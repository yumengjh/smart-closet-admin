import { onBeforeUnmount, reactive } from "vue";
import type { TemplateSummary, VersionSummary } from "@/api/closet/creation";

export type EffectState = {
  label: string;
  tone: "info" | "success" | "warning";
  name: string;
  published?: VersionSummary;
  draft?: VersionSummary;
  everPublished: boolean;
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
  const name =
    t.name || (published ?? draft ?? versions[0])?.name || "未命名效果";
  if (!t.enabled && everPublished)
    return {
      label: "已下架",
      tone: "info",
      name,
      published,
      draft,
      everPublished
    };
  if (published)
    return draft
      ? {
          label: "已上线 · 有改动未上线",
          tone: "warning",
          name,
          published,
          draft,
          everPublished
        }
      : {
          label: "已上线",
          tone: "success",
          name,
          published,
          draft,
          everPublished
        };
  return {
    label: "未上线",
    tone: "info",
    name,
    published,
    draft,
    everPublished
  };
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
  if (r?.status === 429) return "请求太频繁，请稍等几秒再试";
  if (r?.status === 409 && !(keepServerOn409 && r.data?.message))
    return "内容已被别人改过，请刷新后再试";
  return r?.data?.message || "请求失败，请重试";
}

// 带鉴权取回的图片：全局最多 4 个并发，同一张图在页面生命周期内只取一次。
const cache = new Map<string, string>();
const queue: Array<() => Promise<void>> = [];
let running = 0;
let generation = 0;
function pump() {
  while (running < 4 && queue.length) {
    const task = queue.shift()!;
    running++;
    void task().finally(() => {
      running--;
      pump();
    });
  }
}
// 离开创作页时统一释放缓存里的 object URL。
export function clearImageCache() {
  generation++;
  queue.length = 0;
  cache.forEach(url => URL.revokeObjectURL(url));
  cache.clear();
}

export function useBlobImages(
  kind: string,
  fetcher: (id: string) => Promise<Blob>
) {
  const urls = reactive<Record<string, string>>({});
  const pending = new Set<string>();
  let dead = false;
  const full = (id: string) => `${kind}:${id}`;
  function load(id: string) {
    if (id in urls || pending.has(id)) return;
    const hit = cache.get(full(id));
    if (hit) {
      urls[id] = hit;
      return;
    }
    pending.add(id);
    const born = generation;
    queue.push(async () => {
      try {
        const blob = await fetcher(id);
        const url = URL.createObjectURL(blob);
        if (born !== generation) URL.revokeObjectURL(url);
        else cache.set(full(id), url);
        if (!dead && born === generation) urls[id] = url;
      } catch {
        if (!dead) urls[id] = "";
      } finally {
        pending.delete(id);
      }
    });
    pump();
  }
  function drop(id: string) {
    const url = cache.get(full(id));
    if (url) URL.revokeObjectURL(url);
    cache.delete(full(id));
    delete urls[id];
  }
  onBeforeUnmount(() => {
    dead = true;
  });
  return { urls, load, drop };
}
