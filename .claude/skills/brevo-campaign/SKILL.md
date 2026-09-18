---
name: brevo-campaign
description: Intégrer l'API Brevo dans INFLUX — synchronisation des contacts, segmentation, scénarios de nurturing, e-mails transactionnels (dont la confirmation de mise en relation) et envois depuis le backoffice avec ses trois sources de destinataires. À utiliser pour toute connexion à Brevo, tout envoi d'e-mail et toute question de cadence, de délivrabilité ou de désinscription.
---

# Intégration Brevo

Brevo est l'outil d'emailing et de CRM d'INFLUX. Un lead non synchronisé est un lead perdu ;
un e-mail envoyé à tort est un incident.

Agents concernés : `expert-integrations-api` (principal), `expert-marketing`,
`expert-conformite-rgpd`, `dev-react-node`.

## Avant toute intégration

1. **Lire la documentation officielle Brevo à jour.** L'API évolue : ne jamais coder de mémoire.
   Vérifier les opérations disponibles, les limites de débit et les codes d'erreur.
2. Vérifier avec `expert-marketing` le segment, la liste et le scénario visés.
3. Vérifier avec `expert-conformite-rgpd` la base légale et le consentement requis.
4. Vérifier que la clé API est bien gérée (skill `env-secrets`).
5. Avant toute implémentation de la **saisie libre** d'adresses, vérifier l'état de **D35**
   (plafonds et conditions), arbitrée par `expert-conformite-rgpd` (**veto**) et le fondateur.
   Tant que D35 est ouverte, la saisie libre ne se développe pas au-delà de la mécanique décrite
   ici, et aucun plafond n'est figé dans le code.

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
7. **Toute tentative est journalisée** : événement, opération, statut, réponse, horodatage.
   Le backoffice affiche les échecs et permet le rejeu.
8. **Respect des limites de débit** : file d'attente, temporisation exponentielle plafonnée.
9. **Cadence plafonnée.** Aucun contact ne reçoit plus de N e-mails marketing par période
   glissante, **toutes sources de destinataires confondues** (voir « Cadence maximale par
   contact »). C'est ainsi qu'on brûle une base : la règle n'est pas négociable au cas par cas.
10. **Une adresse saisie librement n'entre jamais dans la base de contacts.** Elle part en
    **liste de suppression**, et l'envoi est journalisé nominativement.

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
| **Segment Brevo** — segment défini et maintenu dans Brevo | Consentement **côté Brevo** : sur ce périmètre, **Brevo fait foi** | Segment **lu au moment de l'envoi**, jamais figé à l'avance · **jamais recopié dans la base INFLUX**, ni les adresses ni les personnes · **volume affiché avant confirmation** · cadence portée par une condition d'exclusion **dans le segment Brevo** | **Masse** |
| **Saisie libre** — l'agent tape une adresse | **Aucune. C'est de la prospection.** Elle s'apprécie au cas par cas et pays par pays | **Envoi unitaire uniquement** : une adresse, jamais de liste collée ni d'import · **plafond par agent et par jour** · **adresse professionnelle uniquement** · **motif obligatoire saisi par l'agent**, conservé · **lien de désinscription obligatoire** · **journalisation nominative** (agent, adresse, motif, modèle, horodatage) · **l'adresse part en liste de suppression, jamais dans la base de contacts** · réservée à un rôle habilité (`agent` et `admin` restent distincts) | **1** |

Deux règles transverses :

- **Une seule source par envoi.** Mélanger un segment consenti et des adresses prospectées rendrait
  la base légale indémontrable.
- **Les trois sources partagent le même journal d'envoi** et la même règle de cadence.

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

## Délivrabilité

- SPF, DKIM et DMARC configurés **avant** le premier envoi de masse (avec `integrateur`).
- Montée en volume progressive sur un domaine neuf.
- Surveillance des taux de rebond et de plainte ; nettoyage des adresses invalides.
- Séparer si possible les flux transactionnel et marketing pour protéger la réputation.

## Garde-fou d'environnement

> **Un e-mail réellement envoyé depuis `staging` est un incident.** Le risque est aggravé depuis
> A4 : le backoffice peut désormais déclencher des envois, y compris de masse.

- **Clés distinctes par environnement**, la clé de production n'existe jamais ailleurs qu'en
  production (skill **`env-secrets`**).
- Hors production : intégration **désactivée**, ou envoi **redirigé** vers une liste fermée
  d'adresses internes autorisées. Jamais de destinataire réel.
- **Bandeau d'environnement visible en permanence** dans un backoffice non production.
- **La saisie libre est désactivée hors production**, sans exception.
- Tout envoi réel constaté depuis un environnement de test **se déclare comme incident**.

## Gestion des erreurs

| Type | Traitement |
|---|---|
| Transitoire (5xx, limite de débit) | Réessai avec temporisation exponentielle plafonnée |
| Permanente (adresse invalide, contact refusé) | Échec journalisé, pas de réessai, remontée backoffice |
| Authentification (clé invalide/expirée) | Alerte immédiate, arrêt de la file, intervention humaine |

## Tests

Aucun test ne touche Brevo réellement. Doublure obligatoire. Couvrir : consentement absent,
service indisponible, rejeu (idempotence), désinscription propagée, limite de débit.

## Checklist

- [ ] Documentation officielle consultée
- [ ] Consentement vérifié avant tout appel
- [ ] Idempotence en place
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
