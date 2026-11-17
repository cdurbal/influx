# L3C-X5 — `fix(backoffice): publish a sensitive campaign alone, optional second opinion`
Grille `dev-react-node`. Skills : `backoffice-ops`, `design-system-influx`. D84 ; dépend de X4
(`0313` commité). Sonnet `high` ; un passage à opus `high` se décide par `escalade X5`, jamais ici.
**Lire :** `decisions-detail.md` § D84 ; `modele.md` « Amendement D84 » ; en-tête de `0313` ;
`campaign-queue-decision-routes.ts` l. 1-20, 160-230 ; `contracts/src/campaign-review.ts`
l. 255-280, 440-460 ; `campaign-review-view.ts` l. 40-80 ; `CampaignReviewEntryScreen.tsx`,
`CampaignReviewDecision.tsx` ; `messages/fr.ts` l. 2760-2770, 3555-3580, 3705-3712 ;
`campaign-review.spec.ts` l. 173-245 ; `17b` l. 1243-1293.
**Livrer :**
- routes : `first-review` = demande facultative d'un second avis (même chemin, même corps) ;
  `publish` sans refus `enhanced_review_required` ; réponses T14 identiques ;
- contrat : `review.phase` sans phase bloquante (`single`, `second_opinion` : avis demandé) ;
  `firstOpinion` servi au seul titulaire du verrou, demandeur compris ;
- `/files/campagnes` et fiche : bouton principal toujours « Publier » ; « Demander un second avis »
  secondaire et facultatif (secteur sensible) ; avis demandé : demandeur et avis lus, l'entrée se
  reprend ; plus de « Transmettre au 2ᵉ examinateur » ; six états (CA74), D74, WCAG AA, tokens KEO ;
- marque, `publish.sensitiveNotice` (`apps/web/src/locales/{fr,en}/campaign.json` l. 38), sans
  « deux personnes » : « La catégorie de ce produit demande une revue renforcée, ce qui peut
  allonger l'examen. » / « This product category calls for an enhanced review, which may lengthen
  the review. » ;
- e-mails : aucun concerné (invariant 5), à vérifier.
**Ne pas toucher :** `supabase/**` (X4) ; `brand-campaign.spec.ts` (24,2 s, à ne pas allonger).
**Prouver :** `campaign-review-route`, `t14-campaign-review-route`, `campaign-review-view.test.ts`
réécrits sur D84 sans retirer de cas ; e2e cas l. 173 réécrit (publiée seule ; avis demandé puis
publiée par un collègue), même nombre de cas (`e2e/case-floors.ts` l. 20 : 4) ; spec **≤ 7,6 s**
(médiane de trois), budget L3C 18 s inchangé. Planchers recalculés, baisse justifiée.
`pnpm check:fast` ; `pnpm --filter @influx/api test:db -- db-tests/campaign-review-route.test.ts db-tests/t14-campaign-review-route.test.ts --reporter=dot` ;
`pnpm --filter @influx/web exec playwright test e2e/campaign-review.spec.ts --reporter=line`.
**Commit :** un seul ; `git add` nominatif, jamais `-A` ; planchers : sa seule part ; note : médiane
e2e. Dernière ligne : `ETAT`.
**Arrêt si :** X4 pas `fait` ; changement de base nécessaire ; spec > 7,6 s ; libellé neuf autre
que `sensitiveNotice` côté marque.
