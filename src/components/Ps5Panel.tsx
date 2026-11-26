import { ps5Info } from "../lib/ps5Compat";
import type { Game } from "../lib/types";

/** Ce que donne un jeu sur la console suivante (PS5, Switch 2, Xbox Series) : mise à niveau, rétrocompatibilité. */
export function Ps5Panel({ game }: { game: Pick<Game, "title" | "platform"> }) {
  const info = ps5Info(game);
  if (!info) return null;
  return (
    <section className={`photos ps5 tone-${info.tone}`} aria-labelledby="ps5-title">
      <h3 id="ps5-title">{info.section}</h3>
      <p className="ps5-headline">{info.headline}</p>
      <ul className="ps5-details">
        {info.details.map((d) => (
          <li key={d} className="small">
            {d}
          </li>
        ))}
      </ul>
    </section>
  );
}
