# E03 — Profil créateur : vérifier et publier, Mon profil, modifier (créateur)
> Maquette : `proto-profil.html` (états `verifier`, `profil`, `modif-3` ; plus le résumé des manques et l'envoi, obtenus au clic) · comparaison `ecran-3-profil-createur.html` · validée le 2026-11-23, version 2 (07) · Constats : U02, U03, U21, U26, U27, U58
> Cadre commun de l'assistant : `E03a-profil-createur-etapes.md`.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|
| E03.6 | Vérifier et publier | `/fr/compte/profil` | `/en/account/profile` | `CreatorPublicationCard.tsx`, `ProfileProgress` | `verifier` (+ clic « Publier ») | L | E03.1 à E03.5, C20, C42 |
| E03.7 | Mon profil (après publication) | idem | idem | `CreatorProfileScreen.tsx` `Summary` | `profil` (+ envoi) | M | E15, E14, E01 (accueil) |
| E03.8 | Modifier une étape | idem | idem | sections de `CreatorProfileScreen.tsx` | `modif-3` | M | E03.1 à E03.5 |

À préserver :
- Soumission explicite, `POST /v1/me/creator-profile/submit` ; réponse `missing` nominative (`use-creator-publication.ts:60-80`) ; 409 → relecture du profil (`:76`) ; double clic ignoré (`:57`).
- Bouton jamais désactivé ; liste nominative en liens (`CreatorPublicationCard.tsx:38-77`, `07` RG4, RG90) ; phrase « un commercial relit » (`:210`).
- États : brouillon et refusé → soumission ; en attente → gelé ; publié → modifiable, révisions ; suspendu → gelé (`creator-publication-view.ts:26`, `creator-profile-view.ts:391`).
- Refus avec motif, message de l'agent, suite (`CreatorPublicationCard.tsx:81-114`) ; modifications en attente nommées (`:120-156`) ; raison du gel (`creator-publication-view.ts:122`).
- Interrupteur « Visible dans la recherche » (`CreatorTrustBlock.tsx:66-98`, `PUT /v1/me/creator-profile/visibility`, RG8) ; « Compte vérifié » requis (`:39-65`).
- Complétude (`CreatorProfileScreen.tsx:427`, RG89) ; lien « Ce que voit une marque » (`:383`).
- État repris dans la colonne (`CreatorAccountStateBlock.tsx`) et à l'accueil (`CreatorHomeCard.tsx`).

## 2. Structure
- **E03.6** : cadre de l'assistant (768 max, contenu 702 à 1 440). Ordre : en-tête (compteur « Vérification », segments, « Plus que la relecture », lien de reprise), titre + consigne, résumé des manques (au clic), récapitulatif, action. Aucun pied. `gap` 24.
  - Récapitulatif : 5 sections, filet haut `--color-border-default`, `padding` 16 0, `gap` 8 ; ligne de titre (`h3` display gras + « Modifier » à droite) ; `.props` 2 colonnes : libellé 176 px (11 rem), `gap` 8 × 24, `--text-sm`. À 375 : libellé 176, valeur 143 (pas d'empilement).
  - Résumé : 702 × 178 à 1 440, 343 × 252,4 à 375 ; bord `--color-feedback-error-border`, `--radius-md`, `padding` 16 ; liens indentés de 28 px.
- **E03.7** : colonne `.narrow` 768 max, sans carte, `gap` 32. Ordre : en-tête (titre + bouton, alias + badge, notice d'envoi), liste, phrase. 1 440 : titre à gauche, bouton 257,8 × 46,8 à droite ; 768 : idem ; 375 : bouton pleine largeur 343 sous le titre.
  - Liste `.tasks` : filet haut, lignes 60 px min (`--size-touch-target` + 16), grille `1fr auto`, `gap` 4 × 16, `padding` 12 8. À 375 : même grille, titres sur 2 ou 3 lignes (ligne 2 : 87 px).
- **E03.8** : E03.n avec un retour « Mon profil » au-dessus du titre (21,7 px), ni segments ni lien de reprise ; à 375 le nom d'étape passe sous le titre.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E03.6-S01 | En-tête | C41 | compteur « Vérification » ; segments vert ou orange, tous actifs | brouillon, refusé | verifier `#wz-count`, `.segs` | E03.6-CA01 | E03.6-T01 |
| E03.6-S02 | En-tête | C41 | « Plus que la relecture » + « Enregistrer et reprendre plus tard » | idem | verifier `.wz-meta` | E03.6-CA01 | E03.6-T01 |
| E03.6-S03 | Titre | C02 | `h2` + phrase de relecture sous 1 jour ouvré | idem | verifier `#hvs` | E03.6-CA02 | E03.6-T01 |
| E03.6-S04 | Manques | C20 | titre rouge, circle-alert, nombre ; liens « Étape n — {manque} » | après « Publier » avec manques ; focalisé | verifier + clic `#errsum` | E03.6-CA03 | E03.6-T02 |
| E03.6-S05 | Récapitulatif | C42 | 5 sections numérotées, `h3`, liste de propriétés | toujours | verifier `#recap section` | E03.6-CA04 | E03.6-T01 |
| E03.6-S06 | Récapitulatif | C11 | « Modifier » souligné `--text-sm`, nom complet masqué visuellement | par section | verifier `[data-fix]` | E03.6-CA05 | E03.6-T02 |
| E03.6-S07 | Récapitulatif | C20 | « À compléter : … », triangle-alert, `--color-feedback-warning-text` | section incomplète | verifier `.missing` | E03.6-CA03 | E03.6-T02 |
| E03.6-S08 | Action | C10 | « Publier mon profil », pilule verte 184,9 × 44,8, à gauche | toujours active | verifier `#publish` | E03.6-CA06 | E03.6-T03 |
| E03.7-S01 | En-tête | C02 | `h1` « Mon profil », `--text-title-page` | en attente, publié, suspendu | profil `h1` | E03.7-CA01 | E03.7-T01 |
| E03.7-S02 | En-tête | C10 | lien « Ce que voit une marque », secondaire, icône eye | alias attribué | profil `.page-head__row a` | E03.7-CA02 | E03.7-T01 |
| E03.7-S03 | En-tête | C13 | alias (display gras) + badge : succès « Publié » circle-check ; info « En cours de validation » hourglass | toujours | profil `#hub-badge` | E03.7-CA03 | E03.7-T01 |
| E03.7-S04 | En-tête | C17 | notice de réussite de l'envoi, 768 × 47,7 (375 : 69,4) | après l'envoi | profil, après clic `#hub-note` | E03.7-CA04 | E03.6-T03 |
| E03.7-S05 | Liste | C06 | 5 lignes, lien étiré, titre display gras, survol `--color-surface-raised` | toujours | profil `.tasks li` | E03.7-CA05 | E03.7-T02 |
| E03.7-S06 | Liste | C13 | état écrit à droite : check « Complet » ; texte secondaire « À enrichir : … » ; triangle-alert orange gras « Chiffres {réseau} du {date} » | par ligne | profil `.tstat` | E03.7-CA06 | E03.7-T02 |
| E03.7-S07 | Pied | C05 | phrase secondaire `--text-sm` | toujours | profil `p.sm.c2` | E03.7-CA01 | E03.7-T01 |
| E03.8-S01 | En-tête | C11 | « ‹ Mon profil », secondaire `--text-sm`, chevron-left | modification | modif-3 `#back-profile` | E03.8-CA01 | E03.8-T01 |
| E03.8-S02 | En-tête | C41 | `h1` « Modifier votre profil » ; à droite le nom de l'étape ; ni segments ni reprise | modification | modif-3 `#wz-title #wz-count` | E03.8-CA01 | E03.8-T01 |
| E03.8-S03 | En-tête | C41 | « Environ 8 min restantes » encore affiché | modification | modif-3 `#wz-time` | E03.8-CA02 | E03.8-T01 |
| E03.8-S04 | Pied | C10 | « Revenir à mon profil » 200,9 × 44,8 sans flèche ; statut d'enregistrement ; pas de « Précédent » | modification | modif-3 `#next` | E03.8-CA03 | E03.8-T01 |
| E03.8-S05 | Pied | C10 | « Revenir à la vérification » | étape ouverte depuis E03.6 | script `mode = "fix"` | E03.8-CA03 | E03.6-T02 |

## 4. Textes
Clés de `creator-profile.json`. « X » = à écrire (expert-marketing).

| Élément | FR exact | EN | Clé |
|---|---|---|---|
| E03.6-S01, S02 | Vérification · Plus que la relecture · Enregistrer et reprendre plus tard | X | nouvelles |
| E03.6-S03 | Vérifier et publier · Relisez vos réponses. Un commercial INFLUX relit votre profil avant de le publier, sous 1 jour ouvré. | X | nouvelles (proche de `publish.review`) |
| E03.6-S04 | Il manque {4} informations pour publier votre profil · Il manque 1 information pour publier votre profil · Étape {3} — {manque} | X (existant : `publish.missing`) | nouvelle |
| E03.6-S04 (manques) | Le lien {TikTok} ne mène pas à {tiktok.com} · Les âges de votre audience · La répartition femmes, hommes et autres · Un troisième visuel du portfolio | X | à remplacer par les codes `required.*` (E03-Q7) |
| E03.6-S05 | 1. Vous présenter · 2. Votre ligne éditoriale · 3. Vos réseaux et vos chiffres · 4. Votre audience · 5. Votre offre et votre travail | X | nouvelles |
| E03.6-S05 (libellés) | Titre court · Collaborations · Identité légale · {Léa Dumont · +32 470 12 34 56} (privé) · Thématique principale · Langues · {Instagram} (principal) · {Micro · plusieurs fois par semaine · 50 à 199 commentaires} · Pays principal · {Belgique, 42 %} · Formats · Disponibilité | Short title · X · X · X · Main topic · X · X · X · X · X · X · Availability | `fields.*` ou nouvelles |
| E03.6-S06 | Modifier (+ masqué : « : {étape} ») | X | nouvelle |
| E03.6-S07 | À compléter : {manque en minuscule} | To complete: {fields}. | `blocks.missing` (sans point : nouvelle) |
| E03.6-S08 | Publier mon profil | Publish my profile | `publish.action` |
| E03.7-S01, S02 | Mon profil · Ce que voit une marque | My profile · What a brand sees | `page.title`, `preview.title` |
| E03.7-S03 | {Profil 93JMS4} · Publié · En cours de validation | Profile {alias} · Published · X | `alias.name`, `state.published` ; nouvelle (E03-Q17) |
| E03.7-S04 | Profil envoyé. Un commercial INFLUX le relit, réponse sous 1 jour ouvré. | X (existant `publish.submitted`) | nouvelle |
| E03.7-S06 | Complet · À enrichir : {thématiques secondaires} · À enrichir : {droits d'usage} · Chiffres {Instagram} du {22 août} | Complete · X | `summary.complete` ; nouvelles |
| E03.7-S07 | Chaque ligne rouvre son étape seule ; vos modifications s'enregistrent au fil de la saisie. | X | nouvelle |
| E03.8-S01, S02 | Mon profil · Modifier votre profil · {nom de l'étape} | My profile · X | `preview.back` ; nouvelle |
| E03.8-S04, S05 | Revenir à mon profil · Revenir à la vérification · Enregistré automatiquement | X | nouvelles |
| Colonne (C56) | Profil : En cours de saisie · Profil : Publié | existant `accountState.state` | `member.json` |

## 5. Interactions, états, responsive, clavier
- **Publier, avec manques** : le résumé apparaît, reçoit le focus, défile en haut, annonce « Il manque {n} informations pour publier votre profil. » Le clic n'envoie rien dans la maquette ; réel : appel, puis `missing` (`use-creator-publication.ts:62`).
- **Lien d'un manque** : ouvre l'étape (mode correction), ouvre la ligne de réseau repliée, centre et focalise le champ ; pied « Revenir à la vérification ».
- **Modifier** : même retour, focus sur le `h2`, annonce de l'étape.
- **Publier, complet** : E03.7, badge « En cours de validation », notice S04, annonce « Profil envoyé. Réponse sous 1 jour ouvré. » Erreur : non montré ; conservé `publish.failed` (`CreatorPublicationCard.tsx:229`), C17 au-dessus du bouton. Envoi en cours : non montré ; `aria-disabled` (`:199`).
- **Ligne de E03.7** : ouvre E03.8 ; focus sur le `h2`. **Revenir à mon profil** : E03.7, focus sur le `h1`, annonce « Mon profil. »
- **États**, non montrés par la maquette, comportement actuel préservé :

| État | Aujourd'hui | Représentation proposée |
|---|---|---|
| chargement, indisponible, hors ligne | `CreatorProfileScreen.tsx:150-185` | C09 ; C17 + « Réessayer » |
| refusé (motif, message, suite) | `CreatorPublicationCard.tsx:81` | C17 alerte en tête de E03.6 (assistant rouvert) |
| modification refusée (profil publié) | `refusalViewOf` `revision` | C17 alerte en tête de E03.7 |
| modifications en attente, champs nommés | `:140-152` | C17 info en tête de E03.7 |
| en attente de validation (gelé) | `frozen.pending_review` | E03.7, lignes ouvertes en lecture seule, notice info |
| suspendu (gelé) | `frozen.suspended` | idem, badge « Suspendu » |
| sans alias | `page.noStorefront` | notice info, aucune étape ouverte |
| visible ou retiré de la recherche | `CreatorTrustBlock.tsx:66` | E03-Q15 |
| complétude | `ScoreGauge` | E03-Q16 |

- **Responsive** : 1 440 et 1 280 identiques ; 768 : E03.7 sur une ligne titre + bouton ; 375 : bouton pleine largeur, états à droite des titres (colonne `auto`, sans retour : « À enrichir : thématiques secondaires » prend 211,6 px et réduit le titre à 99,4 px sur 3 lignes).
- **Clavier** : liste `ol`, lien étiré, anneau autour de la ligne entière (décalage négatif) ; résumé `tabindex="-1"`.
- **Animations** : étape `fade-in` 120 ms ; survol de ligne `background-color` 120 ms ; `--ease-standard`.

## 6. Critères d'acceptation
- **E03.6-CA01** Compteur « Vérification », cinq segments atteignables, sans pied d'assistant.
- **E03.6-CA02** Le délai d'1 jour ouvré et la relecture humaine sont écrits avant le bouton.
- **E03.6-CA03** Les manques sont ceux de `missingRequired`, nommés, un lien par manque vers son champ ; « Compte vérifié » inclus (E03-Q1).
- **E03.6-CA04** Le récapitulatif reprend toutes les données de chaque étape, zone privée marquée « (privé) » ; aucun montant.
- **E03.6-CA05** « Modifier » et les liens reviennent à la vérification ; nom accessible « Modifier : {étape} ».
- **E03.6-CA06** « Publier » n'est jamais désactivé ; un double clic n'envoie qu'une fois ; échec dit, profil inchangé.
- **E03.7-CA01** Titre, alias, liste et phrase conformes à §2 à 1 440 et 375.
- **E03.7-CA02** « Ce que voit une marque » mène à E15.1 ; attribut `data-preview-link` conservé.
- **E03.7-CA03** Badge : texte + icône pour chaque état de `state.*`.
- **E03.7-CA04** Après l'envoi, la notice est annoncée une fois, la colonne et l'accueil disent le même état.
- **E03.7-CA05** Chaque ligne rouvre sa seule étape ; un profil gelé s'ouvre sans champ modifiable et dit pourquoi.
- **E03.7-CA06** États de ligne dérivés de l'API (`missingRequired`, dates de chiffres, champs facultatifs vides), jamais la couleur seule.
- **E03.8-CA01** Retour « Mon profil » en tête ; ni segments, ni reprise.
- **E03.8-CA02** Aucun temps restant affiché en modification (E03-Q18).
- **E03.8-CA03** Le pied revient à l'écran d'origine (E03.6 ou E03.7) sans perdre la saisie en attente d'enregistrement.

## 7. Tests
| ID | Niveau | Fichier | Ce qu'il prouve |
|---|---|---|---|
| E03.6-T01 | visuel, e2e | `e2e/creator-profile.spec.ts` (à adapter) | récapitulatif complet, FR et EN |
| E03.6-T02 | e2e, a11y | `e2e/creator-profile.spec.ts` | manques, liens, retour, focus (`data-publish-missing` à conserver) |
| E03.6-T03 | e2e | `e2e/creator-portfolio.spec.ts` (`:43` soumission, refus, publication, interrupteur) | envoi, double clic, échec, notice |
| E03.7-T01 | visuel | `e2e/creator-profile.spec.ts` | en-tête et liste aux 4 largeurs |
| E03.7-T02 | unitaire, e2e | `tests/creator-profile-view.test.ts`, `e2e/creator-profile.spec.ts` | état de chaque ligne, ouverture |
| E03.8-T01 | e2e | `e2e/creator-profile.spec.ts` | modification, retour, enregistrement |

Aussi : `tests/creator-publication-view.test.ts` (modes, refus, gel, ordre du document), `e2e/member-shell.spec.ts:667` (accueil et colonne), `data-publication`, `data-trust-verified`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Carte de publication collante | `CreatorPublicationCard.tsx:159` | action en fin de vérification | faire évoluer |
| Manques en phrase | `:215-227` | C20 en liens par étape | faire évoluer |
| Récapitulatif | aucun | C42 | créer |
| Page longue après publication | `CreatorProfileScreen.tsx:187` | liste C06 | créer |
| Colonnes, sommaire, jauge | `:103-120`, `:357`, `:427` | — | supprimer (jauge : E03-Q16) |
| Publier → première ancre | `:232` | résumé focalisé | faire évoluer |

Données requises : état de chaque étape | `missingRequired` de `GET /v1/me/creator-profile` | servi. « À enrichir » | champs vides du même appel | calcul d'affichage. « Chiffres {réseau} du {date} » | `figuresMeasuredAt` de `GET …/networks` | servi ; seuil 90 jours (RG50). Badge « En cours de validation » | `status` | servi. Révisions en attente | `pendingRevisions` | servi, sans place dans la maquette.
Hors lot : aucun.

## 9. Contradictions, manques et décisions
| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E03-Q13 | Quel écran pour quel état : la maquette ne montre que brouillon, envoyé et publié | entrée de `/compte/profil` | brouillon et refusé → assistant (étape de reprise) ; en attente, publié, suspendu → E03.7 | product-owner | oui |
| E03-Q14 | États refusé, révision refusée, révisions en attente, suspendu, gelé, sans alias : aucune maquette | six états sans forme validée | tableau du §5 | fondateur, expert-ux | oui |
| E03-Q15 | Interrupteur « Visible dans la recherche » (RG8, droit d'opposition) et bloc Confiance absents | droit d'opposition perdu | sixième ligne de E03.7 « Visibilité dans la recherche » ouvrant l'interrupteur et sa conséquence écrite | fondateur, expert-conformite-rgpd | oui |
| E03-Q16 | Score de complétude (`07` RG89, RG90, `17` §5.2) absent de l'assistant et de E03.7 | jauge, accueil | le garder à l'accueil (E01) seul, avec les manques ; le retirer d'ici | product-owner | non |
| E03-Q17 | « En cours de validation » (maquette) contre « En attente de validation » (`state.pending_review`, colonne, accueil) | deux mots pour un état | garder `state.pending_review` partout | product-owner | non |
| E03-Q18 | En modification, « Environ 8 min restantes » reste affiché | texte faux | le retirer | expert-ux | non |
| E03-Q19 | Le récapitulatif montre 2 à 3 valeurs par étape (YouTube, bio, portfolio absents) | contenu de C42 | toutes les valeurs saisies ; bio et portfolio compris | product-owner | non |
| E03-Q20 | `17` §5.2 : « Publier » visible en permanence depuis le sommaire ; maquette : en fin d'assistant seulement | RG4 (« reste visible en permanence ») | amender RG4 et `17` §5.2 (choix validé par le fondateur) | product-owner | non |
| E03-Q21 | X11 (`.m-state` hors repère), X13 | coquille, textes | voir C56 | expert-ux | non |
