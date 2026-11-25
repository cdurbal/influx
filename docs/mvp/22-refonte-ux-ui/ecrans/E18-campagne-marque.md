# E18 — Fiche de campagne côté marque (marque)
> Maquette : `proto-campagne-marque.html` (états publiee, pause, close, validation, corriger) · page de comparaison `ecran-18-campagne-marque.html` · validée le 2026-11-24 (07, « Écran 18 ») · Constats : U19, U15
## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E18.1 | Fiche de campagne (marque) | `/fr/campagnes/[id]` (état hors brouillon) | `/en/campaigns/[id]` | `CampaignFormScreen` (champs figés), `CampaignLifecyclePanel`, `CampaignStatusText` | publiee, pause, close, validation, corriger | L | C40, C39, E08 (même composition de lecture), E07, E12 |

Même adresse que E07 et E08 : marque + brouillon → E07 ; marque + autre état → E18 ; créateur → E08 (`CampaignPageScreen.tsx`). À corriger : E18 par défaut, formulaire à `?step=n` (E18-Q8).
À préserver (`apps/web/src/components/campaign/`) :
- `notFound()` : autre rôle, autre marque, identifiant inconnu (`CampaignFormScreen.tsx:93-96`, `:131`).
- Pause, reprise, clôture : `POST …/pause`, `/resume`, `/close` ; réponse adoptée ; verrou d'appel ; focus sur le résultat ; clôture confirmée, définitive ; échecs `unavailable`, `notAllowed`, `pausedByInflux` avec relecture (`CampaignLifecyclePanel.tsx:45-85`).
- Actions par état : publiée → pause, clôture ; en pause → reprise (pause de la marque seulement), clôture ; close → aucune (`campaign-view.ts:790-801`).
- Refus : motif typé, message de l'agent, suite `fix` ou `contact` (`CampaignStatusText.tsx:30-48`). Corps de lecture : `CampaignReadBody.tsx` reste celui de l'aperçu et du créateur (RG102).
- API : `GET /v1/me/campaigns/:id` ; `GET …/creator-view` (aperçu).

## 2. Structure
- Coque C56, rubrique Campagnes, « Mes campagnes » courante. `.page` : colonne `gap: spacing-5` (24), largeur `container-max` ; 1 088 px à 1440 (x 304), 937,6 à 1280 (x 299,2), 712,4 à 768, 343 à 375.
- Ordre : retour → `rhead` → grille (`r-main` puis `aside`) → `mbar` → `m-acts` (< 1 024 seulement).
- `rhead` : `h1` `clamp(1.625rem … 2.125rem)` 800, largeur max 640 (X1) ; ligne d'état `gap: spacing-2` ; phrase 14 px ou notice pleine largeur (1 088 × 47,7 ; 100,5 à corriger). Hauteur 145,7 (publiee), 171,7 (validation), 224,5 (corriger).
- `r-grid` ≥ 1 024 : `minmax(0, 7fr) minmax(19rem, 4fr)`, `gap: spacing-9` (64) ; 651,6 + 372,4 à 1440 ; 555,9 + 317,7 à 1280. < 1 024 : une colonne, `aside` masqué, `gap: spacing-6`.
- `r-main > section` : padding `spacing-6` vertical, filet haut sauf la première, `gap: spacing-4`. Ordre : L'essentiel (titre masqué) → Le brief → Ce qui est attendu → Droits et conditions → Pour qui → Le budget → Historique.
- L'essentiel `.ess` : grille 2 × 2, bord `border-default`, `radius-card`, cellule padding `spacing-4`, icône 24 (651,6 × 191) ; une colonne sous 640 (X3 ; 343 × 381).
- Brief : largeur `size-measure` (40 rem), 5 lignes coupées, interligne `leading-body`. Propriétés : libellé 12 rem (192), `text-md`, 46 rem max ; sous 640 : 8,5 rem, 14 px. Budget : `zone-int` 651,6 × 215,8.
- Historique : grille 8 rem + 1fr, 14 px ; sous 640 : une colonne.
- `aside` : collant, `top: spacing-6` ≥ 1 024 ; `.box` padding `spacing-5` (24), `gap: spacing-4`, `radius-card`, `shadow-md` (X5), 372,4 × 466,5 (publiee), 215,7 (close, validation), 152,9 (corriger) ; titre `.big` `text-heading-3` 800 (X1).
- `mbar` (< 1 024) : fixe, `bottom: size-nav-bottom-height`, fond `surface-page`, filet haut, padding `spacing-2 spacing-page-gutter`, 63,8 px ; publiee, pause, corriger. Bas de page réservé : `size-nav-bottom-height + 4.25rem`, sauf close et validation.
- `m-acts` (< 1 024) : colonne `gap: spacing-4`, filet haut, `padding-top: spacing-5` ; 271,6 px (publiee, pause), 164,6 (close, validation) ; absent à corriger.
- Hauteur de page : 2 094 (1440), 2 561 (768), 2 949 (375, publiee).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E18.1-S01 | Cadre | C01, C40 | Deux colonnes 7/4, écart 64 | ≥ 1 024 ; une colonne au-dessous | publiee `.r-grid` | E18.1-CA01 | E18.1-T03 |
| E18.1-S02 | Tête | C11 | Retour « Mes campagnes » | toujours | `.crumb` | E18.1-CA02 | E18.1-T01 |
| E18.1-S03 | Tête | C02 | `h1` titre, 640 max | toujours | `.rhead h1` | E18.1-CA02 | E18.1-T01 |
| E18.1-S04 | Tête | C13 | Badge : Publiée (succès, coche), En pause (avertissement, horloge), Close (neutre), En cours de validation (info, sablier), À corriger (avertissement, triangle) | un par état | `.rhead .badge` | E18.1-CA03 | E18.1-T01 |
| E18.1-S05 | Tête | C02 | Date et référence : publiée le {date} · {référence} | publiee, pause, close | `.rhead p.row` | E18.1-CA04 | E18.1-T01 |
| E18.1-S06 | Tête | C02 | envoyée le {date} à {heure} ; relue le {date} par votre commercial | validation ; corriger | idem | E18.1-CA04 | E18.1-T01 |
| E18.1-S07 | Tête | C18 | Phrase d'état 14 px secondaire | publiee, pause, close | `.rhead > p.sm` | E18.1-CA03 | E18.1-T01 |
| E18.1-S08 | Tête | C17 | Notice information, sablier | validation | `.notice--info` | E18.1-CA03 | E18.1-T01 |
| E18.1-S09 | Tête | C17 | Notice avertissement : motif | corriger | `.notice--warning` | E18.1-CA05 | E18.1-T02 |
| E18.1-S10 | Tête | C10 | « Corriger ma campagne » principal, 224 × 44,8 | corriger | `.notice .btn--primary` | E18.1-CA05 | E18.1-T02 |
| E18.1-S11 | L'essentiel | C35 | Candidatures : jusqu'au {date}, dans {n} jours ; Suspendues ; Closes le {date} | selon état ; précision selon état | `.ess` 1 | E18.1-CA06 | E18.1-T01 |
| E18.1-S12 | L'essentiel | C35 | Publication : du {date} au {date}, livraison avant le {date} | toujours | `.ess` 2 | E18.1-CA06 | E18.1-T01 |
| E18.1-S13 | L'essentiel | C35 | Contenus demandés : {réseau} : {livrables}, délai de validation | toujours | `.ess` 3 | E18.1-CA06 | E18.1-T01 |
| E18.1-S14 | L'essentiel | C35 | Contrepartie : {nature}, « commission incluse… » | toujours | `.ess` 4 | E18.1-CA07 | E18.1-T01 |
| E18.1-S15 | Brief | C03, C26 | Brief coupé à 5 lignes ; « Lire la suite » ou « Réduire » | brief plus long que 5 lignes | `#brief`, `#more` | E18.1-CA08 | E18.1-T01 |
| E18.1-S16 | Attendu | C65 | Messages clés, puces | au moins un message | `#h-exp + .bullets` | E18.1-CA09 | E18.1-T01 |
| E18.1-S17 | Attendu | C65 | Interdits et points de vigilance | renseigné | 2e `.bullets` | E18.1-CA09 | E18.1-T01 |
| E18.1-S18 | Conditions | C07 | Droits d'usage, Exclusivité, Produit, Langue de publication | toujours | `#h-cond + dl` | E18.1-CA09 | E18.1-T01 |
| E18.1-S19 | Pour qui | C07 | Pays visés, Thématiques, Taille d'audience | toujours | `#h-who + dl` | E18.1-CA09 | E18.1-T01 |
| E18.1-S20 | Budget | C24, C07 | Encadré : Budget par créateur, Créateurs recherchés, Référence interne, phrase commission | toujours (E18-Q4) | `.zone-int` | E18.1-CA07 | E18.1-T01 |
| E18.1-S21 | Historique | C53 | Lignes {date} · {heure} et phrase, la plus récente en premier | selon état | `#hist` | E18.1-CA10 | E18.1-T01 |
| E18.1-S22 | Encadré | C39 | Ligne de tête : {n} jours et « de candidatures, jusqu'au {date} » ; En pause, Close « depuis le {date} » ; En relecture « réponse sous 1 jour ouvré » ; À corriger « puis à renvoyer à INFLUX » | un par état, ≥ 1 024 | `.box .big` | E18.1-CA11 | E18.1-T01 |
| E18.1-S23 | Encadré | C33 | Commercial : avatar 40, nom, « votre commercial INFLUX » | toujours | `.who` | E18.1-CA12 | E18.1-T01 |
| E18.1-S24 | Encadré | C18 | « Il vous présente les candidatures… » 14 px | publiee, pause, ≥ 1 024 | `.box p.sm` | E18.1-CA12 | E18.1-T01 |
| E18.1-S25 | Encadré | C10 | « Voir ce que voit un créateur », œil, nouvel onglet | tous sauf corriger | `.box .btn--secondary` | E18.1-CA13 | E18.1-T04 |
| E18.1-S26 | Encadré | C10 | « Chercher des créateurs » | publiee, pause, ≥ 1 024 | `.box` | E18.1-CA13 | E18.1-T01 |
| E18.1-S27 | Gestes | C26, C10 | « Mettre en pause » replié, texte et bouton | publiee | `.rare` 1 | E18.1-CA14 | E18.1-T02 |
| E18.1-S28 | Gestes | C26, C10 | « Reprendre » replié, texte, « Reprendre la campagne » | pause | `.rare` 1 | E18.1-CA14 | E18.1-T02 |
| E18.1-S29 | Gestes | C26, C21, C10 | « Clôturer » replié : avertissement, case « Je comprends… », bouton danger inactif sans la case | publiee, pause | `#cl-ok`, `#cl-go` | E18.1-CA15 | E18.1-T02 |
| E18.1-S30 | Barre | C39 | {n} jours et « Gérer » ; En pause et « Reprendre » ; À corriger et « Corriger » (vert) | < 1 024, publiee, pause, corriger | `.mbar` | E18.1-CA16 | E18.1-T03 |
| E18.1-S31 | Suivi mobile | C03 | « Suivi » : commercial, aperçu, gestes repliés (textes courts) | < 1 024, sauf corriger | `.m-acts` | E18.1-CA16 | E18.1-T03 |
| E18.1-S32 | Annonce | C29 | Pause, reprise, clôture | après le geste | script `#cl-go`, `proto:state` | E18.1-CA14 | E18.1-T02 |

## 4. Textes
Clés : `apps/web/src/locales/{fr,en}/campaign.json`. EN absent : « à écrire (expert-marketing) ».
| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S02 | Mes campagnes | My campaigns | `form.back` |
| S04 | Publiée · En pause · Close · En cours de validation · À corriger | Published · Paused · à écrire · Being reviewed · To correct | `status.label.*` (Close : E18-Q3, clé « Clôturée ») |
| S05, S06 | publiée le {date} · {référence} · envoyée le {date} à {h} h {mm} · relue le {date} par votre commercial | à écrire | nouvelle |
| S07 | Votre campagne est visible des créateurs. En pause, elle n'accepte plus de candidature ; les échanges déjà ouverts ne sont pas touchés. · Votre campagne est en pause : elle n'accepte plus de candidature. Reprenez-la quand vous voulez, sans nouvelle validation. · Cette campagne est terminée : elle ne se rouvre pas. Aucune donnée n'est effacée. | = les deux premiers ; le troisième à écrire | `lifecycle.published`, `.paused` ; nouvelle (`lifecycle.closed` sans la 2e phrase) |
| S08 | Un commercial INFLUX la relit sous 1 jour ouvré ; vous recevrez un e-mail à l'ouverture ou s'il faut la corriger. Pendant la relecture, elle n'est plus modifiable. | à écrire | nouvelle |
| S09, S10 | Votre campagne n'a pas été publiée : {motif} · Corriger ma campagne | Your campaign was not published: {reason} ; à écrire | `status.rejected`, `rejection.*` (espace fine et gras : nouvelle) ; nouvelle |
| S11 | Candidatures · Jusqu'au {date} · dans {n} jours · Suspendues · jusqu'à la reprise · Closes le {date} | à écrire | nouvelle |
| S12, S13 | Publication · Du {date} au {date} · contenus livrés avant le {date} · Contenus demandés · {réseau} : {n} {format} · validation par vous sous {délai} | à écrire | nouvelle |
| S14 | Contrepartie · {nature} · commission incluse, précisée par votre commercial | à écrire | nouvelle ; nature : `remuneration.*` |
| S15 à S17 | L'essentiel · Le brief · Lire la suite · Réduire · Ce qui est attendu · Messages clés · Interdits et points de vigilance | `fields.keyMessages.label`, `.restrictions.label` = ; le reste à écrire | existantes et nouvelles |
| S18 | Droits et conditions · Droits d'usage · Exclusivité · Produit · Langue de publication | à écrire | nouvelle (`preview.rows.usageRights` : « Droits d'usage » = Usage rights à vérifier) |
| S19 | Pour qui · Pays visés · Thématiques · Taille d'audience | For whom · Countries aimed at ; le reste à écrire | `form.steps.3.title`, `fields.audienceCountries.label` ; nouvelle |
| S20 | Le budget · Visible uniquement par vous et l'équipe INFLUX, jamais par un créateur · Budget par créateur · Créateurs recherchés · Référence interne · Commission incluse, précisée par votre commercial. Les montants se négocient avec lui. | The budget · Internal reference ; le reste à écrire | `form.steps.4.title`, `fields.internalReference.label` ; nouvelle |
| S21 | Historique · Vous avez clos la campagne. · Vous avez mis la campagne en pause. · Votre commercial a demandé une correction : {champ}. · Votre commercial INFLUX a publié la campagne. · Vous avez envoyé la campagne à INFLUX pour validation. · Vous avez créé la campagne. | à écrire | nouvelle |
| S22 | {n} jours · de candidatures, jusqu'au {date} · En pause · depuis le {date} · Close · En relecture · réponse sous 1 jour ouvré · À corriger · puis à renvoyer à INFLUX | à écrire | nouvelle |
| S23, S24 | {prénom I.} · votre commercial INFLUX · Il vous présente les candidatures et les créateurs qu'il vous propose. Les mises en relation arrivent avec la messagerie. | à écrire | nouvelle |
| S25, S26 | Voir ce que voit un créateur · Chercher des créateurs | See what a creator sees · à écrire | `preview.link` · nouvelle |
| S27 | Mettre en pause · Elle n'accepte plus de candidature ; les échanges déjà ouverts ne sont pas touchés. Vous la reprenez quand vous voulez, sans nouvelle validation. (mobile : Elle n'accepte plus de candidature ; vous la reprenez quand vous voulez.) | Pause campaign ; à écrire | `lifecycle.pause` ; nouvelle |
| S28 | Reprendre · Elle accepte de nouveau les candidatures, sans nouvelle validation. · Reprendre la campagne | Resume campaign (« Reprendre ») ; à écrire | `lifecycle.resume` ; nouvelle |
| S29 | Clôturer · Clôturer est définitif : la campagne ne pourra plus être rouverte, vous pourrez seulement en créer une nouvelle. Aucune donnée n'est effacée et les échanges déjà ouverts ne sont pas touchés. · Je comprends que c'est définitif · Oui, clôturer définitivement (mobile : Clôturer est définitif : la campagne ne pourra plus être rouverte.) | = sauf case et version mobile : à écrire | `lifecycle.close`, `.closeWarning`, `.closeConfirm` ; nouvelle |
| S30, S31 | {n} jours de candidatures · Gérer · Reprendre · Corriger · Suivi | à écrire | nouvelle |
| S32 | Campagne en pause — les candidatures sont suspendues. · Campagne clôturée, définitivement. | à écrire · Campaign closed, for good. | `status.paused` (même FR) · `lifecycle.done.close` |

## 5. Interactions, états, responsive, clavier
- « Lire la suite » : bascule `aria-expanded`, « Réduire ». Retour → E12. « Corriger ma campagne » → E07.1. « Voir ce que voit un créateur » → `/campagnes/[id]/apercu` (nouvel onglet). « Chercher des créateurs » → `/createurs`.
- Pause : repli → bouton → `POST pause` → état pause, annonce ; reprise idem, sans annonce dans la maquette (proposé : `lifecycle.done.resume`). Clôture : case → bouton actif → `POST close` → état close, annonce. La case remplace la confirmation en deux temps du code (préserver le refus d'un double appel).
- États. Geste en cours : non montré : `lifecycle.pausing`, `resuming`, `closing`, `aria-disabled` préservés (`CampaignLifecyclePanel.tsx:24-28`) ; proposé : dans le bouton. Échec : non montré : `lifecycle.failed.*` préservé, C17 erreur sous le repli, focus (`:57-61`, `:80-84`). Pause d'INFLUX : non montrée : pas de « Reprendre », texte `failed.pausedByInflux` proposé avant le clic (E18-Q7). Refus « contact » : `refusal.contact` sans « Corriger ». Chargement, indisponible, introuvable, hors ligne : préservés (`CampaignFormScreen.tsx:131`, `:150-170`) ; proposé : C09 de la grille, C08, C17. Champs facultatifs vides : lignes absentes. Brief court : pas de « Lire la suite ».
- Responsive. 1440, 1280 : deux colonnes, encadré collant. 768 et 375 : une colonne, encadré absent, barre fixe, « Suivi » en fin de page ; « Gérer », « Reprendre » mènent à `#acts`. « Chercher des créateurs » et S24 absents sous 1 024.
- Clavier : `details` natifs ; case et bouton dans l'ordre ; focus rendu au résumé du repli après annulation (non montré : le repli se referme). Focus sur le `h1` après E07.7 (E07-Q21). Animation : chevron `rotate` 180°, `duration-fast` ; nulle si mouvement réduit.

## 6. Critères d'acceptation
- **E18.1-CA01** À 1440 : colonnes 651,6 et 372,4, écart 64 ; à 1 023 px et moins : une colonne, sans encadré.
- **E18.1-CA02** Un seul `h1`, 640 px max ; retour nommé ; taille fixe du `h1` selon X1.
- **E18.1-CA03** Cinq états, chacun un mot, une icône et une phrase ou une notice ; textes conformes au §4.
- **E18.1-CA04** Les dates viennent de l'API et suivent la langue ; aucune date ni référence inventée.
- **E18.1-CA05** À corriger : motif, message de l'agent et suite ; « Corriger ma campagne » seule action verte, absente pour un refus « contact ».
- **E18.1-CA06** L'essentiel a toujours quatre cellules ; `dl` bien formée (X9) ; « dans {n} jours » calculé sur la date civile du fuseau de la marque, jamais négatif.
- **E18.1-CA07** Budget, devise, référence interne dans l'encadré seulement ; aucun taux ni net.
- **E18.1-CA08** Brief coupé à 5 lignes, dépliable au clavier ; texte complet dans le DOM.
- **E18.1-CA09** Une rubrique vide n'affiche ni titre ni ligne.
- **E18.1-CA10** Historique : seules des dates servies, plus récent en premier, `time` daté.
- **E18.1-CA11** L'encadré dit le délai ou l'état ; aucun compteur de candidatures ni montant.
- **E18.1-CA12** Le commercial n'est nommé que si l'API le sert (E18-Q2) ; aucun contact direct.
- **E18.1-CA13** L'aperçu ouvre la réponse de `creator-view` ; aucun lien de ce bloc n'est vert.
- **E18.1-CA14** Pause et reprise : un appel par clic, état relu, résultat annoncé et focalisé ; échecs motivés.
- **E18.1-CA15** Clôture : bouton inactif sans la case, texte complet (bureau et téléphone), définitive.
- **E18.1-CA16** Sous 1 024 : barre fixe par état (aucune en close et validation) sans masquer le contenu ; « Suivi » en fin de page, case de clôture comprise.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E18.1-T01 | e2e, a11y | `apps/web/e2e/brand-campaign-states.spec.ts` (« six states in words ») | cinq états, textes, dates, axe (dont `dl`) |
| E18.1-T02 | e2e | idem (« pauses, resumes and closes », « a pause of INFLUX… ») | gestes, confirmation, refus, motif |
| E18.1-T03 | visuel | `apps/web/e2e/wizard-visual.spec.ts` (nouveau) | 5 états, 1440, 1280, 768, 375, barre fixe |
| E18.1-T04 | e2e | `apps/web/e2e/brand-campaign.spec.ts` (L3B-E3) | aperçu depuis E18, même contenu servi |
| E18.1-T05 | unitaire | `apps/web/tests/campaign-view.test.ts`, `campaign-preview-view.test.ts` | rubriques, jours restants, historique |

À conserver : `copy.lifecycle.pause`, `.resume`, `.close`, `.closeConfirm`, `data-creator-preview`, `data-preview-section`, `data-field` de l'aperçu. À réécrire : `copy.lifecycle.cancel` (pas d'annulation), `copy.form.locked`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Formulaire aux champs figés | `CampaignFormScreen.tsx:280`, `:297-307` | C40 en lecture | créer, supprimer la lecture figée |
| `form.locked`, `Submitted` | `:280`, `:384-407` | notice S08 | supprimer |
| Panneau « Vie de la campagne » | `CampaignLifecyclePanel.tsx:96-185` | replis de l'encadré | faire évoluer |
| Lecture d'une campagne | `CampaignReadBody.tsx` (aperçu) | garder tel quel ; E18 = composition E08 | réutiliser |
| Budget, référence en lecture | absents en lecture | `zone-int` | créer |

Données requises | servie ? | écart :
- Titre, brief, dates, livrables, droits, audience, `currency`, `budgetBand`, `creatorsWanted`, `internalReference`, `submittedAt`, `createdAt`, `refusal` (dont `decidedAt`) : servis par `GET /v1/me/campaigns/:id` (`campaign.ts:407-459`).
- Date de publication (`first_published_at`, 0308), `paused_at`, `pause_origin`, `closed_at` (0309, lisibles de la marque, EC-L3C-04-10) : **en base, non servies** → écart d'API.
- Référence `CMP-2026-0418` : **aucune colonne** → écart de modèle. Commercial nommé : `owner_agent_id` (0308, « Never served to a creator ») : **non servi à la marque**, avatar et nom à décider. Historique : **aucun service de lecture côté marque**. Créateur à corriger : auteur du refus non servi.
Hors lot : candidatures, mises en relation dans l'encadré (Lot 4) ; « modifier » et « dupliquer » une campagne publiée (`17` §4.9, RG7, réponse 1 du fondateur).

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E18-Q1 | Référence `CMP-2026-0418` sans colonne ni règle ; référence interne `PO-…` réelle | Donnée inventée | Retirer la référence, garder la date | architecte | oui |
| E18-Q2 | Commercial nommé avant toute mise en relation ; D45, D47 : nommé dans la conversation ; `09` RG97 : attribution seulement | Règle de révélation | Nommer dès l'attribution, ou « Votre commercial INFLUX » sans nom | fondateur | oui |
| E18-Q3 | « Close » ici, « Clôturée » en E12 et `status.label.closed` ; « clos » dans l'historique | Vocabulaire | « Clôturée » partout | product-owner | non |
| E18-Q4 | Créateurs recherchés dans l'encadré interne ; RG66, RG98 : publié | Texte faux | Les sortir de l'encadré (E07-Q2) | fondateur | oui |
| E18-Q5 | Historique (auteur, heure, « le brief ») sans service ; motif réduit à un mot | Écart d'API | Historique limité à création, envoi, publication, pause, clôture, refus, depuis les dates servies ; détail du refus dans S09 | architecte | oui |
| E18-Q6 | Type, résumé public, produit décrit, catégorie, délai, éléments attendus, plafond, âges, genre, langues multiples absents ; `17` §4.9 : « les 8 blocs en lecture » | Lecture incomplète | Suivre la maquette ; compléter par l'aperçu | fondateur | non |
| E18-Q7 | « En pause depuis… » : origine de la pause (marque ou INFLUX) non montrée ; « Reprendre » proposé dans les deux cas | Action refusée après clic | Masquer « Reprendre » si `pause_origin = influx`, avec la phrase | product-owner | oui |
| E18-Q8 | Une adresse pour E07 et E18 : le rejet doit-il ouvrir la fiche ou le formulaire ? | Routage | E18 par défaut, formulaire à `?step` | architecte | non |
| E18-Q9 | « sous 1 jour ouvré », « En relecture » : paramètre et revue renforcée (E07-Q17) | Délai faux | Idem | product-owner | non |
| E18-Q10 | Téléphone : clôture sans case, texte abrégé, lien au lieu d'un bouton ; pas de « Suivi » à corriger | Garde-fou perdu | Même case et même texte à toutes les largeurs | product-owner | oui |
| E18-Q11 | Bouton danger désactivé sans la case ; `17` §2.2 et RG4 : jamais désactivé sans explication ; contraste d'un bouton inactif non montré | A11y | Case obligatoire, bouton actif qui dit ce qui manque | expert-ux | non |
| E18-Q12 | « 9 jours » : calcul et seuils (0 jour, date passée, campagne fermée aux candidatures, RG72) non définis | Libellés manquants | « Dernier jour », « Candidatures closes » | product-owner | non |
| E18-Q13 | X1 (`clamp`, `text-heading-3`), X3, X5, X7 (avatar), X9, X11 | Charte, A11y | Voir X | expert-ux | non |
| E18-Q14 | Lien d'aperçu : maquette → `proto-campagnes-createur.html#fiche`, code → `/apercu` existant, sans maquette | Destination | Garder `/apercu` (§10) | expert-ux | non |
| E18-Q15 | Notice et phrase d'état en pleine largeur (1 088) au-dessus de la grille ; ligne longue (> 75 caractères) | Lisibilité | Garder | expert-ux | non |

## 10. Écrans du périmètre sans maquette
| Écran ou bloc | Route | Composant | Situation | Proposition |
|---|---|---|---|---|
| Aperçu de campagne « Ce que voit un créateur » | `/fr/campagnes/[id]/apercu`, `/en/campaigns/[id]/preview` | `CampaignPreviewScreen`, `CampaignReadBody` | aucune maquette ; E07.6, E18 y mènent ; seule vue servie par `creator-view` (RG102) ; notices RG32, RG40, `preview.banner`, marque non publiée | reprendre la composition de E08 (fiche créateur) avec bandeau d'aperçu C17 ; arbitrage expert-ux |
| Marque vérifiée (parcours du badge) | `/fr/compte/profil/marque-verifiee`, `/en/account/profile/verified-brand` | `BrandVerificationScreen` (affirme, publie le code, suivi), `BrandRequestState`, `BrandBadgeLine` | aucune maquette ; E10.6 y mène ; libellés D34 (juriste) | reprendre la forme de E14 (vérifications créateur) sans changer les textes |
| Bloc « Marque vérifiée » du profil | `/compte/profil` | `BrandVerificationBlock` | remplacé par la ligne de E10.6 ; états non montrés (E10-Q14) | voir E10b §5 |
| État du profil dans la colonne | coque | `AccountStateBlock` | montré partiellement (état seul ; « Compléter mon profil » en E12) ; action « Soumettre mon profil » et manques non montrés | suivre E01a (E01.0-S11 à S13) |
| Accueil marque | `/fr/marque`, `/en/brand` | `BrandHome` | couvert par E01 | hors de ce fichier |
| État vide, erreur, refus du profil (suspendu, refusé, révision) | `/compte/profil` | `ProfileStateNotice` | non montrés | voir E10b §5 |
| États d'envoi et de déclaration RG85 | `/campagnes/[id]` | `CampaignSubmitPanel` | non montrés | voir E07b (E07-Q17) |
