# Fiche d'écarts — implémentation en cours vs spécifications

> **⚠️ Portée révisée le 2026-09-24 (D44, `CLAUDE.md` §16).** Le code audité ici est, **hors landing
> page**, une **maquette jetable** qui n'ira jamais en production. Cette fiche n'est donc plus une
> liste de corrections à apporter à un futur produit : le produit réel sera écrit à partir des
> spécifications. Elle reste utile pour deux choses seulement : **(1)** la sécurité de la maquette
> quand elle est montrée (A1, A4 : voir **D56**) ; **(2)** les écarts qui **faussent la vision**
> présentée aux partenaires (M4 et le taux affiché : voir **D48** ; badge et écrans manquants : voir
> `implementation_plan.md`, section « Écarts connus »).
>
> **État au 2026-09-24 :** A1b fait (variable renommée `SESSION_COOKIE_SECRET`) ; **A1 non fait**
> (une valeur de repli en dur subsiste, `apps/api/src/server.ts`) ; A5 fait (`.env.example` présent) ;
> M4 partiel (la constante a disparu, mais « 35 % » reste écrit en dur dans quatre fichiers de
> libellés) ; B-E1 / B-E2 aggravés (le backoffice a reçu sa propre palette « Dark Obsidian », sans
> les tokens). Pour la landing page, seule partie conservée, les règles de `CLAUDE.md` s'appliquent
> pleinement.

> **Date :** 2026-09-19 · **Établie par :** `chef-de-projet`, à partir de trois audits en **lecture seule**
> (`integrateur` sur les variables d'environnement, `expert-ux` sur `apps/web` et sur `apps/backoffice`).
> **À qui elle s'adresse :** l'outil ou la personne qui écrit le code (`apps/`, `packages/`).
> **Statut :** aucun fichier de code n'a été modifié par les agents. Cette fiche **liste, elle ne corrige pas**.
> **Règle :** en cas d'écart, **c'est le code qui est corrigé, pas la spécification** — sauf si l'écart
> révèle un défaut de la spécification ; dans ce cas, le signaler à `chef-de-projet` avant de
> contourner.
>
> **Gravité.** 🔴 **Bloquant** : viole un invariant, une règle de sécurité ou un critère de livraison ;
> à corriger avant de continuer sur ce périmètre. 🟠 **Majeur** : à corriger dans le lot en cours.
> 🟡 **Mineur** : à corriger au passage.

---

## 0. Les quatre écarts à corriger en premier

| # | Écart | Pourquoi c'est prioritaire |
|---|---|---|
| **A1** | 🔴 **Secret en dur, committé** — `apps/api/src/server.ts` lignes 34-36 : `process.env.COOKIE_SECRET \|\| "influx-mock-cookie-secret-min-32-chars-long!"` | Si la variable n'est pas définie en production, les sessions sont signées avec **une valeur publique, sans aucun symptôme**. |
| **M4** | 🔴 **Un taux de commission littéral dans un composant** — `STANDARD_COMMISSION_DISPLAY = "35 % (Barème standard)"` (éditeur de tarifs créateur) | **Viole l'invariant** : aucun taux dans le code du MVP (`CLAUDE.md` §3 et §6, test T16). |
| **B-E9** | 🔴 **La file du backoffice charge toute la file et filtre côté client**, sans pagination | Le backoffice est le seul endroit où l'annuaire complet est lisible : c'est **le garde-fou anti-aspiration** (`15` RG34, CA18). |
| **B-E1/E2** | 🔴 **Le backoffice n'utilise pas les tokens INFLUX** : palette Tailwind par défaut (`slate-900`, `emerald-400`…), couleurs en dur | Enfreint la décision **D4** et `CLAUDE.md` §10.3-7 ; le vert de marque n'apparaît nulle part. |

---

## 1. `apps/api` et environnement

Références : `docs/mvp/02-architecture-3-espaces.md` §12.1, §12.3 et §18 (D43) ; `.claude/skills/env-secrets/SKILL.md`.

| # | Gravité | Écart | Où | Correctif attendu |
|---|---|---|---|---|
| **A1** | 🔴 | Secret en dur en repli (voir §0) | `apps/api/src/server.ts` l. 34-36 | **Supprimer le repli.** Valider les variables **au démarrage** (schéma `zod`) : si `SESSION_COOKIE_SECRET` manque ou fait moins de 32 caractères, **le processus refuse de démarrer**. |
| **A1b** | 🟠 | Nom de variable : `COOKIE_SECRET` | idem | Renommer en **`SESSION_COOKIE_SECRET`** (`02` §12.3). |
| **A2** | 🟠 | `process.env.NODE_ENV === "production"` comme discriminant d'environnement | `apps/api/src/routes/auth-routes.ts` l. 45 | Utiliser **`INFLUX_ENV`** (`staging` \| `production`). Sur Railway, `NODE_ENV` vaut `production` **aussi en `staging`** : toute règle branchée dessus traitera `staging` comme la production. |
| **A3** | 🟠 | Cookie de session en `sameSite: "lax"`, sans préfixe `__Host-` | `auth-routes.ts` l. 48-54 | Backoffice : cookie **`__Host-`** (donc `Secure`, `Path=/`, **sans attribut `Domain`**) et **`SameSite=Strict`** (`02` §3). Point à valider par `expert-cybersecurite`. Tolérable en maquette locale, à reprendre **avant le Lot 0**. |
| **A4** | 🟠 | CORS activé, origines `localhost:3000/3001/3002` en dur avec `credentials: true` | `server.ts` l. 22-30 | `apps/api` **n'est pas exposée publiquement** et n'a « ni CORS, ni cookie inter-sites » (`02` §12.1). Conditionner cette configuration à l'environnement (variable inventoriée) : **elle ne doit pas partir telle quelle en `staging`**. |
| **A5** | 🟠 | **Aucun `.env.example`** dans le dépôt | racine | Le créer, avec **valeurs factices**, pour chaque variable lue (règle 10 de `env-secrets`). |
| **A6** | 🔴 | *À vérifier avant d'aller plus loin sur l'authentification* : l'e-mail du code de connexion doit être **envoyé par `apps/api` via Brevo**, **pas par Supabase Auth** | routes d'authentification | Voir **D43**, `02` §18.10 : dix étapes dans un ordre précis, plancher de réponse constant de 1 s, `200` uniforme, aucun appel externe pendant qu'une transaction est ouverte, journal `leads.transactional_sends` écrit **avant** l'appel. Le comportement par défaut de Supabase (envoyer lui-même l'e-mail) fait perdre le `messageId`, la phrase anti-hameçonnage et la cause d'échec affichable. |

**Bonne nouvelle, à conserver :** aucune variable `NEXT_PUBLIC_`, `SUPABASE_*`, `BREVO_*`, `APOLLO_*`, `SERVICE_ROLE` ni `DATABASE_URL` dans `apps/web`, `apps/backoffice`, `apps/api` ou `packages/contracts` ; les deux fronts ne lisent aucun `process.env` ; `.gitignore` couvre `.env` et `.env.*` (sauf `.env.example`).

---

## 2. `apps/web` — éditeur de profil créateur

Références : `docs/mvp/07-criteres-profil-createur-reseaux-audience.md`, `docs/mvp/17-parcours-et-ecrans-espaces-membres.md` §9.2.
Fichiers : `RateCardEditor.tsx`, `creator-profile-labels.ts`, `packages/contracts/src/creator-profile.ts`.

| # | Gravité | Écart | Correctif attendu |
|---|---|---|---|
| **M4** | 🔴 | `STANDARD_COMMISSION_DISPLAY = "35 % (Barème standard)"` : **taux littéral dans un composant** | Supprimer. Aucun taux dans le code du MVP. Le net estimé s'affiche **en lisant les bornes nettes du référentiel** (`reference.price_bands`), jamais par un pourcentage. |
| **M1** | 🟠 | Le tarif **se choisit dans une liste de tranches**, et `exactAmountMinor` est **posé en dur** à la création d'une ligne | `07` RG22 et RG66 exigent l'inverse : **saisie en valeur exacte**, tranche **dérivée par le système**. La comparaison avec le budget d'une campagne devient ainsi déclarative. |
| **M3** | 🟠 | Listes fermées **codées en dur en français seulement** ; tranches **libellées en euros en dur** alors que la devise est un champ | Externaliser en traductions FR/EN (D28) ; la devise vient du champ (`06` RG26, `07` RG66, `04` R8). **C'est le point le plus coûteux à rattraper plus tard.** |
| **M2** | 🟡 | Les étiquettes de couche exposent le vocabulaire interne (« Couche A · Public Anonyme ») | Utiliser les libellés de `07` RG112 (par exemple « Visible de toutes les marques inscrites »). |
| **M5** | 🟡 | Net formaté à la main (`Math.round(/100)` + « € » concaténé) | Utiliser le formatage internationalisé avec la **devise en paramètre** (arrondi à l'euro et rendu faux en anglais aujourd'hui). |
| **M6** | 🟡 | Le net est peint avec les tokens `feedback-success-*` + une icône de tendance | Un montant n'est pas un succès, et une flèche montante suggère une performance qu'INFLUX ne mesure pas (`08` RG2). Utiliser le token `color-data-net-creator`, sans icône de tendance. |

**À conserver :** `getEstimatedNetForPriceBand` **lit** les bornes nettes du référentiel et ne multiplie rien — conforme à `07` RG72.

---

## 3. `apps/backoffice` — vue des files

Références : `docs/mvp/15-backoffice-files-et-supervision.md`, `docs/mvp/17b-parcours-et-ecrans-backoffice.md` §7.

### Bloquants

| # | Écart | Règle violée | Correctif attendu |
|---|---|---|---|
| **B-E9** | La liste charge **toute la file** et filtre **côté client**, sans pagination | `15` RG34, CA18 (anti-aspiration) | Pagination **côté serveur**, plafonnée ; filtres côté serveur ; défilement infini interdit. |
| **B-E1** | `globals.css` fait `@import "tailwindcss"` **sans importer `tokens.css`** ; `#0f172a` / `#f8fafc` en dur | D4, `15` RG120 / CA78, `CLAUDE.md` §10.3-7 | Importer le fichier de tokens ; **aucune couleur en dur**. |
| **B-E2** | **Toute la palette est celle de Tailwind par défaut** (`slate-900`, `emerald-400`, `rose-800`, `blue-600`…) | idem | Remplacer par les tokens INFLUX (et les tokens du backoffice proposés en `17b` §6). |
| **B-E3** | **Aucun i18n**, libellés en dur | D28, `15` §L | Traductions externalisées (le français est la valeur d'attente, D36 ouverte). |
| **B-E4** | **Ouvrir n'est pas prendre en charge** : un bouton « Prendre en charge » subsiste après ouverture | `15` RG27 C1, CA11 | Ouvrir une entrée **la prend en charge** automatiquement. |
| **B-E5** | Un **troisième onglet « À réexaminer »** | `15` RG27 C6 (deux issues, pas de troisième) | Le requalifier en **relâchement de verrou motivé**, qui existe déjà. |
| **B-E6** | Pas de **tri par échéance** ; les entrées hors délai ne sont pas en tête | `15` (tri par échéance partout), D39 | Trier par échéance croissante, hors délai en tête. |
| **B-E7** | Le hors-délai est signalé par **la couleur + un glyphe sans libellé écrit** | WCAG (`CLAUDE.md` §5.2-7) : la couleur n'est jamais le seul porteur d'information | Ajouter un **libellé écrit** (« En retard de 3 h »). |

### Majeurs

- Le **verrou est affiché par un fragment d'UUID** au lieu du **nom** du commercial.
- L'**ancienneté de l'entrée la plus ancienne** est absente ; une carte « Badges délivrés (session) » n'est spécifiée nulle part.
- **Un seul état vide** (il en faut plusieurs : file vide, filtre sans résultat, file bloquée).
- **Ni rail de navigation, ni bandeau d'environnement, ni bandeau de contrôle affaibli** (`17b` §4).
- L'onglet **« Marques »** est absent.
- Le créateur est identifié par **8 caractères d'UUID** : impossible de décider sans ouvrir autre chose.
- **Aucun raccourci clavier** (`17b` : navigation clavier complète).
- **À vérifier côté API** : les pièces de vérification s'ouvrent par `<a target="_blank">`. Le relais par l'API est correct, mais rien ne garantit la **journalisation par consultation** (`03` B6).

### Mineurs

- Des **codes de règles** (« RG45 », « RG57 ») sont affichés dans l'interface.
- Un **`any`** dans le tiroir (interdit sauf justification, `CLAUDE.md` §6).

**À conserver (déjà juste) :** tableau plutôt que cartes ; verrou visible ; motifs en liste fermée typée ; **message au créateur affiché avant la décision** ; commentaire obligatoire sur « autre » ; marqueur `▮`. *Le squelette est bon : les écarts sont de conformité, pas de conception.*

---

## 4. Comment s'en servir

1. Traiter **§0** d'abord (quatre écarts).
2. Pour chaque écart, la colonne « Correctif attendu » cite la règle de gestion : c'est elle qui fait foi. En cas de doute, lire la règle plutôt que ce résumé.
3. Après correction, **rejouer le contrôle correspondant** : le plan de test (`docs/mvp/18-plan-de-test-mvp.md`) porte les cas (T16 pour le taux littéral, T10/T11 pour les variables exposées, tests d'anonymisation pour les files).
4. Toute correction qui **contredit** une règle des spécifications doit être signalée avant d'être faite.
