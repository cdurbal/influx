# Moteur pondéré — Partie B, données manquantes, format de sortie

> Lu à la demande depuis `../SKILL.md`. Ce qui fait foi : `docs/mvp/10-recherche-createurs-anonymisee.md`.
> **D78 (pilote)** : aucun montant côté créateur ; tout critère économique est renvoyé en V2.
> Ne s'invoque qu'à la réouverture de D11.

## Partie B — Spécifier une règle de matching pondérée

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
- [ ] Profil non vérifié ou suspendu
- [ ] Blocage explicite entre les deux parties
- [ ] Indisponibilité sur la période de la campagne
- [ ] Format demandé non proposé par l'influenceur
- [ ] **Profil non publié** (brouillon jamais soumis)
- [ ] **Compte suspendu ou en cours de modération**
- [ ] **Créateur ayant bloqué cet annonceur**, et réciproquement
- [ ] **Créateur de moins de 18 ans ou sans attestation « 18 ans ou plus »** (D15)
- [ ] **Secteur refusé par le créateur** correspondant à la catégorie de la campagne

*L'exclusion économique (budget de campagne incompatible avec le prix déclaré du créateur) est renvoyée en V2
(D78) : aucun prix n'est saisi au pilote.*

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
| Contrepartie | Contrepartie non monétaire acceptée | F13 | à définir |
| Format et droits | Formats demandés vs proposés, droits d'usage, exclusivité | F11, F14, F15 | à définir |
| Disponibilité | Période, charge en cours | F16 | à définir |
| Qualité du profil | Complétude, vérification, fraîcheur des chiffres, historique | F17, F18, complétude | à définir |
| Signal comportemental | Taux de réponse, taux d'acceptation, rapidité | F19 | à définir |

*Famille « compatibilité économique » (budget de campagne contre prix déclaré, F12) : V2 (D78).*

Chaque poids doit être **justifié par un lien plausible avec la signature d'un contrat**.

## Étape 3 — Rédiger l'explication affichée

Toute suggestion affiche **pourquoi** elle est faite, en français, compréhensible par un
non-technicien. Les règles de rédaction d'A7 s'appliquent intégralement : 2 à 4 raisons, faits
vérifiables, vocabulaire des facettes, **aucune valeur exacte**, fragments traduits FR/EN.

> « Proposé car : thématique beauté correspondante · plus de 70 % d'audience en France · propose
> le format vidéo TikTok · répond généralement sous 48 h. »

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
      professionnels (audience, thématique, formats, performances).
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
- **Critère économique (V2, D78)** : prix structuré par format et par réseau avec sa devise, et
  règle de conversion entre devises (D27), à collecter quand D78 sera levée.
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
