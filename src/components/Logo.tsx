// Logo « Disque qui sort » : le boîtier biseauté (bandeau + corps) et le disque qu'on en sort.
// Sources et icônes d'appli dans brand/.
import { useId } from "react";

const CASE_BAND = "M50 36H128L140 48V48.4A80 80 0 0 0 105.9 60H36V50Z";
const CASE_BODY = "M36 68H95.1A80 80 0 0 0 140 207.6V208L128 220H50L36 206Z";
const DISC = "M76 128a72 72 0 1 0 144 0a72 72 0 1 0-144 0ZM130 128a18 18 0 1 0 36 0a18 18 0 1 0-36 0Z";

function Iris({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0.1" y1="0.1" x2="0.9" y2="0.9">
      <stop offset="0" stopColor="#7AF0FF" />
      <stop offset="0.33" stopColor="#B48CFF" />
      <stop offset="0.66" stopColor="#FF9DE2" />
      <stop offset="1" stopColor="#FFE08A" />
    </linearGradient>
  );
}

export function Logo({ size = 40, title }: { size?: number; title?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <Iris id={id} />
      </defs>
      <path fill="var(--text)" d={CASE_BAND} />
      <path fill="var(--text)" d={CASE_BODY} />
      <path fill={`url(#${id})`} fillRule="evenodd" d={DISC} />
    </svg>
  );
}

/** Indicateur de chargement : le disque irisé qui tourne. */
export function DiscSpinner({ size = 28 }: { size?: number }) {
  const id = useId();
  return (
    <svg className="disc-spinner" width={size} height={size} viewBox="56 56 184 144" aria-hidden>
      <defs>
        <Iris id={id} />
      </defs>
      <path fill={`url(#${id})`} fillRule="evenodd" d={DISC} />
    </svg>
  );
}
