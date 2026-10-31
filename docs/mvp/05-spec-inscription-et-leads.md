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

1. **Commerciale.** Un lead qui n'arrive pas dans Brevo et Apollo est un lead perdu (`CLAUDE.md` §2).
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
| 3 | Consentement à l'enregistrement dans Brevo et Apollo | **Oui (D63)** | Case à cocher, **non pré-cochée** | Cochée |

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
| 3 | Consentement à l'enregistrement dans Brevo et Apollo | **Oui (D63)** | Case à cocher, **non pré-cochée** | Cochée |

**RG18** — Le **statut déclaré** (particulier / professionnel) est **obligatoire** et sans valeur
pré-sélectionnée. Il conditionne le périmètre de synchronisation Apollo (RG81) : sans lui, la position
d'attente conservatrice de D33 devient inapplicable et la décision se referme d'elle-même. Le libellé
du choix « professionnel » cite des exemples concrets (société, entreprise individuelle, agence) ; le
choix ne demande **ni numéro d'immatriculation, ni justificatif** au Lot 1.

**RG19** — L'attestation de majorité est une case obligatoire, non pré-cochée, dont le libellé porte
sur un **âge fixe : 18 ans ou plus**, seule règle d'âge, identique pour tous et dans tous les pays
(D15, précisée le 2026-10-08) ; il ne renvoie jamais à la majorité du pays de résidence. Son aide
indique que les personnes de moins de 18 ans sont exclues de la plateforme.

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

> **Modifiée le 2026-09-25 par D63 (arbitrage du fondateur, contre la recommandation, veto
> `expert-conformite-rgpd` maintenu).** Le consentement est **obligatoire** : sans lui, aucun compte
> n'est créé. La rédaction ci-dessous est **abrogée** en ce qu'elle le déclare facultatif ; les
> règles de retrait (RG34, RG94) restent valables. Voir l'additif D63 en fin de document.

**RG30** — *(abrogée par D63)* Le consentement marketing est **facultatif**, matérialisé par une case **non pré-cochée**,
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
oblige à redemander un code. *(J7, 2026-10-14, `architecte` :* pour la re-authentification d'un membre
connecté (RG57), le parcours est un jeton signé gardé en mémoire par la page et lié à la session ;
fermer l'onglet oblige aussi à redemander un code.*)*

**RG48** — L'écran de saisie du code affiche une **phrase de correspondance de deux ou trois mots**,
reprise à l'identique dans l'e-mail, tirée d'une liste fermée bilingue de mots neutres. Elle permet de
détecter un site contrefait qui aurait déclenché un vrai envoi. *(J3, 2026-09-27 : composition,
langue, emplacements et listes de mots fixés par RG128 à RG134, additif en fin de document.)*

**RG49** — L'e-mail contenant le code : ne porte **jamais le code dans son objet** ; ne contient
**aucun lien de connexion** ; indique l'heure de la demande et le contexte (navigateur, pays
approximatif) ; porte la mention **« INFLUX ne vous demandera jamais ce code »** ; existe en français
et en anglais et part dans la langue de la page où la demande a été faite (ou du compte, s'il existe).
*(J3, 2026-09-27 : **sans pays** tant qu'EC-43 est ouvert — le contexte se limite à l'heure et au
navigateur ; texte exact : `16` RG156 ; règles : RG135.)*

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
*(J3, 2026-09-27 : au MVP, **ni pays ni appareil** — le signal « navigateur inconnu » est défini par
RG141 et RG142 ; texte de l'e-mail : `16` RG157.)*

**RG56** — L'espace membre expose une page **« mes sessions »** listant les sessions actives (date de
création, dernière activité, pays approximatif, navigateur) et un bouton **« fermer toutes les
sessions »**. *(J3, 2026-09-27 : colonne « pays approximatif » retirée au MVP, EC-43 — RG143.)*

**RG57** — Trois actions exigent une **re-authentification par un nouveau code** : changer d'adresse
e-mail, exporter ses données, supprimer son compte. *Preuve (définitive, `expert-cybersecurite`, revue de
fin de J7, 2026-10-14) : marqueur lié à la session et à la finalité, à usage unique, valable 300 s,
consommé dans la transaction de l'action (`03` A-10).*

**RG58** — Le changement d'adresse e-mail exige une **confirmation depuis l'ancienne adresse et depuis
la nouvelle**. Tant que les deux ne sont pas confirmées dans un délai de **24 heures**, l'adresse de
connexion reste l'ancienne. Une fois le changement effectif, les deux adresses sont notifiées et un
événement `email.changed` est émis. *(J7, 2026-10-14, `architecte` et `expert-cybersecurite` :* un
code qui ne part pas ferme la demande. Une nouvelle adresse déjà utilisée ferme la demande et le
membre en est informé, une fois les deux codes saisis seulement ; l'ancienne adresse reste en
vigueur.*)* *(J9, commit 3 : le code envoyé à la nouvelle adresse compte sur les plafonds de RG44,
par adresse IP puis par adresse, quel que soit le compte demandeur ; au-delà, refus avant que le code
frais ne soit consommé (A2). Une nouvelle adresse retenue chez le fournisseur d'identité par un
utilisateur sans compte INFLUX — un code demandé pour elle — n'est pas « déjà utilisée » : cet
utilisateur est supprimé, puis le changement réessayé (C5.c).)*

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
*Modifiée le 2026-10-17 (D67, tranchée par `architecte`) :* un **échec de configuration**
(RG160) ne suit pas ce calendrier — attendre ne corrige pas un réglage : la ligne passe en échec dès
sa première tentative. Un inscrit éligible ainsi bloqué **compte comme non synchronisé** dans ces
objectifs de 99 %.

**RG80** — Le consentement est relu à la consommation (RG37). Sans consentement, la ligne passe en
**« ignoré »** avec le motif, **jamais en « échec »**.
*Précisée le 2026-10-17 (D67) :* la réciproque est vraie. Une ligne bloquée par un **réglage
manquant d'INFLUX** (liste, modèle, réglage Apollo, clé en production) n'est **jamais** « ignorée » :
c'est un échec de nature incident (RG160).

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
*Précisée le 2026-10-17 (D67) :* le contrôle de démarrage du worker en production (RG162) lit ces
réglages **sans les mettre en cache** ; il ne remplace pas la lecture à chaque consommation, seule à
décider d'un envoi.

**RG82** — Un lead n'est envoyé à Apollo que s'il passe **toute** la qualification, évaluée avant
l'appel : adresse vérifiée · absence d'opposition · pays du contact figurant dans la liste des pays où
la prospection est validée · périmètre autorisé (RG81) · base légale satisfaite (RG83) · statut déclaré
renseigné · pour un annonceur, entreprise identifiée. Un lead non qualifié est **conservé dans INFLUX**,
marqué « ignoré » avec son motif, et **réévaluable** plus tard.

**RG83** — La **base légale** de la synchronisation Apollo est elle aussi lue en configuration, avec
deux valeurs et deux comportements complets :

| Valeur | Comportement |
|---|---|
| `consentement_requis` | **Valeur d'attente au Lot 1** (position conservatrice, `CLAUDE.md` §6). Sans consentement enregistré, aucun envoi vers Apollo ; ligne « ignorée », motif « sans consentement » |
| `interet_legitime_avec_opposition` | Envoi possible sans consentement pour les profils du périmètre, **à condition** que l'information renforcée ait été délivrée (mention d'inscription et politique de confidentialité citant Apollo) et qu'aucune opposition ne soit enregistrée. Une opposition vaut exclusion définitive |

Le choix relève de `expert-conformite-rgpd` et du juriste (**Q1**). Les deux comportements sont
spécifiés ici pour qu'aucun développement ne soit nécessaire au moment de l'arbitrage.

**RG84** — *(Amendée par le fondateur le 2026-10-19, D33, contre le veto RGPD.)* La prospection Apollo
est ouverte **dans tous les pays par défaut**. La **liste des pays exclus** (`apollo_excluded_countries`)
est lue en configuration, **vide par défaut** ; un lead d'un pays exclu n'est pas envoyé et sa ligne est
marquée « ignoré — pays exclu de la prospection » (`country_excluded`). Une liste illisible reste une
abstention (aucun envoi). La base légale (RG83) et le périmètre (RG81) s'appliquent toujours.

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
| Échec — configuration manquante : *réglage nommé* (liste Brevo d'un rôle, modèle Brevo, réglages Apollo, clé absente en production) | **Incident** | Renseigner le réglage ; les lignes repartent seules (RG161) ou se rejouent |

*Modifiée le 2026-10-17 (D67, tranchée) :* la dernière ligne est ajoutée. Les codes
`list_not_configured`, `template_not_configured` et `apollo_settings_invalid` étaient jusqu'ici
rangés en « ignoré, cas normal » (cause `configuration_missing`) : ils deviennent des **échecs de
nature incident**, rejouables (RG160 à RG162). La cause nomme le réglage, **jamais sa valeur**.

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
*Modifiée le 2026-10-17 (D67, tranchée) :* et sur **toute configuration manquante** (RG160), dès la
première ligne concernée, immédiatement (AL25, `15` §F).

**RG105** — Un bandeau de tête affiche les compteurs du jour : inscriptions totales, par rôle, par pays
principal, part synchronisée vers Brevo en moins d'une heure, part synchronisée vers Apollo en moins de
24 heures, **nombre d'échecs non traités** (cible : zéro).

**RG106** — **Aucun export nominatif de la liste des inscrits, pour aucun rôle, `admin` compris.**
Seul est autorisé un **export agrégé, sans aucune ligne nominative** (comptes par pays, par langue,
par profil, par période, par état de synchronisation), qui exige une re-authentification et un
**motif** et est journalisé nominativement.

> **Règle abrogée et remplacée le 2026-09-19 (arbitrage `chef-de-projet`).** La première rédaction
> autorisait à `admin` l'export de la liste des inscrits. Or cette liste **est** l'annuaire, et
> `03` C(17) interdit l'export de l'annuaire à tout le monde, administrateurs compris, en visant
> explicitement l'export CSV d'une liste. `03` fait autorité (veto `expert-cybersecurite`) ; le
> besoin de synchronisation avec Brevo et Apollo est couvert par le pipeline de leads, pas par un
> fichier. Voir `15` RG92 et sa Q1.

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
| `signup.adult.errors.required` | Vous devez certifier avoir 18 ans ou plus pour créer un compte créateur. | You must confirm that you are 18 or older to create a creator account. |
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
| Un agent ou un admin tente un export nominatif | Refus : aucun export nominatif n'existe (RG106) ; seul l'export agrégé est possible |
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
| Demande de suppression du compte | Re-authentification par code, puis anonymisation **automatique** au tour suivant du worker, sans validation d'un `admin` (D72) ; toutes les sessions sont fermées au dépôt ; propagation prioritaire vers Brevo et Apollo (RG57, RG73) |
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

**CA44** — *(RG84 amendée.)* *Étant donné* le pays d'un annonceur consentant dans la liste des pays
exclus, *quand* il s'inscrit, *alors* **aucun envoi vers Apollo n'a lieu** et la ligne indique « pays exclu
de la prospection » ; avec la liste vide, il est envoyé.

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

**CA64** — *Étant donné* un administrateur, *quand* il cherche à exporter la liste des inscrits,
*alors* aucun export nominatif n'existe (RG106) : seul l'export **agrégé**, sans ligne nominative,
est possible ; il exige une re-authentification et un motif, et est journalisé nominativement.
*(Réécrit le 2026-10-16, EC-J8-1 : la première rédaction contredisait RG106. Aucun export au
Lot 1 ; l'export agrégé relève du Lot 5, `15` §I.)*

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
| Tout montant, taux, commission, facture | **A1**, `CLAUDE.md` §2 | V2 |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **Base légale de la synchronisation Apollo** : consentement (`CLAUDE.md` §6) ou intérêt légitime avec droit d'opposition (skill `apollo-lead-sync`) ? Les deux textes de référence divergent | **Consentement requis** (position conservatrice). Les deux comportements sont spécifiés (RG83) et la bascule est une valeur de configuration | `expert-conformite-rgpd` (**veto**) + juriste | **Avant la mise en ligne du Lot 1** |
| **Q2** | **D33 — périmètre Apollo** à la mise en ligne : annonceurs seuls, annonceurs + créateurs professionnels, ou tous les inscrits (A7) ? | `annonceurs_et_createurs_pro`, **position d'attente et non contre-arbitrage** ; le fondateur bascule sans redéploiement (RG81) | Fondateur + `expert-conformite-rgpd` (**veto**) + juriste | **Avant la mise en ligne du Lot 1** |
| **Q3** | **Pays dans lesquels la prospection Apollo est validée** (CASL au Canada, lois des États américains, LGPD au Brésil, UE) | *Tranchée par le fondateur (2026-10-19, D33)* : **tous les pays** par défaut, liste de pays **exclus** vide par défaut (RG84, 0141) ; avis juriste toujours attendu avant `production` | `expert-conformite-rgpd` + juriste | Avant la mise en ligne du Lot 1 |
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

---

## Additif du 2026-09-24 — Invitation par un commercial (D54) et source d'acquisition (D55)

> **Arbitrages du fondateur du 2026-09-24** (`decisions.md`, revue `archives/19-revue-de-coherence-2026-09-24.md`).
> Cadre de règles ; écrans et critères d'acceptation à compléter par `product-owner` et `expert-ux`,
> **avis obligatoire d'`expert-conformite-rgpd` (veto)** sur RG118 et RG121. Numérotation reprise
> après RG115.

### Invitation nominative (D54)

**RG116** — Un `agent` ou un `admin` peut créer une **invitation nominative** pour une marque ou un
créateur de son réseau : adresse e-mail, rôle proposé (annonceur ou créateur), langue. L'invitation
porte un **code unique**, à usage unique, avec une durée de validité en configuration (valeur
d'attente : 30 jours).

**RG117** — **L'inscription reste faite par la personne invitée**, par le parcours normal : elle
choisit elle-même son rôle final, accepte les CGU, coche ou non le consentement marketing, atteste sa
majorité. **Aucun profil n'est pré-rempli par un tiers**, aucun consentement n'est hérité de
l'invitation. L'adresse saisie à l'inscription peut différer de celle de l'invitation.

**RG118** — L'**e-mail d'invitation** est un envoi à une personne non inscrite : il suit **les règles
de la saisie libre** du backoffice (`16`, source 3, **D35**) — plafonds par rôle, pays où la
prospection est validée, lien de désinscription, journalisation nominative. Un commercial peut aussi
transmettre le lien lui-même (message, rendez-vous) : l'invitation vaut alors sans e-mail d'INFLUX.

**RG119** — À l'inscription par un code valide, le commercial auteur de l'invitation devient le
**commercial responsable du compte** (`backoffice.ownership_assignments`), et la source
d'acquisition `invitation` est enregistrée avec le code (RG120). Une invitation expirée ou déjà
utilisée n'empêche jamais l'inscription : elle est simplement sans effet d'attribution.

### Source d'acquisition (D55)

**RG120** — Chaque inscription enregistre sa **source d'acquisition**, une fois, à la création du
compte : les paramètres **UTM** (`utm_source`, `utm_medium`, `utm_campaign`), le **site d'origine**
(domaine seulement, jamais l'adresse complète), le **code d'invitation** éventuel, et la **réponse à
la question facultative** « Comment avez-vous connu INFLUX ? » (liste fermée : recherche en ligne ·
réseaux sociaux · bouche-à-oreille · un commercial INFLUX · un événement · autre). Ces valeurs ne
sont jamais modifiées ensuite.

**RG121** — **Aucun traceur de suivi entre visites.** Seuls les paramètres présents **dans la session
d'inscription** sont retenus ; ils sont transmis d'écran en écran dans le parcours ou conservés côté
serveur. Tout stockage dans le navigateur, et toute attribution sur plusieurs visites, relèvent du
consentement aux traceurs (`docs/landing-page/11-consentement-cookies.md`) et ne sont pas prévus au
MVP. À valider par `expert-conformite-rgpd` (**veto**).

**RG122** — La source d'acquisition est transmise à **Brevo** comme attributs de segmentation
(`lead.created`, charge utile réduite ; une valeur absente est envoyée vide, RG88) et affichée sur la
fiche de compte du backoffice. Elle n'est **jamais** transmise à Apollo.io et n'est jamais visible
d'un autre membre.

**RG123** — **Indicateurs** : inscriptions par source et par rôle, taux de complétion du profil par
source, part des inscriptions issues d'une invitation et taux d'utilisation des invitations par
commercial.

---

## Additif du 2026-09-25 — Consentement obligatoire à l'inscription (D63)

> **Arbitrage du fondateur du 2026-09-25, pris contre la recommandation.** `expert-conformite-rgpd`
> **conserve son veto** ; la **validation d'un juriste est obligatoire avant la mise en ligne du
> Lot 1** (même régime que D33).

**RG124** — La case de consentement à l'enregistrement du contact dans **Brevo et Apollo.io** est
**obligatoire** dans les deux portes, **non pré-cochée**, distincte de l'acceptation des CGU (RG23
inchangée). Sans elle, **aucun compte n'est créé** : message `signup.consent.errors.required`, focus
sur la case. Elle remplace RG30 ; RG11 et RG17 sont modifiées en conséquence.

**RG125** — Chaque inscription devient un **contact Brevo sous 1 heure** et, **quand la
configuration l'autorise** (périmètre RG81, base légale RG83, pays RG84, qualification RG82), un
**contact Apollo sous 24 heures**. La règle « ignoré — sans consentement » (RG36, RG80) ne
s'applique plus à l'inscription ; elle reste valable après un **retrait** ultérieur.

**RG126** — Le retrait reste possible **à tout moment**, en une action (RG34), prend effet
immédiatement et **ne supprime pas le compte** (RG94). L'accès au service n'est donc conditionné
qu'au moment de l'inscription — point précisément soumis au juriste.

**RG127** — Le libellé cite Brevo, Apollo.io et les deux finalités (RG31) ; il perd le mot
« Facultatif » et indique que la case est requise pour créer un compte, ainsi que la possibilité de
retirer son accord ensuite. Rédaction : `expert-marketing` + `expert-conformite-rgpd` + juriste (Q12).

| Clé | Français | English |
|---|---|---|
| `signup.consent.errors.required` | Pour créer votre compte, vous devez accepter que vos coordonnées soient enregistrées dans nos outils Brevo et Apollo.io. Vous pourrez retirer cet accord à tout moment depuis votre espace. | To create your account, you must agree to your contact details being recorded in our tools Brevo and Apollo.io. You can withdraw this consent at any time from your account. |

**Critères d'acceptation modifiés.** **CA5** devient : *étant donné* un formulaire complet avec la
case de consentement **non cochée**, *quand* le visiteur valide, *alors* le message
`signup.consent.errors.required` s'affiche et **aucun compte n'est créé**. **CA39** ne vaut plus
qu'après un retrait de consentement. **Q10** (une case ou deux) reste ouverte : si deux cases sont
exigées, les deux sont obligatoires.

**Risque, écrit pour être refusé explicitement s'il ne l'est pas.** Au sens du RGPD (art. 7 §4), un
consentement dont dépend l'accès à un service risque de ne pas être libre, donc d'être nul ; les
envois vers Brevo et Apollo perdraient alors leur base légale. Parades à instruire : exécution du
contrat ou intérêt légitime pour une partie des traitements (Q1), ou retour à un consentement
facultatif — une **valeur de configuration** (`signup_consent_required`, vrai par défaut) permet de
revenir en arrière **sans redéploiement**.

---

## Additif du 2026-09-27 — Précisions du J3 : phrase de correspondance, e-mail du code, messages, signal « navigateur inconnu » *(J3, 2026-09-27)*

> **Demandé par** `21` §4, J3-H (ligne `product-owner`, `expert-ux`), **avant** le commit 8 (envoi
> du code) et le commit 12 (écrans minimaux). **Ce qui suit précise** RG48, RG49, RG55, RG56 et
> RG112 ; rien n'y est retranché, **sauf le pays approximatif**, retiré au MVP par EC-43 (avis
> d'`expert-conformite-rgpd` et arbitrage d'`expert-cybersecurite` du 2026-09-27, `03` S-12).
> Textes des e-mails : `16` RG156 à RG159. Écrans : `17` §3.7 (membre), `17b` §3.14 (backoffice).
> Numérotation reprise après RG127 et CA70. **Aucun montant, aucun taux** (RG9).

### Phrase de correspondance — précise RG48

**RG128 — Composition.** La phrase compte **exactement deux mots, distincts**, tirés d'une **liste
fermée de 256 mots propre à la langue** (listes ci-dessous). Premier mot : tirage uniforme parmi les
256 ; second : tirage uniforme parmi les 255 autres. Source : générateur aléatoire cryptographique
(`randomInt` de `node:crypto`, `21` J3-B). L'ordre compte : 65 280 phrases possibles par langue. La
phrase n'est **jamais** dérivée de l'adresse, du compte, de l'heure, du code ni d'un compteur.

**RG129 — Langue de la phrase : celle de la page où la demande a été faite, jamais celle du
compte.** La phrase figure dans la réponse à la demande de code (`02` §18.10) : si sa langue suivait
celle du compte, elle révélerait qu'un compte existe, et sa langue (RG46, RG113). Conséquence
assumée : quand l'e-mail part dans la langue du compte (RG49) et que celle-ci diffère de la page, la
phrase y figure **telle qu'à l'écran**, dans la langue de la page, sous le libellé de la langue de
l'e-mail.

**RG130 — Une phrase par code envoyé.** Chaque demande dont l'issue est `sent` reçoit une phrase
nouvelle, qui accompagne ce code et lui seul. Une demande qui n'aboutit pas (plafond, adresse non
délivrable, service indisponible) **ne produit aucune phrase et ne change pas celle qui est
affichée** : l'écran 2 continue d'afficher la phrase du code en cours. **Changer la langue de la page
ne change pas la phrase** : l'e-mail est déjà parti avec elle. L'élément qui l'affiche déclare sa
propre langue, pour qu'un lecteur d'écran la prononce correctement.

**RG131 — Où elle figure, et nulle part ailleurs.**

| Emplacement | Détail |
|---|---|
| Écran 2 | **Au-dessus** du champ de code, dans un encadré (`17` §3.2) ; réaffichée à l'identique après un rechargement de la page, tant que le parcours est valide |
| E-mail `auth.login_code` | Dans le corps, **sous le code** (`16` RG156) |
| En transit seulement | Réponse à la demande de code (`matchingPhrase`, **uniquement si `sent`**) et cookie de parcours signé (`21` J3-C, règle 8), qui sert au réaffichage |

Elle n'apparaît **jamais** : dans l'objet ni dans le texte d'aperçu de l'e-mail ; dans l'adresse
d'une page ; dans une table ; dans un journal applicatif ou d'audit (clé masquée `matchingPhrase`,
`21` J3-C règle 7) ; au backoffice.

**RG132 — Présentation.** Les mots sont écrits en **minuscules**, séparés par une espace
(« ancre lune » ; « lantern owl »). Des capitales ne sont permises **que par le style**, jamais en
modifiant le texte : un lecteur d'écran épelle un mot écrit en capitales. Graphie identique, accents
compris, à l'écran et dans l'e-mail.

**RG133 — Critères des listes.** Les critères 1 à 4 sont vérifiés par un test automatisé ; les
critères 5 à 9, par la relecture de RG134.

1. **256 mots exactement** par langue, sans doublon.
2. **De 3 à 7 lettres**, uniquement des lettres minuscules de la langue — accents français permis ;
   ni espace, ni trait d'union, ni apostrophe, ni chiffre, ni ligature (`œ`, `æ`).
3. **Deux mots d'une même liste diffèrent d'au moins deux lettres** : distance d'édition (insertion,
   suppression, substitution) **≥ 2**, calculée **après retrait des accents**. « lune » et « dune »,
   « foret » et « furet », « tower » et « towel » ne peuvent pas coexister.
4. **Aucun homophone** d'un autre mot de la liste.
5. **Noms communs concrets, au singulier**, compris d'un lecteur non spécialiste : nature, animaux,
   objets, aliments, loisirs. Aucun nom propre. En anglais, **orthographe identique en anglais
   américain et britannique** (ni *colour*, ni *theatre* / *theater*, ni *yogurt*).
6. **Rien d'offensant ni de connoté, en français, en anglais ni en portugais** (langue suivante,
   `CLAUDE.md` §1) : aucune insulte ni sens argotique courant (écartés, par exemple : « pelote »,
   « bonbon », « melon », « raton », « phoque » ; *pine*, qui est vulgaire en français ; *slope*,
   *cracker*, *grape*) ; rien sur le corps, la violence, les armes, la mort, la maladie, la religion,
   la politique, une nationalité ou une couleur de peau ; aucune couleur.
7. **Rien qui évoque un montant ou l'argent** : nombres, monnaies, métaux précieux, banque, prix,
   cadeau, et les sens argotiques de l'argent (écartés : « radis », « galette », « tapis »,
   « amande » (homophone d'« amende ») ; *cabbage*, *bread*, *dough*, *mint*, *peanut*, *cashew*).
8. **Aucun mot dont le sens premier est une marque**, un produit ou un service (écartés : « kayak »,
   « citron », « domino », *apple*, *orange*, *jaguar*, *lotus*, *meerkat*, *octopus*, *juniper*).
9. **Aucun mot du vocabulaire d'INFLUX ni de la connexion** (code, clé, compte, lien, marque,
   campagne, contrat, porte, fil, bouton, cookie, session…) : une phrase ne doit jamais se lire comme
   une instruction.

**RG134 — Tenue des listes.** Les deux listes ci-dessous sont **la référence** : le fichier de
données du code les reprend à l'identique (emplacement choisi par `dev-react-node`), et les tests de
RG133 portent sur ce fichier. Une liste ne change que par **remplacement d'un mot** par un autre qui
satisfait RG133, en revue de code, le total restant 256. **Avant la mise en ligne du Lot 1**, chaque
liste est relue par une personne de langue maternelle française, anglaise et portugaise (Q16). Un mot
jugé malheureux après la mise en ligne est remplacé sans délai : aucune phrase n'est conservée, rien
ne dépend d'un mot donné.

**Liste française — 256 mots** (8 de 3 lettres, 24 de 4, 69 de 5, 92 de 6, 63 de 7) :

- **3 lettres** — île, jus, lac, mer, nid, riz, ski, thé
- **4 lettres** — baie, café, cerf, chou, ciel, élan, gant, gare, houx, iris, judo, lait, lion,
  loup, lune, moto, ours, pont, quai, seau, surf, thym, tour, vélo
- **5 lettres** — aigle, ancre, arbre, astre, banjo, bison, botte, brume, bulle, canoë, cèdre,
  chêne, crabe, crêpe, cygne, danse, datte, étang, figue, fleur, flûte, forêt, fusée, galet, genêt,
  givre, glace, globe, hamac, harpe, héron, hibou, igloo, koala, lampe, lilas, merle, morse, neige,
  nuage, oasis, olive, opéra, orque, panda, pêche, phare, piano, plage, pluie, poney, puits, récif,
  robot, rosée, ruban, salsa, sapin, saule, sirop, soupe, stade, stylo, tango, tasse, tente, tigre,
  train, zèbre
- **6 lettres** — acacia, aimant, alpaga, ananas, aurore, aviron, ballon, bambou, barque, bateau,
  bélier, bleuet, bonnet, bougie, cabane, cactus, cahier, canard, canyon, carnet, cerise, chaise,
  chalet, cheval, chèvre, cirque, comète, corail, crayon, dahlia, désert, éclair, érable, étoile,
  faucon, flèche, fraise, gaufre, girafe, graine, grange, grotte, homard, jardin, jasmin, lagune,
  lézard, lierre, loutre, mangue, marais, méduse, menthe, mimosa, miroir, mousse, mouton, muguet,
  navire, oignon, otarie, oursin, persil, pétale, pinson, plaine, racine, radeau, raisin, renard,
  roseau, ruelle, salade, saumon, soleil, sommet, sorbet, source, tennis, tomate, tortue, toucan,
  trèfle, tricot, truite, tulipe, valise, vallée, verger, violon, volcan, yaourt
- **7 lettres** — abeille, abricot, armoire, atelier, basilic, biscuit, bosquet, bouleau, brioche,
  caillou, camélia, caramel, cascade, chapeau, colibri, colline, criquet, dauphin, échelle,
  écharpe, étagère, falaise, fenêtre, ficelle, flamant, fougère, fromage, gazelle, glacier, grillon,
  guépard, guitare, horloge, lavande, luciole, marelle, moineau, mouette, olivier, palmier, parasol,
  pélican, pieuvre, pinceau, piscine, pivoine, planète, poireau, poisson, poivron, potager, prairie,
  praline, rivière, sandale, sardine, sifflet, tambour, taureau, théâtre, vanille, village, voilier

**Liste anglaise — 256 mots** (15 de 3 lettres, 50 de 4, 70 de 5, 75 de 6, 46 de 7) :

- **3 lettres** — bay, bee, dew, egg, elk, fog, hat, ivy, jar, map, oak, owl, sky, sun, tea
- **4 lettres** — barn, bear, bell, boat, cape, cove, dawn, deer, drum, duck, dune, fern, fork,
  gate, harp, hawk, hill, hive, iris, jazz, kite, lake, lamp, leaf, lily, milk, mist, moon, moss,
  park, peak, pier, pond, raft, rain, reef, rice, rock, sage, salt, sled, soup, star, surf, swan,
  tent, tree, tuba, wave, wolf
- **5 lettres** — acorn, banjo, basil, birch, bison, bloom, brook, brush, cabin, canoe, cedar,
  cello, chair, chess, cliff, clock, cloud, comet, coral, crane, daisy, eagle, field, finch, flute,
  frost, globe, grove, hazel, heron, holly, igloo, jelly, koala, lilac, maple, moose, ocean, olive,
  onion, otter, paint, panda, paper, pasta, peony, petal, piano, pizza, radio, raven, river, robin,
  robot, salad, salsa, scarf, shelf, shrub, skate, syrup, table, tango, tiger, toast, tower, tulip,
  wagon, waltz, zebra
- **6 lettres** — almond, alpaca, anchor, aurora, ballet, bamboo, breeze, bridge, butter, cactus,
  canary, candle, canyon, carpet, castle, chalet, cheese, circus, clover, coffee, crayon, dahlia,
  desert, falcon, forest, garden, garlic, guitar, hiking, hockey, island, karate, kettle, kitten,
  ladder, lagoon, lizard, magnet, marble, meadow, meteor, mirror, museum, noodle, orchid, oyster,
  papaya, parrot, pencil, planet, potato, puffin, rabbit, ribbon, rocket, salmon, sandal, sleigh,
  sorbet, spider, sprout, squash, summit, teapot, tennis, tomato, toucan, turtle, valley, violet,
  violin, waffle, walnut, walrus, willow
- **7 lettres** — apricot, avocado, balloon, bicycle, blanket, bowling, caramel, compass, cottage,
  cricket, curtain, cushion, custard, dolphin, feather, firefly, gazelle, giraffe, glacier, harvest,
  horizon, jasmine, lantern, leopard, lettuce, library, lobster, orchard, pancake, parsley, pelican,
  popcorn, prairie, pretzel, pudding, pumpkin, rainbow, scooter, seagull, seaside, sparrow, stadium,
  sunrise, thunder, vanilla, volcano

> Les deux listes ont été construites contre les critères 3 et 4 paire par paire, à la main. **Le
> test automatisé de RG133 fait foi** : s'il trouve une paire trop proche, un des deux mots est
> remplacé selon RG134, sans autre arbitrage.

### E-mail du code — précise RG49

**RG135 — Contenu de l'e-mail `auth.login_code`.** Exactement les éléments de `16` RG156, dans cet
ordre, et rien d'autre : le code, la phrase de correspondance, la durée et les conditions de validité,
**l'heure de la demande et le navigateur**, la conduite à tenir si l'on n'a rien demandé, la mention
« INFLUX ne vous demandera jamais ce code », la phrase qui explique pourquoi on reçoit l'e-mail
(`16` RG102). **Aucun pays**, aucune adresse IP, aucun nom, aucun rôle, **aucun lien** (`16` RG158),
et **aucune indication qu'un compte existe ou non** : le même e-mail part pour une inscription et
pour une connexion.

- **Heure** : dans le fuseau du compte s'il existe (`identity.accounts.timezone`), sinon en **UTC** ;
  le nom du fuseau est toujours écrit à côté de l'heure. Jamais un fuseau déduit de l'adresse IP.
- **Navigateur** : le résumé « famille + système » de `21` RG-J3-5 (ni version, ni modèle
  d'appareil). **Si aucun résumé n'est disponible, la phrase de contexte est écrite sans le
  navigateur** (variante de `16` RG156) — jamais « navigateur inconnu » par défaut, qui ferait croire
  à une anomalie (voir Q14).

### Messages de l'écran minimal du J3 — précise RG112 et RG113

**RG136 — Code expiré.** Dix minutes après la demande (horloge du serveur), **toute saisie** reçoit
`auth.code.errors.expired`, **quel que soit le code saisi**, et **ne décompte aucune tentative**. Au-delà
de quinze minutes, le parcours lui-même a expiré (RG47) : `auth.code.errors.sessionLost`. Le message
d'expiration ne dit jamais si le code saisi était le bon.

**RG137 — Tentatives.** Échecs 1 à 4 : `auth.code.errors.invalid`, avec le nombre d'essais restants
(4, 3, 2, 1). Cinquième échec : `auth.code.errors.tooManyAttempts` ; le champ de code est retiré, il
ne reste que « Demander un nouveau code », qui ramène à l'écran 1 **avec l'adresse pré-remplie**
(RG111). Plafond par réseau atteint (RG44, `21` EC-3 point 5) :
`auth.code.errors.tooManyRequests`, qui ne parle ni du code ni du compte.

**RG138 — Ce qui est identique pour tous, et ce qui ne l'est pas.**

| Moment | Messages possibles | Règle |
|---|---|---|
| **Avant la vérification du code** (écrans 1 et 2) | `auth.code.sent`, `auth.email.errors.undeliverable`, `auth.errors.serviceUnavailable`, `auth.email.errors.rateLimited`, `auth.code.resend.limit`, `auth.code.errors.*`, `auth.code.errors.verifyUnavailable` | **Strictement identiques** pour une adresse inscrite, inconnue, interne ou suspendue — contenu, statut et durée (RG46, RG113). Seul écart accepté : la cause (a) de `02` §18.5, arbitrée par `expert-cybersecurite` |
| **Après une vérification réussie** | `auth.roleMismatch.notice`, `auth.internalAccount.*`, `auth.suspended.*`, et au J3 seulement `auth.signup.notYetAvailable` | Autorisés à différer : la personne a prouvé qu'elle détient la boîte (RG67 à RG69) |

**RG139 — Adresse sans compte, au J3 seulement.** L'écran 3 n'existe qu'au J5. D'ici là, une
vérification réussie pour une adresse sans compte affiche `auth.signup.notYetAvailable` ; le jeton
d'inscription est émis comme prévu (`21` EC-4). **Ce message ne quitte jamais le poste local et
`staging` fermé** : il disparaît avec l'écran 3, avant toute mise en ligne.

**RG140 — Compte interne sur l'espace membre (RG68).** Après vérification : aucun cookie de session
membre, parcours effacé, message `auth.internalAccount.notice` et `auth.internalAccount.help`,
**sans lien vers l'espace interne et sans en citer l'adresse** (hypothèse conservatrice : la page
publique ne désigne pas l'hôte du backoffice). Compte suspendu (RG69) : `auth.suspended.*`, message
neutre ; tant que le canal de secours (RG65) n'existe pas (J5), le message ne propose pas d'autre
voie de contact.

**Nouvelles clés du J3** (s'ajoutent à RG112, à `17` §3.1 et à `17` §3.2, dont les clés sont reprises
telles quelles) :

| Clé | Français | English |
|---|---|---|
| `auth.step2.title` | Entrez le code | Enter the code |
| `auth.step2.sentTo` | Nous avons écrit à {email}. | We have sent it to {email}. |
| `auth.step2.changeEmail` | Modifier | Change |
| `auth.step2.phrase.label` | Votre phrase de correspondance | Your matching phrase |
| `auth.step2.phrase.help` | Vérifiez qu'elle est identique dans l'e-mail reçu. Si elle est différente, ne saisissez pas le code. | Check that it is identical in the email you received. If it is different, do not enter the code. |
| `auth.step2.codeLabel` | Code à 6 chiffres | 6-digit code |
| `auth.step2.submit` | Valider | Verify |
| `auth.step2.submitBusy` | Vérification… | Checking… |
| `auth.step2.stayInTab` | Restez dans cet onglet : le code ne fonctionne qu'ici. | Stay in this tab: the code only works here. |
| `auth.step2.resend` | Recevoir un nouveau code | Send me a new code |
| `auth.step2.newCode` | Demander un nouveau code | Request a new code |
| `auth.step2.notReceived` | Je ne reçois pas le code | I haven't received the code |
| `auth.step2.notReceived.checklist` | Vérifiez vos courriers indésirables et vos onglets « Promotions » ou « Notifications », puis l'orthographe de votre adresse. | Check your spam folder and your "Promotions" or "Updates" tabs, then the spelling of your address. |
| `auth.email.errors.rateLimited` | Trop de codes ont été demandés en peu de temps. Réessayez dans quelques minutes. | Too many codes have been requested in a short time. Please try again in a few minutes. |
| `auth.code.errors.tooManyRequests` | Trop de tentatives de connexion depuis ce réseau. Réessayez plus tard, au plus tard dans une heure. | Too many sign-in attempts from this network. Please try again later, within an hour at most. |
| `auth.code.errors.verifyUnavailable` | Nous ne parvenons pas à vérifier votre code pour le moment. Réessayez dans quelques instants. | We cannot check your code right now. Please try again in a moment. |
| `auth.internalAccount.title` | Espace interne | Internal workspace |
| `auth.internalAccount.help` | Aucune session n'a été ouverte ici. Connectez-vous depuis l'adresse de l'espace interne qui vous a été communiquée. | No session has been opened here. Sign in from the internal workspace address you were given. |
| `auth.suspended.title` | Compte inaccessible | Account unavailable |
| `auth.signup.notYetAvailable` | Aucun compte n'est associé à cette adresse, et la création de compte n'est pas encore ouverte. | No account is linked to this address, and account creation is not open yet. |
| `auth.restart` | Recommencer avec une autre adresse | Start again with another address |
| `auth.logout` | Me déconnecter | Sign out |
| `auth.logout.done` | Vous êtes déconnecté. | You are signed out. |
| `auth.browser.summary` | {family} sur {os} | {family} on {os} |
| `auth.browser.familyOnly` | {family} | {family} |
| `auth.browser.unidentified` | un navigateur non identifié | an unidentified browser |

Les noms de navigateurs et de systèmes (Chrome, Firefox, Safari, Edge, Windows, macOS, iOS, Android,
Linux…) ne se traduisent pas. **Écran 1 : `auth.email.errors.rateLimited`** (il n'y a pas de code en
cours dans cet onglet) ; **écran 2, bouton de renvoi : `auth.code.resend.limit`** de RG112 (le code
en cours reste valable, RG45).

### Signal « navigateur inconnu » — remplace « pays inhabituel » au MVP (EC-43)

**RG141 — Définition.** Le **navigateur** d'une session est son résumé « famille + système »
(`21` RG-J3-5 : ni version, ni modèle d'appareil) ; un résumé « non identifié » est une valeur comme
une autre. Une session membre s'ouvre depuis un **navigateur inconnu** quand **aucune autre session
du même compte portant le même résumé n'a eu d'activité au cours des 30 derniers jours**. La
**première session d'un compte** (celle qui suit sa création) ne déclenche jamais le signal.

**RG142 — Effet côté membre (précise RG55).** L'e-mail `auth.new_device` (`16` RG157) : date, heure
avec son fuseau, navigateur, conduite à tenir. **Au plus un par compte, par résumé et par jour**
(clé d'idempotence de `16` RG85). Aucun blocage, aucune étape supplémentaire, aucune suspension.

**RG143 — « Mes sessions » (précise RG56).** Colonnes : date de création, dernière activité,
navigateur ; la session courante est marquée « cet appareil ». **Aucune colonne de pays.** Texte
d'aide, lu aussi par `expert-conformite-rgpd` pour la politique de confidentialité :

| Clé | Français | English |
|---|---|---|
| `account.sessions.help` | Nous reconnaissons un navigateur à son type et à son système (par exemple « Firefox sur Windows »), jamais à votre position. Deux appareils du même type se ressemblent donc : vérifiez aussi les dates. | We recognise a browser by its type and operating system (for example "Firefox on Windows"), never by your location. Two devices of the same type therefore look alike: check the dates as well. |

**RG144 — Vocabulaire.** Face à un membre ou à un agent, le signal se dit **« nouveau navigateur »**
(*new browser*). Sont interdits, parce que nous ne savons pas les affirmer : « appareil inconnu »,
« lieu », « pays », « position », « connexion suspecte ». Le nom interne du signal reste « navigateur
inconnu ».

**RG145 — Côté backoffice (B-7, J8).** Même définition, sur les sessions backoffice du compte
interne ; effet : **une alerte** aux administrateurs, jamais une suspension automatique (condition de
l'avis de conformité). Libellés : `17b` §3.14.

**RG146 — Limite, écrite pour ne pas être oubliée.** Le signal est faible : une connexion depuis un
navigateur du même type et du même système qu'un navigateur déjà vu **ne le déclenche pas**. Il
détecte, il ne protège pas. Il est rouvert dès qu'une source de pays est activée (nouvel avis
`expert-conformite-rgpd`, `21` EC-43) ; la nouveauté du **réseau**, proposée par
`expert-cybersecurite`, n'en fait pas partie tant que cet avis n'est pas rendu.

### Cas limites du J3

| Situation | Comportement attendu |
|---|---|
| La personne change la langue de la page à l'écran 2 | Textes traduits, **phrase inchangée**, saisie conservée (RG130, RG111) |
| Compte en anglais, demande faite depuis la page française | E-mail en anglais (RG49), phrase **en français, comme à l'écran** (RG129) |
| Deux demandes successives dans le même onglet (renvoi) | Nouvelle phrase à l'écran ; l'ancien e-mail porte l'ancienne phrase, et son code est invalide (RG41) — la phrase aide à reconnaître le dernier e-mail reçu |
| Renvoi refusé par le plafond | Aucune phrase nouvelle ; la phrase et le code en cours restent valables (RG45, RG130) |
| Deux onglets demandent un code pour la même adresse | Le dernier parcours fait foi (un seul cookie par navigateur) ; le premier onglet peut afficher une phrase périmée. **Limite acceptée**, couverte par `auth.step2.stayInTab` |
| Code juste saisi à la 11ᵉ minute | `auth.code.errors.expired`, aucune tentative décomptée, le code n'est pas révélé comme juste (RG136) |
| Cinquième échec, puis nouvelle saisie | Le champ n'existe plus ; seul « Demander un nouveau code » reste (RG137) |
| Aucun résumé de navigateur disponible | E-mail du code sans la mention du navigateur (RG135) ; pour le signal, le résumé « non identifié » compte comme une valeur (RG141) |
| Un compte interne se connecte sur l'espace membre | Aucune session membre, aucun lien vers le backoffice (RG140) |
| Première session après la création du compte | Aucun e-mail « nouveau navigateur » (RG141) |
| Même navigateur, trente et un jours sans activité | E-mail « nouveau navigateur » : c'est voulu, la fenêtre est de 30 jours |

### Critères d'acceptation du J3

**CA71** — *Étant donné* une demande de code aboutie depuis la page française, *quand* on lit la
réponse, l'écran 2 et l'e-mail reçu par la doublure Brevo, *alors* la même phrase de deux mots
distincts, tirés de la liste française, figure dans les trois, en minuscules.

**CA72** — *Étant donné* un compte dont la langue est l'anglais, *quand* il demande un code depuis la
page française, *alors* la phrase de la réponse est tirée de la liste **française**, et rien dans la
réponse ne diffère d'une demande pour une adresse inconnue.

**CA73** — *Étant donné* le fichier de données des listes, *quand* le test de RG133 s'exécute,
*alors* chaque liste compte 256 mots uniques de 3 à 7 lettres autorisées, et aucune paire n'est à
une distance d'édition inférieure à 2 après retrait des accents.

**CA74** — *Étant donné* un parcours avec un code en cours, *quand* la page est rechargée ou sa langue
changée, *alors* la phrase affichée est identique à celle de l'e-mail.

**CA75** — *Étant donné* le flux de journal capturé et la base après une demande de code, *quand* on
y recherche les deux mots de la phrase, *alors* on ne les trouve nulle part (C-1 de `21`).

**CA76** — *Étant donné* un e-mail de code reçu, *quand* on l'examine, *alors* il ne contient ni
pays, ni adresse IP, ni lien ; l'heure porte le nom de son fuseau (UTC pour une adresse sans compte) ;
son objet et son texte d'aperçu ne contiennent ni le code ni la phrase.

**CA77** — *Étant donné* un code demandé il y a 11 minutes, *quand* le **bon** code est saisi,
*alors* le message d'expiration s'affiche et le nombre d'essais restants ne diminue pas.

**CA78** — *Étant donné* quatre échecs, *quand* un cinquième code faux est saisi, *alors*
`auth.code.errors.tooManyAttempts` s'affiche, le champ disparaît, et « Demander un nouveau code »
ramène à l'écran 1 avec l'adresse pré-remplie.

**CA79** — *Étant donné* un compte interne, *quand* son code est vérifié sur l'espace membre,
*alors* aucune session membre n'est créée et l'écran n'affiche ni lien ni adresse de l'espace
interne.

**CA80** — *Étant donné* un membre dont la seule session des 30 derniers jours porte « Firefox sur
Windows », *quand* il se connecte depuis « Safari sur iOS », *alors* un e-mail `auth.new_device`
part, sans pays ; *quand* il se reconnecte le même jour depuis ce Safari, *alors* aucun second e-mail
ne part.

**CA81** — *Étant donné* un compte qui vient d'être créé, *quand* sa première session s'ouvre,
*alors* aucun e-mail « nouveau navigateur » ne part.

### Questions ouvertes du J3

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q14** | **Le navigateur n'arrive pas jusqu'à `apps/api`.** L'en-tête `user-agent` ne figure pas dans la liste blanche du passe-plat (`03` PP-5). Sans lui, ni l'e-mail du code (A-8, RG49), ni `user_agent_summary` (EC-2, RG-J3-5), ni le signal « navigateur inconnu » ne peuvent citer le navigateur | E-mail écrit **sans le navigateur** (variante de `16` RG156) ; résumé « non identifié ». Options : ajouter `user-agent` à PP-5 (la chaîne brute n'est ni conservée ni journalisée, seul le résumé l'est) — avec ré-épinglage de `relay.ts` (PP-12) | `architecte` + **`expert-cybersecurite` (veto)** | **Avant le commit 8** (e-mail) et le commit 9 (sessions) — **Tranchée par `expert-cybersecurite` le 2026-09-27 : relayé, sous conditions.** Le passe-plat retransmet l'agent du navigateur **sous le nom `client-user-agent`**, seulement s'il correspond à `^[\x20-\x7E]{1,512}$`, sans troncature ni analyse (`03` PP-5) ; `apps/api` le lit après le secret interne, le re-valide et le **résume elle-même** en une valeur d'une liste fermée « famille + système » (dont « non identifié ») ; **seul le résumé est stocké** (`identity.sessions`, contrainte de format demandée à `expert-database`) ; **ni la chaîne brute ni le résumé ne sont journalisés** ; jamais transmis à GoTrue ; l'e-mail ne reçoit que le libellé traduit, « non identifié » ⇒ `contextNoBrowser` (RG135). Commit dédié avant le commit 8, empreinte PP-12 mise à jour dans le même commit. **Reste à `architecte`** : l'emplacement de la liste fermée partagée avec les fronts ; son contenu à `product-owner` (RG-J3-5). Détail et tests : `21` §4, « Revue de sécurité des commits 1 à 4 du J3 » |
| **Q15** | **Valeur réelle de la phrase contre un site d'hameçonnage qui relaie.** La phrase est renvoyée à celui qui fait la demande : un site contrefait qui relaie la demande à INFLUX reçoit la phrase et peut l'afficher. Elle protège contre les sites qui ne relaient pas, et aide à reconnaître le dernier e-mail reçu ; elle ne protège pas contre un relais en temps réel | RG48 maintenue telle quelle (coût nul). Complément possible : citer dans l'e-mail, en texte, le **nom de domaine officiel** où saisir le code, une fois les domaines réservés (`docs/mvp/prerequis.md` §14.3) — à peser contre la transformation automatique d'un nom de domaine en lien par les messageries | **`expert-cybersecurite`** | Avant la mise en ligne du Lot 1 |
| **Q16** | **Relecture des listes de mots** par des locuteurs natifs (français, anglais ; portugais pour le critère 6 de RG133) | Listes de RG133 utilisables en local et sur `staging` | `expert-marketing` | Avant la mise en ligne du Lot 1 |
| **Q17** | **Aucun lien dans les e-mails `auth.login_code` et `auth.new_device`**, y compris vers les préférences (dérogation à `16` RG102, `16` RG158) | Appliquée : zéro lien dans les deux e-mails de sécurité | `expert-cybersecurite` + `expert-conformite-rgpd` | Avant la mise en ligne du Lot 1 |

---

## Additif du 2026-10-17 — Une configuration de synchronisation manquante est un incident, jamais un cas normal (D67)

> **Statut : tranchée par `architecte` le 2026-10-17, avec amendements** (RG160 tableau, RG161
> mécanisme, RG163 journal, RG164 ordre d'évaluation, « À relire » ; `decisions.md` D67). **Constat** (`staging`,
> 2026-10-17) : deux inscriptions du fondateur finissent `brevo_contact` `skipped`
> `list_not_configured` — la clé `brevo_list_ids` vaut `{"advertisers": null, "creators": null}`
> (valeur de départ de `0103`) — et le backoffice les range en « cas normal », non rejouable. En
> production, un réglage oublié ou effacé ferait ainsi perdre **chaque inscrit** pour le CRM, sans
> alerte ni rattrapage : contraire à RG125 (D63), à `CLAUDE.md` §2 (« chaque inscrit doit arriver
> dans Brevo ») et §5 règle 4 (synchronisation rejouable). **Ce qui suit modifie** RG79, RG99, RG104
> et **précise** RG80, RG81. **Inchangés** : RG80 et RG103 pour l'absence de consentement, RG84
> (liste de pays vide = abstention voulue), les verrous de `staging` de `02` §12.4.

**RG160 — Ce qui manque à INFLUX n'est jamais « ignoré ».** Une ligne de file qui ne peut pas être
traitée parce qu'un **réglage d'INFLUX** manque ou est illisible passe en **échec**, de nature
**incident** (RG99, RG100), et non en « ignoré ». Liste fermée :

| Code de la ligne | Situation | Destination |
|---|---|---|
| `list_not_configured` *(code conservé)* | Identifiant de liste Brevo du rôle absent (`brevo_list_ids`) | `brevo_contact` |
| `template_not_configured` *(code conservé)* | Identifiant de modèle Brevo absent (`brevo_template_ids`) | `brevo_transactional` |
| `apollo_settings_invalid` *(code conservé)* | Réglage Apollo illisible (RG81, RG83, RG84) | `apollo_contact` |
| `credentials_missing` *(nouveau)* | **En production seulement** : ligne qualifiée, mais clé du service absente (aujourd'hui `skipped_no_credentials`) | Toutes ; **en pratique `apollo_contact`** : en production, `BREVO_MODE=live` exige déjà au démarrage la clé et l'expéditeur Brevo (`16` RG116) *(précisé par `architecte`, 2026-10-17)* |

1. **Aucun réessai selon le calendrier de RG79** : attendre ne corrige pas un réglage ; le rattrapage
   est celui de RG161.
2. **Visible et compté** : ligne dans la file 12 (`lead_sync_failures`, `15`), **nombre d'échecs non
   traités** de RG105, et **non synchronisé** dans les objectifs de 99 % de RG79.
3. **Alerté immédiatement**, dès la première ligne : AL25 à `admin` (`15` §F) et signal de
   surveillance interne (`02` §20.6, D60).
4. **La cause nomme le réglage** (« liste Brevo des créateurs », « modèle de bienvenue annonceur »),
   jamais une valeur, jamais une trace technique (RG99).
5. **Ce qui n'en dépend pas passe** : un retrait de consentement ou une suppression (RG78, RG92)
   n'utilise ni liste ni modèle ; il n'est jamais retenu par une configuration manquante.

**Restent des cas normaux, « ignorés »** (inchangé) : sans consentement (RG80, RG103), hors périmètre
Apollo (RG81), pays non validé — **y compris quand la liste est vide** (RG84 : une abstention voulue
n'est pas un réglage manquant), opposition, adresse non vérifiée, entreprise non identifiée (RG82),
compte inactif, et **hors production** les verrous de `02` §12.4 (`skipped_no_credentials`,
`skipped_non_production`).

**RG161 — Rattrapage automatique, et rejeu manuel.** Une ligne en échec de configuration est
**rejouable** au backoffice, à l'unité ou en lot (RG101, RG102), **et** elle est **remise en file
d'elle-même** dès que le réglage en cause redevient valide : **au plus tard 15 minutes** après la
correction, sans action humaine, quel que soit le chemin de la correction (écran d'administration ou
SQL). La remise en file garde la **même clé d'idempotence** (RG102) : aucun doublon de contact, aucun
e-mail de bienvenue envoyé deux fois (RG76). Elle procède par lots plafonnés et se journalise comme un
**rejeu système** (motif `configuration_restored`, nombre de lignes). Consentement et qualification
sont relus à la consommation (RG37, RG82) : un inscrit désinscrit entre-temps finit « ignoré — sans
consentement ». C'est l'analogue, pour les échecs de configuration, de la réévaluation de RG81.

*Bienvenue rattrapée, tranché par `chef-de-projet` le 2026-10-17 :* **aucun âge limite**. Un
e-mail de bienvenue rattrapé part quel que soit le délai depuis l'inscription (RG86 : transactionnel,
sans contenu promotionnel, un seul par compte). En production, les deux modèles de bienvenue sont
exigés au démarrage (RG162) et ne peuvent plus revenir à `NULL` (RG163) : le cas reste théorique, et
une règle d'âge coûterait un code d'issue et des tests sans bénéfice.

*Mécanisme, tranché par `architecte` le 2026-10-17 :* une **étape de la boucle du worker, dans
l'opération E-3** `leads.drain_outbox` (`03` §P7), sur le modèle de la reprise des lignes orphelines
(`18` TM1.10) : au démarrage, puis au plus une fois par minute entre deux tours. **Ni tâche E-4, ni
déclencheur SQL** : aucune entrée ni aucun motif nouveau au §P7, aucun `GRANT` nouveau, aucune file
nouvelle (`CLAUDE.md` §5). Une ligne en échec de configuration repart quand la **clé de réglage en
cause** (`list_not_configured` ⇒ `brevo_list_ids` ; `template_not_configured` ⇒
`brevo_template_ids` ; `apollo_settings_invalid` ⇒ les trois clés Apollo) a été modifiée **après le
début de la tentative** qui a échoué — et non après l'échec, pour ne pas manquer une correction faite
pendant la tentative ; pour `credentials_missing`, quand le processus a démarré après ce début (une
clé ne s'ajoute que par redéploiement). La date de modification de chaque clé est tenue **par la base**
quel que soit le chemin d'écriture (RG163). **La préparation du connecteur reste seule juge** : la
remise en file ne revalide rien elle-même ; une modification qui ne corrige pas produit au plus un
nouvel échec par ligne et par modification. Mise à jour conditionnelle, sûre à plusieurs instances,
200 lignes au plus par passage (RG101). Journal : ligne `pino` (motif, codes, nombre de lignes, jamais
un compte) et trace sur la ligne ; aucun acteur humain, donc pas d'écriture dans la chaîne d'audit.

**RG162 — Refus de démarrage du worker en environnement déployé.** Si l'environnement est déployé
(`isDeployedEnvironment`, D70 : `staging` ou `production`, jamais `development`), le worker
**refuse de démarrer** — sortie non nulle **avant** sa première boucle, message qui nomme le réglage et
la règle, **jamais la valeur** (`18` T17.9, T17.10) — quand l'un des réglages **indispensables à tout
inscrit** manque ou est illisible :

1. `brevo_list_ids` : `advertisers` **et** `creators`, entiers positifs ;
2. ~~`brevo_template_ids`~~ *(caduc depuis D69, aligné à la clôture du J9 : tous les e-mails de la
   file sont rédigés par INFLUX, aucun modèle Brevo n'est contrôlé)* ;
3. `retry_schedule` lisible ; `rate_limits` porteur d'un plafond pour chaque destination dotée d'une
   clé ;
4. si `APOLLO_API_KEY` est présente : `apollo_scope`, `apollo_legal_basis` et
   `apollo_excluded_countries` (`0141`) lisibles — une liste de pays **vide** est valide (RG84 amendée :
   tous les pays).

C'est l'esprit de `16` RG116 et de `02` §12.4 (« une production silencieusement muette serait aussi
grave qu'un envoi de test réel ») : **un refus, pas un avertissement**. Le contrôle **lit sans mettre
en cache** (RG81). Un refus ne perd rien : les inscriptions continuent (RG72), les lignes attendent en
`pending`, la sonde « worker arrêté » alerte (`02` §20.6).

**Volontairement hors du refus** : les autres modèles transactionnels (avis de changement d'adresse,
accusé « mes données », modèles des lots suivants) et la présence d'une clé Apollo quand des pays sont
validés. Ces réglages peuvent devenir nécessaires **après** le démarrage — une migration ajoute un
modèle à `NULL`, un `admin` valide un pays depuis le backoffice : en refuser le redémarrage
arrêterait aussi les retraits de consentement et les suppressions, dont le délai est **légal** (RG78,
RG92). Ils relèvent de RG160, RG161 et de la liste de contrôle de mise en ligne (`21` §5.8).

**En `development`, aucun refus** : au démarrage, une ligne `error` `leads.settings.missing_at_start`
nomme les réglages manquants, puis RG160 et RG164 s'appliquent.

**RG163 — Un identifiant Brevo renseigné ne redevient jamais vide.** Une fois renseigné dans
`leads.sync_settings`, un identifiant de liste ou de modèle peut être **remplacé** par un autre
identifiant valide, **jamais remis à `NULL` ni retiré** : contrôle en base, dans tous les
environnements. Sans cette garde, un réglage indispensable pourrait disparaître à chaud, et le
redémarrage suivant serait refusé (RG162). **Qui modifie, constaté le 2026-10-17** : les identifiants
Brevo n'ont **aucun écran** ; ils se posent par les variables du `worker` (D68, étape de démarrage
`apply_brevo_ids_from_environment`) ou par SQL (rôle propriétaire), selon le runbook, avec
confirmation du fondateur en production (`CLAUDE.md` §7 règle 4). *Implémentation (`0145`, aligné à la
clôture du J9)* : le journal `settings.changed` est écrit par un déclencheur seul ; le contexte d'un
changement (`reason_code`, 2V, réévaluation) passe par le réglage de transaction
`influx.sync_setting_change`, fermé, lié à la session et effacé à l'usage (sinon `22023`). Les trois réglages Apollo se
modifient au backoffice par un `admin` sous double validation (`0134`, RG81). Un écran pour les
identifiants Brevo n'est pas exigé au Lot 1 (point soumis à `architecte`, D67).

*Tranché par `architecte` le 2026-10-17 :* (1) la garde est un **déclencheur** sur
`leads.sync_settings` (une contrainte `CHECK` ne voit pas l'ancienne valeur) : il refuse le passage
d'un identifiant renseigné à `NULL`, le retrait d'une clé renseignée et la suppression de la ligne ;
ajouter une clé à `NULL` (nouveau modèle) reste possible. Seule une **migration relue** peut la lever.
Les suites `test:db` qui posent un identifiant doivent l'annuler par leur propre isolation, jamais par
une remise à `NULL`. (2) **Toute écriture** sur `leads.sync_settings`, par l'écran comme par SQL,
est journalisée par un **déclencheur** dans la chaîne d'audit (`settings.changed`, `04` §4.3) et tient
la date de modification de la clé (RG161) ; l'écrivain SQL est nommé par son rôle de connexion,
faute de compte (`CLAUDE.md` §5 règle 5). La fonction d'écriture de `0134` ne journalise plus elle-même,
pour qu'il n'y ait qu'un seul écrivain du journal. Conception détaillée : `expert-database`.
(3) L'**écran `admin`** des identifiants Brevo, sous double validation, **n'est pas exigé** :
*tranché par `chef-de-projet` le 2026-10-17*, **aucun écran au MVP**. Les identifiants se posent par
les variables d'environnement du `worker` (D68), ou par SQL, les deux voies étant journalisées.
Réexamen seulement si les changements deviennent fréquents.

**RG164 — En `dry_run` (`development` seulement, D70), la trace d'abord, le verdict ensuite.** Quand le mapping se
calcule sans le réglage manquant (liste ou modèle Brevo), le worker journalise **d'abord**
`leads.dry_run.would_send` (opération, code du modèle, noms des attributs) **avec les noms des
réglages manquants**, **puis** applique RG160 : la ligne finit en échec de configuration, comme en
production. La pile locale répète ainsi fidèlement la production : il n'est ni muet (une trace existe), ni
complaisant (pas de `succeeded` pour une configuration qui perdrait l'inscrit en production). Un
réglage Apollo illisible ne permet aucun mapping : échec sans `would_send` (la ligne
`leads.settings.invalid` existe déjà). Pour qu'une inscription de `development` finisse `succeeded` avec
`dry_run`, la pile locale porte des identifiants de listes et de modèles de test ; aucun appel n'en
découle (verrous de `02` §12.4 inchangés). `staging` n'est plus en `dry_run` (D70) : il relève de RG162.

*Contrat de préparation et ordre d'évaluation, tranchés par `architecte` le 2026-10-17.* La
préparation du connecteur, **sans appel ni effet**, rend l'une de trois issues : (a) **« ignoré »**
pour une cause normale (consentement, compte, qualification et périmètre Apollo, déjà envoyé…),
**toujours prioritaire** — une ligne sans consentement n'est jamais un échec de configuration, et
aucune trace `would_send` n'est écrite pour elle ; (b) un **échec** sans mapping (réglage Apollo
illisible, modèle non pris en charge) ; (c) une **description du mapping** accompagnée de la liste,
éventuellement vide, des **réglages manquants**, nommés dans une liste fermée de chemins
(`brevo_list_ids.creators`, `brevo_template_ids.account.welcome_advertiser`…), jamais une valeur.
Le worker applique ensuite, dans cet ordre : trace `would_send` en `dry_run`, avec les noms des
réglages manquants ; **contrôle de sortie** (`16` RG137 : `output_check_rejected` prime, et n'est
jamais remis en file automatiquement) ; **échec de configuration** si la liste n'est pas vide (en
`dry_run` comme en `live`) ; succès `dry_run` ; clé absente (production : `credentials_missing` ;
ailleurs : `skipped_no_credentials`, `18` T17.1 inchangé) ; liste blanche de `02` §12.4 ; appel. La
ligne en échec garde les noms des réglages manquants, qui alimentent la cause affichée (RG99).

### Critères d'acceptation de D67

**CA82** — *Étant donné* `brevo_list_ids.creators` à `NULL`, *quand* un créateur consentant
s'inscrit, *alors* la ligne `brevo_contact` passe en **échec** avec la cause « configuration
manquante : liste Brevo des créateurs », de nature **incident**, sans nouvelle tentative programmée ;
elle compte dans les échecs non traités, **n'apparaît pas** parmi les cas normaux, et AL25 est levée.

**CA83** — *Étant donné* la situation de CA82 et un e-mail de bienvenue déjà parti, *quand*
l'identifiant de liste est renseigné, *alors* dans les 15 minutes la ligne repart **sans action
humaine**, le contact est synchronisé, un rejeu système `configuration_restored` est journalisé, et
**aucun second e-mail de bienvenue** ne part.

**CA84** — *Étant donné* la situation de CA82, *quand* le membre retire son consentement, *alors* le
retrait est propagé à Brevo dans l'objectif de RG92, sans attendre la correction de la liste.

**CA85** — *Étant donné* un environnement déployé (`staging` ou `production`) et un identifiant de RG162 à `NULL`, *quand* le
worker démarre, *alors* il sort avec un code non nul avant sa première boucle, le message nomme la clé
(par exemple `brevo_list_ids.creators`) sans aucune valeur, et une inscription faite pendant ce temps
réussit, sa ligne restant `pending`. *Contre-test* : la même configuration en `development` démarre, avec
la ligne `leads.settings.missing_at_start`.

**CA86** — *Étant donné* `development` en `dry_run` et `account.welcome_creator` à `NULL`, *quand* un
créateur s'inscrit, *alors* `leads.dry_run.would_send` est journalisée avec le nom du réglage manquant,
**puis** la ligne passe en échec de configuration. *Contre-test* : avec les identifiants du compte de
test, la ligne finit `succeeded` avec `dry_run`.

**CA87** — *Étant donné* la production, un pays de prospection validé et aucune `APOLLO_API_KEY`,
*quand* un annonceur qualifié s'inscrit, *alors* la ligne Apollo passe en échec `credentials_missing`,
de nature incident. *Contre-test* : en `development` sans clé, la ligne reste `skipped_no_credentials`
(`18` T17.1, inchangé).

**CA88** — *Étant donné* un identifiant de liste ou de modèle Brevo renseigné, *quand* une écriture
tente de le remettre à `NULL` ou de le retirer, *alors* la base la refuse ; le remplacer par un autre
entier positif reste possible.

### À relire par `expert-cybersecurite` à la revue groupée de fin de J9 *(architecte, 2026-10-17)*

1. **Refus de démarrage (RG162)** : sortie non nulle avant toute boucle et avant toute écriture ;
   message et ligne `fatal` qui nomment la clé, jamais la valeur (T17.9) ; aucune donnée personnelle.
2. **Levier de déni de service** : qui peut rendre un réglage de RG162 illisible et bloquer le
   prochain redémarrage ? Les trois réglages Apollo, écrits par un `admin` sous double validation
   (`0134`), doivent être validés **à l'écriture** par le même schéma que celui du contrôle de
   démarrage ; les identifiants Brevo sont tenus par RG163.
3. **Garde RG163** : aucun rôle d'exécution ne peut la lever ni désactiver le déclencheur ; seule une
   migration relue le peut.
4. **Journal par déclencheur** : écriture dans la chaîne par la seule voie `audit.append()` (`03`
   §P7), attribution de l'écrivain SQL, aucun secret dans l'ancienne ou la nouvelle valeur.
5. **Remise en file (RG161)** : dans E-3, sans `GRANT` ni motif nouveau (T6 inchangé) ; si
   l'implémentation en exige un, c'est un motif nouveau à signer.
6. **Traces** : `would_send` et la cause affichée ne portent que des noms de réglages (D60).
