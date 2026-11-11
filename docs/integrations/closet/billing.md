# 收费管理页面与接口覆盖

2026-11-11。管理后端代理契约见相邻smart-closet-admin-server的docs/integrations/closet/billing.md。页面统一使用Element Plus，浏览器只调用/api/v1/closet。

- 总开关与能力开关：GET/PUT settings。
- 档位与成本：GET tiers、PUT tiers/{tier}、GET/POST cost-rates。
- 商品与订单：GET/POST products、PUT products/{id}、GET orders、POST orders/{id}/sandbox-dispute。
- 兑换码批次：GET/POST redemption-batches、GET codes、POST disable。
- 利润报表：GET margin、GET margin/alerts、GET margin/explain（新增成本版本追溯）。
- 业务用户详情的点数与权益：GET users/{username}/billing、POST points、POST entitlements、DELETE billing/entitlements/{id}。
- 大屏显示今日订单、按币种实收与成本；日导出显示billing聚合对象，增量事件支持billing_order/billing_ledger。

共22个收费操作均有类型化API客户端、页面调用与真实管理网关联调；scripts/closet-billing-contract.test.mjs按源快照校验操作全集、请求体、动态路径编码与点数幂等键。点数未知结果重试保留相同幂等键，写入需closet:billing:write，查看需closet:billing:read。

本地8080用户端、8081管理后端、8849管理前端与8091助手已启动，8849使用最终dist生产构建及API代理。沙箱不产生真实扣款；演示商品使用本地前缀，未调用真实模型。typecheck、修改文件ESLint、10组契约检查与构建通过。
