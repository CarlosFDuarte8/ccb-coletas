import Link from "next/link";
import { SettingsIcon, UsersIcon } from "@/components/icons";
import { roleLabels } from "@/config/permissions";
import { requireUser } from "@/lib/auth/current-user";
import { changeOwnPassword, updateOwnProfile } from "./actions";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  return <div className="page-container">
    <section><Link className="text-xs font-semibold text-brand hover:underline" href="/">← Voltar</Link><p className="eyebrow mt-4">Conta</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Meu perfil</h1><p className="mt-2 max-w-2xl text-sm text-muted">Atualize seus dados pessoais e mantenha sua senha protegida.</p></section>
    {params.success && <p className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand">{params.success}</p>}
    {params.error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{params.error}</p>}
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="panel overflow-hidden"><div className="panel-header"><div><h2 className="panel-title">Dados pessoais</h2><p className="panel-description">O e-mail identifica sua conta e somente o administrador pode alterá-lo.</p></div><UsersIcon className="size-5 text-brand" /></div><form action={updateOwnProfile} className="space-y-4 p-4 sm:p-5"><label className="field-label">Nome completo<input className="form-control" defaultValue={user.name} maxLength={120} minLength={3} name="fullName" required /></label><label className="field-label">E-mail<input className="form-control opacity-70" disabled readOnly value={user.email} /></label><label className="field-label">Perfil<input className="form-control opacity-70" disabled readOnly value={roleLabels[user.role]} /></label><div className="flex justify-end"><button className="button-primary" type="submit">Salvar meu perfil</button></div></form></article>
      <article className="panel overflow-hidden"><div className="panel-header"><div><h2 className="panel-title">Alterar senha</h2><p className="panel-description">Confirme sua senha atual antes de definir uma nova.</p></div><SettingsIcon className="size-5 text-brand" /></div><form action={changeOwnPassword} className="space-y-4 p-4 sm:p-5"><label className="field-label">Senha atual<input autoComplete="current-password" className="form-control" name="currentPassword" required type="password" /></label><label className="field-label">Nova senha<input autoComplete="new-password" className="form-control" minLength={10} name="newPassword" required type="password" /></label><label className="field-label">Confirmar nova senha<input autoComplete="new-password" className="form-control" minLength={10} name="confirmation" required type="password" /></label><p className="text-xs leading-5 text-muted">Use pelo menos 10 caracteres e evite senhas utilizadas em outros serviços.</p><div className="flex justify-end"><button className="button-primary" type="submit">Alterar senha</button></div></form></article>
    </section>
  </div>;
}

