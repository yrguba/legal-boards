#!/usr/bin/env bash
# Обновление Legal Boards on-prem.
# Usage: sudo ./update.sh v1.1.0
#
# Перед обновлением: положить legal-boards-v1.1.0.tar.gz в /opt/legal-boards/incoming/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

VERSION="${1:-}"
[[ -n "$VERSION" ]] || die "Usage: update.sh v1.1.0"

require_root

[[ -f "$BACKEND_ENV" ]] || die "Нет $BACKEND_ENV"

OLD_VERSION=""
if [[ -L "$CURRENT_LINK" ]]; then
  OLD_VERSION="$(basename "$(readlink -f "$CURRENT_LINK")")"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
LABEL="$(normalize_version "$VERSION" | tr '.' '-')"

log "=== Update ${OLD_VERSION:-none} -> $(normalize_version "$VERSION") ==="

backup_db "$STAMP" "$LABEL"
backup_uploads "$STAMP" "$LABEL"

REL="$(release_dir "$VERSION")"
MIGRATED=0

if [[ -d "$REL" ]]; then
  die "Версия уже установлена: $REL"
fi

extract_release "$VERSION"
link_shared_paths "$REL"

set +e
run_as_app "cd '$REL' && pnpm install --frozen-lockfile"
load_build_env
run_as_app "cd '$REL' && pnpm build"
run_as_app "cd '$REL/backend' && pnpm install --frozen-lockfile"
run_as_app "cd '$REL/backend' && npx prisma migrate deploy"
MIGRATE_RC=$?
run_as_app "cd '$REL/backend' && pnpm build"
BUILD_RC=$?
set -e

if [[ $MIGRATE_RC -ne 0 ]]; then
  die "prisma migrate deploy failed (rc=$MIGRATE_RC). current не изменён. Restore БД: shared/backups/db/${STAMP}-pre-${LABEL}.sql.gz"
fi
if [[ $BUILD_RC -ne 0 ]]; then
  die "backend build failed (rc=$BUILD_RC). current не изменён."
fi

MIGRATED=1
switch_current "$VERSION"
pm2_start_or_restart
healthcheck

if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx || log "WARN: nginx reload skipped"
fi

prune_old_releases

log "=== Обновлено до $(normalize_version "$VERSION") ==="
[[ -n "$OLD_VERSION" ]] && log "Откат кода: $SCRIPT_DIR/rollback.sh $OLD_VERSION"
if [[ $MIGRATED -eq 1 ]]; then
  log "Если нужен откат БД: gunzip -c shared/backups/db/${STAMP}-pre-${LABEL}.sql.gz | psql …"
fi
