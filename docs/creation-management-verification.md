# 穿搭创作管理接入验证记录

服务端合同来源为 `smart-closet-server` 提交 `06e2ff4a9749b34eed7c2bfbf395c62d85e5bd22` 的 `docs/management-api.yaml`，SHA-256 为 `1ce8c512d193c48f668ad53443ad53a9d3a8788afdc7b5830a75ce115c744df8`。管理前后端快照使用该提交；后端以 `scripts/sync-closet-contract.sh --check /Users/yaopinxin/project/art-creation-integration` 核对通过。

管理后端执行 `./mvnw -q -DCLOSET_CONTRACT_SOURCE=/Users/yaopinxin/project/art-creation-integration/docs/management-api.yaml -Dtest=ClosetContractSnapshotTest,ClosetIntegrationApiTest,ClosetDisabledTest,ClosetRequestSignerTest,ClosetProblemTranslatorTest test`，共 211 项通过。覆盖合同映射、路由权限、禁用状态、签名和问题响应；其中九条模板与能力路由分别验证权限与实际转发，用量日期范围超过 31 天或倒序会被拒绝。

以合同源固定提交的干净归档启动仅监听本机的服务，使用独立临时数据库、测试签名密钥及不会被调用的本地测试供应商。执行管理后端 `./mvnw -q -Dcreation.live.test=true -Dtest=ClosetCreationLiveContractTest test`，通过真实 HTTP/HMAC 验证模板及能力读取、能力配置和成本标识、用量读取、草稿创建，以及缺少发布权限返回 403、发布条件不满足返回 409。隔离服务已停止；测试不调用图片模型。

管理前端执行 `node --test scripts/*.test.mjs`（18 个脚本通过）、`corepack pnpm typecheck`、`corepack pnpm build` 和本次变更页面的 ESLint 检查。使用本地模拟响应的浏览器检查验证：未验证能力时发布按钮禁用；保存得到 409 时提示重新载入；用量分列 USD/CNY 及未知成本次数；成本标识复制得到完整字符串；模型能力页面检查了手机宽度和深色主题。模拟数据验证的是界面交互，不代表浏览器已贯通真实服务。

补充非空用量验收：主代理在隔离的 `06e2ff4` 服务中通过用户界面提交一次任务，由本地 stub 返回成功；本次以管理后端固定提交 `2629fcba5904a0d4b3d8c8bd530b314ddfd8f452` 的干净归档和前端提交 `3ed11f7106fa29f84e9c6c150ab295bdb489c5a6`，使用独立临时管理账号，浏览器经管理网关查询 `2026-11-14`。页面显示 `sunlit-flatlay` v1、实际 provider/model `fixture / fixture-image`、请求 1、已派发 1、成功 1、币种未知未定价、未知费用次数 1。该数据来自本地 stub 的真实处理链路，不代表真实供应商效果。测试后停止本次启动的管理网关与前端。

尚待主代理完成跨仓整体验收。真实供应商效果、付费生成、生产环境及生产部署均未验证。
