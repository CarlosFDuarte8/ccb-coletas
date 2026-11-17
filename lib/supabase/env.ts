export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_CCBCOLETASSUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_CCBCOLETASSUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_CCBCOLETASSUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error("As variáveis públicas do Supabase não foram configuradas.");
  }
  return { url, publishableKey };
}

