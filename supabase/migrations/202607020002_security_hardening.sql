alter table public.app_migrations enable row level security;
revoke all on table public.app_migrations from anon, authenticated;
grant select, insert on table public.app_migrations to service_role;

revoke execute on function public.is_master() from public, anon;
revoke execute on function public.has_menu(public.app_menu) from public, anon;
revoke execute on function public.can_access_church(text) from public, anon;
revoke execute on function public.can_write_church(text) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

