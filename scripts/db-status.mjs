import { readdir } from "node:fs/promises";
import { createDatabaseConnection, describeDatabaseError } from "./lib/database.mjs";

let sql;
try {
  sql = createDatabaseConnection();
  const files = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort();
  const [registry] = await sql`select to_regclass('public.app_migrations') is not null as exists`;
  const applied = registry.exists ? await sql`select name from public.app_migrations order by name` : [];
  const appliedNames = new Set(applied.map((row) => row.name));
  const tables = await sql`select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`;
  const columns = await sql`select table_name, column_name from information_schema.columns where table_schema = 'public' and ((table_name = 'collections' and column_name in ('breakdown', 'maintenance_cash_in_cents')) or (table_name = 'expenses' and column_name = 'payment_source')) order by table_name, column_name`;
  const [security] = await sql`select
    (select count(*)::int from pg_policies where schemaname = 'public') as policies,
    (select count(*)::int from pg_trigger where not tgisinternal and tgname like '%_capture_audit') as audit_triggers,
    (select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public') as realtime_tables`;
  const pending = files.filter((name) => !appliedNames.has(name));
  console.log(JSON.stringify({ connected: true, applied: [...appliedNames], pending, unknownMigrations: [...appliedNames].filter((name) => !files.includes(name)), tables, maintenanceColumns: columns, ...security }, null, 2));
  if (pending.length) process.exitCode = 1;
} catch (error) {
  console.error(describeDatabaseError(error));
  process.exitCode = 1;
} finally {
  await sql?.end({ timeout: 2 });
}
