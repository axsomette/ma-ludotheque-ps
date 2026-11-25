import { ps5Info } from "../lib/ps5Compat";
import type { Game } from "../lib/types";

/** Ce que donne un jeu PS3 ou PS4 sur PS5 (mise à niveau gratuite, payante, rétrocompatibilité). */
export function Ps5Panel({ game }: { game: Pick<Game, "title" | "platform"> }) {
  const info = ps5Info(game);
  if (!info) return null;
  return (
    <section className={`photos ps5 tone-${info.tone}`} aria-labelledby="ps5-title">
      <h3 id="ps5-title">Sur PS5</h3>
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
