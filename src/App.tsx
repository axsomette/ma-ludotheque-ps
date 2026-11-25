import type { Session } from "@supabase/supabase-js";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AddGame } from "./components/AddGame";
import type { CaseMode } from "./components/GameCase3D";
import { IconLogout, IconPlus, IconSearch } from "./components/icons";
import { Backdrop, CaseGrid, EmptyLibrary, Hero, LibrarySkeleton, Rail, useTint } from "./components/Library";
import { Login } from "./components/Login";
import { ScanAll } from "./components/ScanAll";
import { DiscSpinner, Logo } from "./components/Logo";
import { generatedCover } from "./lib/canvasArt";
import { mix } from "./lib/artUtils";
import { PLATFORMS, PLATFORM_ORDER } from "./lib/platforms";
import { fetchScans } from "./lib/covers";
import { activeLoans } from "./lib/loans";
import { addGame, deleteGame, listGames, updateGame } from "./lib/store";
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
  const [filter, setFilter] = useState<Platform | "all" | "loaned">("all");
  const [q, setQ] = useState("");
  // Raccourci de l'icône d'appli (« Ranger un jeu ») : ?ajouter=1 ouvre directement l'ajout.
  const [adding, setAdding] = useState(() => new URLSearchParams(window.location.search).has("ajouter"));
  const [viewing, setViewing] = useState<{ game: Game; mode: CaseMode } | null>(null);
  // Jeu mis en avant sur l'accueil : celui qu'on survole, qu'on parcourt au clavier ou qu'on a ouvert en dernier.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // retour depuis le lien « mot de passe oublié » : on demande le nouveau mot de passe
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
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

  const loans = useMemo(() => activeLoans(games), [games]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = filter === "loaned" ? loans : games.filter((g) => filter === "all" || g.platform === filter);
    return base.filter((g) => !needle || g.title.toLowerCase().includes(needle));
  }, [games, loans, filter, q]);

  const selected = useMemo(() => games.find((g) => g.id === selectedId) ?? games[0] ?? null, [games, selectedId]);
  const tint = useTint(selected);
  const browsing = filter !== "all" || q.trim() !== "";

  function open(game: Game, mode: CaseMode = "front") {
    setSelectedId(game.id);
    setViewing({ game, mode });
  }
  const select = (g: Game) => setSelectedId(g.id);

  if (!authReady)
    return (
      <div className="splash" role="status" aria-label="Chargement">
        <DiscSpinner size={44} />
      </div>
    );
  if (recovery) return <Login recovery onRecovered={() => setRecovery(false)} />;
  if (!signedIn) return <Login />;

  return (
    <div className="app" style={{ ["--tint" as string]: tint, ["--tint-soft" as string]: mix(tint, "#07090f", 0.55), ["--tint-hi" as string]: mix(tint, "#ffffff", 0.45) }}>
      <Backdrop game={loading ? null : selected} />
      <a className="skip" href="#collection">
        Aller à la collection
      </a>
      {isDemo && <p className="demo-banner">Démo : ta collection reste dans ce navigateur.</p>}

      <header className="topbar">
        <div className="brand">
          <Logo size={34} />
          <h1 className="wordmark">Ludothèque</h1>
        </div>
        <label className="search">
          <IconSearch />
          <span className="sr-only">Chercher dans ma collection</span>
          <input placeholder="Chercher un jeu" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
        <div className="top-actions">
          <button className="btn primary add-top" onClick={() => setAdding(true)}>
            <IconPlus />
            Ranger un jeu
          </button>
          {session && (
            <button className="icon-btn" onClick={() => supabase!.auth.signOut()} aria-label="Se déconnecter" title={session.user.email ?? "Se déconnecter"}>
              <IconLogout />
            </button>
          )}
        </div>
      </header>

      <main id="collection" tabIndex={-1}>
        {error ? (
          <div className="state-msg" role="alert">
            <p>{error}</p>
            <button className="btn" onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <LibrarySkeleton />
        ) : games.length === 0 ? (
          <EmptyLibrary onAdd={() => setAdding(true)} />
        ) : (
          <>
            {!browsing && selected && <Hero game={selected} onOpen={open} />}

            <nav className="filters" aria-label="Plateforme">
              {(["all", ...PLATFORM_ORDER] as const).map((f) => (
                <button key={f} aria-pressed={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                  {f === "all" ? "Tout" : PLATFORMS[f].label}
                  <span className="mono">{f === "all" ? games.length : counts[f]}</span>
                </button>
              ))}
              {(loans.length > 0 || filter === "loaned") && (
                <button aria-pressed={filter === "loaned"} className={filter === "loaned" ? "on" : ""} onClick={() => setFilter("loaned")}>
                  Prêtés
                  <span className="mono">{loans.length}</span>
                </button>
              )}
            </nav>

            {!browsing && !isDemo && (
              <ScanAll
                games={games}
                onUpdated={(updated) => {
                  setGames((list) => list.map((x) => (x.id === updated.id ? updated : x)));
                  setViewing((v) => (v && v.game.id === updated.id ? { ...v, game: updated } : v));
                }}
              />
            )}

            {browsing ? (
              shown.length === 0 ? (
                <div className="state-msg">
                  <p>
                    {filter === "loaned"
                      ? q.trim()
                        ? `Aucun jeu prêté ne contient « ${q.trim()} ».`
                        : "Aucun jeu prêté : toute ta collection est à la maison."
                      : q.trim()
                        ? `Aucun jeu ne contient « ${q.trim()} »${filter !== "all" ? ` sur ${PLATFORMS[filter].label}` : ""}.`
                        : `Aucun jeu ${PLATFORMS[filter as Platform].label} pour l'instant.`}
                  </p>
                  <button
                    className="btn"
                    onClick={() => {
                      setQ("");
                      setFilter("all");
                    }}
                  >
                    Tout afficher
                  </button>
                </div>
              ) : (
                <CaseGrid games={shown} onOpen={open} onSelect={select} selectedId={selected?.id ?? null} />
              )
            ) : (
              <>
                <Rail id="rail-recent" title="Derniers rangés" games={games.slice(0, 12)} onOpen={open} onSelect={select} selectedId={selected?.id ?? null} />
                {PLATFORM_ORDER.filter((p) => counts[p] > 0).map((p) => (
                  <Rail
                    key={p}
                    id={`rail-${p}`}
                    title={PLATFORMS[p].label}
                    games={games.filter((g) => g.platform === p)}
                    onOpen={open}
                    onSelect={select}
                    selectedId={selected?.id ?? null}
                  />
                ))}
              </>
            )}
          </>
        )}
      </main>

      <button className="fab" onClick={() => setAdding(true)} aria-label="Ranger un jeu">
        <IconPlus width={26} height={26} />
      </button>

      {adding && (
        <AddGame
          onClose={() => setAdding(false)}
          existing={games}
          onOpenExisting={open}
          onAdd={async (g) => {
            const created = await addGame(g);
            setGames((list) => [created, ...list]);
            open(created);
            // Vrais scans du dos et du disque (LaunchBox) en tâche de fond : un échec ne gêne pas l'ajout.
            if (!isDemo)
              fetchScans(created)
                .then((patch) => (Object.keys(patch).length ? updateGame(created.id, patch) : null))
                .then((updated) => {
                  if (!updated) return;
                  setGames((list) => list.map((x) => (x.id === updated.id ? updated : x)));
                  setViewing((v) => (v && v.game.id === updated.id ? { ...v, game: updated } : v));
                })
                .catch(() => undefined);
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
            key={viewing.game.id}
            game={viewing.game}
            initialMode={viewing.mode}
            onClose={() => setViewing(null)}
            onUpdate={(g) => {
              setGames((list) => list.map((x) => (x.id === g.id ? g : x)));
              setViewing((v) => (v ? { ...v, game: g } : v));
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
