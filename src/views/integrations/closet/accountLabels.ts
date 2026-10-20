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
export const inviteStatusNames = {
  ACTIVE: "可使用",
  USED_UP: "名额已满",
  EXPIRED: "已过期",
  REVOKED: "已撤销"
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
