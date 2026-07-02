import {
  ArrowUpRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  PackageIcon,
  PlusIcon,
  RouteIcon,
} from "@/components/icons";

const metrics = [
  {
    label: "Coletas hoje",
    value: "24",
    detail: "+12% esta semana",
    icon: PackageIcon,
    tone: "brand",
  },
  {
    label: "Em andamento",
    value: "08",
    detail: "3 próximas do destino",
    icon: RouteIcon,
    tone: "blue",
  },
  {
    label: "Concluídas",
    value: "16",
    detail: "98% dentro do prazo",
    icon: CheckCircleIcon,
    tone: "green",
  },
  {
    label: "Tempo médio",
    value: "42 min",
    detail: "−6 min desde junho",
    icon: ClockIcon,
    tone: "amber",
  },
] as const;

const collections = [
  { id: "#CLT-2401", place: "Congregação Central", time: "08:30", status: "Em rota" },
  { id: "#CLT-2402", place: "Jardim Primavera", time: "10:00", status: "Agendada" },
  { id: "#CLT-2403", place: "Vila Nova", time: "11:15", status: "Agendada" },
  { id: "#CLT-2398", place: "Parque das Flores", time: "07:45", status: "Concluída" },
] as const;

export default function Home() {
  return (
    <div className="page-container">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Bom dia, Carlos
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
            Acompanhe as coletas e os principais números da operação de hoje.
          </p>
        </div>
        <button className="button-primary" type="button">
          <PlusIcon className="size-4" />
          Nova coleta
        </button>
      </section>

      <section aria-label="Resumo das coletas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <div className={`metric-icon metric-icon-${metric.tone}`}>
                <Icon className="size-5" />
              </div>
              <p className="mt-5 text-sm font-medium text-muted">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{metric.value}</p>
              <p className="mt-2 text-xs text-muted">{metric.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
        <article className="panel overflow-hidden">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Coletas recentes</h2>
              <p className="panel-description">Programação e andamento de hoje</p>
            </div>
            <button className="button-ghost" type="button">
              Ver todas <ArrowUpRightIcon className="size-4" />
            </button>
          </div>

          <div className="divide-y divide-border">
            {collections.map((collection) => (
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5" key={collection.id}>
                <div className="hidden size-9 shrink-0 place-items-center rounded-xl bg-surface-subtle text-muted sm:grid">
                  <PackageIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{collection.place}</p>
                    <span className="hidden text-xs text-muted sm:inline">{collection.id}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">Hoje às {collection.time}</p>
                </div>
                <span className={`status status-${collection.status.toLowerCase().replace("í", "i").replace(" ", "-")}`}>
                  {collection.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="panel-title">Próxima coleta</h2>
              <p className="panel-description">Seu próximo compromisso</p>
            </div>
            <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <CalendarIcon className="size-5" />
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-border bg-surface-subtle p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Hoje, 08:30</p>
            <p className="mt-2 font-semibold text-foreground">Congregação Central</p>
            <p className="mt-1 text-sm leading-6 text-muted">Rua das Palmeiras, 124 · Centro</p>
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted">
              <RouteIcon className="size-4" />
              3,2 km · aproximadamente 12 min
            </div>
          </div>
          <button className="button-secondary mt-4 w-full" type="button">Ver detalhes da rota</button>
        </article>
      </section>
    </div>
  );
}
