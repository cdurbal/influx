# Exécution du jalon L3G
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | opus | high | expert-database | fait | 0327 : moteur lancé alias connu ou non, masqué non retiré, verrou par compte attendu 1 s (55P03), moteur avant le verrou |
| 02 | 02.md | commit | sonnet | high | testeur | fait | 5 courses à 2 connexions committées, verrou tenu jusqu'à 2 attentes vues : une servie, une refusée, lignes exactes ; plancher 5 |
| 03 | 03.md | commit | sonnet | medium | dev-react-node | fait | 30 écritures/min par adresse sur 6 routes, 429 avant session ; 55P03 devient 429 rate_limited Retry-After 1 ; plancher 22 |
| D38 | annexe.md | fondateur | — | — | fondateur | fait | « oui aux 4 questions » (2026-11-20) : Q2 de l'annexe, ouverture globale, seuils 30 et 5 en table, alerte seule, admin + pair, interrupteur fermé |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | modele.md : propriétaire agent neuf, E5 affichée, E6 gardée ; prefill_diff ; file 9 à 6 motifs de la liste A ; AL65 neuf ; réglages en 2V, pair seul |
| 04 | 04.md | commit | opus | xhigh | expert-database | fait | 0328 : porte agent, admin seuls ; moteur 2e requête sous son propriétaire, ni G ni couche I au propriétaire marque ; nombre exact, journal nominatif |
| 05 | 05.md | commit | opus | high | expert-database | fait | 0329 : F1, F3, F4, F6 pays, F8, F11 du brief admis, codes seuls ; proposé journalisé, prefill_id appelant < 24 h ; prefill_diff ; ni tranche ni budget |
| 06 | 06.md | commit | opus | high | expert-database | fait | 0330 : prise atomique 30 min, relâche, prolongation, clôture 6 motifs (note ssi other), 55P03 sans prise ; RG36 42501 ; AL23 ; ni outbox ni matching |
| 07 | 07.md | commit | opus | high | expert-database | fait | 0331 : jour UTC remplacé (publiés E1,E3,E4 ; cherchables +E2), ni search_settings ni couche I ; AL65 sur cherchables, AL22 > 20 % de 20 sur 7 j ; veille gardée |
| 08 | 08.md | commit | opus | high | expert-database | fait | 0332 : 2 écrivains consomment une 2V search.* confirmée par un autre admin avec R ; sans pair, ni demande ni mode dégradé (42501) ; kits inchangés |
| 08b | 08b.md | commit | opus | high | expert-database | fait | 0333 : read_search_settings() (key, value) des dix clés, admin aal2 seul (42501 sinon) ; aucun droit de table ni de colonne, rien écrit |
| 09 | 09.md | commit | sonnet | high | dev-react-node | fait | 2 routes /v1/bo, agents et admin seuls ; campagne ou prefill inconnus 404 (EC-1) ; page_cap 400 après COMMIT ; réglage absent 503 ; planchers 15 et 7 |
| 10 | 10.md | commit | sonnet | high | dev-react-node | fait | file 9 : 6 routes, 42501 → 404, 55P03 → 409 claim ; AL22/23/65 ; 2V search.* pair seul (409 no_peer_admin) ; GET réglages admin ; planchers 13 et 9 |
| 11 | 11.md | commit | sonnet | high | testeur | fait | tm12-identified-view : 13 portes, 9 routes 404 membre/401, aucun export, T14 ; T1 +4 (inventaire, membres, sans session, contre-test) ; planchers 4 et 36 |
| 12 | 12.md | commit | sonnet | high | dev-react-node | fait | rail Créateurs, BoIdentifiedFrame (barre 4 px), blocage en phrase seule, aucune case ni tarif ; FR seul (D36) ; 13 unitaires, E1 x3 ≤ 2,9 s ; planchers 13 et 3 |
| 13 | 13.md | commit | sonnet | high | dev-react-node | fait | file 9 : prise, clôture motivée (note ssi Autre), message dir=auto sans bidi ; réglages en 2V, no_peer_admin dit ; AL22/23/65 libellées ; E2 cas 2 ≈ 6,5 s |
| U | ux.md | ux | sonnet | high | expert-ux | fait | 0 bloquant · 8 jalon · 7 avant prod · 3 plus tard ; invariants tenus ; sans rendu (revue sur le code) |
| fix-1 | fix-1.md | fix | sonnet | high | dev-react-node | fait | J1-J8 : focus au compte sans remontage, FR (listes, Clôturée), 2V valeur actuelle puis demandée ; aucune route ni base ; planchers 16, 10, 8 |
| 14 | 14.md | commit | opus | high | expert-database | fait | 0334 : index (owner_agent_id) non partiel ; les 2 s : GET comptes internes, la vue attend le verrou de session ; POST ≈ 60 ms ; E2 6,4 → 2,2 s ; aucun droit |
| F | recette.md | fondateur | — | — | fondateur | fait | « je valide la recette » (2026-11-21) après semis ; 1re passe < 15 s ×3 ; durées de la rejouée et file 9 non données |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | 0 bloquant · jalon : T1 T2 T3 S1 · avant prod : 6 · plus tard : 14 (`annexe.md` § Revue) |
| fix-2 | fix-2.md | fix | sonnet | high | dev-react-node | fait | classifyError : 55P03 de délai de verrou → 429 Retry-After 1 pour les 5 portes, doublons locaux ôtés, autres 55P03 inchangées ; planchers +5 base, +2 unité |
| fix-3 | fix-3.md | fix | sonnet | medium | testeur | fait | L3GT-1 : l'afterAll de l'e2e supprime `lg_search_block` après party_blocks ; L3E-T4 verte sans nettoyage manuel ; aucun plancher touché |
| C | cloture.md | cloture | sonnet | medium | testeur | fait | Lot 3 clos : check 22:35 et e2e 296 verts, staging 0327-0334 interrupteur faux, D38 reportée, I-4 attestée (10 SHA), jalon et lot archivés |

## Mesures de clôture
Mesures du run CI 44955936546 (sur `a747548`, verte après `gh run rerun --failed`, « Migrate staging » vert ; `eac67be`, `test(test-kit): raise the static scan timeout to 60 s` (EC-L3G-C-1), non encore poussé à la clôture) :
- Éclats base : 5:14 (1/2) et 6:24 (2/2), job entier, pile comprise, + fusion 19 s ; limite 8:00 tenue, seuil d'arrêt de 7:15 non atteint ; écart de 70 s entre éclats, au-delà des 30 s de la règle EC-L3F-3 (rééquilibrage au reliquat, L3GT-10 ; en-tête de `shards.ts` rafraîchi).
- Éclats e2e : 4:12 (1/3), 3:32 (2/3), 3:49 (3/3, mesure de la relance) + fusion 21 s. Job statique : 2:37.
- Intermittences e2e en CI, sans lien avec le diff, vertes après `gh run rerun --failed` : `backoffice.spec.ts:730` (J8T-7, run 44953644360, push `31d87a6`) et `verification-backoffice.spec.ts:43` (axe, run 44955936546, push `a747548`, éclat 3/3).
- Lecture SQL de `staging` (D70, lecture seule, 2026-11-21) : migrations `0327` à `0334` appliquées (dernière `0334`) ; `search.search_settings` `is_open_to_advertisers` = faux (mis à jour le 2026-11-20 à 16:07 UTC), `critical_mass_thresholds` = 30 profils et 5 par thématique, `identified_view` = 20 par page, 10 pages ; `search.supply_counters` : lignes du 2026-11-21 (global, thématiques, pays).
- Passage local de clôture (2026-11-21, base remise à zéro, Chromium de Playwright installé pour l'occasion) : `pnpm check` vert en 22 min 35 s (typecheck, lint, unitaires, build, artefacts ; suite base 150 fichiers, 3 943 cas en 929 s sur une seule pile) ; `pnpm test:e2e` 296 cas verts (6,7 min), plancher e2e tenu.
- L3G-E1 et L3G-E2 par spec, local, un seul worker : E1 2,8 s + 2,2 s + 2,3 s (7,3 s, ≤ 9 s) ; E2 4,1 s (≤ 6 s) ; le second cas de E2 vit dans `backoffice.spec.ts` (8f3eb81), non isolé.
- Temps ajouté à la base par le jalon : éclats CI 5:14 et 6:24 contre 6:34 et 5:34 à la clôture de L3F (somme des deux 11:38 contre 12:08, soit - 0:30) : le jalon n'a pas alourdi le job au-delà de la marge ; 0334 : E2 6,4 → 2,2 s.
- Recette F (fondateur, 2026-11-21) : « je valide la recette » ; première passe < 15 s sur trois campagnes (1, 0 et 0 créateur compatible) ; semis de 8 créateurs synthétiques (option A), rejouée validée sans durées ni retour sur la file 9 : aucune durée de la rejouée n'est consignée (L3GT-3).
- EC : EC-L3G-C-1 (timeout de balayage statique à 60 s) ; EC-D85-1 (nom de l'homonyme de l'EC-L3G-1 de D85 dans `21`, `04` et `decisions-detail.md`, `0327` et l'annexe inchangés) ; EC-L3G-C-2 (le Chromium de Playwright manquait sur le poste, installé pour `pnpm test:e2e`).
- Fondateur : lancer `git check-ignore -v .operator-secrets/x` (refusé aux agents) et effacer le mot de passe et le lien de `staging` après usage ; ajouter à `CLAUDE.md` §4 « et `apps/backoffice/src/styles/tokens-backoffice.css` pour les jetons `-bo-` » (A6).
