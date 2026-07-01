#!/usr/bin/env bash
# Общие функции и переменные для on-prem скриптов.
# Подключается: source "$(dirname "$0")/common.sh"

set -euo pipefail

BASE_DIR="${BASE_DIR:-/opt/legal-boards}"
RELEASES_DIR="$BASE_DIR/releases"
INCOMING_DIR="$BASE_DIR/incoming"
SHARED_DIR="$BASE_DIR/shared"
CURRENT_LINK="$BASE_DIR/current"
APP_USER="${APP_USER:-legalboards}"
PM2_NAME="${PM2_NAME:-legal-boards-api}"
DB_NAME="${DB_NAME:-legalboards}"

BACKEND_ENV="$SHARED_DIR/backend.env"
BUILD_ENV="$SHARED_DIR/build.env"
VERSION_FILE="$SHARED_DIR/installed_version"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*"; exit 1; }

require_root() {
  if [[ "${EUID:-0}" -ne 0 ]]; then
    die "Запустите скрипт через sudo"
  fi
}

normalize_version() {
  local v="${1#v}"
  echo "v${v}"
}

version_dir_name() {
  normalize_version "$1"
}

tarball_path() {
  local version
  version="$(normalize_version "$1")"
  echo "$INCOMING_DIR/legal-boards-${version}.tar.gz"
}

release_dir() {
  echo "$RELEASES_DIR/$(version_dir_name "$1")"
}

run_as_app() {
  sudo -u "$APP_USER" bash -lc "$*"
}

link_shared_paths() {
  local rel="$1"
  ln -sfn "$BACKEND_ENV" "$rel/backend/.env"
  ln -sfn "$SHARED_DIR/uploads" "$rel/backend/uploads"
}

load_build_env() {
  if [[ -f "$BUILD_ENV" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$BUILD_ENV"
    set +a
  fi
}

healthcheck() {
  log "Healthcheck…"
  local code
  code="$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:5004/api/auth/verify || true)"
  if [[ "$code" != "401" && "$code" != "200" ]]; then
    die "Backend не отвечает (HTTP ${code:-none}, ожидали 401 или 200)"
  fi
  log "Backend OK (HTTP $code)"
}

install_dependencies_and_build() {
  local rel="$1"
  log "pnpm install + build в $rel"
  run_as_app "cd '$rel' && pnpm install --frozen-lockfile"
  load_build_env
  run_as_app "cd '$rel' && pnpm build"
  run_as_app "cd '$rel/backend' && pnpm install --frozen-lockfile"
  run_as_app "cd '$rel/backend' && npx prisma migrate deploy"
  run_as_app "cd '$rel/backend' && pnpm build"
}

switch_current() {
  local version="$1"
  local rel
  rel="$(release_dir "$version")"
  ln -sfn "$rel" "$CURRENT_LINK"
  echo "$(version_dir_name "$version")" >"$VERSION_FILE"
  log "current -> $rel"
}

pm2_start_or_restart() {
  local rel
  rel="$(readlink -f "$CURRENT_LINK")"
  if sudo -u "$APP_USER" pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    sudo -u "$APP_USER" pm2 restart "$PM2_NAME" --update-env
  else
    sudo -u "$APP_USER" pm2 start "$rel/backend/dist/index.js" \
      --name "$PM2_NAME" \
      --cwd "$rel/backend"
    sudo -u "$APP_USER" pm2 save
  fi
}

backup_db() {
  local stamp="$1"
  local label="$2"
  local out="$SHARED_DIR/backups/db/${stamp}-pre-${label}.sql"
  mkdir -p "$SHARED_DIR/backups/db"
  if command -v pg_dump >/dev/null 2>&1; then
    if [[ -f "$BACKEND_ENV" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$BACKEND_ENV"
      set +a
      run_as_app "pg_dump '$DATABASE_URL'" | gzip >"${out}.gz"
    else
      sudo -u postgres pg_dump "$DB_NAME" | gzip >"${out}.gz"
    fi
    log "DB backup: ${out}.gz"
  else
    log "WARN: pg_dump не найден — пропуск бэкапа БД"
  fi
}

backup_uploads() {
  local stamp="$1"
  local label="$2"
  local out="$SHARED_DIR/backups/uploads/${stamp}-pre-${label}.tar.gz"
  mkdir -p "$SHARED_DIR/backups/uploads"
  if [[ -d "$SHARED_DIR/uploads" ]]; then
    tar -czf "$out" -C "$SHARED_DIR" uploads
    log "Uploads backup: $out"
  fi
}

extract_release() {
  local version="$1"
  local tarball
  tarball="$(tarball_path "$version")"
  local rel
  rel="$(release_dir "$version")"
  [[ -f "$tarball" ]] || die "Нет архива: $tarball"
  [[ ! -d "$rel" ]] || die "Версия уже установлена: $rel"
  local tmp
  tmp="$(mktemp -d)"
  tar -xzf "$tarball" -C "$tmp"
  local inner="legal-boards-$(normalize_version "$version")"
  if [[ ! -d "$tmp/$inner" ]]; then
    # fallback: единственная верхнеуровневая папка в архиве
    inner="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -1)"
    inner="$(basename "$inner")"
  fi
  mv "$tmp/$inner" "$rel"
  rmdir "$tmp" 2>/dev/null || rm -rf "$tmp"
  log "Распаковано: $rel"
}

prune_old_releases() {
  local keep="${KEEP_RELEASES:-3}"
  mapfile -t dirs < <(ls -1dt "$RELEASES_DIR"/v* 2>/dev/null || true)
  local i=0
  for d in "${dirs[@]}"; do
    i=$((i + 1))
    if [[ $i -gt $keep ]]; then
      log "Удаление старого релиза: $d"
      rm -rf "$d"
    fi
  done
}
