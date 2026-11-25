# E14 — Vérifications créateur (créateur)
> Maquette : `proto-verifications.html` (états `hub`, `hub-vide`, `propriete`, `propriete-envoyee`, `audience`, `audience-examen`, `audience-refusee`, `audience-accordee`, `contestation`, `contestation-envoyee`, `contestation-maintenue`, `contestation-infirmee`) · page de comparaison `ecran-14-verifications.html` · validée le 2026-11-24 (07) · Constats : U22, U28

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|
| E14.1 | Mes vérifications | **nouvelle** (proposée `/fr/compte/verifications`) | **nouvelle** (`/en/account/verifications`) | aucun ; matière : `VerificationLineState.tsx`, `DisputeNotice.tsx`, `BadgeLine.tsx` | `hub`, `hub-vide` | L | E14-Q1, C56, E03.3 |
| E14.2 | Faire vérifier mon compte | `/fr/compte/profil/verification/propriete?network=` | `/en/account/profile/verification/ownership?network=` | `OwnershipScreen.tsx`, `CodeBox.tsx` | `propriete`, `propriete-envoyee` | M | E14-Q2, Q3 |
| E14.3 | Faire vérifier mon audience | `/fr/compte/profil/verification/audience?network=` | `/en/account/profile/verification/audience?network=` | `AudienceScreen.tsx` | 4 états | L | E14-Q4, Q5 |
| E14.4 | Contester une décision | `/fr/compte/profil/verification/contestation?request=` ou `?badge=` | `/en/account/profile/verification/appeal` | `AppealScreen.tsx` | 4 états | M | — |

Dossier : `apps/web/src/components/verification/`. À préserver :
- L'écran est l'état de l'API, jamais une mémoire locale : étape déduite (`verification-view.ts:350` `ownershipJourneyOf`, `:501` `audienceJourneyOf`) ; relecture après chaque geste (`use-gesture-runner.ts`) ; focus sur le titre de l'étape (`OwnershipScreen.tsx:180-189`).
- Seul un agent accorde un badge ; aucune saisie de chiffres par le créateur (`08` RG9, RG25). Réseau en `query`, jamais un identifiant de compte (`member-paths.ts`, J4S-7).
- Code : copie, échec de copie dit (`ownership.code.copyFailed`), expiration et nouveau code, annulation (`OwnershipScreen.tsx:362-470`) ; consigne par réseau (`ownership.code.where.*`, 11 clés).
- Pièces : une par une, un échec ne coûte rien aux autres, réessayer, écarter, retirer (`AudienceScreen.tsx:530-700`) ; **nom du fichier ni lu ni conservé** (`audience.deposit.private`, 18 T9.9).
- Audience verrouillée sans propriété (`audience.locked.*`, RG12) ; renouvellement (`refresh`, `renewable`).
- Contestation : fenêtre, une par décision, 4 raisons, texte obligatoire pour « Autre » (`dispute-view.ts:141`), 1 000 caractères, aucune coordonnée (`appeal.failure.directContact`), décision introuvable (`appeal.gone`).
- État de vérification dans la ligne de réseau du profil : `VerificationLineState.tsx` (devient une ligne d'état et un lien, E03.3).

API : `GET /v1/me/verification` ; `POST /v1/me/verification/requests` ; `POST …/requests/{id}/code`, `/submit`, `/cancel` ; `PUT …/requests/{id}/evidence` ; `DELETE …/evidence/{evidenceId}` ; `GET`, `POST /v1/me/verification/disputes` ; `GET /v1/me/creator-profile/networks` (pseudo, lien).

## 2. Structure
- Colonne `.vp` : `max-width --container-narrow` (768), `gap --spacing-6` (32), sans carte. 1 440 : x 304, l 768 ; 1 280 : x 299,2, l 768 ; 768 : x 27,8, l 712,4 ; 375 : x 16, l 343.
- En-tête : retour (E14.2 à 4), `h1` à `--text-title-section` (20 px), méta. `gap` 8.
- Sections `.sec` : filet haut `--color-border-default`, `padding-top` 24, `gap` 12 ; `h2` `--text-md` display gras.
- E14.1 : titre, bandeau, une section par réseau, mention. Ligne `.vrow` : `7rem` + reste, `gap` 8 × 16, `padding` 12 0, filet `--color-border-subtle` entre lignes ; sous 480 px, une colonne.
- E14.2 : affirme / n'affirme pas en 2 colonnes de 376 (dès 640 px, X3), puis code, notice, repli, action. Boîte du code : `--color-surface-raised`, `--radius-md`, `padding` 16, 768 × 78,8 (375 : 343 × 121,8, bouton sous le code).
- E14.3 : visible / à masquer en 2 colonnes de 376 (dès 640) ; liste de fichiers, lignes de 69,3, icône 20 + texte + action.
- E14.4 : décision, formulaire (raisons en colonne de 44 px, zone de texte 150), mentions ; suivi : propriétés (libellé 208, à 375 libellé 208 et valeur étroite).
- Un seul niveau de boîte. Rien de collant ni de fixe hors coquille.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E14.1-S01 | Navigation | C56 | entrée « Mes vérifications » dans le sous-menu de « Compte », après « Mon profil » | créateur | hub `.m-sub` | E14.1-CA01 | E14.1-T01 |
| E14.1-S02 | En-tête | C02 | `h1` + phrase secondaire | toujours | hub `.vp-head` | E14.1-CA01 | E14.1-T01 |
| E14.1-S03 | Bandeau | C17 | notice d'alerte : nombre + un lien par action vers sa section | au moins une action due | hub `.attn` | E14.1-CA02 | E14.1-T02 |
| E14.1-S04 | Réseau | C03 | `h2` réseau + pseudo en secondaire ; « pseudo et lien à renseigner » si absent | par ligne de réseau | hub `.sec > h2` | E14.1-CA03 | E14.1-T01 |
| E14.1-S05 | Propriété | C13 | badge vérifié bleu daté + phrase d'exactitude | badge actif | hub `#v-ig .vrow` 1 | E14.1-CA04 | E14.1-T02 |
| E14.1-S06 | Propriété | C10 | phrase + « Faire vérifier ce compte » (secondaire 227,9 × 46,8) | absent | hub-vide `#v-ig` | E14.1-CA05 | E14.1-T02 |
| E14.1-S07 | Propriété | C13 | badge d'erreur daté, motif, suite, « Redemander la vérification », lien « Contester cette décision » + échéance `--text-xs` | refusée | hub `#v-tt` | E14.1-CA06 | E14.1-T03 |
| E14.1-S08 | Propriété | C11 | phrase + lien « Renseigner le pseudo et le lien » | identifiant manquant | hub YouTube | E14.1-CA05 | E14.1-T02 |
| E14.1-S09 | Audience | C13 | badge d'alerte « À rafraîchir » (clock), phrase, « Rafraîchir mon audience » (primaire 235,8 × 44,8) | à rafraîchir | hub `#v-ig .vrow` 2 | E14.1-CA04 | E14.1-T02 |
| E14.1-S10 | Audience | C05 | phrase de condition, sans action | propriété non établie | hub-vide, hub `#v-tt` | E14.1-CA05 | E14.1-T02 |
| E14.1-S11 | Mention | C05 | ce qu'une marque lit, `--text-xs` secondaire | toujours | hub `p.xs` | E14.1-CA07 | E14.1-T01 |
| E14.2-S01 | En-tête | C41 | retour « ‹ Mes vérifications », `h1`, « Étape n sur 2 · … » | toujours | propriete `.vp-head` | E14.2-CA01 | E14.2-T01 |
| E14.2-S02 | Affirme | C65 | 2 listes : 4 affirmations (check bleu), négations (x tertiaire) | étape 1 | propriete `.aff` | E14.2-CA02 | E14.2-T01 |
| E14.2-S03 | Code | C52 | code display 20 px espacé 0,06em, « Copier » → « Copié » 2 s ; validité | étape 1 ; code sans bouton à l'étape 2 | propriete `.code` | E14.2-CA03 | E14.2-T02 |
| E14.2-S04 | Code | C51 | 3 consignes numérotées, puis phrase de constat | étape 1 | propriete `.steps` | E14.2-CA04 | E14.2-T01 |
| E14.2-S05 | Garantie | C17 | notice info, shield-check : jamais de mot de passe | toujours | propriete `.notice--info` | E14.2-CA05 | E14.2-T01 |
| E14.2-S06 | Repli | C26 | « Ce qui ne suffit pas, et le compte privé », 2 points | étape 1 | propriete `details.fold` | E14.2-CA05 | E14.2-T01 |
| E14.2-S07 | Action | C10 | « J'ai collé le code : envoyer ma demande », primaire 349,2 × 44,8 | étape 1 | propriete `.actions` | E14.2-CA06 | E14.2-T02 |
| E14.2-S08 | Suivi | C17 | notice de réussite avec délai 1 jour ouvré | étape 2 | propriete-envoyee | E14.2-CA06 | E14.2-T02 |
| E14.2-S09 | Suivi | C05 | « Gardez le code… », « Revenir à mes vérifications » secondaire | étape 2 | propriete-envoyee | E14.2-CA06 | E14.2-T02 |
| E14.3-S01 | En-tête | C13 | retour, `h1`, badge « Compte vérifié sur … » + « condition remplie » | propriété établie | audience `.vp-head` | E14.3-CA01 | E14.3-T01 |
| E14.3-S02 | Repli | C26 | ce que le badge affirme | dépôt | audience `details.fold` | E14.3-CA02 | E14.3-T01 |
| E14.3-S03 | Capture | C65 | capture attendue par réseau ; visible (check) ; à masquer (eye-off) ; fraîcheur | dépôt | audience `#h-piece`, `.chk` | E14.3-CA03 | E14.3-T01 |
| E14.3-S04 | Fichiers | C64 | une ligne par fichier : icône, nom, état, « Retirer » ; ligne refusée en rouge avec motif | dépôt ; lecture seule en examen | audience `#files` | E14.3-CA04 | E14.3-T02 |
| E14.3-S05 | Fichiers | C10 | « Ajouter une capture » secondaire + plus | dépôt | audience `#add` | E14.3-CA04 | E14.3-T02 |
| E14.3-S06 | Envoi | C10 | « Envoyer ma demande » primaire ; erreur dessous si fichier refusé | dépôt | audience `#send-aud`, `#aud-err` | E14.3-CA05 | E14.3-T02 |
| E14.3-S07 | Examen | C17 | notice info, hourglass | envoyée | audience-examen | E14.3-CA05 | E14.3-T02 |
| E14.3-S08 | Refus | C17 | notice d'alerte : date, motif, suite, « Redéposer une capture », « Contester », échéance | refusée | audience-refusee | E14.3-CA06 | E14.3-T03 |
| E14.3-S09 | Octroi | C13 | badge bleu daté + phrase période et source | accordée | audience-accordee | E14.3-CA07 | E14.3-T02 |
| E14.3-S10 | Octroi | C07 | 4 chiffres constatés, précision en dessous « Déclaré par vous : … » | accordée, E14-Q4 | audience-accordee `.figs` | E14.3-CA07 | E14.3-T02 |
| E14.3-S11 | Octroi | C05 | échéance et rappel à 15 jours | accordée | audience-accordee `p.sm` | E14.3-CA07 | E14.3-T02 |
| E14.4-S01 | Décision | C05 | décision datée, motif secondaire, échéance en gras | échéance : avant envoi | contestation `section` 1 | E14.4-CA01 | E14.4-T01 |
| E14.4-S02 | Formulaire | C21 | 4 raisons, cible 44 ; erreur dessous | avant envoi | contestation `#ct-r` | E14.4-CA02 | E14.4-T02 |
| E14.4-S03 | Formulaire | C18 | explication : mention d'obligation qui suit la raison, aide, 5 lignes, compteur | avant envoi | contestation `#ct-t` | E14.4-CA02 | E14.4-T02 |
| E14.4-S04 | Formulaire | C05 | pas de pièce jointe (icône info) ; qui réexamine (`--text-xs`) | avant envoi | contestation | E14.4-CA03 | E14.4-T01 |
| E14.4-S05 | Formulaire | C12 | « Envoyer ma contestation » primaire, « Annuler » texte | avant envoi | contestation `.actions` | E14.4-CA02 | E14.4-T02 |
| E14.4-S06 | Suivi | C17 | notice de réussite | envoyée | contestation-envoyee | E14.4-CA04 | E14.4-T02 |
| E14.4-S07 | Suivi | C07 | date de l'état, raison, explication | envoyée, tranchée | `.props` | E14.4-CA04 | E14.4-T02 |
| E14.4-S08 | Issue | C17 | « Issue de votre contestation » + notice d'alerte (maintenue, lien) ou de réussite (infirmée) | tranchée | contestation-maintenue, -infirmee | E14.4-CA05 | E14.4-T03 |

## 4. Textes
Table complète (FR exact, EN, clé) : `E14-verifications-textes.md` (limite de taille).

## 5. Interactions, états, responsive, clavier
- **Bandeau** : lien → ancre de la section, focus sur son `h2`. **Copier** : « Copié » 2 s, annonce « Code copié. » ; échec : `copyFailed` sous le code.
- **Envoyer la demande** (E14.2) : `submit`, puis étape 2, focus sur le `h1`, annonce de la notice.
- **Ajouter / Retirer** (E14.3) : annonces « {nom} déposé. », « {nom} retiré. » ; ligne `rise-in` 200 ms. **Envoyer** avec un fichier refusé : erreur S06, annonce, focus sur « Retirer » du fichier refusé.
- **Contestation** : sans raison → erreur, focus sur la première raison ; « Autre » sans texte → erreur, `aria-invalid`, focus ; erreurs effacées à la saisie ; succès → suivi.
- **États non montrés**, préservés (fichier:ligne) et représentation proposée :

| État | Aujourd'hui | Représentation |
|---|---|---|
| chargement, indisponible | `VerificationLineState.tsx:63-80`, `OwnershipScreen.tsx:131-148` | C09 ; C17 + « Réessayer » |
| aucun réseau au profil | section absente | C08 + lien vers E03.3 |
| demande commencée, en cours, code expiré | `RequestState.tsx`, `line.cta.resume`, `see`, `renew` | C13 info (clock) + action secondaire |
| badge à reconfirmer | `verif.badge.toReconfirm`, `line.cta.reconfirm` | comme S09 |
| audience absente, propriété établie | `line.absent.audience`, `audienceStart` | comme S06 |
| badge retiré (motif, contestation) | `DisputeNotice.tsx` `RevocationText` | comme S07 |
| badge renouvelable (J-15), expiré | `verif.expiry.*` | comme S09 |
| contestation en cours ou tranchée vue du hub | `RowDisputes` | ligne + « Voir ma contestation » |
| nouveau code, annuler la demande | `OwnershipScreen.tsx:413`, `:470` | C11 sous S07 |
| envoi ou dépôt en cours, quota, plafond | `audience.deposit.attempt.*`, `audience.errors.*` | état de ligne C64 |
| issue « nouvelle demande », « autre », sans objet | `appeal.outcome.*`, `appeal.state.withdrawn` | C17 alerte |
| décision non contestable | `appeal.gone` | C08 + retour |
| audience sans propriété | `audience.locked.*` | C17 + lien E14.2 |

- **Responsive** : 1 440, 1 280 identiques ; 768 : 712,4 ; 375 : `.vrow` et listes en une colonne, boîte du code sur deux lignes ; « J'ai collé le code : envoyer ma demande » mesure 349,2 pour 343 disponibles (dépasse la gouttière de 6 px).
- **Clavier** : replis natifs ; liens du bandeau en ancres ; « Retirer » nommé par le fichier (nom accessible à ajouter).
- **Animations** : repli chevron 200 ms, contenu `rise-in` 200 ms ; fichier `rise-in` 200 ms ; `--ease-standard` ; rien en mouvement réduit.

## 6. Critères d'acceptation
- **E14.1-CA01** Page atteinte par le sous-menu, entrée courante unique ; « Mes sessions » conservée.
- **E14.1-CA02** Le bandeau ne liste que des actions dues et disparaît sans action.
- **E14.1-CA03** Un réseau par section ; aucun badge global (`08` RG13).
- **E14.1-CA04** Tout badge porte sa date et son texte, jamais la couleur seule (RG4).
- **E14.1-CA05** L'action proposée est celle de `ownershipActionOf` et `audienceActionOf` ; la condition est écrite avant.
- **E14.1-CA06** Le refus dit motif, suite, contestation et échéance.
- **E14.1-CA07** La mention est la phrase servie aux marques.
- **E14.2-CA01** Étape déduite de l'API ; reprise à la bonne étape.
- **E14.2-CA02** Les quatre affirmations et toutes les négations de RG2 sont lues avant le code (E14-Q3).
- **E14.2-CA03** Code copiable, validité affichée, expiration traitée ; code visible à l'étape 2.
- **E14.2-CA04** Consigne exacte du réseau (E14-Q6).
- **E14.2-CA05** La phrase « jamais votre mot de passe » est toujours visible.
- **E14.2-CA06** L'envoi n'a lieu qu'au geste ; le délai est annoncé.
- **E14.3-CA01** Sans propriété établie, aucun dépôt possible.
- **E14.3-CA02** Le repli reprend RG1, RG2, RG5.
- **E14.3-CA03** Capture attendue propre au réseau ; consignes de cadrage avant le dépôt.
- **E14.3-CA04** Un fichier en échec ne retire aucun autre ; aucun nom de fichier envoyé à l'API.
- **E14.3-CA05** Envoi refusé tant qu'il n'y a aucune capture valide, avec la raison.
- **E14.3-CA06** Refus : motif fermé, suite, contestation.
- **E14.3-CA07** Octroi : date, période, source, échéance ; chiffres selon E14-Q4.
- **E14.4-CA01** Une contestation par décision, dans la fenêtre affichée.
- **E14.4-CA02** Raison obligatoire, texte selon la raison, 1 000 caractères, sans coordonnées.
- **E14.4-CA03** Aucune pièce jointe ; règle du second regard écrite.
- **E14.4-CA04** Le suivi montre raison et explication du créateur.
- **E14.4-CA05** Les quatre issues et « sans objet » sont rendues.

## 7. Tests
| ID | Niveau | Fichier | Ce qu'il prouve |
|---|---|---|---|
| E14.1-T01 | visuel, a11y | nouveau `e2e/verification-hub.spec.ts` | page, navigation, axe, FR et EN |
| E14.1-T02 | unitaire | `tests/verification-view.test.ts` | actions et bandeau par état |
| E14.1-T03 | e2e | `e2e/verification-lifecycle.spec.ts` (`:48`) | refus, contestation, reconfirmation |
| E14.2-T01 | visuel, a11y | `e2e/verification-creator.spec.ts` (`:51`, à adapter) | étape 1, ordre des titres (axe `heading-order`) |
| E14.2-T02 | e2e | `e2e/verification-creator.spec.ts` (`:51`, `:293`) | copie, envoi, reprise |
| E14.3-T01 | visuel | `e2e/verification-creator.spec.ts` (`:423`) | consignes |
| E14.3-T02 | e2e | `e2e/verification-creator.spec.ts` (`:423`, `:590`) | PDF refusé, envoi, octroi |
| E14.3-T03 | e2e | `e2e/verification-lifecycle.spec.ts` | refus, redépôt |
| E14.4-T01 | visuel, a11y | `e2e/verification-lifecycle.spec.ts` | formulaire |
| E14.4-T02 | unitaire, e2e | `tests/dispute-view.test.ts`, `e2e/verification-lifecycle.spec.ts` | règles, envoi, suivi |
| E14.4-T03 | e2e | `e2e/verification-creator.spec.ts` (`:293`) | issue infirmée, excuses |

Attributs à conserver : `data-verification-line`, `-row`, `-action`, `data-badge`, `data-badge-state`, `data-badge-notice`, `data-request`, `data-reason`, `data-agent-message`, `data-step`, `data-ownership-code`, `data-code-validity`, `data-pieces`, `data-piece`, `data-attempt`, `data-audience-locked`, `data-expected`, `data-instructions`, `data-dispute`, `data-contestable`, `data-appeal-*`, `data-outcome`, `data-own-text`, `data-failure`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Vue d'ensemble | aucune | E14.1 | créer (route, `MEMBER_PAGE_SLUGS`, `PARENT_PAGES`, sous-menu, page-menu du téléphone) |
| Bloc dans la ligne de réseau | `VerificationLineState.tsx:35` | ligne d'état + lien | faire évoluer |
| Propriété en 3 écrans | `verification-view.ts:331` | 2 écrans | faire évoluer |
| Audience en étapes | `audience.steps.*` | une page | faire évoluer |
| Retour « Mon profil » | `ownership.back` | « Mes vérifications » | faire évoluer |
| Pièces « Capture n : l × h, taille » | `AudienceScreen.tsx:636` | nom du fichier | E14-Q5 |

Données requises : badges, demandes, motifs, échéances, contestations | `GET /v1/me/verification`, `/disputes` | servies. Pseudo de la ligne | `GET …/networks` | servi. Chiffres constatés et déclarés côte à côte, « Constaté sur votre profil public » | `ownBadgeSchema` (`packages/contracts/src/verification.ts:462`) ne porte que période, source, dates | **écart**. Nom du fichier | jamais reçu (`:487`) | écart. Nombre de fichiers (« 6 ») | plafond serveur, non servi | écart.
Hors lot : aucun.

## 9. Contradictions, manques et décisions
| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E14-Q1 | Route de « Mes vérifications » inexistante ; le sous-menu de la maquette ajoute l'entrée et perd « Mes sessions » | navigation | `/compte/verifications`, deuxième entrée ; « Mes sessions » gardée ; les trois parcours restent à leur adresse avec E14.1 pour parent | architecte, expert-ux | oui |
| E14-Q2 | Étape 1 montre un code dès l'arrivée : ouvrir la demande est un `POST` fait aujourd'hui au clic « J'ai compris, obtenir mon code » | demande créée par une simple visite | l'ouvrir au clic depuis E14.1 (« Faire vérifier ce compte ») ; une visite directe sans demande montre l'affirmation et un bouton « Obtenir mon code » (non dessiné) | product-owner, expert-cybersecurite | oui |
| E14-Q3 | Négations réduites à 2 sur 5 (`08` RG2 : performance, qualité, engagements) ; « Ce que les marques verront » retiré ; 3 écrans imposés par `17` §5.3 | texte réglementaire (D34) | garder les 5 négations dans la colonne « N'affirme pas » ; aperçu en repli ; amender `17` §5.3 | expert-conformite-rgpd | oui |
| E14-Q4 | Constaté face au déclaré : données non servies | E14.3-S10 | sans route, n'afficher que les chiffres de la ligne (source `agent_observed`) sans « Déclaré par vous » | architecte | oui |
| E14-Q5 | Nom du fichier affiché ; le produit s'engage à ne pas le lire (`audience.deposit.private`, 18 T9.9) ; « 6 fichiers » non servi | ligne C64 | « Capture n » et dimensions ; nom local seulement pendant l'envoi ; nombre non écrit | expert-conformite-rgpd, expert-cybersecurite | oui |
| E14-Q6 | Consignes génériques (« biographie ») ; 11 libellés par réseau existent, le libellé exact est « à vérifier » (ecran-14) | texte de l'étape | injecter `ownership.code.where.*` dans la consigne 1 | product-owner | non |
| E14-Q7 | « résultats d'une collaboration » contre « d'une campagne » servi aux marques | fausse citation | citer la clé | expert-marketing | non |
| E14-Q8 | États du §5 (demande en cours, reconfirmer, retiré, renouvelable, contestation suivie, autres issues) sans maquette | formes non validées | tableau du §5 | fondateur | oui |
| E14-Q9 | Ligne d'état du profil (E03.3) annoncée mais non dessinée | E03.3 | texte d'état + lien « Mes vérifications » en bas de ligne ouverte | fondateur | oui |
| E14-Q10 | Axe `heading-order` (`h3` avant `h2`, E14.2) ; action débordante à 375 ; libellé `.props` 208 px à 375 ; X3, X11, X13 | accessibilité | `h2` pour l'affirmation ; libellé plus court ou retour à la ligne ; empiler sous 480 px | expert-ux | non |
