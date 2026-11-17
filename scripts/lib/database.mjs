import postgres from "postgres";

export function createDatabaseConnection(env = process.env) {
  const connectionString = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL;
  if (!connectionString) throw Object.assign(new Error("Conexão PostgreSQL não configurada."), { code: "MISSING_DATABASE_URL" });
  return postgres(connectionString, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5 });
}

export function describeDatabaseError(error) {
  if (error.code === "MISSING_DATABASE_URL") return "Configure POSTGRES_URL_NON_POOLING no arquivo de ambiente.";
  if (error.code === "ENOTFOUND" || /tenant\/user .* not found/i.test(error.message ?? "")) {
    return "O projeto ou usuário configurado não foi encontrado. Confira no painel do Supabase se o projeto está ativo e copie a conexão atual.";
  }
  if (error.code === "28P01") return "A autenticação do banco falhou. Atualize a senha na conexão PostgreSQL.";
  if (["CONNECT_TIMEOUT", "ETIMEDOUT", "ECONNREFUSED"].includes(error.code)) return "O banco não respondeu. Verifique o endereço, a porta e a disponibilidade do projeto.";
  return `Não foi possível concluir a consulta ao banco (código ${String(error.code ?? "desconhecido").replace(/[^A-Z0-9_]/gi, "")}).`;
}
