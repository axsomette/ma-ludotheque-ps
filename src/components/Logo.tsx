// Logo « Boîtier ouvert » : le couvercle ouvert vers nous, le plateau biseauté et le disque irisé.
// Sources, versions une couleur et icônes d'appli dans brand/ (géométrie : brand/geometry.txt).
import { useId } from "react";

const LID = "M30 71.83L104 52V204L30 184.17Z";
const TRAY = "M116 52H210L226 68V204H116Z";
const HOLE = "M131 128a40 40 0 1 1 80 0a40 40 0 1 1-80 0Z";
const DISC_ON_TRAY = "M137 128a34 34 0 1 1 68 0a34 34 0 1 1-68 0ZM160 128a11 11 0 1 1 22 0a11 11 0 1 1-22 0Z";
// disque seul, pour l'indicateur de chargement
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
      <path fill="#C3CADB" d={LID} />
      <path fill="var(--text)" fillRule="evenodd" d={TRAY + HOLE} />
      <path fill={`url(#${id})`} fillRule="evenodd" d={DISC_ON_TRAY} />
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
