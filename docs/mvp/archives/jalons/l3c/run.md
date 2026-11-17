# Exécution du jalon L3C
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | high | testeur | fait | dates des tests dérivées du jour UTC (+10/25/32/60 j), aucun attendu changé ; e2e 24,9/24,5/24,8 s, médiane 24,8 <= 25 |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | rôle neuf influx_campaign_review_definer ; avis en texte ; interventions en table ; reprise d'une paused ≠ publication (RG3, RG8) |
| 02 | 02.md | commit | opus | high | expert-database | fait | 0307 : rôle influx_campaign_review_definer, file 7 (1 j ; 2 j renforcée), RG15 sous verrou consultatif, RG95 alerte, garde en liste fermée (L3BS-2) |
| 03 | 03.md | commit | opus | high | expert-database | fait | 0308 : instantané = vue créateur (CHECK sans clé interne), deux personnes en sensible, verrou vivant et jeton exigés ; e-mail et lead dans la transaction |
| 04 | 04.md | commit | opus | high | expert-database | fait | 0309 : cycle posé par déclencheur (origine = rôle écrivain), reprise ≠ publication, clôture irréversible ; interventions immuables, ancienne et nouvelle valeur |
| 05 | 05.md | commit | opus | high | expert-database | fait | I-4. 0310 : export sans agent, avis ni commentaire ; journal L3BS-5 acteur INFLUX ; effacement vide les textes ; leads : codes seuls, Apollo date |
| X1 | fix-1.md | fix | opus | high | expert-database | fait | I-4. 0311 : campaign.decision journalisé sous son code de catalogue (email_code, template_ref) ; charge sans code : 22023 ; signature et droits inchangés |
| 06 | 06.md | commit | sonnet | high | expert-integrations-api | fait | CA70 sans tranche ni texte ; sans consentement skipped ; clôture auto quotidienne. EC-1 date Apollo en étiquette, EC-2 compteur 0, EC-3 minor_audience à relire PO |
| X2 | fix-2.md | fix | opus | high | expert-database | fait | I-4. 0312 : 3e clause jamais NULL ; open lue avant l'avis, masquée à son seul auteur ; ni GRANT ni fonction. Base : 1 échec, de 07 (T7.3, brief requis) |
| 07 | 07.md | commit | sonnet | high | dev-react-node | fait | /v1/bo/campaigns : avis servi au seul titulaire du verrou ; budget par clé de libellé seule ; compte détenu 403 journalisé, inconnu ou propre 404 |
| 08 | 08.md | commit | sonnet | high | dev-react-node | fait | écran file 7 + fiche : phase single/first/second, responsable exigé, avis 20-1000 ; budget par libellé seul ; marque suspendue lue au refus 409 ; e2e 7,6 s |
| 09 | 09.md | commit | sonnet | high | dev-react-node | fait | fiche, correction d’un champ hors montants, pause/reprise/clôture motivées, brouillon pour marque ; e2e 4,8 s ; EC-1 : pas de liste des campagnes par marque |
| 10 | 10.md | commit | sonnet | high | dev-react-node | fait | routes pause/reprise/clôture (404 identique, 409 règle nommée) ; motif de refus servi (followUp) ; pause d'INFLUX non reprenable ; e2e 5,0 s |
| U | ux.md | ux | sonnet | high | expert-ux | fait | 0 bloquant, 0 jalon, 12 avant production, 8 plus tard (ux-constats.md) ; L3CU-1 : fiche campagne sans porte d'entrée (EC-L3C-09-1) |
| X3 | fix-3.md | fix | sonnet | high | dev-react-node | fait | anneau + point plein text-secondary ; valeurs 8,7:1 ; e2e médiane 6,5 s (avant 7,6) ; captures apps/web/test-results/x3/ ; EC-1 case en rond, EC-2 sans opacity |
| X4 | fix-4.md | fix | opus | high | expert-database | fait | I-4. 0313 : sensible publié seul (déclaration exigée), avis facultatif lu de tous, repris par son auteur ; review_mode au registre ; recherche à 0314 |
| X5 | fix-5.md | fix | sonnet | high | dev-react-node | fait | D84 : Publier seul même en secteur sensible, second avis facultatif, next exclut l'entrée rendue ; e2e médiane 7,3 s |
| F | recette.md | fondateur | — | — | fondateur | fait | « je valide la recette » (fondateur, 2026-11-17) ; constat 1 (2026-11-16) : radios grisés illisibles → X3 ; constat 2 : D84, pas de double validation obligatoire → X4, X5 |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | revue : 0 bloquant ; 3 jalon (L3CT-1 à 3, L3CT-3 en C) ; sécurité : autorisé sous conditions, L3CS-1 à 3 avant production |
| X6 | fix-6.md | fix | opus | high | dev-react-node | fait | validé fondateur 17/11 ; afterAll hors cas (55-270 ms), base inchangée ×3 ; médianes E1 7,55 E2 5,05 E3 6,14 L3B 26,6 s > plafonds, corps inchangés |
| X7 | fix-7.md | fix | sonnet | high | dev-react-node | fait | 9 describe préfixés L3C-T6 (5 fichiers) et 4 L3C-T7, titres seuls ; cas 15/17/10 inchangés, planchers intacts ; T9.6-A en timeout sous charge, vert seul |
| C | cloture.md | cloture | sonnet | medium | testeur | fait | « clôture avec réserves » (fondateur) ; critères 1, 3 (staging), 7 non prouvés ; T7.3 et next build en reliquat ; attestation 09d058c |

## Mesures de clôture (2026-11-17)
**CI, dernier run 44157039696 (success, « Migrate staging » compris, production sautée)** : contrôles
statiques, tests unitaires, build 2 min 51 ; **éclats base** 3 min 39 et **4 min 15** (le plus long),
contrôle fusionné 30 s, soit 4 min 45 pour 8 min ; **éclats e2e** 3 min 41, **4 min 08** (le plus long),
3 min 24, fusion 18 s, pour 7 min 30 ; « Migrate staging » 29 s. Éclats CI tenus.

**Local (ce poste, ~20 % plus lent qu'aux lignes 08 à 10)** :
- `pnpm check` : formats, types, lint et tests unitaires (planchers tenus) verts ; build et artefacts non atteints (la chaîne s'arrête au premier rouge) ; suite base
  3 474 verts sur 3 475 en 798 s, **un rouge** : `db-tests/campaign-review-route.test.ts:275` (L3C-T7.3,
  filtre d'alerte : une entrée propre figure dans la liste filtrée), **vert seul** (21 cas, 15 s) ;
  contrôle des planchers de la base non atteint (échec avant). Lié à la base grossie (reliquat L3C-DB).
  Total 16 min 13 s.
- `pnpm test:e2e` : **non exécuté**, le build de `apps/web` est refusé par Next.js (avis de sécurité,
  `SecurityFatalError`) ; aucune mesure e2e locale neuve, rien purgé à la main.
- Cas e2e ajoutés : 9 (E1 4, E2 2, E3 3). Dernières médianes locales (X6) : E1 7,55 s, E2 5,05 s,
  E3 6,14 s, `brand-campaign.spec.ts` 26,6 s ; E1+E2+E3 = 22 s avec ou sans X6, contre 17,1 s à la fin des
  lignes 08 à 10.
- **Plafonds e2e de la fiche** (E1 7,6 s, E2 5 s, E3 5 s, `brand-campaign.spec.ts` 25 s, L3C 18 s) :
  **non tenus en local sur ce poste, éclats CI tenus, décision du fondateur : remesurer en CI par spec
  ou relever les plafonds** (`21` §8, L3C-E2E).

**Réserves de clôture (fondateur, 2026-11-18, « clôture avec réserves »)** : critères 1, 3 (moitié `staging`) et 7 non prouvés (relevé `staging` en lecture seule, plafonds e2e) ; `db-tests/campaign-review-route.test.ts:275` (T7.3) échoue en suite base complète locale, passe seul ; `next build` local refusé (`SecurityFatalError`, avis de sécurité de Next.js). Reportés au reliquat de `21` §8.
