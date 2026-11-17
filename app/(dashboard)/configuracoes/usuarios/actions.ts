"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appRoles, menuKeys, type AssignableRole, type MenuKey } from "@/config/permissions";
import { requireSuperAdmin } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";

function values(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function parseRole(formData: FormData): AssignableRole {
  const role = String(formData.get("role") ?? "viewer") as AssignableRole;
  return appRoles.includes(role) ? role : "viewer";
}

function parseMenus(formData: FormData) {
  return values(formData, "menus").filter((menu): menu is MenuKey => menuKeys.includes(menu as MenuKey));
}

async function replacePermissions(userId: string, formData: FormData) {
  const admin = createAdminClient();
  const menus = parseMenus(formData);
  const selectedChurchIds = values(formData, "churches");
  const writable = new Set(values(formData, "writableChurches"));
  const churchIds = [...new Set([...selectedChurchIds, ...writable])];

  const { error: menuDeleteError } = await admin.from("user_menu_permissions").delete().eq("user_id", userId);
  const { error: churchDeleteError } = await admin.from("user_church_access").delete().eq("user_id", userId);
  if (menuDeleteError || churchDeleteError) throw menuDeleteError ?? churchDeleteError;

  if (menus.length) {
    const { error } = await admin.from("user_menu_permissions").insert(menus.map((menu) => ({ user_id: userId, menu })));
    if (error) throw error;
  }
  if (churchIds.length) {
    const { error } = await admin.from("user_church_access").insert(churchIds.map((church_id) => ({
      user_id: userId,
      church_id,
      can_write: writable.has(church_id),
    })));
    if (error) throw error;
  }
}

export async function createManagedUser(formData: FormData) {
  const superAdmin = await requireSuperAdmin();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (fullName.length < 3 || !email.includes("@") || password.length < 8) {
    redirect("/configuracoes/usuarios?error=Confira+nome,+e-mail+e+senha+temporária");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) redirect(`/configuracoes/usuarios?error=${encodeURIComponent(error?.message ?? "Não foi possível criar o usuário")}`);

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    full_name: fullName,
    email,
    role: parseRole(formData),
    active: true,
    all_churches_access: formData.get("allChurchesAccess") === "on" || formData.get("allChurchesWrite") === "on",
    all_churches_write: formData.get("allChurchesWrite") === "on",
    updated_at: new Date().toISOString(),
  });
  if (profileError) redirect(`/configuracoes/usuarios?error=${encodeURIComponent(profileError.message)}`);
  await replacePermissions(data.user.id, formData);
  await admin.from("audit_log").insert({ user_id: superAdmin.id, action: "create_user", entity: "profiles", entity_id: data.user.id, details: { email, role: parseRole(formData) } });
  revalidatePath("/", "layout");
  redirect("/configuracoes/usuarios?success=Usuário+criado+com+sucesso");
}

export async function updateManagedUser(formData: FormData) {
  const superAdmin = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === superAdmin.id) redirect("/configuracoes/usuarios?error=O+perfil+Superadministrador+não+pode+ser+rebaixado");

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({
    role: parseRole(formData),
    active: formData.get("active") === "on",
    all_churches_access: formData.get("allChurchesAccess") === "on" || formData.get("allChurchesWrite") === "on",
    all_churches_write: formData.get("allChurchesWrite") === "on",
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
  if (error) redirect(`/configuracoes/usuarios?error=${encodeURIComponent(error.message)}`);
  await replacePermissions(userId, formData);
  await admin.from("audit_log").insert({ user_id: superAdmin.id, action: "update_user_access", entity: "profiles", entity_id: userId, details: { role: parseRole(formData), active: formData.get("active") === "on" } });
  revalidatePath("/", "layout");
  redirect("/configuracoes/usuarios?success=Permissões+atualizadas");
}
