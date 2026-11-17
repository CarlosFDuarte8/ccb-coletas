"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLandingPath, type AppRole, type MenuKey } from "@/config/permissions";

export type LoginState = { error?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe seu e-mail e sua senha." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "E-mail ou senha inválidos." };

  const [{ data: profile }, { data: permissions }] = await Promise.all([
    supabase.from("profiles").select("role,active").eq("id", data.user.id).maybeSingle(),
    supabase.from("user_menu_permissions").select("menu").eq("user_id", data.user.id),
  ]);
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { error: "Este usuário está inativo. Solicite acesso ao administrador." };
  }
  const role = profile.role as AppRole;
  const menus = role === "super_admin"
    ? ["dashboard" as MenuKey]
    : (permissions?.map((permission) => permission.menu as MenuKey) ?? []);
  redirect(getLandingPath(menus));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
