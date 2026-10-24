# 鱼搭管理平台

鱼搭（数字衣柜）的独立管理后台前端，Vue 3 + Element Plus。通过 `smart-closet-admin-server` 以中立管理接口接入鱼搭业务服务，不改动鱼搭本体。

- 首页：业务大屏，展示用户、衣柜、搭配与推荐的实时概览，随平台主题切换浅色/深色。
- 鱼搭业务：衣柜洞察、业务用户、运行监控、数据导出、模板审核。
- 系统管理：用户、角色与权限、菜单、运行配置、IP 规则、审计日志、数据清理、SQL 执行台，以及平台自身的运行概览。

## 开发

```bash
pnpm install
pnpm dev        # 默认 http://localhost:8849，接口代理到 VITE_API_TARGET（默认 http://127.0.0.1:8081）
pnpm typecheck
pnpm build
```

后端见同级目录 `smart-closet-admin-server`；鱼搭本体需开启 `CLOSET_MANAGEMENT_ENABLED` 并与后端的 `APP_CLOSET_SECRET` 配置一致。

## 菜单图标

菜单由后端下发，`icon` 字段使用本地注册的图标键（如 `ri/pulse-line`）。新增图标需在 `src/components/ReIcon/src/offlineIcon.ts` 注册。

## 相关仓库

| 仓库                                                                                                                                                                                             | 内容                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [smart-closet-admin-server](https://github.com/yumengjh/smart-closet-admin-server)                                                                                                               | 管理平台后端（本平台的接口）                                      |
| [smart-closet](https://github.com/yumengjh/smart-closet)                                                                                                                                         | 鱼搭用户端                                                        |
| [smart-closet-server-review](https://github.com/yumengjh/smart-closet-server-review)                                                                                                             | 鱼搭后端评审裁剪副本，管理接口契约见其 `docs/management-api.yaml` |
| [smart-closet-mp](https://github.com/yumengjh/smart-closet-mp) · [yuda-website](https://github.com/yumengjh/yuda-website) · [smart-closet-promo](https://github.com/yumengjh/smart-closet-promo) | 小程序、官网、演示视频                                            |

## 致谢

基于 [vue-pure-admin 精简版](https://github.com/pure-admin/pure-admin-thin)（MIT）。
