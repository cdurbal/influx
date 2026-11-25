# Tri, facettes et vue commerciale — règles A7, A10, A11, A13, A14

> Lu à la demande depuis `../SKILL.md`. Ce qui fait foi : `docs/mvp/10-recherche-createurs-anonymisee.md`.
> **D78 (pilote)** : aucun montant côté créateur ; tout critère économique est renvoyé en V2.

## A7 — Tri par défaut composite, déterministe et explicable

> **Le tri par défaut est un enchaînement de paliers lisibles, jamais un score nu.** Un agent
> commercial doit pouvoir dire en une phrase pourquoi ce profil est premier.

Ordre des paliers, appliqué dans cet ordre exact :

| # | Palier | Justification |
|---|---|---|
| 1 | Nombre de critères de recherche satisfaits au-delà des filtres obligatoires (thématique principale avant thématique secondaire) | Ce que la marque a demandé prime sur ce que la plateforme préfère |
| 2 | Adéquation à la campagne, quand la recherche part d'une campagne (formats, pays ; critère économique : V2, D78) | Le contexte connu vaut mieux qu'un critère générique |
| 3 | Niveau de badge (vérifié 2 > vérifié 1 > non vérifié) | La vérification est ce qui rend un profil contactable sans risque |
| 4 | Fraîcheur des chiffres d'audience (moins de 90 jours avant périmés) | Un chiffre d'il y a un an fait perdre une négociation |
| 5 | Complétude du profil, par paliers de 25 % | Un profil complet obtient plus de réponses ; jamais affiché comme une note |
| 6 | Disponibilité déclarée | Une indisponibilité déclarée est une demande morte |
| 7 | Réactivité habituelle, **si l'historique est suffisant** (≥ 5 demandes reçues), sinon neutre | Signal comportemental, mais sans écraser les nouveaux (A7 cas froid) |
| 8 | **Rotation déterministe quotidienne** : graine = date UTC + identifiant du créateur | Départage équitable. Stable dans la journée (la pagination ne saute pas), redistribué le lendemain : personne ne capte durablement la première place |

**L'explication affichée sur chaque carte.** Forme attendue :

> « Proposé car : thématique correspondante · plus de 70 % d'audience en France · propose le
> format vidéo TikTok · répond en général sous 48 h. »

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

**Tris alternatifs proposés :** audience (par tranche) · disponibles rapidement ·
**« Nouveaux profils »** (`10` RG43 fait foi ; aucun tri économique au pilote, V2, D78).

**Cas froid — règles explicites :**

- Un signal comportemental absent vaut **neutre, jamais pénalisant**.
- Étiquette **« Profil récent »**, neutre, jamais « aucun historique », qui se lit comme un défaut.
- **Quota d'exposition : au moins 2 places sur les 12 premiers résultats** réservées à des profils
  froids (publiés depuis moins de 30 jours ou jamais encore apparus dans un top 12).
- Les signaux comportementaux ne s'activent qu'au-delà d'un échantillon minimal (≥ 5 demandes).
- La rotation quotidienne (palier 8) est le second mécanisme anti-« le premier arrivé rafle tout ».

Sans ces quatre règles, un nouvel inscrit n'est jamais vu, ne reçoit aucune demande, ne produit
aucun signal, et reste invisible pour toujours. La marketplace ne démarre pas.

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

**Socle ouvert dès le lancement de la recherche — 7 facettes au pilote** (8 avec F12, renvoyée en V2 par D78). Le nombre est volontairement
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
| F17 | Niveau de badge | Multi-choix | Confiance et qualité ; rend le badge désirable, donc alimente la vérification |

*F12 (fourchette économique par format, en tranche et devise) : suspendue au pilote, renvoyée en V2 (D78) ; son
numéro reste réservé.*

**Seconde vague — donnée collectée dès le profil, filtre ouvert quand le volume le permet.**

| # | Facette | Format | Pourquoi elle existe |
|---|---|---|---|
| F2 | Thématiques secondaires (≤ 3) | Multi-choix | Élargit la découverte sans diluer la thématique principale ; futur bonus de score |
| F5 | Tranche de taux d'engagement | Tranche, **affichée seulement si vérifiée** | Réclamée systématiquement par les marques ; ininterprétable et manipulable si non vérifiée |
| F7 | Autres pays d'audience ≥ 10 % | Multi-choix | Campagnes multi-pays et francophonie |
| F9 | Répartition de genre **de l'audience** | Tranche (majorité féminine ≥ 60 %, mixte, majorité masculine ≥ 60 %) | Standard du média-planning. **Porte sur l'audience, jamais sur le créateur** (A12) |
| F10 | Tranche d'âge dominante **de l'audience** | Multi-choix (18-24, 25-34, 35-44, 45+) | Adéquation au produit ; même réserve qu'en F9 |
| F13 | Contrepartie non monétaire acceptée | Oui / non | Ouvre le bas de marché, les jeunes marques et les tests |
| F14 | Droits d'usage acceptés | Multi-choix : les quatre valeurs de `reference.usage_rights` (`09` RG38 : `none`, `organic_repost`, `paid_whitelisting`, `media_buy`) | **Première cause de désaccord** en négociation : la filtrer en amont évite des conversations perdues |
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
| Nombre d'abonnés exact, engagement exact, montant exact | Violent la règle d'or A2 |
| Marques déjà travaillées | Identifie le créateur en une recherche web ; utile au commercial seulement |
| Âge, genre, origine, situation personnelle du créateur | Caractéristiques personnelles : interdites (A12) |
| Note, étoiles, avis | Pas d'avis au MVP ; un classement par note est un score nu déguisé (A7) |
| Nombre de contrats signés sur INFLUX | Vaut zéro pour tout le monde au lancement ; stigmatise ensuite et aide à ré-identifier |
| Secteurs refusés par le créateur | Devient une **exclusion silencieuse** (A8), jamais une facette affichée |
| Complétude du profil | Devient un **palier de tri** (A7), pas un filtre exposé à la marque |

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
