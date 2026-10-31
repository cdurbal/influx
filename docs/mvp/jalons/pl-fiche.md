# Jalon PL — Préparation du Lot 2 (corrections de la revue du 2026-10-31)

> **Source :** `docs/mvp/revue-pre-lot2-2026-10-31.md` §1 et §3, corrections K1 et K3 à K10 validées
> par le fondateur le 2026-10-31 (K2 inscrite à part, `95be92e`). Mécanique D77.
> **Préparé par :** Claude Code (`/jalon-prepare pl`) · **Statut :** validé par le fondateur le 2026-10-31 · **Exécution :**
> `/jalon-run pl`, table `jalons/pl/run.md`.

## Objectif et périmètre

Ouvrir le Lot 2 sur une base stable et sobre : CI sans intermittent connu, dette J9 du Lot 2 soldée,
gros fichiers découpés, fichiers communs des deux fronts mis en paquets, renvois et registre de
décisions allégés, budget de durée e2e fixé avant les écrans des profils. **Ne change pas** : aucune
migration (sauf `0151`, PL-04a), aucune route ajoutée ou retirée, aucun écran nouveau, aucune règle métier, la vitrine.

## Invariants

1. Refactors à comportement constant : mêmes réponses d'API, mêmes écrans, mêmes en-têtes ; seules
   exceptions, J9S-6 et J9S-7 (PL-03), telles qu'écrites dans `archives/jalons/j9-fiche.md` l. 36-37,
   PL-01a (brouillon gardé au changement de langue) et PL-04a (contrainte Apollo resserrée), choix A
   du fondateur le 2026-10-31.
2. Aucun attendu d'un test existant n'est affaibli ; une attente de synchronisation peut changer
   (PL-01), jamais une assertion. Planchers (`packages/test-kit/src/case-floors.ts`) jamais baissés.
3. Passe-plat (`03` PP-12, D64) : un secret interne par front, logique inchangée, octets épinglés
   par empreinte là où ils vivent ; T7 et T10 verts. CSP à nonce inchangée.
4. `tokens.css` : une seule source pour les deux fronts ; vitrine inchangée (G3e, TD4, TK8.2).
5. Aucune clé de traduction modifiée, sauf l'ajout du libellé de J9S-7 dans
   `apps/backoffice/src/messages/fr.ts`.
6. Documentation (PL-10, PL-11) : aucun texte de décision perdu ni reformulé dans son sens ; le
   détail est déplacé mot pour mot.
7. `CLAUDE.md` §2 et §5 (aucun taux ni calcul de commission, aucun appel Supabase depuis un front).

## Lectures

| Ligne | Tranches |
|---|---|
| 01a | `apps/web/src/components/auth/AuthFlow.tsx` l. 70-110 ; `journey-memory.ts` ; `journey-resume.spec.ts` l. 90-130 |
| 01 | `apps/web/e2e/support/journey.ts` l. 172-181 ; `backoffice-auth-screens.spec.ts` l. 61-75 (`64bcb6e`) ; `security-headers.spec.ts` l. 205-235 ; `journey-resume.spec.ts` l. 104 ; `charter-cascade.spec.ts` l. 302 ; `apps/web/playwright.config.ts` l. 40-60 |
| 03, 04 | `archives/jalons/j9-fiche.md` l. 36-41 |
| 04a | `0141_leads_apollo_excluded_countries.sql` (`sync_settings_value_shape`) ; `qualification.ts` (`unreadableApolloKeys`) ; `05` RG160, RG162 |
| 04b | `apps/api/package.json` (`test:db`) ; `apps/api/scripts/check-case-floors.ts` |
| 07 | `02` l. 850-860 et §21.3 (l. 2326-2394) ; `21` §7 ligne du Lot 2 ; `packages/test-kit/src/guards.ts` l. 186-230 et 381-410 |
| 10 | `CLAUDE.md` (titres) ; `git log` de `CLAUDE.md` (renumérotation `5d232af`, 2026-10-05) |
| 11 | `decisions.md` en-tête l. 1-10 ; lignes par `Grep "^\| D[0-9]"` |
| 12 | `21` §2.3 ; `18` §1.3 et A-4 (`Grep`) ; ligne RK de `archives/21-journal-lot1-archive.md` §5 |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| PL-01a | `fix(web): keep the language hand-over draft when React restarts a render` | Brouillon lu sans vidage pendant le rendu, vidé après le montage (arrêt de PL-01) | unitaires du module ; `journey-resume` cinq fois |
| PL-01 | `test(e2e): one hydration barrier for the journeys and DS-11` | K1 : attente d'hydratation partagée ; `open()`, `reload()`, DS-11 ; commentaire périmé | DS-11, `journey-resume`, TD3.6, T10.6 |
| PL-02 | `chore: Node 24.12 engines and justified lint exceptions` | K7 : `engines.node` `>=24.12.0` ; motif `--` sur quatre `eslint-disable` | `pnpm check:fast` |
| PL-03 | `fix(health): cached status for /health and unverified browser errors` | J9S-6, J9S-7 | tests unitaires des deux points ; spec e2e de l'écran Santé |
| PL-04a | `fix(db): refuse non-string country bases in the Apollo sync settings` | Migration `0151` : `by_country` n'admet que les chaînes prévues (arrêt de PL-04) | suite base complète ; parité 49/49 |
| PL-04b | `fix(api): test:db runs only the files it is given` | La commande de `CLAUDE.md` §7 règle 5 ne filtre pas (arrêt de PL-04) | `test:db` filtré et complet |
| PL-04 | `test: Apollo settings parity, case ids in titles, artifact floors` | J9S-9, J9T-8, J9T-9 ; intermittent `t14-backoffice-invitations-route` | parité, planchers `test:artifacts` |
| PL-05 | `refactor(api): split the backoffice repository by sub-domain` | K5 | `db-tests` qui importent le dépôt backoffice |
| PL-06 | `refactor(backoffice): account record form rules in a view model` | K8 | tests unitaires du module de vue ; `backoffice.spec` |
| PL-07 | `docs(mvp): shared front packages (PL-07 arbitration)` | K4, arbitrage `architecte` : périmètre, noms, gardes, amendement de `02` | — |
| PL-08 | `refactor(ui): shared tokens and fonts in packages/ui` | K4, partie charte, selon PL-07 | G3, TD3, TD4, TK8, `check-case-floors` |
| PL-09 | `refactor(web): relay, API client and error collector in packages/web-platform` | K4, partie plate-forme, selon PL-07 | T7, T10, PP-12, `test:artifacts` |
| PL-10 | `docs(mvp): CLAUDE.md section refs of the specs after the 2026-10-05 renumbering` | K9 | contrôle `git grep` du prompt |
| PL-11 | `docs(mvp): two-line decision register, verbatim detail apart` | K10 | contrôle des identifiants D1 à D77 |
| PL-12 | `docs(mvp): e2e duration budget for Lot 2 (PL-12 measure)` | K3, mesure et proposition (`testeur`) | trois mesures `pnpm test:e2e` |
| PL-13 | — | Décision du fondateur sur le budget e2e | — |
| PL-C | `docs(mvp): close the PL milestone` | Clôture | `pnpm check` + `pnpm test:e2e` |

## Tests

Aucun identifiant nouveau de famille : PL-03 et PL-04 ajoutent des cas sous J9S-6, J9S-7, J9S-9 ;
PL-06 des cas unitaires du module de vue ; PL-08 et PL-09 déplacent les gardes d'empreinte vers les
paquets (même nombre de cas au moins). Durée e2e ajoutée par le jalon : 0 s visée (PL-01 peut la
réduire).

## Critère de fin

- [ ] Trois `pnpm test:e2e` de suite verts sans rejeu, DS-11, `journey-resume` et TD3.6 compris (PL-01).
- [ ] Reliquat de `21` §8 soldé pour J9S-6, J9S-7, J9S-9, J9T-5, J9T-8, J9T-9, SNT-1 ; lignes
      retirées de la table (PL-C).
- [ ] Aucun fichier de `apps/api/src/domains/backoffice/` au-delà de 600 lignes ; `db-tests` verts (PL-05).
- [ ] Plus aucun fichier identique entre `apps/web/src` et `apps/backoffice/src`, sauf ceux que
      PL-07 garde nommément ; T7, T10, G3, TD4 verts (PL-08, PL-09).
- [ ] Contrôle de PL-10 vide ; `decisions.md` à 25 Ko au plus, D1 à D77 présents dans les deux
      fichiers (PL-11).
- [ ] Budget e2e décidé par le fondateur et écrit dans `21` §2.3 (PL-13).
- [ ] `pnpm check` puis `pnpm test:e2e` verts ; CI verte sur le dernier commit.
- [ ] Revue `testeur` + `expert-cybersecurite` faite ; attestation `security-reviewed:` (D71).

## Écarts, décisions ouvertes, risques

- 2026-10-31, arrêt de PL-01 : `journey-resume.spec.ts:104` intermittent sous charge, cause hors
  hydratation (`AuthFlow` vide le brouillon de changement de langue dans un initialiseur de
  `useState`). Choix A du fondateur : ligne PL-01a avant PL-01. `EC-PL-01-1` : signal
  `data-hydrated` sur `<html>`, aucun signal existant ne couvrant toutes les pages.
- 2026-10-31, arrêt de PL-04 (`decision`) : la contrainte de `0141` admet dans
  `apollo_legal_basis.by_country` des valeurs non texte (`1`, `true`, `{}`, `[]`) que le worker
  refuse (RG160, RG162) ; et `test:db -- <fichier>` lance toute la suite. Choix A du fondateur :
  lignes PL-04a (migration `0151`) et PL-04b avant PL-04.
- PL-07 peut conclure au report de K4 : PL-08 et PL-09 passent alors à `ignoré`, avec le motif.
- PL-09 touche le passe-plat épinglé (PP-12) : revue de sécurité ciblée en fin de jalon.
- Risque : PL-08 et PL-09 créent des paquets du dépôt (dépendance) ; suite locale complète exigée.

## Arbitrage PL-07 (`architecte`, 2026-10-31)

**Contexte (K4, M2).** Inventaire revérifié par `cmp` sur `bf1724f` : **16 fichiers identiques** entre
`apps/web/src` et `apps/backoffice/src` : 7 modules (`app/api/[...path]/route.ts`, `server/relay.ts`,
`server/api-client.ts`, `config/server.ts`, `browser/relay-client.ts`,
`observability/error-collector.ts`, `styles/fonts.ts`), `styles/tokens.css`, les 7 fichiers de
`styles/fonts/` (4 woff2, 2 OFL, `FONTS.md`) et `HydrationMarker.tsx` (PL-01 : `components/ui/` dans
web, `components/` dans le backoffice). Hors périmètre, car différents : `globals.css`,
`global-error.tsx`, `config/security-headers.ts`, `proxy.ts`. Propres à un front : `tokens-backoffice.css`
(G3f), `server/status-cache.ts` (route `/health` de web, EC-22, PL-03).

| Option | Pour | Contre |
|---|---|---|
| A. Report de K4 | Aucun risque immédiat | Le Lot 2 retouche les tokens (profils, badge) et sans doute le passe-plat (pièces de vérification relayées par `apps/api`, J3S-7) : chaque geste fait deux fois. Le moment le moins cher est avant ses écrans |
| **B. Deux paquets source, sans build : `@influx/ui` (charte) et `@influx/web-platform` (plomberie d'exécution)** | Un rôle nommable par paquet (`02` §8 refuse `utils`) ; surface de sécurité (PP-12, I-4) séparée de la charte ; modèle de `@influx/contracts` | Deux `package.json` de plus |
| C. Un seul paquet commun | Un paquet de moins | Rôle innommable ; ESLint, I-4 et revue de sécurité s'étendraient à la charte |
| D. Paquets construits (`dist/`) | Découplage de Next | Étape de build écartée ailleurs (D64 écarte `tsup`) ; un artefact de plus à tenir égal à sa source |

**Décision : B ; K4 n'est pas reporté.**

1. **Ce qui sort.** Chaque paquet reproduit l'arborescence `src/` des fronts : les imports relatifs
   entre fichiers déplacés et les chemins des gardes restent les mêmes.
   - `packages/ui` (`@influx/ui`), PL-08 : `src/styles/tokens.css`, `src/styles/fonts.ts`,
     `src/styles/fonts/` (7 fichiers). Exports `./tokens.css`, `./fonts`. Aucune primitive : les
     composants appartiennent à deux registres (`20` §2) ; une primitive n'y entre qu'employée par les
     deux, après vérification `expert-ux`, avec alors un `@source` du paquet dans chaque `globals.css`.
   - `packages/web-platform` (`@influx/web-platform`), PL-09 : `src/server/relay.ts`,
     `src/server/api-client.ts`, `src/config/server.ts`, `src/browser/relay-client.ts`,
     `src/observability/error-collector.ts`, `src/components/HydrationMarker.tsx` (rend `null` : ni
     charte ni registre). Exports `./relay`, `./relay-client`, `./error-collector`,
     `./hydration-marker`, sans barrel : **ni le client d'API ni la configuration ne sont exportés**,
     le paquet ferme lui-même la chaîne route → relay → client → configuration. La configuration du
     passe-plat ne sert qu'aux deux fronts : ce n'est pas le paquet `config` écarté par `02` §8.
2. **Ce qui reste copié, nommément.** `src/app/api/[...path]/route.ts` : Next.js exige le fichier de
   route dans l'application et lit `runtime`, `dynamic` et `revalidate` comme littéraux du fichier (une
   réexportation n'est pas analysée). Il garde ces littéraux et ses cinq méthodes, importe
   `@influx/web-platform/relay`, reste identique dans les deux fronts et épinglé. Hors `src`, l'outillage
   lu à la racine de chaque application (`tsconfig.json`, `postcss.config.mjs`, `vitest*.config.ts`,
   `next-env.d.ts`) reste par application. `status-cache.ts` reste dans `apps/web`, non épinglé :
   fonction pure de la seule route `/health`, sans import, réseau ni environnement, qui ne voit ni
   requête relayée ni secret ; ses tests et les gardes générales la couvrent.
3. **Consommation par Next.js, sans build.** Dépendances `workspace:*` ; `exports` vers les sources TS,
   comme `@influx/contracts` ; `transpilePackages: ["@influx/contracts", "@influx/ui",
   "@influx/web-platform"]` dans les deux `next.config.ts` ; `globals.css` importe
   `@influx/ui/tokens.css` au lieu de `../styles/tokens.css` (le backoffice ajoute ensuite
   `tokens-backoffice.css`) ; les deux mises en page de G8 importent `@influx/ui/fonts` ; `next/font/local`
   est appelé dans le paquet, `src` relatif au module. Pairs : `next` (ui), `react` (web-platform).
   Chaque paquet a ses scripts `typecheck` et `lint` (sans eux, `pnpm -r` le saute en silence et ses
   interdits ESLint tombent) ; pas de suite de tests propre : les tests qui exercent et épinglent le
   code déplacé restent dans les fronts, qui prouvent chacun le paquet qu'ils servent (`ci.yml`
   l. 345-349 inchangé). Railway : `packages/**` déjà surveillé (`02` §12.1), commandes inchangées.
4. **CSP inchangée.** Rien d'inline : polices sous `/_next/static/media/` (`font-src 'self'`),
   `@font-face` en feuille externe, marqueur posé par un effet client. T10 et le contrôle « aucune
   violation CSP » des e2e en font foi.
5. **`test:artifacts` : planchers inchangés** (web 12 + 4 + 35, backoffice 1 + 3 + 35).
   `keo-tokens.artifacts.ts` lit le `tokens.css` du paquet (chemin seul) ; T11 sur `.next/static`
   prouve qu'aucun nom serveur (`INFLUX_API_INTERNAL_`) n'atteint un lot navigateur par le paquet ;
   l'intégration du passe-plat tourne sur le front construit, paquet compris.
6. **Gardes : aucune affaiblie.** Une garde d'**identité** entre copies devient, un pour un, une garde
   d'**absence** (aucune copie dans aucun front : ni `styles/tokens.css` ni `fonts.ts`, aucun woff2
   sous `src` ou `public`, aucun fichier du passe-plat hors la route) et d'**import** (chaque
   `globals.css` importe `@influx/ui/tokens.css` ; seules les deux mises en page de G8 importent
   `@influx/ui/fonts`) : autant de cas au moins, planchers jamais baissés. Les **épingles** PP-12 ne
   sont pas des gardes de copie et restent : octets épinglés là où ils vivent (invariant 3),
   `relay.ts`, `api-client.ts`, `config/server.ts` et `relay-client.ts` dans le paquet, `route.ts` dans
   chaque front ; valeurs toujours déclarées dans `@influx/test-kit/guards` (le geste conscient reste
   un fichier distinct), vérifiées par les tests de chaque front ; détecteurs à racine paramétrée,
   auto-tests adaptés. Les autres gardes suivent le code : contenu (aucun import de données, aucun
   `use server`, `process.env` dans `config/server.ts` seul) et chaîne des importateurs dans le
   paquet ; `@influx/web-platform/relay` importé par les seuls fichiers de route (web : passe-plat et
   `/health`) ; `exports` du paquet figés par une garde ; `fetch` admis dans `api-client.ts` et
   `relay-client.ts` du paquet, nulle part dans les fronts ; exceptions ESLint (`next/font/local`,
   `fetch`, `process.env`) déplacées vers les fichiers du paquet et retirées des fronts ; G3 étendue
   aux deux paquets ; G3e lit le fichier du paquet, instantané inchangé. **I-4**
   (`check-security-review.ts`, `SECURITY_FILES`) suit le passe-plat dans le paquet, avec
   `packages/web-platform/package.json`, dont les `exports` ferment la chaîne.
7. **Preuve du comportement constant.** PL-08 : feuilles construites des deux fronts identiques avant
   et après, aux identifiants générés par `next/font` près ; fichiers de `/_next/static/media/`
   identiques. PL-09 : chaque fichier déplacé ne diffère de sa copie de `bf1724f` que par ses
   commentaires (`git diff -M`, noté dans `run.md`), épingles mises à jour dans le même commit. Les
   deux : suite locale complète (dépendance) ; mentions de chemin vivantes corrigées dans le commit
   (`git grep` des anciens chemins hors `archives/`, `decisions.md` et revues datées : `CLAUDE.md` §4,
   `02` §13.2 et §15 règle 3, `03`, `17`, `17b`, `18`, `20`, `prerequis.md`, `expert-ux`, skill
   `design-system-influx`).
8. **Repli écrit d'avance (PL-08 seulement).** Si `next/font/local` appelé depuis le paquet échoue au
   `next build` (Turbopack, Next 16.3.6) ou change les fichiers servis, `fonts.ts` et `styles/fonts/`
   restent des copies gardées (G4f inchangée) et PL-08 ne déplace que `tokens.css`, noté
   `EC-PL-08-n` ; la liste des copies du critère de fin s'allonge d'autant. Tout autre échec : arrêt.
9. **`packages/domain` reste au Lot 2** (`21` §7) : il naît avec la première règle dont deux
   applications ont besoin (complétude, `02` §8). Rien d'actuel n'y va : les fronts ne portent aucune
   règle métier.

**Hors des cas d'arrêt.** D64 intact : le même module lit `INFLUX_API_INTERNAL_SECRET` dans le
processus de chaque front, valeur propre à chaque service. PP-12 : aucune logique touchée, liste
blanche des routes et épingles conservées ; seuls l'emplacement et les commentaires changent.

**Conséquences.** Deux paquets, deux `next.config.ts` modifiés (préfixe I-4 : revue de fin de jalon),
`pnpm-lock.yaml` relié ; tokens, polices et passe-plat n'évoluent plus qu'une fois. **Réversibilité :**
totale et locale (recopier les fichiers, rétablir imports et gardes de copie depuis `bf1724f`), sans
donnée, variable ni service Railway touché. **`CLAUDE.md` :** §4 (« `src/styles/tokens.css` de chaque
front » → `packages/ui`), par PL-08, dans le commit qui rend la phrase vraie.

## Mesure PL-12 (`testeur`, 2026-10-31)

**Conditions.** `4773a33`, `pnpm test:e2e` tel quel (2 workers, `backoffice.spec` en série, builds
compris), serveurs horodatés par `DEBUG=pw:webserver`. Poste : i7-1185G7 (4 cœurs, 8 fils), 15,8 Go
dont 2,7 Go libres pile lancée, charge au repos 16 à 32 %. CI : `ubuntu-latest` d'un dépôt privé
(2 vCPU selon GitHub, non relevé).

**Mesures (annexe).** Trois passages verts de suite, sans rejeu : 295, 227 et 244 s. Les quatre
serveurs démarrent l'un après l'autre : 108 s avant le premier cas à froid (API 22 s, build et
démarrage web 58 s), 36 et 39 s ensuite (cache de build). Phase des cas 185 à 203 s ; cumul des cas
348 à 387 s (médiane 359 s) : ±5 % de bruit sur un même code. L'écart avec les 3,0 min après PL-08
tient au poste : en CI, l'étape passe de 149 s (PL-04b) à 158 s (PL-09) sur runner rapide.

| Spec (dix plus longues) | Cas | Cumul médian | Part |
|---|---|---|---|
| `backoffice` (série) | 53 | 120 s | 33 % |
| `journey-resume` | 7 | 32 s | 9 % |
| `charter-rendering` | 29 | 29 s | 8 % |
| `member-shell` | 18 | 29 s | 8 % |
| `charter-cascade` | 15 | 24 s | 7 % |
| `account` | 8 | 20 s | 6 % |
| `account-screens` | 12 | 18 s | 5 % |
| `security-headers` | 30 | 17 s | 5 % |
| `vitrine-unchanged` | 6 | 14 s | 4 % |
| `journey-screens` | 12 | 13 s | 4 % |

Cas les plus longs : DS-12b (`backoffice:1174`, 15-16 s), J8T-4 (`:436`, 13-17 s), compte à rebours
(`journey-resume:24`, 12-13 s dont 10 s d'attente réelle), PD1-PD7 (`:604`, 8-11 s). Un cas presque
vide coûte 0,6 à 1,0 s (`journey-screens:34` : contexte, navigation, hydratation) : ce coût fixe
pèse environ 150 s des 359.

**CI, job « Browser journeys ».** Dernier passage (`41227138649`, `6fe6e48`) : 407 s, dont attente de
la pile 133 s, build 44 s, Chromium 29 s, étape Playwright 158 s (serveurs 7 s, cas 150 s, cumul
285 s). Onze derniers verts : job 332 à 422 s, étape 149 à 231 s ; un runner lent (build ≈ 100 s) fait
la phase en 210-219 s (cumul 394-414 s), 1,4 fois un rapide. **Le garde-fou qui mord le premier est
l'étape à 5 min** : 69 s de marge au pire passage (contre 178 s au job sous les 10 min de `21` §2.3),
soit une réserve d'environ 110 s de cumul local.

| Levier | Mesure | Gain | Verdict |
|---|---|---|---|
| Session réutilisée (`storageState`) | Déjà appliquée autrement (J7) : 101 sessions semées par passage (61 membres, 29 agents, 11 admins), SQL et `Set-Cookie` intercepté, 60 ms chacune ; aucune connexion par code hors des parcours qui la testent | ≤ 6 s cumulés | Écarté : l'isolement compte (révocations, déconnexions, double contrôle à deux admins distincts) |
| Workers 2 → 3 | Passage local à 3 workers : phase 195 s (190 à 2), cumul 493 s (+37 %), `backoffice` 163 s | 0 | Écarté : poste saturé dès 2 ; runner CI à 2 vCPU |
| Specs parallélisables | Charge des deux workers à 11 s près ; `backoffice` (seul fichier qui sème des admins) n'est chemin critique qu'à 3 workers | ≤ 5 s (`fullyParallel`, fin de passage) | Sans objet à 2 workers |
| Attentes réelles | Compte à rebours de 10 s (`journey-resume:24`), silence de 3 s (`:187`) ; le plancher serveur de 1 s par code reste | 10 à 13 s cumulés (`page.clock` : attente seule, assertions inchangées) | **Retenu** |
| Cas redondants | Axe de l'accueil créateur fr aux quatre largeurs dans `member-shell:647` et `account-screens:93` ; un cas par largeur dans `journey-screens` (9 cas où 3 suffisent) | 2 s (doublon), 6 s (regroupement) | Planchers jamais baissés : règle pour les cas neufs, aucun retrait |
| Job CI en deux éclats (`--shard`) | `backoffice` dans un éclat, le reste dans l'autre | ≈ −100 s sur l'étape au pire | Structurant (`integrateur`, `architecte`) : rapport fusionné pour les planchers, TK3.1 lit les passes axe de tous les fichiers, préparation (≈ 200 s) payée deux fois |

**Proposition de budget du Lot 2.**
1. **Ajout ≤ 20 s par jalon**, mesuré à la clôture : somme des durées médianes, sur les trois passages
   de clôture, des cas ajoutés ou allongés (`test-results/e2e-report.json`), notée dans `run.md` ; le
   cumul total reste indicatif (bruit ±5 %). 20 s ≈ +12 s sur l'étape CI au pire : cinq jalons
   épuisent la réserve.
2. **Job « Browser journeys » sous 8 min** sur chaque passage vert (étape alors sous ≈ 4 min 50 s au
   pire) ; garde-fous de 5 et 15 min inchangés, dans les 10 min de `21` §2.3. Dépassement : levier au
   jalon suivant ou arbitrage.
3. **Levier du premier jalon : horloge simulée** (`page.clock`) sur les deux attentes de
   `journey-resume` (−10 à −13 s) ; règle des cas neufs : un cas par page et par langue, largeurs en
   boucle dans le cas (comme `account-screens`).
4. **Levier structurel** (éclats CI) à arbitrer par `architecte`, sur recommandation `testeur`, dès
   qu'un passage dépasse 7 min 30 ou avant le Lot 3.

**Décision PL-13 (fondateur, 2026-10-31) :** points 1 à 4 acceptés tels quels ; PL-C les écrit dans
`21` §2.3.

**Constats hors budget.** `GET /v1/bo/alerts` répond 500 (42501 dans `newBrowserSignIns`,
`backoffice/alerts/repository.ts`) pendant DS-12b dans 3 passages locaux sur 4, cas vert : à instruire
à la revue (R). Commentaire périmé de `ci.yml` (étape Playwright « About 45 s locally »).

**Annexe — passages mesurés** (`4773a33` ; total par `date`, le reste par le rapport JSON) :

| Passage | Total | Avant le 1er cas (API / web / BO) | Phase des cas | Cumul | Charge par worker | Cas |
|---|---|---|---|---|---|---|
| 1 (à froid) | 295 s | 108 s (22 / 58 / 17) | 185 s | 348 s | 169 / 180 s | 214 verts |
| 2 | 227 s | 36 s (6 / 13 / 11) | 190 s | 359 s | 174 / 185 s | 214 verts |
| 3 | 244 s | 39 s (5 / 16 / 12) | 203 s | 387 s | 196 / 190 s | 214 verts |
| Levier, 3 workers | 228 s | 31 s (4 / 12 / 11) | 195 s | 493 s | 147 / 192 / 155 s | 214 verts |
| CI `6fe6e48` | 407 s (job) | 7 s (sans build) | 150 s | 285 s | — | 214 verts |

## Revue

2026-10-31, `48e1b44..ec87b56` : aucun bloquant. Détail (fichier:ligne, constat, correctif) :
`jalons/pl/revue-constats.md` ; « reliquat » : `21` §8, lignes écrites par PL-C (`jalons/pl/cloture.md`).

| Id | Gravité | Traité par |
|---|---|---|
| PLT-1 | dans le jalon | `fix-1` |
| PLT-2 | avant production | reliquat |
| PLT-3 | dans le jalon | `fix-2` |
| PLT-4 | plus tard | reliquat |
| PLT-5 | avant production | reliquat |
| PLT-6 | plus tard | reliquat |
| PLT-7 | plus tard | reliquat |
| PLS-1 | avant production | reliquat |
| PLS-2 | avant production | reliquat |
| PLS-3 | plus tard | reliquat |
| PLS-4 | plus tard | `fix-1` (test), reliquat (route) |
| PLS-5 | plus tard | reliquat, avec PLT-5 |
| PLS-6 | plus tard | reliquat, avec PLT-5 |
| PLS-7 | plus tard | reliquat |
| PLS-8 | plus tard | reliquat |
| PLS-9 | plus tard | reliquat, avec PLT-4 |
