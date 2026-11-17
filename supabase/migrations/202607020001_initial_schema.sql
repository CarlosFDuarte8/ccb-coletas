-- CCB Coletas: estrutura inicial, autenticação e autorização.
-- O usuário mestre é promovido automaticamente pelo e-mail definido em app_master_email().

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('master', 'administrator', 'sector_manager', 'church_manager', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.app_menu as enum ('dashboard', 'collections', 'expenses', 'agenda', 'routes', 'churches', 'teams', 'reports', 'settings', 'users');
exception when duplicate_object then null;
end $$;

create or replace function public.app_master_email()
returns text language sql immutable set search_path = ''
as $$ select 'carlosf.duarte8@gmail.com'::text $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.app_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique on public.profiles (lower(email));

create table if not exists public.sectors (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.churches (
  id text primary key,
  sector_id text not null references public.sectors(id) on delete restrict,
  name text not null,
  code text not null,
  address text not null default '',
  latitude text not null default '',
  longitude text not null default '',
  contacts jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists churches_code_unique on public.churches (lower(code));

create table if not exists public.user_sector_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sector_id text not null references public.sectors(id) on delete cascade,
  can_write boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, sector_id)
);

create table if not exists public.user_church_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  church_id text not null references public.churches(id) on delete cascade,
  can_write boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, church_id)
);

create table if not exists public.user_menu_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  menu public.app_menu not null,
  created_at timestamptz not null default now(),
  primary key (user_id, menu)
);

create table if not exists public.monthly_competencies (
  id text primary key,
  church_id text not null references public.churches(id) on delete cascade,
  competency text not null check (competency ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, competency)
);

create table if not exists public.service_schedules (
  id text primary key,
  church_id text not null references public.churches(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  time time not null,
  meeting_type text not null check (meeting_type in ('culto', 'rjm')),
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_exceptions (
  id text primary key,
  church_id text not null references public.churches(id) on delete cascade,
  date date not null,
  description text not null default '',
  overrides jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id text primary key,
  church_id text not null references public.churches(id) on delete cascade,
  competency text not null check (competency ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  date date not null,
  meeting_type text not null check (meeting_type in ('culto', 'rjm')),
  collection_type text not null check (collection_type in ('normal', 'especial')),
  amount_in_cents bigint not null check (amount_in_cents >= 0),
  notes text not null default '',
  service_schedule_id text references public.service_schedules(id) on delete set null,
  service_time time,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists collections_occurrence_unique
on public.collections (church_id, date, service_schedule_id)
where service_schedule_id is not null;

create table if not exists public.deposits (
  id text primary key,
  church_id text not null references public.churches(id) on delete cascade,
  competency text not null check (competency ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  date date not null,
  transaction_number text not null default '',
  amount_in_cents bigint not null check (amount_in_cents >= 0),
  denomination_counts jsonb not null default '{}'::jsonb,
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  confirmed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists deposits_transaction_number_unique
on public.deposits (lower(transaction_number))
where status = 'confirmed' and btrim(transaction_number) <> '';

create table if not exists public.expenses (
  id text primary key,
  church_id text not null references public.churches(id) on delete cascade,
  competency text not null check (competency ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  due_date date,
  payment_date date,
  status text not null check (status in ('pending', 'paid')),
  payment_method text not null check (payment_method in ('automatic_debit', 'pix', 'bank_slip', 'cash', 'transfer', 'other', 'not_informed')),
  description text not null,
  category text not null,
  amount_in_cents bigint not null check (amount_in_cents >= 0),
  payee text not null default '',
  document_number text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_master()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active and role = 'master'
  )
$$;

create or replace function public.has_menu(required_menu public.app_menu)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_master() or exists (
    select 1
    from public.profiles p
    join public.user_menu_permissions ump on ump.user_id = p.id
    where p.id = (select auth.uid()) and p.active and ump.menu = required_menu
  )
$$;

create or replace function public.can_access_church(required_church_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_master() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and (
      exists (select 1 from public.user_church_access uca where uca.user_id = p.id and uca.church_id = required_church_id)
      or exists (
        select 1 from public.user_sector_access usa
        join public.churches c on c.sector_id = usa.sector_id
        where usa.user_id = p.id and c.id = required_church_id
      )
    )
  )
$$;

create or replace function public.can_write_church(required_church_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_master() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and (
      exists (select 1 from public.user_church_access uca where uca.user_id = p.id and uca.church_id = required_church_id and uca.can_write)
      or exists (
        select 1 from public.user_sector_access usa
        join public.churches c on c.sector_id = usa.sector_id
        where usa.user_id = p.id and c.id = required_church_id and usa.can_write
      )
    )
  )
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    case when lower(coalesce(new.email, '')) = public.app_master_email() then 'master'::public.app_role else 'viewer'::public.app_role end,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case when lower(excluded.email) = public.app_master_email() then 'master'::public.app_role else public.profiles.role end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, email, role, active)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(coalesce(email, ''), '@', 1)), coalesce(email, ''),
  case when lower(coalesce(email, '')) = public.app_master_email() then 'master'::public.app_role else 'viewer'::public.app_role end,
  true
from auth.users
on conflict (id) do update set
  email = excluded.email,
  role = case when lower(excluded.email) = public.app_master_email() then 'master'::public.app_role else public.profiles.role end,
  updated_at = now();

alter table public.profiles enable row level security;
alter table public.sectors enable row level security;
alter table public.churches enable row level security;
alter table public.user_sector_access enable row level security;
alter table public.user_church_access enable row level security;
alter table public.user_menu_permissions enable row level security;
alter table public.monthly_competencies enable row level security;
alter table public.service_schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.collections enable row level security;
alter table public.deposits enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_master());
drop policy if exists profiles_master_write on public.profiles;
create policy profiles_master_write on public.profiles for all to authenticated
using (public.is_master()) with check (public.is_master());

drop policy if exists sectors_select on public.sectors;
create policy sectors_select on public.sectors for select to authenticated using (
  public.is_master()
  or exists (select 1 from public.user_sector_access usa where usa.user_id = (select auth.uid()) and usa.sector_id = id)
  or exists (select 1 from public.churches c where c.sector_id = id and public.can_access_church(c.id))
);
drop policy if exists sectors_master_write on public.sectors;
create policy sectors_master_write on public.sectors for all to authenticated
using (public.is_master()) with check (public.is_master());

drop policy if exists churches_select on public.churches;
create policy churches_select on public.churches for select to authenticated using (public.can_access_church(id));
drop policy if exists churches_master_write on public.churches;
create policy churches_master_write on public.churches for all to authenticated
using (public.is_master()) with check (public.is_master());

drop policy if exists user_sector_access_select on public.user_sector_access;
create policy user_sector_access_select on public.user_sector_access for select to authenticated
using (user_id = (select auth.uid()) or public.is_master());
drop policy if exists user_sector_access_master_write on public.user_sector_access;
create policy user_sector_access_master_write on public.user_sector_access for all to authenticated
using (public.is_master()) with check (public.is_master());

drop policy if exists user_church_access_select on public.user_church_access;
create policy user_church_access_select on public.user_church_access for select to authenticated
using (user_id = (select auth.uid()) or public.is_master());
drop policy if exists user_church_access_master_write on public.user_church_access;
create policy user_church_access_master_write on public.user_church_access for all to authenticated
using (public.is_master()) with check (public.is_master());

drop policy if exists user_menu_permissions_select on public.user_menu_permissions;
create policy user_menu_permissions_select on public.user_menu_permissions for select to authenticated
using (user_id = (select auth.uid()) or public.is_master());
drop policy if exists user_menu_permissions_master_write on public.user_menu_permissions;
create policy user_menu_permissions_master_write on public.user_menu_permissions for all to authenticated
using (public.is_master()) with check (public.is_master());

do $$
declare table_name text;
begin
  foreach table_name in array array['monthly_competencies','service_schedules','schedule_exceptions','collections','deposits','expenses'] loop
    execute format('drop policy if exists %I_select on public.%I', table_name, table_name);
    execute format('create policy %I_select on public.%I for select to authenticated using (public.can_access_church(church_id))', table_name, table_name);
    execute format('drop policy if exists %I_insert on public.%I', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.can_write_church(church_id))', table_name, table_name);
    execute format('drop policy if exists %I_update on public.%I', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.can_write_church(church_id)) with check (public.can_write_church(church_id))', table_name, table_name);
    execute format('drop policy if exists %I_delete on public.%I', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.can_write_church(church_id))', table_name, table_name);
  end loop;
end $$;

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated using (public.is_master());
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated
with check (user_id = (select auth.uid()));

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.is_master() to authenticated, service_role;
grant execute on function public.has_menu(public.app_menu) to authenticated, service_role;
grant execute on function public.can_access_church(text) to authenticated, service_role;
grant execute on function public.can_write_church(text) to authenticated, service_role;

