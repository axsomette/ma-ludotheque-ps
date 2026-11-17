import type { Session } from "@supabase/supabase-js";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AddGame } from "./components/AddGame";
import { IconGrid, IconPlus, IconSearch, IconShelf } from "./components/icons";
import { Login } from "./components/Login";
import { DiscSpinner, Logo } from "./components/Logo";
import { EmptyShelf, Shelf, ShelfSkeleton, type ShelfView } from "./components/Shelf";
import { generatedCover } from "./lib/canvasArt";
import { PLATFORMS, PLATFORM_ORDER } from "./lib/platforms";
import { addGame, deleteGame, listGames } from "./lib/store";
import { isDemo, supabase } from "./lib/supabase";
import type { Game, NewGame, Platform } from "./lib/types";

// Three.js n'est chargé qu'à l'ouverture d'un boîtier.
const Viewer = lazy(() => import("./components/Viewer").then((m) => ({ default: m.Viewer })));

const DEMO_SEED: Array<Pick<NewGame, "title" | "platform" | "release_year" | "pegi" | "genres" | "publisher" | "summary">> = [
  { title: "Gridiron Legends", platform: "ps5", release_year: 2024, pegi: 3, genres: ["Sport"], publisher: "Studio Démo", summary: "Jeu de démonstration : un match de football américain sous les projecteurs." },
  { title: "Neon Drift", platform: "ps5", release_year: 2023, pegi: 7, genres: ["Course"], publisher: "Studio Démo", summary: "Jeu de démonstration : des courses de nuit dans une ville en néon." },
  { title: "Les Terres d'Aube", platform: "ps4", release_year: 2019, pegi: 16, genres: ["Aventure", "RPG"], publisher: "Studio Démo", summary: "Jeu de démonstration : un voyage au long cours vers l'aube." },
  { title: "Canyon Run", platform: "ps3", release_year: 2011, pegi: 12, genres: ["Action"], publisher: "Studio Démo", summary: "Jeu de démonstration : une course-poursuite dans les canyons." },
];

const VIEW_KEY = "ludotheque-vue";
function readView(): ShelfView {
  try {
    return localStorage.getItem(VIEW_KEY) === "covers" ? "covers" : "spines";
  } catch {
    return "spines";
  }
}

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
  const [view, setView] = useState<ShelfView>(readView);
  // Raccourci de l'icône d'appli (« Ranger un jeu ») : ?ajouter=1 ouvre directement l'ajout.
  const [adding, setAdding] = useState(() => new URLSearchParams(window.location.search).has("ajouter"));
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
          await addGame({ ...s, igdb_id: null, cover_url: generatedCover(s.title, s.platform), screenshots: [], back_url: null, disc_url: null });
        }
        list = await listGames();
      }
      setGames(list);
    } catch {
      setError("Ta collection n'a pas pu être chargée. Vérifie ta connexion.");
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

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return games.filter((g) => (filter === "all" || g.platform === filter) && (!needle || g.title.toLowerCase().includes(needle)));
  }, [games, filter, q]);

  function changeView(v: ShelfView) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // préférence non mémorisée : sans conséquence
    }
  }

  if (!authReady)
    return (
      <div className="splash" role="status" aria-label="Chargement">
        <DiscSpinner size={44} />
      </div>
    );
  if (!signedIn) return <Login />;

  return (
    <div className="app">
      <a className="skip" href="#collection">
        Aller à la collection
      </a>
      {isDemo && <div className="demo-banner">Démo : ta collection reste dans ce navigateur.</div>}

      <header className="topbar">
        <div className="brand">
          <Logo size={44} />
          <div>
            <h1 className="display">Ludothèque</h1>
            <p className="tally mono" aria-label="Nombre de jeux par plateforme">
              {games.length} {games.length > 1 ? "jeux" : "jeu"}
              {PLATFORM_ORDER.map((p) => (
                <span key={p}>
                  {" "}
                  · {PLATFORMS[p].label} {counts[p]}
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn primary" onClick={() => setAdding(true)}>
            <IconPlus />
            Ranger un jeu
          </button>
          {session && (
            <button className="btn ghost" onClick={() => supabase!.auth.signOut()} title={session.user.email ?? ""}>
              Déconnexion
            </button>
          )}
        </div>
      </header>

      <nav className="toolbar" aria-label="Filtres">
        <div className="segmented" role="tablist" aria-label="Plateforme">
          {(["all", ...PLATFORM_ORDER] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "Tous" : PLATFORMS[f].label}
              <span className="count mono">{f === "all" ? games.length : counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-end">
          <label className="search">
            <IconSearch />
            <span className="sr-only">Chercher dans ma collection</span>
            <input placeholder="Chercher un titre" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
          </label>
          <div className="segmented icons" role="radiogroup" aria-label="Présentation">
            <button role="radio" aria-checked={view === "spines"} className={view === "spines" ? "on" : ""} onClick={() => changeView("spines")} title="Étagère : les tranches">
              <IconShelf />
              <span className="sr-only">Étagère</span>
            </button>
            <button role="radio" aria-checked={view === "covers"} className={view === "covers" ? "on" : ""} onClick={() => changeView("covers")} title="Vitrine : les jaquettes">
              <IconGrid />
              <span className="sr-only">Vitrine</span>
            </button>
          </div>
        </div>
      </nav>

      <main id="collection" tabIndex={-1}>
        {error ? (
          <div className="state-error" role="alert">
            <p>{error}</p>
            <button className="btn" onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <ShelfSkeleton />
        ) : games.length === 0 ? (
          <EmptyShelf onAdd={() => setAdding(true)} />
        ) : shown.length === 0 ? (
          <p className="no-match">Aucun jeu ne correspond à « {q || PLATFORMS[filter as Platform]?.label} ».</p>
        ) : (
          <Shelf games={shown} view={view} onOpen={setViewing} />
        )}
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
        <Suspense
          fallback={
            <div className="viewer viewer-loading" role="status">
              <DiscSpinner size={44} />
              <span>Ouverture du boîtier…</span>
            </div>
          }
        >
          <Viewer
            game={viewing}
            onClose={() => setViewing(null)}
            onUpdate={(g) => {
              setGames((list) => list.map((x) => (x.id === g.id ? g : x)));
              setViewing(g);
            }}
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
