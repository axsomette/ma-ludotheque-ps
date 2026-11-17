import { useEffect, useMemo, useState } from "react";
import { mix, readableOn } from "../lib/artUtils";
import { dominantColor, generatedCover } from "../lib/canvasArt";
import { PLATFORMS } from "../lib/platforms";
import type { Game } from "../lib/types";

export type ShelfView = "spines" | "covers";

interface Props {
  games: Game[];
  view: ShelfView;
  onOpen: (g: Game) => void;
}

/** Couleur de tranche de chaque jeu, tirée de sa jaquette (calculée une fois, en tâche de fond). */
function useSpineColors(games: Game[]) {
  const [colors, setColors] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    for (const g of games) {
      if (colors[g.id]) continue;
      dominantColor(g.cover_url ?? generatedCover(g.title, g.platform)).then((c) => {
        if (alive) setColors((prev) => (prev[g.id] ? prev : { ...prev, [g.id]: c }));
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);
  return colors;
}

export function Shelf({ games, view, onOpen }: Props) {
  const colors = useSpineColors(games);
  if (view === "covers") {
    return (
      <ul className="vitrine">
        {games.map((g, i) => (
          <li key={g.id} style={{ animationDelay: `${Math.min(i, 24) * 30}ms` }}>
            <CoverCard game={g} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="shelf" aria-label="Étagère">
      {games.map((g, i) => (
        <li key={g.id} style={{ animationDelay: `${Math.min(i, 40) * 18}ms` }}>
          <Spine game={g} color={colors[g.id]} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

function Spine({ game, color, onOpen }: { game: Game; color?: string; onOpen: (g: Game) => void }) {
  const p = PLATFORMS[game.platform];
  const base = color ?? "#2a3452";
  const src = useMemo(() => game.cover_url ?? generatedCover(game.title, game.platform), [game]);
  return (
    <button
      className="spine"
      onClick={() => onOpen(game)}
      aria-label={`${game.title}, ${p.label}${game.release_year ? `, ${game.release_year}` : ""}`}
      style={{
        ["--spine" as string]: base,
        ["--spine-dark" as string]: mix(base, "#000000", 0.35),
        ["--spine-ink" as string]: readableOn(base),
        ["--band" as string]: p.bandColor,
        ["--band-ink" as string]: p.bandText,
      }}
    >
      <span className="spine-band">{p.label}</span>
      {/* Comme sur une vraie tranche : plus le titre est long, plus le lettrage est serré. */}
      <span className="spine-title" style={{ ["--fit" as string]: spineFit(game.title.length) }}>
        {game.title}
      </span>
      <span className="spine-peek" aria-hidden>
        <img src={src} alt="" loading="lazy" crossOrigin="anonymous" />
      </span>
    </button>
  );
}

/** Échelle du lettrage de tranche selon la longueur du titre (1 = taille normale). */
export function spineFit(length: number): number {
  if (length <= 12) return 1;
  if (length <= 18) return 0.86;
  if (length <= 26) return 0.74;
  return 0.64;
}

function CoverCard({ game, onOpen }: { game: Game; onOpen: (g: Game) => void }) {
  const p = PLATFORMS[game.platform];
  const src = useMemo(() => game.cover_url ?? generatedCover(game.title, game.platform), [game]);
  return (
    <button className="cover-card" onClick={() => onOpen(game)} aria-label={`${game.title}, ${p.label}`} style={{ ["--case" as string]: p.caseColor }}>
      <span className="cover-frame">
        <img src={src} alt="" loading="lazy" crossOrigin="anonymous" />
      </span>
      <span className="cover-title">{game.title}</span>
      <span className="cover-meta mono">
        {p.label}
        {game.release_year ? ` · ${game.release_year}` : ""}
      </span>
    </button>
  );
}

/** Étagère vide : des planches nues et une invitation à ranger le premier jeu. */
export function EmptyShelf({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty">
      <div className="empty-planks" aria-hidden>
        <span />
        <span />
      </div>
      <h2>Ton étagère t'attend</h2>
      <p>Prends en photo la jaquette d'un jeu PS5, PS4 ou PS3 : la jaquette officielle est retrouvée et le boîtier vient se ranger ici.</p>
      <button className="btn primary" onClick={onAdd}>
        Ranger mon premier jeu
      </button>
    </div>
  );
}

/** Squelette de chargement : des tranches neutres qui scintillent. */
export function ShelfSkeleton() {
  return (
    <ul className="shelf skeleton" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <li key={i}>
          <span className="spine ghost" style={{ height: `${86 + ((i * 7) % 14)}%` }} />
        </li>
      ))}
    </ul>
  );
}
