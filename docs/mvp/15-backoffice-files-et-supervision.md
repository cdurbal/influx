# Lot 5 — Le backoffice : tableau de bord, catalogue des files, fiches de compte, supervision

> **Date :** 2026-09-19 · **Auteur :** `product-owner`, avec `expert-ux` en appui sur la densité et
> l'accessibilité.
> **Skills appliquées :** `backoffice-ops` (mode opératoire), `feature-spec` (format de sortie),
> `intermediation-tracking` et `messaging-spec` (par renvoi), `design-system-influx` (par renvoi).
> **Lot :** 5 — *Backoffice complet, pipeline commercial et e-mails* (`00-cadrage-mvp-v2.md` §7).
>
> **Ce que ce document tranche :** le tableau de bord de chaque rôle interne, le **catalogue unique
> des files** du backoffice et les règles communes à toutes, la **fiche de compte**, la
> **suspension / réactivation / réattribution**, le **catalogue central des alertes**, le traitement
> des **demandes relatives aux données personnelles**, les **actions de masse**, les **exports**, la
> **gestion des comptes internes**, la liste testable de ce qu'un rôle interne **ne peut jamais
> faire**, et la **densité et l'accessibilité** d'un outil professionnel.
>
> **Ce qu'il ne tranche pas, et ne redit pas :** les règles propres à chaque file, qui appartiennent
> aux documents qui les ont spécifiées (`05` à `13`) ; la mécanique de la mise en relation (`13`) ;
> la conversation à trois (`12`) ; le badge (`08`) ; le **pipeline commercial et la saisie des
> montants** (`01` §6, puis le document dédié du Lot 5) ; l'**envoi d'e-mails Brevo depuis le
> backoffice** (A4, **D35**, document attendu de `expert-marketing`) ; les droits, la RLS et les
> fonctions élevées (`03`) ; le modèle de données (`04`) ; le plan de test (`18`).
>
> **Source de vérité :** `CLAUDE.md`. En cas d'écart, `CLAUDE.md` prime et c'est ce document qui est
> corrigé. Ce document **ne modifie aucun autre fichier** : les écarts constatés dans `04` sont
> signalés en §Impacts, à l'attention d'`expert-database`.

---

## Besoin

**Donner à l'équipe INFLUX un poste de travail unique — un seul endroit où l'on voit ce qu'il y a à
faire, où on le fait, et où l'on sait ce que ça a rapporté — sans jamais qu'une action soit anonyme,
sans motif, ou invisible.**

Trois raisons de le traiter comme un produit et non comme un écran d'administration :

1. **Le plafond de croissance d'INFLUX est humain, pas technique** (`00` §10.1, R1). Chaque mise en
   relation mobilise un commercial. **Chaque clic économisé ici est de la capacité commerciale
   gagnée** ; un écran interne mal conçu coûte directement du chiffre d'affaires.
2. **Le backoffice voit tout** : toutes les identités, toutes les conversations, toutes les affaires
   (`03` §1.1). C'est la surface la plus sensible du produit, et la plus exposée au risque le plus
   grave — **l'aspiration de l'annuaire par l'intérieur**.
3. **Il est déjà éparpillé.** Onze documents de spécification ont chacun créé sa file, son tableau de
   bord et ses alertes. Sans un document qui les fédère, personne ne peut répondre à la question
   « combien de files avons-nous, et laquelle n'a pas de SLA ? ». **C'est la raison d'être première
   de ce document : vérifier qu'aucune file n'est orpheline.**

---

## Acteurs

| Acteur | Ce qu'il fait ici |
|---|---|
| **Commercial INFLUX** (rôle `agent`) | Son poste de travail. Il consulte son tableau de bord, prend en charge des entrées de file, décide avec motif, consulte des fiches de compte, annote, suspend, réattribue, traite ses alertes, instruit les demandes relatives aux données personnelles |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, **plus** : gestion des comptes internes et des rôles, plafonds, levée de suspension, levée de verrou orphelin, exécution des exports et des anonymisations, seconde validation des actions irréversibles, revue hebdomadaire des contrôles |
| **Système** (worker) | Calcule les échéances, expire les verrous, lève et referme les alertes d'état, exécute les purges, envoie les récapitulatifs, vérifie la chaîne du registre |
| **Marque** et **créateur** (rôles `advertiser`, `creator`) | **Ne voient rien de ce document.** Ils en subissent les effets : une suspension, une décision motivée, une réponse à une demande de données. Chaque effet visible pour eux est spécifié ici avec son message |
| **Fondateur** | Destinataire de trois alertes qui ne s'adressent qu'à lui : connexion au compte de secours, rupture de la chaîne du registre, revue hebdomadaire des actions passées en contrôle affaibli |

> **Deux populations, deux fiches.** Une fiche de compte marque et une fiche de compte créateur ne
> partagent ni les mêmes blocs, ni le même vocabulaire, ni les mêmes actions. **Elles ne sont jamais
> fusionnées dans un écran unique** (`CLAUDE.md` §5.2, **D41** : un rôle par compte au MVP).

---

## User stories

### Commercial (`agent`)

- **US1** — En tant que **commercial**, je veux voir en une page ce que je dois traiter aujourd'hui,
  afin de commencer ma journée sans ouvrir six écrans.
- **US2** — En tant que **commercial**, je veux voir, file par file, le volume en attente et
  l'ancienneté de la plus ancienne entrée, afin de savoir où je suis en retard avant qu'un
  utilisateur me le dise.
- **US3** — En tant que **commercial**, je veux cliquer sur n'importe quel chiffre du tableau de bord
  et tomber exactement sur la liste qu'il compte, afin de ne jamais avoir à reconstruire un filtre
  à la main.
- **US4** — En tant que **commercial**, je veux ouvrir la fiche d'un compte et y trouver son
  historique complet — profil, campagnes, mises en relation, affaires, notes — afin de savoir à qui
  je parle avant de décrocher le téléphone.
- **US5** — En tant que **commercial**, je veux écrire une note interne sur un compte, afin que mon
  collègue qui reprend le dossier sache ce que je sais.
- **US6** — En tant que **commercial**, je veux suspendre un compte avec un motif typé, afin
  d'arrêter un abus sans avoir à improviser une explication.
- **US7** — En tant que **commercial**, je veux voir la commission convenue et la commission encaissée
  de ma semaine, dans chaque devise, afin de savoir ce que mon travail a produit.
- **US8** — En tant que **commercial**, je veux une liste d'alertes actionnables, afin de ne pas
  passer à côté d'une affaire qui s'éteint.
- **US9** — En tant que **commercial**, je veux tout faire au clavier, afin de traiter cent décisions
  dans une journée et pas dix.

### Administrateur (`admin`)

- **US10** — En tant qu'**administrateur**, je veux créer, désactiver et réattribuer les comptes
  internes, afin qu'un départ ou une arrivée ne laisse jamais de dossier sans responsable.
- **US11** — En tant qu'**administrateur**, je veux voir chaque semaine la liste des actions passées
  en contrôle affaibli, afin que l'absence de contrôle par les pairs soit au moins regardée.
- **US12** — En tant qu'**administrateur**, je veux modifier un délai, un seuil ou un plafond sans
  déploiement, afin de régler l'outil sur ce que l'exploitation m'apprend.
- **US13** — En tant qu'**administrateur**, je veux exécuter une demande d'accès ou d'effacement et
  prouver qu'elle a été traitée dans le délai, afin qu'une obligation légale ne dépende pas d'une
  mémoire.
- **US14** — En tant qu'**administrateur**, je veux savoir qui a lu quelle conversation, afin que la
  supervision annoncée aux membres soit vérifiable.

### Système

- **US15** — En tant que **système**, je veux lever et refermer seul les alertes d'état, afin qu'un
  agent ne perde pas son temps à classer une alerte dont la cause a disparu.
- **US16** — En tant que **système**, je veux faire expirer une demande de seconde validation restée
  sans réponse, afin qu'une action irréversible ne reste jamais armée indéfiniment.

---

## Règles de gestion

### A — Portée, principes et vocabulaire

**RG1** — **Toute action d'un rôle interne est attribuée à une personne nommée et rattachée à un
motif exploitable** (`backoffice-ops`, principe directeur). Corollaire appliqué à la conception : une
action qui ne peut être ni attribuée ni motivée **ne doit pas exister sous cette forme**.

**RG2** — **Le backoffice est une surface privilégiée** (**D12**, `03` §7) : hôte distinct,
`X-Robots-Tag: noindex` sur **toutes** les réponses, **second facteur TOTP obligatoire**, session de
8 h avec 30 min d'inactivité, **inscription impossible**, autorisation vérifiée **côté serveur** pour
chaque action. Le masquage d'interface n'est **jamais** un contrôle d'accès.

**RG3** — **Ce document ne redéfinit aucune file déjà spécifiée.** Il les **fédère** : il fixe ce qui
leur est commun (§C), et pour tout le reste il **renvoie** au document qui fait autorité. Toute règle
de ce document qui contredirait `05` à `13` est une erreur de ce document, à corriger ici.

**RG4** — **Aucun taux, aucun calcul de commission, nulle part** (**A1**, `CLAUDE.md` §3, `03`
C(32)). Le backoffice **additionne et soustrait** des montants saisis par un commercial ; il ne les
déduit jamais d'un pourcentage. **Aucun écran de ce document n'affiche un net créateur** : il n'est
calculé nulle part au MVP.

**RG5** — **Trois notions de montant, trois libellés imposés**, jamais interchangeables sur un
écran :

| Notion | Libellé imposé | Origine |
|---|---|---|
| Le coût total pour l'annonceur | **« Montant négocié »** | `billing.deals.negotiated_amount`, saisi par le commercial (`01` §6.2) |
| Ce qui revient à INFLUX | **« Commission convenue »** | `agreed_commission_amount`, saisi par le commercial |
| Ce qu'INFLUX a effectivement reçu | **« Commission encaissée »** | `commission_received_amount`, saisi par le commercial |

**Chaque montant est toujours affiché avec sa devise.** Aucun total toutes devises confondues,
aucune conversion, aucun taux de change : un agrégat est **toujours par devise** (**D27** non
tranchée).

**RG6** — **Le registre d'audit est en ajout seul** (`04` §4.3, `03` P8). Aucun rôle interne, y
compris `admin`, ne peut modifier ou supprimer une ligne. **Une action passée par erreur se corrige,
elle ne s'efface pas** : l'action erronée reste au journal, la correction s'y ajoute avec son motif.

**RG7** — **Toute décision porte un motif choisi dans une liste fermée.** Le texte libre est autorisé
**en complément**, jamais seul (`backoffice-ops`, règle 10). Chaque motif défavorable porte **le
message envoyé à l'utilisateur** : il n'existe aucune décision muette.

**RG8** — **Le motif « autre » est exceptionnel et surveillé, dans toutes les listes de ce
document** : au-delà de **10 % des décisions d'une liste sur un mois glissant**, la liste est
incomplète et doit être étendue (alerte **AL38**).

**RG9** — **Tant qu'une seule personne cumule `agent` et `admin`, la double validation est remplacée
par la procédure dégradée de `03` §1.3** (PD1 à PD7) : récapitulatif intégral, confirmation différée
d'au moins 60 secondes sur un écran distinct, re-authentification TOTP fraîche, traçage à deux
horodatages, marquage `dual_control: 'degraded_single_operator'`, revue hebdomadaire, **bascule
automatique** dès qu'un second `admin` actif existe. **C'est un contrôle affaibli, et l'écran le dit
en toutes lettres** : il protège contre l'erreur et la précipitation, pas contre la malveillance.

**RG10** — **Au MVP, tous les commerciaux voient tout**, mais **chaque compte, chaque mise en
relation et chaque affaire porte un commercial responsable dès le premier jour**
(`backoffice-ops`, règle 17 ; `00` §4.2, point 6). Ce n'est pas une contradiction : c'est la
préparation du portefeuille cloisonné, qui ne sera alors **qu'un changement de règle d'accès**.

**RG11** — **La langue du backoffice reste ouverte (D36).** Le **français est la valeur d'attente** ;
**aucun libellé n'est écrit en dur**, tous passent par les fichiers de traduction, y compris les
motifs typés, les libellés de file et les intitulés d'alerte.

**RG12** — **Toute date affichée porte son fuseau horaire.** Le fuseau d'affichage est un réglage du
compte interne ; il n'a **aucun effet** sur les horodatages enregistrés, toujours en temps universel.

**RG13** — **Aucun contenu écrit par un membre n'est jamais rendu en HTML dans le backoffice**
(`03` BO-4, constat bloquant B10). Les briefs, messages, motifs et noms sont affichés en texte brut.
C'est le scénario d'attaque le plus rentable contre INFLUX : un script écrit par un membre,
exécuté avec la session d'un agent qui voit toutes les identités du produit.

---

### B — Le tableau de bord

**RG14** — Il existe **deux tableaux de bord et deux seulement** : celui du rôle `agent` et celui du
rôle `admin`. Le second **contient le premier** et y ajoute trois blocs de supervision. Il n'existe
pas de tableau de bord « par équipe », ni personnalisable au MVP.

**RG15 — La règle qui conditionne toutes les autres : *tout chiffre du tableau de bord est
cliquable et mène à la liste exacte qu'il compte*.** Un compteur qui n'ouvre rien oblige l'agent à
reconstruire un filtre à la main ; il sera ignoré en trois jours. Un chiffre non cliquable est un
défaut bloquant.

**RG16** — **Le tableau de bord est en lecture seule.** Aucune action — validation, suspension,
envoi, rejeu — n'est déclenchable depuis lui. Il oriente, il n'exécute pas. Cela évite l'erreur la
plus banale d'un outil dense : cliquer une action en croyant ouvrir une liste.

**RG17** — Les valeurs sont **calculées au chargement** et portent la mention **« arrêté à
{heure} »**. Pas de rafraîchissement automatique, **aucune animation**, aucun compteur qui défile.
Un bouton « actualiser » existe et est atteignable au clavier.

**RG18** — **Les blocs du tableau de bord `agent`, dans cet ordre imposé** — l'ordre est une décision
produit, pas une préférence de mise en page : il va du plus urgent au plus informatif.

| # | Bloc | Contenu | Ce qui alerte |
|---|---|---|---|
| **1** | **À traiter maintenant** | Les entrées dont **je** tiens le verrou ; mes tâches datées (relance J+6 d'une mise en relation, appel après refus `pre_existing_relationship`) ; mes alertes ouvertes non classées | Toute ligne **hors délai**, en tête, avec libellé écrit |
| **2** | **Les files** | **Une ligne par file du catalogue §C** : volume en attente, **ancienneté de la plus ancienne entrée**, nombre hors délai, nombre sans preneur au-delà de l'objectif interne, nombre pris en charge par un collègue | File hors délai, file dont l'ancienneté dépasse **deux fois** son délai, file sans aucune entrée nouvelle depuis 24 h ouvrées |
| **3** | **Mes affaires** | Affaires dont je suis responsable, **par état** (`01` §6.1), avec montant négocié et devise ; affaires silencieuses ; mises en relation révélées **sans état d'affaire** depuis 30 jours | Silence de 14 jours, absence d'état d'affaire à 30 jours |
| **4** | **Ma semaine** | **Commission convenue** et **commission encaissée** de la semaine en cours, **par devise**, et leur écart ; rappel des quatre semaines précédentes | Écart convenue / encaissée qui grandit d'une semaine sur l'autre |
| **5** | **Mon activité** | **Mises en relation traitées cette semaine**, propositions INFLUX envoyées et leur taux d'acceptation, délai médian de mes décisions | Aucun seuil : c'est une mesure, pas une notation |

**RG19** — **Le bloc 4 n'exécute aucune arithmétique interdite.** « Commission convenue » est la
**somme** des `agreed_commission_amount` des affaires `signed` et `commission_invoiced` ;
« commission encaissée » la **somme** des `commission_received_amount` dont la date tombe dans la
période ; l'« écart » leur **soustraction**. Par devise, sans total global, sans pourcentage, sans
taux. Le **montant négocié** figure dans un bloc distinct : les trois notions ne se mélangent jamais
dans une même colonne (RG5).

**RG20** — **L'indicateur « mises en relation traitées par commercial et par semaine » est le
premier à instrumenter** après le délai de file (`backoffice-ops`, règle 20 ; `13` RG108). C'est lui
qui dira si la plateforme fait passer le métier à l'échelle, ou si elle se contente de le déplacer
sur un écran.

**RG21** — **Les trois blocs supplémentaires du tableau de bord `admin`** :

| # | Bloc | Contenu | Ce qui alerte |
|---|---|---|---|
| **6** | **Santé de l'exploitation** | Toutes les files, tous agents confondus ; **délai médian et délai du 9ᵉ cas sur 10** pour la prise en charge **et** pour la décision, par file ; part des décisions hors délai ; escalades ouvertes ; répartition des refus par motif et **part du motif « autre »** | Dépassement d'un délai, motif « autre » > 10 % |
| **7** | **Leads et envois** | État de synchronisation Brevo / Apollo : **échecs à traiter** et **cas normaux distingués**, jamais additionnés (`05` RG100) ; part synchronisée dans les objectifs ; envois d'e-mails de la semaine par source et leur base légale | Échec non traité, panne durable, clé d'accès refusée, quota dépassé |
| **8** | **Contrôles** | **Actions confirmées en mode dégradé de la semaine** (PD6) ; classement des agents par **nombre de conversations distinctes lues** sur 7 jours, dont non participants (`03` X4) ; connexions au **compte de secours** ; **demandes relatives aux données personnelles** en cours et échéance la plus proche ; dernier résultat de **vérification de la chaîne** du registre | Toute connexion au compte de secours, toute rupture de chaîne, toute demande de données à moins de 7 jours de son échéance |

**RG22** — **Le bloc 8 est lu, ou il ne sert à rien.** Il est présenté **en tête** du tableau de bord
`admin` chaque **lundi** ; l'ouverture de la revue hebdomadaire est journalisée. Un contrôle
décoratif est pire qu'une absence de contrôle, parce qu'il rassure à tort (`03` §1.3).

**RG23** — **La lecture du classement des agents par lectures de conversations est elle-même
journalisée** (`03` C(38)). Sinon le contrôleur échappe au contrôle.

**RG24** — **États vides utiles, jamais une page blanche** (`backoffice-ops`, règle 35). Chaque bloc
distingue **deux états** : « rien à traiter » — avec un repère (« dernière entrée traitée il y a
12 min ») — et « rien ne remonte », qui est un **incident technique** et le dit.

**RG25** — Le tableau de bord ne montre **jamais** : le contenu d'un message, un extrait de
conversation, un code de connexion, un mot de passe, une donnée enrichie par Apollo, une note interne
(elle vit sur la fiche), ni le motif d'une suspension (il vit sur la fiche et n'est jamais divulgué à
un tiers).

---

### C — Le catalogue unique des files

> **C'est la section pour laquelle ce document existe.** Onze documents ont créé des files. Aucun ne
> savait combien il y en avait au total. Une file absente de ce tableau est une file **orpheline** :
> personne n'en mesure le délai, personne ne sait qui doit la traiter, et elle s'allonge sans que
> quiconque le voie.

**RG26** — **Toute file du backoffice figure dans le tableau de RG29, porte un `queue_code` et une
ligne dans `backoffice.sla_policies`.** Une file qui n'y figure pas **n'existe pas** : elle ne doit
pas être créée, et un contrôle automatisé le vérifie (§Impacts, test attendu du document `18`). C'est
la transposition de la règle de lecture n° 1 de `03` §2, qui a déjà sauvé la matrice des droits.

**RG27 — Les huit règles communes à toutes les files**, sans exception ni dérogation :

| # | Règle commune | Détail |
|---|---|---|
| **C1** | **Ouvrir une entrée libre la prend en charge** | Demander un clic « prendre en charge » avant de pouvoir lire est une friction pure (`13` RG27). L'écran indique « vous avez pris cette entrée en charge à 09 h 42 » |
| **C2** | **Verrou nominatif, exclusif, visible** | Le second agent voit « En cours — Marie depuis 09 h 42 », peut lire **en lecture seule**, et **ne peut pas décider**. Jamais un écran d'erreur, jamais un doublon |
| **C3** | **Le verrou expire seul après 30 minutes** sans décision | Paramètre en table. L'abandon est journalisé avec son titulaire et sa durée. Un agent peut **relâcher explicitement** son verrou (« je rends la main »), commentaire libre facultatif |
| **C4** | **Un administrateur peut lever un verrou orphelin** avant son expiration | Motif typé, trace, **le titulaire dépossédé en est informé** (`03` C(20), `13` RG31) |
| **C5** | **Tri par défaut : échéance de traitement croissante**, départage par date de création | Les entrées **hors délai sont en tête** et visuellement distinctes, **avec un libellé écrit** — la couleur n'est jamais seule porteuse (`backoffice-ops`, règle 37) |
| **C6** | **Deux issues, jamais trois** | Favorable, ou défavorable **avec motif typé**. Aucune « mise de côté », aucune « attente de correction », aucun « transmettre pour avis » |
| **C7** | **Aucune sortie silencieuse** | Une entrée ne quitte jamais une file sans décision. Les seules sorties sont celles écrites par le document qui spécifie la file |
| **C8** | **Le dépassement du délai n'expire jamais une entrée** | Une décision tardive reste possible et est **marquée comme telle**. On ne bloque jamais une décision tardive (`13` RG26) |

**RG28** — **Les compteurs permanents de chaque file** — volume en attente et **ancienneté de la plus
ancienne entrée** — sont affichés en tête de file **et** au tableau de bord, en permanence, jamais
dans un rapport mensuel (`backoffice-ops`, règle 9). Une file qui s'allonge est une conversion qui
s'effondre.

**RG29 — Le catalogue.** Colonne « Spécifiée par » : le document qui fait autorité sur le contenu,
les motifs et les messages ; ce document-ci ne fait autorité que sur les colonnes « Délai »,
« Objectif de prise en charge », « Verrou », « Qui traite » et « Action de masse ».

| # | `queue_code` | File | Ce qui y entre | Spécifiée par | Délai de décision | Objectif interne de prise en charge | Verrou | Qui traite | Action de masse |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `profiles_advertiser` | **Profils marque à valider** | Soumission ou modification d'un profil marque | `06` RG63–RG72 | **1 j ouvré** | 4 h ouvrées | 30 min | `agent`, `admin` | Non |
| 2 | `profiles_creator` | **Profils créateur à valider** | Soumission ou modification d'un profil créateur | `07` RG92–RG100 | **1 j ouvré** | 4 h ouvrées | 30 min | `agent`, `admin` | Non |
| 3 | `portfolio_moderation` | **Visuels de portfolio à modérer** | Dépôt d'un visuel | `07` RG92, RG97 ; `03` C(16) | **1 j ouvré** | 4 h ouvrées | 30 min | `agent`, `admin` | **Oui** — visuels d'**un même profil**, plafond 20 (RG96) |
| 4 | `verification` | **Demandes de vérification et de badge** — deux vues : créateurs, marques | Demande de badge, redépôt après péremption | `08` RG61–RG68 | **1 j ouvré** | 4 h ouvrées | 30 min | `agent`, `admin` | Non |
| 5 | `verification_disputes` | **Contestations de badge** | Contestation d'un refus ou d'un retrait, sous 30 j | `08` RG77 | **5 j ouvrés** *(proposition, Q2)* | 1 j ouvré | 30 min | `agent` **différent du décideur**, sinon `admin` | Non |
| 6 | `identity_change_review` | **Identifiants modifiés à contrôler** | Déclaration d'un changement de pseudo après vérification | `08` RG78 | **1 j ouvré** | 4 h ouvrées | 30 min | `agent`, `admin` | Non |
| 7 | `campaigns` | **Campagnes à valider** | Soumission d'une campagne | `09` RG87–RG97 | **1 j ouvré**, **2 j** en revue renforcée | 4 h ouvrées | 30 min | `agent`, `admin` ; **revue renforcée : deux personnes** (`09` RG85) | Non |
| 8 | `introductions` | **Demandes de contact et candidatures** — file unique, filtre par origine | Déclencheurs 1 et 2 (`10`, `11`). La **proposition INFLUX ne passe pas par la file** | `13` §B à §D, `11` §I | **1 j ouvré** (**D39**) | **4 h ouvrées** (`13` RG17) | 30 min | `agent`, `admin` | **Interdite** (`13` RG50) |
| 9 | `team_selection` | **Demandes « sélection par l'équipe INFLUX »** | Bouton de la recherche anonymisée | `10` RG61, RG84 | **1 j ouvré** *(proposition, Q3)* | 4 h ouvrées | 30 min | `agent`, `admin` | Non |
| 10 | `reports` | **Signalements** | Signalement émis depuis un fil | `12` RG79–RG85 | **1 j ouvré** | 4 h ouvrées | 30 min | `agent`, `admin` | Non |
| 11 | `documents` | **Documents à contrôler** *(si le canal est retenu — `12` Q5)* | Dépôt d'un document dans un fil | `12` §F | **1 j ouvré** | 4 h ouvrées | 30 min | `agent`, `admin` | Non |
| 12 | `lead_sync_failures` | **Échecs de synchronisation Brevo / Apollo** | Ligne `failed` de `outbox_events` | `05` RG99–RG104 | **2 j ouvrés** *(proposition, Q4)* | — | **Aucun** (RG30) | `agent`, `admin` | **Oui** — rejeu en lot, plafond 200 |
| 13 | `email_delivery_incidents` | **Adresses injoignables** | Rebond dur, signalement « je ne reçois pas le code » | `05` (§ code par e-mail) | **2 j ouvrés** *(proposition, Q4)* | 4 h ouvrées | 30 min | `agent` ; correction d'adresse : `admin` | Non |
| 14 | `data_subject_requests` | **Demandes relatives aux données personnelles** | Demande d'un membre ou d'un tiers | **§G de ce document** | **30 j calendaires** (délai légal), **objectif interne 10 j ouvrés** | 1 j ouvré | 30 min | Instruction `agent` ; **exécution `admin`** (`03` §3.5) | Non |
| 15 | `dual_control_pending` | **Actions en attente de seconde validation** | Toute action `2V` demandée et non encore confirmée | **§E et §J de ce document** | **24 h**, puis **expiration** (RG31) | — | Aucun | `admin` distinct du demandeur, ou le demandeur en mode dégradé | Non |

**RG30** — **La file `lead_sync_failures` n'a pas de verrou nominatif**, et c'est délibéré : le rejeu
est **idempotent** (`05` RG102). Deux agents qui rejouent la même ligne ne produisent ni doublon, ni
double e-mail. Poser un verrou là où la concurrence est inoffensive n'ajoute que de la friction.

**RG31** — **Une demande de seconde validation expire au bout de 24 heures** si elle n'est ni
confirmée, ni abandonnée. L'expiration est journalisée, le demandeur en est informé, **et rien n'est
exécuté**. Une action irréversible ne reste jamais armée indéfiniment : c'est exactement le scénario
où quelqu'un confirme trois jours plus tard une action dont il a oublié le contexte.

**RG32** — **Deux états de file distincts et distinctement affichés** (`backoffice-ops`, cas limite
« file vide vs file bloquée ») :

| État | Ce qui s'affiche | Nature |
|---|---|---|
| **Vide** | « Aucune entrée en attente — la dernière a été traitée il y a {n} min. » | Normal |
| **Bloquée** | « Aucune entrée n'est remontée depuis {durée}. Cette file en reçoit habituellement. » + lien vers l'état des services | **Incident technique**, alerte **AL4** |

**RG33** — **Les filtres et tris communs à toutes les files** : état, hors délai, titulaire du
verrou (libre · moi · un autre agent nommé), commercial responsable, période, présence d'une alerte.
Chaque file ajoute ses filtres propres, définis par son document. **Aucun filtre supplémentaire
n'est ajouté sans passer par `chef-de-projet`** : un écran à quinze filtres n'est plus un outil.

**RG34** — **La pagination est plafonnée côté serveur** et **le défilement infini est interdit**
sur toutes les listes du backoffice. Ce n'est pas une préférence ergonomique : c'est un garde-fou
anti-aspiration (`03` C(17)). Une liste qui se déroule sans fin est un export déguisé.

**RG35** — **L'ouverture d'une entrée qui expose une identité non encore révélée, une pièce de
vérification ou une conversation est journalisée** (`03` C(14), C(24) ; `13` RG34). Ce n'est pas une
consultation anodine : c'est un acte.

**RG36** — **Un rôle interne ne traite jamais une entrée impliquant un compte qu'il détient ou
représente** (`13` RG35, `03` C(3)). L'entrée lui est masquée ; si le conflit apparaît en cours de
traitement, il **réattribue** avec le motif `conflict_of_interest`.

**RG37 — Écarts d'harmonisation assumés, et pourquoi.** Trois files divergent volontairement, et il
faut le dire pour que personne ne « corrige » l'écart par mégarde :

| File | Écart | Raison |
|---|---|---|
| `introductions` | **Escalade administrateur à J+1** après l'échéance (`13` RG99), au lieu de 3 jours ouvrés ailleurs (`06` RG7, `08` RG66, `09` RG6) | C'est la seule file dont le délai détruit directement la conversion : deux parties qui attendent se cherchent ailleurs (**R2**) |
| `campaigns` | **Deux délais** : 1 j ouvré, **2 j** en revue renforcée | La revue renforcée exige deux personnes (`09` RG85) : un délai identique serait intenable |
| `data_subject_requests` | Délai **légal** de 30 jours calendaires, pas un SLA d'exploitation | Un délai légal ne se règle pas en table pour se donner de l'air. L'objectif interne de 10 jours ouvrés, lui, est paramétrable |

**RG38** — **Toutes les valeurs de délai, d'objectif, d'expiration et de plafond de ce document sont
des données**, dans `backoffice.sla_policies` et `backoffice.operational_settings`, modifiables sans
déploiement, **chaque modification journalisée nominativement** et réservée au rôle `admin`
(`04` §5.10). Aucune n'est une constante dans le code.

---

### D — La fiche de compte

**RG39** — Il existe **trois fiches distinctes, jamais fusionnées** : **fiche marque**, **fiche
créateur**, **fiche de compte interne** (§J). Elles ne partagent ni les mêmes blocs, ni les mêmes
actions, ni le même vocabulaire.

**RG40** — **L'ouverture d'une fiche est journalisée** (`introduction`-style, gravité « sensible ») :
elle expose une identité complète, des coordonnées et un historique commercial.

**RG41 — Blocs de la fiche marque, dans cet ordre imposé** :

| # | Bloc | Contenu |
|---|---|---|
| 1 | **En-tête** | Raison sociale, nom commercial, logo, pays, langue, **état du compte** (actif · suspendu · supprimé), date d'inscription, dernière activité, **commercial responsable** et bouton de réattribution, badge « Marque vérifiée » **et sa date** |
| 2 | **Interlocuteur** | Prénom, nom, fonction, e-mail, téléphone, page de contact. **Visible des seuls rôles internes** (**D40**, `06` RG38) |
| 3 | **Profil** | État (brouillon · à valider · publié · refusé · suspendu), score de complétude, champs modifiés depuis la dernière validation, **historique des décisions** avec motif et auteur |
| 4 | **Campagnes** | Liste avec état, dates, nombre de candidatures, commercial responsable, **alerte « publiée sans candidature depuis 7 jours »** |
| 5 | **Mises en relation** | Référence `MER-…`, origine, état, date de révélation, créateur concerné, commercial responsable |
| 6 | **Affaires** | État, **montant négocié**, **commission convenue**, **commission encaissée**, devise, dates, mode d'envoi du contrat — **et l'historique des modifications de montant** (`01` §6.2) |
| 7 | **Conversations** | Liste avec référence, état, date du dernier message, participants. **Lire un fil passe par la fonction journalisante avec un motif** (`12` RG55–RG57) : le bouton dit « Lire le fil (lecture journalisée) » |
| 8 | **Consentement et synchronisation** | Valeur, date et source du consentement marketing ; **état Brevo** et **état Apollo** avec la cause en clair ; rejeu unitaire (`05` RG99) |
| 9 | **Notes internes** | RG45 à RG48 |
| 10 | **Journal du compte** | Toutes les actions internes et systèmes, horodatées et nommées, filtrables par type |
| 11 | **Données personnelles** | Demandes en cours et passées, sessions actives, date de la dernière acceptation de CGU et **version acceptée** |

**RG42 — Blocs de la fiche créateur**, mêmes principes, contenu propre : en-tête (alias public,
**nom réel et pseudos — vue interne**, pays, langue, état, commercial responsable, **badges et leurs
dates**) ; réseaux et audience avec **la date de mesure et la source de chaque chiffre** ; tarifs
exacts par (réseau, format) avec devise ; portfolio et son état de modération ; **pièces de
vérification** — accessibles au seul rôle interne, **relayées par l'API, jamais par une URL signée**,
**chaque consultation journalisée** (`03` C(13), C(14), BO-5) ; candidatures ; mises en relation ;
affaires ; conversations ; consentement et synchronisation ; notes internes ; journal ; données
personnelles.

**RG43** — **La fiche ne montre jamais** : un code de connexion, un mot de passe, le contenu d'un
message (il se lit dans le fil, avec journalisation), une donnée enrichie par Apollo (`05` RG107),
le motif d'une suspension d'un **autre** compte, ni les notes internes portant sur un tiers.

**RG44** — **Aucun champ de la fiche n'est modifiable sans motif.** Une correction par un rôle
interne enregistre **l'ancienne et la nouvelle valeur**, exige un motif, est journalisée
nominativement, et **le membre en est informé** (`03` C(7), `05` RG108, `06` RG71, `07` RG100,
`09` RG94). Un agent qui modifie une donnée sans trace est indistinguable d'une falsification.

**RG45** — **Une note interne est immuable** : on ajoute, on ne corrige pas (`04` §5.10). Une note
erronée est suivie d'une nouvelle note qui la rectifie. Une note réécrite six mois plus tard ne vaut
rien.

**RG46** — **Une note interne porte son auteur, sa date et son sujet** — exactement un sujet : un
compte, une mise en relation, une affaire, une campagne ou une demande. Elle est **visible des seuls
rôles `agent` et `admin`**, **jamais du membre**, **jamais exportée vers Brevo ou Apollo**, **jamais
citée dans un e-mail ou un message adressé à un membre**.

**RG47** — **Une note ne porte jamais une décision.** Écrire « profil suspendu, voir plus haut » dans
une note au lieu de suspendre avec un motif typé vide le dispositif de sa substance. Une décision est
une action typée ; une note est un contexte.

**RG48** — **Les notes internes sont communicables à la personne concernée** au titre d'une demande
d'accès, sauf exception appréciée par `expert-conformite-rgpd` (§G, **Q7**). **L'écran le rappelle
au-dessus du champ de saisie** : « Cette note peut être communiquée à la personne concernée si elle
exerce son droit d'accès. » C'est la seule façon d'éviter les notes que personne n'assumerait.

**RG49** — **Le commercial responsable est affiché avec l'historique complet des responsables
successifs** (`backoffice.ownership_assignments`), jamais écrasé (`03` C(22)).

**RG50** — **La recherche de comptes par adresse exacte est libre pour les rôles internes ; la
recherche partielle est limitée en débit et journalisée** (`05` RG98), afin qu'une extraction massive
par l'interface soit **détectable**. Le nombre de **fiches distinctes ouvertes par un même compte
interne sur 24 h** est surveillé (alerte **AL21**).

---

### E — Suspension, réactivation, réattribution

**RG51** — **La suspension coupe l'accès, potentiellement en pleine négociation** : c'est une action
sensible au sens de `backoffice-ops` étape 4. Elle est **demandée par un `agent` et confirmée en
double validation** ; sa **levée est réservée à `admin`**, avec re-authentification (`03` §3.1). Un
rôle interne **n'agit jamais sur son propre compte** (`03` C(3)).

**RG52 — Liste fermée des motifs de suspension.** Chaque motif porte le message envoyé au titulaire :
**il n'existe aucune suspension muette**.

| Motif | Message au titulaire | Escalade | Réversible |
|---|---|---|---|
| `terms_breach` | « Votre compte est suspendu pour manquement aux conditions générales d'utilisation. Notre équipe vous contacte. » | Administrateur | Oui |
| `suspected_circumvention` | Message neutre : « Votre compte est temporairement suspendu. Un membre de l'équipe INFLUX vous contacte. » | **Administrateur, obligatoire** | Oui |
| `fraudulent_identity` | « Nous n'avons pas pu confirmer l'identité ou la représentation déclarée sur votre compte. » | Administrateur | Oui |
| `illicit_content` | « Un contenu publié sur votre compte est contraire à nos conditions. » | Administrateur | Oui |
| `report_upheld` | Message dédié selon la mesure (`12` RG84) | Non | Oui |
| `unpaid_commission` | « Une commission convenue avec INFLUX reste impayée. Notre équipe vous contacte. » | Administrateur | Oui |
| `account_holder_request` | « Votre compte est mis en pause à votre demande. » | Non | Oui |
| `other` | Message rédigé par l'agent, **en complément** d'une explication typée | Administrateur | Oui |

**RG53** — **`suspected_circumvention` n'affiche jamais son motif réel au titulaire.** On appelle
avant d'accuser (`10` RG68, `13` RG33). Une accusation automatique de contournement adressée à un
client qui ne contourne pas est une relation commerciale détruite.

**RG54 — Effets d'une suspension, exhaustivement** — ce tableau est la référence pour `testeur` :

| Domaine | Effet |
|---|---|
| **Accès** | Sessions **révoquées immédiatement** (`03` A-9, §6.3). La connexion reste possible mais n'ouvre qu'un écran d'information portant le message du motif |
| **Profil** | Dépublié : absent de la recherche, des campagnes et de toute liste publique |
| **Campagnes** (marque) | Dépubliées ; les candidatures en cours sont clôturées sans suite, sous-motif `advertiser_suspended` (`13` RG95) |
| **Candidatures et demandes** | Les entrées de file encore non décidées sont **clôturées sans suite**, sous-motif `advertiser_suspended` ou `creator_unavailable`. Les deux parties reçoivent le message neutre de `13` RG94 |
| **Mises en relation ouvertes** | **Conservées.** Rien n'est dé-révélé : ce qui est révélé est révélé (`13` RG75) |
| **Conversations** | **Lecture conservée, écriture fermée** pour la partie suspendue ; message système `party.write_disabled`, **sans divulguer le motif** ; le commercial responsable est alerté (`12` cas limite 1, RG87) |
| **Affaires** | **Conservées, aucun changement d'état automatique.** Une suspension n'est pas une clôture d'affaire : les deux sont indépendantes (`12` RG26) |
| **Brevo / Apollo** | Un `lead.updated` part. **Une suspension n'est ni un retrait de consentement, ni une suppression** : aucun contact n'est effacé chez un sous-traitant sur cette seule base |
| **Notifications** | Le titulaire reçoit le message du motif. **Aucune autre partie n'est informée de la suspension ni de son motif** |

**RG55 — Liste fermée des motifs de levée de suspension** : `erreur_interne` (INFLUX s'est trompé —
message avec excuses explicites), `situation_regularisee`, `decision_revue`, `fin_de_la_mesure`,
`other` (commentaire interne obligatoire).

**RG56** — **À la levée, le profil n'est pas républié aveuglément.** Si le motif de suspension portait
sur le **contenu ou l'identité** (`illicit_content`, `fraudulent_identity`, `terms_breach`), le
profil repasse en **file de validation** ; dans les autres cas, il retrouve l'état exact qu'il avait
avant la suspension. Republier sans relire un profil suspendu pour contenu illicite reviendrait à
annuler la décision sans la revoir.

**RG57** — **Une suspension et sa levée sont journalisées** avec leur auteur, leur date, leur motif
et, pour la levée, la durée totale de la suspension.

**RG58** — **La réattribution transfère le commercial responsable**, avec un **motif typé** repris
tel quel de `13` RG47 — `absence`, `workload`, `conflict_of_interest`, `expertise`,
`portfolio_transfer`, `departure`, `other` — et s'applique à **trois objets** : un **compte**, une
**mise en relation**, une **affaire**. L'historique des responsables successifs est **conservé**,
jamais écrasé.

**RG59** — **Une réattribution portant sur une mise en relation dont la conversation est ouverte est
annoncée dans le fil** comme un changement d'interlocuteur clairement nommé (`13` RG48, document
`12`). Les deux parties ne découvrent jamais un nouvel interlocuteur par hasard.

**RG60** — **La réattribution est un préalable bloquant à la désactivation d'un compte interne**
(`backoffice-ops`, règle 19 ; `03` C(22), BO-7 ; `13` RG49). L'écran de désactivation **refuse** tant
qu'il reste un objet sous la responsabilité de la personne, et **nomme** ce qui reste.

**RG61** — **Le transfert de portefeuille est une action de masse** (M5, §H) : d'un agent vers un
autre, avec aperçu chiffré (« 42 comptes, 17 mises en relation, 9 affaires »), confirmation séparée,
motif typé, et **réversibilité annoncée** — elle est réversible par une nouvelle réattribution, mais
les annonces déjà publiées dans les fils, elles, ne s'annulent pas.

**RG62** — **Aucune réattribution automatique au MVP.** Un agent peut déclarer une **période
d'absence** ; ses responsabilités sont alors **signalées** au tableau de bord des autres
(alerte **AL41**), mais rien ne change de main sans décision humaine. Une réattribution automatique
sur une équipe de deux personnes ferait plus de dégâts qu'elle n'en éviterait.

---

### F — Le catalogue central des alertes

**RG63** — **Toute alerte porte un code, un seuil écrit en table, un destinataire nommé et une action
possible.** Si l'agent ne peut rien faire en la lisant, **elle n'a rien à faire là**
(`backoffice-ops`, règle 32 ; `13` RG105).

**RG64 — Deux natures d'alerte, et il ne faut pas les confondre** :

| Nature | Comportement | Exemple |
|---|---|---|
| **Alerte d'état** | Dérivée d'une condition. Elle **se lève et se referme seule** quand la cause apparaît ou disparaît. Elle ne se classe pas | « Décision hors délai » : elle disparaît quand la décision est prise |
| **Alerte d'événement** | Créée une fois par un fait. Elle **doit être classée** par un humain : prise en charge, puis close avec un motif typé. **Aucune disparition silencieuse** | « Coordonnée détectée dans un fil » : quelqu'un doit l'avoir lue et décidé |

**RG65** — **Aucune alerte ne déclenche de sanction automatique** (`01` M5). Elle informe un humain,
qui décide. C'est particulièrement vrai des alertes de contournement : le commercial est déjà dans le
fil et voit tout.

**RG66** — **Aucune alerte n'est portée par la seule couleur** : chacune porte un **libellé écrit**
(`backoffice-ops`, règle 37).

**RG67** — **Un seuil mal réglé se voit.** Si un même code d'alerte dépasse **50 instances ouvertes**,
une alerte de second rang part à l'administrateur : ce n'est pas l'exploitation qui déraille, c'est
le seuil qui est faux.

**RG68 — Le catalogue.** Les codes `AL…` de ce document **remplacent** la numérotation locale `A1`
à `A10` de `13` §J, qui entrait en collision avec les arbitrages `A1` à `A10` du fondateur
(`00` §3) — un lecteur ne pouvait pas savoir si « A1 » désignait « contrat hors application » ou
« demande sans preneur ». La correspondance est donnée en dernière colonne.

| Code | Alerte | Seuil de départ (en table) | Nature | Destinataire | Action attendue | Source |
|---|---|---|---|---|---|---|
| **AL1** | Entrée de file **sans preneur** | Objectif interne dépassé (4 h ouvrées) | État | Tous les commerciaux, en tête de file | Prendre en charge | `13` A1 |
| **AL2** | **Décision hors délai** | `sla_due_at` dépassé | État | Liste dédiée + **escalade `admin` à J+1** sur `introductions` | Décider, même tard | `13` A2 |
| **AL3** | **Verrou orphelin** | 30 min sans décision | État | Le titulaire, puis les administrateurs | Reprendre ou libérer | `13` A3 |
| **AL4** | **File bloquée** | Aucune entrée nouvelle depuis 24 h ouvrées sur une file habituellement alimentée | État | Administrateur | Vérifier la chaîne technique | RG32 |
| **AL5** | **File qui grossit** | Ancienneté de la plus ancienne > **2 ×** le délai de la file | État | Tous les commerciaux + `admin` | Renforcer, ou revoir le délai | `backoffice-ops` 27 |
| **AL6** | **Acceptation en attente** | J+3 puis J+6 après l'invitation | Événement | Le commercial responsable | Relancer, puis appeler | `13` A4 |
| **AL7** | **Fil silencieux après révélation** | **14 jours** sans message **et** sans état d'affaire mis à jour | État | Le commercial responsable | Appeler — **jamais une accusation automatique** | `13` A5, `01` M6 |
| **AL8** | **Mise en relation révélée sans état d'affaire** | **30 jours** | État | Le commercial responsable + `admin` | Contournement **ou** saisie négligée : on appelle le commercial | `13` A6 |
| **AL9** | **Coordonnée détectée** dans un texte | Première détection | Événement | Le commercial responsable | Lire, décider. **Aucun masquage, aucun blocage** | `13` A7, `01` M5 |
| **AL10** | **Échec définitif d'e-mail** de confirmation de mise en relation | Rejeux épuisés | Événement | Commercial + `admin` | Rattraper à la main : **une mise en relation sans e-mail est sans preuve externe** | `13` A8 |
| **AL11** | **Signalement en attente** | Dès la création | Événement | Tous les commerciaux | Instruire sous 1 j ouvré | `12` RG82 |
| **AL12** | **Document à contrôler hors délai** | 1 j ouvré dépassé | État | Le commercial responsable | Contrôler | `12` RG71 |
| **AL13** | **Agent ayant lu beaucoup de fils** | **40 conversations distinctes / 24 h** | Événement | `admin` | **Parler à la personne.** Ne bloque rien | `12` RG61, `03` §5.2 |
| **AL14** | **Badge à rafraîchir** | J-15, puis J+0 (90 j) | État | Créateur (e-mail) + commercial responsable | Relancer | `08` RG70 |
| **AL15** | **Chute d'audience** | **−40 %** par rapport au dernier constat | Événement | Commercial | Proposer un rafraîchissement anticipé. **Aucun retrait automatique** | `08` RG79 |
| **AL16** | **Identifiant modifié à contrôler** | Déclaration du créateur | Événement | Commercial | Constater ou exiger une nouvelle preuve | `08` RG78 |
| **AL17** | **Contestation de badge ouverte** | Dès la création | Événement | `admin` | Faire réexaminer par un autre agent | `08` RG77 |
| **AL18** | **Campagne publiée sans candidature** | **7 jours** | État | Commercial responsable | Relancer, élargir, proposer des créateurs | `09` RG96 |
| **AL19** | **Date limite de candidature proche** | **3 jours** | État | Commercial responsable | Relancer | `09` RG96 |
| **AL20** | **Campagne publiée sans commercial responsable** | Immédiat | État | `admin` | Attribuer : c'est une campagne que personne ne vendra | `09` RG97 |
| **AL21** | **Volume anormal de profils ou de fiches consultés** | Seuil à régler au Lot 3 / Lot 5 | Événement | `admin` | Instruire. **S'applique aussi aux comptes internes** (RG50) | `03` C(17), I-9 |
| **AL22** | **Recherches bloquées par le k-anonymat** | **> 20 %** des recherches | État | `admin` + `chef-de-projet` | Masse critique insuffisante (**D38**) ou facettes trop fines | `10` RG86 |
| **AL23** | **Demande « sélection par l'équipe » sans réponse** | Délai de la file 9 dépassé | État | Tous les commerciaux | Traiter | `10` RG84 |
| **AL24** | **Échec de synchronisation non traité** | Délai de la file 12 dépassé | État | Commercial + `admin` | Rejouer ou corriger | `05` RG104 |
| **AL25** | **Panne durable d'un destinataire, clé refusée, quota dépassé, configuration de synchronisation manquante** *(dernier motif ajouté le 2026-10-17, D67, tranchée)* | Échecs consécutifs sur fenêtre glissante ; **1re ligne** pour une clé refusée ou une configuration manquante (`list_not_configured`, `template_not_configured`, `apollo_settings_invalid`, `credentials_missing`) | Événement | `admin`, immédiatement | Incident technique ; pour la configuration : renseigner le réglage nommé, les lignes repartent seules (`05` RG161) | `05` RG104, RG160 |
| **AL26** | **File de leads en retard** | Objectifs de `05` RG79 dépassés (Brevo 1 h, Apollo 24 h) | État | `admin` | Vérifier le worker | `05` RG104 |
| **AL27** | **Écart de désinscription Brevo** | Écart constaté au rapprochement de 24 h | État | `admin` | Corriger — **Brevo fait foi** (`05` RG90) | `05` RG91 |
| **AL28** | **Affaire `signed` sans commission facturée** | **J+7** | État | Commercial responsable | Facturer | `01` §6.4 |
| **AL29** | **Commission facturée sans encaissement** | **J+30** | État | Commercial + `admin` | Relancer | `01` §6.4 |
| **AL30** | **Écart commission convenue / encaissée** | Rapprochement mensuel, **par devise** | Événement | `admin` + fondateur | Expliquer ligne à ligne. **Jamais une correction silencieuse** | `01` §6.4 |
| **AL31** | **Affaire `stalled`** | **14 jours** sans mouvement | État | Commercial responsable | Relancer ou clore avec motif | `01` §6.1 |
| **AL32** | **Affaire `disputed` ouverte** | Dès la création | Événement | `admin` | Instruire | `01` §6.1 |
| **AL33** | **Connexion au compte de secours** | Toute connexion | Événement | **Fondateur**, immédiatement, + `admin` | Exiger une justification écrite sous 24 h | `03` MFA-10 |
| **AL34** | **Consommation d'un code de secours** | Toute consommation | Événement | **Tous les `admin`** | Vérifier que la personne est bien la bonne | `03` MFA-4 |
| **AL35** | **Connexion interne inhabituelle** (pays, opérateur) | Écart au profil habituel | Événement | `admin` | Vérifier | `03` B-7, BO-6 |
| **AL36** | **Rupture ou trou dans la chaîne du registre** | Vérification périodique | Événement | **Fondateur** + `admin`, immédiatement | Incident : une chaîne cassée ne se répare pas, **elle s'explique** | `13` A9, `04` `chain_checks` |
| **AL37** | **Actions confirmées en contrôle affaibli** | Récapitulatif **hebdomadaire** | Événement | `admin` + fondateur | Lire la liste. C'est une discipline, pas un contrôle technique | `03` PD6 |
| **AL38** | **Motif « autre » au-delà de 10 %** | 10 % des décisions d'une liste sur un mois | État | `product-owner` + `admin` | Étendre la liste de motifs | RG8, `13` A10 |
| **AL39** | **Tentatives d'action refusées pour droit insuffisant** | 5 refus par compte interne sur 24 h | Événement | `admin` | Erreur d'écran, ou tentative. Les deux méritent un regard | `backoffice-ops` cas limite 10 |
| **AL40** | **Demande de données personnelles proche de son échéance** | **J-7** avant les 30 jours | État | `admin` | Exécuter. Un délai légal ne se négocie pas | §G |
| **AL41** | **Responsabilités d'un agent absent ou désactivé** | Période d'absence déclarée, ou compte désactivé | État | `admin` | Réattribuer | RG60, RG62 |

**RG69** — **Une alerte d'événement se classe avec un motif typé** : `traitée`, `sans_suite`,
`faux_positif`, `doublon`, `other` (commentaire obligatoire). Le classement est journalisé avec son
auteur. La part de `faux_positif` par code est l'indicateur qui dit si un seuil est mal réglé.

**RG70** — **Les alertes ne partent jamais vers Brevo ni vers Apollo**, sous aucune forme, y compris
agrégée. Pas plus que les notes internes, les motifs de suspension, les états d'affaire et les
montants. Ce sont des données internes d'INFLUX.

---

### G — Les demandes relatives aux données personnelles

> **Périmètre.** Ce paragraphe décrit **l'outil et la procédure**. La **légalité** des traitements,
> les **bases légales**, les **durées** et ce qui peut être refusé relèvent d'`expert-conformite-rgpd`
> (**veto**). Les durées de conservation et ce qui survit à un effacement sont fixées par `04` §9.1
> et §9.2, et doivent figurer **dans la politique de confidentialité dès le Lot 1** (`01` M4,
> point 6) — **sans cette mention, le droit de conserver n'existe pas**.

**RG71** — **Six types de demande** sont traités : **accès**, **rectification**, **effacement**,
**portabilité**, **opposition**, **limitation** (`04` §5.10). *(`CLAUDE.md` §9 en cite cinq :
l'ajout de la limitation est à confirmer — **Q6**.)*

**RG72** — **Toute demande, quelle que soit son origine, crée une entrée dans la file 14.** Une
demande traitée hors file **n'existe pas** : ni preuve, ni délai, ni trace. Trois origines sont
prévues : l'espace « mes données » du membre, un message reçu à l'adresse de contact et **saisi par
un agent**, une demande orale **consignée** par un agent avec sa date et son canal.

**RG73** — **`due_at` = un mois calendaire après la réception** (art. 12(3) RGPD et UK GDPR), calculé
une fois, **figé** (`04` §5.10). *Jusqu'à `0502` : la plus proche de « réception + 30 jours » et
« réception + un mois calendaire en UTC » (`0127`, `expert-conformite-rgpd` 2026-10-14 : + 30 jours
dépasse le mois légal en février).* Prorogation possible de deux mois (demande complexe ou nombreuses),
annoncée au demandeur avec ses motifs avant la fin du premier mois. Un **objectif interne de 10 jours ouvrés** existe en plus, en table, non annoncé au
demandeur. Alerte **AL40** à J-7.

**RG74** — **L'identité du demandeur est établie avant toute exécution.** Depuis l'espace membre :
re-authentification par un nouveau code (`03` A-10). Hors plateforme : vérification hors bande,
**jamais sur la seule foi d'une adresse e-mail**. La méthode et sa date sont enregistrées. Exécuter
un export sur une demande non authentifiée, c'est organiser soi-même la fuite.

**RG75 — Les sept étapes de l'instruction**, dans cet ordre :

| # | Étape | Qui | Trace |
|---|---|---|---|
| 1 | **Qualifier** le type de demande | `agent` | Type enregistré ; une demande ambiguë est qualifiée après contact, pas devinée |
| 2 | **Vérifier l'identité** du demandeur | `agent` | Méthode + date (RG74) |
| 3 | **Établir le périmètre** : ce qui est détenu, ce qui est exclu et pourquoi | `agent` | Liste des catégories, écrite |
| 4 | **Prévenir le commercial responsable** si une affaire est en cours | Système | Notification. On ne coupe jamais une négociation dans le dos de celui qui la mène |
| 5 | **Rédiger la réponse** en langage clair, dans la langue du demandeur | `agent` | Texte conservé |
| 6 | **Exécuter** (export, rectification, anonymisation, opposition) | **`admin` uniquement**, `2V` + re-authentification (`03` §3.5) | Deux horodatages |
| 7 | **Notifier, puis clore** avec une issue typée | `agent` ou `admin` | Date d'envoi, identifiant du message chez le prestataire |

**RG76** — **Un agent n'exécute jamais un export ni une anonymisation.** Il instruit ; un
administrateur exécute (`03` §3.5). C'est la seule séparation de rôles du MVP qui porte sur une
obligation légale, et elle ne se contourne pas.

**RG77 — Liste fermée des issues** : `satisfaite`, `satisfaite_partiellement` — **avec la liste écrite
de ce qui n'est pas satisfait et son fondement** —, `refusée`, `sans_objet` (donnée non détenue),
`retirée_par_le_demandeur`.

**RG78 — Liste fermée des motifs de refus**, chacun avec son message : demande **manifestement
infondée ou excessive** (répétitive), **identité non établie**, **donnée non détenue**, **exception
légale ou conservation probatoire** (RG80), **droits d'un tiers** (RG81). Un refus est toujours
motivé, écrit, et mentionne les voies de recours.

**RG79** — **La propagation vers Brevo et Apollo fait partie de l'exécution, pas de son suivi.** Un
effacement émet `account.deleted` et une opposition émet `consent.revoked`, **tous deux en priorité
sur toute la file** (`05` RG78). **La demande n'est pas close tant que les deux destinations n'ont
pas confirmé**, ou tant qu'un échec définitif n'est pas journalisé et rattrapé à la main. Une demande
d'effacement close alors que Brevo n'a rien confirmé est une demande **non exécutée**.

**RG80** — **Ce qui survit à un effacement, sous forme pseudonymisée**, est fixé par `04` §9.2 et
**énoncé au demandeur dans la réponse** : la **mise en relation** (identifiants, pays, dates,
référence `MER-…`, aucun nom), l'**affaire** (montants, devise, dates, commercial), le **registre
d'audit**, la **conversation** (les messages restent, l'auteur devient « Compte supprimé »), et le
**journal des lectures**. Aucune suppression physique n'est possible : la clé étrangère du registre
l'interdit en base.

**RG81** — **Un export ne contient jamais les données d'un tiers.** Sur une conversation, le
demandeur obtient **ses propres messages**, les **métadonnées** du fil (référence, dates,
participants) et l'**historique de la mise en relation**. Le texte écrit par l'autre partie **n'est
pas inclus** au MVP — **hypothèse conservatrice à confirmer** (**Q7**, arbitre
`expert-conformite-rgpd`, veto). Ne sont jamais inclus : les **notes internes** portant sur un tiers,
les **motifs internes**, le **journal des lectures d'autres personnes**, les **pièces de
vérification** (elles contiennent des données de tiers, `03` C(13)).

**RG82** — **L'export est livré par un lien de courte durée**, jamais en pièce jointe d'e-mail, et
son émission est journalisée (E2, §I). Le format est lisible par un humain **et** réutilisable par une
machine (portabilité).

**RG83** — **Une opposition au marketing prend effet immédiatement**, avant même la clôture de la
demande : `consent.revoked` en priorité, et **aucun envoi ne part vers cette adresse**, y compris
depuis l'écran d'envoi du backoffice, où le consentement est **revérifié à la consommation**
(`03` C(35)).

**RG84** — **Un rôle interne ne modifie jamais le consentement marketing d'un membre** (`03` C(36)).
Il le lit, constate son absence, et demande au membre de le donner lui-même. Un consentement saisi
par un tiers n'est pas un consentement.

**RG85** — **La preuve du traitement, c'est la ligne de file** : date de réception, type, méthode de
vérification d'identité, périmètre établi, exécutant, deux horodatages de la double validation,
contenu de la réponse, date d'envoi et identifiant du message chez le prestataire. On doit pouvoir
démontrer qu'une demande a été traitée dans le délai **sans reconstituer un enchaînement d'e-mails**.

---

### H — Les actions de masse

**RG86** — **Les actions de masse du backoffice forment une liste fermée.** Toute action portant sur
plusieurs objets qui n'y figure pas n'existe pas.

| Code | Action | Plafond par lot | Qui | Contrôle | Réversibilité annoncée |
|---|---|---|---|---|---|
| **M1** | **Rejeu en lot** des échecs de synchronisation | **200 lignes** (`05` RG101) | `agent`, `admin` | Aperçu + confirmation séparée, **sans `2V`** (EC-J8-19, revue `expert-cybersecurite` 2026-10-16 : même ligne et même clé, état relu à la consommation, lignes sans consentement refusées, lot journalisé) | **Sans objet** : le rejeu est idempotent, aucun doublon, aucun e-mail renvoyé |
| **M2** | **Proposition INFLUX** vers plusieurs créateurs | **20 par envoi**, **60 par jour et par commercial** (`13` RG53) | `agent`, `admin` | Aperçu + confirmation séparée (`13` RG55) | **Réversible tant que rien n'est révélé** : retrait avec motif (`13` RG63) |
| **M3** | **Envoi d'e-mails Brevo** | Plafonds par rôle et par source (**D35**, `04` `email_send_limits`) | `agent`, `admin` | `2V` + re-authentification + **fenêtre d'annulation de 5 min** | **Irréversible passé la fenêtre.** Dit en toutes lettres avant l'envoi |
| **M4** | **Modération en lot des visuels d'un même profil** | **20** | `agent`, `admin` | Aperçu + confirmation séparée, **motif commun** de la liste de `07` RG97 | Réversible : un visuel refusé peut être approuvé ensuite |
| **M5** | **Transfert de portefeuille** d'un agent vers un autre | **200 objets** | `admin` | `2V` + re-authentification | Réversible par une nouvelle réattribution — **sauf les annonces déjà publiées dans les fils** |

**RG87** — **Toute action de masse qui envoie un e-mail obéit en plus aux règles de M3**, quel que
soit l'écran d'où elle part. Il n'existe pas de « petite relance groupée » qui échapperait aux
plafonds, à la vérification du consentement et à la journalisation nominative.

**RG88 — Les six exigences de `backoffice-ops` étape 3 s'appliquent à M1 à M5, sans exception** :

| Exigence | Mise en œuvre |
|---|---|
| **Plafond** | Affiché **avant** la sélection, pas découvert à l'envoi |
| **Aperçu** | La sélection exacte est récapitulée : combien, lesquels, quoi, avec quelle conséquence |
| **Confirmation explicite** | **Jamais en un clic.** Séparée du geste de sélection |
| **Réversibilité** | Annoncée **avant** l'exécution, dans les termes du tableau de RG86 |
| **Échec partiel** | **Ce qui a réussi reste.** Le compte rendu **nomme** les éléments écartés et la raison (`13` RG60) |
| **Journal** | Le lot est journalisé **comme un objet** : auteur, horodatage, contenu, résultat |

**RG89** — **Une action de masse dont la réversibilité n'est pas annoncée avant exécution est un
défaut bloquant** (`backoffice-ops`, règle 12).

**RG90 — Liste fermée des actions de masse *interdites***, chacune avec sa raison. Cette liste est
aussi importante que la précédente, parce que chacune paraîtra un jour être une bonne idée :

| Interdit | Pourquoi |
|---|---|
| **Valider ou refuser en lot** dans la file `introductions` | Chaque décision engage une révélation d'identité et une affaire (`13` RG50) |
| **Suspendre en lot** | Une suspension coupe l'accès en pleine négociation. Elle se décide compte par compte |
| **Supprimer ou anonymiser en lot** | Irréversible, et croise des affaires en cours |
| **Attribuer ou retirer des badges en lot** | Le badge est une affirmation d'INFLUX sur une personne (`08` RG2) |
| **Clore des affaires en lot** | Sort du pipeline et fausse les indicateurs |
| **Exporter l'annuaire**, sous quelque forme que ce soit | §I, `03` C(17) |
| **Publier en lot des profils ou des campagnes** | La validation est un examen, pas un tampon |

**RG91** — **Un lot déjà rejoué est idempotent** : aucun doublon chez Brevo ou Apollo, aucun e-mail
renvoyé (`05` RG102).

---

### I — Les exports

> **Le point le plus sensible du document.** `03` C(17) interdit **l'export de l'annuaire à tout le
> monde, y compris aux administrateurs**, et l'interdiction porte explicitement sur les
> contournements : pagination détournée, export CSV d'une liste, copie d'un résultat de recherche.
> Or `05` RG106 autorise l'**export de la liste des inscrits** au rôle `admin`. **Les deux règles ne
> peuvent pas coexister** : la liste des inscrits *est* l'annuaire.

**RG92 — Proposition de résolution, à arbitrer (Q1) : `05` RG106 est abrogé.** L'export nominatif de
la liste des inscrits n'existe pas. Le besoin légitime qu'il servait — savoir combien de personnes se
sont inscrites, où, avec quel consentement — est couvert par **E4**, agrégé et sans ligne nominative.
Arbitre : `chef-de-projet`, avec **veto `expert-cybersecurite`**.

**RG93 — Liste fermée des exports** :

| Code | Export | Contenu | Qui | Contrôle |
|---|---|---|---|---|
| **E1** | **Export comptable des affaires**, **par devise** | Une ligne par affaire : référence `MER-…`, dates, **montant négocié**, **commission convenue**, **commission encaissée**, devise, état, commercial responsable, raison sociale de la marque et nom du créateur **de cette affaire**. Porte sur des **affaires**, pas sur l'annuaire (`03` C(17)) | `admin` | Re-authentification + motif |
| **E2** | **Export d'une demande de données personnelles** | Les données **d'une seule personne**, périmètre de RG81 | `admin` | `2V` + re-authentification |
| **E3** | **Extrait du registre d'audit** sur une période et un périmètre | Événements, sans contenu de message | `admin` | Re-authentification + motif |
| **E4** | **Export d'indicateurs agrégés** | Volumes, délais, taux, répartitions — **par file, par période, par devise**. **Aucune ligne nominative, aucune donnée personnelle** | `agent`, `admin` | Journalisé |

**RG94** — **Tout export produit une ligne au registre** : qui, quand, quel export, **quels filtres
exacts**, combien de lignes, et **l'empreinte du fichier produit**. Sans l'empreinte, on ne peut pas
dire, plus tard, si un fichier qui circule vient bien de là.

**RG95** — **Un export est livré par un lien de courte durée**, jamais en pièce jointe d'e-mail, et le
lien est à usage unique. Une pièce jointe voyage, se transfère et se retrouve dans des boîtes que
personne ne contrôle.

**RG96** — **Plafond : 5 exports par compte interne et par jour ouvré**, paramètre en table.
Au-delà, refus avec message clair et **alerte AL21**. Un export légitime est rare ; une série
d'exports est un signal.

**RG97** — **Aucun export ne contient** : le contenu d'un message, une pièce de vérification, une
note interne portant sur un tiers, une coordonnée d'un compte qui n'est pas partie à l'objet exporté,
une donnée enrichie par Apollo, un code de connexion.

---

### J — La gestion des comptes internes

**RG98** — **Un compte interne = une personne nommée.** Aucun compte partagé, aucun compte générique,
jamais (`03` B-6, BO-7). Un compte partagé annule toute la traçabilité, qui est le cœur du dispositif
**A10**.

**RG99** — **La création se fait uniquement par invitation d'un `admin`** : lien à **usage unique**,
valable **72 heures**, **lié à l'adresse** (`03` MFA-1, B-8). **L'inscription est impossible** sur le
backoffice (**D12**).

**RG100** — **Le second facteur TOTP est inscrit à la première connexion, avant tout accès aux
données** (`03` MFA-2). Pas de « je le ferai plus tard ». **Dix codes de secours à usage unique** sont
affichés **une seule fois** ; seule leur génération est journalisée, jamais leur valeur ; leur
consommation **alerte immédiatement tous les administrateurs** (AL34).

**RG101** — **L'attribution et le retrait d'un rôle** (`agent` ↔ `admin`) sont réservés à `admin`,
avec `2V` + re-authentification, **et jamais sur son propre compte** (`03` C(3)). L'attribution du
rôle `admin` est un événement journalisé **et alerté**.

**RG102** — **La réinitialisation d'un second facteur** est faite par **un administrateur autre que
la personne concernée**, avec motif typé, `2V` + re-authentification, après **vérification d'identité
hors bande** — appel ou visioconférence avec une personne connue, **jamais sur la seule foi d'un
e-mail** (`03` MFA-6, MFA-7). Après réinitialisation : notification à tous les administrateurs et à
l'intéressé, nouveaux codes de secours, anciens invalidés, et **24 heures sans action irréversible**
(MFA-9).

**RG103 — Le compte de secours (« bris de glace ») existe dès le Lot 0** (`03` MFA-10, constat
bloquant B7) : compte `admin` dédié, **adresse distincte** (pas un alias d'une adresse personnelle),
mot de passe et TOTP sur un appareil conservé hors ligne, **codes de secours imprimés et scellés**,
rangés physiquement à part. **Toute connexion déclenche une alerte immédiate au fondateur** (AL33) et
une ligne d'audit. Il n'est **jamais** utilisé pour le travail quotidien, et son usage est **justifié
par écrit sous 24 heures** puis revu à chaque revue de sécurité.

**RG104 — Plafonds paramétrables par rôle**, tous en table, modifiables par `admin` seulement, `2V`,
journalisés, **jamais sur son propre compte** :

| Plafond | Valeur de départ | Table |
|---|---|---|
| Destinataires par envoi d'e-mails, et par jour | **D35** | `backoffice.email_send_limits` |
| Propositions INFLUX par jour et par commercial | 60 | `operational_settings` |
| Créateurs par proposition | 20 | `operational_settings` |
| Conversations distinctes lues par 24 h avant alerte | 40 | `operational_settings` |
| Exports par jour | 5 | `operational_settings` |
| Fiches distinctes ouvertes par 24 h avant alerte | à régler au Lot 5 | `operational_settings` |

**RG105** — **La désactivation d'un compte interne** : réattribution préalable obligatoire (RG60),
sessions **révoquées immédiatement**, accès fermé. **Le compte n'est jamais supprimé** : ses actions
passées conservent son nom, sinon six mois de journal deviennent illisibles.

**RG106** — **Une période d'absence déclarée** ne change aucun droit et ne réattribue rien
(RG62) : elle rend visible, au tableau de bord des autres, ce dont la personne est responsable
(AL41).

**RG107** — **Tant qu'il n'existe pas deux administrateurs actifs distincts, un bandeau permanent
l'affiche dans le backoffice** : « Contrôle par les pairs indisponible — les actions sensibles sont
confirmées en mode différé. » On ne laisse pas croire à un contrôle qui n'existe pas (`03` §1.3,
F-6).

**RG108** — **Recommandation reprise de `03` §1.3 et I-5 :** même pour une seule personne physique,
**deux comptes distincts** — un `agent` pour le quotidien, un `admin` pour l'administration — ou, à
défaut, une **étape d'élévation explicite** (re-authentification TOTP + motif typé + journalisation)
avant toute action réservée à `admin`. **Les deux sont acceptables ; l'absence des deux ne l'est
pas.** Arbitre : **fondateur** (F-5).

---

### K — Ce qu'un rôle interne ne peut jamais faire

**RG109** — **Chaque ligne de ce tableau est un défaut bloquant si elle est possible.** La colonne
« ce qui l'empêche » indique le mécanisme, et la colonne « vérifié par » le contrôle : une
interdiction sans mécanisme n'est qu'un vœu.

| # | Interdit | Ce qui l'empêche | Vérifié par |
|---|---|---|---|
| 1 | **Modifier ou supprimer une ligne du journal d'audit** | Aucun `GRANT`, déclencheur `deny_mutation`, chaînage par empreinte | `03` T3 |
| 2 | **Modifier `identity_revealed_at`**, ou le poser autrement que par la fonction unique | Aucun droit, déclencheur d'écriture unique | `03` T18 |
| 3 | **Révéler une identité sans les deux acceptations** | Contrainte de base inconditionnelle | `03` T18 |
| 4 | **Supprimer une affaire** | Aucun droit de suppression ; une affaire se clôt avec motif, `2V` | `03` §3.5 |
| 5 | **Modifier un montant d'affaire sans trace** | `deal_field_changes` en ajout seul, ancienne valeur conservée | `03` C(30) |
| 6 | **Écrire dans `commission_rates`** ou appliquer un taux | Aucun droit d'écriture, table vide, **aucune multiplication d'un montant par une constante dans le code** | `03` C(32), T16 |
| 7 | **Lire une conversation sans journalisation** | `REVOKE SELECT` sur `messaging.messages` pour `agent` et `admin` ; un seul chemin, la fonction journalisante | `03` T5, X1, X2 |
| 8 | **Consulter une pièce de vérification sans journalisation**, ou par URL signée remise au navigateur | Relais par l'API, journalisation à chaque consultation | `03` C(14), T9 |
| 9 | **Exporter l'annuaire**, y compris par pagination détournée ou copie d'un résultat de recherche | Pagination plafonnée, défilement infini interdit, débit limité, liste fermée d'exports (§I) | `03` C(17), RG34 |
| 10 | **Envoyer un e-mail de masse sans double confirmation** (ou sa forme dégradée) | Contrainte de base sur `email_sends`, fenêtre d'annulation | `04` §5.10 |
| 11 | **Modifier le consentement marketing d'un membre** | Aucun droit | `03` C(36) |
| 12 | **Agir sur son propre compte** : rôle, plafond, suspension, levée de suspension, validation | `WITH CHECK (target <> current_account())` | `03` C(3) |
| 13 | **Décider sur une entrée impliquant un compte qu'il détient ou représente** | Entrée masquée, contrôle serveur | `13` RG35 |
| 14 | **Valider une entrée dont un collègue tient le verrou** | Contrôle dans la fonction de décision | `03` C(21b) |
| 15 | **Modifier le texte écrit par un membre** et le présenter comme le sien | Interdit ; une correction est journalisée avec ancienne et nouvelle valeur, et **le membre en est informé** | `13` RG41, `03` C(7) |
| 16 | **Décider sans motif typé** | Motif obligatoire côté serveur | RG7 |
| 17 | **Agir sans que son nom et l'horodatage soient enregistrés**, ou sous une autre identité | Registre alimenté par les fonctions métier, jamais par un rôle humain | `03` C(37) |
| 18 | **Désactiver sa propre traçabilité** | Aucun droit sur le registre ni sur le journal des lectures | `03` §3.6 |
| 19 | **Rendre du contenu de membre en HTML** dans le backoffice | `react/no-danger` en erreur, aucun rendu Markdown | `03` BO-4 |
| 20 | **Restaurer des données de production dans un autre environnement** | Interdiction écrite ; `staging` alimenté par données synthétiques seulement | `03` §6.8, B9 |
| 21 | **Laisser une entrée quitter une file sans décision** | Aucune transition « disparaître » ; toute sortie est typée | RG27 C7 |

**RG110** — **Une tentative refusée est journalisée** avec son auteur, l'action visée et le motif du
refus, et un message clair est affiché — jamais une page d'erreur technique
(`backoffice-ops`, cas limite 10). Cinq refus sur 24 h déclenchent **AL39**.

**RG111 — Limite assumée et écrite** : aucun de ces contrôles n'empêche un administrateur du projet
Supabase de lire ou de modifier des données depuis la console d'administration, **sans trace dans
notre journal** (`03` §5.3, S-7 ; `12` RG64). Ce point est porté au fondateur (F-3) et ne doit pas
être passé sous silence dans l'information donnée aux utilisateurs.

---

### L — Densité, accessibilité et langue

**RG112** — **Tableaux plutôt que cartes**, partout (`backoffice-ops`, règle 33). Une carte par
élément fait défiler ; un tableau fait comparer. Les cartes sont réservées aux blocs de synthèse du
tableau de bord.

**RG113** — **Toutes les actions sont atteignables sans souris.** Navigation au clavier complète,
ordre de tabulation suivant l'ordre de lecture, **focus toujours visible**, aucun piège au clavier,
aucune action disponible au seul survol.

**RG114 — Raccourcis clavier obligatoires sur les gestes répétés**, identiques dans toutes les
files — c'est l'homogénéité qui les rend utiles :

| Touche | Geste |
|---|---|
| `j` / `k` | Entrée suivante / précédente |
| `Entrée` | Ouvrir l'entrée (**et la prendre en charge**, RG27 C1) |
| `v` | Valider |
| `r` | Refuser — ouvre la liste des motifs, **jamais un refus direct** |
| `n` | Ajouter une note interne |
| `l` | Relâcher le verrou |
| `Échap` | Fermer le panneau en cours, sans perdre la saisie |
| `?` | Afficher la liste des raccourcis |

**RG115** — **Aucun raccourci ne déclenche une action irréversible sans confirmation.** `v` sur une
validation révélante (`13` RG43) ouvre le récapitulatif, il ne valide pas.

**RG116** — **Aucune saisie n'est perdue sur erreur**, y compris un motif de refus, une note ou le
texte d'une proposition dont l'envoi a échoué. Un rechargement de page conserve l'entrée en cours et
le brouillon.

**RG117** — **Quatre états explicites par écran** : repos, chargement, succès, échec. Aucun écran ne
reste muet après une action. Un message d'erreur reste affiché **au moins 6 secondes** ou jusqu'à
fermeture explicite : un message qui disparaît avant d'être lu n'a pas été affiché.

**RG118** — **Aucune animation décorative, aucun délai artificiel** (`backoffice-ops`, règle 36).
Le seul délai imposé est celui de la confirmation différée (60 secondes, PD2), et il est **annoncé et
compté à l'écran**.

**RG119** — **La couleur n'est jamais le seul porteur d'information** : un dépassement de délai, un
compte suspendu, une alerte et un état de file portent chacun un **libellé écrit** et une forme
distincte. Contrastes **WCAG AA** au minimum.

**RG120** — **Tous les tokens viennent du design system** (`design-system-influx`), dark theme par
défaut, **aucune couleur ni espacement en dur**. Le vert de marque n'est jamais seul porteur d'un
état (`CLAUDE.md` §5.2).

**RG121** — **L'état de tri, de filtre et de pagination d'une liste figure dans l'adresse de la
page**, pour qu'un lien soit partageable entre collègues. **Cette adresse ne contient aucune donnée
personnelle** : des codes et des identifiants, jamais un nom ni une adresse e-mail — une URL voyage
dans les journaux, les historiques et les en-têtes `Referer`.

**RG122** — **Aucun outil d'analyse d'audience, aucune balise tierce, aucune police distante** dans
le backoffice, jamais (`03` BO-9).

**RG123** — **Chaque écran affiche ce qu'il ne montre pas.** Quand une donnée est volontairement
masquée — un motif de suspension d'un tiers, le contenu d'un message, une pièce de vérification
inaccessible — l'écran le dit d'une phrase, au lieu de laisser un vide qu'on interprétera comme un
bogue.

**RG124** — **Langue : D36 ouverte, français en valeur d'attente**, aucun libellé en dur (RG11). Les
**motifs typés, leurs messages aux membres et les libellés de file** existent **en français et en
anglais** dès le premier jour, parce qu'ils sortent du backoffice : un message de refus part dans la
langue du membre, pas dans celle de l'agent.

| Clé | Français | English |
|---|---|---|
| `bo.queue.empty` | Aucune entrée en attente — la dernière a été traitée il y a {minutes} min. | No pending entry — the last one was handled {minutes} min ago. |
| `bo.queue.stalled` | Aucune entrée n'est remontée depuis {duration}. Cette file en reçoit habituellement. | No entry has come in for {duration}. This queue usually receives some. |
| `bo.queue.claimed.byOther` | En cours — {agent}, depuis {time}. | In progress — {agent}, since {time}. |
| `bo.queue.claimed.byMe` | Vous avez pris cette entrée en charge à {time}. | You took this entry at {time}. |
| `bo.queue.overdue` | Hors délai depuis {duration}. Une décision reste possible. | Overdue by {duration}. A decision is still possible. |
| `bo.dualControl.degraded` | Contrôle par les pairs indisponible — les actions sensibles sont confirmées en mode différé. | Peer review unavailable — sensitive actions are confirmed in deferred mode. |
| `bo.dualControl.wait` | Confirmation possible dans {seconds} s. | Confirmation available in {seconds}s. |
| `bo.dualControl.expired` | Cette demande de confirmation a expiré. Rien n'a été exécuté. | This confirmation request has expired. Nothing was executed. |
| `bo.note.disclosureWarning` | Cette note peut être communiquée à la personne concernée si elle exerce son droit d'accès. | This note may be disclosed to the person concerned if they exercise their right of access. |
| `bo.conversation.readLogged` | Lire ce fil (lecture journalisée). | Read this thread (access is logged). |
| `bo.export.blocked` | L'export de l'annuaire est impossible, pour tous les rôles. | Directory export is not possible, for any role. |
| `bo.action.forbidden` | Vous n'avez pas le droit d'effectuer cette action. La tentative a été enregistrée. | You are not allowed to perform this action. The attempt has been recorded. |
| `bo.amount.byCurrency` | Montants présentés par devise, sans conversion. | Amounts shown per currency, without conversion. |
| `bo.suspension.notified` | Le titulaire du compte a été informé, avec le message associé au motif. | The account holder has been notified, with the message tied to the reason. |

---

## Cas limites

### Les huit cas obligatoires de `feature-spec`

| # | Cas | Comportement attendu |
|---|---|---|
| **1** | **Donnée absente ou profil incomplet** — une fiche dont le profil n'a jamais été soumis, un compte sans commercial responsable | La fiche s'affiche avec ses blocs vides **explicitement étiquetés** « non renseigné », jamais un écran en erreur. Un compte sans responsable remonte en alerte (**AL20** pour une campagne, contrôle équivalent pour un compte) et l'attribution est proposée sur la fiche |
| **2** | **Valeur nulle, négative ou aberrante sur un montant** | Refus **côté serveur** : montant > 0, devise ISO 4217 d'une liste fermée, `commission convenue ≤ montant négocié`, date de signature postérieure à la révélation (`03` C(29)). Le tableau de bord **n'additionne jamais des devises différentes** ; une affaire sans devise n'entre dans **aucun** agrégat et apparaît dans une liste « à compléter » |
| **3** | **Doublon** — deux demandes de données personnelles de la même personne, deux alertes du même code sur le même objet, deux notes identiques | Les demandes : la seconde est rattachée à la première, avec sa propre date de réception ; **le délai le plus court fait foi**. Les alertes d'état : une seule instance par (code, objet). Les notes : autorisées en double — une note est un point de vue daté, pas une donnée de référence |
| **4** | **Action concurrente** — deux agents sur la même entrée, deux confirmations d'une même action `2V`, deux rejeux du même lot | Entrée : verrou exclusif, le second voit « En cours — Marie » et **ne peut pas décider** (RG27 C2). Confirmation : la seconde ne produit **aucun second effet**, elle affiche « déjà confirmée à {heure} par {nom} ». Rejeu : idempotent (RG91) |
| **5** | **Droit insuffisant** — un `agent` tente une levée de suspension, un export, une anonymisation, ou modifie un plafond | **Refus côté serveur**, message clair nommant le rôle requis, **tentative journalisée** (RG110). Le bouton n'était de toute façon pas affiché, mais le masquage d'interface n'est jamais le contrôle |
| **6** | **Service externe indisponible** — Brevo, Apollo ou le Storage en panne | Le backoffice **reste utilisable**. Les blocs qui en dépendent affichent « information indisponible — dernière valeur connue à {heure} », jamais un zéro trompeur. Les rejeux restent en file, la demande de données personnelles **n'est pas close** tant que la propagation n'est pas confirmée (RG79) |
| **7** | **Agent qui abandonne en cours de parcours** — décision commencée, motif à moitié écrit, session expirée | Le verrou expire seul au bout de 30 min et l'entrée retourne en file. **La saisie non validée est perdue volontairement** (`08` cas limite) : une décision à moitié écrite ne doit pas orienter le second examinateur. Le brouillon d'une **note** ou d'un **motif de refus**, lui, est conservé le temps de la session (RG116) |
| **8** | **Annulation ou retour en arrière après validation** | **Correction avec trace, jamais effacement** (RG6). Une suspension se lève avec un motif ; un refus ne se défait pas, il se corrige et l'initiateur est réinformé (`13` RG46) ; un envoi d'e-mails s'annule **dans la fenêtre de 5 minutes**, jamais après ; une révélation d'identité ne s'annule **jamais** (`13` RG75) |

### Les cas limites propres au backoffice (`backoffice-ops` étape 10)

| Situation | Comportement attendu |
|---|---|
| **Agent absent, verrou orphelin** | Expiration automatique à 30 min, levée possible par un `admin` avec motif et trace, **titulaire dépossédé informé** (RG27 C3, C4) |
| **Reprise d'une affaire par un autre commercial** | Réattribution explicite et motivée, historique conservé, **changement d'interlocuteur annoncé dans le fil** (RG58, RG59) |
| **Agent qui quitte l'entreprise** | Réattribution **préalable et bloquante**, puis désactivation ; ses actions passées conservent son nom ; le compte n'est jamais supprimé (RG60, RG105) |
| **Suppression de compte demandée alors qu'une affaire est en cours** | Suppression logique + anonymisation ; **affaire, mise en relation, conversation et registre conservés pseudonymisés** ; le commercial responsable est prévenu **avant** exécution (RG75, étape 4 ; RG80). **Hypothèse conservatrice** — arbitre `expert-conformite-rgpd` (**veto**) |
| **Décision prise hors délai** | Toujours possible, **marquée comme telle**, jamais bloquée (RG27 C8) |
| **File vide contre file bloquée** | Deux états distincts et distinctement affichés (RG32) |
| **Rejeu d'un lot déjà rejoué** | Idempotent, aucun doublon (RG91) |
| **Seule personne de l'équipe, et elle est en congé** | Les files continuent de s'allonger et **les alertes de délai partent quand même** : le compte de secours (RG103) permet à un administrateur désigné d'accéder, chaque connexion étant alertée. Le délai annoncé aux membres (1 j ouvré) **ne s'auto-suspend pas** : si l'équipe ne peut pas le tenir, c'est la valeur en table qu'il faut changer, consciemment, pas le silence qu'il faut laisser s'installer |
| **Une demande `2V` confirmée trois jours plus tard** | Impossible : elle a expiré à 24 h, rien n'a été exécuté, le demandeur a été informé (RG31) |
| **Un seuil d'alerte manifestement faux** | Le volume d'instances ouvertes du même code dépasse 50 → alerte de second rang à l'`admin` (RG67). On corrige le seuil, on ne masque pas l'alerte |

### La checklist INFLUX de `feature-spec`

| # | Contrôle | Réponse |
|---|---|---|
| 1 | **Montants** | **Oui, partout.** Trois libellés imposés et jamais interchangeables — *montant négocié*, *commission convenue*, *commission encaissée* — toujours avec leur devise, **jamais de total toutes devises**, **jamais de net créateur** (il n'est calculé nulle part au MVP), **jamais de taux ni de multiplication** (RG4, RG5, RG19) |
| 2 | **Traçabilité** | **Risque business signalé explicitement.** Le backoffice est le seul endroit d'INFLUX où l'annuaire complet, identités et coordonnées comprises, est lisible. **Le vecteur de contournement n'est plus l'utilisateur, c'est l'interne.** Parades : export de l'annuaire impossible pour tous les rôles (§I), pagination plafonnée et défilement infini interdit (RG34), débit limité et recherche partielle journalisée (RG50), alerte sur volume anormal de fiches consultées (AL21), lecture de conversation journalisée avec motif, plafond d'exports (RG96) |
| 3 | **Leads** | **Aucune nouvelle collecte.** Le backoffice **lit** l'état de synchronisation et **rejoue**. Il **émet** trois événements seulement : `lead.updated` sur correction d'un champ (`05` RG108), `consent.revoked` et `account.deleted` sur demande de données personnelles, **tous deux en priorité** (RG79). **Ne partent jamais** vers Brevo ni Apollo : notes internes, motifs de suspension, alertes, états d'affaire, montants (RG70) |
| 4 | **Backoffice** | **C'est l'objet même du document.** |
| 5 | **Matching hybride** | **Aucun algorithme (D11).** Ce document ne touche ni au scoring, ni au tri des résultats de recherche. La **voie humaine** est intégralement tracée : chaque décision, chaque réattribution, chaque suspension, chaque lecture privilégiée porte son auteur, sa date et son motif — et **c'est ce corpus qui constituera le jeu de données de D11** |
| 6 | **Deux populations** | **Respecté :** fiche marque et fiche créateur sont **deux écrans distincts, jamais fusionnés** (RG39). Aucun écran de ce document ne sert simultanément un annonceur et un influenceur — ils n'y ont d'ailleurs pas accès |
| 7 | **Données personnelles** | **Avis d'`expert-conformite-rgpd` obligatoire (veto)** sur : §G en entier, RG48 (communicabilité des notes internes), RG81 (périmètre d'un export d'accès), RG80 (ce qui survit à un effacement, et sa mention dans la politique de confidentialité **dès le Lot 1**), RG71 (sixième type de demande), et les durées de conservation des alertes, des notes et du journal des exports |

---

## Critères d'acceptation

### Tableau de bord

**CA1** — *Étant donné* un commercial connecté, *quand* il ouvre le backoffice, *alors* le tableau de
bord affiche les cinq blocs de RG18 **dans l'ordre imposé**, avec la mention « arrêté à {heure} ».

**CA2** — *Étant donné* un chiffre quelconque du tableau de bord, *quand* on l'active au clavier ou à
la souris, *alors* la liste exacte qu'il compte s'ouvre, **déjà filtrée**, et le nombre de lignes
correspond au chiffre affiché.

**CA3** — *Étant donné* le tableau de bord, *quand* on tente d'y déclencher une validation, une
suspension, un envoi ou un rejeu, *alors* aucune de ces actions n'y est disponible (RG16).

**CA4** — *Étant donné* deux affaires encaissées dans deux devises différentes la même semaine,
*quand* le bloc « Ma semaine » s'affiche, *alors* **deux lignes distinctes** apparaissent, une par
devise, **et aucun total global n'est affiché**.

**CA5** — *Étant donné* le bloc « Ma semaine », *quand* on inspecte la réponse servie par l'API,
*alors* elle ne contient **aucun taux, aucun pourcentage et aucun net créateur**.

**CA6** — *Étant donné* une file sans aucune entrée en attente, *quand* le bloc « Les files »
s'affiche, *alors* la ligne indique « aucune entrée en attente — dernière traitée il y a {n} min »,
et **non** une valeur vide.

**CA7** — *Étant donné* une file qui ne reçoit plus d'entrée depuis 24 h ouvrées alors qu'elle en
reçoit habituellement, *quand* le tableau de bord s'affiche, *alors* l'état « bloquée » est affiché
**distinctement** de l'état « vide » et l'alerte **AL4** est ouverte.

**CA8** — *Étant donné* un administrateur, *quand* il ouvre son tableau de bord un lundi, *alors* le
bloc « Contrôles » est présenté en tête et son ouverture est journalisée.

**CA9** — *Étant donné* un administrateur qui consulte le classement des agents par nombre de
conversations lues, *quand* il l'affiche, *alors* **cette consultation est elle-même journalisée**.

### Catalogue et règles communes des files

**CA10** — *Étant donné* l'ensemble des files du backoffice, *quand* on exécute le contrôle
automatisé, *alors* **chaque file possède une ligne dans le catalogue de RG29 et une ligne dans
`backoffice.sla_policies`**, et une file manquante **fait échouer la vérification**.

**CA11** — *Étant donné* une entrée libre dans n'importe quelle file, *quand* un agent l'ouvre,
*alors* elle est **prise en charge automatiquement** et l'écran affiche « vous avez pris cette entrée
en charge à {heure} ».

**CA12** — *Étant donné* une entrée déjà prise en charge par Marie, *quand* un second agent l'ouvre,
*alors* il voit « En cours — Marie, depuis 09 h 42 », peut lire, **ne peut pas décider**, et
**aucune erreur technique n'est affichée**.

**CA13** — *Étant donné* une entrée prise en charge et laissée sans décision, *quand* 30 minutes se
sont écoulées, *alors* le verrou est libéré, l'entrée retourne en file, et l'abandon est journalisé
avec son titulaire et sa durée.

**CA14** — *Étant donné* un verrou orphelin, *quand* un administrateur le lève avec un motif typé,
*alors* la levée est journalisée **et le titulaire dépossédé est informé**.

**CA15** — *Étant donné* une file contenant des entrées hors délai, *quand* on l'affiche, *alors*
elles sont **en tête**, portent un **libellé écrit** (« Hors délai depuis {durée} »), et la
distinction **ne repose pas uniquement sur la couleur**.

**CA16** — *Étant donné* une entrée hors délai, *quand* un agent la décide, *alors* la décision est
**acceptée** et marquée comme tardive ; **à aucun moment la décision n'est bloquée**.

**CA17** — *Étant donné* n'importe quelle file, *quand* on énumère ses issues possibles, *alors* il en
existe exactement deux familles — favorable et défavorable avec motif typé — et **aucune mise en
attente**.

**CA18** — *Étant donné* une liste du backoffice, *quand* on la fait défiler jusqu'en bas, *alors*
une **pagination plafonnée** apparaît et **aucun chargement infini** ne se déclenche.

**CA19** — *Étant donné* un agent responsable d'un des comptes d'une entrée de file, *quand* la file
s'affiche pour lui, *alors* **cette entrée lui est masquée** ; *et quand* il tente de la décider par
son identifiant, *alors* le refus est prononcé côté serveur et journalisé.

**CA20** — *Étant donné* une demande de seconde validation non confirmée, *quand* 24 heures se sont
écoulées, *alors* elle expire, **rien n'est exécuté**, le demandeur est informé et l'expiration est
journalisée.

### Fiche de compte

**CA21** — *Étant donné* une fiche marque et une fiche créateur, *quand* on compare leurs écrans,
*alors* ce sont **deux écrans distincts** et il n'existe aucune vue mixte.

**CA22** — *Étant donné* l'ouverture d'une fiche, *quand* elle s'affiche, *alors* une ligne de journal
est écrite avec l'agent, la date et le compte consulté.

**CA23** — *Étant donné* une fiche, *quand* on inspecte la réponse servie par l'API, *alors* elle ne
contient **ni code de connexion, ni mot de passe, ni donnée enrichie par Apollo, ni contenu de
message**.

**CA24** — *Étant donné* le bloc « Conversations » d'une fiche, *quand* un agent ouvre un fil,
*alors* **un motif de lecture est exigé s'il n'est pas participant**, et **exactement une** ligne est
écrite dans le journal des lectures.

**CA25** — *Étant donné* une note interne enregistrée, *quand* un agent tente de la modifier ou de la
supprimer, *alors* l'opération est refusée et seule l'**ajout d'une nouvelle note** est possible.

**CA26** — *Étant donné* le champ de saisie d'une note interne, *quand* il s'affiche, *alors*
l'avertissement de RG48 est visible **au-dessus** du champ.

**CA27** — *Étant donné* une note interne, *quand* on examine ce qui part vers Brevo et Apollo,
*alors* **aucun attribut ne la contient ni ne la référence**.

**CA28** — *Étant donné* la correction d'un champ par un agent, *quand* elle est enregistrée, *alors*
l'ancienne et la nouvelle valeur, le motif et l'auteur sont journalisés **et le membre est notifié**.

**CA29** — *Étant donné* un compte dont le commercial responsable a changé deux fois, *quand* on
ouvre sa fiche, *alors* **les trois responsables successifs** sont visibles avec leurs dates.

**CA30** — *Étant donné* une recherche partielle de comptes, *quand* elle est exécutée, *alors* elle
est limitée en débit **et journalisée** ; *et quand* le seuil de fiches distinctes consultées sur
24 h est dépassé, *alors* **AL21** est ouverte.

### Suspension, réactivation, réattribution

**CA31** — *Étant donné* une demande de suspension par un agent, *quand* elle est soumise, *alors*
elle exige une **confirmation différée d'au moins 60 secondes** sur un écran distinct, avec
re-authentification, et la ligne porte le marqueur `dual_control: 'degraded_single_operator'` tant
qu'une seule personne opère.

**CA32** — *Étant donné* une suspension enregistrée, *quand* on inspecte ses effets, *alors* : les
sessions sont révoquées, le profil est dépublié, les entrées de file non décidées sont clôturées avec
le sous-motif attendu, **les conversations restent lisibles et l'écriture est fermée pour la partie
suspendue**, les affaires sont inchangées, et **aucun contact n'est supprimé chez Brevo ou Apollo**.

**CA33** — *Étant donné* une suspension, *quand* elle prend effet, *alors* le titulaire reçoit le
message associé au motif, **et l'autre partie d'une conversation en cours n'apprend ni la suspension
ni son motif**.

**CA34** — *Étant donné* une suspension pour `suspected_circumvention`, *quand* le titulaire est
notifié, *alors* le message est **neutre** et ne mentionne aucun soupçon de contournement.

**CA35** — *Étant donné* un agent, *quand* il tente de lever une suspension, *alors* l'action est
refusée : la levée est réservée au rôle `admin`, avec re-authentification.

**CA36** — *Étant donné* la levée d'une suspension motivée par `illicit_content`, *quand* elle est
enregistrée, *alors* le profil **repasse en file de validation** et n'est pas republié
automatiquement.

**CA37** — *Étant donné* la levée d'une suspension motivée par `account_holder_request`, *quand* elle
est enregistrée, *alors* le profil **retrouve exactement l'état qu'il avait** avant la suspension.

**CA38** — *Étant donné* un agent responsable d'au moins un compte, une mise en relation ou une
affaire, *quand* un administrateur tente de désactiver son compte, *alors* **la désactivation est
refusée** et l'écran **nomme** ce qui reste à réattribuer.

**CA39** — *Étant donné* une réattribution sur une mise en relation dont la conversation est ouverte,
*quand* elle est enregistrée, *alors* un changement d'interlocuteur **nommé** est annoncé dans le fil.

**CA40** — *Étant donné* une réattribution, *quand* elle est enregistrée, *alors* l'ancien responsable
**reste visible** dans l'historique, avec ses dates : rien n'est écrasé.

### Alertes

**CA41** — *Étant donné* le catalogue d'alertes, *quand* on l'énumère, *alors* **chaque alerte porte
un code, un seuil lu en table, un destinataire et une action** ; une alerte sans l'un des quatre
**fait échouer la vérification**.

**CA42** — *Étant donné* une alerte d'état dont la cause disparaît, *quand* la condition n'est plus
vraie, *alors* elle **se referme seule** et ne demande aucun classement.

**CA43** — *Étant donné* une alerte d'événement, *quand* un agent la traite, *alors* **un motif de
classement typé est exigé**, et l'alerte ne peut pas disparaître sans classement.

**CA44** — *Étant donné* une alerte quelconque, *quand* elle s'affiche, *alors* elle porte un
**libellé écrit** et n'est jamais distinguée par la seule couleur.

**CA45** — *Étant donné* une détection de coordonnées dans un fil, *quand* l'alerte est levée,
*alors* **aucun masquage, aucun blocage et aucune sanction** ne se produisent automatiquement.

**CA46** — *Étant donné* plus de 50 instances ouvertes d'un même code d'alerte, *quand* le contrôle
s'exécute, *alors* une alerte de second rang part à l'administrateur.

**CA47** — *Étant donné* une connexion sur le compte de secours, *quand* elle réussit, *alors* une
alerte **immédiate** part au fondateur **et** une ligne d'audit est écrite.

### Demandes relatives aux données personnelles

**CA48** — *Étant donné* une demande reçue par e-mail et saisie par un agent, *quand* elle est
enregistrée, *alors* une entrée de file est créée avec sa date de réception, son canal, et
`due_at` = réception + 30 jours **calculé une fois et figé**.

**CA49** — *Étant donné* une demande dont l'identité du demandeur n'est pas établie, *quand* un
administrateur tente de l'exécuter, *alors* l'exécution est **refusée** tant que la méthode et la date
de vérification ne sont pas enregistrées.

**CA50** — *Étant donné* un agent, *quand* il tente d'exécuter un export ou une anonymisation,
*alors* l'action est refusée : l'exécution est réservée au rôle `admin`, avec `2V` et
re-authentification.

**CA51** — *Étant donné* une demande d'effacement, *quand* elle est exécutée, *alors* `account.deleted`
part **en priorité** vers Brevo et Apollo, **et la demande ne peut pas être close** tant que les deux
destinations n'ont pas confirmé ou qu'un échec définitif n'est pas journalisé.

**CA52** — *Étant donné* une demande d'effacement sur un compte engagé dans une affaire en cours,
*quand* elle est instruite, *alors* **le commercial responsable est prévenu avant exécution**, et
après exécution la mise en relation, l'affaire, la conversation et le registre subsistent **sous forme
pseudonymisée**.

**CA53** — *Étant donné* une réponse à une demande d'effacement, *quand* elle est rédigée, *alors*
elle **énonce les cinq catégories** conservées et le motif de leur conservation.

**CA54** — *Étant donné* un export produit au titre d'un droit d'accès, *quand* on inspecte son
contenu, *alors* il ne contient **ni note interne portant sur un tiers, ni pièce de vérification, ni
motif interne, ni journal des lectures d'autres personnes**, et le texte écrit par l'autre partie
d'une conversation en est **absent** (hypothèse de RG81).

**CA55** — *Étant donné* une opposition au marketing, *quand* elle est enregistrée, *alors*
`consent.revoked` part immédiatement en priorité, **et un envoi préparé au backoffice écarte cette
adresse au moment de l'envoi**, pas au moment de la sélection.

**CA56** — *Étant donné* un agent, *quand* il tente de modifier le consentement marketing d'un membre,
*alors* l'action est refusée pour tous les rôles internes.

**CA57** — *Étant donné* une demande à 7 jours de son échéance, *quand* le contrôle quotidien
s'exécute, *alors* **AL40** est ouverte à destination de l'administrateur.

### Actions de masse et exports

**CA58** — *Étant donné* une action de masse quelconque, *quand* elle est préparée, *alors* le
plafond, la sélection exacte, la conséquence et **la réversibilité** sont affichés **avant** la
confirmation, et la confirmation est **séparée** du geste de sélection.

**CA59** — *Étant donné* un lot de 10 dont 3 échouent, *quand* il s'exécute, *alors* **les 7 qui ont
réussi subsistent**, et le compte rendu **nomme** les 3 écartés avec leur raison.

**CA60** — *Étant donné* un lot exécuté, *quand* on consulte le registre, *alors* **une ligne décrit
le lot** : auteur, horodatage, contenu, résultat.

**CA61** — *Étant donné* la file `introductions`, *quand* on sélectionne plusieurs entrées, *alors*
**aucune action de validation ou de refus en lot n'est disponible**.

**CA62** — *Étant donné* un envoi d'e-mails confirmé, *quand* il est annulé **dans les 5 minutes**,
*alors* rien ne part ; *et quand* l'annulation intervient après, *alors* elle est refusée avec un
message explicite.

**CA63** — *Étant donné* n'importe quel rôle, y compris `admin`, *quand* il cherche à exporter la
liste des membres, *alors* **aucun export nominatif de l'annuaire n'est disponible**, sous aucune
forme.

**CA64** — *Étant donné* un export autorisé, *quand* il est produit, *alors* une ligne de registre
porte l'auteur, la date, le type, **les filtres exacts**, le nombre de lignes et **l'empreinte du
fichier**.

**CA65** — *Étant donné* un export, *quand* il est livré, *alors* il l'est par un **lien à usage
unique et de courte durée**, jamais en pièce jointe.

**CA66** — *Étant donné* un compte interne ayant déjà produit 5 exports dans la journée, *quand* il
en demande un sixième, *alors* la demande est refusée avec un message clair et **AL21** est ouverte.

### Comptes internes

**CA67** — *Étant donné* le backoffice, *quand* on cherche un parcours d'inscription, *alors* il
n'en existe aucun : un compte se crée **uniquement par invitation** d'un administrateur.

**CA68** — *Étant donné* un compte interne nouvellement créé, *quand* il se connecte la première fois,
*alors* **l'inscription du second facteur est imposée avant tout accès aux données**.

**CA69** — *Étant donné* un administrateur, *quand* il tente de modifier son propre rôle, son propre
plafond ou de lever sa propre suspension, *alors* l'action est refusée **en base**.

**CA70** — *Étant donné* une réinitialisation de second facteur, *quand* elle est exécutée, *alors*
elle l'est par un **autre** administrateur, avec vérification hors bande enregistrée, notification à
tous les administrateurs, **et le compte ne peut exécuter aucune action irréversible pendant 24 h**.

**CA71** — *Étant donné* qu'il n'existe qu'un seul administrateur actif, *quand* on ouvre le
backoffice, *alors* le bandeau de RG107 est affiché en permanence.

**CA72** — *Étant donné* l'arrivée d'un second administrateur actif, *quand* une action sensible est
demandée, *alors* la **double validation par un pair** s'applique **sans changement de code**, et le
mode dégradé cesse.

### Interdits, densité et accessibilité

**CA73** — *Étant donné* chacune des 21 lignes du tableau de RG109, *quand* le test correspondant
s'exécute, *alors* l'opération **échoue**, et elle échoue **en base** lorsque c'est la base qui doit
l'empêcher.

**CA74** — *Étant donné* une action refusée pour droit insuffisant, *quand* elle est tentée, *alors*
un message clair est affiché, **la tentative est journalisée**, et aucune trace technique n'apparaît
dans la réponse.

**CA75** — *Étant donné* une file, *quand* on ne se sert que du clavier, *alors* on peut **naviguer,
ouvrir, valider, refuser avec motif, annoter, relâcher le verrou et passer à l'entrée suivante** sans
souris, avec un focus toujours visible.

**CA76** — *Étant donné* le raccourci de validation, *quand* il est pressé sur une validation
**révélante** (`13` RG43), *alors* il **ouvre le récapitulatif** et ne valide pas.

**CA77** — *Étant donné* un message d'erreur, *quand* il s'affiche, *alors* il reste visible au moins
6 secondes ou jusqu'à fermeture explicite.

**CA78** — *Étant donné* n'importe quel écran du backoffice, *quand* on l'audite, *alors* tous les
contrastes respectent **WCAG AA**, **aucune couleur ni aucun espacement n'est écrit en dur**, et
aucun état n'est porté par la seule couleur.

**CA79** — *Étant donné* l'adresse d'une liste filtrée, *quand* on l'examine, *alors* elle contient
des codes et des identifiants **et aucune donnée personnelle**.

**CA80** — *Étant donné* un brief ou un message contenant une balise HTML écrite par un membre,
*quand* il s'affiche dans le backoffice, *alors* il apparaît **en texte brut** et rien n'est exécuté.

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Écran | Remarque |
|---|---|
| **Tableau de bord `agent`** — cinq blocs de RG18 | Tout chiffre cliquable (RG15) ; lecture seule (RG16) |
| **Tableau de bord `admin`** — trois blocs supplémentaires | Le bloc « Contrôles » en tête le lundi (RG22) |
| **Gabarit commun de file** — liste dense, filtres communs, compteurs permanents, états vide / bloquée | **Un seul gabarit pour les 16 files** (15 au corps du document, plus `email_send_failures`, RG125). C'est ce qui rend les raccourcis clavier apprenables |
| **Fiche marque** — 11 blocs de RG41 | Bloc « Interlocuteur » visible des seuls rôles internes |
| **Fiche créateur** — RG42 | Pièces de vérification relayées par l'API, consultation journalisée |
| **Panneau de suspension** — motif typé + message prévisualisé + confirmation différée | Le message envoyé au titulaire est **montré avant** l'exécution |
| **Panneau de réattribution** et **écran de transfert de portefeuille** | Aperçu chiffré, historique visible |
| **Centre d'alertes** — catalogue filtrable, distinction état / événement, classement motivé | Actionnable, sinon elle n'a rien à y faire |
| **File et fiche « demandes de données personnelles »** — sept étapes de RG75 | L'écran porte la preuve du traitement |
| **Écran de confirmation différée** (`2V` et mode dégradé) | Récapitulatif intégral, compte à rebours visible, re-authentification |
| **Gestion des comptes internes** — invitation, rôles, plafonds, désactivation, second facteur | Refus de désactivation tant qu'il reste des responsabilités |
| **Écran d'export** — liste fermée E1 à E4, motif, re-authentification | Aucun export nominatif de l'annuaire |
| **E-mails** — suspension, levée, réponse à une demande de données, récapitulatif quotidien de l'agent | Bilingues, transactionnels |

### Données (`expert-database`) — **écarts constatés avec `04`, non corrigés ici**

> `docs/mvp/04-modele-de-donnees-mvp.md` est en cours de correction par un autre agent. **Ce document
> ne le modifie pas** : il signale.

1. **Aucune table de référence des files.** RG26 exige que « une file absente du catalogue n'existe
   pas » soit **vérifiable**. Il manque `backoffice.queues` (`queue_code` PK, libellé, document de
   référence, rôles habilités, action de masse autorisée, `is_active`), avec une clé étrangère depuis
   `backoffice.sla_policies`. Sans elle, la règle reste un vœu.
2. **`backoffice.account_suspensions.reason_code` n'a pas de table de motifs.** Il manque
   `backoffice.suspension_reasons` (liste fermée de RG52, avec le message au titulaire et l'indicateur
   d'escalade) et `lift_reason_code` avec sa liste (RG55).
3. **`backoffice.internal_notes` est sous-spécifiée** : il manque `subject_type` (liste fermée :
   compte, mise en relation, affaire, campagne, demande), `author_account_id`, et le déclencheur
   d'ajout seul. « Immuable » doit être garanti en base, pas par convention.
4. **`backoffice.data_subject_requests` est incomplète** au regard du §G : il manque
   `requester_account_id` (nullable — un demandeur n'est pas toujours un membre), `channel`
   (`self_service` · `email` · `oral_consigne`), `identity_verified_at`,
   `identity_verification_method`, `scope_note`, `refusal_reason_code`, `response_sent_at`,
   `response_provider_message_id`, et la **liste fermée** de `outcome_code` (RG77).
5. **Aucune table d'alertes.** Les 41 alertes de §F n'existent aujourd'hui que sous forme de requêtes
   dérivées éparpillées dans dix documents. Il manque `backoffice.alert_definitions` (code, libellé,
   nature état/événement, seuil, destinataire, `is_active`) et `backoffice.alert_instances` pour les
   **alertes d'événement** (code, objet visé, `opened_at`, `acknowledged_by`, `closed_at`,
   `closure_reason_code`). Sans instances, RG64 et RG69 ne sont pas implémentables.
6. **Aucune table des demandes de double validation.** `03` PD4 décrit les colonnes
   (`requested_by`, `requested_at`, `confirmed_by`, `confirmed_at`, marqueur `dual_control`) mais
   aucune table ne les porte. Il manque `backoffice.dual_control_requests` (`action_code` en liste
   fermée, charge utile, `expires_at`, état), sans quoi la file 15 et RG31 n'ont rien à interroger.
7. **Aucune table des exports.** RG94 exige auteur, filtres exacts, nombre de lignes et **empreinte
   du fichier** : il manque `backoffice.exports`.
8. **`identity.agent_profiles` doit porter** : `is_active`, `deactivated_at`, `deactivated_by`,
   `is_break_glass`, `absence_from`, `absence_to`. RG60, RG62, RG103 et RG105 en dépendent.
9. **`operational_settings.claim_expiry_minutes` est une clé globale** alors que l'expiration de
   verrou pourrait devoir différer par file. À confirmer : global (position actuelle, cohérente avec
   les six documents qui écrivent tous « 30 minutes ») ou par `queue_code`.
10. **Le type `restriction`** figure dans `data_subject_requests.request_type` (`04` §5.10) mais pas
    dans les cinq droits cités par `CLAUDE.md` §9. À trancher (**Q6**).
11. **Durées de conservation manquantes au §9.1 de `04`** pour trois catégories créées ici : notes
    internes, instances d'alerte, journal des exports. Proposition à soumettre à
    `expert-conformite-rgpd` : notes internes alignées sur la vie du compte, alertes 24 mois, journal
    des exports **sans purge** (il vit dans le registre).
12. **Codes d'événement à ajouter** à `audit.event_types` : `account.suspended`,
    `account.suspension_lifted`, `account.note_added`, `account.field_corrected`,
    `ownership.reassigned`, `ownership.bulk_transferred`, `queue.claim_forced_release`,
    `alert.acknowledged`, `alert.closed`, `dual_control.requested`, `dual_control.confirmed`,
    `dual_control.expired`, `export.produced`, `privacy.request_received`,
    `privacy.identity_verified`, `privacy.request_executed`, `privacy.request_closed`,
    `agent.invited`, `agent.role_changed`, `agent.deactivated`, `agent.mfa_reset`,
    `agent.break_glass_login`, `settings.changed`.

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Brevo — transactionnel** | E-mails de suspension et de levée, réponse à une demande de données personnelles, récapitulatif quotidien de l'agent, alertes immédiates. Bilingues, rejoués, échecs visibles avec rejeu manuel |
| **Brevo — contacts** | `lead.updated` sur correction, `consent.revoked` et `account.deleted` **en priorité** (RG79, RG83). **Aucun attribut nouveau.** Notes, alertes, suspensions, montants **ne partent jamais** (RG70) |
| **Apollo.io** | **Aucun attribut nouveau.** Périmètre inchangé (**D33**). Propagation de l'effacement et de l'opposition, comme pour Brevo |
| **Supabase** | Verrous par transition conditionnelle, registre en ajout seul, fonction journalisante de lecture de conversation, lecture des pièces relayée par l'API, index de file, paramètres en table |
| **Storage** | Les exports produits vivent dans un compartiment privé, livrés par lien court à usage unique, émission journalisée (RG95) |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| **Mises en relation traitées par commercial et par semaine** | **L'indicateur du passage à l'échelle** (RG20). Mesuré dès le Lot 5 |
| **Délai de prise en charge** et **de décision** (médian et 9ᵉ cas sur 10), **par file** | Prise en charge 4 h ouvrées, décision **1 j ouvré** (**D39**) |
| **Part des décisions hors délai, par file** | Alerte dès le premier dépassement ; tendance suivie chaque semaine |
| **Ancienneté de la plus ancienne entrée, par file** | Alerte au-delà de **2 ×** le délai de la file |
| **Nombre de files hors catalogue détectées** | **Doit rester à zéro** (RG26) |
| **Commission convenue et commission encaissée, par devise** | Mesurées ; **leur écart est l'indicateur financier du pilote** (`00` §10.2) |
| **Affaires révélées sans état d'affaire à 30 jours** | Signal de contournement **ou** de saisie négligée |
| **Part du motif « autre »**, par liste de motifs | **Sous 10 %** (RG8) |
| **Part de `faux_positif` dans le classement des alertes**, par code | Au-delà de 30 %, le seuil est mal réglé |
| **Nombre d'actions passées en contrôle affaibli** par semaine | Mesuré et **lu** chaque lundi (RG22). Doit tomber à zéro à l'arrivée du second administrateur |
| **Conversations distinctes lues par agent sur 7 jours**, dont non participant | Revue humaine hebdomadaire (`03` X4) |
| **Délai de traitement des demandes de données personnelles** | **100 % sous 30 jours**, objectif interne 10 jours ouvrés |
| **Nombre d'exports produits, par type et par personne** | Mesuré ; une série est un signal (RG96) |
| **Échecs de synchronisation non traités** | **Cible : zéro** (`05` RG105) |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| **Le contenu de chaque file** : critères, motifs, messages, écrans de décision | Chaque file a son document (`05` à `13`). Ce document les fédère, il ne les réécrit pas | — |
| **Le pipeline commercial** : états d'affaire, saisie des montants, relances, rapprochement, export comptable détaillé | `01` §6, puis le document dédié du Lot 5 (`expert-paiement-facturation`). Ce document n'en affiche que les agrégats | Lot 5, en parallèle |
| **L'envoi d'e-mails Brevo depuis le backoffice** : sources, bases légales, segments, contenus, plafonds | **A4**, **D35** (veto `expert-conformite-rgpd`), document attendu de `expert-marketing`. Ce document n'en fixe que le cadre d'action de masse (M3) et de plafond par rôle | Lot 5 |
| **Le calcul, la facturation et l'encaissement de la commission** | **A1**, `CLAUDE.md` §3 | **V2**, avec **D9** et **D25** |
| **L'algorithme de mise en relation et tout score** | **D11** : aucune donnée pour le régler. Le pilote la produit | Après le pilote |
| **Les portefeuilles de clients cloisonnés par commercial** | Au MVP, tous les commerciaux voient tout ; **le responsable est déjà enregistré partout** (RG10) | Dès que l'équipe le justifie : un changement de règle d'accès |
| **Les droits fins par agent** (au-delà de `agent` / `admin`) | Confort ; deux rôles suffisent à une équipe de deux ou trois personnes | Quand l'équipe le justifie |
| **Les statistiques avancées, tableaux de bord personnalisables, rapports programmés** | Confort. Le besoin réel est d'agir, pas de contempler | Après le pilote |
| **La messagerie temps réel et les notifications poussées au backoffice** | Le rafraîchissement suffit au volume du pilote (`12` RG100) | Après le pilote |
| **Le score de contournement pondéré calculé chaque nuit** | Trop lourd et prématuré : le commercial est dans le fil (`01` M6) | Après le pilote |
| **La gestion des pays ouverts aux contrats** | Sans contrat dans l'application, l'objet n'a pas de sens (`13` RG11) | **V2**, avec **D26** |
| **La réattribution automatique en cas d'absence** | Ferait plus de dégâts qu'elle n'en éviterait sur une équipe de deux (RG62) | Quand l'équipe dépasse 3 commerciaux |
| **L'export nominatif de l'annuaire, sous toute forme** | **Interdit** : ce serait offrir la base à un concurrent (`03` C(17)) | **Jamais** |
| **Portugais et autres langues** | Français et anglais ; backoffice en français en valeur d'attente (**D36**) | Avant l'ouverture du Brésil |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **Contradiction entre `05` RG106 (export admin de la liste des inscrits) et `03` C(17) (export de l'annuaire interdit à tous)**. La liste des inscrits *est* l'annuaire : les deux règles ne peuvent pas coexister | **`05` RG106 abrogé** (RG92). Le besoin est couvert par l'export agrégé E4, sans ligne nominative | `chef-de-projet` + **`expert-cybersecurite` (veto)** | **Avant le Lot 5** |
| **Q2** | **SLA de la file des contestations de badge** : `08` RG77 fixe un délai de recevabilité de 30 jours mais **aucun délai de traitement** | **5 jours ouvrés** (RG29, file 5). Plus long que les autres files, parce qu'une contestation demande un réexamen, pas un examen | **Fondateur** + `product-owner`, rattaché à **D39** | Lot 5 |
| **Q3** | **SLA de la file « sélection par l'équipe INFLUX »** : `10` RG84 parle d'un « délai paramétré » sans jamais en fixer la valeur | **1 jour ouvré**, aligné sur les autres files. C'est un lead qualifié dont le brief est écrit : le faire attendre est le plus coûteux des retards | **Fondateur** + `chef-de-projet`, rattaché à **D39** | Lot 5 |
| **Q4** | **SLA des files `lead_sync_failures` et `email_delivery_incidents`** : `05` fixe des objectifs de synchronisation (1 h, 24 h) mais **aucun délai de traitement d'un échec**. Or `05` RG105 pose une cible de **zéro échec non traité** | **2 jours ouvrés**. En deçà, l'objectif est irréaliste ; au-delà, « zéro échec non traité » n'a plus de sens. Depuis **D37**, une adresse injoignable est un **compte inaccessible**, pas une gêne marketing : ce délai n'est pas confortable | **Fondateur** + `expert-integrations-api` | Lot 5 |
| **Q5** | **Harmonisation du tri par défaut.** `06`, `07`, `08`, `09` écrivent « ancienneté croissante » ; `13` RG19 écrit « échéance croissante ». Les deux donnent le même ordre **tant que le délai est uniforme dans une file** — ce qui est faux pour `campaigns` (1 j / 2 j en revue renforcée) | **Échéance croissante partout** (RG27 C5). C'est le seul tri qui reste juste quand deux délais coexistent | `product-owner` + `expert-ux` | Lot 5 |
| **Q6** | **Le droit à la limitation du traitement est-il dans le périmètre ?** `04` §5.10 le prévoit (6 types) ; `CLAUDE.md` §9 en cite cinq | **Oui, retenu** : coût marginal nul puisque la table le prévoit, et son absence serait un manquement. `CLAUDE.md` §9 est à compléter | **`expert-conformite-rgpd` (veto)** | Lot 5 |
| **Q7** | **Périmètre d'un export au titre du droit d'accès** : le texte écrit par l'autre partie d'une conversation en fait-il partie ? Et les **notes internes** sont-elles communicables ? | **Hypothèse conservatrice** : messages de l'autre partie **exclus**, métadonnées incluses ; **notes internes communicables** (RG48), l'écran prévenant l'agent avant qu'il écrive | **`expert-conformite-rgpd` (veto)** + juriste | **Lot 5, avant la première demande réelle** |
| **Q8** | **Modération en lot des visuels de portfolio** (M4) : accepter ou refuser jusqu'à 20 visuels **d'un même profil** avec un motif commun est-il compatible avec l'examen visuel par visuel exigé par `07` RG97 ? | **Oui, limité à un seul profil et à un motif commun.** C'est la file la plus répétitive du MVP ; l'examen reste individuel, seule la saisie est groupée | `product-owner` + `expert-ux` | Lot 5 |
| **Q9** | **Durées de conservation** des notes internes, des instances d'alerte, du journal des exports et du journal des actions internes | Notes alignées sur la vie du compte ; alertes **24 mois** ; journal des exports **sans purge** (il vit dans le registre) | **`expert-conformite-rgpd` (veto)** | Lot 5 |
| **Q10** | **Expiration du verrou : globale ou par file ?** `operational_settings.claim_expiry_minutes` est une clé unique, alors que `sla_policies` est par file | **Globale à 30 minutes**, cohérente avec les six documents qui l'écrivent déjà. À revoir si une file démontre un besoin différent | `architecte` + `expert-database` | Lot 5 |
| **Q11** | **Seuils non calibrés** : 50 instances d'alerte avant alerte de second rang, 5 exports par jour, 24 h d'expiration d'une demande `2V`, 6 s d'affichage minimal d'une erreur, fiches distinctes consultées par 24 h | Valeurs ci-contre, **toutes en table**, recalibrées après un mois d'exploitation | `product-owner` + `chef-de-projet` | Réglage à 3 mois |
| **Q12** | **Langue du backoffice (D36)** : les motifs typés, alertes et libellés de file sont-ils traduits dès le premier jour ? | Français en valeur d'attente ; **les motifs et leurs messages aux membres existent dans les deux langues dès le premier jour**, parce qu'ils sortent du backoffice | **Fondateur** | Lot 5 |
| **Q13** | **Deux comptes distincts, ou étape d'élévation, pour la personne qui cumule `agent` et `admin`** (RG108) | À trancher. **Les deux sont acceptables ; l'absence des deux ne l'est pas** | **Fondateur** (`03` F-5) | **Lot 0** |
| **Q14** | **Que dit-on aux utilisateurs de la lecture possible par un administrateur du projet Supabase**, hors de tout journal (RG111) ? | Limite écrite et assumée en interne ; **non mentionnée dans l'information aux utilisateurs en l'état** | **Fondateur** + **`expert-cybersecurite` (veto)** | Avant le Lot 6 |
| **Q15** | **Le délai annoncé aux membres doit-il être suspendu pendant une absence de toute l'équipe** (congés, jour férié non couvert par `business_hours`) ? | **Non.** `business_hours` couvre déjà les jours ouvrés ; au-delà, **un délai affiché puis non tenu abîme plus la confiance qu'un délai plus long tenu** (**D39**). Si l'équipe ne peut pas tenir, on change la valeur en table, consciemment | **Fondateur** + `chef-de-projet` | Lot 5 |

---

**Ce document ne modifie aucun autre fichier.** Les douze écarts du modèle de données sont adressés à
`expert-database` ; les tests attendus sont adressés à `testeur` (document `18`) ; la mise à jour de
`CLAUDE.md` §13 relève de `chef-de-projet` ; la validation de §G relève d'`expert-conformite-rgpd`
(**veto**) et celle de §I, §J et §K d'`expert-cybersecurite` (**veto**).

---

## Additif du document 16 (2026-09-19)

> **Auteur de l'additif :** `expert-integrations-api`, sur demande de `chef-de-projet`.
> **Objet :** raccorder `docs/mvp/16-backoffice-emails-brevo.md` (volet e-mails du Lot 5) au
> présent document, qui fédère les files, les alertes, les actions de masse et les plafonds.
> **Il répond à la question ouverte Q9 de `16` et aux cinq écarts que `16` a relevés avec `15`.**
>
> **Convention de numérotation :** le corps du document s'arrête à **RG124**. L'additif utilise
> **RG125 à RG131**, sans aucun suffixe `bis` et **sans toucher à la numérotation existante**.
> Les alertes reprennent la série `AL…` du §F, à partir d'**AL42**. La nouvelle file prend le
> numéro **16** dans le catalogue de RG29. *(Corrigé le 2026-09-24 : le numéro 14 d'origine était
> déjà pris par `data_subject_requests` — `17b` I1. Le catalogue compte 16 files.)*
>
> **Ce que cet additif ne fait pas :** il ne réécrit aucune règle existante. Là où il complète une
> règle (RG29, RG86, RG104, RG109), il le dit explicitement et cite la règle complétée. Le
> **contenu** du périmètre e-mail — sources, bases légales, modèles, cadence, contrat Brevo —
> reste spécifié par `16`, qui fait autorité sur ces sujets.

### RG125 — Une seizième file au catalogue de RG29 : `email_send_failures`

**RG125** — Les échecs d'envoi d'e-mails forment une file, et cette file **figure au catalogue**.
Sans elle, elle serait **orpheline** au sens de RG26 : personne n'en mesurerait le délai, personne
ne saurait qui doit la traiter, et elle s'allongerait sans que quiconque le voie.

| # | `queue_code` | File | Ce qui y entre | Spécifiée par | Délai de décision | Objectif interne de prise en charge | Verrou | Qui traite | Action de masse |
|---|---|---|---|---|---|---|---|---|---|
| **16** | **`email_send_failures`** | **Échecs d'envoi d'e-mails** | Ligne en échec définitif d'un envoi du backoffice **ou** d'un e-mail transactionnel (`16` §K) | **`16`** RG126 à RG130 | **2 j ouvrés** *(aligné sur Q4)* | — | **Aucun** (même régime que `lead_sync_failures`, RG30) | `agent`, `admin` | **Oui** — rejeu en lot, **plafond 200**, idempotent |

Trois précisions qui évitent les confusions les plus probables :

1. **Elle est distincte de `lead_sync_failures`** (file 12). Celle-ci porte les échecs de
   *synchronisation de contact* ; la nouvelle porte les échecs d'*envoi d'e-mail*. Les confondre
   ferait disparaître les seconds derrière les premiers.
2. **Un échec définitif d'e-mail de confirmation de mise en relation y entre**, et il déclenche en
   plus **AL10** : une mise en relation sans e-mail confirmé est **sans preuve externe**
   (`13` RG80). C'est la seule entrée de cette file qui ait une conséquence probatoire.
3. **Une ligne « écartée » n'y entre jamais** — sans consentement, hors cadence, désinscrit : ce
   sont des **cas normaux**, jamais des échecs (`05` RG100, `16` RG23, RG130). Le compteur de cette
   file ne mélange pas les deux, faute de quoi il deviendrait illisible en une semaine.

### RG126 — Sept alertes de plus au catalogue du §F : AL42 à AL48

**RG126** — Les alertes qui suivent complètent le catalogue de RG68, dans le même format et sous le
même régime : **un code, un seuil écrit en table, un destinataire nommé, une action possible**
(RG63). Aucune n'est portée par la seule couleur (RG66), aucune ne déclenche de sanction
automatique (RG65) — **à une exception près, AL42, explicitée ci-dessous**.

| Code | Alerte | Seuil de départ (en table) | Nature | Destinataire | Action attendue | Source |
|---|---|---|---|---|---|---|
| **AL42** | **Taux de plainte pour spam au-delà du seuil** | **0,3 %** sur 24 h glissantes, toutes sources marketing confondues | Événement | **`admin` + fondateur**, immédiatement | **L'interrupteur d'urgence s'est déjà activé** : instruire, puis lever à la main | `16` RG123 |
| **AL43** | **Taux de rebond dur au-delà du seuil** | **5 %** sur un envoi, ou **2 %** sur 24 h | Événement | `admin` | Nettoyer la source, vérifier la provenance des adresses | `16` RG123 |
| **AL44** | **Quota Brevo proche ou atteint** | **80 %** d'une des trois catégories d'appel | État | `admin` | Étaler les envois, ou revoir le palier de l'offre | `16` RG128 |
| **AL45** | **Interrupteur d'urgence actif** | Dès l'activation, automatique ou manuelle | État | **Tous les rôles internes + fondateur** | Traiter la cause, puis lever avec motif | `16` RG121, RG124 |
| **AL46** | **Modèle d'e-mail modifié chez Brevo depuis sa validation** | Écart d'empreinte constaté avant un envoi | Événement | `admin` | Relire et revalider. **L'envoi est refusé en attendant** | `16` RG69 |
| **AL47** | **Envoi bloqué par écart de volume** | **10 %** ou **50 destinataires**, le plus petit des deux | Événement | **L'auteur de l'envoi + `admin`** | Reconfirmer en connaissance de cause, ou abandonner | `16` RG31 |
| **AL48** | **Délivrabilité du code de connexion hors seuil** | Délai médian > **60 s** · 9ᵉ cas sur 10 > **180 s** · demandes sans connexion aboutie sous 10 min > **15 %** · part « délivrés » < **97 %** | État | **`admin`, immédiatement** | **Incident : des gens ne peuvent pas entrer dans leur compte** (**D37**) | `16` RG98, RG99 |

**Deux remarques qui valent d'être écrites :**

- **AL42 est la seule alerte du catalogue qui déclenche une action automatique** — la suspension
  des envois marketing. Elle ne contredit pas RG65 (« aucune alerte ne déclenche de sanction
  automatique ») : **aucune personne n'est sanctionnée**, c'est INFLUX qui cesse d'écrire. La
  suspension est conservatrice, et **la reprise, elle, est toujours humaine** (`16` RG124).
- **AL48 est la plus importante des sept, et de loin.** Les six autres protègent du chiffre
  d'affaires ; celle-ci protège l'accès au produit. Elle a sa place au **bloc 7** du tableau de
  bord `admin` (RG21), en tête.

### RG127 — Ce qui rend l'annulation d'un envoi de masse réelle (complète M3, RG86)

**RG127** — L'action de masse **M3 (envoi d'e-mails Brevo)** est complétée par trois mécanismes,
sans lesquels sa « fenêtre d'annulation de 5 minutes » et sa « réversibilité annoncée » seraient
des promesses creuses :

1. **Rien n'est transmis à Brevo pendant la fenêtre.** C'est le seul mécanisme qui rende
   l'annulation réelle plutôt que cosmétique. Un envoi déjà transmis puis « annulé » chez nous
   serait un envoi parti (`16` RG28).
2. **N'importe quel `agent` ou `admin` peut annuler, pas seulement l'auteur**, depuis un bandeau
   présent sur **tous** les écrans du backoffice. Un incident se constate parfois par-dessus
   l'épaule du voisin. Fermer son navigateur n'annule rien et n'empêche pas d'annuler depuis un
   autre poste.
3. **Le périmètre est recalculé à la fin de la fenêtre**, et **l'envoi est bloqué si le volume
   s'écarte de plus de 10 % ou 50 destinataires** du volume confirmé (AL47, `16` RG30 et RG31).
   Cinq minutes suffisent à ce que des gens se désinscrivent ; un écart de cette ampleur signifie
   que le périmètre n'était pas celui qu'on croyait.

La colonne « Réversibilité annoncée » de M3 reste exacte — « irréversible passé la fenêtre, dit en
toutes lettres avant l'envoi » — et RG127 dit **par quel mécanisme** elle est vraie.

### RG128 — Trois plafonds de plus pour les envois d'e-mails (complète RG104)

**RG128** — La ligne « Destinataires par envoi d'e-mails, et par jour » de RG104 est **insuffisante
pour la saisie libre**, où le risque n'est pas le volume d'un envoi mais **l'accumulation**. Trois
plafonds s'y ajoutent, tous en table, tous modifiables par `admin` seulement, avec `2V` et
journalisation, **jamais sur son propre compte** :

| Plafond | Valeur d'attente `agent` | Valeur d'attente `admin` | Table | Pourquoi |
|---|---|---|---|---|
| Envois de prospection par **mois glissant** | **50** | **100** | `email_send_limits` | Sans lui, dix par jour font deux cents par mois : la campagne déguisée est reconstituée par accumulation |
| Envois par **organisation (domaine)** sur 90 jours | **3** | **3** | `email_send_limits` | Trois personnes d'une même entreprise, pas tout l'organigramme |
| **Sollicitations par adresse** | **1, définitivement** | **1** | Index d'unicité | **Aucune relance de prospection au MVP** : elle double le risque juridique pour un gain marginal (`16` RG55) |

Ces valeurs relèvent de **D35** (`expert-conformite-rgpd`, **veto**, et fondateur) : ce sont des
**valeurs d'attente conservatrices**, jamais des constantes de code.

### RG129 — Ce qui empêche un envoi de masse sans double confirmation (complète l'interdit 10 de RG109)

**RG129** — La ligne 10 du tableau de RG109 — « Envoyer un e-mail de masse sans double
confirmation » — cite « contrainte de base sur `email_sends`, fenêtre d'annulation ». **Une
interdiction sans mécanisme n'est qu'un vœu** (RG109) : voici les quatre mécanismes qui la rendent
vraie, à faire figurer dans la colonne « ce qui l'empêche ».

| Mécanisme | Effet |
|---|---|
| **Deux gestes de nature différente** — une case explicite **puis** la ressaisie au clavier du volume ou du nom du segment, dans un champ qui refuse le collage et l'auto-complétion | Interdit la confirmation réflexe en deux clics au même endroit |
| **Re-authentification TOTP fraîche**, et **procédure dégradée PD1 à PD7** tant qu'une seule personne cumule `agent` et `admin` (RG9), l'écran disant en toutes lettres que le contrôle est affaibli | Interdit l'envoi depuis une session laissée ouverte |
| **`confirmed_at` et `confirmed_by_account_id` non nuls**, contrainte en base : un envoi ne quitte pas `pending_confirmation` sans eux | Interdit de contourner l'écran par un appel direct à l'API |
| **Aucun appel sortant pendant la fenêtre d'annulation** (RG127-1) | Fait que même une confirmation erronée reste rattrapable pendant 5 minutes |

**Vérifié par** : `03` §3.5 pour la double validation, `04` §5.10 pour les contraintes de base, et
les critères d'acceptation CA12 à CA17 de `16`.

### RG130 — Rejeu et idempotence des envois d'e-mails (aligné sur M1 et RG91)

**RG130** — Le rejeu d'un échec d'envoi, unitaire ou en lot, **conserve la clé d'idempotence** :
aucun doublon chez Brevo, **aucun e-mail déjà envoyé n'est renvoyé** (RG91, `05` RG102). Le
compte rendu nomme ce qui a été remis en file, ce qui a été ignoré et pourquoi, ce qui a été
refusé (RG88, exigence « échec partiel »). **Une ligne écartée n'est pas rejouable** : si la
situation de la personne a changé, c'est un **nouvel envoi** qui la touchera, jamais la
résurrection d'un ancien.

### RG131 — Ce que cet additif ne couvre pas, et où le trouver

**RG131** — La ligne « L'envoi d'e-mails Brevo depuis le backoffice » du §Hors périmètre reste
valable dans son principe — **ce document n'en fixe que le cadre d'action de masse, d'alerte, de
file et de plafond** — mais elle est mise à jour sur un point : **le document attendu existe
désormais**, c'est `docs/mvp/16-backoffice-emails-brevo.md` (155 règles, 116 critères
d'acceptation). Il fait autorité sur :

| Sujet | Où |
|---|---|
| Les trois sources de destinataires et leurs bases légales | `16` §C, §D, §E |
| Le parcours d'envoi, écran par écran | `16` §B |
| La bibliothèque de modèles et leur validation | `16` §F |
| La cadence par contact, toutes sources confondues | `16` §G |
| Le catalogue des e-mails transactionnels et leur idempotence | `16` §H |
| Ce qui remonte de Brevo, en agrégat ou en nominatif | `16` §I |
| Le garde-fou d'environnement et l'interrupteur d'urgence | `16` §J |
| Ce qui ne doit jamais partir dans un e-mail (17 interdits) | `16` §L |
| Le contrat d'interface Brevo, les webhooks et les variables d'environnement | `16` §M |

**Onze écarts avec `04` (modèle de données) sont signalés dans `16` §Impacts** et adressés à
`expert-database` — dont l'absence de bibliothèque de modèles, de table des segments autorisés, de
journal des transactionnels hors mise en relation, et d'emplacement pour l'interrupteur d'urgence.
Ils ne sont **pas** traités ici.

**Deux validations restent ouvertes sur ce périmètre** : **`expert-conformite-rgpd` (veto)** sur
D35, la légalité de la prospection pays par pays, le suivi nominatif des ouvertures et les durées
de conservation ; **`expert-cybersecurite` (veto)** sur l'**absence de signature des webhooks
Brevo** et les six compensations retenues (`16` **Q3**).

---

## Additif du J9 (2026-10-21) — alertes techniques de D60

**RG165** — Les alertes techniques de D60 (`02` §20.5, §20.6) complètent le catalogue de RG68, au même format et
sous le même régime que RG126 (RG63 à RG70) : **aucune liste parallèle**. Chacune s'affiche à l'écran « Santé
technique » **et** part **par e-mail** (flux transactionnel Brevo, texte rédigé par INFLUX, FR puis EN) : code, titre,
instant UTC, valeur mesurée et seuil, **rien de `02` §20.8** (ni adresse, ni IP, ni URL complète, ni message d'erreur
brut). RG70 reste vrai : rien ne part vers les contacts ni les listes Brevo, ni vers Apollo. **Destinataires** :
`astreinte` = les adresses de la variable `OPS_ALERT_RECIPIENTS`, **jamais une adresse en base** ; `admin` = les
comptes `admin` actifs, hors compte de secours. Les rôles notifiés sont en base (`alert_definitions.recipient_roles`),
modifiables par un administrateur, jamais vides. **Déduplication** : une alerte d'état part à sa levée, puis au plus
une fois par 30 min tant qu'elle dure, et un e-mail « rétabli » part à sa fin ; une alerte d'événement part une fois
par fait. **En `staging`** (D70, EC-J9-7) : aucune liste blanche, les alertes partent vers les destinataires de
`staging` ; la puce « En `staging`, les alertes ne partent que vers la liste blanche » de `02` §20.5 est caduque.

| Code | Alerte | Seuil de départ (en table) | Nature | Destinataire | Action attendue | Source |
|---|---|---|---|---|---|---|
| **AL49** | **Site injoignable** : accueils FR et EN (adresse publique), connexion du backoffice, `/health` de l'API (réseau privé, vérifie la base) | **2 échecs consécutifs** d'une même cible, sondée toutes les **60 s** | État, par cible | `astreinte` | Vérifier Railway et Supabase ; revenir à la version précédente si l'échec suit un déploiement | `02` §20.5, §20.6 |
| **AL50** | **Worker arrêté** | Aucun battement depuis **60 s** | État | `astreinte` seule, non modifiable | Lire sa ligne `fatal` (réglage manquant, `02` §12.5), puis redémarrer | `02` §11.3, §20.6 |
| **AL51** | **Nouvelle erreur serveur, ou régression** (groupe `fixed` qui réapparaît) — source serveur seulement, jamais le seul navigateur | Rodage : **1re occurrence** ; hors rodage : récapitulatif **quotidien à 07:00 UTC** des **24 h** écoulées ; régression : **1re occurrence**, toujours | Événement, un par groupe ; un seul e-mail par tour, qui regroupe ses groupes | `astreinte` | Classer chaque groupe : corrigé, planifié ou sans effet | `02` §20.6, §20.7, J4S-6 |
| **AL52** | **Taux d'erreurs serveur** | Réponses `5xx` > **1 %** des réponses de l'API sur **5 min** glissantes | État | `astreinte` | Trouver la route en cause ; corriger ou revenir à la version précédente | `02` §20.6 |
| **AL53** | **Lenteur de l'API** | p95 > **1 s** sur **10 min** glissantes, hors `POST /v1/auth/request-code` ; seuil propre de celle-ci : p95 > **3 s** sur 10 min et au moins **20** appels (`expert-cybersecurite`, 2026-10-27 ; plancher fixe de 1 s, RG46), **évaluation à implémenter** avant production | État | `astreinte` | Lire le ralentissement (`02` §20.6, « Comment lire ») | `02` §20.6, D43 |
| **AL54** | **Lenteur des pages** (sonde : accueils FR et EN, connexion du backoffice) | > **2 s** sur **3 relevés consécutifs** d'une même page | État, par page | `astreinte` | Comme AL53 | `02` §20.6 |
| **AL55** | **Pic d'appels** — **information**, pas incident | Appels à l'API par minute, moyenne sur **5 min** > **3 ×** celle de la même heure UTC sur les **14 jours** précédents ; moins de 14 jours de mesures : > **300 / min** sur 5 min (proposé) | État | `astreinte` | Rapprocher de son origine (envoi `16`, campagne) ; agir seulement si AL53 ou AL54 suit | `02` §20.6 |
| **AL56** | **Réponses `429` en hausse** | > **2 %** des réponses de l'API sur **15 min** glissantes **et** au moins **20** réponses `429` (confirmé par `expert-cybersecurite` le 2026-10-27) ; tout refus de portée `instance` d'une route publique alerte aussitôt (J9S-4, à implémenter avant production) | État | `astreinte` | Chercher l'abus avant de relever une limite | `02` §20.6, `03` A-3 |
| **AL57** | **Service saturé** (API, worker) | Retard moyen de la boucle d'événements > **200 ms** sur **5 min** ; mémoire moyenne > **85 %** de la limite du service sur **5 min**, limite **non fixée** (`integrateur`) | État, par service | `astreinte` | Augmenter les ressources Railway ; chercher la boucle ou la fuite | `02` §20.6 |
| **AL58** | **Base saturée** | Connexions > **80 %** du maximum de la grappe sur **3 relevés consécutifs** (worker, chaque minute) ; p95 d'une requête fréquente qui double : **non fixé** (`expert-database`, faute de lecture de `pg_stat_statements`) | État | `astreinte` | Chercher les connexions et les requêtes longues (`04` §7.3) | `02` §20.6 |
| **AL59** | **Code de connexion visé** (`security.member_code_targeted`) | ≥ **25** échecs de code sur **24 h** glissantes pour une même adresse e-mail | Événement, au plus un par adresse et par 24 h | `astreinte` + `admin` | Instruire : attaque ciblée ou membre en difficulté. **Aucun blocage** (`03` A-4) | J3S-8 |
| **AL60** | **Purge horaire en défaut** | `ops.periodic_runs.counts.gotrue_realign_failed` > **0**, ou disjoncteur déclenché (`breaker.orphan_ratio`, `breaker.filter_refused`) | Événement, un par passage de purge concerné | `astreinte` | Examiner le passage et corriger avant le suivant : comptes non réalignés, ou purge arrêtée | J7S-8, J7S-2 |
| **AL61** | **Webhook Brevo : appels ignorés** (`webhook.brevo.ignored` : `invalid_payload`, `outside_window`, `duplicate`) | > **10 %** des appels authentifiés sur **24 h** glissantes **et** au moins **10** appels ignorés (confirmé par `expert-cybersecurite` le 2026-10-27) | État | `astreinte` | Lire le motif dominant ; `invalid_payload` = format Brevo changé, des désinscriptions se perdent | J7S-8 |
| **AL62** | **Webhook Brevo hors plages** (`webhook.brevo.ip_drift`) : jeton valide reçu hors des plages publiées par Brevo, désinscriptions coupées | **1re occurrence** | Événement, un seul tant qu'il n'est pas classé | `astreinte` | Plages changées par Brevo, ou jeton divulgué : mettre à jour les plages, ou changer le jeton | J7S-8 |
| **AL63** | **Demande de données personnelles exécutée, non close** | `privacy.request_executions` : `executed_at` sans `completed_at` **24 h** après | État, par exécution | `admin` + `astreinte` | Achever et clore : le délai légal court (AL40) | F4 |

- **Qui envoie.** AL50 part de l'**API** (aucun service ne se surveille lui-même ; aucune lecture d'identité, E-6),
  toutes les autres du **worker**. **Toutes** vont **directement à Brevo, jamais par `outbox_events`** (J9 commit 8) ;
  base injoignable ⇒ `astreinte` seule, sur la dernière définition connue de l'alerte.
- **Écran « Santé technique »** *(additif de clôture du J9, EC-J9-5)* : `admin` seul, lecture seule, poste de travail ;
  détail en `17b` §3.15. Un `agent` est refusé et la tentative journalisée (CA63). Le **classement** d'un groupe
  d'erreurs (`acknowledged`, `fixed`, `ignored`) n'a pas encore d'écrivain : la régression d'AL51 et le classement
  d'AL62 attendent ce reliquat.
- **Rodage (AL51)** : période en table, 30 jours après chaque mise en ligne, prolongée par un administrateur tant
  qu'une erreur bloquante reste ouverte (`02` §20.7) ; sans période saisie, le régime de rodage s'applique.
- **Non fixé, donc non évalué** : limite mémoire (AL57), requête fréquente (AL58). **Fixé, pas encore évalué** :
  seuil de `request-code` (AL53). **Proposé, évalué dès maintenant** : AL55 sans historique. AL56 et AL61 confirmés
  à la revue de fin de J9 (2026-10-27). Qui compose `astreinte`, et la nuit : `02` §20.11 point 2 (fondateur).
