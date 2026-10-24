#!/usr/bin/env bash
# Build the admin site and replace the 1Panel static site over SSH (used by .semaphore/deploy.yml).
#
# Semaphore secret "frontend" (shared with the user-facing site smart-closet; the web host is not the backend host):
# DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_KEY or DEPLOY_SSH_PASSWORD, optional DEPLOY_SSH_PORT, DEPLOY_SSH_KNOWN_HOSTS.
# The secret's DEPLOY_PATH / DEPLOY_SITE_URL / FRONTEND_API_BASE_URL belong to the user-facing site and are ignored here,
# so this deployment can never overwrite it. This site has its own, optional:
#   ADMIN_DEPLOY_PATH  default /opt/1panel/www/sites/yuda-admin.yumg.cn/index
#   ADMIN_SITE_URL     default https://yuda-admin.yumg.cn/ (only used for the final check)
# Build-time variables (baked into the page), also taken from that secret under their own ADMIN_ names so they never
# pick up the user-facing site's values:
#   ADMIN_CLOSET_PUBLIC_URL  -> VITE_CLOSET_PUBLIC_URL, address of the user-facing site for /register?invite=CODE links
#                               (default https://yuda.yumg.cn)
#   ADMIN_API_BASE_URL       -> VITE_API_BASE_URL, address of the admin backend (default https://yuda-admin-server.yumg.cn);
#                               "/api/v1" is appended when missing. The backend must allow this site's origin (CORS).
# The page calls the admin backend directly on its own domain (VITE_API_BASE_URL), no /api proxy on this site.
set -euo pipefail
cd "$(dirname "$0")/../.."

TARGET=${ADMIN_DEPLOY_PATH:-/opt/1panel/www/sites/yuda-admin.yumg.cn/index}
case "$TARGET" in /*/*/*) ;; *) echo "ADMIN_DEPLOY_PATH 太短，拒绝覆盖：$TARGET"; exit 1 ;; esac
case "$TARGET" in */yuda.yumg.cn/*) echo "ADMIN_DEPLOY_PATH 指向用户端站点，拒绝覆盖：$TARGET"; exit 1 ;; esac
SITE_URL=${ADMIN_SITE_URL:-https://yuda-admin.yumg.cn/}

export VITE_CLOSET_PUBLIC_URL=${ADMIN_CLOSET_PUBLIC_URL:-https://yuda.yumg.cn}
api=${ADMIN_API_BASE_URL:-https://yuda-admin-server.yumg.cn}; api=${api%/}
case "$api" in */api/v1) ;; *) api="$api/api/v1" ;; esac
export VITE_API_BASE_URL=$api
echo "构建变量：VITE_CLOSET_PUBLIC_URL=$VITE_CLOSET_PUBLIC_URL VITE_API_BASE_URL=$VITE_API_BASE_URL"

# Build; the commit goes into version.txt so the final check can tell this build from an older one.
pnpm build
test -s dist/index.html
git rev-parse HEAD > dist/version.txt
tar -C dist -czf site.tar.gz .
sha256sum dist/index.html | awk '{print $1}' > index.sha256
echo "构建完成：$(find dist -type f | wc -l) 个文件，$(du -sh dist | cut -f1)"

source scripts/ci/ssh-setup.sh
trap 'rm -f ~/.ssh/deploy_key' EXIT
~/remote 'echo "已连接 $(hostname)"'

tmp="/tmp/yuda-admin-frontend-semaphore-${SEMAPHORE_WORKFLOW_ID:-$$}.tar.gz"
~/upload site.tar.gz "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST:$tmp"
~/remote "bash -s -- $(printf %q "$TARGET") $(printf %q "$tmp")" <<'REMOTE'
set -euo pipefail
target=$1; archive=$2
trap 'rm -f "$archive"' EXIT
SUDO=(); [ "$(id -u)" = 0 ] || SUDO=(sudo -n)
if [ ! -d "$target" ]; then
  echo "站点目录不存在，创建：$target（1Panel 里还需要建好对应站点并配置 /api 反向代理）"
  "${SUDO[@]}" mkdir -p "$target"
fi
[ -w "$target" ] || SUDO=(sudo -n)
owner=$(stat -c '%u:%g' "$target")
# Unpack next to the site (same file system), keep the previous version for a manual rollback.
stage=$("${SUDO[@]}" mktemp -d "$(dirname "$target")/.deploy-XXXXXX")
"${SUDO[@]}" tar -xzf "$archive" -C "$stage"
[ -s "$stage/index.html" ] || { "${SUDO[@]}" rm -rf "$stage"; echo "上传的包里没有 index.html"; exit 1; }
"${SUDO[@]}" tar -czf "$(dirname "$target")/.index-previous.tar.gz" -C "$target" . 2>/dev/null || true
# Full overwrite: every old file goes, except 1Panel's protected .user.ini (chattr +i on PHP sites).
if command -v rsync >/dev/null; then
  "${SUDO[@]}" rsync -a --delete --exclude .user.ini "$stage/" "$target/"
else
  "${SUDO[@]}" find "$target" -mindepth 1 -maxdepth 1 ! -name .user.ini -exec rm -rf {} +
  "${SUDO[@]}" cp -a "$stage/." "$target/"
fi
"${SUDO[@]}" chown -R "$owner" "$target"
"${SUDO[@]}" rm -rf "$stage"
echo "已覆盖 ${target}：$(find "$target" -type f | wc -l) 个文件；上一版备份在 $(dirname "$target")/.index-previous.tar.gz"
REMOTE

# The site may not be served yet (1Panel site, DNS, proxy): report, do not fail the deployment.
want=$(git rev-parse HEAD)
for _ in 1 2 3 4; do
  got=$(curl -fsSL --max-time 20 -H 'Cache-Control: no-cache' "${SITE_URL}version.txt?deploy=${SEMAPHORE_WORKFLOW_ID:-x}" 2>/dev/null | tr -d '[:space:]' || true)
  [ "$got" = "$want" ] && { echo "线上 $SITE_URL 已是本次构建（$want）"; exit 0; }
  sleep 5
done
echo "提示：暂时无法从 $SITE_URL 读到本次构建（站点、域名或证书可能尚未就绪，或有缓存）；文件已写入 $TARGET"
