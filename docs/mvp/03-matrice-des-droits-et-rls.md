# Matrice des droits, RLS et contrôles d'accès du MVP

> **Date :** 2026-09-18 · **Révision du 2026-09-19** : la condition **C(21)** a été **entièrement
> réécrite** après la spécification `docs/mvp/13-file-de-validation-et-mise-en-relation.md` (§F, §I
> et sa question **Q5**). Sa première rédaction exigeait que la fonction de révélation vérifie que
> son appelant est **un agent avec `aal2`**, alors que le déclencheur réel est **la seconde
> acceptation d'un membre** : la condition était inexécutable, et elle réutilisait le nom
> `open_introduction()` déjà pris par la fonction de **création** de `04` §5.6. C(21) définit
> désormais **quatre contrats distincts** — C(21a) création, C(21b) décision du commercial,
> C(21c) acceptation d'un membre, C(21d) révélation interne — et le test **T18** les vérifie.
> `docs/mvp/04-modele-de-donnees-mvp.md` §5.6 a été corrigé dans le même mouvement, pour que le
> contrat de sécurité reste **un et un seul** dans les deux documents.
> **Révision du 2026-09-24 — les apartés (D47).** Alignement sur `12` §K et `04` §5.7.1, rédigé à la
> demande du fondateur (question A4 de `04` §5.7.1) : §3.4 (lecture de l'aparté de l'autre partie,
> conditions C(23) à C(25), **nouvelle condition C(27)** sur les signalements visant un agent), §5.2
> (`read_conversation()` à **canal obligatoire**, une ligne de journal par canal), §8 (T5 étendu,
> **nouveau test T19**). **Le cloisonnement par règle d'accès à canal constant, doublée d'une
> contrainte en base, est un arbitrage explicite du fondateur** (`04` §5.7.1 A1, 2026-09-24), rendu
> dans un domaine sous veto de `expert-cybersecurite` (`CLAUDE.md` §7 règle 2). **Restent soumises
> à l'avis de `expert-cybersecurite`** : les deux fonctions `SECURITY DEFINER` ajoutées par les
> apartés (`04` §5.7.1 A2) et la relecture de cette révision.
> **Auteurs :** `expert-cybersecurite` (rédacteur, **veto bloquant**) + `architecte` (co-signataire
> pour les points d'architecture)
> **Statut :** **avis de sécurité rendu — favorable sous conditions.** Les conditions marquées
> **BLOQUANT** doivent être en place pour que le Lot 0 puisse être déclaré livré. Aucune n'est un
> refus de principe : toutes se règlent au Lot 0, pour un coût unitaire inférieur à une journée.
> **Skills appliquées :** `security-rgpd-audit`, `supabase-schema`, `backoffice-ops`, `messaging-spec`,
> `env-secrets`.
>
> **Ce que ce document tranche :** les cinq rôles et leur séparation, la matrice des droits objet par
> objet et action par action, les principes de Row Level Security et leur mise en œuvre, le
> traitement de la lecture de conversation par un agent non participant, l'isolement du backoffice,
> les tests de sécurité exigibles en intégration continue, et la réponse aux neuf points soumis à
> mon avis au §14.1 de `docs/mvp/02-architecture-3-espaces.md`.
>
> **Ce qu'il ne tranche pas :** le modèle de données détaillé, les types, les index et les migrations
> (`expert-database`, document `04`) ; la légalité des traitements, les durées de conservation et
> l'information des personnes (`expert-conformite-rgpd`, documents `19` et `docs/legal/`) ; le plan
> de test lui-même (`testeur`, document `18`) ; la configuration Railway et Supabase concrète
> (`integrateur`).
>
> **À lire avec :** `docs/mvp/02-architecture-3-espaces.md` (décisions D2, D5, D12, D18, D37),
> `docs/mvp/01-intermediation-courtee.md` (document pivot : registre chaîné, révélation d'identité,
> pipeline commercial), `docs/mvp/00-cadrage-mvp-v2.md` (périmètre, arbitrages A1 à A10).
>
> **Source de vérité :** `CLAUDE.md`. En cas d'écart, `CLAUDE.md` prime et c'est ce document qui est
> corrigé.

---

## 0. Ce qu'il faut retenir si l'on ne lit qu'une page

**Trois phrases pour le fondateur.**

1. L'architecture proposée par `architecte` est **bonne** : la règle « le front ne parle jamais à
   Supabase » et la séparation du backoffice sont les deux meilleures décisions du dossier, et je les
   valide sans réserve.
2. Elle contient cependant **une faille de raisonnement précise** : elle s'appuie sur « l'annonceur
   n'a aucun droit sur les données identifiantes », or, en configuration Supabase standard,
   **annonceur, créateur et commercial sont le même utilisateur de base de données**. La protection
   ne repose donc aujourd'hui que sur un seul contrôle, alors que le document en annonce deux. C'est
   réparable en une journée au Lot 0, et c'est le point n° 1 de ma liste bloquante.
3. **Je valide l'authentification sans mot de passe pour les membres**, parce qu'au MVP un compte
   membre ne contient **aucun moyen de paiement** — il contient des données personnelles et des
   conversations commerciales. Cette validation **tombe automatiquement** le jour où la V2 introduit
   des coordonnées bancaires : un second facteur deviendra alors obligatoire côté membres. C'est
   écrit ici pour que personne ne l'oublie dans dix-huit mois.

**Le risque le plus sous-estimé du projet**, tel que je le vois : ce n'est ni le vol de mot de passe,
ni l'injection SQL. C'est **la fuite silencieuse de l'anonymisation** — une colonne ajoutée dans la
précipitation au Lot 5, un visuel de portfolio non modéré, un nom de fichier bavard, une donnée EXIF
dans une capture d'écran. Aucun de ces incidents ne déclenche d'alerte, aucun ne fait rougir un test
qui n'a pas été écrit pour ça, et chacun suffit à vider la décision produit A2 de sa substance. Tout
le §8 (tests) existe pour cette raison.

---

## 1. Les cinq rôles

### 1.1 Définition

| Rôle | Qui | Où il se connecte | Ce qu'il voit, en une phrase |
|---|---|---|---|
| **`advertiser`** | Une marque, un e-commerçant, une PME | `apps/web` | Son compte, ses campagnes, ses demandes, **des profils créateurs anonymisés**, et les identités des seuls créateurs avec qui une mise en relation est ouverte |
| **`creator`** | Un créateur de contenu majeur | `apps/web` | Son compte, son profil dans ses deux couches, les campagnes publiées, ses candidatures, et les marques avec qui une mise en relation est ouverte |
| **`agent`** | Un commercial INFLUX | `apps/backoffice` | **Toutes les identités, toutes les conversations, toutes les affaires.** Il décide des mises en relation et conduit les négociations |
| **`admin`** | Un administrateur INFLUX | `apps/backoffice` | Tout ce que voit un `agent`, **plus** la gestion des comptes agents, des rôles, des plafonds, des suspensions et des demandes RGPD |
| **`service`** | Aucun humain — le worker et une liste fermée d'opérations techniques | Aucune interface | Ce que ses `GRANT` explicites lui donnent, et rien de plus (voir §4, principe P7) |

**`service` n'est pas un rôle d'humain et ne doit jamais être empruntable par un humain.** Aucun
compte de connexion, aucun accès au backoffice, aucune session. C'est un rôle de processus.

### 1.2 Pourquoi `agent` et `admin` restent distincts dès le Lot 0

La question est légitime : au démarrage, **une seule personne occupera les deux rôles**. Séparer
deux rôles tenus par la même personne ressemble à de la procédure pour la procédure. Ce n'est pas le
cas, pour cinq raisons dont chacune suffirait.

1. **Rétro-adapter une séparation de rôles coûte cher et se fait mal.** Il faut reprendre les
   politiques RLS, les tests, les écrans, et surtout **requalifier l'historique** : six mois d'actions
   journalisées sous un rôle unique ne se scindent pas après coup. On ne saura jamais dire si telle
   suppression de compte relevait d'un geste commercial ou d'un geste d'administration.
2. **Les plafonds d'envoi d'e-mails sont définis par rôle** (A4, D35). Sans deux rôles, il n'y a
   qu'un plafond, donc pas de plafond du tout : celui qui peut le modifier est celui qu'il contraint.
3. **L'escalade de privilège devient invisible.** Avec un rôle unique, « se donner des droits » n'est
   plus une action détectable : il n'y a rien à se donner. Avec deux rôles, l'attribution du rôle
   `admin` est un événement, journalisé, alerté, revu.
4. **La double validation des actions irréversibles n'a de sens qu'entre deux rôles distincts**
   (skill `backoffice-ops`, règles 13 à 16). Voir §1.3.
5. **Le jour où un deuxième commercial arrive — et c'est l'objectif même du projet** (`00-cadrage`
   §5, indicateur n° 4) —, la bascule doit être **un changement de configuration**, pas un chantier.

### 1.3 Ce que cela implique quand la « double validation administrateur » n'a personne pour la faire

La skill `backoffice-ops` (règles 13 à 16) pose la règle cible : une action irréversible est
**demandée par un agent et approuvée par un administrateur distinct**. Tant qu'une seule personne
cumule les deux rôles, **cette règle est inapplicable**, et il faut le dire franchement plutôt que de
mettre en scène une approbation de soi-même.

> **Un contrôle décoratif est pire qu'une absence de contrôle, parce qu'il rassure à tort.**

**Procédure dégradée, applicable tant qu'une seule personne cumule `agent` et `admin` :**

| # | Exigence | Détail |
|---|---|---|
| **PD1** | **Récapitulatif intégral** | Portée exacte, nombre d'éléments concernés, conséquences, réversibilité annoncée **avant** le premier geste |
| **PD2** | **Confirmation différée** | La confirmation a lieu **dans un second temps**, sur un écran distinct, atteignable par une action séparée — jamais dans le même enchaînement de clics. Délai minimal technique : **60 secondes** entre la demande et la confirmation possible. Ce n'est pas une friction gratuite : c'est le seul mécanisme qui protège contre le geste réflexe |
| **PD3** | **Re-authentification** | La confirmation exige une **saisie de second facteur fraîche** (TOTP, fenêtre de validité 5 minutes). Elle protège contre le poste laissé déverrouillé, qui est le scénario réaliste d'un backoffice utilisé huit heures par jour |
| **PD4** | **Traçage nominatif à deux horodatages** | `requested_by`, `requested_at`, `confirmed_by`, `confirmed_at`, motif typé, motif libre facultatif. Les deux horodatages sont conservés même s'ils portent le même nom |
| **PD5** | **Marquage explicite** | La ligne de journal porte `dual_control: 'degraded_single_operator'`. Une revue ultérieure doit pouvoir isoler en une requête toutes les actions passées sans contrôle par les pairs |
| **PD6** | **Revue hebdomadaire** | La liste des actions confirmées en mode dégradé est présentée au tableau de bord du backoffice, semaine par semaine. Non lue, elle ne sert à rien ; c'est une discipline d'équipe, pas un contrôle technique |
| **PD7** | **Bascule automatique** | Dès qu'un second compte `admin` existe et est actif, la règle cible s'applique **sans changement de code** : le mode dégradé est une branche conditionnée par « nombre d'admins actifs distincts du demandeur ≥ 1 » |

**Ce que cette procédure protège, et ce qu'elle ne protège pas — à dire au fondateur sans
enjolivure :** elle protège contre **l'erreur, la précipitation et le poste non verrouillé**. Elle ne
protège **ni contre la malveillance, ni contre l'abus de droit** d'une personne qui détient les deux
rôles. Pendant toute la durée où une seule personne opère, INFLUX repose sur la confiance accordée à
cette personne. C'est un risque **accepté et documenté**, pas un risque couvert.

**Recommandation complémentaire (Important, coût : 1 heure).** Même pour une seule personne physique,
créer **deux comptes distincts** : un compte `agent` pour le travail quotidien, un compte `admin`
utilisé uniquement pour les gestes d'administration, avec son propre second facteur. Le bénéfice est
réel et immédiat : le journal devient lisible, le compte quotidien — celui qui est ouvert huit heures
par jour — ne porte plus les droits les plus lourds, et la bascule du §PD7 devient automatique. Si le
fondateur juge cette double connexion trop contraignante, l'alternative acceptable est **une étape
d'élévation explicite** (re-authentification TOTP + motif typé + journalisation) avant toute action
réservée à `admin`, au sein d'un compte unique. Les deux sont acceptables ; l'absence des deux ne
l'est pas.

---

## 2. Conventions de lecture de la matrice

| Symbole | Signification |
|---|---|
| **—** | **Aucun droit.** Refus par défaut : ni `GRANT`, ni politique. Il n'y a rien à contourner |
| **S** | Ses propres lignes uniquement (le compte, le profil, la campagne dont il est propriétaire) |
| **✔** | Autorisé |
| **L** | Lecture seule |
| **C(n)** | **Conditionnel.** La condition `n` est explicitée sous le tableau et **doit être exprimée en politique SQL**, pas en `if` applicatif |
| **J** | **Journalisé nominativement** dans le registre d'audit : qui, quand, quoi, depuis quel écran. S'ajoute au droit (`L·J` = lecture journalisée) |
| **2V** | **Double validation** administrateur, ou procédure dégradée du §1.3 si une seule personne opère |
| **R** | **Re-authentification** (second facteur frais) exigée avant exécution |
| **⛔** | **Interdit à tout le monde, y compris `admin` et `service`.** Le droit n'existe pas en base |

**Règle de lecture n° 1.** Une case vide n'existe pas. Un objet non listé ici est un objet dont les
droits ne sont pas décidés : il ne doit pas être créé. La CI le vérifie (§8, test T2).

**Règle de lecture n° 2.** Cette matrice décrit ce qui est **possible**, pas ce qui est **affiché**.
Le masquage d'interface n'est jamais un contrôle d'accès (`CLAUDE.md` §6, skill `backoffice-ops`
règle 26). Un droit absent de cette matrice doit échouer **en base**, même si l'API l'autorisait par
erreur.

---

## 3. La matrice des droits

### 3.1 Domaine `identity` — comptes, rôles, CGU, sessions

| Objet · Action | `advertiser` | `creator` | `agent` | `admin` | `service` |
|---|---|---|---|---|---|
| Compte — créer (auto-inscription) | ✔ | ✔ | ⛔ | ⛔ | ✔ C(1) |
| Compte — lire ses propres données | S | S | S | S | — |
| Compte — modifier ses propres données | S | S | S | S | — |
| Compte — **changer son adresse e-mail** | S · R · C(2) | S · R · C(2) | S · R · C(2) | S · R · C(2) | — |
| Compte agent/admin — créer par invitation | — | — | — | ✔ · J · R | — |
| Compte — lister et consulter (tous) | — | — | L · J | L · J | — |
| Compte — **attribuer ou retirer un rôle** | — | — | — | ✔ · J · 2V · R · C(3) | — |
| Compte — **modifier un plafond** (e-mails, candidatures) | — | — | — | ✔ · J · 2V · C(3) | — |
| Compte — suspendre | — | — | ✔ · J · 2V · C(3) | ✔ · J · 2V · C(3) | — |
| Compte — lever une suspension | — | — | — | ✔ · J · R · C(3) | — |
| Compte — supprimer / anonymiser | S · R · J (libre-service, D72) | S · R · J (libre-service, D72) | — | ✔ · J · 2V · R | ✔ C(4) |
| `terms_versions` — lire la version en vigueur | L | L | L | L | L |
| `terms_versions` — publier une version | — | — | — | ✔ · J · 2V | — |
| `terms_acceptances` — écrire | ✔ C(5) | ✔ C(5) | — | — | ✔ C(1) |
| `terms_acceptances` — lire | S | S | L · J | L · J | L |
| `terms_acceptances` — modifier ou supprimer | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Sessions — lister les siennes, en révoquer une | S | S | S | S | — |
| Sessions — révoquer celles d'un tiers | — | — | — | ✔ · J | ✔ C(4) |
| Codes à usage unique (`auth_codes`) | ⛔ | ⛔ | ⛔ | ⛔ | ✔ C(6) |

**Conditions**

- **C(1)** — Création du compte à la validation de l'écran 3, après une vérification de code
  réussie (`05` RG5) : le compte n'existe pas encore, aucun rôle utilisateur ne peut donc l'écrire.
  Opération élevée E-2, motif `identity.complete_signup`, par la fonction
  `identity.provision_account` (§4, P7 ; *révisé le 2026-09-27, EC-5 : remplace
  « `identity.provision` à la première vérification »*).
- **C(2)** — Le changement d'adresse exige **une confirmation depuis l'ancienne adresse et depuis la
  nouvelle**. Sans cela, une boîte compromise pendant dix minutes permet de s'approprier le compte
  définitivement. Point critique en l'absence de mot de passe (§6.1).
- **C(3)** — **Aucun agent ni administrateur ne peut agir sur son propre compte** : attribution de
  rôle, plafond, suspension, levée de suspension. Exprimé en politique :
  `WITH CHECK (target_account_id <> influx.current_account_id())`.
- **C(4)** — Propagation d'une suppression validée (par un `admin` en `2V`, ou par le membre
  lui-même pour son propre effacement, D72) : révocation des sessions, purge dans les
  destinations externes. Opération de worker, jamais déclenchée par une route HTTP.
- **C(5)** — Une acceptation de CGU est **écrite une fois, jamais modifiée**. La table est en ajout
  seul (§4, P8), au même titre que le registre d'audit : une preuve d'acceptation réécrite ne prouve
  rien (`01-intermediation-courtee.md` §9).
- **C(6)** — Aucun rôle utilisateur n'a le moindre droit sur la table des codes. Émission et
  vérification passent par des opérations élevées nommées, exécutées avant toute authentification.

> **Précision du 2026-09-27 (`21` EC-17, EC-29, EC-39, EC-40).** Les sessions sont **créées** par
> `influx_auth` (E-2), jamais par un rôle métier. Le titulaire les **renouvelle** et les **révoque**
> par deux fonctions `SECURITY DEFINER` (`identity.touch_session`, `identity.revoke_own_session`,
> motifs `logout` et `revoked_by_holder` seulement) qui calculent les dates en base ; aucun rôle
> métier n'a de droit `UPDATE` ni `DELETE` sur la table, et une ligne révoquée n'est plus modifiable
> (déclencheur). La fraîcheur du second facteur (`mfa_verified_at`), les codes de secours et
> l'empreinte anti-rejeu du TOTP ne sont écrits que par `influx_auth` : **aucun droit, ni en lecture
> ni en écriture, pour les quatre rôles métier**.

### 3.2 Domaine `profiles` — profils marque, profils créateur, pièces de vérification, badge

| Objet · Action | `advertiser` | `creator` | `agent` | `admin` | `service` |
|---|---|---|---|---|---|
| Profil marque — créer / modifier | S | — | ✔ · J C(7) | ✔ · J C(7) | — |
| Profil marque — lire (identité de l'entreprise) | L | L C(8) | L · J | L · J | L |
| Profil marque — **lire les coordonnées directes** | S | — C(9) | L · J | L · J | L |
| **Profil créateur anonymisé** (`creator_public_profiles`) — lire | **L C(10)** *(au Lot 3 ; aucun droit annonceur au Lot 2, EC-L2D-1)* | S | L · J | L · J | L |
| Profil créateur anonymisé — modifier | — | S | ✔ · J C(7) | ✔ · J C(7) | — |
| **Profil créateur identifié** (`creator_identities`) — lire | **C(11) · J** | S | L · J | L · J | L |
| Profil créateur identifié — modifier | — | S | ✔ · J C(7) | ✔ · J C(7) | — |
| **Pièces de vérification** — déposer | — | S C(12) | — | — | — |
| **Pièces de vérification — lire** | **⛔ C(13)** | S | L · J C(14) | L · J C(14) | L C(14) |
| Pièces de vérification — supprimer | — | S (logique) | — | ✔ · J · 2V | ✔ C(4) |
| Badge — demander | — | S | — | — | — |
| Badge — attribuer / renouveler | — | — | ✔ · J | ✔ · J | — |
| Badge — retirer | — | — | ✔ · J · 2V | ✔ · J · 2V | ✔ C(15) |
| Badge et sa date — lire | L | L | L | L | L |
| Visuels de portfolio — déposer | — | S | — | — | — |
| Visuels de portfolio — **modérer avant publication** | — | — | ✔ · J | ✔ · J | — |
| Visuels de portfolio — lire | L C(16) | S | L · J | L · J | L |

**Conditions**

- **C(7)** — Un agent peut corriger un profil (faute, champ mal saisi, retrait d'une coordonnée
  laissée en clair), mais **toute modification par un agent est journalisée avec l'ancienne et la
  nouvelle valeur**, et le membre en est informé. Un agent qui modifie un profil sans trace est
  indistinguable d'une falsification.
- **C(8)** — Le créateur ne voit l'identité de la marque que dans le cadre d'une campagne publiée ou
  d'une mise en relation ouverte. Pas d'annuaire des marques : le contournement est symétrique.
- **C(9)** — **D40 (masquage symétrique) est tranchée (2026-09-18) et précisée par D46
  (2026-09-24) : les coordonnées directes d'une marque — e-mail, téléphone, page de contact — ne
  sont visibles d'aucun membre, ni avant ni après la révélation.** Seul le **prénom** de
  l'interlocuteur est servi au créateur après révélation, par le même mécanisme que l'anonymisation
  créateur — deux objets, pas un filtre (§4, P5). *(La valeur d'attente conservatrice d'origine est
  donc devenue la règle, à l'exception du prénom.)*
- **C(10)** — Lecture soumise aux garde-fous de **forme de requête** appliqués par `apps/api` :
  k-anonymat à 5, pagination plafonnée, tri explicable, export interdit, recherches journalisées.
  Aucune de ces règles n'est exprimable en RLS (§4, P9).
- **C(11) — LIGNE EXPLICITE N° 1.** **Un annonceur ne lit le profil identifié d'un créateur que s'il
  existe une mise en relation entre eux dont `identity_revealed_at` est non nul.** La condition est
  une politique SQL, jamais un `if` applicatif, et elle est doublée d'un schéma de réponse et d'un
  test (§4, P5 ; §8, T1). Formulation de référence :

```sql
create policy creator_identity_read_after_reveal
  on profiles.creator_identities
  for select
  to influx_advertiser
  using (
    exists (
      select 1
        from matching.introductions i
       where i.creator_id    = creator_identities.creator_id
         and i.advertiser_id = influx.current_advertiser()
         and i.identity_revealed_at is not null
    )
  );
```

- **C(12)** — Dépôt via URL signée de courte durée émise par `apps/api` après contrôle du rôle, du
  propriétaire, de la taille et du type (exception E1, §6.6).
- **C(13) — LIGNE EXPLICITE N° 2 (rappel).** **Aucun annonceur n'accède à une pièce de vérification,
  dans aucun cas, y compris après révélation d'identité, y compris sur une mise en relation ouverte,
  y compris si le créateur y consent.** Ces pièces sont des captures d'écran de tableaux de bord de
  réseaux sociaux : elles contiennent des données personnelles **de tiers** (noms d'abonnés,
  commentaires, messages privés en arrière-plan). Elles ne sortent jamais du périmètre INFLUX. Cette
  interdiction est mise en œuvre par **absence de droit**, absence de route, et absence du champ dans
  tout schéma de réponse accessible au rôle annonceur.
- **C(14)** — La lecture d'une pièce de vérification est journalisée **et ne passe jamais par une URL
  signée remise au navigateur**. Elle transite par `apps/api`, qui journalise chaque consultation
  (§6.6 et §7). Une URL signée qui fuite d'un journal, d'un historique de navigateur ou d'un
  `Referer` est une pièce d'identité qui circule.
- **C(15)** — Retrait automatique à la péremption de 90 jours (D34), exécuté par le worker, journalisé
  comme un événement système et non comme une décision d'agent.
- **C(16)** — Uniquement les visuels **modérés et publiés**. La modération du portfolio est le point
  de fuite d'anonymisation le plus probable de tout le produit (`00-cadrage` §10.2) : une capture de
  story avec le `@` en haut à gauche annule A2 pour ce créateur.

### 3.3 Domaine `campaigns` et `search`

| Objet · Action | `advertiser` | `creator` | `agent` | `admin` | `service` |
|---|---|---|---|---|---|
| Campagne — créer / modifier | S | — | ✔ · J C(7) | ✔ · J C(7) | — |
| Campagne — soumettre à validation | S | — | — | — | — |
| Campagne — **valider et publier** | — | — | ✔ · J | ✔ · J | — |
| Campagne — refuser avec motif typé | — | — | ✔ · J | ✔ · J | — |
| Campagne publiée — lire | L | L | L | L | L |
| Bloc interne de campagne (budget total, notes) | S | **—** | L · J | L · J | L |
| Recherche créateurs — **vue anonymisée** | ✔ C(10) | — | ✔ | ✔ | — |
| Recherche créateurs — **vue identifiée** | **⛔** | **⛔** | ✔ · J | ✔ · J | — |
| Recherche créateurs — **sélection multiple** | — | — | ✔ · J | ✔ · J | — |
| Recherche — export de résultats | **⛔** | **⛔** | **⛔ C(17)** | **⛔ C(17)** | — |
| Journal des recherches | — | — | — | L · J | ✔ |
| Recherche de campagnes | — | ✔ | ✔ | ✔ | — |
| Shortlist | S | — | L · J | L · J | — |

- **C(17)** — **L'export de l'annuaire est interdit à tout le monde, y compris aux administrateurs**
  (`00-cadrage` §6.1 et §8 ; skill `backoffice-ops`, règle 44). L'interdiction porte aussi sur les
  contournements : pagination détournée, export CSV d'une liste, copie d'un résultat de recherche,
  appel répété d'une route de détail. Contrôles : pagination plafonnée côté serveur, limitation de
  débit par compte sur les routes de recherche et de détail, **alerte sur un volume anormal de
  profils distincts consultés par un même compte sur 24 h** (seuil à régler au Lot 3). Les exports
  comptables du pipeline commercial (§3.5) sont une autre chose : ils portent sur des affaires, pas
  sur l'annuaire.

### 3.4 Domaine `matching` et `messaging`

| Objet · Action | `advertiser` | `creator` | `agent` | `admin` | `service` |
|---|---|---|---|---|---|
| Demande de contact — créer | S | — | — | — | — |
| Demande de contact — lire | S | **—** C(18) | L · J | L · J | L |
| Candidature — créer | — | S C(19) | — | — | — |
| Candidature — lire | **—** C(18) | S | L · J | L · J | L |
| Mise en relation — **créer** (`matching.open_introduction()`) | S C(21a) | S C(21a) | ✔ · J C(21a) | ✔ · J C(21a) | — |
| File de validation — lire | — | — | ✔ · J | ✔ · J | — |
| File — prendre en charge (verrou nominatif) | — | — | ✔ · J | ✔ · J | — |
| File — lever un verrou orphelin | — | — | — | ✔ · J | ✔ C(20) |
| File — **valider et s'attribuer** (`approve_introduction()`) | — | — | ✔ · J C(21b) | ✔ · J C(21b) | — |
| File — refuser avec motif typé | — | — | ✔ · J | ✔ · J | — |
| **Proposition INFLUX — créer** | **⛔** | **⛔** | ✔ · J C(21a) | ✔ · J C(21a) | — |
| **Mise en relation — enregistrer _sa propre_ acceptation** | S · J C(21c) | S · J C(21c) | **⛔** | **⛔** | **⛔** |
| **Mise en relation — enregistrer _son propre_ refus** | S · J C(21c) | S · J C(21c) | **⛔** | **⛔** | **⛔** |
| Mise en relation (`introductions`) — lire | S | S | L · J | L · J | L |
| Mise en relation — **poser `identity_revealed_at`** | **⛔** | **⛔** | **⛔** | **⛔** | **⛔ C(21d)** |
| Mise en relation — **modifier `identity_revealed_at`** | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Mise en relation — réattribuer le commercial | — | — | ✔ · J C(22) | ✔ · J | — |
| **Conversation — lire** | C(23) | C(23) | **C(24) · J** | **C(24) · J** | — |
| Conversation — lire **l'aparté de l'autre partie** (D47) | **⛔** | **⛔** | C(24) · J | C(24) · J | — |
| Conversation — écrire un message | C(23) | C(23) | C(24) | C(24) | — |
| Conversation — **ouvrir** | **⛔** | **⛔** | **⛔** C(21d) | **⛔** C(21d) | **⛔** C(21d) |
| Conversation — **rejoindre** en cours de route | ⛔ | ⛔ | ✔ · J C(25) | ✔ · J C(25) | — |
| Conversation — mettre en pause, clore avec motif | — | — | ✔ · J | ✔ · J | — |
| Message — modifier ou supprimer | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Message — écrire « au nom de » quelqu'un | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Pièce jointe à un message | **⛔** | **⛔** | **⛔** | **⛔** | **⛔** |
| **Détections de coordonnées** — lire | **—** | **—** | ✔ · J | ✔ · J | L |
| Détections — créer | — | — | — | — | ✔ C(26) |
| Détections — traiter / classer sans suite | — | — | ✔ · J | ✔ · J | — |
| Signalement — émettre | S | S | — | — | — |
| Signalement — traiter avec motif typé | — | — | ✔ · J C(27) | ✔ · J C(27) | — |

**Conditions**

- **C(18)** — **La partie visée n'est jamais informée d'une demande refusée.** Un créateur ne voit
  jamais une demande de contact qui n'a pas été validée ; une marque ne voit jamais une candidature
  refusée. C'est une règle de sécurité autant que de produit : une demande refusée révélerait qu'un
  annonceur s'est intéressé à ce créateur, information commerciale sensible et hors de toute finalité.
- **C(19)** — Plafond de candidatures actives, appliqué **côté serveur** (`apps/api`), jamais côté
  client, et journalisé quand il est atteint.
- **C(20)** — Expiration automatique du verrou après le délai écrit (skill `backoffice-ops`, étape 10),
  exécutée par le worker. *Amendé au L2C (`l2c/file.md` A9, `0210`)* : **aucune tâche du worker** ;
  l'expiration se calcule à la lecture (`claim_expires_at > now()`), et la prise suivante écrit
  d'abord `queue.claim_expired` avec le titulaire et l'instant réel.
- **C(21) — Point structurant, réécrit le 2026-09-19 : trois moments, trois appelants, trois
  contrats de sécurité.**

  > **L'erreur initiale, en une phrase :** la première rédaction traitait la révélation d'identité
  > comme une action de commercial — « une fonction `matching.open_introduction(...)` qui vérifie que
  > l'appelant est un agent avec `aal2` » — alors que le déclencheur réel est **la seconde
  > acceptation d'un membre** (`13` RG74), et elle réutilisait au passage le nom
  > `open_introduction()` que `04` §5.6 donne déjà à la **création** d'une mise en relation ; la
  > condition était donc à la fois **inexécutable** (aucun agent n'appelle cette fonction au moment
  > de la révélation) et **ambiguë** (deux opérations distinctes sous un même nom).

  **Ce que la correction ne change pas :** l'invariant reste entier — `identity_revealed_at` n'est
  posé que par une seule porte, dans une transaction unique, et **jamais sans les deux acceptations,
  quelle que soit l'origine** (`04`, contrainte `introductions_reveal_requires_both_acceptances`,
  inconditionnelle, confirmée le 2026-09-19 ; `01` §4.3 ; `13` RG5). Ce qui change, c'est **qui
  appelle quoi**, donc ce que chaque fonction doit vérifier de son appelant. *(La correction
  précédente du 2026-09-19, qui avait rendu l'exigence des deux acceptations universelle au lieu de
  la réserver à la proposition INFLUX, reste acquise et n'est pas remise en cause ici.)*

  **Les quatre fonctions et leurs noms faisant foi** (alignés sur `04` §5.6 ; tout autre nom dans un
  document, une migration ou un appel applicatif est une erreur à corriger, pas une variante) :

  | Moment | Fonction | Appelant réel | Pose `identity_revealed_at` ? |
  |---|---|---|---|
  | **0. Création** | `matching.open_introduction(...)` | Le membre initiateur (demande de contact, candidature) **ou** un agent (proposition INFLUX) | **Non, jamais** |
  | **1. Décision** | `matching.approve_introduction(...)` | Un **agent** `aal2`, **titulaire du verrou** | **Non** — sauf la branche unique de `13` RG43 |
  | **2. Acceptation** | `matching.record_introduction_acceptance(...)` | **La marque ou le créateur, pour lui-même**, en `aal1` | **Non directement** : elle appelle le moment 3 **si et seulement si** elle vient d'enregistrer la **seconde** acceptation |
  | **3. Révélation** | `matching.reveal_identity(...)` | **Aucun rôle applicatif.** Appelée **en interne** par les moments 1 (branche RG43) et 2 | **Oui — la seule porte** |

  Le refus d'une partie à l'écran d'acceptation est le symétrique exact du moment 2 :
  `matching.record_introduction_decline(...)`, **mêmes contrôles d'appelant**, motif de la liste B
  obligatoire (`13` RG87), et **aucune révélation dans aucun cas**.

  **C(21a) — Moment 0, la création (`matching.open_introduction`).**

  | | |
  |---|---|
  | **Qui peut appeler** | `influx_advertiser` (demande de contact), `influx_creator` (candidature), `influx_agent` et `influx_admin` en `aal2` (proposition INFLUX). `REVOKE EXECUTE ... FROM PUBLIC` puis `GRANT` nominatif |
  | **Vérifié avant exécution** | Le compte engagé est **le sien** (un membre ne crée jamais une mise en relation pour un tiers) et n'est **pas suspendu** ; l'origine est **cohérente avec le rôle** de l'appelant — un membre ne crée jamais une `influx_proposal` ; **aucun blocage actif** entre les deux parties (`matching.party_blocks`) ; **aucun doublon actif** sur le triplet (`introductions_active_pair_idx`) ; pour un agent, **aucun conflit d'intérêt** (`13` RG35) ; les plafonds côté serveur (C(19), `13` RG53) ; la campagne est **publiée** quand elle est requise |
  | **Ce qu'elle fait** | Alloue la référence `MER-AAAA-NNNNNN`, copie les **pays des deux parties**, enregistre l'acceptation **de l'initiateur seul** avec sa version de CGU, calcule `sla_due_at` **une fois**, écrit l'événement chaîné `introduction.created` ; pour une proposition INFLUX, pose directement `status = 'approved'`, `owner_agent_id` = l'auteur et `proposal_batch_id` |
  | **`SECURITY DEFINER` ?** | **Oui, nécessaire.** Elle lit `matching.party_blocks`, que l'appelant **ne doit pas pouvoir lire** — le motif d'un blocage et son auteur ne sont jamais exposés à la partie bloquée (`04` §5.6, `10` RG30) —, et elle écrit `matching.reference_counters` et le registre chaîné, sur lesquels aucun rôle applicatif n'a de droit. Sans élévation, il faudrait accorder ces lectures au membre : le blocage deviendrait un oracle |
  | **Forme du refus** | **Un seul message générique** côté membre (`10` RG29, exclusion silencieuse) ; le motif réel — blocage, doublon, plafond — n'existe que dans le registre interne. Côté agent, le compte rendu d'échec partiel de `13` RG60 s'applique, **sans jamais afficher le motif du blocage ni son auteur** |

  **C(21b) — Moment 1, la décision du commercial (`matching.approve_introduction`).**

  | | |
  |---|---|
  | **Qui peut appeler** | `influx_agent` et `influx_admin` **uniquement**. **Aucun membre, jamais** : c'est ici, et ici seulement, que `aal2` a un sens dans ce cycle |
  | **Vérifié avant exécution** | Rôle `agent` ou `admin` **et** `influx.current_aal() = 'aal2'` (formulation positive, P4) ; compte non suspendu ; `status = 'in_review'` **et `claimed_by_agent_id` = l'appelant** — on ne valide jamais une entrée dont un collègue tient le verrou (`13` RG29) ; verrou non expiré ; **aucun conflit d'intérêt** (`13` RG35) |
  | **Ce qu'elle fait** | Dans une seule transaction : `status = 'approved'`, `owner_agent_id` = l'appelant (figé, `13` RG40), `decided_at = now()`, événement chaîné `introduction.approved`, puis **mise en file des invitations** vers la ou les parties qui n'ont pas encore accepté. **Elle ne pose pas `identity_revealed_at` et ne crée aucune conversation** (`13` RG42 : valider n'est pas révéler) |
  | **La seule branche révélante** | Si, au moment de la validation, **les deux acceptations existent déjà** (`13` RG43 : la marque a demandé le contact *et* le créateur a candidaté sur la même campagne), la fonction appelle `matching.reveal_identity()` **en interne, dans la même transaction**. Cette branche — et elle seule — exige en plus : une **confirmation séparée** du geste de validation (`13` RG44), un **second facteur frais** (`R`, §1.3 PD2 et PD3) et un traçage à deux horodatages, marqué `dual_control: 'degraded_single_operator'` tant qu'une seule personne opère. Dans tous les autres cas, **aucune friction supplémentaire** : rien d'irréversible ne se produit |
  | **`SECURITY DEFINER` ?** | **Oui, nécessaire.** Les agents n'ont **aucun `GRANT UPDATE` sur `matching.introductions.status`** : un `UPDATE` ordinaire contournerait le verrou, le contrôle de conflit d'intérêt et la table des transitions. La fonction écrit en outre le registre chaîné et la file d'envoi, interdits aux rôles humains (C(37), P8) |
  | **Ce qui n'est pas dans cette fonction** | Le **refus** (`matching.reject_introduction`, motif typé de la liste A obligatoire), la **réattribution** (C(22)), et la **prise en charge** — cette dernière n'est pas une fonction mais une **transition conditionnelle atomique** (`04` §5.6, `13` RG28) : `where status = 'pending_review'`, zéro ligne modifiée signifie qu'un collègue a pris la main. Une transition conditionnelle suffit là où il n'y a ni élévation ni écriture privilégiée ; on n'élève pas par habitude |

  **C(21c) — Moment 2, l'acceptation d'un membre (`matching.record_introduction_acceptance`).**

  | | |
  |---|---|
  | **Qui peut appeler** | `influx_advertiser` et `influx_creator` **uniquement, et pour eux-mêmes**. **`REVOKE EXECUTE` à `influx_agent`, `influx_admin`, `influx_worker` et `PUBLIC`** : un commercial ne doit pas pouvoir enregistrer l'acceptation d'une partie, même avec son accord verbal. Sur le seul acte qui rend la clause de non-contournement opposable sur ce dossier (`13` RG72), un consentement saisi par un tiers n'est pas un consentement — même raisonnement qu'en C(36) |
  | **Ni `aal2`, ni rôle interne** | Les membres s'authentifient **sans mot de passe et sans second facteur** au MVP (§6.1, D37) : exiger `aal2` ici rendrait l'acceptation **impossible pour tout le monde**. C'est exactement l'erreur corrigée. Le contrôle pertinent n'est pas le niveau d'authentification, c'est **l'appartenance à cette mise en relation précise** |
  | **Vérifié avant exécution** | 1. `influx.current_account_id()` **est égal à `advertiser_account_id` ou à `creator_account_id`** de **cette** mise en relation ; le côté (`advertiser` / `creator`) en est **déduit**, jamais reçu en paramètre. 2. Le compte n'est **pas suspendu**. 3. `status = 'approved'` — on n'accepte ni une entrée en attente, ni une entrée refusée, retirée ou clôturée. 4. `identity_revealed_at is null`. 5. **Son propre horodatage d'acceptation est encore nul** ; une seconde acceptation est refusée, **sauf** le cas de ré-acceptation pour changement de version de CGU (`13` RG68, question **Q3** encore ouverte), qui remplace la version, re-date, et écrit `introduction.party_reaccepted`. 6. La version de CGU enregistrée est **la version en vigueur lue en base**, jamais celle envoyée par le client. 7. La ligne est verrouillée par `select … for update` **avant** toute lecture des deux horodatages : c'est ce qui sérialise deux acceptations simultanées et interdit la double révélation |
  | **Ce qu'elle fait** | Pose `advertiser_accepted_at` **ou** `creator_accepted_at` — celui du côté déduit, **jamais l'autre** — et la version de CGU correspondante ; écrit l'événement chaîné `introduction.party_accepted` ; **puis, si et seulement si les deux horodatages sont désormais non nuls, appelle `matching.reveal_identity()` dans la même transaction**. Sinon elle rend la main et l'écran d'attente de `13` RG73 s'affiche, sans jamais dire qui est l'autre partie ni ce qu'elle fait |
  | **`SECURITY DEFINER` ?** | **Oui, nécessaire, et ce n'est pas un détail de forme.** Les membres n'ont **aucun `GRANT UPDATE`** sur `matching.introductions`. Sans élévation il faudrait leur en accorder un, et une politique RLS — qui **autorise une ligne** mais ne contrôle ni les colonnes écrites, ni la valeur écrite, ni ce qui se passe ensuite — laisserait le membre choisir son horodatage, choisir sa version de CGU, écrire l'horodatage **de l'autre partie**, et n'enchaînerait dans la même transaction ni l'événement d'audit ni la révélation. **Une politique RLS ne sait pas rendre une suite d'écritures atomique** : c'est exactement ce qu'énonce P9 |
  | **Défense en profondeur** | La politique RLS de **lecture** reste écrite et ciblée (`advertiser_account_id = influx.current_account_id() or creator_account_id = influx.current_account_id()`), et un `REVOKE UPDATE` **de colonne** couvre `advertiser_accepted_at`, `creator_accepted_at`, les deux `*_terms_version_id` et `status` pour les quatre rôles applicatifs. Deux barrières indépendantes, pas une |
  | **Forme du refus** | `forbidden`, avec un **code de réponse identique** pour « cette mise en relation n'existe pas » et « vous n'en êtes pas partie » (T14, IDOR). Sinon la seule existence d'un identifiant apprend à un tiers qu'une marque s'intéresse à un créateur — information aussi sensible que celle que protège C(18) |

  **C(21d) — Moment 3, la révélation (`matching.reveal_identity`) : une opération interne, appelable
  par personne.**

  | | |
  |---|---|
  | **Qui peut appeler** | **Aucun rôle applicatif.** Ni membre, ni agent, ni administrateur, ni worker. `REVOKE EXECUTE ON FUNCTION matching.reveal_identity(uuid) FROM PUBLIC, influx_advertiser, influx_creator, influx_agent, influx_admin, influx_worker, influx_app;` **et aucun `GRANT`**. Les deux seuls appelants sont `matching.record_introduction_acceptance` (cas nominal) et `matching.approve_introduction` (branche RG43), qui s'exécutent **sous le même rôle propriétaire** : l'exécution leur est ouverte **par la propriété, pas par un droit accordé** — il n'existe littéralement aucun `GRANT` qu'une migration distraite pourrait élargir |
  | **Le rôle propriétaire** | Un rôle dédié `influx_intro_owner`, `NOLOGIN`, **non accordé à `influx_app`** et membre d'aucun rôle applicatif. Il détient les seuls droits d'écriture sur `identity_revealed_at`, `messaging.conversations` et `messaging.conversation_participants`. Si `influx_app` en était membre, un `SET ROLE` consécutif à une injection rouvrirait la porte : il ne l'est pas (P2, corollaire) |
  | **Vérifié avant exécution** | **Elle re-vérifie l'invariant complet sans faire confiance à son appelant** : `select … for update` sur la ligne ; `identity_revealed_at is null` (sinon erreur `55006`) ; `status = 'approved'` ; **les deux horodatages d'acceptation sont non nuls** ; les deux versions de CGU sont présentes. Ce contrôle est **délibérément redondant** avec celui de l'appelant et avec la contrainte de base : trois barrières sur le chemin le plus critique du produit, parce qu'une seule suffirait à tout perdre |
  | **Garde-fou anti-appel direct** | En complément de l'absence de droit : la fonction exige un **marqueur de contexte de transaction** posé par l'appelant légitime (`influx.reveal_ctx` = identifiant de la mise en relation, écrit par `set_config(…, true)`, donc local à la transaction). Absence ou valeur différente ⇒ exception. C'est une **seconde** barrière, jamais la première : la garantie reste l'absence de `GRANT EXECUTE` |
  | **Ce qu'elle fait — tout ou rien** | 1. `identity_revealed_at = now()` ; 2. événement chaîné `introduction.identity_revealed` (gravité **critique**) ; 3. création de la **conversation** et de ses **trois participants** — marque, créateur, commercial responsable ; 4. création de l'**affaire** (`billing.deals`) à l'état `open`, rattachée à la mise en relation (C(27)) ; 5. mise en file des **deux e-mails de confirmation** ; 6. notification au commercial responsable. Si une seule de ces écritures échoue, **aucune ne subsiste** (`13` RG74 ; contrainte C2 du document `02`) |
  | **`SECURITY DEFINER` ?** | **Oui, et c'est la seule raison d'être de cette fonction.** Elle écrit `identity_revealed_at`, colonne **révoquée à tous les rôles applicatifs** et protégée par le déclencheur d'écriture unique, et elle insère dans `messaging.conversations`, sur laquelle **personne n'a de `GRANT INSERT`** (ligne « Conversation — ouvrir » du §3.4 : ⛔ pour les cinq rôles). Aucune autre construction ne permet d'exécuter ces six écritures dans une transaction unique sans donner à un rôle un droit permanent qu'il pourrait ensuite employer seul |
  | **Ce qui reste interdit à tout le monde** | Modifier ou effacer `identity_revealed_at` une fois posé : `REVOKE UPDATE` de colonne **plus** le déclencheur `introductions_write_once` (`04` §5.6). Il n'existe **aucun bouton « révéler »**, ni aucun bouton « dé-révéler », pour aucun rôle (`13` RG6 et RG75) |

  **Le tableau des droits d'exécution, en une vue** — à reproduire tel quel dans la migration `0402` :

  ```sql
  revoke execute on all functions in schema matching from public;

  grant execute on function matching.open_introduction(...)
    to influx_advertiser, influx_creator, influx_agent, influx_admin;
  grant execute on function matching.approve_introduction(...)
    to influx_agent, influx_admin;
  grant execute on function matching.record_introduction_acceptance(...)
    to influx_advertiser, influx_creator;          -- et a personne d'autre
  grant execute on function matching.record_introduction_decline(...)
    to influx_advertiser, influx_creator;
  -- matching.reveal_identity(uuid) : AUCUN grant, jamais.
  -- Propriete de influx_intro_owner, appelee uniquement par les deux fonctions
  -- ci-dessus, qui ont le meme proprietaire.
  ```

  **Les quatre fonctions obéissent sans exception aux règles de P7** : `SET search_path = ''`, tous
  les objets qualifiés par leur schéma, `REVOKE EXECUTE FROM PUBLIC` puis `GRANT` nominatif,
  vérification du rôle et de l'état de suspension **par la fonction elle-même**, appel de
  `audit.append(...)` plutôt qu'écriture directe du registre. Ce sont des fonctions
  `SECURITY DEFINER`, **pas des opérations élevées** : la liste fermée E-1 à E-5 du P7 reste à
  **cinq entrées**, et `withElevatedTransaction` n'est appelée nulle part dans ce cycle.

  **Vérifié par les tests T2, T14 et T18** (§8).

  **Deux points de cohérence renvoyés à `expert-database` et `architecte`, sans effet sur le contrat
  de sécurité ci-dessus.** *(1)* **Tranché le 2026-09-19 :** les fonctions de contexte portaient deux
  noms dans les deux documents. Ce sont **les noms de `04` §4.1 qui survivent** —
  `influx.current_account_id()` et `influx.current_account_role()` — et ce document a été corrigé par
  **substitution d'identifiants, sans qu'aucune règle change**. `influx.current_aal()` est
  **conservée** telle quelle : elle renvoie le niveau brut, tandis que `influx.has_aal2()` en est
  l'enveloppe booléenne — **deux fonctions, pas deux noms**. Correspondance complète et justification
  dans l'encadré en tête de `04` §4.1. *(2)* Les deux
  nouvelles fonctions `approve_introduction()` et `record_introduction_acceptance()` **n'existent pas
  encore** dans `04` §5.6 : elles y ont été ajoutées le 2026-09-19 en même temps que cette correction,
  pour que le contrat reste **un et un seul** dans les deux documents.
- **C(22)** — La réattribution conserve **l'historique des responsables successifs**, jamais écrasé
  (skill `backoffice-ops`, règle 18), et elle est un **préalable obligatoire** à la désactivation d'un
  compte agent (règle 19).
- **C(23)** — Participant de la conversation, compte non suspendu. Une partie suspendue conserve la
  lecture et perd l'écriture (skill `messaging-spec`, étape 10). **Depuis D47, la condition porte
  aussi sur le canal** : un membre lit et écrit **dans le fil commun et dans son propre aparté,
  jamais dans celui de l'autre partie**. La liste de canaux est une **constante de la politique**
  de chaque rôle membre, doublée de la contrainte `messages_party_channel` (`04` §5.7.1) : deux
  murs, une politique et une contrainte, dont aucun ne dépend d'une donnée. Elle s'applique aussi
  aux données dérivées (`conversation_channel_activity`, `conversation_reads`), sans quoi un
  compteur trahirait l'existence d'un aparté (`12` RG118, RG146). En écriture, la pause et le
  blocage ferment le fil commun aux parties et laissent leur aparté ouvert (`12` RG123, RG126) ;
  ce sont des règles de base (déclencheur `assert_message_writable`), pas d'écran.
- **C(24)** — **Toute lecture de conversation par un rôle `agent` ou `admin` passe par la fonction
  journalisante**, qu'il soit participant ou non. Voir §5, qui traite ce cas en entier. **Depuis
  D47, la fonction lit un canal à la fois** : ouvrir le fil commun ne charge jamais un aparté, et
  chaque canal lu produit sa propre ligne de journal (`12` RG130, RG132).
- **C(25)** — L'ajout d'un agent en cours de route est un **événement visible** dans le fil, avec
  message système horodaté et nommé. Jamais un ajout silencieux (skill `messaging-spec`, règle 2).
  **Depuis D47, le message système est écrit dans le fil commun et dans chacun des deux apartés**
  (`12` RG128) : chaque partie sait à tout moment qui peut lire ce qu'elle écrit en privé.
- **C(26)** — La détection stocke **le type de motif et sa position, jamais une copie du texte
  détecté** (`01-intermediation-courtee.md` §M5). Recopier le numéro de téléphone détecté dans une
  table de signalement reviendrait à créer, à côté de la messagerie, un annuaire des coordonnées
  qu'on prétend protéger. C'est aussi un point de minimisation RGPD (§10).
- **C(27)** — **Un signalement visant un message écrit par un agent n'est jamais instruit par un
  agent, ni par l'administrateur qui en est l'auteur** (`12` RG140). L'auteur est posé sur le
  signalement par déclencheur (`reports.agent_author_account_id`, `04` §5.7.1) ; la politique du
  rôle `agent` exclut toute ligne où il est renseigné, celle du rôle `admin` exclut les lignes qui
  le désignent. **Cas de l'administrateur unique** (arbitrage du fondateur, `04` §5.7.1 A3,
  2026-09-24) : si l'auteur est le seul administrateur actif, le signalement **reste en file, sans
  instructeur**, et une alerte persistante l'annonce **sans aucun détail** (ni signalant, ni
  conversation, ni message) ; il est instruit dès qu'un second administrateur existe, par la même
  bascule sans code que PD7 (§1.3). **Limite à dire franchement** : l'administrateur unique apprend
  ainsi qu'un signalement le vise, puisqu'il est le seul auteur possible. La seule protection
  complète est une seconde personne titulaire du rôle `admin`.

### 3.5 Domaines `billing` (pipeline commercial), `leads` et `backoffice`

> **Alignements à reporter dans les lignes ci-dessous (revue de cohérence du 2026-09-24),
> à formaliser par `expert-cybersecurite` :**
> - **Écrire sur une affaire** (saisir, modifier un montant, changer d'état) est réservé au
>   **commercial responsable** (`owner_agent_id` = appelant) et à l'**administrateur** — arbitrage du
>   fondateur **D50**, `14` RG39. Un autre agent lit et demande la réattribution.
> - **Créer une affaire** n'est un droit d'aucun rôle humain : l'affaire est créée **par le système**,
>   dans la transaction de révélation (`14` RG1 à RG2bis, arbitrage `chef-de-projet` du 2026-09-19).
>   Les ✔ de la ligne « créer » ne valent que pour cette transaction.

| Objet · Action | `advertiser` | `creator` | `agent` | `admin` | `service` |
|---|---|---|---|---|---|
| Affaire (`deals`) — créer | ⛔ | ⛔ | ✔ · J C(27) | ✔ · J C(27) | — |
| Affaire — lire | **—** C(28) | **—** C(28) | L · J | L · J | L |
| Affaire — **saisir montant, devise, commission** | ⛔ | ⛔ | ✔ · J C(29) | ✔ · J C(29) | — |
| Affaire — **modifier un montant déjà saisi** | ⛔ | ⛔ | ✔ · J C(30) | ✔ · J C(30) | — |
| Affaire — changer d'état | ⛔ | ⛔ | ✔ · J C(31) | ✔ · J C(31) | — |
| Affaire — clore | ⛔ | ⛔ | ✔ · J · 2V | ✔ · J · 2V | — |
| Historique des modifications de montant | ⛔ | ⛔ | L | L | L |
| `commission_rates` — lire | — | — | — | L | L |
| `commission_rates` — **écrire** | ⛔ | ⛔ | ⛔ | **⛔ C(32)** | ⛔ |
| Journal de synchronisation (`outbox_events`) — lire | — | — | L C(33) | L C(33) | ✔ |
| Synchronisation — rejouer une ligne | — | — | ✔ · J | ✔ · J | ✔ |
| Synchronisation — rejouer un lot (≤ 200, sans 2V : EC-J8-19, revue `expert-cybersecurite` 2026-10-16) | — | — | ✔ · J | ✔ · J | — |
| **E-mail — envoi unitaire, saisie libre** | — | — | ✔ · J C(34) | ✔ · J C(34) | — |
| **E-mail — envoi à des contacts plateforme** | — | — | ✔ · J · 2V · R C(35) | ✔ · J · 2V · R C(35) | — |
| **E-mail — envoi à un segment Brevo** | — | — | ✔ · J · 2V · R C(35) | ✔ · J · 2V · R C(35) | — |
| Consentement marketing — lire | S | S | L · J | L · J | L |
| Consentement marketing — modifier | S | S | **—** C(36) | **—** C(36) | ✔ C(4) |
| Demande RGPD — déposer | S | S | — | — | — |
| Demande RGPD — lire la file | — | — | L · J | L · J | — |
| Demande RGPD — **exécuter un export** | — | — | — | ✔ · J · 2V · R | ✔ C(4) |
| Demande RGPD — **exécuter une anonymisation** | S · R · J (son propre effacement, D72) | S · R · J (son propre effacement, D72) | — | ✔ · J · 2V · R | ✔ C(4) |
| Tableau de bord, indicateurs agrégés | — | — | L | L | ✔ |
| Notes internes sur une fiche | ⛔ | ⛔ | ✔ · J | ✔ · J | — |

**Conditions**

- **C(27)** — **Aucune affaire orpheline.** Toute affaire est rattachée à une `introduction`
  existante : `deals.introduction_id NOT NULL` avec clé étrangère. Une affaire sans mise en relation
  est une affaire qu'INFLUX n'a pas produite (`01-intermediation-courtee.md` §6.1).
- **C(28)** — **Les membres ne voient pas le pipeline commercial.** Ni le montant enregistré, ni la
  commission convenue, ni l'état de l'affaire, ni le nom du commercial responsable au-delà de sa
  présence dans le fil. C'est de la donnée interne d'INFLUX, et la montrer exposerait le barème
  appliqué à chaque partie séparément.
- **C(29)** — Contrôles **côté serveur uniquement** : montant > 0, `numeric` exact ou entier en plus
  petite unité monétaire (jamais de flottant), devise ISO 4217 dans une liste fermée,
  `agreed_commission_amount ≤ negotiated_amount`, `signed_at > identity_revealed_at`. **Aucun montant
  ni taux n'est jamais accepté d'un client** au sens où il serait recalculé ou validé côté navigateur :
  le commercial **saisit** des montants, le serveur les **valide** puis les enregistre.
- **C(30)** — Toute modification conserve l'ancienne valeur, son auteur et son horodatage (skill
  `backoffice-ops`, règle 41). La ligne d'historique est en **ajout seul** (§4, P8).
- **C(31)** — Les transitions autorisées sont contraintes **en base** (déclencheur), pas seulement
  dans `packages/domain`. La base reste l'arbitre (`02-architecture` §10.2, point 6).
- **C(32) — Interdiction structurelle.** `commission_rates` est **créée et reste vide** au MVP
  (`CLAUDE.md` §2, `01-intermediation-courtee.md` §7). Aucun rôle applicatif n'a le droit d'y écrire :
  seul le rôle de migration le peut, donc seule une migration relue peut la remplir. **C'est une
  barrière technique contre le retour clandestin d'un calcul de commission au MVP.** Contrôle
  complémentaire en CI : aucune multiplication d'un montant par une constante dans `apps/` et
  `packages/` (§8, T16).
- **C(33)** — La charge utile d'un événement ne contient **que des identifiants** (`02-architecture`
  §6). Un agent qui consulte la file voit l'état et la cause en clair, pas les données personnelles
  transportées.
- **C(34)** — Saisie libre **unitaire uniquement**, plafonnée par rôle (A4, D35), journalisée
  nominativement, lien de désinscription obligatoire, **adresse vérifiée contre la liste des
  désinscrits au moment de l'envoi** et non au moment de la sélection.
- **C(35)** — **Le consentement est revérifié à la consommation, pas à l'émission** (skill
  `lead-pipeline`, règle 2). Une absence de consentement donne un statut `skipped` explicite,
  distingué d'une erreur. Fenêtre d'annulation de 5 minutes avant départ effectif.
- **C(36)** — **Un agent ne modifie jamais le consentement marketing d'un membre.** Il peut le lire,
  constater son absence, et demander au membre de le donner lui-même. Un consentement saisi par un
  tiers n'est pas un consentement — c'est le point où une bonne intention commerciale devient une
  infraction. Exception éventuelle (preuve d'un consentement recueilli hors ligne) : à instruire par
  `expert-conformite-rgpd`, pas par moi.

### 3.6 Domaine `audit` — le registre

| Objet · Action | `advertiser` | `creator` | `agent` | `admin` | `service` |
|---|---|---|---|---|---|
| `audit_events` / `introduction_events` — **insérer** | ⛔ | ⛔ | ⛔ C(37) | ⛔ C(37) | ✔ C(37) |
| `audit_events` — lire | — | — | L C(38) | L C(38) | L |
| **`audit_events` — modifier** | **⛔** | **⛔** | **⛔** | **⛔ — LIGNE EXPLICITE N° 2** | **⛔** |
| **`audit_events` — supprimer** | **⛔** | **⛔** | **⛔** | **⛔** | **⛔** |
| `audit_events` — vider (`TRUNCATE`) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `conversation_access_log` — insérer | ⛔ | ⛔ | ⛔ C(37) | ⛔ C(37) | ✔ C(37) |
| `conversation_access_log` — lire | — | — | — | L · J | L |
| `conversation_access_log` — modifier / supprimer | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Vérification de chaîne — exécuter | — | — | — | L | ✔ |

- **C(37)** — L'écriture du registre ne passe par **aucun rôle humain**. Elle se fait exclusivement
  par la fonction `SECURITY DEFINER` `audit.append(...)`, appelée depuis les fonctions métier, dans la
  même transaction que le fait qu'elle relate. Aucun `GRANT INSERT` n'est accordé à `influx_agent` ni
  à `influx_admin` : ils ne peuvent donc **ni écrire une fausse ligne, ni omettre une vraie**.
- **C(38)** — Lecture limitée aux événements de son périmètre d'exploitation ; la lecture du journal
  des lectures de conversations (`conversation_access_log`) est réservée à `admin` **et elle est
  elle-même journalisée**. Sinon, le contrôleur échapperait au contrôle.

> **LIGNE EXPLICITE N° 2 — dite en français simple.** *Personne ne peut modifier ni effacer une ligne
> du journal d'audit. Pas un commercial, pas un administrateur, pas le processus technique, pas le
> fondateur depuis l'application. La seule façon d'y toucher serait de passer par l'outil
> d'administration de la base de données, et c'est précisément pour cela que ce point remonte au
> fondateur au §10.*

---

## 4. Les principes de Row Level Security

Dix principes numérotés. Chacun porte sa justification, parce qu'un principe dont on a oublié la
raison est un principe qu'on contournera à la première urgence.

### P1 — Refus par défaut, sur toutes les tables, sans exception

```sql
alter table matching.introductions enable row level security;
alter table matching.introductions force  row level security;
revoke all on matching.introductions from public;
```

`ENABLE` seul ne suffit pas : **le propriétaire de la table échappe à ses propres politiques**.
`FORCE` le soumet lui aussi. C'est l'oubli le plus fréquent, et il est silencieux.

Une table sans politique déclarée est traitée comme une faille (skill `supabase-schema`). La CI
énumère les tables de nos schémas et **échoue** si l'une d'elles n'a pas `relrowsecurity = true`,
au moins une politique, et une ligne dans la matrice du §3 (§8, T2).

### P2 — L'API se connecte avec le rôle de l'utilisateur, jamais avec un rôle qui contourne la RLS

C'est **la** condition pour que tout le reste existe. Si `apps/api` se connecte avec un rôle
propriétaire ou `BYPASSRLS`, alors les politiques RLS sont de la décoration : elles sont écrites,
testées peut-être, et jamais évaluées en production.

Le rôle de connexion `influx_app` n'est **ni propriétaire d'aucun objet, ni `BYPASSRLS`, ni `SUPERUSER`,
ni membre de `service_role`**. Chaque transaction utilisateur commence par prendre le rôle
correspondant à l'utilisateur, puis pose ses réclamations :

```sql
begin;
  set local role influx_advertiser;                       -- ou creator / agent / admin
  select set_config('request.jwt.claims', $1::text, true);
  select set_config('influx.account',     $2::text, true);
  select set_config('influx.role',        $3::text, true);
  select set_config('influx.aal',         $4::text, true);
  -- … requêtes du domaine, sous RLS …
commit;
```

`set_config(..., true)` est **local à la transaction**. Hors transaction, le contexte n'existe pas et
les politiques voient un utilisateur anonyme : **toute lecture passe par une transaction**, même la
plus triviale. Ce comportement est un garde-fou, pas une contrainte : il transforme l'oubli d'ouvrir
une transaction en « zéro ligne » plutôt qu'en « toutes les lignes ».

> **CONSTAT BLOQUANT B1 — la faille de raisonnement du document `02`.**
> Le §2.5 de `02-architecture-3-espaces.md` fonde l'anonymisation sur « **aucun `GRANT` au rôle
> annonceur** sur l'objet identifiant », et qualifie cette absence de droit de « plus fort qu'une
> politique ». **C'est exact en principe, et inopérant en configuration Supabase standard**, où
> `advertiser`, `creator`, `agent` et `admin` sont tous le même rôle Postgres : `authenticated`.
> Il n'existe alors aucun « rôle annonceur » à qui refuser un `GRANT`, et la protection ne repose plus
> que sur **un seul contrôle**, la politique RLS — contrairement à ce que le document annonce, et
> contrairement au principe de défense en profondeur.
>
> **Correctif exigé :** créer **quatre rôles Postgres distincts** — `influx_advertiser`,
> `influx_creator`, `influx_agent`, `influx_admin` — sans droit de connexion, dont `influx_app` est
> membre, et prendre le bon rôle par `SET LOCAL ROLE` après avoir lu le rôle métier en base. Les
> `GRANT` et `REVOKE` deviennent alors **réels et lisibles dans la migration**, et les politiques
> s'écrivent `TO influx_advertiser`, ce qui les rend en outre bien plus faciles à relire.
>
> **Effort :** une demi-journée à une journée au Lot 0 (création des rôles, `GRANT` par rôle, logique
> de `SET LOCAL ROLE`, un test). **Coût de ne pas le faire :** l'invariant produit A2 ne tient que
> par un seul fil, et le jour où une politique est mal écrite sur une table ajoutée au Lot 5, rien ne
> rattrape l'erreur.

Corollaire à ne pas oublier : `influx_app` ne doit **pas** être membre de `service_role` ni d'un rôle
élevé. Sinon un défaut d'échappement permettrait un `RESET ROLE` ou un `SET ROLE service_role` dans
la même session. Les accès élevés passent par **une seconde grappe de connexions, avec un rôle
différent et une variable d'environnement différente** (§P7). *Précisé le 2026-09-26 (EC-1) :*
**une grappe, un rôle de connexion et une variable par rôle élevé** — le processus HTTP ne détient
jamais la connexion du worker. Liste fermée : §P7, « Les rôles Postgres — liste fermée ».

### P3 — Le rôle métier est lu en base, jamais dans le jeton

Validé, et c'est la bonne décision. Un rôle inscrit dans un JWT reste valide jusqu'à l'expiration du
jeton : **un agent suspendu conserverait ses droits pendant une heure sur la surface qui voit toutes
les identités du produit.** Inacceptable.

Mise en œuvre recommandée, qui supprime l'objection de performance : **une lecture par transaction,
pas une lecture par évaluation de politique.**

1. La transaction s'ouvre avec le rôle de connexion `influx_app`.
2. Une requête indexée lit, en une fois : le rôle métier, l'état de suspension, l'état de la session.
3. `apps/api` écrit ces valeurs dans le contexte de transaction (`influx.role`, `influx.aal`,
   `influx.account`) et prend le rôle Postgres correspondant.
4. Les politiques lisent `current_setting('influx.role', true)` — une lecture mémoire, sans jointure.

La valeur ne vient **jamais** du jeton : elle vient d'une lecture de base faite dans la même
transaction. Coût réel : **une lecture indexée par requête HTTP**. À mesurer par `expert-database`
(question 3 du §14.2 du document `02`), mais l'ordre de grandeur est négligeable devant le reste.

Toute fonction utilisée dans une politique est déclarée `STABLE`, jamais `VOLATILE`, et
`SET search_path = ''`.

### P4 — Toute condition d'accès est **positive** et échoue en refus

Une politique doit être écrite de sorte qu'une valeur manquante refuse l'accès, jamais qu'elle
l'ouvre. `current_setting('influx.aal', true)` renvoie `NULL` si le réglage est absent, et toute
comparaison avec `NULL` vaut `NULL`, donc « refusé ».

```sql
-- BON : absence de contexte ⇒ refus
using (influx.current_account_role() = 'agent' and influx.current_aal() = 'aal2')

-- MAUVAIS : absence de contexte ⇒ NOT NULL ⇒ NULL ⇒ refus par chance, pas par construction
using (not (influx.current_aal() = 'aal1'))
```

Règle de revue : **aucune politique ne contient de négation sur un réglage de session.**

### P5 — L'anonymisation est une séparation d'objets, doublée d'une absence de droit

Deux tables, jamais une table et une vue.

| Objet | Contenu | `GRANT SELECT` accordé à |
|---|---|---|
| `profiles.creator_public_profiles` | Thématiques, pays, tranches d'audience, formats, tarifs indicatifs, portfolio **modéré**, badge et sa date, `public_ref` opaque | `influx_advertiser`, `influx_creator`, `influx_agent`, `influx_admin` |
| `profiles.creator_identities` | Nom légal, pseudos, `@`, liens de réseaux, captures, coordonnées, pièces de vérification | `influx_creator` (lui-même), `influx_agent`, `influx_admin`. **Aucun `GRANT` à `influx_advertiser`** — la révélation se fait par une politique sur une vue dédiée, voir ci-dessous |

Trois précisions qui font partie du principe :

1. **Pourquoi pas une vue `security_invoker` sur une table unique.** Une vue `security_invoker = true`
   exige de l'appelant les droits sur la table sous-jacente : l'annonceur devrait donc avoir un
   `GRANT` sur l'objet identifiant, ce qui annule tout l'intérêt. Et une vue **sans** `security_invoker`
   s'exécute avec les droits de son propriétaire et **contourne la RLS des tables sous-jacentes** :
   c'est le piège classique, il annulerait le dispositif en entier. Deux tables, donc.
2. **La révélation** est exposée à l'annonceur par une **vue `security_invoker = true`
   `profiles.creator_identities_revealed`**, sur laquelle il a un `GRANT SELECT`, et dont la table
   sous-jacente lui accorde un droit restreint par la politique C(11) du §3.2. La formulation exacte
   relève de `expert-database` ; l'exigence de sécurité est : **un seul chemin de lecture, et il porte
   la condition de révélation dans le prédicat SQL**.
3. **L'identifiant public est opaque, aléatoire et distinct de l'identifiant de compte.**
   `creator_public_profiles.public_ref` est un UUID aléatoire, **jamais** une séquence (elle divulgue
   l'ordre d'inscription et permet l'énumération), **jamais** dérivé de l'identifiant de compte
   (sinon la corrélation entre les deux couches est triviale côté client).

Trois lignes de défense, et pas une seule :

| Ligne | Mécanisme | Ce qu'elle rattrape |
|---|---|---|
| 1 | Absence de `GRANT` + politique SQL | Une erreur de requête, une jointure trop large |
| 2 | Schéma de réponse Fastify : ce qui n'est pas déclaré ne sort pas | Une colonne qui s'échappe malgré tout |
| 3 | Test automatisé sur la charge utile brute (§8, T1) | Tout le reste, y compris un champ imprévu |

### P6 — Aucune table métier dans le schéma `public`

> **CONSTAT BLOQUANT B3.** Le projet Supabase expose **publiquement** une API PostgREST sur les
> schémas configurés — `public` par défaut — accessible avec la clé `anon`. Cette clé est conçue pour
> être publique ; elle est certes cantonnée à `apps/api` dans notre architecture, mais **on ne
> protège pas une base en pariant sur la confidentialité d'une clé qui n'est pas un secret.**

Exigences :

1. **Aucune table métier dans `public`.** Les tables vivent dans des schémas par domaine :
   `identity`, `profiles`, `campaigns`, `search`, `verification`, `matching`, `messaging`, `billing`,
   `leads`, `audit`. Ce point tranche, **pour une raison de sécurité**, la question 5 du §14.2 du
   document `02` : **schémas Postgres par domaine**, pas schéma unique.
2. Ces schémas ne sont **pas** déclarés dans les schémas exposés par PostgREST.
3. `REVOKE ALL ON SCHEMA ... FROM anon, authenticated;` et `REVOKE ALL ON ALL TABLES IN SCHEMA ...
   FROM anon, authenticated;` avec des `ALTER DEFAULT PRIVILEGES` cohérents. Les rôles `anon` et
   `authenticated` restent **vides de droits** sur nos données.
4. Conséquence heureuse : même si la clé `anon` fuitait, ou si une future intégration ouvrait
   PostgREST, il n'y aurait **rien à lire**.

**Effort :** nul si c'est décidé maintenant ; une migration pénible si on s'en aperçoit au Lot 3.

### P7 — La liste **nommée et fermée** des opérations autorisées à s'élever

Deux choses portent le même nom dans la documentation Supabase, et il faut les distinguer avant tout :

| Objet | Ce que c'est | Décision |
|---|---|---|
| **`SUPABASE_SECRET_KEY`** | Une **clé d'API HTTP** pour GoTrue (Auth) et Storage | **Conservée**, cantonnée à `apps/api` et au worker, uniquement pour : créer un utilisateur, gérer le second facteur, émettre une URL signée |
| **Le rôle Postgres `service_role`** | Un rôle **`BYPASSRLS`** : une clé passe-partout sur la base | **Refusé.** Il n'est utilisé nulle part |

> **CONSTAT BLOQUANT B2.** Le worker n'a pas besoin de **contourner** la RLS ; il a besoin de **droits
> explicites**. Utiliser `BYPASSRLS` pour une boucle de traitement de file, c'est donner un passe-partout
> pour ouvrir une porte dont on a la clé. Et un rôle `BYPASSRLS` employé à l'exécution rend
> **tous** les tests RLS facultatifs : il suffit d'un appel mal placé pour que la garantie disparaisse
> sans qu'aucun test ne rougisse.
>
> **Correctif exigé :** un rôle `influx_worker`, **sans `BYPASSRLS`**, avec des `GRANT` nommés table par
> table et des politiques `TO influx_worker` explicites. Le « contournement » devient alors **visible et
> relisible dans la migration**, table par table. **Règle absolue : aucun rôle utilisé à l'exécution
> n'a `rolbypassrls` ni `rolsuper`** — vérifié par un test (§8, T4).

**La liste fermée des opérations élevées.** Elles sont déclarées dans une union fermée de
`packages/contracts` et sont les seules à pouvoir appeler `withElevatedTransaction(reason, fn)`.
Toute autre opération privilégiée passe par une fonction `SECURITY DEFINER` (voir plus bas).

| # | Opération | Rôle utilisé | Motif | Appelable depuis une route HTTP ? |
|---|---|---|---|---|
| **E-1** | **Pré-authentification d'un demandeur non identifié.** Motifs : `identity.request_code` — émission d'un code à usage unique ; `support.report_delivery_issue` — canal de secours sans connexion (`05` RG65, J5), par une fonction `SECURITY DEFINER` étroite seulement ; `identity.read_published_terms` — lecture de la version en vigueur d'un document public (`05` RG25, RG27 ; `21` EC-62, à signer à la revue de fin de J5), par `identity.terms_in_force()` seulement ; `leads.receive_brevo_event` — ligne brute du webhook Brevo, par `leads.record_brevo_event()` seulement, famille `leads` liée au pool d'`apps/api` (J7 décision 2, signé par `expert-cybersecurite` le 2026-10-14, revue de fin de J7). **Exception nommée « membre authentifié »** (signée par `expert-cybersecurite` le 2026-10-14, revue du commit 7 du J7) : `identity.member_email_change` — journal P1 des deux codes d'un changement d'adresse (`auth.email_change_confirm_old` avec le compte, `…_new` avec l'adresse seule) et leurs issues `queued` ⇒ `sent` ou `failed`, rien d'autre (`0123`) ; appelant unique `email-change.ts` (T6) ; le journal des envois synchrones d'`apps/api` appartient à `influx_auth` seul (`0015`, D43), et ses droits ne s'élargissent plus sans nouvelle signature : un autre journal côté membre passe par une fonction `SECURITY DEFINER` qui lit le destinataire en base | `influx_auth` | Le demandeur n'est pas encore authentifié (sauf l'exception nommée) | **Oui**, seules routes concernées avec E-2 |
| **E-2** | **Vérification d'un facteur et écriture de ses effets.** Motifs : `identity.verify_code` — vérification du code d'un membre, compteurs, jeton d'inscription, session d'un compte existant ; `identity.complete_signup` — création du compte à la validation de l'écran 3 (`05` RG5, J5 ; `identity.provision_account`) et sa session ; `identity.backoffice_sign_in` — mot de passe et TOTP ou code de secours, session née en `aal2` ; `identity.backoffice_enroll_totp` — inscription du second facteur, codes de secours ; `identity.backoffice_reauthenticate` — ré-authentification R, fraîcheur écrite sur la ligne de session ; `identity.member_reauthenticate` — code frais d'un membre connecté, marqueur d'une finalité sur sa session (`05` RG57, J7 décision 4, signé par `expert-cybersecurite` le 2026-10-14, revue de fin de J7) | `influx_auth` | Le compte n'existe pas encore, ou la session à créer ou à rafraîchir ne peut pas l'être par le rôle de l'utilisateur sans lui donner le moyen de se forger une preuve | **Oui** |
| **E-3** | `leads.drain_outbox` — consommation de la file, appels Brevo et Apollo, mise à jour des statuts | `influx_worker` | Aucun utilisateur ne déclenche l'opération | **Non** |
| **E-4** | `maintenance.run_periodic` — péremption des badges, relances, purges, vérification de la chaîne, expiration des verrous et des codes ; *depuis le L2B (`0205`, motif `storage_purge`, signé par `expert-cybersecurite` le 2026-11-03, revue de fin de L2B)* : purge des objets du logo de marque et de l'usage quotidien du Storage, par les trois fonctions `ops.claim_storage_purges`, `complete_storage_purges` et `purge_storage_usage` seulement, jamais une ligne `active` ; *depuis le J9 (commit 8, `0147`, signé par `expert-cybersecurite` le 2026-10-27, revue de fin de J9)* : surveillance active de D60 — battement du worker, résultats de la sonde, relevé des connexions, lecture agrégée des mesures et états des alertes techniques (`15` RG165), par les fonctions de `ops` seulement, aucune ligne d'audit | `influx_worker` | Tâches de fond | **Non** |
| **E-5** | `privacy.execute_request` — export ou anonymisation au titre d'une demande RGPD validée | `influx_privacy` | Écritures transverses sur des lignes qui n'appartiennent pas à l'appelant | **Non** : déclenché par une tâche, après validation `2V` + `R` par un `admin`, **ou** après la double validation du membre pour son propre effacement (D72) |
| **E-6** *(signée par `expert-cybersecurite` le 2026-10-06, revue groupée de fin de J4, avec `0016`)* | `ops.record_telemetry` — surveillance interne D60 : groupes et occurrences d'erreurs, métriques par minute (`0016`), écrits **hors** de la transaction de l'utilisateur ; aucune lecture métier, aucune ligne d'audit (rien d'un sujet métier n'est écrit) ; *depuis le J9 (commit 8, `0147`, signé par `expert-cybersecurite` le 2026-10-27, revue de fin de J9)* : compteurs de signaux du webhook Brevo et surveillance du battement du worker (AL50, état de l'alerte sous verrou), toujours sans lecture métier | `influx_ops` | Une erreur doit pouvoir être enregistrée alors que la transaction de l'utilisateur a échoué, sans donner aux rôles métier le moindre droit sur `ops` | **Non** : vidage périodique en mémoire par `apps/api`, jamais dans une requête |

**Cinq entrées, pas une de plus.** Tout ajout à cette liste est une modification de ce document,
signée par `expert-cybersecurite`.

> **Lectures de l'écran « Santé technique » (`0148`, J9 commit 9, signées par `expert-cybersecurite`
> le 2026-10-27).** Ce ne sont **pas** des opérations élevées : cinq fonctions `STABLE SECURITY DEFINER`
> `backoffice.ops_*` (propriétaire `influx_maintenance_definer`, `EXECUTE` à `influx_admin` seul),
> appelées dans la session `admin` de la requête, non journalisées (état technique, aucune personne ;
> seul l'uuid d'un compte sort, l'identification passe par la fiche journalisée). Le propriétaire reçoit
> des lectures en colonnes sur `ops.error_groups`, `ops.error_occurrences` (message, pile, requête,
> compte, contenus déjà nettoyés par `scrub.ts`), `ops.probe_results` et `ops.probe_results_hourly`.
> Un commercial est refusé et journalisé (`ops.read_health`, CA63).

> **Révision signée par `expert-cybersecurite` le 2026-09-27 (EC-5 de `21` §3).** E-1 et E-2
> nommaient une seule opération chacune ; or le compte naît à l'écran 3 (`05` RG5), et le canal de
> secours, la connexion du backoffice, l'inscription du TOTP et la ré-authentification écrivent aussi
> hors de toute session utilisateur. Plutôt qu'une sixième entrée, chaque entrée se décline en
> **motifs nommés**, un par point d'usage, listés dans la colonne « Opération » ci-dessus. Règles :
> (1) chaque motif est une valeur distincte de l'union fermée de `packages/contracts`, refusée à
> l'exécution si elle est inconnue ; (2) chaque motif a son code d'audit `elevated.<motif>` (EC-36)
> et **son propre ensemble d'appelants**, vérifié par T6 ; (3) un motif ne crée ni rôle, ni grappe,
> ni variable : il reste lié au rôle et à la grappe de son entrée ; (4) tout nouveau motif est une
> modification de ce tableau, signée comme une nouvelle entrée ; (5) le motif
> `support.report_delivery_issue` n'accorde à `influx_auth` **aucun droit de table** sur la file du
> support : il écrit par une fonction `SECURITY DEFINER` étroite, sans lecture. Contrepartie
> assumée : `influx_auth` devient le rôle d'exécution le plus sensible ; ses droits sont nommés
> colonne par colonne et sa grappe n'exécute que des requêtes paramétrées. Détail :
> `21` §4, J3, « Arbitrages de sécurité du J3 ».

#### Les rôles Postgres — liste fermée *(tranché le 2026-09-26, EC-1 et EC-20 de `21` §3)*

**Principe : un rôle de connexion par rôle élevé, une variable d'environnement par rôle de
connexion, un service Railway par variable.** Un rôle de connexion ne possède rien et porte
`NOINHERIT` : hors d'une transaction qui a pris un rôle par `SET LOCAL ROLE`, il n'a **aucun droit**
(seule exception, nommée : `influx_app` et `identity.resolve_session`). Ainsi, une injection dans le
processus HTTP ne peut jamais emprunter les droits du worker, et une réponse Brevo ou Apollo mal
traitée par le worker ne peut jamais atteindre l'anonymisation transverse.

**Lot 0, créés par `0001` (J2)** — tous `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION` :

| Rôle | Connexion | Membre de | Qui l'emprunte, pour quoi | Variable, service |
|---|---|---|---|---|
| `influx_app` | `LOGIN NOINHERIT` | `influx_advertiser`, `influx_creator`, `influx_agent`, `influx_admin` — **et rien d'autre** — `WITH INHERIT FALSE, SET TRUE` | `apps/api`, `withUserTransaction`. **Unique droit propre** : `USAGE` sur `identity` et `EXECUTE` sur `identity.resolve_session()`, lecture minimale qui résout la session **avant** le `SET LOCAL ROLE` (NOINHERIT oblige) | `DATABASE_URL`, `api` |
| `influx_advertiser` · `influx_creator` · `influx_agent` · `influx_admin` | `NOLOGIN` | aucun | `SET LOCAL ROLE` par `withUserTransaction`, après lecture du rôle métier en base (P3) | — |
| `influx_auth_login` | `LOGIN NOINHERIT` | `influx_auth` **seul**, `WITH INHERIT FALSE, SET TRUE` | `apps/api`, `withElevatedTransaction` : E-1, E-2 | `AUTH_DATABASE_URL`, `api` |
| `influx_auth` | `NOLOGIN` | aucun | E-1, E-2 ; droits de table au J3 (`0012` à `0015`, `04` §12.10) | — |
| `influx_worker_login` | `LOGIN NOINHERIT` | `influx_worker` **seul**, `WITH INHERIT FALSE, SET TRUE` | worker, `withElevatedTransaction` : E-3, E-4 | `WORKER_DATABASE_URL`, `worker` |
| `influx_worker` | `NOLOGIN` | aucun | E-3, E-4 | — |
| `influx_audit_writer` | `NOLOGIN` | **aucun, et aucun membre** | Propriétaire de `audit.append()` ; `SELECT` et `INSERT` sur `audit.audit_events`, rien d'autre (P8) | — |
| `influx_session_resolver` | `NOLOGIN` | aucun, aucun membre | Propriétaire de `identity.resolve_session()` ; `SELECT` des seules colonnes nécessaires de `sessions`, `accounts`, `account_roles`, `agent_profiles`. **Aucune écriture** : c'est la seule fonction appelable avant la prise de rôle | — |
| `influx_identity_definer` | `NOLOGIN` | aucun, aucun membre | Propriétaire de `identity.grant_role()` (et, plus tard, des autres fonctions `SECURITY DEFINER` du domaine `identity`, et des portes membres qui écrivent le registre : *L2B, `0203`, EC-L2B-06-1* — `profiles.submit_own_advertiser_profile()`, `EXECUTE` à `influx_advertiser` seul, lecture des obligatoires et écriture de `status`, `submitted_at` sur la ligne de l'appelant ; *L2B, `0204`* — les cinq portes du logo (`profiles.begin_brand_logo_upload()`, `discard_brand_logo_upload()`, `fail_brand_logo_upload()`, `activate_brand_logo()`, `remove_own_brand_logo()`, `EXECUTE` à `influx_advertiser` seul), lecture et écriture des lignes `brand_logo_objects` et `storage_daily_usage` de l'appelant, lecture de `storage_quotas` ; signé par `expert-cybersecurite` le 2026-11-03, revue de fin de L2B ; *L2C, `0207`* — la soumission ouvre aussi l'entrée de la file 1 : `insert (account_id, kind)` et lecture de `id`, `account_id`, `kind`, `state` de `profiles.advertiser_review_entries` sur la ligne de l'appelant, lecture du délai de la file 1 et `EXECUTE` de `backoffice.business_deadline()` par le déclencheur de l'entrée ; *L2C, `0209`* — `profiles.submit_own_advertiser_revision()`, `profiles.record_own_advertiser_profile_change()` et `profiles.moderated_field_is_active()`, `EXECUTE` à `influx_advertiser` seul, plus `activate_brand_logo()`, `remove_own_brand_logo()` et `identity.update_own_account()` recréées : lecture du catalogue `moderated_fields`, dépôt et remplacement des révisions de l'appelant, retrait de son entrée ouverte, **jamais une décision** (les politiques refusent `approved`, `rejected`, `published`) ; *L2C, `0210` §8* — `backoffice.record_refused_action()` recréée avec le code `queue.claim_forced_release` ; **signé** par `expert-cybersecurite` le 2026-11-05, sous L2CS-3 ; *L2D, `0216` à `0218`* — `identity.provision_account()` recréée insère la vitrine d'un créateur (brouillon, alias tiré par `profiles.new_creator_alias()`, pays du compte) et, par déclencheur invoker, sa ligne d'identité vide ; propriétaire des dérivations du profil créateur (`profiles.refresh_creator_public_network()`, `refresh_creator_public_audience()`, des déclencheurs `derive_creator_public_network()`, `derive_creator_public_audience()`, `record_creator_metrics_history()`, `copy_creator_residence_country()`, aucun `EXECUTE`) et de la porte « Confirmer mes chiffres » `profiles.confirm_own_creator_figures()` (`EXECUTE` à `influx_creator` seul, ligne de l'appelant) : lecture des bornes de trois référentiels, des chiffres d'une ligne de réseau et de son audience exacte (jamais le handle, le pseudonyme, l'URL ni l'engagement), écriture des lignes dérivées `creator_public_networks` et `creator_public_audience`, des colonnes dérivées et de résidence de la vitrine (une ligne qui n'est pas celle de la session : la résidence seule, garde `guard_creator_public_profile_write()`), des trois métriques, de la source et de la date de la ligne de l'appelant, ajout à l'historique ; **jamais** `status`, `published_at`, `alias`, `public_ref`, une saisie du créateur ni un droit annonceur ; **signé** par `expert-cybersecurite` le 2026-11-06, revue de fin de L2D, sous L2DS-5 ; *L2E, `0222`* — les six portes de la marque vérifiée (`profiles.open_own_brand_verification()`, `save_own_brand_internal_details()`, `renew_own_brand_verification_code()`, `submit_own_brand_verification()`, `cancel_own_brand_verification()`, `read_own_brand_verification()`, `EXECUTE` à `influx_advertiser` seul, qui ne garde **aucun** droit sur le schéma `verification`) et `EXECUTE` des aides invoker de `influx_creator_verification_definer` (générateur de code, ouverture, code, soumission, annulation) : `USAGE` sur `verification`, lecture, ouverture d'un brouillon, `status`, `cancelled_at`, `closed_at` des demandes `brand_verified` de l'appelant, codes `domain` (émission, révocation), lecture de ses badges de marque, du délai de la file 4 et des quatre paramètres de RG22 et RG60, bloc interne `profiles.advertiser_internal_details` de l'appelant (lecture, écriture), file `verification.received` et `verification.code_issued` ; **aucun** droit sur `verification.evidence_files` ni Storage (EC-L2E-18) ; **à signer** par `expert-cybersecurite` à la revue de fin de L2E) ; droits limités à ce qu'elles écrivent | — |

**Propriétaire des schémas, tables, types et séquences : le rôle de migration** (`postgres` du
projet Supabase), joint uniquement par `DIRECT_DATABASE_URL`, en CI (CI-5). Pas de rôle
propriétaire dédié pour les tables : il n'ajouterait rien, `postgres` n'étant jamais un rôle
d'exécution. **`influx_service` n'existe pas** : supprimé, jamais créé.

**Créés plus tard, déjà nommés :**

| Rôle | Quand | Ce qu'il sera |
|---|---|---|
| `influx_ops` + `influx_ops_login` | J4, avec le schéma `ops` | Écriture seule sur `ops`, aucune lecture métier ; `OPS_DATABASE_URL`, `api` ; le worker écrit `ops` par des droits nommés d'`influx_worker`. **Entrée E-6 signée le 2026-10-06 avec `0016`** |
| `influx_leads_definer` | J6, avec `0111` | `NOLOGIN NOINHERIT`, aucun membre : propriétaire des quatre fonctions `SECURITY DEFINER` d'E-3 (`leads.claim_outbox_batch`, `begin_outbox_attempt`, `complete_outbox_attempt`, `recover_stale_outbox_lines`), `EXECUTE` à `influx_worker` **seul**, qui ne garde **aucun droit de table** ; droits colonne par colonne sur la file, les états de contact, le journal (insertion P1), les réglages du worker, le compte et le consentement (lecture). Distinct d'`influx_identity_definer` : aucun des deux ne prête ses droits à l'autre. *L2C, `0211`* : propriétaire de `leads.read_brevo_profile_decision()` (E-3, `EXECUTE` à `influx_worker` seul) : sur une ligne `profile.decision` de `brevo_transactional` en traitement pour ce worker, la décision de l'entrée nommée par la charge, son code de motif, le message de l'agent à la marque et la langue du compte ; `SELECT` (`id`, `account_id`, `state`, `rejection_reason_code`, `member_message`) sur `profiles.advertiser_review_entries`, politique limitée aux entrées décidées d'un compte non effacé, jamais le commentaire interne, l'agent ni le verrou. *L2C, `0212`* : propriétaire de `leads.read_brand_profile_attributes()` (E-3, `EXECUTE` à `influx_worker` seul) : sur une ligne `brevo_contact` ou `apollo_contact` en traitement pour ce worker, l'état, la complétude stockée, le secteur, la tranche de taille, le domaine, la première thématique et les marchés visés de la ligne vivante du profil de marque ; `SELECT` sur six colonnes de `profiles.advertiser_profiles`, sur (`account_id`, `slot`, `topic_code`) de `profiles.advertiser_topics` et (`account_id`, `slot`, `country_code`) de `profiles.advertiser_target_markets`, politiques limitées aux comptes non effacés, jamais l'interlocuteur, la présentation ni la raison sociale. **À signer par `expert-cybersecurite` à la revue de fin de J6 ; `0211` et `0212` : signé le 2026-11-05** |
| `influx_maintenance_definer` | J9, `0117` (création, E-4) ; `0148` ; L2B, `0205` | `NOLOGIN NOINHERIT`, aucun membre : propriétaire des fonctions `SECURITY DEFINER` d'E-4 (lectures `backoffice.ops_*` de l'écran « Santé technique », `0148`, voir ci-dessus ; *L2B, `0205`* — `ops.claim_storage_purges()`, `ops.complete_storage_purges()`, `ops.purge_storage_usage()`, `EXECUTE` à `influx_worker` **seul**, dans le run `storage_purge` ouvert de la tentative). Droits colonne par colonne : `profiles.brand_logo_objects` en `select`, `update`, `delete` (colonnes nommées, politiques dédiées) et `profiles.storage_daily_usage` en `select (usage_day)` et `delete` ; **jamais une ligne `active`** ni, depuis *L2C, `0209`*, `in_review` (politiques réduites à `pending`, `purging`). Distinct d'`influx_identity_definer`. **Signé par `expert-cybersecurite` le 2026-11-03, revue de fin de L2B** |
| `influx_intro_owner` | Lot 4 | Propriétaire des fonctions de révélation (§3.4) |
| `influx_privacy` + `influx_privacy_login` | **J8, `0136`** (avancée du Lot 5, porte de production) | E-5 ; `PRIVACY_DATABASE_URL`, second pool du processus `worker` (obligatoire en production). **Jamais ajouté à `influx_worker_login`** (vérifié par `0136` et T4.3). `influx_privacy` n'a **aucun droit de table** : `EXECUTE` sur ses fonctions seulement |
| `influx_privacy_definer` | **J8, `0136`** | `NOLOGIN NOINHERIT`, aucun membre : propriétaire des fonctions `SECURITY DEFINER` d'E-5 (`privacy.pending_work`, `execute_request`, `record_auth_user_deleted`, `complete_request`, `0137`) et de `leads.read_brevo_erasure_subject` (E-3, seul lecteur de l'adresse gardée jusqu'à la confirmation de Brevo) ; droits colonne par colonne, même modèle qu'`influx_leads_definer`. L'approbation 2V + R et le téléchargement par le membre appartiennent à `influx_identity_definer` (EC-J8-36). *L2C, `0207`* : export et effacement des examens de la marque (lecture sans commentaire interne, agent ni verrou ; `delete` des révisions et `update` de `state`, `closed_at`, `member_message`, `internal_comment` sur un compte effacé seulement). *L2D, `0219`* : export et effacement du profil créateur (catégorie `creator_profile`, 15 catégories) : lecture des quinze tables `profiles.creator_%` (jamais `public_ref`) ; sur un compte effacé seulement, `delete` des cinq listes, de `creator_public_networks`, `creator_public_audience`, de l'audience exacte, des secteurs refusés et de l'historique, `update` qui vide la vitrine (gardée : clés, alias, pays ; `suspended`, non cherchable), l'identité et les lignes de réseau (handle, pseudonyme, URL, chiffres, date), chaque politique `with check` n'acceptant que la ligne vidée ; jamais d'insertion, ni clé, alias, pays, réseau ou source ; ses écritures ne déclenchent aucune dérivation (`0218`) ; **signé** par `expert-cybersecurite` le 2026-11-06, revue de fin de L2D. *L2E, `0226`* : export et effacement de la vérification (clé `verification` dans `creator_profile` et `advertiser_profile`, 15 catégories inchangées) : `USAGE` sur `verification` ; lecture des demandes, des badges et du bloc interne de la marque, jamais un code, un constat (handle, référence, domaine), un agent, le verrou, le commentaire interne, une valeur déclarée à la décision, la clé ni l'empreinte d'une pièce ; sur un compte effacé seulement, `update` qui annule les demandes ouvertes et vide message, commentaire interne et verrou, `delete` des codes et du bloc interne, `update` qui retire les badges tenants (`account_closed`) et vide handle (`[deleted]`) et référence, pièces `pending` et `active` en `purging` ; jamais d'insertion ; décisions et badges gardés 3 ans sous forme pseudonyme (`08` Q2) ; à signer par `expert-cybersecurite` à la revue de fin de L2E. **À signer par `expert-cybersecurite` à la revue du commit 8 du J8, `0207` : signé le 2026-11-05** |
| `influx_moderation_definer` | **L2C, `0210`** (`l2c/file.md` A5) | `NOLOGIN NOINHERIT`, aucun membre : propriétaire des sept fonctions `SECURITY DEFINER` de la file 1 (`profiles.open_advertiser_review_entry()`, `release_advertiser_review_entry()`, `extend_advertiser_review_claim()`, `force_release_advertiser_review_claim()`, `publish_advertiser_review_entry()`, `reject_advertiser_review_entry()`, et, depuis `0213`, `read_advertiser_review_logo()`, lecture journalisée d'un logo), `EXECUTE` à `influx_agent` et `influx_admin`, l'appelant contrôlé dans la fonction (actif, `aal2`, admin pour la levée forcée). Droits colonne par colonne : lecture de ce que hache le jeton (profil, huit listes, interlocuteur, logos, révisions, pays du compte), de la clé et des métadonnées d'un logo (`0213`, aucun droit sur Storage) et du compte interne de l'appelant ; écriture du verrou, de la levée et de la décision de l'entrée, de `approved` ou `rejected` des révisions, de `status`, `first_published_at` et des cinq colonnes modérées du profil, de `state`, `activated_at`, `purge_requested_at` d'un logo ; insertion de `profile.decision`, `profile.completed` et `lead.updated` dans la file ; `audit.append()`. Ses politiques écartent le compte de l'appelant (C(3)). *L2C fix-2, `0215`* : lecture de `identity.accounts.owner_agent_id` ; ouvrir (entrée ouverte), publier, refuser, prolonger et lire un logo refusent en 42501 le compte que l'appelant **détient** (`15` RG36), la relâche et la levée restent ; l'ouverture verrouille la ligne du profil avant l'entrée (L2CS-1). Distinct d'`influx_identity_definer`, borné à la ligne de l'appelant : réunis, une porte membre atteindrait la publication (RG6). **Signé** par `expert-cybersecurite` le 2026-11-05 (`0210`, `0211`, `0213`, `0215`), sous L2CS-1, soldé par `fix-2`, et L2CS-2 ; `0215` : relecture courte avant `production` (`21` §8) |
| `influx_creator_verification_definer` | **L2E, `0222`** (`l2e/modele.md` §1 point 3) | `NOLOGIN NOINHERIT`, aucun membre : propriétaire des quatre portes `SECURITY DEFINER` du créateur (`verification.open_own_request()`, `renew_own_code()`, `submit_own_request()`, `cancel_own_request()`, `EXECUTE` à `influx_creator` seul, compte et rôle lus du contexte), du déclencheur `verification.cancel_open_requests_of_line()` (ligne de réseau supprimée : demandes ouvertes annulées, jamais sur l'effacement ; aucun `EXECUTE`), du générateur `verification.new_ownership_code()` et des quatre aides invoker partagées avec les portes marque (`open_request_of()`, `issue_ownership_code()`, `submit_request_of()`, `cancel_request_of()`, `EXECUTE` à `influx_identity_definer` seul). Droits colonne par colonne, politiques bornées au compte de la session et à la population `creator` : compte et rôle de l'appelant, ses lignes de réseau (identifiant, réseau), lecture, ouverture d'un brouillon, `status`, `cancelled_at`, `closed_at` de ses demandes, codes `network` (émission, révocation), état de ses badges et de ses pièces (jamais la clé ni l'empreinte), délai de la file 4 et quatre paramètres de RG22 et RG60, file `verification.received` et `verification.code_issued`, `audit.append()`. Distinct d'`influx_verification_definer` (`0224`, décisions et lecture des pièces) et d'`influx_identity_definer` (portes marque) : aucun ne prête ses droits à l'autre. **À signer** par `expert-cybersecurite` à la revue de fin de L2E |

**Règles d'écriture de `0001`, exigées :**

1. **Création idempotente, attributs imposés.** Les rôles sont des objets **de la grappe**, pas de
   la base : `create role` dans un bloc qui tolère l'existence, **suivi d'un `alter role` qui
   réimpose tous les attributs** (`NOLOGIN` ou `LOGIN`, `NOINHERIT`, `NOBYPASSRLS`, `NOSUPERUSER`…).
   Un rôle préexistant qui porterait `BYPASSRLS` est ainsi corrigé, pas hérité.
2. **Appartenances exactes.** L'ensemble **transitif** des appartenances de chaque rôle de
   connexion est **égal** à sa ligne ci-dessus : aucun n'est membre de `postgres`, `service_role`,
   `authenticated`, `anon`, `pg_read_all_data`, `pg_write_all_data` ni d'un rôle `supabase_*`. Syntaxe
   `WITH INHERIT FALSE, SET TRUE` (PostgreSQL ≥ 16) : `0001` **échoue** si `server_version_num < 160000`.
3. **`REVOKE ALL` sur chacun de nos schémas** — et sur tout ce qu'il contient, avec les
   `ALTER DEFAULT PRIVILEGES` cohérents — **à `PUBLIC`, `anon`, `authenticated` et `service_role`.**
   `service_role` porte `BYPASSRLS` et répond à `SUPABASE_SECRET_KEY` : sans ce `REVOKE`, une
   exposition accidentelle d'un schéma à l'API de données rendrait la clé d'`apps/api` suffisante
   pour tout lire. Aucun rôle d'exécution n'a `CREATE` sur un schéma.
4. **`EXECUTE` des fonctions.** Postgres l'accorde à `PUBLIC` à la création, et un
   `ALTER DEFAULT PRIVILEGES … IN SCHEMA` **ne peut pas retirer** un droit par défaut global : il faut
   un `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` **global**,
   en plus du `REVOKE` explicite après chaque `create function` (règle 2 ci-dessous).
5. **Aucun mot de passe dans une migration.** Posé par environnement, par script, à partir d'un
   secret, **sous forme de vérificateur SCRAM-SHA-256 calculé côté client** — jamais en clair dans
   une instruction SQL, qui peut finir dans le journal de Postgres. Au moins 32 octets aléatoires,
   distincts par rôle et par environnement ; mots de passe fixes réservés à la pile locale et à la CI.
6. **Bornes sur les rôles de connexion** : `CONNECTION LIMIT`, `statement_timeout`,
   `idle_in_transaction_session_timeout` (valeurs : `architecte`).

**Règles de `withUserTransaction` et `withElevatedTransaction` (`apps/api/src/db/index.ts`), exigées :**

1. **Le multiplexeur (Supavisor) en mode transaction (port 6543) est le seul chemin d'exécution**,
   utilisateur `<rôle>.<référence du projet>`, `prepare: false`, **TLS avec vérification du
   certificat** (autorité de Supabase) — jamais `rejectUnauthorized: false`.
2. **Aucun état de session.** Seuls `SET LOCAL` et `set_config(…, true)`. `SET ROLE` sans `LOCAL`,
   `RESET ROLE`, `set_config(…, false)`, `LISTEN`, verrous consultatifs de session : **interdits**,
   par une garde statique sur `src/db/`. Motif : en mode transaction, un `SET ROLE` de session
   **survit sur la connexion serveur et s'applique à la transaction d'un autre utilisateur** — une
   fuite entre comptes, sans symptôme.
3. **Garde d'entrée de transaction** : la première instruction vérifie
   `current_user = session_user = <rôle de connexion attendu>` ; sinon annulation, connexion
   détruite, ligne `error` sans donnée, alerte.
4. **Le nom de rôle du `SET LOCAL ROLE` vient d'une table constante du code** (rôle métier →
   identifiant), jamais d'une interpolation de valeur lue en base ou reçue.
5. **Chaque opération élevée est liée à sa grappe** (E-1, E-2 → `AUTH_DATABASE_URL` ; E-3, E-4 →
   `WORKER_DATABASE_URL` ; E-5 → `PRIVACY_DATABASE_URL`, J8) ; un processus ne configure que les grappes de ses opérations.
6. **À l'ouverture de chaque grappe**, contrôle en base de `current_user` et de l'absence de
   `rolsuper` / `rolbypassrls` : **refus de démarrer** sinon (T4 en production, pas seulement en CI).
7. **La CI passe par le multiplexeur local en mode transaction** (`[db.pooler]` de
   `supabase/config.toml`), pour que les tests suivent le chemin de production — à confirmer par
   `integrateur`.

**Pourquoi `SECURITY DEFINER` est préférable à l'élévation pour tout le reste.** Une fonction
`SECURITY DEFINER` est **étroite** (une opération, des paramètres fixes), elle peut **vérifier
elle-même** l'identité et les droits de son appelant, elle **journalise**, et elle n'est pas
détournable vers un autre usage. Une transaction élevée est un chèque en blanc.

Règles obligatoires pour toute fonction `SECURITY DEFINER`, sans exception :

```sql
create function messaging.read_conversation(
        p_conversation_id uuid,
        p_channel         messaging.message_channel,   -- D47 : un canal par appel
        p_context         text)
  returns setof messaging.messages
  language plpgsql
  security definer
  set search_path = ''        -- OBLIGATOIRE : sinon détournement par search_path
  stable                       -- ou volatile si elle écrit, jamais dans une politique
as $$ … $$;

revoke execute on function messaging.read_conversation(uuid, messaging.message_channel, text) from public;
grant  execute on function messaging.read_conversation(uuid, messaging.message_channel, text)
  to influx_agent, influx_admin;
```

1. `SET search_path = ''` et **tous les objets qualifiés par leur schéma**. Sans cela, un objet créé
   par un rôle malveillant dans un schéma prioritaire détourne la fonction. C'est la vulnérabilité
   classique de `SECURITY DEFINER`, et elle est systématiquement oubliée.
2. `REVOKE EXECUTE ... FROM PUBLIC` puis `GRANT` nominatif. Par défaut, **tout le monde peut exécuter
   une fonction** : ne pas révoquer revient à publier l'opération.
3. La fonction **vérifie elle-même** le rôle, l'`aal` et l'état de suspension de l'appelant.
4. Elle n'est **jamais propriétaire de la table d'audit** qu'elle alimente — elle appelle
   `audit.append(...)`.
5. *Ajoutée le 2026-09-26 (EC-1).* **Elle n'appartient jamais au rôle de migration.** Sur Supabase,
   `postgres` porte `BYPASSRLS` : une fonction `SECURITY DEFINER` qui lui appartient contourne toute
   la RLS et presque tous les `GRANT`. Son propriétaire est un rôle `NOLOGIN` dédié, **sans aucun
   membre**, aux droits limités à ce que la fonction lit et écrit (liste fermée ci-dessus). Le
   changement de propriétaire exige que le nouveau rôle ait `CREATE` sur le schéma : la migration
   l'accorde, fait `ALTER FUNCTION … OWNER TO`, puis le **retire** dans la même migration. Une fonction
   qui ne fait que lire le contexte de transaction (`influx.current_account_id()`, `current_aal()`…)
   est `SECURITY INVOKER`.

### P8 — L'append-only est réel, pas conventionnel

Quatre couches, parce que chacune protège d'un scénario différent :

```sql
-- 1) Le droit n'existe pas
revoke update, delete, truncate on audit.audit_events from public;
revoke update, delete, truncate on audit.audit_events
  from influx_app, influx_advertiser, influx_creator, influx_agent, influx_admin,
       influx_auth, influx_worker;
-- influx_audit_writer : NOLOGIN, aucun membre, propriétaire de audit.append() (P7, liste fermée)
grant  select, insert            on audit.audit_events to influx_audit_writer;

-- 2) Le déclencheur protège d'une migration distraite qui redonnerait le droit
create function audit.deny_mutation() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'audit.audit_events is append-only (attempted %)', tg_op
    using errcode = 'insufficient_privilege';
end $$;

create trigger audit_events_no_update_delete
  before update or delete or truncate on audit.audit_events
  for each statement execute function audit.deny_mutation();
```

3. **Chaînage par empreinte** : empreinte du contenu, empreinte de la ligne précédente, séquence
   monotone. Les écritures sont **sérialisées** par un verrou consultatif **de transaction** sur une
   clé constante par chaîne (les verrous de session ne survivent pas au multiplexeur, cf.
   `02-architecture` §5). L'algorithme et le format relèvent d'`expert-database`.
4. **Vérification nocturne** de la chaîne, avec alerte immédiate sur rupture ou trou de séquence.
   Une chaîne jamais vérifiée n'est pas une chaîne (`01-intermediation-courtee.md` §M4, point 4).

**Ce que l'append-only ne protège pas, et il faut le dire.** Le propriétaire de la table peut
désactiver un déclencheur, redonner un droit, ou supprimer la table. Deux conséquences opérationnelles :

- **Aucun rôle utilisé à l'exécution ne possède les tables d'audit.** Le propriétaire est un rôle de
  migration, utilisé uniquement par la CI avec `DIRECT_DATABASE_URL`.
- **Toute migration touchant `audit.*`, une politique, un `GRANT`, un `REVOKE`, une fonction
  `SECURITY DEFINER` ou un attribut de rôle doit être vue par `expert-cybersecurite`.** Or la
  dérogation du fondateur du 2026-09-17 supprime les Pull Requests. Parade proportionnée, sans
  revenir sur la dérogation (§9, constat I-4) : un contrôle de CI qui **échoue** quand un fichier de
  `supabase/migrations/**` contient l'un de ces motifs, sauf si le message de commit porte le
  marqueur `security-reviewed: <date>`. Coût : deux heures.
- **Publication externe de l'empreinte de tête** (Important, §9) : une preuve auto-produite vaut par
  sa cohérence avec des éléments détenus par des tiers (`01-intermediation-courtee.md` §M4). Envoyer
  chaque nuit, par e-mail transactionnel, l'empreinte de tête de la chaîne et le numéro de séquence
  place une copie horodatée hors de toute base que nous administrons. Coût : une demi-journée.

Les mêmes règles s'appliquent à `introduction_events`, `conversation_access_log`,
`terms_acceptances` et à l'historique des modifications de montants.

### P9 — Ce que la RLS ne sait pas faire, et qui le fait à sa place

| Besoin | Pourquoi la RLS ne suffit pas | Qui le fait |
|---|---|---|
| Journaliser une lecture | Une politique **autorise**, elle n'écrit pas. Une expression `USING` doit être sans effet de bord ; Postgres l'évalue un nombre de fois indéterminé | Fonction `SECURITY DEFINER` (§5) |
| K-anonymat, pagination plafonnée, limitation de débit, export interdit, journalisation des recherches | Règles sur la **forme et la fréquence** des requêtes, pas sur les lignes | `apps/api`, domaine `search` |
| Transitions d'une machine à états | Une politique ignore l'état antérieur | `CHECK` + déclencheur + `packages/domain` |
| Consentement revérifié au moment de l'envoi | Le consentement n'est pas une propriété de la ligne d'événement | Worker (§3.5, C(35)) |
| Le Storage | **Une URL signée contourne les politiques par conception** | `apps/api` décide avant d'émettre, journalise, borne la durée (§6.6) |
| Validation des montants | Une contrainte ne sait pas si un montant est vraisemblable | `apps/api` + `CHECK` (§3.5, C(29)) |

### P10 — Les politiques du Storage

1. **Tous les compartiments sont privés.** Aucun compartiment public, jamais, quelle que soit la
   justification. Un test vérifie `storage.buckets.public = false` pour tous (§8, T9).
2. **Un compartiment par classe de sensibilité**, parce que les limites de type et de taille sont des
   propriétés du compartiment : `brand-logo` (L2B, D80 : logo de marque, sortie ré-encodée par `apps/api`, WebP, ≤ 1 Mio, privé), `portfolio` (visuels modérés, visibles des annonceurs après
   modération) et `verification` (pièces d'audience, **jamais visibles d'un annonceur**).
3. `allowed_mime_types` et `file_size_limit` **réglés au niveau du compartiment** : c'est la seule
   limite réellement appliquée par Supabase au moment du téléversement direct. Un contrôle fait
   uniquement dans `apps/api` avant l'émission de l'URL ne contraint pas ce que le navigateur envoie
   ensuite.
4. **Le chemin de l'objet est calculé par `apps/api`**, jamais fourni par le client :
   `<compartiment>/<uuid-du-propriétaire>/<uuid-aléatoire>.<extension>`. **Jamais le nom de fichier
   d'origine** : `story-marie-dupont-instagram.png` révèle exactement ce que A2 protège, et un nom de
   fichier voyage dans les URL signées, les journaux et les en-têtes `Referer`.
5. **Après téléversement, avant référencement** : `apps/api` ou le worker vérifie les octets d'en-tête
   (le type réel, pas le type déclaré), les dimensions, et **ré-encode les images de portfolio pour
   supprimer les métadonnées EXIF**. Une capture d'écran de téléphone contient fréquemment la
   géolocalisation : c'est une dé-anonymisation directe, et personne n'y pense.
6. **Politiques sur `storage.objects`** alignées sur celles des tables correspondantes, pour le cas
   où un chemin d'accès autre que l'URL signée existerait un jour.
7. **Quotas par compte** (nombre et volume par jour). Sans quota, un stockage privé reste un
   hébergement gratuit et un canal d'exfiltration.

---

## 5. La lecture d'une conversation par un agent non participant

C'est le point où A10 se joue, et c'est aussi le point le plus facile à rendre décoratif sans s'en
apercevoir.

### 5.1 Pourquoi une politique RLS ne suffit pas — trois raisons, pas une

1. **Une politique autorise ou refuse ; elle n'écrit pas.** Une expression `USING` doit être sans
   effet de bord. Techniquement, on pourrait y glisser une fonction `VOLATILE` qui écrit ; ce serait
   une faute grave, pour la raison suivante.
2. **Le nombre d'évaluations est indéterminé.** Le planificateur évalue le prédicat par ligne
   examinée, peut le remonter, l'inliner, le mettre en cache, ou ne pas l'évaluer du tout s'il prouve
   qu'il n'en a pas besoin. Un journal alimenté par une politique produirait donc **soit une ligne par
   message parcouru, soit aucune** — c'est-à-dire un journal faux. Un journal faux est pire qu'un
   journal absent : il donne une réponse à une question de confiance, et cette réponse est fausse.
3. **Une politique ne connaît pas le geste métier.** « Quel écran », « dans quel contexte », « à la
   suite de quelle décision » ne sont pas des propriétés de la ligne lue. Or c'est exactement ce que
   les CGU promettent de tracer.

### 5.2 Le mécanisme retenu

**Toutes les lectures de messages par un rôle `agent` ou `admin` passent par la fonction, participant
ou non.**

C'est une simplification volontaire par rapport au document `02`, et elle est meilleure : distinguer
« participant » de « non participant » au moment de la lecture crée une branche qui finira par être
mal évaluée (le commercial responsable change, un agent rejoint le fil, une réattribution a lieu). La
fonction enregistre la qualité de participant **au moment de la lecture** comme une donnée du journal,
et non comme une condition d'accès. Une règle sans exception est une règle qu'on peut tester.

```sql
-- 1) Aucun autre chemin de lecture pour les rôles internes. C'est CE revoke qui fait la garantie.
revoke select on messaging.messages, messaging.conversations
  from influx_agent, influx_admin;

-- 2) Le seul chemin
create function messaging.read_conversation(
        p_conversation_id uuid,
        p_channel         messaging.message_channel,  -- D47 : OBLIGATOIRE, aucune valeur par défaut
        p_context         text,          -- écran d'origine, liste fermée
        p_cursor          timestamptz default null,
        p_limit           int         default 50)
  returns setof messaging.messages
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_account uuid := influx.current_account_id();
  v_role    text := influx.current_account_role();
  v_is_part boolean;
begin
  if v_role not in ('agent','admin') or influx.current_aal() <> 'aal2' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if influx.is_suspended(v_account) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  select exists (select 1 from messaging.conversation_participants p
                  where p.conversation_id = p_conversation_id
                    and p.account_id      = v_account
                    and p.left_at is null)
    into v_is_part;

  perform audit.append(
    'messaging.conversation_read',
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'channel',         p_channel,          -- D47 : une ligne de journal par canal lu
      'account_id',      v_account,
      'role',            v_role,
      'is_participant',  v_is_part,
      'context',         p_context,
      'request_id',      current_setting('influx.request_id', true),
      'cursor',          p_cursor,
      'limit',           p_limit));

  return query
    select m.* from messaging.messages m
     where m.conversation_id = p_conversation_id
       and m.channel         = p_channel     -- D47 : jamais deux canaux dans un même appel
       and (p_cursor is null or m.created_at < p_cursor)
     order by m.created_at desc
     limit least(p_limit, 100);
end $$;

revoke execute on function
  messaging.read_conversation(uuid, messaging.message_channel, text, timestamptz, int) from public;
grant  execute on function
  messaging.read_conversation(uuid, messaging.message_channel, text, timestamptz, int)
  to influx_agent, influx_admin;
```

**Le point qui fait toute la garantie est le `REVOKE` de la ligne 2, pas la fonction.** Sans lui, il
reste un chemin de lecture non journalisé, et A10 devient une promesse invérifiable. C'est la
première chose que je vérifierai à la revue du Lot 4, et c'est un test de CI (§8, T5).

**Ce que le journal contient — et ce qu'il ne contient pas.** Qui, quand, quelle conversation, quel
écran, participant ou non, identifiant de requête, bornes de pagination. **Jamais le contenu d'un
message**, jamais un extrait, jamais un aperçu. Journaliser l'accès, pas la donnée (`CLAUDE.md` §6).

**Une ligne par appel**, sans regroupement ni temporisation. Au volume du pilote (quelques centaines
de lectures par jour), l'économie de lignes ne vaut pas la perte de précision. Un `read_session_id`
permet de regrouper à l'affichage.

**Un canal par appel (D47, révision du 2026-09-24).** Le canal est un paramètre **obligatoire**, sans
valeur par défaut, et la fonction ne sert que lui. Il n'existe donc **aucun appel qui renvoie deux
canaux** : un agent non participant qui instruit un signalement sur le fil commun ne charge pas les
apartés par effet de bord, et s'il ouvre ensuite un aparté, le journal le dit par une seconde ligne
portant ce canal (`12` RG132, CA68). La lecture d'un aparté par un non-participant est la lecture la
plus sensible du produit ; la revue X4 l'isole (`12` RG134, index partiel de `04` §5.7.1).

**Anti-abus de la fonction elle-même :** une conversation par appel, pas de variante en lot, pas de
recherche plein texte transverse au MVP, limitation de débit par compte agent, et **alerte au-delà
d'un seuil de conversations distinctes ouvertes par un même agent sur 24 h** (seuil à régler au Lot 4
avec `product-owner`, ordre de grandeur : 40).

### 5.3 Le contrôle croisé — comment détecter un écart entre lectures effectives et lectures journalisées

Quatre contrôles, du plus fort au plus souple. Les deux premiers sont exigibles au Lot 4 ; les deux
autres sont des filets.

| # | Contrôle | Ce qu'il détecte | Quand |
|---|---|---|---|
| **X1** | **Contrôle de privilège en CI.** Assertion `has_table_privilege('influx_agent','messaging.messages','SELECT') = false`, idem pour `influx_admin`, idem sur `messaging.conversations` | **Le rétablissement d'un chemin non journalisé** — c'est-à-dire le scénario réaliste : un `GRANT` ajouté dans une migration pour « débloquer » un écran | À chaque exécution de la CI |
| **X2** | **Contrôle d'unicité du chemin applicatif.** Test statique : la chaîne `messaging.messages` n'apparaît que dans un fichier `repository.ts` et dans la liste fermée des fonctions SQL déclarées | Une seconde fonction `SECURITY DEFINER` qui lirait les messages sans journaliser | À chaque exécution de la CI |
| **X3** | **Contrôle croisé statistique nocturne.** Le worker compare, sur 24 h glissantes, le nombre d'exécutions relevées par `pg_stat_statements` pour les requêtes portant sur `messaging.messages` (identifiants de requête relevés une fois et figés) avec le nombre de lignes de `conversation_access_log` **plus** le nombre de lectures de participants membres sur la même fenêtre. Rapport attendu : 1 pour 1, aux requêtes de maintenance près, elles-mêmes identifiées et exclues. Écart au-delà d'un seuil ⇒ **alerte** | Une lecture passée par un chemin que ni X1 ni X2 n'ont vu — par exemple un accès direct depuis le tableau de bord Supabase | Chaque nuit |
| **X4** | **Revue humaine hebdomadaire.** Le backoffice affiche le classement des agents par nombre de conversations distinctes lues sur 7 jours, dont celles où ils ne sont pas participants | L'abus de droit : un agent qui lit systématiquement les fils des autres. Aucun contrôle technique ne le détectera, parce qu'il est **autorisé** à le faire | Chaque semaine |

**Honnêteté sur X3 :** `pg_stat_statements` agrège par requête normalisée et ne survit ni à un
redémarrage ni à une réinitialisation. Il ne donne pas une preuve, il donne un **signal de
divergence**, et c'est déjà beaucoup. La garantie dure, c'est X1.

**Honnêteté sur l'ensemble :** aucun de ces contrôles n'empêche un administrateur du projet Supabase
de lire les messages depuis l'éditeur SQL du tableau de bord, sans laisser de trace dans notre
journal. Ce point remonte au fondateur (§10).

---

## 6. Réponse aux neuf points du §14.1 de `02-architecture-3-espaces.md`

### 6.1 — Point 1 : D37 dans son ensemble

#### Membres : code à 6 chiffres par e-mail, sans mot de passe

**Verdict : VALIDÉ SOUS CONDITIONS, avec une clause de caducité.**

**Pourquoi je valide.** Le raisonnement produit d'`architecte` est juste : le code retapé dans
l'onglet d'origine fonctionne sur mobile là où le lien magique casse, il vérifie l'adresse par
construction (ce dont le Lot 1 a besoin pour Brevo et Apollo), et il supprime le secret durable —
donc le bourrage d'identifiants, la réutilisation de mots de passe, les fuites de base de mots de
passe et tout le parcours de réinitialisation, qui est historiquement **le** vecteur de prise de
contrôle de compte. On échange un risque connu et fréquent contre un risque connu et rare.

**Et surtout, le facteur décisif que je veux voir écrit noir sur blanc : au MVP, un compte membre ne
contient aucun moyen de paiement.** Pas d'IBAN, pas de carte, pas de coordonnées bancaires (A1 :
contrat et paiement hors application). Un compte compromis expose des données personnelles et des
conversations commerciales — c'est sérieux, ce n'est pas un vol d'argent. C'est ce déséquilibre qui
rend l'absence de second facteur proportionnée.

> **CLAUSE DE CADUCITÉ.** Cette validation **tombe automatiquement** à l'introduction, en V2, de
> coordonnées bancaires, d'un encaissement ou d'un reversement (D8, D9). À ce moment-là, **un second
> facteur devient obligatoire côté membres**, au minimum pour les créateurs. Ce n'est pas négociable
> et ce n'est pas un nouvel arbitrage : c'est la condition sous laquelle j'accorde celui-ci.

**Conditions — toutes exigibles au Lot 0 ou au Lot 1 :**

| # | Condition | Pourquoi |
|---|---|---|
| **A-1** | **Un seul code valide à la fois par compte.** Toute nouvelle demande invalide immédiatement le code précédent | C'est la condition la plus souvent oubliée. Dix codes valides simultanément multiplient par dix la probabilité de réussite d'un tirage au sort |
| **A-2** | **Durée 10 min, 5 tentatives par code**, puis invalidation du code (pas du compte) | 5 essais sur 10⁶ combinaisons = 1 chance sur 200 000 par code. Acceptable |
| **A-3** | **Limitation de débit à trois niveaux :** par adresse (3 demandes / 15 min, 10 / h), par IP (20 demandes et 20 échecs de vérification / h), **et globale sur le taux d'échec de vérification** | Le risque réel n'est pas l'attaque sur un compte, c'est le **tir groupé** : demander des codes pour 10 000 adresses et tenter `000000` sur chacune donne ≈ 5 % de chances d'obtenir un compte. Seule la limite par IP et la surveillance globale l'arrêtent |
| **A-4** | **Le blocage vise l'attaquant, jamais la victime.** Un excès de *demandes* ne verrouille jamais un compte ; il limite l'envoi. Le dernier code valide reste valide | Sinon on offre un déni de service : il suffit de demander des codes en boucle pour empêcher quelqu'un de se connecter |
| **A-5** | **Réponse strictement identique**, en contenu **et en temps de réponse**, que l'adresse existe ou non. Les champs d'inscription complémentaires sont demandés **après** la vérification du code, dans tous les cas | Le flux unique inscription/connexion supprime naturellement l'énumération — à condition de ne pas la réintroduire au second écran |
| **A-6** | **Phrase de correspondance anti-hameçonnage.** L'écran qui demande le code affiche deux ou trois mots ; l'e-mail affiche les mêmes. L'utilisateur vérifie qu'ils correspondent | Contre l'attaque réaliste : un site contrefait déclenche l'envoi d'un vrai code et demande à la victime de le saisir. La phrase de correspondance ne coûte rien et casse l'attaque |
| **A-7** | **Le code n'apparaît jamais dans l'objet de l'e-mail** et l'e-mail ne contient **aucun lien de connexion** | Un objet d'e-mail s'affiche sur un écran verrouillé et dans les aperçus. Et un lien cliquable ramène tous les défauts du lien magique qu'on a écartés |
| **A-8** | L'e-mail indique explicitement : **« INFLUX ne vous demandera jamais ce code »**, l'heure de la demande et le contexte (navigateur, pays approximatif) | Rend l'ingénierie sociale visible par la victime |
| **A-9** | **Le cookie de session porte un identifiant opaque, jamais un JWT autoportant.** La session est une ligne en base avec `revoked_at` | **BLOQUANT (B4).** Un jeton autoportant ne se révoque pas avant expiration. Sur une plateforme où l'on suspend des comptes et où le rôle est lu en base pour cette raison même, laisser la session survivre à la suspension serait incohérent |
| **A-10** | **Re-authentification par un nouveau code** pour trois actions : changer l'adresse e-mail, exporter ses données, supprimer son compte. *Preuve (définitive, `expert-cybersecurite`, revue de fin de J7, 2026-10-14) :* marqueur lié à la session **de la requête** (claim `session_id`, `influx.current_session_id()` ; *J9, J7S-1, `0144` : jamais une autre session ouverte du même compte*) et à la finalité, à usage unique, valable 300 s, consommé dans la transaction de l'action (`05` RG57) | Ce sont les trois actions qu'un attaquant ayant un accès temporaire à la boîte voudrait faire |
| **A-11** | **Le changement d'adresse exige une confirmation depuis l'ancienne ET la nouvelle adresse** | Sans cela, dix minutes d'accès à la boîte suffisent à s'approprier le compte **définitivement** |
| **A-12** | **Notification par e-mail de toute connexion depuis un nouvel appareil**, et écran « mes sessions actives » avec déconnexion globale | Faible (la notification part dans la boîte compromise), mais c'est la seule trace que la victime peut voir a posteriori. Coût minime |

**Le risque assumé, dit franchement : si la boîte e-mail est compromise, le compte est compromis.**
Il faut le dire, mais aussi le relativiser correctement : **avec un mot de passe, une boîte compromise
permet de réinitialiser le mot de passe, donc le résultat est le même.** Le mot de passe déplace le
problème, il ne le résout pas. Ce que le mot de passe apporterait réellement, c'est une barrière
contre un accès **temporaire et silencieux** à la boîte — l'assistante qui a une délégation sur
`contact@marque.com`, l'ordinateur familial partagé, la boîte générique d'entreprise. Ces situations
sont réelles côté marques. Les conditions A-10, A-11 et A-12 les couvrent partiellement ; le reste est
un **risque à surveiller**, documenté, et il est levé pour les comptes qui comptent vraiment — les
comptes internes — par le TOTP obligatoire.

**Le risque de disponibilité** (délivrabilité = disponibilité du produit) est correctement identifié
par `architecte` et relève de lui et d'`integrateur` : SPF, DKIM, DMARC bloquants au Lot 1, flux
transactionnel séparé du flux marketing chez Brevo, surveillance du délai de délivrance.

#### Backoffice : mot de passe + TOTP obligatoire

**Verdict : VALIDÉ.** C'est la bonne décision, et je n'accepterais rien de moins sur une surface qui
voit toutes les identités et toutes les conversations du produit.

Conditions de mise en œuvre :

| # | Condition |
|---|---|
| **B-1** | Mot de passe : **12 caractères minimum**, vérifié contre une base de mots de passe compromis (k-anonymat HIBP ou liste hors ligne). **Aucune règle de composition, aucune expiration périodique** : ce sont des exigences contre-productives, abandonnées par les référentiels actuels |
| **B-2** | **Inscription du second facteur imposée à la première connexion, avant tout accès aux données.** Pas de « je le ferai plus tard » |
| **B-3** | **Anti-rejeu du code TOTP** : un code utilisé ne peut pas être réutilisé dans sa fenêtre. À vérifier explicitement dans le comportement de Supabase Auth ; si ce n'est pas garanti, stocker le dernier pas de temps consommé |
| **B-4** | **Pas de « se souvenir de cet appareil »** au MVP |
| **B-5** | **Re-authentification TOTP** pour : envoi d'e-mails, export, suppression ou anonymisation d'un compte, changement de rôle, modification d'un plafond, levée de suspension, réinitialisation d'un second facteur, et toute confirmation différée du §1.3 |
| **B-6** | **Aucun compte partagé, aucun compte générique.** Un compte = une personne nommée |
| **B-7** | Session **8 h maximum, 30 min d'inactivité** — validé. Limitation de débit sur la connexion. **Alerte sur une connexion depuis un pays ou un opérateur inhabituel** (signal simple, peu de faux positifs à cette taille d'équipe) |
| **B-8** | L'invitation d'un compte agent/admin est **à usage unique, expire en 72 h, liée à l'adresse** |

#### Les durées soumises à mon avis

| Durée | Verdict |
|---|---|
| Session membre 30 jours glissants | **Validé**, sous condition A-9 (session opaque révocable) et A-10 (re-authentification pour trois actions). Ajouter un **plafond absolu de 180 jours** au-delà duquel une nouvelle vérification est exigée, quelle que soit l'activité |
| Session backoffice 8 h | **Validé** |
| Inactivité backoffice 30 min | **Validé.** C'est le bon compromis : plus court, les agents contourneraient (skill `backoffice-ops`, règle 24) |
| Code 10 min | **Validé** |
| 5 tentatives par code | **Validé**, avec A-1 et A-3 |

### 6.2 — Point 2 : `aal2` vérifié dans les politiques RLS

**Verdict : VALIDÉ, avec une reformulation honnête de ce que cela protège.**

Je confirme l'exigence : un contrôle uniquement dans `apps/api` serait **un masquage d'interface
déguisé**, exactement ce que `CLAUDE.md` §6 et la skill `backoffice-ops` interdisent.

Deux précisions qui font partie de ma validation.

**1. La reformulation.** Le document `02` propose de lire `auth.jwt() ->> 'aal'`. Avec la condition
A-9 (session opaque côté serveur), la valeur d'`aal` n'est plus portée par un jeton signé par
Supabase : elle est calculée par `apps/api` depuis la ligne de session, qui enregistre si le TOTP a
été validé pour **cette** session, et posée dans le contexte de transaction. Il faut donc dire
précisément ce que cette double vérification protège :

- **Elle protège contre nos propres erreurs** — une route oubliée, une nouvelle route écrite sans le
  garde, un refactoring qui déplace le contrôle. C'est **la** menace réaliste sur un projet d'un
  développeur assisté d'agents IA, et c'est une excellente raison de la garder.
- **Elle ne protège pas contre un attaquant qui contrôle le processus `apps/api`.** Celui-là pose ce
  qu'il veut dans le contexte de transaction. Aucune configuration RLS ne survit à la compromission
  du serveur d'application ; prétendre le contraire serait malhonnête.

**2. La deuxième barrière la plus solide n'est pas la politique, c'est le rôle.** La règle
opérationnelle : **`apps/api` n'ouvre aucune transaction métier pour une session backoffice sans
`aal2`.** Une session `aal1` ne peut qu'atteindre les routes d'inscription du second facteur. Les
politiques `aal2` sont alors une troisième barrière, écrite de façon positive (P4) :

```sql
create policy backoffice_read_requires_mfa
  on messaging.conversation_access_log
  for select
  to influx_admin
  using (influx.current_account_role() = 'admin' and influx.current_aal() = 'aal2');
```

### 6.3 — Point 3 : le rôle métier lu en base plutôt que dans le jeton

**Verdict : VALIDÉ.** C'est le bon arbitrage, et j'en fais une exigence, pas une préférence.

La raison invoquée par `architecte` est exacte et suffit : **un agent suspendu conserverait ses droits
jusqu'à l'expiration de son jeton**, sur la surface qui voit toutes les identités du produit. Une
heure de délai de révocation sur cette surface est inacceptable ; sur un produit qui se donne pour
règle « toute action d'un agent est tracée et motivée », c'est incohérent.

Condition de mise en œuvre (P3) : **une lecture par transaction, pas une par évaluation de politique.**
Le rôle, l'état de suspension et l'`aal` sont lus une fois, en début de transaction, puis posés dans
le contexte. L'objection de performance disparaît, et `expert-database` mesure (§14.2, question 3).

Conditions complémentaires :
- La valeur ne provient **jamais** du jeton, même en repli, même en cache.
- Aucun cache applicatif du rôle au-delà de la transaction en cours. Si un cache devenait nécessaire,
  sa durée de vie maximale est **5 secondes** et il est invalidé explicitement à toute suspension ou
  changement de rôle.
- Une suspension ou un changement de rôle **révoque également les sessions ouvertes** (A-9).

### 6.4 — Point 4 : le passe-plat

**Verdict : VALIDÉ SOUS CONDITIONS. Je l'accepte, et je considère même que c'est la meilleure partie
de l'architecture.**

Le raisonnement est juste et mérite d'être répété : un appel direct du navigateur vers
`api.influx.<tld>` imposerait soit un cookie sur le domaine parent — **partagé entre le site public et
le backoffice, ce qui annulerait purement et simplement D12** —, soit un cookie inter-sites
`SameSite=None`. Le passe-plat rend l'appel de même origine : cookie de première partie porté à
l'hôte, aucun CORS, aucune requête préalable, et `apps/api` sans aucune surface publique. Ce dernier
point est un gain de sécurité considérable : **il n'existe aucune URL d'API à découvrir, à balayer ou
à attaquer.**

**Conditions — la falsification de requête côté serveur (SSRF) est le risque principal.** Un
passe-plat est, par définition, un composant qui prend une entrée utilisateur et en fait une requête
sortante depuis notre réseau privé. C'est la définition d'un SSRF ; la seule question est de savoir
si la cible est contrôlable.

| # | Condition | Ce qu'elle bloque |
|---|---|---|
| **PP-1** | **L'URL cible est construite à partir d'une base de configuration**, jamais d'un en-tête (`Host`, `X-Forwarded-Host`) ni d'une partie de la requête | La redirection de l'appel vers un autre service du réseau privé |
| **PP-2** | **Le chemin est validé sur sa forme brute, sans décodage** : **tout `%` est refusé** — les caractères autorisés n'ont jamais besoin d'encodage —, puis l'expression positive `^/v1/[A-Za-z0-9/_\-]{0,200}$` s'applique, et `..`, `\`, `//`, tout `:` et tout `@` sont rejetés. Conséquence : tout segment variable d'une route (identifiant, jeton de chemin du webhook Brevo, EC-12 de `21`) s'écrit dans `[A-Za-z0-9_-]`. *Révisé le 2026-09-25 (revue de sécurité de fin de J1, R1) : remplace « validé après décodage », qui laissait au passe-plat et à `apps/api` deux lectures possibles d'un même chemin encodé* | La traversée de chemin, le double encodage (`%252e`) et l'injection d'une autorité (`https://api.internal@evil.tld/…`) |
| **PP-3** | **Méthodes limitées** à `GET`, `POST`, `PATCH`, `PUT`, `DELETE`. `CONNECT` et `TRACE` refusés | Le détournement du passe-plat en proxy générique |
| **PP-4** | **`redirect: 'manual'`.** Une redirection renvoyée par `apps/api` n'est jamais suivie ; elle est relayée telle quelle au navigateur | Le pivot SSRF par redirection |
| **PP-5** | **Liste blanche d'en-têtes relayés** — `cookie`, `content-type`, `accept`, `accept-language`, `idempotency-key`, **`origin`, `sec-fetch-site`** — et **suppression explicite** de tout en-tête `x-*` non listé, en particulier **`x-middleware-subrequest`**. *`origin` et `sec-fetch-site` ajoutés le 2026-09-25 (revue de sécurité de fin de J1, A4) : le JavaScript d'un navigateur ne peut pas les forger ; `apps/api` en a besoin pour le contrôle d'origine des écritures (ci-dessous)*. ***`user-agent` ajouté le 2026-09-27 (`05` Q14), sous une forme contrôlée*** *: retransmis **sous le nom `client-user-agent`** (comme `client-request-id`, PP-7), seulement s'il correspond à `^[\x20-\x7E]{1,512}$` — sinon rien —, sans troncature ni analyse ; jamais sous son propre nom. `apps/api` le lit après le secret interne, le résume en une valeur de liste fermée, ne stocke que ce résumé et ne journalise ni l'un ni l'autre (`21` §4, « Revue de sécurité des commits 1 à 4 du J3 »)*. ***`brevo-webhook-token` ajouté le 2026-10-13 (J7, décision 1, EC-12)*** *: jeton du webhook Brevo, relayé tel quel et jamais lu par le passe-plat ; `apps/api` ne le vérifie que sur sa route unique, pour la surface `web`* | CVE-2025-29927 et ses successeurs. Ce n'est pas théorique : c'est exactement la faille citée au §3 du document `02`. Et, par le contrôle d'origine, la falsification de requête inter-sites (CSRF) |
| **PP-6** | **L'adresse du client a une source unique : l'en-tête `x-real-ip` écrit par l'entrée de Railway — jamais `x-forwarded-for`**, qui n'est ni lu ni relayé. Une fonction unique `clientAddress()` de `src/server/relay.ts` (dans `packages/web-platform` depuis PL-09) lit `x-real-ip`, ne le garde que s'il a la forme `^[0-9A-Fa-f:.]{2,45}$`, et le retransmet à `apps/api` sous `x-real-ip` ; absent ou de forme invalide, il n'est pas transmis. Que l'entrée de Railway écrase bien une valeur fournie par le client est **constaté sur `staging` au J4** (ci-dessous). *Révisé le 2026-09-25 (revue de sécurité de fin de J1, A5, EC-21 de `21`) : remplace « réécrits par le passe-plat depuis les informations de connexion » — un gestionnaire de route Next.js n'a pas accès à la connexion* | La falsification de l'adresse IP utilisée par la limitation de débit et par les journaux |
| **PP-7** | **`x-request-id` est généré par le passe-plat.** Si le client en fournit un, il est conservé séparément sous `client-request-id` et n'est **jamais** utilisé comme identifiant d'audit | Un client qui choisirait l'identifiant de corrélation de nos journaux : empoisonnement de piste |
| **PP-8** | **En-tête secret interne partagé** (`x-influx-internal`), vérifié par `apps/api`, qui refuse toute requête sans lui | Défense en profondeur si le réseau privé Railway devient joignable, par erreur de configuration ou par une autre application déployée dans le projet. Coût : une variable d'environnement |
| **PP-9** | **Taille maximale de corps : 2 Mio au passe-plat pour le dépôt du logo de marque seul (D80, L2B) ; `apps/api` reste à 1 Mio sur toute autre route. Délai maximal : 10 s, inchangé.** Aucun autre téléversement ne transite par ce chemin (pièces et portfolio : volet ouvert avant L2E, §6.6) | Épuisement mémoire du front |
| **PP-10** | **`Set-Cookie` relayé verbatim**, en lisant la liste brute (`getSetCookie()`), jamais re-sérialisé par une API de cookies. Le passe-plat **ne fabrique ni ne modifie jamais un cookie**. Assertion : le nom relayé commence par `__Host-`, sinon la réponse est rejetée | La perte silencieuse d'attributs (`SameSite`, `Partitioned`, `Priority`) lors d'une re-sérialisation, et une éventuelle erreur de `apps/api` |
| **PP-11** | **`dynamic = 'force-dynamic'`, `revalidate = 0`, `Cache-Control: no-store`** sur toutes les réponses. Aucune mise en cache de route ni de données | **Le scénario catastrophe** : une réponse authentifiée servie à un autre utilisateur par un cache. C'est arrivé à d'autres, c'est instantanément massif, et c'est indétectable sans test dédié (§8, T7) |
| **PP-12** | **Aucune logique.** Vérifié par la garde de liste blanche de G5, et par **un test d'empreinte du fichier** qui échoue à toute modification. *Depuis PL-09 (arbitrage PL-07) : empreintes sur les octets là où ils vivent, la route dans chaque front, `relay.ts`, `api-client.ts`, `config/server.ts` et `relay-client.ts` dans `packages/web-platform`, dont les `exports` figés ferment la chaîne ; aucune logique déplacée* | La dérogation du fondateur supprime les Pull Requests : il faut un mécanisme qui force un geste conscient sur ce fichier. Coût : une heure |

**Compléments côté `apps/api` — revue de sécurité de fin de J1 (2026-09-25).** Le passe-plat
transmet ; c'est `apps/api` qui décide. Mise en œuvre et jalons : `21` §4 (J1-J, J3, J4).

*A4 — Contrôle d'origine des écritures (CSRF), exigé au J3.*
- Pour **toute méthode autre que `GET` et `HEAD`** (`POST`, `PATCH`, `PUT`, `DELETE` et toute
  méthode inattendue — *élargi le 2026-09-27, revue des commits 1 à 4 du J3*) : **`403` sauf si
  `sec-fetch-site` vaut `same-origin`**,
  ou si cet en-tête est **absent** et que `origin` vaut **l'origine publique configurée pour la
  surface identifiée** (`web` ou `backoffice`, PP-8). Tout autre cas est refusé, `same-site`
  compris.
- **Jamais d'analyseur `formbody`** (`application/x-www-form-urlencoded`) dans Fastify.
- Ce contrôle s'ajoute à `SameSite` (§6.5), il ne le remplace pas.
- *Exception unique, tranchée par `expert-cybersecurite` (J7, décision 1, 2026-10-09 ; en place au
  commit 3 du J7) :* le webhook Brevo (`POST /v1/webhooks/brevo/:pathToken`, EC-12 de `21`), appel
  de serveur à serveur sans `origin` ni `sec-fetch-site`, est la **seule** entrée de
  `WRITE_ORIGIN_EXCEPTIONS` (`apps/api/src/platform/write-origin.ts`, test : une seule) : cette
  méthode, cette route, la surface `web`. En contrepartie, la route s'authentifie avant toute
  lecture du corps (adresse dans les plages Brevo, deux jetons en temps constant) et ne lit ni
  cookie ni session. Une seconde entrée est une décision d'`expert-cybersecurite`. *Surface `web`
  seule (J9, J7S-3) :* appelée sous le secret d'une autre surface (le relais du backoffice relaie
  tout `/api/*`), la route répond **`404`, la réponse d'une route inconnue**, avant le contrôle
  d'origine et avant toute vérification qui lui est propre, quels que soient `origin` et
  `sec-fetch-site` ; une exception de la liste n'existe que pour sa surface.

*A5 — Adresse du client dans `apps/api`, exigée au J3 (constat au J4).*
1. **`trustProxy: false`** ; `request.ip` n'est **jamais** utilisé.
2. `x-real-ip` n'est lu **qu'après** l'identification réussie de la surface (PP-8, I-7) ; il est
   validé par zod (IPv4 ou IPv6) ; une adresse de la forme `::ffff:a.b.c.d` est ramenée en IPv4.
3. Clé de limitation de débit : l'adresse en IPv4 (/32), le **préfixe /64** en IPv6 ; conservée en
   **empreinte HMAC-SHA-256** avec `AUTH_THROTTLE_PEPPER` (`04` §12.10, point 4).
4. **Jamais d'adresse en clair** dans le schéma `ops` ni dans les journaux `pino`. *Plus strict que
   `02` §20.8, qui écrit que l'adresse « reste dans les journaux Railway » : écart signalé, à aligner.*
5. **Adresse absente ou invalide** : limitation par adresse e-mail **et** par un compteur global
   « adresse inconnue » à plafond strict ; une ligne `warn` ; **alerte en production** (D60).
6. **Constat au J4 sur `staging`** : requêtes venues de l'extérieur avec `X-Real-IP` et
   `X-Forwarded-For` forgés ; l'adresse retenue doit être celle de la connexion réelle. **À refaire à
   chaque changement de l'entrée.** Un CDN placé devant Railway change la source de l'adresse : à
   inscrire dans la décision sur les domaines et les DNS.
7. *Ajout du 2026-10-14 (revue de fin de J7) :* `x-real-ip` est aussi un **facteur d'authentification
   du webhook Brevo** (adresse dans les plages Brevo, A4 exception) ; le constat du point 6 se refait
   après chaque déploiement de l'entrée, avec un `X-Real-IP` forgé dans une plage Brevo ⇒ `404`, aucune
   ligne brute.

### 6.5 — Point 5 : les trois CSP et les en-têtes de sécurité

**Verdict : VALIDÉ SOUS CONDITIONS**, avec les valeurs ci-dessous. Elles doivent être **appliquées en
production et testées** (§8, T10), pas écrites dans un document.

**Site public et espace membres (`apps/web`)**

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<aléa par requête>' 'strict-dynamic';
  style-src 'self' 'nonce-<aléa par requête>';
  img-src 'self' data: blob: https://<projet>.supabase.co;
  font-src 'self';
  connect-src 'self' https://<projet>.supabase.co;
  frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none';
  upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
X-Frame-Options: DENY
```

- `connect-src 'self'` suffit pour l'API **grâce au passe-plat** : c'est un bénéfice direct de
  l'architecture, à signaler. L'hôte Supabase n'est nécessaire que pour le téléversement direct (E1).
- **Aucun `'unsafe-inline'` dans `script-src`.** Si Next impose des styles en ligne que le nonce ne
  couvre pas, `'unsafe-inline'` est toléré **dans `style-src` uniquement**, avec une note écrite.
- Pas de point de collecte de rapports CSP au MVP : ce serait une surface d'écriture non
  authentifiée de plus, pour un bénéfice faible à ce stade.

**Backoffice (`apps/backoffice`)** — tout ce qui précède, plus strict :

```
Content-Security-Policy:
  default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'nonce-…';
  img-src 'self' blob:;            ← PAS d'hôte Supabase : voir ci-dessous
  connect-src 'self'; font-src 'self';
  frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'
Referrer-Policy: no-referrer
X-Robots-Tag: noindex, nofollow, noarchive        ← sur TOUTES les réponses, erreurs comprises
```

> **Condition importante et non évidente : `img-src 'self'` au backoffice implique que les pièces de
> vérification ne sont PAS servies au navigateur par une URL signée Supabase, mais relayées par
> `apps/api`.** C'est voulu, pour trois raisons : chaque consultation est alors journalisée (C(14)) ;
> aucune URL signée vers une pièce d'identité ne se retrouve dans un historique de navigateur, un
> journal de serveur ou un en-tête `Referer` ; et le type réel du fichier est imposé au moment du
> service. Le volume est de quelques dizaines d'images par jour : le coût est négligeable.
> **L'exception E1 (téléversement direct) reste valable ; c'est la LECTURE des pièces sensibles qui
> est ramenée dans `apps/api`.**

**Cookies**

| | Membres | Backoffice |
|---|---|---|
| Nom | `__Host-influx-session` | `__Host-influx-ops-session` |
| Attributs | `Secure`, `HttpOnly`, `Path=/`, **sans `Domain`**, `SameSite=Lax` | idem, **`SameSite=Strict`** |
| Contenu | **Identifiant de session opaque** (A-9), jamais un JWT | idem |

- `SameSite=Lax` côté membres est nécessaire : les notifications contiennent des liens vers un fil.
- `SameSite=Strict` côté backoffice a une conséquence qu'il faut accepter consciemment : **un agent
  qui clique un lien depuis un e-mail arrive déconnecté.** C'est voulu. Que personne ne « corrige »
  cela plus tard en passant à `Lax`.
- **Le backoffice ignore tout cookie dont le nom ne commence pas par `__Host-`.** Un sous-domaine
  compromis peut poser un cookie sur le domaine parent (« cookie tossing ») ; il ne peut pas écraser
  un cookie `__Host-`, mais il peut en ajouter un autre.

**HSTS `includeSubDomains`** est souhaitable ici, précisément parce que le backoffice est un
sous-domaine. `preload` engage **tous** les sous-domaines de façon durable et difficile à défaire :
à confirmer par `integrateur` une fois les domaines arrêtés.

### 6.6 — Point 6 : l'exception E1, téléversement direct vers le Storage

> **L2B (D80) : E1 n'est pas retenu.** Le logo de marque transite par le passe-plat et `apps/api` (2 Mio, ré-encodé, aucune URL signée émise), car la durée d'une URL de téléversement est fixée à 2 h par le service Supabase (E1-3 intenable) et le ré-encodage (E1-6) l'impose. E1 reste **ouvert avant L2E** (pièces et portfolio), conditions E1-3 et E1-8 à réarbitrer.

**Verdict : VALIDÉ SOUS CONDITIONS.** L'exception est justifiée : faire transiter des images par
`apps/api` gaspillerait bande passante et mémoire sans rien apporter au téléversement. Mais une URL
signée **contourne les politiques du Storage par conception** : c'est une autorisation portable, et
tout ce qui est portable finit par voyager.

| # | Condition | Détail |
|---|---|---|
| **E1-1** | Compartiments **privés**, `allowed_mime_types` et `file_size_limit` **réglés au niveau du compartiment** | Seule limite réellement appliquée au moment du téléversement direct |
| **E1-2** | Un compartiment par sensibilité : `portfolio`, `verification` | Les limites et les politiques diffèrent |
| **E1-3** | URL de téléversement : **≤ 5 min**, un chemin, une méthode, un usage | Validé tel que proposé. *Non retenu au L2B (D80) : durée de 2 h fixée par Supabase ; à rouvrir avant L2E* |
| **E1-4** | **Le chemin est calculé par `apps/api`** : `<compartiment>/<uuid-propriétaire>/<uuid-aléatoire>.<ext>`. Jamais le nom d'origine | Un nom de fichier est un champ de texte libre, donc un vecteur de coordonnées et de dé-anonymisation |
| **E1-5** | **Validation après téléversement, avant référencement** : octets d'en-tête, dimensions, taille réelle. Un fichier non validé n'est jamais rattaché à un profil | Le type déclaré par le navigateur ne vaut rien |
| **E1-6** | **Ré-encodage des images de portfolio, suppression des métadonnées EXIF** | La géolocalisation dans une capture d'écran de téléphone est une dé-anonymisation directe. Personne n'y pense, et c'est irréversible une fois publié |
| **E1-7** | **Lecture des pièces de vérification : jamais par URL signée remise au navigateur** — relais par `apps/api`, journalisé (§6.5) | Ces pièces contiennent des données de tiers |
| **E1-8** | **Lecture du portfolio : URL signée ≤ 5 min**, émise après contrôle, **émission journalisée** | Volume plus élevé, sensibilité plus faible ; la durée courte limite la portabilité. *Non retenu au L2B (D80) : le logo est relu par `apps/api`, aucune URL signée ; à rouvrir avant L2E* |
| **E1-9** | **Formats : images uniquement** (PNG, JPEG, WebP) pour le portfolio **et** pour les pièces de vérification. **PDF refusé au MVP** | Un PDF servi depuis notre origine est un document actif ; un visualiseur PDF exécute du script. Si un PDF devient nécessaire, il sera servi depuis une origine distincte, en `Content-Disposition: attachment` |
| **E1-10** | **Quotas par compte** : nombre et volume par jour | Sans quota, un stockage privé est un hébergement gratuit |
| **E1-11** | **Aucune analyse antivirale au MVP** — risque **accepté et documenté** | Les fichiers ne sont jamais exécutés, sont servis avec `nosniff`, et les formats sont restreints aux images validées. À rouvrir si un canal de documents est ouvert (skill `messaging-spec`, étape 7) |

### 6.7 — Point 7 : la liste des opérations autorisées à utiliser `service_role`

**Verdict : REFUSÉ dans la forme proposée, VALIDÉ dans la forme reformulée au §4, principe P7.**

Le refus porte sur un point précis : **le rôle Postgres `service_role` est `BYPASSRLS`, et un rôle
`BYPASSRLS` employé à l'exécution rend tous les tests RLS facultatifs.** Le principe « une liste
nommée avec un motif écrit » est excellent ; le véhicule est mauvais.

Reformulation validée :

1. **Aucun rôle utilisé à l'exécution n'a `rolbypassrls` ni `rolsuper`** (test T4).
2. Trois rôles élevés, sans connexion, aux `GRANT` nommés table par table : `influx_auth`
   (pré-authentification), `influx_worker` (file et tâches de fond), `influx_privacy` (exécution des
   demandes RGPD).
3. **Cinq opérations élevées, listées au §4 P7**, déclarées dans une union fermée de
   `packages/contracts`. `withElevatedTransaction(reason, fn)` refuse tout motif hors liste **à
   l'exécution**, pas seulement à la compilation.
4. **`service_role` au sens Postgres n'est utilisé nulle part.** La clé
   `SUPABASE_SECRET_KEY` reste nécessaire pour l'API HTTP d'Auth et de Storage, uniquement dans
   `apps/api` et le worker (§6.9).
5. **Une seconde grappe de connexions**, avec sa propre variable d'environnement, pour les rôles
   élevés. Le chemin utilisateur et le chemin élevé ne partagent jamais une connexion : un défaut sur
   le premier ne peut pas emprunter les droits du second.
6. **Aucune élévation dans un gestionnaire de route**, sauf E-1 et E-2 (pré-authentification).
7. Chaque élévation **écrit automatiquement une ligne d'audit** avec son motif.
8. **Test :** l'ensemble des appelants de `withElevatedTransaction` est égal à la liste déclarée (T6).

### 6.8 — Point 8 : les trois verrous du garde-fou `staging`

> **Arbitré par le fondateur le 2026-10-18 (D70), contre cette recommandation.** `staging` envoie
> réellement et porte une clé Apollo, celle de son propre compte ; les verrous 2 et 3 ne valent
> plus que pour la pile locale, la CI et les tests. Le verrou 1 (aucune clé de production hors
> production) et le **verrou 4 (B9) restent entiers**. Le complément « `staging` inaccessible au
> public » est **écarté par le fondateur** le même jour (D70, risque (a) accepté). Les conditions de D70 sont
> relues par `expert-cybersecurite` à la revue groupée du chantier.

**Verdict : VALIDÉ, et complété par un quatrième verrou qui manque et qui est le plus important.**

Les trois verrous proposés (clés distinctes, `SYNC_MODE=dry_run`, liste blanche de destinataires) sont
bien conçus, indépendants, et le refus de démarrer en production avec `dry_run` est une bonne idée
symétrique. Précisions :

- La liste blanche est évaluée **au connecteur, après tout le mappage**, et la condition est
  **positive** (« l'adresse figure dans la liste »), jamais négative.
- `SYNC_MODE` est lu au démarrage, **immuable à l'exécution**, journalisé au démarrage.
- **Mieux qu'une clé Apollo de test : pas de clé Apollo du tout en `staging`.** Le connecteur passe
  alors en `skipped_no_credentials`. Une clé absente ne peut pas être confondue avec une autre.

> **VERROU 4 — BLOQUANT (B9). Aucune donnée de production dans `staging`.**
> Les trois verrous protègent **l'envoi**. Aucun ne protège **les données**. Un jour, quelqu'un
> proposera de restaurer une sauvegarde de production dans `staging` « pour reproduire un bug » — et
> ce jour-là, l'ensemble du dispositif de ce document s'applique à une base qui n'a ni les mêmes
> accès, ni les mêmes journaux, ni la même surveillance. C'est le mode de fuite le plus banal de
> toute l'industrie.
> **Règle :** `staging` est alimenté **exclusivement** par des données synthétiques
> (`supabase/seed`). Toute restauration de production vers un autre environnement exige une
> autorisation écrite du fondateur **et** une anonymisation préalable. À inscrire dans les procédures
> écrites du Lot 6.

**Complément (Important) :** `staging` doit être **inaccessible au public** — restriction d'accès
(authentification d'infrastructure ou liste d'IP) **et** `X-Robots-Tag: noindex` sur toutes les
réponses. Un `staging` ouvert est une copie du produit, avec les mêmes bogues, indexée, et souvent
moins surveillée.

### 6.9 — Point 9 : inscription et récupération du second facteur du backoffice

**Verdict : VALIDÉ SOUS CONDITIONS. C'est le point le plus faible du dossier, et c'est normal.**

**Pourquoi c'est le point le plus souvent bâclé — la raison est structurelle, pas humaine.** Le
parcours de récupération est, par construction, **une authentification alternative qui contourne le
second facteur**. Il est écrit en dernier, sous pression, par quelqu'un qui vient de perdre son
téléphone. La solution qui vient naturellement — « on envoie un lien de réinitialisation par
e-mail » — **ramène la sécurité du compte à celle de la boîte e-mail**, c'est-à-dire qu'elle annule
exactement ce que le TOTP apportait. Le MFA devient alors une gêne quotidienne sans bénéfice : le pire
des deux mondes.

**Inscription**

| # | Exigence |
|---|---|
| **MFA-1** | Compte créé **par invitation d'un admin** : lien à usage unique, 72 h, lié à l'adresse |
| **MFA-2** | À la première connexion : mot de passe, puis **inscription du TOTP imposée avant tout accès aux données** |
| **MFA-3** | **Dix codes de secours à usage unique**, affichés **une seule fois**, à conserver hors ligne. Seule leur génération est journalisée, jamais leur valeur |
| **MFA-4** | La consommation d'un code de secours **alerte immédiatement tous les admins** et est journalisée |
| **MFA-5** | **Aucun repli par SMS** (échange de carte SIM), **aucune question secrète**, **aucun lien de réinitialisation par e-mail** |

**Récupération (perte de l'appareil)**

| # | Exigence |
|---|---|
| **MFA-6** | La réinitialisation est faite par **un admin autre que la personne concernée**, depuis le backoffice, avec motif typé, `2V` et `R` |
| **MFA-7** | **Vérification d'identité hors bande** préalable : appel ou visioconférence avec une personne connue, jamais sur la seule foi d'un e-mail. Procédure écrite (Lot 6) |
| **MFA-8** | Après réinitialisation : notification à **tous** les admins et à la personne concernée, inscription d'un nouveau TOTP à la connexion suivante, nouveaux codes de secours, anciens invalidés |
| **MFA-9** | *(Recommandé)* Pendant **24 h** après réinitialisation, le compte ne peut pas exécuter d'action irréversible (envoi d'e-mails, suppression, export, changement de rôle) |

> **MFA-10 — BLOQUANT (B7) : le compte de secours (« bris de glace »), à créer dès le Lot 0.**
> Au MVP, il peut n'y avoir **qu'un seul administrateur**. S'il perd son téléphone **et** ses codes de
> secours, plus personne ne peut administrer INFLUX — ou bien quelqu'un improvisera une porte dérobée
> dans l'urgence, ce qui est pire.
> **Exigences :** un compte `admin` dédié, adresse distincte (pas un alias de l'adresse personnelle),
> mot de passe et TOTP inscrits sur un appareil conservé hors ligne, codes de secours **imprimés et
> scellés**, rangés physiquement séparés de l'appareil. **Toute connexion sur ce compte déclenche une
> alerte immédiate au fondateur et une ligne d'audit.** Usage revu à chaque revue de sécurité.
> **Coût : une heure. C'est la mesure au meilleur rapport de tout ce document.**

---

## 7. L'isolement du backoffice

`architecte` a bien posé le sujet. Je valide l'ensemble et j'ajoute ce qui manque.

### 7.1 Ce que je valide tel quel

| Mesure | Avis |
|---|---|
| Hôte distinct, application séparée (D12) | **Validé.** C'est la meilleure décision du document `02` |
| `X-Robots-Tag: noindex, nofollow` sur **toutes** les réponses, plutôt qu'un `Disallow` dans `robots.txt` | **Validé, et le raisonnement est exact** : un chemin interdit d'exploration n'est jamais lu, donc la consigne `noindex` n'est jamais vue, et l'URL peut être indexée malgré tout. C'est une subtilité que peu de gens connaissent |
| Cookie `__Host-`, sans `Domain`, `SameSite=Strict` | **Validé** |
| Session 8 h, inactivité 30 min, re-authentification pour les actions sensibles | **Validé** |
| Inscription impossible, comptes par invitation | **Validé** |
| CSP plus stricte, aucun script ni image tiers, `frame-ancestors 'none'` | **Validé**, valeurs au §6.5 |
| `apps/backoffice` sans next-intl tant que D36 est ouverte | Hors de mon périmètre, sans objection |

### 7.2 Ce que j'exige en plus

| # | Exigence | Pourquoi |
|---|---|---|
| **BO-1** | **Ne jamais présenter la confidentialité du nom d'hôte comme une protection.** `ops.influx.<tld>` apparaîtra dans les journaux publics de transparence des certificats dans les heures suivant l'émission du certificat. Il sera trouvé | Pas de sécurité par obscurité. La valeur de l'isolement est la **réduction du rayon d'explosion** et le durcissement différencié, pas le secret. Si quelqu'un se repose sur le secret, il relâchera le reste |
| **BO-2** | **Le backoffice ignore tout cookie dont le nom ne commence pas par `__Host-`** | Un sous-domaine compromis ne peut pas écraser un cookie `__Host-`, mais il peut en poser d'autres sur le domaine parent |
| **BO-3** | **Hygiène DNS** : aucun enregistrement `CNAME` pendant vers un service désaffecté, enregistrement `CAA` posé sur le domaine | La prise de contrôle d'un sous-domaine abandonné est le moyen le plus simple d'obtenir un certificat valide sur notre domaine |
| **BO-4** | **BLOQUANT (B10) — aucun contenu utilisateur n'est jamais rendu en HTML dans le backoffice.** `dangerouslySetInnerHTML` interdit par ESLint (`react/no-danger` en erreur) dans les deux fronts ; aucun rendu Markdown au MVP | Le backoffice affiche du contenu écrit par des membres : messages, briefs, motifs, noms. **Un XSS stocké par un membre s'exécuterait sur la surface qui voit toutes les identités et toutes les conversations du produit** — avec la session d'un agent. C'est le scénario d'attaque le plus rentable contre INFLUX, et il ne demande aucune compétence particulière |
| **BO-5** | **Les pièces de vérification sont servies par `apps/api`**, type imposé depuis les octets validés, `nosniff`, jamais de PDF (§6.5, §6.6) | Journalisation de chaque consultation, et aucun document actif servi depuis notre origine |
| **BO-6** | **Limitation de débit sur la connexion** et **alerte sur une connexion depuis un pays ou un opérateur inhabituel** | Peu de faux positifs avec une équipe de deux ou trois personnes ; détection immédiate d'un vol d'identifiants |
| **BO-7** | **Aucun compte partagé ni générique**, et **réattribution obligatoire avant désactivation** d'un compte agent (skill `backoffice-ops`, règle 19) | Un compte partagé annule toute la traçabilité, qui est le cœur du dispositif A10 |
| **BO-8** | **Aucune donnée dans le rendu serveur du backoffice.** Le serveur Next du backoffice ne lit jamais la base et ne reçoit jamais de donnée métier dans sa charge utile de rendu au-delà de ce que l'écran affiche | Le document `02` le pose déjà ; je le reprends comme exigence de sécurité : toute donnée dans une charge utile de rendu échappe au schéma de réponse, donc à la deuxième ligne de défense de l'anonymisation |
| **BO-9** | **Pas d'outil d'analyse d'audience, pas de balise tierce, pas de police distante** dans le backoffice, jamais | Chaque tiers est un lecteur potentiel des URL visitées, donc des identifiants de conversations et de comptes |

---

## 8. Les tests de sécurité exigés

Ces tests appartiennent au document `18` (`testeur`), avec qui ils sont co-construits. Ils sont
exigibles **en intégration continue**, sur une base jetable, à chaque exécution. Un test de sécurité
qui ne s'exécute pas à chaque fois n'existe pas.

| # | Test | Ce qu'il vérifie | Lot |
|---|---|---|---|
| **T1** | **Anonymisation de bout en bout, sur la charge utile brute.** Pour **chaque** route accessible au rôle annonceur, avec une base contenant des valeurs identifiantes marquées (`@pseudo_test`, `https://instagram.com/test`, nom légal, e-mail, téléphone, nom de fichier) : **rechercher chacune de ces chaînes dans le corps de la réponse sérialisé**, dans les en-têtes, et dans toute URL renvoyée. Aucune ne doit apparaître. Puis créer une mise en relation révélée et vérifier que le champ attendu **apparaît** | La fuite d'anonymisation, y compris dans un champ imprévu, un message d'erreur, un objet imbriqué ou une URL signée. **On teste la chaîne brute, pas une liste de champs** : c'est la seule façon d'attraper ce qu'on n'a pas anticipé | 2→3 |
| **T2** | **RLS par rôle et par table.** Chaque rôle tente chaque opération sur chaque table ; le résultat attendu est déclaré dans un tableau dérivé du §3. Une lecture interdite doit **échouer ou renvoyer zéro ligne**, et le tableau déclare lequel des deux. **Une table de nos schémas sans ligne dans le tableau, sans `relrowsecurity`, ou sans politique, fait échouer la CI** | Le scénario réel : une table ajoutée au Lot 5 sans politique | 0, étendu à chaque lot |
| **T3** | **Append-only.** Pour chaque rôle applicatif, `UPDATE`, `DELETE` et `TRUNCATE` sur chaque table d'audit lèvent une erreur. La désactivation du déclencheur échoue. Insertion de N événements, vérification de la continuité de la chaîne ; altération simulée d'une ligne (en tant que propriétaire, dans la base de test) : la vérification **doit** la détecter | Que l'inaltérabilité soit réelle et que la vérification fonctionne | 0 |
| **T4** | **Connexion non privilégiée.** Le rôle de `DATABASE_URL` n'est ni propriétaire d'un objet de nos schémas, ni `BYPASSRLS`, ni `SUPERUSER`, ni membre de `service_role`. **Aucun rôle utilisé à l'exécution n'a `rolbypassrls`.** Une lecture hors transaction ne renvoie rien | Le défaut le plus grave possible : une RLS entièrement décorative, sans aucun symptôme visible | 0 |
| **T5** | **Journalisation des lectures de conversation.** `has_table_privilege('influx_agent','messaging.messages','SELECT')` est faux, idem `influx_admin`, idem sur `conversations`. Un appel à la route de lecture crée **exactement une** ligne dans `conversation_access_log`, **portant le canal lu** ; la fonction ne s'appelle pas sans canal (D47). Contrôle statique X2 (§5.3) | Que A10 ne soit pas décoratif | 4 |
| **T6** | **Opérations élevées.** L'ensemble des appelants de `withElevatedTransaction` est **exactement égal** à la liste déclarée. Le motif appartient à l'union fermée, refus à l'exécution sinon. Aucun gestionnaire de route hors E-1 et E-2 n'appelle d'élévation | La dérive silencieuse : « juste cette fois, en service, pour débloquer » | 0 |
| **T7** | **Passe-plat.** Traversée de chemin (`/api/v1/../admin`, `%2e%2e%2f`, `//`, URL absolue, `@hôte`) ; **tout `%` dans le chemin ⇒ refus** (PP-2, R1) ; injection d'en-tête (`x-middleware-subrequest`, `x-forwarded-host`, `x-request-id` client) ; `x-forwarded-for` jamais relayé, `x-real-ip` de forme invalide non relayé (PP-6) ; `origin` et `sec-fetch-site` relayés (PP-5) ; `user-agent` relayé sous `client-user-agent` seulement s'il a la forme admise, jamais sous son propre nom, et un `client-user-agent` fourni par le navigateur jamais relayé tel quel (PP-5, `05` Q14) ; **écriture avec `sec-fetch-site: cross-site` ou `same-site`, ou sans cet en-tête avec un `origin` étranger à la surface ⇒ 403** (A4, *ajouts du 2026-09-25, revue de fin de J1*) ; corps hors gabarit ⇒ 413, redirection de l'API non suivie, `Set-Cookie` multiple relayé verbatim, `Cache-Control: no-store` présent. **Et le test qui compte : deux utilisateurs différents appelant la même URL reçoivent des réponses différentes** (non-mise en cache d'une réponse authentifiée) | Le SSRF, le contournement de middleware, et la fuite par cache | 1 |
| **T8** | **Authentification.** Un seul code valide à la fois ; expiration ; plafond de tentatives ; limitation de débit par adresse, par IP et globale ; réponse et **temps de réponse** identiques pour une adresse connue et inconnue ; code non réutilisable ; session révoquée **immédiatement** à la suspension ; route backoffice sans `aal2` ⇒ 403 ; changement d'adresse sans double confirmation ⇒ refus | Les conditions A-1 à A-12 et B-1 à B-8 | 1 |
| **T9** | **Storage.** Tous les compartiments privés ; URL signée expirée refusée ; clé d'objet avec traversée refusée ; fichier dont les octets d'en-tête contredisent le type déclaré rejeté ; EXIF absent après traitement ; **une pièce de vérification n'est atteignable par aucune route ni aucun schéma accessible au rôle annonceur, y compris en devinant un identifiant** ; émission d'URL signée journalisée | E1-1 à E1-11 et la condition C(13) | 2 |
| **T10** | **En-têtes et CSP.** Jeu d'en-têtes exact par surface, en mode production. Aucun `'unsafe-inline'` dans `script-src`. `X-Robots-Tag` présent sur **toutes** les réponses du backoffice, y compris les erreurs et les redirections | L'en-tête oublié sur la page d'erreur, cas classique | 1 |
| **T11** | **Secrets.** Analyse des artefacts de construction de `apps/web` et `apps/backoffice` : aucune occurrence de `SUPABASE_SECRET_KEY`, `BREVO_API_KEY`, `APOLLO_API_KEY`, `AUTH_TOKEN_SIGNING_SECRET`, `AUTH_THROTTLE_PEPPER` (*remplacent `SESSION_COOKIE_SECRET` le 2026-09-27, EC-24*), aucune chaîne ressemblant à un JWT. Analyse de secrets sur le dépôt et l'historique. `.env*` ignoré | La fuite par empaquetage : la variable lue au mauvais endroit se retrouve dans le bundle | 0 |
| **T12** | **Dépendances.** Échec de la CI sur toute vulnérabilité **critique ou élevée**. **Exécution planifiée hebdomadaire**, pas seulement à chaque commit — une CVE publiée n'attend pas notre prochain commit. Dérogations dans un fichier dédié, chacune **avec une date d'expiration** ; une dérogation expirée fait échouer la CI | Une dérogation sans échéance est un mensonge différé | 0 |
| **T13** | **Erreurs.** Aucune réponse 4xx ou 5xx ne contient de trace d'exécution, de fragment SQL, de nom d'hôte interne, de nom de table ni de version de composant. Seuls `code`, un message traduisible et `requestId` | `CLAUDE.md` §6 et la checklist de `security-rgpd-audit` | 1 |
| **T14** | **IDOR.** Pour chaque type d'objet, un utilisateur de chaque rôle tente de lire et de modifier un objet d'autrui en changeant l'identifiant ⇒ refus, **avec le même code de réponse** que pour un objet inexistant | Ne pas divulguer l'existence d'une ressource par la différence entre 403 et 404 | 2→5 |
| **T15** | **Limitation de débit.** 429 effectif sur la connexion, l'inscription, la recherche, le détail de profil et les routes coûteuses. La limite est appliquée dans `apps/api`, **jamais** dans le front, et elle porte sur le compte **et** sur l'IP. *Ajout du 2026-09-25 (revue de fin de J1, A5) :* clé /32 en IPv4, /64 en IPv6, `::ffff:` ramené en IPv4 ; adresse absente ou invalide ⇒ compteur par e-mail et compteur global « adresse inconnue » ; aucune adresse en clair dans le flux de journal capturé | Une limite posée dans le front est contournée par le premier appel qui ne passe pas par le front | 1 |
| **T16** | **Aucun calcul de commission.** Analyse statique : aucune multiplication d'un montant par une constante numérique dans `apps/` et `packages/`. `commission_rates` est vide et aucun rôle applicatif n'a de droit d'écriture dessus | `CLAUDE.md` §2, `01-intermediation-courtee.md` §7. C'est une règle métier **et** une règle d'intégrité | 0 |
| **T17** | **Garde-fou `staging`.** Les quatre verrous du §6.8, chacun testé séparément, plus le refus de démarrage en production avec `dry_run` | `02-architecture` §12.4 | 1 |
| **T18** | **Le cycle de révélation, moment par moment** (C(21a) à C(21d)). **a)** `has_function_privilege` sur `matching.reveal_identity(uuid)` est **faux pour les six rôles** — `influx_app`, les quatre rôles applicatifs et `influx_worker` — et un appel direct depuis chacun d'eux **échoue**. **b)** Un agent `aal2` valide une entrée : `status = 'approved'`, `identity_revealed_at` **reste nul**, **aucune ligne** dans `conversations`. **c)** Un agent qui n'est pas titulaire du verrou ⇒ refus. **d)** Une partie accepte : son seul horodatage est posé, celui de l'autre reste nul, rien n'est révélé, la réponse ne contient **aucun élément identifiant de l'autre partie**. **e)** Un tiers, puis un agent, puis un administrateur tentent d'enregistrer l'acceptation d'une partie ⇒ refus, **même code de réponse** qu'une mise en relation inexistante. **f)** La **seconde** acceptation produit, en une transaction, `identity_revealed_at`, l'événement chaîné, la conversation, **trois** participants, l'affaire et **deux** e-mails en file ; une panne simulée sur l'un des six ⇒ **aucun des six** ne subsiste. **g)** Deux acceptations **concurrentes** (la première et la seconde jouées en parallèle) ⇒ **une seule** révélation, **un seul** événement, **une seule** conversation. **h)** Un `UPDATE` direct de `identity_revealed_at`, `advertiser_accepted_at`, `creator_accepted_at` ou `status` par chacun des quatre rôles applicatifs ⇒ échec | Que l'invariant A2 / D16 ne dépende ni de la discipline d'un développeur, ni de l'ordre des appels, ni de l'absence de concurrence. **C'est le test le plus important du Lot 4** | 4 |
| **T19** | **Cloisonnement des apartés** (D47, `04` §5.7.1 tests TA1 à TA8). **a)** `messages.channel` et `conversation_access_log.channel` n'ont **aucune valeur par défaut**. **b)** Sous `influx_creator` participant, les lignes `advertiser_private` de `messages`, `conversation_channel_activity` et `conversation_reads` renvoient **zéro ligne** alors qu'elles existent ; miroir sous `influx_advertiser`. **c)** Une insertion du créateur dans `advertiser_private` échoue par la politique ; la même insertion, politiques désactivées dans la base de test, échoue par la contrainte `messages_party_channel`. **d)** La réponse brute de chaque route membre de la messagerie (liste, fil, compteurs) est identique, octet pour octet hors horodatage de réponse, avant et après l'écriture d'un message dans l'aparté de **l'autre** partie — **même méthode que T1 : on teste la charge utile, pas une liste de champs**. **e)** Un message d'aparté laisse l'état `open`. **f)** Sous `influx_agent`, un signalement visant un message d'agent est invisible ; sous `influx_admin`, l'auteur ne voit pas celui qui le vise (C(27)) | Qu'un aparté ne fuie ni par un message, ni par un compteur, ni par un tri, ni par un changement d'état. **Le point d) est celui qui compte** : c'est lui qui attrape la fuite qu'on n'a pas anticipée | 4 |

> **Précision du 2026-09-19 — exemption nommée du test T16 (arbitrage `chef-de-projet`, sur signalement
> de `expert-database`, `04` §5.9 et `14` E11).** Il existe **une seule** multiplication d'un montant qui
> soit légitime : la **conversion d'unité monétaire** entre la saisie décimale d'un écran et le `bigint`
> en unités mineures (`2 000,00 EUR` ↔ `200000`). Le facteur vient de `reference.currencies.minor_unit`,
> **jamais d'un littéral**. Cette conversion vit dans **une fonction unique de `packages/domain`**,
> annotée, testée, et **exemptée nommément** du contrôle. Sans exemption nommée, l'équipe désactiverait
> T16 — et un contrôle désactivé ne protège rien. Toute autre multiplication d'un montant reste un échec
> bloquant. Le contenu exact de l'annotation d'exemption est à fixer par `expert-cybersecurite` (veto).

---

## 9. Verdict d'étape

> **Verdict en trois lignes.**
> **1.** L'architecture proposée est saine et je l'approuve : l'API en frontal unique, l'anonymisation
> en base et la séparation du backoffice sont les bons choix, et ils sont bien argumentés.
> **2.** Dix points doivent être corrigés **avant que le Lot 0 puisse être déclaré livré** ; aucun
> n'est un refus de principe, aucun ne coûte plus d'une journée, et ils sont tous moins chers
> maintenant qu'après.
> **3.** **Avis favorable sous conditions.** Je lève mon veto sur les documents `02` et `03` ; je le
> maintiens sur la **livraison du Lot 0** tant que les dix points bloquants ne sont pas en place.

### 9.1 Bloquant — dix points, à traiter au Lot 0

| # | Constat | Surface | Scénario concret | Impact | Correctif | Effort |
|---|---|---|---|---|---|---|
| **B1** | Un seul rôle Postgres pour trois rôles métier : l'argument « absence de `GRANT` » du §2.5 du document `02` est inopérant | RLS, anonymisation | Au Lot 5, une table `creator_identity_notes` est ajoutée avec une politique trop large. Rien ne rattrape l'erreur : il n'y a pas de seconde barrière | **A2 tombe pour les créateurs concernés.** Pseudos et `@` lisibles par une marque sans mise en relation | Quatre rôles Postgres distincts, `GRANT` par rôle, `SET LOCAL ROLE` après lecture du rôle en base (§4, P2) | 0,5 à 1 j |
| **B2** | `service_role` (`BYPASSRLS`) employé à l'exécution | Toute la base | Un appel de route glissé en transaction de service « pour débloquer » : la RLS ne s'applique plus, aucun test ne rougit | Contrôle d'accès annulé sans symptôme | `influx_worker` / `influx_auth` / `influx_privacy` sans `BYPASSRLS`, `GRANT` nommés, liste fermée de 5 opérations, seconde grappe de connexions, test T4 et T6 (§4, P7) | 1 j |
| **B3** | Tables métier dans `public`, exposées à PostgREST avec la clé `anon` | Base entière | La clé `anon` circule (elle est conçue pour être publique) ; PostgREST reste joignable sur l'hôte Supabase | Lecture de tout ce que `anon`/`authenticated` peuvent atteindre | Schémas par domaine, aucun exposé à PostgREST, `REVOKE ALL` sur `anon` et `authenticated` (§4, P6) | 0,5 j |
| **B4** | Session portée par un jeton autoportant | Authentification | Un agent est suspendu ; sa session reste valable jusqu'à expiration | Un compte révoqué conserve l'accès à toutes les identités et conversations | Cookie porteur d'un identifiant de session **opaque**, ligne en base avec `revoked_at` (§6.1, A-9) | 0,5 j |
| **B5** | Chemin de lecture des messages non journalisé pour les rôles internes | Messagerie, A10 | Un écran lit les messages par une requête directe : la lecture n'apparaît nulle part | **A10 devient une promesse invérifiable**, et l'engagement pris dans les CGU n'est pas tenu | `REVOKE SELECT` sur `messaging.messages` et `conversations` pour `influx_agent`/`influx_admin` ; fonction `SECURITY DEFINER` unique ; tests T5 et X1 (§5) | 0,5 j |
| **B6** | Pièces de vérification exposables à un annonceur, ou servies par URL signée | Storage, vie privée des tiers | Une URL signée vers une capture d'abonnés se retrouve dans un `Referer`, un journal ou un historique ; ou un champ apparaît dans un schéma de réponse | Divulgation de données personnelles **de tiers** non-utilisateurs. Incident de sécurité notifiable | Aucun droit, aucune route, aucun champ pour `advertiser` ; lecture relayée par `apps/api` et journalisée ; test T9 (§3.2 C(13), §6.6) | 0,5 j |
| **B7** | Aucun compte de secours administrateur, aucune procédure de réinitialisation du second facteur | Backoffice | L'unique admin perd son téléphone et ses codes de secours | Plateforme non administrable, ou porte dérobée improvisée dans l'urgence | Compte « bris de glace » scellé + procédure MFA-6 à MFA-9 (§6.9) | 1 h + procédure |
| **B8** | Codes à usage unique sans les garde-fous complets | Authentification membres | Tir groupé : codes demandés pour 10 000 adresses, `000000` tenté sur chacune | Prise de contrôle de comptes membres, à l'échelle | Un seul code valide à la fois, limitation à trois niveaux, réponse et temps identiques, blocage visant l'IP et non le compte (§6.1, A-1 à A-5) | 1 j |
| **B9** | Données de production restaurées en `staging` | Environnements | « Pour reproduire le bogue » — la phrase la plus dangereuse du métier | Base complète de données personnelles dans un environnement moins protégé, hors des contrôles de ce document | Interdiction écrite, `staging` alimenté par `supabase/seed` uniquement, autorisation écrite du fondateur + anonymisation pour toute exception (§6.8) | Procédure |
| **B10** | Contenu utilisateur rendu en HTML dans le backoffice | Backoffice | Un membre écrit un script dans un brief ou un message ; un agent ouvre la fiche | **XSS stocké exécuté avec la session d'un agent** : lecture de toutes les identités et de toutes les conversations, actions en son nom. Le scénario d'attaque le plus rentable contre INFLUX | `react/no-danger` en erreur dans les deux fronts, aucun rendu Markdown au MVP (§7.2, BO-4) | 1 h |

### 9.2 Important — à corriger sous délai court, ticket ouvert

| # | Constat | Correctif | Échéance | Effort |
|---|---|---|---|---|
| **I-1** | Métadonnées EXIF conservées dans les visuels de portfolio | Ré-encodage et suppression des métadonnées (E1-6) | Lot 2 | 0,5 j |
| **I-2** | Identifiant public de profil potentiellement séquentiel ou dérivé | `public_ref` aléatoire, distinct de l'identifiant de compte (§4, P5) | Lot 2 | 2 h |
| **I-3** | Empreinte de tête de la chaîne d'audit jamais publiée hors de la base | Envoi nocturne par e-mail transactionnel (§4, P8) | Lot 4 | 0,5 j |
| **I-4** | Dérogation « pas de Pull Request » appliquée aussi aux migrations touchant RLS, `GRANT`, audit et `SECURITY DEFINER` | Contrôle de CI exigeant le marqueur `security-reviewed:` dans le message de commit (§4, P8) ; un commit déjà poussé sans marqueur est couvert par un commit d'attestation ultérieur `security-reviewed: <date> covers <sha>…` (lui-même marqué ; sha ancêtres, inconnu ou ambigu = échec), jamais par réécriture de `main` (fondateur, 2026-10-08). **Bloquant sur la seule branche `production` ; signalé sans échec sur `main` (D71, 2026-10-18).** À défaut, lever la dérogation sur `supabase/migrations/**` | Lot 0 | 2 h |
| **I-5** | Une seule personne pour `agent` et `admin` sur un compte unique | Deux comptes distincts, ou étape d'élévation avec TOTP et motif (§1.3) | Lot 0 | 1 h |
| **I-6** | `staging` accessible publiquement | Restriction d'accès + `noindex` (§6.8) | Lot 1 | 2 h |
| **I-7** | Absence d'en-tête secret interne entre les fronts et `apps/api` | `x-influx-internal` vérifié par `apps/api` (PP-8) — un secret par front depuis D64 (`21` J1-G, soumis à la revue de fin de J2). *Complété le 2026-09-25 (revue de fin de J1, A4 et A5) :* **l'adresse relayée (`x-real-ip`) et le contrôle d'origine ne sont évalués qu'après cette vérification**, sur la surface qu'elle a identifiée | Lot 0 | 1 h |
| **I-8** | Fichier du passe-plat modifiable sans geste conscient | Test d'empreinte du fichier (PP-12) | Lot 1 | 1 h |
| **I-9** | Pas de détection d'exfiltration progressive de l'annuaire | Alerte sur le nombre de profils distincts consultés par compte sur 24 h (C(17)) | Lot 3 | 0,5 j |
| **I-10** | Pas de visibilité des sessions actives pour un membre | Écran « mes sessions » + déconnexion globale (A-12) | Lot 2 | 0,5 j |
| **I-11** | Pas de contrôle croisé des lectures de conversation | Contrôle nocturne X3 et revue hebdomadaire X4 (§5.3) | Lot 4 | 1 j |
| **I-12** | Pas de test de sécurité planifié hors commit | Exécution hebdomadaire de T12 (dépendances) | Lot 0 | 1 h |

### 9.3 À surveiller — risques acceptés et documentés

| # | Risque accepté | Pourquoi il est acceptable aujourd'hui | Ce qui le ferait remonter |
|---|---|---|---|
| **S-1** | **Aucun second facteur pour les membres** | Aucun moyen de paiement dans un compte membre au MVP (A1) | **L'arrivée de coordonnées bancaires en V2 : la validation tombe automatiquement** (§6.1) |
| **S-2** | **Une boîte e-mail compromise = un compte compromis** | Identique au cas « mot de passe + réinitialisation par e-mail ». Atténué par A-10, A-11, A-12 | Un incident réel, ou l'usage massif de boîtes génériques partagées côté marques |
| **S-3** | **6 chiffres d'entropie** | 5 essais sur 10⁶, un seul code valide, limitation à trois niveaux | Un taux d'échec de vérification anormal, ou un incident |
| **S-4** | **Aucune analyse antivirale des fichiers** | Images uniquement, validées par leurs octets, ré-encodées, jamais exécutées | L'ouverture d'un canal de documents (PDF), ou un signalement |
| **S-5** | **Preuve auto-produite** (registre chaîné) | Sa force vient de sa cohérence avec les e-mails détenus par des tiers | Un contentieux réel ⇒ horodatage qualifié par un tiers (V2) |
| **S-6** | **Sous-domaine plutôt que domaine distinct pour le backoffice** | `__Host-`, refus des cookies étrangers, hygiène DNS | Une prise de contrôle de sous-domaine, ou l'ouverture du backoffice à des tiers |
| **S-7** | **Le tableau de bord Supabase contourne tous les contrôles de ce document** | Peu de comptes, MFA, personnes de confiance | Toute personne supplémentaire ayant accès à la production ⇒ §10 |
| **S-8** | **Contrôle par les pairs impossible tant qu'une personne opère seule** | Procédure dégradée du §1.3, revue hebdomadaire | L'arrivée d'un second agent ⇒ bascule automatique (PD7) |
| **S-9** | **Drizzle en version pré-1.0** | Version épinglée, couche `repository` isolante | Une faille dans la génération de requêtes ⇒ traiter comme T12 |
| **S-10** | **Un seul worker, traitement au-moins-une-fois** | Clés d'idempotence sur chaque destination | Un doublon constaté côté Brevo ou Apollo |
| **S-11** | **GoTrue joignable sans `apps/api`** avec la clé *publishable* (`21` G-1, 2026-09-27) : un tiers peut consommer ou épuiser le code d'un membre, ou ouvrir une session GoTrue que rien dans INFLUX n'accepte | Aucune session INFLUX n'en sort (J3-C règle 3) ; épinglage du facteur et jeton d'enrôlement pour les comptes internes ; puits d'envoi ; clé *publishable* désactivée si le projet le permet | Un constat divergent au commit 7 (enrôlement ou changement de mot de passe accepté en `aal1`), ou une session GoTrue non corrélée à une connexion INFLUX dans `auth.audit_log_entries` |
| **S-12** | **Aucun pays pour les connexions** (`21` EC-43) : A-8, RG49, RG55 et B-7 sans pays | B-7 est un contrôle de détection derrière le TOTP ; signal « navigateur inconnu » à la place (J8) | L'activation d'une source de pays (nouvel avis `expert-conformite-rgpd`), ou une connexion interne illégitime non signalée |

---

## 10. Ce qui sort de mon périmètre

### 10.1 À valider par `expert-conformite-rgpd` — il a lui aussi un veto

Nous sommes binômes : je couvre la protection technique, il couvre la légalité du traitement. **Un
système parfaitement sécurisé peut être parfaitement illégal.** Les points suivants sont les siens, et
je m'y conformerai.

| # | Sujet | Pourquoi c'est lui et pas moi | Échéance |
|---|---|---|---|
| **R-1** | **Conservation du registre d'audit et de `conversation_access_log` au-delà d'une suppression de compte** : base légale, durée bornée, information des personnes | Sans mention explicite dans la politique de confidentialité, le droit de conserver la preuve n'existe pas — et tout le dispositif M4 perd son fondement | **Lot 1** |
| **R-2** | **Contenu exact des journaux** : je propose de n'écrire **que des identifiants de compte** dans le registre d'audit, et de cantonner l'adresse IP et l'agent utilisateur aux journaux techniques, avec une rétention courte (30 à 90 jours). À arbitrer | Minimisation et durée de conservation sont des questions de droit | Lot 1 |
| **R-3** | **Information des membres sur la supervision** (A10) : présence permanente d'un commercial nommé, **lecture possible par tout agent INFLUX au MVP**, journalisation de ces lectures, durée de conservation | Une supervision non annoncée est une supervision illicite | **Lot 1** |
| **R-4** | ✅ ***Tranchée le 2026-11-01 (fondateur, D79) : « identité masquée » / *identity hidden* dans les écrans, les e-mails et la landing ; « pseudonymisé » dans les documents légaux ; vocabulaire interne inchangé. Revue au Lot 6.*** **Vocabulaire du produit** : un profil « anonymisé » au sens d'A2 reste une **donnée personnelle** au sens du droit. L'interface et les documents ne doivent pas laisser croire à une anonymisation juridique | C'est un point de rédaction, pas de technique, et il engage | Lot 2 |
| **R-5** | ✅ ***Tranchée le 2026-11-01 (fondateur, D79) : pièces supprimées 45 jours après la décision, chiffres et empreinte conservés 3 ans, pièce trop large supprimée aussitôt. Revue au Lot 6.*** **Pièces de vérification contenant des données de tiers** (noms d'abonnés, commentaires) : base légale, minimisation, **durée de conservation après décision de badge**. Je propose : suppression 90 jours après la décision, conservation des seuls chiffres saisis par l'agent et d'une empreinte | Données de personnes qui ne sont pas nos utilisateurs et n'ont rien consenti | **Lot 2** |
| **R-6** | **Détections de coordonnées** : je pose la règle « type et position, jamais le texte détecté ». À confirmer, et à inscrire dans le registre des traitements | Minimisation | Lot 4 |
| **R-7** | **Exécution des demandes RGPD** : qui exécute, avec quel contrôle, ce qui est exclu de l'effacement (affaires, registre) et sur quel fondement | Son domaine exclusif | Lot 5 |
| **R-8** | **A7 / D33 — Apollo pour tous les inscrits** | **Son veto, pas le mien.** Je note seulement que l'interrupteur technique par catégorie de profil doit exister dès la conception, afin qu'une restriction exigée par le juriste soit un changement de configuration et non un redéveloppement | **Lot 1** |
| **R-9** | **Localisation des données** : région Supabase, région Railway, sous-traitants Brevo et Apollo, transferts, contrats de sous-traitance. Dépend de D25 | Conformité des transferts | Avant Lot 1 |
| **R-10** | **E-mails transactionnels d'authentification** : ils ne sont pas du marketing et ne se désabonnent pas comme une campagne. À confirmer et à distinguer clairement dans Brevo | Son domaine, et cela a un effet direct sur la disponibilité du produit (§6.1) | Lot 1 |

### 10.2 À arbitrer par le fondateur

Ces points ne sont pas techniques : ils engagent de l'argent, une organisation, ou un risque qu'il est
seul à pouvoir accepter.

| # | Décision | Ce qu'il faut savoir pour trancher |
|---|---|---|
| **F-1** | **Accepter l'authentification sans mot de passe pour les membres, et sa clause de caducité** | Vos utilisateurs se connecteront avec un code à six chiffres reçu par e-mail. Je le valide **parce qu'au MVP un compte ne contient aucune coordonnée bancaire**. Le jour où l'encaissement entre dans l'application, un second facteur deviendra obligatoire. Ce n'est pas une opinion : c'est la condition de ma validation d'aujourd'hui |
| **F-2** | **Créer le compte administrateur de secours « bris de glace »** et sceller physiquement ses codes | **Une heure de votre temps, et c'est la mesure la plus rentable de tout ce document.** Sans elle, la perte d'un téléphone peut rendre INFLUX non administrable, ou pousser quelqu'un à improviser une porte dérobée dans l'urgence |
| **F-3** | **Activer le second facteur sur les comptes Supabase, GitHub et Railway, et limiter le nombre de personnes qui y ont accès** | **Ces trois comptes contournent absolument tous les contrôles décrits ici.** Depuis le tableau de bord Supabase, on lit n'importe quelle conversation sans laisser de trace dans notre journal. Aucune protection applicative ne remplace la protection de ces trois comptes |
| **F-4** | **Lever la dérogation « pas de Pull Request » pour le seul dossier `supabase/migrations/**`**, ou accepter le contrôle de CI de repli (I-4) | Une migration peut, en une ligne, redonner un droit que tout ce document retire. C'est le seul endroit où l'absence de relecture croisée me gêne réellement |
| **F-5** | **Deux comptes distincts (ou une étape d'élévation) pour la personne qui cumule `agent` et `admin`** | Coût : une connexion supplémentaire dans la journée. Bénéfice : un journal lisible et un compte quotidien qui ne porte pas les droits les plus lourds |
| **F-6** | **Accepter que la « double validation » soit un contrôle affaibli tant qu'une seule personne opère** | Elle protège contre l'erreur et la précipitation, **pas contre la malveillance**. Pendant cette période, INFLUX repose sur la confiance accordée à cette personne. C'est un risque accepté, pas un risque couvert |
| **F-7** | **Interdire toute restauration de données de production vers `staging`** sans votre autorisation écrite et sans anonymisation | C'est le mode de fuite le plus banal de l'industrie, et il arrive toujours « juste pour reproduire un bogue » |
| **F-8** | **Accepter que l'adresse du backoffice soit publiquement découvrable** | Elle apparaîtra dans les journaux publics de certificats. L'isolement du backoffice vaut par son durcissement, pas par son secret. Personne ne doit se reposer sur le fait qu'on ne la connaît pas |
| **F-9** | **Budgéter un test d'intrusion externe avant l'ouverture du pilote (Lot 6)** | Ordre de grandeur : 3 à 6 jours d'intervention. À arbitrer selon le budget. **Rappel : je n'exécuterai aucun test intrusif sur un environnement de production sans votre autorisation écrite** |
| **F-10** | **D40 — masquage symétrique des coordonnées côté marque** | Tant que c'est ouvert, j'applique la valeur d'attente conservatrice (coordonnées de marque masquées). Si vous tranchez dans l'autre sens, le mécanisme sera le même que pour les créateurs : deux objets, pas un filtre. **Mieux vaut trancher avant le Lot 2** |

---

## 11. Mises à jour attendues dans les autres documents

| Document | Ce qui doit y être repris | Par qui |
|---|---|---|
| `docs/mvp/02-architecture-3-espaces.md` §2.5 et §10 | La correction B1 (quatre rôles Postgres) et B2 (`service_role` non utilisé). Les deux touchent des affirmations aujourd'hui inexactes | `architecte` |
| `docs/mvp/04-modele-de-donnees-mvp.md` | Schémas par domaine (P6), forme des deux objets créateur (P5), append-only (P8), fonctions `SECURITY DEFINER` (P7), coût mesuré de `influx.current_account_role()` (P3) | `expert-database` |
| `docs/mvp/18-plan-de-test-mvp.md` | Les tests T1 à T19 du §8 (**T18 et T19 à reprendre**, ajoutés après la rédaction de `18`), et les contrôles X1 à X4 du §5.3 | `testeur` |
| `CLAUDE.md` §6 et §13 | D37 passée à « tranchée et **validée sous conditions** par `expert-cybersecurite` », avec renvoi au §6.1 du présent document et mention de la **clause de caducité** en V2 | `chef-de-projet` |
| `docs/legal/` (Lot 1) | Supervision des conversations (A10), journalisation des lectures, conservation probatoire du registre, pièces de vérification | `expert-conformite-rgpd` |
| `.claude/skills/env-secrets/SKILL.md` | La distinction entre la **clé HTTP** `SUPABASE_SECRET_KEY` et le **rôle Postgres** `service_role`, ce dernier n'étant plus utilisé ; l'ajout de `x-influx-internal` | `integrateur` + `expert-cybersecurite` |

---

**Ce document ne modifie aucun autre fichier.** Il n'introduit aucun code applicatif, aucune migration
et aucun fichier dans `apps/`, `packages/` ou `supabase/` : les extraits SQL qu'il contient sont des
**illustrations de référence** destinées à `expert-database` et à `dev-react-node`, pas des migrations.
