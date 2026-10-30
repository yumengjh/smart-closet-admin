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
    "closet:registration:read": ["查看注册与邀请", "读取注册模式、邀请码及使用者。"],
    "closet:registration:write": ["管理注册与邀请", "切换注册模式、创建、编辑及撤销邀请码。"],
    "closet:user:read": [
      "查看鱼搭业务用户",
      "读取鱼搭账号、会话、便携链接与额度。"
    ],
    "closet:user:write": [
      "管理鱼搭业务用户",
      "创建账号、管理状态、角色和会话。"
    ],
    "closet:user:reset-password": ["重置鱼搭密码", "生成一次性临时密码。"],
    "closet:quota:write": ["调整鱼搭额度", "修改图片与助手每日额度。"],
    "closet:insights:read": ["查看鱼搭洞察", "读取衣柜、推荐与 AI 指标。"],
    "closet:ops:read": [
      "查看鱼搭运行监控",
      "只读健康状态、后台任务和操作日志。"
    ],
    "closet:dashboard:read": ["查看鱼搭大屏", "读取汇总业务快照。"],
    "closet:exports:read": ["导出鱼搭数据", "读取按天宽表和去标识事件。"],
    "closet:templates:read": ["查看鱼搭模板", "读取搭配模板和审核记录。"],
    "closet:templates:write": ["审核鱼搭模板", "调整审核状态、启用与加分。"],
    "closet:styleterms:read": ["查看鱼搭待审风格词", "读取助手学到、等待审核的风格词。"],
    "closet:styleterms:write": ["审核鱼搭风格词", "批准或驳回风格词，批准后对全站生效。"],
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
    "account-security": ["账户安全", "个人账户与会话安全页面组件。"],
    "closet-registration": ["注册与邀请", "注册模式与邀请码管理。"],
    "closet-account-events": ["账号审计", "鱼搭账号事件查询。"],
    "closet-users": ["鱼搭业务用户", "鱼搭业务账号管理。"],
    "closet-insights": ["衣柜洞察", "衣柜、推荐与 AI 用量。"],
    "closet-dashboard": ["业务大屏", "汇总业务趋势与分布。"],
    "closet-ops": ["运行监控", "鱼搭只读运维。"],
    "closet-exports": ["数据导出", "按天汇总与去标识事件。"],
    "closet-templates": ["模板审核", "搭配模板人工审核。"],
    "closet-style-terms": ["风格词审核", "助手学到的风格词人工审核。"]
  },
  ipRuleType: {
    ALLOW: ["允许访问", "命中该规则的 IP 或网段允许访问 API。"],
    DENY: ["拒绝访问", "命中该规则的 IP 或网段会被拒绝访问 API。"]
  },
  ipScope: {
    API: ["API 接口", "规则仅作用于 API 接口请求。"]
  },
  ipRuleSource: {
    MANUAL: ["人工规则", "由管理员手动创建的访问规则。"],
    MIGRATED: ["历史迁移", "从旧版字符串 IP 策略迁移而来。"],
    AUTO_RATE_LIMIT: ["自动限流封禁", "客户端持续触发请求限流后自动创建。"],
    AUTO_LOGIN_ABUSE: ["自动登录防护", "客户端持续进行异常登录尝试后自动创建。"]
  },
  ipRuleStatus: {
    ACTIVE: ["生效中", "该规则当前参与 IP 访问决策。"],
    EXPIRED: ["已过期", "该规则已经超过有效期，不再参与访问决策。"],
    REVOKED: ["已解除", "管理员已经解除该规则。"]
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
    NavigationMenu: ["后台菜单", "后台动态导航菜单项。"],
    AvatarCandidate: ["候选头像", "待用户确认的候选头像。"],
    SqlConsole: ["SQL 控制台", "后台 SQL 控制台。"],
    MaintenanceGcRun: ["清理任务", "一次存储清理任务运行。"],
    MaintenanceGcPolicy: ["清理策略", "存储清理策略配置。"]
  },
  auditAction: {
    CLOSET_TEMPLATE_REVIEW: ["审核鱼搭模板", "修改模板审核状态、启用与加分。"],
    CLOSET_STYLE_TERM_APPROVE: ["批准鱼搭风格词", "风格词进入全站词表并对所有用户生效。"],
    CLOSET_STYLE_TERM_REJECT: ["驳回鱼搭风格词", "风格词不进入全站词表，对提出者也不再生效。"],
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
    IP_ACCESS_RULE_REVOKED: ["解除 IP 规则", "解除了一条 IP 访问规则并保留历史。"],
    IP_AUTO_BLOCKED: ["自动封禁 IP", "客户端持续触发限流后被临时封禁。"],
    ANNOUNCEMENT_CREATED: ["创建公告", "新增了一篇公告。"],
    ANNOUNCEMENT_UPDATED: ["更新公告", "修改了一篇公告。"],
    ANNOUNCEMENT_PUBLISHED: ["发布公告", "将公告设为公开可见。"],
    ANNOUNCEMENT_UNPUBLISHED: ["撤回公告", "将公告从公开状态撤回。"],
    ANNOUNCEMENT_DELETED: ["删除公告", "删除了一篇公告。"],
    RESUME_UPDATED: ["更新简历", "修改了公开简历内容。"],
    NAVIGATION_MENU_CREATED: ["创建后台菜单", "新增了一个后台导航菜单项。"],
    NAVIGATION_MENU_UPDATED: ["更新后台菜单", "修改了一个后台导航菜单项。"],
    NAVIGATION_MENU_DELETED: ["删除后台菜单", "删除了一个后台导航菜单项。"],
    REFRESH_TOKEN_REUSE_DETECTED: ["检测到令牌重用", "同一刷新令牌被重复使用，系统已撤销该令牌家族。"],
    REFRESH_TOKEN_STALE_VERSION: ["刷新令牌版本过期", "刷新会话签发后密码已变更，旧会话被拒绝刷新，系统已撤销该令牌家族。"],
    NAVIGATION_MENU_STATUS_UPDATED: ["更新后台菜单状态", "启用或停用了一个后台导航菜单项。"],
    USER_AVATAR_UPLOADED: ["上传头像", "用户上传了自己的头像。"],
    USER_AVATAR_RESET: ["重置头像", "用户将头像恢复为默认。"],
    ADMIN_USER_AVATAR_RESET: ["管理员重置头像", "管理员将用户头像恢复为默认。"],
    USER_AVATAR_CANDIDATE_CREATED: ["生成候选头像", "为用户生成了一个候选头像。"],
    USER_AVATAR_RANDOMIZED: ["随机头像", "用户头像被随机更换。"],
    GC_POLICY_UPDATED: ["更新清理策略", "修改了存储清理策略。"],
    GC_RUN_COMPLETED: ["清理任务完成", "存储清理任务已成功执行完毕。"],
    GC_RUN_FAILED: ["清理任务失败", "存储清理任务执行失败。"],
    SQL_CONSOLE_EXECUTED: ["执行 SQL 控制台语句", "通过 SQL 控制台执行了一条语句，元数据仅记录类型与长度。"]
  }
};

const definition = (category, code) => definitions[category]?.[code];

export const adminCodeLabel = (category, code) =>
  definition(category, code)?.[0] || code || "-";

export const adminCodeTooltip = (category, code) => {
  const item = definition(category, code);
  return item ? `${item[1]}（${code}）` : code || "-";
};
