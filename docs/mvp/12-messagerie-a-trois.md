# Lot 4 — La messagerie à trois : le fil, sa vie, sa supervision et son statut

> **Mise à jour du 2026-09-24.** Les **apartés** sont retenus et annoncés (**D47**) : chaque partie a
> un canal privé avec les agents de la conversation, qu'elle peut ouvrir elle-même, et que tous les
> agents participants lisent sous journalisation. **Spécification complète en fin de document, §K
> (RG113 à RG146, CA59 à CA81, Q12 à Q15)** ; elle amende RG14, RG16, RG18, RG51, RG53, RG58, RG87,
> RG93, RG99, RG102 et RG103. **D46** confirme RG29 : aucune coordonnée directe n'est jamais montrée
> à un membre.

> **Date :** 2026-09-19 · **Auteur :** agent `product-owner`, avec l'avis de
> `expert-conformite-rgpd` sur le statut juridique des échanges · **Statut :** spécification
> complète de la conversation à trois (Lot 4), soumise à la validation de `chef-de-projet`, avec
> **avis obligatoire (veto) de `expert-conformite-rgpd`** sur les §I et §J, et **avis obligatoire
> (veto) de `expert-cybersecurite`** sur les §E et §F.
>
> **Skills appliquées :** `messaging-spec` (mode opératoire principal), `feature-spec` (format de
> sortie et checklists), `intermediation-tracking` (détection de coordonnées, registre),
> `design-system-influx` (marques de rôle, accessibilité), `backoffice-ops` (files, motifs typés).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité),
> `docs/mvp/00-cadrage-mvp-v2.md` (arbitrages **A1**, **A3**, **A8**, **A9**, **A10**),
> `docs/mvp/01-intermediation-courtee.md` (**document pivot** : M4, M5 allégé, M6, pipeline
> commercial), `docs/mvp/03-matrice-des-droits-et-rls.md` §3.4 et §5 (conditions C(21) à C(26),
> fonction journalisante, contrôles X1 à X4),
> `docs/mvp/04-modele-de-donnees-mvp.md` §5.7 et §9 (tables `messaging.*`, conservation),
> `docs/mvp/10-recherche-createurs-anonymisee.md` RG28 à RG32 (blocage et exclusions).
>
> ### Frontière avec le document `13-file-de-validation-et-mise-en-relation.md`
>
> **Ce document commence exactement à l'instant où la conversation est créée avec ses trois
> participants**, c'est-à-dire à la sortie de la transaction unique `matching.open_introduction()`
> décrite par C(21).
>
> | Traité par `13` (amont) | Traité **ici** (aval) |
> |---|---|
> | Les trois déclencheurs, la file de validation, le verrou, le SLA (**D39**) | — |
> | Le refus d'une demande, ses motifs typés, le silence opposé à la partie visée (C(18)) | — |
> | Les acceptations des deux parties et leur horodatage | — |
> | La révélation d'identité, son caractère simultané, `identity_revealed_at`, son irréversibilité | **Rappel** du fait acquis, et **affichage permanent** de ce qui a été révélé |
> | L'e-mail de confirmation de mise en relation (M2) | Les e-mails **de notification de message**, qui sont un autre objet |
> | La création de la conversation et de ses trois participants | **Tout ce qui leur arrive ensuite** |
>
> Ce document **ne re-spécifie ni la révélation d'identité, ni les acceptations, ni la file**. En cas
> d'écart avec `13`, c'est `13` qui fait autorité sur l'amont et celui-ci sur l'aval.
>
> **Ce que ce document tranche :** le modèle du fil et l'affichage de ses participants, les cinq
> états et leurs transitions, ce que chaque acteur voit, les contraintes d'écriture d'un message et
> le moment exact de la détection de coordonnées, le curseur de lecture et le régime de la lecture
> par un agent, le canal de documents, le signalement et l'effet d'un blocage, les notifications, le
> statut juridique annoncé aux utilisateurs.
>
> **Ce qu'il ne tranche pas :** la maquette, la densité et la microcopie (`expert-ux`), le schéma SQL
> et les politiques d'accès (`expert-database`, `expert-cybersecurite`), le catalogue technique de la
> détection (`01` M5 et `intermediation-tracking`), le pipeline commercial (`01` §6), les durées de
> conservation (`04` §9, veto `expert-conformite-rgpd`), les règles de blocage en recherche (`10`).
>
> **Invariant rappelé :** aucun contrat, aucune facture, aucun encaissement, **aucun calcul de
> commission** n'existe dans ce périmètre (**A1**). Aucun montant n'est affiché dans le fil par le
> produit : si un montant apparaît, c'est parce qu'un humain l'a écrit dans un message, et il n'est
> alors ni un montant de contrat, ni une commission, ni un net créateur au sens d'INFLUX — c'est du
> texte.

---

## Besoin

**Faire de la conversation entre une marque et un créateur une salle de négociation supervisée, où
le commercial INFLUX est présent et nommé du premier au dernier message, où rien ne se perd, et où
personne ne découvre après coup que ses échanges étaient lus.**

Trois raisons d'être, dans cet ordre :

1. **Économique.** Le commercial présent dans le fil est la **protection principale** du modèle
   (`01` §2, rang 1). Toute fonctionnalité qui l'efface, le rend discret ou permet de l'éviter
   détruit plus de valeur qu'elle n'en crée. Une messagerie qui laisse deux personnes seules n'est
   pas une messagerie dégradée : c'est un autre produit.
2. **Opérationnelle.** Le fil est l'endroit où le commercial fait son métier — relancer, arbitrer,
   rassurer, closer. S'il est plus lent ou moins commode que son téléphone, il reprendra son
   téléphone, et la trace n'existera pas.
3. **Juridique et de confiance.** Une supervision non annoncée est une supervision illicite. Une
   supervision annoncée mais non tracée est une promesse invérifiable. Les deux se traitent ici.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Annonceur** (compte marque, participant) | Lit et écrit dans les fils dont il est participant, dépose et télécharge des documents, signale, bloque, gère la cadence de ses notifications |
| **Créateur** (compte créateur, participant) | Idem, côté créateur. **Aucun écran n'est partagé** : le fil est le même objet, les cadres, les libellés et les rappels ne le sont pas |
| **Commercial INFLUX** (rôle `agent`, participant) | Participe au fil, relance, met en pause, clôt avec motif, traite les détections, contrôle les documents, instruit les signalements, rejoint un fil dont il n'est pas responsable |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, plus : consultation du journal des lectures de tous les agents, revue hebdomadaire, réattribution, suspension |
| **Système** | Ordonne les messages, écrit les messages système, exécute la détection, avance les curseurs de lecture, met les notifications en file, calcule les alertes de silence, archive |
| **Brevo** (externe) | **Uniquement** l'acheminement des e-mails transactionnels de notification. Aucun contenu de message ne lui est transmis |

> **Deux populations, deux parcours.** Le fil est le seul objet du MVP réellement partagé entre une
> marque et un créateur — et c'est précisément pour cela qu'il doit être **cadré différemment de
> chaque côté** : la marque y voit une négociation d'achat, le créateur une opportunité de revenu.
> Les règles ci-dessous sont symétriques ; la rédaction des écrans ne l'est pas, et cela relève de
> `expert-ux`.

---

## User stories

### Annonceur

- **US1** — En tant qu'**annonceur**, je veux voir en permanence à qui je parle, au titre de quelle
  campagne et sous quelle référence, afin de ne jamais confondre deux négociations en cours.
- **US2** — En tant qu'**annonceur**, je veux savoir qu'un commercial INFLUX suit ce fil et pouvoir
  l'interpeller, afin de ne pas avoir l'impression de négocier seul face à un inconnu.
- **US3** — En tant qu'**annonceur**, je veux être prévenu qu'un message m'attend sans que son
  contenu circule par e-mail, afin que mes négociations restent confidentielles.
- **US4** — En tant qu'**annonceur**, je veux transmettre un brief en pièce contrôlée, afin de ne
  pas avoir à sortir de la plateforme pour envoyer un document.

### Créateur

- **US5** — En tant que **créateur**, je veux savoir qui lit mes messages et pendant combien de
  temps ils sont conservés, afin de décider en connaissance de cause de ce que j'écris.
- **US6** — En tant que **créateur**, je veux être averti **avant** d'envoyer un message qui
  contient mon numéro ou mon e-mail, afin de ne pas sortir du cadre sans m'en rendre compte.
- **US7** — En tant que **créateur**, je veux signaler un message déplacé et être sûr que quelqu'un
  le lira, afin de ne pas me retrouver seul face à un interlocuteur agressif.
- **US8** — En tant que **créateur**, je veux bloquer une marque sans perdre l'historique de nos
  échanges, afin de garder une trace si un différend survient.

### Commercial INFLUX

- **US9** — En tant que **commercial**, je veux apparaître dans le fil sous mon prénom suivi
  d'« INFLUX », afin qu'il soit clair pour tout le monde que je suis un tiers et pas une des parties.
- **US10** — En tant que **commercial**, je veux voir immédiatement les fils silencieux et ceux où
  des coordonnées ont été repérées, afin de savoir lesquels rappeler aujourd'hui.
- **US11** — En tant que **commercial**, je veux rejoindre le fil d'un collègue absent, afin qu'une
  affaire ne s'arrête pas pendant ses congés.
- **US12** — En tant que **commercial**, je veux clore un fil avec un motif typé, afin que le
  pipeline dise la vérité sur ce qui s'est passé.

### Administrateur INFLUX

- **US13** — En tant qu'**administrateur**, je veux voir qui a lu quelle conversation, quand et pour
  quel motif, afin de pouvoir répondre à une contestation sans approximation.
- **US14** — En tant qu'**administrateur**, je veux être alerté si un agent consulte un nombre
  anormal de fils dont il n'est pas responsable, afin de traiter un abus de droit avant qu'il ne
  devienne un incident.

### Système

- **US15** — En tant que **système**, je veux qu'aucun chemin de lecture d'un message par un rôle
  interne n'échappe à la journalisation, afin que l'engagement pris dans les CGU soit vérifiable.

---

## Règles de gestion

### A. Le fil, ses participants et leur affichage

**RG1** — Une conversation existe **si et seulement si** une mise en relation validée la porte,
dans une relation un pour un. Une conversation orpheline est impossible, pas seulement interdite
(`04` §5.7). Ce document ne décrit jamais la création d'une conversation par un autre chemin.

**RG2** — **Toute conversation compte trois participants dès son origine** : le compte marque, le
compte créateur et le commercial responsable. Jamais deux. Il n'existe aucun état du produit dans
lequel une marque et un créateur se parlent sans qu'un agent soit participant.

**RG3** — Une conversation comporte **exactement un** compte marque actif et **exactement un** compte
créateur actif. Aucune seconde partie ne peut être ajoutée, d'aucun côté : il n'existe pas de fil de
groupe, pas de fil « campagne », pas de conversation multi-créateurs.

**RG4** — Chaque participant porte **un rôle affiché** (marque, créateur, INFLUX) et **une date
d'entrée**. Le panneau des participants affiche les trois, avec la date d'entrée de chacun et, le cas
échéant, la date de sortie.

**RG5** — Les noms affichés sont, sans exception :
| Participant | Nom affiché |
|---|---|
| Marque | Le **nom commercial**, puis le **prénom et la fonction** de l'interlocuteur révélé (`06`) |
| Créateur | Le **pseudo principal révélé** (`07`) |
| Agent INFLUX | **« Prénom — INFLUX »** |

**RG6** — Le suffixe « — INFLUX » **n'est jamais stocké** : il est ajouté à l'affichage (`04` §5.1).
Aucun compte d'agent ne porte « INFLUX » dans son nom affiché en base.

**RG7** — Le rôle d'un participant est porté par **un libellé écrit et une marque visuelle**, jamais
par la couleur seule (`CLAUDE.md` §5.2, point 7). Un lecteur daltonien doit distinguer un message
d'agent d'un message de partie sans effort.

**RG8** — **L'ajout d'un agent en cours de route est un événement visible et horodaté** : un message
système nommé apparaît dans le fil (« Thomas — INFLUX a rejoint la conversation le 14 mars à
10 h 12 »). **Jamais un ajout silencieux**, pour personne, y compris un administrateur.

**RG9** — La **sortie** d'un participant suit exactement le même régime : message système, horodaté,
nommé. Un participant sorti conserve la lecture du fil jusqu'à sa clôture, et perd l'écriture.

**RG10** — La **réattribution du commercial responsable** ajoute le nouveau responsable comme
participant et produit un message système le nommant. Le précédent peut rester participant ; s'il
sort, sa sortie est visible (RG9). L'historique des responsables successifs n'est jamais écrasé
(C(22)).

**RG11** — Une conversation dans l'état `ouverte`, `active` ou `en pause` a **à tout moment au moins
un agent participant**. Cet invariant n'est pas exprimable en contrainte simple : il est tenu par la
transaction d'ouverture, par l'interdiction de sortir le dernier agent, et par un **contrôle nocturne
qui alerte** si un fil non clos n'a plus d'agent (`04` §5.7).

**RG12** — Au-delà de **trois agents participants actifs** sur un même fil, une alerte est levée au
backoffice. Ce n'est pas un blocage : c'est un signal que quelque chose ne va pas dans l'attribution.

**RG13** — **L'auteur réel d'un message est immuable et il n'existe aucun mécanisme d'écriture « au
nom de » quelqu'un d'autre**, pour personne, y compris un administrateur. Il n'existe ni compte
générique « INFLUX », ni message anonyme, ni message attribué à la plateforme autre qu'un message
système explicitement identifié comme tel.

**RG14** — Les **messages système** sont une liste fermée de codes, rendus dans la langue du lecteur
(`04` R8). Aucun texte n'est stocké. Liste au MVP :

| Code | Fait relaté | Visible de |
|---|---|---|
| `conversation.opened` | Ouverture du fil, référence et campagne rappelées | Les trois |
| `agent.joined` · `agent.left` | Entrée ou sortie d'un agent, nommé et horodaté | Les trois |
| `agent.owner_changed` | Changement de commercial responsable | Les trois |
| `conversation.paused` · `conversation.resumed` | Mise en pause et reprise | Les trois |
| `conversation.closed` · `conversation.reopened` | Clôture et réouverture | Les trois |
| `conversation.archived` | Archivage | Les trois |
| `party.write_disabled` | Une partie ne peut plus écrire (suspension), **sans motif divulgué** | Les trois |
| `party.account_deleted` | Une partie a supprimé son compte | Les trois |
| `conversation.write_closed_by_block` | L'écriture des deux parties est fermée à la suite d'un blocage | Les trois |
| `document.available` | Un document contrôlé est mis à disposition | Les trois |

Le **refus** d'un document n'est **pas** un message système : il est notifié au seul déposant (RG73).

---

### B. Le cycle de vie du fil

**RG15** — Un fil connaît **cinq états et aucun autre** : `ouverte`, `active`, `en pause`, `close`,
`archivée`.

| État | Signification | Lecture | Écriture des parties | Écriture des agents |
|---|---|---|---|---|
| `ouverte` | Créée, identités révélées, aucun message échangé | Oui | Oui | Oui |
| `active` | Au moins un message échangé | Oui | Oui | Oui |
| `en pause` | Négociation suspendue par décision d'un agent | Oui | **Non** | Oui |
| `close` | Négociation terminée, motif typé obligatoire | Oui | Non | Non |
| `archivée` | Sortie des listes courantes, retrouvable par recherche | Oui | Non | Non |

**RG16** — Le passage `ouverte` → `active` est **automatique au premier message** d'un participant,
quel qu'il soit, **y compris le commercial**. Un fil dans lequel seul le commercial a écrit est
actif : il a commencé à travailler.

**RG17** — La **mise en pause est une décision humaine d'un agent**, avec **motif typé obligatoire**
et message système. Elle n'est **jamais automatique**.

**RG18** — En pause, les deux parties **lisent mais n'écrivent pas** ; les agents écrivent. C'est ce
qui donne son utilité à l'état : il permet au commercial de reprendre la main sur une négociation qui
part de travers, sans clore l'affaire.

**RG19** — La **reprise** est une décision d'un agent, avec message système. Le fil repasse en
`active`.

**RG20** — La **clôture est une décision d'un agent, avec motif typé obligatoire** (liste fermée
ci-dessous). Après clôture, personne n'écrit plus, tout le monde lit encore.

| Motif de clôture | Quand l'utiliser |
|---|---|
| `affaire_signee` | Un contrat a été signé entre les parties (l'affaire vit dans le pipeline, `01` §6) |
| `refus_marque` · `refus_createur` | Une partie décline explicitement |
| `sans_reponse` | Silence prolongé malgré relances |
| `desaccord_budget` | Les parties ne s'entendent pas sur le montant |
| `hors_sujet` | Le besoin ne correspondait pas |
| `ouverture_erronee` | Le fil n'aurait pas dû être ouvert |
| `signalement_fonde` | Décision prise à la suite d'un signalement |
| `blocage_entre_parties` | Une partie a bloqué l'autre et le commercial met fin au fil |
| `compte_supprime` · `compte_suspendu` | Une partie n'est plus en état de négocier |
| `autre` | **Commentaire interne obligatoire**, motif surveillé mensuellement |

**RG21** — **La clôture n'est jamais automatique au MVP.** Un fil silencieux depuis **14 jours** sans
état commercial mis à jour produit une **alerte** au commercial responsable (`01` M6), pas une
clôture. Une plateforme qui ferme toute seule une négociation en sommeil ferme des affaires.

**RG22** — Un fil clos peut être **rouvert par un agent, avec motif, message système et
journalisation**. Il repasse en `active`. L'historique des clôtures et réouvertures successives vit
dans le registre, pas dans une colonne écrasée.

**RG23** — L'**archivage** est automatique **90 jours après la clôture**, ou manuel par un agent sur
un fil clos. Il fait sortir le fil des listes courantes ; il ne le rend ni invisible, ni
introuvable, ni moins lisible.

**RG24** — **Aucun état ne supprime le fil.** Clore, archiver et supprimer sont trois choses
différentes ; **la troisième n'existe pas** au MVP, pour personne, y compris un administrateur.

**RG25** — **Chaque transition d'état est journalisée** avec son auteur, sa date, l'état avant, l'état
après et le motif.

**RG26** — **L'état du fil et l'état de l'affaire sont indépendants.** Clore un fil ne change pas le
pipeline commercial (`01` §6) et inversement. Une seule combinaison lève une alerte : un fil clos
alors que l'affaire est encore dans un état non terminal.

---

### C. Ce que chacun voit une fois la conversation ouverte

**RG27** — **Rappel du fait acquis, sans le re-spécifier** : à l'ouverture du fil, les identités des
deux parties ont **déjà** été révélées, simultanément et une seule fois, dans la transaction décrite
par C(21). Ce document ne décrit ni ce mécanisme, ni son déclenchement, ni son irréversibilité : voir
le document `13` et `01` §4.3.

**RG28** — Le fil affiche un **en-tête permanent**, visible sans défilement, portant : la **référence
de la mise en relation** (`MER-2026-000123`), le **nom de la campagne**, la **date et l'heure de la
révélation**, le **nom des deux parties** et le **nom du commercial responsable**. Ce n'est pas une
note perdue dans l'historique : c'est un cadre permanent (`messaging-spec` règle 10).

**RG29** — **Les coordonnées directes des deux côtés restent masquées dans le produit après
l'ouverture** — e-mail, téléphone, page de contact, formulaire. Le masquage est **symétrique**
(**D40**, `06`) : ce qui est masqué côté créateur l'est côté marque. Rien dans le fil ne les
réaffiche. **Règle confirmée par le fondateur le 2026-09-24 (D46)** : l'e-mail, le téléphone et la
page de contact ne sont jamais montrés à un membre, ni avant ni après l'ouverture ; `06` et `13` ont
été alignés.

**RG30** — Depuis le fil, chaque partie accède à la fiche de l'autre **dans son état révélé** :
couche publique plus couche révélée, jamais la couche interne (`06`, `07`). Le fil n'est pas une
porte dérobée vers des données auxquelles le profil ne donne pas accès.

**RG31** — Le fil porte un **bandeau permanent de supervision** (§I), lisible sans action, dans la
langue de l'utilisateur.

**RG32** — L'**état du fil est affiché aux trois participants**. Le **motif** de pause ou de clôture
est affiché **en clair aux agents** et sous un **libellé neutre aux parties** (« Cette conversation
a été clôturée par INFLUX le 14 mars »). Un motif interne comme `signalement_fonde` n'est jamais
montré à une partie.

**RG33** — Les parties ne voient **jamais** : les détections de coordonnées, le journal des lectures,
les notes internes, l'état de l'affaire, les montants du pipeline commercial (C(28)), les
signalements émis par l'autre partie, les motifs internes.

**RG34** — Un membre ne voit **jamais** un fil dont il n'est pas participant, ni son existence, ni
son en-tête, ni son décompte.

---

### D. Écrire un message

**RG35** — Un message est un **texte brut de 1 à 10 000 caractères** une fois les espaces de bord
retirés. Les retours à la ligne sont conservés. Ni HTML, ni mise en forme, ni contenu intégré.

**RG36** — **Aucune pièce jointe ne peut être attachée à un message.** L'interface ne propose aucun
bouton de fichier, aucun collage d'image, aucun glisser-déposer. L'interdiction est structurelle
(`04` §5.7 : aucune colonne de fichier n'existe sur la table des messages).

> **Pourquoi cette interdiction tient tout le reste.** Sans elle, la détection de coordonnées devient
> du théâtre : une capture d'écran d'un numéro, une carte de visite photographiée ou un QR code
> passent toute détection textuelle. S'y ajoutent un canal d'exfiltration non modéré et
> l'hébergement de contenus illicites dont la plateforme répondrait. Le besoin légitime est traité
> au §F, autrement.

**RG37** — **Un message envoyé ne se modifie ni ne se supprime**, par personne. Une correction est un
nouveau message. C'est la contrepartie de la valeur probante d'un fil supervisé.

**RG38** — Les messages sont **ordonnés par l'horodatage du serveur**. Deux messages simultanés sont
tous deux conservés et s'affichent dans le **même ordre pour les trois participants**. Aucun message
n'est perdu.

**RG39** — L'écriture est **refusée**, avec un message explicite et non ambigu, si : le compte est
suspendu, le fil est en pause (pour une partie), le fil est clos ou archivé, ou un blocage est posé
entre les parties.

**RG40** — Plafond anti-abus : **20 messages par minute** et **300 messages par jour** par compte,
tous fils confondus. Au-delà, l'envoi est refusé temporairement avec une explication, et une alerte
est levée au backoffice. Aucun message déjà accepté n'est effacé.

**RG41** — *(hypothèse, question ouverte Q3)* Les adresses web contenues dans un message sont
**affichées en clair et ne sont pas cliquables** pour les membres. Un lien cliquable est le vecteur
de sortie de plateforme le plus commode qui soit ; le rendre inerte coûte un clic de copier-coller à
un usage légitime.

#### La détection de coordonnées — avant l'envoi, puis à l'enregistrement

**RG42** — Le contrôle de coordonnées s'exécute **côté serveur, au moment où l'émetteur demande
l'envoi, avant que le message ne parte**. Ce n'est pas un contrôle d'affichage côté navigateur : un
contrôle côté navigateur se désactive.

**RG43** — **L'avertissement est non bloquant.** L'émetteur voit les passages concernés surlignés
dans **son propre brouillon**, un texte court expliquant pourquoi INFLUX le signale, et **deux
actions : « Modifier » et « Envoyer quand même »**. Le ton n'est jamais une menace : « Les échanges
se passent ici. En dehors, INFLUX ne peut plus vous accompagner ni intervenir en cas de problème. »

**RG44** — **Le contrôle préalable ne stocke rien** : ni le brouillon, ni le texte détecté, ni une
détection. Un brouillon corrigé avant envoi ne laisse aucune trace, ce qui est la contrepartie
normale du fait de laisser l'utilisateur se corriger.

**RG45** — À l'enregistrement du message, **une détection est écrite par motif trouvé**, portant : le
**type**, la **position de début et de fin** dans le message, la **version du détecteur**, et deux
indicateurs — **« l'émetteur a été averti avant l'envoi »** et **« il a envoyé malgré
l'avertissement »**.

> Ces deux indicateurs sont la donnée la plus utile du dispositif : un partage involontaire et un
> partage assumé après avertissement ne disent pas la même chose, et seul le second mérite l'attention
> du commercial. **Ils manquent au modèle de données** (§Impacts).

**RG46** — **Le texte détecté n'est jamais recopié** : ni dans la détection, ni dans le registre, ni
dans un journal applicatif, ni dans un e-mail d'alerte, ni dans un export. Recopier le numéro qu'on
prétend protéger reviendrait à construire, à côté de la messagerie, l'annuaire qu'on veut éviter
(C(26)).

**RG47** — Motifs détectés au MVP : **adresse e-mail**, **numéro de téléphone** (formats
internationaux), **identifiant de réseau social**, **lien de messagerie tierce**, **IBAN**, **adresse
web**. Le catalogue exact appartient à `01` M5 et à `intermediation-tracking` : ce document ne le
réinvente pas.

**RG48** — **On signale, on ne masque pas, on ne bloque pas, on ne sanctionne pas** (M5 allégé). Le
message part tel quel. Aucun caractère n'est remplacé, aucune sanction automatique n'existe.

**RG49** — La détection s'applique **symétriquement aux deux parties et aussi aux messages des
agents**. Un commercial qui donne son numéro personnel crée exactement le même risque. Une détection
portant sur un message d'agent est visible de **l'administrateur**, pas des parties.

**RG50** — Le commercial **classe** chaque détection : `légitime`, `suspicion de contournement`,
`faux positif`. Le classement est journalisé. **Le destinataire du message n'est jamais informé**
qu'une détection a eu lieu : il n'a rien fait.

---

### E. Lire un fil

**RG51** — Chaque participant dispose d'un **curseur de lecture** : le dernier message qu'il a vu, et
la date à laquelle il l'a vu. Il n'existe **pas** d'accusé de lecture par message (`04` §5.7).

**RG52** — Le curseur avance à l'ouverture du fil jusqu'au dernier message affiché. **Il ne recule
jamais automatiquement.** Un membre peut marquer un fil comme non lu ; cette action ne modifie pas le
journal des lectures.

**RG53** — L'accusé **« lu / non lu » ne concerne que les deux parties entre elles**. La marque voit
si le créateur a ouvert le fil depuis son dernier message, et réciproquement.

**RG54** — *(hypothèse motivée, question ouverte Q4)* **La lecture par un agent n'est pas affichée
comme accusé de réception aux parties.** La supervision est annoncée globalement et en permanence
(§I) ; la transformer en compteur message par message renseignerait les parties sur l'attention
commerciale portée à leur affaire et rendrait le silence d'un commercial visible et anxiogène.

#### La lecture par un agent — le cœur d'A10

**RG55** — **Toute lecture d'une conversation par un rôle `agent` ou `admin` passe par la fonction
journalisante, qu'il soit participant ou non, sans exception** (C(24)). Il n'existe aucun autre chemin
de lecture : le droit de lecture directe sur les messages est retiré à ces rôles (`03` §5.2). **C'est
ce retrait, et non la fonction, qui fait la garantie.**

**RG56** — Une lecture exige un **motif typé**, dans une liste fermée. Pour un agent **participant**,
le motif `suivi_de_l_affaire` est retenu **automatiquement** : aucune friction sur le geste
quotidien.

| Motif de lecture | Contexte |
|---|---|
| `suivi_de_l_affaire` | L'agent est participant ; retenu automatiquement |
| `continuite_de_service` | Le responsable est absent, l'affaire ne doit pas s'arrêter |
| `reprise_de_dossier` | Réattribution en cours |
| `instruction_signalement` | Un signalement a été émis sur ce fil |
| `litige_ou_contestation` | Différend entre les parties, ou contestation d'une commission |
| `controle_qualite` | Revue interne d'échantillon |
| `demande_rgpd` | Instruction d'une demande d'accès d'une personne concernée |
| `autre` | **Commentaire obligatoire**, motif surveillé chaque semaine |

**RG57** — Pour un agent **non participant**, le **choix du motif est explicite et préalable** :
l'écran demande le motif **avant** d'afficher le moindre message. Un motif choisi après coup ne vaut
rien.

**RG58** — Le journal d'une lecture contient : **qui** (compte et rôle), **quand**, **quelle
conversation**, **quel motif**, **quel écran d'origine**, **participant ou non au moment de la
lecture**, l'identifiant de requête, les bornes de pagination et le nombre de messages renvoyés.
**Jamais le contenu d'un message, jamais un extrait, jamais un aperçu.**

**RG59** — Le journal est consultable au backoffice : un **administrateur** voit toutes les lectures ;
un **agent** voit les siennes. Aucun membre n'y accède directement (RG63).

**RG60** — Le **contrôle croisé** entre lectures effectives et lectures journalisées repose sur les
quatre contrôles de `03` §5.3, qui font autorité : vérification en intégration continue qu'aucun rôle
interne n'a de droit de lecture directe (**X1**), vérification statique de l'unicité du chemin
applicatif (**X2**), **rapprochement statistique nocturne** entre le nombre d'exécutions de requêtes
sur les messages et le nombre de lectures journalisées, avec alerte au-delà d'un écart (**X3**), et
**revue humaine hebdomadaire** du classement des agents par nombre de fils distincts lus (**X4**).
Côté produit, seule la revue hebdomadaire est un geste : elle est inscrite au rituel d'équipe.

**RG61** — Une **alerte** est levée lorsqu'un même agent ouvre plus de **40 conversations distinctes
sur 24 heures** (seuil paramétrable au backoffice). Ce seuil ne bloque rien : il déclenche une
conversation entre humains.

**RG62** — Sont **interdits au MVP** : la lecture en lot, l'export de masse des messages, la recherche
plein texte transverse à plusieurs conversations. Une conversation par appel.

**RG63** — Une demande d'un membre d'obtenir le contenu de ses échanges est traitée comme une
**demande d'accès RGPD par le backoffice**, jamais par un export libre depuis le fil.

**RG64** — **Limite assumée et écrite** : aucun de ces contrôles n'empêche un administrateur du projet
Supabase de lire les messages depuis la console d'administration, sans trace dans notre journal
(`03` §5.3). Ce point est porté au fondateur (question ouverte Q9) ; il ne doit pas être passé sous
silence dans l'information donnée aux utilisateurs.

---

### F. Le canal de documents

> **Périmètre conditionnel.** Le canal de documents est une **proposition** de la skill
> `messaging-spec` (sa question ouverte n° 4), déjà modélisée dans `04` §5.7 sous réserve
> (`messaging.documents`). **Si le fondateur l'écarte, tout le §F disparaît** et aucune autre règle de
> ce document n'en dépend. Les manques du modèle sont listés en §Impacts.

**RG65** — La distinction est énoncée dans l'interface en une phrase : **« un message part tout de
suite et n'est pas relu ; un document est contrôlé avant d'être transmis. »**

**RG66** — Un document est rattaché à **la mise en relation**, pas à un message. Il vit dans un
onglet du fil, pas dans le flux de discussion.

**RG67** — Peuvent déposer : **les deux parties et les agents**.

**RG68** — Types acceptés, **liste fermée** : **PNG, JPEG, WebP** (images uniquement). Taille maximale
**10 Mo** par document, **10 documents** par mise en relation. Tout autre type — **PDF compris** — est
refusé à l'envoi avec un message explicite.

> **Correction du 2026-09-19 (arbitrage `chef-de-projet`).** La première rédaction acceptait le PDF.
> Or `03` **E1-9** refuse le PDF au MVP (un PDF servi depuis notre origine est un document actif) et
> `03` **E1-11** demande de rouvrir le risque de l'absence d'antivirus dès qu'un canal de documents
> existe. `03` fait autorité (veto `expert-cybersecurite`). **Conséquence produit à connaître :** un
> brief ou un moodboard en PDF, format le plus courant, ne peut pas transiter par ce canal au MVP ;
> il se dépose sous forme d'image ou se colle en texte dans le fil. Le PDF pourra être rouvert quand
> les conditions de `03` E1-9 et E1-11 seront remplies — **Q5**, arbitres : fondateur +
> `expert-cybersecurite`.

**RG69** — Le document est affiché sous un **libellé choisi dans une liste fermée** : `brief`,
`moodboard`, `exemple_de_contenu`, `charte_de_marque`, `planning`, `autre` (commentaire interne
obligatoire). **Le nom de fichier d'origine n'est jamais affiché à un membre** : c'est un champ de
texte libre, donc un vecteur de coordonnées (`devis-jean-0612345678.pdf`). Il reste visible de l'agent
qui contrôle.

**RG70** — **Contrat, devis et facture sont explicitement hors de cette liste.** Le contrat est hors
application (**A1**) ; le canal de documents n'est pas un canal contractuel et ne doit pas le devenir
par glissement.

**RG71** — **La mise à disposition de l'autre partie n'a lieu qu'après contrôle par un agent.** Délai
cible : **1 jour ouvré**, aligné sur le SLA de la file de validation (**D39**). Le dépassement est une
alerte.

**RG72** — Tant que le contrôle n'a pas eu lieu, le **déposant** voit son document avec la mention
« en cours de contrôle » ; **l'autre partie ne voit rien** — ni le document, ni son existence, ni un
emplacement en attente.

**RG73** — Un document **refusé** l'est avec un **motif typé**. Le déposant en est informé
individuellement ; **l'autre partie n'a jamais su qu'il existait**. Le refus n'est pas un message
système.

**RG74** — La **mise à disposition** produit un message système `document.available` dans le fil.

**RG75** — Le **dépôt**, le **contrôle** (accepté ou refusé), la **mise à disposition** et **chaque
téléchargement** sont journalisés avec leur auteur et leur date.

**RG76** — **La détection automatique de coordonnées ne s'applique pas au contenu des documents au
MVP.** C'est dit franchement : sur ce canal, c'est **le contrôle humain** qui tient ce rôle, et c'est
la raison d'être du contrôle préalable.

**RG77** — **Aucune analyse antivirale n'est réalisée au MVP** : risque accepté et documenté par
`03` E1-11, qui demande explicitement sa réouverture si un canal de documents est ouvert. **C'est
donc rouvert ici** (question ouverte Q5, veto `expert-cybersecurite`).

**RG78** — Les fichiers qui ont déjà leur place ailleurs **n'entrent pas** dans ce canal : portfolio
(profil créateur, modéré, `07`), pièces de vérification (stockage privé, `08`), brief structuré
(fiche campagne, `09`).

---

### G. Signalement et blocage

**RG79** — Les **deux parties** peuvent signaler, depuis le fil entier ou depuis un message précis.
Les agents ne signalent pas : ils disposent des notes internes et de l'escalade.

**RG80** — Motifs de signalement, **liste fermée** : `contenu_deplace_ou_agressif`,
`tentative_de_sortie_de_plateforme`, `soupcon_usurpation`, `contenu_illicite`, `autre`. Le commentaire
est facultatif, **sauf sur `autre` où il est obligatoire**.

**RG81** — Le signalant reçoit immédiatement une **confirmation de prise en compte**, avec le rappel
que le fil est supervisé et qu'un agent l'examinera.

**RG82** — Un signalement crée une entrée dans la **file « signalements » du backoffice**, avec un
SLA propre de **1 jour ouvré**. **Il n'interrompt pas automatiquement la conversation** : c'est un
agent qui décide.

**RG83** — **La personne visée n'est pas informée de l'existence du signalement.** Elle n'est informée
que d'une décision qui la concerne, si une décision est prise.

**RG84** — La décision d'un agent est **typée et journalisée** : `sans_suite`, `avertissement`,
`clôture_du_fil`, `suspension_de_compte`, `blocage_impose`. Le signalant est informé que son
signalement a été traité, **sans détail sur la mesure prise** à l'égard de l'autre personne.

**RG85** — Anti-abus : **5 signalements actifs maximum** par compte. Au-delà, le suivant est refusé
avec une explication et une invitation à contacter INFLUX.

**RG86** — Le **blocage** entre parties est posé et retiré depuis l'espace membre ou par un rôle
interne, avec **motif typé** et **journalisation** (document `10` **RG28**, qui fait autorité ; les
questions de qui peut bloquer, avec quelle information de la partie bloquée et quel recours restent
ouvertes en **Q11 du document `10`**).

**RG87** — Effet d'un blocage **sur le fil** : l'**écriture est fermée pour les deux parties**, la
**lecture est conservée**, un message système `conversation.write_closed_by_block` apparaît, et le
**commercial responsable est alerté**. Le fil **n'est pas clos automatiquement** : l'agent décide, soit
en clôturant avec le motif `blocage_entre_parties`, soit en tentant une médiation.

**RG88** — Effet d'un blocage **sur les recherches futures** : renvoi au document `10`, qui fait
autorité. Précision importante, parce que deux règles voisines sont souvent confondues :

| Situation | Côté marque (recherche anonymisée) | Côté commercial (vue identifiée) |
|---|---|---|
| **Paire bloquée** (`10` E5, RG28) | Profil **absent**, silencieusement : aucun message, aucun emplacement grisé, pas compté dans les résultats (RG29) | Profil **visible avec un avertissement bloquant** : le commercial doit savoir pourquoi il ne peut pas proposer ce créateur |
| **Paire déjà en relation, non bloquée** (`10` RG32) | Profil **visible et signalé** : « vous êtes déjà en relation », action principale « Ouvrir la conversation » | Idem |

**RG89** — **Le blocage ne supprime rien** : ni le fil, ni l'affaire dans le pipeline, ni la preuve de
mise en relation, ni ce qui a été révélé. Ce qui a été révélé reste révélé.

---

### H. Les notifications

**RG90** — **L'e-mail de notification ne contient jamais le texte du message.** Règle non négociable,
pour trois raisons à reprendre telles quelles si elle est contestée : un e-mail qui porte le texte
permet de répondre par e-mail, donc de sortir du fil supervisé ; dupliquer une négociation chez un
prestataire d'emailing sans nécessité est une exposition gratuite ; et un message lu dans l'e-mail
n'est pas un message lu dans INFLUX, ce qui rend les accusés de lecture faux.

**RG91** — Contenu exact de l'e-mail : **qui** a écrit (nom affiché selon RG5), **quelle campagne**,
**la référence** `MER-2026-000123`, **un lien vers le fil**, et une ligne de rappel de la supervision.
Rien d'autre.

**RG92** — Le nom affiché dans l'objet et le corps **respecte l'état de révélation**. À ce stade, les
identités sont révélées (RG27) ; la règle reste écrite parce qu'elle sera décisive le jour où une
notification précédera une révélation.

**RG93** — **Cadence pour un membre** : un e-mail **immédiat** (sous 5 minutes) au premier message non
lu d'un fil ; puis **aucun autre e-mail** tant que le destinataire n'a pas ouvert le fil ; un
**rappel unique à 24 heures** s'il ne l'a toujours pas ouvert, mentionnant le nombre de messages en
attente. **Maximum deux e-mails par fil et par cycle de non-lecture.**

**RG94** — L'ouverture du fil **réarme le cycle** : le message suivant redonne droit à un e-mail
immédiat.

**RG95** — **Cadence pour un agent** : **aucun e-mail unitaire par message**. Un **récapitulatif
quotidien ouvrable** des fils dont il est responsable, plus des **alertes immédiates** sur : détection
de coordonnées, signalement, silence de 14 jours, échec définitif d'envoi, document à contrôler hors
délai.

**RG96** — **Aucune adresse de réponse fonctionnelle.** Les e-mails partent d'une adresse qui
n'accepte pas de réponse ; un membre qui répond quand même reçoit une **réponse automatique unique**
le renvoyant vers le fil. Aucun lien de réponse directe n'existe dans l'e-mail.

**RG97** — Les notifications de messagerie sont **transactionnelles** : elles sont **distinctes du
consentement marketing** et ne se désabonnent pas comme une campagne (`CLAUDE.md` §8). Tant qu'un
membre a une conversation `ouverte` ou `active`, il **ne peut pas les couper** ; il peut seulement
choisir entre **immédiat** et **récapitulatif quotidien**.

**RG98** — **Un échec d'envoi n'efface pas le message.** La notification part dans la file
d'événements, est rejouée, et un échec définitif est visible au backoffice avec rejeu manuel. Une
adresse devenue injoignable suit le traitement du document `05` (`identity.email_delivery_incidents`)
— et, depuis **D37**, une adresse injoignable signifie un **compte inaccessible**, pas une simple gêne
marketing.

**RG99** — Le **tableau de bord du commercial** affiche au minimum : les fils **silencieux depuis
14 jours** sans état commercial mis à jour, les fils avec **coordonnées repérées non classées**, les
**signalements en attente**, les **documents à contrôler**, les fils **sans agent actif**, et les fils
dont il est responsable avec des **messages non lus**.

**RG100** — Aucun canal de notification autre que l'e-mail au MVP : ni SMS, ni notification poussée,
ni messagerie tierce.

---

### I. Le statut juridique des échanges

**RG101** — **Les échanges hébergés par INFLUX ne sont pas des correspondances privées : ce sont des
échanges hébergés et supervisés** (**A10**). Cette qualification est une décision de produit assumée,
pas une conséquence technique.

**RG102** — Elle figure à **cinq endroits**, et le manquement à l'un d'eux est un défaut bloquant :

| Où | Forme |
|---|---|
| **CGU** | Une clause dédiée, en français et en anglais |
| **Politique de confidentialité** | Finalité, base légale, destinataires internes, durée de conservation, droits des personnes |
| **Écran d'information avant le premier message** | Affiché une fois par compte, à la première conversation ouverte |
| **Bandeau permanent en en-tête du fil** | Une ligne lisible sans action, avec un lien vers le détail |
| **E-mail de mise en relation** (`01` M2) | Mention du commercial nommé qui suit l'affaire |

**RG103** — L'information donnée avant le premier message couvre **cinq points, dans cet ordre** :
1. un commercial INFLUX nommé participe à cette conversation en permanence ;
2. un autre agent INFLUX peut lire la conversation, notamment en cas d'absence, de signalement ou de
   litige ;
3. chacune de ces lectures est horodatée, attribuée et conservée ;
4. les messages sont conservés pendant une durée écrite, et ne sont ni modifiables ni supprimables ;
5. les coordonnées directes restent masquées dans le produit, et les échanges hors plateforme
   privent les deux parties de l'accompagnement d'INFLUX.

**RG104** — La **prise de connaissance est horodatée**, avec la **version du texte** et la langue.
**Ce n'est pas un consentement** : on ne demande pas une autorisation qu'on ne pourrait pas refuser
sans fermer le produit. La qualification de la base légale appartient à `expert-conformite-rgpd`
(question ouverte Q1, **veto**).

**RG105** — **Vocabulaire interdit** dans l'interface, les e-mails et les CGU : « preuve légale »,
« horodatage certifié », « valeur probante » (`01` M4). Les termes justes sont « journal
d'activité », « historique de la mise en relation », « confirmation envoyée le … ».

**RG106** — Tous ces textes existent **en français et en anglais** dès la mise en ligne. La version
opposable est celle de la langue dans laquelle l'utilisateur en a pris connaissance.

**RG107** — **Validation obligatoire par `expert-conformite-rgpd` (veto) et par un juriste avant la
mise en ligne.** Une supervision non annoncée est une supervision illicite : c'est un motif de blocage
de livraison, pas une réserve de fin de document.

---

### J. Conservation et suppression

**RG108** — **Ce document ne fixe aucune durée nouvelle.** Les durées applicables sont celles du
document `04` §9.1, validées par `expert-conformite-rgpd` : **messages, 3 ans après la clôture de la
conversation** ; **journal des lectures, 3 ans** ; **registre chaîné, sans purge** (`01` M4, point 6).

**RG109** — Le sort d'une conversation lors d'une **suppression de compte** est fixé par `01` (§M4 et
§10) et par `messaging-spec` règle 35 : **suppression logique et anonymisation du demandeur, fil,
affaire et journal conservés sous forme pseudonymisée**. Côté produit, cela se traduit par :
l'autre partie voit **« Compte supprimé »** à la place du nom, les messages restent lisibles, le
commercial est alerté, et l'affaire suit son état propre. **Ce document ne rediscute pas cette
règle.**

**RG110** — Aucune durée « indéfinie » n'existe. Toute durée applicable aux échanges est écrite dans
la politique de confidentialité et affichée dans l'information du RG103.

**RG111** — **L'archivage n'est pas une purge** : un fil archivé reste lisible jusqu'au terme de sa
durée de conservation.

**RG112** — La conservation probatoire des échanges **doit figurer dans la politique de
confidentialité dès le Lot 1**, avant même que la messagerie n'existe (`01` M4, point 6). Sans
mention explicite au moment des faits, le droit de conserver n'existe pas.

---

## Cas limites

### Les huit cas obligatoires de `feature-spec`

| # | Cas | Comportement attendu |
|---|---|---|
| 1 | **Donnée absente** : le profil d'une partie a été suspendu après l'ouverture du fil | Le fil reste ouvert et lisible ; le nom affiché reste celui qui était en vigueur ; l'écriture de la partie suspendue est fermée (message système `party.write_disabled`, **sans motif divulgué**) ; le commercial est alerté |
| 2 | **Valeur nulle, négative ou aberrante** : message vide, uniquement des espaces, ou de 40 000 caractères | Refus à l'envoi avec un message précis nommant la contrainte (1 à 10 000 caractères une fois les espaces de bord retirés). Aucun montant n'est calculé ni interprété dans ce périmètre (**A1**) : un nombre dans un message reste du texte |
| 3 | **Doublon** : le même message envoyé deux fois (double clic, renvoi réseau) | Une clé d'idempotence par tentative d'envoi : le second appel ne crée pas de second message et renvoie le premier. Deux messages **volontairement** identiques restent deux messages |
| 4 | **Action concurrente** : deux agents clôturent le même fil au même instant | Le premier l'emporte ; le second reçoit « ce fil a déjà été clôturé par Thomas — INFLUX à 10 h 12 » et l'écran se rafraîchit. Aucun motif n'est écrasé. Même régime pour la pause, la réouverture et le contrôle d'un document |
| 5 | **Droit insuffisant** : un membre demande un fil dont il n'est pas participant | Réponse « introuvable », jamais « interdit » : distinguer les deux apprendrait l'existence du fil. Aucune ligne de journal de lecture n'est écrite, l'appelant n'étant pas un rôle interne. La tentative est journalisée côté sécurité |
| 6 | **Service externe indisponible** : Brevo hors service au moment d'un envoi de notification | **Le message existe malgré tout.** La notification reste en file, est rejouée, et l'échec définitif est visible au backoffice avec rejeu manuel. Aucune notification n'est perdue silencieusement (RG98) |
| 7 | **Utilisateur qui abandonne** : un membre écrit un brouillon, reçoit l'avertissement de détection et ferme son navigateur | **Rien n'est stocké** (RG44) : ni le brouillon, ni la détection. Le message n'existe pas, le curseur de lecture ne bouge pas, aucune notification ne part |
| 8 | **Annulation ou retour en arrière après validation** : un agent clôture par erreur | La réouverture par un agent est possible, avec motif, message système et journalisation (RG22). **Ce qui a été révélé reste révélé** ; les messages envoyés restent envoyés ; la clôture erronée reste au registre |

### Les cas limites propres à la messagerie (`messaging-spec` étape 10)

| Situation | Comportement attendu |
|---|---|
| Une partie **supprime son compte** | Le fil reste, pseudonymisé ; l'autre partie voit « Compte supprimé » ; le commercial est alerté ; l'affaire suit son état propre (RG109) |
| Une partie est **suspendue** | Écriture fermée pour elle, lecture conservée, fil visible du commercial, **motif de suspension non divulgué** à l'autre partie |
| Le **commercial responsable est absent** | Un autre agent **lit** (journalisé, motif `continuite_de_service`) et peut **rejoindre** le fil, visiblement (RG8). L'affaire peut être réattribuée (RG10) |
| Le commercial **quitte l'entreprise** | La réattribution est un **préalable obligatoire** à la désactivation du compte (C(22)). Les messages passés **conservent son nom** |
| **Conversation ouverte, aucune réponse** | Relance du commercial ; **alerte à 14 jours** ; mise en pause seulement sur décision humaine (RG17, RG21). Jamais de clôture automatique |
| **Deux messages simultanés** | Ordonnancement par horodatage serveur, aucun message perdu, **même ordre pour les trois participants** (RG38) |
| **Conversation ouverte par erreur** | Clôture avec le motif `ouverture_erronee`. **La révélation d'identité, elle, reste** : elle a eu lieu et le journal le dit |
| Le **créateur se rétracte** après l'ouverture | Clôture avec `refus_createur` ; rien n'est « dé-révélé » ; l'affaire passe en `lost` avec son propre motif, dans le pipeline |
| Une partie **demande le contenu du fil** | Demande d'accès RGPD traitée par le backoffice (RG63), jamais un export depuis le fil |
| Un **document est déposé puis la conversation est close** avant contrôle | Le contrôle reste dû : le document apparaît dans la file de contrôle avec la mention « fil clos ». S'il est accepté, il est mis à disposition **sans rouvrir le fil** ; s'il est refusé, seul le déposant est informé |
| Un **blocage est posé pendant qu'un message est en cours de rédaction** | L'envoi est refusé avec un message explicite ; le brouillon n'est pas perdu côté navigateur mais n'est **jamais** stocké côté serveur |
| Un **agent lit un fil, puis le rejoint** dans la même minute | Deux traces distinctes : une **lecture journalisée** (motif explicite) et un **message système d'entrée**. L'une ne remplace pas l'autre |
| Le **détecteur de coordonnées est mis à jour** | La `version du détecteur` change ; les détections passées ne sont **jamais réécrites** ; le corpus peut être rejoué pour mesurer l'écart, sans modifier l'historique |
| **Faux positif** : un nom de domaine cité dans un brief | Détection écrite, avertissement affiché, message envoyé normalement, classement `faux positif` par le commercial. **Aucune conséquence pour l'émetteur** |

---

## Critères d'acceptation

### Le fil et ses participants

**CA1** — *Étant donné* une mise en relation dont les deux parties ont accepté, *quand* la
conversation est ouverte, *alors* elle compte **exactement trois participants actifs** — un compte
marque, un compte créateur, un commercial — chacun avec un rôle et une date d'entrée.

**CA2** — *Étant donné* une conversation ouverte, *quand* on tente d'y ajouter un second compte
marque ou un second compte créateur, *alors* l'opération échoue et rien n'est écrit.

**CA3** — *Étant donné* un fil affiché à l'un des trois participants, *quand* on examine l'en-tête,
*alors* on y lit la référence `MER-…`, le nom de la campagne, la date et l'heure de la révélation, le
nom des deux parties et le nom du commercial responsable, **sans défilement**.

**CA4** — *Étant donné* un agent nommé Thomas qui rejoint un fil le 14 mars à 10 h 12, *quand*
n'importe lequel des participants ouvre le fil, *alors* il voit un message système horodaté nommant
« Thomas — INFLUX », et Thomas apparaît dans le panneau des participants avec **cette** date d'entrée,
pas celle de l'ouverture.

**CA5** — *Étant donné* la base de données, *quand* on inspecte le nom affiché d'un compte d'agent,
*alors* la chaîne « INFLUX » ne s'y trouve pas : le suffixe est ajouté à l'affichage.

**CA6** — *Étant donné* un fil affiché en nuances de gris, *quand* on le lit, *alors* on distingue un
message d'agent d'un message de partie sans recourir à la couleur.

**CA7** — *Étant donné* un administrateur, *quand* il tente d'écrire un message au nom d'une partie,
*alors* aucune fonction du produit ne le permet et l'auteur enregistré reste son propre compte.

**CA8** — *Étant donné* une conversation active dont le seul agent participant sort, *quand* la
sortie est demandée, *alors* elle est refusée tant qu'aucun autre agent n'a rejoint le fil.

### Cycle de vie

**CA9** — *Étant donné* une conversation `ouverte`, *quand* le commercial écrit le premier message,
*alors* elle passe en `active` — le fait que l'auteur soit l'agent et non une partie ne change rien.

**CA10** — *Étant donné* une conversation `active`, *quand* un agent la met en pause sans choisir de
motif, *alors* l'opération est refusée et l'état ne change pas.

**CA11** — *Étant donné* une conversation `en pause`, *quand* la marque tente d'écrire, *alors*
l'envoi est refusé avec une explication ; *quand* l'agent écrit, *alors* le message part.

**CA12** — *Étant donné* une conversation sans message depuis 15 jours, *quand* la vérification
quotidienne s'exécute, *alors* une **alerte** apparaît au tableau de bord du commercial responsable et
l'état de la conversation **n'a pas changé**.

**CA13** — *Étant donné* une conversation clôturée avec le motif `ouverture_erronee`, *quand* on
consulte la mise en relation, *alors* la date de révélation est **toujours présente et inchangée**.

**CA14** — *Étant donné* une conversation clôturée puis rouverte par un agent, *quand* on consulte le
registre, *alors* on y trouve la clôture **et** la réouverture, chacune avec son auteur, sa date et
son motif.

**CA15** — *Étant donné* une conversation clôturée depuis 91 jours, *quand* la tâche d'archivage
s'exécute, *alors* elle passe en `archivée`, sort des listes courantes et **reste lisible** par ses
participants.

**CA16** — *Étant donné* n'importe quel rôle, y compris administrateur, *quand* on cherche une action
de suppression d'une conversation, *alors* elle n'existe nulle part dans le produit.

### Écriture et détection

**CA17** — *Étant donné* la zone de saisie d'un message, *quand* on examine l'interface, *alors*
aucun bouton de fichier, aucune zone de glisser-déposer et aucun collage d'image ne sont proposés.

**CA18** — *Étant donné* un message contenant uniquement des espaces, *quand* le membre l'envoie,
*alors* l'envoi est refusé et le message nomme la contrainte de longueur.

**CA19** — *Étant donné* un message envoyé, *quand* son auteur cherche à le modifier ou à le
supprimer, *alors* aucune action ne le permet, pour lui comme pour un agent ou un administrateur.

**CA20** — *Étant donné* un créateur qui saisit « appelle-moi au 06 12 34 56 78 », *quand* il clique
sur « Envoyer », *alors* **avant tout envoi** il voit le passage surligné, un texte d'explication, et
les deux actions « Modifier » et « Envoyer quand même ».

**CA21** — *Étant donné* la situation précédente, *quand* il choisit « Modifier », retire le numéro et
envoie, *alors* **aucune détection n'est enregistrée** et le message part sans trace d'alerte.

**CA22** — *Étant donné* la même situation, *quand* il choisit « Envoyer quand même », *alors* le
message part **inchangé**, une détection est enregistrée avec le type `téléphone`, la position de
début et de fin, la version du détecteur, et les deux indicateurs « averti avant envoi » et « envoyé
malgré l'avertissement » à vrai.

**CA23** — *Étant donné* une détection enregistrée, *quand* on inspecte la détection, le registre, les
journaux applicatifs et l'e-mail d'alerte envoyé au commercial, *alors* **le numéro détecté ne figure
dans aucun des quatre**.

**CA24** — *Étant donné* un message contenant des coordonnées, *quand* le destinataire l'ouvre,
*alors* il voit le message **entier et non modifié**, sans surlignage, sans avertissement, et sans
savoir qu'une détection existe.

**CA25** — *Étant donné* un message écrit par un **agent** contenant son numéro personnel, *quand* il
est envoyé, *alors* une détection est enregistrée et elle est visible d'un administrateur.

**CA26** — *Étant donné* un compte qui envoie 21 messages en une minute, *quand* il envoie le
vingt-et-unième, *alors* l'envoi est refusé avec une explication, une alerte est levée au backoffice,
et les vingt premiers messages restent intacts.

### Lecture et journalisation

**CA27** — *Étant donné* un fil comportant cinq messages non lus, *quand* le créateur l'ouvre et
défile jusqu'au dernier, *alors* son curseur avance au dernier message et la marque voit ses messages
passer à « lu ».

**CA28** — *Étant donné* un agent qui ouvre le fil, *quand* la marque consulte l'état de ses messages,
*alors* l'accusé de lecture **n'a pas changé** : seule la lecture de l'autre partie l'affecte.

**CA29** — *Étant donné* le rôle `agent` et le rôle `admin`, *quand* la CI vérifie leurs privilèges,
*alors* aucun des deux n'a de droit de lecture directe sur les messages ni sur les conversations.

**CA30** — *Étant donné* un commercial **participant** qui ouvre son propre fil, *quand* la lecture a
lieu, *alors* une ligne de journal est écrite avec le motif `suivi_de_l_affaire` retenu
automatiquement, et **aucun écran intermédiaire** ne lui a été imposé.

**CA31** — *Étant donné* un agent **non participant** qui ouvre un fil, *quand* l'écran s'affiche,
*alors* le choix d'un motif typé lui est demandé **avant** qu'aucun message ne soit visible ; s'il
choisit `autre`, un commentaire lui est demandé et l'accès est refusé tant qu'il n'est pas saisi.

**CA32** — *Étant donné* une lecture journalisée, *quand* on inspecte la ligne écrite, *alors* elle
contient le compte, le rôle, la date et l'heure, la conversation, le motif, l'écran d'origine,
l'indicateur « participant ou non », l'identifiant de requête et le nombre de messages renvoyés — et
**aucun extrait de message**.

**CA33** — *Étant donné* un agent qui ouvre 41 conversations distinctes en 24 heures, *quand* il ouvre
la quarante-et-unième, *alors* une alerte est levée à l'attention des administrateurs et **l'accès
n'est pas bloqué**.

**CA34** — *Étant donné* le backoffice, *quand* un administrateur consulte le journal des lectures,
*alors* il voit les lectures de tous les agents ; *quand* un agent le consulte, *alors* il ne voit que
les siennes.

**CA35** — *Étant donné* un membre qui demande le contenu de ses échanges, *quand* il cherche dans le
produit, *alors* aucune fonction d'export n'existe et le parcours le dirige vers la demande d'accès
traitée par INFLUX.

### Documents *(si le canal est retenu)*

**CA36** — *Étant donné* un fichier au format `.docx`, *quand* une partie tente de le déposer,
*alors* le dépôt est refusé avec un message nommant les trois formats acceptés.

**CA37** — *Étant donné* un document déposé et non encore contrôlé, *quand* l'autre partie ouvre le
fil et l'onglet des documents, *alors* elle **ne voit rien** : ni le document, ni un emplacement en
attente, ni un décompte.

**CA38** — *Étant donné* un document nommé `devis-jean-0612345678.pdf`, *quand* il est mis à
disposition, *alors* le membre destinataire voit un libellé de la liste fermée et **jamais** le nom de
fichier d'origine, que l'agent, lui, peut voir.

**CA39** — *Étant donné* un document refusé par un agent, *quand* on examine le fil, *alors* aucun
message système n'a été écrit et seul le déposant a été informé.

**CA40** — *Étant donné* un document accepté, *quand* il est mis à disposition, *alors* un message
système `document.available` apparaît, et le dépôt, le contrôle, la mise à disposition et chaque
téléchargement ultérieur sont journalisés.

**CA41** — *Étant donné* la liste fermée des libellés de documents, *quand* on l'examine, *alors*
elle ne comporte ni `contrat`, ni `devis`, ni `facture`.

### Signalement et blocage

**CA42** — *Étant donné* un créateur qui signale un message pour `tentative_de_sortie_de_plateforme`,
*quand* il valide, *alors* il reçoit une confirmation rappelant que le fil est supervisé, une entrée
apparaît dans la file « signalements » avec son échéance, et **la conversation reste ouverte**.

**CA43** — *Étant donné* la situation précédente, *quand* la marque consulte le fil, *alors* rien
n'indique qu'un signalement a été émis.

**CA44** — *Étant donné* un compte ayant 5 signalements en cours d'instruction, *quand* il en émet un
sixième, *alors* il est refusé avec une explication et une invitation à contacter INFLUX.

**CA45** — *Étant donné* une marque bloquée par un créateur, *quand* l'une des deux ouvre le fil,
*alors* la lecture fonctionne, l'écriture est refusée pour les deux, un message système l'annonce, et
le commercial responsable reçoit une alerte.

**CA46** — *Étant donné* la même paire bloquée, *quand* la marque effectue une recherche de créateurs,
*alors* le profil est **absent** sans message ni emplacement grisé et n'entre pas dans le nombre de
résultats ; *quand* un commercial cherche en vue identifiée, *alors* le profil apparaît avec un
avertissement bloquant expliquant pourquoi il ne peut pas être proposé.

### Notifications

**CA47** — *Étant donné* un message envoyé, *quand* on inspecte l'e-mail reçu par le destinataire,
*alors* il contient le nom de l'auteur, la campagne, la référence `MER-…` et un lien, et **aucun
caractère du texte du message**.

**CA48** — *Étant donné* le même e-mail, *quand* le destinataire y répond, *alors* aucune adresse de
réponse fonctionnelle n'existe et il reçoit une réponse automatique unique le renvoyant vers le fil.

**CA49** — *Étant donné* un destinataire qui n'ouvre pas son fil, *quand* cinq messages lui sont
envoyés dans la journée, *alors* il reçoit **au plus deux e-mails** : un immédiat et un rappel unique
à 24 heures.

**CA50** — *Étant donné* le même destinataire qui ouvre enfin son fil, *quand* un nouveau message
arrive, *alors* un e-mail immédiat repart : le cycle est réarmé.

**CA51** — *Étant donné* le service d'envoi indisponible, *quand* un message est envoyé, *alors* le
message est enregistré et visible dans le fil, la notification reste en file, et son échec définitif
apparaît au backoffice avec une action de rejeu.

**CA52** — *Étant donné* un membre ayant une conversation active, *quand* il ouvre ses préférences,
*alors* il peut choisir entre notification immédiate et récapitulatif quotidien, et **aucune option ne
lui permet de couper** les notifications de messagerie.

**CA53** — *Étant donné* un membre qui retire son consentement marketing, *quand* un message lui est
adressé, *alors* il reçoit **quand même** la notification de messagerie.

**CA54** — *Étant donné* un commercial, *quand* dix messages arrivent dans ses fils, *alors* il ne
reçoit **aucun e-mail unitaire** ; *quand* une détection de coordonnées est écrite, *alors* il reçoit
une alerte immédiate.

### Statut juridique et conservation

**CA55** — *Étant donné* un membre qui accède à sa **première** conversation, *quand* l'écran
s'affiche, *alors* l'information en cinq points du RG103 lui est présentée avant qu'il ne puisse
écrire, et sa prise de connaissance est enregistrée avec la date, la version du texte et la langue.

**CA56** — *Étant donné* le même membre à sa deuxième conversation, *quand* il l'ouvre, *alors*
l'écran ne réapparaît pas, mais le bandeau permanent est présent en en-tête.

**CA57** — *Étant donné* les CGU, la politique de confidentialité, l'écran d'information, le bandeau
et l'e-mail de mise en relation, *quand* on les relit en français **et** en anglais, *alors* la
supervision y est annoncée dans les cinq, et les expressions « preuve légale », « horodatage
certifié » et « valeur probante » n'apparaissent dans aucun.

**CA58** — *Étant donné* une partie qui supprime son compte, *quand* l'autre partie ouvre le fil,
*alors* elle lit « Compte supprimé » à la place du nom, les messages restent lisibles, et le
commercial reçoit une alerte.

---

## Impacts

### Écrans

| Espace | Écran | Nature |
|---|---|---|
| App membres | **Liste des conversations**, triée par activité, avec état, référence, campagne et compteur de non-lus | Nouveau |
| App membres | **Fil de conversation** : en-tête permanent, panneau des participants, zone de saisie, avertissement de détection, onglet documents | Nouveau |
| App membres | **Écran d'information avant le premier message** (RG103) | Nouveau |
| App membres | **Signalement** : choix du motif, commentaire, confirmation | Nouveau |
| App membres | **Préférences de notification de messagerie** (immédiat / quotidien) | Nouveau |
| Backoffice | **Tableau de bord du commercial** : fils silencieux, coordonnées repérées, signalements, documents à contrôler, fils sans agent | Nouveau |
| Backoffice | **Fil supervisé** avec écran de choix du motif de lecture pour un non-participant | Nouveau |
| Backoffice | **File des signalements** et **file de contrôle des documents**, avec SLA | Nouveau |
| Backoffice | **Journal des lectures** : par agent, par conversation, avec la revue hebdomadaire X4 | Nouveau |
| Backoffice | **Liste des détections** à classer | Nouveau |
| Profils `06` / `07` | Bloc « vous êtes déjà en relation » et accès direct au fil | Ajustement |
| Recherche `10` | Avertissement bloquant sur une paire bloquée, vue commerciale | Ajustement |

### Données — manques constatés dans `04-modele-de-donnees-mvp.md`

Le modèle couvre l'essentiel du §5.7. **Sept manques** sont à traiter par `expert-database` avant
l'ouverture du Lot 4 :

| # | Manque | Règle concernée | Gravité |
|---|---|---|---|
| 1 | `messaging.contact_detections` n'a **ni indicateur « averti avant envoi », ni indicateur « envoyé malgré l'avertissement »** | RG45 | **Haute** — c'est la donnée qui distingue une maladresse d'un contournement assumé |
| 2 | `messaging.conversation_access_log` n'a **pas de motif typé** (`reason_code` + commentaire) ; il ne porte que `surface`, qui dit l'écran, pas la raison | RG56, RG57, RG58 | **Haute** — sans motif, A10 trace l'accès mais pas sa légitimité. Une table `messaging.access_reasons` est nécessaire |
| 3 | `messaging.conversations` n'a **ni `paused_at`, ni motif de pause, ni auteur de pause ou de réouverture** ; la contrainte sur `closure_reason_code` n'autorise pas une réouverture propre | RG17, RG20, RG22 | **Moyenne** |
| 4 | **Aucun support de la prise de connaissance** de l'information « échanges supervisés » (date, version, langue) — à rapprocher de `identity.terms_acceptances` plutôt que de créer une table | RG104 | **Haute** — sans trace, l'information annoncée n'est pas démontrable |
| 5 | `messaging.documents` n'a **ni date de mise à disposition, ni journal des téléchargements** | RG71, RG75 | **Moyenne** (conditionnel au §F) |
| 6 | `audit.event_types` ne contient pas les codes de la messagerie : `conversation.paused`, `conversation.resumed`, `conversation.reopened`, `conversation.archived`, `document.uploaded`, `document.reviewed`, `document.downloaded`, `report.created`, `report.decided`, `detection.reviewed` | RG25, RG50, RG75, RG84 | **Moyenne** — ce sont des données, chargées par migration |
| 7 | `read_session_id`, cité par `03` §5.2 pour regrouper les lectures à l'affichage, **n'existe pas** dans `04` | RG59 | **Basse** |

Aucune table nouvelle n'est demandée hors du point 2 (`messaging.access_reasons`) et, si le canal de
documents est retenu, d'une table de téléchargements.

### Intégrations

- **Brevo** — **uniquement** l'acheminement des e-mails transactionnels de notification, via la file
  d'événements (`leads.outbox_events`, destination `brevo_transactional`). **Aucun contenu de message
  ne transite.** Les notifications sont transactionnelles : elles ne consomment aucun consentement
  marketing et ne s'y soustraient pas (RG97).
- **Apollo.io** — **aucun impact.** La messagerie n'émet aucun lead et n'enrichit aucun contact.
- **Supabase Storage** — uniquement si le canal de documents est retenu ; chemin privé, jamais
  d'URL publique, service avec en-tête `nosniff` (`03` E1).

### Indicateurs

| Indicateur | Pourquoi | Ce qu'il déclenche s'il dérive |
|---|---|---|
| **Délai de première réponse** après l'ouverture d'un fil | Mesure la valeur perçue de la mise en relation | Relance commerciale, révision du texte d'invitation |
| **Part des fils qui atteignent l'état `active`** | Un fil ouvert où personne n'écrit est une mise en relation gâchée | Révision de l'amont (document `13`) |
| **Fils silencieux depuis 14 jours** sans état commercial à jour | Signal de contournement **ou** de saisie négligée (`01` M6) | Appel du commercial, jamais une accusation automatique |
| **Détections pour 100 messages**, et part classée « faux positif » | Règle la détection et mesure le bruit | Ajustement du détecteur, jamais durcissement du blocage |
| **Part des détections « envoyées malgré l'avertissement »** | L'indicateur de contournement le plus honnête du MVP | Discussion commerciale, révision du texte d'avertissement |
| **Signalements pour 1 000 messages**, par motif | Santé du marché et du climat des échanges | Modération, révision des CGU |
| **Lectures par un agent non participant, par semaine et par motif** | Contrepartie mesurable de la supervision annoncée | Revue X4, resserrement des droits |
| **Écart du contrôle croisé X3** | Détecte un chemin de lecture non journalisé | Incident de sécurité |
| **Délai de contrôle d'un document** (p50 / p90, % hors SLA) | Un document en attente bloque une négociation | Renfort, révision du SLA |
| **Part des notifications en échec définitif** | Un message non notifié est un message non lu | Rejeu, traitement des adresses injoignables (`05`) |

### Risque business à signaler explicitement

Trois points de ce périmètre touchent directement la rémunération d'INFLUX, et sont assumés :

1. **La détection documente, elle n'empêche pas** (`01`, illusion n° 3). Un numéro dicté en visio ou
   écrit en toutes lettres passe. Le rempart est le commercial dans le fil, pas le détecteur.
2. **L'interdiction des pièces jointes est ce qui empêche la détection de devenir du théâtre.** Toute
   demande future d'ouvrir les fichiers dans le fil doit être arbitrée à ce niveau, pas traitée comme
   une commodité d'interface.
3. **Le canal de documents est un compromis.** Sans lui, le commercial enverra le brief par e-mail et
   videra le fil de sa substance — ce qui est *exactement* la fuite qu'on cherche à éviter. Avec lui,
   INFLUX assume un contrôle humain et une surface de sécurité. Le rejeter sans alternative serait
   pire que l'accepter.

---

## Hors périmètre

- **Tout ce qui précède l'ouverture de la conversation** : file de validation, verrou, SLA,
  acceptations, révélation d'identité, e-mail de mise en relation → document `13` et `01` §4.
- **Le contrat, la signature, le paiement et tout calcul de commission** (**A1**, V2). Aucun montant
  n'est produit ni interprété par la messagerie.
- **Le pipeline commercial** (états de l'affaire, montants, commission encaissée) → `01` §6.
- **Le catalogue technique de la détection** (expressions, seuils, gravités) → `01` M5 et
  `intermediation-tracking`.
- **Le score de contournement pondéré** — reporté (`01` M6).
- **Les règles de blocage en recherche** → document `10` RG28 à RG32.
- **Les durées de conservation** → `04` §9, veto `expert-conformite-rgpd`.
- **La rédaction des CGU, de la politique de confidentialité et de la clause de non-contournement**
  → juriste, préparation par `expert-conformite-rgpd` (`01` §8).
- **Les maquettes, la densité, la microcopie et le comportement mobile** → `expert-ux`.
- **Le schéma SQL, les politiques d'accès et les tests de privilèges** → `expert-database` et
  `expert-cybersecurite` (`03`, `04`).
- **La messagerie de groupe, les fils multi-créateurs, l'appel audio ou vidéo, la visioconférence, la
  traduction automatique des messages** : aucun de ces sujets n'est au MVP.
- **Les brouillons synchronisés entre appareils** : hors périmètre, et volontairement — un brouillon
  stocké côté serveur serait un contenu non envoyé que la supervision devrait pourtant couvrir.

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **Statut juridique et base légale de la supervision.** Les échanges ne sont pas des correspondances privées (**A10**) : quelle base légale pour la lecture par un agent non participant, quelle rédaction exacte dans les CGU et la politique de confidentialité, et l'information du RG103 suffit-elle sans recueil de consentement ? | Information claire et horodatée, **sans consentement** ; supervision annoncée aux cinq endroits du RG102 | **`expert-conformite-rgpd` (veto)** + juriste | **Lot 1** (les textes partent avec la première mise en ligne) |
| **Q2** | **D30 — politique de signalement des coordonnées** : formulation exacte de l'avertissement, faut-il l'afficher aussi au destinataire (non, selon l'hypothèse), et confirmation définitive de « signaler, ne pas masquer » et de l'interdiction des pièces jointes | Avertir l'émetteur seulement, ne rien masquer, ne rien bloquer, pièces jointes interdites | `product-owner` + `expert-ux` + **Fondateur** | Lot 4 |
| **Q3** | **Liens cliquables dans un message** (RG41). Les rendre inertes protège la plateforme mais gêne un brief légitime qui renvoie vers une page produit | **Non cliquables**, affichés en clair | `expert-ux` + **Fondateur** | Lot 4 |
| **Q4** | **Afficher ou non aux parties que le commercial a lu le fil** (RG54). Transparence renforcée d'un côté, pression et bruit de l'autre | **Ne pas l'afficher** message par message ; annoncer la supervision globalement | `product-owner` + `expert-ux` + `expert-conformite-rgpd` | Lot 4 |
| **Q5** | **Canal de documents** : périmètre confirmé, qui peut déposer, délai de contrôle, **et surtout absence d'analyse antivirale** — `03` E1-11 demande explicitement la réouverture du sujet si ce canal existe | Canal retenu tel que spécifié au §F, sans antivirus, risque documenté | **Fondateur** (périmètre) + **`expert-cybersecurite` (veto)** (antivirus) | Avant l'ouverture du Lot 4 |
| **Q6** | **Seuils** : 14 jours de silence, 90 jours avant archivage, 40 fils distincts par agent et par jour, 20 messages/minute, 5 signalements actifs, 2 e-mails par cycle. Aucun n'est mesuré, tous sont des ordres de grandeur | Valeurs ci-dessus, **paramétrables au backoffice** dès le premier jour | `product-owner` + `chef-de-projet` | Réglage à 3 mois d'exploitation |
| **Q7** | **Réouverture d'un fil clos** (RG22) : faut-il l'autoriser, ou imposer une nouvelle mise en relation ? Autoriser est plus souple ; imposer produit une preuve d'intermédiation neuve | **Autoriser**, réservée à un agent, avec motif et message système | `product-owner` + **`expert-paiement-facturation`** (une réouverture après clôture `affaire_signee` touche la créance V2) | Lot 4 |
| **Q8** | **Sort du fil quand une partie supprime son compte pendant une affaire en cours** : l'hypothèse conservatrice de `messaging-spec` règle 35 (conservation pseudonymisée) est-elle confirmée ? | Conservation pseudonymisée, fil lisible, « Compte supprimé » | **`expert-conformite-rgpd` (veto)** + `expert-paiement-facturation` | Lot 4 |
| **Q9** | **Lecture hors journal par un administrateur du projet Supabase** (RG64) : que dit-on aux utilisateurs, et quelles mesures d'accompagnement (nombre de détenteurs d'accès, séparation des environnements, journalisation côté hébergeur) ? | Limite écrite et assumée, non mentionnée dans l'information aux utilisateurs en l'état | **Fondateur** + `expert-cybersecurite` (veto) | Avant le Lot 4 |
| **Q10** | **Notifications non désabonnables** (RG97) : est-ce tenable au regard du droit de la consommation dans les pays visés, sachant qu'il s'agit d'e-mails de service et que l'adresse est le moyen d'authentification (**D37**) ? | Non désabonnables tant qu'une conversation est ouverte ou active ; choix de cadence seulement | **`expert-conformite-rgpd` (veto)** | Lot 4 |
| **Q11** | **Blocage entre parties** (renvoi) : qui peut bloquer, avec quel motif, avec quelle information de la partie bloquée, et quel recours ? Question déjà ouverte en **Q11 du document `10`** ; ce document en dépend pour RG86 à RG89 | Blocage silencieux, motif typé, aucune information de la partie bloquée | `product-owner` + `expert-conformite-rgpd` | Lot 3, **avant** le Lot 4 |

---

**Ce document ne modifie aucun autre fichier.** Les sept manques du modèle de données (§Impacts) sont
adressés à `expert-database` ; la mise à jour de `CLAUDE.md` §13 relève de `chef-de-projet`.

---

## Additif du 2026-09-24 — Les apartés (D47)

> **Origine.** Fonctionnalité apparue dans la maquette jetable (commits `a432a45`, `b7dd0ad`), sans
> spécification. **Arbitrage du fondateur du 2026-09-24 : conservée, et annoncée aux deux parties
> (D47).** Deux précisions du fondateur le même jour : **un membre peut ouvrir lui-même l'aparté**
> (`20` Q1) et **un aparté est lu par tous les agents participants, chaque lecture étant
> journalisée** (`20` Q2).
>
> **Date :** 2026-09-24 · **Auteur :** `product-owner` · **Statut :** spécification complète des
> apartés, soumise à la validation de `chef-de-projet`, avec **avis obligatoire (veto)
> d'`expert-conformite-rgpd`** sur K7 et RG122, et **avis obligatoire (veto)
> d'`expert-cybersecurite`** sur K4 et K8.
>
> **Interface :** `20-direction-design.md` §7 (onglets, phrase d'audience, brouillon attaché à son
> canal, microcopies). Ce document fixe les règles, `20` fixe l'écran ; en cas d'écart, les règles
> ci-dessous priment et `20` est corrigé.

**Ce qui est décidé.** Dans une conversation ouverte, chaque partie dispose d'un **canal privé avec
INFLUX** : la marque avec les agents de la conversation, le créateur avec les agents de la
conversation, en plus du fil commun à trois. C'est le geste naturel d'un courtier, qui parle
séparément à chaque partie — et c'est aussi l'endroit où une partie dit à INFLUX ce qu'elle ne dira
pas devant l'autre. Ce canal répond, pour les conversations ouvertes, au manque relevé par `17b` I11
/ V5 (écrire à un seul membre) ; l'écriture à un membre **hors** de toute conversation reste ouverte
(Q14).

**Choix de spécification tranchés par cet additif**, à valider par `chef-de-projet` :

| Sujet | Choix | Règle |
|---|---|---|
| Pause du fil | Le fil commun se ferme aux parties, **les apartés restent ouverts** : la pause est le moment où le commercial parle séparément à chacun | RG123 |
| Blocage entre parties | Le fil commun se ferme, **les apartés restent ouverts** : un blocage coupe le lien entre les parties, pas le lien avec INFLUX | RG126 |
| Passage `ouverte` → `active` | **Seul un message du fil commun** le déclenche, sinon l'état trahirait l'existence d'un aparté | RG124 |
| Notifications | Un **cycle par canal** : un message privé d'INFLUX n'est jamais noyé dans le cycle du fil commun | RG136 |
| Signalement d'un message d'agent | **Instruit par un administrateur**, jamais par l'agent visé | RG140 |
| Mot « privé » | Veut dire « non visible de l'autre partie », **jamais** « lu par le seul commercial » | RG142 |

**Ce que l'additif modifie dans les règles existantes :**

| Règle | Modification |
|---|---|
| RG2, RG3, RG38 | Le fil **commun** reste unique et vu dans le même ordre par les trois participants. Un aparté est un **canal distinct** rattaché à la même conversation : jamais une quatrième partie, jamais un fil de groupe |
| RG14 | `agent.joined`, `agent.left` et `agent.owner_changed` sont **aussi** écrits dans chaque aparté (RG128) |
| RG16 | Le passage `ouverte` → `active` n'est déclenché que par un message du fil commun (RG124) |
| RG18 | En pause, les parties écrivent encore dans leur aparté (RG123) |
| RG51, RG53 | Le curseur de lecture est tenu **par canal** ; les accusés de lecture ne concernent que le fil commun (RG133) |
| RG58 | Le journal d'une lecture porte **le canal lu** (RG130) |
| RG87 | Un blocage laisse les apartés ouverts (RG126) |
| RG93 | Le cycle de notification est tenu par canal (RG136) |
| RG99 | Le tableau de bord distingue les messages privés non lus, par partie (RG137) |
| RG102, RG103 | L'information sur la supervision gagne un **sixième point** (RG141) |

---

### K. Les apartés

#### K1. Ce qu'est un aparté

**RG113** — Une conversation comporte, en plus du fil commun, **exactement deux apartés** : l'**aparté
marque** (le compte marque et les agents participants) et l'**aparté créateur** (le compte créateur et
les agents participants). Ils existent dès l'ouverture de la conversation, vides. **Il n'existe aucun
autre canal** : pas d'aparté entre agents (ils ont les notes internes), pas d'échange marque ↔
créateur sans agent (RG2), pas d'aparté réunissant plusieurs membres (RG3).

**RG114** — Un message appartient à **un seul canal** — `commun`, `aparté marque` ou `aparté
créateur` —, fixé à l'envoi et **immuable**. Aucune fonction ne déplace, ne copie, ne cite ni ne
transfère un message d'un canal à l'autre, pour personne, administrateur compris. Un agent qui
reformule dans un canal ce qu'il a appris dans un autre écrit un **nouveau message**, sous son propre
nom : c'est son métier, encadré par RG122.

**RG115** — Qui lit et qui écrit, canal par canal :

| | Fil commun | Aparté marque | Aparté créateur |
|---|---|---|---|
| **Compte marque** | Lit, écrit | Lit, écrit | **Rien** — ni le contenu, ni l'existence |
| **Compte créateur** | Lit, écrit | **Rien** | Lit, écrit |
| **Agent participant actif** | Lit (journalisé), écrit | Lit (journalisé), écrit | Lit (journalisé), écrit |
| **Agent participant sorti** (RG9) | Lit jusqu'à la clôture | Idem | Idem |
| **Agent non participant, administrateur** | Lit avec motif (RG57) | Lit avec motif, canal par canal (RG132) | Idem |

**RG116** — **Tous les agents participants lisent et écrivent dans les deux apartés** (arbitrage du
fondateur, `20` Q2). Un agent qui rejoint la conversation en cours de route (RG8) accède à **tout
l'historique** des deux apartés, y compris antérieur à son entrée : un commercial qui reprend une
affaire doit savoir ce qui a été dit à chaque partie. Chaque lecture est journalisée (RG130).

**RG117** — L'aparté d'une partie lui est **toujours présenté**, même vide, et **elle peut y écrire la
première** (arbitrage du fondateur, `20` Q1). Vu de l'autre partie, un aparté vide et un aparté
utilisé ont exactement la même apparence : aucune.

**RG118** — **L'autre partie ne voit ni le contenu ni l'existence d'un aparté donné, ni directement
ni indirectement.** Sont calculés **uniquement à partir des canaux visibles de leur destinataire** :
le compteur de non-lus, la date de dernière activité, l'ordre de la liste des conversations, l'état
du fil (RG124), les notifications (RG138). Toute donnée dérivée qui varie selon l'activité d'un
aparté invisible au lecteur est une fuite, traitée comme un défaut bloquant.

#### K2. Écrire en aparté

**RG119** — Les règles d'écriture du fil commun s'appliquent **sans changement** : texte brut de 1 à
10 000 caractères (RG35), **aucune pièce jointe** (RG36), ni modification ni suppression (RG37), ordre
fixé par le serveur (RG38), refus explicite (RG39), liens non cliquables (RG41). Le plafond de RG40
(20 par minute, 300 par jour) compte **tous les canaux confondus**.

**RG120** — Le **canal est un paramètre explicite et obligatoire** de tout envoi. Le serveur n'a
**aucune valeur par défaut** : un envoi sans canal est refusé, il n'atterrit jamais dans le fil
commun. Le serveur vérifie que l'émetteur a le droit d'écrire dans ce canal (RG115) ; une partie qui
tente d'écrire dans l'aparté de l'autre obtient la même réponse qu'un fil inexistant
(« introuvable », cas limite 5), et la tentative est journalisée côté sécurité. La clé
d'idempotence (cas limite 3) inclut le canal.

**RG121** — **Les garde-fous d'interface de `20` §7.2 sont obligatoires** : on écrit dans le canal
affiché, la zone de saisie nomme ses lecteurs, le brouillon reste attaché à son canal, le bouton
d'envoi nomme l'exception. Ils sont la **principale protection contre l'erreur de destinataire**, qui
ne se rattrape pas (RG37, Q13).

**RG122** — *(hypothèse, question ouverte Q12)* **Ce qu'une partie dit en aparté n'est pas rapporté à
l'autre partie sans l'accord de son auteur.** Le commercial reste libre de formuler ses propres
propositions (« INFLUX propose 1 200 EUR »), jamais d'attribuer à une partie ce qu'elle lui a confié
(« le créateur m'a dit que son plancher est 900 EUR »). C'est une **règle de conduite** que le système
ne peut pas vérifier : elle est écrite dans la procédure des commerciaux, dans les CGU et dans
l'information de RG141, et contrôlée par la revue de qualité (motif `controle_qualite`, RG56).

#### K3. Le cycle de vie

**RG123** — Un aparté **n'a pas d'état propre** : il suit l'état de la conversation (RG15), avec une
différence voulue en pause.

| État de la conversation | Fil commun — parties | Aparté — sa partie | Agents, tous canaux |
|---|---|---|---|
| `ouverte`, `active` | Écrivent | Écrit | Écrivent |
| `en pause` | **N'écrivent pas** (RG18) | **Écrit** | Écrivent |
| `close`, `archivée` | N'écrivent pas | N'écrit pas | N'écrivent pas |

La pause sert au commercial à reprendre la main sur une négociation qui part de travers (RG18) :
parler séparément à chaque partie est précisément ce qu'il fait alors. Dans le fil commun en pause,
l'encart d'explication renvoie la partie vers son aparté.

**RG124** — **Seul un message du fil commun fait passer la conversation de `ouverte` à `active`**
(RG16 amendée). Un message en aparté, d'une partie ou d'un agent, laisse l'état inchangé : l'état est
affiché aux deux parties (RG32), et un changement provoqué par un aparté apprendrait à l'autre partie
qu'il existe.

**RG125** — Le **silence de 14 jours** (RG21) se mesure sur **tous les canaux** : un échange en aparté
est une activité commerciale. Cette mesure n'est visible que des agents.

**RG126** — **Blocage entre parties** (RG87) : l'écriture du fil commun est fermée aux deux parties ;
**chaque aparté reste ouvert en écriture à sa partie**. Un blocage coupe le lien entre les parties,
pas le lien avec INFLUX ; c'est par les apartés que le commercial tente la médiation prévue par RG87.

**RG127** — **Suspension d'une partie** (RG39, C(23)) : la partie suspendue n'écrit plus **dans aucun
canal**, aparté compris ; elle conserve la lecture.

**RG128** — Les messages système `agent.joined`, `agent.left` et `agent.owner_changed` sont écrits
**dans le fil commun et dans chaque aparté**, pour que chaque partie sache à tout moment qui lit ce
qu'elle écrit en privé. Les autres messages système (pause, clôture, blocage, suspension, document)
restent dans le fil commun ; l'état de la conversation est rappelé dans l'en-tête, qui est commun aux
onglets.

**RG129** — Le **bandeau de l'aparté nomme les agents participants actifs**, à jour à chaque entrée ou
sortie, et donne accès à l'explication de RG141 (`20` §7.3).

#### K4. Lire un aparté

**RG130** — Toute lecture d'un aparté par un rôle `agent` ou `admin` passe par la **fonction
journalisante** (RG55, C(24)), que l'agent soit participant ou non. **Le journal porte le canal lu** :
la lecture du fil commun et celle d'un aparté sont **deux lignes distinctes**. Le contenu de RG58 est
complété du canal ; il ne contient toujours ni contenu, ni extrait, ni aperçu.

**RG131** — Pour un agent **participant**, le motif `suivi_de_l_affaire` est retenu automatiquement
**sur les trois canaux**, sans écran intermédiaire (RG56).

**RG132** — Pour un agent **non participant**, le motif est demandé **avant le premier message**
(RG57) et vaut pour la consultation en cours ; **chaque canal ouvert produit sa propre ligne**.
Ouvrir le fil commun **ne charge pas** les apartés : ils ne sont chargés que sur action explicite
(ouverture de l'onglet), qui affiche le rappel « échange privé avec ⟨partie⟩ ». Une lecture d'aparté
par un non-participant est la lecture la plus sensible du produit ; elle ne doit jamais se produire
par effet de bord.

**RG133** — Le **curseur de lecture** (RG51) est tenu **par canal**. **Aucun accusé de lecture
n'existe dans un aparté**, pour personne : ni la partie ne voit que l'agent a lu (RG54), ni l'agent
ne voit que la partie a lu.

**RG134** — La **revue hebdomadaire X4** (RG60) et le seuil de RG61 comptent des conversations, tous
canaux confondus ; la revue **isole les lectures d'apartés par des agents non participants**, avec
leur motif.

#### K5. Notifications

**RG135** — RG90 à RG98 s'appliquent. L'e-mail d'un message en aparté est adressé **à la seule partie
de cet aparté**, dit qu'il s'agit d'un message privé (« Thomas — INFLUX vous a écrit en privé à propos
de la campagne … »), **ne contient aucun caractère du texte**, et son lien ouvre **directement
l'onglet de l'aparté**.

**RG136** — Le cycle de RG93 est tenu **par canal** : l'aparté a son propre e-mail immédiat et son
propre rappel à 24 heures. Un membre reçoit donc **au plus deux e-mails par canal** et par cycle de
non-lecture. L'ouverture de l'onglet de l'aparté réarme son cycle (RG94), celle du fil commun
seulement le sien.

**RG137** — Agents : **aucun e-mail unitaire** (RG95). Le tableau de bord (RG99) et le récapitulatif
quotidien distinguent les **messages privés non lus**, par partie (« 1 message privé — marque »).

**RG138** — L'autre partie ne reçoit **aucune** notification, aucun rappel et aucun compteur liés à un
aparté qui n'est pas le sien (RG118).

#### K6. Détection et signalement

**RG139** — La **détection de coordonnées** (RG42 à RG50) s'applique aux apartés sans changement, y
compris aux messages des agents (RG49) : avertissement avant l'envoi, détection écrite avec le canal
connu par le message, classement par le commercial. Une coordonnée donnée **à INFLUX** en aparté reste
une détection : le commercial la classe, le plus souvent `légitime` ; une négociation poursuivie par
téléphone reste une négociation sans trace.

**RG140** — Une partie peut **signaler un message écrit par un agent**, dans son aparté comme dans le
fil commun (RG79). Un tel signalement est **instruit par un administrateur autre que l'auteur du
message** ; l'agent visé n'en est pas informé (RG83) et ne le voit pas dans sa file. L'aparté est le
seul endroit où un agent parle à une partie sans que l'autre partie en soit témoin : c'est là qu'un
abus serait le moins visible.

#### K7. Information, vocabulaire et droits des personnes

**RG141** — L'information sur la supervision (RG102, RG103) comporte **un sixième point**, aux cinq
endroits de RG102 et **dès la première version** du texte :
> « Chaque partie peut échanger en privé avec INFLUX, et INFLUX avec chacune d'elles. Ces échanges
> ne sont pas visibles de l'autre partie. Comme le reste de la conversation, ils sont lus par les
> agents INFLUX qui la suivent, peuvent l'être par un autre agent INFLUX dans les cas prévus, chaque
> lecture étant enregistrée, et sont conservés pour la même durée. »

La règle de conduite de RG122, une fois tranchée (Q12), y est ajoutée.

**RG142** — **Le mot « privé » veut dire « non visible de l'autre partie », et rien d'autre.** Aucun
texte ne dit ni ne laisse entendre que **seul le commercial nommé** lit l'aparté : comme tout le fil,
il peut être lu par un autre agent, avec motif et journalisation (RG57). Sont **interdits** dans
l'interface, les e-mails et les CGU : « seuls vous et … », « confidentiel », « secret »,
« strictement privé ». Les échanges hébergés par INFLUX ne sont pas des correspondances privées
(RG101) ; un aparté non plus.

**RG143** — **Droit d'accès** : un membre obtient **l'intégralité de son aparté** — ses messages et
ceux des agents qui lui sont adressés —, puisqu'un aparté n'a pas d'autre partie ; il n'obtient
**jamais** l'aparté de l'autre partie, ni la moindre indication de son existence. Le régime du fil
commun reste celui de `15` Q7. *(Sous réserve de `15` Q7, veto `expert-conformite-rgpd`.)*

**RG144** — **Conservation et suppression** : RG108 à RG112 s'appliquent sans changement, l'aparté
suit sa conversation. À la suppression d'un compte, l'aparté est pseudonymisé comme le reste
(RG109) ; les agents y lisent « Compte supprimé ».

#### K8. Cloisonnement technique

**RG145** — **Le cloisonnement entre les deux apartés est une règle d'accès en base**, pas un filtre
dans le code applicatif : un compte marque qui interrogerait directement la base sous son propre rôle
n'obtiendrait **aucune ligne** de l'aparté créateur, et réciproquement. Cette règle est **doublée**
d'un filtre de sortie dans `apps/api` et d'un **test automatisé** exécuté en intégration continue —
la même doctrine que l'anonymisation des profils (`CLAUDE.md` §6). La maquette filtre dans le code :
c'est un écart de maquette, pas un modèle.

**RG146** — Les **données dérivées** de RG118 (compteurs, dernière activité, ordre, état,
notifications, curseurs) sont calculées à partir des seuls canaux visibles de leur destinataire, et
**les tests de RG145 les couvrent aussi** : une fuite passe plus souvent par un compteur que par un
message.

---

### Cas limites des apartés

| Situation | Comportement attendu |
|---|---|
| **Un agent écrit dans le mauvais canal** et révèle à une partie ce qui était destiné à l'autre | Le message ne se retire pas (RG37). L'agent le **déclare** à un administrateur par une note interne ; l'administrateur décide s'il faut en informer la partie lésée. Les garde-fous de RG121 sont la prévention ; Q13 étudie un délai d'annulation d'envoi |
| **La marque écrit dans son aparté** alors que le fil commun est vide | La conversation reste `ouverte` (RG124) ; le créateur ne voit aucun changement (RG118) ; l'agent voit le message et son tableau de bord le signale (RG137) |
| **Un agent rejoint** une conversation dont les apartés sont déjà nourris | Il lit tout l'historique des deux apartés, chaque ouverture étant journalisée (RG116, RG130) ; chaque partie voit dans son aparté le message système qui le nomme, et le bandeau est mis à jour (RG128, RG129) |
| **Le commercial responsable est réattribué** | Le nouveau responsable entre dans les deux apartés avec le message système `agent.owner_changed` ; l'ancien, s'il sort, garde la lecture jusqu'à la clôture et perd l'écriture (RG9) |
| **Un agent non participant** instruit un signalement sur le fil commun | Il ne charge que le fil commun ; les apartés ne sont ouverts que s'il les ouvre explicitement, avec une ligne de journal par canal (RG132) |
| **Conversation en pause** | Le fil commun est fermé aux parties, avec un encart qui renvoie vers l'aparté ; chaque aparté reste ouvert (RG123) |
| **Blocage entre parties** | Le fil commun est fermé aux deux parties ; chaque aparté reste ouvert, et le commercial y conduit la médiation (RG126) |
| **Une partie est suspendue** | Elle n'écrit plus dans aucun canal, garde la lecture ; l'autre partie ne voit que `party.write_disabled` dans le fil commun, sans motif (RG127) |
| **Conversation close** | Plus aucune écriture, dans aucun canal ; lecture conservée ; une réouverture (RG22) rouvre les trois canaux |
| **Une partie supprime son compte** | Son aparté est pseudonymisé ; les agents y lisent « Compte supprimé » ; l'aparté de l'autre partie n'est pas affecté (RG144) |
| **Un créateur donne son numéro à INFLUX** en aparté | Avertissement avant l'envoi, puis détection si le message part ; le commercial la classe (RG139). Aucune information n'atteint la marque |
| **Une partie signale un message du commercial** écrit en aparté | Signalement affecté à un administrateur autre que l'auteur ; le commercial n'en voit rien (RG140) |
| **Une partie demande le contenu de ses échanges** | Son aparté lui est communiqué en entier ; celui de l'autre partie jamais (RG143) |
| **Une partie tente d'écrire dans l'aparté de l'autre** en forgeant la requête | « Introuvable », rien n'est écrit, tentative journalisée côté sécurité (RG120) |
| **Deux agents écrivent au même instant** dans le même aparté | Ordre fixé par le serveur, aucun message perdu, même ordre pour tous (RG38) |

---

### Critères d'acceptation des apartés

**CA59** — *Étant donné* une conversation qui vient d'être ouverte, *quand* la marque l'affiche,
*alors* elle voit l'onglet du fil commun et l'onglet de son aparté, vide et ouvert à l'écriture ; le
créateur voit la même chose de son côté.

**CA60** — *Étant donné* une marque qui écrit la première dans son aparté, *quand* le commercial
responsable ouvre la conversation, *alors* il voit le message dans l'aparté marque, et une ligne de
journal portant ce canal et le motif `suivi_de_l_affaire` est écrite sans écran intermédiaire.

**CA61** — *Étant donné* un message envoyé dans l'aparté marque, *quand* le créateur consulte la
liste de ses conversations et le fil, *alors* rien n'a changé pour lui : ni compteur de non-lus, ni
date de dernière activité, ni ordre de la liste, ni état du fil, et aucun e-mail ne lui a été envoyé.

**CA62** — *Étant donné* une conversation `ouverte` où seule la marque a écrit, en aparté, *quand* on
consulte son état, *alors* elle est toujours `ouverte` ; *quand* un premier message est écrit dans le
fil commun, *alors* elle passe en `active`.

**CA63** — *Étant donné* le rôle d'exécution du créateur, participant d'une conversation, *quand* on
interroge directement la base sur les messages de cette conversation, *alors* aucune ligne de
l'aparté marque n'est renvoyée — et réciproquement pour le rôle de la marque. Ce test s'exécute en
intégration continue.

**CA64** — *Étant donné* un compte créateur, *quand* il demande à l'API l'envoi d'un message dans le
canal de l'aparté marque, *alors* il reçoit « introuvable », aucun message n'est écrit et la
tentative est journalisée côté sécurité.

**CA65** — *Étant donné* une demande d'envoi qui ne précise pas de canal, *quand* elle parvient au
serveur, *alors* elle est refusée et aucun message n'est créé, ni dans le fil commun ni ailleurs.

**CA66** — *Étant donné* un message d'aparté, *quand* n'importe quel rôle, administrateur compris,
cherche à le déplacer, le copier, le citer ou le transférer vers un autre canal, *alors* aucune
fonction du produit ne le permet.

**CA67** — *Étant donné* un agent, Marie, qui rejoint la conversation le 20 mars, *quand* elle ouvre
l'aparté créateur, *alors* elle lit tout son historique, y compris les messages antérieurs au 20 mars,
une ligne de journal portant ce canal est écrite, et le créateur voit dans son aparté le message
système nommant « Marie — INFLUX » ainsi qu'un bandeau qui la nomme.

**CA68** — *Étant donné* un agent non participant qui choisit le motif `continuite_de_service`,
*quand* il affiche la conversation, *alors* seul le fil commun est chargé et une seule ligne de
journal est écrite ; *quand* il ouvre ensuite l'aparté marque, *alors* une seconde ligne, portant ce
canal, est écrite.

**CA69** — *Étant donné* une conversation `en pause`, *quand* la marque écrit dans le fil commun,
*alors* l'envoi est refusé avec une explication qui l'oriente vers son aparté ; *quand* elle écrit
dans son aparté, *alors* le message part.

**CA70** — *Étant donné* une paire bloquée par le créateur, *quand* chaque partie écrit dans son
aparté, *alors* les deux messages partent, et le fil commun reste fermé aux deux.

**CA71** — *Étant donné* une conversation `close`, *quand* une partie ou un agent tente d'écrire dans
un aparté, *alors* l'envoi est refusé et la lecture reste possible.

**CA72** — *Étant donné* une partie suspendue, *quand* elle tente d'écrire dans son aparté, *alors*
l'envoi est refusé.

**CA73** — *Étant donné* un message d'agent dans l'aparté créateur, *quand* on inspecte l'e-mail reçu
par le créateur, *alors* il indique un message privé, ne contient aucun caractère du texte, et son
lien ouvre l'onglet de l'aparté ; la marque ne reçoit aucun e-mail.

**CA74** — *Étant donné* un créateur qui n'ouvre ni le fil commun ni son aparté, *quand* trois
messages arrivent dans chacun au cours de la journée, *alors* il reçoit au plus deux e-mails pour le
fil commun et au plus deux pour l'aparté.

**CA75** — *Étant donné* un aparté, *quand* la partie ou l'agent consulte ses messages, *alors* aucun
accusé de lecture n'est affiché, d'un côté comme de l'autre.

**CA76** — *Étant donné* un créateur qui écrit son numéro de téléphone dans son aparté, *quand* il
clique sur « Envoyer », *alors* l'avertissement de RG43 s'affiche ; *quand* il envoie quand même,
*alors* une détection est enregistrée et apparaît à classer chez le commercial, et la marque n'en
voit rien.

**CA77** — *Étant donné* un créateur qui signale un message écrit par l'agent Thomas dans son aparté,
*quand* le signalement est créé, *alors* il est affecté à un administrateur autre que Thomas, et
Thomas ne le voit ni dans sa file ni ailleurs.

**CA78** — *Étant donné* l'écran d'information avant le premier message, le bandeau de l'aparté, les
CGU et la politique de confidentialité, *quand* on les relit en français **et** en anglais, *alors*
le sixième point de RG141 y figure, et les formulations « seuls vous et », « confidentiel »,
« secret » et « strictement privé » n'apparaissent nulle part.

**CA79** — *Étant donné* une demande d'accès de la marque, *quand* l'export est préparé, *alors* il
contient l'intégralité de l'aparté marque, et **aucun** élément de l'aparté créateur, ni son
existence.

**CA80** — *Étant donné* le tableau de bord du commercial responsable, *quand* la marque lui écrit en
aparté, *alors* la conversation y apparaît avec la mention « 1 message privé — marque », et aucun
e-mail unitaire ne lui est envoyé.

**CA81** — *Étant donné* un agent qui a commencé un message dans l'aparté marque, *quand* il passe à
l'onglet du fil commun, y écrit et envoie, *alors* seul le texte saisi dans le fil commun part, et son
brouillon reste dans l'onglet de l'aparté marque, non envoyé.

---

### Impacts des apartés

**Écrans** (conception : `20` §7 ; wireframes détaillés à reporter dans `17` §4.7 et `17b` §3.4.b) :

| Espace | Écran | Nature |
|---|---|---|
| App membres | **Fil de conversation** : onglets « À trois » et « Vous et INFLUX », bandeau de l'aparté, phrase d'audience, brouillon par onglet, encart de pause renvoyant vers l'aparté | Ajustement |
| App membres | **Liste des conversations** : compteurs et dernière activité calculés sur les seuls canaux visibles | Ajustement |
| App membres | **Écran d'information avant le premier message** : sixième point | Ajustement |
| Backoffice | **Fil supervisé** : quatre onglets (commun, aparté marque, aparté créateur, documents), chargement des apartés sur action explicite pour un non-participant | Ajustement |
| Backoffice | **Tableau de bord du commercial** et récapitulatif quotidien : messages privés non lus, par partie | Ajustement |
| Backoffice | **Journal des lectures** : colonne « canal », filtre sur les lectures d'apartés par des non-participants | Ajustement |
| Backoffice | **File des signalements** : un signalement visant un message d'agent n'est visible que des administrateurs autres que son auteur | Ajustement |

**Données** — à modéliser par `expert-database`, sous veto `expert-cybersecurite` (`04` §12.11,
point 3) :

| # | Besoin | Règle |
|---|---|---|
| 1 | Un **canal** sur chaque message (`common` · `advertiser_private` · `creator_private`), obligatoire, **sans valeur par défaut**, immuable ; les messages système portent aussi leur canal | RG114, RG120, RG128 |
| 2 | Une **règle d'accès en base par canal** pour les rôles marque et créateur — politique d'accès aux lignes ou objets séparés, au choix d'`expert-database` —, doublée d'un filtre de sortie et d'un test | RG145 |
| 3 | Le **curseur de lecture** tenu par canal (`messaging.conversation_reads`) | RG133 |
| 4 | Le **canal** dans le journal des lectures (`messaging.conversation_access_log`) | RG130 |
| 5 | Le passage `ouverte` → `active` conditionné au canal commun | RG124 |
| 6 | Le **canal** dans l'événement de notification (gabarit et lien) | RG135, RG136 |
| 7 | L'affectation d'un signalement visant un message d'agent aux seuls administrateurs autres que son auteur | RG140 |

**Tests** — à ajouter au plan `18` : cloisonnement par rôle en accès direct (CA63), données dérivées
(CA61, CA62), refus de l'API (CA64, CA65), journal par canal (CA67, CA68), notifications (CA73,
CA74), export au titre du droit d'accès (CA79).

**Indicateurs** :

| Indicateur | Pourquoi | Ce qu'il déclenche s'il dérive |
|---|---|---|
| **Part des conversations avec au moins un aparté utilisé**, et qui l'a ouvert (partie ou agent) | Mesure l'usage réel du geste de courtier | Revue de la procédure commerciale |
| **Délai de réponse de l'agent en aparté** | Une partie qui écrit en privé à INFLUX attend une réponse humaine | Renfort, alerte au tableau de bord |
| **Lectures d'apartés par des agents non participants**, par semaine et par motif | La lecture la plus sensible du produit | Revue X4, resserrement des droits |
| **Déclarations d'erreur de canal** | Mesure l'efficacité des garde-fous de RG121 | Q13 : délai d'annulation d'envoi |

---

### Questions ouvertes des apartés

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q12** | **Confidentialité de l'aparté vis-à-vis de l'autre partie** (RG122). INFLUX est rémunéré par les deux parties : que promet-il à chacune sur ce qu'elle lui confie en privé ? | Confidentialité par défaut : le commercial ne rapporte pas à l'autre partie ce qui lui a été confié sans l'accord de son auteur ; il formule ses propres propositions | **Fondateur** + **`expert-conformite-rgpd` (veto)** + juriste | **Lot 1** (CGU) |
| **Q13** | **Délai d'annulation d'envoi pour les agents**, quelques secondes pendant lesquelles un message n'est pas encore remis, pour rattraper une erreur de canal qui ne se retire pas (RG37) | Non au MVP : garde-fous d'écran (RG121) et déclaration de l'incident ; décision au vu de l'indicateur « erreurs de canal » | `product-owner` + `expert-ux` | Après 3 mois d'exploitation |
| **Q14** | **Écrire à un membre hors de toute conversation** (`17b` I11 / V5), par exemple pour relancer un créateur avant toute mise en relation | Hors périmètre de cet additif ; les apartés couvrent les conversations ouvertes | `chef-de-projet` + `product-owner` | Lot 5 |
| **Q15** | **Périmètre de l'export au titre du droit d'accès** pour un aparté (RG143) | Aparté communiqué en entier, jamais celui de l'autre partie | **`expert-conformite-rgpd` (veto)**, avec `15` Q7 | Lot 5 |
