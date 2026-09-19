# Lots 4 et 5 — Pipeline commercial : l'affaire, ses montants et la commission encaissée

> **L'affaire naît au Lot 4** (créée automatiquement à la révélation d'identité) et **se renseigne au
> Lot 5** (montants, états, encaissements, écrans de pipeline). Le commercial ne crée jamais une
> affaire : il la trouve déjà ouverte et la remplit.

> **Date :** 2026-09-19 · **Auteur :** agent `expert-paiement-facturation`, avec `product-owner` en
> appui pour le format · **Statut :** spécification complète du pipeline commercial (Lot 5), soumise
> à la validation du **Fondateur** (§10.2 de `CLAUDE.md` : commission, facturation et flux financiers
> relèvent de lui), avec avis obligatoire de `expert-database` (écarts de modèle §Impacts) et de
> `expert-conformite-rgpd` sur les questions fiscales et la conservation.
>
> **Skills appliquées :** `intermediation-tracking` (mode opératoire), `feature-spec` (format de
> sortie), `backoffice-ops` (anatomie des écrans internes).
>
> **Documents qui contraignent celui-ci :** `CLAUDE.md` §3 (invariant et **régime transitoire**),
> `docs/mvp/00-cadrage-mvp-v2.md` (arbitrages **A1** et **A8**),
> `docs/mvp/01-intermediation-courtee.md` §6 et §7 (**document pivot**),
> `docs/mvp/03-matrice-des-droits-et-rls.md` §3.5 (conditions **C(27)** à **C(32)**),
> `docs/mvp/04-modele-de-donnees-mvp.md` §5.9 (`billing.*`),
> `docs/mvp/13-file-de-validation-et-mise-en-relation.md` (RG74 : l'affaire naît de la révélation),
> `docs/mvp/12-messagerie-a-trois.md` (clôture `affaire_signee`, **Q7**).
>
> **Ce que ce document tranche :** le moment et le mode de création de l'affaire, la liste exacte des
> états et des transitions, les champs saisis et leurs validations, **ce que l'application refuse de
> faire**, la mécanique des encaissements successifs et de l'écart « due − encaissée », les écrans de
> suivi et leurs totaux par devise, la correction et l'annulation par écriture inverse, les
> indicateurs, l'export, la mesure du contournement, et l'effet d'une réouverture de fil sur la
> créance V2.
>
> **Ce qu'il ne tranche pas :** le taux de 35 % et sa répartition 20 % / 15 % (**Fondateur seul**),
> le traitement fiscal (**D7**), la structure des factures (**D23**), le prestataire de paiement
> (**D9**), l'arrondi (**D19**), les devises autorisées (**D27**), le schéma SQL définitif
> (`expert-database`), la maquette et la microcopie (`expert-ux`).

---

> ## ⛔ L'invariant de ce document, avant tout le reste
>
> **AUCUN TAUX ET AUCUN CALCUL DE COMMISSION DANS LE CODE AU MVP.**
>
> La seule arithmétique autorisée est **l'addition, la soustraction et la comparaison de montants
> saisis par un humain**. Aucune multiplication par un pourcentage, nulle part : ni serveur, ni
> front, ni export, ni e-mail, ni tableau de bord. `billing.commission_rates` est créée et **reste
> vide**, et aucun rôle applicatif n'a le droit d'y écrire (`03` C(32), `04` §5.9).
>
> Le commercial saisit **deux montants** — le montant du contrat et la commission convenue.
> L'application les enregistre, les compare l'un à l'autre, les additionne entre affaires de même
> devise, et **ne déduit jamais l'un de l'autre**.

---

## Besoin

**Donner à INFLUX la seule mesure de son revenu réel, sur un pilote où l'argent ne passe pas par la
plateforme.**

Le contrat part hors application et le paiement se fait à la confiance (**A1**). Entre la mise en
relation et l'euro encaissé, il n'y a plus qu'une relation commerciale et la parole des gens. Le
pipeline est ce qui transforme cette parole en donnée : qui a signé, pour combien, dans quelle
devise, quelle commission a été convenue, et **combien a réellement été encaissé**.

Trois raisons d'être, dans cet ordre :

1. **Financière.** Sans pipeline, INFLUX ne connaît pas son chiffre d'affaires. Pas « mal » : pas du
   tout. C'est le seul endroit où le revenu existe pendant le pilote.
2. **Comptable.** Le jour où la société existe (**D25**) et où un expert-comptable ouvre le dossier,
   la question sera : *de quoi vient cet argent, et où est la pièce ?* Un euro encaissé doit rester
   rattaché à une mise en relation nommée, datée et confirmée par e-mail (`MER-2026-000123`).
3. **Stratégique.** Le barème de la V2 se règlera sur les montants réels du pilote, pas sur des
   souvenirs. Une commission convenue à 22 % sur trois affaires et à 35 % sur douze autres est une
   information de premier ordre — à condition d'avoir été enregistrée.

> **Ce que le pipeline n'est pas.** Ce n'est ni un moteur de facturation, ni un outil d'encaissement,
> ni un début de comptabilité. C'est un **registre de ce qui a été convenu et de ce qui a été reçu**,
> tenu par un humain, contrôlé par la base.

---

## Acteurs

| Acteur | Ce qu'il fait dans ce périmètre |
|---|---|
| **Commercial INFLUX** (rôle `agent`) | Fait avancer l'affaire dont il est **responsable** : saisit le montant, la devise, la commission convenue, les dates, le mode d'envoi du contrat, les encaissements ; corrige avec motif ; déclare une perte ou un contournement ; lit les affaires de ses collègues sans pouvoir les modifier |
| **Administrateur INFLUX** (rôle `admin`) | Tout ce qui précède sur **toute** affaire, plus : retour en arrière d'état, abandon de créance, réattribution du responsable, export, traitement des anomalies |
| **Système** | Crée l'affaire à la révélation, contraint les transitions, historise toute modification de montant ou de date, calcule les **soustractions** d'écart et les **sommes par devise**, déclenche les relances internes, marque les affaires silencieuses |
| **Marque** et **créateur** | **Ne voient rien.** Ni montant enregistré, ni commission convenue, ni état de l'affaire (`03` C(28)). Le pipeline est de la donnée interne d'INFLUX |
| **Fondateur** | Lit le tableau de bord, arbitre le barème, décide d'un abandon de créance au-delà du seuil |
| **Expert-comptable** (externe, futur) | Destinataire de l'export ; **valide D7 et D23 avant la première commission encaissée** |

> **Une seule population dans ce document.** Le pipeline est un écran de backoffice, vu par des
> internes uniquement. Aucun écran décrit ici n'est partagé avec un membre.

---

## User stories

### Commercial

- **US1** — En tant que **commercial**, je veux retrouver dans une seule liste toutes les affaires
  dont je suis responsable et leur état, afin de savoir chaque matin lesquelles relancer.
- **US2** — En tant que **commercial**, je veux enregistrer en moins d'une minute le montant négocié
  et la commission convenue au moment où je raccroche, afin que la donnée soit saisie tant qu'elle
  est fraîche et exacte.
- **US3** — En tant que **commercial**, je veux enregistrer chaque encaissement au fil de l'eau, avec
  sa date et son montant, afin de savoir à tout instant ce qui reste dû.
- **US4** — En tant que **commercial**, je veux corriger un montant que j'ai mal saisi, en disant
  pourquoi, afin que la correction soit une trace et non un effacement.
- **US5** — En tant que **commercial**, je veux déclarer une affaire perdue avec un motif choisi dans
  une liste, afin que mes échecs soient exploitables et pas seulement subis.
- **US6** — En tant que **commercial**, je veux voir l'affaire d'un collègue quand il est absent,
  afin de répondre à une marque sans attendre son retour.

### Administrateur et fondateur

- **US7** — En tant qu'**administrateur**, je veux voir la commission encaissée du mois **par
  devise**, afin de savoir ce qu'INFLUX a réellement gagné.
- **US8** — En tant qu'**administrateur**, je veux la liste des affaires signées dont la commission
  n'est ni facturée ni encaissée, afin qu'aucun euro ne se perde par oubli.
- **US9** — En tant qu'**administrateur**, je veux exporter les affaires d'une période, afin de les
  remettre à un expert-comptable le jour où la société existe.
- **US10** — En tant que **fondateur**, je veux le nombre d'affaires traitées par commercial et par
  semaine, afin de savoir si la plateforme fait passer le métier à l'échelle.

### Système

- **US11** — En tant que **système**, je veux refuser toute transition d'état non prévue et tout
  montant incohérent, afin que le registre reste défendable devant un comptable.

---

## Règles de gestion

### A. Naissance de l'affaire

**RG1** — **Une affaire est créée automatiquement par le système, à l'instant de la révélation
d'identité**, dans la transaction atomique qui porte aussi la conversation, l'événement chaîné et les
deux e-mails (`03` C(21) étape 4, `13` RG74 point 4, `01` §6). Elle naît à l'état `open`, **sans
aucun montant**. *Arbitrage `chef-de-projet` du 2026-09-19.*

> **Pourquoi automatique, et pas « créée par le commercial ».** Deux raisons, dans cet ordre.
>
> **1. Sans affaire, une mise en relation qui ne mène à rien n'a aucun endroit où enregistrer son
> motif de perte.** C'est le point décisif, et il est produit avant d'être technique : ce que **A8**
> demande au commercial, ce n'est pas seulement de déclarer ses succès, c'est de **déclarer l'issue**
> — y compris quand il n'y a pas eu d'affaire. Le taux de transformation « mise en relation →
> affaire signée » n'a de sens que si les échecs ont une ligne. Avec une création manuelle, les
> échecs ne seraient jamais créés et le taux de transformation vaudrait 100 %.
>
> **2. Une création manuelle rend l'alerte de saisie négligée inopérante** : elle n'a aucune ligne à
> interroger, donc le commercial qui ne saisit rien devient invisible — précisément le comportement
> qu'il faut détecter.
>
> **Une affaire vide en `open` n'est pas un faux positif, c'est un signal utile** : elle dit
> « montant non renseigné », ce qui est l'état normal des premiers jours d'une négociation et une
> anomalie au bout de quelques semaines (RG8bis).

**RG2** — **Le commercial ne crée pas l'affaire : il la renseigne.** Son geste est la saisie du
montant, de la devise, de la commission convenue, des dates et de l'issue. Aucun écran de création
d'affaire n'existe dans le backoffice, et le vocabulaire des interfaces dit « renseigner l'affaire »,
jamais « créer une affaire ».

**RG2bis** — **Aucune affaire orpheline, et aucune révélation sans affaire.** Toute affaire est
rattachée à une mise en relation existante (`deals.introduction_id` obligatoire, `03` C(27)), et
réciproquement toute mise en relation révélée porte exactement une affaire. Il n'existe aucun écran,
aucune route d'API et aucun droit permettant de créer une affaire seule.

**RG3** — **Une affaire au plus par mise en relation.** L'unicité de `introduction_id` est
**confirmée** (répond à la question Q2 de `04`). Motif : c'est elle qui rend le rattachement
comptable non ambigu — un euro encaissé désigne une et une seule référence `MER-…`, et
réciproquement. Un lien « une mise en relation, plusieurs affaires » obligerait à répartir un
encaissement entre plusieurs contrats sans règle pour le faire.

**RG4** — **Une seconde collaboration entre les deux mêmes parties est une nouvelle mise en
relation**, donc une nouvelle affaire, avec sa propre référence. Elle n'est jamais enregistrée en
augmentant le montant d'une affaire existante : un montant de contrat qui grossit après coup n'est
plus un montant de contrat, c'est un cumul dont personne ne sait ce qu'il contient.

**RG5** — L'affaire hérite à sa création, **par copie et non par jointure** : le commercial
responsable (`owner_agent_id`), la date de révélation (`revealed_at`), la campagne et les deux
parties. La copie de la date de révélation rend déclarative la contrainte « signé après révélé »
(`04` R7).

**RG6** — **La devise n'est pas héritée** : elle n'existe pas encore à la création. Elle est saisie
avec le premier montant (RG24).

**RG7** — Une affaire **ne se supprime jamais** (`03` §4 P8, obligation de conservation). Une affaire
créée à tort se termine en `lost` avec le motif `ouverture_erronee` ; la ligne demeure.

**RG8** — La création de l'affaire écrit un événement `deal.created` dans le registre chaîné, comme
tout événement de mise en relation. Son auteur est **le système**, pas le commercial : celui-ci
apparaîtra dans le registre à sa première saisie.

**RG8bis** — **Une affaire restée en `open` sans aucun montant déclenche une alerte « montant non
saisi »** : rappel au commercial responsable après un premier délai, escalade à l'administrateur
après un second. Valeurs d'attente : **14 jours** puis **30 jours**, toutes deux **en table**
(`backoffice.operational_settings`), calibrées après un mois de mesure (**Q13**).

> **Ce n'est pas une alerte de retard, c'est l'alerte de la donnée manquante.** Une négociation qui
> dure trois semaines sans montant est normale ; une mise en relation de deux mois dont personne ne
> sait ni le montant, ni qu'elle est perdue, est soit un contournement, soit une saisie négligée
> (`01` §10, limite n° 6). L'alerte remplace l'ancien indicateur « révélée sans état d'affaire », qui
> n'a plus d'objet puisque l'affaire existe désormais toujours : ce qu'on surveille n'est plus
> l'absence de ligne, c'est **l'absence de contenu dans la ligne**.

### B. Les états et leurs transitions

**RG9** — Les états d'une affaire sont **au nombre de huit**, et il n'en existe pas d'autres :

| État | Ce qu'il signifie | Ce qui devient obligatoire à la saisie |
|---|---|---|
| `open` | Conversation ouverte, rien de convenu | — |
| `negotiating` | Un montant est discuté | Montant du contrat + devise |
| `contract_sent` | Contrat envoyé **hors plateforme** | Date d'envoi + **mode d'envoi** |
| `signed` | Contrat signé entre les parties | Date de signature, montant, devise, **commission convenue**, base fiscale du montant |
| `commission_invoiced` | INFLUX a émis sa facture de commission | Date + référence de facture **externe** |
| `commission_received` | Au moins un encaissement enregistré | Au moins une ligne d'encaissement |
| `lost` | L'affaire **ne s'est jamais faite** | **Motif typé** |
| `cancelled` | L'affaire **s'était faite** puis a été dénouée | **Motif typé**, et traitement de la commission déjà encaissée (RG80) |

**RG10** — **`stalled` et `disputed` ne sont pas des états, ce sont des qualificatifs.** Une affaire
silencieuse reste `negotiating` ou `signed` ; une affaire en litige reste dans l'état où elle se
trouve. Ils sont portés par des attributs (`stalled_since`, `disputed_since`, `disputed_note`,
`disputed_resolved_at`) qui se cumulent avec l'état.

> **Pourquoi ce n'est pas un détail.** Si `disputed` était un état, une affaire signée qui entre en
> litige **perdrait l'information qu'elle est signée** — et donc la commission due disparaîtrait du
> reste à encaisser au moment précis où elle devient un enjeu. Même raisonnement pour `stalled` : on
> ne saurait pas dans quel état revenir quand la conversation reprend. `01` §6.1 le disait déjà à
> demi-mot (« alerte automatique, pas un état subi ») ; ce document le rend explicite.

**RG11** — **`lost` et `cancelled` sont deux choses différentes et ne doivent jamais être
confondues.** `lost` = aucune commission n'a jamais été due. `cancelled` = une commission a été
convenue, parfois facturée, parfois encaissée, et l'affaire se dénoue ensuite. Les fusionner
rendrait impossible de distinguer un échec commercial d'un remboursement.

**RG12** — Les transitions autorisées sont **exactement** celles-ci, et elles sont contraintes **en
base** par une table de transitions plus un déclencheur (`04` §5.9, `03` C(31)) :

| Depuis | Vers | Qui | Ce qui doit être saisi | Réversible ? |
|---|---|---|---|---|
| `open` | `negotiating` | Responsable | Montant + devise | Oui, vers `open` par l'admin |
| `open` · `negotiating` | `lost` | Responsable | Motif typé | **Oui** (RG18) |
| `negotiating` | `contract_sent` | Responsable | Date d'envoi + mode d'envoi | Oui, vers `negotiating` |
| `negotiating` · `contract_sent` | `signed` | Responsable | Date de signature, montant, devise, commission convenue, bases fiscales, payeur | Oui, **admin seul**, et **jamais si un encaissement existe** (RG19) |
| `contract_sent` | `lost` | Responsable | Motif typé | Oui |
| `signed` | `commission_invoiced` | Responsable ou admin | Date + référence de facture externe | Oui, admin seul |
| `signed` | `commission_received` | Responsable ou admin | Ligne d'encaissement **+ signalement « facture manquante »** (RG16) | Non — seule l'écriture inverse défait un encaissement |
| `commission_invoiced` | `commission_received` | Responsable ou admin | Ligne d'encaissement | Non — idem |
| `signed` · `commission_invoiced` · `commission_received` | `cancelled` | **Admin seul** | Motif typé + traitement des sommes reçues (RG80) | **Non. État terminal.** |
| `lost` | `negotiating` | Responsable | Motif de reprise obligatoire | — |

Toute autre transition est **refusée par la base**, y compris si le code applicatif la demande.

**RG13** — **Toute transition est journalisée** : affaire, état d'origine, état d'arrivée, auteur
nominatif, horodatage, motif le cas échéant, et l'écran depuis lequel elle a été demandée.

**RG14** — **On n'entre jamais en `signed` sans commission convenue.** C'est la contrainte qui
protège le revenu : une affaire signée sans commission enregistrée est une affaire dont INFLUX ne
sait pas ce qu'elle lui rapporte. Si la commission n'est pas encore arrêtée, l'affaire reste en
`contract_sent`.

**RG15** — **On n'entre jamais en `signed` avec une date de signature antérieure à la révélation
d'identité.** Un contrat signé avant la mise en relation n'est pas produit par INFLUX ; c'est une
relation préexistante, et elle relève de la clause de sauvegarde des CGU (`01` §8.1).

**RG16** — **Un encaissement sans facture préalable est autorisé, mais jamais silencieux.** Passer de
`signed` directement à `commission_received` est possible — c'est ce qui arrive réellement quand un
client paie avant qu'INFLUX ait émis sa facture — mais l'affaire est alors marquée **« facture
manquante »**, apparaît dans la liste des anomalies et y reste jusqu'à la saisie de la référence de
facture.

> **Pourquoi autoriser plutôt que bloquer.** Une règle qui empêche d'enregistrer un fait déjà survenu
> ne fait pas disparaître le fait : elle fait disparaître son enregistrement. Le commercial
> n'inventera pas une facture, il ne saisira rien du tout — et l'argent encaissé deviendra invisible.
> On enregistre la réalité, on signale l'anomalie, un humain la résout.

**RG17** — Une affaire est **silencieuse** (`stalled_since` posé) après **14 jours** sans message dans
la conversation **et** sans changement d'état (`01` M6). Le seuil est une **donnée** de
`backoffice.operational_settings`, pas une constante.

**RG18** — **Une affaire perdue peut revivre.** Le retour de `lost` vers `negotiating` est autorisé au
responsable, avec un motif écrit obligatoire, et il est journalisé. Le motif de perte précédent est
conservé dans l'historique : on n'efface pas un échec, on le date.

**RG19** — **Le retour en arrière depuis `signed` est réservé à l'administrateur**, exige un motif, et
est **interdit dès qu'un encaissement existe**. À partir du premier euro reçu, la seule façon de
défaire quelque chose est l'écriture inverse (RG79).

**RG20** — Un litige (`disputed_since` + note interne obligatoire) **gèle les relances automatiques**
de l'affaire concernée mais ne la retire ni du reste dû, ni des totaux. Une créance contestée reste
une créance tant qu'elle n'a pas été abandonnée explicitement (RG64).

**RG21** — L'état d'une affaire n'est **jamais** dérivé d'autre chose que d'une action humaine ou de
la tâche quotidienne de silence. Aucun état ne change parce qu'une date est passée.

**RG22** — Les motifs de perte forment une **liste fermée**, en table (`billing.lost_reasons`),
modifiable sans redéploiement :

`budget_insuffisant` · `delai_incompatible` · `createur_indisponible` · `marque_desistee` ·
`createur_desiste` · `desaccord_conditions` · `campagne_annulee` · `concurrent_choisi` ·
**`conclu_hors_influx`** (RG89) · `sans_reponse` · `ouverture_erronee` · `autre`
(commentaire interne obligatoire).

Les motifs d'annulation après signature sont une **liste distincte**
(`billing.cancellation_reasons`) : `campagne_non_livree` · `livrable_refuse` · `rupture_marque` ·
`rupture_createur` · `litige_resolu_en_annulation` · `erreur_de_saisie` · `autre`.

> **Pourquoi deux listes et pas une colonne « scope ».** Les motifs d'un échec de négociation n'ont
> rien à voir avec ceux d'une annulation après signature, et les mélanger rendrait les deux
> statistiques inexploitables — or c'est exactement pour ces statistiques qu'on les typise
> (`04` §3, `backoffice-ops`).

### C. Les champs saisis

**RG23** — **Le montant du contrat est le coût total pour l'annonceur, commission comprise**
(`CLAUDE.md` §3). Le libellé du champ le dit mot pour mot : *« Montant du contrat — coût total pour
l'annonceur, commission INFLUX comprise »*. Il n'est jamais appelé « budget », « cachet » ni
« rémunération du créateur ».

> **Le piège à désamorcer explicitement.** Un accord négocié oralement comme « 2 000 pour le créateur,
> plus 700 pour nous » **ne se saisit pas 2 000**. Le montant du contrat est **2 700,00 EUR** et la
> commission **700,00 EUR**. Saisir 2 000 fausserait le montant, l'assiette du futur barème et la
> transformation. L'écran affiche ce rappel au-dessus du champ, et le récapitulatif de confirmation
> (RG38) le rend visible une seconde fois.

**RG24** — **La devise est obligatoire dès qu'un montant existe**, choisie dans une liste fermée
(ISO 4217, `reference.currencies`, `is_active = true`). Elle est **immuable dès l'état `signed`**.

**RG25** — **Une seule devise par affaire. Jamais de conversion au MVP.** Aucun taux de change n'est
stocké, appliqué ni affiché. Une affaire en dollars reste en dollars, du premier montant au dernier
encaissement.

**RG26** — **Les montants sont des entiers en plus petite unité monétaire** (`bigint`), accompagnés de
leur devise, **jamais des flottants** (`04` §3). La conversion entre la saisie humaine (« 2 000,00 »)
et l'entier (`200000`) utilise `reference.currencies.minor_unit`, **lue en base**, jamais une
constante écrite dans le code.

> **Exception documentée au contrôle T16.** Le contrôle d'intégration continue interdit toute
> multiplication d'un montant par une constante (`03` T16). La conversion d'échelle décimale en est
> la **seule exception admise**, elle vit dans un module unique (`packages/domain`, fonctions
> `toMinor` / `fromMinor`), elle est annotée en commentaire, et elle est couverte par des tests
> incluant une devise à zéro décimale (JPY) et une devise à trois décimales (TND). Toute autre
> multiplication d'un montant est un défaut bloquant.

**RG27** — **La saisie d'un montant est une chaîne de caractères analysée, pas un nombre flottant.**
Le serveur refuse une saisie ambiguë plutôt que de deviner : il accepte les séparateurs décimaux des
deux langues de l'interface, refuse plus de décimales que la devise n'en admet, et n'arrondit jamais
en silence.

**RG28** — **Aucune règle d'arrondi n'existe au MVP, parce qu'aucun calcul n'a lieu.** **D19** reste
reportée. Si une spécification, un écran ou une revue de code fait apparaître un besoin d'arrondi,
c'est le signe qu'un calcul s'est introduit quelque part : c'est un défaut bloquant, pas une question
d'arrondi.

**RG29** — **Montant du contrat : jamais négatif. Nul seulement avec un motif.**
`montant ≥ 0`. Un montant nul n'est accepté que si le motif typé `contrepartie_non_monetaire` est
renseigné (produit offert, échange de visibilité, dotation). Dans ce cas, la commission convenue est
nulle elle aussi.

> **Écart avec `04`.** Le modèle impose aujourd'hui `montant > 0` strictement, ce qui rend impossible
> l'enregistrement d'une collaboration en contrepartie produit — un cas réel, prévu par le document
> `09` (envoi de produit). À corriger en `>= 0` avec la contrainte conditionnelle ci-dessus.

**RG30** — **Commission convenue : `0 ≤ commission ≤ montant du contrat`.** Une commission supérieure
au montant du contrat est refusée par la base ; il n'existe aucun motif qui la rende acceptable, une
commission ne pouvant dépasser l'assiette dont elle est issue.

**RG31** — **La note de commission est obligatoire dès que la commission convenue existe.** Texte
libre et court : « barème standard », « dérogation partenariat », « remise de lancement accordée par
le fondateur ». **Ce texte n'est jamais interprété par le code** : aucune lecture de pourcentage,
aucune extraction de chiffre, aucun contrôle de cohérence automatique.

**RG32** — **Le payeur de la commission est saisi** : `annonceur` · `createur` · `les_deux` ·
`autre` (précision obligatoire). Si `les_deux`, le commercial peut saisir séparément la **part
annonceur** et la **part créateur**, toutes deux **saisies**, jamais dérivées ; leur somme doit être
égale à la commission convenue (contrôle d'**addition**, autorisé).

> **Pourquoi ce champ est indispensable dès le pilote.** Il détermine **qui recevra la facture**
> (**D23**) et permet de rapprocher deux règlements provenant de deux payeurs différents. Sans lui,
> un encaissement partiel de 400,00 EUR sur une commission de 700,00 EUR est indéchiffrable : est-ce
> l'annonceur qui a tout payé, ou le créateur qui a payé plus que sa part ? Cette information est
> connue du commercial au moment des faits et irrécupérable ensuite.

**RG33** — **La base fiscale de chaque montant est saisie** : `hors_taxes` · `taxes_comprises` ·
`inconnue` (valeur par défaut refusée à l'enregistrement d'une affaire `signed`). Deux champs
distincts : un pour le montant du contrat, un pour la commission.

> **C'est la donnée la moins chère à collecter maintenant et la plus coûteuse à reconstituer.** Le
> jour où l'expert-comptable instruira **D7** et **D23**, la première question sera : « ces 700,00
> EUR, c'est hors taxes ou toutes taxes comprises ? ». Deux listes déroulantes aujourd'hui valent
> mieux que quinze appels téléphoniques dans six mois. Ce n'est **pas** un calcul de TVA : aucun taux
> de taxe n'est stocké, appliqué ni affiché.

**RG34** — **Mode d'envoi du contrat** : liste fermée `email` · `docusign` · `remise_en_main_propre` ·
`autre` (précision obligatoire), accompagnée de la date d'envoi. Obligatoire à l'état
`contract_sent`.

**RG35** — **Chronologie contrainte en base**, dans cet ordre :
`révélation ≤ envoi du contrat ≤ signature ≤ facturation ≤ premier encaissement`, chaque maillon
étant vérifié seulement si les deux dates existent. Une date future au-delà du jour est refusée pour
la signature et les encaissements ; elle est autorisée pour une facture (facture émise à échéance).

**RG36** — **Tous les horodatages sont datés avec leur fuseau.** Une date de signature sans fuseau
n'est pas une preuve, c'est une approximation.

**RG37** — **Le net créateur indicatif est une soustraction affichée, jamais une colonne stockée.**
`montant du contrat − commission convenue`. Il est étiqueté *« net créateur indicatif »*, jamais
« net créateur » tout court : au MVP, INFLUX ne verse rien et ne garantit rien de ce montant.

**RG38** — **Un récapitulatif de confirmation précède tout enregistrement de montants**, en toutes
lettres, avec la devise sur chaque ligne :

> Vous enregistrez :
> **Montant du contrat** 2 700,00 EUR (coût total pour l'annonceur, commission comprise)
> **Commission convenue** 700,00 EUR — part annonceur 400,00 EUR, part créateur 300,00 EUR
> **Net créateur indicatif** 2 000,00 EUR
> **Base fiscale** : hors taxes · **Devise** : EUR

**RG39** — **La saisie est réservée au commercial responsable et à l'administrateur.** Un autre agent
lit, mais n'écrit pas. Pour écrire, il demande la réattribution (journalisée,
`backoffice.ownership_assignments`) ou passe par l'administrateur.

> **Écart avec `03` §3.5.** La matrice accorde aujourd'hui l'écriture à tout `agent` sans condition
> de responsabilité. Ce document restreint : l'intéressement sera adossé à la commission encaissée,
> et un montant modifiable par un collègue non responsable est une porte ouverte à un conflit
> d'intérêt dont personne n'a besoin pendant un pilote. À réconcilier par `expert-cybersecurite` et
> `expert-database`.

**RG40** — **Aucun montant ni aucune date ne provient du navigateur sans revalidation.** Le client
n'envoie qu'une chaîne saisie et un code devise ; toutes les contraintes de ce document sont
revérifiées côté serveur **et** en base (`03` C(29)).

**RG41** — La référence de facture est une **référence externe**, saisie telle quelle. L'application
ne génère aucun numéro de facture, aucune séquence, aucun document.

**RG42** — Chaque encaissement porte son **mode de règlement** : `virement` · `carte` · `cheque` ·
`especes` · `autre`.

> **Alerte de conformité.** Le mode `especes` déclenche une anomalie visible au backoffice. Dans
> plusieurs pays visés, le paiement en espèces entre professionnels est plafonné, et un commercial
> qui encaisse des espèces pour le compte d'une société qui n'existe pas encore (**D25**) crée un
> problème réel. À faire valider par l'expert-comptable avant le premier encaissement — voir **Q2**.

**RG43** — **La référence `MER-…` de la mise en relation est affichée sur la fiche de l'affaire et
reportée sur chaque ligne d'encaissement et d'export.** C'est elle qui rattache un euro reçu à un
acte d'intermédiation traçable.

**RG44** — Tout champ texte est borné et modéré par l'usage interne uniquement ; aucun texte saisi ici
n'est jamais montré à un membre.

**RG45** — **Aucun champ de ce pipeline ne contient de coordonnée bancaire.** Ni IBAN, ni carte, ni
identifiant de compte. Ce n'est pas un oubli : INFLUX n'encaisse pas dans l'application (**A1**), et
une coordonnée bancaire stockée sans nécessité est une charge de sécurité pure (`03`, `D37` clause de
caducité).

### D. Ce que l'application refuse de faire

**RG46** — **L'application ne pré-remplit jamais la commission convenue.** Le champ est vide, il le
reste tant qu'un humain n'a rien tapé. Aucun bouton « appliquer le barème », aucune valeur suggérée,
aucun placeholder chiffré.

**RG47** — **L'application n'affiche aucun pourcentage, même dérivé de deux montants saisis.** Ni
« soit 35 % », ni « taux effectif », ni graphique de taux.

> **Ce refus mérite d'être justifié, parce qu'il coûte un confort réel.** Afficher
> `700 / 2 700 = 25,9 %` serait une division de deux montants saisis, techniquement licite. Mais un
> pourcentage affiché devient un pourcentage attendu, puis un pourcentage par défaut, puis un
> pourcentage appliqué : c'est le chemin exact par lequel un moteur de commission rentre par la
> fenêtre alors qu'on l'a sorti par la porte (`CLAUDE.md` §6, `01` §7). La vraisemblance d'une
> commission se contrôle très bien en revue hebdomadaire de pipeline, par des humains qui connaissent
> le barème.

**RG48** — **L'application ne contrôle pas la vraisemblance d'une commission.** Pas d'alerte « cette
commission est basse », qui exigerait de comparer un montant à un pourcentage. Les deux seuls
contrôles sont `commission ≥ 0` et `commission ≤ montant du contrat`.

**RG49** — **L'application ne calcule ni ne propose de part annonceur et de part créateur.** Si elles
sont affichées, c'est qu'elles ont été **saisies** (RG32).

**RG50** — **L'application ne lit pas la table des taux.** Aucune requête vers
`billing.commission_rates` n'existe dans le code du MVP. La table est vide et personne n'a le droit
d'y écrire (`03` C(32)).

**RG51** — **L'application n'émet aucune facture, aucun avoir, aucun document comptable, aucun relevé
destiné à un tiers.** Elle n'envoie aucun e-mail à une marque ou à un créateur au sujet d'un montant
ou d'une commission.

**RG52** — **L'application ne convertit aucune devise et n'additionne jamais deux devises
différentes.** Un total inter-devises est refusé au niveau de la requête, pas masqué à l'affichage.

### E. Encaissements, écart et relances

**RG53** — **Les encaissements sont des lignes, pas une colonne.** Chaque règlement reçu crée une
ligne distincte : montant, devise (identique à celle de l'affaire), date de réception, payeur
(annonceur / créateur / autre), mode de règlement, référence externe facultative, auteur de la
saisie, horodatage de saisie, note.

> **Écart avec `04` §5.9.** Le modèle ne prévoit aujourd'hui qu'un couple
> `commission_received_amount_minor` / `commission_received_at`, donc **un seul encaissement**. Or le
> cas le plus fréquent du barème INFLUX est précisément le paiement en deux fois, par deux payeurs
> différents (part annonceur, part créateur), et un acompte suivi d'un solde est banal dans un régime
> à la confiance. Avec une seule colonne, le second règlement **écrase** le premier, et le
> rapprochement bancaire devient impossible. Une table `billing.commission_receipts` est nécessaire
> (voir §Impacts).

**RG54** — **Chaque ligne d'encaissement porte une nature** : `paiement` · `remboursement` ·
`abandon_de_creance`. Le montant est **toujours positif** ; c'est la nature qui porte le sens.

**RG55** — **La commission encaissée est une somme, jamais une valeur saisie directement :**
`encaissée = Σ(paiements) − Σ(remboursements)`. Les abandons de créance **n'y entrent jamais** : un
abandon n'est pas de l'argent reçu.

**RG56** — **Le reste dû est une soustraction :**
`reste dû = commission convenue − Σ(paiements) + Σ(remboursements) − Σ(abandons)`.

**RG57** — **Un encaissement cumulé supérieur à la commission convenue est refusé**, sauf note de
justification obligatoire (trop-perçu, règlement incluant une autre affaire). La note est conservée ;
l'anomalie reste visible tant qu'elle n'a pas été résolue par un remboursement ou une correction.

> **Écart avec `04` §5.9.** La colonne se nomme aujourd'hui `commission_shortfall_note` (« note de
> manque »), alors que la contrainte qui l'utilise ne se déclenche **que dans le cas inverse**, le
> trop-perçu. Le nom décrit le contraire de ce qu'il contrôle. À renommer `commission_variance_note`
> ou équivalent — un nom trompeur sur une contrainte financière finira par être lu de travers.

**RG58** — **Une affaire dont le reste dû est nul est dite *soldée*.** Ce n'est pas un état : c'est
une comparaison affichée. Une affaire soldée reste en `commission_received`.

**RG59** — **Les encaissements sont en ajout seul.** Une ligne erronée ne se supprime pas et ne se
modifie pas : on ajoute une ligne inverse (RG79), avec le motif.

**RG60** — **Les relances sont internes et automatiques**, adressées **au commercial responsable**,
jamais à la marque ni au créateur :

| Déclencheur | Délai | Destinataire | Escalade |
|---|---|---|---|
| `signed` sans facture enregistrée | **J+7** | Responsable | Administrateur à J+21 |
| `commission_invoiced` sans encaissement | **J+30** | Responsable | Administrateur à J+45 |
| Reste dû > 0 | **J+60** après la facture | Responsable + administrateur | Décision explicite à J+90 (RG64) |
| Affaire silencieuse (RG17) | **14 jours** | Responsable | — |
| Affaire en `open` **sans aucun montant saisi** (RG8bis) | **14 jours** | Responsable | Administrateur à **30 jours** |

Tous les délais sont des **données** paramétrables, pas des constantes.

**RG61** — **L'application ne relance jamais un client au sujet d'une commission.** Aucun e-mail,
aucune notification, aucun bandeau côté membre. Trois raisons : les membres ne voient pas le pipeline
(`03` C(28)) ; la structure de la facture n'est pas tranchée (**D23**), donc une relance automatique
réclamerait une somme sans savoir à quel titre ; et `01` §8.2 pose que l'interface ne menace jamais.

**RG62** — **Quand un commercial relance un client par écrit, il le fait dans la conversation à trois**
— c'est le canal tracé, et c'est aussi ce qui rend la relance vérifiable si l'affaire tourne mal. Un
appel téléphonique reste possible et souhaitable ; il est alors **consigné en note interne** sur
l'affaire (date, interlocuteur, engagement obtenu).

**RG63** — Si la conversation a été close avec le motif `affaire_signee`, la relance écrite exige une
**réouverture par un agent** (§K). On ne contourne pas la clôture en écrivant à côté.

**RG64** — **On ne corrige jamais la commission convenue pour la faire coïncider avec ce qui a été
reçu.** Un renoncement se saisit comme un **abandon de créance** : montant, motif, auteur, date.
L'abandon est réservé à l'**administrateur**, et au-delà d'un seuil fixé par le fondateur, il exige
son accord écrit consigné en note.

> **Pourquoi c'est une règle et non une préférence de comptable.** Baisser la commission convenue de
> 700,00 à 200,00 EUR pour « solder » une affaire efface la seule donnée qui dit qu'INFLUX a perdu
> 500,00 EUR. Au bout de six mois, le taux de recouvrement affiché serait de 100 % et le pilote
> paraîtrait sain alors qu'il ne le serait pas.

### F. Suivi, listes et totaux

**RG65** — **Le pipeline se lit d'abord comme une liste**, une ligne par affaire, avec au minimum :
référence `MER-…`, marque, créateur, campagne, commercial responsable, état, qualificatifs (silence,
litige, anomalies), devise, montant du contrat, commission convenue, commission encaissée, reste dû,
date du dernier mouvement.

**RG66** — **Chaque montant affiché porte sa devise et son étiquette.** Jamais un nombre nu. Les
étiquettes autorisées sont : *montant du contrat*, *commission convenue*, *commission encaissée*,
*reste dû*, *net créateur indicatif*, *abandon de créance*. Aucune autre.

**RG67** — **Tout total est un total par devise**, présenté comme tel :
« 4 200,00 EUR · 1 500,00 USD », jamais « 5 700,00 ». Il n'existe aucun total général, aucune
« contre-valeur », aucun montant de référence.

**RG68** — Filtres disponibles : état, qualificatif, commercial responsable, devise, période (sur la
date de signature **ou** sur la date d'encaissement, au choix explicite de l'utilisateur), campagne,
anomalie. Le filtre de période indique toujours **sur quelle date** il porte : un revenu « du mois »
n'a pas le même sens selon qu'on compte les signatures ou les encaissements.

**RG69** — **Au MVP, tout interne voit toutes les affaires** — le portefeuille cloisonné par
commercial n'existe pas encore (`13` §Hors périmètre). L'écriture, elle, reste restreinte (RG39).

**RG70** — **La consultation de la fiche détaillée d'une affaire dont on n'est pas responsable est
journalisée nominativement.** L'affichage de la liste, des totaux agrégés et du tableau de bord ne
l'est pas.

> **Arbitrage assumé, et écart avec `03` §3.5.** La matrice marque aujourd'hui « Affaire — lire » en
> `L · J` sans distinction, ce qui journaliserait une ligne par affaire affichée dans une liste, soit
> des centaines d'entrées par jour et par agent. Un journal illisible ne protège rien : le signal
> qu'on cherche — un commercial qui épluche les affaires d'un collègue — disparaîtrait dans le bruit
> de l'usage normal. On journalise donc **l'ouverture d'une fiche** et **l'export**, pas le
> rendu d'une liste. À confirmer par `expert-cybersecurite` (**Q6**).

**RG71** — **Le tableau de bord du commercial** montre, pour lui seul : affaires par état, commission
encaissée de la période **par devise**, reste dû, relances du jour, anomalies, affaires silencieuses.

**RG72** — **Le tableau de bord de l'administrateur** montre les mêmes éléments pour toute l'équipe,
plus la ventilation par commercial et les indicateurs de §H.

**RG73** — **La fiche d'une affaire affiche son historique complet** : transitions d'état, chaque
modification de montant ou de date (ancienne valeur, nouvelle valeur, auteur, motif), chaque ligne
d'encaissement, chaque note interne. L'historique est en lecture seule pour tous, administrateur
compris.

**RG74** — L'écran d'une affaire rappelle en permanence la référence `MER-…` et un lien vers la
conversation — sans jamais montrer le contenu des messages dans le pipeline.

### G. Corrections, audit et écriture inverse

**RG75** — **Toute modification d'un montant, d'une devise ou d'une date est historisée** : affaire,
champ, ancienne valeur, nouvelle valeur, auteur, horodatage, **motif obligatoire**. L'historisation
est écrite par un **déclencheur en base**, pas par le code applicatif (`04` §5.9).

> **Écart avec `04` §5.9.** La colonne `reason` de `billing.deal_field_changes` est aujourd'hui
> facultative. Elle doit être **obligatoire** pour les champs financiers (montant, devise, commission,
> parts, dates de signature et d'encaissement). Un changement de montant sans motif est exactement le
> cas qu'on cherche à documenter.

**RG76** — **Aucune suppression physique, jamais**, ni d'affaire, ni d'encaissement, ni de ligne
d'historique. Obligation comptable de conservation, retenue à **10 ans** (`04` §Conservation).

**RG77** — **Le registre d'historique est en ajout seul, garanti en base** (`REVOKE UPDATE, DELETE` +
déclencheur), au même régime que le registre d'audit (`01` M4).

**RG78** — **La correction d'un montant ne réécrit pas l'histoire de la commission encaissée.**
Corriger la commission convenue de 700,00 à 650,00 EUR change le reste dû ; cela ne change **aucune**
ligne d'encaissement déjà saisie.

**RG79** — **L'annulation se fait par écriture inverse, jamais par effacement.** Une affaire annulée
après encaissement (`cancelled`) exige, pour chaque somme reçue, soit une ligne `remboursement`
(l'argent repart), soit une ligne `abandon_de_creance` (INFLUX garde ce qu'il a reçu et renonce au
reste), soit une note expliquant que la somme reste acquise. L'affaire ne peut pas entrer en
`cancelled` tant que le sort de chaque somme reçue n'est pas enregistré.

**RG80** — **Le sort de la commission en cas d'annulation, de non-livraison ou de litige n'est pas
tranché au MVP** (**D20**, reportée). Le pipeline enregistre **ce que les humains ont décidé au cas
par cas**, motif à l'appui ; il n'applique aucune politique automatique. Chaque cas est signalé au
fondateur, et l'accumulation de ces cas constituera la matière de D20.

**RG81** — **Le commercial responsable peut être réattribué**, avec auteur, date et motif, dans
`backoffice.ownership_assignments`. L'historique des responsables successifs est conservé : il sert à
l'intéressement et au suivi du portefeuille.

**RG82** — Les notes internes d'une affaire sont **immuables** : on ajoute, on ne corrige pas
(`04` §5.10).

**RG83** — Toute action d'écriture sur une affaire exige une session de backoffice valide avec second
facteur (`D37`, `03`). Les actions **abandon de créance**, **annulation d'affaire** et **export**
exigent en plus une re-authentification fraîche.

### H. Indicateurs

**RG84** — **Indicateur n° 1 : la commission encaissée**, par **devise**, par mois, par commercial.
C'est le revenu réel d'INFLUX. Il est calculé comme `Σ(paiements) − Σ(remboursements)` sur la **date
de réception**, jamais sur la date de signature.

**RG85** — **Indicateur du passage à l'échelle : affaires traitées par commercial et par semaine.**
Une affaire est « traitée » si elle a connu au moins un changement d'état ou une saisie de montant
dans la semaine. C'est l'indicateur que le fondateur regarde pour savoir si la plateforme fait
réellement passer le métier à l'échelle (`CLAUDE.md` §14.5).

**RG86** — **Taux de transformation** : mises en relation révélées → affaires `signed`, par
déclencheur d'origine (demande de contact, candidature, proposition INFLUX) et par commercial. C'est
lui qui dira lequel des trois déclencheurs produit du revenu.

**RG87** — **Délais** : révélation → signature (médiane et 9ᵉ cas sur 10), signature → facturation,
facturation → encaissement. Chacun est une soustraction de deux dates.

**RG88** — **Écart et recouvrement** : reste dû total par devise, taux de recouvrement
(`encaissée / convenue` exprimé **en montants**, jamais en pourcentage affiché — voir RG47 : on
affiche « 4 900,00 EUR encaissés sur 7 000,00 EUR convenus », pas « 70 % »), montant des abandons de
créance par motif, âge du plus ancien reste dû.

**RG89** — **Affaires perdues par contournement présumé** : nombre et montant estimé, par devise
(§J).

### I. Export

**RG90** — **Un seul export au MVP : la liste des affaires d'une période, par devise, au format CSV
(UTF-8, séparateur explicite, montants en unité principale avec deux positions décimales et colonne
devise).** Un fichier par devise, ou une colonne devise et **aucun total dans le fichier**.

> **Pourquoi pas un export comptable complet.** Un export « comptable » suppose des factures, un plan
> de comptes, un traitement de TVA et une société. Aucun de ces quatre éléments n'existe (**A1**,
> **D7**, **D23**, **D25**). Produire un fichier qui en aurait l'apparence serait pire qu'utile : il
> serait repris tel quel par un comptable et il est faux par construction. Ce dont l'expert-comptable
> aura besoin au premier jour, c'est de **la matière brute rattachable** : une ligne par affaire, une
> ligne par encaissement, et la référence de la mise en relation en regard.

**RG91** — **Contenu d'une ligne d'export** : référence `MER-…`, date de révélation, campagne,
marque, créateur, pays des deux parties au jour de la mise en relation, commercial responsable, état,
devise, montant du contrat, base fiscale du montant, commission convenue, base fiscale de la
commission, payeur, part annonceur et part créateur si saisies, date d'envoi et mode d'envoi du
contrat, date de signature, référence et date de facture, commission encaissée, reste dû, abandons,
motif de perte ou d'annulation, dates de création et de dernière modification.

**RG92** — **Un second export, celui des encaissements**, une ligne par règlement : référence
`MER-…`, date de réception, nature, montant, devise, payeur, mode de règlement, référence externe,
auteur de la saisie. C'est lui qui sert au rapprochement bancaire mensuel.

**RG93** — **L'export est réservé à l'administrateur**, journalisé nominativement (filtres employés,
nombre de lignes, devises, horodatage) et précédé d'une re-authentification.

> **Un export est la seule action qui fait sortir la donnée du système.** Il emporte des noms de
> personnes et des montants ; il mérite le même régime que les actions sensibles du backoffice, et il
> n'a aucune raison d'être accessible à chaque commercial.

**RG94** — **L'export ne contient aucun taux, aucun pourcentage et aucune colonne calculée à partir
d'un pourcentage.** Les seules colonnes dérivées sont des soustractions (reste dû) et des sommes
(commission encaissée).

### J. Contournement et manque à gagner

**RG95** — **Un contournement présumé se déclare comme une issue d'affaire**, avec le motif de perte
`conclu_hors_influx`, et il exige trois saisies humaines :

| Ce qui est saisi | Par qui | Pourquoi |
|---|---|---|
| **Montant estimé de la collaboration** + devise | Le commercial | C'est une **estimation humaine**, jamais un calcul |
| **Niveau de confiance** : `confirmé` · `probable` · `soupçon` | Le commercial | Un soupçon et un aveu ne pèsent pas la même chose dans un indicateur |
| **Source de l'information** : `declaration_partie` · `publication_observee` · `tiers` · `deduction` | Le commercial | Sans source, l'estimation n'est pas réexaminable |

**RG96** — **Le manque à gagner ne se calcule pas, il s'estime — et l'estimation porte sur le
montant de la collaboration, jamais sur la commission.** L'indicateur publié est : *« montant estimé
des collaborations conclues hors INFLUX, par devise, par niveau de confiance »*. Il n'existe aucun
indicateur « commission perdue », qui exigerait de multiplier par un taux.

> **C'est le piège le plus tentant du document.** Un tableau de bord qui affiche « 12 400,00 EUR de
> commission perdue » est spectaculaire, et il viole l'invariant en une ligne de code. Le fondateur
> qui veut cet ordre de grandeur l'obtient en appliquant le barème lui-même, sur le montant estimé,
> hors de l'application — exactement comme le commercial applique le barème hors de l'application
> pour négocier.

**RG97** — **Un contournement présumé n'est jamais une accusation automatique.** Le signalement
déclenche un **appel du commercial** (`01` §11), pas un message à la partie concernée, pas une
suspension, pas une mention dans l'interface du membre.

**RG98** — **La déclaration d'un contournement ne ferme pas la porte.** L'affaire reste consultable et
peut revenir à `negotiating` (RG18) si la collaboration se régularise.

**RG99** — **Aucune commission n'est réclamée pendant le pilote au titre d'un contournement**
(moratoire, **A5** et `01` §8.3). L'enregistrement sert à mesurer et à instruire, pas à réclamer.

**RG100** — Le croisement entre les contournements présumés et les signalements de coordonnées
(`contact_detections`, `01` M5) est laissé à la lecture humaine. **Aucun score de contournement n'est
calculé au MVP** (`01` M6).

### K. Réouverture d'une conversation close `affaire_signee`

*Cette section répond à la question **Q7** du document `12`, qui m'était explicitement renvoyée.*

**RG101** — **La réouverture d'un fil clos est autorisée**, réservée à un agent, avec motif et message
système visible des deux parties (position retenue par `12` Q7). Du point de vue financier, aucune
raison de l'interdire : le besoin le plus fréquent est précisément une **relance de règlement** ou un
**point de suivi d'exécution**, et les deux ont tout intérêt à se tenir dans le canal tracé plutôt
qu'en messagerie privée.

**RG102** — **Une réouverture ne crée aucune créance nouvelle et n'en éteint aucune.** Elle ne touche
ni `identity_revealed_at`, ni la référence `MER-…`, ni l'affaire existante, ni ses montants. La
créance éventuelle de la V2 reste attachée à **la révélation d'origine** (`01` §4.3) ; rouvrir un fil
n'est pas un nouvel acte d'intermédiation.

**RG103** — **Si la réouverture débouche sur une nouvelle collaboration, elle ne s'enregistre jamais
sur l'affaire existante.** Le commercial ouvre une **nouvelle mise en relation** (nouvelle campagne),
qui produit sa propre affaire et sa propre commission (RG3, RG4). Une affaire signée est close dans
ses montants : un second contrat glissé dedans rendrait impossible de dire à quel contrat se rapporte
un encaissement.

**RG104** — Un motif de réouverture `relance_commission` est ajouté à la liste des motifs du document
`12`, et son emploi est visible dans l'historique de l'affaire. C'est aussi une donnée utile : un
taux élevé de réouvertures pour relance dit que les conditions de règlement du barème sont trop
lâches.

---

## Exemple chiffré de référence

### Exemple A — le cas standard, payé en deux fois par deux payeurs

| Élément | Valeur | Qui la produit |
|---|---|---|
| Montant du contrat (coût total annonceur, commission comprise) | **2 000,00 EUR** | **Saisi** par le commercial |
| Base fiscale du montant | hors taxes | **Saisie** |
| Commission convenue | **700,00 EUR** | **Saisie** |
| dont part annonceur | 400,00 EUR | **Saisie** (facultative) |
| dont part créateur | 300,00 EUR | **Saisie** (facultative) |
| Note de commission | « barème standard » | **Saisie** |
| Net créateur indicatif | **1 300,00 EUR** | Affiché : 2 000,00 − 700,00 |
| Encaissement n° 1 — 12/10/2026, virement, payeur annonceur | 400,00 EUR | **Saisi** |
| Encaissement n° 2 — 03/11/2026, virement, payeur créateur | 300,00 EUR | **Saisi** |
| **Commission encaissée** | **700,00 EUR** | Somme : 400,00 + 300,00 |
| **Reste dû** | **0,00 EUR** | Soustraction : 700,00 − 700,00 |
| Vérification humaine | 400,00 + 300,00 + 1 300,00 = 2 000,00 ✅ | Faite par un humain, hors application |

L'application a enregistré 2 000,00 et 700,00, vérifié que `0 ≤ 700,00 ≤ 2 000,00`, additionné deux
encaissements et soustrait deux fois. **Elle n'a appliqué aucun taux.**

### Exemple B — le piège du « plus la commission »

Accord conclu au téléphone : « 2 000,00 EUR **nets** pour le créateur, plus 700,00 EUR pour INFLUX ».

| Élément | Valeur à saisir |
|---|---|
| Montant du contrat | **2 700,00 EUR** ← et non 2 000,00 |
| Commission convenue | 700,00 EUR |
| Net créateur indicatif | 2 000,00 EUR |

Saisir 2 000,00 fausserait le montant, l'assiette du futur barème et le taux de transformation en
valeur. Le libellé du champ et le récapitulatif (RG38) servent exactement à éviter cette erreur.

### Exemple C — dérogation

| Élément | Valeur |
|---|---|
| Montant du contrat | **5 000,00 USD** |
| Commission convenue | **900,00 USD** |
| Note de commission | « dérogation partenariat, accord du fondateur du 02/10 » |
| Net créateur indicatif | 4 100,00 USD |

L'application accepte sans commentaire : `0 ≤ 900,00 ≤ 5 000,00`. Elle ne dit pas que c'est « moins
que le barème », elle n'affiche pas « 18 % », elle ne prévient personne. La revue hebdomadaire du
pipeline s'en charge.

### Exemple D — encaissement partiel puis abandon de créance

| Élément | Valeur |
|---|---|
| Montant du contrat | 1 200,00 EUR |
| Commission convenue | 420,00 EUR |
| Encaissement — 15/11, virement | 200,00 EUR |
| Abandon de créance — 20/01, motif « client insolvable », décidé par l'administrateur | 220,00 EUR |
| **Commission encaissée** | **200,00 EUR** |
| **Reste dû** | **0,00 EUR** |
| **Abandon enregistré** | **220,00 EUR** |

La commission convenue reste 420,00 EUR. Le taux de recouvrement de la période dira « 200,00 EUR
encaissés sur 420,00 EUR convenus ». C'est laid, et c'est vrai.

### Exemple E — annulation après encaissement

| Élément | Valeur |
|---|---|
| Commission convenue | 700,00 EUR |
| Encaissement — 12/10 | 700,00 EUR |
| Campagne non livrée, accord de remboursement intégral | — |
| Remboursement — 28/10, nature `remboursement` | 700,00 EUR |
| **Commission encaissée** | **0,00 EUR** |
| État final | `cancelled`, motif `campagne_non_livree` |

Aucune ligne n'a été supprimée. Trois lignes racontent l'histoire complète : 700,00 reçus, 700,00
rendus, affaire annulée. C'est ce que l'expert-comptable voudra voir.

### Exemple F — contrepartie non monétaire

| Élément | Valeur |
|---|---|
| Montant du contrat | **0,00 EUR**, motif `contrepartie_non_monetaire` (produit offert, valeur ~150,00 EUR, en note) |
| Commission convenue | 0,00 EUR |
| État | `signed` |

L'affaire compte dans le taux de transformation, pas dans le revenu. C'est une information utile : un
pilote qui signe beaucoup de contreparties produit est un pilote qui ne gagne pas d'argent.

### Exemple G — totaux du mois, deux devises

> Commission encaissée en octobre 2026 : **1 100,00 EUR** · **900,00 USD**

Jamais « 2 000,00 ». Jamais de contre-valeur. Jamais de total général.

---

## Cas limites

| # | Cas | Comportement attendu |
|---|---|---|
| **1** | **Donnée absente** — affaire en `open`, aucun montant saisi | **C'est l'état normal des premiers jours**, pas une anomalie : l'affaire naît vide à la révélation. L'alerte « montant non saisi » part au responsable à 14 jours et à l'administrateur à 30 (RG8bis). Aucun montant n'est deviné, aucun état n'avance tout seul |
| **1bis** | **Révélation d'identité sans affaire** | **Ne peut plus exister** : la création est dans la transaction atomique de révélation (RG1). Si une seule écriture échoue, la révélation entière est annulée (CA2). Un contrôle de recette vérifie qu'aucune mise en relation révélée n'est dépourvue d'affaire |
| **2** | **Champ obligatoire manquant à la transition** — passage en `signed` sans base fiscale | La transition est refusée, le champ manquant est nommé à l'écran. La base refuse aussi, indépendamment du formulaire |
| **3** | **Montant négatif** | Refusé côté serveur **et** par la base. Message explicite ; aucune conversion automatique en zéro |
| **4** | **Montant nul** | Accepté **uniquement** avec le motif `contrepartie_non_monetaire` (RG29), qui force la commission à zéro |
| **5** | **Montant aberrant** — 2 000 000 000,00 EUR par erreur de frappe | Accepté par la contrainte, mais **confirmation renforcée** au-delà d'un seuil paramétrable par devise, et affichage en toutes lettres dans le récapitulatif. Aucune borne haute arbitraire : un contrat à 500 000,00 EUR est improbable, pas impossible |
| **6** | **Commission supérieure au montant** | Refusée. Aucun motif ne la rend acceptable (RG30) |
| **7** | **Décimales excédentaires** — 700,555 EUR | Refusé, pas arrondi (RG27). Une devise à deux décimales n'accepte pas trois positions |
| **8** | **Devise à zéro décimale** — 250 000 JPY | Saisie sans décimale, stockée `250000`, affichée « 250 000 JPY ». Test obligatoire (RG26) |
| **9** | **Changement de devise après signature** | Refusé par déclencheur (`04` §5.9). Une erreur de devise après signature se corrige en annulant l'affaire et en en créant une nouvelle mise en relation — jamais en réécrivant la devise sous les encaissements |
| **10** | **Doublon d'affaire** — tentative de créer une seconde affaire sur la même mise en relation | Refusé par l'unicité de `introduction_id` (RG3). L'écran renvoie vers l'affaire existante |
| **11** | **Doublon d'encaissement** — le même virement saisi deux fois | Non détectable automatiquement de façon fiable ; **avertissement** si une ligne de même montant, même date et même payeur existe déjà, avec confirmation explicite. Jamais un blocage : un acompte de 350,00 EUR versé deux fois le même jour existe |
| **12** | **Action concurrente** — deux agents modifient la même affaire | Écriture conditionnée à la version lue (`updated_at` en condition de mise à jour). Le second reçoit « l'affaire a été modifiée par <nom> il y a quelques secondes, rechargez », jamais un écrasement silencieux |
| **13** | **Transition concurrente** | Même mécanisme : la transition est conditionnelle à l'état d'origine, comme le verrou de la file (`04` §5.6). Deux passages simultanés en `signed` n'en produisent qu'un |
| **14** | **Droit insuffisant** — un agent non responsable tente une saisie | Refusé par la politique d'accès (RG39), pas seulement par le masquage du bouton. Tentative journalisée |
| **15** | **Droit insuffisant** — un membre tente d'accéder à une affaire | Aucun droit n'existe en base (`03` C(28)) : il n'y a rien à contourner. Aucune route d'API membre n'expose `billing` |
| **16** | **Service externe indisponible** — Brevo en panne au moment d'une relance interne | La relance est mise en file (`outbox_events`) et rejouée ; **l'affaire n'est jamais bloquée** par un e-mail. Un échec définitif devient une anomalie backoffice |
| **17** | **Base indisponible pendant la saisie** | Rien n'est enregistré partiellement : la saisie de montants, la transition et l'écriture d'historique sont dans **une seule transaction**. Tout ou rien |
| **18** | **Commercial qui abandonne en cours de saisie** | Aucun brouillon d'affaire : l'affaire existe déjà (RG1), les champs non saisis restent vides, l'état ne bouge pas. Rien d'incohérent ne subsiste |
| **19** | **Commercial qui quitte INFLUX** | Ses affaires sont réattribuées (RG81) ; son nom reste dans l'historique et dans les e-mails déjà envoyés. Aucune affaire orpheline de responsable |
| **20** | **Retour en arrière après validation** — affaire marquée `signed` par erreur | L'administrateur ramène à `negotiating` avec motif, **si et seulement si** aucun encaissement n'existe (RG19). Sinon, écriture inverse (RG79) |
| **21** | **Annulation après encaissement** | `cancelled` refusé tant que le sort de chaque somme reçue n'est pas enregistré (RG79) |
| **22** | **Partie qui supprime son compte pendant une affaire en cours** | L'affaire et ses montants sont **conservés** (obligation comptable, `04` §Conservation) ; l'identité est pseudonymisée selon l'arbitrage de `12` Q8. Le lien `MER-…` survit |
| **23** | **Mise en relation révélée, puis refus immédiat d'une partie** | L'affaire existe en `open` et se termine en `lost` avec motif. Elle compte dans le dénominateur de la transformation : c'est précisément ce qu'on veut mesurer |
| **24** | **Litige sur la commission elle-même** | `disputed_since` + note interne obligatoire ; relances gelées ; la créance reste au reste dû (RG20) ; le cas remonte au fondateur (matière de **D20**) |
| **25** | **Trop-perçu** — 750,00 EUR reçus pour 700,00 convenus | Accepté avec note obligatoire (RG57), anomalie visible jusqu'à régularisation par remboursement de 50,00 EUR |
| **26** | **Encaissement dans une devise différente de celle de l'affaire** | **Refusé.** Aucune conversion (RG25). Le cas se traite hors application, et la note explique |
| **27** | **Affaire signée avant la révélation d'identité** | Refusée par contrainte (RG15). Signal de relation préexistante : à consigner en note, c'est la matière de la clause de sauvegarde |
| **28** | **Commission encaissée alors que la société n'existe pas encore** | Techniquement enregistrable, **juridiquement à ne pas faire** : voir **Q1**, question bloquante |

---

## Critères d'acceptation

### Création et unicité

**CA1** — *Étant donné* une mise en relation dont les deux parties viennent d'accepter, *quand* la
révélation d'identité a lieu, *alors* une affaire est créée dans la même transaction, à l'état `open`,
rattachée à cette mise en relation, sans montant et avec le commercial responsable de la mise en
relation.

**CA2** — *Étant donné* une révélation d'identité dont l'une des écritures échoue, *quand* la
transaction est annulée, *alors* il n'existe ni conversation, ni affaire, ni événement de registre :
aucune affaire orpheline ne subsiste.

**CA3** — *Étant donné* une mise en relation qui porte déjà une affaire, *quand* une seconde création
est tentée par quelque moyen que ce soit, *alors* elle est refusée par l'unicité en base.

**CA4** — *Étant donné* un utilisateur quelconque, *quand* il tente de créer une affaire sans mise en
relation, *alors* aucune route, aucun écran et aucun droit ne le permet — **y compris un commercial**
(RG2 : il renseigne, il ne crée pas).

**CA4bis** — *Étant donné* la base après une période d'exploitation, *quand* on cherche une mise en
relation révélée dépourvue d'affaire, *alors* il n'en existe aucune. Ce contrôle fait partie de la
recette du Lot 4.

**CA4ter** — *Étant donné* une affaire en `open` sans aucun montant depuis 14 jours, *quand* la tâche
quotidienne s'exécute, *alors* une alerte « montant non saisi » part vers le commercial responsable ;
*et* à 30 jours, l'administrateur est alerté à son tour. Les deux délais sont lus en table, pas
écrits dans le code.

**CA5** — *Étant donné* une affaire créée par erreur, *quand* un agent tente de la supprimer, *alors*
la suppression est refusée et seule la clôture en `lost` avec motif `ouverture_erronee` est proposée.

### États et transitions

**CA6** — *Étant donné* une affaire en `open`, *quand* le responsable la passe en `negotiating` sans
saisir de montant et de devise, *alors* la transition est refusée et les champs manquants sont
nommés.

**CA7** — *Étant donné* une affaire en `negotiating`, *quand* le responsable la passe en `signed` sans
commission convenue, *alors* la transition est refusée (RG14).

**CA8** — *Étant donné* une affaire dont la date de signature saisie est antérieure à la date de
révélation, *quand* l'enregistrement est tenté, *alors* il est refusé par la base, indépendamment du
formulaire.

**CA9** — *Étant donné* une affaire en `open`, *quand* une transition directe vers
`commission_received` est demandée, *alors* elle est refusée : elle n'existe pas dans la table des
transitions.

**CA10** — *Étant donné* une affaire en `signed`, *quand* un encaissement est enregistré sans facture
préalable, *alors* l'affaire passe en `commission_received`, porte le signalement « facture
manquante » et apparaît dans la liste des anomalies jusqu'à la saisie de la référence de facture.

**CA11** — *Étant donné* une affaire en `signed` sans encaissement, *quand* l'administrateur la ramène
en `negotiating` avec un motif, *alors* la transition est acceptée et journalisée avec l'ancien état,
le nouvel état, l'auteur et le motif.

**CA12** — *Étant donné* une affaire en `signed` **avec** au moins un encaissement, *quand*
l'administrateur tente de la ramener en `negotiating`, *alors* la transition est refusée et l'écran
propose l'écriture inverse.

**CA13** — *Étant donné* une affaire `lost`, *quand* le responsable la reprend en `negotiating` avec
un motif, *alors* la transition est acceptée et le motif de perte précédent reste lisible dans
l'historique.

**CA14** — *Étant donné* une affaire `cancelled`, *quand* une transition quelconque est tentée,
*alors* elle est refusée : l'état est terminal.

**CA15** — *Étant donné* une affaire signée sans message ni changement d'état depuis 14 jours, *quand*
la tâche quotidienne s'exécute, *alors* l'affaire est marquée silencieuse **sans changer d'état** et
apparaît dans les alertes du responsable.

**CA16** — *Étant donné* une affaire signée marquée en litige, *quand* on consulte le reste dû total,
*alors* son montant y figure toujours, et ses relances automatiques sont gelées.

### Saisie et validations

**CA17** — *Étant donné* le champ de montant du contrat, *quand* un commercial l'ouvre, *alors* le
libellé indique « coût total pour l'annonceur, commission INFLUX comprise » et aucune valeur n'est
pré-remplie.

**CA18** — *Étant donné* un montant saisi et une devise, *quand* l'enregistrement a lieu, *alors* la
valeur stockée est un entier en plus petite unité monétaire, obtenu par une conversion utilisant
`minor_unit` lue en base.

**CA19** — *Étant donné* une affaire en EUR, *quand* le commercial saisit « 700,555 », *alors* la
saisie est refusée avec un message explicite, et aucune valeur arrondie n'est enregistrée.

**CA20** — *Étant donné* une affaire en JPY, *quand* le commercial saisit « 250000 », *alors* la
valeur est stockée `250000` et affichée « 250 000 JPY » sans décimale.

**CA21** — *Étant donné* un montant négatif, *quand* l'enregistrement est tenté, *alors* il est refusé
côté serveur **et** par la contrainte de base.

**CA22** — *Étant donné* un montant nul sans motif, *quand* l'enregistrement est tenté, *alors* il est
refusé ; *étant donné* le même montant nul avec le motif `contrepartie_non_monetaire`, *alors* il est
accepté et la commission convenue est forcée à zéro.

**CA23** — *Étant donné* un montant du contrat de 2 000,00 EUR, *quand* le commercial saisit une
commission de 2 500,00 EUR, *alors* l'enregistrement est refusé.

**CA24** — *Étant donné* un payeur `les_deux` avec une part annonceur de 400,00 EUR et une part
créateur de 300,00 EUR, *quand* la commission convenue saisie vaut 650,00 EUR, *alors*
l'enregistrement est refusé : la somme des parts saisies doit égaler la commission convenue.

**CA25** — *Étant donné* une affaire passant en `signed` avec une base fiscale « inconnue », *alors*
la transition est refusée : la base fiscale du montant et celle de la commission sont obligatoires à
la signature.

**CA26** — *Étant donné* une affaire en `signed` en EUR, *quand* un agent tente de changer la devise,
*alors* le changement est refusé par déclencheur.

**CA27** — *Étant donné* des montants saisis, *quand* le commercial valide, *alors* un récapitulatif
affiche montant du contrat, commission convenue, parts saisies, net créateur indicatif et base
fiscale, chacun avec sa devise, avant tout enregistrement.

**CA28** — *Étant donné* un agent qui n'est pas responsable de l'affaire, *quand* il tente une
écriture, *alors* elle est refusée par la politique d'accès et la tentative est journalisée.

**CA29** — *Étant donné* une requête d'API contenant un montant déjà converti ou un total pré-calculé,
*quand* le serveur la traite, *alors* il ignore la valeur fournie et recalcule à partir de la saisie
brute et de la devise.

### Ce que l'application refuse de faire

**CA30** — *Étant donné* n'importe quel écran du pipeline, *quand* on le parcourt, *alors* aucun
pourcentage n'y figure, ni saisi, ni dérivé, ni illustratif.

**CA31** — *Étant donné* le code de `apps/` et `packages/`, *quand* le contrôle d'intégration continue
T16 s'exécute, *alors* aucune multiplication d'un montant par une constante n'est trouvée, **à
l'exception unique** des fonctions de conversion d'unité monétaire, explicitement annotées et
couvertes par des tests.

**CA32** — *Étant donné* la table des taux, *quand* n'importe quel rôle applicatif tente d'y écrire,
*alors* l'écriture est refusée en base ; *et quand* on cherche une lecture de cette table dans le code
du MVP, *alors* il n'y en a aucune.

**CA33** — *Étant donné* une affaire complète, *quand* on inspecte les e-mails et notifications émis,
*alors* aucun ne contient de montant, de commission ni de taux à destination d'un membre.

### Encaissements, écart et relances

**CA34** — *Étant donné* une commission convenue de 700,00 EUR, *quand* deux encaissements de 400,00
et 300,00 EUR sont enregistrés, *alors* la commission encaissée affiche 700,00 EUR, le reste dû 0,00
EUR, et les deux lignes restent consultables séparément avec leur date et leur payeur.

**CA35** — *Étant donné* un encaissement déjà enregistré, *quand* un agent tente de le modifier ou de
le supprimer, *alors* l'opération est refusée et seule l'ajout d'une ligne inverse est proposé.

**CA36** — *Étant donné* une commission encaissée de 700,00 EUR, *quand* un remboursement de 700,00
EUR est enregistré, *alors* la commission encaissée retombe à 0,00 EUR et les trois lignes
(convenue, encaissée, remboursée) restent lisibles.

**CA37** — *Étant donné* un abandon de créance de 220,00 EUR, *quand* les indicateurs sont calculés,
*alors* la commission encaissée **n'inclut pas** l'abandon, le reste dû tombe à zéro, et l'abandon
apparaît dans son propre indicateur.

**CA38** — *Étant donné* une commission convenue de 700,00 EUR, *quand* un encaissement porterait le
cumul à 750,00 EUR, *alors* l'enregistrement exige une note de justification et crée une anomalie
visible.

**CA39** — *Étant donné* une affaire en EUR, *quand* un encaissement en USD est saisi, *alors* il est
refusé.

**CA40** — *Étant donné* une affaire `signed` depuis 7 jours sans facture enregistrée, *quand* la
tâche quotidienne s'exécute, *alors* une relance **interne** part vers le commercial responsable, et
aucun message ne part vers la marque ni vers le créateur.

**CA41** — *Étant donné* une affaire facturée depuis 30 jours sans encaissement, *alors* une relance
interne part ; *et* à 45 jours, l'administrateur est mis en copie.

**CA42** — *Étant donné* une affaire en litige, *quand* les délais de relance sont dépassés, *alors*
aucune relance automatique n'est émise.

**CA43** — *Étant donné* un commercial qui veut relancer par écrit sur un fil clos `affaire_signee`,
*quand* il tente d'écrire, *alors* l'écriture est refusée tant qu'un agent n'a pas rouvert le fil avec
un motif.

### Suivi, totaux et droits

**CA44** — *Étant donné* des affaires en EUR et en USD sur la période, *quand* on affiche la
commission encaissée du mois, *alors* deux totaux distincts s'affichent avec leur devise et aucun
total général n'existe.

**CA45** — *Étant donné* un filtre de période, *quand* il est appliqué, *alors* l'écran indique
explicitement s'il porte sur les dates de signature ou sur les dates d'encaissement.

**CA46** — *Étant donné* tout montant affiché dans le backoffice, *quand* on le lit, *alors* il porte
sa devise et une étiquette prise dans la liste fermée de RG66.

**CA47** — *Étant donné* un agent qui ouvre la fiche d'une affaire dont il n'est pas responsable,
*quand* la fiche s'affiche, *alors* une entrée nominative est écrite au registre ; *et quand* il
affiche simplement la liste, *alors* aucune entrée par affaire n'est écrite.

**CA48** — *Étant donné* un compte marque ou créateur, *quand* il interroge l'API par n'importe quel
chemin, *alors* aucune donnée d'affaire ne lui est accessible : ni montant, ni état, ni existence.

**CA49** — *Étant donné* deux agents qui modifient la même affaire en même temps, *quand* le second
enregistre, *alors* il reçoit un message nommant l'auteur de la modification précédente, et aucune
valeur n'est écrasée en silence.

### Corrections et audit

**CA50** — *Étant donné* un montant corrigé de 2 000,00 à 2 700,00 EUR, *quand* la correction est
enregistrée, *alors* une ligne d'historique conserve l'ancienne valeur, la nouvelle, l'auteur,
l'horodatage et le motif obligatoire.

**CA51** — *Étant donné* une correction tentée sans motif sur un champ financier, *quand*
l'enregistrement a lieu, *alors* il est refusé.

**CA52** — *Étant donné* une ligne d'historique, *quand* n'importe quel rôle tente de la modifier ou
de la supprimer, *alors* l'opération est refusée par la base, y compris pour l'administrateur.

**CA53** — *Étant donné* une affaire avec encaissements, *quand* l'administrateur la passe en
`cancelled` sans avoir traité les sommes reçues, *alors* la transition est refusée avec la liste des
sommes à traiter.

**CA54** — *Étant donné* une réattribution de commercial responsable, *quand* elle est enregistrée,
*alors* l'ancien responsable, le nouveau, l'auteur, la date et le motif sont conservés, et les
indicateurs par commercial reflètent la période de chacun.

### Indicateurs, export, contournement

**CA55** — *Étant donné* des encaissements sur deux mois, *quand* l'indicateur de commission encaissée
est calculé, *alors* chaque encaissement est compté sur sa **date de réception**, jamais sur la date
de signature.

**CA56** — *Étant donné* le tableau de bord, *quand* on cherche un indicateur de « commission
perdue », *alors* il n'en existe aucun ; le seul indicateur de contournement porte sur le **montant
estimé des collaborations**, par devise et par niveau de confiance.

**CA57** — *Étant donné* une affaire perdue pour `conclu_hors_influx`, *quand* elle est enregistrée,
*alors* le montant estimé, la devise, le niveau de confiance et la source sont obligatoires, et
aucune notification ne part vers les parties.

**CA58** — *Étant donné* un export demandé par un agent non administrateur, *alors* il est refusé ;
*étant donné* le même export demandé par l'administrateur, *alors* une re-authentification est exigée
et l'export est journalisé avec ses filtres et son nombre de lignes.

**CA59** — *Étant donné* un fichier d'export, *quand* on l'inspecte, *alors* chaque ligne porte la
référence `MER-…`, chaque montant porte sa devise, aucun pourcentage n'y figure et aucun total
inter-devises n'est présent.

**CA60** — *Étant donné* un fil clos `affaire_signee` rouvert par un agent, *quand* on inspecte
l'affaire, *alors* ni ses montants, ni sa date de révélation, ni sa référence n'ont changé, et la
réouverture apparaît dans l'historique avec son motif.

---

## Impacts

### Écrans (backoffice uniquement)

| Écran | Ce qu'il contient |
|---|---|
| **Liste du pipeline** | Une ligne par affaire (RG65), filtres (RG68), totaux par devise en pied de liste (RG67), tri par dernier mouvement par défaut |
| **Fiche d'une affaire** | Bandeau `MER-…` + parties + campagne + responsable ; bloc montants avec récapitulatif ; bloc encaissements (lignes) ; bloc états et transitions ; bloc anomalies ; historique complet ; lien vers la conversation |
| **Saisie de montants** | Champs libellés selon RG23, sélecteur de devise, bases fiscales, payeur et parts facultatives, note de commission, récapitulatif de confirmation (RG38) |
| **Saisie d'un encaissement** | Montant, devise (verrouillée), date, nature, payeur, mode de règlement, référence externe, note |
| **Tableau de bord commercial** | Ses affaires, sa commission encaissée par devise, ses relances, ses anomalies |
| **Tableau de bord administrateur** | Tout, plus ventilation par commercial et indicateurs §H |
| **Liste des anomalies** | Facture manquante, trop-perçu, encaissement en espèces, affaire silencieuse, **montant non saisi** (RG8bis), litiges |
| **Export** | Choix de la période, des devises et du type (affaires / encaissements), confirmation et re-authentification |

Tous ces écrans sont validés avec `expert-ux` sur un point non négociable : **aucun montant sans
devise ni étiquette** (`CLAUDE.md` §5.2 principe 4, adapté au backoffice).

### Données — écarts constatés avec `04-modele-de-donnees-mvp.md`

> Je ne modifie pas `04`. Les écarts ci-dessous sont signalés à `expert-database`, qui arbitre la
> forme exacte.

| # | Écart | Correction demandée | Gravité |
|---|---|---|---|
| **E1** | **Un seul encaissement possible** (`commission_received_amount_minor` + `commission_received_at`) | Créer **`billing.commission_receipts`** : `deal_id`, `kind` (`paiement` · `remboursement` · `abandon_de_creance`), `amount_minor > 0`, `currency` (= celle de l'affaire), `received_on`, `payer_side`, `payment_method`, `external_ref`, `note`, `recorded_by_account_id`, `recorded_at`. **Ajout seul.** Les colonnes actuelles deviennent des agrégats calculés à la lecture, ou disparaissent | **Bloquante** : sans elle, le second règlement écrase le premier |
| **E2** | **`commission_shortfall_note` porte un nom qui décrit l'inverse de ce que la contrainte contrôle** | Renommer (`commission_variance_note`) et documenter le cas réellement visé : le trop-perçu | Élevée : un nom trompeur sur une contrainte financière finit par être mal lu |
| **E3** | **`deal_field_changes.reason` facultatif** | Rendre le motif **obligatoire** pour les champs financiers (montant, devise, commission, parts, dates de signature et d'encaissement) | Élevée |
| **E4** | **`negotiated_amount_minor > 0` strict** | Passer à `>= 0` avec `check (montant > 0 or non_monetary_reason is not null)` | Moyenne : bloque un cas métier réel |
| **E5** | **Pas d'état `cancelled`** dans l'énumération | Ajouter `cancelled` + table `billing.cancellation_reasons`, distincte de `lost_reasons` | Élevée : sans lui, une annulation après encaissement se confond avec un échec commercial |
| **E6** | **`stalled` et `disputed` traités comme des états** dans `01` §6.1 | En faire des **attributs** (`stalled_since`, `disputed_since`, `disputed_note`, `disputed_resolved_at`) et les retirer de l'énumération d'états | Élevée : un litige ne doit pas effacer l'information « signé » |
| **E7** | **Bases fiscales absentes** | Ajouter `amount_tax_basis` et `commission_tax_basis` (`hors_taxes` · `taxes_comprises` · `inconnue`), obligatoires à `signed` | Élevée : irrécupérable après coup, et c'est la matière de **D7** / **D23** |
| **E8** | **Payeur de la commission absent** | Ajouter `commission_payer` + `advertiser_share_amount_minor` / `creator_share_amount_minor`, **saisis**, avec contrôle d'addition | Élevée : sans lui, un encaissement partiel est indéchiffrable et **D23** est ininstruisable |
| **E9** | **Mesure du contournement absente** | Ajouter `estimated_external_amount_minor`, `estimated_confidence`, `estimated_source` sur l'affaire, utilisés uniquement avec le motif `conclu_hors_influx` | Moyenne |
| **E10** | **Signalement « facture manquante » absent** | Dérivable (`state = commission_received and commission_invoice_ref is null`) : un index partiel suffit, pas une colonne | Faible |
| **E11** | **`04` ne précise pas l'exception de conversion d'unité monétaire** au contrôle T16 | Documenter l'exception unique (RG26) dans `03` §8 T16 et dans `packages/domain` | Moyenne : sans elle, soit le contrôle échoue, soit il est désactivé — et un contrôle désactivé ne protège rien |

Écart également signalé au document `03` : **RG39** (écriture réservée au responsable et à l'admin)
et **RG70** (journalisation de la fiche, pas de la liste) précisent la matrice §3.5.

**Lot de création** : `04` §2.2 range aujourd'hui `billing.deals` au **Lot 5**. Puisque l'affaire naît
dans la transaction de révélation, la table doit exister au **Lot 4** avec la mise en relation ;
seules la **saisie** des montants et les écrans du pipeline arrivent au Lot 5. **Ce n'est pas un
écart bloquant, c'est un simple déplacement de migration** déjà pris en compte par `expert-database`
(`billing.lost_reasons`, `billing.deal_state_transitions` et `billing.deals` au Lot 4 ;
`billing.commission_receipts` et `billing.deal_field_changes` au Lot 5, au plus tard avec la première
saisie).

**Création de l'affaire — point clos.** La question « le commercial crée-t-il l'affaire ou la
trouve-t-il déjà créée ? » est **tranchée par `chef-de-projet` le 2026-09-19** : création
automatique, une par mise en relation, à l'état `open`, dans la transaction atomique de révélation.
Trois documents la posaient déjà (`03` C(21), `13` RG74, `01` §6) ; ce document l'applique en RG1 et
en tire les conséquences en RG2, RG8bis et cas limite 1bis. **Ce n'est plus un écart.**

### Intégrations

| Intégration | Ce que ce document exige |
|---|---|
| **Brevo — transactionnel** | Uniquement des **e-mails internes** de relance vers les commerciaux et l'administrateur, bilingues, mis en file et rejoués. **Aucun e-mail à un membre au sujet d'un montant** |
| **Apollo.io** | Aucun impact. Aucun attribut d'affaire ne part vers Apollo |
| **Brevo — contacts** | Aucun attribut de montant, de commission ou d'état d'affaire n'est synchronisé vers un contact. Ce serait une fuite de donnée interne vers un outil marketing |
| **Supabase** | Table des transitions + déclencheur, contraintes déclaratives, historisation par déclencheur, ajout seul sur les encaissements et l'historique, index de relance (`04` §Index) |
| **Prestataire de paiement** | **Aucun.** Il n'existe pas au MVP (**D9** reportée) |

### Indicateurs à suivre

| Indicateur | Cible / seuil |
|---|---|
| **Commission encaissée, par devise et par mois** | **L'indicateur n° 1.** Aucune cible chiffrée au pilote : on mesure d'abord |
| **Affaires traitées par commercial et par semaine** | Le plafond de croissance (`CLAUDE.md` §14.5) |
| Taux de transformation révélée → signée, par déclencheur | Dit lequel des trois déclencheurs produit du revenu |
| Délai révélation → signature (médiane, 9ᵉ cas sur 10) | Longueur réelle du cycle commercial |
| Délai signature → encaissement | Conditions de règlement à revoir si elles dérivent |
| Reste dû total par devise et âge du plus ancien | Alerte au-delà de 90 jours |
| Montant des abandons de créance, par motif | Un abandon fréquent pour le même motif est un défaut de barème ou de process |
| Affaires signées sans facture à J+7 | **Doit tendre vers zéro** |
| **Affaires en `open` sans montant à 30 jours** | Signal de contournement **ou** de saisie négligée. On appelle le commercial, jamais une accusation automatique (`01` §11) |
| Encaissements en espèces | **Doit rester à zéro** tant que **Q2** n'est pas tranchée |
| Montant estimé des collaborations conclues hors INFLUX, par devise et par confiance | Mesure du contournement — **jamais** convertie en commission |
| Part des affaires en base fiscale « inconnue » | Doit être nulle sur les affaires signées |

---

## Hors périmètre

| Exclu | Pourquoi | Quand cela revient |
|---|---|---|
| **Tout calcul de commission, tout taux, tout arrondi** | **A1**, `CLAUDE.md` §3 et §6, `01` §7 | V2, à un seul endroit côté serveur, avec `commission_rates` remplie |
| Encaissement et reversement dans l'application | **A1** ; **D8** tranchée mais reportée | V2, avec **D9** et **D25** |
| Émission de factures, avoirs, mentions légales de facturation | **D23** non tranchée, société inexistante (**D25**) | Avant la première commission encaissée pour la **qualification**, en V2 pour l'**émission** |
| Traitement de la TVA / GST / sales tax | **D7** | Voir **Q3** : plus tôt que prévu |
| Export comptable complet, plan de comptes, écritures | Aucun des prérequis n'existe (RG90) | Quand l'expert-comptable est mandaté |
| Rapprochement bancaire automatique | Pas de compte bancaire connecté, pas de prestataire | V2 |
| Relance automatique des clients | **D23** non tranchée, `01` §8.2 (« jamais une menace ») | Quand la facture existe |
| Portefeuille cloisonné par commercial | Tous les internes voient tout au MVP (`13`) | Quand l'équipe le justifie |
| Intéressement et calcul de primes | Ce serait un calcul sur des montants — hors périmètre et hors sujet du MVP | Après le pilote, hors application |
| Score de contournement pondéré | **M6 allégé** (`01`) : aucune donnée pour régler des pondérations | Après le pilote |
| Prévisionnel, pondération d'un pipeline par probabilité | Un pipeline pondéré est une multiplication par un taux : **interdit** et sans intérêt à ce volume | V2, si le volume le justifie |
| Multi-devises sur une même affaire, conversion, couverture de change | **D27** reportée, RG25 | V2 |
| Affichage d'un quelconque montant à un membre | `03` C(28) | V2, et seulement pour ce qui le concerne |

---

## Questions ouvertes

| # | Question | Hypothèse retenue en attendant | Arbitre | Échéance |
|---|---|---|---|---|
| **Q1** | **Peut-on encaisser une commission avant que la société existe ?** Le pilote prévoit des encaissements à la confiance, mais **D25 n'est pas tranchée** : il n'y a ni société, ni compte bancaire professionnel, ni numéro de TVA, donc **aucune facture valide n'est émissible**. Encaisser au nom d'une personne physique crée un revenu à déclarer, un risque de requalification et une facture impossible à produire au client | **Ne rien encaisser tant que la société n'existe pas.** Le pipeline enregistre les affaires et les commissions **convenues** ; la ligne d'encaissement reste vide. C'est une contrainte d'exploitation, pas une contrainte logicielle | **Fondateur** + **expert-comptable** + avocat fiscaliste | **Bloquante, avant le premier encaissement du pilote** |
| **Q2** | **Encaissement en espèces** : autorisé, plafonné ou interdit ? Plusieurs pays visés plafonnent les paiements en espèces entre professionnels, et un commercial qui détient des fonds pour le compte d'INFLUX pose une question de contrôle interne | **Interdit pendant le pilote**, le mode `especes` restant saisissable pour enregistrer un fait déjà survenu, avec alerte | **Fondateur** + expert-comptable | Avant le Lot 5 |
| **Q3** | **D7 + D23 — base fiscale et structure de la facture.** Réactivées plus tôt que prévu (`01` §12) : dès le premier euro encaissé, INFLUX émet une vraie facture, avec un régime de taxe qui dépend du pays de la société (**D25**) et de celui du client, et une question non triviale — le créateur facture-t-il le montant total ou le montant hors part annonceur ? | Les deux bases fiscales sont **saisies** dès maintenant (RG33) pour que la question soit instruisable sur données réelles. Aucune règle fiscale dans le code | **Fondateur** + **expert-comptable** du pays de la société | **Avant la première commission encaissée** |
| **Q4** | **Devises actives au lancement.** **D27** est reportée, mais la liste affichée dans le sélecteur doit bien exister le jour du Lot 5 | **EUR et USD actives**, les autres devises des zones visées (GBP, CAD, CHF, BRL) chargées mais **inactives** ; l'activation est une mise à jour de ligne, pas un développement | **Fondateur** (rattaché à **D27**) | Avant le Lot 5 |
| **Q5** | **Seuil d'abandon de créance au-delà duquel l'accord écrit du fondateur est requis** (RG64) | **500,00 EUR ou équivalent**, valeur d'attente à calibrer après trois mois | **Fondateur** | Lot 5 |
| **Q6** | **Journalisation des lectures du pipeline** (RG70) : ouverture de fiche seulement, ou toute lecture y compris les listes ? Le second choix rend le journal illisible ; le premier laisse un angle mort sur la consultation de masse par liste | **Fiche et export journalisés, liste non journalisée**, avec un plafond de débit de consultation de fiches par agent et par jour | `expert-cybersecurite` (**veto**) + `expert-conformite-rgpd` | Lot 5 |
| **Q7** | **Restriction de l'écriture au commercial responsable** (RG39) : `03` §3.5 l'accorde aujourd'hui à tout agent. Restreindre protège de la modification croisée des montants, mais ajoute une friction quand quelqu'un est absent | **Restriction retenue**, avec réattribution journalisée comme échappatoire et administrateur en secours | `expert-cybersecurite` + `expert-database` + `chef-de-projet` | Avant le Lot 5 |
| **Q8** | **Renouvellement d'une collaboration sur la même campagne** : RG3 impose une affaire par mise en relation et RG4 exige une nouvelle mise en relation, mais `13` bloque un doublon d'introduction pour le même couple et la même campagne. Le cas « ils refont la même campagne six mois plus tard » n'a pas de chemin | **Ouvrir une nouvelle mise en relation** est le besoin financier ; le mécanisme (levée du doublon quand l'affaire précédente est terminale, lien vers la `MER-…` précédente) relève du document `13` | `chef-de-projet` + `expert-matching` + `product-owner` | Avant le Lot 4 |
| **Q9** | **D20 — sort de chaque part en cas d'annulation, de litige ou de non-livraison.** Reportée, alors que le premier litige surviendra pendant le pilote | Traitement **au cas par cas**, enregistré avec motif (RG80) ; l'accumulation de ces cas constitue la matière de D20 | **Fondateur** + `expert-conformite-rgpd` | Après les dix premières affaires signées |
| **Q10** | **Conservation.** 10 ans est retenu pour les affaires (`04`), mais la durée exacte dépend du pays de la société et du droit comptable applicable | **10 ans**, valeur conservatrice, aucune suppression physique | **Expert-comptable** + `expert-conformite-rgpd` (**veto**) | Après **D25** |
| **Q11** | **Montant estimé d'un contournement** (RG95) : faut-il le conserver au-delà de la fenêtre de non-contournement (**D29**) ? C'est une donnée personnelle indirecte et une imputation non prouvée | Conservation le temps de la fenêtre **D29** puis agrégation anonyme | `expert-conformite-rgpd` (**veto**) + **Fondateur** | Lot 5 |
| **Q12** | **Réouverture d'un fil clos `affaire_signee`** (`12` **Q7**) — **réponse donnée en §K** : autoriser, sans effet sur la créance. Reste à confirmer que le message système de réouverture ne contient **aucun montant** et n'évoque pas la commission devant les deux parties | Message neutre : « Cette conversation a été rouverte par INFLUX pour un point de suivi » | `product-owner` + `expert-ux` | Lot 4 |
| **Q13** | **Délais de l'alerte « montant non saisi »** (RG8bis) : au bout de combien de jours une affaire en `open` sans montant devient-elle une anomalie ? Trop court, l'alerte devient du bruit sur des négociations normales ; trop long, un contournement passe inaperçu | **14 jours** vers le responsable, **30 jours** vers l'administrateur, **en table** et recalibrés après un mois de mesure | `chef-de-projet` + **Fondateur** | Lot 5, à instrumenter dès le Lot 4 |

---

## Ce qui change en V2

Rien de ce qui est spécifié ici n'est à jeter :

- `commission_rates` se remplit, le calcul apparaît **à un seul endroit côté serveur**, et les deux
  taux sont figés et historisés à la signature (`contract-commission`).
- Les **bases fiscales**, le **payeur** et les **parts saisies** du pilote deviennent la matière de
  **D7** et **D23** — instruits sur des données réelles, pas sur des hypothèses.
- Les **encaissements** deviennent des mouvements du prestataire de paiement ; la table des
  règlements reste, avec une référence externe au lieu d'une saisie manuelle.
- **D19** (arrondi) s'ouvre enfin, et elle s'ouvre proprement : il n'y aura aucune règle d'arrondi
  héritée à défaire, puisqu'il n'y en a jamais eu.
- L'historique des montants du pilote est déjà complet le jour où il devient une pièce comptable.

---

**Ce document ne modifie aucun autre fichier.** Les corrections du modèle de données relèvent
d'`expert-database`, celles de la matrice des droits d'`expert-cybersecurite`, la mise à jour de
`CLAUDE.md` de `chef-de-projet`. Le taux de 35 % et sa répartition 20 % / 15 % relèvent du
**fondateur seul** et ne sont pas discutés ici. **Aucune règle fiscale ni comptable de ce document
n'est valide tant qu'un expert-comptable du pays de la société ne l'a pas confirmée.**
