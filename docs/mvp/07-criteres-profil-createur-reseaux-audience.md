# Lot 2 — Profil créateur : réseaux, audience, offre, portfolio et couches de visibilité

> **⚠️ Régime du pilote — D48 (arbitrage du fondateur du 2026-09-24).** Pendant le pilote, **aucun taux ni aucun net créateur estimé n'est affiché**, ni aux marques ni aux créateurs. Toutes les mentions du « net créateur estimé » et du pourcentage de commission dans ce document sont **suspendues** jusqu'à nouvel arbitrage ; la commission est présentée comme « incluse, précisée par votre commercial ». Voir `CLAUDE.md` §2 et `decisions.md` (D48).

> **✳️ Additif du 2026-09-25 — D61 (arbitrage du fondateur) : trois métriques prioritaires par réseau.** Pour chaque réseau déclaré, INFLUX suit **en priorité** trois chiffres : **(1) la taille de la communauté** (nombre d'abonnés), **(2) le rythme de publication**, **(3) le nombre moyen de commentaires par publication**. Les trois sont **obligatoires** sur chaque ligne de réseau, **affichés en tête de ligne**, **constatés** lors de la vérification et **historisés**. Le taux d'engagement et la portée moyenne deviennent des indicateurs **secondaires**, facultatifs. Règles : **§E bis (RG113 à RG119)** ; cas limites et critères d'acceptation dédiés ; questions ouvertes **Q15 à Q18**. Voir `decisions.md` (D61).

> **Date :** 2026-09-19 · **Auteur :** agent `product-owner` · **Statut :** spécification complète du
> profil créateur (Lot 2), soumise à la validation de `chef-de-projet`, avec **avis obligatoire
> (veto) de `expert-conformite-rgpd`** sur §B (couches), §D (résidence), §F (audience), §H
> (portfolio) et §Questions ouvertes, et **avis obligatoire de `expert-paiement-facturation`** sur
> §G (assiette du tarif indicatif et net créateur estimé).
>
> **Skills appliquées :** `feature-spec` (format de sortie), `matching-spec` (règle d'or des
> tranches A2, champs interdits A3, contenu de carte A6, garde-fous A9, facettes A11, conformité
> A12), `profile-verification` (badges « Compte vérifié » et « Audience vérifiée »),
> `backoffice-ops` (file, verrou, motifs typés), `design-system-influx` (états d'écran, affichage
> des montants).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité, §2 modèle économique),
> `docs/mvp/00-cadrage-mvp-v2.md` (périmètre, arbitrages A1 à A12, Lot 2),
> `docs/mvp/03-matrice-des-droits-et-rls.md` §3.2 (conditions C(7) à C(16), règle des trois objets),
> `docs/mvp/04-modele-de-donnees-mvp.md` §5.2 (`profiles.creator_public_*`,
> `profiles.creator_social_accounts`, `profiles.creator_identities`),
> `docs/mvp/05-spec-inscription-et-leads.md` (ce qui est **déjà collecté** au Lot 1, RG17 à RG21),
> `docs/mvp/06-criteres-profil-marque.md` (document jumeau, côté marque).
>
> **Ce que ce document tranche :** les blocs et les champs exacts du profil créateur, **la couche de
> visibilité de chaque champ** (anonyme, identifiée, interne), son format, la preuve exigée le cas
> échéant, la ligne « un réseau = une ligne », la répartition d'audience, l'offre et le **net
> créateur estimé**, la modération du portfolio, le calcul de la complétude et son message, les cinq
> états du profil, la validation par un agent, et ce qu'une marque voit d'un créateur avant et après
> l'ouverture d'une mise en relation.
>
> **Ce qu'il ne tranche pas :** la maquette et la microcopie (`expert-ux`) ; le schéma SQL, les
> index et les politiques d'accès (`expert-database`, `expert-cybersecurite`) ; l'écran de recherche,
> le tri et le k-anonymat (`expert-matching`, déjà écrits dans `matching-spec` Partie A) ; la file de
> validation des mises en relation et la révélation d'identité (Lot 3 et Lot 4) ; les règles de
> scoring (**D11**, reportée).
>
> **Invariant rappelé :** aucun contrat, aucune facture, aucun encaissement n'existe dans ce
> périmètre (arbitrage **A1**). Le **net créateur estimé** de §G n'est **pas** un calcul de
> commission sur un contrat : c'est l'affichage pédagogique, en tranches, de ce qu'un tarif
> indicatif laisserait au créateur **si** il était un jour contractualisé via INFLUX.
>
> **Prolongement du Lot 1 :** ce document ne redemande **jamais** une information déjà collectée à
> l'inscription (`05-spec-inscription-et-leads.md` RG17). Toute redemande serait un défaut.

---

## Besoin

**Permettre à un créateur de décrire en moins de quinze minutes ce qu'il fait, pour qui, à quel prix
et avec quel résultat — sans que rien de ce qu'il écrit ou dépose ne permette à une marque de le
retrouver hors d'INFLUX avant que la mise en relation ne soit ouverte.**

Quatre raisons d'être, dans cet ordre :

1. **Commerciale.** Le profil créateur **est** le catalogue d'INFLUX. Un annonceur qui ne trouve
   rien de crédible à consulter ne revient pas, et le commercial n'a rien à vendre.
2. **Produit.** La recherche anonymisée (Lot 3), la demande de mise en relation et la proposition
   INFLUX n'affichent pas autre chose que **ce profil**. Un profil vide rend les lots suivants creux.
3. **Protection du modèle économique.** C'est ici que se joue **A2 / D16** : un pseudo, un `@`, un
   lien ou un filigrane sur une image, et la marque n'a plus besoin d'INFLUX. Le risque n'est pas
   théorique : il est **visuel et textuel**, il passe par la bio et par le portfolio.
4. **Confiance du créateur.** Un créateur qui ne comprend pas ce qui est visible de qui ne remplit
   pas son profil. La colonne « couche » du tableau central de §B n'est pas une commodité de
   développeur : c'est une information due à la personne, affichée à côté de chaque champ.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Créateur** (titulaire du compte) | Complète son profil, déclare ses réseaux, son audience, son offre, dépose son portfolio, demande ses badges, soumet, corrige, consulte sa complétude et son net estimé |
| **Annonceur** | **Lit** un profil créateur dans deux régimes : anonymisé (recherche, sélection, proposition) et identifié (après ouverture de la mise en relation). Il n'écrit jamais rien sur un profil créateur |
| **Commercial INFLUX** (rôle `agent`) | Valide ou refuse un profil avec un motif typé, **modère le portfolio visuel par visuel**, corrige un champ, constate les chiffres et attribue les badges, relance un profil en brouillon |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, plus : suspension d'un profil, retrait d'un badge, correction d'un champ interne, traitement d'une demande RGPD |
| **Système** | Génère l'alias, calcule les tranches à partir des valeurs exactes, calcule la complétude, détecte les coordonnées dans les textes, périme les badges et les chiffres, émet les événements de leads |
| **Brevo / Apollo.io** (externes) | Reçoivent des attributs d'enrichissement **non identifiants**, dans les limites du consentement du Lot 1 et du périmètre D33 |

> **Deux populations, deux parcours.** Ce document ne décrit **que** le créateur. Le profil marque
> fait l'objet du document `06`. Aucun écran n'est partagé : ni le formulaire, ni les libellés, ni la
> file de validation, ni les motifs de refus, ni les badges. **D41 (un rôle par compte)** s'applique :
> un compte créateur ne porte jamais de profil marque, et réciproquement.

---

## User stories

### Créateur

- **US1** — En tant que **créateur**, je veux compléter mon profil en partant de ce que j'ai déjà
  donné à l'inscription, afin de ne jamais retaper la même information.
- **US2** — En tant que **créateur**, je veux savoir, **champ par champ**, ce qu'une marque voit
  avant et après la mise en relation, afin de ne pas découvrir après coup qu'une information que je
  croyais privée est affichée.
- **US3** — En tant que **créateur**, je veux déclarer mes réseaux un par un avec leurs chiffres et
  la date à laquelle je les ai mis à jour, afin que personne ne me juge sur des chiffres d'il y a un
  an.
- **US4** — En tant que **créateur**, je veux décrire la composition de mon audience (pays, âge,
  genre), afin qu'une marque ne me sollicite pas pour un marché où je ne suis pas lu.
- **US5** — En tant que **créateur**, je veux annoncer mes tarifs indicatifs par format **et voir
  immédiatement ce qu'il me resterait**, afin de ne jamais découvrir la commission après coup.
- **US6** — En tant que **créateur**, je veux montrer trois à huit exemples de mon travail, afin
  qu'une marque juge sur pièce et pas sur une promesse.
- **US7** — En tant que **créateur**, je veux obtenir les badges « Compte vérifié » et « Audience
  vérifiée », afin qu'une marque sache que mes chiffres ont été constatés et quand.
- **US8** — En tant que **créateur**, je veux savoir ce qu'il me manque pour être publié et ce que
  chaque information change concrètement, afin de ne pas remplir trente champs à l'aveugle.
- **US9** — En tant que **créateur**, je veux corriger une faute sur un profil déjà publié sans
  disparaître de la recherche pendant l'examen, afin de ne pas perdre d'opportunités.
- **US10** — En tant que **créateur** dont le profil est refusé, je veux comprendre pourquoi et ce
  que je dois changer, afin de pouvoir le resoumettre seul.
- **US11** — En tant que **créateur**, je veux déclarer les secteurs avec lesquels je ne travaille
  pas, afin de ne pas recevoir de sollicitations que je refuserai — **sans que ce refus soit montré
  à quiconque**.
- **US12** — En tant que **créateur**, je veux pouvoir me retirer de la recherche sans supprimer mon
  compte, afin d'exercer mon droit d'opposition sans tout perdre.

### Annonceur

- **US13** — En tant qu'**annonceur**, je veux comprendre en un coup d'œil ce qu'un profil anonymisé
  couvre (thématique, réseaux, audience, pays, formats, fourchette de prix, disponibilité), afin de
  décider si je demande une mise en relation.
- **US14** — En tant qu'**annonceur**, je veux savoir **quand les chiffres ont été mis à jour** et
  **ce qui a été vérifié par INFLUX**, afin de savoir ce que je peux croire.
- **US15** — En tant qu'**annonceur**, je veux obtenir le pseudo, les liens et les chiffres exacts
  **une fois la mise en relation ouverte**, afin de préparer ma négociation.

### Commercial et administrateur

- **US16** — En tant que **commercial**, je veux valider ou refuser un profil créateur avec un motif
  choisi dans une liste, afin qu'aucun refus ne soit muet et que les motifs soient comptables.
- **US17** — En tant que **commercial**, je veux modérer **chaque visuel de portfolio séparément**,
  avec une grille de contrôle, afin qu'aucune image ne trahisse le pseudo du créateur.
- **US18** — En tant que **commercial**, je veux **saisir moi-même** les chiffres constatés sur
  pièce et conserver l'écart avec le déclaré, afin que le badge vérifie au lieu de recopier.
- **US19** — En tant que **commercial**, je veux voir les profils encore en brouillon pour relancer
  leurs auteurs, afin d'alimenter le catalogue.
- **US20** — En tant qu'**administrateur**, je veux suspendre un profil et retirer un badge avec un
  motif, afin de réagir à un signalement sans supprimer le compte.

### Système

- **US21** — En tant que **système**, je veux qu'aucun champ identifiant d'un créateur ne sorte
  jamais dans une réponse servie à une marque avant la révélation, afin que l'anonymisation ne
  dépende pas de la discipline d'un développeur.

---

## Règles de gestion

### A — Portée, états et publication

**RG1** — Un compte créateur porte **un seul profil créateur**, créé automatiquement à l'état
**brouillon** à la première connexion suivant l'inscription. Il ne peut être ni dupliqué, ni
supprimé indépendamment du compte.

**RG2** — Le profil **reprend sans les redemander** les informations du Lot 1 : adresse e-mail de
connexion, pays de résidence, langue de communication, statut déclaré (particulier / professionnel),
attestation de majorité et sa date. Aucun de ces champs n'est ressaisi ; le pays et la langue sont
modifiables depuis le profil, et toute modification met à jour le compte et émet un `lead.updated`.

**RG3** — Le profil créateur connaît **cinq états**, et cinq seulement :

| État | Signification | Qui le déclenche | Visible d'une marque |
|---|---|---|---|
| `brouillon` | En cours de saisie | Le créateur (état initial) | Non |
| `en attente de validation` | Soumis, non encore examiné | Le créateur | Non (ou dernière version validée, RG9) |
| `publié` | Validé par un agent | Un agent ou un admin | Oui, en couche anonyme |
| `refusé` | Examiné et écarté, avec motif typé | Un agent ou un admin | Non |
| `suspendu` | Retiré par décision interne | Un admin uniquement | Non |

**RG4** — Le passage de `brouillon` à `en attente de validation` est déclenché par le créateur
(« Publier mon profil ») et n'est possible que si **tous les champs marqués obligatoires** dans le
tableau central de RG16 sont renseignés, **portfolio compris** (au moins 3 éléments déposés). Le
bouton reste visible en permanence, avec la liste nominative de ce qui manque — jamais désactivé
sans explication.

**RG5** — **Aucun profil créateur ne devient visible d'une marque sans décision humaine.** La
publication est prononcée par un rôle `agent` ou `admin`, jamais par un automatisme, jamais par
expiration d'un délai. Un profil dont le portfolio n'a **aucun** visuel approuvé peut être publié,
mais sa carte s'affiche sans image (RG84).

**RG6** — L'objectif de délai de validation d'un profil créateur est de **1 jour ouvré**, mesuré en
délai médian **et** en délai du 9e cas sur 10. Au-delà de **3 jours ouvrés**, l'entrée remonte en
alerte sur le tableau de bord du backoffice. Ces deux valeurs sont **des paramètres en table**, pas
des constantes (**Q11**).

**RG7** — Tant que son profil n'est pas publié, un créateur **peut** : compléter son profil, déposer
ses pièces, demander ses badges, consulter les campagnes publiées. Il **ne peut pas** : candidater à
une campagne, ni apparaître dans une recherche, ni recevoir une proposition INFLUX.

**RG8** — Un profil `publié` porte un interrupteur **« visible dans la recherche »**, activé par
défaut, que le créateur peut désactiver lui-même à tout moment (droit d'opposition, `matching-spec`
A12). Un profil retiré de la recherche reste consultable par les rôles internes, conserve ses mises
en relation ouvertes, et le message affiché au créateur énonce sans détour la conséquence :
**« vous ne recevrez plus de demande de marque »**.

**RG9** — Sur un profil **déjà publié**, les champs se répartissent en deux régimes :

| Régime | Champs concernés | Effet d'une modification |
|---|---|---|
| **Re-validation** | Titre court, bio, légendes de portfolio, ajout ou remplacement d'un visuel, ajout d'un réseau, handle, URL | Repasse en `en attente de validation` pour **les seuls éléments modifiés**. **La dernière version validée reste affichée** pendant l'examen |
| **Effet immédiat** | Thématiques, ton, langues, chiffres d'audience et de réseaux, tarifs, formats, droits d'usage, exclusivité, disponibilité, secteurs refusés, interrupteur de visibilité | Prise en compte immédiate, sans examen |

Un profil ne devient jamais invisible parce que son auteur a corrigé une faute de frappe ou mis ses
chiffres à jour.

**RG10** — Un profil `refusé` porte **un motif typé** choisi dans la liste fermée de RG96, reste
intégralement modifiable et peut être resoumis sans délai. **Aucun refus muet, aucun dossier laissé
en attente sans décision.**

**RG11** — Un profil `suspendu` n'apparaît dans aucune recherche ; ses candidatures en cours sont
retirées (contrainte pour le Lot 3) ; ses mises en relation déjà ouvertes restent accessibles aux
participants et au commercial (contrainte pour le Lot 4). La suspension n'efface **aucune** donnée.

**RG12** — Aucun écran, aucun e-mail et aucune donnée de ce périmètre ne contient de **montant de
contrat**, de **facture**, de **taux de commission modifiable** ni d'encaissement (**A1**). Les
seuls montants présents sont la **tranche de tarif indicatif** et la **tranche de net créateur
estimé** de §G, toutes deux explicitement nommées, avec leur devise et leur mention
« ne vaut pas engagement ».

**RG13** — Toute valeur destinée à filtrer, comparer ou rapprocher est une **liste fermée** ou une
**tranche**, jamais un texte libre et jamais un nombre exact **en couche anonyme** (règle d'or,
`matching-spec` A2). Les seuls textes libres du profil sont le **titre court**, la **bio** et les
**légendes de portfolio** — tous trois **modérés avant publication**.

**RG14** — Toute saisie est validée **côté serveur** avec exactement les mêmes règles que côté
navigateur. La validation dans le navigateur est un confort ; elle n'est jamais la seule.

**RG15** — **Aucun algorithme de scoring n'est calculé, affiché ni stocké** (**D11**). Chaque champ
de ce document existe parce qu'il sert **au moins une** des trois justifications : un usage futur de
mise en relation (facette de `matching-spec` A11), la conversion d'une marque, une obligation légale
ou de vérification. **Un champ qui ne relève d'aucune des trois est de la friction et n'est pas
créé.**

### B — Les trois couches, et le tableau central des champs

**RG16** — Chaque champ du profil créateur appartient à **une couche et une seule**, déclarée dans
le tableau ci-dessous. Les trois couches sont :

| Code | Couche | Qui lit | Objet en base (`04` §5.2) |
|---|---|---|---|
| **A** | **Anonyme** | **Toute marque authentifiée**, sous les garde-fous de recherche (k-anonymat 5, pagination, débit, journal) | `profiles.creator_public_*` |
| **I** | **Identifiée** | Une marque **uniquement après `identity_revealed_at`**, et pour cette mise en relation seulement | `profiles.creator_social_accounts` |
| **N** | **Interne** | Le créateur lui-même et les rôles `agent` / `admin`. **Aucune marque, jamais, y compris après révélation** | `profiles.creator_identities` et satellites |

**LE TABLEAU CENTRAL.** Lecture des colonnes : *Couche* = qui voit (A, I, N) ; *Format* = tranche ·
liste fermée · texte modéré · nombre · date · booléen ; *Preuve exigée* = ce qu'INFLUX demande avant
d'apposer un badge ou de publier ; *Oblig.* = obligatoire pour pouvoir publier le profil.

#### Bloc 1 — Présentation

| Champ | Couche | Format | Preuve exigée | Oblig. |
|---|---|---|---|---|
| Alias public (`Profil 7K3M`) | **A** | Généré par la plateforme, 4 à 8 caractères, non séquentiel, non dérivé du pseudo, sans marque de genre | — | Automatique |
| Titre court | **A** | Texte **modéré**, 20 à 120 caractères | Modération de forme | **Oui** |
| Bio | **A** | Texte **modéré**, 150 à 800 caractères | Modération de forme | **Oui** |
| Photo ou avatar du créateur | **—** | **Champ inexistant** (`matching-spec` A3) | — | — |
| Pseudonyme / nom d'usage | **I** | Texte, ≤ 60 caractères | — | Non |
| Nom et prénom légaux | **N** | Texte | Demandés au premier badge | Non |
| Date de naissance | **N** | Date | Contrôle de majorité (D15) | Non (**Q3**) |
| Téléphone, e-mail de contact, adresse postale | **N** | Texte | — | Non |

#### Bloc 2 — Ligne éditoriale et situation

| Champ | Couche | Format | Preuve exigée | Oblig. |
|---|---|---|---|---|
| Thématique principale | **A** | Liste fermée `reference.topics`, 1 choix | — | **Oui** |
| Thématiques secondaires | **A** | Liste fermée, ≤ 3 choix | — | Non |
| Ton éditorial | **A** | Liste fermée, ≤ 2 choix (RG34) | — | Non |
| Langues de publication | **A** | Liste fermée `reference.languages`, ≥ 1 | — | **Oui** |
| Pays de résidence | **A** | Liste fermée `reference.countries` (repris du Lot 1) | — | **Oui** |
| Région de résidence | **A** conditionnelle (RG37) | Liste fermée, niveau administratif 1 | — | Non |
| Ville de résidence | **I** | Liste fermée ou texte contrôlé | — | Non |
| Adresse postale complète | **N** | Texte | — | Non |
| Déplacements possibles | **A** | Liste fermée : non · dans mon pays · international | — | Non |
| Statut déclaré (particulier / professionnel) | **N** | Liste fermée (repris du Lot 1) | — | Déjà collecté |

#### Bloc 3 — Réseaux sociaux (**une ligne par réseau**, RG41)

| Champ | Couche | Format | Preuve exigée | Oblig. |
|---|---|---|---|---|
| Réseau | **A** | Liste fermée `reference.networks` | — | **Oui** (≥ 1 ligne) |
| Compte principal | **A** | Booléen, **exactement une ligne à vrai** | — | **Oui** |
| Handle / identifiant `@` | **I** | Texte **modéré**, ≤ 100 caractères | — | **Oui** |
| URL du profil | **I** | URL `https://`, domaine du réseau déclaré | — | **Oui** |
| **Abonnés** — *métrique prioritaire n° 1 : taille de la communauté* (RG113) | **A** tranche · **I** valeur exacte | Tranche `reference.audience_bands` (nano, micro, mid, macro, méga) / entier ≥ 0 | Capture du tableau de bord natif < 30 j pour le badge « Audience vérifiée » | **Oui** |
| **Publications des 30 derniers jours** — *métrique prioritaire n° 2 : rythme de publication* (RG114) | **A** rythme · **I** valeur exacte | Entier ≥ 0 ; le système en dérive le **rythme**, liste fermée `reference.publication_frequencies` : quotidien · plusieurs fois par semaine · hebdomadaire · deux fois par mois · mensuel ou moins | Constat de l'agent sur le profil public pour le badge « Audience vérifiée » (`08` RG38bis) | **Oui** |
| **Commentaires moyens par publication** — *métrique prioritaire n° 3* (RG115) | **A** tranche · **I** valeur exacte | Tranche `reference.comment_bands` / entier ≥ 0 | Idem | **Oui** |
| Taux d'engagement — *indicateur secondaire* (D61) | **A** tranche **seulement si vérifié** · **I** valeur exacte | Tranche / pourcentage à 2 décimales | Capture du tableau de bord natif — **sans preuve, rien n'est affiché en couche A** (RG48) | Non |
| Portée moyenne par publication — *indicateur secondaire* (D61) | **A** tranche · **I** valeur exacte | Tranche / entier ≥ 0 | Capture du tableau de bord natif | Non |
| Source des chiffres | **A** | Liste fermée : déclaré par le créateur · constaté par INFLUX | — | Automatique |
| **Date de dernière mise à jour des chiffres** | **A** | Date, **affichée partout où un chiffre l'est** | — | **Oui** (RG50) |
| Badge « Compte vérifié » + date | **A** | Booléen + date | Code INFLUX constaté en ligne par l'agent | Non |
| Badge « Audience vérifiée » + date | **A** | Booléen + date, **périme à 90 jours** (D34) | Capture native < 30 j, chiffres saisis par l'agent | Non |
| Captures de statistiques déposées | **N** | Fichier, compartiment privé | — | Non |

#### Bloc 4 — Audience (toujours **de l'audience**, jamais du créateur — `matching-spec` A12)

| Champ | Couche | Format | Preuve exigée | Oblig. |
|---|---|---|---|---|
| Pays principal d'audience | **A** | Liste fermée `reference.countries` | Capture native pour le badge | **Oui** |
| Part du pays principal | **A** tranche · **I** pourcentage exact | Tranche : ≥ 80 % · 50-80 % · < 50 % | Idem | **Oui** |
| Autres pays ≥ 10 % | **A** liste · **I** pourcentages exacts | ≤ 4 pays, part en tranche (10-25 % · 25-50 % · > 50 %) | Idem | Non |
| Répartition par tranche d'âge | **A** tranche · **I** pourcentages exacts | Pourcentages entiers sur 18-24 · 25-34 · 35-44 · 45+, somme ≤ 100 | Idem | Non |
| Répartition de genre | **A** tranche · **I** pourcentages exacts | Tranche : majorité féminine ≥ 60 % · mixte · majorité masculine ≥ 60 % | Idem | Non |
| Répartition exacte, chiffre par chiffre | **N** | Nombres | — | — |

#### Bloc 5 — Offre

| Champ | Couche | Format | Preuve exigée | Oblig. |
|---|---|---|---|---|
| Formats proposés | **A** | Liste fermée `reference.formats`, ≥ 1 | — | **Oui** |
| Tarif indicatif par format et par réseau | **A** tranche · **N** valeur exacte | Tranche `reference.price_bands` + devise `reference.currencies` | — | **Oui** (≥ 1 ligne) |
| **Net créateur estimé** | **Créateur et INFLUX uniquement** (RG70) | Tranche dérivée du référentiel, avec devise | — | Automatique |
| Délai de livraison habituel | **A** | Liste fermée : < 7 jours · 7-14 jours · 15-30 jours · > 30 jours | — | Non |
| Droits d'usage **inclus** | **A** | Liste fermée `reference.usage_rights`, multi-choix | — | Non |
| Droits d'usage **en option** | **A** | Liste fermée, multi-choix | — | Non |
| Exclusivité sectorielle acceptée | **A** | Tranche : non · ≤ 1 mois · ≤ 3 mois · négociable | — | Non |
| Contrepartie non monétaire acceptée | **A** | Booléen | — | Non |
| Disponibilité déclarée | **A** | Tranche : < 2 semaines · < 1 mois · complet | — | **Oui** |
| Date de déclaration de disponibilité | **A** | Date, affichée avec la disponibilité | — | Automatique |
| **Secteurs refusés** | **N** | Liste fermée `reference.sectors`, multi-choix | — | Non |

#### Bloc 6 — Portfolio

| Champ | Couche | Format | Preuve exigée | Oblig. |
|---|---|---|---|---|
| Élément de portfolio (image) | **A** après modération | Fichier PNG/JPG/WebP, ≤ 5 Mo, ≥ 600 px, **3 à 8 éléments** | **Modération manuelle, un élément = une décision** (RG78) | **Oui** (≥ 3 déposés) |
| Légende | **A** après modération | Texte **modéré**, ≤ 200 caractères | Modération de forme | Non |
| Marque citée dans une légende | **A** après modération | Liste fermée ou texte modéré + **case d'autorisation** | Déclaration d'autorisation du créateur (RG83) | Non |
| Ordre d'affichage | **A** | Entier | — | Automatique |
| Fichier d'origine et métadonnées | **N** | Fichier, EXIF **supprimés au dépôt** | — | — |

#### Bloc 7 — Indicateurs de profil

| Champ | Couche | Format | Preuve exigée | Oblig. |
|---|---|---|---|---|
| Complétude (0 à 100) | **Créateur et INFLUX uniquement** (RG86) | Entier | — | Automatique |
| État du profil | **N** (l'état exact) ; la marque ne voit qu'un profil publié ou rien | Liste fermée | — | Automatique |
| Visible dans la recherche | **Créateur et INFLUX** | Booléen | — | Automatique |
| Notes internes de l'agent | **N** | Texte libre | — | Non |

**RG17** — **Une donnée présente en couche A est une donnée définitivement publique auprès de toutes
les marques inscrites.** Aucun champ de la couche A n'est jamais soumis à une autorisation au cas par
cas : le seul réglage dont dispose le créateur est l'interrupteur global de RG8.

**RG18** — **Les champs de la liste `matching-spec` A3 ne figurent jamais dans une réponse servie au
rôle annonceur avant révélation**, pas même vides, pas même dans une charge utile que l'écran
n'affiche pas. **Le contrôle porte sur la réponse, pas sur l'écran.**

**RG19** — La révélation est **unique, simultanée dans les deux sens et irréversible** : le même
horodatage (`identity_revealed_at`) révèle la couche I du créateur à la marque et les coordonnées de
l'interlocuteur de la marque au créateur (document `06` RG38). Il n'existe pas deux révélations, ni
deux dates, ni deux périmètres.

**RG20** — **La couche N n'est jamais révélée, dans aucun cas** — y compris après révélation, y
compris à la demande de la marque, y compris si le créateur y consent depuis un écran. Un créateur
qui souhaite communiquer une donnée de la couche N le fait **dans la conversation**, où le
commercial est présent et où l'échange est tracé (A3, conversation à trois).

**RG21** — Chaque champ du formulaire affiche **son étiquette de couche** (« visible de toutes les
marques » · « visible après l'ouverture d'une mise en relation » · « visible uniquement par
l'équipe INFLUX »). C'est une obligation d'information, pas une option d'ergonomie
(`matching-spec` A12).

**RG22** — **Les tranches sont calculées et stockées par le système à partir de la valeur exacte,
jamais arrondies à l'affichage.** La valeur exacte ne doit pas se trouver dans l'objet servi à
l'annonceur avant révélation. Les **bornes de tranches sont identiques partout** : profil créateur,
profil marque, campagne, facette de recherche, explication affichée.

### C — Bloc 1 : alias, titre court, bio

**RG23** — L'**alias public** est généré par la plateforme à la création du profil. Il est **stable à
vie et global** — le même pour toutes les marques et pour le commercial. Il est **jamais dérivé du
pseudo** (ni troncature, ni initiales, ni translittération), **jamais séquentiel**, et **sans marque
de genre** (`matching-spec` A6). Ni le créateur ni un agent ne peuvent le choisir ou le modifier.

**RG24** — L'alias est accompagné partout d'une **étiquette de contexte** construite à partir de
données de la couche A : thématique principale et pays principal d'audience (par exemple
« Profil 7K3M — Beauté · France »).

**RG25** — Le **titre court** décrit l'activité en une ligne (20 à 120 caractères). Il est **modéré
avant publication**. Il ne contient ni pseudo, ni `@`, ni nom de compte, ni lien, ni nom de marque
partenaire.

**RG26** — La **bio** (150 à 800 caractères) est **modérée avant publication**. Elle est le second
endroit, après le portfolio, où l'anonymat se perd : c'est pour cette raison qu'elle est modérée, et
non pour juger le style du créateur.

**RG27** — Le titre court et la bio ne peuvent contenir **aucun élément identifiant** : pseudo, `@`,
nom de compte, URL, nom et prénom, adresse e-mail, numéro de téléphone, identifiant de messagerie,
nom de son agence, nom d'une marque avec laquelle il a travaillé. Une détection automatique
**signale** au modérateur ; **c'est le modérateur qui décide**, et le refus porte un motif typé
(RG96). Le texte reste en brouillon : il n'est ni publié, ni modifié à l'insu du créateur.

**RG28** — La détection automatique **ne conserve jamais une copie du texte détecté** : elle
enregistre le type de motif et sa position (cohérence avec `03` C(26)). Recopier un `@` détecté dans
une table d'alerte reviendrait à créer un annuaire des pseudos qu'on prétend protéger.

**RG29** — **Aucune photo de profil, aucun avatar, aucune photo du créateur** n'est collectée ni
affichée en couche A. Une recherche d'image inversée sur un visage retrouve un compte en une minute :
c'est une fuite d'anonymisation d'un seul clic (`matching-spec` A3 et A9).

**RG30** — Le **pseudonyme** est saisi dans le bloc réseaux (un pseudo par réseau, RG42) et non dans
la présentation. Il n'existe **pas** de champ « pseudo général » : un champ unique donnerait
l'illusion d'une donnée neutre alors que c'est la donnée identifiante par excellence.

**RG31** — Le profil créateur ne porte **ni note, ni avis, ni étoile, ni compteur de collaborations
réalisées sur INFLUX, ni nombre de contrats signés**. Au lancement ces compteurs valent zéro pour
tout le monde ; ensuite ils stigmatisent les nouveaux entrants et aident à ré-identifier
(`matching-spec` A11, facettes écartées).

**RG32** — Le champ **« expérience de collaborations »** existe en couche A sous forme de **tranche
déclarative** (0 · 1-5 · 6-20 · plus de 20), sans nommer aucune marque. La **liste des marques déjà
travaillées n'est jamais collectée en couche A ni en couche I** : elle identifie le créateur en une
recherche web.

### D — Bloc 2 : thématiques, ton, langues, résidence

**RG33** — La **thématique principale** est obligatoire et unique ; les **thématiques secondaires**
sont facultatives et plafonnées à 3. Les deux utilisent le référentiel `reference.topics`, **le même
que celui des campagnes et des attentes de marque** (document `06` RG27). Deux vocabulaires rendraient
tout rapprochement impossible.

**RG34** — Le **ton éditorial** est une liste fermée de 2 choix maximum, parmi : pédagogique ·
humoristique · inspirant · premium et élégant · direct et sans détour · familial · expert et
technique. Il existe parce qu'une marque écarte un créateur pertinent sur le seul critère du ton, et
qu'il est aujourd'hui deviné à partir de la bio — donc mal.

**RG35** — Les **langues de publication** sont obligatoires (au moins une) et proviennent du même
référentiel que les langues de travail d'une marque (facette F8). Elles sont distinctes de la
**langue de communication** du compte, collectée au Lot 1 : un créateur peut échanger en français et
publier en anglais.

**RG36** — Le **pays de résidence** est repris du Lot 1, affiché en couche A, et constitue la facette
F20. La **ville** est en couche **I**. L'**adresse postale** est en couche **N** et n'est jamais
révélée.

**RG37** — La **région de résidence** (niveau administratif 1) est affichée en couche A **seulement
si au moins 5 profils publiés partagent le même couple (pays, région)**. En dessous de ce seuil, le
pays seul est affiché, **sans message ni compteur**. Le seuil est le même que celui du k-anonymat de
la recherche (`matching-spec` A5) et vit en paramètre (**Q11**).

**RG38** — **Ni la ville, ni la région ne sont des facettes de recherche au MVP**
(`matching-spec` A11, facettes écartées). Elles sont affichées, jamais filtrables : un filtre par
région combiné à une thématique isole une personne en deux clics.

**RG39** — Le champ **« déplacements possibles »** (non · dans mon pays · international) existe pour
les tournages, les événements et l'UGC en magasin. Il ne comporte **aucune mention de distance, de
rayon kilométrique ni de point de départ**.

**RG40** — **Aucune caractéristique personnelle du créateur n'est collectée ni affichée** : âge,
genre, origine, situation familiale, état de santé, convictions (`matching-spec` A12). La date de
naissance existe en couche N pour le seul contrôle de majorité (D15), et son maintien est soumis à
**Q3**.

### E — Bloc 3 : réseaux sociaux, une ligne par réseau

**RG41** — Les réseaux sont déclarés **une ligne par réseau**, jamais dans un champ global. Chaque
ligne porte ses propres chiffres, sa propre date de mise à jour et ses propres badges. Un profil
publié comporte **au moins une ligne**, et **exactement une ligne marquée « compte principal »**.

**RG42** — Une ligne est identifiée par le triplet **(créateur, réseau, handle)** : un même créateur
peut déclarer deux comptes sur le même réseau (compte principal et compte secondaire), jamais deux
fois le même handle sur le même réseau.

**RG43** — Le **handle** et l'**URL** sont en couche **I**. L'URL doit pointer vers le domaine du
réseau déclaré ; une URL incohérente avec le réseau est refusée à la saisie avec un message dédié.

**RG44** — **Le handle et l'URL sont modérés avant publication**, au même titre qu'un texte : c'est
un contrôle de cohérence (le handle correspond-il au réseau ?) et un contrôle anti-détournement (un
handle ne doit pas contenir de numéro de téléphone ni d'adresse e-mail déguisés).

**RG45** — Les **abonnés**, le **taux d'engagement** et la **portée moyenne** sont saisis en valeurs
exactes par le créateur. Le système en dérive et stocke les tranches (RG22). En couche A, **seules
les tranches sortent** ; en couche I, les valeurs exactes sortent, **toujours accompagnées de leur
source et de leur date** (RG49).

**RG46** — Les valeurs saisies sont contraintes : abonnés et portée moyenne sont des **entiers ≥ 0**
(zéro accepté, valeur négative refusée) ; le taux d'engagement est un **pourcentage entre 0 et 100**,
avec au plus deux décimales. Une valeur au-delà d'un plafond de vraisemblance (à fixer par réseau,
**Q11**) est acceptée mais **signalée à la modération**, jamais refusée automatiquement : un créateur
n'a pas à prouver qu'il est petit.

**RG47** — La **portée moyenne** est déclarée **par publication**, pas par mois, et ce libellé est
identique partout. Deux définitions de la portée dans deux écrans produisent deux vérités.

**RG48** — **Le taux d'engagement n'est affiché en couche A que s'il a été constaté par un agent**
(badge « Audience vérifiée » actif sur ce réseau). Non vérifié, il est **absent de la couche A**, pas
affiché « non vérifié » : une valeur d'engagement déclarée est l'indicateur le plus facilement
manipulé du marché, et l'afficher avec une réserve revient à l'afficher.

**RG49** — Toute valeur chiffrée affichée porte **sa source** (« déclaré par le créateur » ou
« constaté par INFLUX le … ») et **sa date**. Un chiffre sans source et sans date n'est jamais
affiché, en aucune couche.

**RG50** — La **date de dernière mise à jour des chiffres** est obligatoire, par ligne de réseau. Elle
est **posée automatiquement à chaque modification d'un chiffre** et ne peut pas être saisie à la
main. Au-delà de **90 jours**, la ligne porte la mention **« chiffres à rafraîchir »**, le créateur
est relancé à J-15 et la ligne est **rétrogradée dans le tri** (`matching-spec` A7, palier 4) — elle
n'est **jamais** masquée ni supprimée.

**RG51** — Le badge **« Compte vérifié »** atteste que la propriété du compte a été prouvée : INFLUX
génère un code à usage unique, le créateur le colle dans un champ public de son profil de réseau,
**l'agent constate lui-même le code en ligne** et enregistre son constat (horodatage + identité de
l'agent). Une capture fournie par le créateur ne vaut jamais preuve.

**RG52** — Le badge **« Audience vérifiée »** suppose « Compte vérifié » sur le même réseau. Il exige
une **capture du tableau de bord natif du réseau, datée de moins de 30 jours**, montrant
simultanément le compte, la période et les valeurs. **L'agent saisit lui-même les valeurs
constatées** ; la valeur déclarée reste visible à part, étiquetée « déclaré », et **l'écart est
conservé** comme signal interne.

**RG53** — Les deux badges sont **par réseau, jamais globaux**, portent **leur date partout où ils
apparaissent**, et n'affirment **jamais** : que les abonnés sont authentiques, que l'audience restera
stable, ni qu'une campagne obtiendra une performance. « Audience vérifiée » **se périme à 90 jours**
(D34) : rappel à J-15, état « à rafraîchir » à l'échéance, retrait à la fin du délai de grâce.

**RG54** — Les **captures de statistiques** vivent en **stockage privé** (couche N). **Aucune marque
n'y accède, dans aucun cas** (`03` C(13)). Elles contiennent des données personnelles de tiers
(noms d'abonnés, commentaires, messages) : le créateur reçoit des instructions de cadrage au dépôt,
et une pièce trop large est refusée avec un motif dédié.

### E bis — Les trois métriques prioritaires (D61, additif du 2026-09-25)

> **Arbitrage du fondateur du 2026-09-25.** Pour les créateurs, les chiffres à suivre en priorité
> sont : la **taille de la communauté**, le **rythme des publications** et le **nombre moyen de
> commentaires par publication**. Ce bloc en tire les conséquences sur le profil. Les définitions
> exactes et les bornes de tranches ci-dessous sont des **valeurs de départ**, soumises à **Q16**.

**RG113** — **Les trois métriques prioritaires.** Pour chaque ligne de réseau, INFLUX suit en
priorité, et toujours dans cet ordre :

| # | Métrique | Ce que le créateur saisit | Ce qu'une marque voit avant l'ouverture |
|---|---|---|---|
| 1 | **Taille de la communauté** | Nombre d'abonnés (RG45) | Tranche d'audience |
| 2 | **Rythme de publication** | Nombre de publications des 30 derniers jours (RG114) | Rythme (liste fermée) |
| 3 | **Commentaires moyens par publication** | Moyenne sur les 12 dernières publications (RG115) | Tranche de commentaires |

Ces trois chiffres sont **obligatoires sur chaque ligne de réseau** pour publier le profil (RG4,
**Q15**). Ils sont **affichés en tête de chaque ligne de réseau, dans cet ordre**, partout où la
ligne apparaît : carte anonyme, fiche, fiche après révélation, prévisualisation du créateur (RG104),
fiche interne et file de vérification du backoffice. Le **taux d'engagement** et la **portée
moyenne** restent collectés, facultatifs, comme **indicateurs secondaires** : ils s'affichent
après les trois métriques prioritaires, jamais avant.

**RG114** — **Rythme de publication : une seule définition.** Le créateur saisit le **nombre de
publications permanentes des 30 derniers jours** (entier ≥ 0) : publications du fil, Reels, vidéos,
Shorts. **Les stories et les directs sont exclus** : ils ne laissent pas de trace qu'un agent puisse
compter. Le système en dérive le **rythme**, seule forme servie en couche A, à partir des bornes du
référentiel `reference.publication_frequencies` (valeurs de départ) :

| Rythme affiché | Publications sur 30 jours |
|---|---|
| Quotidien | 25 et plus |
| Plusieurs fois par semaine | 8 à 24 |
| Hebdomadaire | 4 à 7 |
| Deux fois par mois | 2 ou 3 |
| Mensuel ou moins | 0 ou 1 |

Le rythme **n'est plus choisi dans une liste par le créateur** : un rythme déclaré sans nombre ne se
vérifie pas et ne se suit pas dans le temps. Le libellé « deux fois par mois » remplace
« bimensuelle », que la moitié des lecteurs comprend comme « tous les deux mois ».

**RG115** — **Commentaires moyens par publication : une seule définition.** Le créateur saisit la
**moyenne du nombre de commentaires sur ses 12 dernières publications permanentes, hors
jeux-concours**, arrondie à l'entier. Les publications sont celles de RG114 (ni stories, ni directs).
Les **jeux-concours** (« commentez pour gagner ») sont **exclus** : ils mesurent l'attrait du lot,
pas l'intérêt de l'audience, et gonflent le chiffre d'un facteur dix. Le libellé « par publication,
sur les 12 dernières » est **identique partout** (même exigence que RG47). Le système en dérive la
tranche `reference.comment_bands` (valeurs de départ) : **0 à 9 · 10 à 49 · 50 à 199 · 200 à 999 ·
1 000 et plus**.

**RG116** — **Mêmes garanties que les abonnés.** RG22 (tranche calculée et stockée par le système),
RG45 (tranches seules en couche A, valeurs exactes en couche I avec source et date), RG46 (entiers
≥ 0 ; plafond de vraisemblance **signalé** à la modération, jamais refusé automatiquement), RG49
(source et date partout) et RG50 (date posée automatiquement, « chiffres à rafraîchir » au-delà de
90 jours) s'appliquent **à l'identique** aux deux nouvelles métriques. Une ligne de réseau n'a
**qu'une** date de mise à jour : elle n'est renouvelée que lorsque **les trois métriques
prioritaires** ont été saisies ou confirmées dans la même opération. Mettre à jour ses abonnés sans
confirmer les deux autres chiffres ne rajeunit pas une ligne dont les commentaires datent de six mois.

**RG117** — **Les commentaires s'affichent même déclarés.** Contrairement au taux d'engagement
(RG48), la tranche de commentaires moyens **est servie en couche A même lorsqu'elle n'a pas été
constatée**, avec la source « déclaré par le créateur » (RG49). Motif : c'est un **décompte**, pas un
ratio calculé par le créateur ; il se contrôle publication par publication sur le compte public, et
l'écart éventuel est conservé à la vérification (`08` RG41). Masquer une métrique prioritaire
viderait la carte de ce que le fondateur a désigné comme décisif (même logique que RG63). Ce
traitement est ajouté à **Q6**.

**RG118** — **Constat par l'agent.** Les trois métriques sont constatées lors de la vérification
d'audience (`08` RG38bis) : les abonnés sur la capture du tableau de bord natif, **le nombre de
publications et les commentaires moyens sur le profil public du compte**, selon les définitions de
RG114 et RG115. L'agent **n'enregistre que des nombres** : aucun texte de commentaire, aucun nom de
commentateur, aucune capture de commentaires n'est conservé (RG62). Mode de constat soumis à
**Q17**.

**RG119** — **Suivi dans le temps.** Chaque saisie et chaque constat des trois métriques
prioritaires est **historisé** (valeur, source déclarée ou constatée, date, auteur), jamais écrasé.
C'est ce qui permet de **suivre** un créateur — une communauté qui grandit, un rythme qui ralentit,
des commentaires qui s'effondrent — et d'alimenter plus tard le matching (D11). L'historique est en
couche **N** : une marque ne voit que la **dernière** valeur, le commercial et l'administrateur
voient l'évolution. Durée de conservation : **Q18**.

### F — Bloc 4 : audience

**RG55** — Toutes les données de ce bloc portent **sur la composition de l'audience**, jamais sur le
créateur (`matching-spec` A12). Aucun libellé d'écran, aucune facette et aucune explication ne doit
pouvoir être lu comme une caractéristique du créateur lui-même.

**RG56** — La **répartition par pays** est le champ le plus décisif pour l'annonceur : une audience
hors marché annule toute pertinence thématique. Elle est obligatoire sous la forme **pays principal +
part du pays principal**, et facultative au-delà (jusqu'à 4 autres pays représentant chacun ≥ 10 %).

**RG57** — Les répartitions sont **saisies en pourcentages entiers** par le créateur, par réseau et
par dimension (pays, âge, genre). La somme d'une dimension **ne peut dépasser 100** ; un reliquat est
affiché comme **« autres »** et n'est jamais complété automatiquement. Une somme inférieure à 100 est
acceptée — un tableau de bord natif n'affiche jamais tout.

**RG58** — **En couche A, seules les tranches sortent** : part du pays principal (≥ 80 % · 50-80 % ·
< 50 %), parts des autres pays (10-25 % · 25-50 % · > 50 %), tranches d'âge, tranche de genre
(majorité féminine ≥ 60 % · mixte · majorité masculine ≥ 60 %). **Aucun pourcentage exact** n'est
servi à une marque avant révélation, y compris dans une explication affichée : « 72 % en France »
s'écrit **« plus de 70 % d'audience en France »**.

**RG59** — Les **pourcentages exacts** sortent en couche **I**, après révélation, avec leur source et
leur date (RG49). La répartition détaillée conservée pour la vérification reste en couche N.

**RG60** — Les tranches d'âge sont **exactement** 18-24, 25-34, 35-44, 45 et plus. Aucune tranche
en dessous de 18 ans n'existe : elle n'a aucun usage produit et sa seule collecte poserait une
question de protection des mineurs qui n'a pas à être ouverte ici.

**RG61** — La répartition de genre est **exprimée en tranche dès la saisie** en couche A et ne
propose que trois valeurs (RG58). Le détail par genre reste en couches I et N. Aucune modalité autre
que « femmes », « hommes », « autres ou non déclaré » n'est proposée, et l'ensemble porte toujours
sur l'audience.

**RG62** — Les données d'audience portent sur des tiers : elles restent **agrégées**, jamais au
niveau individuel. Aucun export, aucune liste d'abonnés, aucune donnée nominative d'audience n'est
collectée sous aucune forme.

**RG63** — Une répartition d'audience **non couverte par un badge « Audience vérifiée »** est
affichée avec la source « déclaré par le créateur ». Contrairement au taux d'engagement (RG48), elle
reste affichée : c'est l'information la plus utile de la carte, et son absence viderait la recherche
de son intérêt. Ce traitement différencié est assumé et expliqué (**Q6**).

### G — Bloc 5 : offre, tarifs indicatifs et net créateur estimé

> **⚠️ Régime du pilote (D48, arbitrage du fondateur du 2026-09-24) : aucun taux ni aucun net
> estimé affiché.** Pendant le pilote, **RG68, RG69 (lignes « Commission INFLUX (35 %) » et « Net
> créateur estimé »), RG71 et RG72 sont suspendues** : le profil n'affiche que le **tarif
> indicatif**, avec le libellé « Ce que la marque paie au total, commission INFLUX incluse ». Ce que
> le créateur perçoit est **précisé par le commercial** dans la conversation et écrit dans le
> contrat hors plateforme. RG65 reste en vigueur : son aide à la saisie devient « Indiquez ce que la
> marque paie au total, commission INFLUX incluse. Votre commercial vous précise ce que vous
> percevez. »
>
> **Risque à traiter par `product-owner` et `expert-ux` :** sans net affiché sous le champ, un
> créateur risque de saisir ce qu'il veut percevoir au lieu du coût total pour la marque (l'erreur
> que RG65 décrit). La relecture du tarif par le commercial à la validation du profil (file 2 de
> `15`) devient le garde-fou principal.

**RG64** — L'offre est déclarée **par couple (réseau, format)** : un tarif « story Instagram » et un
tarif « vidéo TikTok » sont deux lignes. Un tarif global n'est comparable à aucun budget de campagne.

**RG65** — **Le tarif indicatif déclaré par le créateur est le coût total pour l'annonceur**, dans la
devise choisie. C'est la même assiette et ce sont les mêmes bornes que le **budget indicatif par
collaboration** d'une marque (document `06` RG29) : sans cela, les deux valeurs seraient
incomparables et tout rapprochement, humain ou futur, serait faux.

> **Cette règle est la plus dangereuse du document si elle n'est pas dite explicitement à l'écran.**
> Un créateur qui saisit « ce que je veux toucher » là où le produit attend « ce que la marque paie »
> se trompe de 35 %. Le libellé du champ et son aide énoncent la consigne avant la saisie :
> **« Indiquez ce que la marque paie au total. Ce que vous percevez s'affiche juste en dessous. »**

**RG66** — Le tarif est saisi en **valeur exacte** (couche N) et exposé en **tranche**
(`reference.price_bands`) en couche A, avec **sa devise**. Une tranche sans devise n'existe pas.

**RG67** — **Aucune conversion de devise n'est effectuée** au MVP (D27 ouverte). Si la devise d'un
créateur diffère de celle d'une marque, les deux valeurs sont affichées côte à côte, chacune avec sa
devise, sans rapprochement automatique et sans taux.

**RG68** — **À côté de chaque tarif indicatif, le profil affiche la tranche de « net créateur
estimé »**, dans la même devise. Par défaut, elle vaut **65 % du tarif** : le montant du contrat est
le coût total pour l'annonceur, commission **incluse** (`CLAUDE.md` §2), et la commission INFLUX
totale est de **35 %** — **20 % à la charge de l'annonceur et 15 % à la charge du créateur**.

**RG69** — Le libellé affiché distingue **sans ambiguïté trois notions**, toujours nommées, toujours
avec leur devise :

| Notion | Libellé affiché | Exemple sur la tranche 1 000 – 2 000 |
|---|---|---|
| **Tarif indicatif** | « Ce que la marque paie au total » | 1 000 – 2 000 |
| **Commission INFLUX (35 %)** | « Commission INFLUX : 20 % à la charge de la marque, 15 % à votre charge » | 350 – 700 |
| **Net créateur estimé** | « Ce que vous percevez, estimation » | 650 – 1 300 |

**RG70** — **Le net créateur estimé n'est jamais affiché à une marque**, en aucune couche. Ce qui
concerne l'annonceur est le coût total ; la répartition est expliquée par les pages publiques et les
CGU, pas par un profil. Symétrie exacte avec le document `06` RG32.

**RG71** — Le net créateur estimé est accompagné, partout où il apparaît, d'une **mention fixe** :
**« Estimation indicative, calculée sur votre tarif déclaré, aux taux par défaut de la plateforme.
Elle ne vaut pas engagement : les taux applicables sont figés au moment de la signature du
contrat. »** Le traitement fiscal (taxes comprises ou non) dépend des pays et **n'est pas tranché**
(D7) : aucun écran n'affirme « hors taxes » ni « taxes comprises » tant que D7 est ouverte.

**RG72** — **Aucune multiplication d'un montant par un taux n'est effectuée dans le code
applicatif.** Les bornes nettes sont **des colonnes du référentiel des tranches**
(`reference.price_bands`), calculées une fois lors de la création de la version du référentiel et
relues telles quelles. Cette règle préserve l'interdiction structurelle de `03` C(32) (table des taux
créée et vide au MVP) et le contrôle d'intégration continue T16, tout en satisfaisant l'exigence
d'affichage du fondateur. À valider par `expert-paiement-facturation` et `architecte` (**Q7**).

**RG73** — Les **droits d'usage** sont déclarés en deux listes distinctes : **inclus** dans le tarif
et **en option**. C'est la première cause de désaccord en négociation ; les confondre dans une seule
liste reproduit exactement le malentendu qu'on cherche à éviter.

**RG74** — La **disponibilité** est toujours affichée **avec sa date de déclaration**. Une
disponibilité sans date ne vaut rien. Au-delà de **30 jours** sans mise à jour, la mention
« déclarée le … » suffit : la valeur n'est ni effacée, ni réputée périmée.

**RG75** — Les **secteurs refusés** sont en couche **N**. Ils ne sont **jamais exposés, ni motivés,
ni comptés**, y compris auprès de la marque concernée : ils pourraient laisser inférer une conviction
personnelle. Ils produisent une **exclusion silencieuse** de la recherche (`matching-spec` A8) :
profil absent, aucun message, aucun emplacement grisé, aucun décompte.

**RG76** — Un créateur peut déclarer **accepter une contrepartie non monétaire** (booléen). Ce champ
ouvre le bas de marché et les jeunes marques ; il n'autorise **aucun** parcours sans tarif : un
profil publié comporte toujours au moins une ligne de tarif indicatif (RG4).

### H — Bloc 6 : portfolio

**RG77** — Le portfolio comporte **3 éléments au minimum et 8 au maximum**. En dessous de 3, la
marque n'a rien à juger ; au-dessus de 8, le coût de modération augmente sans gain mesuré.

**RG78** — **Chaque élément est modéré séparément, un élément = une décision**, avec un motif typé en
cas de refus. Un élément non approuvé n'est **jamais** affiché, même partiellement, même flouté. La
modération du portfolio est **la fuite d'anonymisation la plus probable de tout le produit**
(`matching-spec` A9).

**RG79** — La grille de contrôle du modérateur est **fermée** et appliquée telle quelle :

| # | Contrôle | Refus si |
|---|---|---|
| 1 | Filigrane, signature, logo personnel | Présent |
| 2 | `@`, nom de compte, pseudo incrusté dans l'image | Présent |
| 3 | Interface d'application visible (bandeau de profil, avatar, fil de commentaires) | Présente |
| 4 | Texte incrusté mentionnant le compte ou une marque partenaire | Présent sans autorisation (RG83) |
| 5 | Enseigne, plaque d'immatriculation, numéro de rue, lieu reconnaissable | Présent |
| 6 | Visage permettant de retrouver le compte par recherche d'image | Présent (**Q8**) |
| 7 | Capture d'écran de statistiques | **Interdite en couche A** : elle porte le pseudo |
| 8 | Métadonnées EXIF | **Supprimées systématiquement au dépôt**, avant modération |
| 9 | Contenu illicite, violent, sexuel ou contraire aux CGU | Présent |

**RG80** — Les **métadonnées EXIF sont supprimées au dépôt**, sans exception et avant toute
modération, en particulier la géolocalisation. Un élément dont les métadonnées n'ont pas été
retirées **ne peut pas** être approuvé.

**RG81** — **Le remplacement d'un élément déclenche une nouvelle modération complète** de cet
élément. Aucun élément ne devient publiable par l'effet d'un remplacement : c'est exactement ainsi
qu'une image non contrôlée arrive en production.

**RG82** — La **légende** d'un élément est un texte modéré de 200 caractères au plus, soumis aux
mêmes interdits que la bio (RG27).

**RG83** — **Une marque n'est nommée dans une légende que si le créateur déclare y être autorisé**,
au moyen d'une case dédiée, non pré-cochée, dont le libellé énonce la responsabilité :
**« Je confirme être autorisé à citer cette marque et à publier ce visuel. »** Sans cette case, la
légende est publiée sans le nom, ou refusée avec le motif dédié. La déclaration est horodatée et
conservée.

**RG84** — La **carte de recherche** affiche **1 à 3 éléments approuvés**, dans l'ordre choisi par le
créateur. Un profil publié sans aucun élément approuvé s'affiche **sans image**, jamais avec un
emplacement vide ni une image générique de remplacement qui laisserait croire à un contenu.

**RG85** — Les éléments approuvés sont visibles **en couche A** : ils sont donc consultables par
toute marque inscrite, sans révélation. Le créateur en est informé **avant** le premier dépôt, en
toutes lettres.

### I — Bloc 7 : complétude

**RG86** — La complétude est un **score pondéré de 0 à 100**, calculé côté serveur, recalculé à
chaque modification, et stocké. Elle est visible du créateur et des rôles internes ; **elle n'est
jamais affichée à une marque** (`matching-spec` A11 : la complétude est un palier de tri, pas une
facette exposée).

**RG87** — La pondération est **exactement** celle-ci :

| Bloc | Détail | Points |
|---|---|---|
| Présentation | Titre court 5 · bio ≥ 150 caractères 10 | **15** |
| Ligne éditoriale | Thématique principale 5 · thématiques secondaires 2 · ton 2 · langues 3 · pays 1 · déplacements 1 | **14** |
| Réseaux | 1re ligne complète (réseau, handle, URL, **les trois métriques prioritaires** — abonnés, publications des 30 derniers jours, commentaires moyens —, date) 16 · 2e ligne complète 5 · portée moyenne 1 *(pondération révisée le 2026-09-25, D61 : le rythme et les commentaires, désormais obligatoires, entrent dans la « ligne complète »)* | **22** |
| Audience | Pays principal et sa part 10 · autres pays 3 · tranches d'âge 4 · genre 3 | **20** |
| Offre | 1re ligne de tarif 8 · 2e ligne 3 · formats 3 · droits d'usage 2 · exclusivité 1 · disponibilité 2 | **19** |
| Portfolio | 3 éléments déposés 6 · 5 éléments ou plus 2 | **8** |
| Confiance | Demande de badge « Compte vérifié » **déposée** 2 | **2** |

**RG88** — La complétude **ne dépend jamais d'une action d'INFLUX**. Le score compte une demande de
badge **déposée**, jamais un badge **obtenu** ; des éléments de portfolio **déposés**, jamais
**approuvés**. Sinon la file interne pénaliserait le créateur pour un retard qui n'est pas le sien.

**RG89** — **La publication ne dépend pas du score** mais de la liste nominative des champs
obligatoires (RG4). Le score n'ouvre aucun droit.

**RG90** — Le message accompagnant le score est **factuel, mesurable et vérifiable**. Il nomme ce qui
manque et dit **ce que cela change concrètement**, sans promesse de résultat :

| Autorisé (vérifiable) | Interdit (invérifiable) |
|---|---|
| « Il manque 2 informations pour publier votre profil : disponibilité, tarif indicatif. » | « Complétez votre profil pour recevoir plus d'offres. » |
| « Sans répartition d'audience par pays, vous n'apparaissez pas quand une marque filtre sur un pays. » | « Un profil complet multiplie vos chances par 3. » |
| « Vos chiffres datent de plus de 90 jours : votre profil est affiché plus bas dans les résultats. » | « Les profils vérifiés gagnent plus. » |
| « Sans taux d'engagement vérifié, ce chiffre n'est pas affiché aux marques. » | « Les marques adorent les profils vérifiés. » |

**RG91** — Chaque affirmation du message de complétude doit correspondre à **une règle écrite de ce
document**. Une phrase d'encouragement qui ne renvoie à aucune règle est supprimée : c'est la
définition d'une promesse invérifiable.

### J — Backoffice : validation, modération, badges, correction

**RG92** — Le backoffice expose **deux files distinctes** propres au créateur, jamais fusionnées :
« profils créateur à valider » et « visuels de portfolio à modérer ». Elles sont également distinctes
des files du profil marque (document `06` RG63).

> **Correction du 2026-09-19 (arbitrage `chef-de-projet`).** La première rédaction annonçait une
> troisième file « demandes de badge ». `08` RG61 spécifie **une seule file technique de vérification**
> (créateurs et marques), présentée en deux vues ; c'est elle qui fait foi, `08` étant plus récent
> et plus précis sur ce point. Catalogue complet des files : `15` §C.

**RG93** — Chaque file est triée par ancienneté croissante et affiche, par entrée : alias, date de
soumission, ancienneté, éléments modifiés depuis la dernière validation, alertes de détection, agent
ayant pris l'entrée en charge.

**RG94** — Une entrée est **prise en charge** par un agent avant d'être traitée. Un **verrou** empêche
deux agents de traiter la même entrée : le second voit « déjà prise en charge par … », jamais une
erreur technique. Une prise en charge expire automatiquement au bout de **30 minutes** sans décision
et retourne dans la file.

**RG95** — Une décision est **toujours** l'une des deux suivantes : publier (ou approuver), ou
refuser avec un motif typé. Il n'existe pas de troisième voie silencieuse, ni de mise en attente
indéfinie.

**RG96** — La liste des motifs de refus d'un **profil** est **fermée** ; chaque motif porte le
message envoyé au créateur, dans sa langue :

| Motif | Message au créateur | Ce qu'il peut faire |
|---|---|---|
| Élément identifiant dans un texte | « Votre titre ou votre bio contient un pseudo, un `@`, un lien ou un nom. Ces informations ne sont visibles qu'une fois la mise en relation ouverte. » | Corriger et resoumettre |
| Bio trop courte ou incompréhensible | « Votre bio ne permet pas à une marque de comprendre ce que vous faites. » | Compléter |
| Portfolio insuffisant | « Il faut au moins 3 éléments déposés pour publier votre profil. » | Déposer |
| Portfolio non conforme | « Un ou plusieurs de vos visuels permettent de vous identifier. » | Remplacer |
| Handle ou lien incohérent | « Le lien déclaré ne correspond pas au réseau choisi. » | Corriger |
| Chiffres manifestement incohérents | « Les chiffres déclarés ne sont pas cohérents entre eux. » | Corriger |
| Thématique manifestement incohérente | « La thématique déclarée ne correspond pas au contenu montré. » | Corriger |
| Contenu illicite ou contraire aux CGU | Message dédié selon le cas | Selon le cas |
| Doute sur la majorité | Message dédié (D15) | Contacter INFLUX |
| Autre | Message rédigé par l'agent, en complément d'une explication | Contacter INFLUX |

**RG97** — La liste des motifs de refus d'un **visuel de portfolio** est également fermée et reprend
la grille de RG79, contrôle par contrôle. Les motifs de refus d'une **demande de badge** sont ceux de
la skill `profile-verification` (pièce absente, trop ancienne, illisible, source non acceptée, compte
non prouvé, incohérence, document douteux, autre).

**RG98** — Le motif **« Autre » est exceptionnel et surveillé** : s'il dépasse **10 % des refus** sur
un mois, la liste est incomplète et doit être étendue. Un commentaire libre est autorisé **en
complément** d'un motif typé, jamais à sa place.

**RG99** — Toute décision (publication, refus, approbation ou refus d'un visuel, attribution ou
retrait de badge, correction, suspension) est **journalisée nominativement** et **notifiée au
créateur** par un e-mail transactionnel dans sa langue.

**RG100** — Un agent peut **corriger** un champ d'un profil (faute, élément identifiant oublié,
thématique mal choisie). Toute correction enregistre l'ancienne et la nouvelle valeur, exige un
motif, est journalisée nominativement, et **le créateur en est informé**. Un agent qui modifie un
profil sans trace est indistinguable d'une falsification.

**RG101** — Le tableau de bord du backoffice affiche : profils créateur en attente, ancienneté du
plus ancien, visuels en attente de modération, délai médian de traitement, répartition des refus par
motif, badges actifs, badges arrivant à péremption sous 30 jours, **et profils dont les chiffres
datent de plus de 90 jours** (cible de relance commerciale).

### K — Ce qu'une marque voit d'un créateur, avant et après

**RG102** — Tableau de référence, champ par champ. Il est la formulation produit de la matrice de
droits `03` §3.2 et il ne la contredit sur aucun point :

| Champ | Avant ouverture de la mise en relation | Après |
|---|---|---|
| Alias + étiquette de contexte | Visible | Visible |
| Titre court, bio (modérés) | Visible | Visible |
| Thématiques, ton, langues de publication | Visible | Visible |
| Pays de résidence, déplacements possibles | Visible | Visible |
| Région de résidence | Visible **si ≥ 5 profils** (RG37) | Visible |
| **Ville de résidence** | **Masquée** | Visible |
| Réseaux couverts, compte principal | Visible | Visible |
| **Handle, URL de profil** | **Masqués** | **Visibles** |
| **Les trois métriques prioritaires** (RG113) : abonnés, rythme de publication, commentaires moyens — en tête de chaque ligne de réseau | **Tranche, ou rythme, seulement** (commentaires affichés même déclarés, RG117) | **Valeur exacte, avec source et date** |
| Portée moyenne (indicateur secondaire) | **Tranche seulement** | **Valeur exacte, avec source et date** |
| Historique des métriques prioritaires (RG119) | **Jamais** | **Jamais** |
| Taux d'engagement | **Tranche, et seulement si vérifié** | **Valeur exacte, avec source et date** |
| Répartition d'audience (pays, âge, genre) | **Tranches** | **Pourcentages exacts** |
| Date de dernière mise à jour des chiffres | Visible | Visible |
| Badges et leurs dates | Visibles | Visibles |
| Formats, tarifs indicatifs, délais, droits d'usage, exclusivité, disponibilité | **Tranches** | **Tranches** (RG103) |
| Portfolio approuvé + légendes | Visible | Visible |
| **Net créateur estimé** | **Jamais** | **Jamais** |
| **Secteurs refusés** | **Jamais** | **Jamais** |
| Nom légal, date de naissance, téléphone, e-mail, adresse | **Jamais** | **Jamais** |
| Captures de statistiques, pièces de vérification | **Jamais** | **Jamais** |
| Complétude, notes internes, état exact du profil | **Jamais** | **Jamais** |

**RG103** — **Le tarif exact ne sort jamais**, même après révélation : la tranche suffit à engager la
négociation, et le prix se discute dans la conversation, où le commercial est présent. C'est une
protection du modèle économique autant qu'une protection du créateur.

**RG104** — Le créateur dispose, dans son espace, d'une **prévisualisation « ce que voit une
marque »**, en deux onglets : avant et après la mise en relation. Elle affiche **exactement** ce que
l'API sert, jamais une reconstitution approximative.

**RG105** — Un créateur n'est **jamais notifié** lorsqu'une marque consulte son profil anonymisé, ne
voit **jamais** qui l'a consulté, et ne voit **jamais** une demande de mise en relation qui n'a pas
été validée (`03` C(18)). Seule une mise en relation validée produit une notification, au Lot 4.

### L — Leads, messages, états d'écran et accessibilité

**RG106** — Un événement **`profile.completed`** est émis à la **première publication** du profil.
Les modifications ultérieures d'un profil publié émettent **`lead.updated`**. Les deux suivent
exactement le pipeline du Lot 1 : émission dans la même transaction que le fait décrit, charge utile
réduite à des identifiants, **consentement relu à la consommation**.

**RG107** — Attributs enrichis chez **Brevo** (si consentement marketing) : thématique principale,
réseaux couverts, tranche d'audience du compte principal, pays principal d'audience, pays de
résidence, langue, statut déclaré, état du profil, complétude, badges et leurs dates. **Tous sont des
tranches, des codes de liste fermée ou des dates.**

**RG108** — **Ne partent jamais vers Brevo ni Apollo** : handle, `@`, URL de profil, pseudonyme, nom
légal, date de naissance, téléphone, adresse, chiffres exacts d'abonnés, de publications, de
commentaires, d'engagement, de portée ou d'audience, historique des métriques (RG119), tarifs exacts, secteurs refusés, notes internes, pièces et captures. Une base marketing
qui contient les pseudos est une copie de l'annuaire identifiant, hors de toute finalité déclarée.

**RG109** — La synchronisation **Apollo** d'un créateur dépend du périmètre paramétrable D33 (A7) et
du statut déclaré collecté au Lot 1. Ce document **n'ouvre aucun attribut supplémentaire** vers
Apollo : ce qui part reste ce que le Lot 1 a défini.

**RG110** — **Un champ absent est envoyé vide, jamais rempli d'une valeur inventée** (règle héritée du
Lot 1).

**RG111** — Chaque écran de ce périmètre possède **quatre états explicites** : repos, chargement,
succès, échec. L'enregistrement du profil est **automatique et incrémental** (le brouillon se
sauvegarde seul) ; un créateur interrompu ne recommence jamais, y compris au milieu d'un dépôt de
fichier. La soumission, elle, reste une action explicite.

**RG112** — Tous les messages existent en **français et en anglais** ; aucun n'est écrit en dur.
Accessibilité : chaque champ porte une étiquette visible **et son étiquette de couche** ; un champ en
erreur pointe vers son message ; le focus va au premier champ invalide ; les contrastes respectent
WCAG AA ; **le vert de marque n'est jamais le seul porteur d'un état**. Toutes les couleurs, tailles
et espacements passent par les tokens (`design-system-influx`).

| Clé | Français | English |
|---|---|---|
| `creatorProfile.publish.missing` | Il manque {count, plural, one {# information} other {# informations}} pour publier votre profil : {fields}. | {count, plural, one {# piece of information is} other {# pieces of information are}} missing to publish your profile: {fields}. |
| `creatorProfile.layer.public` | Visible de toutes les marques inscrites. | Visible to every registered brand. |
| `creatorProfile.layer.revealed` | Visible uniquement après l'ouverture d'une mise en relation. | Visible only after an introduction is opened. |
| `creatorProfile.layer.internal` | Visible uniquement par vous et l'équipe INFLUX. | Visible only to you and the INFLUX team. |
| `creatorProfile.alias.explain` | Les marques vous voient sous le nom {alias} tant qu'aucune mise en relation n'est ouverte. | Brands see you as {alias} until an introduction is opened. |
| `creatorProfile.rate.hint` | Indiquez ce que la marque paie au total. Ce que vous percevez s'affiche juste en dessous. | Enter the total amount the brand pays. What you receive is shown just below. |
| `creatorProfile.rate.net` | Vous percevez environ {min} – {max} {currency}. Commission INFLUX 35 % : 20 % à la charge de la marque, 15 % à votre charge. | You receive approximately {min} – {max} {currency}. INFLUX commission 35%: 20% paid by the brand, 15% paid by you. |
| `creatorProfile.rate.notice` | Estimation indicative, aux taux par défaut de la plateforme. Elle ne vaut pas engagement : les taux applicables sont figés à la signature du contrat. | Indicative estimate, using the platform's default rates. It is not a commitment: applicable rates are locked when the contract is signed. |
| `creatorProfile.figures.stale` | Vos chiffres datent du {date}. Au-delà de 90 jours, votre profil est affiché plus bas dans les résultats. | Your figures date from {date}. After 90 days, your profile is shown lower in results. |
| `creatorProfile.engagement.unverified` | Votre taux d'engagement n'est pas affiché aux marques tant qu'il n'a pas été constaté par INFLUX. | Your engagement rate is not shown to brands until INFLUX has verified it. |
| `creatorProfile.priorityMetrics.explain` | Ces trois chiffres sont les premiers que lisent les marques : la taille de votre communauté, votre rythme de publication et vos commentaires moyens. | These three figures are the first ones brands read: your community size, how often you post and your average comments. |
| `creatorProfile.posts30d.hint` | Comptez vos publications des 30 derniers jours : publications, Reels, vidéos, Shorts. Ne comptez ni les stories ni les directs. | Count your posts from the last 30 days: posts, Reels, videos, Shorts. Do not count stories or live streams. |
| `creatorProfile.comments.hint` | Faites la moyenne des commentaires sur vos 12 dernières publications, sans compter les jeux-concours. | Average the comments on your last 12 posts, leaving out giveaways. |
| `creatorProfile.figures.confirmAll` | Pour mettre à jour la date de vos chiffres, confirmez aussi votre rythme de publication et vos commentaires moyens. | To update the date of your figures, please also confirm how often you post and your average comments. |
| `creatorProfile.portfolio.notice` | Vos visuels approuvés sont visibles de toutes les marques inscrites, avant toute mise en relation. | Your approved visuals are visible to every registered brand, before any introduction. |
| `creatorProfile.portfolio.pending` | Ce visuel est en cours de modération. Il n'est pas encore visible des marques. | This visual is being reviewed. It is not visible to brands yet. |
| `creatorProfile.portfolio.brandConsent` | Je confirme être autorisé à citer cette marque et à publier ce visuel. | I confirm I am allowed to name this brand and publish this visual. |
| `creatorProfile.visibility.off` | Vous êtes retiré de la recherche : vous ne recevrez plus de demande de marque. | You are hidden from search: you will no longer receive requests from brands. |
| `creatorProfile.status.pendingWithPublished` | Vos modifications sont en cours de validation. Votre profil reste visible dans sa version précédente. | Your changes are being reviewed. Your profile remains visible in its previous version. |
| `creatorProfile.status.rejected` | Votre profil n'a pas été publié : {reason} | Your profile was not published: {reason} |
| `creatorProfile.errors.identifierInText` | Votre texte contient ce qui ressemble à un pseudo, un lien ou un identifiant. Retirez-le : il sera partagé une fois la mise en relation ouverte. | Your text contains what looks like a handle, a link or an identifier. Please remove it: it will be shared once the introduction is opened. |

---

## Cas limites

### Les huit cas limites de la skill `feature-spec`

**1 — Donnée absente ou profil incomplet**

| Situation | Comportement attendu |
|---|---|
| Un champ obligatoire est vide à la soumission | La liste nominative de ce qui manque s'affiche, le focus va au premier champ, le profil reste en brouillon (RG4) |
| Aucun visuel de portfolio approuvé après modération | Le profil reste publié, la carte s'affiche **sans image** (RG84), le créateur est notifié du refus avec son motif |
| Taux d'engagement saisi mais jamais vérifié | **Absent de la couche A** (RG48) ; le créateur voit le message `creatorProfile.engagement.unverified` |
| Répartition d'audience non renseignée | Publication possible ; le profil n'apparaît pas dans les recherches filtrant sur un pays, et le message de complétude le dit (RG90) |
| Un réseau déclaré sans chiffres | Refus de la ligne à la saisie : les abonnés sont obligatoires par ligne (RG41, tableau central) |
| Une thématique a été retirée du référentiel | Le profil reste publié avec sa valeur, une alerte de cohérence remonte au backoffice, le créateur est invité à choisir une thématique active |
| La marque consulte un profil repassé en validation | Elle voit la **dernière version validée** (RG9), jamais un profil vide |
| Moins de 5 profils publiés dans la région déclarée | Le pays seul s'affiche, **sans message ni compteur** (RG37) |

**2 — Valeur nulle, négative ou aberrante**

| Situation | Comportement attendu |
|---|---|
| Abonnés = 0 | **Accepté** : un compte nouvellement créé existe. La tranche la plus basse s'applique |
| Abonnés = −100, portée = −5 | Refus avec message dédié, côté navigateur **et** côté serveur (RG46) |
| Taux d'engagement = 250 % | Refus (borne 0-100) ; une valeur élevée mais possible est acceptée et **signalée à la modération**, jamais refusée automatiquement (RG46) |
| Répartition par pays totalisant 140 % | Refus : la somme d'une dimension ne peut dépasser 100 (RG57) |
| Répartition par pays totalisant 60 % | **Accepté**, le reliquat s'affiche « autres » et n'est jamais complété automatiquement (RG57) |
| Tarif à 0 ou négatif | Refus : un tarif indicatif est strictement positif. La gratuité se déclare par « contrepartie non monétaire » (RG76) |
| Tranche de tarif choisie sans devise | Refus : la devise est obligatoire dès qu'un tarif existe (RG66) |
| Tarif saisi qui est en réalité le net souhaité | **Non détectable par le système.** La consigne est portée par le libellé et l'aide (RG65), et le net estimé affiché juste en dessous rend l'erreur visible immédiatement |
| Bio de 3 000 caractères, titre de 300 caractères | Refus avec message dédié, des deux côtés |
| Visuel de 40 Mo, de 100 px, ou au format PDF | Refus avec message dédié indiquant formats et tailles acceptés |
| 12 éléments de portfolio déposés | Refus au-delà de 8, message indiquant le plafond (RG77) |
| 6 thématiques secondaires | Refus au-delà de 3 |

**3 — Doublon**

| Situation | Comportement attendu |
|---|---|
| Deux lignes pour le même (réseau, handle) | Refus à la saisie (RG42) |
| Deux lignes marquées « compte principal » | Refus : exactement une ligne principale (RG41) ; cocher la seconde décoche la première, explicitement |
| Un handle déjà déclaré par un **autre** compte créateur | **Alerte au modérateur**, aucun refus automatique : un compte peut changer de titulaire. La décision est humaine et journalisée |
| Un même créateur soumet deux fois son profil (double clic, deux onglets) | Une seule entrée en file ; la seconde soumission est sans effet |
| Le même visuel est déposé deux fois | Les deux existent tant que le plafond de 8 n'est pas atteint ; chacun est modéré séparément |
| Un visuel est remplacé par le même fichier | Nouvelle modération complète malgré tout (RG81) |
| Deux demandes de badge simultanées sur le même réseau | Une seule entrée active ; la seconde affiche « demande déjà en cours depuis le … » |

**4 — Action concurrente**

| Situation | Comportement attendu |
|---|---|
| Deux agents ouvrent la même entrée de validation | Un seul la prend en charge ; le second voit « déjà prise en charge par … » (RG94) |
| Un agent valide pendant que le créateur modifie un champ soumis à re-validation | La décision porte sur la version examinée ; la modification postérieure repasse en file avec la mention « modifié après examen » |
| Un agent modère un visuel pendant que le créateur le remplace | Le remplacement annule la décision en cours, l'élément repart en file, et l'agent en est informé à l'enregistrement |
| Un agent corrige un champ pendant que le créateur le corrige aussi | La dernière écriture gagne, les deux versions sont journalisées, et le créateur est informé de la correction de l'agent (RG100) |
| Un admin suspend un profil pendant qu'un agent attribue un badge | La suspension prime ; l'attribution est refusée avec un message explicite |
| Le créateur se retire de la recherche pendant qu'une marque consulte sa carte | La consultation en cours n'échoue pas ; le profil disparaît des recherches suivantes ; aucune demande ne peut plus être créée à partir d'une carte périmée |
| Une prise en charge est abandonnée sans décision | Elle expire au bout de 30 minutes et l'entrée retourne dans la file (RG94) |

**5 — Droit insuffisant**

| Situation | Comportement attendu |
|---|---|
| Une marque demande la charge utile d'un profil avant révélation | Les champs des couches I et N **ne figurent pas dans la réponse**, pas même vides (RG18) |
| Une marque interroge directement l'objet identifiant | Refus **au niveau de la base**, y compris hors application (`03` P5) |
| Une marque tente d'accéder à une capture de statistiques | Refus : aucun chemin n'existe, dans aucun cas (RG54, `03` C(13)) |
| Une marque tente d'exporter des résultats de recherche | Refus : l'export est interdit **à tout le monde**, y compris aux administrateurs (`03` C(17)) |
| Un créateur tente de lire le profil d'un autre créateur | Refus : il n'existe aucun chemin de lecture d'un profil créateur par un créateur |
| Un créateur tente de passer lui-même son profil en « publié » | Refus côté serveur : seul un rôle interne publie (RG5) |
| Un créateur tente de modifier son alias | Refus : l'alias n'est modifiable par personne (RG23) |
| Un agent tente de retirer un badge | Refus : le retrait relève d'`admin`, avec double validation (`03` §3.2) |

**6 — Service externe indisponible**

| Situation | Comportement attendu |
|---|---|
| Le stockage de fichiers est indisponible au dépôt d'un visuel | Le reste du profil est enregistré, le visuel est signalé « à redéposer », aucune saisie n'est perdue |
| Le retrait des métadonnées EXIF échoue | Le fichier **n'est pas enregistré** et le dépôt est à recommencer : un fichier non nettoyé n'entre jamais dans le produit (RG80) |
| Brevo ou Apollo indisponibles au moment de `profile.completed` | La publication aboutit, les lignes de synchronisation passent en attente et sont réessayées |
| La base est indisponible pendant l'enregistrement automatique du brouillon | Message honnête, saisie conservée dans le navigateur, nouvelle tentative proposée |
| Le réseau social est inaccessible au moment du constat du code de propriété | La demande reste en file avec le motif « à réexaminer », aucun refus automatique |
| L'envoi transactionnel est indisponible au moment d'une notification de décision | La décision est enregistrée, la notification est mise en file et réessayée ; l'état est visible au backoffice |

**7 — Abandon en cours de parcours**

| Situation | Comportement attendu |
|---|---|
| Le créateur quitte pendant la saisie | Le brouillon est conservé intégralement (RG111) ; aucune relance automatique sans consentement marketing |
| Le profil reste en brouillon plus de 30 jours | Aucun effet sur le compte ; le brouillon est **visible du commercial**, qui peut relancer (`matching-spec` A10) |
| Le créateur abandonne après avoir déposé 1 visuel sur 3 | Le profil reste en brouillon, le message nomme le nombre manquant |
| La demande de badge est abandonnée après génération du code | Le code expire (durée en paramètre, **Q11**), la demande passe en « expirée », le profil reste publié sans badge |
| Le créateur abandonne après un refus | Le profil reste `refusé` et modifiable ; le motif reste consultable dans son espace |
| Le créateur se déconnecte pendant un dépôt | Le dépôt est abandonné, aucun fichier partiel n'est conservé |

**8 — Annulation ou retour en arrière après validation**

| Situation | Comportement attendu |
|---|---|
| Le créateur veut dépublier son profil | Possible : retour en `brouillon`. Ses candidatures en cours sont retirées ; **les mises en relation ouvertes ne sont pas affectées** et ce qui a déjà été révélé le reste (RG19) |
| Le créateur supprime un réseau après une révélation | La ligne disparaît pour l'avenir ; **la marque à qui elle a été révélée conserve ce qu'elle a déjà vu**, et le journal en garde la trace |
| Le créateur baisse ses tarifs après une révélation | La tranche change pour l'avenir ; aucune notification n'est envoyée aux marques déjà en relation — le prix se discute dans la conversation (RG103) |
| Un visuel approuvé est retiré par le créateur | Il disparaît immédiatement de la couche A ; le fichier est purgé selon la durée de conservation retenue (**Q9**) |
| Un badge est retiré après avoir été affiché | Le badge disparaît immédiatement de tous les écrans ; **aucun historique de badge n'est affiché aux marques** |
| Un profil est suspendu | Il disparaît des recherches et des candidatures ; les mises en relation ouvertes subsistent (RG11) |
| Le compte est supprimé (Lot 1) | Le profil est anonymisé avec le compte ; les mises en relation et leurs horodatages de révélation sont conservés sous forme pseudonyme |
| Une décision de refus est contestée | Réexamen par un agent différent du décideur dès que l'équipe compte deux personnes ; sinon, réexamen différé et journalisé nominativement |

### Cas limites des métriques prioritaires (D61, additif du 2026-09-25)

| Situation | Comportement attendu |
|---|---|
| Le compte compte moins de 12 publications permanentes | La moyenne porte sur les publications existantes ; le libellé reste « par publication » (RG115) |
| Aucune publication permanente (compte neuf, ou compte qui ne publie qu'en stories) | **Accepté** : 0 publication, rythme « mensuel ou moins », 0 commentaire moyen. L'activité en stories se décrit dans la bio. Ce cas est signalé dans **Q16** |
| Commentaires désactivés sur le compte | La valeur saisie est **0** et la tranche la plus basse s'affiche : c'est exactement ce que la marque constatera. Aucune mention « désactivés » n'est inventée ; l'agent le note à la vérification |
| Commentaires moyens supérieurs au nombre d'abonnés (publication devenue virale) | **Accepté**, **signalé à la modération** (RG46, RG116), jamais refusé automatiquement |
| Une des 12 dernières publications est un jeu-concours | Elle est **exclue** et remplacée par la publication précédente (RG115) |
| Publications sur 30 jours = −3, commentaires = 12,5 | Refus avec message dédié, côté navigateur **et** côté serveur : entiers ≥ 0 (RG116) |
| Le créateur met à jour ses abonnés sans confirmer ses deux autres chiffres | Les abonnés sont enregistrés, **la date de la ligne n'est pas renouvelée**, le message `creatorProfile.figures.confirmAll` s'affiche (RG116) |
| Le créateur modifie son rythme après une révélation | La marque à qui la ligne a été révélée voit la **nouvelle** valeur exacte, avec sa date ; l'ancienne reste dans l'historique interne (RG119), jamais montrée à la marque |
| Compte privé : l'agent ne peut pas compter publications et commentaires | Le badge « Audience vérifiée » n'est pas accordé, motif `account_not_public` (`08` RG38bis) |

### La checklist INFLUX de la skill `feature-spec`

| # | Contrôle | Réponse pour ce document |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission INFLUX, net créateur | **Traités explicitement et nommément.** Le **tarif indicatif est le coût total pour l'annonceur** (RG65), la **commission INFLUX est de 35 %** répartie en 20 % marque et 15 % créateur (RG68), le **net créateur estimé vaut 65 %** et n'est affiché qu'au créateur et à INFLUX (RG70). Les trois notions sont nommées côte à côte (RG69), en tranches, avec devise et mention « ne vaut pas engagement » (RG71). **Aucun calcul n'est fait dans le code applicatif** : les bornes nettes viennent du référentiel (RG72). Aucun contrat, aucune facture (A1) |
| 2 | **Traçabilité / contournement** | **C'est le sujet central du document.** Handle, URL, pseudo, ville : couche I, révélés une seule fois, simultanément dans les deux sens (RG19). Chiffres et tarifs exacts : jamais en couche A (RG22, RG45), **tarif exact jamais révélé** (RG103). Aucun avatar (RG29). Textes modérés (RG25 à RG27). **Portfolio modéré visuel par visuel avec grille fermée et EXIF supprimés** (RG78 à RG81). **Risque résiduel assumé et signalé :** après révélation, la marque dispose du `@` et peut écrire hors plateforme. La parade principale reste la conversation à trois avec le commercial (A3) ; la parade mesurable est le journal des consultations et la détection de coordonnées dans la messagerie (Lot 3) |
| 3 | **Leads** — ce qui part vers Brevo et Apollo, avec quel consentement | Détaillé en RG106 à RG110 : `profile.completed` à la première publication, attributs **exclusivement en tranches et codes**, **liste explicite de ce qui ne part jamais** (RG108), périmètre Apollo inchangé et paramétrable (D33), consentement du Lot 1 relu à la consommation |
| 4 | **Backoffice** — contrepartie interne | Détaillée en RG92 à RG101 : trois files distinctes, verrou anti-double-traitement, motifs typés, modération visuel par visuel, saisie des chiffres constatés par l'agent, corrections journalisées, tableau de bord, relance des chiffres périmés |
| 5 | **Matching hybride** | **Aucun algorithme (D11).** Ce document **collecte** les données des facettes F1 à F20 de `matching-spec` A11 (et, depuis D61, de F24 et F25 : rythme de publication et commentaires moyens), toutes en tranches ou listes fermées, avec les mêmes bornes que côté marque (RG22). La voie humaine est spécifiée : validation, correction, modération, constat des chiffres, relance des brouillons, exclusion silencieuse des secteurs refusés (RG75) — **toutes journalisées nominativement** |
| 6 | **Deux populations** | Ce document ne traite **que** le créateur. La marque n'y apparaît qu'en lectrice (RG102). Files, motifs de refus, badges, libellés et écrans sont distincts de ceux du document `06`. **D41** : un rôle par compte |
| 7 | **Données personnelles** — avis de `expert-conformite-rgpd` | **Obligatoire, avec veto.** Points soumis : révélation de la ville (**Q2**), conservation de la date de naissance (**Q3**), affichage de la région sous seuil (**Q4**), données de tiers dans les captures et durée de conservation (**Q5**), visages dans le portfolio (**Q8**), conservation des visuels retirés (**Q9**), information des personnes sur l'annuaire anonymisé et le journal des recherches (**Q10**) |

---

## Critères d'acceptation

### Création, couches et champs

**CA1** — *Étant donné* un compte créateur qui vient de s'inscrire, *quand* il se connecte pour la
première fois, *alors* un profil créateur existe à l'état `brouillon`, pré-rempli avec le pays, la
langue et le statut déclaré saisis à l'inscription, et **un alias public est déjà généré**.

**CA2** — *Étant donné* le formulaire de profil, *quand* on examine ses champs, *alors* aucun champ
ne redemande l'adresse e-mail, le pays, la langue, le statut ou l'attestation de majorité déjà
collectés au Lot 1.

**CA3** — *Étant donné* chaque champ du formulaire, *quand* le créateur le sélectionne, *alors* son
étiquette de couche est visible (publique · après mise en relation · interne).

**CA4** — *Étant donné* un profil publié, *quand* on inspecte la **charge utile** servie au rôle
annonceur, *alors* aucun champ de la liste `matching-spec` A3 n'y figure — ni handle, ni URL, ni
pseudo, ni nom, ni chiffre exact, ni tarif exact, ni avatar — **pas même vide**.

**CA5** — *Étant donné* un profil publié, *quand* une marque consulte la carte anonyme, *alors*
l'alias affiché est identique pour toutes les marques, non séquentiel, non dérivé d'un pseudo et sans
marque de genre.

**CA6** — *Étant donné* le formulaire, *quand* on cherche un champ de photo de profil ou d'avatar,
*alors* **il n'en existe aucun**.

### Présentation et modération des textes

**CA7** — *Étant donné* une bio contenant `@monpseudo`, *quand* le créateur soumet son profil,
*alors* la détection signale le passage au modérateur, le profil n'est pas publié, et le motif typé
« élément identifiant dans un texte » est disponible.

**CA8** — *Étant donné* la situation précédente, *quand* on inspecte ce qui est stocké par la
détection, *alors* seuls le **type de motif et la position** sont conservés, **jamais le texte
détecté**.

**CA9** — *Étant donné* une bio de 100 caractères, *quand* le créateur soumet, *alors* la soumission
est refusée avec le message indiquant le minimum de 150 caractères.

### Réseaux

**CA10** — *Étant donné* un créateur qui déclare deux réseaux, *quand* il enregistre, *alors* chaque
réseau porte **sa propre ligne**, ses propres chiffres, sa propre date de mise à jour et ses propres
badges.

**CA11** — *Étant donné* deux lignes de réseau, *quand* le créateur coche « compte principal » sur la
seconde, *alors* la première est décochée, explicitement, et il reste exactement une ligne
principale.

**CA12** — *Étant donné* une ligne Instagram dont l'URL pointe vers TikTok, *quand* le créateur
enregistre, *alors* la saisie est refusée avec un message dédié.

**CA13** — *Étant donné* un créateur qui saisit 47 312 abonnés, *quand* une marque consulte la carte
anonyme, *alors* elle voit **une tranche**, et la valeur 47 312 **n'apparaît nulle part** dans la
réponse.

**CA14** — *Étant donné* la même ligne, *quand* la mise en relation est ouverte, *alors* la marque
voit **47 312**, accompagné de sa source (« déclaré par le créateur ») et de sa date.

**CA15** — *Étant donné* un taux d'engagement déclaré mais non vérifié, *quand* une marque consulte
la carte anonyme, *alors* **aucune valeur ni aucune tranche d'engagement n'est affichée**, et aucune
mention « non vérifié » n'apparaît.

**CA16** — *Étant donné* un taux d'engagement constaté par un agent, *quand* une marque consulte la
carte, *alors* la **tranche** s'affiche avec la date du constat.

**CA17** — *Étant donné* une ligne dont les chiffres datent de 91 jours, *quand* la carte s'affiche,
*alors* la mention « chiffres à rafraîchir » est visible, la ligne est rétrogradée dans le tri, et
**le profil reste visible**.

**CA18** — *Étant donné* un créateur qui modifie son nombre d'abonnés, *quand* il enregistre, *alors*
la date de dernière mise à jour est posée automatiquement et **ne peut pas être saisie à la main**.

**CA19** — *Étant donné* une demande de badge « Audience vérifiée » sans badge « Compte vérifié » sur
le même réseau, *quand* l'agent la traite, *alors* elle est refusée avec le motif « compte non
prouvé ».

**CA20** — *Étant donné* une capture datée de 45 jours, *quand* l'agent la traite, *alors* la demande
est refusée avec le motif « pièce trop ancienne ».

**CA21** — *Étant donné* une capture valide, *quand* l'agent attribue le badge, *alors* **les valeurs
enregistrées sont celles qu'il a saisies lui-même**, la valeur déclarée reste visible à part, et
l'écart est conservé.

**CA22** — *Étant donné* un badge « Audience vérifiée » attribué il y a 90 jours, *quand* l'échéance
est atteinte, *alors* il passe en « à rafraîchir », reste visible et daté, et est retiré à la fin du
délai de grâce — **sans affecter « Compte vérifié »**.

**CA23** — *Étant donné* un badge affiché, *quand* on l'examine sur la carte, la fiche et l'en-tête
de conversation, *alors* **sa date apparaît à chaque fois** et son libellé n'affirme ni authenticité
des abonnés, ni performance future, ni qualité.

### Audience

**CA24** — *Étant donné* une répartition par pays de 72 % France, *quand* une marque consulte la
carte anonyme, *alors* elle lit **« plus de 70 % d'audience en France »** et jamais « 72 % ».

**CA25** — *Étant donné* la même répartition, *quand* la mise en relation est ouverte, *alors* la
marque voit **72 %**, avec sa source et sa date.

**CA26** — *Étant donné* une saisie totalisant 140 % sur la dimension « pays », *quand* le créateur
enregistre, *alors* la saisie est refusée côté navigateur **et** côté serveur.

**CA27** — *Étant donné* une saisie totalisant 60 %, *quand* le créateur enregistre, *alors* elle est
acceptée et le reliquat s'affiche « autres », **sans complétion automatique**.

**CA28** — *Étant donné* les libellés d'audience, *quand* on les lit, *alors* chacun porte sans
ambiguïté sur **l'audience** et jamais sur le créateur.

**CA29** — *Étant donné* le formulaire, *quand* on cherche un champ d'âge, de genre, d'origine ou de
situation personnelle **du créateur**, *alors* **il n'en existe aucun**.

### Offre, tarifs et net créateur estimé

**CA30** — *Étant donné* le champ de tarif, *quand* le créateur le sélectionne, *alors* l'aide
affiche « Indiquez ce que la marque paie au total » **avant** la saisie.

**CA31** — *Étant donné* un tarif indicatif dans la tranche 1 000 – 2 000 EUR, *quand* le créateur
consulte son offre, *alors* le net créateur estimé affiché est **650 – 1 300 EUR**, et les trois
notions (ce que la marque paie, la commission 35 % avec ses deux parts, ce qu'il perçoit) sont
nommées côte à côte.

**CA32** — *Étant donné* le même tarif, *quand* une marque consulte le profil **avant ou après**
révélation, *alors* **aucun net créateur estimé n'apparaît**, en aucune couche.

**CA33** — *Étant donné* l'affichage du net estimé, *quand* on le lit, *alors* il porte la mention
« estimation… ne vaut pas engagement… taux figés à la signature » et **n'affirme ni « hors taxes »,
ni « taxes comprises »** tant que D7 est ouverte.

**CA34** — *Étant donné* le code applicatif, *quand* on cherche une multiplication d'un montant par
un taux, *alors* **il n'en existe aucune** : les bornes nettes proviennent du référentiel des
tranches.

**CA35** — *Étant donné* un tarif exact de 1 450 EUR, *quand* une marque consulte le profil **après**
révélation, *alors* elle voit **la tranche**, jamais 1 450.

**CA36** — *Étant donné* un tarif saisi à 0, *quand* le créateur enregistre, *alors* la saisie est
refusée et l'aide renvoie vers « contrepartie non monétaire ».

**CA37** — *Étant donné* une tranche de tarif choisie sans devise, *quand* le créateur enregistre,
*alors* la saisie est refusée.

**CA38** — *Étant donné* un créateur qui a déclaré refuser le secteur « jeux d'argent », *quand* une
marque de ce secteur lance une recherche correspondant à son profil, *alors* le profil est **absent
du résultat**, **sans message, sans emplacement grisé et sans décompte**.

**CA39** — *Étant donné* la même situation, *quand* on inspecte toute réponse servie à cette marque,
*alors* **aucune information sur l'existence du refus ni sur le secteur refusé** n'y figure.

### Portfolio

**CA40** — *Étant donné* un profil avec 2 éléments déposés, *quand* le créateur demande la
publication, *alors* elle est refusée et le message indique le minimum de 3.

**CA41** — *Étant donné* un dépôt de visuel, *quand* le fichier est enregistré, *alors* **les
métadonnées EXIF ont été supprimées**, et un échec de suppression empêche l'enregistrement.

**CA42** — *Étant donné* trois visuels déposés, *quand* l'agent les traite, *alors* **chacun porte sa
propre décision** et son propre motif en cas de refus.

**CA43** — *Étant donné* un visuel portant un `@` incrusté, *quand* l'agent le traite, *alors* il est
refusé avec le motif dédié et **n'est jamais affiché, même flouté**.

**CA44** — *Étant donné* un visuel approuvé, *quand* le créateur le remplace par un autre fichier,
*alors* l'élément repasse **intégralement** en modération et disparaît de la couche A jusqu'à la
nouvelle décision.

**CA45** — *Étant donné* une légende citant une marque **sans** case d'autorisation cochée, *quand*
l'agent traite l'élément, *alors* la légende est publiée sans le nom ou l'élément est refusé, et
jamais publié tel quel.

**CA46** — *Étant donné* le premier dépôt d'un visuel, *quand* l'écran s'affiche, *alors* le créateur
est informé en toutes lettres que ses visuels approuvés sont visibles de **toutes les marques
inscrites, avant toute mise en relation**.

**CA47** — *Étant donné* un profil publié sans aucun visuel approuvé, *quand* sa carte s'affiche,
*alors* elle s'affiche **sans image**, sans emplacement vide ni image générique.

### États, validation, refus, visibilité

**CA48** — *Étant donné* un profil publié, *quand* le créateur corrige sa bio, *alors* le profil
repasse en validation **et la version précédente reste affichée** aux marques pendant l'examen.

**CA49** — *Étant donné* un profil publié, *quand* le créateur met ses chiffres d'abonnés à jour,
*alors* la modification est visible immédiatement, **sans re-validation**.

**CA50** — *Étant donné* une entrée en file, *quand* un premier agent la prend en charge, *alors* un
second voit « déjà prise en charge par … » et ne peut pas décider ; sans décision, l'entrée retourne
dans la file au bout de 30 minutes.

**CA51** — *Étant donné* un refus, *quand* il est enregistré, *alors* un motif typé est obligatoire,
le créateur reçoit le message associé dans sa langue, et le profil reste modifiable.

**CA52** — *Étant donné* un agent qui corrige une thématique, *quand* il enregistre, *alors* un motif
est exigé, l'ancienne et la nouvelle valeur sont journalisées, et le créateur en est informé.

**CA53** — *Étant donné* un créateur qui désactive « visible dans la recherche », *quand* il
confirme, *alors* le message énonce qu'il ne recevra plus de demande, le profil disparaît des
recherches, **et ses mises en relation ouvertes ne sont pas affectées**.

**CA54** — *Étant donné* un profil suspendu, *quand* une marque lance une recherche correspondante,
*alors* le profil est absent **sans message ni décompte**, et aucune donnée n'est servie.

**CA55** — *Étant donné* une région déclarée partagée par 4 profils publiés, *quand* la carte
s'affiche, *alors* **seul le pays apparaît**, sans message ni compteur ; au 5e profil, la région
apparaît.

### Révélation, complétude, leads et états d'écran

**CA56** — *Étant donné* une mise en relation validée, *quand* la révélation est enregistrée, *alors*
la marque voit handle, URL, ville, chiffres et pourcentages exacts, **le créateur voit les
coordonnées de l'interlocuteur**, et les deux révélations portent **le même horodatage**.

**CA57** — *Étant donné* une mise en relation refermée après révélation, *quand* la marque revient
sur le profil, *alors* ce qui a été révélé le reste, et l'horodatage est conservé.

**CA58** — *Étant donné* une marque en mise en relation ouverte, *quand* elle demande à voir une
capture de statistiques ou le nom légal du créateur, *alors* **aucun chemin ne le lui permet**.

**CA59** — *Étant donné* un profil dont seuls la présentation et la ligne éditoriale sont
renseignées, *quand* le score est calculé, *alors* il vaut exactement la somme des poids de RG87
correspondants, et le détail est affiché bloc par bloc.

**CA60** — *Étant donné* un profil dont les visuels sont **en attente de modération**, *quand* le
score est calculé, *alors* il compte les éléments **déposés** et **ne baisse pas** à cause du délai
de traitement d'INFLUX.

**CA61** — *Étant donné* le message de complétude, *quand* on le lit, *alors* chaque affirmation
correspond à une règle de ce document et **aucune promesse de résultat chiffrée** n'y figure.

**CA62** — *Étant donné* une première publication, *quand* elle est enregistrée, *alors*
`profile.completed` est émis et les attributs de RG107 sont mis à jour chez Brevo **si** le
consentement est enregistré.

**CA63** — *Étant donné* un profil publié, *quand* on inspecte ce qui part vers Brevo et Apollo,
*alors* **aucun handle, aucune URL, aucun pseudo, aucun chiffre exact, aucun tarif, aucun nom légal**
n'y figure.

**CA64** — *Étant donné* un créateur **sans** consentement marketing, *quand* son profil est publié,
*alors* aucun contact marketing n'est mis à jour, la ligne est marquée « ignoré — sans consentement »
et **n'apparaît pas dans le compteur d'échecs**.

**CA65** — *Étant donné* une saisie en cours, *quand* le navigateur est fermé puis rouvert, *alors*
le brouillon est intégralement retrouvé, y compris les lignes de réseaux et de tarifs.

**CA66** — *Étant donné* chacun des messages de RG112, *quand* la langue de l'interface est
l'anglais, *alors* la version anglaise s'affiche, sans aucun texte français résiduel.

**CA67** — *Étant donné* les cinq états d'un profil, *quand* ils s'affichent, *alors* chacun porte un
**libellé écrit**, et la couleur n'est jamais le seul porteur de l'information.

### Métriques prioritaires (D61, additif du 2026-09-25)

**CA68** — *Étant donné* une ligne de réseau sans nombre de publications des 30 derniers jours ou sans
commentaires moyens, *quand* le créateur demande la publication, *alors* elle est refusée et la liste
nominative de ce qui manque nomme le réseau et le chiffre manquant (RG4, RG113).

**CA69** — *Étant donné* un créateur qui saisit 14 publications sur 30 jours, *quand* une marque
consulte la carte anonyme, *alors* elle lit **« plusieurs fois par semaine »**, et la valeur 14
**n'apparaît nulle part** dans la réponse (RG114).

**CA70** — *Étant donné* un créateur qui saisit 137 commentaires moyens, *quand* une marque consulte la
carte anonyme, *alors* elle voit la tranche **« 50 à 199 commentaires par publication »** avec la
source « déclaré par le créateur » et sa date, même sans badge (RG115, RG117) ; *quand* la mise en
relation est ouverte, *alors* elle voit **137**, avec sa source et sa date.

**CA71** — *Étant donné* une ligne de réseau affichée sur la carte, la fiche, la fiche révélée, la
prévisualisation du créateur ou la fiche interne du backoffice, *quand* on la lit, *alors* les trois
métriques prioritaires apparaissent **en tête de ligne, dans l'ordre** communauté · rythme ·
commentaires, et le taux d'engagement et la portée **après** elles (RG113).

**CA72** — *Étant donné* une ligne dont les chiffres datent de 100 jours, *quand* le créateur modifie
seulement ses abonnés, *alors* la date de la ligne **n'est pas renouvelée** et la mention « chiffres à
rafraîchir » reste affichée ; *quand* il confirme aussi son rythme et ses commentaires, *alors* la date
est renouvelée (RG116).

**CA73** — *Étant donné* un créateur qui a mis à jour trois fois ses métriques prioritaires, *quand* un
commercial ouvre sa fiche interne, *alors* il voit les **trois valeurs successives** avec leur source
et leur date ; *quand* une marque consulte le profil, avant ou après révélation, *alors* elle ne voit
**que la dernière** (RG119).

**CA74** — *Étant donné* un profil publié, *quand* on inspecte ce qui part vers Brevo et Apollo,
*alors* aucun nombre exact de publications ni de commentaires, ni aucun historique, n'y figure
(RG108).

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Espace | Écran | Remarque |
|---|---|---|
| Membre créateur | Profil — vue d'ensemble avec complétude par bloc | **Étiquette de couche sur chaque champ** (RG21) |
| Membre créateur | Bloc présentation (alias, titre, bio) | Expliquer l'alias avant tout : c'est la première surprise du parcours |
| Membre créateur | Bloc ligne éditoriale et résidence | Seuil de région expliqué sans compteur |
| Membre créateur | Bloc réseaux — **liste de lignes, ajout, édition** | Une ligne = un réseau ; date de mise à jour visible sur chaque ligne ; **les trois métriques prioritaires en tête de ligne**, avec leur aide de saisie (RG113 à RG116) |
| Membre créateur | Bloc audience — saisie en pourcentages par réseau | Somme contrôlée, « autres » affiché |
| Membre créateur | Bloc offre — matrice (réseau × format) + tarif | **Net créateur estimé sous chaque tarif** (RG68, RG69) |
| Membre créateur | Bloc portfolio — dépôt, ordre, état de modération par élément | Message de visibilité avant le premier dépôt (RG85) |
| Membre créateur | Demandes de badge par réseau, marche à suivre du code | Instructions de cadrage des captures (RG54) |
| Membre créateur | **« Ce que voit une marque » — avant / après** | Deux onglets, données réelles (RG104) |
| Membre créateur | Bandeau d'état + motif de refus | Cinq états, cinq messages |
| Membre créateur | Interrupteur « visible dans la recherche » | Conséquence énoncée sans détour (RG8) |
| Membre annonceur | Carte de profil anonymisée | Contenu exact de `matching-spec` A6 |
| Membre annonceur | Fiche créateur après révélation | Handle, URL, chiffres exacts, ville ; **jamais tarif exact ni net** |
| Backoffice | File « profils créateur à valider » + fiche de validation | Verrou, ancienneté, alertes de détection |
| Backoffice | File « visuels à modérer » — **un visuel, une décision** | Grille de RG79 affichée à côté de l'image |
| Backoffice | File « demandes de badge » — constat du code, saisie des chiffres | Écart déclaré / constaté affiché |
| Backoffice | Fiche créateur interne : couche N, notes, historique des décisions | Vue de travail du commercial |

### Données (`expert-database`)

Tables prévues et utilisées telles quelles : `profiles.creator_public_profiles`,
`profiles.creator_public_networks`, `profiles.creator_public_audience`,
`profiles.creator_public_rates`, `profiles.creator_topics`, `profiles.creator_formats`,
`profiles.portfolio_items`, `profiles.creator_social_accounts`, `profiles.creator_identities`,
`profiles.creator_audience_breakdowns`, `profiles.creator_rate_cards`,
`profiles.creator_refused_sectors`, `verification.*`, `audit.audit_events`, `reference.*`.

**Six écarts constatés avec `docs/mvp/04-modele-de-donnees-mvp.md` §5.2, à instruire :**

1. **Réponse à la question ouverte §12.4 Q3 du document `04` : après révélation, la marque voit les
   valeurs exactes** d'abonnés, d'engagement, de portée et de répartition d'audience (RG45, RG59).
   Le `GRANT` de `creator_social_accounts` doit donc inclure `followers_count` et `engagement_rate`.
   Motif : une fois le `@` connu, la marque lit le nombre d'abonnés publiquement ; le lui cacher
   ajoute de la friction sans protection, à condition que la **source et la date** accompagnent
   toujours la valeur et que le badge continue de ne constater qu'en tranches.
2. **La ville doit quitter `creator_identities` (jamais révélée) pour l'objet révélable** si **Q2**
   est tranchée dans le sens de ce document (RG36). Tant que **Q2** est ouverte, la **valeur d'attente
   conservatrice est le maintien en couche N**.
3. **Le champ « portée moyenne par publication » n'existe pas** dans `creator_public_networks` ni dans
   `creator_social_accounts` : il est nécessaire (tableau central, bloc 3).
4. **Les champs « ton éditorial », « fréquence de publication », « région de résidence »,
   « déplacements possibles », « droits d'usage inclus / en option », « délai de livraison »,
   « expérience de collaborations » n'apparaissent pas** dans le modèle : ils sont à ajouter, tous en
   listes fermées ou tranches.
5. **`reference.price_bands` doit porter les bornes nettes** (`net_min_minor`, `net_max_minor`),
   calculées à la création de la version du référentiel (RG72). C'est la mise en œuvre qui permet
   d'afficher le net créateur estimé **sans** aucun calcul de taux dans le code.
6. **L'état `suspendu` manque à `profiles.profile_status`** (quatre valeurs aujourd'hui, cinq sont
   nécessaires, RG3). Et la re-validation partielle de RG9 suppose de **conserver la dernière version
   validée** des éléments modérés pendant qu'une nouvelle version est en examen.

**Septième écart, ouvert par D61 (2026-09-25) :** deux colonnes exactes sur l'objet révélable
(`posts_last_30_days`, `avg_comments_per_post`), une tranche de commentaires et le rythme **dérivé**
sur la vitrine, un référentiel `reference.comment_bands`, des bornes numériques sur
`reference.publication_frequencies`, et une table d'**historique** des métriques prioritaires en
couche N (RG119). Détail : `04` §12.12.

À prévoir également : les paramètres (délai cible de validation, expiration d'une prise en charge,
durée du code de propriété, péremption des chiffres et des badges, seuil de région, plafonds de
vraisemblance par réseau, tailles de fichiers) vivent **en table**, modifiables sans redéploiement,
chaque modification étant journalisée.

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Brevo — contacts** | Mise à jour des attributs de RG107 à la publication et à chaque modification ; **aucun attribut identifiant** ; aucun envoi marketing sans consentement |
| **Brevo — transactionnel** | Notifications bilingues : profil publié, refusé, visuel refusé, badge attribué, badge à rafraîchir, badge retiré, chiffres à rafraîchir (J-15 et J+0) |
| **Apollo.io** | **Aucun attribut nouveau.** Périmètre inchangé, paramétrable (D33 / A7) |
| **Supabase Storage** | Compartiment **public** pour les visuels **approuvés uniquement** ; compartiment **privé** pour les captures et pièces ; **EXIF supprimés au dépôt, échec bloquant** ; accès aux pièces journalisé et jamais par URL signée remise au navigateur |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| Profils créateur publiés / comptes créateur inscrits | Mesuré ; un écart important signale un formulaire trop lourd |
| Délai médian de validation d'un profil | **Cible 1 jour ouvré**, alerte à 3 jours ouvrés (RG6) |
| Délai médian de modération d'un visuel | Mesuré ; c'est le goulot le plus probable du Lot 2 |
| Taux de refus par motif, part du motif « Autre » | « Autre » doit rester sous **10 %** (RG98) |
| Complétude moyenne des profils publiés | Mesurée ; identifie les champs systématiquement ignorés |
| Champs renseignés dans moins de 10 % des profils | Candidats au retrait : friction sans contrepartie (RG15) |
| Profils dont les chiffres datent de plus de 90 jours | Suivi hebdomadaire ; cible de relance |
| Badges actifs par niveau et par réseau, badges arrivant à péremption sous 30 jours | Suivi hebdomadaire |
| Visuels refusés par motif de la grille RG79 | Mesure directe de la qualité de l'anonymisation |
| Créateurs s'étant retirés de la recherche | Signal d'inconfort sur les couches : à croiser avec les motifs |
| Profils publiés par thématique | Alimente **D38** (masse critique avant d'ouvrir la recherche) |
| Écart médian entre chiffres déclarés et constatés | Signal de sérieux du catalogue, usage interne |
| **Répartition des profils publiés par tranche, pour chacune des trois métriques prioritaires**, par réseau et par thématique | **Suivi mensuel** (D61) : c'est la photographie du catalogue que le commercial vend |
| **Évolution des trois métriques prioritaires** d'un créateur entre deux mises à jour (RG119) | Mesurée ; un rythme qui s'effondre ou des commentaires qui chutent sont une cible de relance commerciale |
| Écart déclaré / constaté **sur les commentaires moyens** | Usage interne ; au-delà de 30 %, alerte `08` RG42. Mesure la fiabilité de RG117 (commentaires affichés même déclarés) |
| Durée médiane d'une vérification d'audience, avant et après D61 | Mesurée ; le décompte des publications et des commentaires ajoute du travail à l'agent (**Q17**) |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| Connexion directe aux API des réseaux sociaux (Instagram, TikTok) | Coût, agréments, instabilité ; challenge de bio temporaire pour le MVP, progressivement remplacé par OAuth (D65). **OAuth YouTube prévu en fin de MVP**. | Fin de MVP (YouTube) / Après le pilote (autres) |
| Détection automatique de faux abonnés | Aucun outil au MVP ; le badge **ne dit rien** sur ce sujet (`profile-verification`) | Décision du fondateur |
| Import automatique d'un portfolio depuis un réseau | Ramènerait pseudo, avatar et interface dans les visuels : contraire à RG79 | Non planifié |
| Vidéos dans le portfolio | Coût de modération, de stockage et de lecture sans effet mesuré | Après le pilote |
| Profil vidéo, message vocal, présentation animée | Même raison ; et une voix ou un visage identifient | Non planifié |
| Note, avis, étoiles, historique public de collaborations, nombre de contrats | **RG31** : vaut zéro au lancement, stigmatise ensuite, aide à ré-identifier | Non planifié |
| Liste des marques déjà travaillées | **RG32** : identifie le créateur en une recherche web | Vue commerciale uniquement |
| Plusieurs comptes gérés par une agence, profil multi-utilisateurs | Hors MVP (`profile-verification`, cas limites) | Après le pilote |
| Créateurs mineurs et régime associé | **D15** : exclus au MVP | Décision du fondateur |
| Ville comme facette de recherche, rayon kilométrique | **RG38** : ré-identification immédiate | Non planifié |
| Tarif exact révélé à une marque | **RG103** : le prix se négocie dans la conversation | V2 avec le contrat |
| Contrat, facture, encaissement, reversement, coordonnées bancaires | **A1** : hors application au MVP | V2 (Lots 4 et suivants du produit cible) |
| Algorithme de score, recommandation, « compatibilité en % » | **D11** reportée | Après le MVP |
| Traduction automatique de la bio | Le créateur écrit dans les langues qu'il déclare | Après le pilote |
| Portugais et autres langues d'interface | Français et anglais au lancement | Avant l'ouverture du Brésil |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **Le tarif indicatif est-il bien exprimé en coût total pour l'annonceur** (commission incluse), et le net estimé à 65 % ? L'alternative (le créateur déclare son net) rendrait les tranches incomparables avec le budget d'une marque | **Oui, coût total annonceur ; net estimé = 65 %** (RG65, RG68) | **Fondateur** + `expert-paiement-facturation` | **Avant le Lot 2** |
| **Q2** | **La ville de résidence est-elle révélée** après l'ouverture de la mise en relation, ou reste-t-elle interne ? Le modèle de données la place aujourd'hui en couche N | **Révélée** (RG36) ; **valeur d'attente conservatrice si la question n'est pas tranchée : maintien en couche N** | `expert-conformite-rgpd` (**veto**) + Fondateur | Lot 2 |
| **Q3** | **Faut-il conserver la date de naissance**, ou seulement l'attestation de majorité et sa date ? | Attestation seule au MVP ; date de naissance demandée uniquement si un doute est levé lors d'une vérification | `expert-conformite-rgpd` (**veto**) | Lot 2 |
| **Q4** | **Le seuil d'affichage de la région (5 profils) est-il suffisant** au démarrage, où le catalogue est petit ? | Seuil 5, aligné sur le k-anonymat de la recherche, **en paramètre** (RG37) | `expert-matching` + `expert-conformite-rgpd` | Lot 3 |
| **Q5** | **Données de tiers dans les captures de statistiques** : base légale, instructions de cadrage, durée de conservation des pièces | Compartiment privé, accès journalisés, purge à échéance écrite | `expert-conformite-rgpd` (**veto**) | Lot 2 |
| **Q6** | **Traitement différencié engagement / audience** : l'engagement non vérifié est masqué (RG48), la répartition d'audience non vérifiée reste affichée (RG63), **et les commentaires moyens non vérifiés aussi (RG117, D61)**. Est-ce le bon arbitrage ? | **Oui**, l'engagement est l'indicateur le plus manipulé ; l'audience est l'information la plus utile ; les commentaires sont un décompte contrôlable publication par publication et une métrique prioritaire | `expert-matching` + `product-owner` | Lot 3 |
| **Q7** | **Bornes nettes stockées dans le référentiel des tranches** plutôt que calculées : est-ce acceptable techniquement et comptablement ? Que se passe-t-il si un taux dérogatoire existe un jour ? | **Oui**, bornes en référentiel versionné (RG72) ; un taux dérogatoire produira une version de référentiel, jamais un calcul en ligne | `expert-paiement-facturation` + `architecte` | Lot 2 |
| **Q8** | **Un visage est-il acceptable dans un visuel de portfolio ?** L'interdire ampute gravement les thématiques mode, beauté et lifestyle ; l'autoriser ouvre la recherche d'image inversée | **Autorisé par défaut**, avec information explicite du créateur sur le risque au moment du dépôt ; refus si le visuel comporte **en plus** un élément de la grille RG79 | Fondateur + `expert-conformite-rgpd` + `expert-ux` | **Avant le Lot 3** |
| **Q9** | **Durée de conservation d'un visuel retiré ou refusé**, et des fichiers d'origine | Purge à échéance écrite, alignée sur les pièces de vérification | `expert-conformite-rgpd` (**veto**) | Lot 2 |
| **Q10** | **Information des personnes** : le créateur doit savoir qu'il figure dans un annuaire anonymisé, quel champ appartient à quelle couche, que les recherches sont journalisées et comment se retirer (`matching-spec` A12) | Rédaction à produire pour la politique de confidentialité et l'aide en ligne | `expert-conformite-rgpd` (**veto**) + `expert-ux` | Lot 2 |
| **Q11** | **Valeurs de paramétrage** : délai cible de validation (1 j ouvré), expiration d'une prise en charge (30 min), durée du code de propriété, péremption des chiffres (90 j), seuil de région (5), plafonds de vraisemblance par réseau | Valeurs de départ ci-contre, **en table** | `chef-de-projet` + Fondateur (cohérence avec **D39**) | Lot 2 |
| **Q12** | **Libellés juridiques exacts des badges « Compte vérifié » et « Audience vérifiée »**, en français et en anglais, relus avant tout affichage (rattaché à **D34**) | Substance fixée par RG51 à RG53 ; rédaction à produire | `expert-conformite-rgpd` + juriste | Lot 2 |
| **Q13** | **Une troisième action « ne plus me proposer ce profil »** côté annonceur serait un excellent signal négatif pour D11, mais expose une préférence et complique la carte (`matching-spec` A6) | **Non retenue au MVP** | `product-owner` + `expert-matching` | Lot 3 |
| **Q14** | **Le minimum de 3 éléments de portfolio est-il bloquant pour publier ?** Il élève la qualité du catalogue mais peut arrêter des créateurs légitimes (photographes de produits, voix off, comptes anonymes) | **Oui, bloquant** (RG4, RG77) ; à réexaminer si le taux de publication décroche | `chef-de-projet` + `expert-ux` | Lot 2 |
| **Q15** | **Les trois métriques prioritaires sont-elles bloquantes sur chaque ligne de réseau, ou seulement sur le compte principal ?** Les exiger partout garantit une carte homogène ; les limiter au compte principal allège la saisie d'un créateur présent sur quatre réseaux | **Chaque ligne** (RG113) ; à réexaminer si le taux de publication décroche | **Fondateur** + `chef-de-projet` | Avant le Lot 2 |
| **Q16** | **Définitions et bornes des métriques prioritaires** : fenêtre de 30 jours pour le rythme, 12 dernières publications pour les commentaires, exclusion des stories, des directs et des jeux-concours (RG114, RG115) ; bornes des rythmes et de `reference.comment_bands` ; calibration **par réseau** (un commentaire YouTube ne vaut pas un commentaire TikTok) ; sort des créateurs qui publient surtout en stories | Valeurs de départ de RG114 et RG115, **référentiel global**, en table ; calibration par réseau possible sans changement de schéma | `expert-matching` + `product-owner` | **Avant le Lot 2** |
| **Q17** | **Constat du rythme et des commentaires sur le profil public** (RG118, `08` RG38bis) : c'est une observation publique, pas une capture du tableau de bord natif (`08` RG31). Est-ce une preuve suffisante pour un chiffre marqué « constaté » ? Et le temps ajouté à chaque vérification (compter 12 publications) est-il tenable pour l'équipe ? | **Oui**, constat sur le profil public, **obligatoire** pour accorder « Audience vérifiée » ; durée mesurée (indicateur ci-dessus) | `product-owner` + `chef-de-projet` | Lot 2 |
| **Q18** | **Durée de conservation de l'historique des métriques prioritaires** (RG119), et son sort à la suppression du compte | Conservé tant que le compte existe, supprimé avec lui ; aucune donnée de tiers | `expert-conformite-rgpd` (**veto**) | Lot 2 |
