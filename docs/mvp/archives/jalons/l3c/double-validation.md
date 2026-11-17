# L3C — double validation facultative (D84 proposée)
> `chef-de-projet`, 2026-11-16, recette L3C. Rien d'inscrit ailleurs.

## 1. Inventaire
**L3C en cours**
- `09` RG85 point 2, CA56, CA57 (RG85 dispensait l'admin, EC-L3C-4 l'a inclus) ; `17b` §3.8 ; `15` l. 298, 358 ; `04` §5.4, §11 point 10.
- `0307` : `first_reviewed_*`, `open_campaign_review_entry()` refusée au 1er examinateur, `campaign_enhanced_review_minutes` ; `0312` : masquage.
- `0308` : `first_review_campaign_entry()`, `publish_campaign_review_entry()`, `assert_enhanced_review()`, instantané, `campaign.first_reviewed`.
- Routes `…/entries/:id/first-review|publish` (`campaign-queue-decision-routes.ts`).
- Écran `/files/campagnes` : `CampaignReviewEntryScreen`, `campaign-review-view.ts` (`review.phase`), `messages/fr.ts`.
- E-mails : aucun (invariant 5).
- Tests : `campaigns-publication`, `campaign-review-route`, `campaign-review-view` ; e2e `campaign-review.spec.ts` l. 173.
- L3B : `publish.sensitiveNotice` FR, EN (« deux personnes »).

**Lots antérieurs, en `staging`**
- D51, `CLAUDE.md` §3 ; `08` RG75, CA49 ; `06`, `07` (retrait sous 2V) ; `18` TM5.4.
- `0231` (L2F) : `request_badge_revocation()`, `revoke_badge()`, `open_|consume_dual_control_for()` : l'agent demande, seul un admin confirme ; fiche du compte, `/double-validation/:id`, tests `verification-revocation`.
- Mécanisme 2V : `03` §1.3 PD7 (F-6, S-8), `15` RG9, CA72, `17b` §3.13.c ; `0130` `confirm_dual_control()` : pair obligatoire dès un second admin ; `t8-dual-control*`.
- Administration sous 2V (`0130` à `0137`) : `grant_role`, `invite_admin`, `change_apollo_setting`, `approve_data_request` ; métier : `change_member_role` (`0132`).

**Non construit** : `03` §3.1, §3.5 (suspension, plafonds, CGU, pièces, affaire, envois), `15` M3, M5, MFA-6, `16` l. 662. **Hors champ** (une personne décide) : D50, D72, D83, `08` RG77, `12` l. 1353, RG15.

## 2. Lecture de « facultatif »
- **A** Réglage `campaign_second_review_required`, faux par défaut : vrai rétablit l'obligation, contraire à « aucun cas ».
- **B, recommandée** Second avis à la demande, jamais bloquant : le titulaire publie seul ; « Demander un second avis » (temps 1 livré) reste un choix ; un collègue publie ou refuse ; le demandeur peut reprendre la main. Sans réglage.
- **C** Sans second examen : perd le facultatif voulu.

Effets de B : publieur toujours nommé (RG93, C(7)) ; 1er examinateur si avis demandé ; mode `single` ou `second_opinion` au registre ; conflit d'intérêts inchangé (`15` RG36 ; CA58 est le verrou). Secteur sensible sur un seul regard : restent la déclaration de la marque (RG85 point 1) et une revue a posteriori (6bis). Délai 2 j : valeur en table.
**Garde-fous maintenus** : rien sur son compte ou un compte détenu ; toute action seule journalisée nominativement ; admin et agent séparés par leurs droits (`15` RG108) ; récapitulatif, re-authentification (PD1, PD3) ; bris de glace jamais décideur ; revue hebdomadaire (PD6).
**À savoir** : `CLAUDE.md` §3 cite D51, à corriger d'abord ; `expert-cybersecurite` a lié `03` à PD7 et tient un veto (`04` §11 point 10) : son avis en R, sinon arbitrage explicite du fondateur (D71) ; `09` Q6 reste au Lot 6 ; commission non touchée. Badge : l'octroi se fait déjà seul ; un retrait seul expose le créateur à l'erreur (contestation RG77).

## 3. Décision : D84 (dernière : D83)
**Sujet** : double validation dans les cas d'usage métier. **Arbitre** : fondateur. **Statut** : à valider. **Échéance** : avant la reprise de L3C-F ; D51 avant `production`.
**Énoncé (2026-11-16)** : « Nous sommes une toute petite structure et demander la validation de 2 agents pour une campagne ne doit pas être obligatoire, ça serait une trop forte contrainte et une surcharge de travail. On peut garder les doubles validations en facultatif. Pour aucun cas d'usage métier il ne peut y avoir de double validation obligatoire. »
**Lecture** : B ; badge, `change_member_role` et 2V métier des Lots 4 à 6bis : Q2 ; administration : Q3.

## 4. Plan de reprise
Ordre : D84 inscrite (`decisions*.md`, `CLAUDE.md` §3, §9), X3, X4, F reprise, R, C ; puis DV.
- **X3** `fix(db): 0313 one-person enhanced review, optional second opinion` : publication seule en sensible, reprise par le demandeur, `0312` rouvert, déclencheur sur la déclaration, mode au registre ; L3C-T3 réécrit. `expert-database` opus high, noms fixés par `architecte`.
- **X4** `fix(backoffice): one-person enhanced review, optional second opinion` : routes, `review.phase`, `sensitiveNotice`, cas e2e l. 173 réécrit (même nombre, 7,6 s au plus). `dev-react-node` sonnet high.
**Caduc** : F l. 7 ; R l. 10 (CA57 « même personne refusée ») ; C point 4, EC-L3C-4 (remplacé par D84 dans `09`, `17b`, `15`, `04`).
**Critère de fin** : le 1er devient « publiée par une personne, déclaration exigée, second avis respecté si demandé » ; migrations jusqu'à `0313` ; invariant 2 réécrit ; e2e 18 s (17,4 pris) inchangé.
**Jalon à part DV** (avant le 1er 2V du Lot 5) : `product-owner` (specs, `03` avec `expert-cybersecurite`), `architecte` opus xhigh (pair facultatif), `expert-database` opus high (`0130` à `0231`), `dev-react-node` sonnet high, revue groupée.

## 5. Questions au fondateur
1. Campagnes : option B ? oui / non (A).
2. Badge : un agent retire seul (re-authentification, motif, membre notifié, contestation), pair facultatif ? oui / non (admin seul).
3. Rôles internes, invitation d'admin, second facteur, exécution RGPD, base légale Apollo : contrôle par les pairs dès un second admin (PD7) maintenu ? oui, recommandé / non.
