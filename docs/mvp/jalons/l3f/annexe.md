# Jalon L3F — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au commit
(`apps/api/db-tests/case-floors.ts`, `apps/web/e2e/case-floors.ts`), jamais baissé ; fichier base neuf
déclaré dans `shards.ts`, dans l'éclat le plus court.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| L3F-T1 | contrôle | `db-tests/shards.ts` | chaque fichier dans un seul éclat ; sommes mesurées, écart ≤ 15 s | — | 01 |
| L3F-T2 | base | `creator-search-door.test.ts` | L3ES-1 : campagne hors des états admis = inconnue, octet par octet ; secteur changé en brouillon sans effet observable | +3 | 02 |
| L3F-T3 | base | `creator-profile-door.test.ts` | CA6 (clés de la carte) ; CA49 inconnu = exclu par E1 à E6 ; CA15 (4 et 5 profils) ; CA48 ; 60e, 61e ouverture ; CA50 (visuel `pending`, `rejected`, d'autrui) ; fermé ; RG1 ; T1-R par couple | 20 | 03 |
| L3F-T4 | base | `search-shortlists.test.ts` | T2, 42501 direct ; alias inconnu = exclu ; autre marque ; campagne d'autrui ou non admise ; bornes ; exclu masqué puis revenu ; CA52 | 14 | 04 |
| L3F-T5 | base | `search-selection-requests.test.ts` | CA39 (critères, campagne, langue) ; fermé et sous le seuil acceptés ; plafond ; D45, CA64 ; T2 ; export, effacement | 10 | 05 |
| L3F-T6 | base | `search-abuse-alerts.test.ts` | CA45 (6e oui, 5e non, deux filtres variés non) ; CA46 (seuil, retombée après sélection ou demande) ; AL21 avec ouvertures ; destinataires | 8 | 06 |
| L3F-T7 | intégration | `creator-profile-route.test.ts`, `t14-creator-profile-route.test.ts`, `t15-creator-profile-rate.test.ts` | clés exactes, RG48 absentes même nulles ; `no-store` ; visuel en JSON sans URL, hôte ni jeton ; Storage indisponible ; T14.1, T14.3, T14.4 ; T15.2 à T15.5 (ouverture) | 12 ; 4 ; 4 | 07 |
| L3F-T8 | intégration | `search-shortlists-route.test.ts`, `selection-request-route.test.ts` | contrats stricts ; T14.1 à T14.4 ; bornes ; rien vers Brevo ni Apollo ; aucune route d'export | 10 ; 6 | 08 |
| L3F-T9 | intégration | `t1-anonymisation.test.ts`, `t9-evidence-unreachable.test.ts` | T1.1, T1.2, T1.4 sur 07 et 08, cartes à visuels (L3ES-4) ; T1.5 ; T9.6, T9.7 côté annonceur | +6 ; +2 | 09 |
| L3F-T10 | unitaire | `member-nav.test.ts`, `creator-search-view.test.ts` | seule l'entrée « Créateurs » change ; élargissements, tranches, états | ≥ 8 | 10 |
| L3F-T11 | unitaire | vues du profil, des sélections, de la demande | états et libellés sans logique dans les composants | ≥ 6 | 11 |
| L3F-E1 | e2e | `e2e/brand-creator-search.spec.ts` | fermé (CA59), sous le seuil, résultats et raisons, plafond ; axe FR 375 et EN 1 440 | 4, ≤ 12 s | 10 |
| L3F-E2 | e2e | `e2e/brand-creator-shortlists.spec.ts` | profil et 3 visuels ; 3 créateurs ajoutés à une sélection de la campagne ; demande de sélection ; FR et EN | 3, ≤ 13 s | 11 |

**Budgets.** e2e : ≤ 25 s pour le jalon, mesurés en CI par spec (règle de L3D Q2), médiane locale
indicative ; états préparés par l'API ou SQL de test, jamais par l'interface. Base : ≈ + 90 à 120 s ;
chaque éclat ≤ 7 min 30, éclat le plus long + contrôle ≤ 8 min. **Base partagée** : chaque fichier
isole ses créateurs (pays d'audience et thématique propres) ou balaie les siens (`stale-fixtures.ts`).

## Critère de fin
- [ ] Interrupteur ouvert (local) : une marque filtre, lit l'explication, ouvre un profil (3 visuels),
      ajoute 3 créateurs à une sélection de sa campagne, demande une sélection — preuve : L3F-E1, E2 en CI.
- [ ] Interrupteur fermé : critères, message et bouton de demande seuls (CA59) — preuve : L3F-E1, T3.
- [ ] Profil : clés de la carte (CA6), inconnu = exclu (CA49), 61e ouverture → 429 (T15.2), `was_opened`
      (CA48), région (CA15) — preuve : L3F-T3, T7.
- [ ] Visuels lus par l'annonceur sans URL émise, approuvés seuls (T1.5, T9, CA50) — preuve : L3F-T3, T7, T9.
- [ ] Sélections sans notification (CA52) ni export (TM12.3) ; demande avec critères, campagne et langue
      (CA39), sans mise en relation (D45) ni lead (CA64) — preuve : L3F-T4, T5, T8.
- [ ] CA45 et CA46 levées, ouvertures dans AL21 — preuve : L3F-T6.
- [ ] Reliquat soldé : L3E-DB, L3ES-1 (selon Q1), EC-L2G-16, L3ES-4 — preuve : lignes 01, 02, 03, 07, 09.
- [ ] `0322` à `0326` sur `staging` ; interrupteur de `staging` faux en fin de jalon — preuve : « Migrate
      staging » vert, lecture SQL.
- [ ] Recette du fondateur (ligne F, selon Q2) — preuve : réponse mot pour mot dans `run.md`.
- [ ] T1, T2, T14, T15 verts ; job base ≤ 8 min ; e2e ≤ 25 s ; `pnpm check` puis `pnpm test:e2e` verts.

## Écarts, décisions ouvertes, risques
- **EC-L3F-1** : lecture du portfolio par l'annonceur, E1-8 (URL signée ≤ 5 min) ou relais JSON par
  `apps/api` (D80, D82, logo du L3D) : A tranche ; hypothèse : relais, aucune URL émise ; `18` T1.5,
  T9.2, T9.7 reformulés par 09.
- **EC-L3F-2** : pas d'éclat e2e de plus (plan l. 60, arbitrage `integrateur`) : pas Playwright de 76 à
  82 s pour 300 s par éclat (CI 44595411008) ; + 25 s tiennent.
- **EC-L3F-3** : L3E-DB : 4 min 30 n'est pas atteignable en rééquilibrant (≈ 2 min de pile et de
  reconstruction par éclat : 287 − 168 s) ; 01 égalise ; la règle de `shards.ts` (approche de 7 min 30)
  reste, plus un écart CI ≤ 30 s.
- **EC-L3F-4** : file 9 : la demande s'écrit au L3F ; prise en charge, clôture motivée, motifs (`17b`
  I13 : liste A de `13` RG83 en attendant) et AL23 au L3G ; déclaration de la file et du délai
  (`04` l. 5258, provisoire) au L3F ou au L3G : A tranche.
- **EC-L3F-5** : M4 et la carte de `17` (§4.4, §7.1) précèdent D78 et RG55 : ni filtre ni tri par tarif,
  ni « Demander une mise en relation (pour ces 3) » ; `17` amendé par 10 et 11.
- **EC-L3F-6** : région absente des cartes de L3E (`archives/jalons/l3e/modele.md` §2) : ajoutée au
  profil par 03, à la carte de recherche si A le décide.
- **Hypothèses `staging`** : 60 ouvertures par jour ; CA45 à 6 et 2 ; CA46 à 150 (exemple de la spec) ;
  bornes des sélections ; seuils à fixer par le fondateur avant `production` (avec L3ES-3).
- **Risques** : charge brute du profil, du visuel, des sélections (RG80, première vérification de R) ;
  profil ouvert ou ajout à une sélection comme oracle d'exclusion (code, corps, temps) ; sélection en
  export déguisé ; texte libre de la demande (lu des seuls agents, D46) ; temps de la suite base.

### Questions au fondateur (fiche)
1. **L3ES-1 au L3F** (ligne 02, après A ; états admis tranchés par A sous grille `product-owner`) ? M4
   expose la campagne liée ; 0,5 j ; avis `expert-conformite-rgpd` au Lot 6. *Recommandé : oui.*
2. **Recette `staging`** : l'agent ouvre l'interrupteur de `staging` pour la recette par
   `search.write_search_setting()` (contexte du compte admin de `staging` en `aal2`, comme
   `creator-search-kit.ts` ; `search.settings_changed` écrit), puis le referme ? Sinon recette de l'état
   fermé seul, l'état ouvert prouvé par l'e2e. *Recommandé : ouverture temporaire (ligne F).*

**Réponses du fondateur (2026-11-19)** : « oui aux 2 questions » : Q1 (L3ES-1 au L3F, ligne 02) et Q2
(interrupteur de `staging` ouvert pour la recette puis refermé, ligne F) retenues comme recommandé.

## Revue

Revue groupée (ligne R) : 0 bloquant, 0 « jalon ». Verdict : `main` et `staging` sans bloquant ;
`production` autorisée sous conditions : L3FS-1 à 3 (migration 0327 et `member-rate.ts`, environ 1 jour)
et L3FT-1 à corriger avant, en tête de L3G ou au Lot 6.

### testeur (`L3FT`, plage `eba84af..HEAD`)
- **L3FT-1** avant production : aucune preuve de concurrence sur les plafonds à verrou consultatif
  (ouvertures 60/jour, listes, items, demandes 5/jour ; `0323` l. 269, `0324` l. 464-718, `0325` l. 324 ;
  tests `creator-profile-door.test.ts:1216`, `search-shortlists.test.ts:736`/`:1016`,
  `search-selection-requests.test.ts:774`, une seule transaction annulée) ; même angle mort sur la porte
  de recherche de L3E. Correctif : test à deux connexions committées lançant la 60e ouverture ou la 5e
  demande en parallèle (une servie, une refusée).
- **L3FT-2** plus tard : `creator-search-door.test.ts:803` catalogue passe `object_key` de false à true
  pour le propriétaire. Correctif : asserter par `prosrc` que `object_key` n'apparaît que dans
  `search.read_creator_visual`.
- **L3FT-3** plus tard : `use-results-focus.ts` et `use-card-visuals.ts` sans test unitaire. Correctif :
  si régression de focus, vérification Playwright ciblée.

### expert-cybersecurite (`L3FS`)
- **L3FS-1** avant production : durée de réponse qui trahit une exclusion (profil, visuel) ; `0323`
  l. 365-393 et 496-500, le moteur ne tourne que si l'alias est trouvé. Correctif : exécuter le moteur et
  la recherche d'impression même alias non trouvé, comme `0324` l. 336-340 ; migration 0327 et test par
  `pg_stat_user_functions` (1-2 h).
- **L3FS-2** avant production : les sélections trahissent une exclusion à coup sûr (`0324` l. 724-729
  retrait par vitrine visible ; l. 625-630 borne `itemsPerList` sur toutes les lignes). Correctif : retrait
  par `search.shortlist_creator()` comme `set_shortlist_note` (l. 683), inverser le cas EC-L3F-04-4 de
  `search-shortlists.test.ts` l. 1195 (1 h).
- **L3FS-3** avant production : écritures de sélection sans limite de débit, moteur exécuté sous verrou
  de compte (`member-rate.ts` l. 18-34 ; `0324` l. 592-603 et 669-683 ; pool de 10 connexions
  `db/index.ts` l. 46). Correctif : débit par adresse sur les six routes d'écriture, moteur avant le
  verrou, `lock_timeout` court (0,5 jour).
- **L3FS-4** plus tard (EC-L3F-05-4) : `0325` l. 211, `preferred_language` lu par le propriétaire.
  Correctif : rejouer l'assertion l. 1975-1982 comme test permanent dans L3E-T6.
- **L3FS-5** plus tard : coût, le moteur entier tourne pour un seul créateur (visuels, ajouts, notes,
  lecture de liste jusqu'à 11 fois, `0324` l. 407-412 et 808-811). Correctif : mesurer, puis paramètre
  « un seul créateur ».
- **L3FS-6** plus tard : alias de plus de 64 caractères donne un 400 au lieu du 404 commun
  (`creator-search-profile.ts` l. 29, `shortlists.ts` l. 23). Correctif : répondre le 404 commun.
- **L3FS-7** plus tard : caractère NUL dans un nom, une note ou un message donne un 500 (`shortlists.ts`
  l. 48, 69, 76, 86 ; `selection-requests.ts` l. 29). Correctif : refuser les caractères de contrôle ;
  au L3G afficher le message en texte brut, bidi neutralisés.
- **L3FS-8** plus tard : les alias inconnus (404) ne sont ni journalisés ni comptés, AL21 ne voit pas
  l'énumération (28^6). Correctif : ligne pino sans alias et compteur par compte dans `ops`.

### Attestation I-4 (à utiliser par la clôture, telle quelle)
Les lignes 07 et 08 ne contiennent aucun SQL ; les cinq SHA (lignes 02 à 06) sont vérifiés par
`git cat-file -t`.

`security-reviewed: 2026-11-20 covers c6af19a30a5e1e1be0a49538680e6ee61cb1cd4a 584a23f4195434d4fb6d2082441c2540ec02a042 b0bf60535d14a2e16df59ccd9c040be84bc87778 65d99b748ddf042df98699987a49c72b702306cf cab91ae078d586f26543aba9946fb201c4fabd43`
