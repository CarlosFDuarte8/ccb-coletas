import { PackageIcon } from "@/components/icons";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <section className="panel w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="logo-mark">
            <PackageIcon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">CCB Coletas</p>
            <p className="text-xs text-muted">Gestão de operações</p>
          </div>
        </div>
        <div className="mt-8">
          <p className="eyebrow">Acesso seguro</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Entre na sua conta
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use o acesso criado pelo Superadministrador para consultar as
            igrejas autorizadas.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
