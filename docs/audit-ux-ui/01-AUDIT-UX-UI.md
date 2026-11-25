# 01 — Audit UX/UI d'INFLUX

> Espaces marque et créateur (`apps/web`) et backoffice (`apps/backoffice`), état de `main` au
> 2026-11-22 (`eac3cec`, Lots 1 à 3 clos). Audit seul : **aucun code, CSS ni composant n'a été
> modifié**. Suite : `02` benchmark, `03` propositions, `04` direction artistique, `05` plan,
> `06` matrice.
>
> **Statut : recommandations validées par le fondateur le 2026-11-22** (documents `01` à `06`).
> Aucune réalisation n'est planifiée à ce jour : le découpage en jalons reste à décider.

## 0. En bref

- **Le socle est bon.** La charte KEO, les tokens, l'accessibilité de base (focus, lien
  d'évitement, un seul `<nav>`, `prefers-reduced-motion`) et les règles métier (anonymat, aucun
  montant côté créateur) sont solides et cohérents. Le problème n'est pas le style.
- **Le problème est la composition.** La carte sert de conteneur par défaut. Une carte sur fond
  noir est presque invisible (contraste de 1,07:1), c'est son filet qui la dessine : chaque carte
  ajoute un cadre. On compte 12 cas de carte dans une carte de même apparence au backoffice, et
  jusqu'à 4 niveaux de boîtes dans le profil créateur.
- **Les pages sont trop longues.** Le profil créateur complet mesure 20 294 px sur ordinateur
  (22 écrans) et 26 735 px sur téléphone (32 écrans). La recherche de créateurs dépasse 18 000 px
  pour une douzaine de profils, car chaque carte de résultat fait plus de 1 400 px.
- **Les actions principales se multiplient.** Deux pilules vertes pleine largeur sur l'accueil
  marque, une par carte dans le fil créateur, trois à la fois dans la campagne sur téléphone.
- **Les accueils n'aident pas à agir.** L'accueil créateur annonce les campagnes « à venir »
  alors que le fil existe. L'accueil marque ne montre aucune campagne. L'accueil du backoffice
  aligne des phrases et une vingtaine d'alertes, dont la même répétée douze fois.
- **Le backoffice manque de vue d'ensemble et de chemins.** Aucun compteur sur les neuf files.
  Pas de lien d'une décision vers la fiche du compte. Une fiche de compte sans identité en
  en-tête, faite de 12 à 14 cartes de même poids.
- **Face au guide d'onboarding (§10), l'entrée est sobre mais la première arrivée est froide.**
  Il n'y a pas d'accueil qui rappelle la valeur, ni de checklist d'activation côté marque. La
  marque neuve est arrêtée par des prérequis qu'on ne lui annonce qu'au moment où ils bloquent :
  elle ne peut ni rechercher, ni même commencer une campagne avant la validation de son profil.

## 1. Méthode et limites

| Source | Contenu |
|---|---|
| Code | Lecture de `apps/web`, `apps/backoffice`, `packages/ui` (tokens), confrontée à `17`, `17b`, `20` §11. Trois audits par périmètre (formulaires et entrée, écrans quotidiens des membres, backoffice) et une analyse transverse (tokens, primitives, mouvement) |
| Rendu | **95 écrans capturés** en 1440 × 900 et 390 × 844, pleine page (60 écrans membres, 35 écrans du backoffice), sur la pile Supabase locale. Données synthétiques réalistes : marque au profil complet, marque neuve, 12 créateurs avec visuels et badges, 5 campagnes dans 5 états, sélections, demande de sélection, files du backoffice alimentées. Une sélection est jointe dans `captures/` |
| Références | Benchmark de produits SaaS, de plateformes d'influence et de principes sourcés (`02`) |
| Guide interne | Quatre fiches de `docs/good-practice-ux/` : onboarding (`01.md`, §10), espacement en grille de 8 px (`02.md`), techniques d'animation web (`03.md`), recommandation stratégique d'onboarding (`04.md`) ; les trois dernières au §11 |

**Conventions.** `web:` = `apps/web/src/components/`, `bo:` = `apps/backoffice/src/components/`.
« Vu » = constaté sur capture ; sinon, constaté dans le code.

**Gravité.**
- **Critique** : bloque ou égare une tâche principale, contredit le produit, ou constitue un défaut
  de sécurité ou d'accessibilité de niveau A.
- **Important** : ralentit, brouille ou contrevient à la charte sur un écran fréquent.
- **Cosmétique** : finition.

**Limites.**
- Ni test utilisateur, ni mesure d'usage : les fréquences sont estimées d'après les parcours de `17`
  et `17b`.
- Données synthétiques : certains cas n'ont pas été rendus (par exemple un logo noir sur fond
  transparent).
- Sous 768 px, le backoffice affiche par conception l'écran « poste de travail » (F7). Il n'a pas
  été audité au-delà.
- Sur les captures mobiles pleine page, les barres collantes apparaissent au milieu de la page :
  c'est un artefact de capture, pas un défaut.
- Mobbin, Page Flows et les vidéos fournies n'ont été que partiellement accessibles (`02` §0).
- Les écrans des Lots 4 et 5 (messagerie, mises en relation, pipeline) n'existent pas : seule leur
  place dans la composition actuelle est discutée.

## 2. Mesures

| Écran (données de la capture) | Desktop 1440 | Mobile 390 | En hauteurs d'écran |
|---|---|---|---|
| Profil créateur complet, 2 réseaux | 20 294 px | 26 735 px | 22,5 / 31,7 |
| Profil créateur neuf | 7 622 px | 9 466 px | 8,5 / 11,2 |
| Profil marque complet (accordéon sous `lg` seulement) | 8 091 px | 4 166 px | 9,0 / 4,9 |
| Recherche de créateurs (« environ 10 à 24 profils ») | ≥ 18 000 px | 32 624 px | ≥ 20 / 38,7 |
| Détail d'une sélection | 8 850 px | 14 723 px | 9,8 / 17,4 |
| Campagne, étape 1 (brouillon) | 3 235 px | 4 149 px | 3,6 / 4,9 |
| Backoffice : fiche d'inscrit (marque) | 3 358 px | — | 3,7 |
| Backoffice : accueil | 2 444 px | — | 2,7 |

## 3. Cartographie

| Espace | Construit (Lots 1 à 3) | Spécifié, non construit |
|---|---|---|
| Entrée | Choix de la porte, e-mail, code, détails (marque, créateur), connexion, CGU à ré-accepter | Bouton « Réessayer » en panne d'envoi ; CGU en panneau latéral (construit en dialogue) |
| Marque | Accueil, profil (+ marque vérifiée), campagnes (liste, formulaire en 5 étapes, aperçu, cycle de vie), recherche anonymisée, profil anonyme, sélections, demande de sélection, compte (informations, préférences, données, sessions) | Blocs « Ce qui attend votre réponse » de l'accueil (`17` §4.1) ; « Ce que voit un créateur de mon profil » ; mises en relation, conversation, documents (Lot 4) |
| Créateur | Accueil, profil (7 blocs), aperçu, vérifications (propriété, audience, contestation), fil des campagnes, fiche de campagne, compte | Blocs « À faire » et « Campagnes » de l'accueil (`17` §5.1) ; candidature et « Mes candidatures » (Lot 4) ; aide (`/aide`) |
| Backoffice | Connexion, activation, accueil (partiel), 9 files (liste, décision), inscrits, fiche de compte, fiche campagne, invitations, recherche identifiée, comptes internes, double validation, réglages, santé technique | Catalogue `/files`, fil d'Ariane, raccourcis « `g` puis n », `⌘K`, files 8 et 10 à 16, affaires, conversation, proposition, e-mails, vue téléphone D58 (Lots 4 et 5) |

## 4. Constats critiques

| ID | Écran · profil | Constat | Conséquence | Preuve |
|---|---|---|---|---|
| U01 | Accueil `/createur` · créateur | L'accueil annonce que « les campagnes et vos candidatures arriveront ensuite », alors que le fil existe ; aucun lien vers le fil. « Vous postulez aux campagnes » alors que la candidature n'est pas ouverte. Profil complet : « Voir mon profil » reste l'action principale, en double (colonne et carte). Une carte d'identité porte une notice et un « Me déconnecter » pleine largeur. **Vu** | Le créateur croit qu'il n'y a rien à voir et ne revient pas : la seule raison de revenir est cachée | `apps/web/src/locales/fr/auth.json:248-252`, `web:auth/MemberHome.tsx:57-91`, `web:creator-profile/CreatorHomeCard.tsx:81-83` · [m02](captures/m02-accueil-createur.jpg) |
| U02 | Profil `/compte/profil` · créateur, téléphone | Sous `lg`, l'ordre du document place « Publier mon profil » **après les 7 sections**, portfolio compris. La barre collante ne contient que « Enregistrement automatique ». **Vu** | Le geste qui conclut l'onboarding créateur est invisible sur des dizaines d'écrans | `web:creator-profile/creator-publication-view.ts:110-117`, `CreatorProfileScreen.tsx:346-348` · [m09](captures/m09-profil-createur-mobile.jpg) |
| U03 | Profils, campagne · marque, créateur, clavier | Une liste déroulante agit dès qu'elle change. Au clavier, la première flèche **crée une ligne réseau côté API** ou ajoute un pays, une langue, un secteur | Ajouts involontaires, retrait en deux gestes. Échec de WCAG 3.2.2 (niveau A) | `web:creator-profile/CreatorNetworksFields.tsx:179-188`, `web:member/ui/PickListField.tsx:90-94` |
| U04 | `/marque`, `/compte` · marque, téléphone et tablette | Sous 1 024 px, la déconnexion n'existe pas pour une marque : le pied de colonne est masqué et la page-menu « Compte » ne la propose pas. Le créateur l'a dans une carte de son accueil | Session laissée ouverte sur un appareil partagé ; contraire à `17` §2.3 (« jamais dans un menu caché ») | `web:member/shell-classes.ts:134-137`, `web:account/AccountHub.tsx:50-78` |
| U05 | Rail et accueil · commercial | Aucun compteur dans le rail, contrairement à `17b` §1.2. « Files » ouvre la première file au lieu du catalogue. L'accueil résume **5 files sur 9** : profils créateur, visuels, campagnes et sélections par l'équipe en sont absents. **Vu** | Pour savoir s'il a du travail, le commercial ouvre neuf listes ; un hors délai sur une campagne reste invisible | `bo:QueueSummary.tsx:66-72`, `bo:bo-nav.ts:163-166` · [b01](captures/b01-accueil.jpg) |
| U06 | Décisions, recherche identifiée, fiche campagne · commercial | Une décision ne mène pas à la fiche du compte. Un résultat de la recherche identifiée ne mène pas à la fiche du créateur. La fiche campagne n'est atteignable que depuis le message de succès de sa création. « Trouver une campagne par sa marque » tourne en boucle | Le pont « campagne → créateurs compatibles », départ de la proposition INFLUX (`10` RG73), ne fonctionne que depuis la file 9 | `bo:IdentifiedResults.tsx` (aucun `Link`), `bo:AccountCampaignsBlock.tsx:139`, `bo:identified-search-view.ts:41` |
| U07 | Fiche `/inscrits/[id]` · commercial, admin | `h1` générique « Fiche d'inscrit », sans nom ni rôle. 12 à 14 cartes de même poids, dans l'ordre suivant : identité (l'e-mail en tête), contact, profil, création de campagne, réseaux, tarifs (une phrase), portfolio, badges, vérification, synchronisation, formulaire « Corriger » toujours ouvert, données personnelles, administration, puis historique en codes techniques. Le bloc « Campagnes » n'est qu'un formulaire de création. **Vu** | « À qui ai-je affaire ? » exige de lire l'e-mail et de défiler ; les gestes rares pèsent autant que l'essentiel | `bo:AccountScreen.tsx:705-826`, `:599-604` · [b05](captures/b05-fiche-inscrit.jpg) |

## 5. Constats importants — espaces membres

| ID | Écran · profil | Constat | Conséquence | Preuve |
|---|---|---|---|---|
| U08 | Accueil `/marque` · marque | Profil publié : une notice de succès permanente, deux cartes génériques à **pilule verte pleine largeur** chacune, « Comment ça marche » à vie. Aucune campagne, aucun « À corriger ». Le `h1` « Espace marque » répète la pastille de rôle. **Vu** | Il faut ouvrir « Campagnes » pour apprendre qu'une campagne est refusée ; deux actions principales concurrentes | `web:brand-profile/BrandHome.tsx:46-82`, `ProfileStateNotice.tsx:47-63` · [m01](captures/m01-accueil-marque.jpg) |
| U09 | Toutes les pages · tous | Deux cadres coexistent : une colonne étroite centrée (accueils, « Mes campagnes », compte) et une colonne large (recherche, fiches, profil). À 1440 px, le `h1` saute d'environ 200 px d'une page à l'autre. **Vu** | L'œil cherche le titre à chaque clic ; le profil anonyme paraît cassé | `web:auth/auth-classes.ts:28-31`, `web:brand-profile/brand-profile-classes.ts:9-12` · [m01](captures/m01-accueil-marque.jpg) contre [m04](captures/m04-recherche-createurs.jpg) |
| U10 | Recherche `/createurs`, sélections · marque | Chaque carte de résultat dépasse **1 400 px** : visuel, bio intégrale, 7 couples libellé/valeur empilés, puis un bloc par réseau aux métriques empilées. Les réseaux ont le même traitement que « Proposé car ». **Vu** | Comparer 12 profils oblige à faire défiler plus de 20 écrans ; la preuve INFLUX se noie | `web:creator-profile/CreatorCardView.tsx:104-153`, `web:creator-search/creator-search-classes.ts:86-89` · [m04](captures/m04-recherche-createurs.jpg) |
| U11 | Recherche, téléphone · marque | Avant le premier résultat : `h1`, bouton pleine largeur, lien, phrase, filtres, tranche et critères, espacés de 32 px, soit environ 540 px à 375 × 667 | Aucun résultat visible sans défiler | `web:creator-search/CreatorSearchScreen.tsx:201-253` |
| U12 | Recherche, profil anonyme, fil · marque, créateur | « Ajouter à ma sélection » change de libellé sans annonce. Dès `lg`, le compteur de la sélection est en fin de liste. Après « Voir la suite », le focus reste sur le bouton | On ne sait pas si l'ajout a réussi (WCAG 4.1.3) ; perte de repère | `web:creator-search/AddToSelectionButton.tsx:52-70`, `web:campaign/CampaignFeedScreen.tsx:151-159` |
| U13 | `/campagnes` · marque | Une carte d'environ 250 px par campagne : titre-lien, badge, phrase, date, « Voir ce que voit un créateur », bouton. Le titre et le bouton mènent au même endroit. Chaque brouillon porte une pilule verte, en plus de « Créer ». **Vu** | Cinq campagnes = environ 1 300 px ; trois actions vertes à l'écran | `web:campaign/CampaignListScreen.tsx:157-221` · [m03](captures/m03-mes-campagnes.jpg) |
| U14 | Fil `/campagnes` · créateur, téléphone | Chaque carte porte une pilule « Voir la campagne » en plus d'un titre-lien vers la même page. L'échéance de candidature est en troisième ligne d'un bloc secondaire. Le badge « Marque vérifiée » s'étale sur 3 lignes à côté du logo. **Vu** | Un mur de pilules vertes ; le critère n°1, l'échéance, se lit en dernier | `web:campaign/CampaignFeedCard.tsx:83-154` · [m10](captures/m10-fil-createur-mobile.jpg) |
| U15 | Fiche `/campagnes/[id]`, aperçu · créateur, marque | Le brief est mis en page sur 75 rem, soit plus de 120 caractères par ligne. Sur téléphone, la marque arrive en dernier. Le badge vérifié devient du texte gris. Côté créateur, la fiche est une impasse : la candidature n'est pas encore disponible et aucune suite n'est proposée | Lecture pénible ; aucune prochaine étape | `web:campaign/CampaignReadBody.tsx:44-112`, `CampaignRecordScreen.tsx:163-173` |
| U16 | Fil, fiche, aperçu, profil · tous | Logos posés sur `surface-raised` : l'alias `color-logo-plate` prévu (`20` §8, §10) n'existe pas | Un logo noir sur fond transparent disparaît | `web:campaign/campaign-classes.ts:78-79`, `web:brand-profile/LogoField.tsx:28` |
| U17 | Sélections · marque | Une sélection s'ouvre sur la carte de son formulaire « Nom et campagne », puis présente les mêmes cartes géantes que la recherche. La liste des sélections empile une carte par sélection. Aucune prochaine étape n'est écrite. **Vu** | On édite au lieu de consulter ; on ne sait pas quoi faire d'une sélection | `web:creator-search/ShortlistScreen.tsx:142-171`, `ShortlistsScreen.tsx:157-192` · [m05](captures/m05-selection.jpg) |
| U18 | Toutes les listes · tous | Une vingtaine d'états (vide, fermé, introuvable, profil non publié) sont rendus en carte, titre en 16 px ou absent, sans icône. La charte (`20` §11.8) les veut sans conteneur | États hétérogènes, cartes vides de sens | `web:campaign/CampaignListScreen.tsx:139-142`, `web:creator-search/CreatorSearchScreen.tsx:471-529` |
| U19 | `/campagnes/[id]` publiée · marque | « Consulter » une campagne publiée ouvre les 5 étapes du formulaire, champs grisés | Relire sa campagne demande de parcourir un formulaire inerte | `web:campaign/CampaignFormScreen.tsx:257-349` |
| U20 | Coquille, listes, profils, campagne · tous | Le chargement est une phrase (« Chargement de votre profil… »), puis le contenu surgit. Aucun squelette dans la coquille desktop ; squelettes de recherche de 16 rem pour des cartes de 1 400 px ; aucun token de squelette, bien que prévu (`20` §11.8) | Sauts de mise en page, impression de lenteur | `web:member/MemberShell.tsx:396-399`, `web:brand-profile/BrandProfileScreen.tsx:131-135` |
| U21 | Profil créateur, téléphone · créateur | Les 7 sections sont dépliées à la suite ; le sommaire n'est qu'une liste d'ancres. `17` §5.2 prévoit des sections ouvrables, et le profil marque a déjà son accordéon | 32 écrans, perte de repère | `web:creator-profile/CreatorProfileScreen.tsx:277-321` |
| U22 | Profil marque, campagne, profil créateur · tous | « Visible de tous les créateurs » sur environ 18 champs du profil marque, en plus de la tête de section. « Publié : visible des créateurs » sur presque chaque champ de campagne. Le même badge 8 fois dans une ligne réseau. **Vu** | Bruit visuel et sonore (chaque badge est lu) qui noie l'information utile : les champs qui **ne sont pas** publics | `web:brand-profile/ProfileFields.tsx:60-84`, `web:campaign/campaign-field-texts.ts:83` · [m06](captures/m06-campagne-etape-1.jpg) |
| U23 | Profil marque, bloc 2 · marque | 24 formats en cases à plat, sans lien avec les réseaux cochés au-dessus ; le bloc aligne 54 cases | Bloc interminable, choix incohérents | `web:brand-profile/ProfileFields.tsx:285-295` |
| U24 | Campagne, téléphone · marque | « Étape suivante », le panneau « Soumettre ma campagne » et la barre collante « Soumettre » sont tous trois en principal, dès l'étape 1 | Soumissions prématurées, hiérarchie brouillée | `web:campaign/CampaignFormScreen.tsx:315-355` |
| U25 | Connexion, inscription · tous | Le message d'erreur d'un champ ne disparaît qu'à la soumission suivante. Les profils et « Mes informations » l'effacent, eux, à la frappe | Doute (« c'est toujours faux ? ») sur l'écran où l'on perd des inscriptions | `web:auth/EmailStep.tsx:154`, `SignupDetailsStep.tsx:149-151` |
| U26 | Inscription, profils, campagne · tous | Quatre façons de dire « ce qui manque » : liste inerte, phrase inerte, phrase puis saut d'ancre, boutons qui ouvrent l'étape et focalisent le champ (la meilleure, en campagne) | Retrouver un manquant oblige à chercher ; tout se réapprend d'un écran à l'autre | `web:auth/SignupDetailsStep.tsx:270-279`, `web:campaign/CampaignSubmitPanel.tsx:117-146` |
| U27 | Primitives de champ · tous | Erreur et avertissement partagent la même icône et la même boîte, seule la teinte change. Chaque erreur de champ est une boîte pleine : jusqu'à 11 boîtes rouges après « Soumettre » | Indistinct pour un daltonien (WCAG 1.4.1) ; formulaire hérissé | `web:ui/ErrorNotice.tsx:27-30`, `web:member/ui/FieldFrame.tsx:95-108` |
| U28 | Profil créateur (blocs 3 et 4), vérification d'audience · créateur | **Cartes dans des cartes.** La ligne réseau est une carte complète dans la carte de section. Dedans, un cadre à contour fort (« Vos trois chiffres clés ») plus marqué que son conteneur, puis un cadre « Vérification ». Soit 4 niveaux de boîtes. **Vu** | Hiérarchie inversée ; marges cumulées qui écrasent les champs à 375 px | `web:creator-profile/CreatorNetworksFields.tsx:58-62`, `VerificationLineState.tsx:35-36` · [m08](captures/m08-profil-createur-reseau.jpg) |
| U29 | Secteurs, thématiques · marque, créateur | Listes triées par code anglais : en français, le premier secteur proposé est « Contenu adulte » | Première impression peu professionnelle | `apps/api/src/domains/profiles/repository.ts:293-305`, `web:brand-profile/brand-profile-options.ts:18-27` |
| U30 | Profil créateur (bloc 1), campagne (étapes 1 et 4) · créateur, marque | Nom légal, téléphone et e-mail de contact sont intercalés entre des champs publics, sans l'encart « Visible uniquement par vous et l'équipe INFLUX » de `17` §5.2. L'encart budgétaire « Interne » a la classe des cartes publiques | L'anonymat (D45, D46) et la confidentialité du budget (D78) se lisent mal | `web:creator-profile/CreatorProfileFields.tsx:178-228`, `web:campaign/CampaignBudgetFields.tsx:94-142` |
| U31 | Profils, campagne · lecteur d'écran | Le statut « Enregistrement… / Enregistré à 14 h 07 » est annoncé à chaque pause de 600 ms. Le même composant est recopié 3 fois | La lecture de ce qu'on tape est interrompue | `web:brand-profile/BrandProfileScreen.tsx:308-343` (+ 2 copies) |
| U32 | Profil créateur, bloc 5 · créateur | Les mêmes 3 droits d'usage figurent dans « inclus » et dans « en option » ; cocher l'un décoche l'autre sans le dire | Une réponse change hors de la vue | `web:creator-profile/CreatorOfferFields.tsx:194-228` |
| U33 | `/compte/informations` · tous | La nouvelle adresse e-mail part sans contrôle local ; un refus consomme le « code frais » | Une faute de frappe coûte un nouveau parcours de codes | `web:account/EmailChange.tsx:97-114` |
| U34 | Aperçu `/compte/profil/apercu` · créateur | L'onglet actif est une pilule verte pleine, alors que la charte veut des onglets « jamais verts » | Un onglet ressemble à une action | `web:creator-profile/CreatorPreviewScreen.tsx:192-194` |
| U64 | Listes de cartes : campagnes, recherche, sélections, accueils · tous | **Espacement inversé par rapport à la méthode « de l'extérieur vers l'intérieur »** (guide `02.md`). Les cartes d'une liste sont séparées de 16 px (`gap-4`), mais rembourrées de 24 px, puis de 32 px dès `lg` (`spacing-inset-card`). L'intérieur d'une carte respire plus que l'espace qui la sépare de sa voisine. **Vu** | Les cartes pèsent comme des blocs et le regroupement se lit mal ; c'est une part de l'impression de lourdeur | `packages/ui/src/styles/tokens.css:315, 575`, `web:campaign/CampaignListScreen.tsx:132`, `web:creator-search/creator-search-classes.ts:80` · [m03](captures/m03-mes-campagnes.jpg) |
| U59 | Accueil, `/campagnes`, `/createurs` · marque neuve | **Prérequis découverts au clic.** Tant que son profil n'est pas publié (11 champs obligatoires, puis examen par un commercial), la marque ne peut ni rechercher des créateurs, ni **même créer un brouillon** de campagne : le bouton « Créer une campagne » est absent (CA2). Le message dit pourtant « avant de **soumettre** une campagne », car il reprend la clé de la soumission. Le délai d'examen n'est annoncé nulle part. **Vu** | L'objectif immédiat de la marque (préparer sa campagne, voir des profils) est bloqué par une tâche secondaire dont elle ignore la durée ; c'est le schéma d'« aveuglement par l'objectif » décrit par le guide | `web:campaign/CampaignListScreen.tsx:95-106`, `apps/web/src/locales/fr/campaign.json:104`, `web:brand-profile/BrandHome.tsx:146-161` · [m11](captures/m11-campagnes-marque-neuve.jpg) |
| U60 | Fin d'inscription, première arrivée · marque, créateur | **Aucun accueil.** Après « Créer mon compte », un écran générique (« Votre espace vous attend : la suite se passe dans INFLUX ») puis un accueil qui ne salue pas et ne rappelle pas pourquoi on est venu. Pour la marque neuve : une phrase de 10 manques et deux cartes verrouillées. Pour le créateur neuf : un chapeau qui renvoie les campagnes à plus tard. **Vu** | La valeur n'est pas réaffirmée au moment où l'élan est maximal ; la première impression est une liste de devoirs | `apps/web/src/locales/fr/auth.json:221-224`, `web:auth/AuthFlow.tsx:337-357`, `web:brand-profile/BrandHome.tsx` · [m12](captures/m12-accueil-marque-neuve.jpg) |
| U61 | Accueils · marque, créateur | **Pas de checklist d'activation côté marque**, et des modèles hétérogènes. Le créateur neuf a le bon patron : jauge à 1 %, puis manques par section en liens (« Réseaux sociaux (6) »). La marque neuve a une phrase non cliquable. Au-delà du profil, aucune tâche d'activation n'est proposée (faire vérifier son compte, première campagne, première sélection). « Comment ça marche » reste un texte passif, à vie | Pas de direction claire ni de progression motivante pour la marque ; les premières actions de valeur ne sont pas guidées | `web:creator-profile/CreatorHomeCard.tsx`, `web:brand-profile/BrandHome.tsx:108-140` · [m12](captures/m12-accueil-marque-neuve.jpg), [m13](captures/m13-accueil-createur-neuf.jpg) |
| U62 | Inscription, écran 3 · marque, créateur | **Trois sujets sur un écran** : qui vous êtes (pays, langue, statut), vos engagements (18 ans, CGU, consentement marketing) et une question d'acquisition (« Comment avez-vous connu INFLUX ? »). L'attestation de majorité est placée entre le statut et la question d'acquisition, loin des deux autres engagements. **Vu** | Charge cognitive sur l'écran où l'on perd des inscriptions ; les engagements juridiques se lisent par morceaux | `web:auth/SignupDetailsStep.tsx:296-374` · [m14](captures/m14-inscription-createur-etape-3.jpg) |

## 6. Constats importants — backoffice

| ID | Écran · profil | Constat | Conséquence | Preuve |
|---|---|---|---|---|
| U35 | Décisions · commercial | « Retour à la file » est un simple lien : l'entrée reste **verrouillée 30 min** à son nom. Dans la file 1, « Rendre la main » efface sans confirmation un motif déjà saisi, contrairement aux 8 autres files | Verrous fantômes qui gonflent « sans preneur » ; texte perdu | `bo:ClaimedEntryFrame.tsx:229`, `bo:BrandReviewEntryScreen.tsx:210-220` |
| U36 | `/files/*/[id]` · commercial | Tout est empilé sur une colonne : en-tête, 2 à 6 bandeaux, 4 à 6 cartes de dossier, puis la décision tout en bas. Libellés et valeurs sont répartis en deux moitiés : à 1440 px, plus de 500 px séparent « Pays » de « Belgique ». L'ordre « Confirmer / Annuler » varie selon les écrans. Le cadre de décision existe en 3 copies, qui divergent déjà. **Vu** | Défilement incessant entre lecture et décision ; les automatismes trahissent | `bo:BrandReviewEntryScreen.tsx:186-317`, `bo:ClaimedDecisionParts.tsx:119-133` · [b03](captures/b03-decision-profil-marque.jpg) |
| U37 | Décisions, fiche, réglages · commercial, admin | **Cartes dans des cartes.** Une section contient une autre section de même apparence dans 12 composants, sur 3 niveaux (retrait de badge, ouverture, vérification). S'y ajoutent des tableaux à cadre propre dans les cartes, des cadres plus sombres que leur conteneur et des cartes d'une seule ligne | Conteneur et action indiscernables ; rembourrage doublé ; densité perdue | `bo:bo-classes.ts:6-9`, `bo:VerificationDecision.tsx:139-165`, `bo:AccountBadgesBlock.tsx:357` |
| U38 | 9 files, inscrits · commercial | La ligne s'éclaire au survol, mais seul « Ouvrir », en **dernière** colonne, ouvre l'entrée. Les cellules passent à la ligne : rangées de 75 à 95 px au lieu des 36 px prévus. Chiffres alignés à gauche. Pagination sans total. **Vu** | Lecture lente, densité réelle loin de `17b` §6.1, clic au bout de 10 colonnes | `bo:QueueTemplate.tsx:442-463`, `bo:bo-classes.ts:31-52` · [b02](captures/b02-file-profils-marque.jpg) |
| U39 | `/inscrits` · commercial | 12 colonnes, mais aucune ne permet de reconnaître un compte : ni nom, ni alias, ni adresse masquée (`17b` §3.11). Les filtres (7 listes, période, recherche, 3 lignes d'aide) occupent une carte permanente. **Vu** | Trouver un compte oblige à ouvrir des fiches, et chaque ouverture est une lecture privilégiée journalisée | `bo:AccountsScreen.tsx:294-496` · [b04](captures/b04-inscrits.jpg) |
| U40 | Accueil `/accueil` · commercial | L'ordre est le suivant : inscriptions et taux Brevo/Apollo, puis files (une phrase chacune), puis alertes, chacune dans une boîte. La même alerte AL21 est répétée **12 fois** sans regroupement. Ni « À traiter maintenant », ni « mes verrous ». **Vu** | La première page de la journée n'indique pas par quoi commencer | `bo:HomeScreen.tsx:123-331`, `bo:QueueSummary.tsx:124-134` · [b01](captures/b01-accueil.jpg) |
| U41 | Fiche, invitations, réglages · commercial, admin | La confirmation d'identité (`ReauthForm`) est un `<form>` en carte rendu **dans** le `<form>` de l'action : HTML invalide et risque de relancer l'action. Pour le retrait de badge, on obtient carte → carte → carte | Geste le plus sensible au comportement incertain (à confirmer par un test) | `bo:ActionFeedback.tsx:73-79`, `bo:AccountBadgesBlock.tsx:115-185` |
| U42 | Fiche créateur · commercial | Les chiffres exacts n'y sont signalés que par « ▮ » dans un titre ; le cadre de vue identifiée (barre et chapeau, `17b` §3.6) n'est utilisé que par la recherche | En partage d'écran, rien ne signale la donnée sensible (`10` RG80) | `bo:AccountCreatorBlocks.tsx:50-57` |
| U43 | Toute route, fenêtre < 768 px · commercial | La page masquée reste montée : ouvrir une entrée **prend en charge pour 30 min et journalise une lecture** sans rien afficher | Verrous et lectures fantômes (alerte AL21) | `bo:Shell.tsx:191-199`, `bo:shell-classes.ts:12` |
| U44 | Coquille · commercial | Pas de fil d'Ariane, pas de « `g` puis n », pas de `⌘K` (`17b` §1.5 à §1.7). L'aide des raccourcis est en bas de chaque page. Aucune touche ne ramène à la file | Navigation à la souris seulement, retours par liens texte | `bo:QueueTemplate.tsx:658-697`, `bo:AccountScreen.tsx:673-676` |

## 7. Constats cosmétiques

| ID | Écran · profil | Constat | Preuve |
|---|---|---|---|
| U45 | Accueils, états, sélections · tous | Toute action d'une carte s'étire en pilule pleine largeur (environ 600 px sur desktop), car la carte est en `flex-col`. **Vu** | `web:member/ui/card-classes.ts:5-8` · [m01](captures/m01-accueil-marque.jpg) |
| U46 | Accueils, fiche de campagne · tous | Des notices servent à des états durables (« Profil : publié », « Connecté avec… ») ; jusqu'à 4 bandeaux avant le contenu d'une fiche | `web:brand-profile/ProfileStateNotice.tsx:47-63`, `web:campaign/CampaignReadBody.tsx:45-57` |
| U47 | Connexion, fin d'inscription · tous | « Étape 1 sur 3 » pour une connexion en 2 écrans ; un écran « Votre compte est créé » impose un clic de plus avant l'espace | `web:auth/AuthScreen.tsx:22-23`, `AuthFlow.tsx:337-357` |
| U48 | Écrans e-mail et code · tous | Redondances : pastille de rôle **et** carte « Vous vous inscrivez comme MARQUE » ; 8 blocs sur l'écran du code | `web:auth/EmailStep.tsx:109-139`, `CodeStep.tsx:177-286` |
| U49 | Formulaires · tous | Nom de réseau (`h3`) en 20 px comme un `h2` ; titre de carte et libellé de champ quasi identiques ; cartes du compte titrées en 20 px, celles de la campagne en 16 px | `web:creator-profile/creator-profile-classes.ts:9-11` |
| U50 | Audience, nombre de créateurs · tous | Champs numériques courts en pleine largeur ; « % » dans le libellé seulement ; aucun total visible tant qu'il n'y a pas d'erreur | `web:member/ui/field-classes.ts:70-75` |
| U51 | Profil marque contre « Mes informations » · marque | Nom de l'entreprise modifiable à deux endroits, avec deux modèles d'enregistrement (automatique contre bouton) | `web:account/DetailsScreen.tsx:109-213` |
| U52 | Campagne, étape 5 · marque | Dates natives au format du système, pas de la langue de la page ; aucune borne `min` entre les 4 dates | `web:campaign/CampaignCalendarFields.tsx:55-71` |
| U53 | Entrée · tous | « Changer », « Modifier » : boutons texte au milieu d'une phrase, distingués par la seule graisse | `web:auth/CodeStep.tsx:179-188` |
| U54 | Profils, contestation, CGU · tous | Microcopies à reprendre : aide qui décrit l'interface, adresse de connexion en placeholder lue comme une valeur, motif obligatoire non marqué, « Fermer » seulement en bas des CGU | `web:brand-profile/ProfileFields.tsx:414`, `web:verification/AppealScreen.tsx:299-317` |
| U55 | Recherche · marque | Second `<nav>` (pagination), contre la règle « un seul nav » | `web:creator-search/CreatorSearchScreen.tsx:685` |
| U56 | Files, inscrits · commercial | Listes de 28 px et dates ou recherches de 48 px sur la même ligne de filtres ; « Responsable » ne propose que « Sans responsable ». **Vu** | `bo:QueueFilterBar.tsx:114-165` · [b02](captures/b02-file-profils-marque.jpg) |
| U57 | Divers · commercial, admin | Compte à rebours annoncé chaque seconde ; `h2` dans un `h2` ; `role="status"` sur du texte fixe ; bande d'en-tête affichant l'e-mail au lieu de « Prénom N. · commercial » ; vocabulaire variable | `bo:DualControlScreens.tsx:567-569`, `bo:Shell.tsx:216-225` |
| U58 | Profil créateur, sommaire · créateur | Le bouton « Ce que voit une marque » se coupe sur 3 lignes dans la colonne étroite du sommaire. **Vu** | [m07](captures/m07-profil-createur.jpg) |
| U65 | Badges de statut, de couche, vérifié ; pastilles de choix · tous | Icône et libellé séparés de 4 px (`gap-1`), sous le minimum de 6 px du guide `02.md` | `web:member/ui/status-badge-classes.ts:9`, `layer-badge-classes.ts:10`, `VerifiedBadge.tsx:35`, `PickListField.tsx:111` |
| U63 | Entrée, compte, profils, campagne · tous | Libellés de bouton qui ne disent pas ce qui se passe : « Valider » (code de connexion, code de confirmation), « Soumettre mon profil », « Soumettre ma campagne », « Soumettre à la validation » | `apps/web/src/locales/fr/auth.json:95`, `account.json:119`, `campaign.json`, `brand-profile.json` |

## 8. Causes communes

1. **La carte est le seul conteneur disponible.** Il n'existe ni section sans conteneur, ni bloc
   intérieur partagé au backoffice, ni état vide, ni groupe d'actions. Faute de mieux, on encadre.
   Comme `surface-card` (`#121413`) ne se distingue pas de la page (`#0a0b0a`), chaque carte se
   réduit à un filet de plus (U18, U28, U37, U45, U46).
2. **Aucune règle « une action principale par vue ».** Chaque composant pose sa pilule verte
   (U08, U13, U14, U24, U45).
3. **Le formulaire sert aussi à lire.** Campagne publiée, sélection, fiche de compte s'ouvrent sur
   des champs (U07, U17, U19).
4. **Les retours d'état ne sont pas factorisés.** `SaveStatus` est recopié 3 fois, le cadre de
   décision 3 fois. Il n'y a ni squelette, ni région d'annonce commune, ni résumé d'erreurs commun
   (U20, U26, U31, U36).
5. **La densité vient des contenus, pas des tokens.** Les tokens de densité existent (rangée de
   36 px). Les cellules et les cartes, elles, empilent libellés, phrases d'aide et sous-textes
   (U10, U38).
6. **L'onboarding s'arrête à la complétude du profil.** Pas d'accueil, pas de tâche d'activation
   au-delà du profil, et des prérequis découverts au moment où ils bloquent (U59, U60, U61).

## 9. À préserver

- La coquille : un seul `<nav>` restylé, sous-menus D74, focus au `h1` après navigation, lien
  d'évitement, anneau intérieur dans la barre du bas, zone de geste iOS (`app/globals.css`).
- Le mouvement : transformations sous `motion-safe:`, durées par tokens ramenées à zéro sous
  `prefers-reduced-motion`, jamais `transition-all`.
- La conformité : aucun montant ni taux côté créateur ; « Proposé car » et « Ce n'est pas un
  score » sur la recherche ; états de la recherche qui gardent critères et sélection.
- Les bons patrons déjà présents, à généraliser :
  - l'accordéon du profil marque ;
  - la liste des manques de la campagne (ouvrir l'étape, focaliser le champ) ;
  - la page-menu « Compte » ;
  - les blocs intérieurs conformes (`PortfolioItemCard`, « Proposé car ») ;
  - le stepper latéral de la campagne ;
  - la checklist du créateur neuf (jauge, manques par section en liens).

## 10. Confrontation au guide d'onboarding (`docs/good-practice-ux/01.md`)

Le guide se termine par une checklist en huit points. Chaque point est confronté ici aux écrans
réellement rendus. Ses chiffres (40 à 50 % d'abandon, 86 % de fidélité, 60 à 70 % de vidéos
sautées) sont cités sans source : ils motivent la démarche, ils ne servent pas de mesure ici.

| Point du guide | État d'INFLUX | Constats |
|---|---|---|
| **Accueil et connexion** : saluer, réaffirmer la valeur sans submerger | **Non conforme.** Écran de succès générique, accueil sans salutation ni rappel de la valeur ; la marque neuve découvre une liste de devoirs | U60, U47, U01, U08 |
| **Alignement sur l'objectif** (éviter l'aveuglement par l'objectif) | **Non conforme côté marque.** Recherche et création de campagne verrouillées jusqu'à la validation du profil, prérequis et délai annoncés trop tard. **Conforme côté créateur** pour l'accès (le fil est ouvert sans condition), mais l'accueil cache ce fil | U59, U01 |
| **Personnalisation du parcours** : n'afficher que ce qui correspond au besoin | **Partiel.** Les deux portes séparent bien discours et parcours. Mais le profil marque montre les 24 formats quels que soient les réseaux choisis, exactement le cas des « 12 modèles pour toutes les sources » du guide ; le profil créateur, lui, groupe déjà les formats par réseau | U23 |
| **Progression visuelle et checklist** | **Partiel.** Bonne jauge et bonne checklist pour le créateur neuf ; rien d'équivalent pour la marque ; aucune tâche d'activation au-delà du profil ; « Comment ça marche » passif | U61, U26 |
| **Aide contextuelle dans le flux** (sans surimpression ni survol bloquant) | **Conforme dans le principe** : aides sous les libellés, avertissement de coordonnées dans le champ, explication de l'anonymat au moment de rédiger la bio, aucune info-bulle au survol, aucune visite guidée imposée. **Excès** : la même aide répétée sur chaque champ finit par masquer l'aide utile | U22, U48 |
| **Respect du modèle mental** et contrôle de l'utilisateur | **Partiel.** La connexion sans mot de passe (code à 6 chiffres, D37) rompt le modèle habituel « lien puis mot de passe ». Elle est bien compensée par la phrase « Pas de mot de passe : nous vous envoyons un code à 6 chiffres » sur l'écran e-mail, à garder visible (U48 propose de la déplacer, pas de la supprimer). En revanche, des actions implicites retirent le contrôle : une liste qui agit au changement, une case qui en décoche une autre en silence | U03, U32 |
| **Formulaire d'inscription** : noms longs acceptés, verbes d'action | **Noms : conforme** (raison sociale jusqu'à 120 caractères, nom légal 100, prénom du contact 40). **Verbes : partiel.** « Créer mon compte » est juste ; « Valider » et « Soumettre… » ne disent pas ce qui se passe | U63 |
| **Une chose par écran** | **Partiel.** L'entrée est bien découpée (porte, e-mail, code, détails), mais l'écran 3 mêle identité, engagements et acquisition. Le bloc 1 du profil créateur mêle présentation publique et identité légale interne. La campagne est bien découpée en étapes | U62, U30 |

La fiche `04.md` (« Recommandation stratégique ») reprend ces huit points et en ajoute deux,
traités au §11.

**Ce que le guide confirme dans les choix actuels.** Pas de vidéo d'introduction, pas de visite
guidée en surimpression, pas de fenêtre surgissante à l'ouverture : ce sont les bons choix, à
garder. Une checklist d'activation (U61) peut servir de « visite guidée » intégrée : chaque tâche
ouvre l'écran voulu et place le focus sur le champ, sans calque par-dessus l'interface.

## 11. Confrontation aux fiches 02, 03 et 04 du guide

### 11.1 Espacement : grille de 8 px et méthode « de l'extérieur vers l'intérieur » (`02.md`)

| Règle de la fiche | État d'INFLUX | Constats |
|---|---|---|
| Échelle multiple de 8 (4, 8, 16, 24, 32) | **Conforme dans l'esprit.** Échelle des tokens : 4, 8, 12, 16, 24, 32, 40, 48, 64 px, soit une grille de 4 px dont les paliers courants sont des multiples de 8. Rayons de 6, 12, 16 et 20 px : sur la grille de 4, pas toujours sur celle de 8 | — |
| Enveloppe externe de 24 à 30 px | **Écart assumé sur téléphone.** La gouttière de page va de 16 px à 375 px jusqu'à 48 px sur grand écran. 16 px sur téléphone libère de la largeur pour les champs et les cartes ; à garder, mais à documenter comme écart volontaire | — |
| Sections séparées de 32 px | **Conforme** sur téléphone (32 px) ; 48 px sur ordinateur, ce qui reste décroissant | — |
| Titre → contenu à 24 px, plus serré que l'écart entre sections | **Partiel.** 16 px aujourd'hui, ce qui respecte la proximité ; la fiche suggère 24 px pour un titre de section (`04` §3 le reprend) | — |
| Éléments d'un groupe à 16 px, rembourrage des cartes à 16 px (8 px si dense) | **Non conforme.** Écart entre cartes de 16 px, rembourrage de 24 à 32 px : l'espacement **croît** vers l'intérieur au lieu de décroître | U64 |
| Boutons et étiquettes côte à côte à 8 px ; **6 px minimum** entre deux éléments (icône et libellé) | **Partiel.** 8 à 12 px entre boutons ; 4 px entre l'icône et le libellé des badges | U65 |
| Cibles tactiles espacées de 12 à 42 px | **Conforme** : barre du bas, actions de carte (12 px), boutons de 44 px de haut | — |
| Espace blanc généreux, sans rompre la proximité | **Partiel.** De l'air, mais au mauvais endroit : à 1 440 px, une bande vide de plus de 250 px sépare la colonne de navigation d'un contenu centré, alors qu'au backoffice une valeur est à plus de 500 px de son libellé | U09, U36 |

### 11.2 Techniques d'animation web (`03.md`)

La fiche vise des sites de présentation (« rendre les interfaces captivantes »). INFLUX est un outil
métier utilisé chaque jour : chaque technique est évaluée à cette aune.

| Technique de la fiche | Verdict pour les espaces connectés | Pourquoi |
|---|---|---|
| **Position collante** (`position: sticky`) | **À généraliser** : colonne de décision du backoffice, colonne « La marque » de la fiche de campagne, barres d'action mobiles (déjà en place), en-têtes de tableau (déjà en place) | Native, stable, sans dépendance ; sert l'orientation, pas la décoration |
| **Courbes d'assouplissement** | **Déjà maîtrisées** : `ease-standard` à l'entrée, `ease-exit` à la sortie, par tokens. Pas de rebond dans un outil de travail | La fiche a raison : la courbe fait la finition. Le rebond distrait et allonge le geste |
| **Détection de fenêtre d'affichage** (apparition à l'entrée dans l'écran) | **Écartée dans les espaces connectés.** Possible sur la vitrine, dans la limite d'un effet spectaculaire par écran (D59) | Faire apparaître une ligne de file ou une carte de résultat au défilement retarde la lecture d'un contenu qu'on vient chercher |
| **Suivi du défilement** et **défilement fluide** (Lenis, Locomotive) | **Écartés** | Le défilement simulé remplace celui du navigateur : il casse le `scroll-padding` qui garde un champ focalisé hors des barres collantes (WCAG 2.4.11), le défilement au clavier et les réglages du système |
| **Découpage du texte** (lettre par lettre) | **Écarté** | Lecteurs d'écran perturbés, bugs au redimensionnement (la fiche le note), sans gain pour un outil |
| **Bibliothèques** GSAP, Framer Motion (fiche `03.md` et `04.md` §4.4) ; interpolation, shaders (`04.md`) | **Non justifiées** | Les besoins retenus (`04` §12) se couvrent en CSS : transitions, `@starting-style`, `sticky`, durées par tokens, mouvement réduit déjà câblé. Une bibliothèque ajouterait du JavaScript client sans besoin réel (règle « aucune dépendance sans justification ») |

### 11.3 Recommandation stratégique d'onboarding (`04.md`)

La fiche reprend le diagnostic de `01.md` (§10) et y ajoute trois éléments.

| Apport | Application à INFLUX | Constats |
|---|---|---|
| **Jalon 5 : immersion immédiate dans le premier workflow**, sans étape administrative superflue | Va dans le sens de D86 (brouillon de campagne avant la validation du profil) : la marque peut commencer sa campagne dès l'inscription. Côté créateur, le fil est déjà ouvert sans condition ; l'accueil doit y conduire | U59, U01 |
| **Démontrer la valeur, faire visualiser le succès** | Deux leviers existent déjà et sont sous-employés : la ligne « Les marques voient : Micro (de 10 000 à 49 999) » sous chaque chiffre du créateur, et l'aperçu « Ce que voit un créateur » de la campagne. Les faire figurer dans la checklist d'activation (« Voir votre profil comme une marque le voit ») | U61 |
| **Messages d'erreur contextuels en temps réel** | À concilier avec la règle de `04` §6 : un retour **positif** en temps réel (compteur de caractères, tranche vue par les marques) oui ; une **erreur** seulement au départ d'un champ déjà signalé, jamais pendant la première saisie (NN/g, `02` §3) | U25 |
| **Inviter des collaborateurs** comme action d'activation | Sans objet au MVP : un compte INFLUX est individuel, aucune équipe n'est prévue | — |
| **Vidéo de bienvenue** | Écartée : la fiche elle-même rappelle que 60 à 70 % des utilisateurs sautent ces vidéos ; un message écrit suffit (`03` B5) | U60 |
