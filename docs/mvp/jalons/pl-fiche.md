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

## Revue

*(rempli par `/jalon-run` : constats PLT-n, PLS-n)*
