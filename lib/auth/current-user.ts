import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { menuKeys, type AppRole, type MenuKey } from "@/config/permissions";
import { createClient } from "@/lib/supabase/server";
import type { AppUserContext } from "./types";

export const getCurrentUser = cache(async (): Promise<AppUserContext | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: menuRows }, { data: churchRows }, { data: sectorRows }] = await Promise.all([
    supabase.from("profiles").select("full_name,email,role,active,all_churches_access,all_churches_write").eq("id", user.id).maybeSingle(),
    supabase.from("user_menu_permissions").select("menu").eq("user_id", user.id),
    supabase.from("user_church_access").select("church_id,can_write").eq("user_id", user.id),
    supabase.from("user_sector_access").select("sector_id,can_write").eq("user_id", user.id),
  ]);

  const role = (profile?.role ?? "viewer") as AppRole;
  const isSuperAdmin = role === "super_admin";
  const canAccessAllChurches = isSuperAdmin || Boolean(profile?.all_churches_access) || Boolean(profile?.all_churches_write);
  const canWriteAllChurches = isSuperAdmin || Boolean(profile?.all_churches_write);
  let churchIds = churchRows?.map((row) => String(row.church_id)) ?? [];
  let writableChurchIds = churchRows?.filter((row) => row.can_write).map((row) => String(row.church_id)) ?? [];

  if (!isSuperAdmin && sectorRows?.length) {
    const sectorIds = sectorRows.map((row) => String(row.sector_id));
    const { data: sectorChurches } = await supabase.from("churches").select("id,sector_id").in("sector_id", sectorIds);
    churchIds = [...new Set([...churchIds, ...(sectorChurches?.map((church) => String(church.id)) ?? [])])];
    const writableSectors = new Set(sectorRows.filter((row) => row.can_write).map((row) => String(row.sector_id)));
    writableChurchIds = [...new Set([
      ...writableChurchIds,
      ...(sectorChurches?.filter((church) => writableSectors.has(String(church.sector_id))).map((church) => String(church.id)) ?? []),
    ])];
  }

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    name: profile?.full_name || user.user_metadata.full_name || user.email?.split("@")[0] || "Usuário",
    role,
    active: profile?.active ?? false,
    menus: isSuperAdmin ? [...menuKeys] : (menuRows?.map((row) => row.menu as MenuKey) ?? []),
    churchIds: canAccessAllChurches ? null : churchIds,
    writableChurchIds: canWriteAllChurches ? null : writableChurchIds,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.active) redirect("/login?error=inactive");
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect("/");
  return user;
}
