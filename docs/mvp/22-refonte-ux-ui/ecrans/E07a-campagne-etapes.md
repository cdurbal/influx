# E07 — Formulaire de campagne, étapes 1 à 3 et assistant (marque)
> Maquette : `proto-campagne.html` (états etape-1 à etape-5) · page de comparaison `ecran-7-campagne.html` · validée le 2026-11-24 (07, « Écran 7 ») · Constats : U22, U24, U26, U27, U30, U52, U63, U03
> Étapes 4 et 5 : `E07c-campagne-budget-dates.md` (questions E07-Q1, Q2, Q4, Q9, Q11, Q13). Vérifier, envoyer, envoyée : `E07b-campagne-envoi.md` (E07-Q15 et suivantes). Les éléments communs de l'assistant (E07.1-S01 à S19, S30) valent pour E07.1 à E07.5.
## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E07.1 | Étape 1, L'offre | `/fr/campagnes/[id]?step=1` | `/en/campaigns/[id]?step=1` | `CampaignFormScreen`, `CampaignOfferFields`, `KeyMessagesField` | etape-1 | XL | C41, C56 |
| E07.2 | Étape 2, Le travail attendu | idem `?step=2` | idem | `CampaignWorkFields`, `DeliverablesField` | etape-2 | L | C46, C22 |
| E07.3 | Étape 3, Pour qui | idem `?step=3` | idem | `CampaignAudienceFields` | etape-3 | M | C23 |

À préserver (chemins sous `apps/web/src/components/campaign/`) :
- Rôle : toute autre personne que la marque propriétaire → `notFound()` (`CampaignFormScreen.tsx:93-96`, `:131-133`).
- Étape dans l'adresse (`?step=`, `history.replaceState`), focus sur le titre de l'étape, jamais au premier chargement (`:224-241`).
- Enregistrement : 600 ms après la dernière saisie, nouvelle tentative à 5 s, une seule à la fois, seuls les champs changés, saisie gardée (`use-campaign.ts:50-52`, `:183`, `:484`).
- Champs conditionnels effacés ou refusés selon la règle du domaine ; avertissements RG21 à RG23 sous le champ (`campaign-field-texts.ts`) ; bornes : `packages/domain/src/campaign/limits.ts`.
- Session finie → état « déconnecté » ; hors ligne → `account.offline` (`CampaignFormScreen.tsx:170`).
- API : `GET` et `PATCH /v1/me/campaigns/:id` (`campaign-api.ts:35-52`). Aucun fichier (RG45), aucun taux, aucun montant saisi.

## 2. Structure
- Coque C56 ; rubrique Campagnes, « Mes campagnes » courante. `m-page` : padding `spacing-section-header` × `spacing-page-gutter` (48 × 48 à 1440, 44,4 × 43,2 à 1280, 32,8 × 27,8 à 768, 24 × 16 à 375).
- `form.wz` (C41) : colonne, `gap: spacing-5` (24), largeur max `container-narrow` (768). ≥ 768 px : `border-width-thin` `border-default`, `radius-card` (16), fond `surface-card`, padding `spacing-inset-card` (32 ; contenu 702 px). À 1440 : x 304, largeur 768. À 1280 : x 299,2, largeur 768. À 768 : x 27,8, largeur 712,4, padding 24, contenu 662,4. < 768 : ni bordure, ni fond, ni padding ; x 16, largeur 343.
- Ordre : `wz-head` (gap `spacing-3`) → `section.wz-step` (gap `spacing-5`) → `wz-foot`.
- `wz-head` : lien retour (21,7 px de haut) ; `wz-top` (titre 31 px + compteur, baseline, écarts 8 × 16) ; `wz-name` ; `segs` ; `wz-meta`. Hauteur 157 à 1440, 275,7 à 375.
- `segs` : grille 5 × `minmax(0,1fr)`, `gap: spacing-1` ; segment 6 px de haut (137,2 à 1440, 65,4 à 375), `radius-pill` ; zone cliquable étendue de 10 px au-dessus et au-dessous (26 px).
- `wz-foot` : flex, `gap: spacing-3`, filet haut, `padding-top: spacing-4` ; `.save` au centre (`flex: 1`). < 768 : `position: fixed`, `bottom: size-nav-bottom-height` (56), `z-raised`, fond `surface-page`, padding `spacing-2 spacing-page-gutter`, 61,8 px de haut ; `.save` masqué (repris dans `wz-meta`), `next-sub` masqué, principal à droite ; `m-page` reçoit `padding-bottom: calc(spacing-section-header + 4.5rem)`.
- En-tête d'étape : colonne `gap: spacing-2` ; titre 20 px `text-title-section`, extra de droite « Aperçu » (étapes 1 et 3).
- Grilles `fgrid--2` / `--3` : `gap: spacing-5` ; colonnes à partir de 640 px (X3) : 339 + 339 ; 212 × 3 dans `.cond` ; 206,7 × 3 dans `zone-int` à 1440 ; une colonne à 375.
- `.cond` : filet gauche `border-width-thick` `border-default`, `padding-left: spacing-4`, `gap: spacing-5`.
- `.pv` : `surface-raised`, `radius-md`, padding et gap `spacing-4` / `spacing-3`. `zone-int` : pointillé `border-strong`, `radius-md`, fond `surface-page`, padding `spacing-4`, gap `spacing-5`.
- `details.opt` : filet haut, `padding-top: spacing-2`, résumé 44 px, contenu `gap: spacing-5`.
- Champ : libellé 600, aide 14 px, contrôle 48 px ; titre 702, type 352 (22 rem), référence 320 (20 rem), dates 192 (12 rem), nombre 128, plafond 256 (16 rem) ; textareas : 3 lignes 120 px, 5 lignes 150 px, 2 lignes 120 px.
- Hauteur de page : 1 470 (étape 1, 1440) ; 1 730 (étape 1, 375).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E07.1-S01 | Cadre | C01, C41 | Carte assistant, largeur max 768, padding 32 | E07.1 à E07.6, ≥ 768 px ; nue au-dessous | etape-1 `form.wz` | E07.1-CA01 | E07.1-T02 |
| E07.1-S02 | Tête | C11 | Retour « Mes campagnes », chevron gauche 16 px, 14 px | E07.1 à E07.7 | `.wz-head > a.go` | E07.1-CA02 | E07.1-T01 |
| E07.1-S03 | Tête | C41 | `h1` « Création de votre campagne », 20 px, 700 | mode création | `#wz-title` | E07.1-CA03 | E07.1-T01 |
| E07.1-S04 | Tête | C41 | Compteur « Étape n sur 5 », 14 px, chiffres tabulaires | étapes ; « Vérification » en E07.6 | `#wz-count` | E07.1-CA03 | E07.1-T01 |
| E07.1-S05 | Tête | C13 | Badge neutre « Brouillon » 28,6 px | brouillon ; `À corriger` : E07-Q18 | `.wz-name .badge` | E07.1-CA04 | E07.1-T01 |
| E07.1-S06 | Tête | C41 | Titre saisi, suivi en direct, « Sans titre » si vide, puis phrase de confidentialité | E07.1 à E07.6 | `#wz-name` | E07.1-CA04 | E07.1-T01 |
| E07.1-S07 | Tête | C41 | 5 segments boutons : à venir `surface-active`, courant et fait `brand-primary`, incomplet `feedback-warning-icon` | E07.1 à E07.6 ; à venir désactivé (E07-Q8) | `#segs button` | E07.1-CA05 | E07.1-T01 |
| E07.1-S08 | Tête | C41 | Temps restant 14 px secondaire | 15, 10, 7, 5, 3 min | `#wz-time` | E07.1-CA06 | E07.1-T01 |
| E07.1-S09 | Tête | C11 | « Il manque n informations · voir la liste » (mène à E07.6) ou « Tout est renseigné · voir la liste » | masqué en E07.6 | `#to-check` | E07.1-CA07 | E07.1-T01 |
| E07.1-S10 | Tête | C11 | « Enregistrer et reprendre plus tard » | E07.1 à E07.6 | `#later` | E07.1-CA08 | E07.1-T01 |
| E07.1-S11 | Tête | C17 | Notice succès sous la tête | après S10 ; effacée au changement d'étape | `#later-note` | E07.1-CA08 | E07.1-T01 |
| E07.1-S12 | Tête | C25 | Statut d'enregistrement court + « Réessayer » à l'échec | < 768 px | `.save--meta` | E07.1-CA09 | E07.1-T01 |
| E07.1-S13 | Pied | C25 | Statut centré, icône coche, rotation, alerte | ≥ 768 px, étapes | `.wz-foot .save` | E07.1-CA09 | E07.1-T01 |
| E07.1-S14 | Pied | C10 | « Précédent » texte, 128 × 44, chevron | étapes 2 à 5 ; place gardée, invisible en étape 1 | `#prev` | E07.1-CA10 | E07.1-T01 |
| E07.1-S15 | Pied | C10 | Principal « Continuer » + « : {étape suivante} », flèche, 44,8 px ; étape 5 : « Vérifier ma campagne » | seul vert de l'écran | `#next` | E07.1-CA10 | E07.1-T01 |
| E07.1-S16 | Étape | C02 | `h2` titre d'étape 20 px + phrase 16 px secondaire avec durée | étapes 1 à 5 | `.wz-step > header` | E07.1-CA11 | E07.1-T01 |
| E07.1-S17 | Étape | C14 | Badge « Public : visible des créateurs une fois la campagne ouverte », globe | étapes 1, 2, 3, 5 (un par étape) | `.wz-step .layer` | E07.1-CA12 | E07.1-T01 |
| E07.1-S18 | Aperçu | C11 | Bascule « Aperçu », œil, `aria-expanded` | étapes 1 et 3 | `[data-preview]` | E07.1-CA13 | E07.1-T01 |
| E07.1-S19 | Aperçu | C05, C48 | Bloc : chapeau + carte du fil (max 416), suit titre et résumé en direct | aperçu ouvert | `.pv`, `.feedcard` | E07.1-CA13 | E07.1-T01 |
| E07.1-S20 | Champs | C18 | Titre : aide, entrée 702, compteur | toujours | `#f-title` | E07.1-CA14 | E07.1-T03 |
| E07.1-S21 | Champs | C18 | Type de campagne : liste 352 | toujours | `#f-type` | E07.1-CA14 | E07.1-T03 |
| E07.1-S22 | Champs | C18 | Résumé public : aide, 3 lignes, compteur / 400 | toujours | `#f-sum` | E07.1-CA14 | E07.1-T03 |
| E07.1-S23 | Champs | C18 | Brief détaillé : aide, 5 lignes, compteur / 4 000 | toujours | `#f-brief` | E07.1-CA14 | E07.1-T03 |
| E07.1-S24 | Champs | C18 | Produit ou service concerné (une ligne), à gauche | toujours | `#f-prod` | E07.1-CA14 | E07.1-T03 |
| E07.1-S25 | Champs | C18 | Catégorie du produit : liste, à droite | toujours | `#f-cat` | E07.1-CA14 | E07.1-T03 |
| E07.1-S26 | Facultatif | C26 | « Facultatif, à compléter plus tard (3) », chevron tourné à 90° | fermé par défaut | `details.opt` | E07.1-CA15 | E07.1-T01 |
| E07.1-S27 | Facultatif | C18 | Messages clés, aide, une ligne (1 à 5 : E07-Q5) | replié | `[aria-labelledby=l-km]` | E07.1-CA15 | E07.1-T01 |
| E07.1-S28 | Facultatif | C18 | Interdits et points de vigilance, aide, 2 lignes | replié | `#f-rest` | E07.1-CA15 | E07.1-T03 |
| E07.1-S29 | Facultatif | C24, C18 | Encadré interne : référence interne 320, aide | replié | `.zone-int #f-ref` | E07.1-CA16 | E07.1-T01 |
| E07.1-S30 | Manques d'étape | C29 | Annonce « Il reste n information(s) à cette étape… » | Continuer avec manques | script `#next` | E07.1-CA10 | E07.1-T01 |
| E07.2-S01 | Livrables | C21 | `fieldset` Livrables, aide, cases des réseaux | toujours | `#d-nets` | E07.2-CA01 | E07.2-T01 |
| E07.2-S02 | Livrables | C46 | Un groupe par réseau coché : surtitre capitales, filets | réseau coché ; décoché : masqué, quantités gardées | `.deliv__net` | E07.2-CA01 | E07.2-T01 |
| E07.2-S03 | Livrables | C46 | Ligne format + quantité : − (36 rond), valeur (24 min, tertiaire à 0), + (36 rond) | chaque format du réseau | `.deliv__row`, `.qty` | E07.2-CA02 | E07.2-T01 |
| E07.2-S04 | Droits | C22 | Droits d'usage demandés : sélecteur segmenté, pilule 44 px, option 36 px | toujours | `#rights` | E07.2-CA03 | E07.2-T01 |
| E07.2-S05 | Droits | C18 | Bloc conditionnel : Durée des droits, Territoire (2 colonnes, 330) | droits ≠ aucun | `#rights-more` | E07.2-CA03 | E07.2-T01 |
| E07.2-S06 | Droits | C23 | Pays des droits d'usage (5 au plus) : non montré | territoire = pays choisis | code `CampaignWorkFields.tsx:98-123` | E07.2-CA04 | E07.2-T01 |
| E07.2-S07 | Exclusivité | C21 | Exclusivité sectorielle : radios, à gauche | toujours | `[name=excl]` | E07.2-CA05 | E07.2-T01 |
| E07.2-S08 | Validation | C18 | Délai de validation des contenus : aide, liste, « Choisir… » | toujours | `#f-rev` | E07.2-CA05 | E07.2-T01 |
| E07.3-S01 | Audience | C23 | Pays visés : étiquettes 36 px, liste 320 + « Ajouter » | toujours, 5 au plus | `#f-c` | E07.3-CA01 | E07.3-T01 |
| E07.3-S02 | Audience | C23 | Langues de publication attendues | toujours | `#f-l` | E07.3-CA01 | E07.3-T01 |
| E07.3-S03 | Audience | C23 | Thématiques visées (3 au plus) | toujours | `#f-t` | E07.3-CA01 | E07.3-T01 |
| E07.3-S04 | Facultatif | C26, C21 | « Facultatif, à compléter plus tard (3) » : taille d'audience (cases) | replié | `details.opt` | E07.3-CA02 | E07.3-T01 |
| E07.3-S05 | Facultatif | C21 | Tranches d'âge de l'audience (cases) | replié | idem | E07.3-CA02 | E07.3-T01 |
| E07.3-S06 | Facultatif | C21 | Répartition de genre (radios, « Indifférent » par défaut) | replié | `[name=gen]` | E07.3-CA03 | E07.3-T01 |

## 4. Textes
Clés dans `apps/web/src/locales/{fr,en}/campaign.json`. EN absent = « à écrire (expert-marketing) » ; « = » : valeur EN existante.
| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S02 | Mes campagnes | My campaigns | `form.back` |
| S03 | Création de votre campagne · Compléter votre campagne (retour depuis E07.6) | à écrire | nouvelle |
| S04 | Étape {n} sur 5 · Vérification | Step {step} of {total} · à écrire | `form.step` · nouvelle |
| S05 | Brouillon | Draft | `status.label.draft` |
| S06 | Sans titre · · personne d'autre que vous ne le voit avant l'envoi | à écrire | nouvelle |
| S07 | Étape {n} : {titre}, en cours · , à compléter · , faite · , à venir | à écrire | nouvelle |
| S08 | Environ 15 min au total · Environ {n} min restantes · Plus que la relecture | à écrire | nouvelle |
| S09 | Il manque {n} informations · voir la liste ; Tout est renseigné · voir la liste | à écrire | nouvelle |
| S10, S11 | Enregistrer et reprendre plus tard ; C'est enregistré. Vous reprendrez à cette étape depuis « Mes campagnes ». | à écrire | nouvelle |
| S12, S13 | Enregistré · Enregistré automatiquement · Enregistrement… · Enregistré à {h} h {mm} · Non enregistré — nouvelle tentative dans 5 s · Réessayer | Saving… (`save.saving`), le reste à écrire | `save.saving` ; autres nouvelles (proches : `save.saved`, `save.retry`) |
| S14, S15 | Précédent · Continuer · Continuer : {étape} · Vérifier ma campagne · Revenir à la vérification | à écrire | nouvelle (`form.previous`, `form.next` diffèrent) |
| S16 titres | L'offre · Le travail attendu · Pour qui · Le budget · Calendrier et candidature | The offer · The work expected · For whom · The budget · Calendar and application | `form.steps.1` à `5.title` |
| S16 phrases | 1 : Ce que vous proposez, et sur quel produit. Environ 5 min. · 2 : Les contenus demandés et ce que vous ferez de ces contenus. Environ 3 min. · 3 : Les créateurs que vous cherchez, par leur audience. Environ 2 min. · 4 : Le produit envoyé, puis votre budget, qui reste entre vous et INFLUX. Environ 2 min. · 5 : Les dates, dans l'ordre où elles arrivent. Environ 3 min. | à écrire | nouvelle (remplace `form.steps.n.question`) |
| S17, E07.4-S01 | Public : visible des créateurs une fois la campagne ouverte · Public : visible des créateurs | à écrire | nouvelle |
| S18, S19 | Aperçu · Ce que voit un créateur dans le fil · jamais le budget · Titre de la campagne · Votre résumé public apparaîtra ici. · Candidatures jusqu'au {date} · {réseau} : {livrables} · {pays} · {thématiques} · produit envoyé | à écrire | nouvelle |
| S20 | Titre de la campagne + aide ; {n} / {max} caractères | = | `fields.title.label`, `.help`, `field.characters` (brand-profile) |
| S21 à S23 | Type de campagne ; Résumé public + aide ; Brief détaillé + aide | = | `fields.campaignType`, `.publicSummary`, `.brief` |
| S24, S25 | Produit ou service concerné ; Catégorie du produit | = | `fields.productDescription`, `.productSector` (label) |
| S26 | Facultatif, à compléter plus tard ({n}) | à écrire | nouvelle |
| S27 | Messages clés ; De une à cinq phrases de 10 à 200 caractères. | Key messages ; à écrire | `fields.keyMessages.label` ; aide nouvelle |
| S28 | Interdits et points de vigilance ; Ce qui ne doit pas apparaître : concurrents, alcool, conduite… | Prohibitions and points of attention ; à écrire | `fields.restrictions.label` ; aide nouvelle |
| S29 | Visible uniquement par vous et l'équipe INFLUX ; Référence interne ; Votre code de projet ou de bon de commande. | à écrire ; Internal reference ; à écrire | nouvelle ; `fields.internalReference.label` ; nouvelle |
| E07.2-S01 | Livrables ; Cochez un réseau, puis le nombre de contenus par format. | Deliverables ; à écrire | `fields.deliverables.label` ; aide nouvelle |
| E07.2-S03 | Un {format} de moins · Un {format} de plus | à écrire | nouvelle |
| E07.2-S04, S05 | Droits d'usage demandés ; Aucun · Republication sur vos réseaux · Publicité sponsorisée ; Durée des droits ; Territoire | Usage rights requested ; à écrire | `fields.usageRights.label` ; options courtes nouvelles (E07-Q3) |
| E07.2-S07, S08 | Exclusivité sectorielle ; Délai de validation des contenus ; Le temps que vous prenez pour approuver un contenu avant publication. ; Choisir… | à écrire ; Time to review the content ; à écrire ; Choose… | nouvelle ; `fields.contentReviewDelay.label` ; nouvelle ; `field.choose` (brand-profile) |
| E07.3 | Pays visés · Langues de publication attendues · Thématiques visées · Taille d'audience souhaitée · Tranches d'âge de l'audience · Répartition de genre de l'audience | = | `fields.audience*.label` |
| E07.3 ajouts | Choisir un pays… · Choisir une langue… · Choisir une thématique… · Ajouter · Retirer {nom} · Indifférent | Remove {label} (`field.remove`), le reste à écrire | nouvelle |

Options des listes : jamais celles de la maquette ; `campaign-options.ts` sur les codes servis (`references`), triées dans la langue de la page.

## 5. Interactions, états, responsive, clavier
- Continuer → étape suivante, haut de page, focus `h2`, annonce C29 « Étape n sur 5 : {titre}. » ; jamais bloquant. Avec manques : annonce « Il reste n information(s) à cette étape : vous pourrez y revenir. » à la place. Étape 5 → E07.6. Mode correction (venu de E07.6) : « Revenir à la vérification » → E07.6.
- Précédent, segment fait, incomplet ou courant → étape. S09 → E07.6. S10 → S11 + annonce « Votre campagne est enregistrée. Vous reprendrez à l'étape n. » ; aucune navigation.
- Saisie → statut « Enregistrement… » puis « Enregistré à {heure} » (S12 et S13 ensemble). Seul l'échec est annoncé : « Modifications non enregistrées. Nouvelle tentative dans 5 secondes. » ; « Réessayer » → « Modifications enregistrées. »
- Aperçu : bascule, `rise-in` ; suit la saisie.
- Réseau coché → groupe, `is-entering` ; décoché → masqué, quantités gardées en mémoire (E07-Q6). − et + : 0 à 20 (`output` `aria-live`).
- Droits ≠ aucun, produit envoyé = oui, nature ≠ produit seul → bloc conditionnel affiché (`rise-in`).
- Ajouter : la liste n'agit jamais seule ; option retirée de la liste, focus rendu à la liste, « Ajouté : {nom}. » ; retrait : « Retiré : {nom}. »
- Dates : contrôle au départ du champ, message annoncé ; effacé en direct dès que l'ordre est bon.
- États. Chargement, indisponible, hors ligne, introuvable : non montrés : comportement actuel préservé (`CampaignFormScreen.tsx:150-163`, `:131`, `:170`) ; représentation proposée : C09 (tête + 4 champs), C08 avec « Réessayer », C17 avertissement en haut du cadre. Erreur de champ et avertissement RG21 à RG23 : non montrés : comportement préservé (`campaign-field-texts.ts`) ; représentation proposée : C19 sous le champ (`fmsg--error`, `fmsg--warn`), relié par `aria-describedby`. Liste des erreurs d'étape (`:428-466`) : supprimée au profit de C20 de E07.6 (E07-Q7). Campagne non modifiable : E18. Réponse 409 à l'enregistrement : comportement préservé, puis lecture E18.
- Responsive. 1440 et 1280 : identiques (colonne 768). 768 : carte 712,4, deux ou trois colonnes gardées. 375 : pas de carte ; une colonne ; « Ajouter » sous la liste (134,6 × 46,8) ; segmenté sur 2 lignes (84 px) ; pied fixe à y 694 (812 de haut) au-dessus de la barre du bas ; tête sur 275,7 px.
- Clavier : ordre du DOM ; segments désactivés hors parcours ; `details` natifs ; Échap sans effet. Focus : `h2` (`tabindex=-1`) à chaque étape. Aucun piège.
- Animations : `wz-step.is-in` fondu 120 ms `ease-standard` ; `details`, `.cond`, `.pv` `rise-in` 200 ms ; chevron `rotate` 200 ms ; segment `background-color` 320 ms ; icône d'enregistrement `spin` 1 s linéaire. Toutes nulles si `prefers-reduced-motion`.

## 6. Critères d'acceptation
- **E07.1-CA01** À 1440 : cadre x 304, largeur 768, rayon 16, padding 32 ; à 375 : aucun cadre, contenu 343.
- **E07.1-CA02** Le retour mène à « Mes campagnes » dans la langue de la page et nomme sa destination.
- **E07.1-CA03** Un seul `h1` ; compteur et titre exacts par étape, sans saut de niveau.
- **E07.1-CA04** Le titre saisi apparaît en tête à la frappe ; l'état est un texte, pas une couleur.
- **E07.1-CA05** Chaque segment porte un nom complet et son état ; `aria-current=step` sur le courant ; « à compléter » vient de `missingRequired`, jamais d'un calcul local.
- **E07.1-CA06** Le temps restant vaut 15, 10, 7, 5, 3 min aux étapes 1 à 5.
- **E07.1-CA07** Le nombre de manques est celui de l'API ; le lien ouvre E07.6 depuis toute étape.
- **E07.1-CA08** « Enregistrer et reprendre plus tard » garde la page, affiche la notice et l'annonce.
- **E07.1-CA09** Échec réseau : saisie gardée, statut d'échec visible, nouvelle tentative à 5 s, « Réessayer » immédiat ; un succès n'est jamais annoncé vocalement.
- **E07.1-CA10** Une seule action `btn--primary` par étape ; « Continuer » n'est jamais bloqué ; toute la largeur du bouton est visible à 375 et à 320 px.
- **E07.1-CA11** À chaque étape : focus sur le `h2`, adresse `?step=n`, rechargement sur la même étape.
- **E07.1-CA12** Un badge « Public » par étape ; aucune étiquette de couche par champ.
- **E07.1-CA13** L'aperçu n'affiche jamais ni budget, ni devise, ni référence interne.
- **E07.1-CA14** Titre, type, résumé, brief, produit, catégorie visibles sans dépliage, bornes du domaine (140, 400, 4 000, 600).
- **E07.1-CA15** Messages clés (1 à 5) et interdits (1 000) dans le repli fermé, comptés « (3) » avec la référence.
- **E07.1-CA16** La référence interne (40) n'est rendue que dans l'encadré interne.
- **E07.2-CA01** Seuls les réseaux cochés montrent leurs formats ; tous les réseaux et formats actifs de l'API sont atteignables, UGC compris.
- **E07.2-CA02** Quantité 0 = aucune ligne envoyée ; 1 à 20 = une ligne ; 10 lignes au plus ; les boutons nomment le format.
- **E07.2-CA03** Durée et territoire n'apparaissent que si les droits ne sont pas `none` ; les quatre valeurs de RG38 sont proposées.
- **E07.2-CA04** « Pays choisis » affiche le sélecteur de pays (5 au plus).
- **E07.2-CA05** Exclusivité : quatre valeurs ; délai : `48h`, `5bd`, `10bd` ; aucune valeur hors contrat.
- **E07.3-CA01** Choisir puis Ajouter ; aucun ajout au changement ; plafonds 5 pays et 3 thématiques dits avant d'être atteints.
- **E07.3-CA02** Cinq tailles d'audience et quatre tranches d'âge, repliées.
- **E07.3-CA03** Sans choix de genre, la valeur envoyée est `null`.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E07.1-T01 | e2e, a11y | `apps/web/e2e/brand-campaign.spec.ts` (adapter L3B-E1, L3B-E2) | parcours, reprise, échec d'enregistrement, axe FR 375 et EN 1440 |
| E07.1-T02 | visuel | `apps/web/e2e/wizard-visual.spec.ts` (nouveau) | étapes 1 à 5 à 1440 et 375, cotes du §2, bouton non rogné |
| E07.1-T03 | unitaire | `apps/web/tests/campaign-view.test.ts` (adapter) | bornes, manques par étape, étape d'un champ |
| E07.2-T01 | e2e | `apps/web/e2e/brand-campaign.spec.ts` | livrables, droits conditionnels, valeurs du contrat |
| E07.3-T01 | e2e | idem | choisir puis ajouter au clavier, plafonds |

À conserver : `data-step`, `data-internal-box`, `data-action-bar` (pied fixe), noms accessibles `copy.fields.*.label`, ids `controlIdOf`. Disparaissent : `data-submit-panel`, `data-creator-box`, radios des listes fermées (spec à réécrire).

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Page, colonne des étapes | `CampaignFormScreen.tsx:281-360`, `Steps` `:473-527` | C41 | créer, supprimer la colonne |
| Panneau « Soumettre » et barre mobile | `:333-341`, `:350-355` | pied C41 ; envoi en E07.6 | supprimer |
| Badges par champ | `campaign-field-texts.ts` (`layer`) | un par étape | supprimer du rendu |
| Produit envoyé et précisions | étape 1, `CampaignOfferFields.tsx:164-232` | étape 4 | déplacer (`CAMPAIGN_REQUIRED_FIELD_STEP` l. 625-655 : `productIsSent`, `productValueBand`, `creatorKeepsProduct`, `shippingCostsBorneBy` → 4) |
| Livrables en lignes | `DeliverablesField.tsx` | C46 par réseau | faire évoluer |
| Thématiques en cases | `CampaignAudienceFields.tsx:94-111` | C23 | faire évoluer |
| Dates `type=date` | `CampaignCalendarFields.tsx:60` | C47 texte | créer |
| Bloc « Ce que voit un créateur » et lien (étape 4) | `CampaignBudgetFields.tsx:144-169` | absent ; lien en E07.6 | supprimer (E07-Q9) |
| Mention RG80 | `CampaignCalendarFields.tsx:118-120` | absente | E07-Q9 |

Données requises : tout est servi par `GET /v1/me/campaigns/:id` (`packages/contracts/src/campaign.ts:407-459`) ; logo, nom et badge de la marque pour l'aperçu : `GET …/creator-view` (`brand`, nul si profil non publié) et `…/brand-profile/logo`. Aucune route nouvelle. Hors lot : aucun élément de ces étapes.

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E07-Q3 | Listes fictives : type (4, dont « Lancement de produit »), droits (3), durées (3), territoire (« Pays de la campagne »), exclusivité (2), délai (3 jours), frais (« Partagés »), nature (sans affiliation), tailles (4, sans méga) ; contrats l. 97-129, RG18, RG38, RG42, RG62 | Formes trop courtes (segmenté à 4 longs libellés) | Forme de la maquette, valeurs du contrat ; libellés courts à écrire ; liste si le segmenté déborde | expert-ux, expert-marketing | non |
| E07-Q5 | Un seul champ « Messages clés » ; RG24 : 1 à 5 | Perte de données | Lignes de `KeyMessagesField` dans le repli | expert-ux | non |
| E07-Q6 | Décocher garde les quantités « en mémoire » : rien ne dit si elles partent à l'API ; formats UGC sans réseau absents ; 10 réseaux servis, 3 montrés | Comportement d'enregistrement | Décoché : lignes retirées de l'envoi, gardées en session ; groupe « Contenus livrés à la marque » | product-owner | oui |
| E07-Q7 | Erreurs et avertissements RG21-23 non montrés ; `17` §4.3 : liste en tête d'étape | Représentation à choisir | C19 par champ, plus de liste en tête d'étape | expert-ux | non |
| E07-Q8 | Segments à venir désactivés ; `17` §4.3 : navigation libre ; rien ne définit les étapes « passées » à la reprise d'un brouillon | Reprise ambiguë | Étape passée si un de ses champs est renseigné ou si elle précède `?step` | product-owner | oui |
| E07-Q10 | Bornes : titre 120 (140), interdits 600 (1 000), référence 60 (40), produit une ligne pour 600 caractères ; minimums 10, 120, 300, 20 jamais dits | Validation | Bornes du domaine ; produit en zone de 2 lignes ; minimum dans l'aide | product-owner | non |
| E07-Q12 | « Un badge par étape » ; `09` RG110 : chaque champ indique publié ou interne | RG à amender | Badge d'étape relié aux champs par `aria-describedby` | product-owner | non |
| E07-Q14 | Cibles sous la charte (44) : liens de tête et retour 21,7 px, retrait d'étiquette 24, quantité 36 ; texte tertiaire `.order`, quantité nulle (X7) | A11y | Garder le dessin, étendre la zone cliquable | expert-ux | non |
