import { generatedCover } from "../lib/canvasArt";
import { euros } from "../lib/market";
import { PLATFORMS } from "../lib/platforms";
import type { WishItem, WishPrice } from "../lib/wishlist";

interface Props {
  items: WishItem[];
  prices: Map<string, WishPrice>;
  onOpen: (w: WishItem) => void;
}

const ALERT = { target: "Prix atteint", drop: "En baisse" } as const;

/** Étagère des envies : jaquette, meilleur prix repéré, prix max et alerte. */
export function WishlistGrid({ items, prices, onOpen }: Props) {
  if (!items.length) {
    return (
      <div className="state-msg">
        <p>Ta liste d'envies est vide. Cherche un jeu dans la barre de recherche, ouvre sa fiche d'achat et appuie sur « Ajouter à mes envies » : tu seras prévenu quand son prix baisse.</p>
      </div>
    );
  }
  return (
    <ul className="wish-grid">
      {items.map((w) => {
        const p = prices.get(w.id);
        const best = p?.best ?? null;
        const cover = w.thumb_url || w.candidate?.thumb_url || generatedCover(w.title, w.platform);
        return (
          <li key={w.id} className={p?.alert ? "has-alert" : undefined}>
            <button onClick={() => onOpen(w)} aria-label={`${w.title}, ${PLATFORMS[w.platform].label}${best ? `, dès ${euros(best.price, 2)}` : ""}${p?.alert ? `, ${ALERT[p.alert]}` : ""}`}>
              <span className="r-cover">
                <img src={cover} alt="" loading="lazy" />
                {p?.alert && <span className={`wish-badge ${p.alert}`}>{ALERT[p.alert]}</span>}
              </span>
              <span className="r-name">{w.title}</span>
              <span className="r-meta mono">{PLATFORMS[w.platform].label}{w.max_price != null ? ` · max ${euros(w.max_price, w.max_price % 1 ? 2 : 0)}` : ""}</span>
              <span className={`wish-price ${best ? "" : "muted"}`}>{best ? `${euros(best.price, 2)} · ${best.merchant ?? "boutique"}` : "Pas de promo repérée"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
