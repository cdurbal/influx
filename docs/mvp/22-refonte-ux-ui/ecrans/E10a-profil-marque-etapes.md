# E10 — Profil de marque, étapes 1 à 3 (marque)
> Maquette : `proto-profil-marque.html` (états etape-1, etape-2, etape-2-vide, etape-3) · page de comparaison `ecran-10-profil-marque.html` · validée le 2026-11-24 (07, « Écran 10 ») · Constats : U22, U23, U29, U03, U63, U59
> Suite (vérifier, envoyé, liste de tâches, modification) et questions E10-Q14 et suivantes : `E10b-profil-marque-suite.md`. L'assistant est celui de `E07a-campagne-etapes.md` §2 et §5 ; seules les différences sont décrites.
## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E10.1 | Étape 1, Votre marque | `/fr/compte/profil` (`?step=1` à créer) | `/en/account/profile` | `BrandProfileScreen`, `IdentityFields`, `LogoField` | etape-1 | XL | C41, E07a |
| E10.2 | Étape 2, Ce que vous cherchez | idem (`?step=2`) | idem | `ExpectationFields` | etape-2, etape-2-vide | L | C23, C46 |
| E10.3 | Étape 3, Votre interlocuteur | idem (`?step=3`) | idem | `ContactFields` | etape-3 | M | C24 |

`/compte/profil` est partagée : `AccountProfileScreen` choisit selon le rôle ; un créateur voit E03, jamais ces écrans (test `brand-profile.spec.ts`, « a creator finds its own profile »).
À préserver (`apps/web/src/components/brand-profile/`) :
- `notFound()` hors rôle annonceur (`BrandProfileScreen.tsx:76-82`) ; focus du premier manque (`:194-203`) ; enregistrement automatique, reprise, perte évitée (`use-brand-profile.ts`) ; état poussé à la coque par `adopt` (`:91-97`).
- Logo : PNG, JPEG ou WebP, 2 Mo, 256 px au moins ; aperçu seulement après ré-encodage par l'API ; remplacer, **retirer**, réessayer ; 12 messages d'erreur ; nom de fichier jamais montré (`LogoField.tsx:1-8`, `use-brand-logo.ts`).
- Pays en lecture (« se modifie dans Mes informations ») ; site réduit au domaine avec message (`website.normalized`) ; détection RG19 de coordonnée dans la présentation (`errors.contactInPublicText`) ; champs modérés signalés (`review.regime`, `review.pending`) sur un profil publié.
- API : `GET`, `PATCH /v1/me/brand-profile` ; `GET`, `PUT`, `DELETE /v1/me/brand-profile/logo`.

## 2. Structure
- Coque C56 ; rubrique Compte, sous-menu « Mon profil de marque » (courant) et « Mon compte ». Cadre C41 de 768, padding 32 (E07a §2). Aucun lien retour en tête ; `wz-head` 123,3 px à 1440 (242 à 375).
- `segs` : 3 colonnes (231,3 px à 1440) ; compteur « Étape n sur 3 » ; temps : 8 min au total, 5, 1.
- Étape 1 : en-tête 100,4 (titre, phrase, badge) ; logo 127,9 ; nom 106,5 ; `fgrid--3` (3 × 218) ; présentation 213,4 (zone 125,2) ; repli 53. Hauteur du cadre 1 101 (1440) ; page 1 706 (375).
- Étape 2 : en-tête 125,2 ; Thématiques 124,8 ; Réseaux et formats 302,7 (157,2 vide) ; `fgrid--2` (2 × 339, « Ajouter » sous la liste) ; Langues 124,8 ; repli. Cadre 1 329,1 ; 1 183,6 (vide) ; 1 948 à 375.
- Étape 3 : en-tête 63,8 sans badge ; `zone-int` 702 × 304,9, contenu 668, `fgrid--2` 322 + 322 ; repli interne. Cadre 691,7 ; `zone-int` 343 × 453 à 375.
- Logo : `logo-up` flex, gap `spacing-4` ; pastille 64 × 64 (`radius-md`), vide en pointillé `border-strong` ; bouton étiré à la largeur du texte sous lui (381,5) ; à 375, bouton pleine largeur sous la pastille.
- 1280 : cadre 768 ; 768 : 712,4 (contenu 662,4) ; grilles à partir de 640 px (X3) ; 375 : une colonne. Pied fixe sous 768 (E07a §2).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E10.1-S01 | Cadre | C01, C41 | Assistant 768, 3 segments, sans lien retour | E10.1 à E10.4 | etape-1 `form.wz` | E10.1-CA01 | E10.1-T02 |
| E10.1-S02 | Tête | C41 | `h1` « Création de votre profil de marque », 20 px | création | `#wz-title` | E10.1-CA02 | E10.1-T01 |
| E10.1-S03 | Tête | C41 | Compteur « Étape n sur 3 » | étapes | `#wz-count` | E10.1-CA02 | E10.1-T01 |
| E10.1-S04 | Tête | C13 | Badge « Brouillon » + phrase de confidentialité | brouillon | `.wz-name` | E10.1-CA02 | E10.1-T01 |
| E10.1-S05 | Tête | C41 | Segments : fait et courant verts, incomplet ambre, à venir désactivé | E10.1 à E10.4 | `#segs` | E10.1-CA03 | E10.1-T01 |
| E10.1-S06 | Tête | C41 | Temps : 8 min au total, 5 min, 1 min restantes | étapes | `#wz-time` | E10.1-CA02 | E10.1-T01 |
| E10.1-S07 | Tête | C11 | « Il manque n informations · voir la liste » ou « Tout est renseigné » | étapes | `#to-check` | E10.1-CA03 | E10.1-T01 |
| E10.1-S08 | Tête | C11, C17 | « Enregistrer et reprendre plus tard » et sa notice | étapes | `#later`, `#later-note` | E10.1-CA04 | E10.1-T01 |
| E10.1-S09 | Tête, pied | C25 | Statut d'enregistrement ; tête sous 768, pied au-dessus | étapes | `[data-save]` | E10.1-CA04 | E10.1-T01 |
| E10.1-S10 | Pied | C10 | Précédent (étapes 2, 3) ; principal « Continuer : {étape} » ; étape 3 « Vérifier mon profil » | étapes | `.wz-foot` | E10.1-CA05 | E10.1-T01 |
| E10.1-S11 | Étape | C02 | `h2` et phrase avec durée | étapes | `.wz-step > header` | E10.1-CA02 | E10.1-T01 |
| E10.1-S12 | Étape | C14 | « Public : visible des créateurs une fois le profil publié » | étapes 1 et 2 | `.layer` | E10.1-CA06 | E10.1-T01 |
| E10.1-S13 | Aperçu | C11, C05 | « Aperçu » : carte de marque 544 max, suit la saisie | étapes 1 et 2 | `[data-preview]`, `.pv .bcard` | E10.1-CA07 | E10.1-T01 |
| E10.1-S14 | Logo | C33, C18 | Libellé, aide, pastille vide 64 pointillée ou logo | toujours | `#logo-up` | E10.1-CA08 | E10.1-T03 |
| E10.1-S15 | Logo | C10 | « Ajouter le logo », puis « Remplacer le logo » | toujours | `#logo-btn` | E10.1-CA08 | E10.1-T03 |
| E10.1-S16 | Logo | C19 | « Recommandé : sans logo… » 12 px, icône info, neutre | sans logo | `#logo-soft` | E10.1-CA08 | E10.1-T03 |
| E10.1-S17 | Identité | C18 | Nom de la marque, aide, 702 | toujours | `#f-name` | E10.1-CA09 | E10.1-T01 |
| E10.1-S18 | Identité | C18 | Pays du siège : liste (E10-Q4) | toujours | `#f-country` | E10.1-CA09 | E10.1-T01 |
| E10.1-S19 | Identité | C18 | Secteur principal : liste triée, groupe « Secteurs réglementés » en fin | toujours | `#f-sec` | E10.1-CA10 | E10.1-T01 |
| E10.1-S20 | Identité | C18 | Taille de l'entreprise : liste | toujours | `#f-size` | E10.1-CA09 | E10.1-T01 |
| E10.1-S21 | Identité | C18 | Présentation : aide, 4 lignes, compteur | toujours | `#f-pres` | E10.1-CA09 | E10.1-T01 |
| E10.1-S22 | Facultatif | C26, C23 | « Facultatif, à compléter plus tard (2) » : secteurs secondaires | replié | `#f-sec2` | E10.1-CA09 | E10.1-T01 |
| E10.1-S23 | Facultatif | C18, C14 | Site web, badge « Visible des agents INFLUX seulement », aide (E10-Q1) | replié | `#f-web` | E10.1-CA11 | E10.1-T01 |
| E10.2-S01 | Attentes | C23 | Thématiques : étiquettes, liste 320, « Ajouter » | toujours, 3 au plus | `#tags-top` | E10.2-CA01 | E10.2-T01 |
| E10.2-S02 | Réseaux | C21 | « Réseaux et formats », aide, cases des réseaux | toujours | `#nets` | E10.2-CA02 | E10.2-T01 |
| E10.2-S03 | Réseaux | C46 | Un groupe de formats par réseau coché : surtitre, cases, filets | réseau coché | `.fmts__net` | E10.2-CA02 | E10.2-T01 |
| E10.2-S04 | Réseaux | C08 | « Cochez au moins un réseau… » 14 px tertiaire | aucun réseau coché | etape-2-vide `#fmts-empty` | E10.2-CA03 | E10.2-T01 |
| E10.2-S05 | Pays | C23 | Pays d'audience recherchés (5 au plus), gauche | toujours | `#f-aud` | E10.2-CA01 | E10.2-T01 |
| E10.2-S06 | Pays | C23 | Vos marchés (5 au plus), droite | toujours | `#f-mkt` | E10.2-CA01 | E10.2-T01 |
| E10.2-S07 | Langues | C23 | Langues de travail | toujours | `#f-lang` | E10.2-CA01 | E10.2-T01 |
| E10.2-S08 | Facultatif | C26, C22 | « Facultatif… (4) » : droits d'usage habituels | replié | `[name=rights]` | E10.2-CA04 | E10.2-T01 |
| E10.2-S09 | Facultatif | C18 | Exclusivité habituelle, Rythme de collaboration (2 colonnes) | replié | `#f-excl`, `#f-rhy` | E10.2-CA04 | E10.2-T01 |
| E10.2-S10 | Facultatif | C21 | « Proposez-vous des contreparties en produits ? » Oui, Non | replié | `[name=nm]` | E10.2-CA04 | E10.2-T01 |
| E10.3-S01 | Interne | C24 | Encadré, tête œil barré | toujours | `.zone-int` | E10.3-CA01 | E10.3-T01 |
| E10.3-S02 | Interne | C24 | Phrase D46 14 px secondaire | toujours | `.zone-int > p.sm` | E10.3-CA01 | E10.3-T01 |
| E10.3-S03 | Interne | C18 | Fonction (E10-Q2), à gauche | toujours | `#f-role` | E10.3-CA02 | E10.3-T01 |
| E10.3-S04 | Interne | C18 | Prénom (facultatif), à droite | toujours | `#f-first` | E10.3-CA02 | E10.3-T01 |
| E10.3-S05 | Interne | C26 | « Pour votre commercial, facultatif (3) » | replié | `.zone-int details` | E10.3-CA03 | E10.3-T01 |
| E10.3-S06 | Interne | C18 | E-mail professionnel (indication « Celui de votre compte, si vide »), Téléphone | replié | `#f-mail`, `#f-tel` | E10.3-CA03 | E10.3-T01 |
| E10.3-S07 | Interne | C18 | Page de contact | replié | `#f-url` | E10.3-CA03 | E10.3-T01 |

## 4. Textes
Clés : `apps/web/src/locales/{fr,en}/brand-profile.json`. EN absent : « à écrire (expert-marketing) ». Statuts, segments, pied, repli, Ajouter, Retirer : mêmes textes que E07a §4.
| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S02 | Création de votre profil de marque | à écrire | nouvelle |
| S03, S06 | Étape {n} sur 3 · Environ 8 min au total · Environ {n} min restantes | à écrire | nouvelle |
| S04 | Brouillon · personne d'autre que vous ne le voit avant la publication | Draft · à écrire | `state.draft` · nouvelle |
| S08 | C'est enregistré. Vous reprendrez à cette étape depuis « Mon profil de marque ». | à écrire | nouvelle |
| S10 | Précédent · Continuer : {étape} · Vérifier mon profil · Revenir à la vérification | à écrire | nouvelle |
| S11 | Votre marque · Ce qu'un créateur lit en premier sur votre page. Environ 3 min. | à écrire | nouvelle |
| S11 | Ce que vous cherchez · Les créateurs et les contenus qui vous intéressent, en général. Chaque campagne précise ensuite. Environ 4 min. | à écrire | nouvelle |
| S11 | Votre interlocuteur · La personne qui suit les collaborations chez vous. Environ 1 min. | à écrire | nouvelle |
| S12 | Public : visible des créateurs une fois le profil publié | à écrire | nouvelle |
| S13 | Aperçu · Ce que voit un créateur · jamais le site web ni l'interlocuteur · Nom de la marque · Votre présentation apparaîtra ici. · {secteur} · {pays} · {taille} | à écrire | nouvelle |
| S14 | Logo · PNG, JPEG ou SVG, carré de préférence, 2 Mo au plus. Il est posé sur une pastille claire. | Logo · à écrire | `logo.label` · nouvelle (E10-Q3) |
| S15, S16 | Ajouter le logo · Remplacer le logo · Recommandé : sans logo, une page de marque inspire moins confiance | à écrire · Replace the logo · à écrire | nouvelle · `logo.replace` · nouvelle |
| S17 | Nom de la marque · Le nom sous lequel les créateurs vous connaissent. La raison sociale reste dans votre compte. | à écrire | nouvelle (`fields.companyName` diffère) |
| S18, S20 | Pays du siège · Taille de l'entreprise | à écrire | nouvelle (`fields.country`, `.companySize` diffèrent) |
| S19 | Secteur principal · Secteurs réglementés | Main sector · à écrire | `fields.primarySector.label` · nouvelle |
| S21 | Présentation · Ce que vous faites, votre ton, ce qui vous rend singulier. Ni coordonnée, ni lien : tout passe par INFLUX. · {n} / {max} caractères | Presentation · à écrire · = | `fields.presentation.label` · nouvelle · `field.characters` |
| S22 | Secteurs secondaires · Trois au plus. · Choisir un secteur… | Secondary sectors · à écrire | `fields.secondarySectors.label` · nouvelle |
| S23 | Site web · Visible des agents INFLUX seulement · Il aide votre commercial à vérifier la marque. Il n'est jamais montré à un créateur. | Website · à écrire | `fields.website.label` · nouvelle |
| E10.2-S01 | Thématiques · Choisir une thématique… | à écrire | nouvelle (`fields.topics.label` diffère) |
| E10.2-S02 à S04 | Réseaux et formats · Cochez un réseau : ses formats apparaissent dessous. Décocher un réseau garde vos formats en mémoire. · Cochez au moins un réseau pour choisir des formats. | à écrire | nouvelle ; réseaux : `reference.network.*` |
| E10.2-S05 à S07 | Pays d'audience recherchés · Vos marchés · Choisir un pays… · Langues de travail · Choisir une langue… | Working languages ; le reste à écrire | `fields.workingLanguages.label` ; nouvelle |
| E10.2-S08, S09 | Droits d'usage habituels · Exclusivité habituelle · Rythme de collaboration | = | `fields.usageRights`, `.exclusivityBand`, `.collaborationRhythm` |
| E10.2-S10 | Proposez-vous des contreparties en produits ? · Oui · Non | à écrire · Yes · No | nouvelle · `field.yes`, `field.no` |
| E10.3-S01, S02 | Visible uniquement par vous et l'équipe INFLUX · À la mise en relation, un créateur voit seulement le prénom et la fonction. Jamais l'e-mail ni le téléphone : les échanges passent par INFLUX. | à écrire | nouvelle (`contactBlock.notice` proche) |
| E10.3-S03, S04 | Fonction · Prénom (facultatif) | Role · First name | `fields.contactRole.label`, `.contactFirstName.label` |
| E10.3-S05 à S07 | Pour votre commercial, facultatif (3) · E-mail professionnel · Celui de votre compte, si vide · Téléphone · Page de contact | à écrire · Work e-mail · à écrire · Phone · Contact page | nouvelle ; `fields.contactEmail`, `.contactPhone`, `.contactUrl` |

## 5. Interactions, états, responsive, clavier
- Communes : E07a §5. Annonces propres : « Étape n sur 3 : {titre}. », « Logo ajouté : {fichier}. » (E10-Q3), « Formats {réseau} affichés. », « Formats {réseau} masqués, gardés en mémoire. », « Votre profil est enregistré. Vous reprendrez à l'étape n. »
- Logo : bouton → sélecteur de fichier (un clic simule l'ajout dans la maquette).
- Réseau décoché : formats masqués, gardés en mémoire ; envoi à l'API non défini (E10-Q6). Aperçu : suit nom, secteur, présentation, thématiques, réseaux.
- États. Chargement, indisponible, hors ligne : non montrés : comportement préservé (`BrandProfileScreen.tsx:119-140`, `:158`) ; proposé : C09, C08 « Réessayer », C17. Logo en chargement, envoi, retrait, refus (`logo.errors.*`), à redéposer, en validation : non montrés : préservés (`LogoField.tsx`, `logo.status.*`, `logo.errors.*`, `logo.review.*`) ; proposé : C19 sous le bouton, C11 « Retirer le logo » à côté. Erreurs de champ, coordonnée détectée, domaine normalisé, maximum atteint : non montrés : préservés (`ProfileFields.tsx:57-90`) ; proposé : C19. Refusé, en validation, suspendu, publié : E10b §5.
- Responsive : 1440, 1280 : cadre 768 ; 768 : 712,4 ; 375 : sans cadre, une colonne, pied fixe ; étape 3 : « Vérifier mon profil » 156 → 366,6 px (dépasse la gouttière de 7,6).
- Clavier, focus, animations : E07a §5 ; `details` de l'étape 3 dans l'encadré.

## 6. Critères d'acceptation
- **E10.1-CA01** Cadre 768, trois segments de 231,3 px à 1440, aucun lien retour au-dessus du titre.
- **E10.1-CA02** Compteur, titre, temps (8, 5, 1) et phrases exacts ; un seul `h1`.
- **E10.1-CA03** Segments et nombre de manques issus de `missingRequired` : étape 1 (nom, secteur, taille, pays, présentation), étape 2 (marchés, langues, thématiques, réseaux, formats, pays d'audience), étape 3 (fonction).
- **E10.1-CA04** Enregistrement : 600 ms, reprise 5 s, statut visible, seul l'échec annoncé.
- **E10.1-CA05** Une seule action verte ; « Continuer » jamais bloqué ; bouton entier à 320 et 375.
- **E10.1-CA06** Un badge « Public » aux étapes 1 et 2, aucun à l'étape 3 ; aucun badge par champ hors site web.
- **E10.1-CA07** L'aperçu n'affiche ni site web, ni interlocuteur, ni budget.
- **E10.1-CA08** Sans logo, l'envoi reste possible ; ajout, remplacement, retrait, refus motivés ; aucun nom de fichier affiché.
- **E10.1-CA09** Bornes : nom 120, présentation 120 à 1 000, secteurs secondaires 2, cinq tailles.
- **E10.1-CA10** Secteurs triés dans la langue, sept secteurs réglementés groupés en fin.
- **E10.1-CA11** Le site est enregistré en domaine seul ; son étiquette de visibilité dit la vérité de l'API.
- **E10.2-CA01** Choisir puis Ajouter ; plafonds 3, 5, 5, 2 dits avant d'être atteints ; langues : français, anglais.
- **E10.2-CA02** Les 10 réseaux et les 24 formats actifs sont atteignables, UGC compris, groupés par réseau.
- **E10.2-CA03** Aucun réseau : phrase d'état vide, aucun format visible.
- **E10.2-CA04** Valeurs du contrat : droits multiples sans `none`, exclusivité 4, rythme 3, contrepartie oui, non ou sans réponse.
- **E10.3-CA01** Encadré interne et phrase D46 lus avant les champs.
- **E10.3-CA02** Fonction : liste fermée de sept ; prénom 40 caractères.
- **E10.3-CA03** E-mail, téléphone, page repliés, jamais servis à un créateur.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E10.1-T01 | e2e, a11y | `apps/web/e2e/brand-profile.spec.ts` (FR 1440, EN 375) | parcours, manques, autosave, reprise, axe |
| E10.1-T02 | visuel | `apps/web/e2e/wizard-visual.spec.ts` (nouveau) | cotes du §2, 4 états, 1440 et 375 |
| E10.1-T03 | e2e | `brand-profile.spec.ts` (dépôt du logo, refus) | logo et retrait |
| E10.2-T01 | e2e, unitaire | idem, `apps/web/tests/brand-profile-form.test.ts` | formats par réseau, plafonds, valeurs |
| E10.3-T01 | e2e | `brand-profile.spec.ts` | encadré interne, fonction fermée |

À conserver : ids `brand-profile-<code>`, `data-action-bar`, alternatives `logo.alt`, `logo.pendingAlt`. Disparaissent : accordéon mobile, `data-section` (sauf `verification`, voir E10b), `meter` de complétude, `copy.submit.label`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Page à 4 sections, accordéon, colonne collante | `BrandProfileScreen.tsx:210-285`, `:398-461` | C41, 3 étapes | créer, supprimer |
| Complétude et jauge | `:341-384` | absente | supprimer (E10-Q8) |
| Formats à plat (24 cases) | `ProfileFields.tsx:285-295` | C46 | faire évoluer |
| Marchés, langues en étape 1 | `ProfileFields.tsx:173-212` (bloc identité) | étape 2 | déplacer |
| Taille en radios, thématiques en cases | `:164-172`, `:260-273` | C18, C23 | faire évoluer |
| Secteurs triés par code | `brand-profile-options.ts:50` | tri de langue, groupe | faire évoluer |
| Logo | `LogoField.tsx` | nouvelle forme | faire évoluer |

Données requises : tout est servi par `GET /v1/me/brand-profile`, **sauf le réseau de chaque format** : `references.formats` y est une liste de codes (`packages/contracts/src/brand-profile.ts`), alors que la campagne sert `networkCode` (`campaign.ts:381`) → écart d'API. Secteur réglementé : non servi au profil (`sectorIsSensitive` existe pour la campagne) → écart d'API. Hors lot : aucun élément.

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E10-Q1 | Site « Visible des agents INFLUX seulement », « jamais montré à un créateur » ; `06` RG15, RG17, D40 : publique ; l'API le sert au créateur (`campaign-creator-view.ts:101`) | Promesse fausse à l'écran | Décider la règle ; si interne, retirer le site de la vue créateur, des aperçus et de `09` RG98 | fondateur | oui |
| E10-Q2 | Fonction en texte libre et sous « Visible uniquement par vous et l'équipe INFLUX » ; RG35, RG36 : liste fermée de sept, publique | Valeur refusée par l'API ; texte faux | Liste C18 des `contactRole.*`, hors de l'encadré interne, badge public | fondateur | oui |
| E10-Q3 | SVG accepté ; D80 : PNG, JPEG, WebP ; nom de fichier annoncé et au récapitulatif, contre `LogoField.tsx:8` ; aucun retrait | Formats, fuite, fonction perdue | Formats du code ; « Logo ajouté. » ; garder « Retirer le logo » | product-owner | non |
| E10-Q4 | Pays du siège modifiable ; code : lecture, modifié dans « Mes informations » (`ProfileFields.tsx:120-130`) | Champ impossible | Valeur C07 avec lien vers « Mes informations » | product-owner | oui |
| E10-Q5 | Marchés et langues à l'étape 2 ; `06` RG15 les range dans l'identité | `SECTION_OF_KEY` à refondre | Suivre la maquette ; table étape par champ dans `packages/domain` | architecte | non |
| E10-Q6 | Formats « gardés en mémoire » une fois le réseau décoché ; envoi à l'API et manques non définis ; formats UGC sans réseau | Cohérence réseau et format | Non envoyés tant que décochés, gardés en session ; groupe UGC toujours visible | product-owner | oui |
| E10-Q7 | Bornes : présentation 1 500 (1 000, min 120), secteurs secondaires « Trois » (2), tailles 4 (5), langues DE, ES, NL (FR, EN), rythme, exclusivité et droits à valeurs fictives, droits à choix unique avec « Aucun » (multiple, sans `none`) | Validation, API | Valeurs et bornes du contrat ; droits en C21 à cases | product-owner | non |
| E10-Q8 | Complétude absente ; `06` RG61, RG62 et `17` §4.2 la montrent | Règle à amender | Suivre la maquette | product-owner | non |
| E10-Q9 | Badge par étape ; RG62, RG85 : étiquette de couche par champ | Règle à amender | Badge d'étape relié aux champs par `aria-describedby` | product-owner | non |
| E10-Q10 | « La raison sociale reste dans votre compte » ; code : modifier le nom met à jour le compte ; RG46 : raison sociale demandée au badge | Aide trompeuse | Garder l'aide actuelle `fields.companyName.help` | product-owner | non |
| E10-Q11 | Aperçu sans `?step` : la page n'a pas d'adresse d'étape ; segments à venir désactivés | Reprise | Comme E07-Q8 ; `?step=1..3` | architecte | non |
| E10-Q12 | « À la mise en relation, un créateur voit le prénom et la fonction » : la fonction est publique avant | Texte faux | Reformuler après E10-Q2 | expert-marketing | non |
| E10-Q13 | Cibles sous 44 (liens de tête 21,7, retrait d'étiquette 24) ; X3, X11 | A11y | Comme E07-Q14 | expert-ux | non |
