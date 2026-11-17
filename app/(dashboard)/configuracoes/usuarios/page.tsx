import {
  BuildingIcon,
  CheckCircleIcon,
  PlusIcon,
  UsersIcon,
} from "@/components/icons";
import {
  appRoles,
  menuKeys,
  menuLabels,
  roleLabels,
  type AppRole,
  type MenuKey,
} from "@/config/permissions";
import { requireSuperAdmin } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { createManagedUser, updateManagedUser } from "./actions";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  active: boolean;
  all_churches_access: boolean;
  all_churches_write: boolean;
};
type ChurchRow = { id: string; name: string; code: string; sector_id: string };
type AccessRow = { user_id: string; church_id: string; can_write: boolean };
type MenuRow = { user_id: string; menu: MenuKey };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const superAdmin = await requireSuperAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const [
    { data: profiles },
    { data: churches },
    { data: accesses },
    { data: permissions },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email,role,active,all_churches_access,all_churches_write")
      .order("full_name"),
    supabase
      .from("churches")
      .select("id,name,code,sector_id")
      .eq("active", true)
      .order("name"),
    supabase.from("user_church_access").select("user_id,church_id,can_write"),
    supabase.from("user_menu_permissions").select("user_id,menu"),
  ]);
  const users = (profiles ?? []) as ProfileRow[];
  const churchRows = (churches ?? []) as ChurchRow[];
  const accessRows = (accesses ?? []) as AccessRow[];
  const menuRows = (permissions ?? []) as MenuRow[];

  return (
    <div className="page-container">
      <section>
        <p className="eyebrow">Segurança</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Usuários e acessos
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Cadastre usuários e determine exatamente quais menus e igrejas cada
          pessoa poderá consultar ou alterar.
        </p>
      </section>

      {params.success && (
        <p className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand">
          {params.success}
        </p>
      )}
      {params.error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {params.error}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Info
          icon={UsersIcon}
          label="Usuários cadastrados"
          value={String(users.length)}
        />
        <Info
          icon={CheckCircleIcon}
          label="Usuários ativos"
          value={String(users.filter((user) => user.active).length)}
        />
        <Info
          icon={BuildingIcon}
          label="Igrejas na nuvem"
          value={String(churchRows.length)}
        />
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Novo usuário</h2>
            <p className="panel-description">
              A senha temporária poderá ser alterada posteriormente pelo
              usuário.
            </p>
          </div>
          <PlusIcon className="size-5 text-brand" />
        </div>
        <form action={createManagedUser} className="space-y-6 p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="field-label">
              Nome completo
              <input className="form-control" name="fullName" required />
            </label>
            <label className="field-label">
              E-mail
              <input
                className="form-control"
                name="email"
                required
                type="email"
              />
            </label>
            <label className="field-label">
              Senha temporária
              <input
                className="form-control"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>
            <label className="field-label">
              Perfil
              <select
                className="form-control"
                defaultValue="church_manager"
                name="role"
              >
                {appRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <PermissionFields allChurchesAccess churches={churchRows} />
          <div className="flex justify-end">
            <button className="button-primary" type="submit">
              <PlusIcon className="size-4" /> Criar usuário
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Acessos cadastrados
          </h2>
          <p className="mt-1 text-xs text-muted">
            O Superadministrador sempre mantém acesso integral.
          </p>
        </div>
        {users.map((user) => {
          const userAccess = accessRows.filter(
            (access) => access.user_id === user.id,
          );
          const userMenus = menuRows
            .filter((permission) => permission.user_id === user.id)
            .map((permission) => permission.menu);
          const isSuperAdmin = user.id === superAdmin.id || user.role === "super_admin";
          return (
            <details className="panel overflow-hidden" key={user.id}>
              <summary className="flex list-none items-center gap-3 p-4 sm:p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft font-semibold text-brand">
                  {initials(user.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {user.full_name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {user.email}
                  </span>
                </span>
                <span
                  className={`record-badge ${user.active ? "record-confirmed" : "record-draft"}`}
                >
                  {isSuperAdmin ? "Superadministrador" : roleLabels[user.role]}
                </span>
              </summary>
              <div className="border-t border-border p-4 sm:p-5">
                {isSuperAdmin ? (
                  <p className="text-sm text-muted">
                    Este é o perfil Superadministrador protegido. Seu acesso não
                    pode ser reduzido pelo sistema.
                  </p>
                ) : (
                  <form action={updateManagedUser} className="space-y-6">
                    <input name="userId" type="hidden" value={user.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="field-label">
                        Perfil
                        <select
                          className="form-control"
                          defaultValue={user.role}
                          name="role"
                        >
                          {appRoles.map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-6 flex items-center gap-2 text-sm text-foreground">
                        <input
                          defaultChecked={user.active}
                          name="active"
                          type="checkbox"
                        />{" "}
                        Usuário ativo
                      </label>
                    </div>
                    <PermissionFields
                      churches={churchRows}
                      allChurchesAccess={user.all_churches_access}
                      allChurchesWrite={user.all_churches_write}
                      selectedAccess={userAccess}
                      selectedMenus={userMenus}
                    />
                    <div className="flex justify-end">
                      <button className="button-primary" type="submit">
                        Salvar permissões
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}

function PermissionFields({
  churches,
  allChurchesAccess = false,
  allChurchesWrite = false,
  selectedAccess = [],
  selectedMenus = [],
}: {
  churches: ChurchRow[];
  allChurchesAccess?: boolean;
  allChurchesWrite?: boolean;
  selectedAccess?: AccessRow[];
  selectedMenus?: MenuKey[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">
          Menus permitidos
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {menuKeys
            .filter((menu) => menu !== "users")
            .map((menu) => (
              <label
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                key={menu}
              >
                <input
                  defaultChecked={selectedMenus.includes(menu)}
                  name="menus"
                  type="checkbox"
                  value={menu}
                />{" "}
                {menuLabels[menu]}
              </label>
            ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">
          Igrejas permitidas
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-soft px-3 py-3 text-xs text-foreground">
            <input defaultChecked={allChurchesAccess} name="allChurchesAccess" type="checkbox" />
            <span><span className="block font-semibold">Visualizar todas as igrejas</span><span className="mt-0.5 block text-muted">Liberado por padrão para novos usuários.</span></span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-3 text-xs text-foreground">
            <input defaultChecked={allChurchesWrite} name="allChurchesWrite" type="checkbox" />
            <span><span className="block font-semibold">Alterar todas as igrejas</span><span className="mt-0.5 block text-muted">Permite registrar e editar dados em qualquer igreja.</span></span>
          </label>
        </div>
        {churches.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-xs text-muted">
            As permissões individuais por igreja aparecerão após a migração. O acesso global acima já funciona com as igrejas locais.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {churches.map((church) => {
              const access = selectedAccess.find(
                (item) => item.church_id === church.id,
              );
              return (
                <div
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                  key={church.id}
                >
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      defaultChecked={Boolean(access)}
                      name="churches"
                      type="checkbox"
                      value={church.id}
                    />{" "}
                    <span>
                      <span className="block font-medium">{church.name}</span>
                      <span className="text-muted">{church.code}</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-muted">
                    <input
                      defaultChecked={access?.can_write}
                      name="writableChurches"
                      type="checkbox"
                      value={church.id}
                    />{" "}
                    Pode alterar
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </fieldset>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersIcon;
  label: string;
  value: string;
}) {
  return (
    <article className="metric-card flex items-center gap-3">
      <div className="metric-icon metric-icon-brand">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-0.5 text-xl font-semibold text-foreground">{value}</p>
      </div>
    </article>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? "?"}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}
