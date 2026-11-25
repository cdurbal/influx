# L2D-U — Constats `expert-ux` sur C2 et C4 (profil créateur, blocs 1 à 5, accueil)

HEAD a3cf08b. Aucune modification de code, aucun commit. Grille : `ux.md` + les six points des développeurs (P1 à P6).
D78 et D48 : vérifiés, aucun tarif, montant, devise ni net dans `creator-profile.json` (fr, en) ni dans les cinq composants ; la phrase de coûts est celle de D78.

## Limite de cette revue (à lire d'abord)

Ce passage n'avait aucun outil d'exécution (pas de shell) : **Playwright n'a pas été lancé, aucune capture n'a été prise** (`apps/web/test-results/` ne contient que des rapports JSON). La revue porte sur le code (`CreatorProfileScreen`, `CreatorNetworksFields`, `CreatorAudienceFields`, `CreatorOfferFields`, `CreatorProfileFields`, `CreatorHomeCard`, `CreatorAccountStateBlock`, composants `member/ui`), les deux fichiers de textes, `tokens.css`, `globals.css`, `17` §5.2 à 5.4 et `07` RG74, RG90. Les hauteurs en pixels ci-dessous sont des **estimations non mesurées**. Les constats L2DU-6, 9 et 4 décrivent un rendu déduit du CSS : à confirmer par une capture à 375 et 768 px si on veut les prioriser.
Aucun constat n'est bloquant, donc aucune capture n'est due.

## Ce qui est conforme (vérifié dans le code)

- Libellés de couche imposés (`17` l. 1354-1358), icône **et** texte sur chaque champ, jamais les codes A, I, N ; FR et EN de même structure, sans clé orpheline.
- Vert jamais seul : sommaire (icône + « Complet » / « À compléter »), notices (icône de famille + texte), badges, pastille d'horloge + texte pour la date des chiffres.
- Alias expliqué **avant le premier champ** (ordre du DOM : avertissement d'alias, puis titre court), trois phrases, durée de vie dite.
- Les trois métriques dans l'ordre abonnés, publications, commentaires, puis portée et engagement ; mêmes ordre dans les tranches (communauté, rythme, commentaires).
- Libellés d'audience tous portés sur l'audience (RG55, CA28). Virgule décimale acceptée, dates en `dateStyle: long` de la langue, `inputMode` adapté.
- Cibles : lignes de cases et boutons texte à `--size-touch-target` (44 px) ; lien « Modifier dans Mon compte » mis à part (L2DU-18).
- Aucun mot de publication dans les textes affichés, sauf l'état « Brouillon » (L2DU-15).

## Constats

### L2DU-1 — à corriger dans le jalon (P4 confirmé, plus sérieux que « plus tard »)
**Écran :** bloc 3 (titre de ligne), bloc 4 (titres de ligne et de groupe), 375 / 768 / 1440.
`tokens.css` ouvre `@theme static { --*: initial }` et ne définit aucun `--text-lg` : `text-lg` ne produit aucune règle (seul emploi du dépôt : `LINE_TITLE_CLASSES`). Avec le preflight, ces `h3` et `h4` (sans graisse ni taille) s'affichent en 16 px, graisse 400, donc **plus légers que les libellés de champ (600)** : le nom du réseau et « Vos trois chiffres clés », « Pays de votre audience », « Âges de votre audience » ne structurent plus des cartes de 10 champs.
**Correctif :** remplacer `font-display text-lg` (bloc 3) et `font-display text-md` / `font-display` seuls (blocs 3 et 4) par la constante `CARD_TITLE` (`font-display text-md font-bold`) ou, pour le nom du réseau, `text-title-section`, sans nouveau token.

### L2DU-2 — à corriger dans le jalon (P3, écran du profil)
**Écran :** profil, 375, état de départ.
Ordre du DOM sur téléphone : titre, carte de complétude avec un paragraphe de **14 noms** à `text-sm` (environ 8 à 9 lignes), sommaire de 5 lignes, puis seulement la section 1 et l'alias. L'alias (« Profil 7K3M ») n'est lu qu'après environ 700 px, hors du premier écran, et n'est pas mis en valeur (icône générique « i », valeur noyée dans une phrase en gras) : « compris en 10 secondes » n'est pas tenu au premier regard, seulement « avant la saisie ».
**Correctif :** sous lg, afficher dans la carte « 14 informations à compléter » avec la liste nominative dans un `<details>` ouvert à la demande, pour que le sommaire et l'alias tiennent dans le premier écran.

### L2DU-3 — à corriger dans le jalon (P3, accueil)
**Écran :** accueil créateur, 375, état de départ.
`CreatorHomeCard` écrit les 14 noms en un seul paragraphe à `text-md` (environ 10 lignes) **entre la jauge et le bouton « Compléter mon profil »** : l'action principale passe sous le pli. La colonne de gauche (lg) se contente d'un compte, c'est le bon niveau de détail.
**Correctif :** mettre le bouton sous la jauge et réduire la liste à « Il reste 14 informations : présentation (2), réseaux (6), audience (2), offre (2)… » (compte par bloc, chaque bloc menant à son ancre `#creator-section-…`).

### L2DU-4 — à corriger dans le jalon (P1)
**Écran :** bloc 5 « Mon offre », 375.
24 formats en cases + 11 intertitres (réseaux et UGC) + 26 secteurs refusés, chaque ligne à 44 px : environ 1 400 px de formats puis 1 150 px de secteurs, soit 3 écrans et demi de cases, sans compteur de cochés ni filtre. Le créateur voit « Live Twitch » ou « Épingle Pinterest » sans y avoir un compte. `formats` (obligatoire) et `availability` (obligatoire) sont séparés par cinq champs facultatifs.
**Correctif :** afficher d'abord les formats des réseaux déjà ajoutés au bloc 3 (plus UGC), les autres réseaux dans un `<details>` « Autres réseaux (n cochés) », et placer les secteurs refusés dans un `<details>` fermé qui annonce le nombre de choix.

### L2DU-5 — à corriger dans le jalon (P2)
**Écran :** bloc 4, ligne « autre pays », 375 puis 768 et plus.
À 375, une ligne est empilée en trois (liste de pays, part avec aide « 10 % au minimum », bouton « Retirer ») sur environ 350 px, répétée jusqu'à quatre fois **sans séparation visuelle** et avec **le même libellé** « Autre pays de votre audience » (seul le bouton porte le numéro). Aucun focus n'est repris après « Ajouter un pays » ni après « Retirer » : l'élément focalisé disparaît, le clavier repart du haut d'une page de plusieurs milliers de pixels. À partir de md, `items-end` aligne « Retirer » sur le bas de la colonne d'aide, pas sur le champ.
**Correctif :** numéroter le libellé (« Autre pays 2 de votre audience »), séparer les lignes par un filet `border-border-default`, focaliser le premier champ de la ligne ajoutée et le bouton « Ajouter un pays » après un retrait, et aligner « Retirer » sur le champ (`md:self-start` + marge du libellé).

### L2DU-6 — à corriger dans le jalon (rendu à confirmer par capture)
**Écran :** bloc 3, groupe « Vos trois chiffres clés », 768 et 1440.
`md:grid-cols-3` donne des colonnes d'environ 140 à 160 px (colonne du formulaire à 6/12 de la grille en lg). Chaque champ porte un badge de couche de 55 caractères (pastille de 4 à 5 lignes) et une aide, et `FieldFrame` place **l'aide avant le contrôle** : les trois champs ont des libellés et des aides de longueurs différentes, donc les trois saisies ne sont pas alignées entre elles et l'œil ne lit plus « un, deux, trois » en ligne. La colonne des trois métriques, censée être lue en premier, est la plus encombrée de l'écran.
**Correctif :** une seule colonne à toutes les largeurs (retirer `md:grid-cols-3`), les trois champs restant dans l'ordre abonnés, publications, commentaires.

### L2DU-7 — à corriger dans le jalon
**Écran :** bloc 3, ce que voit une marque, 375 et 1440.
Les trois métriques portent le badge « Visible uniquement après l'ouverture d'une mise en relation » (exact), alors que le texte du groupe dit « Ces trois chiffres sont les premiers que lisent les marques ». La tranche que la marque voit réellement n'apparaît que dans un encadré en bas de la ligne (après les champs secondaires), **seulement sur la ligne principale**, loin des champs. `17` l. 1402-1411 la place sous chaque champ (« Les marques voient : 25 k – 100 k »). Le lecteur ne sait pas, champ par champ, ce que voit une marque.
**Correctif :** afficher sous chacune des trois métriques la tranche dérivée (« Les marques voient : Micro (de 10 000 à 49 999) »), sans retirer l'étiquette de couche imposée, et corriger la phrase du groupe en « Les marques voient d'abord la tranche de ces trois chiffres ; le chiffre exact vient ensuite ».

### L2DU-8 — à corriger dans le jalon (« Confirmer mes chiffres »)
**Écran :** bloc 3, groupe des trois chiffres, FR et EN.
(a) `figures.confirmAll` (« confirmez aussi votre rythme de publication et vos commentaires moyens ») s'affiche, selon `creator-profile.spec.ts`, **même quand les trois chiffres viennent d'être saisis** : « aussi » est faux, et « confirmer » est ambigu (remplir ou valider ?). (b) `figures.stale` annonce la sanction (« affiché plus bas dans les résultats ») sans dire quoi faire, dans une notice d'avertissement : elle culpabilise plus qu'elle n'oriente. (c) Le bouton ne dit pas ce qu'il engage.
**Correctif :** écrire « Vos trois chiffres sont renseignés : appuyez sur « Confirmer mes chiffres » pour les dater d'aujourd'hui » quand ils sont tous présents (et « Renseignez aussi… » seulement quand il en manque), et faire commencer `stale` par l'action : « Vos chiffres datent du {date}. Vérifiez-les puis confirmez-les : au-delà de 90 jours, votre profil est affiché plus bas dans les résultats. » (textes FR et EN ; la dernière phrase reste celle de RG90).

### L2DU-9 — à corriger dans le jalon (« sans saut », rendu à confirmer par capture)
**Écran :** bloc 3, choix du compte principal, 375.
`state.primaryMove` affiche la notice « {to} est maintenant votre compte principal… » **au-dessus de toutes les lignes**. Toucher le bouton radio d'une deuxième ligne, plus bas dans la page, insère environ 70 px de notice en haut du bloc : la ligne touchée et la page sautent sous le doigt.
**Correctif :** rendre cette notice dans la ligne qui vient de devenir principale, juste sous le bouton radio.

### L2DU-10 — à corriger dans le jalon
**Écran :** bloc 3, bouton « Retirer » de la ligne.
`remove` appelle `removeCreatorNetwork` sans confirmation ni retour possible : un seul appui sur un bouton texte placé en haut d'une carte de plusieurs centaines de pixels efface les chiffres, la date confirmée et l'audience saisie de ce réseau.
**Correctif :** confirmer en ligne (« Retirer {réseau} et son audience ? [Retirer] [Garder] »), sans boîte de dialogue, avant l'appel.

### L2DU-11 — à corriger dans le jalon
**Écran :** bloc 4, somme supérieure à 100 %, 375 et 1440.
Quand une dimension dépasse 100, **rien de l'audience n'est enregistré** (pays principal compris), mais la ligne d'état en bas reste « Enregistré automatiquement à … ». Le message (« Le total dépasse 100 %. Réduisez l'une des parts. ») ne donne ni le total ni la conséquence.
**Correctif :** « Le total est de {somme} %, au plus 100. Rien n'est enregistré pour ce réseau tant que ce total n'est pas corrigé. » (FR et EN).

### L2DU-12 — avant production
**Écran :** bloc 4, groupe « Femmes, hommes et autres dans votre audience ».
Le reliquat s'écrit « Autres : 30 % » (RG57) juste sous un champ « Part de votre audience : autres ou non déclaré (%) » : deux sens de « autres » dans le même groupe.
**Correctif :** dans le groupe des genres, écrire le reliquat « Non renseigné : {share} % » (décision à confirmer par `product-owner`, RG57 dit « autres »).

### L2DU-13 — avant production (P6)
**Écran :** profil sans vitrine (`alias === null`), 375 et 1440.
L'écran garde les cinq sections en lecture seule, le sommaire « À compléter » avec icône d'alerte et « À compléter : 14 informations », alors que la notice dit « rien ne vous est demandé pour l'instant » : message contradictoire, formulaire désactivé que rien n'explique, jargon (« ouvert à la saisie »), et aucune promesse d'être prévenu à l'ouverture (principe 9).
**Correctif :** sans vitrine, ne rendre que le titre, la notice et le lien de retour (ni sommaire, ni complétude, ni sections), et écrire la notice sur le modèle « Votre profil sera ouvert prochainement. {nous vous écrirons / revenez ici} » une fois la promesse de notification confirmée par `product-owner`.

### L2DU-14 — avant production (P5)
**Écran :** bloc 5, disponibilité, FR.
« Agenda plein » (EN « Fully booked ») : **à garder**, court, naturel, accompagné de la date de déclaration (RG74), et non culpabilisant. Les défauts sont ailleurs : « Disponible sous moins de 2 semaines » est un pléonasme, et les deux premières tranches se recouvrent (« moins de 2 semaines » est aussi « moins d'un mois »).
**Correctif :** « Disponible sous 2 semaines », « Disponible sous 1 mois », « Agenda plein » (EN : « Available within 2 weeks », « Available within a month », « Fully booked »).

### L2DU-15 — avant production
**Écran :** accueil et colonne (lg), état du profil.
« État : Brouillon » (EN « Draft ») suggère une publication à venir, que l'écran ne propose pas (aucun bouton, aucune marque ne lit la vitrine au L2D) : un créateur cherche un « Publier » qui n'existe pas, ce que l'invariant 15 voulait éviter.
**Correctif :** tant que L2G n'existe pas, afficher « État : en cours de saisie » (EN « State: being filled in ») pour le statut `draft`, `product-owner` tranchant le libellé définitif.

### L2DU-16 — avant production
**Écran :** profil, tests e2e.
`expectScreen` reçoit `axe = false` à chaque appel : l'analyse axe ne tourne qu'**une fois**, en français à 1440, après les cinq blocs. Rien à 375, rien en anglais avec des lignes, rien sur la notice d'ancienneté, ni sur l'écran sans vitrine (champs désactivés).
**Correctif :** ajouter un passage axe `wcag22` à 375 sur le cas anglais (ligne YouTube déjà amorcée à 1440) et sur le cas sans vitrine.

### L2DU-17 — plus tard
**Écran :** profil, 375.
Cinq blocs toujours ouverts, plusieurs milliers de pixels, et le sommaire n'est plus visible une fois descendu (la barre fixe du bas ne porte que l'état d'enregistrement). Le profil de marque replie ses sections en accordéon sous lg.
**Correctif :** replier les blocs sous lg comme le profil de marque, ou offrir un lien « Haut de page » dans la barre du bas.

### L2DU-18 — plus tard
**Écran :** bloc 2, « Modifier dans Mon compte », 375.
Lien en `text-sm` sans hauteur minimale (environ 21 px), sous la cible de 44 px des autres commandes de l'écran.
**Correctif :** lui donner `min-h-(--size-touch-target)` et `inline-flex items-center`.

## Réponses aux six points des développeurs

- P1 (24 formats) : L2DU-4. P2 (« autre pays ») : L2DU-5. P3 (14 champs) : L2DU-2 et L2DU-3.
- P4 (`text-lg`) : confirmé sans effet, mais le défaut est plus large que le dernier mot du dev : les titres de ligne et de groupe sont en graisse 400, sous les libellés (L2DU-1).
- P5 : « Agenda plein » est conservé (L2DU-14). P6 : L2DU-13.

## Tokens

Aucun nouveau token ni aucune nouvelle couleur ; tous les correctifs emploient des classes existantes (`text-md`, `font-bold`, `text-title-section`, `--size-touch-target`, `border-border-default`). Rien à faire valider par le fondateur.

## Pour décision de l'orchestrateur

Aucun constat bloquant : la ligne 16 reste « ignoré ». Les constats « à corriger dans le jalon » (L2DU-1 à 11) n'ont pas de ligne propre dans `run.md` : à rattacher à la ligne 17 ou à une ligne ajoutée, au choix de `chef-de-projet`.

ETAT: ux ok
