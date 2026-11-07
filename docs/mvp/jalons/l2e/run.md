# Exécution du jalon L2E

| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | opus | high | expert-database | fait | I-4. L2DS-1 : autorité `^[A-Za-z0-9.-]+(:[0-9]{1,5})?$` avant la comparaison d'hôte, base (`0220`, 23514 `_profile_url_shape`) et domaine ; `staging` : 0 ligne fautive |
| 02 | 02.md | commit | sonnet | high | testeur | ignoré | L2D-E2E : < 20 s regagnables sans perte de couverture (10 à 13 s, `journey-resume` non simulable) ; dépassement accepté par le fondateur (option a, comme L2C et L2D), aucun plancher baissé ; référence 366,9 s médiane (3 passages, 242 cas) |
| 03 | 03.md | arbitrage | opus | xhigh | architecte | fait | D82 : relais généralisé, 8 Mio sur la seule route de dépôt, aucune URL signée, lecture journalisée par la base ; `modele.md` : trois propriétaires, l'annonceur sans droit sur le schéma `verification` (EC-L2E-18, T9.6 précisé) |
| 04 | 04.md | arbitrage | sonnet | high | expert-integrations-api | fait | `registres.md` : UE (27) par e-Justice, AU et SG admises, 8 pays « à confirmer » inactives, GLEIF en repli ; US : GLEIF puis liste d'États vide ; KR, MX, AE, MA, ZA : GLEIF seul |
| 05 | 05.md | commit | opus | high | expert-database | fait | I-4. `0221` : 7 tables RLS forcée, aucune écriture directe, `influx_advertiser` sans aucun droit sur `verification` (`USAGE` et privilèges par défaut compris, assertion de fin) ; file 4, 15 paramètres RG100, 41 sources (8 « à confirmer » inactives) ; badge de compte sans échéance |
| 06 | 06.md | commit | opus | high | expert-database | fait | I-4. `0222` : portes créateur (`influx_creator_verification_definer`, neuf) et marque (`influx_identity_definer`, aucun droit sur les pièces), bornées au compte de la session ; code `INFLUX-` + 8 sur 31 signes sans entrée, ancien révoqué dans la transaction ; RG12 à la soumission, RG14, RG60 calculé sur les demandes (aucune table de compteurs) ; bloc interne sans droit aux créateurs ni à `influx_leads_definer` ; l'annonceur toujours sans `USAGE` sur `verification` |
| 07 | 07.md | commit | opus | high | expert-database | fait | I-4. `0223` : compartiment privé 8 Mio WebP, quotas 6/demande, 18 et 64 Mio/jour ; pièce `purging` à l'annulation ou `evidence_too_wide` (déclencheur, population créateur seule, -18), date recalculée à la décision, jamais une `active` avant échéance ni d'une demande `pending` ; purge : ligne `purged` gardée ; tâche `verification_expiry` horaire ; logo inchangé |
| 08 | 08.md | commit | opus | high | expert-database | fait | I-4. `0224` : `influx_verification_definer` (neuf) ; aucune décision sans verrou tenu (`lock_held_request`, 55P03), compte propre, brouillon ou détenu 42501 ; jeton recalculé, `minor` sans jeton ; code comparé, jamais rendu au dossier ; second constat d'un identifiant : refus `ownership_not_proven`, deux demandes escaladées (issue, pas d'erreur) ; `read_evidence` journalise `evidence_viewed` ; sorties décision et `lead.updated` sans handle ni chiffre |
| 09 | 09.md | commit | opus | high | expert-database | fait | I-4. `0225` : ligne publique dérivée du badge d'audience tenant (`active`, `to_refresh`), sinon du déclaré ; portée toujours déclarée, engagement seulement constaté ; L2DS-2 fermée par construction (`creator_social_accounts.figures_source = 'declared'` contraint) ; historique `agent_observed` écrit par la décision ; retour au déclaré de L2F = `refresh_creator_public_network()` (EXECUTE `influx_verification_definer`) ; aucune valeur exacte en `creator_public_*` |
| 10 | 10.md | commit | opus | high | expert-database | fait | I-4. `0226` : clé `verification` dans `creator_profile` et `advertiser_profile` (15 catégories inchangées), ni pièce, code, constat, agent, commentaire ni déclaré à la décision ; effacement : demandes ouvertes annulées (pièces en `purging` par le déclencheur de 0223), textes et verrou vidés, codes et bloc interne supprimés, badges tenants `revoked` `account_closed`, handle `[deleted]`, référence nulle ; historique `agent_observed` supprimé avec l'historique (0219) ; politiques d'écriture bornées à un compte effacé |
| 11 | 11.md | commit | sonnet | high | dev-react-node | à faire | |
| 12 | 12.md | commit | sonnet | high | dev-react-node | à faire | |
| 13 | 13.md | commit | opus | high | dev-react-node | à faire | I-4 (passe-plat) |
| 14 | 14.md | commit | sonnet | high | dev-react-node | à faire | |
| 15 | 15.md | commit | sonnet | high | dev-react-node | à faire | EC-L2C-3 |
| 16 | 16.md | commit | sonnet | high | expert-integrations-api | à faire | L2CT-8, L2CS-8 |
| 17 | 17.md | commit | opus | high | testeur | à faire | T9.6 ×3 |
| 18 | 18.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 5 s |
| 19 | 19.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 4 s |
| 20 | 20.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 3 s |
| 21 | 21.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 2 s |
| 22 | 22.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 4 s |
| 23 | 23.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 2 s |
| U | ux.md | ux | sonnet | high | expert-ux | à faire | 24 réservé à un `fix` issu de U |
| F | recette.md | fondateur | — | — | — | à faire | Premier badge d'audience daté sur `staging` |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
