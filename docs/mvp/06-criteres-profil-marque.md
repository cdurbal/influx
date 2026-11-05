# Lot 2 — Profil marque : contenu, couches de visibilité, vérification et publication

> **Date :** 2026-09-18 · **Auteur :** agent `product-owner` · **Statut :** spécification complète du
> profil marque (Lot 2), soumise à la validation de `chef-de-projet`, avec **avis obligatoire (veto)
> de `expert-conformite-rgpd`** sur les §D (masquage D40), §E (bloc interne) et §Questions ouvertes.
>
> **Skills appliquées :** `feature-spec` (format de sortie), `profile-verification` (badge
> « Marque vérifiée »), `matching-spec` (règle des tranches, champs interdits),
> `design-system-influx` (états d'écran, affichage des montants).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité),
> `docs/mvp/00-cadrage-mvp-v2.md` (périmètre, arbitrages A1 à A10, Lot 2),
> `docs/mvp/03-matrice-des-droits-et-rls.md` §3.2 et §3.3 (conditions C(7) à C(17)),
> `docs/mvp/04-modele-de-donnees-mvp.md` §5.2 (`profiles.advertiser_profiles` et
> `profiles.advertiser_contact_details`) et §4.2 (`reference.*`),
> `docs/mvp/05-spec-inscription-et-leads.md` (ce qui est **déjà collecté** au Lot 1).
>
> **Ce que ce document tranche :** les blocs et les champs exacts du profil marque, la couche de
> visibilité de chaque champ, l'application concrète de **D40**, les champs internes de
> vérification, le badge « Marque vérifiée », le calcul de la complétude et son message, les cinq
> états du profil, la validation par un commercial, et ce qu'un créateur voit d'une marque avant et
> après l'ouverture d'une mise en relation.
>
> **Ce qu'il ne tranche pas :** la maquette et la microcopie (`expert-ux`), le schéma SQL et les
> politiques d'accès (`expert-database`, `expert-cybersecurite`), le contenu d'une campagne (Lot 3),
> la file de validation des mises en relation (Lot 4), les règles de scoring (**D11**, reportée).
>
> **Invariant rappelé :** aucun contrat, aucune facture, aucun encaissement, **aucun calcul de
> commission** n'existe dans ce périmètre (arbitrage **A1**). Le seul montant présent est une
> **tranche de budget indicatif**, qui n'est ni un engagement, ni un prix, ni une assiette de calcul.
>
> **Prolongement du Lot 1 :** ce document ne redemande **jamais** une information déjà collectée à
> l'inscription (`05-spec-inscription-et-leads.md` RG11). Toute redemande serait un défaut.

---

## Besoin

**Permettre à une marque de dire en moins de dix minutes qui elle est, ce qu'elle cherche et à qui
un créateur aura affaire — sans jamais exposer de coordonnée directe tant qu'INFLUX n'a pas ouvert
la mise en relation.**

Trois raisons d'être, dans cet ordre :

1. **Commerciale.** Un créateur qui ne sait pas qui le sollicite ne répond pas. Le profil marque est
   ce qui rend une campagne et une proposition INFLUX crédibles : sans lui, le commercial vend une
   marque anonyme, ce qui est plus difficile que de vendre un créateur anonyme.
2. **Produit.** La campagne (Lot 3) et la mise en relation (Lot 4) n'affichent pas d'identité de
   marque propre : elles affichent **ce profil**. Un profil vide rend les deux lots suivants creux.
3. **Protection du modèle économique.** **D40 est tranchée le 2026-09-18 : le masquage est
   symétrique.** Une adresse e-mail ou un numéro de téléphone affichés sur un profil de marque
   constituent exactement le même vecteur de contournement que le pseudo d'un créateur, dans l'autre
   sens. Ce document est l'endroit où cette décision devient une règle vérifiable.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Annonceur** (titulaire du compte marque) | Complète son profil, le soumet, le corrige, demande le badge « Marque vérifiée », consulte sa complétude |
| **Créateur** | **Lit** un profil marque dans deux contextes seulement : une campagne publiée, une mise en relation ouverte. Il ne recherche jamais une marque |
| **Commercial INFLUX** (rôle `agent`) | Valide ou refuse un profil avec un motif typé, modère les textes et le logo, corrige un champ, instruit la vérification, attribue **ou retire** le badge (retrait sous double validation, voir `03`), appelle l'interlocuteur |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, sans restriction, plus : suspension d'un profil, correction d'un champ interne, export |
| **Système** | Calcule la complétude, détecte les coordonnées dans les textes, détecte les doublons de domaine, émet les événements de leads, périme le badge |
| **Brevo / Apollo.io** (externes) | Reçoivent les attributs d'enrichissement du contact, dans les limites du consentement et du périmètre du Lot 1 |

> **Deux populations, deux parcours.** Ce document ne décrit **que** la marque. Le profil créateur
> fait l'objet du document `07`. Aucun écran n'est partagé entre les deux : ni le formulaire, ni les
> libellés, ni la file de validation, ni les motifs de refus.

---

## User stories

### Annonceur

- **US1** — En tant qu'**annonceur**, je veux décrire ma marque en partant de ce que j'ai déjà donné
  à l'inscription, afin de ne jamais retaper la même information.
- **US2** — En tant qu'**annonceur**, je veux dire ce que je cherche (thématiques, réseaux, formats,
  budget indicatif), afin que les créateurs et le commercial INFLUX sachent immédiatement si mon
  besoin les concerne.
- **US3** — En tant qu'**annonceur**, je veux savoir, champ par champ, qui voit quoi, afin de ne pas
  découvrir après coup qu'une information que je croyais interne est affichée.
- **US4** — En tant qu'**annonceur**, je veux voir ce qu'il me manque pour publier et ce que chaque
  information débloque, afin de ne pas remplir vingt champs sans savoir à quoi ils servent.
- **US5** — En tant qu'**annonceur**, je veux obtenir un badge « Marque vérifiée », afin qu'un
  créateur sache qu'il ne parle pas à une coquille vide.
- **US6** — En tant qu'**annonceur**, je veux corriger une faute sur un profil déjà publié sans
  disparaître pendant l'examen, afin que mes campagnes en cours ne soient pas interrompues.
- **US7** — En tant qu'**annonceur** dont le profil est refusé, je veux comprendre pourquoi et ce
  que je dois changer, afin de pouvoir le resoumettre seul.

### Créateur

- **US8** — En tant que **créateur**, je veux savoir qui est la marque derrière une campagne (nom,
  logo, secteur, taille, ce qu'elle cherche) avant de candidater, afin de ne pas perdre mon temps.
- **US9** — En tant que **créateur**, je veux savoir à quelle fonction j'aurai affaire (partenariats,
  marketing, dirigeant), afin de juger si l'interlocuteur peut décider.
- **US10** — En tant que **créateur**, je veux voir le badge « Marque vérifiée » **et sa date**, afin
  de savoir ce qui a été contrôlé, et quand.

### Commercial et administrateur

- **US11** — En tant que **commercial**, je veux valider ou refuser un profil marque avec un motif
  choisi dans une liste, afin qu'aucun refus ne soit muet et que les motifs soient comptables.
- **US12** — En tant que **commercial**, je veux voir immédiatement les coordonnées de
  l'interlocuteur d'une marque, afin de pouvoir l'appeler — c'est mon métier.
- **US13** — En tant que **commercial**, je veux être alerté quand deux comptes déclarent le même
  domaine, afin de ne pas laisser deux profils concurrents pour une même marque.
- **US14** — En tant qu'**administrateur**, je veux suspendre un profil et retirer un badge avec un
  motif, afin de réagir à un signalement sans supprimer le compte.

### Système

- **US15** — En tant que **système**, je veux qu'aucune coordonnée directe d'une marque ne sorte
  jamais dans une réponse servie à un créateur avant la révélation, afin que le masquage ne dépende
  pas de la discipline d'un développeur.

---

## Règles de gestion

### A — Portée, états et publication

**RG1** — Un compte annonceur porte **un seul profil marque**, créé automatiquement à l'état
**brouillon** à la première connexion suivant l'inscription. Il ne peut être ni dupliqué, ni
supprimé indépendamment du compte.

**RG2** — Le profil **reprend sans les redemander** les informations du Lot 1 : nom de l'entreprise,
pays, langue de communication, adresse e-mail de connexion. Le nom d'entreprise saisi à
l'inscription **est** le nom commercial (RG15) : il est affiché, modifiable depuis le profil, et
toute modification met à jour le compte et émet un `lead.updated`. Il n'existe **pas** deux noms
d'entreprise dans le produit.

**RG3** — Le profil marque connaît **cinq états**, et cinq seulement :

| État | Signification | Qui le déclenche | Visible d'un créateur |
|---|---|---|---|
| `brouillon` | En cours de saisie | L'annonceur (état initial) | Non |
| `en attente de validation` | Soumis, non encore examiné | L'annonceur | Non (ou dernière version validée, RG9) |
| `publié` | Validé par un commercial | Un agent ou un admin | Oui, dans les deux contextes de RG73 |
| `refusé` | Examiné et écarté, avec motif typé | Un agent ou un admin | Non |
| `suspendu` | Retiré par décision interne | Un admin uniquement | Non |

**RG4** — **« Publié » ne veut pas dire « listé ».** Il n'existe **aucun annuaire des marques** : un
créateur ne peut ni rechercher, ni parcourir, ni trier, ni exporter les marques inscrites. Un profil
marque publié n'est lisible que dans les deux contextes de RG73. Le contournement est symétrique :
une liste de marques accessible aux créateurs serait exactement aussi dommageable qu'un export de
l'annuaire de créateurs, qui est interdit à tout le monde (C(17)).

**RG5** — Le passage de `brouillon` à `en attente de validation` est déclenché par l'annonceur
(« Publier mon profil ») et n'est possible que si **tous les champs marqués obligatoires** dans les
tableaux RG15 et RG27 sont renseignés. Le bouton reste visible en permanence, avec la liste
nominative de ce qui manque — jamais désactivé sans explication.

**RG6** — **Aucun profil marque ne devient visible d'un créateur sans décision humaine.** La
publication est prononcée par un rôle `agent` ou `admin`, jamais par un automatisme, jamais par
expiration d'un délai.

**RG7** — L'objectif de délai de validation d'un profil marque est de **1 jour ouvré**, mesuré en
délai médian **et** en délai du 9e cas sur 10. Au-delà de **3 jours ouvrés**, l'entrée remonte en
alerte sur le tableau de bord du backoffice. Ces deux valeurs sont **des paramètres en table**, pas
des constantes (voir **Q6**).

**RG8** — Tant que son profil n'est pas publié, une marque **peut** : compléter son profil, préparer
une campagne en brouillon, utiliser le canal « demander une sélection à l'équipe INFLUX ». Elle **ne
peut pas** : publier une campagne, lancer une recherche de créateurs, demander une mise en relation.

> Cette règle est une protection, pas une friction gratuite : sans elle, un concurrent crée un
> compte, ne publie rien, et parcourt l'annuaire anonymisé sans jamais s'exposer. Elle contraint le
> Lot 3, qui doit la vérifier côté serveur et non côté écran.

**RG9** — Sur un profil **déjà publié**, les champs se répartissent en deux régimes :

| Régime | Champs concernés | Effet d'une modification |
|---|---|---|
| **Re-validation** | Nom commercial, logo, présentation, domaine du site, fonction de l'interlocuteur, secteur | Repasse en `en attente de validation`. **La dernière version validée reste affichée** pendant l'examen |
| **Effet immédiat** | Attentes de collaboration (RG27), taille d'entreprise, marchés visés, langues de travail, coordonnées de l'interlocuteur | Prise en compte immédiate, sans examen |

Un profil ne devient jamais invisible parce que son propriétaire a corrigé une faute de frappe.

*Amendé au L2C (`l2c/file.md` A2, A4, `0207`, `0209`)* : le profil reste `published` pendant l'examen (`brandProfile.status.pendingWithPublished` servi d'après la révision en attente) ; le régime « re-validation » porte six champs (`moderated_fields`), le secteur étant le seul secteur principal ; le logo proposé passe par l'état `in_review`, l'ancien logo restant actif jusqu'à la décision.

**RG10** — Un profil `refusé` porte **un motif typé** choisi dans la liste fermée de RG66, reste
intégralement modifiable et peut être resoumis sans délai. **Aucun refus muet, aucun dossier laissé
en attente sans décision.**

**RG11** — Un profil `suspendu` n'est visible d'aucun créateur ; ses campagnes publiées sont
dépubliées (contrainte pour le Lot 3) ; ses mises en relation déjà ouvertes restent accessibles aux
participants et au commercial (contrainte pour le Lot 4). La suspension n'efface **aucune** donnée.

**RG12** — Aucun écran, aucun e-mail et aucune donnée de ce périmètre ne contient de montant de
contrat, de taux de commission, de commission INFLUX ni de net créateur (**A1**). Le seul montant
est la **tranche de budget indicatif par collaboration** de RG31, qui est exprimée en tranche, avec
sa devise, et **n'est ni un engagement, ni un prix, ni une assiette de calcul**.

**RG13** — Toute valeur destinée à filtrer, comparer ou rapprocher est une **liste fermée** ou une
**tranche**, jamais un texte libre et jamais un nombre exact (règle d'or des facettes,
`matching-spec` A1 et A2). Les seuls textes libres du profil marque sont le nom commercial, la
présentation et la légende d'un logo — tous trois **modérés avant publication**.

**RG14** — Toute saisie est validée **côté serveur** avec exactement les mêmes règles que côté
navigateur. La validation dans le navigateur est un confort ; elle n'est jamais la seule.

### B — Bloc 1 : identité publique

**RG15** — Le bloc « identité publique » comporte **exactement** ces champs :

| Champ | Obligatoire pour publier | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Nom commercial | **Oui** | Publique | Texte modéré, ≤ 120 caractères (EC-L2B-2 : borne de l'inscription, `05` RG13) | Conversion : un créateur ne répond pas à une marque sans nom. Pré-rempli depuis le Lot 1 |
| Logo | Non (fortement incité) | Publique | Image PNG/JPG/WebP, ≤ 2 Mio déposée, plus grand côté ≥ 256 px, ré-encodée en WebP carré 512 px sans métadonnée (D80, ≤ 1 Mio stocké) | Conversion : une campagne sans logo est lue comme un test |
| Secteur d'activité principal | **Oui** | Publique | Liste fermée `reference.sectors`, 1 choix | Matching futur (rapprochement secteur ↔ thématique) + exclusion silencieuse des secteurs refusés par un créateur |
| Secteurs secondaires | Non | Publique | Liste fermée, ≤ 2 choix | Matching futur ; évite de forcer une marque multi-produits dans une case |
| Taille d'entreprise | **Oui** | Publique | **Tranche fermée** : 1-10 · 11-50 · 51-250 · 251-1 000 · plus de 1 000 | Conversion (le créateur juge le sérieux) + attribut Apollo. **Jamais l'effectif exact** |
| Pays d'établissement | **Oui** | Publique | `reference.countries`, repris du Lot 1 | Obligation : droit applicable, langue, futur pays ouvert (D26) |
| Marchés visés | **Oui** | Publique | `reference.countries`, ≤ 5 choix | Matching futur : c'est ce qui se rapproche du **pays principal d'audience** du créateur (facette F6) |
| Langues de travail | **Oui** | Publique | Liste fermée (FR, EN au MVP), ≥ 1 | Matching futur (facette F8) + condition d'exécution d'un brief |
| Site web | Non | Publique | **Domaine seul** (`exemple.com`), ≤ 100 caractères | Confiance + attribut Apollo. Voir la restriction de RG17 |
| Présentation | **Oui** | Publique | Texte modéré, 120 à 1 000 caractères | Conversion : c'est le seul endroit où la marque se raconte |

**RG16** — Le **nom commercial** et la **présentation** sont **modérés avant publication**. Ce sont
les deux seuls textes libres publics du profil, donc les deux seuls endroits où une coordonnée peut
être glissée. Une modération de forme suffit ; il ne s'agit pas de juger le discours commercial.

**RG17** — Le site web est saisi et conservé **sous forme de domaine**. Une saisie comportant un
protocole, un chemin, un paramètre ou une ancre est **réduite au domaine** à l'enregistrement
(`https://exemple.com/contact?ref=x` devient `exemple.com`). Le domaine est affiché en toutes
lettres et peut être suivi par le créateur ; **une page de contact direct relève du bloc masqué**
(RG35). D40 laisse le site public : la réduction au domaine est ce qui rend cette ouverture
acceptable sans rouvrir la décision.

**RG18** — Le logo est modéré selon une liste fermée de contrôles : pas de numéro de téléphone, pas
d'adresse e-mail, pas de mention « contactez-nous », pas de code à scanner, pas d'adresse postale.
Les métadonnées EXIF sont **systématiquement supprimées au dépôt**, avant modération.

**RG19** — Les textes publics ne peuvent contenir **aucune coordonnée directe** : adresse e-mail,
numéro de téléphone, adresse postale, identifiant de messagerie, `@` de réseau social, lien vers un
formulaire de contact. Une détection automatique **signale** au modérateur ; **c'est le modérateur
qui décide**, et le refus porte le motif « coordonnée directe dans un champ public » (RG66). Le
texte reste en brouillon : il n'est ni publié, ni modifié à l'insu de la marque.

**RG20** — Aucun champ public ne porte de donnée personnelle d'une personne physique, à la seule
exception de la **fonction** de l'interlocuteur (RG35), qui ne désigne personne nommément.

**RG21** — Si la raison sociale est le nom d'une personne physique (entreprise individuelle), elle
**n'est jamais publiée** : elle reste dans le bloc interne (RG46). C'est l'une des raisons pour
lesquelles la raison sociale et le nom commercial sont deux champs distincts.

**RG22** — La **taille d'entreprise** est une tranche. Aucun effectif exact, aucun chiffre
d'affaires, aucun budget annuel n'est collecté : ces valeurs n'ont aucun usage produit au MVP et
sont des données de négociation.

**RG23** — Les **marchés visés** utilisent le même référentiel de pays que le **pays principal
d'audience** du créateur (`reference.countries`). Deux vocabulaires différents rendraient tout
rapprochement impossible, aujourd'hui à la main comme demain par pondération.

**RG24** — Le profil marque ne porte **ni note, ni avis, ni étoile, ni compteur de campagnes
réalisées, ni compteur de contrats signés**. Au lancement ces compteurs valent zéro pour tout le
monde ; ensuite ils stigmatisent les nouveaux entrants.

**RG25** — Le nom commercial est comparé, à la soumission, aux noms commerciaux déjà publiés, après
normalisation (minuscules, accents et ponctuation retirés). Une correspondance **alerte le
modérateur**, elle ne refuse jamais automatiquement (RG70).

**RG26** — Tous les libellés de listes fermées (secteurs, pays, tailles, langues) sont affichés dans
la langue de l'utilisateur et proviennent des fichiers de traduction, jamais de la base
(`04-modele-de-donnees-mvp.md` §4.2, règle R8).

### C — Bloc 2 : attentes de collaboration

**RG27** — Le bloc « ce que je cherche » comporte **exactement** ces champs :

| Champ | Obligatoire pour publier | Couche | Format | Pourquoi ce champ existe |
|---|---|---|---|---|
| Thématiques recherchées | **Oui** | Publique | `reference.topics`, 1 à 3 choix | Matching futur (F1, F2) ; premier critère de tri d'un commercial |
| Réseaux visés | **Oui** | Publique | `reference.networks`, ≥ 1 | Matching futur (F3) : une campagne TikTok adressée à un profil sans TikTok est une demande morte |
| Formats attendus | **Oui** | Publique | `reference.formats`, ≥ 1 | Matching futur (F11) ; un format non proposé est une exclusion |
| Budget indicatif par collaboration | ~~Oui~~ **Suspendu** (D78, réponse 1 du L2B : ni saisi, ni affiché, ni obligatoire) | Publique | **Tranche** `reference.price_bands` + devise `reference.currencies` | Matching futur (F12) : première cause d'échec en négociation |
| Droits d'usage habituellement demandés | Non | Publique | `reference.usage_rights`, multi-choix (`none` n'est pas cochable : aucune case cochée le dit) | Matching futur (F14) : première cause de désaccord en négociation |
| Exclusivité habituellement demandée | Non | Publique | Tranche : non · ≤ 1 mois · ≤ 3 mois · négociable | Matching futur (F15) : deuxième cause de désaccord |
| Contrepartie non monétaire proposée | Non | Publique | Oui / non | Matching futur (F13) ; ouvre le bas de marché |
| Pays d'audience visés | **Oui** | Publique | `reference.countries`, ≤ 5 | Matching futur (F6) : la facette la plus utile de la recherche |
| Rythme de collaboration envisagé | Non | Publique | Liste fermée : ponctuel · récurrent · ambassadeur | Conversion : un créateur ne répond pas de la même façon à un test et à un contrat d'un an |

**RG28** — Chaque champ de ce bloc existe parce qu'il sert **au moins une** des trois
justifications : un usage futur de mise en relation, la conversion d'un créateur, une obligation
légale. **Un champ qui ne relève d'aucune des trois est de la friction et n'est pas créé** (D11 :
aucun algorithme au MVP, mais les données du futur moteur se collectent dès maintenant).

**RG29** — Les **bornes de tranches sont identiques partout** : profil marque, profil créateur,
campagne, facette de recherche, explication affichée. Une tranche de budget côté marque et une
tranche de tarif côté créateur qui ne partageraient pas les mêmes bornes seraient incomparables.

**RG30** — Le budget indicatif est exprimé **dans une seule devise par profil**, choisie dans
`reference.currencies`. **Aucune conversion n'est effectuée** au MVP (D27 ouverte) : si la devise
d'un créateur diffère, les deux valeurs sont affichées côte à côte, chacune avec sa devise, sans
rapprochement automatique et sans taux.

**RG31** — Le budget indicatif est accompagné, partout où il apparaît, d'une mention fixe :
**« budget indicatif par collaboration, à titre d'information — il ne vaut pas engagement »**. Il
n'est **jamais** présenté comme un montant de contrat.

**RG32** — Aucun écran servi à une marque n'affiche de **net créateur**. La rémunération nette d'un
créateur ne regarde pas l'annonceur : le montant qui le concerne est le coût total, et la
répartition est expliquée par les pages publiques et les CGU, pas par un profil.

**RG33** — Les attentes de collaboration sont modifiables à tout moment **sans re-validation**
(RG9) : ce sont des listes fermées, elles ne peuvent contenir ni coordonnée, ni contenu illicite.

**RG34** — Un profil dont les attentes sont vides ne peut pas être publié (RG5), mais **aucun champ
de ce bloc n'est jamais pré-rempli par défaut**. Une valeur par défaut serait lue comme une
déclaration de la marque et fausserait tout rapprochement futur.

### D — Bloc 3 : interlocuteur, et masquage symétrique (D40)

> **D40 est tranchée le 2026-09-18 : le masquage est symétrique.** Nom, logo, site et secteur de la
> marque restent publics ; **l'e-mail et le téléphone de l'interlocuteur ne sont visibles qu'après
> l'ouverture de la mise en relation**, exactement comme les réseaux d'un créateur. Ce document
> applique cette décision, il ne la rediscute pas.
>
> **Précisée le 2026-09-24 par D46 (arbitrage du fondateur) : l'identité, jamais les coordonnées.**
> À l'ouverture, le créateur voit le **prénom** et la **fonction** de l'interlocuteur ; **l'e-mail,
> le téléphone et la page de contact ne sont jamais montrés à un membre**, ni avant ni après la
> révélation. Ils restent réservés aux rôles internes (RG37), qui envoient eux-mêmes le contrat.
> RG35, RG38, RG40 à RG42, CA10 et les cas limites ci-dessous sont corrigés en conséquence ; en cas
> de doute, `12` RG29 fait foi.

**RG35** — Le bloc « votre interlocuteur » comporte **exactement** ces champs :

| Champ | Obligatoire pour publier | Couche | Format | Qui le voit |
|---|---|---|---|---|
| Fonction | **Oui** | **Publique** | Liste fermée : dirigeant · marketing · partenariats et influence · communication · e-commerce · achats · agence mandatée | Tout créateur, dans les deux contextes de RG73 |
| Prénom | Non | **Masquée** | Texte, ≤ 40 caractères | INFLUX en permanence ; le créateur après révélation |
| Adresse e-mail professionnelle | Non (par défaut : l'adresse de connexion) | **Interne** | Adresse e-mail | **INFLUX uniquement — jamais un membre** (D46) |
| Téléphone | Non (fortement incité) | **Interne** | Indicatif pays + numéro | Idem |
| Page de contact | Non | **Interne** | URL `https://` | Idem |

**RG36** — La **fonction** est publique et le **prénom** ne l'est pas. Un prénom associé à un nom de
marque se retrouve en une recherche sur un réseau professionnel : c'est le même mécanisme
d'identification que le pseudo d'un créateur. La fonction, elle, ne désigne personne et répond à la
seule question utile au créateur : *mon interlocuteur peut-il décider ?* (voir **Q1**).

**RG37** — Les champs masqués du bloc interlocuteur sont visibles **des rôles `agent` et `admin` en
permanence**, dès le brouillon. Le commercial doit pouvoir appeler une marque pour qualifier son
besoin : c'est le geste métier que la plateforme outille (**A3bis**), pas une entorse au masquage.

**RG38** — Le **prénom** de l'interlocuteur devient visible d'un créateur **au moment exact de la
révélation d'identité** de la mise en relation qui le concerne (`identity_revealed_at`, Lot 4), et
**pour ce créateur seulement**. L'e-mail, le téléphone et la page de contact **ne sont jamais
révélés** (D46). La révélation est **unique et simultanée dans les deux sens** : le même événement
horodaté révèle les réseaux du créateur à la marque et l'identité de l'interlocuteur au créateur. Il
n'existe pas deux révélations, ni deux dates.

**RG39** — La révélation est **une condition portée par la base**, pas un filtre d'affichage. Un
champ masqué ne figure **jamais** dans une réponse servie au rôle créateur avant révélation, y
compris dans une charge utile que l'écran n'affiche pas. **Le contrôle se fait sur la réponse, pas
sur l'écran.**

**RG40** — Les coordonnées de l'interlocuteur ne figurent **jamais** : dans une campagne publiée,
dans un résultat de recherche de campagnes, dans une notification e-mail envoyée à un créateur, dans
un export, ni dans le texte d'une proposition INFLUX. Ce sont quatre chemins de fuite distincts, et
chacun doit être testé séparément.

**RG41** — Toute **consultation** du bloc révélé par un créateur est journalisée (compte, mise en
relation concernée, date et heure). Ce n'est pas une suspicion : c'est la contrepartie de
l'ouverture décidée par D40, et c'est ce qui permettra de mesurer si la révélation précède les
conversations qui s'éteignent.

**RG42** — Le bloc révélé est accompagné d'une mention fixe, dans la langue du créateur : **« Les
échanges se poursuivent dans INFLUX, avec votre interlocuteur et le commercial INFLUX. »**
*(Seconde phrase d'origine supprimée le 2026-09-24 : depuis D46, aucune coordonnée n'est révélée.)* Aucune formulation n'invite à
écrire hors plateforme.

**RG43** — Une révélation est **irréversible**. Si la mise en relation est ensuite refermée, annulée
ou si le compte est suspendu, les coordonnées déjà révélées le restent pour ce créateur, et
l'horodatage est conservé. Prétendre le contraire serait mentir sur ce que le produit sait faire.

**RG44** — Les comptes de réseaux sociaux de la marque (page Instagram, TikTok, LinkedIn de
l'entreprise) **ne sont pas collectés** : ce sont des canaux de messagerie directe, donc des
vecteurs de contournement exactement au même titre qu'un numéro de téléphone.

**RG45** — Le bloc interlocuteur n'entre **jamais** dans le calcul de ce qui est envoyé à Brevo ou à
Apollo en plus du contact déjà créé au Lot 1 (RG80).

### E — Bloc 4 : champs internes et badge « Marque vérifiée »

**RG46** — Le bloc interne comporte **exactement** ces champs, **jamais visibles d'un créateur, y
compris après révélation** :

| Champ | Obligatoire | Format | À quoi il sert |
|---|---|---|---|
| Raison sociale | Obligatoire pour demander le badge | Texte, ≤ 160 caractères | Contrôle dans un registre public |
| Pays d'immatriculation | Obligatoire pour demander le badge | `reference.countries` | Détermine le registre à consulter |
| Numéro d'immatriculation | Obligatoire pour demander le badge | Texte, ≤ 40 caractères, **aucun contrôle de format par pays au MVP** | Contrôle dans un registre public |
| Notes internes du commercial | Non | Texte libre | Qualification commerciale, jamais visible du membre |

**RG47** — Ces champs sont demandés **au moment de la demande de badge**, jamais à la création du
profil. Les exiger plus tôt ajouterait trois champs administratifs à un parcours dont l'objectif est
la publication en dix minutes.

**RG48** — **Aucun champ du bloc interne n'est transmis à Brevo ni à Apollo**, sous aucune forme.

**RG49** — Le badge **« Marque vérifiée »** affirme **exactement deux choses** : que le **domaine**
déclaré est contrôlé par la marque, et que l'**immatriculation** déclarée existe dans un registre
public. Il est attribué **à la main**, par un agent nommé, à une date donnée.

**RG50** — Le badge **n'affirme jamais** : que la marque est solvable, qu'elle paiera, qu'elle est
sérieuse, qu'elle a déjà travaillé avec des créateurs, ni que ses campagnes sont de qualité. Tout
libellé laissant croire l'une de ces choses est faux, et c'est INFLUX qui en répond.

**RG51** — Le contrôle du domaine suit le mécanisme de preuve de propriété : INFLUX génère un code à
usage unique ; la marque le publie dans un enregistrement DNS `TXT` **ou** sur une page de son
domaine ; **l'agent constate lui-même le code en ligne** et enregistre son constat (horodatage +
identité de l'agent). Une capture d'écran fournie par la marque ne vaut pas preuve : elle se
fabrique. Le code est valide **7 jours** (valeur de départ, paramétrable, voir **Q6**).

**RG52** — Le contrôle de l'immatriculation est fait par l'agent dans un **registre public
accessible en ligne**. Si le registre du pays déclaré n'est pas consultable, la demande est
**refusée** avec le motif « immatriculation non vérifiable dans ce pays » : le badge n'est pas
attribué, et il n'existe **pas** de badge dégradé. Ne rien affirmer vaut mieux qu'affirmer à moitié.
*Précisé le 2026-11-01 (fondateur, **Q7**, D79)* : aucun pays exclu ; sources admises : registre officiel du pays **gratuit** et en ligne, ou base mondiale des identifiants LEI (GLEIF) ; registre payant à l'acte, agrégateur privé ou certificat fourni par la marque ne suffisent pas (un agrégateur sert seulement à trouver le registre officiel). Les sources vivent dans une **table par
pays tenue par un administrateur** (RG101 : journalisée, jamais par un agent) : un socle au lancement
(Union européenne par le portail e-Justice, puis les grands pays visés), complété **à la demande**
quand une marque d'un pays non couvert demande le badge. Faute de source admise, refus motivé
ci-dessus ; une nouvelle demande reste possible dès qu'une source est ajoutée.

**RG53** — Le badge affiche **sa date** partout où il apparaît : campagne, fiche marque, en-tête de
conversation. Un badge sans date est un badge qui ment par omission.

**RG54** — Le badge « Marque vérifiée » **se périme au bout de 12 mois** (valeur proposée, rattachée
à **D34**) : une société peut être radiée, un domaine peut changer de titulaire. À J-15 un rappel
est envoyé ; à l'échéance le badge passe en **« à rafraîchir »**, visible et daté ; à la fin du
délai de grâce (**30 jours**, valeur proposée) il est retiré.

**RG55** — Le badge est **retiré immédiatement**, hors péremption, dans quatre cas : pièce ou
déclaration reconnue fausse, société radiée, changement de titulaire du domaine, manquement grave
aux CGU. Chaque retrait porte un motif typé, est journalisé nominativement et est notifié à la
marque.

**RG56** — Les pièces et les constats de vérification vivent en **stockage privé**. **Aucun
créateur n'y accède, dans aucun cas** — y compris à sa demande, y compris par l'intermédiaire d'un
commercial. Ce qu'INFLUX transmet, c'est son constat, jamais la pièce. Tout accès d'un agent à une
pièce est journalisé.

### F — Indicateur de complétude

**RG57** — La complétude est un **score pondéré de 0 à 100**, calculé côté serveur, recalculé à
chaque modification, et stocké. Elle est visible de l'annonceur et des rôles internes ; **elle n'est
jamais affichée à un créateur**.

**RG58** — La pondération est **exactement** celle-ci :

| Bloc | Détail | Points |
|---|---|---|
| Identité publique | Nom commercial 5 · secteur 5 · taille 3 · pays 2 · présentation ≥ 120 caractères 10 · logo 10 · marchés visés 3 · langues 2 | **40** |
| Attentes de collaboration | Thématiques 8 · réseaux 6 · formats 6 · budget indicatif 8 (suspendu au L2B : exclu du calcul) · pays d'audience visés 4 · droits d'usage 3 | **35** |
| Confiance | Domaine renseigné 5 · badge « Marque vérifiée » **demandé** 10 | **15** |
| Interlocuteur | Fonction 3 · téléphone 4 · e-mail professionnel 3 | **10** |

**RG59** — La complétude **ne dépend jamais d'une action d'INFLUX**. Le score compte une demande de
badge **déposée**, jamais un badge **obtenu** ; il compte des champs **saisis**, jamais des champs
**validés**. Sinon la file interne pénaliserait l'annonceur pour un retard qui n'est pas le sien.

**RG60** — **La publication ne dépend pas du score** mais de la liste nominative des champs
obligatoires (RG5). Le score n'ouvre aucun droit : en faire un seuil d'accès pousserait à remplir
des champs sans valeur pour franchir une barre.

**RG61** — Le message accompagnant le score est **factuel, mesurable et vérifiable**. Il nomme ce
qui manque et dit ce que cela change, **sans promesse de résultat** :

| Autorisé (vérifiable) | Interdit (invérifiable) |
|---|---|
| « Il manque 2 informations pour soumettre votre profil : formats attendus, budget indicatif. » | « Complétez votre profil pour recevoir plus de réponses. » |
| « Sans budget indicatif, les créateurs ne peuvent pas savoir si votre besoin correspond à leurs tarifs. » | « Un profil complet multiplie vos chances par 3. » |
| « Votre logo n'est pas renseigné : vos campagnes s'affichent sans image. » | « Les marques vérifiées obtiennent de meilleurs créateurs. » |

**RG62** — Le score est accompagné, dans l'interface, de **l'étiquette de couche de chaque champ**
(publique · masquée jusqu'à la mise en relation · interne). L'annonceur doit pouvoir répondre sans
effort à la question « qui verra cette information ? ».

### G — Backoffice : validation, correction, supervision

**RG63** — Le backoffice expose une **file « profils marque à valider »**, distincte de la file des
profils créateurs, triée par ancienneté croissante, avec pour chaque entrée : marque, date de
soumission, ancienneté, champs modifiés depuis la dernière validation, alerte de doublon éventuelle,
agent ayant pris l'entrée en charge. *Amendé au L2C (`l2c/file.md` A1, A3, `0210`)* : une entrée par
examen (première soumission ou révision), une ouverte au plus par compte ; la décision porte sur la
version dont le jeton a été rendu à l'ouverture.

**RG64** — Une entrée est **prise en charge** par un agent avant d'être traitée. Un **verrou** empêche
deux agents de traiter la même entrée : le second voit « déjà prise en charge par … », jamais une
erreur technique. Une prise en charge expire automatiquement au bout de **30 minutes** sans décision
et retourne dans la file. *Amendé au L2C (`l2c/file.md` A9, `0210`)* : ouvrir une entrée libre la prend
en charge ; l'expiration se calcule à la lecture, sans tâche ; la prise suivante journalise d'abord
l'abandon ; le titulaire peut relâcher ou prolonger, un administrateur lever avec un motif typé.

**RG65** — Une décision est **toujours** l'une des deux suivantes : publier, ou refuser avec un motif
typé. Il n'existe pas de troisième voie silencieuse, ni de mise en attente indéfinie.

**RG66** — La liste des motifs de refus est **fermée** ; chaque motif porte le message envoyé à la
marque, dans sa langue :

| Motif | Message à la marque | Ce qu'elle peut faire |
|---|---|---|
| Coordonnée directe dans un champ public | « Votre présentation contient une adresse, un numéro ou un lien de contact. Les coordonnées ne sont visibles qu'une fois la mise en relation ouverte. » | Corriger et resoumettre |
| Présentation trop courte ou incompréhensible | « Votre présentation ne permet pas à un créateur de comprendre votre activité. » | Compléter |
| Logo non conforme | « Votre logo comporte des coordonnées ou n'est pas lisible. » | Remplacer |
| Nom commercial trompeur | « Le nom déclaré correspond à une marque que vous ne semblez pas représenter. » | Contacter INFLUX |
| Secteur manifestement incohérent | « Le secteur déclaré ne correspond pas à votre activité. » | Corriger |
| Contenu illicite ou contraire aux CGU | « Votre profil contient un élément contraire aux conditions d'utilisation d'INFLUX. » / « Your profile contains content that breaches the INFLUX terms of use. » *(message unique au L2C, `l2c/file.md` A6 ; relu en porte de production, `21` §5.8)* | Corriger |
| Doublon d'une marque déjà inscrite | « Cette marque dispose déjà d'un compte INFLUX. » | Contacter INFLUX |
| Autre | Message rédigé par l'agent, en complément d'une explication | Contacter INFLUX |

**RG67** — Le motif **« Autre » est exceptionnel et surveillé** : sa fréquence est un indicateur. S'il
dépasse **10 % des refus** sur un mois, la liste est incomplète et doit être étendue.

**RG68** — Un commentaire libre est autorisé **en complément** d'un motif typé, jamais à sa place.

**RG69** — Toute décision (publication, refus, correction, suspension, attribution ou retrait de
badge) est **journalisée nominativement** et **notifiée à l'annonceur** par un e-mail transactionnel
dans sa langue. Une décision non notifiée est une décision invisible, donc contestable.

**RG70** — À la soumission, le système **alerte** l'agent si le domaine déclaré ou le nom commercial
normalisé correspond à un profil déjà publié. L'alerte est informative : **le refus pour doublon
reste une décision humaine**, deux entités juridiques distinctes pouvant légitimement partager un
nom ou un domaine.

**RG71** — Un agent peut **corriger** un champ d'un profil (faute, coordonnée oubliée, secteur mal
choisi). Toute correction enregistre l'ancienne et la nouvelle valeur, exige un motif, est
journalisée nominativement, et **l'annonceur en est informé**. Un agent qui modifie un profil sans
trace est indistinguable d'une falsification.

**RG72** — Le tableau de bord du backoffice affiche : nombre de profils marque en attente, ancienneté
du plus ancien, délai médian de traitement, répartition des refus par motif, nombre de badges actifs
et nombre de badges arrivant à péremption sous 30 jours.

### H — Ce qu'un créateur voit d'une marque, avant et après

**RG73** — Un créateur ne voit un profil marque que dans **deux contextes**, et jamais ailleurs :

| Contexte | Quand | Ce qu'il voit |
|---|---|---|
| **Campagne publiée** (Lot 3) | Dès que la campagne est publiée | Le bloc identité publique + le bloc attentes + le badge et sa date + la **fonction** de l'interlocuteur |
| **Mise en relation ouverte** (Lot 4) | À partir de la révélation d'identité | Tout ce qui précède **+ le bloc interlocuteur** (prénom, e-mail, téléphone, page de contact) |

**RG74** — Tableau de référence, champ par champ :

| Champ | Avant ouverture de la mise en relation | Après |
|---|---|---|
| Nom commercial, logo, secteur, taille, pays, marchés visés, langues | Visible | Visible |
| Site web (domaine) | Visible | Visible |
| Présentation | Visible | Visible |
| Attentes de collaboration, budget indicatif (tranche) | Visible | Visible |
| Badge « Marque vérifiée » + date | Visible | Visible |
| **Fonction** de l'interlocuteur | Visible | Visible |
| **Prénom** de l'interlocuteur | **Masqué** | Visible |
| **E-mail professionnel** | **Masqué** | Visible |
| **Téléphone** | **Masqué** | Visible |
| **Page de contact** | **Masqué** | Visible |
| Raison sociale, pays et numéro d'immatriculation | **Jamais** | **Jamais** |
| Notes internes, pièces de vérification | **Jamais** | **Jamais** |
| Complétude du profil | **Jamais** | **Jamais** |

**RG75** — Un créateur n'a **aucun moyen** d'atteindre un profil marque autrement que par ces deux
contextes : ni adresse devinable, ni identifiant séquentiel, ni page publique référencée.
L'identifiant d'un profil marque servi côté créateur est **opaque et aléatoire**.

**RG76** — La marque est informée, dans son espace, de ce que voit un créateur avant et après la
mise en relation — le même tableau que RG74, rédigé pour elle. Une marque qui découvre après coup
que son téléphone a été révélé est une marque qui perd confiance.

**RG77** — Une marque ne reçoit **aucune notification** lorsqu'un créateur consulte son profil dans
une campagne. Seule la mise en relation validée produit une notification, au Lot 4.

### I — Leads, messages et accessibilité

**RG78** — Un événement **`profile.completed`** est émis à la **première publication** du profil.
Les modifications ultérieures d'un profil publié émettent **`lead.updated`**. Les deux suivent
exactement le pipeline du Lot 1 : émission dans la même transaction que le fait décrit, charge utile
réduite à des identifiants, consentement relu à la consommation.

**RG79** — Attributs enrichis chez **Brevo** (si consentement) : secteur, taille d'entreprise, pays,
marchés visés, tranche de budget, état du profil, complétude, badge et sa date. Attributs enrichis
chez **Apollo** (si périmètre, base légale et consentement du Lot 1 le permettent) : nom commercial,
domaine, secteur, taille d'entreprise, pays.

**RG80** — **Ne partent jamais** vers Brevo ni Apollo : la raison sociale, le numéro
d'immatriculation, les pièces, les notes internes, **et l'e-mail ou le téléphone de
l'interlocuteur** s'ils diffèrent de l'adresse de connexion. Ajouter un second point de contact
créerait une collecte marketing sans consentement propre (voir **Q4**).

**RG81** — **Un champ absent est envoyé vide, jamais rempli d'une valeur inventée** (règle héritée
du Lot 1).

**RG82** — Chaque écran de ce périmètre possède **quatre états explicites** : repos, chargement,
succès, échec. Un formulaire de profil ne perd **jamais** une saisie sur erreur, y compris au dépôt
d'un logo.

**RG83** — L'enregistrement du profil est **automatique et incrémental** (le brouillon se sauvegarde
seul) : un annonceur interrompu ne recommence jamais. La soumission, elle, reste une action
explicite.

**RG84** — Tous les messages existent en **français et en anglais** ; aucun n'est écrit en dur.

| Clé | Français | English |
|---|---|---|
| `brandProfile.publish.missing` | Il manque {count, plural, one {# information} other {# informations}} pour soumettre votre profil : {fields}. | {count, plural, one {# piece of information is} other {# pieces of information are}} missing to submit your profile: {fields}. |
| `brandProfile.layer.public` | Visible de tous les créateurs. | Visible to all creators. |
| `brandProfile.layer.revealed` | Visible uniquement après l'ouverture d'une mise en relation. | Visible only after an introduction is opened. |
| `brandProfile.layer.internal` | Visible uniquement par l'équipe INFLUX. | Visible only to the INFLUX team. |
| `brandProfile.status.pending` | Votre profil est en cours de validation par l'équipe INFLUX. | Your profile is being reviewed by the INFLUX team. |
| `brandProfile.status.pendingWithPublished` | Vos modifications sont en cours de validation. Votre profil reste visible dans sa version précédente. | Your changes are being reviewed. Your profile remains visible in its previous version. |
| `brandProfile.status.rejected` | Votre profil n'a pas été publié : {reason} | Your profile was not published: {reason} |
| `brandProfile.website.normalized` | Nous avons conservé le domaine {domain}. Une page de contact se renseigne dans le bloc « votre interlocuteur ». | We kept the domain {domain}. A contact page belongs in the "your contact" section. |
| `brandProfile.budget.notice` | Budget indicatif par collaboration, à titre d'information — il ne vaut pas engagement. | Indicative budget per collaboration, for information only — it is not a commitment. |
| `brandProfile.contact.revealNotice` | Les échanges se poursuivent dans INFLUX, avec votre interlocuteur et le commercial INFLUX. Ces coordonnées vous permettent d'identifier votre interlocuteur. | Conversations continue inside INFLUX, with your contact and the INFLUX account manager. These details let you identify who you are talking to. |
| `brandProfile.badge.label` | Marque vérifiée le {date} — domaine et immatriculation contrôlés. | Brand verified on {date} — domain and company registration checked. |
| `brandProfile.badge.toRefresh` | Marque vérifiée le {date} — vérification à rafraîchir. | Brand verified on {date} — verification needs refreshing. |
| `brandProfile.errors.contactInPublicText` | Votre texte contient ce qui ressemble à une coordonnée directe. Retirez-la : les échanges avec les créateurs se font dans INFLUX. *(Libellé corrigé le 2026-09-24, D46.)* | Your text contains what looks like direct contact details. Please remove them: conversations with creators take place in INFLUX. |
| `brandProfile.search.blockedUntilPublished` | Publiez votre profil pour rechercher des créateurs. | Publish your profile to search for creators. |

**RG85** — Accessibilité : chaque champ porte une étiquette visible et son étiquette de couche ;
un champ en erreur pointe vers son message ; le focus va au premier champ invalide ; les contrastes
respectent WCAG AA ; **le vert de marque n'est jamais le seul porteur d'un état** (publié, en
attente, refusé, suspendu portent chacun un libellé écrit). Toutes les couleurs, tailles et
espacements passent par les tokens (`design-system-influx`).

---

## Cas limites

### Les huit cas limites de la skill `feature-spec`

**1 — Donnée absente ou profil incomplet**

| Situation | Comportement attendu |
|---|---|
| Un champ obligatoire est vide à la soumission | La liste nominative de ce qui manque s'affiche, le focus va au premier champ, le profil reste en brouillon (RG5) |
| Le logo est absent | Publication possible ; la campagne affiche une pastille neutre avec l'initiale du nom commercial, jamais un emplacement vide (RG15) |
| Le domaine est absent | Publication possible ; le badge « Marque vérifiée » est **impossible** à demander, et le message le dit (RG51) |
| Aucun numéro de téléphone d'interlocuteur | Publication possible ; la fiche backoffice affiche « aucun numéro — relance par e-mail uniquement », visible du commercial |
| Le secteur déclaré a été retiré du référentiel | Le profil reste publié avec sa valeur, une alerte de cohérence remonte au backoffice, la marque est invitée à choisir un secteur actif |
| Le créateur consulte une campagne d'une marque dont le profil est repassé en validation | Il voit la **dernière version validée** (RG9), jamais un profil vide |

**2 — Valeur nulle, négative ou aberrante**

| Situation | Comportement attendu |
|---|---|
| Aucun montant de contrat, taux ni commission n'existe dans ce périmètre | Vérifié : seule la tranche de budget indicatif existe, avec sa devise et sa mention (RG12, RG31) |
| Tranche de budget choisie sans devise | Refus : la devise est obligatoire dès qu'une tranche est choisie (RG30) |
| Présentation de 3 000 caractères, nom commercial de 200 caractères | Refus avec message dédié, côté navigateur **et** côté serveur (RG14) |
| Logo de 12 Mo, ou de 40 px de côté, ou au format PDF | Refus avec message dédié indiquant les formats et tailles acceptés |
| Site saisi sous forme `https://exemple.com/contact?utm=…` | Réduit au domaine `exemple.com`, avec un message expliquant la réduction (RG17) |
| Numéro d'immatriculation composé d'espaces | Refus : valeur non vide hors espaces |
| 8 marchés visés sélectionnés | Refus au-delà de 5, message indiquant le plafond |

**3 — Doublon**

| Situation | Comportement attendu |
|---|---|
| Deux comptes déclarent le même domaine | Alerte au modérateur, **aucun refus automatique** (RG70) |
| Deux comptes déclarent un nom commercial identique après normalisation | Idem (RG25) |
| Un même annonceur soumet deux fois son profil (double clic, deux onglets) | Une seule entrée en file ; la seconde soumission est sans effet |
| Le même logo est déposé deux fois | Remplacement du précédent ; l'ancien fichier est purgé, la modération repart à zéro |
| Une même demande de badge est déposée deux fois | Une seule entrée active en file ; la seconde affiche « demande déjà en cours depuis le … » |

**4 — Action concurrente**

| Situation | Comportement attendu |
|---|---|
| Deux agents ouvrent la même entrée de validation | Un seul la prend en charge ; le second voit « déjà prise en charge par … » (RG64) |
| Un agent valide pendant que l'annonceur modifie un champ soumis à re-validation | La décision porte sur la version examinée ; la modification postérieure repasse en file, avec la mention « modifié après examen ». *Amendé au L2C (A3, `0210`)* : toute écriture change le jeton de version ; une décision au jeton périmé est refusée (55000 `stale_token`), l'agent relit, sa saisie gardée |
| Un agent corrige un champ pendant que l'annonceur le corrige aussi | La dernière écriture gagne, les deux versions sont journalisées, et l'annonceur est informé de la correction de l'agent (RG71) |
| Un admin suspend un profil pendant qu'un agent l'attribue au badge | La suspension prime ; l'attribution est refusée avec un message explicite |
| Une prise en charge est abandonnée sans décision | Elle expire au bout de 30 minutes et l'entrée retourne dans la file (RG64) |

**5 — Droit insuffisant**

| Situation | Comportement attendu |
|---|---|
| Un créateur appelle directement l'adresse d'un profil marque hors des deux contextes autorisés | Refus au niveau de la base, journalisé (RG73, RG75) |
| Un créateur demande la charge utile d'un profil marque avant révélation | Les champs masqués **ne figurent pas dans la réponse**, pas même vides (RG39) |
| Un annonceur tente de lire le profil d'une autre marque | Refus : il n'existe aucun chemin de lecture d'un profil marque par un annonceur |
| Un agent tente de retirer un badge **seul, sans seconde validation** | Refus : le retrait exige une double validation — approbation d'un admin distinct, ou confirmation différée journalisée si un seul opérateur est disponible (voir `03`, `08` RG75) |
| Un agent tente d'exporter la liste des marques | Refus : l'export est réservé au rôle `admin`, avec re-authentification, motif et journal |
| Un annonceur tente de modifier lui-même son état en « publié » | Refus côté serveur : seul un rôle interne publie (RG6) |

**6 — Service externe indisponible**

| Situation | Comportement attendu |
|---|---|
| Le stockage de fichiers est indisponible au dépôt du logo | Le reste du profil est enregistré, le logo est signalé « à redéposer », aucune saisie n'est perdue |
| Brevo ou Apollo indisponibles au moment de `profile.completed` | La publication aboutit, les lignes de synchronisation passent en attente et sont réessayées (pipeline du Lot 1) |
| Le registre public d'immatriculation est inaccessible | La demande de badge reste en file, l'agent la repose avec le motif « à réexaminer », aucun refus automatique |
| La base est indisponible pendant l'enregistrement automatique du brouillon | Message honnête, saisie conservée dans le navigateur, nouvelle tentative proposée |
| Le service d'envoi transactionnel est indisponible au moment d'une notification de décision | La décision est enregistrée, la notification est mise en file et réessayée ; l'état est visible au backoffice |

**7 — Abandon en cours de parcours**

| Situation | Comportement attendu |
|---|---|
| L'annonceur quitte pendant la saisie | Le brouillon est conservé intégralement (RG83) ; aucune relance automatique n'est envoyée sans consentement marketing |
| Le profil reste en brouillon plus de 30 jours | Aucun effet sur le compte ; le brouillon est visible du commercial, qui peut relancer — c'est un lead chaud |
| La demande de badge est abandonnée après génération du code | Le code expire au bout de 7 jours, la demande passe en « expirée », le profil reste publié sans badge |
| L'annonceur abandonne après un refus | Le profil reste `refusé` et modifiable ; le motif reste consultable dans son espace |
| L'annonceur se déconnecte pendant le dépôt du logo | Le dépôt est abandonné, aucun fichier partiel n'est conservé |

**8 — Annulation ou retour en arrière après validation**

| Situation | Comportement attendu |
|---|---|
| L'annonceur veut dépublier son profil | Possible : retour en `brouillon`. Ses campagnes publiées sont dépubliées ; **les mises en relation ouvertes ne sont pas affectées** et les coordonnées déjà révélées le restent (RG43) |
| L'annonceur retire son téléphone après une révélation | Le champ est vidé ; aucun créateur ne l'a jamais vu (D46). Seuls les rôles internes perdent l'information |
| Une marque conteste un refus | Elle corrige et resoumet ; en cas de désaccord persistant, le réexamen est fait par un agent différent du décideur dès que l'équipe compte deux personnes |
| Un badge est retiré après avoir été affiché sur une campagne | La campagne cesse immédiatement d'afficher le badge ; aucun historique de badge n'est affiché aux créateurs |
| Le compte est supprimé (Lot 1) | Le profil est anonymisé avec le compte ; les mises en relation et leurs horodatages de révélation sont conservés sous forme pseudonyme |

### La checklist INFLUX de la skill `feature-spec`

| # | Contrôle | Réponse pour ce document |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission INFLUX, net créateur | **Aucun.** Le seul montant est la **tranche de budget indicatif par collaboration**, avec sa devise et sa mention « ne vaut pas engagement » (RG12, RG30, RG31). Aucun net créateur n'est affiché à une marque (RG32). A1 interdit tout calcul de commission dans ce périmètre |
| 2 | **Traçabilité / contournement** | **C'est le sujet central du document.** D40 est appliquée, précisée par D46 : prénom masqué jusqu'à la révélation, e-mail, téléphone et page de contact **jamais** montrés à un membre (RG35 à RG43) ; site réduit au domaine (RG17) ; réseaux sociaux de la marque non collectés (RG44) ; aucun annuaire des marques (RG4) ; textes et logo modérés (RG16, RG18, RG19). **Risque résiduel assumé et signalé :** après révélation, chaque partie dispose d'un moyen de joindre l'autre hors plateforme. La parade principale reste le commercial présent dans la conversation (cadrage §2.2c) ; la parade mesurable est la journalisation de chaque consultation du bloc révélé (RG41) |
| 3 | **Leads** — ce qui part vers Brevo et Apollo, avec quel consentement | Détaillé en RG78 à RG81 : `profile.completed` à la première publication, attributs d'enrichissement listés, **bloc interne et coordonnées de l'interlocuteur exclus**, consentement du Lot 1 relu à la consommation |
| 4 | **Backoffice** — contrepartie interne | Détaillée en RG63 à RG72 : file dédiée, verrou anti-double-traitement, motifs typés, corrections journalisées, alerte de doublon, tableau de bord, badge et sa péremption |
| 5 | **Matching hybride** | **Aucun algorithme (D11).** Ce document ne fait que **collecter** les champs qui serviront de critères : secteur, thématiques, réseaux, formats, budget, pays d'audience visés — tous en listes fermées ou en tranches, avec les mêmes bornes que côté créateur (RG29). L'intervention humaine spécifiée ici est la validation, la correction et la vérification, toutes journalisées |
| 6 | **Deux populations** | Ce document ne traite **que** la marque. Le créateur n'y apparaît qu'en lecteur (RG73, RG74). Files de validation, motifs de refus, libellés et écrans sont distincts de ceux du document `07` |
| 7 | **Données personnelles** — avis de `expert-conformite-rgpd` | **Obligatoire, avec veto.** Points soumis : publicité de la fonction de l'interlocuteur (**Q1**), périmètre exact révélé par D40 et durée de conservation du journal de consultation (**Q2**), conservation du numéro d'immatriculation et des constats de vérification (**Q3**), non-envoi du second point de contact vers Brevo et Apollo (**Q4**) |

---

## Critères d'acceptation

### Création et champs

**CA1** — *Étant donné* un compte annonceur qui vient de s'inscrire, *quand* il se connecte pour la
première fois, *alors* un profil marque existe à l'état `brouillon`, pré-rempli avec le nom
d'entreprise, le pays et la langue saisis à l'inscription.

**CA2** — *Étant donné* le formulaire de profil, *quand* on examine ses champs, *alors* aucun champ
ne redemande l'adresse e-mail de connexion, le pays ou la langue déjà collectés au Lot 1.

**CA3** — *Étant donné* un annonceur qui modifie son nom commercial, *quand* il enregistre, *alors*
le nom d'entreprise du compte est mis à jour, un `lead.updated` est émis, et il n'existe qu'une
seule valeur dans le produit.

**CA4** — *Étant donné* le champ « site web », *quand* l'annonceur saisit
`https://exemple.com/contact?utm=abc`, *alors* la valeur conservée est `exemple.com` et un message
explique où renseigner une page de contact.

**CA5** — *Étant donné* le champ « taille d'entreprise », *quand* on examine ses valeurs possibles,
*alors* ce sont exclusivement des tranches, et aucun effectif exact ne peut être saisi.

**CA6** — *Étant donné* un formulaire complet, *quand* l'annonceur demande la publication, *alors*
le profil passe en `en attente de validation` et n'est visible d'aucun créateur.

**CA7** — *Étant donné* un formulaire auquel il manque les formats attendus et le budget indicatif,
*quand* l'annonceur demande la publication, *alors* le message nomme **les deux** champs manquants
et le profil reste en `brouillon`.

### Masquage symétrique (D40)

**CA8** — *Étant donné* une campagne publiée par une marque, *quand* un créateur la consulte,
*alors* il voit le nom, le logo, le secteur, la taille, le site, la présentation, les attentes, le
badge et **la fonction** de l'interlocuteur, et **ni prénom, ni e-mail, ni téléphone, ni page de
contact**.

**CA9** — *Étant donné* la situation précédente, *quand* on inspecte la **charge utile** de la
réponse servie au créateur, *alors* les champs masqués **ne s'y trouvent pas**, pas même vides ou
nuls.

**CA10** — *Étant donné* une mise en relation validée, *quand* la révélation d'identité est
enregistrée, *alors* le créateur voit le prénom et la fonction de l'interlocuteur — **jamais son
e-mail, son téléphone ni sa page de contact** (D46) —, la marque voit les réseaux du créateur, et
**les deux révélations portent le même horodatage**.

**CA11** — *Étant donné* un créateur qui consulte le bloc interlocuteur révélé, *quand* il l'ouvre,
*alors* une entrée de journal est écrite (compte, mise en relation, date et heure) et la mention de
RG42 est affichée.

**CA12** — *Étant donné* une mise en relation refermée après révélation, *quand* le créateur
retourne sur le profil, *alors* les coordonnées restent visibles et l'horodatage de révélation est
conservé.

**CA13** — *Étant donné* un e-mail de notification envoyé à un créateur au sujet d'une campagne,
*quand* on examine son contenu, *alors* il ne contient **aucune** coordonnée de l'interlocuteur.

**CA14** — *Étant donné* le formulaire de profil, *quand* on examine ses champs, *alors* aucun champ
ne permet de renseigner un compte de réseau social de la marque.

### États, validation, refus

**CA15** — *Étant donné* un profil publié, *quand* l'annonceur corrige sa présentation, *alors* le
profil repasse en `en attente de validation` **et la version précédente reste affichée** aux
créateurs pendant l'examen. *Amendé au L2C (A2)* : l'état reste `published`, la révision est portée par `pendingChanges`.

**CA16** — *Étant donné* un profil publié, *quand* l'annonceur change sa tranche de budget, *alors*
la modification est visible immédiatement, **sans re-validation**.

**CA17** — *Étant donné* une entrée en file de validation, *quand* un premier agent la prend en
charge, *alors* un second agent voit « déjà prise en charge par … » et ne peut pas décider.

**CA18** — *Étant donné* une prise en charge sans décision, *quand* 30 minutes se sont écoulées,
*alors* l'entrée retourne dans la file et redevient disponible.

**CA19** — *Étant donné* une présentation contenant une adresse e-mail, *quand* l'agent examine le
profil, *alors* la détection est signalée, l'agent refuse avec le motif dédié, et le texte n'est pas
publié.

**CA20** — *Étant donné* un refus, *quand* il est enregistré, *alors* un motif typé est obligatoire,
la marque reçoit le message associé dans sa langue, et le profil reste modifiable.

**CA21** — *Étant donné* une soumission dont le domaine correspond à un profil déjà publié, *quand*
elle arrive en file, *alors* une alerte de doublon est affichée à l'agent et **aucun refus
automatique** n'est prononcé.

**CA22** — *Étant donné* un agent qui corrige le secteur d'un profil, *quand* il enregistre, *alors*
un motif est exigé, l'ancienne et la nouvelle valeur sont journalisées, et l'annonceur en est
informé.

**CA23** — *Étant donné* un profil suspendu par un administrateur, *quand* un créateur consulte une
campagne de cette marque, *alors* la campagne n'est plus accessible et aucune donnée du profil n'est
servie.

### Recherche conditionnée à la publication

**CA24** — *Étant donné* une marque dont le profil est en `brouillon`, *quand* elle tente de lancer
une recherche de créateurs ou de publier une campagne, *alors* l'action est refusée **côté serveur**
avec le message de RG84, et le lien vers la publication du profil est proposé.

**CA25** — *Étant donné* la même marque, *quand* son profil est publié, *alors* la recherche et la
publication de campagne deviennent accessibles sans autre action.

### Badge « Marque vérifiée »

**CA26** — *Étant donné* un profil sans domaine renseigné, *quand* l'annonceur demande le badge,
*alors* la demande est refusée à la saisie avec un message expliquant que le domaine est
indispensable.

**CA27** — *Étant donné* une demande de badge, *quand* l'agent génère le code, *alors* le code est à
usage unique, valide 7 jours, et la marche à suivre (enregistrement DNS ou page du domaine) est
affichée à la marque.

**CA28** — *Étant donné* un code publié par la marque, *quand* l'agent le constate lui-même en ligne
et enregistre son constat, *alors* le constat porte son identité et son horodatage — **une capture
fournie par la marque ne permet jamais de valider**.

**CA29** — *Étant donné* un pays dont le registre d'immatriculation n'est pas consultable, *quand*
l'agent traite la demande, *alors* elle est refusée avec le motif dédié et **aucun badge dégradé
n'est attribué**.

**CA30** — *Étant donné* un badge attribué, *quand* il s'affiche sur une campagne, dans une fiche ou
dans une conversation, *alors* **sa date apparaît à chaque fois**.

**CA31** — *Étant donné* un badge attribué il y a 12 mois, *quand* l'échéance est atteinte, *alors*
il passe en « à rafraîchir », reste visible et daté, et est retiré à la fin du délai de grâce.

**CA32** — *Étant donné* un badge retiré, *quand* la décision est enregistrée, *alors* un motif typé
est obligatoire, la marque est notifiée, et le badge disparaît immédiatement de tous les écrans.

**CA33** — *Étant donné* un créateur en mise en relation ouverte avec une marque vérifiée, *quand*
il demande à voir les pièces de vérification, *alors* **aucun chemin ne le lui permet**.

**CA34** — *Étant donné* le libellé du badge, *quand* on le lit, *alors* il n'affirme ni solvabilité,
ni sérieux, ni qualité, et il nomme exactement ce qui a été contrôlé.

### Complétude

**CA35** — *Étant donné* un profil dont seuls le nom, le secteur, la taille, le pays et la
présentation sont renseignés, *quand* le score est calculé, *alors* il vaut exactement la somme des
poids de RG58 correspondants, et le détail est affiché bloc par bloc.

**CA36** — *Étant donné* un profil complet à 100 % dont la demande de badge est **en attente**,
*quand* l'agent tarde à la traiter, *alors* le score **ne baisse pas** (RG59).

**CA37** — *Étant donné* un profil complet à 40 %, *quand* l'annonceur demande la publication et que
tous les champs obligatoires sont renseignés, *alors* la publication est acceptée : **le score n'est
pas un seuil d'accès**.

**CA38** — *Étant donné* le message de complétude, *quand* on le lit, *alors* il nomme les champs
manquants et leur effet observable, et ne contient **aucune promesse de résultat chiffrée**.

**CA39** — *Étant donné* chaque champ du formulaire, *quand* l'annonceur le survole ou le
sélectionne, *alors* son étiquette de couche est visible (publique · masquée jusqu'à la mise en
relation · interne).

### Leads et états d'écran

**CA40** — *Étant donné* une première publication de profil, *quand* elle est enregistrée, *alors*
un événement `profile.completed` est émis et les attributs de RG79 sont mis à jour chez Brevo si le
consentement est enregistré.

**CA41** — *Étant donné* un annonceur **sans** consentement marketing, *quand* son profil est publié,
*alors* aucun contact marketing n'est mis à jour, la ligne est marquée « ignoré — sans
consentement », et **elle n'apparaît pas dans le compteur d'échecs**.

**CA42** — *Étant donné* un profil publié, *quand* on inspecte ce qui est envoyé à Brevo et Apollo,
*alors* la raison sociale, le numéro d'immatriculation, les notes internes et les coordonnées de
l'interlocuteur **n'y figurent pas**.

**CA43** — *Étant donné* Brevo et Apollo indisponibles, *quand* un profil est publié, *alors* la
publication aboutit normalement et les lignes de synchronisation sont en attente.

**CA44** — *Étant donné* une saisie en cours, *quand* le navigateur est fermé puis rouvert, *alors*
le brouillon est intégralement retrouvé.

**CA45** — *Étant donné* une erreur réseau au dépôt du logo, *quand* le message s'affiche, *alors*
tous les autres champs saisis sont conservés et le dépôt peut être retenté.

**CA46** — *Étant donné* chacun des messages de RG84, *quand* la langue de l'interface est
l'anglais, *alors* la version anglaise s'affiche, sans aucun texte français résiduel.

**CA47** — *Étant donné* les quatre états d'un profil, *quand* ils s'affichent, *alors* chacun porte
un **libellé écrit**, et la couleur n'est jamais le seul porteur de l'information.

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Espace | Écran | Remarque |
|---|---|---|
| Membre marque | Profil — vue d'ensemble avec complétude par bloc | Étiquette de couche sur chaque champ (RG62) |
| Membre marque | Profil — bloc identité publique | Dépôt et recadrage du logo, réduction du site au domaine |
| Membre marque | Profil — bloc attentes de collaboration | Tranches et devises, mention « ne vaut pas engagement » |
| Membre marque | Profil — bloc interlocuteur | **Doit expliquer visuellement le masquage D40**, avant la saisie |
| Membre marque | Profil — bloc interne et demande de badge | Marche à suivre du code de domaine |
| Membre marque | Bandeau d'état (brouillon, en validation, publié, refusé, suspendu) + motif de refus | Cinq états, cinq messages |
| Membre marque | « Ce que voit un créateur » — prévisualisation avant et après mise en relation | RG76 |
| Membre créateur | Encart marque dans une campagne publiée | Sans coordonnées |
| Membre créateur | Encart marque après révélation | Avec la mention de RG42 |
| Backoffice | File « profils marque à valider », fiche de validation, motifs typés | Verrou, ancienneté, alerte doublon |
| Backoffice | File « demandes de badge marque », constat de domaine, registre | Journalisation nominative |
| Backoffice | Fiche marque : coordonnées de l'interlocuteur, notes internes, historique des décisions | Vue de travail du commercial |

### Données (`expert-database`)

Tables prévues et utilisées telles quelles : `profiles.advertiser_profiles`,
`profiles.advertiser_contact_details`, `verification.verification_requests`,
`verification.ownership_codes`, `verification.evidence_files`, `verification.badges`,
`verification.disputes`, `audit.audit_events`, `reference.sectors`, `reference.countries`,
`reference.languages`, `reference.currencies`, `reference.price_bands`, `reference.topics`,
`reference.networks`, `reference.formats`, `reference.usage_rights`.

**Quatre écarts constatés avec `docs/mvp/04-modele-de-donnees-mvp.md` §5.2, à instruire :**

1. **`legal_name` doit quitter `advertiser_profiles` (public) pour le bloc interne.** La raison
   sociale peut être le nom d'une personne physique (entreprise individuelle) : la publier serait une
   divulgation de donnée personnelle sans nécessité (RG21). Le modèle la place aujourd'hui côté
   public.
2. **`contact_role` (la fonction) doit rejoindre `advertiser_profiles` (public)**, alors que le
   modèle le place dans `advertiser_contact_details` (révélable). C'est le déplacement de colonne
   annoncé comme possible au §5.2, sans reprise de droits.
3. **Le pays et le numéro d'immatriculation n'ont pas de colonne** dans `advertiser_profiles` : ils
   sont nécessaires au badge « Marque vérifiée » (RG46).
4. **La re-validation partielle de RG9 suppose de conserver la dernière version validée** des champs
   modérés (nom commercial, logo, présentation, domaine, secteur, fonction) pendant qu'une nouvelle
   version est en examen. Sans cela, une correction de faute rend la marque invisible.

À prévoir également : les paramètres (délai cible de validation, délai d'expiration d'une prise en
charge, durée du code de domaine, péremption et délai de grâce du badge, plafonds de taille de
fichier) vivent **en table**, modifiables sans redéploiement, chaque modification étant journalisée.

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Brevo — contacts** | Mise à jour des attributs de RG79 à la publication et à chaque modification ; aucun envoi marketing sans consentement |
| **Brevo — transactionnel** | Notifications de décision (publié, refusé, badge attribué, badge à rafraîchir, badge retiré), bilingues |
| **Apollo.io** | Enrichissement limité à nom commercial, domaine, secteur, taille, pays, dans le périmètre et la base légale du Lot 1 |
| **Supabase Storage** | Compartiment **privé** pour les logos (`brand-logo`, WebP, `03` P10.1, EC-L2B-6), compartiment privé pour les pièces de vérification, EXIF supprimés au dépôt |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| Profils marque publiés / comptes annonceurs inscrits | Mesuré ; un écart important signale un formulaire trop lourd |
| Délai médian de validation d'un profil marque | **Cible 1 jour ouvré**, alerte à 3 jours ouvrés (RG7) |
| Taux de refus par motif | Suivi ; le motif « Autre » doit rester sous **10 %** (RG67) |
| Complétude moyenne des profils publiés | Mesurée ; identifie les champs systématiquement ignorés |
| Champs renseignés dans moins de 10 % des profils | Candidats au retrait : friction sans contrepartie |
| Badges « Marque vérifiée » actifs, et arrivant à péremption sous 30 jours | Suivi hebdomadaire |
| Consultations du bloc interlocuteur révélé | Mesurées (RG41) ; à croiser avec les conversations éteintes |
| Marques publiées sans logo | Suivi ; indicateur de qualité de l'annuaire de campagnes |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| Annuaire ou recherche de marques par les créateurs | **RG4** : contournement symétrique ; aucune marque ne doit être joignable sans passer par INFLUX | Jamais sous cette forme |
| Plusieurs utilisateurs pour une même marque | Un compte par marque suffit au pilote ; les rôles internes à l'entreprise supposent un modèle d'organisation | Après le pilote |
| Nom, prénom et coordonnées de plusieurs interlocuteurs | Même raison ; un seul interlocuteur au MVP | Après le pilote |
| Comptes de réseaux sociaux de la marque | **RG44** : vecteur de contournement direct | Non planifié |
| Avis, notes, historique public de collaborations | Aucun historique au lancement ; stigmatise ensuite | Après le pilote |
| Numéro de TVA, adresse de facturation, mentions de facturation | **A1** : ni contrat, ni facture dans l'application | V2, avec D7, D22 et D23 |
| Effectif exact, chiffre d'affaires, budget annuel | Données de négociation, sans usage produit | Non planifié |
| Vérification automatique par API d'un registre d'entreprises | Couverture inégale selon les pays, coût, agréments | Après le pilote |
| Badge attribué automatiquement | `profile-verification` : attribution manuelle uniquement | Non planifié |
| Logo animé, bannière, galerie d'images de marque | Coût de modération sans effet mesuré sur la conversion | Après le pilote |
| Traduction automatique de la présentation | La marque écrit dans la ou les langues qu'elle déclare | Après le pilote |
| Portugais et autres langues | Français et anglais au lancement | Avant l'ouverture du Brésil |
| Tout montant de contrat, taux, commission, net créateur | **A1**, `CLAUDE.md` §2 | V2 |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | ✅ ***Tranchée le 2026-11-01 (fondateur) : fonction publique, prénom masqué jusqu'à l'ouverture (RG35, RG36).*** **La fonction de l'interlocuteur est-elle publique, et le prénom masqué ?** D40 ne tranche que l'e-mail et le téléphone. Un prénom associé à un nom de marque se retrouve en une recherche sur un réseau professionnel | **Fonction publique, prénom masqué** (RG35, RG36). Le créateur a besoin de savoir si son interlocuteur décide, pas de savoir qui il est | Fondateur + `expert-ux` + `expert-conformite-rgpd` | Lot 2 |
| **Q2** | ✅ ***Tranchée le 2026-11-01 (fondateur) : durée du registre d'audit.*** **Durée de conservation du journal de consultation du bloc révélé** (RG41), et information des personnes sur ce journal | Journal écrit, durée alignée sur celle du registre d'audit, à confirmer | `expert-conformite-rgpd` (**veto**) | Lot 2 |
| **Q3** | ✅ ***Tranchée le 2026-11-01 (fondateur) : 3 ans, comme les constats d'audience (`08` RG100).*** **Conservation du numéro d'immatriculation et des constats de vérification** après retrait ou péremption du badge | Conservés le temps de la preuve, purge à échéance écrite | `expert-conformite-rgpd` (**veto**) | Lot 2 |
| **Q4** | ✅ ***Tranchée le 2026-11-01 (fondateur) : non (RG80).*** **Faut-il envoyer vers Brevo et Apollo l'e-mail professionnel de l'interlocuteur** lorsqu'il diffère de l'adresse de connexion ? Ce serait un second point de contact sans consentement propre | **Non** (RG80) | `expert-conformite-rgpd` (**veto**) + `expert-marketing` | Lot 2 |
| **Q5** | **Péremption du badge « Marque vérifiée » : 12 mois ?** D34 ne fixe explicitement que les 90 jours du badge d'audience | **12 mois + 30 jours de grâce** (RG54) | `product-owner` + Fondateur, dans **D34** | Lot 2 |
| **Q6** | ✅ ***Tranchée le 2026-11-01 (fondateur) : valeurs de départ ci-contre, en table.*** **Délai cible de validation d'un profil (1 jour ouvré), expiration d'une prise en charge (30 min), durée du code de domaine (7 jours)** | Valeurs de départ ci-contre, **en table** | `chef-de-projet` + Fondateur (cohérence avec **D39**) | Lot 2 |
| **Q7** | ✅ ***Tranchée le 2026-11-01 (fondateur, D79) : aucun pays exclu ; sources admises : registre officiel du pays gratuit et en ligne, ou base mondiale des identifiants LEI (GLEIF) ; registre payant à l'acte, agrégateur privé ou certificat fourni par la marque ne suffisent pas (un agrégateur sert seulement à trouver le registre officiel) ; table des sources par pays tenue par un administrateur, socle puis ajout à la demande (RG52).*** **Liste des pays dont le registre d'immatriculation est consultable en ligne** par un agent, et procédure pour les autres | Refus motivé « immatriculation non vérifiable » tant que la liste n'est pas écrite (RG52) | `chef-de-projet` + juriste | Lot 2 |
| **Q8** | ✅ ***Tranchée le 2026-11-01 (fondateur) : oui, logo fortement incité mais non bloquant (RG15).*** **Une marque peut-elle publier son profil sans logo ?** Un annuaire de campagnes sans logo est nettement moins crédible | **Oui**, logo fortement incité mais non bloquant (RG15) | `expert-ux` + `chef-de-projet` | Lot 2 |
| **Q9** | **Faut-il conditionner la recherche de créateurs à la publication du profil** (RG8) ? C'est une protection anti-aspiration, mais aussi une friction sur le parcours annonceur | **Oui**, conditionnée | `chef-de-projet` + Fondateur | **Avant le Lot 3** |
| **Q10** | **Libellé juridique exact du badge « Marque vérifiée »**, en français et en anglais, relu par un juriste avant tout affichage | Substance fixée par RG49 et RG50 ; rédaction à produire | `expert-conformite-rgpd` + juriste | Lot 2 |
| **Q11** | **Que doit dire « ce que cela change » de RG61 et CA38 (« effet observable ») ?** Le message de complétude nomme les champs manquants et l'action qu'ils bloquent (la soumission) ; les phrases d'effet de RG61 (« Sans budget indicatif, les créateurs ne peuvent pas savoir… », « sans image ») ne sont portées par aucune clé de RG84 ni par aucun écran | Le message nomme les manquants et l'action qu'ils bloquent, rien d'autre ; aucun texte d'effet ajouté tant que la question n'est pas tranchée | `product-owner` | Avant le Lot 3 |
