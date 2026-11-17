alter table public.collections
  add column if not exists breakdown jsonb not null default jsonb_build_object(
    'piety_in_cents', 0,
    'maintenance_in_cents', 0,
    'construction_in_cents', 0,
    'missions_in_cents', 0,
    'others_in_cents', 0
  ),
  add column if not exists maintenance_cash_in_cents bigint not null default 0 check (maintenance_cash_in_cents >= 0);

update public.collections
set breakdown = jsonb_build_object(
  'piety_in_cents', 0,
  'maintenance_in_cents', 0,
  'construction_in_cents', 0,
  'missions_in_cents', 0,
  'others_in_cents', amount_in_cents
)
where coalesce((breakdown ->> 'piety_in_cents')::bigint, 0)
  + coalesce((breakdown ->> 'maintenance_in_cents')::bigint, 0)
  + coalesce((breakdown ->> 'construction_in_cents')::bigint, 0)
  + coalesce((breakdown ->> 'missions_in_cents')::bigint, 0)
  + coalesce((breakdown ->> 'others_in_cents')::bigint, 0) = 0
  and amount_in_cents > 0;

alter table public.expenses
  add column if not exists payment_source text not null default 'administration_account'
  check (payment_source in ('administration_account', 'maintenance_cash'));
