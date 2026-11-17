import type { Session } from "@supabase/supabase-js";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AddGame } from "./components/AddGame";
import { Login } from "./components/Login";
import { Shelf } from "./components/Shelf";
import { generatedCover } from "./lib/canvasArt";
import { PLATFORMS, PLATFORM_ORDER } from "./lib/platforms";
import { addGame, deleteGame, listGames } from "./lib/store";
import { isDemo, supabase } from "./lib/supabase";
import type { Game, NewGame, Platform } from "./lib/types";

// Three.js n'est chargé qu'à l'ouverture d'un boîtier.
const Viewer = lazy(() => import("./components/Viewer").then((m) => ({ default: m.Viewer })));

const DEMO_SEED: Array<Pick<NewGame, "title" | "platform">> = [
  { title: "Gridiron Legends", platform: "ps5" },
  { title: "Neon Drift", platform: "ps5" },
  { title: "Les Terres d'Aube", platform: "ps4" },
  { title: "Canyon Run", platform: "ps3" },
];

let seededInMemory = false;
function demoSeeded(): boolean {
  try {
    return seededInMemory || localStorage.getItem("ludotheque-demo-seeded") === "1";
  } catch {
    return seededInMemory;
  }
}
function markDemoSeeded() {
  seededInMemory = true;
  try {
    localStorage.setItem("ludotheque-demo-seeded", "1");
  } catch {
    // navigation privée : le marqueur en mémoire suffit
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(isDemo);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Platform | "all">("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Game | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const signedIn = isDemo || !!session;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let list = await listGames();
      if (isDemo && list.length === 0 && !demoSeeded()) {
        // Marqueur posé AVANT l'insertion : le double appel de React (StrictMode) ne duplique pas la démo.
        markDemoSeeded();
        for (const s of DEMO_SEED.slice().reverse()) {
          await addGame({ ...s, igdb_id: null, cover_url: generatedCover(s.title, s.platform), release_year: null });
        }
        list = await listGames();
      }
      setGames(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn) void refresh();
  }, [signedIn, refresh]);

  const counts = useMemo(() => {
    const c: Record<Platform, number> = { ps3: 0, ps4: 0, ps5: 0 };
    games.forEach((g) => c[g.platform]++);
    return c;
  }, [games]);

  const shown = useMemo(
    () =>
      games.filter(
        (g) => (filter === "all" || g.platform === filter) && (!q.trim() || g.title.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [games, filter, q],
  );

  if (!authReady) return <div className="splash" aria-busy="true" />;
  if (!signedIn) return <Login />;

  return (
    <div className="app">
      {isDemo && (
        <div className="demo-banner">
          Mode démo : la collection reste dans ce navigateur. Branche Supabase (voir le README) pour la synchroniser.
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <div className="logo small" aria-hidden>
            <span />
          </div>
          <div>
            <h1>Ma ludothèque</h1>
            <p className="muted">
              {games.length} jeu{games.length > 1 ? "x" : ""} · {PLATFORM_ORDER.map((p) => `${counts[p]} ${PLATFORMS[p].label}`).join(" · ")}
            </p>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn primary" onClick={() => setAdding(true)}>
            + Ajouter un jeu
          </button>
          {session && (
            <button className="btn ghost" onClick={() => supabase!.auth.signOut()} title={session.user.email ?? ""}>
              Déconnexion
            </button>
          )}
        </div>
      </header>

      <nav className="toolbar">
        <div className="chips" role="tablist" aria-label="Filtrer par plateforme">
          {(["all", ...PLATFORM_ORDER] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "Tous" : PLATFORMS[f].label}
              <span className="count">{f === "all" ? games.length : counts[f]}</span>
            </button>
          ))}
        </div>
        <input className="search" placeholder="Rechercher dans ma collection" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
      </nav>

      <main>
        {error && <p className="error">{error}</p>}
        {loading ? <div className="loading">Chargement de la collection…</div> : <Shelf games={shown} onOpen={setViewing} />}
      </main>

      {adding && (
        <AddGame
          onClose={() => setAdding(false)}
          onAdd={async (g) => {
            const created = await addGame(g);
            setGames((list) => [created, ...list]);
            setViewing(created);
          }}
        />
      )}

      {viewing && (
        <Suspense fallback={<div className="viewer loading">Ouverture du boîtier…</div>}>
          <Viewer
            game={viewing}
            onClose={() => setViewing(null)}
            onDelete={async (g) => {
              await deleteGame(g.id);
              setGames((list) => list.filter((x) => x.id !== g.id));
              setViewing(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
