import { useState } from "react";
import { supabase } from "../lib/supabase";
import { IconGithub, IconMail } from "./icons";
import { Logo } from "./Logo";

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
      <div className="login-shelf" aria-hidden>
        <span />
      </div>
      <div className="login-card">
        <Logo size={88} />
        <h1 className="display">Ludothèque</h1>
        <p className="muted">Tes jeux PS5, PS4 et PS3, rangés sur une étagère que tu emportes partout. Prends un boîtier, ouvre-le, sors le disque.</p>
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
