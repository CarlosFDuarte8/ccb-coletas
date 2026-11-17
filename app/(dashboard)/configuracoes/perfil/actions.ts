"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnProfile(formData: FormData) {
  const user = await requireUser();
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (fullName.length < 3 || fullName.length > 120) redirect("/configuracoes/perfil?error=Informe+um+nome+válido");

  const admin = createAdminClient();
  const { error: profileError } = await admin.from("profiles").update({ full_name: fullName, updated_at: new Date().toISOString() }).eq("id", user.id);
  const { error: authError } = await admin.auth.admin.updateUserById(user.id, { user_metadata: { full_name: fullName } });
  if (profileError || authError) redirect(`/configuracoes/perfil?error=${encodeURIComponent(profileError?.message ?? authError?.message ?? "Não foi possível atualizar o perfil")}`);
  await admin.from("audit_log").insert({ user_id: user.id, action: "update", entity: "profiles", entity_id: user.id, details: { field: "full_name" } });
  revalidatePath("/", "layout");
  redirect("/configuracoes/perfil?success=Perfil+atualizado");
}

export async function changeOwnPassword(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (newPassword.length < 10) redirect("/configuracoes/perfil?error=A+nova+senha+deve+ter+pelo+menos+10+caracteres");
  if (newPassword !== confirmation) redirect("/configuracoes/perfil?error=A+confirmação+da+senha+não+confere");
  if (newPassword === currentPassword) redirect("/configuracoes/perfil?error=A+nova+senha+deve+ser+diferente+da+atual");

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (signInError) redirect("/configuracoes/perfil?error=A+senha+atual+está+incorreta");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) redirect(`/configuracoes/perfil?error=${encodeURIComponent(error.message)}`);
  const admin = createAdminClient();
  await admin.from("audit_log").insert({ user_id: user.id, action: "update_password", entity: "profiles", entity_id: user.id, details: {} });
  redirect("/configuracoes/perfil?success=Senha+alterada+com+sucesso");
}
