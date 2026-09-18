---
name: profile-verification
description: Vérifier un profil INFLUX et attribuer le badge « Vérifié », toujours attribué à la main par un administrateur — ce que le badge affirme et ce qu'il n'affirme pas, les trois niveaux, les pièces acceptées par réseau et leur fraîcheur, la procédure de l'agent qui saisit lui-même les chiffres constatés, la liste fermée des motifs de refus, la péremption à 90 jours, le retrait et la contestation. À invoquer dès qu'une story touche une preuve d'audience, la propriété d'un compte, l'immatriculation d'une marque, le badge ou son affichage.
---

# Vérifier un profil et attribuer le badge

Le badge est la seule chose, sur un profil INFLUX, qui n'est pas déclarative. C'est ce qui lui
donne sa valeur — et c'est exactement pour cela qu'il est dangereux : **une marque qui s'y fie et
qui découvre des chiffres faux se retourne contre la plateforme, pas contre le créateur.**

Agents concernés : `product-owner` (principal), `expert-conformite-rgpd` (**veto**), `expert-ux`,
`expert-matching`.

## Principe directeur

> **Le badge engage la responsabilité d'INFLUX.** Il ne dit jamais qu'un créateur est bon : il dit
> qu'un **fait précis** a été **constaté sur pièce**, par une **personne nommée**, à une **date
> donnée**.

Le badge est **toujours attribué à la main par un administrateur**. Aucune attribution
automatique, aucune attribution par un connecteur d'API, aucune attribution par lot au MVP.

---

## Étape 1 — Écrire ce que le badge affirme, et surtout ce qu'il n'affirme pas

C'est la première chose à rédiger, avant toute procédure, parce que **c'est le libellé affiché qui
crée l'engagement**, pas la procédure interne.

| Le badge affirme | Le badge n'affirme **jamais** |
|---|---|
| Que le compte appartient bien à la personne inscrite | Que le créateur est bon, sérieux ou professionnel |
| Que les chiffres affichés ont été **constatés sur pièce** par un agent INFLUX | **Que les abonnés sont authentiques** |
| La **date** de ce constat | Que l'audience restera stable |
| La **source** du constat (tableau de bord natif du réseau) | Quelle performance une campagne obtiendra |
| Pour une marque : que le domaine et l'immatriculation ont été contrôlés | Que la marque est solvable ou qu'elle paiera |

**Règle non négociable n° 1 : le badge ne garantit ni l'authenticité des abonnés, ni la
performance future, ni la qualité du créateur.** Il garantit qu'un chiffre a été constaté sur
pièce à une date donnée par un agent INFLUX. Toute formulation qui laisse croire autre chose est
fausse, et c'est INFLUX qui en répond.

Conséquences opérationnelles, à appliquer sans discussion :

2. **Le libellé affiché doit refléter le périmètre exact.** « Audience vérifiée le 12 mars 2026,
   source : tableau de bord Instagram » est défendable. « Créateur vérifié », « Profil de
   confiance », « Certifié » ne le sont pas.
3. **Aucun superlatif, aucune promesse.** Le badge n'est pas un label de qualité.
4. **La date accompagne le badge partout où il apparaît** — résultat de recherche, fiche, fil de
   messagerie. Un badge sans date est un badge qui ment par omission.
5. **Test de rédaction à appliquer à chaque libellé** : « suis-je capable de défendre cette phrase
   devant une marque mécontente, pièce en main ? » Si la réponse est non, le libellé est à
   réécrire.
6. Sur l'authenticité de l'audience en particulier : INFLUX ne dispose d'aucun outil de détection
   de faux abonnés au MVP. Le produit ne doit donc **rien** dire, ni laisser entendre, sur ce
   sujet — ni dans le badge, ni dans l'aide, ni dans le discours commercial.

---

## Étape 2 — Les trois niveaux, pour deux populations

Trois libellés, deux populations, deux parcours distincts.

| Niveau | Population | Ce qui est vérifié | Ce qui est publié |
|---|---|---|---|
| **Compte vérifié** | Créateur | La **propriété du compte** sur le réseau est prouvée | Badge + réseau + date |
| **Audience vérifiée** | Créateur | Les **chiffres d'audience** sont constatés sur pièce | Badge + réseau + valeurs en tranches + date |
| **Marque vérifiée** | Annonceur | Le **domaine** et l'**immatriculation** de la société sont contrôlés | Badge + date |

**Règles :**

7. **« Audience vérifiée » suppose « Compte vérifié ».** On ne constate pas les chiffres d'un
   compte dont la propriété n'est pas établie : ce serait constater les chiffres de n'importe qui.
8. **Le badge est par réseau, pas par personne.** Un créateur peut être vérifié sur Instagram et
   pas sur TikTok ; l'interface doit le dire, jamais afficher un badge global.
9. « Marque vérifiée » suit son propre parcours, avec ses propres pièces et ses propres motifs de
   refus. Ne pas mélanger les deux populations dans une même story (`CLAUDE.md` §5.2).

---

## Étape 3 — Fixer les pièces acceptées et leur fraîcheur

**Règle non négociable n° 10 : seule une capture du tableau de bord natif du réseau, datée de
moins de 30 jours, montrant simultanément le compte, la période et les valeurs, vaut preuve
d'audience.**

| Réseau | Compte vérifié | Audience vérifiée |
|---|---|---|
| **Instagram** | Code INFLUX collé dans la bio, constaté par l'agent | Capture des statistiques du compte professionnel : abonnés, couverture, période affichée, pays principaux |
| **TikTok** | Code INFLUX collé dans la bio | Capture de l'espace analytique : abonnés, vues, période, territoires |
| **YouTube** | Code INFLUX dans la description de la chaîne | Capture de l'espace créateur : abonnés, vues, période, pays |
| **Autres réseaux** | Même principe : code dans un champ modifiable et public du profil | Capture de l'outil natif équivalent, mêmes exigences |

**Pièces refusées d'office**, à inscrire dans la liste des motifs de refus :

- Capture issue d'un **outil tiers** (mesure d'audience, agence, tableur).
- **Chiffres retapés** ou copiés dans un message : ce n'est pas une pièce.
- Capture **sans identifiant de compte visible**.
- Capture **rognée** masquant la période, ou dont la période n'est pas lisible.
- Capture **de plus de 30 jours**.
- Document **retouché** ou dont la cohérence interne est douteuse.

---

## Étape 4 — La procédure de l'agent, pas à pas

11. **Règle non négociable : l'agent saisit lui-même les valeurs constatées.** On ne fait **jamais**
    confiance à la saisie du créateur pour une donnée estampillée « vérifiée ». Si le système
    reprend le chiffre déclaré et le marque « vérifié », le badge ne vérifie rien : il recopie.

Déroulé :

1. **Prendre l'entrée en charge** dans la file « profils à vérifier » (verrou anti-double-traitement,
   cf. `backoffice-ops`).
2. **Contrôler la propriété du compte** (étape 5) avant tout examen de chiffres.
3. **Ouvrir les pièces** dans le compartiment privé. Vérifier : identifiant du compte visible,
   période lisible, date de moins de 30 jours, cohérence entre les pièces.
4. **Saisir les valeurs constatées** dans les champs dédiés — jamais un copier-coller de la
   déclaration du créateur, jamais une validation « telle que déclarée ».
5. **Comparer au déclaré.** La valeur déclarée reste visible **à part**, étiquetée « déclaré ».
   **L'écart déclaré / constaté est conservé** : c'est un signal de sérieux précieux pour le
   commercial, et il ne coûte rien à garder.
6. **Décider** : accorder le niveau, ou refuser avec un motif typé (étape 6). Jamais de troisième
   voie silencieuse.
7. **La décision est horodatée et porte l'identité de l'agent**, en interne.

12. Toute décision alimente le journal d'audit, qu'elle soit favorable ou non.

---

## Étape 5 — Prouver la propriété du compte

13. INFLUX **génère un code** à usage unique, rattaché au créateur et au réseau, avec une durée de
    validité courte (à fixer, quelques jours).
14. Le créateur **colle temporairement ce code** dans un champ public et modifiable de son profil
    (bio, description de chaîne).
15. **L'agent constate lui-même le code en ligne**, puis enregistre le constat : horodatage +
    identité de l'agent. Une capture fournie par le créateur ne suffit pas : elle se fabrique.
16. Le créateur peut retirer le code après constat.

**Alternatives acceptées** : aucune au MVP, hormis le même mécanisme adapté au champ public du
réseau concerné.
**Alternatives refusées** : envoi d'un message privé depuis le compte, capture d'écran d'un espace
connecté, attestation sur l'honneur, lien de profil seul.

---

## Étape 6 — La liste fermée des motifs de refus

17. **Règle non négociable : aucun refus sans motif typé.** Jamais de refus muet, jamais de dossier
    laissé en attente indéfinie, jamais de motif rédigé librement seul.

| Motif | Message envoyé au créateur | Ce qu'il peut faire |
|---|---|---|
| **Pièce absente** | « Aucune pièce n'a été jointe à votre demande. » | Redéposer |
| **Pièce trop ancienne** | « Votre capture date de plus de 30 jours. » | Redéposer une capture récente |
| **Pièce illisible ou rognée** | « La période ou le compte ne sont pas lisibles sur votre capture. » | Redéposer |
| **Source non acceptée** | « Seules les statistiques officielles du réseau sont acceptées. » | Redéposer depuis l'outil natif |
| **Compte non prouvé** | « Le code de vérification n'a pas été trouvé sur votre profil. » | Recommencer la preuve de propriété |
| **Incohérence entre les pièces** | « Les informations fournies ne concordent pas. » | Contacter INFLUX |
| **Soupçon de document modifié** | « Nous ne pouvons pas retenir cette pièce. » | Contacter INFLUX |
| **Profil non conforme aux CGU** | Message dédié selon le cas | Selon le cas |
| **Créateur mineur** | Message dédié (étape 10) | Aucun recours au MVP (D15) |
| **Autre** | Message rédigé par l'agent | Contacter INFLUX |

18. « Autre » est un motif **exceptionnel et surveillé** : sa fréquence est un indicateur. S'il
    dépasse un seuil, c'est que la liste est incomplète et qu'il faut l'étendre.
19. Un commentaire libre est autorisé **en complément** du motif typé, jamais à sa place.

---

## Étape 7 — Péremption, retrait, contestation

20. **Règle non négociable : un badge d'audience se périme à 90 jours.**

Pourquoi c'est indispensable, et pas une commodité : **sans péremption, un badge devient un
mensonge en six mois** — et un mensonge dont la plateforme répond. Une audience bouge, un compte
change de nature, un créateur arrête. Un chiffre constaté en janvier et affiché sans date en
septembre est une information fausse présentée comme vérifiée.

| Étape | Effet |
|---|---|
| **J-15** | Rappel au créateur, badge inchangé |
| **J+0 (90 jours)** | Passage en **« à rafraîchir »** : le badge reste visible, mais l'état est explicite et la date affichée |
| **Délai de grâce** (à fixer) | Le créateur peut redéposer sans repasser par la preuve de propriété |
| **Fin du délai** | **Retrait du badge d'audience.** « Compte vérifié » n'est pas affecté : la propriété d'un compte ne se périme pas de la même façon |

21. **Retrait immédiat, hors péremption**, dans quatre cas : pièce reconnue fausse, compte
    supprimé ou fermé, changement de titulaire du compte, manquement grave aux CGU. Chaque retrait
    porte un motif typé et est notifié.
22. **Contestation** : le créateur peut contester un refus ou un retrait. La contestation est
    traitée par **un agent différent de celui qui a décidé** dès que l'équipe compte deux
    personnes ; tant qu'elle n'en compte qu'une, la contestation est réexaminée avec un délai de
    réflexion et la décision est journalisée nominativement (même logique que la confirmation
    différée de `backoffice-ops`).
23. Toute contestation, son examen et son issue sont journalisés.

---

## Étape 8 — Stockage des pièces et publication

### Stockage

24. Les pièces vivent dans un **compartiment privé**, séparé des données de profil.
25. **Règle non négociable : une pièce de vérification n'est jamais accessible à un annonceur, dans
    aucun cas** — y compris à sa demande, y compris via un commercial, y compris « juste pour
    rassurer ». Ce qu'INFLUX transmet, c'est son constat, pas la pièce.
26. **Tout accès d'un agent à une pièce est journalisé** (cf. `backoffice-ops`).
27. **Conservation bornée** : durée écrite, suppression à l'échéance. Une pièce périmée n'a plus
    de raison d'être conservée. Modélisation avec `supabase-schema`, durée validée par
    `expert-conformite-rgpd`.

### Ce qui est publié, ce qui ne l'est jamais

| Publié | Jamais publié |
|---|---|
| Le niveau et le réseau concerné | **Les pièces**, sous aucune forme |
| **La date de vérification** | Le nom de l'agent vérificateur (interne uniquement) |
| Les valeurs constatées **en tranches** | Les valeurs exactes |
| L'état « à rafraîchir » | L'écart déclaré / constaté (interne, signal commercial) |

28. Les valeurs sont publiées **en tranches, jamais en valeurs exactes** — c'est aussi une
    exigence de la recherche anonymisée (cf. `matching-spec`).

---

## Étape 9 — Effet du badge sur le produit

Un badge qui ne sert à rien ne sera jamais demandé, et l'effort de vérification sera perdu. Ce que
le badge doit débloquer :

29. **Facette de recherche** côté marque et côté commercial.
30. **Campagnes réservables aux profils vérifiés** : c'est le levier qui rend le badge désirable et
    qui finance l'effort de vérification.
31. **Exclusion des non-vérifiés de certaines propositions INFLUX**, à la main du commercial.
32. Affichage du badge partout où un profil apparaît : résultat de recherche, fiche, en-tête de
    conversation, candidature.

⚠️ **Tension à arbitrer** : réserver des campagnes aux profils vérifiés augmente la valeur du
badge mais réduit le vivier au démarrage, ce qui heurte D38 (masse critique avant d'ouvrir la
recherche). Question ouverte n° 4.

---

## Étape 10 — Données de tiers, et cas limites

### Les captures d'audience contiennent des données de tiers

Une capture d'un espace analytique montre presque toujours autre chose que des chiffres : noms de
commentateurs, messages, miniatures, visages, parfois des messages privés.

33. **Instructions de capture explicites** données au créateur au moment du dépôt : que montrer,
    que masquer, comment recadrer.
34. **Refus des pièces trop larges** : c'est un motif de refus à part entière (« pièce non
    conforme aux instructions de capture »), pas une tolérance.
35. L'agent qui constate une donnée de tiers inutile **demande une nouvelle pièce** et ne conserve
    pas la première.
36. Base légale, information des personnes et durée de conservation : **validation
    `expert-conformite-rgpd` (veto)** avant la mise en ligne du Lot 2.

### Cas limites

| Situation | Comportement attendu |
|---|---|
| **Compte partagé** entre plusieurs personnes | « Compte vérifié » refusé : la propriété n'est pas établie pour une personne identifiée. Renvoi vers le cas agence |
| **Compte géré par une agence** | Hors périmètre MVP (agences et multi-utilisateurs exclus) : refus avec motif dédié, demande inscrite pour la V2 |
| **Changement de pseudo** après vérification | Le badge reste, l'ancien et le nouveau pseudo sont conservés en interne, le commercial est alerté ; nouvelle preuve de propriété exigée si le doute persiste |
| **Chute brutale d'audience** | Le badge n'est pas retiré (il constate une date passée), mais l'écart alimente une alerte interne ; le rafraîchissement anticipé peut être demandé |
| **Créateur mineur détecté** | **Arrêt immédiat de la procédure**, aucun badge, compte traité selon D15 (mineurs exclus au MVP), escalade à un administrateur, journalisation |
| **Soupçon de faux abonnés** | Aucun outil de détection au MVP : le badge **ne dit rien** sur ce point. Le soupçon est une note interne et une alerte au commercial, jamais une mention publique |
| **Compte supprimé ou fermé** après vérification | Retrait immédiat du badge, motif typé, notification |
| **Nouvelle demande après refus** | Autorisée, avec un délai minimal entre deux demandes ; l'historique des refus est conservé et visible de l'agent |
| **Deux demandes simultanées** sur le même profil | Verrou, une seule prise en charge (cf. `backoffice-ops`) |
| **Pièce déposée dans la mauvaise langue** | Acceptée si lisible ; la langue n'est pas un motif de refus |

---

## Checklist avant livraison

- [ ] Le libellé affiché a passé le test « défendable devant une marque mécontente, pièce en main »
- [ ] La section « ce que le badge n'affirme pas » exclut explicitement **l'authenticité des
      abonnés**, la performance future et la qualité du créateur
- [ ] Trois libellés, deux populations, parcours distincts
- [ ] Badge par réseau, jamais global
- [ ] Fraîcheur de 30 jours exigée, source native uniquement
- [ ] **L'agent saisit lui-même les valeurs constatées** ; le déclaré reste à part
- [ ] Preuve de propriété constatée en ligne par l'agent, horodatée avec son identité
- [ ] Liste de motifs de refus **fermée**, message associé à chacun
- [ ] Péremption 90 jours, « à rafraîchir », retrait, contestation spécifiés
- [ ] Pièces en compartiment privé, **jamais accessibles à un annonceur**, accès journalisés
- [ ] Date de vérification affichée partout où le badge l'est ; pièces jamais publiées
- [ ] Valeurs publiées en tranches
- [ ] Instructions de capture et refus des pièces trop larges
- [ ] Attribution **manuelle par un administrateur**, aucune automatisation
- [ ] Revue `expert-conformite-rgpd` (veto) demandée

## Format de sortie

**Ce que le badge affirme / n'affirme pas** → **Niveaux et populations** → **Pièces par réseau et
fraîcheur** → **Procédure de l'agent** → **Preuve de propriété** → **Motifs de refus et messages**
→ **Péremption, retrait, contestation** → **Stockage et publication** → **Effets produit** →
**Données de tiers** → **Cas limites** → **Critères d'acceptation** (via `feature-spec`) →
**Questions ouvertes avec leur arbitre**.

## Quand NE PAS invoquer cette skill

- **Vérification d'identité bancaire ou KYC** → hors MVP (le paiement est hors application).
- **Complétude d'un profil** et champs obligatoires → `feature-spec`.
- **Modération d'un visuel de portfolio** → `backoffice-ops` (file de modération) et
  `design-system-influx` (affichage).
- **File de traitement des demandes de vérification**, verrous, SLA → `backoffice-ops`.
- **Facettes de recherche et pondérations** → `matching-spec`.
- **Tables, stockage, RLS, rétention technique** → `supabase-schema`.
- **Preuve d'intermédiation et pipeline d'affaire** → `intermediation-tracking`.

## Questions ouvertes

| # | Question | Arbitre |
|---|---|---|
| 1 | **D34 — libellé exact, niveaux et durée de péremption** ; relecture juridique du libellé avant affichage | `product-owner` + `expert-conformite-rgpd` + juriste |
| 2 | **Données de tiers dans les captures** : base légale, instructions, durée de conservation des pièces | `expert-conformite-rgpd` (**veto**) |
| 3 | **Détection de faux abonnés** : acquérir un outil tiers ou assumer durablement que le badge ne dit rien sur l'authenticité | **Fondateur** |
| 4 | **Campagnes réservées aux profils vérifiés** : levier de désirabilité en tension avec D38 (masse critique) | `chef-de-projet` + **Fondateur** |
| 5 | Durée de validité du code de propriété et délai de grâce après péremption | `product-owner` + `expert-ux` |
