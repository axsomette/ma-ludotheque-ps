import { useMemo } from "react";
import { generatedCover } from "../lib/canvasArt";
import { PLATFORMS } from "../lib/platforms";
import type { Game } from "../lib/types";

interface Props {
  games: Game[];
  onOpen: (g: Game) => void;
}

/** Étagère : boîtiers en CSS 3D (léger, même avec des centaines de jeux). */
export function Shelf({ games, onOpen }: Props) {
  if (games.length === 0) {
    return (
      <div className="empty">
        <h2>Ta ludothèque est vide</h2>
        <p>Prends en photo la jaquette d'un jeu : je retrouve la jaquette officielle et je range le boîtier ici.</p>
      </div>
    );
  }
  return (
    <ul className="shelf">
      {games.map((g, i) => (
        <li key={g.id} style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}>
          <CaseCard game={g} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

function CaseCard({ game, onOpen }: { game: Game; onOpen: (g: Game) => void }) {
  const p = PLATFORMS[game.platform];
  const src = useMemo(() => game.cover_url ?? generatedCover(game.title, game.platform), [game]);
  return (
    <button className="case" onClick={() => onOpen(game)} aria-label={`${game.title} (${p.label})`} style={{ ["--case" as string]: p.caseColor }}>
      <span className="case-3d">
        <span className="case-front">
          <img src={src} alt="" loading="lazy" crossOrigin="anonymous" />
        </span>
        <span className="case-spine" style={{ ["--band" as string]: p.bandColor, ["--band-text" as string]: p.bandText }}>
          <b>{p.label}</b>
          <i>{game.title}</i>
        </span>
      </span>
      <span className="case-title">{game.title}</span>
    </button>
  );
}
