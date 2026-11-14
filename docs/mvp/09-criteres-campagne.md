# Lot 3 — Campagne : contenu, blocs, validation commerciale et publication

> **⚠️ Régime du pilote — D48 (arbitrage du fondateur du 2026-09-24).** Pendant le pilote, **aucun taux ni aucun net créateur estimé n'est affiché**, ni aux marques ni aux créateurs. Toutes les mentions du « net créateur estimé » et du pourcentage de commission dans ce document sont **suspendues** jusqu'à nouvel arbitrage ; la commission est présentée comme « incluse, précisée par votre commercial ». Voir `CLAUDE.md` §2 et `decisions.md` (D48).

> **⚠️ Régime du pilote — D78 (arbitrage du fondateur du 2026-11-01, étendu au Lot 3 le 2026-11-13, option A).** **Aucun montant ne s'affiche ni ne se saisit côté créateur.** La marque déclare son budget **par créateur, en tranche** (`reference.price_bands`) : donnée **interne**, vue de la marque qui l'a déclarée et des agents INFLUX, jamais d'un créateur. Le créateur voit la **nature de la rémunération** (RG62, le type de contrepartie) et la mention « À négocier avec votre commercial ». La fourchette publiée, le net estimé et la valeur chiffrée de la dotation sont **suspendus** côté créateur : liste des RG au bandeau de §F, note de §C. Colonnes et tables restent en base (`04` §5.4) : seuls la saisie et l'affichage sont suspendus (rangement de la tranche : **Q16**).

> **Date :** 2026-09-19 · **Auteur :** agent `product-owner` · **Statut :** spécification complète du
> contenu d'une campagne (Lot 3), soumise à la validation de `chef-de-projet`, avec **avis
> obligatoire (veto) de `expert-conformite-rgpd`** sur §E (ciblage d'audience et critères portant sur
> la personne du créateur), §C (dotation et obligation de divulgation) et §I (secteurs sensibles), et
> **avis obligatoire de `expert-paiement-facturation`** sur §F (assiette de la fourchette publiée et
> net créateur estimé).
>
> **Skills appliquées :** `feature-spec` (format de sortie), `matching-spec` (règle d'or des tranches
> A2, champs interdits A3, exclusions silencieuses A8, facettes A11, conformité A12),
> `contract-commission` (assiette du montant affiché), `backoffice-ops` (file, verrou, motifs typés),
> `design-system-influx` (états d'écran, affichage des montants).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité, **§2 modèle économique**),
> `docs/mvp/00-cadrage-mvp-v2.md` (périmètre, arbitrages **A1**, **A2**, **A3**, **A5**, **A9**,
> Lot 3), `docs/mvp/03-matrice-des-droits-et-rls.md` §3.3 (qui crée, qui valide, bloc interne) et
> C(7), C(8), C(17), `docs/mvp/04-modele-de-donnees-mvp.md` §5.4 (`campaigns.*`),
> `docs/mvp/06-criteres-profil-marque.md` (profil marque : la campagne n'a pas d'identité propre),
> `docs/mvp/07-criteres-profil-createur-reseaux-audience.md` (bornes de tranches, assiette du tarif, tarif suspendu au pilote par D78),
> `docs/mvp/08-verification-et-badge.md` RG15 et RG18 (campagne réservée aux profils vérifiés).
>
> **Ce que ce document tranche :** les huit blocs et les champs exacts d'une campagne, leur caractère
> obligatoire, recommandé ou interne, leur format, les six états, la validation commerciale et son
> délai, la revue renforcée des secteurs sensibles, ce qui est publié et ce qui ne l'est jamais, la
> façon dont une fourchette de rémunération est nommée et affichée, et ce qu'un créateur voit d'une
> campagne.
>
> **Ce qu'il ne tranche pas :** la maquette et la microcopie (`expert-ux`) ; le schéma SQL, les index
> et les politiques d'accès (`expert-database`, `expert-cybersecurite`) ; la **recherche de campagnes
> côté créateur**, ses facettes et son tri (`expert-matching`, second volet du Lot 3) ; la
> **candidature** elle-même, la file de validation des mises en relation et la conversation (Lot 4) ;
> les règles de scoring (**D11**, reportée).
>
> **Invariant rappelé :** aucun contrat, aucune facture, aucun encaissement, **aucun calcul de
> commission** n'existe dans ce périmètre (arbitrage **A1**). Une campagne **décrit une offre** ; elle
> ne déclenche aucune transaction, n'engage personne et ne produit aucun document contractuel.
>
> **Prolongement des Lots 1 et 2 :** ce document ne redemande **jamais** une information déjà portée
> par le compte (Lot 1) ou par le profil marque (Lot 2). Toute redemande serait un défaut.

---

## Besoin

**Permettre à une marque de décrire en moins de vingt minutes une offre qu'un créateur peut accepter
ou refuser sans poser de question — et qu'un commercial INFLUX peut vendre sans rappeler la marque
pour comprendre ce qu'elle veut.**

Quatre raisons d'être, dans cet ordre :

1. **Commerciale.** La campagne est le seul objet du produit qui porte une **intention d'achat
   datée**. Un profil marque dit qui l'on est ; une campagne dit ce qu'on veut, quand et pour combien.
   C'est ce que le commercial vend, et c'est le point de départ de la proposition INFLUX (**A3bis**).
2. **Produit.** Le Lot 4 part d'une campagne : la proposition du commercial, la candidature du
   créateur et la conversation s'y rattachent toutes. Une campagne floue produit une mise en relation
   floue, donc une affaire perdue.
3. **Réduction des désaccords.** Les deux premières causes de rupture après la mise en relation sont
   les **droits d'usage** et l'**exclusivité** (`matching-spec` A11, F14 et F15). Les laisser hors du
   brief revient à les découvrir en négociation, quand le commercial a déjà dépensé son temps.
4. **Protection du modèle économique.** Un brief est un texte libre long, lu par tous les créateurs
   inscrits : c'est le meilleur endroit du produit pour glisser une adresse e-mail, un lien ou un
   « envoyez-nous votre kit média ». Ce document est l'endroit où cette fuite devient une règle
   vérifiable.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Annonceur** (titulaire du compte marque) | Crée, complète, soumet, corrige, met en pause, clôture et duplique ses campagnes ; consulte leur état et le motif d'un refus |
| **Créateur** | **Lit** une campagne publiée. Il ne la modifie jamais. Il n'y candidate pas dans ce périmètre (Lot 4) |
| **Commercial INFLUX** (rôle `agent`) | Valide ou refuse une campagne avec un motif typé, modère ses textes, corrige un champ, crée ou modifie une campagne pour le compte d'une marque, s'attribue la campagne, annote |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, plus : seconde validation d'une campagne en secteur sensible, dépublication d'autorité, correction d'un champ interne |
| **Système** | Contrôle la cohérence des dates et des montants, dérive les tranches de budget, détecte les coordonnées, les montants et les critères interdits dans les textes, ferme les candidatures à échéance, émet les événements de leads |
| **Brevo / Apollo.io** (externes) | Reçoivent des attributs d'enrichissement du contact annonceur, dans les limites du consentement et du périmètre du Lot 1 |

> **Deux populations, deux parcours.** La campagne est **écrite par une marque** et **lue par un
> créateur**. Ce ne sont pas les mêmes écrans, pas les mêmes libellés, pas les mêmes champs visibles.
> Aucun écran de ce document n'est partagé entre les deux.

---

## User stories

### Annonceur

- **US1** — En tant qu'**annonceur**, je veux décrire mon besoin sans retaper qui je suis, afin de ne
  jamais redonner une information que mon profil porte déjà.
- **US2** — En tant qu'**annonceur**, je veux dire exactement ce que j'attends (réseaux, formats,
  quantités, droits d'usage, exclusivité, délais), afin de ne pas découvrir un désaccord après la mise
  en relation.
- **US3** — En tant qu'**annonceur**, je veux annoncer une fourchette de rémunération par créateur
  sans révéler mon budget total, afin de ne pas donner ma position de négociation.
  *Au pilote (D78) : la marque déclare une tranche de budget par créateur, interne ; rien n'est annoncé aux créateurs.*
- **US4** — En tant qu'**annonceur**, je veux savoir, champ par champ, ce qui est publié et ce qui
  reste interne à INFLUX, afin de ne pas découvrir après coup qu'une information est visible.
- **US5** — En tant qu'**annonceur**, je veux savoir ce qu'il me manque pour soumettre ma campagne,
  afin de ne pas remplir quarante champs sans savoir lesquels comptent.
- **US6** — En tant qu'**annonceur**, je veux corriger une faute sur une campagne publiée sans qu'elle
  disparaisse pendant l'examen, afin de ne pas perdre les candidatures en cours.
- **US7** — En tant qu'**annonceur**, je veux mettre ma campagne en pause ou la clôturer, afin
  d'arrêter les sollicitations quand mon besoin est couvert.
- **US8** — En tant qu'**annonceur** dont la campagne est refusée, je veux comprendre pourquoi et ce
  que je dois changer, afin de pouvoir la resoumettre seul.

### Créateur

- **US9** — En tant que **créateur**, je veux comprendre en un coup d'œil ce qu'une campagne demande,
  pour quel réseau, dans quel délai et pour combien, afin de décider en moins d'une minute si elle me
  concerne.
  *Au pilote (D78), « pour combien » se lit « contre quel type de contrepartie » : le montant se négocie avec le commercial.*
- **US10** — En tant que **créateur**, je veux savoir **ce que je toucherais réellement**, afin de ne
  jamais découvrir la commission INFLUX après coup.
  *Suspendue (D78, après D48) : ce que perçoit le créateur lui est annoncé par son commercial.*
- **US11** — En tant que **créateur**, je veux connaître les droits d'usage et l'exclusivité demandés
  **avant** de m'intéresser à une campagne, afin de ne pas négocier trois jours pour rien.
- **US12** — En tant que **créateur**, je veux savoir si un produit m'est envoyé et ce que j'en fais,
  afin de mesurer ce que la collaboration me coûte réellement.
- **US13** — En tant que **créateur**, je veux savoir qui est la marque derrière la campagne et ce qui
  a été vérifié par INFLUX, afin de ne pas travailler pour une coquille vide.

### Commercial et administrateur

- **US14** — En tant que **commercial**, je veux valider ou refuser une campagne avec un motif choisi
  dans une liste, afin qu'aucun refus ne soit muet et que les motifs soient comptables.
- **US15** — En tant que **commercial**, je veux voir le budget total et mes notes internes sur une
  campagne, afin de savoir jusqu'où la marque peut aller avant de la rappeler.
- **US16** — En tant que **commercial**, je veux créer ou corriger une campagne pour le compte d'une
  marque qui m'a appelé, afin que le produit outille mon métier au lieu de le ralentir.
- **US17** — En tant qu'**administrateur**, je veux qu'une campagne en secteur sensible passe par une
  seconde paire d'yeux, afin qu'aucune campagne d'alcool, de jeu d'argent ou de crypto ne soit
  publiée par inadvertance.

### Système

- **US18** — En tant que **système**, je veux qu'aucune donnée interne d'une campagne ne sorte jamais
  dans une réponse servie à un créateur, afin que la confidentialité du budget total ne dépende pas
  de la discipline d'un développeur.

---

## Règles de gestion

### A — Portée, états, publication

**RG1** — Une campagne appartient à **un compte annonceur et un seul**. Elle est créée à l'état
**brouillon**, par l'annonceur lui-même ou par un rôle `agent` / `admin` agissant pour son compte
(`03` §3.3, C(7)).

**RG2** — Une campagne **ne porte aucune identité de marque propre** : ni nom, ni logo, ni secteur
d'entreprise, ni présentation, ni interlocuteur. Elle **affiche le profil marque** dans son état
publié (`06` RG73). Aucun de ces champs n'est ressaisi, et aucun n'est modifiable depuis la campagne.

**RG3** — Une campagne connaît **six états**, et six seulement :

| État | Signification | Qui le déclenche | Visible d'un créateur |
|---|---|---|---|
| `brouillon` | En cours de rédaction | L'annonceur ou un agent (état initial) | Non |
| `à valider` | Soumise, non encore examinée | L'annonceur | Non (ou dernière version validée, RG7) |
| `publiée` | Validée par un commercial | Un agent ou un admin | **Oui** |
| `en pause` | Publiée puis suspendue par la marque | L'annonceur, un agent ou un admin | Oui, avec la mention « en pause » |
| `clôturée` | Terminée, définitivement | L'annonceur, un agent, un admin ou le système (RG9) | Non |
| `refusée` | Examinée et écartée, avec motif typé | Un agent ou un admin | Non |

**RG4** — Une campagne ne peut passer de `brouillon` à `à valider` que si **les deux conditions
suivantes sont réunies** : le **profil marque est publié** (`06` RG8), et **tous les champs marqués
obligatoires** dans les tableaux RG16, RG24, RG34, RG46, RG55, RG69 et RG76 sont renseignés. Le bouton
« Soumettre ma campagne » reste visible en permanence, avec la liste nominative de ce qui manque —
jamais désactivé sans explication.

**RG5** — **Aucune campagne ne devient visible d'un créateur sans décision humaine.** La publication
est prononcée par un rôle `agent` ou `admin`, jamais par un automatisme, jamais par expiration d'un
délai. Cette règle est portée par la base (`04` §5.4, contrainte `campaigns_published_needs_review`),
pas par l'application.

**RG6** — L'objectif de délai de validation d'une campagne est de **1 jour ouvré** (aligné sur
**D39**), mesuré en délai médian **et** en délai du 9e cas sur 10. Il est de **2 jours ouvrés** pour
une campagne en **revue renforcée** (RG85), parce qu'elle exige deux décideurs. Au-delà de **3 jours
ouvrés**, l'entrée remonte en alerte sur le tableau de bord du backoffice. Ces trois valeurs sont
**des paramètres en table**, pas des constantes (**Q9**).

**RG7** — Sur une campagne **déjà publiée**, les champs se répartissent en deux régimes :

| Régime | Champs concernés | Effet d'une modification |
|---|---|---|
| **Re-validation** | Tous les textes, le type de campagne, le produit, la dotation, les livrables, les droits d'usage, l'exclusivité, le ciblage d'audience, la fourchette de rémunération, la nature de la rémunération, la période de publication, la date de livraison, l'option « profils vérifiés » | Repasse en `à valider`. **La dernière version validée reste affichée** pendant l'examen |
| **Effet immédiat** | Report de la date limite de candidature, **hausse** du plafond de candidatures, nombre de créateurs recherchés, budget total interne, notes internes | Prise en compte immédiate, sans examen |

*Au pilote (D78), « la fourchette de rémunération » se lit « la tranche de budget par créateur » : interne, elle reste
soumise à re-validation (choix le plus prudent).*

Une campagne ne devient jamais invisible parce que sa marque a corrigé une faute de frappe. Toute
modification soumise à re-validation sur une campagne ayant déjà reçu des candidatures est
**notifiée aux candidats**, qui peuvent retirer leur candidature (Lot 4, **Q12**).

**RG8** — Une campagne `en pause` reste lisible, affiche la mention « en pause », **n'accepte plus
aucune candidature** et n'apparaît plus dans la recherche de campagnes. Les candidatures déjà déposées
et les mises en relation déjà ouvertes ne sont **pas** affectées. La reprise est immédiate et **ne
repasse pas par la validation**, sauf si un champ soumis à re-validation a été modifié entre-temps.

**RG9** — Une campagne est `clôturée` dans quatre cas : décision de la marque, décision d'un rôle
interne, **atteinte du plafond de candidatures** (RG78), ou **30 jours après la fin de la période de
publication** (valeur de départ, paramètre en table). Une clôture n'efface **aucune** donnée et
n'affecte **aucune** mise en relation ouverte. Elle est **irréversible** : une nouvelle campagne se
duplique, elle ne se rouvre pas.

**RG10** — Une campagne `refusée` porte **un motif typé** choisi dans la liste fermée de RG90, reste
intégralement modifiable et peut être resoumise sans délai. **Aucun refus muet, aucun dossier laissé
en attente sans décision.**

**RG11** — Si le profil marque est `suspendu` ou repasse en `brouillon` (`06` RG11, cas limite 8),
**toutes ses campagnes publiées sont dépubliées** : elles ne sont plus lisibles d'aucun créateur et
n'acceptent plus de candidature. Les mises en relation ouvertes restent accessibles à leurs
participants et au commercial.

**RG12** — **Aucun écran, aucun e-mail et aucune donnée de ce périmètre ne produit un contrat, une
facture, un encaissement ni un calcul de commission** (**A1**). Une campagne est une **offre
publiée** : elle n'engage ni la marque, ni le créateur, ni INFLUX. Les seuls montants présents sont la
**fourchette de rémunération par créateur**, la **valeur d'une dotation** et le **budget total
interne** — tous nommés, tous avec leur devise, tous accompagnés de la mention de RG67. *Au pilote (D78) : la tranche de budget par créateur remplace la
fourchette, aucun de ces montants n'est servi à un créateur, et la mention « À négocier avec votre commercial »
remplace celle de RG67.*

**RG13** — Toute valeur destinée à filtrer, comparer ou rapprocher est une **liste fermée** ou une
**tranche**, jamais un texte libre (règle d'or, `matching-spec` A2). Les seuls textes libres d'une
campagne sont : le **titre**, le **résumé public**, le **brief détaillé**, la **description du produit**,
les **messages clés** et les **interdits et points de vigilance** — **tous modérés avant publication**.

**RG14** — Toute saisie est validée **côté serveur** avec exactement les mêmes règles que côté
navigateur. La validation dans le navigateur est un confort ; elle n'est jamais la seule.

**RG15** — Une marque ne peut avoir plus de **10 campagnes simultanément publiées ou en pause**
(valeur de départ, **paramètre en table**, **Q11**). Au-delà, la soumission est refusée avec un
message nommant les campagnes à clôturer. Sans ce plafond, un compte unique sature la recherche de
campagnes le jour de son ouverture.

### B — Bloc 1 : identification

**RG16** — Le bloc « identification » comporte **exactement** ces champs :

| Champ | Caractère | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Titre | **Obligatoire** | Publiée | Texte **modéré**, 10 à 140 caractères | C'est la seule ligne lue dans une liste de campagnes |
| Type de campagne | **Obligatoire** | Publiée | Liste fermée, 1 choix (RG18) | Conditionne les livrables et les droits d'usage attendus ; premier tri d'un créateur |
| Résumé public | **Obligatoire** | Publiée | Texte **modéré**, 120 à 400 caractères | Ce qui s'affiche sur la carte de campagne : la décision de lire la suite se prend ici |
| Brief détaillé | **Obligatoire** | Publiée | Texte **modéré**, 300 à 4 000 caractères | Ce qui évite au commercial de rappeler la marque pour comprendre la demande |
| Référence interne de la marque | Recommandé | **Interne à la marque** | Texte, ≤ 40 caractères | Confort d'une marque qui gère plusieurs campagnes ; jamais publié |

**RG17** — Le **titre** décrit l'offre, pas la marque. Il ne contient ni nom de marque (le profil le
porte déjà), ni montant, ni coordonnée, ni lien, ni majuscules intégrales.

**RG18** — Le **type de campagne** est une **liste fermée de sept valeurs**, sans valeur « autre » :

| Type | Ce qu'il désigne |
|---|---|
| Placement de produit dans un contenu | Le créateur publie sur son compte un contenu mettant en avant le produit |
| Contenu livré à la marque (UGC) | Le créateur produit un contenu que la marque diffuse elle-même ; **pas de publication sur le compte du créateur** |
| Test de produit et avis | Le créateur reçoit le produit, l'essaie et publie son avis |
| Ambassadeur sur la durée | Collaboration récurrente sur plusieurs mois |
| Concours ou jeu concours | Le créateur relaie une mécanique de jeu auprès de son audience |
| Présence à un événement ou déplacement | Le créateur se déplace ; couvre les tournages et les venues en magasin |
| Programme d'affiliation | La rémunération dépend des ventes générées |

Une valeur « autre » rendrait le champ inexploitable en recherche de campagnes et ferait de ce champ
un texte libre déguisé (`matching-spec` A2). Si un besoin ne rentre dans aucune des sept valeurs, la
liste est incomplète et doit être étendue — c'est une décision, pas un contournement.

**RG19** — Le **résumé public** dit ce que la marque cherche, pour qui et sur quel réseau. Il est le
seul texte affiché avant l'ouverture de la campagne : s'il est vide de sens, la campagne ne sera pas
ouverte.

**RG20** — Le **brief détaillé** décrit la demande en toutes lettres : contexte, attentes créatives,
ton, ce qui doit apparaître, ce qui est laissé libre. Il est plafonné à 4 000 caractères ; au-delà, la
marque écrit un cahier des charges, pas un brief.

**RG21** — **Aucun texte d'une campagne ne peut contenir de coordonnée directe** : adresse e-mail,
numéro de téléphone, adresse postale, identifiant de messagerie, `@` de réseau social, nom de
domaine, invitation à écrire ou à appeler. Une détection automatique **signale** au modérateur ;
**c'est le modérateur qui décide**, et le refus porte le motif « coordonnée directe dans un texte
publié » (RG90). Le texte reste en brouillon : il n'est ni publié, ni modifié à l'insu de la marque.

> **C'est la première voie de contournement de tout le Lot 3.** Un brief lu par tous les créateurs
> inscrits qui dit « envoyez votre kit média à partenariats@marque.com » remplace INFLUX par une
> boîte de réception, sans qu'aucune règle technique ne soit violée.

**RG22** — **Aucune URL, aucun lien, aucun code à scanner n'est accepté dans un texte de campagne**,
y compris vers le site de la marque. Le domaine de la marque est déjà public sur son profil
(`06` RG17), réduit au domaine, et cela suffit. Une détection signale, le modérateur décide
(**Q3**).

**RG23** — **Aucun montant chiffré n'est accepté dans un texte libre de campagne.** Le budget se
déclare dans le bloc budget (§F), où il est nommé, borné et accompagné de sa mention. Un montant
glissé dans le brief est le moyen le plus simple de publier un « net créateur » déguisé et de créer
exactement le malentendu de 35 % que tout le produit cherche à éviter (`CLAUDE.md` §3). La détection
signale tout nombre accompagné d'un symbole ou d'un code de devise ; le modérateur décide, et le
refus porte le motif « montant dans un texte publié ».

### C — Bloc 2 : produit, dotation et divulgation

**RG24** — Le bloc « produit » comporte **exactement** ces champs :

| Champ | Caractère | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Produit ou service concerné | **Obligatoire** | Publiée | Texte **modéré**, 20 à 600 caractères | Un créateur ne juge pas une campagne sur un secteur : il la juge sur le produit |
| Catégorie de produit | **Obligatoire** | Publiée | Liste fermée `reference.sectors`, 1 choix | Rapprochement futur avec les thématiques ; déclenche l'exclusion silencieuse de RG86 et la revue renforcée de RG85 |
| Messages clés | Recommandé | Publiée | 1 à 5 puces **modérées**, 10 à 200 caractères chacune | Ce que la marque veut entendre dire ; évite trois allers-retours en négociation |
| Interdits et points de vigilance | Recommandé | Publiée | Texte **modéré**, ≤ 1 000 caractères | Ce que la marque refuse de voir ; deuxième cause de contenu rejeté après livraison |
| Produit envoyé au créateur | **Obligatoire** | Publiée | Oui / non | Conditionne l'éligibilité (frais et logistique) **et** l'obligation de divulgation (RG32) |
| Valeur du produit envoyé | **Obligatoire si produit envoyé** | Publiée | **Tranche** `reference.price_bands` + devise | Un créateur ne peut pas juger une dotation sans son ordre de grandeur. **Jamais une valeur exacte** |
| Le créateur conserve le produit | **Obligatoire si produit envoyé** | Publiée | Oui / non (à rendre) | Un produit à rendre n'est pas une rémunération |
| Frais d'envoi et de retour | **Obligatoire si produit envoyé** | Publiée | Liste fermée : à la charge de la marque · à la charge du créateur | Petit champ, gros litige |

**RG25** — La **catégorie de produit** utilise le référentiel `reference.sectors`, **le même que le
secteur d'activité de la marque** (`06` RG15) et que les **secteurs refusés** d'un créateur
(`07` RG75). Deux vocabulaires rendraient l'exclusion silencieuse de RG86 impossible.

**RG26** — La catégorie de produit **peut différer du secteur d'activité de la marque** : une agence
mandatée, un distributeur ou une marque multi-produits sont des cas normaux. Une divergence **alerte
le modérateur**, elle ne refuse jamais automatiquement.

**RG27** — Les **messages clés** sont des puces, pas un paragraphe. Une marque qui ne sait pas
formuler trois messages clés n'a pas de brief : elle a une intention.

**RG28** — Les **interdits et points de vigilance** énoncent ce que la marque refuse (termes
interdits, concurrents à ne pas citer, allégations à ne pas faire). Ils ne peuvent **jamais** porter
sur la personne du créateur (RG48) ni demander de dissimuler le caractère commercial (RG33).

**RG29** — Le champ **« produit envoyé au créateur »** est **obligatoire et sans valeur par défaut** :
ni « oui », ni « non » n'est pré-coché. C'est un champ qui change la nature de l'offre ; le laisser
par défaut reviendrait à le faire déclarer par le produit à la place de la marque.

**RG30** — La **valeur du produit envoyé** est exprimée en **tranche**, avec sa devise, dans le même
référentiel et avec les mêmes bornes que les tarifs des créateurs et les budgets des marques
(`06` RG29, `07` RG66 ; tarifs des créateurs non saisis au pilote, D78). Une valeur exacte n'apporte rien et alimente la négociation.

**RG31** — *Suspendue pour l'affichage au créateur (D78) : voir la note ci-dessous.* **La valeur d'une dotation ne s'ajoute jamais d'elle-même à la fourchette de rémunération
publiée.** Les deux montants sont affichés **séparément et nommés** : « rémunération par créateur » et
« valeur du produit envoyé ». Leur articulation est déclarée par la **nature de la rémunération**
(RG62), jamais déduite par le produit.

> **Régime du pilote (D78).** La valeur du produit envoyé reste **saisie en tranche** par la marque (RG24, RG30) et
> **visible du commercial**, mais elle **n'est pas affichée au créateur** : aucun montant côté créateur au Lot 3. Le
> créateur voit « produit envoyé », « conservé » ou « à rendre » et les frais d'envoi. Le principe de RG31 (jamais
> d'addition, deux montants nommés) vaut pour la fiche commerciale.

**RG32** — Dès qu'une campagne prévoit une rémunération **ou** l'envoi d'un produit, elle affiche au
créateur une **mention fixe** rappelant que la publication devra indiquer son **caractère commercial**
selon les règles du pays du créateur et de l'audience (**D21**). INFLUX ne rédige pas la mention à la
place du créateur et n'en garantit pas la conformité locale : il rappelle l'obligation (**Q7**).

**RG33** — **Une campagne ne peut pas demander au créateur de dissimuler le caractère commercial de
sa publication**, ni de présenter un contenu rémunéré comme un avis spontané. Un brief le demandant
est **refusé** avec le motif typé « demande de dissimulation du caractère commercial ». Ce refus n'est
pas négociable : il engage la responsabilité d'INFLUX autant que celle de la marque.

### D — Bloc 3 : livrables, droits d'usage et exclusivité

**RG34** — Le bloc « livrables » comporte **exactement** ces champs :

| Champ | Caractère | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Réseaux visés | **Obligatoire** | Publiée | Liste fermée `reference.networks`, ≥ 1 | Une campagne TikTok adressée à un profil sans TikTok est une demande morte (facette F3) |
| Livrables | **Obligatoire** | Publiée | Lignes **(réseau, format, quantité)**, ≥ 1 ligne (RG36) | « 2 stories + 1 reel » n'est pas « 3 contenus ». Le malentendu se joue ici |
| Droits d'usage demandés | **Obligatoire** | Publiée | Liste fermée, 1 choix (RG38) | **Première cause de désaccord** en négociation (F14) |
| Durée des droits d'usage | **Obligatoire si droits ≠ aucun** | Publiée | Tranche fermée (RG39) | Des droits sans durée sont des droits illimités, et personne ne les lit ainsi |
| Territoire des droits d'usage | **Obligatoire si droits ≠ aucun** | Publiée | `reference.countries` (≤ 5) **ou** « mondial » | Un achat média mondial n'a pas le même prix qu'un repost local |
| Exclusivité sectorielle demandée | **Obligatoire** | Publiée | Tranche : non · ≤ 1 mois · ≤ 3 mois · négociable | **Deuxième cause de désaccord** (F15). Mêmes bornes que `06` RG27 et `07` (bloc offre) |
| Délai de validation des contenus par la marque | **Obligatoire** | Publiée | Liste fermée : 48 heures · 5 jours ouvrés · 10 jours ouvrés | Le créateur avance sa trésorerie et son calendrier sur cette promesse |
| Consignes de production | Recommandé | Publiée | Rattaché au brief détaillé (RG20) | Pas de champ supplémentaire : le brief suffit |

**RG35** — Les **réseaux visés** sont déduits des lignes de livrables : un réseau sans ligne de
livrable n'existe pas. Il n'y a donc **pas deux saisies** à tenir cohérentes.

**RG36** — Une **ligne de livrable** est un triplet **(réseau, format, quantité)**. Le format
appartient à `reference.formats` et doit être **compatible avec le réseau** (`formats.network_code`).
La quantité est un **entier de 1 à 20**. Deux lignes identiques (même réseau, même format) sont
interdites : la quantité existe pour cela. Les formats sans réseau (`ugc_video`, `ugc_photo`, `formats.network_code` nul, `0201`) se livrent à la marque (RG18) ; leur compatibilité avec le réseau d'une ligne se tranche au Lot 3.

**RG37** — Une campagne comporte **au plus 10 lignes de livrables**. Au-delà, ce n'est plus une
campagne : c'est un contrat-cadre, hors périmètre du MVP.

**RG38** — Les **droits d'usage** sont une liste fermée de **quatre valeurs**, dans cet ordre
croissant de portée :

| Valeur | Ce que la marque obtient |
|---|---|
| Aucun | Le contenu vit sur le compte du créateur, la marque n'en fait rien d'autre |
| Repost organique | La marque republie le contenu sur ses propres comptes, sans budget publicitaire |
| Whitelisting publicitaire | La marque diffuse de la publicité payante **depuis le compte du créateur** |
| Achat média | La marque diffuse le contenu comme sa propre publicité, sur les supports qu'elle veut |

**RG39** — Si les droits d'usage ne sont pas « aucun », la **durée** et le **territoire** sont
obligatoires. La durée est une tranche fermée : **1 mois · 3 mois · 6 mois · 12 mois · illimitée**.
Des droits sans durée n'existent pas dans ce produit.

**RG40** — La combinaison **« achat média » + « illimitée » + « mondial »** est autorisée mais
**signalée au modérateur** et affichée au créateur avec une mention explicite : c'est la condition la
plus lourde du marché, et celle qui est le plus souvent acceptée sans être comprise.

**RG41** — Les droits d'usage, leur durée, leur territoire et l'exclusivité sont des **conditions de
la campagne entière**, pas des attributs d'une ligne de livrable. Une campagne dont le reel et la
story auraient des droits différents est deux campagnes (**écart avec `04` §5.4**, voir Impacts).

**RG42** — L'**exclusivité sectorielle** utilise **exactement** les mêmes bornes que le profil marque
(`06` RG27) et le profil créateur (`07`, bloc offre) : **non · ≤ 1 mois · ≤ 3 mois · négociable**.
Des bornes différentes rendraient tout rapprochement faux, aujourd'hui à la main comme demain par
pondération.

**RG43** — Si le **type de campagne** est « Contenu livré à la marque (UGC) », les droits d'usage **ne
peuvent pas** être « aucun » : la marque ne peut rien faire du contenu qu'elle a commandé. La saisie
est refusée avec un message qui l'explique.

**RG44** — Le **délai de validation des contenus** est une **condition annoncée**, pas un processus
outillé : INFLUX ne reçoit, ne stocke et ne valide **aucun livrable** au MVP. La formulation affichée
le dit sans ambiguïté (« la marque s'engage à répondre sous … »).

**RG45** — **Aucun fichier n'est attaché à une campagne au MVP** : ni moodboard, ni charte, ni
cahier des charges, ni image d'illustration. Trois raisons : le coût de modération visuel par visuel
(`07` RG78), le risque de coordonnée ou de code à scanner incrusté dans une image, et l'absence de
gain mesuré (**Q4**).

### E — Bloc 4 : audience visée

**RG46** — Le bloc « audience visée » comporte **exactement** ces champs :

| Champ | Caractère | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Pays ou zones visés | **Obligatoire** | Publiée | `reference.countries`, ≤ 5 | **Le critère le plus décisif** : une audience hors marché annule toute pertinence thématique (F6) |
| Langues de publication attendues | **Obligatoire** | Publiée | `reference.languages`, ≥ 1 | Condition d'exécution du brief (F8) |
| Thématiques visées | **Obligatoire** | Publiée | `reference.topics`, **1 à 3 choix** | Premier réflexe d'un créateur comme d'un commercial (F1, F2) |
| Taille d'audience souhaitée | Recommandé | Publiée | **Tranches** `reference.audience_bands`, multi-choix : nano · micro · mid · macro · méga | Détermine le budget et le type de campagne (F4). **Jamais un nombre exact** |
| Tranches d'âge de l'audience | Recommandé | Publiée | Multi-choix : 18-24 · 25-34 · 35-44 · 45 et plus | Adéquation au produit (F10) |
| Répartition de genre **de l'audience** | Recommandé | Publiée | Liste fermée : majorité féminine ≥ 60 % · mixte · majorité masculine ≥ 60 % | Standard du média-planning (F9). **Porte sur l'audience, jamais sur le créateur** |

**RG47** — **Toutes les données de ce bloc portent sur la composition de l'audience visée, jamais sur
la personne du créateur** (`matching-spec` A12). Aucun libellé d'écran, aucune aide, aucune
explication ne doit pouvoir être lue comme un critère portant sur le créateur lui-même.

**RG48** — **Aucune campagne ne peut exprimer un critère portant sur la personne du créateur** : âge,
genre, origine, apparence, état de santé, convictions, orientation, situation familiale. L'interdiction
porte sur **les champs** (aucun n'existe) **et sur les textes libres** : une détection signale les
formulations correspondantes, et le modérateur refuse avec le motif typé « critère portant sur la
personne du créateur ». **Hypothèse conservatrice retenue : refus, pas avertissement** (**Q5**).

**RG49** — Les **pays visés** utilisent le même référentiel que le **pays principal d'audience** d'un
créateur (`07`, bloc audience) et que les **marchés visés** d'une marque (`06` RG23). Le plafond de 5
est identique à celui du profil marque.

**RG50** — Les **tranches d'audience** utilisent **exactement** les codes et les bornes de
`reference.audience_bands`, les mêmes que ceux du profil créateur (`07`, bloc réseaux). Les bornes
numériques ne sont écrites nulle part à ce jour : elles doivent l'être une seule fois, dans le
référentiel (**Q8**).

**RG51** — Les **tranches d'âge** sont **exactement** 18-24, 25-34, 35-44, 45 et plus (`07` RG60).
**Aucune tranche en dessous de 18 ans n'existe.** Une campagne qui viserait explicitement une audience
mineure, dans un champ ou dans un texte, est **refusée** avec un motif dédié : ce sujet n'est pas
ouvert au MVP (**D15**, **D21**).

**RG52** — La **répartition de genre de l'audience** est facultative et **sans valeur pré-cochée**.
Son absence signifie « indifférent » et s'affiche ainsi ; aucune valeur n'est choisie par défaut à la
place de la marque (même principe que `06` RG34).

**RG53** — Le ciblage d'audience d'une campagne **ne filtre rien et n'exclut personne au MVP** : il
décrit une préférence, il ne conditionne ni la visibilité de la campagne, ni la recevabilité d'une
candidature. Un créateur qui ne correspond pas au ciblage **voit la campagne** et **peut candidater**.
Le rapprochement est fait par le commercial (**D11** reportée).

**RG54** — Les **thématiques visées** utilisent `reference.topics`, le même référentiel que les
thématiques d'un créateur (`07` RG33) et les thématiques recherchées d'une marque (`06` RG27). Le
plafond de 3 est identique.

### F — Bloc 5 : budget

> **C'est le bloc le plus dangereux du document.** Un chiffre mal nommé ici produit exactement le
> malentendu de 35 % que `CLAUDE.md` §3 désigne comme le point UX le plus sensible du produit.

> **⚠️ Régime du pilote, Lot 3 (D78, extension tranchée par le fondateur le 2026-11-13, option A) : aucune fourchette
> annoncée aux créateurs.** Les coûts se négocient avec le commercial. Au pilote, le bloc se lit ainsi :
>
> - **Tranche de budget par créateur** : choisie par la marque dans `reference.price_bands`, dans la devise de la
>   campagne ; **obligatoire**, sauf nature « dotation seule » (RG63) ; même assiette que RG56 (coût total pour
>   l'annonceur, commission INFLUX incluse) ; libellé côté marque `campaign.budget.bandBrand` (RG109). **Interne** :
>   visible de la marque qui l'a déclarée et des agents INFLUX, **jamais servie au rôle créateur**, pas même vide (même
>   contrôle que RG65, absente de l'instantané publié). Elle remplace les lignes « minimum » et « maximum » de RG55,
>   dont la saisie est suspendue.
> - **Devise, nature de la rémunération, nombre de créateurs recherchés, budget total interne** : inchangés (RG55,
>   RG58, RG62, RG65, RG66).
> - **Ce que voit le créateur** : la nature de la rémunération (RG62), c'est-à-dire le type de contrepartie (le
>   « rémunérée, dotation, contrepartie seule » de D78 se lit sur ses quatre valeurs, inchangées), suivie de la mention
>   « À négocier avec votre commercial » (`campaign.budget.negotiate`). **Aucun montant**, aucune tranche, aucun net.
>
> **Suspendues (D78), jamais supprimées :** les lignes « minimum » et « maximum » de RG55, RG57 côté créateur, RG59,
> RG60 (déjà suspendue par D48), RG63 pour la valeur publiée, RG64 pour la fourchette estimée (remplacée par la tranche
> interne), RG67 et RG68. RG56 vaut pour la tranche déclarée ; sa comparaison avec le tarif indicatif d'un créateur
> est suspendue (`07` §G). Restent en vigueur : RG58 (devise unique, sans conversion), RG61, RG62, RG65, RG66.
> Réversible : colonnes et tables gardées (`04` §5.4) ; rangement de la tranche à instruire par `expert-database`
> (écart 13, **Q16**).

**RG55** — *Lignes « minimum » et « maximum » suspendues (D78) : remplacées au pilote par la tranche de budget par
créateur, interne (bandeau ci-dessus).* Le bloc « budget » comporte **exactement** ces champs :

| Champ | Caractère | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Rémunération par créateur — minimum | **Obligatoire** | **Publiée** | Montant > 0 | Première cause d'échec en négociation (F12) |
| Rémunération par créateur — maximum | **Obligatoire** | **Publiée** | Montant ≥ minimum | Idem |
| Devise | **Obligatoire** | **Publiée** | `reference.currencies`, 1 choix | Une fourchette sans devise n'existe pas |
| Nature de la rémunération | **Obligatoire** | **Publiée** | Liste fermée, 1 choix (RG62) | « 500 € » et « 500 € de produits » ne sont pas la même offre |
| Nombre de créateurs recherchés | **Obligatoire** | **Publiée** | Entier, 1 à 50 | Le créateur juge sa chance ; le commercial dimensionne son travail |
| **Budget total de la campagne** | Recommandé | **INTERNE — jamais publié** | Montant > 0, même devise | Le commercial doit savoir jusqu'où la marque peut aller |

**RG56** — *Au pilote (D78) : vaut pour la tranche de budget déclarée ; la comparaison avec le tarif indicatif d'un
créateur est suspendue.* **La fourchette de rémunération par créateur est le coût total pour l'annonceur,
commission INFLUX incluse** (`CLAUDE.md` §2). C'est **la même assiette et les mêmes bornes** que le
**tarif indicatif d'un créateur** (`07` RG65) et que le **budget indicatif par collaboration** d'une
marque (`06` RG27). Sans cette identité, les trois valeurs seraient incomparables et tout
rapprochement, humain comme futur, serait faux.

**RG57** — *Côté créateur, suspendue (D78) ; le libellé côté marque vaut pour la tranche.* Le libellé du champ énonce la consigne **avant** la saisie, côté marque : **« Indiquez ce
que vous payez au total, commission INFLUX incluse. »** Côté créateur, le même montant est intitulé
**« ce que la marque paie au total »**. Les deux libellés sont figés et traduits (RG109).

**RG58** — La **devise est unique par campagne** et **aucune conversion n'est effectuée** (**D27**
ouverte). Si la devise d'un créateur diffère, les deux valeurs sont affichées côte à côte, chacune
avec sa devise, sans rapprochement automatique et sans taux.

**RG59** — *Suspendue (D78) : la tranche est déclarée par la marque, non dérivée ; ni filtre de montant dans la
recherche de campagnes, ni net affiché.* Le système **dérive et stocke les tranches `reference.price_bands` couvertes** par la
fourchette saisie. Cette dérivation sert deux usages : le **filtrage** dans la recherche de campagnes
(second volet du Lot 3) et l'**affichage du net créateur estimé** (RG60). **Aucune multiplication d'un
montant par un taux n'est effectuée dans le code applicatif** : les bornes nettes sont des colonnes
du référentiel des tranches (`07` RG72), ce qui préserve l'interdiction structurelle de `03` C(32) et
le contrôle d'intégration continue T16.

**RG60** — *Suspendue (D48, puis D78).* Partout où la fourchette est affichée **à un créateur**, les **trois notions sont nommées
côte à côte**, toujours avec leur devise :

| Notion | Libellé affiché au créateur | Exemple sur une fourchette 1 000 – 2 000 EUR |
|---|---|---|
| **Rémunération par créateur** | « Ce que la marque paie au total » | 1 000 – 2 000 EUR |
| **Commission INFLUX (35 %)** | « Commission INFLUX : 20 % à la charge de la marque, 15 % à votre charge » | 350 – 700 EUR |
| **Net créateur estimé** | « Ce que vous percevez, estimation » | environ 650 – 1 300 EUR |

Le net estimé est **issu des bornes nettes du référentiel des tranches couvertes**, jamais d'un calcul
en ligne ; il porte pour cette raison le mot « environ » (**Q1**).

**RG61** — **Le net créateur estimé n'est jamais affiché à un annonceur**, en aucun écran, en aucune
réponse. Ce qui concerne l'annonceur est le coût total ; la répartition est expliquée par les pages
publiques et les CGU, pas par une campagne. Symétrie exacte avec `06` RG32 et `07` RG70.

**RG62** — La **nature de la rémunération** est une liste fermée de **quatre valeurs** :

| Valeur | Ce que le créateur reçoit | Conséquence |
|---|---|---|
| Rémunération en numéraire | De l'argent uniquement | Cas standard |
| Rémunération en numéraire **et** dotation | De l'argent **et** un produit conservé | « Produit envoyé » doit valoir oui (RG29) |
| Dotation seule | Un produit conservé, sans argent | RG63 s'applique |
| Affiliation | Une part des ventes générées | RG64 s'applique |

**RG63** — *Au pilote (D78), la valeur du produit n'est pas publiée : le créateur voit « dotation seule » et la
mention « À négocier avec votre commercial ».* Si la nature est **« dotation seule »**, la fourchette de rémunération en numéraire est
**absente**, et c'est la **valeur du produit envoyé** (RG24) qui est publiée à sa place, sous son
propre nom. **Aucune commission n'est affichée ni suggérée sur une dotation** : la question de savoir
si une collaboration sans argent entre dans l'assiette des 35 % relève du fondateur et n'est pas
tranchée (**Q13**). Tant qu'elle ne l'est pas, le produit n'affirme rien.

**RG64** — *Au pilote (D78) : une tranche de budget estimée, interne, remplace la fourchette estimée.* Si la nature
est **« affiliation »**, une **fourchette estimée reste obligatoire** : sans
ordre de grandeur, l'offre est inévaluable et la campagne ne sert à rien. Le mécanisme (taux, durée,
support de suivi) est décrit dans le brief. INFLUX **ne suit aucune vente** et **ne mesure aucune
commission d'affiliation** au MVP (**A1**, **Q14**).

**RG65** — *Au pilote (D78), le même contrôle couvre la tranche de budget par créateur.* Le **budget total de la
campagne** est une **donnée interne** : il n'apparaît **jamais**
dans une réponse servie au rôle créateur, **pas même vide, pas même nulle**, y compris dans une charge
utile que l'écran n'affiche pas. Le contrôle porte sur la réponse, pas sur l'écran (`04` §5.4,
`03` §3.3). **Un budget total publié invite à l'ancrage et révèle la position de négociation de la
marque** : c'est la raison d'être de ce champ interne.

**RG66** — Le **nombre de créateurs recherchés** est publié. Il est plafonné à 50 : au-delà, il s'agit
d'une opération de masse qui relève d'un accompagnement commercial, pas d'un formulaire.

**RG67** — *Suspendue (D78) : aucune fourchette n'est affichée ; la mention « À négocier avec votre commercial » la
remplace.* Toute fourchette affichée est accompagnée, partout où elle apparaît, d'une **mention
fixe** : **« Fourchette indicative pour cette campagne. Elle ne vaut pas engagement : le montant se
négocie dans la conversation. »** Aucun écran n'affirme « hors taxes » ni « taxes comprises » tant que
**D7** est ouverte (`07` RG71).

**RG68** — *Suspendue (D78) : aucune fourchette exacte n'est saisie.* Contrôles de vraisemblance : le minimum est **strictement positif**, le maximum est
**supérieur ou égal** au minimum, et un rapport maximum / minimum supérieur à **10** ou un montant
au-delà d'un plafond paramétré **alerte le modérateur** sans jamais refuser automatiquement. Une
fourchette de 100 à 50 000 n'est pas une fourchette : c'est l'absence de budget.

### G — Bloc 6 : calendrier

**RG69** — Le bloc « calendrier » comporte **exactement** ces champs, **quatre dates civiles
distinctes** :

| Champ | Caractère | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Date limite de candidature | **Obligatoire** | Publiée | Date civile | Sans elle, une campagne reste ouverte pour toujours et pourrit le catalogue |
| Date de livraison des contenus | Recommandé | Publiée | Date civile | Ce que le créateur doit tenir ; conditionne sa disponibilité |
| Début de la période de publication | **Obligatoire** | Publiée | Date civile | Une campagne saisonnière hors saison ne vaut rien |
| Fin de la période de publication | **Obligatoire** | Publiée | Date civile | Idem |

**RG70** — L'ordre suivant est **obligatoire et vérifié des deux côtés** :
**date limite de candidature ≤ date de livraison des contenus ≤ début de publication ≤ fin de
publication.** Toute saisie contraire est refusée avec un message nommant les deux dates en conflit.

**RG71** — À la **publication**, aucune des quatre dates ne peut être dans le passé. Une campagne dont
la date limite de candidature est dépassée **au moment de l'examen** n'est **pas publiée** : elle est
renvoyée à la marque avec le motif typé « calendrier dépassé », à corriger et resoumettre. Publier une
campagne avec une date morte est le plus sûr moyen de décrédibiliser le catalogue.

**RG72** — À la **date limite de candidature**, la campagne **cesse automatiquement d'accepter les
candidatures** et l'affiche en toutes lettres. Elle **reste lisible** : une campagne fermée aux
candidatures reste une information utile au créateur comme au commercial. Cette transition est
automatique parce qu'elle ne porte aucun jugement — elle ne contredit pas RG5.

**RG73** — Les quatre dates sont des **dates civiles sans heure** (`04` §4, règle des dates civiles),
interprétées dans le fuseau horaire déclaré de la marque et **affichées au format de la langue du
lecteur** (`CLAUDE.md` §4).

**RG74** — La **durée maximale d'une période de publication est de 12 mois**. Au-delà, il s'agit d'un
contrat d'ambassadeur, qui se renouvelle par une nouvelle campagne — c'est aussi ce qui garantit que
les conditions et les montants restent revus régulièrement.

**RG75** — Un report de la **date limite de candidature** est à **effet immédiat** (RG7) : c'est la
seule date modifiable sans re-validation, parce qu'elle n'altère aucune condition de l'offre. Toute
autre modification de calendrier repasse en validation.

### H — Bloc 7 : candidature

**RG76** — Le bloc « candidature » comporte **exactement** ces champs :

| Champ | Caractère | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Éléments demandés au créateur | Recommandé | Publiée | Liste fermée, multi-choix, ≤ 4 (RG77) | Un créateur qui sait quoi préparer candidate ; sinon il passe |
| Plafond de candidatures | Recommandé | Publiée (l'existence, pas le compteur) | Entier, 1 à 200 | Protège la marque et le commercial d'une file ingérable |
| Campagne réservée aux profils vérifiés | Recommandé | Publiée | Oui / non (RG79) | Rend le badge désirable ; réduit le vivier au pire moment |

**RG77** — Les **éléments demandés** sont une **liste fermée**, sans texte libre : message de
motivation · exemples de contenus déjà réalisés · proposition de concept · tarif proposé pour ce
brief (*suspendu, D78 : aucun tarif proposé au Lot 3, `11` RG54 ; le code reste au référentiel, inactif*) ·
disponibilité sur la période. Un texte libre ici deviendrait un second brief non modéré, et
donc une seconde voie de contournement.

> **Réconciliation avec `11` (tranchée par `chef-de-projet`, 2026-09-19).** Le formulaire de
> candidature est **unique et fixe** (`11` RG47) : ses champs, y compris la motivation **toujours
> obligatoire**, ne varient pas d'une campagne à l'autre — c'est cette invariance qui garantit le
> motif écrit exigé par **A9** sur toute candidature, quelle que soit la campagne. Les « éléments
> demandés » choisis ici sont donc une **mise en avant informative** affichée au créateur au-dessus
> du formulaire (« cette marque attache une importance particulière à : … ») : ils orientent ce que
> le créateur développe, ils **n'ajoutent ni ne suppriment aucun champ**. Une marque ne peut pas
> désactiver la motivation.

**RG78** — Le **plafond de candidatures**, s'il est renseigné, **clôture la campagne** lorsqu'il est
atteint (RG9). La campagne affiche alors « fermée aux candidatures », sans indiquer de compteur.

**RG79** — L'option **« réservée aux profils dont l'audience est vérifiée »** existe en base dès ce
lot, mais elle est **désactivée par paramètre** tant que la masse critique de **D38** n'est pas
atteinte (`08` RG18). Quand elle est désactivée, **le champ n'est pas affiché à la marque** : un
interrupteur visible mais inopérant est pire qu'un champ absent. L'activation est un **paramètre en
table**, jamais un déploiement (**Q10**).

**RG80** — La campagne annonce en toutes lettres que **candidater n'ouvre aucune conversation** : une
candidature est examinée par un commercial INFLUX, qui décide de l'ouverture de la mise en relation
(**A9**). Laisser croire à un contact direct produirait un abandon massif au premier écran du Lot 4.

**RG81** — **Une campagne ne comporte aucun moyen de contacter la marque** : aucun bouton, aucune
adresse, aucun lien, aucun formulaire externe, aucune coordonnée d'interlocuteur (`06` RG40). Le seul
geste possible est la candidature, et elle passe par INFLUX.

**RG82** — **Le nombre de candidatures déjà déposées n'est jamais affiché à un créateur** : ni
compteur, ni jauge, ni « plus que 3 places ». Il crée une course, décourage les profils solides et
n'apporte aucune information vérifiable. Il reste visible de la marque et du commercial (**Q15**).

### I — Bloc 8 : interne, secteurs sensibles et backoffice

**RG83** — Le bloc « interne » comporte **exactement** ces champs, **jamais visibles d'un créateur,
dans aucun cas** :

| Champ | Qui le renseigne | À quoi il sert |
|---|---|---|
| Budget total de la campagne | La marque | Le commercial sait jusqu'où elle peut aller (RG65) |
| Référence interne de la marque | La marque | Confort de gestion |
| Notes internes | Un agent ou un admin | Qualification commerciale |
| Commercial responsable | Un agent ou un admin | Attribution de l'affaire |
| Agent validateur et date de décision | Le système, à la décision | Traçabilité |
| Motif de refus | L'agent décideur | Traçabilité et statistiques |
| Second validateur (revue renforcée) | Un admin ou un second agent | Traçabilité de la double validation (RG85) |

> **Le budget total et la référence interne sont visibles de la marque qui les a saisis et d'INFLUX.
> Ils ne sont visibles d'aucun créateur.** « Interne » ne veut pas dire « interne à INFLUX » : il veut
> dire « jamais publié ». Au pilote, la **tranche de budget par créateur** suit le même régime (D78, bandeau de §F).

**RG84** — Le **caractère sensible** d'une campagne se lit sur `reference.sectors.is_sensitive`
(`04` §5.4) et **n'est jamais recopié sur la campagne**. La liste fermée des secteurs sensibles au
MVP est : **alcool · jeux d'argent · CBD · finance · santé · crypto · contenu adulte** (**Q6**).

**RG85** — Une campagne dont la catégorie de produit est **sensible** déclenche une **revue
renforcée**, et elle seule :

1. La marque coche une **case non pré-cochée** : « Je déclare détenir les autorisations nécessaires
   pour promouvoir ce produit dans les pays visés et respecter les règles de publicité qui s'y
   appliquent. » La déclaration est horodatée et conservée.
2. La décision de publication exige **deux personnes** : un `admin`, ou un `agent` approuvé par un
   second rôle interne distinct. Le second validateur est enregistré nommément.
3. Le délai cible passe à **2 jours ouvrés** (RG6).

**RG86** — Une campagne dont la catégorie de produit figure parmi les **secteurs refusés** d'un
créateur (`07` RG75) est **absente** de la recherche de campagnes de ce créateur : **aucun message,
aucun emplacement grisé, aucun décompte** (`matching-spec` A8). L'exclusion est silencieuse dans les
deux sens, et la marque n'en est jamais informée.

**RG87** — Le backoffice expose une **file « campagnes à valider »**, distincte des files de profils
(`06` RG63, `07` RG92), triée par ancienneté croissante, avec pour chaque entrée : marque, titre,
catégorie, mention de revue renforcée, date de soumission, ancienneté, champs modifiés depuis la
dernière validation, alertes de détection, alerte de doublon, agent ayant pris l'entrée en charge.

**RG88** — Une entrée est **prise en charge** par un agent avant d'être traitée. Un **verrou** empêche
deux agents de traiter la même entrée : le second voit « déjà prise en charge par … », jamais une
erreur technique. Une prise en charge expire automatiquement au bout de **30 minutes** sans décision
et retourne dans la file.

**RG89** — Une décision est **toujours** l'une des deux suivantes : publier, ou refuser avec un motif
typé. Il n'existe pas de troisième voie silencieuse, ni de mise en attente indéfinie.

**RG90** — La liste des motifs de refus d'une campagne est **fermée** (`campaigns.rejection_reasons`) ;
chaque motif porte le message envoyé à la marque, dans sa langue :

| Motif | Message à la marque | Ce qu'elle peut faire |
|---|---|---|
| Coordonnée directe dans un texte publié | « Votre campagne contient une adresse, un numéro, un lien ou une invitation à vous contacter en dehors d'INFLUX. » | Corriger et resoumettre |
| Montant dans un texte publié | « Un montant figure dans votre texte. Les montants se déclarent dans le bloc budget, où ils sont affichés avec la commission. » | Corriger |
| Lien ou code à scanner | « Les liens ne sont pas acceptés dans une campagne. Votre site figure déjà sur votre profil. » | Retirer |
| Brief insuffisant | « Votre brief ne permet pas à un créateur de comprendre ce que vous attendez. » | Compléter |
| Livrables incohérents | « Les formats demandés ne correspondent pas aux réseaux visés. » | Corriger |
| Budget incohérent | « La fourchette annoncée n'est pas exploitable en l'état. » | Corriger |
| Calendrier dépassé ou incohérent | « Les dates de votre campagne ne sont plus valides. » | Corriger |
| Critère portant sur la personne du créateur | « Votre campagne exprime un critère portant sur la personne du créateur (âge, genre, apparence…). Le ciblage porte sur l'audience, jamais sur le créateur. » | Corriger |
| Demande de dissimulation du caractère commercial | « Une campagne ne peut pas demander de présenter un contenu rémunéré comme un avis spontané. » | Corriger |
| Autorisations manquantes en secteur sensible | « Nous n'avons pas pu vérifier vos autorisations pour ce type de produit. » | Contacter INFLUX |
| Contenu illicite ou contraire aux CGU | Message dédié selon le cas | Selon le cas |
| Doublon d'une campagne déjà publiée | « Une campagne identique est déjà publiée. » | Clôturer ou modifier |
| Autre | Message rédigé par l'agent, en complément d'une explication | Contacter INFLUX |

*Au pilote (D78) : « Montant dans un texte publié » se lit « Un montant figure dans votre texte. Les montants se
déclarent dans le bloc budget, qui n'est jamais publié. » ; « Budget incohérent » vise la tranche de budget déclarée.*

**RG91** — Le motif **« Autre » est exceptionnel et surveillé** : s'il dépasse **10 % des refus** sur
un mois, la liste est incomplète et doit être étendue.

**RG92** — Un commentaire libre est autorisé **en complément** d'un motif typé, jamais à sa place.

**RG93** — Toute décision (publication, refus, dépublication, mise en pause d'autorité, clôture par un
rôle interne, correction) est **journalisée nominativement** et **notifiée à l'annonceur** par un
e-mail transactionnel dans sa langue. Une décision non notifiée est une décision invisible, donc
contestable.

**RG94** — Un agent peut **corriger** un champ d'une campagne, ou **créer une campagne pour le compte
d'une marque** qui l'a appelé (`03` C(7)). Toute intervention enregistre l'ancienne et la nouvelle
valeur, exige un motif, est journalisée nominativement, et **l'annonceur en est informé**. Un agent
qui modifie une campagne sans trace est indistinguable d'une falsification.

**RG95** — À la soumission, le système **alerte** l'agent si la **même marque** a déjà une campagne
publiée avec un titre normalisé identique **et** une période de publication qui se recouvre. L'alerte
est informative : **le refus pour doublon reste une décision humaine**.

**RG96** — Le tableau de bord du backoffice affiche : campagnes en attente de validation, ancienneté
de la plus ancienne, nombre en revue renforcée, délai médian de traitement, répartition des refus par
motif, campagnes publiées sans aucune candidature depuis 7 jours (cible de relance commerciale) et
campagnes dont la date limite de candidature tombe dans les 3 jours.

**RG97** — Le commercial responsable d'une campagne est **attribué explicitement** (`owner_agent_id`).
Une campagne publiée sans commercial responsable remonte en alerte : c'est une campagne que personne
ne vendra.

### J — Ce qu'un créateur voit d'une campagne

**RG98** — Tableau de référence, champ par champ :

| Champ | Visible d'un créateur |
|---|---|
| Titre, type de campagne, résumé public, brief détaillé | **Oui** |
| Produit concerné, catégorie, messages clés, interdits et points de vigilance | **Oui** |
| Produit envoyé, valeur en tranche, conservé ou à rendre, frais d'envoi | **Oui**, sauf la valeur en tranche : **non au pilote** (D78) |
| Livrables (réseau, format, quantité), droits d'usage, durée, territoire, exclusivité, délai de validation | **Oui** |
| Pays visés, langues, thématiques, tranches d'audience, tranches d'âge, genre de l'audience | **Oui** |
| Rémunération par créateur (fourchette), devise, nature, **net créateur estimé** | Au pilote, **la nature seulement**, avec « À négocier avec votre commercial » ; fourchette, devise et net **suspendus** (D78, D48) |
| **Tranche de budget par créateur** (D78) | **Jamais** |
| Nombre de créateurs recherchés | **Oui** |
| Dates : limite de candidature, livraison, période de publication | **Oui** |
| Éléments demandés, campagne réservée aux profils vérifiés | **Oui** |
| Profil marque publié : nom, logo, secteur, taille, pays, site, présentation, badge et sa date, **fonction** de l'interlocuteur | **Oui** (`06` RG73) |
| **Budget total de la campagne** | **Jamais** |
| **Référence interne, notes internes, commercial responsable, agent validateur, motif de refus** | **Jamais** |
| **Nombre de candidatures déjà déposées** | **Jamais** (RG82) |
| **Coordonnées de l'interlocuteur de la marque** (prénom, e-mail, téléphone, page de contact) | **Jamais** avant la révélation d'identité (`06` RG38) |
| **Caractère sensible de la catégorie, déclaration d'autorisations, second validateur** | **Jamais** |

**RG99** — Une campagne publiée est lisible de **tout créateur authentifié**, y compris d'un créateur
dont le profil est encore en brouillon (`07` RG7) : consulter les campagnes est ce qui donne envie de
compléter son profil. En revanche, **seul un créateur dont le profil est publié pourra candidater**
(Lot 4).

**RG100** — Une campagne `en pause`, `clôturée` ou `refusée` **ne figure dans aucune réponse servie à
un créateur**. Un créateur qui possède l'adresse d'une campagne dépubliée obtient un refus au niveau
de la base, journalisé — jamais une page vide.

**RG101** — **Aucune notification n'est envoyée à la marque lorsqu'un créateur consulte sa campagne**,
et la marque ne voit jamais qui l'a consultée. Seule une mise en relation validée produit une
notification, au Lot 4.

**RG102** — La marque dispose, dans son espace, d'une **prévisualisation « ce que voit un créateur »**,
qui affiche **exactement** ce que l'interface de service renvoie, jamais une reconstitution
approximative. C'est là qu'une marque constate par elle-même que son budget total n'est pas publié (au pilote, sa tranche de
budget par créateur non plus, D78).

### K — Leads, messages, états d'écran et accessibilité

**RG103** — Un événement **`campaign.published`** est émis à la **première publication** d'une
campagne ; les publications suivantes d'une même campagne (après re-validation) émettent
**`campaign.updated`**. Les deux suivent exactement le pipeline du Lot 1 : émission dans la même
transaction que le fait décrit, charge utile réduite à des identifiants, **consentement relu à la
consommation**.

**RG104** — Attributs enrichis chez **Brevo** (si consentement marketing) : nombre de campagnes
publiées, date de la dernière publication, catégorie de produit de la dernière campagne, **tranche**
de rémunération par créateur (*suspendue, D78 : interne, elle ne part pas, comme le budget total,
RG106*), devise, pays visés, réseaux visés. **Tous sont des tranches, des codes
de liste fermée, des dates ou des compteurs.**

**RG105** — Chez **Apollo.io**, une campagne publiée est le **signal de qualification le plus fort**
qu'un compte annonceur puisse émettre. Ce document n'ouvre **qu'un seul attribut** : « a publié une
campagne » et sa date. Aucun contenu, aucun montant, aucun texte.

**RG106** — **Ne partent jamais vers Brevo ni Apollo** : le budget total, la référence interne, les
notes internes, le motif de refus, la déclaration d'autorisations, et **aucun texte libre de la
campagne** (titre, résumé, brief, produit, messages clés, interdits).

**RG107** — **Un champ absent est envoyé vide, jamais rempli d'une valeur inventée** (règle héritée du
Lot 1).

**RG108** — Chaque écran de ce périmètre possède **quatre états explicites** : repos, chargement,
succès, échec. L'enregistrement de la campagne est **automatique et incrémental** (le brouillon se
sauvegarde seul) ; une marque interrompue ne recommence jamais, y compris au milieu de la saisie des
livrables. La soumission, elle, reste une action explicite.

**RG109** — Tous les messages existent en **français et en anglais** ; aucun n'est écrit en dur.

| Clé | Français | English |
|---|---|---|
| `campaign.publish.missing` | Il manque {count, plural, one {# information} other {# informations}} pour soumettre votre campagne : {fields}. | {count, plural, one {# piece of information is} other {# pieces of information are}} missing to submit your campaign: {fields}. |
| `campaign.publish.profileRequired` | Publiez votre profil de marque avant de soumettre une campagne. | Publish your brand profile before submitting a campaign. |
| `campaign.budget.hintBrand` | Indiquez ce que vous payez au total, commission INFLUX incluse. | Enter the total amount you pay, INFLUX commission included. |
| `campaign.budget.labelCreator` | Ce que la marque paie au total | Total amount paid by the brand |
| `campaign.budget.net` | Vous percevez environ {min} – {max} {currency}. Commission INFLUX 35 % : 20 % à la charge de la marque, 15 % à votre charge. | You receive approximately {min} – {max} {currency}. INFLUX commission 35%: 20% paid by the brand, 15% paid by you. |
| `campaign.budget.notice` | Fourchette indicative pour cette campagne. Elle ne vaut pas engagement : le montant se négocie dans la conversation. | Indicative range for this campaign. It is not a commitment: the amount is negotiated in the conversation. |
| `campaign.budget.totalInternal` | Votre budget total n'est jamais publié. Seule la fourchette par créateur est visible. | Your total budget is never published. Only the per-creator range is visible. |
| `campaign.budget.bandBrand` | Tranche de budget par créateur : ce que vous payez au total, commission INFLUX incluse. Seul votre commercial INFLUX la voit. | Budget band per creator: the total amount you pay, INFLUX commission included. Only your INFLUX account manager sees it. |
| `campaign.budget.negotiate` | À négocier avec votre commercial. | To be negotiated with your account manager. |
| `campaign.budget.internalPilot` | Votre budget n'est jamais publié : seul votre commercial INFLUX le voit. | Your budget is never published: only your INFLUX account manager sees it. |
| `campaign.usageRights.warning` | Cette campagne demande un achat média illimité et mondial. Vos contenus pourront être diffusés sans limite de durée ni de pays. | This campaign requires unlimited worldwide paid media rights. Your content may be used with no time or country limit. |
| `campaign.disclosure.notice` | Cette collaboration est rémunérée ou comporte un produit offert : votre publication devra en indiquer le caractère commercial, selon les règles de votre pays. | This collaboration is paid or includes a gifted product: your post must disclose its commercial nature, according to the rules of your country. |
| `campaign.application.validationNotice` | Candidater n'ouvre pas de conversation : votre candidature est examinée par un commercial INFLUX. | Applying does not open a conversation: your application is reviewed by an INFLUX account manager. |
| `campaign.applications.closed` | Cette campagne n'accepte plus de candidature. | This campaign is no longer accepting applications. |
| `campaign.status.pending` | Votre campagne est en cours de validation par l'équipe INFLUX. | Your campaign is being reviewed by the INFLUX team. |
| `campaign.status.pendingWithPublished` | Vos modifications sont en cours de validation. Votre campagne reste visible dans sa version précédente. | Your changes are being reviewed. Your campaign remains visible in its previous version. |
| `campaign.status.rejected` | Votre campagne n'a pas été publiée : {reason} | Your campaign was not published: {reason} |
| `campaign.status.paused` | Campagne en pause — les candidatures sont suspendues. | Campaign paused — applications are on hold. |
| `campaign.sensitive.declaration` | Je déclare détenir les autorisations nécessaires pour promouvoir ce produit dans les pays visés. | I declare that I hold the authorisations required to promote this product in the countries targeted. |
| `campaign.errors.contactInText` | Votre texte contient ce qui ressemble à une coordonnée directe ou à une invitation à vous contacter hors d'INFLUX. | Your text contains what looks like direct contact details or an invitation to get in touch outside INFLUX. |
| `campaign.errors.amountInText` | Un montant figure dans votre texte. Les montants se déclarent dans le bloc budget. | Your text contains an amount. Amounts belong in the budget section. |
| `campaign.errors.personCriterion` | Le ciblage porte sur l'audience, jamais sur la personne du créateur. | Targeting applies to the audience, never to the creator as a person. |
| `campaign.errors.datesOrder` | {first} doit précéder {second}. | {first} must come before {second}. |

*Au pilote (D78) : `campaign.budget.labelCreator`, `campaign.budget.net` (déjà D48), `campaign.budget.notice` et
`campaign.budget.totalInternal` sont suspendues ; `bandBrand`, `negotiate` et `internalPilot` les remplacent.*

**RG110** — Accessibilité : chaque champ porte une étiquette visible et l'indication de ce qui est
publié ou interne ; un champ en erreur pointe vers son message ; le focus va au premier champ
invalide ; les contrastes respectent WCAG AA ; **le vert de marque n'est jamais le seul porteur d'un
état** — les six états portent chacun un libellé écrit. Toutes les couleurs, tailles et espacements
passent par les tokens (`design-system-influx`).

---

## Cas limites

### Les huit cas limites de la skill `feature-spec`

**1 — Donnée absente ou campagne incomplète**

| Situation | Comportement attendu |
|---|---|
| Un champ obligatoire est vide à la soumission | La liste nominative de ce qui manque s'affiche, le focus va au premier champ, la campagne reste en brouillon (RG4) |
| Le profil marque n'est pas publié | La soumission est refusée **côté serveur**, avec le message `campaign.publish.profileRequired` et le lien vers la publication du profil (RG4) |
| Aucune tranche d'audience souhaitée n'est renseignée | Publication possible : le champ est recommandé, pas obligatoire. La campagne est simplement moins précise |
| Aucune date de livraison des contenus | Publication possible ; la campagne affiche « à convenir » et le brief est invité à le préciser |
| Aucun budget total interne | Publication possible ; la fiche backoffice affiche « budget total non communiqué », visible du commercial |
| La catégorie de produit a été retirée du référentiel | La campagne reste publiée avec sa valeur, une alerte de cohérence remonte au backoffice, la marque est invitée à choisir une catégorie active |
| Un créateur consulte une campagne repassée en validation | Il voit la **dernière version validée** (RG7), jamais une page vide |
| La devise choisie ne dispose d'aucune tranche `price_bands` | La saisie de la fourchette est acceptée, **le net estimé n'est pas affiché**, et l'anomalie remonte au backoffice (RG59). *Au pilote (D78) : aucune tranche ne peut être déclarée ; la soumission est refusée avec le message nommant le champ, et l'anomalie remonte au backoffice (hypothèse prudente, **Q16**)* |

**2 — Valeur nulle, négative ou aberrante**

| Situation | Comportement attendu |
|---|---|
| Rémunération minimum à 0 ou négative | Refus : le minimum est strictement positif. La gratuité se déclare par « dotation seule » (RG62, RG68). *Suspendu (D78) : la marque choisit une tranche* |
| Minimum 2 000, maximum 800 | Refus des deux côtés : le maximum est supérieur ou égal au minimum (RG68). *Suspendu (D78)* |
| Fourchette 100 – 50 000 | **Acceptée**, mais signalée au modérateur (rapport supérieur à 10, RG68). *Suspendu (D78)* |
| Fourchette saisie sans devise | Refus : la devise est obligatoire dès qu'un montant existe (RG55). *Au pilote : vaut pour la tranche, toujours rattachée à une devise (D78)* |
| Budget total inférieur au minimum multiplié par le nombre de créateurs | **Accepté** : c'est une information interne, pas une contrainte. Le commercial le voit et rappelle la marque. *Au pilote : comparé au minimum de la tranche déclarée (D78)* |
| Quantité de livrable à 0 ou à 200 | Refus : entier de 1 à 20 par ligne, 10 lignes au plus (RG36, RG37) |
| Date limite de candidature postérieure au début de publication | Refus, message nommant les deux dates (RG70) |
| Période de publication de 3 ans | Refus au-delà de 12 mois (RG74) |
| Nombre de créateurs recherchés à 0 ou à 500 | Refus : entier de 1 à 50 (RG66) |
| Titre de 300 caractères, brief de 12 000 caractères | Refus avec message dédié, côté navigateur **et** côté serveur (RG14) |
| 6 thématiques visées, 8 pays visés | Refus au-delà de 3 et de 5, message indiquant le plafond |
| Droits d'usage « achat média » sans durée ni territoire | Refus : les deux sont obligatoires dès que les droits ne sont pas « aucun » (RG39) |
| Type « UGC » avec droits d'usage « aucun » | Refus avec message expliquant l'incohérence (RG43) |
| Un montant écrit en toutes lettres dans le brief | **Non détectable de façon fiable.** La détection couvre les nombres accompagnés d'un symbole ou d'un code de devise ; le reste relève de la modération humaine (RG23) |

**3 — Doublon**

| Situation | Comportement attendu |
|---|---|
| Deux campagnes de la même marque, même titre normalisé, périodes qui se recouvrent | **Alerte au modérateur**, aucun refus automatique (RG95) |
| Deux lignes de livrables identiques (même réseau, même format) | Refus à la saisie : la quantité existe pour cela (RG36) |
| La même campagne est soumise deux fois (double clic, deux onglets) | Une seule entrée en file ; la seconde soumission est sans effet |
| Une marque duplique une campagne clôturée | **Autorisé** : la copie repart en `brouillon` et **repasse intégralement par la validation** |
| Deux marques distinctes publient une campagne quasi identique | Aucun rapprochement : ce sont deux offres légitimes |

**4 — Action concurrente**

| Situation | Comportement attendu |
|---|---|
| Deux agents ouvrent la même entrée de validation | Un seul la prend en charge ; le second voit « déjà prise en charge par … » (RG88) |
| Un agent valide pendant que la marque modifie un champ soumis à re-validation | La décision porte sur la version examinée ; la modification postérieure repasse en file avec la mention « modifié après examen » |
| Un agent corrige un champ pendant que la marque le corrige aussi | La dernière écriture gagne, les deux versions sont journalisées, et la marque est informée de la correction de l'agent (RG94) |
| Un admin dépublie pendant qu'un agent valide | La dépublication prime ; la validation est refusée avec un message explicite |
| La marque clôture sa campagne pendant qu'un créateur la consulte | La consultation en cours n'échoue pas ; la campagne disparaît des recherches suivantes ; aucune candidature ne peut plus être créée à partir d'une page périmée |
| Le plafond de candidatures est atteint par deux candidatures simultanées | Le plafond est contrôlé **en base**, pas dans l'application : une seule des deux passe, l'autre reçoit « fermée aux candidatures » |
| Une prise en charge est abandonnée sans décision | Elle expire au bout de 30 minutes et l'entrée retourne dans la file (RG88) |

**5 — Droit insuffisant**

| Situation | Comportement attendu |
|---|---|
| Un créateur demande la charge utile d'une campagne publiée | Le bloc interne **ne figure pas dans la réponse**, pas même vide ni nul (RG65) |
| Un créateur appelle l'adresse d'une campagne en brouillon, en pause, clôturée ou refusée | Refus au niveau de la base, journalisé (RG100) |
| Un annonceur tente de lire ou de modifier la campagne d'une autre marque | Refus : il n'existe aucun chemin de lecture d'une campagne d'un tiers en brouillon, et aucun chemin d'écriture (`03` §3.3) |
| Un annonceur tente de passer lui-même sa campagne en « publiée » | Refus côté serveur : seul un rôle interne publie (RG5) |
| Un agent tente de publier seul une campagne en secteur sensible | Refus : la double validation est exigée (RG85) |
| Un créateur tente d'exporter la liste des campagnes publiées | Refus : l'export est interdit, et les garde-fous anti-aspiration de `03` C(17) s'appliquent aux campagnes comme à l'annuaire |
| Un créateur tente d'accéder au budget total par une route de détail | Refus au niveau de la base : la colonne n'est pas accordée au rôle créateur (`04` §5.4). *Au pilote, la tranche de budget par créateur non plus (D78)* |

**6 — Service externe indisponible**

| Situation | Comportement attendu |
|---|---|
| Brevo ou Apollo indisponibles au moment de `campaign.published` | La publication aboutit, les lignes de synchronisation passent en attente et sont réessayées (pipeline du Lot 1) |
| La base est indisponible pendant l'enregistrement automatique du brouillon | Message honnête, saisie conservée dans le navigateur, nouvelle tentative proposée |
| Le service d'envoi transactionnel est indisponible au moment d'une notification de décision | La décision est enregistrée, la notification est mise en file et réessayée ; l'état est visible au backoffice |
| Le référentiel des tranches est momentanément illisible | La fourchette reste affichée ; **le net estimé n'est pas affiché** plutôt qu'estimé à la volée (RG59) |

**7 — Abandon en cours de parcours**

| Situation | Comportement attendu |
|---|---|
| La marque quitte pendant la saisie | Le brouillon est conservé intégralement (RG108) ; aucune relance automatique sans consentement marketing |
| La campagne reste en brouillon plus de 30 jours | Aucun effet ; le brouillon est **visible du commercial**, qui peut relancer — c'est un besoin exprimé et non publié, donc un lead chaud |
| La marque abandonne après un refus | La campagne reste `refusée` et modifiable ; le motif reste consultable dans son espace |
| La campagne est publiée mais ne reçoit aucune candidature | Après 7 jours, elle remonte au backoffice comme cible de relance commerciale (RG96) — le commercial propose lui-même des créateurs (**A3bis**, Lot 4) |
| La date limite de candidature passe sans qu'aucune décision n'ait été prise | La campagne se ferme aux candidatures automatiquement (RG72) et reste lisible |

**8 — Annulation ou retour en arrière après validation**

| Situation | Comportement attendu |
|---|---|
| La marque met sa campagne en pause après des candidatures | Les candidatures déposées et les mises en relation ouvertes **ne sont pas affectées** (RG8) |
| La marque baisse sa fourchette après des candidatures | La modification **repasse par la validation** (RG7) ; les candidats sont notifiés et peuvent retirer leur candidature (**Q12**) |
| La marque clôture sa campagne alors qu'une mise en relation est ouverte | La mise en relation **subsiste intégralement** : elle vit sa vie propre au Lot 4 |
| Le profil marque est suspendu | Toutes ses campagnes publiées sont dépubliées (RG11) ; les mises en relation ouvertes subsistent |
| Un badge « Marque vérifiée » est retiré | Les campagnes de la marque cessent immédiatement de l'afficher (`06` cas limite 8) ; elles restent publiées |
| Une décision de refus est contestée | La marque corrige et resoumet ; en cas de désaccord persistant, le réexamen est fait par un agent différent du décideur dès que l'équipe compte deux personnes |
| Le compte annonceur est supprimé (Lot 1) | Les campagnes sont dépubliées et anonymisées avec le compte ; les mises en relation et leurs horodatages sont conservés sous forme pseudonyme |

### La checklist INFLUX de la skill `feature-spec`

| # | Contrôle | Réponse pour ce document |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission INFLUX, net créateur | **Traités explicitement et nommément.** La **fourchette de rémunération par créateur est le coût total pour l'annonceur, commission incluse** (RG56), avec la même assiette et les mêmes bornes que `06` RG27 et `07` RG65. Les trois notions sont nommées côte à côte au créateur (RG60) ; le **net estimé n'est jamais montré à l'annonceur** (RG61) ; **aucune multiplication par un taux dans le code** (RG59). Le **budget total est interne** (RG65), la **dotation est un montant distinct** (RG31), et aucun montant n'est accepté dans les textes libres (RG23). Aucun contrat, aucune facture, aucun encaissement (**A1**, RG12). **Au pilote (D78) : tranche de budget interne, aucun montant servi au créateur (bandeau de §F).** |
| 2 | **Traçabilité / contournement** | **Risque de premier rang, traité en RG21 à RG23 et RG81.** Un brief est un texte long lu par tous les créateurs inscrits : aucune coordonnée, aucune URL, aucun code à scanner, aucune pièce jointe (RG45), aucun moyen de contacter la marque depuis la campagne, aucune coordonnée d'interlocuteur (`06` RG40). **Risque résiduel assumé et signalé :** une formulation habile (« notre équipe partenariats répond vite, cherchez-nous ») reste indétectable automatiquement ; la parade est la modération humaine avant publication et le motif de refus dédié. Second risque signalé : **l'interdiction des liens gêne les marques légitimes** et sera contestée (**Q3**) |
| 3 | **Leads** — ce qui part vers Brevo et Apollo, avec quel consentement | Détaillé en RG103 à RG107 : `campaign.published` à la première publication, attributs **exclusivement en tranches, codes, dates et compteurs**, **un seul attribut nouveau chez Apollo** (« a publié une campagne » + date), **liste explicite de ce qui ne part jamais** (RG106), consentement du Lot 1 relu à la consommation |
| 4 | **Backoffice** — contrepartie interne | Détaillée en RG83 à RG97 : file dédiée distincte des files de profils, verrou anti-double-traitement, motifs typés, **double validation en secteur sensible**, création et correction pour le compte d'une marque, journalisation nominative, tableau de bord, relance des campagnes sans candidature |
| 5 | **Matching hybride** | **Aucun algorithme (D11).** Ce document **collecte** les données du côté demande : catégorie, thématiques, réseaux, formats, tranches d'audience, pays, langues, tranche de budget, droits d'usage, exclusivité — **toutes en listes fermées ou en tranches, avec les bornes identiques à celles du profil créateur** (RG42, RG49, RG50, RG51, RG54, RG59). Le **ciblage ne filtre rien au MVP** (RG53) : il informe le créateur et outille le commercial. La voie humaine est spécifiée : validation, revue renforcée, correction, création pour le compte d'une marque, attribution — toutes journalisées. Une seule exclusion est automatique et **silencieuse** : les secteurs refusés par un créateur (RG86) |
| 6 | **Deux populations** | La campagne est **écrite par une marque** et **lue par un créateur** : deux jeux d'écrans, deux jeux de libellés (« ce que vous payez au total » contre « ce que la marque paie au total », RG57 ; libellé côté créateur suspendu au pilote, D78), deux périmètres de champs (RG98). Aucun écran partagé |
| 7 | **Données personnelles** — avis de `expert-conformite-rgpd` | **Obligatoire, avec veto.** Points soumis : **interdiction des critères portant sur la personne du créateur** et régime du refus (**Q5**), **obligation de divulgation** du caractère commercial d'une dotation selon les pays (**Q7**, **D21**), **secteurs sensibles** et règles de publicité par pays (**Q6**, **D21**), interdiction du ciblage d'une audience mineure (RG51, **D15**), conservation de la déclaration d'autorisations (RG85) |

---

## Critères d'acceptation

### Création, états et publication

**CA1** — *Étant donné* une marque dont le profil est publié, *quand* elle crée une campagne, *alors*
celle-ci existe à l'état `brouillon` et **aucun champ ne redemande** le nom, le logo, le secteur, le
pays ni l'interlocuteur déjà portés par le profil.

**CA2** — *Étant donné* une marque dont le profil est en `brouillon`, *quand* elle tente de soumettre
une campagne, *alors* l'action est refusée **côté serveur** avec le message
`campaign.publish.profileRequired`.

**CA3** — *Étant donné* une campagne à laquelle il manque les droits d'usage et la période de
publication, *quand* la marque la soumet, *alors* le message nomme **les deux** champs manquants et la
campagne reste en `brouillon`.

**CA4** — *Étant donné* une campagne complète, *quand* la marque la soumet, *alors* elle passe en
`à valider` et **n'est visible d'aucun créateur**.

**CA5** — *Étant donné* une campagne en `à valider`, *quand* on tente de la publier sans décision
d'un rôle interne, *alors* **la base le refuse** (contrainte `campaigns_published_needs_review`).

**CA6** — *Étant donné* une campagne publiée, *quand* la marque corrige son brief, *alors* elle
repasse en `à valider` **et la version précédente reste visible** des créateurs pendant l'examen.

**CA7** — *Étant donné* une campagne publiée, *quand* la marque reporte la date limite de candidature,
*alors* la modification est visible immédiatement, **sans re-validation**.

**CA8** — *Étant donné* une campagne publiée, *quand* la marque la met en pause, *alors* elle affiche
« en pause », n'accepte plus de candidature, et **les mises en relation ouvertes ne sont pas
affectées**.

**CA9** — *Étant donné* une campagne clôturée, *quand* la marque tente de la rouvrir, *alors*
l'action n'existe pas ; la duplication est proposée à la place, et la copie repart en `brouillon`.

**CA10** — *Étant donné* une marque ayant 10 campagnes publiées, *quand* elle en soumet une onzième,
*alors* la soumission est refusée avec un message nommant les campagnes à clôturer.

**CA11** — *Étant donné* un profil marque suspendu, *quand* un créateur consulte une de ses campagnes,
*alors* la campagne n'est plus accessible et **aucune donnée n'est servie**.

### Textes, contournement et modération

**CA12** — *Étant donné* un brief contenant `partenariats@marque.com`, *quand* la campagne est
soumise, *alors* la détection le signale au modérateur, la campagne n'est pas publiée, et le motif
« coordonnée directe dans un texte publié » est disponible.

**CA13** — *Étant donné* un brief contenant `https://marque.com/brief.pdf`, *quand* la campagne est
soumise, *alors* la détection le signale et le motif « lien ou code à scanner » est disponible.

**CA14** — *Étant donné* un brief contenant « budget 500 € net pour vous », *quand* la campagne est
soumise, *alors* la détection le signale et le motif « montant dans un texte publié » est disponible.

**CA15** — *Étant donné* une campagne publiée, *quand* un créateur la consulte, *alors* **aucun bouton,
aucun lien et aucune adresse ne permettent de contacter la marque**.

**CA16** — *Étant donné* le formulaire de campagne, *quand* on cherche un champ de dépôt de fichier,
*alors* **il n'en existe aucun**.

**CA17** — *Étant donné* un brief demandant de « ne pas mentionner qu'il s'agit d'un partenariat »,
*quand* l'agent l'examine, *alors* il refuse avec le motif « demande de dissimulation du caractère
commercial », et la campagne n'est pas publiée.

### Produit et dotation

**CA18** — *Étant donné* le champ « produit envoyé au créateur », *quand* le formulaire s'affiche,
*alors* **ni « oui » ni « non » n'est pré-coché**.

**CA19** — *Étant donné* « produit envoyé = oui », *quand* la marque soumet sans valeur de dotation,
*alors* la soumission est refusée et le message nomme le champ manquant.

**CA20** — *Suspendu (D78) : le créateur voit « conservé » ou « à rendre », jamais la valeur.* *Étant donné* une
dotation de valeur renseignée, *quand* un créateur consulte la campagne,
*alors* il voit une **tranche** avec sa devise, **jamais une valeur exacte**, et l'information
« conservé » ou « à rendre ».

**CA21** — *Étant donné* une campagne rémunérée ou comportant une dotation, *quand* un créateur la
consulte, *alors* la mention `campaign.disclosure.notice` est affichée.

**CA22** — *Suspendu côté créateur (D78) ; vaut pour la fiche commerciale.* *Étant donné* une valeur de dotation, *quand* on examine l'affichage, *alors* elle **n'est
jamais additionnée** à la fourchette de rémunération : les deux montants sont nommés séparément.

### Livrables, droits d'usage et exclusivité

**CA23** — *Étant donné* une ligne de livrable « Instagram · vidéo TikTok », *quand* la marque
enregistre, *alors* la saisie est refusée : le format doit être compatible avec le réseau.

**CA24** — *Étant donné* deux lignes « Instagram · story », *quand* la marque enregistre, *alors* la
seconde est refusée et le message renvoie vers la quantité.

**CA25** — *Étant donné* des droits d'usage « whitelisting publicitaire » sans durée, *quand* la
marque soumet, *alors* la soumission est refusée : durée et territoire sont obligatoires.

**CA26** — *Étant donné* des droits « achat média », une durée « illimitée » et un territoire
« mondial », *quand* la campagne est examinée, *alors* le modérateur est alerté et le créateur voit la
mention `campaign.usageRights.warning`.

**CA27** — *Étant donné* un type « Contenu livré à la marque (UGC) » et des droits d'usage « aucun »,
*quand* la marque enregistre, *alors* la saisie est refusée avec un message expliquant l'incohérence.

**CA28** — *Étant donné* le champ « exclusivité sectorielle demandée », *quand* on examine ses valeurs,
*alors* ce sont **exactement** : non · ≤ 1 mois · ≤ 3 mois · négociable — **les mêmes que celles des
profils marque et créateur**.

**CA29** — *Étant donné* une campagne publiée, *quand* un créateur la consulte, *alors* les droits
d'usage, leur durée, leur territoire, l'exclusivité et le délai de validation **apparaissent avant
toute action de sa part**, sans dépliage ni page secondaire.

### Audience visée

**CA30** — *Étant donné* le formulaire de campagne, *quand* on cherche un champ d'âge, de genre,
d'origine ou d'apparence **du créateur**, *alors* **il n'en existe aucun**.

**CA31** — *Étant donné* un brief demandant « des créatrices de 18 à 25 ans », *quand* l'agent
l'examine, *alors* il refuse avec le motif « critère portant sur la personne du créateur ».

**CA32** — *Étant donné* les libellés du bloc ciblage, *quand* on les lit, *alors* chacun porte sans
ambiguïté sur **l'audience**, jamais sur le créateur.

**CA33** — *Étant donné* le champ « tranches d'âge de l'audience », *quand* on examine ses valeurs,
*alors* ce sont **exactement** 18-24, 25-34, 35-44, 45 et plus, et **aucune valeur en dessous de 18
ans n'existe**.

**CA34** — *Étant donné* le champ « répartition de genre de l'audience », *quand* le formulaire
s'affiche, *alors* **aucune valeur n'est pré-cochée** et l'absence de choix s'affiche « indifférent ».

**CA35** — *Étant donné* un créateur qui ne correspond à aucun critère de ciblage d'une campagne
publiée, *quand* il consulte la recherche de campagnes, *alors* **la campagne lui est visible** : le
ciblage ne filtre rien au MVP.

**CA36** — *Étant donné* un créateur ayant déclaré refuser le secteur « jeux d'argent », *quand* une
campagne de cette catégorie est publiée, *alors* elle est **absente** de sa recherche, **sans message,
sans emplacement grisé et sans décompte**.

### Budget

**CA37** — *Au pilote (D78) : le champ « tranche de budget par créateur ».* *Étant donné* le champ de rémunération
côté marque, *quand* elle le sélectionne, *alors*
l'aide affiche « Indiquez ce que vous payez au total, commission INFLUX incluse » **avant** la saisie.

**CA38** — *Suspendu (D48, D78).* *Étant donné* une fourchette de 1 000 à 2 000 EUR, *quand* un créateur consulte la
campagne, *alors* il lit **les trois notions nommées côte à côte** : ce que la marque paie
(1 000 – 2 000 EUR), la commission INFLUX 35 % avec ses deux parts, et le net estimé (environ
650 – 1 300 EUR).

**CA39** — *Étant donné* la même campagne, *quand* **l'annonceur** la consulte, *alors* **aucun net
créateur estimé n'apparaît**, sur aucun écran.

**CA40** — *Étant donné* le code applicatif, *quand* on cherche une multiplication d'un montant par un
taux, *alors* **il n'en existe aucune** : les bornes nettes proviennent du référentiel des tranches.

**CA41** — *Étant donné* un budget total de 30 000 EUR saisi par la marque, *quand* un créateur
consulte la campagne et que l'on inspecte **la charge utile** de la réponse, *alors* le budget total
**n'y figure pas**, pas même vide ni nul.

**CA42** — *Au pilote (D78) : une tranche sans devise n'est pas proposable.* *Étant donné* une fourchette saisie
sans devise, *quand* la marque enregistre, *alors* la
saisie est refusée.

**CA43** — *Suspendu (D78).* *Étant donné* un minimum de 2 000 et un maximum de 800, *quand* la marque enregistre,
*alors* la saisie est refusée côté navigateur **et** côté serveur.

**CA44** — *Au pilote (D78) : il voit la nature « dotation seule » et la mention « À négocier avec votre
commercial », aucune valeur.* *Étant donné* une nature « dotation seule », *quand* un créateur consulte la campagne,
*alors* il voit la **valeur de la dotation** sous son propre nom, **aucune fourchette en numéraire**
et **aucune mention de commission**.

**CA45** — *Au pilote (D78) : sans tranche de budget déclarée.* *Étant donné* une nature « affiliation » sans
fourchette estimée, *quand* la marque soumet,
*alors* la soumission est refusée.

**CA46** — *Suspendu (D78) : aucune fourchette n'est affichée.* *Étant donné* toute fourchette affichée, *quand* on la lit, *alors* elle porte la mention
`campaign.budget.notice` et **n'affirme ni « hors taxes » ni « taxes comprises »**.

**CA75** *(D78)* — *Étant donné* une campagne dont la marque a déclaré la tranche « 1 000 – 2 000 EUR », *quand* un
créateur la consulte et que l'on inspecte **la charge utile** de la réponse, *alors* ni la tranche, ni la devise du
budget, ni aucun montant n'y figurent, pas même vides ; l'écran affiche la nature de la rémunération et la mention
« À négocier avec votre commercial ».

**CA76** *(D78)* — *Étant donné* une campagne de nature « rémunération en numéraire » sans tranche de budget,
*quand* la marque soumet, *alors* la soumission est refusée et le message nomme le champ manquant ; *quand* la
nature est « dotation seule », *alors* aucune tranche n'est demandée.

### Calendrier

**CA47** — *Étant donné* une date limite de candidature postérieure au début de la période de
publication, *quand* la marque enregistre, *alors* la saisie est refusée et le message nomme les deux
dates.

**CA48** — *Étant donné* une campagne dont la date limite de candidature est dépassée, *quand* l'agent
l'examine, *alors* elle **n'est pas publiée** et elle est renvoyée avec le motif « calendrier
dépassé ».

**CA49** — *Étant donné* une campagne publiée, *quand* la date limite de candidature est atteinte,
*alors* la campagne **cesse d'accepter les candidatures**, l'affiche, et **reste lisible**.

**CA50** — *Étant donné* une période de publication de 18 mois, *quand* la marque enregistre, *alors*
la saisie est refusée au-delà de 12 mois.

**CA51** — *Étant donné* une campagne consultée par un créateur anglophone, *quand* les dates
s'affichent, *alors* elles suivent le format de sa langue.

### Candidature

**CA52** — *Étant donné* le champ « éléments demandés », *quand* on examine ses valeurs, *alors* ce
sont exclusivement des valeurs d'une liste fermée, et **aucun texte libre ne peut y être saisi**.

**CA53** — *Étant donné* un plafond de 20 candidatures atteint, *quand* un créateur consulte la
campagne, *alors* elle affiche « fermée aux candidatures » **sans indiquer de compteur**.

**CA54** — *Étant donné* l'option « réservée aux profils vérifiés » désactivée par paramètre, *quand*
la marque remplit le formulaire, *alors* **le champ n'est pas affiché**.

**CA55** — *Étant donné* une campagne publiée, *quand* un créateur la consulte, *alors* la mention
`campaign.application.validationNotice` lui indique qu'une candidature est examinée par un commercial.

### Validation, secteurs sensibles et backoffice

**CA56** — *Étant donné* une campagne en catégorie « alcool », *quand* la marque la soumet, *alors*
la case de déclaration d'autorisations est exigée, **non pré-cochée**, et sa validation demande
**deux rôles internes distincts**.

**CA57** — *Étant donné* la même campagne, *quand* un agent tente de la publier seul, *alors*
l'action est refusée avec un message explicite.

**CA58** — *Étant donné* une entrée en file de validation, *quand* un premier agent la prend en
charge, *alors* un second voit « déjà prise en charge par … » ; sans décision, l'entrée retourne dans
la file au bout de 30 minutes.

**CA59** — *Étant donné* un refus, *quand* il est enregistré, *alors* un motif typé est obligatoire,
la marque reçoit le message associé dans sa langue, et la campagne reste modifiable.

**CA60** — *Étant donné* un agent qui corrige la catégorie de produit, *quand* il enregistre, *alors*
un motif est exigé, l'ancienne et la nouvelle valeur sont journalisées, et la marque en est informée.

**CA61** — *Étant donné* un agent qui crée une campagne pour le compte d'une marque, *quand* il
enregistre, *alors* l'intervention est journalisée nominativement et la marque en est informée.

**CA62** — *Étant donné* une campagne dont le titre normalisé et la période recouvrent une campagne
déjà publiée de la même marque, *quand* elle arrive en file, *alors* une alerte de doublon est
affichée et **aucun refus automatique** n'est prononcé.

**CA63** — *Étant donné* une campagne publiée sans commercial responsable, *quand* le tableau de bord
s'affiche, *alors* elle apparaît en alerte.

### Ce que voit un créateur, leads et états d'écran

**CA64** — *Étant donné* une campagne publiée, *quand* un créateur la consulte, *alors* il voit le
profil marque dans son état publié, **avec la fonction de l'interlocuteur** et **sans prénom, e-mail,
téléphone ni page de contact**.

**CA65** — *Étant donné* un créateur dont le profil est en `brouillon`, *quand* il consulte les
campagnes publiées, *alors* **il y accède**, et l'écran lui indique qu'il devra publier son profil
pour candidater.

**CA66** — *Étant donné* une campagne clôturée, *quand* un créateur en appelle directement l'adresse,
*alors* l'accès est refusé au niveau de la base et journalisé.

**CA67** — *Étant donné* une campagne publiée, *quand* un créateur la consulte, *alors* **aucune
notification n'est envoyée à la marque** et la marque ne voit jamais qui l'a consultée.

**CA68** — *Étant donné* la prévisualisation « ce que voit un créateur », *quand* la marque l'ouvre,
*alors* elle affiche exactement ce que l'interface de service renvoie, budget total et, au pilote, tranche de
budget par créateur absents compris (D78).

**CA69** — *Étant donné* une première publication de campagne, *quand* elle est enregistrée, *alors*
`campaign.published` est émis et les attributs de RG104 sont mis à jour chez Brevo **si** le
consentement est enregistré.

**CA70** — *Étant donné* une campagne publiée, *quand* on inspecte ce qui part vers Brevo et Apollo,
*alors* **aucun texte libre, aucun budget total, aucune note interne** ni, au pilote,
aucune tranche de budget (D78) n'y figure, et Apollo ne reçoit
que « a publié une campagne » et sa date.

**CA71** — *Étant donné* une marque **sans** consentement marketing, *quand* sa campagne est publiée,
*alors* aucun contact marketing n'est mis à jour, la ligne est marquée « ignoré — sans consentement »
et **n'apparaît pas dans le compteur d'échecs**.

**CA72** — *Étant donné* une saisie en cours, *quand* le navigateur est fermé puis rouvert, *alors* le
brouillon est intégralement retrouvé, **lignes de livrables comprises**.

**CA73** — *Étant donné* chacun des messages de RG109, *quand* la langue de l'interface est l'anglais,
*alors* la version anglaise s'affiche, sans aucun texte français résiduel.

**CA74** — *Étant donné* les six états d'une campagne, *quand* ils s'affichent, *alors* chacun porte un
**libellé écrit**, et la couleur n'est jamais le seul porteur de l'information.

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Espace | Écran | Remarque |
|---|---|---|
| Membre marque | Campagnes — liste avec état, candidatures reçues, ancienneté | Six états, six libellés |
| Membre marque | Campagne — bloc identification | Type en liste fermée, compteurs de caractères |
| Membre marque | Campagne — bloc produit et dotation | Dotation conditionnelle, mention de divulgation expliquée avant la saisie |
| Membre marque | Campagne — bloc livrables | **Matrice (réseau × format) + quantité** ; droits d'usage, durée, territoire, exclusivité au même endroit |
| Membre marque | Campagne — bloc audience visée | **Doit rendre impossible la lecture « critère sur le créateur »** (RG47, RG48) |
| Membre marque | Campagne — bloc budget | **Le point le plus sensible** : « ce que vous payez au total » ; budget total visuellement marqué « jamais publié » ; au pilote, choix d'une tranche marquée « vue de votre seul commercial » (D78) |
| Membre marque | Campagne — bloc calendrier | Quatre dates, ordre contrôlé et expliqué |
| Membre marque | Campagne — bloc candidature | Option « profils vérifiés » masquée tant qu'elle est désactivée |
| Membre marque | Déclaration d'autorisations en secteur sensible | Case non pré-cochée, libellé juridique relu |
| Membre marque | **« Ce que voit un créateur »** — prévisualisation | RG102 |
| Membre marque | Bandeau d'état + motif de refus | Six états, six messages |
| Membre créateur | Carte de campagne dans une liste | Titre, type, réseaux, fourchette (au pilote : nature et « À négocier avec votre commercial », D78), date limite, badge de la marque |
| Membre créateur | Fiche de campagne complète | **Trois notions de montant côte à côte** (RG60, suspendu : D48, D78) ; droits d'usage et exclusivité visibles sans dépliage |
| Backoffice | File « campagnes à valider » + fiche de validation | Verrou, ancienneté, alertes de détection, marquage revue renforcée |
| Backoffice | Fiche campagne interne : budget total, notes, historique des décisions, commercial responsable | Vue de travail du commercial |
| Backoffice | Tableau de bord des campagnes | RG96 |

### Données (`expert-database`)

Tables prévues et utilisées : `campaigns.campaigns`, `campaigns.campaign_deliverables`,
`campaigns.campaign_audience_targets`, `campaigns.campaign_topics`, `campaigns.rejection_reasons`,
`audit.audit_events`, `leads.outbox_events`, `reference.sectors`, `reference.networks`,
`reference.formats`, `reference.topics`, `reference.countries`, `reference.languages`,
`reference.currencies`, `reference.price_bands`, `reference.audience_bands`, `reference.usage_rights`.

**Douze écarts constatés avec `docs/mvp/04-modele-de-donnees-mvp.md` §5.4, à instruire :**

1. **Le type de campagne n'a pas de colonne** (RG18). C'est une liste fermée de sept valeurs, et un
   futur critère de rapprochement : elle doit devenir une table de référence versionnée.
2. **Un seul champ texte existe (`product_description` ≤ 4 000) alors que quatre textes distincts sont
   nécessaires** : résumé public, brief détaillé, description du produit, interdits et points de
   vigilance — plus les messages clés, qui sont une table fille (1 à 5 puces). Les fusionner rendrait
   impossible l'affichage court d'une carte de campagne et la modération ciblée.
3. **La dotation n'existe pas** : « produit envoyé », « valeur en tranche + devise », « conservé ou à
   rendre », « frais d'envoi » n'ont aucune colonne (RG24).
4. **`campaign_deliverables` porte `usage_rights_code` et `exclusivity_band` au niveau de la ligne**,
   alors que ce document en fait des **conditions de la campagne entière** (RG41). Il manque en outre
   la **durée** et le **territoire** des droits d'usage. Recommandation : remonter les trois colonnes
   sur `campaigns.campaigns` et ajouter `usage_rights_duration_band` et une table
   `campaign_usage_territories`.
5. **Le calendrier a besoin de quatre dates nommées** : `applications_close_at`, `content_due_on`,
   `starts_on`, `ends_on`. La colonne `publication_deadline` est ambiguë et doit être renommée ou
   scindée ; les contraintes d'ordre de RG70 sont à écrire de façon déclarative.
6. **La nature de la rémunération et le nombre de créateurs recherchés n'ont pas de colonne** (RG62,
   RG66).
7. **La tranche de budget dérivée n'existe pas.** RG59 exige de stocker les codes
   `reference.price_bands` couverts par la fourchette : c'est ce qui permet le filtrage en recherche
   **et** l'affichage du net estimé sans aucun calcul de taux dans le code. *Au pilote (D78), la tranche est
   déclarée par la marque, non dérivée (écart 13).*
8. **`reference.price_bands` doit porter les bornes nettes** (`net_min_minor`, `net_max_minor`) —
   même écart que `07`, point 5. Sans elles, RG60 est impossible sans violer `03` C(32).
9. **Les éléments demandés au créateur (RG77) n'ont pas de table** : liste fermée multi-choix, donc
   table de référence + table de liaison.
10. **`campaign_audience_targets` n'est pas détaillée** dans `04` : elle doit porter les dimensions
    pays, langue, tranche d'audience, tranche d'âge et genre de l'audience, chacune en code de liste
    fermée, **jamais en pourcentage**.
11. **La revue renforcée n'a pas de place** : `reviewed_by_agent_id` est unique et ne permet pas
    d'enregistrer un second validateur ni la déclaration d'autorisations horodatée (RG85).
12. **Six états sont nécessaires** (`brouillon`, `à valider`, `publiée`, `en pause`, `clôturée`,
    `refusée`) — à vérifier contre l'énumération existante de `status`. Et **la conservation de la
    dernière version validée** pendant une re-validation (RG7) est le même écart que celui déjà relevé
    dans `06` et `07` : sans elle, une correction de faute rend la campagne invisible.

**Écart ajouté au pilote (D78, 2026-11-13) :**

13. **Rangement de la tranche de budget déclarée.** `04` §5.4 n'a pas de colonne pour une tranche choisie par la
    marque, et la contrainte `campaigns_cash_range_required` exige la fourchette exacte
    (`per_creator_amount_min_minor`, `per_creator_amount_max_minor`) dès qu'une campagne quitte le brouillon, sauf
    « dotation seule ». Au pilote, cette fourchette n'est plus saisie. À instruire par `expert-database` sous
    `architecte` **avant la migration des campagnes** (aucune table de campagne n'existe encore) : par exemple, porter
    la tranche dans `campaigns.campaign_price_bands` et reformuler la contrainte sur sa présence. Colonnes gardées
    (D78) ; l'instantané publié ne contient ni la tranche ni la fourchette (RG65). Voir **Q16**.

À prévoir également : les paramètres (délai cible de validation standard et renforcé, seuil d'alerte,
expiration d'une prise en charge, plafond de campagnes simultanées, délai de clôture automatique,
activation de l'option « profils vérifiés », plafonds de vraisemblance des montants) vivent **en
table**, modifiables sans redéploiement, chaque modification étant journalisée. Les types d'événements
`campaign.published` et `campaign.updated` sont à ajouter à `audit.event_types`.

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Brevo — contacts** | Mise à jour des attributs de RG104 à chaque publication ; **aucun texte libre** ; aucun envoi marketing sans consentement |
| **Brevo — transactionnel** | Notifications bilingues : campagne publiée, refusée avec motif, dépubliée, corrigée par un agent, clôturée automatiquement, date limite de candidature atteinte |
| **Apollo.io** | **Un seul attribut nouveau** : « a publié une campagne » et sa date (RG105). Périmètre inchangé et paramétrable (**D33** / **A7**) |
| **Supabase Storage** | **Aucun usage** : aucune pièce jointe n'est attachée à une campagne au MVP (RG45) |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| Campagnes publiées / marques dont le profil est publié | Mesuré ; un écart important signale un formulaire trop lourd |
| Délai médian de validation d'une campagne | **Cible 1 jour ouvré**, 2 en revue renforcée, alerte à 3 (RG6) |
| Taux de refus par motif, part du motif « Autre » | « Autre » doit rester sous **10 %** (RG91) |
| Refus pour coordonnée, lien ou montant dans un texte | **Mesure directe de la pression de contournement** ; à croiser avec les signalements du Lot 4 |
| Campagnes publiées sans aucune candidature après 7 jours | Cible de relance commerciale (RG96) |
| Campagnes modifiées après publication, et part repassée en validation | Mesure du coût de la re-validation |
| Part des campagnes en secteur sensible | Suivi ; dimensionne la charge de revue renforcée |
| Répartition des tranches de rémunération publiées (au pilote : tranches de budget déclarées, D78) | Alimente la comparaison avec les tarifs déclarés par les créateurs : **renvoyée en V2** (D78, aucun tarif saisi au pilote) |
| Écart entre la fourchette publiée (au pilote : la tranche déclarée, D78) et le montant réellement négocié | Saisi par le commercial dans le pipeline (**A8**, Lot 5) ; c'est l'indicateur de sincérité des budgets |
| Champs renseignés dans moins de 10 % des campagnes | Candidats au retrait : friction sans contrepartie |
| Campagnes publiées sans commercial responsable | Doit tendre vers zéro (RG97) |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| **Candidature d'un créateur** à une campagne | Objet du **Lot 4**, avec la file de validation (**A9**) | Lot 4 |
| Recherche de campagnes côté créateur : facettes, tri, pagination | Second volet du Lot 3, porté par `expert-matching` | Lot 3, document suivant |
| Mise en relation, conversation, révélation d'identité | **Lot 4** | Lot 4 |
| Contrat, signature, paiement, facture, calcul de commission | **A1** : hors application au MVP | V2, avec **D9** et **D25** |
| Dépôt, validation et stockage des livrables | **RG44** : le délai de validation est une condition annoncée, pas un processus outillé | V2 |
| Statistiques de performance d'une campagne (vues, engagement obtenu) | Suppose une connexion aux API des réseaux, écartée au MVP (`07`, hors périmètre) | Après le pilote |
| Pièces jointes, moodboard, charte, image d'illustration | **RG45** : coût de modération et risque de coordonnée incrustée | Après le pilote (**Q4**) |
| Liens vers le site de la marque dans le brief | **RG22** : voie de contournement ; le domaine figure déjà sur le profil | **Q3** |
| Sélection automatique de créateurs à partir d'une campagne | **D11** reportée ; le rapprochement est fait par le commercial | Après le MVP |
| Campagne multi-devises, conversion de devises | **D27** ouverte (RG58) | V2 |
| Campagne visant une audience de moins de 18 ans | **RG51**, **D15**, **D21** : sujet non ouvert au MVP | Décision du fondateur |
| Notification par e-mail des nouvelles campagnes aux créateurs | Relève des envois Brevo depuis le backoffice, avec consentement | **Lot 5** (**A4**) |
| Compteur public de candidatures | **RG82** : crée une course et décourage les bons profils | **Q15** |
| Plusieurs utilisateurs d'une marque travaillant sur une même campagne | Un compte par marque au MVP (`06`, hors périmètre) | Après le pilote |
| Modèles de campagne, bibliothèque de briefs | Confort sans effet mesuré sur la conversion au pilote | Après le pilote |
| Traduction automatique du brief | La marque écrit dans les langues qu'elle déclare | Après le pilote |
| Portugais et autres langues d'interface | Français et anglais au lancement | Avant l'ouverture du Brésil |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **Affichage du net créateur estimé sur une campagne** : la fourchette est saisie en valeurs exactes, mais les bornes nettes viennent du référentiel des tranches. Est-il acceptable d'afficher un net « environ », dérivé de tranches, à côté d'une fourchette exacte ? L'alternative conservatrice est de n'afficher que la mention « commission INFLUX incluse » | **Oui, net estimé affiché en « environ », issu du référentiel** (RG59, RG60). *Sans objet au pilote : RG59 et RG60 suspendues (D48, D78)* | `expert-paiement-facturation` + `architecte` | **Avant le Lot 3** |
| **Q2** | **Fourchette exacte ou tranche fermée** pour la rémunération par créateur ? La tranche serait plus cohérente avec la règle d'or ; la fourchette exacte est ce qu'une marque sait faire | **Saisie exacte + tranches dérivées** pour le filtrage et le net estimé (RG59). *Tranchée au pilote par D78 : tranche déclarée par la marque, interne* | `chef-de-projet` + `expert-matching` | Lot 3 |
| **Q3** | **Faut-il interdire tout lien dans un brief ?** L'interdiction protège le modèle mais gêne des marques légitimes qui veulent montrer une page produit | **Aucun lien au MVP** (RG22). Réexamen possible : autoriser uniquement un chemin du domaine déjà vérifié de la marque | `chef-de-projet` + `expert-ux`, avis de `product-owner` sur le risque | Lot 3 |
| **Q4** | **Faut-il autoriser une pièce jointe de brief** (moodboard, charte) ? C'est une demande naturelle des marques, et un coût de modération visuel par visuel | **Non au MVP** (RG45) | `chef-de-projet` + `expert-ux` | Après le pilote |
| **Q5** | **Critère portant sur la personne du créateur dans un texte** : refus ferme ou simple avertissement ? Le refus protège ; l'avertissement évite un bras de fer sur des formulations ambiguës | **Refus**, hypothèse conservatrice (RG48) | `expert-conformite-rgpd` (**veto**) + juriste | **Avant le Lot 3** |
| **Q6** | **Liste exacte des secteurs sensibles et procédure de revue renforcée par pays** : les règles de publicité de l'alcool, du jeu, du CBD, de la finance, de la santé et de la crypto diffèrent radicalement d'un pays à l'autre (**D21**) | Liste de sept secteurs (RG84), double validation, déclaration d'autorisations par la marque | `expert-conformite-rgpd` + juristes | Lot 3, puis chaque pays avant son ouverture |
| **Q7** | **Obligation de divulgation du caractère commercial** quand un produit est envoyé : quel libellé, quelle responsabilité pour INFLUX, quelles règles par pays (**D21**) | Mention fixe rappelant l'obligation, sans rédiger la mention à la place du créateur (RG32) | `expert-conformite-rgpd` (**veto**) + juriste | Lot 3 |
| **Q8** | **Bornes numériques des tranches d'audience** (`reference.audience_bands`) : nano, micro, mid, macro, méga sont nommées dans `07` mais leurs bornes ne sont écrites nulle part | À écrire une seule fois, dans le référentiel, et identiques partout (RG50) | `expert-matching` + `product-owner` | **Avant le Lot 3** |
| **Q9** | **Délai de validation d'une campagne** : 1 jour ouvré (**D39**) et 2 jours ouvrés en revue renforcée. Les horaires couverts et le comportement au-delà restent à écrire | Valeurs de départ ci-contre, **en table** (RG6) | **Fondateur** + `chef-de-projet`, dans **D39** | Lot 3 |
| **Q10** | **Campagne réservée aux profils vérifiés** : quand l'activer, sachant qu'elle vide les campagnes tant que **D38** n'est pas atteinte (tension identifiée en `08` Q4) | Option **en base, désactivée par paramètre, champ masqué** (RG79) | `chef-de-projet` + **Fondateur** | **Avant l'ouverture de la recherche** |
| **Q11** | **Plafond de campagnes publiées simultanément par marque** : 10 est-il suffisant pour un annonceur multi-produits ? | **10, en paramètre** (RG15) | `chef-de-projet` | Lot 3 |
| **Q12** | **Modification substantielle d'une campagne ayant déjà reçu des candidatures** : faut-il notifier les candidats et leur permettre de retirer leur candidature ? | **Oui**, notification et retrait possible (RG7) — à spécifier au Lot 4 | `product-owner` + `chef-de-projet` | Lot 4 |
| **Q13** | **Une collaboration en dotation seule entre-t-elle dans l'assiette de la commission ?** Le produit n'affirme rien tant que la réponse n'est pas écrite | **Aucune commission affichée ni suggérée sur une dotation** (RG63) | **Fondateur** + `expert-paiement-facturation` | Avant le Lot 4 |
| **Q14** | **Affiliation** : sans suivi des ventes dans l'application (**A1**), que publie-t-on d'exploitable ? Une fourchette estimée est-elle honnête ? | **Fourchette estimée obligatoire**, mécanisme décrit dans le brief, aucun suivi par INFLUX (RG64). *Au pilote : tranche estimée, interne (D78)* | `expert-paiement-facturation` + **Fondateur** | Lot 3 |
| **Q15** | **Faut-il afficher au créateur le nombre de candidatures déjà déposées ?** L'afficher crée une course ; le cacher prive le créateur d'une information utile | **Non affiché** (RG82) | `product-owner` + `expert-ux` | Lot 4 |
| **Q16** | **(D78) Rangement de la tranche de budget déclarée** : `04` §5.4 exige une fourchette exacte à la publication (`campaigns_cash_range_required`) et n'a pas de colonne de tranche choisie (écart 13) ; que faire d'une devise sans tranche ? | Tranche portée par `campaigns.campaign_price_bands`, contrainte reformulée sur sa présence, fourchette exacte laissée vide ; devise sans tranche : soumission refusée, anomalie au backoffice | `expert-database` sous `architecte` | **Tranchée (`archives/jalons/l3b/modele.md`, L3B-A, 2026-11-13)** : tranche en colonne `per_creator_budget_band_code` (clé `(currency, code)`), sans `campaign_price_bands` tant que D78 tient ; devise sans tranche : soumission refusée (`budget_band`) |
