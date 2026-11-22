import type { LookCoverage, LookGender } from "@/api/closet/looks";

export type LookForm = {
  name: string;
  category: string;
  tags: string[];
  coverage: LookCoverage;
  gender: LookGender;
};

export const CATEGORY_KEY = /^[a-z][a-z0-9-]{1,23}$/;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const COMPOSE_MIN = 2;
export const COMPOSE_MAX = 6;

const length = (value: string) => [...value.trim()].length;

export function categoryProblem(key: string | null, name: string) {
  if (key !== null && !CATEGORY_KEY.test(key))
    return "标识以小写字母开头，只用小写字母、数字和短横线，2–24 个字符";
  const size = length(name);
  if (size < 1 || size > 8) return "分类名称 1–8 个字";
  return "";
}

/** Tags are trimmed, de-duplicated, at most 8, each 1–8 characters. */
export function lookTags(tags: string[]) {
  const seen = new Set<string>();
  for (const tag of tags) {
    const value = tag.trim();
    if (value) seen.add(value);
  }
  return [...seen].slice(0, 8);
}

export function lookProblem(form: {
  name: string;
  category: string;
  tags: string[];
}) {
  const size = length(form.name);
  if (size < 1 || size > 16) return "名称 1–16 个字";
  if (!form.category) return "请选择分类";
  if (lookTags(form.tags).some(tag => length(tag) > 8))
    return "每个标签最多 8 个字";
  return "";
}

export function composeProblem(count: number) {
  if (count < COMPOSE_MIN) return `至少选 ${COMPOSE_MIN} 件`;
  if (count > COMPOSE_MAX) return `最多选 ${COMPOSE_MAX} 件`;
  return "";
}

export function imageProblem(file: { type: string; size: number }) {
  if (!IMAGE_TYPES.includes(file.type)) return "请选择 PNG、JPEG 或 WebP 图片";
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    return "图片不能为空，且不能超过 20 MB";
  return "";
}
