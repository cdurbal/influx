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
| 1 | Profils marque à valider | Raison sociale · pays · complétude · champs modifiés · responsable | Pays · première soumission / modification | Publier · Refuser (motifs `06`) | Non |
| 2 | Profils créateur à valider | Alias · pays · réseaux déclarés · complétude · badges | Pays · réseau · avec/sans badge | Publier · Refuser (motifs `07`) | Non |
| 3 | Visuels de portfolio à modérer | Vignette · alias · date de dépôt · nb de visuels du profil | Profil · type | Approuver · Refuser (motifs `07` RG97) | **Oui** — un seul profil, **20 max**, motif commun (M4) |
| 4 | Demandes de vérification et badge | **Deux onglets : Créateurs · Marques** · niveau demandé · réseau · pièces | Niveau · réseau · population | Accorder · Refuser (motifs `08`) | Non |
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
│    ┌───────────┬──────────┬────────────┬───────────────┬─────────────────┐ │
│    │ Réseau    │ Abonnés  │ Engagement │ Date de mesure│ Source          │ │
│    ├───────────┼──────────┼────────────┼───────────────┼─────────────────┤ │
│    │ Instagram │  84 210  │ 4,2 %      │ 21/08/2026    │ capture vérifiée│ │
│    │ TikTok    │  31 540  │ 6,1 %      │ 21/08/2026    │ capture vérifiée│ │
│    └───────────┴──────────┴────────────┴───────────────┴─────────────────┘ │
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
accorder ou refuser. **Deux onglets — Créateurs · Marques — jamais un écran mixte** (`08` RG61).

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
│    Abonnés constatés *        [        ]   ⓘ chiffre lu sur la pièce       │
│    Période affichée *         du [      ] au [      ]                      │
│    Engagement constaté (fac.) [        ] %                                 │
│    Déclaré par le créateur : 86 000 abonnés   → écart : à calculer après   │
│                                                  saisie                    │
├────────────────────────────────────────────────────────────────────────────┤
│ ④ DÉCISION                                                                 │
│    [■ Accorder le badge Audience ‹v›]     [⚠ Refuser avec motif ‹r›]       │
│    ⓘ Le badge Audience expire 90 jours après la date de mesure            │
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

---

<!-- SUITE -->
