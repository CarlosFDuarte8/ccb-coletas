import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createDatabaseConnection, describeDatabaseError } from "./lib/database.mjs";

let sql;
const migrationsDirectory = path.join(process.cwd(), "supabase", "migrations");

try {
  sql = createDatabaseConnection();
  await sql.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtext('ccb-coletas:migrations'))`;
    await transaction.unsafe(`
    create table if not exists public.app_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
    `);
  });
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const source = await readFile(path.join(migrationsDirectory, file), "utf8");
    const applied = await sql.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(hashtext('ccb-coletas:migrations'))`;
      const [existing] = await transaction`select name from public.app_migrations where name = ${file}`;
      if (existing) return false;
      await transaction.unsafe(source);
      await transaction`insert into public.app_migrations (name) values (${file})`;
      return true;
    });
    console.log(`${applied ? "aplicada" : "já aplicada"}: ${file}`);
  }
} catch (error) {
  console.error(describeDatabaseError(error));
  process.exitCode = 1;
} finally {
  await sql?.end({ timeout: 2 });
}
