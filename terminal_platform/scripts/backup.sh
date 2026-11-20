#!/usr/bin/env sh
# Back up the database and the document store; restore with --restore <dir>.
#   scripts/backup.sh /backups              -> /backups/cxt-YYYYmmdd-HHMMSS/{db.dump,documents.tar.gz,SHA256SUMS}
#   scripts/backup.sh --restore /backups/cxt-20261117-020000
# Needs TERMINAL_DATABASE_URL (postgresql+psycopg://...) and TERMINAL_STORAGE_DIR.
# Schedule daily (cron or your platform scheduler) and copy the output off the host.
set -eu
DB_URL=$(printf '%s' "${TERMINAL_DATABASE_URL:?}" | sed 's#postgresql+psycopg://#postgresql://#')
STORE=${TERMINAL_STORAGE_DIR:?}

if [ "${1:-}" = "--restore" ]; then
  SRC=${2:?backup directory}
  (cd "$SRC" && (command -v sha256sum >/dev/null && sha256sum -c SHA256SUMS) || shasum -a 256 -c SHA256SUMS)
  pg_restore --clean --if-exists --no-owner -d "$DB_URL" "$SRC/db.dump"
  mkdir -p "$STORE" && tar -xzf "$SRC/documents.tar.gz" -C "$STORE"
  echo "restored from $SRC"
  exit 0
fi

OUT=${1:?output directory}/cxt-$(date -u +%Y%m%d-%H%M%S)
mkdir -p "$OUT"
pg_dump -Fc -d "$DB_URL" -f "$OUT/db.dump"
tar -czf "$OUT/documents.tar.gz" -C "$STORE" .
(cd "$OUT" && (command -v sha256sum >/dev/null && sha256sum db.dump documents.tar.gz || shasum -a 256 db.dump documents.tar.gz) > SHA256SUMS)
echo "backup written to $OUT"
