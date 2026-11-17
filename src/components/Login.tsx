import { useState } from "react";
import { supabase } from "../lib/supabase";

const redirectTo = () => window.location.origin + import.meta.env.BASE_URL;

/** Connexion : compte GitHub (recommandé) ou lien magique par e-mail. */
export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function github() {
    setError(null);
    const { error } = await supabase!.auth.signInWithOAuth({ provider: "github", options: { redirectTo: redirectTo() } });
    if (error) setError(error.message);
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="logo" aria-hidden>
          <span />
        </div>
        <h1>Ma ludothèque PS</h1>
        <p className="muted">Tes jeux PS3, PS4 et PS5 en boîtiers 3D, synchronisés sur tous tes écrans.</p>
        <button className="btn primary wide" onClick={github}>
          Se connecter avec GitHub
        </button>
        <div className="sep">
          <span>ou</span>
        </div>
        {sent ? (
          <p>Lien envoyé à {email}. Ouvre-le sur cet appareil.</p>
        ) : (
          <form onSubmit={magicLink} className="email-row">
            <input type="email" required placeholder="nom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Adresse e-mail" />
            <button className="btn">Recevoir un lien</button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
