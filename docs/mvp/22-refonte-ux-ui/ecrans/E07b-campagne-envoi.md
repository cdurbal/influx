# E07 — Formulaire de campagne, vérifier, envoyer, envoyée (marque)
> Maquette : `proto-campagne.html` (états verifier, verifier-complet, profil-attente, envoyee) · page de comparaison `ecran-7-campagne.html` · validée le 2026-11-24 (07, « Écran 7 ») · Constats : U24, U26, U59, U63
> Assistant et étapes 1 à 3 : `E07a-campagne-etapes.md` ; étapes 4 et 5 : `E07c-campagne-budget-dates.md`. Les éléments E07.1-S01 à S12 (cadre, tête, statut) valent ici.
## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E07.6 | Vérifier et envoyer | `/fr/campagnes/[id]?step=verifier` (à créer) | `/en/campaigns/[id]?step=review` (à créer) | `CampaignSubmitPanel` (dans chaque étape) | verifier, verifier-complet, profil-attente | L | C20, C42, C48, D86, E08 (carte du fil) |
| E07.7 | Campagne envoyée | `/fr/campagnes/[id]` après envoi | `/en/campaigns/[id]` | `Submitted` (`CampaignFormScreen.tsx:384-407`) | envoyee | S | C08, C51, E18 |

À préserver (chemins sous `apps/web/src/components/campaign/`) :
- L'envoi enregistre d'abord l'écran, refuse de partir si une saisie attend (`unsaved`) ou si un champ est refusé (`invalid`) ; un seul envoi à la fois (`use-campaign.ts:328-400`).
- Manques : `missingRequired` de l'API, dans l'ordre du formulaire ; le premier champ prend le focus (`CampaignSubmitPanel.tsx:68-78`).
- Catégorie sensible : case RG85 jamais pré-cochée, texte exact de la base, langue envoyée seulement si cochée (`:145-185`, `campaign-api.ts:58-68`).
- Profil non publié : refus serveur `profile_not_published` → `publish.profileRequired` et lien (`:233-243`). Double clic : `changed: false`, aucun second envoi.
- API : `GET`, `PATCH /v1/me/campaigns/:id` ; `POST /v1/me/campaigns/:id/submit` ; `GET …/creator-view` (carte et lien) ; état du profil par `useMember().brandProfile`.

## 2. Structure
- E07.6 : cadre C41 (E07a §2), sans pied (`wz-foot` masqué), sans lien « Il manque… ». Ordre : en-tête → notice D86 → résumé des manques → carte du fil et son lien → récapitulatif → actions → phrase d'aide. Écarts 24 (`spacing-5`).
- 1440 : contenu x 337, 702 de large ; en-tête 63,8 ; notice D86 702 × 99,1 ; `feedcard` 416 × 221 (`max-width: 26rem`), rayon `radius-card`, padding `spacing-4`, gap `spacing-2` ; récapitulatif : 5 sections, filet haut `border-default`, padding `spacing-4` vertical, gap `spacing-2` ; `dl` C07 : 176 + 502 (`--size-property-label: 11rem`), 14 px, interligne 8 × 24 ; bouton 300,1 × 44,8 ; retour 185,6 × 44.
- Hauteur du cadre : 1 605,6 (verifier), 1 516,6 (verifier-complet), 1 638,8 (profil-attente).
- 1280 : identique (768). 768 : contenu 662,4. 375 : sans cadre ; `feedcard` 343 ; `dl` garde deux colonnes, 176 + 143 ; actions empilées (44,8 puis 44) ; ni pied fixe ni barre ; `m-page` garde le bas réservé.
- E07.7 : `.sent`, colonne `gap: spacing-5`, 768 de large, sans carte, x 304 à 1440 (343 à 375). En-tête : retour, `h1` `t-page` (28 px, 800 ; 24 px sous 1 024), ligne d'état. Notice 768 × 69,4. Section « La suite » `gap: spacing-3` ; pastilles numérotées 28 × 28 (`1.75rem`), `surface-raised`, gap `spacing-3`.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E07.6-S01 | Tête | C41 | Compteur « Vérification » ; 5 segments, incomplets en ambre, tous actifs | toujours | verifier `#wz-count`, `#segs` | E07.6-CA01 | E07.6-T01 |
| E07.6-S02 | Tête | C41 | « Plus que la relecture », « Enregistrer et reprendre plus tard » | toujours | `.wz-meta` | E07.6-CA01 | E07.6-T01 |
| E07.6-S03 | En-tête | C02 | `h2` « Vérifier et envoyer » 20 px, phrase 16 px secondaire | toujours | `#hvs` | E07.6-CA02 | E07.6-T01 |
| E07.6-S04 | Notice D86 | C17 | Avertissement : phrase en gras, suite, triangle | profil de marque non publié | profil-attente `#d86` | E07.6-CA03 | E07.6-T02 |
| E07.6-S05 | Notice D86 | C11 | « Voir mon profil de marque », chevron | profil non publié | `#d86 a.go` | E07.6-CA03 | E07.6-T02 |
| E07.6-S06 | Manques | C20 | Cadre bordé erreur, titre 700 rouge, cercle d'alerte, liste de liens 14 px | après « Envoyer » avec manques ; jamais avant | script `#errsum` (état non capturé) | E07.6-CA04 | E07.6-T01 |
| E07.6-S07 | Manques | C20 | Ligne « Étape {n} — {champ} », ouvre l'étape, centre et focalise le champ, mode correction | un par manque | `#errsum-list a` | E07.6-CA04 | E07.6-T01 |
| E07.6-S08 | Carte | C18 | Libellé « Ce que voit un créateur dans le fil » | toujours | `.stack > p.label` | E07.6-CA05 | E07.6-T01 |
| E07.6-S09 | Carte | C48 | Pastille logo 32, nom, coche (X2), titre, résumé 2 lignes, date, ligne méta 12 px | toujours | `#pv-final .feedcard` | E07.6-CA05 | E07.6-T01 |
| E07.6-S10 | Carte | C11 | « Voir la fiche complète, comme un créateur », flèche externe | toujours | `a.go` | E07.6-CA06 | E07.6-T01 |
| E07.6-S11 | Récapitulatif | C42 | 5 sections, `h3` « {n}. {étape} » 16 px 700 | toujours | `#recap section` | E07.6-CA07 | E07.6-T01 |
| E07.6-S12 | Récapitulatif | C11 | « Modifier » + nom d'étape masqué, à droite | chaque section | `[data-fix]` | E07.6-CA08 | E07.6-T01 |
| E07.6-S13 | Récapitulatif | C07 | 1 : Titre, Type, Résumé public, Produit | toujours | verifier `dl` 1 | E07.6-CA07 | E07.6-T01 |
| E07.6-S14 | Récapitulatif | C07 | 2 : Livrables, Droits d'usage, Exclusivité | toujours | `dl` 2 | E07.6-CA07 | E07.6-T01 |
| E07.6-S15 | Récapitulatif | C07 | 3 : Pays, Langues, Thématiques | toujours | `dl` 3 | E07.6-CA07 | E07.6-T01 |
| E07.6-S16 | Récapitulatif | C14 | Badge « budget interne », œil barré, à côté du titre 4 | toujours | `h3 .layer--internal` | E07.6-CA09 | E07.6-T01 |
| E07.6-S17 | Récapitulatif | C07 | 4 : Produit envoyé, Budget (interne) | toujours | `dl` 4 | E07.6-CA09 | E07.6-T01 |
| E07.6-S18 | Récapitulatif | C07 | 5 : Candidatures, Livraison, Publication | toujours | `dl` 5 | E07.6-CA07 | E07.6-T01 |
| E07.6-S19 | Récapitulatif | C20 | « À compléter : {champ} » 14 px ambre, triangle 16 | par manque de la section | `.missing` | E07.6-CA07 | E07.6-T01 |
| E07.6-S20 | Déclaration | C21, C17 | Notice revue renforcée et case RG85 : non montrées | catégorie sensible | code `CampaignSubmitPanel.tsx:145-185` | E07.6-CA10 | E07.6-T03 |
| E07.6-S21 | Actions | C10 | « Envoyer à INFLUX pour validation » principal | profil publié | `#send` | E07.6-CA11 | E07.6-T01 |
| E07.6-S22 | Actions | C10 | « Revenir à l'étape 5 », texte, chevron | toujours | `#back5` | E07.6-CA08 | E07.6-T01 |
| E07.6-S23 | Actions | C18 | Aide 14 px : non modifiable pendant la relecture, ou brouillon gardé | selon profil | `#send-help` | E07.6-CA03 | E07.6-T02 |
| E07.6-S24 | Retour d'envoi | C17 | Échec, saisie non enregistrée, champ refusé, verrouillée : non montrés | selon réponse | code `CampaignSubmitPanel.tsx:203-246` | E07.6-CA12 | E07.6-T01 |
| E07.7-S01 | En-tête | C11, C02 | Retour « Mes campagnes » ; `h1` titre de la campagne | après envoi | envoyee `.page-head` | E07.7-CA01 | E07.7-T01 |
| E07.7-S02 | En-tête | C13 | Badge information « En cours de validation », sablier ; heure d'envoi | après envoi | `.badge--info`, `#sent-at` | E07.7-CA01 | E07.7-T01 |
| E07.7-S03 | Notice | C17 | Succès sarcelle : campagne envoyée, délai, e-mail | après envoi | `.notice--success` | E07.7-CA02 | E07.7-T01 |
| E07.7-S04 | La suite | C51 | `h2` « La suite » 16 px 700 ; trois étapes numérotées | après envoi | `.steps-next` | E07.7-CA02 | E07.7-T01 |
| E07.7-S05 | Actions | C10 | « Chercher des créateurs en attendant » secondaire | après envoi | `.actions .btn` | E07.7-CA03 | E07.7-T01 |
| E07.7-S06 | Actions | C11 | « Voir mes campagnes », chevron | après envoi | `.actions .go` | E07.7-CA03 | E07.7-T01 |
| E07.7-S07 | Annonce | C29 | « Campagne envoyée à INFLUX. » | à l'arrivée | script `go` | E07.7-CA01 | E07.7-T01 |

## 4. Textes
Clés : `apps/web/src/locales/{fr,en}/campaign.json`. EN absent : « à écrire (expert-marketing) ».
| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S01, S02 | Vérification · Plus que la relecture | à écrire | nouvelle |
| S03 | Vérifier et envoyer · Relisez votre campagne. Un commercial INFLUX la relit avant de l'ouvrir aux créateurs, sous 1 jour ouvré. | à écrire | nouvelle |
| S04 | Votre profil de marque est en cours de validation. Votre campagne est prête : vous pourrez l'envoyer dès que votre profil sera publié, sous 1 jour ouvré. Nous vous préviendrons par e-mail. | à écrire | nouvelle |
| S05 | Voir mon profil de marque | à écrire | nouvelle |
| S06 | Il manque {n} informations pour envoyer votre campagne (annonce : même phrase avec un point) | à écrire | nouvelle (proche : `publish.missing`) |
| S07 | Étape {n} — {champ} | à écrire | nouvelle ; champ : `fields.*.label` |
| S08 | Ce que voit un créateur dans le fil | à écrire | nouvelle |
| S09 | {marque} · {titre} · {résumé} · Candidatures jusqu'au {date} · {réseau} : {livrables} · {pays} · {thématiques} · produit envoyé | à écrire | nouvelle (`feed.card.deadline` diffère : « Candidatures avant le {date} ») |
| S10 | Voir la fiche complète, comme un créateur | à écrire | nouvelle (`preview.link` diffère) |
| S11 | 1. L'offre · 2. Le travail attendu · 3. Pour qui · 4. Le budget · 5. Calendrier et candidature | `form.stepName` | `form.stepName`, `form.steps.n.title` |
| S12 | Modifier (+ « : {étape} » masqué) | à écrire | nouvelle |
| S13 à S15 | Titre · Type · Résumé public · Produit · Livrables · Droits d'usage · Exclusivité · Pays · Langues · Thématiques | Public summary (`fields.publicSummary.label`) ; le reste à écrire | nouvelle sauf Résumé public |
| S16, S17 | budget interne · Produit envoyé · Budget (interne) · Oui · {tranche} · conservé · envoi à votre charge · {nature} · {tranche} {devise} par créateur · {n} créateurs | à écrire | nouvelle |
| S18 | Candidatures · Livraison · Publication · jusqu'au {date} · non précisée · du {date} au {date} | à écrire | nouvelle |
| S19 | À compléter : {champ en minuscule initiale} | à écrire | nouvelle |
| S20 | texte servi par `references.authorizationDeclarations` ; notice `publish.sensitiveNotice` ; erreur `publish.declarationRequired` | valeurs existantes | existantes |
| S21 | Envoyer à INFLUX pour validation | à écrire | nouvelle (remplace `publish.button`) ; occupé : `publish.busy` |
| S22 | Revenir à l'étape 5 | à écrire | nouvelle |
| S23 | Après l'envoi, la campagne n'est plus modifiable pendant la relecture. · Votre brouillon reste enregistré et modifiable. | à écrire | nouvelle |
| S24 | `publish.unavailable`, `publish.unsaved`, `publish.invalid`, `publish.locked`, `publish.profileRequired` | valeurs existantes | existantes, « soumettre » à remplacer par « envoyer » |
| E07.7-S02 | En cours de validation · envoyée aujourd'hui à {h} h {mm} | Being reviewed ; à écrire | `status.label.pending_review` ; nouvelle |
| E07.7-S03 | Votre campagne est envoyée à INFLUX. Un commercial la relit sous 1 jour ouvré ; vous recevrez un e-mail à l'ouverture ou s'il faut la corriger. | à écrire | nouvelle |
| E07.7-S04 | La suite · Un commercial INFLUX relit la campagne : titre, résumé, brief, budget. · Une fois validée, elle s'ouvre aux créateurs et apparaît dans leur fil jusqu'au {date}. · Votre commercial vous présente les candidatures et les créateurs qu'il vous propose. | à écrire | nouvelle |
| E07.7-S05, S06 | Chercher des créateurs en attendant · Voir mes campagnes | à écrire ; See my campaigns à confirmer | nouvelle ; `home.link` (même FR) |

## 5. Interactions, états, responsive, clavier
- Arrivée (Continuer de l'étape 5, lien « voir la liste ») → focus `h2`, annonce « Vérifier et envoyer. »
- « Modifier » → étape en mode correction ; `h1` « Compléter votre campagne » ; pied « Revenir à la vérification » → E07.6.
- « Envoyer » avec manques → C20 affiché, mis en vue, focalisé (`tabindex=-1`), annonce ; aucun appel. Sans manque → enregistrement, `POST submit` ; succès → E07.7, focus `h1`, annonce. C20 disparaît dès qu'il ne reste aucun manque.
- Profil non publié : bouton d'envoi absent ; seul « Revenir à l'étape 5 » reste.
- États. Envoi en cours : non montré : comportement préservé (`publish.busy`, `aria-disabled`, `CampaignSubmitPanel.tsx:189-196`) ; représentation proposée : libellé changé dans le bouton. Refus serveur du profil (course) : `publish.profileRequired` en C17 erreur au-dessus des actions, remplacée par la notice D86 après relecture du profil. `unavailable`, `unsaved`, `locked`, `invalid` : C17 erreur au même endroit. Chargement de la carte : C09 416 × 221. Carte indisponible : C08 et « Réessayer ». Catégorie sensible : S20 entre récapitulatif et actions. Hors ligne : `account.offline` en tête du cadre.
- Après rechargement d'une campagne envoyée : E18 (validation), jamais E07.7 (E07-Q21).
- Responsive : §2. Clavier : ordre du DOM ; liens du résumé natifs ; aucune animation propre hors fondu d'étape (120 ms).

## 6. Critères d'acceptation
- **E07.6-CA01** Compteur « Vérification », segments cliquables, ambre pour toute étape citée par `missingRequired`.
- **E07.6-CA02** Adresse propre à E07.6, reprise au rechargement ; focus sur le `h2`.
- **E07.6-CA03** Profil non publié : notice, lien au profil, bouton d'envoi absent, aide « Votre brouillon… » ; aucun `POST submit` possible depuis l'écran.
- **E07.6-CA04** Un clic avec manques affiche un seul résumé, dans l'ordre du formulaire, focalisé ; chaque lien ouvre l'étape et met le focus dans le champ, repli ouvert s'il le faut.
- **E07.6-CA05** La carte n'affiche ni budget, ni devise, ni valeur du produit ; résumé coupé à 2 lignes ; largeur max 416.
- **E07.6-CA06** Le lien ouvre `/campagnes/[id]/apercu` dans un nouvel onglet annoncé.
- **E07.6-CA07** Les cinq sections montrent la valeur enregistrée, ou « À compléter » ; aucune valeur vide muette.
- **E07.6-CA08** « Modifier » et « Revenir à l'étape 5 » ont un nom distinct par section et ramènent au bon endroit.
- **E07.6-CA09** La tranche de budget n'est rendue que sous « Budget (interne) », jamais avec un net ni un taux.
- **E07.6-CA10** Catégorie sensible : case jamais pré-cochée ; envoi refusé sans elle, focus sur la case.
- **E07.6-CA11** Une seule action verte, jamais désactivée ; un double clic n'envoie qu'une fois.
- **E07.6-CA12** Un échec garde l'écran, dit la cause et permet de recommencer.
- **E07.7-CA01** Après succès : `h1` = titre, badge « En cours de validation », heure, focus et annonce.
- **E07.7-CA02** Trois étapes numérotées lues comme liste ordonnée ; date de candidature au format de la langue.
- **E07.7-CA03** Aucun bouton vert ; liens vers la recherche et « Mes campagnes ».

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E07.6-T01 | e2e, a11y | `apps/web/e2e/brand-campaign.spec.ts` (L3B-E2 « names what is missing », L3B-E3) | manques, liens, correction, envoi, axe |
| E07.6-T02 | e2e | idem (L3B-E1 « waits for a published profile » à inverser) | D86 : brouillon complet, envoi absent ; CA2 refusé par l'API |
| E07.6-T03 | e2e | idem (« a sensitive category is refused without its declaration ») | RG85 |
| E07.7-T01 | e2e, visuel | idem et `apps/web/e2e/wizard-visual.spec.ts` (nouveau) | page envoyée FR et EN, 1440 et 375 |

À conserver : ids `controlIdOf`, `campaign-declaration`, `data-creator-preview` (aperçu). À remplacer : `data-submit-panel` (4 usages) par un attribut sur E07.6 ; `copy.publish.button`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Panneau d'envoi dans chaque étape | `CampaignSubmitPanel.tsx:81-200` | écran E07.6 | supprimer, reprendre `useSubmission` |
| Liste des manques par étape | `:118-144` | C20 | faire évoluer |
| `stepOfParameter` (1 à 5) | `campaign-view.ts:50-56` | + vérification | faire évoluer |
| Réussite en notice dans le formulaire | `CampaignFormScreen.tsx:384-407` | E07.7 | créer |
| Récapitulatif, carte du fil | absents du formulaire | C42, C48 (`CampaignFeedCard.tsx` à réutiliser) | créer |
| Bouton présent quel que soit le profil | `:186-198` | absent si profil non publié | faire évoluer |

Données requises : `missingRequired`, champs, `sectorIsSensitive`, `references`, `submittedAt` (heure d'envoi) : servis (`packages/contracts/src/campaign.ts:407-459`). Carte du fil : `GET …/creator-view` sert la campagne et la marque, mais `brand` vaut `null` tant que le profil n'est pas publié (`campaign-creator-view.ts:125-128`) : écart pour profil-attente. État du profil : `useMember().brandProfile`. Hors lot : « Votre commercial vous présente les candidatures » décrit le Lot 4 (texte seul).

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E07-Q15 | L'envoi n'est plus visible en permanence, et il est absent si le profil n'est pas publié ; `09` RG4 : « visible en permanence, jamais désactivé sans explication » | Règle à amender | Suivre la maquette : lien permanent « voir la liste », explication D86 | product-owner | non |
| E07-Q16 | Notice D86 écrite pour « en cours de validation » seulement ; brouillon, refusé, suspendu non montrés ; D86 (3) impose « Vous pourrez faire valider cette campagne une fois votre profil publié » et le lien vers les manques | Trois textes manquent, l'un serait faux | Brouillon et refusé : texte D86 et « Compléter mon profil » ; suspendu : message neutre | product-owner, expert-marketing | oui |
| E07-Q17 | Déclaration RG85 et revue renforcée (2 jours ouvrés, RG6) absentes ; « sous 1 jour ouvré » en dur, `EC-L3B-10-2` (`CampaignSubmitPanel.tsx:11`) : aucun délai chiffré (paramètre en table) | Obligation légale sans place ; délai faux pour une catégorie sensible | S20 avant les actions ; délai lu du paramètre ou formule sans chiffre | product-owner, expert-ux | oui |
| E07-Q18 | Campagne à corriger rouverte : badge « Brouillon » et `h1` « Création… » faux ; motif du refus absent du formulaire | État `rejected` | Badge « À corriger », `h1` « Corriger votre campagne », motif en C17 sous la tête | expert-ux | oui |
| E07-Q19 | Carte et aperçu reconstruits depuis la saisie ; RG102 : jamais une reconstitution ; `brand` nul si profil non publié ; date, livrables et pays figés dans la maquette | Source de la carte | Carte depuis `creator-view` relue après enregistrement ; titre et résumé en direct ; marque : profil de session si `brand` nul | architecte | non |
| E07-Q20 | Récapitulatif partiel : brief, délai de validation, messages clés, interdits, tailles, âges, genre, éléments attendus, plafond, référence absents | Relecture incomplète avant envoi | Suivre la maquette ; y ajouter le seul délai de validation (obligatoire) si validé | fondateur | non |
| E07-Q21 | E07.7 n'a pas d'adresse et double E18 (validation) | Retour arrière, rechargement | E07.7 affichée une fois après envoi ; ensuite E18 | architecte | non |
| E07-Q22 | Date en jj/mm/aaaa au récapitulatif, en toutes lettres sur la carte ; ligne du produit en une phrase composée non traduisible par morceaux | i18n | Clés ICU complètes ; date courte au récapitulatif | expert-marketing | non |
| E07-Q23 | X2 (coche seule à côté du nom sur la carte) ; X11 (`m-state`) | A11y, charte | Voir X2, X11 | expert-ux | non |
| E07-Q24 | À 375, `dl` garde 176 px pour le libellé, valeur réduite à 143 | Lisibilité | Suivre la maquette ; une colonne sous 480 px si validé | expert-ux | non |
| E07-Q25 | « Votre commercial vous présente les candidatures » : candidatures au Lot 4 | Promesse non tenue au Lot 3 | Garder ou attendre le Lot 4 | fondateur | non |
