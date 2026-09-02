#!/usr/bin/env bash
#
# Staged migration for:
#   alirezaafshan.com           -> galaxy-menu on 127.0.0.1:3070
#   portfolio.alirezaafshan.com -> existing portfolio on 127.0.0.1:3000
#
# Run one stage at a time. Nothing changes public routing before `cutover`.

set -euo pipefail

APP_ID="galaxy-menu"
REPO="YesterdaysLemon/alirezas-galaxy"
REPO_URL="https://github.com/${REPO}.git"
REPO_DIR="/opt/${APP_ID}/app"
REPO_USER="deploy-manager"
ROOT_DOMAIN="alirezaafshan.com"
WWW_DOMAIN="www.alirezaafshan.com"
PORTFOLIO_DOMAIN="portfolio.alirezaafshan.com"
APP_PORT=3070
CANDIDATE_PORT=3071
CONTAINER_PORT=3000

DEPLOY_ENV="/etc/deploy-manager/apps/${APP_ID}.env"
MANAGER_APPS="/etc/deploy-manager/apps.json"
MANAGER_ENV="/etc/deploy-manager/deploy-manager.env"
CADDYFILE="/etc/caddy/Caddyfile"
HANDOFF="/home/ali/.${APP_ID}-webhook-secret"
STATE_DIR="/var/lib/${APP_ID}-migration"
BACKUP_POINTER="${STATE_DIR}/caddy-backup"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

[ "$(id -u)" -eq 0 ] || {
  echo "run with sudo: sudo bash $0 <stage>" >&2
  exit 77
}

say() { printf '\n=== %s ===\n' "$*"; }
ok() { printf '  ok   %s\n' "$*"; }
warn() { printf '  WARN %s\n' "$*"; }
die() { printf '  FAIL %s\n' "$*" >&2; exit 1; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

http_contains() {
  url="$1"
  expected="$2"
  curl --fail --silent --show-error --max-time 12 "$url" | grep -Fqi "$expected"
}

local_https_contains() {
  host="$1"
  expected="$2"
  curl --insecure --fail --silent --show-error --max-time 12 \
    --resolve "${host}:443:127.0.0.1" "https://${host}/" | grep -Fqi "$expected"
}

wait_for_local_https_contains() {
  host="$1"
  expected="$2"
  attempts="${3:-30}"
  attempt=1
  while [ "$attempt" -le "$attempts" ]; do
    if local_https_contains "$host" "$expected"; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  return 1
}

manager_health() {
  curl --fail --silent --output /dev/null --max-time 5 \
    http://127.0.0.1:9019/healthz
}

preflight() {
  say "read-only preflight"
  for command_name in caddy curl docker getent git openssl python3 seq ss sudo systemctl; do
    require_command "$command_name"
  done

  systemctl is-active --quiet docker || die "docker is not active"
  systemctl is-active --quiet caddy || die "caddy is not active"
  systemctl is-active --quiet deploy-manager || die "deploy-manager is not active"
  manager_health || die "deploy-manager health check failed"
  ok "docker, caddy, and deploy manager are healthy"

  http_contains http://127.0.0.1:3000/ "<title>alireza afshan" \
    || die "the existing portfolio is not healthy on port 3000"
  ok "existing portfolio is healthy on 127.0.0.1:3000"

  if ss -H -ltn "sport = :${APP_PORT}" | grep -q .; then
    docker ps --format '{{.Names}}' | grep -qx "$APP_ID" \
      || die "port ${APP_PORT} is occupied by something other than ${APP_ID}"
    ok "${APP_ID} already owns port ${APP_PORT}"
  else
    ok "production port ${APP_PORT} is free"
  fi

  if ss -H -ltn "sport = :${CANDIDATE_PORT}" | grep -q .; then
    docker ps --format '{{.Names}}' | grep -qx "${APP_ID}-candidate" \
      || die "candidate port ${CANDIDATE_PORT} is unexpectedly occupied"
    warn "a candidate container is already using ${CANDIDATE_PORT}"
  else
    ok "candidate port ${CANDIDATE_PORT} is free"
  fi

  grep -q 'reverse_proxy 127.0.0.1:3000' "$CADDYFILE" \
    || die "the current portfolio route no longer matches the audited config"
  ok "current root route is still pointed at the portfolio"

  if getent ahostsv4 "$PORTFOLIO_DOMAIN" >/dev/null 2>&1; then
    ok "${PORTFOLIO_DOMAIN} resolves"
  else
    warn "${PORTFOLIO_DOMAIN} does not resolve yet"
    echo "       Add a Cloudflare A record: portfolio -> 107.172.137.190"
  fi
}

install_app() {
  say "deploy-manager registration"
  preflight

  id "$REPO_USER" >/dev/null 2>&1 || die "missing unix user: $REPO_USER"
  install -d -o "$REPO_USER" -g "$REPO_USER" -m 0755 "$(dirname "$REPO_DIR")"

  if [ ! -d "$REPO_DIR/.git" ]; then
    sudo -u "$REPO_USER" -H git clone --branch main "$REPO_URL" "$REPO_DIR"
    ok "cloned ${REPO}"
  else
    sudo -u "$REPO_USER" -H git -C "$REPO_DIR" fetch origin main
    ok "existing checkout refreshed"
  fi

  install -d -o root -g root -m 0755 "$(dirname "$DEPLOY_ENV")"
  if [ ! -f "$DEPLOY_ENV" ]; then
    cat > "$DEPLOY_ENV" <<EOF
APP_ID=${APP_ID}
REPO_DIR=${REPO_DIR}
REPO_USER=${REPO_USER}
BRANCH=main
IMAGE_NAME=${APP_ID}
CONTAINER_NAME=${APP_ID}
CANDIDATE_CONTAINER_NAME=${APP_ID}-candidate
APP_PORT=${APP_PORT}
CANDIDATE_APP_PORT=${CANDIDATE_PORT}
CONTAINER_PORT=${CONTAINER_PORT}
HEALTH_PATH=/
HEALTH_ATTEMPTS=45
HEALTH_SLEEP_SECONDS=2
LOG_FILE=/var/log/deploy-manager/${APP_ID}.log
EOF
    chmod 0644 "$DEPLOY_ENV"
    ok "wrote ${DEPLOY_ENV}"
  else
    ok "${DEPLOY_ENV} already exists"
  fi

  if ! grep -q '"galaxy-menu"' "$MANAGER_APPS"; then
    cp -a "$MANAGER_APPS" "${MANAGER_APPS}.backup.${STAMP}"
    python3 - "$MANAGER_APPS" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8", newline="") as handle:
    config = json.load(handle)
config["apps"]["galaxy-menu"] = {
    "repo": "YesterdaysLemon/alirezas-galaxy",
    "branch": "main",
    "event": "push",
    "secretEnv": "GALAXY_MENU_DEPLOY_WEBHOOK_SECRET",
}
with open(path, "w", encoding="utf-8", newline="") as handle:
    json.dump(config, handle, indent=2)
    handle.write("\n")
PY
    ok "registered ${APP_ID} in apps.json"
  else
    ok "${APP_ID} already registered"
  fi

  secret="$(sed -n 's/^GALAXY_MENU_DEPLOY_WEBHOOK_SECRET=//p' "$MANAGER_ENV" | tail -n 1)"
  if [ -z "$secret" ]; then
    secret="$(openssl rand -hex 32)"
    cp -a "$MANAGER_ENV" "${MANAGER_ENV}.backup.${STAMP}"
    printf 'GALAXY_MENU_DEPLOY_WEBHOOK_SECRET=%s\n' "$secret" >> "$MANAGER_ENV"
    chmod 0600 "$MANAGER_ENV"
    chown root:root "$MANAGER_ENV"
    ok "generated a manager webhook secret without displaying it"
  else
    ok "existing manager webhook secret retained"
  fi

  umask 077
  printf '%s' "$secret" > "$HANDOFF"
  chown ali:ali "$HANDOFF"
  chmod 0600 "$HANDOFF"
  unset secret
  ok "prepared the one-time local GitHub handoff"

  systemctl restart deploy-manager
  for _ in $(seq 1 20); do
    manager_health && break
    sleep 1
  done
  manager_health || die "deploy-manager did not recover after registration"
  ok "deploy-manager restarted and healthy"
}

deploy_app() {
  say "manual candidate rollout"
  [ -f "$DEPLOY_ENV" ] || die "run the install stage first"
  /bin/sh /opt/deploy-manager-current/scripts/deploy-app-now.sh "$APP_ID"
  http_contains "http://127.0.0.1:${APP_PORT}/" "Alireza&#x27;s Galaxy" \
    || die "galaxy did not become healthy on port ${APP_PORT}"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$APP_ID")"
  [ "$health" = "healthy" ] || die "container health is ${health}"
  ok "galaxy is healthy on 127.0.0.1:${APP_PORT}; public routing is unchanged"
}

cutover() {
  say "atomic Caddy cutover"
  http_contains http://127.0.0.1:3000/ "<title>alireza afshan" \
    || die "portfolio failed its final pre-cutover check"
  http_contains "http://127.0.0.1:${APP_PORT}/" "Alireza&#x27;s Galaxy" \
    || die "galaxy failed its final pre-cutover check"
  getent ahostsv4 "$PORTFOLIO_DOMAIN" >/dev/null 2>&1 \
    || die "${PORTFOLIO_DOMAIN} has no DNS record; add it before cutover"

  if grep -q 'reverse_proxy 127.0.0.1:3070' "$CADDYFILE" && \
     grep -q "$PORTFOLIO_DOMAIN" "$CADDYFILE"; then
    ok "routing is already cut over"
    return
  fi

  install -d -o root -g root -m 0700 "$STATE_DIR"
  backup="${CADDYFILE}.pre-galaxy.${STAMP}"
  cp -a "$CADDYFILE" "$backup"
  printf '%s\n' "$backup" > "$BACKUP_POINTER"
  chmod 0600 "$BACKUP_POINTER"
  ok "backed up Caddy routing to ${backup}"

  python3 - "$CADDYFILE" <<'PY'
import sys

path = sys.argv[1]
with open(path, encoding="utf-8", newline="") as handle:
    text = handle.read()

old = '''alirezaafshan.com, www.alirezaafshan.com {
\theader {
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t\tReferrer-Policy "strict-origin-when-cross-origin"
\t\tPermissions-Policy "camera=(), microphone=(), geolocation=()"
\t}

\thandle {
\t\treverse_proxy 127.0.0.1:3000
\t}
}
'''

headers = '''\theader {
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t\tReferrer-Policy "strict-origin-when-cross-origin"
\t\tPermissions-Policy "camera=(), microphone=(), geolocation=()"
\t}
'''

new = f'''portfolio.alirezaafshan.com {{
{headers}
\thandle {{
\t\treverse_proxy 127.0.0.1:3000
\t}}
}}

alirezaafshan.com, www.alirezaafshan.com {{
{headers}
\thandle {{
\t\treverse_proxy 127.0.0.1:3070
\t}}
}}
'''

if old not in text:
    raise SystemExit("audited root block was not found; refusing an unsafe rewrite")

with open(path, "w", encoding="utf-8", newline="") as handle:
    handle.write(text.replace(old, new, 1))
PY

  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile; then
    cp -a "$backup" "$CADDYFILE"
    die "new Caddy config was invalid; original restored without reload"
  fi

  if ! systemctl reload caddy; then
    cp -a "$backup" "$CADDYFILE"
    systemctl reload caddy || true
    die "Caddy reload failed; original routing restored"
  fi

  if ! wait_for_local_https_contains "$ROOT_DOMAIN" "Alireza&#x27;s Galaxy" 10 || \
     ! wait_for_local_https_contains "$PORTFOLIO_DOMAIN" "<title>alireza afshan" 30; then
    cp -a "$backup" "$CADDYFILE"
    caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null
    systemctl reload caddy
    die "post-reload route check failed; original routing restored"
  fi

  ok "root now serves the galaxy and portfolio serves the incumbent site"
}

verify() {
  say "verification"
  systemctl is-active --quiet deploy-manager && ok "deploy manager active" \
    || die "deploy manager inactive"
  systemctl is-active --quiet caddy && ok "caddy active" || die "caddy inactive"
  manager_health && ok "deploy manager healthz responds" || die "deploy manager unhealthy"
  http_contains http://127.0.0.1:3000/ "<title>alireza afshan" \
    && ok "portfolio origin healthy" || die "portfolio origin unhealthy"
  http_contains "http://127.0.0.1:${APP_PORT}/" "Alireza&#x27;s Galaxy" \
    && ok "galaxy origin healthy" || die "galaxy origin unhealthy"
  local_https_contains "$ROOT_DOMAIN" "Alireza&#x27;s Galaxy" \
    && ok "Caddy root route serves galaxy" || die "Caddy root route is wrong"
  local_https_contains "$PORTFOLIO_DOMAIN" "<title>alireza afshan" \
    && ok "Caddy portfolio route serves incumbent" || die "Caddy portfolio route is wrong"
  http_contains "https://${ROOT_DOMAIN}/" "Alireza&#x27;s Galaxy" \
    && ok "public root serves galaxy" || warn "public root has not converged yet"
  http_contains "https://${PORTFOLIO_DOMAIN}/" "<title>alireza afshan" \
    && ok "public portfolio serves incumbent" || warn "public portfolio DNS/TLS has not converged yet"
}

rollback() {
  say "routing rollback"
  [ -r "$BACKUP_POINTER" ] || die "no cutover backup pointer exists"
  backup="$(cat "$BACKUP_POINTER")"
  [ -f "$backup" ] || die "Caddy backup is missing: ${backup}"
  cp -a "$CADDYFILE" "${CADDYFILE}.failed-galaxy.${STAMP}"
  cp -a "$backup" "$CADDYFILE"
  caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null \
    || die "stored backup is invalid; Caddy was not reloaded"
  systemctl reload caddy
  local_https_contains "$ROOT_DOMAIN" "<title>alireza afshan" \
    || die "rollback reloaded but the portfolio is not visible at root"
  ok "portfolio restored at the root; galaxy container and deploy registration retained"
}

case "${1:-}" in
  preflight) preflight ;;
  install) install_app ;;
  deploy) deploy_app ;;
  cutover) cutover ;;
  verify) verify ;;
  rollback) rollback ;;
  *)
    sed -n '3,10p' "$0"
    echo
    echo "stages: preflight install deploy cutover verify rollback"
    exit 64
    ;;
esac
