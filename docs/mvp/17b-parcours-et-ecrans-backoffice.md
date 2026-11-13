# Lot 5 — Parcours et écrans du backoffice INFLUX

> **Date :** 2026-09-19, **révisé le 2026-10-28 (D73 : charte KEO Emerald, gabarit §1.7, §1.4, §6)** ·
> **Auteur :** `expert-ux`
> **Skills appliquées :** `backoffice-ops` (mode opératoire), `design-system-influx` (tokens, états,
> accessibilité), `feature-spec` (par renvoi pour les critères).
> **Lot :** 5 — *Backoffice complet, pipeline commercial et e-mails* (`00-cadrage-mvp-v2.md` §7),
> avec des écrans livrés plus tôt (Lots 1 à 4) et repris ici dans le gabarit commun.
>
> **Ce que ce document produit :** l'architecture de l'information du backoffice, le **gabarit unique
> de file** appliqué aux **16 files** du catalogue, les **wireframes détaillés** des écrans clés, les
> **composants transverses**, la **vérification du chronométrage** des cinq gestes les plus fréquents,
> les **extensions de tokens** nécessaires à un outil dense, et les **incohérences** relevées dans les
> spécifications.
>
> **Ce qu'il ne tranche pas, et ne redit pas :** les règles de gestion, qui appartiennent aux
> documents qui les ont écrites — `05` (inscription et leads), `06`/`07` (profils), `08` (badge),
> `09` (campagnes), `10` (recherche), `11` (candidatures), `12` (messagerie), `13` (mise en relation),
> `14` (pipeline commercial), `15` (files, alertes, fiches, supervision), `16` (e-mails Brevo),
> `03` (droits et RLS), `04` (modèle de données). **Ce document cite les règles, il ne les
> réécrit pas.** Toute divergence est une erreur de ce document.
>
> **Écrans des espaces membres :** `docs/mvp/17-parcours-et-ecrans-espaces-membres.md` (autre agent).
> Aucun écran n'est partagé entre les deux documents : `apps/backoffice` et `apps/web` sont deux
> applications (**D12**).
>
> **Source de vérité :** `CLAUDE.md`. En cas d'écart, `CLAUDE.md` prime.

---

## 0. Conventions de lecture

| Notation | Sens |
|---|---|
| `bo.x.y` | Clé de traduction du backoffice, `apps/backoffice/src/locales/{fr,en}/bo.json`. **Aucun libellé en dur** (`15` RG11, RG124) |
| `[■ Libellé]` | Bouton d'action principale (une seule par écran) |
| `[□ Libellé]` | Bouton secondaire |
| `[⚠ Libellé]` | Bouton d'action sensible ou destructrice — jamais rendu par la seule couleur (`15` RG119) |
| `[· Libellé]` | Bouton texte / lien d'action |
| `[▾ Libellé]` | Sélecteur, liste fermée |
| `( ) / (•)` · `[ ] / [x]` | Bouton radio · case à cocher |
| `‹clé›` | Raccourci clavier (`15` RG114) |
| `⟨…⟩` | Donnée variable |
| `▮` | Zone journalisée : son ouverture écrit une ligne de registre |
| **AA** | Point où le contraste a été vérifié (§6.4) |
| Largeurs | **Dense** = ≥ 1280 px (`breakpoint-xl`), poste de travail standard. **Étroite** = 1024–1280 px (`breakpoint-lg`), portable. En dessous de 1024 px : mise en page en une colonne, sans tableau — **le backoffice n'est pas mobile-first**, c'est le seul endroit du produit où cette règle ne s'applique pas (`CLAUDE.md` §4, qui vise les parcours influenceurs). **Exception décidée le 2026-09-24 (D58)** : sur téléphone, une vue limitée à deux gestes — répondre dans une conversation dont l'agent est participant, traiter la file de validation. Écrans à spécifier en additif de ce document. *Révisé le 2026-10-28 (D73, arbitrage `chef-de-projet`), remplace la mise en page en une colonne* : gabarit de poste de travail en §1.7 ; de 768 à 1023 px, backoffice complet avec la navigation en liste horizontale ; sous 768 px, aucun contenu métier tant que les deux vues D58 n'existent pas ; charte KEO Emerald, `20` §11 |

**Trois rappels qui conditionnent tous les écrans de ce document :**

1. **Toute action est attribuée et motivée** (`15` RG1). Un écran qui permet une action anonyme ou
   sans motif typé est refusé en revue.
2. **Trois libellés de montant, jamais interchangeables** — *Montant négocié*, *Commission convenue*,
   *Commission encaissée* — **toujours avec leur devise**, **jamais de total toutes devises**,
   **jamais de pourcentage**, **jamais de net créateur** (`15` RG4, RG5 — voir l'incohérence **I3**
   en §7, qui porte sur `14` RG37).
3. **Le commercial voit les identités que les membres ne voient pas.** Toute vue identifiée porte le
   **marqueur de vue identifiée** (§4.9) : c'est ce qui évite qu'un agent partage son écran, ou en
   montre une capture, en croyant montrer ce que voit la marque.

---

## 1. Architecture de l'information

### 1.1 Le problème à résoudre

Le backoffice fédère **16 files, 48 alertes, 3 fiches, 5 actions de masse, 4 exports** et un pipeline
commercial. Le risque n'est pas le manque de fonctions, c'est **l'éparpillement** : un commercial qui
doit deviner où se trouve ce qu'il cherche perd en navigation le temps que la plateforme est censée
lui faire gagner — et le plafond de croissance d'INFLUX est humain (`15` §Besoin, point 1).

**Le parti pris : trois niveaux, jamais quatre.**

```
Niveau 1 — Rail de navigation (7 entrées, toujours visibles)
Niveau 2 — Liste (une file, une recherche, un pipeline, un catalogue)
Niveau 3 — Objet (une entrée de file, une fiche, une affaire, une conversation)
```

Tout ce qui ne tient pas en trois niveaux est une erreur de rangement, pas un besoin d'un quatrième
niveau. Les panneaux latéraux (décision, proposition, suspension) **ne comptent pas comme un
niveau** : ils s'ouvrent par-dessus le niveau 2 ou 3 sans le quitter, et `Échap` les referme sans
perdre la saisie (`15` RG116).

### 1.2 Le rail de navigation

Sept entrées, dans cet ordre. L'ordre est une décision produit : il va de « ce que je dois traiter »
à « ce que j'administre ».

| # | Entrée | Ce qu'on y trouve | Rôles | Compteur affiché sur le rail |
|---|---|---|---|---|
| 1 | **Tableau de bord** `bo.nav.dashboard` | Les 5 blocs `agent` (`15` RG18) ou 8 blocs `admin` (RG21) | `agent` `admin` | — |
| 2 | **Files** `bo.nav.queues` | Les 16 files, regroupées en 5 groupes (§1.3) | `agent` `admin` | **Total à traiter** + **badge « hors délai »** écrit, pas seulement coloré |
| 3 | **Comptes** `bo.nav.accounts` | Recherche de comptes, fiche marque, fiche créateur | `agent` `admin` | — |
| 4 | **Créateurs** `bo.nav.creatorSearch` | Recherche en **vue identifiée** (`10` §H) et point de départ de la **proposition INFLUX** | `agent` `admin` | — |
| 5 | **Affaires** `bo.nav.deals` | Pipeline commercial (`14`), anomalies, encaissements | `agent` `admin` | Nombre d'anomalies |
| 6 | **Alertes** `bo.nav.alerts` | Catalogue des 48 alertes, instances ouvertes | `agent` `admin` | Nombre d'alertes **d'événement** non classées |
| 7 | **Administration** `bo.nav.admin` | Comptes internes, plafonds et délais, exports, e-mails, demandes de données personnelles, registre | `admin` (et `agent` pour les e-mails et l'instruction des demandes) | Nombre d'actions en attente de seconde validation |

**Ce qui n'est pas dans le rail, et pourquoi.**

| Absent | Où c'est, et pourquoi |
|---|---|
| Une entrée « Conversations » | **Délibérément absente.** Il n'existe pas de liste transverse des conversations : la recherche plein texte multi-fils est interdite (`12` RG62). On atteint un fil par sa mise en relation, par la fiche d'un compte ou par une affaire — **jamais en parcourant** |
| Une entrée « Campagnes » | La file `campaigns` couvre la validation ; le reste s'atteint par la fiche marque (bloc 4) et par la recherche de créateurs (pont campagne → recherche, `10` RG73) |
| Une entrée « Statistiques » | Hors périmètre (`15` §Hors périmètre). Les indicateurs vivent au tableau de bord et dans l'export agrégé **E4** |
| Un lien « export » global | Les exports sont une **liste fermée de 4** (`15` RG93), rangés sous Administration. Un bouton d'export visible partout banaliserait le geste le plus sensible du produit |

**Forme du rail, entrées visibles aujourd'hui et pages de second niveau : §1.7** *(D73, 2026-10-28 ;
second niveau en sous-menu du rail, D74, 2026-10-29)*.

### 1.3 Regroupement des 16 files

Les 16 files sont un catalogue plat en base (`15` RG26). À l'écran, elles sont **regroupées en cinq
groupes métier** : un menu de 16 entrées n'est pas lisible, et l'ordre alphabétique ne dit rien du
métier.

```
FILES                                    en attente · plus ancienne · hors délai
├─ Faire entrer dans le produit
│  ├─ Profils marque à valider            ⟨n⟩   ⟨2 h 10⟩   ⟨0⟩
│  ├─ Profils créateur à valider          ⟨n⟩   ⟨0 h 40⟩   ⟨0⟩
│  ├─ Visuels de portfolio à modérer      ⟨n⟩   ⟨5 h 02⟩   ⟨2⟩  ⚑ hors délai
│  ├─ Demandes de vérification et badge   ⟨n⟩   ⟨1 h 15⟩   ⟨0⟩
│  ├─ Identifiants modifiés à contrôler   ⟨n⟩   ⟨—⟩        ⟨0⟩
│  └─ Campagnes à valider                 ⟨n⟩   ⟨3 h 30⟩   ⟨1⟩  ⚑ hors délai
├─ Faire se rencontrer          ◀── le groupe qui porte le chiffre d'affaires
│  ├─ Demandes de contact et candidatures ⟨n⟩   ⟨0 h 22⟩   ⟨0⟩
│  └─ Sélection par l'équipe INFLUX       ⟨n⟩   ⟨—⟩        ⟨0⟩
├─ Protéger
│  ├─ Signalements                        ⟨n⟩   ⟨—⟩        ⟨0⟩
│  ├─ Documents à contrôler               ⟨n⟩   ⟨—⟩        ⟨0⟩
│  └─ Contestations de badge              ⟨n⟩   ⟨—⟩        ⟨0⟩
├─ Faire fonctionner la machine
│  ├─ Échecs de synchronisation           ⟨n⟩   ⟨1 j⟩      ⟨0⟩
│  ├─ Échecs d'envoi d'e-mails            ⟨n⟩   ⟨—⟩        ⟨0⟩
│  └─ Adresses injoignables               ⟨n⟩   ⟨4 h⟩      ⟨0⟩
└─ Obligations et contrôles
   ├─ Demandes de données personnelles    ⟨n⟩   ⟨J-12⟩     ⟨0⟩
   └─ Actions en attente de validation    ⟨n⟩   ⟨12 h 30⟩  ⟨0⟩
```

| Groupe | Files (`15` RG29 + RG125) | Ce que le groupe dit à l'agent |
|---|---|---|
| **Faire entrer dans le produit** | 1 `profiles_advertiser` · 2 `profiles_creator` · 3 `portfolio_moderation` · 4 `verification` · 6 `identity_change_review` · 7 `campaigns` | Du stock qui attend d'être publiable. Le retard y coûte de l'offre et de la demande |
| **Faire se rencontrer** | 8 `introductions` · 9 `team_selection` | **Le groupe qui porte le chiffre d'affaires.** Il est visuellement distingué (encadré, pas seulement coloré) et son retard escalade à J+1, pas à J+3 (`15` RG37) |
| **Protéger** | 5 `verification_disputes` · 10 `reports` · 11 `documents` | Des décisions qui engagent la crédibilité d'INFLUX vis-à-vis d'un membre |
| **Faire fonctionner la machine** | 12 `lead_sync_failures` · 13 `email_delivery_incidents` · 16 `email_send_failures` | Des incidents techniques. Aucun verrou sur 12 et 16 (`15` RG30, RG125) |
| **Obligations et contrôles** | 14 `data_subject_requests` · 15 `dual_control_pending` | Des délais qui ne se négocient pas, et le contrôle par les pairs |

> **Incohérence relevée (I1, §7).** L'additif `15` RG125 numérote `email_send_failures` **14**, numéro
> déjà pris par `data_subject_requests`. Ce document lui attribue le **16** et le signale à
> `product-owner`.

### 1.4 Ce qui est visible en permanence

Une bande de tête fixe, `z-(--z-header)`, jamais masquée par le défilement, jamais recouverte. Elle
est le seul élément qui ne change pas d'un écran à l'autre.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ⬤ PRODUCTION │ [⌕ Rechercher ⌘K]                               ⚑ 3  Marie D. · agent │  ← barre 1
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ⓘ Contrôle par les pairs indisponible — les actions sensibles sont confirmées en     │  ← barre 2
│   mode différé.                                            [· En savoir plus]        │    (conditionnel)
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ⏱ Envoi « Relance créateurs FR » — 4 min 12 s avant départ.  [⚠ Annuler cet envoi]   │  ← barre 3
└──────────────────────────────────────────────────────────────────────────────────────┘    (conditionnel)
```

| # | Élément | Règle | Présence |
|---|---|---|---|
| 1 | **Environnement** | `⬤ PRODUCTION` / `⬤ RECETTE` / `⬤ LOCAL`. En dehors de la production, la barre entière change de fond (`color-bo-env-nonprod-bg`) **et** porte le mot écrit : un agent qui croit être en recette alors qu'il est en production envoie de vrais e-mails (`16` §J) | Toujours |
| 2 | **Recherche globale** `‹⌘K›` / `‹Ctrl K›` | §1.5 | Toujours |
| 3 | **Compteur d'alertes** `⚑ ⟨n⟩` | Alertes **d'événement non classées** dont je suis destinataire. Le pictogramme est doublé du nombre écrit ; jamais une pastille de couleur seule | Toujours |
| 4 | **Identité et rôle** | « Marie D. (agent) ». **Le rôle est écrit**, pas déduit d'une couleur : c'est ce qui rend visible l'élévation `agent` → `admin` (`15` RG108, **Q13**) | Toujours |
| 5 | **Bandeau de contrôle affaibli** | `bo.dualControl.degraded`, ton « information », **jamais** « erreur » : ce n'est pas une panne, c'est un état de l'équipe (`15` RG107) | Tant qu'il n'y a pas 2 `admin` actifs |
| 6 | **Bandeau d'annulation d'envoi** | Compte à rebours, annulable par **n'importe quel** `agent` ou `admin`, depuis **n'importe quel** écran (`16` RG28, `15` RG127-2). Annoncé aux lecteurs d'écran par `role="status"`, mis à jour toutes les 30 s et non à chaque seconde | Pendant la fenêtre de 5 min |
| 7 | **Bandeau d'interrupteur d'urgence** | AL45 : « Envois marketing suspendus — ⟨cause⟩ ». Ton « alerte ». Affiché à **tous** les rôles internes (`16` RG121) | Tant qu'actif |

*Révisé le 2026-10-28 (D73).* La bande de tête couvre la **zone de contenu**, à droite du rail
pleine hauteur (§1.7) : le nom « INFLUX Backoffice » passe en tête du rail ; l'identité et le rôle
restent dans la bande, écrits (« Marie D. · agent »), sans menu déroulant ; « Se déconnecter » est au
pied du rail. Hauteur `spacing-bo-band-h`, `surface-page` et filet bas `border-default` en production.

**Ce qui n'est jamais dans la bande de tête :** un montant, un nom de membre, un extrait de message,
un compteur animé. Une bande de tête permanente est lue dix mille fois par mois : tout ce qui y
figure doit mériter cette répétition.

### 1.5 La recherche globale

Un seul champ, ouvert au clavier `‹⌘K›`, qui remplace sept menus. **C'est le raccourci qui fait la
différence entre un outil de dix décisions par jour et un outil de cent.**

```
┌────────────────────────────────────────────────────────────────┐
│ ⌕ ⟨saisie⟩                                              [Échap]│
├────────────────────────────────────────────────────────────────┤
│ RÉFÉRENCES                                                     │
│   MER-2026-000123  Mise en relation — révélée le 12/09  ▮      │
│ COMPTES  (recherche partielle — limitée en débit et journalisée)│
│   ⟨Marque⟩  Raison sociale — FR — actif          ▮             │
│   ⟨Créateur⟩ alias @…  — BE — badge Audience     ▮             │
│ ALLER À                                                        │
│   Files › Demandes de contact et candidatures                  │
│   Administration › Comptes internes                            │
├────────────────────────────────────────────────────────────────┤
│ 5 résultats sur 5. Affiner la recherche pour en voir d'autres. │
└────────────────────────────────────────────────────────────────┘
```

| Règle | Détail |
|---|---|
| **Trois familles de résultats, dans cet ordre** | Références exactes (`MER-…`, référence d'affaire, identifiant d'envoi) · Comptes · Navigation |
| **Plafond dur de 5 résultats par famille** | `15` RG34 : une recherche qui remonte 200 lignes est un export déguisé. Le pied dit **« 5 sur 5 »** et invite à affiner, il ne propose **jamais** « voir tous les résultats » |
| **Recherche par adresse exacte** | Libre (`05` RG98) |
| **Recherche partielle** | Limitée en débit **et journalisée** (`05` RG98, `15` RG50). L'écran le dit en une ligne sous le groupe « Comptes » — il ne le cache pas |
| **Ouvrir un résultat de compte = ouvrir une fiche** | Donc **une ligne de journal** (`15` RG40). Le marqueur ▮ le signale dans la liste, avant le clic |
| **Aucune donnée personnelle dans l'URL** | La navigation se fait par identifiant, jamais par nom (`15` RG121) |

### 1.6 Tableau de bord, par rôle

Le tableau de bord n'est pas repris bloc par bloc : `15` RG18 et RG21 en fixent le contenu et
**l'ordre imposé**. Ce document en fixe la **forme**.

```
┌ Tableau de bord ─────────────────────── arrêté à 09 h 41 (Europe/Paris) [□ Actualiser] ┐
│                                                                                         │
│ 1 · À TRAITER MAINTENANT                                                    ‹b puis 1›  │
│   ⚑ HORS DÉLAI ─────────────────────────────────────────────────────────────────────   │
│   │ MER-2026-000118  Demande de contact   hors délai depuis 3 h 12   [· Ouvrir] ▮  │   │
│   ────────────────────────────────────────────────────────────────────────────────    │
│   Entrées dont je tiens le verrou (2) · Tâches datées (1) · Alertes non classées (3)   │
│                                                                                         │
│ 2 · LES FILES                                                               ‹b puis 2›  │
│   ┌──────────────────────────────┬────────┬───────────────┬───────────┬─────────────┐  │
│   │ File                         │ En att.│ Plus ancienne │ Hors délai│ Sans preneur│  │
│   ├──────────────────────────────┼────────┼───────────────┼───────────┼─────────────┤  │
│   │ Demandes de contact & cand.  │     7  │  0 h 22       │        0  │          1  │  │
│   │ Campagnes à valider          │     3  │  3 h 30  ⚑    │        1  │          0  │  │
│   │ Profils créateur             │     0  │  — dernière traitée il y a 12 min       │  │
│   │ Adresses injoignables        │     0  │  ⛔ bloquée — rien depuis 26 h ouvrées   │  │
│   └──────────────────────────────┴────────┴───────────────┴───────────┴─────────────┘  │
│                                                                                         │
│ 3 · MES AFFAIRES                                                            ‹b puis 3›  │
│ 4 · MA SEMAINE                                                              ‹b puis 4›  │
│   Commission convenue      EUR  4 200,00      Commission encaissée  EUR  2 100,00      │
│                            GBP    900,00                            GBP      0,00      │
│   Écart convenue − encaissée  EUR 2 100,00 · GBP 900,00                                │
│   ⓘ Montants présentés par devise, sans conversion.                                    │
│ 5 · MON ACTIVITÉ                                                            ‹b puis 5›  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

| Point de forme | Règle appliquée |
|---|---|
| **Tout chiffre est un lien** | `15` RG15. Techniquement un `<a>` vers la liste filtrée, pas un `<div>` cliquable : il doit être ouvrable dans un nouvel onglet, atteignable au clavier et annoncé comme lien |
| **Lecture seule** | `15` RG16. **Aucun** bouton d'action dans un bloc, `[· Ouvrir]` excepté. Cela évite l'erreur la plus banale d'un outil dense : cliquer une action en croyant ouvrir une liste |
| **« arrêté à ⟨heure⟩ »** avec fuseau | `15` RG17, RG12. Aucun rafraîchissement automatique, aucun compteur qui défile |
| **Deux états vides distincts** | `15` RG24, RG32 : « — dernière traitée il y a 12 min » (normal) contre « ⛔ bloquée — rien depuis 26 h ouvrées » (incident, AL4). Deux formulations, deux pictogrammes, **pas seulement deux couleurs** |
| **Ma semaine : une ligne par devise** | `15` RG19, CA4. Jamais de total global. La mention `bo.amount.byCurrency` est **sous** le bloc, pas en infobulle |
| **`admin`, le lundi** | Le bloc 8 « Contrôles » passe **en tête**, au-dessus du bloc 1, et son ouverture est journalisée (`15` RG22, CA8) |
| **Sauts clavier** | `‹b puis n›` amène le focus sur le bloc n *(révisé le 2026-10-28 : `g` puis n reste réservé aux entrées du rail, §4.11)*. `‹?›` affiche la liste des raccourcis |

### 1.7 Gabarit de page : rail à gauche, bande de tête, vue téléphone *(D73, 2026-10-28)*

Charte KEO Emerald (`20` §11). Référence de comportement : Railway (`20` §3) — colonne fixe à gauche,
pleine hauteur, en-tête qui dit où l'on est, pied de colonne ; sans sélecteur, sans repli en icônes,
sans l'accent violet de Railway.

```
Poste de travail 1440 (conçu à 1280 et 1440 ; identique de 1024 à 1279)
┌────────────────────────────────┬──────────────────────────────────────────────────────────────┐
│ INFLUX                         │ ⬤ PRODUCTION │ [⌕ Rechercher  ⌘K]     ⚑ 3   Marie D. · agent │
│ Backoffice                     ├──────────────────────────────────────────────────────────────┤
│                                │ ⓘ Contrôle par les pairs indisponible — … [· En savoir plus] │
│  [i] Tableau de bord           ├──────────────────────────────────────────────────────────────┤
│  [i] Files                  12 │ Comptes › Inscrits                                           │
│      ⚑ 2 hors délai            │ Inscrits ▮                                                   │
│  [i] Comptes                   │ Filtres en puces                                             │
│      ▎ Inscrits                │ ┌──────────────────────────────────────────────────────────┐ │
│        Invitations             │ │ Inscrit          Rôle         Pays  Inscrit le  Synchro. │ │
│  [i] Créateurs                 │ ├──────────────────────────────────────────────────────────┤ │
│  [i] Affaires                1 │ │ ⟨adresse⟩        ● Marque     FR    27/10 09:12 ○ à jour │ │
│  [i] Alertes                 3 │ │ ⟨adresse⟩        ● Créateur   BE    27/10 08:40 ⚑ échec  │ │
│  [i] Administration          2 │ └──────────────────────────────────────────────────────────┘ │
│ ────────────────────────────── │                                                              │
│  [i] Raccourcis            ‹?› │                                                              │
│  [i] Se déconnecter            │                                                              │
└────────────────────────────────┴──────────────────────────────────────────────────────────────┘
  spacing-bo-rail-w (15 rem),      zone de contenu : pleine largeur pour un tableau,
  collant, pleine hauteur          container-narrow pour un formulaire
  [i] = icône lucide décorative · ▎ = filet 2 px de la sous-entrée courante (D74)
```

| Élément | Règle |
|---|---|
| Points de rupture | *(Arbitrage `chef-de-projet` du 2026-10-28.)* ≥ 1 024 px : ce gabarit. **Entre 1 024 et 1 279 px**, rail identique ; les panneaux latéraux (`spacing-bo-panel-w`) recouvrent la liste au lieu de la pousser ; un tableau trop large défile seul, horizontalement, première colonne collante — jamais la page. **Entre 768 et 1 023 px** : backoffice complet, sans rail ; le même `<nav>` devient une **liste horizontale compacte** sous la bande de tête (`02` §21.5 point 8), qui passe à la ligne sans cacher d'entrée ; contenu pleine largeur, tableaux et panneaux comme entre 1 024 et 1 279 px. Cas visé : une fenêtre en demi-écran sur un poste de 1 920 px. **Sous 768 px** : règle téléphone ci-dessous |
| Rail | `spacing-bo-rail-w` (15 rem), collant, pleine hauteur, `surface-page`, filet droit `border-default`, défilement propre. En tête : INFLUX et « Backoffice » (lien vers le tableau de bord). Les sept entrées de §1.2, dans cet ordre : icône + libellé `text-sm`, hauteur `spacing-bo-row-h`. Actif : filet gauche 2 px `brand-primary`, surface `nav-item-active-bg`, libellé semi-gras, `aria-current="page"` (`20` §11.8). Compteurs en chiffres tabulaires `text-secondary` ; le hors délai est **écrit** sous l'entrée (« ⚑ 2 hors délai », `bo-sla-overdue-text`). Pied : raccourcis (`?`), se déconnecter |
| Pas de repli | Le gain (environ 11 rem) ne vaut pas un second gabarit à tester ; un repli mémorisé exigerait un stockage que le front n'a pas (D37) |
| Bande de tête | §1.4, au-dessus de la seule zone de contenu ; hors production, fond `bo-env-nonprod-bg` et mot en capitales (§4.6) |
| Second niveau | *(Révisé le 2026-10-29, D74 ; détail : `archives/jalons/sn-fiche.md`.)* Les écrans d'une entrée sont des **sous-entrées du rail**, liste imbriquée dans l'entrée **active seulement** : sans icône, libellé aligné, hauteur `spacing-bo-row-h` ; l'entrée passe à l'état ancêtre (semi-gras, sans surface ni filet, sans `aria-current`), la sous-entrée courante porte surface, filet et `aria-current="page"` ; une fiche (`/inscrits/⟨id⟩`) rend sa sous-entrée courante. Une entrée à un seul écran n'a pas de sous-menu. **Plus aucun lien de section ni onglet de rubrique en tête de contenu** ; le fil d'Ariane « ⟨entrée⟩ › ⟨écran⟩ » reste. Le lien d'une entrée ouvre son premier écran, comme avant : le backoffice n'a pas de page-menu, faute de vue téléphone (F7). De 768 à 1 023 px, les sous-entrées de l'entrée active forment une **seconde ligne** sous la liste horizontale, qui passe à la ligne sans défilement. Files (Lots 2 à 5) : le lien de l'entrée mène au catalogue (§1.3), les files sont ses sous-entrées sous les cinq intitulés de groupe |
| Vue identifiée | Barre de 4 px sur la **zone de contenu** concernée (§4.9), jamais sur le rail |
| Clavier | Lien d'évitement → bande → rail → contenu. `g` puis 1…7 garde **le numéro de §1.2** même quand des entrées sont masquées (`g` puis 3 = Comptes, toujours) ; un numéro sans entrée ne fait rien. Focus au `h1` après navigation. Les blocs du tableau de bord se rejoignent par `b` puis n (§1.6, §4.11 ; arbitrage du 2026-10-28) |
| Un seul `<nav>` | Un seul élément `<nav>` « Navigation principale », rendu une fois et restylé par le CSS : rail à partir de `lg`, liste horizontale de 768 à 1 023 px (`02` §21.5). Ni détection de largeur en JavaScript, ni second `<nav>` masqué. Les sous-entrées vivent dans ce même `<nav>` (D74) |

**Entrées visibles au 2026-10-28.** Une entrée apparaît avec son premier écran et ne disparaît plus ;
le gabarit est conçu et testé pour les sept (arbitrage `chef-de-projet` du 2026-10-28).

| Entrée (§1.2) | Écrans existants, en sous-entrées du rail (D74) | Rôles |
|---|---|---|
| 1 Tableau de bord | `/accueil` | `agent`, `admin` |
| 2 Files | — | masquée |
| 3 Comptes | Inscrits (`/inscrits`, fiche `/inscrits/[id]`) · Invitations (`/invitations`) | `agent`, `admin` |
| 4 Créateurs | — (Lot 3) | masquée |
| 5 Affaires | — (Lot 5) | masquée |
| 6 Alertes | — | masquée |
| 7 Administration | Double validation · Comptes internes · Réglages Apollo · Santé technique | `admin` ; absente pour l'`agent`, qui n'y a encore rien (CA63) |

**Téléphone, sous 768 px de large ou 500 px de haut — règle provisoire jusqu'aux vues D58 (Lot 4)**

```
Téléphone 375 — tout écran derrière session
┌─────────────────────────────────────────┐
│ ⬤ RECETTE · INFLUX Backoffice           │  bande réduite : environnement écrit
│ Marie D. · agent                        │  identité et rôle
├─────────────────────────────────────────┤
│ Le backoffice se consulte sur un poste  │  h1, text-title-page
│ de travail                              │
│                                         │
│ Cet écran demande au moins 768 px de    │  text-md, text-secondary
│ large. Sur téléphone, vos conversations │
│ et la file de validation seront         │
│ disponibles à leur mise en service.     │
│                                         │
│                                         │
│                                         │
│ [□ Se déconnecter]                      │
└─────────────────────────────────────────┘
```

| Règle | Détail |
|---|---|
| Contenu | **Aucun contenu métier** quand la fenêtre fait **moins de 768 px de large ou moins de 500 px de haut**, sur tout écran derrière session : bande réduite, écran d'explication, `[□ Se déconnecter]`. Remplace, pour cette période, le « une colonne, sans tableau » de M4 (§7.2). La condition de hauteur couvre le téléphone tenu à l'horizontale, qui dépasse souvent 768 px de large (F7, tranché par le fondateur le 2026-10-29, `20` §11.9). Les deux seuils sont déclarés une seule fois, en CSS (aucune détection en JavaScript), à côté des tokens du backoffice |
| Pourquoi | (1) D58 n'autorise sur téléphone que deux gestes, qui n'existent pas encore ; (2) les écrans actuels montrent des identités et des actions sensibles, lisibles par-dessus l'épaule dans un lieu public ; (3) les conditions de session sur téléphone ne sont pas fixées (`architecte` + `expert-cybersecurite`, avant le Lot 4) ; (4) aucune version en une colonne à concevoir, tester puis jeter |
| Connexion | Les écrans de connexion et d'activation du second facteur restent utilisables à toute largeur (formulaires d'une colonne). **Ce masquage est une règle d'écran, pas une mesure de sécurité** : empêcher toute session sur téléphone relève d'`architecte` + `expert-cybersecurite` |
| Ensuite | Au Lot 4, la conversation et la file de validation reçoivent leur vue téléphone (additif D58, cibles `size-touch-target`) ; tout le reste garde cet écran sous 768 px |

**États du gabarit.** Chargement : rail et bande affichés, entrées et contenu en squelette à hauteur
fixe. Session illisible : notice et lien de reconnexion, sans rail (existant). Déconnecté : page sans
rail (existant). Entrée réservée : « réservé aux administrateurs », appel refusé journalisé (CA63).
Téléphone : écran ci-dessus.

| Clé | Français | English |
|---|---|---|
| `bo.shell.skip` | Aller au contenu | Skip to content |
| `bo.shell.nav.label` | Navigation principale | Main navigation |
| `bo.shell.signOut` | Se déconnecter | Sign out |
| `bo.shell.shortcuts` | Raccourcis | Shortcuts |
| `bo.shell.overdue` | {count, plural, one {# hors délai} other {# hors délai}} | {count, plural, one {# overdue} other {# overdue}} |
| `bo.shell.workstationOnly.title` | Le backoffice se consulte sur un poste de travail | The back office is designed for a workstation |
| `bo.shell.workstationOnly.body` | Cet écran demande une fenêtre d'au moins 768 px de large et 500 px de haut. Sur téléphone, vos conversations et la file de validation seront disponibles à leur mise en service. | This screen needs a window at least 768 px wide and 500 px tall. On a phone, your conversations and the review queue will be available once they launch. |

---

## 2. Anatomie standard d'une file

> **Un seul gabarit pour les 16 files** (`15` §Impacts, « Gabarit commun de file »). C'est ce qui
> rend les raccourcis clavier apprenables : un agent qui a appris une file les a toutes apprises.
> Une file qui a besoin d'un gabarit à elle est une file mal spécifiée.

### 2.1 Les quatre temps d'une file

```
  ① LISTE ──────► ② OUVERTURE ──────► ③ DÉCISION ──────► ④ SORTIE
     dense           = prise en          motif typé         entrée suivante
     triée par       charge auto         + message          automatique
     échéance        (RG27 C1)           prévisualisé       (‹j›)
```

Chaque temps a une règle non négociable :

| Temps | Règle | Source |
|---|---|---|
| ① Liste | **Tri par échéance croissante**, hors délai en tête avec **libellé écrit** | `15` RG27 C5, **Q5** |
| ② Ouverture | **Ouvrir = prendre en charge.** Aucun clic « prendre en charge » préalable | `15` RG27 C1, `13` RG27 |
| ③ Décision | **Deux issues, jamais trois.** Motif typé obligatoire, message au membre **montré avant** | `15` RG27 C6, RG7 |
| ④ Sortie | **Aucune sortie silencieuse.** L'entrée suivante s'ouvre, et se prend en charge à son tour | `15` RG27 C7 |

### 2.2 Écran ① — la liste (gabarit, largeur dense)

```
┌ Files › Faire se rencontrer › Demandes de contact et candidatures ─────────────────────┐
│                                                                                         │
│  7 en attente  ·  plus ancienne : 0 h 22  ·  hors délai : 0  ·  sans preneur : 1        │  ← compteurs
│  Délai de décision : 1 jour ouvré · Objectif de prise en charge : 4 h ouvrées           │    permanents
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [▾ Origine : toutes] [▾ Verrou : tous] [▾ Responsable] [▾ Période] [x] Hors délai seuls │  ← filtres
│ [▾ Alerte]                                        7 résultats · page 1/1   [· Réinit.]  │
├───┬──────────────┬───────────┬──────────────┬──────────────┬─────────────┬─────────────┤
│   │ Échéance ▲   │ Réf.      │ Origine      │ Marque       │ Créateur    │ Verrou      │
├───┼──────────────┼───────────┼──────────────┼──────────────┼─────────────┼─────────────┤
│ ⚑ │ HORS DÉLAI   │ MER-…118  │ Demande      │ ⟨raison soc.⟩│ ⟨alias⟩ ✓   │ libre       │
│   │ depuis 3 h12 │           │ de contact   │              │             │             │
├───┼──────────────┼───────────┼──────────────┼──────────────┼─────────────┼─────────────┤
│ ● │ dans 2 h 05  │ MER-…121  │ Candidature  │ ⟨raison soc.⟩│ ⟨alias⟩     │ Marie D.    │
│   │              │           │              │              │             │ depuis 09h42│
├───┼──────────────┼───────────┼──────────────┼──────────────┼─────────────┼─────────────┤
│ ○ │ dans 6 h 40  │ MER-…124  │ Demande      │ ⟨raison soc.⟩│ ⟨alias⟩ ✓   │ libre       │
│   │              │           │ de contact   │ ⚑ les deux parties se sont cherchées     │
└───┴──────────────┴───────────┴──────────────┴──────────────┴─────────────┴─────────────┘
  ‹j›/‹k› ligne suivante/précédente · ‹Entrée› ouvrir (prend en charge) · ‹?› raccourcis
```

| Élément | Règle |
|---|---|
| **Bandeau de compteurs** | `15` RG28 : volume en attente **et ancienneté de la plus ancienne**, en permanence. Le délai et l'objectif de la file sont rappelés **en clair** : un agent ne doit pas avoir à se souvenir que la revue renforcée est à 2 jours |
| **Colonne 1, l'état** | Trois glyphes **doublés d'un libellé en colonne 2** : `⚑` hors délai · `●` verrou tenu · `○` libre. **La couleur ne porte jamais l'information seule** (`15` RG119, CA15) |
| **Colonne « Échéance »** | Tri par défaut, marqueur `▲`. Un hors délai affiche **« HORS DÉLAI depuis ⟨durée⟩ »**, pas une date. Une décision tardive reste possible (`15` RG27 C8) |
| **Colonne « Verrou »** | « libre » ou **« ⟨Prénom N.⟩ depuis ⟨heure⟩ »** — un **nom**, jamais un identifiant technique (`15` RG27 C2) |
| **Alertes de ligne** | Repliées sous la ligne, en clair, jamais en infobulle : une infobulle n'existe pas au clavier ni à l'impression |
| **Filtres communs aux 16 files** | État · hors délai · titulaire du verrou · commercial responsable · période · présence d'une alerte (`15` RG33). Les filtres propres à la file s'ajoutent **à droite**, après un séparateur |
| **Pagination** | **Plafonnée côté serveur, défilement infini interdit** (`15` RG34, CA18). Le pied affiche « page 1/1 », jamais « charger plus » |
| **L'URL porte tri, filtres et page** | `15` RG121 — et **aucune donnée personnelle** : des codes et des identifiants |
| **Sélection multiple** | Affichée **uniquement** sur les files à action de masse (3, 12, 16). Sur `introductions`, aucune case à cocher n'existe : l'action de masse y est **interdite** (`13` RG50, `15` CA61) |

### 2.3 Les deux états vides, et pourquoi ils ne se ressemblent pas

```
   VIDE (normal)                          BLOQUÉE (incident, AL4)
 ┌───────────────────────────────┐      ┌──────────────────────────────────────┐
 │ ✓ Aucune entrée en attente    │      │ ⛔ Aucune entrée n'est remontée       │
 │   La dernière a été traitée   │      │    depuis 26 h ouvrées.              │
 │   il y a 12 min.              │      │    Cette file en reçoit              │
 │                               │      │    habituellement.                   │
 │   [· Voir les 14 traitées     │      │    [· État des services]             │
 │      aujourd'hui]             │      │    Alerte AL4 ouverte.               │
 └───────────────────────────────┘      └──────────────────────────────────────┘
      `bo.queue.empty`                        `bo.queue.stalled`
```

Deux formulations, deux pictogrammes, **deux tons différents** (succès / alerte). `15` RG32 et CA7.
Le lien « voir les traitées » donne le repère qui manque le plus à un agent qui arrive le matin : la
file est-elle vide parce que tout va bien, ou parce que rien n'arrive ?

### 2.4 Écran ② — ouverture et verrou

L'ouverture ne pose **aucune question** : elle prend en charge et affiche. Trois bandeaux possibles,
en tête de l'écran de décision, **jamais trois couleurs seules** :

| Situation | Bandeau | Ton | Actions disponibles |
|---|---|---|---|
| Je viens de prendre l'entrée | `bo.queue.claimed.byMe` — « Vous avez pris cette entrée en charge à 09 h 42. » | Information | Toutes · `[· Je rends la main]` ‹l› |
| Un collègue la tient | `bo.queue.claimed.byOther` — « En cours — Marie D., depuis 09 h 42. » + « Vous pouvez lire, vous ne pouvez pas décider. » | Information, **pas erreur** | Lecture seule. `admin` : `[⚠ Lever le verrou]` avec motif typé |
| Hors délai | `bo.queue.overdue` — « Hors délai depuis 3 h 12. Une décision reste possible. » | Alerte | Toutes |

**Ce qui est interdit ici :** un écran d'erreur, un dialogue modal bloquant, un doublon. Le second
agent lit sans frustration et comprend en une phrase pourquoi il ne peut pas décider (`15` CA12).

**Expiration.** Le verrou tombe à 30 minutes (`15` RG27 C3). À T-3 minutes, un bandeau discret le
dit : « Votre prise en charge expire dans 3 min. [· Prolonger] ». Sans ce rappel, un agent qui
rédige un motif long voit son verrou disparaître sous lui. **Prolonger** repose le verrou pour
30 minutes et est journalisé.

### 2.5 Écran ③ — le gabarit de décision

```
┌ MER-2026-000124 · Demande de contact · créée le 19/09 à 08 h 12 (Europe/Paris) ────────▮┐
│ ⏱ Échéance dans 6 h 40  ·  Vous avez pris cette entrée en charge à 09 h 42.             │
│                                                       [· Je rends la main ‹l›] [· Réatt.]│
├───────────────────────────────────────────┬─────────────────────────────────────────────┤
│ ① LA MARQUE                               │ ② LE CRÉATEUR        ⬥ VUE IDENTIFIÉE        │
│   …                                       │   …                                          │
├───────────────────────────────────────────┴─────────────────────────────────────────────┤
│ ③ CE QUI A ÉTÉ ÉCRIT                                                                     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ④ ALERTES                                                                                │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑤ DÉCISION                                                                               │
│    [■ Valider ‹v›]   [⚠ Refuser avec motif ‹r›]        Commentaire interne (facultatif)  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Les cinq invariants du gabarit de décision, quelle que soit la file :**

1. **Tout ce qu'il faut pour décider est là.** Aucun renvoi vers un autre écran, aucune ouverture
   d'onglet (`13` RG32, `backoffice-ops` étape 1). Un agent qui ouvre trois onglets pour décider perd
   la moitié de sa journée.
2. **Deux boutons, et deux seulement.** Valider · Refuser avec motif. La **réattribution** est en
   haut à droite : elle n'est pas une issue de la file, l'entrée y reste (précision apportée à
   `13` RG38 — voir **I5** en §7).
3. **Refuser ouvre le sélecteur de motif** (§4.3) ; `‹r›` **n'a jamais refusé directement**
   (`15` RG114).
4. **Le message envoyé au membre est affiché avant la décision**, dans sa langue à lui (`15` RG7,
   RG124). Personne ne doit découvrir après coup ce qu'INFLUX a écrit en son nom.
5. **L'ouverture est journalisée** (`15` RG35, `13` RG34) — marqueur ▮ dans le titre, et une ligne
   sous le titre : « Consultation enregistrée : ⟨votre nom⟩, 19/09 09 h 42. »

### 2.6 Écran ④ — la sortie

Après enregistrement, **aucun retour à la liste** : l'entrée suivante de la file s'ouvre
automatiquement et se prend en charge. Un bandeau de confirmation reste 6 secondes minimum
(`15` RG117) au-dessus de la nouvelle entrée :

> ✓ **MER-2026-000124 validée.** Invitation envoyée à la marque et au créateur.
> `[· Voir l'entrée]` `[· Annuler l'enchaînement et revenir à la liste]`

Si la file est vide après la décision, l'état vide de §2.3 s'affiche avec le compte de la journée.

### 2.7 Le catalogue des 16 files, en tableau d'écran

Colonnes : ce que ce document fixe (colonnes visibles, filtres propres, actions). Les délais, motifs
et messages restent la propriété du document cité dans `15` RG29.

| # | File | Colonnes de liste (après les 3 communes : état · échéance · verrou) | Filtres propres | Issues | Action de masse |
|---|---|---|---|---|---|
| 1 | Profils marque à valider | Raison sociale *(depuis L2E, lue du bloc interne `profiles.advertiser_internal_details`, EC-L2C-3 ; le nom commercial reste le titre)* · pays · complétude · champs modifiés · responsable | Pays · première soumission / modification | Publier · Refuser (motifs `06`) | Non |
| 2 | Profils créateur à valider | Alias · pays · réseaux déclarés · complétude · badges | Pays · réseau · avec/sans badge | Publier · Refuser (motifs `07`) | Non |
| 3 | Visuels de portfolio à modérer | Vignette · alias · date de dépôt · nb de visuels du profil | Profil · type | Approuver · Refuser (motifs `07` RG97) | **Oui** — un seul profil, **20 max**, motif commun (M4) |
| 4 | Demandes de vérification et badge | **Deux sous-entrées : Vérifications créateurs · Vérifications marques** (D74) · niveau demandé · réseau · nombre de pièces *(L2E : aucun identifiant, chiffre ni code dans la liste, RG47)* | Niveau · réseau · population | Accorder · Refuser (motifs `08`) | Non |
| 5 | Contestations de badge | Alias · décision contestée · date · **décideur d'origine** | Type de décision | Confirmer · Infirmer (motifs `08` RG77) | Non |
| 6 | Identifiants modifiés à contrôler | Alias · ancien `@` · nouveau `@` · réseau · badge en cours | Réseau | Constater · Exiger une nouvelle preuve | Non |
| 7 | Campagnes à valider | Titre · marque · catégorie de produit · budget + devise · **⚑ revue renforcée** | Secteur sensible · marque · budget | Publier · Refuser (motifs `09` RG90) | Non |
| 8 | **Demandes de contact et candidatures** | Réf. `MER-…` · origine · marque · créateur · campagne · **⚑ les deux se sont cherchées** | Origine · campagne · marque · créateur vérifié | Valider · Refuser (liste A / `11` RG92) | **Interdite** |
| 9 | Sélection par l'équipe INFLUX | Marque · campagne · filtres de la recherche d'origine · budget | Campagne · marque | Prendre en charge et proposer · Refuser | Non |
| 10 | Signalements | Réf. fil · motif du signalement · signalant (rôle) · date | Motif · rôle du signalant | Décision typée (`12` RG84) | Non |
| 11 | Documents à contrôler | Vignette · libellé typé · réf. `MER-…` · déposant | Libellé · déposant | Mettre à disposition · Refuser (motif typé) | Non |
| 12 | Échecs de synchronisation | Destination (Brevo/Apollo) · **cause en clair** · tentatives · dernière tentative | Destination · cause · **« échec » / « cas normal »** | Rejouer · Classer | **Oui** — **200 max** (M1) |
| 13 | Adresses injoignables | Adresse (masquée partiellement) · type (rebond dur / signalement) · rôle · date | Type · rôle | Corriger l'adresse (`admin`) · Classer | Non |
| 14 | Demandes de données personnelles | Type · canal · date de réception · **⟨J-n⟩ avant échéance légale** · étape (1/7) | Type · canal · étape · échéance | Clore avec issue typée (`15` RG77) | Non |
| 15 | Actions en attente de seconde validation | Action · demandeur · **compte à rebours d'expiration 24 h** · portée | Type d'action · demandeur | Confirmer · Abandonner | Non |
| 16 | **Échecs d'envoi d'e-mails** | Envoi ou transactionnel · **cause en clair** · destinataires en échec · **⚑ AL10 si preuve de mise en relation** | Nature · cause · envoi | Rejouer · Classer | **Oui** — **200 max**, idempotent (`15` RG125, RG130) |

**Trois particularités d'écran, à ne pas « corriger » par mégarde** (`15` RG37, RG30) :

| File | Particularité | Traduction à l'écran |
|---|---|---|
| 8 `introductions` | Escalade `admin` à **J+1**, pas J+3 | Le groupe « Faire se rencontrer » est encadré au rail, et un hors délai y remonte au **bloc 8** du tableau de bord `admin` dès J+1 |
| 7 `campaigns` | **Deux délais** (1 j / 2 j en revue renforcée) | La colonne « Échéance » est la seule source de tri — c'est précisément pourquoi le tri est par échéance et non par ancienneté (**Q5**) |
| 12 et 16 | **Aucun verrou** | La colonne « Verrou » est remplacée par « Dernier rejeu — ⟨nom⟩, ⟨heure⟩ ». Le rejeu est idempotent : la concurrence y est inoffensive |

### 2.8 États du gabarit de file

| État | Liste | Écran de décision |
|---|---|---|
| **Chargement** | Squelette de 5 lignes à hauteur fixe, **aucune animation** (`15` RG118). Les compteurs de tête s'affichent en dernier, jamais un « 0 » trompeur | Titre et référence immédiats, blocs en squelette |
| **Vide** | §2.3, deux variantes | Sans objet |
| **Nominal** | §2.2 | §2.5 |
| **Erreur de chargement** | « La file n'a pas pu être chargée. ⟨cause en clair⟩ » + `[□ Réessayer]`. **Jamais une trace technique** (`15` CA74) | Idem, la prise en charge n'a **pas** eu lieu |
| **Accès refusé** | `bo.action.forbidden` — « Vous n'avez pas le droit d'effectuer cette action. La tentative a été enregistrée. » Message qui **nomme le rôle requis** (`15` CA5) | Idem |
| **Conflit d'intérêt** | L'entrée **est absente de la liste** (`15` RG36, CA19). Si l'agent l'atteint par son identifiant : « Vous êtes responsable de l'un des comptes concernés. Cette entrée doit être traitée par un collègue. » + `[· Réattribuer]` | Idem |
| **Succès** | Bandeau 6 s minimum, enchaînement automatique (§2.6) | Idem |

---

## 3. Écrans clés en détail

### 3.1 Décision sur une demande de contact ou une candidature

**Population et tâche.** Commercial, plusieurs dizaines de fois par jour. Décider en moins d'une
minute si deux parties doivent se rencontrer, sans ouvrir un autre écran. C'est la file qui porte le
chiffre d'affaires (`15` RG37).

**Structure de l'information** (imposée par `13` RG32, cinq blocs dans cet ordre) : ce qui situe →
qui est la marque → qui est le créateur → ce qui a été écrit → ce qui alerte, puis décider.

```
┌ MER-2026-000124 · Demande de contact · créée 19/09 08 h 12 Europe/Paris ───────────── ▮ ┐
│ ⏱ Échéance dans 6 h 40   Campagne : « ⟨titre⟩ » (CMP-2026-0412, publiée)                │
│ Vous avez pris cette entrée en charge à 09 h 42.  [· Je rends la main ‹l›] [· Réattribuer]│
│ ⓘ Consultation enregistrée : ⟨votre nom⟩, 19/09 09 h 42.                                │
├────────────────────────────────────────────┬────────────────────────────────────────────┤
│ ① LA MARQUE                                │ ② LE CRÉATEUR        ⬥ VUE IDENTIFIÉE      │
│ ⟨Raison sociale⟩ / ⟨nom commercial⟩        │ ⟨Nom réel⟩ — alias public ⟨alias⟩          │
│ FR · Mode · 11–50 salariés                 │ @⟨handle⟩ ⧉ · @⟨handle2⟩ ⧉                 │
│ ✓ Marque vérifiée — 04/07/2026             │ BE · Bruxelles                             │
│ Interlocuteur : ⟨Prénom Nom⟩, ⟨fonction⟩   │ ✓ Propriété de compte — 02/08/2026         │
│                                            │ ✓ Audience — 21/08/2026 (exp. 19/11)       │
│ ┌ Historique ─────────────────────────┐    │ ┌ Chiffres exacts ────────────────────┐    │
│ │ Mises en relation ouvertes      3   │    │ │ Instagram  84 210 ab.  mes. 21/08   │    │
│ │ Affaires signées                1   │    │ │            source : capture vérifiée│    │
│ │ Demandes refusées               2   │    │ │ TikTok     31 540 ab.  mes. 21/08   │    │
│ │ Taux d'acceptation             60 % │    │ │ Engagement 4,2 %       mes. 21/08   │    │
│ │ ⚑ Aucune alerte d'aspiration        │    │ └─────────────────────────────────────┘    │
│ └─────────────────────────────────────┘    │ ┌ Tarifs exacts ──────────────────────┐    │
│                                            │ │ Instagram · Post      450,00 EUR    │    │
│                                            │ │ Instagram · Story     180,00 EUR    │    │
│                                            │ │ TikTok · Vidéo        900,00 EUR    │    │
│                                            │ └─────────────────────────────────────┘    │
│                                            │ Disponible — déclaré le 12/09              │
│                                            │ Historique : 5 invitations, 4 réponses     │
├────────────────────────────────────────────┴────────────────────────────────────────────┤
│ ③ CE QUI A ÉTÉ ÉCRIT                                                     texte brut      │
│ ┌ Motif de la marque — 19/09 08 h 12 — CGU v1.2 acceptée le 19/09 ─────────────────────┐│
│ │ ⟨motivation intégrale, jamais tronquée, jamais rendue en HTML⟩                        ││
│ └───────────────────────────────────────────────────────────────────────────────────────┘│
│ Filtres de la recherche d'origine : Mode · Instagram · FR,BE · 50 k–100 k · 300–600 EUR  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ④ ALERTES                                                                                │
│ ⚑ Coordonnée détectée — type : numéro de téléphone · position : motif, caractères 88–98  │
│ ⓘ Chiffres périmés : non (mesure du 21/08, 29 jours)                                     │
│ ⓘ Écart tarifaire : tarif créateur 450,00 EUR dans la fourchette 300–600 EUR de la camp. │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ⑤ DÉCISION                                                                               │
│ Commentaire interne (facultatif, invisible du membre)  ┌──────────────────────────────┐  │
│                                                         │                              │  │
│                                                         └──────────────────────────────┘  │
│                       [■ Valider ‹v›]      [⚠ Refuser avec motif ‹r›]                    │
│ ⓘ Valider n'est pas révéler : les deux parties recevront une invitation. Rien ne sera    │
│   montré tant que les deux n'ont pas accepté.                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Variante étroite (1024–1280 px).** Les blocs ① et ② passent en accordéon vertical, ① replié par
défaut quand l'origine est une **candidature** (c'est le créateur qu'on examine) et ② replié quand
l'origine est une **demande de contact**. Le bloc ⑤ reste **collé en bas de fenêtre** : le bouton de
décision ne doit jamais demander un défilement.

**Le cas qui change tout : les deux parties se sont cherchées** (`13` RG33, RG43, RG44). Une
validation devient alors **révélante et irréversible**. L'écran change sur trois points :

```
│ ④ ALERTES                                                                                │
│ ⚑⚑ LES DEUX PARTIES SE SONT CHERCHÉES — la marque a demandé ce créateur et le créateur   │
│    a candidaté à cette campagne. Valider révélera immédiatement les deux identités.      │
…
│                  [■ Valider et révéler ‹v›]   [⚠ Refuser avec motif ‹r›]                 │
```

`‹v›` **n'exécute pas** : il ouvre le récapitulatif (`15` RG115, CA76).

```
┌ Confirmer une révélation d'identité ────────────────────────────────────────────────────┐
│ ⚠ CETTE ACTION EST IRRÉVERSIBLE : LES DEUX PARTIES VERRONT L'IDENTITÉ L'UNE DE L'AUTRE.  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Marque    ⟨raison sociale⟩ — l'interlocuteur ⟨Prénom Nom⟩ et ses coordonnées seront       │
│           communiqués au créateur.                                                       │
│ Créateur  ⟨nom réel⟩ / ⟨alias⟩ — ses pseudos, identifiants, liens et chiffres exacts     │
│           seront communiqués à la marque.                                                │
│ Campagne  « ⟨titre⟩ » (CMP-2026-0412)                                                    │
│ Effets    Une conversation à trois s'ouvre avec vous comme intermédiaire nommé.          │
│           Une affaire est créée à l'état « ouverte ».                                    │
│           Deux e-mails de confirmation partent, un par partie.                           │
│ Annuler ? Non. Une révélation ne s'annule jamais.                                        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                   [□ Revenir]   [⚠ Je confirme la révélation]            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Confirmation **tracée nominativement avec ses deux horodatages** (`13` RG44). Ce dialogue est le seul
du document où le bouton de droite est destructeur : partout ailleurs, la position de droite est la
position sûre. C'est assumé — ici, l'action **est** l'objectif de l'écran, et le récapitulatif l'a
déjà dite trois fois.

**Le refus** ouvre le sélecteur de motif typé (§4.3), qui affiche pour chaque motif **le message
envoyé à l'initiateur** et son caractère corrigible (`13` RG83).

**Microcopies**

| Clé | Français | English |
|---|---|---|
| `bo.introduction.validateNotReveal` | Valider n'est pas révéler : les deux parties recevront une invitation. Rien ne sera montré tant que les deux n'ont pas accepté. | Approving is not revealing: both parties will receive an invitation. Nothing is shown until both accept. |
| `bo.introduction.bothSought` | Les deux parties se sont cherchées — la marque a demandé ce créateur et le créateur a candidaté à cette campagne. Valider révélera immédiatement les deux identités. | Both parties reached out — the brand asked for this creator and the creator applied to this campaign. Approving will reveal both identities immediately. |
| `bo.reveal.irreversible` | Cette action est irréversible : les deux parties verront l'identité l'une de l'autre. | This action cannot be undone: both parties will see each other's identity. |
| `bo.reveal.confirm` | Je confirme la révélation | I confirm the reveal |
| `bo.alert.contactDetected` | Coordonnée détectée — type : {type} · position : {location}. | Contact details detected — type: {type} · location: {location}. |
| `bo.read.logged` | Consultation enregistrée : {agent}, {datetime}. | Access recorded: {agent}, {datetime}. |

**Tokens.** `color-surface-card` (blocs), `color-surface-raised` (encadrés d'historique),
`color-border-default`, `color-feedback-warning-*` (alertes), `color-feedback-error-*` (révélation),
`color-bo-identified-accent` **(nouveau, §6.2)**, `spacing-bo-cell-y/-x` **(nouveaux)**,
`text-sm` / `text-xs`, `font-variant-numeric-amount` sur tous les nombres.

**Accessibilité.** Cinq `<section aria-labelledby>` numérotées, ordre de tabulation = ordre de
lecture. Le récapitulatif de révélation est un `<dialog>` modal : focus piégé **volontairement** (le
seul de l'outil), `Échap` équivaut à `[□ Revenir]`, titre lu à l'ouverture. Les alertes du bloc ④
sont dans une `<ul>`, chacune avec un libellé écrit et un pictogramme `aria-hidden`.

---

### 3.2 La proposition INFLUX — l'écran le plus important du backoffice

> **C'est le geste métier central** (`13` §E, **A3bis**). Il doit être **au moins aussi rapide qu'un
> coup de fil**. S'il est plus lent, le commercial reprendra son téléphone et la trace n'existera
> pas — et sans trace, il n'y a ni preuve d'intermédiation, ni commission défendable.

**Population et tâche.** Commercial, depuis une campagne publiée : rapprocher 1 à 20 créateurs d'une
campagne, en un motif commun, sans quitter l'écran de recherche.

**Le chemin complet, et son décompte** (détail en §5) :

```
Campagne publiée
   │  [■ Proposer des créateurs]   ← 1 clic : ouvre la recherche identifiée pré-remplie
   ▼
Recherche en vue identifiée  (facettes pré-remplies depuis le brief, `10` RG73)
   │  cases à cocher sur les lignes            ← n clics de sélection (le travail réel)
   │  ─────────── à partir d'ici : 3 clics ───────────
   │  ① [■ Proposer à la campagne « ⟨titre⟩ » (5)]   → panneau latéral, sans rechargement
   │  ② motif commun (saisie) ou [▾ modèle enregistré]
   │  ③ [■ Envoyer les 5 propositions]
   ▼
Compte rendu immédiat : parties / non parties et pourquoi
```

**Le panneau latéral (clic ①), largeur 480 px, superposé à la recherche** — la recherche reste
visible derrière : le commercial voit encore qui il a coché.

```
┌ Proposer à une campagne ──────────────────────────────────────────── [✕ Échap] ┐
│                                                                                 │
│ CAMPAGNE       « ⟨titre⟩ » — ⟨raison sociale⟩ — CMP-2026-0412                   │
│                Publiée · candidatures jusqu'au 30/10 · 300–600 EUR par créateur │
│                                                                                 │
│ 5 CRÉATEURS SÉLECTIONNÉS                                      [· Tout retirer]  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ ⟨alias⟩ ✓ Audience   84 k · Mode · BE   450,00 EUR/post      [✕] [· Perso.]│ │
│  │ ⟨alias⟩ ✓ Propriété  52 k · Mode · FR   380,00 EUR/post      [✕] [· Perso.]│ │
│  │ ⟨alias⟩              31 k · Mode · FR   290,00 EUR/post      [✕] [· Perso.]│ │
│  │ ⟨alias⟩ ✓ Audience   67 k · Lifestyle·FR 500,00 EUR/post     [✕] [· Perso.]│ │
│  │ ⟨alias⟩ ✓ Audience   95 k · Mode · CH   620,00 EUR/post ⚑    [✕] [· Perso.]│ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│  ⚑ 1 tarif au-dessus de la fourchette de la campagne. Information, pas blocage. │
│  Plafond : 20 par envoi · 5 sélectionnés · 47 propositions restantes aujourd'hui│
│                                                                                 │
│ MOTIF COMMUN *                                       [▾ Reprendre un modèle]    │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ ⟨texte⟩                                                                     │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│  Minimum 10 caractères · ⟨n⟩ caractères saisis                                  │
│  ⓘ Ce motif sera lu par la marque et par chaque créateur, tel quel.             │
│  [· Personnaliser le motif pour un créateur] (replié)                           │
│                                                                                 │
│ ┌ CE QUI VA SE PASSER ─────────────────────────────────────────────────────────┐│
│ │ • 5 mises en relation distinctes seront créées, une par créateur.            ││
│ │ • Chaque partie recevra une invitation ; aucune identité ne sera révélée.    ││
│ │ • Vous en serez le commercial responsable.                                   ││
│ │ • Réversible : vous pouvez retirer une proposition tant qu'elle n'est pas    ││
│ │   révélée.                                                                    ││
│ └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│                        [□ Annuler]       [■ Envoyer les 5 propositions]         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Pourquoi ce panneau satisfait les six exigences d'une action de masse sans écran supplémentaire**
(`13` RG55, `15` RG88) :

| Exigence | Où elle est satisfaite |
|---|---|
| **Plafond** | Ligne « Plafond : 20 par envoi · 5 sélectionnés · 47 restantes aujourd'hui », **avant** la saisie, pas à l'envoi |
| **Aperçu** | Les 5 créateurs **nommés**, la campagne, la phrase « 5 mises en relation distinctes seront créées » |
| **Confirmation séparée** | Le bouton d'envoi est **en bas du panneau**, après le motif et l'encadré de conséquences — séparé du geste de sélection, qui a eu lieu dans la liste derrière |
| **Réversibilité annoncée** | Encadré « ce qui va se passer », dernière puce (`13` RG63) |
| **Échec partiel** | Compte rendu ci-dessous |
| **Journal** | Le lot porte un `proposal_batch_id` et une ligne de registre (`13` RG59) |

**Le compte rendu (après clic ③), en place du panneau, sans rechargement :**

```
┌ 4 propositions envoyées, 1 écartée ─────────────────────────────────── [✕] ┐
│ ✓ ENVOYÉES (4)                                                             │
│   MER-2026-000131  ⟨alias⟩      MER-2026-000132  ⟨alias⟩                   │
│   MER-2026-000133  ⟨alias⟩      MER-2026-000134  ⟨alias⟩                   │
│ ⚠ NON ENVOYÉE (1)                                                          │
│   ⟨alias⟩ — Une mise en relation est déjà en cours avec ce créateur sur    │
│             cette campagne.                            Non rejouable.      │
│ ⓘ Ce qui a réussi reste. Les 4 envois ne sont pas annulés.                 │
│              [□ Retour à la recherche]   [■ Voir les 4 mises en relation]  │
└────────────────────────────────────────────────────────────────────────────┘
```

Les cinq causes de rejet et leurs messages sont ceux de `13` RG60, repris **mot pour mot**, chacun
avec son caractère rejouable.

**Ce que l'écran ne fait jamais**

| Interdit | Raison |
|---|---|
| Demander une saisie **par destinataire** | `13` RG54 : la personnalisation existe, repliée, elle n'est pas sur le chemin |
| Afficher un motif de **blocage entre parties** ou qui l'a posé | `13` RG60, `04` §5.6. Le créateur bloqué apparaît **dans la recherche** avec un avertissement bloquant (`10` RG71), mais jamais la raison |
| Permettre une proposition **sans campagne publiée** | `13` RG52. Le bouton est **désactivé avec son motif écrit** — « Campagne en attente de validation : publication requise avant toute proposition » — jamais absent sans explication |
| Révéler quoi que ce soit | `13` RG58. `identity_revealed_at` n'est jamais posé ici |
| Renouveler une proposition refusée sur la même campagne | `13` RG64. La ligne est **visible, désactivée, motivée** : « Refusée le 04/09 sur cette campagne. Un administrateur peut autoriser un renouvellement. » |

**États**

| État | Comportement |
|---|---|
| Chargement de la recherche | Facettes pré-remplies affichées **immédiatement** (elles viennent du brief, pas du serveur de recherche) ; résultats en squelette |
| Sélection vide | Le bouton « Proposer… » est désactivé **avec son libellé** : « Sélectionnez au moins un créateur » |
| Plafond journalier atteint | Bouton désactivé, message : « Vous avez atteint votre plafond de 60 propositions aujourd'hui. Il se réinitialise demain. » Le plafond est en table (`15` RG104) |
| Motif trop court | Bouton d'envoi désactivé, compteur de caractères en rouge **et** message écrit « Minimum 10 caractères » |
| Envoi en cours | Bouton en état « Envoi… », panneau verrouillé, **aucune animation décorative** |
| Échec total (réseau) | Le panneau reste ouvert **avec la saisie intacte** (`15` RG116) : « Aucune proposition n'est partie. ⟨cause⟩ » + `[□ Réessayer]` |
| Accès refusé | Message nommant le rôle requis, tentative journalisée |

**Microcopies**

| Clé | Français | English |
|---|---|---|
| `bo.proposal.willCreate` | {count, plural, one {# mise en relation distincte sera créée.} other {# mises en relation distinctes seront créées, une par créateur.}} | {count, plural, one {# separate introduction will be created.} other {# separate introductions will be created, one per creator.}} |
| `bo.proposal.reasonHint` | Ce motif sera lu par la marque et par chaque créateur, tel quel. | This note will be read by the brand and by each creator, exactly as written. |
| `bo.proposal.reversible` | Réversible : vous pouvez retirer une proposition tant qu'elle n'est pas révélée. | Reversible: you can withdraw a proposal as long as nothing has been revealed. |
| `bo.proposal.partialResult` | {sent} envoyée(s), {skipped} écartée(s). Ce qui a réussi reste. | {sent} sent, {skipped} skipped. What succeeded stays. |
| `bo.proposal.capDaily` | Vous avez atteint votre plafond de {cap} propositions aujourd'hui. Il se réinitialise demain. | You have reached your cap of {cap} proposals for today. It resets tomorrow. |
| `bo.proposal.campaignNotPublished` | Campagne {status} : la publication est requise avant toute proposition. | Campaign {status}: it must be published before any proposal. |

**Accessibilité.** Le panneau est un `<dialog>` non modal ancré à droite : le focus y va à
l'ouverture, `Échap` le ferme **en conservant la saisie**, et le focus revient sur le bouton
d'origine. La liste des sélectionnés est une `<ul>` ; chaque `[✕]` porte un nom accessible
« Retirer ⟨alias⟩ de la sélection ». Le compte rendu est annoncé par `role="status"`. Le compteur de
caractères est relié au champ par `aria-describedby`, jamais par la seule couleur.

---

### 3.3 La recherche de créateurs en vue identifiée

**Population et tâche.** Commercial, plusieurs fois par jour : trouver les bons créateurs pour une
campagne — et c'est de là que part la proposition INFLUX.

**Le point de conception le plus important : distinguer visuellement la vue identifiée de la vue
marque.** Un commercial partage son écran avec une marque, ou en envoie une capture. Si les deux
vues se ressemblent, un `@` ou un nom réel finit dans une messagerie externe, et **A2**, **D16** et
le modèle économique tombent d'un coup (`10` RG80).

**Le marqueur de vue identifiée** (composant transverse, §4.9) : une **barre verticale pleine à
gauche de l'écran**, `color-bo-identified-accent`, plus un chapeau écrit :

```
┃ ⬥ VUE IDENTIFIÉE — vous voyez les noms, pseudos, liens et chiffres exacts.
┃    La marque ne voit rien de tout cela. Vos recherches et consultations sont journalisées.
```

Forme + texte + couleur : trois porteurs pour une seule information, parce que c'est la plus
coûteuse à manquer (`15` RG119).

```
┃┌ Créateurs › Recherche ─────────────────────────────── ⬥ VUE IDENTIFIÉE ──────▮──┐
┃│ Pré-rempli depuis « ⟨titre campagne⟩ » (CMP-2026-0412)   [· Vider le pré-remplissage]│
┃├──────────────────────────────────────────────────────────────────────────────────┤
┃│ FACETTES                    │ 38 créateurs · trié par pertinence  [▾ Trier]       │
┃│ Thématiques  [Mode ✕]       │ ☐ tout  (0 sélectionné / 20 max)                    │
┃│ Réseaux      [Instagram ✕]  │ ┌──┬────────────┬──────┬────────┬───────┬─────────┐ │
┃│ Pays audience[FR ✕][BE ✕]   │ │☐ │ Créateur   │ Audi.│ Tarif  │ Badges│ État    │ │
┃│ Langues      [FR ✕]         │ ├──┼────────────┼──────┼────────┼───────┼─────────┤ │
┃│ Tarif        300 – 600 EUR  │ │☑ │⟨nom réel⟩  │84 210│450,00  │✓Audi. │ publié  │ │
┃│ Droits       [6 mois ✕]     │ │  │@handle ⧉   │      │EUR/post│✓Prop. │         │ │
┃│ Exclusivité  [Non ✕]        │ ├──┼────────────┼──────┼────────┼───────┼─────────┤ │
┃│ ─── facettes internes ───   │ │☐ │⟨nom réel⟩  │52 340│380,00  │✓Prop. │ ⚠ brouil│ │
┃│ G1 État du profil  [tous]   │ │  │@handle ⧉   │      │EUR/post│       │ lon     │ │
┃│ G2 Responsable     [tous]   │ ├──┼────────────┼──────┼────────┼───────┼─────────┤ │
┃│ G3 Dernière activité        │ │⊘ │⟨nom réel⟩  │95 100│620,00  │✓Audi. │ ⛔ blocage│ │
┃│ …                           │ │  │ Vous ne pouvez pas proposer ce créateur à     │ │
┃│ [· Réinitialiser]           │ │  │ cette marque.                                 │ │
┃│                             │ └──┴────────────┴──────┴────────┴───────┴─────────┘ │
┃│                             │ page 1/2 · 20 par page      [· Page suivante]       │
┃├──────────────────────────────────────────────────────────────────────────────────┤
┃│ 3 sélectionnés          [■ Proposer à la campagne « ⟨titre⟩ » (3)]                │
┃└──────────────────────────────────────────────────────────────────────────────────┘
```

**Les cinq différences avec la vue marque** (`10` RG71), et comment chacune se voit à l'écran :

| Différence | Traduction visuelle |
|---|---|
| **Identités visibles** | Nom réel **et** alias sur deux lignes ; `@handle` cliquable vers le réseau, marqué `⧉` (ouvre hors INFLUX) |
| **Pas de k-anonymat** | Aucun message « trop peu de profils » ; le compteur de résultats est exact |
| **Profils non publiés visibles** | Colonne « État » : `publié` · `⚠ brouillon` · `⚠ en attente` · `⚠ refusé` · `⛔ suspendu`. Une ligne non publiée est **sélectionnable** mais l'envoi l'écartera avec son message (`13` RG60) — on préfère un compte rendu explicite à une case grisée sans raison |
| **Blocage affiché avec avertissement** | Ligne `⊘`, case **désactivée**, phrase « Vous ne pouvez pas proposer ce créateur à cette marque. » — **sans jamais le motif ni qui l'a posé** |
| **Sélection multiple ≤ 20** | Compteur « 0 sélectionné / 20 max » en tête de tableau, et barre d'action collée en bas |

**Ce que la vue identifiée n'a pas, et ne doit jamais avoir :**

| Absent | Raison |
|---|---|
| **Tout export** | `10` RG76. Un export industrialiserait le contournement en une action — y compris par un salarié qui part. Un besoin réel passe par une demande administrative motivée, traitée **hors application** |
| **Défilement infini** | `15` RG34. Pagination à 20, plafonnée serveur |
| **Sélection « tout cocher sur toutes les pages »** | La case `☐ tout` ne coche **que la page affichée**, et jamais au-delà du plafond de 20 |

**Explications de tri.** La vue identifiée affiche **les mêmes explications que la marque**
(`10` RG77), plus les valeurs exactes sous-jacentes. Sous chaque ligne, repliée : « Proposé parce
que : thématique Mode · audience FR 62 % · tarif dans la fourchette · actif il y a 4 jours. » Le
commercial doit voir **ce que la marque voit**, sinon son argumentaire contredira la carte.

**Journalisation.** `10` RG78 : recherches et consultations journalisées nominativement. Le chapeau
le dit ; le marqueur ▮ figure dans le titre. Au-delà du seuil de fiches distinctes consultées sur
24 h, **AL21** s'ouvre à l'`admin` (`15` RG50).

**États**

| État | Comportement |
|---|---|
| Chargement | Facettes immédiates, tableau en squelette à hauteur fixe |
| Aucun résultat | « Aucun créateur ne correspond. » + **les trois facettes les plus restrictives nommées**, chacune avec `[· Retirer]`. Jamais une page blanche |
| Pré-remplissage sans campagne | Recherche libre, chapeau « Aucune campagne sélectionnée — la proposition sera indisponible » + `[· Choisir une campagne]` |
| Service de recherche indisponible | « La recherche est indisponible. ⟨cause en clair⟩ » ; les facettes restent saisies |
| Accès refusé | Un rôle non interne n'atteint jamais cet écran ; contrôle **côté serveur**, pas par masquage (`15` RG2) |

**Tokens.** `color-bo-identified-accent` **(nouveau)**, `color-bo-row-hover` **(nouveau)**,
`spacing-bo-cell-y`, `spacing-bo-cell-x` **(nouveaux)**, `color-feedback-warning-*` (états non
publiés), `color-feedback-error-*` (blocage), `color-surface-card`, `radius-sm`.

**Accessibilité.** Tableau sémantique `<table>` avec `<th scope="col">` ; la case de sélection porte
un nom accessible « Sélectionner ⟨alias⟩ ». Les états `⚠`/`⛔` sont des **textes**, pas des
pictogrammes seuls. La barre d'action basse est un `role="region" aria-label="Sélection"` annoncée à
chaque changement de compte. `‹espace›` coche la ligne focalisée, `‹j›`/`‹k›` naviguent.

---

### 3.4 La conversation à trois, vue backoffice

**Population et tâche.** Commercial **participant** : conduire la négociation, plusieurs fois par
jour. Commercial **non participant** ou `admin` : lire pour une raison précise, rarement.

**Le principe de conception.** `12` RG55 : **il n'existe aucun chemin de lecture non journalisé.**
Ce n'est pas une politesse d'interface, c'est le cœur du dispositif **A10**. L'écran doit donc faire
deux choses en même temps : **ne mettre aucune friction** sur le geste quotidien du participant, et
**rendre visible et préalable** le motif du non-participant.

#### 3.4.a Porte d'entrée — le motif préalable (non-participant uniquement)

`12` RG57 : le motif est demandé **avant** l'affichage du moindre message. Un motif choisi après
coup ne vaut rien.

```
┌ Lire une conversation à laquelle vous ne participez pas ──────────────────┐
│ MER-2026-000118 · ⟨raison sociale⟩ ↔ ⟨alias créateur⟩                     │
│ Commercial responsable : ⟨Prénom Nom⟩                                     │
├───────────────────────────────────────────────────────────────────────────┤
│ ⓘ Cette lecture sera enregistrée : votre nom, la date, le motif choisi,   │
│   le nombre de messages affichés. Le commercial responsable ne le voit    │
│   pas ; un administrateur, oui.                                           │
│                                                                           │
│ Motif de lecture *                                                        │
│  ( ) Continuité de service — le responsable est absent                    │
│  ( ) Reprise de dossier — réattribution en cours                          │
│  ( ) Instruction d'un signalement                                         │
│  ( ) Litige ou contestation                                               │
│  ( ) Contrôle qualité — revue interne d'échantillon                       │
│  ( ) Demande relative aux données personnelles                            │
│  ( ) Autre — commentaire obligatoire                                      │
│      ┌───────────────────────────────────────────────────────────────┐    │
│      └───────────────────────────────────────────────────────────────┘    │
│                                        [□ Renoncer]  [■ Ouvrir le fil]    │
└───────────────────────────────────────────────────────────────────────────┘
```

Les sept motifs sont ceux de `12` RG56, **liste fermée**. `suivi_de_l_affaire` **n'y figure pas** :
il est réservé au participant et retenu automatiquement, sans écran.

> **Précision de conception.** Le bouton qui mène ici s'appelle partout
> **« Lire ce fil (lecture journalisée) »** (`15` RG124, `bo.conversation.readLogged`) — sur la
> fiche de compte, sur la fiche d'affaire, dans la file des signalements. Le même libellé partout :
> c'est ce qui fait qu'on ne l'ouvre pas par distraction.

#### 3.4.b Le fil

```
┌ MER-2026-000118 · Conversation ──────────────────────────────────────── ▮ ┐
│ ⟨raison sociale⟩  ·  ⟨alias⟩ / ⟨nom réel⟩  ·  INFLUX ⟨Prénom Nom⟩ (vous)   │
│ Révélée le 12/09 14 h 02 · Affaire : négociation · 2 400,00 EUR            │
│ [· Voir l'affaire] [· Ajouter un agent] [⚠ Clore le fil]                   │
├────────────────────────────────────────────────────────────────────────────┤
│  ⓘ Lecture enregistrée : ⟨votre nom⟩, motif « suivi de l'affaire », 19/09. │
├────────────────────────────────────────────────────────────────────────────┤
│  ── 12/09 ──                                                               │
│  ⚙ Système · La mise en relation est ouverte. ⟨Prénom Nom⟩ (INFLUX) suit   │
│    cette conversation.                                                     │
│                                                                            │
│  ⟨raison sociale⟩ · 12/09 14 h 20                                          │
│  ┌───────────────────────────────────────────────────────┐                 │
│  │ ⟨texte brut, jamais rendu en HTML⟩                     │                 │
│  └───────────────────────────────────────────────────────┘                 │
│                                                                            │
│                       ⟨alias⟩ · 13/09 09 h 05                              │
│                     ┌───────────────────────────────────────────────────┐  │
│                     │ ⟨texte brut⟩                                       │  │
│                     │ ⚑ Coordonnée détectée — type : e-mail, car. 42–61  │  │
│                     └───────────────────────────────────────────────────┘  │
│                                                                            │
│           INFLUX · ⟨Prénom Nom⟩ · 13/09 09 h 40      ⬥ visible des deux    │
│         ┌────────────────────────────────────────────────────────────┐     │
│         │ ⟨texte brut⟩                                                │     │
│         └────────────────────────────────────────────────────────────┘     │
├────────────────────────────────────────────────────────────────────────────┤
│ Écrire — votre message est visible de la marque ET du créateur.            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ [· Note interne sur l'affaire ‹n›]                        [■ Envoyer]      │
└────────────────────────────────────────────────────────────────────────────┘
```

| Point de conception | Règle |
|---|---|
| **Trois auteurs, trois alignements** | Marque à gauche, créateur à droite, **INFLUX centré** avec la mention « ⬥ visible des deux ». Le commercial est un **participant de première classe, visible et nommé** (`13` RG74-3), pas un modérateur invisible |
| **Aucun rendu HTML** | `15` RG13, CA80. Texte brut, `react/no-danger` en erreur. C'est le scénario d'attaque le plus rentable contre INFLUX |
| **Coordonnées détectées** | Affichées **sous** le message, en clair, avec **type et position** — jamais une copie du texte détecté (`13` RG33). **Aucun masquage, aucun blocage, aucune sanction automatique** (`15` CA45) |
| **Aucun accusé de lecture agent** | `12` RG54 : la lecture d'un agent n'est pas montrée aux parties |
| **Note interne ≠ message** | Deux affordances nettes et deux couleurs de champ. Une note ne part jamais dans le fil (`15` RG46). `‹n›` ouvre la note, jamais le message |
| **Documents** *(si le canal est retenu, `12` Q5)* | Onglet distinct « Documents », jamais dans le flux (`12` RG66). Un document non contrôlé n'apparaît **que** pour son déposant |

#### 3.4.c Ajouter un agent au fil

```
┌ Ajouter un agent à cette conversation ────────────────────────────┐
│ Agent  [▾ ⟨liste des comptes internes actifs⟩]                     │
│ Motif  [▾ continuité de service · reprise de dossier · litige ·   │
│          contrôle qualité · autre]                                 │
│ ⓘ Les deux parties verront un message système nommant l'agent      │
│   ajouté. On n'ajoute jamais un interlocuteur en silence.          │
│                              [□ Annuler]  [■ Ajouter]              │
└────────────────────────────────────────────────────────────────────┘
```

Un ajout **produit un message système nommé** dans le fil, comme une réattribution (`13` RG48,
`15` RG59). Les deux parties ne découvrent jamais un nouvel interlocuteur par hasard.

#### 3.4.d Journal des lectures (vue `admin`)

Sous Administration › Registre › Lectures de conversations. Colonnes : agent · rôle · date ·
conversation · **motif** · participant au moment de la lecture (oui/non) · écran d'origine · nombre
de messages renvoyés (`12` RG58). Jamais le contenu, jamais un extrait.

> **La consultation du classement des agents par nombre de fils lus est elle-même journalisée**
> (`15` RG23, CA9). L'écran le dit en tête : « Cette consultation est enregistrée. » Sinon le
> contrôleur échappe au contrôle.

**États.** Fil vide après révélation : « La conversation est ouverte. Personne n'a encore écrit. »
+ suggestion d'un premier message d'ouverture par le commercial. Écriture fermée (blocage ou
suspension) : bandeau « L'écriture est fermée pour ⟨partie⟩. La lecture reste possible. » **sans
divulguer le motif** (`15` RG54). Fil clos : bandeau avec motif de clôture et date, champ de saisie
absent (pas grisé).

**Microcopies**

| Clé | Français | English |
|---|---|---|
| `bo.conversation.readReasonRequired` | Choisissez un motif avant d'ouvrir ce fil. | Choose a reason before opening this thread. |
| `bo.conversation.readWillBeLogged` | Cette lecture sera enregistrée : votre nom, la date, le motif choisi, le nombre de messages affichés. | This read will be recorded: your name, the date, the reason you pick, and how many messages are shown. |
| `bo.conversation.visibleToBoth` | Votre message est visible de la marque ET du créateur. | Your message is visible to both the brand and the creator. |
| `bo.conversation.agentAdded` | {agent} (INFLUX) rejoint cette conversation. | {agent} (INFLUX) has joined this conversation. |
| `bo.conversation.writeClosed` | L'écriture est fermée pour {party}. La lecture reste possible. | Writing is closed for {party}. Reading is still possible. |

---

### 3.5 Fiche de compte marque

**Population et tâche.** Commercial, avant un appel : savoir à qui il parle. `15` RG39 : **trois
fiches distinctes, jamais fusionnées.**

```
┌ Comptes › ⟨Raison sociale⟩ ──────────────────────────────────────────── ▮ ─┐
│ ⟨Logo⟩  ⟨RAISON SOCIALE⟩ / ⟨nom commercial⟩   ✓ Marque vérifiée 04/07/2026 │
│         FR · français · ⬤ Actif · inscrite 12/03/2026 · vue il y a 2 h     │
│         Commercial responsable : ⟨Prénom Nom⟩ [· Réattribuer] [· Historique]│
│         [⚠ Suspendre]                                                       │
│ ⓘ Consultation enregistrée : ⟨votre nom⟩, 19/09 10 h 04.                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ② INTERLOCUTEUR                                    ⬥ visible des seuls      │
│    ⟨Prénom Nom⟩ — ⟨fonction⟩                          rôles internes        │
│    ⟨e-mail⟩ · ⟨téléphone⟩ · ⟨page de contact⟩                               │
│    ⓘ Le créateur ne voit ces coordonnées qu'après ouverture d'une mise en   │
│      relation (D40).                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ③ PROFIL   publié · complétude 82 % · 2 champs modifiés depuis validation   │
│    Historique des décisions : publié 14/03 par ⟨agent⟩ · refusé 12/03       │
│    (motif : ⟨libellé⟩) par ⟨agent⟩                            [· Détail]    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ④ CAMPAGNES (4)                                                             │
│    CMP-…0412 « ⟨titre⟩ »  publiée 02/09  12 candidatures  ⟨resp.⟩           │
│    CMP-…0388 « ⟨titre⟩ »  publiée 28/08   0 candidature   ⚑ 7 jours sans    │
│                                                             candidature     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⑤ MISES EN RELATION (7)   réf · origine · état · révélée le · créateur · resp.│
│ ⑥ AFFAIRES (3)                                                              │
│    ┌──────────┬────────────┬──────────────┬──────────────┬──────────────┐   │
│    │ Réf.     │ État       │ Montant      │ Commission   │ Commission   │   │
│    │          │            │ négocié      │ convenue     │ encaissée    │   │
│    ├──────────┼────────────┼──────────────┼──────────────┼──────────────┤   │
│    │ MER-…118 │ signée     │ 2 700,00 EUR │   700,00 EUR │   700,00 EUR │   │
│    │ MER-…121 │ négociation│ 1 800,00 EUR │            — │            — │   │
│    │ MER-…094 │ signée     │ 1 200,00 GBP │   300,00 GBP │     0,00 GBP │   │
│    └──────────┴────────────┴──────────────┴──────────────┴──────────────┘   │
│    ⓘ Montants présentés par devise, sans conversion.   [· Historique des    │
│                                                          modifications]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⑦ CONVERSATIONS (5)  réf · état · dernier message · participants            │
│    [· Lire ce fil (lecture journalisée)] par ligne                          │
│ ⑧ CONSENTEMENT ET SYNCHRONISATION                                           │
│    Marketing : accordé le 12/03/2026 · source : formulaire d'inscription    │
│    Brevo  ✓ synchronisé 12/03 14 h 22                                       │
│    Apollo ⚠ échec — « clé d'accès refusée par Apollo »       [· Rejouer]    │
│    ⓘ Un rôle interne ne modifie jamais le consentement d'un membre.         │
│ ⑨ NOTES INTERNES                                                            │
│    ⓘ Cette note peut être communiquée à la personne concernée si elle       │
│      exerce son droit d'accès.                                              │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                      [■ Ajouter la note]    │
│    ⟨note⟩ — ⟨Prénom Nom⟩, 14/09 11 h 02   (immuable)                        │
│ ⑩ JOURNAL DU COMPTE       [▾ type d'événement]  [▾ période]                 │
│ ⑪ DONNÉES PERSONNELLES    demandes · sessions actives · CGU v1.2 le 12/03   │
└─────────────────────────────────────────────────────────────────────────────┘
```

Les onze blocs sont **dans l'ordre imposé** par `15` RG41. Points de conception :

| Point | Règle |
|---|---|
| **Les trois montants côte à côte, jamais mélangés dans une colonne** | `15` RG5, RG19. Trois en-têtes distincts, devise sur **chaque** cellule, aucun total de colonne toutes devises |
| **Aucun net créateur, aucun pourcentage** | `15` RG4. Voir l'incohérence **I3** en §7 |
| **Avertissement de communicabilité au-dessus du champ de note** | `15` RG48, CA26. Au-dessus, jamais en dessous, jamais en infobulle : c'est la seule façon d'éviter les notes que personne n'assumerait |
| **Note immuable** | `15` RG45, CA25. Aucun bouton modifier ni supprimer n'existe — pas de bouton grisé : l'absence est la règle |
| **Cause de synchronisation en clair** | `05` RG99. « clé d'accès refusée par Apollo », jamais `HTTP 401 unauthorized` |
| **Correction d'un champ** | Chaque champ modifiable porte `[· Corriger]`, qui ouvre un panneau **motif typé + ancienne valeur affichée + mention « le membre en sera informé »** (`15` RG44, CA28) |
| **Historique des responsables** | `15` RG49, CA29 : `[· Historique]` liste les responsables successifs avec leurs dates. Rien n'est écrasé |

**Ce que la fiche ne montre jamais** (`15` RG43) : code de connexion, mot de passe, contenu d'un
message, donnée enrichie par Apollo, motif de suspension d'un **autre** compte, note portant sur un
tiers. Et, conformément à `15` RG123, **quand une donnée est volontairement masquée, l'écran le
dit** : « Les données d'enrichissement Apollo ne sont pas affichées dans INFLUX. »

---

### 3.6 Fiche de compte créateur

Même gabarit, **contenu et vocabulaire propres** (`15` RG42). Les différences qui comptent :

```
┌ Comptes › ⟨alias⟩ ──────────────────────────────── ⬥ VUE IDENTIFIÉE ── ▮ ─┐
│ ⟨Alias public⟩ — ⟨nom réel⟩                                                │
│ @⟨handle⟩ ⧉ · @⟨handle2⟩ ⧉ · BE · français · ⬤ Actif                       │
│ ✓ Propriété de compte 02/08/2026   ✓ Audience 21/08/2026 (expire 19/11) ⚑  │
│ Commercial responsable : ⟨Prénom Nom⟩                                      │
├────────────────────────────────────────────────────────────────────────────┤
│ ② RÉSEAUX ET AUDIENCE                                                      │
│    ┌───────────┬────────┬─────────┬─────────┬──────┬──────────┬──────────┐ │
│    │ Réseau    │ Abonnés│ Publ/30j│ Comm/pub│ Eng. │ Mesure   │ Source   │ │
│    ├───────────┼────────┼─────────┼─────────┼──────┼──────────┼──────────┤ │
│    │ Instagram │ 84 210 │      14 │     137 │4,2 % │ 21/08/26 │ constaté │ │
│    │ TikTok    │ 31 540 │      22 │     412 │6,1 % │ 21/08/26 │ constaté │ │
│    └───────────┴────────┴─────────┴─────────┴──────┴──────────┴──────────┘ │
│    Les trois premières colonnes sont les métriques prioritaires (D61).     │
│    [· Historique des métriques] : évolution datée, sourcée (07 RG119).     │
│    ⓘ Chaque chiffre porte sa date de mesure et sa source. Un chiffre sans  │
│      date n'est pas une donnée, c'est une affirmation.                     │
│ ③ TARIFS   (réseau, format) → montant exact + devise                       │
│ ④ PORTFOLIO   12 visuels · 2 en attente de modération   [· Ouvrir la file] │
│ ⑤ PIÈCES DE VÉRIFICATION                                              ▮    │
│    ⓘ Chaque consultation est enregistrée individuellement.                 │
│    [· Ouvrir la pièce 1 (consultation journalisée)]                        │
│ ⑥ CANDIDATURES · ⑦ MISES EN RELATION · ⑧ AFFAIRES · ⑨ CONVERSATIONS        │
│ ⑩ CONSENTEMENT ET SYNCHRONISATION · ⑪ NOTES · ⑫ JOURNAL · ⑬ DONNÉES PERS.  │
└────────────────────────────────────────────────────────────────────────────┘
```

| Point de conception | Règle |
|---|---|
| **Marqueur de vue identifiée** | La fiche créateur est la surface la plus sensible du backoffice après la conversation : nom réel, `@`, chiffres exacts, tarifs exacts. Barre + chapeau (§4.9) |
| **Pièces de vérification** | **Relayées par l'API, jamais par une URL signée remise au navigateur** (`03` C(13), C(14), BO-5). **Chaque consultation est journalisée séparément** — pas une fois pour la fiche : le bouton porte donc « (consultation journalisée) » sur **chaque** pièce |
| **Badge à échéance** | `⚑` + libellé écrit « expire le 19/11 » ; à J-15, AL14 s'ouvre |
| **Aucun blanchiment de chiffre** | Les tranches de la vue marque n'apparaissent pas ici : la fiche interne montre les valeurs exactes, avec leur source (`10` RG71) |
| **Badges** *(L2F)* | Bloc « Badges » (`AccountBadgesBlock`) : niveau, réseau, état écrit, date (« expire le », « échéance dépassée », « retiré le », « sans échéance » pour Compte vérifié), motif d'un retrait exécuté, demande 2V vivante, contestation ; jamais un chiffre ni un identifiant de réseau. `[· Demander le retrait]` : motif du niveau, message au membre exigé pour `terms_breach`, récapitulatif ; l'envoi n'ouvre que la 2V. `[· Lancer la vérification]` (D83) : motif fermé, commentaire interne, niveaux « Compte vérifié » et « Marque vérifiée » seuls ; le membre est prévenu par e-mail |

*Amendé à la clôture de L2G : blocs ②, ③ et ④ en service. ② lit les chiffres exacts du badge d'audience tenant, sinon déclarés, avec date et source (jamais pseudo, lien ni tranche) ; ③ dit « aucun tarif » (D78) ; ④ donne le compte de visuels, ceux en attente et le lien `/files/visuels?account=`. Toute lecture de la fiche est couverte par la ligne `history.account_read`.*

**États communs aux deux fiches**

| État | Comportement |
|---|---|
| Chargement | En-tête immédiat (identité, état, responsable) ; blocs en squelette, dans l'ordre |
| Profil jamais soumis | Blocs vides **explicitement étiquetés** « non renseigné », jamais une erreur (`15` cas limite 1) |
| Sans commercial responsable | Bandeau « Aucun commercial responsable » + `[■ M'attribuer ce compte]`, et remontée en alerte |
| Compte suspendu | Bandeau permanent : état, motif **interne**, auteur, date, `[· Lever la suspension]` **visible du seul `admin`** |
| Compte supprimé / anonymisé | Fiche en lecture seule, mention « Compte supprimé le ⟨date⟩ — les affaires, mises en relation et le registre sont conservés sous forme pseudonymisée » (`15` RG80) |
| Service externe indisponible | Bloc 8 : « information indisponible — dernière valeur connue à ⟨heure⟩ », **jamais un zéro trompeur** (`15` cas limite 6) |

---

### 3.7 Vérification d'un profil et attribution du badge

**Population et tâche.** Commercial, file 4, plusieurs fois par jour. Constater une preuve, puis
accorder ou refuser. **Deux sous-entrées du rail — Vérifications créateurs · Vérifications marques —
jamais un écran mixte** (`08` RG61 ; sous-entrées plutôt qu'onglets depuis D74, 2026-10-29).

```
┌ VER-2026-000214 · Vérification Instagram · Niveau 2 : Audience ─────── ▮ ──┐
│ ⏱ Échéance dans 5 h 10 · Vous avez pris cette entrée en charge à 10 h 12.  │
├────────────────────────────────────────────────────────────────────────────┤
│ ① LA DEMANDE                                                               │
│    Créateur ⟨alias⟩ / ⟨nom réel⟩ · BE · inscrit 02/06                      │
│    Réseau Instagram · @⟨handle⟩ ⧉      Déposée 18/09 16 h 40               │
│    Badge déjà détenu : ✓ Propriété de compte (02/08/2026)                  │
├────────────────────────────────────────────────────────────────────────────┤
│ ② LES PIÈCES                                                          ▮    │
│    ⓘ Chaque ouverture est enregistrée individuellement.                    │
│    [· Ouvrir la pièce 1/2 (journalisée)]  [· Ouvrir la pièce 2/2]          │
│    ┌ Ce qu'il faut constater ──────────────────────────────────────────┐   │
│    │ 1. La capture montre le tableau de bord du réseau, pas un partage.│   │
│    │ 2. La période affichée est ≤ 30 jours et lisible.                 │   │
│    │ 3. L'identifiant visible correspond à @⟨handle⟩.                  │   │
│    └───────────────────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────────────┤
│ ③ CE QUE JE CONSTATE  (saisi par l'agent, jamais pré-rempli)               │
│    LES 3 CHIFFRES PRIORITAIRES (D61), dans cet ordre                       │
│    1. Abonnés constatés *          [        ]  ⓘ lus sur la pièce          │
│       Période affichée *           du [      ] au [      ]                 │
│    2. Publications 30 derniers j.* [        ]  ⓘ profil public, ni         │
│                                                  stories ni directs        │
│    3. Commentaires moyens *        [        ]  ⓘ 12 dernières publ.,       │
│                                                  hors jeux-concours        │
│    [· Ouvrir le profil public ⧉]   Date du constat : aujourd'hui (auto)    │
│    Engagement constaté (fac.)      [        ] %                            │
│    Déclaré par le créateur : 86 000 abonnés · 14 publ. · 137 comm.         │
│    → écarts : affichés après la saisie, jamais avant                       │
├────────────────────────────────────────────────────────────────────────────┤
│ ④ DÉCISION                                                                 │
│    [■ Accorder le badge Audience ‹v›]     [⚠ Refuser avec motif ‹r›]       │
│    ⓘ Le badge Audience expire 90 jours après la date de décision          │
│      (19/11/2026). Le créateur sera prévenu à J-15.                        │
│    ⓘ Ce badge n'affirme ni l'authenticité des abonnés, ni la performance.  │
└────────────────────────────────────────────────────────────────────────────┘
```

| Point de conception | Raison |
|---|---|
| **Le champ « ce que je constate » n'est jamais pré-rempli** avec la valeur déclarée | Pré-remplir, c'est faire valider ce que le créateur affirme au lieu de constater ce que la pièce montre. L'écart s'affiche **après** la saisie, jamais avant |
| **La procédure de constat est sur l'écran**, en trois lignes | Un agent qui doit se souvenir d'une procédure l'applique différemment un lundi et un vendredi |
| **La péremption est annoncée au moment de l'octroi** | `08` RG70, AL14 : personne ne doit découvrir l'expiration |
| **Le rappel de ce que le badge n'affirme pas** | **D34** ouverte. Tant qu'elle ne l'est pas, l'écran porte la formulation conservatrice |
| **Deux issues, pas trois** | `15` RG27 C6 — voir l'incohérence **I2** en §7, qui porte sur la troisième issue « à réexaminer » |

**Refus** : sélecteur de motif typé (§4.3) avec, pour chaque motif, **le message envoyé au
créateur** et son caractère corrigible (`08`).

**États.** Aucune pièce transmise : « Aucune pièce n'a été déposée. » + motif de refus suggéré,
jamais un refus automatique. Pièce illisible : c'est un motif de refus typé, pas une erreur
d'écran. Storage indisponible : « Les pièces ne peuvent pas être affichées. ⟨cause⟩ » et **la
décision est bloquée** — on ne décide pas d'un badge sans avoir vu la pièce.

---

### 3.8 Validation d'une campagne, et revue renforcée

**Population et tâche.** Commercial, file 7, plusieurs fois par jour. Publier ou refuser une
campagne. **Deux délais** : 1 jour ouvré, **2 jours en revue renforcée** (`09` RG85).

```
┌ CMP-2026-0431 · « ⟨titre⟩ » · ⟨raison sociale⟩ ──────────────────────── ▮ ─┐
│ ⏱ Échéance dans 1 j 3 h   ⚑⚑ REVUE RENFORCÉE — catégorie de produit sensible│
│    Deux personnes sont requises. Vous êtes le 1ᵉʳ examinateur.              │
├─────────────────────────────────────────────────────────────────────────────┤
│ ① LA MARQUE   ⟨raison sociale⟩ · FR · ✓ vérifiée · 3 campagnes publiées    │
│    ⚑ La même marque a déjà une campagne au titre proche, période qui se     │
│      recouvre : CMP-2026-0388. Information, pas un refus.       [· Ouvrir]  │
│ ② LA CAMPAGNE                                                               │
│    Catégorie de produit : ⟨libellé⟩  ⚑ sensible                             │
│    Budget par créateur : 300,00 – 600,00 EUR                                │
│    Période : 01/10 → 30/11 · candidatures jusqu'au 25/09                    │
│    Livrables : 1 post Instagram, 2 stories · Droits : 6 mois · Exclusivité : │
│    non                                                                       │
│ ③ LE BRIEF                                                     texte brut   │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ ⟨brief intégral, jamais tronqué, jamais rendu en HTML⟩               │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    [· Corriger un champ]  ⓘ toute correction est journalisée et la marque   │
│                             en est informée                                 │
│ ④ CONTRÔLES                                                                 │
│    ✓ Budget renseigné avec devise    ✓ Période cohérente                    │
│    ✓ Livrables décrits              ⚑ Secteurs refusés par 2 créateurs du   │
│                                        vivier : exclusion silencieuse       │
│ ⑤ DÉCISION                                                                  │
│    Commercial responsable *  [▾ ⟨moi⟩]   ⓘ une campagne sans responsable    │
│                                            est une campagne que personne ne │
│                                            vendra (AL20)                    │
│    [■ Transmettre au 2ᵉ examinateur]      [⚠ Refuser avec motif ‹r›]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**La revue renforcée en deux temps** (`09` RG85) — et la différence à ne pas manquer avec la
double validation de §4.5 : ici, **deux examens**, pas une confirmation différée.

| Temps | Écran | Qui |
|---|---|---|
| 1 | Le bouton principal devient **« Transmettre au 2ᵉ examinateur »**, jamais « Publier ». Le 1ᵉʳ examinateur saisit un **avis motivé** obligatoire | `agent` ou `admin` |
| 2 | L'entrée réapparaît en file, marquée « 2ᵉ examen — 1ᵉʳ avis de ⟨nom⟩ », **masquée au 1ᵉʳ examinateur** (`15` RG36 par analogie) ; le bouton devient **« Publier »** | `admin` ou un **second** agent |

Hors revue renforcée, le bouton est directement `[■ Publier ‹v›]`.

**États.** Aucune campagne en attente : état vide de §2.3. Marque suspendue en cours d'examen :
bandeau bloquant « La marque a été suspendue. Cette campagne ne peut pas être publiée. » +
issue `clôturée sans suite`. Décision concurrente : verrou, message « En cours — ⟨nom⟩ ».

---

### 3.9 L'affaire — pipeline commercial

**Population et tâche.** Commercial responsable, après chaque avancée d'une négociation :
enregistrer ce qui s'est passé. `14` fait autorité sur les règles ; ce document fixe la forme.

> **Le principe qui gouverne cet écran : l'application enregistre, elle ne calcule rien**
> (`15` RG4, `14` RG46, RG47). Aucun champ pré-rempli, aucun bouton « appliquer le barème », aucun
> pourcentage, aucun placeholder chiffré.

#### 3.9.a La liste des affaires

```
┌ Affaires ───────────────────────────────────────────────────────────────────┐
│ [▾ État] [▾ Responsable] [▾ Devise] [▾ Période] [x] Anomalies seules         │
│ 23 affaires · page 1/2                                                       │
├──────────┬───────────────┬──────────────┬────────────┬────────────┬─────────┤
│ Réf.     │ Marque ↔ Créa.│ État         │ Montant    │ Commission │ Comm.   │
│          │               │              │ négocié    │ convenue   │ encaissée│
├──────────┼───────────────┼──────────────┼────────────┼────────────┼─────────┤
│ MER-…118 │ ⟨…⟩ ↔ ⟨…⟩     │ signée       │2 700,00 EUR│  700,00 EUR│700,00EUR│
│ MER-…121 │ ⟨…⟩ ↔ ⟨…⟩     │ négociation  │1 800,00 EUR│          — │       — │
│          │               │ ⚑ silencieuse depuis 16 jours                     │
│ MER-…094 │ ⟨…⟩ ↔ ⟨…⟩     │ signée       │1 200,00 GBP│  300,00 GBP│  0,00GBP│
│          │               │ ⚑ facture manquante · ⚑ encaissement J+34         │
└──────────┴───────────────┴──────────────┴────────────┴────────────┴─────────┘
│ TOTAUX — par devise, sans conversion                                         │
│   EUR   convenue 1 000,00   encaissée   700,00   écart   300,00              │
│   GBP   convenue   300,00   encaissée     0,00   écart   300,00              │
```

**Trois règles de forme, non négociables :**

1. **Trois colonnes distinctes, trois en-têtes imposés**, jamais une colonne « montant » polyvalente
   (`15` RG5).
2. **La devise est sur chaque cellule**, pas en en-tête de colonne : une liste multi-devises où la
   devise est en en-tête est un piège de lecture.
3. **Les totaux sont par devise, jamais globaux** (`15` RG19, CA4). Une affaire **sans devise
   n'entre dans aucun total** et apparaît dans la liste « à compléter » (`15` cas limite 2).

#### 3.9.b La fiche d'affaire

```
┌ MER-2026-000118 · Affaire ──────────────────────────────────────────────────┐
│ ⟨raison sociale⟩ ↔ ⟨alias⟩ · campagne « ⟨titre⟩ » · révélée 12/09 14 h 02   │
│ Responsable : ⟨Prénom Nom⟩ (vous)          [· Conversation (lecture journ.)] │
├──────────────────────────────────────────────────────────────────────────────┤
│ ÉTAT   ouverte → négociation → contrat envoyé → ●signée → facturée → encaissée│
│        ⚑ silencieuse depuis —    ⚑ en litige : non                           │
│        [■ Passer à « facturée »]   [▾ Autre transition]                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ MONTANTS                                              [· Historique des      │
│                                                          modifications]      │
│  Montant du contrat — coût total pour l'annonceur, commission INFLUX comprise│
│     2 700,00  [▾ EUR]     base fiscale [▾ hors taxes]                        │
│     ⓘ Un accord « 2 000 pour le créateur + 700 pour nous » se saisit 2 700,  │
│       pas 2 000.                                                             │
│  Commission convenue                                                         │
│       700,00  EUR         base fiscale [▾ hors taxes]                        │
│       Payeur [▾ les deux] → part annonceur 400,00  part créateur 300,00      │
│       Note de commission * ⟨barème standard⟩                                 │
│  Date de signature 15/09  ·  Mode d'envoi du contrat [▾ DocuSign] le 13/09   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ENCAISSEMENTS                                                                │
│   15/09  400,00 EUR  virement  payeur : annonceur   réf. ⟨…⟩                 │
│   18/09  300,00 EUR  virement  payeur : créateur    réf. ⟨…⟩                 │
│   Commission encaissée 700,00 EUR · reste dû 0,00 EUR        [■ Ajouter]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ NOTES INTERNES · JOURNAL DE L'AFFAIRE (transitions, corrections, auteurs)    │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Point de conception | Règle |
|---|---|
| **Le libellé du montant est écrit en entier**, avec le rappel du piège au-dessus du champ | `14` RG23. C'est l'erreur de saisie la plus coûteuse du pilote |
| **Aucun pourcentage nulle part** | `14` RG47, `15` RG4. Ni « soit 35 % », ni « taux effectif », ni graphique |
| **Récapitulatif avant enregistrement** | `14` RG38 : dialogue reprenant montant, commission, parts, base fiscale et devise, **en toutes lettres**, avant toute écriture |
| **Les états impossibles n'ont pas de bouton** | Les transitions sont contraintes en base (`14` RG12). L'interface n'affiche que celles qui sont permises **à ce rôle** — et quand une transition est réservée à `admin`, elle est **visible et désactivée avec son motif**, pas absente |
| **Anomalies écrites** | « facture manquante », « silencieuse depuis 16 jours », « en litige » : des libellés, jamais des pastilles |
| **Historique des modifications de montant** | `14` RG79, `15` RG109-5 : ancienne valeur, auteur, date, motif. Accessible d'un lien, jamais masqué |
| **Aucune coordonnée bancaire** | `14` RG45. Le formulaire n'a pas de champ IBAN. Ce n'est pas un oubli |
| **Écriture réservée au responsable et à `admin`** | `14` RG39. Un autre agent **lit** ; le bouton d'édition affiche « Vous n'êtes pas responsable de cette affaire. [· Demander la réattribution] » — voir l'incohérence **I4** en §7 |

**États.** Affaire sans montant : les champs sont vides, **pas à zéro** — zéro est un montant, vide
est une absence. Devise non sélectionnée : l'enregistrement est refusé côté serveur avec un message
qui nomme le champ. Saisie ambiguë (« 2,700.00 ») : refus explicite, **jamais une interprétation
silencieuse** (`14` RG27). Mode `especes` : anomalie affichée en clair, jamais un blocage.

---

### 3.10 Le parcours d'envoi d'e-mails — sept écrans

> **La friction y est une fonctionnalité** (`16` §B). C'est la seule action du backoffice qui touche
> des milliers de personnes d'un geste. La friction est **concentrée sur la confirmation** et
> **absente partout ailleurs**.

| # | Écran | Ce que l'écran fait | Règle |
|---|---|---|---|
| 1 | **Mes envois** | Liste de **tous** les envois, siens et collègues. Colonnes : date · auteur · source · **base légale** · modèle · langue · volume · écartés · état · résultats. Tri date décroissante. Un envoi en fenêtre d'annulation est **en tête, avec son compte à rebours, pour tout le monde** | `16` RG15 |
| 2 | **La source** | Trois choix **exclusifs**, chacun avec sa base légale **écrite en toutes lettres**, son volume possible et son plafond restant du jour. Choix **définitif**. Une option indisponible est **désactivée avec son motif écrit**, jamais absente | `16` RG16 |
| 3 | **Le périmètre** | Composition par **facettes en liste fermée** — aucune requête libre, aucun champ texte, aucun identifiant de compte. Segment Brevo : liste lue en direct, restreinte aux segments autorisés, condition de cadence vérifiée. **Segment mixte → avertissement écrit**, non bloquant, journalisé | `16` RG17, RG18 |
| 4 | **Modèle et langue** | Modèle **validé** uniquement, avec version, date et validateur. **Aperçu obligatoire, réel, dans toutes les langues du périmètre** — affiché, pas seulement disponible. **Variable non résolue = blocage**, avec le nom de la variable et le nombre de destinataires concernés | `16` RG19–RG21 |
| 5 | **Volume et écartés** | Volume **calculé à l'affichage de cet écran**, avec l'heure exacte. Écartés détaillés **par motif**, en compteurs, **visuellement distincts des échecs et jamais additionnés** | `16` RG22–RG25 |
| 6 | **Double confirmation** | **Deux gestes de nature différente** (§4.5) + re-authentification TOTP + procédure dégradée si une seule personne opère | `16` RG26, RG27 |
| 7 | **Fenêtre d'annulation** | 5 minutes, **rien n'est transmis à Brevo pendant la fenêtre**. Bandeau permanent sur **tous** les écrans. **N'importe quel agent peut annuler.** Périmètre recalculé à l'expiration ; écart > 10 % ou 50 destinataires → **blocage + AL47** | `16` RG28–RG31, `15` RG127 |

**Écran 2 — la source, forme imposée :**

```
┌ Nouvel envoi › 1. Choisir la source ────────────────────────────────────────┐
│ ⓘ Ce choix est définitif pour cet envoi.                                    │
│                                                                              │
│ ( ) Contacts de la plateforme                                                │
│     Base légale : consentement marketing recueilli à l'inscription,          │
│     revérifié au moment de l'envoi.                                          │
│     Volume possible : ~4 200 · plafond restant aujourd'hui : 5 000           │
│                                                                              │
│ ( ) Segment Brevo                                                            │
│     Base légale : consentement géré dans Brevo. Brevo fait foi.              │
│     INFLUX ne lit pas les destinataires.                                     │
│     Segments autorisés : 4                                                   │
│                                                                              │
│ (⊘) Adresse saisie (une seule)                       — indisponible          │
│     Aucune base légale acquise : c'est de la prospection.                    │
│     Motif d'indisponibilité : plafond mensuel atteint (50/50).               │
│                                                                              │
│                                        [□ Annuler]   [■ Continuer]           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Écran 5 — deux compteurs qui ne se ressemblent pas :**

```
│ ✓ DESTINATAIRES RETENUS        3 842      calculé à 11 h 04 (Europe/Paris)  │
│                                                                              │
│ ⓘ ÉCARTÉS — cas normaux, ce ne sont pas des erreurs           358           │
│    sans consentement marketing        212                                    │
│    consentement retiré depuis          41                                    │
│    désinscrits (retour Brevo)          64                                    │
│    hors cadence                        29                                    │
│    compte suspendu                     12                                    │
│                                                                              │
│ ⚠ BLOCAGES — à corriger avant d'envoyer                        1            │
│    langue non couverte par le modèle : 118 destinataires en NL              │
│    → on corrige le modèle, on n'écarte pas des gens.        [· Écran 4]     │
```

`16` RG23 : **les écartés et les échecs ne sont jamais additionnés**, et le mot « erreur »
n'apparaît pas au-dessus des écartés. Un écran qui présente une règle comme une panne perd sa
crédibilité en trois jours.

**Écran 7 — le bandeau d'annulation** (barre 3 de §1.4), présent partout, `role="status"`, compte à
rebours **annoncé toutes les 30 s** et non à chaque seconde (sinon un lecteur d'écran devient
inutilisable). L'annulation demande un **motif de liste fermée** : `erreur_de_perimetre`,
`erreur_de_modele`, `mauvais_moment`, `incident`, `other` (commentaire obligatoire).

**Les e-mails transactionnels** (`16` §H) n'ont pas de parcours : ils partent seuls. Le backoffice
en expose **deux écrans** : la file 16 `email_send_failures` (§2.7) et, sous Administration ›
E-mails › Transactionnels, un tableau par type avec volume, délai médian, part délivrée, et — en
tête — **la délivrabilité du code de connexion** (AL48), qui n'est pas un indicateur marketing :
**c'est la disponibilité du produit** (**D37**).

**L'interrupteur d'urgence** (`16` RG121, AL45) : un écran sous Administration › E-mails, avec un
seul bouton `[⚠ Suspendre tous les envois marketing]`, un motif typé, et — quand il est actif — un
bandeau rouge sur **tous** les écrans de tous les rôles internes. **La reprise est toujours
humaine**, jamais automatique, et demande un motif.

---

### 3.11 Supervision des leads et adresses injoignables

**Population et tâche.** Commercial ou `admin`, quotidiennement : voir ce qui n'est pas parti, et
le rejouer.

```
┌ Files › Faire fonctionner la machine › Échecs de synchronisation ───────────┐
│  12 à traiter  ·  plus ancienne : 1 j 2 h  ·  hors délai : 0                │
│  ⓘ Aucun verrou sur cette file : le rejeu est idempotent.                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [▾ Destination] [▾ Cause] [ ●À traiter ○Cas normaux ]      ← bascule, jamais │
│                                                              une addition    │
├──┬────────────┬───────────┬────────────────────────────────┬────────┬───────┤
│☐ │ Compte     │ Destination│ Cause (en clair)               │ Tentat.│ Dern. │
├──┼────────────┼───────────┼────────────────────────────────┼────────┼───────┤
│☑ │ ⟨…⟩        │ Apollo    │ Clé d'accès refusée par Apollo │   5    │ 08h12 │
│☑ │ ⟨…⟩        │ Brevo     │ Adresse refusée : format inval.│   3    │ 08h14 │
│☐ │ ⟨…⟩        │ Apollo    │ Quota journalier dépassé       │   2    │ 09h02 │
└──┴────────────┴───────────┴────────────────────────────────┴────────┴───────┘
│ 2 sélectionnés · plafond 200 par lot           [■ Rejouer la sélection (2)]  │
```

| Point de conception | Règle |
|---|---|
| **Une bascule, pas deux compteurs additionnés** | `05` RG100, `16` RG23 : « à traiter » et « cas normaux » sont deux vues, jamais un total. Un lead non synchronisé par absence de consentement **est un cas normal, et l'écran le dit** |
| **Cause en français courant** | `05` RG99 : « Clé d'accès refusée par Apollo », jamais `401`. Une trace technique brute est réservée au détail, derrière un lien |
| **Rejeu idempotent** | `05` RG102, `15` RG91 : aucun doublon, aucun e-mail renvoyé. Le compte rendu nomme ce qui a été remis en file, ignoré, refusé |
| **Ligne non rejouable** | Une ligne « ignorée pour absence de consentement » **n'a pas de bouton de rejeu** — pas un bouton grisé : l'absence, plus une phrase (`05` RG103) |
| **Aucun export nominatif** | La liste des inscrits **n'est pas exportable**, pour aucun rôle (`05` RG106, `15` RG92, CA63). Le bouton n'existe pas ; s'il est cherché, `bo.export.blocked` répond |

**Adresses injoignables** (file 13) : même gabarit. L'adresse est **partiellement masquée** en
liste (`j***@exemple.fr`) et complète sur la fiche — une liste est plus facile à copier qu'une
fiche. La correction d'adresse est réservée à `admin`, avec motif, et **le membre en est informé**
(`15` RG44). Rappel affiché en tête : **depuis D37, une adresse injoignable est un compte
inaccessible**, pas une gêne marketing.

---

### 3.12 Demandes relatives aux données personnelles

**Population et tâche.** `agent` instruit, **`admin` exécute** (`15` RG76). L'écran **porte la
preuve du traitement** (`15` RG85) : on doit pouvoir démontrer qu'une demande a été traitée dans le
délai sans reconstituer un enchaînement d'e-mails.

```
┌ DSR-2026-0007 · Demande d'effacement ───────────────────────────────────────┐
│ Reçue le 04/09 · canal : e-mail · échéance légale 04/10 (J-15)              │
│ ⓘ Le délai de 30 jours est figé à la réception. Il ne se recalcule pas.     │
├──────────────────────────────────────────────────────────────────────────────┤
│ ① QUALIFIER              ✓ Effacement                    ⟨agent⟩ 04/09      │
│ ② VÉRIFIER L'IDENTITÉ    ✓ Appel sortant au numéro du profil, 05/09         │
│                            ⓘ jamais sur la seule foi d'une adresse e-mail   │
│ ③ ÉTABLIR LE PÉRIMÈTRE   ✓ 7 catégories détenues · 5 conservées (RG80)      │
│                            [· Voir le détail écrit]                         │
│ ④ PRÉVENIR LE RESPONSABLE ✓ ⟨Prénom Nom⟩ prévenu le 05/09 — affaire         │
│                             MER-…094 en cours                               │
│ ⑤ RÉDIGER LA RÉPONSE     ● en cours   [▾ langue : français]                 │
│                            ⓘ La réponse doit énoncer les catégories         │
│                              conservées et pourquoi.                        │
│ ⑥ EXÉCUTER               ○ réservé à un administrateur · double validation  │
│                            + re-authentification                            │
│ ⑦ NOTIFIER ET CLORE      ○ issue typée obligatoire                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ PROPAGATION                                                                  │
│   Brevo   ○ en attente — `account.deleted` sera émis en priorité            │
│   Apollo  ○ en attente                                                      │
│   ⓘ La demande ne peut pas être close tant que les deux n'ont pas confirmé. │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Point de conception | Règle |
|---|---|
| **Sept étapes visibles en permanence**, avec leur exécutant et leur trace | `15` RG75. L'écran **est** la preuve |
| **L'étape 6 est visuellement inaccessible à un `agent`** | `15` RG76, CA50 : bouton absent, phrase présente. Un agent n'exécute jamais un export ni une anonymisation |
| **La clôture est bloquée tant que Brevo et Apollo n'ont pas confirmé** | `15` RG79, CA51. Une demande d'effacement close alors que Brevo n'a rien confirmé est une demande **non exécutée** |
| **L'échéance est affichée en J-n, pas en date seule** | Une date ne crée pas d'urgence ; « J-15 » oui. À J-7, **AL40** |
| **Les catégories conservées sont écrites dans la réponse** | `15` RG80, CA53. Cinq catégories, avec le motif de leur conservation |

**Export au titre du droit d'accès (E2)** : produit par `admin`, `2V` + re-authentification, livré
par **lien à usage unique et de courte durée**, jamais en pièce jointe (`15` RG82, RG95). L'écran
rappelle ce qui **n'y est pas** : notes internes portant sur un tiers, pièces de vérification,
motifs internes, journal des lectures d'autres personnes, et — hypothèse conservatrice **Q7** — le
texte écrit par l'autre partie d'une conversation.

---

### 3.13 Comptes internes, compte de secours, double validation

#### 3.13.a Liste et fiche d'un compte interne

```
┌ Administration › Comptes internes ──────────────────────────────────────────┐
│ ⓘ Un compte interne = une personne nommée. Aucun compte partagé, jamais.    │
│ ⓘ Il n'existe aucune inscription : un compte se crée par invitation.        │
│                                              [■ Inviter une personne]        │
├────────────┬────────┬─────────┬──────────────┬──────────────┬───────────────┤
│ Personne   │ Rôle   │ 2ᵉ fact.│ Dernière conn│ Responsable de│ État          │
├────────────┼────────┼─────────┼──────────────┼──────────────┼───────────────┤
│ ⟨Nom⟩      │ agent  │ ✓ actif │ 19/09 08 h 40│ 42 c · 17 m ·│ actif         │
│            │        │         │              │ 9 a          │               │
│ ⟨Nom⟩      │ admin  │ ✓ actif │ 18/09 17 h 12│ 8 c · 2 m    │ actif         │
│ ⟨Nom⟩      │ agent  │ ✓ actif │ 02/09 09 h 01│ 0            │ ⚑ absence     │
│            │        │         │              │              │ jusqu'au 25/09│
│ SECOURS    │ admin  │ ✓ actif │ jamais       │ 0            │ ⚠ bris de     │
│            │        │         │              │              │ glace         │
└────────────┴────────┴─────────┴──────────────┴──────────────┴───────────────┘
```

**Désactivation — l'écran refuse tant qu'il reste des responsabilités** (`15` RG60, CA38) :

```
┌ Désactiver le compte de ⟨Nom⟩ ──────────────────────────────────────────────┐
│ ⛔ Désactivation impossible : cette personne est encore responsable de       │
│    42 comptes · 17 mises en relation · 9 affaires.                          │
│    Réattribuez-les d'abord.                                                 │
│    [■ Transférer le portefeuille vers un autre agent]                       │
│    [· Voir le détail des 68 objets]                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Le refus **nomme ce qui reste** — un refus qui dit seulement « impossible » oblige à chercher.

**Transfert de portefeuille (M5)** : action de masse, plafond 200, `2V` + re-authentification,
**aperçu chiffré** (« 42 comptes, 17 mises en relation, 9 affaires »), et réversibilité annoncée
avec sa limite : « réversible par une nouvelle réattribution — **mais les annonces déjà publiées
dans les fils ne s'annulent pas** » (`15` RG61).

#### 3.13.b Le compte de secours

Affiché **dans la liste**, jamais caché : un dispositif de bris de glace qu'on oublie n'en est pas
un. Ligne distincte, libellé « bris de glace », et un encadré permanent au-dessus de la liste :

> ⚠ **Compte de secours.** Adresse distincte, TOTP hors ligne, codes de secours imprimés et scellés.
> **Toute connexion alerte immédiatement le fondateur** (AL33) et exige une justification écrite sous
> 24 heures. Il n'est jamais utilisé pour le travail quotidien.

#### 3.13.c La double validation — et sa forme dégradée

*Amendé à la clôture de L2F (`0231`) : l'action `verification.revoke_badge` s'ajoute au catalogue ; elle est **demandée depuis la fiche du compte** par un agent ou un administrateur (jamais par la porte générique), cible `badge` (niveau, réseau, état, message au membre, nombre de badges emportés ; jamais un chiffre ni un identifiant), conséquences écrites : badge retiré, audience retirée avec lui, ligne publique recalculée, membre notifié, contestation possible. Seul un administrateur confirme ; l'agent reste sur la fiche.*

Deux écrans, selon qu'il existe ou non un second `admin` actif. **La bascule est automatique**
(`03` PD7, `15` CA72) : aucun changement de code, aucun réglage.

**Forme cible — contrôle par les pairs**

```
┌ Action en attente de seconde validation ────────────────────────────────────┐
│ Demandée par ⟨Nom⟩ le 19/09 à 10 h 22 · expire le 20/09 à 10 h 22 (dans 23 h)│
│ Action : suspendre le compte ⟨raison sociale⟩                                │
│ Motif  : manquement aux conditions générales d'utilisation                   │
│ Message qui sera envoyé au titulaire :                                       │
│   « Votre compte est suspendu pour manquement aux conditions générales       │
│     d'utilisation. Notre équipe vous contacte. »                             │
│ Conséquences : sessions révoquées · profil dépublié · campagnes dépubliées · │
│   candidatures en cours clôturées · conversations en lecture seule ·         │
│   affaires inchangées                                                        │
│ Réversible : oui, la levée est réservée à un administrateur.                 │
│                                                                              │
│ Second facteur (code à 6 chiffres) [      ]                                  │
│                        [⚠ Refuser la demande]   [■ Confirmer l'action]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Forme dégradée — une seule personne opère** (`03` PD1–PD7, `15` RG9) : mêmes blocs, **plus**

```
│ ⚠ CONTRÔLE AFFAIBLI. Vous confirmez une action que vous avez vous-même       │
│   demandée. Ce contrôle protège contre l'erreur et la précipitation,         │
│   pas contre la malveillance. Il redeviendra un vrai contrôle dès la         │
│   deuxième personne dans l'équipe.                                           │
│                                                                              │
│   Confirmation possible dans 43 s.        ← compte à rebours écrit, annoncé  │
│   [■ Confirmer l'action]  (désactivé)                                        │
```

| Point de conception | Règle |
|---|---|
| **Écran distinct, pas un dialogue** | `03` PD2 : la confirmation a lieu « dans un second temps, sur un écran distinct, atteignable par une action séparée » — jamais dans le même enchaînement de clics |
| **60 secondes annoncées et comptées** | `03` PD2, `15` RG118 : c'est **le seul délai artificiel autorisé** dans tout le backoffice, et il est dit |
| **Le mot « affaibli » est écrit** | `15` RG9 : un contrôle décoratif est pire qu'une absence de contrôle, parce qu'il rassure à tort |
| **Expiration à 24 h** | `15` RG31, CA20 : rien n'est exécuté, le demandeur est informé, l'expiration est journalisée. `bo.dualControl.expired` |
| **Seconde confirmation sans effet** | `15` cas limite 4 : « déjà confirmée à ⟨heure⟩ par ⟨nom⟩ » |

### 3.14 Connexion, activation du second facteur et codes de secours *(J3, 2026-09-27)*

> **Rédigé par `product-owner`** à la demande de `21` J3-H, avant le commit 12 ; mise en forme :
> `expert-ux`. Règles appliquées : `03` B-1 à B-8 et MFA-1 à MFA-10, `21` J3-C règle 4 et les
> arbitrages de sécurité du J3 (EC-17, EC-39, EC-40, EC-47, G-1). **Libellés en français seulement**
> (D36, valeur d'attente) ; ils sont externalisés dans `bo.json`, comme tous les autres, pour qu'une
> version anglaise ne coûte qu'une traduction si le fondateur tranche D36 autrement.

**Cinq règles d'écran, qui découlent des arbitrages de sécurité :**

1. **Connexion en une seule fois** : adresse, mot de passe et code (ou code de secours) sont saisis
   **sur le même écran** et envoyés ensemble ; aucune session n'existe avant la vérification
   complète (EC-40).
2. **Un seul message d'échec**, quelle que soit l'étape en défaut — adresse inconnue, mot de passe
   faux, code faux, code déjà utilisé, plafond atteint, compte non activé, désactivé, ou compte
   **membre** qui se trompe d'espace (EC-40, EC-47). Il ne cite jamais l'espace membre.
3. **Le mot de passe n'est conservé nulle part entre deux étapes** : ni dans la page, ni dans le
   stockage du navigateur. C'est pourquoi l'activation le redemande (EC-40, point 4).
4. **Pas de « se souvenir de cet appareil »** (B-4), pas de connexion Google ou autre.
5. **Une panne n'a son propre message que si aucun identifiant n'a été vérifié** (l'espace interne
   est injoignable) ; toute autre défaillance reçoit l'échec unique — sinon un message « panne »
   survenant après le mot de passe révélerait qu'il était juste.

#### 3.14.a Connexion

```
┌ INFLUX — Espace interne ─────────────────────────────────────────┐
│ Connexion à l'espace interne INFLUX                           h1 │
│ Réservé à l'équipe INFLUX.                                       │
│                                                                  │
│ Adresse e-mail professionnelle *   [                          ]  │
│ Mot de passe *                     [                          ]  │
│ Code de l'application (6 chiffres) * [      ]                    │
│ [· Utiliser un code de secours]                                  │
│                                                                  │
│                                           [■ Se connecter]       │
│ [· Première connexion ? Activez votre second facteur]            │
└──────────────────────────────────────────────────────────────────┘
```

| Clé | Libellé |
|---|---|
| `bo.auth.login.title` | Connexion à l'espace interne INFLUX |
| `bo.auth.login.lead` | Réservé à l'équipe INFLUX. Munissez-vous de votre application d'authentification. |
| `bo.auth.login.emailLabel` | Adresse e-mail professionnelle |
| `bo.auth.login.passwordLabel` | Mot de passe |
| `bo.auth.login.totpLabel` | Code de l'application d'authentification (6 chiffres) |
| `bo.auth.login.useRecoveryCode` | Utiliser un code de secours |
| `bo.auth.login.recoveryLabel` | Code de secours (16 caractères) |
| `bo.auth.login.recoveryHelp` | Majuscules, espaces et tirets sont indifférents. |
| `bo.auth.login.useTotp` | Utiliser mon application d'authentification |
| `bo.auth.login.submit` | Se connecter |
| `bo.auth.login.submitBusy` | Connexion… |
| `bo.auth.login.firstTime` | Première connexion ? Activez votre second facteur |
| `bo.auth.login.errors.generic` | Connexion impossible. Vérifiez votre adresse, votre mot de passe et votre code, puis réessayez. Si le problème persiste, contactez un administrateur INFLUX. |
| `bo.auth.errors.unavailable` | L'espace interne est momentanément indisponible. Réessayez dans quelques minutes. |
| `bo.form.errors.required` | Ce champ est obligatoire. |
| `bo.auth.errors.totpFormat` | Le code comporte 6 chiffres. |
| `bo.auth.errors.recoveryFormat` | Un code de secours comporte 16 lettres et chiffres. |
| `bo.auth.recovery.banner` | Vous êtes connecté avec un code de secours. Il vous en reste {remaining, plural, =0 {aucun} one {#} other {#}}. Les actions qui demandent une confirmation d'identité sont indisponibles dans cette session : demandez à un administrateur de réinitialiser votre second facteur. |
| `bo.auth.session.ended` | Votre session a pris fin. Reconnectez-vous. |
| `bo.auth.logout` | Me déconnecter |
| `bo.auth.logout.done` | Vous êtes déconnecté. |

Les erreurs de forme (`bo.form.errors.required`, `bo.auth.errors.totpFormat`,
`bo.auth.errors.recoveryFormat`) sont affichées **dans le navigateur, sans appel au serveur**. Le
bandeau `bo.auth.recovery.banner` reste affiché pendant toute une session ouverte par un code de
secours (EC-17 point 4) ; chaque utilisation alerte les administrateurs (MFA-4, EC-44).

#### 3.14.b Activation du second facteur — trois étapes

Atteinte depuis le lien d'invitation (J8) ou, au J3, depuis `bo.auth.login.firstTime`. **La personne
ne saisit jamais le jeton d'activation** (G-1 point 2) ; son mode de transmission appartient à
`expert-cybersecurite` et `dev-react-node`.

```
Étape 1 sur 3 — Confirmez votre identité     adresse · mot de passe      [■ Continuer]
Étape 2 sur 3 — Associez votre application   code QR + clé manuelle
                                             code à 6 chiffres · MOT DE PASSE RESSAISI
                                                                 [■ Activer et me connecter]
Étape 3 sur 3 — Vos 10 codes de secours      affichés une seule fois
                                             [□ Copier] [□ Imprimer]
                                             [ ] J'ai conservé mes codes en lieu sûr
                                                                 [■ Accéder à l'espace interne]
```

| Clé | Libellé |
|---|---|
| `bo.auth.enroll.title` | Activer votre second facteur |
| `bo.auth.enroll.lead` | L'accès à l'espace interne exige un code à 6 chiffres produit par une application d'authentification installée sur votre téléphone. Cette étape est obligatoire avant tout accès. |
| `bo.auth.enroll.step` | Étape {current} sur 3 |
| `bo.auth.enroll.step1.title` | Confirmez votre identité |
| `bo.auth.enroll.step1.submit` | Continuer |
| `bo.auth.enroll.errors.generic` | Activation impossible. Vérifiez votre adresse et votre mot de passe, puis réessayez. Si le problème persiste, contactez un administrateur INFLUX. |
| `bo.auth.enroll.errors.invitationInvalid` | Ce lien d'activation n'est plus valable : il a déjà servi ou date de plus de 72 heures. Demandez une nouvelle invitation à un administrateur INFLUX. |
| `bo.auth.enroll.step2.title` | Associez votre application |
| `bo.auth.enroll.step2.scan` | Scannez ce code QR avec votre application d'authentification. |
| `bo.auth.enroll.step2.qrAlt` | Code QR d'activation du second facteur INFLUX |
| `bo.auth.enroll.step2.manual` | Impossible de scanner ? Saisissez cette clé dans l'application : {secret} |
| `bo.auth.enroll.step2.codeLabel` | Code à 6 chiffres affiché par l'application |
| `bo.auth.enroll.step2.passwordLabel` | Mot de passe |
| `bo.auth.enroll.step2.passwordWhy` | Ressaisissez votre mot de passe : tant que le second facteur n'est pas activé, aucune session n'est ouverte, et votre mot de passe n'est pas conservé d'une étape à l'autre. |
| `bo.auth.enroll.step2.submit` | Activer et me connecter |
| `bo.auth.enroll.step2.errors.generic` | Activation impossible. Vérifiez le code affiché par l'application — il change toutes les 30 secondes — et votre mot de passe, puis réessayez. |
| `bo.auth.enroll.step2.restarted` | Un nouveau code QR a été créé. Supprimez de votre application l'entrée INFLUX ajoutée auparavant, puis scannez celui-ci. |

| Point | Règle |
|---|---|
| Échec à l'étape 2 | Le code QR reste affiché ; seuls les deux champs sont vidés. Refaire l'étape 1 crée un **nouveau** code QR (l'ancien facteur non vérifié est supprimé, `21` J3-A c6) : `bo.auth.enroll.step2.restarted` le dit |
| Clé manuelle | Affichée par groupes de quatre caractères, sélectionnable ; jamais dans le titre de la page ni dans son adresse |
| Échec unique | `bo.auth.enroll.errors.generic` à l'étape 1, quelle que soit la cause (adresse, mot de passe, compte déjà activé, plafond) ; seul un jeton d'activation invalide a son message propre, qui ne dit rien des identifiants |

#### 3.14.c Les codes de secours — affichés une seule fois

| Clé | Libellé |
|---|---|
| `bo.auth.recoveryCodes.title` | Vos 10 codes de secours |
| `bo.auth.recoveryCodes.lead` | Chaque code permet une seule connexion si vous perdez l'accès à votre application d'authentification. **Ils ne seront plus jamais affichés.** |
| `bo.auth.recoveryCodes.storage` | Conservez-les hors ligne : imprimés et rangés, ou dans un gestionnaire de mots de passe. Jamais dans un e-mail, une messagerie ou une capture d'écran. |
| `bo.auth.recoveryCodes.alert` | Chaque utilisation d'un code de secours est signalée à tous les administrateurs. |
| `bo.auth.recoveryCodes.copy` | Copier les codes |
| `bo.auth.recoveryCodes.copied` | Codes copiés. |
| `bo.auth.recoveryCodes.print` | Imprimer |
| `bo.auth.recoveryCodes.confirm` | J'ai conservé mes codes de secours en lieu sûr |
| `bo.auth.recoveryCodes.continue` | Accéder à l'espace interne |
| `bo.auth.recoveryCodes.leaveWarning` | Si vous quittez cette page, vos codes de secours ne pourront plus être affichés. Quitter quand même ? |

| Point | Règle |
|---|---|
| Présentation | Dix codes numérotés de 1 à 10, en police à chasse fixe, par groupes de quatre séparés par des tirets (`XXXX-XXXX-XXXX-XXXX`) |
| Sortie de l'étape | « Accéder à l'espace interne » reste inactif tant que la case n'est pas cochée ; quitter la page avant affiche `bo.auth.recoveryCodes.leaveWarning`. La session existe déjà (EC-40) : la case ne protège que contre l'oubli |
| Ce qui n'existe pas | Aucun téléchargement de fichier, aucun envoi par e-mail, aucun réaffichage, aucune régénération libre au J3 (EC-17 point 5) ; rien dans le stockage du navigateur, page non mise en cache |
| Codes perdus | Seule issue : la réinitialisation par un **autre** administrateur (MFA-6, J8) |

#### 3.14.d Confirmation d'identité (R) et mot de passe

| Clé | Libellé |
|---|---|
| `bo.auth.reauth.title` | Confirmez votre identité |
| `bo.auth.reauth.lead` | Cette action demande votre mot de passe et un code de votre application d'authentification. |
| `bo.auth.reauth.errors.generic` | Confirmation impossible. Vérifiez votre mot de passe et votre code, puis réessayez. |
| `bo.auth.reauth.errors.recoverySession` | Cette action n'est pas disponible dans une session ouverte avec un code de secours. Demandez à un administrateur de réinitialiser votre second facteur. |
| `bo.auth.reauth.revoked` | Votre session a été fermée après plusieurs échecs de confirmation d'identité. Reconnectez-vous. |
| `bo.auth.password.rules` | 12 caractères au moins, sans autre contrainte : une phrase de plusieurs mots convient très bien. |
| `bo.auth.password.errors.tooShort` | Choisissez un mot de passe d'au moins 12 caractères. |
| `bo.auth.password.errors.tooLong` | Ce mot de passe est trop long : 72 octets au plus (un caractère accentué ou un emoji en compte plusieurs). |
| `bo.auth.password.errors.compromised` | Ce mot de passe figure dans des fuites de données connues. Choisissez-en un autre. |
| `bo.auth.password.errors.context` | Le mot de passe ne doit contenir ni la première partie de votre adresse e-mail, ni le mot « influx ». |
| `bo.auth.password.errors.checkUnavailable` | Nous ne pouvons pas vérifier ce mot de passe pour le moment. Réessayez dans quelques minutes. |

La confirmation R et le choix du mot de passe servent à partir du J8 (invitation, actions
sensibles) ; leurs libellés sont fixés dès maintenant parce que le commit 10 porte R et B-1.

### 3.15 Santé technique *(additif du J9, 2026-10-27, EC-J9-5)*

Écrit d'après `02` §20.5 seul, livré au J9 commit 9 (`6b1f62a`). Alertes : `15` RG165 (AL49 à AL63).

| Point | Règle |
|---|---|
| Adresse, accès | `/sante-technique`, **`admin` seul, lecture seule**, poste de travail (hors vue téléphone de D58 : l'e-mail d'alerte y suffit). Un `agent` qui ouvre l'adresse voit « réservé aux administrateurs » ; l'appel refusé est journalisé (`ops.read_health`, CA63). Lectures `backoffice.ops_*` (`0148`, `EXECUTE` à `influx_admin` seul) non journalisées : état technique, aucune personne |
| Sections | Disponibilité mesurée par la sonde (par cible : dernier relevé, 24 h, 7 j, 30 j) ; alertes techniques ouvertes ; état du worker (règle d'AL50) et tâches périodiques ; groupes d'erreurs (`new`, `acknowledged`, `fixed`, `ignored`, régression = `regression_count > 0` encore ouverte) et leurs occurrences ; appels par minute, p95 et taux de `5xx` par route ; processus et connexions à la base |
| Mesures | p95 calculé à la lecture sur les histogrammes additionnés de toutes les instances, affiché comme borne haute de la tranche (`≤ 500 ms`, `> 5 s`) ; trafic en 12 × 5 min, 24 × 1 h ou 28 × 6 h, 100 routes au plus, dernière tranche « en cours » ; disponibilité 30 j = relevés à la minute (14 j) puis agrégat horaire |
| Comportement | Chaque section se lit seule (une section en échec laisse les autres lisibles, « Réessayer ») ; lecture de tout l'écran chaque minute, onglet visible, ou par « Actualiser » ; états en mots avec un symbole, jamais la couleur seule |
| Hors écran | Classer un groupe d'erreurs (`acknowledged`, `fixed`, `ignored`) : **aucun écrivain livré au J9**, tout groupe reste `new` et la régression d'AL51 ne peut pas se lever tant qu'il manque (reliquat, fiche J9) ; âge de la file `pending`, événements `failed` et vérification de chaîne, qui restent aux écrans des leads (§3.11) ; lien « état des services » depuis l'accueil et la file des échecs, `admin` seul |

#### 3.14.e Alerte « nouveau navigateur » — remplace « pays ou opérateur inhabituel » (B-7, J8)

Définition : `05` RG141 et RG145 ; vocabulaire : `05` RG144. Code d'alerte à inscrire au catalogue de
`15` (RG68) par `chef-de-projet`.

| Clé | Libellé |
|---|---|
| `bo.alert.newBrowser.title` | Connexion au backoffice depuis un nouveau navigateur |
| `bo.alert.newBrowser.body` | {agentName} s'est connecté le {signedInAt, date, long} à {signedInAt, time, short} depuis {browser}, un navigateur jamais utilisé sur ce compte au cours des 30 derniers jours. Aucune mesure automatique n'a été prise. Vérifiez auprès de la personne ; si ce n'est pas elle, révoquez ses sessions et réinitialisez son second facteur. |

---

## 4. Composants transverses

> Onze composants couvrent **tous** les écrans de ce document. C'est le rapport qui compte : moins
> de composants, plus d'écrans cohérents, et des raccourcis qui s'apprennent une fois.

### 4.1 Tableau dense (`BoTable`)

Le composant le plus utilisé du backoffice. **Tableaux plutôt que cartes, partout** (`15` RG112) :
une carte par élément fait défiler, un tableau fait comparer.

| Caractéristique | Valeur | Raison |
|---|---|---|
| Hauteur de ligne | `spacing-bo-row-h` = **2,25 rem** (36 px) **nouveau** | ~20 lignes visibles sur un écran de 1080 px sans défilement. Une ligne de 56 px n'en montre que 12 : 40 % d'information perdue par écran |
| Remplissage de cellule | `spacing-bo-cell-y` = `spacing-1` · `spacing-bo-cell-x` = `spacing-3` **nouveaux** | La respiration de la landing (`spacing-inset-card`) est ici un défaut |
| Taille de texte | `text-sm` en corps, `text-xs` en en-tête | En dessous de `text-sm`, la lecture en continu fatigue sur huit heures |
| Nombres | `font-variant-numeric-amount` (tabulaire) **obligatoire** | Des montants non alignés ne se comparent pas |
| En-tête | `<th scope="col">`, **collant** sous la bande de tête, `color-surface-raised` *(D73 : `surface-muted` a désormais la valeur des lignes)* | |
| Ligne survolée / focalisée | `color-bo-row-hover` **nouveau** + **bordure gauche de 2 px** `color-brand-primary` | La couleur seule ne suffit pas au clavier |
| Zébrure | **Aucune** | Elle entre en conflit avec l'état de ligne (hors délai, verrouillée, bloquée), qui doit rester lisible |
| Sélection | Case en colonne 1, **seulement sur les files à action de masse** | Une case inutile invite à un geste impossible |
| Tri | Une seule colonne à la fois, marqueur `▲`/`▼` **plus** `aria-sort` | |
| Pagination | Plafonnée serveur, pied « page n/m », **jamais « charger plus »** (`15` RG34) | Anti-aspiration |
| Ligne vide | Jamais une cellule blanche : **« non renseigné »** écrit (`15` cas limite 1) | Un vide se lit comme un bogue |

### 4.2 Barre de filtres (`BoFilters`)

Les six filtres communs (`15` RG33) **dans le même ordre sur les 16 files**, puis un séparateur,
puis les filtres propres. Chaque filtre actif devient une **puce retirable** sous la barre. Un
bouton `[· Réinitialiser]` apparaît dès qu'un filtre est actif. L'état est dans l'URL (`15` RG121),
sans donnée personnelle. **Aucun filtre ne s'ajoute sans passer par `chef-de-projet`** : un écran à
quinze filtres n'est plus un outil.

### 4.3 Sélecteur de motif typé (`BoReasonPicker`)

Le composant qui porte le principe directeur du backoffice. Il apparaît partout : refus, suspension,
levée, réattribution, classement d'alerte, lecture de conversation, annulation d'envoi, clôture
d'affaire, levée de verrou.

```
┌ Refuser cette demande ──────────────────────────────────────────────┐
│ Motif *  (liste fermée)                                             │
│  (•) Ce créateur ne correspond pas à ce que vous décrivez           │
│      → message à la marque :                                        │
│        « Ce créateur ne correspond pas à ce que vous décrivez. »    │
│        Corrigible : oui — la marque pourra redemander.              │
│  ( ) L'écart entre le budget et les tarifs est trop important       │
│  ( ) Le motif ne permet pas de préparer la mise en relation         │
│  ( ) Le message contient une adresse, un numéro ou un lien          │
│  ( ) La campagne rattachée n'est plus ouverte                       │
│  ( ) Ce créateur n'est pas disponible          Corrigible : non     │
│  ( ) Une mise en relation est déjà en cours    Corrigible : non     │
│  ( ) Autre — commentaire interne obligatoire                        │
│                                                                      │
│ Commentaire interne (facultatif, invisible du membre)               │
│  ┌────────────────────────────────────────────────────────────┐     │
│  └────────────────────────────────────────────────────────────┘     │
│                             [□ Annuler ‹Échap›]  [■ Refuser]        │
└──────────────────────────────────────────────────────────────────────┘
```

| Règle | Détail |
|---|---|
| **Liste fermée, 5 à 10 entrées** | `backoffice-ops` étape 2. Au-delà, plus personne ne lit |
| **Boutons radio, jamais une liste déroulante** | Une liste déroulante cache les options et pousse à prendre la première. Ici, on veut que l'agent **voie** les huit motifs |
| **Le message envoyé au membre est affiché sous le motif sélectionné** | `15` RG7 : il n'existe aucune décision muette, et aucun agent ne doit découvrir après coup ce qu'INFLUX a écrit en son nom |
| **Le caractère corrigible est écrit** | Il change ce que l'agent dira au téléphone |
| **« Autre » impose un commentaire** | `15` RG8. Sa fréquence est surveillée : au-delà de 10 % sur un mois, **AL38** — la liste est incomplète |
| **Texte libre en complément, jamais seul** | `15` RG7 |
| **Le champ n'est jamais perdu** | `Échap` ferme le panneau **en conservant la saisie** (`15` RG116) |

### 4.4 Dialogue de confirmation — deux gestes de nature différente (`BoHardConfirm`)

Pour les actions de masse d'envoi (M3) et toute action irréversible à fort volume. **Jamais deux
clics au même endroit** (`16` RG26, `15` RG129).

```
┌ Confirmer l'envoi ──────────────────────────────────────────────────┐
│ Source        Contacts de la plateforme                             │
│ Base légale   Consentement marketing, revérifié à l'envoi           │
│ Périmètre     « Créateurs FR actifs 30 j »                          │
│ Volume        3 842 destinataires                                    │
│ Modèle        « Relance créateurs » v4 — validé le 12/09 par ⟨Nom⟩  │
│ Langues       français, anglais                                      │
│                                                                      │
│ [ ] J'ai lu ce qui précède et je confirme que cet envoi sera        │
│     IRRÉVERSIBLE passé le délai d'annulation de 5 minutes.          │
│                                                                      │
│ Geste 2 — ressaisissez le volume exact au clavier :                 │
│     ┌──────────┐   (le collage et l'auto-complétion sont refusés)   │
│     └──────────┘                                                     │
│                                                                      │
│ Second facteur (code à 6 chiffres)  [      ]                        │
│                              [□ Annuler]   [■ Programmer l'envoi]   │
└──────────────────────────────────────────────────────────────────────┘
```

Une case **plus** une ressaisie clavier **plus** un second facteur : trois natures de geste
différentes. Le champ de ressaisie refuse `paste` et `autocomplete` — non par coquetterie : c'est le
seul moyen que le chiffre soit **lu** avant d'être validé.

### 4.5 Écran de confirmation différée (`BoDeferredConfirm`)

Spécifié en §3.13.c. Trois invariants : **écran distinct** (pas un dialogue), **compte à rebours de
60 s écrit et annoncé**, **le mot « affaibli » en toutes lettres** tant que le contrôle par les pairs
n'existe pas.

### 4.6 Bandeau d'environnement (`BoEnvBanner`)

Trois valeurs : `PRODUCTION` · `RECETTE` · `LOCAL`. En production : un point discret et le mot. Hors
production : **toute la barre de tête change de fond** (`color-bo-env-nonprod-bg` **nouveau**, jaune
sourd) et le mot est en capitales. Raison : `16` §J — un agent qui croit être en recette alors qu'il
est en production envoie de vrais e-mails à de vraies personnes. La couleur est doublée du mot, et
le mot figure aussi dans le `<title>` de l'onglet.

### 4.7 Bandeau de procédure dégradée (`BoDegradedBanner`)

`bo.dualControl.degraded`, ton **information**, permanent tant qu'il n'existe pas deux `admin`
actifs (`15` RG107, CA71). Non refermable : un bandeau qu'on peut fermer disparaît le premier jour.
`[· En savoir plus]` ouvre une page d'une demi-page qui explique ce que le mode protège et ce qu'il
ne protège pas.

### 4.8 Indicateur de journalisation (`BoLoggedMarker`)

Trois formes, une seule sémantique — **« cet acte est enregistré »** :

| Forme | Où | Exemple |
|---|---|---|
| **Marqueur ▮ dans un titre** | Écran dont **l'ouverture** est journalisée | Fiche de compte, écran de décision, recherche identifiée |
| **Ligne sous le titre** | Détail de ce qui est enregistré | « Consultation enregistrée : ⟨nom⟩, 19/09 09 h 42. » |
| **Suffixe de bouton** | Action dont **le déclenchement** est journalisé | « Lire ce fil (lecture journalisée) », « Ouvrir la pièce 1 (journalisée) » |

**Le lecteur doit voir qu'il est journalisé.** Ce n'est pas une menace, c'est ce qui rend la
supervision annoncée aux membres crédible (`15` RG35, `12` RG55). Un marqueur discret mais
systématique vaut mieux qu'un avertissement spectaculaire qu'on cesse de lire en trois jours.

### 4.9 Marqueur de vue identifiée (`BoIdentifiedFrame`)

**Barre verticale pleine de 4 px à gauche de la zone de contenu** (`color-bo-identified-accent`
**nouveau**) + chapeau écrit « ⬥ VUE IDENTIFIÉE ». Appliqué à : la recherche en vue identifiée, la
fiche créateur, le bloc « Le créateur » de l'écran de décision, le bloc « Interlocuteur » de la
fiche marque, la conversation.

**Pourquoi une barre et pas une couleur de fond** : la barre survit à une capture d'écran recadrée,
à une impression en noir et blanc et à un vidéoprojecteur mal réglé. Une teinte de fond, non. Le
risque visé est concret : un commercial qui partage son écran avec une marque.

### 4.10 Affichage d'un montant (`BoAmount`)

| Règle | Détail |
|---|---|
| **Trois libellés imposés** | *Montant négocié* · *Commission convenue* · *Commission encaissée* (`15` RG5). Jamais « budget », « cachet », « rémunération », « total » |
| **Devise sur chaque montant** | `2 700,00 EUR`. Jamais la devise en en-tête de colonne seule |
| **Chiffres tabulaires** | `font-variant-numeric-amount` |
| **Insécable** | Le montant et sa devise ne se coupent jamais en fin de ligne |
| **Format selon la langue de l'interface** | `15` RG12, ICU, jamais de concaténation |
| **Aucun total toutes devises, aucun pourcentage, aucun net créateur** | `15` RG4, RG19. Un agrégat est **toujours par devise**, avec la mention `bo.amount.byCurrency` |
| **Valeur absente ≠ zéro** | Une commission non saisie s'affiche **`—`**, jamais `0,00` |

### 4.11 Raccourcis clavier (`BoShortcuts`)

Les huit raccourcis de `15` RG114 sont **identiques dans les 16 files** — c'est l'homogénéité qui
les rend utiles. Ce document en ajoute trois, de navigation seulement, sans effet de bord :

| Touche | Geste | Source |
|---|---|---|
| `j` / `k` | Entrée suivante / précédente | `15` RG114 |
| `Entrée` | Ouvrir l'entrée **et la prendre en charge** | `15` RG114, RG27 C1 |
| `v` | Valider — **ouvre le récapitulatif** si l'action est révélante ou irréversible | `15` RG114, RG115 |
| `r` | Refuser — ouvre le sélecteur de motif, **jamais un refus direct** | `15` RG114 |
| `n` | Ajouter une note interne | `15` RG114 |
| `l` | Relâcher le verrou | `15` RG114 |
| `Échap` | Fermer le panneau en cours, **sans perdre la saisie** | `15` RG114, RG116 |
| `?` | Afficher la liste des raccourcis | `15` RG114 |
| `⌘K` / `Ctrl K` | Recherche globale | **ajout §1.5** |
| `g` puis `1…7` | Aller à l'entrée n du rail (numéro de §1.2, même quand des entrées sont masquées, §1.7) | **ajout §1.2** |
| `b` puis `1…8` | Tableau de bord : amener le focus sur le bloc n (§1.6) | **ajout du 2026-10-28** (lève le conflit avec `g` puis n) |
| `espace` | Cocher / décocher la ligne focalisée (files à sélection) | **ajout §3.3** |

**Aucun raccourci ne déclenche une action irréversible sans confirmation** (`15` RG115). `‹?›`
affiche un panneau listant les raccourcis **du contexte courant**, pas une liste générique.

### 4.12 États, messages et erreurs (`BoFeedback`)

| Règle | Détail |
|---|---|
| **Quatre états explicites par écran** | Repos · chargement · succès · échec. **Aucun écran ne reste muet après une action** (`15` RG117) |
| **Un message d'erreur reste 6 s minimum** ou jusqu'à fermeture explicite | `15` RG117, CA77. Un message qui disparaît avant d'être lu n'a pas été affiché |
| **Jamais de trace technique** | `15` CA74. Cause en français courant, puis `[· Détail technique]` replié pour l'`admin` |
| **Aucune animation décorative, aucun délai artificiel** | `15` RG118. Le seul délai autorisé est celui de la confirmation différée, et il est annoncé et compté |
| **Chargement : squelette à hauteur fixe** | Pas de spinner qui saute, pas de décalage de contenu |
| **Ce qui n'est pas montré est dit** | `15` RG123 : « Les données d'enrichissement Apollo ne sont pas affichées dans INFLUX. » — plutôt qu'un vide qu'on prendra pour un bogue |
| **Refus de droit** | `bo.action.forbidden`, **nomme le rôle requis**, tentative journalisée (`15` RG110) |

---

## 5. Vérification du chronométrage

> **Chaque clic économisé au backoffice est de la capacité commerciale gagnée** (`15` §Besoin).
> Cette section chronomètre les cinq gestes les plus fréquents **sur papier**, avant qu'une ligne de
> code ne soit écrite. Un geste qui dépasse sa cible n'est pas « à optimiser plus tard » : il est
> mal conçu.

**Méthode.** Une *interaction* = un geste discret de l'utilisateur : une frappe de raccourci, un
clic, un choix dans une liste, une validation de champ. La saisie d'un texte compte pour **une**
interaction (c'est le champ, pas les caractères). On compte à partir du moment où l'agent a l'écran
de départ sous les yeux.

| # | Geste | Interactions | dont champs à saisir | dont décisions | Cible | Verdict |
|---|---|---|---|---|---|---|
| **1a** | **Décider une demande** — validation simple, depuis la file, entrée focalisée : `‹Entrée›` (ouvre + prend en charge) → lecture → `‹v›` | **2** | 0 | 1 | ≤ 3 | ✅ |
| **1b** | *idem*, **validation révélante** : `‹Entrée›` → `‹v›` (ouvre le récapitulatif) → `[⚠ Je confirme]` | **3** | 0 | 2 | ≤ 4 | ✅ La friction supplémentaire est **voulue** : la révélation est irréversible |
| **1c** | *idem*, **refus** : `‹Entrée›` → `‹r›` → choisir le motif → `[■ Refuser]` | **4** | 0 | 2 | ≤ 5 | ✅ |
| **2** | **Proposer 5 créateurs**, depuis une campagne publiée : `[■ Proposer des créateurs]` → 5 sélections → `[■ Proposer à la campagne (5)]` → motif commun → `[■ Envoyer les 5]` | **9** (dont **5 de sélection**) | 1 | 2 | ≤ 10 · **≤ 4 hors sélection** | ✅ **3 clics à partir d'une sélection faite**, conforme à `13` RG54 |
| **3a** | **Renseigner une affaire** — passage `négociation → signée`, montant et devise déjà saisis : ouvrir → transition → date de signature · commission convenue · base fiscale montant · base fiscale commission · payeur · note de commission → `[■ Enregistrer]` → `[■ Confirmer]` (récapitulatif `14` RG38) | **10** | 6 | 2 | ≤ 12 | ✅ |
| **3b** | *idem* **depuis `ouverte`**, tout à saisir : + montant · devise · mode d'envoi · date d'envoi | **14** | 10 | 3 | ≤ 15 | ⚠️ À la limite. **Aucun champ ne peut être retiré** : tous sont exigés par `14` §C, et **aucun ne peut être pré-rempli** (`14` RG46). Le levier n'est pas l'écran, c'est de saisir au fil de l'eau plutôt qu'en une fois |
| **4a** | **Lire une conversation — participant** : ouvrir depuis le tableau de bord ou l'affaire | **1** | 0 | 0 | **1** | ✅ Motif `suivi_de_l_affaire` retenu automatiquement (`12` RG56) : **friction nulle sur le geste quotidien** |
| **4b** | **Lire une conversation — non participant** : `[· Lire ce fil (lecture journalisée)]` → choisir le motif → `[■ Ouvrir le fil]` | **3** | 0 | 1 | ≤ 3 | ✅ La friction est **le produit**, pas un défaut (`12` RG57) |
| **5a** | **Vérifier un badge** — niveau 2, une pièce, octroi : `‹Entrée›` → ouvrir la pièce → abonnés constatés · période début · période fin → **ouvrir le profil public → publications des 30 derniers jours · commentaires moyens** *(D61, 2026-09-25)* → `‹v›` | **9** | 5 | 1 | ≤ 8 | ⚠️ **Dépasse la cible d'une interaction depuis D61** (était 6). Les deux champs sont exigés par `08` RG38bis et ne peuvent pas être pré-remplis (règle 11 de `profile-verification`). Le vrai coût n'est pas le clic mais le **décompte hors outil** (12 publications à parcourir) : il est mesuré (`07`, indicateurs) et soumis à `07` **Q17**. Reste à décider : relever la cible à ≤ 9, ou revoir le geste |
| **5b** | *idem* **refus** : `‹Entrée›` → ouvrir la pièce → `‹r›` → motif → `[■ Refuser]` | **5** | 0 | 2 | ≤ 6 | ✅ |

### Ce que ce décompte a changé dans la conception

| Décision prise à cause du chronométrage | Gain |
|---|---|
| **Ouvrir = prendre en charge** (`15` RG27 C1) | −1 interaction sur **chacune** des 16 files, à chaque entrée. Sur 60 décisions/jour : 60 clics |
| **Enchaînement automatique vers l'entrée suivante** (§2.6) | −2 interactions par décision (retour à la liste + rechercher la suivante) |
| **Panneau latéral pour la proposition**, sans changement d'écran | −2 interactions et, surtout, la sélection reste visible derrière : l'agent ne revérifie pas |
| **Motif automatique pour l'agent participant** | −2 interactions **par lecture de fil**, soit le geste le plus répété de la journée d'un commercial |
| **Pré-remplissage des facettes depuis le brief** (`10` RG73) | −4 à −8 interactions par proposition |
| **Aucun clic « prendre en charge » sur les files 12 et 16** (pas de verrou) | −1 par rejeu, et le rejeu est souvent en lot |

### Le contre-exemple à garder en tête

L'implémentation actuelle de la file de vérification (§7.3, écart **E4**) demande **un clic
« Prendre en charge » après ouverture**. Sur cette file seule, à 30 vérifications par jour, c'est
30 clics quotidiens — et surtout, c'est **une exception au gabarit** : l'agent doit se souvenir que
cette file-là ne se comporte pas comme les quinze autres. Le coût réel n'est pas le clic, c'est la
rupture d'automatisme.

---

## 6. Extensions de tokens proposées

> **Règle de méthode** (`design-system-influx`, « Ajouter un token ») : vérifier d'abord qu'aucun
> token existant ne couvre le besoin — c'est le cas le plus fréquent. Sur **douze** besoins
> identifiés, **neuf sont des alias sans nouvelle valeur** et **deux seulement** introduisent une
> couleur nouvelle. **D6 n'est pas rouverte.**
>
> **Charte KEO Emerald (D73, 2026-10-28).** Les noms de cette section ne changent pas ; les alias
> résolvent désormais vers les valeurs KEO (`20` §11.3) et les contrastes ci-dessous sont recalculés
> sur les surfaces KEO : page `#0a0b0a`, ligne et carte `#121413`, ligne survolée `#232725`. Ajout
> sans valeur nouvelle : `--spacing-bo-band-h` (§6.1).

### 6.1 Densité — aucune couleur, aucun contraste à vérifier

Le backoffice a un registre visuel différent du site public : la respiration généreuse de la
landing (`spacing-inset-card`, `size-touch-target` à 2,75 rem) y coûte 40 % de l'information
visible par écran.

| Token | Valeur | Rôle | Quand ne pas l'utiliser |
|---|---|---|---|
| `--spacing-bo-row-h` | **`2.25rem`** *(nouveau)* | Hauteur de ligne du tableau dense | Jamais hors d'un `BoTable` ; jamais sur une liste destinée à un membre |
| `--spacing-bo-cell-y` | `var(--spacing-1)` *(alias)* | Remplissage vertical de cellule | — |
| `--spacing-bo-cell-x` | `var(--spacing-3)` *(alias)* | Remplissage horizontal de cellule | — |
| `--spacing-bo-rail-w` | **`15rem`** *(nouveau)* | Largeur du rail de navigation (§1.7) | Colonne des espaces membres (`size-member-rail`, `17` §8.2) |
| `--spacing-bo-band-h` | `var(--spacing-8)` *(alias, D73)* | Hauteur de la bande de tête (§1.4, §1.7) | — |
| `--spacing-bo-panel-w` | **`30rem`** *(nouveau)* | Largeur du panneau latéral (proposition, motif, suspension) | Au-delà, le panneau masque la liste qu'il faut garder visible |
| `--size-bo-control` | **`1.75rem`** *(nouveau)* | Hauteur minimale d'un contrôle en ligne de tableau. **28 px ≥ les 24 px exigés par WCAG 2.2 AA (2.5.8)** | **Interdit sur `apps/web`** : les parcours membres restent à `size-touch-target` (2,75 rem), mobile-first |

### 6.2 Vue identifiée — la seule nouvelle famille de couleur

**Le besoin qu'aucun token existant ne couvre.** Il faut distinguer, d'un coup d'œil et sur une
capture d'écran recadrée, un écran qui montre des identités que les membres ne voient pas. Aucune
couleur existante ne convient : le **vert** est l'action et le succès, le **jaune** l'alerte, le
**rouge** l'erreur, le **bleu** l'information. Utiliser l'une d'elles créerait une ambiguïté
permanente — « est-ce une alerte ou une vue identifiée ? ». Il faut une **cinquième teinte, sans
autre emploi**.

| Token | Valeur | Rôle | Quand ne pas l'utiliser |
|---|---|---|---|
| `--color-bo-identified-accent` | **`#a78bfa`** *(nouveau)* | Barre verticale de 4 px, chapeau « ⬥ VUE IDENTIFIÉE », marqueur ⬥ | **Jamais** pour une action, un état de succès, une alerte. **Jamais dans `apps/web`** : ce token n'existe que là où des identités internes sont visibles |
| `--color-bo-identified-bg` | **`#17121f`** *(nouveau)* | Fond très sourd d'un bloc en vue identifiée (bloc « Interlocuteur », bloc « Le créateur ») | Jamais sur une section pleine page : la barre et le libellé portent l'information, le fond ne fait que l'appuyer |

**Contrastes calculés** (WCAG 2.x, luminance relative) :

| Paire | Ratio | Exigence | Verdict |
|---|---|---|---|
| `#a78bfa` sur `--color-surface-page` `#0a0b0a` *(KEO)* | **7,24 : 1** | 4,5 : 1 (texte) | ✅ AAA |
| `#a78bfa` sur `--color-surface-card` `#121413` *(KEO)* | **6,80 : 1** | 4,5 : 1 | ✅ |
| `#a78bfa` sur `--color-bo-identified-bg` `#17121f` | **6,75 : 1** | 3 : 1 (barre de 4 px = composant d'interface) | ✅ |
| `--color-text-primary` `#f4f6f5` *(KEO)* sur `#17121f` | **16,93 : 1** | 4,5 : 1 | ✅ AAA |
| `--color-text-secondary` `#b4bbb7` *(KEO)* sur `#17121f` | **9,39 : 1** | 4,5 : 1 | ✅ AAA |
| `--color-text-tertiary` `#8a938e` *(KEO)* sur `#17121f` | **5,81 : 1** | 4,5 : 1 | ✅ |

> **La couleur n'est jamais seule porteuse** (`15` RG119). La vue identifiée est signalée par
> **trois** moyens simultanés : une **forme** (barre verticale pleine), un **texte** (« ⬥ VUE
> IDENTIFIÉE — vous voyez les noms… »), une **couleur**. Le premier survit à une impression en noir
> et blanc et à une capture recadrée ; c'est celui qui compte.

### 6.3 Statuts de SLA — trois alias, aucune nouvelle valeur

| Token | Valeur | Rôle |
|---|---|---|
| `--color-bo-sla-ontime-text` | `var(--color-text-secondary)` | « dans 6 h 40 » — **délibérément neutre** : l'état normal ne doit pas crier, sinon l'anormal ne se voit plus |
| `--color-bo-sla-due-text` | `var(--color-feedback-warning-text)` | « dans 45 min » — sous 25 % du délai restant |
| `--color-bo-sla-overdue-text` | `var(--color-feedback-error-text)` | « HORS DÉLAI depuis 3 h 12 » |

| Paire *(valeurs KEO et D72, D73)* | Sur la ligne `#121413` | Sur la ligne survolée `#232725` | Verdict |
|---|---|---|---|
| `#b4bbb7` (à l'heure) | **9,45 : 1** | **7,73 : 1** | ✅ |
| `#ffb020` (proche) | **10,12 : 1** | **8,27 : 1** | ✅ |
| `#ec5d5e` (hors délai, D72) | **5,54 : 1** | **4,53 : 1** | ✅ |

**Chacun est doublé d'un libellé écrit et d'un glyphe** (`○` · `⚑` · `⚑` + capitales), jamais de la
seule couleur (`15` CA15).

### 6.4 Alertes, environnement et lignes — six alias

| Token | Valeur | Rôle | Contraste |
|---|---|---|---|
| `--color-bo-alert-state` | `var(--color-feedback-info-text)` | Alerte **d'état** (se referme seule) | `#4da3ff` sur `#121413` = **7,05 : 1** ✅ *(KEO)* |
| `--color-bo-alert-event` | `var(--color-feedback-warning-text)` | Alerte **d'événement** (à classer) | `#ffb020` sur `#121413` = **10,12 : 1** ✅ *(KEO)* |
| `--color-bo-alert-event-bg` | `var(--color-feedback-warning-bg)` | Fond de ligne d'une alerte d'événement non classée | texte `#ffb020` sur `#2b2008` = **8,75 : 1** ✅ *(KEO)* |
| `--color-bo-env-nonprod-bg` | `var(--color-feedback-warning-bg)` | Fond de la bande de tête hors production | idem ✅ |
| `--color-bo-env-nonprod-text` | `var(--color-feedback-warning-text)` | Mot « RECETTE » / « LOCAL » | idem ✅ |
| `--color-bo-row-hover` | `var(--color-surface-hover)` | Ligne survolée ou focalisée, **doublée d'une bordure gauche de 2 px** `var(--color-brand-primary)` | Surface, pas de texte |

> **Les deux natures d'alerte ne se distinguent pas par la couleur seule** (`15` RG64, RG66). Une
> alerte d'état porte le libellé « se referme seule » et **n'a pas de bouton de classement** ; une
> alerte d'événement porte « à classer » et un bouton. La couleur n'est qu'un renfort.

### 6.5 Où ces tokens vivent

`apps/backoffice` **importe le même `tokens.css`** que `apps/web` (D4 : Tailwind v4 alimenté
**uniquement** par le fichier de tokens), **plus** un fichier d'extension
`apps/backoffice/src/styles/tokens-backoffice.css` contenant **uniquement** les douze tokens
ci-dessus. Aucune couleur, aucun espacement, aucun rayon en dur ailleurs (`15` RG120, CA78 ;
`CLAUDE.md` §4). **Voir l'écart d'implémentation E1 en §7.3 : ce n'est pas le cas
aujourd'hui.** *Depuis D73 (2026-10-28, `02` §21.3)* : le `tokens.css` de `packages/ui` (PL-08, `02` §21.3
point 7) est celui des deux fronts, bloc `[data-theme="keo"]` compris ; l'attribut est posé sur
`<html>` dans `app/layout.tsx`, si bien que tout le backoffice prend les valeurs KEO de `20` §11.3.
Les jetons propres à la vitrine (carte métallisée, halos, cadre de téléphone) n'y ont pas d'usage.

---

## 7. Incohérences relevées, écarts d'implémentation, points à valider

### 7.1 Incohérences entre spécifications

Chacune est signalée à l'agent qui fait autorité. **Ce document n'en corrige aucune** : il applique
l'hypothèse indiquée et la rend visible.

| # | Incohérence | Hypothèse appliquée ici | Arbitre |
|---|---|---|---|
| **I1** | ✅ ***Résolue le 2026-09-24** : `15` RG125 renumérotée en 16.* **Collision de numéro de file.** L'additif `15` RG125 attribue le **numéro 14** à `email_send_failures`, déjà pris par `data_subject_requests` dans RG29. Deux files portent le même numéro | `email_send_failures` prend le **numéro 16**. Le catalogue compte **16 files**, pas 15 | `product-owner` |
| **I2** | **Une troisième issue de file.** `15` RG27 C6 : « **deux issues, jamais trois** — aucune mise de côté, aucune attente de correction ». Or la file de vérification prévoit une remise en file pour blocage technique (`08` RG50), implémentée comme un troisième onglet « À réexaminer » (§7.3, E5) | La remise en file **n'est pas une issue** : c'est un **relâchement de verrou motivé** (`15` RG27 C3, `‹l›`). L'écran n'offre que deux issues ; « je rends la main » existe déjà et suffit | `product-owner` + `expert-ux` |
| **I3** | ✅ ***Résolue** (constat du 2026-09-24) : `14` RG37 a été réécrite le 2026-09-19 — plus aucun net créateur dans le pipeline.* **Le net créateur.** `15` RG4 : « **aucun écran de ce document n'affiche un net créateur** ». `14` RG37 : « le net créateur indicatif est une soustraction affichée », et `14` RG38 l'inscrit dans le récapitulatif de confirmation. **Contradiction frontale** entre deux documents du même lot | **`15` RG4 l'emporte** : aucun écran de ce document n'affiche de net créateur. Raison : au MVP, INFLUX ne verse rien et ne garantit rien ; afficher un « net » crée une attente qu'aucune règle ne tient, et c'est précisément l'ambiguïté que `CLAUDE.md` §3 interdit | **`expert-paiement-facturation`** + `product-owner` |
| **I4** | ✅ ***Tranchée le 2026-09-24 (D50) : `14` RG39 retenue.*** **Qui écrit sur une affaire.** `14` RG39 restreint au commercial responsable et à `admin` ; `03` §3.5 accorde l'écriture à tout `agent`. `14` le signale déjà mais rien n'est tranché | L'écran applique **`14` RG39** (le plus restrictif) : un autre agent lit, et voit « Vous n'êtes pas responsable de cette affaire. [· Demander la réattribution] ». Si `03` l'emporte, l'écran perd un bouton, pas une règle | `expert-cybersecurite` + `expert-database` |
| **I5** | **Trois actions ou deux issues ?** `13` RG38 : « trois actions, et trois seulement : valider, refuser, **réattribuer** ». `15` RG27 C6 : « deux issues ». Lu vite, on croit à une contradiction | **Ce n'en est pas une, mais elle mérite d'être écrite** : réattribuer **n'est pas une issue** — l'entrée reste dans la file, seul son responsable change. L'écran le traduit en plaçant la réattribution **en haut à droite**, hors du bloc « Décision » | — *(clarification, aucun arbitrage requis)* |
| **I6** | ✅ ***Résolue.*** **La question ouverte Q1 de `15` est déjà résolue dans `05`.** `15` Q1 pose une contradiction entre `05` RG106 (« export admin de la liste des inscrits ») et `03` C(17). Or `05` RG106 dit **aujourd'hui** : « **Aucun export nominatif de la liste des inscrits, pour aucun rôle, `admin` compris.** » | **Aucune contradiction ne subsiste.** Q1 peut être close sans arbitrage. Ce document applique l'interdiction | `chef-de-projet` *(clôture de Q1)* |
| **I7** | **Le tableau de bord est en lecture seule, mais y affiche des alertes à classer.** `15` RG16 interdit toute action au tableau de bord ; RG18 bloc 1 y affiche « mes alertes ouvertes non classées ». Classer est une action | Le bloc 1 **compte et oriente** ; le classement se fait au **centre d'alertes** (rail, entrée 6). Chaque ligne est un lien, pas un bouton | — *(clarification)* |
| **I8** | **Tri par défaut, toujours ouvert (`15` Q5).** `06`, `07`, `08` RG62 et `09` écrivent « ancienneté croissante » ; `13` RG19 et `15` RG27 C5 écrivent « échéance croissante » | **Échéance croissante partout** (`15` RG27 C5). C'est le seul tri juste quand deux délais coexistent dans une file (`campaigns` : 1 j / 2 j) | `product-owner` + `expert-ux` |
| **I9** | **Deux gestes fréquents sans raccourci.** `15` RG114 couvre huit gestes, mais ni la **réattribution** (l'une des trois actions de `13` RG38), ni la recherche globale | Ce document ajoute `‹⌘K›`, `‹g puis n›` et `‹espace›` (§4.11). **La réattribution reste volontairement sans raccourci** : c'est un geste rare et engageant, un raccourci l'exposerait à la frappe réflexe | `expert-ux` *(tranché ici)* |
| **I10** | **Nombre d'alertes.** Le catalogue `15` RG68 en compte 41 ; l'additif RG126 en ajoute 7 (AL42–AL48) | **48 alertes.** Le centre d'alertes et le compteur du rail les couvrent toutes | — |
| **I11** | **Écrire à un seul membre inscrit est impossible.** `16` RG25 prévoit un plancher de volume et « suggère la fiche du compte » quand il y a moins de 2 destinataires — **mais aucun écran ne permet d'envoyer un e-mail depuis une fiche de compte**. La source 3 est de la *prospection* (adresse non inscrite, aucune base légale acquise), pas un message à un membre | **Manque fonctionnel.** En l'état, un commercial qui veut écrire à un membre sort de la plateforme — ce que `CLAUDE.md` §4 interdit. Proposition : un envoi transactionnel unitaire depuis la fiche, modèle validé, consentement non requis (exécution de la relation), journalisé | `expert-marketing` + **`expert-conformite-rgpd` (veto)** |
| **I12** | **La file 11 `documents` est conditionnelle** (`12` Q5, canal non tranché ; PDF refusé par `03` E1-9) | L'écran est spécifié et **activable en configuration** (`is_active` de `backoffice.queues`). S'il est écarté, le catalogue passe à 15 files — **la file ne doit pas être retirée du code**, sinon la rouvrir coûte un chantier | Fondateur + `expert-cybersecurite` |
| **I13** | **La file 9 `team_selection` n'a pas de motifs de refus.** `10` RG61 et RG84 créent la file et son délai, mais aucune liste fermée de motifs n'existe — or `15` RG7 l'exige pour toute décision | **Manque.** Liste à écrire avant le Lot 5. En attendant, l'écran de décision de la file 9 réutilise la **liste A** de `13` RG83, qui couvre les mêmes cas | `product-owner` |
| **I14** | **La file 5 `verification_disputes` exige un « agent différent du décideur »** (`15` RG29). Aucune règle ne dit ce qui se passe quand l'équipe compte **une seule personne**, cas réel du pilote | L'écran **masque l'entrée à son décideur d'origine** (comme `15` RG36) et, s'il n'existe aucun autre agent, affiche « Aucun examinateur disponible — cette contestation doit attendre un second agent », **sans bloquer le délai**. C'est un cas où le produit doit dire qu'il ne peut pas, plutôt que simuler un réexamen | `product-owner` + Fondateur *(lié à Q13 de `15`)* |

### 7.2 Manques relevés dans les spécifications

| # | Manque | Conséquence à l'écran |
|---|---|---|
| **M1** | Aucun document ne fixe **l'ordre ni le regroupement** des 16 files dans la navigation | Proposé ici (§1.3), à valider par `chef-de-projet` |
| **M2** | Aucun document ne définit **ce qui est visible en permanence** dans le backoffice | Proposé ici (§1.4) : environnement, recherche, alertes, rôle, bandeaux conditionnels |
| **M3** | `15` RG104 prévoit un plafond « fiches distinctes ouvertes par 24 h **à régler au Lot 5** » | L'écran affiche le compteur du jour à l'agent lui-même (« 34 fiches consultées aujourd'hui ») : le rendre visible vaut mieux que le surveiller en silence. Valeur à fixer |
| **M4** | Aucune spécification ne décrit **le comportement d'un écran sous 1024 px** au backoffice | Tranché ici : une colonne, pas de tableau, message « Cet écran est conçu pour un poste de travail ». Le backoffice n'est pas mobile-first. *Complété le 2026-09-24 par **D58*** : les conversations et la file de validation ont une vue téléphone limitée à deux gestes ; tous les autres écrans gardent cette règle. *Révisé le 2026-10-28 (D73, arbitrage `chef-de-projet`)* : de 768 à 1023 px, backoffice complet, navigation en liste horizontale ; sous 768 px de large ou 500 px de haut (F7, fondateur, 2026-10-29), tant que ces deux vues n'existent pas, aucun contenu métier, écran « poste de travail » (§1.7). La version « une colonne, sans tableau » est abandonnée |
| **M5** | La **langue du backoffice (D36)** reste ouverte, mais les 16 libellés de file, les ~90 motifs typés et les 48 intitulés d'alerte doivent exister en **deux langues dès le premier jour**, parce qu'ils sortent du backoffice (`15` RG124, Q12) | Toutes les clés de ce document sont fournies FR/EN |

### 7.3 Écarts constatés dans l'implémentation en cours

> Lecture de `apps/backoffice/src` le 2026-09-19, **sans aucune modification**. Un seul écran existe
> (file de vérification + tiroir de décision) plus une page de connexion et une page « leads ».
> L'intention est bonne et la file est reconnaissable ; les écarts portent sur des règles que
> `15` qualifie de **défauts bloquants**. Destinataires : `dev-react-node` et `architecte`.

| # | Écart | Règle enfreinte | Gravité |
|---|---|---|---|
| **E1** | `apps/backoffice/src/app/globals.css` fait `@import "tailwindcss"` **sans importer `tokens.css`**, et pose deux couleurs en dur (`#0f172a`, `#f8fafc`) dans `@layer base` | **D4** (Tailwind v4 alimenté **uniquement** par le fichier de tokens), `15` RG120, CA78, `CLAUDE.md` §4 | **Bloquant** |
| **E2** | Toute la palette utilisée est celle de Tailwind par défaut — `bg-slate-900`, `text-emerald-400`, `bg-amber-500/10`, `border-rose-800`, `bg-blue-600` — soit **aucune couleur du design system INFLUX**. Le vert de marque n'apparaît nulle part ; `slate-850` et `slate-750` n'existent même pas dans Tailwind | `15` RG120, CA78 | **Bloquant** |
| **E3** | **Aucune internationalisation** : tous les libellés sont en dur en français dans le JSX | `15` RG11, RG124, `CLAUDE.md` §5 | **Bloquant** |
| **E4** | Ouvrir une entrée **ne la prend pas en charge** : le tiroir s'ouvre, affiche les données, puis propose un bouton « Prendre en charge ». La lecture a donc lieu **avant** le verrou, et un clic de plus est exigé | `15` RG27 C1, CA11 ; `13` RG27 ; `08` RG64 | **Bloquant** |
| **E5** | Un **troisième onglet de décision**, « À réexaminer » | `15` RG27 C6, CA17 (« deux issues, jamais trois ») — voir **I2** | **Bloquant** |
| **E6** | La liste **n'est pas triée par échéance** et **les entrées hors délai ne sont pas remontées en tête** : l'ordre est celui de l'API | `15` RG27 C5, CA15 | **Bloquant** |
| **E7** | Le hors délai est signalé par une **couleur** (`text-rose-400`) et un glyphe `⚑` **sans libellé écrit** | `15` RG119, CA15 (« un SLA dépassé ne se signale pas uniquement en rouge ») | **Bloquant** |
| **E8** | Le verrou affiche `claimedBy.slice(0, 6)` — **un fragment d'identifiant technique**, pas un nom. Attendu : « En cours — Marie D., depuis 09 h 42 » | `15` RG27 C2, CA12 | Majeur |
| **E9** | La liste charge **toute la file** puis filtre côté client, **sans aucune pagination** | `15` RG34, CA18 (pagination plafonnée **côté serveur**, défilement et chargement intégral interdits — garde-fou anti-aspiration) | **Bloquant** |
| **E10** | Les compteurs de tête n'affichent pas **l'ancienneté de la plus ancienne entrée**, compteur permanent obligatoire. En revanche une carte « Badges délivrés (session) » a été ajoutée, qui n'est spécifiée nulle part et dont la portée (« session ») n'a aucun sens métier | `15` RG28, CA6 | Majeur |
| **E11** | **Un seul état vide**, « Aucune demande … correspondant aux critères ». Ni « dernière traitée il y a n min », ni distinction **vide / bloquée** | `15` RG24, RG32, CA6, CA7 | Majeur |
| **E12** | Les **codes de règles** apparaissent dans l'interface : « Identifiant @ constaté en ligne (RG45) * », « Motif de rejet typé (Liste fermée RG57) », « Décision de l'agent (RG47, RG49, RG56) » | Aucune règle ne l'interdit explicitement, mais un agent n'a pas à lire une référence de spécification. C'est du bruit sur un écran utilisé huit heures par jour | Mineur, à corriger |
| **E13** | Ni **rail de navigation**, ni **bandeau d'environnement**, ni **bandeau de contrôle affaibli**, ni indicateur de rôle | `15` RG107, CA71 ; `16` §J ; §1.4 de ce document | Majeur |
| **E14** | La file de vérification n'a **qu'une vue créateurs** ; l'onglet **Marques** est absent, alors que la file 4 en porte deux | `15` RG29 file 4, `08` RG61 | Majeur |
| **E15** | Le créateur est identifié par `accountId.slice(0, 8)` : **impossible de décider sans ouvrir autre chose** | `13` RG32, `08` RG63 (« chaque entrée affiche, **sans avoir à l'ouvrir**, … ») | Majeur |
| **E16** | **Aucun raccourci clavier** ; toutes les actions passent par la souris | `15` RG113, RG114, CA75 | Majeur |
| **E17** | Les pièces s'ouvrent par `<a href="/api/storage/files/⟨id⟩" target="_blank">`. Le relais par l'API est correct (`03` BO-5) — **mais rien ne garantit ici que chaque ouverture soit journalisée séparément**, et le lien est copiable | `03` C(14), T9 ; `15` RG109-8 | **À vérifier côté API** |
| **E18** | `payload: any`, `err: any` dans le tiroir de décision | `CLAUDE.md` §5 (« le `any` est interdit sauf justification en commentaire ») | Mineur — hors périmètre UX, signalé à `dev-react-node` |

> **Ce qui est déjà juste et mérite d'être conservé** : le tableau plutôt que des cartes ; le verrou
> visible avec son état ; les motifs de refus lus depuis une **liste fermée typée**
> (`VERIFICATION_REJECTION_REASONS`) ; **le message envoyé au créateur affiché avant la décision** ;
> le commentaire obligatoire sur le motif « autre » ; le marqueur `▮` déjà présent sur les boutons
> de consultation. Le squelette est bon : les écarts sont de conformité, pas de conception.

### 7.4 Ce qui reste à valider par le fondateur

| # | Point | Pourquoi il lui revient |
|---|---|---|
| **V1** | **Les deux nouvelles couleurs de la vue identifiée** (`#a78bfa`, `#17121f`, §6.2) | Toute extension de palette relève du fondateur (**D6**, `CLAUDE.md` §4). Contrastes calculés et conformes ; la teinte reste un choix de marque |
| **V2** | **La langue du backoffice** (**D36**) | Le français est la valeur d'attente. Les motifs et leurs messages aux membres existent dans les deux langues dès le premier jour — c'est déjà tranché par `15` Q12, mais l'interface elle-même attend l'arbitrage |
| **V3** | **Deux comptes distincts ou étape d'élévation** pour la personne qui cumule `agent` et `admin` (`15` RG108, **Q13**) | Ce document affiche le rôle en permanence dans la bande de tête ; si l'élévation est retenue, un écran d'élévation s'y ajoute. **Les deux sont acceptables ; l'absence des deux ne l'est pas** |
| **V4** | **L'affichage du net créateur** (incohérence **I3**) | Le fondateur valide la transparence financière (`CLAUDE.md` §3). Ce document a tranché pour l'absence totale au MVP ; c'est un choix de discours autant que d'écran |
| **V5** | **Un envoi transactionnel unitaire depuis la fiche de compte** (manque **I11**) | Sans lui, un commercial qui doit écrire à un membre sort de la plateforme. Avec lui, une nouvelle surface d'envoi apparaît — **veto `expert-conformite-rgpd`** attendu |
| **V6** | **Le seuil de fiches distinctes consultées par 24 h** (**M3**, `15` RG104) | Trop bas, il gêne un commercial actif ; trop haut, il ne détecte rien |
| **V7** | **Le canal de documents** (`12` **Q5**, file 11) | Son maintien conditionne une file, un écran et une charge de modération quotidienne |

---

## 8. Récapitulatif — les écrans spécifiés

| # | Écran | § | Rôles | Lot |
|---|---|---|---|---|
| 1 | Rail de navigation et bande de tête permanente | 1.2, 1.4 | `agent` `admin` | 0 → 5 |
| 2 | Recherche globale (`⌘K`) | 1.5 | `agent` `admin` | 5 |
| 3 | Tableau de bord `agent` — 5 blocs | 1.6 | `agent` | 5 |
| 4 | Tableau de bord `admin` — 8 blocs | 1.6 | `admin` | 5 |
| 5 | **Gabarit de file** — liste, filtres, compteurs, états vide / bloquée | 2.2, 2.3, 2.8 | `agent` `admin` | 1 → 5 |
| 6 | **Gabarit de décision** — 5 blocs, 2 issues | 2.5, 2.6 | `agent` `admin` | 1 → 5 |
| 7 | Les 16 files, colonnes et issues | 2.7 | `agent` `admin` | 1 → 5 |
| 8 | Décision sur une demande de contact / candidature | 3.1 | `agent` `admin` | 4 |
| 9 | Confirmation d'une révélation d'identité | 3.1 | `agent` `admin` | 4 |
| 10 | **Proposition INFLUX** — panneau et compte rendu | 3.2 | `agent` `admin` | 4 |
| 11 | Recherche de créateurs en **vue identifiée** | 3.3 | `agent` `admin` | 3 |
| 12 | Conversation — motif de lecture préalable | 3.4.a | `agent` `admin` | 4 |
| 13 | Conversation — fil à trois | 3.4.b | `agent` `admin` | 4 |
| 14 | Conversation — ajout d'un agent | 3.4.c | `agent` `admin` | 4 |
| 15 | Journal des lectures de conversations | 3.4.d | `admin` | 5 |
| 16 | **Fiche de compte marque** — 11 blocs | 3.5 | `agent` `admin` | 2 |
| 17 | **Fiche de compte créateur** — 13 blocs | 3.6 | `agent` `admin` | 2 |
| 18 | Vérification d'un profil et attribution du badge | 3.7 | `agent` `admin` | 2 |
| 19 | Validation d'une campagne | 3.8 | `agent` `admin` | 3 |
| 20 | Revue renforcée — deux examens | 3.8 | `agent` + `admin` | 3 |
| 21 | Liste des affaires et totaux par devise | 3.9.a | `agent` `admin` | 5 |
| 22 | Fiche d'affaire — états, montants, encaissements | 3.9.b | responsable, `admin` | 5 |
| 23 | E-mails — écran 1, « Mes envois » | 3.10 | `agent` `admin` | 5 |
| 24 | E-mails — écran 2, la source | 3.10 | `agent` `admin` | 5 |
| 25 | E-mails — écran 3, le périmètre | 3.10 | `agent` `admin` | 5 |
| 26 | E-mails — écran 4, modèle, langue, aperçu | 3.10 | `agent` `admin` | 5 |
| 27 | E-mails — écran 5, volume et écartés | 3.10 | `agent` `admin` | 5 |
| 28 | E-mails — écran 6, double confirmation | 3.10, 4.4 | `agent` `admin` | 5 |
| 29 | E-mails — écran 7, fenêtre d'annulation | 3.10 | tous rôles internes | 5 |
| 30 | E-mails transactionnels et délivrabilité du code | 3.10 | `admin` | 5 |
| 31 | Interrupteur d'urgence des envois | 3.10 | `admin` | 5 |
| 32 | Supervision des leads — échecs de synchronisation | 3.11 | `agent` `admin` | 1 |
| 33 | Adresses injoignables | 3.11 | `agent`, correction `admin` | 1 |
| 34 | Demande relative aux données personnelles — 7 étapes | 3.12 | instruction `agent`, exécution `admin` | 5 |
| 35 | Liste et fiche des comptes internes | 3.13.a | `admin` | 0 → 5 |
| 36 | Désactivation d'un compte interne (refus motivé) | 3.13.a | `admin` | 5 |
| 37 | Transfert de portefeuille (M5) | 3.13.a | `admin` | 5 |
| 38 | Compte de secours | 3.13.b | `admin` + fondateur | 0 |
| 39 | Double validation — forme cible | 3.13.c | `admin` | 5 |
| 40 | Confirmation différée — forme dégradée | 3.13.c, 4.5 | `agent` `admin` | 0 → 5 |
| 41 | Panneau de suspension et de levée | 4.3, 3.13.c | `agent` demande, `admin` lève | 5 |
| 42 | Panneau de réattribution | 2.5, 3.5 | `agent` `admin` | 4 |
| 43 | Centre d'alertes — 48 alertes, état / événement | 1.2, 6.4 | `agent` `admin` | 5 |
| 44 | Écran d'export — E1 à E4 | 3.12, 6.4 | `admin` (E4 : `agent`) | 5 |
| 45 | Santé technique *(additif J9)* | 3.15 | `admin` | 1 |

**45 écrans**, construits sur **11 composants transverses** (§4) et **un gabarit de file unique**
appliqué à 16 files.

---

**Ce document ne modifie aucun autre fichier.** Les incohérences de §7.1 sont adressées à
`product-owner`, `expert-paiement-facturation` et `chef-de-projet` ; les manques de §7.2 à
`product-owner` ; les écarts d'implémentation de §7.3 à `dev-react-node` et `architecte` ; les
extensions de tokens de §6 au **fondateur** (**D6**) ; la validation d'accessibilité finale à
`testeur` (document `18`). Les écrans destinés aux membres relèvent de
`docs/mvp/17-parcours-et-ecrans-espaces-membres.md`.
