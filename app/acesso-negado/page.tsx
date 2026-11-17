import Link from "next/link";
import { getLandingPath } from "@/config/permissions";
import { requireUser } from "@/lib/auth/current-user";
import { logout } from "@/app/login/actions";

export default async function AccessDeniedPage() {
  const user = await requireUser();
  const landingPath = getLandingPath(user.menus);
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <section className="panel max-w-md p-7 text-center">
        <p className="eyebrow">Acesso limitado</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Você não possui acesso a este menu
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Solicite ao Superadministrador a liberação necessária para o seu
          perfil.
        </p>
        {landingPath === "/acesso-negado" ? (
          <form action={logout}><button className="button-primary mt-6" type="submit">Sair do sistema</button></form>
        ) : (
          <Link className="button-primary mt-6" href={landingPath}>Ir para um menu permitido</Link>
        )}
      </section>
    </main>
  );
}
