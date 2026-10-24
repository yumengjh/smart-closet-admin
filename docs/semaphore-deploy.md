# Semaphore 部署（静态站点）

管理平台前端由 Semaphore（组织 `yumg`，项目 `smart-closet-admin`）构建并部署到 1Panel 静态站点；后端见 `smart-closet-admin-server` 的 `docs/operations/semaphore-deploy.md`，两者不在同一台服务器。

```text
推送分支           -> .semaphore/semaphore.yml   pnpm typecheck、pnpm build
推送标签 vX.Y.Z    -> 检查通过后自动运行 deploy.yml（scripts/ci/deploy.sh）：构建 -> SSH 覆盖站点目录
手动 Promote「Deploy this commit」 -> 部署任意已检查的提交
```

## Secret

使用组织里已有的 Secret `frontend`（Web 服务器的 SSH 变量，与用户端站点共用）：`DEPLOY_SSH_HOST`、`DEPLOY_SSH_USER`、`DEPLOY_SSH_PASSWORD` 或 `DEPLOY_SSH_KEY`、可选 `DEPLOY_SSH_PORT`、`DEPLOY_SSH_KNOWN_HOSTS`。

该 Secret 里的 `DEPLOY_PATH`、`DEPLOY_SITE_URL`、`FRONTEND_API_BASE_URL` 属于用户端站点，**这里不读取**，避免覆盖用户端。本站点自己的可选变量（写进同一个 Secret）：

| 变量                      | 默认值                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ADMIN_DEPLOY_PATH`       | `/opt/1panel/www/sites/yuda-admin.yumg.cn/index`                                                     |
| `ADMIN_SITE_URL`          | `https://yuda-admin.yumg.cn/`（仅用于部署后核对）                                                    |
| `ADMIN_CLOSET_PUBLIC_URL` | `https://yuda.yumg.cn`（构建时写入 `VITE_CLOSET_PUBLIC_URL`，生成 `/register?invite=CODE` 邀请链接） |
| `ADMIN_API_BASE_URL`      | `https://yuda-admin-server.yumg.cn`（构建时写入 `VITE_API_BASE_URL`，缺少 `/api/v1` 时自动补上）     |

## 后端接口

页面直接请求后端域名（`VITE_API_BASE_URL`），本站点不需要 `/api` 反向代理。后端域名反代到管理后端容器的宿主机端口，并且后端的 CORS 来源要包含 `https://yuda-admin.yumg.cn`（刷新 Cookie 为 `SameSite=Strict`，两个域名同属 `yumg.cn`，同站可用）。路由使用 Hash 模式，不需要 `try_files`。
