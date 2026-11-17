import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";

export interface TestDatabase {
  exec(sql: string): Promise<unknown>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  let database: TestDatabase;
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !url.pathname.endsWith("_test")) {
      throw new Error("TEST_DATABASE_URL deve apontar para um banco local com nome terminado em _test.");
    }
    const sql = postgres(process.env.TEST_DATABASE_URL, { max: 1, prepare: false, onnotice: () => undefined });
    database = {
      exec: (source) => sql.unsafe(source),
      async query<T extends Record<string, unknown>>(source: string, params: unknown[] = []) {
        return { rows: [...await sql.unsafe<T[]>(source, params as never[])] };
      },
      close: () => sql.end(),
    };
    const { rows } = await database.query("select to_regclass('public.collections') as existing");
    if (rows[0].existing) {
      await database.close();
      throw new Error("O banco de testes precisa estar vazio. Use um banco descartável exclusivo para os testes.");
    }
  } else {
    database = new PGlite({ extensions: { pgcrypto } });
  }
  try {
    await database.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, service_role;
      grant execute on function auth.uid() to authenticated, service_role;
      create publication supabase_realtime;
      create table public.app_migrations (name text primary key, applied_at timestamptz not null default now());
    `);
    const directory = new URL("../../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      await database.exec("begin");
      try {
        await database.exec(await readFile(new URL(file, directory), "utf8"));
        await database.query("insert into public.app_migrations(name) values ($1)", [file]);
        await database.exec("commit");
      } catch (error) {
        await database.exec("rollback");
        throw new Error(`Falha na migração ${file}`, { cause: error });
      }
    }
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}

export const users = {
  admin: "00000000-0000-0000-0000-000000000001",
  writer: "00000000-0000-0000-0000-000000000002",
  viewer: "00000000-0000-0000-0000-000000000003",
  inactive: "00000000-0000-0000-0000-000000000004",
};

export async function seedAccessFixtures(database: TestDatabase) {
  for (const [name, id] of Object.entries(users)) {
    await database.query("insert into auth.users(id,email) values ($1,$2)", [id, `${name}@example.test`]);
  }
  await database.exec(`
    update public.profiles set active = true, all_churches_access = false, all_churches_write = false;
    update public.profiles set role = 'super_admin' where email = 'admin@example.test';
    update public.profiles set active = false where email = 'inactive@example.test';
    insert into public.sectors(id,name) values ('sector-a','Setor A'),('sector-b','Setor B');
    insert into public.churches(id,sector_id,name,code) values ('church-a','sector-a','Igreja A','A'),('church-b','sector-b','Igreja B','B');
    insert into public.service_schedules(id,church_id,weekday,time,meeting_type,title)
      values ('schedule-a','church-a',0,'19:00','culto','Culto'),('schedule-b','church-b',0,'19:00','culto','Culto');
  `);
  for (const id of [users.writer, users.viewer, users.inactive]) {
    await database.query("insert into public.user_church_access(user_id,church_id,can_write) values ($1,'church-a',$2)", [id, id !== users.viewer]);
    for (const menu of ["collections", "expenses", "churches"]) {
      await database.query("insert into public.user_menu_permissions(user_id,menu) values ($1,$2::public.app_menu)", [id, menu]);
    }
  }
}

export async function asUser(database: TestDatabase, userId: string) {
  await database.exec("set local role authenticated");
  await database.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
}
