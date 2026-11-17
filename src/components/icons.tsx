// Icônes au trait (24 px, trait 1.75), un seul style dans toute l'appli.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const IconLogout = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
  </svg>
);
/** Boîtier vu de face. */
export const IconCase = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M5 7h14" />
  </svg>
);
/** Retourner (voir le dos). */
export const IconFlip = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3" />
    <path d="M18 3v4h-4M6 21v-4h4" />
  </svg>
);
/** Boîtier ouvert. */
export const IconOpen = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v16M12 4H5v16h7M12 4l7 2v16l-7-2" />
  </svg>
);
export const IconDisc = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 6.5a5.5 5.5 0 015.5 5.5" />
  </svg>
);
export const IconGithub = (p: P) => (
  <svg {...base({ ...p, fill: "currentColor", stroke: "none" })}>
    <path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z" />
  </svg>
);
export const IconMail = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4 7l8 6 8-6" />
  </svg>
);
