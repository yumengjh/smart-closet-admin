export const registeredViaNames = {
  ADMIN: "管理员创建",
  INVITE: "邀请码注册",
  OPEN: "开放注册"
};
export const registrationModeNames = {
  CLOSED: "关闭注册",
  INVITE: "仅限邀请",
  OPEN: "开放注册"
};
export const registrationModeHints = {
  CLOSED: "不接受新注册，账号只能由管理员创建。",
  INVITE: "注册时必须填写有效邀请码。",
  OPEN: "任何人都可以注册；填写邀请码时会记录来源。"
};
export const inviteStatusNames = {
  ACTIVE: "可使用",
  USED_UP: "名额已满",
  EXPIRED: "已过期",
  REVOKED: "已撤销"
};
export const inviteStatusTypes = {
  ACTIVE: "success",
  USED_UP: "warning",
  EXPIRED: "info",
  REVOKED: "danger"
} as const;
export const garmentStatusNames: Record<string, string> = {
  ACTIVE: "已入柜",
  DRAFT: "待入柜",
  TRASHED: "回收站"
};
const userActions: Record<string, string> = {
  REGISTERED: "注册",
  LOGIN_SUCCEEDED: "登录",
  PASSWORD_CHANGED: "修改密码",
  PROFILE_UPDATED: "修改资料",
  SESSIONS_REVOKED: "退出其他设备",
  DEACTIVATED: "注销账号"
};
const adminActions: Record<string, string> = {
  USER_CREATED: "创建用户",
  USER_ENABLED: "启用用户",
  USER_DISABLED: "禁用用户",
  ROLE_CHANGED: "修改角色",
  PASSWORD_RESET: "重置密码",
  SESSIONS_REVOKED: "退出全部设备",
  QUOTA_CHANGED: "修改额度"
};
export const accountActionNames: Record<string, string> = { ...userActions };
for (const [action, label] of Object.entries(adminActions)) {
  accountActionNames[`ADMIN_${action}`] = `鱼搭管理员${label}`;
  accountActionNames[`MANAGE_${action}`] = `管理平台${label}`;
}
Object.assign(accountActionNames, {
  MANAGE_PROFILE_UPDATED: "管理平台修改资料",
  MANAGE_LOGIN_UNLOCKED: "管理平台解除登录锁定"
});
export const accountActionName = (action: string) =>
  accountActionNames[action] ?? action;

/** Who acted: the user themself, an in-app 鱼搭 administrator, or this platform (manage:key[:operator]). */
export type ActionSource = "self" | "admin" | "platform";
export const actionSource = (action: string): ActionSource =>
  action.startsWith("MANAGE_")
    ? "platform"
    : action.startsWith("ADMIN_")
      ? "admin"
      : "self";
export const actionSourceTypes = {
  self: "info",
  admin: "warning",
  platform: "primary"
} as const;
export const actorLabel = (actor: string, username?: string) => {
  if (username && actor === username) return "本人";
  if (actor === "manage") return "管理平台";
  if (actor.startsWith("manage:")) {
    const [, , operator] = actor.split(":");
    return operator ? `管理平台 · ${operator}` : "管理平台";
  }
  return actor;
};

/** Turns the compact key=value detail of an account event into a readable sentence. */
export const eventDetailText = (detail?: string | null) => {
  if (!detail) return "";
  const fields = Object.fromEntries(
    detail.split(",").map(part => {
      const index = part.indexOf("=");
      return index < 0
        ? [part, ""]
        : [part.slice(0, index), part.slice(index + 1)];
    })
  );
  const parts: string[] = [];
  if (fields.via)
    parts.push(
      `来源：${registeredViaNames[fields.via as keyof typeof registeredViaNames] ?? fields.via}`
    );
  if (fields.role)
    parts.push(`角色：${fields.role === "ADMIN" ? "管理员" : "普通用户"}`);
  if ("image" in fields || "agent" in fields) {
    const quota = (value: string | undefined, name: string, unit: string) =>
      !value || value === "null"
        ? `${name}用默认额度`
        : `${name} ${value} ${unit}`;
    parts.push(
      `${quota(fields.image, "图片", "次/日")}，${quota(fields.agent, "助手", "条/日")}`
    );
  }
  if (fields.revokedSessions !== undefined)
    parts.push(
      fields.revokedSessions === "0"
        ? "无会话需要退出"
        : `退出 ${fields.revokedSessions} 个会话`
    );
  return parts.length ? parts.join("；") : detail;
};

export const dateTime = (value?: number | null) => {
  if (!value) return "—";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
/** "3 分钟前" / "2 天前"; falls back to the date for anything older than 30 days. */
export const relativeTime = (value?: number | null, now = Date.now()) => {
  if (!value) return "从未";
  const diff = now - value;
  if (diff < 0) return dateTime(value);
  const minute = 60_000,
    hour = 60 * minute,
    day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  return dateTime(value).slice(0, 10);
};
/** Remaining lifetime of an invite: "剩 3 天" / "剩 5 小时" / "已过期". */
export const remainingText = (expiresAtMs: number, now = Date.now()) => {
  const diff = expiresAtMs - now;
  if (diff <= 0) return "已过期";
  const hours = Math.floor(diff / 3_600_000);
  return hours >= 24
    ? `剩 ${Math.floor(hours / 24)} 天`
    : `剩 ${Math.max(1, hours)} 小时`;
};
/** Last sign-in, falling back to session activity for accounts that signed in before sign-ins were recorded. */
export const lastSeen = (user: {
  lastLoginAtMs?: number | null;
  lastActiveAtMs?: number | null;
}) =>
  user.lastLoginAtMs
    ? { at: user.lastLoginAtMs, label: relativeTime(user.lastLoginAtMs) }
    : user.lastActiveAtMs
      ? {
          at: user.lastActiveAtMs,
          label: `活跃于 ${relativeTime(user.lastActiveAtMs)}`
        }
      : { at: null, label: "从未登录" };
export const initial = (text?: string | null) =>
  (text?.trim()?.[0] ?? "?").toUpperCase();
