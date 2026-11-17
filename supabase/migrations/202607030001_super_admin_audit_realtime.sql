alter type public.app_role rename value 'master' to 'super_admin';

create or replace function public.app_super_admin_email()
returns text language sql immutable set search_path = ''
as $$ select 'carlosf.duarte8@gmail.com'::text $$;

create or replace function public.app_master_email()
returns text language sql immutable set search_path = ''
as $$ select public.app_super_admin_email() $$;

create or replace function public.is_master()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active and role = 'super_admin'
  )
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_master() $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    case when lower(coalesce(new.email, '')) = public.app_super_admin_email() then 'super_admin'::public.app_role else 'viewer'::public.app_role end,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case when lower(excluded.email) = public.app_super_admin_email() then 'super_admin'::public.app_role else public.profiles.role end,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.set_operational_audit_fields()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.capture_audit_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  row_id text;
  event_details jsonb;
begin
  row_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
  event_details := case tg_op
    when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
    when 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
    else jsonb_build_object('old', to_jsonb(old))
  end;
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, row_id, event_details);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['collections', 'deposits', 'expenses'] loop
    execute format('drop trigger if exists %I_set_audit_fields on public.%I', table_name, table_name);
    execute format('create trigger %I_set_audit_fields before insert or update on public.%I for each row execute function public.set_operational_audit_fields()', table_name, table_name);
  end loop;
  foreach table_name in array array['sectors', 'churches', 'monthly_competencies', 'service_schedules', 'schedule_exceptions', 'collections', 'deposits', 'expenses'] loop
    execute format('drop trigger if exists %I_capture_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_capture_audit after insert or update or delete on public.%I for each row execute function public.capture_audit_event()', table_name, table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['sectors', 'churches', 'monthly_competencies', 'service_schedules', 'schedule_exceptions', 'collections', 'deposits', 'expenses'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.set_operational_audit_fields() from public, anon, authenticated;
revoke execute on function public.capture_audit_event() from public, anon, authenticated;
grant execute on function public.is_super_admin() to authenticated, service_role;
