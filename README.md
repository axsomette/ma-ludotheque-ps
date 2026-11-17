# Ma ludothèque PS

Ma collection de jeux PlayStation **physiques** (PS3, PS4, PS5), en boîtiers 3D.

1. Je prends la jaquette en photo depuis mon téléphone.
2. Le titre est lu directement dans le navigateur, et la plateforme est devinée grâce au bandeau PS5, PS4 ou PS3.
3. La jaquette officielle est retrouvée sur [IGDB](https://www.igdb.com/).
4. Le jeu rejoint l'étagère. Un clic ouvre le boîtier en 3D : le couvercle pivote, le disque sort et tourne.
5. Tout est enregistré dans Supabase, par utilisateur (connexion GitHub ou lien par e-mail).

Sans configuration, l'appli démarre en **mode démo** : la collection reste dans le navigateur, et les jaquettes sont générées.

## Architecture

| Élément | Rôle |
|---|---|
| `src/` | Appli React + Vite, publiée sur GitHub Pages |
| `src/components/GameCase3D.tsx` | Boîtier 3D (Three.js / React Three Fiber) : couvercle à charnière, disque irisé |
| `src/components/Shelf.tsx` | Étagère en CSS 3D, légère même avec des centaines de jeux |
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
2. Déclarer les secrets des fonctions, puis les déployer :
   ```bash
   supabase secrets set TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy ALLOWED_ORIGINS=https://<compte>.github.io,http://localhost:5173
   ```
   ```bash
   supabase functions deploy search-cover
   ```
   ```bash
   supabase functions deploy save-cover
   ```

### 3. GitHub Pages

1. Settings → Pages → Source : **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** : renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Ce sont des valeurs publiques par conception : la sécurité repose sur les règles RLS.
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
- Les deux fonctions exigent un utilisateur connecté (`verify_jwt`), ce qui protège le quota IGDB.

## Limites connues

- La lecture du titre dépend de la photo : jaquette de face, bien éclairée. Le titre lu reste modifiable avant la recherche.
- Si le jeu est introuvable, « Garder ma photo comme jaquette » utilise la photo elle-même.
- Les jaquettes viennent d'IGDB et restent la propriété de leurs éditeurs : usage personnel uniquement.
