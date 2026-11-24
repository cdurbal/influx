# 03 — Propositions UX

> Une proposition par problème de `01`, regroupées en huit chantiers. Effort : **S** < 1 jour,
> **M** de 1 à 3 jours, **L** > 3 jours, tests compris. Aucune proposition n'ajoute de
> fonctionnalité métier. Celles qui affichent une donnée spécifiée mais non encore servie
> (compteurs des files, campagnes d'un compte, adresse masquée) le signalent. Aucune nouvelle
> dépendance. Aucune couleur nouvelle : seulement des alias et des longueurs (`04` §1).

## A. Les primitives de composition, socle de tout le reste

Les causes communes de `01` §8 se traitent par une dizaine de composants partagés, qui n'existent
pas encore. Ils sont tous construits à partir des tokens actuels.

| Primitive | Rôle | Remplace | Constats |
|---|---|---|---|
| `Section` | Titre `h2` + intro + contenu, **sans conteneur**, séparée de la précédente par un filet `border-default` et un espacement | Les cartes qui ne servent que de conteneur | U18, U28, U37, U46 |
| `InnerPanel` (membres et backoffice) | Bloc intérieur à une carte : `surface-raised`, `radius-md`, sans bordure, rembourrage `p-3` (BO) ou `p-4` | Carte dans une carte, cadres à contour fort, cadres plus sombres que leur conteneur | U28, U37 |
| `EmptyState` · `StateMessage` | Icône `text-tertiary`, titre `text-title-section`, phrase, une action au plus (`20` §11.8). Variante « vide filtré » sans invitation à créer | Une vingtaine d'états en carte | U18 |
| `CardActions` | Groupe d'actions `flex-wrap`, pleine largeur sous `sm` seulement | Pilules étirées à 600 px | U45 |
| `Skeleton` | Hauteur finale par type (ligne, carte, champ), `aria-busy`, texte « Chargement… » masqué visuellement, balayage supprimé sous mouvement réduit | Phrases de chargement | U20 |
| `ErrorSummary` | Titre + liste de liens « Champ — raison » qui ouvrent la section ou l'étape puis focalisent le champ ; focus sur le résumé après une soumission refusée | Quatre comportements différents | U26 |
| `FieldMessage` | Message en ligne sous un champ, sans boîte : erreur (`CircleAlert`) ou « À vérifier : » (`TriangleAlert`) | Boîtes pleines par champ | U27 |
| `SaveStatus` (unique) | Statut visible ; annonce vocale réservée à l'échec et à la reprise | 3 copies qui annoncent à chaque pause | U31 |
| `PropertyList` | Libellés dans une colonne de largeur fixe (12 à 14 rem), valeurs juste à côté ; 2 colonnes de propriétés possibles dès `xl` | Grille 50/50 où valeur et libellé sont à 500 px l'un de l'autre | U36, U07 |
| `RowList` | Liste de lignes à lien étiré, séparées par `border-subtle`, colonnes dès `md` (le motif de la page-menu D74) | Listes de cartes hautes | U13, U17 |
| `Dialog` | `<dialog>` natif : `surface-raised`, `radius-card`, `shadow-lg`, voile, focus piégé, `Échap`, retour du focus | `ReauthForm` en carte dans un formulaire | U41 |
| `Announcer` | Une région `role="status"` par page pour les retours d'action | Changements de libellé muets | U12 |
| `ActivationChecklist` | Liste de 3 à 5 tâches d'activation avec jauge « 2 sur 4 » (texte + barre) ; chaque tâche ouvre l'écran et focalise le champ ; une tâche verrouillée dit ce qui la débloque ; la liste disparaît une fois terminée | La phrase des manques de la marque neuve, les cartes verrouillées, « Comment ça marche » passif | U59, U61 |

- **Effort** : M pour l'ensemble (chaque primitive est S), puis S par écran migré.
- **Impact** : il tient à la cohérence plus qu'aux écrans pris un par un, car chaque écran futur
  (Lots 4 et 5) en hérite.

## B. Accueils : dire quoi faire maintenant

### B1 · Accueil créateur orienté vers les campagnes (U01)
- **Situation** : chapeau « les campagnes arriveront ensuite », « Voir mon profil » en principal à
  vie, carte d'identité.
- **Solution** : une page « à faire / à voir », construite avec les données existantes. Tri
  « récentes » de l'API du fil, jamais « pour vous » (D11).
  ```
  Accueil                                                       h1
  Les campagnes ouvertes sont déjà consultables. Un profil complet aide
  votre commercial INFLUX à vous proposer aux marques.          chapeau
  À FAIRE  (absent si rien)                                     surtitre
  • Faites vérifier votre compte Instagram           Vérifier ›
  Dernières campagnes ouvertes              [◦ Voir toutes les campagnes]
  Atelier Sève · Routine éclat d'hiver · candidatures avant le 28 mars  ›
  (3 lignes au plus, en RowList)
  Mon profil · Profil 93JMS4 · Publié · 99 %            Voir mon profil ›
  Comment ça marche (avant la première publication seulement)
  ```
  Déconnexion : dans la page-menu « Compte » (G1), plus dans l'accueil. Avant la publication du
  profil, le bloc « À faire » est la checklist d'activation (B6), précédée de l'accueil de
  première visite (B5).
- **Alternative** : un seul lien « Voir les campagnes » sous la carte de profil, avec le chapeau
  corrigé (S).
- **Pour / contre** : redonne une raison de revenir. Microcopies FR et EN à valider (le texte de
  l'étape 2 doit retirer « vous postulez »).
- **Impact** : fort (créateurs, quotidien). **Effort** : M (S en variante minimale).

### B2 · Accueil marque centré sur les campagnes (U08, U46, U45)
- **Situation** : notice permanente, deux pilules vertes pleine largeur, « Comment ça marche » à
  vie, aucune campagne.
- **Solution** : filtrage par état, aucun classement côté front.
  ```
  Accueil                                                       h1
  À TRAITER  (absent si vide)                                   surtitre
  ⚠ « Coffret de fêtes » à corriger : le brief…         [■ Corriger]
  Mes campagnes                              [◦ Créer une campagne]  h2
  Routine éclat d'hiver · Publiée · modifiée le 22 nov.          ›
  Baume lèvres SPF 30 · En cours de validation                   ›
  Voir les 5 campagnes                                     lien texte
  Trouver des créateurs                                          h2
  Recherche par critères, profils anonymes.  [◦ Rechercher] · Demander une sélection
  ```
  Une seule pilule verte : « Corriger » s'il y a lieu, sinon « Créer une campagne ». État du
  profil en ligne de texte avec un badge, pas en notice. `h1` « Accueil » au lieu de « Espace
  marque ».
- **Alternative** : garder les cartes, une seule en principal, actions en `CardActions` (S).
- **Impact** : fort (marques, quotidien). **Effort** : M.

### B3 · Accueil du backoffice opérationnel (U40, U05)
- **Situation** : phrases, files incomplètes, alertes en boîtes répétées.
- **Solution** :
  ```
  Tableau de bord                          arrêté à 09 h 41 [Actualiser]
  À traiter maintenant : ⚑ 3 hors délai : Profils marque 1 · Vérifications 2   (liens)
  Files            En attente  Plus ancienne  Hors délai  Sans preneur
  Profils marque        6        9 h 55          1           5        ›
  … les 9 files, chiffres à droite, « ✓ vide » quand 0
  Alertes (20)  → regroupées par code : « AL21 · 12 refus pour débit dépassé · 12 comptes  ›»
  Inscriptions du jour · synchronisation (en dernier)
  ```
- **Alternative** : seulement remettre les files en tête et regrouper les alertes (S).
- **Pour / contre** : les compteurs des 9 files demandent un appel côté `apps/api` (spécifié,
  `17b` §1.2). « Mes verrous » demande une lecture `holder=me`.
- **Impact** : fort (première page de la journée). **Effort** : M.

### B4 · Compteurs dans le rail (U05)
- **Solution** : sous « Files », le total en chiffres tabulaires et « ⚑ 3 hors délai » écrit ;
  chaque sous-entrée porte son nombre, aligné à droite ; sous-entrées rangées sous trois surtitres
  de groupe non cliquables.
- **Dépendance** : le même appel de compteurs que B3. **Effort** : M (avec B3).

### B5 · Première arrivée : un accueil qui réaffirme la valeur (U60, U47)
- **Situation** : écran de succès générique, puis un accueil qui ne salue pas.
- **Solution** : après « Créer mon compte », arrivée directe sur l'accueil du rôle. Un bloc de
  première visite remplace l'écran de succès ; il s'efface quand la checklist est terminée.
  - **Marque.** FR : « Bienvenue sur INFLUX. Trouvez des créateurs crédibles pour vos campagnes :
    vous les découvrez sous forme de profils anonymes, et votre commercial INFLUX organise la mise
    en relation. » EN : « Welcome to INFLUX. Find credible creators for your campaigns: you
    discover them as anonymous profiles, and your INFLUX account manager arranges the
    introduction. »
  - **Créateur.** FR : « Bienvenue sur INFLUX. Découvrez les campagnes des marques ; votre
    commercial INFLUX vous propose à celles qui vous correspondent. » EN : « Welcome to INFLUX.
    Browse brand campaigns; your INFLUX account manager puts you forward to the ones that suit
    you. »
  - Juste dessous : la checklist d'activation (B6).
- **Contraintes** : aucun montant ni promesse de rémunération (D48, D78) ; pas de vidéo, pas de
  modale.
- **Alternative** : garder l'écran de succès en y mettant la phrase de valeur et la première tâche.
- **Impact** : première impression positive, au moment où l'élan est maximal. **Effort** : S.

### B6 · Checklist d'activation avec progression (U61)
- **Solution** : `ActivationChecklist` en tête des deux accueils tant que l'activation n'est pas
  faite, puis remplacée par « À traiter ». Exemple pour la marque :
  ```
  Bien démarrer · 1 sur 4                     ▓▓▓░░░░░░░░░
  ✓ Créer votre compte
  ○ Compléter votre profil : 10 informations      Secteur · Marchés · Réseaux… ›
  ○ Faire valider votre profil · examen par l'équipe INFLUX, délai de la file
  ○ Créer votre première campagne (brouillon possible dès maintenant, D86)
  🔒 Faire valider la campagne · après la validation du profil
  🔒 Rechercher des créateurs · après la validation du profil
  ```
  Pour le créateur : compléter le profil (manques par section, patron actuel), voir son profil
  comme une marque le voit (aperçu existant), publier, parcourir les campagnes ouvertes. Pour la
  marque, avec D86, « Créer votre première campagne » n'est plus verrouillée : seule « La faire
  valider » attend la publication du profil, et « Voir ce que voit un créateur » fait visualiser le
  résultat (guide `04.md`). L'ordre exact suit les exigences de publication (`07`, `08`, D79).
- **Principe** : c'est la « visite guidée » recommandée par le guide, **dans le flux** : chaque
  tâche ouvre l'écran voulu et place le focus sur le premier champ manquant, comme la liste des
  manques de la campagne. Aucun calque superposé.
- **Pour / contre** : unifie les deux espaces sur le bon modèle (celui du créateur) ; les tâches
  sont des actions qui existent déjà.
- **Impact** : direction claire et progression motivante pour la marque neuve. **Effort** : M.

### B7 · Prérequis de la marque neuve annoncés et expliqués (U59)
- **Dans les règles actuelles (S)** :
  - un message qui correspond au comportement : « Votre profil doit être publié avant de créer
    une campagne. Il reste 10 informations à compléter. [Compléter mon profil] » (une clé propre à
    la liste, au lieu de celle de la soumission) ;
  - le délai d'examen annoncé à la soumission du profil et dans la checklist : « Examiné par
    l'équipe INFLUX sous ⟨délai⟩ ». C'est 8 heures ouvrées dans la configuration actuelle de la
    file ; la valeur est lue dans cette configuration, jamais écrite en dur ;
  - les cartes verrouillées deviennent des tâches de la checklist, avec leur raison (B6).
- **Tranché par le fondateur le 2026-11-22 (D86, CA2-bis)** : la marque peut **créer un
  brouillon** de campagne avant la publication du profil, la **soumission** restant conditionnée.
  Seul le front bloquait la création ; l'API ne conditionne que la soumission. C'est
  l'application directe du principe « ne pas imposer de prérequis secondaires sur le chemin du
  but ».
  - Pour : la marque prépare sa campagne pendant l'examen de son profil.
  - Contre : des brouillons de marques qui ne publieront jamais ; critère CA2 à amender, et
    contrôle côté `apps/api` à aligner s'il existe.
- **Impact** : moins d'abandon de marques entre l'inscription et la première campagne.
  **Effort** : S, ou M avec l'évolution de règle.

## C. Formulaires et entrée

### Recommandation générale : le bon format pour chaque formulaire

| Formulaire | Verdict | Pourquoi |
|---|---|---|
| Inscription (porte → e-mail → code → détails) | **Garder le multi-étapes court actuel** ; alléger les écrans 1 et 2 (C11) | 4 à 6 champs utiles, déjà découpés ; le profil se complète ensuite |
| Profil marque (21 champs + logo) | **Collecte progressive**, accordéon à toutes les largeurs dès qu'un bloc est complet | Les blocs sont indépendants, la complétude est visible |
| Profil créateur (40 à 70 champs selon les réseaux) | ~~Collecte progressive + accordéon sur mobile (C3)~~ **Révisé le 2026-11-23 (fondateur, `07`) : assistant en 5 étapes, vérification, puis liste de tâches après publication** | Étapes par sujet, progression, reprise ; indispensable d'abord |
| Campagne (environ 40 champs, 8 conditionnels) | **Multi-étapes à navigation libre**, déjà juste : corriger la barre mobile (C6) et la lecture après publication (D8) | Dépendances entre champs, brouillon permanent |
| Compte, contestation, préférences | **Formulaire classique**, garder | 1 à 3 champs |

Règles communes :
- validation au départ du champ, uniquement pour un champ déjà signalé ;
- messages sous le champ ; un résumé d'erreurs unique ;
- enregistrement automatique annoncé seulement en cas d'échec ;
- une seule action principale visible, libellée par un verbe qui dit ce qui se passe ;
- **un sujet par écran ou, sur un écran court, un sujet par groupe titré** (guide d'onboarding) ;
- aucune action implicite, aucun changement silencieux (`04` §6 et §13).

### C1 · « Publier mon profil » dans la barre mobile (U02)
- **Solution** : sous `lg`, barre collante `[Enregistré à 14 h 07] · [■ Publier mon profil]`, comme
  celle du profil marque. Sur ordinateur, la carte d'action reste dans la colonne.
- **Alternative** : remonter le bloc d'action juste après la complétude, sous `lg` seulement.
- **Impact** : fort (fin de l'onboarding créateur). **Effort** : S.

### C2 · Choisir, puis ajouter (U03)
- **Solution** : `[Choisir un réseau… ▾] [◦ Ajouter]` ; même gabarit pour les listes de pays,
  langues et secteurs ; le focus revient au menu après l'ajout. Pour les 10 réseaux, une rangée de
  boutons « + Instagram », « + TikTok » est une variante plus directe.
- **Alternative** : une liste à filtrer accessible (`combobox`), effort L, utile seulement pour
  249 pays.
- **Impact** : fort (conformité WCAG 3.2.2 de niveau A, erreurs évitées). **Effort** : S.

### C3 · Profil créateur en accordéon sur mobile (U21)
- **Solution** : sous `lg`, chaque ligne du sommaire devient le bouton de sa section (« 3. Réseaux
  sociaux · À compléter ») ; une section ouverte à la fois, la première incomplète par défaut. On
  reprend le mécanisme du profil marque.
- **Impact** : la page passe d'environ 32 écrans à moins de 4 écrans par section ouverte.
  **Effort** : M.

### C4 · Étiquettes de couche : une fois par groupe, l'exception par champ (U22)
- **Solution** : badge complet en tête de section ; sur un champ, badge seulement si sa couche
  diffère de celle de la section (par exemple « Prénom », révélé à la mise en relation). Pour un
  groupe homogène masqué (ligne réseau), badge complet une fois, puis icône seule sur les champs,
  texte au survol et au focus.
- **Pour / contre** : bien plus calme ; s'écarte de la décision du 2026-11-06, **à valider par le
  fondateur**. **Effort** : S.

### C5 · Formats groupés par réseau (U23)
- **Solution** : comme dans le profil créateur : un intertitre par réseau, les groupes des réseaux
  cochés dépliés, « Autres réseaux (n cochés) » replié. Rien n'est décoché automatiquement.
- **Effort** : S.

### C6 · Campagne sur mobile : une seule action principale (U24)
- **Solution** : barre collante `[◦ Précédent] [■ Continuer : le travail attendu]`. À la dernière
  étape, ou quand plus rien ne manque, `[■ Soumettre ma campagne]`. Avant cela, « Soumettre »
  reste accessible en secondaire avec « Il manque 6 informations · Voir la liste ».
- **Pour / contre** : un seul principal par écran ; **à arbitrer avec RG4** (« toujours visible »)
  par le product-owner. **Effort** : M.

### C7 · Erreurs : effacer à la correction, un seul résumé, en ligne (U25, U26, U27)
- **Solution** :
  - modifier un champ retire son erreur (comme le font déjà les profils) ;
  - `ErrorSummary` partagé sur les quatre formulaires (patron de la campagne) ;
  - `FieldMessage` sans boîte sous le champ, préfixe écrit « À vérifier : » pour un avertissement.
- **Impact** : inscription moins anxiogène, formulaires moins hérissés. **Effort** : S (U25, U27)
  et M (U26).

### C8 · Une seule carte par niveau dans le profil créateur (U28)
- **Solution** : les sections 3 et 4 sans carte (titre `h2` + intro sur la page), chaque ligne
  réseau devient la carte. « Vos trois chiffres clés » et « Vérification » deviennent des
  sous-groupes sans contour : surtitre, filet `border-default`, `pt-4`.
- **Alternative** : garder la carte de section et passer la ligne réseau en `InnerPanel`.
- **Effort** : S.

### C9 · Zone interne lisible (U30)
- **Solution** : un encart « interne » commun : fond `surface-page`, contour **en tirets**
  `border-strong`, `radius-md`, en-tête avec l'icône `EyeOff` et le titre écrit « Visible
  uniquement par vous et l'équipe INFLUX », sans badge sur chaque champ. Même encart pour le budget
  de campagne. Forme et texte, jamais la couleur seule.
- **Un sujet à la fois** (guide d'onboarding) : dans le bloc 1 du profil créateur, les champs
  d'identité légale sont regroupés en fin de bloc, dans l'encart, au lieu d'être intercalés entre
  les champs publics.
- **Effort** : S.

### C10 · Corrections ponctuelles de formulaires

| Constat | Solution | Effort |
|---|---|---|
| U29 Listes triées par code | Tri par libellé dans la langue (`Intl.Collator`) ; secteurs réglementés regroupés en fin (`optgroup`) | S |
| U31 Statut annoncé à chaque pause | `SaveStatus` unique, annonce vocale pour l'échec seulement | S |
| U32 Droits d'usage | Une ligne par droit, trois choix : « Non proposé · Inclus · En option » ; mêmes données envoyées | S |
| U33 Changement d'adresse | Contrôle local (format, « identique à l'actuelle ») avant d'envoyer, `inputMode="email"` | S |
| U49 Titres écrasés | Titre de ligne en `CARD_TITLE` (16 px), `gap-6` avant le premier champ | S |
| U50 Nombres pleine largeur | Largeur bornée (token de longueur à créer), suffixe « % » visible, ligne « Total saisi : 85 % » | S |
| U51 Double saisie du nom | Nom en lecture dans « Mes informations », avec « Modifier dans mon profil » ; langue en boutons radio partout | S |
| U52 Dates | Date relue dans la langue de la page sous le champ ; `min` = la date précédente | S |
| U54 Microcopies | Liste de `01` U54, en FR et EN ensemble | S |

### C11 · Entrée plus directe (U47, U48, U53)
- **Solution** :
  - pas de compteur d'étapes sur `/connexion` ;
  - après « Créer mon compte », redirection vers l'accueil du rôle avec une notice « Votre compte
    est créé. Prochaine étape : votre profil. » ;
  - écran 1 : la pastille de rôle devient « Marque · Changer » et la carte de rappel disparaît ;
  - écran 2 : la notice se fond dans le paragraphe, formulaire hors carte ;
  - « Modifier l'adresse » sur sa propre ligne, avec une icône.
  - **À garder** : « Pas de mot de passe : nous vous envoyons un code à 6 chiffres. » Cette phrase
    corrige le modèle mental habituel (lien puis mot de passe) ; elle peut changer de place, pas
    disparaître.
- **Effort** : S.

### C12 · Écran 3 de l'inscription : un sujet par groupe (U62)
- **Solution** : sans retirer aucun champ (D15, D55, D63 préservés), deux groupes titrés
  (`fieldset` et `legend` en `CARD_TITLE`), puis la question facultative :
  ```
  Vous                                                legend
    Pays de résidence *          (+ notice « mises en relation pays par pays »)
    Langue de communication *    Français · English
    Vous vous inscrivez en tant que *   Particulier · Professionnel
  Vos engagements                                     legend
    ☐ Je certifie avoir 18 ans ou plus. *
    ☐ J'accepte les conditions générales d'utilisation. *   Lire les CGU
    ☐ J'accepte que mes coordonnées soient enregistrées… *
  ─────────────────────────────────────────
  Comment avez-vous connu INFLUX ? (facultatif)
  [■ Créer mon compte]
  ```
- **Alternative** : découper en deux écrans (« Vous », puis « Vos engagements »). Écartée pour
  l'instant : elle ajoute une étape pour 6 champs, ce que le verdict sur les formulaires déconseille.
  À reconsidérer si une mesure de l'abandon sur cet écran le justifie.
- **Effort** : S. **Non-régression** : `signup-nominal`, `journey-screens`, `journey-resume`,
  `landing-signup`.

### C13 · Libellés d'action qui disent ce qui se passe (U63)

| Actuel | Proposé (FR · EN) | Où |
|---|---|---|
| Valider (code, connexion) | Me connecter · Sign in | Écran du code, connexion |
| Valider (code, inscription) | Continuer · Continue | Écran du code, inscription |
| Valider (code de confirmation) | Confirmer que c'est moi · Confirm it's me | Compte, code frais |
| Soumettre mon profil | Faire valider mon profil · Send my profile for review | Profils marque et créateur |
| Soumettre ma campagne · Soumettre à la validation | Faire valider ma campagne · Send my campaign for review | Campagne |

- **Effort** : S (libellés FR et EN, specs qui ciblent les noms de boutons).

## D. Listes, recherche et fiches côté membres

### D1 · Carte de résultat compacte (U10)
- **Situation** : plus de 1 400 px par carte : bio intégrale, 7 propriétés empilées, métriques
  verticales.
- **Solution** : environ 360 px, 2 ou 3 cartes par ligne dès `xl`.
  ```
  ┌─────────────────────────────────────────────────────────────┐
  │ [visuel 4:5, 96 px]  Profil 93JMS4                           │
  │                      Cuisine végétale de saison…   (titre)   │
  │                      Cuisine · Famille · Bien-être · FR NL   │
  │ Instagram · principal                  ✓ Audience vérifiée   │
  │ COMMUNAUTÉ 10–50 k   RYTHME plusieurs/sem.   COMMENT. 50–199 │
  │ TikTok …                                                      │
  │ ┌ Proposé car : thématique Cuisine · audience en Belgique ┐  │
  │ [◦ Ajouter à ma sélection]                 Voir le profil ›  │
  └─────────────────────────────────────────────────────────────┘
  ```
  Bio sur 2 lignes (`line-clamp`) ; les propriétés complètes restent sur le profil anonyme.
  Seul « Proposé car » garde la surface surélevée.
- **Alternative** : vue « liste » dense en plus de la vue cartes, pour comparer (L, à arbitrer).
- **Pour / contre** : comparaison possible à l'écran ; règle 9 de `17` §7.1 respectée (les
  métriques D61 ouvrent la ligne). **À valider avec `expert-matching`**, la carte étant spécifiée.
- **Impact** : fort (cœur du produit marque). **Effort** : M.

### D2 · Recherche sur téléphone (U11)
- **Solution** : `gap-4` sous `lg` ; phrase d'explication dans le panneau des filtres ; « Mes
  sélections » et « Demander une sélection » dans la barre collante « Ma sélection ».
- **Effort** : S.

### D3 · Retour après action (U12)
- **Solution** : `Announcer` : « Profil 7K3M ajouté à "Ma sélection" (3 créateurs). » Le bouton
  passe à l'état « Ajouté ✓ ». Dès `lg`, une ligne « Ma sélection privée (3) · Voir » près de la
  tranche. Après « Voir la suite », le focus va au titre de la première carte ajoutée.
- **Effort** : S.

### D4 · « Mes campagnes » en lignes (U13)
- **Solution** :
  ```
  Mes campagnes                                       [■ Créer une campagne]
  Titre                               État                    Modifiée le
  Collection solaire 2027             Brouillon               22 nov.     ›
  Coffret de fêtes                    ⚠ À corriger            22 nov.     ›
    └ Votre brief ne permet pas à un créateur de comprendre… (notice sous la ligne)
  Routine éclat d'hiver               Publiée                 22 nov.     ›
  ```
  `RowList`, titre en lien étiré, « Voir ce que voit un créateur » dans la fiche. Une seule pilule
  verte.
- **Impact** : 5 campagnes tiennent en environ 350 px au lieu d'environ 1 300 px. **Effort** : M.

### D5 · Fil créateur : la carte est le lien (U14)
- **Solution** : carte cliquable de la charte (contour `border-strong`, soulèvement au survol,
  lien étiré sur le titre), sans pilule. Ordre :
  1. marque (`text-sm`, logo, badge sur sa propre ligne) ;
  2. titre `h2` ;
  3. « Candidatures avant le 28 mars », en `text-primary` avec une icône horloge ;
  4. thématiques, livrables, période.
- **Alternative** : garder un bouton secondaire `self-start` (S).
- **Effort** : M.

### D6 · Fiche de campagne lisible (U15, U46)
- **Solution** :
  - dès `lg`, contenu sur 8 colonnes (environ 70 caractères) et colonne collante « La marque »
    (logo sur pastille, nom, badge vérifié, faits), avec les encarts obligatoires ;
  - sous `lg`, la marque en tête ;
  - côté créateur, à la place de l'impasse : « La candidature n'est pas encore ouverte dans
    INFLUX. D'ici là, votre profil est ce que regarde un commercial INFLUX… », et « Compléter mon
    profil » si le profil est incomplet.
- **Effort** : M.

### D7 · Sélections : consulter d'abord (U17)
- **Solution** :
  - `h1` = nom de la sélection, ligne « Rattachée à : … », action « Renommer ou rattacher »
    (`details` natif contenant le formulaire) ;
  - les créateurs en cartes compactes (D1), la note privée repliée ;
  - « Supprimer la sélection » en bouton texte de danger en pied ;
  - liste des sélections en `RowList` ;
  - prochaine étape : « Demander une sélection à l'équipe INFLUX ».
- **Effort** : M.

### D8 · Campagne publiée : lecture plutôt que formulaire inerte (U19)
- **Solution** : état non modifiable → rendu de lecture (`CampaignReadBody`) + cycle de vie en
  colonne ; le formulaire seulement pour un brouillon ou une campagne « à corriger ».
- **Effort** : M.

### D9 · Corrections ponctuelles des membres

| Constat | Solution | Effort |
|---|---|---|
| U16 Logos | Alias `--color-logo-plate` = `surface-inverse` (prévu dans `20` §10), `p-1 rounded-md`, aux trois emplacements | S |
| U18 États | `EmptyState` et `StateMessage` partout, attributs `data-state` conservés | S |
| U20 Chargements | `Skeleton` à la hauteur finale ; boîte de visuel à ratio fixe | M |
| U34 Onglets verts | Onglets segmentés de la charte (piste `surface-raised`, actif `surface-active`) | S |
| U55 Second `<nav>` | `div role="group" aria-label` | S |

## E. Backoffice : traiter une entrée

### E1 · Écran de décision en deux colonnes (U36)
- **Solution** (dès `lg`) :
  ```
  Files › Profils marque à valider › Terre & Thé ▮
  Première soumission · échéance 08:53 · ⚑ hors délai 49 min · pris à 09:41
                                  [Rendre la main ‹l›] [Fiche du compte ▮]
  ┌ dossier ─────────────────────────────┐ ┌ décision (collante) ────────┐
  │ ⚠ Alertes (si non vides)             │ │ Commentaire interne         │
  │ Ce qui a changé : validé | proposé   │ │ [■ Publier ‹v›] [Refuser ‹r›]│
  │ ── La marque (PropertyList)          │ │ ── panneau du motif ici ──  │
  │ ── Logos ── Interlocuteur ▮          │ │ [■ Confirmer ↵] [Annuler]   │
  └──────────────────────────────────────┘ └─────────────────────────────┘
  ```
  - Un seul cadre partagé par les 9 files, au lieu de trois copies.
  - Ordre « Confirmer, puis Annuler » partout.
  - Focus sur le bouton de confirmation ; `Ctrl` + `Entrée` depuis une zone de texte.
  - Statut de délai dit une seule fois.
- **Alternative** : une seule colonne, alertes et différences en tête, lien « Aller à la décision »
  (S).
- **Pour / contre** : l'ordre ① → ⑤ de `17b` §2.5 change, **arbitrage `product-owner`**. Le jeton
  de longueur `--spacing-bo-panel-w` est déjà nommé dans `17b` §1.7.
- **Impact** : fort (chaque entrée, chaque jour). **Effort** : M.

### E2 · Rendre la main en revenant à la file (U35)
- **Solution** : en mode décision, « Rendre la main et revenir à la file » (confirmation si un
  brouillon existe) ; la file 1 rejoint le cadre commun (E1).
- **Effort** : S.

### E3 · Une surface par écran, des blocs intérieurs (U37)
- **Solution** :
  - panneaux ouverts dans une carte → `InnerPanel` (`DecisionPanel`, sélecteurs de motif,
    réexamen, retrait, rejeu) ;
  - `DenseTableRegion` en mode sans cadre ;
  - listes autonomes (invitations, comptes internes, sources) posées sur la page sous un `h2` ;
  - compteurs de file en ligne d'en-tête ;
  - aide des raccourcis en dialogue `?`.
- **Effort** : M.

### E4 · Tableaux vraiment denses (U38, U56)
- **Solution** :
  - le nom identifiant (marque, alias, titre) devient le lien de la ligne ; la colonne « Ouvrir »
    disparaît, `j`, `k` et `Entrée` sont conservés ;
  - cellules courtes en `whitespace-nowrap` ; « dans 2 h 56 » en clair, l'échéance exacte en
    second plan ;
  - Brevo et Apollo fusionnés en une colonne « Synchro » avec icône et mot ;
  - chiffres à droite (`tabular-nums`) ; « Page 1/2 » ;
  - champs de filtre à `spacing-bo-row-h` ; période en puce « Période : toutes ▾ ».
- **Impact** : retour à des lignes de 36 à 44 px, deux fois plus d'entrées visibles. **Effort** :
  S à M.

### E5 · Repères et clavier (U44)
- **Solution**, par ordre de rendement :
  1. fil d'Ariane (`text-sm`, `text-secondary`), qui remplace les liens de retour ;
  2. « `g` puis n » sur les entrées du rail ;
  3. dialogue `?` partagé ;
  4. `⌘K` (plus tard).
- **Effort** : S pour 1 et 2, M pour 3, L pour 4.

### E6 · Fenêtre étroite sans effet de bord (U43)
- **Solution** : ne pas monter la page sous `bo-small`, ou différer la prise en charge jusqu'à un
  geste explicite. Une exception à « aucune détection de largeur en JavaScript » (`02` §21.5) est
  **à arbitrer par `architecte`**.
- **Effort** : M.

## F. Backoffice : comptes

### F1 · Fiche de compte en trois zones (U07)
- **Solution** :
  ```
  Comptes › Inscrits › Atelier Sève ▮        [Lancer la vérification] [Créer une campagne]
  Marque · Belgique · français · actif · inscrite le 22/11/2026 · responsable : aucun
  ┌ principal ───────────────────────────┐ ┌ propriétés (18 rem) ──────────┐
  │ Profil : publié · 89 % · 0 décision  │ │ E-mail · délivrabilité        │
  │ ── Campagnes (n) : tableau dense     │ │ Consentement · source         │
  │ ── Badges : tableau                  │ │ ── Synchro Brevo ✓ Apollo ⚠   │
  │ ── Activité : en mots, auteur nommé, │ │ ── Interlocuteur ▮            │
  │    lectures regroupées               │ │ [Corriger…] → panneau         │
  └──────────────────────────────────────┘ │ ── Données perso, admin (repliés)│
                                           └───────────────────────────────┘
  ```
  Sections séparées par des filets ; chaque type d'événement traduit en mots.
- **Alternative** : une colonne, avec en-tête d'identité, formulaires repliés et activité remontée
  (S à M) : à faire d'abord.
- **Pour / contre** : l'ordre s'écarte de `15` RG41 (**`product-owner`**). La liste des campagnes
  d'un compte est spécifiée (`17b` §3.5) mais n'est pas servie par `apps/api`.
- **Impact** : fort. **Effort** : L (S à M en variante).

### F2 · Chemins entre files, fiches et recherche (U06)
- **Solution** :
  - lien « Fiche du compte ▮ » sur la ligne de tête de chaque décision ;
  - nom réel en lien vers la fiche dans la recherche identifiée ;
  - bloc « Campagnes (n) » de la fiche marque (F1) ;
  - le symbole ▮ annonce, avant le clic, une lecture journalisée.
- **Effort** : S pour les liens, M avec la liste des campagnes.

### F3 · Inscrits identifiables (U39)
- **Solution** :
  - première colonne « Inscrit » : nom de la marque ou alias, plus `c***@domaine` en
    `text-secondary`, en lien ;
  - filtres sur une ligne (vue, rôle, pays) et « Plus de filtres » repliable.
- **Pour / contre** : l'API doit servir un nom et une adresse masquée (`17b` §3.11) ; **avis
  `product-owner` et `expert-conformite-rgpd`**. Diminue les lectures privilégiées.
- **Effort** : M.

### F4 · Confirmation d'identité en dialogue (U41)
- **Solution** : `ReauthForm` dans `Dialog`, rendu hors du formulaire de l'action ; retour du focus
  au bouton d'origine. Ajouter le test e2e « levée de désinscription avec confirmation » pour
  confirmer ou écarter le double envoi.
- **Alternative** : rendre la confirmation après `</form>`, sans dialogue (S).
- **Effort** : S.

### F5 · Vue identifiée sur la fiche créateur (U42) et finitions (U57)
- **Solution** : envelopper la colonne principale de la fiche créateur dans le cadre de vue
  identifiée existant. Corriger le compte à rebours (annonces à 60, 30, 10 et 0 s), les titres
  imbriqués, la bande (« Prénom N. · commercial ») et le vocabulaire.
- **Effort** : S.

## G. Navigation et cadre

### G1 · Déconnexion visible partout (U04)
- **Solution** : sous la liste de la page-menu « Compte », en `lg:hidden` : « Connecté avec … »
  puis `[◦ Se déconnecter]`, au même endroit pour les deux rôles. Clés de traduction existantes.
- **Effort** : S.

### G2 · Un seul cadre de page (U09)
- **Solution** : `container-max` partout ; pages courtes et pages de lecture sur 8 colonnes,
  **alignées à gauche** (`max-w-(--container-narrow)` sans `mx-auto`) ; en-tête et carte du profil
  anonyme sur la même colonne.
- **Effort** : S.

### G4 · Espacement décroissant de l'extérieur vers l'intérieur (U64, U65)
- **Situation** : cartes de liste séparées de 16 px mais rembourrées de 24 à 32 px ; icônes de
  badge à 4 px de leur libellé.
- **Solution** (guide `02.md`, échelle de `04` §3) :
  - cartes **compactes** (résultat, campagne du fil, ligne réseau, état) à 16 px de rembourrage
    (`p-4`) ; `spacing-inset-card` réservé aux cartes uniques et larges (formulaire de section,
    panneau de décision) ;
  - écart entre cartes d'une liste à 16 px sur téléphone et 24 px dès `md` (`spacing-grid-gap`,
    déjà décroissant) ;
  - titre de section → contenu à 24 px ;
  - icône → libellé à 8 px (`gap-2`) dans les badges et les pastilles.
- **Alternative** : baisser la valeur de `spacing-inset-card` pour tous ; écartée, car les grandes
  cartes de formulaire y perdraient de l'air.
- **Effort** : S, porté par les primitives (`Card` à variante compacte, badges).

### G3 · Sommaire du profil (U58)
- **Solution** : « Ce que voit une marque » en lien texte avec une icône sous le sommaire, ou
  bouton sur la largeur de la colonne.
- **Effort** : S.

## H. Micro-interactions à intégrer

Le détail (durées, propriétés, états) est dans `04` §12. Par ordre d'utilité :

1. **Retours d'action annoncés** : ajout à une sélection, enregistrement, décision prise
   (`Announcer` + changement d'état du bouton). Effort S.
2. **Squelettes** aux hauteurs finales, avec balayage sous `motion-safe:` seulement. Effort M.
3. **Dialogue** natif avec fondu et légère montée à l'ouverture (200 ms), fermeture plus courte
   (120 ms). Effort S.
4. **Accordéon et `details`** : chevron en rotation (déjà présent), contenu en fondu. Effort S.
5. **Ligne de file** : survol et focus déjà définis ; ajout d'un bref fond à l'entrée suivante
   après une décision. Effort S.
6. **Barre collante mobile** : apparition par glissement vers le haut (200 ms) quand elle change
   de contenu. Effort S.
7. **Mise à jour d'un compteur** (sélection, files) : le chiffre change sans animation de
   défilement ; seul un bref fond signale le changement, et l'annonce vocale est portée par la
   région de statut. Effort S.

8. **Position collante** (guide `03.md`) là où elle oriente : colonne de décision du backoffice,
   colonne « La marque » de la fiche de campagne, jauge de la checklist d'activation sur
   ordinateur. Effort S, inclus dans E1, D6 et B6.

**Écartées** (guide `03.md`) : apparition au défilement, suivi du défilement, défilement simulé
(Lenis, Locomotive), découpage du texte. Elles retardent la lecture ou cassent l'accessibilité
(`01` §11.2) ; seule la vitrine pourrait en user, dans la limite de D59.

Aucune bibliothèque : CSS (`transition`, `@starting-style`, variante `starting:` de Tailwind v4),
jetons de durée existants, `prefers-reduced-motion` déjà câblé. Motion ou Framer Motion
n'apporteraient rien que le CSS ne fasse ici, et ajouteraient du JavaScript client sur des écrans
qui n'en ont pas besoin.
