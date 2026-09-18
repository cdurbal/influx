# Lot 1 — Inscription, connexion et pipeline de leads

> **Date :** 2026-09-18 · **Auteur :** agent `product-owner` · **Statut :** spécification complète du
> Lot 1, soumise à la validation de `chef-de-projet`, avec **avis obligatoire (veto) de
> `expert-conformite-rgpd`** sur les §Consentement, §Pipeline et §Questions ouvertes.
>
> **Skills appliquées :** `feature-spec` (format de sortie), `lead-pipeline`, `brevo-campaign`,
> `apollo-lead-sync`.
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité), `docs/mvp/00-cadrage-mvp-v2.md`
> (périmètre, lots, arbitrages A1 à A10), `docs/mvp/02-architecture-3-espaces.md` §7 (D37),
> `docs/mvp/03-matrice-des-droits-et-rls.md` §6.1 (conditions A-1 à A-12),
> `docs/mvp/04-modele-de-donnees-mvp.md` §5.1 et §5.8 (tables des Lots 0 et 1),
> `docs/landing-page/02-ux-wireframes.md` §3.18 (formulaire de la maquette).
>
> **Ce que ce document tranche :** les champs exacts des deux inscriptions, le comportement du
> consentement, la connexion par code, le routage, les événements du pipeline de leads, les
> désinscriptions dans les deux sens, le backoffice v0 et tous les états d'écran.
>
> **Ce qu'il ne tranche pas :** la maquette et la microcopie (`expert-ux`, `expert-marketing`), le
> texte juridique des CGU (juriste), les contrats d'API Brevo et Apollo (`expert-integrations-api`),
> le schéma SQL (`expert-database`), les politiques d'accès (`expert-cybersecurite`).
>
> **Invariant rappelé :** aucun montant, aucun taux, aucun calcul de commission n'existe dans ce
> périmètre (arbitrage A1). Une spécification du Lot 1 qui manipule un montant est fausse.

---

## Besoin

**Permettre à n'importe qui, partout dans le monde, de créer en moins d'une minute un compte INFLUX
réel — annonceur ou créateur — et de s'y reconnecter sans mot de passe, en faisant de chaque
inscription un contact vivant dans Brevo et, quand c'est autorisé, un prospect dans Apollo, sans
qu'une panne d'un service externe n'empêche jamais quelqu'un de s'inscrire.**

Trois raisons d'être, dans cet ordre :

1. **Commerciale.** Un lead qui n'arrive pas dans Brevo et Apollo est un lead perdu (`CLAUDE.md` §3).
   C'est le second pilier du modèle économique, et au Lot 1 c'est le seul qui produise de la valeur.
2. **Produit.** Sans compte réel, aucun des lots suivants n'existe : ni profil, ni campagne, ni mise
   en relation courtée.
3. **Juridique.** C'est à l'inscription que se constitue la preuve d'acceptation des CGU — donc de la
   **clause de non-contournement posée dès le jour 1** (A5). Une inscription sans version de CGU
   enregistrée est un droit perdu pour toujours, qu'aucune correction rétroactive ne rattrape.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Visiteur annonceur** (marque, e-commerçant, PME) | Crée un compte depuis la porte annonceur, se reconnecte, gère son consentement, ses données |
| **Visiteur créateur** (influenceur majeur, particulier ou professionnel) | Crée un compte depuis la porte créateur, se reconnecte, gère son consentement, ses données |
| **Commercial INFLUX** (rôle `agent`) | Consulte la liste des inscrits, lit l'état de synchronisation et sa cause, rejoue les échecs, corrige une déclaration |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, plus : changement de rôle d'un compte, correction d'une adresse injoignable, bascule du périmètre Apollo, export |
| **Système — pipeline de leads** | Émet les événements, les consomme vers Brevo et Apollo, réessaie, journalise |
| **Système — service d'envoi d'e-mails** | Délivre le code de connexion et les e-mails transactionnels. **Sa disponibilité est la disponibilité du produit** |
| **Brevo** (externe) | Base de contacts, scénarios de nurturing, envoi transactionnel, retour des désinscriptions et des plaintes |
| **Apollo.io** (externe) | Prospection commerciale sortante, dans le périmètre autorisé par la configuration |

> **Deux populations, deux parcours.** Aucun écran de ce lot ne sert les deux populations avec le
> même vocabulaire. Deux portes, deux formulaires, deux libellés de consentement, deux e-mails de
> bienvenue, deux espaces après connexion.

---

## User stories

### Inscription

- **US1** — En tant que **visiteur annonceur**, je veux créer un compte en donnant mon e-mail, le nom
  de mon entreprise, mon pays et ma langue, afin d'entrer dans INFLUX sans remplir un dossier.
- **US2** — En tant que **visiteur créateur**, je veux créer un compte en donnant mon e-mail, mon
  pays, ma langue, mon statut et en attestant ma majorité, afin de ne fournir mon profil détaillé que
  plus tard, quand j'aurai vu ce que la plateforme m'apporte.
- **US3** — En tant que **visiteur**, je veux accepter les conditions générales en une case claire et
  savoir ce que j'accepte, afin de ne pas découvrir plus tard une obligation que j'ignorais.
- **US4** — En tant que **visiteur**, je veux choisir librement de recevoir ou non des e-mails
  commerciaux, afin que mon inscription ne vaille pas autorisation de me démarcher.
- **US5** — En tant que **visiteur créateur**, je veux déclarer si j'agis en particulier ou en
  professionnel, afin d'être traité selon ma situation réelle.

### Connexion

- **US6** — En tant que **membre**, je veux me reconnecter en recevant un code à 6 chiffres par
  e-mail, afin de ne pas avoir de mot de passe à retenir ni à réinitialiser.
- **US7** — En tant que **membre sur mobile**, je veux retaper le code dans l'onglet où j'ai
  commencé, afin de ne pas être renvoyé dans un autre navigateur au milieu de mon parcours.
- **US8** — En tant que **membre qui ne reçoit pas le code**, je veux comprendre pourquoi et savoir
  quoi faire, afin de ne pas rester bloqué à la porte de mon propre compte.
- **US9** — En tant que **membre**, je veux être prévenu d'une connexion depuis un appareil inconnu
  et pouvoir fermer toutes mes sessions, afin de reprendre la main si ma boîte e-mail a été lue par
  quelqu'un d'autre.

### Maîtrise de ses données

- **US10** — En tant que **membre**, je veux retirer mon consentement en une action et voir sa date
  et son origine, afin de garder le contrôle sans écrire à personne.
- **US11** — En tant que **membre**, je veux changer mon adresse e-mail en confirmant depuis
  l'ancienne et la nouvelle, afin que personne ne puisse s'approprier mon compte avec un accès
  passager à ma boîte.

### Backoffice

- **US12** — En tant que **commercial**, je veux voir les inscrits du jour avec leur état de
  synchronisation Brevo et Apollo, afin de savoir en un coup d'œil si la machine commerciale tourne.
- **US13** — En tant que **commercial**, je veux comprendre en français la cause d'un échec de
  synchronisation, afin de décider si je rejoue ou si j'alerte.
- **US14** — En tant que **commercial**, je veux rejouer une synchronisation, à l'unité ou en lot,
  afin qu'aucun lead ne reste perdu après un incident.
- **US15** — En tant que **commercial**, je veux distinguer un échec d'un cas normal (sans
  consentement, hors périmètre Apollo), afin de ne pas traiter comme une panne ce qui est une règle.
- **US16** — En tant qu'**administrateur**, je veux modifier le périmètre Apollo sans redéploiement,
  afin d'appliquer immédiatement la décision du juriste, dans un sens comme dans l'autre.

### Système

- **US17** — En tant que **système**, je veux confirmer l'inscription avant tout appel à un service
  externe, afin qu'une panne de Brevo ou d'Apollo n'empêche jamais quelqu'un de s'inscrire.
- **US18** — En tant que **système**, je veux traiter un retrait de consentement avant tout le reste
  de la file, afin qu'un retard ne devienne pas un manquement légal.

---

## Règles de gestion

### A — Parcours général et portes d'entrée

**RG1** — Deux portes d'inscription existent, distinctes de bout en bout : **annonceur** et
**créateur**. Elles ont chacune leur adresse de page, leur titre, leur vocabulaire, leur jeu de
champs, leur libellé de consentement, leur e-mail de bienvenue et leur espace après connexion. Aucun
écran ne présente les deux jeux de champs simultanément.

**RG2** — Il n'existe **qu'un seul parcours** pour s'inscrire et pour se connecter, en trois écrans :
**(1)** adresse e-mail → **(2)** code à 6 chiffres → **(3)** informations complémentaires. L'écran 3
n'est présenté que si l'adresse vérifiée ne correspond à aucun compte. Aucun écran distinct « se
connecter » n'est proposé.

**RG3** — Le profil (annonceur ou créateur) est choisi **avant** l'écran 1, soit par la page d'arrivée
(deux adresses distinctes), soit par une étape de choix explicite. Il est rappelé à l'écran 3 et y
reste modifiable jusqu'à la création du compte.

**RG4** — Tout changement de profil **décoche la case de consentement marketing** et efface les champs
propres au profil abandonné. Un accord donné sous un libellé ne vaut pas sous un autre.

**RG5** — Aucun compte INFLUX n'existe tant que l'écran 3 n'a pas été validé. Un abandon avant cette
validation ne crée ni compte, ni rôle, ni acceptation de CGU, ni consentement, ni lead, et ne
déclenche aucun envoi vers Brevo ou Apollo.

**RG6** — La mention d'information sur les données personnelles — finalités, destinataires **nommés**
(Brevo, Apollo.io), droits des personnes, lien vers la politique de confidentialité — est visible dès
**l'écran 1**, au moment où l'adresse e-mail est demandée, et pas seulement à l'écran 3.

**RG7** — La création du compte est **une seule transaction** : compte, rôle unique, acceptation de
CGU, événements de consentement, attestation de majorité, statut déclaré et événements du pipeline
sont écrits ensemble ou pas du tout. Aucun compte à moitié créé ne peut exister.

**RG8** — L'inscription est ouverte depuis **tous les pays** de la liste ISO 3166-1 (249 codes,
`apps/web/src/content/country-codes.ts`). Une **liste de pays bloqués**, lue en configuration et
**vide par défaut**, permet de refuser une inscription sans redéploiement ; un refus affiche un
message neutre, ne crée aucun compte et est journalisé.

**RG9** — Aucun écran, aucun e-mail et aucune donnée de ce périmètre ne contient de montant, de taux,
de commission ou de net créateur (A1). Les explications du modèle économique restent un contenu
éditorial des pages publiques.

**RG10** — Toute saisie est validée **côté serveur** avec exactement les mêmes règles que côté
navigateur. La validation dans le navigateur est un confort ; elle n'est jamais la seule.

### B — Champs de l'inscription annonceur

**RG11** — L'inscription annonceur comporte **exactement** ces champs, dans cet ordre :

| Écran | Champ | Obligatoire | Contrôle | Règle de validation |
|---|---|---|---|---|
| 1 | Adresse e-mail | Oui | Champ e-mail | Non vide ; forme `x@y.z` ; 254 caractères maximum |
| 3 | Nom de l'entreprise | Oui | Texte, 120 caractères maximum | Non vide hors espaces, 2 caractères minimum |
| 3 | Pays de l'entreprise | Oui | Liste déroulante, première option vide | Une valeur de la liste ISO 3166-1 |
| 3 | Langue de communication | Oui | Deux choix exclusifs (français, anglais) | Présélection = langue de la page, modifiable |
| 3 | Acceptation des CGU | Oui | Case à cocher, **non pré-cochée** | Cochée |
| 3 | Consentement marketing | **Non** | Case à cocher, **non pré-cochée** | Aucune |

**RG12** — L'adresse e-mail est normalisée avant enregistrement : espaces de début et de fin retirés,
passage en minuscules. **Aucune autre normalisation** n'est appliquée : les sous-adresses (`nom+mot@…`)
et les points ne sont pas retirés, car deux adresses distinctes appartiennent parfois à deux personnes
distinctes. Aucune adresse n'est refusée sur la base de son domaine : une liste de domaines jetables
produit des faux positifs et bloque de vrais inscrits ; les adresses non délivrables se révèlent au
premier rebond.

**RG13** — Le nom de l'entreprise est conservé tel que saisi (casse comprise), borné à 120 caractères.
Il n'est pas vérifié auprès d'un registre au Lot 1.

**RG14** — La liste des pays affiche **tous** les pays, dans la langue de la page, triés
alphabétiquement selon cette langue, **aucun n'étant marqué comme « ouvert aux contrats »** (D26 non
tranchée, et aucun contrat n'existe dans l'application au MVP). Une information neutre rappelle que
l'inscription est mondiale et que les mises en relation s'ouvrent progressivement, **sans promesse de
date ni liste de pays**.

**RG15** — La langue de communication détermine la langue de tous les e-mails et de l'interface après
connexion. Elle est modifiable à tout moment depuis l'espace membre, et toute modification émet un
événement `lead.updated`.

**RG16** — Sont **volontairement absents** de l'inscription annonceur, et le restent : mot de passe
(D37), téléphone, nom et prénom du contact, site web, secteur, taille d'entreprise, budget indicatif,
objectifs. Le téléphone et le site web sont des **vecteurs de contournement** (ils permettent de
joindre une partie hors plateforme) ; le reste relève du profil, donc du Lot 2. Chaque champ ajouté
ici coûte des inscriptions.

### C — Champs de l'inscription créateur

**RG17** — L'inscription créateur comporte **exactement** ces champs, dans cet ordre :

| Écran | Champ | Obligatoire | Contrôle | Règle de validation |
|---|---|---|---|---|
| 1 | Adresse e-mail | Oui | Champ e-mail | Identique à RG11 |
| 3 | Pays de résidence | Oui | Liste déroulante, première option vide | Une valeur de la liste ISO 3166-1 |
| 3 | Langue de communication | Oui | Deux choix exclusifs | Présélection = langue de la page |
| 3 | Statut déclaré | Oui | Deux choix exclusifs, **aucun pré-sélectionné** | `particulier` ou `professionnel` |
| 3 | Attestation de majorité | Oui | Case à cocher, **non pré-cochée** | Cochée |
| 3 | Acceptation des CGU | Oui | Case à cocher, **non pré-cochée** | Cochée |
| 3 | Consentement marketing | **Non** | Case à cocher, **non pré-cochée** | Aucune |

**RG18** — Le **statut déclaré** (particulier / professionnel) est **obligatoire** et sans valeur
pré-sélectionnée. Il conditionne le périmètre de synchronisation Apollo (RG81) : sans lui, la position
d'attente conservatrice de D33 devient inapplicable et la décision se referme d'elle-même. Le libellé
du choix « professionnel » cite des exemples concrets (société, entreprise individuelle, agence) ; le
choix ne demande **ni numéro d'immatriculation, ni justificatif** au Lot 1.

**RG19** — L'attestation de majorité est une case obligatoire, non pré-cochée, dont le libellé
**renvoie à l'âge de la majorité dans le pays de résidence déclaré** et non à un âge fixe. Son aide
indique que les mineurs sont exclus de la plateforme (D15).

**RG20** — L'attestation est enregistrée avec **sa date et son heure**. Une attestation sans date n'a
aucune valeur : les deux informations vont ensemble ou aucune des deux.

**RG21** — Sont **volontairement absents** de l'inscription créateur, et le restent : mot de passe,
pseudonyme, identifiant `@`, lien de réseau social, nombre d'abonnés, tarifs, téléphone, nom légal,
date de naissance. Les quatre premiers sont des **données identifiantes** dont la protection est le
cœur de l'anonymisation (A2, D16) : les demander à l'inscription reviendrait à les collecter avant
d'avoir la moindre règle d'accès pour les protéger. Le reste relève du Lot 2.

**RG22** — Un compte annonceur est enregistré avec le statut **professionnel** par construction : le
nom d'entreprise est obligatoire. Aucun champ de statut n'est donc demandé côté annonceur (voir Q11).

### D — Conditions générales et versions

**RG23** — L'acceptation des CGU est une case à cocher **obligatoire**, **non pré-cochée**, **distincte
et jamais fusionnée** avec le consentement marketing. Cocher l'une ne coche jamais l'autre.

**RG24** — Chaque acceptation enregistre : **qui** (le compte), **quelle version** (identifiant de la
version des CGU), **l'empreinte du texte exact** présenté, **quand** (date et heure), **par quel
moyen** (`inscription`), **dans quelle langue**, et — sous réserve de Q5 — l'adresse IP et le
navigateur. Une acceptation n'est jamais modifiée ni supprimée : elle est complétée par une nouvelle.

**RG25** — La version présentée est la version **en vigueur** du document dans la **langue choisie**.
Si aucune version n'est publiée dans cette langue, la version anglaise est présentée et c'est **la
langue réellement affichée** qui est enregistrée, jamais la langue souhaitée.

**RG26** — Les CGU présentées à l'inscription portent la **clause de non-contournement dès la première
mise en ligne** (A5). Aucune interface, aucun e-mail et aucun message du produit ne la met en avant ni
ne la brandit pendant le pilote : elle vit dans le texte des CGU, et nulle part ailleurs.

**RG27** — Les documents (CGU, politique de confidentialité, politique cookies, mentions légales) sont
consultables **en français et en anglais**, **avant** d'accepter et **sans être connecté**.

**RG28** — Lorsqu'une nouvelle version des CGU entre en vigueur, une **ré-acceptation** est demandée à
la connexion suivante. Elle est bloquante pour l'usage du service, et enregistrée avec le moyen
`ré-acceptation`. Refuser déconnecte la personne sans supprimer son compte ni ses données, et
l'information reste consultable dans le backoffice.

**RG29** — Aucune inscription n'est enregistrée sans acceptation de CGU. S'il devenait techniquement
possible de créer un compte sans elle (import, correction manuelle, script), ce serait un défaut
bloquant : c'est la preuve qui fonde la rémunération d'INFLUX.

### E — Consentement marketing

**RG30** — Le consentement marketing est **facultatif**, matérialisé par une case **non pré-cochée**,
séparée visuellement de l'acceptation des CGU, et explicitement marquée facultative. Refuser n'empêche
jamais de créer un compte ni d'utiliser le service.

**RG31** — Le libellé du consentement est **propre à chaque porte** (un libellé annonceur, un libellé
créateur) et cite **nommément Brevo et Apollo.io** ainsi que les deux finalités : **envoi d'e-mails
commerciaux** et **prospection commerciale**. Les deux finalités sont citées **dans les deux portes**,
quelle que soit la valeur courante du périmètre Apollo : faire dépendre le libellé d'un drapeau
modifiable obligerait à redemander leur accord à tous les inscrits le jour où le drapeau change.

**RG32** — Le consentement est enregistré comme un **événement daté**, jamais comme un simple
indicateur sur le compte : valeur (accordé ou retiré), finalité, source (`formulaire d'inscription`),
date et heure, langue, et copie du **libellé exact** présenté. La réponse à « qu'est-ce qui était vrai
le 14 mars ? » doit toujours être lisible.

**RG33** — Une seule case est présentée, mais **deux événements** sont enregistrés, un par finalité
(`e-mail marketing` et `prospection commerciale`), avec la même date et la même preuve. Cela permet de
séparer les deux finalités plus tard sans redemander leur accord aux inscrits. **Q10 est ouverte** :
si `expert-conformite-rgpd` exige deux cases, seule la présentation change, pas l'enregistrement.

**RG34** — Le consentement est retirable **à tout moment**, en **une seule action**, depuis l'espace
membre, sans justification et sans contacter personne. Le retrait prend effet **immédiatement dans
INFLUX**, avant même sa propagation vers Brevo et Apollo.

**RG35** — Le retrait du consentement **n'affecte jamais les e-mails transactionnels**, à commencer
par le **code de connexion**. Un retrait de consentement qui empêcherait quelqu'un de se connecter
serait un défaut bloquant. Réciproquement, aucun contenu promotionnel ne s'invite dans un e-mail
transactionnel.

**RG36** — L'absence de consentement n'est **pas une erreur** : c'est un cas normal. L'événement de
synchronisation correspondant est marqué **« ignoré »** avec le motif « sans consentement », et
n'apparaît jamais dans la liste des échecs à traiter.

**RG37** — Le consentement est **relu en base au moment de la consommation** de chaque événement,
jamais au moment de son émission : entre les deux, il a pu être retiré.

**RG38** — Aucun e-mail marketing, aucune entrée en scénario de nurturing et aucune séquence de
prospection ne sont déclenchés avant que le consentement correspondant soit enregistré en base.

### F — Connexion par code à 6 chiffres

**RG39** — Le code comporte **6 chiffres**, tirés d'une source aléatoire cryptographique. Il n'est
jamais dérivé de l'adresse, de l'identifiant du compte, de l'heure ni d'une séquence.

**RG40** — Un code est valide **10 minutes** à compter de sa génération.

**RG41** — **Un seul code est valide à la fois par adresse.** Toute génération d'un nouveau code
invalide immédiatement le précédent.

**RG42** — Un code accepte **5 tentatives de saisie**. Au-delà, **le code** est invalidé — **jamais le
compte**. La personne doit demander un nouveau code.

**RG43** — Un code est à **usage unique** : il est invalidé dès qu'une vérification réussit.

**RG44** — La demande de code est limitée en débit à trois niveaux : **par adresse** (3 demandes par
15 minutes, 10 par heure), **par adresse IP** (20 demandes et 20 échecs de vérification par heure), et
par **surveillance globale** du taux d'échec de vérification, qui déclenche une alerte au backoffice.

**RG45** — Un dépassement de plafond **n'invalide jamais le code en cours** et ne bloque jamais un
compte : il empêche seulement l'envoi d'un nouveau code. Le blocage doit viser l'attaquant, jamais la
victime — sinon demander des codes en boucle suffirait à empêcher quelqu'un de se connecter.

**RG46** — La réponse à une demande de code est **strictement identique**, en contenu **et en durée**,
que l'adresse corresponde ou non à un compte existant. La durée est normalisée par un plancher
constant. Aucun message, aucun code d'erreur, aucune différence de temps ne permet de savoir si une
adresse est inscrite.

**RG47** — Le code n'est acceptable que **dans le parcours qui l'a demandé**, identifié par un cookie
de parcours d'une durée de 15 minutes. Un code saisi dans un autre navigateur est refusé **sans
indiquer s'il était correct**. Conséquence assumée, à rendre visible par `expert-ux` : fermer l'onglet
oblige à redemander un code.

**RG48** — L'écran de saisie du code affiche une **phrase de correspondance de deux ou trois mots**,
reprise à l'identique dans l'e-mail, tirée d'une liste fermée bilingue de mots neutres. Elle permet de
détecter un site contrefait qui aurait déclenché un vrai envoi.

**RG49** — L'e-mail contenant le code : ne porte **jamais le code dans son objet** ; ne contient
**aucun lien de connexion** ; indique l'heure de la demande et le contexte (navigateur, pays
approximatif) ; porte la mention **« INFLUX ne vous demandera jamais ce code »** ; existe en français
et en anglais et part dans la langue de la page où la demande a été faite (ou du compte, s'il existe).

**RG50** — Un nouveau code peut être demandé après **60 secondes**, avec un compte à rebours visible et
annoncé aux lecteurs d'écran. Au-delà du plafond de RG44, l'écran affiche « vous avez demandé plusieurs
codes, utilisez le dernier reçu », **sans envoyer de nouveau code et sans invalider le code en cours**.

**RG51** — Une action « modifier mon adresse » ramène à l'écran 1 en conservant le profil choisi. Le
code déjà envoyé reste valide pour l'adresse à laquelle il a été envoyé jusqu'à son expiration, et
**ne peut jamais être utilisé pour une autre adresse** : un code est lié à une adresse et à une
demande.

**RG52** — Le code **n'est jamais visible** : ni dans le backoffice, ni dans les journaux, ni dans les
traces d'erreur, ni dans les exports, ni dans une réponse d'API. Seul son **cycle de vie** est visible
(demandé, envoyé, délivré, consommé, expiré, invalidé). Un agent capable de lire un code valide
pourrait prendre le contrôle de n'importe quel compte.

**RG53** — L'adresse est **réputée vérifiée** à la première vérification réussie d'un code. Il n'existe
**aucune étape supplémentaire « confirmez votre e-mail »** : le code prouve l'adresse par construction.
La date de vérification est enregistrée.

**RG54** — La session membre dure **30 jours glissants**, portée par un identifiant opaque en cookie
`httpOnly` ; elle est **révocable immédiatement** et l'est effectivement en cas de suspension du
compte ou de déconnexion globale.

**RG55** — Une connexion réussie depuis un navigateur inconnu déclenche un **e-mail transactionnel de
notification** (date, heure, pays approximatif, navigateur), avec la marche à suivre en cas de doute.

**RG56** — L'espace membre expose une page **« mes sessions »** listant les sessions actives (date de
création, dernière activité, pays approximatif, navigateur) et un bouton **« fermer toutes les
sessions »**.

**RG57** — Trois actions exigent une **re-authentification par un nouveau code** : changer d'adresse
e-mail, exporter ses données, supprimer son compte.

**RG58** — Le changement d'adresse e-mail exige une **confirmation depuis l'ancienne adresse et depuis
la nouvelle**. Tant que les deux ne sont pas confirmées dans un délai de **24 heures**, l'adresse de
connexion reste l'ancienne. Une fois le changement effectif, les deux adresses sont notifiées et un
événement `email.changed` est émis.

### G — L'e-mail qui n'arrive pas

> Un code qui n'arrive pas n'est pas une gêne : **c'est l'impossibilité de se connecter**. Sans mot de
> passe, il n'existe aucune autre porte. Les règles qui suivent traitent ce cas comme une panne de
> service, pas comme un incident d'affichage.

**RG59** — L'e-mail portant le code est **transactionnel**, émis par un **flux séparé du flux
marketing** chez le fournisseur d'envoi, et **prioritaire sur tout autre envoi**. Il n'entre dans
aucune file partagée avec les synchronisations de contacts.

**RG60** — Un échec d'envoi est classé en **trois causes distinctes**, chacune avec son message : (a)
**adresse non délivrable** (rebond dur), (b) **service d'envoi indisponible**, (c) **plafond de
demandes atteint**. Un message générique unique serait ici une faute : il laisserait la personne
essayer indéfiniment.

**RG61** — Un rebond dur marque l'adresse **injoignable**, affiche à l'écran un message invitant à
vérifier l'adresse ou à en utiliser une autre, et crée une entrée dans la file backoffice « adresses
injoignables ».

**RG62** — Un compte dont l'adresse est devenue injoignable ne peut plus se connecter. **Seul un
administrateur** peut corriger cette adresse, avec re-authentification, **motif obligatoire**,
journalisation nominative et notification à l'ancienne comme à la nouvelle adresse. La procédure de
vérification d'identité préalable est ouverte (**Q8**) : tant qu'elle n'est pas tranchée, la
correction est possible mais **chaque correction est signalée comme événement sensible** dans le
registre.

**RG63** — Quatre indicateurs de délivrabilité sont mesurés dès le premier jour : délai médian entre
demande et délivrance, taux de demandes **sans connexion aboutie dans les 10 minutes**, taux de rebond
dur, taux de plainte. Les seuils d'alerte sont ceux de D37 : **délai médian supérieur à 60 secondes**
ou **plus de 15 % de demandes sans connexion aboutie**.

**RG64** — Si le service d'envoi est indisponible, l'écran l'annonce explicitement, **conserve la
saisie**, propose de réessayer, et n'affiche jamais un faux succès. Aucun compte n'est créé à moitié.

**RG65** — Un **canal de secours accessible sans connexion** (formulaire de contact, depuis une autre
adresse) permet de signaler une impossibilité de recevoir le code. Il alimente une file backoffice.
Il ne permet **jamais** d'obtenir un code, d'ouvrir une session ni de contourner une vérification, et
il ne met **jamais** deux membres en relation.

### H — Routage et rôles après vérification

**RG66** — Après une vérification réussie, le routage suit **le rôle réel du compte**, jamais la porte
par laquelle la personne est arrivée : rôle annonceur → espace marque, rôle créateur → espace
créateur.

**RG67** — Si l'adresse correspond à un compte d'un **autre rôle** que la porte empruntée, la session
est ouverte, la personne est routée vers l'espace de son rôle réel, et un message explique qu'un
compte INFLUX porte **un seul rôle** (D41) et qu'un second compte exige une autre adresse. Ce message
n'apparaît **jamais avant** la vérification du code.

**RG68** — Une adresse portant un **rôle interne** (`agent` ou `admin`) suit exactement le même
parcours jusqu'à la vérification, puis **aucune session membre n'est ouverte** : un message renvoie
vers l'espace interne, qui a son propre hôte et son propre mode de connexion (mot de passe + second
facteur). Traiter ce cas plus tôt réintroduirait l'énumération de comptes.

**RG69** — Un compte **suspendu** suit le même parcours jusqu'à la vérification, puis n'ouvre aucune
session : un message neutre invite à contacter INFLUX. Les sessions existantes sont révoquées
immédiatement au moment de la suspension.

**RG70** — L'adresse d'un compte **supprimé ou anonymisé** est traitée comme inconnue. Une nouvelle
inscription avec la même adresse crée un **compte entièrement nouveau**, sans aucun lien visible avec
l'ancien, dont le registre de preuve conserve malgré tout la trace sous forme pseudonyme.

**RG71** — L'espace membre du Lot 1 contient **exactement** : un accueil qui annonce ce qui arrive
(profil au Lot 2), « mes informations » (adresse, pays, langue, statut déclaré, entreprise), « mes
préférences de communication » (consentement, sa date, sa source), « mes données » (export,
suppression), « mes sessions », et la déconnexion. Tout le reste appartient aux lots suivants.

### I — Pipeline de leads

**RG72** — **Une inscription ne doit jamais échouer parce qu'un service externe est indisponible.** La
réponse à l'utilisateur est donnée dès que la base a enregistré le compte ; aucun appel à Brevo ou
Apollo n'est effectué dans cette transaction. Une panne totale de Brevo et d'Apollo n'a **aucun effet
visible** sur le parcours d'inscription.

**RG73** — Les événements suivants sont émis **dans la même transaction que le fait qu'ils décrivent**,
nommés au passé :

| Événement | Déclencheur | Destinations | Priorité |
|---|---|---|---|
| `lead.created` | Compte créé (validation de l'écran 3) | E-mail de bienvenue (toujours) · contact Brevo (si consentement) · contact Apollo (si périmètre et qualification) | Normale |
| `lead.updated` | Modification du pays, de la langue, du statut déclaré, du nom d'entreprise, ou correction par un agent | Contact Brevo · contact Apollo | Normale |
| `email.changed` | Changement d'adresse confirmé des deux côtés | Contact Brevo · contact Apollo | Normale |
| `consent.granted` | Consentement accordé (inscription ou espace membre) | Contact Brevo · contact Apollo | Normale |
| `consent.revoked` | Consentement retiré (espace membre, backoffice, retour Brevo) | Contact Brevo · contact Apollo | **Prioritaire** |
| `account.deleted` | Suppression ou anonymisation demandée | Contact Brevo · contact Apollo | **Prioritaire** |

`profile.completed`, `campaign.published`, `introduction.opened` et les suivants appartiennent aux lots
2 à 4 ; le pipeline est conçu pour les accueillir sans changement de forme.

**RG74** — La charge utile d'un événement ne contient que des **identifiants** et l'identifiant de
l'événement. Ni adresse e-mail, ni nom, ni contenu. Le consommateur relit la base pour obtenir l'état à
jour au moment où il agit.

**RG75** — Les destinations sont **indépendantes** : l'échec de l'une n'empêche ni ne retarde les
autres. Un même fait produit une ligne de file par destination.

**RG76** — Chaque ligne porte une **clé d'idempotence stable**, unique par destination. Pour une mise à
jour de contact, la clé inclut l'identifiant de l'événement (rejouer le même événement ne crée pas de
doublon, un nouvel événement met bien à jour). Pour un **envoi d'e-mail unique par nature**
(bienvenue), la clé **n'inclut pas** l'identifiant de l'événement : un e-mail de bienvenue ne part
qu'une fois par compte, quoi qu'il arrive, y compris après un rejeu manuel.

**RG77** — Les événements d'un **même compte** sont traités dans leur ordre d'émission. Une création
précède toujours une mise à jour ; un retrait de consentement n'est jamais doublé par un envoi
postérieur.

**RG78** — `consent.revoked` et `account.deleted` **passent devant** toute la file, y compris devant
des événements plus anciens. Un retard sur une désinscription est un manquement légal, pas un retard
d'exploitation.

**RG79** — En cas d'échec transitoire, les tentatives sont espacées de façon croissante — valeurs de
départ **paramétrables** : immédiat, puis 1 min, 5 min, 15 min, 1 h, 3 h, 6 h, 12 h, 24 h, 24 h — soit
**10 tentatives au maximum**, après quoi la ligne passe en **échec définitif**, visible et rejouable au
backoffice. Objectifs de délai : **contact Brevo synchronisé en moins d'une heure**, **contact Apollo
en moins de 24 heures**, pour au moins **99 %** des inscrits éligibles.

**RG80** — Le consentement est relu à la consommation (RG37). Sans consentement, la ligne passe en
**« ignoré »** avec le motif, **jamais en « échec »**.

**RG81** — Le **périmètre Apollo** est lu **en configuration à chaque consommation d'événement**, jamais
au démarrage ni en dur, et prend l'une de **trois valeurs** :

| Valeur | Comportement |
|---|---|
| `annonceurs_seuls` | Seuls les comptes annonceurs sont envoyés. Tout créateur est ignoré, motif « hors périmètre Apollo » |
| `annonceurs_et_createurs_pro` | **Valeur d'attente au Lot 1.** Annonceurs + créateurs ayant déclaré le statut `professionnel`. Les créateurs `particulier` sont ignorés, motif « hors périmètre Apollo (créateur particulier) » |
| `tous_les_inscrits` | **Cible du fondateur (A7).** Tous les comptes sont envoyés, créateurs particuliers compris, avec la séquence et les mentions renforcées prévues pour eux |

Le changement de valeur est **réservé au rôle `admin`**, prend effet **sans redéploiement**, est
**journalisé** (qui, quand, ancienne et nouvelle valeur), et **déclenche la réévaluation** des comptes
précédemment ignorés pour ce motif. Basculer d'une valeur à l'autre ne demande **aucun développement**.

**RG82** — Un lead n'est envoyé à Apollo que s'il passe **toute** la qualification, évaluée avant
l'appel : adresse vérifiée · absence d'opposition · pays du contact figurant dans la liste des pays où
la prospection est validée · périmètre autorisé (RG81) · base légale satisfaite (RG83) · statut déclaré
renseigné · pour un annonceur, entreprise identifiée. Un lead non qualifié est **conservé dans INFLUX**,
marqué « ignoré » avec son motif, et **réévaluable** plus tard.

**RG83** — La **base légale** de la synchronisation Apollo est elle aussi lue en configuration, avec
deux valeurs et deux comportements complets :

| Valeur | Comportement |
|---|---|
| `consentement_requis` | **Valeur d'attente au Lot 1** (position conservatrice, `CLAUDE.md` §9). Sans consentement enregistré, aucun envoi vers Apollo ; ligne « ignorée », motif « sans consentement » |
| `interet_legitime_avec_opposition` | Envoi possible sans consentement pour les profils du périmètre, **à condition** que l'information renforcée ait été délivrée (mention d'inscription et politique de confidentialité citant Apollo) et qu'aucune opposition ne soit enregistrée. Une opposition vaut exclusion définitive |

Le choix relève de `expert-conformite-rgpd` et du juriste (**Q1**). Les deux comportements sont
spécifiés ici pour qu'aucun développement ne soit nécessaire au moment de l'arbitrage.

**RG84** — La **liste des pays où la prospection Apollo est validée** est lue en configuration. Elle est
**vide tant que `expert-conformite-rgpd` ne l'a pas renseignée** : dans ce cas, aucun lead ne part vers
Apollo et chaque ligne est marquée « ignoré — pays non validé pour la prospection ». Une absence de
liste doit produire une abstention, jamais un envoi par défaut.

**RG85** — **Aucune donnée enrichie par Apollo n'est réimportée dans INFLUX.** La réimporter
déclencherait une obligation d'information supplémentaire à la charge d'INFLUX. Toute exception est une
décision explicite et écrite de `expert-conformite-rgpd`.

**RG86** — Un **e-mail de bienvenue transactionnel** part à la création du compte, **indépendamment du
consentement marketing**, dans la langue du compte, avec un contenu **propre à chaque rôle** et
**aucun contenu promotionnel**. Il est idempotent : un et un seul par compte.

**RG87** — Hors production, les intégrations Brevo et Apollo sont **désactivées** ou redirigées vers une
liste fermée d'adresses internes, avec des clés distinctes par environnement. **Tout envoi réel constaté
depuis un environnement de test est un incident à déclarer.**

**RG88** — Le **mapping des attributs** envoyés à Brevo et à Apollo est documenté **champ par champ**
(nom INFLUX, nom externe, type, valeur par défaut, comportement si absent) et couvre au minimum : type
de profil, statut déclaré, langue, pays, date d'inscription, source d'inscription, étape de funnel,
consentement (valeur, date, source), et — pour Apollo — le **périmètre appliqué au moment de l'envoi**.
**Un champ absent est envoyé vide, jamais rempli d'une valeur inventée** : remplir un champ
« entreprise » avec le nom d'un créateur produirait une donnée fausse dans un outil qui l'exploite.

### J — Désinscriptions dans les deux sens

**RG89** — Les retours de Brevo (désinscription, plainte pour spam, rebond dur) sont reçus par un
canal **dont la signature est vérifiée**, traités de façon **idempotente**, et produisent : un
événement de consentement `retiré` de source `retour Brevo`, et la mise à jour de l'état de
synchronisation du contact.

**RG90** — **Sur la désinscription, Brevo fait foi.** Une désinscription faite chez Brevo est vraie dans
INFLUX, même si INFLUX pensait le contraire.

**RG91** — Un **rapprochement quotidien** récupère les désinscriptions et plaintes des **48 dernières
heures** chez Brevo et rattrape celles dont le retour immédiat s'est perdu. L'écart constaté est un
indicateur de santé, visible au backoffice.

**RG92** — Un retrait de consentement fait dans INFLUX prend effet **immédiatement dans INFLUX** et
part vers Brevo et Apollo en **priorité sur toute la file** (RG78), avec un objectif de prise en charge
**inférieur à 5 minutes**. Il est enregistré même si la propagation échoue, et l'échec de propagation
est visible et rejouable.

**RG93** — Une **plainte pour spam** vaut retrait définitif : le contact part en **liste de
suppression** et ne peut plus être resynchronisé par un rejeu ordinaire. Le rétablir exige une action
explicite, motivée, journalisée et réservée au rôle `admin`.

**RG94** — Un retrait de consentement **ne supprime pas le compte**, ne retire aucun accès et ne rompt
aucun parcours : il coupe uniquement les envois marketing et la prospection.

**RG95** — La page « mes préférences de communication » affiche, en clair, **la valeur courante du
consentement, sa date et son origine** (« par vous, à l'inscription », « par vous, depuis votre
espace », « par un lien de désinscription dans un e-mail »).

**RG96** — Toute désinscription revenue de Brevo est visible au backoffice avec sa source et sa date, et
n'est **jamais** présentée comme une erreur de synchronisation.

### K — Backoffice v0

**RG97** — Le backoffice expose une **liste des inscrits** avec, par ligne : date et heure
d'inscription, rôle, pays, langue, statut déclaré, source d'inscription, consentement (valeur, date,
source), **état Brevo**, **état Apollo**, commercial responsable, dernière activité. Tri par date
décroissante par défaut. Filtres : rôle, pays, langue, statut déclaré, état de synchronisation,
consentement, période.

**RG98** — La recherche par **adresse exacte** est disponible sans restriction pour les rôles internes.
La recherche **partielle** est limitée en débit et **journalisée**, afin qu'une extraction massive de la
base par l'interface soit détectable.

**RG99** — L'état de synchronisation est affiché **par destination** avec **la cause en clair**, issue
d'une table de correspondance, et **jamais sous forme de trace technique brute**. Causes attendues au
minimum :

| Cause affichée | Nature | Action attendue |
|---|---|---|
| Synchronisé | Succès | Aucune |
| En attente / nouvelle tentative prévue à HH:MM | En cours | Aucune |
| Non synchronisé — sans consentement | **Cas normal** | Aucune |
| Non synchronisé — hors périmètre Apollo (créateur particulier) | **Cas normal** | Aucune, sauf bascule du périmètre |
| Non synchronisé — pays non validé pour la prospection | **Cas normal** | Relance de l'instruction juridique |
| Échec — adresse refusée par le destinataire | Échec définitif | Vérifier l'adresse |
| Échec — quota du destinataire dépassé | Échec temporaire | Attendre ou augmenter le quota |
| Échec — service indisponible | Échec temporaire | Rejeu automatique en cours |
| Échec — clé d'accès refusée | **Incident** | Alerte, intervention immédiate |

**RG100** — L'interface **distingue visuellement** « échec à traiter » et « ignoré, cas normal ». Le
compteur d'échecs ne mélange jamais les deux. Un cas normal présenté comme une erreur fait perdre la
confiance dans l'écran, donc son usage.

**RG101** — Le **rejeu unitaire** est disponible sur chaque ligne en échec. Le **rejeu en lot** est
disponible sur une sélection, **plafonné à 200 lignes** par opération, et rend compte du résultat :
nombre remis en file, nombre ignorés (et pourquoi), nombre refusés.

**RG102** — Un rejeu remet la ligne en file **avec la même clé d'idempotence** : il ne crée jamais de
doublon chez le destinataire et ne renvoie jamais un e-mail déjà envoyé. Chaque rejeu est journalisé
(qui, quand, quelles lignes, combien).

**RG103** — Une ligne **« ignorée pour absence de consentement » n'est pas rejouable** : ce n'est pas un
échec. Si le consentement a changé depuis, c'est un **nouvel événement** `consent.granted` qui produit
la synchronisation, pas un rejeu de l'ancienne ligne.

**RG104** — Le backoffice **alerte** sur : panne durable d'un destinataire (échecs consécutifs sur une
fenêtre glissante), quota dépassé, clé d'accès refusée, file en retard au-delà des objectifs de RG79, et
dépassement des seuils de délivrabilité de RG63.

**RG105** — Un bandeau de tête affiche les compteurs du jour : inscriptions totales, par rôle, par pays
principal, part synchronisée vers Brevo en moins d'une heure, part synchronisée vers Apollo en moins de
24 heures, **nombre d'échecs non traités** (cible : zéro).

**RG106** — L'**export** de la liste des inscrits est réservé au rôle `admin`, exige une
re-authentification et un **motif**, et est journalisé nominativement. Il ne contient aucune donnée
absente de l'écran.

**RG107** — Le backoffice v0 ne montre **jamais** : un code de connexion, un mot de passe, le contenu
d'un e-mail envoyé à une personne, ni aucune donnée enrichie par Apollo.

**RG108** — Un agent peut corriger le **statut déclaré**, le **pays** et la **langue** d'un compte ; un
administrateur peut en outre changer le **rôle**. Chaque correction exige un motif, est journalisée
nominativement, et émet un `lead.updated`. Une correction de statut `professionnel` → `particulier`
entraîne, si le périmètre l'impose, le **retrait du contact des séquences Apollo**.

### L — États d'écran, messages et accessibilité

**RG109** — Chaque écran du parcours possède **quatre états explicites** : repos, chargement, succès,
échec. Aucun écran ne reste muet après une action.

**RG110** — Pendant un envoi, le bouton principal est **désactivé** et son libellé change (« Envoi du
code… », « Création du compte… »). Une double soumission — double clic, deuxième onglet, retour arrière
— **n'a aucun effet** : le serveur est idempotent sur ces deux actions.

**RG111** — **Aucune saisie n'est perdue** sur erreur, quelle que soit la cause. Un rechargement de page
ou un changement de langue conserve le profil choisi et l'étape en cours tant que le parcours n'a pas
expiré.

**RG112** — Tous les messages existent en **français et en anglais**. Les variantes de nombre suivent la
langue. Aucun message n'est écrit en dur dans le code.

| Clé | Français | English |
|---|---|---|
| `signup.email.errors.required` | Indiquez votre adresse e-mail. | Enter your email address. |
| `signup.email.errors.format` | Cette adresse e-mail n'a pas un format valide (exemple : nom@exemple.com). | This email address is not valid (example: name@example.com). |
| `signup.email.errors.tooLong` | Cette adresse e-mail est trop longue : 254 caractères au maximum. | This email address is too long: 254 characters maximum. |
| `signup.company.errors.required` | Indiquez le nom de votre entreprise. | Enter your company name. |
| `signup.company.errors.tooLong` | Le nom de l'entreprise ne peut pas dépasser 120 caractères. | The company name cannot exceed 120 characters. |
| `signup.country.errors.required` | Sélectionnez votre pays. | Select your country. |
| `signup.status.errors.required` | Indiquez si vous vous inscrivez en tant que particulier ou en tant que professionnel. | Tell us whether you are signing up as an individual or as a business. |
| `signup.adult.errors.required` | Vous devez attester être majeur dans votre pays de résidence pour créer un compte créateur. | You must confirm that you are of legal age in your country of residence to create a creator account. |
| `signup.terms.errors.required` | Vous devez accepter les conditions générales d'utilisation pour créer votre compte. | You must accept the terms of use to create your account. |
| `signup.errors.countryBlocked` | L'inscription n'est pas ouverte depuis ce pays pour le moment. | Sign-up is not open from this country at the moment. |
| `signup.errors.unavailable` | Nous ne parvenons pas à créer votre compte pour le moment. Vos réponses sont conservées : réessayez dans quelques minutes. | We cannot create your account right now. Your answers are saved: please try again in a few minutes. |
| `auth.code.sent` | Si un compte peut être créé ou retrouvé avec cette adresse, un code à 6 chiffres vient d'être envoyé. Vérifiez aussi vos indésirables. | If an account can be created or found with this address, a 6-digit code has just been sent. Please also check your spam folder. |
| `auth.code.errors.required` | Saisissez le code à 6 chiffres reçu par e-mail. | Enter the 6-digit code you received by email. |
| `auth.code.errors.format` | Le code comporte 6 chiffres. | The code is 6 digits long. |
| `auth.code.errors.invalid` | Ce code est incorrect. Il vous reste {remaining, plural, one {# essai} other {# essais}}. | This code is incorrect. You have {remaining, plural, one {# attempt} other {# attempts}} left. |
| `auth.code.errors.expired` | Ce code n'est plus valide. Demandez-en un nouveau. | This code is no longer valid. Request a new one. |
| `auth.code.errors.tooManyAttempts` | Trop d'essais avec ce code. Demandez un nouveau code. | Too many attempts with this code. Request a new code. |
| `auth.code.errors.sessionLost` | Votre demande a expiré ou a été ouverte dans un autre navigateur. Recommencez depuis votre adresse e-mail. | Your request has expired or was opened in another browser. Start again with your email address. |
| `auth.code.resend.countdown` | Vous pourrez demander un nouveau code dans {seconds} secondes. | You can request a new code in {seconds} seconds. |
| `auth.code.resend.limit` | Vous avez demandé plusieurs codes. Utilisez le dernier code reçu : il reste valide. | You have requested several codes. Use the last code you received: it is still valid. |
| `auth.email.errors.undeliverable` | Nous ne parvenons pas à envoyer d'e-mail à cette adresse. Vérifiez-la, ou utilisez une autre adresse. | We cannot deliver email to this address. Check it, or use another address. |
| `auth.errors.serviceUnavailable` | Nous ne parvenons pas à envoyer votre code pour le moment. Réessayez dans quelques minutes. | We cannot send your code right now. Please try again in a few minutes. |
| `auth.roleMismatch.notice` | Cette adresse est déjà associée à un compte {role}. Un compte INFLUX porte un seul rôle : utilisez une autre adresse pour créer un second compte. | This address is already linked to a {role} account. An INFLUX account holds a single role: use another address to create a second account. |
| `auth.internalAccount.notice` | Ce compte s'utilise depuis l'espace interne d'INFLUX. | This account is used from the INFLUX internal workspace. |
| `auth.suspended.notice` | Ce compte n'est pas accessible. Contactez INFLUX. | This account is not accessible. Please contact INFLUX. |
| `signup.success.title` | Votre compte INFLUX est créé. | Your INFLUX account is ready. |

**RG113** — **Aucun message, aucun code de réponse et aucun temps de réponse ne révèle l'existence d'un
compte avant la vérification du code.** Cela vaut pour l'écran 1, pour le renvoi de code et pour toute
erreur technique. C'est une règle de sécurité, pas une préférence de rédaction.

**RG114** — Chaque message d'erreur dit **quoi faire ensuite**. Un message qui décrit un problème sans
indiquer d'issue est un défaut.

**RG115** — Accessibilité : chaque champ a une étiquette visible (jamais un texte d'exemple seul) ; un
champ en erreur porte `aria-invalid` et pointe vers son message ; le focus va au **premier champ
invalide** ; le champ de code est en saisie numérique avec remplissage automatique du code à usage
unique ; les contrastes respectent WCAG AA ; le compte à rebours de renvoi est annoncé ; le vert de
marque n'est jamais le seul porteur d'un état.

---

## Cas limites

### Les huit cas limites de la skill `feature-spec`

**1 — Donnée absente ou profil incomplet**

| Situation | Comportement attendu |
|---|---|
| Un champ obligatoire est vide | Message par champ (RG112), focus au premier champ invalide, aucune donnée envoyée |
| Le statut déclaré n'est pas choisi | Message dédié ; l'inscription ne passe pas. Sans lui, le périmètre Apollo est inapplicable (RG18) |
| Aucune version de CGU n'est publiée dans la langue choisie | Version anglaise présentée, langue réellement affichée enregistrée (RG25) |
| **Aucune version de CGU n'est publiée du tout** | **L'inscription est fermée** : message d'indisponibilité, aucun compte créé, alerte immédiate au backoffice. Créer un compte sans CGU acceptées serait un droit perdu (RG29) |
| Le pays de la liste n'est plus actif en base | Le compte est créé, le pays est conservé, une alerte de cohérence remonte au backoffice |

**2 — Valeur nulle, négative ou aberrante**

| Situation | Comportement attendu |
|---|---|
| Aucun montant n'existe dans ce périmètre | Vérifié : aucun champ, aucun calcul, aucun affichage de montant, de taux ni de commission (RG9, A1) |
| Adresse e-mail de plus de 254 caractères, nom d'entreprise de plus de 120 | Refus avec message dédié, côté navigateur **et** côté serveur |
| Code saisi non numérique, plus court ou plus long que 6 chiffres | Refus de forme, **sans consommer de tentative** |
| Code composé d'espaces ou collé avec des séparateurs | Nettoyé avant contrôle ; un code collé depuis l'e-mail fonctionne |
| Pays ou langue absents de la liste (valeur forgée) | Refus côté serveur, journalisé comme tentative de manipulation |
| Compte à rebours négatif ou horloge du client décalée | Le serveur fait foi sur l'expiration, jamais le navigateur |

**3 — Doublon**

| Situation | Comportement attendu |
|---|---|
| Même adresse déjà inscrite | Aucune information avant vérification (RG46, RG113) ; après vérification, connexion à ce compte |
| Deux inscriptions simultanées avec la même adresse | Une seule aboutit (unicité en base) ; l'autre est routée vers la connexion sans message d'erreur technique |
| Double clic sur « Créer mon compte » | Un seul compte, un seul e-mail de bienvenue, un seul jeu d'événements (RG110, RG76) |
| Rejeu d'un événement déjà traité | Aucun doublon chez le destinataire, aucun e-mail renvoyé (RG76, RG102) |
| Un même compte réinscrit après suppression | Compte entièrement nouveau, sans lien visible avec l'ancien (RG70) |

**4 — Action concurrente**

| Situation | Comportement attendu |
|---|---|
| Deux agents rejouent la même ligne en même temps | Une seule remise en file effective ; le second voit « déjà en cours de traitement », pas une erreur |
| Deux processus de traitement prennent la même ligne | Impossible : la prise est verrouillée ligne à ligne, les lignes verrouillées sont ignorées |
| L'écran 3 est validé dans deux onglets | Un seul compte créé ; le second onglet est routé vers l'espace membre |
| Un agent corrige le statut déclaré pendant que la ligne Apollo est en cours de traitement | Le traitement en cours va à son terme avec l'état lu à sa consommation ; la correction émet un nouvel événement qui corrige l'état |
| Une personne retire son consentement pendant que sa ligne Brevo est en attente | Le consentement est relu à la consommation : la ligne passe « ignorée » (RG37) |

**5 — Droit insuffisant**

| Situation | Comportement attendu |
|---|---|
| Un compte interne se connecte sur l'espace membre | Vérification normale puis refus d'ouverture de session, avec renvoi vers l'espace interne (RG68) |
| Un membre appelle directement une adresse du backoffice | Refus, journalisé |
| Un agent tente un export | Refus : l'export est réservé au rôle `admin` (RG106) |
| Un agent tente de changer le périmètre Apollo ou le rôle d'un compte | Refus : réservé au rôle `admin` (RG81, RG108) |
| Un membre tente de lire les données d'un autre membre | Refus au niveau de la base, pas seulement de l'interface |

**6 — Service externe indisponible**

| Situation | Comportement attendu |
|---|---|
| Brevo indisponible pour les **contacts** | L'inscription réussit, la ligne est mise en attente et réessayée (RG72, RG79) |
| Apollo indisponible ou quota dépassé | L'inscription réussit, Brevo n'est pas affecté, la ligne est réessayée puis alerte (RG75, RG104) |
| **Service d'envoi indisponible** | **Personne ne peut se connecter.** Message d'incident explicite, saisie conservée, alerte immédiate au backoffice (RG64) — c'est le seul service dont la panne arrête réellement le produit |
| La base est indisponible | L'inscription est refusée avec un message honnête ; aucune donnée n'est perdue silencieusement, aucun compte partiel n'est créé |
| Clé d'accès Brevo ou Apollo refusée | Arrêt du traitement de la destination concernée, alerte immédiate, aucune perte d'événement |
| Le retour de désinscription Brevo ne parvient pas | Rattrapé par le rapprochement quotidien des 48 heures (RG91) |

**7 — Abandon en cours de parcours**

| Situation | Comportement attendu |
|---|---|
| Abandon après l'écran 1 | Le code expire seul ; aucune trace visible ; l'adresse saisie est conservée **24 heures au maximum** puis effacée (Q6) |
| Abandon après vérification, avant l'écran 3 | **Aucun compte n'existe** (RG5). Revenir dans les 30 jours avec la même adresse redemande simplement un code. Aucun e-mail de relance n'est envoyé : il n'y a ni consentement, ni compte |
| Abandon pendant la saisie de l'écran 3 | Saisie conservée dans le parcours en cours ; perdue à l'expiration, sans conséquence |
| Compte créé mais jamais reconnecté | Compte normal, lead normal. Durée de conservation à trancher (**Q6**) |
| Fermeture de l'onglet entre l'écran 1 et l'écran 2 | Le code devient inutilisable (RG47) ; le message l'explique et propose de recommencer |

**8 — Annulation ou retour en arrière après validation**

| Situation | Comportement attendu |
|---|---|
| Retrait du consentement après inscription | Effet immédiat dans INFLUX, propagation prioritaire, compte intact (RG92, RG94) |
| Changement d'adresse e-mail | Double confirmation obligatoire ; tant qu'elle n'est pas complète, l'ancienne adresse reste la bonne (RG58) |
| Demande de suppression du compte | Re-authentification par code, puis anonymisation ; propagation prioritaire vers Brevo et Apollo (RG57, RG73) |
| Changement de rôle demandé par un membre | Refusé en libre-service au MVP ; un administrateur peut le faire, avec motif et journal (RG108, Q9) |
| Nouvelle version des CGU refusée | Déconnexion sans suppression du compte ; l'état est visible au backoffice (RG28) |
| Nouvelle inscription après suppression | Autorisée, compte neuf (RG70) |

### La checklist INFLUX de la skill `feature-spec`

| # | Contrôle | Réponse pour ce lot |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission INFLUX, net créateur | **Sans objet et interdit.** Aucun champ, aucun calcul, aucun affichage de montant ni de taux dans ce périmètre (RG9). A1 place contrat et paiement hors application ; la table des taux reste vide |
| 2 | **Traçabilité / contournement** | **Risque réduit par construction, un point de vigilance.** L'inscription ne collecte aucune coordonnée directe (ni téléphone, ni site, ni pseudo, ni lien) — précisément pour ne pas constituer un annuaire de contournement (RG16, RG21). **Le point à surveiller est le canal de secours** (RG65) : il doit rester un canal d'assistance, jamais un moyen de faire circuler des coordonnées entre deux membres. `expert-ux` et `expert-cybersecurite` doivent le vérifier à la conception |
| 3 | **Leads** — ce qui part vers Brevo et Apollo, avec quel consentement | Détaillé de RG72 à RG88 : e-mail de bienvenue sans consentement (transactionnel), contact Brevo avec consentement, contact Apollo selon périmètre (RG81), base légale (RG83), pays validés (RG84) et qualification (RG82) |
| 4 | **Backoffice** — contrepartie interne | Détaillée de RG97 à RG108 : liste des inscrits, cause en clair, rejeu unitaire et en lot, alertes, corrections, bascule du périmètre Apollo |
| 5 | **Matching hybride** | Non touché à ce lot (D11 : aucun algorithme au MVP). La seule intervention humaine spécifiée ici est la correction et le rejeu au backoffice, tous deux journalisés |
| 6 | **Deux populations** | Deux portes, deux jeux de champs, deux libellés de consentement, deux e-mails de bienvenue, deux espaces (RG1). Aucun écran partagé, hormis l'écran de saisie du code, qui ne dépend d'aucune population |
| 7 | **Données personnelles** — avis de `expert-conformite-rgpd` | **Obligatoire, avec veto.** Points soumis : base légale Apollo (Q1), périmètre D33 (Q2), pays de prospection (Q3), conservation de l'IP et du navigateur dans la preuve d'acceptation (Q5), durées de conservation (Q6), une case ou deux pour le consentement (Q10), statut déclaré côté annonceur (Q11) |

---

## Critères d'acceptation

### Inscription annonceur

**CA1** — *Étant donné* un visiteur sur la porte annonceur, *quand* il saisit une adresse valide et
demande son code, *alors* l'écran de saisie du code s'affiche avec la phrase de correspondance et le
compte à rebours de renvoi.

**CA2** — *Étant donné* un visiteur annonceur ayant vérifié son code sur une adresse sans compte,
*quand* il renseigne entreprise, pays, langue, coche les CGU et valide, *alors* un compte de rôle
annonceur est créé, l'écran de succès s'affiche et il est routé vers l'espace marque.

**CA3** — *Étant donné* le formulaire annonceur de l'écran 3, *quand* le visiteur valide sans nom
d'entreprise, *alors* le message « Indiquez le nom de votre entreprise. » s'affiche, le focus va sur ce
champ, et aucun compte n'est créé.

**CA4** — *Étant donné* le formulaire annonceur, *quand* le visiteur valide sans cocher les CGU,
*alors* le message d'acceptation obligatoire s'affiche et aucun compte n'est créé.

**CA5** — *Étant donné* un formulaire annonceur complet avec la case marketing **non cochée**, *quand*
le visiteur valide, *alors* le compte est créé et deux événements de consentement « refusé » sont
enregistrés avec leur date, leur source et le libellé présenté.

### Inscription créateur

**CA6** — *Étant donné* un visiteur créateur ayant vérifié son code, *quand* il renseigne pays, langue,
statut `particulier`, coche la majorité et les CGU, et valide, *alors* un compte de rôle créateur est
créé avec son statut déclaré et la date de son attestation de majorité.

**CA7** — *Étant donné* le formulaire créateur, *quand* le visiteur valide sans choisir de statut,
*alors* le message dédié s'affiche et aucun compte n'est créé.

**CA8** — *Étant donné* le formulaire créateur, *quand* le visiteur valide sans cocher l'attestation de
majorité, *alors* le message dédié s'affiche et aucun compte n'est créé.

**CA9** — *Étant donné* le formulaire créateur, *quand* on examine ses champs, *alors* aucun champ de
pseudonyme, d'identifiant `@`, de lien de réseau, d'abonnés, de tarif, de téléphone ni de nom légal
n'est présent.

**CA10** — *Étant donné* un formulaire avec le profil créateur et la case marketing cochée, *quand* le
visiteur change de profil pour annonceur, *alors* la case marketing est **décochée** et le libellé
affiché est celui de la porte annonceur.

### Code de connexion

**CA11** — *Étant donné* un code envoyé, *quand* il est saisi correctement dans l'onglet d'origine dans
les 10 minutes, *alors* la session s'ouvre et le code devient inutilisable.

**CA12** — *Étant donné* un code envoyé, *quand* un code erroné est saisi, *alors* le message indique le
nombre d'essais restants ; au **cinquième** échec, le code est invalidé et l'écran invite à en demander
un nouveau, **le compte restant accessible**.

**CA13** — *Étant donné* un code envoyé, *quand* 10 minutes se sont écoulées, *alors* sa saisie est
refusée avec le message d'expiration.

**CA14** — *Étant donné* un premier code envoyé, *quand* un second code est demandé et envoyé, *alors*
le premier est immédiatement refusé et seul le second fonctionne.

**CA15** — *Étant donné* un code envoyé il y a 20 secondes, *quand* le visiteur cherche à en redemander
un, *alors* le bouton est indisponible et le compte à rebours indique le temps restant.

**CA16** — *Étant donné* un visiteur ayant atteint le plafond de demandes, *quand* il en demande une de
plus, *alors* **aucun code n'est envoyé**, le message invite à utiliser le dernier code reçu, et **ce
dernier reste valide**.

**CA17** — *Étant donné* deux adresses, l'une inscrite et l'autre non, *quand* on demande un code pour
chacune, *alors* la réponse est identique en contenu **et** le temps de réponse ne permet pas de les
distinguer.

**CA18** — *Étant donné* un code reçu, *quand* il est saisi dans un autre navigateur que celui de la
demande, *alors* il est refusé avec le message de parcours expiré, **sans indiquer s'il était correct**.

**CA19** — *Étant donné* l'écran de saisie du code, *quand* le visiteur choisit « modifier mon
adresse », *alors* il revient à l'écran 1 avec son profil conservé, et le code précédent reste
inutilisable pour toute autre adresse.

**CA20** — *Étant donné* un e-mail de code reçu, *quand* on l'examine, *alors* l'objet ne contient pas
le code, le corps ne contient aucun lien de connexion, et la phrase de correspondance est identique à
celle de l'écran.

**CA21** — *Étant donné* un code émis, *quand* un agent consulte le backoffice, *alors* il voit l'état
du code (demandé, envoyé, consommé, expiré) mais **jamais sa valeur**, où qu'il regarde.

**CA22** — *Étant donné* un compte créé, *quand* on consulte sa fiche, *alors* la date de vérification
de l'adresse est renseignée et **aucune étape de confirmation d'e-mail supplémentaire n'a été
demandée**.

### L'e-mail qui n'arrive pas

**CA23** — *Étant donné* une adresse qui produit un rebond dur, *quand* un code est demandé, *alors*
l'écran affiche le message d'adresse non délivrable, et l'adresse apparaît dans la file backoffice des
adresses injoignables.

**CA24** — *Étant donné* un service d'envoi indisponible, *quand* un code est demandé, *alors* l'écran
affiche le message d'incident, la saisie est conservée, et une alerte apparaît au backoffice — **aucun
faux succès n'est affiché**.

**CA25** — *Étant donné* un membre dont l'adresse est devenue injoignable, *quand* un administrateur
corrige l'adresse avec un motif, *alors* la correction est journalisée nominativement, les deux
adresses sont notifiées, et le membre peut à nouveau se connecter.

**CA26** — *Étant donné* un membre qui ne reçoit pas son code, *quand* il utilise le canal de secours,
*alors* sa demande arrive dans une file backoffice, et **aucune session ne s'ouvre et aucun code n'est
communiqué** par ce canal.

**CA27** — *Étant donné* 100 demandes de code, *quand* on mesure les délais, *alors* le délai médian de
délivrance et la part de demandes sans connexion aboutie sous 10 minutes sont visibles au backoffice, et
une alerte se déclenche au-delà de 60 secondes ou de 15 %.

### Routage et rôles

**CA28** — *Étant donné* un compte de rôle créateur, *quand* la personne arrive par la porte annonceur
et vérifie son code, *alors* elle est connectée et routée vers l'**espace créateur**, avec le message
expliquant la règle d'un seul rôle.

**CA29** — *Étant donné* un compte interne, *quand* la personne se connecte sur l'espace membre, *alors*
le code est demandé et vérifié normalement, **aucune session membre n'est ouverte**, et le message
renvoie vers l'espace interne.

**CA30** — *Étant donné* un compte suspendu, *quand* la personne vérifie son code, *alors* aucune
session n'est ouverte, le message est neutre, et les sessions existantes sont déjà révoquées.

**CA31** — *Étant donné* un compte supprimé, *quand* la même adresse est réinscrite, *alors* un compte
neuf est créé, sans aucune donnée ni historique visible de l'ancien.

### Sessions et données personnelles

**CA32** — *Étant donné* un membre connecté, *quand* il se connecte depuis un navigateur inconnu,
*alors* un e-mail de notification part à son adresse avec la date, l'heure et le contexte.

**CA33** — *Étant donné* un membre avec trois sessions actives, *quand* il choisit « fermer toutes les
sessions », *alors* les trois sessions cessent immédiatement de fonctionner.

**CA34** — *Étant donné* un membre connecté, *quand* il demande à changer d'adresse, *alors* un code est
exigé, puis une confirmation depuis l'ancienne **et** la nouvelle adresse ; tant que les deux ne sont
pas faites, la connexion se fait toujours avec l'ancienne adresse.

**CA35** — *Étant donné* un membre connecté, *quand* il retire son consentement, *alors* la valeur
affichée passe à « retiré » avec sa date et sa source **immédiatement**, et un événement prioritaire
part vers Brevo et Apollo.

**CA36** — *Étant donné* un membre ayant retiré son consentement, *quand* il demande un code de
connexion, *alors* l'e-mail part normalement.

### Pipeline de leads

**CA37** — *Étant donné* Brevo et Apollo tous deux indisponibles, *quand* une inscription est validée,
*alors* le compte est créé, l'écran de succès s'affiche dans les délais habituels, et les lignes de
synchronisation sont en attente de nouvelle tentative.

**CA38** — *Étant donné* une inscription avec consentement, *quand* les traitements s'exécutent
normalement, *alors* le contact existe dans Brevo en moins d'une heure et son état est « synchronisé »
au backoffice.

**CA39** — *Étant donné* une inscription **sans** consentement, *quand* les traitements s'exécutent,
*alors* aucun contact marketing n'est créé, la ligne est marquée **« ignoré — sans consentement »**, et
elle **n'apparaît pas** dans le compteur d'échecs.

**CA40** — *Étant donné* une inscription, *quand* on examine l'e-mail de bienvenue, *alors* il est parti
**quel que soit le consentement**, dans la langue du compte, avec un contenu propre au rôle et **aucun
contenu promotionnel**.

**CA41** — *Étant donné* un e-mail de bienvenue déjà envoyé, *quand* un agent rejoue l'événement
`lead.created`, *alors* **aucun second e-mail ne part** et aucun doublon de contact n'est créé.

**CA42** — *Étant donné* le périmètre Apollo réglé sur `annonceurs_et_createurs_pro`, *quand* un
créateur `particulier` s'inscrit avec consentement, *alors* la ligne Apollo est marquée « ignoré — hors
périmètre » et rien n'est envoyé.

**CA43** — *Étant donné* la situation précédente, *quand* un administrateur bascule le périmètre sur
`tous_les_inscrits`, *alors* le changement prend effet **sans redéploiement**, il est journalisé, et les
comptes précédemment ignorés pour ce motif sont réévalués puis synchronisés.

**CA44** — *Étant donné* la liste des pays de prospection vide, *quand* un annonceur consentant
s'inscrit, *alors* **aucun envoi vers Apollo n'a lieu** et la ligne indique « pays non validé pour la
prospection ».

**CA45** — *Étant donné* la base légale Apollo réglée sur `consentement_requis`, *quand* un annonceur
sans consentement s'inscrit, *alors* rien ne part vers Apollo ; *et quand* la valeur passe à
`interet_legitime_avec_opposition`, *alors* le même profil devient éligible **sans aucune modification
de code**.

**CA46** — *Étant donné* une inscription puis un retrait de consentement avant la consommation de la
ligne Brevo, *quand* la ligne est consommée, *alors* elle est marquée « ignoré — sans consentement » et
aucun contact marketing n'est créé.

**CA47** — *Étant donné* une file contenant 50 lignes ordinaires en attente, *quand* un retrait de
consentement est émis, *alors* il est traité **avant** ces 50 lignes.

**CA48** — *Étant donné* une ligne en échec transitoire, *quand* les tentatives s'enchaînent, *alors*
les délais suivent le calendrier de RG79, et après la dixième tentative la ligne passe en échec
définitif, visible et rejouable.

**CA49** — *Étant donné* un événement, *quand* on inspecte sa charge utile, *alors* elle ne contient
**aucune adresse e-mail, aucun nom et aucun contenu**, seulement des identifiants.

**CA50** — *Étant donné* deux événements du même compte émis coup sur coup, *quand* ils sont consommés,
*alors* ils le sont dans l'ordre d'émission.

**CA51** — *Étant donné* un agent qui corrige un statut `professionnel` en `particulier` avec un
périmètre restrictif, *quand* la correction est enregistrée, *alors* un `lead.updated` part et le
contact est retiré des séquences Apollo.

### Désinscriptions dans les deux sens

**CA52** — *Étant donné* un contact qui se désinscrit depuis un e-mail Brevo, *quand* le retour est
reçu, *alors* le consentement passe à « retiré » dans INFLUX avec la source « retour Brevo », et le
membre le voit dans son espace.

**CA53** — *Étant donné* un retour de désinscription perdu, *quand* le rapprochement quotidien
s'exécute, *alors* la désinscription est rattrapée dans les 48 heures et l'écart est visible au
backoffice.

**CA54** — *Étant donné* un même retour de désinscription reçu deux fois, *quand* il est traité, *alors*
un seul événement de consentement est enregistré.

**CA55** — *Étant donné* une plainte pour spam, *quand* elle est reçue, *alors* le contact part en liste
de suppression, un rejeu ordinaire ne le resynchronise pas, et seul un administrateur peut lever cet
état, avec motif et journal.

### Backoffice v0

**CA56** — *Étant donné* dix inscriptions du jour, *quand* un commercial ouvre la liste, *alors* il voit
les dix lignes avec rôle, pays, langue, statut déclaré, consentement, état Brevo et état Apollo.

**CA57** — *Étant donné* une ligne en échec, *quand* le commercial la consulte, *alors* la cause est
affichée **en français courant** selon la table de RG99, sans trace technique brute.

**CA58** — *Étant donné* une ligne en échec, *quand* le commercial la rejoue, *alors* elle est remise en
file, le rejeu est journalisé avec son nom, et aucun doublon n'est créé chez le destinataire.

**CA59** — *Étant donné* 250 lignes en échec sélectionnées, *quand* le commercial demande un rejeu en
lot, *alors* l'opération est plafonnée à 200 lignes, le refus du surplus est expliqué, et un compte
rendu chiffré s'affiche.

**CA60** — *Étant donné* une ligne « ignoré — sans consentement », *quand* le commercial l'examine,
*alors* **aucune action de rejeu ne lui est proposée** et l'explication indique que ce n'est pas une
erreur.

**CA61** — *Étant donné* deux commerciaux qui rejouent la même ligne en même temps, *quand* les deux
actions partent, *alors* une seule remise en file a lieu et le second voit « déjà en cours de
traitement ».

**CA62** — *Étant donné* un destinataire externe en panne depuis 15 minutes, *quand* le seuil est
franchi, *alors* une alerte visible apparaît au backoffice avec le nombre de lignes en attente.

**CA63** — *Étant donné* un commercial (rôle `agent`), *quand* il tente un export ou une bascule du
périmètre Apollo, *alors* l'action est refusée et journalisée.

**CA64** — *Étant donné* un administrateur, *quand* il exporte la liste des inscrits, *alors* une
re-authentification et un motif sont exigés, et l'export est journalisé nominativement.

### États d'écran

**CA65** — *Étant donné* l'écran 1, *quand* la demande de code est en cours, *alors* le bouton est
désactivé avec un libellé de chargement, et un second clic reste sans effet.

**CA66** — *Étant donné* une erreur réseau à la validation de l'écran 3, *quand* le message s'affiche,
*alors* **toutes les réponses saisies sont conservées** et la validation peut être retentée.

**CA67** — *Étant donné* un pays figurant dans la liste de blocage, *quand* le visiteur le choisit et
valide, *alors* le message d'inscription non ouverte s'affiche, aucun compte n'est créé, et l'événement
est journalisé.

**CA68** — *Étant donné* chacun des messages du tableau de RG112, *quand* la langue de la page est
l'anglais, *alors* la version anglaise s'affiche, sans aucun texte français résiduel.

**CA69** — *Étant donné* un formulaire avec trois champs invalides, *quand* le visiteur valide, *alors*
les trois messages s'affichent simultanément et le focus va sur le premier champ invalide dans l'ordre
d'affichage.

**CA70** — *Étant donné* une nouvelle version des CGU en vigueur, *quand* un membre se connecte, *alors*
la ré-acceptation est demandée avant tout accès, et un refus le déconnecte sans supprimer son compte.

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Espace | Écran | Remarque |
|---|---|---|
| Public | Porte annonceur — écran 1 (adresse) | Mention d'information visible (RG6) |
| Public | Porte créateur — écran 1 (adresse) | Idem, vocabulaire créateur |
| Public | Écran 2 — saisie du code | **Commun aux deux portes** ; phrase de correspondance, compte à rebours, « je n'ai pas reçu le code », « modifier mon adresse » |
| Public | Écran 3 annonceur — informations | Entreprise, pays, langue, CGU, consentement |
| Public | Écran 3 créateur — informations | Pays, langue, statut, majorité, CGU, consentement |
| Public | Écrans d'issue | Succès · adresse non délivrable · service indisponible · pays bloqué · parcours expiré · autre rôle · compte interne · compte suspendu |
| Public | Canal de secours (formulaire de contact) | Accessible sans connexion (RG65) |
| Membre | Accueil minimal par rôle | Deux versions (RG71) |
| Membre | Mes informations · Mes préférences de communication · Mes données · Mes sessions | Consentement avec date et source (RG95) |
| Membre | Changement d'adresse (double confirmation) | RG58 |
| Membre | Ré-acceptation des CGU | RG28 |
| Backoffice | Liste des inscrits, fiche d'un inscrit, file des échecs, file des adresses injoignables, file du canal de secours, réglages Apollo, alertes | RG97 à RG108 |

### Données (`expert-database`)

Tables déjà prévues et utilisées telles quelles : `identity.accounts`, `identity.account_roles`,
`identity.terms_versions`, `identity.terms_acceptances`, `identity.consent_events`,
`leads.outbox_events`, `leads.contact_sync_states`, `audit.audit_events`, `reference.countries`,
`reference.languages`.

**Trois manques constatés dans `docs/mvp/04-modele-de-donnees-mvp.md`, à instruire par
`expert-database` avant le développement :**

1. **Le statut déclaré (particulier / professionnel) n'a pas de place au Lot 1.** Il n'existe
   aujourd'hui que dans `profiles.creator_identities.legal_entity_type`, créée au **Lot 2**. Or il est
   **obligatoire à l'inscription** (RG18) et conditionne le périmètre Apollo. Il faut une colonne au
   Lot 1 sur `identity.accounts` (ou une petite table de déclarations), avec son historique de
   correction.
2. **Le nom d'entreprise de l'annonceur n'a pas de place au Lot 1.** `profiles.advertiser_profiles`
   arrive au Lot 2, alors que le nom est collecté à l'inscription (RG11).
3. **L'état « adresse injoignable »** d'un compte, alimenté par les rebonds durs (RG61), n'a pas de
   support explicite. `leads.contact_sync_states` couvre le canal contact ; le canal **transactionnel**,
   qui porte le code de connexion, doit être suivi de la même façon.

À prévoir également : les paramètres de configuration (périmètre Apollo, base légale, pays de
prospection, liste de pays bloqués, plafonds de débit, calendrier de nouvelles tentatives) doivent
vivre **en table**, modifiables sans redéploiement, chaque modification étant journalisée.

### Intégrations

| Intégration | Ce que ce lot exige |
|---|---|
| **Service d'envoi transactionnel (Brevo)** | Flux **séparé** du flux marketing, domaine authentifié (SPF, DKIM, DMARC) **avant** la mise en ligne, suivi du délai de délivrance, gestion des rebonds durs et des plaintes |
| **Brevo — contacts** | Création et mise à jour de contact, listes et scénarios par rôle et par langue, retour des désinscriptions, rapprochement quotidien, liste de suppression |
| **Apollo.io** | Périmètre, base légale et pays lus en configuration ; qualification avant appel ; séquence distincte pour les créateurs ; retrait de séquence ; aucun réimport de données enrichies |
| **Supabase Auth** | Codes à usage unique, sessions à identifiant opaque révocables |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| Inscriptions abouties par porte (écran 1 → compte créé) | Mesuré dès le premier jour, par porte et par pays |
| Délai médian de délivrance du code | **Alerte au-delà de 60 secondes** |
| Demandes de code sans connexion aboutie sous 10 minutes | **Alerte au-delà de 15 %** |
| Inscrits consentants synchronisés — Brevo sous 1 h, Apollo sous 24 h | **Au moins 99 %** |
| Échecs de synchronisation non traités | **Zéro** |
| Taux de consentement marketing, par porte | Mesuré, non piloté |
| Désinscriptions revenues de Brevo, plaintes pour spam | Plaintes sous 0,1 % des envois |
| Rebonds durs sur l'e-mail de code | Suivi quotidien |
| Répartition des créateurs particuliers / professionnels | Alimente l'arbitrage D33 |
| Inscriptions par pays | Sert à choisir l'ordre d'ouverture des pays (indicateur 6 du cadrage) |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| Mot de passe, connexion via Google, Instagram ou TikTok | **D37 tranchée.** Une connexion par réseau social serait de plus lue comme une vérification d'audience, que le badge seul peut affirmer | Mot de passe possible en 2-3 jours si les seuils de RG63 sont dépassés |
| Second facteur côté membres | Aucun moyen de paiement dans un compte membre au MVP (A1). **La validation tombe automatiquement en V2** dès qu'une coordonnée bancaire apparaît | V2 |
| Double rôle sur un même compte | **D41 : un rôle par compte au MVP.** La liaison existe déjà en base | Après le pilote (8 à 12 jours chiffrés) |
| Profils (entreprise, créateur, réseaux, audience, tarifs, portfolio) | Lot 2 | Lot 2 |
| Indicateur de complétude de profil, relances de complétion | Il n'y a pas encore de profil à compléter | Lot 2 |
| Envoi d'e-mails **depuis** le backoffice, saisie libre d'adresses | **A4**, et **D35** non tranchée | Lot 5 |
| Suspension, notes internes, portefeuilles par commercial | Lot 5 | Lot 5 |
| Inscription de plusieurs utilisateurs pour une même entreprise | Un compte par marque suffit au pilote | Après le pilote |
| Vérification du statut déclaré, du nom d'entreprise, de l'âge | Déclaratif au Lot 1 ; la vérification humaine arrive avec le badge | Lot 2 |
| Réimport des données enrichies par Apollo | RG85 | Sur décision écrite de `expert-conformite-rgpd` |
| Blocage des domaines d'e-mail jetables | Faux positifs, inscrits réels perdus (RG12) | Si la qualité de base le justifie |
| Traduction en portugais | Français et anglais au lancement | Avant l'ouverture du Brésil |
| Tout montant, taux, commission, facture | **A1**, `CLAUDE.md` §3 | V2 |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **Base légale de la synchronisation Apollo** : consentement (`CLAUDE.md` §9) ou intérêt légitime avec droit d'opposition (skill `apollo-lead-sync`) ? Les deux textes de référence divergent | **Consentement requis** (position conservatrice). Les deux comportements sont spécifiés (RG83) et la bascule est une valeur de configuration | `expert-conformite-rgpd` (**veto**) + juriste | **Avant la mise en ligne du Lot 1** |
| **Q2** | **D33 — périmètre Apollo** à la mise en ligne : annonceurs seuls, annonceurs + créateurs professionnels, ou tous les inscrits (A7) ? | `annonceurs_et_createurs_pro`, **position d'attente et non contre-arbitrage** ; le fondateur bascule sans redéploiement (RG81) | Fondateur + `expert-conformite-rgpd` (**veto**) + juriste | **Avant la mise en ligne du Lot 1** |
| **Q3** | **Pays dans lesquels la prospection Apollo est validée** (CASL au Canada, lois des États américains, LGPD au Brésil, UE) | Liste **vide** : aucun envoi Apollo tant qu'elle n'est pas renseignée (RG84) | `expert-conformite-rgpd` + juriste | Avant la mise en ligne du Lot 1 |
| **Q4** | **Pays bloqués à l'inscription** (sanctions internationales, embargos) : faut-il une liste, et laquelle ? | Liste **vide**, mécanisme prêt (RG8) | Fondateur + juriste, **dépend de D25** | Avant la mise en ligne du Lot 1 |
| **Q5** | **Conservation de l'adresse IP et du navigateur** dans la preuve d'acceptation des CGU : utile comme preuve, mais ce sont des données personnelles | Enregistrées, **conservation à confirmer** | `expert-conformite-rgpd` (**veto**) | Lot 1 |
| **Q6** | **Durées de conservation** : adresse d'un parcours abandonné (proposition : 24 h), compte créé jamais reconnecté, événements de file en succès (proposition : 30 jours) | Valeurs proposées ci-contre | `expert-conformite-rgpd` (**veto**) | Lot 1 |
| **Q7** | **D29 — durée de la fenêtre de non-contournement** et régime asymétrique B2B / B2C. Elle détermine le texte accepté dès la première inscription, et **elle n'est pas rattrapable rétroactivement** | Aucune : le texte des CGU ne peut pas être figé sans elle | Fondateur + juriste | **Avant la mise en ligne du Lot 1** |
| **Q8** | **Procédure de vérification d'identité** avant qu'un administrateur corrige l'adresse e-mail d'un compte injoignable (RG62). Sans procédure, c'est un vecteur d'ingénierie sociale | Correction possible, motif obligatoire, journal et double notification ; chaque correction signalée comme sensible | `expert-cybersecurite` + `expert-conformite-rgpd` | Lot 1 |
| **Q9** | **Changement de rôle demandé par un membre** (annonceur ↔ créateur) : libre-service, demande traitée par un agent, ou second compte avec une autre adresse ? | Second compte avec une autre adresse ; changement possible par un administrateur, avec motif et journal (RG108) | Fondateur + `chef-de-projet` | Lot 2 |
| **Q10** | **Une case de consentement ou deux ?** Une seule case couvrant deux finalités (e-mails commerciaux et prospection) est plus fluide, mais la spécificité du consentement peut imposer deux cases | **Une case, deux événements enregistrés** (RG33). Si deux cases sont exigées, seule la présentation change | `expert-conformite-rgpd` (**veto**) + `expert-marketing` | Lot 1 |
| **Q11** | **Faut-il un statut déclaré côté annonceur ?** Le nom d'entreprise obligatoire suffit-il à le réputer professionnel ? | Annonceur réputé professionnel (RG22) | `expert-conformite-rgpd` | Lot 1 |
| **Q12** | **Libellés définitifs** du consentement, de l'attestation de majorité et de la mention d'information, en français et en anglais, citant Brevo et Apollo | Substance fixée par RG19, RG31 et RG6 ; rédaction à produire | `expert-marketing` + `expert-conformite-rgpd` + juriste | Lot 1 |
| **Q13** | **Contenu exact de l'espace membre du Lot 1** (RG71) : suffit-il à donner envie de revenir, ou faut-il y ajouter quelque chose ? | Périmètre minimal de RG71 | `chef-de-projet` + `expert-ux` | Lot 1 |

> **Quatre de ces questions bloquent la mise en ligne**, pas le développement : Q1, Q2, Q3 et Q7. Le
> reste du Lot 1 peut être construit sans elles, à condition que **chacune soit une valeur de
> configuration ou un texte, jamais une règle écrite en dur**. C'est la raison pour laquelle les deux
> comportements Apollo sont spécifiés dans ce document.
