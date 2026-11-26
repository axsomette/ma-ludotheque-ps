import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { IconEye, IconEyeOff, IconMail } from "./icons";
import { Logo } from "./Logo";
import { Turnstile, TURNSTILE_SITE_KEY, type TurnstileHandle } from "./Turnstile";

const MIN_PASSWORD = 8;
const redirectTo = () => window.location.origin + import.meta.env.BASE_URL;

/** Messages d'erreur de Supabase Auth, traduits en consignes claires. */
export function authMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirme d'abord ton adresse : ouvre le lien reçu par e-mail.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cet e-mail : connecte-toi.";
  if (m.includes("password should be") || m.includes("weak password")) return `Mot de passe trop faible : au moins ${MIN_PASSWORD} caractères, mélange lettres et chiffres.`;
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Attends quelques minutes puis réessaie.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Les inscriptions sont fermées pour le moment.";
  if (m.includes("same password") || m.includes("different from the old")) return "Choisis un mot de passe différent de l'ancien.";
  if (m.includes("captcha")) return "La vérification anti-robots a échoué ou a expiré. Recommence-la puis réessaie.";
  return "Ça n'a pas marché. Vérifie ta connexion puis réessaie.";
}

type Mode = "signin" | "signup" | "forgot";

function PasswordField({ value, onChange, autoComplete, label }: { value: string; onChange: (v: string) => void; autoComplete: string; label: string }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="password">
        <input
          type={shown ? "text" : "password"}
          required
          minLength={autoComplete === "new-password" ? MIN_PASSWORD : undefined}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="icon-btn sm" onClick={() => setShown((s) => !s)} aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
          {shown ? <IconEyeOff /> : <IconEye />}
        </button>
      </span>
    </label>
  );
}

/** Connexion et inscription par e-mail et mot de passe, avec « mot de passe oublié ». */
export function Login({ recovery = false, onRecovered }: { recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Jeton Turnstile (vérification anti-robots) : à usage unique, renouvelé après chaque tentative.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const needsCaptcha = !recovery && !!TURNSTILE_SITE_KEY;

  function switchTo(m: Mode) {
    setMode(m);
    setError(null);
    setInfo(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if ((mode === "signup" || recovery) && password.length < MIN_PASSWORD) {
      setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
      return;
    }
    if (needsCaptcha && !captchaToken) {
      setError("Termine la vérification anti-robots juste au-dessus du bouton.");
      return;
    }
    const opts = captchaToken ? { captchaToken } : {};
    setBusy(true);
    try {
      const auth = supabase!.auth;
      if (recovery) {
        const { error } = await auth.updateUser({ password });
        if (error) throw error;
        onRecovered?.();
      } else if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password, options: opts });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: redirectTo(), ...opts } });
        if (error) throw error;
        // Adresse déjà inscrite : Supabase renvoie un utilisateur sans identité, sans le dire.
        if (data.user && data.user.identities?.length === 0) throw new Error("already registered");
        if (!data.session) setInfo(`Compte créé. Ouvre le lien envoyé à ${email} pour l'activer, puis connecte-toi.`);
      } else {
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo: redirectTo(), ...opts });
        if (error) throw error;
        setInfo(`Si un compte existe pour ${email}, un lien pour changer de mot de passe vient d'y être envoyé.`);
      }
    } catch (err) {
      setError(authMessage((err as Error).message ?? ""));
    } finally {
      setBusy(false);
      if (needsCaptcha) captcha.current?.reset(); // un jeton ne sert qu'une fois
    }
  }

  const title = recovery ? "Nouveau mot de passe" : mode === "signup" ? "Créer un compte" : mode === "forgot" ? "Mot de passe oublié" : "Se connecter";
  const cta = recovery ? "Enregistrer le mot de passe" : mode === "signup" ? "Créer mon compte" : mode === "forgot" ? "Recevoir le lien" : "Se connecter";

  return (
    <main className="login">
      <div className="login-card">
        <Logo size={72} />
        <h1 className="wordmark big">Ludothèque</h1>
        <p className="muted">Tes jeux PlayStation, Nintendo Switch et Xbox en boîtiers 3D, dans ta poche. Prends un boîtier, ouvre-le, sors le disque ou la cartouche.</p>

        {!recovery && mode !== "forgot" && (
          <div className="segmented" role="tablist" aria-label="Connexion ou inscription">
            <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "on" : ""} onClick={() => switchTo("signin")}>
              Connexion
            </button>
            <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "on" : ""} onClick={() => switchTo("signup")}>
              Inscription
            </button>
          </div>
        )}

        <form onSubmit={submit} className="email-row" aria-label={title}>
          {(recovery || mode === "forgot") && <h2 className="login-title">{title}</h2>}
          {!recovery && (
            <label className="field">
              <span className="field-label">Adresse e-mail</span>
              <input type="email" required autoComplete="email" placeholder="nom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          {mode !== "forgot" && (
            <PasswordField
              label={recovery ? "Nouveau mot de passe" : "Mot de passe"}
              autoComplete={mode === "signup" || recovery ? "new-password" : "current-password"}
              value={password}
              onChange={setPassword}
            />
          )}
          {(mode === "signup" || recovery) && <p className="muted small hint">Au moins {MIN_PASSWORD} caractères.</p>}
          {needsCaptcha && <Turnstile ref={captcha} onToken={setCaptchaToken} />}
          <button className="btn primary wide" disabled={busy} aria-busy={busy}>
            {mode === "forgot" && <IconMail />}
            {busy ? "Un instant…" : cta}
          </button>
        </form>

        {!recovery && mode === "signin" && (
          <button type="button" className="text-btn" onClick={() => switchTo("forgot")}>
            Mot de passe oublié ?
          </button>
        )}
        {!recovery && mode === "forgot" && (
          <button type="button" className="text-btn" onClick={() => switchTo("signin")}>
            Revenir à la connexion
          </button>
        )}

        {info && <p role="status">{info}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
