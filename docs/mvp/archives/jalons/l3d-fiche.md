# Jalon L3D — Le créateur parcourt le fil des campagnes ouvertes et lit une fiche sans montant
> Source : `archives/jalons/lot3-plan.md` l. 34 (validé le 2026-11-13) · 2026-11-18 · Statut : validé par le fondateur le 2026-11-18 (« oui aux 3 questions » : Q1 à Q3 de l'annexe comme recommandé) · Annexe : `l3d/annexe.md`

## Objectif et périmètre
Tout créateur authentifié (profil en tout état sauf suspendu : RG13, RG23, `09` RG99) ouvre
« Campagnes » : le fil chronologique des campagnes ouvertes (mode serré, `00` §9 point 1), deux tris
(RG33), pagination explicite plafonnée (RG21, RG36), nombre affiché avant la liste (RG35), une carte par
campagne (RG15 au pilote). La fiche C6 sert l'instantané publié (L3C) et le profil marque publié lu
vivant, sans coordonnée ni montant. Visibilité calculée en base, lecture de fiche journalisée (RG22),
débit par compte (CA18). Migration `0314` ; la recherche passe à `0315` et suivants (EC-L3D-1).
**Hors périmètre :** filtres C1 à C7, RG27 à RG32, CA11 à CA14 (Lot 6bis) ; candidature, C7, RG44, RG46,
condition 5 de RG14, état de candidature sur la carte, CA1 hors lecture (Lot 4) ; « réservée aux
vérifiés » (`09` Q10) ; compteur de vues côté marque (RG40) ; fourchette, devise, net (D78, D48) ;
recherche de créateurs (L3E). **Budget e2e : 15 s** (Q2).

## Invariants
1. D48, D78, `CLAUDE.md` §2 : aucune réponse servie à un créateur ne porte montant, devise, tranche,
   budget total, valeur de dotation, référence interne, note, commercial responsable, agent,
   sensibilité, déclaration, état interne, nombre de candidatures ou de vues : absents, pas même vides
   (RG11, RG37, RG38, CA4, CA10) ; la nature de la rémunération est suivie de « À négocier avec votre
   commercial ».
2. D46, `06` RG38 : aucune coordonnée de la marque (prénom, e-mail, téléphone, page de contact) ; la
   fonction de l'interlocuteur est servie (CA5) ; le bloc marque sort de `brandPublicViewOf()`
   (`profiles/brand-public-view.ts`), jamais d'une copie.
3. Visibilité en SQL, jamais seulement à l'écran (RG8) : `published` avec instantané courant, profil
   marque `published` et compte `active` (RG11), date limite et fin de période non dépassées (jour UTC),
   secteur non refusé par le créateur, en silence (RG42, CA8) ; candidatures closes depuis moins de
   7 jours : carte grisée, sans fiche (RG26, CA9) ; brouillon, à valider, en pause, clôturée, refusée :
   dans aucune réponse (RG100, TM5.2).
4. TM5.6 : `influx_creator` ne reçoit aucun droit sur `campaigns.*` ni `profiles.advertiser_*` ; il lit
   par porte `SECURITY DEFINER` (`03` P7, `search_path = ''`, `REVOKE … FROM PUBLIC`, `EXECUTE`
   nominatif, aucun `execute` dynamique) ; signalé I-4 avec tout `GRANT`, politique ou objet `audit.*`.
5. La charge d'une campagne est l'instantané publié (`campaign_creator_view()`), passé tel quel au
   contrat zod strict ; la carte sert exactement les champs de RG15 au pilote, jamais la fiche entière.
6. T14 : campagne inconnue, non visible, en pause, d'une marque suspendue : même code, même corps
   (« n'est plus ouverte », RG24) ; rôle marque ou agent : route inconnue ; profil créateur suspendu :
   refus (RG23).
7. RG21, CA18, T15.3 à T15.5 : page plafonnée et débit par compte appliqués par `apps/api`, valeurs en
   table ; dépassement refusé et journalisé avec le compte ; identifiant opaque (RG39).
8. RG22, RG40, RG101 : chaque lecture de fiche est journalisée (compte, campagne, instant), jamais
   servie ni notifiée à la marque.
9. RG5, RG34, D11 : ordre chronologique seul (RG33), départage stable par identifiant (CA17), aucun score.
10. Écrans C5, C6 : KEO, D74, FR/EN, mobile d'abord (RG115), états de RG112 et de `17` l. 1598-1603,
    WCAG AA, tokens seuls ; aucun moyen de contacter la marque (`09` RG81) ; aucun bouton de candidature.
11. T1 rejoué côté créateur : balayage de toutes les routes, marqueurs de contact de la marque et bloc
    interne de la campagne absents ; contrôle positif (titre et brief servis).
12. Aucun plancher baissé ; tout fichier de test neuf déclaré dans `db-tests/shards.ts` et
    `case-floors.ts`, ou `e2e/case-floors.ts`.

## Lectures
Commun : cette fiche ; `11` l. 3-5 (D48, D78) ; `l3d/modele.md` dès A ; `archives/jalons/l3b/modele.md`
§6 et `archives/jalons/l3c/modele.md` §2, §5 (noms en vigueur). Chemins de `docs/mvp/` abrégés.
| # | Tranches principales (le prompt complète) |
|---|---|
| 01 | `21` l. 227 (L3C-DB) ; `db-tests/campaign-publication-kit.ts`, `stale-fixtures.ts` ; `e2e/support/campaign-states.ts` l. 39-98 |
| A | `11` l. 154-403, 774-833, 950-1010, 1283-1301 ; `09` l. 160-224, 792-831 ; `17` l. 315-325, 1550-1617 ; `03` l. 316-341, 818 ; `04` l. 2109-2137, 5869, 6009, 6236-6251 ; `18` l. 286-330, 731-755, 947-951 ; `00` l. 504-507 |
| 02 | `modele.md` ; `0305` l. 665 et suivantes ; `0308` ; `0217` l. 374-390 ; `0206` (réglages) |
| 03 | `campaigns/routes.ts` l. 60-110, `creator-view.ts` ; `profiles/brand-public-view.ts`, `brand-logo.ts` l. 306-346 ; `platform/public-rate.ts` ; `t1-anonymisation.test.ts` l. 1-60, 1555-1606, 1700-1756 |
| 04 | `17` l. 1550-1603 ; `11` l. 232-249, 298-300, 337-356 ; `lib/member-nav.ts` l. 25-41, `member-paths.ts` |
| 05 | `17` l. 1605-1617 ; `09` l. 356-360, 406-410, 675-683, 877-879 ; `CampaignPreviewScreen.tsx`, `campaign-preview-view.ts` |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `test: published campaign fixtures carry the creator view; stale ones swept` | Dette L3C-DB : instantanés de fixture réels au lieu de `'{}'`, campagnes publiées des runs antérieurs closes avant les suites locales. |
| A | arbitrage `architecte` (grille `expert-database`) | `l3d/modele.md` : porte de lecture, visibilité, carte et fiche, tri et pagination, débit, journal, routes, page web, index, numéro. |
| 02 | `feat(db): 0314 the creator's read of the open campaigns` | Portes `SECURITY DEFINER` du fil, de la fiche et du logo ; visibilité en SQL ; journal RG22 ; réglages ; index ; TM5.2. |
| 03 | `feat(api): the creator's campaign feed, record and brand logo routes` | Contrat strict, routes créateur, débit par compte, T14, T15 (CA18) ; T1 rejoué côté créateur. |
| 04 | `feat(creator): the feed of open campaigns` | Entrée « Campagnes », écran C5 (cartes, tris, « Voir la suite », grisées, états) ; e2e ≤ 8 s. |
| 05 | `feat(creator): the campaign record, without application` | Écran C6, rendu partagé avec l'aperçu de la marque, encarts RG32, RG40, « n'est plus ouverte » ; e2e ≤ 7 s. |

Puis U (`expert-ux`), F (recette `staging` du fondateur, Q3), R (revue groupée), C (clôture).
