# Parcours et écrans des espaces membres — marque et créateur

> **⚠️ Régime du pilote — D48 (arbitrage du fondateur du 2026-09-24).** Pendant le pilote, **aucun taux ni aucun net créateur estimé n'est affiché**, ni aux marques ni aux créateurs. Toutes les mentions du « net créateur estimé » et du pourcentage de commission dans ce document sont **suspendues** jusqu'à nouvel arbitrage ; la commission est présentée comme « incluse, précisée par votre commercial ». Voir `CLAUDE.md` §2 et `decisions.md` (D48).

> **Date :** 2026-09-19 · **Auteur :** agent `expert-ux` · **Statut :** conception UX complète des
> **deux espaces membres** du MVP (`apps/web`), soumise au fondateur (branding, §9),
> à `expert-conformite-rgpd` (veto : information des personnes, libellés du badge, texte
> d'acceptation) et à `product-owner` (cohérence avec les règles de gestion).
>
> **Skill appliquée :** `design-system-influx` (format de sortie, checklist d'accessibilité,
> procédure de token).
>
> **Documents qui contraignent celui-ci, et qui priment en cas d'écart :** `CLAUDE.md` §1 à §4 ·
> `docs/mvp/00-cadrage-mvp-v2.md` §6.1 et §6.2 · `03-matrice-des-droits-et-rls.md` (ce qu'un membre
> ne voit jamais) · `05-spec-inscription-et-leads.md` · `06-criteres-profil-marque.md` ·
> `07-criteres-profil-createur-reseaux-audience.md` · `08-verification-et-badge.md` ·
> `09-criteres-campagne.md` · `10-recherche-createurs-anonymisee.md` ·
> `11-recherche-campagnes-et-candidature.md` · `12-messagerie-a-trois.md` ·
> `13-file-de-validation-et-mise-en-relation.md`.
> Référence de forme : `docs/landing-page/02-ux-wireframes.md` §2 et §2.8.
> Tokens : `packages/ui/src/styles/tokens.css` (**D6 tranchée, dark theme, 2026-09-17**) ; **charte KEO
> Emerald des espaces depuis le 2026-10-28 (D73)** : gabarits en §2.2 et §2.3, valeurs en `20` §11.
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
> (`CLAUDE.md` §2, régime transitoire). Les montants nets affichés au créateur sont **lus dans le
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

**Conséquence non négociable** (`CLAUDE.md` §4, D41) : **aucun écran n'est partagé
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
| 4 | **Mises en relation** — 2 sous-pages (D74) : *demandes* · *conversations* | **Mes relations** — 2 sous-pages (D74) : *invitations* · *conversations* |
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

### 2.2 Navigation mobile et tablette : barre du bas, 5 items, jamais 6

*(Révisé le 2026-10-28 — charte KEO Emerald, D73 ; valeurs, contrastes et composants : `20` §11.)*

```
Mobile 375 — gabarit commun aux deux espaces (ici : espace marque, page « Mes données »)
┌─────────────────────────────────────────┐
│ INFLUX                [i:bell]³  FR|EN  │  En-tête collant, header-height, z-header
├─────────────────────────────────────────┤  surface-page + filet bas border-default
│ ‹ Mon compte                            │  retour à la page-menu (D74)
│ Mes données                             │  h1, text-title-page
│                                         │  aucune pilule de section (D74)
│ contenu défilant                        │  <main> : padding bas =
│ …                                       │  size-nav-bottom-height + spacing-5
│                                         │  + zone de sécurité de l'appareil
├─────────────────────────────────────────┤
│ [i:home]  [i:megaphone]  [i:search]     │  Barre du bas, fixe, z-nav-bottom
│ Accueil   Campagnes      Créateurs      │  (< z-header) ; surface-page
│                  ▔▔▔▔▔▔                 │  + filet haut border-default
│ [i:handshake]²   [i:user]               │  ▔ = trait 2 px de l'item actif
│ Relations        Compte                 │  une seule ligne de 5 cellules à
└─────────────────────────────────────────┘  l'écran, dessinée ici sur deux
```

| Règle | Détail |
|---|---|
| Points de rupture | Sous `breakpoint-lg` (1 024 px) : en-tête + barre du bas. Conception à 375 px, vérification à 320 px (WCAG 1.4.10) : cinq cellules de 64 px restent au-dessus de `size-touch-target` |
| Tablette (768–1 023 px) | Même gabarit. Cellules de la barre plafonnées à `spacing-11` (6 rem), groupe centré ; contenu en `container-narrow`, centré. **Pas de colonne latérale** : une tablette en portrait se tient à deux mains, et 16 rem de colonne ne laisseraient que 512 px au contenu |
| En-tête | INFLUX (lien vers l'accueil de l'espace) · pastille de rôle de l'espace (« Espace marque », « Espace créateur », `20` §11.3 usage (1) ; L2AU-2) · cloche (Lot 4, absente avant) · langue. Ni débordement ni troncature à 320 px. `surface-page`, filet bas `border-default`, sans flou ni transparence |
| Barre du bas | Hauteur `size-nav-bottom-height` **plus la zone de sécurité de l'appareil** (`env(safe-area-inset-bottom)`, `viewport-fit=cover`) : sans elle, l'indicateur d'accueil de l'iPhone recouvre les libellés |
| Libellé toujours visible | Jamais d'icône seule. Une icône seule oblige à apprendre un vocabulaire visuel ; un créateur qui vient trois fois par mois ne l'apprend pas. `text-xs`, Max 11 caractères FR **et** EN. *« Candidatures » (12) dépasse : à raccourcir par `expert-marketing`, ou limite portée à 12 après essai à 320 px* |
| Item actif | **Trois porteurs simultanés** : `aria-current="page"`, libellé et icône en `font-weight-semibold` + `color-text-primary`, et un **trait supérieur** de 2 px `color-nav-item-active-indicator`. Inactif : `color-text-secondary`. Jamais la couleur seule (`CLAUDE.md` §4) |
| Pastille de compte | Nombre **exact jusqu'à 9**, puis « 9+ ». Accompagnée d'un texte masqué visuellement : « 3 éléments nouveaux ». Jamais un simple point coloré. Pastille claire `color-counter-bg` / `-text` (17,46:1) |
| Sémantique | `<nav aria-label="Navigation principale">` + `<ul>` de liens `next/link`. **Des liens, pas des boutons** : l'ouverture dans un nouvel onglet doit fonctionner |
| Un seul `<nav>` | *(révisé le 2026-10-28, `02` §21.5 point 3)* **Un seul élément `<nav>` « Navigation principale » dans le DOM**, rendu une fois par le serveur et **restylé par le CSS** : barre fixée en bas sous `lg`, liste verticale de la colonne (§2.3) à partir de `lg`. Ni détection de largeur en JavaScript, ni lecture de l'agent utilisateur, ni second `<nav>` masqué. **Un libellé par entrée, identique aux deux largeurs** (≤ 11 caractères FR et EN) ; le titre de page garde le nom complet (« Mes campagnes », « Mises en relation »). Le bloc d'état du compte, l'aide, la langue et la déconnexion sont hors du `<nav>` |
| Sous-navigation | *(Révisé le 2026-10-29, D74 ; détail : `archives/jalons/sn-fiche.md`.)* Une rubrique à plusieurs pages (les quatre pages de « Mon compte » ; au Lot 4, *demandes* · *conversations*) ouvre sa **page-menu** : liste de liens pleine largeur, une phrase par ligne, compteur éventuel ; chaque sous-page porte « ‹ ⟨rubrique⟩ » au-dessus du `h1`. **Ni pilules de section, ni onglets de rubrique** ; seule exception, les canaux d'une conversation (§4.7, `20` §7). La barre du bas ne porte jamais de sous-entrée, jamais un sixième item |
| Écran-objet | Un écran plein écran de niveau objet (conversation, §4.7) remplace l'en-tête par un retour `[◁]` et son titre, et la barre du bas par sa zone d'action |
| Entrées sans écran | **Masquées** tant que l'écran n'existe pas (Campagnes, Créateurs ou Candidatures, Relations arrivent aux Lots 3 et 4) ; une entrée apparue ne disparaît plus (§2.4). Le gabarit est conçu et testé pour cinq entrées, avec les libellés FR et EN les plus longs. Au 2026-10-28 : Accueil et Compte. *(Arbitrage `chef-de-projet` du 2026-10-28)* |
| Clavier et focus | Lien d'évitement « Aller au contenu » en premier élément focalisable, visible au focus, vers `<main>`. Ordre : lien d'évitement → en-tête → barre → contenu. Après une navigation, le focus va au `h1` (`tabindex="-1"`). Dans la barre, anneau intérieur (`focus-ring-offset-inset`) pour ne pas être rogné par le bord de l'écran |

### 2.3 Navigation desktop : colonne à gauche, façon Railway

*(Révisé le 2026-10-28 — D73. Référence de comportement : Railway ; ce qu'on lui prend et ce qu'on
ne lui prend pas : `20` §3. Valeurs et composants : `20` §11.)*

```
Desktop 1440 — gabarit commun aux deux espaces (ici : espace marque, page « Mes données »)
┌────────────────────────────────────┬──────────────────────────────────────────────────┐
│ INFLUX                    [i:bell]³│ ‹ Mon compte                                     │
│ ● Espace marque                    │ Mes données                           [■ Action] │
│                                    │ ──────────────────────────────────────────────── │
│  [i:home]      Accueil             │                                                  │
│  [i:megaphone] Campagnes         4 │ Contenu : container-max, centré dans la zone     │
│  [i:search]    Créateurs           │ Grille 12 colonnes ; colonne de droite           │
│  [i:handshake] Relations         2 │ collante (sticky-top-offset) pour les            │
│  [i:user]      Compte              │ récapitulatifs et les actions                    │
│                Mes informations    │                                                  │
│                Mes préférences     │ sous-menu de la rubrique active (D74)            │
│                Mes sessions        │                                                  │
│              ▎ Mes données         │                                                  │
│ ────────────────────────────────── │                                                  │
│ Profil : brouillon                 │                                                  │
│ 3 informations manquantes          │                                                  │
│ [◦ Compléter mon profil]           │                                                  │
│ ────────────────────────────────── │                                                  │
│ [i:life-buoy] Aide                 │                                                  │
│ [i:languages] FR · EN              │                                                  │
│ Camille R. · Marque Alpha          │                                                  │
│ [i:log-out] Se déconnecter         │                                                  │
└────────────────────────────────────┴──────────────────────────────────────────────────┘
  size-member-rail (16 rem) :          zone de contenu, défile seule
  collante, pleine hauteur,            ▎ = filet 2 px de l'item actif
  défilement propre                    ● = point de rôle (color-role-advertiser)
```

| Élément | Règle |
|---|---|
| Point de rupture | ≥ `breakpoint-lg` (1 024 px) ; conception à 1 440. De 1 024 à 1 279 px, colonne inchangée, le contenu garde au moins 768 px. Sous 1 024 px : §2.2. **Aucun menu « hamburger »** dans l'espace membre : cinq items tiennent dans une barre, un menu caché coûte un geste par navigation |
| Colonne | Largeur fixe `size-member-rail` (16 rem, nom de `02` §21.5) ; collante, pleine hauteur de fenêtre, défilement propre si son contenu dépasse (petite hauteur, zoom) ; `surface-page`, filet droit `border-default`. Le contenu défile seul. Pas de panneau flottant ni de coins arrondis autour de la colonne (`20` §11.7) |
| En-tête de colonne | INFLUX (lien vers l'accueil de l'espace) et cloche (Lot 4, absente avant) ; dessous, le nom de l'espace dans la pastille neutre de rôle, point de `spacing-3` (`20` §11.3, §11.8 ; L2AU-2). Il dit où l'on est ; ce n'est **pas un sélecteur** (un rôle par compte, D41) |
| Items | Icône `size-icon-md` + libellé `text-md` sur une ligne + compteur à droite ; hauteur ≥ `size-touch-target`, marge `spacing-2` (l'anneau de focus n'est pas rogné), `radius-md`. Actif : surface `color-nav-item-active-bg`, libellé `text-primary` semi-gras, filet gauche 2 px `color-nav-item-active-indicator`, `aria-current="page"`. Libellés courts, les mêmes que dans la barre du bas (§2.2, un seul `<nav>`). « Compte » est actif sur toutes les pages `/compte/*` |
| Sous-menu *(D74, 2026-10-29)* | Les pages d'une rubrique sont une liste **imbriquée dans l'entrée active seulement**, dans le même `<nav>` ; sans icône, libellé aligné sur celui de la rubrique, `text-sm`, hauteur ≥ `size-touch-target`. Sur sa page-menu, la rubrique est l'item courant ; sur une sous-page, elle passe à l'état **ancêtre** (`text-primary` semi-gras, sans surface, sans filet, sans `aria-current`) et la sous-entrée porte surface, filet et `aria-current="page"`. Un seul `aria-current` par page. Masqué sous `lg`. Détail : `archives/jalons/sn-fiche.md` |
| Bloc d'état du compte | Sous les items : état du profil écrit, ce qui manque, `[◦ Compléter mon profil]`. Desktop seulement (sur mobile, il vit sur l'accueil). Arrive avec le profil (Lot 2), absent avant. La complétude **n'est jamais affichée à l'autre partie** (`06` RG57, `07` RG86) |
| Pied de colonne | Aide (absente tant que la page n'existe pas) · langue (sélecteur existant) · identité du compte (prénom et organisation, ou adresse e-mail tant que le profil est vide) · `[◦ Se déconnecter]`, visible, jamais dans un menu caché |
| Zone de contenu | En-tête de page : à partir du niveau 2, lien « ‹ ⟨rubrique⟩ » vers la page-menu (D74), `h1` en `text-title-page`, action principale à droite ; puis le contenu, `container-max` centré dans la zone, grille de 12 colonnes, colonne de droite collante. **Aucune bande de tête au-dessus du contenu** : la cloche et la langue sont dans la colonne |
| Pas de repli | Ni repli en icônes, ni bouton pour masquer la colonne : les cinq libellés restent lisibles (§2.2) ; un repli choisi par l'utilisateur devrait être mémorisé, et le front n'a aucun stockage autorisé (D37, gardes CA8 et CA11) — un repli qui se rouvre à chaque page est pire que pas de repli. Si le besoin apparaît : préférence de compte enregistrée côté serveur, comme la langue |
| Clavier et focus | Lien d'évitement → en-tête de colonne → items (chaque sous-menu juste après sa rubrique) → bloc d'état → pied → contenu. Focus au `h1` après une navigation |
| Entrées sans écran | Comme §2.2 |

**États du gabarit (mobile et desktop)**

| État | Rendu |
|---|---|
| Chargement de la session | Cadre affiché (en-tête, colonne ou barre), items et contenu en squelette à hauteur fixe ; aucun saut à l'arrivée |
| Session illisible | Cadre sans navigation, notice d'erreur, `[□ Réessayer]` (existant) |
| Session expirée | Retour à la connexion (§6.7) |
| Hors ligne | Bandeau d'alerte sous l'en-tête de page (existant) |
| CGU à ré-accepter | Écran bloquant avant toute page, sans navigation (`05` RG28) |
| Déconnecté, compte supprimé | Page autonome (`20` §11.8), sans navigation |
| Espace d'un autre rôle | Routage vers l'espace du rôle réel (§2.5) |

**Microcopies du gabarit** (à rapprocher des clés existantes `account.nav.*`)

| Clé | Français | English |
|---|---|---|
| `shell.skipToContent` | Aller au contenu | Skip to content |
| `shell.nav.label` | Navigation principale | Main navigation |
| `shell.space.advertiser` | Espace marque | Brand space |
| `shell.space.creator` | Espace créateur | Creator space |
| `shell.footer.help` | Aide | Help |
| `shell.footer.signOut` | Se déconnecter | Sign out |
| `shell.counter.srOnly` | {count, plural, one {# élément nouveau} other {# éléments nouveaux}} | {count, plural, one {# new item} other {# new items}} |
| `shell.accountState.missing` | {count, plural, one {# information manquante} other {# informations manquantes}} | {count, plural, one {# detail missing} other {# details missing}} |
| `shell.accountState.complete` | Compléter mon profil | Complete my profile |

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

*(J3, 2026-09-27)* **Au J3**, l'écran 3 n'existe pas encore : l'adresse inconnue affiche
`auth.signup.notYetAvailable` (`05` RG139, poste local et `staging` fermé seulement). Le compte
interne affiche `auth.internalAccount.title`, `.notice` et `.help`, **sans lien ni adresse de
l'espace interne** (`05` RG140). Messages avant et après vérification : `05` RG138.

### 2.6 Adresses et libellés d'URL

| Espace | Chemin | Note |
|---|---|---|
| Marque | `/[locale]/marque`, `/campagnes`, `/campagnes/[id]`, `/campagnes/[id]/apercu` · `/campaigns/[id]/preview` (aperçu « ce que voit un créateur », EC-L3B-4), `/createurs`, `/selections`, `/relations`, `/relations/[reference]`, `/compte/*` (dont `/compte/profil` · `/account/profile`, M2 du profil marque, EC-L2B-7) | `[id]` de campagne **opaque**, jamais séquentiel |
| Créateur | `/[locale]/createur`, `/campagnes`, `/campagnes/[id]`, `/candidatures`, `/relations`, `/relations/[reference]`, `/compte/*` | Une carte créateur est référencée par son **alias** (`10` RG65) |
| Commun | `/[locale]/connexion` (3 écrans), `/[locale]/compte` (page-menu, D74), `/compte/informations`, `/compte/preferences`, `/compte/sessions`, `/compte/donnees`, `/aide` | « Mes informations » a quitté `/compte` le 2026-10-29 (D74) |

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
| Signature de médiation *(L2AU-1)* | Sous le `h1`, en `text-secondary`, à la connexion comme à l'inscription : un commercial INFLUX accompagne jusqu'à la mise en relation, **sans promesse de délai**. Porte connue (inscription seulement, jamais `connexion`) : pastille de rôle « Marque » / « Créateur » au-dessus du `h1` (`20` §11.3 usage (2)) | `20` §11.7, D45 |
| Rappel de porte | Le profil choisi, **modifiable jusqu'à la création du compte**. « Changer » revient au choix de porte et **décoche le consentement** et efface les champs du profil abandonné | `05` RG3, RG4 |
| Champ e-mail | Étiquette visible, `type="email"`, `inputmode="email"`, `autocomplete="email"`, `spellcheck="false"`. **Jamais un texte d'exemple seul** | `05` RG115 |
| Mention d'information | **Visible dès cet écran**, pas repliée dans un accordéon fermé : finalités, **Brevo et Apollo.io nommés**, droits, lien vers la politique de confidentialité | `05` RG6 |
| Ce qui n'y est pas | Mot de passe, téléphone, nom, case à cocher, bouton social. Chaque élément ajouté ici coûte des inscriptions | `05` RG16, RG21, D37 |

**Clés de traduction**

| Clé | FR (intention) | EN (intention) | Max |
|---|---|---|---|
| `auth.step1.title` | Continuer avec votre e-mail | Continue with your email | 40 |
| `auth.step1.mediation` *(L2AU-1)* | Un commercial INFLUX vous accompagne jusqu'à la mise en relation. | An INFLUX salesperson guides you through to the introduction. | 80 |
| `auth.step1.role.advertiser` · `.creator` *(L2AU-1)* | Marque · Créateur | Brand · Creator | 12 |
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
| Phrase de correspondance | En évidence **au-dessus** du champ, pas en bas de page : elle sert à détecter un site contrefait **avant** de taper (`05` RG48). *(J3, 2026-09-27)* **Deux noms communs en minuscules** (« ancre lune » ; le « ANCRE TRANQUILLE » du schéma est antérieur), capitales par le style seulement, attribut de langue propre, **inchangée si la page change de langue** (`05` RG128 à RG132) |
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
│                               │        │ [ ] Je certifie avoir 18 ans  │
│                               │        │     ou plus. *          RG19  │
│                               │        │     Les personnes de moins de │
│                               │        │     18 ans ne peuvent pas     │
│                               │        │     utiliser INFLUX.          │
│ ───────────────────────────── │        │ ───────────────────────────── │
│ [ ] J'accepte les conditions  │        │ [ ] J'accepte les conditions  │
│     générales d'utilisation * │        │     générales d'utilisation * │
│     [◦ Lire les CGU]    RG23  │        │     [◦ Lire les CGU]          │
│                               │        │                               │
│ [ ] J'accepte (requis, D63) — │        │ [ ] J'accepte (requis, D63) — │
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
| Deux cases, jamais une | CGU (obligatoire) et consentement Brevo / Apollo (**obligatoire depuis D63**, `05` RG124) sont **visuellement séparées par un filet**, jamais empilées sans séparation. Cocher l'une ne coche jamais l'autre (`05` RG23) |
| Aucune case pré-cochée | Y compris la langue, qui est **présélectionnée** (choix exclusif) mais reste une sélection, pas une case (`05` RG11, RG17) |
| ~~« Facultatif » dans le libellé~~ | **Abrogé par D63** : la case est obligatoire, le libellé le dit et rappelle que l'accord se retire à tout moment | `05` RG124, RG127 |
| Marketing : une case, deux finalités | Les deux finalités sont citées **dans les deux portes**, quelle que soit la valeur du périmètre Apollo (`05` RG31, RG33). *Si `expert-conformite-rgpd` exige deux cases (Q10), seul ce bloc change : deux cases empilées, même filet, même ordre* |
| Majorité | **Âge fixe : 18 ans ou plus**, identique dans tous les pays, jamais la majorité du pays déclaré (`05` RG19, D15 précisée le 2026-10-08) |
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

### 3.7 L'écran minimal du J3 *(J3, 2026-09-27)*

**Contexte.** `21` J3, point 9 et commit 12 : au J3, un écran minimal de connexion membre, construit
avec les tokens existants ; le parcours complet (écrans 1 à 3, portes, mention d'information de
`05` RG6) arrive au J5. L'écran du J3 ne tourne **qu'en local et sur `staging` fermé**. Ce qui suit
fixe **ce qu'il contient**, pas sa mise en forme finale (`expert-ux`).

| Étape | Contenu | Clés |
|---|---|---|
| Adresse | Titre, phrase d'introduction, champ e-mail, bouton | `auth.step1.title`, `.lead`, `.emailLabel`, `.submit`, `.submitBusy` (§3.1) ; erreurs `signup.email.errors.*` (`05` RG112) |
| Issue de la demande | `sent` → étape « code » avec `auth.code.sent` ; `undeliverable` → `auth.email.errors.undeliverable` ; `provider_unavailable` → `auth.errors.serviceUnavailable`, saisie conservée ; `rate_limited` → `auth.email.errors.rateLimited` | `05` RG112, RG138 |
| Code | Titre, adresse rappelée avec « Modifier », **phrase de correspondance au-dessus du champ**, champ unique à six cases, bouton, rappel « restez dans cet onglet », compte à rebours de renvoi, « Recevoir un nouveau code », « Je ne reçois pas le code » (au J3 : la seule liste de vérifications, sans canal de secours) | `auth.step2.*` (`05`, additif du 2026-09-27), `auth.code.resend.countdown` |
| Erreurs du code | Échecs 1 à 4 : `auth.code.errors.invalid` ; 5ᵉ : `auth.code.errors.tooManyAttempts` puis `auth.step2.newCode` seul ; après 10 min : `auth.code.errors.expired` quel que soit le code ; après 15 min ou dans un autre navigateur : `auth.code.errors.sessionLost` ; plafond réseau : `auth.code.errors.tooManyRequests` ; panne : `auth.code.errors.verifyUnavailable` ; renvoi plafonné : `auth.code.resend.limit` | `05` RG136, RG137 |
| Après vérification | Espace du rôle (§2.5) ; ou compte interne, compte suspendu, adresse inconnue au J3 : écran d'issue avec `auth.restart` | `05` RG139, RG140 |
| Accueils vides | Bouton `auth.logout` ; après déconnexion, `auth.logout.done` | — |

Les règles d'accessibilité du §3.6 s'appliquent telles quelles, y compris le focus porté sur le
titre à chaque étape et le compte à rebours annoncé toutes les dix secondes.

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
│ │ [i:lock] Prénom : masqué jusqu'à la mise en  │ │                           │
│ │ relation. E-mail, téléphone, page : internes,│ │                           │
│ │ vus d'INFLUX seul, jamais d'un membre (D46). │ │                           │
│ │                                  RG35, RG37  │ │                           │
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

**Quand le texte ne tient pas sur une ligne** (recette L2D, décision du fondateur, 2026-11-06), le
badge se réduit à son icône, dans sa teinte, à côté du libellé du champ ; jamais de badge sur deux
lignes. La largeur est mesurée, pas présumée : le badge reste entier dès que la place le permet. Le
texte s'affiche au survol, au focus clavier et au toucher ; Échap ou un toucher ailleurs le referme,
et il reste lisible dans un formulaire en lecture seule. Il demeure le nom de l'icône et la
description du champ pour un lecteur d'écran (`06` RG85, CA39). Vaut aussi pour les étiquettes du
créateur (§5.2).

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
| 4. Le budget | Bloc 5 budget | « Que payez-vous **par créateur** ? » *(D78, EC-L3B-2 : tranche interne, jamais de minimum ni de maximum)* | Devise, tranche (sauf dotation seule), nature, nombre de créateurs |
| 5. Calendrier et candidature | Blocs 6 et 7 | « Quand, et que doit envoyer un créateur ? » | 4 dates |
| — | Bloc 8 interne | Réparti : référence interne en étape 1, budget total en étape 4, notes en étape 5 — **toujours dans un encart « Interne — jamais publié »** | — |

> **Amendement L3B (EC-L3B-2, D78).** La maquette de l'étape 4 ci-dessous est antérieure à
> l'extension de D78 au Lot 3 : elle ne fait plus foi. L'étape 4 suit le bandeau de `09` §F : la marque
> choisit une **tranche par créateur** (`reference.price_bands`, dans la devise de la campagne,
> « commission INFLUX incluse »), obligatoire sauf « dotation seule » ; aucune fourchette, aucun
> montant ni net, aucun récapitulatif chiffré « ce que voit un créateur » (le créateur voit la nature
> de la rémunération et « À négocier avec votre commercial »). Aucun budget total n'est saisi
> (EC-L3B-10-1).

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

Deux sous-pages, parce que ce sont deux tâches : *ce que j'attends* et *ce qui est ouvert*.
*(Révisé le 2026-10-29, D74 : sous-entrées de « Mises en relation » dans la colonne, page-menu avec
compteurs sous 1 024 px ; plus d'onglets.)*

```
Desktop
┌──────────────────────────────────────────────────────────────────────────────┐
│ ‹ Mises en relation                                                          │
│ Demandes                                                                 h1  │
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

## 5. Espace créateur

**Population :** un créateur majeur, particulier ou professionnel, **sur mobile**, souvent
interrompu. **Tâche :** comprendre ce qu'on lui propose et **combien il touche**, sans lire un
contrat. **Vocabulaire :** offre, contenu, tarif, ce que je perçois, délai — jamais « annonceur »,
jamais « intermédiation ».

**Règle de conception propre à cet espace :** chaque écran tient une promesse en une phrase, et
**une seule action principale** est atteignable au pouce. Tout écran de cet espace est conçu à
375 px d'abord, puis étendu.

### 5.1 C1 — Accueil créateur

```
Mobile 375
┌───────────────────────────────┐
│ INFLUX      [i:bell]²  [FR|EN]│
├───────────────────────────────┤
│ Bonjour                   h1  │
│                               │
│ ┌───────────────────────────┐ │
│ │ [i:alert] À FAIRE         │ │  n'affiche que l'actionnable ;
│ │ • 1 mise en relation à    │ │  zéro élément → bloc absent
│ │   accepter    [■ Voir]    │ │
│ │ • Vos chiffres datent du  │ │  creatorProfile.figures.stale
│ │   4 déc. Au-delà de       │ │  07 RG50 — factuel, pas culpabilisant
│ │   90 jours, votre profil  │ │
│ │   est affiché plus bas.   │ │
│ │   [□ Mettre à jour]       │ │
│ └───────────────────────────┘ │
│                               │
│ ┌───────────────────────────┐ │
│ │ MON PROFIL                │ │
│ │ Publié ✓ · Profil 7K3M    │ │  alias rappelé : c'est ainsi
│ │ Complétude 74 % ▓▓▓▓▓▓▓░  │ │  que les marques le voient
│ │ Sans répartition          │ │  creatorProfile.alias.explain
│ │ d'audience par pays, vous │ │
│ │ n'apparaissez pas quand   │ │  message factuel et vérifiable
│ │ une marque filtre sur un  │ │  07 RG90
│ │ pays. [□ Compléter]       │ │
│ └───────────────────────────┘ │
│                               │
│ CAMPAGNES POUR VOUS           │
│ ┌───────────────────────────┐ │
│ │ carte de campagne (§5.5)  │ │  3 cartes maximum
│ └───────────────────────────┘ │
│ [□ Voir toutes les campagnes] │
│                               │
│ 3 candidatures actives sur 10 │  11 RG63, compteur permanent
└───────────────────────────────┘
```

**Compte tout neuf** (§2.4) : le bloc « À faire » contient une seule entrée — « Faites vérifier un
compte pour publier votre profil » (`08` RG16) — et le fil des campagnes est **déjà consultable**
(`09` RG99, `11` RG13). Un encart pédagogique unique explique les trois notions d'argent, **sans
aucun chiffre** (§7.3).

**États :** *chargement* squelettes · *vide* décrit ci-dessus · *erreur* bandeau + réessayer ·
*profil suspendu* bandeau neutre, fil inaccessible, candidatures clôturées (`11` RG23, RG80) ·
*succès* sans objet.

### 5.2 C2 — Profil créateur : sept blocs, trois couches, une complétude honnête

C'est le formulaire le plus long du produit. Il est donc découpé en **sept sections navigables**,
chacune ouvrable indépendamment, avec **enregistrement automatique** (`07` RG111) et **étiquette de
couche sur chaque champ** (`07` RG21).

```
Mobile 375 — sommaire du profil
┌───────────────────────────────┐
│ Mon profil                h1  │
│ Publié ✓ · Profil 7K3M        │
│ ┌───────────────────────────┐ │
│ │ Complétude 74 %           │ │
│ │ ▓▓▓▓▓▓▓░░                 │ │
│ │ Il manque pour publier :  │ │  liste NOMINATIVE, jamais « 3 champs »
│ │ disponibilité, tarif      │ │  07 RG89, RG90
│ │ indicatif.                │ │
│ └───────────────────────────┘ │
│                               │
│ 1 Présentation           ✓ [›]│
│ 2 Ligne éditoriale       ✓ [›]│
│ 3 Réseaux sociaux       2 [›] │  badges par réseau (§5.3)
│ 4 Audience               ✓ [›]│
│ 5 Mon offre et mes tarifs ! [›]│  « ! » = incomplet, doublé du texte
│ 6 Portfolio            3/8 [›]│
│ 7 Visibilité             ✓ [›]│
│                               │
│ [■ Publier mon profil]        │  jamais désactivé : au clic, il
└───────────────────────────────┘  affiche ce qui manque et y emmène

Desktop : sommaire en colonne de gauche (ancres), sections empilées à droite,
colonne de complétude collante à droite. Trois colonnes, pas deux.
```

**Bloc 1 — Présentation.** L'écran le plus contre-intuitif du produit : on demande à un créateur de
**ne pas** se nommer. L'explication précède la saisie, elle ne la suit pas.

```
┌───────────────────────────────────────────────────────────┐
│ 1. Présentation                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ [i:shield] Votre alias : Profil 7K3M                  │ │
│ │ Les marques vous voient sous ce nom tant qu'aucune    │ │  creatorProfile.
│ │ mise en relation n'est ouverte. Votre pseudo, vos     │ │  alias.explain
│ │ liens et vos chiffres exacts ne leur sont             │ │  07 RG23, RG24
│ │ communiqués qu'à ce moment-là, et à elles seules.     │ │
│ │ L'alias est attribué à vie : ni vous, ni INFLUX ne    │ │
│ │ pouvez le changer.                                    │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ Titre court * (20–120)          [Visible de toutes les    │
│ ┌─────────────────────────────┐  marques]                 │
│ │                     0/120   │                           │
│ └─────────────────────────────┘                           │
│ Sans pseudo, sans @, sans lien, sans nom de marque.  RG25 │
│                                                           │
│ Bio * (150–800)                 [Visible de toutes les    │
│ ┌─────────────────────────────┐  marques]                 │
│ │                     0/800   │                           │
│ └─────────────────────────────┘                           │
│                                                           │
│ ┌─ [i:eye-off] Visible uniquement par vous et l'équipe ──┐│
│ │ Nom et prénom légaux   [              ]  (au 1er badge)││
│ │ Téléphone              [              ]                ││
│ │ E-mail de contact      [              ]                ││
│ └────────────────────────────────────────────────────────┘│
│ Aucune photo de profil n'est demandée : elle permettrait  │
│ de vous retrouver en une recherche d'image.       RG29    │
└───────────────────────────────────────────────────────────┘
```

**Les trois étiquettes de couche, libellés imposés** (`07` RG112) :

| Étiquette affichée | Clé | Forme |
|---|---|---|
| Visible de toutes les marques inscrites. | `creatorProfile.layer.public` | `[i:globe]` + texte, `color-surface-raised` |
| Visible uniquement après l'ouverture d'une mise en relation. | `creatorProfile.layer.revealed` | `[i:lock]` + texte, `color-brand-subtle-bg` |
| Visible uniquement par vous et l'équipe INFLUX. | `creatorProfile.layer.internal` | `[i:eye-off]` + texte, `color-text-tertiary` |

Un texte qui ne tient pas sur une ligne laisse l'icône seule, et s'affiche à la demande (§4.2).

> **Écart relevé dans l'implémentation en cours** (§10, E2) : les libellés codés aujourd'hui
> (« Couche A · Public Anonyme », « Couche I · Révélé sur accord », « Couche N · Interne INFLUX »)
> exposent un vocabulaire interne. Les codes A / I / N sont un outil de spécification, **pas un
> libellé d'interface**. Les libellés ci-dessus font foi.

**Bloc 4 — Audience.** Tous les libellés portent sur **l'audience**, jamais sur le créateur
(`07` RG55) : « 25-34 ans » se lit « part de votre audience âgée de 25 à 34 ans », et le formulaire
l'écrit ainsi. La somme d'une dimension ne peut dépasser 100, le reliquat s'affiche
automatiquement comme **« autres »** et n'est jamais complété par le système (`07` RG57).

**Bloc 6 — Portfolio.** 3 à 8 visuels, modération **un élément = une décision** (`07` RG78). Chaque
visuel porte son état écrit : en cours de modération (`creatorProfile.portfolio.pending`),
approuvé, refusé + motif. La mention `creatorProfile.portfolio.notice` — « vos visuels approuvés
sont visibles de toutes les marques inscrites, **avant** toute mise en relation » — est **au-dessus
de la zone de dépôt**, pas en dessous : c'est là que se perd l'anonymat.

**Bloc 7 — Visibilité.** Un seul interrupteur global (`07` RG8) avec sa conséquence écrite :
`creatorProfile.visibility.off`.

**États :** *chargement* squelette de sommaire · *vide* sections vides + complétude réelle +
liste nominative · *erreur de saisie* par champ, focus au premier invalide,
`creatorProfile.errors.identifierInText` en avertissement **non bloquant** (c'est le modérateur qui
décide, `07` RG27) · *erreur d'enregistrement* bandeau de reprise, aucune perte · *accès refusé*
sans objet · *succès* « Profil soumis à validation. Réponse sous 1 jour ouvré. » ; si déjà publié,
`creatorProfile.status.pendingWithPublished`.

### 5.3 C3 — Réseaux, preuves et badges

Une ligne par réseau (`07` RG41). Chaque ligne est une **carte autonome** portant ses chiffres, sa
date et ses deux badges.

```
Mobile 375
┌───────────────────────────────────────────┐
│ 3. Réseaux sociaux         [□ Ajouter]    │
│ ┌───────────────────────────────────────┐ │
│ │ Instagram · compte principal          │ │
│ │ @lea.beauty      [Visible après une   │ │  couche I
│ │ instagram.com/…   mise en relation]   │ │
│ │ ─────────────────────────────────────  │ │
│ │ Les 3 chiffres prioritaires (D61)     │ │  07 RG113 : toujours en
│ │ 1. Abonnés        [   48 200 ]        │ │  tête, dans cet ordre
│ │    Les marques voient : 25 k – 100 k  │ │  tranche dérivée affichée
│ │                              RG22,45  │ │  sous le champ
│ │ 2. Publications des 30 derniers j.    │ │  RG114 : ni stories,
│ │                   [       14 ]        │ │  ni directs
│ │    Les marques voient : plusieurs     │ │  rythme dérivé, jamais
│ │    fois par semaine                   │ │  le nombre
│ │ 3. Commentaires moyens / publication  │ │  RG115 : 12 dernières
│ │    (12 dernières) [      137 ]        │ │  publications, hors
│ │    Les marques voient : 50 à 199      │ │  jeux-concours ; affiché
│ │                                RG117  │ │  même non constaté
│ │ ───────────────────────────────────── │ │
│ │ Indicateurs secondaires (facult.)     │ │
│ │ Taux d'engagement  [   3,4   ] %      │ │
│ │ [i:eye-off] Non affiché aux marques   │ │  RG48 — absent, pas
│ │ tant qu'INFLUX ne l'a pas constaté.   │ │  « non vérifié »
│ │ Portée moyenne / publication [      ] │ │
│ │ Mis à jour le 12 mars      (auto)     │ │  RG50 — non saisissable ;
│ │                                       │ │  RG116 : renouvelée si les
│ │                                       │ │  3 chiffres sont confirmés
│ │ ─────────────────────────────────────  │ │
│ │ ✓ Compte vérifié — Instagram,         │ │  libellé 08 RG10,
│ │   le 3 mars 2026                      │ │  DATE OBLIGATOIRE
│ │   INFLUX a constaté que ce compte     │ │
│ │   vous appartient.                    │ │
│ │                                       │ │
│ │ [!] Audience vérifiée le 1er janv.    │ │  état « à rafraîchir »
│ │     2026 — vérification à rafraîchir. │ │  08 RG10, péremption 90 j
│ │     [■ Renvoyer une capture]          │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

**Parcours « faire vérifier un compte »** (`08` §C), en trois écrans mobiles :

| Écran | Contenu | Règle |
|---|---|---|
| 1. Ce que le badge affirme | Les quatre affirmations **et** la liste de ce qu'il n'affirme pas — dont « INFLUX ne se prononce pas sur l'authenticité des abonnés ». Au même endroit que le badge, pas dans une aide | `08` RG1, RG2, RG7 |
| 2. Copier le code | Code à usage unique, bouton « Copier », instruction par réseau, `[■ J'ai collé le code]` | `08` RG51 : c'est **l'agent qui constate en ligne**, une capture ne vaut jamais preuve |
| 3. Confirmation | « Demande envoyée. Un agent INFLUX vérifiera votre compte. » + délai annoncé + état visible dans la ligne de réseau | `08` §G |

**Parcours « faire vérifier une audience »** : exige « Compte vérifié » sur le **même réseau**
(`08` RG12) — la condition est **écrite avant** le bouton, jamais découverte après un refus. Le
dépôt demande une capture du **tableau de bord natif, de moins de 30 jours**, avec des consignes de
cadrage explicites (`07` RG54 : une pièce trop large est refusée, parce qu'elle contient des
données de tiers).

**Les quatre états d'un badge**, tous avec libellé écrit et date (`08` RG4, RG10) :

| État | Affichage | Forme |
|---|---|---|
| Absent | Aucun badge, `[□ Faire vérifier]` | — |
| Demandé | « Demande en cours depuis le {date} » | `[i:clock]` + `color-text-secondary` |
| Actif | « Audience vérifiée — Instagram, le {date} » + sous-ligne d'exactitude | `[i:badge-check]` + `color-brand-subtle-bg` + `color-text-brand-strong` |
| À rafraîchir | « Audience vérifiée le {date} — vérification à rafraîchir. » | `[i:alert-triangle]` + `color-feedback-warning-*` |
| Refusé | Motif typé + ce qu'il faut faire | `[i:x-circle]` + `color-feedback-error-*` |

**Interdits d'affichage rappelés** : aucun badge global, aucun « Créateur vérifié », aucun
superlatif, aucune étoile (`08` RG6, RG13). Ces libellés sont **provisoires au titre de D34** et
doivent être relus par un juriste avant tout affichage (`08` RG10, Q1).

### 5.4 C4 — Mon offre et mes tarifs : l'écran de la transparence financière

> **⚠️ Régime du pilote, premier temps (D78, 2026-11-01) : aucun tarif saisi ni affiché**, les coûts
> se négocient avec le commercial. C4 devient « Mon offre » : couples (réseau, format), droits
> d'usage, disponibilité, secteurs refusés, contrepartie non monétaire (`07` §G). Les champs et
> libellés de tarif ci-dessous sont suspendus.

**L'écran le plus dangereux du produit côté créateur** (`07` RG65). Un créateur qui saisit « ce que
je veux toucher » là où le produit attend « ce que la marque paie » se trompe de 35 %.

```
Mobile 375
┌───────────────────────────────────────────┐
│ 5. Mon offre et mes tarifs                │
│ ┌───────────────────────────────────────┐ │
│ │ [i:info] Indiquez ce que la marque    │ │  creatorProfile.rate.hint
│ │ paie au total. Ce que vous percevez   │ │  AVANT le champ, jamais après
│ │ s'affiche juste en dessous.  RG65     │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ Ligne 1 — Instagram · Story    [✕]        │
│ Réseau [Instagram v]  Format [Story v]    │
│                                           │
│ Ce que la marque paie au total *          │
│ ┌─────────────────┐ Devise [EUR v]        │
│ │        750      │                       │  VALEUR EXACTE (couche N)
│ └─────────────────┘                       │  07 RG66
│ Les marques voient la tranche             │
│ 500 – 1 000 EUR.                          │  tranche dérivée par le
│                                           │  système, jamais choisie
│ ┌───────────────────────────────────────┐ │
│ │ CE QUE LA MARQUE PAIE AU TOTAL        │ │
│ │ 500 – 1 000 EUR                       │ │  data-advertiser-share
│ │ ─────────────────────────────────────  │ │
│ │ COMMISSION INFLUX                     │ │
│ │ 20 % à la charge de la marque,        │ │  data-creator-share
│ │ 15 % à votre charge                   │ │
│ │ ─────────────────────────────────────  │ │
│ │ CE QUE VOUS PERCEVEZ, ESTIMATION      │ │  data-net-creator
│ │ ≈ 325 – 650 EUR                       │ │  lu dans le référentiel
│ │                              RG69,72  │ │  des tranches, jamais calculé
│ └───────────────────────────────────────┘ │
│ Estimation indicative, aux taux par       │  creatorProfile.rate.notice
│ défaut de la plateforme. Elle ne vaut     │  mention FIXE, toujours
│ pas engagement : les taux applicables     │  présente
│ sont figés à la signature du contrat.     │
│                                           │
│ Délai de livraison habituel       [v]     │
│ Exclusivité acceptée              [v]     │
│ Droits d'usage INCLUS dans ce tarif  [ ]… │  deux listes distinctes,
│ Droits d'usage EN OPTION             [ ]… │  jamais fusionnées — RG73
│                                           │
│ [□ Ajouter une ligne de tarif]            │
└───────────────────────────────────────────┘
```

| Point | Décision |
|---|---|
| **Trois notions, trois lignes, un seul bloc** | Jamais dans trois endroits de l'écran, jamais dans un repli. Toujours avec la devise. Ordre imposé : coût total → commission → net (`07` RG69) |
| **Le net n'est jamais calculé dans l'écran** | Il est **lu** dans `reference.price_bands` (`07` RG72). L'écran affiche « ≈ » parce que la valeur vient d'une tranche, pas d'un calcul sur le montant saisi |
| Saisie en valeur exacte | Le créateur saisit un montant ; **le système dérive la tranche** et l'écran montre immédiatement ce que la marque verra (`07` RG22, RG66) |
| Devise obligatoire | Une tranche sans devise n'existe pas (`07` RG66). Aucune conversion (`07` RG67) |
| Jamais « HT » ni « TTC » | D7 est ouverte (`07` RG71). Aucun écran ne l'affirme |
| Symétrie | Ce bloc **n'existe dans aucun écran servi à une marque** (`07` RG70) |

**États :** *vide* aucune ligne de tarif → encart « Ajoutez au moins un tarif pour publier votre
profil » + bouton · *erreur* montant nul ou négatif refusé côté navigateur **et** serveur, message
dédié · *chargement* le bloc des trois notions affiche des tirets, jamais un zéro (un « 0 € »
transitoire est un mensonge) · *succès* enregistrement automatique, horodaté.

### 5.5 C5 — Le fil des campagnes

```
Mobile 375
┌───────────────────────────────┐
│ Campagnes                 h1  │
│ [□ Filtres (2)]  [Récentes v] │
│ ┌───────────────────────────┐ │
│ │ [i:info] Nous avons       │ │  RG31 — pré-sélection
│ │ pré-rempli vos thématiques│ │  VISIBLE, NOMMÉE, RETIRABLE
│ │ et vos réseaux. [◦ Retirer]│ │
│ └───────────────────────────┘ │
│ 14 campagnes                  │  RG35 — nombre affiché AVANT la liste
│                               │  (contrairement à la recherche marque :
│ ┌───────────────────────────┐ │   ici rien à ré-identifier)
│ │ ▣  Marque Alpha           │ │
│ │    ✓ Marque vérifiée      │ │  + sa DATE — 06 RG53
│ │      le 3 mars 2026       │ │
│ │ Rentrée beauté 2026   (h3)│ │
│ │ Beauté · Instagram        │ │
│ │ 2 stories + 1 reel        │ │  livrables (réseau, format, quantité)
│ │ ───────────────────────── │ │
│ │ Ce que la marque paie au  │ │  09 RG60 — libellé imposé
│ │ total : 1 000 – 2 000 EUR │ │
│ │ Vous percevriez ≈ 650 –   │ │  net en TRANCHE, avec « ≈ »
│ │ 1 300 EUR                 │ │
│ │ Rémunération en numéraire │ │
│ │ ───────────────────────── │ │
│ │ Audience visée : France   │ │
│ │ Candidatures avant le     │ │
│ │ 28 mars                   │ │
│ │ [■ Voir la campagne]      │ │
│ └───────────────────────────┘ │
│ …                             │
│ [□ Voir la suite]             │  pagination explicite — RG36
└───────────────────────────────┘
```

| Élément | Règle |
|---|---|
| Carte | **Exactement** les informations de `11` RG15, rien de plus |
| Montant | Fourchette + devise + **mention fixe** `11` RG19, et le net estimé en tranche. Les deux notions sont **côte à côte sur la carte**, pas seulement sur la fiche : un créateur trie au pouce, il ne doit pas ouvrir pour savoir |
| Aucun compteur | Ni candidatures reçues, ni vues, ni popularité (`11` RG25) |
| Campagne close | Restée visible **7 jours**, en grisé, **sans bouton**, avec le libellé « candidatures closes » (`11` RG26). Une campagne qui s'évapore fait croire à un bug |
| Réservée aux vérifiés | Mention **écrite en toutes lettres** sur la carte (`11` RG15) |
| Autre devise | Les campagnes dans une autre devise sont **regroupées à part**, jamais converties ni exclues silencieusement (`11` RG28) |
| Profil en brouillon | Le fil reste lisible ; chaque carte porte `application.blocked.profileDraft` **à la place** du bouton (`11` RG23, RG46) |

**États :** *chargement* 3 squelettes de carte · *vide avec filtres* l'écran **nomme les critères
actifs** et propose de retirer le plus restrictif ; il ne prétend jamais qu'aucune campagne n'existe
(`11` RG30) · *vide sans filtre* « Aucune campagne ouverte pour le moment. Complétez votre profil :
c'est ce que regarde un commercial INFLUX quand il rapproche une marque d'un créateur. » · *erreur*
bandeau + réessayer, filtres conservés · *campagne disparue* « Cette campagne n'est plus ouverte »,
jamais une erreur technique (`11` RG24).

### 5.6 C6 et C7 — Fiche de campagne et candidature

**Fiche.** Tout ce que la carte porte, plus le brief détaillé, le produit, les droits d'usage, les
langues et le bloc marque **sans coordonnées** (`11` RG16, `06` RG74). Trois encarts obligatoires :

| Encart | Clé | Quand |
|---|---|---|
| Ce que devient votre contenu | `campaign.usageRights.warning` | Si achat média + illimité + mondial (`09` RG40) |
| Divulgation du caractère commercial | `campaign.disclosure.notice` | Si rémunéré ou produit offert (`09` RG32) |
| Candidater n'ouvre pas de conversation | `campaign.application.validationNotice` | **Toujours**, au-dessus du bouton (`09` RG80) |

**Aucun moyen de contacter la marque** n'existe sur cette page : ni bouton, ni adresse, ni lien
(`09` RG81). Le seul geste possible est la candidature.

**Candidature.** Formulaire **unique et fixe**, identique pour toutes les campagnes (`11` RG47, et
la réconciliation de `09` RG77) : une marque ne peut pas désactiver la motivation.

```
Mobile 375
┌───────────────────────────────────────────┐
│ Candidater · Rentrée beauté 2026      [✕] │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ Cette marque attache une importance   │ │  09 RG77 — mise en avant
│ │ particulière à : proposition de       │ │  INFORMATIVE, n'ajoute
│ │ concept, disponibilité.               │ │  aucun champ
│ └───────────────────────────────────────┘ │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ Ce que le commercial INFLUX verra     │ │  RG48 — rappel en LECTURE
│ │ de votre profil : Profil 7K3M ·       │ │  SEULE, rien n'est redemandé
│ │ Beauté · France · Instagram 25-100 k  │ │
│ │ ✓ Compte vérifié   [◦ Voir mon profil]│ │
│ └───────────────────────────────────────┘ │
│                                           │
│ Votre motivation * (120–2 000)            │
│ ┌───────────────────────────────────────┐ │
│ │                            0/2000     │ │
│ └───────────────────────────────────────┘ │
│ Ni lien, ni @, ni coordonnée : ils seront │  11 RG50
│ partagés une fois la mise en relation     │
│ ouverte.                                  │
│                                           │
│ Proposition de concept (facultatif)       │
│ ┌───────────────────────────────────────┐ │
│ └───────────────────────────────────────┘ │
│                                           │
│ Formats proposés *                        │
│ [x] Story Instagram   [ ] Reel Instagram  │  restreint à l'intersection
│                                           │  campagne × profil — RG47
│ Votre tarif pour cette campagne *         │
│ [i:info] Indiquez ce que la marque paie   │  application.rate.hint
│ au total pour cette campagne.             │
│ ┌─────────────┐ EUR (devise de la         │
│ │    1 500    │      campagne)     RG54   │
│ └─────────────┘                           │
│ ┌───────────────────────────────────────┐ │
│ │ La marque paie au total    1 500 EUR  │ │
│ │ Commission INFLUX  20 % marque,       │ │
│ │                    15 % vous          │ │
│ │ Vous percevriez  ≈ 650 – 1 300 EUR    │ │  application.rate.net
│ └───────────────────────────────────────┘ │  tranche du référentiel
│ Estimation indicative, aux taux par       │  application (11 RG58)
│ défaut de la plateforme…                  │
│                                           │
│ [ ] Je suis disponible sur la période     │  non pré-cochée — RG47
│     annoncée. *                           │
│ [ ] J'accepte cette mise en relation…     │  intro.accept.consent,
│     (version {v} du {date})  [◦ CGU] *    │  non pré-cochée — 13 RG70
│                                           │
│ 3 candidatures actives sur 10       RG63  │
│ [□ Enregistrer]      [■ Vérifier et       │
│                          envoyer]         │
└───────────────────────────────────────────┘
```

**Écran récapitulatif avant envoi** (`11` RG53), obligatoire : campagne, formats, tarif, net
estimé, ce que verra le commercial, et le rappel `application.submit.notice` — « la marque ne
recevra votre candidature qu'après validation par INFLUX ».

**Si le tarif dépasse la fourchette annoncée** : accepté, avec `application.rate.aboveRange`
(`11` RG56). Un créateur n'a pas à être empêché de demander son prix.

**Les cinq conditions pour candidater** (`11` RG46) sont affichées **chacune avec son message
propre** ; aucun bouton désactivé sans explication : `application.blocked.profileDraft`,
`application.blocked.verifiedOnly` (en nommant les réseaux concernés),
`application.quota.reached`, « vous avez déjà candidaté le … », « aucun format commun avec les
livrables de cette campagne ».

**États :** *chargement* squelette de formulaire · *brouillon* enregistré automatiquement, bandeau
« Brouillon enregistré à 14 h 07 » — et l'écran dit qu'un brouillon **n'est pas une candidature**
(`11` RG52) · *erreur de saisie* par champ + focus · *coordonnée détectée*
`application.errors.contactInText`, **non bloquant** (`11` RG51) · *plafond atteint*
`application.quota.reached`, qui **explique ce qui libère une place** et ne propose jamais de payer
· *succès* `application.status.sent` avec la date et le délai annoncé.

### 5.7 C8 — Mes candidatures : les huit états

```
Mobile 375
┌───────────────────────────────────────────┐
│ Mes candidatures                      h1  │
│ 3 actives sur 10 ▓▓▓░░░░░░░               │
│ [ Actives | Terminées ]                   │
│ ┌───────────────────────────────────────┐ │
│ │ Rentrée beauté 2026 · Marque Alpha    │ │
│ │ [i:clock] Envoyée le 12 mars — en     │ │  états 2 ET 3 : MÊME
│ │ cours d'examen par INFLUX. Réponse    │ │  LIBELLÉ (11 RG72)
│ │ sous 1 jour ouvré.                    │ │
│ │ [◦ Retirer ma candidature]            │ │
│ ├───────────────────────────────────────┤ │
│ │ Test UGC crème · Marque Bêta          │ │
│ │ [i:check] Validée par INFLUX et       │ │  état 4
│ │ transmise à la marque le 10 mars.     │ │
│ ├───────────────────────────────────────┤ │
│ │ Noël 2025 · Marque Gamma              │ │
│ │ [i:handshake] Mise en relation        │ │  état 5
│ │ ouverte — MER-2026-000123             │ │
│ │ [■ Ouvrir la conversation]            │ │
│ ├───────────────────────────────────────┤ │
│ │ Été 2026 · Marque Delta               │ │
│ │ [i:x] INFLUX n'a pas transmis cette   │ │  état 6 — motif typé,
│ │ candidature : {motif}                 │ │  attribué à INFLUX,
│ │ [□ Candidater à nouveau]  (si le      │ │  JAMAIS à la marque
│ │ motif est corrigible — RG67)          │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

| # | État | Libellé imposé (`11` RG71) | Clé |
|---|---|---|---|
| 1 | Brouillon | « Brouillon enregistré » | — |
| 2 | Envoyée | « Envoyée le {date} — en cours d'examen par INFLUX, réponse sous 1 jour ouvré » | `application.status.sent` |
| 3 | En cours d'examen | **Le même libellé que l'état 2** | idem |
| 4 | Validée, transmise | « Validée par INFLUX et transmise à la marque le {date} » | `application.status.forwarded` |
| 5 | Mise en relation ouverte | « Mise en relation ouverte — référence MER-… » | `intro.status.opened` |
| 6 | Refusée par INFLUX | « INFLUX n'a pas transmis cette candidature : {motif} » | `application.status.rejected` |
| 7 | Retirée | « Vous avez retiré cette candidature le … » | — |
| 8 | Clôturée sans suite | « Cette candidature est clôturée : {cause neutre} » | `application.status.closed` |

**Le point de conception le plus important de cet écran :** dans les états 6 et 8, **aucun libellé
n'attribue la décision à la marque**. Un créateur ne doit jamais lire un refus comme un rejet par
une marque (`11` RG77, RG78) : il ne saura jamais qu'une marque n'a pas répondu. Aucune formulation
du type « la marque n'a pas donné suite » n'est autorisée dans cet écran.

**Dépassement du délai :** `application.status.late`, à l'écran uniquement.

**États :** *chargement* squelettes · *vide* « Aucune candidature. Parcourez les campagnes
ouvertes. » + bouton · *erreur* bandeau + réessayer · *plafond* bandeau en tête, avec ce qui libère
une place · *succès* confirmation en ligne après un retrait, place libérée **immédiatement visible
dans le compteur** (`11` RG76).

### 5.8 C9 — Conversation, et les autres écrans créateur

La conversation est **identique à §4.7** : même en-tête, même bandeau de supervision, même
détection avant envoi, même interdiction de pièce jointe. Deux différences de contenu :

| | Côté marque | Côté créateur |
|---|---|---|
| Nom de l'autre partie | Le **pseudo principal révélé** (`12` RG5) | Le **nom commercial**, puis prénom et fonction de l'interlocuteur révélé |
| Fiche de l'autre partie | Profil créateur, couches A + I | Profil marque + bloc interlocuteur révélé — **prénom et fonction seulement, jamais d'e-mail ni de téléphone** (D46) —, précédé de `brandProfile.contact.revealNotice` (`06` RG42) |

Le bloc interlocuteur révélé est accompagné de sa mention fixe et **chaque consultation est
journalisée** (`06` RG41) — le créateur n'en est pas informé écran par écran, mais la politique de
confidentialité le couvre.

| Autre écran | Contenu | Règles |
|---|---|---|
| Invitations reçues | Les mises en relation à l'état 3 : proposition INFLUX ou demande de marque validée. Une carte, une action : `[■ Examiner]` → §7.2 | `13` RG66, RG100 |
| Mon profil vu par une marque | Prévisualisation de la **carte anonyme réelle** servie par l'API, pas une reconstitution | Symétrique de `09` RG102 ; **manque dans `07`**, voir §10 |
| Preuves déposées | Liste des pièces, état, motif de refus, rappel que les pièces ne sont **jamais** visibles d'une marque | `07` RG54, `08` §I |
| Contester un badge retiré ou une demande refusée | Formulaire de contestation (C3) : motif fermé, texte de 1 000 caractères au plus, **aucune pièce jointe** (une preuve neuve passe par une nouvelle demande) ; dans la fenêtre de `dispute_window_days` (30) ; une par décision | `08` §H, RG77 |

---

## 6. Écrans transverses

Ces écrans existent dans les deux espaces, sous « Mon compte ». Leur **structure** est commune ;
leur **vocabulaire** suit le rôle (« votre entreprise » / « votre profil de créateur »).

**§6.0 Page-menu « Mon compte »** *(D74, 2026-10-29)* : `/fr/compte` · `/en/account`, page du lien
« Compte » ; une ligne par page (icône, libellé, phrase, chevron), dans l'ordre T1, T2, T4, T3 ;
exemptée des CGU (liens seuls). Gabarit, microcopies et tests : `archives/jalons/sn-fiche.md`.

### 6.1 T1 — Mes informations

Les champs du Lot 1, modifiables : adresse e-mail, pays, langue, statut déclaré (créateur), nom
d'entreprise (marque). Deux règles d'écran :

- Toute modification de pays, langue, statut ou nom d'entreprise **émet un `lead.updated`**
  (`05` RG15, RG73) : l'écran ne le dit pas en jargon, mais la mention d'information de la
  politique de confidentialité est accessible depuis la page.
- Le **changement d'adresse e-mail** est un parcours à part (`05` RG58) : re-authentification par
  code, puis confirmation **depuis l'ancienne et la nouvelle adresse**, dans un délai de 24 heures.
  L'écran affiche un état d'attente explicite (« En attente de confirmation : 1 sur 2 · expire le
  {date} ») et rappelle que **l'adresse de connexion reste l'ancienne** tant que les deux n'ont pas
  répondu.

### 6.2 T2 — Mes préférences de communication

```
┌───────────────────────────────────────────────────────────┐
│ Mes préférences de communication                     h1   │
│                                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ E-mails commerciaux et prospection                    │ │
│ │ État : accordé                                        │ │  RG95 — valeur,
│ │ Le 12 janvier 2026, par vous, à l'inscription.        │ │  date ET origine
│ │                                                       │ │  en clair
│ │ [□ Retirer mon consentement]                          │ │  UNE action, sans
│ │ Effet immédiat. Aucune justification demandée.        │ │  justification — RG34
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ [i:info] Ce que le retrait ne change pas              │ │  RG35, RG94
│ │ • Votre code de connexion continue d'arriver.         │ │
│ │ • Les messages liés à vos mises en relation aussi.    │ │
│ │ • Votre compte et vos accès sont inchangés.           │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

Les trois origines possibles sont affichées **en toutes lettres** (`05` RG95) : « par vous, à
l'inscription » · « par vous, depuis votre espace » · « par un lien de désinscription dans un
e-mail ». Une désinscription revenue de Brevo n'est **jamais** présentée comme une erreur
(`05` RG96), et la valeur affichée est celle de Brevo, qui fait foi (`05` RG90).

### 6.3 T3 — Mes données : export, suppression, et **ce qui survit**

L'écran le plus délicat du §6, parce qu'il doit dire une vérité désagréable sans la cacher.

```
Mobile 375
┌───────────────────────────────────────────┐
│ Mes données                           h1  │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ Exporter mes données                  │ │
│ │ Vous recevez un fichier lisible avec  │ │
│ │ les données que nous détenons sur     │ │
│ │ vous.                                 │ │
│ │ [□ Exporter]  → code de vérification  │ │  RG57 — re-authentification
│ └───────────────────────────────────────┘ │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ Supprimer mon compte                  │ │
│ │ [× Supprimer mon compte]              │ │  destructif : libellé
│ └───────────────────────────────────────┘ │  explicite, jamais une icône
└───────────────────────────────────────────┘

Écran de confirmation de suppression — en deux temps, jamais en un clic
┌───────────────────────────────────────────────────────────┐
│ Supprimer votre compte INFLUX                             │
│                                                           │
│ CE QUI DISPARAÎT                                          │
│ • Votre profil et tout son contenu (textes, visuels,      │
│   chiffres, pièces déposées).                             │
│ • Vos candidatures et vos sélections en cours.            │
│ • Votre contact chez Brevo et chez Apollo.io : la         │
│   suppression leur est transmise en priorité.   05 RG73   │
│ • Votre accès : vous ne pourrez plus vous connecter.      │
│                                                           │
│ CE QUI EST CONSERVÉ, ET POURQUOI                          │
│ • Les **conversations** dont vous étiez participant       │
│   restent lisibles de l'autre partie et d'INFLUX : elles  │
│   ne vous appartiennent pas seul.        12 RG109         │
│ • La **trace des mises en relation** ouvertes             │
│   (référence, dates, versions de CGU acceptées), sous     │
│   une forme qui ne vous nomme plus.      05 RG70, 01 M4   │
│ • Les **e-mails déjà envoyés** : ils sont sortis de nos   │
│   systèmes et nous ne pouvons pas les rappeler.  13 RG78  │
│ • Les écritures du **journal d'activité**, qui ne         │
│   peuvent pas être modifiées.                             │
│ Durées de conservation : voir la politique de             │
│ confidentialité.  [◦ Lire]                                │
│                                                           │
│ Une nouvelle inscription avec la même adresse créera un   │
│ compte entièrement nouveau, sans lien avec celui-ci.      │
│                                                  05 RG70  │
│                                                           │
│ Tapez SUPPRIMER pour confirmer  [            ]            │
│ [□ Annuler]              [× Supprimer définitivement]     │
│                          → puis code de vérification      │
└───────────────────────────────────────────────────────────┘
```

| Décision | Justification |
|---|---|
| Les deux listes sont **côte à côte, de même poids typographique** | Cacher « ce qui est conservé » dans un lien serait exactement le « coût découvert en fin de parcours » interdit par `CLAUDE.md` §2 |
| Le vocabulaire évite « preuve légale », « valeur probante », « horodatage certifié » | Interdits par `12` RG105 et `01` M4. On écrit « journal d'activité », « historique de la mise en relation » |
| Re-authentification par code | Exigée pour export, suppression et changement d'adresse (`05` RG57) |
| Confirmation par saisie d'un mot | Un bouton rouge seul se clique par réflexe ; taper un mot exige une intention |
| **Zone de danger** (D72, D72 §3 et §5) | La suppression est la **dernière section** de « Mes données » : h2 « Zone de danger » (icône + mot), encadré sans remplissage (fond du conteneur, bordure rouge 1 px, icône triangle, texte rouge opaque, phrase en gras), avertissement « Téléchargez d'abord votre export » si un export existe, **bouton rouge plein** en pilule. L'écran de confirmation reprend le même encadré (il remplace l'ancien encadré « rien n'est supprimé automatiquement ») et son bouton est rouge plein. Après le code : écran final sans navigation de compte, « Votre compte est supprimé », `role="status"`, lien vers l'accueil |
| Une mise en relation ouverte n'empêche pas la suppression | Mais l'écran l'annonce : « 1 conversation ouverte sera close et l'autre partie en sera informée » (message système `party.account_deleted`, `12` RG14) |

> **À valider par `expert-conformite-rgpd`** (§9) : la formulation exacte des deux listes, les
> durées à afficher, et le sort d'une conversation en cours. `12` RG109 renvoie à `01` ; les durées
> ne sont pas fixées dans ce document et ne doivent pas l'être par l'interface.

### 6.4 T4 — Mes sessions

Liste des sessions actives : date de création, dernière activité, **pays approximatif**, navigateur
(`05` RG56). *(J3, 2026-09-27 : **pas de colonne pays au MVP**, EC-43 ; texte d'aide
`account.sessions.help` — `05` RG143.)* Un bouton `[× Fermer toutes les sessions]`, qui déconnecte aussi l'appareil courant et
le dit avant. La session courante est marquée « cet appareil ».

L'e-mail de connexion depuis un appareil inconnu (`05` RG55) renvoie vers cet écran : c'est le seul
geste de reprise en main disponible sans mot de passe.

### 6.5 T5 — Notifications

**Il n'existe aucun centre de notifications au MVP** : ni historique, ni préférences par type. La
cloche de l'en-tête agrège **uniquement** ce qui attend une action, et mène aux écrans concernés.
Raison : chaque notification du produit est déjà portée par un écran d'état (candidatures, mises en
relation, conversations) ; un second inventaire divergerait du premier.

| Canal | Règle |
|---|---|
| E-mail transactionnel | Ne contient **jamais** le texte d'un message (`12` RG90), jamais de coordonnée de l'autre partie, jamais de pièce jointe (`13` RG112) |
| Cadence membre | Immédiat au premier message non lu, puis **au plus un rappel par 24 h** tant que le fil n'est pas ouvert ; l'ouverture réarme le cycle (`12` RG93, RG94) |
| Pas de réponse par e-mail | Les e-mails partent d'une adresse qui n'accepte pas de réponse, et le disent (`12` RG96) |
| Aucun autre canal | Ni SMS, ni notification poussée, ni messagerie tierce (`12` RG100) |
| Marketing | Strictement séparé du transactionnel ; le retrait de consentement ne coupe jamais un code de connexion (`05` RG35) |

### 6.6 T6 — Aide

Une page unique, par rôle, sans formulaire de contact générique : **le seul canal de contact sans
connexion est celui de `05` RG65** (impossibilité de recevoir un code), et il ne met jamais deux
membres en relation. Contenu : comment fonctionne la mise en relation, ce qu'affirme un badge, ce
que voit l'autre partie, comment sont calculés les montants affichés, comment exercer ses droits.

### 6.7 États d'erreur et hors ligne, valables partout

| Situation | Écran | Règle |
|---|---|---|
| **Hors ligne** | Bandeau non bloquant en tête : « Vous êtes hors ligne. Vos modifications seront enregistrées à la reconnexion. » Les actions d'envoi affichent une explication écrite, jamais un bouton muet | Les brouillons locaux survivent (`06` RG83, `07` RG111, `11` RG52) |
| **Erreur serveur (5xx)** | « Nous ne parvenons pas à … pour le moment. Vos réponses sont conservées : réessayez dans quelques minutes. » + `[■ Réessayer]`. **Jamais de trace technique** | `05` RG112 `signup.errors.unavailable`, `05` RG114 |
| **404 sur une ressource d'un autre membre** | Page « Cette page n'existe pas ou ne vous est pas accessible », **identique** dans les deux cas | `12` RG34, `09` RG100 : ne jamais révéler qu'une ressource existe |
| **Session expirée** | Retour à l'écran 1 avec la destination mémorisée, message « Votre session a expiré. Reconnectez-vous. » | `05` RG54 |
| **Compte suspendu en cours de session** | Session révoquée immédiatement, écran neutre `auth.suspended.notice` | `05` RG69 |
| **Nouvelle version de CGU** | Écran bloquant de ré-acceptation, avant toute page ; refuser déconnecte **sans supprimer le compte** | `05` RG28 |
| **Plafond de débit atteint** | Message nommant le plafond, ce qui le libère et quand ; jamais une page blanche ni une dégradation silencieuse | `10` RG64, `11` RG63, `12` RG40 |
| **Mouvement réduit** | Toutes les durées passent à `duration-instant` ; aucune animation de compteur, aucun défilement automatique | tokens.css, `prefers-reduced-motion` |
| **Zoom 200 % / 320 px** | Aucun défilement horizontal ; les montants sont insécables ; les libellés de boutons passent sur deux lignes plutôt que d'être tronqués | `02` §2.8 |

---

## 7. Les deux écrans qui portent la valeur et le risque

### 7.1 La carte créateur anonyme

**Le problème à résoudre en une phrase :** faire naître l'envie de demander une mise en relation
**sans montrer personne**. Une carte anonyme ratée produit soit une fuite d'identité, soit une
place de marché que personne n'utilise. Les deux sont fatales.

**Ce qui remplace l'identité**, dans cet ordre de poids visuel :

1. **le visuel de portfolio modéré** — la seule preuve de savoir-faire disponible ;
2. **le titre court** — la promesse éditoriale, écrite par le créateur ;
3. **les badges datés** — ce qu'INFLUX a constaté, et quand ;
4. **la ligne « Proposé car »** — pourquoi ce profil est là, en faits vérifiables sur la carte ;
5. **le tarif en tranche** — la compatibilité économique, première cause d'échec en négociation.

```
Desktop — carte dans la grille (3 colonnes)      Mobile — carte pleine largeur
┌──────────────────────────────────┐   ┌───────────────────────────────────────┐
│ ▣ visuel de portfolio approuvé   │   │ ┌─────────┬───────────────────────────┐│
│   (4:5, 1 visuel sur la carte,   │   │ │▣ visuel │ Profil 7K3M               ││
│    3 sur la fiche — RG50)        │   │ │  (4:5)  │ Beauté · France           ││
├──────────────────────────────────┤   │ │  w-1/3  │ ✓ Audience vérifiée       ││
│ Profil 7K3M                 (h3) │   │ │         │   Instagram, 12 mars      ││
│ Beauté · France                  │   │ └─────────┴───────────────────────────┘│
│                          RG24    │   │ « Créatrice beauté clean, tutoriels   ││
│ ✓ Audience vérifiée — Instagram, │   │   courts et tests de produits »       ││
│   le 12 mars 2026        [i:info]│   │ ───────────────────────────────────── ││
│ ✓ Compte vérifié — TikTok,       │   │ Instagram  25 k – 100 k   principal   ││
│   le 3 mars 2026                 │   │ TikTok     10 k – 25 k                ││
│ ─────────────────────────────────│   │ Plus de 70 % d'audience en France     ││
│ « Créatrice beauté clean,        │   │ 25-34 ans majoritaires · mixte        ││
│   tutoriels courts et tests »    │   │ Engagement 3-5 % (constaté 12 mars)   ││
│                          h3+body │   │ FR, EN · Story, Reel                  ││
│ ─────────────────────────────────│   │ ───────────────────────────────────── ││
│ Instagram  25 k – 100 k principal│   │ Story Instagram   500 – 1 000 EUR     ││
│ TikTok     10 k – 25 k           │   │ Reel Instagram  1 000 – 2 000 EUR     ││
│ Plus de 70 % d'audience en France│   │ coût total pour vous                  ││
│ 25-34 ans · audience mixte       │   │ Droits inclus : organique · Option :  ││
│ Engagement 3-5 %                 │   │ paid ads · Exclusivité : 1 mois       ││
│   constaté le 12 mars            │   │ Livraison 7-14 j · Dispo < 2 semaines ││
│ FR, EN · Story, Reel             │   │   déclarée le 10 mars                 ││
│ ─────────────────────────────────│   │ Chiffres mis à jour le 12 mars        ││
│ Story Instagram   500 – 1 000 EUR│   │ ───────────────────────────────────── ││
│ Reel Instagram  1 000 – 2 000 EUR│   │ Proposé car : thématique beauté       ││
│ coût total pour vous             │   │ correspondante · plus de 70 %         ││
│ Droits inclus : organique        │   │ d'audience en France · fourchette     ││
│ En option : paid ads             │   │ tarifaire compatible avec votre       ││
│ Exclusivité acceptée : 1 mois    │   │ budget indicatif · audience vérifiée  ││
│ Livraison 7-14 j                 │   │ le 12 mars 2026.               RG41   ││
│ Dispo < 2 semaines, décl. 10 mars│   │ [i:alert] Point de vigilance :        ││
│ Chiffres mis à jour le 12 mars   │   │ profil récent.                 RG42   ││
│ ─────────────────────────────────│   │ ───────────────────────────────────── ││
│ Proposé car : thématique beauté  │   │ [□ Ajouter à ma sélection]            ││
│ correspondante · plus de 70 %    │   │ [■ Demander une mise en relation]     ││
│ d'audience en France · …   RG41  │   │ Un commercial INFLUX valide votre     ││
│ [i:alert] Profil récent.   RG42  │   │ demande et vous met en relation. RG52 ││
│ ─────────────────────────────────│   └───────────────────────────────────────┘│
│ [□ Ajouter à ma sélection]       │
│ [■ Demander une mise en relation]│
│ Un commercial INFLUX valide      │
│ votre demande et vous met en     │
│ relation.                  RG52  │
└──────────────────────────────────┘
```

**Les neuf règles de conception de cette carte** *(la neuvième ajoutée le 2026-09-25, D61)*

| # | Règle | Source |
|---|---|---|
| 1 | **Aucun champ de la liste fermée de `10` RG48**, ni à l'écran, ni dans la réponse d'API, **pas même vide ni nul** | `10` RG48, `07` RG18 |
| 2 | **Aucune photo, aucun avatar, aucune initiale, aucune couleur dérivée du nom** — une pastille colorée stable serait un identifiant visuel | `07` RG29 |
| 3 | **Chaque chiffre porte sa source et sa date**, sans exception. Un chiffre sans date n'est pas affiché | `07` RG49, `08` RG4 |
| 4 | **Uniquement des tranches.** Une explication ne contient jamais un pourcentage exact : « 72 % » s'écrit « plus de 70 % » | `07` RG58, `10` RG41 règle 4 |
| 5 | **Le taux d'engagement n'apparaît que s'il a été constaté.** Non vérifié, il est **absent** — pas affiché avec une réserve | `07` RG48 |
| 6 | **La fiche n'est pas plus riche que la carte** : mêmes champs, en plus grand, 3 visuels au lieu de 1 | `10` RG50 |
| 7 | **Deux actions, et deux seulement.** Pas de « voir plus tard », pas de « ne plus proposer », pas de partage | `10` RG51, RG56 |
| 8 | **Le point de vigilance est affiché quand il est vrai**, même s'il dessert le profil. Une liste sans réserve est lue comme une liste vendue | `10` RG42 |
| 9 | **Les trois métriques prioritaires ouvrent chaque ligne de réseau**, toujours dans cet ordre : taille de la communauté, rythme de publication, commentaires moyens — par exemple « Instagram · 25 k – 100 k · plusieurs fois par semaine · 50 à 199 commentaires par publication ». L'engagement et la portée viennent après. *La maquette ci-dessus est antérieure à D61 : ses lignes de réseau sont à redessiner par `expert-ux`* | `07` RG113, `10` RG47, D61 |

**Hiérarchie visuelle.** Le visuel occupe le haut (desktop) ou le tiers gauche (mobile) ; l'alias
est en `text-heading-3` ; le titre court en `text-md` ; les tranches et libellés en `text-sm`
`color-text-secondary` ; les dates et sources en `text-xs` `color-text-tertiary` ; les montants en
`text-amount-md` (token proposé, §8) avec `font-variant-numeric-amount`. La ligne « Proposé car »
est sur `color-surface-raised`, séparée par un filet : c'est une **affirmation d'INFLUX**, pas une
déclaration du créateur, et cette différence doit se voir.

**Accessibilité.** La carte est un `<li>` contenant un `<article aria-labelledby>` ; **la carte
entière n'est pas un lien** (deux actions distinctes cohabitent). Les badges sont du texte, pas des
images. L'ordre du DOM suit l'ordre visuel. Le visuel porte `alt=""` (décoratif : sa légende
modérée, quand elle existe, est un texte adjacent). Contrastes : `color-text-brand-strong` sur
`color-brand-subtle-bg` pour le badge = **12,0:1** (calcul en §8.3) ; le couple le plus bas de la
carte est `color-text-tertiary` sur `color-surface-card` = **5,2:1**, au-dessus du seuil AA.

**États de la carte :** *chargement* squelette au ratio exact du visuel, aucun décalage · *sans
visuel approuvé* la carte s'affiche **sans image**, le titre remonte, la grille ne casse pas
(`07` cas limite 1) · *déjà demandé* bouton inactif + `search.action.requestSent` · *déjà en
relation* `search.state.alreadyIntroduced` + `search.action.openConversation` · *tarif dans une
autre devise* mention `search.warning.otherCurrency` et **aucune comparaison de montant** ·
*chiffres périmés* mention `search.warning.staleFigures`, profil rétrogradé dans le tri mais
**jamais masqué** (`10` RG39).

### 7.2 L'écran d'acceptation et de révélation d'identité

**Le moment le plus sensible du produit.** Un seul écran, servi aux deux populations, avec trois
variantes de bandeau selon l'origine (`13` RG66). Il n'y a **pas** d'écran par déclencheur.

```
Mobile 375 — écran plein, pas une modale : on n'accepte pas dans une fenêtre
┌───────────────────────────────────────────┐
│ [◁ Retour]                                │
├───────────────────────────────────────────┤
│ ┌───────────────────────────────────────┐ │
│ │ INFLUX vous propose cette campagne.   │ │  ① bandeau selon l'origine
│ │                              13 RG66  │ │  (3 variantes)
│ └───────────────────────────────────────┘ │
│                                           │
│ Mise en relation MER-2026-000123     h1   │  ② la référence, en premier
│ Proposée par Thomas — INFLUX              │  ③ un humain NOMMÉ
│                                           │
│ ── LA CAMPAGNE ──────────────────────────  │  ④
│ Rentrée beauté 2026 · Marque Alpha        │
│ 2 stories + 1 reel Instagram              │
│ Période : 1er – 30 avril 2026             │
│ ┌───────────────────────────────────────┐ │
│ │ La marque paie au total               │ │  côté créateur seulement :
│ │ 1 000 – 2 000 EUR                     │ │  net en TRANCHE
│ │ Commission INFLUX 20 % marque,        │ │  13 RG69 #3
│ │ 15 % vous                             │ │
│ │ Vous percevriez ≈ 650 – 1 300 EUR     │ │
│ └───────────────────────────────────────┘ │
│ Estimation indicative… (mention fixe)     │
│                                           │
│ ── QUI VOUS EST PROPOSÉ ─────────────────  │  ⑤ état de visibilité du
│ Marque Alpha · Beauté · 11-50 salariés    │  moment : identifiée sans
│ France · exemple.com                      │  coordonnées côté créateur ;
│ ✓ Marque vérifiée le 3 mars 2026          │  ANONYME côté marque
│ Interlocuteur : partenariats et influence │  13 RG71 : aucune coordonnée,
│ (coordonnées communiquées à l'ouverture)  │  ni à l'écran ni dans l'API
│                                           │
│ ── POURQUOI VOUS ────────────────────────  │  ⑥ le motif ÉCRIT
│ « Votre audience française et vos tests   │
│ de produits correspondent au brief. »     │
│ — Thomas, INFLUX                          │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ SI VOUS ACCEPTEZ                      │ │  ⑦ trois phrases, 13 RG69 #6
│ │ • Votre identité et les informations  │ │
│ │   de votre profil seront montrées à   │ │
│ │   la marque AU MÊME INSTANT que les   │ │
│ │   siennes vous seront montrées.       │ │
│ │ • Une conversation s'ouvre avec       │ │  intro.accept.ifAccepted
│ │   Thomas, d'INFLUX.                   │ │
│ │ • Nous vous envoyons à tous les deux  │ │
│ │   une confirmation par e-mail.        │ │
│ ├───────────────────────────────────────┤ │
│ │ SI VOUS REFUSEZ                       │ │  ⑧ intro.accept.ifDeclined
│ │ Rien n'est communiqué. La marque      │ │
│ │ n'apprend pas votre motif. Vous       │ │
│ │ pourrez être sollicité sur une autre  │ │
│ │ campagne.                             │ │
│ ├───────────────────────────────────────┤ │
│ │ SI VOUS NE RÉPONDEZ PAS               │ │  ⑨ intro.accept.ifNoAnswer
│ │ Nous vous relancerons. Sans réponse   │ │
│ │ avant le 19 mars, cette mise en       │ │
│ │ relation sera clôturée et rien ne     │ │
│ │ sera communiqué.                      │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ [i:eye] Cette conversation sera       │ │  supervision ANNONCÉE ICI,
│ │ suivie par INFLUX : un commercial y   │ │  pas seulement dans le fil
│ │ participe en permanence, un autre     │ │  12 RG102, RG103
│ │ agent peut la lire, et chaque lecture │ │
│ │ est horodatée et attribuée.           │ │
│ │ [◦ En savoir plus]                    │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ [ ] J'accepte cette mise en relation.     │  ⑩ case NON PRÉ-COCHÉE,
│     Mon identité et les informations de   │  libellé IMPOSÉ 13 RG70
│     mon profil seront communiquées à      │
│     l'autre partie au moment où les       │
│     siennes me seront communiquées. J'ai  │
│     pris connaissance des conditions      │
│     générales d'utilisation (version 3    │
│     du 2 mars 2026), dont la clause de    │
│     non-contournement.                    │
│     [◦ Lire les CGU]  [◦ Résumé de la     │  ⑪ résumé en langage
│      clause en langage courant]           │  courant — 13 RG69 #10
│                                           │
│ [■ Accepter]     ← inactif tant que la    │  ⑫ refus AUSSI VISIBLE
│ [□ Refuser]         case n'est pas cochée │  que l'acceptation
└───────────────────────────────────────────┘

Desktop : une seule colonne container-narrow, même ordre. PAS de colonne de droite :
un écran d'engagement se lit de haut en bas, et le bouton d'acceptation ne doit jamais
être atteignable avant d'avoir croisé les blocs ⑦ ⑧ ⑨ ⑩.
```

**Les onze points obligatoires de `13` RG69 sont tous présents, dans l'ordre exact de la règle.**
La numérotation du schéma le rend vérifiable en revue.

| Décision de conception | Justification |
|---|---|
| **Écran plein, jamais une modale** | Une modale se ferme par inadvertance et se lit mal sur mobile. C'est un acte, pas une confirmation |
| **Le refus est un bouton, pas un lien discret** | `13` RG69 #11 : « un refus difficile à trouver est un consentement extorqué » |
| **Le bouton d'acceptation est inactif tant que la case n'est pas cochée**, et le contrôle est **refait côté serveur** | `13` RG70. L'état inactif est **expliqué à côté du bouton** : « Cochez la case ci-dessus pour accepter » |
| **La supervision est annoncée sur cet écran**, pas seulement dans le fil | `12` RG102 : cinq endroits, dont l'écran d'information. L'annoncer après acceptation serait une supervision découverte |
| **Aucune coordonnée**, ni à l'écran ni dans la réponse d'API | `13` RG71. C'est un point de test, pas une intention |
| Le **motif écrit** est cité tel quel, attribué à son auteur | `13` RG69 #5 : c'est ce qui distingue un rapprochement d'un envoi de masse |
| Le net créateur en tranche n'apparaît **que côté créateur** | `13` RG69 #3, `09` RG61 |
| Ré-acceptation si la version de CGU a changé | `13` RG68 : l'initiateur revoit le même écran, avant toute révélation |

**Les quatre états de cet écran, et le cinquième qui n'existe pas**

| État | Écran |
|---|---|
| **Invitation en attente** | L'écran ci-dessus. Compte à rebours en texte : « Réponse attendue avant le 19 mars » |
| **J'ai accepté, l'autre pas encore** | L'écran est remplacé par `intro.status.waitingOther` : « Vous avez accepté le {date}. Nous attendons la réponse de l'autre partie. » **Il n'indique jamais** qui est l'autre partie, si elle a ouvert l'invitation, ni si elle hésite (`13` RG73) |
| **Révélation** (la seconde acceptation) | Transition immédiate vers un écran de succès : référence, identités désormais visibles des deux côtés, `[■ Ouvrir la conversation]`, et la mention que **deux e-mails de confirmation ont été envoyés** (`13` RG74, RG78). Le focus est porté sur le titre de l'écran de succès |
| **Refus** | Écran de confirmation sobre : « C'est noté. L'autre partie n'apprendra pas votre motif. » Motif choisi dans une liste fermée, dont `intro.decline.preExisting` (`13` RG88) |
| ~~Annulation après acceptation~~ | **N'existe pas.** La révélation est irréversible (`13` RG75). Aucun écran ne propose de « dé-révéler » : la seule sortie est la clôture de la conversation, avec un motif |

**Autres états :** *chargement* squelette **sans** la case à cocher (elle n'apparaît qu'avec le
texte de CGU réellement chargé — on ne coche pas une case dont le texte n'est pas là) · *erreur à
l'acceptation* message dans l'écran, case conservée cochée, `[■ Réessayer]` ; **en aucun cas un
état partiel**, la révélation est tout ou rien (`13` RG74) · *invitation expirée* « Cette mise en
relation a été clôturée le {date}. Rien n'a été communiqué. » · *accès refusé* 404 neutre ·
*e-mail de confirmation non parti* **rien n'est affiché au membre** : c'est une alerte backoffice
(`13` RG80), pas une inquiétude à transférer à l'utilisateur.

**Accessibilité.** Un seul `h1` ; les blocs ⑦ ⑧ ⑨ sont une `<dl>` ou trois `<section>` titrées en
`h2`, jamais un paragraphe unique ; la case à cocher a une zone cliquable couvrant tout son libellé
(long : plus de 300 caractères) et son état est annoncé ; le bouton inactif porte
`aria-disabled="true"` **et** un texte d'explication relié par `aria-describedby` — jamais un
`disabled` muet ; la mention de supervision est dans le flux de lecture, pas dans une infobulle.

### 7.3 La règle d'affichage des montants, applicable partout

| Destinataire | Ce qui s'affiche | Ce qui ne s'affiche jamais |
|---|---|---|
| **Marque** | Le **coût total** qu'elle paie, avec sa devise, et la mention indicative applicable | Le net créateur, sous aucune forme, en aucun écran, dans aucune réponse (`06` RG32, `09` RG61, `11` RG59) |
| **Créateur** | **Trois notions dans un seul bloc, dans cet ordre** : ce que la marque paie au total → commission INFLUX (20 % marque, 15 % vous) → ce que vous percevez, estimation. Toujours avec la devise | Un net sans son coût total, un pourcentage isolé, un montant sans devise |

**Forme imposée du bloc à trois notions :**

```
┌─────────────────────────────────────────────┐
│ CE QUE LA MARQUE PAIE AU TOTAL              │  libellé en text-xs, majuscules
│ 1 000 – 2 000 EUR                           │  valeur en text-amount-md,
│ ─────────────────────────────────────────── │  tabular-nums, filet séparateur
│ COMMISSION INFLUX                           │  data-advertiser-share /
│ 20 % à la charge de la marque,              │  data-creator-share : pastilles
│ 15 % à votre charge                         │  de rappel, jamais seules
│ ─────────────────────────────────────────── │  porteuses de l'information
│ CE QUE VOUS PERCEVEZ, ESTIMATION            │
│ ≈ 650 – 1 300 EUR                           │  data-net-creator
└─────────────────────────────────────────────┘
Mention fixe, immédiatement dessous, jamais repliée.
```

- **Format localisé** : `1 000,00 €` / `€1,000.00`, `35 %` / `35%`, via next-intl. Jamais de
  concaténation, jamais de symbole codé en dur (`CLAUDE.md` §4).
- **Insécable** : montant et devise ne se séparent jamais en fin de ligne.
- **Le mot « environ »** accompagne tout net issu d'une tranche (`09` RG60, `11` RG57).
- **Jamais « HT » ni « TTC »** tant que D7 est ouverte (`07` RG71, `09` RG67).
- **Aucun taux n'est écrit en dur dans un composant** : « 35 % », « 20 % », « 15 % » sont des
  valeurs de **clés de traduction**, au même titre que le reste de la phrase (§10, E4).

---

## 8. Tokens

> **Charte KEO Emerald (D73, 2026-10-28).** Les espaces membres, le parcours d'inscription et de
> connexion et le texte des CGU affiché dans le parcours suivent la charte KEO Emerald, activée par
> l'attribut `data-theme="keo"` de `app/[locale]/(member)/layout.tsx` (`02` §21.3) ; les pages légales
> publiques restent en vitrine (`20` §11.1). Les **noms** de ce §8 restent
> valables ; les **valeurs** et les **contrastes** sont ceux de `20` §11.3 et §11.4, qui remplacent
> les chiffres D6 cités ici. Jetons ajoutés par D73 : `20` §11.3 et §11.5.

### 8.1 Tokens existants utilisés, par famille

| Famille | Tokens employés dans ce document |
|---|---|
| Surfaces | `color-surface-page`, `-muted`, `-card`, `-raised`, `-hover`, `-brand-subtle` |
| Texte | `color-text-primary`, `-secondary`, `-tertiary`, `-brand`, `-brand-strong`, `-on-action`, `-disabled` |
| Actions | `color-action-primary-bg` (+ `-hover`, `-active`), `color-action-secondary-bg` (+ `-hover`, `-active`), `color-action-secondary-border`, `color-action-disabled-bg` |
| Bordures | `color-border-subtle`, `-default`, `-strong`, `-selected`, `-error` |
| Sémantique | `color-feedback-success-*`, `-warning-*`, `-error-*`, `-info-*` (les quatre familles complètes : texte, fond, bordure, icône) |
| Données financières | `color-data-advertiser-share`, `color-data-creator-share`, `color-data-net-creator` — **créés pour la landing (`02` §2.9), réemployés ici pour le bloc à trois notions**, exactement dans le rôle prévu |
| Marque | `color-brand-primary`, `-accent`, `-subtle-bg`, `-subtle-border` |
| Focus | `color-focus-ring`, `focus-ring-width`, `focus-ring-offset` |
| Typographie | `text-xs`, `-sm`, `-md`, `-lead`, `-heading-3`, `-heading-2`, `text-amount-lg`, poids `regular` → `bold`, `leading-*`, `tracking-*`, `font-variant-numeric-amount`. *Depuis D73* : `font-display` (Manrope) et `font-base` (Source Sans 3), `text-title-page`, `text-title-section`, `text-amount-md`, `font-weight-action` ; les tailles fluides (`-lead`, `-heading-*`, `text-amount-lg`) restent à la vitrine (`20` §11.5) |
| Espacement | `spacing-1` à `spacing-9`, `spacing-stack-sm/md/lg`, `spacing-inset-card`, `spacing-inset-button-x/y`, `spacing-grid-gap`, `spacing-page-gutter` |
| Formes | `radius-sm`, `-md`, `-lg`, `-pill`, `shadow-sm`, `-md`, `-lg`. *Depuis D73* : `radius-card` (cartes, dialogues), `border-width-action-secondary` ; cartes plates, `shadow-lg` réservé aux dialogues et menus |
| Tailles | `size-touch-target`, `size-button-md/lg`, `size-input`, `size-checkbox`, `size-icon-sm/md/lg` |
| Structure | `header-height`, `sticky-top-offset`, `container-max`, `container-narrow`, `measure-text`, `z-base/raised/header/overlay`, `breakpoint-sm` → `2xl` |
| Mouvement | `duration-fast/base/slow`, `ease-standard`, `ease-exit` |

**Non employés, volontairement :** `background-image-metal-card`, `background-image-phone-metal`,
`--rotate-hero-*`, `--blur-hero-halo`, `color-mockup-banner-*`, `color-decorative-progress`. Ces
tokens appartiennent au registre **éditorial** de la landing. Un espace de travail consulté tous
les jours n'a pas besoin d'effets premium sur chaque carte : ils ralentissent la lecture et
alourdissent le rendu d'une grille de 12 cartes. *(Révisé le 2026-10-28, D73)* :
`background-image-halo-ambient` (vitrine) n'est plus employé non plus. *(Révisé le 2026-10-29, F6)* :
le fondateur garde un halo d'en-tête et l'ombre lumineuse du bouton principal, par des tokens de rôle
propres à KEO, l'agrandissement au survol et le soulèvement des cartes sous `motion-safe:`, et les
panneaux flottants là où ils sont pertinents (`20` §11.5 à §11.7, K8, K9).

**Tokens `*-inverse` :** aucune section claire pleine largeur (décision du fondateur du 2026-09-17).
Seuls `surface-inverse` et `text-inverse` servent, en accents de petite taille : pastille de compteur
(`color-counter-*`) et pastille de logo (`20` §10).

### 8.2 Tokens proposés

**Aucune nouvelle valeur de couleur n'est proposée.** Les onze tokens de couleur ci-dessous sont
des **alias** : ils nomment un rôle d'espace membre sur une valeur déjà arbitrée en D6, pour qu'un
composant ne référence jamais une couleur « par apparence ». Trois tokens de taille et un token de
typographie portent, eux, de nouvelles valeurs, sans effet sur les contrastes.

| Token proposé | Valeur | Rôle | Quand ne pas l'utiliser |
|---|---|---|---|
| `color-nav-item-active-bg` | = `color-surface-hover` | Fond de l'item de navigation actif | Survol simple (utiliser `color-surface-hover` directement) |
| `color-nav-item-active-indicator` | = `color-brand-primary` | Trait de 2 px de l'item actif | Seul porteur de l'état : toujours avec `aria-current` et la graisse |
| `color-progress-track` | = `color-surface-raised` | Rail de la barre de complétude | Barre de chargement indéterminée |
| `color-progress-fill` | = `color-brand-primary` | Remplissage de la complétude | Indicateur de succès ou d'erreur |
| `color-skeleton-base` | = `color-surface-raised` | Bloc de chargement | État vide (un squelette permanent est un défaut) |
| `color-skeleton-sheen` | = `color-surface-hover` | Balayage du squelette | Sans `prefers-reduced-motion`, le balayage est supprimé |
| `color-message-self-bg` | = `color-surface-raised` | Bulle « moi » | Message système |
| `color-message-other-bg` | = `color-surface-card` | Bulle de l'autre partie | Message d'agent |
| `color-message-agent-bg` | = `color-brand-subtle-bg` | Bulle du commercial INFLUX | Seul porteur du rôle : toujours avec la pastille « INFLUX » |
| `color-message-agent-border` | = `color-brand-subtle-border` | Bordure de la bulle d'agent | — |
| `color-detection-highlight-bg` | = `color-feedback-warning-bg` | Surlignage d'un passage détecté **dans son propre brouillon** | Un message déjà envoyé : rien n'est jamais surligné après coup |
| `text-amount-md` | **`1.125rem`** (nouvelle valeur) | Montant dans une carte ou un bloc de tranche | Montant de titre (`text-amount-lg`) ou montant en ligne de tableau (`text-sm`) |
| `size-nav-bottom-height` | **`3.5rem`** (nouvelle valeur) | Hauteur de la barre de navigation mobile | — |
| `size-logo-brand-sm` / `-md` | **`2.5rem` / `4rem`** (nouvelles valeurs) | Logo de marque en ligne de liste / en en-tête de campagne | Visuel de portfolio (ratio 4:5) |
| `z-nav-bottom` | **`90`** (nouvelle valeur, `:root`) | Barre de navigation mobile, **sous** `z-header` (100) | — |
| `size-member-rail` *(D73, nom de `02` §21.5)* | **`16rem`** (nouvelle valeur, `:root`) | Largeur de la colonne desktop (§2.3) | Rail du backoffice (`spacing-bo-rail-w`, `17b` §6.1) |
| `color-nav-item-hover-bg` *(D73)* | = `color-surface-raised` | Survol d'un item ou d'une sous-entrée de navigation | Item actif |
| `color-counter-bg` / `color-counter-text` *(D73)* | = `color-surface-inverse` / `color-text-inverse` | Pastille de compteur (barre du bas, colonne) | Statut ou alerte : la pastille compte, elle ne qualifie pas |
| `focus-ring-offset-inset` *(D73)* | `calc(-1 * var(--focus-ring-width))` (dérivé) | Anneau de focus intérieur des cellules de la barre du bas | Partout où l'anneau extérieur a la place |

**Justification de `text-amount-md`.** Le seul token de montant existant, `text-amount-lg`, est un
`clamp(1.75rem … 2.5rem)` conçu pour un chiffre clé de landing. Dans une carte de campagne ou dans
le bloc à trois notions, il écrase tout le reste et casse la grille à 375 px. `text-heading-3`
serait le repli naturel, mais il porte `tracking-heading` et une hauteur de ligne de titre, ce qui
désaligne les chiffres tabulaires. Une valeur fixe, non fluide, est ici volontaire : un montant ne
doit pas changer de taille entre deux points de rupture, sous peine de sembler changer de valeur.

**Justification de `size-nav-bottom-height`.** `size-touch-target` (2,75 rem) est la cible
minimale ; une barre à cette hauteur exacte ne laisse pas la place au libellé sous l'icône. 3,5 rem
donne une cible pleine hauteur **et** un libellé lisible, sans empiéter sur le contenu (qui reçoit
un `padding-bottom` égal à cette valeur plus `spacing-5`).

### 8.3 Contrastes calculés

*(Révisé le 2026-10-28, D73.)* Le tableau des valeurs D6 est remplacé par la matrice de `20` §11.4
(chaque couleur de texte sur page, carte, surélevée, survol et `surface-active`). Couples les plus bas
des espaces membres : `text-tertiary` sur `surface-hover` **4,79:1** et `feedback-error-text` sur
`surface-hover` **4,53:1** ; ni l'un ni l'autre ne se pose sur `surface-active` (4,13 et 3,91:1).

> **Conséquence, applicable partout.** Sur ce fond quasi noir, une élévation par la seule surface ne
> se voit pas (`surface-raised` sur `surface-page` : **1,16:1**). Toute carte, toute bulle et tout
> panneau porte donc **obligatoirement** une bordure `color-border-default` ou `-subtle` ; les
> dialogues et menus y ajoutent `shadow-lg`. Un composant qui distingue deux niveaux par la seule
> couleur de surface est refusé en revue.

**Le vert n'est jamais seul.** Récapitulatif des états portés par le vert dans ce document, et de
leur second porteur : item de navigation actif → `aria-current` + graisse ; sous-entrée de navigation
courante → `aria-current` + graisse + filet ; bulle d'agent → pastille « INFLUX » + nom + bordure ; complétude →
pourcentage écrit + liste nominative ; profil publié → le mot « Publié » + sa date. *Depuis D73, le
badge vérifié est bleu (`color-verified-text`, icône + texte + réseau + date, `20` §11.3) et le net
créateur est suspendu (D48).*

---

## 9. Écarts et manques constatés

### 9.1 Dans les spécifications fonctionnelles

Ces points sont apparus **en dessinant les écrans**. Ils ne sont pas tranchés ici : ils remontent à
`product-owner`.

| # | Constat | Document | Proposition |
|---|---|---|---|
| **S1** | **`09` RG102 donne à la marque une prévisualisation « ce que voit un créateur ». L'équivalent n'existe pas côté créateur.** Or c'est le créateur qui prend le risque d'anonymat : il devrait pouvoir voir sa **carte anonyme réelle**, telle que servie à une marque | `07`, `10` | Ajouter une règle symétrique à `07` : prévisualisation de la carte anonyme, servie par la **même** interface que la recherche, jamais reconstituée. Écran prévu au §5.8 |
| **S2** | **Le créateur ne sait pas ce que le commercial voit de lui.** `11` RG48 prévoit un rappel « ce que le commercial verra » sur le formulaire de candidature, mais aucune règle ne décrit la **vue commerciale identifiée** (`10` §H) du point de vue du créateur informé | `07`, `10` | Trancher : soit une mention permanente dans le profil (« l'équipe INFLUX voit votre profil en identité complète »), soit une clause de la politique de confidentialité. En l'état, le §5.2 affiche l'étiquette de couche N, qui le dit déjà — mais l'information de la personne mérite mieux qu'une étiquette de champ |
| **S3** | **`11` RG67 suppose un attribut « corrigible » sur les motifs de refus**, qui n'existe ni dans `11` RG92 ni dans les listes fermées de `06` RG66 et `09` RG90. Sans lui, l'écran « Candidater à nouveau » ne peut pas décider s'il affiche le bouton | `11` | Ajouter la colonne « corrigible (oui/non) » aux trois listes fermées de motifs. C'est un attribut de donnée, pas une règle d'écran |
| **S4** | **Aucune règle ne dit ce qu'un membre voit quand une conversation est archivée** (`12` RG23, RG111). « Lisible » suffit-il ? Apparaît-elle encore dans la liste ? Sous quel libellé ? | `12` | Proposition d'écran : onglet « Terminées », libellé « Archivée le {date} — lecture seule ». À confirmer |
| **S5** | **Le compteur de candidatures actives (`11` RG63) et le plafond P2 (5 par jour glissant) ne sont pas affichés au même endroit.** Un créateur bloqué par P2 alors que son compteur P1 indique « 3 sur 10 » lira une contradiction | `11` | Afficher les deux plafonds dans le même bloc, ou ne nommer que celui qui bloque, avec sa date de libération |
| **S6** | **`13` RG69 #8 annonce une clôture « au bout de 7 jours »**, et `11` RG78 fixe 7 jours **calendaires** pour une candidature validée non acceptée. L'écran d'acceptation affiche une **date** ; il faut donc que la date soit calculée et servie par l'API, pas recalculée par le front | `13` | Exposer `expires_at` dans la charge utile de l'invitation. Point d'implémentation, à confirmer par `product-owner` et `architecte` |
| **S7** | **Le libellé « MARQUE » / « CRÉATEUR » du rappel de porte (écran 1) n'a pas de clé définie** dans `05` RG112, alors que tous les autres messages du parcours y figurent | `05` | Ajouter `auth.step1.roleRecap.advertiser` et `.creator` à la table de RG112 (proposées au §3.1) |

### 9.2 Dans l'implémentation en cours (lecture seule, aucune modification)

Composants lus le 2026-09-19 : `apps/web/src/components/creator/RateCardEditor.tsx`,
`creator/creator-profile-labels.ts`, `packages/contracts/src/creator-profile.ts`. **Les
spécifications `06`, `07` et `08` font foi** ; ces écarts sont signalés à `dev-react-node` et à
`architecte`, sans préjuger d'un arbitrage.

| # | Écart constaté | Règle en cause | Effet |
|---|---|---|---|
| **E1** | **Le tarif se choisit dans une liste de tranches** (`<select>` de `PRICE_BAND_OPTIONS`), et la valeur exacte (`exactAmountMinor`) est posée en dur à la création d'une ligne, sans champ de saisie | `07` RG22 et RG66 : le tarif est **saisi en valeur exacte** (couche N) et **le système en dérive la tranche** | Deux conséquences : la couche N est vide de sens, et la tranche déclarée n'est plus adossée à un montant réel — donc la comparaison avec un budget de campagne devient déclarative. Le §5.4 dessine la saisie exacte attendue |
| **E2** | **Les étiquettes de couche exposent le vocabulaire interne** : « Couche A · Public Anonyme », « Couche I · Révélé sur accord », « Couche N · Interne INFLUX » | `07` RG112 : libellés imposés — « Visible de toutes les marques inscrites », « Visible uniquement après l'ouverture d'une mise en relation », « Visible uniquement par vous et l'équipe INFLUX » | Un créateur ne sait pas ce qu'est une « couche A ». Les codes A/I/N sont un outil de spécification. Libellés du §5.2 |
| **E3** | **Les listes fermées sont codées en dur dans le composant, en français uniquement** (formats, réseaux, tranches de prix, droits d'usage, disponibilité), et les tranches sont libellées **en euros en dur** (« Moins de 250 € ») alors que la devise est un champ | D28, `06` RG26, `07` RG66 (« une tranche sans devise n'existe pas »), `04` R8 (libellés depuis les fichiers de traduction) | L'écran est monolingue et mono-devise. C'est le point le plus coûteux à rattraper plus tard |
| **E4** | **Le taux figure en dur dans le code applicatif** : `STANDARD_COMMISSION_DISPLAY = "35 % (Barème standard)"` | `CLAUDE.md` §2, régime transitoire : « aucun taux et aucun calcul de commission dans le code » ; `07` RG69 fixe le libellé exact | Même à titre d'affichage, un taux littéral dans un composant est ce que le contrôle T16 cherche à interdire. La phrase doit venir d'une clé (`creatorProfile.rate.net`) |
| **E5** | **Le montant net est formaté à la main** : `Math.round(min/100)` puis `« … € »` concaténé | `CLAUDE.md` §4, D28 | Arrondi à l'euro, séparateurs et position du symbole non localisés ; en anglais, le rendu est faux |
| **E6** | **Le net est peint avec les tokens `feedback-success-*`** (texte teal + icône de tendance) | `design-system-influx` : marque et succès sont deux tokens distincts ; `02` §2.9 a créé `color-data-net-creator` pour ce rôle exact | Un montant n'est pas un succès. Une flèche montante suggère en outre une performance qu'INFLUX ne mesure pas (`08` RG2) |
| **E7** | *Point positif, à conserver* : `getEstimatedNetForPriceBand` **lit** les bornes nettes dans le référentiel (`ref.netMinAmountMinor`) et ne multiplie rien | `07` RG72 | Conforme. C'est la partie la plus risquée du sujet, et elle est juste |

---

## 10. Ce qui reste à valider

### 10.1 Par le fondateur

| # | Point | Pourquoi il ne peut pas être tranché ici |
|---|---|---|
| F1 | **Les 15 tokens proposés au §8.2**, dont 4 portent une nouvelle valeur non chromatique (`text-amount-md`, `size-nav-bottom-height`, `size-logo-brand-sm/-md`, `z-nav-bottom`) | Toute extension du design system passe par le fondateur pour ce qui touche la marque, par `expert-ux` pour le reste (D6, skill `design-system-influx`) |
| F2 | **L'absence de photo de profil créateur assumée jusque dans l'espace membre** : un créateur trouvera l'espace « froid ». La compensation retenue est le portfolio et le titre court | C'est un arbitrage produit visible, pas un détail visuel |
| F3 | **La navigation à 5 items et le choix de ne pas donner d'onglet au profil** | Décision structurante sur ce que le produit rend prioritaire |
| F4 | **Le vocabulaire des deux espaces** : « campagne / brief / livrables » côté marque, « offre / contenu / ce que je perçois » côté créateur. La copie finale relève de `expert-marketing`, l'intention relève du fondateur | §1.1 |
| F5 | **Les libellés de badge de `08` RG10 restent provisoires (D34)** et sont repris tels quels au §5.3 | D34 n'est pas tranchée ; aucun badge ne doit s'afficher avant |

### 10.2 Par `expert-conformite-rgpd` (veto)

| # | Point | Renvoi |
|---|---|---|
| C1 | **La mention d'information de l'écran 1** (finalités, Brevo et Apollo.io nommés, droits, lien) : formulation, longueur, et le fait qu'elle soit **dépliée** et non repliée | `05` RG6 ; §3.1 |
| C2 | **Une case de consentement ou deux** (Q10 de `05`). Le §3.4 en dessine une ; la variante à deux cases est décrite et ne change que ce bloc | `05` RG33 |
| C3 | **Le texte de l'écran d'acceptation** : les blocs ⑦ ⑧ ⑨ ⑩ ⑪, et en particulier le **résumé en langage courant de la clause de non-contournement**, qui n'existe pas encore | `13` RG69 #10, RG70 ; §7.2 |
| C4 | **L'annonce de la supervision sur l'écran d'acceptation**, en plus des cinq endroits de `12` RG102 — c'est un sixième endroit, proposé ici parce qu'accepter une mise en relation, c'est accepter d'entrer dans une conversation supervisée | `12` RG102, RG107 ; §7.2 |
| C5 | **Les deux listes de l'écran de suppression** (« ce qui disparaît » / « ce qui est conservé »), leur formulation et les durées à afficher | `05` RG70, `12` RG109 ; §6.3 |
| C6 | **Le libellé de l'attestation de majorité** : « 18 ans ou plus », âge fixe dans tous les pays (D15 précisée le 2026-10-08) | `05` RG19 ; §3.4 |
| C7 | **La mention « INFLUX ne se prononce pas sur l'authenticité des abonnés »** affichée au même endroit que le badge, sur mobile comme sur desktop — elle ne doit jamais glisser dans une page d'aide | `08` RG10, Q3 ; §5.3 |
| C8 | **L'écran d'information avant le premier message** : le fait qu'il n'ait **pas** de case à cocher (ce n'est pas un consentement, `12` RG104) et que sa prise de connaissance soit horodatée | `12` RG103 ; §4.7 |

### 10.3 Par `product-owner`

| # | Point | Renvoi |
|---|---|---|
| P1 | **Les sept écarts S1 à S7 du §9.1** | §9.1 |
| P2 | **Le découpage de la création de campagne en 5 étapes** (regroupement des 8 blocs de `09`) : c'est une décision d'ergonomie qui touche l'ordre des règles obligatoires | §4.3 |
| P3 | **Le contenu exact du bloc « à faire » de chaque accueil** : quels faits y remontent, dans quel ordre de priorité | §4.1, §5.1 |
| P4 | **L'absence de centre de notifications** et le fait que la cloche n'agrège que l'actionnable | §6.5 |
| P5 | **La formulation des messages d'accueil vide**, qui doivent rester factuels et vérifiables (`06` RG61, `07` RG90) : aucun n'a encore de clé | §2.4 |

### 10.4 Par `architecte` et `dev-react-node`

| # | Point | Renvoi |
|---|---|---|
| A1 | **Les sept écarts E1 à E7 du §9.2** | §9.2 |
| A2 | **`expires_at` servi par l'API** pour l'écran d'acceptation (S6) | §9.1 |
| A3 | **La prévisualisation créateur (S1) doit appeler la même interface que la recherche marque**, pas une route dédiée : deux chemins divergeraient | §5.8 |
| A4 | **Le contrôle de la case d'acceptation est refait côté serveur** (`13` RG70) : l'état inactif du bouton est un confort, jamais une protection | §7.2 |

---

## 11. Récapitulatif des écrans spécifiés

| Réf. | Écran | Section | Niveau |
|---|---|---|---|
| — | Architecture de l'information, navigation mobile et desktop, routage | §2 | Détaillé |
| E1 | Adresse e-mail | §3.1 | Détaillé |
| E2 | Code à 6 chiffres | §3.2 | Détaillé |
| E2b | « Je ne reçois pas le code » | §3.3 | Détaillé |
| E3 | Informations complémentaires — variantes marque et créateur | §3.4 | Détaillé |
| M1 | Accueil marque | §4.1 | Détaillé |
| M2 | Profil marque (4 blocs, couches, 5 états) | §4.2 | Détaillé |
| M3 | Création de campagne (8 blocs en 5 étapes) | §4.3 | Détaillé |
| M4 | Recherche de créateurs anonymisée (+ 3 états spécifiques) | §4.4 | Détaillé |
| M5 | Demander une mise en relation | §4.5 | Détaillé |
| M6 | Suivi des demandes et mises en relation (8 états) | §4.6 | Détaillé |
| M7 | Conversation à trois | §4.7 | Détaillé |
| M8 | Canal de documents | §4.8 | Détaillé |
| M9–M14 | Liste des campagnes · fiche de campagne · prévisualisation créateur · sélections · « ce que voit un créateur de mon profil » · demande de sélection à l'équipe | §4.9 | Tableau |
| C1 | Accueil créateur | §5.1 | Détaillé |
| C2 | Profil créateur (7 blocs, 3 couches, complétude) | §5.2 | Détaillé |
| C3 | Réseaux, preuves et badges (+ 2 parcours de vérification) | §5.3 | Détaillé |
| C4 | Mon offre et mes tarifs — transparence financière | §5.4 | Détaillé |
| C5 | Fil des campagnes | §5.5 | Détaillé |
| C6 | Fiche de campagne | §5.6 | Détaillé |
| C7 | Candidature (+ récapitulatif avant envoi) | §5.6 | Détaillé |
| C8 | Mes candidatures (8 états) | §5.7 | Détaillé |
| C9 | Conversation créateur (delta avec M7) | §5.8 | Détaillé |
| C10–C13 | Invitations reçues · mon profil vu par une marque · preuves déposées · contester un badge | §5.8 | Tableau |
| T1 | Mes informations (+ changement d'adresse) | §6.1 | Détaillé |
| T2 | Mes préférences de communication | §6.2 | Détaillé |
| T3 | Mes données : export, suppression, ce qui survit | §6.3 | Détaillé |
| T4 | Mes sessions | §6.4 | Détaillé |
| T5 | Notifications | §6.5 | Règles |
| T6 | Aide | §6.6 | Règles |
| T7 | États d'erreur, hors ligne, session expirée, ré-acceptation de CGU | §6.7 | Tableau |
| **★1** | **La carte créateur anonyme** | §7.1 | **Détail renforcé** |
| **★2** | **L'écran d'acceptation et de révélation** | §7.2 | **Détail renforcé** |
| **★3** | **Le bloc à trois notions financières** | §7.3 | **Détail renforcé** |

**Total : 37 écrans ou familles d'écrans**, dont 26 avec wireframe, contenu, états, clés, tokens et
accessibilité.









