---
name: apollo-lead-sync
description: Synchroniser les leads INFLUX vers Apollo.io pour la prospection commerciale — périmètre des profils synchronisés (décision D33), qualification préalable, mapping des champs entreprise et contact, alimentation des séquences, gestion des erreurs et conformité de la prospection selon le pays. À utiliser pour toute connexion à Apollo.io.
---

# Synchronisation Apollo.io

Apollo.io est l'outil de prospection commerciale sortante d'INFLUX.

**Le périmètre des profils synchronisés n'est pas tranché.** Le fondateur a arbitré le 2026-09-18
(**A7**) que **tous les inscrits** y partent, créateurs particuliers compris — **contre la
recommandation qui lui a été faite**. `expert-conformite-rgpd` conserve son **veto** et instruit le
point : c'est la décision **D33, ouverte**. Voir la section « Créateurs et Apollo » ci-dessous.

> **Ne pas élargir ni restreindre ce périmètre en silence dans le code.** Il se pilote par
> configuration, il se journalise, et il se tranche en D33.

Agents concernés : `expert-integrations-api` (principal), `expert-marketing`,
`expert-conformite-rgpd`.

## Avant toute intégration

1. **Lire la documentation officielle Apollo.io à jour** : opérations disponibles, limites de
   débit, quotas du plan souscrit, codes d'erreur. Ne jamais coder de mémoire.
2. Vérifier avec `expert-marketing` les critères de qualification et la séquence cible.
3. Vérifier avec `expert-conformite-rgpd` la base légale de la prospection B2B et l'information
   des personnes.
4. Vérifier la gestion de la clé API (skill `env-secrets`).

## Règles non négociables

1. **Qualification avant synchronisation.** Apollo n'est pas un déversoir : un lead non qualifié
   pollue la base de prospection, consomme du quota et dégrade les performances commerciales.
   Les critères de qualification sont définis par `expert-marketing` et appliqués **avant**
   l'appel.
2. **Le périmètre des profils synchronisés est une décision, pas un choix d'implémentation.** Il
   est régi par **D33** (ouverte), lu dans la **configuration** à chaque traitement, jamais écrit
   en dur. Toute modification du périmètre est journalisée : qui, quand, ancienne et nouvelle
   valeur.
3. **Jamais bloquant.** Une inscription réussit même si Apollo est indisponible : traitement
   asynchrone via le pipeline de leads (skill `lead-pipeline`).
4. **Idempotence.** Rejouer ne crée pas de doublon. Clé d'idempotence stable côté INFLUX.
5. **Droit d'opposition respecté.** Une opposition ou une demande de suppression se propage vers
   Apollo. Le contact est retiré des séquences en cours.
6. **Clé API côté serveur uniquement**, distincte par environnement. *Depuis D70 (2026-10-18)*,
   `staging` crée réellement les contacts dans le **compte Apollo de `staging`**, comme la
   production (clé aussi dans `apps/api/.env.local`). Le compte de `staging` n'a ni boîte d'envoi
   connectée ni séquence active : une séquence déclenchée vers de vrais prospects depuis `staging`
   reste un incident. Les tests et la CI restent sur la doublure.
7. **Toute tentative journalisée**, avec rejeu possible depuis le backoffice.
8. **Respect des quotas et limites de débit** : file d'attente, temporisation exponentielle.

## Créateurs et Apollo — décision D33

### L'instruction du fondateur (A7, 2026-09-18)

**Tous les inscrits partent vers Apollo**, créateurs particuliers compris.

### Le problème

Apollo est un outil de **prospection B2B** qui **enrichit les contacts depuis des sources tierces**.
Y pousser les données d'un créateur **particulier**, non professionnel, soulève trois difficultés :

- **Finalité et proportionnalité dans l'UE.** Un particulier n'est pas un prospect professionnel :
  l'intérêt légitime qui soutient habituellement la prospection B2B ne le couvre pas de la même
  manière, et la finalité « prospection commerciale » se justifie moins aisément.
- **Obligation d'information renforcée sur les données enrichies** (**art. 14 RGPD**) : des données
  non collectées auprès de la personne imposent de l'informer, dans un délai encadré, en indiquant
  les catégories de données et leur source.
- **Règles propres à chaque pays** : **CASL** au Canada (consentement exprès ou tacite),
  **lois des États américains** (CCPA et suivantes), **LGPD** au Brésil.

### La recommandation écartée

Réserver Apollo aux **annonceurs** et aux **créateurs déclarés professionnels**, et laisser les
créateurs particuliers au seul nurturing Brevo, qui repose sur un consentement recueilli.

### Le statut

**D33 est ouverte.** Elle est instruite par `expert-conformite-rgpd`, qui **conserve son veto**.
La **validation d'un juriste est obligatoire avant la mise en ligne du Lot 1**. Le risque est
inscrit ; il n'est pas levé.

### Ce que cela implique tant que D33 n'est pas fermée

Les deux options doivent rester ouvrables **sans réécriture**.

| Exigence | Détail |
|---|---|
| **Drapeau de configuration** | Le périmètre des profils envoyés est **modifiable sans redéploiement**. Trois valeurs : *annonceurs seuls* · *annonceurs + créateurs professionnels* · *tous les inscrits*. Le drapeau est **lu à chaque consommation d'événement**, pas au démarrage. Chaque modification est journalisée (qui, quand, ancienne et nouvelle valeur) et réservée au rôle `admin`. |
| **Valeur par défaut au Lot 1** | **annonceurs + créateurs professionnels.** C'est une **position d'attente conservatrice** tant que le juriste n'a pas validé l'instruction du fondateur, **pas un contre-arbitrage** : le fondateur bascule le drapeau sur *tous les inscrits* quand il le décide, sans redéploiement — c'est précisément à cela que sert le drapeau. |
| **Interrupteur d'arrêt** | Une variable d'environnement permet de couper l'intégration par environnement, indépendamment du périmètre (skill `env-secrets`). |
| **Statut déclaré** | Le champ **« particulier / professionnel »** est **capté dès l'inscription** (Lot 1). Sans lui, l'option recommandée devient inapplicable rétroactivement, et D33 se referme de fait par défaut. |
| **Pas de réimport d'enrichissement** | Par défaut, **aucune donnée enrichie par Apollo n'est réimportée dans INFLUX** : la réimporter déclencherait l'obligation d'information de l'art. 14 côté INFLUX. Toute exception est une décision explicite de `expert-conformite-rgpd`, documentée. |
| **Information des personnes** | La politique de confidentialité et la mention à l'inscription citent **Apollo et la finalité de prospection dès le Lot 1**, quel que soit le périmètre retenu. |

## Critères de qualification (à valider par `expert-marketing`)

Apollo n'est pas un déversoir : un lead non qualifié pollue la base de prospection, consomme du
quota et dégrade les performances commerciales. La qualification s'applique **avant** l'appel.

**Communs à tout profil synchronisé**, quel que soit le périmètre retenu en D33 :

- [ ] **Pays du contact dans lequel la base légale de la prospection est validée** par
      `expert-conformite-rgpd` (les règles diffèrent : UE, Canada avec la CASL, États-Unis, Brésil…)
- [ ] Adresse e-mail vérifiée
- [ ] Pas d'opposition enregistrée
- [ ] Ni doublon ni contact déjà présent dans une séquence active
- [ ] Information des personnes délivrée (mention à l'inscription, politique de confidentialité)
- [ ] Périmètre autorisé par le drapeau de configuration au moment du traitement

**Propres aux annonceurs** :

- [ ] Entreprise identifiée (nom, et si possible site et secteur)
- [ ] Adresse e-mail **professionnelle**
- [ ] Profil suffisamment complété, ou campagne publiée
- [ ] Budget indicatif renseigné, ou intention exprimée

**Propres aux créateurs — applicables uniquement si D33 l'autorise** :

- [ ] **Statut déclaré** renseigné (particulier / professionnel)
- [ ] Si **professionnel** : mêmes exigences qu'un annonceur (entité identifiée, adresse
      professionnelle)
- [ ] Si **particulier** : contrôles renforcés exigés par `expert-conformite-rgpd` — information
      renforcée au titre de l'art. 14, opposition en un clic, séquence dédiée au ton non-B2B,
      aucun réimport de données enrichies. **Ces contrôles sont une condition de la levée du veto,
      pas une option.**

Un lead qui ne passe pas la qualification est **conservé dans INFLUX** et journalisé comme non
éligible, avec le motif. Il pourra devenir éligible plus tard : la qualification est réévaluable.

## Mapping des champs

Documenter champ par champ (nom INFLUX, nom Apollo, type, valeur par défaut, comportement si
absent). À couvrir au minimum :

| Catégorie | Champs |
|---|---|
| Contact | prénom, nom, e-mail professionnel, fonction, téléphone si fourni |
| Entreprise | raison sociale, site web, secteur, taille si connue |
| Contexte INFLUX | date d'inscription, pays, langue, pays ouvert aux contrats (oui/non), complétude du profil, budget indicatif et devise, campagne publiée (oui/non), source d'acquisition, **type de profil** (annonceur / créateur), **statut déclaré** (particulier / professionnel), **périmètre de synchronisation appliqué** (valeur du drapeau au moment de l'envoi) |

Le contexte INFLUX est ce qui permet à l'équipe commerciale de personnaliser son approche :
c'est la valeur ajoutée de la synchronisation, ne pas l'omettre.

> **Le mapping d'un créateur n'est pas celui d'un annonceur.** La notion d'entreprise peut être
> vide : remplir un champ entreprise avec le pseudo ou le nom du créateur produirait une **donnée
> fausse** dans un outil qui l'exploitera pour enrichir. Champ absent = champ vide, jamais de
> valeur de remplissage inventée.

## Séquences commerciales

Définies par `expert-marketing`, implémentées ici. Principes :

- **Une séquence par niveau de maturité** : nouvel inscrit, profil complété sans campagne,
  campagne publiée sans mise en relation, négociation sans signature.
- **Dans la langue du contact** (français ou anglais), et seulement dans les pays où la
  prospection est validée.
- **Une séquence destinée aux créateurs n'existe que si D33 l'autorise**, et elle est **distincte**
  des séquences annonceurs : un créateur particulier n'est pas un prospect B2B, ni dans le ton, ni
  dans l'offre, ni dans les mentions d'information.
- **Sortie automatique de séquence** dès qu'un contrat est signé, qu'une **mise en relation courtée
  est ouverte** ou qu'un agent interne prend la main : un prospect pris en charge par un commercial
  ne doit plus recevoir de séquence de prospection automatique.
- **Retour d'information vers INFLUX** : état de la séquence, réponses obtenues, si l'API le
  permet, pour alimenter le backoffice.

## Gestion des erreurs

| Type | Traitement |
|---|---|
| Transitoire (5xx, limite de débit) | Réessai avec temporisation exponentielle plafonnée |
| Quota dépassé | Mise en file d'attente, alerte au backoffice, pas de perte de lead |
| Permanente (données invalides, doublon) | Échec journalisé, pas de réessai, remontée backoffice |
| Authentification | Alerte immédiate, arrêt de la file, intervention humaine |

## Conformité

- **La base légale dépend du pays du contact.** Dans l'UE, la prospection B2B repose généralement
  sur l'**intérêt légitime**, avec information des personnes, droit d'opposition simple et
  effectif, et pertinence du ciblage professionnel. D'autres pays sont plus stricts (au Canada, la
  CASL exige un consentement exprès ou tacite), fonctionnent sur le droit d'opposition (**lois des
  États américains**, CCPA et suivantes) ou suivent leur propre régime (**LGPD** au Brésil).
- **La base légale dépend aussi de la qualité de la personne.** Un créateur **particulier** n'est
  pas couvert par le raisonnement B2B — c'est tout l'objet de **D33**.
- **Données enrichies : art. 14 RGPD.** Toute donnée obtenue autrement qu'auprès de la personne
  déclenche une obligation d'information renforcée. D'où la règle : **aucun réimport dans INFLUX**
  des données enrichies par Apollo sans décision explicite et documentée.
- Les messages de prospection identifient clairement INFLUX et sa finalité, et portent un moyen
  d'opposition simple et immédiat.
- **`expert-conformite-rgpd` valide la base légale et les mentions pour chaque pays avant la
  première séquence dans ce pays.** Son **veto sur D33 reste ouvert**, et la **validation d'un
  juriste est obligatoire avant la mise en ligne du Lot 1**.

## Tests

Aucun test ne touche Apollo réellement. Doublure obligatoire. Couvrir : lead non qualifié
(non synchronisé), rejeu (idempotence), quota dépassé, service indisponible, opposition propagée,
sortie de séquence après signature.

## Checklist

- [ ] Documentation officielle consultée
- [ ] Critères de qualification appliqués avant appel
- [ ] Mapping documenté, contexte INFLUX inclus
- [ ] Idempotence en place
- [ ] Sortie de séquence automatique après signature ou reprise en main humaine
- [ ] Clé en variable d'environnement, distincte par environnement
- [ ] Journalisation et rejeu disponibles au backoffice
- [ ] Doublures de test en place
- [ ] Validation `expert-conformite-rgpd` sur la base légale et les mentions, pour chaque pays ciblé
