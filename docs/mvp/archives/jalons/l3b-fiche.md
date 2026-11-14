# Jalon L3B — La marque rédige sa campagne et la soumet
> Source : `jalons/lot3-plan.md` l. 32 (validé le 2026-11-13) · 2026-11-13 · Statut : validé par le fondateur le 2026-11-13 (« ok pour toutes les questions ») · Annexe : `l3b/annexe.md`

## Objectif et périmètre
Une marque au profil publié crée une campagne (`09` blocs 1 à 7, bloc 8 côté marque), la rédige en
cinq étapes (M3, `17` §4.3), brouillon enregistré seul (RG108), la reprend (CA72), voit « ce que voit
un créateur » (CA68) et la soumet (`draft` ou `rejected` → `pending_review`, RG4). Socle : `0303`
(campagnes, tables filles, référentiels, codes `campaign.*`), `0304` (grille `price_bands`), `0305`
(soumission), `0306` (export et effacement). Dette en tête : L3AS-6, L3AT-6 (« avant `0303` »).
**Hors périmètre :** file 7, publication, instantané, pause, clôture, Brevo (L3C) ; lecture créateur
(L3D) ; création ou correction par un agent (RG1, RG94, CA60, CA61 : L3C, réponse du fondateur) ;
duplication ; `verified_only` (champ absent, RG79) ; plafond de candidatures compté (Lot 4).
**Budget e2e : 25 s** (≈ 25 s au découpage, cible de 20 s dépassée, acceptée au plan).

## Invariants
1. D78 : tranche de budget, budget total, référence interne, déclaration d'autorisations et caractère
   sensible absents de toute charge servie au rôle créateur et de la vue créateur (CA68) ;
   `influx_creator` n'a aucun droit sur aucun objet `campaigns.*` au L3B (TM5.6, niveau droits).
2. D48, T16 : aucun montant ni net affiché au créateur ; aucune opération sur un montant (T16.1) ;
   nets de `price_bands` nuls ; tout montant affiché passe par la seule conversion exemptée (T16.6).
3. RG5 : aucune porte membre n'écrit `published`, `paused`, `closed` ni `rejected` ; la soumission
   est la seule transition membre.
4. Une marque ne lit et n'écrit que ses campagnes ; marque tierce, créateur, identifiant inconnu :
   même code, même corps (T14.1 à T14.4).
5. RG4, RG14 : obligatoires et dates (RG70, RG74) vérifiés par la base à la soumission avec le
   verdict de `packages/domain` (test de parité) ; manquants nommés (CA3).
6. Q16 (`l3b/modele.md`) : tranche obligatoire sauf « dotation seule » (CA76) ; devise sans tranche
   refusée ; aucune fourchette exacte saisie.
7. RG84, RG85 : catégorie sensible → case non pré-cochée exigée ; empreinte du texte exact, langue,
   auteur et instant conservés ; `is_sensitive` jamais recopié sur la campagne.
8. RG21 à RG23, RG45 : aucun champ de fichier ; coordonnée, lien et montant signalés sous le champ,
   jamais bloqués ni modifiés.
9. Tout code d'audit neuf nomme `export_class` (F3) ; `campaign.submitted` est écrit dans la
   transaction de la soumission.
10. Effacement d'un compte annonceur : campagnes traitées selon `09` l. 993 et `modele.md` ; export
    « mes données » à jour.
11. Fonction `SECURITY DEFINER` neuve : propriétaire de la liste fermée de `03` P7,
    `search_path = ''`, `REVOKE … FROM PUBLIC`, `GRANT` nominatif ; signalée I-4 avec tout `GRANT`,
    politique ou objet `audit.*`.
12. D74 : « Campagnes » en colonne, pages en sous-menu ; FR/EN ; WCAG AA ; tokens KEO seuls.
13. Aucun plancher baissé ; tout fichier de test base neuf est déclaré dans
    `apps/api/db-tests/shards.ts` et `case-floors.ts`, tout fichier e2e dans `apps/web/e2e/case-floors.ts`.

## Lectures
Commun à toutes les lignes : cette fiche ; `09` l. 1-6 (bandeaux D48, D78) ; `l3b/modele.md` dès A.
Chemins de `docs/mvp/` abrégés (`09`, `04`…) ; migrations par leur numéro.
| # | Tranches principales (le prompt complète) |
|---|---|
| 01 | `archives/jalons/l3a/f3.md` ; `04` l. 573-751 ; `t8-privacy-execution.test.ts` l. 1392-1515 |
| A | `09` §A l. 148-242, tableaux de champs, l. 706-755, 786-825, 894-1008, 1453 ; `04` l. 1676-2068, 5398-5416 ; `03` l. 316-341, 818-1010 |
| B | `09` l. 478-577 ; `04` l. 493-560 ; `0201` l. 299-360 ; `18` l. 759-795 |
| 02 | `modele.md` ; `04` l. 1676-2068 ; `0202` (patron) ; `expected-rights.ts` |
| 03 | `tranches.md` ; `0201` l. 299-360, 551-580 ; tests T16 et référentiel |
| 04 | `09` tableaux RG16 à RG76, l. 282-302 ; `17` l. 794-801, 854-857 ; `packages/domain/src/` |
| 05 | `0203` ; `09` l. 171-175, 706-715, 1013-1027, 1143-1191, 1227-1230 |
| 06 | `0302`, `0245` l. 1-156 ; t8 l. 2016-2275 |
| 07, 08 | `apps/api/src/domains/profiles/` ; `packages/contracts/src/` ; `09` l. 786-825 |
| 09 à 11 | `17` l. 131, 315-325, 788-865 ; `09` l. 825-893 ; `components/brand-profile/`, `member/ui/` |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `test(db): pin the export allowlist by name before the Lot 3 codes` | `export_class` dans les tableaux de codes des Lots 3 à 5 de `04` ; L3A-T5 nominatif, témoin `excluded_third_party`. |
| A | arbitrage `architecte` (grille `expert-database`) | `l3b/modele.md` : Q16, champ → colonne, droits, gel, porte, projection créateur, export et effacement. |
| B | arbitrage `expert-paiement-facturation` | `l3b/tranches.md` : devises, grille contiguë par devise, nets nuls, libellés. |
| F1 | fondateur | Validation de la grille (arrêt). |
| 02 | `feat(db): 0303 campaigns core written by the brand under RLS` | Types, référentiels, campagne et tables filles, RLS et droits de colonne, codes `campaign.*`, Drizzle, T2. |
| 03 | `feat(db): 0304 load the price band grid per currency` | Grille validée, contiguïté (L2AT-5), T16.4 et référentiel à jour. |
| 04 | `feat(domain): campaign rules shared by the form and the API` | Obligatoires par étape, conditionnels, dates, limites, détection coordonnée, lien, montant. |
| 05 | `feat(db): 0305 brand submission of a campaign` | Manquants (parité), porte de soumission, RG85, `campaign.submitted` ; L3AS-3 si échu. |
| 06 | `feat(db): 0306 campaigns in the data export and the erasure` | `privacy.*` recréées depuis `0302`, campagnes ajoutées. |
| 07 | `feat(api): brand campaign drafts, autosave and submission` | `/v1/me/campaigns` : liste, création, lecture, autosave, soumission ; T14. |
| 08 | `feat(api): the creator view of a brand's own campaign` | CA68 sur charge brute ; T1 rejoué (inventaire, balayage créateur). |
| 09 | `feat(web): my campaigns and the campaign form, steps 1 to 3` | Entrée « Campagnes », liste, étapes 1 à 3, autosave, reprise ; e2e ≤ 9 s. |
| 10 | `feat(web): campaign budget, calendar and submission steps` | Étape 4 sous D78, étape 5, soumission, case RG85 ; e2e ≤ 9 s. |
| 11 | `feat(web): what a creator sees, the brand's preview` | Aperçu rendu de la seule réponse de 08 ; e2e ≤ 7 s. |

Puis U (`expert-ux`), F2 (recette `staging` du fondateur), R (revue groupée), C (clôture).
