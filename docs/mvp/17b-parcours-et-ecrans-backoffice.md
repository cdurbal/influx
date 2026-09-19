# Lot 5 — Parcours et écrans du backoffice INFLUX

> **Date :** 2026-09-19 · **Auteur :** `expert-ux`
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
| Largeurs | **Dense** = ≥ 1280 px (`breakpoint-xl`), poste de travail standard. **Étroite** = 1024–1280 px (`breakpoint-lg`), portable. En dessous de 1024 px : mise en page en une colonne, sans tableau — **le backoffice n'est pas mobile-first**, c'est le seul endroit du produit où cette règle ne s'applique pas (`CLAUDE.md` §5.2 point 6, qui vise les parcours influenceurs) |

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
│ ⬤ PRODUCTION │ INFLUX Backoffice      [⌕ Rechercher ⌘K]      ⚑ 3  Marie D. (agent) ▾ │  ← barre 1
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
│ 1 · À TRAITER MAINTENANT                                                    ‹g puis 1›  │
│   ⚑ HORS DÉLAI ─────────────────────────────────────────────────────────────────────   │
│   │ MER-2026-000118  Demande de contact   hors délai depuis 3 h 12   [· Ouvrir] ▮  │   │
│   ────────────────────────────────────────────────────────────────────────────────    │
│   Entrées dont je tiens le verrou (2) · Tâches datées (1) · Alertes non classées (3)   │
│                                                                                         │
│ 2 · LES FILES                                                               ‹g puis 2›  │
│   ┌──────────────────────────────┬────────┬───────────────┬───────────┬─────────────┐  │
│   │ File                         │ En att.│ Plus ancienne │ Hors délai│ Sans preneur│  │
│   ├──────────────────────────────┼────────┼───────────────┼───────────┼─────────────┤  │
│   │ Demandes de contact & cand.  │     7  │  0 h 22       │        0  │          1  │  │
│   │ Campagnes à valider          │     3  │  3 h 30  ⚑    │        1  │          0  │  │
│   │ Profils créateur             │     0  │  — dernière traitée il y a 12 min       │  │
│   │ Adresses injoignables        │     0  │  ⛔ bloquée — rien depuis 26 h ouvrées   │  │
│   └──────────────────────────────┴────────┴───────────────┴───────────┴─────────────┘  │
│                                                                                         │
│ 3 · MES AFFAIRES                                                            ‹g puis 3›  │
│ 4 · MA SEMAINE                                                              ‹g puis 4›  │
│   Commission convenue      EUR  4 200,00      Commission encaissée  EUR  2 100,00      │
│                            GBP    900,00                            GBP      0,00      │
│   Écart convenue − encaissée  EUR 2 100,00 · GBP 900,00                                │
│   ⓘ Montants présentés par devise, sans conversion.                                    │
│ 5 · MON ACTIVITÉ                                                            ‹g puis 5›  │
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
| **Sauts clavier** | `‹g puis n›` amène le focus sur le bloc n. `‹?›` affiche la liste des raccourcis |

---

<!-- SUITE -->
