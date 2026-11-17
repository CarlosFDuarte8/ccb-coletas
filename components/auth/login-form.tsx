"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/login/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  return (
    <form action={action} className="mt-7 space-y-4">
      <label className="field-label">E-mail
        <input autoComplete="email" className="form-control" name="email" placeholder="seu@email.com" required type="email" />
      </label>
      <label className="field-label">Senha
        <input autoComplete="current-password" className="form-control" minLength={8} name="password" required type="password" />
      </label>
      {state?.error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300" role="alert">{state.error}</p>}
      <button className="button-primary w-full" disabled={pending} type="submit">{pending ? "Entrando..." : "Entrar no sistema"}</button>
    </form>
  );
}

