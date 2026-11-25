# E03 — Profil créateur : assistant, étapes 1 à 3 (créateur)
> Suite : étapes 4 et 5 (E03.4, E03.5) dans `E03c-profil-createur-etapes-4-5.md` (limite de taille) ; E03.6 à E03.8 dans `E03b-profil-createur-recap.md`. Ce fichier porte ce qui est commun aux cinq étapes.
> Maquette : `proto-profil.html` (états `etape-1`, `etape-3`, `etape-3-tout`, `etape-5` ; étapes 2 et 4 présentes dans le HTML, ouvertes par les ancres `#etape-2` et `#etape-4`, absentes du sélecteur et du relevé commun, mesurées ici à 375, 768 et 1 440) · comparaison `ecran-3-profil-createur.html` · validée le 2026-11-23, version 2 (07) · Constats : U02, U03, U21, U22, U26, U27, U28, U30, U31, U32, U58

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|
| E03.1 | Étape 1, Vous présenter | `/fr/compte/profil` | `/en/account/profile` | `CreatorProfileFields.tsx` `PresentationFields` | `etape-1` | L | C41, E03-Q1, Q2 |
| E03.2 | Étape 2, Votre ligne éditoriale | idem | idem | `EditorialFields` | `#etape-2` | M | C23, E03-Q3 |
| E03.3 | Étape 3, Vos réseaux et vos chiffres | idem | idem | `CreatorNetworksFields.tsx` | `etape-3`, `etape-3-tout` | XL | C44, E14, E03-Q4 à Q6 |

Dossier du code : `apps/web/src/components/creator-profile/`. À préserver :
- Rôle créateur seul, sinon `notFound()` (`CreatorProfileScreen.tsx:120`) ; chargement, indisponible + « Réessayer », hors ligne (`:150-185`).
- Enregistrement automatique par champ : 600 ms, nouvelle tentative 5 s (`use-brand-profile.ts:41-43`), un champ refusé n'en retient aucun autre (`creator-profile-view.ts:207`).
- Validation par les schémas de l'API (`planPatch`, `fieldErrorOf`), messages `creatorProfile.issues.*`.
- Avertissement de détection, non bloquant (`CreatorProfileFields.tsx:114`, `07` RG27).
- Un seul compte principal, annonce du changement (`CreatorNetworksFields.tsx:371-396`) ; retrait d'un réseau en deux temps (`:328`) ; « Confirmer mes chiffres » (`:459`) ; plusieurs comptes sur un même réseau (`networks.add.help`).
- Aucun tarif (D78, D48).

API (relais `/v1/me/creator-profile`) : `GET`, `PATCH` `/` ; `GET`, `POST` `/networks` ; `PATCH`, `DELETE` `/networks/{id}` ; `POST /networks/{id}/figures` ; `PUT /networks/{id}/audience` ; `GET`, `PUT` `/portfolio` ; `PUT /portfolio/order` ; `PATCH`, `DELETE` `/portfolio/{id}` ; `GET /portfolio/{id}/image`.

**Champs obligatoires de publication** (`packages/domain/src/creator-profile/required.ts:21`) : `headline`, `bio` (étape 1) ; `primaryTopic`, `publicationLanguages`, `residenceCountry` (2) ; `networkLines`, `primaryAccount`, `handle` et `profileUrl` de **chaque** ligne, `followers` et `figuresDate` du compte principal (3) ; `mainAudienceCountry`, `mainAudienceShare` du compte principal (4) ; `formats`, `availability`, `portfolio` (3 visuels déposés) (5) ; `accountVerified` (hors étape dans la maquette, E03-Q1).

**Contrôle champ par champ** (invariant : aucune donnée perdue)

| Champ actuel | Maquette | Verdict |
|---|---|---|
| headline, bio, collaborationExperience, legalFirstName, legalLastName, contactPhone, contactEmail, city | étape 1 | présent |
| primaryTopic, secondaryTopics, tones, publicationLanguages | étape 2 | présent (4 tons montrés sur 7) |
| residenceCountry (lecture + lien « Modifier dans Mon compte »), accountLanguage (lecture) | — | **manque** |
| travelScope (Déplacements possibles) | — | **manque** |
| handle, profileUrl, followers, posts, comments, compte principal | étape 3 | présent |
| reach, engagement | repli, Instagram seul | **manque sur les autres lignes** |
| pseudonym (nom de scène) | — | **manque** |
| confirmation datée des chiffres, source, date, chiffres périmés | — | **manque (obligatoire)** |
| retrait d'un réseau | — | **manque** |
| état de vérification de la ligne | — | **manque** (E14) |
| audience : pays principal et part, 4 âges, 3 genres | étape 4 | présent |
| audience : 4 autres pays au plus (≥ 10 %) | — | **manque** |
| formats (dont UGC et autres réseaux) | Instagram, TikTok | **manque** UGC, autres réseaux |
| usageIncluded, usageOptional (3 droits) | 2 droits, choix à 3 issues | **manque** `media_buy` |
| deliveryLead, availability, refusedSectors | étape 5 | présent (2 secteurs sur 28) |
| maxExclusivity, acceptsNonMonetary | — | **manque** |
| portfolio : légende, consentement de marque, ordre, remplacement, retrait, refus et motif, 8 au plus | dépôt et titre seuls | **manque** |
| isSearchable (Visible dans la recherche) | — | **manque** |
| score de complétude | — | **manque** (E03-Q16, fichier E03b) |

## 2. Structure
Page : `.m-page` (C01), marges `--spacing-section-header` × `--spacing-page-gutter` : 48 × 48 px à 1 440, 44,4 × 43,2 à 1 280, 32,8 × 27,8 à 768, 24 × 16 à 375. Rien d'autre que l'assistant.
Assistant `.wz` (C41), `max-width: --container-narrow` (768 px), `gap --spacing-5` (24 px).

| Largeur | Cadre | Boîte `.wz` | Contenu |
|---|---|---|---|
| 1 440 | carte : bord `--border-width-thin`, `--radius-card` (16), `--color-surface-card`, `--spacing-inset-card` (32) | x 304, l 768 | l 702 |
| 1 280 | idem | x 299,2, l 768 | l 702 |
| 768 | carte, inset 24 | x 27,8, l 712,4 | l 662,4 |
| 375 | sans carte, pleine page | x 16, l 343 | l 343 |

Ordre : 1 en-tête `.wz-head` (titre + compteur, segments, méta, notice), `gap` 12 px ; 2 étape `.wz-step`, `gap` 24 px ; 3 pied `.wz-foot`, filet haut, `padding-top` 16 px, hauteur 61,8.
- Pied sous 768 px : fixe, `bottom: --size-nav-bottom-height` (56), fond `--color-surface-page`, `z-raised`, `padding` 8 × gouttière ; `.m-page` reçoit `padding-bottom: calc(--spacing-section-header + 4,5rem)`. À 768 et plus : dans le flux.
- Grilles `.fgrid` `gap` 24 : 2, 3 ou 4 colonnes égales dès 640 px (X3), 1 en dessous. Mesures à 1 440 : 2 col. 323 (réseau) ou 322 (zone interne) ; 3 col. 207,3 (réseau) ou 218 (genres) ; 4 col. 157,5.
- Zone interne : tirets, fond `--color-surface-page`, `padding` 16, 702 × 291 à 1 440, 343 × 417,5 à 375.
- Réseaux `.nets` : filet haut ; ligne fermée 61 px ; ligne ouverte fond `--color-surface-raised`, `--radius-md`, marge verticale 8, `padding` 0 16.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E03.1-S01 | En-tête | C41 | `h1` « Création de votre profil », display gras, `--text-title-section` (20 px), focalisable | toutes étapes, création | etape-1 `#wz-title` | E03.1-CA01 | E03.1-T01 |
| E03.1-S02 | En-tête | C41 | compteur « Étape n sur 5 », `--text-sm`, secondaire, aligné à droite | étapes 1 à 5 | etape-1 `#wz-count` | E03.1-CA01 | E03.1-T01 |
| E03.1-S03 | En-tête | C41 | 5 segments égaux, hauteur 6 px, `gap` 4, pilule ; faite et en cours `--color-brand-primary`, à compléter `--color-feedback-warning-icon`, à venir `--color-surface-active` ; zone de clic étendue de 10 px haut et bas | création | etape-1, etape-5 `.segs` | E03.1-CA02 | E03.1-T02 |
| E03.1-S04 | En-tête | C41 | temps : « Environ 12 min au total », « Environ {n} min restantes » | création | etape-1, etape-3 `#wz-time` | E03.1-CA03 | E03.1-T01 |
| E03.1-S05 | En-tête | C11 | lien « Enregistrer et reprendre plus tard », `--text-sm`, gras moyen, souligné | création | etape-1 `#later` | E03.1-CA04 | E03.1-T03 |
| E03.1-S06 | En-tête | C17 | notice de réussite, icône circle-check, 702 × 47,7, entrée `rise-in` | après S05 | etape-1 `#later-note` | E03.1-CA04 | E03.1-T03 |
| E03.1-S07 | En-tête | C25 | statut court « Enregistré » + icône check, à gauche de S05 | sous 768 px | etape-1 375 `.save--meta` | E03.1-CA05 | E03.1-T04 |
| E03.1-S08 | Étape | C02 | `h2` de l'étape (20 px, gras) + consigne secondaire avec son temps | toutes étapes | `.wz-step > header` | E03.1-CA06 | E03.1-T02 |
| E03.1-S09 | Pied | C10 | « Précédent », bouton texte, chevron-left, 128 × 44 | étapes 2 à 5 | etape-3 `#prev` | E03.1-CA07 | E03.1-T02 |
| E03.1-S10 | Pied | C25 | statut « Enregistré automatiquement », centré, icône check ; « Enregistrement… » (refresh-cw qui tourne), « Enregistré à {h} », « Non enregistré — nouvelle tentative dans 5 s » + « Réessayer » | dès 768 px | etape-1 `.wz-foot .save` | E03.1-CA05 | E03.1-T04 |
| E03.1-S11 | Pied | C10 | « Continuer » + arrow-right, pilule verte, 151,2 × 44,8 ; étape 5 : « Vérifier mes réponses », 240,3 × 44,8 | toutes étapes | etape-1, etape-5 `#next` | E03.1-CA07 | E03.1-T02 |
| E03.1-S12 | Étape 1 | C05 | phrase d'alias, icône info bleue, `--text-sm`, alias en primaire gras | profil avec alias | etape-1 `.wz-step > p.row` | E03.1-CA08 | E03.1-T05 |
| E03.1-S13 | Étape 1 | C18 | « Titre court », aide, champ 48 px, compteur sous le champ | toujours | etape-1 `#f-head` | E03.1-CA09 | E03.1-T05 |
| E03.1-S14 | Étape 1 | C18 | « Bio », aide, zone 4 lignes (125,2 px), compteur | toujours | etape-1 `#f-bio` | E03.1-CA09 | E03.1-T05 |
| E03.1-S15 | Étape 1 | C21 | 4 boutons radio en ligne, cible 44, pastille 24, `gap` 32 | toujours | etape-1 `.choices` | E03.1-CA10 | E03.1-T05 |
| E03.1-S16 | Étape 1 | C24 | zone interne, eye-off + libellé gras `--text-sm` | toujours | etape-1 `.zone-int` | E03.1-CA11 | E03.1-T05 |
| E03.1-S17 | Étape 1 | C18 | Prénom légal et Nom légal côte à côte, Téléphone (aide) dessous, même colonne | toujours | etape-1 `#f-fn #f-ln #f-tel` | E03.1-CA11 | E03.1-T05 |
| E03.1-S18 | Étape 1 | C26 | « Facultatif, à compléter plus tard (2) », chevron-right, filet haut, replié ; E-mail de contact (aide), Ville de résidence | toujours | etape-1 `details.opt` | E03.1-CA12 | E03.1-T05 |
| E03.2-S01 | Étape 2 | C18 | « Thématique principale », liste, 352 px max | toujours | #etape-2 `#f-top` | E03.2-CA01 | E03.2-T01 |
| E03.2-S02 | Étape 2 | C23 | « Langues de publication » : jetons 36 px, pilule, bouton x 24 px ; liste 320 px + « Ajouter » (plus), 134,6 × 46,8 | toujours | #etape-2 `.tags .adder` | E03.2-CA02 | E03.2-T01 |
| E03.2-S03 | Étape 2 | C26 | repli (2) : « Thématiques secondaires » (C23), « Ton éditorial » (cases C21) | toujours | #etape-2 `details.opt` | E03.2-CA03 | E03.2-T01 |
| E03.3-S01 | Étape 3 | C05 | phrase de visibilité, icône lock `--color-text-brand-strong` | toujours | etape-3 `p.row` | E03.3-CA01 | E03.3-T01 |
| E03.3-S02 | Étape 3 | C44 | légende de l'étoile pleine jaune (X12) | au moins une ligne | etape-3 `.legend-star` | E03.3-CA02 | E03.3-T02 |
| E03.3-S03 | Réseau | C44 | en-tête de ligne 60 px : nom (display gras) bouton étendu à toute la ligne, étoile 36 px, état, chevron | par ligne | etape-3 `.net__head` | E03.3-CA03 | E03.3-T01 |
| E03.3-S04 | Réseau | C44 | étoile pleine = principal, contour `--color-text-tertiary` sinon ; `aria-pressed` | par ligne | etape-3 `.star` | E03.3-CA02 | E03.3-T02 |
| E03.3-S05 | Réseau | C13 | badge succès « Complet », circle-check, 100,3 × 28,6 | ligne complète | etape-3 `.badge--success.done` | E03.3-CA04 | E03.3-T03 |
| E03.3-S06 | Réseau | C13 | « Lien à corriger », triangle-alert, alerte, gras moyen | ligne en défaut | etape-3 `.tstat--todo` | E03.3-CA04 | E03.3-T03 |
| E03.3-S07 | Réseau | C18 | Pseudo sur le réseau, Lien de votre profil : 2 colonnes | ligne ouverte | etape-3 `.fgrid--2` | E03.3-CA05 | E03.3-T01 |
| E03.3-S08 | Réseau | C18 | Abonnés, Publications (30 j), Commentaires moyens : 3 colonnes, champs nombre 128 px | ligne ouverte | etape-3 `.fgrid--3` | E03.3-CA05 | E03.3-T01 |
| E03.3-S09 | Réseau | C19 | « Les marques voient : » + tranche en gras, sous chaque chiffre | tranche servie (compte principal, E03-Q5) | etape-3 `.fmsg--seen` | E03.3-CA06 | E03.3-T01 |
| E03.3-S10 | Réseau | C19 | erreur sous le lien : circle-alert, rouge, gras moyen ; bord 2 px `--color-border-error` | lien d'un autre domaine | etape-3-tout `#tt-u-e` | E03.3-CA07 | E03.3-T03 |
| E03.3-S11 | Réseau | C26 | repli (2) : Portée moyenne, Taux d'engagement + % | ligne ouverte | etape-3 `#n-ig details` | E03.3-CA05 | E03.3-T01 |
| E03.3-S12 | Étape 3 | C23 | « Ajouter un réseau » : liste 320 px + « Ajouter » | toujours | etape-3 `#add-net` | E03.3-CA08 | E03.3-T01 |

## 4. Textes
Clés de `apps/web/src/locales/{fr,en}/creator-profile.json`. « X » = à écrire (expert-marketing).

| Élément | FR exact | EN | Clé |
|---|---|---|---|
| E03.1-S01 | Création de votre profil | X | nouvelle |
| E03.1-S02 | Étape {n} sur 5 | X | nouvelle |
| E03.1-S03 | Étapes ; Étape {n} : {titre}, en cours / faite / à compléter / à venir | X | nouvelle |
| E03.1-S04 | Environ 12 min au total ; Environ {n} min restantes | X | nouvelle |
| E03.1-S05, S06 | Enregistrer et reprendre plus tard ; C'est enregistré. Vous reprendrez à cette étape depuis votre accueil ou depuis « Mon profil ». | X | nouvelle |
| E03.1-S07, S10 | Enregistré ; Enregistré automatiquement ; Enregistré à {h} ; Non enregistré — nouvelle tentative dans 5 s ; Réessayer | X (« Enregistrement… » = Saving… ; Réessayer = Try again) | nouvelle ; `save.saving`, `page.retry` |
| E03.1-S09, S11 | Précédent ; Continuer ; Vérifier mes réponses | X | nouvelle |
| E03.1-S08 | Vous présenter · Ce que les marques lisent en premier. Environ 3 min. | X | nouvelle |
| E03.1-S12 | Les marques vous voient sous le nom {Profil 93JMS4} : jamais votre nom avant une mise en relation. | X | nouvelle (proche de `alias.explain`) |
| E03.1-S13 | Titre court · Votre activité en une ligne, de 20 à 120 caractères. Sans pseudo, sans lien, sans nom de marque. · {n} / 120 caractères | Short title · X · {n} / 120 characters | `fields.headline.label` ; aide nouvelle ; `field.characters` |
| E03.1-S14 | Bio · De 150 à 800 caractères, sans coordonnées. | Bio · X | `fields.bio.label` ; nouvelle |
| E03.1-S15 | Collaborations avec des marques · Aucune · De 1 à 5 · De 6 à 20 · Plus de 20 | X · None · 1 to 5 · 6 to 20 · More than 20 | nouvelle ; `experience.*` |
| E03.1-S16 | Visible uniquement par vous et l'équipe INFLUX | X (existant avec point) | `layer.internal` sans point |
| E03.1-S17 | Prénom légal · Nom légal · Téléphone · Format international. | Legal first name · Legal last name · Phone · X | `fields.*` ; nouvelle |
| E03.1-S18 | Facultatif, à compléter plus tard (2) · E-mail de contact · Sinon, votre adresse de connexion est utilisée. · Ville de résidence | X · Contact e-mail · X · City of residence | nouvelle ; `fields.*` |
| E03.1-S08 (étape 2) | Votre ligne éditoriale · Ce dont vous parlez, et dans quelle langue. Environ 1 min. | X | nouvelle |
| E03.2-S01, S02 | Thématique principale · Langues de publication · Choisir une langue… · Ajouter · Retirer {français} | Main topic · Publication languages · X · X · Remove {label} | `fields.*`, `field.remove` ; nouvelles |
| E03.2-S03 | Thématiques secondaires · Choisir une thématique… · Ton éditorial · {Inspirant, Familial, Humoristique, Expert} | Secondary topics · X · Editorial tone · `reference.tone.*` | idem (« Expert » : `reference.tone.expert` dit « Expert et technique ») |
| E03.1-S08 (étape 3) | Vos réseaux et vos chiffres · Les comptes sur lesquels vous publiez, et trois chiffres par compte. Environ 3 min. | X | nouvelle |
| E03.3-S01 | Les marques voient le réseau et des tranches. Pseudo, lien et chiffres exacts : seulement après une mise en relation. | X | nouvelle |
| E03.3-S02 | Compte principal : le premier que lisent les marques. Touchez l'étoile d'un autre réseau pour le changer. | X | nouvelle |
| E03.3-S04 | Compte principal : {Instagram} · Faire de {TikTok} le compte principal · (infobulles) Compte principal · Faire de ce compte le compte principal | Main account · X | `networks.primary.label` ; nouvelles |
| E03.3-S05, S06 | Complet · Lien à corriger | Complete · X | `summary.complete` ; nouvelle |
| E03.3-S07, S08, S11 | Pseudo sur le réseau · Lien de votre profil · Abonnés · Publications (30 j) · Commentaires moyens · Portée moyenne par publication · Taux d'engagement · % | Handle on the network · Link to your profile · Followers · X · X · Average reach per post · X | `networks.fields.*` ; nouvelles |
| E03.3-S09 | Les marques voient : {tranche} · Les marques ne voient encore aucune tranche. | Brands see: {band} · X | `networks.bands.seen` ; nouvelle |
| E03.3-S10 | Ce lien doit mener à {tiktok.com}. | X (existant : `issues.wrong_network`) | nouvelle |
| E03.3-S12 | Ajouter un réseau · Choisir un réseau… · Ajouter | Add a network · Choose a network… · X | `networks.add.*` ; nouvelle |

## 5. Interactions, états, responsive, clavier
- **Continuer** : jamais bloquant ; étape suivante, retour en haut, focus sur le `h2`, annonce « Étape {n} sur 5 : {titre}. » Avec manques : annonce « Il reste {n} information(s) indispensable(s) à cette étape : vous pourrez y revenir. » (la maquette remplace alors l'annonce d'étape par les deux à la suite). Étape 5 → E03.6.
- **Précédent**, **segment** : étapes déjà vues seulement (`disabled` sinon) ; le segment devient orange si l'étape a un manque.
- **Enregistrer et reprendre plus tard** : notice S06, annonce « Votre profil est enregistré. Vous reprendrez à l'étape {n}. » ; aucune navigation.
- **Enregistrement** : 600 ms après la saisie ; « Enregistrement… » puis « Enregistré à {h} » ; échec : annonce « Modifications non enregistrées. Nouvelle tentative dans 5 secondes. », « Réessayer » ; réussite après échec : « Modifications enregistrées. » Le succès ordinaire n'est pas annoncé.
- **Ligne de réseau** : bascule `aria-expanded` ; plusieurs ouvertes à la fois. **Étoile** : un seul principal ; annonce « {B} est maintenant votre compte principal ; {A} ne l'est plus. » ; sur la pleine : « {A} est déjà votre compte principal. »
- **Réseau complété** : badge remplace l'état, annonce « {réseau} est complet. Bravo ! ».
- **Jetons** : « Ajouter » sans choix = rien ; ajout, focus rendu à la liste, annonce « Ajouté : {nom}. » ; retrait d'un jeton : non programmé (E03-Q10).
- **États non montrés**, comportement actuel préservé : chargement (`CreatorProfileScreen.tsx:174`, proposé C09 à la forme de l'assistant), indisponible (`:166`, C17 + « Réessayer »), hors ligne (`:183`), profil sans alias (`page.noStorefront`, champs inertes), réseaux en chargement ou indisponibles (`CreatorNetworksFields.tsx:139-155`), aucun réseau (`networks.empty`), avertissement de détection (C17 sous le champ), chiffres périmés (`figures.stale`), limite de liste (`field.limitReached`), refus (bandeau, E03b), profil gelé (E03b).
- **Responsive** : 1 440 et 1 280 identiques (contenu 702) ; 768 carte à inset 24, grilles conservées, barre du bas de C56 ; 375 sans carte, grilles à 1 colonne, pied fixe, S10 masqué et S07 affiché, méta sur deux lignes (47,4), « Ajouter » sous la liste, compteur S02 sur la ligne du titre (en modification, dessous).
- **Clavier** : ordre du document ; segments, étoile, bascule sont des boutons ; l'anneau de la bascule entoure toute la ligne (`:has(:focus-visible)`).
- **Animations** (nulles en mouvement réduit) : étape `fade-in` 120 ms ; segment couleur 320 ms ; ligne `background-color` 200 ms, contenu `rise-in` 200 ms, chevron `rotate` 200 ms ; étoile `fill` 120 ms + `pop-in` 320 ms (0,6 → 1,15 → 1) ; « Complet » `pop-in` 320 ms, ligne `done-flash` 900 ms ; repli chevron 200 ms, contenu `rise-in` 200 ms ; icône d'enregistrement `spin` 1 s ; toutes `--ease-standard` (spin linéaire).

## 6. Critères d'acceptation
- **E03.1-CA01** Assistant de 768 px au plus, carte dès 768 px (rayon 16), sans carte en dessous ; titre et compteur conformes à §2.
- **E03.1-CA02** Segments : 4 états de couleur, doublés d'un nom accessible ; une étape à venir est inerte ; `aria-current="step"` sur la courante.
- **E03.1-CA03** Temps restant : somme des étapes restantes (3, 1, 3, 2, 3 min).
- **E03.1-CA04** « Enregistrer et reprendre plus tard » affiche la notice et l'annonce ; la reprise ouvre la bonne étape (E03-Q2).
- **E03.1-CA05** Enregistrement 600 ms, reprise 5 s, échec annoncé, « Réessayer » ; aucune saisie perdue.
- **E03.1-CA06** Changement d'étape : haut de page, focus sur le `h2`, annonce.
- **E03.1-CA07** « Continuer » n'est jamais désactivé ; pied fixe au-dessus de la barre sous 768 px, entièrement visible à 320 px (E03-Q9).
- **E03.1-CA08** L'alias est annoncé avant toute saisie ; sans alias, `alias.none`.
- **E03.1-CA09** Compteurs en caractères (points de code), 120 et 800 ; avertissement de détection non bloquant.
- **E03.1-CA10** Expérience : 4 valeurs, retour à « non renseigné » inchangé.
- **E03.1-CA11** Identité légale et téléphone dans C24 ; jamais servis à une marque.
- **E03.1-CA12** Repli fermé au premier affichage, compte = nombre de champs repliés.
- **E03.2-CA01** Thématique principale retirée des secondaires (RG33).
- **E03.2-CA02** Choisir puis ajouter : rien avant « Ajouter » ; focus conservé ; limites de liste respectées.
- **E03.2-CA03** Les champs manquants de §1 (pays de résidence, langue, déplacements) sont présents selon E03-Q3.
- **E03.3-CA01** Aucun libellé A, I, N ; la phrase de visibilité précède les champs.
- **E03.3-CA02** Exactement un compte principal, changé par l'étoile, jamais par la couleur seule.
- **E03.3-CA03** Ligne entière cliquable hors étoile ; plusieurs lignes ouvertes ; ligne ajoutée ouverte avec le focus sur son premier champ.
- **E03.3-CA04** « Complet » et « à corriger » écrits, dérivés des règles d'E03-Q6.
- **E03.3-CA05** Grilles 2 puis 3 colonnes dès le seuil retenu pour X3, 1 colonne en dessous ; pseudonyme, portée, engagement de chaque ligne conservés.
- **E03.3-CA06** La tranche est celle de l'API, jamais calculée dans le navigateur.
- **E03.3-CA07** Lien d'un autre domaine : erreur sous le champ, `aria-invalid`, `aria-describedby`, effacée à la correction.
- **E03.3-CA08** Deux comptes du même réseau restent possibles.

## 7. Tests
| ID | Niveau | Fichier | Ce qu'il prouve |
|---|---|---|---|
| E03.1-T01 | visuel | `e2e/creator-profile.spec.ts` (à adapter) | cadre, titres, compteur, temps à 375, 768, 1 280, 1 440 |
| E03.1-T02 | e2e | `e2e/creator-profile.spec.ts` | Continuer, Précédent, segments, focus, annonces |
| E03.1-T03 | e2e | `e2e/creator-profile.spec.ts` | reprise plus tard |
| E03.1-T04 | e2e | `e2e/creator-profile.spec.ts` | enregistrement, échec, reprise (RG111) |
| E03.1-T05 | e2e, a11y | `e2e/creator-profile.spec.ts` | champs de l'étape 1, zone interne, repli, axe |
| E03.2-T01 | e2e | `e2e/creator-profile.spec.ts` | jetons, limites, tons |
| E03.3-T01 | e2e | `e2e/creator-profile.spec.ts` | lignes, tranches `[data-band-of]` |
| E03.3-T02 | e2e, a11y | `e2e/creator-profile.spec.ts` | étoile, un seul principal |
| E03.3-T03 | unitaire | `tests/creator-networks-view.test.ts` | état de ligne (complet, à corriger) |

Attributs attendus par les specs, à conserver : `data-section`, `data-network-line`, `data-audience-line`, `data-band-of`, `data-remainder`, `data-figures-source`, `data-figures-caption`, `data-fold`, `data-layer-icon-only`, `data-missing-fold`, `data-portfolio-drop`, `data-portfolio-item`, `data-item-state`, `data-state`, `data-preview-link`, `data-trust-verified` ; ancres `#creator-section-*` (liens de l'accueil, `CreatorHomeCard.tsx`).

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Page à 7 sections, 3 colonnes | `CreatorProfileScreen.tsx:103-120` | C41 | créer |
| Sommaire, ancres | `:357` | segments | supprimer ; ancres redirigées |
| Compte principal (bouton radio) | `CreatorNetworksFields.tsx:372` | étoile | faire évoluer |
| Chiffres sur une colonne | `:64` | 3 colonnes | faire évoluer |
| Étiquette de couche par champ | `CreatorProfileFields.tsx:70` | par groupe | E03-Q4 |

Données requises : tranches des comptes non principaux | non (`bands` nul hors principal, `packages/contracts/src/creator-profile.ts:759`) | écart, E03-Q5. Étape en cours mémorisée | non | E03-Q2. Nom de domaine attendu par réseau | non servi au front (code `wrong_network`) | E03-Q6.
Hors lot : aucun.

## 9. Contradictions, manques et décisions
| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E03-Q1 | « Compte vérifié » est obligatoire (`required.ts:43`, `08` RG16) et absent de l'assistant, du récapitulatif et des manques | profil jamais publiable sans que le créateur sache pourquoi | ligne d'état par réseau à l'étape 3 (annoncée par l'écran 14) + manque « un compte vérifié par INFLUX » menant à E14.1 | fondateur | oui |
| E03-Q2 | Reprise « à cette étape » : aucune étape mémorisée ; aucune adresse d'étape | lien de reprise, retour du navigateur | paramètre d'adresse par étape ; sans lui, première étape incomplète selon `missingRequired` | architecte | oui |
| E03-Q3 | Champs absents de la maquette (§1) : pays de résidence, langue, déplacements, pseudonyme, autres pays, UGC, `media_buy`, exclusivité, contrepartie, portfolio complet, visibilité dans la recherche ; étapes 2 et 4 hors sélecteur, donc non relues comme états | données perdues si recopié tel quel | étape 2 repli : résidence, langue, déplacements ; étape 3 repli : pseudonyme ; étape 4 : « Ajouter un pays » ; étape 5 repli : exclusivité, contrepartie, 3 droits ; visibilité sur E03.7 ; faire valider les étapes 2 et 4 | fondateur | oui |
| E03-Q4 | Étiquette de couche par champ imposée (`07` RG21, RG112, `17` §5.2) ; maquette : zone interne + une phrase, rien sur les champs publics (07 §7.2, C4 « à valider ») | forme de tous les champs | une étiquette par groupe (étape 1 publique, zone interne, étape 3 révélée) | product-owner, expert-conformite-rgpd | oui |
| E03-Q5 | « Les marques voient » sur les comptes non principaux ; l'API ne les donne que pour le principal (RG22) ; libellés de tranches différents des références | calcul interdit dans le front | afficher pour le principal seul, libellés `reference.*` | product-owner | oui |
| E03-Q6 | « Complet » par réseau, « Lien à corriger » et « Ce lien doit mener à {domaine} » : règle et domaine non définis ; lien inadmissible non enregistré (RG43) | état de ligne | complet = pseudo, lien, 3 chiffres sans erreur ; message actuel `issues.wrong_network` si le domaine n'est pas servi | product-owner | oui |
| E03-Q10 | Détails : bouton x de jeton 24 px, étoile 36 px sous `--size-touch-target` (44) ; « Ajouter un réseau » propose YouTube déjà présent ; retrait d'un jeton et d'un réseau non programmés ; X3, X7, X11, X12, X13 | finition | cibles étendues à 44 ; listes réelles ; retrait actuel conservé en bas de ligne ouverte | expert-ux | non |
