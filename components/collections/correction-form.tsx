"use client";
import { useState, type FormEvent } from "react";
import { useMutation } from "@/hooks/use-mutation";

export function CorrectionForm({ description, buttonLabel, action, onSuccess }: { description: string; buttonLabel: string; action: (reason: string) => Promise<unknown>; onSuccess: () => void }) {
  const [reason, setReason] = useState("");
  const { run, pending, error } = useMutation();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => { await action(reason.trim()); onSuccess(); });
  }
  return <form className="space-y-4 p-5" onSubmit={submit}><p className="text-sm text-muted">{description}</p><label className="field-label">Motivo<textarea className="form-control min-h-24" disabled={pending} minLength={8} onChange={(event) => setReason(event.target.value)} required value={reason} /></label>{error && <p className="text-sm text-red-600" role="alert">{error}</p>}<button className="button-primary" disabled={pending} type="submit">{pending ? "Salvando…" : buttonLabel}</button></form>;
}
