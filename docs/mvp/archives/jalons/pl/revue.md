# Revue de fin du jalon PL

Constats seulement : aucun fichier modifié. **Plage :** `48e1b44..HEAD` (parent du commit d'ouverture
`81113dd` ; PL-01a précède PL-01), diff fichier par fichier.
**Format :** `PLT-n` ou `PLS-n`, gravité (bloquant · à corriger dans le jalon · avant production ·
plus tard), fichier:ligne, correctif en une phrase.

## Pour `testeur`

- Aucune assertion affaiblie (diff des specs et tests antérieurs à PL-01) ; aucun `retries`,
  `waitForTimeout` ni délai relevé ; planchers jamais baissés ; `test:artifacts` sous plancher.
- PL-01 : intermittents disparus (cinq passages par spec relevés) ; durée e2e avant et après.
- PL-04 : la parité couvre les deux sens ; identifiants J9T-8 présents.
- PL-05, PL-08, PL-09 : comportement constant prouvé par les tests existants, pas par des tests
  réécrits.
- **En premier** : `GET /v1/bo/alerts` répond 500 (42501 dans `newBrowserSignIns`,
  `apps/api/src/domains/backoffice/alerts/repository.ts`) pendant DS-12b, 3 passages locaux sur 4,
  cas vert (fiche § Mesure PL-12) : cause (PL-05 ou antérieure, `git stash`/`bf1724f` pour
  comparer), et pourquoi aucun test ne le voit.
- PL-01a : brouillon du changement de langue (`peekForLocale`, `discardHandedOver`) couvert par les
  unitaires et `journey-resume`.
- PL-04b : sans argument, `test:db` et `test:unit` contrôlent toujours tous les planchers ; scripts
  `test*` des fronts restés au même défaut (hors chemin prescrit) : gravité à donner.
- PL-11 : `EC-PL-11-1` (résumés de D70 et D72 sans les risques acceptés ni les points DZ) : rien de
  vivant perdu du registre.

## Pour `expert-cybersecurite`

- PL-09 : passe-plat inchangé dans sa logique, un secret interne par front (D64), empreinte
  épinglée là où il vit, T7 et T10 verts, CSP à nonce intacte, aucune valeur Supabase ou Brevo
  dans les artefacts (T11).
- PL-03 : J9S-6 sans état partagé ni fuite d'information dans `/health` ; J9S-7 jamais interprété
  ni cliquable.
- PL-01 : un éventuel `data-hydrated` sans script en ligne ni affaiblissement de la CSP.
- PL-04a : migration `0151` (seule différence avec la contrainte de `0141`) ; `EC-PL-04a-1` (la
  fonction de vérification 2V de `0141` §4 garde la même faille) : gravité à donner.
- PL-04b : `apps/api/scripts/run-tests.ts` ne saute le contrôle des planchers qu'en lancement filtré.
- Puis le texte du commit d'attestation `security-reviewed: <date> covers <sha>…` (D71), à commiter
  en clôture seulement si rien de bloquant ne reste.
