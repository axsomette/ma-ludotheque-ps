import { useEffect, useState } from "react";
import { euros, parseEuros } from "../lib/market";
import type { CoverCandidate, Platform } from "../lib/types";
import { findWish } from "../lib/wishlist";
import { DiscSpinner } from "./Logo";
import { useWishlist } from "./WishlistContext";

interface Props {
  candidate: CoverCandidate;
  platform: Platform;
  /** Meilleur prix en cours (bons plans), retenu comme « dernier prix vu ». */
  currentBest: number | null;
  /** Déjà dans la collection : pas de liste d'envies ni d'achat. */
  owned: boolean;
}

/** Dans la fiche d'achat : ajouter à la liste d'envies (avec prix max), la modifier, ou ranger le jeu acheté. */
export function WishPanel({ candidate, platform, currentBest, owned }: Props) {
  const api = useWishlist();
  const wish = api ? findWish(api.items, candidate, platform) : null;
  const [max, setMax] = useState(wish?.max_price != null ? String(wish.max_price).replace(".", ",") : "");
  const [busy, setBusy] = useState<"add" | "save" | "remove" | "buy" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setMax(wish?.max_price != null ? String(wish.max_price).replace(".", ",") : ""), [wish?.id, wish?.max_price]);

  // Fiche ouverte : le meilleur prix actuel devient le « dernier prix vu » (l'alerte de baisse est lue).
  useEffect(() => {
    if (api && wish && currentBest != null && wish.last_seen_price !== currentBest) void api.update(wish.id, { last_seen_price: currentBest }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wish?.id, currentBest]);

  if (!api || owned) return null;

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>, done?: string) {
    setBusy(kind);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg(done);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const price = parseEuros(max);
  const invalid = price === undefined;

  return (
    <section className={`photos wish ${wish ? "is-in" : ""}`} aria-labelledby="wish-title">
      <h3 id="wish-title">{wish ? "Dans ta liste d'envies" : "Liste d'envies"}</h3>
      <form
        className="wish-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid) return;
          if (wish) void run("save", () => api.update(wish.id, { max_price: price ?? null }), "Prix max enregistré.");
          else void run("add", () => api.add(candidate, platform, price ?? null, currentBest), "Ajouté : tu seras prévenu quand le prix baisse.");
        }}
      >
        <label className="field">
          <span className="field-label">Prix max (€, facultatif)</span>
          <input id="wish-max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder={currentBest != null ? `ex. ${Math.floor(currentBest * 0.8)}` : "ex. 25"} autoComplete="off" />
        </label>
        <button className="btn primary" disabled={busy !== null || invalid}>
          {busy === "add" || busy === "save" ? <DiscSpinner size={18} /> : null}
          {wish ? "Enregistrer" : "♥ Ajouter à mes envies"}
        </button>
      </form>
      {invalid && <p className="error small">Montant invalide : écris par exemple 24,90.</p>}
      {wish?.max_price != null && (
        <p className="muted small">
          Alerte quand un prix passe sous {euros(wish.max_price, wish.max_price % 1 ? 2 : 0)}
          {currentBest != null ? ` (meilleur prix actuel : ${euros(currentBest, 2)})` : ""}.
        </p>
      )}
      {wish && (
        <div className="wish-actions">
          <button className="btn" disabled={busy !== null} onClick={() => void run("buy", () => api.bought(wish, candidate, platform))}>
            {busy === "buy" ? <DiscSpinner size={18} /> : null}
            Je l'ai acheté : le ranger
          </button>
          <button className="text-btn" disabled={busy !== null} onClick={() => void run("remove", () => api.remove(wish.id), "Retiré de ta liste d'envies.")}>
            Retirer de mes envies
          </button>
        </div>
      )}
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
