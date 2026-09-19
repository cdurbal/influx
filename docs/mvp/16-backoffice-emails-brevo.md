# Lot 5 — Les e-mails Brevo : envois depuis le backoffice et e-mails transactionnels

> **Date :** 2026-09-19 · **Auteur :** agent `expert-integrations-api`, avec l'avis d'`expert-marketing`
> (segments, cadence, contenus) et d'`expert-conformite-rgpd` (**veto** sur les bases légales, la
> saisie libre, le suivi nominatif et la propagation des désinscriptions).
> **Statut :** spécification complète du volet « e-mails » du Lot 5, soumise à la validation de
> `chef-de-projet`, avec **veto `expert-conformite-rgpd`** (§C, §E, §G, §I) et **veto
> `expert-cybersecurite`** (§J, §M — en particulier l'absence de signature des webhooks Brevo).
>
> **Skills appliquées :** `feature-spec` (format de sortie), `brevo-campaign` (mode opératoire),
> `lead-pipeline` (file d'événements), `env-secrets` (clés), `backoffice-ops` (écrans internes).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` §3, §8 et §9 (source de vérité) ;
> `00-cadrage-mvp-v2.md` (**A4**, Lot 5) ; `01-intermediation-courtee.md` §5 M2 (l'e-mail de
> révélation est une preuve) ; `03-matrice-des-droits-et-rls.md` (rôles, double validation,
> interdits) ; `04-modele-de-donnees-mvp.md` §5.8, §5.10 et §9 (tables et conservation) ;
> `05-spec-inscription-et-leads.md` (consentement, pipeline, désinscriptions, délivrabilité du code
> de connexion) ; `12-messagerie-a-trois.md` §H (notifications sans le texte) ;
> `13-file-de-validation-et-mise-en-relation.md` §F et §K (e-mails de mise en relation) ;
> `15-backoffice-files-et-supervision.md` §F, §H, §I et §K (alertes, actions de masse, exports,
> interdits).
>
> **Ce que ce document tranche :** le parcours complet d'un envoi depuis le backoffice, les
> contrôles propres à chacune des trois sources de destinataires, la bibliothèque de modèles, la
> règle de cadence, le catalogue complet des e-mails transactionnels et leur idempotence, ce qui
> remonte de Brevo et sous quelle forme, le garde-fou d'environnement, l'interrupteur d'urgence, la
> supervision et le contrat d'interface avec Brevo.
>
> **Ce qu'il ne tranche pas :** le contenu éditorial et les segments (→ `expert-marketing`), les
> plafonds définitifs de la saisie libre et la légalité de la prospection (→ **D35**,
> `expert-conformite-rgpd` et le fondateur), le schéma SQL (→ `expert-database`), la maquette
> (→ `expert-ux`), la synchronisation Apollo (→ `05` et la skill `apollo-lead-sync`).
>
> **Invariants rappelés.** Aucun montant, aucun taux, aucune commission, aucun net créateur ne
> figure dans un e-mail ni dans un écran de ce périmètre (**A1**). Aucun texte de conversation ne
> sort de la plateforme (`12` RG90). **Un e-mail réellement envoyé depuis un environnement de test
> est un incident**, pas une maladresse.
>
> **Vérification de la documentation Brevo.** Les points d'accès, limites de débit, en-têtes et
> événements cités au §M ont été vérifiés sur la documentation officielle Brevo **le 2026-09-19**.
> Deux faits en sont issus et changent la conception : Brevo accepte un en-tête
> **`Idempotency-Key`** sur l'envoi transactionnel, et **Brevo ne signe pas ses webhooks** — il
> n'existe ni HMAC, ni JWT, ni en-tête de signature. Le §M6 en tire les conséquences.
> **Aucune de ces valeurs n'est réputée stable : elle est revérifiée au moment d'écrire le code.**

---

## Besoin

**Permettre à l'équipe d'INFLUX d'écrire à ses contacts depuis son propre outil — une marque
inscrite, un segment de créateurs, un prospect identifié — sans jamais envoyer un e-mail à
quelqu'un qui ne l'a pas voulu, sans jamais sur-solliciter personne, et sans qu'une erreur
d'envoi puisse abîmer le seul canal par lequel les membres se connectent à INFLUX.**

Quatre raisons d'être, dans cet ordre :

1. **Commerciale.** Un lead qui dort dans Brevo ne vaut rien. A4 a fait entrer l'envoi d'e-mails
   dans le MVP précisément pour que l'équipe puisse relancer, nourrir et prospecter depuis l'endroit
   où elle travaille, au lieu de basculer dans une deuxième interface où rien n'est tracé.
2. **Juridique.** Trois sources de destinataires, **trois bases légales différentes**. Les mélanger
   rendrait la base légale indémontrable le jour où quelqu'un la demande. C'est le risque juridique
   direct le plus élevé du backoffice (`04` §5.10).
3. **Produit — et c'est le point que l'on sous-estime.** Depuis **D37**, un membre se connecte avec
   **un code à six chiffres reçu par e-mail**. Une plainte pour spam de trop, un domaine mal
   réputé, et ce ne sont pas des campagnes qui tombent en indésirables : **ce sont des gens qui ne
   peuvent plus entrer dans leur compte.** La délivrabilité n'est plus un sujet marketing, c'est la
   disponibilité du produit.
4. **Probatoire.** L'e-mail de confirmation de mise en relation est la **preuve la plus forte et la
   moins chère** du dispositif d'intermédiation (`01` §5 M2, `13` RG78), parce qu'il sort de nos
   systèmes. Il ne tolère ni raccourci, ni doublon, ni silence.

> **La phrase à retenir de tout ce document.** Il existe **trois flux d'e-mails** chez INFLUX —
> transactionnel, marketing, prospection — et ils ne doivent **jamais** partager le même
> sous-domaine d'envoi. Sans cette séparation, une seule campagne de prospection maladroite rend le
> code de connexion indélivrable, et la plateforme entière devient inaccessible. C'est la décision
> structurante du document (RG9).

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Commercial INFLUX** (rôle `agent`) | Prépare et déclenche un envoi à partir d'un segment de contacts de la plateforme ou d'un segment Brevo ; envoie un e-mail unitaire de prospection dans la limite de son plafond ; lit les résultats ; rejoue un échec |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, avec des plafonds propres ; valide et retire un modèle ; modifie les plafonds, la cadence et les listes de configuration ; actionne l'**interrupteur d'urgence** ; traite les incidents de délivrabilité |
| **Membre annonceur / créateur** | Reçoit, ouvre, clique, se désinscrit, se plaint — et reçoit surtout **son code de connexion**, sans lequel il n'existe plus pour la plateforme |
| **Prospect** (source 3) | Personne non inscrite, sollicitée une fois, nominativement, avec un motif écrit et un lien de désinscription |
| **Système — file d'envoi** | Consomme `leads.outbox_events`, appelle Brevo, réessaie, journalise, alerte (**D18**) |
| **Système — récepteur d'événements** | Reçoit les retours Brevo, les authentifie faute de signature, les dédoublonne, met à jour les états |
| **Brevo** (externe) | Base de contacts, segments, modèles marketing, acheminement transactionnel, retours de livraison, de rebond, de plainte et de désinscription. **Sur la désinscription, Brevo fait foi** (`05` RG90) |
| **`expert-marketing`** | Définit les segments, les scénarios, la cadence souhaitée et le contenu. **Il ne décide pas des garde-fous** |
| **`expert-conformite-rgpd`** | **Veto** sur les bases légales, la saisie libre (**D35**), le suivi nominatif des ouvertures, la conservation |

> **Deux populations, deux discours.** Un envoi ne mélange jamais annonceurs et créateurs dans un
> même modèle : ni le vocabulaire, ni la promesse, ni le lien d'arrivée ne sont les mêmes
> (`CLAUDE.md` §5.2). Un segment mixte est un segment mal construit, et l'écran le signale.

---

## User stories

### Commercial (`agent`)

- **US1** — En tant que **commercial**, je veux écrire à un segment de contacts de la plateforme
  depuis le backoffice, afin de relancer une population entière sans ouvrir une deuxième interface
  et sans recopier des adresses à la main.
- **US2** — En tant que **commercial**, je veux voir, **avant** de confirmer, combien de personnes
  vont recevoir l'e-mail et combien sont écartées et pourquoi, afin de ne pas découvrir après coup
  que j'ai écrit à douze personnes ou à douze mille.
- **US3** — En tant que **commercial**, je veux un aperçu réel du message dans les deux langues,
  afin de ne pas envoyer une variable non remplacée à mille personnes.
- **US4** — En tant que **commercial**, je veux pouvoir **annuler** dans les minutes qui suivent,
  afin qu'une erreur repérée aussitôt reste sans conséquence.
- **US5** — En tant que **commercial**, je veux écrire à un prospect précis que je viens
  d'identifier, afin de faire mon métier — mais je veux que l'outil m'empêche d'en faire une
  campagne déguisée.
- **US6** — En tant que **commercial**, je veux savoir ce qu'un envoi a donné — délivré, ouvert,
  cliqué, rebondi, désinscrit — afin de savoir si je recommence ou si j'arrête.
- **US7** — En tant que **commercial**, je veux être empêché d'écrire à quelqu'un qui vient déjà de
  recevoir deux de nos e-mails, afin de ne pas brûler une base qu'il faudra des mois à reconstituer.

### Administrateur (`admin`)

- **US8** — En tant qu'**administrateur**, je veux valider les modèles avant qu'ils soient
  envoyables, afin qu'aucun texte non relu ne parte à toute une base.
- **US9** — En tant qu'**administrateur**, je veux modifier les plafonds et la cadence **sans
  redéploiement**, afin d'appliquer immédiatement une décision du juriste (**D35**).
- **US10** — En tant qu'**administrateur**, je veux **tout arrêter en un geste**, afin de couper le
  robinet quand un incident de réputation commence — sans jamais couper le code de connexion.
- **US11** — En tant qu'**administrateur**, je veux voir la consommation de nos quotas Brevo, afin
  de comprendre pourquoi un envoi traîne avant qu'un commercial ne s'en plaigne.
- **US12** — En tant qu'**administrateur**, je veux la liste nominative de chaque envoi de saisie
  libre — qui a écrit, à qui, pourquoi — afin de pouvoir répondre à une réclamation en une minute.

### Membre et prospect

- **US13** — En tant que **membre**, je veux recevoir mon code de connexion en quelques secondes,
  quoi qu'il arrive par ailleurs, afin de pouvoir entrer dans mon compte.
- **US14** — En tant que **membre**, je veux me désinscrire en un clic depuis n'importe quel e-mail
  commercial et que cela soit vrai partout et tout de suite, afin de ne pas avoir à le redemander.
- **US15** — En tant que **membre**, je veux que le retrait de mon consentement **ne coupe jamais**
  les e-mails de service, afin de ne pas me retrouver enfermé dehors (`05` RG35).
- **US16** — En tant que **prospect**, je veux savoir en lisant l'e-mail qui m'écrit, pourquoi, et
  comment ne plus être sollicité, afin de ne pas avoir à signaler le message comme indésirable.

### Système

- **US17** — En tant que **système**, je veux que l'échec d'un e-mail n'annule jamais l'action
  métier qui l'a déclenché, afin qu'une panne de Brevo ne supprime pas une mise en relation.
- **US18** — En tant que **système**, je veux qu'un rejeu ne renvoie jamais un e-mail déjà envoyé,
  afin qu'un incident d'exploitation ne devienne pas un incident de réputation.
- **US19** — En tant que **système**, je veux refuser de démarrer si je détecte une configuration
  d'envoi réel hors production, afin qu'un e-mail ne parte jamais d'un environnement de test.

---

## Règles de gestion

### A — Portée, vocabulaire et principes

**RG1** — **Ce document ne redéfinit rien de ce que `05`, `12`, `13` et `15` ont déjà tranché.** Il
les **complète** sur un seul sujet : l'e-mail. Toute règle d'ici qui contredirait l'un de ces
documents est une erreur **de ce document**, à corriger ici. En cas d'écart avec `04` (modèle de
données) ou `15` (backoffice), l'écart est **signalé** en §Impacts et **non corrigé unilatéralement**.

**RG2 — Trois natures d'e-mail, et une seule question pour les distinguer** : *cet e-mail
exécute-t-il le service que la personne a demandé, ou cherche-t-il à lui vendre quelque chose ?*

| Nature | Définition | Consentement marketing requis | Lien de désinscription | Compte dans la cadence |
|---|---|---|---|---|
| **Transactionnel** | Exécute la relation : code de connexion, décision, preuve, notification | **Non** — il relève de l'exécution du service | **Non** (une phrase explique pourquoi la personne le reçoit) | **Non** |
| **Marketing** | S'adresse à un contact **consenti** ou à un segment Brevo : nurturing, relance, annonce | **Oui**, relu à l'envoi | **Oui, obligatoire** | **Oui** |
| **Prospection** | S'adresse à une personne **non inscrite**, choisie par un agent | Sans objet : **aucune base légale acquise** | **Oui, obligatoire** | **Oui** |

**RG3** — **Un e-mail ne change jamais de nature en cours de route.** Un transactionnel ne porte
aucun contenu promotionnel, et un marketing ne se déguise jamais en notification de service pour
échapper au consentement. C'est un manquement, pas une astuce (`brevo-campaign`, règles non
négociables).

**RG4** — **Une seule source de destinataires par envoi**, choisie parmi les trois de A4 :
`platform_contacts`, `brevo_segment`, `manual_entry`. Mélanger un segment consenti et une adresse
prospectée rendrait la base légale de l'envoi indémontrable. Le choix est fait à la première étape
et **n'est plus modifiable** ensuite : changer de source recommence l'envoi à zéro.

**RG5** — **Un envoi est un objet** (`backoffice.email_sends`), pas une action fugitive. Il porte sa
source, sa base légale, son auteur nommé, son modèle, sa langue, son volume, ses écartés, son état,
sa fenêtre d'annulation, ses confirmations et ses résultats. **Rien ne part vers Brevo sans qu'un
envoi existe d'abord en base d'INFLUX.**

**RG6** — **États d'un envoi**, liste fermée, transitions contrôlées en base :

```
  draft ──► pending_confirmation ──► scheduled ──► sending ──► sent
    │               │                    │            │         └──► partially_sent
    │               │                    │            └──────────────► failed
    └───────────────┴────────────────────┴──► cancelled   (annulation, interrupteur, expiration)
                                         └──► blocked     (écart de volume, quota, incident)
```

Aucune transition « disparaître » : un envoi quitte toujours son état par une transition nommée,
journalisée, avec son auteur (`15` RG27 C7).

**RG7** — **La base est la source de vérité, sauf sur la désinscription**, où **Brevo fait foi**
(`05` RG90, `CLAUDE.md` §8). Si Brevo dit qu'une personne s'est désinscrite et qu'INFLUX pense le
contraire, INFLUX a tort et se corrige.

**RG8** — **Aucune clé Brevo ne quitte le serveur.** Ni `apps/web`, ni `apps/backoffice` ne
détiennent de clé, ne parlent à Brevo, ni ne reçoivent d'identifiant exploitable directement. Tout
passe par `apps/api` (`02`, règle d'architecture 1 ; skill `env-secrets`).

**RG9 — Trois flux, trois sous-domaines d'envoi, sans exception.** C'est la règle la plus
structurante du document :

| Flux | Sous-domaine | Ce qu'il porte | Pourquoi il est isolé |
|---|---|---|---|
| **Transactionnel** | `tx.<domaine>` *(proposition)* | Code de connexion, décisions, preuves, notifications | **Sa réputation est la disponibilité du produit** (**D37**). Aucune campagne, jamais |
| **Marketing** | `news.<domaine>` | Sources 1 et 2 | Une plainte marketing est probable ; elle ne doit coûter que du marketing |
| **Prospection** | `pro.<domaine>` | Source 3 uniquement | C'est le flux le plus exposé au signalement. Il brûle en premier, **et il brûle seul** |

Corollaire souvent manqué : **c'est l'expéditeur et le sous-domaine qui déterminent le flux, pas le
point d'accès technique utilisé.** Un envoi de prospection emprunte le point d'accès d'envoi
unitaire — le même que le code de connexion — et ce n'est **pas** pour autant un transactionnel.
Les trois sous-domaines sont authentifiés séparément (SPF, DKIM, DMARC) **avant le premier envoi**
(`00` prérequis 7, avec `integrateur`).

**RG10** — **Toute valeur de plafond, de cadence, de seuil et de liste vit en configuration**, en
base, modifiable par `admin` sans redéploiement, **et chaque modification est journalisée** (qui,
quand, ancienne et nouvelle valeur) — sur le modèle éprouvé de `leads.sync_settings` (`04` §5.8).
**Aucune valeur de ce document n'est écrite en dur dans le code.** Les valeurs citées ici sont des
**valeurs d'attente**, délibérément conservatrices, et elles sont marquées comme telles.

**RG11** — **Tout est bilingue, dans la langue du contact**, jamais dans celle de l'agent. Un
modèle n'est envoyable que si ses deux versions, française et anglaise, existent et sont validées
(RG66). La langue retenue pour un destinataire est **sa langue de communication déclarée** (`05`
RG15) ; à défaut, l'anglais.

**RG12** — **Toute action d'envoi est attribuée à une personne nommée** (`15` RG1). Il n'existe
aucun envoi « du système » déclenché depuis le backoffice : les envois automatiques sont
transactionnels et relèvent du §H ; les envois du backoffice ont toujours un auteur.

**RG13** — **Aucun écran de ce périmètre n'affiche ni ne permet d'extraire une liste nominative de
destinataires** — ni à l'aperçu, ni dans les résultats, ni en export (`03` C(17), `15` RG92 et
RG93). L'agent voit des **compteurs par motif**, jamais des adresses en liste. Pour comprendre un
cas précis, il ouvre la fiche du compte concerné, et cette consultation est journalisée. **La seule
exception est la source 3**, nominative par construction puisqu'elle ne vise qu'une personne.

**RG14** — **Aucun montant, aucun taux, aucune commission, aucun net créateur** dans un e-mail, un
modèle, un objet ou un écran de ce périmètre (**A1**, `15` RG4). Un modèle qui en contiendrait un
est refusé à la validation.

---

### B — Le parcours d'envoi de masse, écran par écran

> Sept écrans. Le parcours est volontairement long : c'est la seule action du backoffice qui touche
> des milliers de personnes d'un seul geste, et **la friction y est une fonctionnalité**, pas un
> défaut d'ergonomie. Elle est concentrée là où elle protège — la confirmation — et absente
> partout ailleurs.

**RG15 — Écran 1 : « Mes envois ».** Point d'entrée unique, liste de tous les envois (les siens et
ceux des collègues), avec par ligne : date, auteur, **source**, base légale, modèle, langue,
volume, écartés, état, résultats agrégés. Tri par date décroissante. Filtres : source, auteur,
état, période, modèle. Un bouton « Nouvel envoi ». **Un envoi en cours de fenêtre d'annulation est
en tête de liste, avec son compte à rebours**, et il l'est pour tout le monde, pas seulement pour
son auteur (RG28).

**RG16 — Écran 2 : la source.** Trois choix exclusifs, chacun accompagné en toutes lettres de sa
base légale, de son volume possible et de son plafond restant pour la journée :

| Choix | Ce que l'écran affiche | Suite du parcours |
|---|---|---|
| **Contacts de la plateforme** | « Consentement marketing recueilli à l'inscription, **revérifié au moment de l'envoi** » | Écrans 3 à 7 |
| **Segment Brevo** | « Consentement géré dans Brevo. **Brevo fait foi.** INFLUX ne lit pas les destinataires » | Écrans 3 à 7, avec les limites du §D |
| **Adresse saisie (une seule)** | « **Aucune base légale acquise : c'est de la prospection.** Envoi unitaire, plafonné, journalisé nominativement » | Parcours distinct du §E |

Le choix est **définitif pour cet envoi** (RG4). Si la saisie libre est indisponible — plafond
atteint, environnement non productif, aucun pays validé pour la prospection — l'option est
**désactivée avec son motif écrit**, jamais simplement absente : une option qui disparaît laisse
croire à un bogue.

**RG17 — Écran 3 : le périmètre.** Selon la source :

- **Contacts de la plateforme** : composition d'un segment à partir d'une **liste fermée de
  facettes** définie par `expert-marketing` — rôle, pays, langue, statut déclaré, complétude du
  profil, étape de funnel, badge, période d'inscription, activité récente. **Aucune requête libre,
  aucun champ texte**, aucune saisie d'identifiant de compte. Un segment est nommé et peut être
  enregistré pour être réutilisé ; **il est toujours réévalué à l'envoi, jamais figé** (RG34).
- **Segment Brevo** : liste des segments **lue en direct chez Brevo au moment de l'affichage**, et
  restreinte aux segments **déclarés autorisés** (RG41). Chaque ligne indique son nom, son
  identifiant, la date de sa dernière modification chez Brevo et **si elle porte la condition
  d'exclusion de cadence** (RG42). Un segment sans cette condition n'est pas sélectionnable.

**RG18** — **Un segment mixte est signalé.** Si le périmètre contient à la fois des annonceurs et
des créateurs, l'écran affiche un avertissement écrit : deux populations, deux discours
(`CLAUDE.md` §5.2). Ce n'est pas bloquant — un message strictement neutre existe — mais cela doit
être un choix conscient, et ce choix est journalisé.

**RG19 — Écran 4 : le modèle et la langue.** L'agent choisit un modèle **validé** (§F) de nature
`marketing`. L'écran affiche sa version, sa date de validation et son validateur. **Aucun modèle en
brouillon, retiré, ou modifié depuis sa validation, n'est sélectionnable** (RG69, RG70). Si le périmètre
comporte les deux langues, **les deux versions sont utilisées** — jamais une seule traduite à la
volée, jamais un repli silencieux sur l'anglais pour un contact francophone.

**RG20 — L'aperçu est obligatoire, réel, et dans toutes les langues du périmètre.** Aucun envoi ne
peut être confirmé sans que l'aperçu ait été **affiché** — pas seulement disponible. Il est **rendu
par le moteur réel**, avec des valeurs d'exemple explicitement marquées comme telles, et il montre
l'objet, l'expéditeur, le pied de page, les mentions légales et **le lien de désinscription**.

**RG21** — **Une variable non résolue bloque l'envoi.** Si une variable du modèle n'a pas de valeur
pour au moins un destinataire du périmètre, l'envoi est refusé avec le nom de la variable et le
nombre de destinataires concernés. Un « Bonjour , » parti à trois mille personnes ne se rattrape
pas. Un champ absent n'est envoyé vide que s'il porte une **valeur de repli déclarée** dans le
modèle ; sinon c'est un blocage.

**RG22 — Écran 5 : le volume et les écartés.** Le volume est **calculé au moment de l'affichage de
cet écran**, jamais à la constitution du segment, et l'écran porte l'heure exacte du calcul. Les
écartés sont détaillés **par motif**, en compteurs :

| Motif d'écartement | Nature | Sources concernées |
|---|---|---|
| Sans consentement marketing | **Cas normal** | 1 |
| Consentement retiré depuis | **Cas normal** | 1 |
| Désinscrit (retour Brevo) | **Cas normal** | 1 |
| Plainte pour spam enregistrée | **Cas normal**, définitif | 1, 3 |
| Rebond dur ou adresse injoignable | **Cas normal** | 1, 3 |
| En liste de suppression | **Cas normal** | 1, 3 |
| Hors cadence (RG76) | **Cas normal** | 1, 3 |
| Compte suspendu | **Cas normal** | 1 |
| Compte supprimé ou anonymisé | **Cas normal** | 1 |
| Pays exclu par configuration | **Cas normal** | 1, 3 |
| Langue non couverte par le modèle | **Blocage** — on corrige le modèle, on n'écarte pas des gens | 1 |

**RG23** — **Un écartement n'est jamais une erreur.** Les compteurs d'écartés et les compteurs
d'échecs sont **visuellement distincts et jamais additionnés** (`05` RG100). Un écran qui présente
une règle comme une panne perd sa crédibilité en trois jours, et avec elle son usage.

**RG24** — **Chaque écartement est journalisé** avec son motif, rattaché à l'envoi, **sans que la
liste nominative soit affichée ni exportable** (RG13). Les compteurs suffisent à décider ; le détail
sert au diagnostic, compte par compte, depuis la fiche.

**RG25** — **Un plancher et un plafond de volume, tous deux en configuration.** En dessous du
plancher (**valeur d'attente : 2 destinataires**), l'envoi reste possible mais l'écran suggère la
fiche du compte : écrire à une personne depuis l'outil de masse est presque toujours une erreur de
parcours. Au-dessus du plafond du rôle (`backoffice.email_send_limits`, **D35**), l'envoi est
**refusé**, avec le plafond, la consommation du jour, et le rôle qui pourrait le faire.

**RG26 — Écran 6 : la double confirmation.** **Deux gestes de nature différente**, jamais deux clics
au même endroit (`brevo-campaign`, mécanique d'envoi, point 4) :

1. **Une case à cocher explicite** reprenant en toutes lettres : la source, sa base légale, le nom
   du périmètre, le volume exact, le modèle, les langues, **et la phrase « cet envoi sera
   irréversible passé le délai d'annulation de 5 minutes »** (`15` RG86 M3, réversibilité annoncée).
2. **La ressaisie au clavier du volume exact** (en chiffres) **ou** du nom du segment. Le champ
   n'accepte ni le collage, ni l'auto-complétion.

S'y ajoutent, conformément à `15` M3 : une **re-authentification TOTP fraîche**, et, tant qu'une
seule personne cumule `agent` et `admin`, la **procédure dégradée** PD1 à PD7 de `03` §1.3 —
récapitulatif intégral, confirmation différée d'au moins 60 secondes sur un écran distinct, marquage
`dual_control: 'degraded_single_operator'`, revue hebdomadaire. **L'écran dit en toutes lettres que
ce contrôle est affaibli** (`15` RG9).

**RG27** — **La confirmation est nominative et horodatée** : `confirmed_by_account_id` et
`confirmed_at`. Le confirmateur peut être l'auteur en mode dégradé ; il doit être **une autre
personne** dès qu'un second `admin` actif existe, et la bascule est automatique (`15` RG9).

**RG28 — Écran 7 : la fenêtre d'annulation de 5 minutes.** L'envoi passe en `scheduled`,
`cancel_window_ends_at` est posé, et **rien n'est transmis à Brevo pendant cette fenêtre** — c'est
ce qui rend l'annulation réelle plutôt que cosmétique. Pendant ces cinq minutes :

- un **bandeau permanent** du backoffice affiche le compte à rebours et un bouton « Annuler cet
  envoi », atteignable depuis **n'importe quel écran**, pas seulement depuis l'envoi ;
- le compte à rebours est annoncé aux lecteurs d'écran et **ne dépend pas de l'onglet resté
  ouvert** : fermer le navigateur n'annule rien et n'empêche pas d'annuler depuis un autre poste ;
- **n'importe quel `agent` ou `admin` peut annuler**, pas seulement l'auteur. Un incident se
  constate parfois par-dessus l'épaule du voisin ;
- l'annulation est **sans effet et sans trace chez Brevo**, et **journalisée chez nous** avec son
  auteur et un motif de liste fermée : `erreur_de_perimetre`, `erreur_de_modele`, `mauvais_moment`,
  `incident`, `other` avec commentaire obligatoire.

**RG29** — **La durée de la fenêtre est un paramètre**, valeur d'attente **5 minutes**, jamais
inférieure à 2 minutes ni supérieure à 30 : trop courte, elle ne sert à rien ; trop longue, elle
retarde les envois légitimes et l'on prend l'habitude de la contourner.

**RG30** — **À l'expiration de la fenêtre, le périmètre est recalculé une seconde fois.** Cinq
minutes suffisent à ce que quelqu'un se désinscrive. Les destinataires devenus inéligibles sont
écartés — sans nouvelle question à l'agent, mais **avec leur motif au journal**.

**RG31 — L'écart de volume est un garde-fou, pas un détail.** Si le volume recalculé s'écarte du
volume confirmé de plus d'un seuil — **valeur d'attente : 10 % ou 50 destinataires, le plus petit
des deux** — l'envoi **ne part pas** : il passe en `blocked`, une alerte est levée (**AL47**,
§Impacts) et **une nouvelle confirmation est exigée**. Un écart de cette ampleur en cinq minutes
signifie que le périmètre n'était pas celui qu'on croyait.

**RG32 — L'envoi lui-même.** Le passage en `sending` met une ligne en file par destinataire
(source 1) ou déclenche la campagne Brevo (source 2). La file respecte les limites de débit du §M,
avec temporisation exponentielle plafonnée. **L'écran ne ment jamais sur l'avancement** : il affiche
« transmis à Brevo », pas « reçu par les destinataires » — ce sont deux faits distincts, et seul le
premier nous appartient.

**RG33 — Échec partiel : ce qui est parti reste parti.** Un envoi dont une partie des destinataires
échoue passe en `partially_sent`, jamais en `failed`. Le compte rendu donne le nombre transmis et le
nombre en échec **par cause** ; le rejeu ne porte que sur les échecs, **avec la même clé
d'idempotence** : personne ne reçoit deux fois (`15` RG88, `05` RG102).

---

### C — Source 1 : les contacts de la plateforme

**RG34 — Base légale : le consentement**, recueilli à l'inscription par une case **non pré-cochée**,
séparée de l'acceptation des CGU, avec sa date, sa source et le **libellé exact** présenté
(`05` RG30 à RG33). Aucun autre fondement n'est invoqué pour cette source.

**RG35 — Le consentement est relu en base au moment de l'envoi**, jamais à la constitution du
segment (`05` RG37, `brevo-campaign`). C'est la règle qui justifie à elle seule que le volume soit
recalculé deux fois (RG22, RG30) : entre le moment où un agent compose un segment le mardi et le
moment où il l'envoie le jeudi, des gens ont changé d'avis, et ils ont le droit.

**RG36 — Les neuf contrôles obligatoires avant qu'un contact de la plateforme reçoive un e-mail**,
tous évalués **au moment de l'envoi**, dans cet ordre :

| # | Contrôle | Si négatif |
|---|---|---|
| 1 | Consentement marketing accordé, valeur courante en base | Écarté, motif `sans_consentement` |
| 2 | Aucune désinscription revenue de Brevo (`unsubscribed_at` vide) | Écarté, motif `desinscrit` |
| 3 | Aucune plainte pour spam enregistrée | Écarté, motif `plainte`, **définitif** (`05` RG93) |
| 4 | Aucun rebond dur, adresse non marquée injoignable | Écarté, motif `injoignable` |
| 5 | Adresse absente de la liste de suppression | Écarté, motif `liste_de_suppression` |
| 6 | Cadence respectée (§G) | Écarté, motif `cadence` |
| 7 | Compte ni suspendu, ni supprimé, ni anonymisé | Écarté, motif correspondant |
| 8 | Pays du contact hors liste d'exclusion de configuration | Écarté, motif `pays_exclu` |
| 9 | Langue du contact couverte par le modèle | **Blocage de l'envoi entier**, pas un écartement |

**RG37** — **`consent_checked_at` est obligatoire sur chaque destinataire de cette source**
(`04` §5.10). Une ligne de destinataire sans cette date est un défaut bloquant : c'est elle qui
prouve, six mois plus tard, que le consentement a été vérifié *ce jour-là* et pas *un jour*.

**RG38 — Ce qui est journalisé** : l'envoi (source, base légale, auteur, confirmateur, modèle,
version, langues, périmètre nommé, volume, écartés par motif, horodatages de calcul, de
confirmation, de fin de fenêtre et de transmission) et, **par destinataire**, l'identifiant de
compte, `consent_checked_at`, l'état, le motif d'écartement le cas échéant, et le `messageId`
renvoyé par Brevo. **Ni le corps rendu, ni l'objet personnalisé ne sont conservés** : la référence
du modèle et sa version suffisent à savoir ce qui a été envoyé, et elles ne dupliquent pas une
donnée personnelle.

**RG39 — Désinscription : effet immédiat et propagation prioritaire.** Un clic sur le lien de
désinscription d'un e-mail de cette source vaut **retrait du consentement** : il écrit un
`identity.consent_events` (`granted = false`, source `brevo_webhook` ou `unsubscribe_link`), pose
`unsubscribed_at` sur `leads.contact_sync_states`, et déclenche un `consent.revoked` **prioritaire
sur toute la file** (`05` RG78, RG89, RG92). Objectif de prise en charge : **moins de 5 minutes**.

**RG40 — Rebond.** Un **rebond dur** marque l'adresse injoignable et — depuis **D37** — ouvre une
entrée dans la file `email_delivery_incidents` (`05` RG61) : une adresse injoignable n'est plus une
gêne marketing, **c'est un compte inaccessible**. Un **rebond mou** n'écarte rien au premier
constat ; **trois rebonds mous sur 30 jours glissants** valent rebond dur (valeur d'attente, en
configuration).

---

### D — Source 2 : un segment Brevo

> Cette source est la plus simple à utiliser et la plus difficile à contrôler. INFLUX y délègue à
> Brevo la définition du périmètre **et** la vérification du consentement. Il faut l'assumer par
> écrit plutôt que de faire semblant de maîtriser.

**RG41 — Base légale : le consentement, côté Brevo. Brevo fait foi.** INFLUX ne revérifie pas
contact par contact, **parce qu'il ne peut pas** : il ne lit pas les destinataires du segment.

**RG42 — Un segment n'est envoyable que s'il figure dans la liste fermée des segments autorisés**,
tenue dans une table de référence d'INFLUX et alimentée par `expert-marketing` avec l'accord
d'`expert-conformite-rgpd`. Chaque entrée porte : identifiant Brevo, nom, population visée, base
légale documentée, **condition d'exclusion de cadence présente (oui / non)**, date de déclaration et
déclarant. **Sans cette liste, n'importe quel segment improvisé chez Brevo deviendrait envoyable en
deux clics depuis le backoffice** — c'est exactement le trou que A4 cherchait à fermer.

**RG43** — **Le segment est lu au moment de l'envoi, jamais figé à l'avance**, et son volume est
celui **annoncé par Brevo**, horodaté, affiché avec la mention explicite : « chiffre annoncé par
Brevo, non vérifié par INFLUX ».

**RG44 — Aucun destinataire d'un segment Brevo n'entre dans la base INFLUX**, ni adresse, ni
personne, ni compteur individuel. INFLUX conserve, pour l'envoi : l'identifiant du segment, son nom,
le volume annoncé et son horodatage, le modèle et le résultat agrégé. **Rien d'autre.** Recopier un
segment reviendrait à constituer une seconde base de contacts, avec sa propre obligation
d'information et son propre risque.

**RG45 — Une liste d'exclusion INFLUX est jointe à *tout* envoi de cette source.** Elle est
maintenue par INFLUX chez Brevo et contient les personnes qui ne doivent recevoir aucun envoi
marketing, quelle qu'en soit l'origine : désinscrits, plaintes, adresses injoignables, comptes
supprimés, adresses ayant fait l'objet d'une prospection en source 3. **Un envoi de source 2 sans
cette liste d'exclusion est un défaut bloquant** : c'est la seule protection d'INFLUX sur un
périmètre qu'il ne lit pas.

**RG46 — La cadence est portée côté Brevo**, par une condition d'exclusion écrite **dans la
définition du segment**, appuyée sur deux attributs de contact **tenus à jour par INFLUX** :
`LAST_MARKETING_SENT_AT` et `MARKETING_SENDS_30D` (§M4). Il revient à `expert-marketing` d'inclure
cette condition dans **chaque** définition de segment, et à RG42 de vérifier qu'elle y est.

**RG47 — Limite structurelle, assumée et affichée.** Les contacts **présents dans Brevo mais
inconnus d'INFLUX** — importés, créés à la main, hérités d'une opération antérieure — ne sont
couverts **ni** par la vérification de consentement d'INFLUX, **ni** par ses compteurs de cadence :
seule la condition d'exclusion du segment les protège, et elle ne peut rien si leurs attributs n'ont
jamais été renseignés. **L'écran de confirmation le dit en une phrase, à chaque envoi de cette
source.** Une limite écrite est une limite acceptée ; une limite tue devient un incident.

**RG48 — Mécanique.** Une **campagne Brevo** est créée par l'interface de programmation avec le
segment visé, la liste d'exclusion de RG45, l'expéditeur du flux marketing (RG9) et le modèle ; puis
elle est déclenchée immédiatement. **Aucun envoi unitaire en boucle** sur un segment : ce serait
plusieurs milliers d'appels là où un seul suffit, et la limite de débit la plus basse de Brevo
s'applique précisément à ce point d'accès (§M2).

**RG49** — **`backoffice.email_send_recipients` reste vide pour cette source**, par construction
(RG44). Les résultats sont **agrégés**, lus chez Brevo, et rattachés à l'envoi. C'est un **écart
avec `04`**, signalé en §Impacts : le modèle suppose aujourd'hui une ligne par destinataire.

**RG50 — Désinscription et rebond** suivent exactement le même chemin qu'en source 1 (RG39, RG40) :
le retour de Brevo est traité, et si la personne est connue d'INFLUX, son consentement est retiré en
base. Si elle est inconnue, **l'adresse est ajoutée à la liste d'exclusion** et rien d'autre n'est
créé — surtout pas un contact.

---

### E — Source 3 : la saisie libre, unitaire

> **C'est le point du document où le risque juridique est le plus élevé et le volume le plus
> faible.** Tout y est calibré pour que la prospection reste un geste commercial individuel,
> réfléchi et traçable — et ne puisse jamais devenir une campagne déguisée.
>
> **D35 est ouverte.** Les plafonds, la définition d'« adresse professionnelle » et le rôle habilité
> relèvent d'`expert-conformite-rgpd` (**veto**) et du fondateur. Toutes les valeurs ci-dessous sont
> des **valeurs d'attente conservatrices, lues en configuration**, jamais figées dans le code.

**RG51 — Base légale : aucune n'est acquise.** C'est de la prospection, et elle s'apprécie **pays
par pays** — intérêt légitime encadré dans l'UE pour une adresse professionnelle, consentement
préalable exigé dans plusieurs régimes, CASL au Canada, règles propres aux États américains. **La
liste des pays où la prospection est validée est celle de `05` RG84, et elle est vide par défaut.**
Conséquence directe et assumée : **tant qu'aucun pays n'y figure, la saisie libre est inutilisable**,
et l'écran l'explique. Une absence de liste produit une abstention, jamais un envoi par défaut.

**RG52 — Le formulaire, champ par champ.** Sept champs, tous obligatoires :

| Champ | Contrôle | Pourquoi |
|---|---|---|
| **Adresse** | **Une seule.** Refus si la saisie contient une virgule, un point-virgule, un espace, un retour à la ligne, ou plus d'un `@`. Aucun collage de liste, aucun import, aucun fichier | C'est le seul contrôle qui empêche vraiment la campagne déguisée |
| **Pays du destinataire** | Liste ISO 3166-1, doit figurer dans les pays validés (RG51) | C'est le pays qui détermine la légalité, pas le nôtre |
| **Organisation** | Texte, 120 caractères | Dit à qui l'agent croit écrire, et sert à la réclamation |
| **Langue** | Français ou anglais | L'e-mail part dans la langue du destinataire |
| **Modèle** | Un modèle validé de nature `prospecting` uniquement | Aucun texte libre, jamais (RG58) |
| **Motif** | **Liste fermée** (`salon`, `recommandation`, `demande_entrante_hors_plateforme`, `campagne_a_pourvoir`, `other`) **plus** un texte libre d'au moins 20 caractères | C'est ce qui distingue un rapprochement réfléchi d'un envoi de masse (`01` §4.3, même logique que la proposition INFLUX) |
| **Attestation** | Case non pré-cochée : « adresse professionnelle, obtenue licitement, personne concernée par notre activité » | Engage nominativement l'agent, et c'est le but |

**RG53 — Définition proposée d'« adresse professionnelle »** — à valider par
`expert-conformite-rgpd` (**D35**) :

> Une adresse rattachée à un **domaine d'organisation** dont l'agent connaît l'activité, et
> correspondant soit à **une personne dans l'exercice de ses fonctions**, soit à une **boîte
> fonctionnelle** (`contact@`, `hello@`, `partenariats@`).

**Sont exclues, et refusées automatiquement :**

1. toute adresse sur un **domaine de messagerie grand public** — liste fermée en configuration
   (`gmail`, `googlemail`, `outlook`, `hotmail`, `live`, `msn`, `yahoo`, `icloud`, `me`, `proton`,
   `protonmail`, `gmx`, `orange`, `wanadoo`, `free`, `sfr`, `laposte`, `bbox`, `numericable`, et
   les variantes nationales) ;
2. toute adresse d'un **créateur particulier**, même professionnelle d'apparence : la prospection
   d'un particulier ne se fait pas par ce canal ;
3. toute adresse **obtenue par extraction automatisée**, achat de fichier, ou copie d'un annuaire —
   y compris de notre propre annuaire (`03` C(17)) ;
4. toute adresse **devinée** (`prenom.nom@domaine` reconstitué) : l'agent doit pouvoir dire d'où
   elle vient, et le motif le lui demande.

**RG54 — Plafonds, valeurs d'attente conservatrices** (`backoffice.email_send_limits`, **D35**) :

| Plafond | `agent` | `admin` | Commentaire |
|---|---|---|---|
| Adresses par envoi | **1** | **1** | Non paramétrable : c'est la définition même de la source |
| Envois de prospection par jour ouvré | **10** | **20** | Assez pour travailler, trop peu pour une campagne |
| Envois de prospection par mois glissant | **50** | **100** | Empêche le contournement par accumulation quotidienne |
| Envois par organisation (domaine) sur 90 jours | **3** | **3** | Trois personnes d'une même entreprise, pas tout l'organigramme |
| Sollicitations par adresse | **1, définitivement** | **1** | **Aucune relance au MVP** (RG55) |

**RG55 — Une adresse n'est sollicitée qu'une fois, et jamais relancée.** La relance de prospection
est **hors périmètre du MVP** : elle double le risque juridique pour un gain commercial marginal, et
elle relève de D35. Une seconde tentative sur la même adresse est **refusée**, avec la date et
l'auteur de la première.

**RG56 — Refus si l'adresse est déjà connue comme membre.** Un compte INFLUX existe sur cette
adresse — actif, suspendu, supprimé ou anonymisé ? La saisie libre est **refusée** avec le message :
« cette adresse correspond à un compte INFLUX ; passez par les contacts de la plateforme, où son
consentement est vérifié ». Deux précisions : cette recherche d'adresse exacte est **journalisée**
(`05` RG98), et ce contrôle n'est pas un oracle d'énumération puisqu'il n'est offert qu'à un rôle
interne authentifié par second facteur.

**RG57 — Autres refus automatiques** : adresse en liste de suppression, désinscrite, ayant déjà
donné lieu à une plainte, marquée injoignable, ou dont le domaine est bloqué par configuration.
Chaque refus affiche son motif en clair et **est journalisé** — un refus répété sur un même domaine
est un signal.

**RG58 — Aucun texte libre dans le corps de l'e-mail.** L'agent choisit un modèle validé et
renseigne, au plus, les variables déclarées par ce modèle (organisation, campagne visée, langue).
Son **motif n'apparaît jamais dans l'e-mail** : il est interne. Autoriser un corps libre ferait
partir, tôt ou tard, un texte que personne n'a relu à une personne qui n'a rien demandé.

**RG59 — Mentions obligatoires dans tout e-mail de prospection**, contrôlées à la validation du
modèle : identité complète d'INFLUX et coordonnées postales, **origine de la prise de contact** en
une phrase, objet de la sollicitation, **lien de désinscription en un clic**, et mention du droit
d'opposition. Un modèle de nature `prospecting` sans ces cinq éléments n'est pas validable.

**RG60 — L'adresse part en liste de suppression, jamais dans la base de contacts.** Immédiatement
après l'envoi : ajout à la liste d'exclusion de RG45 et à la liste de suppression transactionnelle.
**Aucun contact n'est créé chez Brevo, aucun compte n'est créé dans INFLUX, aucune liste marketing
n'est alimentée.** Si la personne s'inscrit plus tard d'elle-même, elle entrera par la porte
normale, avec son propre consentement.

**RG61 — Journalisation nominative, complète et conservée.** Pour chaque envoi de cette source :
**qui** (agent nommé), **à quelle adresse**, **quel pays déclaré**, **quelle organisation**, **quel
motif** (code et texte), **quel modèle et quelle version**, **quelle langue**, **quand**, **quel
`messageId`**, et la suite (délivré, ouvert, rebond, plainte, désinscription). Conservation
proposée : **3 ans**, pour pouvoir répondre à une réclamation ou à une autorité. Durée à confirmer
par `expert-conformite-rgpd` (§Questions ouvertes).

**RG62 — Ouverture et clic sont nominatifs pour cette source, par construction**, puisqu'il n'y a
qu'un destinataire. C'est assumé et écrit ici plutôt que découvert : l'information est utile au
commercial, elle est journalisée, et elle n'est **jamais** rapprochée d'un compte membre.

**RG63 — Le risque de réputation est porté par cette source, et il est contenu.** Une plainte pour
spam sur une prospection abîme la réputation du domaine d'envoi ; si ce domaine était celui du code
de connexion, **des membres ne pourraient plus se connecter** (**D37**). D'où trois protections
cumulées : le sous-domaine dédié `pro.` (RG9), la suspension automatique décrite en RG123, et le
plafond par domaine de RG54. **La prospection brûle son propre sous-domaine, et lui seul.**

**RG64 — La saisie libre est désactivée hors production, sans exception** (`brevo-campaign`,
garde-fou d'environnement ; §J, RG119). Pas de mode redirigé, pas de mode démonstration : l'option est
absente et l'écran dit pourquoi.

---

### F — La bibliothèque de modèles

**RG65 — Tout e-mail part d'un modèle enregistré.** Il n'existe **aucun envoi improvisé**, d'aucune
source, d'aucune nature. Chaque modèle porte : une référence stable (`template_ref`), un nom, une
**nature** (`transactional` · `marketing` · `prospecting`), une version, ses deux textes (français
et anglais), sa liste de variables déclarées, son expéditeur, son **statut** (`draft` · `validated`
· `retired`), son validateur, sa date de validation et l'empreinte de son contenu validé.

**RG66 — Parité française / anglaise obligatoire.** Un modèle dont une des deux langues manque
**n'est pas validable**, et donc pas envoyable. C'est la transposition, pour les e-mails, de la
règle de parité des clés de traduction vérifiée à la compilation (**D28**).

**RG67 — Où vit le texte, et pourquoi ce n'est pas au même endroit selon la nature** :

| Nature | Le texte vit… | Motif |
|---|---|---|
| **Transactionnel** | **Dans les fichiers de traduction d'INFLUX**, versionnés dans le dépôt. Brevo n'assure que le **transport** | `04` R8 l'impose déjà pour les e-mails de mise en relation. Ce sont des textes de produit, relus en revue de code, et qui doivent rester lisibles hors de Brevo |
| **Marketing** et **prospection** | **Dans les modèles Brevo**, référencés par INFLUX | C'est là que `expert-marketing` travaille. Exiger un déploiement pour changer une accroche tuerait l'usage |

**RG68 — Qui écrit, qui valide.** `expert-marketing` écrit et propose les modèles marketing et de
prospection ; `expert-conformite-rgpd` contrôle les mentions obligatoires (RG59, RG73) ; en
exploitation, **seul un `admin` bascule un modèle en `validated`**, avec `2V` et motif. Les modèles
transactionnels suivent le cycle du code : relecture, test, déploiement.

**RG69 — L'empreinte du contenu validé est revérifiée avant chaque envoi.** Un modèle hébergé chez
Brevo peut être modifié chez Brevo sans qu'INFLUX en sache rien — c'est la faiblesse de RG67. Donc :
au moment de la validation, INFLUX enregistre l'empreinte du contenu récupéré chez Brevo ; **avant
chaque envoi, il la recalcule**. En cas d'écart, l'envoi est **refusé**, le modèle repasse en
`draft`, et l'alerte **AL46** part à l'administrateur. On ne discute pas d'un texte qu'on n'a pas
relu.

**RG70 — Un modèle `draft`, `retired` ou en écart d'empreinte n'est pas sélectionnable**, et l'écran
dit lequel des trois cas s'applique. Un modèle retiré reste consultable : les envois passés le
référencent et doivent rester lisibles.

**RG71 — Liste fermée des variables autorisées**, par nature. Toute variable absente de cette liste
est refusée à la validation :

| Variable | Disponible pour | Valeur si absente |
|---|---|---|
| `organisation` | marketing, prospection | **Blocage** (RG21) sauf repli déclaré |
| `langue`, `pays` | toutes | Jamais absentes |
| `lien_espace_membre` | transactionnel, marketing | Jamais absente |
| `lien_desinscription` | marketing, prospection | **Obligatoire** (RG73) |
| `reference_mise_en_relation` | transactionnel | — |
| `nom_commercial_influx` | transactionnel | — |
| `titre_campagne` | transactionnel, marketing | Repli déclaré obligatoire |
| `date_heure_avec_fuseau` | transactionnel | Jamais sans fuseau (`13` RG78) |

**Aucune variable ne porte le nom d'une personne physique, un pseudonyme, un identifiant de réseau
social, un montant, ni l'identité d'une contrepartie non révélée** (§L).

**RG72 — Contrôles automatisés à la validation**, tous bloquants :

1. un modèle `marketing` ou `prospecting` **sans** lien de désinscription est refusé ;
2. un modèle `transactional` **avec** un lien de désinscription marketing est refusé — on ne se
   désabonne pas de son code de connexion, et le proposer induit gravement en erreur ;
3. un modèle `transactional` contenant un **bloc promotionnel** déclaré est refusé (le contrôle
   porte sur les blocs typés, pas sur une devinette sémantique) ;
4. un modèle contenant un **montant, un taux ou le mot « commission » suivi d'un pourcentage** est
   refusé (**A1**, RG14) ;
5. un modèle **sans version dans les deux langues** est refusé (RG66) ;
6. un modèle de prospection sans les cinq mentions de RG59 est refusé ;
7. un modèle dont une variable n'est pas dans la liste de RG71 est refusé.

**RG73 — Le lien de désinscription est unique, en un clic, et il agit immédiatement.** Un clic
suffit : pas de formulaire, pas de connexion demandée, pas de « confirmez votre choix ». L'effet est
celui de RG39 : retrait du consentement, propagation prioritaire, et une page qui confirme ce qui
vient de se passer, **dans la langue du contact**, avec un rappel que **les e-mails de service
continuent**.

**RG74 — Règles sur l'objet de l'e-mail** : il ne contient **jamais** le code de connexion
(`05` RG49), jamais l'identité d'une contrepartie non révélée, jamais un montant, jamais une
majuscule intégrale ni une ponctuation d'insistance. Pour un e-mail de mise en relation, il porte la
référence `MER-…` (`13` RG78).

**RG75 — Un envoi référence une version figée de modèle.** Modifier un modèle après un envoi ne
réécrit jamais ce qui a été envoyé : l'envoi conserve la référence **et le numéro de version**, et
c'est ce couple qui permet, un an plus tard, de dire ce qu'une personne a réellement reçu.

---

### G — La cadence maximale par contact

**RG76 — Aucun contact ne reçoit plus de N e-mails marketing par période glissante, toutes sources
confondues.** C'est une règle de plateforme, **non négociable au cas par cas** : c'est exactement
ainsi qu'on brûle une base, un envoi « exceptionnel » après l'autre.

**RG77 — Valeurs de départ proposées**, en configuration, à confirmer par `expert-marketing` et
`expert-conformite-rgpd` (rattachées à **D35**) :

| Règle | Valeur d'attente |
|---|---|
| E-mails marketing par contact, 7 jours glissants | **2** |
| E-mails marketing par contact, 30 jours glissants | **6** |
| Délai minimal entre deux e-mails marketing au même contact | **48 h** |

**RG78 — « Toutes sources confondues » se prend au pied de la lettre** : un contact touché par un
segment Brevo lundi puis par un segment INFLUX mercredi a bien reçu deux e-mails. Les trois sources
partagent **le même compteur** et **le même journal d'envoi**.

**RG79 — Les e-mails transactionnels ne comptent pas** — ils exécutent le service. En contrepartie
stricte : ils ne servent **jamais** de véhicule promotionnel pour contourner la cadence (RG3, RG72).
Détourner un transactionnel pour glisser une offre est un manquement, pas une optimisation.

**RG80 — Deux compteurs par contact, tenus par INFLUX et poussés vers Brevo** :
`LAST_MARKETING_SENT_AT` et `MARKETING_SENDS_30D`. Ils sont mis à jour à chaque transmission
réussie, quelle que soit la source, et synchronisés vers les attributs de contact Brevo par la file
habituelle. **Ils n'ont pas d'emplacement dans `04` aujourd'hui** : écart signalé en §Impacts.

**RG81 — Un contact hors cadence est écarté automatiquement, et c'est un cas normal.** L'agent voit
le compteur « hors cadence » et son motif ; l'écartement est journalisé ; **il n'apparaît jamais
dans les échecs** (RG23). Il n'existe **aucun bouton « envoyer quand même »**.

**RG82 — Sur un segment Brevo, la cadence est portée côté Brevo** (RG46), avec la limite assumée de
RG47. C'est le seul endroit du dispositif où INFLUX délègue une règle qu'il ne peut pas vérifier, et
il le dit à chaque envoi.

**RG83 — Les scénarios de nurturing automatiques comptent dans la cadence.** Un scénario Brevo qui
envoie sans passer par le backoffice reste un e-mail marketing reçu par la personne. Chaque
scénario intègre donc la même condition d'exclusion (RG46), et `expert-marketing` en est
responsable au même titre que pour les segments. **Un dispositif de cadence qui ignore les
scénarios ne mesure rien.**

**RG84 — Modifier la cadence est une décision d'administrateur, jamais une dérogation d'envoi.**
Le changement se fait en configuration, avec motif, journalisé, et il vaut pour tout le monde. On
ne relève pas un plafond pour un envoi.

---

### H — Les e-mails transactionnels

> **Ce sont eux qui font tourner le produit.** Le marketing peut attendre une heure ; un code de
> connexion, non. Cette section les recense **tous**, parce qu'un catalogue incomplet produit
> exactement le même résultat qu'un catalogue absent : des e-mails écrits dans un coin, sans
> idempotence, sans langue, sans journal.

**RG85 — Le catalogue est exhaustif et fermé.** Un e-mail transactionnel qui n'y figure pas
n'existe pas : il ne doit pas être écrit, et un contrôle automatisé vérifie que tout appel d'envoi
porte un code de ce tableau. C'est la transposition, pour les e-mails, de la règle du catalogue des
files (`15` RG26), qui a déjà évité onze files orphelines.

| Code | E-mail | Déclencheur | Destinataire | Priorité | Clé d'idempotence | Source |
|---|---|---|---|---|---|---|
| `auth.login_code` | **Code à 6 chiffres** | Demande de code | Le demandeur | **P0** | identifiant de la **demande de code** | `05` RG49 |
| `auth.new_device` | Connexion depuis un navigateur inconnu | Vérification réussie sur appareil inconnu | Le membre | P1 | compte + empreinte d'appareil + jour | `05` RG55 |
| `auth.email_change_confirm_old` | Confirmation depuis l'ancienne adresse | Demande de changement d'adresse | Ancienne adresse | P1 | identifiant de la demande + côté | `05` RG58 |
| `auth.email_change_confirm_new` | Confirmation depuis la nouvelle adresse | Idem | Nouvelle adresse | P1 | identifiant de la demande + côté | `05` RG58 |
| `auth.email_changed_notice` | Changement effectif | Les deux confirmations reçues | Les deux adresses | P1 | identifiant de la demande + côté | `05` RG58 |
| `account.welcome_advertiser` | Bienvenue annonceur | Compte créé | Le membre | P1 | **compte** (sans identifiant d'événement) | `05` RG86, RG76 |
| `account.welcome_creator` | Bienvenue créateur | Compte créé | Le membre | P1 | **compte** | `05` RG86 |
| `account.suspended` | Compte suspendu, avec le message du motif typé | Suspension | Le membre | P1 | identifiant de suspension | `15` §E |
| `account.reactivated` | Compte réactivé | Levée de suspension | Le membre | P1 | identifiant de suspension | `15` §E |
| `profile.decision` | Profil validé ou refusé, avec le message du motif | Décision de la file `profiles_*` | Le membre | P1 | identifiant de décision | `06`, `07` |
| `portfolio.decision` | Visuel refusé, avec motif | Modération d'un visuel | Le créateur | P2 | identifiant de décision | `07` RG97 |
| `badge.granted` | Badge attribué, avec son niveau et **sa date de péremption** | Décision | Le créateur | P1 | identifiant de décision | `08` |
| `badge.refused` | Badge refusé, avec le motif | Décision | Le créateur | P1 | identifiant de décision | `08` |
| `badge.expiring` | Badge à rafraîchir | **J-15** | Le créateur | P2 | badge + étape (J-15) | `08` RG70, AL14 |
| `badge.expired` | Badge périmé | J+0 (90 jours) | Le créateur | P2 | badge + étape (J+0) | `08` RG70 |
| `badge.withdrawn` | Badge retiré, avec le motif | Retrait | Le créateur | P1 | identifiant de décision | `08` |
| `badge.dispute_outcome` | Issue d'une contestation | Décision de réexamen | Le créateur | P1 | identifiant de contestation | `08` RG77 |
| `campaign.decision` | Campagne validée ou refusée, avec le motif | Décision de la file `campaigns` | La marque | P1 | identifiant de décision | `09` |
| `intro.acknowledgement` | Accusé d'une demande de contact ou d'une candidature | Dépôt | L'initiateur | P2 | mise en relation + destinataire | `13` RG111 |
| `intro.invitation` | Invitation à accepter une mise en relation | Validation, ou proposition INFLUX | Chaque partie | P1 | mise en relation + destinataire + `invitation` | `13` RG111, `04` |
| `intro.reminder` | Relance d'acceptation | **J+3**, puis **J+6** | La partie silencieuse | P2 | mise en relation + destinataire + **étape** (3 ou 6) | `13`, AL6 |
| **`intro.reveal_confirmation`** | **Confirmation de mise en relation — la preuve** | Révélation d'identité | **Chaque partie, un e-mail chacune** | **P1, sans raccourci** | mise en relation + destinataire + `reveal_confirmation`, **unicité en base** | `13` RG78, `01` M2 |
| `intro.decline_neutral` | Une partie n'a pas donné suite — message neutre | Refus par une partie | L'autre partie | P1 | mise en relation + destinataire | `13` RG88 |
| `intro.expiry_neutral` | Clôture sans suite — message neutre | Expiration | Les deux parties | P2 | mise en relation + destinataire | `13` |
| `intro.rejection_motivated` | Refus par INFLUX, avec le motif typé | Décision de la file | L'initiateur | P1 | identifiant de décision | `13` RG111 |
| `intro.agent_instruction` | Consigne d'entrer dans le fil | Révélation | Le commercial responsable | P2 | mise en relation + agent | `13` RG81 |
| `msg.new_message` | **Nouveau message — sans le texte** | Premier message non lu d'un fil | Le membre destinataire | P2 | fil + cycle de non-lecture | `12` RG90 à RG94 |
| `msg.reminder_24h` | Rappel unique de messages non lus | 24 h sans ouverture | Le membre | P2 | fil + cycle + `24h` | `12` RG93 |
| `msg.agent_digest` | Récapitulatif quotidien des fils | Chaque jour ouvré | Le commercial | P2 | agent + jour | `12` RG95 |
| `msg.autoreply` | Réponse automatique à qui répond à l'adresse sans réponse | Réponse entrante | L'expéditeur | P2 | adresse + fenêtre de 24 h | `12` RG96 |
| `report.acknowledgement` | Signalement reçu | Dépôt d'un signalement | Le signalant | P2 | identifiant de signalement | `12` RG82 |
| `report.outcome` | Suite donnée au signalement | Décision | Le signalant | P2 | identifiant de décision | `12` |
| `data.request_ack` | Demande relative aux données reçue, avec son échéance | Dépôt | Le demandeur | P1 | identifiant de demande | `15` §G |
| `data.export_ready` | Export prêt — **lien de courte durée, à usage unique, jamais de pièce jointe** | Export produit | Le demandeur | P1 | identifiant de demande | `15` RG95 |
| `data.request_done` | Demande exécutée, avec ce qui a été fait et ce qui a été conservé | Clôture | Le demandeur | P1 | identifiant de demande | `15` §G, `04` §9.2 |
| `internal.invitation` | Invitation d'un compte interne — lien à usage unique, 72 h | Création par un `admin` | La personne invitée | P1 | identifiant d'invitation | `15` RG99 |
| `internal.mfa_reset` | Second facteur réinitialisé | Réinitialisation | L'intéressé **et tous les `admin`** | P1 | identifiant de réinitialisation + destinataire | `15` RG102 |
| `internal.critical_alert` | Alerte critique : connexion au compte de secours, rupture de chaîne | AL33, AL34, AL36 | Fondateur et `admin` | **P0** | identifiant d'alerte + destinataire | `15` §F |

**RG86 — Trois priorités, et elles ne sont pas décoratives** :

| Priorité | Contenu | Traitement |
|---|---|---|
| **P0** | Code de connexion, alertes critiques internes | **Chemin dédié**, jamais mis dans une file partagée avec les synchronisations de contacts (`05` RG59). Tentative immédiate, échec visible **à l'écran** |
| **P1** | Preuves, décisions, confirmations | File d'événements, **devant** P2, rejeu selon le calendrier de `05` RG79 |
| **P2** | Notifications et récapitulatifs | File d'événements, tolérance au retard |

**RG87 — Le code de connexion a un régime à part, et il faut le dire.** Il ne passe pas par la file
partagée, il ne dépend d'aucun consentement, il n'est **jamais** suspendu par l'interrupteur
d'urgence (RG122), il part du sous-domaine transactionnel et de lui seul, et **son échec s'affiche
immédiatement à la personne** avec la cause distinguée (`05` RG60) — adresse non délivrable,
service indisponible, plafond atteint. Ici, il n'y a **aucune action métier à préserver** : l'échec
d'envoi *est* l'échec de l'action.

**RG88 — Les transactionnels ne dépendent jamais du consentement marketing**, et le retrait du
consentement ne les affecte pas (`05` RG35). Réciproquement, aucun contenu promotionnel ne s'y
invite (RG3, RG72).

**RG89 — Idempotence : une clé stable par e-mail, et deux familles de clés.**

1. **E-mails « une fois par nature »** — bienvenue, confirmation de révélation, invitation :
   la clé **n'inclut pas** l'identifiant de l'événement déclencheur. Un rejeu du pipeline, un
   incident, une reprise manuelle : **l'e-mail ne repart pas** (`05` RG76).
2. **E-mails « une fois par occurrence »** — code de connexion, nouveau message, relance : la clé
   inclut l'identifiant de l'occurrence (la demande de code, le cycle de non-lecture, l'étape de
   relance). Deux demandes de code produisent bien deux e-mails, et c'est voulu.

**RG90 — Double ceinture sur l'idempotence** : une **contrainte d'unicité en base d'INFLUX** (par
exemple l'index unique de `matching.introduction_emails` sur mise en relation + destinataire pour
`reveal_confirmation`, `04` §5.6) **et** l'en-tête **`Idempotency-Key`** transmis à Brevo (§M3). La
contrainte locale est celle sur laquelle on compte ; l'en-tête est un filet dont ni la fenêtre de
validité ni le comportement exact ne nous appartiennent. **Ne jamais s'en remettre au seul
fournisseur pour une garantie qu'on peut tenir soi-même.**

**RG91 — Un destinataire par message.** Jamais deux adresses dans un même envoi, jamais de copie,
jamais de copie cachée. Les deux parties d'une mise en relation reçoivent **deux e-mails distincts**
(`brevo-campaign`, e-mails de mise en relation), dans leur langue respective. Une copie visible
révélerait une adresse à un tiers ; une copie cachée rendrait la preuve individuelle inexploitable.

**RG92 — Un échec d'envoi n'annule jamais l'action métier.** La révélation est enregistrée, le
message est enregistré, le badge est attribué, la décision est prise : **l'e-mail est une
conséquence, jamais une condition** (`13` RG80, `12` RG98). Le seul cas où l'échec d'envoi arrête
tout est P0, parce qu'il n'y a rien d'autre à préserver (RG87).

**RG93 — Tout échec est rejoué selon le calendrier du pipeline** (`05` RG79 : immédiat, 1 min,
5 min, 15 min, 1 h, 3 h, 6 h, 12 h, 24 h, 24 h — dix tentatives), puis passe en **échec définitif**,
visible et rejouable au backoffice. **Un échec définitif sur `intro.reveal_confirmation` lève
l'alerte AL10** : une mise en relation sans e-mail confirmé est une mise en relation **sans preuve
externe**, et le commercial doit le savoir pour rattraper à la main (`13` RG80).

**RG94 — Le `messageId` renvoyé par Brevo est conservé pour tout e-mail transactionnel**, pas
seulement pour ceux de mise en relation. Pour ces derniers, il vit dans
`matching.introduction_emails.provider_message_id` (`04` §5.6, unique). Pour les autres, **il
n'existe aucun emplacement dans `04`** : écart signalé en §Impacts, avec une proposition de journal
d'envoi transactionnel.

**RG95 — L'e-mail de confirmation de mise en relation n'admet aucun raccourci.** Contenu exact,
interdits et vocabulaire : `13` RG78. Ce document n'y ajoute qu'une chose, opérationnelle : il part
**après** la révélation, **dans la même unité de traitement** que l'écriture de
`identity_revealed_at` — c'est-à-dire mis en file dans la transaction, jamais envoyé avant elle.
Un e-mail parti avant une révélation qui échoue serait une preuve de quelque chose qui n'a pas eu
lieu.

**RG96 — Les notifications de messagerie ne contiennent jamais le texte d'un message** (`12` RG90),
respectent la cadence propre à la messagerie (`12` RG93 : un immédiat, un rappel à 24 h, **deux au
maximum par cycle de non-lecture**), et **cette cadence est indépendante de celle du §G** : ce sont
des transactionnels.

**RG97 — Aucune adresse de réponse fonctionnelle** (`12` RG96). Les transactionnels partent d'une
adresse qui n'accepte pas de réponse ; une réponse déclenche une **réponse automatique unique** qui
renvoie vers le fil, et cette réponse automatique est elle-même plafonnée à une par adresse et par
24 heures.

**RG98 — Quatre indicateurs de délivrabilité du code de connexion, mesurés dès le premier jour**
(`05` RG63), plus deux ajouts que je tiens pour nécessaires :

| Indicateur | Seuil d'alerte | Origine |
|---|---|---|
| Délai médian entre demande et délivrance | **> 60 secondes** | `05` RG63, D37 |
| Demandes sans connexion aboutie dans les 10 minutes | **> 15 %** | `05` RG63, D37 |
| Taux de rebond dur | > 2 % *(valeur d'attente)* | `05` RG63 |
| Taux de plainte | > 0,1 % *(valeur d'attente)* | `05` RG63 |
| **Délai du 9ᵉ cas sur 10** (p90) | **> 180 secondes** *(ajout)* | La médiane masque la queue : c'est la queue qui empêche les gens d'entrer |
| **Part des envois confirmés « délivrés » par Brevo** | **< 97 %** *(ajout)* | « Transmis » n'est pas « délivré » (RG32). Sans cet indicateur, on croit envoyer |

**RG99 — Le dépassement d'un de ces seuils est un incident d'exploitation, pas un sujet
marketing** : alerte immédiate à `admin`, et il figure au bloc 7 du tableau de bord `admin`
(`15` RG21).

**RG100 — Aucun e-mail transactionnel ne pousse à sortir de la plateforme** (`13` RG112) : pas de
proposition d'écrire directement à l'autre partie, pas de coordonnée, pas de domaine cliquable
appartenant à un membre, aucune pièce jointe — **aucune, jamais, sous aucune forme**.

**RG101 — La langue est celle du destinataire**, pas celle de l'agent qui a déclenché l'action, et
elle est **enregistrée avec l'envoi** : la langue dans laquelle une preuve a été envoyée fait
partie de la preuve (`04` §5.6, colonne `locale`).

**RG102 — Un e-mail transactionnel ne porte jamais de lien de désinscription marketing** (RG72,
point 2), mais il porte **toujours une phrase expliquant pourquoi la personne le reçoit** et un
lien vers ses préférences de communication.

**RG103 — Les e-mails internes (`internal.*`) ne partent que vers des adresses de comptes
internes**, jamais vers une adresse de membre, et ils suivent les mêmes règles d'idempotence et de
journalisation. Une alerte critique qui n'arrive pas est une alerte qui n'existe pas : `P0`.

**RG104 — Tout e-mail transactionnel est journalisé** : code, destinataire (identifiant de compte,
**jamais l'adresse recopiée** — elle se lit sous RLS), langue, modèle et version, horodatages,
statut, `messageId`, cause d'échec. Conservation : **3 ans** pour les e-mails rattachés à une mise
en relation (`04` §9.1), à confirmer pour les autres (§Questions ouvertes).

---

### I — Ce qui remonte de Brevo, et sous quelle forme

**RG105 — Les douze événements attendus de Brevo**, vérifiés sur la documentation officielle le
2026-09-19 — `sent`, `delivered`, `opened`, `clicked`, `soft_bounce`, `hard_bounce`,
`invalid_email`, `deferred`, `spam`, `unsubscribed`, `blocked`, `error` — plus les événements de
contact (ajout à une liste, mise à jour, suppression). **Tout événement inconnu est accepté,
journalisé et ignoré**, jamais rejeté : une évolution de Brevo ne doit pas faire tomber notre
récepteur.

**RG106 — Trois familles d'événements, trois traitements**, et c'est la distinction la plus utile
de cette section :

| Famille | Événements | Traitement | Pourquoi |
|---|---|---|---|
| **Qui retire un droit** | `unsubscribed`, `spam`, `hard_bounce`, `invalid_email`, `blocked` | **Appliqué immédiatement, tel quel**, sans revérification | Le pire qu'un faux événement puisse faire est d'arrêter d'écrire à quelqu'un. C'est conservateur : on l'accepte |
| **Qui crée une preuve** | `delivered` sur un `intro.reveal_confirmation` | **Revérifié par un appel sortant** à Brevo avant d'être inscrit au registre | Un webhook non signé (RG146) ne doit jamais, à lui seul, fabriquer une preuve |
| **Qui informe** | `sent`, `opened`, `clicked`, `soft_bounce`, `deferred`, `error` | Agrégé, sans conséquence automatique | Utile à la mesure, sans effet sur les droits |

**RG107 — Agrégat par défaut, nominatif par exception.** Pour les sources 1 et 2, **les ouvertures
et les clics ne sont conservés qu'en agrégat par envoi**, jamais rattachés nominativement à une
personne. C'est une décision assumée : le suivi individuel du comportement de lecture n'apporte rien
au MVP, il alourdirait l'information à donner aux personnes, et il crée une donnée que personne ne
saura justifier le jour où on la demande. **À faire valider par `expert-conformite-rgpd`** — si le
marketing démontre plus tard un besoin réel, ce sera une décision explicite, pas une dérive.

**RG108 — Le nominatif est conservé uniquement pour les événements à conséquence** —
désinscription, plainte, rebond dur, adresse invalide, blocage — parce qu'ils **modifient l'état du
contact** et qu'INFLUX doit pouvoir dire pourquoi il n'écrit plus à quelqu'un.

**RG109 — Exception écrite : la source 3 est nominative par construction** (RG62). Un seul
destinataire, donc toute statistique le désigne. C'est assumé, journalisé, et utile au commercial.

**RG110 — Ce qu'affiche l'écran de résultats d'un envoi** : transmis, délivrés, **taux de
délivrance**, ouvertures, clics, rebonds durs, rebonds mous, plaintes, désinscriptions, échecs par
cause. Chaque chiffre porte **l'heure de sa dernière actualisation** : les événements arrivent en
continu, et un chiffre sans horodatage se lit comme définitif alors qu'il ne l'est pas.

**RG111 — Aucun résultat d'envoi n'est visible par un membre**, ni sur son profil, ni pour une
contrepartie, ni dans un export qui lui serait remis. Ce sont des données internes (`15` RG70).

**RG112 — Conservation** : agrégats par envoi **3 ans** ; événements nominatifs à conséquence selon
`04` §9.1 (les preuves de consentement sont à 5 ans) ; journal d'envoi **3 ans** ; **le corps rendu
d'un e-mail n'est jamais conservé** — on garde la référence du modèle et sa version (RG75), ce qui
suffit à savoir ce qui a été envoyé sans dupliquer une donnée personnelle.

**RG113 — Le rapprochement quotidien existe aussi pour les envois**, sur le modèle de `05` RG91 :
une fois par jour, INFLUX récupère chez Brevo les désinscriptions et plaintes des **48 dernières
heures** et rattrape celles dont le retour immédiat s'est perdu. **L'écart constaté est un
indicateur de santé**, visible au backoffice (AL27).

**RG114 — Un événement d'ouverture ou de clic n'est jamais interprété comme un consentement.**
Ouvrir un e-mail de prospection ne vaut ni accord, ni intérêt légitime, ni autorisation de relance
(et de toute façon la relance n'existe pas, RG55).

---

### J — Le garde-fou d'environnement et l'interrupteur d'urgence

> **Un e-mail réellement envoyé depuis `staging` est un incident**, et A4 a aggravé le risque :
> le backoffice peut désormais déclencher des envois de masse. Ce qui suit n'est pas une
> précaution, c'est une barrière.

**RG115 — Clés distinctes par environnement.** La clé de production **n'existe nulle part ailleurs
qu'en production** : ni dans un fichier local, ni dans `staging`, ni dans une variable de
compilation, ni dans un journal, ni dans un ticket (skill `env-secrets`). Rotation planifiée, deux
clés acceptées pendant la fenêtre de rotation.

**RG116 — Un réglage d'envoi à trois valeurs, contrôlé au démarrage** :

| Valeur | Comportement | Où |
|---|---|---|
| `disabled` | **Valeur par défaut.** Aucun appel sortant. Les envois sont simulés, journalisés, et l'écran le dit | Partout sauf production |
| `redirect` | Tout destinataire est remplacé par une adresse de la **liste fermée d'adresses internes**, l'objet est préfixé par l'environnement et l'adresse d'origine | `staging`, sur décision explicite |
| `live` | Envoi réel | **Production uniquement** |

**Le service refuse de démarrer** si la valeur est `live` hors production, ou si elle est `live`
sans que les trois sous-domaines de RG9 soient authentifiés. **Un refus de démarrage, pas un
avertissement** : un avertissement se lit une fois puis s'ignore.

**RG117 — En mode `redirect`, aucun destinataire réel n'est jamais atteint**, y compris par erreur
de segment : la substitution se fait **au dernier moment**, juste avant l'appel sortant, et elle
est journalisée avec l'adresse d'origine. La liste des adresses internes autorisées est fermée et
tenue en configuration.

**RG118 — Bandeau d'environnement permanent** dans tout backoffice non productif, avec le nom de
l'environnement, la valeur du réglage d'envoi, et un libellé écrit — jamais une simple couleur
(`15` RG119).

**RG119 — La saisie libre est purement et simplement absente hors production** (RG64). Ni
désactivée-mais-visible, ni redirigée : absente, avec une phrase qui explique pourquoi.

**RG120 — Aucune donnée de production dans un autre environnement** (`03` §6.8, `15` interdit 20) :
les adresses de `staging` sont **synthétiques**. Le mode `redirect` est une seconde ceinture, pas
la première. **Tout envoi réel constaté depuis un environnement de test se déclare comme
incident** : coupure de la clé, recensement des destinataires atteints, information des personnes
si nécessaire, consignation écrite et revue en réunion de sécurité.

**RG121 — L'interrupteur d'urgence a deux niveaux**, actionnables par un `admin` **en un geste**,
depuis le tableau de bord, sans redéploiement, avec motif obligatoire :

| Niveau | Ce qui s'arrête | Ce qui continue |
|---|---|---|
| **`marketing_paused`** | Sources 1, 2 et 3 ; scénarios de nurturing ; envois programmés en fenêtre d'annulation, **annulés** | **Tous les transactionnels** |
| **`all_paused`** | Tout ce qui précède, **plus** les transactionnels P1 et P2, mis en attente (et non perdus) | **P0 uniquement : le code de connexion et les alertes critiques internes** |

**RG122 — Le code de connexion n'est jamais coupé par l'interrupteur.** C'est une règle, pas une
option de configuration : couper P0 reviendrait à fermer la plateforme à tous ses membres pour
régler un problème de réputation. Si P0 lui-même est en cause, c'est un incident d'un autre ordre,
qui se traite par l'expéditeur de secours (§Questions ouvertes).

**RG123 — Déclenchement automatique de `marketing_paused`**, sur trois conditions, valeurs d'attente
en configuration :

1. **taux de plainte > 0,3 %** sur 24 heures glissantes, toutes sources marketing confondues ;
2. **taux de rebond dur > 5 %** sur un envoi, ou > 2 % sur 24 heures ;
3. **clé d'accès refusée** par Brevo (`401`/`403`) — car on ne sait alors plus ce qui part.

**L'automatisme suspend, il ne reprend jamais seul.**

**RG124 — La reprise est humaine, motivée, journalisée, et alertée.** Un `admin` lève
l'interrupteur avec un motif typé et un commentaire ; tous les `admin` et le fondateur sont
notifiés (`internal.critical_alert`) ; un **bandeau permanent** signale l'état suspendu tant qu'il
dure ; et l'épisode est repris à la revue hebdomadaire du bloc 8 (`15` RG22). Les envois annulés
par l'interrupteur **ne repartent jamais automatiquement** : ils sont refaits à la main, avec une
nouvelle confirmation.

---

### K — La supervision

**RG125 — Un écran « Envois d'e-mails » dans le backoffice**, distinct de la supervision des leads
de `05` : liste des envois (RG15), détail d'un envoi, résultats, écartés par motif, journal des
confirmations et des annulations.

**RG126 — Un écran « File d'envoi »** : lignes en attente, en cours, en échec temporaire, en échec
définitif, avec **la cause en clair** issue d'une table de correspondance — jamais une trace
technique brute (`05` RG99). Le tableau des causes de `05` RG99 est réutilisé tel quel et **étendu**
de cinq entrées :

| Cause affichée | Nature | Action attendue |
|---|---|---|
| Échec — modèle modifié chez Brevo depuis sa validation | Blocage | Revalider le modèle (RG69) |
| Échec — écart de volume au-delà du seuil | Blocage | Reconfirmer l'envoi (RG31) |
| Bloqué — envoi suspendu par l'interrupteur d'urgence | Blocage | Lever l'interrupteur, puis refaire l'envoi |
| Échec — quota Brevo dépassé | Temporaire | Attendre, ou revoir le palier |
| Annulé — dans la fenêtre de 5 minutes | **Cas normal** | Aucune |

**RG127 — Une nouvelle file au catalogue de `15` RG29 : `email_send_failures`.** Elle n'existe pas
aujourd'hui, et une file absente du catalogue est une file orpheline (`15` RG26). Proposition :
délai de décision **2 jours ouvrés**, aucun verrou (comme `lead_sync_failures`), traitée par `agent`
et `admin`, **action de masse autorisée : rejeu en lot, plafond 200**. Écart signalé en §Impacts.

**RG128 — Les quotas Brevo sont affichés, pas devinés.** Consommation courante et limite du palier
pour les trois catégories du §M2, avec alerte à **80 %**. Le point à surveiller n'est pas celui
qu'on croit : ce n'est ni l'envoi transactionnel ni les contacts, c'est la catégorie « autres
points d'accès », **la plus basse**, qui porte la création de campagne (RG48).

**RG129 — Rejeu unitaire sur chaque ligne en échec**, et **rejeu en lot plafonné à 200 lignes**
(`15` M1, `05` RG101). Le rejeu **conserve la clé d'idempotence** : aucun doublon, **aucun e-mail
déjà envoyé n'est renvoyé** (`05` RG102, `15` RG91). Le compte rendu donne : remis en file, ignorés
et pourquoi, refusés.

**RG130 — Une ligne « écartée » n'est pas rejouable** (`05` RG103). Un contact sans consentement,
hors cadence ou désinscrit ne se rejoue pas : si sa situation change, c'est un **nouvel envoi** qui
le touchera, pas la résurrection d'un ancien.

**RG131 — Sept nouvelles alertes**, à ajouter au catalogue de `15` §F (codes proposés, à confirmer
par `product-owner`) :

| Code | Alerte | Seuil de départ | Nature | Destinataire | Action |
|---|---|---|---|---|---|
| **AL42** | Taux de plainte au-delà du seuil | 0,3 % / 24 h | Événement | `admin` + fondateur | Interrupteur déclenché : instruire |
| **AL43** | Taux de rebond dur au-delà du seuil | 5 % sur un envoi | Événement | `admin` | Nettoyer, vérifier la source |
| **AL44** | Quota Brevo proche ou atteint | 80 % d'une catégorie | État | `admin` | Étaler, ou revoir le palier |
| **AL45** | Interrupteur d'urgence actif | Dès l'activation | État | Tous + fondateur | Lever quand la cause est traitée |
| **AL46** | Modèle modifié chez Brevo depuis sa validation | Écart d'empreinte | Événement | `admin` | Relire et revalider |
| **AL47** | Envoi bloqué par écart de volume | 10 % ou 50 destinataires | Événement | L'auteur + `admin` | Reconfirmer ou abandonner |
| **AL48** | Délivrabilité du code de connexion hors seuil | Seuils de RG98 | État | `admin`, **immédiatement** | **Incident : des gens ne peuvent pas se connecter** |

**RG132 — Aucune alerte ne part vers Brevo ni vers Apollo** (`15` RG70), y compris agrégée.

**RG133 — Les envois figurent au bloc 7 du tableau de bord `admin`** (`15` RG21) : envois de la
semaine par source et par base légale, volumes, écartés, plaintes, désinscriptions, et
**consommation des plafonds de saisie libre par agent** — c'est ce dernier chiffre qui révèle une
dérive avant qu'elle ne devienne une campagne.

**RG134 — L'export lié aux envois est limité à E4** (`15` RG93) : indicateurs **agrégés**, sans
aucune ligne nominative. **Il n'existe aucun export de destinataires**, aucune exception, pour
aucun rôle. La seule donnée nominative extractible du périmètre est le journal de la saisie libre,
qui ne sort que par E3 (extrait du registre d'audit, `admin`, re-authentification et motif).

---

### L — Ce qui ne doit jamais partir dans un e-mail

**RG135 — Liste fermée des interdits.** Chaque ligne est un **défaut bloquant** si elle est
possible. Chacune paraîtra un jour être une bonne idée à quelqu'un de bien intentionné :

| # | Ne part jamais | Pourquoi |
|---|---|---|
| 1 | **Le texte d'un message de conversation** | Permettrait de répondre par e-mail, donc de sortir du fil supervisé ; duplique une négociation chez un tiers ; fausse les accusés de lecture (`12` RG90) |
| 2 | **Une coordonnée directe d'un membre à un autre** | C'est le vecteur de contournement principal, dans les deux sens (`13` RG78, **D40**) |
| 3 | **L'identité d'une contrepartie avant la révélation** | L'anonymisation est une séparation en base ; un e-mail la contournerait en une ligne (**A2**) |
| 4 | **Un montant, un taux, une commission, un net créateur** | **A1** : rien de tout cela n'existe dans l'application au MVP |
| 5 | **Un code de connexion** vers un tiers, un journal, un export ou un webhook | Un code lisible ailleurs, c'est un compte pris (`05` RG52) |
| 6 | **Une note interne, un motif de suspension, un motif interne de refus** | Internes. Seul part le **message associé au motif**, écrit pour le membre (`15` RG7) |
| 7 | **Une pièce de vérification, un visuel non modéré** | Stockage privé, lecture journalisée, jamais en e-mail (`04` §5.11) |
| 8 | **Un attribut Brevo nommant la contrepartie d'une mise en relation** | Ce serait recréer chez un tiers l'annuaire qu'on protège (`13` RG114) |
| 9 | **Un état d'affaire, une alerte, un indicateur interne** | Données internes (`15` RG70) |
| 10 | **Le contenu d'un signalement** ou l'identité du signalant | Exposerait la personne qui a signalé (`12` §G) |
| 11 | **Plusieurs destinataires dans un même message**, en copie ou copie cachée | Révèle des adresses entre elles et rend la preuve individuelle inexploitable (RG91) |
| 12 | **Une pièce jointe, quelle qu'elle soit** | Vecteur de contournement (un PDF avec un numéro) et surface de sécurité inutile (`00` §6.2) |
| 13 | **Un lien de désinscription dans un e-mail de service** | Laisse croire qu'on peut se désabonner de son code de connexion (RG72) |
| 14 | **Un contenu promotionnel dans un transactionnel** | Contournement du consentement : un manquement (RG3) |
| 15 | **Le vocabulaire de la preuve** — « preuve légale », « horodatage certifié », « valeur probante » | Notre registre est auto-produit ; ces termes sont interdits partout (`01` M4, `12` RG105) |
| 16 | **Une donnée enrichie par Apollo** | Elle n'est pas réimportée, donc elle n'existe pas chez nous (`05` RG85) |
| 17 | **Une liste, un extrait ou un export de l'annuaire** | Interdit à tous les rôles, administrateurs compris (`03` C(17)) |

**RG136 — Ces interdits sont vérifiés par des tests automatisés**, pas par la vigilance. Une
interdiction sans mécanisme n'est qu'un vœu (`15` RG109). Les mécanismes attendus : contrôle à la
validation du modèle (RG72), liste fermée de variables (RG71), contrôle de sortie sur la charge
utile envoyée à Brevo, et un test par ligne du tableau ci-dessus (document `18`).

**RG137 — Un contrôle de sortie s'applique à toute charge utile transmise à Brevo** : si elle
contient un champ non déclaré dans le mapping du §M4, **l'envoi est refusé** plutôt que nettoyé. Un
nettoyage silencieux laisse croire que le mapping est respecté alors qu'il ne l'est pas.

---

### M — Le contrat d'interface avec Brevo

> **Vérifié sur la documentation officielle Brevo le 2026-09-19.** Ces valeurs évoluent : elles
> sont **revérifiées au moment d'écrire le code**, et la date de la dernière vérification est
> inscrite dans le module d'intégration. Coder de mémoire sur une interface tierce est la première
> cause de panne d'intégration.

**RG138 — Un contrat étroit, pas un client générique.** INFLUX n'expose pas « l'API Brevo » : il
expose **huit opérations nommées**, et rien d'autre. Changer de fournisseur d'emailing doit revenir
à réécrire un module, pas à irriguer tout le code. Aucun appel à Brevo n'existe hors de ce module,
et un contrôle automatisé le vérifie.

#### M1 — Les huit opérations

| # | Opération INFLUX | Point d'accès Brevo *(vérifié le 2026-09-19)* | Quand | Nature |
|---|---|---|---|---|
| 1 | **Créer ou mettre à jour un contact** | `POST /v3/contacts` avec `updateEnabled: true` | `lead.created`, `lead.updated`, `consent.granted`, `email.changed` | Contacts |
| 2 | **Désinscrire / supprimer un contact** | Mise à jour du contact (`emailBlacklisted`), ou suppression selon `account.deleted` | `consent.revoked`, `account.deleted` | Contacts |
| 3 | **Lister les segments** | Lecture des segments du compte | Affichage de l'écran 3, source 2 | Autres |
| 4 | **Créer une campagne** | `POST /v3/emailCampaigns` — `sender`, `templateId`, `recipients.segmentIds`, **`exclusionListIds`** | Envoi de source 2 | **Autres — catégorie la plus contrainte** |
| 5 | **Déclencher une campagne** | Envoi immédiat de la campagne créée, par son identifiant | Fin de la fenêtre d'annulation | Autres |
| 6 | **Envoyer un e-mail unitaire** | `POST /v3/smtp/email` — `templateId` ou contenu, `to`, `params`, `tags`, **`headers: {"Idempotency-Key": …}`**. Réponse : **`messageId`** | Tous les transactionnels, et la source 3 | Transactionnel |
| 7 | **Ajouter à la liste de suppression** | Liste de blocage transactionnelle sous `/v3/smtp`, **et** liste d'exclusion marketing | Désinscription, plainte, fin d'un envoi de source 3 | Contacts |
| 8 | **Recevoir les événements** | Webhook entrant (M6) | En continu | — |

#### M2 — Limites de débit et conséquences de conception

| Catégorie | Limite *(palier « général », 2026-09-19)* | Ce qui s'y trouve | Conséquence |
|---|---|---|---|
| **Transactionnel** | ~1 000 requêtes/seconde, très large horaire | Opération 6 | Jamais le goulot. Le P0 n'attend rien |
| **Contacts** | ~10 requêtes/seconde, ~36 000/heure | Opérations 1, 2, 7 | La file de leads s'y adapte sans peine au volume du pilote |
| **Autres points d'accès** | **~100 requêtes/heure** | Opérations 3, 4, 5 | **C'est le vrai goulot.** Il interdit de créer une campagne par destinataire et justifie RG48 |

**RG139 — La file respecte ces limites par construction** : débit plafonné par catégorie, file
d'attente, **temporisation exponentielle avec gigue et plafond**, respect de l'en-tête de
temporisation renvoyé par Brevo s'il est présent. Aucune rafale non contrôlée, jamais.

**RG140 — Les limites réelles dépendent du palier du compte Brevo**, qui n'est pas connu à la
rédaction. Le module lit les limites **en configuration** (RG10) et les affiche (RG128) plutôt que
de les supposer.

#### M3 — Idempotence, opération par opération

| Opération | Clé d'idempotence | Comportement au rejeu |
|---|---|---|
| Créer / mettre à jour un contact | Identifiant de compte INFLUX + type d'opération + identifiant d'événement | Mise à jour, **jamais de doublon** (`updateEnabled`) |
| Désinscrire | Identifiant de compte + `revoked` | Sans effet supplémentaire, résultat identique |
| Créer une campagne | Identifiant de l'envoi INFLUX (`email_sends.id`) | **Une campagne par envoi.** Un second appel avec la même clé ne crée rien |
| Déclencher une campagne | Identifiant de campagne + `send` | Sans effet si déjà déclenchée |
| E-mail unitaire | Clé de RG89, transmise en **`Idempotency-Key`** *et* contrainte d'unicité locale (RG90) | **L'e-mail ne repart pas** |
| Liste de suppression | Adresse + liste | Sans effet supplémentaire |
| Webhook entrant | `message-id` + `event` + horodatage (M6) | Ignoré au second passage |

#### M4 — Mapping des champs INFLUX ↔ Brevo

**RG141 — Chaque attribut est documenté ici, et nulle part ailleurs.** Un mapping non écrit se perd
et coûte cher à reconstituer.

| Champ INFLUX | Attribut Brevo | Type | Valeur par défaut | Si absent |
|---|---|---|---|---|
| Identifiant de compte | `INFLUX_ACCOUNT_ID` | texte (identifiant opaque) | — | **Jamais absent** : c'est la clé de rapprochement |
| Rôle | `PROFILE_TYPE` | liste fermée `advertiser` · `creator` | — | Jamais absent |
| Statut déclaré | `DECLARED_STATUS` | liste fermée `individual` · `business` | — | Jamais absent (`05` RG18) |
| Langue de communication | `LANGUAGE` | `fr` · `en` | `en` | Jamais absente (`05` RG15) |
| Pays | `COUNTRY` | ISO 3166-1 alpha-2 | — | Jamais absent |
| Nom d'entreprise | `COMPANY` | texte, 120 | — | **Vide pour un créateur.** Jamais rempli avec un nom de personne (`05` RG88) |
| Date d'inscription | `SIGNED_UP_AT` | date-heure | — | Jamais absente |
| Source d'inscription | `SIGNUP_SOURCE` | liste fermée | `direct` | Valeur par défaut |
| Étape de funnel | `FUNNEL_STAGE` | liste fermée : inscrit · profil complété · campagne publiée · en négociation | `registered` | Valeur par défaut |
| Complétude du profil | `PROFILE_COMPLETENESS` | entier 0–100 | `0` | `0` |
| Secteur ou thématique principale | `MAIN_TOPIC` | liste fermée | — | **Vide**, jamais deviné |
| Niveau de badge | `VERIFIED_LEVEL` | liste fermée `none` · `n1` · `n2` | `none` | `none` |
| Consentement marketing | `MARKETING_CONSENT` | booléen | `false` | `false` — **jamais `true` par défaut** |
| Date du consentement | `CONSENT_AT` | date-heure | — | Vide |
| Source du consentement | `CONSENT_SOURCE` | liste fermée | — | Vide |
| Dernier envoi marketing | `LAST_MARKETING_SENT_AT` | date-heure | — | Vide (RG80) |
| Envois marketing sur 30 j | `MARKETING_SENDS_30D` | entier | `0` | `0` (RG80) |

**RG142 — Un champ absent est envoyé vide, jamais rempli d'une valeur inventée** (`05` RG88,
`13` RG115). Remplir « entreprise » avec le nom d'un créateur produirait une donnée fausse dans un
outil qui l'exploite pour segmenter et pour écrire.

**RG143 — Ne sont jamais envoyés comme attribut de contact** : nom ou prénom d'une personne
physique, pseudonyme, identifiant de réseau social, lien de réseau, numéro de téléphone, montant,
état d'affaire, identité d'une contrepartie, motif interne, note interne, donnée enrichie par
Apollo. La liste des attributs transmis est **fermée** et contrôlée en sortie (RG137).

#### M5 — Gestion des erreurs

**RG144 — Trois classes d'erreur, trois traitements, aucune ambiguïté** :

| Classe | Codes | Traitement | Visible où |
|---|---|---|---|
| **Transitoire** | `429`, `5xx`, délai dépassé, coupure réseau | Réessai avec **temporisation exponentielle plafonnée** et gigue, calendrier de `05` RG79, respect de l'en-tête de temporisation | File d'envoi, cause en clair |
| **Permanente** | `400`, `422`, adresse invalide, contact refusé, segment inexistant | **Aucun réessai.** Échec journalisé, ligne en file backoffice, cause en clair | File `email_send_failures` |
| **Authentification** | `401`, `403` | **Arrêt de la file**, alerte immédiate à `admin` (AL25), déclenchement de `marketing_paused` (RG123-3), intervention humaine | Alerte + bandeau |

**RG145 — Une erreur permanente ne se rejoue pas automatiquement**, et l'écran le dit. Rejouer en
boucle une adresse refusée dégrade la réputation du domaine d'envoi — donc, in fine, la
délivrabilité du code de connexion (**D37**).

#### M6 — Le webhook entrant, et le fait qu'il n'est pas signé

**RG146 — Constat vérifié le 2026-09-19 : Brevo ne signe pas ses webhooks.** Il n'existe ni HMAC,
ni JWT, ni en-tête de signature. Ce qui est offert : **restriction par plages d'adresses IP**
publiées par Brevo, **authentification basique** dans l'URL, **jeton porteur**, et **en-têtes
personnalisés** définis à la création du webhook.

> **C'est un écart avec la règle 7 de mon propre périmètre** (« webhooks entrants vérifiés :
> signature validée ») **et avec la skill `brevo-campaign`.** Il ne peut pas être comblé : la
> capacité n'existe pas chez le fournisseur. Il est donc **compensé et soumis à
> `expert-cybersecurite`** (veto).

**Les six compensations, cumulatives** :

1. **Jeton partagé en en-tête personnalisé**, long, aléatoire, comparé **en temps constant**, tenu
   en variable d'environnement, **rotation possible avec deux valeurs acceptées** pendant la
   fenêtre de bascule ;
2. **Chemin d'accès non devinable**, dédié, `noindex`, jamais publié ;
3. **Restriction aux plages d'adresses IP** publiées par Brevo, rafraîchies et surveillées ;
4. **Fenêtre d'horodatage** : tout événement dont l'horodatage s'écarte de plus de **15 minutes**
   de l'heure courante est rejeté — c'est ce qui empêche le rejeu d'une capture ancienne ;
5. **Idempotence par (`message-id`, `event`, horodatage)** : un événement déjà vu est ignoré,
   silencieusement et sans erreur ;
6. **Aucune décision irréversible ni aucune preuve n'est fondée sur le seul contenu du webhook**
   (RG106) : ce qui retire un droit est appliqué parce que c'est conservateur ; ce qui crée une
   preuve est **revérifié par un appel sortant**.

**RG147 — Le récepteur répond vite et traite après.** Il accuse réception, écrit l'événement brut
dans une file, et le traite hors du cycle de la requête. Un traitement lent fait recommencer le
fournisseur, ce qui multiplie les doublons — que RG146-5 absorbe, mais qu'on évite d'abord.

#### M7 — La doublure de test

**RG148 — Aucun test ne touche Brevo, jamais**, y compris un test « rapide » exécuté à la main. La
doublure est un faux service local, dont le contrat est figé par des **échanges enregistrés** —
requête et réponse réelles, capturées une fois, expurgées de tout secret. Les scénarios obligatoires
du plan de test (document `18`) :

1. consentement absent → **ligne « ignorée », jamais « échec »** ;
2. consentement retiré **entre** la constitution du segment et l'envoi → écarté (RG35) ;
3. service indisponible (`5xx`) → réessais selon le calendrier, aucune perte ;
4. limite de débit (`429`) avec en-tête de temporisation → attente respectée ;
5. clé refusée (`401`) → arrêt de la file, alerte, suspension marketing ;
6. **rejeu d'un envoi déjà transmis → aucun doublon, aucun e-mail renvoyé** ;
7. désinscription reçue par webhook → consentement retiré en base, propagation ;
8. **webhook rejoué à l'identique → ignoré** ; webhook au jeton invalide → rejeté et journalisé ;
9. webhook au-delà de la fenêtre d'horodatage → rejeté ;
10. annulation dans la fenêtre de 5 minutes → **aucun appel sortant n'a eu lieu** ;
11. écart de volume au-delà du seuil → envoi bloqué, reconfirmation exigée ;
12. interrupteur d'urgence → marketing arrêté, **code de connexion toujours délivré** ;
13. mode `redirect` → aucun destinataire réel atteint ;
14. réglage `live` hors production → **le service refuse de démarrer** ;
15. échec définitif d'un `intro.reveal_confirmation` → **la révélation reste enregistrée**, AL10
    levée ;
16. une ligne par interdit de RG135.

#### M8 — Variables d'environnement

**RG149 — Toutes les variables sont côté serveur, dans `apps/api` uniquement**, et aucune n'est
jamais présente dans un bundle front, un dépôt ou un journal (skill `env-secrets`, `CLAUDE.md` §6).

| Variable | Rôle | Portée | Remarque |
|---|---|---|---|
| `BREVO_API_KEY` | Clé d'accès | **Production uniquement** | Rotation planifiée, deux clés acceptées pendant la bascule |
| `BREVO_API_BASE_URL` | Adresse de base | Tous | Permet de pointer la doublure en test |
| `BREVO_MODE` | `disabled` · `redirect` · `live` | Tous | `live` **refusé hors production** (RG116) |
| `BREVO_TEST_RECIPIENTS` | Liste fermée d'adresses internes | Hors production | Obligatoire si `redirect` |
| `BREVO_WEBHOOK_SECRET` | Jeton de l'en-tête personnalisé | Tous | Deux valeurs acceptées pendant la rotation (RG146-1) |
| `BREVO_WEBHOOK_PATH_TOKEN` | Segment non devinable du chemin | Tous | Rotation avec le jeton |
| `BREVO_IP_ALLOWLIST` | Plages d'adresses autorisées | Tous | Surveillée : une évolution non répercutée coupe les retours |
| `BREVO_SENDER_TRANSACTIONAL` | Expéditeur du flux transactionnel | Tous | Sous-domaine dédié (RG9) |
| `BREVO_SENDER_MARKETING` | Expéditeur du flux marketing | Tous | Sous-domaine dédié |
| `BREVO_SENDER_PROSPECTING` | Expéditeur du flux prospection | **Production uniquement** | Sous-domaine dédié |
| `BREVO_SUPPRESSION_LIST_ID` | Liste d'exclusion jointe à tout envoi de source 2 | Tous | RG45 |

**RG150 — La documentation officielle est relue avant chaque évolution du module**, et la date de
la dernière vérification est inscrite dans le code et dans ce document. Une intégration qui « a
toujours marché » cesse de marcher le jour où le fournisseur change un contrat sans nous prévenir.

---

### N — Messages, langue et accessibilité

**RG151 — Aucun libellé n'est écrit en dur**, ni côté membre, ni côté backoffice (`15` RG11,
**D36** ouverte, français en valeur d'attente). Les messages destinés aux membres existent **en
français et en anglais dès le premier jour**, parce qu'ils sortent du backoffice.

**RG152 — Quatre états explicites par écran** : repos, chargement, succès, échec. Aucune saisie
n'est perdue sur erreur, **y compris le motif d'une saisie libre dont l'envoi a échoué**
(`15` RG116, RG117).

**RG153 — La couleur n'est jamais seule porteuse d'information** : l'état d'un envoi, le compte à
rebours d'annulation, un écartement et une alerte portent chacun un **libellé écrit** ; contrastes
WCAG AA ; tous les tokens viennent du design system (`15` RG119, RG120).

**RG154 — Le compte à rebours d'annulation est annoncé aux lecteurs d'écran**, et l'action
« Annuler cet envoi » est atteignable **au clavier** depuis n'importe quel écran (RG28).

**RG155 — Messages du périmètre** :

| Clé | Français | English |
|---|---|---|
| `email.send.source.platform` | Contacts de la plateforme — consentement vérifié au moment de l'envoi. | Platform contacts — consent checked at send time. |
| `email.send.source.brevo` | Segment Brevo — le consentement est géré dans Brevo, qui fait foi. INFLUX ne lit pas les destinataires. | Brevo segment — consent is managed in Brevo, which prevails. INFLUX does not read the recipients. |
| `email.send.source.manual` | Adresse saisie — aucune base légale acquise : c'est de la prospection. Une seule adresse, motif obligatoire. | Manually entered address — no established legal basis: this is prospecting. One address only, reason required. |
| `email.send.preview.required` | Affichez l'aperçu avant de continuer. | Display the preview before continuing. |
| `email.send.volume.asOf` | {count} destinataires, calculé à {time}. {skipped} personnes sont écartées. | {count} recipients, calculated at {time}. {skipped} people are excluded. |
| `email.send.skipped.byReason` | Écartés : {reason} — {count}. Ce n'est pas une erreur. | Excluded: {reason} — {count}. This is not an error. |
| `email.send.confirm.irreversible` | Cet envoi sera irréversible passé le délai d'annulation de 5 minutes. | This send becomes irreversible after the 5-minute cancellation window. |
| `email.send.confirm.retype` | Saisissez le nombre exact de destinataires pour confirmer. | Type the exact number of recipients to confirm. |
| `email.send.cancel.countdown` | Envoi programmé — annulable pendant encore {seconds} s. | Send scheduled — cancellable for another {seconds}s. |
| `email.send.cancel.done` | Envoi annulé. Aucun e-mail n'est parti. | Send cancelled. No email was sent. |
| `email.send.blocked.volumeDrift` | Le nombre de destinataires a changé de {delta} depuis votre confirmation. L'envoi est suspendu : reconfirmez-le. | The recipient count changed by {delta} since your confirmation. The send is on hold: confirm it again. |
| `email.send.blocked.template` | Ce modèle a été modifié depuis sa validation. Il doit être relu et revalidé. | This template has changed since it was approved. It must be reviewed and approved again. |
| `email.manual.refused.member` | Cette adresse correspond à un compte INFLUX. Passez par les contacts de la plateforme. | This address belongs to an INFLUX account. Use platform contacts instead. |
| `email.manual.refused.consumerDomain` | La saisie libre est réservée aux adresses professionnelles. | Manual entry is limited to business addresses. |
| `email.manual.refused.alreadyContacted` | Cette adresse a déjà été sollicitée le {date} par {agent}. Aucune relance n'est prévue. | This address was already contacted on {date} by {agent}. No follow-up is planned. |
| `email.manual.refused.country` | La prospection n'est pas encore validée pour ce pays. | Prospecting is not yet approved for this country. |
| `email.cadence.skipped` | {count} personnes ont déjà reçu le nombre maximal d'e-mails autorisé sur la période. | {count} people have already received the maximum number of emails allowed for the period. |
| `email.killswitch.active` | Les envois marketing sont suspendus depuis {time}. Les e-mails de service continuent. | Marketing sends are paused since {time}. Service emails continue. |
| `email.env.banner` | Environnement {env} — mode d'envoi : {mode}. Aucun destinataire réel n'est atteint. | {env} environment — send mode: {mode}. No real recipient is reached. |
| `email.unsubscribe.done` | Vous ne recevrez plus d'e-mails commerciaux d'INFLUX. Les e-mails liés à votre compte, dont votre code de connexion, continuent de vous être envoyés. | You will no longer receive marketing emails from INFLUX. Emails related to your account, including your login code, will still be sent. |
| `email.transactional.why` | Vous recevez cet e-mail parce que {reason}. Il ne s'agit pas d'un e-mail commercial. | You are receiving this email because {reason}. This is not a marketing email. |

---

## Cas limites

### Les huit cas obligatoires de `feature-spec`

| # | Cas | Comportement attendu |
|---|---|---|
| **1** | **Donnée absente ou profil incomplet** — un contact du segment n'a ni entreprise, ni secteur, ni langue renseignée | La langue tombe sur l'anglais (RG11) ; les attributs absents partent **vides**, jamais inventés (RG142) ; une variable de modèle sans valeur **et sans repli déclaré bloque l'envoi entier** (RG21), elle n'écarte pas silencieusement des gens |
| **2** | **Valeur nulle, négative ou aberrante** — segment à 0 destinataire ; segment à 200 000 ; volume négatif renvoyé par Brevo | 0 destinataire : envoi **refusé** avec un message explicite, aucun objet créé. Au-dessus du plafond du rôle : **refus** avec le plafond et le rôle qui pourrait le faire (RG25). Volume aberrant renvoyé par Brevo : l'envoi passe en `blocked`, AL47, aucune transmission. **Aucun montant n'existe dans ce périmètre** (RG14) |
| **3** | **Doublon** — le même contact figure deux fois dans un périmètre ; le même envoi est soumis deux fois ; le même webhook arrive deux fois | Dédoublonnage du périmètre **par identifiant de compte**, et `unique (email_send_id, email_address)` en base (`04` §5.10). Double soumission : le serveur est idempotent, la seconde est sans effet. Webhook : ignoré (RG146-5) |
| **4** | **Action concurrente** — deux agents préparent le même segment ; l'un annule pendant que l'autre confirme ; deux annulations simultanées | Deux envois distincts sont deux objets distincts : **la cadence les départage** (le second voit les destinataires du premier écartés au recalcul, RG30). L'annulation gagne toujours sur la confirmation : tant que la fenêtre court, l'état `cancelled` est terminal. Deux annulations : la seconde est sans effet et le dit |
| **5** | **Droit insuffisant** — un `agent` tente un envoi au-delà de son plafond, ou une saisie libre alors que le rôle habilité est `admin` | Refus **côté serveur** (jamais un masquage d'interface), message clair, **tentative journalisée** ; cinq refus sur 24 h déclenchent AL39 (`15` RG110) |
| **6** | **Service externe indisponible** — Brevo hors service pendant un envoi de masse, ou au moment d'un code de connexion | Envoi de masse : `partially_sent`, réessais, échecs visibles et rejouables, **rien n'est perdu** (RG33, RG93). Code de connexion : **l'échec s'affiche à la personne** avec sa cause (RG87, `05` RG60), la saisie est conservée, aucun faux succès |
| **7** | **Utilisateur qui abandonne en cours de parcours** — un agent quitte l'écran 4 sans confirmer ; il ferme son navigateur pendant la fenêtre d'annulation | Un envoi non confirmé reste en `draft` et **expire** après un délai de configuration (valeur d'attente : 7 jours), sans jamais partir. Fermer le navigateur **n'annule pas** l'envoi programmé et **n'empêche pas** de l'annuler depuis un autre poste (RG28) |
| **8** | **Annulation ou retour en arrière après validation** — annuler dans la fenêtre ; vouloir annuler après ; « défaire » un envoi parti | Dans la fenêtre : annulation réelle, **aucun appel sortant n'a eu lieu** (RG28). Après : **impossible, et annoncé avant** (RG26, `15` RG89). On ne rappelle pas un e-mail : on écrit un correctif, qui est un nouvel envoi soumis aux mêmes règles |

### Les cas limites propres aux e-mails

| # | Cas | Comportement attendu |
|---|---|---|
| 9 | Le consentement est retiré **entre la confirmation et la fin de la fenêtre** | Écarté au recalcul (RG30), journalisé. C'est précisément la raison d'être du second calcul |
| 10 | Le segment Brevo est **modifié ou supprimé** entre l'aperçu et l'envoi | Supprimé : envoi en `blocked`, message clair. Modifié : le volume recalculé déclenche RG31 si l'écart dépasse le seuil |
| 11 | Le modèle est **modifié chez Brevo** entre la validation et l'envoi | Écart d'empreinte : envoi refusé, modèle en `draft`, AL46 (RG69) |
| 12 | Un contact est **désinscrit chez Brevo** mais consentant dans INFLUX | **Brevo fait foi** (RG7) : INFLUX se corrige, écrit un `consent_events` retiré, et l'écart alimente l'indicateur de AL27 |
| 13 | Un contact du segment est **suspendu** pendant la fenêtre | Écarté au recalcul, motif `compte_suspendu` |
| 14 | Une adresse **rebondit durement** sur un e-mail marketing | Adresse marquée injoignable, écartée des envois suivants — **et une entrée s'ouvre dans `email_delivery_incidents`**, car depuis **D37** c'est un compte qui ne peut plus se connecter (RG40) |
| 15 | Un membre **répond** à un e-mail transactionnel | Réponse automatique unique, plafonnée à une par adresse et par 24 h, renvoyant vers le fil (RG97) |
| 16 | Deux e-mails transactionnels visent la même personne à la même seconde (révélation et notification) | Ce sont deux e-mails, tous deux légitimes, et **la cadence ne s'y applique pas** (RG79). Aucune fusion |
| 17 | Le `messageId` **ne revient pas** sur un `intro.reveal_confirmation` | La révélation reste enregistrée (RG92) ; la ligne reste `queued` ; le rejeu s'applique ; **un échec définitif lève AL10** : preuve externe incomplète (`13` RG80) |
| 18 | Un webhook arrive pour un `messageId` **inconnu** d'INFLUX | Accepté, journalisé, **ignoré**. Ce peut être un envoi fait dans l'interface Brevo par un humain : ce n'est pas une anomalie de notre système |
| 19 | Le **jeton du webhook est en cours de rotation** | Deux valeurs sont acceptées pendant la fenêtre de bascule (RG146-1). Aucun retour n'est perdu, et une désinscription perdue serait un manquement |
| 20 | Un agent tente de **coller une liste d'adresses** dans le champ de saisie libre | Refus au premier séparateur détecté (RG52), message explicite, tentative journalisée. C'est le contournement le plus prévisible de A4 |
| 21 | L'interrupteur d'urgence est actionné **pendant** une fenêtre d'annulation | L'envoi est **annulé**, pas mis en attente (RG121), et son auteur en est informé |
| 22 | Le quota Brevo est atteint au milieu d'un envoi de masse | L'envoi reste en `sending`, la file attend selon l'en-tête de temporisation, l'écran affiche l'attente et l'heure estimée. **Aucun destinataire n'est perdu** (RG139) |
| 23 | Un e-mail marketing part **par erreur** à un prospect de source 3 | Impossible par construction : l'adresse n'est **jamais** dans la base de contacts (RG60) et figure dans la liste d'exclusion (RG45) |
| 24 | Un contact est présent dans un **segment Brevo** et **inconnu d'INFLUX** | Il reçoit, et la cadence d'INFLUX ne le protège pas : **limite structurelle assumée**, affichée à chaque envoi de cette source (RG47) |
| 25 | Le domaine d'envoi marketing est mis en liste noire par un grand fournisseur de messagerie | Le code de connexion continue d'être délivré, **parce qu'il part d'un autre sous-domaine** (RG9). C'est exactement ce que cette séparation achète |

### La checklist INFLUX de `feature-spec`

| # | Contrôle | Réponse |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission, net créateur distingués ? | **Sans objet, et volontairement** : aucun montant n'existe dans ce périmètre (**A1**, RG14). Un modèle qui en contiendrait un est refusé à la validation (RG72-4) |
| 2 | **Traçabilité** — la fonctionnalité permet-elle aux parties de se retrouver hors plateforme ? | **Risque réel, traité.** Un e-mail est par nature un canal de sortie. D'où : aucune coordonnée d'un membre dans un e-mail (RG135-2), aucun texte de message (RG135-1), aucune pièce jointe (RG135-12), aucune adresse de réponse fonctionnelle (RG97), et le seul chemin proposé est le lien vers le fil (`13` RG78). **Risque résiduel assumé** : un e-mail de révélation nomme les deux parties — c'est le prix de la preuve, et c'est un arbitrage déjà fait par `13` |
| 3 | **Leads** — collecte de coordonnées ? Que part-il vers Brevo et Apollo, avec quel consentement ? | Oui, et c'est le sujet. Vers **Brevo** : les attributs de M4, sous consentement relu à l'envoi, sauf transactionnel. Vers **Apollo** : **rien de ce document**. La source 3 collecte une adresse de prospect qui **n'entre ni dans la base de contacts, ni dans un compte** (RG60) |
| 4 | **Backoffice** — quelle est la contrepartie interne ? | §K en entier : écran des envois, file d'envoi, file `email_send_failures` (nouvelle, RG127), sept alertes (RG131), quotas affichés, rejeu unitaire et en lot, interrupteur d'urgence |
| 5 | **Matching hybride** — comportement algorithmique et surcharge humaine ? | **Sans objet** : aucun matching ici. Le seul automatisme est l'écartement, et il est entièrement déterministe, motivé et journalisé — **jamais un score** |
| 6 | **Deux populations** — la story mélange-t-elle annonceurs et influenceurs ? | Non par construction : deux discours, deux modèles, et un **avertissement écrit** sur tout segment mixte (RG18) |
| 7 | **Données personnelles** — faut-il l'avis d'`expert-conformite-rgpd` ? | **Oui, avec veto, sur quatre points** : les plafonds et la définition d'« adresse professionnelle » de la source 3 (**D35**, RG53, RG54) ; la légalité de la prospection pays par pays (RG51) ; le refus de conserver ouvertures et clics nominatifs pour les sources 1 et 2 (RG107) ; les durées de conservation (RG112, RG61). **Et l'avis d'`expert-cybersecurite`, avec veto, sur l'absence de signature des webhooks** (RG146) |

---

## Critères d'acceptation

### Le parcours d'envoi de masse

**CA1** — *Étant donné* un commercial sur l'écran « Nouvel envoi », *quand* il choisit une source,
*alors* la base légale correspondante est affichée en toutes lettres et **le choix n'est plus
modifiable** pour cet envoi.

**CA2** — *Étant donné* un envoi en préparation, *quand* le commercial tente de combiner un segment
et une adresse saisie, *alors* l'interface ne le permet pas et le serveur refuse toute requête qui
le tenterait.

**CA3** — *Étant donné* la source « segment Brevo », *quand* l'écran du périmètre s'affiche,
*alors* la liste des segments provient d'un appel fait **à cet instant** à Brevo, et seuls les
segments déclarés autorisés et porteurs de la condition d'exclusion de cadence sont sélectionnables.

**CA4** — *Étant donné* un périmètre contenant des annonceurs et des créateurs, *quand* l'écran du
périmètre s'affiche, *alors* un avertissement écrit signale le mélange des deux populations et ce
choix est journalisé.

**CA5** — *Étant donné* un envoi dont l'aperçu n'a pas été affiché, *quand* le commercial tente de
passer à la confirmation, *alors* c'est refusé, côté interface **et** côté serveur.

**CA6** — *Étant donné* un périmètre bilingue, *quand* l'aperçu s'affiche, *alors* les **deux**
versions du modèle sont montrées, et aucune n'est traduite à la volée.

**CA7** — *Étant donné* un modèle dont une variable n'a de valeur pour aucun repli déclaré, *quand*
l'envoi est préparé, *alors* il est **bloqué** avec le nom de la variable et le nombre de
destinataires concernés.

**CA8** — *Étant donné* l'écran du volume, *quand* il s'affiche, *alors* le nombre de destinataires
porte **l'heure exacte de son calcul**, et les écartés sont détaillés par motif, en compteurs.

**CA9** — *Étant donné* cet écran, *quand* on cherche la liste des destinataires ou des écartés,
*alors* **aucune liste nominative n'est affichée ni exportable**, pour aucun rôle.

**CA10** — *Étant donné* des écartés et des échecs, *quand* l'écran les présente, *alors* ils sont
dans **deux compteurs distincts**, jamais additionnés, et les écartés portent la mention « ce n'est
pas une erreur ».

**CA11** — *Étant donné* un volume supérieur au plafond du rôle, *quand* le commercial tente de
poursuivre, *alors* l'envoi est refusé avec le plafond, la consommation du jour et le rôle qui
pourrait le faire.

**CA12** — *Étant donné* l'écran de confirmation, *quand* le commercial n'accomplit qu'un seul des
deux gestes, *alors* l'envoi n'est pas programmé. Les deux gestes sont **de nature différente** :
une case et une ressaisie au clavier.

**CA13** — *Étant donné* le champ de ressaisie du volume, *quand* le commercial tente un
copier-coller ou laisse l'auto-complétion le remplir, *alors* le champ le refuse.

**CA14** — *Étant donné* une seule personne cumulant `agent` et `admin`, *quand* elle confirme un
envoi, *alors* la procédure dégradée s'applique — récapitulatif, attente d'au moins 60 secondes,
re-authentification — et **l'écran dit en toutes lettres que le contrôle est affaibli**.

**CA15** — *Étant donné* un envoi confirmé, *quand* on inspecte les appels sortants pendant les
5 minutes suivantes, *alors* **aucun appel n'a été fait à Brevo**.

**CA16** — *Étant donné* un envoi en fenêtre d'annulation, *quand* n'importe quel `agent` ou
`admin` clique « Annuler cet envoi » depuis n'importe quel écran, *alors* l'envoi passe en
`cancelled`, **aucun e-mail ne part**, et l'annulation est journalisée avec son auteur et son motif.

**CA17** — *Étant donné* un envoi confirmé pour 4 000 destinataires, *quand* le recalcul de fin de
fenêtre en trouve 3 200, *alors* l'envoi passe en `blocked`, l'alerte AL47 est levée et **une
nouvelle confirmation est exigée**.

**CA18** — *Étant donné* un envoi dont 5 % des destinataires échouent, *quand* l'envoi se termine,
*alors* il est en `partially_sent`, le compte rendu détaille les échecs par cause, et le rejeu ne
porte que sur eux.

### Source 1 — contacts de la plateforme

**CA19** — *Étant donné* un contact qui a retiré son consentement **après** la constitution du
segment, *quand* l'envoi part, *alors* il est écarté, motif `consentement_retire`.

**CA20** — *Étant donné* chaque destinataire de cette source, *quand* on inspecte la ligne de
destinataire en base, *alors* `consent_checked_at` est renseigné.

**CA21** — *Étant donné* un contact désinscrit chez Brevo, *quand* un envoi INFLUX le viserait,
*alors* il est écarté, **même si INFLUX le croyait consentant**.

**CA22** — *Étant donné* un contact ayant déposé une plainte pour spam, *quand* un envoi le
viserait, *alors* il est écarté définitivement, et aucun rejeu ordinaire ne le rétablit.

**CA23** — *Étant donné* un contact dont la langue n'est pas couverte par le modèle, *quand*
l'envoi est préparé, *alors* **l'envoi entier est bloqué** — on corrige le modèle, on n'écarte pas
des gens.

**CA24** — *Étant donné* un clic sur le lien de désinscription, *quand* on observe l'état du
consentement, *alors* il est retiré **immédiatement dans INFLUX**, un `consent_events` est écrit, et
la propagation part en priorité sur toute la file.

**CA25** — *Étant donné* cette désinscription, *quand* le membre demande ensuite un code de
connexion, *alors* **il le reçoit** : le retrait du consentement n'affecte jamais un transactionnel.

**CA26** — *Étant donné* un rebond dur sur un e-mail marketing, *quand* on observe le système,
*alors* l'adresse est marquée injoignable **et** une entrée s'ouvre dans la file des adresses
injoignables.

**CA27** — *Étant donné* trois rebonds mous sur 30 jours pour la même adresse, *quand* le troisième
survient, *alors* l'adresse est traitée comme un rebond dur.

**CA28** — *Étant donné* un envoi terminé, *quand* on consulte son journal, *alors* on y trouve la
source, la base légale, l'auteur, le confirmateur, le modèle et sa version, les langues, le volume,
les écartés par motif et tous les horodatages — **mais ni le corps rendu, ni l'objet personnalisé**.

### Source 2 — segment Brevo

**CA29** — *Étant donné* un segment existant chez Brevo mais non déclaré dans la liste des segments
autorisés, *quand* le commercial cherche à l'utiliser, *alors* il n'apparaît pas et le serveur
refuse toute requête le visant.

**CA30** — *Étant donné* un segment autorisé mais **sans** condition d'exclusion de cadence,
*quand* l'écran l'affiche, *alors* il est marqué non sélectionnable avec son motif.

**CA31** — *Étant donné* un envoi de source 2, *quand* on inspecte la base INFLUX après l'envoi,
*alors* **aucune adresse et aucune personne du segment n'y ont été écrites**.

**CA32** — *Étant donné* tout envoi de source 2, *quand* on inspecte la campagne créée chez Brevo,
*alors* la **liste d'exclusion INFLUX** y figure ; sans elle, l'envoi n'est pas créé.

**CA33** — *Étant donné* l'écran de volume d'un segment Brevo, *quand* il s'affiche, *alors* le
chiffre porte la mention « annoncé par Brevo, non vérifié par INFLUX » et son horodatage.

**CA34** — *Étant donné* l'écran de confirmation d'un envoi de source 2, *quand* il s'affiche,
*alors* il énonce la limite structurelle : les contacts inconnus d'INFLUX ne sont pas couverts par
sa cadence.

**CA35** — *Étant donné* un envoi de source 2 de 20 000 destinataires, *quand* on compte les appels
sortants, *alors* il y en a **un pour créer la campagne et un pour la déclencher**, pas 20 000.

**CA36** — *Étant donné* une désinscription revenue d'un segment Brevo pour une personne inconnue
d'INFLUX, *quand* elle est traitée, *alors* l'adresse rejoint la liste d'exclusion et **aucun
contact n'est créé dans INFLUX**.

### Source 3 — saisie libre

**CA37** — *Étant donné* la liste des pays validés pour la prospection **vide**, *quand* un
commercial ouvre la saisie libre, *alors* l'option est désactivée avec son motif écrit, et aucun
envoi n'est possible.

**CA38** — *Étant donné* le champ d'adresse, *quand* on y colle « a@x.fr, b@y.fr », *alors* la
saisie est refusée au séparateur et la tentative est journalisée.

**CA39** — *Étant donné* une adresse sur un domaine de messagerie grand public, *quand* elle est
saisie, *alors* elle est refusée avec le message « réservé aux adresses professionnelles ».

**CA40** — *Étant donné* une adresse correspondant à un compte INFLUX existant, *quand* elle est
saisie, *alors* elle est refusée avec renvoi vers la source 1, et la recherche est journalisée.

**CA41** — *Étant donné* une adresse déjà sollicitée, *quand* un commercial la saisit à nouveau,
*alors* c'est refusé, avec la date et l'auteur de la première sollicitation. **Aucune relance
n'existe.**

**CA42** — *Étant donné* un commercial ayant atteint son plafond quotidien, *quand* il tente un
envoi de plus, *alors* c'est refusé avec son plafond et sa consommation, et la tentative est
journalisée.

**CA43** — *Étant donné* trois envois déjà faits vers un même domaine sur 90 jours, *quand* un
quatrième est tenté, *alors* il est refusé.

**CA44** — *Étant donné* le formulaire de saisie libre, *quand* le motif fait moins de
20 caractères ou que la case d'attestation n'est pas cochée, *alors* l'envoi n'est pas possible.

**CA45** — *Étant donné* un envoi de prospection, *quand* on inspecte l'e-mail reçu, *alors* il
contient les cinq mentions obligatoires, dont **un lien de désinscription en un clic**, et **aucun
texte écrit librement par l'agent**.

**CA46** — *Étant donné* un envoi de prospection effectué, *quand* on inspecte Brevo et INFLUX,
*alors* l'adresse figure en **liste de suppression**, et **ni contact Brevo, ni compte INFLUX, ni
entrée de liste marketing** n'ont été créés.

**CA47** — *Étant donné* ce même envoi, *quand* on consulte son journal, *alors* on y lit l'agent
nommé, l'adresse, le pays déclaré, l'organisation, le motif codé **et** son texte, le modèle, sa
version, la langue, l'horodatage et le `messageId`.

**CA48** — *Étant donné* un environnement autre que la production, *quand* on ouvre le backoffice,
*alors* la saisie libre est **absente**, avec une phrase expliquant pourquoi.

**CA49** — *Étant donné* un e-mail de prospection, *quand* on inspecte son expéditeur, *alors* il
part du **sous-domaine de prospection**, jamais de celui du code de connexion.

**CA50** — *Étant donné* un modèle de nature `marketing` ou `transactional`, *quand* un commercial
tente de l'utiliser en saisie libre, *alors* c'est refusé : seuls les modèles `prospecting` y sont
disponibles.

### Les modèles

**CA51** — *Étant donné* un modèle dont la version anglaise manque, *quand* on tente de le valider,
*alors* c'est refusé.

**CA52** — *Étant donné* un modèle marketing sans lien de désinscription, *quand* on tente de le
valider, *alors* c'est refusé.

**CA53** — *Étant donné* un modèle transactionnel comportant un lien de désinscription marketing ou
un bloc promotionnel, *quand* on tente de le valider, *alors* c'est refusé.

**CA54** — *Étant donné* un modèle contenant un montant ou un taux, *quand* on tente de le valider,
*alors* c'est refusé (**A1**).

**CA55** — *Étant donné* un modèle contenant une variable hors de la liste fermée, *quand* on tente
de le valider, *alors* c'est refusé.

**CA56** — *Étant donné* un modèle validé puis modifié chez Brevo, *quand* un envoi l'utilise,
*alors* l'écart d'empreinte est détecté, l'envoi refusé, le modèle repassé en `draft` et AL46 levée.

**CA57** — *Étant donné* un modèle retiré, *quand* on consulte un envoi passé qui l'utilisait,
*alors* le modèle et **sa version d'alors** restent consultables.

**CA58** — *Étant donné* un `agent` (non `admin`), *quand* il tente de valider un modèle, *alors*
c'est refusé côté serveur et la tentative est journalisée.

### La cadence

**CA59** — *Étant donné* un contact ayant reçu deux e-mails marketing dans les 7 derniers jours,
*quand* un troisième envoi le viserait, *alors* il est écarté, motif `cadence`, **et il n'existe
aucun bouton pour passer outre**.

**CA60** — *Étant donné* un contact ayant reçu un e-mail il y a 12 heures, *quand* un envoi le
viserait, *alors* il est écarté par la règle des 48 heures.

**CA61** — *Étant donné* un contact touché par un segment Brevo lundi, *quand* un segment INFLUX le
vise mercredi, *alors* ses compteurs reflètent **les deux** envois.

**CA62** — *Étant donné* un contact recevant cinq e-mails transactionnels dans la journée, *quand*
un envoi marketing le vise le lendemain, *alors* **la cadence ne l'écarte pas** : les
transactionnels ne comptent pas.

**CA63** — *Étant donné* une transmission réussie, *quand* on inspecte les attributs du contact chez
Brevo, *alors* `LAST_MARKETING_SENT_AT` et `MARKETING_SENDS_30D` sont à jour.

**CA64** — *Étant donné* un `agent`, *quand* il tente de modifier une valeur de cadence, *alors*
c'est refusé : seul un `admin` le peut, avec motif et journalisation.

### Les e-mails transactionnels

**CA65** — *Étant donné* le code source, *quand* on recense les appels d'envoi transactionnel,
*alors* chacun porte un **code du catalogue de RG85**, et un contrôle automatisé échoue si ce n'est
pas le cas.

**CA66** — *Étant donné* une demande de code de connexion, *quand* Brevo est indisponible, *alors*
l'écran l'annonce avec la cause, **conserve la saisie**, propose de réessayer, et n'affiche jamais
un faux succès.

**CA67** — *Étant donné* un membre ayant retiré son consentement marketing, *quand* il demande un
code de connexion, *alors* il le reçoit.

**CA68** — *Étant donné* un compte déjà créé, *quand* on rejoue son événement de création, *alors*
**l'e-mail de bienvenue ne repart pas**.

**CA69** — *Étant donné* une révélation d'identité, *quand* on inspecte les e-mails, *alors* il y
en a **exactement deux**, un par partie, **dans deux messages distincts**, chacun dans la langue de
son destinataire, et aucun ne met l'autre en copie.

**CA70** — *Étant donné* cette révélation, *quand* on rejoue l'événement du pipeline dix fois,
*alors* il y a toujours exactement deux e-mails : la contrainte d'unicité en base l'impose.

**CA71** — *Étant donné* un e-mail de révélation transmis, *quand* on consulte la mise en relation,
*alors* le `messageId` renvoyé par Brevo y est rattaché.

**CA72** — *Étant donné* un échec définitif d'envoi d'un e-mail de révélation, *quand* on observe
le système, *alors* **la révélation reste enregistrée**, l'alerte AL10 est levée, et le commercial
voit « preuve externe incomplète ».

**CA73** — *Étant donné* un nouveau message dans une conversation, *quand* on inspecte l'e-mail de
notification, *alors* **il ne contient pas le texte du message**, ni aucune coordonnée, ni pièce
jointe.

**CA74** — *Étant donné* un membre qui ne lit pas son fil, *quand* dix messages y arrivent dans la
journée, *alors* il reçoit **au plus deux e-mails** : un immédiat et un rappel à 24 heures.

**CA75** — *Étant donné* un e-mail transactionnel, *quand* le destinataire y répond, *alors* il
reçoit **une** réponse automatique le renvoyant vers le fil, et pas une seconde dans les 24 heures.

**CA76** — *Étant donné* n'importe quel e-mail transactionnel, *quand* on inspecte son contenu,
*alors* il ne comporte **aucun lien de désinscription marketing**, mais bien une phrase expliquant
pourquoi la personne le reçoit.

**CA77** — *Étant donné* les six indicateurs de délivrabilité du code de connexion, *quand* l'un
franchit son seuil, *alors* l'alerte AL48 part immédiatement à `admin` et figure au bloc 7 du
tableau de bord.

**CA78** — *Étant donné* un e-mail transactionnel transmis, *quand* on consulte son journal,
*alors* on y lit le code, l'identifiant de compte du destinataire, la langue, le modèle, les
horodatages, le statut et le `messageId` — **et jamais l'adresse recopiée**.

### Le suivi des résultats

**CA79** — *Étant donné* un événement Brevo d'un type inconnu, *quand* il arrive, *alors* il est
accepté, journalisé et ignoré — **jamais rejeté**.

**CA80** — *Étant donné* un événement `unsubscribed`, *quand* il arrive, *alors* il est appliqué
immédiatement sans revérification.

**CA81** — *Étant donné* un événement `delivered` portant sur un e-mail de révélation, *quand* il
arrive, *alors* le statut n'est inscrit qu'**après revérification par un appel sortant** à Brevo.

**CA82** — *Étant donné* un envoi de source 1 ou 2, *quand* on cherche qui a ouvert l'e-mail,
*alors* **l'information nominative n'existe pas** : seuls des agrégats sont conservés.

**CA83** — *Étant donné* un envoi de source 3, *quand* le destinataire ouvre l'e-mail, *alors*
l'ouverture est connue nominativement — **par construction**, et c'est écrit dans le journal.

**CA84** — *Étant donné* l'écran de résultats, *quand* il s'affiche, *alors* chaque chiffre porte
l'heure de sa dernière actualisation.

**CA85** — *Étant donné* le rapprochement quotidien, *quand* une désinscription des 48 dernières
heures manque dans INFLUX, *alors* elle est rattrapée et l'écart alimente l'indicateur d'AL27.

### Environnement et interrupteur d'urgence

**CA86** — *Étant donné* un environnement non productif configuré en mode d'envoi réel, *quand* le
service démarre, *alors* **il refuse de démarrer**, avec un message explicite.

**CA87** — *Étant donné* le mode redirigé, *quand* un envoi vise 500 destinataires, *alors*
**aucune adresse réelle n'est appelée** : tous les messages partent vers la liste fermée d'adresses
internes, avec l'adresse d'origine en préfixe d'objet et au journal.

**CA88** — *Étant donné* un backoffice non productif, *quand* on ouvre n'importe quel écran,
*alors* un bandeau permanent affiche l'environnement et le mode d'envoi, avec un libellé écrit.

**CA89** — *Étant donné* l'interrupteur `marketing_paused`, *quand* il est actif, *alors* aucun
envoi des trois sources ne part, aucun scénario de nurturing ne s'exécute, **et les e-mails
transactionnels continuent**.

**CA90** — *Étant donné* l'interrupteur `all_paused`, *quand* il est actif, *alors* **le code de
connexion est toujours délivré** et les alertes critiques internes aussi.

**CA91** — *Étant donné* un taux de plainte de 0,4 % sur 24 heures, *quand* le seuil est franchi,
*alors* `marketing_paused` s'active **automatiquement**, AL42 part, et **la reprise n'est pas
automatique**.

**CA92** — *Étant donné* un envoi en fenêtre d'annulation, *quand* l'interrupteur est actionné,
*alors* l'envoi est **annulé** et son auteur en est informé.

**CA93** — *Étant donné* la levée de l'interrupteur, *quand* un `admin` la fait, *alors* elle
exige un motif, notifie tous les `admin` et le fondateur, et est journalisée.

### La supervision

**CA94** — *Étant donné* la file d'envoi, *quand* une ligne est en échec, *alors* sa cause est
affichée **en clair**, jamais sous forme de trace technique.

**CA95** — *Étant donné* une ligne en échec, *quand* un commercial la rejoue, *alors* la clé
d'idempotence est conservée : **aucun doublon, aucun e-mail déjà envoyé n'est renvoyé**.

**CA96** — *Étant donné* une sélection de 300 lignes, *quand* un commercial demande un rejeu en
lot, *alors* l'opération est plafonnée à 200 et le dit **avant** la sélection.

**CA97** — *Étant donné* une ligne « écartée pour absence de consentement », *quand* un commercial
cherche à la rejouer, *alors* ce n'est pas possible, et l'écran explique qu'un nouvel envoi est
nécessaire.

**CA98** — *Étant donné* la consommation d'une catégorie d'appels Brevo à 80 %, *quand* le seuil
est franchi, *alors* AL44 part à `admin` et la consommation est affichée.

**CA99** — *Étant donné* le tableau de bord `admin`, *quand* on ouvre le bloc « Leads et envois »,
*alors* on y voit les envois de la semaine par source et par base légale, et **la consommation des
plafonds de saisie libre par agent**.

**CA100** — *Étant donné* n'importe quel rôle interne, *alors* aucun export de destinataires
n'existe ; seul l'export d'indicateurs agrégés est disponible.

### Les interdits et le contrat d'interface

**CA101** — *Étant donné* chacune des 17 lignes de RG135, *quand* le test correspondant s'exécute,
*alors* il démontre que le contenu interdit ne peut pas figurer dans un e-mail sortant.

**CA102** — *Étant donné* une charge utile contenant un champ non déclaré dans le mapping de M4,
*quand* elle est transmise, *alors* **l'envoi est refusé**, pas nettoyé silencieusement.

**CA103** — *Étant donné* un créateur, *quand* on inspecte son contact Brevo, *alors* l'attribut
d'entreprise est **vide** et ne contient jamais son nom.

**CA104** — *Étant donné* une réponse `429` de Brevo portant un en-tête de temporisation, *quand*
la file la reçoit, *alors* elle attend le délai indiqué avant de réessayer.

**CA105** — *Étant donné* une réponse `401`, *quand* elle survient, *alors* la file s'arrête,
l'alerte part immédiatement, et `marketing_paused` s'active.

**CA106** — *Étant donné* une réponse `422` sur une adresse invalide, *quand* elle survient,
*alors* **aucun réessai n'a lieu**, et la ligne part en échec définitif avec sa cause en clair.

**CA107** — *Étant donné* un webhook sans le jeton attendu, *quand* il arrive, *alors* il est
rejeté et journalisé.

**CA108** — *Étant donné* un webhook portant un horodatage vieux de 30 minutes, *quand* il arrive,
*alors* il est rejeté.

**CA109** — *Étant donné* un webhook déjà traité, *quand* il est rejoué à l'identique, *alors* il
est ignoré, sans erreur et sans second effet.

**CA110** — *Étant donné* une rotation du jeton de webhook en cours, *quand* Brevo envoie avec
l'ancienne valeur, *alors* l'événement est **accepté** pendant la fenêtre de bascule.

**CA111** — *Étant donné* la suite de tests complète, *quand* elle s'exécute, *alors* **aucun appel
réel n'atteint Brevo**, et un contrôle échoue si l'adresse de base pointe ailleurs que sur la
doublure.

**CA112** — *Étant donné* le code de l'application, *quand* on recherche les appels à Brevo,
*alors* ils sont tous dans le module d'intégration unique, et un contrôle automatisé échoue sinon.

### Langue et accessibilité

**CA113** — *Étant donné* chacun des messages de RG155, *quand* on bascule la langue, *alors* la
version existe dans les deux langues et aucune clé n'est écrite en dur.

**CA114** — *Étant donné* un membre francophone, *quand* il reçoit n'importe quel e-mail, *alors*
celui-ci est en français, quelle que soit la langue de l'agent qui a déclenché l'action.

**CA115** — *Étant donné* le compte à rebours d'annulation, *quand* un lecteur d'écran est utilisé,
*alors* le temps restant est annoncé et le bouton d'annulation est atteignable au clavier.

**CA116** — *Étant donné* n'importe quel état d'envoi, *quand* on le consulte sans distinguer les
couleurs, *alors* un **libellé écrit** le porte.

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Écran | Contenu | Point de vigilance |
|---|---|---|
| **Mes envois** | Liste, filtres, bandeau des envois en fenêtre d'annulation | Le compte à rebours doit être visible **de partout**, pas seulement ici (RG28) |
| **Nouvel envoi — source** | Trois choix, base légale écrite, plafonds restants | Une option indisponible est **désactivée avec son motif**, jamais absente |
| **Nouvel envoi — périmètre** | Facettes fermées (source 1) ou liste de segments lue en direct (source 2) | Aucune requête libre, aucun champ texte |
| **Nouvel envoi — modèle et aperçu** | Aperçu réel, dans toutes les langues du périmètre | L'aperçu doit être **affiché**, pas seulement disponible |
| **Nouvel envoi — volume et écartés** | Compteurs par motif, heure du calcul | Écartés et échecs **jamais dans le même compteur** |
| **Nouvel envoi — confirmation** | Deux gestes de nature différente, TOTP, mode dégradé annoncé | Jamais deux clics au même endroit |
| **Bandeau d'annulation** | Compte à rebours, bouton, présent sur tous les écrans | Accessible au clavier et annoncé aux lecteurs d'écran |
| **Saisie libre** | Formulaire de RG52, plafonds affichés, refus explicites | Absent hors production |
| **Résultats d'un envoi** | Agrégats horodatés, échecs par cause | Aucune liste nominative |
| **File d'envoi** | Lignes, causes en clair, rejeu unitaire et en lot | Distinguer « écarté » et « en échec » |
| **Bibliothèque de modèles** | Liste, nature, version, statut, validateur, empreinte | Un modèle en écart d'empreinte doit se voir immédiatement |
| **Interrupteur d'urgence** | Deux niveaux, motif, bandeau permanent | Doit être trouvable **en dix secondes** un jour d'incident |

### Données — **écarts constatés avec `04`, signalés et non corrigés ici**

> Conformément à la consigne, `04-modele-de-donnees-mvp.md` n'est pas modifié. Ces onze points
> relèvent d'`expert-database`.

| # | Écart | Proposition |
|---|---|---|
| 1 | `email_send_recipients` porte `unique (email_send_id, email_address)`, ce qui **impose de recopier l'adresse** pour la source 1 — alors que `matching.introduction_emails` a justement renoncé à le faire (`04` §5.6 : « ne contient ni objet, ni corps, ni adresse ») | Unicité sur `coalesce(account_id::text, lower(email_address))` ; **adresse stockée uniquement pour `manual_entry`**, où il n'existe pas de compte |
| 2 | La table suppose **une ligne par destinataire**, or pour `brevo_segment` elle reste **vide** (RG44, RG49) | `check` liant `source` et la présence de lignes ; `recipient_count` accompagné de son **origine** (`counted` / `brevo_declared`) et de son horodatage |
| 3 | **Aucun emplacement pour les deux compteurs de cadence** `LAST_MARKETING_SENT_AT` et `MARKETING_SENDS_30D` (RG80) | Deux colonnes sur `leads.contact_sync_states`, ou une vue entretenue par le worker |
| 4 | **Aucun journal pour les e-mails transactionnels hors mise en relation** : `matching.introduction_emails` ne couvre que la mise en relation, alors que RG94 et RG104 en exigent un pour tous | Table `leads.transactional_sends` (code, destinataire, langue, modèle, version, statut, `provider_message_id` unique, horodatages, cause d'échec), de même forme que `introduction_emails` |
| 5 | **Aucune bibliothèque de modèles** (RG65 à RG75) | `backoffice.email_templates` : `template_ref`, nature, version, statut, validateur, date, **empreinte du contenu validé**, variables déclarées |
| 6 | **Aucune table des segments Brevo autorisés** (RG42) | `backoffice.brevo_allowed_segments` : identifiant, nom, population, base légale, condition de cadence présente, déclarant, date |
| 7 | `email_sends.status` n'est pas la liste fermée de RG6 ; il manque `cancelled_at`, `cancelled_by_account_id`, `cancel_reason_code`, et le **volume recalculé** avec son horodatage | Ajouter, et porter les transitions dans une table de transitions comme `billing.deal_state_transitions` |
| 8 | **Aucun emplacement pour l'interrupteur d'urgence** (RG121) | Clé `email_kill_switch` dans `backoffice.operational_settings`, même régime d'écriture et de journalisation |
| 9 | La source 3 exige des champs que `email_sends` ne porte pas : pays déclaré, organisation, **code de motif et texte**, attestation | Colonnes sur `email_sends`, obligatoires **si et seulement si** `source = 'manual_entry'` (contrainte conditionnelle, dans l'esprit de `deals`) |
| 10 | `email_send_limits (role_code, source)` ne porte ni plafond **mensuel**, ni plafond **par domaine**, ni « une sollicitation par adresse » (RG54, RG55) | Trois colonnes de plus, plus un index d'unicité sur l'adresse pour `manual_entry` |
| 11 | `04` §9.1 n'a **aucune ligne de conservation** pour `email_sends` et `email_send_recipients` (RG112) | 3 ans, sur `created_at`, avec la même justification que `introduction_emails` |

### Écarts constatés avec `15-backoffice-files-et-supervision.md`

| # | Écart | Proposition |
|---|---|---|
| 1 | **Aucune file `email_send_failures`** au catalogue de `15` RG29, alors que `15` RG26 exige que toute file y figure | L'ajouter : délai 2 jours ouvrés, sans verrou, `agent` et `admin`, action de masse « rejeu en lot, plafond 200 » |
| 2 | **Sept alertes manquantes** au catalogue de `15` §F | AL42 à AL48 (RG131), à intégrer au catalogue central plutôt qu'à vivre ici |
| 3 | `15` M3 décrit l'envoi d'e-mails de masse sans préciser que **rien n'est transmis à Brevo pendant la fenêtre d'annulation**, ni que le **volume est recalculé** à sa fin | Compléter M3 avec RG28, RG30, RG31 |
| 4 | `15` RG104 ne prévoit que « destinataires par envoi et par jour » | Ajouter les plafonds mensuel, par domaine et « une sollicitation par adresse » (RG54) |
| 5 | `15` interdit 10 (« envoyer un e-mail de masse sans double confirmation ») ne cite pas le mécanisme « aucun appel sortant pendant la fenêtre », qui est ce qui rend l'annulation réelle | Le citer dans la colonne « ce qui l'empêche » |

### Écarts constatés avec la skill `brevo-campaign`

| # | Écart | Correction proposée à la skill |
|---|---|---|
| 1 | **La skill (et la règle 7 de `expert-integrations-api`) exige des webhooks à signature validée. Brevo n'en propose pas** — vérifié le 2026-09-19 : ni HMAC, ni JWT, ni en-tête de signature | Remplacer « signature validée » par les six compensations de RG146, et **soumettre l'écart à `expert-cybersecurite`** |
| 2 | La skill recommande de « séparer **si possible** les flux transactionnel et marketing » | Le rendre **obligatoire**, et passer à **trois** flux et trois sous-domaines (RG9). Depuis D37, ce n'est plus une optimisation de délivrabilité, c'est une mesure de disponibilité |
| 3 | La skill ne mentionne pas l'existence d'un **en-tête d'idempotence** chez Brevo sur l'envoi transactionnel | L'ajouter, en précisant qu'il **complète** une contrainte locale et ne la remplace pas (RG90) |
| 4 | La skill ne mentionne pas le goulot réel des limites de débit : la catégorie « autres points d'accès », ~100 requêtes/heure, qui porte la création de campagne | L'ajouter : c'est ce qui interdit une campagne par destinataire (RG48, M2) |
| 5 | La skill ne prévoit **ni liste fermée de segments autorisés**, ni **liste d'exclusion jointe à tout envoi de source 2** | Les ajouter (RG42, RG45) : sans elles, n'importe quel segment improvisé chez Brevo devient envoyable en deux clics |
| 6 | La skill ne prévoit **aucun interrupteur d'urgence** | L'ajouter (RG121 à RG124), avec la règle « le code de connexion n'est jamais coupé » |
| 7 | La skill s'arrête au « bandeau d'environnement » ; elle ne prévoit pas de **refus de démarrage** | L'ajouter (RG116) : un avertissement se lit une fois puis s'ignore |
| 8 | La skill ne tranche pas le **suivi nominatif des ouvertures** | Trancher : agrégat par défaut, nominatif par exception (RG107) |

### Intégrations

- **Brevo** — huit opérations (M1), trois catégories de limites (M2), un webhook non signé et
  compensé (M6), un mapping fermé de 17 attributs (M4). Clé côté serveur uniquement.
- **Apollo.io** — **hors de ce document**, entièrement. Aucun contenu, aucun résultat, aucune
  donnée enrichie ne circule entre les deux (`05` RG85).
- **File d'événements** (`leads.outbox_events`, **D18**) — porte les envois P1 et P2. Le P0 a son
  chemin dédié (RG86).
- **Registre d'audit** — reçoit les faits : envoi confirmé, annulé, bloqué, interrupteur actionné,
  modèle validé ou retiré, plafond modifié, saisie libre effectuée.

### Indicateurs à suivre

| Indicateur | Pourquoi |
|---|---|
| **Délai médian et p90 de délivrance du code de connexion** | **C'est la disponibilité du produit** (D37). Le premier à instrumenter |
| Part des demandes de code sans connexion aboutie sous 10 minutes | Mesure ce que la médiane cache |
| Taux de plainte et de rebond dur, **par flux** | La séparation en trois sous-domaines n'a de valeur que si on la mesure séparément |
| Désinscriptions par envoi et par segment | Un segment qui fait fuir se repère en deux envois |
| Nombre d'écartés pour cadence | Si le chiffre est élevé, le plan d'envoi est trop dense, pas la règle trop stricte |
| Consommation des plafonds de saisie libre, par agent | Le signal avancé d'une dérive vers la prospection de masse |
| Écart entre « transmis » et « délivré » | Dit si l'on envoie vraiment, ou si l'on croit envoyer |
| Envois annulés dans la fenêtre, et leur motif | Si le chiffre monte, le parcours de préparation est mauvais, pas les agents |
| Envois bloqués par écart de volume | Dit si le seuil de RG31 est bien réglé |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| **Envoi programmé à une date future** | La fenêtre d'annulation et le recalcul supposent un envoi imminent. Programmer à J+3 rendrait le consentement vérifié à J+0 caduc | Après le pilote, avec un recalcul à l'heure d'envoi |
| **Relance de prospection** | Double le risque juridique pour un gain marginal (RG55) | **D35**, jamais avant |
| **Import de fichier d'adresses**, sous quelque forme | C'est l'exact contraire de A4 | Jamais |
| **Éditeur de contenu dans le backoffice** | Le contenu marketing vit chez Brevo (RG67) ; le transactionnel vit dans le dépôt | Non planifié |
| **Test A/B, envoi au meilleur moment, optimisation d'objet** | Confort marketing, sans effet sur le pilote | Après le pilote |
| **SMS, notification poussée, messagerie tierce** | Aucun canal autre que l'e-mail au MVP (`12` RG100) | Après le pilote |
| **Suivi nominatif des ouvertures et des clics** (sources 1 et 2) | Décision de RG107, à confirmer par `expert-conformite-rgpd` | Sur demande motivée d'`expert-marketing` |
| **Scoring d'engagement, segmentation automatique** | Aucune donnée pour le régler, et **D11** a déjà repoussé le scoring | Après le pilote |
| **Envoi depuis l'espace membre** (une marque écrivant à un créateur par e-mail) | Contournement direct du modèle économique | Jamais |
| **Réponse entrante traitée comme un message** | Aucune adresse de réponse fonctionnelle (RG97) | Non planifié |
| **Réplication d'un segment Brevo dans INFLUX** | Créerait une seconde base de contacts avec sa propre obligation d'information (RG44) | Jamais |
| **Export de destinataires** | `03` C(17), interdiction générale | Jamais |

---

## Questions ouvertes

| # | Question | Position d'attente retenue dans ce document | Arbitre |
|---|---|---|---|
| **Q1** | **D35 — plafonds exacts de la saisie libre, définition d'« adresse professionnelle », rôle habilité.** Les valeurs de RG53 et RG54 sont des propositions conservatrices | 10/jour (`agent`), 20/jour (`admin`), 50/mois, 3 par domaine sur 90 j, **une sollicitation par adresse, aucune relance** ; liste de domaines grand public en configuration | **`expert-conformite-rgpd` (veto)** + **Fondateur** |
| **Q2** | **Légalité de la prospection, pays par pays** (intérêt légitime encadré dans l'UE, CASL au Canada, régimes des États américains, LGPD) | **Liste vide par défaut** : tant qu'aucun pays n'est validé, **la saisie libre est inutilisable** (RG51) | **`expert-conformite-rgpd` (veto)** + juriste |
| **Q3** | **Absence de signature des webhooks Brevo** (RG146). Les six compensations proposées suffisent-elles, ou faut-il un relais signé intermédiaire ? | Jeton en en-tête + plages d'adresses + fenêtre d'horodatage + idempotence + revérification des preuves | **`expert-cybersecurite` (veto)** |
| **Q4** | **Suivi nominatif des ouvertures et des clics** pour les sources 1 et 2 : le refuser est-il tenable pour le marketing, et le permettre est-il justifiable ? | **Agrégat seul** (RG107) | **`expert-conformite-rgpd` (veto)** + `expert-marketing` |
| **Q5** | **Durées de conservation** du journal d'envoi, des agrégats et du journal nominatif de la saisie libre | 3 ans pour les trois (RG61, RG112) | `expert-conformite-rgpd` + `expert-database` |
| **Q6** | **Valeurs de cadence** : 2 / 7 j, 6 / 30 j, 48 h sont-elles les bonnes pour une base jeune et peu sollicitée ? | Les valeurs de RG77, en configuration | `expert-marketing` + `expert-conformite-rgpd` |
| **Q7** | **Seuils de déclenchement automatique de l'interrupteur** : 0,3 % de plainte, 5 % de rebond | Valeurs de RG123, à recaler après quatre semaines | `expert-integrations-api` + `admin`, avec les données réelles |
| **Q8** | **Que faire si le flux transactionnel lui-même est dégradé** (domaine bloqué, incident fournisseur) ? Faut-il un **second prestataire d'envoi de secours** pour le seul code de connexion ? | Aucun secours au MVP — **limite assumée et écrite** (RG122) | **Fondateur** + `architecte` |
| **Q9** | **Codes des sept nouvelles alertes** (AL42 à AL48) et de la file `email_send_failures` : les intégrer au catalogue central de `15` | Codes proposés ici, à confirmer | `product-owner` + `chef-de-projet` |
| **Q10** | **Facturation des envois Brevo** : le palier du compte détermine les limites de débit (M2) et donc la faisabilité d'un envoi de masse dans la journée | Limites lues en configuration, affichées, jamais supposées | **Fondateur** (choix de l'offre Brevo) |
| **Q11** | **Langue du backoffice** (**D36**) : le français est la valeur d'attente, mais les **messages aux membres** sont bilingues dès le premier jour | RG151 | **Fondateur** |
| **Q12** | **Liste fermée des facettes de segmentation** de la source 1 : laquelle exactement, et qui l'étend ? | Proposition de RG17, à compléter | `expert-marketing` + `product-owner` |
| **Q13** | **Sous-domaines d'envoi** : les trois noms proposés (`tx.`, `news.`, `pro.`) et leur authentification, à confirmer avec le nom de domaine retenu | RG9 | `integrateur` + **Fondateur** |

---

> **Une dernière phrase, pour le relecteur pressé.** Si l'on ne devait retenir que deux choses de ce
> document : **le code de connexion ne partage son domaine d'envoi avec rien**, et **rien n'est
> transmis à Brevo pendant la fenêtre d'annulation**. Le reste protège des erreurs ; ces deux
> règles-là protègent du désastre.
