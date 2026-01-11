import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true, // ✅ Détecte automatiquement les tokens dans le hash OAuth
    autoRefreshToken: true, // ✅ Active le refresh automatique des tokens
    flowType: "pkce", // ✅ Utilise PKCE pour une sécurité optimale en OAuth
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 30,
    },
  },
});
