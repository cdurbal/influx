# Parcours et écrans des espaces membres — marque et créateur

> **Date :** 2026-09-19 · **Auteur :** agent `expert-ux` · **Statut :** conception UX complète des
> **deux espaces membres** du MVP (`apps/web`), soumise au fondateur (branding, §9),
> à `expert-conformite-rgpd` (veto : information des personnes, libellés du badge, texte
> d'acceptation) et à `product-owner` (cohérence avec les règles de gestion).
>
> **Skill appliquée :** `design-system-influx` (format de sortie, checklist d'accessibilité,
> procédure de token).
>
> **Documents qui contraignent celui-ci, et qui priment en cas d'écart :** `CLAUDE.md` §2 à §5 ·
> `docs/mvp/00-cadrage-mvp-v2.md` §6.1 et §6.2 · `03-matrice-des-droits-et-rls.md` (ce qu'un membre
> ne voit jamais) · `05-spec-inscription-et-leads.md` · `06-criteres-profil-marque.md` ·
> `07-criteres-profil-createur-reseaux-audience.md` · `08-verification-et-badge.md` ·
> `09-criteres-campagne.md` · `10-recherche-createurs-anonymisee.md` ·
> `11-recherche-campagnes-et-candidature.md` · `12-messagerie-a-trois.md` ·
> `13-file-de-validation-et-mise-en-relation.md`.
> Référence de forme : `docs/landing-page/02-ux-wireframes.md` §2 et §2.8.
> Tokens : `apps/web/src/styles/tokens.css` (**D6 tranchée, dark theme, 2026-09-17**).
>
> **Ce que ce document tranche :** l'architecture de l'information des deux espaces, la navigation,
> le routage, les wireframes, la hiérarchie de chaque écran, les états, les clés de traduction et
> les tokens employés.
>
> **Ce qu'il ne tranche pas :** les règles de gestion (elles sont **citées**, jamais redéfinies), la
> copie finale (`expert-marketing` pour le ton, juriste pour les mentions légales), le backoffice
> (`15` et `16`), l'implémentation (`dev-react-node`).
>
> **Invariant rappelé :** au MVP, **aucun taux et aucun calcul de commission dans le code**
> (`CLAUDE.md` §3, régime transitoire). Les montants nets affichés au créateur sont **lus dans le
> référentiel des tranches** (`07` RG72, `09` RG59, `11` RG57). Aucun écran de ce document ne
> multiplie un montant par un taux.

---

## 0. Conventions de lecture

| Notation | Sens |
|---|---|
| `espace.x.y` | Clé de `apps/web/src/locales/{fr,en}/<fichier>.json`, format ICU (D28, next-intl) |
| **Max** | Longueur maximale en caractères, espaces compris, **en FR comme en EN**. Au-delà on réécrit, on ne tronque jamais |
| `[■ Libellé]` / `[□ Libellé]` | Bouton principal / bouton secondaire |
| `[× Libellé]` | Bouton destructif ou de refus (secondaire + libellé explicite, jamais rouge seul) |
| `[◦ Libellé]` | Bouton texte |
| `[i:nom]` | Icône `lucide-react`, décorative (`aria-hidden`) sauf mention contraire |
| `( ) / (•)` | Choix exclusif non sélectionné / sélectionné |
| `[ ] / [x]` | Case à cocher non cochée / cochée |
| `▣` | Image (logo de marque, visuel de portfolio modéré) |
| `A` · `I` · `N` | Couche de visibilité d'un champ créateur : **A**nonyme · **I**dentifiée après révélation · i**N**terne (`07` RG16) |
| `06 RG73` | Renvoi à une règle de gestion existante. **Ce document ne crée aucune règle de gestion.** |
| Largeurs | Mobile 375 px (référence de conception) · Desktop 1440 px, contenu dans `container-max` |

**Trois règles de lecture des wireframes.**

1. Un schéma montre **la hiérarchie et l'ordre du DOM**, jamais la mise en forme finale.
2. Les mots inscrits indiquent **l'intention du texte**, pas sa formulation : la copie relève de
   `expert-marketing`, les mentions légales du juriste.
3. Tout ce qui est affiché à l'écran est **aussi contrôlé côté serveur**. Un champ absent de l'écran
   mais présent dans la réponse d'API est une fuite (`07` RG18, `10` RG48, `13` RG71) : ce document
   ne conçoit jamais un masquage d'affichage.

---

## 1. Cadrage : populations, tâches, enseignements du benchmark

### 1.1 Les deux populations et leur tâche réelle

| | **Marque** (rôle `advertiser`) | **Créateur** (rôle `creator`) |
|---|---|---|
| Contexte d'usage | Desktop en journée, au bureau, entre deux réunions. Session longue, multitâche | **Mobile, debout, entre deux tournages.** Session courte, interrompue, souvent en 4G |
| Tâche dominante | « Trouver 3 créateurs crédibles pour ma campagne, sans y passer la semaine » | « Est-ce que cette offre vaut mon temps, et **combien je touche** ? » |
| Ce qu'elle craint | Payer pour une audience achetée ; perdre du temps avec des profils hors sujet | Travailler pour rien ; découvrir une retenue après coup ; être fantôme |
| Rythme de retour | 1 à 3 fois par semaine pendant une campagne | 1 fois par jour au début, puis à la notification |
| Vocabulaire | campagne, brief, livrables, droits d'usage, budget | offre, contenu, tarif, **ce que je touche**, délai |
| Conséquence de conception | Densité acceptable, tableaux, filtres, prévisualisation | **Mobile-first strict**, une décision par écran, pouce atteignable, texte court |

**Conséquence non négociable** (`CLAUDE.md` §5.2 principe 2, D41) : **aucun écran n'est partagé
entre les deux rôles.** Pas de composant « profil » générique paramétré par un rôle, pas de
navigation commune conditionnée, pas de libellé mutualisé. Les seuls écrans réellement communs sont
ceux du §3 (inscription/connexion, avant que le rôle n'existe) et du §6 (mes données, mes sessions),
et même là le **vocabulaire diffère** dès que le rôle est connu.

### 1.2 Enseignements du benchmark

**wekollab.fr**, consulté pour la fonction des blocs, jamais pour le texte ni le visuel — complété
par ce que font les places de marché à deux faces (Malt, Upwork, Kolsquare) sur les points précis
traités ici.

| Ce qui fonctionne ailleurs | Ce qu'INFLUX fait autrement, et pourquoi |
|---|---|
| Profil créateur avec photo, pseudo, abonnés exacts | **Interdit** (`07` RG29, `10` RG48). L'attractivité est portée par le **titre court, le portfolio modéré, les tranches et les badges datés** — pas par un visage |
| Compteur exact de résultats (« 248 créateurs ») | **Tranche** (`10` RG59). Un compteur exact est un oracle de ré-identification. Contrepartie UX : la tranche doit être **affichée comme une information de confiance**, pas comme une excuse |
| « Contacter » directement depuis une carte | **Impossible** (A9). L'action est « demander une mise en relation », et le bouton **énonce le processus et son délai** (`10` RG52, D39) : promettre un contact immédiat fabrique la déception |
| Score de compatibilité en pourcentage | **Interdit** (`10` RG5). Remplacé par la ligne « Proposé car : … », 2 à 4 raisons **vérifiables sur la carte** (`10` RG41) |
| Onboarding en 8 étapes obligatoires avant d'entrer | Inscription en **3 écrans, sans mot de passe** (`05` RG2). Le profil se complète **après**, depuis l'espace, avec une complétude **factuelle et mesurable** (`06` RG61, `07` RG90) |
| Messagerie « comme WhatsApp », pièces jointes libres | **Conversation à trois, commercial nommé, aucune pièce jointe** (`12` RG2, RG36). Un canal de documents séparé, contrôlé, sans contrat ni facture (`12` §F) |
| Prix affiché « à partir de X € HT » | **Trois notions nommées côte à côte** côté créateur (`07` RG69), **coût total seul** côté marque (`06` RG32, `09` RG61). Jamais « HT » ni « TTC » tant que D7 est ouverte |
| Badge « Vérifié » générique | Badge **par réseau, daté, avec ce qu'il n'affirme pas** (`08` RG4, RG10). C'est moins flatteur et c'est défendable devant une marque mécontente |

### 1.3 Les six décisions de conception qui structurent tout le reste

1. **Une décision par écran sur mobile.** Le créateur n'a jamais deux actions principales à l'écran.
2. **Le montant ne se découvre jamais.** Partout où un chiffre d'argent apparaît côté créateur, les
   trois notions sont nommées **au même endroit, dans le même bloc, avec la devise** (§7.3).
3. **Le statut est toujours écrit.** Les 6 états d'une campagne, les 5 d'un profil, les 8 d'une
   candidature et les 8 d'une mise en relation portent chacun un **libellé textuel** ; la couleur ne
   fait que renforcer (`09` RG110, `11` RG80, `13` RG117).
4. **Aucun bouton désactivé sans explication adjacente** (`09` RG4, `11` RG46). Un bouton gris muet
   est un défaut de conception, pas une protection.
5. **Le brouillon se sauvegarde seul** (`06` RG83, `07` RG111, `09` RG108, `11` RG52). Aucun écran de
   ce document ne perd une saisie, y compris au dépôt d'un fichier et y compris sur erreur serveur.
6. **Rien n'invite à sortir de la plateforme.** Aucun `mailto:`, aucun lien cliquable dans un
   message (`12` RG41), aucun bouton « échanger nos coordonnées », aucune notification contenant un
   extrait de texte (`12` RG90).

---

## 2. Architecture de l'information des deux espaces

### 2.1 Ce que contient chaque espace, et rien d'autre

La règle appliquée : **un item de navigation = une tâche récurrente**. Tout ce qui se fait une fois
(compléter un profil, lire les CGU) vit sous un item existant, pas dans la barre.

| | **Espace marque** `/[locale]/marque/…` | **Espace créateur** `/[locale]/createur/…` |
|---|---|---|
| 1 | **Accueil** — ce qui attend une action de ma part | **Accueil** — ce qui attend une action de ma part |
| 2 | **Mes campagnes** — liste, création, états, prévisualisation | **Campagnes** — le fil des offres ouvertes, filtres, fiche |
| 3 | **Créateurs** — recherche anonymisée, sélections | **Mes candidatures** — les 8 états, compteur de plafond |
| 4 | **Mises en relation** — 2 onglets : *demandes* · *conversations* | **Mes relations** — 2 onglets : *invitations* · *conversations* |
| 5 | **Mon compte** — profil marque, informations, données, sessions, aide | **Mon compte** — profil créateur, informations, données, sessions, aide |

**Pourquoi le profil n'est pas un item de navigation.** Ni côté marque, ni côté créateur. Le profil
est une tâche d'installation, pas une tâche quotidienne : il vit sous « Mon compte », et il est
**rappelé par une carte d'action sur l'accueil** tant qu'il n'est pas publié (§2.4). Lui donner un
cinquième onglet permanent reviendrait à occuper 20 % de la barre mobile pour un écran visité trois
fois dans la vie du compte.

**Ce qui n'existe dans aucun des deux espaces**, et qui doit être refusé si la demande revient :
annuaire des marques (`06` RG4), profil créateur accessible par URL devinable (`06` RG75, `10` RG65),
export d'une liste (`10` RG63, condition `03` C(17)), compteur de vues ou de candidatures côté
créateur (`09` RG82, `11` RG25), note, avis, étoile (`06` RG24, `07` RG31), et **tout écran affichant
un net créateur à une marque** (`06` RG32, `07` RG70, `09` RG61, `11` RG59).

### 2.2 Navigation mobile : barre du bas, 5 items, jamais 6

```
Mobile 375 — gabarit commun aux deux espaces
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │  En-tête collant, header-height
│ │ INFLUX        [i:bell]³  [FR|EN]    │ │  z-header
│ └─────────────────────────────────────┘ │
│                                         │
│  Titre de page (h1)                     │  <main id="contenu">
│  …                                      │  padding bas =
│  contenu défilant                       │  size-nav-bottom-height + space-5
│  …                                      │  (le contenu n'est jamais masqué
│                                         │   par la barre)
│                                         │
│ ┌─────────────────────────────────────┐ │  Barre du bas, fixée
│ │ [i:home] [i:megaphone] [i:search]   │ │  z-nav-bottom (< z-header)
│ │  Accueil  Campagnes   Créateurs     │ │  size-nav-bottom-height
│ │ [i:handshake]²  [i:user]            │ │  chaque cible ≥ size-touch-target
│ │  Relations      Compte              │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

| Règle | Détail |
|---|---|
| Libellé toujours visible | Jamais d'icône seule. Une icône seule oblige à apprendre un vocabulaire visuel ; un créateur qui vient trois fois par mois ne l'apprend pas. `text-xs`, Max 11 caractères FR **et** EN |
| Item actif | **Trois porteurs simultanés** : `aria-current="page"`, libellé en `font-weight-semibold` + `color-text-primary`, et un **trait supérieur** de 2 px `color-brand-primary`. Jamais la couleur seule (`CLAUDE.md` §5.2 point 7) |
| Pastille de compte | Nombre **exact jusqu'à 9**, puis « 9+ ». Accompagnée d'un texte masqué visuellement : « 3 éléments nouveaux ». Jamais un simple point coloré |
| Sémantique | `<nav aria-label="Navigation principale">` + `<ul>` de liens `next/link`. **Des liens, pas des boutons** : l'ouverture dans un nouvel onglet doit fonctionner |
| Un seul `<nav>` exposé | La barre du bas et la colonne latérale ne coexistent jamais dans le DOM : rendu conditionnel par point de rupture, pour ne pas exposer deux navigations aux lecteurs d'écran |
| Sous-navigation | Les onglets internes (ex. *demandes* / *conversations*) sont un `role="tablist"` **dans la page**, jamais un sixième item de barre |

### 2.3 Navigation desktop : colonne latérale persistante

```
Desktop 1440
┌────────────────────┬──────────────────────────────────────────────────────────┐
│ INFLUX             │  Fil d'Ariane · Titre de page (h1)      [i:bell]³ [FR|EN]│
│                    ├──────────────────────────────────────────────────────────┤
│ [i:home] Accueil   │                                                          │
│ [i:megaphone]      │   Contenu, largeur container-max                         │
│   Mes campagnes  4 │                                                          │
│ [i:search]         │   Grille 12 colonnes                                     │
│   Créateurs        │   Colonne de droite « collante » (sticky-top-offset)     │
│ [i:handshake]      │   pour les récapitulatifs et les actions                 │
│   Mises en relat. 2│                                                          │
│ [i:user] Mon compte│                                                          │
│ ─────────────────  │                                                          │
│ Profil : publié ✓  │                                                          │
│ Complétude 78 %    │   (bloc d'état du compte, bas de colonne)                │
│ [◦ Aide]           │                                                          │
│ [◦ Se déconnecter] │                                                          │
└────────────────────┴──────────────────────────────────────────────────────────┘
   largeur fixe 16 rem, ≥ breakpoint-lg seulement
```

- Sous `breakpoint-lg` : la colonne disparaît, la barre du bas apparaît. **Aucun menu « hamburger »
  dans l'espace membre** : cinq items tiennent dans une barre, un menu caché coûte un geste par
  navigation.
- Le **bloc d'état du compte** en bas de colonne (état du profil + complétude) n'existe que côté
  desktop. Sur mobile, il vit sur l'accueil. La complétude **n'est jamais affichée à l'autre
  partie** (`06` RG57, `07` RG86).

### 2.4 Ce que voit un compte tout neuf

C'est l'écran le plus important de l'espace, et celui qu'on oublie toujours : à J+0, **tout est
vide**. L'accueil n'affiche donc pas des données, il affiche **la prochaine action**.

**Marque, compte créé il y a 30 secondes :**

| Bloc | Contenu | Règle |
|---|---|---|
| 1. Carte d'action | « Complétez votre profil de marque » + ce qui manque, nommé · `[■ Compléter mon profil]` | `06` RG5, RG61 |
| 2. Ce qui est verrouillé, **dit à l'avance** | « Publier une campagne » et « Rechercher des créateurs » apparaissent **présents et expliqués**, pas cachés : « disponible une fois votre profil publié » | `09` RG4, `10` RG1, `06` `brandProfile.search.blockedUntilPublished` |
| 3. Comment ça marche | 3 étapes, texte court : profil → campagne → un commercial vous met en relation | A9, `10` RG52 |
| 4. Rien d'autre | Pas de faux graphique, pas de « 0 » partout, pas de squelette permanent | §2.8 de `02`, état vide |

**Créateur, compte créé il y a 30 secondes :**

| Bloc | Contenu | Règle |
|---|---|---|
| 1. Carte d'action | « Complétez votre profil » + la liste nominative de ce qui manque | `07` RG4, RG90 |
| 2. Le verrou expliqué | « Pour publier votre profil, INFLUX doit constater que vous êtes bien propriétaire d'au moins un compte » + `[■ Faire vérifier un compte]` | `08` RG16 |
| 3. Le fil des campagnes est **déjà ouvert** | Un créateur en brouillon **peut lire les campagnes** ; chaque fiche affiche ce qui lui manque pour candidater | `09` RG99, `11` RG13, RG23 |
| 4. Ce que je toucherai | Un encart pédagogique unique : les trois notions nommées, sans chiffre | `07` RG69 |

**Marque, recherche fermée (D38 non atteinte).** L'item « Créateurs » **reste dans la navigation**
et mène à un écran utile : les critères sont saisissables, aucune liste n'est affichée, et le
bouton `search.action.askTeam` est l'action principale (`10` RG3, RG61). Message unique
`search.closed.notice`. **Ne jamais retirer l'item** : un item qui disparaît fait croire à une
régression du produit, alors qu'il s'agit d'un paramètre en table.

### 2.5 Routage après vérification du code

Le routage suit **le rôle réel du compte**, jamais la porte empruntée (`05` RG66).

| Situation | Destination | Message |
|---|---|---|
| Compte annonceur | `/[locale]/marque` | — |
| Compte créateur | `/[locale]/createur` | — |
| Adresse inconnue | Écran 3 (informations), porte conservée | — |
| Rôle différent de la porte | Espace du **rôle réel**, bandeau d'information persistant jusqu'à la première navigation | `auth.roleMismatch.notice` (`05` RG67) |
| Rôle `agent` / `admin` | **Aucune session membre.** Écran d'information renvoyant vers l'espace interne | `auth.internalAccount.notice` (`05` RG68) |
| Compte suspendu | Aucune session. Écran neutre | `auth.suspended.notice` (`05` RG69) |
| Nouvelle version de CGU | Écran de ré-acceptation **bloquant**, avant toute page | `05` RG28 |
| Destination demandée avant connexion | Reprise après connexion, **uniquement si elle appartient à l'espace du rôle réel** ; sinon accueil de l'espace | `05` RG66 |

**Aucun de ces messages n'apparaît avant la vérification du code** (`05` RG113, RG46) : le parcours
est strictement identique, en contenu et en durée, tant que le code n'a pas été vérifié.

### 2.6 Adresses et libellés d'URL

| Espace | Chemin | Note |
|---|---|---|
| Marque | `/[locale]/marque`, `/campagnes`, `/campagnes/[id]`, `/createurs`, `/selections`, `/relations`, `/relations/[reference]`, `/compte/*` | `[id]` de campagne **opaque**, jamais séquentiel |
| Créateur | `/[locale]/createur`, `/campagnes`, `/campagnes/[id]`, `/candidatures`, `/relations`, `/relations/[reference]`, `/compte/*` | Une carte créateur est référencée par son **alias** (`10` RG65) |
| Commun | `/[locale]/connexion` (3 écrans), `/[locale]/compte/donnees`, `/sessions`, `/aide` | — |

Les segments sont **traduits par langue** (`/marque` ↔ `/brand`, `/campagnes` ↔ `/campaigns`) via le
routage localisé de next-intl : une URL en anglais qui affiche des segments français trahit une
localisation de façade. Toutes les pages de l'espace membre sont `noindex` et derrière session.

---

## 3. Le parcours d'inscription et de connexion

**Population :** un visiteur qui vient de cliquer sur l'une des deux portes, ou un membre qui
revient. **Tâche :** entrer, en moins d'une minute, sans mot de passe.

**Principe directeur :** il n'y a **qu'un seul parcours** pour s'inscrire et pour se connecter
(`05` RG2). Il n'existe aucun lien « J'ai déjà un compte » — il n'aurait nulle part où mener. Le
parcours est donc nommé **« Continuer avec mon e-mail »**, jamais « S'inscrire » ni « Se connecter ».

```
                  Porte annonceur          Porte créateur
                         │                       │
                         └───────────┬───────────┘
                                     ▼
                   ┌─────────────────────────────────┐
                   │ Écran 1 — votre adresse e-mail  │  profil choisi, rappelé, modifiable
                   └───────────────┬─────────────────┘
                                   ▼  (réponse identique dans tous les cas, RG46)
                   ┌─────────────────────────────────┐
                   │ Écran 2 — code à 6 chiffres     │  phrase de correspondance, RG48
                   └───────────────┬─────────────────┘
                     compte connu  │  adresse inconnue
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
        routage §2.5                   ┌─────────────────────────────┐
                                       │ Écran 3 — informations      │  2 variantes, jamais fondues
                                       └──────────────┬──────────────┘
                                                      ▼  transaction unique (RG7)
                                              espace du rôle
```

### 3.1 Écran 1 — votre adresse e-mail

```
Mobile 375                                Desktop 1440 (colonne centrée, container-narrow)
┌───────────────────────────────┐        ┌──────────────────────────────────────────────┐
│ INFLUX              [FR|EN]   │        │ INFLUX                             [FR|EN]   │
├───────────────────────────────┤        ├──────────────────────────────────────────────┤
│ ┌───────────────────────────┐ │        │            ┌──────────────────────────────┐  │
│ │ Vous vous inscrivez comme │ │        │            │ Vous vous inscrivez comme    │  │
│ │ MARQUE       [◦ Changer]  │ │        │            │ MARQUE         [◦ Changer]   │  │
│ └───────────────────────────┘ │        │            └──────────────────────────────┘  │
│                               │        │                                              │
│ Continuer avec votre e-mail   │ h1     │            Continuer avec votre e-mail   h1  │
│ Pas de mot de passe : nous    │        │            Pas de mot de passe : nous vous   │
│ vous envoyons un code.        │        │            envoyons un code à 6 chiffres.    │
│                               │        │                                              │
│ Adresse e-mail *              │ label  │            Adresse e-mail *                  │
│ ┌───────────────────────────┐ │        │            ┌──────────────────────────────┐  │
│ │                           │ │ input  │            │                              │  │
│ └───────────────────────────┘ │        │            └──────────────────────────────┘  │
│                               │        │                                              │
│ [■ Recevoir mon code        ] │        │            [■ Recevoir mon code           ]  │
│                               │        │                                              │
│ [i:shield] Ce que nous faisons│        │            [i:shield] Ce que nous faisons    │
│ de votre adresse — finalités, │ RG6    │            de votre adresse …                │
│ Brevo et Apollo.io nommés,    │        │                                              │
│ vos droits, lien politique.   │        │            (2 colonnes ≥ lg : formulaire à   │
│                               │        │             gauche, mention à droite)        │
│ CGU · Confidentialité · Aide  │        │                                              │
└───────────────────────────────┘        └──────────────────────────────────────────────┘
```

| Bloc | Contenu | Règle |
|---|---|---|
| Rappel de porte | Le profil choisi, **modifiable jusqu'à la création du compte**. « Changer » revient au choix de porte et **décoche le consentement** et efface les champs du profil abandonné | `05` RG3, RG4 |
| Champ e-mail | Étiquette visible, `type="email"`, `inputmode="email"`, `autocomplete="email"`, `spellcheck="false"`. **Jamais un texte d'exemple seul** | `05` RG115 |
| Mention d'information | **Visible dès cet écran**, pas repliée dans un accordéon fermé : finalités, **Brevo et Apollo.io nommés**, droits, lien vers la politique de confidentialité | `05` RG6 |
| Ce qui n'y est pas | Mot de passe, téléphone, nom, case à cocher, bouton social. Chaque élément ajouté ici coûte des inscriptions | `05` RG16, RG21, D37 |

**Clés de traduction**

| Clé | FR (intention) | EN (intention) | Max |
|---|---|---|---|
| `auth.step1.title` | Continuer avec votre e-mail | Continue with your email | 40 |
| `auth.step1.lead` | Pas de mot de passe : nous vous envoyons un code à 6 chiffres. | No password: we send you a 6-digit code. | 90 |
| `auth.step1.roleRecap.advertiser` | Vous vous inscrivez comme **marque**. | You are signing up as a **brand**. | 45 |
| `auth.step1.roleRecap.creator` | Vous vous inscrivez comme **créateur**. | You are signing up as a **creator**. | 45 |
| `auth.step1.roleChange` | Changer | Change | 12 |
| `auth.step1.emailLabel` | Adresse e-mail | Email address | 24 |
| `auth.step1.submit` | Recevoir mon code | Send me a code | 24 |
| `auth.step1.submitBusy` | Envoi du code… | Sending the code… | 24 |
| `auth.privacy.notice` | Finalités, destinataires **Brevo** et **Apollo.io**, durée, vos droits, lien. | Purposes, recipients **Brevo** and **Apollo.io**, retention, your rights, link. | 320 |
| `signup.email.errors.required` · `.format` · `.tooLong` | Repris tels quels de `05` RG112 | — | — |

### 3.2 Écran 2 — le code à 6 chiffres

C'est l'écran qui décide si quelqu'un entre dans INFLUX. **Sans mot de passe, il n'existe aucune
autre porte** (`05` §G) : il est conçu comme un écran de panne potentielle, pas comme une formalité.

```
Mobile 375
┌───────────────────────────────┐
│ [◁ Retour]          [FR|EN]   │
├───────────────────────────────┤
│ Entrez le code                │ h1
│ Nous avons écrit à            │
│ nom@exemple.com  [◦ Modifier] │  RG51
│                               │
│ ┌───────────────────────────┐ │
│ │ [i:key] Votre phrase de   │ │  RG48 — reprise à l'identique
│ │ correspondance :          │ │  dans l'e-mail
│ │ « ANCRE TRANQUILLE »      │ │
│ │ Elle doit être la même    │ │
│ │ dans l'e-mail reçu.       │ │
│ └───────────────────────────┘ │
│                               │
│ Code à 6 chiffres *           │
│ ┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐│  un seul champ logique
│ │   ││   ││   ││   ││   ││   ││  autocomplete="one-time-code"
│ └───┘└───┘└───┘└───┘└───┘└───┘│  inputmode="numeric"
│                               │
│ [■ Valider                  ] │
│                               │
│ Nouveau code dans 47 s        │  RG50, annoncé poliment (aria-live)
│                               │
│ [◦ Je ne reçois pas le code]  │  → §3.3, jamais enterré
└───────────────────────────────┘

Desktop : identique, colonne container-narrow centrée, les 6 cases plus larges.
```

| Point | Décision |
|---|---|
| Six cases ou un champ ? | **Six cases visuelles, un seul champ logique** : `aria-label` unique « Code à 6 chiffres », collage d'un code complet réparti automatiquement, effacement arrière qui recule d'une case. Six `<input>` indépendants cassent le remplissage automatique iOS et les lecteurs d'écran |
| Validation | **Automatique à la sixième saisie**, bouton conservé pour le clavier et pour les lecteurs d'écran. Le bouton n'est jamais l'unique chemin |
| Tentatives restantes | Affichées à chaque échec : `auth.code.errors.invalid` avec le nombre restant (`05` RG42). **Le compte n'est jamais bloqué**, seul le code l'est (RG45) |
| Phrase de correspondance | En évidence **au-dessus** du champ, pas en bas de page : elle sert à détecter un site contrefait **avant** de taper (`05` RG48) |
| Compte à rebours | Texte, jamais un cercle animé seul. Zone `aria-live="polite"`, mise à jour toutes les 10 secondes et à la dernière seconde — pas à chaque seconde (un lecteur d'écran deviendrait inutilisable) |
| Changer d'adresse | `[◦ Modifier]` retourne à l'écran 1 en conservant la porte. Le code déjà envoyé reste valide pour **son** adresse (`05` RG51) |
| Onglet fermé | Le cookie de parcours dure 15 minutes (`05` RG47). L'écran **le dit avant** : « Restez dans cet onglet : le code ne fonctionne qu'ici. » |

### 3.3 L'e-mail qui n'arrive pas — traité comme une panne

`[◦ Je ne reçois pas le code]` ouvre un panneau **dans la page** (pas une autre page : on ne quitte
pas un parcours en cours), qui affiche **trois causes distinctes** et leur geste (`05` RG60).

```
┌─────────────────────────────────────────────────┐
│ Vous ne recevez pas le code ?                   │ h2
│                                                 │
│ 1. Vérifiez vos indésirables et vos onglets     │
│    « Promotions » / « Notifications ».          │
│ 2. L'adresse est-elle exacte ?  nom@exemple.com │
│    [◦ Corriger mon adresse]                     │
│ 3. Toujours rien au bout de 2 minutes :         │
│    [□ Signaler que je ne reçois pas le code]    │  RG65 — canal de secours
│    Un commercial INFLUX vous répondra depuis    │  jamais un code, jamais une session
│    une autre adresse. Ce formulaire ne donne    │
│    jamais accès à un compte.                    │
└─────────────────────────────────────────────────┘
```

| Cause (`05` RG60) | Ce qu'affiche l'écran | Ce qu'il ne fait jamais |
|---|---|---|
| (a) Adresse non délivrable (rebond dur) | `auth.email.errors.undeliverable` + invitation à corriger ou à utiliser une autre adresse ; entrée en file backoffice (RG61) | Prétendre que l'envoi a réussi |
| (b) Service d'envoi indisponible | `auth.errors.serviceUnavailable` + **la saisie est conservée** + `[■ Réessayer]` | Afficher un faux succès (RG64) |
| (c) Plafond de demandes atteint | `auth.code.resend.limit` — « utilisez le dernier code reçu, il reste valide » | Envoyer un nouveau code, ou invalider le code en cours (RG45, RG50) |

**Compte devenu injoignable** (`05` RG62) : l'écran indique que seule une intervention d'INFLUX peut
corriger l'adresse, et renvoie vers le canal de secours. Il **n'annonce jamais de délai** qui n'est
pas tenu par une politique écrite.

### 3.4 Écran 3 — informations complémentaires (deux variantes, jamais fondues)

Affiché **seulement** si l'adresse vérifiée ne correspond à aucun compte (`05` RG2).

```
Mobile 375 — VARIANTE MARQUE              Mobile 375 — VARIANTE CRÉATEUR
┌───────────────────────────────┐        ┌───────────────────────────────┐
│ [◁]                 [FR|EN]   │        │ [◁]                 [FR|EN]   │
├───────────────────────────────┤        ├───────────────────────────────┤
│ Créer votre compte marque  h1 │        │ Créer votre compte créateur h1│
│ nom@exemple.com ✓ vérifiée    │        │ nom@exemple.com ✓ vérifiée    │
│ Vous vous inscrivez comme     │        │ Vous vous inscrivez comme     │
│ MARQUE        [◦ Changer]     │ RG3    │ CRÉATEUR      [◦ Changer]     │
│                               │        │                               │
│ Nom de l'entreprise *         │        │ Pays de résidence *           │
│ ┌───────────────────────────┐ │        │ ┌───────────────────────────┐ │
│ │                           │ │        │ │ — Sélectionnez —      [v] │ │
│ └───────────────────────────┘ │        │ └───────────────────────────┘ │
│                               │        │ [i:info] L'inscription est    │
│ Pays de l'entreprise *        │        │ ouverte partout ; les mises   │
│ ┌───────────────────────────┐ │        │ en relation s'ouvrent pays    │
│ │ — Sélectionnez —      [v] │ │        │ par pays.               RG14  │
│ └───────────────────────────┘ │        │                               │
│ [i:info] L'inscription est    │        │ Langue *                      │
│ ouverte partout ; …     RG14  │        │ (•) Français  ( ) English     │
│                               │        │                               │
│ Langue de communication *     │        │ Vous vous inscrivez en tant   │
│ (•) Français  ( ) English     │        │ que * (aucun pré-sélectionné) │
│                               │        │ ( ) Particulier               │
│                               │        │ ( ) Professionnel (société,   │
│                               │        │     entreprise individuelle,  │
│                               │        │     agence)             RG18  │
│                               │        │                               │
│                               │        │ [ ] Je certifie être majeur   │
│                               │        │     dans mon pays de          │
│                               │        │     résidence. *        RG19  │
│                               │        │     Les mineurs ne peuvent    │
│                               │        │     pas utiliser INFLUX.      │
│ ───────────────────────────── │        │ ───────────────────────────── │
│ [ ] J'accepte les conditions  │        │ [ ] J'accepte les conditions  │
│     générales d'utilisation * │        │     générales d'utilisation * │
│     [◦ Lire les CGU]    RG23  │        │     [◦ Lire les CGU]          │
│                               │        │                               │
│ [ ] Facultatif — je souhaite  │        │ [ ] Facultatif — je souhaite  │
│     recevoir des e-mails      │        │     recevoir des e-mails      │
│     commerciaux d'INFLUX et   │        │     commerciaux d'INFLUX et   │
│     être contacté à des fins  │        │     être contacté à des fins  │
│     de prospection. Nos       │        │     de prospection. Nos       │
│     outils : Brevo,           │        │     outils : Brevo,           │
│     Apollo.io.          RG31  │        │     Apollo.io.                │
│                               │        │                               │
│ [■ Créer mon compte         ] │        │ [■ Créer mon compte         ] │
└───────────────────────────────┘        └───────────────────────────────┘

Desktop : une seule colonne container-narrow. Pas de deux colonnes : un formulaire
d'engagement se lit de haut en bas, une colonne de droite y crée un doute sur l'ordre.
```

| Règle d'écran | Détail |
|---|---|
| Deux cases, jamais une | CGU (obligatoire) et marketing (facultatif) sont **visuellement séparées par un filet**, jamais empilées sans séparation. Cocher l'une ne coche jamais l'autre (`05` RG23) |
| Aucune case pré-cochée | Y compris la langue, qui est **présélectionnée** (choix exclusif) mais reste une sélection, pas une case (`05` RG11, RG17) |
| « Facultatif » est **dans le libellé** | Pas seulement dans une couleur ou une position. Le libellé commence par le mot | `05` RG30 |
| Marketing : une case, deux finalités | Les deux finalités sont citées **dans les deux portes**, quelle que soit la valeur du périmètre Apollo (`05` RG31, RG33). *Si `expert-conformite-rgpd` exige deux cases (Q10), seul ce bloc change : deux cases empilées, même filet, même ordre* |
| Majorité | Renvoie à **l'âge de la majorité du pays déclaré**, jamais à un âge fixe (`05` RG19) |
| Liste de pays | Tous les pays, triés selon la langue de la page, **aucun marqué « ouvert aux contrats »** (`05` RG14) |
| Lire les CGU | Ouvre un **panneau latéral dans le parcours** (desktop) ou une page avec retour (mobile), **sans perdre la saisie** (`05` RG111). Consultables sans être connecté (RG27) |
| Ordre du focus à l'erreur | Focus sur le **premier champ invalide**, message relié par `aria-describedby`, `aria-invalid="true"` (`05` RG115) |

### 3.5 Les états des trois écrans

| État | Écran 1 | Écran 2 | Écran 3 |
|---|---|---|---|
| **Repos** | Champ vide, bouton actif | Cases vides, compte à rebours à 60 s | Champs vides, bouton actif (jamais désactivé) |
| **Chargement** | Bouton `aria-disabled`, libellé « Envoi du code… », curseur conservé. Double soumission sans effet (`05` RG110) | « Vérification… » | « Création du compte… » |
| **Vide** | Sans objet | Sans objet | Sans objet |
| **Erreur de saisie** | Message sous le champ, focus au champ, saisie conservée | Tentatives restantes annoncées, cases conservées et sélectionnées | Liste des champs manquants en tête **et** message par champ ; **rien n'est perdu** |
| **Erreur de service** | `auth.errors.serviceUnavailable`, saisie conservée, `[■ Réessayer]` | Idem | `signup.errors.unavailable` — « vos réponses sont conservées » |
| **Accès refusé** | `signup.errors.countryBlocked`, message neutre, aucun compte créé (`05` RG8) | Code expiré / trop d'essais / parcours perdu : trois messages distincts | Pays bloqué |
| **Succès** | Transition immédiate vers l'écran 2, **focus porté sur le titre du nouvel écran** | Transition vers l'écran 3 ou vers l'espace | `signup.success.title` puis accueil de l'espace, avec une carte d'action (§2.4) |
| **Hors ligne** | Bandeau « Vous êtes hors ligne », bouton inactif avec explication écrite, saisie conservée | Idem | Idem — le brouillon local est conservé |
| **Changement de langue** | Tous les textes changent, **la saisie et l'étape sont conservées** (`05` RG111) — écart assumé avec la maquette de la landing, où le formulaire repartait de zéro | | |

### 3.6 Accessibilité du parcours

- Un seul `h1` par écran ; le focus est porté sur le `h1` à chaque changement d'étape, et l'étape
  est annoncée (« Étape 2 sur 3 »).
- Le champ de code porte `autocomplete="one-time-code"` et `inputmode="numeric"` : sur iOS et
  Android, le code proposé par le système doit se coller en un geste (`05` RG115).
- Chaque case à cocher a une **zone cliquable qui inclut son libellé complet**, hauteur minimale
  `size-touch-target`, et une taille de boîte `size-checkbox`.
- Les erreurs sont dans une zone `role="alert"` **et** reliées au champ : les deux, pas l'une ou
  l'autre.
- Contraste vérifié : `color-text-primary` sur `color-surface-page` = **18,2:1** ;
  `color-feedback-error-text` sur `color-surface-page` = **7,2:1** ; bordure
  `color-border-error` sur carte = supérieure à 3:1. Un champ en erreur porte **bordure + icône +
  texte**, jamais la couleur seule.

**Tokens utilisés :** `color-surface-page`, `color-surface-card`, `color-border-default`,
`color-border-error`, `color-text-primary/-secondary/-tertiary`, `color-action-primary-bg` (+ hover,
active), `color-text-on-action`, `color-feedback-error-*`, `color-feedback-info-*`, `color-focus-ring`,
`size-input`, `size-checkbox`, `size-button-lg`, `size-touch-target`, `radius-md`, `radius-pill`,
`spacing-stack-md/-lg`, `spacing-inset-card`, `container-narrow`, `text-heading-2`, `text-md`,
`text-sm`, `font-variant-numeric-amount` (cases de code), `duration-fast`, `ease-standard`.

---

## 4. Espace marque

**Population :** un responsable marketing ou un dirigeant de PME, pressé, sur desktop.
**Tâche :** publier une offre crédible, trouver des créateurs pertinents, obtenir une mise en
relation. **Vocabulaire :** campagne, brief, livrables, droits d'usage, budget — jamais « offre »,
jamais « annonce ».

### 4.1 M1 — Accueil marque

```
Desktop 1440 (colonne latérale omise ici)
┌──────────────────────────────────────────────────────────────────────────────┐
│ Bonjour, {nom commercial}                                               h1   │
│                                                                              │
│ ┌────────────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ CE QUI ATTEND VOTRE RÉPONSE        │ │ ÉTAT DE VOTRE COMPTE              │ │
│ │ • 1 mise en relation à accepter    │ │ Profil : Publié le 3 mars ✓       │ │
│ │   [■ Voir]                         │ │ Complétude 78 % ▓▓▓▓▓▓▓░░         │ │
│ │ • 2 messages non lus  [□ Ouvrir]   │ │ Il manque : logo, téléphone de    │ │
│ │ • 1 campagne refusée : motif       │ │ l'interlocuteur.          RG61    │ │
│ │   [□ Corriger]                     │ │ [□ Compléter]                     │ │
│ └────────────────────────────────────┘ └───────────────────────────────────┘ │
│                                                                              │
│ MES CAMPAGNES                                          [■ Créer une campagne]│
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Rentrée beauté 2026   · Publiée le 3 mars · 2 relations ouvertes    [›]  │ │
│ │ Test UGC crème        · En validation depuis 4 h                    [›]  │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ TROUVER DES CRÉATEURS                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [i:search] Recherchez par thématique, réseau, audience, pays, tarif.     │ │
│ │ [■ Rechercher]   [□ Demander une sélection à l'équipe INFLUX]      RG61  │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘

Mobile : les quatre blocs empilés dans le même ordre. « Ce qui attend votre réponse »
en premier, toujours — c'est la seule raison de revenir.
```

| Bloc | Règle |
|---|---|
| « Ce qui attend votre réponse » | N'affiche **que** des éléments actionnables. Zéro élément → le bloc **disparaît** (pas de « rien à faire » encadré de vide) et l'accueil remonte sur les campagnes |
| État du compte | Complétude **jamais montrée à un créateur** (`06` RG57) ; message **factuel**, nommant les champs manquants, sans promesse de résultat (`06` RG61) |
| Campagnes | 3 lignes maximum, puis `[◦ Voir les 7 campagnes]`. Chaque ligne porte **son état écrit** |
| Notifications | Aucun compteur de vues de profil : une marque n'est **jamais** notifiée qu'un créateur a consulté sa campagne (`06` RG77, `09` RG101) |

**États :** *chargement* squelettes de trois cartes, jamais de tourniquet plein écran · *vide* §2.4 ·
*erreur* bandeau « Impossible de charger votre tableau de bord » + `[■ Réessayer]`, la navigation
reste utilisable · *accès refusé* sans objet (le routage §2.5 a déjà tranché) · *succès* sans objet.

### 4.2 M2 — Profil marque : complétion progressive et couches visibles

Écran de référence pour la notion de **couche** : chaque champ dit qui le verra, au moment où on
le saisit (`06` RG62). C'est une obligation d'information, pas un confort.

```
Desktop 1440
┌──────────────────────────────────────────────────┬───────────────────────────┐
│ Mon profil de marque                         h1  │ (colonne collante)        │
│ État : Brouillon · non visible des créateurs     │ ┌───────────────────────┐ │
│                                                  │ │ Complétude 62 %       │ │
│ ── 1. Identité publique ───────────── [Publique] │ │ ▓▓▓▓▓▓░░░░            │ │
│ Nom commercial *            (repris du Lot 1)    │ │ Pour publier, il      │ │
│ Logo         ▣ [□ Déposer]  PNG/JPG/WebP, 2 Mo   │ │ manque :              │ │
│ Secteur principal *              [v]             │ │ • présentation        │ │
│ Secteurs secondaires (2 max)     [v]             │ │ • marchés visés       │ │
│ Taille d'entreprise *            [v] (tranche)   │ │ • fonction de         │ │
│ Pays d'établissement *           [v]             │ │   l'interlocuteur     │ │
│ Marchés visés * (5 max)          [v]             │ │                 RG61  │ │
│ Langues de travail *             [FR][EN]        │ │                       │ │
│ Site web              exemple.com                │ │ [■ Soumettre à la     │ │
│   [i:info] Nous conservons le domaine seul. RG17 │ │    validation]        │ │
│ Présentation * (120–1 000)                       │ │  jamais désactivé,    │ │
│ ┌──────────────────────────────────────────────┐ │ │  toujours expliqué    │ │
│ │                                     0/1000   │ │ │                 RG4   │ │
│ └──────────────────────────────────────────────┘ │ └───────────────────────┘ │
│   [i:alert] Pas d'adresse, de numéro ni de lien  │                           │
│   dans ce texte : ils seront partagés à          │ ┌───────────────────────┐ │
│   l'ouverture de la mise en relation.      RG19  │ │ [i:eye] Ce que voit   │ │
│                                                  │ │ un créateur           │ │
│ ── 2. Ce que je cherche ───────────── [Publique] │ │ [□ Prévisualiser]     │ │
│ Thématiques recherchées * (1–3)  [v]             │ │                 RG102 │ │
│ Réseaux visés *                  [ ]…            │ └───────────────────────┘ │
│ Formats attendus *               [ ]…            │                           │
│ Budget indicatif par collaboration *             │                           │
│   Tranche [v]   Devise [v]                       │                           │
│   [i:info] Budget indicatif par collaboration,   │                           │
│   à titre d'information — il ne vaut pas         │                           │
│   engagement.                              RG31  │                           │
│ Droits d'usage habituels         [ ]…            │                           │
│ Exclusivité habituelle           [v]             │                           │
│ Contrepartie non monétaire       ( ) Oui ( ) Non │                           │
│ Pays d'audience visés * (5 max)  [v]             │                           │
│ Rythme de collaboration          [v]             │                           │
│                                                  │                           │
│ ── 3. Votre interlocuteur ──────────────────────  │                           │
│ Fonction *                       [v]  [Publique] │                           │
│ ┌──────────────────────────────────────────────┐ │                           │
│ │ [i:lock] Masqué jusqu'à l'ouverture d'une    │ │                           │
│ │ mise en relation — visible alors du seul     │ │                           │
│ │ créateur concerné, et d'INFLUX en            │ │                           │
│ │ permanence.                      RG35, RG37  │ │                           │
│ │ Prénom            [            ]             │ │                           │
│ │ E-mail pro        [            ]             │ │                           │
│ │ Téléphone     [+33][           ]             │ │                           │
│ │ Page de contact   [            ]             │ │                           │
│ └──────────────────────────────────────────────┘ │                           │
│                                                  │                           │
│ ── 4. Vérification ───────────────── [Interne]   │                           │
│ Badge « Marque vérifiée » : non demandé          │                           │
│ Ce que le badge affirme : le domaine vous        │                           │
│ appartient et la société existe. Il n'affirme    │                           │
│ ni solvabilité, ni qualité.              08 RG2  │                           │
│ [□ Demander le badge]                            │                           │
│                                                  │                           │
│ Enregistré automatiquement à 14 h 07       RG83  │                           │
└──────────────────────────────────────────────────┴───────────────────────────┘

Mobile : accordéon à 4 sections, une ouverte à la fois, barre d'action collante en bas
(« Enregistré · [■ Soumettre] »). L'étiquette de couche est un badge en tête de section
ET répétée sur chaque champ masqué : sur mobile, le titre de section sort de l'écran.
```

**Les trois étiquettes de couche** — libellés imposés par `06` RG84 :

| Étiquette | Clé | Forme visuelle |
|---|---|---|
| Visible de tous les créateurs | `brandProfile.layer.public` | Badge `color-surface-raised` + `[i:globe]` + texte |
| Visible uniquement après l'ouverture d'une mise en relation | `brandProfile.layer.revealed` | Badge `color-brand-subtle-bg` + `color-text-brand-strong` + `[i:lock]` + texte |
| Visible uniquement par l'équipe INFLUX | `brandProfile.layer.internal` | Badge `color-surface-raised` + `color-text-tertiary` + `[i:eye-off]` + texte |

L'icône **et** le texte sont présents dans les trois cas : le vert du badge « révélé » ne porte
jamais l'information seul.

**Les cinq états du profil** (`06` RG3), chacun avec son libellé écrit et son bandeau :

| État | Bandeau en tête d'écran | Ce qui reste possible |
|---|---|---|
| Brouillon | « Non visible des créateurs. » | Tout modifier, soumettre |
| En attente de validation | `brandProfile.status.pending` + ancienneté + délai annoncé (1 jour ouvré, `06` RG7) | Modifier (repart en validation), suivre |
| En attente **avec version publiée** | `brandProfile.status.pendingWithPublished` | Idem ; les créateurs voient la version précédente (`06` RG9) |
| Publié | « Publié le {date}. » + `[□ Prévisualiser]` | Modifier ; champs à re-validation signalés d'une puce |
| Refusé | `brandProfile.status.rejected` + **motif typé en clair** + ce qu'il faut faire (`06` RG66) | Corriger et resoumettre, sans délai |
| Suspendu | Message neutre + contact INFLUX | Lecture seule ; campagnes dépubliées (`09` RG11) |

**États de l'écran :** *chargement* squelette de formulaire, champs non focalisables · *vide*
première visite : tous les champs vides, la colonne de droite dit ce qui manque, aucun compteur à
0 % anxiogène (on affiche le score réel, avec la liste) · *erreur de saisie* message sous le champ +
liste en tête, **saisie conservée y compris le fichier déposé** (`06` RG82) · *erreur
d'enregistrement automatique* bandeau discret « Modifications non enregistrées — nouvelle tentative
dans 5 s », jamais une perte silencieuse · *accès refusé* sans objet · *succès* « Profil soumis.
Réponse sous 1 jour ouvré. »

**Clés** (reprises de `06` RG84, non réinventées) : `brandProfile.publish.missing`,
`brandProfile.layer.*`, `brandProfile.status.*`, `brandProfile.website.normalized`,
`brandProfile.budget.notice`, `brandProfile.badge.label`, `brandProfile.badge.toRefresh`,
`brandProfile.errors.contactInPublicText`, `brandProfile.search.blockedUntilPublished`.

### 4.3 M3 — Créer une campagne : 8 blocs, 5 étapes, un brouillon permanent

Les 8 blocs de `09` représentent une quarantaine de champs. Les présenter sur une page unique fait
abandonner ; les présenter en 8 étapes donne l'impression d'un dossier administratif. **Découpage
retenu : 5 étapes**, regroupées par question posée à la marque, avec navigation libre entre étapes.

| Étape | Blocs `09` | Question posée | Champs obligatoires |
|---|---|---|---|
| 1. L'offre | Bloc 1 identification + Bloc 2 produit | « Qu'est-ce que vous proposez, sur quoi ? » | Titre, type, résumé, brief, produit, catégorie, produit envoyé |
| 2. Le travail attendu | Bloc 3 livrables, droits, exclusivité | « Qu'est-ce que le créateur doit produire, et qu'en ferez-vous ? » | Livrables, droits (+ durée et territoire si ≠ aucun), exclusivité, délai de validation |
| 3. Pour qui | Bloc 4 audience visée | « Quelle audience visez-vous ? » | Pays, langues, thématiques |
| 4. Le budget | Bloc 5 budget | « Combien payez-vous **au total** ? » | Min, max, devise, nature, nombre de créateurs |
| 5. Calendrier et candidature | Blocs 6 et 7 | « Quand, et que doit envoyer un créateur ? » | 4 dates |
| — | Bloc 8 interne | Réparti : référence interne en étape 1, budget total en étape 4, notes en étape 5 — **toujours dans un encart « Interne — jamais publié »** | — |

```
Desktop — étape 4, la plus sensible du parcours
┌──────────────────────────────────────────────────────────────────────────────┐
│ Créer une campagne · Rentrée beauté 2026            Brouillon enregistré ✓   │
│ ① L'offre ✓  ② Travail ✓  ③ Audience ✓  ④ Budget  ⑤ Calendrier               │
│ ────────────────────────────────────────────────────────────────────────────│
│ Combien payez-vous ?                                                     h2  │
│                                                                              │
│ Rémunération par créateur *                                                  │
│ [i:info] Indiquez ce que vous payez au total, commission INFLUX incluse.     │
│                                                              09 RG57         │
│ Minimum [        ]   Maximum [        ]   Devise [EUR v]                     │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Ce que voit un créateur sur cette campagne :                             │ │
│ │  « Ce que la marque paie au total : 1 000 – 2 000 EUR »                  │ │
│ │  + sa propre estimation de ce qu'il perçoit, que vous ne voyez pas.      │ │
│ │                                                       09 RG60, RG61      │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ Fourchette indicative pour cette campagne. Elle ne vaut pas engagement :     │
│ le montant se négocie dans la conversation.                       09 RG67    │
│                                                                              │
│ Nature de la rémunération *   (•) Numéraire ( ) Numéraire + dotation         │
│                               ( ) Dotation seule ( ) Affiliation             │
│ Nombre de créateurs recherchés *  [ 3 ]  (1 à 50)                            │
│                                                                              │
│ ┌─ Interne — jamais publié ────────────────────────────────── [i:eye-off] ─┐ │
│ │ Budget total de la campagne  [        ] EUR                              │ │
│ │ Votre budget total n'est jamais publié. Seule la fourchette par créateur │ │
│ │ est visible.                                   09 RG65, campaign.budget. │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ [□ Étape précédente]                       [■ Continuer]  [◦ Enregistrer et │
│                                                              quitter]        │
└──────────────────────────────────────────────────────────────────────────────┘

Mobile : une étape par écran, barre de progression « Étape 4 sur 5 » en tête,
bouton principal collant en bas. Le bloc « ce que voit un créateur » reste
visible sous les champs, jamais replié.
```

| Décision de conception | Justification |
|---|---|
| **Le montant net du créateur n'apparaît nulle part** dans ce parcours | `09` RG61. On explique **qu'il existe**, on ne l'affiche pas : c'est la symétrie exacte du masquage |
| Le récapitulatif « ce que voit un créateur » est **dans l'étape budget**, pas seulement en fin | Le malentendu de 35 % se joue à la saisie, pas à la relecture |
| Navigation libre entre étapes validées | Une marque qui doit recommencer à l'étape 1 pour corriger une date abandonne |
| `[■ Soumettre]` **toujours visible, jamais désactivé** | `09` RG4 : il affiche la liste nominative de ce qui manque, par étape, avec un lien vers le champ |
| Aucune pièce jointe | `09` RG45 : pas de moodboard, pas d'image. Le formulaire ne propose **aucun** bouton de fichier |
| Option « réservée aux profils vérifiés » | **Champ absent** tant que le paramètre est désactivé (`09` RG79) : un interrupteur visible mais inopérant est pire qu'un champ absent |
| « Dotation seule » | Masque la fourchette en numéraire, affiche la **valeur du produit** sous son propre nom, **sans aucune mention de commission** (`09` RG63) |

**Détections à la saisie** (signalent, ne bloquent pas, ne modifient pas le texte — `09` RG21,
RG23) : coordonnée directe → `campaign.errors.contactInText` ; montant dans un texte libre →
`campaign.errors.amountInText` ; URL → message dédié. Le message s'affiche **sous le champ, en
avertissement**, et le texte part quand même en validation humaine : c'est le modérateur qui décide.

**États :** *chargement* squelette d'étape · *vide* première campagne, l'étape 1 explique en deux
lignes ce qu'est une campagne INFLUX · *erreur de saisie* par champ + liste en tête d'étape + focus
au premier invalide ; `campaign.errors.datesOrder` nomme **les deux dates en conflit** (`09` RG70) ·
*erreur d'enregistrement* bandeau de reprise, brouillon conservé côté client · *accès refusé*
`campaign.publish.profileRequired` avec un lien direct vers le profil · *succès*
`campaign.status.pending` + délai annoncé + retour à la liste.

---

### 4.4 M4 — Recherche de créateurs anonymisée

**Tâche :** passer d'un besoin à une short-list de 3 à 5 profils crédibles, sans jamais voir une
identité. **Contrainte structurante :** la liste n'est pas affichée sous 5 résultats, et le nombre
de résultats est une **tranche** (`10` RG57, RG59).

```
Desktop 1440
┌───────────────────────┬──────────────────────────────────────────────────────┐
│ FILTRES               │ Créateurs                                        h1  │
│ (colonne collante)    │ Recherche liée à : [Rentrée beauté 2026 v] [◦ Aucune]│
│                       │                                                      │
│ Thématique        [v] │ Environ 10-24 profils correspondent.        RG59    │
│ Réseaux           [ ] │ Tri : [Pertinence v] (Audience · Tarif · Vérifiés    │
│ Audience / réseau [ ] │        d'abord · Nouveaux profils)           RG43    │
│ Pays d'audience   [v] │ Critères actifs : [Beauté ×][Instagram ×][France ×]  │
│   + part      [≥80% v]│                                                      │
│ Langues           [ ] │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ Formats           [ ] │ │ carte anonyme│ │ carte anonyme│ │ carte anonyme│  │
│ Tarif        [v]+[EUR]│ │   (§7.1)     │ │              │ │              │  │
│  [ ] Inclure les      │ └──────────────┘ └──────────────┘ └──────────────┘  │
│  créateurs qui        │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  tarifent dans une    │ │              │ │              │ │              │  │
│  autre devise    RG18 │ └──────────────┘ └──────────────┘ └──────────────┘  │
│ Badge             [ ] │                                                      │
│                       │           Page 1 sur 5 · 12 par page         RG63    │
│ [□ Tout effacer]      │                                                      │
│ ───────────────────── │ ┌──────────────────────────────────────────────────┐ │
│ [□ Demander une       │ │ MA SÉLECTION (3)                                 │ │
│  sélection à l'équipe]│ │ Profil 7K3M · Profil 2QX8 · Profil B40T          │ │
│        RG61, permanent│ │ [■ Demander une mise en relation pour ces 3]     │ │
│                       │ └──────────────────────────────────────────────────┘ │
└───────────────────────┴──────────────────────────────────────────────────────┘

Mobile 375
┌───────────────────────────────┐
│ Créateurs                 h1  │
│ [□ Filtres (3)]  [Tri v]      │  filtres = panneau plein écran, bouton
│ Environ 10-24 profils         │  « Voir les résultats » en bas
│ ┌───────────────────────────┐ │
│ │ carte anonyme, pleine     │ │
│ │ largeur (§7.1)            │ │
│ └───────────────────────────┘ │
│ …                             │
│ [□ Voir la suite]             │  pagination explicite, jamais infinie
│ ┌───────────────────────────┐ │
│ │ Ma sélection (3)      [^] │ │  barre collante en bas, au-dessus
│ └───────────────────────────┘ │  de la barre de navigation
└───────────────────────────────┘
```

| Élément | Décision et règle |
|---|---|
| Facettes ouvertes | Les **8 du socle** uniquement (`10` RG12). Les facettes de seconde vague apparaissent **quand le paramètre les ouvre**, sans redéploiement (RG11). L'écran ne montre jamais une facette fermée, même grisée |
| Aucun champ texte libre | `10` RG6. Il n'existe **aucune barre de recherche** dans cet écran. C'est contre-intuitif pour un utilisateur habitué aux annuaires : une ligne d'explication le dit (« la recherche se fait par critères, pour protéger l'anonymat des créateurs ») |
| Tarif + devise | La devise est **obligatoire** et pré-remplie depuis le profil (`10` RG18). La case « inclure les autres devises » est **sous le filtre**, et les profils concernés portent la mention « tarif dans une autre devise » |
| Nombre de résultats | **Tranche uniquement**, jamais un nombre. Formulé comme une information, pas comme une limitation |
| Tri | Toujours **nommé à l'écran** (`10` RG44). Le tri par défaut s'appelle « Pertinence » et un `[i:info]` ouvre l'explication des paliers en langage courant — pas un score |
| Sélection | Panneau persistant, **aucune notification au créateur** (`10` RG51, RG8). Le libellé dit « privée » |
| Pagination | 12 par page, 5 pages, **explicite** (`10` RG63). Pas de défilement infini : il rendrait le plafond incompréhensible |
| Demande de sélection à l'équipe | **Présent en permanence**, pas seulement sous le seuil (`10` RG61) |

**Les trois états spécifiques de cette recherche** — ce sont eux qui font ou défont l'écran.

```
① SOUS LE SEUIL (0 à 4 résultats — message strictement identique, RG58)
┌──────────────────────────────────────────────────────────────┐
│ [i:search-x]                                                 │
│ Votre recherche est trop précise pour être affichée.         │
│ Élargissez un critère, ou demandez une sélection à           │
│ l'équipe INFLUX.                                             │
│                                                              │
│ Suggestions :  [□ Retirer le filtre de tarif]                │  RG60
│                [□ Élargir la tranche d'audience]             │  pré-construites,
│                [□ Ajouter un pays voisin]                    │  aucun décompte
│                                                              │
│ [■ Demander une sélection à l'équipe INFLUX]                 │
└──────────────────────────────────────────────────────────────┘
Aucun compteur. Aucun aperçu flouté. Aucune carte partielle.

② RECHERCHE FERMÉE (D38 non atteinte, RG3)
┌──────────────────────────────────────────────────────────────┐
│ Les critères restent saisissables et sont conservés.         │
│ search.closed.notice : « La recherche ouvrira lorsque notre  │
│ catalogue sera assez fourni. En attendant, décrivez votre    │
│ besoin : notre équipe vous propose une sélection. »          │
│ [■ Demander une sélection à l'équipe INFLUX]                 │
└──────────────────────────────────────────────────────────────┘

③ PLAFOND DE RECHERCHES ATTEINT (RG64)
┌──────────────────────────────────────────────────────────────┐
│ search.rateLimit.reached — « Vous avez atteint la limite de  │
│ recherches pour aujourd'hui. Revenez demain, ou demandez     │
│ une sélection à l'équipe INFLUX. »                           │
│ Les résultats déjà affichés restent lisibles ; la sélection  │
│ reste utilisable. Jamais une page blanche, jamais une        │
│ dégradation silencieuse des résultats.                       │
└──────────────────────────────────────────────────────────────┘
```

**Autres états :** *chargement* 6 squelettes de carte au bon ratio, aucun décalage de mise en page ·
*profil marque non publié* l'écran affiche les critères et
`brandProfile.search.blockedUntilPublished` avec un lien vers le profil (`10` RG1) · *erreur*
« Impossible d'exécuter la recherche » + `[■ Réessayer]`, filtres conservés · *succès* sans objet.

### 4.5 M5 — Demander une mise en relation

Déclenchée depuis une carte ou depuis la sélection. **Panneau de confirmation**, jamais une action
immédiate : un motif écrit est exigé, c'est lui qui distingue un rapprochement d'un envoi de masse
(`13` RG15, A9).

```
Mobile / Desktop — panneau (drawer mobile, modale desktop)
┌───────────────────────────────────────────────────────────┐
│ Demander une mise en relation                        [✕]  │
│ Profil 7K3M — Beauté · France        (+ 2 autres profils) │
│                                                           │
│ Sur quelle campagne ?                                     │
│ [Rentrée beauté 2026 v]  ou  ( ) Sans campagne            │
│                                                           │
│ Pourquoi ce créateur ? *                                  │
│ ┌───────────────────────────────────────────────────────┐ │
│ │                                          0/1000       │ │
│ └───────────────────────────────────────────────────────┘ │
│ Ce texte est lu par le commercial INFLUX qui traitera     │
│ votre demande. Il n'est pas transmis tel quel.            │
│                                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ [i:info] Ce qui se passe ensuite                      │ │
│ │ 1. Un commercial INFLUX examine votre demande.        │ │
│ │    Réponse sous 1 jour ouvré.               D39       │ │
│ │ 2. S'il la valide, le créateur est invité à accepter. │ │
│ │ 3. Les identités ne sont échangées qu'au moment où    │ │
│ │    vous avez accepté tous les deux.       13 RG74     │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ [ ] J'accepte cette mise en relation. Mon identité et     │  intro.accept.consent
│     les informations de mon profil seront communiquées    │  non pré-cochée,
│     à l'autre partie au moment où les siennes me seront   │  13 RG70
│     communiquées. J'ai pris connaissance des CGU          │
│     (version {v} du {date}), dont la clause de            │
│     non-contournement.  [◦ Lire les CGU]                  │
│                                                           │
│ [□ Annuler]                    [■ Envoyer ma demande]     │  inactif tant que
└───────────────────────────────────────────────────────────┘  la case n'est pas cochée
```

**L'initiateur accepte ici, une fois pour toutes** (`13` RG67) : il n'aura pas d'écran
d'acceptation ensuite — sauf si la version de CGU change entre-temps (`13` RG68). C'est la raison
pour laquelle la case d'acceptation, le lien vers les CGU et la mention de la clause figurent
**dans ce panneau** et pas seulement au §7.2.

**Variantes du bouton d'appel** (`10` RG53) : demande déjà en file → bouton inactif +
`search.action.requestSent` ; paire déjà en relation → `search.action.openConversation` ; profil
marque dépublié → bouton inactif **avec le motif écrit**.

**États :** *chargement* bouton en « Envoi… », panneau verrouillé · *erreur* message dans le
panneau, **motif conservé** (`13` RG116) · *succès* le panneau se remplace par une confirmation
« Demande envoyée · référence provisoire · réponse sous 1 jour ouvré », et la carte passe en
« demande envoyée le {date} » · *sélection multiple* la confirmation précise le nombre de demandes
**distinctes** créées, une par créateur.

### 4.6 M6 — Suivi des demandes et des mises en relation

Deux onglets, parce que ce sont deux tâches : *ce que j'attends* et *ce qui est ouvert*.

```
Desktop
┌──────────────────────────────────────────────────────────────────────────────┐
│ Mises en relation                                                        h1  │
│ [ Demandes (3) | Conversations (2) ]                       role="tablist"    │
│ ────────────────────────────────────────────────────────────────────────────│
│ Filtre : [Toutes v] [Campagne v]                                             │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [i:clock] Profil 7K3M · Rentrée beauté 2026                              │ │
│ │ En cours d'examen par INFLUX. Réponse sous 1 jour ouvré.      RG100 #1-2 │ │
│ │ Envoyée le 12 mars à 09 h 14           [◦ Retirer ma demande]            │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ [i:user-check] Un créateur a candidaté — INFLUX a validé sa candidature  │ │
│ │ Rentrée beauté 2026 · Profil 2QX8                                        │ │
│ │ Votre réponse est attendue avant le 19 mars.                             │ │
│ │ [■ Examiner et répondre]                          → écran §7.2           │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ [i:hourglass] Profil B40T · Rentrée beauté 2026                          │ │
│ │ Vous avez accepté le 11 mars. Nous attendons la réponse de l'autre       │ │
│ │ partie.                                     intro.status.waitingOther    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Les huit états de `13` RG100, avec leur libellé imposé côté marque :**

| # | État | Libellé affiché | Action possible |
|---|---|---|---|
| 1 | En attente de prise en charge | `intro.status.review` | Retirer |
| 2 | En cours d'examen | **Le même libellé que l'état 1** (`13` RG101) | Retirer |
| 3 | Validée, en attente d'acceptation | Initiateur : « Validée par INFLUX » · Autre partie : l'invitation (§7.2) | Accepter · Refuser · Retirer |
| 4 | Mise en relation ouverte | `intro.status.opened` + référence `MER-…` | Ouvrir la conversation |
| 5 | Refusée par INFLUX | Le motif typé, attribué à INFLUX — **si initiateur seulement** | Recommencer autrement |
| 6 | Refusée par une partie | `intro.declined.neutral` — message **identique des deux côtés**, aucun motif exposé | — |
| 7 | Retirée | « Vous avez retiré cette demande le … » | — |
| 8 | Clôturée sans suite | `intro.status.closed` | — |

**Ce que la marque n'apprend jamais** : qu'un créateur a refusé et pourquoi (état 6 est neutre des
deux côtés, `13` RG88) ; qu'une demande a été refusée par INFLUX quand elle n'en est pas
l'initiatrice (`13` RG111, condition `03` C(18)) ; si l'autre partie a ouvert l'invitation
(`13` RG73).

**Dépassement du délai** : `intro.status.late`, **à l'écran uniquement**, jamais par e-mail
(`13` RG111). Factuel, sans excuse automatique et sans nouvelle promesse.

**États :** *chargement* trois lignes squelettes · *vide* « Aucune demande en cours » + un chemin
(« Rechercher des créateurs ») · *erreur* bandeau + `[■ Réessayer]` · *accès refusé* sans objet ·
*succès* confirmation en ligne après un retrait.

### 4.7 M7 — La conversation à trois (spécification commune, vocabulaire par rôle)

Cet écran existe **à l'identique dans les deux espaces**, à trois différences près : le nom affiché
de l'autre partie, le rappel de campagne, et le bloc « fiche de l'autre partie ». Il est spécifié
une fois ici et référencé au §5.7.

```
Mobile 375                                    Desktop 1440
┌───────────────────────────────┐   ┌──────────────────────┬───────────────────────────┐
│ [◁] MER-2026-000123       [i] │   │ Conversations        │ MER-2026-000123           │
├───────────────────────────────┤   │ ┌──────────────────┐ │ Rentrée beauté 2026       │
│ Rentrée beauté 2026           │   │ │ MER-…123    2 ●  │ │ Marque ⟷ Créateur         │
│ Marque Alpha ⟷ @lea.beauty    │   │ │ Marque Alpha     │ │ Suivi par Thomas — INFLUX │
│ Suivi par Thomas — INFLUX     │   │ ├──────────────────┤ │ Ouverte le 12 mars, 14 h  │
│ Ouverte le 12 mars à 14 h 03  │   │ │ MER-…118         │ │ [◦ Voir la fiche]         │
│                          RG28 │   │ └──────────────────┘ ├───────────────────────────┤
├───────────────────────────────┤   │                      │ bandeau de supervision    │
│ [i:eye] Conversation suivie   │   │                      ├───────────────────────────┤
│ par INFLUX. Un commercial y   │   │                      │                           │
│ participe ; un autre agent    │   │                      │  … messages …             │
│ peut la lire. Chaque lecture  │   │                      │                           │
│ est horodatée.   [◦ Détail]   │   │                      │                           │
│                     RG31, 102 │   │                      │                           │
├───────────────────────────────┤   └──────────────────────┴───────────────────────────┘
│ ┌───────────────────────────┐ │
│ │ ── 12 mars ──             │ │  séparateur de jour
│ │ [système] Conversation    │ │  message système : pleine largeur, centré,
│ │ ouverte · MER-…123        │ │  color-text-tertiary, icône, jamais une bulle
│ │                           │ │
│ │ ┌───────────────────────┐ │ │
│ │ │ Thomas — INFLUX       │ │ │  bulle agent : bordure brand-subtle-border
│ │ │ [i:badge] INFLUX      │ │ │  + pastille écrite « INFLUX », jamais la
│ │ │ Bonjour à tous deux…  │ │ │  couleur seule (RG7)
│ │ │ 14 h 05               │ │ │
│ │ └───────────────────────┘ │ │
│ │       ┌─────────────────┐ │ │
│ │       │ Vous            │ │ │  bulle « moi » : alignée à droite,
│ │       │ Merci…          │ │ │  surface-raised
│ │       │ 14 h 12  ✓ lu   │ │ │  accusé de lecture entre parties seulement
│ │       └─────────────────┘ │ │  (RG53) ; jamais pour les agents (RG54)
│ │ ┌───────────────────────┐ │ │
│ │ │ @lea.beauty · Créateur│ │ │  bulle autre partie : surface-card
│ │ │ Bonjour…              │ │ │
│ │ └───────────────────────┘ │ │
│ └───────────────────────────┘ │
├───────────────────────────────┤
│ ┌───────────────────────────┐ │
│ │ Écrire un message…        │ │  textarea auto-extensible, 1 à 10 000 car.
│ └───────────────────────────┘ │  AUCUN bouton de fichier, aucun collage
│ [◦ Documents]   [■ Envoyer]   │  d'image, aucun glisser-déposer (RG36)
└───────────────────────────────┘
```

| Élément | Décision et règle |
|---|---|
| En-tête permanent | Référence `MER-…`, campagne, **date et heure de la révélation**, les deux parties, le commercial responsable. Visible **sans défiler** (`12` RG28). Sur mobile, il se réduit à deux lignes au défilement mais ne disparaît jamais |
| Bandeau de supervision | Permanent, une ligne, lien vers le détail des 5 points (`12` RG31, RG102). **Un défaut bloquant s'il manque** |
| Écran d'information avant le premier message | Affiché **une fois par compte**, à la première conversation : les 5 points de `12` RG103, dans cet ordre, avec `[■ J'ai compris]`. La prise de connaissance est horodatée avec la version du texte (`12` RG104). **Ce n'est pas un consentement** : pas de case, pas de refus possible — donc pas de faux choix |
| Rôles | Libellé écrit **et** marque visuelle : « Vous », « Créateur » / « Marque », « INFLUX ». Trois porteurs : nom, pastille de rôle, alignement (`12` RG7) |
| Messages système | Liste fermée de `12` RG14, rendus dans la langue du lecteur, jamais stockés en texte. Forme visuelle **distincte d'une bulle** |
| Coordonnées | Restent masquées **après** l'ouverture (`12` RG29). Rien dans le fil ne les réaffiche |
| Liens | Affichés en clair, **non cliquables** (`12` RG41) |
| Documents | Onglet séparé (§4.8), jamais un trombone dans la zone de saisie |
| Fil en pause / clos | Zone de saisie remplacée par un **encart explicatif écrit** ; le motif est neutre pour les parties (`12` RG32) |

**La détection de coordonnées à l'envoi** — l'interaction la plus délicate du fil :

```
┌───────────────────────────────────────────────────────────┐
│ [i:alert-triangle] Avant d'envoyer                        │
│ Votre message contient ce qui ressemble à un numéro de    │
│ téléphone :                                               │
│ « …appelez-moi au ██ ██ ██ ██ ██… »   (surligné dans      │
│                                        votre brouillon)   │
│                                                           │
│ Les échanges se passent ici. En dehors, INFLUX ne peut    │
│ plus vous accompagner ni intervenir en cas de problème.   │
│                                              12 RG43      │
│ [□ Modifier mon message]      [■ Envoyer quand même]      │
└───────────────────────────────────────────────────────────┘
```

Non bloquant, deux actions, **ton jamais menaçant**, aucune mention de sanction, aucune mention de
la clause de non-contournement à cet endroit (elle vit dans les CGU, `05` RG26). Le destinataire
n'est **jamais** informé qu'une détection a eu lieu (`12` RG50).

**États du fil :** *chargement* squelettes de bulles, en-tête déjà rendu (il vient de la route) ·
*vide* conversation ouverte, aucun message : le message système d'ouverture est déjà là, plus une
invite « Présentez-vous en une phrase : {agent} vous lit » · *erreur d'envoi* le message reste dans
la zone de saisie, marqué « non envoyé » + `[◦ Réessayer]`, **jamais perdu** · *écriture refusée*
(compte suspendu, pause, clôture, blocage) encart écrit et explicite (`12` RG39) · *plafond atteint*
message d'explication temporaire (`12` RG40) · *accès refusé* un membre qui atteint l'URL d'un fil
dont il n'est pas participant obtient un **404 neutre**, jamais « conversation existante mais
interdite » (`12` RG34) · *hors ligne* bandeau, saisie conservée localement, envoi différé manuel.

### 4.8 M8 — Le canal de documents

Onglet du fil, pas un bouton dans la zone de saisie : la distinction est **énoncée en une phrase**
(`12` RG65) — « un message part tout de suite ; un document est contrôlé par INFLUX avant d'être
mis à disposition ».

```
┌───────────────────────────────────────────────────────────┐
│ Documents de la mise en relation MER-2026-000123          │
│ Images uniquement (PNG, JPEG, WebP). Contrat, devis et    │
│ facture ne passent pas par ce canal.          12 RG68,70  │
│                                                           │
│ [□ Déposer un document]   Libellé : [Brief v]  liste      │
│                                                fermée RG69│
│ ┌───────────────────────────────────────────────────────┐ │
│ │ ▣ moodboard.png · Brief · déposé par vous le 12 mars  │ │
│ │   [i:clock] En cours de contrôle par INFLUX — pas     │ │
│ │   encore visible de l'autre partie.          RG72     │ │
│ ├───────────────────────────────────────────────────────┤ │
│ │ ▣ exemple.jpg · Exemple · Marque Alpha · 11 mars      │ │
│ │   [i:check] Mis à disposition le 11 mars       RG74   │ │
│ ├───────────────────────────────────────────────────────┤ │
│ │ ▣ visuel.png · refusé le 10 mars — {motif typé}       │ │
│ │   Visible de vous seul.                        RG73   │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

**États :** *vide* « Aucun document. Les documents sont contrôlés avant d'être partagés. » ·
*chargement du dépôt* barre de progression **avec pourcentage écrit**, annulation possible ·
*erreur de dépôt* type ou taille refusés → message nommant la contrainte, **le reste du formulaire
est conservé** · *refusé* motif typé, visible du seul déposant · *succès* message système
`document.available` dans le fil.

### 4.9 Les autres écrans de l'espace marque

| Écran | Contenu | Points de vigilance | Règles |
|---|---|---|---|
| Liste des campagnes | Une ligne par campagne : titre, **état écrit**, date, nombre de relations ouvertes, plafond atteint le cas échéant | Le nombre de candidatures reçues est visible **de la marque** ; jamais du créateur | `09` RG3, RG82 |
| Fiche de campagne (vue marque) | Les 8 blocs en lecture, avec les champs internes dans un encart « jamais publié » ; actions : modifier, mettre en pause, clôturer, dupliquer | Clôturer est **irréversible** : confirmation explicite qui le dit | `09` RG9, RG65 |
| Prévisualisation « ce que voit un créateur » | Affiche **exactement la réponse de l'interface de service**, jamais une reconstitution | C'est là que la marque constate que son budget total n'est pas publié | `09` RG102 |
| Mes sélections | Listes privées, rattachables à une campagne, cartes anonymes | Aucune notification au créateur, aucun export, aucun « tout sélectionner » | `10` RG51, RG63 |
| Ce que voit un créateur de mon profil | Le tableau de `06` RG74, rédigé pour la marque | À placer dans le profil, pas dans l'aide : la marque doit le voir **avant** de saisir son téléphone | `06` RG76 |
| Demande de sélection à l'équipe | Reprend tous les critères saisis + la campagne + un champ libre | Confirme un **délai**, pas une promesse de résultat | `10` RG61 |

---

<!-- SUITE -->




