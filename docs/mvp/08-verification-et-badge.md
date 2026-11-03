# Lot 2 — Vérification des profils et badge : ce qu'INFLUX affirme, sur quelles pièces, et pour combien de temps

> **✳️ Additif du 2026-09-30 — D65 (arbitrage du fondateur) : connexion OAuth YouTube en fin de MVP et trajectoire de remplacement des challenges de bio.** En fin de MVP (Lot 6 / transition V2), INFLUX intègre la **connexion OAuth pour YouTube** afin de valider la propriété d'une chaîne et de remonter ses métriques directement. Pour les autres réseaux (Instagram, TikTok, etc.), le **challenge de bio temporaire** (code public constaté par un agent, §C RG21 à RG30) demeure le procédé nominal de départ au MVP, avec pour vocation d'être **progressivement remplacé par du OAuth** au fur et à mesure des accords et agréments API. Voir `decisions.md` (D65).

> **Date :** 2026-09-19 · **Auteur :** agent `product-owner` · **Statut :** spécification complète de
> la vérification et du badge (Lot 2), soumise à la validation de `chef-de-projet`, avec **avis
> obligatoire (veto) de `expert-conformite-rgpd`** sur les §I (données de tiers, conservation des
> pièces), §H (contestation) et §Questions ouvertes, et **avis obligatoire de `expert-cybersecurite`**
> sur le §I (stockage et lecture des pièces).
>
> **Skills appliquées :** `feature-spec` (format de sortie), `profile-verification` (mode opératoire
> principal), `backoffice-ops` (file, verrou, motifs typés, SLA, actions irréversibles),
> `matching-spec` (règle des tranches), `design-system-influx` (états d'écran, affichage du badge).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` (source de vérité),
> `docs/mvp/00-cadrage-mvp-v2.md` (périmètre, arbitrages A1 à A10, Lot 2, **D34**, **D38**, **D39**),
> `docs/mvp/03-matrice-des-droits-et-rls.md` §3.2 (conditions **C(12)**, **C(13)**, **C(14)**) et §6.6
> (exception E1 sur le stockage de fichiers), `docs/mvp/04-modele-de-donnees-mvp.md` §5.3
> (`verification.*`) et §5.2 (`profiles.creator_public_*`, `profiles.creator_social_accounts`),
> `docs/mvp/05-spec-inscription-et-leads.md` (attestation de majorité, RG19),
> `docs/mvp/06-criteres-profil-marque.md` §E (parcours du badge « Marque vérifiée »).
>
> **Ce que ce document tranche :** ce que chaque badge affirme et ce qu'il n'affirme **jamais**, les
> trois niveaux et ce que chacun débloque, la preuve de propriété d'un compte, les pièces acceptées
> pour la preuve d'audience et leur fraîcheur, la procédure de l'agent pas à pas, la liste **fermée**
> des motifs de refus et de retrait avec leur message, la file de vérification et son SLA, la
> péremption à 90 jours, le rafraîchissement, le retrait, la contestation, le stockage des pièces, le
> traitement des données de tiers dans les captures, et les libellés proposés au titre de **D34**.
>
> **Ce qu'il ne tranche pas :** la maquette et la microcopie (`expert-ux`), le schéma SQL, les
> politiques d'accès et la rétention technique (`expert-database`, `expert-cybersecurite`), le
> parcours détaillé du badge « Marque vérifiée » (déjà tranché par
> `06-criteres-profil-marque.md` §E), les pondérations de recherche (**D11**, reportée), la date
> d'ouverture de la recherche (**D38**).
>
> **Invariant rappelé :** aucun contrat, aucune facture, aucun encaissement, **aucun calcul de
> commission** n'existe dans ce périmètre (arbitrage **A1**). Le badge ne porte **aucun montant**,
> d'aucune sorte.
>
> **Le point qui commande tout le reste :** *le libellé du badge engage la responsabilité d'INFLUX.*
> Une marque qui se fie au badge et découvre des chiffres faux se retourne contre la plateforme, pas
> contre le créateur. Le §A n'est donc pas une introduction : c'est la règle la plus contraignante du
> document, et toutes les autres en découlent.

---

## Besoin

**Donner à une marque une seule information non déclarative sur un créateur — un chiffre constaté sur
pièce, à une date donnée, par une personne nommée — sans jamais lui laisser croire qu'INFLUX garantit
quoi que ce soit d'autre.**

Trois raisons d'être, dans cet ordre :

1. **Commerciale.** Tout le reste d'un profil créateur est déclaratif : les thématiques, les formats,
   les tarifs, les chiffres d'audience. Le badge est la seule chose qu'un commercial INFLUX peut
   défendre en rendez-vous. Sans lui, la plateforme vend des déclarations.
2. **Juridique.** Un badge est une affirmation publique d'INFLUX sur un tiers. Mal rédigé, il crée une
   obligation qu'INFLUX ne peut pas tenir : le MVP **ne dispose d'aucun outil de détection de faux
   abonnés**, et n'en aura pas avant d'avoir tranché la question ouverte **Q3**.
3. **Opérationnelle.** La vérification est entièrement manuelle. Si la procédure n'est pas écrite au
   geste près, elle est ingérable dès la cinquantième demande, et deux agents ne rendront jamais la
   même décision sur le même dossier.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Créateur** | Demande un niveau de vérification, colle un code dans la bio de son réseau, dépose des captures, corrige, redépose, conteste, rafraîchit |
| **Annonceur** | **Lit** un badge et sa date. Il ne demande rien, ne voit aucune pièce, et n'a **aucun** moyen d'en obtenir une (**C(13)**) |
| **Marque** (même compte annonceur) | Demande le badge « Marque vérifiée » — parcours détaillé dans `06` §E ; seules les règles communes de ce document s'y appliquent en plus |
| **Commercial INFLUX** (rôle `agent`) | Prend une demande en charge, constate le code en ligne, ouvre les pièces, **saisit lui-même les valeurs constatées**, accorde ou refuse avec un motif typé, demande un retrait |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède, plus : approbation d'un retrait de badge (**2V**), suppression d'une pièce, traitement d'une contestation, gestion des paramètres |
| **Système** | Génère et périme les codes, calcule les tranches publiées à partir des valeurs constatées, envoie les rappels J-15, fait passer les badges en « à rafraîchir » puis en « expiré », purge les pièces, journalise |

> **Deux populations, deux parcours.** Les §C, §D et §E ne concernent **que** le créateur. La marque
> suit le parcours de `06` §E (contrôle de domaine et d'immatriculation), avec sa propre liste de
> motifs de refus. Aucun écran, aucune liste de motifs, aucun message n'est partagé entre les deux
> populations. Ce qui est **commun** : ce que le badge affirme (§A), la file et son SLA (§G), la
> péremption et le retrait (§H), le stockage et la journalisation (§I).

---

## User stories

### Créateur

- **US1** — En tant que **créateur**, je veux prouver que le compte que je déclare est bien le mien,
  afin qu'une marque sache qu'elle ne parle pas à quelqu'un qui affiche l'audience d'un autre.
- **US2** — En tant que **créateur**, je veux faire constater mes chiffres d'audience sur pièce, afin
  d'être distingué de ceux qui déclarent n'importe quoi.
- **US3** — En tant que **créateur**, je veux savoir exactement quelles captures fournir, et ce que je
  dois masquer dessus, afin de ne pas perdre trois allers-retours et d'exposer le moins possible.
- **US4** — En tant que **créateur**, je veux comprendre pourquoi ma demande est refusée et ce que je
  dois faire, afin de pouvoir recommencer seul, sans écrire à l'assistance.
- **US5** — En tant que **créateur**, je veux être prévenu **avant** que mon badge se périme, afin de
  ne pas perdre ma visibilité sans m'en rendre compte.
- **US6** — En tant que **créateur**, je veux contester un refus ou un retrait, afin qu'une erreur
  d'appréciation puisse être corrigée par quelqu'un d'autre que celui qui l'a commise.
- **US7** — En tant que **créateur**, je veux savoir ce que mon badge affiche publiquement, afin de ne
  pas découvrir qu'un chiffre exact que je croyais interne est visible.

### Annonceur

- **US8** — En tant qu'**annonceur**, je veux voir sur quoi porte un badge, **quand** le constat a été
  fait et **d'où** viennent les chiffres, afin de savoir ce que je peux en attendre.
- **US9** — En tant qu'**annonceur**, je veux pouvoir ne voir que des profils vérifiés, afin de gagner
  du temps quand mon budget est engagé.
- **US10** — En tant qu'**annonceur**, je veux comprendre en une phrase ce que le badge ne garantit
  pas, afin de ne pas prendre une vérification pour une caution de qualité.

### Commercial et administrateur

- **US11** — En tant que **commercial**, je veux traiter une demande de vérification sans ouvrir
  quatre onglets, afin d'en traiter cinquante par jour et pas dix.
- **US12** — En tant que **commercial**, je veux saisir moi-même les valeurs que je lis sur la pièce,
  afin que le mot « vérifié » veuille dire quelque chose.
- **US13** — En tant que **commercial**, je veux voir l'écart entre ce que le créateur a déclaré et ce
  que j'ai constaté, afin de savoir à qui j'ai affaire avant de le proposer à une marque.
- **US14** — En tant qu'**administrateur**, je veux retirer un badge avec un motif et une trace, afin
  de réagir à une pièce fausse sans supprimer le compte.
- **US15** — En tant qu'**administrateur**, je veux voir combien de badges arrivent à échéance, afin
  que la charge de rafraîchissement ne me tombe pas dessus d'un coup.

### Système

- **US16** — En tant que **système**, je veux qu'aucune pièce de vérification ne puisse être servie à
  un annonceur par aucun chemin, afin que l'interdiction ne dépende pas de la vigilance d'un
  développeur.
- **US17** — En tant que **système**, je veux qu'un badge d'audience cesse de s'afficher comme actif
  au bout de 90 jours sans intervention humaine, afin qu'aucun chiffre périmé ne soit présenté comme
  vérifié.

---

## Règles de gestion

### A — Ce que le badge affirme, et ce qu'il n'affirme pas

> C'est **le libellé affiché** qui crée l'engagement d'INFLUX, pas la procédure interne. Cette section
> prime sur toutes les autres : en cas de contradiction entre une règle de procédure et une règle du
> §A, c'est le §A qui gagne.

**RG1** — Un badge INFLUX affirme **exactement quatre choses**, et rien d'autre :

| Ce que le badge affirme | Preuve associée |
|---|---|
| Qu'un **fait précis** a été constaté (propriété d'un compte, valeur d'audience, existence d'une société) | La pièce ou le constat en ligne |
| Qu'il a été constaté **sur pièce**, pas sur déclaration | La pièce déposée, ou le constat effectué par l'agent lui-même |
| Qu'il a été constaté par **un agent INFLUX nommé** | Identité de l'agent, conservée en interne |
| Qu'il a été constaté **à une date donnée**, sur une **période donnée**, depuis une **source donnée** | Horodatage, période lisible sur la pièce, source (tableau de bord natif du réseau) |

**RG2** — Un badge INFLUX **n'affirme jamais**, sous aucune forme, ni dans le libellé, ni dans l'aide,
ni dans une infobulle, ni dans un e-mail, ni dans un discours commercial :

| Ce que le badge n'affirme jamais | Pourquoi c'est interdit |
|---|---|
| **Que les abonnés sont authentiques** | INFLUX **ne dispose d'aucun outil de détection de faux abonnés au MVP**. Toute mention, même prudente, serait une affirmation sans moyen de preuve |
| Que l'audience restera stable | Le constat porte sur une période passée, il ne prédit rien |
| Quelle performance une campagne obtiendra | INFLUX n'a aucune donnée de performance au MVP |
| Que le créateur est sérieux, professionnel, fiable ou de qualité | Ce n'est pas mesuré, donc ce n'est pas affirmé |
| Que le créateur respectera ses engagements | Aucun contrat n'existe dans le périmètre (**A1**) |
| Pour une marque : qu'elle est solvable ou qu'elle paiera | `06` RG50 |

**RG3** — **Test de rédaction, applicable à chaque libellé avant tout affichage :** « suis-je capable
de défendre cette phrase devant une marque mécontente, pièce en main ? » Si la réponse est non, le
libellé est refusé. Ce test est un **point de contrôle de revue**, au même titre qu'un test
automatisé.

**RG4** — **La date accompagne le badge partout où il apparaît**, sans exception : résultat de
recherche, fiche de profil, encart de candidature, en-tête de conversation, e-mail de notification,
export interne. Un badge sans date est un badge qui ment par omission, et son affichage est un défaut
bloquant.

**RG5** — Pour le niveau « Audience vérifiée », le badge affiche également **le réseau** et **la
source du constat**. Un badge qui ne dit pas d'où vient le chiffre ne se défend pas.

**RG6** — Aucun libellé de badge ne contient de superlatif, de mention de confiance, de mention de
certification, ni d'étoile. Sont **interdits** : « Créateur vérifié », « Profil de confiance »,
« Certifié », « Créateur premium », « Top créateur », « Recommandé par INFLUX ».

**RG7** — Le badge est accompagné, partout où il est affiché à un annonceur, d'un accès à une
**explication courte** rappelant ce qu'il affirme et ce qu'il n'affirme pas. Cette explication est
**au même endroit que le badge**, pas dans une page d'aide qu'il faut chercher.

**RG8** — Aucun écran, aucun e-mail et aucune donnée de ce périmètre ne contient de montant de
contrat, de taux de commission, de commission INFLUX ni de net créateur (**A1**). Le badge ne porte
aucun montant, et n'a aucun effet sur un montant.

**RG9** — **Le badge est attribué à la main par un agent ou un administrateur, jamais autrement.**
Aucune attribution automatique, aucune attribution par un connecteur d'API, aucune attribution par
lot, aucune attribution par expiration d'un délai. Une attribution automatique est un défaut bloquant.

**RG10** — **Libellés proposés au titre de D34** (proposition du `product-owner`, à valider par le
fondateur et relire par un juriste avant tout affichage — **Q1**) :

| Niveau | Français | English |
|---|---|---|
| **Compte vérifié** | « Compte vérifié — {réseau}, le {date} » · sous-ligne : « INFLUX a constaté que ce compte appartient au créateur inscrit. » | "Account verified — {network}, on {date}" · "INFLUX confirmed this account belongs to the registered creator." |
| **Audience vérifiée** | « Audience vérifiée — {réseau}, le {date} » · sous-ligne : « Chiffres constatés par INFLUX sur le tableau de bord {réseau}, période du {début} au {fin}. INFLUX ne se prononce pas sur l'authenticité des abonnés. » | "Audience verified — {network}, on {date}" · "Figures observed by INFLUX in the {network} native dashboard, period {start} to {end}. INFLUX makes no claim about follower authenticity." |
| **Marque vérifiée** | « Marque vérifiée le {date} — domaine et immatriculation contrôlés. » (repris de `06` RG49) | "Brand verified on {date} — domain and company registration checked." |
| **État « à rafraîchir »** | « Audience vérifiée le {date} — vérification à rafraîchir. » | "Audience verified on {date} — verification needs refreshing." |

La mention « INFLUX ne se prononce pas sur l'authenticité des abonnés » est **la contrepartie exacte
de l'absence d'outil de détection**. Elle n'est ni négociable, ni déplaçable dans une page d'aide,
tant que **Q3** n'est pas tranchée.

### B — Les trois niveaux, et ce que chacun débloque

**RG11** — Il existe **trois niveaux de vérification, et trois seulement** :

| Niveau | Population | Ce qui est vérifié | Comment | Portée |
|---|---|---|---|---|
| **Compte vérifié** | Créateur | La **propriété** du compte sur le réseau | Code INFLUX constaté en ligne par l'agent (§C) | **Par réseau** |
| **Audience vérifiée** | Créateur | Les **valeurs d'audience** | Capture du tableau de bord natif, constatée et saisie par l'agent (§D) | **Par réseau** |
| **Marque vérifiée** | Annonceur | Le **domaine** et l'**immatriculation** | Code de domaine + registre public (`06` §E) | Par compte |

**RG12** — **« Audience vérifiée » suppose « Compte vérifié » sur le même réseau.** Une demande
d'audience portant sur un réseau dont la propriété n'est pas établie est **refusée** avec le motif
dédié : constater les chiffres d'un compte dont on ignore le titulaire, c'est constater les chiffres
de n'importe qui.

**RG13** — **Le badge est par réseau, jamais par personne.** Il n'existe **aucun badge global**, aucun
badge « créateur vérifié », aucun agrégat. L'interface affiche, réseau par réseau, ce qui est vérifié
et ce qui ne l'est pas.

**RG14** — Une **demande** porte sur un triplet unique **(compte, réseau, niveau)**. Deux demandes
actives sur le même triplet sont impossibles : la seconde affiche « demande déjà en cours depuis
le {date} ».

**RG15** — Ce que chaque niveau **débloque dans le produit** :

| Niveau obtenu | Effet produit | Lot |
|---|---|---|
| **Compte vérifié** (≥ 1 réseau) | Le profil créateur devient publiable ; il devient éligible à une proposition INFLUX ; la mention « propriété du compte constatée » s'affiche | 2 |
| **Audience vérifiée** (par réseau) | La **tranche d'engagement** du réseau devient affichable (elle reste **nulle** sans vérification, `04` §5.2) ; les **trois métriques prioritaires** (`07` RG113 : tranche d'audience, rythme de publication, tranche de commentaires) sont marquées « constatées » et non « déclarées » (RG38bis) | 2 |
| **Audience vérifiée** (par réseau) | **Facette de recherche « profils vérifiés »** côté marque et côté commercial | 3 |
| **Audience vérifiée** (par réseau) | **Campagnes réservables aux profils vérifiés** — option de la campagne, **désactivée au lancement** (voir RG18) | 3 |
| **Marque vérifiée** | Affichage du badge sur les campagnes de la marque (`06` RG53) | 2 |

**RG16** — **Un profil créateur ne peut être publié sans au moins un « Compte vérifié ».** C'est le
seul verrou d'accès porté par le badge : il garantit qu'aucune audience affichée dans le produit
n'appartient à un compte dont le titulaire est inconnu. Il ne coûte rien au créateur honnête (coller
un code, quelques minutes) et il arrête le faux profil au premier geste.

**RG17** — **« Audience vérifiée » n'est jamais une condition de publication ni d'accès.** Un créateur
dont la propriété du compte est établie peut exister dans le produit avec des chiffres déclarés,
clairement étiquetés « déclaré ». Exiger l'audience vérifiée pour exister viderait la plateforme au
démarrage (**D38**).

**RG18** — L'option de campagne « réservée aux profils dont l'audience est vérifiée » existe en base
dès le Lot 3, mais elle est **désactivée tant que la masse critique de D38 n'est pas atteinte**.
L'activation est un **paramètre en table**, pas un déploiement. Raison : réserver des campagnes rend
le badge désirable, mais réduit le vivier au moment précis où il est le plus fragile (**Q4**).

**RG19** — Partout où un chiffre d'audience est affiché, il porte **son origine** : « constaté par
INFLUX le {date} » ou « déclaré par le créateur le {date} ». Les deux ne se ressemblent jamais
visuellement, et **la couleur n'est jamais le seul porteur de la distinction**.

**RG20** — Les valeurs publiées sont **des tranches, jamais des valeurs exactes** — y compris
lorsqu'elles ont été constatées. La valeur exacte constatée reste interne et n'est révélée à un
annonceur qu'après la révélation d'identité (`04` §5.2, sous-ensemble révélable). **La tranche publiée
est calculée par le système** à partir de la valeur constatée saisie par l'agent ; l'agent ne
saisit jamais une tranche à la main.

### C — Prouver la propriété d'un compte

**RG21** — INFLUX **génère un code** à usage unique, rattaché au triplet (compte, réseau, demande),
non devinable, non séquentiel, distinct de tout autre code du produit. Format proposé : `INFLUX-` +
8 caractères alphanumériques majuscules sans caractères ambigus.

**RG22** — Le code est **valide 7 jours** (valeur de départ, **paramètre en table**, voir **Q5**). À
son expiration, la demande passe en « expirée » et le créateur peut en générer un nouveau sans délai.

**RG23** — **Un seul code valide à la fois par triplet.** Toute nouvelle génération invalide
immédiatement le précédent.

**RG24** — Le créateur **colle le code dans un champ public et modifiable** de son profil de réseau :
biographie (Instagram, TikTok), description de chaîne (YouTube), champ équivalent pour un autre
réseau. Il peut le retirer **dès que le constat est enregistré**, et l'interface le lui dit.

**RG24bis** — **Trajectoire OAuth (D65)** : Dès la fin du MVP, la vérification de la propriété d'une chaîne YouTube s'effectue prioritairement par flux **OAuth direct** (Google / YouTube Data API). Pour les autres réseaux (Instagram, TikTok), le **challenge de code temporaire en bio** (ou description publique) reste la méthode opérationnelle en vigueur au lancement, et sera progressivement remplacé par une connexion OAuth au fil de l'obtention des agréments API respectifs.

**RG25** — **L'agent constate lui-même le code en ligne**, depuis le profil public du réseau, et
enregistre son constat : horodatage + identité de l'agent + identifiant du compte observé. **Une
capture d'écran fournie par le créateur ne vaut jamais preuve de propriété** : elle se fabrique en
trente secondes.

**RG26** — **Le constat doit être possible sans être connecté au réseau et sans être abonné au
compte.** Si le champ n'est pas consultable publiquement, la propriété n'est pas établie.

**RG27** — **Compte privé ou non consultable publiquement** : la demande est **refusée** avec le motif
« compte non consultable publiquement », et le message explique les deux options : rendre le compte
public le temps du constat, ou renoncer à la vérification de ce réseau. **Aucune voie alternative
n'est ouverte au MVP.**

**RG28** — Alternatives **explicitement refusées**, à inscrire dans l'aide : message privé envoyé
depuis le compte, capture d'un espace connecté, capture du champ de bio, attestation sur l'honneur,
lien de profil seul, appel vidéo, transmission d'identifiants (qu'INFLUX ne demande **jamais**).

**RG29** — **INFLUX ne demande jamais le mot de passe d'un réseau, ni un accès délégué, ni un code
reçu par un créateur.** Cette phrase figure dans l'écran de demande et dans l'e-mail associé : c'est
la meilleure protection contre quelqu'un qui se ferait passer pour INFLUX.

**RG30** — « Compte vérifié » **ne se périme pas au calendrier** : la propriété d'un compte ne change
pas toute seule. Elle est **re-contrôlée** dans trois cas : à chaque demande d'audience sur le même
réseau (l'agent revoit l'identifiant du compte), lors d'un changement d'identifiant déclaré (RG78),
et sur signalement. Sa **date de constat reste affichée** en permanence.

### D — Prouver l'audience : pièces acceptées et fraîcheur

**RG31** — **Seule une capture du tableau de bord natif du réseau, datée de moins de 30 jours,
montrant simultanément l'identifiant du compte, la période couverte et les valeurs, vaut preuve
d'audience.** Cette règle n'a aucune exception.

**RG32** — Pièces attendues, réseau par réseau :

| Réseau | Pièce attendue | Ce qui doit être lisible sans ambiguïté |
|---|---|---|
| **Instagram** | Statistiques du compte professionnel (« Insights ») | Identifiant du compte, nombre d'abonnés, couverture, **période affichée**, pays principaux |
| **TikTok** | Espace analytique du compte | Identifiant, abonnés, vues, **période**, territoires |
| **YouTube** | Espace créateur (« YouTube Studio ») | Nom de la chaîne, abonnés, vues, **période**, pays |
| **Autre réseau** (un réseau de la liste `reference.networks`) | Outil natif équivalent | Mêmes exigences, sans dérogation |

**RG33** — Sont **refusées d'office**, chacune avec son motif typé (§F) : capture issue d'un **outil
tiers** (mesure d'audience, agence, tableur, capture d'un rapport PDF d'agence) ; **chiffres retapés**
dans un message ou un champ de texte ; capture **sans identifiant de compte visible** ; capture
**rognée** masquant la période ; capture **de plus de 30 jours** ; document **retouché** ou dont la
cohérence interne est douteuse ; capture **montrant des données de tiers** au-delà de ce que les
instructions autorisent (RG87).

**RG34** — Formats acceptés : **images uniquement** (PNG, JPEG, WebP), conformément à `03` §6.6
règle **E1-9**. Le **PDF est refusé au MVP**. Taille maximale par fichier et nombre maximal de
fichiers par demande : **paramètres en table** (valeurs de départ proposées : 8 Mo, 6 fichiers).

**RG35** — Les **métadonnées EXIF sont supprimées au dépôt**, avant tout examen, et le fichier est
**re-encodé**. Une capture prise depuis un téléphone peut contenir une géolocalisation : c'est une
donnée personnelle sans rapport avec l'objet de la vérification.

**RG36** — La **fraîcheur se mesure sur la période affichée dans la capture**, pas sur la date de
dépôt ni sur la date du fichier. Une capture déposée aujourd'hui mais montrant une période close il y
a deux mois est **trop ancienne**.

**RG37** — L'agent **saisit la période constatée** (début et fin) en plus des valeurs. Sans période
saisie, la décision ne peut pas être enregistrée.

**RG38** — Les valeurs constatées obligatoires pour accorder « Audience vérifiée » sont : **nombre
d'abonnés** et **période**. Les valeurs facultatives sont : **taux d'engagement**, **pays principal
d'audience** et sa **part**, **répartition par âge et par genre**. Une valeur facultative non lisible
sur la pièce **n'est pas saisie** — elle n'est jamais estimée, jamais déduite, jamais reprise du
déclaratif.

**RG38bis** — **Métriques prioritaires (D61, additif du 2026-09-25).** À chaque vérification
d'audience, l'agent constate **aussi** les deux autres métriques prioritaires de `07` RG113, **sur le
profil public du compte** et selon les définitions de `07` RG114 et RG115 : le **nombre de
publications permanentes des 30 derniers jours** (ni stories, ni directs) et le **nombre moyen de
commentaires sur les 12 dernières publications permanentes, hors jeux-concours**. Ce constat **n'est
pas une preuve d'audience** au sens de RG31 : il porte sur des décomptes publics, pas sur des
statistiques privées, et ne déroge donc pas à RG31. Les deux valeurs sont **obligatoires pour
accorder « Audience vérifiée »**, avec la **date du constat** ; un compte dont les publications ne
sont pas consultables publiquement est refusé avec `account_not_public`. L'agent **n'enregistre que
des nombres** : ni texte de commentaire, ni nom de commentateur, ni capture de commentaires (RG87).
RG39 à RG42 s'appliquent : valeur déclarée conservée à part, écart conservé et affiché à l'agent,
alerte au-delà de 30 %. Ce mode de constat est soumis à `07` **Q17**.

**RG39** — **Un champ non constaté reste vide et s'affiche comme déclaré.** Il n'existe aucun état
intermédiaire entre « constaté » et « déclaré ».

**RG40** — La **valeur déclarée par le créateur reste visible à part**, étiquetée « déclaré », et
**n'est jamais écrasée** par la valeur constatée. Les deux coexistent : l'une est ce que dit le
créateur, l'autre ce qu'a vu INFLUX.

**RG41** — **L'écart entre le déclaré et le constaté est conservé et affiché à l'agent**, jamais
publié. C'est un signal commercial : un créateur qui déclare 120 000 abonnés quand la capture en
montre 38 000 n'est pas dans la même catégorie qu'un créateur exact à 2 % près.

**RG42** — Un écart supérieur à **30 %** entre déclaré et constaté déclenche une **alerte interne**
sur le compte, visible du commercial. Il ne provoque **ni refus automatique, ni mention publique**
(valeur de départ, paramètre en table).

### E — La procédure de l'agent, pas à pas

> Cette section est écrite pour qu'un commercial recruté le matin puisse traiter une demande
> l'après-midi, sans formation. Chaque étape est un geste, dans l'ordre, avec ce qui l'arrête.

**RG43** — **Étape 1 — Prendre la demande en charge.** L'agent ouvre la file « profils à vérifier »,
choisit l'entrée la plus ancienne et la **prend en charge**. La prise en charge pose un **verrou
nominatif** visible des autres agents (« En cours — Marie »). Aucun examen n'est possible sans prise
en charge.

**RG44** — **Étape 2 — Vérifier que la demande est recevable.** L'agent contrôle, dans l'ordre :

1. Le compte n'est ni suspendu, ni en cours de suppression → sinon, la demande est close sans examen,
   avec le motif « compte indisponible ».
2. L'attestation de majorité est présente (`05` RG19) et **aucun élément du dossier ne contredit la
   majorité déclarée** → sinon, **arrêt immédiat** (RG54).
3. Pour une demande d'audience : le niveau « Compte vérifié » existe sur ce réseau → sinon, refus
   « compte non prouvé » (RG12).

**RG45** — **Étape 3 — Constater la propriété du compte** (demande de niveau « Compte vérifié »).
L'agent ouvre le profil public du réseau, **sans être connecté**, lit le code, le compare au code
généré, puis enregistre son constat. Si le code est absent, différent, ou le profil inaccessible : il
refuse avec le motif correspondant. **Il ne prolonge jamais, ne devine jamais, ne contacte jamais le
créateur hors plateforme.**

**RG46** — **Étape 4 — Ouvrir les pièces** (demande de niveau « Audience vérifiée »). Les pièces
s'ouvrent **dans le backoffice**, jamais par un lien téléchargeable, jamais dans un onglet externe
(**C(14)**). Chaque ouverture est journalisée. L'agent contrôle, dans cet ordre :

| Contrôle | Ce qui l'arrête |
|---|---|
| L'identifiant du compte est visible et **correspond** au compte vérifié | Refus « pièce illisible ou incomplète » ou « incohérence entre les pièces » |
| La période est lisible | Refus « pièce illisible ou incomplète » |
| La période se termine il y a **moins de 30 jours** | Refus « pièce trop ancienne » |
| La source est le tableau de bord natif | Refus « source non acceptée » |
| Les pièces sont cohérentes entre elles | Refus « incohérence entre les pièces » |
| La capture ne montre pas de données de tiers au-delà des instructions | Refus « pièce non conforme aux instructions de capture » + **suppression immédiate de la pièce** (RG88) |
| L'image ne présente pas de signe de retouche | Refus « soupçon de document modifié » + escalade à un administrateur |

**RG47** — **Étape 5 — Saisir les valeurs constatées.** L'agent **tape lui-même** ce qu'il lit :
abonnés, période, et les valeurs facultatives lisibles. **Il n'existe aucun bouton « reprendre la
valeur déclarée », aucune pré-saisie depuis le déclaratif, aucun copier-coller automatique.** Un
système qui recopie la déclaration et la marque « vérifiée » ne vérifie rien : il recopie.

**RG48** — **Étape 6 — Comparer.** L'écran affiche côte à côte le déclaré et le constaté, et l'écart
calculé. L'agent en prend connaissance ; il ne le modifie pas.

**RG49** — **Étape 7 — Décider.** Deux issues, et deux seulement : **accorder** le niveau demandé, ou
**refuser avec un motif typé** (§F). Il n'existe **aucune troisième voie** : pas de « en attente »,
pas de « à revoir plus tard », pas de badge partiel, pas de badge dégradé.

**RG50** — Une seule exception au caractère binaire de la décision : **« à réexaminer »**, réservé aux
cas où l'examen est matériellement impossible **du fait d'INFLUX ou d'un tiers** (pièce illisible pour
raison technique, réseau inaccessible, registre public en panne). L'entrée **retourne dans la file**
avec un motif interne, elle n'est **jamais** close, et son ancienneté **continue de courir**.

**RG51** — **Étape 8 — La décision est enregistrée avec l'identité de l'agent et son horodatage.**
Toute décision, favorable ou non, alimente le journal d'audit. Une décision anonyme est un défaut
bloquant.

**RG52** — **Étape 9 — Le créateur est notifié**, dans sa langue, par un e-mail transactionnel, avec
le message associé au motif (§F) et ce qu'il peut faire ensuite. Une décision non notifiée est une
décision invisible, donc contestable.

**RG53** — Un agent **ne traite jamais sa propre demande**, ni celle d'un compte dont il est le
titulaire ou le bénéficiaire (`backoffice-ops` règle 46). Le contrôle est porté par le serveur.

**RG54** — **Créateur mineur détecté à n'importe quelle étape** (mention d'âge sur une pièce, contenu
du profil, déclaration dans un échange) : **arrêt immédiat de la procédure**, aucun badge accordé, la
demande est close avec le motif « créateur mineur », le compte est **escaladé à un administrateur**
et traité selon **D15** (mineurs exclus au MVP). L'agent ne poursuit aucun examen.

**RG55** — L'agent dispose, sur l'écran de décision, de **toutes les informations nécessaires sans
ouvrir autre chose** : profil déclaré, réseau, identifiant, pièces, historique des demandes et des
refus, écart déclaré/constaté, notes internes, alertes. Un agent qui doit ouvrir trois onglets pour
décider perd la moitié de sa journée (`backoffice-ops` règle 1).

### F — Motifs de refus : liste fermée et messages

**RG56** — **Aucun refus sans motif typé.** Le texte libre est autorisé **en complément**, jamais à la
place. Un refus muet, un refus rédigé librement seul, ou un dossier laissé en attente sans décision
sont des défauts bloquants.

**RG57** — Liste **fermée** des motifs de refus d'une demande **créateur** (les motifs de la marque
sont ceux de `06` RG66, distincts) :

| Code | Motif | Message envoyé au créateur | Ce qu'il peut faire |
|---|---|---|---|
| `missing_evidence` | Pièce absente | « Aucune pièce n'a été jointe à votre demande. » | Redéposer |
| `evidence_too_old` | Pièce trop ancienne | « La période affichée sur votre capture se termine il y a plus de 30 jours. » | Redéposer une capture récente |
| `evidence_unreadable` | Pièce illisible, rognée ou incomplète | « Le compte ou la période ne sont pas lisibles sur votre capture. » | Redéposer |
| `evidence_wrong_source` | Source non acceptée | « Seules les statistiques officielles du réseau sont acceptées. Une capture issue d'un outil de mesure tiers ne peut pas être retenue. » | Redéposer depuis l'outil natif |
| `evidence_too_wide` | Pièce non conforme aux instructions de capture | « Votre capture montre des informations concernant d'autres personnes. Recadrez-la en suivant nos instructions. » | Redéposer, recadrée |
| `ownership_not_proven` | Compte non prouvé | « Le code de vérification n'a pas été trouvé sur votre profil. » | Recommencer la preuve de propriété |
| `account_not_public` | Compte non consultable publiquement | « Nous n'avons pas pu consulter votre profil sans être connectés. Rendez-le public le temps du constat, ou renoncez à la vérification de ce réseau. » | Rendre public, puis redemander |
| `ownership_prerequisite` | Audience demandée sans propriété établie | « Nous vérifions d'abord que ce compte vous appartient, avant de constater vos chiffres. » | Demander d'abord « Compte vérifié » |
| `evidence_inconsistent` | Incohérence entre les pièces | « Les informations fournies ne concordent pas. » | Contacter INFLUX |
| `evidence_suspected_forgery` | Soupçon de document modifié | « Nous ne pouvons pas retenir cette pièce. » | Contacter INFLUX |
| `shared_account` | Compte partagé entre plusieurs personnes | « Ce compte semble géré par plusieurs personnes. Nous ne pouvons pas établir sa propriété pour une personne identifiée. » | Contacter INFLUX |
| `agency_managed` | Compte géré par une agence | « Les comptes gérés par une agence ne sont pas pris en charge pour le moment. » | Aucun recours au MVP |
| `terms_breach` | Profil non conforme aux CGU | Message dédié selon le cas | Selon le cas |
| `minor` | Créateur mineur | Message dédié (**D15**) | **Aucun recours au MVP** |
| `account_unavailable` | Compte suspendu ou en cours de suppression | « Votre demande ne peut pas être traitée tant que votre compte est suspendu. » | Contacter INFLUX |
| `other` | Autre | Message rédigé par l'agent, **en complément** d'une explication | Contacter INFLUX |

**RG58** — Le motif **`other` est exceptionnel et surveillé** : s'il dépasse **10 % des refus sur un
mois**, la liste est réputée incomplète et doit être étendue. Ce seuil est un indicateur du tableau de
bord, pas une statistique de fin d'année.

**RG59** — Les motifs `evidence_suspected_forgery`, `shared_account`, `terms_breach` et `minor` sont
**escaladés à un administrateur** en plus du refus : ce ne sont pas des erreurs de dossier, ce sont
des signaux sur le compte.

**RG60** — **Une nouvelle demande après refus est autorisée**, avec un **délai minimal de 24 heures**
entre deux demandes sur le même triplet (valeur de départ, paramètre en table). Au-delà de **3 refus
sur le même triplet en 30 jours**, une nouvelle demande n'est possible qu'après intervention d'un
agent. **L'historique complet des refus est conservé et visible de l'agent.**

### G — La file de vérification : entrée, tri, verrou, SLA

**RG61** — Toutes les demandes de vérification, créateur **et** marque, vivent dans **une seule file
technique** (`verification.verification_requests`), présentée en **deux vues de travail distinctes** :
« créateurs à vérifier » et « marques à vérifier ». Les écrans, les gestes, les motifs et les messages
sont **propres à chaque population** ; la mécanique de file, de verrou et de SLA est commune.

**RG62** — **Tri par défaut : ancienneté croissante** (la plus ancienne en premier). Tris disponibles :
SLA restant, niveau demandé, réseau. Filtres : population, niveau, réseau, état, agent responsable,
présence d'une alerte.

**RG63** — Chaque entrée affiche, **sans avoir à l'ouvrir** : population, créateur ou marque, niveau
demandé, réseau, date de soumission, ancienneté, SLA restant, alertes éventuelles (écart déclaré,
refus antérieurs, changement d'identifiant), agent responsable.

**RG64** — **Verrou anti-double-traitement.** La prise en charge est nominative et exclusive. Un second
agent voit « En cours — {prénom} » et **ne peut pas décider**, jamais une erreur technique. Le verrou
**expire seul au bout de 30 minutes** sans décision et l'entrée retourne dans la file. Un
administrateur peut lever un verrou orphelin, avec trace.

**RG65** — **SLA : 1 jour ouvré** (**D39**, repris tel quel). Le délai de vérification n'a aucune
raison d'être plus long que celui de la file de validation des mises en relation : une demande
d'audience se traite en quelques minutes, et un créateur qui attend son badge est un créateur qui ne
publie pas. La valeur vit dans `backoffice.sla_policies` : la resserrer est un changement de
configuration, pas un déploiement.

**RG66** — **Comportement au dépassement** : à l'échéance, l'entrée passe en **liste « SLA dépassé »**,
visuellement distincte et **jamais noyée** dans la file générale ; au-delà de **3 jours ouvrés**, elle
remonte en alerte sur le tableau de bord. **Une décision hors délai reste toujours possible** et est
marquée comme telle : on ne bloque jamais une décision tardive.

**RG67** — **Aucune entrée ne quitte la file sans décision.** Les seules sorties sont : accordée,
refusée avec motif, annulée par le créateur, expirée (code non utilisé, RG22), ou close pour compte
indisponible. « À réexaminer » (RG50) **n'est pas une sortie**.

**RG68** — Le tableau de bord du backoffice affiche en permanence : nombre de demandes en attente par
population et par niveau, **ancienneté de la plus ancienne**, délai médian de traitement et délai du
9e cas sur 10, répartition des refus par motif, nombre de badges actifs, **nombre de badges arrivant à
échéance sous 30 jours**, nombre de contestations ouvertes. **Une file vide et une file bloquée sont
deux états distincts, affichés distinctement.**

### H — Péremption, rafraîchissement, retrait, contestation

**RG69** — **Un badge « Audience vérifiée » se périme au bout de 90 jours** (**D34**), comptés à partir
de la **date de décision**. Sans péremption, un badge devient un mensonge en six mois — et un mensonge
dont INFLUX répond.

**RG70** — Cycle de vie du badge d'audience :

| Étape | Effet sur le badge | Ce que voit le créateur | Ce que voit l'annonceur |
|---|---|---|---|
| **J-15** | Aucun | Rappel par e-mail + bandeau dans son espace | Badge normal |
| **J+0 (90 jours)** | État **« à rafraîchir »** | Bandeau explicite + marche à suivre | Badge visible, **daté**, portant la mention « à rafraîchir » |
| **Délai de grâce : 30 jours** (proposition, **Q5**) | « à rafraîchir » | Redépôt possible **sans refaire la preuve de propriété** | Idem |
| **Fin du délai de grâce** | **Expiré** : le badge d'audience **disparaît** | Le profil reste publié, les chiffres repassent en « déclaré » | Plus aucun badge d'audience ; la tranche d'engagement redevient masquée |

**RG71** — **« Compte vérifié » n'est pas affecté par la péremption d'audience** (RG30). Un créateur
dont le badge d'audience expire reste publié : il ne redevient pas un inconnu.

**RG72** — **Le rafraîchissement dans le délai de grâce ne redemande que les pièces d'audience.** Au
delà du délai de grâce, la demande repart normalement, mais **la preuve de propriété n'est pas
redemandée** tant que l'identifiant du compte n'a pas changé : redemander un code pour un compte déjà
constaté est une friction sans contrepartie.

**RG73** — **Retrait immédiat, hors péremption**, dans **cinq cas** et cinq seulement :

| Code | Cas | Notifié | Escaladé |
|---|---|---|---|
| `forged_evidence` | Pièce reconnue fausse après coup | Oui | Administrateur |
| `account_closed` | Compte du réseau supprimé, fermé ou devenu inaccessible | Oui | Non |
| `owner_changed` | Changement de titulaire du compte | Oui | Administrateur |
| `terms_breach` | Manquement grave aux CGU | Oui | Administrateur |
| `influx_error` | **Erreur d'INFLUX** : badge accordé à tort | Oui, avec excuses explicites | Administrateur |

**RG74** — `influx_error` existe parce qu'un agent se trompe. Sans ce motif, une erreur interne se
range sous un motif qui accuse le créateur — ce qui est à la fois faux et déloyal. Sa fréquence est
suivie comme un indicateur de qualité de la procédure, pas comme une faute individuelle.

**RG75** — **Le retrait d'un badge est une action irréversible au sens de `backoffice-ops` :** elle est
**demandée par un agent et approuvée par un administrateur distinct** (double validation, **2V**,
conformément à `03` §3.2). **Tant qu'une seule personne cumule les rôles `agent` et `admin`**, la
double validation est remplacée par une **confirmation explicite différée et journalisée** : récapitulatif
intégral, confirmation dans un second temps séparé du premier geste, trace nominative avec ses deux
horodatages. **C'est un contrôle affaibli, et il est dit comme tel** : il protège contre l'erreur et la
précipitation, pas contre la malveillance.

**RG76** — Un badge retiré **disparaît immédiatement de tous les écrans** : recherche, fiche, campagne,
conversation, e-mail en préparation. **Aucun historique de badge n'est affiché à un annonceur** — ni
« badge retiré le… », ni « anciennement vérifié ». L'historique est interne.

**RG77** — **Contestation.** Un créateur peut contester un refus ou un retrait **dans les 30 jours**
suivant la notification (proposition, alignée sur la durée de conservation des pièces — **Q2**). La
contestation est **traitée par un agent différent de celui qui a décidé** dès que l'équipe compte deux
personnes ; tant qu'elle n'en compte qu'une, elle est réexaminée **après un délai de réflexion d'au
moins 24 heures**, et la décision est journalisée nominativement. **Toute contestation, son examen et
son issue sont journalisés**, et le créateur est notifié de l'issue avec un motif.

**RG78** — **Changement d'identifiant (pseudo) déclaré après vérification** : le badge **reste**,
l'ancien et le nouvel identifiant sont **conservés en interne**, une entrée « identifiant modifié à
contrôler » est créée dans la file et le commercial est alerté. L'agent décide sous le même SLA : soit
il constate que le compte est le même et enregistre son constat, soit il **exige une nouvelle preuve de
propriété**, et le badge « Compte vérifié » passe alors en **« à reconfirmer »** (visible du créateur,
**non affiché comme actif** à un annonceur) jusqu'au nouveau constat. Hypothèse retenue faute
d'automatisme : INFLUX n'a aucun moyen de détecter seul un changement d'identifiant au MVP.

**RG79** — **Chute brutale d'audience** : le badge **n'est pas retiré** — il constate une date passée,
et il le dit. Une chute déclarée ou constatée de plus de **40 %** par rapport au dernier constat
déclenche une **alerte interne** et la possibilité, pour l'agent, de **demander un rafraîchissement
anticipé**. Aucune mention publique, aucun retrait automatique.

**RG80** — **Soupçon de faux abonnés** : INFLUX ne dispose d'aucun outil de détection au MVP.
Conséquences, sans exception : le soupçon **n'est jamais un motif de refus** à lui seul ; il ne produit
**aucune mention publique** ; il est enregistré en **note interne** et en alerte au commercial ; un
administrateur peut décider de **ne pas proposer** le profil à une marque, ce qui est une décision
commerciale, pas une affirmation. La seule chose que le badge dit sur ce sujet, c'est **rien** (RG2,
RG10).

### I — Stockage des pièces, données de tiers, publication

**RG81** — Les pièces vivent dans un **compartiment privé** dédié (`verification`), séparé des visuels
de portfolio, avec ses propres limites de type et de taille (`03` §6.6, **E1-1** et **E1-2**).

**RG82** — **Une pièce de vérification n'est jamais accessible à un annonceur, dans aucun cas** — y
compris à sa demande, y compris après révélation d'identité, y compris sur une mise en relation
ouverte, y compris si le créateur y consent, y compris par l'intermédiaire d'un commercial
(**C(13)**). Ce qu'INFLUX transmet, c'est **son constat**, jamais la pièce. L'interdiction est mise en
œuvre par **absence de droit, absence de route et absence du champ dans tout schéma de réponse**
accessible au rôle annonceur — pas par un masquage d'interface.

**RG83** — Les pièces **ne sont jamais servies au navigateur par une URL signée** : elles transitent
par l'API, qui journalise chaque consultation (**C(14)**, **E1-7**). Une URL signée se retrouve dans un
historique de navigateur, un journal de serveur mandataire ou un message copié-collé.

**RG84** — **Tout accès d'un agent à une pièce est journalisé** : identité, demande concernée, pièce,
date et heure. Une consultation non journalisée est un défaut bloquant.

**RG85** — Le **dépôt** se fait par une URL signée de courte durée (≤ 5 minutes), émise après contrôle
du rôle, du propriétaire, du type et de la taille (**C(12)**, **E1-3**). Le **nom d'origine du fichier
n'est jamais conservé** : le chemin est calculé par l'API (**E1-4**). Un nom de fichier est un champ de
texte libre, donc un vecteur de coordonnées.

**RG86** — **Conservation bornée.** Chaque pièce porte une **date de purge obligatoire dès son dépôt**.
Durée : **45 jours après la décision** (**Q2** tranchée le 2026-11-01 : délai de contestation de 30 jours et une marge ; `04` §9). À l'échéance, la pièce
est supprimée ; **le constat, lui, est conservé 3 ans** — c'est le constat qui engage INFLUX, pas la
pièce. Durées soumises à **`expert-conformite-rgpd` (veto)** — **Q2**.

**RG87** — **Les captures contiennent des données de tiers.** Un espace analytique affiche presque
toujours autre chose que des chiffres : noms de commentateurs, messages, miniatures, visages, parfois
des messages privés. **Des instructions de capture explicites** sont affichées au moment du dépôt, en
français et en anglais :

> *Ce que nous devons voir :* le nom de votre compte, la période affichée, le nombre d'abonnés.
> *Ce que vous devez masquer ou recadrer avant d'envoyer :* les noms et photos d'autres personnes, les
> commentaires, les messages, les notifications, tout ce qui ne concerne pas vos chiffres.
> *Ce que nous ne demandons jamais :* votre mot de passe, un accès à votre compte, une capture de vos
> messages privés.

**RG88** — **Une pièce trop large est refusée, pas tolérée.** Le motif `evidence_too_wide` existe pour
cela (RG57). **La pièce refusée pour ce motif est supprimée immédiatement**, pas conservée jusqu'à sa
date de purge : INFLUX n'a aucune raison de garder les données de tiers d'une pièce qu'il n'a pas
retenue.

**RG89** — Ce qui est **publié** et ce qui ne l'est **jamais** :

| Publié (visible d'un annonceur) | **Jamais publié** |
|---|---|
| Le niveau et le réseau concerné | **Les pièces**, sous aucune forme |
| **La date du constat** | Le nom de l'agent vérificateur (interne uniquement) |
| La **période** couverte par le constat | Les **valeurs exactes** constatées (révélées seulement après révélation d'identité, `04` §5.2) |
| Les valeurs constatées **en tranches** | **L'écart déclaré / constaté** |
| L'état « à rafraîchir » | L'historique des refus et des retraits |
| La source (« tableau de bord {réseau} ») | Les notes internes, les alertes |

**RG90** — **Le badge ne révèle jamais l'identifiant du compte** avant la révélation d'identité
(**D16**). Il nomme le **réseau**, jamais le pseudo, jamais un lien. Un badge qui afficherait
« Audience vérifiée — @pseudo » détruirait l'anonymisation et, avec elle, la traçabilité de la mise en
relation.

**RG91** — **Risque de contournement signalé.** La vérification, par nature, met en contact un agent
INFLUX et un créateur autour d'un compte de réseau social. Trois garde-fous : le code de propriété ne
contient **aucune coordonnée** ni aucun lien ; **aucun échange de la procédure ne sort de la
plateforme** (tous les messages sont transactionnels, depuis INFLUX) ; l'agent **ne contacte jamais un
créateur sur son réseau** pour une question de vérification. Une prise de contact d'un agent depuis un
réseau social est un manquement, pas une initiative commerciale.

**RG92** — Aucune donnée de ce périmètre ne part vers **Brevo** ou **Apollo**, à **deux exceptions**,
et seulement si le consentement du Lot 1 est enregistré : l'**état du badge** (aucun / compte vérifié /
audience vérifiée) et sa **date**, comme attributs de segmentation. **Ne partent jamais** : les pièces,
les valeurs constatées exactes, l'écart déclaré/constaté, les motifs de refus, les notes internes,
l'identifiant du compte de réseau. Un motif de refus envoyé à un outil marketing serait une donnée
d'appréciation exportée hors du périmètre qui la justifie.

### J — Messages, notifications, états d'écran, accessibilité

**RG93** — Tous les messages existent en **français et en anglais**, externalisés, aucun écrit en dur :

| Clé | Français | English |
|---|---|---|
| `verif.badge.accountVerified` | Compte vérifié — {network}, le {date} | Account verified — {network}, on {date} |
| `verif.badge.accountVerified.help` | INFLUX a constaté que ce compte appartient au créateur inscrit. | INFLUX confirmed this account belongs to the registered creator. |
| `verif.badge.audienceVerified` | Audience vérifiée — {network}, le {date} | Audience verified — {network}, on {date} |
| `verif.badge.audienceVerified.help` | Chiffres constatés par INFLUX sur le tableau de bord {network}, période du {start} au {end}. INFLUX ne se prononce pas sur l'authenticité des abonnés. | Figures observed by INFLUX in the {network} native dashboard, period {start} to {end}. INFLUX makes no claim about follower authenticity. |
| `verif.badge.toRefresh` | Audience vérifiée le {date} — vérification à rafraîchir. | Audience verified on {date} — verification needs refreshing. |
| `verif.badge.toReconfirm` | Compte vérifié le {date} — à reconfirmer après un changement d'identifiant. | Account verified on {date} — to be reconfirmed after a handle change. |
| `verif.figures.observed` | Constaté par INFLUX le {date}. | Observed by INFLUX on {date}. |
| `verif.figures.declared` | Déclaré par le créateur le {date}. | Declared by the creator on {date}. |
| `verif.ownership.instructions` | Collez ce code dans la biographie de votre compte {network}. Nous le constatons nous-mêmes en ligne. Vous pourrez le retirer dès que le constat est enregistré. | Paste this code into your {network} bio. We check it online ourselves. You can remove it as soon as the check is recorded. |
| `verif.ownership.neverAsk` | INFLUX ne vous demandera jamais votre mot de passe, ni un accès à votre compte, ni un code reçu par message. | INFLUX will never ask for your password, access to your account, or a code you received by message. |
| `verif.ownership.codeExpiry` | Ce code est valable jusqu'au {date}. | This code is valid until {date}. |
| `verif.evidence.instructions` | Ce que nous devons voir : le nom de votre compte, la période affichée, le nombre d'abonnés. Masquez ou recadrez tout ce qui concerne d'autres personnes. | What we need to see: your account name, the period shown, your follower count. Hide or crop anything about other people. |
| `verif.evidence.freshness` | Votre capture doit couvrir une période se terminant il y a moins de 30 jours. | Your screenshot must cover a period ending less than 30 days ago. |
| `verif.request.pending` | Votre demande est en cours d'examen. Nous répondons sous 1 jour ouvré. | Your request is being reviewed. We answer within 1 business day. |
| `verif.request.duplicate` | Une demande est déjà en cours pour ce réseau depuis le {date}. | A request for this network has been open since {date}. |
| `verif.request.expired` | Votre code a expiré. Vous pouvez en générer un nouveau. | Your code has expired. You can generate a new one. |
| `verif.expiry.reminder` | Votre audience vérifiée arrive à échéance le {date}. Déposez une capture récente pour la conserver. | Your verified audience expires on {date}. Upload a recent screenshot to keep it. |
| `verif.expiry.toRefresh` | Votre audience vérifiée est à rafraîchir. Elle reste affichée avec sa date jusqu'au {date}. | Your verified audience needs refreshing. It stays visible with its date until {date}. |
| `verif.expiry.removed` | Votre audience vérifiée a expiré. Vos chiffres sont de nouveau affichés comme déclarés. | Your verified audience has expired. Your figures are shown as declared again. |
| `verif.revoked.notice` | Votre badge a été retiré : {reason} | Your badge was removed: {reason} |
| `verif.dispute.open` | Vous pouvez contester cette décision pendant 30 jours. | You can appeal this decision for 30 days. |
| `verif.advertiser.disclaimer` | Ce badge indique qu'un chiffre a été constaté sur pièce par INFLUX à la date affichée. Il ne garantit ni l'authenticité des abonnés, ni les résultats d'une campagne. | This badge means a figure was checked by INFLUX against evidence on the date shown. It does not guarantee follower authenticity or campaign results. |

**RG94** — Notifications transactionnelles envoyées au créateur, toutes dans sa langue : demande reçue,
code généré, **décision favorable**, **refus avec son message de motif**, rappel J-15, passage en « à
rafraîchir », expiration, **retrait avec son motif**, contestation reçue, issue de la contestation,
demande expirée. **Aucune de ces notifications n'est marketing** : elles ne dépendent d'aucun
consentement et ne passent par aucun scénario de nurturing.

**RG95** — Chaque écran de ce périmètre possède **quatre états explicites** : repos, chargement,
succès, échec. Un dépôt de pièce qui échoue **ne fait jamais perdre** les autres pièces déjà déposées
ni les informations de la demande.

**RG96** — Le créateur voit, **avant** de déposer quoi que ce soit, **ce que son badge affichera
publiquement** et ce qui restera interne (une reprise du tableau RG89, rédigée pour lui). Un créateur
qui découvre après coup qu'un chiffre exact est visible est un créateur perdu.

**RG97** — Accessibilité : chaque badge porte un **libellé écrit** en plus de sa forme visuelle ; les
états « vérifié », « à rafraîchir », « à reconfirmer », « déclaré » se distinguent **sans recourir à la
couleur** ; les contrastes respectent WCAG AA ; **le vert de marque n'est jamais le seul porteur d'un
état**. Toutes les couleurs, tailles et espacements passent par les tokens (`design-system-influx`).

**RG98** — Au backoffice : **tableaux plutôt que cartes**, actions atteignables sans souris,
**raccourcis clavier** sur les gestes répétés (prendre en charge, accorder, refuser avec motif, passer
au suivant), **états vides utiles** (« Aucune demande en attente — dernière traitée il y a 12 minutes »).

**RG99** — Un agent ne peut **jamais** : modifier ou supprimer une entrée du journal d'audit ; consulter
une pièce sans que ce soit journalisé ; exporter la liste des demandes ou des pièces sous quelque forme
que ce soit ; agir sous une autre identité que la sienne ; désactiver sa propre traçabilité. Chacun de
ces points est un **défaut bloquant** s'il est possible.

**RG100** — Tous les délais et seuils de ce document sont des **paramètres en table**, modifiables sans
redéploiement, chaque modification étant journalisée : validité du code (7 jours), fraîcheur des pièces
(30 jours), péremption du badge d'audience (90 jours), délai de grâce (30 jours), SLA (1 jour ouvré),
alerte SLA (3 jours ouvrés), expiration du verrou (30 minutes), délai entre deux demandes (24 heures),
plafond de refus (3 par 30 jours), seuils d'alerte d'écart (30 %) et de chute (40 %), délai de
contestation (30 jours), rétention des pièces (45 jours), rétention des constats (3 ans).

**RG101** — **Aucun de ces paramètres n'est modifiable par un agent** : la modification est réservée à
un administrateur, journalisée nominativement, avec l'ancienne et la nouvelle valeur.

---

## Cas limites

### Les huit cas limites de la skill `feature-spec`

**1 — Donnée absente ou profil incomplet**

| Situation | Comportement attendu |
|---|---|
| Demande d'audience sans aucune pièce | Refus `missing_evidence` ; la demande reste rejouable sans délai |
| Capture sans période lisible | Refus `evidence_unreadable` ; la demande n'est jamais « à moitié » accordée |
| Le créateur n'a déclaré aucun réseau | La demande de vérification n'est pas proposée ; le message renvoie vers l'ajout d'un réseau |
| Le taux d'engagement n'apparaît pas sur la capture | Le champ **reste vide** ; la tranche d'engagement n'est pas publiée ; le badge d'audience peut être accordé sur les seuls abonnés (RG38) |
| Le pays principal d'audience n'est pas lisible | Idem : non saisi, reste déclaré |
| Les publications du compte ne sont pas consultables publiquement (compte privé) | Refus `account_not_public` : le rythme et les commentaires ne peuvent pas être constatés (RG38bis) |
| Les commentaires sont désactivés sur le compte | L'agent constate **0**, comme il le voit ; ce n'est pas un motif de refus (RG38bis, `07` cas limites D61) |
| Le créateur n'a pas d'attestation de majorité (compte antérieur, cas de reprise) | Demande close « compte indisponible », escalade administrateur, traitement selon **D15** |
| L'agent ne sait pas lire la langue de l'interface du réseau sur la capture | **La langue n'est jamais un motif de refus** si les chiffres et la période sont lisibles ; sinon `evidence_unreadable` |

**2 — Valeur nulle, négative ou aberrante**

| Situation | Comportement attendu |
|---|---|
| Aucun montant, taux ni commission n'existe dans ce périmètre | Vérifié : **A1** respecté, le badge ne porte aucun montant (RG8) |
| Valeur constatée de 0 abonné | Acceptée telle quelle : le constat est le constat. La tranche publiée est la tranche la plus basse. Aucun refus |
| Valeur constatée négative | Refus de saisie côté serveur : une valeur d'audience ne peut pas être négative |
| Taux d'engagement saisi à 350 % | Refus de saisie côté serveur (borne 0–100 %), message explicite à l'agent |
| Période dont la fin précède le début | Refus de saisie côté serveur |
| Période de fin dans le futur | Refus de saisie côté serveur : on ne constate pas l'avenir |
| Écart déclaré / constaté de 400 % | **Aucun refus automatique** : alerte interne, note au commercial, décision humaine (RG42) |
| Capture montrant une période de 3 jours seulement | Acceptée si lisible ; la **période exacte est publiée avec le badge** (RG5), le lecteur juge |

**3 — Doublon**

| Situation | Comportement attendu |
|---|---|
| Deux demandes sur le même (compte, réseau, niveau) | Une seule active ; la seconde affiche « demande déjà en cours depuis le {date} » (RG14) |
| Double clic sur « demander la vérification » | Une seule entrée créée ; la seconde soumission est sans effet |
| La même capture est déposée deux fois | Remplacement, l'ancienne est purgée immédiatement ; l'examen repart à zéro |
| Deux comptes INFLUX déclarent **le même identifiant de réseau** | **Alerte forte à l'agent.** Le code de propriété ne peut être constaté que sur un seul : le premier constat gagne, le second est refusé `ownership_not_proven`, et les deux comptes sont escaladés |
| Un créateur déjà vérifié redemande le même niveau | Proposé comme **rafraîchissement**, pas comme nouvelle demande ; le badge en cours reste actif pendant l'examen |
| Un badge actif et un badge « à rafraîchir » coexistent sur le même triplet | Impossible : un seul badge actif ou « à rafraîchir » par triplet (contrainte d'unicité, `04` §5.3) |

**4 — Action concurrente**

| Situation | Comportement attendu |
|---|---|
| Deux agents ouvrent la même demande | Le second voit « En cours — {prénom} » et **ne peut pas décider** (RG64) |
| Un agent décide pendant que le créateur dépose une pièce supplémentaire | La décision porte sur les pièces examinées, listées dans le constat ; la pièce postérieure crée une **nouvelle demande**, elle ne modifie jamais une demande décidée |
| Le créateur annule sa demande pendant l'examen | L'annulation est prise en compte **si aucune décision n'est enregistrée** ; sinon la décision prime et le créateur en est notifié |
| Un administrateur suspend le compte pendant l'examen | La suspension prime : la demande est close « compte indisponible », aucun badge n'est accordé |
| Un agent accorde un badge pendant qu'un autre en demande le retrait | Le retrait exige une approbation distincte (RG75) ; l'attribution est bloquée tant qu'une demande de retrait est ouverte sur le même badge |
| Prise en charge abandonnée sans décision | Expire au bout de 30 minutes, retour en file, aucune donnée perdue (RG64) |
| Le badge expire pendant que l'agent examine un rafraîchissement | L'état passe en « à rafraîchir » normalement ; la décision favorable réinitialise la date et l'échéance |

**5 — Droit insuffisant**

| Situation | Comportement attendu |
|---|---|
| **Un annonceur demande une pièce de vérification** | **Refusé par absence de droit, de route et de champ** (RG82, **C(13)**). Il n'existe aucun chemin, aucune exception, aucune procédure d'escalade |
| Un annonceur demande la valeur exacte d'audience avant révélation | La valeur ne figure **pas** dans la réponse, pas même vide ; seule la tranche existe (RG20) |
| Un créateur tente de lire la demande d'un autre créateur | Refus au niveau de la base, journalisé |
| Un créateur tente de saisir lui-même une valeur « constatée » | Aucun champ ne le permet ; la valeur constatée n'est écrivable que par un rôle interne (RG47) |
| Un agent tente de retirer un badge seul | Refus : approbation d'un administrateur distinct, ou confirmation différée journalisée (RG75) |
| Un agent tente de traiter sa propre demande | Refus côté serveur, tentative journalisée (RG53) |
| Un agent tente d'exporter la liste des pièces ou des demandes | Refus : aucun export n'existe (RG99) |
| Un agent tente de modifier un paramètre (péremption, SLA) | Refus : réservé à un administrateur, journalisé (RG101) |

**6 — Service externe indisponible**

| Situation | Comportement attendu |
|---|---|
| Le stockage de fichiers est indisponible au dépôt | La demande est enregistrée, les pièces manquantes sont signalées « à redéposer », **aucune saisie n'est perdue** |
| Le réseau social est en panne au moment du constat de propriété | L'agent repose la demande en **« à réexaminer »** (RG50) ; **aucun refus automatique**, l'ancienneté continue de courir |
| Le service d'envoi transactionnel est indisponible au moment d'une notification de décision | La décision est enregistrée, la notification est mise en file et réessayée ; l'état est visible au backoffice |
| Brevo indisponible au moment d'un changement d'état de badge | Aucun effet sur le badge ; la synchronisation d'attribut passe en attente et est rejouée (pipeline du Lot 1) |
| La base est indisponible pendant la saisie des valeurs constatées | Message honnête, saisie conservée dans le navigateur, nouvelle tentative proposée ; **aucune décision partielle enregistrée** |
| Le registre public d'immatriculation est inaccessible (badge marque) | « À réexaminer » ; `06` RG52 s'applique pour le refus définitif |

**7 — Abandon en cours de parcours**

| Situation | Comportement attendu |
|---|---|
| Le créateur génère un code et ne le colle jamais | Le code expire au bout de 7 jours ; la demande passe en « expirée » ; le profil n'est pas affecté |
| Le créateur dépose une pièce puis quitte sans soumettre | La demande reste en brouillon, les pièces déposées sont conservées jusqu'à leur date de purge ; une relance transactionnelle est envoyée à J+3 |
| Le créateur ne redépose jamais après un refus | La demande reste refusée, le motif reste consultable dans son espace, aucune relance marketing sans consentement |
| Le créateur ignore le rappel J-15 | Le badge passe en « à rafraîchir » puis expire, sans intervention humaine (RG70) |
| Le créateur se déconnecte pendant le dépôt | Le dépôt est abandonné ; **aucun fichier partiel n'est conservé** |
| Un agent abandonne un examen en cours | Le verrou expire, l'entrée retourne en file ; les valeurs saisies non validées sont **perdues volontairement** : une saisie partielle non décidée ne doit pas orienter le second examinateur |

**8 — Annulation ou retour en arrière après validation**

| Situation | Comportement attendu |
|---|---|
| **Badge obtenu puis profil dépublié** par le créateur | Le badge **reste en base, actif, avec sa date**, et **cesse d'être affiché** puisque le profil ne l'est plus. À la republication : s'il n'a pas expiré, il réapparaît **avec sa date d'origine** ; s'il a expiré entre-temps, il réapparaît en « à rafraîchir » ou pas du tout, selon l'échéance. **La date n'est jamais rafraîchie par une republication** |
| Le créateur supprime le réseau de son profil | Le badge de ce réseau est retiré avec le motif `account_closed`, sans escalade ; les autres réseaux ne sont pas affectés |
| **Compte de réseau supprimé après vérification** | Retrait `account_closed`, notification. **La détection est humaine au MVP** (rafraîchissement, signalement d'une marque, constat d'un agent) : INFLUX n'a aucun connecteur d'API et ne prétend pas le contraire |
| Un badge est retiré alors qu'une mise en relation est ouverte | Le badge disparaît des écrans ; **la mise en relation n'est pas affectée** ; le commercial en est informé et décide de ce qu'il dit à la marque |
| Une pièce est reconnue fausse après l'attribution | Retrait `forged_evidence`, escalade administrateur, journalisation, notification ; le compte est examiné au titre des CGU |
| INFLUX découvre avoir accordé un badge à tort | Retrait `influx_error`, message assumant l'erreur, aucune imputation au créateur (RG74) |
| Le compte est supprimé (droit à l'effacement, Lot 1) | Badges et demandes sont **anonymisés avec le compte** ; les pièces sont supprimées ; **les décisions et leur journal sont conservés sous forme pseudonyme** au titre de la responsabilité d'INFLUX sur ce qu'il a affirmé (hypothèse conservatrice, **Q2**) |
| Une contestation aboutit en faveur du créateur | Le badge est **réattribué avec une nouvelle date de décision**, jamais avec l'ancienne ; l'issue est journalisée et notifiée |

### Les neuf cas limites demandés au cadrage

| Situation | Comportement attendu |
|---|---|
| **Compte partagé** entre plusieurs personnes | « Compte vérifié » **refusé** (`shared_account`) : la propriété n'est pas établie **pour une personne identifiée**. Escalade administrateur. Le message renvoie au cas agence |
| **Compte géré par une agence** | **Hors périmètre MVP** (agences et comptes multi-utilisateurs exclus) : refus `agency_managed`, demande inscrite pour la V2, aucun recours au MVP |
| **Changement de pseudo après vérification** | Badge maintenu, ancien et nouvel identifiant conservés en interne, entrée « identifiant modifié à contrôler » en file, alerte commerciale ; nouvelle preuve exigée si doute, badge alors « à reconfirmer » (RG78) |
| **Chute d'audience** | Aucun retrait : le badge constate une date passée. Alerte interne au-delà de 40 %, rafraîchissement anticipé possible (RG79) |
| **Soupçon de faux abonnés** | Aucun outil de détection au MVP : **le badge ne dit rien**. Note interne, alerte commerciale, possibilité de ne pas proposer le profil. **Jamais** un motif de refus seul, **jamais** une mention publique (RG80) |
| **Compte supprimé après vérification** | Retrait immédiat `account_closed`, motif typé, notification. Détection humaine assumée |
| **Créateur mineur détecté** | **Arrêt immédiat** de la procédure, aucun badge, motif `minor`, escalade administrateur, traitement selon **D15**, journalisation. Aucun recours au MVP |
| **Badge obtenu puis profil dépublié** | Badge conservé en base et masqué ; réaffiché avec **sa date d'origine** à la republication, ou en « à rafraîchir » s'il a expiré entre-temps |
| **Deux demandes simultanées sur le même profil** | Verrou : une seule prise en charge possible, le second agent voit « En cours — {prénom} » (RG64) |

### La checklist INFLUX de la skill `feature-spec`

| # | Contrôle | Réponse pour ce document |
|---|---|---|
| 1 | **Montants** — montant du contrat, commission INFLUX, net créateur | **Aucun montant d'aucune sorte.** Le badge ne porte ni montant, ni taux, ni commission (**A1**, RG8). Les seules valeurs manipulées sont des volumes d'audience, publiés en tranches |
| 2 | **Traçabilité / contournement** | **Signalé et traité.** Le badge ne révèle **jamais** l'identifiant du compte avant révélation (RG90, **D16**) ; le code de propriété ne contient aucune coordonnée ; aucun échange de la procédure ne sort d'INFLUX ; **un agent ne contacte jamais un créateur sur son réseau** (RG91). **Risque résiduel assumé :** un agent INFLUX connaît, par nature, l'identifiant du compte qu'il vérifie — la parade est la journalisation nominative, pas une restriction technique |
| 3 | **Leads** — ce qui part vers Brevo et Apollo, avec quel consentement | **Deux attributs seulement** : état du badge et sa date, sous consentement du Lot 1 (RG92). Pièces, valeurs exactes, écarts, motifs de refus et notes internes **ne partent jamais**. Les notifications de ce périmètre sont **transactionnelles**, sans consentement requis, hors nurturing (RG94) |
| 4 | **Backoffice** — contrepartie interne | **C'est l'essentiel du document** : §E (procédure pas à pas), §F (motifs typés et messages), §G (file, tri, verrou, SLA **1 jour ouvré**, dépassement), §H (retrait avec double validation, contestation), §I (journalisation de chaque consultation de pièce), RG98 et RG99 (densité, raccourcis, interdits) |
| 5 | **Matching hybride** | **Aucun algorithme (D11).** La voie algorithmique est ici **volontairement absente** : aucune attribution automatique, aucun score, aucun connecteur d'API (RG9). La voie humaine est intégralement spécifiée et **journalisée nominativement**. Ce que le badge alimente pour plus tard : la facette « vérifié » (Lot 3) et la fiabilité des tranches d'audience, données d'entrée du futur moteur |
| 6 | **Deux populations** | Les §C, §D, §E, §F ne concernent **que le créateur** ; la marque suit `06` §E. **Files présentées séparément, motifs distincts, messages distincts, écrans distincts** (RG61). Seuls le socle d'affirmation (§A), la mécanique de file (§G), la péremption et le retrait (§H) et le stockage (§I) sont communs |
| 7 | **Données personnelles** — avis de `expert-conformite-rgpd` | **Obligatoire, avec veto.** Points soumis : **données de tiers dans les captures** (base légale, instructions, minimisation, suppression immédiate des pièces trop larges) — **Q2** ; **durées de conservation** des pièces (90 jours) et des constats (3 ans) — **Q2** ; **délai et procédure de contestation** (30 jours) — **Q2** ; **libellés du badge** et information de l'annonceur — **Q1** ; **conservation des constats après suppression de compte** — **Q2** |

---

## Critères d'acceptation

### Ce que le badge affirme

**CA1** — *Étant donné* le libellé de chaque badge, *quand* on le lit, *alors* il nomme le fait
constaté, la date, la source, et il n'affirme ni authenticité des abonnés, ni performance future, ni
qualité du créateur.

**CA2** — *Étant donné* le badge « Audience vérifiée », *quand* il est affiché à un annonceur, *alors*
la mention « INFLUX ne se prononce pas sur l'authenticité des abonnés » est accessible **au même
endroit que le badge**, pas dans une page d'aide distante.

**CA3** — *Étant donné* n'importe quel emplacement d'affichage d'un badge (recherche, fiche,
candidature, conversation, e-mail), *quand* il s'affiche, *alors* **sa date apparaît**.

**CA4** — *Étant donné* l'ensemble des libellés du produit, *quand* on les recherche, *alors* aucun ne
contient « certifié », « de confiance », « premium », « recommandé » ni aucun superlatif.

**CA5** — *Étant donné* un badge d'audience, *quand* il est affiché, *alors* le **réseau**, la
**période constatée** et la **source** sont affichés avec lui.

### Niveaux et effets produit

**CA6** — *Étant donné* un créateur sans aucun « Compte vérifié », *quand* il demande la publication de
son profil, *alors* la publication est refusée **côté serveur** avec un message expliquant la preuve de
propriété.

**CA7** — *Étant donné* un créateur demandant « Audience vérifiée » sur un réseau non vérifié en
propriété, *quand* l'agent traite la demande, *alors* elle est refusée avec le motif
`ownership_prerequisite`.

**CA8** — *Étant donné* un créateur vérifié sur Instagram et non vérifié sur TikTok, *quand* un
annonceur consulte son profil, *alors* l'interface affiche le badge **réseau par réseau** et **aucun
badge global**.

**CA9** — *Étant donné* un réseau sans « Audience vérifiée », *quand* le profil est servi à un
annonceur, *alors* la **tranche d'engagement est absente** de la réponse et les chiffres portent la
mention « déclaré ».

**CA10** — *Étant donné* une valeur constatée de 47 300 abonnés, *quand* elle est publiée, *alors*
l'annonceur voit **une tranche**, la valeur exacte ne figure pas dans la réponse, et la tranche a été
**calculée par le système**, pas saisie par l'agent.

**CA11** — *Étant donné* l'option « campagne réservée aux profils vérifiés », *quand* la masse critique
de **D38** n'est pas atteinte, *alors* l'option est **désactivée par paramètre** et non retirée du code.

### Preuve de propriété

**CA12** — *Étant donné* une demande « Compte vérifié », *quand* le code est généré, *alors* il est à
usage unique, valide 7 jours, et **le code précédent du même triplet est invalidé**.

**CA13** — *Étant donné* un code collé dans la bio, *quand* l'agent le constate lui-même en ligne,
*alors* le constat est enregistré avec **son identité et son horodatage**.

**CA14** — *Étant donné* une capture d'écran de sa bio fournie par le créateur, *quand* l'agent
l'examine, *alors* **elle ne permet jamais d'accorder** le niveau « Compte vérifié ».

**CA15** — *Étant donné* un compte de réseau privé dont la bio n'est pas consultable sans connexion,
*quand* l'agent tente le constat, *alors* la demande est refusée avec `account_not_public` et le
message propose les deux options de RG27.

**CA16** — *Étant donné* l'écran de demande, *quand* on le lit, *alors* il indique qu'INFLUX ne demande
**jamais** de mot de passe, d'accès délégué ni de code reçu par message.

**CA17** — *Étant donné* un code non collé, *quand* 7 jours s'écoulent, *alors* la demande passe en
« expirée », le créateur est notifié, et il peut générer un nouveau code sans délai.

### Preuve d'audience

**CA18** — *Étant donné* une capture dont la période se termine il y a 45 jours, *quand* l'agent
l'examine, *alors* la demande est refusée avec `evidence_too_old`.

**CA19** — *Étant donné* une capture issue d'un outil de mesure tiers, *quand* l'agent l'examine,
*alors* la demande est refusée avec `evidence_wrong_source`.

**CA20** — *Étant donné* une capture sans identifiant de compte visible, *quand* l'agent l'examine,
*alors* la demande est refusée avec `evidence_unreadable`.

**CA21** — *Étant donné* un fichier PDF déposé comme pièce, *quand* le dépôt est tenté, *alors* il est
refusé avec un message indiquant les formats acceptés (images uniquement).

**CA22** — *Étant donné* une image déposée avec des métadonnées EXIF, *quand* elle est enregistrée,
*alors* **les métadonnées ont été supprimées** avant tout examen.

**CA23** — *Étant donné* une capture montrant des noms et photos de commentateurs, *quand* l'agent
l'examine, *alors* la demande est refusée avec `evidence_too_wide` **et la pièce est supprimée
immédiatement**, avant sa date de purge.

**CA24** — *Étant donné* l'écran de dépôt, *quand* le créateur l'ouvre, *alors* les instructions de
capture de RG87 sont affichées **avant** le dépôt, dans sa langue.

### Procédure de l'agent

**CA25** — *Étant donné* l'écran de décision, *quand* l'agent saisit les valeurs constatées, *alors*
**aucun bouton, aucune pré-saisie et aucun automatisme** ne reprend la valeur déclarée par le créateur.

**CA26** — *Étant donné* une valeur constatée saisie, *quand* la décision est enregistrée, *alors* la
**valeur déclarée est conservée à part**, étiquetée « déclaré », et **n'est pas écrasée**.

**CA27** — *Étant donné* une décision favorable, *quand* elle est enregistrée sans période constatée,
*alors* **l'enregistrement est refusé** : la période est obligatoire.

**CA28** — *Étant donné* un écart déclaré/constaté de 210 %, *quand* la décision est examinée, *alors*
une alerte interne est créée, **aucun refus n'est automatique**, et l'écart **n'est publié nulle part**.

**CA29** — *Étant donné* une demande examinée, *quand* l'agent décide, *alors* les **deux seules
issues** possibles sont « accorder » et « refuser avec motif typé » — hormis « à réexaminer », qui
**laisse l'entrée dans la file** et n'arrête pas son ancienneté.

**CA30** — *Étant donné* une décision enregistrée, *quand* on consulte le journal d'audit, *alors* elle
porte l'identité de l'agent et son horodatage, qu'elle soit favorable ou non.

**CA31** — *Étant donné* un agent qui est aussi le titulaire du compte concerné, *quand* il tente de
prendre la demande en charge, *alors* l'action est refusée côté serveur et la tentative est journalisée.

**CA32** — *Étant donné* un élément du dossier indiquant que le créateur est mineur, *quand* l'agent le
constate, *alors* la procédure **s'arrête immédiatement**, aucun badge n'est accordé, le motif `minor`
est enregistré et un administrateur est alerté.

### Motifs de refus

**CA33** — *Étant donné* un refus, *quand* il est enregistré, *alors* **un motif typé est obligatoire**
et l'enregistrement est impossible sans lui.

**CA34** — *Étant donné* chacun des motifs de RG57, *quand* le refus est notifié, *alors* le créateur
reçoit **le message associé**, dans sa langue, avec ce qu'il peut faire.

**CA35** — *Étant donné* un commentaire libre rédigé par l'agent, *quand* il est enregistré, *alors* il
vient **en complément** d'un motif typé, jamais à sa place.

**CA36** — *Étant donné* un mois d'activité, *quand* le motif `other` dépasse 10 % des refus, *alors*
une alerte s'affiche sur le tableau de bord du backoffice.

**CA37** — *Étant donné* un refus, *quand* le créateur redemande le même niveau moins de 24 heures plus
tard, *alors* la demande est refusée à la saisie avec le délai restant affiché.

**CA38** — *Étant donné* trois refus sur le même triplet en 30 jours, *quand* le créateur redemande,
*alors* la demande n'est possible qu'après intervention d'un agent, et l'historique des refus est
visible de l'agent.

### File, verrou, SLA

**CA39** — *Étant donné* une demande prise en charge, *quand* un second agent l'ouvre, *alors* il voit
« En cours — {prénom} » et **ne peut pas décider**.

**CA40** — *Étant donné* une prise en charge sans décision, *quand* 30 minutes s'écoulent, *alors*
l'entrée retourne dans la file et redevient disponible.

**CA41** — *Étant donné* une demande créée, *quand* on consulte son échéance, *alors* elle est calculée
**une seule fois**, à la création, à partir du paramètre de SLA (**1 jour ouvré**).

**CA42** — *Étant donné* une demande dont le SLA est dépassé, *quand* on consulte la file, *alors* elle
apparaît dans une **liste dédiée, visuellement distincte**, et la décision **reste possible**.

**CA43** — *Étant donné* la file de vérification, *quand* on l'affiche, *alors* les vues « créateurs » et
« marques » sont **distinctes**, avec des motifs et des messages distincts.

**CA44** — *Étant donné* une file sans aucune demande, *quand* elle s'affiche, *alors* l'état vide
indique la dernière demande traitée et son heure, et se distingue d'une file en erreur.

### Péremption, retrait, contestation

**CA45** — *Étant donné* un badge d'audience accordé il y a 75 jours, *quand* la tâche quotidienne
s'exécute, *alors* un rappel est envoyé au créateur et **le badge reste inchangé**.

**CA46** — *Étant donné* un badge d'audience accordé il y a 90 jours, *quand* la tâche s'exécute,
*alors* il passe en **« à rafraîchir »**, reste visible avec sa date, et l'annonceur voit cet état.

**CA47** — *Étant donné* un badge en « à rafraîchir » depuis 30 jours, *quand* la tâche s'exécute,
*alors* le badge d'audience **disparaît**, les chiffres repassent en « déclaré », et **« Compte
vérifié » n'est pas affecté**.

**CA48** — *Étant donné* un badge en « à rafraîchir », *quand* le créateur redépose une capture récente,
*alors* **la preuve de propriété n'est pas redemandée** et une nouvelle décision réinitialise la date.

**CA49** — *Étant donné* une demande de retrait de badge par un agent, *quand* elle est soumise, *alors*
elle exige **l'approbation d'un administrateur distinct**, ou, si une seule personne cumule les rôles,
une **confirmation différée journalisée** avec deux horodatages.

**CA50** — *Étant donné* un badge retiré, *quand* on consulte les écrans côté annonceur, *alors* le
badge a **disparu partout immédiatement** et **aucun historique** de badge n'est visible.

**CA51** — *Étant donné* chacun des cinq motifs de retrait, *quand* le retrait est enregistré, *alors*
le créateur est notifié avec le message associé, et le motif `influx_error` assume l'erreur d'INFLUX
sans l'imputer au créateur.

**CA52** — *Étant donné* un refus notifié il y a 10 jours, *quand* le créateur conteste, *alors* la
contestation est enregistrée, journalisée, et **examinée par un agent différent du décideur** dès que
l'équipe compte deux personnes.

**CA53** — *Étant donné* une contestation acceptée, *quand* le badge est réattribué, *alors* il porte
**une nouvelle date de décision**, jamais l'ancienne.

**CA54** — *Étant donné* un créateur qui déclare un nouvel identifiant de compte, *quand* la
modification est enregistrée, *alors* une entrée « identifiant modifié à contrôler » est créée, le
commercial est alerté, et le badge reste affiché tant que l'agent n'a pas exigé une nouvelle preuve.

### Stockage, données de tiers, publication

**CA55** — *Étant donné* un annonceur authentifié, *quand* il tente d'atteindre une pièce de
vérification par n'importe quel chemin, y compris après révélation d'identité, *alors* **aucune route,
aucun droit et aucun champ de réponse ne le lui permet**.

**CA56** — *Étant donné* un agent qui ouvre une pièce, *quand* il l'affiche, *alors* la pièce **ne
transite pas par une URL signée remise au navigateur** et **une entrée de journal est écrite** (agent,
pièce, demande, date et heure).

**CA57** — *Étant donné* une pièce déposée, *quand* on consulte son enregistrement, *alors* elle porte
une **date de purge obligatoire** et **aucune pièce ne peut exister sans elle**.

**CA58** — *Étant donné* une pièce dont la date de purge est atteinte, *quand* la tâche quotidienne
s'exécute, *alors* le fichier est supprimé **et le constat correspondant reste intact**.

**CA59** — *Étant donné* un badge affiché à un annonceur avant révélation d'identité, *quand* on
l'examine, *alors* il nomme le **réseau** et **jamais l'identifiant du compte**.

**CA60** — *Étant donné* un profil créateur servi à un annonceur, *quand* on inspecte la charge utile,
*alors* l'écart déclaré/constaté, les motifs de refus, les notes internes et les valeurs exactes
**n'y figurent pas**, pas même vides.

### Leads, messages, accessibilité

**CA61** — *Étant donné* un badge accordé, *quand* le créateur a donné son consentement marketing,
*alors* seuls **l'état du badge et sa date** sont mis à jour chez Brevo.

**CA62** — *Étant donné* un créateur **sans** consentement marketing, *quand* son badge change d'état,
*alors* aucun contact marketing n'est mis à jour, la ligne est marquée « ignoré — sans consentement »,
et **elle n'apparaît pas dans le compteur d'échecs**.

**CA63** — *Étant donné* un refus ou un retrait, *quand* la notification est envoyée, *alors* elle est
**transactionnelle**, ne dépend d'aucun consentement, et **ne déclenche aucun scénario de nurturing**.

**CA64** — *Étant donné* chacun des messages de RG93, *quand* la langue de l'interface est l'anglais,
*alors* la version anglaise s'affiche, **sans aucun texte français résiduel**.

**CA65** — *Étant donné* les états « vérifié », « à rafraîchir », « à reconfirmer » et « déclaré »,
*quand* ils s'affichent, *alors* chacun porte un **libellé écrit** et la couleur n'est jamais le seul
porteur de l'information.

**CA66** — *Étant donné* un créateur qui n'a encore rien déposé, *quand* il ouvre l'écran de
vérification, *alors* il voit **ce que son badge affichera publiquement** et ce qui restera interne.

**CA67** — *Étant donné* un échec de dépôt d'une pièce, *quand* le message s'affiche, *alors* les autres
pièces et les informations de la demande sont **conservées**.

---

## Impacts

### Écrans à concevoir (`expert-ux`)

| Espace | Écran | Remarque |
|---|---|---|
| Membre créateur | « Vérifier mes comptes » — liste des réseaux déclarés, état de chacun | Badge **par réseau**, jamais global (RG13) |
| Membre créateur | Preuve de propriété — code, marche à suivre par réseau, délai de validité | Mention « INFLUX ne demande jamais votre mot de passe » (RG29) |
| Membre créateur | Dépôt des pièces d'audience — instructions de capture, exemples visuels de bon et mauvais cadrage | **Les instructions sont l'écran, pas une note en bas de page** (RG87) |
| Membre créateur | « Ce que verra une marque » — prévisualisation du badge et des tranches | RG96 |
| Membre créateur | Suivi de la demande : en attente, refusée avec motif, accordée, expirée | Quatre états, quatre messages (RG95) |
| Membre créateur | Bandeau de péremption : J-15, « à rafraîchir », expiré | Trois messages distincts (RG70) |
| Membre créateur | Contestation d'un refus ou d'un retrait | Délai de 30 jours affiché (RG77) |
| Membre annonceur | Badge et son explication, partout où il apparaît | Date **toujours** présente (RG4) ; explication au même endroit (RG7) |
| Membre annonceur | Facette « profils vérifiés » dans la recherche | Lot 3 |
| Backoffice | File « à vérifier » — vue créateurs et vue marques, tri, verrou, SLA | RG61 à RG68 |
| Backoffice | Écran de décision : pièces, constat de propriété, saisie des valeurs, comparaison déclaré/constaté, motifs | **Tout sur un écran** (RG55) ; raccourcis clavier (RG98) |
| Backoffice | Demande de retrait de badge + approbation par un administrateur | Double validation ou confirmation différée (RG75) |
| Backoffice | File des contestations | Agent différent du décideur (RG77) |
| Backoffice | Tableau de bord : en attente, plus ancienne, SLA dépassés, refus par motif, badges à échéance | RG68 |
| Backoffice | Paramètres de vérification (délais, seuils) | Administrateur uniquement, journalisé (RG101) |

### Données (`expert-database`)

Tables prévues et utilisées telles quelles : `verification.verification_requests`,
`verification.ownership_codes`, `verification.evidence_files`, `verification.badges`,
`verification.disputes`, `verification.rejection_reasons`, `profiles.creator_public_profiles`,
`profiles.creator_public_networks`, `profiles.creator_social_accounts`, `audit.audit_events`,
`backoffice.sla_policies`, `reference.networks`, `reference.audience_bands`.

**Huit écarts constatés avec `docs/mvp/04-modele-de-donnees-mvp.md` §5.3, à instruire :**

1. **`verification.evidence_files.content_type` autorise `application/pdf`**, alors que
   `03-matrice-des-droits-et-rls.md` §6.6 règle **E1-9** refuse le PDF au MVP. **RG34 tranche : images
   uniquement.** La contrainte doit être resserrée, pas assouplie.
2. **Aucune table de motifs de retrait.** `verification.badges.revocation_reason_code` n'a pas de
   référentiel : il faut une liste **fermée et distincte** des motifs de refus (RG73, cinq codes dont
   `influx_error`).
3. **Aucun état « à reconfirmer »** dans `verification.badge_state` (`active` · `to_refresh` ·
   `expired` · `revoked`). RG78 en a besoin pour le changement d'identifiant.
4. **Aucune table de motifs ni de SLA sur `verification.disputes`** : la contestation a besoin d'un
   motif typé côté créateur, d'une issue typée, d'un délai de recevabilité (30 jours) et d'un délai de
   traitement.
5. **Aucune colonne pour l'identifiant du compte observé** au moment du constat de propriété :
   `ownership_codes` porte `observed_by_agent_id` et `observed_at`, mais pas **ce qui a été observé**.
   Sans lui, le changement d'identifiant (RG78) n'est pas détectable.
6. **Aucun référentiel `reference.engagement_bands`**, alors que `creator_public_networks.engagement_band`
   existe. Les bornes doivent être une liste fermée partagée, comme `audience_bands` (RG20, RG29 de `06`).
7. **Aucune trace du nombre de demandes et de refus par triplet** : RG60 (délai de 24 h, plafond de 3
   refus par 30 jours) a besoin d'un compteur ou d'une requête indexée sur l'historique.
8. **Aucune colonne pour la version des instructions de capture** acceptée par le créateur au dépôt :
   utile en cas de contestation portant sur les données de tiers (**Q2**).

**Écart levé le 2026-09-24 (D51, arbitrage du fondateur ; `06` le disait déjà dans ses acteurs et cas limites).** *Texte d'origine :* `06` (cas limite « droit insuffisant ») dit
que **seul un administrateur** peut retirer un badge, alors que `03` §3.2 autorise un **agent avec
double validation** (`✔ · J · 2V`). **RG75 retient la matrice** : demande par un agent, approbation par
un administrateur distinct. Le document `06` est à aligner.

À prévoir également : tous les paramètres de RG100 vivent **en table**, modifiables sans
redéploiement, chaque modification étant journalisée.

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Supabase Storage** | Compartiment **privé** `verification`, distinct de `portfolio` ; types et tailles au niveau du compartiment ; dépôt par URL signée ≤ 5 min ; **lecture jamais par URL signée**, relais par l'API, journalisée ; EXIF supprimés, images ré-encodées ; date de purge obligatoire |
| **Brevo — contacts** | Deux attributs seulement : état du badge, date du badge (sous consentement) |
| **Brevo — transactionnel** | 11 notifications bilingues (RG94), hors consentement, hors nurturing |
| **Apollo.io** | **Rien.** Aucune donnée de vérification n'est transmise |
| **Tâche quotidienne** | Rappel J-15, passage en « à rafraîchir », expiration, expiration des codes, expiration des verrous, purge des pièces |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| Délai médian de traitement d'une demande, et délai du 9e cas sur 10 | **Cible 1 jour ouvré** (**D39**), alerte à 3 jours ouvrés |
| Demandes en attente, et ancienneté de la plus ancienne | Affichées en permanence, pas en rapport mensuel |
| Taux de refus par motif | Suivi ; `other` doit rester **sous 10 %** (RG58) |
| Taux de créateurs publiés disposant d'au moins un « Compte vérifié » | Doit tendre vers 100 % (RG16 en fait une condition) |
| Taux de créateurs publiés disposant d'une « Audience vérifiée » | Mesuré ; c'est l'indicateur de valeur du badge |
| Badges arrivant à échéance sous 30 jours | Suivi hebdomadaire : prévient la vague de rafraîchissement |
| Taux de rafraîchissement dans le délai de grâce | Mesuré ; un taux faible signale un rappel mal conçu |
| Écart médian déclaré / constaté | Mesuré ; c'est la mesure de la sincérité déclarative de la base |
| Nombre de retraits, dont `influx_error` | Suivi ; `influx_error` mesure la qualité de la procédure, pas la faute d'un agent |
| Contestations ouvertes, et taux d'issue favorable au créateur | Un taux élevé signale une procédure trop sévère ou mal expliquée |
| Demandes traitées par agent et par semaine | Mesure de la capacité opérationnelle (`backoffice-ops` règle 20) |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| **Vérification automatique par connexion à l'API d'un réseau** (OAuth Instagram, TikTok) | Agréments longs, quotas, dépendance. Le challenge de bio temporaire (RG24) est le mode de départ, progressivement remplacé par OAuth au fil des agréments (D65) | Après le pilote / au fil des agréments |
| **Connexion OAuth YouTube** | Cadrage **D65** : planifiée en **fin de MVP** pour prouver la chaîne et remonter ses métriques directement | **Fin de MVP** (Lot 6 / transition V2) |
| **Détection de faux abonnés** | Aucun outil au MVP ; le badge **ne dit rien** sur ce sujet (RG80) | **Q3**, arbitrage du fondateur |
| Badge global « créateur vérifié » | RG13 : le badge est par réseau. Un badge global ment sur les réseaux non vérifiés | Jamais sous cette forme |
| Badge dégradé, partiel, ou « en cours de vérification » affiché publiquement | Ne rien affirmer vaut mieux qu'affirmer à moitié (`06` RG52) | Non planifié |
| Note, score de fiabilité, classement des créateurs vérifiés | Ce serait un jugement de valeur, pas un constat | Non planifié |
| Vérification d'identité civile du créateur (pièce d'identité, KYC) | Relève du prestataire de paiement, hors application au MVP | Lot 4 / V2 |
| Vérification des comptes gérés par une agence, comptes partagés, comptes multi-utilisateurs | Le modèle « un compte = une personne » ne les porte pas | Après le pilote |
| Historique public des badges (« anciennement vérifié ») | RG76 : un historique public est une affirmation supplémentaire, non nécessaire | Non planifié |
| Vérification des marques par API de registre d'entreprises | `06` : couverture inégale, coût, agréments | Après le pilote |
| Attribution en lot, ou file traitée par un automatisme | RG9 : attribution manuelle uniquement | Non planifié |
| Affichage des valeurs exactes constatées à un annonceur avant révélation | RG20, **D16** | Lot 4, après révélation |
| Partage d'une pièce avec un annonceur, même consenti par le créateur | **C(13)** : interdiction absolue | **Jamais** |
| Vérification des créateurs mineurs | **D15** : mineurs exclus au MVP | Non planifié |
| Portugais et autres langues | Français et anglais au lancement | Avant l'ouverture du Brésil |
| Tout montant, taux ou commission | **A1**, `CLAUDE.md` §2 | V2 |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | *Hypothèse validée pour `staging` le 2026-11-01 (fondateur, D34) : libellés de RG10, péremptions de la colonne suivante, en table ; relecture du juriste avant `production`.* **D34 — libellés définitifs des trois badges**, en français et en anglais, et **durée exacte de péremption**. Le libellé engage la responsabilité d'INFLUX : il doit être relu par un juriste **avant tout affichage** | Libellés de **RG10**, péremption **90 jours** pour l'audience, **aucune péremption calendaire** pour « Compte vérifié », **12 mois** pour « Marque vérifiée » (`06` RG54) | **Fondateur** + `product-owner` + `expert-conformite-rgpd` + juriste | Lot 2, **avant tout affichage** |
| **Q2** | ✅ ***Tranchée le 2026-11-01 (fondateur) : pièces supprimées 45 jours après la décision (RG86) ; constats conservés 3 ans, sous forme pseudonyme après suppression du compte ; pièce trop large supprimée aussitôt (RG88) ; revue `expert-conformite-rgpd` au Lot 6.*** **Données de tiers dans les captures** : base légale du traitement, information des personnes concernées, suffisance des instructions de capture, **durée de conservation des pièces (90 jours après décision)** et **des constats (3 ans)**, conservation des constats après suppression du compte, délai de contestation (30 jours) | Durées ci-contre, suppression immédiate des pièces trop larges (RG88), constats conservés sous forme pseudonyme après suppression de compte | `expert-conformite-rgpd` (**veto**) | Lot 2, **bloquant avant mise en ligne** |
| **Q3** | **Détection de faux abonnés** : acquérir un outil tiers, ou assumer durablement que le badge ne dit rien sur l'authenticité ? Tant que la réponse est « assumer », la mention de RG10 est obligatoire et non déplaçable | **Assumer** : aucun outil, aucune affirmation, mention explicite | **Fondateur** | Après le pilote |
| **Q4** | **Campagnes réservées aux profils vérifiés** : levier de désirabilité du badge, en tension directe avec **D38** (masse critique). Activer trop tôt vide les campagnes ; activer trop tard rend le badge inutile | Option **présente en base, désactivée par paramètre** au lancement (RG18) | `chef-de-projet` + **Fondateur** | Avant le Lot 3 |
| **Q5** | ✅ ***Tranchée le 2026-11-01 (fondateur) : valeurs ci-contre, en table (RG100).*** **Valeurs de départ des délais** : validité du code (7 jours), délai de grâce après péremption (30 jours), délai entre deux demandes (24 h), plafond de refus (3 / 30 jours) | Valeurs ci-contre, **toutes en table** (RG100) | `product-owner` + `expert-ux` | Lot 2 |
| **Q6** | ✅ ***Tranchée le 2026-11-01 (fondateur) : oui, 1 jour ouvré.*** **SLA de la file de vérification : 1 jour ouvré comme la file de validation (D39) ?** La vérification est moins urgente commercialement qu'une mise en relation, mais un créateur non vérifié ne peut pas publier (RG16) — le délai bloque donc l'entrée dans le produit | **Oui, 1 jour ouvré**, valeur unique pour toutes les files, paramétrable par file (RG65) | `chef-de-projet` + **Fondateur** | Lot 2 |
| **Q7** | ✅ ***Tranchée le 2026-09-24 (D51) : la matrice — agent + approbation d'un administrateur distinct.*** **Qui peut retirer un badge** : `03` §3.2 autorise un agent avec double validation, `06` réserve le retrait à un administrateur. Les deux documents doivent dire la même chose | **La matrice** : agent + approbation d'un administrateur distinct, ou confirmation différée journalisée (RG75). `06` à aligner | `architecte` + `product-owner` | Lot 2 |
| **Q8** | ✅ ***Tranchée le 2026-11-01 (fondateur) : oui, « Compte vérifié » requis pour publier (RG16).*** **Faut-il exiger « Compte vérifié » pour publier un profil créateur ?** C'est une friction réelle à l'entrée, au moment où la plateforme a le plus besoin de profils | **Oui** (RG16) : sans elle, une audience affichée peut appartenir à n'importe qui, et le produit ment dès la première recherche | **Fondateur** + `chef-de-projet` | **Avant le Lot 3** |
| **Q9** | **Un créateur peut-il refuser que son badge soit affiché** tout en restant publié ? Cas d'un créateur discret, ou en désaccord avec la tranche publiée | **Non au MVP** : le badge est un constat d'INFLUX, pas une donnée du créateur. Le droit d'opposition s'exerce en se retirant de la recherche (`is_searchable`) | `expert-conformite-rgpd` + `product-owner` | Lot 3 |
| **Q10** | ✅ ***Tranchée le 2026-11-01 (fondateur) : audience : nano < 10 000 · micro 10 000 à 49 999 · mid 50 000 à 499 999 · macro 500 000 à 999 999 · méga ≥ 1 000 000 ; engagement : < 1 % · 1 à 3 % · 3 à 6 % · ≥ 6 % ; valeurs de départ en table, identiques partout.*** **Bornes des tranches d'audience et d'engagement** publiées : elles doivent être **identiques** côté créateur, côté recherche et côté campagne, et il n'existe pas encore de référentiel d'engagement | Bornes à écrire dans `reference.audience_bands` et un nouveau `reference.engagement_bands` | `expert-matching` + `product-owner` | Avant le Lot 3 |
| **Q11** | **Conduite à tenir en cas de signalement de faux abonnés par une marque**, alors qu'INFLUX n'a aucun moyen de preuve : que répond-on, et que fait-on du badge ? | Note interne, aucune mention publique, aucun retrait sans pièce (RG80) ; réponse type à rédiger | `chef-de-projet` + `expert-conformite-rgpd` | Lot 3 |
