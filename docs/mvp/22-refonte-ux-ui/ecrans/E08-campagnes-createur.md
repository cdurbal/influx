# E08 — Fil et fiche de campagne (créateur)
> Maquette : `proto-campagnes-createur.html` (états `fil`, `vide`, `fiche`, `fiche-close` ; `fiche-lot4` hors lot) · page de comparaison `ecran-8-campagnes-createur.html` · validée le 2026-11-24 (07) · Constats : U14, U15, U46

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|
| E08.1 | Fil des campagnes | `/fr/campagnes` | `/en/campaigns` | `CampaignFeedScreen.tsx`, `CampaignFeedCard.tsx` | `fil`, `vide` | M | C48, C30, E08-Q1, Q2 |
| E08.2 | Fiche de campagne | `/fr/campagnes/[id]` | `/en/campaigns/[id]` | `CampaignRecordScreen.tsx`, `CampaignReadBody.tsx` | `fiche`, `fiche-close` | L | C40, C39, E05b, E08-Q3 à Q6 |

Dossier du code : `apps/web/src/components/campaign/`. Adresses communes aux deux rôles : l'écran suit le rôle réel (`lib/member-paths.ts` `CAMPAIGNS_PAGE`, `CAMPAIGN_PAGE`).
À préserver :
- Fil : deux tris (`open-campaigns-view.ts` `FEED_SORTS`), tri `recent` par défaut (`packages/contracts/src/open-campaigns.ts`, `11` RG33) ; nombre avant la liste (`CampaignFeedScreen.tsx:187`, RG35) ; « Voir la suite », jamais de défilement infini (`:163`, RG36) ; carte déjà vue ignorée (`open-campaigns-view.ts` `mergeCards`) ; plafond dit (`feed.capReached`, RG21).
- Carte close : 7 jours, atténuée, libellé écrit, sans lien (`CampaignFeedCard.tsx:100-111`, RG26). Logo lu par sa route (`:37`).
- Refus et limites : `forbidden`, `rate_limited` avec délai, `unavailable` + « Réessayer » (`CampaignFeedScreen.tsx:72`).
- Fiche : lecture journalisée par l'API seule (RG22) ; inconnue, en pause, close, marque suspendue = même réponse « n'est plus ouverte » (`CampaignRecordScreen.tsx:118`, RG24, T14) ; notices obligatoires droits d'usage et divulgation (`CampaignReadBody.tsx:52-66`, `09` RG32, RG40) ; aucun contact (RG81), rôle du contact seulement (`06` RG35).
- `CampaignReadBody` est **partagé** avec l'aperçu de la marque (`CampaignPreviewScreen.tsx`, `09` RG102) : la marque doit lire exactement ce que lit le créateur. Le faire évoluer pour les deux.
- Aucun montant (D78).

API : `GET /v1/open-campaigns?sort=recent|deadline&page=1..50` ; `GET /v1/open-campaigns/{id}` ; `GET /v1/open-campaigns/{id}/brand-logo`.

## 2. Structure
**E08.1.** `.page` colonne `gap --spacing-5` (24). Ordre : en-tête, filtres, grille, message sans résultat.
- En-tête : titre à gauche, outils à droite (nombre + liste de tri 224 × 48) ; sous 640 px (X3), outils sur une deuxième ligne pleine largeur (375 : 343 × 48, liste 200,5).
- Filtres `.fbar` : une ligne, `gap` 8, pastilles 40 px, défilement horizontal sans barre (375 : contenu jusqu'à 522,8 px ; X8).
- Grille `.grid` : `repeat(auto-fill, minmax(18rem, 1fr))`, `gap` 16. 1 440 : 3 × 352 ; 1 280 : 3 × 301,9 ; 768 : 2 × 348,2 ; 375 : 1 × 343. Carte : `--radius-card` 16, `padding` 16, `gap` 8, hauteur 183,9 à 226,3, étirée à la ligne.

**E08.2.** Ordre : retour, en-tête (marque, titre, badge clos), grille de lecture.
- `h1` 640 px max, `clamp(1,625rem … 2,125rem)` (X1) : 34 px à 1 440, 26 px à 375.
- `.r-grid` dès 1 024 px : `7fr` / `min 19rem, 4fr`, `gap --spacing-9` (64). 1 440 : 651,6 + 372,4 ; 1 280 : 555,9 + 317,7. Sous 1 024 : une colonne (712,4 à 768, 343 à 375).
- Colonne : sections séparées par un filet, `padding` 32 0, `gap` 16 ; texte à `--size-measure` (640).
- Encadré `.aside` collant (`top --spacing-6`, 32) dès 1 024 ; carte `padding` 24, `--shadow-md` (X5). Sous 1 024 : masqué, remplacé par la barre fixe `.mbar` (63,8 de haut, au-dessus de la barre du bas ; `.m-main` `padding-bottom` + 4,25 rem).
- L'essentiel `.ess` : 2 × 2 cases (651,6 × 191 à 1 440), filets internes ; 1 colonne sous 640 px (X3), 343 × 380,9 à 375.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E08.1-S01 | En-tête | C02 | `h1` « Campagnes », `--text-title-page` | toujours | fil `.feed-head h1` | E08.1-CA01 | E08.1-T01 |
| E08.1-S02 | En-tête | C32 | nombre de campagnes, `--text-sm` secondaire, région polie | fil non vide | fil `#f-count` | E08.1-CA02 | E08.1-T02 |
| E08.1-S03 | En-tête | C30 | liste de tri nommée « Trier par » (nom accessible seul, sans libellé visible) | fil non vide | fil `#sort` | E08.1-CA03 | E08.1-T02 |
| E08.1-S04 | Filtres | C30 | 4 pastilles à bascule : Ma thématique, Mes réseaux, Pays (chevron), Produit envoyé (sans chevron) ; active : bord primaire, fond `--color-surface-active`, libellé avec valeurs | fil non vide, E08-Q1 | fil `.fbar .pill` | E08.1-CA04 | E08.1-T03 |
| E08.1-S05 | Carte | C48 | carte entière cliquable, sans bouton ; survol : bord `--color-border-hover`, −2 px ; anneau sur la carte | campagne ouverte | fil `.cc`, `.cc__t` | E08.1-CA05 | E08.1-T01 |
| E08.1-S06 | Carte | C33 | pastille claire 32 px (logo ou initiales), nom de la marque, icône bleue 16 px nommée « Marque vérifiée » (X2) | icône si badge | fil `.cc__brand` | E08.1-CA06 | E08.1-T01 |
| E08.1-S07 | Carte | C48 | titre-lien, display gras, `--text-md`, sans soulignement | toujours | fil `.cc__t` | E08.1-CA05 | E08.1-T01 |
| E08.1-S08 | Carte | C48 | échéance en délai, horloge, gras moyen ; `--color-feedback-warning-text` sous 3 jours avec « plus que » | date limite présente | fil `.due`, `.due--soon` | E08.1-CA07 | E08.1-T04 |
| E08.1-S09 | Carte | C48 | ligne secondaire : réseau et contenus, « produit envoyé » | toujours | fil `.cc__meta` 1 | E08.1-CA08 | E08.1-T01 |
| E08.1-S10 | Carte | C48 | ligne secondaire : pays d'audience et thématiques | toujours | fil `.cc__meta` 2 | E08.1-CA08 | E08.1-T01 |
| E08.1-S11 | Sans résultat | C08 | phrase + « Retirer les filtres » | filtres sans résultat | fil, script `#f-none` | E08.1-CA04 | E08.1-T03 |
| E08.1-S12 | Vide | C08 | megaphone 32 px, titre, texte 640 px max, bouton secondaire « Voir mon profil » 159,4 × 46,8 ; sans outils ni filtres | fil vide | vide `.empty-state` | E08.1-CA09 | E08.1-T02 |
| E08.2-S01 | Retour | C11 | « ‹ Campagnes », `--text-sm` secondaire | toujours | fiche `.crumb` | E08.2-CA01 | E08.2-T01 |
| E08.2-S02 | En-tête | C33 | pastille 48 px, nom (display gras) + icône vérifiée (X2), secteur et pays | toujours | fiche `.rbrand` | E08.2-CA02 | E08.2-T01 |
| E08.2-S03 | En-tête | C02 | `h1` titre de la campagne, extra-gras | toujours | fiche `.rhead h1` | E08.2-CA01 | E08.2-T01 |
| E08.2-S04 | En-tête | C13 | badge alerte « Candidatures closes depuis le {date} », horloge, 294,2 × 28,6 | close | fiche-close `.closed` | E08.2-CA03 | E08.2-T02 |
| E08.2-S05 | L'essentiel | C35 | 4 cases icône 32 px + libellé `--text-xs` + valeur gras moyen + précision : Candidatures, Publication, Contenus demandés, Contrepartie ; titre masqué visuellement (X9) | valeur présente | fiche `.ess` | E08.2-CA04 | E08.2-T01 |
| E08.2-S06 | Ce qui vous concerne | C36 | 3 faits : icône 32, titre gras moyen, phrase `--text-sm` ; mention `--text-xs` | E08-Q3 | fiche `.reasons` | E08.2-CA05 | E08.2-T03 |
| E08.2-S07 | Le brief | C03 | texte 640 max, 5 lignes puis « Lire la suite », « Réduire » | brief présent | fiche `#brief #more` | E08.2-CA06 | E08.2-T01 |
| E08.2-S08 | Ce qui est attendu | C65 | Messages clés, Interdits et points de vigilance en listes à points | valeurs présentes | fiche `.bullets` | E08.2-CA07 | E08.2-T01 |
| E08.2-S09 | Droits et conditions | C07 | libellé 192 px (12 rem), `--text-md`, 46 rem max : Droits d'usage, Exclusivité, Produit, Langue de publication | valeurs présentes | fiche `.props` | E08.2-CA07 | E08.2-T01 |
| E08.2-S10 | La marque | C03 | présentation 640 max + lien « Voir la page de la marque › » | E08-Q6 pour le lien | fiche `#h-brand` | E08.2-CA08 | E08.2-T01 |
| E08.2-S11 | Encadré | C39 | « {9} jours » (`--text-heading-3`, X1) + « pour candidater, jusqu'au {date} » ; phrase du commercial ; « Voir mon profil » secondaire pleine largeur ; filet + mention du montant | ouverte, dès 1 024 | fiche `.box` | E08.2-CA09 | E08.2-T01 |
| E08.2-S12 | Encadré | C39 | « Closes » + « depuis le {date} » ; phrase ; « Voir les campagnes ouvertes » ; mention du montant | close, dès 1 024 | fiche-close `.box` | E08.2-CA03 | E08.2-T02 |
| E08.2-S13 | Barre | C39 | « {9} jours pour candidater » + « Voir mon profil » ; close : « Closes » + « Campagnes ouvertes » | sous 1 024 | fiche, fiche-close `.mbar` | E08.2-CA10 | E08.2-T01 |

## 4. Textes
Clés de `apps/web/src/locales/{fr,en}/campaign.json`. « X » = à écrire (expert-marketing).

| Élément | FR exact | EN | Clé |
|---|---|---|---|
| E08.1-S01 | Campagnes | Campaigns | `feed.title` |
| E08.1-S02 | {6} campagnes ouvertes · {1} campagne ouverte | X (existant `feed.count`) | nouvelle |
| E08.1-S03 | Trier par · Date limite proche · Plus récentes · (annonce) Tri : {tri}. | Sort by · X · Most recent · X | `feed.sort.label`, `feed.sort.recent` ; nouvelles (existant « Date limite la plus proche ») |
| E08.1-S04 | Filtres · Ma thématique · Mes réseaux · Pays · Produit envoyé · Ma thématique : {Cuisine et gastronomie, Bien-être} · Mes réseaux : {Instagram, YouTube} · Pays : {France, Belgique} | X | nouvelles |
| E08.1-S06 | {Atelier Sève} · Marque vérifiée | X | nouvelle |
| E08.1-S08 | Candidatures : {9} jours · Candidatures : plus que {2} jours | X | nouvelles |
| E08.1-S09, S10 | {Instagram : 1 Reel, 2 stories} · produit envoyé ; {Belgique · Cuisine et gastronomie} | X | nouvelles |
| E08.1-S11 | Aucune campagne ne répond à ces filtres. · Retirer les filtres | X | nouvelles |
| E08.1-S12 | Aucune campagne ouverte pour le moment · Les marques publient de nouvelles campagnes chaque semaine. En attendant, un profil complet est ce que regarde votre commercial quand il vous propose à une marque. · Voir mon profil | X | nouvelles (existant `feed.empty.*`, E08-Q8) |
| E08.2-S01 | Campagnes | Campaigns | `record.back` |
| E08.2-S02 | {Atelier Sève} · Marque vérifiée · {Beauté et soins · France} | X | nouvelle |
| E08.2-S04 | Candidatures closes depuis le {3 décembre} | X | nouvelle |
| E08.2-S05 | L'essentiel · Candidatures · Jusqu'au {3 décembre} · dans {9} jours · Closes le {3 décembre} · Publication · Du {24 décembre} au {21 janvier} · contenus livrés avant le {18 décembre} · Contenus demandés · {Instagram : 2 Reels} · validation par la marque sous {3} jours ouvrés · Contrepartie · {Rémunération et produit} · montant à négocier avec votre commercial | X | nouvelles ; `feed.card.period.range` (Du {from} au {to}) |
| E08.2-S06 | Ce qui vous concerne · Vous publiez dans la langue demandée · La campagne demande {le français}, l'une de vos {deux} langues de publication. · Une audience dans le pays visé · La campagne vise {la France} ; {25} % de votre audience {Instagram} y est. · Le réseau demandé est votre réseau principal · {Instagram}, audience vérifiée par INFLUX. · Des faits tirés de votre profil, jamais une note. | X | nouvelles |
| E08.2-S07 | Le brief · Lire la suite · Réduire | X | nouvelles |
| E08.2-S08 | Ce qui est attendu · Messages clés · Interdits et points de vigilance | X · Key messages · Restrictions and points of care | `preview.rows.keyMessages`, `preview.rows.restrictions` |
| E08.2-S09 | Droits et conditions · Droits d'usage · Exclusivité · Aucune · Produit · Envoyé, vous le conservez ; envoi à la charge de la marque · Langue de publication | X · Usage rights · X | `preview.rows.usageRights` ; nouvelles |
| E08.2-S10 | La marque · Voir la page de la marque | The brand · X | `preview.brandTitle` ; nouvelle |
| E08.2-S11 | {9} jours · pour candidater, jusqu'au {3 décembre} · La candidature ouvrira avec la messagerie. D'ici là, votre commercial INFLUX peut vous proposer à cette marque : un profil complet l'y aide. · Voir mon profil · Montant à négocier avec votre commercial INFLUX. | X | nouvelles |
| E08.2-S12 | Closes · depuis le {3 décembre} · Cette campagne n'accepte plus de candidature. · Voir les campagnes ouvertes | X | nouvelles |
| E08.2-S13 | {9} jours · pour candidater · Closes · Campagnes ouvertes | X | nouvelles |

## 5. Interactions, états, responsive, clavier
- **Carte** → E08.2 ; toute la carte est la zone du lien. **Carte close** : non montrée ; sans lien (`CampaignFeedCard.tsx:101`), atténuée, « Candidatures closes » (C13) à la place de S08, sans opacité en dur (X4).
- **Tri** : la maquette réordonne la page et annonce « Tri : {tri}. » ; réel : nouvel appel, squelettes, retour en page 1 (`CampaignFeedScreen.tsx:143`).
- **Pastille** : bascule, libellé enrichi, annonce du nombre ; les chevrons de la maquette n'ouvrent rien (E08-Q1).
- **Voir la suite**, plafond, échec de la suite : non montrés ; conservés (`:151-172`), C10 secondaire et C17 sous la grille.
- **Lire la suite** : `aria-expanded`, texte déplié sur place ; le bouton n'apparaît que si le texte dépasse 5 lignes (non programmé).
- **Voir mon profil** → `/compte/profil` ; **Voir les campagnes ouvertes** → E08.1 ; **Voir la page de la marque** → E05b.
- **États** non montrés, préservés : chargement du fil (3 squelettes, `:83-97`, C09 à la forme de C48), échec (`:98-114`), hors ligne (`:182`), compte refusé (`feed.forbidden`), limite de lecture (`feed.rateLimitedWait`) ; fiche : chargement (`CampaignRecordScreen.tsx:143`), n'est plus ouverte (`:118`), refus, limite, échec. Représentation proposée : C08 ou C17 dans la colonne.
- **Responsive** : §2 ; sous 1 024, l'encadré disparaît et ses phrases avec lui (E08-Q7).
- **Clavier** : un arrêt par carte, anneau sur la carte (`:has(.cc__t:focus-visible)`) ; retour depuis la fiche : focus sur le `h1` (règle de la coquille).
- **Animations** : carte `border-color` et `translate` 120 ms (translation seulement sans mouvement réduit) ; pastille `border-color`, `background-color` 120 ms ; `--ease-standard`.

## 6. Critères d'acceptation
- **E08.1-CA01** Grille 3, 3, 2, 1 colonnes à 1 440, 1 280, 768, 375 ; aucun débordement horizontal de page.
- **E08.1-CA02** Le nombre, total de l'API, est lu avant la liste et annoncé à chaque changement.
- **E08.1-CA03** Deux tris exactement ; tri par défaut selon E08-Q2.
- **E08.1-CA04** Un filtre actif est nommé et retirable d'un geste ; aucun pré-rempli ; sans résultat, les filtres sont nommés (RG29 à RG31).
- **E08.1-CA05** Un seul lien par carte, nommé par le titre ; aucun bouton « Voir la campagne ».
- **E08.1-CA06** Le badge dit « Marque vérifiée » et sa date selon X2 et `06` RG53.
- **E08.1-CA07** Délai calculé en jours civils ; sans date limite, la ligne est absente ; sous 3 jours, alerte doublée du mot « plus que ».
- **E08.1-CA08** Nature de la contrepartie et mention « à négocier » présentes (RG15, D78) selon E08-Q4 ; aucun montant ni compteur de candidatures.
- **E08.1-CA09** Fil vide : C08, sans filtre ni tri, lien vers le profil.
- **E08.2-CA01** Un `h1`, retour au fil, colonnes conformes à §2.
- **E08.2-CA02** Marque : nom, secteur, pays ; ni site, ni e-mail, ni téléphone, ni nom de personne.
- **E08.2-CA03** Campagne close : réponse unique selon E08-Q5.
- **E08.2-CA04** Cases sans valeur absentes ; `dl` valide (X9).
- **E08.2-CA05** Des faits vérifiables, jamais une note ni un tri (D11).
- **E08.2-CA06** Brief à 640 px, retours à la ligne conservés (`whitespace-pre-line`).
- **E08.2-CA07** Toutes les valeurs servies aujourd'hui (§8) restent lisibles ; notices divulgation et droits d'usage présentes quand elles s'appliquent.
- **E08.2-CA08** Aucun lien ne mène hors d'INFLUX.
- **E08.2-CA09** Aucun bouton « Candidater » avant le Lot 4 ; le rôle du commercial est écrit.
- **E08.2-CA10** Barre fixe au-dessus de la barre du bas, sans recouvrir le dernier contenu, dans un repère (X11).

## 7. Tests
| ID | Niveau | Fichier | Ce qu'il prouve |
|---|---|---|---|
| E08.1-T01 | visuel, a11y | `e2e/creator-campaigns.spec.ts` (`:112`, `:199`, à adapter) | cartes, grille, axe, FR 375 et EN 1 440 |
| E08.1-T02 | e2e | `e2e/creator-campaigns.spec.ts` (`:243`) | nombre, tri, refus, suite, plafond, vide |
| E08.1-T03 | e2e | nouveau, si E08-Q1 l'admet | filtres, sans résultat |
| E08.1-T04 | unitaire | `tests/open-campaigns-view.test.ts` | délai, seuil de 3 jours, fuseau |
| E08.2-T01 | visuel, e2e, a11y | `e2e/creator-campaigns.spec.ts` (`:364`) | fiche, aucune prise de contact, axe |
| E08.2-T02 | e2e | `e2e/creator-campaigns.spec.ts` (`:428`) | plus ouverte, notices |
| E08.2-T03 | unitaire | nouveau | règle de chaque fait (E08-Q3) |

Attributs à conserver : `data-feed-card`, `data-closed`, `data-feed-brand`, `data-feed-notice`, `data-feed-count`, `data-campaign-record`, `data-campaign-notice`, `data-creator-preview`, `data-preview-section`, `data-preview-brand`, `data-field`. Aussi `e2e/campaign-record.spec.ts`, `tests/campaign-preview-view.test.ts` (corps partagé).

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Carte avec bouton vert | `CampaignFeedCard.tsx:145` | C48 cliquable | faire évoluer |
| Liste | `FEED_LIST_CLASSES` | grille auto-fill | faire évoluer |
| Badge en ligne de texte | `:86` | icône seule | X2 |
| Filtres | aucun | C30 | créer (E08-Q1) |
| Fiche en deux cartes de lignes | `CampaignReadBody.tsx:67-118` | C40 | faire évoluer (partagé avec l'aperçu de marque) |
| Notice « pas encore de candidature » | `CampaignRecordScreen.tsx:169` | encadré | faire évoluer |
| Notices droits d'usage, divulgation | `CampaignReadBody.tsx:52` | absentes de la maquette | conserver (E08-Q4) |

Données requises : pays de la marque sur la fiche | oui (`brand.country`, `campaign-creator-view.ts:97`). Produit envoyé sur la carte | non (la carte ne porte que `remunerationKind`) | écart. Pays et thématiques | oui. Filtres | non (`openCampaignsQuerySchema` strict : `sort`, `page`) | écart. Faits « vous concerne » | aucune route | écart ; la part d'audience exacte vient de `GET /v1/me/creator-profile/networks`. Fiche d'une campagne close | non (refus) | écart. Page de marque pour un créateur | aucune route | écart.
Valeurs servies et absentes de la fiche de maquette : type de campagne, résumé public, description et catégorie du produit, durée, territoire et pays des droits, pièces à joindre, pays, thématiques, tailles, âges et genre de l'audience visée, créateurs recherchés ; marque : secteurs secondaires, taille, marchés, langues, thématiques, réseaux, formats, rôle du contact, date du badge. Le site web, servi aujourd'hui, est retiré de la vue des créateurs (07, écran 5 bis).
Hors lot (Lot 4) : `fiche-lot4`, bouton « Candidater » et sa phrase, barre « Candidater ».

## 9. Contradictions, manques et décisions
| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E08-Q1 | Filtres : `11` EC-L3D-2 les diffère au Lot 6bis ; l'API ne les accepte pas ; « Produit envoyé » n'est pas dans la liste fermée RG27 ; chevrons sans panneau dessiné | ligne de filtres | livrer sans la ligne de filtres au Lot 3bis ; la créer avec l'API, sur la liste RG27 | fondateur, architecte | oui |
| E08-Q2 | Tri par défaut : date limite (maquette) contre `recent` (RG33, contrat) ; libellé « Date limite proche » | défaut de l'API et de l'écran | amender RG33 ou garder `recent` | product-owner | oui |
| E08-Q3 | « Ce qui vous concerne » : règle, calcul et route non définis ; « 25 % » est la valeur exacte du créateur lui-même | section entière | fonction pure partagée avec E05b, faits fermés, section masquée sans fait | expert-matching, architecte | oui |
| E08-Q4 | Carte : RG15 est « exactement » (nature, mention à négocier, taille, secteur, période, date de publication, date du badge) ; la maquette les retire. Fiche : valeurs de §8 et notices obligatoires `09` RG32, RG40 (`17` §5.6) absentes | perte d'information réglementaire et métier | carte : nature et mention sur la ligne des contenus, amender RG15 pour le reste ; fiche : notices en tête de « Droits et conditions », autres valeurs dans les sections existantes, « Pour qui » ajoutée | fondateur, expert-conformite-rgpd | oui |
| E08-Q5 | Fiche d'une campagne close montrée en entier ; code et RG24, T14 : « n'est plus ouverte », même réponse que l'inconnue ; la carte close n'a pas de lien (RG26) | état `fiche-close` inatteignable | garder la réponse unique ; ne pas construire `fiche-close` sans amender RG24 | product-owner, expert-cybersecurite | oui |
| E08-Q6 | « Voir la page de la marque » : aucune route côté créateur (E05b) | lien mort | masquer le lien jusqu'à E05b | architecte | non |
| E08-Q7 | Sous 1 024 px, « La candidature ouvrira avec la messagerie » et « Montant à négocier » disparaissent avec l'encadré ; un créateur sur téléphone ne sait pas pourquoi il ne peut pas candidater | information perdue | bloc en fin de colonne sous 1 024 px | expert-ux | oui |
| E08-Q8 | Vide : « Les marques publient de nouvelles campagnes chaque semaine » est invérifiable ; `17` §5.5 impose le texte `feed.empty.text` | texte | garder `feed.empty.*` | expert-marketing | non |
| E08-Q9 | Carte close, « Voir la suite », plafond, échecs, squelettes : sans maquette ; `h1` de carte : les titres de carte ne sont plus des titres (`h2` aujourd'hui) | forme, navigation par titres | reprendre §5 ; garder un `h2` autour du lien | expert-ux | non |
| E08-Q10 | X1 (titre et « 9 jours »), X2, X3, X5, X7, X8, X9, X11, X13 ; `.props` à 375 : libellé 192, valeur 127 | finition | empiler libellé et valeur sous 480 px | expert-ux | non |
