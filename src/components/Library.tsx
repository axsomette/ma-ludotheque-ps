import { useEffect, useRef, useState } from "react";
import { metaLine } from "../lib/artUtils";
import { dominantColor, generatedCover } from "../lib/canvasArt";
import { PLATFORMS } from "../lib/platforms";
import type { Game } from "../lib/types";
import type { CaseMode } from "./GameCase3D";
import { IconChevron, IconDisc, IconPlus } from "./icons";
import { isLoaned, loanLine } from "../lib/loans";

export type OpenGame = (g: Game, mode?: CaseMode) => void;

// Les jaquettes générées (mode démo, jeux sans image) coûtent un rendu canvas : une seule fois par jeu.
const generated = new Map<string, string>();
export function coverSrc(g: Pick<Game, "cover_url" | "title" | "platform">): string {
  if (g.cover_url) return g.cover_url;
  const key = `${g.platform}:${g.title}`;
  let src = generated.get(key);
  if (!src) {
    src = generatedCover(g.title, g.platform);
    generated.set(key, src);
  }
  return src;
}

/** Couleur dominante de la jaquette : c'est elle qui teinte toute l'interface autour du jeu sélectionné. */
export function useTint(game: Game | null, fallback = "#3a4f8f"): string {
  const [tint, setTint] = useState(fallback);
  useEffect(() => {
    if (!game) return;
    let alive = true;
    dominantColor(coverSrc(game)).then((c) => alive && setTint(c));
    return () => {
      alive = false;
    };
  }, [game]);
  return tint;
}

/** Fond d'ambiance : la jaquette du jeu sélectionné, très floue, comme sur l'accueil d'une console. */
export function Backdrop({ game }: { game: Game | null }) {
  return (
    <div className="backdrop" aria-hidden>
      {game && <img key={game.id} src={coverSrc(game)} alt="" crossOrigin="anonymous" />}
    </div>
  );
}

/** Le jeu sélectionné, en grand : boîtier en relief, titre, données, et les deux gestes principaux. */
export function Hero({ game, onOpen }: { game: Game; onOpen: OpenGame }) {
  const p = PLATFORMS[game.platform];
  return (
    <section className="hero" aria-labelledby="hero-title">
      <button className="hero-case" onClick={() => onOpen(game, "front")} aria-label={`Prendre en main ${game.title}`} key={game.id}>
        <span className="hc-box" style={{ ["--case" as string]: p.caseColor }}>
          <span className="hc-front">
            <img src={coverSrc(game)} alt="" crossOrigin="anonymous" />
          </span>
          <span className="hc-side" />
        </span>
      </button>
      <div className="hero-info" key={`i-${game.id}`}>
        <span className="tag" style={{ background: p.bandColor, color: p.bandText }}>
          {p.label}
        </span>
        <h2 id="hero-title" className="hero-title">
          {game.title}
        </h2>
        <p className="hero-meta mono">{metaLine([game.release_year, game.pegi ? `PEGI ${game.pegi}` : null, game.publisher])}</p>
        {isLoaned(game) && <p className="hero-loan">{loanLine(game)}</p>}
        {game.genres.length > 0 && <p className="hero-genres">{game.genres.join(" · ")}</p>}
        {game.summary && (
          <p className="hero-summary" lang="en">
            {game.summary}
          </p>
        )}
        <div className="hero-actions">
          <button className="btn primary" onClick={() => onOpen(game, "open")}>
            Ouvrir le boîtier
          </button>
          <button className="btn" onClick={() => onOpen(game, "disc")}>
            <IconDisc />
            {PLATFORMS[game.platform].media === "cart" ? "Sortir la cartouche" : "Sortir le disque"}
          </button>
        </div>
      </div>
    </section>
  );
}

interface TileProps {
  game: Game;
  onOpen: OpenGame;
  onSelect: (g: Game) => void;
  selected: boolean;
}

/** Un boîtier dans une rangée. Survol ou focus = sélection (le fond change) ; clic = on le prend en main. */
export function CaseTile({ game, onOpen, onSelect, selected }: TileProps) {
  const p = PLATFORMS[game.platform];
  const loaned = isLoaned(game);
  return (
    <button
      className={`tile ${selected ? "is-selected" : ""} ${loaned ? "is-loaned" : ""}`}
      onClick={() => onOpen(game)}
      onFocus={() => onSelect(game)}
      onPointerEnter={(e) => e.pointerType === "mouse" && onSelect(game)}
      aria-label={`${game.title}, ${p.label}${game.release_year ? `, ${game.release_year}` : ""}${loaned ? `, prêté à ${game.loaned_to}` : ""}`}
      style={{ ["--case" as string]: p.caseColor }}
    >
      <span className="tile-case">
        <img src={coverSrc(game)} alt="" loading="lazy" crossOrigin="anonymous" />
        {loaned && <span className="tile-loan">Chez {game.loaned_to}</span>}
      </span>
      <span className="tile-title">{game.title}</span>
      <span className="tile-meta mono">
        {p.label}
        {game.release_year ? ` · ${game.release_year}` : ""}
      </span>
    </button>
  );
}

interface RailProps {
  id: string;
  title: string;
  games: Game[];
  onOpen: OpenGame;
  onSelect: (g: Game) => void;
  selectedId: string | null;
}

/** Rangée horizontale, avec défilement par flèches à la souris (au doigt, on glisse). */
export function Rail({ id, title, games, onOpen, onSelect, selectedId }: RailProps) {
  const list = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  function measure() {
    const el = list.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  }
  useEffect(measure, [games.length]);

  const scroll = (dir: 1 | -1) => list.current?.scrollBy({ left: dir * list.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="rail" aria-labelledby={id}>
      <header className="rail-head">
        <h2 id={id}>
          {title} <span className="mono rail-count">{games.length}</span>
        </h2>
        <div className="rail-arrows">
          <button className="icon-btn sm" onClick={() => scroll(-1)} disabled={edge.start} aria-label={`${title} : jeux précédents`}>
            <IconChevron style={{ transform: "scaleX(-1)" }} />
          </button>
          <button className="icon-btn sm" onClick={() => scroll(1)} disabled={edge.end} aria-label={`${title} : jeux suivants`}>
            <IconChevron />
          </button>
        </div>
      </header>
      <ul ref={list} className="rail-list" onScroll={measure}>
        {games.map((g) => (
          <li key={g.id}>
            <CaseTile game={g} onOpen={onOpen} onSelect={onSelect} selected={g.id === selectedId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Grille : une plateforme filtrée ou une recherche. */
export function CaseGrid({ games, onOpen, onSelect, selectedId }: Omit<RailProps, "id" | "title">) {
  return (
    <ul className="grid">
      {games.map((g, i) => (
        <li key={g.id} style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
          <CaseTile game={g} onOpen={onOpen} onSelect={onSelect} selected={g.id === selectedId} />
        </li>
      ))}
    </ul>
  );
}

/** Collection vide : un emplacement de boîtier vide, et l'action pour le remplir. */
export function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="empty">
      <button className="empty-slot" onClick={onAdd} aria-label="Ranger mon premier jeu">
        <IconPlus width={36} height={36} />
      </button>
      <h2>Aucun jeu pour l'instant</h2>
      <p>Photographie la jaquette d'un jeu PlayStation, Switch ou Xbox : la jaquette officielle est retrouvée et le boîtier arrive ici, prêt à être ouvert.</p>
      <button className="btn primary" onClick={onAdd}>
        Ranger mon premier jeu
      </button>
    </section>
  );
}

/** Chargement : la silhouette de l'accueil, sans contenu. */
export function LibrarySkeleton() {
  return (
    <div className="skeleton" aria-hidden>
      <div className="sk-hero">
        <span className="sk sk-case" />
        <div className="sk-lines">
          <span className="sk" style={{ width: 52 }} />
          <span className="sk" style={{ width: "70%", height: 40 }} />
          <span className="sk" style={{ width: "40%" }} />
          <span className="sk" style={{ width: "85%" }} />
        </div>
      </div>
      <div className="rail-list">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="sk sk-tile" />
        ))}
      </div>
    </div>
  );
}
