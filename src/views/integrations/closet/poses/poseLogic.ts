import type {
  PoseCheckSide,
  PoseCheckValues,
  PoseHitKind,
  PoseKeypoints
} from "@/api/closet/poses";

/** Same order as the closet server's PoseCards.JOINTS. */
export const JOINTS = [
  "HEAD",
  "NECK",
  "L_SHOULDER",
  "R_SHOULDER",
  "L_ELBOW",
  "R_ELBOW",
  "L_WRIST",
  "R_WRIST",
  "L_HIP",
  "R_HIP",
  "L_KNEE",
  "R_KNEE",
  "L_ANKLE",
  "R_ANKLE"
] as const;
export type Joint = (typeof JOINTS)[number];

export const BONES: ReadonlyArray<readonly [Joint, Joint]> = [
  ["HEAD", "NECK"],
  ["NECK", "L_SHOULDER"],
  ["NECK", "R_SHOULDER"],
  ["L_SHOULDER", "L_ELBOW"],
  ["L_ELBOW", "L_WRIST"],
  ["R_SHOULDER", "R_ELBOW"],
  ["R_ELBOW", "R_WRIST"],
  ["L_SHOULDER", "L_HIP"],
  ["R_SHOULDER", "R_HIP"],
  ["L_HIP", "R_HIP"],
  ["L_HIP", "L_KNEE"],
  ["L_KNEE", "L_ANKLE"],
  ["R_HIP", "R_KNEE"],
  ["R_KNEE", "R_ANKLE"]
];

/** The preview canvas is always 3:4, matching the frame the keypoints were measured in. */
export const CANVAS = { width: 300, height: 400 } as const;

export type CanvasPoint = { joint: Joint; x: number; y: number };
export type CanvasLine = {
  from: Joint;
  to: Joint;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Map a 0–1 keypoint to canvas pixels; malformed points are dropped, out-of-range ones clamped. */
export function toCanvas(
  point: unknown,
  width: number = CANVAS.width,
  height: number = CANVAS.height
): { x: number; y: number } | null {
  if (!Array.isArray(point) || point.length < 2) return null;
  const [x, y] = point;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp(x) * width, y: clamp(y) * height };
}

/** Points and bones for the read-only skeleton preview; unknown joints are ignored. */
export function skeleton(
  keypoints: PoseKeypoints | null | undefined,
  width: number = CANVAS.width,
  height: number = CANVAS.height
) {
  const placed = new Map<Joint, { x: number; y: number }>();
  for (const joint of JOINTS) {
    const point = toCanvas(keypoints?.[joint], width, height);
    if (point) placed.set(joint, point);
  }
  const points: CanvasPoint[] = [...placed].map(([joint, p]) => ({
    joint,
    ...p
  }));
  const lines: CanvasLine[] = BONES.flatMap(([from, to]) => {
    const a = placed.get(from);
    const b = placed.get(to);
    return a && b ? [{ from, to, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
  });
  return { points, lines };
}

export const SIDES = { user: "用户端", admin: "管理端" } as const;
export const CHECK_KINDS: Record<keyof PoseCheckSide, string> = {
  suggestive: "性感动作",
  nudity: "裸露",
  minor: "疑似未成年"
};
export const HIT_KINDS: Record<PoseHitKind, string> = {
  SUGGESTIVE: "性感动作",
  NUDITY: "裸露",
  MINOR: "疑似未成年"
};

export type CheckChange = {
  side: keyof PoseCheckValues;
  kind: keyof PoseCheckSide;
  from: boolean;
  to: boolean;
  text: string;
};

/** Every switch that differs between the saved and edited settings, in display order. */
export function checkChanges(
  before: PoseCheckValues,
  after: PoseCheckValues
): CheckChange[] {
  const changes: CheckChange[] = [];
  for (const side of Object.keys(SIDES) as Array<keyof PoseCheckValues>) {
    for (const kind of Object.keys(CHECK_KINDS) as Array<keyof PoseCheckSide>) {
      const from = before[side][kind];
      const to = after[side][kind];
      if (from === to) continue;
      changes.push({
        side,
        kind,
        from,
        to,
        text: `${SIDES[side]} · ${CHECK_KINDS[kind]}：${from ? "开" : "关"} → ${to ? "开" : "关"}`
      });
    }
  }
  return changes;
}

export const POSE_ID = /^[a-z][a-z0-9-]{1,39}$/;

/** Trim, drop blanks and duplicates, keep the first `max` tags. */
export function cleanTags(tags: string[], max = 8) {
  const seen = new Set<string>();
  for (const tag of tags) {
    const value = tag.trim();
    if (value) seen.add(value);
  }
  return [...seen].slice(0, max);
}
