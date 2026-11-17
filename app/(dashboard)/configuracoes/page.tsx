import Link from "next/link";
import {
  ArrowUpRightIcon,
  BuildingIcon,
  ClockIcon,
  DownloadIcon,
  MonitorIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
import { requireUser } from "@/lib/auth/current-user";

const baseSettings = [
  {
    title: "Meu perfil",
    description: "Atualize seu nome e altere sua senha de acesso ao sistema.",
    href: "/configuracoes/perfil",
    icon: UsersIcon,
    status: "Pessoal",
  },
  {
    title: "Dados e backup",
    description: "Exporte, importe e mescle os dados armazenados neste dispositivo.",
    href: "/configuracoes/dados",
    icon: DownloadIcon,
    status: "Disponível",
  },
  {
    title: "Igrejas e setores",
    description: "Gerencie cadastros, responsáveis e programações das igrejas.",
    href: "/igrejas",
    icon: BuildingIcon,
    status: "Disponível",
  },
] as const;

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = user.role === "super_admin" ? [...baseSettings,
    { title: "Usuários e acessos", description: "Cadastre usuários e controle menus, igrejas e permissões de alteração.", href: "/configuracoes/usuarios", icon: UsersIcon, status: "Superadmin" },
    { title: "Histórico de eventos", description: "Consulte quem cadastrou, alterou ou excluiu informações do sistema.", href: "/configuracoes/historico", icon: ClockIcon, status: "Superadmin" },
  ] : baseSettings;
  return (
    <div className="page-container">
      <section>
        <p className="eyebrow">Administração</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Configurações</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Organize os dados, cadastros e preferências do sistema em um só lugar.</p>
      </section>

      <section>
        <div className="mb-3"><h2 className="text-sm font-semibold text-foreground">Sistema</h2><p className="mt-1 text-xs text-muted">Dados locais e funcionamento da aplicação</p></div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {settings.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="panel group flex min-h-44 flex-col p-4 transition-colors hover:border-brand/40 sm:p-5" href={item.href} key={item.href}>
                <div className="flex items-start justify-between gap-3"><div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></div><span className="record-badge record-confirmed">{item.status}</span></div>
                <div className="mt-5 flex-1"><h3 className="text-sm font-semibold text-foreground">{item.title}</h3><p className="mt-2 text-xs leading-5 text-muted">{item.description}</p></div>
                <span className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-brand">Abrir configuração <ArrowUpRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3"><h2 className="text-sm font-semibold text-foreground">Preferências</h2><p className="mt-1 text-xs text-muted">Personalização da experiência</p></div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <article className="panel flex min-h-40 flex-col p-4 sm:p-5"><div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-xl bg-surface-subtle text-muted"><MonitorIcon className="size-5" /></div><span className="record-badge record-normal">Ativo</span></div><h3 className="mt-5 text-sm font-semibold text-foreground">Aparência</h3><p className="mt-2 text-xs leading-5 text-muted">O tema claro, escuro ou automático pode ser alterado pelo botão da barra superior.</p></article>
          <article className="panel flex min-h-40 flex-col border-dashed p-4 opacity-75 sm:p-5"><div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-xl bg-surface-subtle text-muted"><SettingsIcon className="size-5" /></div><span className="record-badge record-draft">Em breve</span></div><h3 className="mt-5 text-sm font-semibold text-foreground">Preferências gerais</h3><p className="mt-2 text-xs leading-5 text-muted">Espaço reservado para notificações, formatos e outras opções futuras.</p></article>
        </div>
      </section>
    </div>
  );
}
