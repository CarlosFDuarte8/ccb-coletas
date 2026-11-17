import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING ou POSTGRES_URL não configurada.");

const sql = postgres(connectionString, { max: 1, prepare: false });
const migrationsDirectory = path.join(process.cwd(), "supabase", "migrations");

try {
  await sql.unsafe(`
    create table if not exists public.app_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const [existing] = await sql`select name from public.app_migrations where name = ${file}`;
    if (existing) {
      console.log(`já aplicada: ${file}`);
      continue;
    }
    const source = await readFile(path.join(migrationsDirectory, file), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(source);
      await transaction`insert into public.app_migrations (name) values (${file})`;
    });
    console.log(`aplicada: ${file}`);
  }
} finally {
  await sql.end();
}
