---
name: brevo-campaign
description: Intégrer l'API Brevo dans INFLUX — synchronisation des contacts, segmentation, scénarios de nurturing, e-mails transactionnels (dont la confirmation de mise en relation) et envois depuis le backoffice avec ses trois sources de destinataires. À utiliser pour toute connexion à Brevo, tout envoi d'e-mail et toute question de cadence, de délivrabilité ou de désinscription.
---

# Intégration Brevo

Brevo est l'outil d'emailing et de CRM d'INFLUX. Un lead non synchronisé est un lead perdu ;
un e-mail envoyé à tort est un incident.

Agents concernés : `expert-integrations-api` (principal), `expert-marketing`,
`expert-conformite-rgpd`, `dev-react-node`.

> **Mise à jour du 2026-09-19.** La spécification `docs/mvp/16-backoffice-emails-brevo.md` a été
> écrite, et la documentation officielle Brevo vérifiée à cette date. Cinq points de cette skill
> étaient **faux, optionnels à tort, ou absents** ; ils sont corrigés ci-dessous et signalés par la
> mention *(corrigé le 2026-09-19)* :
> 1. l'exigence de **webhooks à signature validée** — Brevo ne signe pas ses webhooks (§ Webhooks) ;
> 2. « séparer **si possible** » les flux — c'est désormais **obligatoire, et il y a trois flux**
>    (§ Trois flux, trois sous-domaines) ;
> 3. l'**idempotence côté Brevo** existe sur l'envoi transactionnel et n'était pas exploitée ;
> 4. le **goulot réel des limites de débit** n'était pas identifié (§ Limites de débit) ;
> 5. il manquait la **liste fermée de segments autorisés**, l'**exclusion systématique**,
>    l'**interrupteur d'urgence**, le **refus de démarrage hors production**, et le fait que
>    **rien n'est transmis à Brevo pendant la fenêtre d'annulation**.
>
> **En cas d'écart, `docs/mvp/16-backoffice-emails-brevo.md` fait autorité et cette skill est
> corrigée.**

## Avant toute intégration

1. **Lire la documentation officielle Brevo à jour.** L'API évolue : ne jamais coder de mémoire.
   Vérifier les opérations disponibles, les limites de débit et les codes d'erreur. **Inscrire la
   date de la vérification** dans le module d'intégration.
2. Vérifier avec `expert-marketing` le segment, la liste et le scénario visés.
3. Vérifier avec `expert-conformite-rgpd` la base légale et le consentement requis.
4. Vérifier que la clé API est bien gérée (skill `env-secrets`).
5. Avant toute implémentation de la **saisie libre** d'adresses, vérifier l'état de **D35**
   (plafonds et conditions), arbitrée par `expert-conformite-rgpd` (**veto**) et le fondateur.
   Tant que D35 est ouverte, la saisie libre ne se développe pas au-delà de la mécanique décrite
   ici, et aucun plafond n'est figé dans le code.
6. **Vérifier le flux visé et son sous-domaine** (transactionnel, marketing, prospection) : c'est
   l'expéditeur qui détermine le flux, **jamais le point d'accès technique utilisé**.
7. **Vérifier le mode d'envoi de l'environnement.** Hors production, un envoi réel est un incident,
   et le service doit refuser de démarrer s'il est configuré pour en faire un.

## Règles non négociables

1. **Jamais bloquant.** Une inscription réussit même si Brevo est indisponible. On émet un
   événement, on traite en asynchrone (skill `lead-pipeline`).
2. **Aucune synchronisation sans consentement enregistré.** Le consentement marketing est
   vérifié **avant** tout appel. Absence de consentement = pas de synchronisation, journalisée
   comme telle.
3. **Idempotence.** Rejouer une synchronisation ne crée pas de doublon et ne renvoie pas un
   e-mail déjà envoyé. Clé d'idempotence stable (identifiant INFLUX + type d'opération).
4. **Désinscription prioritaire.** Un contact désinscrit côté Brevo l'est aussi côté INFLUX, et
   inversement. Sur ce point, **Brevo fait foi**.
5. **Clé API côté serveur uniquement.** Jamais dans un bundle front, un dépôt ou un log.
6. **Clés distinctes par environnement.** En `staging`, clé de bac à sable ou intégration
   désactivée. **Un e-mail réellement envoyé depuis un environnement de test est un incident.**
   *(Renforcé le 2026-09-19.)* **Le service refuse de démarrer** si un envoi réel est configuré
   hors production : un avertissement se lit une fois, puis s'ignore.
7. **Toute tentative est journalisée** : événement, opération, statut, réponse, horodatage.
   Le backoffice affiche les échecs et permet le rejeu.
8. **Respect des limites de débit** : file d'attente, temporisation exponentielle plafonnée.
9. **Cadence plafonnée.** Aucun contact ne reçoit plus de N e-mails marketing par période
   glissante, **toutes sources de destinataires confondues** (voir « Cadence maximale par
   contact »). C'est ainsi qu'on brûle une base : la règle n'est pas négociable au cas par cas.
10. **Une adresse saisie librement n'entre jamais dans la base de contacts.** Elle part en
    **liste de suppression**, et l'envoi est journalisé nominativement.
11. **Trois flux, trois sous-domaines d'envoi** *(ajouté le 2026-09-19)*. Voir la section dédiée :
    ce n'est plus une optimisation de délivrabilité, **c'est une mesure de disponibilité**.
12. **Rien n'est transmis à Brevo pendant la fenêtre d'annulation** *(ajouté le 2026-09-19)*, et le
    périmètre est **recalculé à sa fin**. Sans cela, l'annulation est cosmétique.
13. **Un interrupteur d'urgence existe, et il ne coupe jamais le code de connexion**
    *(ajouté le 2026-09-19)*. Voir la section dédiée.
14. **Les webhooks Brevo ne sont pas signés** *(corrigé le 2026-09-19)* : l'authentification repose
    sur un faisceau de compensations, et **aucune preuve ne se fonde sur le seul contenu d'un
    webhook**. Voir la section dédiée.

## Attributs de contact INFLUX

Mapper au minimum, en accord avec `expert-marketing` :

| Attribut | Usage |
|---|---|
| Type de profil | **annonceur** ou **influenceur** — segmentation la plus structurante |
| Langue | **français** ou **anglais** — choix de la version de chaque e-mail |
| Pays | segmentation par marché, pays ouvert ou non aux contrats, règles locales |
| Étape de funnel | inscrit · profil complété · campagne publiée · en négociation · contrat signé |
| Complétude du profil | déclenche les relances de complétion |
| Secteur / thématique | personnalisation du contenu |
| Date d'inscription | scénarios de bienvenue et de réactivation |
| Consentement | valeur, date, source |

Un mauvais mapping se rattrape difficilement : **documenter chaque champ** (nom INFLUX, nom
Brevo, type, valeur par défaut, comportement si absent).

## Scénarios attendus (définis par `expert-marketing`)

Bienvenue annonceur · Bienvenue influenceur · Relance profil incomplet · Campagne sans
proposition · Mise en relation sans réponse · **Négociation sans signature** (le plus rentable) ·
Post-contrat · Réactivation · Ouverture d'un pays aux contrats.

Chaque scénario existe **en français et en anglais** et part dans la langue du contact.

## E-mails transactionnels

Distincts des campagnes marketing : ils relèvent de l'exécution du contrat, pas du consentement
marketing. Envoyés dans la langue de l'utilisateur. Exemples : confirmation d'inscription,
notification de mise en relation, réception d'un message, contrat signé, paiement reçu,
reversement effectué, facture.

> Ne jamais glisser de contenu promotionnel dans un e-mail transactionnel pour contourner
> l'absence de consentement — c'est un manquement.

*(Ajouté le 2026-09-19.)* Ils partent **du sous-domaine transactionnel, et de lui seul** (§ Trois
flux). Le **code de connexion** (**D37**) a un régime à part : chemin dédié, jamais mis dans une
file partagée avec les synchronisations de contacts, **jamais coupé par l'interrupteur d'urgence**,
et son échec s'affiche **immédiatement à la personne** — il n'y a là aucune action métier à
préserver. Partout ailleurs, **un échec d'envoi n'annule jamais l'action métier** : la révélation
est enregistrée, le message est enregistré, le badge est attribué ; l'e-mail est une conséquence,
jamais une condition.

**Catalogue complet des e-mails transactionnels** (38 entrées, avec déclencheur, destinataire,
priorité et clé d'idempotence) : `docs/mvp/16-backoffice-emails-brevo.md` §H. **Un e-mail
transactionnel qui n'y figure pas n'existe pas.**

Le cas le plus sensible, l'**e-mail de mise en relation**, a sa propre section plus bas.

## Envois déclenchés depuis le backoffice

> **Correction du 2026-09-18 (arbitrage A4 du fondateur).** L'envoi d'e-mails depuis le backoffice
> **fait partie du périmètre du MVP** (Lot 5). La formulation précédente de cette skill — envois
> « prévus juste après le MVP », l'équipe envoyant en attendant depuis l'interface Brevo — **est
> abrogée**. Elle renvoyait à `docs/cadrage-mvp.md`, lui-même remplacé par
> `docs/mvp/00-cadrage-mvp-v2.md`. La spécification détaillée est
> `docs/mvp/16-backoffice-emails-brevo.md`, produite par `expert-marketing`,
> `expert-integrations-api` et `expert-conformite-rgpd`.

Les agents envoient depuis le backoffice à partir de **trois sources de destinataires** distinctes,
qui n'ont ni la même base légale ni les mêmes garde-fous.

### Les trois sources de destinataires

| Source | Base légale | Contrôles obligatoires | Volume |
|---|---|---|---|
| **Contacts plateforme** — segment INFLUX construit sur les attributs ci-dessus | **Consentement** recueilli à l'inscription (case non pré-cochée, date et source enregistrées) | Consentement **revérifié au moment de l'envoi**, jamais à la constitution du segment — il a pu être retiré depuis · liste de suppression appliquée · **langue et pays du contact respectés** (version FR ou EN, règles locales) · rebonds durs écartés · cadence vérifiée | **Masse** |
| **Segment Brevo** — segment défini et maintenu dans Brevo | Consentement **côté Brevo** : sur ce périmètre, **Brevo fait foi** | Segment **lu au moment de l'envoi**, jamais figé à l'avance · **jamais recopié dans la base INFLUX**, ni les adresses ni les personnes · **volume affiché avant confirmation**, avec la mention « chiffre annoncé par Brevo, non vérifié par INFLUX » · cadence portée par une condition d'exclusion **dans le segment Brevo** · *(ajouté le 2026-09-19)* **le segment figure dans une liste fermée de segments autorisés** tenue par INFLUX · *(ajouté le 2026-09-19)* **une liste d'exclusion INFLUX est jointe à tout envoi de cette source** | **Masse** |
| **Saisie libre** — l'agent tape une adresse | **Aucune. C'est de la prospection.** Elle s'apprécie au cas par cas et pays par pays | **Envoi unitaire uniquement** : une adresse, jamais de liste collée ni d'import · **plafond par agent et par jour** · **adresse professionnelle uniquement** · **motif obligatoire saisi par l'agent**, conservé · **lien de désinscription obligatoire** · **journalisation nominative** (agent, adresse, motif, modèle, horodatage) · **l'adresse part en liste de suppression, jamais dans la base de contacts** · réservée à un rôle habilité (`agent` et `admin` restent distincts) | **1** |

Quatre règles transverses :

- **Une seule source par envoi.** Mélanger un segment consenti et des adresses prospectées rendrait
  la base légale indémontrable.
- **Les trois sources partagent le même journal d'envoi** et la même règle de cadence.
- *(Ajouté le 2026-09-19.)* **Aucun segment improvisé n'est envoyable.** Un segment Brevo n'est
  utilisable que s'il figure dans une **liste fermée de segments autorisés**, tenue dans une table
  de référence d'INFLUX et alimentée par `expert-marketing` avec l'accord
  d'`expert-conformite-rgpd`. Chaque entrée porte sa population, sa base légale documentée, et
  **si elle porte la condition d'exclusion de cadence**. Sans cette liste, n'importe quel segment
  créé à la main chez Brevo devient envoyable en deux clics depuis le backoffice — c'est
  exactement le trou que A4 cherchait à fermer.
- *(Ajouté le 2026-09-19.)* **Une liste d'exclusion INFLUX est jointe à *tout* envoi de source
  « segment Brevo ».** Elle contient les désinscrits, les plaintes, les adresses injoignables, les
  comptes supprimés et les adresses déjà prospectées. **Un envoi de cette source sans liste
  d'exclusion est un défaut bloquant** : c'est la seule protection d'INFLUX sur un périmètre qu'il
  ne lit pas.

> **Les conditions exactes et les plafonds de la saisie libre relèvent de D35**, arbitrée par
> `expert-conformite-rgpd` (**veto**) et le fondateur. Tant que D35 est ouverte, aucune valeur de
> plafond n'est écrite en dur : elle est **lue dans la configuration**, modifiable sans
> redéploiement, et chaque modification est journalisée.

### Cadence maximale par contact

Un contact ne doit pas être sur-sollicité, quelle que soit la source qui l'atteint.

| Règle | Valeur par défaut **proposée** |
|---|---|
| E-mails marketing par contact, sur 7 jours glissants | **2** |
| E-mails marketing par contact, sur 30 jours glissants | **6** |
| Délai minimal entre deux e-mails marketing au même contact | **48 h** |

- Ces valeurs sont **proposées, pas tranchées** : à confirmer par `expert-marketing` et
  `expert-conformite-rgpd`, rattachées à **D35**. Elles vivent en configuration, pas dans le code.
- **Toutes sources confondues** : un contact touché par un segment Brevo puis par un segment INFLUX
  a bien reçu deux e-mails.
- **Les e-mails transactionnels ne sont pas comptés** (exécution du service). Ils ne doivent jamais
  servir de véhicule promotionnel pour contourner la cadence.
- Un contact au-delà du plafond est **écarté automatiquement** ; l'agent voit le nombre d'écartés et
  le motif, et l'écartement est journalisé. Ce n'est pas une erreur.

> **Limite assumée sur la source « segment Brevo ».** INFLUX ne lit pas les destinataires d'un
> segment Brevo : il **ne peut donc pas** y vérifier la cadence contact par contact. La cadence y
> est portée **côté Brevo**, par une condition d'exclusion du segment appuyée sur deux attributs de
> contact **tenus à jour par INFLUX** : `dernier_envoi_marketing_le` et `nb_envois_marketing_30j`.
> Les contacts présents dans Brevo mais inconnus d'INFLUX ne sont couverts que par cette condition.
> Cette limite est documentée et acceptée ; il revient à `expert-marketing` d'intégrer la condition
> d'exclusion à chaque définition de segment.

### Mécanique d'envoi

1. **Choix de la source** — une seule parmi les trois — et du périmètre.
2. **Choix du modèle** et **aperçu obligatoire**, rendu réel, **dans les deux langues** si le
   périmètre est mixte. Aucun envoi possible sans aperçu affiché.
3. **Calcul du volume au moment de l'envoi** (pas à la constitution du segment) et **affichage
   détaillé des écartés par motif** : sans consentement, désinscrits, rebonds durs, en liste de
   suppression, hors cadence, langue ou pays non couverts.
4. **Double confirmation** : deux actions distinctes et de nature différente — par exemple une case
   de confirmation explicite **puis** la ressaisie du volume ou du nom du segment. Jamais deux clics
   au même endroit. Un envoi de masse ne part jamais d'un seul geste.
5. **Fenêtre d'annulation de 5 minutes** après le lancement : l'envoi est mis en attente et
   réellement annulable, sans effet, depuis le backoffice. L'annulation est journalisée.
   *(Précisé le 2026-09-19 — c'est ce qui rend l'annulation réelle plutôt que cosmétique.)*
   **Rien n'est transmis à Brevo pendant la fenêtre.** Le compte à rebours est visible depuis
   **n'importe quel écran** du backoffice, **n'importe quel agent ou administrateur peut annuler**
   (pas seulement l'auteur), et fermer le navigateur n'annule rien et n'empêche pas d'annuler
   depuis un autre poste.
5 bis. **Recalcul du périmètre à la fin de la fenêtre** *(ajouté le 2026-09-19)*. Cinq minutes
   suffisent à ce que quelqu'un se désinscrive : les destinataires devenus inéligibles sont écartés,
   avec leur motif au journal. **Si le volume recalculé s'écarte de plus d'un seuil du volume
   confirmé** (valeur d'attente : 10 % ou 50 destinataires, le plus petit des deux), **l'envoi ne
   part pas** : il est bloqué, alerté, et une **nouvelle confirmation** est exigée. Un tel écart en
   cinq minutes signifie que le périmètre n'était pas celui qu'on croyait.
6. **Journalisation nominative** : qui, quand, quelle source, quel segment ou quelle adresse, quel
   volume, quel modèle, quelle langue, le motif s'il s'agit d'une saisie libre, et l'annulation
   éventuelle.
7. **Remontée des résultats** dans le backoffice : ouvertures, clics, désinscriptions, rebonds,
   plaintes.
8. **Toute désinscription remonte immédiatement** dans INFLUX et vaut retrait du consentement.

## E-mails transactionnels de mise en relation

> Au MVP, quand un commercial **ouvre une mise en relation**, **un e-mail part aux deux parties**.
> Il porte la **référence de la mise en relation** (forme `MER-2026-000123`) et **la date
> d'ouverture**. C'est à la fois la confirmation professionnelle attendue par les deux parties et un
> élément de preuve.

- **E-mail transactionnel** relevant de l'**exécution du service**, pas du consentement marketing.
  Il part donc même sans consentement marketing — et **ne contient aucun contenu promotionnel**.
- **Idempotent** : un et un seul e-mail par mise en relation et par destinataire. Clé d'idempotence
  stable = identifiant de la mise en relation + destinataire + type d'e-mail. Un rejeu du pipeline
  ne renvoie jamais l'e-mail.
- **Le `messageId` retourné par Brevo est conservé**, rattaché à la mise en relation dans le
  registre d'événements : il **corrobore la preuve d'intermédiation** — un tiers a horodaté l'envoi.
- **Une mise en relation sans `messageId` confirmé remonte au backoffice** comme preuve incomplète,
  et reste rejouable.
- Envoi **après** la révélation d'identité, dans la langue de chaque partie, **un e-mail par
  partie** — jamais les deux en copie.
- **Les notifications de messagerie ne contiennent jamais le texte des messages.**
- Voir la skill **`intermediation-tracking`** pour la définition de l'objet mise en relation, du
  registre chaîné et de ce qui fait preuve.

## Trois flux, trois sous-domaines d'envoi *(règle refondue le 2026-09-19)*

> **La formulation précédente — « séparer *si possible* les flux transactionnel et marketing » —
> est abrogée.** Elle datait d'avant **D37**. Depuis que les membres se connectent avec **un code à
> six chiffres reçu par e-mail**, une plainte pour spam de trop ne fait plus tomber des campagnes
> en indésirables : **elle empêche des gens d'entrer dans leur compte.** La délivrabilité n'est plus
> un sujet marketing, c'est la disponibilité du produit.

| Flux | Sous-domaine | Ce qu'il porte | Pourquoi il est isolé |
|---|---|---|---|
| **Transactionnel** | `tx.<domaine>` *(proposition)* | Code de connexion, décisions, preuves, notifications | **Sa réputation est la disponibilité du produit.** Aucune campagne, jamais |
| **Marketing** | `news.<domaine>` | Contacts de la plateforme, segments Brevo | Une plainte marketing est probable ; elle ne doit coûter que du marketing |
| **Prospection** | `pro.<domaine>` | Saisie libre uniquement | Le flux le plus exposé au signalement. Il brûle en premier, **et il brûle seul** |

- **C'est l'expéditeur et le sous-domaine qui déterminent le flux, pas le point d'accès technique.**
  Un envoi de prospection emprunte le point d'accès d'envoi unitaire — le même que le code de
  connexion — et ce n'est **pas** pour autant un transactionnel. C'est le piège le plus coûteux de
  cette intégration.
- **SPF, DKIM et DMARC sont configurés sur les trois sous-domaines**, séparément, **avant le premier
  envoi** (avec `integrateur`).
- Montée en volume progressive sur un domaine neuf.
- Surveillance des taux de rebond et de plainte **par flux** : la séparation n'a de valeur que si on
  la mesure séparément.
- **Six indicateurs de délivrabilité du code de connexion** sont suivis dès le premier jour : délai
  médian (> 60 s alerte), **délai du 9ᵉ cas sur 10** (> 180 s), demandes sans connexion aboutie sous
  10 min (> 15 %), rebond dur, plainte, et **part des envois confirmés « délivrés »** (< 97 %). Le
  dépassement d'un seuil est un **incident d'exploitation**, pas un sujet marketing.

## Limites de débit, idempotence et contrat d'interface *(section ajoutée le 2026-09-19)*

**Vérifié sur la documentation officielle Brevo le 2026-09-19. À revérifier avant toute
implémentation : ces valeurs dépendent du palier du compte et évoluent. Elles se lisent en
configuration, jamais en dur.**

| Catégorie d'appel | Limite indicative, palier « général » | Ce qui s'y trouve | Conséquence de conception |
|---|---|---|---|
| **Transactionnel** | ~1 000 requêtes/seconde | Envoi unitaire | Jamais le goulot |
| **Contacts** | ~10 requêtes/seconde, ~36 000/heure | Créer, mettre à jour, désinscrire, liste de suppression | Suffisant pour la file de leads |
| **Autres points d'accès** | **~100 requêtes/heure** | **Lister les segments, créer une campagne, la déclencher** | **C'est le vrai goulot** |

- **Interdiction d'une campagne par destinataire.** Un envoi de masse crée **une** campagne et la
  déclenche : deux appels, pas vingt mille. Boucler sur l'envoi unitaire épuiserait la catégorie la
  plus contrainte et masquerait le dépassement derrière des réessais.
- **Idempotence à deux niveaux.** Brevo accepte un en-tête **`Idempotency-Key`** sur l'envoi
  transactionnel, et renvoie un **`messageId`**. Cet en-tête est **utilisé** — mais **en complément
  d'une contrainte d'unicité dans notre propre base**, jamais à sa place : ni la fenêtre de validité
  ni le comportement exact de l'idempotence du fournisseur ne nous appartiennent. **On ne s'en remet
  jamais à un tiers pour une garantie qu'on peut tenir soi-même.**
- **Respect du délai de temporisation renvoyé par Brevo** en cas de dépassement (`429`), sinon
  temporisation exponentielle **avec gigue** et plafond. Aucune rafale non contrôlée.
- **Contrat étroit** : le code n'expose pas « l'API Brevo » mais **huit opérations nommées**, dans
  un module unique. Changer de fournisseur doit revenir à réécrire un module, pas à irriguer tout
  le code. Un contrôle automatisé vérifie qu'aucun appel n'existe hors de ce module.

## Webhooks entrants : Brevo ne signe pas *(section ajoutée le 2026-09-19)*

> **Constat vérifié le 2026-09-19 : Brevo ne signe pas ses webhooks.** Ni HMAC, ni JWT, ni en-tête
> de signature. Ce qui est offert : plages d'adresses IP publiées, authentification basique dans
> l'URL, jeton porteur, **en-têtes personnalisés**.
>
> **L'ancienne exigence « signature validée » de cette skill et de l'agent
> `expert-integrations-api` était donc inapplicable.** Exiger une signature qui n'existe pas ne
> protège rien : cela fait seulement croire que le point d'entrée est vérifié.

**Six compensations, toutes obligatoires et cumulatives :**

1. **Jeton partagé en en-tête personnalisé**, long, aléatoire, comparé **en temps constant**, en
   variable d'environnement, **rotatif avec deux valeurs acceptées** pendant la bascule — sinon une
   rotation perd des désinscriptions, ce qui est un manquement.
2. **Chemin d'accès non devinable**, dédié, non indexé, jamais publié.
3. **Restriction aux plages d'adresses IP** publiées par Brevo, rafraîchies et surveillées.
4. **Fenêtre d'horodatage** : rejet de tout événement daté de plus de 15 minutes — c'est ce qui
   empêche le rejeu d'une capture ancienne.
5. **Idempotence** par identifiant de message + type d'événement + horodatage : un événement déjà vu
   est ignoré, sans erreur.
6. **Aucune preuve ni décision irréversible fondée sur le seul contenu du webhook.** Ce qui
   **retire un droit** (désinscription, plainte, rebond dur) est appliqué tel quel — c'est
   conservateur, le pire qu'un faux événement puisse faire est d'arrêter d'écrire à quelqu'un. Ce
   qui **crée une preuve** (la livraison confirmée d'un e-mail de mise en relation) est
   **revérifié par un appel sortant** avant d'être inscrit au registre.

Le récepteur **accuse réception vite et traite après** : un traitement lent fait recommencer le
fournisseur et multiplie les doublons. Tout événement d'un type inconnu est **accepté, journalisé et
ignoré**, jamais rejeté : une évolution de Brevo ne doit pas faire tomber le récepteur.

**Cet écart est soumis à `expert-cybersecurite` (veto)** — voir
`docs/mvp/16-backoffice-emails-brevo.md` §M6 et **Q3**.

## Interrupteur d'urgence *(section ajoutée le 2026-09-19)*

Un `admin` doit pouvoir **tout arrêter en un geste**, sans redéploiement, avec motif obligatoire.

| Niveau | Ce qui s'arrête | Ce qui continue |
|---|---|---|
| **Marketing suspendu** | Les trois sources, les scénarios de nurturing, et **les envois en fenêtre d'annulation, qui sont annulés** | **Tous les e-mails transactionnels** |
| **Tout suspendu** | Ce qui précède, plus les transactionnels non critiques, **mis en attente et non perdus** | **Le code de connexion et les alertes critiques internes** |

- **Le code de connexion n'est jamais coupé par l'interrupteur.** C'est une règle, pas une option de
  configuration : le couper reviendrait à fermer la plateforme à tous ses membres pour régler un
  problème de réputation.
- **Déclenchement automatique** sur : taux de plainte au-delà du seuil (valeur d'attente 0,3 % sur
  24 h), rebond dur au-delà du seuil (5 % sur un envoi), ou **clé d'accès refusée** — car on ne sait
  alors plus ce qui part. **L'automatisme suspend, il ne reprend jamais seul.**
- **La reprise est humaine, motivée, journalisée et alertée**, et un bandeau permanent signale
  l'état suspendu tant qu'il dure. Les envois annulés par l'interrupteur **ne repartent jamais
  automatiquement**.

## Garde-fou d'environnement

> **Un e-mail réellement envoyé depuis `staging` est un incident.** Le risque est aggravé depuis
> A4 : le backoffice peut désormais déclencher des envois, y compris de masse.

- **Clés distinctes par environnement**, la clé de production n'existe jamais ailleurs qu'en
  production (skill **`env-secrets`**).
- Hors production : intégration **désactivée** (valeur par défaut), ou envoi **redirigé** vers une
  liste fermée d'adresses internes autorisées. Jamais de destinataire réel. **La substitution se
  fait au dernier moment, juste avant l'appel sortant**, et elle est journalisée avec l'adresse
  d'origine.
- *(Ajouté le 2026-09-19.)* **Le service refuse de démarrer** si un envoi réel est configuré hors
  production, ou si les trois sous-domaines d'envoi ne sont pas authentifiés. **Un refus de
  démarrage, pas un avertissement** : un avertissement se lit une fois, puis s'ignore.
- *(Ajouté le 2026-09-19.)* **Aucune donnée de production dans un autre environnement** : les
  adresses de `staging` sont **synthétiques**. Le mode redirigé est une **seconde** ceinture, pas
  la première.
- **Bandeau d'environnement visible en permanence** dans un backoffice non production, avec un
  **libellé écrit** — jamais une simple couleur.
- **La saisie libre est désactivée hors production**, sans exception : **absente**, avec une phrase
  qui explique pourquoi — ni redirigée, ni « désactivée mais visible ».
- Tout envoi réel constaté depuis un environnement de test **se déclare comme incident** :
  coupure de la clé, recensement des destinataires atteints, information des personnes si
  nécessaire, consignation écrite, revue en réunion de sécurité.

## Gestion des erreurs

| Type | Traitement |
|---|---|
| Transitoire (5xx, limite de débit) | Réessai avec temporisation exponentielle plafonnée |
| Permanente (adresse invalide, contact refusé) | Échec journalisé, pas de réessai, remontée backoffice |
| Authentification (clé invalide/expirée) | Alerte immédiate, arrêt de la file, intervention humaine |

## Tests

Aucun test ne touche Brevo réellement. Doublure obligatoire, dont le contrat est figé par des
**échanges enregistrés** — requête et réponse réelles, capturées une fois, expurgées de tout secret.
Couvrir : consentement absent, **consentement retiré entre la constitution du segment et l'envoi**,
service indisponible, limite de débit avec délai de temporisation respecté, **clé refusée**, rejeu
(idempotence), désinscription propagée, **webhook rejoué**, **webhook au jeton invalide**,
**webhook hors fenêtre d'horodatage**, **annulation dans la fenêtre (aucun appel sortant n'a eu
lieu)**, **écart de volume au-delà du seuil**, **interrupteur d'urgence (le code de connexion part
toujours)**, **mode redirigé (aucun destinataire réel)**, et **refus de démarrage hors production**.
Liste complète : `docs/mvp/16-backoffice-emails-brevo.md` §M7.

## Checklist

- [ ] Documentation officielle consultée, **date de vérification inscrite dans le code**
- [ ] Consentement vérifié avant tout appel
- [ ] Idempotence en place, **par une contrainte locale** et, en complément, l'en-tête
      `Idempotency-Key`
- [ ] Clé en variable d'environnement, distincte par environnement
- [ ] Traitement asynchrone, non bloquant
- [ ] Journalisation et rejeu disponibles au backoffice
- [ ] Mapping des attributs documenté
- [ ] Doublures de test en place
- [ ] Validation `expert-conformite-rgpd` sur le consentement et les mentions
- [ ] Source de destinataires identifiée, et une seule par envoi
- [ ] Consentement revérifié **au moment de l'envoi**, pas à la constitution du segment
- [ ] Segment Brevo lu à l'envoi, jamais recopié dans INFLUX
- [ ] Saisie libre : unitaire, plafonnée, motif saisi, désinscription, liste de suppression
- [ ] Cadence par contact vérifiée, toutes sources confondues
- [ ] Aperçu affiché, volume et écartés détaillés, double confirmation
- [ ] Fenêtre d'annulation de 5 minutes opérationnelle
- [ ] Journalisation nominative de l'envoi et de l'annulation
- [ ] E-mail de mise en relation idempotent, `messageId` conservé
- [ ] Envoi vers un destinataire réel impossible hors production
- [ ] État de **D35** vérifié avant toute implémentation de la saisie libre
- [ ] **Trois flux, trois sous-domaines**, tous trois authentifiés (SPF, DKIM, DMARC)
- [ ] **Rien n'est transmis à Brevo pendant la fenêtre d'annulation**, périmètre recalculé à sa fin
- [ ] **Segment Brevo présent dans la liste fermée des segments autorisés**, et **liste d'exclusion
      INFLUX jointe à l'envoi**
- [ ] **Une seule campagne par envoi de masse** — jamais une campagne ou un appel par destinataire
- [ ] **Webhooks** : jeton en en-tête, plages d'adresses, fenêtre d'horodatage, idempotence, et
      **aucune preuve fondée sur le seul contenu reçu**
- [ ] **Interrupteur d'urgence** en place, et **il ne coupe pas le code de connexion**
- [ ] **Refus de démarrage** si un envoi réel est configuré hors production
- [ ] Indicateurs de **délivrabilité du code de connexion** instrumentés (six seuils)
- [ ] Écart « webhooks non signés » **soumis à `expert-cybersecurite`** (veto, `16` Q3)
