"use client";
import { useRef, useState } from "react";
import { databaseErrorMessage } from "@/lib/storage/database-status";

export function useMutation() {
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (running.current) return false;
    running.current = true;
    setPending(true);
    setError("");
    try { await action(); return true; }
    catch (caught) { setError(databaseErrorMessage(caught)); return false; }
    finally { running.current = false; setPending(false); }
  }
  return { run, pending, error };
}
