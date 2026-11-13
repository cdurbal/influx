# Actions de masse, double validation, attribution (étapes 3 à 5, règles 11 à 20)

## Étape 3 — Encadrer les actions de masse

11. Toute action de masse se spécifie avec ces six éléments, sans exception :

| Élément | Exigence |
|---|---|
| **Plafond** | Nombre maximal d'éléments par lot, explicite et affiché |
| **Aperçu** | La sélection exacte est récapitulée **avant** exécution — combien, lesquels, quoi |
| **Confirmation explicite** | **Jamais en un clic.** Confirmation séparée de la sélection |
| **Réversibilité** | Annoncée **avant** l'exécution : réversible, ou irréversible et dit comme tel |
| **Échec partiel** | Comportement défini : ce qui a réussi reste, ce qui a échoué est listé et rejouable |
| **Journal** | Le lot est journalisé comme un objet : auteur, horodatage, contenu, résultat |

12. Une action de masse dont la réversibilité n'est pas annoncée avant exécution est un défaut
    bloquant.

Plafonds et files concernées : `15` RG29 (colonne « Action de masse », par exemple rejeu en lot
plafonné à 200) et `15` §H ; une action de masse est **interdite** sur la file des demandes de
contact (`13` RG50).

---

## Étape 4 — Actions irréversibles et double validation

### Les actions concernées

| Action | Pourquoi elle est sensible |
|---|---|
| Suppression ou anonymisation d'un compte | Irréversible, et croise une affaire éventuellement en cours. Exception tranchée (D72) : la suppression demandée par le membre lui-même s'exécute après sa propre double validation, sans approbation d'un `admin` ; export et effacement reçu par un autre canal restent approuvés |
| **Envoi d'e-mails** (saisie libre ou segment) | Ne se rattrape pas une fois parti |
| Révélation d'identité | Ne s'annule pas : ce qui est révélé est révélé |
| Retrait d'un badge | Impact direct sur la crédibilité d'un créateur (D51) |
| Clôture d'une affaire | Sort du pipeline, fausse les indicateurs si erronée |
| Suspension d'un compte | Coupe l'accès, potentiellement en pleine négociation |

### La règle cible

13. **Double validation par un administrateur** : l'action est demandée par un agent, exécutée
    après approbation d'un **administrateur distinct**. C'est un contrôle par les pairs. Exemple
    tranché : retrait de badge, un agent demande, un administrateur distinct approuve (D51). Une
    demande non confirmée **expire au bout de 24 h** sans rien exécuter (`15` RG31).

### La procédure dégradée du MVP, à écrire telle quelle

Au MVP, une seule personne peut cumuler les rôles `agent` et `admin`. Dans ce cas, la double
validation **ne peut pas être un contrôle par les pairs** : demander à quelqu'un de s'approuver
lui-même est du théâtre, et un contrôle décoratif est pire qu'une absence de contrôle parce qu'il
rassure à tort.

14. **Tant qu'une seule personne cumule `agent` et `admin`, la double validation est remplacée par
    une confirmation explicite différée et journalisée** :
    - l'action est **récapitulée** intégralement (portée exacte, nombre d'éléments, conséquences,
      réversibilité) ;
    - elle est **confirmée dans un second temps**, séparé du premier geste — pas dans le même
      enchaînement de clics ;
    - la confirmation est **tracée nominativement**, avec ses deux horodatages.

15. **Dire franchement ce que c'est : un contrôle affaibli.** Il protège contre l'erreur et la
    précipitation, pas contre la malveillance ni contre l'abus de droit. Il **redevient un vrai
    contrôle dès la deuxième personne dans l'équipe** : la règle cible s'applique alors
    automatiquement, sans changement de modèle.

16. C'est aussi la raison pour laquelle les rôles `agent` et `admin` restent **distincts en base
    dès le Lot 0**, même occupés par la même personne : rétro-adapter une séparation de rôles coûte
    cher, et la bascule doit être un changement de configuration, pas un chantier.

---

## Étape 5 — Attribution et portefeuille

17. **Règle non négociable : chaque compte et chaque affaire porte un commercial responsable dès
    le premier jour**, même si, au MVP, **tous les commerciaux voient tout**. Sur une affaire,
    seuls le responsable et l'administrateur écrivent ; un autre agent lit et demande la
    réattribution, journalisée (D50). Un compte arrivé par invitation nominative a pour
    responsable le commercial qui a invité (D54).

Ce n'est pas une contradiction, c'est une préparation : quand viendra le portefeuille de clients
cloisonné, le passage ne sera **qu'un changement de règle d'accès** sur une donnée déjà présente
et déjà fiable. Si le responsable n'est pas enregistré dès maintenant, ce passage devient une
reprise de données impossible à faire proprement.

18. À spécifier pour chaque objet attribuable (compte, mise en relation, affaire, entrée de file) :
    qui attribue, qui peut réattribuer, ce qui déclenche une réattribution automatique, et la trace
    conservée. **L'historique des responsables successifs est conservé**, pas écrasé.
19. Un agent désactivé ne peut pas rester responsable : **la réattribution est un préalable à la
    désactivation d'un compte agent**.
20. L'indicateur à instrumenter dès maintenant : **nombre de mises en relation traitées par
    commercial et par semaine**. C'est lui qui dira si la plateforme fait vraiment passer le métier
    à l'échelle.
