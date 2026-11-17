# Ma ludothèque PS

Ma collection de jeux PlayStation **physiques** (PS3, PS4, PS5), en boîtiers 3D.

1. Je prends la jaquette en photo depuis mon téléphone.
2. Le titre est lu directement dans le navigateur, et la plateforme est devinée grâce au bandeau PS5, PS4 ou PS3.
3. La jaquette officielle est retrouvée sur [IGDB](https://www.igdb.com/).
4. Le jeu arrive sur l'**accueil**, comme sur une console : le jeu sélectionné en grand (le fond prend la couleur de sa jaquette), puis des rangées par plateforme.
5. Tout est enregistré dans Supabase, par utilisateur (connexion GitHub ou lien par e-mail).

Sans configuration, l'appli démarre en **mode démo** : la collection reste dans le navigateur, et les jaquettes sont générées.

## Le boîtier, de A à Z

Toucher un boîtier l'ouvre en 3D, aux proportions d'un vrai boîtier Blu-ray (135 × 171 × 15 mm) :

- **Prendre en main** : glisser pour le tourner ; il reprend sa pose au relâchement.
- **Face / Dos** : jaquette avant ; dos composé avec les vraies données IGDB (captures, résumé, genres, PEGI, éditeur).
- **Ouvrir** : le couvercle pivote sur la tranche ; moyeu à griffes, clips à livret.
- **Disque** : il sort du boîtier et tourne ; le toucher le retourne pour voir la face gravée irisée.
- **Photos du vrai boîtier** : photographier le dos et le disque pour remplacer les versions générées.

Raccourcis clavier dans la vue : `F` face, `D` dos, `O` ouvrir, `X` disque, `Espace` ouvrir/fermer, `Échap` retour.

## Sur le téléphone (PWA)

L'appli s'installe comme une application : Safari → Partager → **Sur l'écran d'accueil** (iPhone), ou Chrome → **Installer l'application** (Android). L'interface reste disponible hors ligne ; les données Supabase ne sont jamais mises en cache. Le logo et ses déclinaisons sont dans `brand/` (les trois pistes étudiées dans `brand/concepts/`).

## Tests

```bash
npm test
```

Vitest : calculs de couleurs et PEGI, découpe des textes du dos, détection de plateforme et nettoyage du titre lu sur la photo, collection en mode démo. Le workflow de déploiement exécute les tests avant chaque mise en ligne.

## Architecture

| Élément | Rôle |
|---|---|
| `src/` | Appli React + Vite, publiée sur GitHub Pages |
| `src/components/GameCase3D.tsx` | Boîtier 3D (Three.js / React Three Fiber) : couvercle à charnière, disque irisé |
| `src/components/Library.tsx` | Accueil : jeu mis en avant, rangées et grille de boîtiers (CSS, sans Three.js) |
| `src/lib/ocr.ts` | Lecture du titre (Tesseract.js), **dans le navigateur** : la photo n'est envoyée nulle part |
| `supabase/migrations/` | Table `games`, règles RLS (chacun ne voit que ses jeux), bucket `covers` |
| `supabase/functions/search-cover` | Recherche IGDB filtrée PS3/PS4/PS5. Les clés Twitch restent côté serveur |
| `supabase/functions/save-cover` | Copie la grande jaquette dans `covers/<user_id>/` (évite les blocages CORS en 3D) |

## Mise en route

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (l'offre gratuite suffit).
2. Appliquer le schéma : coller `supabase/migrations/20261117000000_init.sql` dans **SQL Editor**, ou utiliser la CLI :
   ```bash
   supabase link --project-ref <ref>
   ```
   ```bash
   supabase db push
   ```
3. **Connexion GitHub** :
   - Authentication → Providers → GitHub : coller le Client ID et le Client Secret d'une OAuth App GitHub.
   - Cette OAuth App se crée dans GitHub → Settings → Developer settings → OAuth Apps. Son « callback URL » est `https://<ref>.supabase.co/auth/v1/callback`.
4. Authentication → URL Configuration :
   - **Site URL** : `https://<compte>.github.io/ma-ludotheque-ps/`
   - **Redirect URLs** : la même adresse, plus `http://localhost:5173/` pour le développement.

### 2. Jaquettes (IGDB)

1. Créer une application sur [dev.twitch.tv/console](https://dev.twitch.tv/console) (gratuit), de type « Confidential ».
2. Déclarer les secrets des fonctions (Edge Functions → Secrets, ou en ligne de commande), puis déployer les fonctions :
   ```bash
   supabase secrets set TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy ALLOWED_ORIGINS=https://<compte>.github.io,http://localhost:5173
   ```
   ```bash
   supabase functions deploy search-cover
   ```
   ```bash
   supabase functions deploy save-cover
   ```
   Chaque fonction tient en un seul fichier : on peut aussi la coller dans l'éditeur du tableau de bord.
   Désactiver **« Verify JWT with legacy secret »** sur les deux (déjà fait par `config.toml` avec la CLI) :
   avec les nouvelles clés de signature, c'est la fonction qui vérifie elle-même la session et renvoie 401 sinon.

### 3. GitHub Pages

1. Settings → Pages → Source : **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** : renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (la clé « publishable » `sb_publishable_…`, ou l'ancienne clé anon). Ce sont des valeurs publiques par conception : la sécurité repose sur les règles RLS.
3. Pousser sur `main`. Le workflow `Déploiement GitHub Pages` compile et publie.

## Développement local

```bash
npm install
```
```bash
cp .env.example .env.local
```
```bash
npm run dev
```

Sans `.env.local`, l'appli démarre en mode démo.

## Sécurité

- Aucun secret dans le dépôt. Les clés Twitch vivent dans les secrets Supabase, et `.env.local` est ignoré par git.
- RLS sur `games` et sur le stockage : un utilisateur ne lit et n'écrit que ses données, et seulement dans `covers/<son id>/`.
- `save-cover` ne télécharge que depuis le CDN d'IGDB, avec un identifiant d'image strictement validé.
- Les deux fonctions exigent un utilisateur connecté (session vérifiée dans la fonction, 401 sinon), ce qui protège le quota IGDB.

## Limites connues

- La lecture du titre dépend de la photo : jaquette de face, bien éclairée. Le titre lu reste modifiable avant la recherche.
- Si le jeu est introuvable, « Garder ma photo comme jaquette » utilise la photo elle-même.
- Les jaquettes viennent d'IGDB et restent la propriété de leurs éditeurs : usage personnel uniquement.
