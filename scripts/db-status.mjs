import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!connectionString) throw new Error("Conexão PostgreSQL não configurada.");
const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  const [status] = await sql.unsafe(`
    select
      (select count(*)::int from information_schema.tables where table_schema = 'public') as public_tables,
      (select count(*)::int from public.profiles where active and all_churches_access) as users_with_all_churches_access,
      (select count(*)::int from public.sectors) as sectors,
      (select count(*)::int from public.churches) as churches,
      (select count(*)::int from public.collections) as collections,
      (select count(*)::int from public.deposits) as deposits,
      (select count(*)::int from public.expenses) as expenses,
      (select count(*)::int from pg_trigger where not tgisinternal and tgname like '%_capture_audit') as audit_triggers,
      (select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public') as realtime_tables,
      (select count(*)::int from public.audit_log) as audit_events,
      exists(select 1 from auth.users where lower(email) = 'carlosf.duarte8@gmail.com') as super_admin_user_exists,
      exists(select 1 from public.profiles where lower(email) = 'carlosf.duarte8@gmail.com' and role = 'super_admin') as super_admin_profile_ready
  `);
  console.log(JSON.stringify(status, null, 2));
} finally {
  await sql.end();
}
