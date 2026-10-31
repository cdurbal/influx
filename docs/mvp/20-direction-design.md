# Direction design — références, principes et zone de saisie des apartés

> **Date :** 2026-09-24, **révisé le 2026-10-28 (D73, charte KEO Emerald des espaces connectés)** ·
> **Auteur :** `expert-ux`
> **Skills appliquées :** `design-system-influx` (tokens, registres, accessibilité),
> `messaging-spec` (apartés, par renvoi), `backoffice-ops` (niveaux de confirmation, par renvoi).
>
> **Ce que ce document produit :** la **carte des références de comportement** par surface, les
> **sept principes** propres à INFLUX qu'aucune référence ne fournit, les **niveaux de
> confirmation** des actions, la **règle de provenance des montants**, la **conception UX des
> apartés** (D47), les **angles morts** du dark theme et, depuis D73, la **charte KEO Emerald des
> espaces connectés** (§11 : correspondance des tokens, contrastes, typographie, ce qu'on ne prend
> pas de la maquette, test du logo, inventaire des composants).
>
> **Ce qu'il ne tranche pas :** les valeurs de la vitrine (**D6 et D59 ne sont pas rouvertes**) ;
> celles des espaces connectés viennent de la maquette choisie par le fondateur (D73, §11), les règles de
> gestion des apartés (additif de `12`, à écrire par `product-owner` **sous veto
> d'`expert-conformite-rgpd`**), les écrans déjà détaillés dans `17` et `17b`, qui priment pour
> leur périmètre. **Ce document cite les règles, il ne les réécrit pas.**
>
> **Statut :** proposition d'`expert-ux`, qui s'applique dès maintenant aux spécifications.
> **Arbitrages du fondateur du 2026-09-24** sur Q1 à Q5 (§9) : les cinq recommandations sont
> retenues. Elles sont reportées dans `CLAUDE.md` (§3, §4, D6, D47, **D58**, **D59**),
> `12` (§K) et `17b` (§0, M4). **Décision du fondateur du 2026-10-28 (D73)** : charte KEO Emerald
> pour les espaces membres et le backoffice, menu à gauche sur desktop façon Railway (§11, §3).
>
> **Source de vérité :** `CLAUDE.md`. En cas d'écart, `CLAUDE.md` prime.

---

## 1. La règle de méthode : emprunter des comportements, jamais des styles

Linear, Stripe, Intercom, Airbnb ou Raycast ont chacun un langage visuel propre (gris froids,
violet, bleu arrondi, monochrome, natif macOS). Assemblés au niveau du **style**, ils donnent un
produit patchwork. Assemblés au niveau du **comportement** — une file triable au clavier, une
chronologie d'affaire, une zone de saisie qui change d'audience —, ils donnent un produit
cohérent.

| On emprunte | On n'emprunte jamais |
|---|---|
| Un geste, un enchaînement, une organisation de l'information, un état d'écran | Une couleur, une police, un rayon, une ombre, une icône, une illustration |

**Le style vient d'une seule source :** `packages/ui/src/styles/tokens.css` (D6), plus l'extension
`tokens-backoffice.css` (`17b` §6.5). Depuis D73, les mêmes noms de rôle portent deux jeux de
valeurs selon le registre : vitrine (D6, D59) et espaces connectés (KEO Emerald, §11.3).

**Test en revue :** *sans le logo, reconnaît-on INFLUX, ou la référence ?* Un écran où l'on
reconnaît Linear est refusé, même s'il n'utilise que des tokens.

---

## 2. Trois registres visuels

Rappel de `17` §1.1 et `17b` §0, qui les fondent. Un composant n'est jamais partagé entre
registres sans vérifier qu'il respecte les règles du registre d'arrivée.

| Registre | Utilisateur et contexte | Densité | Référence de largeur | Charte (D73) |
|---|---|---|---|---|
| **Vitrine** (page d'accueil publique, pages légales publiques, 404 et erreurs de niveau `[locale]`, bandeau cookies) | Visiteur, 10 secondes pour comprendre | Respiration généreuse, un bouton principal par section | Mobile 375 et desktop 1440 | Valeurs D6, direction D59 |
| **Espaces membres** (espaces marque et créateur, parcours d'inscription et de connexion, texte des CGU affiché dans le parcours — §11.1) | Créateur **sur mobile, debout, en 4G** ; marque au bureau | Mobile-first, une décision par écran sur mobile, cibles de 2,75 rem | Mobile 375 (conception), desktop 1440 | **KEO Emerald** (§11) |
| **Backoffice** | Commercial, huit heures par jour | Dense : tableaux, lignes de 36 px, raccourcis | ≥ 1280 px ; de 768 à 1023 px, backoffice complet, navigation en liste horizontale ; sur téléphone, vue limitée à deux gestes, conversation et file (D58), et aucun contenu métier sous 768 px tant qu'elles n'existent pas (`17b` §1.7) | **KEO Emerald** (§11) |

---

## 3. Carte des références par surface

Chaque ligne dit **ce qu'on prend** et, aussi important, **ce qu'on ne prend pas**.

| Surface | Référence de comportement | Ce qu'on prend | Ce qu'on ne prend pas | Spécifié dans |
|---|---|---|---|---|
| **Landing** | wekollab.fr (fonction des blocs) ; Vercel (grille de sobriété) | Compréhension en 10 s, deux portes d'entrée, un bouton principal par section, animations courtes à l'entrée | Le monochrome sans visages : INFLUX vend une relation humaine, pas un outil de développeur | `docs/landing-page/02` ; direction d'effets : D59 |
| **Espace créateur** (mobile) | Les statistiques pro d'Instagram et de TikTok ; Malt | La **forme et le vocabulaire** des chiffres d'audience que le créateur lit déjà chaque jour ; la candidature courte ; la complétude de profil | La complétude gamifiée (pourcentage flatteur) : elle reste **factuelle** (`07` RG90) | `17` §5 |
| **Recherche côté marque** | Airbnb | Filtres + liste + fiche ; **l'emplacement approximatif avant réservation, exact après** = les tranches avant la révélation ; badges de confiance | La photo, le compteur exact de résultats, le contact direct (`17` §1.2) | `17` §4.4, §7.1 |
| **Double acceptation et révélation** | L'invitation LinkedIn ; le « match » réciproque | Accepter ou décliner une proposition nommée ; révélation **simultanée** à la seconde acceptation (D45) | Le ton ludique, l'animation festive, le geste de balayage | `17` §7.2 |
| **Messagerie, côté membres** | Messageries grand public (bulles) ; Slack Connect | Des bulles familières ; **l'organisation écrite à côté de chaque nom** | La palette WhatsApp, les pièces jointes libres, les liens cliquables (`12` RG36, RG41) | `17` §4.7 ; apartés : §7 |
| **Messagerie, côté commercial** | Intercom, Front | La zone de saisie qui **bascule visiblement** entre « répondre » et « note interne » ; attribution et délai visibles | Les réponses automatiques : le commercial écrit lui-même, nommé | `17b` §3.4.b ; apartés : §7 |
| **Files du backoffice** | Linear | File au clavier (`j`/`k`), filtres en puces, statuts écrits, détail sans perdre la file | Les gris très pâles (sous le contraste AA) ; le tri individuel : INFLUX partage ses files avec **verrou de prise en charge** | `17b` §4.1, §4.2, §4.11 |
| **Affaires et pipeline** | Pipedrive ou Attio (pipeline) ; Stripe (montants) | Colonnes par étape, fiche + fil d'activité ; chiffres tabulaires, devise écrite, chronologie, badges sobres | La **décomposition calculée** montant → frais → net ; tout pourcentage | `14`, `17b` ; §6 ici |
| **Actions rapides** | Raycast | `⌘K` partout, action sans changer d'écran, raccourci affiché dans le libellé du bouton | L'exécution sans confirmation : voir les trois niveaux, §5 | `17b` §1.5, §4.11 |
| **Navigation des espaces connectés** (desktop) — *D73, 2026-10-28* | Railway (tableau de bord ; observé dans le produit, la documentation publique ne décrit pas la barre latérale) | Colonne **fixe à gauche, pleine hauteur, à filet**, qui défile seule ; **en-tête de colonne qui dit où l'on est** ; items **icône + libellé** sur une ligne, état actif par surface remplie ; **pied de colonne** (aide, compte) ; pages d'une rubrique en **sous-menu de la colonne**, ouvert sur la rubrique active (D74, 2026-10-29 ; amende D73, qui les plaçait en liens en tête de contenu) ; au backoffice, `⌘K` et « `g` puis touche » | Le **sélecteur** d'espace de travail, de projet ou d'environnement (un rôle par compte, D41 ; au backoffice l'environnement est un marqueur écrit, jamais un sélecteur) ; le **repli en icônes** (libellés obligatoires, `17` §2.2 ; aucun stockage pour mémoriser un repli, D37) ; l'**accent violet** de Railway (le violet est réservé à la vue identifiée, `17b` §6.2) ; l'esthétique développeur (monospace partout, canevas) ; les actions révélées au seul survol | `17` §2.2, §2.3 ; `17b` §1.7 ; §11 |

### 3.1 Références écartées, et pourquoi

| Référence | Pourquoi elle n'est pas un modèle |
|---|---|
| **Discord** pour la messagerie | Registre communautaire, alors qu'il s'agit d'une négociation qui fait preuve. Rôles portés par la couleur du pseudo, ce que `12` RG7 interdit. Écrire dans le mauvais salon y est l'erreur classique : avec les apartés, c'est un incident |
| **Stripe** pour la logique des montants | Stripe affiche de l'argent **calculé**. Au MVP, l'application ne calcule rien et n'affiche aucun taux (`CLAUDE.md` §2, D48) : reprendre sa décomposition suggère un calcul et invite à le « compléter » |
| **Vercel** comme modèle visuel de la landing | Il vend à des développeurs, presque sans visages. La landing, déjà réalisée et seul code conservé (D44), a pris une autre direction, choisie par le fondateur (carte métallisée, le 2026-09-17) |
| **Spotify** comme modèle visuel des espaces connectés | La maquette KEO s'en dit inspirée. Le fondateur en a retenu la **palette et les formes** (D73), pas la ressemblance : halo, ombre lumineuse du bouton, agrandissement au survol et soulèvement gardés par le fondateur, panneaux flottants autorisés là où ils sont pertinents (jugement `expert-ux`, écran par écran) (F6, 2026-10-29, §11.5). Test du logo appliqué : §11.7 |

**Concurrents.** wekollab.fr reste la référence officielle de finition (`CLAUDE.md` §1). `17` §1.2
consulte aussi Malt, Upwork et Kolsquare pour les places de marché à deux faces. Un concurrent
sert à comprendre les conventions du métier, jamais à en copier l'apparence.

---

## 4. Sept principes propres à INFLUX

Aucune référence ne les fournit : ils viennent du modèle de place de marché courtée.

| # | Principe | Pourquoi | Vérification en revue | Règles liées |
|---|---|---|---|---|
| **P1** | **Emprunter des comportements, jamais des styles** | Un produit cohérent plutôt qu'un patchwork | Aucune valeur hors tokens ; test du logo (§1) | D4, D6 |
| **P2** | **Chaque zone de saisie annonce qui lira le message** | Avec le fil commun, deux apartés et la note interne, le commercial a **quatre audiences** dans un seul écran | La phrase d'audience nomme les lecteurs, est visible sans interaction et change avec le canal | `17b` §3.4.b ; §7 |
| **P3** | **Chaque montant dit qui l'a saisi et quand** | Au MVP, rien n'est calculé : un montant sans auteur ressemble à un résultat de calcul | Aucun montant sans auteur et date au backoffice ; aucun taux ; aucun montant déduit d'un taux | `CLAUDE.md` §2, `14` RG73 ; §6 |
| **P4** | **La révélation est un moment, pas un changement d'état** | C'est l'instant le plus sensible du produit et le fait générateur de la créance | Écran plein, humain nommé, horodatage affiché ; jamais une carte qui se dévoile en rafraîchissant une liste | D45, `17` §7.2 |
| **P5** | **Le commercial est une personne** | Son métier *est* le produit ; un logo ne négocie pas | Partout où il agit : « Prénom — INFLUX », rôle écrit, photo **facultative, au choix de l'agent** (sinon initiales) ; jamais signé « l'équipe » dans une mise en relation | `12` RG5, RG7 |
| **P6** | **Le délai est promis et visible** | Un délai affiché puis tenu construit la confiance ; un silence la détruit | Tout état d'attente dit **qui** doit agir et **avant quand** | D39, D45, D49, `10` RG52 |
| **P7** | **La couleur ne porte jamais seule une information** | Daltonisme, impression, capture recadrée | Chaque état a un texte ou une forme ; la couleur ne fait que renforcer | `CLAUDE.md` §4 |

---

## 5. Trois niveaux de confirmation

Raycast confirme le moins possible. Chez INFLUX, presque tout est journalisé et beaucoup d'actions
sont visibles d'un membre. Le niveau dépend de la **portée** de l'action, pas de sa fréquence.

| Niveau | Portée | Exemples | Traitement |
|---|---|---|---|
| **1. Réversible** | Rien ne sort de l'écran de l'agent | Prendre en charge ou relâcher une entrée, filtrer, trier, préparer un brouillon | Immédiat, avec **« Annuler »** pendant quelques secondes quand l'action a un inverse. Raccourci autorisé |
| **2. Engageant** | Une affaire, un ou deux membres prévenus | Valider une demande, refuser avec motif typé, relancer, proposer une campagne à un créateur, changer l'état d'une affaire | **Récapitulatif en ligne qui dit qui sera prévenu**, confirmation par `‹Entrée›`. Raccourci autorisé pour ouvrir, jamais pour exécuter sans récapitulatif |
| **3. Irréversible, de masse ou touchant un droit** | Plusieurs membres, un droit, ou l'extérieur | Envoi d'e-mails à un segment (`16`), proposition à plusieurs créateurs d'un coup, retrait de badge (D51), suspension, clôture de fil, export | **Panneau de confirmation dédié** qui dit *qui verra quoi*, jamais par raccourci (`15` RG115), double validation là où la règle l'exige |

Côté membres, l'acceptation qui révèle les identités est de niveau 3 : c'est déjà un écran plein
(`17` §7.2).

---

## 6. Montants : la règle de provenance

Au MVP, le commercial **saisit** le montant négocié et la commission convenue ; l'application les
enregistre et les additionne, **elle ne les déduit jamais d'un taux** (`CLAUDE.md` §2). `14` RG73
met déjà l'historique dans la fiche d'affaire. Ce document demande en plus que **l'origine figure à
côté de chaque valeur**, sans ouvrir l'historique.

```
┌ Montants de l'affaire ──────────────────────────────────────────────────────┐
│ MONTANT NÉGOCIÉ          2 400,00 EUR   saisi par Thomas D. · 12/09 14 h 20  │
│ COMMISSION CONVENUE        650,00 EUR   modifié par Marie L. · 15/09 · 2 versions │
│ COMMISSION ENCAISSÉE     non renseigné                                       │
│                                          [· Historique des montants ‹h›]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Règle | Détail |
|---|---|
| Libellés | Les trois de `17b` §0, jamais interchangeables, en `text-xs` capitales |
| Valeur | Chiffres tabulaires, montant et devise **insécables**, format de la langue de l'agent |
| Provenance | `text-xs`, `color-text-tertiary`, à droite de la valeur : auteur, date, nombre de versions s'il y en a plusieurs |
| Plusieurs encaissements | « somme de ⟨n⟩ encaissements · dernier saisi par ⟨agent⟩ le ⟨date⟩ » |
| Sommes du tableau de bord | **Par devise**, jamais de total toutes devises ; chaque somme est un lien vers les affaires qui la composent |
| Interdits | Tout pourcentage, toute ligne « net », tout montant déduit d'un taux (`15` RG4, RG5) |

Côté membres, **aucun montant de commission ni net estimé** pendant le pilote (D48) : la commission
est « incluse, précisée par votre commercial ».

---

## 7. Les apartés (D47) : conception de l'interface

### 7.1 Cadre

Les règles sont dans l'additif de `12`, **§K (RG113 à RG146)**, qui prime sur cette section. En
résumé : chaque partie a un canal privé avec les agents de la conversation, qu'elle peut ouvrir
elle-même ; l'autre partie n'en voit **ni le contenu ni l'existence**, même par un compteur ; **aucun
message ne passe d'un canal à l'autre** ; tous les agents participants lisent les deux apartés,
chaque lecture étant journalisée ; en pause ou après un blocage, le fil commun se ferme aux parties
mais les apartés restent ouverts ; le mot « privé » veut dire « non visible de l'autre partie », pas
« lu par le seul commercial » (RG142) ; ce qu'une partie confie en aparté n'est jamais rapporté à
l'autre sans son accord (RG122, Q12 tranchée le 2026-09-24), et le lien « Qui peut lire cet
échange ? » le dit (RG141).

Cette section conçoit **l'interface** qui rend ces règles impossibles à mal comprendre.

### 7.2 Le principe : on écrit là où on lit

L'erreur à rendre impossible : **écrire à la marque ce qu'on croyait réservé au créateur**. Trois
décisions la préviennent.

1. **Le canal affiché est le canal d'envoi.** Il n'y a pas de sélecteur d'audience séparé, qui
   pourrait diverger de ce que l'on lit : changer d'audience, c'est changer d'onglet.
2. **Le brouillon appartient à son canal.** Un texte commencé dans un aparté y reste quand on change
   d'onglet ; il ne suit jamais l'utilisateur vers un autre canal. L'onglet qui contient un
   brouillon le signale par une icône et le mot « brouillon ». C'est l'application, à la saisie, du
   principe « aucun message ne passe d'un canal à l'autre ».
3. **La zone de saisie nomme ses lecteurs** (P2), et **le bouton d'envoi nomme l'exception** :
   « Envoyer » dans le fil commun, « Envoyer en privé » ou « Envoyer à ⟨partie⟩ seulement » dans un
   aparté.

### 7.3 Côté membre

```
Mobile 375 — onglet privé ouvert
┌───────────────────────────────────────────┐
│ [◁]  MER-2026-000123 · Rentrée beauté     │  en-tête permanent (17 §4.7),
│      Marque Alpha · Thomas — INFLUX       │  inchangé
├───────────────────────────────────────────┤
│ À trois │ [i:lock] Vous et INFLUX · 2 │ Documents │  onglets : libellé écrit,
│         └━━━━━━━━━━━━━━━━━━━━━━━━━━━━┘            │  non-lus en chiffres
├───────────────────────────────────────────┤
│ [i:lock] Échange privé avec INFLUX.       │  bandeau fixe, ne défile pas
│ Marque Alpha ne voit pas ces messages.    │  jamais « seuls vous et… »
│ Suivi par : Thomas — INFLUX               │  (12 RG142)
│            [· Qui peut lire cet échange ?] │
├───────────────────────────────────────────┤
│ ┌─────────────────────────┐               │
│ │ Thomas — INFLUX [INFLUX]│               │  bulle agent de 17 §4.7
│ │ Quel est votre tarif    │               │
│ │ plancher pour 2 reels ? │               │
│ │ 10 h 12                 │               │
│ └─────────────────────────┘               │
│               ┌─────────────────────────┐ │
│               │ Vous                    │ │  bulle « moi », à droite
│               │ 900 EUR, pas en dessous.│ │  aucun accusé de lecture
│               │ 10 h 20                 │ │  dans un aparté
│               └─────────────────────────┘ │
├───────────────────────────────────────────┤
│ [i:lock] Lu par Thomas — INFLUX.          │  phrase d'audience, toujours
│ Marque Alpha ne le verra pas.             │  visible, au-dessus du champ
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │  cadre 2 px
│ ┃ Écrire en privé à INFLUX…             ┃ │  color-chat-private-border
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                     [■ Envoyer en privé]  │
└───────────────────────────────────────────┘
```

| Élément | Décision |
|---|---|
| Libellé de l'onglet | **« Vous et INFLUX »**, pas le prénom de l'agent : longueur stable, et juste quand plusieurs agents participent (`12` RG116). Les prénoms figurent dans le bandeau et la phrase d'audience |
| Bandeau | Fixe en tête du canal : icône cadenas, phrase qui nomme l'autre partie, **agents participants actifs nommés** (`12` RG129). Lien « Qui peut lire cet échange ? » vers le sixième point de l'information sur la supervision (`12` RG141). **Jamais « seuls vous et … »** : un autre agent peut lire avec motif (`12` RG142) |
| Onglet « À trois » | Aucune trace d'un aparté donné : ni message système, ni compteur, ni mention (principe 1 de l'additif) |
| Notifications | « ⟨Prénom⟩ — INFLUX vous a écrit en privé », sans le texte (`12` RG90) |

### 7.4 Côté commercial

```
┌ MER-2026-000118 · Conversation ──────────────────────────────────────────── ▮ ┐
│ ⟨raison sociale⟩  ·  ⟨alias⟩ / ⟨nom réel⟩  ·  INFLUX ⟨Prénom Nom⟩ (vous)       │  17b §3.4.b
├────────────────────────────────────────────────────────────────────────────────┤
│ À trois · 0 │ [i:lock] ⟨raison sociale⟩ · 1 │ [i:lock] ⟨alias⟩ ✎ brouillon │ Documents │
├────────────────────────────────────────────────────────────────────────────────┤
│ [i:lock] APARTÉ AVEC ⟨raison sociale⟩ — ⟨alias⟩ ne voit ni ces messages       │
│ ni leur existence.                                                             │
├────────────────────────────────────────────────────────────────────────────────┤
│  ⟨raison sociale⟩ · 13/09 11 h 02                                              │
│  ┌───────────────────────────────────────┐                                     │
│  │ ⟨texte brut⟩                           │                                     │
│  └───────────────────────────────────────┘                                     │
│                INFLUX · ⟨Prénom Nom⟩ · 13/09 11 h 10                           │
│              ┌───────────────────────────────────────┐                         │
│              │ ⟨texte brut⟩                           │                         │
│              └───────────────────────────────────────┘                         │
├────────────────────────────────────────────────────────────────────────────────┤
│ [i:lock] Envoyé à ⟨raison sociale⟩. ⟨alias⟩ ne le verra pas.                   │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃                                                                            ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│ [· Note interne sur l'affaire ‹n›]      [■ Envoyer à ⟨raison sociale⟩ seulement] │
└────────────────────────────────────────────────────────────────────────────────┘
```

| Élément | Décision |
|---|---|
| Onglets | Quatre, **toujours dans cet ordre** : À trois · aparté marque · aparté créateur · Documents. Non-lus en chiffres, brouillon signalé par écrit |
| Alignements | Ceux du fil commun (`17b` §3.4.b) : **marque à gauche, créateur à droite, INFLUX centré**. Dans un aparté, le côté de la bulle suffit à dire avec qui l'on parle |
| Note interne | Reste une affordance **séparée** du canal (`17b` §3.4.b, `15` RG46), avec sa propre phrase : « Note interne — lue par l'équipe INFLUX seulement, jamais par les membres » |
| Clavier | Passage d'onglet par les flèches dans la liste d'onglets (motif ARIA standard). **Aucun raccourci n'envoie dans un autre canal que celui affiché** |
| Lecture journalisée | Inchangée : l'ouverture d'un aparté par un agent non participant passe par « Lire ce fil (lecture journalisée) » (`17b` §3.4, `12` RG55) |

### 7.5 Trois porteurs pour une seule information

| Porteur | Fil commun | Aparté |
|---|---|---|
| **Texte** | « Lu par ⟨A⟩ et ⟨B⟩ » | Bandeau + « Lu par ⟨X⟩. ⟨Y⟩ ne le verra pas. » + bouton « Envoyer en privé » |
| **Forme** | Champ à filet fin | Icône cadenas dans l'onglet, le bandeau et la phrase ; **cadre de 2 px** autour du champ |
| **Couleur** (renfort seulement) | Surface de page | `color-chat-private-surface` sous les messages, `color-chat-private-border` autour du champ |

Le texte et la forme survivent à une capture recadrée ou à une impression ; la couleur ne fait que
renforcer (P7).

### 7.6 États

| État | Côté membre | Côté commercial |
|---|---|---|
| Aparté vide | Onglet toujours présent, le membre peut écrire le premier (Q1, tranchée) : invite propre au rôle (§7.7) | Invite « Écrivez à ⟨partie⟩ seulement. ⟨autre partie⟩ ne le saura pas. » |
| Chargement, erreur d'envoi, hors ligne | Ceux du fil commun (`17` §4.7) : le message non envoyé reste dans **son** canal, jamais perdu | Idem |
| Fil en pause | Fil commun fermé, avec un encart qui **renvoie vers l'onglet privé** ; l'aparté reste ouvert (`12` RG123) | Les agents écrivent dans tous les canaux |
| Blocage entre parties | Fil commun fermé aux deux parties ; l'aparté reste ouvert (`12` RG126) | Médiation par les apartés |
| Fil clos ou archivé | Le même encart dans tous les onglets, aucune écriture (`12` RG123) | Idem |

### 7.7 Microcopies

Clés proposées ; formulations neutres en genre. Côté backoffice, préfixe `bo.conversation.private.*`
avec les mêmes textes adaptés.

| Clé | Français | English |
|---|---|---|
| `chat.channel.common.tab` | À trois | All three |
| `chat.channel.private.tab` | Vous et INFLUX | You & INFLUX |
| `chat.channel.private.banner` | Échange privé avec INFLUX. {otherParty} ne voit pas ces messages. | Private conversation with INFLUX. {otherParty} can't see these messages. |
| `chat.channel.private.followedBy` | Suivi par : {agentNames} | Followed by: {agentNames} |
| `chat.channel.private.whoCanRead` | Qui peut lire cet échange ? | Who can read this conversation? |
| `chat.composer.audience.common` | Lu par {otherParty} et {agentNames}. | Read by {otherParty} and {agentNames}. |
| `chat.composer.audience.private` | Lu par {agentNames}. {otherParty} ne le verra pas. | Read by {agentNames}. {otherParty} won't see it. |
| `chat.paused.privateHint` | La conversation est en pause. Vous pouvez toujours écrire en privé à INFLUX. | This conversation is paused. You can still write privately to INFLUX. |
| `chat.composer.placeholder.private` | Écrire en privé à INFLUX… | Write privately to INFLUX… |
| `chat.composer.send.private` | Envoyer en privé | Send privately |
| `chat.channel.draftMarker` | brouillon | draft |
| `chat.channel.private.empty.advertiser` | Dites ici à INFLUX ce que vous ne direz pas devant le créateur : votre budget maximum, une hésitation, une question. | Tell INFLUX here what you'd rather not say in front of the creator: your top budget, a doubt, a question. |
| `chat.channel.private.empty.creator` | Dites ici à INFLUX ce que vous ne direz pas devant la marque : votre tarif plancher, une hésitation, une question. | Tell INFLUX here what you'd rather not say in front of the brand: your lowest rate, a doubt, a question. |
| `chat.notification.private` | {agentName} — INFLUX vous a écrit en privé | {agentName} — INFLUX sent you a private message |

### 7.8 Accessibilité

- Onglets en `tablist` / `tab` / `tabpanel`, avec le nombre de non-lus et la mention « brouillon »
  dans le nom accessible de l'onglet.
- Phrase d'audience reliée au champ par `aria-describedby` : un lecteur d'écran l'entend à chaque
  entrée dans le champ.
- Au changement d'onglet, annonce `aria-live="polite"` : « Vous écrivez maintenant à : ⟨lecteurs⟩ ».
- Cadre de 2 px `color-chat-private-border` (valeurs KEO, D73) : 4,96:1 sur `surface-page`, 4,66:1
  sur `surface-muted` et `surface-card` (même valeur), 4,28:1 sur `surface-raised` (≥ 3:1 exigé pour
  un composant d'interface) ✅.

---

## 8. Angles morts du dark theme

| Sujet | Risque | Action | Qui | Quand |
|---|---|---|---|---|
| **Logos de marques** | Dessinés pour fond blanc, ils disparaissent sur fond noir | Tout logo déposé s'affiche sur une pastille claire, alias `color-logo-plate` (§10) | `expert-ux` | Lot 2 (profil marque) |
| **E-mails** | Les clients de messagerie inversent les couleurs à leur manière ; le code de connexion (D43) doit rester lisible partout | Gabarit d'e-mail propre, testé en clair et en sombre dans les principaux clients | `expert-marketing` + `expert-integrations-api` | Lot 1 |
| **Lecture en extérieur** | Un fond sombre se lit moins bien en plein soleil, cas typique du créateur | Test des écrans créateur **dehors, sur un vrai téléphone** | `testeur` + `expert-ux` | Recettes des Lots 2 et 6 |
| **Gris pâles** | Les références « premium » descendent sous le contraste AA | Plancher : `color-text-tertiary`, réservé aux aides et mentions | Revue `expert-ux` | Permanent |
| **Vert d'action / vert de succès** | Un badge « Acceptée » vert ressemble à un bouton | Séparés dans les tokens (succès en sarcelle) ; `CLAUDE.md` §4 aligné le 2026-09-24 (Q5) | Fondateur | Fait |
| **Maquette** | La messagerie de la maquette reprend la palette de WhatsApp Web, en dur : l'écran central du modèle ressemble à une autre marque devant les partenaires | À corriger si `chef-de-projet` juge que cela fausse la vision présentée (`CLAUDE.md` §12) | `chef-de-projet` | Avant les démonstrations |
| **Émeraude et sarcelle** *(D73)* | Le vert KEO `#1dd68a` (teinte 155°) n'est qu'à 17° de la sarcelle de succès `#2dd4bf` (172°), contre 28° avec le vert de la vitrine | **Tranché le 2026-10-28** : sous KEO, succès `#3ccfcf` (180°, écart 25°), valeur de la palette KEO ; seuil de 20° vérifié par la garde G3d ; la forme reste un second séparateur (le plein est réservé à l'action) (§11.3) | `expert-ux` | Fait |
| **Ressemblance avec Spotify** *(D73)* | Vert vif sur noir et pilules : on reconnaît la référence avant INFLUX | Halo, ombre lumineuse du bouton, agrandissement et soulèvement gardés, panneaux flottants si pertinents (F6, fondateur, 2026-10-29) ; signatures INFLUX mises en avant (§11.7) | `expert-ux` | Jalon DS |
| **Deux verts de marque** *(D73)* | Vitrine `#29e075`, espaces `#1dd68a`, sur deux écrans consécutifs (porte, puis inscription) | **Tranché le 2026-10-29 (F2)** : un seul vert, `#1dd68a`, vitrine comprise (commit DS-14, revue visuelle D59) | Fondateur | Fait |
| **Polices sur 4G** *(D73)* | Deux familles web au lieu de la police système : poids au premier affichage, saut de mise en page | Fichiers variables auto-hébergés, sous-ensembles latins, métriques de repli ajustées, chargés par les seuls gabarits KEO (§11.5) ; poids mesuré au jalon | `dev-react-node` + `expert-ux` | Jalon DS |

---

## 9. Questions ouvertes

| # | Question | Recommandation | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | Un membre peut-il **ouvrir lui-même** l'aparté ? | **Tranchée (fondateur, 2026-09-24) : oui.** L'onglet est toujours présent pour les deux parties. C'est là que se dit ce qu'on ne dit pas devant l'autre, qui est la valeur d'un courtier ; et un onglet toujours présent ne révèle l'existence d'aucun aparté donné. Reste à écrire en règles dans l'additif de `12` | `product-owner`, veto `expert-conformite-rgpd` | Avec l'additif de `12` |
| **Q2** | Un aparté est-il lu par **tous les agents participants**, ou par le seul commercial responsable ? | **Tranchée (fondateur, 2026-09-24) : tous les agents participants**, chaque lecture journalisée : un commercial qui reprend l'affaire doit lire l'historique. Écrite en `12` RG116 et RG130 | — | Fait |
| **Q3** | Faut-il une **vue mobile minimale du backoffice** ? `17b` M4 l'écarte sous 1024 px. Or le commercial participe à chaque conversation, avec un délai d'un jour ouvré, et le métier se fait aujourd'hui en déplacement | **Tranchée (fondateur, 2026-09-24) : oui — D58.** Limitée à deux gestes : lire et répondre dans une conversation dont on est participant ; prendre en charge, valider ou refuser dans la file. Le reste du backoffice reste un poste de travail. Restent : les conditions de session sur téléphone, puis les écrans en additif de `17b` | `architecte` + `expert-cybersecurite` (session, second facteur), puis `expert-ux` | Conditions avant le Lot 4 |
| **Q4** | Direction visuelle de la landing : **carte métallisée premium** (actuelle) ou **sobriété façon Vercel** ? | **Tranchée (fondateur, 2026-09-24) : oui — D59.** La direction actuelle est conservée, avec un **budget d'effets** : un seul effet spectaculaire par écran visible. Reste la revue visuelle de la page rendue, pour appliquer ce budget | `expert-ux` | Avant la mise en ligne du Lot 1 |
| **Q5** | Aligner `CLAUDE.md` §4, qui présente le vert comme couleur « d'accent, d'action et de succès », alors que les tokens donnent au succès sa propre teinte | **Tranchée (fondateur, 2026-09-24) : oui.** `CLAUDE.md` §4 et D6 alignés : le vert est la couleur de marque et d'action, le succès a sa propre teinte (sarcelle) | — | Fait |
| **Q6** | Un **mode clair** pour les espaces membres, plus tard ? | Pas au MVP. Garder des tokens nommés par rôle pour ne pas le rendre coûteux ; décider après le pilote, au vu des tests en extérieur (§8) | Fondateur | Après le pilote |

---

## 10. Tokens proposés

> **Rouge « danger » opaque (D72, D72).** Aucun rouge translucide ni
> teinté en fond (`rgba`, `hsla`, `#rrggbbaa`, `color-mix`, modificateur `/NN`). Une erreur ou un avertissement
> destructif = fond du conteneur + bordure rouge pleine 1 px + icône + texte rouge opaque ; une action
> destructive = bouton rouge plein, texte clair. Tokens, à l'identique dans `apps/web` et `apps/backoffice` :
> `feedback-error-text` et `-icon` `#ec5d5e`, `feedback-error-border` et `border-error` `#e5484d`,
> `feedback-error-bg` `transparent`, `action-danger-bg` `#b92c2c` (survol `#c93636`, appui `#a32424`),
> `text-on-danger` (alias de `text-primary`), `decorative-progress` `#cc1a0d`. Garde G3b.

Trois **alias**, aucune nouvelle valeur : ils relèvent d'`expert-ux` (skill `design-system-influx`,
« Ajouter un token »). Ils rejoindront `tokens.css` quand le produit réel les utilisera. Dans les
espaces connectés, ils résolvent vers les valeurs KEO de §11.3 (D73) : `border-strong` `#78827d`,
`surface-muted` `#121413`, `surface-inverse` `#f4f6f5`. Les jetons créés par D73 sont listés en §11.3
et §11.5.

| Token | Valeur | Rôle | Quand ne pas l'utiliser |
|---|---|---|---|
| `--color-chat-private-border` | `var(--color-border-strong)` | Cadre de 2 px du champ de saisie d'un aparté | Pour tout autre champ : il perdrait sa valeur de signal |
| `--color-chat-private-surface` | `var(--color-surface-muted)` | Fond de la zone des messages d'un aparté, en renfort | Seul, sans bandeau ni icône (P7) |
| `--color-logo-plate` | `var(--color-surface-inverse)` | Pastille claire derrière un logo de marque déposé | Section pleine largeur (interdite, `CLAUDE.md` §4) ; photo de créateur ou visuel de portfolio |

---

## 11. Charte KEO Emerald des espaces connectés (D73)

> **Décision du fondateur (2026-10-28, D73).** Les espaces membres marque et créateur et le
> backoffice suivent la charte de la maquette `design-proposals/proposition-4-keo-emerald.html`
> (valeurs : `design-proposals/keo-emerald.css`), avec un gabarit mobile et un gabarit desktop, et
> sur desktop un menu à gauche « comme Railway ». Le choix de la maquette vaut validation de ses
> valeurs de couleur au sens de D6. **Aucune valeur de couleur n'est ajustée ici** : chaque couleur
> est une valeur de KEO ou une valeur déjà validée (D6, D72, `17b` V1), sauf le fond du badge
> d'erreur, seule valeur créée par D75 (RK-B, §11.3). Réalignement sur la référence : D75, jalon RK
> (`docs/mvp/archives/jalons/rk-fiche.md`). Mise en œuvre : jalon DS
> (`docs/mvp/archives/jalons/ds-fiche.md`) ; d'ici là, cette section fait foi, et `keo-emerald.css` n'est jamais
> importé tel quel (noms par apparence, `rgba`, valeurs écartées en §11.6).

### 11.1 Périmètre et frontière

| Registre (§2) | Charte | Pages |
|---|---|---|
| **Vitrine** | Valeurs actuelles de `tokens.css` (D6), direction D59 (carte métallisée, budget d'effets) | Page d'accueil publique ; **pages légales publiques** (`cgu`, `confidentialite`, `cookies` et équivalents EN) ; 404 et erreurs de niveau `[locale]` ; bandeau cookies |
| **Espaces membres** | **KEO Emerald** | **Parcours d'inscription et de connexion** ; accueils de rôle, « Mon compte », écrans des Lots 2 à 5, erreurs et 404 levées dans ces pages ; écrans hors session du compte (déconnecté, compte supprimé) ; **texte des CGU affiché dans le parcours** (fenêtre des CGU, écran bloquant de `17` §6.7) |
| **Backoffice** | **KEO Emerald** | Tout `apps/backoffice`, connexion et second facteur compris |

Frontière arbitrée par `chef-de-projet` le 2026-10-28, telle que `02` §21.2 : elle suit un groupe de
routes (`app/[locale]/(member)/`).

**Inscription et connexion en KEO.** (1) Après le code, la personne arrive dans son espace : changer
de charte entre l'écran 3 et l'accueil couperait en son milieu un parcours de moins d'une minute ; la
rupture se place au clic sur une porte, moment où l'on « entre dans le produit ». (2) Ces écrans
relèvent déjà du registre des espaces membres (mobile 375, une décision par écran, `17` §3). (3) Dans
le code, ils partagent leurs classes avec « Mon compte » (`auth-classes.ts`).

**Pages légales publiques en vitrine.** Elles s'atteignent sans compte, depuis la vitrine, et le
périmètre demandé par le fondateur est celui des trois espaces. Le même texte, affiché **dans** le
parcours (fenêtre des CGU, écran de ré-acceptation), est rendu en KEO par le même composant neutre.
Le fondateur a confirmé ce défaut le 2026-10-29 (§11.9, F1).

**Mécanisme** (`architecte`, `02` §21.3 à §21.5). Un seul `tokens.css`, dans `packages/ui`, importé par
les deux fronts : `@theme static` déclare tous les noms de rôle avec les valeurs vitrine ; un bloc
unique `[data-theme="keo"]` les re-valorise. L'attribut est posé par `app/[locale]/(member)/layout.tsx`
dans `apps/web` et sur `<html>` dans `apps/backoffice`. Polices par `next/font/local` (§11.5). Le bloc
KEO redéfinit tout `--color-*` sauf la liste `KEO_INHERITS` (§11.3), plus `font-display`, `font-base`,
les rayons, `font-weight-action`, `font-weight-action-secondary` et `border-width-action-secondary`
(§11.5) ; les échelles d'espacement
et de texte, les durées et les points de rupture ne changent pas.

**Deux verts de marque.** La vitrine garde `#29e075` (teinte 145°), les espaces passent à `#1dd68a`
(155°). Deux verts presque identiques sur deux écrans consécutifs (bouton d'une porte, puis écran
d'inscription) se lisent comme une erreur, pas comme un choix. **Tranché par le fondateur le 2026-10-29
(F2), appliqué par DS-14 :** un seul vert, `#1dd68a`, sur toute la plateforme. La vitrine garde sa
direction D59, qui porte sur les effets et non sur la valeur du vert, moyennant une revue visuelle de
la page avant sa mise en ligne. Le mécanisme n'en dépend pas : aligner la vitrine revient à poser
l'attribut dans la mise en page racine, puis à recetter les effets D59 (`02` §21.8, un à deux jours).
Revue visuelle D59 avant la mise en ligne de la vitrine.

### 11.2 Ce qui ne change pas

| Règle | Source |
|---|---|
| Succès en **sarcelle**, famille distincte du vert de marque (sous KEO `#3ccfcf`, à 25° du vert d'action, §11.3) | `CLAUDE.md` §4, D6 précisée |
| **Rouge « danger » opaque**, valeurs inchangées, aucun rouge translucide | D72, DZ-4, garde G3b, §10 |
| Succès, alerte et information gardent leur fond teinté opaque | DZ-6 |
| **Violet = seule teinte réservée au backoffice** (vue identifiée), jamais dans `apps/web` | `17b` §6.2 |
| La couleur ne porte jamais seule une information | P7 |
| Contraste AA calculé **sur chaque surface réelle** | skill `design-system-influx` |
| Aucun taux, aucun net ; au backoffice, chaque montant dit qui l'a saisi et quand | D48, P3, §6 |
| Densité propre à chaque registre ; mobile-first des espaces membres ; lignes de 36 px au backoffice | §2 |
| Tokens seuls, aucune valeur en dur | CA22, G3 |

### 11.3 Correspondance KEO → tokens INFLUX

Les noms par rôle existants sont conservés. **Origine** : *KEO* = valeur de `keo-emerald.css` ;
*validée* = valeur déjà arbitrée ; *alias* = renvoi à un autre token ; *(nouveau)* = nom créé par
D73. La colonne **Écart** signale chaque rôle où l'affectation diffère de la maquette. Contrastes :
§11.4.

**Marque et action**

| Token | Valeur | Origine | Usage | Écart |
|---|---|---|---|---|
| `color-brand-primary` | `#1dd68a` | KEO `brand-primary` | Marque, indicateur d'item actif, remplissage de complétude, sélection | — |
| `color-brand-accent`, `color-surface-accent` | alias `brand-primary` | alias | — | Un seul vert dans les espaces |
| `color-action-primary-bg` | `#1dd68a` | KEO | Bouton principal | — |
| `color-action-primary-bg-hover` | `#4de4a6` | KEO `brand-primary-hover` | Survol | — |
| `color-action-primary-bg-active` | `#14af6f` | KEO `brand-primary-pressed` | Appui | Réduction d'échelle de KEO **reprise à 98 %** (`scale-press`, D75 RK-2, §11.5) |
| `color-action-secondary-bg` | `#1a1d1b` | KEO `surface-2` | Bouton secondaire | — |
| `color-action-secondary-bg-hover` | `#232725` | KEO `surface-3` | Survol | — |
| `color-action-secondary-bg-active` | alias `surface-active` (`#2d322f`) | KEO `surface-4` | Appui | — |
| `color-action-secondary-border` | alias `border-strong` (`#78827d`) | alias | Contour du bouton secondaire | **KEO `#454c48` (2,1:1) écarté** : le contour reste ≥ 3:1 |
| `color-action-secondary-border-hover` *(nouveau)* | alias `text-secondary` | alias | Contour au survol | Comme KEO |
| `color-action-disabled-bg` | `#232725` | KEO `surface-3` | Bouton désactivé, toujours expliqué à côté (`17` §1.3 règle 4) | KEO ne le définit pas |
| `color-action-danger-bg` / `-hover` / `-active` | `#b92c2c` / `#c93636` / `#a32424` | validée D72 | Action destructive | **KEO `#ff5a5f` écarté** |
| `color-brand-subtle-bg`, `color-surface-brand-subtle` | `#0f2118` | validée D6 | Lien de section courant, carte de choix sélectionnée, bulle d'agent (Lot 4) | KEO `rgba(29,214,138,.14)` remplacé par l'équivalent opaque déjà validé |
| `color-brand-subtle-border` | `#1f3d2b` | validée D6 | Contour des mêmes éléments | idem |

**Texte**

| Token | Valeur | Origine | Usage | Écart |
|---|---|---|---|---|
| `color-text-primary` | `#f4f6f5` | KEO | Texte principal, titres, montants, item actif | — |
| `color-text-secondary` | `#b4bbb7` | KEO | Texte secondaire, items inactifs, aides | — |
| `color-text-tertiary` | `#8a938e` | KEO | Provenance, dates, mentions — **jamais sur `surface-active`** (4,13:1) | — |
| `color-text-disabled` | `#5c6561` | KEO | Libellé désactivé (exempté par WCAG 1.4.3 ; l'explication adjacente porte l'information) | — |
| `color-text-on-action`, `-on-accent` | `#04150d` | KEO `brand-on-primary` | Texte sur le vert | — |
| `color-text-inverse` | `#07130d` | KEO | Chiffre de la pastille de compteur | — |
| `color-text-brand` | `#1dd68a` | KEO | Mot-clé, lien au survol ; jamais en texte courant ni sur un montant | — |
| `color-text-brand-strong` | `#4de4a6` | KEO (`hover`) | Texte vert posé sur `brand-subtle-bg` | Affectation INFLUX |
| `color-text-on-danger` | alias `text-primary` | D72 | Texte du bouton rouge | — |

**Surfaces** (échelle KEO `bg`, `surface-1` à `surface-5` → rôles)

| Token | Valeur | Origine | Usage | Écart |
|---|---|---|---|---|
| `color-surface-page` | `#0a0b0a` | KEO `bg` | Page, colonne de navigation, bande de tête, champ de saisie | — |
| `color-surface-muted` | `#121413` | KEO `surface-1` | Zone en retrait, en renfort (aparté) | Même valeur que la carte |
| `color-surface-card` | `#121413` | KEO `surface-1` | Carte, ligne de tableau | — |
| `color-surface-raised` | `#1a1d1b` | KEO `surface-2` | Bloc dans une carte, dialogue, ligne survolée du tableau dense, carte cliquable survolée, survol d'item de navigation, piste d'onglets, badge neutre | — |
| `color-surface-hover` | `#232725` | KEO `surface-3` | En-tête du tableau dense, item de navigation actif | D75 (RK-15) : l'en-tête passe de `surface-2` (1,09:1 contre les lignes, invisible) à `surface-3` ; la ligne survolée reste en `surface-2`, distinguée par son filet |
| `color-surface-active` *(nouveau)* | `#2d322f` | KEO `surface-4` | Appui du bouton secondaire, onglet segmenté actif | — |
| `color-surface-inverse` | alias `text-primary` | alias | Pastille de compteur, pastille de logo (§10) | — |
| — | `#383e3a` | KEO `surface-5` | **Non repris** : aucun usage | — |

**Bordures et focus**

| Token | Valeur | Origine | Usage | Écart |
|---|---|---|---|---|
| `color-border-subtle` | alias `border-default` | alias | Séparateur de lignes | KEO n'a qu'un filet décoratif |
| `color-border-default` | `#2a2f2c` | KEO `neutral-border` | Contour de carte, filets de colonne, de bande et de barre | — |
| `color-border-strong` | `#78827d` | KEO `neutral-border-input` | Champ, case, bouton secondaire, cadre d'aparté : tout contour qui doit atteindre 3:1 | Rôle élargi au-delà des champs |
| `color-border-hover` *(nouveau, D75)* | alias `text-secondary` | alias, redéclaré sous KEO | Contour d'une carte cliquable au survol (RK-10) ; au repos, la carte cliquable garde `border-strong`, seul indice sur téléphone | KEO éclaircit le contour au survol ; valeur reprise des gris de texte, aucune nouvelle |
| — | `#454c48` | KEO `neutral-border-strong` | **Non repris** : ni assez contrasté pour un composant, ni utile en décor ; le contour de survol est `border-hover` | — |
| `color-border-selected` | alias `brand-primary` | alias | Sélection | — |
| `color-border-error` | `#e5484d` | validée D72 | Champ en erreur (2 px) | — |
| `color-focus-ring` | alias `text-primary` | alias | Anneau de 3 px décalé de 2 px (`focus-ring-width`, `-offset`) | **KEO : bordure verte et `outline: none`, écartés** |

**Sémantique** (texte · fond · bordure · icône)

| Famille | Valeurs | Origine | Écart |
|---|---|---|---|
| Succès | **`#3ccfcf`** · `#0d2b28` · `#146b62` · **`#3ccfcf`** | texte et icône KEO (`platform-escrow`, réaffecté) ; fond et bordure validés D6, hérités | **KEO `#4ade80` écarté** : vert, à 13° du vert de marque. **La sarcelle de la vitrine `#2dd4bf` (172°) n'est qu'à 17° du vert KEO (155°)** : sous KEO, le succès passe à `#3ccfcf` (180°, écart 25°), toujours de la famille sarcelle. Décision `expert-ux` du 2026-10-28 (`02` §21.8) |
| Alerte | **`#ffb020`** · `#2b2008` · `#92650a` · **`#ffb020`** | texte et icône KEO ; fond et bordure validés | KEO `rgba` remplacé par le fond opaque validé |
| Erreur (D72) | `#ec5d5e` · `transparent` · `#e5484d` · `#ec5d5e` | validées D72 | **KEO `#ff5a5f` et son `rgba` écartés** |
| Information | **`#4da3ff`** · `#0f1f33` · `#2f5a99` · **`#4da3ff`** | texte et icône KEO ; fond et bordure validés | idem alerte |

**Écart de teinte du succès (seuil de la garde G3d, `02` §21.6).** Dans chaque charte, la teinte HSL
de `feedback-success-text` et de `feedback-success-icon` est à **au moins 20°** de celle de
`action-primary-bg`, `-hover` et `-active`, et à au moins 20° de `feedback-info-text`. Valeurs : KEO
`#3ccfcf` 180° contre 155° (25°) et contre l'information 211° (31°) ; vitrine `#2dd4bf` 172° contre
143° à 145° (28° au moins) et contre 213° (41°). Le fond `#0d2b28` et la bordure `#146b62` (174°), très
sombres, ne portent pas la teinte et restent hors du calcul. La forme reste un second séparateur : le
plein vif est réservé à l'action, un succès n'est jamais rempli de sa teinte vive (son badge est
rempli du fond sombre opaque de sa famille, D75 RK-11).

**Rôles, vérifié et badges**

| Token | Valeur | Origine | Usage |
|---|---|---|---|
| `color-verified-bg` *(nouveau, D75)* | alias `feedback-info-bg` (`#0f1f33`) | alias, `KEO_INHERITS` | Fond du badge vérifié (RK-11) |
| `color-badge-error-bg` *(nouveau, D75 RK-B)* | **`#2e1213`** | **valeur créée** (seule du jalon RK), `KEO_INHERITS`, sans usage en vitrine | Fond du **seul badge de statut d'erreur**. Teinte 358°, saturation 44 %, clarté 12,5 % : de la famille des fonds teintés (succès 11 %, alerte 10 %, information 12,9 %). Ce n'est **pas un rouge D72** (absent de la liste de G3b) ; **jamais le fond d'une notice**, qui reste sans fond teinté (D72, DZ-6) ; confiné au badge (TK7.5). Confirmé par `expert-ux` au RK-0 : `#ec5d5e` y atteint 5,19:1 (§11.4) ; un fond plus sombre gagnerait 0,1 point en se confondant avec la carte (1,11:1 contre 1,14:1 avec la page) |
| `color-role-advertiser` *(nouveau)* | `#e6d3a3` | KEO `platform-brand-side` | Marque visuelle du rôle marque (liste fermée ci-dessous) |
| `color-role-creator` *(nouveau)* | `#ff8fb1` | KEO `platform-creator-side` | Marque visuelle du rôle créateur (idem) |
| `color-verified-text` *(nouveau)* | `#4da3ff` | KEO `platform-verified` | Texte et icône du badge vérifié ; même valeur que l'information, rôle distinct pour pouvoir diverger |
| `color-verified-border` *(nouveau)* | alias `feedback-info-border` | alias | Contour du badge vérifié (KEO `rgba` remplacé) |

Les couleurs de rôle ne servent **que** de marque visuelle (`12` RG7) : un point de `spacing-2`
toujours suivi du rôle écrit. **Usages autorisés, liste fermée :** (1) en-tête de colonne d'un espace
(« Espace marque », « Espace créateur ») ; (2) les deux cartes de l'écran de choix d'une porte
(`05` RG1) ; (3) au backoffice, devant le rôle écrit d'un compte ou d'un participant ; (4) dans la
conversation à trois (Lot 4), devant le nom et le rôle écrit, jamais en fond de bulle. **Interdits :**
texte coloré (nom, montant, titre), fond de surface, bouton, contour de carte, état.

Le badge vérifié passe du vert au bleu de KEO : le vert est réservé à l'action. Le bleu évoque la
coche des réseaux sociaux, qui n'affirme pas la même chose (`08` RG4, RG10, D34) : le badge n'est donc
**jamais une coche seule ni collé à un nom** ; il écrit « Vérifié · ⟨réseau⟩ · ⟨mois année⟩ » sur la
ligne du réseau concerné. Le fondateur a retenu ce bleu et cette règle de forme le 2026-10-29 (§11.9, F3).

**Données** (graphiques seulement, chaque série étiquetée directement, jamais pour un état ou un rôle)

| Token | Valeur | Origine |
|---|---|---|
| `color-data-1` *(nouveau)* | alias `brand-primary` | KEO `data-1` |
| `color-data-2` *(nouveau)* | alias `feedback-info-text` | KEO `data-2` |
| `color-data-3` *(nouveau)* | `#ffae2b` | KEO `data-3` |

KEO `data-4` (rose) et `data-6` (sable) sont les couleurs de rôle, `data-5` (`#3ccfcf`) est désormais
la couleur du succès : non repris. Les tokens de la barre de répartition de la vitrine (`color-data-*-share`,
`-net-creator`) restent à la vitrine (net suspendu, D48).

**Navigation** (alias, `17` §8.2 complété)

| Token | Valeur | Usage |
|---|---|---|
| `color-nav-item-hover-bg` *(nouveau)* | alias `surface-raised` | Survol d'un item |
| `color-nav-item-active-bg` | alias `surface-hover` | Item actif |
| `color-nav-item-active-indicator` | alias `brand-primary` | Filet de 2 px de l'item actif (gauche en colonne, haut en barre du bas) |
| `color-counter-bg` *(nouveau)* | alias `surface-inverse` | Pastille de compteur des espaces membres |
| `color-counter-text` *(nouveau)* | alias `text-inverse` | Chiffre de la pastille |

**Backoffice** (`tokens-backoffice.css`, `17b` §6 ; noms inchangés)

| Token | Valeur | Origine |
|---|---|---|
| `color-bo-identified-accent` / `-bg` | `#a78bfa` / `#17121f` | validées (`17b` V1 ; le violet figure aussi dans la maquette KEO) |
| `color-bo-sla-ontime-text` / `-due-text` / `-overdue-text` | alias `text-secondary` / `feedback-warning-text` / `feedback-error-text` | alias |
| `color-bo-alert-state` / `-event` / `-event-bg` | alias information / alerte / fond d'alerte | alias |
| `color-bo-env-nonprod-bg` / `-text` | alias fond d'alerte / texte d'alerte | alias |
| `color-bo-row-hover` | alias `surface-raised` (D75 RK-15 : `surface-hover` passe à l'en-tête), doublé du filet gauche de 2 px `brand-primary` | alias |
| `effect-bo-row-indicator` *(nouveau, D75)* | `inset var(--border-width-thick) 0 0 var(--color-brand-primary)` | dérivé, aucune valeur nouvelle : filet de la ligne survolée ou focalisée, ombre intérieure sur la première cellule (`-bo-` obligatoire, G3f) |

**Pour le bloc `[data-theme="keo"]` (`02` §21.3).** *Nouveaux rôles* (`surface-active`,
`role-advertiser`, `role-creator`, `verified-*`, `counter-*`, `nav-item-hover-bg`, `data-1` à `-3`,
`action-secondary-border-hover` ; D75 : `border-hover`, `verified-bg`, `badge-error-bg`) : déclarés
d'abord dans `@theme`, en alias d'un token vitrine quand il
existe (`surface-active` → `action-secondary-bg-active`, `counter-*` → `surface-inverse` /
`text-inverse`, `nav-item-hover-bg` → `surface-raised`), sinon avec la même valeur qu'en KEO (sans
usage en vitrine). *`KEO_INHERITS`* (valeur vitrine conservée sous KEO) : `overlay-scrim` ;
`verified-bg` et `badge-error-bg` (D75) ; rouges D72
(`feedback-error-text`, `-bg`, `-border`, `-icon`, `border-error`, `action-danger-bg`, `-hover`,
`-active`, `decorative-progress`) ; fonds et bordures teintés identiques dans les deux chartes
(`brand-subtle-bg`, `surface-brand-subtle`, `brand-subtle-border`, `feedback-success-bg`, `-border`,
`feedback-warning-bg`, `-border`, `feedback-info-bg`, `-border`) ; tokens propres à la vitrine, sans
usage sous KEO (`mockup-banner-*`, `overlay-hero-halo`, `action-inverse-bg`,
`action-secondary-inverse-border`, `text-inverse-secondary`, `text-accent-on-inverse`,
`surface-inverse-raised`, `border-inverse`, `focus-ring-inverse`, `data-advertiser-share`,
`data-creator-share`, `data-net-creator`). Tout le reste est redéfini, **alias compris** quand leur
cible l'est (`text-on-danger`, `action-secondary-border`, `border-subtle`, `border-selected`,
`brand-accent`, `surface-accent`, `focus-ring`, `surface-inverse`, `border-hover` : fermeture G3c).

### 11.4 Contrastes calculés

WCAG 2.x, luminance relative, valeurs de §11.3. Seuils : 4,5:1 pour le texte, 3:1 pour un composant
d'interface ou un objet graphique.

| Premier plan | Page `#0a0b0a` | Carte, muette `#121413` | Surélevée `#1a1d1b` | Survol `#232725` | Active `#2d322f` | Identifiée BO `#17121f` | Marque sourde `#0f2118` |
|---|---|---|---|---|---|---|---|
| `text-primary` `#f4f6f5` | 18,16 | 17,04 | 15,66 | 13,94 | 12,03 | 16,93 | 15,47 |
| `text-secondary` `#b4bbb7` | 10,08 | 9,45 | 8,69 | 7,73 | 6,67 | 9,39 | 8,58 |
| `text-tertiary` `#8a938e` | 6,24 | 5,85 | 5,38 | 4,79 | **4,13 ✗** | 5,81 | 5,31 |
| `text-disabled` `#5c6561` (exempté) | 3,28 | 3,07 | 2,82 | 2,51 | 2,17 | — | — |
| `text-brand` `#1dd68a` | 10,36 | 9,72 | 8,93 | 7,95 | 6,86 | 9,66 | 8,82 |
| Succès `#3ccfcf` (KEO) | 10,34 | 9,71 | 8,92 | 7,94 | 6,85 | — | — |
| Alerte `#ffb020` | 10,78 | 10,12 | 9,29 | 8,27 | — | — | — |
| Erreur `#ec5d5e` | 5,91 | 5,54 | 5,09 | 4,53 | **3,91 ✗** | 5,51 | — |
| Information, vérifié `#4da3ff` | 7,51 | 7,05 | 6,47 | 5,76 | — | 7,00 | — |
| Rôle marque `#e6d3a3` | 13,34 | 12,52 | 11,50 | 10,24 | — | 12,44 | — |
| Rôle créateur `#ff8fb1` | 9,22 | 8,65 | 7,95 | 7,07 | — | 8,59 | — |
| Violet `#a78bfa` (BO) | 7,24 | 6,80 | 6,25 | 5,56 | — | 6,75 | — |
| `border-strong` `#78827d` (≥ 3) | 4,96 | 4,66 | 4,28 | 3,81 | — | 4,63 | — |
| `border-error` `#e5484d` (≥ 3) | 5,04 | 4,73 | 4,34 | 3,86 | — | — | — |

| Paire propre à un composant | Ratio | Seuil |
|---|---|---|
| `text-on-action` sur `action-primary-bg` / `-hover` / `-active` | 9,87 / 11,59 / 6,61 | 4,5 ✅ |
| `text-on-danger` sur `action-danger-bg` / `-hover` / `-active` | 5,59 / 4,76 / 6,82 | 4,5 ✅ |
| `counter-text` sur `counter-bg` | 17,46 | 4,5 ✅ |
| `text-primary` sur fond de succès / d'alerte / d'information | 13,89 / 14,74 / 15,31 | 4,5 ✅ |
| Texte de succès / d'alerte / d'information sur son propre fond (notice, badge rempli) | 7,91 / 8,75 / 6,33 | 4,5 ✅ |
| *(D75)* Badge vérifié : `verified-text` sur `verified-bg` | 6,33 | 4,5 ✅ |
| *(D75)* Badge neutre : `text-secondary` sur `surface-raised` | 8,69 | 4,5 ✅ |
| *(D75)* Badge d'erreur : `feedback-error-text` `#ec5d5e` sur `badge-error-bg` `#2e1213` | 5,19 | 4,5 ✅ |
| *(D75)* Intitulé d'en-tête du tableau dense : `text-secondary` sur `surface-hover` | 7,73 | 4,5 ✅ |
| *(D75)* Filet de la ligne : `brand-primary` sur `surface-hover` (pire cas) | 7,95 | 3 ✅ |
| *(D75)* Surtitre : `text-secondary` sur page / carte / surélevée | 10,08 / 9,45 / 8,69 | 4,5 ✅ |
| *(D75)* Contour de carte cliquable : `border-strong` sur carte (repos) ; `border-hover` sur `surface-raised` (survol) | 4,66 ; 8,69 | 3 ✅ |
| Écart de teinte succès / action principale (repos, survol, appui) ; succès / information | 25° ; 31° | 20° ✅ (G3d) |
| Bouton principal (forme) sur page / carte | 10,36 / 9,72 | 3 ✅ |
| Bouton rouge (forme) sur page / carte | 3,25 / 3,05 | 3 ✅ |
| Indicateur d'item actif sur `surface-hover` | 7,95 | 3 ✅ |
| Anneau de focus sur page / survol | 18,16 / 13,94 | 3 ✅ |
| `color-data-1` / `-2` / `-3` sur carte | 9,72 / 7,05 / 9,99 | 3 ✅ |

**Conséquences.** (1) Pas de texte tertiaire ni de texte d'erreur sur `surface-active` : cette surface
ne porte que l'onglet actif et l'appui du bouton secondaire, en `text-primary`. (2) Les surfaces ne se
distinguent pas seules de la page (carte 1,07:1, surélevée 1,16:1, survol 1,30:1) : toute carte, tout
panneau et toute bulle porte une bordure `border-default` (`17` §8.3), les dialogues en plus
`shadow-lg`. (3) Le texte d'erreur reste lisible sur une ligne survolée (4,53:1), pas au-delà.

**Au pic du halo d'en-tête** *(D75, RK-9)*. Le halo est `color-mix(… 15 %, transparent)` du vert de
marque posé sur `surface-page` : composé, `0,15 × #1dd68a + 0,85 × #0a0b0a` = **`#0d291d`**
(luminance relative 0,0176). Le texte qui s'y pose garde l'AA :

| Premier plan sur `#0d291d` | Calcul (L + 0,05) / (0,0176 + 0,05) | Ratio | Seuil |
|---|---|---|---|
| `text-primary` (L 0,9174) | 0,9674 / 0,0676 | 14,31 | 4,5 ✅ |
| `text-secondary` (L 0,4866) | 0,5366 / 0,0676 | 7,94 | 4,5 ✅ |
| `text-tertiary` (L 0,2822) | 0,3322 / 0,0676 | 4,91 | 4,5 ✅ |
| `feedback-error-text` (L 0,2647) | 0,3147 / 0,0676 | 4,66 | 4,5 ✅ |
| `border-strong` (L 0,2144) | 0,2644 / 0,0676 | 3,91 | 3 ✅ |

Badge d'erreur : `#ec5d5e` (L 0,2647) sur `#2e1213` (L 0,0106) : 0,3147 / 0,0606 = **5,19**. Ces paires
entrent dans la matrice de G3d, pic composé compris.

**Paires interdites** *(D75, en plus de (1))* : (4) le **halo sur `surface-card` ou plus clair** — il
se pose sur la page seulement, en fond du conteneur d'écran (§11.5) ; (5) un **texte tertiaire ou
d'erreur à moins de `spacing-5` d'un bouton principal survolé** (son ombre lumineuse éclaircit le
fond) ; (6) un **surtitre ou un badge en vert** ; (7) un **halo d'en-tête au-delà de 15 %**.

### 11.5 Typographie, formes, élévation, mouvement

**Familles** (mêmes noms de rôle, valeur selon le registre)

| Token | Espaces connectés (KEO) | Vitrine | Emploi |
|---|---|---|---|
| `font-display` | Manrope, repli système | police système (inchangée) | **Tous les titres, `h1` à `h4`** (D75 RK-5), chiffres clés, boutons, surtitres, badges, en-tête du tableau dense |
| `font-base` | Source Sans 3, repli système | police système (inchangée) | Corps, champs, navigation, tableaux |
| `font-mono` | inchangé | inchangé | Références `MER-…` au backoffice |

**Échelle des espaces connectés.** Tailles fixes : les tokens fluides (`text-lead`, `text-heading-2`,
`-3`, `text-display`, `text-amount-lg`, `text-figure-*`) suivent la largeur de la fenêtre, qui n'est
pas celle du contenu à côté d'une colonne ; ils restent à la vitrine. **Aucun token fluide sous KEO**
(D75 RK-5) : ni `text-display`, `text-heading-*`, `text-lead`, `text-figure-*`, ni `clamp(` ou `vw`
dans un `--text-*` ou un `--tracking-*` effectif (G8 étendue, TK7.3), texte juridique (`LegalMarkdown`)
compris. Tailles du texte inchangées (RK-8) : 16 px membres, 14 px backoffice, plancher 12 px.

| Rôle | Token | Taille | Famille, graisse | Interligne |
|---|---|---|---|---|
| Titre de page (`h1`) | `text-title-page` *(nouveau)* | 1,5 rem sous `lg`, 1,75 rem au-delà | Manrope 800, `tracking-heading` (−0,025 em, D75 RK-6) | `leading-heading` |
| Titre de section (`h2`) | `text-title-section` *(nouveau)* | 1,25 rem | Manrope 700, `tracking-heading` (D75) | `leading-snug` |
| Titre de carte (`h3`) | `text-md` | 1 rem | Manrope 700, sans approche serrée (à 16 px, −0,025 em colle les lettres) | `leading-snug` |
| *(D75)* Titre de bloc dense (BO, `h3`, `h4`) | `text-sm` | 0,875 rem | Manrope 700, sans approche serrée | `leading-snug` |
| Corps, espaces membres | `text-md` | 1 rem | Source Sans 3 400, emphase 600 | `leading-body` |
| Corps du backoffice, aides | `text-sm` | 0,875 rem | Source Sans 3 400 | `leading-body` ; tableau `leading-snug` |
| Mention, libellé de barre du bas | `text-xs` | 0,75 rem, **plancher** | Source Sans 3 600 | `leading-body` |
| *(D75)* Surtitre | `text-xs` | 0,75 rem, **plancher** | Manrope 700 en capitales, `tracking-overline`, `text-secondary`, **jamais vert** | `leading-body` |
| Montant dans une carte, chiffre clé | `text-amount-md` (`17` §8.2) | 1,125 rem | Manrope **800** (D75 RK-6), `font-variant-numeric-amount` | `leading-tight` |
| Montant en tableau | `text-sm` | 0,875 rem | Source Sans 3 400, `font-variant-numeric-amount` | `leading-snug` |
| Bouton | `text-md` (membres), `text-sm` (BO) | — | `font-display` ; principal et danger `font-weight-action` *(700 dans les espaces, 500 en vitrine)* ; secondaire et bouton texte `font-weight-action-secondary` *(nouveau, D75 RK-3 : 600 dans les espaces, 500 en vitrine)* | `leading-snug` |
| Item de navigation | `text-md` (colonne), `text-sm` (rail BO), `text-xs` (barre du bas) | — | Source Sans 3 400, actif 600 | — |

**Chargement des polices** (`architecte`, `02` §21.4). `next/font/local` et fichiers woff2 variables
versionnés dans le dépôt (module `packages/ui/src/styles/fonts.ts`, importé par les deux fronts) : **aucun
appel à Google Fonts**, que la maquette sollicite (politique de sécurité de contenu, adresse IP
transmise à un tiers), et la CI ne télécharge rien. Sous-ensembles `latin` et `latin-ext` versionnés (noms à
diacritiques d'Europe centrale ; **réalisé : `latin` seul câblé**, `latin-ext` en repli système,
`02` §21.4 point 3), `display: swap` avec métriques de repli ajustées (pas de saut de mise
en page) ; chargées par les deux seules mises en page KEO, jamais par la vitrine ; écritures non
couvertes (cyrillique, arabe, CJK…) : repli système. **Graisses employées** : Manrope 600 (bouton
secondaire, bouton texte, D75), 700 et 800, Source Sans 3 400 et 600. Chiffres tabulaires de Manrope **vérifiés** sur le fichier livré (TD3.5 : « 1111 » et
« 8888 » de même largeur) ; les montants restent en Manrope.

**Lissage** *(D75 RK-7)*. Sous KEO seulement, `-webkit-font-smoothing: antialiased` (et son pendant
`-moz-osx-font-smoothing: grayscale`) par l'utilitaire `antialiased` posé sur le conteneur KEO des
membres et sur le `<html data-theme="keo">` du backoffice ; la propriété s'hérite. `html` et `body` de
la vitrine restent en `auto` ; aucune propriété de lissage n'est déclarée dans `:root`, `html` ou
`body` (TK7.5). L'effet ne se voit que sur macOS : il se recette sur Mac (Safari et Chrome).

**Formes**

| Token | Valeur | Emploi |
|---|---|---|
| `radius-card` *(nouveau)* | 1 rem (KEO `radius-card` 16 px) | Carte, dialogue |
| `radius-md` | 0,75 rem | Bloc dans une carte, champ, notice, item de navigation |
| `radius-sm` | 0,375 rem | Petite étiquette, cases du code |
| `radius-pill` | 999px | Boutons, badges, pastilles, onglets segmentés |
| `border-width-action-secondary` *(nouveau)* | 1 px dans les espaces (KEO), 2 px en vitrine (actuel) | Contour du bouton secondaire |
| `focus-ring-offset-inset` *(nouveau, dérivé)* | `calc(-1 * var(--focus-ring-width))` | Anneau intérieur là où un anneau extérieur serait rogné (barre du bas) |

**Élévation sur fond noir.** Au repos, les cartes sont plates : surface + `border-default`, sans
ombre. `shadow-lg` est réservé aux couches au-dessus de la page (dialogue, menu, palette `⌘K`), sur
`overlay-scrim`. **Ombre lumineuse du bouton principal** (F6, fondateur, 2026-10-29 ; intensités de la
référence, D75 RK-1) : dérivée du vert de marque, sans valeur nouvelle ; décorative, elle ne remplace
jamais l'anneau `focus-ring` et disparaît sur un bouton désactivé (`aria-disabled` ou `disabled`, au
repos comme au survol). Elle n'est pas un token de l'espace `--shadow-*` (Tailwind en inscrit la valeur
vitrine en dur, `02` §21.3 point 3) mais deux tokens `--effect-*` :

| Token | `:root` (vitrine) | Bloc KEO |
|---|---|---|
| `--effect-action-glow` (repos) | `0 0 transparent` | `0 0.25rem 0.875rem color-mix(in srgb, var(--color-brand-primary) 25%, transparent)` |
| `--effect-action-glow-hover` (survol) | `0 0 transparent` | `0 0.375rem 1.25rem color-mix(in srgb, var(--color-brand-primary) 40%, transparent)` |

Diffuse tout autour, plus large et plus forte au survol. Neutre en `0 0 transparent`, **jamais
`none`** (qui invaliderait la liste de `box-shadow`). Ni ombre ni transformation sur les petits
boutons des écrans du backoffice (`size-bo-control`, RK-4) ; les boutons de connexion du backoffice
gardent les effets.

**Halo d'en-tête** (F6, fondateur, 2026-10-29 ; doux, sans bord, intensité de la référence, un seul par
page, D75 RK-9) : **fond du conteneur d'écran** (`bg-header-glow bg-no-repeat`), jamais un calque ;
décoratif, il ne porte aucune information et ne fait jamais passer un texte sous l'AA calculé (§11.4,
pic `#0d291d`).

| Token | `:root` / `@theme` (vitrine) | Bloc KEO |
|---|---|---|
| `--background-image-header-glow` | `none` | `radial-gradient(ellipse 50% var(--size-header-glow) at 50% 0%, color-mix(in srgb, var(--color-brand-primary) 15%, transparent), transparent)` |
| `--size-header-glow` *(nouveau, `:root`)* | **16 rem** | hérité |

**Hauteur du halo, `--size-header-glow` = 16 rem (256 px)**, tranchée par `expert-ux` au RK-0, bornée
entre 12 et 20 rem. Le long de l'axe vertical, l'opacité décroît linéairement de 15 % à 0 sur la
hauteur H ; un écart d'opacité de 1 vaut 158,5/255 de luma (`0,2126 × 19 + 0,7152 × 203 + 0,0722 × 128`,
écarts de canaux entre le vert et la page). (a) **Sans bord** : sur 8 px (± 4 px autour du bas de
l'en-tête), l'écart vaut `158,5 × 0,15 × 8 / H` ; ≤ 2/255 dès H ≥ 95 px, ≤ 1/255 (marge pour le tramage)
dès H ≥ 190 px, d'où **12 rem au moins** ; à 16 rem, 0,74/255. (b) **Pic préservé** : à 4 px du bord
haut, l'opacité vaut `0,15 × (1 − 4/256)` = 14,8 %, soit `#0d291d` arrondi. (c) **Nul avant la barre du
bas** : à 375 × 667, le conteneur commence sous l'en-tête de 4 rem ; 64 + 256 = 320 px, loin des 611 px
du haut de la barre (512 px à 320 × 568) ; 20 rem au plus garde cette marge. (d) **Jamais tronqué** : le
dégradé doit atteindre 0 dans la boîte du conteneur ; un conteneur d'écran plus court que
`--size-header-glow` s'arrêterait net (vérifié par TK2.1 et TK2.2).

**Borne de `color-mix`** (D75 RK-A) : `color-mix(in srgb, var(--color-brand-primary) N%, transparent)`
est admis **dans les seuls** `--effect-action-glow`, `--effect-action-glow-hover` et
`--background-image-header-glow` du bloc KEO ; jamais dans un `--color-*`, un texte, un fond de carte ni
un contour ; **N ≤ 15 pour le halo d'en-tête**. Jamais de modificateur `/NN` sur une couleur (G3i).

**Mouvement.** Transitions de couleur (`duration-fast`, `ease-standard`), jamais `transition: all`.
**Agrandissement au survol et soulèvement des cartes gardés** (F6, fondateur, 2026-10-29, contre la
recommandation) : transformation d'état (`scale`, `translate`) **sous `motion-safe:` seulement**,
propriétés de transition nommées (couleurs et `transform`), durées par tokens ; la transformation ne
déplace pas la mise en page et l'anneau de focus reste entier. **Réduction à l'appui reprise** (D75
RK-2, amende F6) : bouton `scale-hover` **1,03** au survol (KEO, 1,02 jusqu'à D75 ; 1 en vitrine),
`scale-press` *(nouveau)* **0,98** à l'appui (1 en vitrine), jamais sur un bouton désactivé ni sur un
petit bouton du backoffice ; bouton texte sans agrandissement. Durée et courbe des boutons inchangées
(120 ms, `ease-standard`). Sous `prefers-reduced-motion`, aucune transformation, durées à zéro et
balayage du squelette supprimé (`animation: none`).

### 11.6 Ce qu'on ne prend pas de la maquette

Ce qu'on prend : la palette (vert, noirs, échelle de surfaces, gris de texte, ambre, bleu, couleurs de
rôle, violet), les deux polices, les pilules, les cartes à 16 px et filet, les lignes de 36 px, le
délai écrit avec son glyphe (`○` · `⚑`), les références en monospace, le bloc de provenance des
montants, « Brouillon sauvegardé automatiquement ».

| # | Dans la maquette | Pourquoi on ne le prend pas | À la place |
|---|---|---|---|
| K1 | Succès `#4ade80` | Vert, à 13° du vert de marque : un état « Acceptée » ressemblerait à un bouton (§8, D6) | Sarcelle `#3ccfcf` (180°, valeur KEO réaffectée, §11.3) |
| K2 | Erreur `#ff5a5f` et fond `rgba(…, .14)` | Rouge translucide interdit (D72, G3b) | Rouge opaque de D72 |
| K3 | Fonds « subtils » en `rgba` (marque, succès, alerte, info) et contours `rgba(…, .3)` | Une teinte translucide change de valeur selon la surface : contraste imprévisible, invérifiable une fois pour toutes | Fonds et contours opaques déjà validés |
| K4 | Badge « Séquestre INFLUX », `platform-escrow` `#3ccfcf` | Aucun encaissement au MVP (A1 ; D7 et D23 en V2) : « séquestre » promet une garde de fonds qui n'existe pas, activité réglementée de surcroît | Rien. Les montants suivent §6. La teinte `#3ccfcf`, elle, devient le succès (K1) |
| K5 | « Match brief : Audience B2B SaaS compatible » et son point bleu | Pas de matching au MVP (D11) ; une suggestion dit « Proposé car : … » avec des raisons vérifiables (`10` RG41) ; point de couleur seul (P7) | « Proposé car : … » quand la suggestion existera |
| K6 | Émoji cadenas dans l'onglet d'aparté | Rendu variable selon le système, hors tokens, nom accessible imprévisible | Icône `lucide` `lock`, décorative, et texte (§7) |
| K7 | Commission convenue en vert | Un montant vert se lit comme un gain ou un lien | `text-primary`, chiffres tabulaires, provenance (§6, `17b` §4.10) |
| K8 | Halo vert (`spotify-ambient-glow`), ombre lumineuse du bouton | Halo **gardé** par le fondateur (F6, 2026-10-29), de même que l'ombre lumineuse du bouton, **aux intensités de la référence** (D75 RK-1, RK-9) ; `spotify-ambient-glow` est nommé par référence (K20) | Halo ambiant d'en-tête (15 % au plus) et ombre lumineuse du bouton principal par tokens de rôle (§11.5) |
| K9 | Agrandissement au survol, réduction à l'appui, carte qui se soulève, `transition: all` | Agrandissement, soulèvement et **réduction à l'appui reprise** (F6, 2026-10-29 ; D75 RK-2) ; dans la maquette, non coupés par `prefers-reduced-motion`, en `transition: all`, avec décalage de mise en page : `transition: all` **toujours écarté** | Agrandissement 1,03 et réduction 0,98 des boutons, soulèvement des cartes, sous `motion-safe:`, transitions nommées, sans décalage (§11.5) |
| K10 | Textes en 11 px (surtitres, provenance, légendes) | Sous le plancher de 12 px, en gris et en capitales de surcroît | `text-xs` minimum ; surtitre en Manrope 700 capitales, **`text-secondary`** (D75), jamais vert |
| K11 | Carte anonymisée avec « 14 vidéos » et « 420 / post » exacts, « Rythme » en vert, identifiant `#CRT-84920` | Avant la révélation, métriques en tranches (D61, `10` F24-F25) ; une carte se réfère à un alias, jamais à un identifiant de compte (`10` RG65) | Tranches, alias, `text-primary` |
| K12 | Badge « Vérifié INFLUX » générique, près du titre | Badge par réseau, daté, avec ce qu'il n'affirme pas (`08` RG4, RG10) ; une coche bleue près d'un nom imite celle des réseaux sociaux | Badge vérifié (§11.3, §11.8) |
| K13 | Noms de marque et de créateur colorés (sable, rose) dans le tableau | Rôle porté par la couleur d'un nom : bruit sur huit heures, déjà refusé pour la messagerie (§3.1) | Point de rôle et rôle écrit, noms en `text-primary` |
| K14 | Filet gauche vert de 4 px sur une ligne | 4 px à gauche est la forme de la vue identifiée (`17b` §4.9) | Filet de 2 px `brand-primary` (`17b` §4.1) |
| K15 | « VUE IDENTIFIÉE » en pastille, dans un coin | Une pastille se perd sur une capture recadrée | Barre de 4 px sur la zone et chapeau écrit, violet conservé |
| K16 | Onglet actif rempli de vert | Deux pleins verts dans la même carte, l'onglet et « Envoyer en privé » : l'onglet se lit comme un bouton | Onglet actif `surface-active`, texte en gras |
| K17 | Phrase d'audience en `#5cf2a8` (`platform-available`) et « La marque » | Vert d'état confondu avec l'action ; la phrase nomme l'autre partie (§7.7) | `text-secondary`, icône cadenas, `{otherParty}` |
| K18 | Focus du champ par bordure verte, `outline: none` | Indicateur de focus supprimé (WCAG 2.4.7) | Anneau `focus-ring` ; contour `border-strong` des champs ; **confirmé par D75** (RK-14) |
| K19 | Polices et Tailwind chargés depuis des CDN tiers | Sécurité de contenu, adresse IP transmise à un tiers, poids sur 4G | Polices auto-hébergées, Tailwind compilé |
| K20 | Valeurs hexadécimales dans les classes, classes `spotify-*`, surfaces numérotées | CA22, G3 ; nommage par référence ou par numéro au lieu du rôle | Tokens par rôle |
| K21 | « Rencontre directe », « Zéro commission cachée », « INFLUX MARKETPLACE » | Contraire au modèle courté (D45) et au discours du pilote (D48) | Hors périmètre (vitrine, `expert-marketing`) |
| K22 | Colonne « Délai SLA » | Jargon | « Échéance » |
| K23 | `surface-5`, `neutral-border-strong`, `platform-available`, `data-4` à `data-6` | Sans usage, ou en conflit (vert d'état, couleurs de rôle, couleur du succès) | Non repris (§11.3) |

### 11.7 Test du logo : INFLUX, pas Spotify

La maquette se dit « inspirée de Spotify ». Le fondateur en a choisi la palette et les formes, pas la
ressemblance. Test de §1 : *sans le logo, reconnaît-on INFLUX ou Spotify ?*

| Signature de Spotify | Dans la maquette | Traitement INFLUX |
|---|---|---|
| Vert vif sur noir | `#1dd68a` sur `#0a0b0a` | Gardé (choix du fondateur). Plus émeraude (155° contre 141° pour le vert de Spotify), et **rare** : action principale, indicateur d'item actif, sélection ; jamais en texte courant, sur un montant ou un état |
| Panneaux arrondis flottants séparés par des gouttières noires | Cartes partout | Autorisés là où ils sont pertinents (choix du fondateur, F6), jugés par `expert-ux` écran par écran ; la colonne de navigation garde son gabarit (`17` §2.2) tant que la relecture de DS-6 ne le change pas |
| Halos de couleur derrière les en-têtes | `spotify-ambient-glow` | Gardé (choix du fondateur, F6) : token de rôle, décoratif (K8) |
| Boutons qui grossissent, cartes qui se soulèvent | `scale`, `translateY` | Gardés (choix du fondateur, F6) sous `motion-safe:` ; réduction à l'appui reprise à 98 % (D75 RK-2, K9) |
| La grande pilule verte comme geste central | Bouton principal | Gardée : une seule action principale par écran, libellé verbe + objet, ombre lumineuse par token (F6) |
| Grilles de vignettes carrées | — | Les espaces montrent des listes, des tableaux et des personnes nommées |

**Ce qui signe INFLUX** et doit se voir sur chaque gabarit : le commercial nommé (« Prénom —
INFLUX », P5), les statuts écrits et datés (P6), la provenance à côté de chaque montant (P3), la paire
de couleurs de rôle en marque visuelle, la barre violette de la vue identifiée au backoffice.

**Parades du jalon RK** *(D75)*. Zoom et réduction sur une pilule verte lumineuse, c'est le geste du
bouton de lecture de Spotify. D'où : **jamais de bouton vert rond à icône seule**, toujours un libellé
verbe + objet ; halo au vert de marque **sous l'en-tête seulement, jamais sur une carte** ; **surtitre
jamais vert** ; commercial nommé et statuts datés **visibles au premier écran** de chaque espace ; test
du logo refait par `expert-ux` en fin de jalon RK.

**En revue :** une capture de chaque gabarit, logo masqué, montrée à deux personnes extérieures au
projet. Si l'une cite Spotify en premier, on renforce d'abord les signatures INFLUX ; retirer un effet
gardé par le fondateur (F6) ou une couleur revient au fondateur.

### 11.8 Gabarits et composants

**Gabarits**

| Gabarit | Spécifié dans |
|---|---|
| Espaces membres, mobile et tablette (< 1 024 px) : en-tête + barre du bas | `17` §2.2 |
| Espaces membres, desktop (≥ 1 024 px) : colonne à gauche façon Railway | `17` §2.3 |
| Backoffice, poste de travail (≥ 1 024 px) : rail, bande de tête, lignes de 36 px | `17b` §1.7 |
| Backoffice de 768 à 1 023 px : backoffice complet, navigation en liste horizontale compacte sous la bande | `17b` §1.7 |
| Backoffice sous 768 px de large ou 500 px de haut (F7) : écran « poste de travail » jusqu'aux vues D58 | `17b` §1.7 |
| Page autonome KEO (inscription, connexion, déconnecté, compte supprimé, CGU à ré-accepter) : INFLUX et langue en tête, une colonne `container-narrow`, aucune navigation. Les pages légales publiques gardent le gabarit de la vitrine | `17` §3, §6.7 |

Règles communes (arbitrées par `chef-de-projet` le 2026-10-28) : **un seul `<nav>` « Navigation
principale », rendu une fois et restylé par le CSS** selon la largeur (`02` §21.5), sans détection de
largeur en JavaScript ni second `<nav>` masqué ; les entrées dont l'écran n'existe pas sont
**masquées**, et une entrée apparue ne disparaît plus ; **aucun repli de colonne** (rien à mémoriser :
le front n'a aucun stockage, D37) ; lien d'évitement en premier ; focus au `h1` après navigation.

**Règle du focus** *(D75 RK-13, RK-C)*. L'anneau `focus-ring` (3 px, décalé de 2 px) est visible **sur
tout élément interactif** : bouton, lien, champ, onglet, région défilante, carte à lien étiré. Il n'est
**pas dessiné sur un élément non interactif focalisé par programme** : le `h1` après une navigation, un
titre `h2` à `h4`, `main` cible du lien d'évitement. Sélecteur fermé, dans les deux `globals.css` :
`:where(h1, h2, h3, h4, main)[tabindex="-1"]:focus-visible { outline: none; }`, **jamais** un
`[tabindex="-1"]` générique (le tabindex itinérant des onglets de canaux garde son anneau). Le focus,
lui, reste posé sur le titre (annonce du lecteur d'écran, TD5.5) ; WCAG 2.4.7 vise les composants
opérables au clavier.

**Composants à livrer.** États : R repos · S survol · A appui · F focus · D désactivé · C chargement ·
E erreur. Le focus est partout l'anneau `focus-ring` (3 px, décalé de 2 px), selon la règle ci-dessus ;
un état non cité est sans objet.

| Composant | Registres | États et tokens |
|---|---|---|
| Bouton principal (pilule) | Membres, BO | R `action-primary-bg` + `text-on-action` + ombre `--effect-action-glow` · S `-hover` + ombre `--effect-action-glow-hover` + agrandissement `scale-hover` (1,03) · A `-active` + réduction `scale-press` (0,98) · D `action-disabled-bg` + `text-disabled`, `aria-disabled`, explication adjacente, **ni ombre ni transformation** · C libellé d'action en cours, `aria-busy`, largeur figée, pas d'icône tournante seule · E portée par le formulaire, jamais par le bouton. Transformations sous `motion-safe:` seulement (D75 RK-1, RK-2). Hauteur `size-button-md`/`-lg` (membres), `spacing-bo-row-h` (BO, `size-bo-control` en ligne). `font-display`, `font-weight-action` (700), `radius-pill`. **Petit bouton des écrans du backoffice** (`size-bo-control`) : ni ombre ni transformation (RK-4) ; boutons de connexion du backoffice : effets gardés |
| Bouton secondaire | Membres, BO | R `action-secondary-bg` + contour `action-secondary-border` (`border-width-action-secondary`) + `text-primary` en `font-weight-action-secondary` (600, D75 RK-3) · S `-bg-hover` + `-border-hover` + `scale-hover` · A `-bg-active` + `scale-press` · D comme le principal, sans contour, sans transformation · C idem · petit bouton BO : sans transformation |
| Bouton texte | Membres, BO | R `text-primary` en `font-weight-action-secondary` (600, D75), sans fond · S `action-secondary-bg-hover`, **sans agrandissement** · D `text-disabled` · cible ≥ `size-touch-target` (membres) |
| Bouton danger (D72) | Membres, BO | R `action-danger-bg` + `text-on-danger` · S, A `-hover`, `-active` · D `action-disabled-bg` + `text-disabled` · C idem principal · libellé qui dit l'action ; au BO, jamais par raccourci (§5, niveau 3) |
| Carte | Membres ; BO pour les blocs du tableau de bord et des fiches | R `surface-card` + `border-default` + `radius-card` (16 px) + `spacing-inset-card` ; bloc intérieur `surface-raised` + `radius-md` · **carte cliquable seulement** (D75 RK-10) : R contour `border-strong`, S `surface-raised` + contour `border-hover` · carte non cliquable : immobile · F anneau autour de la carte (lien étiré sur le titre) · C squelette de même hauteur · E notice dans la carte |
| Badge de rôle | Membres (liste fermée §11.3), BO | Point `spacing-2` `role-advertiser` / `role-creator` + rôle écrit `text-secondary` ; nom en `text-primary` (F4 maintenu, D75 RK-12) |
| Badge vérifié | Membres, BO | Pilule **remplie** `verified-bg` (D75 RK-11), contour `verified-border`, icône `badge-check` + « Vérifié · ⟨réseau⟩ · ⟨mois année⟩ » (texte F3 inchangé) en `verified-text`, `font-display` 700 |
| Badge de statut | Membres, BO | Pilule **remplie d'une teinte opaque** (D75 RK-11), libellé écrit, `font-display` 700 ; tons : neutre (`surface-raised`, `text-secondary`), succès, alerte, information (`feedback-*-bg`, texte et contour de la famille), erreur (`badge-error-bg`, texte et contour D72). **Jamais plein de vert ni d'une teinte vive** : le plein vif est réservé à l'action ; jamais vert |
| Onglets segmentés (`tablist`) — *réservés aux canaux d'une conversation (§7) depuis D74* | Membres, BO | Piste `surface-raised` + `border-default` + `radius-pill` · R inactif `text-secondary` · S `text-primary` · actif `surface-active` + `text-primary` 600 + `aria-selected` · compteurs écrits · flèches au clavier. Jamais vert |
| Sous-entrée de navigation *(D74, remplace les liens de section)* | Colonne (membres), rail (BO) | Dans l'entrée active seulement, sans icône, libellé aligné sur celui de l'entrée, `text-sm` (membres) · R `text-secondary` · S `nav-item-hover-bg` + `text-primary` · courante `nav-item-active-bg` + `text-primary` 600 + filet gauche 2 px `nav-item-active-indicator` + `aria-current="page"` ; entrée ancêtre `text-primary` 600 sans surface, sans filet, sans `aria-current`. Hauteur ≥ `size-touch-target` (membres), `spacing-bo-row-h` (BO). Liste horizontale du BO (768–1 023 px) : seconde ligne, filet en bas. Masquée sous `lg` côté membres |
| Page-menu *(D74)* | Membres (< et ≥ 1 024 px) | Liste de lignes pleine largeur dans `<main>` (pas un `<nav>`) : icône décorative, libellé `text-md` 600, phrase `text-sm` `text-secondary`, pastille de compteur éventuelle, chevron décoratif ; lien étiré sur la ligne, hauteur ≥ `size-touch-target`, séparateur `border-subtle` · S `surface-raised` · F anneau autour de la ligne. Sous-page : « ‹ ⟨rubrique⟩ » au-dessus du `h1`. Détail : `archives/jalons/sn-fiche.md` |
| Champ, zone de texte | Membres, BO | R `surface-page` + contour `border-strong` 1 px + `radius-md` ; libellé `text-primary` 600 au-dessus, aide `text-secondary`, exemple `text-tertiary` jamais seul libellé · D `surface-raised` + `text-disabled` + `border-default` · E contour `border-error` 2 px + message (icône + `feedback-error-text`) relié par `aria-describedby`, `aria-invalid`. Hauteur `size-input` (membres), `spacing-bo-row-h` (BO) |
| Notice | Membres, BO | Succès, alerte, information : fond, contour, icône et texte de la famille (texte principal `text-primary` pour l'information). Erreur D72 : fond du conteneur, contour `feedback-error-border`, icône et texte `feedback-error-*`. Icônes `circle-check`, `triangle-alert`, `circle-alert`, `info` ; `role="status"` ou `role="alert"` ; non refermable pour un état permanent ; `radius-md` |
| Tableau dense | BO | En-tête collant **`surface-hover`**, `text-sm` **Manrope 700** `text-secondary` (D75 RK-15) · lignes `surface-card`, hauteur `spacing-bo-row-h`, séparateur `border-subtle` · S et F (survol, `focus-within` du lien de la ligne) `bo-row-hover` (`surface-raised`) + filet gauche 2 px `brand-primary` par `--effect-bo-row-indicator`, ombre intérieure de largeur constante sur la **première cellule** (aucun décalage en `border-collapse` ; Safari ne dessine pas d'ombre sur un `tr`) ; aucun filet au repos ; 4 px reste réservé à la vue identifiée · C lignes en squelette à hauteur fixe · vide : les deux états de `17b` §2.3 · E notice au-dessus, lignes conservées · chiffres tabulaires |
| État vide | Membres, BO | Icône décorative `text-tertiary`, titre `text-title-section`, phrase `text-secondary` (pourquoi c'est vide, quoi faire), une action principale au plus ; ni illustration ni « 0 » |
| Squelette | Membres, BO | `color-skeleton-base` (= `surface-raised`), balayage `color-skeleton-sheen` (= `surface-hover`) supprimé sous `prefers-reduced-motion` ; hauteur finale ; `aria-busy` sur le conteneur et « Chargement… » masqué visuellement |
| Item de navigation | Colonne (membres), barre du bas (membres), rail (BO) | R `text-secondary` · S `nav-item-hover-bg` + `text-primary` · actif `nav-item-active-bg` + `text-primary` 600 + filet 2 px `nav-item-active-indicator` (gauche ; en haut dans la barre du bas) + `aria-current="page"`. Colonne : hauteur ≥ `size-touch-target`, marge `spacing-2`, `radius-md`. Barre du bas : icône sur libellé, cellule pleine hauteur, anneau intérieur (`focus-ring-offset-inset`). Rail : hauteur `spacing-bo-row-h`. Liste horizontale du backoffice (768–1 023 px) : même `<nav>`, mêmes états, filet de 2 px en bas de l'entrée active |
| Pastille de compteur | Membres ; BO en chiffres | Membres : `counter-bg` + `counter-text`, `text-xs` 700 tabulaire, `radius-pill`, « 9+ » au-delà de 9, texte masqué « ⟨n⟩ éléments nouveaux » (`17` §2.2). BO : nombre tabulaire `text-secondary`, et retard **écrit** « ⚑ ⟨n⟩ hors délai » en `bo-sla-overdue-text` |
| En-tête de page | Membres, BO | Fil d'Ariane `text-sm` `text-secondary` (à partir du niveau 2), `h1` `text-title-page` Manrope 800 `tracking-heading`, sans anneau quand il reçoit le focus après une navigation, action principale à droite (desktop) ou sous le titre, pleine largeur (mobile). Halo : fond du conteneur d'écran qui le porte (§11.5), aucun calque dans l'en-tête, un seul par page |
| Surtitre *(D75)* | Membres, BO | Ligne au-dessus d'un titre : `font-display` `text-xs` 700, capitales, `tracking-overline`, `text-secondary` ; **jamais vert**, jamais seul porteur d'une information |
| Dialogue | Membres, BO | `surface-raised` + `border-default` + `radius-card` + `shadow-lg`, voile `overlay-scrim`, focus piégé, `Échap` ferme sans perdre la saisie |

### 11.9 Points soumis au fondateur

| # | Point | Recommandation |
|---|---|---|
| F1 | Étendre la charte KEO aux pages légales publiques ? | Défaut arbitré par `chef-de-projet` : pages légales publiques en vitrine, texte des CGU affiché dans le parcours en KEO (§11.1, `02` §21.2). **Tranché (2026-10-29) : défaut confirmé**, pages légales publiques en vitrine |
| F2 | Deux verts de marque | Un seul vert, `#1dd68a`, vitrine comprise, revue visuelle D59 avant la mise en ligne de la vitrine ; le mécanisme n'en dépend pas (§11.1). **Tranché (2026-10-29) : oui**, commit DS-14 |
| F3 | Badge vérifié en bleu (KEO) plutôt qu'en vert | Oui, avec la règle de forme : jamais une coche seule, jamais collée à un nom (§11.3). **Tranché (2026-10-29) : oui** |
| F4 | Couleurs de rôle sable et rose | Marque visuelle seulement, liste fermée de quatre usages (§11.3) |
| F5 | Affectations différentes de la maquette, sans valeur nouvelle | Succès sous KEO en `#3ccfcf` (teinte « séquestre » de KEO, réaffectée : 25° du vert d'action, contre 17° pour `#2dd4bf`), vitrine inchangée ; rouge D72 conservé ; fonds `rgba` remplacés par les fonds opaques validés ; contour du bouton secondaire en `#78827d` pour rester ≥ 3:1 ; badge séquestre, vert « disponible », `surface-5` et trois couleurs de données non repris (§11.3, §11.6) |
| F6 | Effets « Spotify » de la maquette (halo, agrandissement, soulèvement, panneaux flottants) | Écartés (§11.6, §11.7). **Tranché (2026-10-29), contre la recommandation : halo, agrandissement au survol et soulèvement gardés** (sous `motion-safe:` seulement, jamais `transition: all`, durées et halo par tokens, §11.5) ; ombre lumineuse du bouton gardée, panneaux flottants autorisés là où ils sont pertinents (jugement `expert-ux`, écran par écran) ; réduction à l'appui écartée (reprise à 98 % par D75, RK-2) |
| F7 | Backoffice sur petit écran : compromis arbitré par `chef-de-projet` | De 768 à 1 023 px, backoffice complet avec la navigation en liste horizontale (fenêtre en demi-écran d'un poste de 1 920 px) ; sous 768 px, aucun contenu métier jusqu'aux vues D58 (`17b` §1.7). Effet de bord à connaître : un téléphone tenu à l'horizontale dépasse souvent 768 px et voit alors le backoffice complet. **Tranché (2026-10-29), selon la recommandation : compromis gardé, plus une condition de hauteur** (écran « poste de travail » aussi quand la hauteur est sous 500 px, ce qui couvre le téléphone en paysage) |
