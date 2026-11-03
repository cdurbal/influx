# Jalon L2B — Profil marque : saisie, logo, soumission

> **Source :** `jalons/lot2-plan.md` l. 26 (ligne L2B), l. 17 (préalable Storage), l. 35-47 (reliquat),
> `21` §8 (L2AT-4, L2AT-5, L2AS-2, L2-amend), fiche L2A § Revue (L2AU-4) · **Préparé le** 2026-11-01
> par Claude Code (`/jalon-prepare L2B`) · **Statut :** validé par le fondateur le 2026-11-01 (réponses en fin de fiche) ·
> **Exécution :** `/jalon-run l2b`, table `jalons/l2b/run.md`.

## Objectif et périmètre

Une marque remplit les blocs 1 à 3 de son profil (M2, charte KEO, sous-page de « Mon compte », D74),
enregistrés automatiquement, dépose un logo débarrassé de ses métadonnées, voit sa complétude et
l'étiquette de couche de chaque champ, puis soumet : le profil passe `en attente de validation`.
Socle posé : `packages/domain`, Storage démarré en CI, migrations `0202` à `0204`.
**Ne change pas :** aucune décision d'agent (validation, refus, publication : L2C), aucun envoi vers
Brevo ou Apollo hors du `lead.updated` existant du nom (CA3), aucun écran créateur, backoffice ni
vitrine ; bloc 4 « Vérification » et demande de badge absents (L2E) ; aucun montant, taux, net ni
tarif (CLAUDE.md §2, D48, D78).

## Invariants

1. **D40, D46.** E-mail, téléphone et page de contact de l'interlocuteur : aucun `GRANT` au rôle
   créateur, jamais ; prénom : aucun `GRANT` créateur au Lot 2 (révélation au Lot 4, `03` C(9)). La
   **fonction** est publique (`06` RG35). Aucun schéma de réponse membre ne porte un champ interne
   d'un autre compte ; le créateur n'atteint aucune route du profil marque (T14.3, T14.4).
2. **Un seul nom d'entreprise** (`06` RG2, CA3) : `advertiser_profiles.legal_name` (`0106`) est le nom
   commercial ; écrit par le seul chemin existant (`identity.update_member_account`, `0122` l. 97-120)
   avec son `lead.updated` ; aucune seconde colonne de nom. Pays et langue lus du compte, jamais
   redemandés (CA2).
3. **La base arbitre** (`21` §2.1 point 3) : listes fermées par clé étrangère vers `reference.*` ou
   `check` ; plafonds en base (secteurs secondaires ≤ 2, thématiques 1 à 3, marchés et pays d'audience
   ≤ 5, langues FR/EN ≥ 1) ; `usage_right.none` refusé en multi-choix (L2-amend) ; aucun texte libre
   hors nom, présentation et prénom (`06` RG13) ; domaine seul pour le site (RG17).
4. **Soumission** : seul le propriétaire fait passer `draft` ou `rejected` à `pending_review`, et
   seulement si les obligatoires de RG15, RG27, RG35 sont présents (la base le vérifie) ; aucun membre
   n'écrit `published`, `rejected` ni `suspended` (`06` RG6) ; double soumission sans effet ; chaque
   changement d'état journalisé dans la même transaction (CLAUDE.md §5 règle 5).
5. **Droits des personnes** (`04` §9.2 l. 5804-5830) : la migration qui crée une donnée identifiante
   étend `privacy.execute_request()` et l'export (`0137` l. 930-1060) ; à l'effacement,
   `advertiser_contact_details` vidée, logo retiré du Storage.
6. **Storage** (`03` P10, §6.6) : compartiments **privés** (T9.1), type et taille réglés au
   compartiment ; chemin calculé par `apps/api` (`<compartiment>/<uuid compte>/<uuid>.<ext>`, jamais
   le nom d'origine, T9.9) ; validation des octets et dimensions avant rattachement (E1-5) ;
   ré-encodage sans aucune métadonnée (E1-6, I-1, T9.5 par lecture des octets) ; PNG, JPEG, WebP
   seulement, PDF refusé (E1-9) ; quotas par compte et par jour (E1-10, T9.8) ; URL signée ≤ 5 min,
   un chemin, une méthode, un usage, émission journalisée (E1-3, E1-8) ; CSP du backoffice inchangée.
7. **Front** : jamais Supabase pour une donnée métier, aucune clé ; seule exception, le téléversement
   E1 si l'arbitrage 02 le retient (hôte lu en configuration, `security-headers.ts` l. 1-4) ; aucun
   stockage navigateur (D37) ; aucune logique métier dans un composant.
8. **Dépendances** : versions exactes, `minimumReleaseAge` ; `@supabase/storage-js` importé dans un
   seul fichier de `apps/api/src/platform/` ; `@supabase/supabase-js` et `postgrest-js` absents ;
   suite locale complète (D76).
9. **Écran** : tokens seuls (`packages/ui/src/styles/tokens.css`) ; étiquette de couche icône + texte
   sur chaque champ (RG62, CA39, `17` l. 745-754) ; clés de `06` RG84 sans réinvention ; WCAG AA, le
   vert jamais seul porteur d'un état (RG85, CA47) ; FR et EN sans résidu (CA46).
10. **Tests** : aucun attendu affaibli, planchers jamais baissés ; e2e ajouté ≤ 20 s (`21` §2.3), un
    cas par page et par langue, largeurs en boucle ; base touchée : fichiers du domaine, suite base
    complète pour une migration.
11. **Migrations** `0202`, `0203`, `0204` dans cet ordre (`check-migrations.ts` l. 16) ; chacune porte
    sa table, ses droits, ses politiques, son test et ses lignes de `expected-rights.ts` (T2) ;
    marqueur I-4 à la revue (05, 06, 08 ; 03 et 09 selon les fichiers).
12. **Chemin de M2** `/fr/compte/profil` · `/en/account/profile`, littéral (garde J4S-7) ; visible de
    la marque seule jusqu'à L2D.

## Lectures

| Ligne | Tranches |
|---|---|
| 01 | `21` §8 (L2AT-4, L2AT-5, L2AS-2) ; `apps/api/src/domains/ops/scrub.ts` l. 121-145, `recorder.ts` l. 150-250 ; `packages/test-kit/src/guards.ts` l. 239-400 ; `apps/web/tests/guards.test.ts` l. 700-720 ; `supabase/migrations/0201_reference_taxonomies.sql` (contraintes) ; `apps/api/db-tests/reference-taxonomies.test.ts` |
| 02 | `lot2-plan.md` l. 17 ; `03` P10 l. 1064-1087, §6.5 l. 1450-1497, §6.6 l. 1520-1539 ; `02` l. 145 (E1) ; `04` §5.11 l. 5220-5239, §9.2 l. 5804-5830 ; `18` T9 l. 643-663 ; `21` §2.4 l. 75-77 ; `.github/workflows/ci.yml` l. 210-300 ; `supabase/config.toml` l. 124-135 ; `apps/web/src/config/security-headers.ts` ; `apps/api/src/platform/supabase.ts` (en-tête) |
| 03 | `jalons/l2b/stockage.md` ; `ci.yml` l. 215-300 ; `supabase/config.toml` l. 124-135 |
| 04 | `06` RG5 l. 152-155, §F l. 445-479, RG17 l. 225-230, CA35 à CA38 l. 863-880 ; `02` §21.3 l. 2400-2434 ; `packages/contracts/package.json` (forme d'un paquet) |
| 05 | `06` §A à §D l. 122-383 ; `04` §5.2 l. 1371-1413, §9.2 l. 5804-5830 ; `03` §3.2 l. 233-310 ; `archives/jalons/l2a/referentiels.md` l. 5-13, 79-84 ; `0106` l. 34-90 ; `0122` l. 25-120, 205-206 ; `0137` l. 930-1060, 2700-2722 ; `0150` l. 459-620 ; `expected-rights.ts` l. 530-560, 1339-1349, 1393-1394, 2234-2236 |
| 06 | `06` RG3 à RG6 l. 136-159, cas limites 3 et 5 l. 662-700 ; `04` §4.3 l. 568-620 (journal) ; `0106` l. 34-75 ; jeu de champs obligatoires de `packages/domain` (04) |
| 07 | `06` RG2, RG14, RG17, CA1 à CA7 l. 732-757, CA14 ; `03` §3.2 C(7) à C(9) ; `apps/api/src/domains/identity/account-routes.ts` (forme d'une route `/v1/me`, l. 200-240) ; `packages/contracts/src/account.ts` ; `18` T14 l. 731-739 |
| 08 | `stockage.md` ; `03` P10 ; `04` §5.11 ; `18` T9.1, T9.8 ; `0201` l. 1-40 (forme d'en-tête) |
| 09 | `stockage.md` ; `03` §6.6 ; `06` RG15 (logo), RG18, cas limites 3 et 6 ; `18` T9.2 à T9.5, T9.8, T9.9 ; `platform/supabase.ts` |
| 10 | `17` §4.2 l. 745-754 ; `20` §11 (par tranches, `Grep "^### 11"`) ; `referentiels.md` l. 15-90 ; `apps/web/src/components/member/ui/` ; skill `design-system-influx` |
| 11 | `17` §4.2 l. 672-778, §2.3 l. 223-235, §2.6 l. 315-325 ; `06` RG35, RG82 à RG85 l. 591-622, CA44 à CA47 ; `apps/web/src/lib/member-paths.ts` l. 8-60, `member-nav.ts` l. 16-80 ; `e2e/case-floors.ts` |
| 12 | `17` l. 685, 770 ; `06` RG15, CA45, cas limites 2 et 6 ; `stockage.md` |
| 13 | `17` §2.3 l. 223-261, §2.4 l. 263-275, §4.1 l. 628-670 ; fiche L2A § Revue (L2AU-4) ; `components/auth/MemberHome.tsx` ; `e2e/member-shell.spec.ts` |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| 01 | `test: J4S-7 guard on every tree, closed route models, reference constraints` | Dette : L2AT-4, L2AS-2, L2AT-5 (trois contraintes) | gardes, `ops-scrub`, `reference-taxonomies` |
| 02 | `docs(mvp): storage and image pipeline of Lot 2 (L2B-02 arbitration)` | Arbitrage `architecte` (+ grille `integrateur`) : `l2b/stockage.md`, D80 | — |
| 03 | `ci: start Supabase Storage in the database and browser jobs` | `storage-api` hors de `-x` ; **I-4** (`.github/workflows/`) | CI verte, durées mesurées |
| 04 | `feat(domain): packages/domain with the brand profile completeness` | Paquet neuf ; complétude RG57 à RG61, obligatoires RG5, domaine RG17 | unitaires, suite complète |
| 05 | `feat(db): full brand profile, its lists and contact details (0202)` | Colonnes, listes, interlocuteur, droits, effacement et export ; **I-4** | T2, `profiles-brand`, privacy ; suite base |
| 06 | `feat(db): brand profile submission guarded by the database (0203)` | Cinq états, transition, journal `profile.submitted` ; **I-4** | db + parité avec 04 ; suite base |
| 07 | `feat(api): brand profile read, autosave and submission` | Contrats, `GET`/`PATCH`/soumission, listes actives | inject, db, T14.1 à T14.4 |
| 08 | `feat(db): private brand-logo bucket, quotas and storage policies (0204)` | Compartiment, objets, quotas ; **I-4** | T9.1, T9.8 (base), T2 ; suite base |
| 09 | `feat(api): brand logo upload, re-encoding without metadata, read` | Pipeline E1 ; dépendances ; **I-4** si CSP | T9.2 à T9.5, T9.8, T9.9, T14 ; suite complète |
| 10 | `feat(web): form primitives, layer labels and reference list labels` | Champs KEO, `LayerBadge`, libellés FR/EN des listes | unitaires, parité codes ↔ clés |
| 11 | `feat(web): brand profile screen M2 with autosave and submission` | M2 blocs 1 à 3, colonne de complétude, états | e2e M2 FR/EN ≤ 12 s |
| 12 | `feat(web): brand logo deposit on M2` | Dépôt, aperçu, reprise sur erreur | e2e ≤ 4 s |
| 13 | `feat(web): brand profile state on the home and in the rail` | Carte d'action, verrous expliqués, bloc d'état ; L2AU-4 | e2e ≤ 4 s |
| 14 | — (`fondateur`) | Recette sur `staging` (`l2b/recette.md`) | constat en lecture seule |
| C | `docs(mvp): close the L2B milestone` | Clôture | `pnpm check`, `pnpm test:e2e` ×3 |

## Tests

Les cas portent la règle qu'ils prouvent (`06` RGn, CAn, `18` T9.n, T14.n, `03` E1-n).

- **01** : garde J4S-7 appliquée à tous les arbres des deux fronts, cas négatif ; `routeModelOf` :
  chemin inconnu → `unmatched`, chemin connu inchangé ; trois contraintes de `0201` vues rouges.
- **04** : CA35 (somme exacte des poids, détail par bloc), CA36, CA37 (le score n'est pas un seuil),
  RG61 (ordre et noms des manquants), RG17 (CA4 et cas limite 2) ; plancher du paquet.
- **05** : T2.1 à T2.7 avec les tables neuves ; `db-tests/profiles-brand.test.ts` : plafonds,
  `none`, longueurs, domaine, RLS propriétaire seul, créateur sans aucun droit (D46), interne en
  aal2 ; `t8-privacy-execution` et `tm1-privacy-execution` étendus (effacement, export).
- **06** : soumission refusée incomplète (nom du champ dans l'erreur), refusée vers `published`,
  idempotente, journalisée ; **parité** des obligatoires base ↔ `packages/domain`.
- **07** : CA1 à CA7, CA14 ; RG14 (même schéma zod des deux côtés) ; un créateur reçoit la réponse
  d'une ressource inexistante (T14.3, T14.4) ; schéma de réponse sans champ hors liste.
- **08** : T9.1 (tous les compartiments), limites du compartiment, politiques de `storage.objects`
  (P10.6), quota en base ; T2.
- **09** : T9.2 (expiration, durée ≤ 5 min), T9.3 (`../`), T9.4 (octets contraires, PDF), **T9.5**
  (image de test géolocalisée : octets relus après ré-encodage, aucune métadonnée), T9.8, T9.9 ;
  dépôt d'un autre compte = inexistant (T14) ; remplacement : ancien objet purgé (cas limite 3).
- **10** : primitives (clavier, `aria-*`, erreurs liées) ; chaque code actif de `reference.*` utile à
  M2 a sa clé FR et EN, et réciproquement.
- **11** : `e2e/brand-profile.spec.ts`, FR et EN, 1 440 et 375 px dans le cas : CA1, CA2, CA6, CA7
  (manquants nommés, focus au premier), CA39, CA44 (rechargement : brouillon retrouvé), CA46, CA47 ;
  cumul médian ≤ 12 s.
- **12** : dépôt nominal et erreur réseau simulée (CA45 : champs conservés, nouvelle tentative) ;
  ≤ 4 s. **13** : carte d'action et bloc d'état, FR et EN ; ≤ 4 s.
- **Durée e2e du jalon** : ajout ≤ 20 s, somme des médianes des cas ajoutés sur les trois passages de
  clôture ; job « Browser journeys » < 8 min avec Storage démarré.

## Critère de fin

- [ ] Sur `staging`, un profil marque soumis (`pending_review`) par la recette du fondateur (14) ;
      ligne et journal `profile.submitted` lus en lecture seule.
- [ ] EXIF absent du logo : T9.5 vert (octets relus) ; objet du logo de la recette relu sur `staging`
      sans métadonnée.
- [ ] Storage actif en CI : jobs base et parcours démarrent `storage-api` ; durées dans `run.md`.
- [ ] `packages/domain` créé ; la complétude n'existe qu'à cet endroit (garde ou `Grep`).
- [ ] T9.1 à T9.5, T9.8, T9.9, T14, T2 verts ; suite base complète verte.
- [ ] e2e M2 FR/EN vert ; ajout ≤ 20 s ; job « Browser journeys » < 8 min.
- [ ] Reliquat L2AT-4, L2AS-2, L2AT-5 (contraintes), L2AU-4, L2-amend soldés ou reportés avec motif.
- [ ] `pnpm check` puis `pnpm test:e2e` verts trois fois sans rejeu ; CI verte.
- [ ] Revue `testeur` + `expert-cybersecurite` ; attestation `security-reviewed:` couvrant les
      commits I-4 (D71).

## Écarts, décisions ouvertes, risques

- **Question 1 (fondateur) — budget indicatif de la marque.** `06` RG27 le rend obligatoire et
  public, en tranche de `reference.price_bands`, vide depuis L2A (D78). D78 ne vise que le tarif
  créateur ; sa portée sur les budgets est « à confirmer avant le Lot 3 ». Options : (A) champ
  suspendu comme le tarif créateur (ni saisi, ni affiché, ni obligatoire) ; complétude calculée sur
  les points atteignables (budget exclu ; badge exclu jusqu'à L2E, où sa demande devient possible) ;
  (B) champ public et obligatoire : ligne `arbitrage` `expert-paiement-facturation` (tranches et
  devises) avant 05, contiguïté par devise (L2AT-5) ; (C) champ interne, vu d'INFLUX seul, facultatif.
  **Recommandation : A** (prolonge D48 et D78 ; aucune tranche à inventer). **Retenue : A** (fondateur, 2026-11-01). La fiche est écrite pour
  A ; B ou C ajoutent une ligne et rouvrent 04, 05, 07, 11.
- **EC-L2B-1** : `check-migrations.ts` impose l'ordre des noms ; L2B prend `0202` à `0204`, les
  jalons suivants les numéros libres suivants ; `04` §11.2 et `lot2-plan.md` amendés à la clôture.
- **EC-L2B-2** : nom commercial ≤ 80 (`06` RG15) contre ≤ 120 en base et à l'inscription (`05` RG13,
  `0106`, `0132` l. 486) : 120 gardé (aucun nom existant refusé) ; `06` RG15 amendé.
- **EC-L2B-3** : `legal_name` (`0106`) garde le nom commercial (renommer toucherait 45 fichiers) ; la
  raison sociale de RG46 arrive à L2E sous un autre nom, dans un objet interne.
- **EC-L2B-4** : `04` l. 1395 range `contact_role` dans l'objet révélable ; `06` RG35 la rend
  publique : colonne de `advertiser_profiles`.
- **EC-L2B-5** : le dessin de `17` l. 717-728 met e-mail, téléphone et page sous « masqué » ; `06` RG35
  et D46 font foi : couche « interne ». `17` amendé.
- **EC-L2B-6** : `06` l. 968 (« compartiment public pour les logos modérés ») contredit `03` P10.1 :
  compartiment privé ; `04` §5.11 (aucun compartiment de logo) amendé.
- **EC-L2B-7** : chemin de M2 absent de `17` §2.6 : `compte/profil` · `account/profile` ; amendé.
- **D80 (L2B-02)** : logo par le passe-plat (2 Mio, PP-9 amendé), ni E1 ni URL signée au L2B ;
  compartiment `brand-logo` en WebP ≤ 1 Mio ; T9.2 devient « aucune réponse du logo ne porte d'hôte
  Supabase ni de jeton » ; `l2b/stockage.md` prime sur les prompts 03, 08, 09, 12 et la revue.
- **Hors L2B** : bloc 4, badge et bloc interne RG46 (L2E) ; aperçu « ce que voit un créateur » (`06`
  §H, après les campagnes) ; détection d'une coordonnée (RG19), doublons de nom et de domaine (RG25,
  RG70), re-validation (RG9), `profile.completed` et attributs Brevo (RG78 à RG81), modération du
  logo (RG18) : L2C. Indice statique de RG19 sous la présentation seulement.
- **Risques** : démarrage de `storage-api` en CI (durée, jobs base et parcours) ; politiques de
  `storage.objects` sur le projet hébergé ; binaire natif du ré-encodage sur Railway ; « Mes
  informations » modifie le nom sans examen : L2C doit le faire passer par une révision après
  publication ; DS-flaky relevé à chaque passage ; preuve `staging` dépend d'une boîte réelle
  (ligne 14, arrêt).

## Réponses du fondateur (2026-11-01)

1. Question 1 : option A retenue (budget suspendu, complétude sur les points atteignables).
2. Écarts EC-L2B-1 à EC-L2B-7 validés tels que tranchés.

## Revue

Revue de fin de jalon (`testeur` + `expert-cybersecurite`, 2026-11-03, plage `27c4c3f..4321a6c`) :
**aucun bloquant**. `testeur` : prêt à livrer pour `main` sous réserve de L2BT-1 et L2BT-2.
`expert-cybersecurite` : attestation `security-reviewed: 2026-11-03 covers 662382e 5739d4a 4e75abf
41aced0 2ac2b9d 715f2f0` (lignes 03, 05, 06, 08, 09, 12), commitée en clôture après `fix-1` et
`fix-2` (texte dans `l2b/cloture.md`). Constats « avant production » et « plus tard » reportés dans
`21` §8 à la clôture.

| Id | Gravité | Constat (fichier:ligne) | Correctif | Sort |
|---|---|---|---|---|
| L2BT-1 | à corriger dans le jalon | CA38, RG61 sans test : `publish.missing` (`locales/{fr,en}/brand-profile.json:3`) vu au seul regex (`e2e/brand-profile.spec.ts:93`, `:434`) ; rien ne prouve les manquants nommés ni l'absence de promesse chiffrée ; « publier » alors que l'action est « soumettre » ; « dit ce que cela change » (RG61) non réalisé | Cas dans `tests/brand-profile-form.test.ts` (l. 329-375) : `publish.missing` formaté avec des champs, chacun nommé, aucune promesse chiffrée ; libellé « soumettre » ; écart « effet observable » remonté à `product-owner` | `fix-1` ; question `06` Q11 (`product-owner`), aucune décision prise |
| L2BT-2 | à corriger à la clôture | Durées CI avec Storage non consignées (ligne 03). « Browser journeys » : 359 s avant Storage, 437 s (`e9c941d`), 429 s (`9f174bf`), 440 s (`5739d4a`) ; borne 480 s, marge 40 s, dispersion ≈ 80 s. « Database tests » : 307 s avant, 305 à 337 s après | Durées consignées dans `run.md` ; borne sous surveillance, jamais élargie sans arbitrage | Clôture (`cloture.md`) |
| L2BT-3 | avant production | Double soumission simultanée non prouvée | `Promise.all` de deux `POST` de soumission : une seule ligne `profile.submitted`, un seul `changed: true` (patron `profiles-brand-route.test.ts:634`) | `21` §8 |
| L2BT-4 | avant production | Chemin d'échec de l'autosave non testé (`use-brand-profile.ts:51`, `:156` ; `use-brand-summary.ts:38`) | `PATCH` en 503 par `page.route` | `21` §8 |
| L2BT-5 | avant production | Largeurs de M2 non croisées | 320, 375 et 1 440 px × FR, EN : aucun défilement horizontal, CA46 sur toutes les sections | `21` §8 |
| L2BT-6 | plus tard | Horloge UTC réelle dans les tests de quota (`profiles-brand-logo-route.test.ts:436-455`) | Cas indépendants de l'heure réelle | `21` §8 |
| L2BT-7 | plus tard | Cas `legal_name` et `country` de `submit_own_advertiser_profile()` absents (`profiles-brand-submission.test.ts:363-418`) | Ajouter les deux cas | `21` §8 |
| L2BT-8 | plus tard | D76 à étendre : `test:artifacts` et `charter-headings` quand un écran ou un module de classes est ajouté (trois CI rouges consécutives) | Extension de D76 à arbitrer | `21` §8 |
| L2BS-1 | avant production (L2C) | Gel des profils `published`, `suspended` côté API seul (`EDITABLE_STATUSES`, `profiles/brand-profile.ts:48-52`) ; politiques UPDATE, INSERT, DELETE (`0202` l. 328-332, 358-369) et `begin_brand_logo_upload` (`0204` l. 314-342) ignorent l'état : modération contournable en L2C | Garde en base sur l'état ; décision liée à une version (`updated_at` ou jeton), obligatoires recontrôlés | L2C, `21` §8 |
| L2BS-2 | à corriger dans le jalon (doc) | `03` l. 894, 900-910 : `0205` donne à `influx_maintenance_definer` des droits sur `profiles` (`select`, `update`, `delete` sur `brand_logo_objects`, `storage_daily_usage`) et trois fonctions E-4 ; rôle absent des tables de rôles (seule mention l. 850) ; `influx_identity_definer` encore « à signer » | Rôle aux « créés plus tard » (`0117`, `0148`, `0205`, avec droits) ; motif `storage_purge` à E-4 ; « signé par `expert-cybersecurite` le 2026-11-03, revue de fin de L2B » | `fix-2` |
| L2BS-3 | à corriger dans le jalon (doc) | `03` l. 1398 (PP-9 « 1 Mo, aucun téléversement »), l. 1531, 1536 (E1-3, E1-8), l. 1068-1070 (P10.2 sans `brand-logo`) ; `18` l. 655, 660 (T9.2, T9.7) contredisent D80 et le code ; `cloture.md` l. 9-12 les omet | PP-9 (2 Mio par le passe-plat, 1 Mio ailleurs), §6.6 (E1 non retenu au L2B, ouvert avant L2E), P10.2 (`brand-logo`), T9.2 et T9.7 selon D80 ; `cloture.md` complété | `fix-2` |
| L2BS-4 | avant production | `0204` l. 13-18 : politique restrictive sans effet sur les clés S3 du Storage | Constater qu'aucune clé S3 n'existe, désactiver la connexion S3 (`staging` par les agents, D70 ; production sur confirmation du fondateur) | `21` §8 |
| L2BS-5 | plus tard | `platform/images.ts:83-91`, `:129-138` : `sharp` sans borne de temps | `.timeout({ seconds: 10 })` | `21` §8 |
| L2BS-6 | plus tard | `web-platform/src/server/relay.ts:36`, `profiles/routes.ts:150-185` : 2 Mio pour toutes les routes du passe-plat, corps en mémoire avant le contrôle de session | À reprendre avec le relais généralisé (D80, ouvert avant L2E) | `21` §8 |
| L2BS-7 | plus tard (L2C) | Lecture par agent ou admin des coordonnées de l'interlocuteur sans journalisation | Journaliser cette lecture privilégiée (CLAUDE.md §5 règle 5) | L2C, `21` §8 |
| L2BS-8 | plus tard (L2C, Lot 3) | Homographes IDN dans le domaine du site (`domain/src/brand-profile/website.ts:24`) | À instruire | L2C ou Lot 3, `21` §8 |
| L2BS-9 | plus tard | `fastify` 5.12.5 (GHSA-389g-gv7q-r4x8 ; `fast-uri`, modérés), hors diff | `fastify` ≥ 5.12.6 (dépendance : suite complète, D76) | `21` §8, avec L2AS-3 |
