# 02 — Benchmark design

> Ce que les produits de référence résolvent, le principe qu'ils appliquent et ce qu'INFLUX peut
> en tirer, sans copier leur style. Les constats `Uxx` renvoient à `01`. Recherche du 2026-11-22.

## 0. Ce qui a réellement été consulté

**Marqueurs de provenance.**
- **[vérifié]** : page récupérée le 2026-11-22, URL citée.
- **[secondaire]** : page récupérée, mais c'est un tiers qui décrit le produit.
- **[principe connu]** : connaissance générale, non revérifiée.
- **[hypothèse]** : à confirmer.

**Limite de méthode.** Les pages ont été lues en **texte** : aucune image, capture ou vidéo n'a été
visionnée, même sur les sites accessibles. Les écrans d'INFLUX, eux, ont été vus (`01` §1).

| Ressource | Accessible ? | Ce qui a été obtenu |
|---|---|---|
| Mobbin (`mobbin.com`) | Non : texte marketing seulement, `/explore` et `/pricing` en 403 | Aucun écran. La bibliothèque est réservée aux offres payantes |
| Page Flows (`pageflows.com`) | Partiel | Catalogue des produits et des types de parcours. Sur le parcours d'inscription Stripe, environ 45 **intitulés** d'étapes ; écrans verrouillés (« Sign up to unlock this user flow ») |
| Vidéo 1 · Demystifying Design, « How to redesign a SaaS dashboard » | Introuvable | Rien. Aucun enseignement n'en est tiré |
| Vidéo 2 · DSCODE, « Complete AI SaaS Product Design in Figma » | Introuvable | Rien |
| Vidéo 3 · UI Collective, « Onboarding – Step-by-Step UI Tutorial for SaaS » | Introuvable | Rien |
| Vidéo 4 · David Emulo, « How to Design a Dashboard Content Area UI in Figma » | Non confirmée | Un titre proche dans des listes tierces, sans auteur ni URL. Rien sur le contenu |
| Vidéo 5 · `youtu.be/pOwX0IiEzsQ` | Métadonnées seulement | « Le content design sauve vos formulaires », chaîne GDG France. Ni description, ni chapitres, ni transcription : **rien sur le propos** |
| Vidéo 6 · Framer Academy, « Create animated Component interactions » | Page compagnon seulement | Description, 3 points clés, FAQ ; vidéo non visionnée |
| Shopify Polaris, Stripe (docs Stripe Apps et Dashboard), Linear, Intercom, Airtable, Atlassian | Oui | Voir les fiches |
| HubSpot | Faible | `canvas.hubspot.com` redirige vers un article ; guide des composants d'extension seulement |
| Notion, Canva | Secondaire | Analyses tierces (Appcues GoodUX) non datées |
| wekollab, Upfluence, Modash, Kolsquare, Aspire, GRIN, Favikon | Pages d'accueil seulement | Discours, portes d'entrée, filtres annoncés ; aucun écran produit (démonstration ou essai requis) |
| Collabstr · Hivency | Non (403 · échec SSL) | Rien de vérifié |
| NN/g, GOV.UK, W3C WCAG 2.2 | Oui | Principes cités au §3 |
| Guide interne `docs/good-practice-ux/01.md` (« Réussir l'accueil utilisateur en SaaS ») | Oui (dépôt) | Lu en entier ; principes et checklist au §5. Ses chiffres ne citent pas leurs sources |
| Guide interne `02.md` (grille de 8 px, méthode « de l'extérieur vers l'intérieur »), `03.md` (5 techniques d'animation web), `04.md` (recommandation stratégique d'onboarding) | Oui (dépôt) | Lus en entier ; §6 |

**Pour aller plus loin** : un essai Page Flows de 3 jours (2,95 $, à souscrire par le fondateur)
permettrait de vérifier les écrans réels de Stripe, Notion et HubSpot. Les URL exactes des vidéos 1
à 4 permettraient de retenter leurs chapitres ou leur transcription.

## 1. Références SaaS

### 1.1 Shopify Admin (Polaris)
- **Problème traité** : pages d'administration denses, conteneurs empilés, actions concurrentes,
  modifications non enregistrées.
- **Principe observé** :
  - [vérifié] « A nested section doesn't draw its own card » : seul le premier niveau est surélevé,
    les titres descendent seuls (h2 → h4), et la structure se brouille au-delà de 3 niveaux
    ([Section](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/section)).
  - [vérifié] Une carte porte **une seule action principale** ; aucun bouton principal dans un
    tableau ; une densité constante dans une même page ; modèle de page de réglages (titre et
    description à gauche, formulaire à droite) ([Layout](https://shopify.dev/docs/apps/design/layout)).
  - [vérifié] Barre d'enregistrement contextuelle (« Enregistrer · Ignorer »), confirmation avant
    de quitter ([Save Bar](https://shopify.dev/docs/api/app-home/apis/save-bar)).
- **Intérêt pour INFLUX** : c'est la seule source vérifiée qui énonce la règle contre les poupées
  russes.
- **Adaptation recommandée** :
  - profils créateur et marque, campagne : une carte par bloc de premier niveau, sous-groupes en
    titres et filets (U28, U22) ;
  - une pilule verte par vue (U08, U13, U14, U45) ;
  - fiche de compte et réglages du backoffice en « libellé à gauche, contenu à droite » (U07, U36).
- **Limites** : Polaris est conçu en thème clair, et ses ombres portent mal sur fond noir. On garde
  la structure, pas l'effet. La barre d'enregistrement ne vaut pas pour la campagne, qui garde son
  brouillon permanent.

### 1.2 Stripe Dashboard (et patterns Stripe Apps)
- **Problème traité** : dire l'état d'une vue (vide, filtrée, en erreur, en chargement) et la suite
  à donner ; lisibilité des données.
- **Principe observé** :
  - [vérifié] État vide :
    - titre qui dit ce qui manque, description de moins de 14 mots ;
    - action qui reprend le titre ;
    - un vide **dû aux filtres** ne propose pas de « créer le premier » ;
    - ordre des états : chargement, erreur, vide, contenu
    ([Empty state](https://docs.stripe.com/stripe-apps/patterns/empty-state)).
  - [vérifié] Toast de 4 mots au plus pour un fait passager, bannière persistante quand une action
    est requise ([Communicating state](https://docs.stripe.com/stripe-apps/patterns/communicating-state)).
  - [vérifié] Filtres en puces « suggéré / actif », « Effacer » seulement si un filtre est actif
    ([Filter controls](https://docs.stripe.com/stripe-apps/patterns/filter-controls)).
  - [vérifié] `?` affiche les raccourcis ; l'accueil remonte ce qui demande une action
    ([Dashboard basics](https://docs.stripe.com/dashboard/basics)).
- **Intérêt** : des règles de microcopie et d'états directement applicables.
- **Adaptation recommandée** :
  - primitives `EmptyState` et `StateMessage` (U18) ;
  - vide filtré de la recherche (« Aucun créateur ne correspond à ces filtres. · Effacer les
    filtres ») ;
  - annonce « Profil 7K3M ajouté à Ma sélection » (U12) ;
  - `?` au backoffice (U44) ;
  - accueils orientés « à traiter » (U01, U08, U40).
- **Limites** : les patterns Stripe Apps visent un panneau étroit. Les longueurs se transposent,
  pas le gabarit.

### 1.3 Linear
- **Problème traité** : densité sans bruit, navigation prévisible, traitement rapide d'une file.
- **Principe observé** :
  - [vérifié] Refonte de 2024 : barre latérale, onglets et en-têtes revus « to reduce visual
    noise » ([article](https://linear.app/now/how-we-redesigned-the-linear-ui)).
  - [vérifié] Rafraîchissement de 2026 : barre latérale atténuée pour que le contenu prime,
    « structure should be felt, not seen », actions d'en-tête prévisibles
    ([article](https://linear.app/now/behind-the-latest-design-refresh)).
  - [vérifié] Triage au clavier : accepter, refuser avec motif, doublon, reporter
    ([Triage](https://linear.app/docs/triage)).
- **Intérêt** : même famille de navigation (colonne à gauche, D74) et même thème sombre.
- **Adaptation recommandée** :
  - séparer par l'espace et la typographie plutôt que par des cadres (U37, U28) ;
  - actions d'en-tête toujours au même endroit sur la fiche de compte et la décision (U07, U36) ;
  - file traitée au clavier jusqu'à l'entrée suivante (U35, U44).
- **Limites** : pas de « reporter » qui masquerait une entrée (D49 : une entrée hors délai reste
  visible). La palette est figée (D6, D73).

### 1.4 Intercom (Inbox)
- **Problème traité** : plusieurs agents sur les mêmes dossiers, beaucoup de contexte à portée.
- **Principe observé** :
  - [vérifié] Trois volets repliables (`[`, `]`), disposition par rôle
    ([aide](https://www.intercom.com/help/en/articles/7911926-customize-the-inbox-to-suit-you-and-how-you-work-best)).
  - [vérifié] Avatars de présence pour éviter qu'un même dossier soit traité deux fois ; `⌘K` ;
    affectation en masse ([aide](https://www.intercom.com/help/en/articles/6258745-the-help-desk-explained)).
  - [principe connu] Notes internes visuellement distinctes des réponses.
- **Intérêt** : modèle de la messagerie à trois (Lot 4) et du verrou de prise en charge.
- **Adaptation recommandée** :
  - colonne de décision collante au backoffice (U36), patron du panneau de conversation du Lot 4 ;
  - détenteur du verrou nommé sur la ligne de file ;
  - aparté (D47) doublé d'un libellé écrit.
- **Limites** : pas d'anonymisation chez Intercom. Côté membre sur téléphone, une conversation
  simple, panneau replié.

### 1.5 HubSpot (fiche CRM)
- **Problème traité** : comprendre un compte en un coup d'œil et agir depuis sa fiche.
- **Principe observé** :
  - [principe connu] Fiche en trois zones : en-tête d'identité avec actions, colonne de propriétés,
    fil d'activité chronologique.
  - [vérifié] La modale est réservée aux « short messages and action confirmation boxes » ; un
    panneau s'ouvre à droite
    ([guidelines](https://developers.hubspot.com/docs/platform/component-design-guidelines)).
- **Intérêt** : c'est exactement ce qui manque à la fiche de compte (U07).
- **Adaptation recommandée** :
  - en-tête « nom · rôle · pays · état · responsable » et actions ;
  - colonne de propriétés (e-mail, consentement, synchronisation) ;
  - activité en mots, auteur nommé, lectures regroupées ;
  - confirmation d'identité en dialogue (U41).
- **Limites** : sources HubSpot faibles (fiche réelle non vue). L'ordre des blocs de `15` RG41
  doit être arbitré par le product-owner.

### 1.6 Airtable (revue d'enregistrements)
- **Problème traité** : passer en revue beaucoup d'enregistrements à la suite.
- **Principe observé** : [vérifié] disposition liste et détail, « useful for triaging or reviewing
  many records at once » ; les filtres du concepteur priment sur ceux de l'utilisateur
  ([support](https://support.airtable.com/docs/interface-layout-record-review)).
- **Intérêt** : files de validation.
- **Adaptation recommandée** : décider sans quitter la file (colonne de décision, entrée suivante
  proposée), périmètre de la file fixé par le rôle, filtres de l'agent par-dessus (U36, U38).
- **Limites** : Airtable qualifie lui-même cette disposition d'ancienne. Une vraie vue « liste à
  gauche, dossier à droite » demande une largeur que la fenêtre en demi-écran (768 à 1 023 px)
  n'offre pas.

### 1.7 Notion
- **Problème traité** : structurer un contenu long sans le cloisonner.
- **Principe observé** :
  - [secondaire] Questions d'usage à l'inscription, puis une page « Getting Started » sous forme
    de liste de tâches réalisées dans l'interface
    ([analyse](https://goodux.appcues.com/blog/notions-lightweight-onboarding)).
  - [principe connu] Hiérarchie portée par la typographie et l'espacement, pas par des cadres.
- **Intérêt** : formulaires longs et pages de lecture.
- **Adaptation recommandée** :
  - fiche de campagne en colonne de lecture d'environ 70 caractères (U15) ;
  - sections des profils titrées et séparées par l'espace (U28) ;
  - liste « À faire » actionnable sur l'accueil créateur (U01).
- **Limites** : sources tierces anciennes.

### 1.8 Canva
- **Problème traité** : guider un nouvel utilisateur vers une seule action.
- **Principe observé** : [secondaire] « guides new users to completing the one action that most
  matters to them in that moment »
  ([analyse](https://goodux.appcues.com/blog/canvas-user-tailored-onboarding-flow)).
- **Intérêt** : après l'inscription.
- **Adaptation recommandée** : une seule action d'activation par porte, puis une liste de
  complétude actionnable (U01, U08, U47). Les deux portes segmentent déjà ; pas de visite guidée en
  modales.
- **Limites** : source tierce.

### 1.9 Atlassian (élévation en thème sombre)
- **Problème traité** : hiérarchiser des surfaces sur fond sombre.
- **Principe observé** : [vérifié] quatre niveaux (sunken, default, raised, overlay) ; en sombre,
  plus une surface est haute, plus elle est claire ; « raised » avec parcimonie
  ([Elevation](https://atlassian.design/foundations/elevation)).
- **Intérêt** : explique pourquoi les cartes d'INFLUX se voient mal. `surface-card` est quasi égal
  à la page, et un cadre plus sombre dans une carte (`bg-surface-page` dans `CampaignReviewBlocks`)
  inverse l'élévation.
- **Adaptation recommandée** : trois niveaux au plus (page, carte, bloc intérieur
  `surface-raised`), déjà écrits dans `20` §11.8 (`04` §4).
- **Limites** : aucune valeur nouvelle (D6, D73).

## 2. Plateformes du marketing d'influence

[vérifié] Aucune ne montre d'écran produit sans compte : on observe le discours et les portes,
**pas les parcours internes**. Aucune ne présente de profils anonymisés.

| Plateforme | Observé | À retenir pour INFLUX |
|---|---|---|
| [wekollab.fr](https://wekollab.fr/) (référence du projet) | Promesse en une phrase, « comment ça marche » en 3 étapes, preuves (« Réponse sous 24h »). Formulaire marque en 3 étapes : téléphone et budget en tranches dès l'étape 1. Profils créateurs publics nominatifs. Aucune vraie porte créateur décrite | À égaler : promesse et 3 étapes. À faire mieux : une vraie porte créateur, moins de champs à l'entrée. Les visages publics ne se copient pas (D45, D46) |
| [Upfluence](https://www.upfluence.com/) | Porte créateur distincte en tête (« I'm a Creator ») | Confirme les deux portes |
| [Modash](https://www.modash.io/) | Familles de filtres nommées (plateforme, démographie, performance, audience). Carte de résultat compacte : chiffres clés et trois actions | Facettes regroupées en familles ; carte de résultat compacte (U10) |
| [Kolsquare](https://www.kolsquare.com/fr) | Filtres par secteur, audience, conformité ; scores d'authenticité | Les filtres oui, le score non (D11) |
| [Favikon](https://www.favikon.com/) | Score affiché (« Authenticity 91 ») | Contre-exemple : INFLUX explique (« Proposé car ») |
| [GRIN](https://grin.co/), [Aspire](https://www.aspire.io/) | Pages 100 % marque, démonstration obligatoire ; GRIN propose une application créateur séparée | Rien de vérifiable sur les parcours |

## 3. Principes de référence sourcés

| Source [vérifié] | Principe | Application |
|---|---|---|
| [NN/g, Cards](https://www.nngroup.com/articles/cards-component/) | Cartes bonnes pour parcourir un contenu hétérogène, **mauvaises pour comparer** ; plus encombrantes que des lignes | Recherche : carte compacte ; listes de campagnes et de sélections en lignes (U10, U13, U17) |
| [NN/g, Wizards](https://www.nngroup.com/articles/wizards/) | Étapes listées, étape courante, libellés descriptifs, retour, sortie et reprise | Campagne : déjà conforme ; libellé « Continuer : livrables » (U24) |
| [NN/g, Errors in forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/) | Valider à la sortie du champ ; message collé au champ ; couleur + icône ; un récapitulatif ne suffit pas seul | U25, U26, U27 |
| [NN/g, Required fields](https://www.nngroup.com/articles/required-fields/) | Marquer chaque champ obligatoire | Profils, contestation (U54) |
| [NN/g, Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Deux niveaux au plus ; deux écrans valent souvent mieux qu'un seul surchargé | Profil créateur en accordéon (U21) |
| [NN/g, Dashboards](https://www.nngroup.com/articles/dashboards-preattentive/) | Tableau de bord **opérationnel** ≠ analytique | Accueils : « à traiter » d'abord (U01, U08, U40) |
| [NN/g, Skeleton screens](https://www.nngroup.com/articles/skeleton-screens/) | Squelette pour une page de moins de 10 s ; rien en dessous d'1 s | U20 |
| [NN/g, Microinteractions](https://www.nngroup.com/articles/microinteractions/) | Couple déclencheur-retour, jamais décoratif | `04` §12 |
| [GOV.UK, Form structure](https://www.gov.uk/service-manual/design/form-structure) · [Question pages](https://design-system.service.gov.uk/patterns/question-pages/) · [Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | Chaque champ justifié ; une chose par page pour commencer ; récapitulatif avec liens « Modifier » | Inscription (déjà sobre), récapitulatif de campagne avant soumission |
| [WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html), [3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) | Focus jamais masqué par une barre collante ; cibles de 24 px ; aucune ressaisie ; code collable | Barres collantes (U02, U24), code à 6 chiffres (déjà collable) |

**Vidéos.** Seule la page compagnon de la leçon Framer a été lue [vérifié]
([leçon](https://www.framer.com/academy/lessons/framer-animations-component-interactions)) :
- une variante par état d'interaction, reliées par une transition ;
- tester chaque chemin d'entrée et de sortie, y compris les clics répétés ;
- un mouvement = un seul rôle, et la page reste compréhensible si l'effet est sauté.

Ces trois idées fondent le catalogue de `04` §12. Les principes de formulaires cités ci-dessus
**ne viennent pas** de la conférence DevFest, dont le propos n'a pas pu être consulté.

## 4. Les 5 références SaaS les plus pertinentes

| Rang | Référence | Pourquoi pour INFLUX | Constats servis |
|---|---|---|---|
| 1 | **Shopify Admin (Polaris)** | Règle vérifiée contre la carte dans la carte ; une action principale par carte ; modèle des réglages | U28, U37, U45, U08, U13, U14 |
| 2 | **Stripe Dashboard** | États vides, filtrés et en erreur ; toasts et bannières ; filtres en puces ; accueil orienté action | U18, U12, U20, U40, U01 |
| 3 | **Linear** | Même navigation et même thème ; structure par l'espace ; file traitée au clavier | U36, U37, U35, U44 |
| 4 | **HubSpot (fiche CRM)** | En-tête d'identité, colonne de propriétés, fil d'activité : le modèle de la fiche de compte | U07, U39, U41 |
| 5 | **Intercom** | Panneau latéral de contexte, présence et verrou ; patron de la messagerie à trois du Lot 4 | U36, Lot 4 |

Références méthodologiques hors SaaS, tout aussi utiles pour les formulaires : **GOV.UK** et
**NN/g**, avec **WCAG 2.2**.

## 5. Guide interne : réussir l'onboarding SaaS

Source : `docs/good-practice-ux/01.md`, document du dépôt. Les principes sont ceux du guide ; les
chiffres qu'il cite (40 à 50 % d'abandon après un mauvais accueil, 86 % de fidélité, 60 à 70 % de
vidéos d'introduction sautées selon Google) ne donnent pas leurs sources et ne sont pas repris
comme mesures.

| Principe du guide | Ce qu'il résout | Adaptation à INFLUX | Limites |
|---|---|---|---|
| **Accueillir et orienter** : saluer, réaffirmer la valeur, sans submerger | Le vide de la première arrivée | Remplacer l'écran de succès par un accueil de première visite, par porte : une phrase de valeur et une checklist (U60, `03` B5) | Pas de vidéo ni de modale : le guide lui-même note qu'elles sont sautées |
| **Checklist + indicateur de progression** | L'absence de direction | Généraliser le patron du créateur neuf (jauge, manques en liens) à la marque, et prolonger au-delà du profil par des tâches d'activation (U61, `03` B6) | Les tâches sont des actions qui existent déjà ; aucune n'en crée de nouvelle |
| **Visite guidée dans la checklist** | Trouver où se fait une action | Visite « dans le flux » : la tâche ouvre l'écran et place le focus sur le champ, comme la liste des manques de la campagne. **Aucun calque superposé** | Une visite en surimpression contredirait le principe suivant du même guide (« sans fenêtres superposées ») et la charte (pas de calques décoratifs) |
| **Aide contextuelle liée à l'action** | Les popups et les survols qui interrompent | Déjà en place : aides sous les libellés, avertissement de coordonnées dans le champ. À doser (U22, U48) | Les info-bulles au survol restent exclues : invisibles au toucher, fragiles au clavier |
| **Personnaliser le parcours** : masquer ce qui ne sert pas | La surcharge de choix | Les deux portes le font déjà ; formats filtrés par réseau dans le profil marque, comme dans le profil créateur (U23, `03` C5) | Aucun matching ni recommandation (D11) : on filtre par les réponses de l'utilisateur, jamais par un score |
| **Respecter le modèle mental**, laisser le contrôle | La méfiance née d'un comportement inattendu | Garder l'explication de la connexion sans mot de passe (D37) ; supprimer les actions implicites (U03, U32) | La connexion par code est un choix d'architecture (D37, D43) : on l'explique, on ne la change pas |
| **Éviter l'aveuglement par l'objectif** : ne pas imposer de prérequis secondaires sur le chemin du but | L'abandon devant un obstacle inattendu | Annoncer tôt les prérequis de la marque neuve et leur délai ; laisser préparer ce que les règles permettent ; **soumettre au product-owner** l'idée d'autoriser un brouillon de campagne avant la publication du profil (U59, `03` B7) | Le verrou actuel découle d'un critère d'acceptation (CA2) et du courtage : seule une décision écrite peut le lever |
| **Une chose par écran** | La surcharge cognitive | Grouper par sujet l'écran 3 de l'inscription ; séparer, dans le profil créateur, présentation publique et identité légale (U62, U30) | Découper un écran de 6 champs en deux ajoute une étape : on groupe d'abord, on ne découpe que si un test le justifie |
| **Formulaire d'inscription** : noms longs, verbes d'action | Les blocages de saisie, les boutons vagues | Noms déjà conformes ; libellés « Valider » et « Soumettre » à remplacer (U63, `03` C13) | — |

## 6. Guide interne : espacement, animation, stratégie d'onboarding

### 6.1 Grille de 8 px et méthode « de l'extérieur vers l'intérieur » (`02.md`)
- **Problème traité** : des espacements choisis au jugé, qui brouillent les regroupements.
- **Principe** : une échelle fixe (4, 8, 16, 24, 32 px) et une hiérarchie en 5 niveaux où
  l'espacement **diminue** de l'extérieur vers l'intérieur : enveloppe 24 px, sections 32 px, titre
  → contenu 24 px, éléments d'un groupe 16 px, rembourrage de carte 16 px (8 si dense), boutons
  côte à côte 8 px, **6 px au minimum** entre deux éléments.
- **Intérêt pour INFLUX** : c'est la règle qui manquait pour expliquer la lourdeur des listes de
  cartes, où l'espacement croît vers l'intérieur (U64), et les badges trop serrés (U65).
- **Adaptation** : l'échelle existante convient (grille de 4 px, paliers en multiples de 8). On
  applique l'ordre décroissant par composant (`04` §3) : cartes compactes à 16 px de rembourrage,
  listes à 16 px d'écart, 8 px au moins entre une icône et son libellé.
- **Limites** : la gouttière de 16 px sur téléphone reste en deçà des 24 px de la fiche. C'est un
  écart volontaire, qui laisse de la largeur aux champs et aux cartes. Le guide cite Figma et
  l'Auto Layout : chez INFLUX, ce rôle revient aux tokens et aux primitives.

### 6.2 Les 5 techniques d'animation web (`03.md`)
- **Problème traité** : rendre une interface vivante avec peu de techniques.
- **Principe** : suivi du défilement, détection de la fenêtre d'affichage, position collante,
  courbes d'assouplissement, découpage du texte, avec GSAP, Framer Motion et un défilement fluide
  (Lenis).
- **Intérêt pour INFLUX** : deux techniques servent un outil de travail. La **position collante**
  sert l'orientation (colonne de décision, barres d'action) ; les **courbes d'assouplissement**
  font la finition, et INFLUX en a déjà deux par tokens.
- **Adaptation** : généraliser `sticky` là où il oriente ; garder les courbes existantes, sans
  rebond.
- **Limites** : la fiche vise des sites de présentation. Le défilement simulé casse
  l'accessibilité (focus masqué par les barres collantes, clavier) ; l'apparition au défilement
  retarde la lecture ; le découpage du texte gêne les lecteurs d'écran. Ces techniques ne sont
  envisageables que sur la vitrine (D59). Aucune bibliothèque n'est justifiée (`01` §11.2).

### 6.3 Recommandation stratégique d'onboarding (`04.md`)
- **Problème traité** : le même que `01.md`, présenté en diagnostic puis en feuille de route en
  5 jalons, avec des spécifications d'interface (espacement, animation).
- **Apports propres** :
  - **immersion immédiate dans le premier workflow**, ce qui conforte D86 ;
  - **visualisation du succès**, à porter par les aperçus qui existent déjà (« Ce que voit un
    créateur », « Les marques voient… ») ;
  - **retours contextuels en temps réel**.
- **Adaptation** : checklist d'activation qui inclut « voir son profil ou sa campagne comme
  l'autre partie la verra » (`03` B6). Temps réel pour les retours positifs ; erreurs au départ
  du champ seulement.
- **Limites** :
  - « inviter des collaborateurs » est sans objet au MVP (comptes individuels) ;
  - la vidéo de bienvenue est écartée, comme la fiche elle-même y invite (vidéos sautées) ;
  - les shaders et les animations de curseur relèvent de la vitrine au mieux.
