# Lot 4 — La file de validation, la proposition INFLUX et l'ouverture d'une mise en relation

> **⚠️ Régime du pilote — D48 (arbitrage du fondateur du 2026-09-24).** Pendant le pilote, **aucun taux ni aucun net créateur estimé n'est affiché**, ni aux marques ni aux créateurs. Toutes les mentions du « net créateur estimé » et du pourcentage de commission dans ce document sont **suspendues** jusqu'à nouvel arbitrage ; la commission est présentée comme « incluse, précisée par votre commercial ». Voir `CLAUDE.md` §3 et §13 (D48).
>
> **Mise à jour du 2026-09-24.** Ce document fait foi pour **D45** (révélation à la seconde acceptation) et **D49** (une entrée hors délai reste en file). Les coordonnées révélées sont limitées par **D46** (jamais d'e-mail ni de téléphone) ; le renouvellement suit **D42** (RG104bis).

> **Date :** 2026-09-19 · **Auteur :** agent `product-owner`, avec l'avis de
> `expert-paiement-facturation` sur les aspects de preuve d'intermédiation · **Statut :**
> spécification complète, soumise à la validation de `chef-de-projet`, avec **avis obligatoire
> (veto) de `expert-conformite-rgpd`** sur §F (contenu de l'écran d'acceptation, versions de CGU),
> §G (motifs de refus et ce qui n'est jamais communiqué) et §K (e-mails et leads), et **avis
> obligatoire de `expert-cybersecurite`** sur §C (surface privilégiée, journalisation des lectures)
> et §F (qui appelle la fonction de révélation).
>
> **Skills appliquées :** `intermediation-tracking` (objet `introduction`, trois déclencheurs,
> révélation, registre chaîné, preuves produites), `backoffice-ops` (anatomie de file, verrou,
> motifs typés, attribution, actions de masse, surface privilégiée, densité), `feature-spec`
> (format de sortie, huit cas limites, sept contrôles INFLUX), `design-system-influx` (états
> d'écran, couleur jamais seule porteuse d'information).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité, §3 modèle économique),
> `docs/mvp/00-cadrage-mvp-v2.md` (arbitrages **A1**, **A3**, **A3bis**, **A5**, **A8**, **A9**,
> **A10**), `docs/mvp/01-intermediation-courtee.md` (**document pivot** : §3 processus, §4 les trois
> déclencheurs, §5 mécanismes M1 à M7, §8 matière de la clause), `docs/mvp/03-matrice-des-droits-et-rls.md`
> §3.4 (conditions **C(18)** à **C(26)**), `docs/mvp/04-modele-de-donnees-mvp.md` §5.6
> (`matching.introductions`, `matching.interest_submissions`, `matching.party_blocks`,
> `matching.rejection_reasons`, `matching.reveal_identity()`), §4.3 (registre chaîné) et §12.6,
> `docs/mvp/10-recherche-createurs-anonymisee.md` (la demande de contact naît là, §E et §H),
> `docs/mvp/11-recherche-campagnes-et-candidature.md` (la candidature naît là, §E à §I).
>
> **Ce que ce document tranche :** ce qui entre dans la file et sous quelle forme, ce que le
> commercial voit pour décider sans ouvrir autre chose, la prise en charge et son verrou, les trois
> actions de décision et leurs motifs typés, le parcours complet de la **proposition INFLUX** en
> trois clics, l'écran d'acceptation présenté à **chaque** partie, l'instant exact de la révélation
> d'identité, les **deux refus** qu'il ne faut pas confondre, les relances et l'expiration, les huit
> états d'une mise en relation, et les alertes du commercial.
>
> **Ce qu'il ne tranche pas :** la recherche de créateurs et le contenu d'une demande de contact
> (document `10`), le fil de campagnes et le contenu d'une candidature (document `11`), **tout ce
> qui se passe dans la conversation une fois qu'elle est ouverte** (document `12`, frontière écrite
> au §Frontière), le pipeline commercial et la saisie des montants (document `01` §6), le schéma SQL
> et les politiques d'accès (`expert-database`, `expert-cybersecurite`), la rédaction juridique de la
> clause de non-contournement (juriste).
>
> **Invariant rappelé :** aucun contrat, aucune facture, aucun encaissement et **aucun calcul de
> commission dans le code applicatif** n'existe dans ce périmètre (**A1**, `03` C(32)). Ce document
> ne crée **aucun montant nouveau** : il n'affiche que des montants déjà spécifiés ailleurs
> (rémunération annoncée par la campagne, tarif proposé par le créateur, net créateur estimé en
> tranche), toujours nommés, toujours avec leur devise.

---

## Besoin

**Permettre à un commercial INFLUX de décider en moins d'une minute, sans ouvrir un autre écran, si
deux parties doivent se rencontrer — puis ouvrir cette rencontre de telle façon que personne ne
découvre l'autre sans l'avoir accepté, et que la trace de ce qu'INFLUX a livré existe hors de nos
serveurs.**

Quatre raisons d'être, dans cet ordre :

1. **C'est le goulot d'étranglement du produit.** **A9** interdit qu'une conversation s'ouvre sans
   l'accord d'un commercial. Chaque heure passée dans cette file est une heure où deux parties
   attendent, et une marque qui attend deux jours retourne chercher ailleurs. **D39** fixe la
   décision à **1 jour ouvré** : ce n'est pas un objectif de confort, c'est la condition de survie
   des deux premiers déclencheurs.
2. **C'est le geste métier du fondateur.** La **proposition INFLUX** (**A3bis**) est ce qu'il fait
   aujourd'hui au téléphone. Si l'outil est plus lent que le téléphone, les commerciaux
   téléphoneront, et **aucune trace n'existera** : ni référence, ni date, ni preuve, ni commission
   défendable. La vitesse de ce parcours est une exigence business, pas une exigence d'ergonomie.
3. **C'est le seul instant où INFLUX livre de la valeur.** Avant la révélation, INFLUX n'a rien
   donné et rien n'est dû. Après, la marque connaît le créateur. Cet instant doit être **daté une
   fois pour toutes, confirmé aux deux parties par un e-mail qui sort de nos systèmes, et impossible
   à réécrire**.
4. **C'est le point où l'on peut blesser la confiance.** Révéler l'identité de quelqu'un qui n'a
   rien demandé et n'a rien accepté est la faute qui coûte le plus cher : elle est irréversible, elle
   se voit, et elle se raconte. D'où la règle sans exception du §F.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Commercial INFLUX** (rôle `agent`) | Prend en charge une entrée de file, lit les deux parties **en identité complète**, valide et s'attribue l'affaire, refuse avec un motif typé, réattribue ; **crée des propositions INFLUX** depuis une campagne ; relance ; suit ses alertes |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, plus : lever un verrou orphelin, réattribuer d'autorité, modifier les délais et les plafonds, autoriser une re-proposition après refus, traiter les escalades |
| **Marque** (annonceur) | Reçoit une invitation à accepter (demande qu'elle a elle-même faite : elle a déjà accepté ; candidature validée ou proposition INFLUX : elle accepte à l'écran), refuse, ou ne répond pas |
| **Créateur** | Symétriquement : accepte à l'écran, refuse, ou ne répond pas |
| **Système** | Calcule l'échéance de traitement, tient le verrou et son expiration, applique les plafonds, pose `identity_revealed_at` **uniquement quand les deux acceptations existent**, crée la conversation et ses trois participants, écrit le registre chaîné, met les e-mails en file, relance, expire, alerte |
| **Prestataire d'envoi** (Brevo, transactionnel) | Achemine les e-mails de confirmation et les relances ; renvoie un `messageId` que l'on conserve |

> **Deux populations, deux parcours, et un troisième acteur qui décide.** L'écran de décision est un
> écran **interne**. L'écran d'acceptation est un écran **membre**, et il existe en deux variantes
> (marque, créateur) qui ne partagent ni le vocabulaire, ni les montants affichés, ni ce qui est
> montré de l'autre partie.

---

## User stories

### Commercial et administrateur

- **US1** — En tant que **commercial**, je veux une file unique où arrivent les demandes de contact
  et les candidatures, triée par échéance, afin de n'avoir qu'un seul endroit à regarder le matin.
- **US2** — En tant que **commercial**, je veux voir sur un seul écran la marque, le créateur en
  identité complète, la campagne, ce qui a été écrit et les alertes, afin de décider en une minute.
- **US3** — En tant que **commercial**, je veux être le seul à traiter une entrée que j'ai ouverte,
  afin que deux d'entre nous ne répondent jamais à la même marque.
- **US4** — En tant que **commercial**, je veux refuser avec un motif choisi dans une liste, afin
  qu'aucun refus ne soit muet et que l'on sache, dans six mois, pourquoi on refuse.
- **US5** — En tant que **commercial**, je veux voir combien de temps il me reste, afin de traiter
  d'abord ce qui va dépasser.
- **US6** — En tant que **commercial**, je veux partir d'une campagne, sélectionner plusieurs
  créateurs, écrire un motif commun et envoyer, **en trois clics**, afin que l'outil soit plus rapide
  que mon téléphone.
- **US7** — En tant que **commercial**, je veux que chaque créateur proposé donne lieu à une mise en
  relation distincte et suivie séparément, afin de savoir laquelle a produit une affaire.
- **US8** — En tant que **commercial**, je veux être prévenu quand une partie ne répond pas, quand un
  fil devient silencieux et quand une demande reste sans preneur, afin d'agir avant de perdre
  l'affaire.
- **US9** — En tant que **commercial** qui part en congés, je veux réattribuer mes mises en relation
  avec un motif, afin que personne ne reste sans interlocuteur.
- **US10** — En tant qu'**administrateur**, je veux lever un verrou orphelin et modifier les délais
  sans déploiement, afin de ne jamais bloquer l'équipe pour un paramètre.

### Marque

- **US11** — En tant que **marque**, je veux savoir que ma demande est en cours et sous quel délai
  elle sera examinée, afin de ne pas relancer dans le vide.
- **US12** — En tant que **marque**, je veux décider moi-même d'entrer en relation avec un créateur
  qu'INFLUX me propose, afin de ne jamais être engagée sans l'avoir voulu.
- **US13** — En tant que **marque**, je veux, au moment d'accepter, savoir exactement ce qui sera
  montré de moi et ce que je verrai de l'autre, afin de ne rien découvrir après coup.

### Créateur

- **US14** — En tant que **créateur**, je veux qu'aucune marque ne connaisse mon identité tant que je
  ne l'ai pas accepté, afin de garder la main sur ma visibilité.
- **US15** — En tant que **créateur** à qui INFLUX propose une campagne, je veux comprendre pourquoi
  on me la propose et ce que je toucherais, afin de répondre en connaissance de cause.
- **US16** — En tant que **créateur**, je veux refuser sans avoir à me justifier auprès de la marque,
  afin qu'un refus ne me coûte rien.

### Système

- **US17** — En tant que **système**, je veux qu'aucune identité ne soit révélée sans **deux**
  acceptations enregistrées, afin que cette garantie ne dépende pas de la discipline d'un
  développeur.
- **US18** — En tant que **système**, je veux que la révélation, la conversation, l'événement de
  registre et les deux e-mails se produisent ensemble ou pas du tout, afin qu'il n'existe jamais une
  mise en relation sans preuve.

---

## Règles de gestion

### A — Périmètre, vocabulaire et principes

**RG1** — Ce document décrit **un seul objet** : `matching.introductions`, la mise en relation. Les
trois déclencheurs (`10` pour la demande de contact, `11` pour la candidature, §E de ce document pour
la proposition INFLUX) produisent **le même objet**, avec **la même révélation horodatée**, **la même
conversation à trois** et **les mêmes e-mails**. Le chemin d'entrée ne change que trois choses : qui
passe par la file, qui a déjà accepté, et qui devient responsable.

**RG2** — **Une `introduction` = une marque + un créateur.** Une proposition portant sur cinq
créateurs crée **cinq mises en relation distinctes**, cinq références, cinq suivis. **Il n'existe
aucun objet « lot »** : un envoi groupé qui produirait un seul objet rendrait la preuve
d'intermédiation inexploitable créateur par créateur, et aucune commission ne serait rattachable à
une affaire.

**RG3** — **`origin` est immuable** (`04`, déclencheur d'écriture unique). Une candidature ne devient
jamais une demande de contact, une demande de contact ne devient jamais une proposition INFLUX.
`origin` est **la première origine**, et c'est elle qui qualifie l'initiative d'INFLUX.

**RG4** — **Rien ne circule entre deux membres sans l'accord d'un commercial** (**A9**). La
conversation est la conséquence d'une décision humaine puis de deux acceptations, jamais d'un clic
d'utilisateur.

**RG5** — **La révélation d'identité exige les deux acceptations, toujours, sans exception.** C'est
la contrainte de base `introductions_reveal_requires_both_acceptances` (`04` §5.6), inconditionnelle,
confirmée le 2026-09-19 et alignée dans `03` C(21). Une partie qui n'a rien demandé doit accepter
explicitement **avant** que son identité soit montrée à l'autre **et avant** que celle de l'autre lui
soit montrée.

**RG6** — **`identity_revealed_at` s'écrit une seule fois**, par une fonction unique, dans une
transaction unique. Aucun rôle humain ne peut le poser ni le modifier (`03` C(21)). **Il n'existe
aucun bouton « révéler »**, ni pour un commercial, ni pour un administrateur : la révélation est la
**conséquence mécanique** de la seconde acceptation.

**RG7** — Les **pays des deux parties** et les **versions de CGU acceptées par chacune** sont
**copiés** sur la mise en relation au moment des faits, jamais lus par jointure vers le compte. Un
utilisateur déménage ; la preuve, non.

**RG8** — **Toute décision porte un motif choisi dans une liste fermée.** Le texte libre est autorisé
**en complément**, jamais seul (`backoffice-ops`, règle 10). Un motif rédigé librement n'est ni
mesurable, ni comparable, ni exploitable.

**RG9** — **Toute action d'un rôle interne est attribuée à une personne nommée et journalisée**, y
compris la simple **lecture** de l'écran de décision, qui expose deux identités non encore révélées
(`backoffice-ops`, règle 25).

**RG10** — Toute règle de ce document — verrou, plafond, éligibilité, visibilité d'un champ — est
appliquée **côté serveur**. L'écran est un confort ; il n'est jamais le seul contrôle.

**RG11** — **Aucun contrôle de « pays ouvert » ne s'applique à une mise en relation au MVP.** La
liste des pays ouverts (**D26**) conditionne les **contrats**, et le contrat est hors application
(**A1**). Une mise en relation est possible entre deux comptes de n'importe quels pays. Cette règle
est écrite pour qu'aucun développeur n'invente un filtre qui n'a pas lieu d'être — et pour qu'on se
souvienne de l'ajouter en V2.

**RG12** — **Ce document ne crée aucun montant** et n'effectue **aucune multiplication par un taux**
(**A1**, `03` C(32)). Les seuls montants affichés sont ceux déjà spécifiés : la **rémunération par
créateur** annoncée par la campagne (`11` RG9), le **tarif proposé** par le créateur (`11` RG60), le
**net créateur estimé** en tranche lue au référentiel (`11` RG57), **jamais affiché à une marque**
(`11` RG59). Le commercial voit en plus les **tarifs exacts** du profil créateur, en vue identifiée
(`10` RG71). **Depuis D48 (arbitrage du 2026-09-24), le net créateur estimé n'est affiché à
personne pendant le pilote** : les mentions qui suivent sont suspendues jusqu'à nouvel arbitrage.

**RG13** — **Aucun vocabulaire de preuve.** Nulle part — écran, e-mail, CGU, export — n'apparaissent
les mots « preuve légale », « horodatage certifié » ou « valeur probante ». Les termes justes sont
« historique de la mise en relation », « journal d'activité », « confirmation envoyée le … »
(`01` M4).

---

### B — L'entrée dans la file

**RG14** — **Deux déclencheurs alimentent la file, et deux seulement** : la **demande de contact**
d'une marque (`origin = brand_contact_request`, document `10`) et la **candidature** d'un créateur
(`origin = creator_application`, document `11`). La **proposition INFLUX** ne passe pas par la file
(§E).

**RG15** — À la création, la mise en relation porte **obligatoirement** : sa référence
`MER-AAAA-NNNNNN`, son origine, son motif écrit, les deux comptes, la campagne (obligatoire pour la
candidature, facultative pour la demande de contact), les **pays des deux parties**, la **version de
CGU acceptée par l'initiateur**, la **date d'acceptation de l'initiateur**, le statut
`pending_review`, et `sla_due_at` **calculé une fois** à la création.

**RG16** — **`sla_due_at` = date de création + 1 jour ouvré** (**D39**, tranché), lu dans
`backoffice.sla_policies`. Il est **figé** : changer la politique demain ne réécrit jamais l'histoire
d'hier. Les heures et jours ouvrés sont appliqués **une seule fois**, au calcul ; aucune requête
d'écran ne refait ce calcul.

**RG17** — Un **objectif interne de prise en charge** de **4 heures ouvrées** existe en plus, en
table, **non annoncé aux membres**. Il ne crée aucun engagement : il déclenche l'alerte « demande
restée sans preneur » (§J). Ce qu'on promet à l'utilisateur, c'est 1 jour ouvré ; ce qu'on se promet
entre nous, c'est 4 heures.

**RG18** — **La file est unique**, avec un **filtre par origine** (`11` RG88). Une file par
déclencheur obligerait le commercial à surveiller deux écrans pour le même métier.

**RG19** — **Le tri par défaut est l'échéance de traitement croissante** (`sla_due_at`), départage
par date de création. Les entrées déjà hors délai sont **en tête** et **visuellement distinctes**,
avec un libellé écrit (`backoffice-ops`, règle 37 : la couleur n'est jamais seule porteuse).

**RG20** — Tris et filtres disponibles, et aucun autre sans passer par `chef-de-projet` :

| # | Filtre ou tri | Format |
|---|---|---|
| F1 | Origine | Demande de contact · Candidature |
| F2 | État | En attente · En cours d'examen · Hors délai |
| F3 | Titulaire du verrou | Libre · Moi · Un autre agent nommé |
| F4 | Campagne | Sélection |
| F5 | Alerte de détection de coordonnées | Oui / non |
| F6 | Commercial responsable | Sélection *(vide tant que la décision n'est pas prise)* |
| T1 | Échéance croissante | **Par défaut** |
| T2 | Plus ancienne d'abord | — |
| T3 | Dernière arrivée d'abord | — |

**RG21** — La **ligne de file** affiche, sans ouvrir quoi que ce soit : la référence, l'origine, la
marque (nom commercial), le créateur (**nom réel et pseudo — vue interne**), la campagne, le montant
en jeu s'il existe (tarif proposé ou fourchette de la campagne, avec sa devise), le **temps restant
avant échéance** écrit en clair, les **pastilles d'alerte** (coordonnées détectées, compte suspendu,
chiffres périmés, doublon), et le **titulaire du verrou** s'il y en a un.

**RG22** — **Le commercial voit les deux parties en identité complète**, contrairement à la marque
qui ne voit qu'un profil anonymisé (**A2**, `10` RG71). C'est la troisième des cinq différences
assumées de la vue commerciale. Cette lecture est une **surface privilégiée** : elle est journalisée
(RG9, RG34).

**RG23** — **Deux états distincts et distinctement affichés** : « aucune demande en attente — la
dernière a été traitée il y a 12 minutes » n'est pas la même chose que « rien ne remonte »
(`backoffice-ops`, cas limite « file vide vs file bloquée »). Un état vide utile, jamais une page
blanche.

**RG24** — Le **volume en attente** et **l'ancienneté de la plus ancienne entrée** sont affichés en
permanence en tête de file, pas dans un rapport mensuel (`backoffice-ops`, règle 9). Une file qui
s'allonge est une conversion qui s'effondre.

**RG25** — **Une entrée ne disparaît jamais de la file sans décision.** Il n'existe **aucune sortie
silencieuse** (`backoffice-ops`, règle 8). Les seules sorties sont : validée, refusée, retirée par
l'initiateur, clôturée sans suite pour une cause objective (§H).

**RG26** — **Le dépassement du délai n'expire jamais une entrée.** Une décision tardive reste
possible et est **marquée comme telle** (`sla_breached`). L'entrée reste dans la file et exige une
décision. *(Écart assumé avec la table de transitions de la skill `intermediation-tracking`, qui
mentionne un passage automatique en `expired` au dépassement du SLA : le modèle de données `04` ne
prévoit aucun sous-motif d'expiration pour cette cause, et une demande effacée par le seul écoulement
du temps est une promesse rompue. Voir §Impacts et **Q1**. **Écart levé le 2026-09-24 : D49 retient
cette règle et la skill a été alignée.**)*

---

### C — L'écran de décision et la prise en charge

**RG27** — **Ouvrir une entrée libre la prend automatiquement en charge.** Chaque clic économisé au
backoffice est de la capacité commerciale gagnée ; demander un clic « prendre en charge » avant de
pouvoir lire est une friction pure. L'écran indique clairement « vous avez pris cette demande en
charge à 09 h 42 ».

**RG28** — **La prise en charge est une transition conditionnelle atomique**, jamais une lecture
suivie d'une écriture (`04` §5.6) : la mise à jour ne réussit que si le statut est encore
`pending_review`. Zéro ligne modifiée signifie qu'un autre commercial a pris la main.

**RG29** — Le second commercial voit un **message clair** — « déjà prise en charge par Marie depuis
09 h 42 » — **jamais un écran d'erreur, jamais un doublon**. Il peut lire l'entrée **en lecture
seule** ; il ne peut pas décider. Deux commerciaux qui répondent à la même marque, c'est une perte de
crédibilité immédiate.

**RG30** — **Le verrou expire seul après 30 minutes sans décision** (paramètre en table, `11` RG91).
L'entrée retourne en attente de prise en charge, le verrou abandonné est **journalisé** avec son
titulaire et sa durée. Un commercial peut aussi **relâcher explicitement** son verrou (« je rends la
main »), avec un motif libre facultatif.

**RG31** — **Un administrateur peut lever un verrou orphelin avant son expiration**, avec un motif
typé et une trace (`03` C(20)). Le titulaire dépossédé en est informé.

**RG32** — L'écran de décision affiche **tout ce qu'il faut pour décider sans ouvrir un autre écran**
(`backoffice-ops`, étape 1, point 1). Cinq blocs, toujours dans cet ordre :

| Bloc | Contenu |
|---|---|
| **1. En-tête** | Référence `MER-…`, origine en toutes lettres, date et heure de création, **temps restant avant échéance écrit en clair**, titulaire du verrou, campagne rattachée |
| **2. La marque** | Raison sociale et nom commercial, pays, secteur, taille, badge « Marque vérifiée » **et sa date**, interlocuteur (nom et fonction), **historique** : mises en relation ouvertes, affaires signées, demandes refusées, taux d'acceptation, alertes d'aspiration en cours (`10` RG68) |
| **3. Le créateur** | **Identité complète** : nom, pseudo, identifiants et liens de réseaux, pays et ville, **chiffres exacts avec leur date de mesure et leur source**, badges et leurs dates, **tarifs exacts** par (réseau, format) avec devise, disponibilité déclarée et sa date, **historique** : mises en relation, taux de réponse aux invitations, refus |
| **4. Ce qui a été écrit** | La ou **les** expressions d'intérêt (`matching.interest_submissions`) : motivation intégrale, proposition de concept, formats proposés, tarif proposé et sa devise, cases cochées, date, **version de CGU acceptée**. Le motif de la marque pour une demande de contact, avec **les filtres de la recherche d'origine** (`10` RG54) |
| **5. Alertes et décision** | Toutes les alertes du RG33, puis les **trois actions** et le champ de commentaire interne |

**RG33** — Les **alertes affichées sur l'écran de décision** sont une liste fermée, chacune écrite en
clair et non portée par la seule couleur :

| Alerte | Origine | Ce qu'elle dit au commercial |
|---|---|---|
| **Coordonnée détectée** | `11` RG51, `03` C(26) | Un texte contient ce qui ressemble à une adresse, un numéro, un identifiant ou un lien. **Le type et la position sont affichés, jamais une copie du texte détecté** — le texte est de toute façon lisible juste au-dessus |
| **Les deux parties se sont cherchées** | Deux lignes `interest_submissions` sur la même mise en relation (`04` §5.6) | **Le signal le plus fort du produit.** Valider ouvrira immédiatement la conversation (RG44) |
| Compte suspendu | `identity` | L'une des parties n'est plus active |
| Chiffres périmés | Profil créateur, > 90 jours | Motif de refus disponible (`11` RG92) |
| Écart tarifaire | Tarif proposé hors fourchette de la campagne (`11` RG56) | Information, jamais un blocage |
| Campagne fermée ou dépubliée | `campaigns` | La décision reste possible ; la clôture aussi (§H) |
| Volume anormal côté marque | `10` RG68 | On appelle la marque avant de la suspendre |

**RG34** — **L'ouverture de l'écran de décision est journalisée** (`introduction.reviewed`, gravité
« sensible »), avec l'agent et l'horodatage. Elle expose deux identités **non encore révélées** : la
lire est un acte, pas une consultation anodine.

**RG35** — **Un commercial ne traite jamais une entrée dont l'une des parties est un compte qu'il
détient ou qu'il représente.** L'entrée lui est masquée ; si le conflit apparaît en cours de
traitement, il **réattribue** avec le motif dédié (§D). Un agent n'agit jamais sur son propre compte
(`backoffice-ops`, règle 46).

**RG36** — **Raccourcis clavier obligatoires** sur les gestes répétés : prendre en charge, valider,
refuser avec motif, entrée suivante. Toutes les actions sont atteignables **sans souris**. C'est ce
qui sépare un outil de dix décisions par jour d'un outil de cent.

**RG37** — L'écran est **dense** : tableaux plutôt que cartes, aucune animation décorative, aucun
délai artificiel. Tous les contrastes respectent WCAG AA, tous les tokens viennent du design system.

---

### D — Les trois actions du commercial

**RG38** — Le commercial dispose de **trois actions, et trois seulement** : **valider**, **refuser
avec motif typé**, **réattribuer**. Il n'existe **aucune quatrième action** — ni « mettre de côté »,
ni « en attente de correction », ni « transmettre pour avis ». Une entrée ne reste jamais en suspens
(`11` RG96).

**RG39** — **Valider** fait, dans une seule transaction : passage en `approved`, **attribution de
l'affaire au commercial qui décide** (`owner_agent_id`), horodatage de la décision, écriture de
l'événement chaîné, et envoi de l'invitation à la ou aux parties qui n'ont pas encore accepté.

**RG40** — **`owner_agent_id` est figé à la décision.** Il ne se modifie que par une **réattribution
explicite et motivée** (RG47), jamais par une mise à jour discrète de colonne.

**RG41** — **Le commercial ne modifie jamais le texte écrit par une partie** (`11` RG97). Il valide,
ou il refuse. Un texte réécrit par INFLUX et présenté comme celui d'un membre serait une
falsification. Il peut en revanche ajouter un **commentaire interne**, invisible des membres.

**RG42** — **Valider n'est pas révéler.** Après validation, `identity_revealed_at` reste **vide** et
rien n'est montré à personne, tant que les deux acceptations n'existent pas (RG5).

**RG43** — **Exception, et une seule : les deux acceptations existent déjà au moment de la
validation.** C'est le cas quand la marque a fait une demande de contact et que le créateur a
candidaté sur la même campagne (deux lignes `interest_submissions`). Dans ce cas, **valider révèle
immédiatement**, dans la même transaction.

**RG44** — Parce que la révélation est **irréversible**, cette validation-là est une **action
sensible** et exige une **confirmation explicite séparée du geste de validation**
(`backoffice-ops`, étape 4, procédure dégradée du MVP) : un récapitulatif nomme les deux parties, la
campagne, et dit en toutes lettres **« cette action est irréversible : les deux parties verront
l'identité l'une de l'autre »**. La confirmation est tracée nominativement, avec ses deux
horodatages. Dans tous les autres cas — la très grande majorité — **aucune confirmation
supplémentaire n'est demandée**, parce que rien d'irréversible ne se produit.

**RG45** — **Refuser** exige un **motif typé** (§G, liste A) et fait, dans une seule transaction :
passage en `rejected`, enregistrement du motif, horodatage, événement chaîné, et **notification à
l'initiateur** avec le message associé au motif. Un commentaire interne est obligatoire pour le motif
« autre ».

**RG46** — **Un refus ne se défait pas.** Un commercial qui s'est trompé **ne supprime rien** : le
refus reste au journal, la correction s'y ajoute avec son motif, l'initiateur est informé, et il
recommence si le motif est **corrigible** (`11` RG67). Un refus effacé est un historique falsifié.

**RG47** — **Réattribuer** transfère `owner_agent_id` à un autre commercial, avec un **motif typé** et
une trace. L'historique des responsables successifs est **conservé**, jamais écrasé (`03` C(22),
`backoffice.ownership_assignments`).

| Motif de réattribution | Quand |
|---|---|
| `absence` | Congés, arrêt, indisponibilité |
| `workload` | Charge trop élevée |
| `conflict_of_interest` | RG35 |
| `expertise` | Un collègue connaît mieux le secteur ou la marque |
| `portfolio_transfer` | Changement de portefeuille |
| `departure` | Départ de l'entreprise — **préalable obligatoire à la désactivation du compte agent** (`backoffice-ops`, règle 19) |
| `other` | Commentaire interne obligatoire |

**RG48** — **La réattribution après ouverture de la conversation est visible des deux parties**, sous
la forme d'un changement d'interlocuteur clairement annoncé. *Le mécanisme d'annonce dans le fil
relève du document `12`* ; ce document exige seulement que l'annonce existe et que l'ancien et le
nouveau responsable soient tous deux conservés.

**RG49** — Un **agent désactivé ne peut pas rester responsable** : la réattribution de toutes ses
mises en relation et affaires est un préalable bloquant à la désactivation de son compte.

**RG50** — **Aucune action de masse n'existe sur la file de validation.** On ne valide pas dix
demandes d'un clic : chaque décision engage une révélation d'identité et une affaire. La seule action
portant sur plusieurs objets de ce document est la **proposition INFLUX** (§E), et elle ne révèle
rien.

---

### E — La proposition INFLUX

> **C'est le geste métier qui existe déjà hors plateforme, et le plus important des trois.** Il doit
> être **au moins aussi rapide qu'un coup de fil**. S'il est plus lent, le commercial reprendra son
> téléphone et la trace n'existera pas.

**RG51** — Le commercial **part d'une campagne publiée** et ouvre la **recherche de créateurs en vue
identifiée** (`10` §H), **pré-remplie depuis le brief de la campagne** (`10` RG73) : thématiques,
réseaux, formats, pays d'audience, langues, fourchette tarifaire, droits d'usage, exclusivité. Il
corrige librement le pré-remplissage.

**RG52** — La **campagne est obligatoire** et doit être à l'état **publié**. Une proposition sans
campagne n'existe pas (`04` §5.6). Une campagne en brouillon, en attente de validation, en pause,
close ou dépubliée ne permet aucune proposition ; le bouton est **désactivé avec son motif écrit**,
jamais absent sans explication.

**RG53** — La **sélection multiple est plafonnée à 20 créateurs par envoi** (`10` RG71), paramètre en
table. Un **plafond journalier par commercial** existe également — **60 propositions par jour ouvré**,
paramètre en table — pour que la proposition reste un rapprochement réfléchi et non un envoi de
masse. Chaque atteinte de plafond est journalisée.

**RG54** — **Le parcours d'envoi tient en trois clics, à partir d'une sélection faite** :

| Clic | Geste | Ce qui s'affiche |
|---|---|---|
| **1** | « Proposer à la campagne {X} » | Un **panneau latéral** s'ouvre, sans rechargement ni changement d'écran |
| **2** | Écrire le motif commun, ou choisir un modèle enregistré | Le panneau récapitule : **les N créateurs nommés**, la campagne, et la phrase « **N mises en relation distinctes seront créées** » |
| **3** | « Envoyer les N propositions » | Compte rendu immédiat : ce qui est parti, ce qui n'est pas parti et pourquoi |

**Aucune saisie par destinataire n'est exigée.** La personnalisation individuelle du motif existe,
derrière un lien « personnaliser » replié par défaut : elle est utile, elle ne doit pas être sur le
chemin.

**RG55** — Le **panneau du clic 2 est l'aperçu obligatoire** d'une action portant sur plusieurs
éléments (`backoffice-ops`, étape 3) : il affiche le **plafond**, la **sélection exacte**, la
**conséquence** et la **réversibilité**, et le clic 3 est une **confirmation séparée de la
sélection**. Les trois clics et les six exigences d'une action de masse sont donc satisfaits par la
même conception, sans écran supplémentaire.

**RG56** — **Le motif écrit est obligatoire**, minimum 10 caractères (`04` §5.6), et il est **copié
dans chaque mise en relation créée**, jamais simplement référencé. Chaque preuve doit se lire seule.
C'est le motif qui distingue un rapprochement réfléchi d'un envoi de masse.

**RG57** — Chaque destinataire donne lieu à une **`introduction` distincte**, créée directement en
`approved`, avec `origin = influx_proposal`, `owner_agent_id` = **l'auteur de la proposition,
d'office**, sa propre référence `MER-…`, ses pays copiés et son horodatage. **La file de validation
est court-circuitée** : le commercial est déjà le décideur.

**RG58** — **`identity_revealed_at` n'est jamais posé à la création d'une proposition INFLUX.**
Aucune des deux parties n'a rien demandé : on ne peut leur opposer une acceptation qu'elles n'ont pas
donnée. La créance éventuelle de la V2 naît de la **révélation**, pas de l'initiative du commercial —
et c'est cohérent : INFLUX n'a livré de valeur qu'au moment où les deux parties se sont vues.

**RG59** — **Un identifiant de lot** (`proposal_batch_id`) est porté par chaque mise en relation
créée dans le même envoi, et **un événement de registre** décrit le lot : auteur, horodatage,
campagne, motif, liste des références créées, liste des échecs. Le lot est **journalisé comme un
objet** (`backoffice-ops`, étape 3) **sans pour autant devenir un objet métier** : il n'a ni statut,
ni cycle de vie, ni écran de suivi propre. RG2 reste entière.

**RG60** — **Échec partiel assumé et explicite.** Un envoi de 10 propositions dont 3 échouent
produit 7 mises en relation, et un compte rendu qui **nomme les 3 créateurs écartés et la raison** :

| Cause de rejet à la création | Message au commercial | Rejouable |
|---|---|---|
| Mise en relation active déjà existante sur ce triplet | « Une mise en relation est déjà en cours avec {créateur} sur cette campagne. » | Non |
| **Blocage entre les deux parties** (`matching.party_blocks`) | « Vous ne pouvez pas proposer {créateur} à cette marque. » — **sans jamais afficher le motif du blocage ni qui l'a posé** (`04` §5.6) | Non |
| Compte suspendu ou en cours de suppression | « Ce compte n'est pas disponible. » | Non |
| Profil créateur non publié | « Le profil de {créateur} n'est pas publié — relancez-le. » | Après publication |
| Plafond journalier atteint | « Vous avez atteint votre plafond de {n} propositions pour aujourd'hui. » | Demain |

**Ce qui a réussi reste.** On n'annule jamais les 7 à cause des 3.

**RG61** — **Chaque partie reçoit une invitation, et chacune voit autre chose** :

| Ce que voit… | La marque | Le créateur |
|---|---|---|
| L'autre partie | **Le créateur anonymisé** : alias, carte anonyme complète (`10` RG47), badges et leurs dates, tranches d'audience, fourchettes tarifaires. **Aucun élément identifiant** (`10` RG48) | **La marque identifiée** : nom commercial, secteur, taille, badge — mais **aucune coordonnée directe** (**D40**, `06` RG38) |
| La campagne | La sienne | Titre, brief, livrables, période, **rémunération par créateur avec sa devise** ; ~~net créateur estimé en tranche~~ *(suspendu pendant le pilote, D48)* |
| Le motif | **Le motif écrit par le commercial**, tel quel | Le même |
| INFLUX | Le **nom du commercial** qui suit l'affaire, visible et nommé | Le même |

**RG62** — L'invitation dit **ce qu'elle n'est pas** : ce n'est ni un engagement, ni une offre, ni une
promesse de contrat. Elle dit **ce qui se passera si les deux acceptent** (§F) et **ce qui se passera
si l'un refuse** : rien n'est révélé, rien n'est dû, l'autre partie n'apprend pas le motif.

**RG63** — **Le commercial peut retirer une proposition tant qu'elle n'est pas révélée**, avec un
motif. Elle passe en `withdrawn` ; les parties qui avaient déjà accepté sont informées d'une phrase
neutre — « INFLUX a retiré cette proposition » — sans autre détail. C'est la **réversibilité annoncée
avant l'exécution** exigée au RG55.

**RG64** — **Une proposition refusée par une partie ne peut pas être renouvelée sur la même
campagne**, sauf autorisation d'un administrateur, motivée et journalisée. Sur une **autre** campagne,
une nouvelle proposition est libre. Sans cette règle, la proposition devient du harcèlement, et le
créateur cesse de répondre — ce qui détruit le déclencheur le plus rentable des trois.

**RG65** — **Aucun plafond de candidature ne s'applique au commercial** (`11` RG70). La proposition
INFLUX n'est pas une candidature et ne consomme aucun plafond côté membre : c'est le geste qu'il faut
au contraire accélérer.

---

### F — L'écran d'acceptation et la révélation d'identité

**RG66** — **Il existe un seul écran d'acceptation**, servi aux deux populations, avec **trois
variantes de bandeau** selon l'origine. Un écran par déclencheur divergerait en trois mois, et c'est
l'écran le plus sensible du produit.

| Origine | Bandeau côté marque | Bandeau côté créateur |
|---|---|---|
| Demande de contact | *(déjà acceptée à la demande — pas d'écran)* | « Une marque souhaite vous rencontrer sur cette campagne. » |
| Candidature | « Un créateur a candidaté à votre campagne — INFLUX a validé sa candidature. » | *(déjà acceptée à la candidature — pas d'écran)* |
| Proposition INFLUX | « INFLUX vous propose un créateur pour cette campagne. » | « INFLUX vous propose cette campagne. » |

**RG67** — **L'initiateur n'a pas d'écran d'acceptation** : il a déjà accepté au moment de sa demande
ou de sa candidature (`10` §E, `11` RG47), et son acceptation est datée et rattachée à une version de
CGU. **Exception (RG68)**.

**RG68** — **Si la version de CGU en vigueur a changé entre l'acceptation de l'initiateur et la
validation, l'initiateur ré-accepte** sur le même écran que l'autre partie, avant toute révélation.
Règle simple, testable, et dont le coût réel est proche de zéro : une version de CGU ne change pas
tous les jours, et le délai de la file est d'un jour ouvré. *(Hypothèse conservatrice, voir **Q3**.)*

**RG69** — **Contenu obligatoire de l'écran d'acceptation**, dans cet ordre :

| # | Élément | Pourquoi |
|---|---|---|
| 1 | La **référence** `MER-2026-000123` | Elle sera citée dans l'e-mail, la conversation et la future facture |
| 2 | **Qui propose** : le nom du commercial INFLUX qui suit l'affaire | La protection principale du modèle, c'est un humain nommé |
| 3 | **La campagne** : titre, livrables, période, rémunération par créateur avec sa devise ; ~~côté créateur, le net créateur estimé en tranche~~ *(suspendu pendant le pilote, D48 : le commercial précise la rémunération dans la conversation)* | Personne n'accepte une rencontre sans savoir de quoi il s'agit |
| 4 | **L'autre partie, dans l'état de visibilité du RG61** | Anonyme côté marque, identifiée sans coordonnées côté créateur |
| 5 | **Le motif écrit** par le demandeur ou par le commercial | C'est ce qui distingue un rapprochement d'un envoi de masse |
| 6 | **Ce qui se passera si j'accepte**, en trois phrases : mon identité et les informations révélables de mon profil — **jamais mon e-mail ni mon téléphone** (D46) — seront montrées à l'autre partie **au même instant** que les siennes me seront montrées ; une conversation s'ouvrira avec **{nom du commercial}** ; un e-mail de confirmation nous sera envoyé à tous les deux | Aucun coût découvert en fin de parcours |
| 7 | **Ce qui se passera si je refuse** : rien n'est révélé, l'autre partie n'apprend pas mon motif, je peux être sollicité sur une autre campagne | Un refus doit être sans coût |
| 8 | **Ce qui se passera si je ne réponds pas** : relance, puis clôture au bout de **7 jours**, sans révélation | On ne laisse jamais quelqu'un dans le silence |
| 9 | **La case d'acceptation, non pré-cochée** (RG70) | Une acceptation pré-cochée n'est pas une acceptation |
| 10 | Le **lien vers les CGU** dans leur **version en vigueur**, avec un **résumé en langage courant** de la clause de non-contournement | La clause vit dans les CGU ; le résumé évite qu'on la découvre plus tard |
| 11 | Un **bouton de refus** aussi visible que le bouton d'acceptation | Un refus difficile à trouver est un consentement extorqué |

**RG70** — **Libellé de la case, imposé** — formulation à faire valider par un juriste (§Checklist
CGU) :

> **« J'accepte cette mise en relation. Mon identité et les informations de mon profil seront
> communiquées à l'autre partie au moment où les siennes me seront communiquées. J'ai pris
> connaissance des conditions générales d'utilisation (version {X} du {date}), dont la clause de
> non-contournement. »**

La case est **non pré-cochée**, le bouton d'acceptation reste **inactif** tant qu'elle ne l'est pas,
et le contrôle est **refait côté serveur**.

**RG71** — **Aucune coordonnée directe de l'autre partie ne figure sur l'écran d'acceptation**, ni
dans la réponse servie par l'API — pas même vide, pas même nulle (`10` RG48, `06` RG39). Le contrôle
porte sur la **réponse**, jamais sur l'écran.

**RG72** — **Accepter enregistre** : `advertiser_accepted_at` **ou** `creator_accepted_at`, la
**version de CGU** correspondante, et un événement chaîné `introduction.party_accepted`. Cette
acceptation est **distincte** de l'acceptation des CGU à l'inscription : c'est une acceptation
**spécifique à cette mise en relation**, et c'est elle qui rend la clause opposable sur ce dossier.

**RG73** — **Tant qu'une seule partie a accepté, rien n'est révélé.** L'écran de la partie qui a
accepté affiche : **« Vous avez accepté le {date}. Nous attendons la réponse de l'autre partie. »** Il
n'indique **jamais** qui est l'autre partie, ni si elle a ouvert l'invitation, ni si elle hésite.

**RG74** — **L'instant exact de la révélation est la seconde acceptation.** Dans **une seule
transaction**, et dans cet ordre :

| # | Ce qui se produit | Garantie |
|---|---|---|
| 1 | `identity_revealed_at = now()` | **Écriture unique**, par la fonction `matching.reveal_identity()` ; aucun rôle humain n'a ce droit (`03` C(21), `04` §5.6) |
| 2 | Écriture de l'événement chaîné `introduction.identity_revealed` | Registre en ajout seul, chaîné par empreinte (`04` §4.3) |
| 3 | **Création de la conversation** et de ses **trois participants** : la marque, le créateur, **le commercial responsable** | Le commercial est un participant de première classe, visible et nommé dès l'origine (**A3**) |
| 4 | Création de l'affaire (`deals`) à l'état `open`, rattachée à cette mise en relation | Pas d'affaire orpheline (`03` C(27)) ; c'est la ligne que le pipeline alimentera (`01` §6) |
| 5 | **Mise en file de deux e-mails de confirmation**, un par partie | La preuve externe (RG78) |
| 6 | Notification au commercial responsable | Il doit entrer dans le fil, pas le découvrir trois jours plus tard |

**Tout ou rien.** Si une seule de ces écritures échoue, aucune ne subsiste. Il n'existe **jamais**
une mise en relation révélée sans conversation, sans événement de registre ou sans e-mail en file.

**RG75** — **La révélation est irréversible.** Ce qui est révélé est révélé : `approved` avec
`identity_revealed_at` posé est un **état terminal**. Une partie qui change d'avis ne « dé-révèle »
rien ; elle **clôt la conversation** avec un motif *(document `12`)*.

**RG76** — **Ce que la révélation ouvre exactement** :

| Partie | Ce qu'elle obtient en plus |
|---|---|
| **La marque** | La couche révélable du profil créateur : pseudos, identifiants, liens de réseaux, chiffres exacts **avec leur source et leur date de mesure** (`07` RG45). **Jamais** la couche identifiante réservée aux rôles internes (`10` RG79) |
| **Le créateur** | Le **prénom** de l'interlocuteur de la marque, sa fonction étant déjà publique (**D40**, `06` RG38). **Jamais son e-mail, son téléphone ni sa page de contact** (**D46**, arbitrage du 2026-09-24) |

**RG77** — **La révélation est une politique d'accès en base**, qui teste l'existence d'une mise en
relation révélée entre les deux comptes. **Ce n'est pas un booléen passé à un composant d'affichage**
(`10` RG79). C'est le bug le plus probable et le plus grave du MVP : il ne se voit pas à l'écran, il
ne fait échouer aucun test fonctionnel, et il détruit d'un seul coup **A2**, **D16** et le modèle
économique.

**RG78** — **L'e-mail de confirmation est obligatoire, et il n'admet aucun raccourci.** Chaque partie
reçoit un e-mail portant **exactement** :

| Élément | Précision |
|---|---|
| La **référence** `MER-2026-000123` | En objet et en corps |
| La **date et l'heure avec le fuseau** | Jamais une date sans fuseau |
| Le **nom des deux parties** | C'est ce qui rend l'e-mail contredisable sur le champ |
| Le **nom du commercial INFLUX** qui suit l'affaire | Et une adresse INFLUX pour lui répondre |
| La **campagne** concernée | Titre et référence |
| La **version de CGU applicable au destinataire** et **la date à laquelle il l'a acceptée** | Chaque partie a la sienne |
| Un **lien vers la conversation** | Le seul chemin proposé pour échanger |

Et **ne contient jamais** : une coordonnée directe de l'autre partie, une pièce jointe, un extrait de
message, un montant de commission, un vocabulaire de preuve (RG13).

> **Pourquoi cet e-mail est la preuve la plus forte et la moins chère.** Il **sort du système
> d'INFLUX** : une copie est conservée par le prestataire d'envoi, par les serveurs de messagerie des
> deux parties, souvent par les parties elles-mêmes — et INFLUX ne contrôle aucune de ces copies,
> c'est précisément ce qui leur donne de la valeur. Il est horodaté par des tiers dans ses en-têtes.
> Il a été reçu **au moment des faits** par deux personnes qui pouvaient le contredire immédiatement.
> Et il coûte une fraction de centime. Le registre chaîné, lui, est **auto-produit** : sa force ne
> vient pas de son autorité, mais de sa **cohérence** avec ces e-mails.

**RG79** — Le **`messageId`** renvoyé par le prestataire est **conservé** et rattaché à la mise en
relation. Sans lui, on ne sait pas retrouver l'e-mail chez le prestataire : le lien entre notre
registre interne et la preuve détenue par un tiers est rompu.

**RG80** — **Un échec d'envoi n'annule jamais la révélation** : elle est enregistrée, l'envoi est
rejoué selon le pipeline de leads, et **un échec définitif est une alerte backoffice**, jamais un
silence. Une mise en relation sans e-mail confirmé est une mise en relation sans preuve externe : le
commercial doit le savoir et rattraper le coup à la main.

**RG81** — **Un troisième message part au commercial responsable**, distinct des deux e-mails de
confirmation : il lui dit d'entrer dans le fil. Il n'est pas une preuve, il est une consigne de
travail.

---

### G — Les deux refus, qu'il ne faut jamais confondre

**RG82** — **Il existe deux refus distincts**, à deux moments différents, par deux acteurs différents,
avec deux listes de motifs différentes et deux messages différents. Les confondre produirait le pire
des malentendus : un créateur qui croit avoir été rejeté par une marque qui n'a jamais rien vu de lui.

| | **Refus A — INFLUX refuse la demande** | **Refus B — une partie refuse la mise en relation** |
|---|---|---|
| Quand | Avant validation, dans la file | Après validation, à l'écran d'acceptation |
| Qui | Le **commercial titulaire** | La marque **ou** le créateur |
| Statut résultant | `rejected` + motif de la **liste A** | `rejected` + `declined_by_party` + **côté** + motif de la **liste B** |
| Ce que sait l'autre partie | **Rien, jamais** (`03` C(18)) | Qu'INFLUX n'a pas pu ouvrir la mise en relation — **jamais le motif, jamais qui a refusé** |
| Ce que sait l'initiateur | Le motif typé, dans sa langue, **attribué à INFLUX** | Le même message neutre |
| Révélation | Aucune | Aucune |
| Effet sur les plafonds | Libère une place (`11` RG62) | Libère une place |

**RG83** — **Liste A — motifs de refus d'une demande de contact** (liste fermée, propre à ce
déclencheur, distincte de celle des candidatures de `11` RG92). Chaque motif porte **le message
envoyé à la marque** et son caractère **corrigible** :

| Motif | Message à la marque | Corrigible |
|---|---|---|
| `off_brief` | « Ce créateur ne correspond pas à ce que vous décrivez. » | Oui |
| `budget_mismatch` | « L'écart entre votre budget et les tarifs de ce créateur est trop important. » | Oui |
| `motive_insufficient` | « Votre motif ne nous permet pas de préparer la mise en relation. Dites-nous ce que vous attendez de ce créateur. » | Oui |
| `contact_details_in_text` | « Votre message contient une adresse, un numéro ou un lien. Les échanges avec le créateur se font dans INFLUX, une fois la mise en relation ouverte. » *(corrigé le 2026-09-24, D46)* | Oui |
| `campaign_closed` | « La campagne rattachée n'est plus ouverte. » | Oui |
| `creator_unavailable` | « Ce créateur n'est pas disponible pour cette demande. » | Non |
| `duplicate` | « Une mise en relation est déjà en cours avec ce créateur. » | Non |
| `account_unavailable` | « Ce créateur n'est pas disponible. » | Non |
| `suspected_circumvention` | Message neutre + **escalade administrateur obligatoire** | Non |
| `other` | Message rédigé par l'agent, **en complément** d'une explication typée | Selon le cas |

**RG84** — **Aucun motif n'expose une information du créateur.** En particulier, un créateur qui a
refusé le secteur de la marque (`11` RG42) produit un refus `creator_unavailable` : la liste des
secteurs refusés est une exclusion **silencieuse**, et elle le reste. De même, un **blocage entre les
deux parties** n'est jamais un motif visible : la demande n'aurait pas dû pouvoir être créée
(`04` §5.6), et si elle l'a été, elle est refusée avec `creator_unavailable`.

**RG85** — **Aucun motif n'attribue la décision à l'autre partie**, ni explicitement, ni par allusion
(`11` RG94). Le contrôle du libellé de chaque motif est un point de revue obligatoire d'`expert-ux`.

**RG86** — **Le motif « autre » est exceptionnel et surveillé** : au-delà de **10 % des refus** sur un
mois, la liste est incomplète et doit être étendue. Un commentaire libre est autorisé **en complément**
d'un motif typé, **jamais à sa place**.

**RG87** — **Liste B — motifs de refus par une partie sollicitée** (liste fermée, courte, **visible
des seuls rôles internes**) :

| Motif | Disponible pour | Ce qu'il déclenche en interne |
|---|---|---|
| `not_available` | Les deux | Rien |
| `not_relevant` | Les deux | Rien |
| `terms_not_suitable` | Les deux | Signal de calibrage tarifaire, remonté dans les indicateurs |
| **`pre_existing_relationship`** | Les deux | **Tâche commerciale : appeler.** Et **consignation d'une relation préexistante** au sens de la clause de sauvegarde des CGU (`01` §8.1) |
| `no_longer_interested` | Les deux | Rien |
| `other` | Les deux | Commentaire facultatif, non transmis |

> **`pre_existing_relationship` est le motif le plus précieux de la liste.** Une partie qui déclare
> « nous travaillons déjà ensemble » fait deux choses d'un coup : elle protège INFLUX d'une
> réclamation infondée, et elle documente, **au moment des faits**, la clause de sauvegarde « relation
> préexistante » que le juriste exigera. Reconstituer cette information deux ans plus tard est
> impossible. **Le ton de l'écran reste celui d'un partenaire, jamais d'un contrôle** : « connaissez-vous
> déjà cette marque ? ».

**RG88** — **Le motif d'un refus de partie n'est jamais communiqué à l'autre partie**, sous aucune
forme, y compris agrégée. L'autre partie — et elle seule si elle avait accepté — reçoit :
**« INFLUX n'a pas pu ouvrir cette mise en relation. »** Rien d'autre.

**RG89** — **Refuser ne coûte rien et ne se justifie pas.** Le motif est demandé, **une option
« je préfère ne pas dire » existe** (`other` sans commentaire), et le refus est enregistré dans tous
les cas. Rendre le motif obligatoire produirait des motifs faux, donc des statistiques fausses.

**RG90** — **Un refus de partie est journalisé** (`introduction.party_declined`) avec le côté, le
motif et l'horodatage. C'est une décision, pas un abandon.

---

### H — Relances, délais et expiration

**RG91** — **Le délai d'acceptation est de 7 jours calendaires** à compter de l'envoi de l'invitation
(valeur de départ, **paramètre en table**, cohérente avec `11` RG78 et **D39**). Il court pour chaque
partie à partir du moment où **son** invitation est partie.

**RG92** — **Deux relances, et deux seulement**, adressées **uniquement à la partie qui n'a pas
répondu** :

| Échéance | Qui est relancé | Canal | Contenu |
|---|---|---|---|
| **J+3** | La partie silencieuse | E-mail + écran | Rappel factuel : la campagne, le motif, le nom du commercial, la date limite. **Aucune pression, aucune mention de l'autre partie** |
| **J+6** | La partie silencieuse | E-mail + écran | Dernier rappel, avec la date exacte de clôture |
| **J+6** | **Le commercial responsable** | Tâche au backoffice | « Appeler {partie} — la mise en relation {MER-…} se clôt demain » |

**RG93** — **Une partie qui a accepté n'est jamais relancée** et n'est jamais informée que l'autre
tarde. Elle voit le message de RG73, inchangé.

**RG94** — **À J+7, la mise en relation est clôturée sans suite** (`expired`), avec un **sous-motif
interne** qui distingue les causes. Les deux parties reçoivent le **même message neutre** :
**« Cette mise en relation est clôturée. »** Aucune ne sait ce que l'autre a fait.

**RG95** — Les **sous-motifs de clôture sans suite** couvrent les causes objectives et les silences :

| Sous-motif | Cause |
|---|---|
| `campaign_closed` | La campagne a été close, dépubliée ou retirée |
| `application_deadline_passed` | La date limite de candidature est passée avant le traitement |
| `advertiser_suspended` | Le compte de la marque a été suspendu ou supprimé |
| `creator_unavailable` | Le compte du créateur a été suspendu, supprimé, ou son profil dépublié |
| `no_advertiser_answer` | La marque n'a pas répondu à l'invitation dans le délai |
| **`no_creator_answer`** | Le créateur n'a pas répondu à l'invitation dans le délai — **valeur manquante au modèle de données, voir §Impacts** |
| **`no_answer_both_parties`** | Aucune des deux parties n'a répondu (cas propre à la proposition INFLUX) — **valeur manquante, voir §Impacts** |

**RG96** — **Aucune expiration silencieuse.** Chaque clôture est notifiée, journalisée, et reste
consultable par ses acteurs avec sa date. Une demande qui disparaît sans un mot est une promesse
rompue (`intermediation-tracking`, étape 3, point 6).

**RG97** — **L'initiateur d'une demande en attente peut la retirer** à tout moment tant que rien n'est
révélé : `withdrawn`, immédiat, journalisé, libère une place dans ses plafonds, et **la partie visée
n'en sait jamais rien** (`03` C(18), `10` cas limite, `11` RG76).

**RG98** — **Après la révélation, le retrait n'existe plus.** Ce qui se clôt, c'est la conversation,
avec un motif *(document `12`)*.

**RG99** — **Le dépassement du délai de traitement de la file produit trois effets, tous
obligatoires** (`intermediation-tracking`, étape 3, point 6) :

1. **L'initiateur est informé honnêtement**, à l'écran : « votre demande prend plus de temps que
   prévu, un commercial INFLUX la traite » — factuel, sans excuse automatique et **sans promesse
   nouvelle** (`11` RG73) ;
2. **Une alerte remonte au backoffice**, dans une liste dédiée et visuellement distincte ;
3. **Une escalade administrateur** est déclenchée à **J+1** après l'échéance.

Et **jamais un quatrième effet** : l'entrée n'est pas expirée (RG26).

---

### I — Le cycle de vie complet d'une mise en relation

**RG100** — Une mise en relation connaît **huit états, et huit seulement**. La colonne « ce que voit
le membre » est un **libellé imposé**, pas une suggestion :

| # | État produit | Statut technique | Événement d'entrée | Ce que voit l'initiateur | Ce que voit l'autre partie |
|---|---|---|---|---|---|
| 1 | **En attente de prise en charge** | `pending_review`, sans titulaire | Déclencheur 1 ou 2 | « En cours d'examen par INFLUX, réponse sous 1 jour ouvré » | **Rien** (`03` C(18)) |
| 2 | **En cours d'examen** | `in_review` | Prise en charge avec verrou | **Le même libellé que l'état 1** (RG101) | **Rien** |
| 3 | **Validée, en attente d'acceptation** | `approved`, `identity_revealed_at` **vide** | Validation du commercial, **ou création d'une proposition INFLUX** | « Validée par INFLUX » | L'invitation à accepter |
| 4 | **Mise en relation ouverte** | `approved`, `identity_revealed_at` **posé** | **La seconde acceptation** | « Mise en relation ouverte — référence MER-… » | Idem, identités révélées |
| 5 | **Refusée par INFLUX** | `rejected` + motif liste A | Refus du commercial titulaire | Le motif typé, attribué à INFLUX | **Rien, jamais** |
| 6 | **Refusée par une partie** | `rejected` + `declined_by_party` + côté + motif liste B | Refus à l'écran d'acceptation | « INFLUX n'a pas pu ouvrir cette mise en relation. » | Le même message |
| 7 | **Retirée** | `withdrawn` | Retrait de l'initiateur ; **pour une proposition, retrait du commercial** | « Vous avez retiré cette demande le … » | Rien, ou « INFLUX a retiré cette proposition » |
| 8 | **Clôturée sans suite** | `expired` + sous-motif | Cause objective ou silence (RG95) | « Cette mise en relation est clôturée. » | Le même message |

**RG101** — **Le membre ne voit pas la différence entre « en attente » et « en cours d'examen »**. La
mécanique interne de la file ne lui est pas exposée : elle l'inviterait à interpréter un silence
(`11` RG72).

**RG102** — **Transitions autorisées, et aucune autre.** Toute transition est journalisée avec son
auteur, sa date et son motif :

| Depuis | Vers | Qui | Condition |
|---|---|---|---|
| — | 1 `pending_review` | Marque ou créateur | Déclencheur 1 ou 2 ; acceptation de l'initiateur enregistrée |
| — | 3 `approved` | Commercial | Déclencheur 3 ; `owner_agent_id` = l'auteur, d'office |
| 1 | 2 `in_review` | Commercial | Prise en charge par transition conditionnelle atomique |
| 1, 2 | 7 `withdrawn` | L'initiateur | Avant décision |
| 1, 2 | 8 `expired` | Système | Cause objective de RG95 — **jamais le seul dépassement du délai** |
| 2 | 3 `approved` | Commercial **titulaire** | — |
| 2 | 5 `rejected` | Commercial **titulaire** | Motif typé obligatoire |
| 3 | **4 révélée** | **Système** | **Les deux acceptations existent** — fonction unique, transaction unique |
| 3 | 6 `rejected` | Marque ou créateur | Refus à l'écran d'acceptation |
| 3 | 7 `withdrawn` | L'initiateur, ou le commercial pour une proposition | Avant révélation |
| 3 | 8 `expired` | Système | Silence à J+7, ou cause objective |
| **4** | **—** | **—** | **État terminal. Une mise en relation révélée ne se dé-révèle pas** |
| 5, 6, 7, 8 | — | — | États terminaux |

**RG103** — *Écart assumé avec la skill `intermediation-tracking`, qui décrit `approved` comme un état
terminal dès la validation — **levé le 2026-09-24** : D45 (double acceptation) retient cette
distinction et la skill a été alignée.* Ce document distingue **`approved` non révélée** (états 3, encore
réversible vers 6, 7, 8) et **`approved` révélée** (état 4, terminal). Sans cette distinction, un
refus de partie après validation n'aurait nulle part où aller — et c'est le cas nominal de la
proposition INFLUX. Voir §Impacts et **Q1**.

**RG104** — **Un doublon actif est impossible** : une mise en relation active (états 1, 2, 3, 4) pour
le même triplet marque + créateur + campagne **bloque la création d'une seconde** (`04`
`introductions_active_pair_idx`). Le nouveau déclencheur est **rattaché à l'existante** sous forme
d'une seconde expression d'intérêt (`04` `interest_submissions`), et c'est le signal le plus fort du
produit (RG33, RG43).

**RG104bis — Renouvellement d'une collaboration (D42, arbitrage du fondateur du 2026-09-24).** Une
mise en relation révélée (état 4) reste terminale et continue de bloquer les demandes de contact et
les candidatures sur le même triplet. **La seule voie de renouvellement est une proposition INFLUX**
créée par un commercial, **une fois l'affaire précédente terminée**, portant un **lien vers la mise
en relation d'origine**. Elle suit le parcours normal de §E et §F (double acceptation, D45). La
créance éventuelle reste rattachée à la première révélation (D29). *À préciser par `product-owner`
et `expert-database` : la définition de « terminée » (perdue, annulée ou soldée, `14` RG58) et le
champ de lien, qui lève l'index d'unicité pour ce seul cas.*

---

### J — Alertes et supervision du commercial

**RG105** — **Toute alerte a un seuil écrit, un destinataire nommé et une action possible.** Si
l'agent ne peut rien faire en la lisant, elle n'a rien à faire là (`backoffice-ops`, règle 32).

**RG106** — Les **alertes de ce périmètre** sont une liste fermée. Chacune est **écrite**, jamais
portée par la seule couleur :

| # | Alerte | Seuil de départ (en table) | Destinataire | Action attendue |
|---|---|---|---|---|
| A1 | **Demande restée sans preneur** | Aucune prise en charge à l'échéance de l'objectif interne (**4 h ouvrées**, RG17) | Tous les commerciaux, en tête de file | Prendre en charge |
| A2 | **Décision hors délai** | `sla_due_at` dépassé sans décision | Liste dédiée + **escalade administrateur à J+1** | Décider, même tard (RG26) |
| A3 | **Verrou orphelin** | 30 minutes sans décision | Le titulaire, puis les administrateurs | Reprendre ou libérer |
| A4 | **Acceptation en attente** | J+3 puis J+6 après l'invitation | **Le commercial responsable** | Relancer, puis appeler |
| A5 | **Fil silencieux après révélation** | **14 jours** sans message **et** sans état d'affaire mis à jour (`01` M6) | Le commercial responsable | Appeler — **jamais une accusation automatique** |
| A6 | ~~Mise en relation révélée sans état d'affaire~~ **→ remplacée par l'alerte « montant non saisi » de `14` RG8bis** (14 jours vers le responsable, 30 jours vers l'administrateur). *Correction du 2026-09-24 : depuis l'arbitrage du 2026-09-19, l'affaire est toujours créée à la révélation ; ce qu'on surveille n'est plus l'absence d'affaire mais l'absence de contenu* | **14 j puis 30 j** | Le commercial responsable + son administrateur | Signal de contournement **ou** de saisie négligée. On appelle le commercial (`01` §11) |
| A7 | **Coordonnée détectée** dans un texte | Dès la première détection | Le commercial responsable | Lire, décider, refuser si besoin. **Aucun masquage, aucun blocage** (`01` M5) |
| A8 | **Échec définitif d'envoi** d'un e-mail de confirmation | Après épuisement des rejeux | Le commercial responsable + administrateur | Rattraper à la main : **une mise en relation sans e-mail confirmé est une mise en relation sans preuve externe** |
| A9 | **Rupture ou trou dans la chaîne du registre** | Vérification périodique (`04` `chain_checks`) | Administrateur, immédiatement | Incident : une chaîne cassée ne se répare pas, elle s'explique |
| A10 | **Refus « autre » au-delà de 10 %** sur un mois | 10 % des refus | `product-owner` + administrateur | Étendre la liste des motifs (RG86) |

**RG107** — Le **tableau de bord de la file** affiche en permanence : entrées en attente, **ancienneté
de la plus ancienne**, délai médian et délai du 9ᵉ cas sur 10 pour la prise en charge **et** pour la
décision, **part des décisions hors délai**, répartition des refus par motif, mises en relation
validées sans acceptation depuis plus de 3 jours, propositions INFLUX envoyées et leur taux
d'acceptation, et **nombre de mises en relation traitées par commercial et par semaine**.

**RG108** — **« Mises en relation traitées par commercial et par semaine » est l'indicateur à
instrumenter en premier** après le délai de file (`backoffice-ops`, règle 20). Le plafond de
croissance d'INFLUX n'est pas technique, il est humain : c'est cet indicateur qui dira si la
plateforme fait passer le métier à l'échelle.

**RG109** — **Ce qu'un rôle interne ne doit jamais pouvoir faire** dans ce périmètre — chaque point
est un **défaut bloquant** s'il est possible :

1. Modifier ou supprimer une entrée du registre ;
2. Poser ou modifier `identity_revealed_at` autrement que par la fonction unique ;
3. Révéler une identité sans **deux** acceptations enregistrées ;
4. Valider une entrée dont il n'est pas le titulaire du verrou ;
5. Décider sur une entrée impliquant un compte qu'il détient ou représente (RG35) ;
6. Modifier le texte écrit par un membre (RG41) ;
7. Refuser sans motif typé (RG8) ;
8. **Exporter** la file, la liste des mises en relation ou l'annuaire, sous quelque forme que ce soit,
   y compris par une pagination détournée (`03` C(17)) ;
9. Agir sans que son nom et l'horodatage soient enregistrés ;
10. Consulter un écran de décision, donc deux identités non révélées, sans que ce soit journalisé.

**RG110** — **Le backoffice est une surface privilégiée** : hôte distinct, non indexé, **double
facteur obligatoire** sur tous les comptes `agent` et `admin`, session courte, autorisation vérifiée
**côté serveur** pour chaque action. Le masquage d'interface n'est jamais un contrôle d'accès.

---

### K — Notifications, e-mails, leads et accessibilité

**RG111** — Ce que reçoit chaque acteur, et rien d'autre :

| Événement | Marque | Créateur | Commercial |
|---|---|---|---|
| Demande ou candidature envoyée | Accusé (initiateur) | Accusé (initiateur) | Entrée en file |
| Prise en charge | **Rien** | **Rien** | Verrou posé |
| Validation | Invitation **ou** accusé « validée » selon le côté | Idem | Attribution de l'affaire |
| Proposition INFLUX créée | Invitation | Invitation | Compte rendu d'envoi |
| **Acceptation par soi** | Confirmation « nous attendons l'autre partie » | Idem | — |
| **Acceptation par l'autre** | **Rien** avant la révélation | **Rien** | — |
| **Révélation** | **E-mail de confirmation (RG78)** + écran | **E-mail de confirmation (RG78)** + écran | Message de consigne (RG81) |
| Refus par INFLUX | Le motif typé, si initiateur | Le motif typé, si initiateur | — |
| Refus par une partie | Message neutre de RG88 | Message neutre | Motif complet + tâche si `pre_existing_relationship` |
| Clôture sans suite | Message neutre | Message neutre | Sous-motif interne |
| Délai de traitement dépassé | **Écran uniquement** | **Écran uniquement** | Alerte A2 |
| Relances J+3 et J+6 | Si silencieuse | Si silencieuse | Tâche à J+6 |

**RG112** — **Aucune notification ne pousse à sortir de la plateforme.** Aucun e-mail ne propose
d'écrire directement à l'autre partie, ne cite un domaine cliquable, ne reproduit un extrait de texte
contenant un élément de contact, et **aucun n'accepte de pièce jointe** (`01` M5).

**RG113** — Les notifications de ce périmètre sont **transactionnelles** : elles exécutent la
relation et **ne dépendent pas du consentement marketing**. Les relances commerciales, elles, en
dépendent.

**RG114** — **Ce qui part vers Brevo et Apollo** : un événement `lead.updated` selon le pipeline du
Lot 1, charge utile réduite à des identifiants, **consentement relu à la consommation**. **Ne partent
jamais** : l'identité de l'autre partie, le nom de la campagne, le motif, les montants, le texte des
expressions d'intérêt, le motif de refus. Au plus, sous consentement marketing, un **indicateur
d'activité non identifiant** : « a une mise en relation ouverte », et la date de la dernière. **La
révélation d'identité ne crée aucun attribut Brevo nommant l'autre partie** — ce serait recréer, chez
un tiers, l'annuaire qu'on protège.

**RG115** — **Un champ absent est envoyé vide, jamais rempli d'une valeur inventée** (règle héritée du
Lot 1).

**RG116** — Chaque écran de ce périmètre possède **quatre états explicites** : repos, chargement,
succès, échec. **Aucune saisie n'est perdue sur erreur**, y compris le motif d'une proposition dont
l'envoi échoue.

**RG117** — Accessibilité : chaque champ porte une étiquette visible, un champ en erreur pointe vers
son message, le focus va au premier champ invalide, les contrastes respectent WCAG AA, et **le vert
de marque n'est jamais le seul porteur d'un état** — les huit états de RG100, le compte à rebours du
délai et les dix alertes portent chacun un **libellé écrit**.

**RG118** — Les écrans membres (invitation, acceptation, état d'une demande) sont conçus **mobile
d'abord**. Un créateur doit pouvoir accepter une mise en relation au pouce, en trente secondes.

**RG119** — Tous les messages existent en **français et en anglais**, aucun n'est écrit en dur. La
langue du backoffice reste **D36**.

| Clé | Français | English |
|---|---|---|
| `queue.empty` | Aucune demande en attente — la dernière a été traitée il y a {minutes} min. | No pending request — the last one was handled {minutes} min ago. |
| `queue.claimed.byOther` | Déjà prise en charge par {agent} depuis {time}. | Already handled by {agent} since {time}. |
| `queue.claimed.byMe` | Vous avez pris cette demande en charge à {time}. | You took this request at {time}. |
| `queue.sla.remaining` | Il reste {duration} avant l'échéance de traitement. | {duration} left before the handling deadline. |
| `queue.sla.breached` | Hors délai depuis {duration}. Une décision reste possible. | Overdue by {duration}. A decision is still possible. |
| `queue.bothParties` | Les deux parties se sont exprimées. Valider ouvrira immédiatement la conversation. | Both parties have expressed interest. Approving will open the conversation immediately. |
| `intro.status.review` | En cours d'examen par INFLUX. Réponse sous 1 jour ouvré. | Under review by INFLUX. Reply within 1 business day. |
| `intro.status.late` | Votre demande prend plus de temps que prévu. Un commercial INFLUX la traite. | Your request is taking longer than expected. An INFLUX account manager is handling it. |
| `intro.status.waitingOther` | Vous avez accepté le {date}. Nous attendons la réponse de l'autre partie. | You accepted on {date}. We are waiting for the other party's reply. |
| `intro.status.opened` | Mise en relation ouverte — référence {reference}. | Introduction opened — reference {reference}. |
| `intro.status.closed` | Cette mise en relation est clôturée. | This introduction is closed. |
| `intro.declined.neutral` | INFLUX n'a pas pu ouvrir cette mise en relation. | INFLUX was unable to open this introduction. |
| `intro.accept.consent` | J'accepte cette mise en relation. Mon identité et les informations de mon profil seront communiquées à l'autre partie au moment où les siennes me seront communiquées. J'ai pris connaissance des conditions générales d'utilisation (version {version} du {date}), dont la clause de non-contournement. | I accept this introduction. My identity and profile information will be shared with the other party at the same time as theirs is shared with me. I have read the terms of use (version {version}, {date}), including the no-circumvention clause. |
| `intro.accept.ifAccepted` | Si vous acceptez, une conversation s'ouvre avec {agent}, d'INFLUX, et nous vous envoyons tous les deux une confirmation par e-mail. | If you accept, a conversation opens with {agent} from INFLUX, and we email a confirmation to both of you. |
| `intro.accept.ifDeclined` | Si vous refusez, rien n'est communiqué et l'autre partie n'apprend pas votre motif. | If you decline, nothing is shared and the other party is not told your reason. |
| `intro.accept.ifNoAnswer` | Sans réponse de votre part avant le {date}, cette mise en relation sera clôturée et rien ne sera communiqué. | Without a reply from you before {date}, this introduction will be closed and nothing will be shared. |
| `intro.decline.preExisting` | Nous travaillons déjà ensemble. | We already work together. |
| `proposal.preview` | {count, plural, one {# mise en relation distincte sera créée} other {# mises en relation distinctes seront créées}}. | {count, plural, one {# separate introduction will be created} other {# separate introductions will be created}}. |
| `proposal.partialFailure` | {sent} propositions envoyées, {failed} non envoyées. Voici pourquoi. | {sent} proposals sent, {failed} not sent. Here is why. |
| `proposal.reasonRequired` | Écrivez pourquoi vous rapprochez ces créateurs de cette campagne. | Write why you are matching these creators with this campaign. |

---

## Cas limites

### Les huit cas limites de la skill `feature-spec`

**1 — Donnée absente**

| Situation | Comportement attendu |
|---|---|
| La demande de contact n'a pas de campagne rattachée | Recevable (`04` : campagne facultative pour ce déclencheur). L'écran de décision affiche « aucune campagne rattachée » et le commercial peut refuser avec `motive_insufficient` |
| Le profil de la marque n'a pas d'interlocuteur renseigné | La décision reste possible ; le bloc affiche « interlocuteur non renseigné », jamais un vide |
| Les chiffres du créateur datent de plus de 90 jours | Alerte affichée, décision possible, motif de refus disponible |
| La version de CGU en vigueur n'existe pas pour la langue du membre | **Blocage** : aucune acceptation n'est enregistrable sans version identifiée (`04` `introductions_acceptance_requires_terms`). Alerte administrateur immédiate |
| Le référentiel de tranches n'a pas de bornes nettes pour la devise | **Le net créateur estimé n'est pas affiché**, jamais estimé à la volée (`04` §13) |
| Le commercial responsable a quitté l'entreprise | Impossible : la réattribution est un préalable à la désactivation (RG49). Si la donnée manque malgré tout, l'entrée remonte en alerte administrateur |

**2 — Valeur nulle, négative ou aberrante**

| Situation | Comportement attendu |
|---|---|
| Motif de proposition de 3 caractères | Refus côté serveur : minimum 10 caractères (`04` §5.6) |
| Sélection de 0 créateur | Le bouton « proposer » est inactif, avec le message qui le dit |
| Sélection de 45 créateurs | Refus au plafond de 20, message qui nomme le plafond et propose de scinder |
| Délai d'acceptation paramétré à 0 jour | Refus à la saisie du paramètre : borne minimale de 1 jour, en table |
| Deux acceptations horodatées à la même milliseconde | Sans importance : la révélation est déclenchée par la transaction qui **constate** la seconde, sous verrou de ligne (`04` `for update`) |
| `sla_due_at` antérieur à la création (politique mal saisie) | Refus à l'écriture de la politique ; l'entrée existante reste jugée sur son échéance figée |

**3 — Doublon**

| Situation | Comportement attendu |
|---|---|
| La marque renvoie deux fois la même demande (double clic, deux onglets) | **Une seule mise en relation** ; l'index unique partiel le garantit en base |
| Une demande de contact et une candidature existent sur le même triplet | **Une seule mise en relation**, **deux expressions d'intérêt** rattachées. Alerte « les deux parties se sont cherchées » (RG33), et validation révélant immédiatement (RG43, RG44) |
| Le commercial propose un créateur déjà en relation avec cette marque sur cette campagne | Rejeté à la création, compte rendu nominatif (RG60) |
| Le commercial propose deux fois le même créateur dans la même sélection | Dédoublonné silencieusement avant l'aperçu du clic 2 |
| Deux commerciaux proposent le même créateur à la même campagne à la même seconde | Un seul aboutit, l'autre reçoit le message « déjà en cours ». L'unicité est en base, pas dans le code |
| Une nouvelle campagne de la même marque vers le même créateur | **Autorisé** : une campagne est une affaire distincte |

**4 — Action concurrente**

| Situation | Comportement attendu |
|---|---|
| Deux commerciaux ouvrent la même entrée | Le premier la prend en charge, le second la lit **en lecture seule** avec « déjà prise en charge par … ». Aucune décision concurrente n'est possible (RG28, RG29) |
| L'initiateur retire pendant que le commercial valide | La transaction qui aboutit la première gagne ; l'autre reçoit un message clair, jamais une erreur. Les deux gestes sont journalisés |
| Les deux parties acceptent à la même seconde | Le verrou de ligne sérialise : une seule transaction pose `identity_revealed_at`, la seconde constate « déjà révélée » et n'écrit rien |
| Une partie accepte pendant que le commercial retire sa proposition | Si la révélation est posée, elle est **définitive** (RG75) et le retrait devient une clôture de conversation (document `12`) |
| La campagne est close pendant l'examen | L'examen se poursuit : le commercial peut valider ou clôturer avec le sous-motif. **Aucune sortie automatique de la file** |
| Un administrateur modifie le délai d'acceptation pendant qu'une invitation court | La nouvelle valeur s'applique aux **invitations suivantes**, jamais rétroactivement |
| Le verrou expire pendant que le commercial rédige son motif de refus | La décision est refusée avec un message qui **conserve sa saisie** et lui propose de reprendre la main |

**5 — Droit insuffisant**

| Situation | Comportement attendu |
|---|---|
| Une marque demande la charge utile d'une mise en relation non révélée | Aucune colonne identifiante servie, **pas même vide** (`10` RG79, `03` C(21)) |
| Un créateur tente de savoir si une demande refusée le concernait | Aucune ligne servie, tentative journalisée (`03` C(18)) |
| Un agent tente de poser `identity_revealed_at` par une mise à jour ordinaire | Refus **en base** : `REVOKE UPDATE` de colonne + déclencheur (`04` §5.6) |
| Un agent tente de valider une entrée dont il n'a pas le verrou | Refus côté serveur, message clair, tentative journalisée |
| Un agent tente d'exporter la file | Refus : l'export n'existe pour personne, administrateur compris (`03` C(17)) |
| Un agent ouvre l'écran de décision d'une entrée qui ne le concerne pas | **Autorisé au MVP** (tous les commerciaux voient tout) **et journalisé**. C'est la préparation du portefeuille cloisonné (`backoffice-ops`, règle 17) |
| Un agent sans double facteur atteint le backoffice | Accès refusé, tentative journalisée |

**6 — Service externe indisponible**

| Situation | Comportement attendu |
|---|---|
| Le service d'envoi est indisponible au moment de la révélation | **La révélation aboutit** ; les deux e-mails sont mis en file et rejoués. La conversation est ouverte |
| L'envoi échoue définitivement | **Alerte A8**, visible du commercial et de l'administrateur, avec rejeu manuel. Aucun silence : c'est la preuve externe la moins chère du dispositif |
| Brevo est indisponible au moment du `lead.updated` | Sans effet : la ligne de synchronisation passe en attente et est réessayée |
| La base est indisponible pendant l'envoi d'une proposition de 12 créateurs | Rien n'est créé partiellement : la transaction échoue, le panneau conserve la sélection et le motif, un nouvel envoi est proposé |
| La vérification nocturne de la chaîne ne s'exécute pas | **Alerte A9 par absence** : une chaîne qu'on ne vérifie plus doit produire une alerte, pas un silence |

**7 — Abandon en cours de parcours**

| Situation | Comportement attendu |
|---|---|
| Le commercial abandonne une prise en charge | Le verrou expire à 30 minutes, l'entrée retourne en file, l'abandon est journalisé (RG30) |
| Le commercial quitte le panneau de proposition sans envoyer | La sélection et le motif sont conservés le temps de la session ; rien n'est créé, personne n'est notifié |
| Une partie ouvre l'invitation et ne répond pas | Relances J+3 et J+6, clôture J+7 avec message neutre (RG92, RG94) |
| Une partie accepte et l'autre ne répond jamais | Clôture J+7. **La partie qui avait accepté reçoit le message neutre** et n'apprend jamais que l'autre est restée silencieuse |
| Le membre ferme l'écran d'acceptation après avoir coché la case mais sans valider | **Rien n'est enregistré.** Une case cochée n'est pas une acceptation ; seul l'envoi l'est |
| Le membre se déconnecte pendant l'acceptation | Soit l'acceptation est enregistrée, soit elle ne l'est pas : **aucun état intermédiaire** |

**8 — Annulation ou retour en arrière après validation**

| Situation | Comportement attendu |
|---|---|
| Le commercial s'est trompé en validant, avant révélation | Il **retire** la mise en relation avec un motif (état 7). L'erreur reste au journal, la correction s'y ajoute |
| Le commercial s'est trompé en validant, **après** révélation | **Irréversible.** Rien ne se défait. On clôt la conversation avec un motif (document `12`) et on l'assume auprès des deux parties |
| Le commercial s'est trompé de motif de refus | Le refus reste ; une correction motivée s'y ajoute et l'initiateur est informé (RG46) |
| Une partie regrette son acceptation avant la seconde | **Aucun retrait d'acceptation n'existe au MVP.** Elle peut demander la clôture au commercial, qui retire la mise en relation avec un motif. *(Hypothèse conservatrice, voir **Q4**.)* |
| Une partie regrette après la révélation | La révélation est définitive ; la conversation se clôt avec un motif |
| Le compte d'une partie est supprimé après la révélation | La mise en relation, sa référence, ses horodatages et le registre sont **conservés sous forme pseudonymisée**, au titre de la constatation et de l'exercice de droits en justice — **à inscrire dans la politique de confidentialité dès le Lot 1** (`01` M4, `backoffice-ops`, cas limite) |
| Un administrateur veut supprimer une mise en relation gênante | **Aucun chemin n'existe.** Le registre est en ajout seul, garanti en base (`04` §4.3) |

### La checklist INFLUX de la skill `feature-spec`

| # | Contrôle | Réponse pour ce document |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission INFLUX, net créateur | **Aucun montant n'est créé ici** (RG12). Sont seulement **réaffichés**, chacun nommé et avec sa devise : la **rémunération par créateur** annoncée par la campagne, le **tarif proposé** par le créateur, le **net créateur estimé** en **tranche lue au référentiel** (`11` RG57) et **jamais montré à une marque** (`11` RG59). Le commercial voit en plus les **tarifs exacts** du profil, en vue identifiée. **Aucune multiplication par un taux, nulle part** (**A1**, `03` C(32)). Aucun contrat, aucune facture, aucun encaissement. Aucun contrôle de pays ouvert (RG11) |
| 2 | **Traçabilité / contournement** | **C'est l'objet même du document.** La révélation est datée une fois pour toutes, confirmée par **deux e-mails qui sortent de nos systèmes** avec leur `messageId` conservé (RG78, RG79), et inscrite au registre chaîné. Le **commercial est participant de la conversation dès son ouverture** — la protection principale (`01` §2). Aucune coordonnée dans un e-mail (RG78, RG112), aucune pièce jointe, détection en **signalement et non en masquage** (RG33), aucun export (RG109-8). **Risque résiduel assumé et signalé :** deux majeurs qui se sont vus peuvent se recontacter ailleurs ; le dispositif rend le geste visible et inconfortable, il ne l'empêche pas (`01` §10). La parade mesurable : indicateur A6 (révélée sans affaire à 30 jours) et motif `pre_existing_relationship` |
| 3 | **Leads** — ce qui part vers Brevo et Apollo, avec quel consentement | `lead.updated` sur le pipeline du Lot 1, **consentement relu à la consommation** (RG113, RG114). **Rien de nominatif sur l'autre partie**, aucun montant, aucun motif, aucun texte. Au plus un indicateur d'activité non identifiant. Les e-mails de ce périmètre sont **transactionnels** et ne dépendent pas du consentement marketing |
| 4 | **Backoffice** — contrepartie interne | **Le document est majoritairement un document de backoffice** : file (§B), écran de décision et verrou (§C), trois actions et motifs typés (§D), proposition INFLUX et son action multiple encadrée (§E), refus (§G), relances (§H), alertes et interdits (§J). Surface privilégiée, double facteur, journalisation des lectures (RG34, RG110) |
| 5 | **Matching hybride** | **Aucun algorithme (D11).** La voie « algorithmique » se limite à un tri de file par échéance et à des exclusions objectives (doublon, blocage, compte suspendu). **La voie humaine est entière et intégralement tracée** : prise en charge, validation, refus motivé, attribution, réattribution, proposition à l'initiative du commercial, relance, clôture. L'intervention humaine n'est pas une surcharge d'un score : **elle est le mécanisme**. Les données du futur moteur sont collectées dès maintenant : origine, motif écrit, filtres de la recherche d'origine (`10` RG54), motifs de refus typés des **deux** listes, délais réels, taux d'acceptation par déclencheur |
| 6 | **Deux populations** | **Trois écrans distincts, jamais partagés** : l'écran de décision (interne), l'écran d'acceptation côté marque (créateur **anonymisé**, pas de net créateur), l'écran d'acceptation côté créateur (marque **identifiée sans coordonnées**, net créateur estimé en tranche). Seule la mécanique est commune, et c'est voulu (RG1, RG66) |
| 7 | **Données personnelles** — avis de `expert-conformite-rgpd` | **Obligatoire, avec veto.** Points soumis : contenu et formulation de l'acceptation (RG69, RG70) et confirmation que l'acceptation générale des CGU à l'inscription **ne suffit pas** pour une mise en relation non sollicitée (`01` §4.3) ; ré-acceptation en cas de changement de version (**Q3**) ; conservation probatoire du registre au-delà d'une suppression de compte ; journalisation des lectures d'identités non révélées (RG34) ; contenu exact de l'e-mail de confirmation (RG78) ; motif `pre_existing_relationship` et sa finalité (RG87) ; absence de retrait d'acceptation (**Q4**) |

---

## Critères d'acceptation

### La file et la prise en charge

**CA1** — *Étant donné* une demande de contact créée à 09 h 00 un mardi, *quand* on lit l'objet créé,
*alors* son statut est « en attente », sa référence a la forme `MER-AAAA-NNNNNN`, les pays des deux
parties et la version de CGU acceptée par la marque sont enregistrés, et son échéance est fixée à
**1 jour ouvré**, calculée une seule fois.

**CA2** — *Étant donné* une politique de délai modifiée après la création d'une entrée, *quand* on
relit cette entrée, *alors* son échéance est **inchangée**.

**CA3** — *Étant donné* la file, *quand* elle s'affiche sans filtre, *alors* les entrées sont triées
par échéance croissante, les entrées hors délai sont en tête, et chacune porte un **libellé écrit**
en plus de son traitement visuel.

**CA4** — *Étant donné* une ligne de file, *quand* on la lit, *alors* elle affiche le créateur **en
identité réelle** et la marque, sans qu'il faille ouvrir l'entrée.

**CA5** — *Étant donné* une file vide, *quand* elle s'affiche, *alors* le message indique depuis
quand la dernière entrée a été traitée, et **jamais une page blanche**.

**CA6** — *Étant donné* une entrée libre, *quand* un commercial l'ouvre, *alors* elle est
**automatiquement prise en charge** en son nom, et l'écran le lui dit avec l'heure.

**CA7** — *Étant donné* une entrée prise en charge par Marie, *quand* un second commercial l'ouvre,
*alors* il voit « déjà prise en charge par Marie depuis 09 h 42 », peut la lire, **et ne peut pas
décider** ; aucune erreur technique ne s'affiche.

**CA8** — *Étant donné* une prise en charge sans décision, *quand* 30 minutes se sont écoulées,
*alors* l'entrée retourne en file, le verrou est libéré, et l'abandon est journalisé avec son
titulaire.

**CA9** — *Étant donné* un verrou détenu par un agent absent, *quand* un administrateur le lève,
*alors* un motif typé est exigé, la levée est journalisée et le titulaire en est informé.

**CA10** — *Étant donné* une entrée dont l'échéance est dépassée, *quand* elle reste sans décision,
*alors* elle **n'est jamais expirée automatiquement**, elle reste dans la file, une alerte remonte,
une escalade administrateur part à J+1, et l'initiateur voit le message « votre demande prend plus de
temps que prévu ».

**CA11** — *Étant donné* une décision prise après l'échéance, *quand* elle est enregistrée, *alors*
elle aboutit et est **marquée comme hors délai**.

### L'écran de décision

**CA12** — *Étant donné* un écran de décision, *quand* le commercial le lit, *alors* il voit la
marque, le créateur en identité complète avec ses chiffres exacts et leur date de mesure, la
campagne, le texte intégral de l'expression d'intérêt, le tarif proposé avec sa devise et les alertes
— **sans ouvrir aucun autre écran**.

**CA13** — *Étant donné* l'ouverture d'un écran de décision, *quand* elle se produit, *alors* un
événement de registre nomme l'agent et l'horodate.

**CA14** — *Étant donné* une motivation contenant `0612345678`, *quand* le commercial ouvre l'entrée,
*alors* une alerte indique **le type de motif et sa position**, le texte reste lisible tel quel, et
**aucune copie du texte détecté n'est stockée**.

**CA15** — *Étant donné* un créateur bloqué avec cette marque, *quand* le commercial ouvre l'entrée,
*alors* l'avertissement est bloquant et **le motif du blocage n'est affiché à aucune des deux
parties**.

**CA16** — *Étant donné* un commercial qui détient un compte marque, *quand* une entrée concerne ce
compte, *alors* elle ne lui est pas proposée, et toute tentative de décision est refusée côté serveur
et journalisée.

**CA17** — *Étant donné* l'écran de décision, *quand* on l'utilise sans souris, *alors* prendre en
charge, valider, refuser et passer au suivant sont tous atteignables au clavier.

### Validation, refus, réattribution

**CA18** — *Étant donné* une entrée en cours d'examen, *quand* le commercial valide, *alors* le
statut passe à « validée », **il devient responsable de l'affaire**, un événement de registre est
écrit, et `identity_revealed_at` **reste vide**.

**CA19** — *Étant donné* une validation, *quand* on inspecte ce qui a été montré aux parties, *alors*
**aucune identité n'a été révélée** et la partie qui n'a pas encore accepté a reçu une invitation.

**CA20** — *Étant donné* une entrée portant **deux** expressions d'intérêt, *quand* le commercial
valide, *alors* un récapitulatif séparé exige une confirmation explicite mentionnant le caractère
irréversible, **puis** la révélation, la conversation, l'événement et les deux e-mails se produisent
en une seule transaction.

**CA21** — *Étant donné* un refus, *quand* il est enregistré, *alors* un motif typé est
**obligatoire**, le commentaire libre seul est impossible, et l'initiateur reçoit le message associé
au motif, **dans sa langue**.

**CA22** — *Étant donné* une demande de contact refusée, *quand* le créateur consulte son espace,
*alors* **rien n'y apparaît** : ni la demande, ni son existence, ni un compteur.

**CA23** — *Étant donné* un créateur ayant refusé le secteur de la marque, *quand* la demande est
refusée, *alors* le message reçu par la marque est « ce créateur n'est pas disponible pour cette
demande », et **la liste des secteurs refusés n'est ni citée, ni déductible**.

**CA24** — *Étant donné* un refus enregistré par erreur, *quand* le commercial tente de l'annuler,
*alors* **aucun chemin ne le lui permet** ; il peut ajouter une correction motivée, journalisée.

**CA25** — *Étant donné* une réattribution, *quand* elle est enregistrée, *alors* un motif typé est
exigé, l'ancien et le nouveau responsable sont **tous deux conservés**, et l'action est journalisée
nominativement.

**CA26** — *Étant donné* un compte agent que l'on veut désactiver, *quand* il reste responsable d'au
moins une mise en relation, *alors* la désactivation est **refusée** tant que la réattribution n'est
pas faite.

### La proposition INFLUX

**CA27** — *Étant donné* une campagne publiée et une sélection de 5 créateurs en vue identifiée,
*quand* le commercial envoie, *alors* l'opération tient en **trois clics** — proposer, écrire le
motif, envoyer — sans changement d'écran ni saisie par destinataire.

**CA28** — *Étant donné* le même envoi, *quand* on inspecte le résultat, *alors* **5 mises en
relation distinctes** existent, avec **5 références différentes**, chacune portant `origin =
influx_proposal`, **le motif copié**, le commercial comme responsable, et `identity_revealed_at`
**vide**.

**CA29** — *Étant donné* le même envoi, *quand* on cherche un objet « lot » doté d'un statut ou d'un
cycle de vie, *alors* **il n'en existe aucun** ; seul un identifiant de lot et un événement de
registre relient les 5 mises en relation.

**CA30** — *Étant donné* un motif de 4 caractères, *quand* le commercial envoie, *alors* l'envoi est
refusé côté serveur, et **la sélection et le texte sont conservés**.

**CA31** — *Étant donné* un envoi de 10 propositions dont 3 portent sur des couples déjà en relation,
*quand* il s'exécute, *alors* **7 mises en relation sont créées**, les 3 échecs sont listés nommément
avec leur raison, et rien n'est annulé.

**CA32** — *Étant donné* une campagne en pause, *quand* le commercial tente de proposer, *alors* le
bouton est **inactif avec son motif écrit**, jamais absent sans explication.

**CA33** — *Étant donné* une sélection de 45 créateurs, *quand* le commercial tente d'envoyer,
*alors* le plafond de 20 est appliqué côté serveur, le message le nomme, et l'atteinte est
journalisée.

**CA34** — *Étant donné* une proposition envoyée, *quand* la marque ouvre son invitation, *alors*
elle voit le créateur **anonymisé** : aucun pseudo, aucun identifiant, aucun lien, aucun chiffre
exact — **pas même dans la réponse de l'API**.

**CA35** — *Étant donné* la même proposition, *quand* le créateur ouvre son invitation, *alors* il
voit la marque **identifiée sans aucune coordonnée directe**, la campagne, la rémunération annoncée
avec sa devise, le **net créateur estimé en tranche** et sa mention fixe, et le motif du commercial.

**CA36** — *Étant donné* une proposition refusée par le créateur, *quand* le commercial tente de la
renouveler sur la **même** campagne, *alors* c'est refusé sauf autorisation d'un administrateur,
journalisée ; sur une **autre** campagne, c'est possible.

**CA37** — *Étant donné* une proposition non encore révélée, *quand* le commercial la retire, *alors*
la partie qui avait accepté reçoit « INFLUX a retiré cette proposition » et **rien d'autre**.

### L'acceptation et la révélation

**CA38** — *Étant donné* un écran d'acceptation, *quand* il s'affiche, *alors* il porte la référence,
le nom du commercial, la campagne, l'autre partie dans son état de visibilité, le motif écrit, et les
trois explications : si j'accepte, si je refuse, si je ne réponds pas.

**CA39** — *Étant donné* l'écran d'acceptation, *quand* il s'affiche, *alors* la case de consentement
est **non pré-cochée**, le bouton d'acceptation est inactif tant qu'elle ne l'est pas, et le contrôle
est **refait côté serveur**.

**CA40** — *Étant donné* l'écran d'acceptation, *quand* on inspecte la réponse de l'API, *alors*
**aucune coordonnée directe de l'autre partie n'y figure, pas même vide**.

**CA41** — *Étant donné* une acceptation, *quand* elle est enregistrée, *alors* la date **et la
version de CGU** de cette partie sont enregistrées ensemble, et l'événement est écrit au registre.

**CA42** — *Étant donné* une seule acceptation sur deux, *quand* la partie qui a accepté consulte,
*alors* elle voit « nous attendons la réponse de l'autre partie », **sans savoir qui elle est, ni si
elle a ouvert l'invitation**.

**CA43** — *Étant donné* une seule acceptation, *quand* on inspecte l'objet, *alors*
`identity_revealed_at` est **vide** et **aucune identité n'est accessible** à l'autre partie.

**CA44** — *Étant donné* la seconde acceptation, *quand* elle est enregistrée, *alors* dans **une
seule transaction** : `identity_revealed_at` est posé, l'événement chaîné est écrit, la conversation
est créée avec **trois** participants — marque, créateur, **commercial responsable** —, une affaire
est créée à l'état initial, et **deux** e-mails sont mis en file.

**CA45** — *Étant donné* l'échec de l'une de ces écritures, *quand* la transaction se termine,
*alors* **aucune** n'a été conservée : il n'existe jamais une mise en relation révélée sans
conversation ni sans événement.

**CA46** — *Étant donné* une mise en relation révélée, *quand* un agent, un administrateur ou un
service tente de modifier `identity_revealed_at`, *alors* la base refuse, quel que soit le chemin.

**CA47** — *Étant donné* une mise en relation révélée, *quand* la marque consulte le créateur,
*alors* elle obtient pseudos, identifiants, liens et chiffres exacts **avec leur source et leur date
de mesure**, et **jamais** la couche réservée aux rôles internes.

**CA48** — *Étant donné* une mise en relation révélée, *quand* le créateur consulte la marque,
*alors* il obtient les coordonnées de l'interlocuteur.

**CA49** — *Étant donné* les deux e-mails de confirmation, *quand* on les lit, *alors* chacun porte
la référence, la date et l'heure **avec fuseau**, le nom des deux parties, **le nom du commercial
INFLUX**, la campagne, **la version de CGU applicable à son destinataire et la date à laquelle il
l'a acceptée**, et un lien vers la conversation.

**CA50** — *Étant donné* ces mêmes e-mails, *quand* on les inspecte, *alors* ils ne contiennent
**aucune coordonnée directe de l'autre partie**, aucune pièce jointe, et **aucun mot de « preuve »,
« certifié » ou « valeur probante »**.

**CA51** — *Étant donné* un e-mail de confirmation acheminé, *quand* on consulte la mise en relation,
*alors* le `messageId` renvoyé par le prestataire y est conservé.

**CA52** — *Étant donné* un service d'envoi indisponible, *quand* la seconde acceptation survient,
*alors* la révélation et la conversation aboutissent, les e-mails sont rejoués, et un échec définitif
produit une **alerte backoffice**.

**CA53** — *Étant donné* une version de CGU modifiée entre la demande et la validation, *quand* la
mise en relation est validée, *alors* l'initiateur est invité à ré-accepter avant toute révélation.

### Les deux refus, les relances et le cycle de vie

**CA54** — *Étant donné* un refus par une partie, *quand* on inspecte l'objet, *alors* le statut est
« refusée », le **côté** et le **motif de la liste B** sont enregistrés, et `identity_revealed_at`
est **vide**.

**CA55** — *Étant donné* ce refus, *quand* l'autre partie consulte, *alors* elle lit « INFLUX n'a pas
pu ouvrir cette mise en relation », **sans motif, sans savoir qui a refusé**.

**CA56** — *Étant donné* un refus motivé par une relation préexistante, *quand* il est enregistré,
*alors* une tâche commerciale est créée pour le responsable et l'information est consignée comme
élément de contexte de la clause de sauvegarde.

**CA57** — *Étant donné* l'écran de refus, *quand* le membre ne souhaite pas se justifier, *alors*
une option le permet et le refus est enregistré quand même.

**CA58** — *Étant donné* une invitation sans réponse, *quand* J+3 puis J+6 sont atteints, *alors*
**seule la partie silencieuse** est relancée, et une tâche est créée pour le commercial à J+6.

**CA59** — *Étant donné* une partie ayant accepté, *quand* les relances partent, *alors* **elle n'en
reçoit aucune** et n'apprend pas que l'autre tarde.

**CA60** — *Étant donné* une invitation sans réponse à J+7, *quand* la clôture s'exécute, *alors* le
statut est « clôturée sans suite » avec son **sous-motif interne**, les deux parties reçoivent le
**même message neutre**, et l'événement est journalisé.

**CA61** — *Étant donné* les huit états de RG100, *quand* on tente une transition hors du tableau
RG102, *alors* elle est refusée et la tentative est journalisée.

**CA62** — *Étant donné* une mise en relation révélée, *quand* on tente de la faire passer à
« refusée », « retirée » ou « clôturée », *alors* c'est refusé : l'état est terminal.

**CA63** — *Étant donné* une mise en relation active sur un triplet, *quand* un second déclencheur
survient sur le même triplet, *alors* **aucune seconde mise en relation n'est créée** et le contenu
est rattaché à l'existante.

### Alertes, leads, accessibilité

**CA64** — *Étant donné* une entrée non prise en charge après 4 heures ouvrées, *quand* la file
s'affiche, *alors* l'alerte « sans preneur » est visible en tête.

**CA65** — *Étant donné* une mise en relation révélée sans message depuis 14 jours et sans état
d'affaire mis à jour, *quand* le commercial ouvre son tableau de bord, *alors* l'alerte apparaît,
**formulée comme un rappel d'appel, jamais comme une accusation**.

**CA66** — *Étant donné* une mise en relation révélée depuis 30 jours sans état d'affaire, *quand* le
tableau de bord s'affiche, *alors* l'alerte apparaît pour le commercial **et** son administrateur.

**CA67** — *Étant donné* une rupture de chaîne détectée par la vérification périodique, *quand* elle
survient, *alors* une alerte administrateur part immédiatement.

**CA68** — *Étant donné* une révélation, *quand* on inspecte ce qui part vers Brevo et Apollo,
*alors* **ni l'identité de l'autre partie, ni la campagne, ni un montant, ni un motif** n'y figurent.

**CA69** — *Étant donné* un membre **sans** consentement marketing, *quand* une révélation survient,
*alors* les e-mails de confirmation partent quand même — ils sont transactionnels — et **aucun
contact marketing n'est mis à jour**, la ligne étant marquée « ignoré — sans consentement ».

**CA70** — *Étant donné* chacun des messages de RG119, *quand* la langue de l'interface est
l'anglais, *alors* la version anglaise s'affiche, **sans aucun texte français résiduel**.

**CA71** — *Étant donné* les huit états, les dix alertes et le compte à rebours, *quand* ils
s'affichent, *alors* chacun porte un **libellé écrit** et la couleur n'est jamais le seul porteur de
l'information.

**CA72** — *Étant donné* une erreur serveur pendant l'envoi d'une proposition, *quand* le message
s'affiche, *alors* **toute la saisie est conservée** et l'envoi peut être retenté.

---

## Frontière avec le document `12` (messagerie à trois)

Elle est nette et il faut qu'elle le reste, parce que les deux documents se touchent à la
milliseconde près.

| Ce document (`13`) s'arrête ici | Le document `12` commence ici |
|---|---|
| La conversation est **créée**, avec ses **trois participants** : marque, créateur, commercial responsable | Tout ce qui se passe **dans** la conversation |
| L'affaire (`deals`) est créée à l'état initial, rattachée à la mise en relation | Le pipeline commercial et la saisie des montants (`01` §6) |
| L'e-mail de confirmation porte un **lien** vers la conversation | Le contenu du **premier message système**, le format des messages, les accusés de lecture |
| L'alerte « fil silencieux depuis 14 jours » est **listée** comme alerte du commercial responsable (A5) | La **définition du silence** (date du dernier message) et la mécanique qui la produit |
| Les **détections de coordonnées sur les textes de demande et de candidature** sont affichées sur l'écran de décision (RG33) | Les détections **dans les messages** de la conversation |
| La réattribution **exige** qu'un changement d'interlocuteur soit annoncé aux deux parties (RG48) | La **forme** de cette annonce dans le fil, et l'entrée d'un agent en cours de route (`03` C(25)) |
| La révélation est **irréversible** (RG75) | La **clôture** de la conversation et ses motifs |
| Les e-mails de confirmation de mise en relation | Les notifications de nouveaux messages |

**En cas de doute :** si le fait à spécifier se produit **avant ou pendant** la transaction de
révélation, il relève de ce document. S'il se produit **après**, il relève du document `12`.

---

## La checklist CGU, pour le juriste

> **Je ne suis pas avocat.** Ce qui suit est de la **matière première**, pas une rédaction juridique.

**La checklist de référence est celle de `docs/mvp/01-intermediation-courtee.md` §8.1 à §8.3.** Elle
n'est pas recopiée ici et ne doit pas l'être : une clause dupliquée dans deux documents diverge à la
première correction. Elle couvre la définition de la mise en relation, le fait générateur, l'assiette
et le barème par renvoi, la durée de la fenêtre (**D29**), l'obligation de déclarer, les
justificatifs, la **clause de sauvegarde « relation préexistante »**, le **moratoire du pilote** et
son risque de renonciation, la **rédaction asymétrique B2B / B2C**, la langue et le droit applicable.

**Ce document n'ajoute que ce qui est propre à l'écran d'acceptation**, et le soumet au juriste :

- [ ] **L'acceptation générale des CGU à l'inscription suffit-elle ?** Position de ce document :
      **non**, une mise en relation **non sollicitée** (proposition INFLUX) exige une acceptation
      spécifique, à l'écran, datée et rattachée à une version (RG5, RG72). À confirmer.
- [ ] **Formulation exacte de la case** (RG70) : elle doit dire ce qui est communiqué, à qui, et à
      quel moment, sans employer le vocabulaire de la preuve (RG13) et sans prendre le ton de la
      menace (`01` §8.2).
- [ ] **Le résumé en langage courant de la clause de non-contournement**, affiché à côté du lien vers
      les CGU : sa rédaction ne doit ni affaiblir la clause, ni l'aggraver. Qui rédige ce résumé,
      et engage-t-il INFLUX au même titre que les CGU ?
- [ ] **Deux versions de CGU sur une même mise en relation** : chaque partie accepte la version en
      vigueur **pour elle**, à sa date. Cette asymétrie est-elle tenable pour opposer la clause ?
- [ ] **Ré-acceptation en cas de changement de version** entre la demande et la validation (RG68,
      **Q3**) : nécessaire, ou la version acceptée à la date des faits suffit-elle ?
- [ ] **Absence de retrait d'acceptation** avant la révélation (**Q4**) : le droit de la consommation
      impose-t-il une faculté de rétractation sur un consentement à la communication d'identité ?
- [ ] **Le motif `pre_existing_relationship`** (RG87) : sa collecte, sa conservation et son usage
      comme élément de la clause de sauvegarde doivent être décrits dans la politique de
      confidentialité.
- [ ] **La conservation probatoire** de la mise en relation et du registre au-delà d'une suppression
      de compte : **à inscrire dans la politique de confidentialité dès le Lot 1**, sinon le droit de
      conserver la preuve n'existe pas.
- [ ] **La supervision des conversations** (**A10**) doit être annoncée **sur l'écran d'acceptation
      lui-même**, pas seulement dans les CGU : c'est là que la personne accepte d'entrer dans un
      échange lu par un tiers nommé.

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Espace | Écran | Remarque |
|---|---|---|
| Backoffice | **File de validation** : liste dense, filtres F1-F6, tris T1-T3, compteurs permanents | Tableau, pas cartes ; raccourcis clavier ; états vide / bloquée distincts (RG23) |
| Backoffice | **Écran de décision** : cinq blocs de RG32, alertes de RG33, trois actions | Décider **sans ouvrir autre chose** ; c'est l'écran le plus utilisé du MVP |
| Backoffice | **Récapitulatif de validation révélante** (RG44) | Confirmation séparée, caractère irréversible écrit en toutes lettres |
| Backoffice | **Panneau de proposition INFLUX** (RG54) | **Le parcours à chronométrer.** Trois clics, aperçu, motif, compte rendu d'échec partiel |
| Backoffice | **Tableau de bord de la file** (RG107) et **liste des alertes** (RG106) | Alertes actionnables, seuils écrits |
| Backoffice | **Réattribution** avec motif typé | Historique des responsables visible |
| Membre marque | **Invitation + écran d'acceptation** — créateur **anonymisé** | Case non pré-cochée, refus aussi visible que l'acceptation |
| Membre créateur | **Invitation + écran d'acceptation** — marque **identifiée sans coordonnées**, net créateur estimé en tranche | Mobile d'abord, acceptation en trente secondes |
| Membre (les deux) | **Écran d'attente** « nous attendons l'autre partie » (RG73) | Ne dit jamais qui est l'autre, ni ce qu'elle fait |
| Membre (les deux) | **Écran de refus** avec liste B et option « je préfère ne pas dire » | Ton de partenaire, jamais de contrôle |
| Membre (les deux) | **Détail d'une mise en relation** : les huit états, leurs libellés imposés | Libellés de RG100 non négociables |
| E-mail | **Confirmation de mise en relation** (RG78) | Bilingue, sans coordonnée, sans vocabulaire de preuve |
| E-mail | **Invitation**, **relances J+3 et J+6**, **clôture neutre**, **refus motivé** | Bilingues, transactionnels |

### Données (`expert-database`) — écarts constatés avec `docs/mvp/04-modele-de-donnees-mvp.md`

Tables utilisées telles quelles : `matching.introductions`, `matching.interest_submissions`,
`matching.rejection_reasons`, `matching.party_blocks`, `matching.reference_counters`,
`messaging.conversations`, `messaging.conversation_participants`, `billing.deals`,
`audit.audit_events`, `audit.event_types`, `backoffice.sla_policies`,
`backoffice.operational_settings`, `backoffice.ownership_assignments`.

**Neuf écarts à instruire :**

1. **`matching.expiry_reason` est incomplet.** Il manque **`no_creator_answer`** et
   **`no_answer_both_parties`** (RG95). En l'état, le silence d'un créateur sur une proposition
   INFLUX n'est pas distinguable du silence d'une marque — or ce sont deux problèmes opposés, l'un de
   vivier, l'autre de réactivité commerciale.
2. **Le refus par une partie n'a pas de support.** Il faut **`declined_by_party`** dans
   `matching.rejection_reasons` (`is_correctable = false`), plus **`declining_side`**
   (`advertiser` · `creator`) et **`decline_reason_code`** référençant une **liste B distincte**
   (`matching.decline_reasons`, RG87). Réutiliser la liste A confondrait deux décisions de nature
   différente et rendrait toute statistique de refus inexploitable.
3. **L'identifiant de lot de proposition manque** : `introductions.proposal_batch_id uuid`, sans
   table associée (RG59, RG2).
4. **Qui appelle `matching.reveal_identity()` ?** `03` C(21) exige que la fonction vérifie que
   **l'appelant est un agent avec double facteur**. Or la révélation est déclenchée par
   **l'acceptation d'un membre** (RG74) dans la très grande majorité des cas. **La condition est
   inexécutable telle qu'écrite.** À réconcilier : la fonction doit accepter d'être appelée dans le
   contexte d'une acceptation de membre, tout en refusant un appel direct. Arbitre :
   `expert-database` + `expert-cybersecurite` (**veto**).
5. **Collision de nom de fonction** : `03` C(21) nomme `matching.open_introduction(...)` la fonction
   atomique de révélation, tandis que `04` §5.6 nomme `matching.reveal_identity()` la révélation et
   `matching.open_introduction()` la **création** d'une mise en relation avec contrôle des blocages.
   Deux fonctions, deux rôles, un nom en commun : à trancher avant la migration `0402`.
6. **`approved` n'est pas un état terminal avant révélation** (RG103). Le déclencheur de transitions
   doit autoriser `approved → rejected` (refus de partie), `approved → withdrawn` et
   `approved → expired` **tant que `identity_revealed_at` est nul**, et les interdire ensuite. La
   contrainte `introductions_reveal_requires_approval` reste compatible.
7. **La création automatique de l'affaire à la révélation** (RG74, point 4) doit être ajoutée à la
   transaction de `reveal_identity()`. Sans elle, l'indicateur « révélée sans état d'affaire à 30
   jours » (A6) n'a aucune ligne à interroger.
8. **Le `messageId` du prestataire d'envoi** (RG79) doit être rattaché à la mise en relation et
   retrouvable depuis elle. Son emplacement (table de suivi d'envoi du pipeline de leads, ou colonne
   dédiée) relève d'`architecte`.
9. **Codes d'événements à ajouter** à `audit.event_types` (données, pas schéma) :
   `introduction.created`, `introduction.claimed`, `introduction.claim_released`,
   `introduction.claim_expired`, `introduction.reviewed` *(sensible — lecture d'identités non
   révélées)*, `introduction.approved`, `introduction.rejected`, `introduction.party_accepted`,
   `introduction.party_declined`, **`introduction.identity_revealed`** *(critique)*,
   `introduction.withdrawn`, `introduction.expired`, `introduction.reassigned`,
   `introduction.reminder_sent`, `introduction.email_delivered`, `introduction.email_failed`,
   `introduction.batch_created`, `introduction.cap_reached`.

À prévoir également, **tous en table et modifiables sans déploiement**, chaque modification
journalisée nominativement : délai de traitement (D39), objectif interne de prise en charge (4 h),
expiration du verrou (30 min), délai d'acceptation (7 j), échéances de relance (J+3, J+6), plafond de
sélection (20), plafond journalier de propositions (60), seuils des alertes A5 et A6 (14 j, 30 j).

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Brevo — transactionnel** | Invitation, relances J+3 et J+6, **e-mail de confirmation de mise en relation**, refus motivé, clôture neutre — bilingues, rejoués, **`messageId` conservé**, échecs visibles au backoffice avec rejeu manuel |
| **Brevo — contacts** | Au plus un indicateur d'activité **non identifiant**, sous consentement (RG114) |
| **Apollo.io** | **Aucun attribut supplémentaire.** Le périmètre du Lot 1 (**D33**) est inchangé |
| **Supabase** | Verrou par transition conditionnelle, fonction de révélation `SECURITY DEFINER`, registre en ajout seul et vérification périodique de la chaîne, index de file et index partiel des manquements |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| **Délai de prise en charge** (médian, 9ᵉ cas sur 10) | Objectif interne **4 h ouvrées** |
| **Délai de décision** (médian, 9ᵉ cas sur 10) et **part hors délai** | **Cible 1 jour ouvré** (**D39**) ; alerte au-delà. **Premier risque produit** |
| **Mises en relation traitées par commercial et par semaine** | Mesuré ; c'est le **plafond de croissance** (RG108) |
| **Taux de transformation par déclencheur** (validée → révélée) | Dit lequel des trois déclencheurs produit vraiment des rencontres |
| **Taux d'acceptation des propositions INFLUX**, par commercial | Un taux bas signale un ciblage paresseux ou un motif mal écrit |
| **Temps d'envoi d'une proposition**, de la sélection au compte rendu | **À chronométrer** : au-delà du temps d'un appel, l'outil a échoué |
| Répartition des refus par motif, **liste A et liste B séparément** | « Autre » sous **10 %** (RG86) |
| **Refus `pre_existing_relationship`** | Mesure directe des relations préexistantes déclarées ; alimente la clause de sauvegarde |
| Délai médian d'acceptation par côté (marque, créateur) | Dit quelle population fait attendre l'autre |
| Part des invitations sans réponse à J+7 | Qualité du ciblage et de l'invitation |
| **Mises en relation révélées sans état d'affaire à 30 jours** | Signal de contournement **ou** de saisie négligée (`01` §11) |
| Échecs définitifs d'e-mail de confirmation | **Doit rester à zéro** : chaque cas est une mise en relation sans preuve externe |
| Verrous expirés sans décision | Un taux élevé signale un écran trop lent à lire, donc un défaut de conception |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| Tout ce qui se passe **dans** la conversation | Document `12` — frontière écrite ci-dessus | Lot 4, en parallèle |
| Le pipeline commercial et la saisie des montants | Document `01` §6 ; ce document crée l'affaire, il ne la pilote pas | Lot 5 |
| Le contrat, la signature, l'encaissement, le calcul de commission | **A1**, `CLAUDE.md` §3 | V2, avec **D9** et **D25** |
| Le contrôle « pays ouvert » sur une mise en relation | Il conditionne les **contrats**, absents au MVP (RG11) | V2, avec **D26** |
| Un score de pertinence ou un classement de la file par valeur estimée | **D11** ; aucune donnée pour régler des pondérations | Après le pilote |
| Une action de masse de validation ou de refus | Chaque décision engage une révélation et une affaire (RG50) | Jamais sous cette forme |
| Le portefeuille de clients cloisonné par commercial | Au MVP, tous les commerciaux voient tout ; **le responsable est déjà enregistré** (`backoffice-ops`, règle 17) | Quand l'équipe le justifie : un changement de règle d'accès, pas un chantier |
| Le retrait d'une acceptation déjà donnée | Hypothèse conservatrice, **Q4** | Selon l'avis juridique |
| La double validation par un administrateur distinct | Une seule personne cumule `agent` et `admin` au MVP ; la confirmation différée journalisée la remplace, **et c'est un contrôle affaibli, dit comme tel** (`backoffice-ops`, étape 4) | **Automatiquement, dès la deuxième personne dans l'équipe** |
| L'ancrage ou l'horodatage qualifié par un tiers | Coût et complexité sans rapport avec le risque actuel (`01` M4) | Si un contentieux réel le justifie |
| La demande « sélection par l'équipe INFLUX » (`10` RG61) | Ce n'est pas une mise en relation : c'est une demande de travail au backoffice, sans couple identifié | Document `10`, file distincte |
| Portugais et autres langues | Français et anglais au lancement | Avant l'ouverture du Brésil |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | ✅ ***Tranchée le 2026-09-24 (D49) : non, l'entrée reste en file ; la skill est alignée.*** **Le dépassement du délai de traitement doit-il expirer une entrée ?** La skill `intermediation-tracking` décrit un passage automatique en `expired` ; le modèle de données n'a aucun sous-motif pour cette cause, et `backoffice-ops` interdit toute sortie silencieuse | **Non** (RG26) : l'entrée reste dans la file, l'initiateur est informé, une escalade part à J+1, et une décision tardive est marquée comme telle. **La skill et `01` §Étape 3 sont à aligner** | `chef-de-projet` + `product-owner` | **Avant le Lot 4** |
| **Q2** | ✅ ***Tranchée le 2026-09-24 (D45, double acceptation) : distinction retenue ; la skill est alignée.*** **`approved` est-il terminal ?** La skill le dit ; ce document distingue `approved` non révélée (réversible) et révélée (terminale), sans quoi un refus de partie après validation n'a nulle part où aller | **Distinction retenue** (RG103). Le déclencheur de transitions de `04` doit l'implémenter | `expert-database` + `chef-de-projet` | **Avant le Lot 4** |
| **Q3** | **Faut-il redemander l'acceptation de l'initiateur si la version de CGU a changé** entre sa demande et la validation ? | **Oui** (RG68) : règle simple, testable, au coût pratiquement nul puisque le délai de file est d'un jour ouvré | `expert-conformite-rgpd` (**veto**) + juriste | Lot 4 |
| **Q4** | **Une partie peut-elle retirer son acceptation avant que l'autre n'ait répondu ?** | **Non au MVP** : elle demande la clôture au commercial, qui retire la mise en relation avec un motif. Hypothèse conservatrice, à vérifier au regard du droit de la consommation | `expert-conformite-rgpd` (**veto**) + juriste | Lot 4 |
| **Q5** | **Qui appelle la fonction de révélation, et comment vérifier l'appelant ?** `03` C(21) exige un agent avec double facteur, alors que le déclencheur réel est l'acceptation d'un membre (écart 4) | La fonction accepte d'être appelée depuis la transaction d'acceptation d'un membre, et refuse tout appel direct. **Formulation technique à trancher** | `expert-database` + `expert-cybersecurite` (**veto**) + `architecte` | **Avant la migration `0402`** |
| **Q6** | **Valeurs de départ des délais et plafonds** : 4 h ouvrées de prise en charge, 30 min de verrou, 7 jours d'acceptation, relances J+3 et J+6, 20 créateurs par envoi, 60 propositions par jour et par commercial | Valeurs ci-contre, **toutes en table**, calibrées après un mois de mesure | **Fondateur** + `chef-de-projet` (rattaché à **D39**) | Lot 4 |
| **Q7** | **La liste B des motifs de refus par une partie est-elle montrée telle quelle au membre ?** Six entrées, dont « nous travaillons déjà ensemble » | **Oui**, avec une option « je préfère ne pas dire » (RG89). Un motif obligatoire produirait des motifs faux | `expert-ux` + `product-owner` | Lot 4 |
| **Q8** | **Le motif écrit du commercial est-il montré tel quel aux deux parties ?** Il a été écrit pour convaincre, pas pour être lu par la marque et le créateur en même temps | **Oui, tel quel** (RG61) : un motif réécrit pour l'affichage cesserait d'être la trace du rapprochement. Le commercial le sait, et l'écran le lui rappelle au clic 2 | `product-owner` + `expert-ux` | Lot 4 |
| **Q9** | **Faut-il un plafond de demandes de contact par marque**, symétrique des plafonds P1 à P4 des créateurs ? Le document `10` n'en prévoit aucun ; seuls des plafonds de débit de recherche existent | **Hypothèse : oui**, un plafond de demandes actives par marque, pour que la file ne soit pas saturée par un compte. Valeur à définir | `chef-de-projet` + `product-owner` (rattaché au document `10`) | Lot 4 |
| **Q10** | **Langue du backoffice** (**D36**) : les motifs typés, les alertes et les libellés de file sont-ils traduits ? | Ne rien coder en dur ; les clés existent dans les deux langues | **Fondateur** | Lot 4 |
| **Q11** | **Durée de conservation** des mises en relation refusées, retirées et clôturées, et du journal des lectures d'écran de décision | Conservation le temps de l'usage produit, purge à échéance écrite ; **le registre chaîné n'est jamais purgé** (`01` M4) | `expert-conformite-rgpd` (**veto**) | Lot 4 |
| **Q12** | **Un administrateur peut-il autoriser une re-proposition après un refus de partie** (RG64), et sur quels critères ? | **Oui, au cas par cas, journalisé.** Sans garde-fou, la proposition devient du harcèlement et le créateur cesse de répondre | `chef-de-projet` + **Fondateur** | Lot 4 |

---

**Ce document ne modifie aucun autre fichier.** Les mises à jour de `CLAUDE.md` relèvent de
`chef-de-projet` ; les corrections du modèle de données relèvent d'`expert-database` ; la rédaction
juridique relève d'un professionnel du droit.
