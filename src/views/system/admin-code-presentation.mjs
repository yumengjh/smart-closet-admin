const definitions = {
  userStatus: {
    ACTIVE: ["正常", "账号可以正常登录和使用后台。"],
    LOCKED: ["已锁定", "账号因安全策略暂时锁定，不能登录。"],
    DISABLED: ["已禁用", "账号被管理员禁用，不能登录。"]
  },
  role: {
    SUPER_ADMIN: ["超级管理员", "拥有全部系统管理权限。"],
    ADMIN: ["管理员", "可按授予的权限管理系统。"],
    USER: ["普通用户", "基础登录用户角色。"]
  },
  permission: {
    "system:user:read": ["查看用户列表与用户资料", "允许读取用户列表和用户资料。"],
    "system:user:write": ["修改用户资料与账号状态", "允许修改用户资料、状态和会话。"],
    "system:role:read": ["查看角色与权限目录", "允许读取角色和权限信息。"],
    "system:role:write": ["管理角色、权限与角色授权", "允许维护角色、权限及其授权关系。"],
    "system:role:assign": ["为用户分配或移除角色", "允许修改用户拥有的角色。"],
    "system:menu:read": ["查看后台菜单配置", "允许读取后台动态菜单。"],
    "system:menu:write": ["新建、编辑或删除后台菜单", "允许维护后台动态菜单。"],
    "system:config:read": ["查看运行时系统配置", "允许读取运行时系统配置和 IP 规则。"],
    "system:config:write": ["修改运行时系统配置", "允许修改运行时系统配置和 IP 规则。"],
    "system:audit:read": ["查看系统审计日志", "允许读取系统审计事件。"],
    "example:announcement:read": ["查看公告管理内容", "允许读取公告管理数据。"],
    "example:announcement:write": ["创建、编辑与发布公告", "允许维护和发布公告。"],
    "example:announcement:delete": ["删除公告", "允许删除公告。"],
    "resume:manage": ["管理公开简历", "允许查看和编辑公开简历的全部内容。"]
  },
  navigationComponent: {
    welcome: ["首页", "后台首页页面组件。"],
    "permission-page": ["权限示例页", "权限控制示例页面组件。"],
    "menu-management": ["菜单管理", "后台菜单管理页面组件。"],
    "user-management": ["用户管理", "后台用户管理页面组件。"],
    "rbac-management": ["角色与权限", "后台角色与权限管理页面组件。"],
    "runtime-config": ["运行时配置", "运行时系统配置页面组件。"],
    "ip-rule-management": ["IP 访问规则", "IP 访问规则管理页面组件。"],
    "audit-log": ["审计日志", "系统审计日志页面组件。"],
    "announcement-management": ["公告管理", "公告管理页面组件。"],
    "resume-management": ["简历管理", "公开简历内容管理页面组件。"],
    "account-security": ["账户安全", "个人账户与会话安全页面组件。"]
  },
  ipRuleType: {
    ALLOW: ["允许访问", "命中该规则的 IP 或网段允许访问 API。"],
    DENY: ["拒绝访问", "命中该规则的 IP 或网段会被拒绝访问 API。"]
  },
  ipScope: {
    API: ["API 接口", "规则仅作用于 API 接口请求。"]
  },
  auditResult: {
    SUCCESS: ["成功", "操作已成功完成。"],
    FAILURE: ["失败", "操作未能完成，请查看附加元数据了解原因。"]
  },
  auditTargetType: {
    User: ["用户", "用户账号或其会话。"],
    Role: ["角色", "角色及其授权关系。"],
    Permission: ["权限", "权限目录项。"],
    RefreshSession: ["登录会话", "刷新令牌对应的登录会话。"],
    RuntimeSetting: ["运行时配置", "无需重启即可生效的系统配置。"],
    IpAccessRule: ["IP 访问规则", "持久化的 API IP 访问控制规则。"],
    Announcement: ["公告", "后台维护的公告内容。"],
    ResumeDocument: ["简历", "公开简历的动态内容文档。"],
    NavigationMenu: ["后台菜单", "后台动态导航菜单项。"]
  },
  auditAction: {
    LOGIN_FAILED: ["登录失败", "用户登录验证未通过。"],
    LOGIN_SUCCEEDED: ["登录成功", "用户成功完成登录。"],
    TOKEN_REFRESHED: ["刷新登录会话", "使用刷新令牌签发了新的访问令牌。"],
    LOGOUT: ["退出登录", "登录会话已退出。"],
    USER_REGISTERED: ["注册用户", "创建了新的用户账号。"],
    USER_SESSIONS_REVOKED: ["撤销用户会话", "该用户的所有登录会话已失效。"],
    USER_STATUS_UPDATED: ["更新用户状态", "修改了用户账号的可用状态。"],
    USER_ROLE_ASSIGNED: ["分配用户角色", "为用户添加了一个角色。"],
    USER_ROLE_REMOVED: ["移除用户角色", "从用户移除了一个角色。"],
    ROLE_CREATED: ["创建角色", "创建了一个新角色。"],
    ROLE_UPDATED: ["更新角色", "修改了角色名称。"],
    ROLE_DELETED: ["删除角色", "删除了角色及其关联关系。"],
    ROLE_PERMISSION_GRANTED: ["授予角色权限", "为角色添加了一个权限。"],
    ROLE_PERMISSION_REVOKED: ["撤销角色权限", "从角色移除了一个权限。"],
    PERMISSION_CREATED: ["创建权限", "创建了一个权限目录项。"],
    PERMISSION_UPDATED: ["更新权限", "修改了权限说明。"],
    PERMISSION_DELETED: ["删除权限", "删除了权限目录项及其授权关系。"],
    RUNTIME_SETTING_UPDATED: ["更新运行时配置", "修改了无需重启即可生效的配置。"],
    IP_ACCESS_RULE_CREATED: ["创建 IP 规则", "新增了一条 IP 访问规则。"],
    IP_ACCESS_RULE_DELETED: ["删除 IP 规则", "删除了一条 IP 访问规则。"],
    ANNOUNCEMENT_CREATED: ["创建公告", "新增了一篇公告。"],
    ANNOUNCEMENT_UPDATED: ["更新公告", "修改了一篇公告。"],
    ANNOUNCEMENT_PUBLISHED: ["发布公告", "将公告设为公开可见。"],
    ANNOUNCEMENT_UNPUBLISHED: ["撤回公告", "将公告从公开状态撤回。"],
    ANNOUNCEMENT_DELETED: ["删除公告", "删除了一篇公告。"],
    RESUME_UPDATED: ["更新简历", "修改了公开简历内容。"],
    NAVIGATION_MENU_CREATED: ["创建后台菜单", "新增了一个后台导航菜单项。"],
    NAVIGATION_MENU_UPDATED: ["更新后台菜单", "修改了一个后台导航菜单项。"],
    NAVIGATION_MENU_DELETED: ["删除后台菜单", "删除了一个后台导航菜单项。"],
    REFRESH_TOKEN_REUSE_DETECTED: ["检测到令牌重用", "同一刷新令牌被重复使用，系统已撤销该令牌家族。"]
  }
};

const definition = (category, code) => definitions[category]?.[code];

export const adminCodeLabel = (category, code) =>
  definition(category, code)?.[0] || code || "-";

export const adminCodeTooltip = (category, code) => {
  const item = definition(category, code);
  return item ? `${item[1]}（${code}）` : code || "-";
};
