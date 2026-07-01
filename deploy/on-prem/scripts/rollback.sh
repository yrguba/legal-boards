#!/usr/bin/env bash
# Откат на предыдущую версию (код). БД восстанавливается вручную — см. docs/on-prem/UPDATE.md
# Usage: sudo ./rollback.sh v1.0.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

VERSION="${1:-}"
[[ -n "$VERSION" ]] || die "Usage: rollback.sh v1.0.0"

require_root

REL="$(release_dir "$VERSION")"
[[ -d "$REL" ]] || die "Релиз не найден: $REL"

CURRENT_VERSION=""
if [[ -L "$CURRENT_LINK" ]]; then
  CURRENT_VERSION="$(basename "$(readlink -f "$CURRENT_LINK")")"
fi

log "=== Rollback ${CURRENT_VERSION:-none} -> $(version_dir_name "$VERSION") ==="

sudo -u "$APP_USER" pm2 stop "$PM2_NAME" || true
switch_current "$VERSION"
pm2_start_or_restart
healthcheck

if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx || log "WARN: nginx reload skipped"
fi

log "=== Откат кода завершён: $(version_dir_name "$VERSION") ==="
log "Если после update применялись миграции — восстановите БД из shared/backups/db/ (см. docs/on-prem/UPDATE.md)"
