#!/usr/bin/env bash
# Varmuuskopio: pg_dump -> aikaleimattu .sql.gz.
# Ajetaan hostilta; käyttää docker-compose db-palvelua.
set -euo pipefail

cd "$(dirname "$0")/.."

# Lataa ympäristömuuttujat .env-tiedostosta jos on.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/catering_${TS}.sql.gz"

echo "Varmuuskopioidaan tietokanta -> $OUT"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-catering}" "${POSTGRES_DB:-catering}" | gzip > "$OUT"

echo "Valmis: $OUT"

# Poista yli 30 päivää vanhat varmuuskopiot.
find "$BACKUP_DIR" -name 'catering_*.sql.gz' -mtime +30 -delete 2>/dev/null || true
