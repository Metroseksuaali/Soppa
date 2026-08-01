#!/usr/bin/env bash
# Palautus: purkaa .sql.gz ja lataa tietokantaan.
# Käyttö: ./scripts/restore.sh backups/catering_YYYYMMDD_HHMMSS.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  echo "Käyttö: $0 <varmuuskopio.sql.gz>" >&2
  exit 1
fi

FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "Tiedostoa ei löydy: $FILE" >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

echo "VAROITUS: tämä korvaa tietokannan '${POSTGRES_DB:-catering}' sisällön."
read -r -p "Jatketaanko? (kirjoita 'kylla'): " ans
if [ "$ans" != "kylla" ]; then
  echo "Peruttu."
  exit 0
fi

echo "Palautetaan $FILE …"
gunzip -c "$FILE" | docker compose exec -T db psql -U "${POSTGRES_USER:-catering}" -d "${POSTGRES_DB:-catering}"
echo "Palautus valmis."
