#!/usr/bin/env bash
# Runs the database security tests against a throwaway local Postgres cluster.
# Applies a tiny auth stub, then the real migrations, then the vitest suite in db/tests.
# Requires PostgreSQL 14+ binaries (set PGBIN if they are not on the default path).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "PostgreSQL binaries not found. Install PostgreSQL or set PGBIN." >&2
  exit 1
fi

PORT="${PGPORT_TEST:-54329}"
DATADIR="$(mktemp -d /tmp/ft-pg.XXXXXX)"
LOGFILE="$DATADIR.log"

# Postgres refuses to run as root; drop to the postgres user when needed.
if [ "$(id -u)" = "0" ]; then
  chown postgres:postgres "$DATADIR"
  RUN=(runuser -u postgres --)
else
  RUN=()
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATADIR" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATADIR" "$LOGFILE"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$DATADIR" -U postgres --auth=trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATADIR" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$DATADIR" -l "$LOGFILE" -w start >/dev/null

export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres
"$PGBIN/createdb" foodtest
export PGDATABASE=foodtest

psql_run() { "$PGBIN/psql" -v ON_ERROR_STOP=1 -q -f "$1" >/dev/null; }

psql_run "$ROOT/db/test-support/00_auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql_run "$f"
done

export DATABASE_URL="postgres://postgres@127.0.0.1:$PORT/foodtest"
cd "$ROOT"
npx vitest run db/tests "$@"
