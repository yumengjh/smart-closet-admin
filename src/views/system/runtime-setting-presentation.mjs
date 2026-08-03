const definitions = {
  "security.rate-limit.enabled": ["启用全局限流", "限制单个客户端在时间窗口内的总请求数。"],
  "security.rate-limit.capacity": ["全局请求上限", "每个客户端在全局限流窗口内最多可发起的请求次数。"],
  "security.rate-limit.window-seconds": ["全局限流窗口", "全局限流计数的时间窗口，单位：秒。"],
  "security.endpoint.rate-limit.patterns": ["端点限流路径", "需要使用独立限流策略的路径模式，多个模式请用逗号分隔。"],
  "security.endpoint.rate-limit.capacity": ["端点请求上限", "每个客户端在端点限流窗口内最多可发起的请求次数。"],
  "security.endpoint.rate-limit.window-seconds": ["端点限流窗口", "端点限流计数的时间窗口，单位：秒。"],
  "security.brute-force.enabled": ["启用登录失败保护", "连续登录失败达到阈值后暂时锁定该账号。"],
  "security.brute-force.failure-threshold": ["失败次数阈值", "在统计窗口内达到该次数后开始锁定账号。"],
  "security.brute-force.window-seconds": ["失败统计窗口", "统计登录失败次数的时间范围，单位：秒。"],
  "security.brute-force.lock-seconds": ["账号锁定时长", "登录失败保护触发后账号不可登录的时长，单位：秒。"],
  "security.request-log.enabled": ["记录请求日志", "记录 API 请求的基础访问日志。"],
  "security.audit.enabled": ["启用审计日志", "记录安全与管理操作的审计事件。"],
  "security.cors.allowed-origins": ["允许的跨域来源", "允许访问 API 的来源地址，多个来源请用逗号分隔。"],
  "security.cors.allowed-methods": ["允许的跨域方法", "跨域请求允许使用的 HTTP 方法，多个方法请用逗号分隔。"],
  "security.endpoint.disabled-patterns": ["禁用的端点路径", "临时禁止访问的 API 路径模式，多个模式请用逗号分隔。"],
  "security.ip.allow-list": ["IP 白名单", "仅允许这些 IP 或 CIDR 网段访问；留空表示不限制。"],
  "security.ip.deny-list": ["IP 黑名单", "拒绝这些 IP 或 CIDR 网段访问，多个规则请用逗号分隔。"],
  "identity.registration.enabled": ["开放自助注册", "控制访客是否可以自行注册新账号。"],
  "runtime.config-refresh.enabled": ["自动刷新配置缓存", "按设定周期比较 revision，只重载发生变化的内存配置缓存。"],
  "runtime.config-refresh.interval-seconds": ["缓存检查周期", "自动检查配置缓存数据库 revision 的周期，单位：秒。"],
  "runtime.dependency-health.enabled": ["自动探测服务依赖", "按设定周期检查头像生成服务和本地存储的可用状态。"],
  "runtime.dependency-health.interval-seconds": ["依赖探测周期", "自动刷新服务依赖健康状态的周期，单位：秒。"],
  "avatar.generator.enabled": ["启用系统头像生成", "控制是否允许创建或惰性生成新的 Lorelei 系统头像。"]
};

const definition = setting => definitions[setting.key];

export const runtimeSettingLabel = setting =>
  setting.displayName?.trim() || definition(setting)?.[0] || setting.key;

export const runtimeSettingDescription = setting =>
  setting.description?.trim() || definition(setting)?.[1] || setting.key;

export const runtimeSettingTooltip = setting =>
  runtimeSettingDescription(setting) + "（" + setting.key + "）";
