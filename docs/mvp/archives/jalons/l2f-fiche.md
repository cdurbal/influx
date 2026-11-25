# Jalon L2F — Péremption, retrait sous 2V, contestation, identifiant modifié

> **Source :** `jalons/lot2-plan.md` l. 30 (ligne L2F), l. 15 (D34), l. 44 (PLT-5, PLS-5, PLS-6) ; `21` §8 (L2D-E2E, L2ES-2, L2E-US, D83 ; L2ES-3 et EC-L2C-fix-2-2 pris avec L2E-US, même fonction) ; `decisions-detail.md` D83 l. 825-843 · **Préparé le** 2026-11-08 par Claude Code (`/jalon-prepare l2f`) · **Statut :** validé par le fondateur le 2026-11-08 (D83 : A + A-bis ; ligne 03 élargie ; recette réduite) · **Exécution :** `/jalon-run l2f`, table `jalons/l2f/run.md`.

## Objectif et périmètre

Le badge vit. « Audience vérifiée » (90 j) et « Marque vérifiée » (12 mois) passent en « à rafraîchir » puis expirent après 30 j de grâce, par une tâche du worker journalisée comme événement système ; un redépôt ne redemande pas la propriété. Un agent demande le retrait d'un badge avec un motif typé, un administrateur distinct l'approuve (2V, ou forme dégradée) : le badge disparaît aussitôt. Un créateur conteste un refus ou un retrait sous 30 j (file 5, autre personne que le décideur). Un pseudo modifié après vérification ouvre une entrée « identifiant modifié à contrôler » (file 6) : l'agent confirme, ou exige une preuve (« à reconfirmer »). D83 (A + A-bis) : un commercial lance la vérification d'un membre qu'il connaît ; une marque connectée avec une adresse de son domaine n'a aucun geste, un créateur colle un code. Reliquat : L2ES-2, États américains, levier e2e, PLT-5, PLS-5, PLS-6.

**Ne change pas :** portfolio, publication et RG16 (L2G) ; fiche créateur du backoffice (L2G : le bloc badges va sur la fiche de compte `/inscrits/[id]`) ; affichage à un annonceur (Lot 3) ; AL14, RG79, RG80 (EC-L2F-11) ; indicateurs RG68, RG74 (Lot 6bis) ; libellés D34 en hypothèse de `staging` ; aucun montant, taux, net ni tarif.

## Invariants

1. **Péremption = événement système (`03` C(15), TM5.3).** Seule la tâche du worker passe un badge en `to_refresh` puis `expired`, dates comptées depuis la décision (EC-L2E-1) ; registre sans agent, idempotent par période ; rappel J-15 une seule fois. « Compte vérifié » n'expire jamais (RG30, RG71).
2. **Cycle (RG70, RG72, `06` RG54, CA45 à CA48, `06` CA31).** `to_refresh` reste visible, daté, avec sa mention ; à la fin de la grâce le badge disparaît, la ligne publique repasse au déclaré par `profiles.refresh_creator_public_network()` (`0225`), tranche d'engagement masquée ; redépôt sans preuve de propriété tant que l'identifiant n'a pas changé ; nouvelle décision = nouvelle date, ancien badge `replaced`.
3. **Retrait sous 2V seulement (RG75, `03` §3.2 et PD1 à PD7, `15` RG31, TM5.4, CA49).** Aucune fonction ne retire un badge sans une demande 2V confirmée par un administrateur distinct, ou par la forme dégradée (récapitulatif, 60 s, justification, « affaibli » écrit, `degraded_single_operator`) ; consommée une fois, charge comparée entière, expirée à 24 h sans effet. Le seul retrait automatique est la péremption.
4. **Disparition (RG76, CA50).** Badge retiré : ligne publique recalculée dans la transaction, `lead.updated` en file ; aucun historique servi hors du backoffice.
5. **Motifs (RG73, RG74, `06` RG55, CA51, `06` CA32).** Listes fermées : cinq codes créateur, liste marque de `modele.md` ; `influx_error` présente les excuses d'INFLUX et n'accuse jamais le membre ; message au membre là où la table l'exige ; escalade administrateur tenue.
6. **Contestation (RG77, CA52, CA53).** Créateur seul, refus ou retrait, dans `dispute_window_days` (30) depuis la notification, une par décision ; traitée par une autre personne que le décideur dès que l'équipe en compte deux, sinon pas avant 24 h, contrôlé en base ; deux issues ; issue notifiée avec motif ; badge rendu = nouvelle date de décision.
7. **Identifiant modifié (RG78, CA54, L2ES-2).** Le badge reste ; ancien et nouvel identifiant gardés en interne, jamais publics ; une entrée ouverte par ligne ; l'agent confirme (constat écrit) ou exige une preuve : `to_reconfirm`, visible du créateur, jamais actif ailleurs. Tout octroi compare l'identifiant constaté au déclaré (22023 `observed_handle_mismatch`).
8. **Files 5 et 6 (`15` RG27 C1 à C8, RG29, RG36).** Règles des files 1 et 4 : prise atomique, 30 min, prolongation, levée forcée admin, jeton de version, `sla_due_at` figé (5 j ouvrés provisoire ; 1 j ouvré), hors délai décidable et marqué, ni compte propre ni détenu (`queue.conflict_of_interest`), aucune sortie sans décision.
9. **D83 (A + A-bis, tranchée le 2026-11-08).** Même demande, même file, même unicité, mêmes décisions ; origine `agent` et motif fermé portés par la demande ; aucun badge sans constat ; « Audience vérifiée » exclue ; compte propre ou inactif refusé, compte détenu admis (Q4 : l'ouverture, et la décision du détenteur pour une demande `opened_by = 'agent'` seulement, `15` RG36 amendé à la clôture, lecture du code) ; ni lot ni import ; membre informé par e-mail ; second regard a posteriori, le commercial responsable peut valider son client. **A-bis :** le domaine de la marque est prouvé par l'adresse de connexion du compte sur ce domaine, lue par la base, jamais saisie ; messageries grand public exclues (liste en table) ; l'immatriculation reste constatée par l'agent ; le `TXT` et la page restent possibles.
10. **T9.6 tenu (EC-L2E-18).** Aucune table neuve lisible par `influx_advertiser`, `USAGE` compris ; aucune fonction qu'il exécute ne nomme une pièce ni `storage.`.
11. **Sorties (RG91, RG92, RG94, D69).** `VERIFIED_LEVEL` et `VERIFIED_AT` recalculés à chaque changement de badge, baisse comprise ; Apollo : rien ; e-mails transactionnels du worker depuis `email.json`, sans lien, chiffre ni identifiant de réseau.
12. **Journaux (D60, RG99).** Identifiants (ancien, nouveau, constaté), texte de contestation, message de retrait, chiffres : absents de pino, `ops.*`, du registre et des charges `outbox` ; registre : codes et identifiants.
13. **IDOR (T14).** Compte de la session ; contestation, badge, entrée d'autrui : même réponse qu'une adresse inconnue ; le membre ne lit ni verrou, ni agent, ni commentaire interne, ni le nom du décideur.
14. **Droits des personnes (`04` §9).** Contestations, entrées de la file 6, origine D83 dans `privacy.export_document()` et l'effacement ; conservation pseudonyme de `0226`.
15. **Affirmation (RG10, RG93, RG97, D34).** « À rafraîchir », « à reconfirmer » : textes de `08` RG10, l. 715-724, et `17` l. 1465 mot pour mot ; libellé écrit, jamais la seule couleur ; aucun badge global.
16. **Écran.** Tokens, KEO ; FR et EN (backoffice FR, D36) ; WCAG AA ; quatre états (RG95) ; raccourcis au backoffice (RG98) ; aucun stockage navigateur.
17. **Tests.** Aucun attendu affaibli, aucun plancher baissé ; e2e ajouté ≤ 20 s ; suite base complète par migration, une à la fois (L2C-HARNAIS) ; lignes `expected-rights.ts` et marqueur I-4 par migration.

## Lectures

| Ligne | Tranches |
|---|---|
| D83 | `decisions-detail.md` l. 825-843 |
| 01 | `21` §2.3 l. 63-67 ; `archives/jalons/l2e/run.md` § Mesures ; `e2e/verification.spec.ts` (amorces l. 63-140 ; cas l. 184, 422, 546, 713, 854, 1019, 1196, 1362, 1593) ; `e2e/case-floors.ts` ; `packages/test-kit/scripts/sum-e2e-durations.ts` |
| 02 | `archives/jalons/l2e-fiche.md` § Revue (L2ES-2) ; `0224` l. 1185-1290, `grant_audience_verified` (`Grep`) ; `0225` l. 301-350 ; `0217` l. 179-220 |
| 03 | `0221` l. 71, 271-300 ; `0201` l. 278-300, 533-545 ; `set_registry_source` (`Grep`, `0224`) ; `record_refused_action` (dernière définition, `Grep`) ; `archives/jalons/l2e/registres.md` (US) |
| 04 | Fiche entière ; `08` l. 545-620, 715-730, 1056-1091, 1183-1185 ; `06` l. 432-440, 718, 859-863 ; `03` l. 113-135, 233-312 ; `04` l. 1589-1659, 5107 ; `15` l. 268-319, 555 ; `17` l. 1458-1466, 1768 ; `17b` l. 1125-1162, 1597-1640 ; `archives/jalons/l2e/modele.md` ; `archives/jalons/l2c/file.md` A1 à A10 |
| 05 | `modele.md` ; `0221` l. 865-995 ; `0223` l. 104-121 ; `0205` l. 270-330 ; `0225` (`refresh_creator_public_network`) |
| 06 | `modele.md` ; `0130` l. 204-300, 550-800, 986-988 ; `0137` l. 513-516 ; `0141` l. 249-423 ; `0151` l. 61-72 ; `0221` l. 233-269 ; `archives/jalons/pl/revue-constats.md` l. 15, 31, 32 |
| 07, 08 | `modele.md` ; `l2c/file.md` A1 à A9 ; `0221` l. 461-690 ; `0224` (prise, `Grep open_request`) ; `0217` l. 179-220, 513-516 ; `0218` (écriture du handle, `Grep`) |
| 09 | D83 (réponse) ; `modele.md` ; `0222` l. 540-600 ; `0224` (portes agent, `grant_brand_verified`) ; `06` RG51 (`Grep`) |
| 10 | `0226` (par tranches) ; `04` §9 (`Grep`) ; `08` l. 861 |
| 11 | `packages/domain/src/verification/*` ; `packages/contracts/src/verification.ts`, `backoffice-queues.ts` |
| 12 | `domains/maintenance/periodic.ts` l. 1-30, 84, 302-312 ; `verification/verification-email.ts` ; `0227` ; `tests/verification-email.test.ts`, `periodic-scheduler.test.ts` ; `16` l. 796-801 |
| 13 | `backoffice/dual-control.ts` l. 60-80, 213-260 ; `dual-control/repository.ts` ; `actions-dual-control-routes.ts` ; `accounts-routes.ts` |
| 14, 15 | `verification/routes.ts`, `service.ts`, `repository.ts` ; `backoffice/verification-queues-routes.ts`, `verification-queues-decision-routes.ts`, `verification-queues/*` |
| 16 | `db-tests/t9-evidence-unreachable.test.ts`, `t1-anonymisation.test.ts`, `t14-backoffice-route-inventory.test.ts` ; `tests/tm11-identifying-fields.test.ts` ; `18` l. 942-951 |
| 17 | `components/verification/*` ; `17` l. 1458-1466, 1768 ; `08` l. 715-724 ; `06` l. 432-440 |
| 18 | `components/AccountScreen.tsx`, `DualControlScreens.tsx` ; `17b` l. 1125-1162, 1597-1640 ; `e2e/backoffice.spec.ts` l. 612-690 |
| 19, 20 | `QueueTemplate.tsx`, `VerificationQueueScreens.tsx`, `VerificationEntryScreen.tsx`, `bo-nav.ts` l. 45-90 ; `17b` l. 365-555 (tranches) |
| 21 | `verification-registry-routes.ts`, `verification-registry/*` ; écran de `/reglages/sources-registre` |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| 01 | `test(e2e): verification journeys split, states seeded` | L2D-E2E : `verification.spec.ts` en trois fichiers, états amorcés en base | 3 passages, gain mesuré |
| 02 | `fix(db): observed handle compared at the grant` | L2ES-2 (`0228`, I-4) | L2F-D19 |
| 03 | `feat(db): registry sources by subdivision` | L2E-US, L2ES-3, EC-L2C-fix-2-2 (`0229`, I-4) | L2F-D20 |
| D83 | *(décision du fondateur)* | Tranchée le 2026-11-08 : A + A-bis | — |
| 04 | *(arbitrage `architecte`, sans code)* | `l2f/modele.md` : EC-L2F-1 à 16 | — |
| 05 | `feat(db): badge expiry and refresh` | `0230` : tâche, transitions, redépôt, rétention 3 ans (I-4) | TM5.3, L2F-D1 à D6 |
| 06 | `feat(db): badge revocation under dual control` | `0231` : action 2V, porte agent, PLT-5, PLS-5, PLS-6 (I-4) | TM5.4, L2F-D7 à D10 |
| 07 | `feat(db): badge disputes and their queue` | `0232` : file 5 (I-4) | L2F-D11 à D13 |
| 08 | `feat(db): identifier changes and their queue` | `0233` : file 6, ligne supprimée (I-4) | L2F-D14 à D16 |
| 09 | `feat(db): verification opened by an agent` | `0234` : D83, A-bis (I-4) | L2F-D17 |
| 10 | `feat(db): L2F data in the export and the erasure` | `0235` (I-4) | L2F-D18 |
| 11 | `feat(domain): badge lifecycle and dispute rules` | États, fenêtre, motifs, contrats | L2F-U1 à U4, T16 |
| 12 | `feat(api): badge lifecycle task and its e-mails` | Tâche, e-mails, `VERIFIED_LEVEL` | Horloge injectée |
| 13 | `feat(api): badge revocation under dual control` | Badges du compte, demande, vue 2V | T14, TM5.4 par route |
| 14 | `feat(api): disputes and identifier changes` | Membre ; files 5 et 6 | T14, CA52 à CA54 |
| 15 | `feat(api): verification opened by an agent` | D83 | T14, L2F-D17 par route |
| 16 | `test(api): lifecycle and revocation proven` | TM5.3, TM5.4, T9.6, T1, TM11 ×3 | ×3 |
| 17 | `feat(web): badge states, refresh and appeal` | C2, C3, M2 (≤ 6 s) | Unitaires, e2e |
| 18 | `feat(backoffice): account badges and their revocation` | Bloc badges, demande, écran 2V (≤ 5 s) | e2e |
| 19 | `feat(backoffice): dispute and identifier change queues` | Files 5, 6 (≤ 5 s) | e2e |
| 20 | `feat(backoffice): verification opened by an agent` | D83 (≤ 2 s) | e2e |
| 21 | `feat(backoffice): registry sources by subdivision` | Ajout d'une source d'État (≤ 1 s, cas étendu) | e2e |
| U | *(constats `expert-ux`, sans commit)* | 17 à 21 ; 375, 768, 1440 ; FR, EN | `ux-constats.md` |
| F | *(recette du fondateur, réduite)* | `staging` : retrait sous 2V, D83 | `recette.md` |

## Tests

| Identifiant | Niveau | Ce qu'il prouve | Plancher |
|---|---|---|---|
| **TM5.3** | Base (`verification-lifecycle.test.ts`) + unitaire du worker (horloge injectée) | Dates décalées par le test, jamais d'attente : 90 j → `to_refresh`, 120 j → `expired`, ligne publique au déclaré, registre sans agent, « Compte vérifié » intact ; période rejouée sans effet | Bloquant, vert ×3 |
| **TM5.4** | Base (`verification-revocation.test.ts`) + route | Sans 2V, 2V d'un autre badge ou motif, expirée, consommée, confirmée par le demandeur hors forme dégradée : refus ; confirmée : retiré une fois | Bloquant, vert ×3 |
| **L2F-D1 à D6** | Base | D1 J-15 une fois, badge inchangé (CA45) ; D2 `to_refresh` daté, ligne constatée (CA46) ; D3 expiré, déclaré, compte intact (CA47) ; D4 redépôt sans propriété, nouvelle date, `replaced` (CA48) ; D5 marque 12 mois + 30 j (`06` CA31) ; D6 rétention 3 ans | 6 |
| **L2F-D7 à D10** | Base | D7 agent demande, admin distinct confirme, charge entière (CA49) ; D8 disparition, `lead.updated` (CA50) ; D9 chaque motif, message, escalade (CA51, `06` CA32) ; D10 PLT-5, PLS-6 : charge lax refusée à la création | 4 |
| **L2F-D11 à D13** | Base | D11 30 j acceptée, 31 j refusée, une par décision (CA52) ; D12 décideur refusé à deux personnes, 24 h à une ; D13 infirmée : nouvelle date (CA53) | 3 |
| **L2F-D14 à D16** | Base | D14 entrée, badge tenu, identifiants gardés (CA54) ; D15 preuve exigée : `to_reconfirm`, déclaré, reconfirmation ; D16 ligne supprimée | 3 |
| **L2F-D17** | Base | D83 : origine, motif, unicité, refus (propre, inactif, audience ; détenu admis, Q4) ; A-bis : adresse du domaine acceptée, messagerie grand public et autre domaine refusés, immatriculation toujours exigée | 2 |
| **L2F-D18** | Base | Export ; effacement sans résidu (balayage) | 1 |
| **L2F-D19, D20** | Base | D19 constaté ≠ déclaré : 22023 ; D20 source d'État, une active par subdivision, refus d'écriture journalisé | 2 |
| **L2F-U1 à U4** | Unitaire | Libellé de chaque état ; fenêtre ; motifs par niveau ; suite affichée au membre | Chaque RG citée |
| **T9.6, T1, TM11** | Base + routeur, statique | Tables neuves sans droit annonceur ; marqueurs : ancien et nouveau handle, texte de contestation, message de retrait | ×3 ; 3 marqueurs de plus |
| **T14, T2, T16** | Base + routeur, statique | Chaque route neuve, rôle croisé, objet d'autrui ; lignes neuves ; aucun montant | Chaque route, objet et rôle |
| **e2e** | Navigateur | Lignes 17 à 21 : 19 s annoncés ; ligne 01 : couverture intacte, gain mesuré | ≤ 20 s ajoutées |

Fichiers neufs dans `e2e/case-floors.ts` et `db-tests/case-floors.ts` dans le commit qui les crée.

## Critère de fin

- [x] Péremption prouvée et journalisée comme événement système. *Preuve : TM5.3 vert ×3, L2F-D1 à D6 (ligne 16).*
- [x] Retrait refusé sans 2V. *Preuve : TM5.4 vert ×3, L2F-D7 à D10 ; retrait sous 2V sur `staging` (ligne F).*
- [x] Contestation et identifiant modifié traités de bout en bout. *Preuve : L2F-D11 à D16, e2e ligne 19.*
- [x] D83 (A + A-bis) réalisée : un commercial lance la vérification d'une marque connue, qui n'a aucun geste à faire. *Preuve : L2F-D17, e2e ligne 20, ligne F.*
- [x] L2ES-2, L2E-US, PLT-5, PLS-5, PLS-6, L2ES-3, EC-L2C-fix-2-2 soldés ; L2D-E2E : levier appliqué, gain écrit (1,3 s, levier épuisé ; le dépassement reste ouvert, `21` §8). *Preuve : lignes 01 à 03, 06.*
- [x] T9.6, T1, TM11, T14, T2, T16 verts ; suite base verte. *Preuve : CI réelle.*
- [x] e2e ajouté ≤ 20 s, éclats sous 7 min 30. *Preuve : `run.md` § Mesures (19,5 s ; éclats 316, 351, 309 s).*
- [x] `pnpm check` et `pnpm test:e2e` verts ; CI verte. *Preuve : `gh run list --json conclusion`, run 42926484723 `success` sur `988388e` ; local : `pnpm check` vert, `pnpm test:e2e` vert aux passages 2 et 3, deux échecs connus au passage 1 (`backoffice-queue.spec.ts:82` et `:422`, L2ET-6), voir `run.md` § Mesures.*
- [x] Revue soldée, attestation `security-reviewed:`. *Preuve : ligne R, commits d'attestation `988388e` (0241) et `c07e0b0` (0228 à 0240).*

## Écarts, décisions ouvertes, risques

**À trancher en ligne 04 (`architecte`), avec recommandation :**

- **EC-L2F-1 Tâche.** `badge_lifecycle` quotidienne (CA45, CA46 disent « tâche quotidienne »), distincte de `verification_expiry` (horaire) ; J-15 = `expires_at` − 15 j ; marque : même cycle.
- **EC-L2F-2 Événement système.** Sujet `periodic_run` comme `retention.purged` (`0205` l. 282), ou sujet badge sans acteur ; codes `verification.badge_reminded`, `.badge_to_refresh`, `.badge_expired`.
- **EC-L2F-3 Rétention 3 ans (RG100).** Lignes de pièces `purged` supprimées à `findings_retention_days` après la décision ; badges finis (`expired`, `revoked`, `replaced`) : chiffres effacés au même délai après leur fin, ligne gardée pour le registre (recommandé) ou supprimée.
- **EC-L2F-4 2V demandée par un agent.** `request_dual_control` reste admin ; porte neuve `verification.request_badge_revocation(badge_id, reason_code, member_message)` (agent, admin) ; charge `{badge_id, reason_code}` ; message au membre hors charge (table de la demande, montré au récapitulatif, jamais au registre) ; consommation par la fonction de retrait, appelée par l'administrateur qui confirme.
- **EC-L2F-5 Motifs de la marque (`06` RG55).** `forged_evidence`, `terms_breach`, `influx_error` communs ; `company_dissolved`, `domain_transferred` neufs ; `account_closed`, `owner_changed` créateur seul ; colonne `levels` contrôlée au retrait, clé étrangère inchangée ; RG73 reste « cinq » côté créateur.
- **EC-L2F-6 Ligne supprimée** (modele L2E -16). Badges tenus `expired` par le système, cause `line_removed` au registre ; jamais `revoked` (RG73 fermée, pas de 2V pour un geste du membre).
- **EC-L2F-7 Contestation.** `verification.disputes` (`04` l. 1656) + colonnes d'entrée A1 ; motifs fermés proposés `misread`, `evidence_valid`, `reason_wrong`, `other` (texte exigé) ; issues `upheld`, `overturned` ; **aucune pièce jointe** (contre `17` l. 1768 : une pièce neuve passe par une demande) ; texte ≤ 1 000 caractères, sans lien.
- **EC-L2F-8 Fenêtre.** 30 j depuis la notification : `decided_at` du refus ou `revoked_at` ; la marque ne conteste pas (`06` l. 718 : elle corrige et resoumet).
- **EC-L2F-9 Issue infirmée.** Refus : le réviseur tranche le dossier d'origine (pièces gardées 45 j, pensées pour la contestation, Q2), chiffres tapés, octroi à nouvelle date. Retrait : badge rendu à nouvelle date ; audience seulement si l'échéance d'origine n'est pas passée, `expires_at` jamais prolongé.
- **EC-L2F-10 Autre personne.** Un compte interne actif (`agent` ou `admin`) autre que le décideur ; sinon décision au plus tôt 24 h après le dépôt, marquée `single_operator`.
- **EC-L2F-11 Hors périmètre.** AL14 (alerte du commercial), RG79 (chute de 40 %, rafraîchissement anticipé), RG80 : Lot 5, avec les alertes du commercial ; l'e-mail J-15 au créateur est livré ici.
- **EC-L2F-12 File 6.** Table `verification.identifier_change_reviews` (A1), une ouverte par ligne, mise à jour à chaque nouveau changement (historique interne) ; déclencheur sur `handle` seul (RG78 : « pseudo ») ; ancien identifiant = `observed_handle_at_decision` du badge tenu.
- **EC-L2F-13 Décisions de la file 6.** « Même compte » : constat sur l'entrée (identifiant tapé, agent, date), badge jamais réécrit. « Preuve exigée » : « Compte vérifié » et l'audience de la ligne en `to_reconfirm`, ligne publique au déclaré ; la reconfirmation (file 4) rend `active` au compte et son état par dates à l'audience, dont l'échéance court toujours.
- **EC-L2F-14 D83 (A + A-bis).** `opened_by` (`member`, `agent`), `opened_by_account_id`, `opening_reason_code` (`invited_by_agent`, `existing_client`, `past_collaboration`, `other`) ; code `verification.opened_by_agent` ; e-mail « votre commercial a lancé la vérification » ; second regard a posteriori : indicateur au Lot 6bis. A-bis : canal constaté neuf (`login_address`) à côté de `dns_txt` et `web_page`, domaine lu par la base depuis l'adresse de connexion (jamais tapé, jamais rendu au client), liste des domaines grand public en table, immatriculation inchangée ; sans geste de la marque, ni code ni e-mail de code.
- **EC-L2F-15 Adresses.** C3 `…/verification/contestation?decision=<id>` (gardes de EC-L2E-18-1) ; `/files/contestations`, `/files/identifiants-modifies` ; bloc badges sur `/inscrits/[id]` ; 2V sur `/double-validation/[id]` ; `/v1/me/verification/disputes`, `/v1/bo/queues/verification-disputes/*`, `/v1/bo/queues/identifier-changes/*`, `/v1/bo/accounts/:id/badges`.
- **EC-L2F-16 E-mails.** Les six restants de RG94, plus marque (rappel, à rafraîchir, expiré, retiré), preuve à reconfirmer, D83 ; worker et `email.json` (D69), aucun modèle Brevo.

**D83 tranchée** à la validation (2026-11-08) : A + A-bis, Q3 a posteriori, Q4 oui (`decisions-detail.md` § D83). A-bis amende `06` RG51 ; avis `expert-cybersecurite` à la revue.

**Risques.** **Volume : 21 commits contre 8 estimés** (L2E : 25 contre 10). **A-bis :** un salarié du domaine suffit à prouver la maîtrise du domaine ; la base doit lire l'adresse de connexion sans l'exposer. **e2e :** 19 s annoncés ; quatrième dépassement possible, ligne 01 mesure le levier nommé ; aucun plancher baissé. **2V ouverte aux agents :** surface neuve, bornée à une action ; revue sécurité. **Déclencheur sur l'autosave** (L2DS-7, sans limite de débit) : une entrée par ligne, mise à jour. **Équipe d'une personne :** contestation à 24 h, contrôle affaibli dit. **`staging` :** aucun badge n'atteint 90 j avant février ; recette par dates vieillies (D70). **D34 :** libellés en hypothèse, porte `production`. **Autres sessions :** `git add` des seuls fichiers du commit.

**Amendements à la clôture** (code d'abord) : `04` §5.3, §11.2 ; `08` RG9, RG70, RG73, RG77, RG78, RG94, écart 4 ; `06` RG51 (A-bis), RG55 ; `15` RG29 ; `03` §3.2, P7 ; `17` l. 1768 ; `17b` §3.6, §3.13 ; `18` TM5, §10.

## Revue

Fin de jalon (2026-11-11, `c4d21dc..fd92d71`) : **0 bloquant**. Font foi : `l2f/revue-constats-testeur.md` (T), `l2f/revue-constats-securite.md` (S) ; L2FU : `l2f/ux-constats.md` (fix-1, fix-2).

| Id | Gravité | Où | Correctif | Échéance |
|---|---|---|---|---|
| L2FT-1 | jalon | `verification-creator.spec.ts:244-253` | page cible attendue, `reload(page)`, DS-flaky | jalon (fix-4) |
| L2FT-2 | avant prod. | `periodic.ts:273-283` | `badge_lifecycle` par `createPeriodicStore` en base | avant prod. |
| L2FT-3 | avant prod. | `0233:1283` | = L2FS-4 | avant prod. |
| L2FT-4 | avant prod. | `0230:450-522` | cas sous chaque seuil ; `to_reconfirm` à + 29 et + 30 j | avant prod. |
| L2FT-5 | plus tard | `run.md` l. 01 | 264, pas 261 ; levier L2D-E2E épuisé | jalon (C) |
| L2FT-6 | plus tard | `run.md` l. 17-21 | § Mesures, trois passages | jalon (C) |
| L2FT-7 | plus tard | `t1-anonymisation.test.ts:1137` | un 500 par route web, pas un cardinal | plus tard |
| L2FT-8 | plus tard | `verification-lifecycle.test.ts:290` | Apollo à 0 dans `queueOf` | plus tard |
| L2FT-9 | plus tard | `verification-revocation.spec.ts` | e2e « adresse de connexion » (D83) | plus tard |
| L2FT-10 | plus tard | `0230:450-498` | tâche arrêtée > 30 j : cas D3 bis (`product-owner`) | plus tard |
| L2FT-11 | plus tard | job base, 461 s | durée en § Mesures, alerte à 8 min | jalon (C) |
| L2FS-1 | jalon | `0228:235`, `0224:1590` | `0241` : `channel`, `agent_opened`, `responsible_agent` sur `granted`, `rejected` | jalon (fix-3) |
| L2FS-2 | avant prod. | `0234:1166` | liste hebdomadaire des accords d'un agent, revue admin | avant prod. |
| L2FS-3 | avant prod. | `0234:233-242` | liste publique des messageries ; A-bis si ouvert par un agent | avant prod. |
| L2FS-4 | avant prod. | `0228:175`, `0232:1623`, `0233:1283` | `verified_handle_of()` pour les quatre comparaisons | avant prod. |
| L2FS-5 | avant prod. | `0233:519-594` | débit par compte, registre agrégé, décision sans jeton à jour | avant prod. |
| L2FS-6 | plus tard | `0232:509`, `0233:349` | droits agent colonne par colonne | plus tard |
| L2FS-7 | plus tard | `0232:838-853` | détenteur hors « autre personne » | plus tard |
| L2FS-8 | plus tard | `0130:750-766` | dégradé du retrait refusé si un agent peut demander | plus tard |
| L2FS-9 | plus tard | `0233:510-517` | déclencheur fermé (42501) | avant écriture interne du handle |

Avant production et plus tard : reliquat de `21` §8. fix-3 et fix-4 : validés par le fondateur le 2026-11-11.
