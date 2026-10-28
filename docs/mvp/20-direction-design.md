# Direction design — références, principes et zone de saisie des apartés

> **Date :** 2026-09-24 · **Auteur :** `expert-ux`
> **Skills appliquées :** `design-system-influx` (tokens, registres, accessibilité),
> `messaging-spec` (apartés, par renvoi), `backoffice-ops` (niveaux de confirmation, par renvoi).
>
> **Ce que ce document produit :** la **carte des références de comportement** par surface, les
> **sept principes** propres à INFLUX qu'aucune référence ne fournit, les **niveaux de
> confirmation** des actions, la **règle de provenance des montants**, la **conception UX des
> apartés** (D47) et les **angles morts** du dark theme.
>
> **Ce qu'il ne tranche pas :** les valeurs de la palette (**D6 n'est pas rouverte**), les règles de
> gestion des apartés (additif de `12`, à écrire par `product-owner` **sous veto
> d'`expert-conformite-rgpd`**), les écrans déjà détaillés dans `17` et `17b`, qui priment pour
> leur périmètre. **Ce document cite les règles, il ne les réécrit pas.**
>
> **Statut :** proposition d'`expert-ux`, qui s'applique dès maintenant aux spécifications.
> **Arbitrages du fondateur du 2026-09-24** sur Q1 à Q5 (§9) : les cinq recommandations sont
> retenues. Elles sont reportées dans `CLAUDE.md` (§4.3, §5.1, D6, D47, **D58**, **D59**),
> `12` (§K) et `17b` (§0, M4).
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

**Le style vient d'une seule source :** `apps/web/src/styles/tokens.css` (D6), plus l'extension
`tokens-backoffice.css` (`17b` §6.5).

**Test en revue :** *sans le logo, reconnaît-on INFLUX, ou la référence ?* Un écran où l'on
reconnaît Linear est refusé, même s'il n'utilise que des tokens.

---

## 2. Trois registres visuels

Rappel de `17` §1.1 et `17b` §0, qui les fondent. Un composant n'est jamais partagé entre
registres sans vérifier qu'il respecte les règles du registre d'arrivée.

| Registre | Utilisateur et contexte | Densité | Référence de largeur |
|---|---|---|---|
| **Vitrine** (pages publiques) | Visiteur, 10 secondes pour comprendre | Respiration généreuse, un bouton principal par section | Mobile 375 et desktop 1440 |
| **Espaces membres** | Créateur **sur mobile, debout, en 4G** ; marque au bureau | Mobile-first, une décision par écran sur mobile, cibles de 2,75 rem | Mobile 375 (conception), desktop 1440 |
| **Backoffice** | Commercial, huit heures par jour | Dense : tableaux, lignes de 36 px, raccourcis | ≥ 1280 px ; sur téléphone, vue limitée à deux gestes, conversation et file (D58) |

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

### 3.1 Références écartées, et pourquoi

| Référence | Pourquoi elle n'est pas un modèle |
|---|---|
| **Discord** pour la messagerie | Registre communautaire, alors qu'il s'agit d'une négociation qui fait preuve. Rôles portés par la couleur du pseudo, ce que `12` RG7 interdit. Écrire dans le mauvais salon y est l'erreur classique : avec les apartés, c'est un incident |
| **Stripe** pour la logique des montants | Stripe affiche de l'argent **calculé**. Au MVP, l'application ne calcule rien et n'affiche aucun taux (`CLAUDE.md` §3, D48) : reprendre sa décomposition suggère un calcul et invite à le « compléter » |
| **Vercel** comme modèle visuel de la landing | Il vend à des développeurs, presque sans visages. La landing, déjà réalisée et seul code conservé (D44), a pris une autre direction, choisie par le fondateur (carte métallisée, le 2026-09-17) |

**Concurrents.** wekollab.fr reste la référence officielle de finition (`CLAUDE.md` §2). `17` §1.2
consulte aussi Malt, Upwork et Kolsquare pour les places de marché à deux faces. Un concurrent
sert à comprendre les conventions du métier, jamais à en copier l'apparence.

---

## 4. Sept principes propres à INFLUX

Aucune référence ne les fournit : ils viennent du modèle de place de marché courtée.

| # | Principe | Pourquoi | Vérification en revue | Règles liées |
|---|---|---|---|---|
| **P1** | **Emprunter des comportements, jamais des styles** | Un produit cohérent plutôt qu'un patchwork | Aucune valeur hors tokens ; test du logo (§1) | D4, D6 |
| **P2** | **Chaque zone de saisie annonce qui lira le message** | Avec le fil commun, deux apartés et la note interne, le commercial a **quatre audiences** dans un seul écran | La phrase d'audience nomme les lecteurs, est visible sans interaction et change avec le canal | `17b` §3.4.b ; §7 |
| **P3** | **Chaque montant dit qui l'a saisi et quand** | Au MVP, rien n'est calculé : un montant sans auteur ressemble à un résultat de calcul | Aucun montant sans auteur et date au backoffice ; aucun taux ; aucun montant déduit d'un taux | `CLAUDE.md` §3, `14` RG73 ; §6 |
| **P4** | **La révélation est un moment, pas un changement d'état** | C'est l'instant le plus sensible du produit et le fait générateur de la créance | Écran plein, humain nommé, horodatage affiché ; jamais une carte qui se dévoile en rafraîchissant une liste | D45, `17` §7.2 |
| **P5** | **Le commercial est une personne** | Son métier *est* le produit ; un logo ne négocie pas | Partout où il agit : « Prénom — INFLUX », rôle écrit, photo **facultative, au choix de l'agent** (sinon initiales) ; jamais signé « l'équipe » dans une mise en relation | `12` RG5, RG7 |
| **P6** | **Le délai est promis et visible** | Un délai affiché puis tenu construit la confiance ; un silence la détruit | Tout état d'attente dit **qui** doit agir et **avant quand** | D39, D45, D49, `10` RG52 |
| **P7** | **La couleur ne porte jamais seule une information** | Daltonisme, impression, capture recadrée | Chaque état a un texte ou une forme ; la couleur ne fait que renforcer | `CLAUDE.md` §5.2 point 7 |

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
enregistre et les additionne, **elle ne les déduit jamais d'un taux** (`CLAUDE.md` §3). `14` RG73
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
- Cadre de 2 px `color-chat-private-border` : 4,27:1 sur `surface-page`, 4,07:1 sur
  `surface-muted`, 4,00:1 sur `surface-card` (≥ 3:1 exigé pour un composant d'interface) ✅.

---

## 8. Angles morts du dark theme

| Sujet | Risque | Action | Qui | Quand |
|---|---|---|---|---|
| **Logos de marques** | Dessinés pour fond blanc, ils disparaissent sur fond noir | Tout logo déposé s'affiche sur une pastille claire, alias `color-logo-plate` (§10) | `expert-ux` | Lot 2 (profil marque) |
| **E-mails** | Les clients de messagerie inversent les couleurs à leur manière ; le code de connexion (D43) doit rester lisible partout | Gabarit d'e-mail propre, testé en clair et en sombre dans les principaux clients | `expert-marketing` + `expert-integrations-api` | Lot 1 |
| **Lecture en extérieur** | Un fond sombre se lit moins bien en plein soleil, cas typique du créateur | Test des écrans créateur **dehors, sur un vrai téléphone** | `testeur` + `expert-ux` | Recettes des Lots 2 et 6 |
| **Gris pâles** | Les références « premium » descendent sous le contraste AA | Plancher : `color-text-tertiary`, réservé aux aides et mentions | Revue `expert-ux` | Permanent |
| **Vert d'action / vert de succès** | Un badge « Acceptée » vert ressemble à un bouton | Séparés dans les tokens (succès en sarcelle) ; `CLAUDE.md` §5.1 aligné le 2026-09-24 (Q5) | Fondateur | Fait |
| **Maquette** | La messagerie de la maquette reprend la palette de WhatsApp Web, en dur : l'écran central du modèle ressemble à une autre marque devant les partenaires | À corriger si `chef-de-projet` juge que cela fausse la vision présentée (`CLAUDE.md` §16.2 point 1) | `chef-de-projet` | Avant les démonstrations |

---

## 9. Questions ouvertes

| # | Question | Recommandation | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | Un membre peut-il **ouvrir lui-même** l'aparté ? | **Tranchée (fondateur, 2026-09-24) : oui.** L'onglet est toujours présent pour les deux parties. C'est là que se dit ce qu'on ne dit pas devant l'autre, qui est la valeur d'un courtier ; et un onglet toujours présent ne révèle l'existence d'aucun aparté donné. Reste à écrire en règles dans l'additif de `12` | `product-owner`, veto `expert-conformite-rgpd` | Avec l'additif de `12` |
| **Q2** | Un aparté est-il lu par **tous les agents participants**, ou par le seul commercial responsable ? | **Tranchée (fondateur, 2026-09-24) : tous les agents participants**, chaque lecture journalisée : un commercial qui reprend l'affaire doit lire l'historique. Écrite en `12` RG116 et RG130 | — | Fait |
| **Q3** | Faut-il une **vue mobile minimale du backoffice** ? `17b` M4 l'écarte sous 1024 px. Or le commercial participe à chaque conversation, avec un délai d'un jour ouvré, et le métier se fait aujourd'hui en déplacement | **Tranchée (fondateur, 2026-09-24) : oui — D58.** Limitée à deux gestes : lire et répondre dans une conversation dont on est participant ; prendre en charge, valider ou refuser dans la file. Le reste du backoffice reste un poste de travail. Restent : les conditions de session sur téléphone, puis les écrans en additif de `17b` | `architecte` + `expert-cybersecurite` (session, second facteur), puis `expert-ux` | Conditions avant le Lot 4 |
| **Q4** | Direction visuelle de la landing : **carte métallisée premium** (actuelle) ou **sobriété façon Vercel** ? | **Tranchée (fondateur, 2026-09-24) : oui — D59.** La direction actuelle est conservée, avec un **budget d'effets** : un seul effet spectaculaire par écran visible. Reste la revue visuelle de la page rendue, pour appliquer ce budget | `expert-ux` | Avant la mise en ligne du Lot 1 |
| **Q5** | Aligner `CLAUDE.md` §5.1, qui présente le vert comme couleur « d'accent, d'action et de succès », alors que les tokens donnent au succès sa propre teinte | **Tranchée (fondateur, 2026-09-24) : oui.** `CLAUDE.md` §5.1 et D6 alignés : le vert est la couleur de marque et d'action, le succès a sa propre teinte (sarcelle) | — | Fait |
| **Q6** | Un **mode clair** pour les espaces membres, plus tard ? | Pas au MVP. Garder des tokens nommés par rôle pour ne pas le rendre coûteux ; décider après le pilote, au vu des tests en extérieur (§8) | Fondateur | Après le pilote |

---

## 10. Tokens proposés

> **Rouge « danger » opaque (D72, `jalons/zone-de-danger-fiche.md` §5).** Aucun rouge translucide ni
> teinté en fond (`rgba`, `hsla`, `#rrggbbaa`, `color-mix`, modificateur `/NN`). Une erreur ou un avertissement
> destructif = fond du conteneur + bordure rouge pleine 1 px + icône + texte rouge opaque ; une action
> destructive = bouton rouge plein, texte clair. Tokens, à l'identique dans `apps/web` et `apps/backoffice` :
> `feedback-error-text` et `-icon` `#ec5d5e`, `feedback-error-border` et `border-error` `#e5484d`,
> `feedback-error-bg` `transparent`, `action-danger-bg` `#b92c2c` (survol `#c93636`, appui `#a32424`),
> `text-on-danger` (alias de `text-primary`), `decorative-progress` `#cc1a0d`. Garde G3b.

Trois **alias**, aucune nouvelle valeur : ils relèvent d'`expert-ux` (skill `design-system-influx`,
« Ajouter un token »). Ils rejoindront `tokens.css` quand le produit réel les utilisera.

| Token | Valeur | Rôle | Quand ne pas l'utiliser |
|---|---|---|---|
| `--color-chat-private-border` | `var(--color-border-strong)` | Cadre de 2 px du champ de saisie d'un aparté | Pour tout autre champ : il perdrait sa valeur de signal |
| `--color-chat-private-surface` | `var(--color-surface-muted)` | Fond de la zone des messages d'un aparté, en renfort | Seul, sans bandeau ni icône (P7) |
| `--color-logo-plate` | `var(--color-surface-inverse)` | Pastille claire derrière un logo de marque déposé | Section pleine largeur (interdite, `CLAUDE.md` §5.1) ; photo de créateur ou visuel de portfolio |
