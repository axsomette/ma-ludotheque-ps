// Copie la grande jaquette IGDB dans le stockage Supabase de l'utilisateur
// (covers/<user_id>/igdb-<image_id>.jpg) et renvoie son URL publique.
// Avoir sa propre copie évite les blocages CORS au moment de l'afficher en texture 3D.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";

const MAX_BYTES = 5 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "POST attendu" }, 405);

  try {
    // Client agissant au nom de l'utilisateur : les règles RLS du stockage s'appliquent.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json(req, { error: "Non connecté" }, 401);

    const { image_id } = await req.json();
    // Identifiant strict : on ne télécharge que depuis le CDN d'IGDB (pas de requête vers une URL arbitraire).
    if (typeof image_id !== "string" || !/^[a-z0-9]{4,40}$/.test(image_id)) {
      return json(req, { error: "image_id invalide" }, 400);
    }

    const img = await fetch(`https://images.igdb.com/igdb/image/upload/t_1080p/${image_id}.jpg`);
    if (!img.ok) return json(req, { error: `Jaquette introuvable (${img.status})` }, 404);
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return json(req, { error: "Image trop lourde" }, 413);

    const path = `${auth.user.id}/igdb-${image_id}.jpg`;
    const { error } = await supabase.storage.from("covers").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;

    const { data } = supabase.storage.from("covers").getPublicUrl(path);
    return json(req, { url: data.publicUrl });
  } catch (e) {
    console.error(e);
    return json(req, { error: (e as Error).message }, 500);
  }
});
