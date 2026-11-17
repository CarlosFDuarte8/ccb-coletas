export async function readAllPages<T extends { id: unknown }>(fetchPage: (after?: string) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await fetchPage(after);
    if (page.error) throw page.error;
    if (!page.data?.length) return rows;
    const lastId = String(page.data.at(-1)!.id);
    if (lastId === after) throw new Error("Não foi possível concluir a leitura dos dados. Atualize a página.");
    rows.push(...page.data);
    after = lastId;
  }
}
