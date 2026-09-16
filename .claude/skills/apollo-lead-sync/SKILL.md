---
name: apollo-lead-sync
description: Synchroniser les leads INFLUX vers Apollo.io pour la prospection commerciale — qualification préalable, mapping des champs entreprise et contact, alimentation des séquences, gestion des erreurs et conformité de la prospection B2B. À utiliser pour toute connexion à Apollo.io.
---

# Synchronisation Apollo.io

Apollo.io est l'outil de prospection commerciale sortante d'INFLUX. Sa cible prioritaire : les
**annonceurs**, côté du marché qui apporte le chiffre d'affaires commissionné.

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
2. **Cible prioritaire : les annonceurs.** Les influenceurs ne partent vers Apollo que si
   `expert-marketing` le justifie explicitement pour un cas d'usage précis.
3. **Jamais bloquant.** Une inscription réussit même si Apollo est indisponible : traitement
   asynchrone via le pipeline de leads (skill `lead-pipeline`).
4. **Idempotence.** Rejouer ne crée pas de doublon. Clé d'idempotence stable côté INFLUX.
5. **Droit d'opposition respecté.** Une opposition ou une demande de suppression se propage vers
   Apollo. Le contact est retiré des séquences en cours.
6. **Clé API côté serveur uniquement**, distincte par environnement. En `staging`, bac à sable ou
   intégration désactivée — une séquence commerciale déclenchée depuis un environnement de test
   vers de vrais prospects est un incident.
7. **Toute tentative journalisée**, avec rejeu possible depuis le backoffice.
8. **Respect des quotas et limites de débit** : file d'attente, temporisation exponentielle.

## Critères de qualification (à valider par `expert-marketing`)

Un lead annonceur est éligible à Apollo lorsqu'il présente un potentiel commercial réel :

- [ ] Type de profil = **annonceur**
- [ ] **Pays du contact dans lequel la base légale de la prospection est validée** par
      `expert-conformite-rgpd` (les règles diffèrent : UE, Canada avec la CASL, États-Unis…)
- [ ] Adresse e-mail professionnelle vérifiée
- [ ] Entreprise identifiée (nom, et si possible site et secteur)
- [ ] Profil suffisamment complété, ou campagne publiée
- [ ] Budget indicatif renseigné, ou intention exprimée
- [ ] Ni doublon ni contact déjà présent dans une séquence active
- [ ] Pas d'opposition enregistrée

Un lead qui ne passe pas la qualification est **conservé dans INFLUX** et journalisé comme non
éligible. Il pourra devenir éligible plus tard : la qualification est réévaluable.

## Mapping des champs

Documenter champ par champ (nom INFLUX, nom Apollo, type, valeur par défaut, comportement si
absent). À couvrir au minimum :

| Catégorie | Champs |
|---|---|
| Contact | prénom, nom, e-mail professionnel, fonction, téléphone si fourni |
| Entreprise | raison sociale, site web, secteur, taille si connue |
| Contexte INFLUX | date d'inscription, pays, langue, pays ouvert aux contrats (oui/non), complétude du profil, budget indicatif et devise, campagne publiée (oui/non), source d'acquisition |

Le contexte INFLUX est ce qui permet à l'équipe commerciale de personnaliser son approche :
c'est la valeur ajoutée de la synchronisation, ne pas l'omettre.

## Séquences commerciales

Définies par `expert-marketing`, implémentées ici. Principes :

- **Une séquence par niveau de maturité** : nouvel inscrit, profil complété sans campagne,
  campagne publiée sans mise en relation, négociation sans signature.
- **Dans la langue du contact** (français ou anglais), et seulement dans les pays où la
  prospection est validée.
- **Sortie automatique de séquence** dès qu'un contrat est signé ou qu'un agent interne prend
  la main : un prospect devenu client ne doit plus recevoir de séquence de prospection.
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
  CASL exige un consentement exprès ou tacite) ou fonctionnent sur le droit d'opposition (États-Unis).
- Les messages de prospection identifient clairement INFLUX et sa finalité.
- **`expert-conformite-rgpd` valide la base légale et les mentions pour chaque pays avant la
  première séquence dans ce pays.**

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
