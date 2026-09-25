---
name: matching-spec
description: Définir ou faire évoluer la recherche de créateurs et le moteur de mise en relation INFLUX — facettes de recherche, anonymisation par tranches, k-anonymat, tri explicable, vue commerciale identifiée, puis critères, pondérations, règles d'exclusion, explicabilité et mesure de la pertinence. À utiliser pour toute évolution de la recherche ou du matching.
---

# Spécifier la recherche et la mise en relation INFLUX

La mise en relation déclenche les contrats, donc la commission de 35 %. Une règle de recherche ou
de matching n'est bonne que si elle augmente le nombre d'affaires signées.

Agents concernés : `expert-matching` (principal), `product-owner` (valide), `expert-database`,
`expert-ux`, `expert-cybersecurite` (liste des champs interdits, garde-fous),
`expert-conformite-rgpd` (veto).

> **État au 2026-09-18.** Le fondateur a réintégré la **recherche libre de créateurs** (arbitrage
> A2), mais **sur des profils anonymisés** : thématiques, pays, audience, formats, tarifs,
> portfolio et badge sont visibles ; pseudos, `@`, liens et captures sont masqués jusqu'à
> l'ouverture de la mise en relation (D16 étendue). **Il n'y a aucun algorithme de scoring au
> MVP** : D11 reste reportée. La **Partie A** ci-dessous est donc ce qui s'applique aujourd'hui ;
> la **Partie B** (étapes 1 à 8) est le mode opératoire du moteur pondéré, à rouvrir quand les
> données existeront.

## Principe fondateur : dispositif hybride

> **L'algorithme propose et priorise. L'agent humain décide.**

Toute spécification de matching décrit **les deux voies** :
1. Ce que l'algorithme calcule et propose automatiquement.
2. Ce que l'agent interne peut faire depuis le backoffice : forcer, écarter, annoter, réordonner.

Toute intervention humaine est **tracée** et constitue un signal d'amélioration.

Au MVP, la première voie se réduit à **une recherche à facettes et un tri explicable** : aucune
suggestion n'est calculée, mais **toutes les données qui serviront à en calculer un jour sont
collectées dès maintenant**. C'est l'objet de la Partie A.

---

# Partie A — Recherche et facettes, avant l'algorithme

## A1 — Le lien de continuité : la recherche d'aujourd'hui est le score de demain

> **Une facette qui n'a pas vocation à devenir un critère de score ne se crée pas. Inversement,
> tout critère de score futur doit exister dès aujourd'hui comme donnée structurée.**

Les mêmes critères servent d'abord de **filtres** (l'utilisateur choisit), puis de **pondérations**
(le moteur choisit). Une facette et un critère de score sont deux usages du même champ. D'où
quatre corollaires :

1. **Toute facette est une liste fermée ou une tranche, jamais du texte libre.** Un texte libre
   n'est ni filtrable, ni pondérable, ni traduisible, ni comparable d'un profil à l'autre.
2. **Une taxonomie unique et versionnée** — thématiques, secteurs, formats, réseaux, droits
   d'usage — partagée par le profil créateur, la campagne et la recherche. Besoin dicté à
   `expert-database` : référentiel versionné, les valeurs déjà utilisées ne se renomment pas en
   place. Deux vocabulaires (un pour la campagne, un pour le profil) rendent tout rapprochement
   impossible, aujourd'hui à la main comme demain par pondération.
3. **Le journal des recherches est le jeu de données de D11.** Sans les filtres utilisés, le rang
   affiché et le rang cliqué, la future pondération n'aura rien à apprendre et sera réglée au
   doigt mouillé. C'est la raison principale pour laquelle la recherche relève de
   `expert-matching` et non d'un autre domaine.
4. **Pré-remplir les facettes depuis une campagne, c'est déjà pondérer à la main.** Ce pont
   recherche ↔ campagne (voir A10) est l'ancêtre direct du scoring : ce que le commercial
   pré-remplit et ce qu'il corrige ensuite indique quels critères comptent vraiment.

## A2 — Règle d'or : toute facette s'exprime en tranches

> **Toute facette doit être exprimable en tranches, jamais en valeurs exactes.**

Une valeur exacte identifie le créateur en deux ou trois recoupements : « beauté + Lyon +
47 312 abonnés » ne désigne qu'une seule personne, et une recherche web la retrouve en une
minute. La tranche conserve toute l'utilité de tri et détruit le pouvoir d'identification.

Trois conséquences, toutes vérifiables :

1. **La valeur exacte peut être stockée** (le commercial en a besoin, la vérification aussi) ;
   **la couche anonyme ne contient que la tranche pré-calculée**. Ce n'est pas un arrondi fait à
   l'affichage : la valeur exacte ne doit pas se trouver dans l'objet servi à l'annonceur.
2. **L'explication affichée réutilise le libellé de la tranche, jamais la valeur sous-jacente.**
   « 72 % d'audience en France » devient **« plus de 70 % d'audience en France »**. Un
   pourcentage exact dans une explication annule la facette qu'il est censé illustrer — c'est
   l'erreur la plus facile à commettre en rédigeant les libellés.
3. **Les bornes de tranches sont les mêmes partout** : profil créateur, facette de recherche,
   critère de campagne, explication affichée, futur critère de score.

## A3 — Champs qui ne sortent jamais de l'API avant révélation

Aucun de ces champs ne figure dans une réponse servie au rôle `advertiser` tant qu'une mise en
relation n'a pas été validée :

pseudo · `@` ou identifiant de compte · URL de profil ou de publication · nom et prénom réels ·
raison sociale · e-mail · téléphone · adresse, ville, code postal · **nombre d'abonnés exact** ·
taux d'engagement exact · **tarif exact** · captures d'écran brutes de statistiques · photo de
profil ou avatar du réseau · bio non modérée · pièces justificatives de vérification · date de
naissance · liste des marques déjà travaillées · identifiant technique séquentiel ou devinable.

> **Le contrôle se fait sur la réponse de l'API, jamais sur l'écran.** Un champ absent de
> l'interface mais présent dans le JSON est une fuite complète : il suffit d'ouvrir les outils de
> développement du navigateur.

Référence utile : le type `CreatorCard` de `apps/web/src/content/landing-content.ts` est
**volontairement dépourvu de tout champ d'identité** et exprime déjà l'audience en tranche
(`audienceMin` / `audienceMax`). C'est la forme à reproduire pour la carte réelle : la garantie
est portée par le type, pas par la discipline du développeur.

## A4 — L'anonymisation est portée par la base, jamais par l'affichage

> **RÈGLE NON NÉGOCIABLE. L'anonymisation est une séparation d'objets en base : un objet
> identifiant sur lequel le rôle annonceur n'a aucun droit de lecture, un objet anonymisé qu'il
> est seul autorisé à lire. Ce n'est ni un filtre dans un composant React, ni un `select` bien
> écrit dans un contrôleur, ni une convention d'équipe.**

- `creator_profiles` (identifiante) : **aucun `GRANT` au rôle annonceur**.
- `creator_public_profiles` (anonymisée) : ne contient que des tranches et des listes fermées.
- La révélation est **une politique SQL** qui teste l'existence d'une mise en relation validée,
  pas un booléen passé au composant.
- Le front ne parle jamais directement à Supabase pour de la donnée métier : il passe par l'API.

**Pourquoi c'est écrit en majuscules :** c'est le bug le plus probable et le plus grave du MVP.
Il ne se voit pas à l'écran, il ne fait échouer aucun test fonctionnel, il ne provoque aucune
erreur — et il détruit d'un seul coup D16, l'arbitrage A2, la confiance des créateurs et le
modèle économique, puisqu'une marque qui obtient un `@` n'a plus besoin d'INFLUX. Toute revue de
la recherche commence par cette vérification, avant toute considération d'ergonomie.

## A5 — Seuil de k-anonymat et porte de sortie commerciale

- **Seuil de départ : 5.** En dessous de 5 résultats après application des exclusions, **la liste
  n'est pas affichée du tout**, pas même partiellement.
- **Le message est strictement identique pour 0 et pour 4 résultats**, sans compteur. Sinon le
  décompte devient un oracle : « 4 résultats → j'ajoute un filtre → 0 résultat » isole un
  individu sans jamais l'avoir affiché.
- Le seuil porte sur **l'ensemble des résultats**, jamais sur la page courante.
- L'écran propose **deux à trois élargissements pré-construits** (retirer le filtre le plus
  restrictif, élargir la tranche d'audience, ajouter un pays voisin), formulés de façon grossière
  et sans annoncer de décompte.
- **Bouton « Demander une sélection à l'équipe INFLUX »** : crée une demande au backoffice
  reprenant les critères saisis. Ce n'est pas une impasse, c'est **un lead qualifié dont le brief
  est déjà écrit** — exactement le créneau où le commercial vaut plus que l'algorithme. Le taux
  d'usage de ce bouton est un indicateur à part entière (A13).
- **Le k-anonymat ne s'applique pas à la vue commerciale** (A10).
- Dépendance explicite à **D38** (masse critique, environ 30 profils publiés et 5 par thématique) :
  en dessous de ce volume, la recherche reste fermée et remplacée par le bouton de demande de
  sélection. Ouvrir une recherche anonymisée sur 12 profils, c'est soit ne rien afficher, soit
  ne rien anonymiser.

## A6 — Contenu d'une carte anonyme

**Alias.** Généré par la plateforme, **stable à vie et global** — le même pour tous les
annonceurs et pour le commercial, sinon une sélection, une demande de contact et une conversation
ne se rapprochent plus. Contraintes :

- **jamais dérivé du pseudo** (ni troncature, ni initiales, ni translittération) ;
- **jamais séquentiel** : « Créateur #12 » révèle l'ancienneté d'inscription et la taille du
  catalogue ;
- **sans marque de genre** : « Créatrice » est une donnée personnelle sur le créateur (A12).

Forme proposée : `Profil 7K3M`, accompagné d'une étiquette de contexte `Beauté · France`.

**Ce que la carte montre :** alias · thématique principale et secondaires · réseaux couverts et,
**en tête de chaque ligne de réseau, les trois métriques prioritaires** (D61) : tranche d'audience
(taille de la communauté), rythme de publication, tranche de commentaires moyens par publication —
toujours dans cet ordre · pays principal d'audience et sa part en tranche · langues de
publication · formats proposés · fourchette tarifaire indicative par format, avec sa devise ·
disponibilité déclarée · badge et sa date · tranche d'engagement **seulement si elle est
vérifiée** · 1 à 3 visuels de portfolio **modérés** (A9) · **date de dernière mise à jour des
chiffres** · la ligne « Proposé car : … ».

**Ce qu'elle ne montre jamais :** la liste A3.

**Deux actions, et deux seulement :**

| Action | Effet | Ce qu'elle ne fait pas |
|---|---|---|
| **Ajouter à ma sélection** | Shortlist privée de l'annonceur | Aucune notification au créateur, aucune révélation |
| **Demander une mise en relation** | Crée une entrée dans la **file de validation** | N'ouvre **pas** de conversation et ne révèle rien |

Le libellé de la seconde action doit énoncer le processus : « un commercial INFLUX valide votre
demande et vous met en relation ». Promettre un contact immédiat, c'est fabriquer la déception.

Variantes d'état : *déjà en relation* → « Ouvrir la conversation » ; *demande déjà en file* →
action désactivée et « demande envoyée le … » (évite les doublons dans la file).

> Une troisième action « ne plus me proposer ce profil » serait un excellent signal négatif pour
> D11. Elle n'est **pas** retenue d'office : inscrite en question ouverte pour `product-owner`.

## A7 — Tri par défaut composite, déterministe et explicable

> **Le tri par défaut est un enchaînement de paliers lisibles, jamais un score nu.** Un agent
> commercial doit pouvoir dire en une phrase pourquoi ce profil est premier.

Ordre des paliers, appliqué dans cet ordre exact :

| # | Palier | Justification |
|---|---|---|
| 1 | Nombre de critères de recherche satisfaits au-delà des filtres obligatoires (thématique principale avant thématique secondaire) | Ce que la marque a demandé prime sur ce que la plateforme préfère |
| 2 | Adéquation à la campagne, quand la recherche part d'une campagne (formats, pays, fourchette tarifaire) | Le contexte connu vaut mieux qu'un critère générique |
| 3 | Niveau de badge (vérifié 2 > vérifié 1 > non vérifié) | La vérification est ce qui rend un profil contactable sans risque |
| 4 | Fraîcheur des chiffres d'audience (moins de 90 jours avant périmés) | Un chiffre d'il y a un an fait perdre une négociation |
| 5 | Complétude du profil, par paliers de 25 % | Un profil complet obtient plus de réponses ; jamais affiché comme une note |
| 6 | Disponibilité déclarée | Une indisponibilité déclarée est une demande morte |
| 7 | Réactivité habituelle, **si l'historique est suffisant** (≥ 5 demandes reçues), sinon neutre | Signal comportemental, mais sans écraser les nouveaux (A7 cas froid) |
| 8 | **Rotation déterministe quotidienne** : graine = date UTC + identifiant du créateur | Départage équitable. Stable dans la journée (la pagination ne saute pas), redistribué le lendemain : personne ne capte durablement la première place |

**L'explication affichée sur chaque carte.** Forme attendue :

> « Proposé car : thématique correspondante · plus de 70 % d'audience en France · fourchette
> tarifaire compatible avec votre budget · répond en général sous 48 h. »

Règles de rédaction :

- **2 à 4 raisons maximum**, dans l'ordre des paliers ci-dessus.
- Uniquement des faits **vérifiables sur la carte elle-même**, exprimés dans le vocabulaire des
  facettes (un mot = un sens, partout).
- **Jamais un nombre exact** (A2), jamais un score, jamais « 97 % de compatibilité ».
- Ligne facultative **« Point de vigilance »** : chiffres datant de plus de 90 jours, profil
  récent sans historique. L'honnêteté du tri est ce qui rend la suggestion crédible auprès d'un
  acheteur professionnel.
- Composée de **fragments traduits FR/EN** (next-intl, format ICU), jamais d'une phrase
  concaténée dans le code : une explication non traduite est une explication absente.

**Tris alternatifs proposés :** audience (par tranche) · tarif indicatif croissant (par tranche) ·
disponibles rapidement · **« Nouveaux profils »**.

**Cas froid — règles explicites :**

- Un signal comportemental absent vaut **neutre, jamais pénalisant**.
- Étiquette **« Profil récent »**, neutre, jamais « aucun historique », qui se lit comme un défaut.
- **Quota d'exposition : au moins 2 places sur les 12 premiers résultats** réservées à des profils
  froids (publiés depuis moins de 30 jours ou jamais encore apparus dans un top 12).
- Les signaux comportementaux ne s'activent qu'au-delà d'un échantillon minimal (≥ 5 demandes).
- La rotation quotidienne (palier 8) est le second mécanisme anti-« le premier arrivé rafle tout ».

Sans ces quatre règles, un nouvel inscrit n'est jamais vu, ne reçoit aucune demande, ne produit
aucun signal, et reste invisible pour toujours. La marketplace ne démarre pas.

## A8 — Exclusions appliquées à la recherche

Les exclusions de l'étape 2 (Partie B) s'appliquent, **complétées** par :

- [ ] Profil **non publié** (brouillon, jamais soumis)
- [ ] Compte **suspendu** ou en cours de modération
- [ ] Créateur ayant **bloqué cet annonceur**, et réciproquement
- [ ] Créateur **mineur ou sans attestation de majorité** (D15)
- [ ] **Secteur refusé par le créateur** correspondant à la catégorie de la campagne

Deux règles de comportement :

> **Une exclusion ne se montre jamais comme une exclusion.** Le profil est absent : aucun
> message, aucun emplacement grisé, aucun décompte. Sinon la recherche devient un oracle qui
> apprend à la fois l'existence d'un profil et le motif de son écartement — particulièrement
> grave pour les secteurs refusés, dont la divulgation pourrait laisser inférer une conviction
> personnelle (A12).

> **Une paire déjà en relation reste visible, mais signalée** : « vous êtes déjà en relation »,
> et l'action devient « ouvrir la conversation ». La masquer ferait croire à la disparition du
> profil et pousserait la marque à chercher le créateur ailleurs — exactement ce que le modèle
> économique interdit.

Deux cas qui **ne sont pas** des exclusions :

| Cas | Traitement |
|---|---|
| Chiffres d'audience périmés (> 90 j) ou badge expiré | Signalement sur la carte + rétrogradation au palier 4, pas une disparition |
| Pays non ouvert aux contrats (D26) | Sans objet au MVP, le contrat étant hors application (A1). À rouvrir en V2 comme exclusion ou comme avertissement |

## A9 — Garde-fous anti-ré-identification et anti-aspiration

Un annuaire anonymisé sans garde-fous se ré-identifie par accumulation, pas par faille.

| Garde-fou | Valeur de départ, à calibrer |
|---|---|
| **Pagination plafonnée** | 12 résultats par page, **5 pages, 60 résultats maximum** par recherche ; pas de saut de page arbitraire, pas de pagination profonde |
| **Export interdit** | Pas de CSV, pas de « tout sélectionner », pas d'endpoint de liste brute, y compris en vue commerciale. Un export industrialiserait le contournement en une seule action |
| **Limitation de débit** | 30 recherches/heure, 200/jour, 60 profils ouverts/jour par compte ; alerte interne à 80 % du plafond |
| **Journalisation de chaque recherche** | Compte, horodatage, filtres appliqués, nombre de résultats, page atteinte, alias affichés, alias ouverts, **rang cliqué** |
| **Détection d'affinage** | Suite de recherches ne variant que d'un filtre et frôlant le seuil k → alerte (attaque par différenciation, cf. A5) |
| **Modération des visuels** | **Chaque visuel de portfolio est modéré manuellement avant publication** |

Sur le journal : **un volume anormal est autant un signal produit qu'un signal de contournement.**
200 profils consultés et zéro demande de mise en relation, c'est soit de l'aspiration, soit une
recherche qui ne convertit pas — et il faut regarder les deux hypothèses. Finalité double à
inscrire au registre des traitements, durée de conservation à fixer avec
`expert-conformite-rgpd`.

**Modération des visuels de portfolio — la fuite d'anonymisation la plus probable.** Tout le
dispositif A3/A4 est décoratif si une image porte le pseudo. Checklist du modérateur, un visuel =
une décision, avec motif typé, **re-modération à chaque remplacement** :

- [ ] Filigrane, signature, logo personnel
- [ ] `@` ou nom de compte incrusté dans l'image ou la vidéo
- [ ] Interface d'application visible (bandeau de profil, miniature d'avatar, fil de commentaires)
- [ ] Texte incrusté mentionnant le compte ou une marque partenaire
- [ ] Enseigne, plaque d'immatriculation, numéro de rue, lieu reconnaissable
- [ ] Visage lorsqu'il suffit à retrouver le compte par recherche d'image
- [ ] **Métadonnées EXIF supprimées systématiquement**, en particulier la géolocalisation
- [ ] **Capture d'écran de statistiques : interdite en couche anonyme** — elle porte le pseudo.
      Les chiffres sont saisis par l'agent lors de la vérification, la preuve reste en stockage
      privé

## A10 — La vue commerciale identifiée

Le commercial dispose de **la même recherche, sur le même moteur et les mêmes facettes**, avec
cinq différences assumées. C'est le point de départ de la **proposition INFLUX**, troisième
déclencheur de mise en relation.

| Point | Vue annonceur | Vue commerciale |
|---|---|---|
| Identités | Anonymisées | **Visibles** : pseudo, `@`, liens, nom, chiffres exacts, historique |
| k-anonymat | Appliqué (5) | **Non applicable** |
| Profils non publiés | Exclus | **Visibles, étiquetés « brouillon »** — le commercial peut relancer le créateur |
| Blocage entre parties | Profil absent | **Affiché avec un avertissement bloquant** : le commercial doit savoir pourquoi il ne peut pas proposer |
| Sélection | Shortlist privée | **Sélection multiple (≤ 20)** → « Proposer à une campagne » |
| Journalisation | Recherche journalisée | Recherche **et consultation journalisées et nominatives** : c'est une surface privilégiée |
| Export | Interdit | **Interdit aussi.** Un besoin réel passe par une demande admin motivée et journalisée |

**Facettes supplémentaires réservées au commercial** (inutiles ou dangereuses côté annonceur) :
date du dernier contact · charge en cours (mises en relation ouvertes) · déjà proposé à cette
campagne · **jamais proposé à personne** · taux de réponse réel · commercial responsable · type
juridique (particulier / société) · pays de résidence.

**Filtrage par campagne.** « Créateurs compatibles avec la campagne X » pré-remplit les facettes à
partir du brief. Depuis cette liste, le commercial sélectionne, écrit un motif, et ouvre autant de
mises en relation que de destinataires — chacune tracée séparément. **Objectif de conception :
trois clics.** Si l'outil n'est pas plus rapide qu'un coup de fil, le commercial continuera de
téléphoner et la traçabilité sera perdue.

Cette vue est aussi **le laboratoire du futur scoring** : ce que le commercial ajoute ou retire
par rapport au pré-remplissage issu de la campagne est la meilleure donnée d'apprentissage
disponible avant D11. Elle est journalisée à ce titre.

## A11 — Première proposition de facettes

> **Proposition de `expert-matching` — à valider par `product-owner` et le fondateur.** Les
> facettes ne sont pas figées : elles s'ouvrent et se ferment au vu des mesures (A13).

**Socle ouvert dès le lancement de la recherche — 8 facettes.** Le nombre est volontairement
réduit : avec une trentaine de profils publiés (D38), ouvrir vingt filtres garantit que la
majorité des recherches passe sous le seuil de k-anonymat et n'affiche rien. Les autres données
**sont collectées dès le profil créateur** (règle A1), mais **le filtre ne s'ouvre qu'au volume**.

| # | Facette | Format | Pourquoi elle existe |
|---|---|---|---|
| F1 | Thématique principale | Liste fermée, 1 choix | Premier réflexe de toute marque ; futur critère au poids le plus fort |
| F3 | Réseaux couverts | Multi-choix | Une campagne TikTok adressée à un profil sans TikTok est une demande morte |
| F4 | Tranche d'audience par réseau | Tranche (nano, micro, mid, macro, méga) | Détermine le budget et le type de campagne. **Jamais le nombre exact** |
| F6 | Pays principal de l'audience **et sa part** | Liste fermée + tranche (≥ 80 %, 50-80 %, < 50 %) | **La facette la plus utile** : une audience hors marché annule toute pertinence thématique |
| F8 | Langues de publication | Multi-choix | Sépare les marchés FR / EN / PT ; condition d'exécution du brief |
| F11 | Formats proposés | Multi-choix | Format non proposé = exclusion ; futur critère de format |
| F12 | Fourchette tarifaire **par format** | Tranche + devise | Compatibilité économique : première cause d'échec en négociation |
| F17 | Niveau de badge | Multi-choix | Confiance et qualité ; rend le badge désirable, donc alimente la vérification |

**Seconde vague — donnée collectée dès le profil, filtre ouvert quand le volume le permet.**

| # | Facette | Format | Pourquoi elle existe |
|---|---|---|---|
| F2 | Thématiques secondaires (≤ 3) | Multi-choix | Élargit la découverte sans diluer la thématique principale ; futur bonus de score |
| F5 | Tranche de taux d'engagement | Tranche, **affichée seulement si vérifiée** | Réclamée systématiquement par les marques ; ininterprétable et manipulable si non vérifiée |
| F7 | Autres pays d'audience ≥ 10 % | Multi-choix | Campagnes multi-pays et francophonie |
| F9 | Répartition de genre **de l'audience** | Tranche (majorité féminine ≥ 60 %, mixte, majorité masculine ≥ 60 %) | Standard du média-planning. **Porte sur l'audience, jamais sur le créateur** (A12) |
| F10 | Tranche d'âge dominante **de l'audience** | Multi-choix (18-24, 25-34, 35-44, 45+) | Adéquation au produit ; même réserve qu'en F9 |
| F13 | Contrepartie non monétaire acceptée | Oui / non | Ouvre le bas de marché, les jeunes marques et les tests |
| F14 | Droits d'usage acceptés | Multi-choix (organique seul, whitelisting / publicité payante, réutilisation site et print) | **Première cause de désaccord** en négociation : la filtrer en amont évite des conversations perdues |
| F15 | Exclusivité sectorielle acceptée | Tranche de durée (non / ≤ 1 mois / ≤ 3 mois / négociable) | **Deuxième cause de désaccord**, même raisonnement |
| F16 | Disponibilité déclarée + date de déclaration | Tranche (< 2 semaines / < 1 mois / complet) | Évite les demandes mortes ; futur critère de disponibilité |
| F18 | Expérience de collaborations | Tranche (0 / 1-5 / 6-20 / 20+) | Signal de sérieux ; augmente la confiance de la marque, donc le taux de demande |
| F19 | Délai de réponse habituel | Tranche, dont « pas encore d'historique » | Futur signal comportemental ; **valeur neutre en cas froid**, jamais pénalisante |
| F20 | Pays de résidence + mobilité | Pays **uniquement** + déplacement possible oui/non | Tournages, événements, UGC en magasin. **Jamais la ville** (A2) |
| F24 | Rythme de publication par réseau *(D61)* | Liste fermée (quotidien → mensuel ou moins), **dérivée** du nombre de publications des 30 derniers jours | **Métrique prioritaire du fondateur** ; un compte qui ne publie plus ne portera pas une campagne. Candidate au socle (`10` Q13) |
| F25 | Commentaires moyens par publication, par réseau *(D61)* | Tranche (0-9 / 10-49 / 50-199 / 200-999 / 1 000+), **affichée même déclarée** | **Métrique prioritaire du fondateur** ; mesure une audience qui réagit. Candidate au socle (`10` Q13) |

> **Métriques prioritaires des créateurs (D61, fondateur, 2026-09-25).** La taille de la communauté,
> le rythme de publication et le nombre moyen de commentaires par publication sont les trois chiffres
> suivis **en priorité**, par réseau. Toute proposition de tri, d'explication ou de future
> pondération (Partie B) les traite comme les critères d'audience de premier rang ; le taux
> d'engagement et la portée sont **secondaires**. Définitions et bornes : `docs/mvp/07` §E bis.

**Facettes écartées — et pourquoi.** Cette liste vaut la précédente : elle documente ce qu'il ne
faut pas rouvrir dans six mois.

| Écartée | Motif |
|---|---|
| Ville ou région du créateur | Ré-identification quasi immédiate combinée à la thématique |
| Nombre d'abonnés exact, engagement exact, tarif exact | Violent la règle d'or A2 |
| Marques déjà travaillées | Identifie le créateur en une recherche web ; utile au commercial seulement |
| Âge, genre, origine, situation personnelle du créateur | Caractéristiques personnelles : interdites (A12) |
| Note, étoiles, avis | Pas d'avis au MVP ; un classement par note est un score nu déguisé (A7) |
| Nombre de contrats signés sur INFLUX | Vaut zéro pour tout le monde au lancement ; stigmatise ensuite et aide à ré-identifier |
| Secteurs refusés par le créateur | Devient une **exclusion silencieuse** (A8), jamais une facette affichée |
| Complétude du profil | Devient un **palier de tri** (A7), pas un filtre exposé à la marque |

## A12 — Conformité propre à la recherche

- **Aucun critère fondé sur une caractéristique personnelle protégée du créateur** : genre, âge,
  origine, état de santé, convictions, orientation, situation familiale.
- **La répartition de genre et d'âge ne porte que sur la composition de l'audience**, agrégée et
  en tranches : c'est une statistique professionnelle de média-planning portant sur des tiers, pas
  un attribut du créateur. **Elle ne doit jamais pouvoir être détournée en filtre sur le créateur
  lui-même** — ni par une facette, ni par un libellé d'explication, ni par un alias genré (A6).
- Les données d'audience portent sur des tiers : elles restent **agrégées**, jamais au niveau
  individuel.
- **Les secteurs refusés ne sont jamais exposés ni motivés** : ils pourraient laisser inférer une
  conviction personnelle. D'où l'exclusion silencieuse d'A8.
- **Pas de décision individuelle automatisée au MVP** (aucun scoring, D11 reportée) : l'article 22
  du RGPD n'est pas déclenché. L'information reste due pour autant. Le créateur doit savoir : (1)
  qu'il figure dans un annuaire consultable sous forme anonymisée, (2) **quel champ appartient à
  quelle couche**, (3) que les recherches sont journalisées, (4) comment il peut se retirer.
- **Question ouverte** : un interrupteur « visible dans la recherche / masqué ». C'est
  l'expression du droit d'opposition, mais se masquer revient à ne recevoir aucune proposition.
  L'arbitrage appartient à `product-owner` et `expert-conformite-rgpd`.
- Validation de `expert-conformite-rgpd` **avant** l'ouverture de la recherche.

## A13 — Mesure de la recherche au MVP

Voir l'étape 6 (Partie B), **adaptée au MVP** : il n'y a pas de contrat dans l'application (A1),
l'indicateur de référence n'est donc plus « contrat signé dans la plateforme » mais
**recherche → demande de contact → affaire signée**, l'affaire étant enregistrée par le commercial
dans le pipeline du backoffice.

## A14 — Cas de test de la recherche à livrer au `testeur`

| # | Cas | Attendu |
|---|---|---|
| CT1 | Réponse d'API de recherche, rôle annonceur | Aucun champ de la liste A3 — contrôle sur le JSON, pas sur l'écran |
| CT2 | Le rôle `advertiser` interroge directement l'objet identifiant | Refus, y compris hors application |
| CT3 | Après validation d'une mise en relation | Les champs identifiants apparaissent, et l'horodatage de révélation est écrit |
| CT4 | Recherche renvoyant 4 résultats | Liste non affichée, élargissements proposés, bouton « demander une sélection » |
| CT5 | Recherche à 0 résultat et recherche à 4 résultats | **Message strictement identique**, aucun décompte |
| CT6 | Six recherches successives ne variant que d'un filtre, près du seuil | Alerte d'affinage déclenchée |
| CT7 | Clic sur « Demander une sélection à l'équipe INFLUX » | Demande créée au backoffice avec tous les critères saisis |
| CT8 | Profil non publié / suspendu / mineur / secteur refusé | Absent, **sans message ni décompte** |
| CT9 | Créateur ayant bloqué l'annonceur | Absent côté annonceur ; **visible avec avertissement bloquant** côté commercial |
| CT10 | Paire déjà en relation | Visible, signalée, action « ouvrir la conversation » |
| CT11 | Demande déjà en file pour cette paire | Action désactivée, date affichée, aucun doublon créé |
| CT12 | Explication d'une carte | 2 à 4 raisons, **aucune valeur exacte**, présente en français et en anglais |
| CT13 | Deux exécutions de la même recherche le même jour, puis le lendemain | Ordre identique le jour même ; palier 8 redistribué le lendemain |
| CT14 | Liste de 12 résultats avec des profils récents disponibles | Au moins 2 profils froids présents ; aucun profil sans historique n'est rétrogradé |
| CT15 | Alias | Stable entre sessions et entre annonceurs, non séquentiel, non dérivé du pseudo, sans marque de genre |
| CT16 | Tentative d'accès au-delà de 60 résultats | Refusée ; pas de saut de page arbitraire |
| CT17 | Recherche d'un chemin d'export, annonceur puis commercial | Aucun dans les deux cas |
| CT18 | Dépassement du plafond de débit | Refus propre + alerte interne |
| CT19 | Toute recherche | Journal écrit : filtres, nombre de résultats, alias affichés, rang cliqué |
| CT20 | Visuel de portfolio non modéré, ou portant un `@`, ou avec EXIF de géolocalisation | Non publié, motif typé enregistré |

---

# Partie B — Spécifier une règle de matching pondérée

> Cette partie s'applique **après le MVP**, quand D11 sera rouverte et que le journal des
> recherches, les motifs de refus et les affaires signées fourniront de quoi régler des
> pondérations. Elle ne s'invoque pas pour concevoir un algorithme aujourd'hui.

## Étape 1 — Définir l'objectif de la règle

- Quel problème de pertinence est traité ?
- Quel comportement observé le motive ? (suggestions ignorées, agents qui surchargent toujours
  au même endroit, campagnes sans proposition…)
- Quel indicateur doit bouger, et de combien ?

## Étape 2 — Séparer exclusions et pondérations

**Les règles d'exclusion priment sur le score.** Elles éliminent, elles ne se pondèrent pas :

- [ ] Conflit d'intérêt (marque concurrente d'un engagement en cours)
- [ ] Budget de campagne incompatible avec les tarifs de l'influenceur
- [ ] Profil non vérifié ou suspendu
- [ ] Blocage explicite entre les deux parties
- [ ] Indisponibilité sur la période de la campagne
- [ ] Format demandé non proposé par l'influenceur
- [ ] **Profil non publié** (brouillon jamais soumis)
- [ ] **Compte suspendu ou en cours de modération**
- [ ] **Créateur ayant bloqué cet annonceur**, et réciproquement
- [ ] **Créateur mineur ou sans attestation de majorité** (D15)
- [ ] **Secteur refusé par le créateur** correspondant à la catégorie de la campagne

Deux règles de comportement héritées d'A8, valables aussi pour les suggestions :

- **Une exclusion ne se montre jamais comme une exclusion** : le profil est absent, sans message
  ni décompte.
- **Une paire déjà en relation reste visible mais signalée** (« vous êtes déjà en relation »),
  l'action devenant « ouvrir la conversation ».

**Les critères de pondération** classent ce qui reste. Ils se construisent **à partir des facettes
d'A11**, pas d'un nouveau vocabulaire :

| Famille | Exemples | Facettes correspondantes | Poids proposé |
|---|---|---|---|
| Pertinence thématique | Secteur annonceur vs thématiques influenceur | F1, F2 | à définir |
| Audience | Volume, démographie, zone géographique, réseaux | F3, F4, F6, F7, F9, F10 | à définir |
| Compatibilité économique | Budget vs tarifs indicatifs | F12, F13 | à définir |
| Format et droits | Formats demandés vs proposés, droits d'usage, exclusivité | F11, F14, F15 | à définir |
| Disponibilité | Période, charge en cours | F16 | à définir |
| Qualité du profil | Complétude, vérification, fraîcheur des chiffres, historique | F17, F18, complétude | à définir |
| Signal comportemental | Taux de réponse, taux d'acceptation, rapidité | F19 | à définir |

Chaque poids doit être **justifié par un lien plausible avec la signature d'un contrat**.

## Étape 3 — Rédiger l'explication affichée

Toute suggestion affiche **pourquoi** elle est faite, en français, compréhensible par un
non-technicien. Les règles de rédaction d'A7 s'appliquent intégralement : 2 à 4 raisons, faits
vérifiables, vocabulaire des facettes, **aucune valeur exacte**, fragments traduits FR/EN.

> « Proposé car : thématique beauté correspondante · plus de 70 % d'audience en France · tarif
> compatible avec votre budget · répond généralement sous 48 h. »

**Un score numérique seul est interdit** : inutilisable par un agent commercial, opaque pour
l'utilisateur, et non conforme aux exigences d'information sur les traitements automatisés.

## Étape 4 — Traiter le cas froid

Un nouvel influenceur sans historique et une nouvelle campagne doivent **quand même** recevoir
des propositions, sinon la marketplace ne démarre pas. Spécifier :

- Quelle valeur par défaut pour les critères comportementaux absents ? (règle A7 : **neutre,
  jamais pénalisant**)
- Quel mécanisme de mise en avant des nouveaux profils ? (règle A7 : **quota d'exposition** dans
  les 12 premiers résultats, **rotation déterministe quotidienne**)
- À partir de quand les signaux comportementaux prennent-ils le pas ? (échantillon minimal
  explicite, jamais implicite)

## Étape 5 — Définir les points d'intervention humaine

- [ ] Où l'agent voit-il les suggestions et leur explication ?
- [ ] Comment force-t-il une mise en relation hors suggestion ? (au MVP : la **proposition
      INFLUX** depuis la vue commerciale identifiée, A10)
- [ ] Comment écarte-t-il une suggestion, et avec quel motif **typé** ?
- [ ] Comment son action est-elle tracée et réexploitée ?
- [ ] Quels seuils déclenchent une alerte à l'équipe (campagne sans aucune proposition, profil
      jamais proposé, recherche systématiquement sous le seuil k…) ?

## Étape 6 — Définir la mesure

**Au MVP, l'indicateur de référence change.** Il n'y a pas de contrat dans l'application (A1) :
l'entonnoir mesuré est **recherche lancée → résultats non vides → profil ouvert → ajouté à une
sélection → demande de mise en relation → validée → conversation ouverte → affaire signée saisie
par le commercial → commission encaissée**.

| Indicateur | Ce qu'il mesure |
|---|---|
| **Recherche → demande de contact → affaire signée** | **Indicateur de référence au MVP** (l'affaire est saisie par le commercial dans le pipeline) |
| Taux de réponse à une suggestion | Pertinence perçue immédiate |
| Taux de mise en relation acceptée | Pertinence confirmée |
| Taux de transformation en contrat signé | Indicateur de référence **après** la V2, quand le contrat revient dans la plateforme |
| Délai jusqu'au premier contact | Fluidité |
| Part des recherches sous le seuil de k-anonymat | Masse critique insuffisante (D38) ou facettes trop fines |
| Demandes « sélection par l'équipe » rapportées aux demandes directes | Si la première dépasse la seconde, le produit livré est en réalité un formulaire de brief |
| Rang moyen du profil cliqué | Qualité du tri — **et matière première de D11** |
| Profils jamais affichés en 30 jours | Iniquité d'exposition : le tri est à corriger |
| Facettes utilisées dans moins de 2 % des recherches | À retirer : friction de saisie côté créateur sans contrepartie |
| Taux de surcharge humaine | Contre-indicateur : signal d'un critère mal pondéré |
| Part des campagnes sans aucune proposition | Couverture du moteur |
| Mises en relation traitées par commercial et par semaine | Rappel : le plafond de croissance est humain, pas technique |

> **Seuil d'alerte principal.** Si le passage **recherche → demande de contact** reste très faible
> (valeur de départ proposée : **moins de 5 %**) alors que les recherches renvoient bien des
> résultats, **c'est l'anonymisation elle-même qu'il faut reconsidérer** : soit on montre
> davantage (visuels supplémentaires, engagement vérifié, extrait modéré), soit on renforce
> l'accompagnement commercial. Réserve de lecture : cet indicateur est inexploitable si le délai
> de traitement de la file de validation dérape (D39) — les deux se lisent ensemble, sinon on
> corrigera la recherche pour un problème de délai.

Toute modification de pondération **ou de liste de facettes** est traitée comme un **changement de
version** : mesure avant, mesure après, sur une période définie à l'avance.

## Étape 7 — Vérifier la conformité

- [ ] Aucun critère fondé sur une caractéristique personnelle protégée. Uniquement des éléments
      professionnels (audience, thématique, formats, tarifs, performances).
- [ ] **La répartition de genre et d'âge ne porte que sur l'audience, jamais sur le créateur**
      (A12).
- [ ] Information des personnes sur l'existence d'un traitement automatisé, et sur la couche
      d'exposition de chaque champ.
- [ ] Possibilité d'intervention humaine documentée.
- [ ] Validation par `expert-conformite-rgpd`.

## Étape 8 — Fournir les cas de test

Livrer à `testeur` un jeu de cas attendus : profils d'entrée, campagne, suggestions attendues
dans l'ordre, et exclusions qui doivent s'appliquer. Pour la recherche, les cas **CT1 à CT20**
d'A14 sont le minimum — **CT1, CT2 et CT5 sont bloquants**. Une règle de matching sans cas de
test n'est pas livrable.

---

## Données manquantes à collecter

À demander explicitement à `product-owner`, `expert-ux` et `expert-database`. Sans elles, la
recherche fonctionne mais D11 ne pourra jamais être réglée autrement qu'à l'intuition.

- **Rang affiché et rang cliqué** de chaque profil, à chaque recherche.
- **Filtres de la recherche d'origine conservés sur la demande de mise en relation** : c'est le
  seul lien entre ce que la marque a cherché et ce qu'elle a signé.
- **Motifs typés de refus** en file de validation (signal négatif).
- **Issue de l'affaire** et motif de perte, saisis par le commercial.
- **Date de dernière mise à jour, par champ d'audience** (pas une date globale de profil).
- **Historique des trois métriques prioritaires** (D61 : abonnés, publications des 30 derniers
  jours, commentaires moyens), valeur par valeur, avec source et date : c'est la seule façon de
  savoir plus tard si une communauté qui grandit convertit mieux qu'une communauté stable.
- **Tarif structuré par format et par réseau**, avec sa devise : un tarif global ne se compare à
  aucun budget de campagne.
- **Règle de conversion entre devises** pour comparer un budget à un tarif dans une autre devise.
  Dépend de D27 : **signalé comme donnée manquante bloquante** pour la facette F12 dès qu'une
  seconde devise existe.
- **Secteurs refusés** par le créateur (exclusion silencieuse).
- **Droits d'usage et exclusivité acceptés** (F14, F15).
- **Alias stable** stocké, non dérivé, non séquentiel.
- **Journal des recherches**, avec sa durée de conservation validée.

## Format de sortie

**Objectif** → **Règles d'exclusion** → **Facettes proposées et leur justification** (avec leur
format en tranches) → **Règle d'anonymisation appliquée et champs interdits** → **Seuil de
k-anonymat et porte de sortie** → **Tri par défaut et tris alternatifs** → **Explication
affichée** → **Comportement en cas froid** → **Différences entre vue annonceur et vue
commerciale** → **Garde-fous** → **Points d'intervention humaine** → **Indicateurs et seuils**
→ **Données manquantes à collecter** → **Cas de test** → **Validation `product-owner` et
`expert-conformite-rgpd`**.

## Quand NE PAS invoquer cette skill

- Pour **dessiner** l'écran de recherche, la carte ou l'écran de surcharge → `expert-ux` et
  `design-system-influx`. Cette skill dit *ce qui est affiché et pourquoi*, pas *à quoi ça
  ressemble*.
- Pour la **file de validation, la révélation d'identité, la conversation à trois** →
  `intermediation-tracking` et `messaging-spec`. La recherche s'arrête au bouton « demander une
  mise en relation ».
- Pour le **badge**, ses niveaux et sa procédure → `profile-verification` (la facette F17 le
  consomme, elle ne le définit pas).
- Pour le **modèle de données, les migrations et la RLS** → `supabase-schema` et
  `expert-database`. Les besoins viennent d'ici, la modélisation se fait là-bas.
- Pour **choisir les destinataires d'un e-mail** → `brevo-campaign`, même si cela ressemble à du
  ciblage : ce n'est ni la même base légale, ni les mêmes garde-fous.
- Pour trier une liste de backoffice **sans enjeu de pertinence commerciale**.
- Pour la **recherche de campagnes côté créateur** → `feature-spec`, **sauf** pour la taxonomie et
  les facettes, qui restent définies ici : deux vocabulaires sur les mêmes critères divergeraient
  en trois mois.
- **Pour concevoir un algorithme de scoring : pas au MVP.** D11 est reportée. La Partie B ne se
  rouvre que lorsque le journal des recherches et les affaires signées fournissent assez de
  données pour régler des pondérations autrement qu'à l'intuition.
