alter table public.profiles
  add column if not exists all_churches_access boolean not null default true,
  add column if not exists all_churches_write boolean not null default false;

create or replace function public.can_access_church(required_church_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_master() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and (
      p.all_churches_access
      or p.all_churches_write
      or exists (select 1 from public.user_church_access uca where uca.user_id = p.id and uca.church_id = required_church_id)
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
      p.all_churches_write
      or exists (select 1 from public.user_church_access uca where uca.user_id = p.id and uca.church_id = required_church_id and uca.can_write)
      or exists (
        select 1 from public.user_sector_access usa
        join public.churches c on c.sector_id = usa.sector_id
        where usa.user_id = p.id and c.id = required_church_id and usa.can_write
      )
    )
  )
$$;

revoke execute on function public.can_access_church(text) from public, anon;
revoke execute on function public.can_write_church(text) from public, anon;
grant execute on function public.can_access_church(text) to authenticated, service_role;
grant execute on function public.can_write_church(text) to authenticated, service_role;

