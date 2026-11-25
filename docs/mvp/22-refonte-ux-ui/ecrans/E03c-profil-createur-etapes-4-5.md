# E03 — Profil créateur : assistant, étapes 4 et 5 (créateur)
> Maquette : `proto-profil.html` (`#etape-4` par l’ancre, hors sélecteur et hors relevé commun, mesurée ici à 375, 768 et 1 440 ; état `etape-5`) · comparaison `ecran-3-profil-createur.html` · validée le 2026-11-23, version 2 (07) · Constats : U02, U03, U21, U22, U30
> Cadre commun (en-tête, segments, pied, enregistrement, états, animations) : `E03a-profil-createur-etapes.md`.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|
| E03.4 | Étape 4, Votre audience | idem | idem | `CreatorAudienceFields.tsx` | `#etape-4` | L | C18, E03-Q3, Q7 |
| E03.5 | Étape 5, Votre offre et votre travail | idem | idem | `CreatorOfferFields.tsx`, `CreatorPortfolioBlock.tsx` | `etape-5` | XL | C45, E03-Q3, Q8 |

À préserver : audience complète remplacée en un appel (`PUT /v1/me/creator-profile/networks/{id}/audience`, `creator-profile-api.ts`) ; 4 autres pays au plus, 10 % au moins (`CreatorAudienceFields.tsx:260-329`) ; focus sur la ligne ajoutée ou sur « Ajouter un pays » (`:173-194`) ; « Autres : n % » servi par l'API, jamais calculé (`:113`) ; un droit d'usage dans une seule liste (`CreatorOfferFields.tsx:200-226`, RG73) ; formats des réseaux du créateur d'abord, les autres repliés, UGC en dernier (`creator-profile-options.ts:87-145`) ; date de déclaration de la disponibilité (`:275`) ; portfolio : dépôt, remplacement d'un approuvé, retrait en deux temps, ordre, légende enregistrée à la demande, consentement de marque, refus motivé et date de suppression (`CreatorPortfolioBlock.tsx`, `PortfolioItemCard.tsx`). API portfolio : `GET`, `PUT` `/v1/me/creator-profile/portfolio` ; `PUT /order` ; `PATCH`, `DELETE` `/{id}` ; `GET /{id}/image`. Aucun tarif (D78, D48).

## 2. Structure
- E03.4 : choix du réseau (44 px), puis trois `fieldset` séparés par un filet (`.subgroup` : filet haut, `padding-top` 16), `gap` 24. Grilles `.fgrid` `gap` 24 à 1 440 : pays 2 × 339, âges 4 × 157,5, genres 3 × 218 ; 1 colonne de 343 à 375 (champ 77,7 chacun). Champs nombre 128 × 48 (`--size-input-number`) + « % ».
- E03.5 : formats, disponibilité, portfolio, phrase des coûts, repli ; filet avant disponibilité et portfolio. La légende d'un `fieldset.subgroup` se pose sur le filet (rendu natif, visible à 1 440 et 375).
- Portfolio `.pf` : 3 colonnes égales à toutes les largeurs, `gap` 12 ; vignette 4:3 226 × 169,5 à 1 440, 106,3 × 79,7 à 375 ; tuile d'ajout 4:3, tirets `--color-border-strong`, `--radius-md` (93,4 de haut à 375).
- Droits `.right-row` : texte + segments sur une ligne dès 640 px (X3), l'un sous l'autre en dessous ; filet `--color-border-subtle` ; 69 px à 1 440, 101,8 à 375.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E03.4-S01 | Étape 4 | C22 | choix du réseau en segments, piste étirée à 702 × 44 (343 à 375), actif `--color-surface-active` (X6, X7) | dès 1 ligne | #etape-4 `.seg` | E03.4-CA01 | E03.4-T01 |
| E03.4-S02 | Étape 4 | C18 | « Pays de votre audience » : liste + part 128 px + %, 2 colonnes 339 | toujours | #etape-4 `#a-c1 #a-s1` | E03.4-CA02 | E03.4-T01 |
| E03.4-S03 | Étape 4 | C19 | « Total saisi : {n} % · Autres : {m} % » | toujours | #etape-4 `#sum-c` | E03.4-CA03 | E03.4-T01 |
| E03.4-S04 | Étape 4 | C18 | « Âges de votre audience » : 4 nombres + % + total, sous un filet | toujours | #etape-4 `#age1` à `#age4` | E03.4-CA03 | E03.4-T01 |
| E03.4-S05 | Étape 4 | C18 | « Femmes, hommes et autres » : 3 nombres + % + total, sous un filet | toujours | #etape-4 `#g1` à `#g3` | E03.4-CA03 | E03.4-T01 |
| E03.5-S01 | Étape 5 | C46 | « Formats proposés » : un surtitre par réseau, cases en ligne | toujours | etape-5 `fieldset` 1 | E03.5-CA01 | E03.5-T01 |
| E03.5-S02 | Étape 5 | C21 | « Disponibilité » : 3 boutons radio | toujours | etape-5 `fieldset` 2 | E03.5-CA02 | E03.5-T01 |
| E03.5-S03 | Étape 5 | C45 | « Portfolio » + compte + grille 4:3, légende `--text-xs` ; tuile en tirets « Déposer un visuel » (plus 24 px) | tuile : moins de 8 visuels | etape-5 `.pf` | E03.5-CA03 | E03.5-T02 |
| E03.5-S04 | Étape 5 | C05 | « Les coûts se négocient avec votre commercial. » | toujours | etape-5 `p.sm.c2` | E03.5-CA04 | E03.5-T01 |
| E03.5-S05 | Étape 5 | C26 | repli (3) : Droits d'usage, une ligne par droit, 3 issues en segments (C22) | toujours | etape-5 `.right-row` | E03.5-CA05 | E03.5-T01 |
| E03.5-S06 | Étape 5 | C18 | « Délai de livraison habituel », liste 320 px | repli | etape-5 `#f-del` | E03.5-CA05 | E03.5-T01 |
| E03.5-S07 | Étape 5 | C21 | « Secteurs refusés », cases | repli | etape-5 `fieldset` 3 | E03.5-CA05 | E03.5-T01 |

## 4. Textes
Clés de `apps/web/src/locales/{fr,en}/creator-profile.json`. « X » = à écrire (expert-marketing).

| Élément | FR exact | EN | Clé |
|---|---|---|---|
| E03.1-S08 (étape 4) | Votre audience · Qui vous suit, réseau par réseau. Les marques n'en voient que des tranches. Environ 2 min. · Réseau | X | nouvelle |
| E03.4-S02 | Pays de votre audience · Pays principal · Part dans ce pays | Countries of your audience · X · X | `audience.countries.legend` ; nouvelles |
| E03.4-S03 | Total saisi : {n} % · Autres : {m} % | X · Others: {m} % | nouvelle ; `audience.remainder` |
| E03.4-S04 | Âges de votre audience · 18 à 24 ans · 25 à 34 ans · 35 à 44 ans · 45 ans et plus | Ages of your audience · X | `audience.ages.legend` ; nouvelles |
| E03.4-S05 | Femmes, hommes et autres · Femmes · Hommes · Autres ou non déclaré | X · Women · Men · Other or not declared | nouvelle ; `preview.gender.*` |
| E03.1-S08 (étape 5) | Votre offre et votre travail · Ce que vous proposez, quand, et trois exemples de vos contenus. Environ 3 min. | X | nouvelle |
| E03.5-S01 | Formats proposés · {Instagram} · {Reel, Publication, Story} · {TikTok} · {Vidéo courte, Live} | Formats offered · référence | `fields.formats.label` ; libellés courts par réseau nouveaux (E03-Q8) |
| E03.5-S02 | Disponibilité · Sous moins de 2 semaines · Sous moins d'un mois · Agenda plein | Availability · X · X · Fully booked | `fields.availability.label`, `offer.availability.full` ; 2 nouvelles |
| E03.5-S03 | Portfolio · {2} visuels sur 3 au minimum. Visibles de toutes les marques une fois approuvés. · {3} visuels déposés. Ils seront visibles une fois approuvés. · Déposer un visuel · {titre} · en modération | Portfolio · X · X · Upload a visual · X | `sections.portfolio`, `portfolio.add` ; nouvelles |
| E03.5-S04 | Les coûts se négocient avec votre commercial. | Costs are negotiated with your sales contact. | `offer.negotiation` |
| E03.5-S05 | Facultatif, à compléter plus tard (3) · Droits d'usage · Republication sur les réseaux de la marque · Publicité sponsorisée · Non proposé · Inclus · En option | X | nouvelle (référence : « Repost organique », « Whitelisting publicitaire », « Achat média ») |
| E03.5-S06, S07 | Délai de livraison habituel · De 7 à 14 jours · Secteurs refusés · {Alcool, Jeux d'argent} | Usual delivery time · 7 to 14 days · Sectors you refuse | `fields.*`, `offer.delivery.*`, `reference.sector.*` |

## 5. Interactions, états, responsive, clavier
- **Réseau** : un choix à la fois ; la maquette ne change aucun champ. Cible : les champs de la ligne choisie ; deux comptes du même réseau portent leur pseudo (lu du créateur seul) pour se distinguer.
- **Totaux** : recalculés à la frappe. « Autres » n'est montré que pour les pays. Au-delà de 100 : non montré ; conservé `issues.sum_exceeds_100` (`CreatorAudienceFields.tsx:154-166`), placé sous le total (C19).
- **Formats, secteurs, tons** : case = enregistrement (600 ms).
- **Droit** : choisir une issue retire l'autre ; « Non proposé » = absent des deux listes.
- **Déposer** : la maquette ajoute une vignette (`rise-in` 200 ms) « {titre} · en modération », retire la tuile, annonce « Visuel déposé, en cours de modération. » Réel : sélecteur de fichiers PNG, JPEG, WebP, 8 visuels au plus (`CreatorPortfolioBlock.tsx:29-64`) ; la tuile reste tant que moins de 8.
- **États non montrés**, préservés : audience sans réseau (`audience.noLines`), chargement et indisponibilité des réseaux (`CreatorAudienceFields.tsx:73-89`), liste vide (`offer.noList`), portfolio vide, en chargement, indisponible, plein, dépôt refusé (`portfolio.empty`, `loading`, `unavailable`, `full`, `errors.*`), visuel refusé (`PortfolioItemCard.tsx:366`), remplacement et légende en attente (`:175-190`), profil publié à 3 visuels (`portfolio.minimum`), permission (champs gelés, `creator-profile-view.ts:391`). Représentation proposée : C17 sous le bloc, C19 sous le champ.
- **Responsive** : 1 440 et 1 280 identiques ; 768 : grilles conservées (contenu 662,4) ; 375 : une colonne, portfolio à 3 colonnes, légendes sur deux lignes.
- **Clavier** : flèches dans les groupes de boutons radio et les segments ; la tuile d'ajout est un bouton ; le focus va sur le premier champ d'une ligne ajoutée.
- **Animations** : vignette `rise-in` 200 ms ; repli comme en E03a ; tuile `background-color` 120 ms ; `--ease-standard`.

## 6. Critères d'acceptation
- **E03.4-CA01** Le choix du réseau change de ligne sans perdre la saisie en cours.
- **E03.4-CA02** Pays principal et part obligatoires pour le compte principal seul.
- **E03.4-CA03** Total et reliquat affichés ; jamais complétés ; total > 100 refusé et dit (RG57).
- **E03.5-CA01** Formats groupés par réseau du créateur, UGC et autres réseaux atteignables.
- **E03.5-CA02** Disponibilité obligatoire, date de déclaration affichée (`offer.availabilityDeclared`).
- **E03.5-CA03** Portfolio 4:3, 3 à 8 visuels, toutes les actions de `PortfolioItemCard` conservées ; avertissement de visibilité au-dessus du dépôt.
- **E03.5-CA04** Aucun montant, tarif, net ni pourcentage de commission.
- **E03.5-CA05** Un droit dans une seule issue ; exclusivité et contrepartie non monétaire présentes selon E03-Q3.

## 7. Tests
| ID | Niveau | Fichier | Ce qu'il prouve |
|---|---|---|---|
| E03.4-T01 | unitaire, e2e | `tests/creator-audience-view.test.ts`, `e2e/creator-profile.spec.ts` | totaux, reliquat, > 100 |
| E03.5-T01 | e2e | `e2e/creator-profile.spec.ts` | formats, droits, absence de montant |
| E03.5-T02 | e2e | `e2e/creator-portfolio.spec.ts` (à adapter) | dépôt, remplacement, ordre, retrait, légende |

Attributs à conserver : `data-section`, `data-audience-line`, `data-remainder`, `data-fold`, `data-portfolio-drop`, `data-portfolio-item`, `data-item-state`, `data-state`. `e2e/creator-profile.spec.ts:650` exige l'absence de `data-net-creator` et `data-advertiser-share`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Audience, une carte par réseau | `CreatorAudienceFields.tsx:100` | un réseau à la fois (C22) | faire évoluer |
| Libellés « Part de votre audience… (%) » | `:353`, `:379` | libellés courts sous une légende « … de votre audience » | faire évoluer (E03-Q11) |
| Droits, deux listes de cases | `CreatorOfferFields.tsx:194-228` | une ligne par droit, 3 issues | faire évoluer (même `PATCH`) |
| Délai, boutons radio | `:229` | liste | faire évoluer |
| Portfolio, cartes d'édition | `PortfolioItemCard.tsx:93` | vignettes 4:3 | faire évoluer |
| Avis « vos visuels approuvés… » au-dessus du dépôt | `CreatorPortfolioBlock.tsx:81` | phrase du compte | faire évoluer |

Données requises : titre du visuel | `caption`, facultative | vignette sans légende possible. Format 4:3 | image livrée dans son format d'origine, en base64 (`GET /portfolio/{id}/image`) | recadrage par le front. Réseaux, formats, droits, secteurs | `references` de `GET /v1/me/creator-profile` | servis.
Hors lot : aucun.

## 9. Contradictions, manques et décisions
| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E03-Q7 | Âges, genres, publications, commentaires, identité et expérience montrés « indispensables » ; non obligatoires (RG4, RG56, Q15) | manques faux | suivre `missingRequired` ; les garder visibles, sans les compter comme manques | product-owner | oui |
| E03-Q8 | Confirmation datée des chiffres (`figuresDate` obligatoire, RG50), source et date absentes ; libellés de formats courts sans clé ; actions du portfolio absentes | obligatoire impossible à remplir | « Confirmer mes chiffres », source et date sous les 3 chiffres ; édition du visuel dans un dialogue C27 ; `reference.format.*` en attendant | fondateur, expert-ux | oui |
| E03-Q9 | À 375, « Vérifier mes réponses » déborde : 156 + 240,3 = 396,3 px (etape-5-375) | bouton coupé | « Précédent » réduit à son icône nommée sous 480 px | expert-ux | oui |
| E03-Q11 | Libellés d'audience courts (« 18 à 24 ans », « Femmes ») ; `07` RG55 et `17` §5.2 imposent « part de votre audience âgée de… » | libellé accessible | texte court visible, nom accessible complet (clés actuelles) | product-owner | non |
| E03-Q12 | Segments d'audience : YouTube absent, choix sans effet ; « Autres » absent des âges et genres ; mentions `portfolio.help`, `faceNotice`, `brandConsent` absentes ; légende de `fieldset` posée sur le filet ; X3, X6, X7, X13 | finition | toutes les lignes, reliquat partout, mentions sous le dépôt et dans le dialogue du visuel | expert-ux, expert-conformite-rgpd | non |
