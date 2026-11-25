# L3C-X4 — `fix(db): 0313 one-person enhanced review, optional second opinion`
Grille `expert-database`. Skill : `supabase-schema`. Signalé I-4 (politique et `SECURITY DEFINER` recréées). D84 fait foi.
**Lire :** `decisions-detail.md` § D84 ; `double-validation.md` §2 (B), §4 ; `modele.md` « Amendement D84 », §3, A3 ;
`0307` l. 236-256, 455-471, 763-870 ; `0308` l. 120-146, 247-291, 476-740 ; `0312` ; tests :
`campaigns-review-queue.test.ts` l. 347-386, 837-940 ; `campaigns-publication.test.ts` l. 938-1180.
**Livrer :** `supabase/migrations/0313_campaign_one_person_review.sql`, `create or replace` à
signature, propriétaire, `EXECUTE`, `search_path` identiques :
- `assert_enhanced_review()` : sensible ⇒ déclaration seule (23514 `enhanced_review` gardé) ;
- `publish_campaign_review_entry()` : étape (4) retirée, ni second compte ni premier examinateur ;
  registre `campaign.published` + `review_mode` (`single` ; `second_opinion` si un avis demandé
  est suivi de la décision d'une autre personne), publieur et demandeur (déjà portés) nommés ;
- `first_review_campaign_entry()` : demande facultative d'un second avis, jamais bloquante ; avis
  20-1 000, verrou rendu, `not_enhanced_review`, `first_review_given` gardés ; commentaire refait ;
- masquage retiré (A3 caduc) : `lock_held_campaign_review_entry()`, `open_campaign_review_entry()`
  sans refus du demandeur ; politique `campaign_review_entries_internal_select` aux deux premières
  clauses de `0307` ; entrée lisible par tous, le demandeur la reprend et décide ;
- CHECK `campaign_review_entries_two_persons` (`0307` l. 253) et
  `campaign_published_snapshots_two_persons` (`0308` l. 144) retirés ;
- inchangés : `campaign_enhanced_review_minutes` (2 j), conflit d'intérêts (`15` RG36), verrou
  (CA58), `correct_campaign_field()` ; en-tête : D84, rollback ; assertions de fin.
**Ne pas toucher :** `0307` à `0312` (poussées, jamais réécrites) ; routes, contrat, écrans (X5).
**Prouver :** L3C-T2, L3C-T3 réécrits sans retirer un cas utile : l. 938 (CA57) → publiée seule,
agent et admin ; l. 976, 1019, 1069 → avis demandé, lu par tous, publié par un collègue ou repris
par le demandeur ; instantané et registre (`review_mode`, demandeur) ; un agent seul journalisé ;
l. 1153 → sans déclaration seule ; l. 837, 889 → lisible par tous. Planchers `db-tests/case-floors.ts`
l. 11 et 13 recalculés, toute baisse justifiée dans le commit. Cas rougis par la seule `0313` dans
`campaign-review-route` (l. 640-730) et `t14-campaign-review-route` (T14.4) : attendu au plus juste
ici ; contrat (`phase`, `firstOpinion`) à X5. `pnpm check:fast` ;
`pnpm --filter @influx/api test:db -- --reporter=dot` (suite base entière : migration, D76).
**Commit :** un seul ; `git add` nominatif, jamais `-A` ; `case-floors.ts` : n'indexer que sa part ;
`git diff --cached --name-only` = migration, tests, `case-floors.ts`, `run.md` ; note `I-4. …`
(recherche à `0314`). Dernière ligne : `ETAT`.
**Arrêt si :** signature ou `GRANT` à changer ; corps en vigueur autre que `0307`, `0308`, `0312` ;
un cas de conflit d'intérêts ou de verrou change d'attendu.
