# Logo « Boîtier ouvert »

Le geste de l'appli : on ouvre le boîtier, le disque est là. Couvercle ouvert vers nous (incliné à 15°),
plateau au coin biseauté à 45° (le biseau de l'interface), disque irisé posé dans le creux.

## Fichiers

| Fichier | Usage |
|---|---|
| `logo-symbol-color.svg` | Version principale, sur fond sombre |
| `logo-symbol.svg` / `logo-symbol-white.svg` | Une couleur : noir sur clair, blanc sur sombre |
| `logo-symbol-small.svg` | En dessous de 24 px : sans moyeu, disque en creux |
| `logo-icon*.svg` | Icônes d'appli (arrondie, carrée, maskable, petite) ; PNG dans `public/icons/` |
| `concepts-v2/` | Les trois pistes étudiées |

## Couleurs

| | Hex |
|---|---|
| Plateau | `#EDF0F7` |
| Couvercle | `#C3CADB` |
| Fond d'icône | `#161C30` → `#07090F` |
| Irisé du disque | `#7AF0FF` → `#B48CFF` → `#FF9DE2` → `#FFE08A` |

La couleur n'est qu'un bonus : la forme se lit en une seule couleur.

## Règles

- **Zone de protection** : la largeur du couvercle (74 unités sur 256) tout autour.
- **Taille minimale** : 24 px pour la version principale, 16 px avec `logo-symbol-small.svg`.
- **À éviter** : déformer, tourner, ajouter une ombre ou un contour, poser l'irisé sur un fond clair
  (il disparaît), remplacer le disque par une autre forme.
- Les symboles PlayStation (△ ○ ✕ □) et les logos de Sony ne s'associent jamais au logo.
