import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Cloudflare Turnstile : vérification anti-robots exigée par Supabase Auth (CAPTCHA activé côté projet).
// La clé du site est publique (VITE_TURNSTILE_SITE_KEY) ; la clé secrète vit seulement dans Supabase.
// Sans clé du site, rien n'est affiché et aucun jeton n'est envoyé.
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile indisponible")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile indisponible"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface TurnstileHandle {
  /** Un jeton ne sert qu'une fois : à appeler après chaque tentative. */
  reset: () => void;
}

/** Widget Turnstile ; `onToken(null)` quand le jeton expire ou en cas d'erreur. */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string | null) => void }>(function Turnstile({ onToken }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset: () => {
      cb.current(null);
      if (id.current && window.turnstile) window.turnstile.reset(id.current);
    },
  }));

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let alive = true;
    loadTurnstile()
      .then((t) => {
        if (!alive || !box.current) return;
        id.current = t.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          language: "fr",
          callback: (token: string) => cb.current(token),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      alive = false;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="turnstile" />;
});
