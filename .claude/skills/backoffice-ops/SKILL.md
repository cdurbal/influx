---
name: backoffice-ops
description: Concevoir un écran ou une opération du backoffice INFLUX, outil professionnel utilisé huit heures par jour — anatomie d'une file de validation, prise en charge avec verrou anti-double-traitement, SLA, motifs typés, attribution et réattribution, actions de masse et double validation, traçage de toute action et de toute lecture privilégiée, surface isolée, densité et accessibilité. À invoquer pour toute fonctionnalité utilisée par un commercial ou un administrateur INFLUX, et pour le pendant interne de toute fonctionnalité côté membres.
---

# Concevoir une opération de backoffice

`CLAUDE.md` le dit sans ambiguïté : **le backoffice est un produit à part entière, pas un écran
d'admin bricolé.** Il est utilisé huit heures par jour et c'est lui qui porte la rentabilité
opérationnelle.

Il y a une raison plus dure encore. Le plafond de croissance d'INFLUX n'est pas technique, **il est
humain** : chaque mise en relation mobilise un commercial. Chaque clic économisé au backoffice est
de la capacité commerciale gagnée. Un écran interne mal conçu coûte directement du chiffre
d'affaires.

Agents concernés : `product-owner` (principal), `expert-ux`, `expert-cybersecurite` (**veto**),
`expert-conformite-rgpd` (**veto**), `architecte`.

## Principe directeur

> **Toute action d'un agent est tracée et motivée.** Un backoffice qui permet une action anonyme,
> ou une action sans motif, est un backoffice défectueux — quel que soit son confort d'usage.

Corollaire à appliquer dès la conception : si une action ne peut pas être attribuée à une personne
nommée et rattachée à un motif exploitable, elle ne doit pas exister sous cette forme.

---

## Étape 1 — Concevoir une file de validation

Le backoffice du MVP est d'abord un enchaînement de files. Elles ont toutes la même anatomie : ne
pas en réinventer une par sujet.

### Les cinq files du MVP

| File | Ce qui y entre | Effet d'une sortie favorable |
|---|---|---|
| **Demandes de contact et candidatures** | Les deux premiers déclencheurs de mise en relation | Révélation d'identité + ouverture de la conversation à trois |
| **Profils à vérifier** | Demandes de badge (cf. `profile-verification`) | Attribution du niveau demandé |
| **Campagnes à valider** | Campagnes soumises par les marques | Publication de la campagne |
| **Échecs de synchronisation des leads** | Échecs Brevo / Apollo (cf. `lead-pipeline`) | Rejeu réussi |
| **Signalements** | Signalements émis depuis la messagerie (cf. `messaging-spec`) | Décision motivée sur le fil ou le compte |

*(La proposition INFLUX ne passe pas par une file : le commercial est déjà le décideur et
s'attribue l'affaire d'office — cf. `intermediation-tracking`.)*

### Les sept points à spécifier pour chaque file

1. **Ce qui y entre** : événement déclencheur, données affichées dans la liste, données nécessaires
   à la décision **sans avoir à ouvrir autre chose**. Un agent qui doit ouvrir trois onglets pour
   décider perd la moitié de sa journée.
2. **Tri et priorisation** : critère par défaut explicite (ancienneté, SLA restant, valeur
   estimée), critères de tri disponibles, filtres. Le tri par défaut est une décision produit, pas
   un détail d'implémentation.
3. **Prise en charge avec verrou anti-double-traitement.** **Règle non négociable : deux
   commerciaux ne traitent jamais la même demande.** Prendre une entrée en charge pose un verrou
   nominatif, visible des autres agents (« En cours — Marie »). Le verrou a une **durée
   d'expiration** et se libère seul ; il se relâche aussi explicitement.
4. **Attribution** : qui devient responsable, et de quoi. Voir étape 5.
5. **SLA** : délai maximal de traitement, horaires couverts, **comportement au dépassement**
   (remontée visuelle, alerte, réattribution automatique). D39 — arbitrage attendu du fondateur ;
   d'ici là, écrire le comportement et laisser le délai paramétrable.
6. **Sortie avec motif typé** : favorable ou défavorable, toujours motivée (étape 2).
7. **Réattribution** : qui peut réattribuer, avec quelle trace, et ce que devient le verrou.

**Règles complémentaires :**

8. Une entrée ne disparaît jamais d'une file sans décision : **pas de sortie silencieuse**.
9. Le **délai d'attente de chaque file est un indicateur de premier rang**, affiché en permanence,
   pas un rapport mensuel. Rien ne circule entre deux membres sans validation : une file qui
   s'allonge est une conversion qui s'effondre.

---

## Étape 2 — Imposer des motifs typés

10. **Règle non négociable : toute décision porte un motif choisi dans une liste fermée.** Le texte
    libre est autorisé **en complément**, jamais seul.

Pourquoi c'est structurant, et pas de la bureaucratie : un motif rédigé librement n'est **ni
mesurable, ni comparable, ni exploitable**. Au bout de six mois, personne ne sait pourquoi on
refuse — ni combien de refus viennent d'un profil incomplet, ni combien viennent d'un budget
irréaliste. Or c'est exactement cette information qui dit quoi corriger dans le produit.

Comment construire une liste de motifs correcte :

- **Fermée et courte** : cinq à dix entrées. Au-delà, plus personne ne lit.
- **Exhaustive sur les cas réels** : construite à partir des décisions réellement prises, pas
  imaginée.
- **Exprimée en langage métier**, lisible par le fondateur.
- **Distincte par file** : les motifs de refus d'une campagne n'ont rien à voir avec ceux d'une
  demande de contact.
- Un motif **« autre » exceptionnel et surveillé** : sa fréquence est un indicateur. S'il dépasse
  un seuil, la liste est incomplète et doit être étendue.
- **Chaque motif défavorable porte le message envoyé à l'utilisateur** — pas de refus muet.

---

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

---

## Étape 4 — Actions irréversibles et double validation

### Les actions concernées

| Action | Pourquoi elle est sensible |
|---|---|
| Suppression ou anonymisation d'un compte | Irréversible, et croise une affaire éventuellement en cours |
| **Envoi d'e-mails** (saisie libre ou segment) | Ne se rattrape pas une fois parti |
| Révélation d'identité | Ne s'annule pas : ce qui est révélé est révélé |
| Retrait d'un badge | Impact direct sur la crédibilité d'un créateur |
| Clôture d'une affaire | Sort du pipeline, fausse les indicateurs si erronée |
| Suspension d'un compte | Coupe l'accès, potentiellement en pleine négociation |

### La règle cible

13. **Double validation par un administrateur** : l'action est demandée par un agent, exécutée
    après approbation d'un **administrateur distinct**. C'est un contrôle par les pairs.

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
    le premier jour**, même si, au MVP, **tous les commerciaux voient tout**.

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

---

## Étape 6 — Surface privilégiée

Le backoffice voit **toutes les identités, toutes les conversations et toutes les affaires**. Sa
surface se traite comme telle.

21. **Hôte distinct** de l'application publique et de l'espace membres.
22. **Non-indexation** et absence de lien public.
23. **Authentification à double facteur obligatoire** sur tous les comptes agent et admin.
24. **Session courte**, avec reconnexion. Arbitrer la durée avec `expert-cybersecurite` : une
    session trop courte pousse aux contournements.
25. **Journalisation de toute lecture de donnée sensible** : conversations (cf. `messaging-spec`),
    pièces de vérification (cf. `profile-verification`), identités non révélées, données d'affaire.
26. Autorisation vérifiée **côté serveur** pour chaque rôle. Le masquage d'interface n'est jamais
    un contrôle d'accès.

Revue obligatoire : `expert-cybersecurite` (**veto**) et `security-rgpd-audit` avant mise en ligne.

---

## Étape 7 — Supervision

Ce qu'un agent doit voir sans avoir à le chercher :

27. **Files qui grossissent** : volume en attente et **délai d'attente le plus ancien**, par file.
28. **SLA dépassés** : liste dédiée, visuellement distincte, jamais noyée dans la file générale.
29. **Échecs de synchronisation Brevo / Apollo** avec la **cause en clair** — pas une trace
    technique brute — et **rejeu unitaire ou en lot** (cf. `lead-pipeline`).
30. **Leads non synchronisés par absence de consentement** : c'est un cas normal, pas une erreur,
    et l'écran doit le dire.
31. **Alertes** : coordonnées repérées dans un fil, fil silencieux depuis 14 jours sans état
    commercial mis à jour, panne durable d'un service externe, quota dépassé. Chaque alerte a un
    seuil écrit et un destinataire.
32. Une alerte doit être **actionnable** : si l'agent ne peut rien faire en la lisant, elle n'a rien
    à faire là.

---

## Étape 8 — Densité et accessibilité d'un outil professionnel

Le backoffice n'obéit pas aux mêmes règles que la landing. Ici, la densité est une qualité.

33. **Tableaux plutôt que cartes.** Une carte par élément fait défiler ; un tableau fait comparer.
34. **Actions atteignables sans souris** et **raccourcis clavier** sur les gestes répétés :
    prendre en charge, valider, refuser avec motif, passer au suivant. C'est ce qui sépare un outil
    de dix décisions par jour d'un outil de cent.
35. **États vides utiles** : « Aucune demande en attente — dernière traitée il y a 12 minutes »,
    jamais une page blanche.
36. **Aucune animation décorative**, aucun délai artificiel.
37. Accessibilité WCAG AA comme partout : **la couleur n'est jamais le seul porteur
    d'information** (un SLA dépassé ne se signale pas uniquement en rouge).
38. Tokens du design system obligatoires, aucune couleur ni espacement en dur →
    `design-system-influx`.
39. Langue du backoffice : **D36, arbitrage du fondateur**. D'ici là, ne pas coder en dur une
    langue unique.

---

## Étape 9 — Ce qu'un agent ne doit jamais pouvoir faire

Liste à vérifier écran par écran. Chacun de ces points est un **défaut bloquant** s'il est possible.

40. **Modifier ou supprimer une entrée du journal d'audit.** Le journal est en ajout seul, garanti
    en base, pas par convention.
41. **Modifier un montant d'affaire sans trace.** Toute modification conserve l'ancienne valeur,
    son auteur et son horodatage.
42. **Envoyer un e-mail de masse sans double confirmation** (ou sans la confirmation différée
    journalisée de l'étape 4).
43. **Consulter une pièce de vérification ou une conversation sans que ce soit journalisé.**
44. **Exporter l'annuaire** des membres, sous quelque forme que ce soit — y compris par une
    pagination détournée ou un export de liste.
45. **Désactiver sa propre traçabilité**, ou agir sous une autre identité que la sienne.
46. **Agir sur son propre compte** en tant qu'agent (auto-attribution de droits, auto-validation).

---

## Étape 10 — Cas limites

| Situation | Comportement attendu |
|---|---|
| **Deux agents sur la même entrée** | Le second voit « En cours — Marie » et ne peut pas décider. Aucune décision concurrente n'est possible |
| **Agent absent, verrou orphelin** | Le verrou expire seul après un délai écrit ; un administrateur peut le lever, avec trace |
| **Reprise d'une affaire** par un autre commercial | Réattribution explicite et motivée ; l'historique des responsables est conservé ; les deux parties ne voient qu'un changement d'interlocuteur clairement annoncé dans le fil |
| **Agent qui quitte l'entreprise** | Réattribution obligatoire **avant** désactivation ; ses actions passées conservent son nom |
| **Suppression de compte demandée alors qu'une affaire est en cours** | **Hypothèse conservatrice** : suppression logique et anonymisation des données personnelles, **conservation de l'affaire et du journal sous forme pseudonymisée** au titre de la constatation et de l'exercice de droits en justice. **À faire figurer dans la politique de confidentialité dès le Lot 1**, sinon le droit de conserver la preuve n'existe pas. Arbitre : `expert-conformite-rgpd` (**veto**) |
| **Action passée par erreur** | **Correction avec trace, jamais effacement.** L'action erronée reste au journal, la correction s'y ajoute avec son motif |
| **File vide vs file bloquée** | Deux états distincts et distinctement affichés : rien à traiter n'est pas la même chose que rien ne remonte |
| **Décision prise hors délai SLA** | Elle reste possible et est marquée comme telle ; on ne bloque jamais une décision tardive |
| **Rejeu d'un lot déjà rejoué** | Idempotent, aucun doublon côté Brevo ou Apollo (cf. `lead-pipeline`) |
| **Agent sans les droits** sur une action | Refus côté serveur, message clair, tentative journalisée |

---

## Checklist avant livraison

- [ ] Chaque action est attribuée à une personne nommée et rattachée à un motif exploitable
- [ ] Verrou anti-double-traitement, avec expiration et libération explicite
- [ ] Tri par défaut décidé, SLA écrit, comportement au dépassement spécifié
- [ ] Motifs **typés**, liste fermée par file, message utilisateur associé à chaque motif
      défavorable, texte libre en complément seulement
- [ ] Actions de masse : plafond, aperçu, confirmation séparée, réversibilité annoncée, échec
      partiel traité, lot journalisé
- [ ] Actions irréversibles identifiées ; double validation **ou** confirmation différée
      journalisée, avec mention explicite du caractère affaibli du contrôle
- [ ] Commercial responsable porté par chaque compte et chaque affaire, historique conservé
- [ ] Réattribution avant désactivation d'un compte agent
- [ ] Hôte distinct, non-indexé, MFA, session courte
- [ ] Lectures de conversations, de pièces et d'identités journalisées
- [ ] Journal d'audit en ajout seul, non modifiable par un agent
- [ ] Export de l'annuaire impossible
- [ ] Tableaux, raccourcis clavier, actions sans souris, états vides utiles
- [ ] Couleur jamais seul porteur d'information ; tokens du design system uniquement
- [ ] Indicateur « mises en relation traitées par commercial et par semaine » instrumenté
- [ ] Revues `expert-cybersecurite` et `expert-conformite-rgpd` (vetos) demandées

## Format de sortie

**Opération et acteur interne** → **File concernée** (entrée, tri, verrou, attribution, SLA,
sortie motivée, réattribution) → **Motifs typés et messages associés** → **Actions de masse et
irréversibles** (plafonds, confirmations, réversibilité) → **Attribution et responsable** →
**Traçage** (actions, lectures privilégiées, journal) → **Supervision et alertes** → **Densité et
accessibilité** → **Interdits** → **Cas limites** → **Critères d'acceptation** (via
`feature-spec`) → **Questions ouvertes avec leur arbitre**.

## Quand NE PAS invoquer cette skill

- **Écrans destinés aux membres** (marque, créateur) → `feature-spec` + `design-system-influx`.
- **Tables, colonnes, RLS, index, rétention** → `supabase-schema`.
- **Contenu, segments et base légale des e-mails** → `brevo-campaign` et `apollo-lead-sync`.
- **Règles métier de la mise en relation, registre chaîné, pipeline d'affaire** →
  `intermediation-tracking`.
- **Critères et procédure du badge** → `profile-verification`.
- **Règles de la conversation à trois** → `messaging-spec`.
- **Mécanique de la file d'événements de leads** (retries, idempotence) → `lead-pipeline` ;
  ici on ne spécifie que **ce que l'agent en voit et en fait**.
- **Revue de sécurité ou de conformité** → `security-rgpd-audit`.

## Questions ouvertes

| # | Question | Arbitre |
|---|---|---|
| 1 | **D39 — SLA de la file de validation** : délai maximal, horaires couverts, comportement au dépassement | **Fondateur** + `product-owner` |
| 2 | **D35 — plafonds et conditions de la saisie libre d'e-mails** au backoffice | `expert-conformite-rgpd` (**veto**) + **Fondateur** |
| 3 | **D36 — langue du backoffice** | **Fondateur** |
| 4 | **Suppression de compte pendant une affaire en cours** : hypothèse conservatrice à confirmer et à inscrire dans la politique de confidentialité dès le Lot 1 | `expert-conformite-rgpd` (**veto**) + `expert-paiement-facturation` |
| 5 | **MFA et journalisation systématique des lectures privilégiées** : durée de session, coût de performance et d'ergonomie | `expert-cybersecurite` (**veto**) + `architecte` |
| 6 | Durée d'expiration des verrous de prise en charge et plafonds des actions de masse | `product-owner` + `expert-ux` |
