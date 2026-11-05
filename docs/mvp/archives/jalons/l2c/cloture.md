# Clôture du jalon L2C

Grille `testeur`. **Prérequis :** lignes 19 et R à `fait`, `fix-1` à `fix-3` soldées (et `B`, si `fix-3` l'a
ajoutée, tranchée par le fondateur), CI verte.
1. Cocher chaque case de la fiche § Critère de fin, preuve à côté. Une case sans preuve : arrêt.
2. Lancer `pnpm check`, puis `pnpm test:e2e` trois fois : ajout selon `21` §2.3 point 1, somme par
   `packages/test-kit/scripts/sum-e2e-durations.ts` (`fix-3`) sur `test-results/e2e-report.json`, notée dans `run.md`
   avec la décision de la ligne `B` s'il y en a une ; durées CI des jobs « Browser journeys » (par éclat) et « Database
   tests » notées, décision de `e2e.md` tenue.
3. Amendements groupés (EC-L2C-1 à EC-L2C-7, `file.md`) : `04`, `06`, `15`, `16`, `03` à jour, code d'abord dit ici ; `06` Q11 reste à
   `product-owner`.
4. `03` P7, signatures du 2026-11-05, mot pour mot de `revue-constats-securite.md` § Signatures, réserves comprises :
   l. 896 `influx_identity_definer` (ajouts L2C `0207`, `0209`, `0210` §8, sous L2CS-3) ; l. 908 `influx_leads_definer`
   (`0211`, `0212`) ; l. 912 `influx_privacy_definer` (`0207`, « à signer … à la revue de fin de L2C » remplacé) ; l. 913
   `influx_moderation_definer` (`0210`, `0211`, `0213`, et la migration de `fix-2` ; sous L2CS-1, soldé par `fix-2`, et
   L2CS-2).
5. `21` §8 : reliquat soldé retiré (PLK-1, PLS-7, L2BS-1, L2BS-7 ; L2BS-8, L2BT-3, L2BT-7 si traités) ; **L2B-CI retirée**
   (dérive close : deux éclats depuis 14a, `ffd607c`, 300 à 440 s par éclat ; la surveillance passe à L2CT-5) ; lignes de
   § Reliquat ajoutées ; CA22 (RG71, Lot 5) en « avant production » ; une ligne de clôture : « **L2C** (file 1,
   modération du profil marque, migrations `0206` à `0214` et celle de `fix-2`) : ouvert le 2026-11-03, **clos le ...** ;
   `archives/jalons/l2c-fiche.md`, `archives/jalons/l2c/run.md` ».
6. `CLAUDE.md` §9 et §10 si une décision a été prise. `lot2-plan.md` : rien d'autre.
7. Revue soldée : commit d'attestation séparé, `git commit --allow-empty -F <fichier>`, texte de § Attestation, sans
   réécrire `main`.
8. Fiche et dossier vers `docs/mvp/archives/jalons/` par `mv`, puis `git add` des seuls chemins concernés (jamais
   `git mv` : autres sessions) ; constats renvoyés par `archives/jalons/l2c/`. Commit `docs(mvp): close the L2C milestone`.
   Push, suivi de CI.

## Attestation (texte de `expert-cybersecurite`, revue du 2026-11-05)

Seul ajout au texte de la sécurité : `<fix-2>`, remplacé par le sha complet du commit de `fix-2` (I-4, correctif de
L2CS-1) ; ligne d'attribution du système en fin.

```text
chore(security): attest the end-of-L2C review

Group review of 2026-11-05 (expert-cybersecurite) over the L2C milestone
(e177d7d..1ceb507), no blocker; findings in
docs/mvp/archives/jalons/l2c/revue-constats-securite.md. The last sha is
the fix-2 migration (L2CS-1).

security-reviewed: 2026-11-05
security-reviewed: 2026-11-05 covers 4196b56777f94611d23904938cc1e52921a6fe5e 2c96b024123e673004af8649da538629a40a5ff1 386b220af4ed9fa06a2c13b12d8368143ab49ae3 ef5fb18c2620d9b43f0d6731022a0ee3598b9989 9252534fae5ff2c0b07e2ab02b62d93c6b59fc4e c585596a9291aca6695ae018f336535dd05ef9a0 665c4f18cc4bfcb855d9e681b6c599420b323236 85105ac941ed4a2d82274227850d55e5905aa557 ffd607cb556c279712d023eb8d83c21bd57799be 5b52301f95e9e08aae183ef6265995827d3f908d
```

## Reliquat

Lignes à ajouter à `21` §8 (`| # | Correctif attendu | Échéance | Détail |`). Détail : `archives/jalons/l2c/`
(`-T` = `revue-constats-testeur.md`, `-S` = `revue-constats-securite.md`). Soldés dans le jalon : L2CT-1 à L2CT-3,
L2CT-6, L2CT-7 (`fix-1` à `fix-3`), L2CS-1, L2CS-2, L2CS-3, L2CT-4 (`fix-2`) ; L2CT-9 : rappel, sans ligne.

*Avant production :*

| fix-2 | Relecture courte de la migration de `fix-2` (L2CS-1 à L2CS-3, L2CT-4) par `expert-cybersecurite` : son sha rejoint l'attestation sans avoir été relu à la revue | Avant production | `-S` |
| L2CT-5 | « Browser journeys » : éclat 1/2 à 406-440 s pour un arrêt à 450 s (≈ 20 s par ligne d'écran) ; rééquilibrer (trois éclats, ou `backoffice.spec.ts` à part) | Avant L2D | `-T` |
| EC-L2C-15-1 | Libellés membres tirés de RG9, RG10, absents de RG84 (`status.revisionRefused`, `review.*`, `logo.review.*`, `fieldErrors.emptied`, `statusText.published`, `suspended`) : relus avec les textes D48 (`21` §5.8) | Avant production | `run.md` ligne 15 |
| L2C-09 | Rejeu d'une ligne transactionnelle déjà envoyée en défaut : journal `leads.transactional_sends`, `provider_message_id` unique (`0015` l. 83) | Avant production | compte rendu de L2C-09 |

*Plus tard :*

| L2CT-8, L2CS-8 | CA42 (`tests/brevo-connector.test.ts:2244-2261`) tautologique : valeurs dans le doublé ou test retiré ; au L2E, nom commercial dans sa colonne, `organization_name` d'Apollo lu de là, test RG80 | L2E | `-T`, `-S` |
| L2CS-4 | `submit_own_advertiser_revision` aux contraintes de la colonne cible (domaine RG17, bornes, secteur actif), 22023 | Plus tard | `-S` |
| L2CS-5 | Message « Autre » refusé en 400 par le `LINK_PATTERN` de RG158, partagé | Plus tard | `-S` |
| L2CS-6 | Index d'expression `normalized_brand_name(legal_name)`, `lower(website_domain)` sur `published` | Avant le Lot 3 | `-S` |
| L2CS-7 | `lead.updated` : dernière ligne en attente par `(subject_key, destination)`, ou plafond par compte | Plus tard | `-S` |
| EC-L2C-18c-1 | « Page précédente » perdue après rechargement d'une page ≥ 3 (seule « Première page ») | Plus tard | `run.md` ligne 18c |
