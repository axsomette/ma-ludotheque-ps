import { useState } from "react";
import { supabase } from "../lib/supabase";
import { IconGithub, IconMail } from "./icons";
import { coverSrc } from "./Library";
import { Logo } from "./Logo";
import type { Platform } from "../lib/types";

// Boîtiers d'ambiance derrière la carte (jaquettes générées, aucun vrai jeu).
const DECOR: Array<{ title: string; platform: Platform }> = [
  { title: "Neon Drift", platform: "ps5" },
  { title: "Gridiron Legends", platform: "ps5" },
  { title: "Les Terres d'Aube", platform: "ps4" },
  { title: "Canyon Run", platform: "ps3" },
  { title: "Orbit Zero", platform: "ps4" },
];

const redirectTo = () => window.location.origin + import.meta.env.BASE_URL;

/** Connexion : compte GitHub (recommandé) ou lien de connexion par e-mail. */
export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function github() {
    setError(null);
    setBusy(true);
    const { error } = await supabase!.auth.signInWithOAuth({ provider: "github", options: { redirectTo: redirectTo() } });
    if (error) {
      setError("La connexion GitHub n'a pas démarré. Réessaie dans un instant.");
      setBusy(false);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setBusy(false);
    if (error) setError("Le lien n'a pas pu être envoyé. Vérifie l'adresse puis réessaie.");
    else setSent(true);
  }

  return (
    <main className="login">
      <div className="login-decor" aria-hidden>
        {DECOR.map((d) => (
          <img key={d.title} src={coverSrc({ ...d, cover_url: null })} alt="" />
        ))}
      </div>
      <div className="login-card">
        <Logo size={72} />
        <h1 className="wordmark big">Ludothèque</h1>
        <p className="muted">Tes jeux PS5, PS4 et PS3 en boîtiers 3D, dans ta poche. Prends un boîtier, ouvre-le, sors le disque.</p>
        <button className="btn primary wide" onClick={github} disabled={busy}>
          <IconGithub />
          Continuer avec GitHub
        </button>
        <div className="sep">
          <span>ou par e-mail</span>
        </div>
        {sent ? (
          <p role="status">Lien envoyé à {email}. Ouvre-le sur cet appareil pour entrer.</p>
        ) : (
          <form onSubmit={magicLink} className="email-row">
            <label className="field">
              <span className="field-label">Adresse e-mail</span>
              <input type="email" required autoComplete="email" placeholder="nom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn" disabled={busy}>
              <IconMail />
              Recevoir un lien
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
