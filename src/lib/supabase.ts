import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Client Supabase, ou null quand l'appli n'est pas encore branchée :
 * elle tourne alors en mode démo (collection gardée dans le navigateur).
 * La clé « anon » est publique par conception : la sécurité repose sur les règles RLS.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;

export const isDemo = supabase === null;
