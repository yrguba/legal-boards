#!/usr/bin/env bash
# Первичная установка Legal Boards on-prem.
# Usage: sudo ./install.sh v1.0.0
#
# Требуется:
#   - /opt/legal-boards/incoming/legal-boards-v1.0.0.tar.gz
#   - /opt/legal-boards/shared/backend.env
#   - /opt/legal-boards/shared/build.env (рекомендуется)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

VERSION="${1:-}"
[[ -n "$VERSION" ]] || die "Usage: install.sh v1.0.0"

require_root

[[ -f "$BACKEND_ENV" ]] || die "Создайте $BACKEND_ENV (см. deploy/on-prem/shared/backend.env.example)"

mkdir -p "$RELEASES_DIR" "$INCOMING_DIR" "$SHARED_DIR/uploads" "$SHARED_DIR/backups"/{db,uploads}
chown -R "$APP_USER:$APP_USER" "$BASE_DIR"

log "=== Install $(normalize_version "$VERSION") ==="

extract_release "$VERSION"
REL="$(release_dir "$VERSION")"
link_shared_paths "$REL"

install_dependencies_and_build "$REL"
switch_current "$VERSION"
pm2_start_or_restart
healthcheck

if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx || log "WARN: nginx reload skipped"
fi

log "=== Готово: $(normalize_version "$VERSION") ==="
log "Проверьте nginx (см. docs/on-prem/INSTALL.md) и создайте первого admin."
