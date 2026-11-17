-- Regras financeiras, saldo local acumulado e correções auditáveis.
-- Contas novas aguardam liberação administrativa e começam sem escopo global.
alter table public.profiles alter column all_churches_access set default false;
alter table public.profiles alter column active set default false;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name,email,role,active,all_churches_access,all_churches_write)
    values(new.id,coalesce(new.raw_user_meta_data ->> 'full_name',split_part(coalesce(new.email,''),'@',1)),coalesce(new.email,''),'viewer',false,false,false)
    on conflict(id) do update set email=excluded.email,updated_at=clock_timestamp();
  return new;
end;
$$;
update public.profiles as profile set all_churches_access=false,all_churches_write=false
  where role<>'super_admin'
    and not exists(select 1 from public.user_menu_permissions where user_id=profile.id)
    and not exists(select 1 from public.user_church_access where user_id=profile.id)
    and not exists(select 1 from public.user_sector_access where user_id=profile.id);

alter table public.deposits drop constraint deposits_status_check;
alter table public.deposits add constraint deposits_status_check check(status in ('draft','confirmed','reversed'));
alter table public.deposits add column reversed_at timestamptz,
  add column reversal_reason text not null default '',
  add column reversed_by uuid references public.profiles(id) on delete set null;
alter table public.monthly_competencies add column reopen_reason text not null default '',
  add column reopened_at timestamptz,
  add column reopened_by uuid references public.profiles(id) on delete set null;
alter table public.expenses add constraint expenses_paid_date check ((status='paid') = (payment_date is not null));

create or replace function public.can_correct_financial_records(required_church_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_write_church(required_church_id) and public.has_menu('collections') and exists(
    select 1 from public.profiles where id=auth.uid() and active and role in ('super_admin','administrator','sector_manager')
  )
$$;

create or replace function public.set_operational_audit_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_by := auth.uid();
  else new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.updated_by := auth.uid();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
drop policy if exists audit_log_insert on public.audit_log;
revoke insert,update,delete on public.audit_log from authenticated;

create or replace function public.valid_collection_breakdown(value jsonb, total bigint, reserved bigint)
returns boolean language plpgsql immutable set search_path = '' as $$
declare part text; amount bigint; sum_amount bigint := 0;
begin
  if jsonb_typeof(value) <> 'object' or reserved < 0 then return false; end if;
  if (select count(*) from jsonb_object_keys(value)) <> 5 then return false; end if;
  foreach part in array array['piety_in_cents','maintenance_in_cents','construction_in_cents','missions_in_cents','others_in_cents'] loop
    if not (value ? part) or jsonb_typeof(value -> part) <> 'number' or (value ->> part) !~ '^\d+$' then return false; end if;
    amount := (value ->> part)::bigint;
    sum_amount := sum_amount + amount;
  end loop;
  return sum_amount = total and reserved <= (value ->> 'maintenance_in_cents')::bigint;
exception when numeric_value_out_of_range or invalid_text_representation then return false;
end;
$$;

alter table public.collections add constraint collections_valid_breakdown
  check (public.valid_collection_breakdown(breakdown, amount_in_cents, maintenance_cash_in_cents));
alter table public.collections add constraint collections_date_matches_competency
  check (to_char(date, 'YYYY-MM') = competency);

-- Um rascunho pode ser contado antes de existir data bancária.
alter table public.deposits alter column date drop not null;
alter table public.deposits add constraint deposits_confirmation_details
  check (status <> 'confirmed' or (date is not null and btrim(transaction_number) <> '' and confirmed_at is not null));
drop index public.deposits_transaction_number_unique;
create unique index deposits_transaction_number_unique on public.deposits(lower(btrim(transaction_number)))
  where status = 'confirmed' and btrim(transaction_number) <> '';

create or replace function public.guard_financial_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare scope_church text; required_menu public.app_menu; importing boolean;
begin
  -- Todos os escritores, inclusive chamadas REST diretas, usam os mesmos locks.
  for scope_church in
    select distinct value from unnest(array[
      case when tg_op <> 'INSERT' then old.church_id end,
      case when tg_op <> 'DELETE' then new.church_id end
    ]) as value where value is not null order by value
  loop
    perform pg_advisory_xact_lock(hashtextextended('ccb-financial:' || scope_church, 0));
  end loop;
  required_menu := case when tg_table_name = 'expenses' then 'expenses'::public.app_menu else 'collections'::public.app_menu end;
  importing := public.is_super_admin() and coalesce(current_setting('app.importing', true), '') = 'true';
  if auth.uid() is not null and not public.has_menu(required_menu) then
    raise exception 'Sem permissão para alterar este módulo.' using errcode = '42501';
  end if;
  if tg_table_name in ('collections','deposits') and not importing then
    if tg_op <> 'INSERT' and exists(select 1 from public.monthly_competencies where church_id = old.church_id and competency = old.competency and status = 'closed') then
      raise exception 'Esta competência está fechada.' using errcode = '23514';
    end if;
    if tg_op <> 'DELETE' and exists(select 1 from public.monthly_competencies where church_id = new.church_id and competency = new.competency and status = 'closed') then
      raise exception 'Esta competência está fechada.' using errcode = '23514';
    end if;
  end if;
  if tg_table_name = 'deposits' and not importing then
    if tg_op <> 'INSERT' and old.status in ('confirmed','reversed') then
      if tg_op = 'DELETE' then raise exception 'Depósitos confirmados devem ser corrigidos por estorno.' using errcode='23514'; end if;
      if old.status = 'reversed' or new.status <> 'reversed' or
        (to_jsonb(old) - array['status','reversed_at','reversed_by','reversal_reason','updated_at','updated_by']) is distinct from
        (to_jsonb(new) - array['status','reversed_at','reversed_by','reversal_reason','updated_at','updated_by']) then
        raise exception 'Depósitos confirmados são imutáveis. Utilize o estorno.' using errcode='23514';
      end if;
      if not public.can_correct_financial_records(old.church_id) then raise exception 'O estorno exige um administrador autorizado.' using errcode='42501'; end if;
      if length(btrim(new.reversal_reason)) < 8 then raise exception 'Informe um motivo de estorno com pelo menos 8 caracteres.' using errcode='23514'; end if;
      new.reversed_at := clock_timestamp(); new.reversed_by := auth.uid();
    elsif new.status = 'reversed' then raise exception 'Somente um depósito confirmado pode ser estornado.' using errcode='23514'; end if;
  end if;
  if tg_table_name = 'expenses' and not importing then
    -- Referência e valor são protegidos pelo fechamento; a baixa pode ocorrer em mês posterior aberto.
    if tg_op in ('INSERT','DELETE') or
      (to_jsonb(old) - array['payment_date','status','payment_source','payment_method','document_number','notes','updated_at','updated_by']) is distinct from
      (to_jsonb(new) - array['payment_date','status','payment_source','payment_method','document_number','notes','updated_at','updated_by']) then
      if (tg_op <> 'INSERT' and exists(select 1 from public.monthly_competencies where church_id=old.church_id and competency=old.competency and status='closed')) or
        (tg_op <> 'DELETE' and exists(select 1 from public.monthly_competencies where church_id=new.church_id and competency=new.competency and status='closed')) then
        raise exception 'Reabra a competência para alterar o valor ou a referência desta despesa.' using errcode='23514';
      end if;
    end if;
    if (tg_op <> 'INSERT' and old.status='paid' and exists(select 1 from public.monthly_competencies where church_id=old.church_id and competency=to_char(old.payment_date,'YYYY-MM') and status='closed')) or
      (tg_op <> 'DELETE' and new.status='paid' and exists(select 1 from public.monthly_competencies where church_id=new.church_id and competency=to_char(new.payment_date,'YYYY-MM') and status='closed')) then
      raise exception 'O mês do pagamento está fechado. Solicite a reabertura para corrigir a baixa.' using errcode='23514';
    end if;
  end if;
  if tg_table_name = 'collections' and tg_op <> 'DELETE' then
    if new.service_schedule_id is not null and not exists(
      select 1 from public.service_schedules where id = new.service_schedule_id and church_id = new.church_id
    ) then raise exception 'A programação deve pertencer à igreja da coleta.' using errcode = '23514'; end if;
  end if;
  if tg_table_name = 'monthly_competencies' and tg_op = 'UPDATE' and (old.church_id, old.competency) is distinct from (new.church_id, new.competency) then
    raise exception 'A igreja e o mês de uma competência não podem ser alterados.' using errcode = '23514';
  end if;
  if tg_table_name = 'monthly_competencies' and not importing then
    if tg_op='DELETE' then raise exception 'Competências devem ser preservadas no histórico.' using errcode='23514'; end if;
    if tg_op='UPDATE' and old.status='closed' and new.status='open' then
      if not public.can_correct_financial_records(new.church_id) then raise exception 'A reabertura exige um administrador autorizado.' using errcode='42501'; end if;
      if length(btrim(new.reopen_reason)) < 8 then raise exception 'Informe um motivo de reabertura com pelo menos 8 caracteres.' using errcode='23514'; end if;
      new.reopened_at := clock_timestamp(); new.reopened_by := auth.uid();
    end if;
    if new.status='closed' then new.closed_at := coalesce(new.closed_at,clock_timestamp()); new.closed_by := auth.uid();
    else new.closed_at := null; new.closed_by := null; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.validate_financial_balance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare scope record; collected bigint; reserved bigint; deposited bigint;
begin
  for scope in
    select distinct church_id, competency from (values
      (case when tg_op <> 'INSERT' then old.church_id end, case when tg_op <> 'INSERT' then old.competency end),
      (case when tg_op <> 'DELETE' then new.church_id end, case when tg_op <> 'DELETE' then new.competency end)
    ) as scopes(church_id,competency) where church_id is not null
  loop
    select coalesce(sum(amount_in_cents),0), coalesce(sum(maintenance_cash_in_cents),0)
      into collected,reserved from public.collections where church_id=scope.church_id and competency=scope.competency;
    if exists(
      select 1 from (
        select sum(delta) over(order by movement_date) as balance from (
          select movement_date,sum(delta) as delta from (
            select date as movement_date,maintenance_cash_in_cents as delta from public.collections where church_id=scope.church_id
            union all
            select payment_date,-amount_in_cents from public.expenses where church_id=scope.church_id and status='paid' and payment_source='maintenance_cash'
          ) movements group by movement_date
        ) daily
      ) ledger where balance < 0
    ) then raise exception 'O caixa local de manutenção não possui saldo suficiente na data do pagamento.' using errcode='23514'; end if;
    if exists(select 1 from public.monthly_competencies where church_id=scope.church_id and competency=scope.competency and status='closed') then
      if exists(select 1 from public.deposits where church_id=scope.church_id and competency=scope.competency and status='draft') then
        raise exception 'Existem depósitos em rascunho.' using errcode='23514';
      end if;
      select coalesce(sum(amount_in_cents),0) into deposited from public.deposits
        where church_id=scope.church_id and competency=scope.competency and status='confirmed';
      if collected - reserved <> deposited then raise exception 'A competência possui saldo pendente.' using errcode='23514'; end if;
    end if;
  end loop;
  return null;
end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['collections','deposits','expenses','monthly_competencies'] loop
    execute format('create trigger %I_guard_financial_scope before insert or update or delete on public.%I for each row execute function public.guard_financial_scope()',table_name,table_name);
    execute format('create constraint trigger %I_validate_financial_balance after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.validate_financial_balance()',table_name,table_name);
  end loop;
end $$;

-- Cada chamada RPC é uma transação. SECURITY INVOKER mantém as políticas RLS.
create table public.database_write_receipts (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  operation_id uuid not null,
  fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,operation_id)
);
alter table public.database_write_receipts enable row level security;
create policy write_receipts_select on public.database_write_receipts for select to authenticated using(user_id=auth.uid());
create policy write_receipts_insert on public.database_write_receipts for insert to authenticated with check(user_id=auth.uid());
grant select,insert on public.database_write_receipts to authenticated;

create or replace function public.apply_database_changes(changes jsonb, operation_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare change jsonb; target text; record_data jsonb; columns_sql text; update_sql text; existing jsonb; record_id text; saved jsonb; receipts jsonb := '[]'::jsonb; churches text[] := '{}'; scope_church text; previous_operation public.database_write_receipts; operation_fingerprint text;
begin
  if auth.uid() is null then raise exception 'Faça login novamente.' using errcode='42501'; end if;
  if changes is null or jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) > 10000 then
    raise exception 'Operação inválida ou grande demais.' using errcode='22023';
  end if;
  if operation_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('ccb-operation:' || auth.uid()::text || ':' || operation_id::text,0));
    operation_fingerprint := md5(changes::text);
    select * into previous_operation from public.database_write_receipts as receipt where receipt.user_id=auth.uid() and receipt.operation_id=apply_database_changes.operation_id;
    if found then
      if previous_operation.fingerprint <> operation_fingerprint then raise exception 'Identificador de operação já utilizado com outros dados.' using errcode='22023'; end if;
      return previous_operation.result;
    end if;
  end if;
  -- Adquire os locks de todas as igrejas afetadas em ordem estável antes dos locks de linha.
  for change in select value from jsonb_array_elements(changes) loop
    target := change ->> 'table';
    if target in ('collections','deposits','expenses','monthly_competencies') then
      churches := array_append(churches, change -> 'row' ->> 'church_id');
      execute format('select church_id from public.%I where id=$1',target) into scope_church using change -> 'row' ->> 'id';
      churches := array_append(churches,scope_church);
    end if;
  end loop;
  for scope_church in select distinct value from unnest(churches) as value where value is not null order by value loop
    perform pg_advisory_xact_lock(hashtextextended('ccb-financial:' || scope_church,0));
  end loop;
  for change in select value from jsonb_array_elements(changes) loop
    target := change ->> 'table';
    if target is null or target not in ('sectors','churches','service_schedules','schedule_exceptions','monthly_competencies','collections','deposits','expenses') then
      raise exception 'Tabela não permitida.' using errcode='42501';
    end if;
    record_data := change -> 'row';
    record_id := record_data ->> 'id';
    if record_id is null or record_id = '' then raise exception 'Registro sem identificador.' using errcode='22023'; end if;
    execute format('select to_jsonb(t) from public.%I t where id=$1 for update',target) into existing using record_id;
    if change ? 'expected_updated_at' then
      if ((change ->> 'expected_updated_at') is null and existing is not null)
        or ((change ->> 'expected_updated_at') is not null and (existing is null or (existing ->> 'updated_at')::timestamptz is distinct from (change ->> 'expected_updated_at')::timestamptz)) then
        raise exception 'Este registro foi alterado por outro usuário. Atualize os dados antes de tentar novamente.' using errcode='40001';
      end if;
    end if;
    if change ->> 'action' = 'delete' then
      execute format('delete from public.%I where id=$1',target) using record_id;
    elsif change ->> 'action' = 'upsert' then
      if record_data ?| array['created_by','updated_by'] then raise exception 'Campos de auditoria não podem ser informados.' using errcode='42501'; end if;
      select string_agg(format('%I',key),',' order by key),
        string_agg(format('%I=input.%I',key,key),',' order by key) filter(where key not in ('id','created_at'))
      into columns_sql,update_sql from jsonb_object_keys(record_data) as key;
      if update_sql is null then raise exception 'Registro incompleto.' using errcode='22023'; end if;
      if existing is null then
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) returning to_jsonb(%I)',target,columns_sql,columns_sql,target,target) into saved using record_data;
      else
        execute format('update public.%I as target set %s from jsonb_populate_record(null::public.%I,$1) as input where target.id=input.id returning to_jsonb(target)',target,update_sql,target) into saved using record_data;
        if saved is null then raise exception 'Sem permissão para alterar este registro.' using errcode='42501'; end if;
      end if;
      receipts := receipts || jsonb_build_array(jsonb_build_object('table',target,'id',record_id,'created_at',saved ->> 'created_at','updated_at',saved ->> 'updated_at'));
    else raise exception 'Ação não permitida.' using errcode='22023'; end if;
  end loop;
  if operation_id is not null then
    insert into public.database_write_receipts(operation_id,fingerprint,result) values(operation_id,operation_fingerprint,receipts);
  end if;
  return receipts;
end;
$$;

create or replace function public.import_database(operations jsonb, replace_existing boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target text; operation jsonb; row_data jsonb; batch jsonb := '[]'::jsonb; existing boolean; skipped integer := 0; counts jsonb := '{}'::jsonb; church_access jsonb; sector_access jsonb;
begin
  if not public.is_super_admin() then raise exception 'Importação exclusiva do Superadministrador.' using errcode='42501'; end if;
  if operations is null or jsonb_typeof(operations) <> 'array' then raise exception 'Importação inválida.' using errcode='22023'; end if;
  perform set_config('app.importing',case when replace_existing then 'true' else 'false' end,true);
  -- Evita concorrência com escritores enquanto o conjunto de dados é substituído.
  lock table public.sectors,public.churches,public.service_schedules,public.schedule_exceptions,
    public.monthly_competencies,public.collections,public.deposits,public.expenses in exclusive mode;
  if replace_existing then
    select coalesce(jsonb_agg(to_jsonb(access)),'[]'::jsonb) into church_access from public.user_church_access as access;
    select coalesce(jsonb_agg(to_jsonb(access)),'[]'::jsonb) into sector_access from public.user_sector_access as access;
    delete from public.expenses; delete from public.deposits; delete from public.collections;
    delete from public.schedule_exceptions; delete from public.service_schedules;
    delete from public.monthly_competencies; delete from public.churches; delete from public.sectors;
  end if;
  for operation in select value from jsonb_array_elements(operations) loop
    target := operation ->> 'table';
    if target is null or target not in ('sectors','churches','service_schedules','schedule_exceptions','monthly_competencies','collections','deposits','expenses') then
      raise exception 'Tabela não permitida na importação.' using errcode='42501';
    end if;
    for row_data in select value from jsonb_array_elements(operation -> 'rows') loop
      if not replace_existing then
        execute format('select exists(select 1 from public.%I where id=$1)',target) into existing using row_data ->> 'id';
        if existing then skipped := skipped + 1; continue; end if;
      end if;
      batch := batch || jsonb_build_array(jsonb_build_object('table',target,'action','upsert','row',row_data));
      counts := jsonb_set(counts,array[target],to_jsonb(coalesce((counts ->> target)::integer,0)+1));
      if jsonb_array_length(batch) = 500 then perform public.apply_database_changes(batch); batch := '[]'::jsonb; end if;
    end loop;
  end loop;
  if jsonb_array_length(batch) > 0 then perform public.apply_database_changes(batch); end if;
  if replace_existing then
    insert into public.user_church_access(user_id,church_id,can_write,created_at)
      select access.user_id,access.church_id,access.can_write,access.created_at
      from jsonb_populate_recordset(null::public.user_church_access,church_access) as access
      join public.churches church on church.id=access.church_id
      on conflict(user_id,church_id) do nothing;
    insert into public.user_sector_access(user_id,sector_id,can_write,created_at)
      select access.user_id,access.sector_id,access.can_write,access.created_at
      from jsonb_populate_recordset(null::public.user_sector_access,sector_access) as access
      join public.sectors sector on sector.id=access.sector_id
      on conflict(user_id,sector_id) do nothing;
  end if;
  insert into public.audit_log(user_id,action,entity,details)
    values(auth.uid(),case when replace_existing then 'replace_import' else 'merge_import' end,'database',jsonb_build_object('tables',jsonb_array_length(operations)));
  perform set_config('app.importing','false',true);
  return jsonb_build_object('counts',counts,'skipped',skipped);
end;
$$;

revoke all on function public.guard_financial_scope() from public,anon,authenticated;
revoke all on function public.validate_financial_balance() from public,anon,authenticated;
revoke all on function public.apply_database_changes(jsonb,uuid) from public,anon;
revoke all on function public.import_database(jsonb,boolean) from public,anon;
grant execute on function public.valid_collection_breakdown(jsonb,bigint,bigint) to authenticated,service_role;
grant execute on function public.apply_database_changes(jsonb,uuid) to authenticated;
grant execute on function public.import_database(jsonb,boolean) to authenticated;
revoke all on function public.can_correct_financial_records(text) from public,anon;
grant execute on function public.can_correct_financial_records(text) to authenticated,service_role;

create index collections_church_date_idx on public.collections(church_id,date);
create index expenses_maintenance_date_idx on public.expenses(church_id,payment_date) where status='paid' and payment_source='maintenance_cash';
create index expenses_church_competency_idx on public.expenses(church_id,competency);
create index deposits_church_competency_idx on public.deposits(church_id,competency);

do $$ declare table_name text; required_menu text; begin
  foreach table_name in array array['monthly_competencies','service_schedules','schedule_exceptions','collections','deposits','expenses'] loop
    required_menu := case when table_name='expenses' then 'expenses' when table_name in ('service_schedules','schedule_exceptions') then 'churches' else 'collections' end;
    execute format('drop policy %I_insert on public.%I',table_name,table_name);
    execute format('drop policy %I_update on public.%I',table_name,table_name);
    execute format('drop policy %I_delete on public.%I',table_name,table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check(public.can_write_church(church_id) and public.has_menu(%L::public.app_menu))',table_name,table_name,required_menu);
    execute format('create policy %I_update on public.%I for update to authenticated using(public.can_write_church(church_id) and public.has_menu(%L::public.app_menu)) with check(public.can_write_church(church_id) and public.has_menu(%L::public.app_menu))',table_name,table_name,required_menu,required_menu);
    execute format('create policy %I_delete on public.%I for delete to authenticated using(public.can_write_church(church_id) and public.has_menu(%L::public.app_menu))',table_name,table_name,required_menu);
  end loop;
end $$;
