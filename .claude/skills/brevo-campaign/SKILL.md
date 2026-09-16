---
name: brevo-campaign
description: Intégrer l'API Brevo dans INFLUX — synchronisation des contacts, segmentation, scénarios de nurturing, e-mails transactionnels et déclenchement de campagnes depuis le backoffice. À utiliser pour toute connexion à Brevo, tout envoi d'e-mail et toute question de délivrabilité ou de désinscription.
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

## Campagnes déclenchées depuis le backoffice

Exigence explicite du projet, **prévue juste après le MVP** (voir `docs/cadrage-mvp.md`). Au MVP,
l'équipe envoie depuis l'interface Brevo, sur les segments synchronisés par INFLUX. Mécanique
attendue :

1. L'agent interne sélectionne un **segment** (issu des attributs ci-dessus).
2. Il choisit un **modèle de message** et le prévisualise.
3. Le système affiche le **volume de destinataires** et écarte les non-consentants et les
   désinscrits.
4. **Confirmation explicite** avant envoi — un envoi de masse ne se déclenche jamais d'un seul clic.
5. L'envoi est **journalisé** : qui, quand, quel segment, quel volume, quel modèle.
6. Les **résultats remontent** dans le backoffice (ouvertures, clics, désinscriptions, rebonds).

## Délivrabilité

- SPF, DKIM et DMARC configurés **avant** le premier envoi de masse (avec `integrateur`).
- Montée en volume progressive sur un domaine neuf.
- Surveillance des taux de rebond et de plainte ; nettoyage des adresses invalides.
- Séparer si possible les flux transactionnel et marketing pour protéger la réputation.

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
