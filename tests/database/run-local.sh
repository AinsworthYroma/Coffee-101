#!/usr/bin/env bash
# Disposable, local-only reconstructed-contract tests; see security.sql for limitations.
set -euo pipefail
cd "$(dirname "$0")/../.."
if command -v pg_config >/dev/null 2>&1; then
  PATH="$(pg_config --bindir):$PATH"
fi
for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null || { echo "Missing PostgreSQL server tool: $tool" >&2; exit 1; }
done
if [ "$(id -u)" = 0 ]; then
  echo 'Run as a non-root user: initdb refuses root.' >&2; exit 1
fi
work="$(pwd)/.local-db-test-$$"
mkdir -m 700 "$work"
started=0
cleanup() {
  exec 3>&- || true
  if [ "$started" = 1 ]; then pg_ctl -D "$work/data" -m immediate -w stop >/dev/null || true; fi
  rm -rf -- "$work"
}
trap cleanup EXIT
initdb -D "$work/data" -U db_test_admin -A trust --no-instructions >"$work/init.log"
mkdir "$work/socket"
# No TCP listener and a private socket directory: never connects to a real DB.
pg_ctl -D "$work/data" -l "$work/server.log" -o "-F -k '$work/socket' -p 55432 -c listen_addresses=''" -w start >/dev/null
started=1
export PGHOST="$work/socket" PGPORT=55432 PGUSER=db_test_admin PGDATABASE=postgres
psql -X -v ON_ERROR_STOP=1 -q -f tests/database/security.sql >"$work/security.log"

mkfifo "$work/input"
PGAPPNAME=recipe_test_first psql -X -v ON_ERROR_STOP=1 -q <"$work/input" >"$work/first.log" 2>&1 &
first=$!
exec 3>"$work/input"
cat >&3 <<'SQL'
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
DO $$ DECLARE r jsonb; BEGIN
  r := public.apply_recipe_change('coffee', '{"value":"first"}', false, 1, '00000000-0000-0000-0000-000000000002');
  IF r->>'applied' IS DISTINCT FROM 'true' OR (r->>'version')::int IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'first update failed'; END IF;
END $$;
SET application_name = 'recipe_test_first_ready';
SQL
wait_for_query() {
  local sql=$1 result
  for _ in {1..200}; do
    result=$(psql -X -Atqc "$sql")
    if [ "$result" = t ]; then return 0; fi
    sleep 0.1
  done
  echo 'Timed out waiting for concurrent test synchronization' >&2
  cat "$work/first.log" "$work/second.log" 2>/dev/null || true
  return 1
}
wait_for_query "SELECT EXISTS (SELECT FROM pg_stat_activity WHERE application_name = 'recipe_test_first_ready' AND state = 'idle in transaction')"
PGAPPNAME=recipe_test_second psql -X -v ON_ERROR_STOP=1 -q >"$work/second.log" 2>&1 <<'SQL' &
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
DO $$ DECLARE r jsonb; BEGIN
  r := public.apply_recipe_change('coffee', '{"value":"second"}', false, 1, '00000000-0000-0000-0000-000000000003');
  IF r->>'applied' IS DISTINCT FROM 'false' OR (r->>'version')::int IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'stale concurrent update did not fail'; END IF;
END $$;
SQL
second=$!
wait_for_query "SELECT EXISTS (SELECT FROM pg_stat_activity WHERE application_name = 'recipe_test_second' AND cardinality(pg_blocking_pids(pid)) > 0)"
echo 'COMMIT;' >&3
exec 3>&-
if ! wait "$first"; then cat "$work/first.log" >&2; exit 1; fi
if ! wait "$second"; then cat "$work/second.log" >&2; exit 1; fi
psql -X -v ON_ERROR_STOP=1 -q -f tests/database/after-concurrency.sql >"$work/after.log"
echo 'Local privilege and reconstructed-contract tests passed.'
