# 07 — Conception visuelle et prototypes

> Suite de `01` à `06`. Propositions visuelles pour cinq écrans, à valider par le fondateur avant
> toute modification des composants de production. **Aucun fichier de production n'a été
> modifié.**
>
> **Validation du fondateur (2026-11-23)** :
> - Écran 1, accueils marque et créateur : **validé**.
> - Écran 4, tableau de bord du backoffice : **validé**.
> - Écran 2, recherche de créateurs : **validé en version 2** (2026-11-23). La colonne de filtres
>   est remplacée par une ligne de filtres en pastilles et un dialogue « Filtres », comme sur
>   Airbnb. Les cartes deviennent des cartes photo au format 4:3, 3 par ligne sur ordinateur, avec
>   carrousel du portfolio, un badge sur la photo et un cœur pour la sélection. Sous la photo :
>   l'alias, l'icône bleue « vérifié », le titre, les thématiques et le pays, le réseau principal et
>   sa tranche d'abonnés, puis « Proposé car » sur une ligne. Pas de carte géographique.
>   Points tranchés le 2026-11-23 :
>   - le dialogue « Filtres » est une exception à `04` §9 : une fenêtre est aussi permise pour un
>     ensemble de réglages appliqués d'un coup, avec une validation explicite. Cette exception
>     sera reportée dans `04` et `20` §11 ;
>   - le cœur se remplit de blanc, pas de vert, qui reste réservé à l'action principale ;
>   - quatre filtres rapides visibles (Thématique, Réseaux, Tranche d'audience, Audience
>     vérifiée), plus les critères actifs ; les autres critères passent dans « Filtres ».
> - Écran 3, profil créateur : **validé en version 2** (2026-11-23). La longue page unique est
>   remplacée par un assistant en 5 étapes, un sujet par étape : vous présenter, ligne éditoriale,
>   réseaux et chiffres, audience, offre et travail. Il affiche la progression en segments, le
>   temps restant et « Enregistrer et reprendre plus tard ». Chaque étape montre d'abord les champs
>   indispensables, le reste est replié sous « Facultatif, à compléter plus tard ». « Continuer »
>   n'est jamais bloquant : les manques ne bloquent que la publication. Suit l'écran « Vérifier et
>   publier » (récapitulatif, « Modifier »). Après la publication, « Mon profil » devient une liste
>   de tâches qui rouvre une étape à la fois. Réseaux : le compte principal porte une étoile jaune
>   (alias proposé `--color-network-primary` = `data-3`) ; un réseau complet porte un badge vert
>   « Complet » avec une courte animation ; un réseau ouvert est posé sur un fond surélevé.
>   Visuels du portfolio au format 4:3, comme les cartes de recherche. Cette version remplace la
>   collecte progressive de `03` §C pour le profil créateur ; l'écran 3 de l'inscription reste
>   une page regroupée par sujet (C12).
> - Écran 2 bis, profil anonyme (vue détaillée d'un créateur, ajoutée à la demande du fondateur) :
>   **validé** (2026-11-24). Sur le modèle de la fiche d'une annonce Airbnb : titre court, alias et
>   icône « vérifié », cœur « Ajouter à ma sélection » ; mosaïque du portfolio en 4:3 et galerie
>   plein écran (carrousel sur téléphone) ; résumé (thématique, région, langues, réseaux,
>   expérience) ; encadré des chiffres clés du réseau principal à la place d'une note ;
>   « Proposé car » en points forts ; détail des réseaux, de l'audience (barres de tranches), de la
>   ligne éditoriale et de l'offre ; encadré collant « Ma sélection privée » à la place de la
>   réservation (barre collante sur téléphone). La galerie plein écran s'écarte de `04` §9, comme
>   le dialogue « Filtres ». L'action de mise en relation du Lot 4 prendra place dans l'encadré.
> - Écran 5, décision d'une entrée de file : **validé** (2026-11-24). Hiérarchie de la version 1
>   conservée (dossier sans cadre, colonne de décision collante, confirmations dans la colonne,
>   raccourcis). Résumé de la marque refait en A + C :
>   - « À contrôler » : nom, logo, présentation, secteur, chacun face aux motifs de refus qu'il
>     peut appeler, formulés en questions ; longueur de la présentation et langue du compte en
>     repères, sans détection automatique ; secteur rapproché des thèmes recherchés ;
>   - puis « Ce qu'elle recherche », « Entreprise et conditions » (champs vides sur une ligne)
>     et « Compte » (interne) ;
>   - en cas de modification, badge « Modifié » et ancienne valeur barrée ;
>   - lien « Voir la page publique (version soumise) » dans un nouvel onglet.
> - Écran 5 bis, page publique de la marque : **validé** (2026-11-24). Structure du profil
>   anonyme adaptée :
>   - en-tête avec logo sur pastille claire, nom, badge « Marque vérifiée », secteur et pays ;
>   - « La marque en bref » ;
>   - « Ce qui vous concerne », des faits comparés au profil du créateur, jamais un score
>     (à confirmer avec `expert-matching`) ;
>   - présentation, campagnes ouvertes, ce qu'elle recherche, façon de travailler ;
>   - encadré collant « Campagnes ouvertes », sans contact direct ni montant.
>
>   Ouverte depuis l'écran 5, elle affiche la version soumise sous un bandeau. **Site web : retiré
>   de la vue des créateurs** (il permettrait un contact hors plateforme) ; les agents INFLUX
>   voient toutes les informations, site compris.
> - Écran 6, fiche de compte (backoffice, U07, U06, U42) : **validé** (2026-11-24). Choix :
>   - option B, en trois zones : un en-tête d'identité, une colonne principale (à traiter,
>     profil, campagnes ou réseaux, badges, activité en phrases) et une colonne de propriétés
>     de 22 rem, avec les gestes rares repliés ; elle défile avec la page, sans barre de défilement
>     propre ni position collante (demande du fondateur, 2026-11-24) ;
>   - sous 1 280 px, la page passe sur une colonne (option A) ;
>   - les onglets (option C) sont écartés ;
>   - actions de l'en-tête : « Lancer la vérification », « Créer un brouillon de campagne » (marque)
>     et le lien vers la page publique ;
>   - pour un créateur, le nom légal figure dans l'en-tête, marqué ▮, avec l'alias public.
>
>   À arbitrer : l'ordre des blocs face à `15` RG41 (`product-owner`) ; les appels non servis par
>   `apps/api` (campagnes d'un compte, entrées à traiter, activité lisible) avec l'`architecte`.
> - Écran 7, formulaire de campagne (marque) : **validé** (2026-11-24). Choix :
>   - option A : l'assistant de l'écran 3, sur les cinq étapes actuelles ;
>   - les champs obligatoires d'abord, le reste replié ; un badge « Public » par étape ; le budget
>     et la référence interne dans un encadré interne (D78) ;
>   - une seule action principale, « Continuer : <étape suivante> » ; le libellé final est
>     « Envoyer à INFLUX pour validation » ;
>   - « Vérifier et envoyer » : la carte du fil, le récapitulatif et un seul résumé des manques ;
>   - dates au format de la langue, ordre contrôlé ;
>   - le brouillon se prépare avant la publication du profil (D86).
>
>   Écarts au code, pour le `product-owner` :
>   - droits d'usage, exclusivité et délai de validation sont obligatoires (RG4), donc visibles
>     tout de suite à l'étape 2 ;
>   - le produit envoyé passe de l'étape 1 à l'étape 4 ;
>   - « Soumettre » n'est plus visible en permanence (RG4, C6).
> - Écran 8, fil et fiche de campagne (créateur, U14, U15, U46) : **validé** (2026-11-24).
>   Choix :
>   - fil en option A : une grille de cartes compactes, entièrement cliquables et sans bouton ;
>     l'échéance en délai, en deuxième ligne ; une ligne de filtres comme l'écran 2 ;
>   - fiche sur le modèle de l'écran 5 bis : l'essentiel, « Ce qui vous concerne » (sur la fiche
>     seule), le brief à 40 rem, ce qui est attendu, droits et conditions, la marque ;
>   - encadré collant sans bouton « Candidater » avant le Lot 4 (option b) : le délai restant, le
>     rôle du commercial et « Voir mon profil » ; l'état cible du Lot 4 est montré à part ;
>   - aucun montant (D78).
>
>   À arbitrer : les filtres du fil, non acceptés par l'API (`architecte`) ; « Ce qui vous
>   concerne » (`expert-matching`).
> - Écran 9, sélections (marque, U17, U64) : **validé** (2026-11-24). Choix :
>   - « Mes sélections » en lignes (vignettes, nom, campagne, nombre, date) ; création dans la
>     page, à la demande ;
>   - « Ma sélection » en option C : les cartes photo de l'écran 2 par défaut, un tableau de
>     comparaison (chiffres D61) ; cartes seules sur téléphone ;
>   - le nom et la campagne se modifient sur place ; la note privée est sous chaque carte ; la
>     suppression est repliée en bas de page ;
>   - « Et ensuite ? » : demander une sélection à l'équipe INFLUX avec cette sélection jointe,
>     déjà prévu par `10` RG61.1 à RG61.6 ;
>   - une sélection préparée par l'équipe, rangée dans la même liste avec le badge « Proposée par
>     INFLUX », n'existe pas dans la spécification : état cible, à spécifier (`product-owner`).
> - Écran 10, profil de marque (marque, U22, U23, U29, U03, U63, U59) : **validé** (2026-11-24).
>   Choix :
>   - assistant des écrans 3 et 7 en trois étapes (votre marque, ce que vous cherchez, votre
>     interlocuteur), puis « Vérifier et envoyer » avec l'aperçu de la page marque (écran 5 bis) ;
>   - un badge « Public » par étape ; l'interlocuteur dans l'encadré interne (D46) ; le site web
>     marqué « visible des agents INFLUX seulement » ;
>   - formats groupés par réseau coché (C5), listes triées dans la langue, « Choisir puis
>     ajouter » (C2) ; logo recommandé, sans bloquer l'envoi ;
>   - « Envoyer à INFLUX pour validation » ; après la publication, « Mon profil de marque » en
>     liste de tâches, dont le badge « Marque vérifiée » à demander (écran de demande non
>     prototypé, D34).
> - Écran 11, inscription et connexion (marque, créateur, U47, U48, U62, U25, U26, U63) :
>   **validé** (2026-11-24). Choix :
>   - colonne étroite, un sujet par écran ; le rôle dit une fois (« Inscription marque ·
>     Changer ») ; « Étape n sur 3 » seulement à l'inscription ;
>   - code en quatre blocs : destinataire, phrase de correspondance au-dessus (RG48), six cases sur
>     un seul champ, « Continuer mon inscription » ou « Me connecter » ; l'aide « Je ne reçois pas
>     le code » dépliée dans la page ;
>   - informations sur un seul écran en deux groupes, « Vous » et « Vos engagements » (C12), puis
>     la question facultative ; erreurs effacées à la saisie, un résumé des manques en liens ;
>   - plus d'écran « compte créé » : arrivée directe sur l'accueil de première visite (écran 1).
> - Écran 12, « Mes campagnes » (marque, U13, U64, U59) : **validé** (2026-11-24).
>   Choix :
>   - des lignes regroupées par action : « À faire » (à corriger avec le motif du commercial et
>     « Corriger », brouillons avec leurs manques), « En cours » (validation, publiée, en pause),
>     « Terminées » repliées ;
>   - chaque ligne est un lien ; « Créer une campagne » est la seule action verte ; « Voir ce que
>     voit un créateur » passe dans la fiche de la campagne ;
>   - marque neuve : brouillon possible avant la publication du profil (D86), notice et état vide ;
>   - pas de nombre de candidatures avant le Lot 4 ; fiche de campagne côté marque non prototypée.
> - Écran 13, recherche identifiée (backoffice, U06, U42) : **validé** (2026-11-24). Choix :
>   - cadre de vue identifiée sur toute la zone de travail (barre, chapeau écrit, symbole ▮,
>     `17b` §3.3, §4.9) ;
>   - exactement la forme de la recherche marque (écran 2, demande du fondateur) : ligne de
>     filtres, « Liée à » et « Tri », grille de cartes photo ; filtres internes à la suite (état du
>     profil, responsable) et, dans le dialogue, dans un encadré « jamais côté marque » (G1, G2,
>     G8 à G10 ; G3 à G7 au Lot 4) ;
>   - la carte ajoute nom réel ▮ en lien vers la fiche du compte (écran 6, U06), `@handle`, état et
>     responsable, chiffres exacts, « Ce que voit la marque » puis « Valeurs exactes » (RG77) ;
>     paire bloquée par photo atténuée et sa seule phrase ; ni export ni défilement infini ;
>   - état cible du Lot 4 à part : case ronde à la place du cœur (20 au plus, page affichée),
>     « Proposer à la campagne »,
>     profils non publiés écartés et nommés, motif obligatoire (RG74) ; pas de version téléphone
>     (D58).

## 1. Où sont les prototypes

- Dans le dépôt : `docs/audit-ux-ui/prototypes/`. Ouvrir `index.html` dans un navigateur.
  Chaque page `ecran-N-*.html` compare la capture de l'audit et le prototype ; chaque
  `proto-*.html` est le prototype seul (redimensionner la fenêtre pour le responsive).
- En ligne (privé, compte du fondateur) : https://claude.ai/artifact/EKEGnN3muC8RqpiFWYgskF
- `micro-interactions` : `interactions.html` (catalogue et démonstrations).

## 2. Les cinq écrans

| # | Écran | Profil | Constats principaux | Raison |
|---|---|---|---|---|
| 1 | Accueils marque et créateur | Annonceur, créateur | U01 (critique), U08, U59, U60, U61 | Page la plus vue ; seule composition partagée par les deux portes ; porte l'onboarding |
| 2 | Recherche de créateurs | Annonceur | U10, U11, U12, U64 | Cœur de la valeur marque ; cartes de 1 400 px |
| 3 | Profil créateur | Créateur | U02, U03 (critiques), U21, U28, U22, U30 | Formulaire le plus complexe ; cas le plus net de cartes imbriquées |
| 4 | Tableau de bord du backoffice | Commercial, admin | U05 (critique), U40, U38 | Première page de la journée ; aucune vue des 9 files |
| 5 | Décision d'une entrée de file | Commercial | U36, U37, U35, U06 (critique) | Geste le plus répété ; cadre repris par les files du Lot 5 |

Ajoutés à la demande du fondateur : 2 bis (profil anonyme), 5 bis (page de la marque), 6 (fiche
de compte, U07), 7 (formulaire de campagne), 8 (fil et fiche de campagne côté créateur),
9 (sélections), 10 (profil de marque), 11 (inscription et connexion), 12 (« Mes campagnes » côté marque), 13 (recherche identifiée, backoffice).

## 3. Formulaire complexe (écran 3)

Comparés : page unique (actuelle), assistant en sept étapes, collecte progressive. **Retenue :
collecte progressive** (accordéon sur téléphone, colonne de pilotage collante sur ordinateur,
« Publier » toujours atteignable, résumé d'erreurs unique, enregistrement automatique annoncé
seulement en cas d'échec, reprise à la première section incomplète). Raison : sept blocs
indépendants et un profil qui vit après la publication ; l'assistant reste le format de la
campagne. L'écran 3 de l'inscription est regroupé par sujet (C12), sans étape de plus.

## 4. Cartes imbriquées

Écran 3 (ligne réseau : de quatre niveaux de boîtes à une seule carte, sous-groupes en surtitre
et filet) et écran 5 (dossier sans cadre, une seule surface : la décision, panneaux en bloc
intérieur).

## 5. Construction

- `assets/tokens.css` généré depuis `packages/ui/src/styles/tokens.css` (bloc KEO) et
  `apps/backoffice/src/styles/tokens-backoffice.css` ; polices et icônes du dépôt.
- Tokens de `04` §1 déclarés à part comme « proposés » ; aucune couleur nouvelle.
- Aucune dépendance. Données fictives. Textes en français seulement.

## 6. Références

Seules les sources vérifiées de `02` sont citées (Polaris, Stripe, Linear, Intercom, Airtable,
Atlassian, HubSpot, NN/g, GOV.UK, WCAG, guide interne). Mobbin, les écrans de Page Flows et les
vidéos 1 à 5 n'ont pas pu être consultés : aucun choix ne s'appuie sur eux. Vidéo 6 : page
compagnon seule.

## 7. À valider

1. Écrans 2, 3 et 5 : validé, validé avec réserves, ou à revoir (1 et 4 validés le 2026-11-23).
2. C4 : badge de visibilité une fois par groupe (écart à la décision du 2026-11-06).
3. Carte de résultat compacte et titre-lien (`17` §7.1 ; `product-owner`, `expert-matching`).
4. Colonne de décision et ordre du dossier (`17b` §2.5 ; `product-owner`).
5. Textes de bienvenue et tâches « Bien démarrer » (`expert-marketing`, puis anglais).
6. Longueurs proposées : 40 rem, 13 rem, 8 rem, 22 rem (`expert-ux`).

Après validation : `04` intégré à `20` §11, décisions de la phase 0 de `05`, puis découpage en
jalons.
