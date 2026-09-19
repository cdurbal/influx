---
name: env-secrets
description: Ajouter, faire tourner ou documenter une variable d'environnement ou un secret INFLUX (Supabase, base de données, Brevo, Apollo.io, Railway, GitHub) — nommage, cloisonnement par environnement, exposition côté client, garde-fou d'environnement, procédure de rotation et de fuite. À utiliser dès qu'une nouvelle clé ou configuration externe apparaît.
---

# Variables d'environnement et secrets

Une clé qui fuit, c'est la base de contacts exfiltrée ou des e-mails envoyés au nom d'INFLUX.
Une clé mal cloisonnée, c'est un e-mail de test parti vers de vrais clients.

Agents concernés : `integrateur` (principal), `expert-cybersecurite` (**veto**), `architecte`.

> **Révision du 2026-09-19.** Cette skill est alignée sur les décisions D5, D12, D18 et D37
> (`docs/mvp/02-architecture-3-espaces.md` §2, §5, §12), sur l'avis de `expert-cybersecurite`
> (`docs/mvp/03-matrice-des-droits-et-rls.md` §6.8 et §8) et sur le contrat d'interface Brevo
> (`docs/mvp/16-backoffice-emails-brevo.md` §J et §M).
>
> **Trois corrections de fond par rapport à la version précédente :**
>
> | # | Ce qui était écrit | Ce qui est corrigé |
> |---|---|---|
> | **1** | L'URL du projet Supabase et la **clé anonyme** étaient classées « Client (publique) » | **Faux depuis D5/D12.** Le front ne parle jamais à Supabase et **ne porte aucune clé Supabase, pas même `anon`**. Les deux sont **serveur uniquement**, détenues par `apps/api` |
> | **2** | Une seule « clé API Brevo » | **Onze variables** Brevo (`16` §M8), dont le mode d'envoi, la liste de redirection, les trois expéditeurs et les secrets du webhook |
> | **3** | La rotation se vérifiait « en `staging` » | **Impossible pour Brevo et Apollo** : cela reviendrait à poser une clé de production en `staging`, ce que la règle 6 interdit et que `16` RG115/RG120 traitent comme un **incident**. Deux procédures de rotation distinctes, §« Faire tourner une clé » |

---

## Règles absolues

1. **Aucun secret dans Git.** `.env*` est ignoré dès le premier commit, sauf `.env.example`, qui ne
   contient que des **valeurs factices**.
2. **Aucune variable `SUPABASE_*` n'atteint jamais un navigateur.** Ni `SUPABASE_URL`, ni
   `SUPABASE_ANON_KEY`, ni a fortiori `SUPABASE_SERVICE_ROLE_KEY`. **Aucune d'elles n'est jamais
   préfixée `NEXT_PUBLIC_`.** C'est la traduction en variables de la règle d'architecture n° 1
   (`CLAUDE.md` §6, `02` §2.1) : *le front ne parle jamais à Supabase pour de la donnée métier et ne
   porte aucune clé Supabase, pas même `anon`.*
   **Pourquoi la clé `anon` n'est pas « inoffensive » ici :** elle ouvre PostgREST au navigateur, et
   la seule chose qui empêche alors de lire des données est la RLS table par table — or tout notre
   dispositif d'anonymisation (A2, D16) repose précisément sur le fait que **le navigateur n'écrit
   jamais la requête**, garantie que la présence de cette clé côté client annulerait le jour où
   quelqu'un placerait par mégarde une table métier dans un schéma exposé.
3. **Aucun secret dans un bundle front.** Tout ce qui est préfixé pour le client est **public par
   construction** — le vérifier *avant* de nommer une variable. Les seules valeurs autorisées côté
   navigateur sont des valeurs publiques d'affichage (`INFLUX_ENV`, `INFLUX_PUBLIC_SITE_URL`).
4. **Les deux fronts ne détiennent aucun secret, et ne lisent `process.env` que dans
   `src/config/`** — règle ESLint, plus l'interdiction d'importer `@supabase/*`, `drizzle-orm`, `pg`
   et `postgres` dans `apps/web` et `apps/backoffice` (`02` §13.2).
5. **Les clés de service (Supabase `service_role`, Brevo, Apollo) ne quittent jamais le serveur**,
   c'est-à-dire le paquet `apps/api` (services Railway `api` et `worker`).
6. **Clés distinctes par environnement, sans exception.** La clé de production **n'existe nulle part
   ailleurs qu'en production** : ni en `staging`, ni dans un fichier local, ni dans une variable de
   compilation, ni dans un journal, ni dans un ticket (`16` RG115).
7. **Aucune donnée de production dans `staging`** (verrou 4, `03` §6.8, B9). `staging` est alimenté
   **exclusivement** par `supabase/seed`.
8. **Aucun secret dans les journaux**, les messages d'erreur, les tickets ou les captures d'écran.
   Pas non plus d'adresse e-mail complète ni de corps de message dans les journaux.
9. **Validation au démarrage.** Une variable requise manquante ou incohérente fait **échouer le
   démarrage** avec un message clair (schéma zod), jamais un avertissement.
10. **Toute variable est documentée** dans `.env.example` **avant** d'être utilisée.

---

## Inventaire des variables

Colonnes : quels services Railway la portent (`web`, `backoffice`, `api`, `worker`), son exposition,
et ce qui la distingue entre `staging` et `production`.
Source de vérité : `02` §12.3 pour la plateforme, `16` §M8 pour Brevo.

### Plateforme INFLUX

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `INFLUX_ENV` (`staging` \| `production`) | web · backoffice · api · worker | Publique | La valeur **est** la distinction. Lue au démarrage, immuable, journalisée |
| `INFLUX_PUBLIC_SITE_URL` | web · api · worker | Publique | Hôtes distincts |
| `INFLUX_API_INTERNAL_URL` | web · backoffice | **Interne** — réseau privé Railway | `apps/api` **n'a aucun hôte public** : il n'existe pas d'« URL publique de l'API » |
| `SESSION_COOKIE_SECRET` | api | **Secrète** | Valeurs distinctes. Rotation = déconnexion de tous |

### Supabase — **aucune de ces variables n'atteint le navigateur**

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `SUPABASE_URL` | **api uniquement** | **Serveur uniquement** | **Deux projets Supabase distincts**, jamais deux schémas d'un même projet (`02` §12.2) |
| `SUPABASE_ANON_KEY` | **api uniquement** | **Serveur uniquement.** Ce n'est pas un secret — c'est précisément pourquoi **aucune table métier ne vit dans `public`** (`02` §5, règle 4) — mais elle ne quitte pas `apps/api` | Une par projet |
| `SUPABASE_SERVICE_ROLE_KEY` — **clé d'API HTTP**, à ne pas confondre avec le rôle Postgres `service_role`, **qui n'est utilisé nulle part** | api · worker | **Secrète, jamais dans un bundle.** Usage limité à **GoTrue (Auth)** et aux **URL signées du Storage**. **Jamais pour atteindre une table** | Une par projet |
| `SUPABASE_JWKS_URL` | api | Publique par nature | Une par projet |

### Base de données

| Variable | Porteurs | Exposition | Remarque |
|---|---|---|---|
| `DATABASE_URL` | api | **Secrète** | Multiplexeur, rôle **`influx_app`** : ni propriétaire, ni `BYPASSRLS`, ni `SUPERUSER`, **ni membre d'un rôle élevé** |
| `ELEVATED_DATABASE_URL` | api · worker | **Secrète** | **Seconde grappe de connexions** : `influx_auth`, `influx_worker`, `influx_privacy`. **Aucun de ces rôles ne porte `BYPASSRLS`** ; ils ont des `GRANT` et des politiques nommés table par table |
| `DIRECT_DATABASE_URL` | **aucun service d'exécution** | **Secrète — CI uniquement** | Rôle de migration, **propriétaire des objets**. Vit dans les GitHub Secrets de l'environnement concerné et **jamais** dans une variable Railway |

> **Règle non négociable.** Un rôle propriétaire ou `BYPASSRLS` placé dans `DATABASE_URL`
> **annulerait toute la RLS en silence**, sans le moindre symptôme. Vérifié par le test T4 de
> `03` §8 : aucun rôle d'exécution ne porte `rolbypassrls` ni `rolsuper`.

### Brevo — les onze variables de `16` §M8

Toutes sont **serveur uniquement**, dans le paquet `apps/api` (services `api` et `worker`).
**Aucune clé Brevo ne quitte le serveur** (`16` RG8).

| Variable | Rôle | Portée | `staging` vs `production` |
|---|---|---|---|
| `BREVO_API_KEY` | Clé d'accès | **Production uniquement** pour la clé de production | Rotation planifiée, **deux clés acceptées pendant la bascule**. Hors production : au plus la clé d'un **compte Brevo de test distinct**, et rien du tout si `BREVO_MODE=disabled` |
| `BREVO_API_BASE_URL` | Adresse de base | Tous | Permet de pointer la **doublure de test** hors production (`16` RG148) |
| `BREVO_MODE` (`disabled` \| `redirect` \| `live`) | Mode d'envoi | Tous | **`live` refusé hors production** — refus de démarrage, pas un avertissement (RG116). `disabled` est la valeur par défaut partout ailleurs |
| `BREVO_TEST_RECIPIENTS` | Liste **fermée** d'adresses internes | Hors production | **Obligatoire si `redirect`** ; substitution au dernier moment, journalisée (RG117) |
| `BREVO_WEBHOOK_SECRET` | Jeton de l'en-tête personnalisé | Tous | **Deux valeurs acceptées pendant la rotation** (RG146-1). Comparaison en temps constant |
| `BREVO_WEBHOOK_PATH_TOKEN` | Segment non devinable du chemin | Tous | Roté **avec** le jeton. Jamais publié, chemin `noindex` |
| `BREVO_IP_ALLOWLIST` | Plages d'adresses autorisées | Tous | **Surveillée** : une évolution des plages Brevo non répercutée coupe les retours (désinscriptions perdues) |
| `BREVO_SENDER_TRANSACTIONAL` | Expéditeur du flux transactionnel | Tous | Sous-domaine dédié `tx.` (RG9) |
| `BREVO_SENDER_MARKETING` | Expéditeur du flux marketing | Tous | Sous-domaine dédié `news.` |
| `BREVO_SENDER_PROSPECTING` | Expéditeur du flux prospection | **Production uniquement** | Sous-domaine dédié `pro.` |
| `BREVO_SUPPRESSION_LIST_ID` | Liste d'exclusion jointe à tout envoi de source 2 | Tous | RG45 |

> **Brevo ne signe pas ses webhooks** (constat vérifié le 2026-09-19, `16` RG146). C'est pourquoi
> trois variables — jeton d'en-tête, jeton de chemin, liste d'adresses IP — remplacent une
> signature. **Elles sont cumulatives : en retirer une n'est pas une simplification, c'est un
> affaiblissement**, et l'écart est soumis au veto d'`expert-cybersecurite`.

### Apollo.io et pipeline de leads

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `APOLLO_API_KEY` | worker | **Secrète** | **Aucune clé Apollo en `staging`** — recommandation d'`expert-cybersecurite` (`03` §6.8) : le connecteur passe alors en `skipped_no_credentials`. Une clé absente ne peut pas être confondue avec une autre |
| `SYNC_MODE` (`live` \| `dry_run`) | worker | Garde-fou | `dry_run` en `staging`, `live` en production. Lu au démarrage, **immuable à l'exécution**, journalisé |
| `NON_PRODUCTION_RECIPIENT_ALLOWLIST` | worker | Garde-fou | Condition **positive** évaluée au connecteur, après tout le mappage |

---

## Ajouter une variable

1. **Classer** : publique (client) ou secrète (serveur). En cas de doute → secrète.
   **Toute variable `SUPABASE_*`, `DATABASE_*`, `BREVO_*`, `APOLLO_*` est serveur, sans discussion.**
2. **Nommer** en `SCREAMING_SNAKE_CASE`, explicite, préfixé par le service
   (`BREVO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`). **N'utiliser `NEXT_PUBLIC_` que pour une
   valeur qu'on accepterait de publier sur la page d'accueil.**
3. **Documenter** dans `.env.example` : nom, rôle, format attendu, service porteur, **valeur
   factice** — jamais la vraie valeur.
4. **Renseigner** aux trois endroits utiles, **par environnement** :
   - Local : `.env` (ignoré par Git) ;
   - CI : GitHub Secrets — **c'est le seul endroit de `DIRECT_DATABASE_URL`** ;
   - Exécution : variables Railway, **du seul service qui en a besoin**. Une variable posée « au cas
     où » sur les quatre services est une fuite en attente.
5. **Valider au démarrage** (zod) : variable manquante → échec immédiat, message clair.
6. **Brancher les contrôles de CI** ci-dessous.
7. **Signaler au fondateur** toute variable qu'il doit obtenir lui-même (création de compte,
   génération de clé, enregistrement DNS) — cf. `CLAUDE.md` §14.3.

### Contrôles de CI obligatoires — le build échoue, il n'avertit pas

| # | Contrôle | Ce qu'il empêche |
|---|---|---|
| **CI-1** | **Aucune variable `SUPABASE_*` exposée au client.** Échec du build si une variable dont le nom commence par `SUPABASE_` est préfixée `NEXT_PUBLIC_`, référencée hors de `apps/api`, ou lue hors de `src/config/` dans un front | La reclassification silencieuse de la clé `anon` en « valeur publique inoffensive » |
| **CI-2** | **Analyse des artefacts de construction** de `apps/web` et `apps/backoffice` : aucune occurrence de `SUPABASE_` (URL de projet comprise), `BREVO_`, `APOLLO_`, `SERVICE_ROLE`, `SESSION_COOKIE_SECRET`, `DATABASE_URL`, ni d'aucune chaîne ressemblant à un JWT ou à une chaîne de connexion Postgres | La fuite par empaquetage : la variable lue au mauvais endroit se retrouve dans le bundle (`03` §8, T11, **étendu ici à tout préfixe `SUPABASE_`**) |
| **CI-3** | **Analyse de secrets** sur le dépôt **et son historique**, `.env*` ignoré vérifié | Le secret commité puis « retiré » au commit suivant |
| **CI-4** | **Aucun rôle d'exécution avec `rolbypassrls` ni `rolsuper`** (`03` §8, T4) | La RLS annulée en silence par une chaîne de connexion trop puissante |
| **CI-5** | **`DIRECT_DATABASE_URL` absente de toute configuration de service Railway** | Le rôle propriétaire du schéma joignable depuis un processus qui sert des requêtes |
| **CI-6** | **Les quatre verrous du garde-fou `staging`**, chacun testé séparément, plus le refus de démarrage en production avec `dry_run` / hors production avec `live` (`03` §8, T17) | L'e-mail réel parti d'un environnement de test |

---

## Faire tourner une clé

Rotation à effectuer : périodiquement, au départ d'un intervenant, et **immédiatement en cas de
suspicion de fuite**.

**Il y a deux procédures, et prendre la mauvaise est une faute.** Le critère est simple :

> **La clé a-t-elle un effet de bord observable par un tiers ?**
> Si l'utiliser peut envoyer un e-mail, écrire dans un CRM ou contacter une personne réelle,
> **elle ne se teste jamais en `staging`** : poser la clé de production en `staging` viole la règle
> absolue 6 et constitue un **incident** au sens de `16` RG115/RG120.

| Service / clé | Effet de bord tiers | Procédure |
|---|---|---|
| `BREVO_API_KEY`, `BREVO_SENDER_*` | **Oui** — e-mail réel | **B** |
| `APOLLO_API_KEY` | **Oui** — écriture CRM, séquence commerciale | **B** |
| `BREVO_WEBHOOK_SECRET`, `BREVO_WEBHOOK_PATH_TOKEN` | Oui, en flux entrant : une valeur mal basculée **perd des désinscriptions** | **B** |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Non | **A** |
| `DATABASE_URL`, `ELEVATED_DATABASE_URL`, `DIRECT_DATABASE_URL` (mots de passe de rôles) | Non | **A** |
| `SESSION_COOKIE_SECRET` | Non, mais **déconnecte tout le monde** | **A**, en fenêtre choisie |

### Procédure A — clé sans effet de bord observable

1. Générer la nouvelle valeur côté service.
2. **Renseigner en `staging`, vérifier le bon fonctionnement** de bout en bout.
3. Renseigner en production, redéployer si nécessaire.
4. **Révoquer l'ancienne valeur** — étape la plus souvent oubliée, et la seule qui protège réellement.
5. Vérifier les journaux pour détecter d'éventuels usages résiduels.
6. Consigner la rotation : date, motif, qui, quelles variables.

### Procédure B — clé à effet de bord réel (Brevo, Apollo, webhooks entrants)

**La vérification se fait en production, jamais en `staging`. Ce qui rend l'opération sûre n'est
pas un environnement de test, c'est la fenêtre à deux clés.**

1. **Créer la nouvelle clé sur le compte de production**, sans révoquer l'ancienne. Chez Brevo comme
   chez Apollo, plusieurs clés coexistent : c'est ce qui rend la bascule non destructive.
2. **Vérifier que le service accepte les deux valeurs** pendant la fenêtre de bascule :
   - clés sortantes (Brevo, Apollo) : la nouvelle clé est renseignée, l'ancienne reste valide côté
     fournisseur le temps que tous les processus aient redémarré ;
   - secrets de webhook entrants : **deux valeurs acceptées simultanément** en comparaison à temps
     constant (`16` RG146-1), sinon chaque retour reçu pendant la bascule est perdu — et une
     désinscription perdue est un manquement.
3. **Renseigner la nouvelle valeur en production** et redéployer les services concernés (`api`,
   `worker`).
4. **Vérifier sur un volume minimal et maîtrisé** : un envoi transactionnel réel vers une adresse
   interne, ou un unique appel de lecture côté Apollo. **Jamais un envoi de masse comme test de
   rotation.**
5. **Révoquer l'ancienne clé** et **fermer la fenêtre à deux valeurs** (retirer la seconde valeur
   acceptée du webhook). Tant que ce n'est pas fait, la rotation n'a rien protégé.
6. Vérifier les journaux du fournisseur : plus aucun appel avec l'ancienne clé.
7. Consigner : date, motif, qui, durée de la fenêtre, date effective de révocation.

> **Ce qui reste testable en `staging` pour ces services :** le **code** du connecteur, contre la
> **doublure de test** (`16` RG148) et avec `BREVO_MODE=disabled` ou `redirect` — jamais la clé de
> production.

---

## Le garde-fou d'environnement — quatre verrous

Trois verrous protègent **l'envoi** (`02` §12.4), un quatrième protège **les données**
(`03` §6.8, ajouté par `expert-cybersecurite`, **bloquant B9**). Ils sont **indépendants et
cumulatifs**, parce qu'un seul finit toujours par sauter. Chacun fait l'objet d'un test (T17).

1. **Verrou 1 — Clés distinctes.** `staging` utilise un compte Brevo de test ; **aucune clé Apollo
   en `staging`**. Les clés de production ne sont jamais saisies dans `staging`, elles ne se
   ressemblent pas et ne sont pas interchangeables.
2. **Verrou 2 — Mode explicite.** `SYNC_MODE=dry_run` et `BREVO_MODE=disabled` hors production : le
   connecteur n'appelle rien, marque la ligne traitée et journalise ce qu'il aurait envoyé. Le
   pipeline est testé de bout en bout, sans aucun appel sortant. **Le service refuse de démarrer**
   si `BREVO_MODE=live` hors production, ou si `SYNC_MODE=dry_run` en production — une production
   silencieusement muette est aussi grave qu'un envoi de test réel.
3. **Verrou 3 — Liste blanche de destinataires.** Si `INFLUX_ENV !== 'production'` et qu'un envoi
   réel est volontairement demandé (`redirect` / `live`), tout destinataire absent de
   `NON_PRODUCTION_RECIPIENT_ALLOWLIST` ou de `BREVO_TEST_RECIPIENTS` est écarté. Condition
   **positive** (« l'adresse figure dans la liste »), **jamais** négative, évaluée **au connecteur,
   après tout le mappage**, juste avant l'appel sortant.
4. **Verrou 4 — Aucune donnée de production dans `staging`** *(le plus important)*. `staging` est
   alimenté **exclusivement** par des données synthétiques (`supabase/seed`). **Toute restauration
   d'une sauvegarde de production vers un autre environnement exige une autorisation écrite du
   fondateur *et* une anonymisation préalable.** « Pour reproduire le bogue » est la phrase la plus
   dangereuse du métier : les trois premiers verrous protègent l'envoi, aucun ne protège les
   données.

**Compléments :** `staging` est **inaccessible au public** (restriction d'accès ou liste d'IP) et
sert `X-Robots-Tag: noindex` sur toutes les réponses. Le backoffice non productif porte un **bandeau
d'environnement permanent** indiquant l'environnement et le mode d'envoi, en toutes lettres et pas
seulement par une couleur (`16` RG118). **Tout envoi réel constaté depuis un environnement de test
se déclare comme incident** (`16` RG120) : coupure de la clé, recensement des destinataires atteints,
information des personnes si nécessaire, consignation écrite.

---

## Checklist de mise en service d'un environnement

À dérouler une fois par environnement, **avant le premier envoi réel**.

- [ ] Projet Supabase **dédié** créé (un par environnement, jamais deux schémas d'un même projet)
- [ ] Rôles Postgres créés : `influx_app`, les quatre rôles métier, les trois rôles élevés —
      **aucun avec `BYPASSRLS` ni `SUPERUSER`** ; le rôle Postgres `service_role` n'est utilisé nulle part
- [ ] `DATABASE_URL` et `ELEVATED_DATABASE_URL` posées sur les seuls services concernés ;
      `DIRECT_DATABASE_URL` **uniquement dans les GitHub Secrets**
- [ ] Les quatre services Railway créés (`web`, `backoffice`, `api`, `worker`) ; **`api` sans hôte
      public**, joint par le réseau privé
- [ ] **Domaines d'envoi — bloquant.** Les **trois sous-domaines** de `16` RG9 sont créés et
      **authentifiés séparément (SPF, DKIM, DMARC)** :
  - [ ] `tx.<domaine>` — transactionnel (code de connexion, décisions, preuves)
  - [ ] `news.<domaine>` — marketing (sources 1 et 2)
  - [ ] `pro.<domaine>` — prospection (source 3 uniquement)
  - [ ] Enregistrement **DMARC** publié pour chacun, politique décidée avec `expert-marketing`
  - [ ] **Aucun envoi n'est autorisé avant que les trois soient authentifiés**, et le service
        **refuse de démarrer** en `live` sans cela (RG116)
- [ ] **L'authentification du domaine est bloquante pour le Lot 1** (`CLAUDE.md` §14.3) : depuis
      **D37**, les membres se connectent par un **code à 6 chiffres reçu par e-mail**. Un e-mail qui
      n'arrive pas n'est plus une gêne marketing, c'est **une impossibilité de se connecter** :
      **la délivrabilité est la disponibilité du produit**
- [ ] Les onze variables Brevo renseignées, avec `BREVO_MODE` cohérent avec l'environnement
- [ ] Webhook Brevo configuré : chemin à jeton non devinable, en-tête personnalisé, plages d'adresses
      IP à jour et **surveillées**
- [ ] Les quatre verrous du garde-fou actifs et testés (T17)
- [ ] `staging` non indexé et non accessible publiquement ; base alimentée par `supabase/seed` seul
- [ ] Traçabilité de déploiement en place : quel commit, par qui, quand, vers quel environnement
- [ ] Procédure de rollback écrite et essayée au moins une fois

---

## En cas de fuite avérée

Traiter comme un incident, dans cet ordre :

1. **Révoquer immédiatement** la clé compromise — avant même de comprendre l'origine.
2. Générer et déployer une clé de remplacement (procédure A ou B selon l'effet de bord).
3. Évaluer l'exposition : quelles données accessibles, quelles actions possibles, sur quelle période.
   Pour une clé Brevo ou Apollo, la question n'est pas seulement « qu'a-t-on pu lire » mais
   **« qu'a-t-on pu envoyer, et à qui »**.
4. Examiner les journaux du service concerné pour repérer un usage anormal.
5. Purger la donnée de l'historique Git si elle y a été commitée (réécriture d'historique, avec
   l'accord du fondateur car elle affecte tous les clones).
6. Alerter `expert-cybersecurite` et, si des données personnelles sont concernées,
   `expert-conformite-rgpd` — une violation de données peut exiger une notification à l'autorité de
   contrôle dans un délai contraint.
7. Documenter : cause, impact, correctif, mesure de prévention.

---

## Checklist d'ajout de variable

- [ ] Variable classée publique ou secrète, nommée correctement
- [ ] **Aucune variable `SUPABASE_*` exposée au client, jamais de préfixe `NEXT_PUBLIC_` dessus**
- [ ] Documentée dans `.env.example` avec une valeur factice
- [ ] Renseignée en local, en CI et dans Railway, **par environnement** et **sur le seul service qui
      en a besoin**
- [ ] Clés distinctes entre `staging` et `production` ; clé de production **absente** de `staging`
- [ ] Procédure de rotation identifiée (A ou B) et écrite
- [ ] Validation zod au démarrage en place
- [ ] Contrôles CI-1 à CI-6 passants
- [ ] Aucune valeur en clair dans les journaux ou le bundle front
- [ ] `.gitignore` couvre bien `.env*`
- [ ] Action requise du fondateur signalée explicitement (`CLAUDE.md` §14.3)

---

## Ce qui reste à confirmer

| # | Sujet | Qui tranche |
|---|---|---|
| 1 | **Noms des trois sous-domaines d'envoi** (`tx.`, `news.`, `pro.`) — propositions de `16` RG9, à confirmer avec le nom de domaine retenu (`16` Q13) | `integrateur` + **Fondateur** |
| 2 | **`BREVO_API_KEY` hors production** : `16` §M8 la donne « production uniquement », `02` §12.4 prévoit un **compte Brevo de test** en `staging`. Lecture retenue ici : la *clé de production* n'existe qu'en production, et `staging` peut porter la clé d'un **compte de test distinct** — à confirmer | `expert-integrations-api` + `expert-cybersecurite` |
| 3 | **Absence de signature des webhooks Brevo** (`16` RG146, Q3) : les compensations par jeton, chemin et plages d'IP suffisent-elles ? | **`expert-cybersecurite` (veto)** |
| 4 | **Politique DMARC** de chaque sous-domaine (`none` puis durcissement, ou `quarantine` d'emblée) | `integrateur` + `expert-marketing` |
| 5 | **Périmètre et hébergement du stockage des secrets** au-delà de GitHub Secrets et Railway (coffre dédié) le jour où plusieurs personnes y accèdent | `expert-cybersecurite` + **Fondateur** |
