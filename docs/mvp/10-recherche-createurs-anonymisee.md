# Lot 3 — Recherche de créateurs anonymisée, tri explicable et vue commerciale identifiée

> **⚠️ Régime du pilote — D78 (arbitrage du fondateur du 2026-11-01, étendu au Lot 3 le 2026-11-13, option A).**
> Aucun tarif n'est saisi par un créateur (`07` §G) ni affiché, filtré ou trié dans la recherche. **F12, RG18 et RG19
> sont suspendues** ; le **tri « tarif indicatif croissant »** (RG43) et le critère **« fourchette tarifaire compatible
> avec le budget »** (RG35 palier 2, RG41, RG73) sont **retirés du tri explicable** ; les explications ne citent **aucun
> montant**. Toute autre mention d'un tarif ou d'une tranche tarifaire dans ce document est suspendue (D78) ; colonnes
> et tables gardées en base (`04` §5.2) : seuls la saisie et l'affichage sont suspendus. La dernière phrase de RG19
> (aucun net créateur dans un écran de recherche) reste en vigueur.

> **Date :** 2026-09-19 · **Auteur :** agent `expert-matching` · **Statut :** spécification complète de
> la recherche de créateurs (Lot 3), soumise à la validation de `product-owner`, avec **avis
> obligatoire (veto) de `expert-conformite-rgpd`** sur §F (k-anonymat), §G (garde-fous et journal),
> §I (anonymisation par la base) et §Questions ouvertes, et **avis obligatoire de
> `expert-cybersecurite`** sur §G et §I.
>
> **Skills appliquées :** `matching-spec` Partie A (règle de continuité A1, règle d'or des tranches
> A2, champs interdits A3, anonymisation par la base A4, k-anonymat A5, carte A6, tri A7, exclusions
> A8, garde-fous A9, vue commerciale A10, facettes A11, conformité A12, mesure A13, cas de test A14),
> `feature-spec` (format de sortie, 8 cas limites, 7 contrôles INFLUX).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité, §2 modèle économique) ·
> `docs/mvp/00-cadrage-mvp-v2.md` (arbitrages A1 à A12, Lot 3, **D38**, **D39**) ·
> `docs/mvp/03-matrice-des-droits-et-rls.md` (conditions C(10), C(11), C(13), C(16), C(17), C(18),
> C(26) — **la mise en œuvre technique de l'anonymisation s'y trouve, pas ici**) ·
> `docs/mvp/04-modele-de-donnees-mvp.md` §5.2 (trois objets créateur) et §5.5 (tables `search.*`) ·
> `docs/mvp/06-criteres-profil-marque.md` (le profil marque, côté demandeur) ·
> `docs/mvp/07-criteres-profil-createur-reseaux-audience.md` (**le profil créateur : toutes les
> facettes de ce document s'y rattachent champ par champ ; aucune facette n'est inventée ici**) ·
> `docs/mvp/08-verification-et-badge.md` (la facette badge consomme ce document, elle ne le définit
> pas) · `docs/mvp/09-criteres-campagne.md` (document jumeau, rédigé en parallèle : le pont
> recherche ↔ campagne décrit ici en dépend).
>
> **Ce que ce document tranche :** la liste exacte des facettes et leur ordre d'ouverture, la
> sémantique de combinaison des filtres, les exclusions automatiques et leur silence, le tri par
> défaut palier par palier, la phrase d'explication affichée sur une carte, le contenu exact de la
> carte anonyme, les deux actions possibles, le seuil de k-anonymat et sa porte de sortie
> commerciale, les garde-fous anti-aspiration, les cinq différences de la vue commerciale
> identifiée, et la règle d'implémentation de l'anonymisation.
>
> **Ce qu'il ne tranche pas :** la maquette, la microcopie et l'ergonomie des filtres (`expert-ux`) ;
> le schéma SQL, les index, les politiques d'accès et la formulation des `GRANT`
> (`expert-database`, `expert-cybersecurite`, document `03`) ; la file de validation, la révélation
> d'identité et la conversation à trois (Lot 4) ; la recherche de campagnes côté créateur, sauf sa
> taxonomie, qui est celle de ce document ; **tout algorithme de scoring (D11, reportée)**.
>
> **Invariant rappelé :** aucun contrat, aucune facture, aucun encaissement n'existe dans ce
> périmètre (arbitrage **A1**). Les seuls montants manipulés sont des **tranches de tarif indicatif**
> exprimées en **coût total pour l'annonceur, commission de 35 % incluse** (document `07` RG65), et
> des **tranches de budget indicatif** côté marque (document `06` RG31). **Aucun net créateur n'est
> jamais affiché à une marque** (document `07` RG70). **Au pilote (D78)**, aucune tranche de tarif n'est manipulée ni
> comparée à un budget.

---

## Besoin

**Permettre à une marque de trouver seule, en moins de deux minutes, une poignée de créateurs
crédibles pour son besoin — sans qu'aucun résultat, aucune explication et aucune réponse d'API ne
lui donne le moyen de retrouver ces créateurs hors d'INFLUX.**

Quatre raisons d'être, dans cet ordre :

1. **Commerciale.** La recherche est le seul écran où une marque se sert elle-même. Sans elle, chaque
   mise en relation coûte un commercial, et le plafond de croissance d'INFLUX devient humain avant
   d'être technique.
2. **Protection du modèle économique.** Une marque qui obtient un `@` n'a plus besoin d'INFLUX et la
   commission de 35 % disparaît. La recherche est l'écran qui expose le plus de profils au plus grand
   nombre : c'est la surface d'attaque principale du produit.
3. **Préparation de D11.** Le journal des recherches — filtres appliqués, rang affiché, rang cliqué,
   demande créée — est **le seul jeu de données** qui permettra un jour de régler des pondérations
   autrement qu'à l'intuition. Il se collecte maintenant ou jamais (`matching-spec` A1).
4. **Outil du commercial.** La même recherche, en vue identifiée, remplace la mémoire du fondateur
   par un outil reproductible par un nouvel arrivant. C'est le point de départ de la **proposition
   INFLUX** du Lot 4.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Marque** (rôle `advertiser`) | Lance une recherche, applique des facettes, consulte des cartes anonymes, ajoute à une sélection, demande une mise en relation, demande une sélection à l'équipe INFLUX |
| **Créateur** | **N'agit pas dans ce périmètre.** Il y est **exposé** : il apparaît ou non, sous son alias, selon son état de profil et son interrupteur de visibilité. Il n'est **jamais** notifié d'une consultation (document `07` RG105) |
| **Commercial INFLUX** (rôle `agent`) | Utilise la **même recherche en vue identifiée** : identités visibles, brouillons visibles, sélection multiple, filtrage par campagne, préparation d'une proposition INFLUX. Traite les demandes « sélection par l'équipe » |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, plus : ouverture et fermeture de la recherche (D38), réglage des paramètres (seuil, plafonds, facettes ouvertes), traitement des alertes d'aspiration |
| **Système** | Applique les exclusions, compte pour le k-anonymat, trie, compose l'explication, plafonne la pagination et le débit, journalise chaque recherche et chaque impression, alerte sur les volumes anormaux |

> **Deux populations, deux écrans.** Ce document ne décrit **que** la recherche de créateurs par une
> marque et par un commercial. La **recherche de campagnes par un créateur** est un autre écran, avec
> d'autres libellés — elle réutilise **la taxonomie et les bornes de tranches définies ici**, et rien
> d'autre. **D41** (un rôle par compte) s'applique.

---

## User stories

### Marque

- **US1** — En tant que **marque**, je veux filtrer les créateurs sur ce qui décide vraiment d'une
  collaboration (thématique, réseau, taille d'audience, pays de l'audience, langue, format, budget
  (*suspendu au pilote, D78*), badge), afin d'obtenir une liste courte et crédible sans appeler personne.
- **US2** — En tant que **marque**, je veux comprendre **pourquoi** chaque profil m'est proposé, afin
  de juger la liste au lieu de la subir.
- **US3** — En tant que **marque**, je veux savoir **quand les chiffres ont été mis à jour** et **ce
  qui a été vérifié par INFLUX**, afin de savoir ce que je peux croire.
- **US4** — En tant que **marque**, je veux constituer une sélection privée avant de m'engager, afin
  de comparer tranquillement puis de demander plusieurs mises en relation d'un coup.
- **US5** — En tant que **marque**, je veux demander une mise en relation depuis une carte, afin de
  passer à la conversation sans changer d'outil.
- **US6** — En tant que **marque** dont la recherche ne donne rien, je veux qu'on me propose
  d'élargir ou de confier ma demande à l'équipe INFLUX, afin de ne pas rester devant un écran vide.
- **US7** — En tant que **marque**, je veux partir de ma campagne et retrouver les créateurs qui lui
  correspondent, afin de ne pas ressaisir mon brief sous forme de filtres.

### Créateur

- **US8** — En tant que **créateur**, je veux qu'aucune marque ne puisse me retrouver hors d'INFLUX
  à partir de ce qu'elle voit dans la recherche, afin de ne pas être court-circuité.
- **US9** — En tant que **créateur**, je veux savoir que je figure dans un annuaire consultable sous
  forme anonymisée, ce qui y est visible, et comment m'en retirer, afin de garder le contrôle.
- **US10** — En tant que **créateur récemment inscrit**, je veux apparaître dans les résultats malgré
  l'absence d'historique, afin d'avoir une chance de recevoir une première demande.

### Commercial et administrateur

- **US11** — En tant que **commercial**, je veux la même recherche avec les identités visibles, afin
  de préparer une proposition en connaissance de cause.
- **US12** — En tant que **commercial**, je veux partir d'une campagne, sélectionner plusieurs
  créateurs et écrire un motif, afin d'ouvrir plusieurs mises en relation en trois clics.
- **US13** — En tant que **commercial**, je veux voir les profils encore en brouillon, afin de
  relancer leurs auteurs quand une campagne les attend.
- **US14** — En tant que **commercial**, je veux recevoir les demandes « sélection par l'équipe »
  avec les critères déjà saisis, afin de répondre à un brief déjà écrit.
- **US15** — En tant qu'**administrateur**, je veux ouvrir ou fermer la recherche et régler ses
  plafonds sans redéploiement, afin de suivre la masse critique de profils (**D38**).
- **US16** — En tant qu'**administrateur**, je veux être alerté d'un comportement d'aspiration, afin
  d'agir avant que l'annuaire ne soit copié.

### Système

- **US17** — En tant que **système**, je veux qu'aucun champ identifiant ne figure dans une réponse
  servie à une marque avant révélation, afin que l'anonymisation ne dépende pas de la discipline d'un
  développeur.
- **US18** — En tant que **système**, je veux journaliser chaque recherche, chaque profil affiché et
  chaque profil ouvert, afin que le réglage futur des pondérations (**D11**) repose sur des faits.

---

## Règles de gestion

### A — Périmètre, ouverture de la recherche et principes

**RG1** — La recherche de créateurs est accessible à un compte **marque authentifié dont le profil
est `publié`**. Un compte marque en brouillon, en attente de validation, refusé ou suspendu n'y
accède pas : il voit à la place le formulaire de critères et le bouton **« Demander une sélection à
l'équipe INFLUX »** (RG61). Un catalogue de créateurs n'est pas un écran de démonstration : on ne
l'ouvre qu'à un demandeur qualifié.

**RG2** — **L'ouverture de la recherche aux marques est portée par un paramètre en table**
(`search.is_open_to_advertisers`), modifiable par un rôle `admin` sans redéploiement, et journalisée
à chaque changement. **D38** : le système calcule quotidiennement deux compteurs — nombre de profils
créateur publiés et visibles, et nombre de profils par thématique principale — et **propose**
l'ouverture lorsque les seuils paramétrés sont atteints (valeurs de départ : **30 profils publiés et
5 par thématique**). **L'ouverture reste une décision humaine** : l'atteinte des seuils déclenche une
alerte au backoffice, jamais l'activation.

**RG3** — Tant que la recherche est fermée, ou pour une thématique dont le compteur est sous le seuil
paramétré, l'écran marque reste accessible mais **n'affiche aucune liste** : il présente les
critères, un message unique et le bouton de demande de sélection. La **vue commerciale identifiée
(§H) reste ouverte en permanence**, indépendamment de ce paramètre : elle est le seul outil de mise
en relation tant que le catalogue est petit.

**RG4** — **Il existe un seul moteur de recherche et une seule taxonomie**, servis en **deux modes**
(`advertiser_anonymous` et `agent_identified`, document `04` §5.5). Le mode conditionne les champs
retournés, les exclusions et les garde-fous — **jamais la liste des facettes ni les bornes de
tranches**. Deux moteurs divergeraient en trois mois.

**RG5** — **Aucun score, aucune note, aucun pourcentage de compatibilité n'est calculé, stocké ni
affiché** (**D11**). Le classement est un **enchaînement de paliers déterministes** (§D). Un même
jeu de filtres, lancé deux fois le même jour, renvoie **exactement le même ordre**.

**RG6** — **Toute facette est une liste fermée ou une tranche, jamais un texte libre et jamais une
valeur exacte** (`matching-spec` A2). Il n'existe **aucun champ de recherche en texte libre** dans la
vue marque : un texte libre ne se filtre pas, ne se pondère pas, ne se traduit pas — et il permet de
tester un pseudo au clavier, ce qui transforme l'annuaire en oracle.

**RG7** — **Les bornes de tranches sont identiques partout** : profil créateur (document `07` RG22),
profil marque (document `06` RG29), campagne, facette de recherche, explication affichée, et futur
critère de score. Une tranche redéfinie dans un seul écran rend toute comparaison fausse.

**RG8** — Une recherche **ne produit aucune notification au créateur**, ni immédiate ni différée. Un
créateur ne sait jamais qu'il a été affiché, ouvert, ajouté à une sélection, ni par qui (document
`07` RG105, condition `03` C(18)).

**RG9** — Chaque facette de ce document correspond à **un champ existant du profil créateur**
(document `07`, tableau central de RG16). **Aucune facette n'est créée sans champ**, et tout champ de
couche A du profil créateur qui n'apparaît ni comme facette, ni comme élément de carte, ni comme
palier de tri, est signalé à `product-owner` comme friction de saisie sans contrepartie.

### B — Les facettes

**RG10** — Les facettes sont ouvertes **en trois vagues**. Le nombre ouvert au lancement est
volontairement réduit : avec une trentaine de profils publiés (D38), ouvrir vingt filtres garantit
que la majorité des recherches passe sous le seuil de k-anonymat et n'affiche rien. **La donnée est
collectée dès le profil créateur pour toutes les facettes, y compris celles dont le filtre est
fermé** (`matching-spec` A1).

**RG11** — **L'ouverture de chaque facette est un paramètre en table** (`search.facet_settings` :
code, vague, ouverte oui/non, ordre d'affichage), modifiable par un rôle `admin`, journalisé. Ouvrir
ou fermer une facette **est un changement de version** au sens de la mesure (RG88).

**RG12 — SOCLE, ouvert dès le premier jour de la recherche (8 facettes).**

| # | Facette | Format exposé | Champ source (document `07`) | Pourquoi elle existe |
|---|---|---|---|---|
| **F1** | Thématique principale | Liste fermée `reference.topics`, 1 choix | Thématique principale, couche A | Premier réflexe de toute marque ; futur critère au poids le plus fort |
| **F3** | Réseaux couverts | Liste fermée `reference.networks`, multi-choix | Ligne de réseau, couche A | Une campagne TikTok adressée à un profil sans TikTok est une demande morte |
| **F4** | Tranche d'audience **par réseau** | Tranche `reference.audience_bands` (nano · micro · mid · macro · méga) | `audience_band` par ligne de réseau | Détermine le budget et le type de campagne. **Jamais le nombre exact** |
| **F6** | Pays principal de l'audience **et sa part** | Liste fermée `reference.countries` + tranche (≥ 80 % · 50-80 % · < 50 %) | Pays principal d'audience et sa part, couche A | **La facette la plus utile** : une audience hors marché annule toute pertinence thématique |
| **F8** | Langues de publication | Liste fermée `reference.languages`, multi-choix | Langues de publication, couche A | Sépare les marchés FR / EN / PT ; condition d'exécution du brief |
| **F11** | Formats proposés | Liste fermée `reference.formats`, multi-choix | Formats proposés, couche A | Format non proposé = demande morte ; futur critère de format |
| **F12** | Fourchette tarifaire **par format et par réseau** — *suspendue (D78)* | Tranche `reference.price_bands` + **devise obligatoire** | Tarif indicatif par (réseau, format), couche A | Compatibilité économique : première cause d'échec en négociation |
| **F17** | Badge | Multi-choix : « Compte vérifié » · « Audience vérifiée » | Badges par réseau, couche A | Confiance et qualité ; rend le badge désirable, donc alimente la vérification |

*Au pilote (D78), le socle compte **7 facettes** ouvertes : F12 est suspendue, aucun tarif n'étant saisi (`07` §G).
Sa réouverture suppose la levée de D78.*

**RG13 — SECONDE VAGUE, ouverte quand le volume le permet (facette par facette, RG11).**

| # | Facette | Format exposé | Champ source (document `07`) | Pourquoi elle existe |
|---|---|---|---|---|
| **F2** | Thématiques secondaires | Multi-choix, ≤ 3 | Thématiques secondaires, couche A | Élargit la découverte sans diluer la thématique principale |
| **F5** | Tranche de taux d'engagement | Tranche, **valeurs vérifiées uniquement** | `engagement_band`, **nul si non vérifié** (RG48 du `07`) | Réclamée systématiquement par les marques ; ininterprétable et manipulable si non vérifiée |
| **F7** | Autres pays d'audience ≥ 10 % | Multi-choix pays + tranche (10-25 % · 25-50 % · > 50 %) | Autres pays ≥ 10 %, couche A | Campagnes multi-pays et francophonie |
| **F9** | Répartition de genre **de l'audience** | Tranche : majorité féminine ≥ 60 % · mixte · majorité masculine ≥ 60 % | Répartition de genre de l'audience, couche A | Standard du média-planning. **Porte sur l'audience, jamais sur le créateur** (RG24) |
| **F10** | Tranche d'âge dominante **de l'audience** | Multi-choix : 18-24 · 25-34 · 35-44 · 45+ | Répartition par tranche d'âge, couche A | Adéquation au produit ; même réserve qu'en F9 |
| **F13** | Contrepartie non monétaire acceptée | Oui / non | Booléen, couche A | Ouvre le bas de marché, les jeunes marques et les tests |
| **F14** | Droits d'usage acceptés | Multi-choix `reference.usage_rights`, **avec distinction inclus / en option** | Droits d'usage inclus **et** en option, couche A | **Première cause de désaccord** en négociation : la filtrer en amont évite des conversations perdues |
| **F15** | Exclusivité sectorielle acceptée | Tranche : non · ≤ 1 mois · ≤ 3 mois · négociable | Exclusivité acceptée, couche A | **Deuxième cause de désaccord**, même raisonnement |
| **F16** | Disponibilité déclarée | Tranche : < 2 semaines · < 1 mois · complet | Disponibilité + date de déclaration, couche A | Évite les demandes mortes ; futur critère de disponibilité |
| **F18** | Expérience de collaborations | Tranche : 0 · 1-5 · 6-20 · 20+ | Expérience déclarative, couche A (RG32 du `07`) | Signal de sérieux ; augmente la confiance de la marque, donc le taux de demande |
| **F20** | Pays de résidence **et mobilité** | Pays (liste fermée) + déplacements : non · dans mon pays · international | Pays de résidence et déplacements possibles, couche A | Tournages, événements, UGC en magasin. **Jamais la ville** |
| **F22** | Ton éditorial | Multi-choix, ≤ 2 | Ton éditorial, couche A (RG34 du `07`) | Une marque écarte un créateur pertinent sur le seul critère du ton ; aujourd'hui deviné depuis la bio, donc mal |
| **F23** | Délai de livraison habituel | Tranche : < 7 j · 7-14 j · 15-30 j · > 30 j | Délai de livraison habituel, couche A | Un lancement daté ne se négocie pas avec un délai de six semaines |
| **F24** | Rythme de publication **par réseau** *(D61, 2026-09-25)* | Liste fermée `reference.publication_frequencies` : quotidien · plusieurs fois par semaine · hebdomadaire · deux fois par mois · mensuel ou moins | Rythme dérivé des publications des 30 derniers jours (`07` RG114) | **Métrique prioritaire n° 2** : un compte qui ne publie plus ne portera pas une campagne. **Promotion au socle à trancher** (Q13) |
| **F25** | Tranche de commentaires moyens par publication **par réseau** *(D61, 2026-09-25)* | Tranche `reference.comment_bands` : 0-9 · 10-49 · 50-199 · 200-999 · 1 000+ | `comment_band`, **servie même non vérifiée** (`07` RG117) | **Métrique prioritaire n° 3** : mesure une audience qui réagit, pas seulement qui existe. **Promotion au socle à trancher** (Q13) |

**RG14 — TROISIÈME VAGUE, donnée inexistante au Lot 3.**

| # | Facette | Pourquoi elle n'est pas ouverte |
|---|---|---|
| **F19** | Délai de réponse habituel du créateur | La donnée **naît au Lot 4** (file de validation, conversations). Au Lot 3, aucun créateur n'a d'historique : la facette n'aurait qu'une seule valeur, « pas encore d'historique ». Ouverte après le Lot 4, **valeur absente = neutre, jamais pénalisante** (RG45) |

**RG15 — FACETTE FERMÉE ET ASSUMÉE : la zone de résidence fine.**

La **région de résidence** (niveau administratif 1) est **affichée** sur la carte lorsque au moins
**5 profils publiés partagent le même couple (pays, région)** — seuil identique au k-anonymat, en
paramètre (document `07` RG37). Elle **n'est pas filtrable au MVP** : un filtre par région combiné à
une thématique isole une personne en deux clics, ce qui est exactement l'attaque qu'on cherche à
empêcher. La **ville n'est ni affichée, ni filtrable** avant révélation. La seule facette
géographique ouverte côté créateur est **F20 (pays + mobilité)**.

> **Écart documenté avec la demande initiale.** L'ouverture d'une facette « région » a été demandée
> au cadrage. Elle est **refusée au MVP** et inscrite en question ouverte **Q3** : si elle est un
> jour ouverte, elle devra l'être avec une garde supplémentaire — **seules les valeurs de région
> comptant au moins 5 profils publiés apparaissent dans la liste de choix**, les autres étant
> absentes sans message ni compteur, faute de quoi la liste déroulante devient elle-même un oracle.

**RG16 — FACETTES RÉSERVÉES À LA VUE COMMERCIALE** (inutiles ou dangereuses côté marque) :

| # | Facette commerciale | Source | Pourquoi elle ne sort jamais côté marque |
|---|---|---|---|
| **G1** | Statut déclaré (particulier / professionnel) | Couche **N** du profil créateur | C'est une donnée interne (document `07`, bloc 2). Exposée, elle hiérarchise les créateurs sur un critère qui ne dit rien de la qualité du travail |
| **G2** | État du profil (brouillon, en attente, publié, refusé, suspendu) | Couche N | Permet la relance commerciale ; révélerait sinon l'existence de profils non publiés |
| **G3** | Date du dernier contact INFLUX | Backoffice | Donnée commerciale interne |
| **G4** | Charge en cours (mises en relation ouvertes) | Lot 4 | Évite de surcharger un créateur ; sans objet avant le Lot 4 |
| **G5** | Déjà proposé à cette campagne | Lot 4 | Évite les doublons de proposition |
| **G6** | **Jamais proposé à personne** | Lot 4 | **Filtre d'équité** : c'est le moyen concret de corriger l'iniquité d'exposition mesurée en RG87 |
| **G7** | Taux de réponse réel | Lot 4 | Signal comportemental brut, à ne pas exposer avant d'être fiable |
| **G8** | Commercial responsable | Backoffice | Organisation interne |
| **G9** | Ville et région de résidence | Couches I et N | Logistique de tournage ; jamais exposé côté marque (RG15) |
| **G10** | **Secteurs refusés par le créateur** | Couche N | Le commercial doit comprendre pourquoi un profil est absent d'une recherche. **Jamais exposé, ni motivé, ni compté auprès d'une marque** (RG31) |

**RG17 — Sémantique de combinaison, écrite une fois pour toutes :**

- À l'intérieur d'une facette multi-choix : **OU** (« Instagram ou TikTok »).
- Entre deux facettes différentes : **ET** (« Instagram **et** beauté »).
- **F3 et F4 s'appliquent à une même ligne de réseau.** Filtrer « TikTok » + « macro » renvoie les
  créateurs **macro sur TikTok**, jamais un créateur nano sur TikTok qui serait macro sur Instagram.
  Sans cette règle, le filtre le plus utilisé du produit ment.
- **F11 et F12 s'appliquent à une même ligne (réseau, format).** Même raisonnement : un tarif de story
  ne répond pas à une demande de vidéo. *Suspendu avec F12 (D78).*
- **F6** porte sur le pays principal **et** sa part simultanément : « France » + « ≥ 80 % » n'est pas
  « France » ou « ≥ 80 % ».

**RG18** — *Suspendue (D78).* La facette **F12 (tarif)** est **toujours accompagnée d'une devise**, pré-remplie avec
celle du profil marque (document `06` RG30). **Aucune conversion de devise n'est effectuée** (D27
ouverte, document `07` RG67). Quand F12 est active, le filtre ne s'applique **qu'aux lignes de tarif
libellées dans la devise choisie** ; l'écran l'énonce en toutes lettres et propose une case
**« inclure les créateurs qui tarifent dans une autre devise, sans comparaison de montant »**. Ces
créateurs apparaissent alors **sans être filtrés sur le montant**, avec la mention « tarif dans une
autre devise » sur leur carte. Un rapprochement silencieux entre deux devises serait un mensonge
chiffré.

**RG19** — *Suspendue avec F12 (D78) ; sa dernière phrase (aucun net créateur) reste en vigueur.* La facette
**F12** porte sur le **coût total pour l'annonceur, commission de 35 %
incluse** (document `07` RG65). Le libellé du filtre l'énonce : **« budget par collaboration, coût
total »**. Aucun écran de recherche n'affiche, ne calcule ni ne laisse deviner un **net créateur**
(document `07` RG70).

**RG20** — La facette **F5 (engagement)** ne propose que des valeurs **vérifiées**. Un créateur dont
l'engagement n'est pas constaté par INFLUX est **absent des résultats quand F5 est active**, et
**présent quand elle ne l'est pas** — sans mention « non vérifié » nulle part (document `07` RG48).

**RG21** — La facette **F16 (disponibilité)** est toujours restituée **avec la date de déclaration**
sur la carte. Une disponibilité sans date ne vaut rien.

**RG22** — **La complétude du profil n'est jamais une facette** : elle est un **palier de tri**
(RG40) et n'est jamais affichée à une marque (document `07` RG86).

**RG23 — Facettes écartées, et pourquoi.** Cette liste vaut les précédentes : elle documente ce
qu'il ne faut pas rouvrir dans six mois.

| Écartée | Motif |
|---|---|
| Recherche en texte libre, recherche par pseudo | Transforme l'annuaire en oracle : on teste un nom et on sait s'il est là (RG6) |
| Ville, région, rayon kilométrique | Ré-identification quasi immédiate combinée à la thématique (RG15) |
| Nombre d'abonnés exact, engagement exact, tarif exact (au pilote, tout tarif : D78) | Violent la règle d'or des tranches (RG6) |
| Marques déjà travaillées | Identifie le créateur en une recherche web ; utile au commercial seulement |
| Âge, genre, origine, situation personnelle **du créateur** | Caractéristiques personnelles : interdites (RG24) |
| Note, étoiles, avis, nombre de contrats signés | Pas d'avis au MVP ; vaut zéro pour tout le monde au lancement, stigmatise ensuite, et un classement par note est un score nu déguisé |
| Secteurs refusés par le créateur | Devient une **exclusion silencieuse** (RG31), jamais une facette affichée |
| Complétude du profil | Palier de tri, pas un filtre exposé à la marque (RG22) |
| Date d'inscription | Ancienneté = information sur la personne, et aide au recoupement. Le besoin réel (« nouveaux profils ») est couvert par un **tri alternatif** (RG43) |

**RG24 — Conformité des facettes.** **Aucune facette ne se fonde sur une caractéristique personnelle
protégée du créateur** : genre, âge, origine, état de santé, convictions, orientation, situation
familiale. **F9 et F10 portent exclusivement sur la composition de l'audience**, agrégée et en
tranches : c'est une statistique professionnelle de média-planning portant sur des tiers. Les
libellés d'écran, les explications affichées (RG41) et l'alias (RG49) ne doivent **jamais** pouvoir
se lire comme un attribut du créateur.

**RG25** — Une facette utilisée dans **moins de 2 % des recherches** sur un trimestre est proposée au
retrait : c'est de la friction de saisie côté créateur sans contrepartie (RG87).

### C — Exclusions automatiques

**RG26 — Les exclusions priment sur le tri. Elles éliminent, elles ne se pondèrent pas.** Elles sont
appliquées **avant** le comptage du k-anonymat (RG57) et **avant** la pagination.

**RG27** — Sont **exclus des résultats servis à une marque** :

| # | Exclusion | Source |
|---|---|---|
| E1 | Profil créateur dont l'état n'est pas **`publié`** (brouillon, en attente, refusé, suspendu) | Document `07` RG3 |
| E2 | Créateur ayant désactivé **« visible dans la recherche »** | Document `07` RG8 (droit d'opposition) |
| E3 | **Compte suspendu** ou en cours de modération | Document `07` RG11 |
| E4 | Créateur **mineur ou sans attestation de majorité** | **D15** |
| E5 | **Créateur ayant bloqué cette marque**, et réciproquement | RG28 |
| E6 | **Secteur refusé** par le créateur correspondant au secteur de la marque qui cherche | Document `07` RG75, couche N |

**RG28** — Le **blocage** est une déclaration explicite d'une partie contre une autre, **symétrique
dans ses effets** : si l'une bloque l'autre, aucune des deux n'apparaît dans les résultats de
l'autre. Il est **posé et retiré depuis l'espace membre ou par un rôle interne**, motivé par un motif
typé, et **journalisé**. **La table de blocage n'existe pas encore dans le modèle de données** : elle
est demandée à `expert-database` (§Données manquantes).

**RG29** — **Une exclusion ne se montre jamais comme une exclusion.** Le profil est **absent** :
aucun message, aucun emplacement grisé, aucun décompte, et **il n'entre pas dans le nombre de
résultats**. Sinon la recherche devient un oracle qui apprend à la fois l'existence d'un profil et le
motif de son écartement.

**RG30** — Le **motif d'exclusion n'est jamais exposé ni journalisé au niveau de la marque**. Le
journal de recherche enregistre le nombre de résultats **après** exclusions, jamais « 3 profils
exclus pour secteur refusé ».

**RG31** — **Le secteur refusé (E6) est l'exclusion la plus sensible** : sa divulgation pourrait
laisser inférer une conviction personnelle du créateur. Elle est silencieuse côté marque **et côté
créateur** : la marque ne sait pas qu'elle a été écartée, le créateur ne sait pas qu'une marque l'a
cherché. Seul le commercial la voit, via la facette **G10**.

**RG32 — Une paire déjà en relation reste visible, mais signalée.** La carte porte la mention
**« vous êtes déjà en relation »** et l'action principale devient **« Ouvrir la conversation »**. La
masquer ferait croire à la disparition du profil et pousserait la marque à chercher le créateur
ailleurs — exactement ce que le modèle économique interdit.

**RG33 — Deux cas qui ne sont PAS des exclusions :**

| Cas | Traitement |
|---|---|
| Chiffres d'audience de plus de 90 jours, ou badge « Audience vérifiée » périmé | **Signalement sur la carte** (« chiffres à rafraîchir », date du badge) + **rétrogradation au palier 4** du tri (RG39). Jamais une disparition |
| Pays non ouvert aux contrats (**D26**) | **Sans objet au MVP** : le contrat est hors application (**A1**). À rouvrir en V2, comme exclusion **ou** comme avertissement — décision à prendre alors, pas maintenant |

**RG34** — Un profil dont **aucun visuel de portfolio n'est approuvé** est **affiché sans image**
(document `07` RG84), jamais exclu et jamais accompagné d'un emplacement vide ou d'une image
générique de remplacement.

### D — Tri par défaut, explication et cas froid

**RG35 — Le tri par défaut est un enchaînement de paliers lisibles, jamais un score nu.** Un
commercial doit pouvoir dire en une phrase pourquoi un profil est premier. Les paliers s'appliquent
**dans cet ordre exact**, chacun départageant les ex æquo du précédent.

| # | Palier | Ce qui est comparé | Justification |
|---|---|---|---|
| **1** | **Critères satisfaits au-delà des filtres obligatoires** | Nombre de facettes secondaires satisfaites ; **thématique principale avant thématique secondaire** | Ce que la marque a demandé prime sur ce que la plateforme préfère |
| **2** | **Adéquation à la campagne**, quand la recherche part d'une campagne | Formats, pays d'audience visés ; *fourchette tarifaire vs budget : retirée au pilote (D78)* | Le contexte connu vaut mieux qu'un critère générique |
| **3** | **Badge** | Audience vérifiée > Compte vérifié > aucun badge | La vérification est ce qui rend un profil contactable sans risque |
| **4** | **Fraîcheur des chiffres** | Chiffres de moins de 90 jours avant chiffres périmés | Un chiffre d'il y a un an fait perdre une négociation |
| **5** | **Complétude du profil** | Par paliers de 25 % (0-24, 25-49, 50-74, 75-100) | Un profil complet obtient plus de réponses. **Jamais affiché comme une note** |
| **6** | **Disponibilité déclarée** | < 2 semaines > < 1 mois > complet | Une indisponibilité déclarée est une demande morte |
| **7** | **Réactivité habituelle**, **si l'historique est suffisant** (≥ 5 demandes reçues) | Tranche de délai de réponse | Signal comportemental. **Inactif au Lot 3** : aucun créateur n'a d'historique (RG14) |
| **8** | **Rotation déterministe quotidienne** | Empreinte stable calculée sur (date UTC du jour, identifiant du créateur) | Départage équitable. **Stable dans la journée** — la pagination ne saute pas — et redistribué le lendemain : personne ne capte durablement la première place |

**RG36** — Les paliers 1 à 8 sont **déterministes et reproductibles** : deux exécutions de la même
recherche, le même jour UTC, par deux comptes différents, renvoient **le même ordre**. Le lendemain,
seul le palier 8 redistribue.

**RG37** — Le palier 2 ne s'applique que si la recherche **part d'une campagne** (RG73). Sinon il est
neutre pour tout le monde — **jamais pénalisant**.

**RG38** — Le palier 7 est **écrit mais inactif au MVP**. Il s'active facette F19 ouverte (RG14), et
**uniquement au-delà de 5 demandes reçues** par créateur. En dessous, la valeur est **neutre**.

**RG39** — Au palier 4, un profil dont les chiffres datent de **plus de 90 jours** est **rétrogradé**,
jamais masqué, et sa carte porte la mention correspondante (document `07` RG50).

**RG40** — Le palier 5 utilise la complétude **par paliers de 25 %** et **jamais sa valeur**. Le
chiffre de complétude n'apparaît dans aucune réponse servie à une marque.

**RG41 — L'explication affichée sur chaque carte.** Forme attendue :

> **« Proposé car : thématique beauté correspondante · plus de 70 % d'audience en France · propose le
> format vidéo TikTok · audience vérifiée le 12 mars 2026. »**

*Exemple révisé au pilote (D78) : le fragment « fourchette tarifaire compatible avec votre budget indicatif » est
retiré ; aucune explication ne cite un montant.*

Règles de rédaction, toutes vérifiables :

1. **2 à 4 raisons maximum**, dans l'ordre des paliers de RG35.
2. Uniquement des faits **vérifiables sur la carte elle-même** : une raison qui renvoie à une
   information non affichée est invérifiable, donc suspecte.
3. Vocabulaire **strictement celui des facettes** : un mot, un sens, partout.
4. **Jamais un nombre exact.** « 72 % d'audience en France » s'écrit **« plus de 70 % d'audience en
   France »**. Un pourcentage exact dans une explication annule la facette qu'il illustre. C'est
   l'erreur la plus facile à commettre en rédigeant les libellés.
5. **Jamais un score**, jamais « 97 % de compatibilité », jamais un classement chiffré.
6. Composée de **fragments traduits FR/EN** (next-intl, format ICU), jamais d'une phrase concaténée
   dans le code : une explication non traduite est une explication absente.

**RG42 — Ligne « Point de vigilance », facultative et honnête.** Une seule ligne, sous l'explication,
affichée si l'un de ces cas est vrai :

| Cas | Mention |
|---|---|
| Chiffres de plus de 90 jours | « Chiffres mis à jour il y a plus de 90 jours. » |
| Profil publié depuis moins de 30 jours | « Profil récent. » — **neutre**, jamais « aucun historique » |
| Badge « Audience vérifiée » périmé | « Vérification d'audience à renouveler. » |
| Tarif déclaré dans une autre devise que celle du filtre — *suspendu (D78)* | « Tarif déclaré dans une autre devise. » |
| Disponibilité déclarée « complet » | « Se déclare complet actuellement. » |

L'honnêteté du tri est ce qui rend la suggestion crédible auprès d'un acheteur professionnel. Une
liste sans réserve est lue comme une liste vendue.

**RG43 — Tris alternatifs.** Quatre, et quatre seulement (*trois au pilote : le tri par tarif est retiré, D78*) :

| Tri | Ce qu'il fait | Pourquoi il existe |
|---|---|---|
| **Audience (par tranche)** | Tranche décroissante puis paliers 3 à 8 | Besoin courant, exprimé sans jamais révéler un nombre |
| **Tarif indicatif croissant (par tranche)** — *retiré (D78)* | Tranche croissante, **dans la devise choisie** | Le budget est la première contrainte d'une PME |
| **Vérifiés d'abord** | Palier 3 remonté en tête, puis 1, 2, 4 à 8 | Une marque prudente veut d'abord ce qui a été constaté |
| **Nouveaux profils** | Profils publiés depuis moins de 30 jours d'abord, puis paliers 1 à 8 | **Traitement explicite du cas froid** : sans ce tri, un nouvel inscrit n'est jamais vu |

**RG44** — Le tri actif est **toujours nommé à l'écran** et **journalisé** (document `04` §5.5,
`filters`). Un ordre qu'on ne sait pas nommer est un score déguisé.

**RG45 — Cas froid : quatre règles explicites.** Sans elles, un nouvel inscrit n'est jamais vu, ne
reçoit aucune demande, ne produit aucun signal, et reste invisible pour toujours. La marketplace ne
démarre pas.

1. **Un signal comportemental absent vaut neutre, jamais pénalisant** (paliers 2 et 7).
2. **Étiquette « Profil récent »**, neutre, jamais « aucun historique », qui se lit comme un défaut.
3. **Quota d'exposition : au moins 2 places sur les 12 premiers résultats** sont réservées à des
   profils froids — publiés depuis moins de 30 jours, **ou** jamais encore apparus dans une première
   page. Le quota ne s'applique que si de tels profils existent dans l'ensemble filtré ; il **ne
   fabrique jamais un résultat** qui ne satisfait pas les filtres.
4. **Rotation déterministe quotidienne** (palier 8) : second mécanisme anti-« le premier arrivé rafle
   tout ».

**RG46** — Le quota de RG45 est un **paramètre en table** (2 sur 12 par défaut) et son application est
**journalisée** : on doit pouvoir mesurer, trois mois plus tard, s'il a servi à quelque chose.

### E — La carte anonyme et les deux actions

**RG47 — Ce que la carte anonyme affiche, et rien d'autre :**

| Élément | Forme |
|---|---|
| **Alias** + étiquette de contexte | « Profil 7K3M — Beauté · France » (document `07` RG23, RG24) |
| Titre court | Texte **modéré** |
| Thématique principale et secondaires | Libellés de liste fermée |
| Ton éditorial | Libellés de liste fermée |
| Réseaux couverts et, **en tête de chaque ligne, les trois métriques prioritaires** (`07` RG113, D61) : tranche d'audience · rythme de publication · tranche de commentaires moyens | Une ligne par réseau, compte principal signalé ; toujours dans cet ordre, avec la source (déclaré / constaté) et la date |
| Pays principal d'audience **et sa part en tranche** | « Plus de 70 % d'audience en France » |
| Autres pays d'audience ≥ 10 % | Pays + tranche |
| Répartition d'âge et de genre **de l'audience** | Tranches uniquement |
| **Tranche d'engagement, seulement si vérifiée** | Avec la date du constat |
| Langues de publication | Libellés |
| Formats proposés | Libellés |
| **Fourchette tarifaire par (réseau, format), avec sa devise** — *suspendue (D78)* | Tranche + devise, libellée « coût total » |
| Droits d'usage inclus / en option, exclusivité acceptée, contrepartie non monétaire | Libellés |
| Délai de livraison habituel | Tranche |
| **Disponibilité déclarée + sa date de déclaration** | Tranche + date |
| Pays de résidence, déplacements possibles, **région si ≥ 5 profils** | Libellés (RG15) |
| Expérience de collaborations | Tranche |
| **Badges et leurs dates** | Par réseau |
| **Date de dernière mise à jour des chiffres** | Date, affichée partout où un chiffre l'est |
| **1 à 3 visuels de portfolio approuvés** + légendes | Uniquement des visuels **modérés** (document `07` RG78 à RG84) |
| **La ligne « Proposé car : … »** | RG41 |
| Le cas échéant, **« Point de vigilance »** | RG42 |
| Le cas échéant, **« Vous êtes déjà en relation »** | RG32 |

**RG48 — Ce que la carte, la fiche et surtout l'API ne contiennent JAMAIS avant révélation** — liste
fermée, reprise de `matching-spec` A3 et du document `07` RG18 :

pseudo · `@` ou identifiant de compte · **URL de profil ou de publication** · nom et prénom réels ·
raison sociale · e-mail · téléphone · adresse, ville, code postal · **nombre d'abonnés exact** ·
**taux d'engagement exact** · **portée exacte** · **nombre exact de publications** · **nombre
exact de commentaires moyens** · **historique des métriques** · **pourcentages d'audience exacts** · **tarif
exact** (au pilote, tout tarif : aucun n'est saisi, D78) · **net créateur estimé** · captures d'écran brutes de statistiques · **photo de profil ou
avatar** · bio non modérée · visuel de portfolio non approuvé · pièces justificatives de vérification
· date de naissance · **secteurs refusés** · complétude · notes internes · état exact du profil ·
liste des marques déjà travaillées · **identifiant technique séquentiel ou devinable**.

> **Le contrôle porte sur la réponse de l'API, jamais sur l'écran.** Un champ absent de l'interface
> mais présent dans le JSON est une fuite complète : il suffit d'ouvrir les outils de développement
> du navigateur. **Ces champs ne figurent pas dans la réponse, pas même vides, pas même nuls.**

**RG49 — L'alias** est généré par la plateforme, **stable à vie et global** — le même pour toutes les
marques et pour le commercial, sinon une sélection, une demande de contact et une conversation ne se
rapprochent plus. Il est **jamais dérivé du pseudo**, **jamais séquentiel** (« Créateur #12 »
révélerait l'ancienneté d'inscription et la taille du catalogue) et **sans marque de genre**
(« Créatrice » est une donnée personnelle sur le créateur, RG24). Il n'est modifiable par personne
(document `07` RG23).

**RG50 — Il n'existe pas de « fiche détaillée » distincte de la carte avant révélation.** Ouvrir un
profil depuis les résultats affiche **exactement les mêmes champs**, en plus grand, avec les 3
visuels au lieu de 1. Une page de détail plus riche que la carte est le chemin par lequel les champs
interdits reviennent.

**RG51 — Deux actions depuis une carte, et deux seulement :**

| Action | Effet | Ce qu'elle ne fait pas |
|---|---|---|
| **Ajouter à ma sélection** | Ajoute le créateur à une **shortlist privée** de la marque (`search.shortlists`), éventuellement rattachée à une campagne | **Aucune notification au créateur**, aucune révélation, aucun engagement |
| **Demander une mise en relation** | Crée une entrée dans la **file de validation commerciale**, avec les critères de la recherche d'origine | **N'ouvre pas de conversation, ne révèle rien, ne garantit pas une réponse du créateur** |

**RG52** — Le libellé de la seconde action **énonce le processus** : « un commercial INFLUX valide
votre demande et vous met en relation ». Promettre un contact immédiat, c'est fabriquer la déception
— et le délai de traitement de cette file est le risque produit de premier rang (**D39**).

**RG53 — Variantes d'état de l'action principale :**

| État | Action affichée |
|---|---|
| Cas courant | « Demander une mise en relation » |
| **Demande déjà en file pour cette paire** | Action **désactivée**, « demande envoyée le … » — évite les doublons dans la file |
| **Paire déjà en relation** | « Ouvrir la conversation » (RG32) |
| Marque dont le profil n'est plus publié | Action désactivée avec le motif |

**RG54** — Toute demande de mise en relation créée depuis la recherche **conserve l'identifiant de la
recherche d'origine** (`source_search_query_id`, document `04` §5.6) et **les filtres appliqués**.
C'est **le seul lien entre ce que la marque a cherché et ce qu'elle a signé** — donnée indispensable
à **D11**, impossible à reconstituer plus tard.

**RG55 — Séquencement.** La **mécanique complète** de la demande de mise en relation (file, prise en
charge, motif de refus, révélation, conversation) relève du **Lot 4** et de la skill
`intermediation-tracking`. Si la recherche est mise en ligne **avant** le Lot 4, la carte n'expose
que **« Ajouter à ma sélection »** et **« Demander une sélection à l'équipe INFLUX »** (RG61) : on
n'affiche jamais un bouton dont la suite n'existe pas.

**RG56** — Une **troisième action « ne plus me proposer ce profil »** serait un excellent signal
négatif pour D11. Elle **n'est pas retenue au MVP** : elle expose une préférence de la marque et
complique la carte. Question ouverte **Q4**, cohérente avec la question **Q13** du document `07`.

### F — Seuil de k-anonymat et porte de sortie commerciale

**RG57 — Seuil de départ : 5.** Il est calculé sur **l'ensemble des résultats après exclusions**,
jamais sur la page courante, et vit en **paramètre en table**. **En dessous de 5 résultats, la liste
n'est pas affichée du tout** — pas même partiellement, pas même floutée, pas même sous forme
d'aperçu.

**RG58 — Le message est strictement identique pour 0 et pour 4 résultats, sans compteur.** Sinon le
décompte devient un oracle : « 4 résultats → j'ajoute un filtre → 0 résultat » isole un individu sans
l'avoir jamais affiché. Message unique :

> **« Votre recherche est trop précise pour être affichée. Élargissez un critère, ou demandez une
> sélection à l'équipe INFLUX. »**

**RG59 — Le nombre de résultats n'est jamais affiché en valeur exacte**, même au-dessus du seuil : il
est présenté **en tranche** (5-9 · 10-24 · 25-49 · 50 et plus). Un compteur exact permet une attaque
par différenciation au-dessus du seuil aussi bien qu'en dessous. Cette règle est la traduction
directe de la règle d'or des tranches à la mesure elle-même.

**RG60 — Les élargissements proposés sont pré-construits et statiques.** L'écran propose **2 à 3
élargissements** choisis par un **ordre de priorité fixe** des facettes appliquées (de la plus
restrictive à la moins restrictive selon un rang écrit à l'avance), **jamais en testant des requêtes
alternatives** : un élargissement calculé sur des décomptes réels serait lui-même un oracle. Les
formulations sont grossières et **n'annoncent aucun décompte** : « retirer le filtre de tarif » (*sans objet au pilote, F12 suspendue, D78*),
« élargir la tranche d'audience », « ajouter un pays voisin ».

**RG61 — Bouton « Demander une sélection à l'équipe INFLUX ».** Il crée une **demande au backoffice**
reprenant **tous les critères saisis**, la campagne d'origine le cas échéant, et la langue de la
marque. Ce n'est pas une impasse : c'est **un lead qualifié dont le brief est déjà écrit** —
exactement le créneau où le commercial vaut plus que l'algorithme. Le bouton est présent **en
permanence**, pas seulement sous le seuil.

**RG62 — Le k-anonymat ne s'applique pas à la vue commerciale** (§H) : le commercial voit les
identités, le seuil n'a aucun objet. En revanche ses recherches et ses consultations sont
**journalisées nominativement** (RG78).

### G — Garde-fous anti-ré-identification et anti-aspiration

**RG63** — Un annuaire anonymisé sans garde-fous se ré-identifie **par accumulation, pas par faille**.
Les valeurs ci-dessous sont des **paramètres en table**, modifiables sans redéploiement, chaque
modification journalisée.

| Garde-fou | Valeur de départ |
|---|---|
| **Pagination plafonnée** | **12 résultats par page, 5 pages, 60 résultats maximum** par recherche. Pas de saut de page arbitraire, pas de pagination profonde, pas de paramètre de taille de page côté client |
| **Export interdit** | Pas de CSV, pas de « tout sélectionner », pas d'endpoint de liste brute, **y compris en vue commerciale et y compris pour un administrateur** (condition `03` C(17)) |
| **Limitation de débit** | **30 recherches/heure, 200/jour, 60 profils ouverts/jour** par compte ; **alerte interne à 80 % du plafond** |
| **Journalisation** | **Chaque recherche et chaque impression** (RG66) |
| **Détection d'affinage** | Suite de recherches ne variant que d'un filtre et frôlant le seuil k → **alerte** (RG68) |
| **Modération des visuels** | Chaque visuel de portfolio est modéré manuellement **avant** publication (document `07` RG78) |

**RG64** — Le dépassement d'un plafond produit un **refus propre et explicite** (« vous avez atteint
la limite de recherches pour aujourd'hui, revenez demain ou demandez une sélection à l'équipe »),
jamais une erreur technique, jamais une page blanche, et **jamais une dégradation silencieuse des
résultats**. Une limite qu'on n'explique pas est lue comme une panne.

**RG65** — **Aucun identifiant technique séquentiel ou devinable** n'apparaît dans une URL, une carte
ou une réponse. La carte est référencée par son **alias** ; le lien profond utilise un identifiant
opaque non ordonné. Sinon il suffit d'incrémenter un nombre pour parcourir tout le catalogue sans
jamais lancer une recherche.

**RG66 — Journalisation, dans les tables `search.*` du document `04` §5.5 :**

| Table | Ce qui est écrit |
|---|---|
| `search.search_queries` | Compte, rôle, **mode de vue**, campagne d'origine, **filtres appliqués**, tri actif, nombre de résultats, page atteinte, **indicateur de blocage par k-anonymat**, horodatage |
| `search.search_impressions` | Pour chaque profil affiché : **rang affiché**, **profil ouvert ou non**, horodatage d'ouverture |

Ces deux tables sont **en ajout seul** : aucune correction, aucune suppression.

**RG67 — Le journal sert deux finalités, et c'est assumé : garde-fou anti-aspiration et amélioration
du produit.** Les deux figurent au registre des traitements avec une **durée de conservation écrite**
(valeur retenue au document `04` §9 : **12 mois**), validée par `expert-conformite-rgpd`.

**RG68 — Alertes au backoffice**, chacune avec son seuil paramétrable :

| Alerte | Déclencheur |
|---|---|
| **Volume anormal** | Plus de 80 % d'un plafond de débit atteint sur 24 h |
| **Aspiration probable** | Plus de N profils distincts ouverts sur 24 h **sans aucune demande de mise en relation ni ajout à une sélection** |
| **Affinage** | 6 recherches successives d'un même compte ne variant que d'un filtre, dont au moins 2 bloquées par le k-anonymat |
| **Pagination systématique** | Compte atteignant la dernière page autorisée sur plus de la moitié de ses recherches |

> **Un volume anormal est autant un signal produit qu'un signal de contournement.** 200 profils
> consultés et zéro demande, c'est **soit** de l'aspiration, **soit** une recherche qui ne convertit
> pas. Les deux hypothèses se regardent, dans cet ordre : on appelle la marque avant de la suspendre.

**RG69** — La **modération de chaque visuel de portfolio est une condition d'ouverture de la
recherche** (dépendance écrite du Lot 3). Tout le dispositif d'anonymisation est décoratif si une
image porte un `@`, un filigrane ou une interface d'application. La grille de contrôle est celle du
document `07` RG79, appliquée telle quelle, **re-modération à chaque remplacement**.

**RG70** — Aucune action de la recherche **ne permet de tester l'existence d'un profil précis** :
pas de recherche par pseudo (RG6), pas d'identifiant devinable (RG65), pas de décompte exact (RG59),
pas de message différencié sous le seuil (RG58). Ces quatre règles se tiennent ensemble : en retirer
une rend les trois autres inutiles.

### H — La vue commerciale identifiée

**RG71** — Le commercial dispose de **la même recherche, sur le même moteur, avec les mêmes facettes
et les mêmes bornes de tranches**, en mode `agent_identified`. **Cinq différences assumées**, et
elles seules :

| Point | Vue marque (`advertiser_anonymous`) | Vue commerciale (`agent_identified`) |
|---|---|---|
| **Identités** | Anonymisées (RG48) | **Visibles** : pseudo, `@`, URL, nom, ville, chiffres exacts, tarifs exacts (*aucun au pilote, D78*), historique |
| **k-anonymat** | Appliqué (seuil 5) | **Non applicable** (RG62) |
| **Profils non publiés** | Exclus (E1) | **Visibles, étiquetés « brouillon », « en attente », « refusé », « suspendu »** — le commercial relance l'auteur |
| **Blocage entre parties** | Profil absent (E5) | **Affiché avec un avertissement bloquant** : le commercial doit savoir **pourquoi** il ne peut pas proposer ce créateur |
| **Sélection** | Shortlist privée | **Sélection multiple (≤ 20)** → **« Proposer à une campagne »** |

**RG72** — La vue commerciale dispose en plus des **facettes G1 à G10** (RG16). Aucune de ces facettes
n'a de contrepartie côté marque, dans aucune circonstance.

**RG73 — Filtrage par campagne : le pont recherche ↔ campagne.** L'entrée **« Créateurs compatibles
avec la campagne X »** **pré-remplit les facettes** depuis le brief de la campagne (document `09`) :
thématiques, réseaux, formats, pays d'audience visés, langues, fourchette tarifaire depuis le budget (*suspendue, D78*),
droits d'usage et exclusivité attendus. Le commercial **corrige librement** le pré-remplissage.

> **Ce pré-remplissage, et surtout ce que le commercial ajoute ou retire ensuite, est la meilleure
> donnée d'apprentissage disponible avant D11.** Il est journalisé à ce titre : filtres proposés,
> filtres retenus, filtres retirés.

**RG74** — Depuis la sélection multiple, le commercial **écrit un motif** (obligatoire, ≥ 10
caractères, document `04` §5.6 `origin_reason`) et ouvre **autant de mises en relation que de
destinataires**, **chacune tracée séparément**. **Objectif de conception : trois clics.** Si l'outil
n'est pas plus rapide qu'un coup de fil, le commercial téléphonera et la traçabilité sera perdue.

**RG75** — Le **pré-remplissage depuis une campagne est également offert à la marque** (US7), avec les
mêmes règles, **sans les facettes G**. C'est le même pont, servi dans les deux vues.

**RG76** — La vue commerciale **n'a pas d'export** (RG63). Un besoin réel passe par une **demande
administrative motivée et journalisée**, traitée hors application. Un export industrialiserait le
contournement en une seule action — y compris par un salarié qui part.

**RG77** — La vue commerciale **affiche les mêmes explications** (RG41) que la vue marque, **plus**
les valeurs exactes sous-jacentes. Le commercial doit voir **ce que la marque voit**, sinon il ne
peut pas préparer un argumentaire cohérent avec la carte.

**RG78** — **Recherches et consultations de la vue commerciale sont journalisées nominativement** —
compte de l'agent, profils consultés, identités révélées à l'écran. C'est une surface privilégiée :
elle se surveille au moins aussi sérieusement que celle des marques.

### I — La règle d'implémentation, écrite noir sur blanc

**RG79 — RÈGLE NON NÉGOCIABLE. L'anonymisation est une séparation d'objets en base de données : un
objet identifiant sur lequel le rôle annonceur n'a aucun droit de lecture, un objet anonymisé qu'il
est seul autorisé à lire. Ce n'est ni un filtre dans un composant React, ni un `select` bien écrit
dans un contrôleur, ni une convention d'équipe, ni une revue de code.**

- `profiles.creator_public_profiles` et ses satellites (objet **anonymisé**) : la seule source de la
  recherche en mode marque.
- `profiles.creator_social_accounts` (objet **révélable**) : **aucun accès avant révélation**.
- `profiles.creator_identities` (objet **identifiant**) : **aucun `GRANT` au rôle annonceur, jamais,
  y compris après révélation**.
- La révélation est **une politique d'accès en base** qui teste l'existence d'une mise en relation
  validée, **pas un booléen passé au composant d'affichage**.
- Le front ne parle jamais directement à la base pour de la donnée métier : il passe par l'API.

**Les détails techniques — tables, colonnes, `GRANT`, politiques, fonctions — sont dans
`docs/mvp/03-matrice-des-droits-et-rls.md` §3.2 (conditions C(10) à C(17)) et
`docs/mvp/04-modele-de-donnees-mvp.md` §5.2. Ce document ne les redéfinit pas et ne doit jamais les
contredire.**

**RG80 — Pourquoi cette règle est écrite en majuscules :** c'est le bug le plus probable et le plus
grave du MVP. Il ne se voit pas à l'écran, il ne fait échouer aucun test fonctionnel, il ne provoque
aucune erreur — **et il détruit d'un seul coup D16, l'arbitrage A2, la confiance des créateurs et le
modèle économique**, puisqu'une marque qui obtient un `@` n'a plus besoin d'INFLUX. **Toute revue de
la recherche commence par cette vérification, avant toute considération d'ergonomie.**

**RG81 — Les tranches sont calculées et stockées, jamais arrondies à l'affichage** (document `07`
RG22). La valeur exacte **ne se trouve pas** dans l'objet servi à la marque. Un arrondi fait au
moment du rendu laisse la valeur exacte transiter par le réseau : c'est une fuite complète.

**RG82 — Règle de revue permanente :** *toute colonne ajoutée à un objet lu par le rôle annonceur
doit être une tranche, un code de liste fermée, une date ou un booléen. Jamais un nombre brut, jamais
un texte non modéré, jamais une URL.* Cette phrase figure dans la revue de toute migration touchant
`profiles.creator_public_*` (document `04`).

### J — Intervention humaine, mesure et évolution

**RG83 — Points d'intervention humaine, tous tracés :**

| Point | Qui | Trace |
|---|---|---|
| Ouvrir ou fermer la recherche (**D38**), régler seuils et plafonds | `admin` | Journal de paramétrage |
| Ouvrir ou fermer une facette (RG11) | `admin` | Journal de paramétrage + changement de version (RG88) |
| Traiter une demande « sélection par l'équipe » (RG61) | `agent` | Demande, agent, délai, issue |
| Sélectionner et proposer des créateurs à une campagne (RG74) | `agent` | Motif écrit, une mise en relation par destinataire |
| Relancer un profil en brouillon repéré en vue commerciale | `agent` | Journal de contact |
| Traiter une alerte d'aspiration (RG68) | `agent` / `admin` | Décision et motif typés |
| Poser ou retirer un blocage entre parties (RG28) | Membre ou rôle interne | Motif typé, journalisé |

**RG84** — Une **demande « sélection par l'équipe » sans réponse au-delà du délai paramétré** remonte
en alerte au tableau de bord, au même titre qu'une demande de mise en relation (**D39**).

**RG85 — L'entonnoir de référence au MVP** — il n'y a pas de contrat dans l'application (**A1**) :

**recherche lancée → résultats non vides → profil ouvert → ajouté à une sélection → demande de mise
en relation → demande validée → conversation ouverte → affaire signée saisie par le commercial →
commission encaissée.**

**RG86 — Indicateurs et seuils :**

| Indicateur | Ce qu'il mesure | Seuil / cible de départ |
|---|---|---|
| **Recherche → demande de mise en relation** | **Indicateur de référence de la recherche** | **Alerte sous 5 %** (RG87) |
| Demande → mise en relation validée → affaire signée | Pertinence confirmée puis convertie | Mesuré, pas de cible avant le pilote |
| Part des recherches **bloquées par le k-anonymat** | Masse critique insuffisante (**D38**) ou facettes trop fines | Alerte au-dessus de **20 %** |
| Demandes « sélection par l'équipe » **rapportées** aux demandes directes | Si la première dépasse la seconde, **le produit livré est en réalité un formulaire de brief** | Alerte si > 1 |
| **Rang moyen du profil ouvert** | Qualité du tri — **et matière première de D11** | Mesuré |
| **Profils jamais affichés en 30 jours** | Iniquité d'exposition : le tri est à corriger | Alerte au-dessus de **10 %** du catalogue |
| Profils froids présents dans les 12 premiers | Efficacité du quota (RG45) | Cible : ≥ 2 dans 95 % des recherches |
| Facettes utilisées dans moins de 2 % des recherches | Friction de saisie sans contrepartie | Retrait proposé (RG25) |
| Délai médian entre demande et validation | **D39**, risque produit de premier rang | Selon D39 |
| Alertes d'aspiration ouvertes / traitées | Santé du garde-fou | Mesuré |
| Recherches par marque active et par semaine | Usage réel du self-service | Mesuré |

**RG87 — Seuil d'alerte principal.** Si le passage **recherche → demande de mise en relation** reste
**sous 5 %** alors que les recherches renvoient des résultats, **c'est l'anonymisation elle-même
qu'il faut reconsidérer** : soit on montre davantage (visuels supplémentaires, engagement vérifié,
extrait modéré), soit on renforce l'accompagnement commercial. **Réserve de lecture obligatoire :**
cet indicateur est inexploitable si le délai de traitement de la file dérape (**D39**) — les deux se
lisent ensemble, faute de quoi on corrigera la recherche pour un problème de délai.

**RG88 — Toute modification de la liste des facettes, des bornes de tranches, de l'ordre des paliers
de tri ou du seuil de k-anonymat est traitée comme un changement de version** : version numérotée,
date, motif, **mesure avant et mesure après** sur une période définie **à l'avance**. Sans cela, on
ne saura jamais si un changement a amélioré ou dégradé le produit.

### K — Messages affichés (français et anglais)

**RG89** — Tous les messages existent en **français et en anglais**, au format ICU, **aucun écrit en
dur**. L'explication de RG41 est composée **de fragments traduits**, jamais d'une phrase concaténée.

| Clé | Français | English |
|---|---|---|
| `search.reason.prefix` | Proposé car : {reasons} | Suggested because: {reasons} |
| `search.reason.topicMatch` | thématique {topic} correspondante | matching {topic} topic |
| `search.reason.audienceCountry` | plus de {band} d'audience {country} | over {band} of audience in {country} |
| `search.reason.priceFit` *(suspendue, D78)* | fourchette tarifaire compatible avec votre budget indicatif | price range compatible with your indicative budget |
| `search.reason.formatMatch` | propose le format {format} | offers the {format} format |
| `search.reason.verified` | audience vérifiée le {date} | audience verified on {date} |
| `search.reason.available` | se déclare disponible sous {band} | declares availability within {band} |
| `search.warning.staleFigures` | Point de vigilance : chiffres mis à jour il y a plus de 90 jours. | Heads-up: figures last updated more than 90 days ago. |
| `search.warning.newProfile` | Point de vigilance : profil récent. | Heads-up: recently published profile. |
| `search.warning.otherCurrency` *(suspendue, D78)* | Point de vigilance : tarif déclaré dans une autre devise. | Heads-up: rate declared in another currency. |
| `search.kAnonymity.blocked` | Votre recherche est trop précise pour être affichée. Élargissez un critère, ou demandez une sélection à l'équipe INFLUX. | Your search is too specific to be displayed. Broaden one criterion, or ask the INFLUX team for a selection. |
| `search.results.countBand` | Environ {band} profils correspondent. | About {band} profiles match. |
| `search.action.shortlist` | Ajouter à ma sélection | Add to my selection |
| `search.action.request` | Demander une mise en relation | Request an introduction |
| `search.action.requestHint` | Un commercial INFLUX valide votre demande et vous met en relation. | An INFLUX account manager reviews your request and puts you in touch. |
| `search.action.requestSent` | Demande envoyée le {date}. | Request sent on {date}. |
| `search.action.openConversation` | Ouvrir la conversation | Open the conversation |
| `search.state.alreadyIntroduced` | Vous êtes déjà en relation avec ce profil. | You are already in touch with this profile. |
| `search.action.askTeam` | Demander une sélection à l'équipe INFLUX | Ask the INFLUX team for a selection |
| `search.closed.notice` | La recherche ouvrira lorsque notre catalogue sera assez fourni. En attendant, décrivez votre besoin : notre équipe vous propose une sélection. | Search will open once our catalogue is large enough. In the meantime, describe your need: our team will send you a selection. |
| `search.price.label` *(suspendue, D78)* | Budget par collaboration, coût total | Budget per collaboration, total cost |
| `search.rateLimit.reached` | Vous avez atteint la limite de recherches pour aujourd'hui. Revenez demain, ou demandez une sélection à l'équipe INFLUX. | You have reached today's search limit. Come back tomorrow, or ask the INFLUX team for a selection. |
| `search.currency.mixed` *(suspendue, D78)* | Les créateurs qui tarifent dans une autre devise ne sont pas comparés automatiquement. | Creators pricing in another currency are not automatically compared. |

*Au pilote (D78), `search.reason.priceFit`, `search.warning.otherCurrency`, `search.price.label` et
`search.currency.mixed` sont suspendues : aucun tarif n'est affiché ni filtré.*

---

## Cas limites

### Les huit cas limites de la skill `feature-spec`

**1 — Donnée absente ou profil incomplet**

| Situation | Comportement attendu |
|---|---|
| Un créateur n'a pas renseigné sa répartition d'audience par pays | Il **n'apparaît pas** quand F6 est active ; il apparaît sinon. Son message de complétude le lui dit (document `07` RG90) |
| Un créateur n'a pas de taux d'engagement vérifié | **Absent quand F5 est active**, présent sinon ; **aucune mention « non vérifié »** sur sa carte (RG20) |
| Un créateur n'a aucun visuel approuvé | Carte affichée **sans image**, jamais exclu, jamais d'emplacement vide (RG34) |
| Aucun filtre n'est appliqué | Recherche valide : tous les profils publiés, triés par le tri par défaut, k-anonymat sans objet au-delà de 5 |
| Une thématique a été retirée du référentiel mais reste portée par des profils | Les profils restent affichés avec leur valeur ; la facette ne propose plus la valeur retirée ; alerte de cohérence au backoffice |
| Recherche lancée depuis une campagne sans budget renseigné | Le palier 2 ignore le critère tarifaire, les autres s'appliquent. **Aucune pénalité**. *Au pilote, le critère tarifaire est retiré pour toutes les recherches (D78)* |
| Une marque sans devise au profil active F12 | La devise est demandée explicitement avant application du filtre (RG18). *Suspendu avec F12 (D78)* |
| Un créateur n'a déclaré qu'un seul réseau | Il apparaît normalement ; F3/F4 s'appliquent à sa seule ligne (RG17) |

**2 — Valeur nulle, négative ou aberrante**

| Situation | Comportement attendu |
|---|---|
| Recherche renvoyant **0** résultat | **Message identique à 4 résultats** (RG58), aucun décompte, élargissements proposés, bouton « demander une sélection » |
| Recherche renvoyant **4** résultats | Idem, **strictement** : aucune différence observable, ni dans l'écran, ni dans la réponse de l'API |
| Recherche renvoyant **5** résultats | Liste affichée, décompte **en tranche** « 5-9 » (RG59) |
| Recherche renvoyant 4 000 résultats | **60 résultats servis au maximum** (RG63), décompte en tranche « 50 et plus », pas de pagination profonde |
| Demande de la page 7 alors que 5 pages sont autorisées | **Refus propre**, message explicite, journalisé (RG64) |
| Taille de page manipulée dans la requête (200 au lieu de 12) | **Ignorée côté serveur**, valeur plafonnée, tentative journalisée |
| Tranche de tarif choisie sans devise | Filtre refusé avec message dédié (RG18). *Suspendu avec F12 (D78)* |
| Tranche d'audience « méga » + thématique rare | Souvent sous le seuil : comportement de RG58, jamais un résultat partiel |
| Créateur à 0 abonné | Tranche la plus basse, affiché normalement (document `07`, cas limites) |
| Quota de profils froids demandé (2) alors qu'aucun profil froid ne satisfait les filtres | **Aucun résultat n'est fabriqué** : la liste est simplement plus courte en profils froids (RG45) |

**3 — Doublon**

| Situation | Comportement attendu |
|---|---|
| Un créateur correspond à deux lignes de réseau du filtre | **Il apparaît une seule fois**, la carte montrant ses deux lignes |
| Le même créateur ajouté deux fois à une sélection | Une seule entrée ; message « déjà dans votre sélection », aucune erreur |
| Deux demandes de mise en relation pour la même paire | **La seconde est impossible** : action désactivée, « demande envoyée le … » (RG53) |
| Deux recherches identiques lancées à une seconde d'intervalle | Deux entrées de journal (c'est voulu : le débit se mesure), **même ordre de résultats** (RG36) |
| La même marque ouvre deux onglets et pagine dans les deux | Ordre identique dans les deux onglets le même jour (palier 8, RG35) |
| Un créateur figure déjà dans une sélection rattachée à une autre campagne | Les deux sélections coexistent ; aucune fusion automatique |

**4 — Action concurrente**

| Situation | Comportement attendu |
|---|---|
| Un créateur se retire de la recherche pendant qu'une marque consulte sa carte | La consultation en cours n'échoue pas ; **le profil disparaît des recherches suivantes** ; **aucune demande ne peut plus être créée depuis une carte périmée** (message explicite) |
| Un créateur est suspendu pendant qu'il figure dans une sélection | Il reste dans la sélection, **étiqueté « indisponible »**, et l'action de demande est désactivée |
| Un agent modifie un paramètre (seuil k, plafond) pendant des recherches en cours | La valeur s'applique **à la recherche suivante**, jamais rétroactivement ; changement journalisé |
| Deux commerciaux sélectionnent le même créateur pour la même campagne | Les deux sélections existent ; à l'ouverture des mises en relation, **la seconde est refusée comme doublon** avec le nom du premier agent (Lot 4) |
| Le catalogue passe sous le seuil de masse critique pendant que la recherche est ouverte | La recherche **reste ouverte** : la fermeture est une décision humaine (RG2). Une alerte remonte au backoffice |
| Un visuel est retiré par le créateur pendant qu'il est affiché sur une carte | Il disparaît de la page suivante ; aucune image orpheline n'est resservie |
| Un blocage est posé pendant qu'une recherche est paginée | Le profil disparaît des pages suivantes, **sans message** (RG29) |

**5 — Droit insuffisant**

| Situation | Comportement attendu |
|---|---|
| Une marque demande la charge utile d'une carte | **Aucun champ de RG48 n'y figure, pas même vide** (RG79, condition `03` C(10)) |
| Une marque interroge directement l'objet identifiant | **Refus au niveau de la base**, y compris hors application (`03` P5) |
| Une marque appelle l'endpoint de la vue commerciale | **Refus**, tentative journalisée et remontée en alerte de sécurité |
| Une marque au profil non publié ouvre la recherche | Écran de demande de sélection uniquement (RG1) |
| Un créateur tente d'accéder à la recherche de créateurs | **Aucun chemin n'existe** : la recherche de créateurs n'est pas servie au rôle créateur |
| Une marque tente un export, un « tout sélectionner », un appel de liste brute | **Refus dans tous les cas**, y compris pour un administrateur (RG63, `03` C(17)) |
| Une marque devine un identifiant de profil dans une URL | **Aucun identifiant devinable n'existe** (RG65) ; l'accès à un alias inconnu renvoie « profil introuvable », identique pour un profil inexistant et pour un profil exclu |
| Un agent tente d'exporter depuis la vue commerciale | Refus ; une demande administrative motivée et journalisée est le seul chemin (RG76) |

**6 — Service externe indisponible**

| Situation | Comportement attendu |
|---|---|
| La base est lente ou indisponible pendant une recherche | Message honnête, nouvelle tentative proposée, **aucun résultat partiel affiché** — un résultat partiel fausserait le comptage du k-anonymat |
| Le stockage des visuels est indisponible | Les cartes s'affichent **sans image**, jamais avec un emplacement cassé |
| L'écriture du journal de recherche échoue | **La recherche n'est pas servie.** Une recherche non journalisée est une recherche non traçable : le journal est une condition, pas un effet de bord |
| Le service de traduction des fragments d'explication est indisponible | La carte s'affiche **sans la ligne d'explication**, jamais avec une clé technique ni une phrase moitié traduite |
| Brevo ou Apollo indisponibles | **Sans effet** : la recherche n'émet aucun événement de lead (RG92 du contrôle INFLUX n° 3) |
| Le calcul quotidien des compteurs de masse critique échoue | La valeur de la veille est conservée ; alerte au backoffice ; **aucune ouverture automatique** (RG2) |

**7 — Abandon en cours de parcours**

| Situation | Comportement attendu |
|---|---|
| La marque quitte l'écran après avoir saisi des filtres | Les filtres sont **conservés pour la session** ; aucune relance automatique sans consentement marketing |
| La marque abandonne devant un écran bloqué par le k-anonymat | La recherche est **journalisée avec son indicateur de blocage** : c'est une des mesures les plus utiles du produit (RG86) |
| La marque commence une demande de sélection et l'abandonne | Aucune demande créée ; les critères restent dans la session |
| La marque constitue une sélection et ne demande rien | La sélection est conservée ; **aucune notification au créateur** ; relance commerciale possible depuis le backoffice |
| La marque ferme la page en pleine pagination | Les impressions déjà servies restent journalisées ; rien n'est annulé |

**8 — Annulation ou retour en arrière après validation**

| Situation | Comportement attendu |
|---|---|
| La marque retire un créateur de sa sélection | Retrait immédiat ; l'ajout et le retrait restent au journal |
| La marque veut annuler une demande de mise en relation non encore traitée | Possible : la demande passe en « retirée » avec un motif ; **le créateur n'en a jamais rien su** (`03` C(18)) |
| Le créateur se retire de la recherche après avoir été ajouté à des sélections | Il reste dans les sélections existantes, **étiqueté « indisponible »** ; il n'apparaît plus dans aucune recherche |
| Une facette est refermée après avoir été ouverte | Les recherches enregistrées qui l'utilisaient restent au journal ; l'écran ne la propose plus ; **changement de version** (RG88) |
| La recherche est refermée aux marques (retour sous la masse critique) | L'écran repasse en mode « demander une sélection » ; les sélections existantes restent consultables |
| Le seuil de k-anonymat est relevé de 5 à 8 | S'applique aux recherches suivantes ; journalisé ; mesure avant / après (RG88) |
| Un blocage est retiré | Le profil réapparaît dans les recherches suivantes, **sans notification à personne** |

### La checklist INFLUX de la skill `feature-spec`

| # | Contrôle | Réponse pour ce document |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission INFLUX, net créateur | **Aucun montant de contrat, aucune facture, aucun calcul de commission (A1).** Les seuls montants sont des **tranches** : le **tarif indicatif du créateur, exprimé en coût total pour l'annonceur, commission de 35 % incluse** (RG19, document `07` RG65) et la **tranche de budget indicatif de la marque** (document `06` RG31). Le libellé du filtre le dit : « budget par collaboration, coût total ». **Aucun net créateur n'apparaît dans un écran de recherche** (RG19, document `07` RG70). **Aucune conversion de devise** (RG18, D27). *Au pilote (D78) : aucune tranche de tarif n'est servie, filtrée ni triée (F12 suspendue).* |
| 2 | **Traçabilité / contournement** | **C'est le sujet central du document.** Aucune URL, aucun `@`, aucun pseudo, aucune valeur exacte dans la réponse servie à une marque (RG48) ; anonymisation **portée par la base** (RG79) ; **pas de recherche en texte libre** (RG6) ; **pas d'identifiant devinable** (RG65) ; **export interdit à tous** (RG63) ; pagination et débit plafonnés ; **décompte en tranche** (RG59) ; message identique à 0 et 4 résultats (RG58) ; visuels modérés un par un (RG69). **Risque résiduel assumé et signalé :** une marque déterminée peut recouper thématique + pays + tranche d'audience + visuels et tenter une recherche d'image inversée. Les parades sont la modération du portfolio, le k-anonymat, la détection d'affinage et la journalisation ; la parade ultime reste **Q2** (visages dans le portfolio, question ouverte du document `07`) |
| 3 | **Leads** — ce qui part vers Brevo et Apollo | **Rien.** La recherche **n'émet aucun événement de lead** et **n'envoie aucun attribut** vers Brevo ou Apollo. Une recherche décrit ce qu'une marque cherche : une information commerciale, collectée pour deux finalités déclarées (garde-fou et amélioration produit, RG67), **pas pour du ciblage marketing**. Toute exploitation marketing du journal de recherche serait un détournement de finalité et exige une base légale distincte — question ouverte **Q7** |
| 4 | **Backoffice** — contrepartie interne | **Détaillée en §H et RG83 :** vue commerciale identifiée, sélection multiple, filtrage par campagne, relance des brouillons, traitement des demandes « sélection par l'équipe », traitement des alertes d'aspiration, ouverture / fermeture de la recherche (D38), réglage des facettes et des plafonds, tableau de bord des indicateurs de RG86. Toutes les actions sont **journalisées nominativement** (RG78) |
| 5 | **Matching hybride** | **Aucun algorithme (D11).** La voie « automatique » se réduit à **des filtres et un tri composite déterministe et explicable** (RG35 à RG44). La voie humaine est complète et prioritaire : **proposition INFLUX** depuis la vue commerciale (RG74), demande de sélection par l'équipe (RG61), correction du pré-remplissage issu d'une campagne (RG73). **Toute intervention humaine est tracée et constitue le jeu de données de D11** (RG54, RG66, RG73) |
| 6 | **Deux populations** | Ce document ne traite **que** la recherche de créateurs, par une marque et par un commercial. Le créateur y est **exposé, jamais acteur** (RG8). La **recherche de campagnes côté créateur** est un autre écran, qui réutilise **la taxonomie et les bornes de ce document** et rien d'autre. **D41** : un rôle par compte |
| 7 | **Données personnelles** — avis de `expert-conformite-rgpd` | **Obligatoire, avec veto, avant l'ouverture de la recherche.** Points soumis : seuil de k-anonymat et sa mécanique anti-oracle (RG57 à RG60), **double finalité et durée de conservation du journal** (RG67), information des créateurs sur l'annuaire anonymisé et sur la journalisation (**Q1**, cohérent avec Q10 du document `07`), absence de décision individuelle automatisée (**aucun scoring : l'article 22 n'est pas déclenché**, mais l'information reste due), exclusion silencieuse fondée sur les secteurs refusés (RG31), facettes F9/F10 portant exclusivement sur l'audience (RG24), exploitation du journal (**Q7**) |

---

## Critères d'acceptation

### Anonymisation — **bloquants**

**CA1** — *Étant donné* une recherche lancée par un compte marque, *quand* on inspecte **la réponse
de l'API** (et non l'écran), *alors* **aucun champ de la liste RG48 n'y figure**, pas même vide, pas
même nul.

**CA2** — *Étant donné* un compte au rôle annonceur, *quand* il interroge directement l'objet
identifiant du créateur, *alors* l'accès est **refusé au niveau de la base**, y compris hors
application.

**CA3** — *Étant donné* un créateur ayant déclaré 47 312 abonnés, *quand* une marque le voit dans les
résultats, *alors* elle voit **une tranche**, et la valeur 47 312 **n'apparaît nulle part** dans la
réponse.

**CA4** — *Étant donné* un créateur dont l'audience française est de 72 %, *quand* l'explication
s'affiche, *alors* elle indique **« plus de 70 % d'audience en France »** et **jamais 72 %**.

**CA5** — *Étant donné* une mise en relation validée, *quand* la marque consulte le créateur, *alors*
les champs de la couche révélable apparaissent **et l'horodatage de révélation est écrit**.

**CA6** — *Étant donné* la carte anonyme et la page de profil ouverte, *quand* on compare leurs
réponses d'API, *alors* elles contiennent **le même ensemble de champs** (RG50).

### Facettes et combinaison

**CA7** — *Étant donné* l'écran de recherche en vue marque, *quand* on cherche un champ de saisie
libre, *alors* **il n'en existe aucun**.

**CA8** — *Étant donné* les facettes affichées au premier jour d'ouverture, *quand* on les compte,
*alors* ce sont **exactement les 8 du socle** (RG12) — **7 au pilote**, F12 suspendue (D78) —, et les autres sont
absentes de l'écran.

**CA9** — *Étant donné* un créateur macro sur Instagram et nano sur TikTok, *quand* une marque filtre
« TikTok » **et** « macro », *alors* **ce créateur n'apparaît pas** (RG17).

**CA10** — *Suspendu (D78).* *Étant donné* un créateur proposant une story à 500 € et une vidéo à 3 000 €, *quand* une
marque filtre « vidéo » et la tranche « 500-1 000 € », *alors* **ce créateur n'apparaît pas**.

**CA11** — *Suspendu (D78).* *Étant donné* une marque dont le profil est en euros, *quand* elle active le filtre tarif,
*alors* la devise est pré-remplie en euros et **aucune conversion n'est effectuée**.

**CA12** — *Suspendu (D78).* *Étant donné* un créateur tarifant en dollars, *quand* une marque filtre en euros sans
cocher l'option d'inclusion, *alors* ce créateur **n'apparaît pas** ; *quand* elle coche l'option,
*alors* il apparaît avec la mention « tarif déclaré dans une autre devise ».

*Au pilote, à la place de CA10 à CA12 (D78) :* *étant donné* une réponse de recherche servie à une marque, *quand* on
inspecte sa charge utile, *alors* **aucune tranche tarifaire, aucune devise de tarif et aucun tri par tarif** n'y
figurent, et aucune explication ne cite un montant.

**CA13** — *Étant donné* un créateur dont l'engagement est déclaré mais non vérifié, *quand* la
facette engagement est active, *alors* il **n'apparaît pas** ; *quand* elle est inactive, *alors* il
apparaît **sans aucune mention d'engagement**.

**CA14** — *Étant donné* l'écran de recherche, *quand* on cherche un filtre par ville ou par région,
*alors* **il n'en existe aucun** (RG15).

**CA15** — *Étant donné* un créateur dont la région compte moins de 5 profils publiés, *quand* sa
carte s'affiche, *alors* **seul le pays apparaît**, sans message ni compteur.

**CA16** — *Étant donné* la vue marque, *quand* on cherche une facette « statut particulier /
professionnel », *alors* **il n'en existe aucune** ; *quand* on regarde la vue commerciale, *alors*
elle existe (RG16).

**CA17** — *Étant donné* deux facettes multi-choix actives, *quand* la requête s'exécute, *alors* la
sémantique est **OU à l'intérieur** de chaque facette et **ET entre elles** (RG17).

### Exclusions

**CA18** — *Étant donné* un profil en brouillon, en attente, refusé ou suspendu, *quand* une marque
recherche, *alors* il est **absent**, **sans message ni décompte**, et **il n'entre pas dans le
nombre de résultats**.

**CA19** — *Étant donné* un créateur ayant désactivé « visible dans la recherche », *quand* une marque
recherche, *alors* il est absent, silencieusement.

**CA20** — *Étant donné* un créateur ayant bloqué une marque, *quand* cette marque recherche, *alors*
il est **absent sans message** ; *quand* un commercial recherche, *alors* il est **visible avec un
avertissement bloquant** (RG71).

**CA21** — *Étant donné* un créateur qui refuse le secteur « jeux d'argent », *quand* une marque de ce
secteur recherche, *alors* il est **absent**, et **aucun écran, aucun compteur et aucun journal servi
à la marque ne mentionne ce motif** (RG31).

**CA22** — *Étant donné* une paire déjà en relation, *quand* la marque recherche, *alors* le créateur
est **visible**, signalé « vous êtes déjà en relation », et l'action devient « Ouvrir la
conversation ».

**CA23** — *Étant donné* un créateur dont les chiffres datent de 91 jours, *quand* il apparaît,
*alors* la mention « chiffres à rafraîchir » s'affiche, **il est rétrogradé** au palier 4, et **il
reste visible**.

### Tri, explication et cas froid

**CA24** — *Étant donné* une même recherche lancée deux fois le même jour UTC par deux comptes
différents, *quand* on compare les deux listes, *alors* **l'ordre est identique**.

**CA25** — *Étant donné* la même recherche lancée le lendemain, *quand* on compare, *alors* **seul le
départage du palier 8 a changé** ; les paliers 1 à 7 produisent le même classement relatif.

**CA26** — *Étant donné* un profil vérifié et un profil non vérifié, à critères égaux par ailleurs,
*quand* la liste s'affiche, *alors* **le profil vérifié est devant** (palier 3).

**CA27** — *Étant donné* une carte de résultat, *quand* on lit l'explication, *alors* elle comporte
**2 à 4 raisons**, **aucune valeur exacte**, **aucun score**, et existe **en français et en anglais**.

**CA28** — *Étant donné* une explication affichée, *quand* on vérifie chacune de ses raisons, *alors*
**chaque raison est vérifiable sur la carte elle-même**.

**CA29** — *Étant donné* une liste de 12 résultats comportant des profils publiés depuis moins de 30
jours, *quand* elle s'affiche, *alors* **au moins 2 profils froids sont présents** et **aucun profil
sans historique n'est rétrogradé pour cette raison**.

**CA30** — *Étant donné* un profil publié il y a 10 jours, *quand* il apparaît, *alors* il porte
l'étiquette **« Profil récent »**, et **jamais** « aucun historique ».

**CA31** — *Étant donné* le tri « Nouveaux profils », *quand* il est sélectionné, *alors* les profils
publiés depuis moins de 30 jours apparaissent en tête.

**CA32** — *Étant donné* un tri actif, *quand* on consulte le journal, *alors* **le tri est
enregistré** avec les filtres.

**CA33** — *Étant donné* une recherche lancée depuis une campagne, *quand* la liste s'affiche,
*alors* le palier 2 s'applique ; *quand* la recherche est lancée hors campagne, *alors* il est neutre
pour tous.

### k-anonymat

**CA34** — *Étant donné* une recherche renvoyant **4** résultats, *quand* l'écran s'affiche, *alors*
**aucune liste, aucun aperçu, aucun résultat partiel** n'apparaît, et les élargissements ainsi que le
bouton « demander une sélection » sont proposés.

**CA35** — *Étant donné* une recherche renvoyant **0** résultat et une recherche renvoyant **4**
résultats, *quand* on compare **l'écran et la réponse de l'API**, *alors* ils sont **strictement
identiques**, sans aucun décompte.

**CA36** — *Étant donné* une recherche renvoyant 37 résultats, *quand* le décompte s'affiche, *alors*
il est exprimé **en tranche** (« 25-49 »), jamais « 37 ».

**CA37** — *Étant donné* une recherche bloquée, *quand* on examine les élargissements proposés,
*alors* ils proviennent d'un **ordre de priorité statique** des facettes appliquées et **aucune
requête alternative n'a été exécutée** pour les choisir.

**CA38** — *Étant donné* une recherche bloquée, *quand* on consulte le journal, *alors* l'indicateur
de blocage par k-anonymat est enregistré.

**CA39** — *Étant donné* le bouton « Demander une sélection à l'équipe INFLUX », *quand* la marque
clique, *alors* une demande est créée au backoffice **avec tous les critères saisis**, la campagne
d'origine le cas échéant, et la langue de la marque.

**CA40** — *Étant donné* la vue commerciale, *quand* une recherche renvoie 2 résultats, *alors* **les
2 résultats s'affichent** : le k-anonymat ne s'y applique pas.

### Garde-fous

**CA41** — *Étant donné* une recherche renvoyant 500 profils, *quand* la marque pagine, *alors* elle
n'atteint **jamais plus de 60 résultats**, et la demande d'une page au-delà est refusée proprement.

**CA42** — *Étant donné* une requête dont la taille de page a été modifiée à 200, *quand* elle
s'exécute, *alors* la valeur est **plafonnée côté serveur** et la tentative est journalisée.

**CA43** — *Étant donné* la vue marque **et** la vue commerciale, *quand* on cherche un chemin
d'export, *alors* **il n'en existe aucun dans les deux cas**, y compris pour un administrateur.

**CA44** — *Étant donné* un compte dépassant son plafond de recherches, *quand* il relance une
recherche, *alors* il obtient un **refus explicite** et une **alerte interne** est levée.

**CA45** — *Étant donné* six recherches successives d'un même compte ne variant que d'un filtre, dont
deux bloquées par le seuil, *quand* la sixième s'exécute, *alors* **l'alerte d'affinage est
déclenchée**.

**CA46** — *Étant donné* un compte ayant ouvert 150 profils en 24 h sans aucune demande ni sélection,
*quand* le contrôle s'exécute, *alors* **l'alerte d'aspiration est levée** au backoffice.

**CA47** — *Étant donné* toute recherche, *quand* elle s'exécute, *alors* le journal enregistre :
compte, rôle, mode de vue, filtres, tri, nombre de résultats, page atteinte, blocage éventuel — **et
si l'écriture du journal échoue, la recherche n'est pas servie**.

**CA48** — *Étant donné* une liste de résultats, *quand* elle est servie, *alors* **une impression est
écrite par profil affiché**, avec son **rang**, et l'ouverture d'un profil met à jour son indicateur.

**CA49** — *Étant donné* une URL de carte, *quand* on tente d'incrémenter son identifiant, *alors*
**aucun identifiant séquentiel n'existe** et l'accès à un alias inconnu renvoie une réponse
**identique** pour un profil inexistant et pour un profil exclu.

**CA50** — *Étant donné* un visuel de portfolio non modéré, ou portant un `@`, ou dont les métadonnées
n'ont pas été retirées, *quand* une carte s'affiche, *alors* **ce visuel n'y figure pas**.

### Actions, sélection et vue commerciale

**CA51** — *Étant donné* une carte, *quand* on énumère ses actions, *alors* il y en a **exactement
deux** : « Ajouter à ma sélection » et « Demander une mise en relation » (ou leurs variantes d'état
de RG53).

**CA52** — *Étant donné* l'ajout d'un créateur à une sélection, *quand* on vérifie ses effets,
*alors* **aucune notification n'est envoyée au créateur** et **rien n'est révélé**.

**CA53** — *Étant donné* une demande de mise en relation créée depuis une recherche, *quand* on
l'inspecte, *alors* elle porte **l'identifiant de la recherche d'origine et ses filtres**.

**CA54** — *Étant donné* une demande déjà en file pour une paire, *quand* la marque revient sur la
carte, *alors* l'action est **désactivée** avec la date de la demande, et **aucun doublon n'est
créé**.

**CA55** — *Étant donné* la vue commerciale, *quand* un agent recherche, *alors* il voit les
identités, les profils en brouillon étiquetés, les profils bloqués avec avertissement, et peut
sélectionner **jusqu'à 20 créateurs**.

**CA56** — *Étant donné* une campagne, *quand* un commercial ouvre « créateurs compatibles », *alors*
les facettes sont **pré-remplies depuis le brief**, et **le pré-remplissage ainsi que ses corrections
sont journalisés**.

**CA57** — *Étant donné* une sélection de 3 créateurs et un motif écrit, *quand* le commercial
propose à une campagne, *alors* **3 mises en relation distinctes** sont créées, chacune avec son
motif, **en trois clics au maximum**.

**CA58** — *Étant donné* une recherche ou une consultation en vue commerciale, *quand* on consulte le
journal, *alors* elle est enregistrée **nominativement**.

### Ouverture, paramètres et versions

**CA59** — *Étant donné* le paramètre d'ouverture désactivé, *quand* une marque ouvre la recherche,
*alors* elle voit les critères, le message d'attente et le bouton de demande de sélection —
**aucune liste**.

**CA60** — *Étant donné* l'atteinte des seuils de masse critique, *quand* le calcul quotidien
s'exécute, *alors* une **alerte** est levée au backoffice et **la recherche n'est pas ouverte
automatiquement**.

**CA61** — *Étant donné* la fermeture de la recherche aux marques, *quand* un commercial recherche,
*alors* **la vue commerciale fonctionne normalement**.

**CA62** — *Étant donné* la modification d'une facette, d'une borne de tranche, d'un palier de tri ou
du seuil de k-anonymat, *quand* elle est appliquée, *alors* elle est **versionnée, datée, motivée et
journalisée**, et la mesure avant / après est planifiée.

**CA63** — *Étant donné* chacun des messages de RG89, *quand* la langue de l'interface est l'anglais,
*alors* la version anglaise s'affiche, **sans aucun texte français résiduel ni clé technique
visible**.

**CA64** — *Étant donné* une recherche, *quand* on inspecte les événements émis, *alors* **aucun
événement de lead ne part vers Brevo ni Apollo**.

### Métriques prioritaires (D61, additif du 2026-09-25)

**CA65** — *Étant donné* une carte anonyme, *quand* on lit chaque ligne de réseau, *alors* elle
commence par la tranche d'audience, le rythme de publication et la tranche de commentaires moyens,
**dans cet ordre**, chacun avec sa source et sa date ; *quand* on inspecte la réponse de l'API,
*alors* ni le nombre exact de publications, ni le nombre exact de commentaires n'y figurent,
**pas même nuls** (RG47, RG48).

**CA66** — *Étant donné* un créateur dont les commentaires moyens sont déclarés mais non constatés,
*quand* la facette F25 est active, *alors* il **apparaît** dans les résultats avec la source
« déclaré par le créateur » — contrairement à F5, qui n'affiche que des valeurs vérifiées (`07`
RG117).

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Espace | Écran | Remarque |
|---|---|---|
| Membre marque | **Recherche de créateurs** — panneau de facettes + liste de cartes | Socle de 8 facettes seulement au lancement ; **mobile-first** ; tri nommé et visible |
| Membre marque | **Carte anonyme** | Contenu exact de RG47 ; ligne « Proposé car : … » ; ligne « Point de vigilance » ; **deux actions** |
| Membre marque | **Profil ouvert** (mêmes champs, 3 visuels) | **Jamais plus riche que la carte** (RG50) |
| Membre marque | **État bloqué par le k-anonymat** | Message unique, élargissements, bouton « demander une sélection ». **Aucun décompte** |
| Membre marque | **Recherche fermée** (avant masse critique) | Formulaire de besoin + bouton de demande de sélection |
| Membre marque | **Ma sélection** (shortlist), éventuellement par campagne | Retrait, étiquette « indisponible », demande groupée |
| Membre marque | **Confirmation de demande de mise en relation** | Énonce le processus et le délai (**D39**) |
| Backoffice | **Recherche identifiée** + sélection multiple + « Proposer à une campagne » | **Objectif : trois clics** (RG74) |
| Backoffice | **File « demandes de sélection par l'équipe »** | Critères saisis affichés tels quels |
| Backoffice | **Réglages de la recherche** : ouverture (D38), facettes ouvertes, seuil k, plafonds, quota froid | Chaque modification journalisée |
| Backoffice | **Tableau de bord recherche** : indicateurs de RG86, alertes de RG68 | L'indicateur de référence en tête |

### Données (`expert-database`)

Tables prévues et utilisées telles quelles : `search.search_queries`, `search.search_impressions`,
`search.shortlists`, `search.shortlist_items` (document `04` §5.5), `profiles.creator_public_*`,
`campaigns.*`, `reference.*`.

**Besoins dictés, à instruire :**

1. **Table de blocage entre parties** (RG28) : elle **n'existe pas** dans le modèle actuel alors que
   c'est une exclusion de premier rang. Besoin : `(bloquant, bloqué, motif typé, auteur, date)`, effet
   **symétrique** à la lecture, journalisé.
2. **`search.facet_settings`** : code de facette, vague, ouverte oui/non, ordre d'affichage —
   modifiable sans redéploiement, journalisé (RG11).
3. **Paramètres de recherche en table** : seuil de k-anonymat, plafonds de pagination et de débit,
   quota de profils froids, seuils de masse critique, seuils d'alerte (RG2, RG57, RG63).
4. **`search.search_queries`** doit porter **le tri actif** et **l'identifiant de version des
   facettes** en plus des colonnes déjà prévues : sans eux, une mesure avant / après (RG88) est
   ininterprétable.
5. **Ajout d'une raison d'explication structurée** aux impressions, ou à défaut la possibilité de
   recalculer les raisons à l'identique : sans cela, on ne saura jamais **quelle raison affichée a
   converti**.
6. **Compteurs de masse critique** (profils publiés, par thématique), calculés quotidiennement et
   stockés — l'index partiel `(status, is_searchable)` du document `04` §7 existe déjà pour cela.
7. **Champs manquants au profil créateur** déjà signalés par le document `07` et nécessaires ici :
   ton éditorial (F22), délai de livraison (F23), droits d'usage inclus / en option (F14), expérience
   de collaborations (F18), région de résidence (affichage seul).

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Brevo** | **Aucune.** La recherche n'émet aucun événement de lead et n'enrichit aucun contact (contrôle INFLUX n° 3) |
| **Apollo.io** | **Aucune.** Périmètre inchangé |
| **Supabase Storage** | Lecture des **visuels approuvés uniquement**, depuis le compartiment public ; aucun accès aux pièces de vérification, dans aucun cas (`03` C(13)) |
| **next-intl** | Fragments d'explication et messages de RG89 en FR et EN, format ICU, parité des clés vérifiée à la compilation |

### Indicateurs à suivre

Ceux de **RG86**, avec leurs seuils. Les trois à regarder dès la première semaine :
**recherche → demande de mise en relation** (RG87), **part des recherches bloquées par le
k-anonymat**, **profils jamais affichés en 30 jours**.

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| **Algorithme de score, recommandation, « compatibilité en % »** | **D11 reportée** : aucune donnée pour régler des pondérations autrement qu'à l'intuition | Après le MVP, quand le journal des recherches et les affaires signées existeront |
| Recherche en texte libre, recherche par pseudo, autocomplétion de noms | Transforme l'annuaire en oracle (RG6) | Non planifié |
| Filtre par ville, par région, par rayon kilométrique | Ré-identification immédiate (RG15) | **Q3**, jamais sans garde renforcée |
| Export, téléchargement, API publique de l'annuaire | Industrialiserait le contournement (RG63) | Non planifié |
| Alertes « nouveaux créateurs correspondant à ma recherche » par e-mail | Chaque alerte est une extraction périodique de l'annuaire, hors garde-fous de débit | Après le pilote, avec plafonds dédiés |
| Comparateur de profils côte à côte | Facilite le recoupement entre profils, donc la ré-identification | À réexaminer après mesure |
| Notification au créateur d'une consultation ou d'un ajout en sélection | Document `07` RG105 ; et un « 12 marques vous ont vu » pousserait hors plateforme | Non planifié |
| Avis, notes, étoiles, historique public de collaborations | Document `07` RG31 | Non planifié |
| Recherche de campagnes côté créateur | Écran distinct, `feature-spec` — **mais taxonomie et bornes définies ici** | Lot 3, document séparé |
| File de validation, révélation d'identité, conversation à trois | Lot 4, `intermediation-tracking` et `messaging-spec` | Lot 4 |
| Contrat, facture, encaissement, commission calculée | **A1** : hors application au MVP | V2 |
| Pays non ouvert aux contrats comme exclusion (**D26**) | Sans objet tant qu'il n'y a pas de contrat dans l'application | V2 |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **Information des créateurs** : le créateur doit savoir qu'il figure dans un annuaire consultable, quel champ appartient à quelle couche, que les recherches sont journalisées et comment se retirer. Rédaction à produire pour la politique de confidentialité et l'aide en ligne | Interrupteur de visibilité déjà spécifié (document `07` RG8) ; rédaction à écrire **avant l'ouverture de la recherche** | `expert-conformite-rgpd` (**veto**) + `expert-ux` | **Avant l'ouverture du Lot 3** |
| **Q2** | **Visages dans les visuels de portfolio.** C'est la dernière voie de ré-identification qui reste ouverte une fois tous les garde-fous en place : une recherche d'image inversée retrouve un compte en une minute. L'interdire ampute gravement mode, beauté et lifestyle | **Autorisé par défaut** avec information explicite du créateur au dépôt (document `07` **Q8**) | Fondateur + `expert-conformite-rgpd` + `expert-ux` | **Avant le Lot 3** |
| **Q3** | **Ouvrir un jour la région comme facette ?** Refusée au MVP (RG15). Si elle est ouverte, elle exige une garde supplémentaire : seules les valeurs comptant ≥ 5 profils apparaissent dans la liste de choix | **Non ouverte** | `expert-matching` + `expert-conformite-rgpd` | Après le pilote |
| **Q4** | **Troisième action « ne plus me proposer ce profil »** : excellent signal négatif pour D11, mais expose une préférence de la marque et complique la carte | **Non retenue au MVP** (cohérent avec **Q13** du document `07`) | `product-owner` + `expert-matching` | Lot 3 |
| **Q5** | **Le décompte en tranche (RG59) est-il acceptable commercialement ?** Une marque habituée aux outils du marché s'attend à « 37 résultats ». La tranche protège contre la différenciation, mais peut être perçue comme un manque de transparence | **Oui, tranche**, avec un libellé qui explique pourquoi | `product-owner` + Fondateur | Lot 3 |
| **Q6** | **Seuil de k-anonymat : 5 est-il le bon chiffre au démarrage ?** Avec 30 profils publiés, un seuil de 5 bloquera une part importante des recherches. Le baisser affaiblit la protection ; le monter vide l'écran | **5**, en paramètre, mesuré dès la première semaine (RG86) | `expert-matching` + `expert-conformite-rgpd` | Lot 3 |
| **Q7** | **Le journal des recherches peut-il servir au commercial et au marketing ?** Savoir ce qu'une marque a cherché sans rien demander est une information de prospection précieuse — et une finalité différente de celles déclarées (garde-fou, amélioration produit) | **Non au MVP** : usage limité aux deux finalités déclarées. Un usage commercial exige une base légale et une information distinctes | `expert-conformite-rgpd` (**veto**) + `product-owner` | Lot 3 |
| **Q8** | **Faut-il exiger un profil marque publié pour accéder à la recherche (RG1) ?** Cela qualifie le demandeur et protège l'annuaire, mais ajoute une étape avant le premier moment de valeur | **Oui, profil publié requis** | `product-owner` + `expert-marketing` | Lot 3 |
| **Q9** | **D38 — masse critique** : 30 profils publiés et 5 par thématique sont un ordre de grandeur, pas une mesure. Faut-il ouvrir thématique par thématique plutôt que globalement ? | Mécanique paramétrable écrite (RG2) ; **valeur et mode d'ouverture à trancher** | **Fondateur** + `chef-de-projet` | **Avant l'ouverture du Lot 3** |
| **Q10** | **Durée de conservation du journal des recherches** : 12 mois retenus au document `04` §9. Suffisant pour régler D11 ? Trop long au regard de la finalité de sécurité ? | **12 mois**, à confirmer | `expert-conformite-rgpd` (**veto**) + `expert-matching` | Lot 3 |
| **Q11** | **Blocage entre parties (RG28)** : qui peut bloquer, avec quel motif, avec quelle information de la partie bloquée (aucune, selon l'hypothèse), et quel recours ? | Blocage silencieux, motif typé, aucune information de la partie bloquée | `product-owner` + `expert-conformite-rgpd` | Lot 3 |
| **Q12** | **Valeurs de paramétrage** : plafonds de pagination (12 × 5), de débit (30/h, 200/j, 60 profils/j), quota froid (2 sur 12), seuils d'alerte. Trop bas, ils gênent une marque légitime ; trop hauts, ils laissent copier l'annuaire | Valeurs de départ ci-contre, **en table**, calibrées après un mois de mesure | `expert-cybersecurite` + `expert-matching` | Lot 3 |
| **Q13** | **D61 — faut-il faire entrer le rythme de publication (F24) et les commentaires moyens (F25) dans le socle dès l'ouverture de la recherche ?** Ce sont deux des trois métriques prioritaires du fondateur, mais chaque facette ouverte au démarrage rapproche les recherches du seuil de k-anonymat (RG10) | **Seconde vague** : les deux chiffres sont **affichés** sur chaque carte dès le premier jour (RG47), le **filtre** s'ouvre au volume (RG11), comme les autres facettes non socle | `expert-matching` + **Fondateur** | Lot 3 |
