export type DatabaseStatus = { loading: boolean; saving: boolean; error: string };

export function databaseErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: string; message?: string };
    if (code === "40001") return "Este registro foi alterado por outro usuário. Atualize os dados antes de tentar novamente.";
    if (code === "42501") return "Você não tem permissão para realizar esta operação. Verifique seu acesso com o administrador.";
    if (code === "23505") return "Já existe um registro com este identificador ou comprovante. Confira os dados antes de tentar novamente.";
    if (code === "23514" && message && !message.includes("constraint")) return message;
    if (code === "23514") return "Os valores ou datas não atendem às regras financeiras. Confira o rateio e os dados do lançamento.";
    if (code === "PGRST202") return "Há uma atualização do sistema pendente. Avise o administrador.";
    if (!code && error instanceof Error && !/fetch|network|failed|URL/i.test(message ?? "")) return error.message;
  }
  return "Não foi possível confirmar a operação. Verifique a conexão e atualize os dados antes de tentar novamente.";
}
