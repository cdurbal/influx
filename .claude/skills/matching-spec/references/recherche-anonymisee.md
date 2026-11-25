# Recherche anonymisée — règles A1 à A6, A8, A9, A12

> Lu à la demande depuis `../SKILL.md`. Ce qui fait foi : `docs/mvp/10-recherche-createurs-anonymisee.md`.
> **D78 (pilote)** : aucun montant côté créateur ; tout critère économique est renvoyé en V2.

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
taux d'engagement exact · **tout montant** (D78 : aucun n'est saisi côté créateur au pilote) · captures d'écran brutes de statistiques · photo de
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
publication · formats proposés ·
disponibilité déclarée · badge et sa date · tranche d'engagement **seulement si elle est
vérifiée** · 1 à 3 visuels de portfolio **modérés** (A9) · **date de dernière mise à jour des
chiffres** · la ligne « Proposé car : … ».

**Ce qu'elle ne montre jamais :** la liste A3. Au pilote, aucun montant (D78) : la fourchette économique par
format est renvoyée en V2.

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

## A8 — Exclusions appliquées à la recherche

Les exclusions de l'étape 2 (Partie B) s'appliquent, **complétées** par :

- [ ] Profil **non publié** (brouillon, jamais soumis)
- [ ] Compte **suspendu** ou en cours de modération
- [ ] Créateur ayant **bloqué cet annonceur**, et réciproquement
- [ ] Créateur **de moins de 18 ans ou sans attestation « 18 ans ou plus »** (D15)
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
