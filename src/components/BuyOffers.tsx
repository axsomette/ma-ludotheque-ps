import { euros, storeLinks, type Offer } from "../lib/market";
import type { Game } from "../lib/types";

function OfferRow({ o }: { o: Offer }) {
  return (
    <li>
      <a href={o.url} target="_blank" rel="noopener noreferrer" className="offer">
        <span className="offer-price mono">{euros(o.price, 2)}</span>
        <span className="offer-ship muted small">{o.shipping == null ? "port à voir" : o.shipping === 0 ? "port offert" : `+ ${euros(o.shipping, 2)} de port`}</span>
        <span className="offer-title small">{o.title}</span>
        <span className="offer-seller muted small">
          {o.seller ?? "vendeur"} {o.feedback != null ? `· ${o.feedback.toLocaleString("fr-FR")} % d'avis positifs` : ""}
        </span>
      </a>
    </li>
  );
}

/** Meilleures offres eBay (vendeurs bien notés) et liens vers les boutiques françaises reconnues. */
export function BuyOffers({ game, offers }: { game: Pick<Game, "title" | "platform">; offers: { new: Offer[]; used: Offer[] } | null }) {
  return (
    <>
      {offers && offers.new.length > 0 && (
        <>
          <p className="small offer-head">Neuf · vendeurs eBay bien notés</p>
          <ul className="offers">{offers.new.map((o) => <OfferRow key={o.url} o={o} />)}</ul>
        </>
      )}
      {offers && offers.used.length > 0 && (
        <>
          <p className="small offer-head">Occasion · vendeurs eBay bien notés</p>
          <ul className="offers">{offers.used.map((o) => <OfferRow key={o.url} o={o} />)}</ul>
        </>
      )}
      {offers && !offers.new.length && !offers.used.length && <p className="muted small">Aucune offre de vendeur bien noté sur eBay France pour l'instant.</p>}
      <p className="muted small">Comparer dans les boutiques françaises reconnues :</p>
      <ul className="stores">
        {storeLinks(game).map((l) => (
          <li key={l.name}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              <strong>{l.name}</strong>
              <span className="muted small">{l.kind}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
