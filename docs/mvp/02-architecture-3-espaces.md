# Architecture des trois espaces — D12, D2, D5, D18 et D37 tranchées

> **Date :** 2026-09-18 · **Auteur :** agent `architecte` · **Statut :** décisions prises, applicables au Lot 0
> **Skills appliquées :** `supabase-schema`, `lead-pipeline`, `env-secrets`
>
> **Ce que ce document tranche :** la place du backoffice (**D12**), le framework backend Node
> (**D2**), la couche d'accès aux données (**D5**), le mécanisme de file des leads (**D18**) et la
> méthode d'authentification (**D37**, ouverte le 2026-09-18). Il fige la structure du dépôt, le
> contrat entre l'API et les fronts, la frontière entre ce que fait la RLS et ce qu'elle ne peut pas
> faire, et la sortie du mode maquette de `apps/web`.
>
> **Ce qu'il ne tranche pas :** le modèle de données détaillé (`expert-database`, document `04`), la
> matrice des droits et les politiques RLS ligne à ligne (`expert-cybersecurite` + `architecte`,
> document `03`), le plan de test (`testeur`, document `18`), la configuration Railway concrète
> (`integrateur`, Lot 0).
>
> **À lire avec :** `docs/mvp/00-cadrage-mvp-v2.md` (périmètre, 7 lots), `docs/mvp/01-intermediation-courtee.md`
> (**document pivot, il contraint ce document**) et `docs/landing-page/01-architecture.md` (D1, D3,
> D4, D28 tranchées le 2026-09-16, socle de `apps/web`).
>
> **Source de vérité :** `CLAUDE.md`. En cas d'écart, `CLAUDE.md` prime et c'est ce document qui est
> corrigé.

---

> ## ⚠ Révision du 2026-09-18 — après revue de `expert-cybersecurite`
>
> `expert-cybersecurite` a rendu son avis dans **`docs/mvp/03-matrice-des-droits-et-rls.md`** :
> **favorable sous conditions**. Aucune des cinq décisions (D12, D2, D5, D18, D37) n'est remise en
> cause. Trois constats bloquants portaient sur **mon texte** et sont corrigés dans cette version :
>
> | Constat | Ce qui était écrit | Ce qui est corrigé |
> |---|---|---|
> | **B1** | Le §2.5 fondait l'anonymisation sur « aucun `GRANT` au rôle annonceur », présenté comme un acquis plus fort qu'une politique | **Inexact en configuration Supabase standard** : `advertiser`, `creator`, `agent` et `admin` y sont **le même rôle Postgres `authenticated`**. Il n'existe alors aucun rôle annonceur à qui refuser un droit, et la protection ne tient que par **un seul** contrôle. Le §2.5 énonce désormais cela comme une **condition à créer** : quatre rôles Postgres distincts et un `SET LOCAL ROLE` par transaction. Corrigé aussi aux §0, §5, §9.3, §10.1 et §15 |
> | **B2** | Le §10 autorisait des opérations en `service_role`, rôle `BYPASSRLS` | **Le rôle Postgres `service_role` n'est plus utilisé nulle part.** Remplacé par des rôles d'exécution dédiés **sans `BYPASSRLS`** et par la **liste fermée de cinq opérations élevées** (E-1 à E-5) du document `03` §P7. La **clé d'API HTTP** `SUPABASE_SECRET_KEY` reste, pour Auth et les URL signées : ce sont deux objets différents qui portent le même nom |
> | **B3** | La question « schémas par domaine ou schéma unique » était laissée ouverte (§14.2, n° 5) | **Tranchée : schémas par domaine**, pour raison de sécurité. Aucune table métier dans `public`, `REVOKE ALL` sur `anon` et `authenticated` |
>
> Les passages révisés portent la mention **« Révisé le 2026-09-18 (revue `expert-cybersecurite`) »**.
> Pour la matrice des droits complète, les politiques et les tests exigibles, ce document renvoie
> désormais à `docs/mvp/03-matrice-des-droits-et-rls.md`, qui fait foi sur ces sujets.

---

## 0. Synthèse

| # | Sujet | Décision | Réversibilité |
|---|---|---|---|
| **D12** | Place du backoffice | **Deux applications, trois espaces.** `apps/backoffice` séparée (hôte distinct, Next.js, `noindex`, MFA obligatoire, session courte) ; espace marque et espace créateur dans `apps/web` | **Élevée** dans le sens qui compte (fusionner plus tard est mécanique) |
| **D2** | Framework backend Node | **Fastify 5** dans `apps/api`, avec un **worker** issu du même paquet et déployé comme service Railway distinct | Moyenne |
| **D5** | Accès aux données | **Drizzle** comme constructeur de requêtes typé ; **migrations en SQL pur** dans `supabase/migrations` ; `@supabase/supabase-js` **cantonné à `apps/api`** (Auth et URL signées du Storage) | Moyenne à élevée (couche `repository` par domaine) |
| **D18** | File des leads | **Table `outbox_events` + worker `FOR UPDATE SKIP LOCKED`**, priorité aux révocations, verrou consultatif **de transaction** par sujet. Ni Redis, ni BullMQ, ni pgmq | **Élevée** |
| **D37** | Authentification | **Membres : code à usage unique à 6 chiffres par e-mail, sans mot de passe.** **Backoffice : mot de passe + TOTP obligatoire, `aal2` vérifié côté serveur et en RLS.** Session en cookie `httpOnly` posé par `apps/api`, aucun jeton en JavaScript | Élevée (ajouter le mot de passe coûte 2-3 jours) |
| **Règle** | Front ↔ Supabase | **Le front ne parle jamais directement à Supabase pour de la donnée métier.** Il parle à `apps/api`. Les fronts ne portent **aucune clé Supabase**, pas même `anon` | Faible à défaire, et c'est voulu |
| **Règle** | Anonymisation | **Séparation d'objets en base**, pas filtre de colonnes en code — **et cela suppose de créer quatre rôles Postgres distincts** (`influx_advertiser`, `influx_creator`, `influx_agent`, `influx_admin`), sans quoi il n'existe aucun rôle annonceur à qui refuser un droit. La révélation est une politique SQL. *Révisé le 2026-09-18 (revue `expert-cybersecurite`, B1)* | Faible à défaire, et c'est voulu |
| **Règle** | Rôles d'exécution | **Aucun rôle utilisé à l'exécution n'a `BYPASSRLS` ni `SUPERUSER`.** Le rôle Postgres `service_role` n'est utilisé nulle part. *Ajouté le 2026-09-18 (revue `expert-cybersecurite`, B2)* | Faible à défaire, et c'est voulu |
| **Règle** | Schémas | **Aucune table métier dans `public`** : un schéma Postgres par domaine, `REVOKE ALL` sur `anon` et `authenticated`. *Ajouté le 2026-09-18 (revue `expert-cybersecurite`, B3)* | Faible après le Lot 0 |
| **Exposition** | `apps/api` | **Non exposée publiquement.** Les fronts l'atteignent par le réseau privé Railway, via un passe-plat sans logique. Ni CORS, ni cookie inter-sites | Élevée |

**Trois conséquences à retenir si vous ne lisez que cette page.**

1. Il y aura **quatre services par environnement** sur Railway (`web`, `backoffice`, `api`,
   `worker`), soit huit au total, et **deux projets Supabase** (`staging`, `production`). C'est un
   coût que le fondateur doit valider (§16).
2. **Aucune clé Supabase n'atteint jamais un navigateur.** C'est plus strict que l'orientation du
   plan (« la clé `anon` ne sert qu'à la session ») : la session elle-même est gérée côté serveur.
3. **Il n'y a pas de mot de passe pour les membres au MVP.** C'est une décision de produit autant
   que de sécurité, elle doit être vue par le fondateur et validée par `expert-cybersecurite`.

---

## 1. Ce que le métier impose à l'architecture

Les contraintes ci-dessous ne sont pas des préférences techniques : elles viennent de
`docs/mvp/00-cadrage-mvp-v2.md` et `docs/mvp/01-intermediation-courtee.md`, et **chacune élimine au
moins une option** dans les sections qui suivent.

| # | Contrainte métier | Origine | Ce qu'elle impose techniquement |
|---|---|---|---|
| **C1** | La marque cherche des créateurs **anonymisés** : pseudos, `@`, liens, captures masqués tant que la mise en relation n'est pas ouverte | A2, D16 | L'anonymisation doit être **exécutoire en base**, et les requêtes doivent être **écrites par le serveur**, jamais par le navigateur (k-anonymat, pagination plafonnée, export interdit sont des règles de *forme de requête*, pas de ligne) |
| **C2** | Trois déclencheurs alimentent une **file de validation** ; la proposition INFLUX la court-circuite mais produit le même objet | A3bis, doc 01 §4 | Un objet `introduction` unique, un service applicatif qui porte la machine à états, et une opération **transactionnelle** : révélation + conversation + événement chaîné + e-mails, tout ou rien |
| **C3** | Conversation à trois, commercial **visible et nommé** ; **chaque lecture par un agent est journalisée** | A3, A10 | Une politique RLS ne sait pas écrire une ligne : il faut une fonction `SECURITY DEFINER` et **retirer tout autre chemin de lecture** au rôle agent |
| **C4** | Registre d'audit **append-only chaîné**, impossible à réécrire | M4 | `REVOKE UPDATE, DELETE` + trigger + chaînage par empreinte + **sérialisation des écritures** + vérification périodique. Rien de tout cela n'est exprimable dans un ORM |
| **C5** | Contrat et paiement **hors application** ; le commercial saisit montant et commission | A1, A8 | **Aucun taux, aucune multiplication** nulle part. Table `commission_rates` créée et vide |
| **C6** | Un lead non synchronisé est un lead perdu ; un échec Brevo/Apollo ne fait jamais échouer une inscription | `CLAUDE.md` §7, skill `lead-pipeline` | File **persistée et transactionnelle** : l'événement s'écrit dans la même transaction que le fait métier |
| **C7** | Le backoffice voit **toutes les identités, toutes les conversations, toutes les affaires** | §6.3 du cadrage | Surface privilégiée : isolement d'hôte, MFA, session courte, et **aucune autorisation par masquage d'UI** |
| **C8** | Mise en ligne progressive **dès le Lot 1** (semaine 5) | A6 | Le socle doit être livrable en 1-2 semaines et supporter un site public déjà en production pendant qu'on construit le reste |
| **C9** | Un développeur à plein temps, des agents IA, un poste Windows | §7 du cadrage | Peu de pièces, outils standard, mêmes commandes en local et en CI. **Toute complexité doit se payer en sécurité ou en vitesse, sinon elle est refusée** |

---

## 2. La règle architecturale centrale

### 2.1 L'énoncé

> **Le front ne parle jamais directement à Supabase pour de la donnée métier. Il parle à `apps/api`.**
>
> Corollaire retenu ici, plus strict que l'orientation du plan : **les fronts ne portent aucune clé
> Supabase, pas même `anon`.** La session elle-même est gérée par `apps/api`.

### 2.2 Pourquoi — cinq raisons, par ordre de force

Il faut être honnête sur un point avant de défendre la règle : **Supabase, correctement configuré,
*peut* faire respecter l'anonymisation.** La RLS avec refus par défaut et des `GRANT` de colonnes
bien posés sont un mécanisme solide. Le problème n'est pas que ce soit impossible — c'est que ce
soit **impossible à garantir dans la durée avec un développeur et des agents IA**.

1. **La surface de la règle devient le schéma entier, pour toujours.** Si le navigateur peut
   interroger PostgREST, alors *chaque* table, *chaque* vue et *chaque* fonction atteignable par le
   rôle `authenticated` doit être correcte — y compris celle qu'on ajoutera dans la précipitation au
   Lot 5. Un `REVOKE` oublié sur une colonne ajoutée casse l'anonymisation **silencieusement** : pas
   d'erreur, pas de test rouge, pas de trace en revue. Avec une API, ajouter une colonne ne l'expose
   pas : il faut l'ajouter au schéma de réponse, et cet ajout se voit dans une Pull Request.
2. **Les garde-fous de la recherche sont des règles de *forme de requête*, pas de ligne.**
   K-anonymat à 5, pagination plafonnée, limitation de débit, journalisation des recherches, export
   interdit (cadrage §10.2 et document `10`) : **aucune** de ces règles ne s'exprime en politique
   RLS. Elles supposent que quelqu'un d'autre que le navigateur écrive la requête. Un point d'accès
   PostgREST laisse le client choisir `select`, `order`, `limit`, `offset` et les jointures : il
   contourne les cinq d'un coup.
3. **A10 exige de journaliser des lectures.** Une lecture directe depuis le navigateur ne laisse
   aucune trace applicative que nous maîtrisons. Les journaux PostgREST ne sont ni un journal
   d'audit, ni conservables, ni attribuables à un acte métier.
4. **La révélation d'identité doit être atomique.** Le document `01` §3, étape 5, l'écrit :
   « Immédiat, dans une seule transaction » — poser `identity_revealed_at`, créer la conversation et
   ses trois participants, écrire l'événement chaîné, mettre les deux e-mails en file.
   **PostgREST ne sait pas faire de transaction multi-requêtes.** On pourrait tout enfermer dans une
   fonction SQL, mais on aurait alors écrit l'API en PL/pgSQL — le pire des deux mondes.
5. **Le schéma deviendrait l'API publique.** Chaque nom de colonne, chaque type, chaque énumération
   serait un contrat exposé au navigateur : toute migration devient un changement cassant pour le
   front, et le renommage d'une colonne un sujet de coordination.

### 2.3 Ce qu'elle coûte — sans l'enjoliver

| Coût | Ampleur | Atténuation |
|---|---|---|
| Un point d'accès par écran, au lieu d'une requête écrite dans le composant | ~1 schéma zod + 1 gestionnaire + 1 fonction de dépôt par écran, soit un surcoût réel de l'ordre de **20 à 30 %** du temps de développement d'un écran de lecture | Les schémas servent aussi de validation d'entrée, de filtre de sortie et de types partagés : une partie du coût est rendue |
| Un saut réseau de plus (front → api) | Quelques millisecondes sur le réseau privé Railway, même région | Mesuré, jamais supposé. Si la latence devient un sujet, elle se règle par mise en cache, pas par exposition de la base |
| Pas d'abonnement temps réel gratuit depuis le navigateur | Nul au MVP : la messagerie temps réel est **hors périmètre** (cadrage §8) | Rafraîchissement périodique. Le temps réel se rouvrira avec un canal serveur (SSE depuis `apps/api`) |
| Deux applications de plus à déployer et à surveiller | 4 services Railway par environnement | `integrateur` automatise au Lot 0, une fois |
| Le téléversement de fichiers ne peut pas passer « tout seul » | Le navigateur doit obtenir une autorisation | Exception n° 2 ci-dessous |

### 2.4 Les deux seules exceptions, nommées et bornées

| # | Exception | Pourquoi elle est acceptable | Garde-fou |
|---|---|---|---|
| **E1** | **Le navigateur téléverse un fichier directement vers Supabase Storage**, avec une **URL signée émise par `apps/api`** | Faire transiter des visuels de portfolio par `apps/api` gaspillerait de la bande passante et de la mémoire sans rien apporter : l'URL signée porte une autorisation unique, limitée à un chemin, une méthode et une durée | *Révisé le 2026-09-18 (revue `expert-cybersecurite`, point 6).* L'URL est émise après contrôle par `apps/api` (rôle, propriétaire, taille, type), sa durée de vie est **courte** (≤ 5 min), son émission est **journalisée**. Aucun jeton, aucune clé n'est remis au navigateur. **Compartiments privés et séparés par sensibilité** (`portfolio`, `verification`), avec limites de type et de taille **réglées au niveau du compartiment** — c'est la seule limite que Supabase applique réellement au téléversement direct. **Chemin de l'objet calculé par le serveur, jamais le nom de fichier d'origine** (`story-marie-dupont-instagram.png` révèle exactement ce que A2 protège, et un nom de fichier voyage dans les URL signées, les journaux et les en-têtes `Referer`). Après téléversement : vérification du type réel par les octets d'en-tête et **ré-encodage des images pour supprimer les métadonnées EXIF** — une capture d'écran de téléphone porte fréquemment une géolocalisation. **Exception à l'exception : la LECTURE d'une pièce de vérification ne passe jamais par une URL signée remise au navigateur** ; elle transite par `apps/api`, qui journalise chaque consultation. Une URL signée qui fuite est une pièce d'identité qui circule |
| **E2** | **Le navigateur est redirigé vers un fournisseur externe** si un jour un `OAuth` est ouvert (D37, hors MVP) | La redirection est le protocole ; il n'y a pas d'alternative | Flux PKCE **initié et terminé par `apps/api`** ; le vérificateur ne quitte pas le serveur |

Toute autre exception passe par `architecte` **et** `expert-cybersecurite`, par écrit, dans ce
document.

### 2.5 Corollaire — l'anonymisation est une séparation d'objets

> **Révisé le 2026-09-18 (revue `expert-cybersecurite`, constat bloquant B1).** La version initiale
> de cette section fondait l'anonymisation sur « aucun `GRANT` au rôle annonceur sur l'objet
> identifiant », et présentait cette absence de droit comme **acquise** et « plus forte qu'une
> politique ». **C'était inexact.** En configuration Supabase standard, `advertiser`, `creator`,
> `agent` et `admin` sont **le même rôle Postgres : `authenticated`**. Il n'existe donc, par défaut,
> **aucun rôle annonceur à qui refuser un droit** : la protection ne reposerait que sur **un seul**
> contrôle — la politique RLS — alors que ce document en annonçait deux. La section est réécrite pour
> énoncer la séparation de rôles comme **une condition à créer au Lot 0**, et non comme un acquis.

> **L'anonymisation n'est pas un filtre de colonnes en code. C'est une séparation d'objets en base,
> doublée d'une absence de droit — et cette absence de droit n'existe que si l'on crée d'abord les
> rôles qui la portent.**

#### Condition préalable : quatre rôles Postgres distincts *(BLOQUANT, Lot 0)*

| Rôle Postgres | Porté par | Connexion directe |
|---|---|---|
| `influx_app` | Rôle de **connexion** de `apps/api`. Ni propriétaire, ni `BYPASSRLS`, ni `SUPERUSER`, **ni membre d'un rôle élevé** | Oui, c'est lui qui est dans `DATABASE_URL` |
| `influx_advertiser` · `influx_creator` · `influx_agent` · `influx_admin` | Rôles **sans droit de connexion**, dont `influx_app` est membre | Non |

Chaque transaction utilisateur prend le rôle correspondant à l'utilisateur, **après avoir lu son rôle
métier en base** (§7, précision 2), puis pose ses réclamations :

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

**Ce que la séparation de rôles apporte concrètement**, et qui n'existe pas sans elle :

- les `GRANT` et `REVOKE` deviennent **réels, par rôle, et lisibles dans la migration** ;
- les politiques s'écrivent `TO influx_advertiser`, donc elles se relisent ;
- une politique mal écrite sur une table ajoutée dans la précipitation au Lot 5 est **rattrapée par
  l'absence de `GRANT`** — c'est-à-dire la défense en profondeur que ce document promettait ;
- `influx_app` ne doit **pas** être membre d'un rôle élevé, faute de quoi un `RESET ROLE` ou un
  `SET ROLE` dans la même session rendrait la séparation inopérante. Les accès élevés passent par
  d'**autres grappes de connexions**, avec un autre rôle et une autre variable d'environnement (§5).
  *Précisé le 2026-09-26 (`21` EC-1, EC-20) :* une grappe, un rôle de connexion et une variable
  **par rôle élevé** — liste fermée : `03` §4 P7, « Les rôles Postgres — liste fermée ».

**Effort : une demi-journée à une journée au Lot 0.** Coût de ne pas le faire : l'invariant produit
A2 ne tient que par un fil.

#### La séparation d'objets

| Objet | Contenu | `GRANT SELECT` accordé à |
|---|---|---|
| `profiles.creator_public_profiles` (**anonymisé**) | Thématiques, pays, tranches d'audience, formats, tarifs indicatifs, portfolio **modéré**, badge et sa date, identifiant public **opaque et aléatoire** | `influx_advertiser`, `influx_creator`, `influx_agent`, `influx_admin` |
| `profiles.creator_identities` (**identifiant**) | Nom légal, pseudos, `@`, liens de réseaux, captures, coordonnées, pièces de vérification | `influx_creator` (lui-même), `influx_agent`, `influx_admin`. **Aucun `GRANT` à `influx_advertiser`** |

Règles d'exécution, non négociables :

1. **Deux tables, jamais une table et une vue.** Une vue `security_invoker = true` exige de l'appelant
   les droits sur la table sous-jacente : l'annonceur devrait donc obtenir un `GRANT` sur l'objet
   identifiant, ce qui annulerait tout l'intérêt. Et une vue **sans** `security_invoker` s'exécute
   avec les droits de son propriétaire et **contourne la RLS des tables sous-jacentes** — le piège
   classique, qui annulerait le dispositif entier. Toute vue que nous créons porte
   `security_invoker = true`, sans exception.
2. **La révélation est exposée à l'annonceur par un chemin unique et étroit** : une vue
   `security_invoker = true` `profiles.creator_identities_revealed`, dont le prédicat porte la
   condition de révélation. **C'est une politique SQL, jamais un `if` applicatif :**
   `USING (EXISTS (SELECT 1 FROM matching.introductions i WHERE i.creator_id = creator_identities.creator_id
   AND i.advertiser_id = influx.current_advertiser() AND i.identity_revealed_at IS NOT NULL))`.
   Formulation de référence et conditions d'accès complètes : `docs/mvp/03-matrice-des-droits-et-rls.md`
   §3.2 C(11) et §P5, qui font foi. Types et index : `expert-database`, document `04`.
3. **L'identifiant public est opaque, aléatoire, et distinct de l'identifiant de compte.** Jamais une
   séquence (elle divulgue l'ordre d'inscription et permet l'énumération), jamais dérivé de
   l'identifiant de compte (la corrélation entre les deux couches deviendrait triviale côté client).
4. **Deuxième ligne de défense côté API :** toute route déclare un **schéma de réponse**, et le
   sérialiseur de Fastify supprime tout ce qui n'y figure pas (§4). Si une colonne identifiante
   s'échappait de la base, elle ne sortirait pas de l'API.
5. **Troisième ligne : un test.** Pour chaque route accessible au rôle annonceur, un test vérifie
   qu'aucun champ identifiant n'apparaît dans la réponse, y compris quand la base en contient.
   Ce test appartient au document `18` (`testeur`).
6. **Aucun annonceur n'accède jamais à une pièce de vérification**, y compris après révélation et y
   compris avec l'accord du créateur : ces captures contiennent des données personnelles **de tiers**
   (document `03` §3.2, C(13)).
7. **Le masquage côté marque (D40)** suivra exactement le même mécanisme s'il est retenu : deux
   objets, pas un filtre.

---

## 3. D12 — Place du backoffice

### Contexte

Le backoffice est le seul endroit d'INFLUX qui voit **toutes les identités de créateurs, toutes les
conversations et toutes les affaires** (C7). C'est aussi la surface qui porte les actions les plus
lourdes de conséquences : validation d'une mise en relation, révélation d'identité, suspension d'un
compte, envoi d'e-mails, saisie des montants. D12 était ouverte depuis le 2026-09-16 ; le cadrage du
2026-09-18 la rend décidable, parce qu'il dit enfin ce que le backoffice contient.

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Espace protégé de `apps/web`** (groupe de routes `/(ops)`) | Une seule application, un seul déploiement, une seule session, un seul jeu de composants et de tokens ; le moins de travail au Lot 0 | **Rayon d'explosion partagé** : même processus, même bundle, même origine, même cookie, même CSP, mêmes dépendances que le site public. Une faille de routage ou de rendu expose la surface la plus sensible du produit. Un import maladroit fait fuiter du code ou des données d'agent dans le bundle public. Aucun durcissement différencié possible (MFA, session courte, liste d'IP) sans le subir côté public |
| **B. Application Next.js séparée `apps/backoffice`, hôte distinct** | Cookie de session **scoped à l'hôte** : une faille XSS du site public ne peut pas le lire ni l'envoyer ; CSP, durée de session, MFA et limitation de débit propres ; `noindex` au niveau de l'hôte ; service Railway indépendant, arrêtable seul ; mêmes outils que `apps/web` (Tailwind, tokens, ESLint, Vitest), donc **un seul modèle mental pour le développeur** | Une application de plus à créer, déployer et maintenir ; quelques primitives UI à partager (→ `packages/ui`) ; un nom de domaine de plus |
| **C. Application SPA Vite séparée** | Aucune surface de rendu serveur, donc aucune exposition à la classe de failles « rendu serveur » de Next.js | **Deux frameworks front dans le dépôt** pour un seul développeur : deux chaînes de build, deux configurations ESLint, deux façons de router, deux façons de charger les tokens. Coût permanent, gain marginal une fois que le serveur Next du backoffice ne fait plus que servir une coquille (voir la décision) |
| **D. Outil tiers (Retool, Forest Admin, Supabase Studio)** | Rien à développer au départ | Exige de donner à un tiers un accès large à la base, donc à **toutes les identités et toutes les conversations** : contraire à A2 et A10, et un sous-traitant de plus à contractualiser. La file de validation, la conversation à trois et le pipeline commercial sont des **parcours métier**, pas des tableaux CRUD : ils seraient inutilisables (A3bis exige « trois clics ») |

### Grille

| Critère (poids) | A. Espace de `web` | **B. App séparée Next** | C. App séparée Vite | D. Outil tiers |
|---|---|---|---|---|
| Stack imposée, Railway, Supabase (éliminatoire) | Oui | Oui | Oui | **Non** (accès tiers à la base) |
| Isolement de la surface privilégiée (fort) | **Faible** | Élevé | Élevé | Faible |
| Simplicité pour un effectif d'un développeur (fort) | Élevée | Moyenne | **Faible** (2 frameworks) | Élevée au départ, faible ensuite |
| Coût de sortie / réversibilité (fort) | Faible, mais **dans le mauvais sens** (scinder plus tard) | **Élevée** (fusionner plus tard est mécanique) | Moyenne | Faible |
| Adéquation aux parcours métier (A3bis : trois clics) | Bonne | **Bonne** | Bonne | Mauvaise |
| Coût d'exploitation (moyen) | Nul | 1 service + 1 domaine | 1 service + 1 domaine | Abonnement |

### Décision : **B — deux applications, trois espaces**

```
apps/web          →  app.influx.<tld>   public + espace marque + espace créateur
apps/backoffice   →  ops.influx.<tld>   espace commercial + espace admin
apps/api          →  réseau privé Railway, AUCUN hôte public
```

L'espace marque et l'espace créateur **restent dans `apps/web`** : ils partagent
l'authentification, le design, la messagerie, la session et la moitié des écrans. Les séparer
serait de la sur-ingénierie — ils n'ont pas de différence de privilège, seulement une différence de
rôle, que la RLS et les contrats d'API traitent déjà.

**L'argument décisif est la CVE-2025-29927** (mars 2025) : un en-tête HTTP forgé,
`x-middleware-subrequest`, permettait de **court-circuiter entièrement le middleware de Next.js**.
Ce document citait déjà cette faille le 2026-09-16 pour justifier la règle « le proxy ne sert jamais
à autoriser ». Cette règle reste vraie, mais elle ne suffit pas ici : ce qui compte, c'est que dans
l'option A, **une faille de routage, de rendu ou de cache dans l'application publique donnerait
accès à la surface backoffice du même processus**. Next.js a connu deux failles critiques en
dix-huit mois (la seconde, CVE-2025-55182, une exécution de code à distance via les composants
serveur React). La discipline de mise à jour est nécessaire ; l'isolement est ce qui rend la
prochaine faille survivable.

**Le durcissement fait partie de la décision** (mise en œuvre détaillée : document `03`) :

| Mesure | Détail |
|---|---|
| Hôte distinct | Sous-domaine dédié, non référencé, jamais lié depuis le site public |
| Non-indexation | En-tête `X-Robots-Tag: noindex, nofollow` sur **toutes** les réponses. **Pas** de `Disallow` global dans `robots.txt` : un chemin interdit n'est pas exploré, donc la consigne `noindex` n'est jamais lue et l'URL peut malgré tout être indexée |
| Cookie | Nom préfixé `__Host-`, donc `Secure`, `Path=/`, **sans attribut `Domain`** : le cookie ne peut pas être partagé avec l'hôte public. `SameSite=Strict` |
| MFA | **Obligatoire** (D37, §7). `aal2` vérifié par `apps/api` **et** dans les politiques RLS |
| Session | 8 h maximum, inactivité 30 min, ré-authentification pour les actions sensibles (export, suppression, envoi d'e-mails) |
| Inscription | **Impossible.** Les comptes agent et admin sont créés par invitation d'un admin, jamais par un formulaire public |
| En-têtes | CSP propre, plus stricte que celle du site public (aucune image distante, aucun script tiers, `frame-ancestors 'none'`) |
| Langue | **Français uniquement** au MVP (D36 ouverte) : `apps/backoffice` **n'embarque pas next-intl** tant que D36 n'est pas tranchée. C'est autant de travail en moins, et un `packages/i18n` non créé |

### Conséquences

- **Code :** une application Next.js supplémentaire, App Router, mêmes conventions que `apps/web`
  (tokens, Tailwind, ESLint, Vitest), **sans next-intl, sans contenu fictif, sans SEO**. Le serveur
  Next du backoffice ne rend qu'une coquille et **ne lit jamais la base** : toutes les données
  viennent de `apps/api`.
- **Déploiement :** un service Railway de plus par environnement, un domaine de plus, un certificat
  de plus.
- **Coûts :** un service Railway léger (le backoffice sert quelques dizaines de sessions), un nom de
  domaine ou un sous-domaine.
- **Sécurité :** c'est l'objet de la décision. Le point à ne pas rater est que **l'isolement d'hôte
  n'est une protection que si la session n'est pas partagée** — d'où le cookie sans attribut
  `Domain` et le passe-plat de §9.3.
- **UX :** `expert-ux` produit deux systèmes cohérents mais distincts. Le backoffice est dense
  (tableaux, files, filtres) ; il consomme les mêmes tokens, pas les mêmes gabarits.

### Si l'on se trompe

Si maintenir deux applications se révèle trop lourd pour un développeur, **fusionner est
mécanique** : déplacer les routes de `apps/backoffice/src/app/**` dans un groupe de routes de
`apps/web`, unifier la session, supprimer un service Railway. Une à deux journées.

L'inverse — extraire un backoffice d'une application publique — coûte le même travail **plus** une
migration de session, **plus** la période pendant laquelle le risque a existé. On choisit donc la
séparation maintenant, parce que c'est le sens dans lequel l'erreur se rattrape le moins cher.

### Réversibilité

**Élevée** dans le sens utile (fusionner). Faible dans l'autre, et c'est précisément pourquoi on
tranche ainsi.

---

## 4. D2 — Framework backend Node

### Contexte

`apps/api` porte les domaines `identity`, `profiles`, `campaigns`, `search`, `verification`,
`matching`, `messaging`, `billing`, `leads`, `backoffice`. Il détient **seul** les secrets serveur,
il est le seul à ouvrir des transactions, il écrit le registre chaîné (par des fonctions dédiées,
jamais sous un rôle qui contourne la RLS), et il fournit le même contrat à deux fronts. Il doit en
outre fournir un **processus de fond** (C6) que le modèle de requête/réponse ne couvre pas.

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Fastify 5** | Validation **par schéma**, entrée *et sortie*, branchée sur zod via un fournisseur de types : les schémas de `packages/contracts` deviennent la validation d'exécution, pas seulement des types. **Sérialisation par schéma de réponse : ce qui n'est pas déclaré ne sort pas** (deuxième ligne de défense de l'anonymisation, §2.5). Journalisation structurée `pino` native avec identifiant de requête (matière du journal d'audit). Encapsulation par greffon = frontières de domaines naturelles. `fastify.inject()` : tests de bout en bout sans serveur ni navigateur | Écosystème plus petit qu'Express ; conventions propres à apprendre (greffons, décorateurs, cycle de vie) |
| **B. Express 5** | Le plus répandu, le plus documenté, le plus simple à lire ; stable ; depuis la v5, les rejets de promesses sont bien transmis au gestionnaire d'erreurs | Ni validation, ni sérialisation, ni journalisation structurée : tout est à assembler soi-même, donc **à discipliner soi-même**. Pas d'encapsulation : un intergiciel posé pour un domaine s'applique à tout. Le filtre de sortie par schéma — celui qui protège l'anonymisation — devrait être réécrit à la main |
| **C. NestJS** | Structure imposée, injection de dépendances, modules : excellent pour une équipe qui grossit | Trop lourd pour un développeur : décorateurs, métadonnées, conteneur d'injection, davantage de dépendances, démarrage plus lent, et une convention de framework qui imprègne tout le code métier. On paierait aujourd'hui une structure dont on n'a pas le problème (C9) |
| **D. Pas d'`apps/api` : Route Handlers Next.js + Supabase** | Une application de moins, un déploiement de moins, pas de passe-plat, pas de saut réseau. C'est le défaut de l'écosystème en 2026 | Analysé en détail ci-dessous : **écarté** |
| **E. Hono** | Très léger, très rapide, API standard du Web, portable | Nous n'avons besoin d'aucune portabilité multi-environnements d'exécution ; l'écosystème Node spécifique (journalisation, arrêt propre, métriques) est plus mince que celui de Fastify. Aucun gain qui compense |

### Pourquoi l'option D est écartée — l'examen demandé

L'option « tout dans Next.js » mérite d'être prise au sérieux : elle supprime une application, un
déploiement et le passe-plat. Dans un produit sans invariant d'anonymisation et sans traitement de
fond, **ce serait la bonne réponse**. Ici, elle est écartée pour quatre raisons cumulatives.

1. **Elle rend C1 invérifiable.** Dans un même processus, le rendu des pages et le client privilégié
   cohabitent. Un `select` trop large dans un composant serveur fait sortir des colonnes
   identifiantes dans la charge utile RSC — laquelle part au navigateur — **sans passer par le
   moindre schéma de réponse ni la moindre revue de contrat**. La frontière réseau et le schéma de
   sortie de Fastify sont ce qui rend l'anonymisation *contrôlable*, pas seulement *correcte le jour
   où on l'écrit*.
2. **Il faut un worker de toute façon.** Le pipeline de leads exige un processus long, avec
   réessais, temporisation et tâches périodiques (C6). Next.js n'offre aucun modèle de processus de
   fond. Il faudrait donc un second service — qui aurait besoin de son propre accès à la base, donc
   d'un paquet partagé de schéma et de dépôts. **On serait alors à 80 % de `apps/api`, sans en avoir
   la discipline.**
3. **Concentration du risque.** Loger `identity`, `messaging`, `billing`, l'accès à la base **et** la
   clé d'API `service_role` dans le processus qui sert la page d'accueil publique, c'est faire de chaque
   faille de rendu ou de routage une compromission totale. Les deux CVE critiques de Next.js
   mentionnées au §3 ne sont pas un argument contre Next.js — c'est un argument contre **cette**
   concentration.
4. **Le registre chaîné et les transactions.** L'écriture chaînée (C4) et la révélation atomique
   (C2) demandent des transactions explicites, sérialisées, avec verrou. C'est faisable dans un
   Route Handler, mais le modèle d'exécution de Next.js (par requête, potentiellement réinvoqué,
   potentiellement en périphérie) rend la discipline de connexion et de transaction beaucoup plus
   fragile — pour zéro bénéfice.

Ce qu'on paie pour écarter D, dit franchement : une application de plus, un déploiement de plus, un
passe-plat de quinze lignes par front, un saut réseau, et des types à partager par paquet plutôt
qu'à importer directement.

### Grille

| Critère (poids) | **A. Fastify** | B. Express 5 | C. NestJS | D. Next.js seul |
|---|---|---|---|---|
| Stack imposée et Railway (éliminatoire) | Oui | Oui | Oui | Oui |
| Sert C1 (anonymisation exécutoire) (fort) | **Oui, par schéma de réponse** | À écrire soi-même | Oui, plus lourd | **Non** |
| Sert C4/C6 (audit, worker) (fort) | Oui | Oui | Oui | **Non** |
| Simplicité pour un développeur (fort) | Bonne | **Très bonne** | Faible | Très bonne |
| Coût de sortie (fort) | Moyen (routes et greffons à réécrire) | Faible | Élevé | — |
| Maturité et maintenance (moyen) | Élevée (v5 LTS, correctifs réguliers) | Très élevée | Élevée | Élevée |
| Performance (moyen) | Élevée, mesurée | Correcte | Correcte | — |

### Décision : **A — Fastify 5** (`apps/api`), plus un **worker issu du même paquet**

```
apps/api/
├── src/main.ts        entrée HTTP        → service Railway « api »
└── src/worker.ts      entrée worker      → service Railway « worker »
```

Un seul paquet, un seul `package.json`, un seul build, **deux points d'entrée**, **deux services
Railway**. Le worker ne démarre pas de serveur HTTP public ; il expose au plus un `/health` interne
pour la sonde Railway.

**Règles qui font partie de la décision :**

1. **Toute route déclare un schéma de requête *et* un schéma de réponse**, tous deux issus de
   `packages/contracts`. Une route sans schéma de réponse est refusée en revue : c'est la deuxième
   ligne de défense de l'anonymisation.
2. **Un greffon par domaine**, monté sous son préfixe. Un domaine n'importe jamais le `repository.ts`
   d'un autre domaine ; il passe par une fonction exportée de son `service.ts`. Règle vérifiée par
   `no-restricted-imports`.
3. **Journalisation `pino` structurée**, un identifiant de requête par appel, propagé dans l'enveloppe
   d'erreur et dans toutes les lignes de journal. **Aucune donnée personnelle superflue** dans les
   journaux (skill `lead-pipeline`, règle 8) : ni corps de message, ni adresse e-mail complète.
4. **Aucun accès direct à la grappe de connexions dans un gestionnaire de route.** Le seul chemin est
   `withUserTransaction()` ou `withElevatedTransaction()` (§5).
5. **Arrêt propre** sur `SIGTERM` : fin des requêtes en cours, fermeture des connexions. Railway
   redéploie souvent ; un arrêt brutal au milieu d'une révélation d'identité est inacceptable.

### Conséquences

- **Code :** `apps/api` est le seul endroit où vivent la logique métier, les secrets serveur et les
  transactions. `apps/web` et `apps/backoffice` **rendent des pages** (règle déjà posée le
  2026-09-16 pour `apps/web`, désormais étendue au backoffice).
- **Déploiement :** deux services Railway construits depuis le même paquet, avec deux commandes de
  démarrage.
- **Coûts :** deux services légers de plus par environnement.
- **Sécurité :** surface HTTP unique et **non exposée publiquement** (§12). Le filtre de sortie par
  schéma est un gain net.

### Si l'on se trompe

Si Fastify se révèle un frein, porter vers Express est un travail mécanique : les greffons
deviennent des routeurs, les schémas restent (ils sont dans `packages/contracts`) et s'appliquent
alors par un intergiciel de validation écrit une fois. Les services, dépôts et migrations ne bougent
pas. Estimation : 3 à 5 jours à la taille du MVP. **Le coût de sortie est concentré dans la couche
HTTP, qui est mince par construction.**

### Réversibilité

**Moyenne**, et elle reste moyenne parce que la logique métier ne dépend pas du framework.

---

## 5. D5 — Accès aux données

### Contexte

La base est la source de vérité (`CLAUDE.md` §7). Elle porte des politiques RLS, des `GRANT` et
`REVOKE` de colonnes, des déclencheurs, des fonctions `SECURITY DEFINER`, un registre chaîné et des
contraintes de machine à états. **Aucun de ces objets n'est exprimable dans le langage de schéma
d'un ORM.** La question n'est donc pas « quel ORM », mais « quelle couche de requêtes typée, sans
que l'outil réclame la propriété du schéma ».

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. `@supabase/supabase-js` partout** | Un seul client, celui de la plateforme ; Auth, Storage et données dans le même objet | Pousse la clé et PostgREST vers le front (§2) ; **pas de transaction multi-requêtes** (rédhibitoire pour C2 et C4) ; requêtes complexes (facettes, k-anonymat, tri explicable) illisibles ou impossibles |
| **B. Prisma** | Très répandu, excellente expérience de développement, migrations guidées | Son moteur de migrations **veut posséder le schéma** : politiques RLS, `GRANT`/`REVOKE`, déclencheurs et fonctions vivent hors de son modèle, donc en dérive permanente, avec un `migrate` qui propose de supprimer ce qu'il ne connaît pas. Se connecte par défaut avec un rôle propriétaire, qui **contourne la RLS**. Frictions connues avec le multiplexeur de connexions Supabase. **Incompatible avec la façon dont nous protégeons les données** |
| **C. Drizzle + pilote `postgres`** | Schéma déclaré en TypeScript, typage complet des résultats ; **le SQL reste du SQL** : `drizzle-kit generate` produit un fichier que l'on relit et versionne, sans jamais appliquer de différentiel en production ; échappatoire `sql\`\`` toujours disponible pour les requêtes que l'outil ne sait pas exprimer ; très peu de dépendances | Encore en version 0.4x (pré-1.0) : l'API bouge. Écosystème plus jeune que Prisma |
| **D. SQL brut + `postgres.js`** | Zéro abstraction, zéro surprise, portable | Aucun typage des résultats : chaque migration devient une chasse au `grep`. Les erreurs se découvrent à l'exécution |
| **E. Kysely** | Constructeur de requêtes pur, typage excellent, ne touche jamais aux migrations | Types dérivés de la base par génération (ou écrits à la main) : un aller-retour de plus. Très proche de C en résultat ; départage par l'écosystème et par la génération de SQL à partir du schéma TypeScript |

### Grille

| Critère (poids) | A. supabase-js | B. Prisma | **C. Drizzle** | D. SQL brut | E. Kysely |
|---|---|---|---|---|---|
| Compatible RLS, `GRANT`, déclencheurs, `SECURITY DEFINER` (**éliminatoire**) | Partiel | **Non** | Oui | Oui | Oui |
| Transactions multi-requêtes (**éliminatoire**, C2/C4) | **Non** | Oui | Oui | Oui | Oui |
| Typage des résultats (fort) | Moyen | Élevé | Élevé | **Nul** | Élevé |
| Migrations qui restent du SQL relu (fort) | — | Non | **Oui** | Oui | Oui |
| Coût de sortie (fort) | — | Élevé | Moyen | Faible | Moyen |
| Maturité (moyen) | Élevée | Élevée | **Moyenne (pré-1.0)** | Élevée | Élevée |

### Décision : **C — Drizzle**, avec six règles qui comptent autant que le choix

*(Règle 3 révisée et règle 4 ajoutée le 2026-09-18, après la revue de `expert-cybersecurite`.)*

1. **Les migrations sont des fichiers SQL relus et versionnés dans `supabase/migrations`**, appliqués
   par la CLI Supabase. `drizzle-kit generate` peut servir à **rédiger un brouillon** à partir du
   schéma TypeScript ; le fichier SQL relu est la source de vérité. **`drizzle-kit push` est
   interdit** : il applique un différentiel sans relecture et ignore tout ce qu'il ne modélise pas
   (politiques, droits, déclencheurs).
2. **`@supabase/supabase-js` est cantonné à `apps/api`** et à deux usages seulement : **Auth**
   (GoTrue) et **URL signées du Storage**. Il est importable depuis un unique module
   `src/platform/supabase.ts`, et une règle ESLint interdit son import ailleurs. Il **ne sert jamais
   à lire ou écrire une table métier**.
3. **La base est atteinte par deux chemins, et deux seulement** — *révisé le 2026-09-18 (revue
   `expert-cybersecurite`, constat bloquant B2)* **:**

| Fonction | Rôle Postgres pris | Usage | RLS |
|---|---|---|---|
| `withUserTransaction(request, fn)` | `influx_advertiser` · `influx_creator` · `influx_agent` · `influx_admin`, via `SET LOCAL ROLE` | **Toute requête déclenchée par un utilisateur**, membre ou agent | **Appliquée**, avec les réclamations de l'utilisateur |
| `withElevatedTransaction(operation, fn)` | `influx_auth` · `influx_worker` · `influx_privacy`, **aucun avec `BYPASSRLS`**, via `SET LOCAL ROLE` depuis **le rôle de connexion propre à chacun** (`influx_auth_login`, `influx_worker_login`, `influx_privacy_login` au Lot 5) | **Uniquement** les cinq opérations de la liste fermée E-1 à E-5 du document `03` §P7 | **Appliquée aussi** : ces rôles ont des `GRANT` et des politiques **nommés table par table** |

   *Note du 2026-10-08 (`21` EC-62) : la lecture sans compte des documents publiés
   (`GET /v1/terms/current`) n'ouvre **pas** de troisième chemin. C'est le motif
   `identity.read_published_terms` de E-1 (`influx_auth`), qui n'atteint la base que par la fonction
   `SECURITY DEFINER` `identity.terms_in_force()` (`0108`) ; `influx_auth` n'a aucun droit direct sur
   `identity.terms_versions`.*

   **Ce qui a changé et pourquoi.** La version initiale prévoyait un `withServiceTransaction` opérant
   sous le rôle Postgres `service_role`, qui porte `BYPASSRLS`. C'est refusé, et l'argument est
   imparable : **un rôle `BYPASSRLS` employé à l'exécution rend tous les tests de RLS facultatifs sans
   le moindre symptôme** — il suffit d'un appel mal placé pour que la garantie disparaisse, sans
   qu'aucun test ne rougisse. Le worker n'a pas besoin de *contourner* la RLS, il a besoin de **droits
   explicites** : le « contournement » devient alors visible et relisible dans la migration, table par
   table.

   **Règle absolue : aucun rôle utilisé à l'exécution n'a `rolbypassrls` ni `rolsuper`** — vérifié par
   un test de CI (document `03` §8, T4). Le rôle Postgres `service_role` n'est utilisé **nulle part**.

   **Ne pas confondre deux objets homonymes :** la **clé d'API HTTP** `SUPABASE_SECRET_KEY`
   reste employée par `apps/api` et le worker, mais **uniquement pour GoTrue (Auth) et les URL
   signées du Storage** — jamais pour atteindre une table. C'est une clé d'API, pas un rôle Postgres.

   `operation` n'est pas un texte libre : c'est une valeur d'une **union fermée** déclarée dans
   `packages/contracts`, limitée aux cinq opérations E-1 à E-5. Tout ajout est une modification du
   document `03`, signée par `expert-cybersecurite`.

   **Tout le reste passe par une fonction `SECURITY DEFINER` étroite**, qui vérifie elle-même le rôle
   et l'`aal` de son appelant, journalise, et porte obligatoirement `SET search_path = ''` puis
   `REVOKE EXECUTE … FROM PUBLIC` suivi d'un `GRANT` nominatif. Une transaction élevée est un chèque
   en blanc ; une fonction `SECURITY DEFINER` est une opération nommée.

   Le compte de connexion de `apps/api` est un rôle dédié (`influx_app`) qui n'est **ni propriétaire
   d'aucun objet, ni `BYPASSRLS`, ni `SUPERUSER`, ni membre d'un rôle élevé** — cette dernière
   condition est indispensable : sans elle, un `RESET ROLE` ou un `SET ROLE` dans la même session
   annulerait la séparation. Les accès élevés passent donc par d'**autres grappes de connexions**,
   avec un rôle différent et une variable d'environnement différente.

   *Révisé le 2026-09-26 (`21` EC-1 et EC-20, tranchés par `expert-cybersecurite` ; `03` §4 P7,
   « Les rôles Postgres — liste fermée », fait foi).* **Un rôle de connexion par rôle élevé, une
   variable par rôle de connexion, un service Railway par variable** — le processus HTTP ne détient
   jamais la connexion du worker :

   | Variable | Rôle de connexion (`LOGIN NOINHERIT`) | Membre de | Opérations | Service |
   |---|---|---|---|---|
   | `DATABASE_URL` | `influx_app` | les quatre rôles métier **seuls** | `withUserTransaction` ; unique droit propre : `identity.resolve_session()` | `api` |
   | `AUTH_DATABASE_URL` | `influx_auth_login` | `influx_auth` **seul** | E-1, E-2 | `api` |
   | `WORKER_DATABASE_URL` | `influx_worker_login` | `influx_worker` **seul** | E-3, E-4 | `worker` |
   | `OPS_DATABASE_URL` *(J4)* | `influx_ops_login` | `influx_ops` | écriture du schéma `ops` (E-6, à signer) | `api` |
   | `PRIVACY_DATABASE_URL` *(J8, `0136`)* | `influx_privacy_login` | `influx_privacy` **seul** | E-5 | `worker` (obligatoire en production) |

   Les appartenances sont posées `WITH INHERIT FALSE, SET TRUE` : hors d'une transaction qui a pris
   son rôle par `SET LOCAL ROLE`, un rôle de connexion n'a aucun droit. `influx_privacy` n'est
   **jamais** ajouté à `influx_worker_login`. `influx_service` n'existe pas. `ELEVATED_DATABASE_URL`
   disparaît. Refus de démarrage associés : §12.3.

   `set_config(..., true)` est **local à la transaction** : hors transaction, le contexte n'existe
   pas et les politiques voient un utilisateur anonyme. C'est pourquoi **toute lecture passe par une
   transaction**, même une simple lecture. Ce comportement est un garde-fou : il transforme l'oubli
   d'ouvrir une transaction en « zéro ligne » plutôt qu'en « toutes les lignes ».

4. **Aucune table métier dans le schéma `public`** — *ajouté le 2026-09-18 (revue
   `expert-cybersecurite`, constat bloquant B3)*. Supabase expose une API PostgREST publique sur les
   schémas configurés, `public` par défaut, atteignable avec la clé `anon`. Cette clé est **publique
   par conception** : on ne protège pas une base en pariant sur la confidentialité d'une clé qui n'est
   pas un secret. Donc : **un schéma Postgres par domaine** (`identity`, `profiles`, `campaigns`,
   `search`, `verification`, `matching`, `messaging`, `billing`, `leads`, `audit`), aucun d'eux
   déclaré dans les schémas exposés par PostgREST, et `REVOKE ALL` sur `anon` et `authenticated`
   (schémas, tables, et `ALTER DEFAULT PRIVILEGES` cohérents). Conséquence heureuse : **même si la clé
   `anon` fuitait, il n'y aurait rien à lire.** Effort nul si c'est décidé maintenant, migration
   pénible si on s'en aperçoit au Lot 3.

5. **Contraintes d'exploitation Supabase à connaître dès le Lot 0** (elles ont des conséquences
   directes sur D18) :
   - Connexion via le **multiplexeur en mode transaction** : désactiver les requêtes préparées
     (`prepare: false` côté pilote).
   - **`LISTEN`/`NOTIFY` ne fonctionne pas** à travers ce multiplexeur → le worker **interroge**, il
     n'écoute pas (§6).
   - Les **verrous consultatifs de session** ne fonctionnent pas non plus → utiliser exclusivement
     les verrous **de transaction** (`pg_advisory_xact_lock`, `pg_try_advisory_xact_lock`).
   - Montants : entiers en plus petite unité monétaire ou `numeric` exact, **jamais de flottant**
     (skill `supabase-schema`). Le pilote doit renvoyer les `numeric` en chaîne, jamais en `number`.

6. **Une couche `repository.ts` par domaine.** Aucun appel Drizzle en dehors. C'est ce qui rend le
   choix réversible : basculer vers Kysely ou vers du SQL brut ne touche que ces fichiers.

### Conséquences

- **Code :** `apps/api/src/db/schema/*.ts` (déclaration du schéma, alignée à la main sur le SQL),
  `apps/api/src/db/index.ts` (grappe de connexions, les deux fonctions de transaction),
  `<domaine>/repository.ts` (requêtes).
- **Déploiement :** une variable par rôle de connexion, pointant sur le multiplexeur —
  `DATABASE_URL` et `AUTH_DATABASE_URL` sur `api`, `WORKER_DATABASE_URL` sur `worker` (règle 3,
  *révisé le 2026-09-26, EC-20*) — et `DIRECT_DATABASE_URL` pour l'application des migrations, en CI
  seulement.
- **Coûts :** aucun.
- **Sécurité :** c'est le point central. La RLS s'applique réellement parce que l'application se
  connecte avec un rôle non privilégié, prend le rôle de l'utilisateur et pose les réclamations dans
  la transaction. **Un rôle propriétaire ou `BYPASSRLS` dans `DATABASE_URL` annulerait toute la RLS
  en silence**, sans le moindre symptôme : d'où les tests explicites du document `03` §8 (T4 : aucun
  rôle d'exécution ne porte `rolbypassrls` ni `rolsuper`). À noter également : `ENABLE ROW LEVEL
  SECURITY` **ne suffit pas** — le propriétaire d'une table échappe à ses propres politiques tant
  qu'on n'a pas ajouté `FORCE ROW LEVEL SECURITY` (document `03` §P1).

### Si l'on se trompe

Le risque identifié est la **version pré-1.0 de Drizzle**. Parade : version **exacte** épinglée
(règle `savePrefix: ''` déjà en place), montée de version traitée comme un changement à part
entière, et couche `repository` qui confine la surface d'API. Si une version majeure casse trop de
choses, la bascule vers Kysely touche les fichiers `repository.ts` et le schéma TypeScript — **pas
les migrations, pas les politiques, pas la logique métier**. Estimation : 3 à 5 jours.

### Réversibilité

**Moyenne à élevée.** Les migrations SQL, les politiques et les données sont, elles, entièrement
indépendantes du choix.

---

## 6. D18 — File de synchronisation des leads

### Contexte

Skill `lead-pipeline` : une inscription ne doit **jamais** échouer parce qu'un service externe est
indisponible ; les événements doivent être persistés, ordonnés par lead, réessayés, rejouables
manuellement, et les révocations doivent passer devant. Ajout du document `01` : les **e-mails
transactionnels de révélation d'identité** (M2) doivent être envoyés de façon fiable, rejoués en cas
d'échec, et remonter en alerte en cas d'échec définitif — **c'est exactement le même besoin**.

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Table `outbox_events` + worker `FOR UPDATE SKIP LOCKED`** | **L'insertion de l'événement est dans la même transaction que le fait métier** : il n'existe pas de fait sans événement, ni d'événement sans fait. Aucune infrastructure nouvelle. Rejeu = `UPDATE`. Supervision = `SELECT`. Sauvegardé avec la base | Interrogation périodique (latence de quelques secondes) ; il faut écrire la boucle et la temporisation soi-même (≈ 150 lignes) |
| **B. Redis + BullMQ** | Outil de file mature, temporisation et réessais fournis, tableau de bord existant | Un service Railway de plus, une dépendance de plus, un mode de panne de plus, un sous-traitant de données de plus. **Et surtout : la mise en file ne serait plus dans la transaction métier** — il faudrait donc une table d'attente de toute façon pour ne rien perdre. On paierait deux mécanismes pour le travail d'un seul |
| **C. pgmq / Supabase Queues** | C'est la même idée que A, empaquetée, avec une API de file | Une extension de plus à installer, à mettre à jour et à comprendre ; une API de file au lieu de SQL simple ; aucun gain à notre volume (quelques centaines d'événements par jour au pilote). À rouvrir si le volume l'exige |
| **D. `pg_cron` seul** | Intégré à Supabase | Planifie, ne met pas en file : ni ordre, ni réessai par destination, ni rejeu unitaire. Insuffisant |

### Décision : **A**

**Une ligne par (fait, destination).** L'émission insère N lignes dans la même transaction que le
fait métier.

| Colonne (indicative — le modèle exact relève de `expert-database`) | Rôle |
|---|---|
| `id`, `event_id` | Identité de la ligne ; `event_id` regroupe les lignes d'un même fait (affichage backoffice) |
| `event_type` | `lead.created`, `lead.updated`, `consent.revoked`, `account.deleted`, `introduction.revealed`… — **nommé au passé** |
| `destination` | `brevo_contact`, `apollo_contact`, `brevo_transactional` |
| `subject_key` | Clé d'ordonnancement : identifiant du lead, ou de la mise en relation |
| `priority` | `0` = urgent (`consent.revoked`, `account.deleted`, e-mails de révélation) · `100` = normal |
| `payload` | **Identifiants uniquement.** Le consommateur relit la base pour l'état à jour |
| `idempotency_key` | Clé stable, transmise au service externe |
| `status` | `pending` · `processing` · `succeeded` · `failed` · `skipped` |
| `attempts`, `available_at` | Réessais et temporisation |
| `last_error_code`, `last_error_message` | **Cause en clair**, lisible au backoffice (skill `lead-pipeline`) |
| `created_at`, `updated_at`, `completed_at` | Traçabilité |

**Sélection d'un lot par le worker :**

```
SELECT ... FROM leads.outbox_events
 WHERE status = 'pending' AND available_at <= now()
 ORDER BY priority, available_at, id
 LIMIT 20
 FOR UPDATE SKIP LOCKED
```

**Ordre par sujet :** avant de traiter une ligne, le worker tente
`pg_try_advisory_xact_lock(hashtextextended(subject_key, 0))`. S'il n'obtient pas le verrou, il
**passe** la ligne (elle repassera au tour suivant) plutôt que d'attendre. Verrou **de transaction**
obligatoire : les verrous de session ne survivent pas au multiplexeur (§5).

**Concurrence : un seul worker au MVP.** À ce volume, l'ordre est alors trivialement respecté ; le
verrou consultatif est la garantie qui reste valable le jour où l'on passe à deux.

**Réessais :** temporisation exponentielle avec dispersion aléatoire (1 min, 3, 10, 30, 2 h, 6 h),
**6 tentatives**, puis `failed` — visible et rejouable au backoffice. Une erreur `4xx` non
récupérable (contact invalide, consentement absent côté service) passe directement en `failed` ou
`skipped`, sans consommer les six tentatives.

**Consentement revérifié à la consommation**, pas à l'émission (skill `lead-pipeline`, règle 2) :
entre les deux, il a pu être retiré. Absence de consentement → `skipped`, journalisé comme tel, et
distingué d'une erreur au backoffice.

**Ce que la file transporte aussi :** les e-mails transactionnels de mise en relation (M2). Même
mécanisme, priorité `0`, `messageId` renvoyé par Brevo **conservé** sur la ligne (document `01` §9)
— c'est le lien entre notre registre interne et la preuve détenue par un tiers.

**Purge :** les lignes `succeeded` sont purgées après 30 jours ; les lignes `failed` sont conservées
jusqu'à traitement explicite. Les faits eux-mêmes restent dans le registre d'audit, qui n'est
**jamais** purgé (M4).

### Conséquences

- **Code :** une table, une fonction d'émission (`enqueue(tx, event)`), une boucle de worker, un
  connecteur par destination (`expert-integrations-api`, skills `brevo-campaign` et
  `apollo-lead-sync`).
- **Déploiement :** aucun composant nouveau. Le worker est le service déjà prévu par D2.
- **Coûts :** nuls.
- **Sécurité :** charge utile réduite à des identifiants → aucune donnée personnelle superflue en
  base de file ni dans les journaux.

### Si l'on se trompe

Si le volume dépasse ce qu'une interrogation périodique absorbe (ordre de grandeur : plusieurs
dizaines d'événements par seconde, très au-delà du pilote), la bascule vers pgmq ou vers une file
dédiée se fait **derrière la même fonction `enqueue()`** : la table reste comme journal, le
consommateur change. Aucun appelant métier n'est touché.

### Réversibilité

**Élevée.**

---

## 7. D37 — Méthode d'authentification *(décision nouvelle)*

### Contexte

Le prototype `apps/web/src/components/account/AccountForm.tsx` ne comporte **aucun champ mot de
passe** et aucun document ne tranche la question. Il faut décider avant le Lot 0, parce que le
modèle de session conditionne la structure des trois espaces.

Trois populations, trois besoins :

| Population | Contexte | Contrainte dominante |
|---|---|---|
| **Créateur** | Mobile, jeune, arrive depuis un lien ou un réseau | **Aucune friction**, et pas de gestionnaire de mots de passe |
| **Marque** | Bureau, e-mail professionnel, usage épisodique | Attente d'un parcours « professionnel », reprise de session facile |
| **Agent / admin** | Backoffice, tous les jours, accès à **toutes** les identités et **toutes** les conversations | **MFA obligatoire, session courte, révocation immédiate** |

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Mot de passe + e-mail vérifié** | Familier, indépendant de la délivrabilité e-mail à chaque connexion | Parcours de réinitialisation à construire ; bourrage d'identifiants et réutilisation de mots de passe ; responsabilité en cas de fuite ; une étape de vérification d'e-mail **en plus** de l'inscription |
| **B. Lien magique (clic dans l'e-mail)** | Zéro mot de passe, vérifie l'adresse par construction | **Casse sur mobile** : le lien s'ouvre dans le navigateur intégré à l'application de messagerie, donc la session atterrit dans un autre navigateur que celui où l'utilisateur a commencé. Pour une population mobile, c'est un tueur de conversion. Les protections anti-hameçonnage des messageries d'entreprise « cliquent » parfois le lien et le consomment |
| **C. Connexion via un tiers (Google, réseaux sociaux)** | Un clic, pas d'e-mail à délivrer | Un fournisseur d'identité de plus, un écran de consentement, une dépendance juridique ; **le rattachement de comptes** (même adresse par deux chemins) est une source classique de prise de contrôle de compte. **Instagram / TikTok : à refuser explicitement**, parce qu'une connexion par le réseau serait lue comme une **vérification d'audience** — précisément ce que le badge doit affirmer (D34) et que nous ne pouvons pas affirmer au MVP |
| **D. Code à usage unique à 6 chiffres par e-mail** | Le code se **retape dans l'onglet d'origine** : aucun changement de navigateur, fonctionne parfaitement sur mobile. **Vérifie l'adresse par construction**, donc supprime l'étape « confirmez votre e-mail » — et l'adresse vérifiée est exactement ce dont le Lot 1 a besoin pour Brevo et Apollo. Aucun secret durable côté utilisateur, donc rien à voler, rien à réinitialiser | **La délivrabilité de l'e-mail devient la disponibilité du produit.** Un code en indésirable = un utilisateur bloqué. Limitation de débit et anti-énumération à écrire sérieusement |
| **E. Clés d'accès (passkeys)** | Le meilleur niveau de sécurité et d'ergonomie à terme | Parcours de secours indispensable (nouvel appareil, appareil perdu), donc **une deuxième méthode de toute façon**. Prématuré au MVP |

### Décision

**Membres (marque et créateur) : option D seule. Backoffice : option A + TOTP obligatoire.**

| | **Espace membres** | **Backoffice** |
|---|---|---|
| Méthode | **Code à 6 chiffres par e-mail**, même parcours pour l'inscription et la connexion | **Mot de passe + TOTP obligatoire** |
| Mot de passe | **Non implémenté au MVP** | Obligatoire, politique de longueur minimale, vérification contre les mots de passe compromis |
| Second facteur | Non (le code *est* le facteur) | **Obligatoire**, inscription du second facteur imposée à la première connexion |
| Vérification d'e-mail | **Implicite** : réussir la connexion prouve l'adresse | Compte créé par invitation d'un admin |
| Auto-inscription | Oui | **Impossible** |
| Durée de vie du code | 10 min, 5 tentatives, invalidé après usage | — |
| Session | 30 jours glissants, renouvellement silencieux | **8 h maximum, inactivité 30 min** |
| Cookie | `__Host-`, `httpOnly`, `Secure`, `SameSite=Lax` | `__Host-`, `httpOnly`, `Secure`, **`SameSite=Strict`** |
| Contrôle serveur | Rôle lu **en base**, pas dans le jeton | Rôle **et `aal2`** vérifiés à chaque requête **et** dans les politiques RLS |

**Trois précisions qui font partie de la décision :**

1. **Aucun jeton n'atteint jamais le JavaScript.** La session est un cookie `httpOnly` posé par
   `apps/api` et relayé par le passe-plat (§9.3). `localStorage`, `sessionStorage` et
   `document.cookie` restent **interdits par ESLint** dans les deux fronts, définitivement. Une
   faille XSS sur le site public ne permet alors ni de lire la session, ni de l'exfiltrer.
2. **Le rôle métier n'est pas dans le jeton.** Il est lu en base par une fonction `STABLE` appelée
   dans les politiques (`influx.current_role()`). Raison : un rôle inscrit dans un JWT reste valide
   jusqu'à l'expiration du jeton — **un agent suspendu conserverait ses droits pendant une heure**.
   Sur une surface qui voit toutes les identités, la révocation doit être immédiate. Coût : une
   lecture indexée par évaluation de politique, à mesurer par `expert-database`.
3. **`aal2` est vérifié deux fois** : par `apps/api` avant d'exécuter quoi que ce soit pour un rôle
   `agent` ou `admin`, **et** dans les politiques RLS des objets sensibles. Un contrôle côté API
   seul serait un « masquage d'UI » déguisé.

**Anti-abus, au Lot 0 :** limitation de débit sur la demande de code par adresse **et** par IP ;
réponse **identique** que le compte existe ou non (pas d'énumération) ; code à usage unique lié à la
session d'origine ; journalisation des échecs répétés.

### Ce que cela change pour le prototype existant

`AccountForm.tsx` est **déjà compatible** : l'absence de champ mot de passe n'était pas un oubli,
c'est la forme correcte. Ce qui manque : un **second écran de saisie du code**, et le déplacement de
la validation (format d'e-mail, majorité, CGU, consentement) **du client vers le serveur**, où elle
devient un schéma de `packages/contracts`. La validation client reste, en confort, à partir du même
schéma.

### Si l'on se trompe

Deux seuils, mesurés dès le Lot 1 :

- **plus de 15 % des demandes de code sans connexion aboutie dans les 10 minutes**, ou
- **délai médian de réception du code supérieur à 60 secondes**,

alors on ajoute le mot de passe comme méthode complémentaire au lot suivant. Supabase Auth le
fournit nativement : c'est un formulaire, un parcours de réinitialisation et une politique de
robustesse, soit **2 à 3 jours**. Aucun schéma, aucune politique, aucun écran existant n'est à
reprendre.

Risque inverse, à dire aussi : si la délivrabilité s'effondre (domaine mal authentifié, réputation
d'envoi dégradée), **plus personne ne se connecte**. Parades : SPF/DKIM/DMARC dès le Lot 1 (déjà un
prérequis du cadrage), **flux transactionnel séparé du flux marketing** chez Brevo, surveillance du
délai de délivrance, et alerte si le taux d'échec dépasse un seuil.

### Réversibilité

**Élevée.**

### Avis de `expert-cybersecurite` — **rendu le 2026-09-18 : D37 validée, sous deux conditions**

D37 est **validée telle qu'elle est décidée ci-dessus**, au motif qu'**au MVP un compte membre ne
contient aucun moyen de paiement** : il contient des données personnelles et des conversations
commerciales. Deux conditions s'ajoutent, et elles font désormais partie de la décision.

| # | Condition | Pourquoi |
|---|---|---|
| **1** | **La validation tombe automatiquement le jour où la V2 introduit des coordonnées bancaires** : un second facteur deviendra alors **obligatoire côté membres**. Écrit ici pour que personne ne l'oublie dans dix-huit mois | Le raisonnement qui autorise l'absence de mot de passe aujourd'hui repose entièrement sur l'absence d'enjeu financier dans le compte |
| **2** | **Le changement d'adresse e-mail exige une confirmation depuis l'ancienne adresse ET depuis la nouvelle**, avec ré-authentification (document `03` §3.1, C(2)) | Sans mot de passe, l'adresse e-mail **est** le compte. Une boîte compromise pendant dix minutes suffirait sinon à se l'approprier **définitivement**. C'est le point critique de toute authentification sans mot de passe, et il est facile à oublier |

Les autres points soumis (durées de session et de code, `aal2` en RLS, rôle lu en base, seuils de
limitation de débit, anti-énumération, passe-plat, inscription et récupération du second facteur du
backoffice) sont instruits dans `docs/mvp/03-matrice-des-droits-et-rls.md`. Récapitulatif au §14.1.

---

## 8. Structure du dépôt cible

> **Règle de création : on ne crée un paquet qu'au premier besoin réel.** Un paquet créé « au cas
> où » devient un dépotoir de dépendances croisées. Le lot indiqué est le lot de **création**, pas
> de réservation.

```
influx/
├── apps/
│   ├── web/                     @influx/web — Next.js 16 · PUBLIC + ESPACE MARQUE + ESPACE CRÉATEUR
│   │   │                        existe déjà (Lot 0 : sortie du mode maquette, §13)
│   │   └── src/
│   │       ├── app/[locale]/    pages publiques et espaces membres
│   │       ├── app/api/[...path]/route.ts   ⚠ UNIQUE route : passe-plat vers apps/api (§9.3)
│   │       ├── server/          appel de l'API depuis les composants serveur (seul endroit où
│   │       │                    « fetch » est autorisé)
│   │       ├── components/      RENDU UNIQUEMENT — jamais de logique métier
│   │       ├── i18n/ locales/   next-intl, FR + EN (D28)
│   │       └── styles/tokens.css  FICHIER DE TOKENS UNIQUE (D4, D6)
│   │       ▸ ne doit JAMAIS contenir : une clé Supabase, une clé Brevo/Apollo, une requête SQL,
│   │         un import de @supabase/*, drizzle, pg ou postgres, un calcul de montant,
│   │         un taux de commission, une Server Action
│   │
│   ├── backoffice/              @influx/backoffice — Next.js · ESPACE COMMERCIAL + ADMIN     ◀ Lot 0
│   │   │                        hôte distinct · noindex · MFA · session courte · FR seul (D36)
│   │   └── src/
│   │       ├── app/             files de validation, conversations, pipeline commercial, comptes
│   │       ├── app/api/[...path]/route.ts   passe-plat, identique à celui de web
│   │       ├── server/          appel de l'API
│   │       └── styles/tokens.css  ré-export ou copie contrôlée des mêmes tokens
│   │       ▸ ne doit JAMAIS contenir : next-intl tant que D36 n'est pas tranchée, de contenu
│   │         fictif, de SEO, de lecture directe de la base, une autorisation par masquage d'UI
│   │
│   └── api/                     @influx/api — Fastify 5 · SEUL À PARLER À LA BASE ET AUX      ◀ Lot 0
│       │                        SERVICES EXTERNES · seul détenteur des secrets serveur
│       └── src/
│           ├── main.ts          entrée HTTP    → service Railway « api »
│           ├── worker.ts        entrée worker  → service Railway « worker »
│           ├── server.ts        construction Fastify : greffons, hooks, erreurs
│           ├── config/          lecture + validation zod des variables d'env, ÉCHEC AU DÉMARRAGE
│           ├── db/              une grappe par rôle de connexion (api : influx_app, influx_auth_login ;
│           │                    worker : influx_worker_login), aucun avec BYPASSRLS (§5 règle 3),
│           │                    withUserTransaction, withElevatedTransaction,
│           │                    schéma Drizzle (aligné à la main sur le SQL)
│           ├── platform/        journalisation, enveloppe d'erreur, idempotence, limitation de
│           │                    débit, cache JWKS, supabase.ts (SEUL import de @supabase/*,
│           │                    et uniquement pour Auth et les URL signées du Storage)
│           └── domains/
│               ├── identity/        comptes, rôles, sessions, CGU versionnées
│               ├── profiles/        profils marque et créateur, complétude, deux couches
│               ├── campaigns/       campagnes, validation avant publication
│               ├── search/          recherche anonymisée + vue commerciale identifiée   ◀ nouveau
│               ├── verification/    preuves, badge, péremption                          ◀ nouveau
│               ├── matching/        introductions, file de validation, révélation
│               ├── messaging/       conversations à trois, lectures journalisées
│               ├── billing/         deals — AUCUN CALCUL, AUCUN TAUX au MVP
│               ├── leads/           outbox, connecteurs Brevo et Apollo
│               └── backoffice/      tableaux de bord, files, supervision
│           ▸ chaque domaine : routes.ts · service.ts · repository.ts · schema interne
│           ▸ un domaine n'importe JAMAIS le repository.ts d'un autre domaine
│
├── packages/
│   ├── contracts/               @influx/contracts — schémas zod + types + codes d'erreur  ◀ Lot 0
│   │   ▸ contient : schémas de requête et de réponse, énumérations partagées (statuts
│   │     d'introduction, états d'affaire, motifs de refus), format de la référence MER-…,
│   │     union fermée des codes d'erreur
│   │   ▸ ne doit JAMAIS contenir : accès à la base, secret, React, appel réseau, texte affiché
│   │     à l'utilisateur (il est dans les fichiers de traduction), effet de bord
│   │
│   ├── domain/                  @influx/domain — règles pures                            ◀ Lot 2
│   │   ▸ contient : découpage anonyme / identifiant d'un profil, calcul de complétude,
│   │     détection de coordonnées, transitions autorisées des machines à états,
│   │     formatage de la référence MER-…
│   │   ▸ ne doit JAMAIS contenir : entrée/sortie, base, réseau, horloge implicite
│   │     (l'instant est injecté), ET SURTOUT AUCUN CALCUL DE COMMISSION — au MVP il n'en
│   │     existe aucun (C5) ; en V2 il vivra dans apps/api/src/domains/billing, à un seul
│   │     endroit, conformément à CLAUDE.md §6
│   │   ▸ créé au Lot 2, parce que c'est le premier moment où deux applications ont besoin
│   │     de la même règle (complétude affichée côté membre ET côté backoffice)
│   │
│   ├── ui/                      @influx/ui — primitives partagées                        ◀ Lot 2
│   │   ▸ contient : les primitives de apps/web/src/components/ui RÉELLEMENT utilisées par
│   │     les deux applications, et les tokens
│   │   ▸ ne doit JAMAIS contenir : une page, un appel réseau, une règle métier, un libellé
│   │     (les libellés arrivent par props — convention déjà en vigueur)
│   │   ▸ créé quand le backoffice a besoin de la deuxième primitive, pas de la première
│   │
│   └── i18n/                    @influx/i18n                             ◀ Lot 5, ou JAMAIS
│       ▸ créé uniquement si D36 rend le backoffice bilingue. Sinon il n'existe pas
│
└── supabase/                                                                            ◀ Lot 0
    ├── migrations/              fichiers SQL numérotés, un changement cohérent par fichier,
    │                            INCLUANT politiques RLS, GRANT/REVOKE, déclencheurs,
    │                            fonctions SECURITY DEFINER, index justifiés
    └── seed/                    comptes de démonstration par rôle (Lot 0)
        ▸ ne doit JAMAIS contenir : de donnée réelle, de secret, de script appliqué en production
```

**Ce qui n'est pas créé, et pourquoi :** pas d'orchestrateur de tâches (D3 : inutile à deux ou trois
applications) ; pas de paquet `config` partagé (la configuration diffère trop entre un front et un
worker) ; pas de paquet `db` séparé (le schéma appartient à `apps/api`, seul à parler à la base) ;
pas de paquet `utils` (c'est le nom qu'on donne à un paquet dont on ne sait pas dire le rôle).

---

## 9. Le contrat entre l'API et les fronts

### 9.1 Où vivent les schémas, comment les types sont partagés

**`packages/contracts` est la frontière.** Un schéma zod par opération, exporté avec son type inféré.

```
packages/contracts/src/
├── errors.ts                 union fermée des codes d'erreur + enveloppe
├── common.ts                 pagination, tri, identifiants, devise, pays, langue
├── identity/                 requestCode, verifyCode, session, acceptTerms
├── profiles/                 …
├── search/                   facettes, résultat anonymisé, résultat identifié (backoffice)
├── matching/                 introductions, file de validation, révélation
├── messaging/                …
└── billing/                  deals — montants saisis, JAMAIS de taux
```

| Consommateur | Usage |
|---|---|
| `apps/api` | **Validation d'exécution** de la requête **et schéma de réponse** — le sérialiseur supprime tout champ non déclaré (§2.5) |
| `apps/web`, `apps/backoffice` | **Types uniquement**, plus la validation côté client des formulaires à partir du même schéma (confort, jamais une garantie) |

Un même schéma sert donc de validation d'entrée, de filtre de sortie et de type partagé : c'est ce
qui rend le surcoût de la règle §2 supportable.

**Règle de nommage des couches anonyme et identifiante :** les schémas de réponse anonymisés et
identifiants sont **deux types distincts**, avec des noms qui ne se confondent pas
(`CreatorPublicProfile` / `CreatorIdentity`). Aucune fonction ne convertit l'un en l'autre côté
front. Les mélanger doit être une erreur de compilation.

### 9.2 Versionnement, erreurs, idempotence

| Sujet | Règle |
|---|---|
| **Version** | Préfixe `/v1` dès le premier jour. Un changement cassant crée `/v2` ; un ajout de champ est libre (le schéma de réponse filtre, donc ajouter ne casse rien) |
| **Enveloppe d'erreur** | `{ "error": { "code": "...", "message": "...", "details": …, "requestId": "..." } }` |
| **Codes** | Union **fermée** déclarée dans `packages/contracts`. Le front traduit `code` en clé de traduction ; **`message` n'est jamais affiché tel quel** (il est en anglais, technique, et peut contenir du contexte) |
| **Statuts HTTP** | `400` validation · `401` non authentifié · `403` interdit · `404` introuvable · `409` conflit d'état (transition interdite, double traitement d'une file) · `429` limitation de débit · `500` erreur interne (jamais de détail) |
| **Identifiant de requête** | Généré par Fastify, renvoyé dans l'enveloppe et présent dans chaque ligne de journal. Affiché discrètement au backoffice sur les erreurs, pour le diagnostic |
| **Idempotence** | En-tête `Idempotency-Key` **obligatoire** sur les créations à effet externe ou multiple : proposition INFLUX sur plusieurs créateurs, envoi d'e-mails, saisie d'une affaire. Réponse rejouée à l'identique pendant 24 h |
| **Pagination** | Par curseur, **plafonnée** côté serveur (le client ne choisit pas la taille au-delà du plafond) |

### 9.3 Comment l'authentification circule

C'est le mécanisme qui rend l'isolement d'hôte de D12 réellement opérant.

```
  Navigateur                Front (Next)              apps/api (Fastify)        Supabase
      │                          │                            │                    │
      │ POST /api/v1/…           │                            │                    │
      │ cookie __Host-influx-…   │                            │                    │
      ├─────────────────────────►│                            │                    │
      │                 passe-plat SANS logique :             │                    │
      │                 relaie méthode, chemin, corps,        │                    │
      │                 cookie, Accept-Language, req-id       │                    │
      │                          ├───────────────────────────►│                    │
      │                          │  réseau privé Railway      │ vérifie le JWT     │
      │                          │  (api.railway.internal)    │ ES256 via JWKS     │
      │                          │                            │ en cache local     │
      │                          │                            │                    │
      │                          │                     BEGIN                       │
      │                          │                     lecture indexée du rôle     │
      │                          │                       métier et de l'état de    │
      │                          │                       suspension (jamais le JWT)│
      │                          │                     SET LOCAL ROLE influx_<rôle>│
      │                          │                     set_config('request.jwt.    │
      │                          │                        claims', …, true)        │
      │                          │                     set_config('influx.role' /  │
      │                          │                        '.account' / '.aal', …)  │
      │                          │                     … requêtes Drizzle sous RLS │
      │                          │                     COMMIT                      │
      │                          │                            │                    │
      │                          │◄───────────────────────────┤ réponse filtrée    │
      │◄─────────────────────────┤ relaie Set-Cookie éventuel │ par le schéma      │
```

**Pourquoi un passe-plat plutôt que des appels directs du navigateur vers `apps/api`.** Si le
navigateur appelait `api.influx.<tld>` directement, il faudrait soit un cookie posé sur le domaine
parent — **partagé entre le site public et le backoffice, ce qui annule l'isolement de D12** —, soit
un cookie inter-sites `SameSite=None`, fragile face aux restrictions de cookies tiers des
navigateurs. Le passe-plat rend l'appel **de même origine** : cookie de première partie, portée à
l'hôte, aucun CORS, aucune préflight, et `apps/api` **n'a besoin d'aucun hôte public**.

> *Révisé le 2026-09-27 (`21` J3-C règle 3, EC-46).* Le schéma ci-dessus est antérieur au J3 :
> **`apps/api` ne vérifie aucun JWT** et ne consulte aucun JWKS. Le cookie porte un identifiant de
> session opaque, résolu en base par `identity.resolve_session()` (`03` A-9, P7) ; l'identité GoTrue
> n'est lue qu'une fois, dans la réponse de GoTrue à la vérification d'un facteur, puis la session
> GoTrue est fermée.

**Ce que le passe-plat a le droit de faire — et rien d'autre :**

| Autorisé | Interdit |
|---|---|
| Relayer méthode, chemin, chaîne de requête, corps | Lire ou interpréter le corps |
| Relayer une **liste blanche** d'en-têtes (`cookie`, `content-type`, `accept`, `accept-language`, `idempotency-key`, `x-request-id`) | Relayer un en-tête arbitraire |
| Relayer `Set-Cookie` vers le navigateur | Fabriquer ou modifier un cookie |
| Imposer une taille maximale de corps et un délai maximal | Contenir la moindre règle métier, autorisation ou transformation |

C'est une **exception explicite et bornée** à la règle « pas de Route Handler dans `apps/web` »
posée le 2026-09-16, accordée ici par `architecte` conformément à la clause d'exception de ce
document, et à valider par `expert-cybersecurite`.

**Où vit la session.** `apps/api` détient le cycle complet : demande de code, vérification,
émission du cookie, renouvellement silencieux, déconnexion. Les fronts **ne portent aucune clé
Supabase**. Si cette exigence se révélait coûteuse à l'usage (par exemple pour un futur flux OAuth),
l'échappatoire documentée est d'autoriser `@supabase/ssr` **dans la seule couche serveur du front**,
jamais dans un composant client — et cela demanderait une décision écrite, pas un contournement.

**Réclamations posées dans la transaction** — *révisé le 2026-09-18 (revue `expert-cybersecurite`,
B1)*. Le **rôle métier** (`advertiser`, `creator`, `agent`, `admin`) n'est **pas** dans le jeton : il
est lu en base, **une fois par transaction** et non à chaque évaluation de politique (§7, précision 2
et document `03` §P3). La transaction pose ensuite `request.jwt.claims` (au minimum `sub`, `aal`,
`email`) **et** les réglages `influx.role`, `influx.account`, `influx.aal`, puis **prend le rôle
Postgres correspondant** par `SET LOCAL ROLE influx_<rôle>`. Les politiques lisent alors
`current_setting('influx.role', true)` : une lecture mémoire, sans jointure.

Deux règles de rédaction qui découlent de ce mécanisme (document `03` §P4) : toute condition d'accès
est **positive**, de sorte qu'un réglage absent refuse l'accès au lieu de l'ouvrir ; et **aucune
politique ne contient de négation sur un réglage de session**. Toute fonction appelée dans une
politique est `STABLE` et porte `SET search_path = ''`.

---

## 10. Où s'applique la RLS, et où elle ne suffit pas

> **Révisé le 2026-09-18 (revue `expert-cybersecurite`).** La matrice complète des droits, objet par
> objet et action par action, les dix principes RLS et les tests exigibles en intégration continue
> vivent désormais dans **`docs/mvp/03-matrice-des-droits-et-rls.md`**, qui **fait foi** sur ces
> sujets. La présente section conserve uniquement la frontière d'architecture : ce que la RLS fait,
> et ce qu'elle ne sait pas faire.

**La RLS est activée sur toutes les tables, en refus par défaut**, avec `FORCE ROW LEVEL SECURITY`
en plus de `ENABLE` — sans `FORCE`, le propriétaire de la table échappe à ses propres politiques, et
l'oubli est silencieux. Une table sans politique explicite est traitée comme une faille (skill
`supabase-schema`). Mais il faut dire clairement ce que la RLS ne sait pas faire, sinon on lui
confiera des garanties qu'elle ne tiendra pas.

### 10.1 Ce que la RLS fait bien

| Garantie | Mécanisme |
|---|---|
| « Je ne vois que mes données » | Politique sur le propriétaire de la ligne |
| « La marque ne voit l'identité d'un créateur qu'après révélation » | Politique testant l'existence d'une `introduction` avec `identity_revealed_at` non nul |
| « L'annonceur n'a aucun droit sur l'objet identifiant » | **Absence de `GRANT` à `influx_advertiser`** — plus fort qu'une politique, **mais uniquement une fois les quatre rôles créés** (§2.5). Avec le rôle `authenticated` unique de la configuration Supabase par défaut, cette garantie **n'existe pas**. *Révisé le 2026-09-18 (B1)* |
| « Seul un agent avec `aal2` accède aux objets du backoffice » | Politique testant `influx.current_role()` **et** `influx.current_aal()`, en condition positive (§9.3) |
| « Personne ne modifie une ligne du registre d'audit » | `REVOKE UPDATE, DELETE, TRUNCATE` à **tous** les rôles applicatifs **et à tous les rôles d'exécution**, plus un déclencheur. L'`INSERT` n'est accordé qu'à un rôle d'écriture d'audit dédié, appelé par `audit.append(...)` |

### 10.2 Ce que la RLS **ne sait pas faire** — et ce qui le fait à sa place

| # | Besoin | Pourquoi la RLS ne suffit pas | Mécanisme retenu |
|---|---|---|---|
| **1** | **Journaliser chaque lecture d'une conversation par un agent** (A10) | Une politique **autorise ou refuse** ; elle n'écrit pas. Une expression `USING` doit être sans effet de bord : Postgres l'évalue un nombre de fois indéterminé, et rien ne garantit une écriture par lecture métier — un journal alimenté par une politique serait **faux**, ce qui est pire qu'un journal absent | **Fonction `SECURITY DEFINER`** `messaging.read_conversation(...)` : elle écrit le journal d'accès (qui, quand, quelle conversation, quel écran, participant ou non, identifiant de requête — **jamais le contenu d'un message**) **puis** retourne les messages. **Et surtout : `REVOKE SELECT ON messaging.messages, messaging.conversations FROM influx_agent, influx_admin`** — sans ce `REVOKE`, il resterait un chemin de lecture non journalisé et la garantie serait décorative. *Révisé le 2026-09-18 : la fonction s'applique à **toutes** les lectures d'un rôle `agent` ou `admin`, **participant ou non**. Distinguer les deux cas créerait une branche qui finirait par être mal évaluée (réattribution, agent qui rejoint le fil) ; la qualité de participant est enregistrée comme **donnée du journal**, pas comme condition d'accès. Mise en œuvre complète : document `03` §5* |
| **2** | **Append-only réel du registre** (C4) | Une politique n'empêche pas un futur `GRANT` distrait | `REVOKE UPDATE, DELETE` **+** déclencheur `BEFORE UPDATE OR DELETE` qui lève une exception. Le `REVOKE` protège du code, le déclencheur protège d'une migration (document `01` §M4) |
| **3** | **Chaînage sans trou de séquence** | Deux insertions concurrentes liraient la même « ligne précédente » | Écriture du registre **sérialisée** : verrou consultatif de transaction sur une clé constante par chaîne, ou lecture `FOR UPDATE` de la dernière ligne. Vérification périodique par le worker |
| **4** | **`identity_revealed_at` écrit une seule fois** | Une politique ne distingue pas « écrire » de « réécrire » sur une colonne | `REVOKE UPDATE (identity_revealed_at)` + déclencheur refusant le passage d'une valeur non nulle à une autre |
| **5** | **K-anonymat, pagination plafonnée, limitation de débit, export interdit, journalisation des recherches** | Ce sont des règles sur la **forme et la fréquence** des requêtes, pas sur les lignes | **`apps/api`, domaine `search`.** C'est la justification directe de la règle §2 |
| **6** | **Transitions d'états d'une affaire** (document `01` §6.1) | Une politique ne connaît pas l'état antérieur d'une machine à états complexe | `CHECK` pour les invariants simples (`commission ≤ montant`, `signed_at > identity_revealed_at`), déclencheur pour les transitions, machine à états dans `packages/domain` pour l'expérience de développement. **La base reste l'arbitre** |
| **7** | **Consentement revérifié au moment de l'envoi** | Le consentement n'est pas une propriété de la ligne d'événement | Logique du worker (§6) |
| **8** | **Le Storage** | Les politiques du Storage s'appliquent à `storage.objects`, mais **une URL signée les contourne par conception** | `apps/api` décide **avant** d'émettre l'URL, journalise l'émission, borne la durée. Compartiments **privés** en toutes circonstances, séparés par sensibilité, limites de type et de taille au niveau du compartiment, chemin calculé par le serveur, EXIF supprimés, quotas par compte. **Les pièces de vérification ne sont jamais servies par URL signée** (§2.4, E1 ; document `03` §P10) |
| **9** | **Un rôle `BYPASSRLS` contourne toute la RLS** | C'est sa raison d'être — et c'est précisément pourquoi il ne doit pas exister à l'exécution | *Révisé le 2026-09-18 (revue `expert-cybersecurite`, constat bloquant B2).* **Le rôle Postgres `service_role` n'est utilisé nulle part.** Les traitements de fond utilisent des rôles dédiés **sans `BYPASSRLS`** (`influx_auth`, `influx_worker`, `influx_privacy`), avec des `GRANT` et des politiques **nommés table par table** : le « contournement » devient visible et relisible dans la migration. Seules les **cinq opérations** E-1 à E-5 de la liste fermée du document `03` §P7 peuvent appeler `withElevatedTransaction`, et **trois d'entre elles ne sont pas appelables depuis une route HTTP**. Tout le reste passe par une fonction `SECURITY DEFINER` étroite. Tests : aucun rôle d'exécution ne porte `rolbypassrls` ni `rolsuper` (document `03` §8, T4), et aucun appel hors liste |

### 10.3 La RLS est testée, jamais supposée

Trois familles de tests, à la charge de `testeur` (document `18`), exécutées en CI sur une base
jetable :

1. **Par rôle et par table** : chaque rôle tente chaque opération sur chaque table ; le résultat
   attendu est déclaré dans un tableau. Une table nouvelle sans ligne dans ce tableau **fait échouer
   la CI**.
2. **Anonymisation de bout en bout** : une marque interroge chaque route accessible et **aucun champ
   identifiant** n'apparaît dans la réponse, y compris quand la base en contient — puis la même route
   après révélation, et le champ apparaît.
3. **Connexion non privilégiée** : le rôle de `DATABASE_URL` n'est ni propriétaire, ni `BYPASSRLS`,
   ni `SUPERUSER`, ni membre d'un rôle élevé ; **aucun rôle utilisé à l'exécution ne porte
   `rolbypassrls` ni `rolsuper`** ; et une lecture hors transaction ne retourne rien.
   *Révisé le 2026-09-18 (revue `expert-cybersecurite`, B2).*

Le catalogue complet des tests exigibles en intégration continue (T1 à T16, dont l'échec de la CI sur
toute table nouvelle absente de la matrice des droits) est dans `docs/mvp/03-matrice-des-droits-et-rls.md`
§8. `testeur` les reprend dans le document `18`.

---

## 11. Le worker

### 11.1 Ce qu'il traite

| Famille | Contenu | Déclenchement |
|---|---|---|
| **File `outbox_events`** | Contacts Brevo, contacts Apollo, **e-mails transactionnels de mise en relation** (M2), désinscriptions, propagation des suppressions | Interrogation toutes les 2 s en activité, 5 s au repos |
| **Relances commerciales** | `signed` sans commission facturée à J+7 · `commission_invoiced` sans encaissement à J+30 · fil silencieux à 14 j (document `01` §6.4) | Tâche quotidienne |
| **Intégrité du registre** | **Vérification de la chaîne d'empreintes** et des trous de séquence, alerte sur rupture (M4, point 4 : « une chaîne jamais vérifiée n'est pas une chaîne ») | Tâche nocturne |
| **Péremptions** | Badge à 90 jours (D34), propositions INFLUX non acceptées (document `01` §4.3), codes d'authentification expirés | Tâche quotidienne |
| **Rétention** | Purges définies par `expert-conformite-rgpd`. **Jamais le registre d'audit** | Tâche quotidienne |

### 11.2 Déploiement

- **Même paquet, même image que `apps/api`** ; commande de démarrage différente
  (`node apps/api/src/worker.ts`). *Révisé le 2026-09-25 (D64) : `apps/api` n'a pas d'étape de
  construction, Node exécute le TypeScript par effacement des types (`21` §4, J1-B).*
- **Service Railway distinct**, sans domaine public, **une seule instance** au MVP.
- Redémarrages fréquents (redéploiements) : le traitement est donc **au-moins-une-fois**, d'où
  l'obligation de clés d'idempotence sur chaque destination.
- **Arrêt propre sur `SIGTERM`** : le lot en cours se termine, les verrous se libèrent avec la
  transaction, aucun événement n'est perdu (il reste `pending`).
- Variables d'environnement : les mêmes que `apps/api`, **plus** les clés Brevo et Apollo, **moins**
  ce qui concerne le serveur HTTP — **et, pour la base, deux variables** : `WORKER_DATABASE_URL` et,
  depuis le J8 (commit 8), `PRIVACY_DATABASE_URL` (E-5, obligatoire en production). Le worker ne porte
  **ni `DATABASE_URL` ni `AUTH_DATABASE_URL`** (*révisé le 2026-09-26, `21` EC-20* ; liste exacte : §12.3).
- **Rôle de base : `influx_worker`, sans `BYPASSRLS`**, avec des `GRANT` et des politiques nommés
  table par table (§5, règle 3). Le worker n'est autorisé qu'aux opérations **E-3**
  (`leads.drain_outbox`) et **E-4** (`maintenance.run_periodic`) de la liste fermée du document `03`
  §P7, dont **aucune n'est appelable depuis une route HTTP**.
  *Ajouté le 2026-09-18 (revue `expert-cybersecurite`, B2).* *Précisé le 2026-09-26 (`21` EC-1) :*
  il s'y connecte par le rôle de connexion **`influx_worker_login`** (`LOGIN NOINHERIT`, membre
  d'`influx_worker` **seul**) et prend `influx_worker` par `SET LOCAL ROLE` dans chaque transaction.
  Depuis le J8 (avancée du Lot 5), E-5 passe par `influx_privacy_login`, sur un second pool du même
  processus, **jamais** ajouté au rôle de connexion du worker (`apps/api/src/domains/privacy/execution.ts`).

### 11.3 Surveillance

| Signal | Où | Seuil d'alerte |
|---|---|---|
| **Âge du plus vieux événement `pending`** | `/health` du worker + écran backoffice | > 5 min (priorité 0) · > 30 min (normal) |
| **Nombre d'événements `failed`** | Écran backoffice, cause en clair, rejeu unitaire ou en lot | > 0 : traitement requis, jamais laissé en l'état (indicateur n° 5 du cadrage) |
| **Battement de cœur** | Une ligne mise à jour à chaque tour de boucle | Aucun battement depuis 60 s = worker mort |
| **Dernière vérification de chaîne** | Date et résultat | Échec = **alerte immédiate**, c'est une atteinte à la preuve |
| **Journaux** | `pino` en JSON vers les journaux Railway | Aucune donnée personnelle superflue |

Le backoffice lit ces valeurs **depuis la base**, pas depuis le worker : il continue d'afficher un
état juste même si le worker est arrêté.

---

## 12. Conséquences sur Railway et Supabase

### 12.1 Services

| Service | Contenu | Exposition | Construit depuis |
|---|---|---|---|
| `web` | `apps/web` (`next start`) | **Public**, domaine principal | racine, `pnpm --filter @influx/web` |
| `backoffice` | `apps/backoffice` (`next start`) | **Public mais non référencé**, sous-domaine dédié | racine, `pnpm --filter @influx/backoffice` |
| `api` | `apps/api` (`node apps/api/src/main.ts`) | **Réseau privé uniquement — aucun domaine public** | racine, installation seule, sans construction (D64) |
| `worker` | `apps/api` (`node apps/api/src/worker.ts`) | **Aucune** | même paquet que `api` |

*Révisé le 2026-09-25 (D64) :* `api` et `worker` sont lancés par `node` **directement**, jamais au
travers de `pnpm start`, pour que `SIGTERM` atteigne le processus (arrêt propre, §4 règle 5) ;
Node ≥ 24.12 en production (`21` §4, J1-B).

`web` et `backoffice` joignent `api` par le réseau privé Railway (`api.railway.internal`). Deux
points d'attention pour `integrateur` : le réseau privé est **IPv6**, le serveur Fastify doit donc
écouter sur `::` ; et les chemins surveillés de chaque service doivent inclure `packages/**` et
`pnpm-lock.yaml` pour qu'un changement de contrat redéploie ce qu'il faut.

**Conséquence de sécurité majeure : `apps/api` n'a pas de surface publique.** Il n'existe aucune URL
d'API à découvrir, à balayer ou à attaquer directement. Le seul chemin est le passe-plat, qui n'a pas
de logique.

### 12.2 Environnements

**Deux environnements Railway** (`staging`, `production`) et **deux projets Supabase distincts** —
pas deux schémas dans un même projet. Raison : les rôles, les extensions, les réglages d'Auth et les
politiques sont **au niveau du projet** ; un projet partagé signifierait que le code de `staging`
peut atteindre les données de production. C'est un coût assumé (deux projets à payer et à
sauvegarder).

### 12.3 Variables d'environnement

Skill `env-secrets`. **Une clé distincte par environnement, sans exception.** Validation zod au
démarrage : une variable requise manquante fait **échouer le démarrage** avec un message clair.

| Variable | `web` | `backoffice` | `api` | `worker` | Nature |
|---|---|---|---|---|---|
| `INFLUX_ENV` (`development` \| `staging` \| `production`, sans valeur par défaut, §12.4) | ✔ | ✔ | ✔ | ✔ | Publique |
| `INFLUX_PUBLIC_SITE_URL` | ✔ | — | ✔ | ✔ | Publique |
| `INFLUX_API_INTERNAL_URL` | ✔ | ✔ | — | ✔ (J9) | Interne — côté `worker`, cible du `/health` de la sonde (§20.5), requise en environnement déployé |
| `INFLUX_API_INTERNAL_SECRET` (valeur propre à chaque front) — *ajoutée le 2026-09-25, D64* | ✔ | ✔ | — | — | **Secrète** — en-tête `x-influx-internal` (`03` PP-8) |
| `INFLUX_API_INTERNAL_SECRET_WEB`, `INFLUX_API_INTERNAL_SECRET_BACKOFFICE` — *ajoutées le 2026-09-25, D64* | — | — | ✔ | — | **Secrètes** — `apps/api` en déduit la surface appelante et lie `/v1/bo/…` au backoffice (`21` §4, J1-G) |
| `DATABASE_URL` (multiplexeur, rôle de connexion `influx_app`, membre des quatre rôles métier seuls) | — | — | ✔ | — | **Secrète** |
| `AUTH_DATABASE_URL` (multiplexeur, rôle de connexion `influx_auth_login`, membre d'`influx_auth` seul : E-1, E-2) — *2026-09-26, EC-20* | — | — | ✔ | — | **Secrète** |
| `WORKER_DATABASE_URL` (multiplexeur, rôle de connexion `influx_worker_login`, membre d'`influx_worker` seul : E-3, E-4) — *2026-09-26, EC-20* | — | — | — | ✔ | **Secrète** |
| `OPS_DATABASE_URL` (rôle de connexion `influx_ops_login`, écriture du schéma `ops`) — **au J4** | — | — | ✔ | — | **Secrète** |
| `PRIVACY_DATABASE_URL` (rôle de connexion `influx_privacy_login`, E-5) — **au J8** | — | — | — | ✔ | **Secrète** — obligatoire en production |
| `DIRECT_DATABASE_URL` (rôle de migration, **propriétaire des objets**) | — | — | — | — | **Secrète, CI uniquement** — jamais dans un service d'exécution |
| `INFLUX_PUBLIC_BACKOFFICE_URL` — *ajoutée le 2026-09-27 (`21` J1-F)* | — | — | ✔ | ✔ (J9) | Publique — origine de la surface `backoffice` pour le contrôle d'origine A4 (`03` §6.4) ; côté `worker`, cible de la sonde avec `INFLUX_PUBLIC_SITE_URL` (§20.5), les trois cibles ensemble |
| `SUPABASE_URL` | — | — | ✔ | ✔ (J7) | **Serveur uniquement**, non secrète. Côté `worker`, avec `SUPABASE_SECRET_KEY` (les deux ou aucune, requises en production) |
| `SUPABASE_SECRET_KEY` — **clé d'API HTTP**, à ne pas confondre avec le rôle Postgres `service_role`, qui n'est utilisé nulle part | — | — | ✔ (J3) | ✔ (J6) | **Secrète, jamais dans un bundle. Une clé par service** (`api`, `worker`), révocable séparément (*2026-09-27, `21` EC-46*). Usage limité à GoTrue (création d'utilisateur, code, second facteur ; côté `worker`, la seule purge E-4 des utilisateurs orphelins) et aux URL signées du Storage. **Jamais pour atteindre une table** |
| ~~`SUPABASE_PUBLISHABLE_KEY`~~, ~~`SUPABASE_JWKS_URL`~~ | — | — | — | — | **Retirées le 2026-09-27** (`21` EC-46) : tout appel à GoTrue porte la clé secrète, et INFLUX ne vérifie aucun JWT (`21` J3-C règle 3). Sur les projets hébergés, la clé *publishable* est désactivée si la plateforme le permet (`21` G-1) |
| `BREVO_API_KEY` | — | — | ✔ | ✔ | **Secrète. Deux clés distinctes par environnement**, une pour `api` (code de connexion `P0`, D43 ; alertes D60), une pour `worker` (*2026-09-27, `21` EC-19*) |
| `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`, `BREVO_SENDER_TRANSACTIONAL` | — | — | ✔ | ✔ | Garde-fous du §12.4 appliqués **aussi** à `api`, dès le premier envoi du code (`16` §M8) |
| `BREVO_SENDER_MARKETING`, `BREVO_SENDER_PROSPECTING`, `BREVO_SUPPRESSION_LIST_ID` | — | — | — | ✔ | `16` §M8 |
| `BREVO_WEBHOOK_SECRET_CURRENT`, `…_SECRET_PREVIOUS`, `BREVO_WEBHOOK_PATH_TOKEN_CURRENT`, `…_PATH_TOKEN_PREVIOUS` — J7 | — | — | ✔ | — | **Secrètes** — `api` seul reçoit le webhook (`21` EC-12) ; refusées au démarrage du `worker` sur Railway ; `_PREVIOUS` pendant une rotation seulement. *`BREVO_IP_ALLOWLIST` supprimée (J7 commit 3) : plages Brevo en constante datée de `brevo-webhook.ts`* |
| `APOLLO_API_KEY` | — | — | — | ✔ | **Secrète** |
| `AUTH_TOKEN_SIGNING_SECRET` — *remplace `SESSION_COOKIE_SECRET` le 2026-09-27 (`21` EC-24)* | — | — | ✔ | — | **Secrète**, ≥ 32 octets. Signe les seuls jetons courts (cookie de parcours, jeton d'inscription) ; **l'identifiant de session, opaque, n'est jamais signé** (seule son empreinte est en base). Distincte de tout autre secret du processus |
| `AUTH_THROTTLE_PEPPER` | — | — | ✔ | — | **Secrète**, ≥ 32 octets. Clé HMAC des empreintes de limitation de débit (`04` §12.10), de l'adresse pseudonyme transmise à GoTrue (`21` EC-38) et de l'anti-rejeu TOTP (`21` EC-39), chacune avec son étiquette de séparation |
| `SYNC_MODE` (`live` \| `dry_run`) | — | — | — | ✔ | Garde-fou, §12.4 |
| `NON_PRODUCTION_RECIPIENT_ALLOWLIST` | — | — | — | ✔ | Garde-fou, §12.4 : `development` seul, refusée en environnement déployé (comme `BREVO_TEST_RECIPIENTS`) |
| `OPS_ALERT_RECIPIENTS` — *J9 commit 8 (§20.10, `15` RG165)* | — | — | ✔ | ✔ | Non secrète, **jamais recopiée** : adresses d'astreinte (`on_call`) des alertes techniques, séparées par des virgules, jamais en base (§20.8), seules disponibles base injoignable ; requise en environnement déployé (D70, EC-J9-7) |

**Variables de base : refus de démarrage** (*ajouté le 2026-09-26, `21` EC-20, tranché par
`expert-cybersecurite`* ; `ELEVATED_DATABASE_URL` disparaît, `03` §4 P7 fait foi) :

1. l'utilisateur de chaque URL (avant le `.` du multiplexeur, format `<rôle>.<référence du
   projet>`) doit être **exactement** le rôle de connexion attendu pour cette variable ;
2. deux URL d'un même processus ne partagent jamais le même utilisateur ;
3. à l'ouverture de chaque grappe, `current_user` et l'absence de `rolsuper` / `rolbypassrls` sont
   vérifiés **en base** ;
4. sur Railway (`RAILWAY_ENVIRONMENT_NAME` présent), la présence d'une variable de base réservée à
   un autre service fait échouer le démarrage (par exemple `DATABASE_URL` ou `AUTH_DATABASE_URL`
   sur `worker`). En local, `apps/api/.env.local` porte les trois variables, puisque les deux
   processus y lisent le même fichier.

**Les deux fronts ne détiennent aucun secret.** C'est vérifiable : une règle ESLint interdit
`process.env` en dehors de `src/config/` dans `apps/web` et `apps/backoffice`, et la configuration
n'y déclare que des valeurs publiques.

### 12.4 Le garde-fou d'environnement : `staging` envoie comme la production, la pile locale et les tests jamais

*Réécrit le 2026-10-18 (D70, arbitrage du fondateur contre `03` §6.8 ; mécanisme tranché par
`architecte`, D70 point 5). La version du cadrage (« impossible d'envoyer un vrai e-mail depuis
`staging` ») est abrogée.* Le risque du cadrage (§10.2 : « e-mail envoyé par erreur depuis
l'environnement de test ») demeure, mais l'environnement de test est désormais la **pile locale, la
CI et les tests automatisés**. `staging` est un environnement **déployé** : il envoie réellement,
avec ses propres comptes, exactement comme la production.

**Trois valeurs d'`INFLUX_ENV`, sans valeur par défaut** (absente ou inconnue ⇒ refus de démarrage,
`18` T17.8) :

| Valeur | Où | Envois |
|---|---|---|
| `development` | Pile locale lancée par Playwright, CI, tests automatisés et leurs helpers | Jamais vers un service réel ni une vraie adresse : doublure, verrous 2 et 3 ci-dessous |
| `staging` | Environnement Railway `staging` ; poste local chargeant `.env.local` (diagnostic court seulement) | Réels, comptes et domaine d'envoi de `staging` (D70) |
| `production` | Environnement Railway `production` | Réels |

**Un seul prédicat : « environnement déployé ».** `isDeployedEnvironment`, défini une fois dans
`apps/api/src/config/`, est vrai pour **toute valeur autre que `development`** : une valeur ajoutée
un jour prend d'office les exigences strictes. Il porte, pour `staging` comme pour la production et
sans exception, les refus de démarrage suivants (`api` et `worker` selon la variable) :

1. `BREVO_MODE` différent de `live` ⇒ refus (`api` et `worker`) ; `SYNC_MODE` différent de `live`,
   absence comprise, ⇒ refus (`worker`). Une production ou un `staging` silencieusement muets sont
   aussi graves qu'un envoi de test réel.
2. `BREVO_TEST_RECIPIENTS` ou `NON_PRODUCTION_RECIPIENT_ALLOWLIST` renseignée ⇒ **refus, jamais
   ignorée** : une variable dormante revivrait au premier changement d'`INFLUX_ENV`, et la
   configuration de `staging` doit porter les mêmes noms que celle de la production
   (`staging:check`).
3. `BREVO_API_BASE_URL` différente de l'URL officielle ⇒ refus (la doublure en bouclage n'est
   jamais atteinte d'un environnement déployé).
4. Secrets du webhook Brevo absents ⇒ refus (`api` ; désinscriptions, `16` RG89).
5. `PRIVACY_DATABASE_URL` absente, ou paire `SUPABASE_URL` / `SUPABASE_SECRET_KEY` incomplète ⇒
   refus (`worker` ; exécution des demandes « mes données », purge GoTrue).
6. Origine non `https` pour `SUPABASE_URL` (`api`, `worker`), `INFLUX_PUBLIC_SITE_URL` et
   `INFLUX_PUBLIC_BACKOFFICE_URL` (`api`) ⇒ refus.
7. Réglages de synchronisation indispensables manquants ⇒ refus (`worker`, §12.5, `05` RG162),
   au commit (b) de D67.

En `development`, à l'inverse : `BREVO_MODE=live` ⇒ refus ; `BREVO_MODE=redirect` sans
`BREVO_TEST_RECIPIENTS` ⇒ refus ; `SYNC_MODE=live` sans `NON_PRODUCTION_RECIPIENT_ALLOWLIST` ⇒
refus ; **`INFLUX_ENV=development` sur Railway (`RAILWAY_ENVIRONMENT_NAME` présent) ⇒ refus** : un
service déployé ne se relâche pas en changeant une variable.

**Le code métier ne lit jamais l'environnement.** Le prédicat ne s'emploie que dans les schémas de
configuration ; la configuration remet au connecteur un filtre de destinataires déjà résolu (liste
blanche en `development`, « sans restriction » en environnement déployé ; valeur discriminée, jamais
`null`). Tout nouveau test `=== "production"` dans `apps/api/src` est un défaut de revue, sauf pour
une différence de la liste fermée de D70.

**Quatre verrous, après D70.**

1. **Clés distinctes — partout, inchangé.** Une clé de production n'existe qu'en production
   (`16` RG115). `staging` a ses propres comptes et clés (Supabase, Brevo, Apollo, Railway) et son
   propre domaine d'envoi, jamais l'un des trois sous-domaines de production (`16` RG9) ; la CI et
   les tests n'ont aucune clé et restent sur la doublure (`16` RG148). Ce verrou est d'exploitation :
   le prédicat ne lit ni ne relâche aucune clé, et le poste n'atteint pas la production (jeton
   Railway limité à `staging`, `archives/jalons/d70-plan.md` P3).
2. **Mode explicite — `development` seul.** `BREVO_MODE=disabled` par défaut ;
   `SYNC_MODE=dry_run` par défaut : le connecteur **n'appelle rien**, marque la ligne `succeeded`
   avec `dry_run: true` et journalise ce qu'il aurait envoyé.
3. **Liste blanche de destinataires — `development` seul.** En `SYNC_MODE=live` (test volontaire de
   bout en bout contre la doublure), tout destinataire dont le domaine n'est pas dans
   `NON_PRODUCTION_RECIPIENT_ALLOWLIST` est marqué `skipped_non_production`, évalué au connecteur
   après tout le mappage, en condition positive (`03` §6.8) ; en `BREVO_MODE=redirect`, seule une
   adresse de `BREVO_TEST_RECIPIENTS` est atteinte (`16` RG117). **`skipped_non_production` n'est
   atteignable dans aucun environnement déployé.**
4. **Aucune donnée de production hors production — inchangé** (`03` §6.8, B9) : `staging` ne porte
   que des données synthétiques ou de testeurs internes.

**Différences entre `staging` et production** : la liste fermée de D70 (1). Dans le code, seule la
valeur d'`INFLUX_ENV` les distingue, et elle ne décide d'**aucune** exigence de démarrage ; elle ne
sert qu'à `noindex` (`apps/web/next.config.ts` : seule la production est indexable) et au libellé
du bandeau `16` RG118 (« `staging` — envois réels »). Les scripts d'exploitation refusent
`production` et non « déployé » (`apps/api/scripts/script-guards.ts`), puisqu'ils servent `staging`.

**Incident** (`16` RG120 amendée) : un envoi réel depuis la pile locale, la CI ou un test, ou une
clé de production hors production. Un envoi réel depuis `staging` n'en est pas un.

Tests : `18` T17, matrice par environnement (`development` garde les verrous 2 et 3 ; `staging`
refuse exactement ce que refuse la production ; aucun script `test`, `test:db` ou e2e ne charge
`.env.local`).

### 12.5 Le pendant en base : une production sans listes ni modèles Brevo est une production muette

*Ajouté le 2026-10-17 (D67, tranchée par `architecte` le même jour). Ne modifie aucun des trois verrous
du §12.4.* Les identifiants de listes et de modèles Brevo et les réglages Apollo ne sont pas des
variables d'environnement : ils vivent en base (`leads.sync_settings`, `04` §5.8), lus à chaque
consommation et modifiables sans redéploiement. Le §12.3 ne les voit donc pas, et une valeur `NULL`
produisait jusqu'ici un `skipped` silencieux. Règles (`05` RG160 à RG164) :

1. **Refus de démarrage du worker en production** si un réglage indispensable à tout inscrit manque
   ou est illisible : listes Brevo des deux rôles, deux modèles de bienvenue, `retry_schedule`,
   `rate_limits` des destinations dotées d'une clé, et les trois réglages Apollo **si**
   `APOLLO_API_KEY` est présente (`05` RG162). Lecture sans cache : RG81 reste la seule lecture qui
   décide. Aucune variable nouvelle au §12.3.
2. **À chaud, jamais d'arrêt** : un réglage manquant après le démarrage (nouveau modèle à `NULL`,
   pays Apollo validé sans clé) met **les seules lignes concernées** en échec de nature incident,
   alerté (AL25, §20.6) et rattrapé automatiquement à la correction (`05` RG160, RG161). Arrêter le
   worker bloquerait les retraits de consentement et les suppressions (`05` RG78), dont le délai est
   légal.
3. **Un identifiant Brevo renseigné ne redevient jamais `NULL`** (contrôle en base, `05` RG163) : ce
   qui a passé le contrôle de démarrage ne peut pas disparaître à chaud.
4. **En `dry_run`, la trace `would_send` précède le verdict de configuration** (`05` RG164) ; `staging`
   porte les identifiants du compte Brevo de test et ne refuse pas de démarrer.
5. *(architecte, 2026-10-17)* **Le rattrapage est une étape de la boucle E-3** du worker, comme la
   reprise des lignes orphelines (`18` TM1.10) : ni tâche E-4, ni déclencheur qui écrirait dans la file, ni file
   nouvelle. **Deux déclencheurs** sur `leads.sync_settings`, et rien d'autre en SQL : la garde
   « jamais `NULL` » et le journal `settings.changed` de toute écriture, écran ou SQL, qui date aussi
   la modification de chaque clé (`05` RG161, RG163). La validité d'un réglage n'est jugée qu'à un
   endroit, en TypeScript : la même lecture sert le contrôle de démarrage, la préparation du
   connecteur et, par elle, le rattrapage.

---

## 13. Sortie du mode maquette de `apps/web`

`apps/web` est verrouillée en maquette par des règles ESLint (`apps/web/eslint.config.mjs`) et des
tests de garde (`apps/web/tests/guards.test.ts`, G1 à G7). Ces verrous ont bien fonctionné : ils
doivent être **levés chirurgicalement**, pas supprimés en bloc.

> **Note de correction :** le fichier se trouve bien en `apps/web/tests/guards.test.ts` (et non
> `apps/web/src/tests/`), conformément à l'arborescence de `docs/landing-page/01-architecture.md` §7.

### 13.1 Tests de garde

| Test | Vérifie aujourd'hui | Décision | Ce qui le remplace |
|---|---|---|---|
| **G1** | Aucun `mailto:` ni `tel:` | **Conservé au Lot 0, resserré au Lot 1** | Interdiction maintenue **dans l'espace membres et dans tout composant affichant du contenu utilisateur** (c'est un vecteur de contournement, `CLAUDE.md` §3). Autorisé sur les pages légales et la page de contact publique |
| **G2** | Aucune URL `http(s)://` | **Levé au Lot 1** | Remplacé par : (a) une garde **resserrée** — aucune URL littérale hors de `src/config/` et `src/locales/` (les URL viennent de la configuration ou des traductions) ; (b) une **CSP `default-src 'self'`** avec `connect-src` explicite, appliquée en production et **testée**, qui rend la règle vérifiable à l'exécution plutôt qu'à la lecture |
| **G3** | Aucune couleur ni longueur en dur hors fichiers de tokens | **Conservé définitivement, et étendu** à `apps/backoffice` et `packages/ui` | — (c'est l'invariant du design system, `CLAUDE.md` §10.3 règle 7) |
| **G4** | Chaque photo est créditée | **Conservé tant que `src/content/placeholders/` existe**, supprimé avec lui au Lot 1 | La procédure de retrait est déjà écrite (`01-architecture.md` §6.1) |
| **G5** | Aucun `route.ts` sous `src/app` | **Levé et remplacé par une garde plus stricte** | **Liste blanche** : le seul fichier de route autorisé est `src/app/api/[...path]/route.ts`, et son contenu **ne doit contenir aucun import de `@supabase/*`, `drizzle-orm`, `pg`, `postgres`, aucune lecture de variable d'environnement secrète, et aucun `if` métier**. C'est une garantie **meilleure** que « zéro route » : elle survit à la vraie application |
| **G6** | `IS_MOCKUP === true` tant que le fictif existe | **Conservé jusqu'au retrait du module fictif au Lot 1**, puis supprimé | La non-indexation devient une affaire d'environnement : `staging` non indexé par en-tête, `production` indexé — réglage d'`integrateur`, plus une constante de code |
| **G7** | Aucun conflit de classes Tailwind | **Conservé et étendu** à `apps/backoffice` et `packages/ui` | — |
| *(garde annexe)* | Parité des clés FR/EN | **Conservée**, étendue à tous les fichiers de traduction (pas seulement `landing.json`) | — |
| *(garde annexe)* | Aucune API réseau ni stockage | **Scindée** : voir §13.2 | — |
| *(garde annexe)* | Valeurs fictives confinées, `CreatorCard` sans champ d'identité | **Conservée**, et la seconde **promue en règle permanente** : aucun type exposé à une marque ne porte de champ identifiant (D16, A2) | Doublée par les tests d'anonymisation de §10.3 |

### 13.2 Règles ESLint

| Règle | Décision |
|---|---|
| Interdiction de `fetch` et consorts | **Scindée.** `fetch` devient autorisé **dans le seul module `src/server/api-client.ts`** et interdit partout ailleurs : aucun composant n'appelle jamais le réseau directement |
| Interdiction de `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `cookieStore`, `sendBeacon` | **Conservée définitivement.** La session est un cookie `httpOnly` ; aucun jeton ne doit pouvoir être lu par du JavaScript (D37) |
| Interdiction de `'use server'` (Server Actions) | **Conservée définitivement.** Une Server Action est un point d'accès RPC à contrat implicite ; nos contrats sont explicites et vivent dans `packages/contracts` |
| Interdiction des attributs `style`, `action`, `formAction` | `style` **conservé** (invariant tokens) ; `action`/`formAction` **levés** au Lot 1 (les formulaires réels soumettent) |
| Interdiction d'importer `next/link`, `next/form`, `next/script`, `next/font/google` | **Conservée** (`next/link` : on utilise le lien localisé de next-intl) |
| Interdiction d'importer le module fictif hors de deux fichiers | **Supprimée avec le module**, au Lot 1 |
| `react/jsx-no-literals` | **Conservée** (bilingue par construction) |
| `@typescript-eslint/no-explicit-any` | **Conservée** (`CLAUDE.md` §6) |
| Classes Tailwind inconnues et valeurs arbitraires | **Conservées et étendues** aux nouveaux paquets |
| **Nouvelle règle** | **Interdire l'import de `@supabase/*`, `drizzle-orm`, `pg`, `postgres` dans `apps/web` et `apps/backoffice`** — c'est la règle §2 rendue structurelle plutôt que morale |
| **Nouvelle règle** | **Interdire `process.env` hors de `src/config/`** dans les deux fronts |
| **Nouvelle règle** | Dans `apps/api` : **interdire l'import de `@supabase/*` hors de `src/platform/supabase.ts`**, et l'import croisé d'un `repository.ts` d'un autre domaine |

### 13.3 Ordre des opérations au Lot 0 et au Lot 1

1. **Lot 0** — créer `apps/api`, `apps/backoffice`, `packages/contracts`, `supabase/` ; étendre G3 et
   G7 aux nouveaux paquets ; ajouter les trois nouvelles règles ESLint ; brancher la CI. **Aucune
   garde de `apps/web` n'est levée à ce stade, à deux exceptions près** : *révisé le 2026-09-25
   (`21` EC-13, J1-C)* — **G5 et la garde annexe réseau tombent au J1**, dans le commit du
   passe-plat, remplacées dans ce même commit par la liste blanche des fichiers de route, la garde
   des importeurs et l'empreinte (PP-12), et par l'ouverture de `fetch` dans le seul client d'API.
   Sans elles, aucun compte de démonstration ne se connecte au Lot 0 (`00` §7). La landing reste une
   maquette : aucun de ses composants n'atteint le réseau.
2. **Lot 1** — dans le même changement : retirer le module fictif, retirer G4 et G6, lever G2 et
   remplacer par la garde resserrée plus la CSP, resserrer G1, brancher l'inscription réelle sur
   `apps/api`. **Le bandeau « Maquette » disparaît dans le même commit que la première donnée
   réelle**, jamais avant.

---

## 14. Ce qui reste ouvert

### 14.1 Avis de `expert-cybersecurite` — **rendu le 2026-09-18, favorable sous conditions**

Les neuf points soumis ont été instruits dans **`docs/mvp/03-matrice-des-droits-et-rls.md`**. Aucune
des cinq décisions n'est remise en cause. Trois constats bloquants portaient sur **ce document** et
sont intégrés dans la présente version (B1 au §2.5, B2 aux §5 et §10.2, B3 au §5). État des neuf
points :

| # | Sujet | Suite donnée |
|---|---|---|
| 1 | **D37 dans son ensemble** : code à usage unique sans mot de passe côté membres, MFA côté backoffice, durées, anti-énumération, limitation de débit | **Validé**, avec une **condition de caducité à inscrire maintenant** : la validation de l'authentification sans mot de passe **tombe automatiquement** le jour où la V2 introduit des coordonnées bancaires ; un second facteur deviendra alors obligatoire **côté membres**. Exigence ajoutée : le **changement d'adresse e-mail exige une confirmation depuis l'ancienne et depuis la nouvelle** — sans mot de passe, une boîte compromise dix minutes suffirait sinon à s'approprier un compte définitivement |
| 2 | **`aal2` vérifié dans les politiques RLS** | **Validé**, avec la règle de rédaction **P4** : condition **positive**, jamais de négation sur un réglage de session, pour qu'un contexte absent refuse au lieu d'ouvrir |
| 3 | **Rôle métier lu en base plutôt que dans le jeton** | **Validé**, avec une mise en œuvre qui supprime l'objection de performance : **une lecture indexée par transaction**, pas une par évaluation de politique (§9.3) |
| 4 | **Le passe-plat** de §9.3 | **Validé** dans sa forme bornée (liste blanche d'en-têtes, aucune logique) |
| 5 | **Les trois CSP** et les en-têtes de sécurité | Instruit au document `03` |
| 6 | **L'exception E1** (URL signée du Storage) | **Validée pour le portfolio, refusée pour les pièces de vérification** : celles-ci transitent par `apps/api`, qui journalise chaque consultation — une URL signée qui fuite d'un journal ou d'un en-tête `Referer` est une pièce d'identité qui circule. Exigences ajoutées : compartiments **privés** et séparés par sensibilité, limites de type et de taille **au niveau du compartiment**, chemin d'objet calculé par le serveur (**jamais le nom de fichier d'origine**), et **ré-encodage des images pour supprimer les métadonnées EXIF** — une capture d'écran de téléphone porte fréquemment une géolocalisation |
| 7 | **La liste des opérations élevées** | **Tranchée** : cinq opérations E-1 à E-5, union fermée dans `packages/contracts`, dont trois non appelables depuis une route HTTP. Et le rôle `service_role` est **supprimé de l'exécution** (B2) |
| 8 | **Les trois verrous du garde-fou `staging`** (§12.4) | **Validés** |
| 9 | **Inscription et récupération du second facteur** du backoffice | Instruit au document `03` |

**Deux points nouveaux, non soulevés par moi, à porter au Lot 0** parce qu'ils touchent
l'architecture et non seulement les droits :

- **La dérogation du fondateur du 2026-09-17 supprime les Pull Requests**, or toute migration touchant
  `audit.*`, une politique, un `GRANT`, un `REVOKE`, une fonction `SECURITY DEFINER` ou un attribut de
  rôle devrait être vue par `expert-cybersecurite`. Parade proportionnée retenue, **sans revenir sur
  la dérogation** : un contrôle de CI qui **échoue** quand un fichier de `supabase/migrations/**`
  contient l'un de ces motifs, sauf si le message de commit porte le marqueur
  `security-reviewed: <date>`. Coût : deux heures. **À intégrer par `integrateur` au Lot 0.**
- **Publication externe quotidienne de l'empreinte de tête** de la chaîne d'audit, par e-mail
  transactionnel. Une preuve auto-produite vaut par sa cohérence avec des éléments détenus par des
  tiers (document `01` §M4) : cela place une copie horodatée hors de toute base que nous
  administrons. Coût : une demi-journée. Passe par la file `outbox_events` (§6), destination
  `brevo_transactional`.

### 14.2 À décider avec `expert-database` (documents `03` et `04`)

| # | Sujet |
|---|---|
| 1 | ~~Forme exacte : deux tables, une table plus une vue, ou une vue matérialisée ?~~ — **TRANCHÉE le 2026-09-18 (revue `expert-cybersecurite`, §P5) : deux tables**, `profiles.creator_public_profiles` et `profiles.creator_identities`. Ni vue seule (`security_invoker` exigerait un `GRANT` de l'annonceur sur l'objet identifiant ; sans `security_invoker`, la vue contournerait la RLS), ni vue matérialisée. Reste à `expert-database` : les colonnes, les types, les index, et la vue `creator_identities_revealed` qui porte le prédicat de révélation |
| 2 | Implémentation du **chaînage** : algorithme d'empreinte, sérialisation des écritures, format de la séquence, requête de vérification nocturne |
| 3 | Coût réel de la lecture du rôle métier (§7, précision 2) — à **mesurer**, pas à supposer. *Précision du 2026-09-18 : la mise en œuvre retenue est **une lecture indexée par transaction**, et non une lecture par évaluation de politique ; les politiques lisent ensuite `current_setting('influx.role', true)`, une lecture mémoire* |
| 4 | Index de `outbox_events` (partiel sur `status = 'pending'`) et des files de validation |
| 5 | ~~Répartition en schémas Postgres par domaine ou schéma unique~~ — **TRANCHÉE le 2026-09-18 (revue `expert-cybersecurite`, constat bloquant B3) : schémas par domaine**, pour raison de sécurité. Supabase expose PostgREST sur `public` avec la clé `anon`, qui est publique par conception ; aucune table métier ne doit s'y trouver, aucun de nos schémas n'est exposé à PostgREST, et `anon` comme `authenticated` restent **vides de droits** sur nos données. Reste à `expert-database` : la répartition exacte des tables entre les dix schémas (§5, règle 4) |
| 6 | Règles de rétention et de purge, avec `expert-conformite-rgpd` |
| 7 | *Ajouté le 2026-09-18 :* le **chemin de lecture de la révélation** — vue `security_invoker = true` `profiles.creator_identities_revealed` portant le prédicat de révélation, et **un seul chemin** (document `03` §P5) |

### 14.3 Dépendances sur d'autres décisions

| Décision | Effet sur ce document |
|---|---|
| **D36** (langue du backoffice) | Détermine si `packages/i18n` est créé au Lot 5 ou jamais. **Tant qu'elle est ouverte, `apps/backoffice` reste en français, sans next-intl** |
| **D39** (SLA de la file de validation) | Détermine les seuils d'alerte et les tâches d'escalade du worker |
| **D40** (masquage symétrique côté marque) | S'il est retenu, il applique **exactement** le même mécanisme qu'au §2.5 : deux objets, pas un filtre |
| **D34** (badge) | Détermine la tâche de péremption à 90 jours du worker |
| **D25** (pays de la société) | Détermine la région d'hébergement Supabase, à confirmer avant le Lot 1 |

---

## 15. Conventions pour `dev-react-node`

Elles complètent les douze conventions de `docs/landing-page/01-architecture.md` §11, qui restent
applicables à `apps/web`.

1. **Aucune logique métier dans un composant React**, dans aucune des deux applications. Un composant
   reçoit des données et des libellés, il affiche. Règle déjà posée par `CLAUDE.md` §6, réaffirmée.
2. **Aucun front n'importe `@supabase/*`, `drizzle-orm`, `pg` ni `postgres`.** Vérifié par ESLint.
3. **Aucun accès réseau hors de `src/server/api-client.ts`** dans un front. Ce module est le seul à
   connaître l'URL de l'API.
4. **Aucun accès à la base hors de `withUserTransaction` / `withElevatedTransaction`** dans
   `apps/api`. `withElevatedTransaction` n'accepte qu'une valeur de la **liste fermée** E-1 à E-5 ;
   tout le reste passe par une fonction `SECURITY DEFINER` étroite. **Aucun rôle utilisé à
   l'exécution n'a `BYPASSRLS` ni `SUPERUSER`**, et le rôle Postgres `service_role` n'est utilisé
   nulle part. *Révisé le 2026-09-18 (revue `expert-cybersecurite`, B2).*
4 bis. **Toute fonction `SECURITY DEFINER` porte `SET search_path = ''`**, qualifie tous ses objets
   par leur schéma, et se termine par `REVOKE EXECUTE … FROM PUBLIC` puis un `GRANT` nominatif. Par
   défaut, **tout le monde peut exécuter une fonction** : ne pas révoquer revient à la publier.
4 ter. **Aucune table métier dans `public`** : un schéma par domaine, `REVOKE ALL` sur `anon` et
   `authenticated`. Toute table nouvelle est déclarée dans la matrice du document `03` §3 **avant**
   d'être créée — sans quoi la CI échoue.
5. **Toute route de l'API déclare un schéma de requête et un schéma de réponse** issus de
   `packages/contracts`. Sans schéma de réponse, la route est refusée en revue.
6. **Les types anonymisé et identifiant ne se convertissent jamais** l'un en l'autre côté front. Les
   confondre doit être une erreur de compilation.
7. **Aucun taux, aucune multiplication de montant, nulle part** — ni serveur, ni front, ni export,
   ni e-mail (C5, document `01` §7). La seule arithmétique autorisée est l'addition et la
   soustraction de montants **saisis**.
8. **Montants** : entiers en plus petite unité monétaire ou `numeric` exact, devise ISO 4217
   explicite, **jamais de flottant**, jamais de montant sans sa devise à l'affichage.
9. **Horodatages en `timestamptz`**, formatés à l'affichage selon la langue de l'utilisateur.
10. **Tout événement métier synchronisable est mis en file dans la même transaction que le fait.**
    Jamais d'appel HTTP externe dans une transaction, jamais d'appel externe sur le chemin d'une
    inscription.
11. **Tout accès privilégié laisse une trace** : lecture de conversation par un agent, émission
    d'URL signée, action de masse, export. Si l'action n'est pas traçable, elle n'est pas écrite.
12. **Aucun secret dans le code, aucune valeur de secret dans un journal.** Toute variable nouvelle
    passe par la skill `env-secrets` et est documentée dans `.env.example` avec une valeur factice.
13. **TypeScript strict, aucun `any`** sans justification écrite en commentaire (`CLAUDE.md` §6).
14. **Commits** en anglais, *Conventional Commits*, directement sur `main` tant que la dérogation du
    fondateur du 2026-09-17 n'est pas levée.
15. **Avant d'utiliser une API d'une dépendance, lire la documentation de la version installée**,
    pas un article de blog.

---

## 16. Points à faire valider par le fondateur

| # | Point | Pourquoi c'est à vous |
|---|---|---|
| 1 | **Quatre services Railway par environnement** (`web`, `backoffice`, `api`, `worker`), soit **huit au total** | Coût d'exploitation mensuel récurrent |
| 2 | **Deux projets Supabase distincts** (`staging` et `production`), pas un seul partagé | Coût, et c'est la seule façon d'empêcher le code de test d'atteindre les données réelles |
| 3 | **Un sous-domaine dédié au backoffice**, non référencé, jamais lié depuis le site public | Choix de nom de domaine, à faire au moment de la réservation (prérequis n° 3 du cadrage) |
| 4 | **Pas de mot de passe pour les membres au MVP** : on se connecte avec un code à 6 chiffres reçu par e-mail | C'est visible par vos utilisateurs. C'est aussi ce que font Notion, Slack ou Vercel, mais c'est votre produit |
| 5 | **Pas de connexion via Google, Instagram ou TikTok au MVP** | Un clic de moins à l'inscription. Refusé pour l'instant parce qu'une connexion par Instagram serait comprise comme une vérification d'audience, ce que seul le badge doit affirmer |
| 6 | **Le backoffice sera en français uniquement** tant que D36 n'est pas tranchée | Si vous prévoyez un commercial non francophone, dites-le maintenant : cela change le chiffrage du Lot 5 |
| 7 | **La délivrabilité des e-mails devient la disponibilité du produit** (conséquence du point 4) | Cela rend l'authentification du domaine (SPF, DKIM, DMARC) **bloquante** pour le Lot 1, et non plus seulement recommandée |

---

## 17. Mises à jour des autres documents

| Document | Ce qui est fait | Par qui |
|---|---|---|
| `docs/landing-page/01-architecture.md` | **Fait le 2026-09-18 par `architecte`** : §11 règle 5 corrigée (bannière cookies à **deux** boutons, incohérence I4) ; §3, §13 et §14 mis à jour — les emplacements `apps/api`, `apps/backoffice`, `packages/` et `supabase/` ne sont plus « réservés, à trancher » mais **figés par D2, D5 et D12**, avec renvoi vers le présent document (incohérence I10) | `architecte` |
| `CLAUDE.md` §6, §7, §13 | D2, D5, D12, D18 passées à « Tranchée (2026-09-18) » ; D37 ajoutée et tranchée ; domaines `search` et `verification` ajoutés au §7 ; emplacements figés au §6 | **`chef-de-projet`** — ce document ne modifie pas `CLAUDE.md` |
| `docs/mvp/03-matrice-des-droits-et-rls.md` | **Écrit le 2026-09-18.** Avis favorable sous conditions ; **fait foi** sur la matrice des droits, les dix principes RLS, la lecture journalisée des conversations, l'isolement du backoffice et les tests de sécurité exigibles. Ses constats B1, B2 et B3 sont intégrés au présent document | `expert-cybersecurite` + `architecte` |
| `docs/mvp/04-modele-de-donnees-mvp.md` | Reprend §5, §6 et §10 et produit le schéma, les politiques et les migrations | `expert-database` |
| `docs/mvp/18-plan-de-test-mvp.md` | Reprend §10.3, §12.4 et §13 comme socle du « prêt à livrer » du Lot 0 | `testeur` |

---

## Sources (vérifiées le 2026-09-18)

- [Fastify — versions et support long terme](https://fastify.dev/docs/latest/Reference/LTS/)
- [fastify sur npm](https://www.npmjs.com/package/fastify)
- [Drizzle ORM — Row-Level Security](https://orm.drizzle.team/docs/rls)
- [drizzle-orm sur npm](https://www.npmjs.com/package/drizzle-orm)
- [Exemple de référence : Drizzle + RLS Supabase par transaction](https://github.com/rphlmr/drizzle-supabase-rls)
- [Supabase — Introducing JWT Signing Keys](https://supabase.com/blog/jwt-signing-keys)
- [Supabase — JSON Web Tokens](https://supabase.com/docs/guides/auth/jwts)
- [Supabase — nouvelles clés d'API et authentification asymétrique](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys)
- [Railway — déploiement d'un monorepo](https://docs.railway.com/deployments/monorepo)
- [CVE-2025-55182 (Vercel)](https://vercel.com/changelog/cve-2025-55182)

---

## 18. Addendum du 2026-09-19 — D43 : chemin d'envoi des e-mails transactionnels critiques (code de connexion)

> **Date :** 2026-09-19 · **Auteur :** agent `architecte` · **Statut :** tranchée, applicable au Lot 1
> **Saisine :** question ouverte laissée par `expert-integrations-api` dans
> `.claude/skills/lead-pipeline/SKILL.md`, section « Les trois priorités d'envoi ».
>
> **Ce que cet addendum tranche :** par où passe un e-mail de priorité **`P0`** — en pratique, le
> **code de connexion à 6 chiffres de D37** — et ce qu'est exactement `leads.transactional_sends`.
>
> **Ce qu'il ne remet pas en cause :** **D18** reste entière. `P1` et `P2` continuent de passer par
> `leads.outbox_events`, avec le worker, le verrou consultatif de transaction et la priorité aux
> révocations. **Seul le `P0` en sort.**
>
> **Ce qu'il ne tranche pas :** les colonnes, contraintes, droits et index exacts
> (`expert-database`, document `04`) ; les seuils d'alerte et leur affichage (`16` §H, `15`) ; le
> plan de test (`testeur`, document `18`) ; l'existence d'un **expéditeur de secours** pour le seul
> code de connexion, qui reste la question ouverte **Q8 de `16`**, adressée au fondateur.
>
> **À lire avec :** `05` §F et §G (RG39 à RG65), `16` §H (RG85 à RG101), §J (RG121, RG122) et §M2,
> `03` §6.1 (conditions A-1 à A-12) et §P7 (opérations élevées E-1 à E-5), `04` §5.8.

### 18.1 Contexte

Depuis **D37**, un membre n'a pas de mot de passe : il se connecte avec un code à six chiffres reçu
par e-mail. La conséquence a été écrite au §16, point 7, mais elle mérite d'être répétée ici parce
que c'est elle qui justifie tout ce qui suit :

> **La délivrabilité de cet e-mail n'est pas un indicateur marketing. C'est la disponibilité du
> produit.** Un code qui n'arrive pas n'est pas une gêne : c'est une porte fermée, et il n'y en a
> pas d'autre.

**D18** (§6) a placé dans `leads.outbox_events` « les e-mails transactionnels de mise en relation »,
et la skill `lead-pipeline` a étendu la formule à « les e-mails transactionnels » en général. Cette
extension est **trop large** : `05` RG59 et `16` RG86 interdisent explicitement que le code de
connexion entre dans une file partagée avec les synchronisations de contacts. Il fallait donc dire
par où il passe, avant que l'implémentation du Lot 1 ne le décide par défaut — c'est-à-dire par la
solution la plus proche, la file existante.

### 18.2 Les deux questions posées

| # | Question |
|---|---|
| **a** | Par où passe un envoi `P0` : **(i)** appel synchrone dans la requête, **(ii)** file séparée dédiée avec son propre worker, **(iii)** même table `outbox_events` avec une priorité plus haute et un worker réservé ? |
| **b** | `leads.transactional_sends` est-il **un journal seul**, ou **aussi une file** ? |

### 18.3 Question (a) — options

| Option | Avantages | Inconvénients |
|---|---|---|
| **(i) Appel synchrone dans la requête**, depuis `apps/api`, sans file | Le délai est garanti **par construction** et non par un réglage : il n'y a ni interrogation périodique, ni file, ni ordonnancement à régler, donc rien qui puisse mal se régler. **L'issue est connue au moment où la personne est encore devant son écran**, ce qui est exactement ce que `05` RG60 et RG64 exigent : trois causes distinguées, saisie conservée, bouton pour réessayer. **Rien à préserver en cas d'échec** : l'e-mail n'est pas la conséquence d'une action métier, il *est* l'action (`16` RG87). Aucun composant nouveau | Met un appel externe **dans le chemin de la requête utilisateur** : impose un délai d'attente court, une seule tentative, et un comportement d'échec soigné. Consomme une connexion HTTP et une connexion base pendant la durée de l'appel |
| **(ii) File séparée dédiée** + worker distinct | Découplage complet : la requête ne dépend d'aucun service externe. Rejouable | **Le délai devient un réglage** : cadence d'interrogation + charge du worker + redéploiement en cours = quelques secondes qui deviennent parfois une minute, sans que rien ne soit « en panne ». **L'échec devient invisible au seul moment où la personne pouvait agir** : elle voit un succès, attend, et n'a aucune cause à lire. Découple pour préserver quelque chose qu'il n'y a pas à préserver (`16` RG87). Coûte une table, une boucle, un service ou une cadence de plus, un écran de supervision de plus |
| **(iii) Même table, priorité plus haute, worker réservé** | Un seul mécanisme, une seule supervision | **Rouvre exactement le risque que `05` RG59 ferme.** Une table partagée, ce sont des verrous partagés, des index partagés, une purge partagée, un interrupteur d'urgence partagé et un worker partagé : une requête lente sur la file de leads, un rejeu de masse lancé au backoffice, une migration d'index, et le code de connexion attend. La priorité **dans** une file ne protège que de la concurrence ordinaire, jamais de la panne du mécanisme lui-même. C'est la fausse sécurité la plus coûteuse : elle a l'air correcte dans le code |
| **(iv) Synchrone, puis repli en file si l'envoi échoue** | Semble prudent : « on ne perd rien » | **Écartée.** Elle produit un code qui part trois minutes plus tard, alors que la personne en a déjà demandé un autre : deux e-mails, un seul code valide (RG41), et la personne saisit le mauvais. On échange une panne lisible contre une confusion illisible. `05` RG60 et le test **T10** de la skill disent l'inverse : **pas de réessai automatique**, l'échec s'affiche et c'est la personne qui redemande |

#### Grille

| Critère (poids) | **(i) Synchrone** | (ii) File dédiée | (iii) File partagée | (iv) Repli |
|---|---|---|---|---|
| Respecte `05` RG59 / `16` RG86 (**éliminatoire**) | Oui | Oui | **Non** | Oui |
| Délai garanti par construction (fort) | **Oui** | Non (réglage) | Non | Oui |
| Cause de l'échec affichée à la personne (fort, `05` RG60) | **Oui** | Non | Non | Partiellement |
| Simplicité pour un développeur (fort) | **Élevée** (rien de nouveau) | Moyenne | Moyenne | Faible |
| Coût de sortie / réversibilité (fort) | **Élevée** (une fonction) | Moyenne | Faible | Faible |
| Sécurité — énumération, secrets (fort) | À traiter (§18.4) | À traiter aussi | À traiter aussi | Pire (deux envois) |
| Composants d'exploitation nouveaux (moyen) | **Aucun** | 1 table + 1 boucle + 1 écran | 0 | 1 + confusion |

### 18.4 Décision (a) : **(i) — appel synchrone dans la requête, avec cinq garde-fous**

La recommandation d'`expert-integrations-api` est suivie. Elle l'est pour la raison qu'elle donne —
le délai garanti par construction — et pour une seconde, qui me paraît plus forte encore :

> **Un `P0` n'a rien à découpler.** Le découplage sert à protéger une action métier déjà accomplie
> de la défaillance d'un tiers. Ici, il n'y a **aucune action métier accomplie** : la demande de
> code ne laisse derrière elle ni compte, ni contrat, ni preuve. Mettre en file un envoi dont
> l'échec n'a rien à sauver, c'est payer un mécanisme pour rendre invisible la seule information
> utile — que l'e-mail n'est pas parti.

Les cinq garde-fous **font partie de la décision** ; sans eux, elle est mauvaise.

| # | Garde-fou | Valeur |
|---|---|---|
| **G1** | **Délai d'attente court et borné sur chaque appel externe**, jamais infini | GoTrue **2 000 ms**, Brevo **3 000 ms**, budget total du gestionnaire **5 000 ms** |
| **G2** | **Une seule tentative, aucun réessai automatique** | `05` RG60, RG64 ; test T10 |
| **G3** | **Plancher de réponse constant**, appliqué à **toutes** les issues, succès comme échec comme plafond atteint | **1 000 ms** (RG46 : « la durée est normalisée par un plancher constant ») |
| **G4** | **Aucun appel externe pendant qu'une transaction est ouverte** | Règle 10 du §15, test T9. Deux transactions courtes encadrent les appels, jamais une seule qui les contient |
| **G5** | **Grappe de connexions élevée de `apps/api` plafonnée** (§18.7) | Une rafale de demandes de code ne doit pas épuiser le budget de connexions de la base au détriment du worker |

Les trois valeurs de G1 et G3 sont **lues en configuration**, avec ces valeurs par défaut, et
ajustables sans redéploiement.

### 18.5 L'énumération de comptes — le point que l'envoi synchrone oblige à trancher

`05` RG46 et `03` A-5 exigent une réponse **identique en contenu et en durée**, que l'adresse
corresponde ou non à un compte. Un appel externe dans la requête met cette garantie en tension : il
faut donc énoncer précisément **ce qui est garanti**, plutôt que de promettre une égalité stricte
qu'aucun système appelant un tiers ne peut tenir.

> **Invariant retenu, et il est testable :** *la réponse — contenu, code, en-têtes et durée — ne
> dépend d'aucune propriété du compte. Elle peut dépendre de l'adresse demandée, de l'adresse IP
> demandeuse et de l'état du fournisseur ; jamais de l'existence, du rôle, de l'état ni de
> l'historique d'un compte.*

C'est la bonne formulation, parce que la latence de Brevo est **la même variable aléatoire dans les
deux cas** : c'est du bruit commun, pas un signal. Une énumération exige une différence
**systématique**. Trois règles suppriment toutes les différences systématiques.

**R1 — Supprimer la branche, plutôt que la masquer.** Le gestionnaire exécute **exactement la même
suite d'appels** dans les deux cas. Concrètement : l'utilisateur GoTrue est créé
**inconditionnellement** (l'erreur « déjà existant » est avalée), *puis* le code est demandé. Deux
appels à chaque fois, pour tout le monde. Un `if (compte existe)` qui choisirait entre un et deux
appels réintroduirait une différence de durée **corrélée à ce que l'on protège**, et aucun plancher
ne la masquerait dans la queue de distribution. Le surcoût est d'un appel court par demande, à un
volume de quelques demandes par minute : il est nul en pratique.

> **Conséquence à assumer et à traiter :** toute adresse demandée crée un utilisateur GoTrue, même
> sans inscription ensuite. Deux parades, déjà disponibles : la limitation de débit à trois niveaux
> (`05` RG44) et une **purge périodique** des utilisateurs GoTrue sans ligne `identity.accounts` au
> bout de 24 h, à rattacher à l'opération élevée **E-4** (`maintenance.run_periodic`). À porter à
> `expert-database` et à soumettre à `expert-cybersecurite`.

**R2 — Plancher constant sur toutes les issues.** La réponse n'est jamais rendue avant
**1 000 ms** après réception, y compris quand le plafond de demandes est atteint (cause c), quand
le disjoncteur est ouvert, et quand la validation d'entrée échoue. Un chemin d'erreur rapide est un
oracle aussi sûr qu'un message différent.

**R3 — Trois issues, et trois seulement.** Les causes de `05` RG60 sont **toutes des propriétés de
l'adresse, du demandeur ou du fournisseur** :

| Issue | Ce qu'elle révèle | Verdict |
|---|---|---|
| **(a) Adresse non délivrable** — le fournisseur **refuse l'adresse au moment de l'appel** | Une propriété de l'adresse | Acceptable, **sous la réserve ci-dessous** |
| **(b) Service d'envoi indisponible** | Un état global, identique pour tout le monde | Acceptable |
| **(c) Plafond de demandes atteint** | Une propriété du demandeur (adresse sollicitée, IP) | Acceptable |

> **Réserve sur la cause (a), à faire valider par `expert-cybersecurite`.** Nous ne consultons
> **jamais** `identity.email_delivery_incidents` ni l'état `accounts.email_status` **avant**
> d'envoyer : un contrôle préalable transformerait un état interne en oracle. La cause (a) n'est
> affichée que sur un **refus du fournisseur portant sur l'adresse elle-même**. Il reste alors un
> oracle résiduel étroit : si Brevo a l'adresse sur sa propre liste de suppression parce qu'elle a
> rebondi chez nous, un attaquant apprend que cette adresse a déjà reçu un e-mail d'INFLUX. C'est
> très en deçà d'une énumération de comptes, ce n'est pas exploitable à l'échelle (20 demandes par
> heure et par IP, `05` RG44), et le rendre impossible coûterait d'afficher un message unique —
> précisément ce que `05` RG60 refuse. **Risque résiduel accepté, écrit ici pour qu'il soit refusé
> explicitement s'il ne l'est pas.**

**Corollaire d'exploitation, souvent oublié :** un échec de cause **(b)** ne doit **pas** consommer
le quota par adresse de `05` RG44. Sinon une panne de trois minutes chez Brevo verrouille pour
quinze minutes les personnes qui ont eu la mauvaise idée de réessayer — la panne survivrait à la
panne. Il consomme en revanche le quota par IP, qui est l'anti-abus. (Point soumis à
`expert-cybersecurite`.)

### 18.6 Panne du fournisseur : ce qui se passe, et ce que personne ne doit croire

| Question | Réponse |
|---|---|
| L'action échoue-t-elle ? | **Oui, et visiblement.** Il n'y a rien d'autre à préserver (`16` RG87). Jamais de faux succès (`05` RG64) |
| Est-ce distinguable selon le compte ? | **Non** : la panne est globale, la réponse est la même pour toutes les adresses |
| Que voit la personne ? | Le message de cause (b), sa **saisie conservée**, un bouton pour réessayer, et le canal de secours de `05` RG65 |
| Que voit l'exploitation ? | Une ligne `failed` dans `leads.transactional_sends`, les six indicateurs de `16` RG98 et l'alerte **AL48**, immédiate, vers `admin`. **Un `P0` lent ne se découvre pas par une réclamation** |
| Réessaie-t-on tout seul ? | **Non** (G2). Un **disjoncteur** simple évite seulement de tenir 3 000 ms pour rien : après **5 échecs de transport consécutifs**, les demandes reçoivent immédiatement la cause (b) pendant **30 secondes**, puis un appel de test rouvre le circuit. Le disjoncteur est **global** : son état ne dépend d'aucune adresse, il ne crée donc aucun oracle |
| Et si Brevo est durablement hors service ? | **Personne ne se connecte, et c'est une limite assumée du MVP** (`16` RG122 et Q8). Il n'y a **pas** d'expéditeur de secours au Lot 1. Si le fondateur veut supprimer ce point de défaillance unique, c'est un second prestataire d'envoi réservé au seul `P0` — **chiffrable, non retenu par défaut** |

### 18.7 Conséquence non évidente : **c'est `apps/api` qui envoie l'e-mail, pas Supabase Auth**

Le document `04` (§2) pose que « les codes d'authentification appartiennent à Supabase Auth ». Cela
reste vrai — **nous ne stockons ni le code, ni son empreinte**. Mais il faut distinguer deux choses
que la configuration par défaut confond : *qui produit le code* et *qui envoie l'e-mail*.

**Laisser GoTrue envoyer l'e-mail lui-même (SMTP configuré) est écarté**, pour quatre raisons
cumulatives :

1. **Aucune trace exploitable.** Pas d'`Idempotency-Key`, pas de `messageId` renvoyé, donc pas de
   ligne utilisable dans `leads.transactional_sends` — et donc aucune réponse à « je n'ai pas reçu
   mon code » autre qu'une supposition (`04` §5.8, `16` RG94).
2. **La phrase de correspondance anti-hameçonnage** de `05` RG48 et `03` A-6 doit être **la même à
   l'écran et dans l'e-mail**, tirée par nous à chaque demande. Un gabarit GoTrue ne la porte pas.
3. **L'échec ne serait pas connu du gestionnaire**, donc impossible à afficher : la décision (a)
   perdrait sa raison d'être.
4. **Le contenu de `05` RG49 et `16` RG100** (langue du destinataire, heure et contexte de la
   demande, mention « INFLUX ne vous demandera jamais ce code », **aucun lien**, version de gabarit
   journalisée) n'est pas tenable dans des gabarits que nous n'instrumentons pas.

**Le « Send Email Hook » de Supabase Auth est écarté pour une raison dirimante** : c'est GoTrue, un
service hébergé par Supabase, qui appellerait notre point d'accès. Il faudrait donc **exposer
publiquement `apps/api`**, ce que le §12 interdit. Une exception à la règle centrale de ce document
pour un gain nul : non.

**Chemin retenu**, sans ajouter le moindre composant :

```
apps/api  ──(1) admin: créer l'utilisateur, inconditionnellement (erreur « existe déjà » avalée)──►  GoTrue
apps/api  ──(2) admin: générer le lien → récupère le CODE À 6 CHIFFRES, sans qu'aucun e-mail parte ─►  GoTrue
apps/api  ──(3) envoi transactionnel unitaire, gabarit auth.login_code, Idempotency-Key ───────────►  Brevo
```

La vérification reste un appel GoTrue standard. **Le code ne transite que par la mémoire de
`apps/api` et par le corps de l'appel à Brevo** : il n'est écrit nulle part — ni en base, ni dans un
journal, ni dans une trace d'erreur, ni dans une réponse d'API (`05` RG52, `16` interdit 5).
**L'objet du gabarit ne contient jamais le code** (A-7).

Deux points à vérifier à l'implémentation plutôt qu'à supposer : que la génération d'un nouveau code
**invalide bien le précédent** côté GoTrue (`05` RG41, `03` A-1 — c'est la condition la plus souvent
oubliée), et que la **durée de validité** du projet Supabase est réglée à **10 minutes** (RG40). Ce
sont deux tests, pas deux hypothèses.

### 18.8 Décision (b) : `leads.transactional_sends` est **un journal, et rien d'autre**

La recommandation d'`expert-integrations-api` est suivie, pour la raison qu'il donne — une table à
double rôle finit avec deux vérités sur l'état d'une ligne — et pour une raison de conception :
**le seul mécanisme de file du projet est `outbox_events` (D18)**. Un second mécanisme de file, né
par glissement d'un journal, serait un mécanisme que personne n'a conçu, supervisé ni testé.

**Ce que la décision interdit, explicitement, pour que personne n'ait à le deviner :**

| Interdit sur `leads.transactional_sends` | Pourquoi |
|---|---|
| Tout `SELECT … FOR UPDATE`, `SKIP LOCKED`, verrou consultatif | Ce sont les gestes d'une file. Leur absence est ce qui rend la règle vérifiable en relisant le code |
| Tout index destiné à **prendre** du travail (typiquement sur `status`) | Un index de prise est une file qui s'ignore. Les deux index de `04` §5.8 sont des index de **lecture** (alerte AL48, support) |
| Toute boucle de worker qui **lit** cette table pour décider d'un envoi | Il n'existe **aucun consommateur** de cette table. Elle est écrite par qui envoie, lue par le backoffice |
| Tout réessai déclenché depuis cette table | G2, `05` RG60, test T10 |
| Tout bouton « rejouer » au backoffice sur une ligne `P0` | Rejouer, c'est renvoyer un code que personne n'attend plus. La personne redemande, elle seule |

**La sémantique de `status` pour une ligne `P0` doit être écrite dans le commentaire de la table**,
car elle diffère de celle d'une ligne de file :

| Valeur | Sens pour un `P0` |
|---|---|
| `queued` | **« Tentative engagée, issue inconnue »** — et non « en attente d'un traitement ». Une ligne `P0` restée `queued` plus de quelques minutes signale un **processus interrompu au milieu d'une requête** : c'est un **indicateur d'exploitation**, jamais un déclencheur de reprise |
| `sent` | Accepté par Brevo, `provider_message_id` renseigné |
| `failed` | Refusé, expiré ou disjoncteur ouvert ; `failure_code` renseigné dans la liste fermée |
| `delivered` | Écrit **plus tard**, par le webhook Brevo consommé par le worker. C'est la seule écriture asynchrone sur cette table, et elle ne porte que les colonnes d'accusé |

Cette dernière ligne mérite d'être soulignée : **le `P0` n'écrit rien dans `outbox_events`, mais le
retour de délivrance, lui, arrive par le chemin ordinaire** (webhook → worker → mise à jour de la
colonne d'accusé). Il n'y a là aucune contradiction : ce qui ne doit jamais attendre, c'est
l'**envoi**, pas la **confirmation** d'un envoi déjà parti.

### 18.9 La famine, et pourquoi elle est écartée par construction

`expert-integrations-api` relève à juste titre qu'une règle de priorité sans test de famine se
retourne un jour contre une obligation légale (test **T8** : une révocation prise en charge sous
5 minutes malgré les `P0`). Trois constats, dans cet ordre :

1. **Les deux chemins sont disjoints.** Après cette décision, un `P0` n'écrit dans
   `outbox_events` ni ligne, ni verrou, ni index : « `P0` passe devant les révocations » n'est même
   plus un ordonnancement, c'est **l'absence de file d'attente commune**. La question de l'ordre ne
   se pose plus.
2. **La seule ressource partagée est le budget de débit du fournisseur**, et Brevo sépare les
   catégories : transactionnel ≈ **1 000 requêtes/seconde**, contacts ≈ **10/seconde** (`16` §M2).
   Un compteur de débit **par catégorie, jamais global** (règle 12 de la skill) rend l'interférence
   impossible dans les deux sens. Au volume du pilote — quelques codes par minute — la marge est de
   plusieurs ordres de grandeur.
3. **Il reste une ressource partagée, et c'est la vraie** : les **connexions à la base**. Une rafale
   de demandes de code ouvre des transactions élevées dans `apps/api` (opération **E-1**) ; le
   worker, lui, est un **processus séparé avec sa propre grappe** (D2), mais tous deux tirent sur le
   même budget de connexions du projet Supabase. D'où le garde-fou **G5** : la grappe élevée de
   `apps/api` (`AUTH_DATABASE_URL`, rôle `influx_auth_login` depuis EC-20) est **plafonnée
   explicitement** (valeur de départ : **5 connexions**, à confirmer par
   `expert-database`), de sorte qu'aucune rafale de `P0` ne puisse assécher le worker. C'est ce
   plafond, et non la priorité, qui empêche la famine.

**T8 reste exigé malgré tout.** Un raisonnement qui conclut « la famine est impossible » se teste,
précisément parce qu'il conclut cela.

### 18.10 Contrat d'implémentation — `POST /v1/auth/request-code`

> **Destiné à qui implémente le Lot 1.** L'ordre des opérations n'est pas une suggestion : chaque
> inversion casse une règle nommée. À lire avec `05` §F et §G, qui restent la spécification.

| # | Étape | Détail |
|---|---|---|
| **1** | Démarrer le chronomètre du **plancher** (G3) | Dès la réception, avant toute validation |
| **2** | Valider (zod, `packages/contracts`) et **normaliser** l'adresse | Minuscules et espaces retirés. Aucune autre normalisation : retirer les points ou le sous-adressage fusionnerait des adresses distinctes |
| **3** | **Transaction n° 1**, élevée, opération **E-1** `identity.request_code` (rôle `influx_auth`) | a. contrôler **et incrémenter** les compteurs de débit par adresse et par IP (`05` RG44) ; b. **si plafond atteint** : valider la transaction et sortir en issue **(c)** — **aucun code n'est produit, aucune ligne de journal n'est écrite, le code en cours reste valide** (RG45, RG50) ; c. tirer la **phrase de correspondance** (RG48) et déterminer la **langue** ; d. résoudre l'éventuel `account_id` ; e. **insérer la ligne `leads.transactional_sends`** : `email_code = 'auth.login_code'`, `priority = 'p0'`, `status = 'queued'`, `locale`, `template_ref` + `template_version` **copiée**, `account_id` **xor** `recipient_email`, `outbox_event_id` **nul** ; f. **valider**. La clé d'idempotence est `auth.login_code:<id de la ligne>` |
| **4** | **Aucune transaction ouverte** à partir d'ici (G4) | C'est le point à ne pas rater : plus aucun verrou n'est tenu pendant les appels externes |
| **5** | GoTrue, appel 1 : **créer l'utilisateur, inconditionnellement** | L'erreur « existe déjà » est **avalée**. Inconditionnel = pas de branche = pas d'oracle temporel (R1) |
| **6** | GoTrue, appel 2 : **générer le code à 6 chiffres sans qu'aucun e-mail parte** | Délai d'attente cumulé des étapes 5-6 : **2 000 ms**. Le code reste **en mémoire**, jamais écrit |
| **7** | Brevo : **un envoi transactionnel unitaire**, gabarit `auth.login_code`, en-tête `Idempotency-Key` de l'étape 3 | **Une seule tentative**, délai d'attente **3 000 ms**. Un destinataire, jamais de copie (RG91). Contenu : RG49 (pas de code dans l'objet, aucun lien, heure et contexte, phrase de correspondance, mention « INFLUX ne vous demandera jamais ce code ») |
| **8** | **Transaction n° 2**, élevée, **E-1** | `status = 'sent'` + `provider_message_id` + `sent_at`, **ou** `status = 'failed'` + `failure_code` + `failed_at`. Aucune autre colonne n'est réécrite (table append-only pour le reste) |
| **9** | Poser le **cookie de parcours** (15 min, `__Host-`, `httpOnly`, `SameSite=Lax`) — **uniquement si l'issue est `sent`** | Il porte l'adresse normalisée et la phrase de correspondance (RG47, RG48). **Il ne porte jamais le code** |
| **10** | Rendre la réponse à `max(temps écoulé, 1 000 ms)` | Sur **toutes** les issues, y compris (c) et la validation en échec |

**Ce que contient la réponse HTTP — et ce qu'elle ne contient jamais.**

| | Contenu |
|---|---|
| **Statut** | **`200` dans tous les cas où la requête est bien formée**, y compris plafond atteint et panne du fournisseur. Exception explicite et bornée au tableau du §9.2 : faire varier le statut HTTP ferait varier le comportement des fronts et des intermédiaires selon l'issue, pour un gain nul. Une requête **mal formée** reste un `400`, et elle l'est indépendamment de tout compte |
| **Corps** | `outcome` dans une **union fermée** : `sent` · `undeliverable` · `provider_unavailable` · `rate_limited` (les trois causes de RG60, plus le succès) ; `retryAfterSeconds` (60, RG50) ; `matchingPhrase` **seulement si `sent`** |
| **Jamais** | Le code. Le `provider_message_id`. L'identifiant de la ligne de journal. L'existence du compte, son rôle, son état, la date de sa dernière connexion. Un message technique du fournisseur. Un délai différent selon le compte |

**Trois erreurs d'implémentation à écarter d'avance**, parce qu'elles sont naturelles :

1. **Envelopper les étapes 3 à 8 dans une seule transaction.** C'est la faute qui tient un verrou
   pendant 5 secondes d'appels externes (G4, test T9).
2. **Écrire une ligne dans `outbox_events` « pour la traçabilité ».** Le test **T1** échouerait, et
   il est écrit pour cela.
3. **Ajouter un réessai « juste au cas où »** à l'étape 7. Test **T10**.

### 18.11 Conséquences

- **Code :** un module `apps/api/src/domains/identity/login-code.ts` (le gestionnaire, le
  disjoncteur, le plancher), un connecteur d'envoi transactionnel unitaire déjà nécessaire par
  ailleurs, deux transactions élevées **E-1** déjà prévues par `03` §P7. **Aucun composant nouveau,
  aucune dépendance nouvelle, aucune table nouvelle.**
- **Déploiement :** inchangé. Toujours quatre services par environnement. Le worker ne connaît pas
  le `P0`.
- **Coûts :** nuls, hors volume d'envoi Brevo déjà prévu.
- **Sécurité :** le point sensible est traité au §18.5 (énumération) et au §18.7 (le code ne
  transite que par la mémoire). Le gain net est qu'un chemin critique **n'a aucune pièce mobile** :
  pas de file, pas d'ordonnancement, pas d'interrupteur d'urgence à contourner (`16` RG122 devient
  vrai **par construction**, puisque l'interrupteur agit sur une file que le `P0` n'emprunte pas).
- **Exploitation :** un incident d'envoi est visible **immédiatement**, par l'utilisateur et par
  AL48, au lieu d'être découvert par une réclamation.

### 18.12 Si l'on se trompe

Deux erreurs possibles, et leurs signaux :

| Erreur | Signal mesuré | Correction |
|---|---|---|
| **L'appel dans la requête est trop lent ou trop fragile** | Indicateur p90 de `16` RG98 durablement au-dessus de **180 s**, ou taux d'échec de transport significatif hors incident Brevo | Basculer sur l'option **(ii)** — file séparée dédiée. Le contrat HTTP ne change pas ; seul le corps du gestionnaire change, et l'écran perd l'affichage immédiat de la cause. **Une à deux journées**, parce que le journal existe déjà et qu'il suffit d'en faire lire les lignes `queued` par le worker |
| **Le plancher de 1 000 ms est jugé trop pénalisant** | Retour d'`expert-ux` sur la perception du parcours | C'est une valeur de configuration. La baisser est immédiat ; la supprimer demande l'avis d'`expert-cybersecurite`, car elle porte une partie de la garantie RG46 |

### 18.13 Réversibilité

**Élevée, dans les deux sens.** L'envoi `P0` est une fonction appelée à un seul endroit ; la file
dédiée qu'on lui substituerait lirait le journal qui existe déjà. Le choix (b) — journal seul — est
ce qui rend ce retour en arrière peu coûteux : **une table qui n'est pas déjà une mauvaise file peut
en devenir une bonne.**

### 18.14 Ce que cet addendum demande aux autres agents

**À `expert-database` (document `04`), cinq points — cet addendum ne modifie pas `04` :**

| # | Point |
|---|---|
| 1 | **Commenter la sémantique de `status` pour un `P0`** (§18.8) : `queued` = « tentative engagée, issue inconnue », **jamais** un travail à prendre. Et inscrire dans le commentaire de la table qu'elle **n'est pas une file** |
| 2 | **Droits** : `leads.transactional_sends` n'apparaît pas dans la matrice du §6 de `04`. Il y faut `INSERT` + `UPDATE` **restreint aux colonnes d'issue** pour `influx_auth` (E-1) et `influx_worker` (accusés de réception), lecture pour `agent` et `admin`, **rien pour les rôles membres** |
| 3 | **Liste fermée des `failure_code` d'un `P0`**, en correspondance exacte avec les trois causes de `05` RG60, pour que l'écran et le backoffice disent la même chose |
| 4 | **Aucun index sur `status`** pour cette table, et la raison écrite en commentaire (§18.8) |
| 5 | **Purge des utilisateurs GoTrue sans ligne `identity.accounts` après 24 h**, rattachée à **E-4** (`maintenance.run_periodic`) — conséquence directe de la règle R1 (§18.5) |

**À `expert-cybersecurite` (avis attendu, veto) :** l'invariant de non-énumération reformulé
(§18.5), l'**oracle résiduel** de la cause (a), la règle « un échec de cause (b) ne consomme pas le
quota par adresse », la création inconditionnelle d'un utilisateur GoTrue et sa purge, le plancher
de 1 000 ms, et le `200` uniforme du §18.10.

**Au fondateur :** **`16` Q8** — au MVP, une panne durable de Brevo empêche **toute connexion de
membre**. Limite assumée, sans expéditeur de secours. C'est une décision de risque, pas une
décision technique.

**À `testeur` (document `18`) :** les tests **T1 à T10** de la skill `lead-pipeline` restent
exigés ; **T3 et T4 deviennent structurels** (le `P0` n'emprunte ni la file ni l'interrupteur, donc
le test vérifie l'absence de chemin, pas un délai). S'y ajoutent, propres à D43 : temps de réponse
indiscernable entre adresse connue et inconnue **sur la distribution, pas sur une mesure** ; aucun
appel externe sous transaction ouverte ; ligne de journal écrite **avant** l'appel ; code absent de
tout journal, trace, réponse et cookie ; nouveau code invalidant le précédent côté GoTrue ; plafond
atteint n'invalidant pas le code en cours ; échec de cause (b) ne consommant pas le quota par
adresse ; disjoncteur ouvert rendant une réponse **toujours plancher-normalisée**.

### Sources (vérifiées le 2026-09-19)

- [Supabase Auth — `generateLink` (admin) : renvoie `email_otp` et **n'envoie aucun e-mail**](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)
- [Supabase Auth — `verifyOtp`](https://supabase.com/docs/reference/javascript/auth-verifyotp)
- [Supabase Auth — Send Email Hook (écarté : exige un point d'accès joignable depuis Supabase)](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)
- [Brevo — API d'envoi transactionnel](https://developers.brevo.com/reference/sendtransacemail)
- `docs/mvp/16-backoffice-emails-brevo.md` §M2 (limites de débit, relevées le 2026-09-19)

---

## 19. Addendum du 2026-09-24 — D57 : sauvegarde et restauration

> **Arbitrage du fondateur du 2026-09-24 : la perte de données acceptable est de quelques minutes.**
> Cet addendum fixe le cadre ; `architecte` le détaille au Lot 0, avec `expert-database` et
> `expert-conformite-rgpd`.

1. **Restauration à un instant donné** (option de Supabase) activée **avant la première mise en
   production** ; la sauvegarde quotidienne seule ne suffit pas. Son coût est à chiffrer et à
   soumettre au fondateur au Lot 0.
2. **Pourquoi c'est un besoin produit, pas un confort** : perdre une journée, c'est perdre des
   acceptations de mise en relation, des messages et des saisies d'affaires — donc des preuves
   d'intermédiation (`01` M2, M4) et des montants que rien ne permet de reconstituer.
3. **Test de restauration régulier**, pas seulement au Lot 6 (`18`, limite n° 12) : fréquence fixée
   au Lot 0, chaque test chronométré et consigné.
4. **Restauration et purges RGPD.** Une restauration fait réapparaître des données purgées ou
   anonymisées depuis l'instant restauré : la procédure doit **rejouer les purges et les
   anonymisations** postérieures avant toute remise en service (`04` §9.3).
5. **Registre chaîné.** Après restauration, la vérification de la chaîne (`04` `chain_checks`) est
   exécutée avant réouverture ; l'empreinte de tête mensuelle transmise au fondateur (`04` §12.5
   point 3) sert de point de contrôle.
6. **Environnements.** `staging` n'est jamais alimenté par une restauration de production (`18` B9).

---

## 20. Addendum du 2026-09-24 — D60 : surveillance de production, entièrement interne

> **Demande du fondateur (2026-09-24).** « Pour la production, il faut des journaux, surtout au
> début, pour voir les bugs éventuels. Je veux aussi savoir s'il y a un ralentissement du site (pic
> d'appels). »
>
> **Arbitrage du fondateur (2026-09-24) : tout en interne.** Aucun outil de surveillance externe,
> ni service de suivi d'erreurs, ni sonde de disponibilité tierce. Les erreurs, les temps de réponse
> et la disponibilité sont collectés par nos propres services, stockés dans notre base et consultés
> au backoffice. Une première version de cet addendum recommandait un outil hébergé dans l'UE
> (Sentry) et une sonde externe : elle est écartée (§20.3). **Le risque qui en résulte est accepté
> en connaissance de cause** (§20.9).
>
> Restent soumis à `expert-cybersecurite` (rôle d'écriture, route de collecte, accès à l'écran) et à
> `expert-conformite-rgpd` (**veto** : contenu et conservation, §20.8). Cet addendum ne concerne que
> le **produit réel** : la maquette jetable (D44) n'est pas instrumentée.

### 20.1 Le besoin, en deux questions

La surveillance doit permettre de répondre, à tout moment et sans lire de code :

1. **« Un utilisateur vient-il de rencontrer un bug ? »** — et le savoir **avant qu'il nous
   l'écrive**. Pendant les premières semaines, la plupart des utilisateurs ne signalent rien : ils
   abandonnent.
2. **« Le site ralentit-il, et est-ce à cause d'un pic d'appels ? »** — distinguer un pic absorbé
   (bonne nouvelle), un pic qui ralentit le site (il faut plus de ressources) et un ralentissement
   sans pic (un défaut à corriger).

### 20.2 Ce qui existe déjà, et ce qui manque

| Déjà décidé | Où |
|---|---|
| Journaux `pino` structurés en JSON, un identifiant de requête propagé partout | §4, règle 3 |
| Surveillance du worker : âge de la file, échecs, battement de cœur, chaîne du registre | §11.3 |
| Délivrabilité du code de connexion (alerte AL48) | `15` RG126, `16` RG98 |
| Temps des requêtes en base (`pg_stat_statements`, p95) | `04` §7.3 |
| Journaux Railway conservés **7 jours** (offre Hobby) ou **30 jours** (offre Pro) ; métriques (processeur, mémoire, réseau) conservées 30 jours | Railway |

| Ce qui manque | Conséquence |
|---|---|
| **Personne n'est prévenu d'une erreur.** Les journaux se consultent, ils n'alertent pas | Une erreur noyée dans des milliers de lignes n'est vue par personne |
| **Les erreurs du navigateur sont invisibles.** Un écran qui plante chez l'utilisateur ne laisse aucune trace côté serveur | Les bugs d'interface, les plus fréquents au lancement, passent inaperçus |
| **Aucun temps de réponse par route, aucun seuil** | Un ralentissement se découvre par une plainte |
| **Aucune vérification que le site répond** | Une panne se découvre par une plainte |
| **Aucun lien entre une erreur et la mise en production qui l'a introduite** | On ne sait pas quelle version annuler |
| **Aucun volume de requêtes suivi** (le test de charge est exclu à juste titre, `18` limite n° 7) | Un pic d'appels passe inaperçu |

### 20.3 Options

| | **A — Railway seul** | **B — Tout en interne** | **C — Outil externe (Sentry UE) + sonde externe** | **D — OpenTelemetry vers une plateforme** |
|---|---|---|---|---|
| Prévient d'un bug | Non | **Oui**, par e-mail et au backoffice | Oui, le plus confortable | Oui, à construire |
| Erreurs du navigateur | Non | **Oui**, piles peu lisibles au départ (code compressé) | Oui, lisibles | Partiellement |
| Temps de réponse et pics | Non | **Oui** | Oui | Oui, le plus riche |
| Site **entièrement** hors service | Non | **Non si Railway tombe en entier** (§20.9) | Oui | Selon la plateforme |
| Nouveau prestataire | Aucun | **Aucun** | Un sous-traitant de plus | Un de plus |
| Effort | Nul | **1 à 1,5 semaine** (§20.10) | Faible | Élevé |
| Issue | Insuffisant | **Retenue par le fondateur** | Première recommandation, **écartée** | Surdimensionné |

**Pourquoi B tient au volume du pilote** : quelques centaines d'événements par jour, une équipe de
deux ou trois personnes. On y gagne : aucune donnée ne sort d'INFLUX, aucun contrat de sous-traitance,
rien à ajouter à la politique de confidentialité, aucun abonnement. On y perd : du développement, un
confort moindre, et l'angle mort du §20.9.

### 20.4 Décision : six pièces, toutes internes

| Pièce | Qui la produit | Question à laquelle elle répond |
|---|---|---|
| **1. Journaux** | `pino` → journaux Railway (déjà décidé, §4) | « Que s'est-il passé exactement pour la requête X ? » |
| **2. Erreurs serveur** | `api` et `worker` enregistrent chaque erreur, regroupée par type | « Quel bug, combien de fois, depuis quelle version ? » |
| **3. Erreurs du navigateur** | Espaces membres et backoffice renvoient leurs erreurs à l'API | « L'écran a-t-il planté chez quelqu'un ? » |
| **4. Temps de réponse et volume d'appels** | L'API agrège chaque minute, route par route | « Le site ralentit-il, et est-ce un pic ? » |
| **5. Sonde interne** | Le worker vérifie le site chaque minute ; l'API surveille le worker | « Le site répond-il ? » |
| **6. Alertes et écran « Santé technique »** | Catalogue d'alertes du backoffice (`15` §F), e-mail, écran dédié | « Qui est prévenu, et où regarder ? » |

Tout est stocké dans un **schéma `ops`** (un schéma par domaine, D5), modélisé par
`expert-database`.

### 20.5 Comment chaque pièce fonctionne

#### Erreurs serveur

- **Capture** : gestionnaire d'erreurs Fastify, erreurs non rattrapées des processus `api` et
  `worker`, échecs de tâche du worker.
- **Regroupement par empreinte** : type d'erreur + message normalisé (identifiants et nombres
  retirés) + modèle de route + premières lignes de la pile **qui appartiennent à notre code**. Même
  empreinte, même groupe.
- **Un groupe** porte sa première et sa dernière apparition, son nombre d'occurrences, la version où
  il est apparu et un état : `new`, `acknowledged`, `fixed`, `ignored`. Un groupe `fixed` qui
  réapparaît devient une **régression** et déclenche une alerte.
- **Une occurrence** porte la date, le service, la version, le modèle de route, l'identifiant de
  requête (qui mène aux journaux Railway), l'identifiant de compte s'il y en a un, et la pile
  nettoyée (§20.8).
- **L'enregistrement ne doit jamais aggraver la panne.** Il se fait hors de la transaction en échec,
  sur une connexion à part ; si la base est injoignable, l'erreur ne va que dans les journaux ; un
  **plafond par empreinte** (10 occurrences conservées par minute, les suivantes seulement comptées)
  empêche une avalanche d'erreurs de saturer la base.

#### Erreurs du navigateur

- **Où** : espaces membres et backoffice, **sessions connectées uniquement**. Sont capturées les
  erreurs non rattrapées, les promesses rejetées et les erreurs d'affichage React. Elles partent vers
  `POST /v1/ops/client-errors`, par le passe-plat.
- **Cette route est une porte d'entrée, elle se traite comme telle** : session requise, schéma
  strict issu de `packages/contracts`, taille plafonnée, limitation de débit par compte et par IP,
  nettoyage côté serveur.
- **Landing exclue** : aucun script de collecte sur les pages publiques. Elles sont pré-rendues, peu
  sujettes aux bugs, et un script de plus relancerait la question du consentement
  (`docs/landing-page/11-consentement-cookies.md`). La sonde les couvre.
- **Lisibilité** : le code livré au navigateur est compressé, les piles sont donc peu lisibles. Au
  départ, la page, la version, le navigateur et le message suffisent le plus souvent à reproduire.
  La traduction des piles (cartes de source conservées en privé, jamais servies) n'est ajoutée **que
  si le besoin se confirme pendant le rodage**, sur décision de `dev-react-node`.
- **Rien ne quitte INFLUX**, aucun cookie ni stockage local n'est utilisé : l'exemption de
  consentement est bien plus simple à établir qu'avec un tiers, mais reste **à confirmer par
  `expert-conformite-rgpd`**.

#### Temps de réponse et volume d'appels

- **Mesure** : à la fin de chaque requête, l'API note le modèle de route, la classe de statut et la
  durée dans un agrégateur en mémoire.
- **Chaque minute**, une ligne par (minute, service, instance, route) : nombre d'appels, nombre de
  réponses `5xx` et `429`, et un **histogramme des durées en tranches fixes** (≤ 25 ms, 50, 100,
  250, 500 ms, 1 s, 2,5 s, 5 s, au-delà).
- **Pourquoi un histogramme plutôt qu'un p95 par instance** : deux p95 ne s'additionnent pas, deux
  histogrammes si. Le p95 se calcule à la lecture, toutes instances confondues, ce qui reste juste le
  jour où l'on ajoute une instance pour absorber un pic.
- **Santé de chaque processus**, chaque minute : **retard de la boucle d'événements** (le signal de
  lenteur le plus direct d'un service Node), mémoire, processeur.
- **Base** : nombre de connexions ouvertes, relevé chaque minute par le worker ;
  `pg_stat_statements` inchangé (`04` §7.3).
- **Conservation** : lignes à la minute **14 jours**, puis agrégées à l'heure et gardées **13 mois**,
  pour comparer un pic au même créneau des semaines précédentes et d'une année sur l'autre.
- **Pages de `web` et `backoffice`** : leur temps de réponse est mesuré par la sonde. Toute la
  logique étant dans l'API (§2), c'est elle qui ralentit en premier, et elle est mesurée route par
  route.

#### Sonde interne et surveillance croisée

- **Le worker, chaque minute**, appelle les pages d'accueil FR et EN **par leur adresse publique**
  (le trajet passe par internet, le DNS, le certificat et l'entrée de Railway), la page de connexion
  du backoffice et le `/health` de l'API sur le réseau privé. Il enregistre le résultat et la durée.
- **L'API surveille le worker** : aucun battement de cœur depuis 60 s (§11.3) déclenche une alerte.
  Une seule instance de l'API fait cette vérification, sous verrou consultatif.
- **Aucun service ne se surveille lui-même** : le worker surveille le site et l'API, l'API surveille
  le worker.

#### Alertes

- Les alertes techniques **entrent au catalogue unique des alertes du backoffice** (`15` §F), avec
  des numéros attribués par `product-owner`. Pas de liste parallèle.
- **Envoi par e-mail** aux destinataires (§20.11), par le flux transactionnel Brevo.
- **Déduplication** : une même alerte part au plus une fois toutes les 30 minutes tant que la
  condition dure, et un e-mail « rétabli » signale la fin de l'incident.
- **Les alertes de disponibilité (site, base, worker) partent directement vers Brevo, jamais par la
  file `outbox_events`**, qui vit dans la base et que le worker vide : une alerte « base
  injoignable » ou « worker arrêté » ne peut pas dépendre de ce qui est en panne. L'alerte « worker
  arrêté » est donc envoyée par l'API, qui appelle déjà Brevo pour le code de connexion (D43).
- **Seuils et destinataires sont en base**, modifiables par un administrateur, pas dans le code. Seule
  exception : les destinataires des alertes de disponibilité sont **aussi** dans une variable
  d'environnement, car une base injoignable ne peut pas les fournir.
- En `staging`, les alertes ne partent que vers la liste blanche (§12.4).

#### Écran « Santé technique » (backoffice)

- **Contenu** : disponibilité mesurée par la sonde ; groupes d'erreurs (nouveaux, ouverts,
  régressions) et leurs occurrences ; courbes d'appels par minute, de p95 et de taux d'erreurs, par
  route ; santé des services ; connexions à la base ; état du worker (§11.3).
- **Accès** : administrateurs uniquement, à confirmer par `expert-cybersecurite` (§20.12).
- Le lien « état des services » du backoffice (`15` §C, file bloquée) y mène.
- **Poste de travail uniquement** : il n'entre pas dans la vue mobile limitée (D58). Sur téléphone,
  l'e-mail d'alerte suffit.

### 20.6 Signaux et seuils d'alerte

Valeurs **de départ**, recalibrées après deux semaines de mesures réelles : une performance se
mesure, elle ne se suppose pas.

| Signal | Seuil de départ | Qui, quand *(proposition, §20.11)* |
|---|---|---|
| **Site injoignable** (sonde interne : pages d'accueil FR et EN, connexion du backoffice, `/health` de l'API) | 2 échecs consécutifs (≈ 2 min) | Fondateur + développeur, **immédiatement, 24 h/24** |
| **Worker arrêté** | Aucun battement depuis 60 s | Développeur, immédiatement |
| **Configuration de synchronisation manquante** (*ajouté le 2026-10-17, D67, tranchée*) : ligne en échec `list_not_configured`, `template_not_configured`, `apollo_settings_invalid` ou `credentials_missing`. Un refus de démarrage pour réglage manquant (§12.5) se voit, lui, par « Worker arrêté » et par la ligne `fatal` du journal, qui nomme le réglage | **1re occurrence** | Développeur + `admin`, immédiatement (AL25, `05` RG160) |
| **Nouvelle erreur, jamais vue**, ou **régression** | Dès la 1re occurrence **pendant le rodage** (§20.7) ; ensuite, récapitulatif quotidien (les régressions restent immédiates) | Développeur |
| **Taux d'erreurs serveur** (réponses `5xx`) | > 1 % des requêtes sur 5 min | Développeur + fondateur, immédiatement |
| **Lenteur de l'API** | p95 > 1 s sur 10 min, **hors** `POST /v1/auth/request-code`, qui a un plancher de 1 s par construction (D43, §18.4) et reçoit son propre seuil au Lot 0 | Développeur |
| **Lenteur des pages** (mesurée par la sonde) | > 2 s sur 3 relevés consécutifs | Développeur |
| **Pic d'appels** | Appels par minute > 3 × le volume habituel du même créneau (seuil fixe tant qu'il n'y a pas d'historique) | **Alerte d'information**, pas d'incident : le fondateur la reçoit pour la rapprocher de son origine |
| **Réponses `429`** (limitation de débit) en hausse | Seuil fixé au Lot 0 avec `expert-cybersecurite` | Signe d'abus plutôt que de succès (`03` A-3) |
| **Service saturé** | Retard de la boucle d'événements > 200 ms sur 5 min, ou mémoire > 85 % de la limite du service | Développeur |
| **Base saturée** | Connexions > 80 % de la grappe, ou p95 d'une requête fréquente qui double | Développeur (`04` §7.3) |
| Chaîne du registre, code de connexion | **Inchangés** | §11.3, AL48 |

**Comment lire un ralentissement** — la réponse à « est-ce un pic d'appels ? » :

| Appels par minute | Temps de réponse | Lecture | Réaction |
|---|---|---|---|
| En hausse | Normal | **Pic absorbé** | Rien ; noter son origine |
| En hausse | Dégradé | **Le pic ralentit le site** | Augmenter les ressources Railway du service en cause, vérifier la base |
| Normal | Dégradé | **Défaut interne** : requête lente, base, fournisseur externe (Brevo) | L'écran « Santé technique » désigne la route, `pg_stat_statements` la requête |
| Chute brutale | — | Site injoignable ou panne en amont | Sonde interne, état de Railway et de Supabase |

**Le premier suspect d'un pic est INFLUX lui-même** : un envoi de masse Brevo depuis le backoffice
(`16`) ou une campagne marketing ramène des milliers de visiteurs en quelques minutes. L'heure des
envois, déjà journalisée (`16`), est à rapprocher de l'heure du pic. Les pages publiques étant
pré-rendues (D1), un pic sur la landing charge peu l'API ; c'est l'inscription (envoi synchrone du
code, D43) qui le ressent en premier.

### 20.7 La période de rodage — « surtout au début »

Pendant **30 jours après chaque mise en ligne** (Lot 1 d'abord, puis chaque lot), et après toute
mise en production jugée risquée, la surveillance est renforcée :

1. **Toute nouvelle erreur alerte immédiatement**, pas seulement les dépassements de seuil.
2. **Le plafond d'occurrences conservées par empreinte est relevé**, pour garder davantage
   d'exemples de chaque bug.
3. **Revue quotidienne des erreurs** par le développeur (10 à 15 minutes), chaque groupe classé :
   corrigé, planifié ou sans effet.
4. **Bilan hebdomadaire au fondateur**, en une page : erreurs nouvelles et corrigées, temps de
   réponse, pics constatés et leur origine, disponibilité mesurée par la sonde.
5. **Chaque version est étiquetée** par son commit (`RAILWAY_GIT_COMMIT_SHA`) : une erreur apparue
   avec une version se voit immédiatement, et la procédure de retour à la version précédente sur
   Railway est écrite **avant** la mise en ligne.
6. **Plus de contexte, pas plus de bavardage** : les journaux restent au niveau `info`. Le niveau
   `debug` n'est **jamais** activé en production, car c'est lui qui laisse fuir des données
   personnelles. On enrichit les champs structurés (route, domaine, identifiant de compte, durée,
   version), pas le volume.

La période est prolongée tant qu'une erreur bloquante reste ouverte.

### 20.8 Ce qui n'entre jamais dans un journal ni dans le schéma `ops`

Un journal technique est un traitement de données personnelles. Ces règles complètent §4 règle 3 et
`03` R-2 :

| Jamais | Pourquoi |
|---|---|
| Code de connexion, jetons, cookies, en-tête `Authorization` | Prise de compte |
| **Corps des requêtes et des réponses** | Ils contiennent tout le reste |
| Texte des messages, apartés, notes internes, motifs libres | Confidentialité des échanges (D47) |
| Adresse e-mail, téléphone, nom, pseudos, liens de réseaux | L'identifiant de compte (UUID) suffit à enquêter ; les pseudos sont au cœur de l'anonymisation (A2) |
| **Enregistrement de session / relecture d'écran** | Il filmerait des identités révélées et des conversations. **Interdit**, sur toutes les surfaces |
| URL complète avec paramètres | On enregistre le **modèle de route** (`/v1/creators/:id`), pas l'URL réelle |
| Adresse IP dans le schéma `ops` | Elle reste dans les journaux Railway, à rétention courte (`03` R-2) |

Mécanismes :

- **Une fonction de nettoyage unique**, dans le domaine `ops` de l'API, appliquée à toute erreur
  avant enregistrement — y compris celles qui viennent du navigateur, nettoyées côté serveur. Les
  journaux `pino` masquent les mêmes champs par configuration.
- **Un test automatisé** injecte une fausse adresse, un faux code et un faux jeton dans une erreur,
  et vérifie qu'aucun n'atteint le journal ni la table.
- **Conservation** : occurrences **30 jours** ; métriques sans donnée personnelle, gardées plus
  longtemps (§20.5). À valider par `expert-conformite-rgpd` au regard de `03` R-2.
- `staging` est instrumenté de la même façon, alertes limitées à la liste blanche.

### 20.9 Ce que la décision ne couvre pas — risque accepté par le fondateur

| Situation | Ce qui se passe | Parade sans outil externe |
|---|---|---|
| **Panne complète de Railway** | Le site, la sonde et les alertes tombent ensemble : **INFLUX ne prévient personne**. On l'apprend par un utilisateur ou par Railway | S'abonner aux **notifications par e-mail des pages d'état** de Railway, Supabase et Brevo. Ce n'est pas un outil de surveillance : ce sont nos prestataires actuels qui annoncent leurs propres pannes |
| **Base injoignable** | Les erreurs ne sont plus enregistrées (journaux Railway seulement) et l'écran est vide | Le worker le détecte (le `/health` de l'API vérifie la base) et alerte directement par Brevo, avec les destinataires lus dans la variable d'environnement (§20.5) |
| **Brevo en panne** | Aucun e-mail d'alerte ne part | Les alertes restent visibles au backoffice. Et comme les membres ne reçoivent plus leur code de connexion (D43), la panne ne passe pas inaperçue |

**Revenir sur la décision ne coûte presque rien** : la route de santé publique de `apps/web` (§20.10)
reste en place. Ajouter plus tard une sonde externe revient à la faire appeler cette route, sans une
ligne de code.

### 20.10 Conséquences

- **Code.** Un domaine **`ops`** dans `apps/api` (greffon, service, dépôt, comme les autres
  domaines, §4 règle 2) : collecte, nettoyage, agrégation, sonde, alertes. Dans `apps/web` et
  `apps/backoffice`, un petit module `src/observability/` : le collecteur d'erreurs du navigateur, et
  rien d'autre.
- **Données.** Schéma `ops` : groupes d'erreurs, occurrences, métriques à la minute et à l'heure,
  relevés de la sonde, réglages (seuils, destinataires). L'API écrit ces tables **hors de la
  transaction de l'utilisateur** : cela demande un rôle Postgres dédié, par exemple `influx_ops`,
  **en écriture seule sur `ops`, sans lecture des données métier et sans `BYPASSRLS`**, donc une
  opération de plus dans la liste fermée de `03` §P7. *Précisé le 2026-09-26 (`21` EC-1, EC-20) :*
  `influx_ops`, joint par le rôle de connexion `influx_ops_login` et la variable
  `OPS_DATABASE_URL` (service `api`, J4) ; entrée E-6 à signer par `expert-cybersecurite` avec sa
  migration.
- **Routes de santé.** `apps/api` expose `/health` sur le réseau privé, vérification de la base
  comprise. `apps/web` expose une route de santé publique qui ne répond que `200` ou `503`, **sans
  aucun détail**.
- **Variables d'environnement** (skill `env-secrets`, §12.3) : **aucun nouveau secret** —
  *sauf, depuis le 2026-09-26 (EC-20), `OPS_DATABASE_URL`, chaîne de connexion du rôle
  `influx_ops_login` (`api`, J4)*. Une variable non secrète pour les destinataires de secours des
  alertes de disponibilité (`api`, `worker`). La
  version vient de `RAILWAY_GIT_COMMIT_SHA`, l'environnement de `INFLUX_ENV`.
- **Charge.** Une écriture par minute et par route active, plus des erreurs plafonnées : négligeable
  pour la base.
- **Coûts.** Aucun abonnement. Environ **3 à 5 jours au Lot 0** (collecte, tables, sonde, alertes
  par e-mail) et **2 à 3 jours au Lot 1** (écran « Santé technique »), puis l'entretien. L'offre
  Railway Pro devient moins nécessaire, puisque les erreurs sont gardées 30 jours dans notre base ;
  elle reste utile pour garder 30 jours de journaux bruts pendant le rodage (§20.11).
- **Calendrier.** Collecte au **Lot 0**, avant la première ligne de code métier, là où elle coûte le
  moins ; alertes, sonde et écran **actifs avant la mise en ligne du Lot 1**.

### 20.11 Points à faire valider par le fondateur

| # | Point | Statut |
|---|---|---|
| 1 | Outil de surveillance externe ou solution interne | **Tranché le 2026-09-24 : tout en interne**, risque du §20.9 accepté |
| 2 | **Qui reçoit les alertes, et la nuit ou le week-end ?** Proposition : « site injoignable » prévient le fondateur et le développeur 24 h/24 ; le reste attend les heures ouvrées | Ouvert. C'est une astreinte : une question d'organisation, pas de technique |
| 3 | **Offre Railway Pro en production** (30 jours de journaux bruts au lieu de 7) | Ouvert. Coût mensuel, moins nécessaire qu'avec un outil externe |
| 4 | **Rodage de 30 jours après chaque mise en ligne**, avec un bilan hebdomadaire d'une page | Ouvert. Mobilise le développeur un quart d'heure par jour |

### 20.12 Ce que cet addendum demande aux autres agents

| Agent | Demande |
|---|---|
| `expert-database` | Modéliser le schéma `ops`, ses purges (14 jours, 13 mois, 30 jours) et le rôle d'écriture seule |
| `expert-cybersecurite` | Valider le rôle `influx_ops` et son entrée dans la liste fermée de `03` §P7 ; la route de collecte du navigateur (abus, taille, débit) ; la route de santé publique ; l'accès à l'écran (administrateurs seulement, ou rôle technique en lecture seule sur `ops`) ; le seuil d'alerte des `429` |
| `expert-conformite-rgpd` (**veto**) | Contenu du §20.8, durées de conservation, exemption de consentement du collecteur du navigateur, mention du traitement dans la politique de confidentialité |
| `product-owner` | Ajouter les alertes techniques au catalogue de `15` §F et spécifier l'écran « Santé technique » en additif de `15` |
| `expert-ux` | Concevoir l'écran « Santé technique » (additif de `17b`, skill `backoffice-ops`) |
| `integrateur` | **Procédure écrite de retour à la version précédente**, abonnement aux pages d'état de Railway, Supabase et Brevo, choix de l'offre Railway |
| `testeur` | Ajouter au plan `18` : nettoyage (§20.8) ; avalanche d'erreurs qui ne sature pas la base ; agrégation des histogrammes entre instances ; arrêt du worker ⇒ alerte envoyée par l'API ; alerte de disponibilité émise sans la base. Décider si une mesure de plafond légère sur `staging` précède le premier envoi de masse, sans revenir sur la limite n° 7 |
| `dev-react-node` | Domaine `ops` et collecteur du navigateur ; modèle de route et version dans chaque ligne de journal ; aucune donnée du §20.8 |

### Sources (vérifiées le 2026-09-24)

- [Railway — Logs (conservation selon l'offre)](https://docs.railway.com/observability/logs)
- [Railway — Observability Dashboard (métriques conservées 30 jours)](https://docs.railway.com/observability)

---

## 21. Addendum du 2026-10-28 — D73 : charte KEO, mécanique technique (tokens, polices, gabarits)

> **Décision du fondateur (D73, consignée par `chef-de-projet`, fiche `docs/mvp/jalons/ds-fiche.md`).**
> La charte « KEO Emerald » (`design-proposals/keo-emerald.css`) habille les espaces membres marque
> et créateur et le backoffice, en responsive, avec une colonne de navigation à gauche sur poste de
> travail. La vitrine garde sa direction (D6, D59).
>
> **Ce que cet addendum tranche :** la mécanique — coexistence de deux chartes dans `apps/web`,
> polices, gabarits de page, gardes. **Ce qu'il ne tranche pas :** la correspondance KEO → tokens
> nommés par rôle et l'anatomie des gabarits (`expert-ux`), la présence des entrées de navigation des
> Lots 2 à 5 avant leur lot (`product-owner`). Il **amende** `17` §2.2 (un seul `<nav>`, rendu une fois
> et restylé, §21.5) ; report à faire par `expert-ux`.

### 21.1 Vocabulaire

- **Charte** : palette, familles de polices, rayons. Deux chartes : **vitrine** (D6, D59) et **KEO** (D73).
- **Registre** (`20` §2) : densité et usage — vitrine, espaces membres, backoffice. Espaces membres et
  backoffice sont **deux registres qui partagent une charte** : partager la palette n'autorise pas à
  partager un composant (`20` §2 ; `size-bo-control` reste interdit dans `apps/web`, `17b` §6.1).

### 21.2 Frontière

| Surface | Charte | Raison |
|---|---|---|
| Landing, pages légales publiques (`cgu`, `confidentialite`, `cookies` et équivalents EN), `not-found`, `error` et `[...rest]` de niveau `[locale]`, `global-error` | Vitrine | D59 ; pages publiques, atteintes sans compte |
| Parcours d'inscription et de connexion (`connexion`, `inscription/**`, `sign-in`, `signup/**`) | **KEO** | `17` §3 le range dans les espaces membres ; il partage ses classes avec « Mon compte » (`auth-classes.ts`) ; les polices se chargent dès la première page du parcours |
| Accueils de rôle, « Mon compte », écrans des Lots 2 à 5, erreurs et 404 levées dans ces pages | **KEO** | D73 |
| `apps/backoffice` entier, connexion et activation comprises | **KEO** | D73 ; aucune vitrine dans le backoffice |

Le texte juridique affiché dans le parcours (fenêtre des CGU, écran bloquant de `17` §6.7) est rendu
en KEO par le même composant neutre que les pages légales.

### 21.3 Tokens : un fichier, deux chartes, un attribut

| Option | Pour | Contre |
|---|---|---|
| **A. Re-valoriser les tokens de rôle sous `[data-theme="keo"]`, dans `tokens.css`** | Mêmes classes partout ; composants inchangés ; vitrine intacte ; G3 « un seul fichier » et la copie octet pour octet du backoffice tiennent | Piège des alias (règle 3), à fermer par une garde |
| B. Second fichier `tokens-keo.css` | Séparation visible | Même mécanisme que A, avec une copie et une liste de G3 de plus à tenir |
| C. Bascule globale | Le plus simple | Contraire à D73 ; rejoue la recette de la landing |
| D. Vocabulaire parallèle (`bg-keo-surface-1`…) | Explicite | Deux langages de classes, aucun composant réutilisable entre chartes |

**Décision : A.**

1. Le bloc `@theme static` reste la **seule déclaration des noms de rôle** (un nom absent de `@theme`
   n'a pas de classe) et porte les valeurs vitrine. Un rôle demandé par KEO y entre d'abord, avec une
   valeur vitrine ou un alias.
2. Les valeurs KEO vivent dans **un seul bloc** de `tokens.css`, après `@theme` :
   `@layer base { [data-theme="keo"] { … } }`. Il ne déclare que des noms **déjà déclarés** (`@theme`
   ou `:root`), des valeurs **opaques** (`#rrggbb`, `transparent`, `var()`), et redéfinit **tout**
   `--color-*`, sauf une liste nommée dans la garde (`KEO_INHERITS` : voile, rouges D72 si `expert-ux`
   les conserve). Il redéfinit aussi familles de polices et rayons ; échelles d'espacement et de texte,
   durées et points de rupture **ne changent pas**.
3. **Piège vérifié sur le CSS compilé (2026-10-28).** Tailwind v4 émet les tokens dans
   `@layer theme { :root, :host { … } }` et les classes lisent `var(--color-…)` : la redéfinition sous
   un conteneur fonctionne. Mais un alias (`--color-action-secondary-border: var(--color-border-strong)`)
   est **résolu sur `:root`** et hérité déjà résolu : redéfinir sa cible sous le conteneur ne le change
   pas. Tout alias dont la cible est redéfinie est donc **redéclaré à l'identique** dans le bloc KEO
   (fermeture vérifiée par G3c). `@theme inline` n'est pas une issue : il inscrirait aussi les valeurs
   littérales dans les classes, et plus aucune redéfinition n'aurait d'effet.
4. **Activation, à deux endroits seulement** (G8). `apps/web` : un conteneur `<div data-theme="keo">`
   posé par `app/[locale]/(member)/layout.tsx`, avec les classes de police et
   `min-h-dvh bg-surface-page font-base text-text-primary` ; `<html>` et `<body>` restent vitrine
   (écart `#0a0a0a`/`#0a0b0a`, invisible au rebond). `apps/backoffice` : `<html data-theme="keo">` dans
   `app/layout.tsx`.
5. Aucun portail vers `document.body` sous la charte KEO (il sortirait du conteneur) ; les modales
   restent des `<dialog>` natifs sur place, qui héritent de l'arbre.
6. **Backoffice.** `tokens.css` reste la copie octet pour octet de celui de `apps/web` (garde
   existante). Les tokens `*-bo-*` (`17b` §6) naissent dans
   `apps/backoffice/src/styles/tokens-backoffice.css`, second bloc `@theme static`, **noms `--*-bo-*`
   seulement**, au fil de leur emploi (rail, ligne et cellules de tableau dès ce jalon) ; leurs
   contrastes se calculent contre les surfaces KEO. Aucune occurrence de `-bo-` dans `apps/web/src`.
7. **`packages/ui` : pas dans ce jalon.** Les deux fronts partagent aujourd'hui des **fichiers**
   (tokens, polices), que des copies gardées tiennent déjà (comme le passe-plat et le collecteur
   d'erreurs) ; leurs composants appartiennent à deux registres et ne se partagent pas sans
   vérification (`20` §2). Création maintenue au Lot 2 (`21` §7) : elle reprendra `tokens.css` et
   remplacera la garde de copie. D'ici là, les primitives sont écrites « prêtes à déménager » : pures,
   tokens seulement, aucun import propre à l'application.
8. Nom de l'attribut : `data-theme` (code en anglais). Un futur mode clair des espaces membres
   (`20` Q6) serait une autre valeur, sans autre mécanisme.

### 21.4 Polices

| Option | Verdict |
|---|---|
| `next/font/google` | **Refusée.** Déjà interdite par `eslint.front-rules.mjs` (CA11, BO-9). Le build dépendrait de la disponibilité de Google, et les fichiers servis peuvent changer d'un build à l'autre : deux builds du même commit (`staging`, production) ne seraient plus identiques |
| `@font-face` écrit à la main | Refusée : perd le repli métrique et le préchargement par segment |
| **`next/font/local` + fichiers versionnés** | **Retenue** |

1. Un seul module par front, `src/styles/fonts.ts`, **identique** dans les deux fronts. Variables
   `--typeface-manrope` et `--typeface-source-sans`, hors de l'espace `--font-*` de Tailwind (aucune
   classe parasite). Le bloc KEO compose : `--font-display` (titres, chiffres) = Manrope puis la pile
   système ; `--font-base` (corps) = Source Sans 3 puis la pile système — celle de la vitrine, écrite
   une seule fois dans `tokens.css`.
2. Fichiers : woff2 **variables** (axe `wght`), style normal, **non modifiés**, tels que Google Fonts
   les distribue (miroir Fontsource, version épinglée) : sous-ensembles `latin` et `latin-ext` de
   chaque famille, quatre fichiers par front dans `src/styles/fonts/`, avec le texte OFL 1.1 de chaque
   famille et un manifeste `FONTS.md` (fichier, famille, sous-ensemble, source et version, SHA-256,
   licence). Pas de redécoupage par nos soins : un fichier modifié perd le droit au nom réservé (OFL ;
   Source Sans 3 réserve « Source »). Téléchargés une fois sur le poste ; la CI ne télécharge rien.
3. `latin` couvre tous les libellés FR et EN (« œ », « € », guillemets compris) ; `latin-ext` couvre
   les noms saisis (ł, ș, ğ, č…). Chaque fichier porte son `unicode-range` et les deux fichiers d'une
   famille partagent un nom de famille (option `declarations`) : `latin-ext` ne se télécharge que si
   l'un de ses caractères s'affiche. Au-delà (cyrillique, grec, vietnamien, écritures non latines),
   repli caractère par caractère sur la pile système, accepté. **Réalisé (DS-3, DS-4) :** le repli
   métrique de `next/font` dessine un glyphe `latin-ext` avant qu'une seconde famille puisse le
   faire (TD3.4) ; les piles KEO (`--font-base`, `--font-display`) citent donc le seul fichier
   `latin`, puis la pile système. Les deux fichiers `latin-ext` sont versionnés (manifeste, G4f) mais
   non câblés : un « ł » s'affiche en repli système et aucun `latin-ext` n'est jamais téléchargé
   (EC-DS-3-1).
4. `display: "swap"`, repli métrique automatique (`adjustFontFallback: "Arial"`, défaut de
   `next/font/local`), préchargement des seuls fichiers `latin`. Pas d'italique livrée (la charte n'en
   emploie pas ; l'emphase rare d'un texte juridique reste synthétisée). L'axe variable couvre toutes
   les graisses ; les tokens n'en emploient que quelques-unes (Manrope 600 à 800, Source Sans 3 400 à
   600 ; liste finale : `expert-ux`). Vérifier au DS-3 la présence des chiffres tabulaires de Manrope
   (`--font-variant-numeric-amount`).
5. **Chargement par segment.** `fonts.ts` n'est importé que par `app/[locale]/(member)/layout.tsx`
   (web) et `app/layout.tsx` (backoffice) : Next.js précharge une police sur les seules routes de la
   mise en page qui l'emploie, donc **jamais sur la landing**, qui reste sur sa pile système. CSP
   inchangée : fichiers sous `/_next/static/media/` (`font-src 'self'`), `@font-face` dans une feuille
   externe (`style-src 'self'`).
6. Budget : les deux fichiers `latin` préchargés pèsent 53 708 octets (24 836 + 28 872), figés par
   la garde G4f, plafond 120 000 octets (relevé à la clôture du jalon, 2026-10-29).

### 21.5 Gabarits de page

```
apps/web/src/app/[locale]/
  layout.tsx                      racine inchangée (vitrine)
  page.tsx, cgu/, terms/, …       vitrine
  (member)/layout.tsx             serveur : conteneur data-theme="keo", polices
  (member)/error.tsx, not-found.tsx
  (member)/connexion/, sign-in/, inscription/**, signup/**      parcours, sans navigation
  (member)/(space)/layout.tsx     serveur : messages, <MemberShell>
  (member)/(space)/marque/, brand/, createur/, creator/, compte/**, account/**

apps/backoffice/src/app/
  layout.tsx                      <html data-theme="keo">, polices
  (auth)/page.tsx, (auth)/activation/                            sans rail
  (app)/layout.tsx                <Shell>
  (app)/accueil/, inscrits/, invitations/, double-validation/, reglages/, comptes-internes/, sante-technique/
```

Les groupes ne changent aucune URL : chemins localisés, `memberPageLocale` et redirections de
`member-paths.ts` restent tels quels.

1. **La coquille vit dans la mise en page, en composant client.** La session ne se lit que par le
   passe-plat du navigateur (le client d'API est réservé au passe-plat, G5). `MemberShell` et `Shell`
   lisent `GET /v1/me` (`/v1/bo/me`) au montage **et à chaque changement de chemin**, sans vider
   l'écran : l'écran bloquant des CGU (`05` RG28) et les bandeaux du backoffice (environnement, code
   de secours, contrôle par les pairs, `15` RG107) restent lus à chaque page, comme aujourd'hui ; la
   colonne ne se remonte plus à chaque navigation. Les pages lisent le contexte (`useMember()`,
   `useMe()`) et n'appellent plus `readMe` elles-mêmes.
2. **Aucune logique métier dans la coquille** (`CLAUDE.md` §5) : page d'un chemin, espace exigé,
   entrée active, entrées par rôle, pages exemptées des CGU sont des fonctions pures de
   `src/lib/member-paths.ts` et `src/lib/member-nav.ts`, testées seules.
3. **Un seul `<nav>` « Navigation principale »**, rendu une fois par le serveur et **restylé par le
   CSS** : barre fixée en bas sous `lg`, liste verticale de la colonne à partir de `lg`. Ni détection de
   largeur en JavaScript, ni lecture de l'agent utilisateur, ni deux `<nav>` dont l'un est masqué.
   L'objectif de `17` §2.2 (un seul `<nav>` exposé) est tenu à la lettre : un seul élément dans le DOM.
   Le bloc d'état du compte, l'aide et la déconnexion sont hors du `<nav>`, dans la colonne seulement.
   Un libellé par entrée, identique aux deux largeurs (≤ 11 caractères FR et EN, `17` §2.2), icône
   `aria-hidden`. Toute autre navigation (sous-pages de « Mon compte ») porte un nom distinct.
4. Grille et tokens : `lg:grid-cols-(--grid-member-shell)` ; `--size-member-rail` (16 rem, `17`
   §2.3), `--size-nav-bottom-height` (3,5 rem) et `--z-nav-bottom` (90) de `17` §8.2 ; colonne
   `lg:sticky lg:top-0 lg:h-dvh` ; marge basse de `main` sous `lg` ; zone de geste iOS par une règle de
   base de `globals.css` écrite en tokens (même procédé que le bandeau des cookies).
5. **Pas de repli de la colonne, rien de persisté.** Il n'est pas spécifié (`17` §2.3 : largeur fixe ;
   `17b` §1.2 : rail toujours visible). S'il est demandé plus tard : un état non persisté de la
   coquille (il survit aux navigations, se perd au rechargement). **Un cookie de préférence est
   refusé** : `document.cookie` et `cookieStore` sont interdits pour de bon (garde CA8/CA11), un cookie
   posé par le serveur demanderait une nouvelle route (G5) ou une route d'API pour un réglage
   cosmétique, et un nouveau cookie rouvre la politique des cookies (Lot 6).
6. **Icônes** : `lucide-react`, déjà épinglée dans les deux fronts, par le seul module `icons.ts` de
   chaque front (rendu obligatoire par ESLint) ; ni seconde bibliothèque, ni police d'icônes.
7. **Mouvement** : les durées tombent déjà à zéro sous `prefers-reduced-motion` (`tokens.css`) ;
   sous KEO, **agrandissement au survol et soulèvement des cartes sous `motion-safe:` seulement**
   (F6, fondateur, 2026-10-29, amende l'arbitrage `chef-de-projet` du 2026-10-28 qui les excluait) ;
   jamais `transition-all`, aucune transformation d'état hors `motion-safe:`, aucune réduction à
   l'appui (`20` §11.5) ; aucune navigation animée.
8. **Backoffice** : rail à partir de `lg` (`--spacing-bo-rail-w`, 15 rem, `17b` §6.1), bande de tête de
   `17b` §1.4 ; **entre `md` et `lg`**, le même `<nav>` devient une liste horizontale compacte et le
   backoffice reste complet (fenêtre demi-écran d'un poste de travail) ; **sous `md`, ou sous 500 px de
   haut** (téléphone, y compris en paysage), un écran « poste de travail » sans contenu métier, en
   attendant la vue « deux gestes » de D58 (Lot 4, conditions de session ouvertes) — arbitrage
   `chef-de-projet` du 2026-10-28, condition de hauteur ajoutée par le fondateur (F7, 2026-10-29). Seuls les écrans existants y figurent ; les entrées d'administration restent
   absentes pour un `agent`, le serveur les refuse de toute façon (CA63).
9. Les entrées des Lots 2 à 5 côté membres viennent de `member-nav.ts` ; **elles sont omises jusqu'à
   leur lot** (arbitrage `chef-de-projet` du 2026-10-28, `expert-ux` d'accord) et leurs libellés
   n'entrent dans les fichiers de traduction qu'avec leur écran ; une entrée apparue ne disparaît plus.
   Les écrans autonomes (parcours, CGU à ré-accepter, déconnecté, compte supprimé) n'affichent aucune
   navigation principale (`20` §11.8).

### 21.6 Gardes et tests

Les lecteurs de blocs (`@theme`, bloc KEO), la fermeture des alias et l'écart de teinte rejoignent
`@influx/test-kit/guards`, avec leur auto-test, comme les détecteurs existants.

| Garde | Statut | Ce qu'elle vérifie, depuis les fichiers |
|---|---|---|
| G3 | Amendée | `apps/web` : toujours un seul fichier de tokens, en-tête « D6 tranchée » et « D73 ». `apps/backoffice` : `tokens-backoffice.css` rejoint la liste des feuilles |
| G3b | Amendée | Rouges D72 opaques, identiques entre fronts, contrastes recalculés **par charte**, contre toutes les surfaces où un message d'erreur peut paraître |
| G3c | Nouvelle | Bloc KEO unique, dans `tokens.css` ; noms ⊆ noms déclarés ; tout `--color-*` redéfini hors `KEO_INHERITS` ; fermeture des alias ; valeurs opaques |
| G3d | Nouvelle | Matrice de contrastes par charte (paires listées en données, relues par `expert-ux`) : textes ≥ 4,5:1 sur chaque surface permise ; bordure de champ et contour de focus ≥ 3:1 ; texte sur action principale (repos, survol, appui) ≥ 4,5:1 ; succès écarté du vert d'action d'au moins 20° de teinte (`CLAUDE.md` §4) |
| G3e | Nouvelle | Vitrine figée : chaque valeur de l'instantané `apps/web/tests/fixtures/vitrine-tokens-d59.json` reste égale (ajouts permis) |
| G3f | Nouvelle | Aucun `-bo-` dans `apps/web/src` ; `tokens-backoffice.css` ne déclare que des `--*-bo-*`, contrastés contre KEO |
| G4f | Nouvelle | Fichiers de police uniquement sous `src/styles/fonts/`, chacun au manifeste avec SHA-256, licences OFL présentes, copies et `fonts.ts` identiques entre fronts, budget tenu |
| G8 | Nouvelle | `data-theme` posé dans les deux seules mises en page ; `fonts.ts` importé par elles seules ; aucun module réservé à la landing (liste nommée) importé sous `(member)` ni par `components/{member,auth,account}` ; aucun token réservé à la vitrine (`metal-card`, halos, `phone-*`, `hero-*`, bandeau de maquette) hors de la landing ; aucun `createPortal` sous la charte KEO ; transformations au survol sous `motion-safe:` seulement |
| ESLint | Amendée | `lucide-react` hors `icons.ts` interdit ; `next/font/local` hors `src/styles/fonts.ts` interdit (`next/font/google` l'est déjà) |
| Unitaires | Nouveaux | `member-nav.ts` (≤ 5 entrées, libellés ≤ 11 caractères FR et EN lus dans les fichiers de traduction), `pageOfPath`, entrée active, espace exigé |
| E2E | Nouveaux | Landing FR et EN : aucune police téléchargée, aucune requête tierce. Page membre : polices servies par l'origine seule, `latin-ext` non téléchargé sur un contenu FR. À 375 et 1440 px : un seul repère `navigation` « Navigation principale », `aria-current`, dernier élément de `main` jamais sous la barre. Mouvement réduit émulé : durées nulles. axe WCAG 2.1 AA sur chaque écran rhabillé des deux fronts. Aucune violation CSP en console |

### 21.7 Découpage

Quatorze commits ordonnés (DS-14 ajouté par F2), dans la fiche `docs/mvp/jalons/ds-fiche.md`. Préalables : table de
correspondance d'`expert-ux` avant DS-2 (faite le 2026-10-28, `20` §11.3) ; anatomie des gabarits
avant DS-6 et DS-10 (faite, `17` §2.2–2.3, `17b` §1.7) ; entrées des Lots 2 à 5 omises (point 9,
tranché) ; points F1 à F7 du fondateur (`20` §11.9 ; tous tranchés, F7 le 2026-10-29).

### 21.8 Risques et réversibilité

| Risque | Parade |
|---|---|
| Alias résolu sur `:root` qui garde sa valeur vitrine sous KEO | G3c (fermeture), complétude du bloc |
| Succès KEO `#4ade80` (teinte 142°) à 13° du vert d'action KEO `#1dd68a` (155°) ; la sarcelle actuelle `#2dd4bf` (172°) n'en est plus qu'à 17° (27° en vitrine) ; `CLAUDE.md` §4 exige un succès distinct | `expert-ux` choisit un succès à au moins 20° (teinte ≥ 176°, par exemple `#3ccfcf` de KEO, 180°) ; sinon arbitrage du fondateur et `CLAUDE.md` §4 amendé. G3d le calcule |
| Rouge D72 `#ec5d5e` : 5,5:1 sur la surface 1 de KEO, 4,5:1 sur la surface 3, sous le seuil au-delà ; `text-tertiary` de KEO `#8a938e` sous 4,5:1 sur les surfaces 4 et 5 | G3b et G3d recalculés ; paires interdites fixées par `expert-ux` |
| Teintes de rôle KEO (marque `#e6d3a3`, créateur `#ff8fb1`) prises pour seul porteur du rôle, contraire à `12` RG7 et à P7 | Libellé toujours écrit ; `expert-ux` |
| Nom de famille commun `latin`/`latin-ext` non pris en charge par Next 16.3.6 | Repli `latin` seul (§21.4, point 3) |
| Coquille déplacée dans la mise en page qui casse un cas de session (déconnexion, compte supprimé, CGU, rôle d'une autre porte) | e2e `account`, `account-data`, `signup-nominal`, `journey-resume`, `backoffice` verts à chaque commit ; règles pures testées |
| Portail ou `::backdrop` hors du conteneur | §21.3, point 5 ; G8 ; voile dans `KEO_INHERITS` |

**Réversibilité.** Retirer la charte KEO d'un espace revient à retirer l'attribut `data-theme` : il
retrouve la vitrine sans toucher aux composants. **Aligner plus tard la landing sur KEO** revient à
poser l'attribut dans la mise en page racine et à y importer les polices : une poignée de lignes,
puis une recette visuelle des effets D59 (carte métallisée, halos) sur les surfaces KEO, le budget
de premier affichage de la landing avec deux polices de plus, axe, et la mise à jour explicite de
G3e. Ordre de grandeur : un à deux jours, presque tout en recette et en revue `expert-ux`. Les
valeurs KEO passeraient ensuite dans `@theme` et le bloc disparaîtrait.

### 21.9 Ce que cet addendum demande aux autres agents

| Agent | Demande |
|---|---|
| `expert-ux` | Table KEO → rôles avec `KEO_INHERITS` et les paires de contraste permises (avant DS-2) ; succès distinct du vert d'action ; anatomie des deux coquilles ; report du §21.5, point 3, dans `17` §2.2 ; skill `design-system-influx` (deux chartes, un attribut, polices) |
| `product-owner` | *Sans objet : entrées des Lots 2 à 5 omises jusqu'à leur lot (`chef-de-projet`, 2026-10-28, §21.5 point 9)* |
| `dev-react-node` | Commits DS-1 à DS-12 ; aucune valeur hors `tokens.css` et `tokens-backoffice.css` ; aucune lecture de session hors des coquilles |
| `testeur` | Gardes et e2e du §21.6 ; revue groupée de fin de jalon |
| `expert-cybersecurite` | Revue groupée de fin de jalon (D71) : CSP inchangée, aucune requête tierce, coquilles qui ne lisent la session que par le passe-plat |
| `chef-de-projet` | D73 et fiche DS ; `CLAUDE.md` §4 (deux chartes, polices auto-hébergées) et §5 (ligne « Fronts ») ; `21` §7 (`packages/ui` maintenu au Lot 2) ; `pnpm docs:index` |

### Sources (vérifiées le 2026-10-28)

- [Tailwind CSS — Theme variables (`inline`, `static`, `--*: initial`)](https://tailwindcss.com/docs/theme)
- [Next.js — Font module (`next/font/local`, `declarations`, `adjustFontFallback`, préchargement par segment)](https://nextjs.org/docs/app/api-reference/components/font)
- CSS compilé de `apps/web` (build local, `.next/static/chunks/*.css`) : `@layer theme{:root,:host{…}}`, `.bg-surface-page{background-color:var(--color-surface-page)}`, `--color-action-secondary-border:var(--color-border-strong)`
