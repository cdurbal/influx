# Lot 3 — Le créateur cherche une campagne et y postule : fil, filtres, candidature, file de validation

> **Date :** 2026-09-19 · **Auteur :** agent `product-owner` · **Statut :** spécification complète du
> parcours créateur « trouver une campagne et candidater » (Lot 3, prolongée au Lot 4 pour la file),
> soumise à la validation de `chef-de-projet`, avec **avis obligatoire (veto) de
> `expert-conformite-rgpd`** sur §E (texte libre de candidature et détection), §J (notifications) et
> §K (ce qui part vers Brevo), et **avis obligatoire de `expert-paiement-facturation`** sur §E
> (tarif proposé, net créateur estimé) et §C (filtre de rémunération sans conversion de devise).
>
> **Skills appliquées :** `feature-spec` (format de sortie), `matching-spec` (règle d'or des tranches,
> taxonomie partagée, garde-fous anti-aspiration, exclusion silencieuse), `intermediation-tracking`
> (objet mise en relation, origine, révélation), `backoffice-ops` (file, verrou, motifs typés, SLA),
> `design-system-influx` (états d'écran, affichage des montants).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité, §3 modèle économique),
> `docs/mvp/00-cadrage-mvp-v2.md` (arbitrages **A1**, **A2**, **A9**, §4.1 les trois déclencheurs),
> `docs/mvp/01-intermediation-courtee.md` §3 et §4.2 (déroulé, candidature),
> `docs/mvp/03-matrice-des-droits-et-rls.md` §3.3 et §3.4 (conditions **C(17)**, **C(18)**, **C(19)**,
> **C(21)**, **C(26)**), `docs/mvp/04-modele-de-donnees-mvp.md` §5.4 (`campaigns.*`), §5.6
> (`matching.introductions`, `matching.application_details`, `matching.application_formats`),
> `docs/mvp/07-criteres-profil-createur-reseaux-audience.md` (ce qui est **déjà** dans le profil),
> `docs/mvp/08-verification-et-badge.md` **RG16**, **RG18** (ce que « vérifié » veut dire).
>
> **Ce que ce document tranche :** ce qu'un créateur voit d'une campagne publiée et ce qu'il n'en
> voit jamais, les filtres et les tris du fil de campagnes, le contenu exact d'une candidature, les
> plafonds qui empêchent l'arrosage, les huit états d'une candidature et leur libellé, la restriction
> « réservée aux profils dont l'audience est vérifiée », le passage par la file de validation et ce
> qui le distingue d'une demande de contact, et chaque notification reçue par le créateur, par la
> marque et par le commercial.
>
> **Ce qu'il ne tranche pas :** la création et les critères d'une campagne (document `09`), la
> recherche de créateurs côté marque (document `10`), la maquette et la microcopie (`expert-ux`), le
> schéma SQL et les politiques d'accès (`expert-database`, `expert-cybersecurite`), la conversation à
> trois et la détection de coordonnées dans la messagerie (Lot 4, `messaging-spec`), les règles de
> scoring (**D11**, reportée).
>
> **Invariant rappelé :** aucun contrat, aucune facture, aucun encaissement, **aucun calcul de
> commission dans le code applicatif** n'existe dans ce périmètre (**A1**, `03` C(32)). Les montants
> présents sont la **rémunération par créateur annoncée par la campagne**, le **tarif proposé par le
> créateur** et le **net créateur estimé**, tous trois nommés, tous trois avec leur devise, tous trois
> accompagnés de la mention « ne vaut pas engagement ».
>
> **Prolongement des Lots 1 et 2 :** ce document ne redemande **jamais** une information déjà
> collectée à l'inscription ou déjà présente dans le profil créateur. Toute redemande est un défaut.

---

## Besoin

**Permettre à un créateur de repérer en moins de deux minutes une campagne qui le concerne, et d'y
postuler en moins de cinq — sans que sa candidature n'atteigne jamais la marque avant qu'un
commercial INFLUX ne l'ait lue, validée et prise en charge.**

Quatre raisons d'être, dans cet ordre :

1. **Commerciale.** C'est le seul déclencheur que le créateur maîtrise. Sans lui, il attend qu'une
   marque ou un commercial pense à lui : un créateur qui attend ne revient pas.
2. **Opérationnelle.** Une candidature bien faite fait gagner un quart d'heure au commercial : elle
   lui apporte un créateur déjà motivé, déjà chiffré, sur une campagne déjà connue. C'est le
   déclencheur le moins coûteux des trois.
3. **Protection du modèle économique.** La candidature est **le premier texte libre qu'un créateur
   peut adresser à une marque**. C'est donc le vecteur de contournement le plus direct du produit :
   une adresse e-mail dans une motivation, et INFLUX n'existe plus. **A9** est la parade : rien ne
   circule sans lecture humaine.
4. **Confiance du créateur.** Un créateur qui reçoit un refus sans motif, ou qui croit avoir été
   rejeté par la marque alors que sa candidature n'est jamais sortie d'INFLUX, ne candidate plus
   jamais. Le libellé d'un refus n'est pas un détail d'interface : c'est la condition de survie du
   déclencheur.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Créateur** (titulaire du compte) | Parcourt le fil des campagnes, filtre, trie, ouvre une campagne, rédige et envoie une candidature, la retire, consulte son état, reçoit les décisions |
| **Marque** (annonceur) | **Ne fait rien ici**, jusqu'à ce qu'un commercial lui transmette une **candidature validée**. Elle ne voit jamais une candidature brute, jamais une candidature refusée, jamais le nombre de candidatures reçues et écartées |
| **Commercial INFLUX** (rôle `agent`) | Prend en charge une candidature dans la file, lit le profil du créateur **en vue identifiée**, valide et s'attribue l'affaire, ou refuse avec un motif typé ; relance la marque ; clôt une candidature restée sans suite |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, plus : modification des plafonds, levée d'un verrou orphelin, réattribution, export |
| **Système** | Applique les plafonds côté serveur, ferme les campagnes à échéance, calcule le délai de traitement, détecte les coordonnées dans une candidature, émet les notifications et les événements de leads |
| **Brevo** (externe) | Reçoit les e-mails transactionnels de décision et, sous consentement, un **indicateur d'activité** non identifiant (voir **Q7**) |

> **Deux populations, deux parcours.** Ce document ne décrit **que** le créateur qui cherche et qui
> postule. La création d'une campagne est le document `09` ; la recherche de créateurs par la marque
> est le document `10`. **Aucun écran n'est partagé** : ni le fil, ni les filtres, ni le formulaire,
> ni les motifs de refus, ni les notifications.

---

## User stories

### Créateur

- **US1** — En tant que **créateur**, je veux parcourir les campagnes ouvertes avec, sur chaque carte,
  la marque, ce qu'elle attend, ce qu'elle paie par créateur et jusqu'à quand, afin de décider en dix
  secondes si j'ouvre ou si je passe.
- **US2** — En tant que **créateur**, je veux filtrer sur ma thématique, mes réseaux, les pays visés
  et une rémunération minimale, afin de ne pas lire trente briefs qui ne me concernent pas.
- **US3** — En tant que **créateur**, je veux trier par campagne la plus récente ou par date limite la
  plus proche, afin de ne pas rater une échéance.
- **US4** — En tant que **créateur**, je veux voir immédiatement si une campagne m'est ouverte ou si
  elle est réservée aux profils dont l'audience est vérifiée, afin de ne pas écrire une candidature
  pour rien.
- **US5** — En tant que **créateur**, je veux candidater sans retaper mon audience, mes réseaux ni mon
  portfolio, afin de ne remplir que ce qui est propre à cette campagne.
- **US6** — En tant que **créateur**, je veux proposer mon tarif pour cette campagne **et voir ce
  qu'il me resterait**, afin de ne jamais découvrir la commission après coup.
- **US7** — En tant que **créateur**, je veux savoir où en est ma candidature et sous quel délai elle
  sera examinée, afin de ne pas relancer dans le vide.
- **US8** — En tant que **créateur** dont la candidature est écartée, je veux savoir que c'est INFLUX
  qui a décidé, pour quelle raison, et ce que je peux corriger, afin de candidater mieux la fois
  suivante.
- **US9** — En tant que **créateur**, je veux retirer une candidature tant que rien n'est ouvert, afin
  de rester maître de ce que j'ai envoyé.
- **US10** — En tant que **créateur**, je veux connaître le nombre de candidatures qu'il me reste,
  afin de ne pas me heurter à un mur sans explication.

### Marque

- **US11** — En tant que **marque**, je veux ne recevoir que des candidatures lues et validées par un
  commercial INFLUX, afin de ne pas trier moi-même l'arrosage.
- **US12** — En tant que **marque**, je veux, sur une candidature validée, le motif du créateur, les
  formats qu'il propose et son prix, afin de décider d'entrer ou non en relation.

### Commercial et administrateur

- **US13** — En tant que **commercial**, je veux traiter les candidatures dans la **même file** que
  les demandes de contact, avec un filtre par origine, afin de n'avoir qu'un seul endroit à regarder.
- **US14** — En tant que **commercial**, je veux voir, sans ouvrir un autre écran, la campagne, la
  candidature, le profil identifié du créateur et les alertes de coordonnées, afin de décider en une
  minute.
- **US15** — En tant que **commercial**, je veux refuser avec un motif choisi dans une liste, afin
  qu'aucun refus ne soit muet et que les motifs soient comptables.
- **US16** — En tant qu'**administrateur**, je veux modifier les plafonds de candidature sans
  déploiement, afin d'ouvrir ou de resserrer le robinet selon l'engorgement réel.

### Système

- **US17** — En tant que **système**, je veux qu'aucune candidature non validée n'atteigne jamais une
  marque, sous aucune forme et par aucun chemin, afin que **A9** ne dépende pas de la discipline d'un
  développeur.

---

## Règles de gestion

### A — Portée, vocabulaire et principes

**RG1** — Une **candidature est une mise en relation** au sens du document `01` : elle crée une entrée
`matching.introductions` avec `origin = creator_application`, sa référence `MER-AAAA-NNNNNN`, son
statut, son délai de traitement et son commercial responsable. Ce n'est **pas** un objet parallèle.
Son contenu propre (motivation, tarif proposé, formats proposés) vit dans l'extension
`matching.application_details` et `matching.application_formats`.

**RG2** — **Une candidature n'ouvre jamais de conversation** (**A9**). Elle entre dans la file de
validation. La conversation est la conséquence d'une décision humaine, jamais d'un clic d'utilisateur.

**RG3** — **La marque ne voit qu'une candidature validée par un commercial.** Aucune candidature
brute, aucune candidature refusée, aucune candidature retirée, aucun extrait, aucun compteur agrégé
de candidatures écartées n'est servi au rôle `advertiser`, par aucun chemin (**C(18)**).

**RG4** — **Le refus d'une candidature est toujours une décision d'INFLUX.** Aucun écran, aucun
e-mail, aucune infobulle et aucun motif ne présente une décision comme venant de la marque, y compris
lorsque la marque n'a pas donné suite. Le créateur n'apprend jamais ce que la marque a pensé de lui.

**RG5** — **Il n'existe aucun classement par pertinence** (**D11**). Le fil est chronologique ou trié
par échéance (RG33), jamais par score, jamais par « recommandé pour vous », jamais par mise en avant
payante. Aucun profil et aucune campagne ne sont remontés par un calcul.

**RG6** — La taxonomie du fil et des filtres est **exactement celle du profil créateur et de la
campagne** : `reference.topics`, `reference.networks`, `reference.formats`, `reference.countries`,
`reference.price_bands`, `reference.currencies` (`matching-spec` A1). **Deux vocabulaires sur les
mêmes critères divergent en trois mois** : aucune liste propre à ce document n'est créée.

**RG7** — Toute valeur destinée à filtrer ou à comparer est une **liste fermée** ou une **tranche**.
Les seuls textes libres de ce périmètre sont la **motivation** du créateur et la **proposition de
concept**, tous deux lus par un commercial avant d'atteindre la marque.

**RG8** — Toute règle de ce document — plafond, éligibilité, visibilité d'un champ, fermeture d'une
campagne — est appliquée **côté serveur**. L'écran est un confort ; il n'est jamais le seul contrôle
(**C(19)**).

**RG9** — Trois montants existent dans ce périmètre, et ils sont **toujours nommés distinctement**,
toujours avec leur devise :

| Notion | Libellé affiché au créateur | Qui la fixe | Visible de la marque |
|---|---|---|---|
| **Rémunération par créateur** | « Ce que la marque prévoit de payer, au total, par créateur » | La campagne (fourchette) | Oui, c'est elle qui la publie |
| **Tarif proposé** | « Ce que vous demandez, au total, pour cette campagne » | Le créateur, dans sa candidature | **Après validation et acceptation** (voir **Q4**) |
| **Net créateur estimé** | « Ce que vous percevriez, estimation » | Dérivé du référentiel (RG57) | **Jamais** |

**RG10** — Les deux premiers montants ont **la même assiette** : le **coût total pour l'annonceur**,
commission **incluse** (`CLAUDE.md` §3), identique à celle du tarif indicatif du profil (`07` RG65) et
du budget indicatif de la marque (`06` RG29). Sans cette identité, une fourchette de campagne et un
tarif de créateur ne seraient pas comparables.

**RG11** — **Le budget total de la campagne est une donnée interne** (`04` §5.4). Il n'est jamais
servi au rôle créateur, sous aucune forme, y compris agrégée, y compris arrondie, y compris dans une
charge utile que l'écran n'affiche pas.

**RG12** — **Aucun taux et aucune multiplication par un taux n'existent dans le code applicatif**
(**A1**, `03` C(32)). Le net créateur estimé est **lu** dans les colonnes du référentiel des tranches
(`reference.price_bands`), exactement comme au document `07` RG72.

### B — Le fil des campagnes ouvertes

**RG13** — Le fil des campagnes est accessible **à tout compte créateur authentifié**, y compris
lorsque son profil est en `brouillon` (`07` RG7). Il n'est **jamais public** : ni page indexée, ni
adresse devinable, ni accès sans authentification. Une campagne est une information commerciale d'une
marque.

**RG14** — Une campagne apparaît dans le fil si, et seulement si, **les cinq conditions** suivantes
sont réunies :

1. son état est `publié`, prononcé par un commercial (`03` §3.3) ;
2. le profil de la marque est `publié` et son compte n'est ni suspendu ni supprimé (`06` RG11) ;
3. la date limite de candidature n'est pas dépassée ;
4. la période de campagne n'est pas terminée ;
5. le plafond de candidatures de la campagne n'est pas atteint (RG65).

Une campagne qui cesse de remplir l'une de ces conditions **disparaît du fil**, et les candidatures
déjà envoyées sur cette campagne restent traitées selon §G.

**RG15** — La **carte de campagne** du fil affiche **exactement** ces informations, et rien d'autre :

| Information | Format | Pourquoi elle est là |
|---|---|---|
| Titre de la campagne | Texte modéré (document `09`) | Premier critère de lecture |
| Marque : nom commercial, logo, secteur, taille | Depuis le profil marque (`06` RG73) | Un créateur ne répond pas à une marque anonyme |
| Badge « Marque vérifiée » **et sa date** | Badge + date | Le créateur doit savoir ce qui a été contrôlé, et quand (`06` RG53) |
| Thématiques visées | `reference.topics` | Pertinence immédiate |
| Livrables attendus | `(réseau, format, quantité)` | Une campagne TikTok adressée à un profil sans TikTok est une demande morte |
| **Rémunération par créateur** | Fourchette `min – max` + devise, **ou** « contrepartie non monétaire » | Première cause d'échec en négociation |
| **Nature de la rémunération** | Liste fermée : monétaire · contrepartie non monétaire · monétaire et contrepartie | Un créateur ne lit pas un brief « produit offert » comme un brief payé (voir **Q13**) |
| Pays d'audience visés | `reference.countries` | La facette la plus discriminante |
| Période de la campagne | Dates de début et de fin | Disponibilité |
| **Date limite de candidature** | Date | Deuxième tri du fil |
| Mention « réservée aux profils dont l'audience est vérifiée » | Booléen, **écrit en toutes lettres** | §H |
| État de candidature du créateur | « Vous avez candidaté le … » · « Candidatures closes » | Évite d'écrire deux fois, et d'écrire pour rien |
| Date de publication de la campagne | Date | Tri par défaut |

**RG16** — La **fiche complète** d'une campagne ajoute à la carte : la description du produit, le
brief détaillé, les droits d'usage demandés, l'exclusivité demandée, les langues attendues, les
consignes de candidature rédigées par la marque, et le bloc marque complet **sans coordonnées**
(`06` RG74, **D40**).

**RG17** — **L'identité de la marque est toujours affichée sur une campagne publiée.** Il n'existe
**pas** de campagne anonyme au MVP. **Ce n'est pas la symétrie de D40** : D40 masque les *coordonnées
directes* d'une marque (e-mail, téléphone, prénom, page de contact) jusqu'à la révélation, **pas son
identité**, qui reste publique (`06` RG73 et RG74). Une demande d'anonymat de marque pendant la phase
de sélection est **hors périmètre** et relève du fondateur (voir **Q2**).

**RG18** — Une campagne dont la rémunération par créateur n'est ni chiffrée ni déclarée « contrepartie
non monétaire » **n'apparaît pas dans le fil**. Un brief sans prix fait perdre du temps aux deux
parties et produit des candidatures inexploitables. Cette exigence contraint le document `09` : la
rémunération par créateur et sa nature sont **obligatoires pour publier**.

**RG19** — Toute fourchette de rémunération est affichée **avec sa devise** et avec la mention fixe :
**« Rémunération prévue par créateur, coût total pour la marque — elle ne vaut pas engagement, le
montant se discute dans la conversation. »**

**RG20** — **Aucune conversion de devise n'est effectuée** (**D27** ouverte). Une campagne libellée
dans une devise que le créateur n'utilise pas est affichée telle quelle, avec sa devise, sans
rapprochement et sans taux.

**RG21** — Le fil est **paginé, avec un plafond de pages côté serveur**, et les routes de fil et de
fiche sont soumises à une **limitation de débit par compte** (`matching-spec`, garde-fous). L'export,
la copie en masse et l'aspiration du fil sont interdits par les mêmes moyens que côté marque
(**C(17)**) : un annuaire des campagnes en circulation est aussi dommageable qu'un annuaire de
créateurs.

**RG22** — Chaque consultation de fiche de campagne est **journalisée** (compte, campagne, date), sans
en informer la marque (RG40). C'est la contrepartie de l'ouverture du fil et la donnée qui manquera à
**D11** si elle n'est pas collectée dès maintenant.

**RG23** — Un créateur dont le profil est **suspendu** n'accède plus au fil ; ses candidatures en
cours sont clôturées selon RG80. Un créateur dont le profil est en `brouillon` ou `refusé` accède au
fil **en lecture seule**, et chaque campagne affiche le message qui nomme ce qui lui manque pour
candidater (RG46).

**RG24** — Une campagne **retirée ou dépubliée** après qu'un créateur l'a mise de côté n'affiche
jamais une erreur technique : elle affiche « cette campagne n'est plus ouverte », sans autre détail.

**RG25** — Le fil ne comporte **ni compteur de candidatures reçues, ni compteur de vues, ni classement
de popularité** (voir **Q6**). Un compteur crée un effet de meute sur trois campagnes et laisse les
autres vides.

**RG26** — Le fil affiche l'état de **campagne close** (échéance atteinte ou plafond atteint) pendant
**7 jours** après la fermeture, en grisé et sans bouton, puis la campagne disparaît. Une campagne qui
s'évapore du jour au lendemain fait croire à un bug.

### C — Filtres, tri et pagination

**RG27** — Les filtres du fil sont **exactement** ceux-ci, et aucun autre n'est ajouté sans passer par
`chef-de-projet` :

| # | Filtre | Format | Justification |
|---|---|---|---|
| C1 | Thématique | Multi-choix `reference.topics` | Premier critère de pertinence |
| C2 | Réseau | Multi-choix `reference.networks` | Un brief hors de mes réseaux est une perte de temps |
| C3 | Format | Multi-choix `reference.formats` | Un format que je ne produis pas est une exclusion |
| C4 | Pays d'audience visé | Multi-choix `reference.countries` | Le même référentiel que le pays principal d'audience du profil |
| C5 | **Rémunération minimale** | Borne basse `reference.price_bands` + **devise obligatoire** | Première cause d'échec en négociation |
| C6 | Nature de la rémunération | Liste fermée (RG15) | Trier le payé et le non payé |
| C7 | **Campagnes auxquelles je peux candidater** | Booléen | Retire les campagnes closes, réservées aux vérifiés si je ne le suis pas, et celles où j'ai déjà candidaté |

**RG28** — Le filtre de **rémunération minimale exige une devise** : une tranche sans devise n'a pas
de sens. Les campagnes libellées dans une autre devise **ne sont ni converties, ni comparées, ni
exclues silencieusement** : elles sont regroupées à part sous l'intitulé « campagnes dans une autre
devise », avec un message expliquant qu'INFLUX ne convertit pas (**D27**, voir **Q10**).

**RG29** — Les filtres sont **cumulatifs** (un « et » entre critères, un « ou » à l'intérieur d'un
critère), et l'ensemble des critères actifs est affiché en permanence, chacun retirable d'un geste.

**RG30** — **Un filtre ne ment jamais par omission.** Lorsqu'un résultat est vide, l'écran nomme les
critères actifs, propose de retirer le plus restrictif, et ne prétend jamais qu'« aucune campagne
n'existe » (`matching-spec`, cas froid).

**RG31** — **Aucun filtre n'est pré-rempli à partir du profil sans le dire.** Si le fil applique par
défaut les thématiques et les réseaux déclarés du créateur, cette pré-sélection est **visible,
nommée et retirable en un clic**. Un filtre invisible est une censure.

**RG32** — Les filtres et leur résultat sont **journalisés** dans le même journal que les recherches
(`search.search_queries`, `view_mode` propre au fil créateur), avec leur nombre de résultats. C'est la
donnée qui dira quelles campagnes manquent au catalogue.

**RG33** — Les tris disponibles sont **exactement deux**, plus un ordre de départage :

| Tri | Comportement | Par défaut |
|---|---|---|
| **Plus récentes** | Date de publication décroissante | **Oui** |
| **Date limite la plus proche** | Date limite de candidature croissante ; les campagnes sans date limite passent après | Non |
| Départage | Identifiant de campagne, stable | Toujours |

Un ordre de départage stable est ce qui empêche une même campagne d'apparaître sur deux pages, ou sur
aucune.

**RG34** — **Aucun tri n'est pondéré, personnalisé ou appris** (**D11**). Le jour où un tri par
pertinence existera, il sera **expliqué à l'écran** et spécifié par `expert-matching`.

**RG35** — Le nombre de résultats est affiché **avant** la liste. Un créateur doit savoir s'il regarde
4 campagnes ou 40.

**RG36** — La pagination est **explicite** (pages numérotées ou bouton « voir la suite »), jamais un
défilement infini : un défilement infini rend le plafond de pages de RG21 incompréhensible.

### D — Ce qu'un créateur ne voit jamais

**RG37** — Tableau de référence, ligne par ligne. Il est la formulation produit de la matrice `03`
§3.3 et §3.4, et il ne la contredit sur aucun point :

| Élément | Avant candidature | Après candidature validée | Après ouverture de la mise en relation |
|---|---|---|---|
| Nom, logo, secteur, taille, marchés, badge de la marque | Visible | Visible | Visible |
| Brief, livrables, droits d'usage, exclusivité | Visible | Visible | Visible |
| **Rémunération par créateur** (fourchette) | Visible | Visible | Visible |
| **Budget total de la campagne** | **Jamais** | **Jamais** | **Jamais** |
| Notes internes de la campagne, commercial responsable | **Jamais** | **Jamais** | **Jamais** |
| **Coordonnées de l'interlocuteur** (e-mail, téléphone, prénom, page de contact) | **Masquées** | **Masquées** | Visibles (**D40**, `06` RG38) |
| Nombre de candidatures reçues par la campagne | **Jamais** (voir **Q6**) | **Jamais** | **Jamais** |
| Identité ou nombre des autres candidats | **Jamais** | **Jamais** | **Jamais** |
| Le fait que la marque l'a mis dans une sélection (shortlist) | **Jamais** | **Jamais** | **Jamais** |
| Le fait qu'une demande de contact de la marque le concerne et n'est pas validée | **Jamais** (**C(18)**) | **Jamais** | — |
| Le motif interne rédigé par le commercial | **Jamais** | **Jamais** | **Jamais** |

**RG38** — Les éléments marqués « jamais » **ne figurent pas dans la réponse** servie au rôle
créateur, pas même vides, pas même nuls. **Le contrôle porte sur la réponse, pas sur l'écran**
(symétrie exacte avec `06` RG39 et `07` RG18).

**RG39** — Un créateur n'a **aucun moyen** d'atteindre une campagne non publiée : ni identifiant
séquentiel, ni adresse devinable. L'identifiant de campagne servi côté créateur est **opaque**.

**RG40** — **Une marque n'est jamais notifiée** de la consultation de sa campagne par un créateur, ni
du nombre de consultations en temps réel. Elle dispose d'un compteur agrégé dans son espace, sans
aucune identité (contrainte pour le document `09`).

**RG41** — Un créateur ne voit **jamais** les campagnes d'une marque avec laquelle il est déjà en
relation autrement que comme les autres : aucun traitement de faveur, aucun encart « votre marque ».

**RG42** — Les **secteurs refusés** par le créateur (`07` RG75) produisent une **exclusion
silencieuse** du fil : les campagnes relevant d'un secteur refusé n'apparaissent pas, **sans message,
sans emplacement grisé, sans décompte** (`matching-spec` A8). Le créateur peut modifier sa liste à
tout moment depuis son profil, et l'écran de cette liste dit en toutes lettres ce qu'elle masque.

**RG43** — Aucun élément de ce périmètre n'expose une donnée personnelle d'une personne physique de
la marque, à la seule exception de la **fonction** de l'interlocuteur (`06` RG35).

**RG44** — Le créateur dispose, dans son espace, d'une explication écrite de **ce que la marque verra
de lui** s'il candidate : son profil anonymisé aujourd'hui, sa couche identifiée après ouverture de la
mise en relation. Cette explication est affichée **avant** la première candidature, en toutes lettres,
et pointe vers la prévisualisation du document `07` RG104.

### E — Le contenu d'une candidature

**RG45** — Une candidature se rédige **depuis la fiche d'une campagne**, jamais depuis un formulaire
générique. Une candidature sans campagne n'existe pas (`04` §5.6 : `campaign_id` obligatoire pour
`origin = creator_application`).

**RG46** — **Peut candidater** un compte créateur qui remplit **les cinq conditions** suivantes,
vérifiées côté serveur :

1. son profil est à l'état `publié` (`07` RG3) — donc il porte au moins un badge « Compte vérifié »
   (`08` RG16) ;
2. son compte n'est ni suspendu, ni en cours de suppression ;
3. il déclare **au moins un couple (réseau, format)** commun avec les livrables de la campagne ;
4. il satisfait la restriction « audience vérifiée » si la campagne l'exige (§H) ;
5. aucun de ses plafonds de candidature n'est atteint (§F).

Chaque condition non remplie affiche **son propre message**, nommant précisément ce qui manque et le
geste à faire. Un bouton désactivé sans explication est un défaut.

**RG47** — Le formulaire de candidature comporte **exactement** ces champs, et aucun autre :

| Champ | Obligatoire | Format | Pourquoi il existe |
|---|---|---|---|
| **Motivation** | **Oui** | Texte libre, 120 à 2 000 caractères | **A9** : c'est le motif écrit qui distingue une candidature d'un clic. C'est aussi ce que lit le commercial |
| **Proposition de concept** | Non | Texte libre, ≤ 1 000 caractères | Ce qui fait la différence entre deux créateurs équivalents sur le papier |
| **Formats proposés** | **Oui** (≥ 1) | Multi-choix, **restreint à l'intersection** des livrables de la campagne et des couples (réseau, format) du profil | Évite une candidature hors sujet et une saisie libre |
| **Tarif proposé** | **Oui**, sauf campagne « contrepartie seule » | Montant exact > 0 + devise (RG54) | C'est l'offre du créateur pour cette campagne |
| **Acceptation de la contrepartie** | Oui si la campagne est « contrepartie seule » ou « monétaire et contrepartie » | Case non pré-cochée | Une contrepartie acceptée par défaut n'est pas acceptée |
| **Disponibilité sur la période** | **Oui** | Case non pré-cochée : « je suis disponible sur la période annoncée » | Première cause d'abandon après la mise en relation |
| **Acceptation à l'écran** | **Oui** | Case non pré-cochée + version de CGU | `01` §3 étape 4 : l'acceptation est datée et rattachée à une version |

**RG48** — **Rien de ce que le profil contient n'est redemandé** : ni réseaux, ni chiffres d'audience,
ni tarif indicatif, ni portfolio, ni langues, ni pays. Le formulaire affiche un **rappel en lecture
seule** de ce que le commercial et, plus tard, la marque verront, avec un lien vers le profil. Toute
redemande est un défaut bloquant.

**RG49** — La candidature **ne recopie pas le profil**. Elle ne conserve que ce qui lui est propre
(motivation, concept, formats proposés, tarif proposé) plus les données historisées exigées par `04`
§5.6 : pays des deux parties et version de CGU acceptée à la date des faits. Le profil reste **la
source unique** : un créateur qui met ses chiffres à jour met à jour ce que le commercial voit.

**RG50** — **Aucune pièce jointe, aucun lien, aucune adresse** n'est acceptée dans une candidature
(`00-cadrage` §6.2). Les textes sont soumis aux **mêmes interdits que la bio** (`07` RG27) : pas de
pseudo, pas de `@`, pas d'URL, pas d'adresse e-mail, pas de numéro de téléphone, pas d'identifiant de
messagerie, pas de nom de compte.

**RG51** — Une **détection automatique signale** ces éléments au commercial ; **elle ne bloque pas
l'envoi et ne modifie pas le texte** (M5 : signaler, pas masquer). La détection stocke **le type de
motif et sa position, jamais une copie du texte détecté** (**C(26)**). Le commercial décide, et refuse
le cas échéant avec le motif dédié (RG92).

> **Point de vigilance business.** La motivation est le premier texte libre qu'un créateur peut
> adresser à une marque. Si une candidature validée était transmise sans lecture, un numéro de
> téléphone glissé dans un texte suffirait à faire disparaître la commission. **La lecture humaine
> avant transmission n'est pas une étape de confort : c'est la protection du modèle économique.**

**RG52** — La candidature est **enregistrée en brouillon automatiquement** pendant la rédaction. Un
créateur interrompu ne recommence jamais. Un brouillon n'est **ni une candidature, ni une entrée en
file** : il n'existe que pour son auteur, ne compte dans aucun plafond, et disparaît si la campagne se
ferme (voir **Q12** pour sa durée de conservation).

**RG53** — L'**envoi est une action explicite**, confirmée par un écran récapitulatif qui affiche,
avant validation : la campagne, les formats proposés, le tarif proposé, le net créateur estimé, ce que
le commercial verra, et le rappel que **la marque ne recevra la candidature qu'après validation par
INFLUX**.

**RG54** — Le **tarif proposé** est saisi en **valeur exacte, strictement positive**, dans la **devise
de la campagne** lorsque la campagne en déclare une ; à défaut, dans la devise du profil créateur.
**Aucune conversion** (**D27**). Un tarif sans devise n'existe pas.

**RG55** — Le libellé du champ énonce la consigne **avant** la saisie : **« Indiquez ce que la marque
paie au total pour cette campagne. Ce que vous percevez s'affiche juste en dessous. »** C'est
exactement la consigne du profil (`07` RG65) : deux formulations différentes produiraient deux
assiettes différentes.

**RG56** — Lorsque le tarif proposé sort de la fourchette annoncée par la campagne, la saisie est
**acceptée** et un message factuel s'affiche : **« Votre proposition est au-dessus de la rémunération
annoncée (min – max devise). Elle sera transmise telle quelle au commercial INFLUX. »** Un créateur
n'a pas à être empêché de demander son prix ; la marque n'a pas à être surprise.

**RG57** — Le **net créateur estimé** est affiché juste sous le tarif proposé, **dans la même devise**,
sous forme de **tranche lue dans `reference.price_bands`** : la tranche qui contient le montant saisi
porte ses bornes nettes, calculées une fois lors de la création de la version du référentiel
(`07` RG72). **Aucune multiplication par un taux n'est faite dans le code applicatif** (voir **Q5**).

**RG58** — Le net créateur estimé est accompagné, partout où il apparaît, de la **mention fixe** :
**« Estimation indicative, aux taux par défaut de la plateforme : commission INFLUX 35 %, dont 20 % à
la charge de la marque et 15 % à votre charge. Elle ne vaut pas engagement : les taux applicables sont
figés au moment de la signature du contrat. »** Le traitement fiscal n'est pas tranché (**D7**) :
aucun écran n'écrit « hors taxes » ni « taxes comprises ».

**RG59** — **Le net créateur estimé n'est jamais affiché à une marque**, en aucune circonstance
(symétrie exacte avec `06` RG32 et `07` RG70).

**RG60** — Le **tarif proposé exact** est visible **des rôles internes en permanence**, et de la
marque **seulement après validation de la candidature et acceptation par la marque** (RG75). Il s'agit
d'une **offre délibérée du créateur pour cette campagne**, distincte du tarif indicatif de son profil,
lequel reste couvert par `07` RG103 (tranche seulement, jamais la valeur exacte). Cette distinction
est soumise à **Q4**.

### F — Plafonds de candidature

**RG61** — Quatre plafonds coexistent, **tous appliqués côté serveur** et **tous paramétrables en
table** (`backoffice.sla_policies` ou équivalent), jamais codés en dur (`04` Q4) :

| # | Plafond | Valeur de départ proposée | Porté par | Effet |
|---|---|---|---|---|
| P1 | **Candidatures actives par créateur** | **10** | Le créateur | Blocage de toute nouvelle candidature |
| P2 | **Nouvelles candidatures par créateur et par jour glissant** | **5** | Le créateur | Blocage jusqu'au lendemain |
| P3 | **Candidatures actives par campagne** | **30** | La campagne (`max_applications`) | La campagne passe en « candidatures closes » pour tout le monde |
| P4 | **Candidatures par créateur et par campagne** | **1 active, 2 au total** | Le couple | Empêche le doublon et l'insistance |

**RG62** — Est **active** une candidature dont le statut est `envoyée`, `en cours d'examen` ou
`validée`. Une candidature `refusée`, `retirée` ou `clôturée sans suite` **ne compte dans aucun
plafond**. Une candidature qui a donné lieu à une mise en relation ouverte **ne compte plus** : la
relation existe, elle n'occupe plus une place dans la file.

**RG63** — Le créateur voit **en permanence** son compteur : « **7 candidatures actives sur 10** ».
Lorsque le plafond est atteint, le message nomme le plafond, explique ce qui libère une place (une
décision d'INFLUX, un retrait) et **ne propose jamais de le lever contre paiement**.

**RG64** — Chaque atteinte d'un plafond est **journalisée** (**C(19)**) : un créateur qui bute
plusieurs fois sur P1 est soit un profil très actif à rappeler, soit un arroseur à surveiller. C'est
au commercial d'en juger, pas à un automatisme.

**RG65** — Lorsque **P3** est atteint, la campagne affiche « candidatures closes » et **disparaît du
fil** dans les conditions de RG26. Les candidatures déjà en file **sont traitées normalement** : un
plafond ferme l'entrée, il n'annule jamais ce qui est déjà entré.

**RG66** — **Une seule candidature active par campagne** (P4). Une seconde tentative sur une campagne
où une candidature est active affiche « vous avez déjà candidaté le … » et propose de consulter son
état.

**RG67** — **Après un refus, une seconde et dernière candidature est possible** sur la même campagne,
et seulement si le motif de refus est marqué **corrigible** (RG92) et si la campagne est toujours
ouverte. Au-delà, le message est explicite et propose d'autres campagnes. Ce comportement suppose un
attribut « corrigible » sur les motifs de refus (écart à instruire, §Impacts).

**RG68** — **Un créateur ne peut pas candidater à une campagne de son propre compte.** Le cas est
théoriquement impossible (**D41** : un rôle par compte) ; la règle est écrite et contrôlée quand même,
car **D41** est réversible (`04` §5.1.1).

**RG69** — Les plafonds sont **modifiables par un administrateur** sans déploiement, chaque
modification étant journalisée nominativement avec sa valeur avant et après (`03` §3.1, C(3)).

**RG70** — **Aucun plafond ne s'applique au commercial.** La proposition INFLUX n'est pas une
candidature et ne consomme aucun plafond : c'est le geste métier qu'il faut au contraire accélérer
(`01` §4.3).

### G — Les états d'une candidature

**RG71** — Une candidature connaît **huit états, et huit seulement**. La colonne « ce que voit le
créateur » est un **libellé imposé**, pas une suggestion :

| # | État | Statut technique (`04` §5.6) | Ce que voit le créateur | Ce que voit la marque |
|---|---|---|---|---|
| 1 | **Brouillon** | *(aucun — RG52)* | « Brouillon enregistré » | Rien |
| 2 | **Envoyée** | `pending_review` | « Envoyée — en cours d'examen par INFLUX, réponse sous 1 jour ouvré » | Rien |
| 3 | **En cours d'examen** | `in_review` | **Le même libellé que l'état 2** (RG72) | Rien |
| 4 | **Validée, transmise à la marque** | `approved`, `identity_revealed_at` vide | « Validée par INFLUX et transmise à la marque » | **La candidature complète, créateur anonymisé** |
| 5 | **Mise en relation ouverte** | `approved`, `identity_revealed_at` posé | « Mise en relation ouverte — référence MER-… » | Idem, identités révélées |
| 6 | **Refusée par INFLUX** | `rejected` + motif typé | « INFLUX n'a pas transmis cette candidature : {motif} » | **Rien, jamais** (**C(18)**) |
| 7 | **Retirée par vous** | `withdrawn` | « Vous avez retiré cette candidature le … » | Rien, ou fin d'accès si déjà transmise |
| 8 | **Clôturée sans suite** | `expired` + sous-motif | « Cette candidature est clôturée : {cause neutre} » | Rien |

**RG72** — Le créateur **ne voit pas la différence entre « envoyée » et « prise en charge »**. La
mécanique interne de la file ne lui est pas exposée : elle l'inviterait à interpréter un silence.

**RG73** — L'écran affiche, pour un état 2 ou 3, **le délai annoncé (1 jour ouvré, D39)** et la date
d'envoi. Au-delà du délai, le message devient : **« Votre candidature prend plus de temps que prévu.
Un commercial INFLUX la traite. »** — factuel, sans excuse automatique et sans promesse nouvelle.

**RG74** — Le passage de l'état 4 à l'état 5 exige **l'acceptation des deux parties** : celle du
créateur est enregistrée à l'envoi de la candidature (RG47), celle de la marque est enregistrée sur
l'écran de la candidature validée. La révélation d'identité et l'ouverture de la conversation sont
**une seule opération atomique** (**C(21)**), jamais deux actions séparées.

**RG75** — **Tant que la marque n'a pas accepté, rien n'est révélé** : la marque lit la candidature
d'un créateur **anonymisé** (alias, couche A, plus la motivation, les formats proposés et le tarif
proposé). C'est cette acceptation qui déclenche la révélation simultanée dans les deux sens
(`07` RG19). Cette exigence est soumise à **Q1** : elle applique la contrainte de base
`introductions_reveal_requires_both_acceptances` (`04` §5.6), plus stricte que la formulation de
**C(21)**.

**RG76** — **Le créateur peut retirer sa candidature** à tout moment **tant que la mise en relation
n'est pas ouverte**. Le retrait est immédiat, libère une place dans ses plafonds, est journalisé, et
n'expose aucun motif à la marque. Après ouverture, le retrait n'existe plus : c'est la conversation
qui se clôt, avec un motif (Lot 4).

**RG77** — Une candidature est **clôturée sans suite** (état 8) dans **cinq cas, et cinq seulement**,
chacun portant son sous-motif interne et son message neutre au créateur :

| Cause interne | Message au créateur |
|---|---|
| La campagne a été clôturée, dépubliée ou retirée avant traitement | « Cette campagne n'est plus ouverte. » |
| La date limite de candidature est passée avant traitement | « La date limite de candidature est passée. » |
| Le profil de la marque a été suspendu | « Cette campagne n'est plus ouverte. » |
| La marque n'a pas donné suite dans le délai (RG78) | « INFLUX a clôturé cette candidature, sans suite. » |
| Le profil du créateur a été suspendu ou son compte supprimé | Message dédié, hors de ce périmètre |

**RG78** — Une candidature **validée** et non acceptée par la marque est clôturée automatiquement au
bout de **7 jours calendaires** (valeur de départ, **paramètre en table**, voir **Q8**). Le commercial
est alerté à J+3 pour relancer la marque. Le créateur n'apprend **jamais** que la marque n'a pas
répondu : le message reste celui de RG77.

**RG79** — **Aucune candidature ne disparaît sans décision.** Une sortie silencieuse de la file est un
défaut bloquant (`backoffice-ops`, règle 8). Chaque changement d'état porte sa date, son auteur (ou
« système ») et son motif.

**RG80** — **Suspension d'un compte** : si le créateur est suspendu, ses candidatures actives passent
en état 8 ; si la marque est suspendue, idem. Dans les deux cas, **les mises en relation déjà
ouvertes ne sont pas affectées** (`06` RG11, `07` RG11).

**RG81** — Une candidature clôturée, refusée ou retirée **reste consultable par son auteur** dans son
espace, avec son motif et ses dates. Un historique effacé empêche le créateur de comprendre ce qu'on
attend de lui (durée de conservation : **Q12**).

**RG82** — **`origin` est immuable.** Une candidature ne devient jamais une demande de contact ni une
proposition INFLUX, quel que soit le déroulé ultérieur (`04` §5.6, déclencheur `write-once`).

### H — La restriction « réservée aux profils dont l'audience est vérifiée »

**RG83** — L'option de campagne se nomme **« réservée aux profils dont l'audience est vérifiée »** et
signifie **exactement** ceci : le créateur doit porter un badge **« Audience vérifiée » actif** sur
**au moins un des réseaux demandés par la campagne** (`08` RG11 et RG15). Le badge « Compte vérifié »
ne suffit pas — il est de toute façon obligatoire pour publier un profil (`08` RG16).

**RG84** — **Cette option est globalement désactivée au lancement**, par paramètre en table, tant que
la masse critique de **D38** n'est pas atteinte (`08` RG18). Tant qu'elle est désactivée, aucune
campagne ne l'affiche et aucun créateur n'est écarté à ce titre.

**RG85** — Une campagne réservée **reste visible dans le fil** de tous les créateurs, avec la mention
écrite en toutes lettres. **Elle n'est jamais masquée** : masquer priverait le créateur de
l'information qui lui dit quoi faire pour y accéder.

**RG86** — Un créateur non éligible qui ouvre une campagne réservée voit un message qui nomme
**précisément** ce qui manque et le geste à faire : **« Cette campagne est réservée aux profils dont
l'audience est vérifiée. Votre audience n'est pas encore vérifiée sur {réseaux demandés}. Demander la
vérification. »** Le bouton de candidature est visible et mène à cette explication, jamais à une
erreur.

**RG87** — La tentative de candidature d'un créateur non éligible est **refusée côté serveur** et
**journalisée** : le nombre de tentatives est l'indicateur qui dira si la restriction motive les
demandes de badge ou si elle vide le vivier (`08` Q4).

### I — La file de validation, et ce qui distingue une candidature d'une demande de contact

**RG88** — Candidatures et demandes de contact alimentent **une seule file** (`backoffice-ops`, les
cinq files du MVP), avec un **filtre par origine**. Une file par déclencheur obligerait le commercial
à surveiller deux écrans pour le même métier.

**RG89** — **Ce qui distingue les deux parcours**, ligne par ligne. Ce tableau est la référence pour
`expert-ux` et pour `testeur` :

| Point | **Demande de contact** (la marque demande) | **Candidature** (le créateur postule) |
|---|---|---|
| Qui déclenche | La marque, depuis un profil anonymisé | Le créateur, depuis une campagne publiée |
| Campagne | Facultative | **Obligatoire** (`04` §5.6) |
| Contenu saisi | Motif court de la marque | **Motivation, concept, formats proposés, tarif proposé** |
| Ce que sait la partie visée avant validation | Le créateur ne sait rien (**C(18)**) | La marque ne sait rien (**C(18)**) |
| Acceptation du déclencheur | La marque accepte à l'écran au moment de sa demande | Le créateur accepte à l'écran au moment de sa candidature |
| Acceptation de l'autre partie | Le créateur accepte après validation | **La marque accepte après validation** (RG75, **Q1**) |
| Plafonds | Propres à la marque (document `10`) | **P1 à P4** (§F) |
| Motifs de refus | Liste propre à la demande de contact | **Liste propre à la candidature** (RG92) |
| Délai de traitement | **1 jour ouvré** (**D39**) | **1 jour ouvré** (**D39**) — identique |
| Risque principal | Une marque qui aspire l'annuaire | **Un texte libre qui contient une coordonnée** |
| Ce que le commercial vérifie en priorité | La pertinence du rapprochement | **Le sérieux de la candidature et l'absence de coordonnée** |

**RG90** — L'entrée de file affiche, **sans qu'il faille ouvrir autre chose** : l'origine, la
campagne, l'alias et le profil identifié du créateur, la motivation intégrale, les formats proposés,
le tarif proposé et sa devise, la fourchette de la campagne, les alertes de détection, le temps
restant avant échéance du délai, et le commercial qui a pris l'entrée en charge
(`backoffice-ops`, étape 1).

**RG91** — **Prise en charge, verrou et expiration sont identiques à toutes les files** : un verrou
nominatif, visible des autres agents, une expiration automatique après **30 minutes** sans décision,
un message « déjà prise en charge par … » et jamais une erreur technique (`04` §5.6, verrou par
transition conditionnelle).

**RG92** — La liste des motifs de refus d'une candidature est **fermée**, distincte de celle des
demandes de contact, et chaque motif porte **le message envoyé au créateur** et son caractère
**corrigible** :

| Motif | Message au créateur | Corrigible |
|---|---|---|
| Candidature hors sujet | « Votre candidature ne répond pas au brief de cette campagne. » | Oui |
| **Coordonnée directe dans la candidature** | « Votre candidature contient une adresse, un numéro ou un lien. Ces informations sont partagées une fois la mise en relation ouverte. » | Oui |
| Motivation trop courte ou générique | « Votre motivation ne permet pas à la marque de comprendre ce que vous proposez. » | Oui |
| Formats proposés incohérents avec votre profil | « Les formats proposés ne correspondent pas à ceux de votre profil. » | Oui |
| Tarif très éloigné de la rémunération annoncée | « Votre tarif s'écarte fortement de la rémunération annoncée par cette campagne. » | Oui |
| Profil incomplet ou chiffres périmés | « Vos chiffres datent de plus de 90 jours : mettez-les à jour avant de candidater. » | Oui |
| Audience incompatible avec le ciblage de la campagne | « Votre audience ne correspond pas au ciblage de cette campagne. » | Non |
| Mise en relation déjà en cours avec cette marque sur cette campagne | « Une mise en relation est déjà en cours sur cette campagne. » | Non |
| Contenu illicite ou contraire aux CGU | Message dédié selon le cas | Non |
| Autre | Message rédigé par l'agent, **en complément** d'une explication | Selon le cas |

**RG93** — Le motif **« Autre » est exceptionnel et surveillé** : au-delà de **10 % des refus** sur un
mois, la liste est incomplète et doit être étendue. Un commentaire libre est autorisé **en complément**
d'un motif typé, **jamais à sa place**.

**RG94** — **Aucun motif de refus n'attribue la décision à la marque**, ni explicitement, ni par
allusion. Le contrôle du libellé de chaque motif est un point de revue obligatoire d'`expert-ux`.

**RG95** — Valider une candidature **attribue l'affaire au commercial** qui décide
(`owner_agent_id`) : il devient responsable du suivi, de la relance de la marque et de la clôture
éventuelle (`01` §3, étape 3).

**RG96** — Le commercial peut, **avant** de valider, demander une correction au créateur : la
candidature retourne à l'état 6 avec un motif corrigible, et le créateur peut la refaire dans la
limite de P4. **Il n'existe pas d'état « en attente de correction »** : une entrée ne reste jamais en
suspens dans la file.

**RG97** — Le commercial **ne modifie jamais le texte d'une candidature**. Il refuse, ou il valide. Un
texte réécrit par INFLUX et présenté comme celui du créateur serait une falsification.

**RG98** — Le tableau de bord du backoffice affiche : candidatures en attente, ancienneté de la plus
ancienne, délai médian et délai du 9e cas sur 10, part hors délai, répartition des refus par motif,
candidatures validées non acceptées par la marque depuis plus de 3 jours, et campagnes ayant atteint
leur plafond.

**RG99** — Toute décision (prise en charge, validation, refus, clôture, réattribution, modification
d'un plafond) est **journalisée nominativement** et **notifiée** à la partie concernée. Une décision
non notifiée est une décision invisible, donc contestable.

### J — Notifications

**RG100** — Ce que reçoit **le créateur**, et rien d'autre :

| Événement | Canal | Contenu |
|---|---|---|
| Candidature envoyée | Écran + e-mail transactionnel | Campagne, date, délai annoncé, lien vers l'état |
| Candidature validée et transmise | Écran + e-mail | « INFLUX a transmis votre candidature à la marque. » — **aucune promesse de réponse** |
| Mise en relation ouverte | Écran + **e-mail de confirmation M2** | Référence `MER-…`, date et heure, nom des deux parties, **nom du commercial INFLUX**, campagne, version de CGU (`01` M2) |
| Candidature refusée | Écran + e-mail | Motif typé dans sa langue, ce qu'il peut faire, et **le fait que la décision vient d'INFLUX** |
| Candidature clôturée sans suite | Écran + e-mail | Message neutre de RG77 |
| Délai de traitement dépassé | Écran uniquement | Message de RG73 |

**RG101** — Le créateur **ne reçoit jamais** : une notification quand la marque lit sa candidature,
quand elle hésite, quand elle en accepte une autre, quand elle en refuse. Aucune de ces informations
ne lui est due, et chacune serait une information commerciale sur la marque.

**RG102** — La marque reçoit **une seule notification** dans ce périmètre : **une candidature validée
vous a été transmise**, avec la campagne, l'alias du créateur, et rien qui l'identifie. Elle ne reçoit
**aucune** notification pour une candidature refusée, retirée ou clôturée (**C(18)**).

**RG103** — Le commercial voit dans sa file, en temps réel : les entrées nouvelles, le temps restant
avant échéance, les alertes de détection, les entrées dont la marque n'a pas donné suite. Les alertes
d'échéance sont **visuelles et écrites**, jamais portées par la seule couleur.

**RG104** — Tout e-mail transactionnel de ce périmètre est **bilingue par destinataire** (langue du
compte), porte la référence de la mise en relation lorsqu'elle existe, et **ne contient jamais** de
coordonnée de l'autre partie avant révélation (`06` RG40).

**RG105** — **Aucune notification ne pousse à sortir de la plateforme.** Aucun e-mail ne propose
d'écrire directement à la marque, ne cite un domaine cliquable de la marque, ni ne reproduit un extrait
de texte contenant un élément de contact.

**RG106** — Les notifications transactionnelles **ne dépendent pas du consentement marketing** : elles
exécutent la relation. Les relances commerciales, elles, en dépendent, et ne partent pas sans lui
(Lot 1).

**RG107** — Un échec d'envoi d'un e-mail de décision **n'annule jamais la décision** : elle est
enregistrée, l'envoi est mis en file et réessayé, et l'échec est visible au backoffice avec rejeu
possible.

**RG108** — **Aucune alerte automatique de nouvelles campagnes** (résumé quotidien, notification
poussée) n'existe au MVP : elle relève d'un scénario Brevo consenti et d'une segmentation, à instruire
par `expert-marketing` (voir **Q11**).

### K — Leads, messages, états d'écran et accessibilité

**RG109** — Une candidature émet un événement **`lead.updated`** suivant exactement le pipeline du
Lot 1 : émission dans la même transaction que le fait décrit, charge utile réduite à des
identifiants, **consentement relu à la consommation**.

**RG110** — **Ne partent jamais** vers Brevo ni Apollo : le texte de la candidature, le nom de la
marque, le titre de la campagne, le tarif proposé, le net estimé, le motif de refus, l'identité de
l'autre partie. Au plus, sous consentement marketing, un **indicateur d'activité non identifiant** :
« a candidaté au moins une fois » et la date de la dernière candidature (voir **Q7**).

**RG111** — **Un champ absent est envoyé vide, jamais rempli d'une valeur inventée** (règle héritée du
Lot 1).

**RG112** — Chaque écran de ce périmètre possède **quatre états explicites** : repos, chargement,
succès, échec. **Aucune saisie n'est perdue sur erreur**, y compris à l'envoi d'une candidature
refusé par le serveur pour cause de plafond ou de campagne fermée.

**RG113** — Tous les messages existent en **français et en anglais** ; aucun n'est écrit en dur.

| Clé | Français | English |
|---|---|---|
| `campaignFeed.empty.filtered` | Aucune campagne ne correspond à vos {count, plural, one {# filtre} other {# filtres}}. Retirez un filtre pour voir plus de campagnes. | No campaign matches your {count, plural, one {# filter} other {# filters}}. Remove a filter to see more campaigns. |
| `campaignFeed.prefilled` | Nous avons pré-rempli vos thématiques et vos réseaux. Vous pouvez les retirer. | We pre-filled your topics and networks. You can remove them. |
| `campaignFeed.otherCurrency` | Ces campagnes sont libellées dans une autre devise. INFLUX ne convertit pas les montants. | These campaigns use another currency. INFLUX does not convert amounts. |
| `campaignFeed.pay.notice` | Rémunération prévue par créateur, coût total pour la marque — elle ne vaut pas engagement, le montant se discute dans la conversation. | Expected pay per creator, total cost to the brand — not a commitment; the amount is discussed in the conversation. |
| `campaignFeed.closed` | Cette campagne n'est plus ouverte. | This campaign is no longer open. |
| `campaignFeed.verifiedOnly` | Réservée aux profils dont l'audience est vérifiée. | Reserved for creators with verified audience. |
| `application.blocked.verifiedOnly` | Cette campagne est réservée aux profils dont l'audience est vérifiée. Votre audience n'est pas encore vérifiée sur {networks}. | This campaign is reserved for creators with verified audience. Yours is not verified yet on {networks}. |
| `application.blocked.profileDraft` | Publiez votre profil pour pouvoir candidater. | Publish your profile before applying. |
| `application.quota.remaining` | {used} candidatures actives sur {limit}. | {used} active applications out of {limit}. |
| `application.quota.reached` | Vous avez atteint votre plafond de {limit} candidatures actives. Une place se libère dès qu'une candidature est traitée ou retirée. | You have reached your limit of {limit} active applications. A slot frees up as soon as an application is processed or withdrawn. |
| `application.rate.hint` | Indiquez ce que la marque paie au total pour cette campagne. Ce que vous percevez s'affiche juste en dessous. | Enter the total amount the brand pays for this campaign. What you receive is shown just below. |
| `application.rate.net` | Vous percevriez environ {min} – {max} {currency}. Commission INFLUX 35 % : 20 % à la charge de la marque, 15 % à votre charge. | You would receive approximately {min} – {max} {currency}. INFLUX commission 35%: 20% paid by the brand, 15% paid by you. |
| `application.rate.aboveRange` | Votre proposition est au-dessus de la rémunération annoncée ({min} – {max} {currency}). Elle sera transmise telle quelle au commercial INFLUX. | Your offer is above the advertised pay ({min} – {max} {currency}). It will be passed on as is to the INFLUX account manager. |
| `application.submit.notice` | La marque ne recevra votre candidature qu'après validation par INFLUX. | The brand will only receive your application once INFLUX has approved it. |
| `application.status.sent` | Envoyée le {date} — en cours d'examen par INFLUX. Réponse sous 1 jour ouvré. | Sent on {date} — under review by INFLUX. Reply within 1 business day. |
| `application.status.late` | Votre candidature prend plus de temps que prévu. Un commercial INFLUX la traite. | Your application is taking longer than expected. An INFLUX account manager is handling it. |
| `application.status.forwarded` | Validée par INFLUX et transmise à la marque le {date}. | Approved by INFLUX and forwarded to the brand on {date}. |
| `application.status.rejected` | INFLUX n'a pas transmis cette candidature : {reason} | INFLUX did not forward this application: {reason} |
| `application.status.closed` | Cette candidature est clôturée : {reason} | This application is closed: {reason} |
| `application.errors.contactInText` | Votre texte contient ce qui ressemble à une coordonnée. Retirez-la : elle sera partagée une fois la mise en relation ouverte. | Your text contains what looks like contact details. Please remove them: they will be shared once the introduction is opened. |

**RG114** — Accessibilité : chaque champ porte une étiquette visible ; un champ en erreur pointe vers
son message ; le focus va au premier champ invalide ; les contrastes respectent WCAG AA ; **le vert de
marque n'est jamais le seul porteur d'un état** (les huit états de RG71 portent chacun un libellé
écrit). Toutes les couleurs, tailles et espacements passent par les tokens
(`design-system-influx`).

**RG115** — Le fil et le formulaire sont conçus **mobile d'abord** : les créateurs consultent
majoritairement sur mobile (`CLAUDE.md` §5.2). Une candidature doit pouvoir s'écrire entièrement au
pouce, brouillon compris.

**RG116** — Aucun écran de ce périmètre n'affiche de **montant de contrat**, de **facture**, de **taux
modifiable** ni d'encaissement (**A1**). Les seuls montants sont ceux de RG9.

---

## Cas limites

### Les huit cas limites de la skill `feature-spec`

**1 — Donnée absente ou profil incomplet**

| Situation | Comportement attendu |
|---|---|
| Le profil du créateur est en `brouillon` | Le fil est consultable ; la candidature est refusée côté serveur avec le message nommant la publication du profil (RG23, RG46) |
| Le créateur n'a aucun couple (réseau, format) commun avec la campagne | La candidature est bloquée avec un message nommant les réseaux et formats attendus (RG46-3) |
| La campagne n'annonce aucune rémunération | Elle **n'apparaît pas dans le fil** (RG18) ; l'écart est signalé au document `09` |
| La campagne n'a pas de date limite de candidature | Elle apparaît ; dans le tri par échéance elle passe **après** celles qui en ont une (RG33) |
| La marque n'a pas de logo | La carte affiche une pastille neutre avec l'initiale, jamais un emplacement vide (`06` cas limites) |
| Les chiffres du créateur datent de plus de 90 jours | La candidature reste possible ; le commercial voit la mention « chiffres à rafraîchir » et dispose du motif de refus correspondant (RG92) |
| Le créateur n'a pas de devise déclarée et la campagne non plus | La devise est demandée à la saisie du tarif ; sans devise, l'envoi est refusé (RG54) |

**2 — Valeur nulle, négative ou aberrante**

| Situation | Comportement attendu |
|---|---|
| Tarif proposé à 0 ou négatif | Refus avec message dédié. La gratuité se déclare par la case « contrepartie » (RG47) |
| Tarif proposé de 10 fois la fourchette annoncée | **Accepté**, message factuel de RG56, transmis tel quel au commercial, motif de refus disponible |
| Tarif saisi qui est en réalité le net souhaité | **Non détectable par le système.** La consigne est portée par le libellé (RG55) et le net estimé affiché juste en dessous rend l'erreur visible immédiatement |
| Motivation de 30 caractères, ou de 5 000 | Refus avec message dédié, côté navigateur **et** côté serveur (RG8, RG47) |
| Motivation composée d'espaces | Refus : valeur non vide hors espaces |
| Plafond de campagne saisi à 0 par la marque | La campagne n'accepte aucune candidature : elle s'affiche « candidatures closes » dès sa publication. Écart à instruire au document `09` (borne minimale) |
| Formats proposés vides | Refus : au moins un format (RG47) |
| Date limite de candidature postérieure à la fin de la campagne | Incohérence de campagne, hors de ce périmètre ; le fil affiche la date la plus proche des deux |

**3 — Doublon**

| Situation | Comportement attendu |
|---|---|
| Le créateur candidate deux fois à la même campagne (double clic, deux onglets) | **Une seule candidature**, la seconde soumission est sans effet ; l'index unique partiel de `04` §5.6 le garantit en base |
| Le créateur recandidate après un refus **corrigible** | Autorisé **une seule fois** (P4, RG67) |
| Le créateur recandidate après un refus **non corrigible** | Refusé avec un message qui nomme le motif précédent et propose d'autres campagnes |
| **Une demande de contact de la même marque, sur la même campagne, est déjà en file** | La candidature **ne crée pas de seconde mise en relation** : son contenu est rattaché à l'entrée existante comme élément d'instruction pour le commercial. Le créateur voit l'état normal « envoyée » — **il n'apprend jamais qu'une demande de contact le concerne** (**C(18)**). Écart de modèle à instruire (§Impacts, **Q9**) |
| Deux candidatures du même créateur sur deux campagnes de la même marque | **Autorisées** : une campagne est une affaire distincte |
| Le même brouillon est envoyé depuis deux appareils | Un seul envoi aboutit ; le second affiche « vous avez déjà candidaté le … » (RG66) |

**4 — Action concurrente**

| Situation | Comportement attendu |
|---|---|
| Deux commerciaux ouvrent la même candidature | Un seul la prend en charge ; le second voit « déjà prise en charge par … », jamais une erreur technique (RG91) |
| La campagne est clôturée pendant l'examen d'une candidature | L'examen se poursuit : le commercial peut valider (la marque garde la main) ou clôturer avec le motif de RG77. **Aucune sortie automatique de la file** |
| Le créateur retire sa candidature pendant qu'un commercial la valide | Le retrait prime s'il est enregistré avant la décision ; sinon la décision prime et le créateur voit l'état 4. Les deux événements sont journalisés |
| La marque accepte au moment où le créateur retire | La transition atomique de **C(21)** tranche : si la révélation est posée, elle est définitive (`07` RG19) ; le retrait devient une clôture de conversation (Lot 4) |
| Le plafond de campagne est atteint pendant la rédaction d'un brouillon | À l'envoi, refus avec le message « candidatures closes » ; **le brouillon est conservé** et consultable |
| Le créateur modifie ses tarifs de profil pendant l'examen | Sans effet sur la candidature : le tarif proposé est propre à la candidature (RG49) |
| Une prise en charge est abandonnée sans décision | Elle expire au bout de 30 minutes et l'entrée retourne dans la file (RG91) |

**5 — Droit insuffisant**

| Situation | Comportement attendu |
|---|---|
| Une marque demande la charge utile d'une candidature non validée | Refus **au niveau de la base** : aucune ligne servie, pas même vide (**C(18)**, RG38) |
| Un créateur demande le budget total d'une campagne | Le champ **ne figure pas** dans la réponse (RG11) |
| Un créateur tente de lire la candidature d'un autre créateur | Refus au niveau de la base, journalisé |
| Un créateur tente d'atteindre une campagne non publiée par son identifiant | Refus ; l'identifiant servi est opaque (RG39) |
| Un créateur non vérifié tente de candidater à une campagne réservée | Refus **côté serveur**, journalisé, message de RG86 |
| Un créateur tente d'exporter le fil des campagnes | Refus : mêmes garde-fous que l'annuaire (RG21, **C(17)**) |
| Un agent tente de modifier le texte d'une candidature | Refus : aucun chemin n'existe (RG97) |
| Un agent tente de modifier un plafond | Refus : la modification relève d'`admin`, journalisée (RG69) |

**6 — Service externe indisponible**

| Situation | Comportement attendu |
|---|---|
| Le service d'envoi transactionnel est indisponible à l'envoi d'une candidature | La candidature est **enregistrée et entre en file** ; l'accusé est mis en file d'envoi et réessayé (RG107) |
| Brevo est indisponible au moment du `lead.updated` | Sans effet : la candidature aboutit, la ligne de synchronisation passe en attente et est réessayée (Lot 1) |
| La base est indisponible pendant l'enregistrement automatique du brouillon | Message honnête, saisie conservée dans le navigateur, nouvelle tentative proposée |
| L'e-mail de confirmation de mise en relation échoue définitivement | **Alerte backoffice** : cet e-mail est la preuve externe la moins chère du dispositif, aucun raccourci n'est admis (`01` M2) |
| Le stockage est indisponible à l'affichage d'un visuel de portfolio dans la file | La décision reste possible, le visuel manquant est signalé au commercial, jamais remplacé par une image générique |

**7 — Abandon en cours de parcours**

| Situation | Comportement attendu |
|---|---|
| Le créateur quitte au milieu de sa candidature | Le brouillon est conservé intégralement (RG52) ; aucune relance automatique sans consentement marketing |
| Le brouillon reste sans envoi pendant que la campagne se ferme | Le brouillon est marqué « campagne fermée » et n'est plus envoyable ; il reste lisible jusqu'à sa purge (**Q12**) |
| Le créateur abandonne après un refus | La candidature reste consultable avec son motif ; la recandidature reste ouverte si le motif est corrigible (RG67) |
| La marque ne donne pas suite à une candidature validée | Relance du commercial à J+3, clôture automatique à J+7 avec le message neutre de RG77 (**Q8**) |
| Le créateur se déconnecte pendant l'envoi | Soit la candidature est enregistrée, soit elle ne l'est pas : **aucun état intermédiaire**. Le brouillon subsiste dans le doute |

**8 — Annulation ou retour en arrière après validation**

| Situation | Comportement attendu |
|---|---|
| Le créateur retire une candidature **validée mais non acceptée** par la marque | Autorisé (RG76) : l'entrée passe en `withdrawn`, la marque perd l'accès, **aucun motif ne lui est donné** |
| Le créateur veut annuler après l'ouverture de la mise en relation | Impossible : la révélation est **irréversible** (`07` RG19). Ce qui se clôt, c'est la conversation, avec un motif (Lot 4) |
| Le créateur dépublie son profil après avoir candidaté | Ses candidatures actives sont clôturées (`07` cas limites) ; **les mises en relation ouvertes ne sont pas affectées** |
| La marque dépublie la campagne après ouverture d'une mise en relation | La mise en relation et la conversation subsistent : la commission éventuelle naît de la révélation, pas de la campagne (`01` §4.3) |
| Un commercial se trompe de décision | Il **ne défait pas** un refus : il le journalise, le notifie, et le créateur recandidate si le motif est corrigible. Un refus effacé est un historique falsifié |
| Une candidature est contestée par le créateur | Réexamen par un agent différent du décideur dès que l'équipe compte deux personnes ; sinon réexamen différé et journalisé nominativement |
| Le compte du créateur est supprimé | Les candidatures sont anonymisées avec le compte ; les mises en relation, leurs références et leurs horodatages sont conservés sous forme pseudonyme (`01` M4) |

### La checklist INFLUX de la skill `feature-spec`

| # | Contrôle | Réponse pour ce document |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission INFLUX, net créateur | **Trois montants nommés et distincts** (RG9) : rémunération par créateur annoncée par la campagne, tarif proposé par le créateur, net créateur estimé. Les deux premiers ont la **même assiette : le coût total pour l'annonceur, commission incluse** (RG10). Le net estimé (65 % par défaut, commission 35 % dont 20 % marque et 15 % créateur) est **lu dans le référentiel, jamais calculé dans le code** (RG12, RG57) et **jamais affiché à une marque** (RG59). Devise obligatoire partout, aucune conversion (**D27**), mention « ne vaut pas engagement » (RG19, RG58). Budget total de campagne **jamais servi au créateur** (RG11). Aucun contrat, aucune facture (**A1**) |
| 2 | **Traçabilité / contournement** | **C'est le point le plus sensible du document.** La candidature est **le premier texte libre qu'un créateur adresse à une marque** : elle ne l'atteint **jamais** sans lecture humaine (**A9**, RG2, RG3). Pas de pièce jointe, pas de lien, pas de coordonnée (RG50) ; détection qui **signale sans masquer** et sans copier le texte (RG51, **C(26)**) ; coordonnées de la marque masquées jusqu'à la révélation (**D40**, RG37) ; fil paginé, débité, non exportable (RG21) ; aucune notification n'invite à sortir de la plateforme (RG105). **Risque résiduel assumé et signalé :** un créateur peut écrire un numéro en toutes lettres ou déguisé, et un commercial pressé peut le laisser passer. La parade est le motif de refus dédié, l'alerte de détection dans la file, et la mesure du nombre de candidatures refusées pour ce motif (§Indicateurs) |
| 3 | **Leads** — ce qui part vers Brevo et Apollo, avec quel consentement | `lead.updated` sur le pipeline du Lot 1, **consentement relu à la consommation** (RG109). **Rien du contenu ne part** : ni texte, ni marque, ni campagne, ni montant, ni motif de refus (RG110). Au plus un indicateur d'activité non identifiant, soumis à **Q7** |
| 4 | **Backoffice** — contrepartie interne | Détaillée en §I : file unique aux deux origines avec filtre, entrée décidable sans ouvrir d'autre écran (RG90), verrou et expiration (RG91), **motifs typés propres à la candidature** avec attribut « corrigible » (RG92), attribution au décideur (RG95), interdiction de réécrire un texte (RG97), tableau de bord et délais mesurés (RG98), plafonds modifiables sans déploiement (RG69) |
| 5 | **Matching hybride** | **Aucun algorithme (D11).** La voie algorithmique se limite à un **filtrage déclaratif** sur des listes fermées et un **tri chronologique ou par échéance** (RG5, RG33, RG34). La voie humaine est entièrement spécifiée : lecture, validation, refus motivé, attribution, relance, clôture — **toutes journalisées nominativement** (RG99). Les données du futur moteur sont collectées dès maintenant : filtres utilisés et nombre de résultats (RG32), consultations de fiches (RG22), motifs de refus typés, écart entre tarif proposé et fourchette annoncée |
| 6 | **Deux populations** | Ce document ne traite **que** le créateur qui cherche et qui postule. La marque n'y apparaît qu'en destinataire d'une candidature validée (RG3, RG102). Fil, filtres, formulaire, motifs de refus et notifications sont **distincts** de ceux du document `10` (recherche côté marque) |
| 7 | **Données personnelles** — avis de `expert-conformite-rgpd` | **Obligatoire, avec veto.** Points soumis : texte libre de candidature et détection sans copie (**Q7** et RG51), conservation des candidatures refusées et des brouillons (**Q12**), journal des consultations de campagnes et sa durée (RG22), contenu de l'e-mail de confirmation de mise en relation, acceptation de la marque avant révélation (**Q1**) |

---

## Critères d'acceptation

### Le fil des campagnes

**CA1** — *Étant donné* un compte créateur authentifié dont le profil est en `brouillon`, *quand* il
ouvre le fil, *alors* les campagnes publiées s'affichent et chaque bouton de candidature mène au
message nommant la publication du profil.

**CA2** — *Étant donné* une campagne publiée dont la marque vient d'être suspendue, *quand* le fil est
rechargé, *alors* la campagne n'y figure plus et sa fiche affiche « cette campagne n'est plus
ouverte ».

**CA3** — *Étant donné* une carte de campagne, *quand* on examine son contenu, *alors* elle affiche
exactement les informations de RG15, **et le budget total de la campagne n'y figure pas**.

**CA4** — *Étant donné* la réponse servie au rôle créateur pour une fiche de campagne, *quand* on
inspecte sa **charge utile**, *alors* le budget total, les notes internes et le commercial responsable
**n'y figurent pas, pas même vides**.

**CA5** — *Étant donné* une campagne, *quand* un créateur la consulte, *alors* aucune coordonnée de
l'interlocuteur de la marque n'est servie, et la **fonction** de l'interlocuteur l'est.

**CA6** — *Étant donné* une fourchette de rémunération, *quand* elle s'affiche, *alors* elle porte sa
devise et la mention « coût total pour la marque — ne vaut pas engagement ».

**CA7** — *Étant donné* une campagne libellée en dollars et un créateur travaillant en euros, *quand*
la carte s'affiche, *alors* le montant reste en dollars, **sans conversion et sans taux**.

**CA8** — *Étant donné* un créateur ayant déclaré un secteur refusé, *quand* une campagne de ce
secteur est publiée, *alors* elle **n'apparaît pas dans son fil**, sans message ni emplacement grisé.

**CA9** — *Étant donné* une campagne fermée depuis 3 jours, *quand* le créateur ouvre le fil, *alors*
elle apparaît en grisé sans bouton ; *quand* 8 jours se sont écoulés, *alors* elle a disparu.

**CA10** — *Étant donné* le fil, *quand* on cherche un compteur de candidatures reçues ou de vues,
*alors* **il n'en existe aucun**.

### Filtres et tri

**CA11** — *Étant donné* des filtres pré-remplis depuis le profil, *quand* le créateur ouvre le fil,
*alors* les filtres actifs sont visibles, nommés, et retirables en un clic.

**CA12** — *Étant donné* un filtre de rémunération minimale, *quand* le créateur ne choisit pas de
devise, *alors* le filtre n'est pas applicable et le message le dit.

**CA13** — *Étant donné* un filtre de rémunération minimale en euros, *quand* des campagnes en dollars
existent, *alors* elles sont regroupées à part avec le message de RG28, **jamais converties, jamais
supprimées silencieusement**.

**CA14** — *Étant donné* une combinaison de filtres sans résultat, *quand* la liste s'affiche, *alors*
les critères actifs sont nommés et le retrait du plus restrictif est proposé.

**CA15** — *Étant donné* le tri par défaut, *quand* le fil s'affiche, *alors* les campagnes sont
classées par date de publication décroissante, **et aucun classement de pertinence n'existe**.

**CA16** — *Étant donné* le tri par date limite, *quand* une campagne n'a pas de date limite, *alors*
elle apparaît **après** celles qui en ont une.

**CA17** — *Étant donné* deux campagnes publiées à la même seconde, *quand* on pagine, *alors* l'ordre
reste stable et aucune campagne n'apparaît deux fois ni ne disparaît.

**CA18** — *Étant donné* un compte qui appelle la route du fil au-delà du plafond de pages ou du débit
autorisé, *quand* la requête arrive, *alors* elle est refusée côté serveur et journalisée.

### Candidature — contenu et envoi

**CA19** — *Étant donné* le formulaire de candidature, *quand* on examine ses champs, *alors* aucun ne
redemande les réseaux, l'audience, les langues, le portfolio ni le tarif indicatif du profil.

**CA20** — *Étant donné* une campagne demandant « vidéo TikTok » et un créateur qui ne déclare
qu'Instagram, *quand* il ouvre la candidature, *alors* elle est bloquée avec un message nommant le
réseau attendu.

**CA21** — *Étant donné* le champ « formats proposés », *quand* on l'ouvre, *alors* il ne propose que
l'intersection des livrables de la campagne et des couples (réseau, format) du profil.

**CA22** — *Étant donné* une motivation de 40 caractères, *quand* le créateur envoie, *alors* la
soumission est refusée avec le message indiquant le minimum, **côté navigateur et côté serveur**.

**CA23** — *Étant donné* une motivation contenant `0612345678`, *quand* la candidature est envoyée,
*alors* elle est **enregistrée**, une alerte de détection est visible du commercial, et **seuls le
type de motif et sa position sont stockés — jamais le texte détecté**.

**CA24** — *Étant donné* le formulaire, *quand* on cherche un champ de pièce jointe ou de lien,
*alors* **il n'en existe aucun**.

**CA25** — *Étant donné* un tarif proposé de 0, *quand* le créateur envoie, *alors* la soumission est
refusée avec le message dédié.

**CA26** — *Étant donné* un tarif proposé de 1 500 €, *quand* il est saisi, *alors* le net créateur
estimé s'affiche sous forme de **tranche lue dans le référentiel**, avec la devise et la mention de
RG58, **et aucune multiplication par un taux n'est effectuée dans le code**.

**CA27** — *Étant donné* une campagne annonçant 500 – 1 000 €, *quand* le créateur propose 4 000 €,
*alors* la saisie est acceptée, le message factuel de RG56 s'affiche, et la candidature part en file.

**CA28** — *Étant donné* l'écran récapitulatif, *quand* le créateur le lit avant l'envoi, *alors* il
voit la campagne, ses formats, son tarif, son net estimé et le rappel que la marque ne recevra rien
avant validation par INFLUX.

**CA29** — *Étant donné* une candidature envoyée, *quand* on examine l'objet créé, *alors* c'est une
entrée `introductions` d'origine `creator_application`, avec sa référence `MER-…`, sa campagne, les
pays des deux parties et la version de CGU acceptée par le créateur.

**CA30** — *Étant donné* une candidature en cours de rédaction, *quand* le navigateur est fermé puis
rouvert, *alors* le brouillon est intégralement retrouvé et **ne compte dans aucun plafond**.

### Plafonds

**CA31** — *Étant donné* un créateur ayant 10 candidatures actives, *quand* il tente d'en envoyer une
onzième, *alors* l'envoi est refusé **côté serveur**, le message nomme le plafond, l'atteinte est
journalisée, et aucune offre payante n'est proposée.

**CA32** — *Étant donné* le même créateur, *quand* une de ses candidatures est refusée, *alors* son
compteur passe à 9 et il peut candidater de nouveau.

**CA33** — *Étant donné* un créateur ayant envoyé 5 candidatures dans la journée, *quand* il en envoie
une sixième, *alors* elle est refusée avec un message indiquant quand il pourra recommencer.

**CA34** — *Étant donné* une campagne ayant atteint 30 candidatures actives, *quand* un créateur
l'ouvre, *alors* elle affiche « candidatures closes », **et les candidatures déjà en file continuent
d'être traitées**.

**CA35** — *Étant donné* une candidature refusée pour un motif **corrigible**, *quand* le créateur
recandidate, *alors* c'est possible **une seule fois** ; une troisième tentative est refusée avec un
message explicite.

**CA36** — *Étant donné* une candidature refusée pour un motif **non corrigible**, *quand* le créateur
tente de recandidater, *alors* c'est refusé et le motif précédent est rappelé.

**CA37** — *Étant donné* un administrateur qui porte le plafond de 10 à 15, *quand* il enregistre,
*alors* la valeur avant et après est journalisée nominativement et **aucun déploiement n'est
nécessaire**.

### États, file et refus

**CA38** — *Étant donné* une candidature envoyée, *quand* un commercial la prend en charge, *alors*
**le créateur voit toujours le même libellé** qu'avant la prise en charge.

**CA39** — *Étant donné* une candidature envoyée il y a plus d'un jour ouvré, *quand* le créateur
consulte son état, *alors* le message de RG73 s'affiche, sans excuse automatique ni promesse nouvelle.

**CA40** — *Étant donné* une candidature en file, *quand* un second commercial l'ouvre, *alors* il
voit « déjà prise en charge par … » et ne peut pas décider ; *quand* 30 minutes passent sans décision,
*alors* l'entrée retourne dans la file.

**CA41** — *Étant donné* une candidature validée, *quand* la marque consulte son espace, *alors* elle
voit la candidature complète avec un créateur **anonymisé**, et **aucune identité n'est révélée**.

**CA42** — *Étant donné* une candidature validée, *quand* la marque accepte à l'écran, *alors* la
révélation d'identité, l'ouverture de la conversation à trois, l'événement de journal et les deux
e-mails se produisent **en une seule transaction**, avec **un seul horodatage**.

**CA43** — *Étant donné* une candidature refusée, *quand* le créateur lit la décision, *alors* le
message nomme **INFLUX** comme décideur, porte un motif typé dans sa langue, et **ne mentionne la
marque en aucune façon**.

**CA44** — *Étant donné* une candidature refusée, *quand* la marque consulte son espace, *alors*
**rien n'y apparaît** : ni la candidature, ni son existence, ni un compteur.

**CA45** — *Étant donné* un refus, *quand* il est enregistré, *alors* un motif typé est **obligatoire**
et le commentaire libre seul est impossible.

**CA46** — *Étant donné* une candidature validée que la marque n'a pas acceptée depuis 7 jours,
*quand* l'échéance est atteinte, *alors* la candidature passe en « clôturée sans suite » avec le
message neutre, **sans jamais dire que la marque n'a pas répondu**.

**CA47** — *Étant donné* une candidature validée non acceptée depuis 3 jours, *quand* le commercial
ouvre son tableau de bord, *alors* elle apparaît dans la liste des relances à faire.

**CA48** — *Étant donné* une candidature, *quand* le créateur la retire avant révélation, *alors*
l'état passe à « retirée », une place se libère, l'accès de la marque cesse et aucun motif ne lui est
communiqué.

**CA49** — *Étant donné* une campagne clôturée pendant l'examen, *quand* le commercial ouvre l'entrée,
*alors* elle est toujours dans la file et exige une décision : **aucune sortie silencieuse**.

**CA50** — *Étant donné* une candidature, *quand* un commercial tente de modifier son texte, *alors*
**aucun chemin ne le lui permet**.

**CA51** — *Étant donné* une entrée de file, *quand* le commercial l'ouvre, *alors* il voit la
campagne, la motivation intégrale, les formats, le tarif et sa devise, le profil identifié du créateur
et les alertes de détection **sans ouvrir un autre écran**.

### Restriction « audience vérifiée »

**CA52** — *Étant donné* l'option globale désactivée, *quand* une marque publie une campagne, *alors*
aucune campagne n'affiche la mention « réservée aux profils dont l'audience est vérifiée ».

**CA53** — *Étant donné* l'option activée et une campagne réservée, *quand* un créateur sans badge
« Audience vérifiée » ouvre le fil, *alors* **la campagne est visible**, porte la mention en toutes
lettres, et la candidature mène au message nommant les réseaux concernés et le lien vers la demande de
vérification.

**CA54** — *Étant donné* le même créateur, *quand* il force l'envoi par un autre moyen que l'écran,
*alors* l'envoi est refusé **côté serveur** et la tentative est journalisée.

**CA55** — *Étant donné* un créateur portant « Audience vérifiée » sur Instagram et une campagne
réservée demandant TikTok, *quand* il tente de candidater, *alors* c'est refusé : le badge doit porter
sur **au moins un réseau demandé par la campagne**.

### Notifications, leads, états d'écran

**CA56** — *Étant donné* une candidature envoyée, *quand* l'envoi aboutit, *alors* le créateur reçoit
un accusé à l'écran **et** un e-mail transactionnel dans sa langue, sans aucune coordonnée de la
marque.

**CA57** — *Étant donné* un service d'envoi indisponible, *quand* une candidature est envoyée, *alors*
elle entre en file normalement et l'e-mail est réessayé.

**CA58** — *Étant donné* une mise en relation ouverte, *quand* les e-mails partent, *alors* chacun
porte la référence `MER-…`, la date et l'heure, le nom des deux parties, **le nom du commercial
INFLUX**, la campagne et la version de CGU.

**CA59** — *Étant donné* une marque qui consulte une candidature validée, *quand* elle l'ouvre,
*alors* **aucune notification n'est envoyée au créateur**.

**CA60** — *Étant donné* une candidature, *quand* on inspecte ce qui part vers Brevo et Apollo,
*alors* ni le texte, ni le nom de la marque, ni la campagne, ni le montant, ni le motif de refus n'y
figurent.

**CA61** — *Étant donné* un créateur **sans** consentement marketing, *quand* il candidate, *alors*
aucun contact marketing n'est mis à jour, la ligne est marquée « ignoré — sans consentement », et elle
**n'apparaît pas dans le compteur d'échecs**.

**CA62** — *Étant donné* chacun des messages de RG113, *quand* la langue de l'interface est l'anglais,
*alors* la version anglaise s'affiche, sans aucun texte français résiduel.

**CA63** — *Étant donné* les huit états d'une candidature, *quand* ils s'affichent, *alors* chacun
porte un **libellé écrit**, et la couleur n'est jamais le seul porteur de l'information.

**CA64** — *Étant donné* une erreur serveur à l'envoi, *quand* le message s'affiche, *alors* **toute la
saisie est conservée** et l'envoi peut être retenté.

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Espace | Écran | Remarque |
|---|---|---|
| Membre créateur | Fil des campagnes — liste, cartes, filtres, tri, pagination | Mobile d'abord ; filtres pré-remplis visibles et retirables (RG31) |
| Membre créateur | Fiche complète d'une campagne | Bloc marque **sans coordonnées** (**D40**) ; mention « réservée aux profils vérifiés » |
| Membre créateur | Formulaire de candidature | Rappel en lecture seule du profil (RG48) ; tarif + net estimé côte à côte (RG57) |
| Membre créateur | Écran récapitulatif avant envoi | Dit ce que la marque verra, et quand (RG53) |
| Membre créateur | « Mes candidatures » — les huit états, motifs, compteur de plafond | Les libellés de RG71 sont imposés |
| Membre créateur | Message de blocage par condition non remplie | Un message par condition de RG46 |
| Membre marque | Candidature validée reçue — créateur anonymisé, acceptation à l'écran | Écran d'acceptation à faire valider par un juriste (`01` §4.3) |
| Backoffice | File unique, filtre par origine, fiche de décision | Tout ce qu'il faut pour décider sans ouvrir d'autre écran (RG90) |
| Backoffice | Tableau de bord des délais, relances, plafonds atteints | RG98 |
| Backoffice | Écran de paramétrage des plafonds | Journalisation nominative (RG69) |

### Données (`expert-database`) — écarts constatés avec `docs/mvp/04-modele-de-donnees-mvp.md`

Tables utilisées telles quelles : `matching.introductions`, `matching.application_details`,
`matching.application_formats`, `matching.rejection_reasons`, `campaigns.campaigns`,
`campaigns.campaign_deliverables`, `search.search_queries`, `audit.audit_events`, `reference.*`.

**Sept écarts à instruire :**

1. **La « nature de la rémunération » n'existe pas** sur `campaigns.campaigns` (monétaire ·
   contrepartie · les deux). Elle est nécessaire au fil (RG15) et au filtre C6. **À réconcilier avec
   le document `09`.**
2. **Aucun compteur de candidatures reçues** n'existe en face de `max_applications` : le plafond P3
   suppose un décompte des `introductions` d'origine `creator_application` aux statuts actifs, et une
   **fermeture atomique** quand il est atteint.
3. **Les motifs de refus n'ont pas d'attribut « corrigible »** (`matching.rejection_reasons`), exigé
   par RG67 et RG92.
4. **L'état `expired` n'a pas de sous-motif** : les cinq causes de RG77 doivent être distinguables,
   sinon le tableau de bord confond une campagne fermée et une marque silencieuse.
5. **Le brouillon de candidature n'a pas de place** dans le modèle : soit une table dédiée, soit une
   conservation côté navigateur. Choix à faire (voir **Q12**).
6. **Collision avec l'index unique partiel** `introductions_active_pair_idx` lorsqu'une demande de
   contact de la même marque, sur la même campagne, existe déjà. `application_details` est une
   extension 1-1 réservée à `origin = creator_application` : il n'existe aujourd'hui **aucun endroit
   où stocker le contenu d'une candidature rattachée à une entrée d'une autre origine** (voir **Q9**).
7. **La contrainte `introductions_reveal_requires_both_acceptances` est inconditionnelle**, alors que
   **C(21)** ne mentionne la double acceptation que « quand l'origine l'exige ». Ce document applique
   la contrainte (RG75) ; la formulation de `03` doit être alignée (voir **Q1**).

À prévoir également : tous les plafonds, délais et l'interrupteur de l'option « réservée aux profils
vérifiés » vivent **en table**, modifiables sans redéploiement, chaque modification journalisée.

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Brevo — transactionnel** | Accusé d'envoi, validation, ouverture de mise en relation (e-mail de preuve M2), refus motivé, clôture — bilingues, réessayés, échecs visibles au backoffice |
| **Brevo — contacts** | Au plus un indicateur d'activité non identifiant, sous consentement (**Q7**) |
| **Apollo.io** | **Aucun attribut supplémentaire.** Le périmètre du Lot 1 (**D33**) est inchangé |
| **Supabase** | Journal des filtres et des consultations ; index unique partiel ; verrou de file par transition conditionnelle |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| Candidatures envoyées par campagne publiée | Mesuré ; **zéro candidature sur une campagne** est une alerte de catalogue |
| Part des campagnes sans aucune candidature | Suivi hebdomadaire ; oriente **D38** |
| **Délai de traitement d'une candidature** (médian et 9e cas sur 10) | **Cible 1 jour ouvré** (**D39**) ; alerte au-delà |
| Taux de validation des candidatures | Mesuré ; un taux très bas signale un fil mal filtré ou des créateurs mal informés |
| Répartition des refus par motif | Suivi ; « Autre » sous **10 %** (RG93) |
| **Candidatures refusées pour coordonnée directe** | **Indicateur de contournement de premier rang** |
| Candidatures validées non acceptées par la marque sous 7 jours | Mesuré ; c'est la mesure de la réactivité des marques |
| Taux d'acceptation par la marque après validation | Mesuré ; qualité du filtrage commercial |
| Plafonds atteints (P1, P2, P3) par semaine | Mesuré ; dit s'il faut ouvrir ou resserrer |
| Tentatives de candidature bloquées par « audience vérifiée » | Mesuré ; dit si la restriction motive ou stérilise (**D38**) |
| Écart entre tarif proposé et fourchette annoncée | Collecté ; **donnée d'apprentissage pour D11** |
| Brouillons jamais envoyés | Mesuré ; un taux élevé signale un formulaire trop lourd |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| Classement des campagnes par pertinence | **D11** : aucune donnée pour régler des pondérations | Après le pilote |
| Alertes ou résumés de nouvelles campagnes | Base légale et segmentation à instruire (**Q11**) | Après le MVP, via Brevo |
| Candidature « spontanée » hors campagne | La campagne est obligatoire (`04` §5.6) ; une candidature sans objet n'est pas traitable | Non planifié |
| Pièces jointes, liens, médias dans une candidature | Vecteur de contournement évident | Non planifié |
| Négociation du prix avant la mise en relation | Le prix se discute dans la conversation, où le commercial est présent | Jamais sous cette forme |
| Campagne anonyme (identité de marque masquée) | **D40** ne couvre que les coordonnées, pas l'identité (RG17, **Q2**) | Arbitrage fondateur |
| Compteur de candidatures ou de vues affiché au créateur | Effet de meute, information commerciale (**Q6**) | Après le pilote |
| Sauvegarde de campagnes en favoris, alertes de mots-clés | Confort, sans effet mesuré sur la conversion | Après le pilote |
| Candidature groupée à plusieurs campagnes | Contraire au motif écrit obligatoire (**A9**) | Jamais |
| Réponse directe de la marque au créateur avant validation | **A9** : rien ne circule sans l'accord d'un commercial | Jamais |
| Contrat, signature, paiement, calcul de commission | **A1**, `CLAUDE.md` §3 | V2, avec D9 et D25 |
| Portugais et autres langues | Français et anglais au lancement | Avant l'ouverture du Brésil |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **La marque doit-elle accepter à l'écran avant la révélation, pour une candidature ?** La contrainte de base `introductions_reveal_requires_both_acceptances` l'exige sans condition ; **C(21)** de `03` ne l'exige que « quand l'origine l'exige » | **Oui, acceptation de la marque obligatoire** (RG74, RG75) : c'est le comportement le plus protecteur pour le créateur et le seul compatible avec la contrainte de base. Formulation de `03` à aligner | `chef-de-projet` + `expert-database` + `expert-conformite-rgpd` | **Avant le Lot 4** |
| **Q2** | **Une marque peut-elle demander l'anonymat de son identité pendant la phase de sélection ?** Ce n'est **pas** la symétrie de **D40**, qui ne masque que les coordonnées | **Non au MVP** : identité de marque toujours affichée (RG17). Un brief anonyme réduit fortement le taux de candidature | **Fondateur** + `chef-de-projet` (rattaché à **D40**) | Lot 3 |
| **Q3** | **Valeurs de départ des plafonds** : 10 candidatures actives, 5 par jour, 30 par campagne, 2 par campagne au total | Valeurs ci-contre, **en table** (`04` Q4) | `chef-de-projet` + Fondateur | Lot 3 |
| **Q4** | **Le tarif proposé exact est-il transmis à la marque ?** `07` RG103 interdit de révéler le tarif exact **du profil**, même après révélation | **Oui pour le tarif de candidature** (RG60) : c'est une offre délibérée pour cette campagne, et une candidature sans prix est inexploitable. Le tarif **du profil** reste en tranche | Fondateur + `expert-paiement-facturation` + `product-owner` | **Avant le Lot 4** |
| **Q5** | **Net créateur estimé sur un montant exact** : la tranche du référentiel qui contient le montant saisi suffit-elle, ou faut-il une estimation au montant près (donc une multiplication) ? | **Tranche du référentiel** (RG57) : préserve l'interdiction structurelle `03` C(32) et le contrôle T16 | `expert-paiement-facturation` + `architecte` | Lot 3 |
| **Q6** | **Faut-il afficher au créateur le nombre de candidatures déjà reçues par une campagne ?** | **Non** (RG25) : effet de meute et information commerciale de la marque | `chef-de-projet` + `expert-ux` | Lot 3 |
| **Q7** | **Que part-il vers Brevo à la suite d'une candidature ?** | Au plus un **indicateur d'activité non identifiant** (« a candidaté au moins une fois », date), jamais de contenu (RG110) | `expert-conformite-rgpd` (**veto**) + `expert-marketing` | Lot 3 |
| **Q8** | **Délai laissé à la marque pour accepter une candidature validée**, avant clôture sans suite | **7 jours calendaires**, relance du commercial à J+3, **paramètre en table** (RG78) | Fondateur + `chef-de-projet` (rattaché à **D39**) | Lot 4 |
| **Q9** | **Que faire d'une candidature qui vise un couple (marque, créateur, campagne) déjà couvert par une demande de contact en file ?** L'index unique partiel l'interdit en base | **Rattachement du contenu à l'entrée existante** comme élément d'instruction, état normal côté créateur pour préserver **C(18)**. Emplacement de stockage à créer | `expert-database` + `product-owner` | **Avant le Lot 4** |
| **Q10** | **Filtre de rémunération minimale en multi-devises**, sans conversion (**D27**) | Regroupement à part, aucune conversion, message explicite (RG28) | `expert-paiement-facturation` + `chef-de-projet` | Lot 3 |
| **Q11** | **Alertes ou résumés de nouvelles campagnes** envoyés aux créateurs | **Hors périmètre du MVP** (RG108) | `expert-marketing` + `chef-de-projet` | Après le MVP |
| **Q12** | **Durée de conservation** des brouillons de candidature, des candidatures refusées et du journal de consultation des campagnes | Conservation le temps de l'usage produit, purge à échéance écrite ; le registre d'audit n'est jamais purgé (`01` M4) | `expert-conformite-rgpd` (**veto**) | Lot 3 |
| **Q13** | **La « nature de la rémunération » est-elle un champ de campagne ?** Elle n'existe pas au modèle de données | **Oui, obligatoire pour publier** (RG15, RG18) — **à réconcilier avec le document `09`** | `chef-de-projet` (arbitrage entre `09` et `11`) | Lot 3 |
| **Q14** | **La motivation peut-elle être rendue facultative par une campagne ?** | **Tranchée (`chef-de-projet`, 2026-09-19) : non.** Le formulaire de candidature est unique et fixe (RG47) ; la motivation reste **toujours obligatoire**, seule garantie que A9 s'applique identiquement à toute campagne. La liste « éléments demandés » de `09` RG76-77 devient une **mise en avant informative** affichée au créateur au-dessus du formulaire, sans effet sur ses champs | `chef-de-projet` | **Fermée** |
