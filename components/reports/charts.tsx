import type { ReportChurch, ReportMonth } from "@/lib/reports/report";
import { formatCurrency } from "@/lib/domain/money";

function compactMoney(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(valueInCents / 100);
}

export function EvolutionChart({ months }: { months: ReportMonth[] }) {
  const width = Math.max(720, months.length * 76);
  const height = 260;
  const chartTop = 20;
  const baseline = 215;
  const chartHeight = baseline - chartTop;
  const maximum = Math.max(1, ...months.flatMap((month) => [month.collectedInCents, month.depositedInCents]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-brand" /> Coletado</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[#4f8bd6]" /> Depositado</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <svg aria-label="Gráfico de evolução mensal" className="h-[260px] min-w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = baseline - chartHeight * ratio;
            return <g key={ratio}><line stroke="var(--border)" strokeDasharray="3 4" x1="42" x2={width - 12} y1={y} y2={y} /><text fill="var(--muted)" fontSize="9" textAnchor="end" x="36" y={y + 3}>{compactMoney(maximum * ratio)}</text></g>;
          })}
          {months.map((month, index) => {
            const slot = (width - 64) / Math.max(1, months.length);
            const center = 52 + slot * index + slot / 2;
            const collectedHeight = chartHeight * (month.collectedInCents / maximum);
            const depositedHeight = chartHeight * (month.depositedInCents / maximum);
            return (
              <g key={month.competency}>
                <rect fill="var(--brand)" height={collectedHeight} rx="3" width="15" x={center - 17} y={baseline - collectedHeight}><title>{month.label}: {formatCurrency(month.collectedInCents)} coletado</title></rect>
                <rect fill="#4f8bd6" height={depositedHeight} rx="3" width="15" x={center + 2} y={baseline - depositedHeight}><title>{month.label}: {formatCurrency(month.depositedInCents)} depositado</title></rect>
                <text fill="var(--muted)" fontSize="9" textAnchor="middle" x={center} y="236">{month.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function DistributionChart({ normalInCents, specialInCents, cultoInCents, rjmInCents }: { normalInCents: number; specialInCents: number; cultoInCents: number; rjmInCents: number }) {
  const total = normalInCents + specialInCents;
  const normalPercentage = total ? (normalInCents / total) * 100 : 0;
  return (
    <div className="grid gap-6 sm:grid-cols-[150px_1fr] sm:items-center">
      <div className="relative mx-auto size-36 rounded-full" style={{ background: `conic-gradient(var(--brand) 0 ${normalPercentage}%, #d99a38 ${normalPercentage}% 100%)` }}>
        <div className="absolute inset-5 grid place-items-center rounded-full bg-surface text-center"><div><p className="text-[10px] uppercase tracking-wider text-muted">Total</p><p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(total)}</p></div></div>
      </div>
      <div className="space-y-3">
        <LegendRow color="bg-brand" label="Coleta normal" value={normalInCents} />
        <LegendRow color="bg-[#d99a38]" label="Coleta especial" value={specialInCents} />
        <div className="border-t border-border pt-3"><LegendRow color="bg-[#4f8bd6]" label="Cultos" value={cultoInCents} /><div className="mt-3"><LegendRow color="bg-[#8b72cf]" label="RJM" value={rjmInCents} /></div></div>
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className="flex items-center gap-2.5"><i className={`size-2.5 rounded-sm ${color}`} /><span className="flex-1 text-xs text-muted">{label}</span><strong className="text-xs text-foreground">{formatCurrency(value)}</strong></div>;
}

export function ChurchRankingChart({ churches }: { churches: ReportChurch[] }) {
  const maximum = Math.max(1, ...churches.map((church) => church.collectedInCents));
  return (
    <div className="space-y-4">
      {churches.slice(0, 8).map((church, index) => (
        <div key={church.churchId}>
          <div className="mb-1.5 flex items-center gap-3 text-xs"><span className="w-5 text-muted">{index + 1}.</span><span className="min-w-0 flex-1 truncate font-medium text-foreground">{church.churchName}</span><strong className="text-foreground">{formatCurrency(church.collectedInCents)}</strong></div>
          <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand" style={{ width: `${(church.collectedInCents / maximum) * 100}%` }} /></div>
        </div>
      ))}
      {churches.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhuma igreja no escopo selecionado.</p>}
    </div>
  );
}
