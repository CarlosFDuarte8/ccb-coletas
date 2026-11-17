import Link from "next/link";
import { ClockIcon } from "@/components/icons";
import { requireSuperAdmin } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

type AuditRow = { id: number; user_id: string | null; action: string; entity: string; entity_id: string | null; details: Record<string, unknown>; created_at: string };
type ProfileRow = { id: string; full_name: string; email: string };

const actionLabels: Record<string, string> = {
  insert: "Cadastro",
  update: "Alteração",
  delete: "Exclusão",
  create_user: "Usuário criado",
  update_user_access: "Permissões alteradas",
  update_password: "Senha alterada",
  merge_import: "Backup mesclado",
  replace_import: "Banco substituído",
};

const entityLabels: Record<string, string> = {
  sectors: "Setor",
  churches: "Igreja",
  monthly_competencies: "Competência",
  service_schedules: "Programação",
  schedule_exceptions: "Exceção de agenda",
  collections: "Coleta",
  deposits: "Depósito",
  expenses: "Despesa",
  profiles: "Usuário",
  database: "Banco de dados",
};

export default async function AuditHistoryPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const [{ data: events }, { data: profiles }] = await Promise.all([
    supabase.from("audit_log").select("id,user_id,action,entity,entity_id,details,created_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("profiles").select("id,full_name,email"),
  ]);
  const rows = (events ?? []) as AuditRow[];
  const users = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));

  return <div className="page-container">
    <section><Link className="text-xs font-semibold text-brand hover:underline" href="/configuracoes">← Voltar para configurações</Link><p className="eyebrow mt-4">Auditoria</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Histórico de eventos</h1><p className="mt-2 max-w-3xl text-sm text-muted">Rastreabilidade das inclusões, alterações, exclusões, importações e mudanças de acesso realizadas no sistema.</p></section>
    <section className="metric-card flex items-center gap-3"><div className="metric-icon metric-icon-brand"><ClockIcon className="size-5" /></div><div><p className="text-xs text-muted">Eventos mais recentes</p><p className="mt-0.5 text-xl font-semibold text-foreground">{rows.length}</p></div></section>
    <section className="panel overflow-hidden">
      <div className="overflow-x-auto"><table className="data-table min-w-[880px]"><thead><tr><th>Data e hora</th><th>Usuário</th><th>Evento</th><th>Área</th><th>Registro</th><th>Detalhes</th></tr></thead><tbody>{rows.map((event) => { const actor = event.user_id ? users.get(event.user_id) : undefined; return <tr key={event.id}><td className="whitespace-nowrap">{formatTimestamp(event.created_at)}</td><td><span className="block font-medium text-foreground">{actor?.full_name ?? "Sistema / importação"}</span>{actor?.email && <span className="text-[11px] text-muted">{actor.email}</span>}</td><td><span className="record-badge record-normal">{actionLabels[event.action] ?? event.action}</span></td><td>{entityLabels[event.entity] ?? event.entity}</td><td className="max-w-44 truncate font-mono text-[11px]" title={event.entity_id ?? ""}>{event.entity_id ?? "—"}</td><td><details><summary className="cursor-pointer text-xs font-semibold text-brand">Visualizar</summary><pre className="mt-2 max-h-64 max-w-lg overflow-auto rounded-lg bg-background p-3 text-[10px] leading-4 text-muted">{JSON.stringify(event.details, null, 2)}</pre></details></td></tr>; })}{rows.length === 0 && <tr><td className="py-10 text-center text-muted" colSpan={6}>Os próximos eventos registrados aparecerão aqui.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
