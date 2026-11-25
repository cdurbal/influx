# E01 — Accueil créateur (créateur)
> Maquette : `proto-accueils.html` (états `createur-neuf`, `createur`) · page de comparaison `ecran-1-accueils.html` · validée le 2026-11-23 (07) · Constats : U01, U09, U45, U46, U60. La coquille (E01.0) et l'accueil marque (E01.1) sont dans `E01a-accueils.md`.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E01.2 | Accueil créateur | `/fr/createur` | `/en/creator` | `auth/MemberHome.tsx:37` + `creator-profile/CreatorHomeCard.tsx:33` | `createur-neuf`, `createur` | L | E01.0, E03 (profil), E08 (fil), E14 (vérifications), E15 (aperçu) |

Fonctionnalités existantes à préserver :
- Alias, état, complétude, manques par rubrique avec ancre `#creator-section-{rubrique}` (`CreatorHomeCard.tsx:79-110`, `creator-profile-view.ts:357,376`). La complétude n'est vue que du créateur (`07` RG90).
- Chargement, profil illisible + « Réessayer » (`CreatorHomeCard.tsx:33-56`) ; alias non attribué : `alias.none` (`:88`).
- Fil ouvert sans condition de profil (`09` RG99, `11` RG13). Aucun montant (D78).

API appelée aujourd'hui : GET `/v1/me`, GET `/v1/me/creator-profile`. À appeler en plus : GET `/v1/open-campaigns?sort=recent&page=1` (`campaign/open-campaigns-api.ts`), GET `/v1/open-campaigns/:id/brand-logo` (par ligne dont `hasLogo`), GET `/v1/me/verification` (`verification/verification-api.ts:28`).

## 2. Structure
- Cadre : E01.0-S17. Même pile que E01.1 (écart 48 px dès 1 024, 32 dessous).
- **`createur-neuf`** : pile 768 px : `h1` (à 48 px) → bienvenue (128,2) → carte « Bien démarrer » (259,8 ; 595,5 px de haut) → « Dernières campagnes ouvertes » (903,3) avec 2 lignes puis lien.
- **`createur`** : pile pleine largeur : en-tête (`h1` + chapeau à 12 px, 640 px max) → « À faire » (768 px max, 2 lignes) → `home-grid` (2fr + 1fr, gap `spacing-8` dès 1 280 px : 693,3 + 346,7 à 1440 ; une colonne, gap `spacing-6`, 768 px max en dessous) : à gauche « Dernières campagnes ouvertes » (3 lignes), à droite « Mon profil ».
- Ligne de campagne (`rows--feed`) : colonnes `auto minmax(0,1fr) auto`, alignées en haut, gap `spacing-4`, padding `spacing-3 spacing-2`, 97 px de haut ; pastille 40 px.
- Aucune zone collante ni défilante.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E01.2-S01 | En-tête | C02 | `h1` « Accueil », `title-page` 800 | Toujours | tous, `.t-page` | E01.2-CA01 | E01.2-T01 |
| E01.2-S02 | En-tête | C02 | Chapeau `text-md` `text-secondary`, 640 px max | Créateur actif | `createur`, `.page-head p` | E01.2-CA01 | E01.2-T01 |
| E01.2-S03 | Bienvenue | C03 | `h2` `t-section` + phrase de valeur `text-secondary`, 640 px max, gap 8 px | Première visite | `createur-neuf`, `#cn-w` | E01.2-CA02 | E01.2-T01 |
| E01.2-S04 | Bien démarrer | C04 | Carte unique 768 px, padding `inset-card`, gap `spacing-4` | Première visite | `createur-neuf`, `.card` | E01.2-CA03 | E01.2-T01 |
| E01.2-S05 | Bien démarrer | C43 | `h2` `t-card`, « {n} sur 5 », jauge 6 px `aria-hidden` (n/5) | Première visite | `.sect__bar`, `.bar` | E01.2-CA03 | E01.2-T02 |
| E01.2-S06 | Tâche 1 | C43 | `circle-check` `feedback-success-icon`, libellé, « Fait » | Toujours faite | `.is-done` | E01.2-CA03 | E01.2-T02 |
| E01.2-S07 | Tâche 2 | C43 | `circle`, libellé, « Complété à {n} %. Il reste {n} informations : » | Au moins un manque | `.todo > li:nth-child(2)` | E01.2-CA04 | E01.2-T02 |
| E01.2-S08 | Tâche 2 | C38 | Liens soulignés `text-sm` 600 « {rubrique} ({n}) », gap `spacing-1 spacing-4`, passent à la ligne | Par rubrique avec manque | `.chips-inline .link` | E01.2-CA04 | E01.2-T02 |
| E01.2-S09 | Tâche 2 | C10 | « Compléter mon profil » principal 212,4 × 44,8 ; seule pilule verte ; à droite dès 768 px, dessous sinon | Au moins un manque | `.t-act .btn--primary` | E01.2-CA04 | E01.2-T02 |
| E01.2-S10 | Tâche 3 | C43 | `circle`, libellé, texte avec alias | Toujours | `.todo > li:nth-child(3)` | E01.2-CA05 | E01.2-T02 |
| E01.2-S11 | Tâche 3 | C11 | « Ouvrir l'aperçu › » vers `/compte/profil/apercu` | Toujours | `.t-act .go` (1) | E01.2-CA05 | E01.2-T03 |
| E01.2-S12 | Tâche 4 | C43 | `lock`, libellé `text-secondary`, condition et délai | Manques restants | `.is-locked` | E01.2-CA06 | E01.2-T02 |
| E01.2-S13 | Tâche 5 | C43 | `circle`, libellé, texte | Toujours | `.todo > li:nth-child(5)` | E01.2-CA07 | E01.2-T02 |
| E01.2-S14 | Tâche 5 | C11 | « Voir les campagnes › » vers `/campagnes` | Toujours | `.t-act .go` (2) | E01.2-CA07 | E01.2-T03 |
| E01.2-S15 | À faire | C03 | `h2` surtitre `overline`, gap 8 px | Au moins une entrée, sinon bloc absent | `createur`, `#ca-todo` | E01.2-CA08 | E01.2-T04 |
| E01.2-S16 | À faire | C06 | Ligne : titre `font-display` 700 (lien étiré), aide `text-sm` `text-secondary`, à droite « Vérifier › » ; 71 px | Réseau sans « Compte vérifié » | `.rows li:nth-child(1)` | E01.2-CA09 | E01.2-T04 |
| E01.2-S17 | À faire | C06 | Ligne : titre « Vos chiffres {réseau} datent du {date} », aide, à droite « Mettre à jour › » | Chiffres de plus de 90 jours (`07` RG50) | `.rows li:nth-child(2)` | E01.2-CA10 | E01.2-T04 |
| E01.2-S18 | Campagnes | C03 | `h2` `t-section` | Toujours | `#cn-feed`, `#ca-feed` | E01.2-CA11 | E01.2-T03 |
| E01.2-S19 | Campagnes | C10 | « Voir toutes les campagnes » secondaire 250,3 × 46,8 à droite du titre ; sous le titre à 375 | Créateur actif | `createur`, `.sect__bar .btn` | E01.2-CA11 | E01.2-T03 |
| E01.2-S20 | Campagnes | C11 | « Voir toutes les campagnes › » sous la liste | Première visite | `createur-neuf`, `.sect > .go` | E01.2-CA11 | E01.2-T03 |
| E01.2-S21 | Campagnes | C33 | Pastille claire 40 × 40, `radius-md`, `logo-plate`, sigle `text-xs` 800 ; logo à sa place si la marque en a un | Par ligne, décorative (`aria-hidden`) | `.logo-plate` | E01.2-CA12 | E01.2-T01 |
| E01.2-S22 | Campagnes | C48 | Nom de la marque `text-sm` `text-secondary` ; badge `verified` « Marque vérifiée » à la suite (gap 8) | Badge : actif, créateur actif et neuf | `.r-main .sm`, `.badge--verified` | E01.2-CA12 | E01.2-T04 |
| E01.2-S23 | Campagnes | C48 | Titre `font-display` 700, lien étiré vers `/campagnes/{id}` | Par ligne | `.r-title` | E01.2-CA11 | E01.2-T03 |
| E01.2-S24 | Campagnes | C48 | Échéance : `clock` 16 px + « Candidatures avant le {date} » `text-sm` 600 `text-primary` | Date servie | `.deadline` | E01.2-CA12 | E01.2-T04 |
| E01.2-S25 | Campagnes | C06 | Chevron 20 px `text-secondary`, filets `border-subtle`, survol `surface-raised` | Par ligne | `.rows--feed > li` | E01.2-CA11 | E01.2-T01 |
| E01.2-S26 | Mon profil | C03 | `h2` `t-section`, sans carte | Créateur actif | `#ca-prof` | E01.2-CA13 | E01.2-T04 |
| E01.2-S27 | Mon profil | C13 | « Profil {alias} » `font-display` 700 + badge `success` « Publié » (`circle-check`), gap 12 | Alias attribué | `.profile-line` | E01.2-CA13 | E01.2-T04 |
| E01.2-S28 | Mon profil | C43 | « Complétude du profil » `text-sm` `text-secondary`, « {n} % » à droite `font-display` 700, jauge 6 px | Créateur actif | `.sect__bar.sm`, `.bar` | E01.2-CA13 | E01.2-T04 |
| E01.2-S29 | Mon profil | C11 | « Voir mon profil › » vers `/compte/profil` | Créateur actif | `.go` (1) | E01.2-CA13 | E01.2-T03 |
| E01.2-S30 | Mon profil | C11 | Icône `eye` 16 px + « Ce que voit une marque » vers `/compte/profil/apercu` ; liens empilés sans écart | Créateur actif | `.go` (2) | E01.2-CA13 | E01.2-T03 |
| E01.2-S31 | Chargement | C09 | Squelette par zone (non montré) | Lecture en cours | non montré | E01.2-CA14 | E01.2-T05 |
| E01.2-S32 | Erreur, vide | C08 | Message et « Réessayer » par zone ; fil vide (non montrés) | Échec ou aucune campagne | non montré | E01.2-CA14 | E01.2-T05 |

## 4. Textes
EN « à écrire » = à écrire (expert-marketing).

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E01.2-S01 | Accueil | à écrire | nouvelle (remplace `auth.home.creator.title`) |
| E01.2-S02 | Les campagnes ouvertes sont déjà consultables. Un profil complet aide votre commercial INFLUX à vous proposer aux marques. | à écrire | nouvelle (remplace `auth.home.creator.lead`) |
| E01.2-S03 | Bienvenue sur INFLUX · Découvrez les campagnes des marques ; votre commercial INFLUX vous propose à celles qui vous correspondent. | à écrire | nouvelles |
| E01.2-S05 | Bien démarrer · {1} sur 5 | à écrire | nouvelles (communes avec E01.1) |
| E01.2-S06 | Créer votre compte · Fait | à écrire | nouvelles (communes) |
| E01.2-S07 | Compléter votre profil · Complété à {1} %. Il reste {16} informations : | à écrire | nouvelles (proche de `creatorProfile.home.remaining`) |
| E01.2-S08 | Présentation ({2}) · Ligne éditoriale ({2}) · Réseaux sociaux ({6}) · Audience ({2}) · Mon offre ({2}) · Portfolio ({1}) · Confiance ({1}) | Presentation · Editorial line · Social networks · Audience · My offer · Portfolio · Trust, avec ({n}) | `creator-profile.json` `home.leftIn` + `sections.*` |
| E01.2-S09 | Compléter mon profil | Complete my profile | `creator-profile.json` `home.complete` |
| E01.2-S10 | Voir votre profil comme une marque le voit · Les marques lisent votre alias, Profil {6PRGS4}, et des tranches : jamais votre nom. | à écrire | nouvelles |
| E01.2-S11 | Ouvrir l'aperçu | à écrire | nouvelle |
| E01.2-S12 | Publier votre profil · Quand les {16} informations sont renseignées. Relu par un commercial INFLUX sous {1 jour ouvré}. | à écrire | nouvelles |
| E01.2-S13 | Parcourir les campagnes ouvertes · Elles sont consultables dès maintenant, sans attendre la publication de votre profil. | à écrire | nouvelles |
| E01.2-S14 | Voir les campagnes | à écrire | nouvelle |
| E01.2-S15 | À faire | à écrire | nouvelle |
| E01.2-S16 | Faites vérifier votre compte {TikTok} · Le badge « Compte vérifié » s'affiche sur votre profil anonyme. · Vérifier | à écrire | nouvelles |
| E01.2-S17 | Vos chiffres {Instagram} datent du {22 août} · Tant qu'ils ne sont pas mis à jour, les marques voient un point de vigilance. · Mettre à jour | à écrire | nouvelles |
| E01.2-S18 | Dernières campagnes ouvertes | à écrire | nouvelle |
| E01.2-S19, S20 | Voir toutes les campagnes | à écrire | nouvelle |
| E01.2-S22 | {Atelier Sève} · Marque vérifiée | {companyName} · à écrire | nouvelle (E01-Q20) |
| E01.2-S24 | Candidatures avant le {28 mars} | valeur de la clé | `campaign.json` (ligne 51, « Candidatures avant le {date} ») |
| E01.2-S26 | Mon profil | My profile | `creator-profile.json` `page.title` |
| E01.2-S27 | Profil {93JMS4} · Publié | Profile {alias} · Published | `creator-profile.json` `alias.name`, `state.published` |
| E01.2-S28 | Complétude du profil · {99} % | Profile completeness · {99}% | `creator-profile.json` `completeness.label`, `.value` |
| E01.2-S29 | Voir mon profil | View my profile | `creator-profile.json` `home.review` |
| E01.2-S30 | Ce que voit une marque | What a brand sees | `creator-profile.json` `preview.title` |
| Bloc d'état (E01.0-S11 à S13) | Profil : En cours de saisie · {16} informations manquantes · Compléter mon profil | State: In progress… (valeurs des clés) | `creator-profile.json` `state.draft`, `member.json` `shell.accountState.*` |

## 5. Interactions, états, responsive, clavier
- **Interactions** : « Compléter mon profil » → `/compte/profil` (assistant E03, premier champ manquant). Lien de rubrique → la rubrique correspondante de l'assistant (ancre actuelle `#creator-section-{rubrique}`, à relier aux étapes de E03). « Ouvrir l'aperçu » et « Ce que voit une marque » → `/compte/profil/apercu`. « Vérifier » → `/compte/profil/verification/propriete?network={code}` (`member-paths.ts:192`). « Mettre à jour » → étape réseaux du profil, ligne concernée. Ligne de campagne → `/campagnes/{id}`. Aucune confirmation, aucun message de succès.
- **États** : chargement : non montré, actuel `creatorProfile.page.loading` (`CreatorHomeCard.tsx:50`), proposé C09. Erreur : actuel `page.unavailable` + « Réessayer » (`:41`), proposé C08 par zone. Fil vide : non montré, proposé `campaign.feed.empty.*`. Fil interdit, limité : `campaign.feed.forbidden`, `.rateLimited`. Profil `pending_review`, `rejected`, `suspended` : non montrés (E01-Q11). Hors ligne : non montré, aucun envoi sur cet écran.
- **Responsive** : 1440, 1280 : deux colonnes. 768 et 375 : une colonne ; « Mon profil » après les campagnes ; actions des tâches sous le texte ; à 375 le bouton « Voir toutes les campagnes » passe sous le titre ; « Vérifier », « Mettre à jour » restent à droite, centrés verticalement. Bloc d'état et pied masqués sous 1 024 px. Aucun défilement horizontal à 320 px.
- **Clavier** : ordre du document ; chaque ligne est un seul arrêt ; anneau intérieur sur la ligne ; le texte « Vérifier › » de la ligne n'est pas un second lien.
- **Animations** : identiques à E01.1 (ligne, chevron, pilule, jauge `width` `duration-slow`).

## 6. Critères d'acceptation
- **E01.2-CA01** Un seul `h1` « Accueil » ; le chapeau n'apparaît qu'une fois le créateur actif et ne dit plus que les campagnes « arriveront ensuite ».
- **E01.2-CA02** Première visite : titre et phrase de bienvenue propres à la porte créateur.
- **E01.2-CA03** Une seule carte, cinq tâches, compteur et jauge concordants, « Fait » écrit.
- **E01.2-CA04** Les rubriques et leurs nombres viennent de `missingRequired` ; chaque lien ouvre sa rubrique ; une seule pilule verte.
- **E01.2-CA05** L'alias affiché est celui servi ; sans alias, la phrase ne contient pas d'alias vide.
- **E01.2-CA06** « Publier votre profil » reste sans lien tant qu'il manque une information, condition écrite.
- **E01.2-CA07** Le fil est accessible depuis l'accueil avant publication.
- **E01.2-CA08** Sans entrée actionnable, « À faire » est absent (ni titre ni cadre).
- **E01.2-CA09** « Faites vérifier… » n'apparaît que pour une ligne de réseau sans badge actif de propriété ni demande en cours.
- **E01.2-CA10** « Vos chiffres… » n'apparaît que si `areFiguresStale` est vrai (90 jours).
- **E01.2-CA11** Deux campagnes au plus en première visite, trois ensuite, les plus récentes d'abord ; toute la ligne est cliquable ; 44 px au moins.
- **E01.2-CA12** Pastille, marque, badge, titre et échéance ; aucun montant, tranche ni taux (D78) ; une campagne aux candidatures closes n'est pas affichée.
- **E01.2-CA13** « Mon profil » sans carte ni notice ; complétude écrite, jauge décorative ; aucune pilule verte.
- **E01.2-CA14** Chargement et erreur par zone ; axe sans défaut à 375, 768, 1024, 1440, en FR et EN ; aucun débordement à 320 px.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E01.2-T01 | visuel, a11y | `e2e/charter-rendering.spec.ts` (ouvre `/fr/createur` et attend `home.creator.title`), `e2e/account-screens.spec.ts` | Rendu, axe |
| E01.2-T02 | unitaire | nouveau `tests/member-home-view.test.ts` ; `tests/creator-profile-view.test.ts` (garder) | Tâches, manques par rubrique |
| E01.2-T03 | e2e | `e2e/creator-campaigns.spec.ts`, `e2e/creator-preview.spec.ts` à adapter | Liens de l'accueil |
| E01.2-T04 | e2e | `e2e/member-shell.spec.ts` (« the creator home leads with the card of the profile ») : attend un titre « Mon profil », `^Profil [A-Z0-9]{6}$`, un `meter`, `^Il reste \d+ informations à compléter :$`, `Présentation (n)` → `#creator-section-presentation` ; à réécrire | Accueil actif, alias, complétude |
| E01.2-T05 | e2e | `e2e/member-shell.spec.ts` | Chargement, erreur |

La même spec vérifie l'absence de « publier » et de « € » dans `main` : « Publier votre profil » (tâche 4) impose de retirer « publier » de cette assertion, jamais « € ».

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| `h1` « Espace créateur », chapeau | `MemberHome.tsx:59-60` | « Accueil », nouveau chapeau | faire évoluer |
| « Comment ça marche » | `MemberHome.tsx:62-71` | retiré | supprimer |
| Carte d'identité, « Gérer mon compte », « Me déconnecter » | `MemberHome.tsx:72-90` | retirés (déconnexion : pied, et E20.1 au téléphone) | supprimer |
| Carte « Mon profil » | `CreatorHomeCard.tsx:59` | section C03 (actif) ou tâche 2 (neuf) | faire évoluer |
| Jauge | `ScoreGauge.tsx` : `role="meter"`, 8 px, valeur 20 px | 6 px, valeur 16 px, barre décorative | faire évoluer |
| Fil sur l'accueil | absent | 2 ou 3 lignes | créer |
| « À faire » | absent | lignes dérivées | créer |
| Icônes | `components/ui/icons.ts` | ajouter `circle` | créer |

Données requises :

| Donnée affichée | Servie aujourd'hui ? | Écart |
|---|---|---|
| Alias, état, score, manques | oui (`creator-profile-view.ts:409`) | aucun |
| Dernières campagnes | oui, GET `/v1/open-campaigns` (`open-campaigns.ts:81`) | page entière lue pour 2 ou 3 lignes ; `applicationsClosed` filtré au front |
| Logo de la marque | un appel JSON par campagne | jusqu'à 3 appels |
| Badge « Marque vérifiée » | oui, `brand.badge` de la carte | aucun |
| Réseau sans badge de propriété | oui, GET `/v1/me/verification` (`verification.ts:546`) | appel de plus |
| Date des chiffres | oui, lignes de GET `/v1/me/creator-profile` (règle `creator-networks-view.ts:366`) | l'étendre au résumé `creatorSummaryOf` |

Hors lot : mise en relation à accepter, candidatures actives, messages (Lot 4).

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E01-Q10 | « Le seuil reste à fixer » (`ecran-1` §7) ; `07` RG50 et le code fixent 90 jours | Aucun si 90 jours | Retenir 90 jours | product-owner | non |
| E01-Q11 | Bascule première visite → actif, profil `pending_review`, `rejected`, `suspended` non dessinés (17 §5.1 : suspendu = fil inaccessible) | Composition indéterminée | Première visite tant que non publié ; tâche 4 écrite « En cours d'examen » ou motif du refus ; suspendu : notice neutre seule | product-owner | oui |
| E01-Q12 | « À faire » : réseaux retenus, ordre, nombre maximal et profil déjà vérifié non définis ; « Faites vérifier votre compte TikTok » alors que la publication exige déjà un compte vérifié (`08` RG16) | Calcul de la liste | Une ligne par réseau sans badge, principal d'abord, 3 au plus ; chiffres anciens ensuite | product-owner | non |
| E01-Q13 | 17 §5.1 et §2.4 demandent « Bonjour », un bloc « Le verrou expliqué » avec « Faire vérifier un compte » et un encart « Ce que je toucherai » ; absents de la maquette | Spec à amender | La maquette prime ; l'encart d'argent reste exclu (D48, D78) | product-owner | non |
| E01-Q14 | Sigle de la pastille (« AS », « T&T », « VUB ») sans règle ; `06` ligne 647 dit « l'initiale du nom commercial » | Rendu sans logo | Même règle que E08 (initiales des mots, 3 au plus) | expert-ux | non |
| E01-Q15 | « {n} informations » = 16 à la première visite : la tâche 4 répète le total alors que la tâche 2 donne le reste | Texte après saisie partielle | Tâche 4 : nombre restant, ou sans nombre | product-owner | non |
| E01-Q16 | `meter` attendu par la spec e2e, barre `aria-hidden` dans la maquette | Test | Barre décorative, valeur écrite ; adapter le test | testeur, expert-ux | non |
| E01-Q17 | Année absente des échéances (« 28 mars ») | Ambiguïté en fin d'année | Année si différente de l'année courante | expert-ux | non |
| E01-Q18 | « votre commercial INFLUX vous propose à celles qui vous correspondent » : promesse de proposition à relire (A9, D11) | Texte public aux membres | Relecture avant traduction | expert-marketing | non |
| E01-Q19 | Délai « sous 1 jour ouvré » non servi (voir E01-Q2) ; X2 : badge de marque avec libellé, conforme ; X13 | — | Voir E01-Q2 | product-owner | oui |
| E01-Q20 | Badge « Marque vérifiée » sans date (E01.1-S30, E01.2-S22) ; la clé existante dit « Marque vérifiée le {date} — domaine et immatriculation contrôlés. » (`brand-profile.json:26`) ; `08` RG4 : « la date accompagne le badge partout », sans date = défaut bloquant ; D34 garde les libellés ouverts | Libellé et date du badge dans les lignes | Ajouter la date au libellé (« Marque vérifiée · {mois} »), ou arbitrage explicite de RG4 pour les lignes ; même règle que E08 et E05b | product-owner, expert-conformite-rgpd | oui |
