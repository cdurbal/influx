# E15 — Aperçu « Ce que voit une marque » (créateur)
> Maquette : `proto-apercu.html` (états `avant`, `apres`, `non-publie`, `sans-visuel`) · page de comparaison `ecran-15-apercu.html` · validée le 2026-11-24 (07) · Constats : U34
> Corps de page : celui de l'écran 2 bis, spécifié dans `E02b-profil-anonyme.md`. Ce fichier porte le cadre d'aperçu et les écarts.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|
| E15.1 | Ce que voit une marque | `/fr/compte/profil/apercu` | `/en/account/profile/preview` | `CreatorPreviewScreen.tsx`, `CreatorCardView.tsx` | `avant`, `apres`, `non-publie`, `sans-visuel` | L | **E02b livré d'abord** (composants partagés), E03.7 |

À ne pas confondre : `/campagnes/[id]/apercu` (`CampaignPreviewScreen.tsx`, `member-paths.ts` `advertiserCampaignPreview`) est l'aperçu **de la marque** (« Ce que voit un créateur »). Il n'existe pas d'aperçu de campagne côté créateur : un créateur y trouve une page inexistante (T14). Hors de ce fichier.

Dossier : `apps/web/src/components/creator-profile/`. À préserver :
- Rôle créateur seul ; `gone` → page inexistante (`CreatorPreviewScreen.tsx:73`) ; indisponible + « Réessayer » ; chargement ; hors ligne.
- L'écran dessine la réponse de l'API et rien d'autre (`07` RG104) ; la projection est `public-projection.ts`, la même que la recherche.
- Onglets WAI-ARIA : flèches, Début, Fin, un seul arrêt de tabulation (`:142-157`).
- Onglet « après » qui n'ajoute rien : notice (`preview.afterEmpty.*`, `:224`), jamais deux fois la même carte.
- Chiffres constatés non montrés dans l'aperçu : note `preview.observed` (`creator-preview-view.ts` `observedNote`).
- Visuels approuvés seuls ; images décoratives (`alt=""`) avec légende à côté (RG84).
- Jamais : e-mail, téléphone, nom légal, secteurs refusés, complétude, montant (RG102, RG103, D78).

API : `GET /v1/me/creator-profile/preview` (`published`, `before`, `after`) ; `GET /v1/me/creator-profile/portfolio/{id}/image`.

## 2. Structure
- Page `.m-page.pa`, pleine largeur du cadre (`--container-max`) : contenu 1 088 à 1 440, 937,6 à 1 280, 712,4 à 768, 343 à 375. La colonne de navigation est celle du créateur.
- Ordre : en-tête `.pv-head` (`gap` 12) → cadre `.pvz` (filet haut, `padding-top` 24, `gap` 24) : chapeau, notice sans visuel, carrousel (téléphone), titre, mosaïque, grille de lecture.
- En-tête : retour, `h1`, phrase, onglets, phrase de l'onglet, notice « pas publié ». Hauteur 192,4 à 1 440, 234,3 à 375.
- Onglets `.ptabs` : piste `--color-surface-raised`, `--radius-pill`, `padding` 4, `gap` 4 ; 370,3 × 44 ; onglet 36 px, `--text-sm` gras moyen, actif `--color-surface-active` + texte primaire (X6, X7). Sous 640 px (X3) : 2 colonnes égales, pleine largeur (343 × 44), `--radius-md`, onglets `--radius-sm`.
- Chapeau : `--text-xs`, capitales, `--tracking-overline`, secondaire, icône eye ; 18,6 de haut (375 : 37,2).
- Grille : `7fr` / `4fr` dès 1 024 (651,6 + 372,4 à 1 440 ; 555,9 + 317,7 à 1 280), `gap` 64 ; encadré collant. Sous 1 024 : une colonne, encadré **masqué**, et aucune barre collante (retirée de la page marque).
- Mosaïque 1 088 × 544 à 1 440, 712,4 × 356,2 à 768 ; carrousel 4:3 bord à bord sous 768 (375 × 281,3).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E15.1-S01 | En-tête | C11 | « ‹ Mon profil », `--text-sm` secondaire | toujours | avant `.pv-head .go` | E15.1-CA01 | E15.1-T01 |
| E15.1-S02 | En-tête | C02 | `h1` « Ce que voit une marque », `--text-title-page`, phrase secondaire | toujours | avant `.pv-head` | E15.1-CA01 | E15.1-T01 |
| E15.1-S03 | En-tête | C22 | 2 onglets segmentés gris, jamais verts, sans coche | profil servi | avant `.ptabs` | E15.1-CA02 | E15.1-T02 |
| E15.1-S04 | En-tête | C05 | phrase de l'onglet, `--text-sm` | toujours | avant, apres `p.sm` | E15.1-CA03 | E15.1-T02 |
| E15.1-S05 | En-tête | C17 | notice info « pas encore publié » | `published` faux | non-publie `.notice` | E15.1-CA04 | E15.1-T03 |
| E15.1-S06 | Cadre | C66 | filet, chapeau en capitales + eye | toujours | avant `.pvz__hat` | E15.1-CA05 | E15.1-T01 |
| E15.1-S07 | Cadre | C17 | notice info, icône image | aucun visuel approuvé | sans-visuel `.notice` | E15.1-CA06 | E15.1-T03 |
| E15.1-S08 | Titre | C02 | `h2` = titre court à la taille de page ; alias + icône bleue (X2) | toujours | avant `.pa-top` | E15.1-CA07 | E15.1-T01 |
| E15.1-S09 | Titre | C05 | avant : eye-off + phrase d'anonymat ; après : eye + phrase de révélation | par onglet | avant, apres `.row--top` | E15.1-CA03 | E15.1-T02 |
| E15.1-S10 | Titre | C39 | bouton cœur inerte, opacité 0,55 (X4), `aria-hidden` | dès 768 | avant `.pa-acts.inert` | E15.1-CA08 | E15.1-T04 |
| E15.1-S11 | Visuels | C34 | mosaïque (dès 768) et « Afficher les {n} visuels », actifs ; galerie plein écran | au moins un visuel | avant `.mosaic` | E15.1-CA06 | E15.1-T04 |
| E15.1-S12 | Visuels | C34 | carrousel bord à bord + compteur « 1 / 6 » (X8) | sous 768 | avant 375 `.carousel` | E15.1-CA06 | E15.1-T04 |
| E15.1-S13 | Résumé | C35 | avant : E02b.1-S10 à S17 ; après : valeurs exactes dans les cases 2 à 4 | par onglet | avant, apres `.keyfig` | E15.1-CA09 | E15.1-T02 |
| E15.1-S14 | Proposé car | C36 | phrase « Exemple : … » avant E02b.1-S18, S19 | toujours dans la maquette, E15-Q2 | avant `#h-why` | E15.1-CA10 | E15.1-T02 |
| E15.1-S15 | Présentation | C26 | E02b.1-S20, S21 | bio servie | avant `#bio` | E15.1-CA07 | E15.1-T01 |
| E15.1-S16 | Réseaux | C44 | avant : E02b.1-S22 à S24 | onglet avant | avant `.net` | E15.1-CA09 | E15.1-T02 |
| E15.1-S17 | Réseaux | C11 | après : pseudo en lien, icône external-link 12 px, mention masquée « ouvre … hors INFLUX » | onglet après, valeur servie | apres `.handle` | E15.1-CA11 | E15.1-T02 |
| E15.1-S18 | Réseaux | C35 | après : Abonnés, Publications (en 30 jours), Commentaires exacts, puis source et date `--text-xs` | onglet après | apres `.figs`, `.src` | E15.1-CA09 | E15.1-T02 |
| E15.1-S19 | Audience | C37 | E02b.1-S25 à S29 ; après : pourcentages exacts à droite, barres **inchangées** | par onglet | apres `.range__val` | E15.1-CA09 | E15.1-T02 |
| E15.1-S20 | Offre | C38 | E02b.1-S30 à S34, sans changement | toujours | avant `#h-off` | E15.1-CA07 | E15.1-T01 |
| E15.1-S21 | Encadré | C39 | disponibilité ; carte : phrase « boutons inactifs » lisible, puis contenu marque inerte (0,55, `aria-hidden`) | dès 1 024 | avant `.aside` | E15.1-CA08 | E15.1-T04 |
| E15.1-S22 | Galerie | C34 | titre « Portfolio · aperçu de ce que voit une marque » | ouverte | avant `#gal` | E15.1-CA06 | E15.1-T04 |

## 4. Textes
Clés de `creator-profile.json`. « X » = à écrire (expert-marketing). Textes du corps : E02b §4.

| Élément | FR exact | EN | Clé |
|---|---|---|---|
| E15.1-S01 | Mon profil | My profile | `preview.back` |
| E15.1-S02 | Ce que voit une marque · Exactement ce que la plateforme sert à une marque, rien de plus. | What a brand sees · Exactly what the platform serves a brand, nothing more. | `preview.title`, `preview.explain` |
| E15.1-S03 | Choisir la vue de l'aperçu · Avant la mise en relation · Après la mise en relation | Choose the preview view · Before an introduction · After an introduction | `preview.tabs`, `.before`, `.after` |
| E15.1-S04 | Avant la mise en relation, une marque ne voit que des tranches : ni pseudo, ni lien, ni chiffre exact. · Après la mise en relation, la marque lit en plus votre pseudo, le lien de votre profil et vos chiffres exacts, avec leur source et leur date. Jamais votre e-mail ni votre téléphone. | valeur existante | `preview.beforeIntro`, `preview.afterIntro` |
| E15.1-S05 | Votre profil n'est pas encore publié : aucune marque ne le voit. Voici ce qu'elle verrait une fois qu'il le sera. | valeur existante | `preview.notPublished` |
| E15.1-S06 | Aperçu · la page de votre profil, vue par une marque | X | nouvelle |
| E15.1-S07 | Aucun visuel approuvé pour l'instant : votre carte s'affiche sans image. | valeur existante | `preview.noVisual` |
| E15.1-S09 | Profil anonyme : aucune identité visible avant la mise en relation. · Mise en relation ouverte : pseudo, liens et chiffres exacts visibles. Jamais votre e-mail ni votre téléphone. | X | nouvelles |
| E15.1-S13 | Audience vérifiée {Instagram} · {47 900} abonnés · {14} publications en 30 jours · {58} commentaires par publication | X | nouvelles |
| E15.1-S14 | Exemple : ce que lit une marque qui cherche la thématique « {Cuisine} » et une audience en {Belgique}. Ces raisons changent avec la recherche de chaque marque. | X | nouvelle |
| E15.1-S16 | Les marques voient des tranches. Pseudo, liens et chiffres exacts : après la mise en relation. | X | nouvelle |
| E15.1-S17 | {@lea.cuisine} · (ouvre {Instagram} hors INFLUX) | X | nouvelle |
| E15.1-S18 | Abonnés · Publications · en 30 jours · Commentaires · par publication · Constatés par INFLUX · chiffres au {date} · Déclarés par le créateur · chiffres au {date} | Followers · X · {source} · figures as of {date} | `preview.source.*`, `preview.figuresAt` ; nouvelles |
| E15.1-S19 | Audience, pourcentages exacts : femmes {71} %, hommes {27} %, autres ou non déclaré {2} %. Constatés par INFLUX sur {Instagram} le {date}. | Audience, exact percentages (titre) · X | `preview.shares` ; nouvelle |
| E15.1-S21 | Ici, la marque garde votre profil dans une sélection privée. Dans l'aperçu, ses boutons sont inactifs. | X | nouvelle |
| E15.1-S22 | Portfolio · aperçu de ce que voit une marque · Fermer la galerie | X | nouvelles |

## 5. Interactions, états, responsive, clavier
- **Onglets** : clic ou flèches gauche et droite (la maquette) ; Début, Fin, haut, bas conservés ; le focus suit l'onglet ; l'état est dans l'ancre de la maquette, en mémoire dans le produit. Le panneau prend le nom de l'onglet actif ; la galerie ouverte se ferme. Sur `non-publie` et `sans-visuel`, revenir à « avant » conserve l'état.
- **Lire la suite**, **galerie**, **carrousel** : actifs (E02b). **Boutons de la marque** : inactifs, hors tabulation et hors lecteur d'écran ; la phrase S21 est lue.
- **Pseudo** : lien externe ; cible et `rel` à fixer (E15-Q4).
- **États** non montrés, préservés : chargement (`preview.loading`, proposé C09), indisponible (`preview.unavailable` + « Réessayer », C17), hors ligne, onglet « après » vide (`preview.afterEmpty.noNetwork`, `.nothingIdentified`, C17 à la place du corps), chiffres constatés masqués (`preview.observed`), réseau ou titre absent (bloc omis), profil sans alias (`page.noStorefront`).
- **Responsive** : 1 440 et 1 280 : deux colonnes ; 768 : mosaïque, une colonne, encadré masqué ; 375 : carrousel, onglets en deux colonnes égales, titre `--text-title-page` sur 3 lignes, cœur masqué.
- **Clavier** : ordre retour, onglets, carrousel ou galerie, « Lire la suite », pseudos, segments d'audience.
- **Animations** : onglet `background-color` et `color` 120 ms `--ease-standard` ; galerie : dialogue commun C27.

## 6. Critères d'acceptation
- **E15.1-CA01** En-tête conforme à §2 ; un seul `h1`, le titre court passe en `h2`.
- **E15.1-CA02** Onglets gris, sans coche ni vert ; un seul arrêt de tabulation ; `aria-selected`, `aria-controls` corrects.
- **E15.1-CA03** La phrase et l'icône changent avec l'onglet et disent la règle en toutes lettres.
- **E15.1-CA04** Profil non publié : notice présente, corps affiché.
- **E15.1-CA05** Le cadre dit « Aperçu » ; aucune donnée hors de la réponse de l'API.
- **E15.1-CA06** Visuels approuvés seuls ; sans visuel : notice, ni mosaïque ni carrousel ni galerie.
- **E15.1-CA07** Corps identique à E02b (mêmes composants, mêmes règles de visibilité).
- **E15.1-CA08** Boutons de la marque non focalisables, non annoncés, non cliquables ; contraste AA du texte visible (axe, X4).
- **E15.1-CA09** Avant : tranches seules. Après : valeurs exactes avec source et date, dans l'ordre D61.
- **E15.1-CA10** « Proposé car » annoncé comme un exemple, ou absent (E15-Q2).
- **E15.1-CA11** Jamais e-mail, téléphone, nom légal, ville non servie, montant ni complétude.

## 7. Tests
| ID | Niveau | Fichier | Ce qu'il prouve |
|---|---|---|---|
| E15.1-T01 | visuel, a11y | `e2e/creator-preview.spec.ts` (`:38`, à adapter) | page aux 4 largeurs, axe, FR et EN |
| E15.1-T02 | e2e, unitaire | `e2e/creator-preview.spec.ts`, `tests/creator-preview-view.test.ts` | onglets, tranches puis exact, source et date |
| E15.1-T03 | e2e | `e2e/creator-preview.spec.ts` | non publié, sans visuel, « après » vide |
| E15.1-T04 | e2e, a11y | `e2e/creator-preview.spec.ts` | boutons inertes, galerie, carrousel au clavier |

Attributs à conserver : `data-preview-card`, `data-preview-panel`, `data-preview-tab`, `data-preview-no-visual`, `data-preview-after-empty`, `data-network`, `data-badge`, `data-field`, `data-revealed`, `data-visual`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Onglet actif vert avec coche | `CreatorPreviewScreen.tsx:192-203` | segments gris | faire évoluer |
| Carte en lignes | `CreatorCardView.tsx` | page E02b | réutiliser les composants d'E02b |
| Cadre « Aperçu » | aucun | C66 | créer |
| Encadré de sélection | aucun | inerte, démonstratif | créer |

Données requises (contrat `packages/contracts/src/creator-projection.ts`) : alias, titre, bio, thématiques, tons, langues, pays, déplacements, expérience, réseaux, badges datés, offre, disponibilité, visuels | servis. **Région de résidence** (« Bruxelles-Capitale ») | non servie | écart. **« Sur INFLUX depuis … »** | non servi | écart (E02b-Q5). **Raisons « Proposé car »** | non servies à l'aperçu | écart. **Tranches des réseaux non principaux, audience par réseau** | projection d'audience du seul compte principal | écart (E02b-Q2). **Portée et engagement** | servis (`reachBand`, `avgReachPerPost`, `engagementBand`), absents de la maquette | écart (E02b-Q11). **Exclusivité, contrepartie non monétaire** | servies, absentes | écart (E02b-Q10). **Sélections et nombre de créateurs** | inventés | démonstration.
Hors lot : aucun.

## 9. Contradictions, manques et décisions
| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E15-Q1 | RG104 (`07`) : « exactement ce que l'API sert, jamais une reconstitution » ; la maquette ajoute « Proposé car », l'encadré de sélection et des données non servies (région, ancienneté) | fidélité, confiance | garder l'encadré comme décor inerte annoncé ; retirer région et ancienneté tant que non servies | product-owner | oui |
| E15-Q2 | « Proposé car » donné en exemple : les raisons naissent d'une recherche ; aucune n'est calculable ici (« à valider » dans ecran-15) | section entière | exemple construit des seules valeurs servies (thématique, pays d'audience, badge), masqué sans elles | expert-matching | oui |
| E15-Q3 | Chiffres constatés : la maquette les montre exacts (« 47 900 ») ; le produit ne les montre pas dans l'aperçu (`preview.observed`) | cases et lignes « après » | garder la note tant que la projection ne sert pas la valeur constatée | architecte | oui |
| E15-Q4 | Lien externe vers le réseau du créateur : cible, `rel`, avertissement non définis ; l'ancre de la maquette ne mène nulle part | sortie d'INFLUX | texte non cliquable dans l'aperçu (le créateur connaît son compte) | expert-cybersecurite | non |
| E15-Q5 | Deux libellés de source (« le 22 novembre 2026 » et « au 24 nov. 2026 ») pour les mêmes chiffres ; « Pays-Bas moins de 10 % » alors qu'un autre pays pèse 10 % au moins (RG56) ; barre de la tranche conservée à côté d'une valeur exacte | données fictives incohérentes | une seule date (`figuresMeasuredAt`) ; barre à la valeur exacte en « après » | expert-ux | non |
| E15-Q6 | Sous 1 024 px, la phrase « ses boutons sont inactifs » disparaît avec l'encadré ; le cœur inerte reste visible à 768 sans explication | message perdu | phrase dans le cadre, sous le chapeau, sous 1 024 | expert-ux | non |
| E15-Q7 | Axe : 3,66:1 et 3,72:1 sur les textes à 0,55 ; `aria-hidden` sur des boutons | WCAG AA | ton désactivé de la charte au lieu de l'opacité (X4) | expert-ux | oui |
| E15-Q8 | Sous-menu : « Mes vérifications » ajoutée, « Mes sessions » absente (voir E14-Q1) ; X2, X3, X6, X7, X8, X11, X12, X13 ; toutes les questions E02b valent ici | navigation, finition | suivre E14-Q1 et E02b | expert-ux | non |

## 10. Écrans du périmètre sans maquette
| Écran ou état existant | Code | Où le traiter |
|---|---|---|
| Édition d'un visuel du portfolio (légende, consentement de marque, ordre, remplacement, retrait, refus) | `PortfolioItemCard.tsx` | E03-Q8 (E03.5) |
| Profil refusé, modification refusée, modifications en attente, en attente (gelé), suspendu, sans alias | `CreatorPublicationCard.tsx`, `creator-publication-view.ts` | E03-Q13, Q14 |
| Visibilité dans la recherche, bloc Confiance | `CreatorTrustBlock.tsx` | E03-Q15 |
| Étapes 2 et 4 de l'assistant : dans le HTML, hors du sélecteur et du relevé commun | `proto-profil.html` `#etape-2`, `#etape-4` | mesurées dans E03a et E03c, à valider (E03-Q3) |
| Ligne d'état de vérification dans la ligne de réseau | `VerificationLineState.tsx` | E14-Q9 |
| Vérification : en cours, commencée, code expiré, à reconfirmer, retirée, renouvelable, audience verrouillée, issues de contestation, contestation close | `RequestState.tsx`, `DisputeNotice.tsx`, `AudienceScreen.tsx`, `AppealScreen.tsx` | E14-Q8 |
| Campagne « n'est plus ouverte », carte close du fil, « Voir la suite », plafond, refus et limites de lecture | `CampaignRecordScreen.tsx:118`, `CampaignFeedCard.tsx`, `CampaignFeedScreen.tsx` | E08-Q5, Q9 |
| Page-menu « Mon compte » (téléphone) avec « Mes vérifications » | `account/AccountHub.tsx` | E20, E14-Q1 |
| Colonne et carte d'accueil « Mon profil » | `CreatorAccountStateBlock.tsx`, `CreatorHomeCard.tsx` | E01, C56 |
| Aperçu « après » vide | `preview.afterEmpty.*` | §5 |
| Aperçu de campagne de la marque (`/campagnes/[id]/apercu`) : rôle marque, hors périmètre créateur | `CampaignPreviewScreen.tsx` | E18 (corps partagé avec E08.2) |
| Candidature, « Mes candidatures », conversation (C7 à C9) | aucun | Lot 4 |
