# Plan et stratégie de développement — du socle au premier usage

> **Date :** 2026-09-25 (allégé le 2026-09-29, puis le 2026-10-31 à l'ouverture du Lot 2) · **Rédigé par :** Claude Code, à la demande du fondateur
> **Public :** le développeur (ou l'agent `dev-react-node`) qui construit le produit réel sur `main`.
> **Statut :** feuille de route active. **Les journaux des jalons clos sont archivés** : J0 à J3 dans `archives/21-journal-j0-j3-archive.md`, J4 dans `archives/21-journal-j4-archive.md`, écarts `EC-*`, J5 à J9 et jalons extra DS, SN, RK dans `archives/21-journal-lot1-archive.md` (§3, §4 et §5 d'origine), fiches dans `archives/jalons/`. **Les agents IA ne lisent pas ces archives par défaut.**
> **Ce document ne remplace aucune spécification.** En cas d'écart, `CLAUDE.md` puis `docs/mvp/00` à `20` font foi.

---

## 0. L'essentiel

| Lot ou jalon | État au 2026-11-13 |
|---|---|
| **Lot 0** — socle (J0 à J4) | ✅ Clos le 2026-10-07 |
| **Lot 1** — inscription et leads (J5 à J9) | ✅ Clos le 2026-10-27 sur `staging` ; production préparée, non créée (portes §5.8, J9T-1) |
| Hors jalon — suppression de compte en libre-service (D72) | ✅ Livré (`0150`) |
| Extras **DS** (D73), **SN** (D74), **RK** (D75) | ✅ Clos les 2026-10-29, 2026-10-30 et 2026-10-30 ; reliquat RK au §8 |
| **Lot 2** — profils, réseaux, badge | ✅ Clos le 2026-11-13. Découpé en sept jalons L2A à L2G (`archives/jalons/lot2-plan.md`, validé le 2026-11-01) ; L2A à L2G clos (L2F le 2026-11-11, D83 réalisée ; L2G le 2026-11-13, avec réserves L2GT-1, L2GT-3, L2GT-9 au §8) : **Lot 2 clos** |

**Deux niveaux de « prêt », à ne pas confondre :** *prêt en `staging`* (démontrable, `staging` iso-production depuis D70 : envois et contacts réels sur les comptes de `staging`, exploité par les agents) et *prêt en production* (ouvert au public : en plus, les portes non techniques de §5.8 et l'accord explicite du fondateur).

**Cinq règles qu'aucune urgence ne suspend :**

1. **Aucune donnée réelle avant que le socle de sécurité soit en place** (B1 à B10, `03` §9.1). On construit la tranche verticale *sur* le socle, jamais à côté.
2. **Le code de connexion suit le contrat de `02` §18.10 à la lettre** : envoi synchrone, une seule tentative, plancher de 1 000 ms, aucun appel externe sous transaction, jamais dans `outbox_events`.
3. **Tout ce qu'un juriste ou le fondateur peut encore changer est une configuration, jamais une constante** : périmètre et base légale Apollo, pays de prospection, pays bloqués, calendrier de réessais, plafonds de débit (`05` Q1 à Q4).
4. **Aucun test automatisé n'appelle un service externe réel** (`18` §1.3, `16` RG148). Les vrais appels ne se font que depuis `staging` (D70, comptes de `staging`) ou à la main avec les valeurs de `staging` ; jamais depuis la CI ni la pile locale.
5. **Seul un écart structurant arrête le code (révisé le 2026-09-29 — directive de vélocité du fondateur)** : un micro-écart technique ou de librairie (`EC-*`) qui ne touche aucun invariant métier est tranché sur-le-champ de la manière la plus sûre/conservatrice par l'agent qui code, **sans arrêter le développement et sans créer de commit `docs(mvp):` intermédiaire**. Les ajustements documentaires et la **revue de sécurité (`expert-cybersecurite`) sont groupés en une seule passe à la fin de chaque jalon**. De même, les exigences RGPD étant déjà traduites dans les specs (`03`, `04`, `14`, `16`), **`expert-conformite-rgpd` n'intervient pas sur les Lots 0 à 5** et réalise **une seule revue globale d'homologation au Lot 6 (fin du Fast MVP)**. Enfin, aucun journal narratif de commit n'est ajouté dans ce fichier (1 seule ligne d'état/invariant par commit du jalon actif).

---

## 1. Point de départ & conventions d'environnement

- **`main`** : produit réel construit de zéro (D44). **Ne jamais copier un fichier de la branche `demo`.**
- **Fichiers d'environnement** *(révisé le 2026-10-18, D70)* : `apps/api/.env.local` porte les **valeurs de `staging`, et uniquement `staging`** (Supabase, Brevo et Apollo de `staging`, jamais `DIRECT_DATABASE_URL`) ; lisible par tous les agents, jamais recopié, jamais chargé par un test (les tests et la CI tournent sur la pile locale et la doublure). `apps/api/.env.staging.local` n'existe plus. `apps/web/.env.local` et `apps/backoffice/.env.local` portent `INFLUX_API_INTERNAL_URL` et leur `INFLUX_API_INTERNAL_SECRET`.

---

## 2. Stratégie de développement

### 2.1 Principes

1. **Les spécifications font foi, la maquette jamais.** Chaque tâche cite la règle qu'elle implémente (`05` RG44, `03` A-9…). Face à un micro-écart technique, appliquer la solution la plus conservatrice sans bloquer le jalon (§0, règle 5).
2. **Socle sécurisé d'abord, puis tranche verticale fine, puis élargissement.** Le premier usage est rendu démontrable le plus tôt possible (J6), puis durci (J7 à J9). On ne soigne pas les écrans avant que le flux complet passe.
3. **La base est l'arbitre.** Contrainte, clé étrangère, déclencheur et politique RLS avant tout contrôle applicatif (`04` §1, R1).
4. **Chaque migration contient sa table, ses droits, ses politiques et son test** (`04` §11.1). Une table sans ligne dans la matrice de `03` (`expected-rights.ts`) fait échouer la CI (T2) : on déclare avant de créer.
5. **Configuration en table, lue au moment de l'usage** (`leads.sync_settings`, `backoffice.sla_policies`) : une décision juridique se bascule sans redéploiement.
6. **`staging` d'abord, production sur accord explicite du fondateur**, toujours.
7. **Petits commits, fréquents, sur `main`** (dérogation du 2026-09-17), en *Conventional Commits*, en anglais.

### 2.2 Les quatre environnements

| | Poste local | Intégration continue | `staging` | `production` |
|---|---|---|---|---|
| **Base** | Pile Supabase locale (`supabase start`, Docker) : Postgres + GoTrue | Pile Supabase locale jetable | Projet Supabase `staging` (UE) | Projet Supabase `production` (D25, PITR D57) |
| **Données** | `supabase/seed` + saisies synthétiques | `supabase/seed` | `supabase/seed` **seul** (B9) | Réelles |
| **Brevo** | Doublure (tests) ; `.env.local` = valeurs de `staging` (D70) | Doublure (`16` RG148) | **`live`, compte de `staging`**, domaine d'envoi propre (D70, après le commit 1 de `archives/jalons/d70-plan.md`) | `live`, compte de production, 3 sous-domaines authentifiés |
| **Apollo** | Doublure (tests) | Doublure | **`live`, compte de `staging`** (D70) | `live` après validation du juriste (D33) |

### 2.3 Stratégie de test & discipline de dépôt

- **Budget de durée de la CI : 10 minutes** (`18` A-4). GoTrue n'est pas doublé (fourni par la pile locale).
- **Budget e2e du Lot 2** (décision du fondateur, 2026-10-31 ; mesure : `archives/jalons/pl-fiche.md` § Mesure PL-12) :
  1. **Ajout d'au plus 20 s par jalon**, mesuré à la clôture : somme des durées médianes, sur les trois passages de clôture, des cas ajoutés ou allongés (`test-results/e2e-report.json`), notée dans `run.md` ; le cumul total reste indicatif (bruit ±5 %).
  2. **Job « Browser journeys » sous 8 min** sur chaque passage vert ; garde-fous de 5 et 15 min inchangés. Dépassement : levier au jalon suivant ou arbitrage.
  3. **Levier du premier jalon : horloge simulée** (`page.clock`) sur les deux attentes de `journey-resume` (−10 à −13 s ; 2026-11-01 : `page.clock` ne couvre que l'abandon, −3 s, le compte à rebours dépendant d'une heure serveur ; le reste est reporté) ; règle des cas neufs : un cas par page et par langue, largeurs en boucle dans le cas.
  4. **Levier structurel** (éclats CI, `--shard`) à arbitrer par `architecte` sur recommandation `testeur`, dès qu'un passage dépasse 7 min 30 ou avant le Lot 3.
- **Définition de « terminé » pour un jalon :**
  - [ ] `pnpm check` vert en local et en CI (format, types, lint, tests, build) ;
  - [ ] les tests exigés par le jalon passent trois fois de suite (`18` §1.3) ;
  - [ ] **directive de vélocité (2026-09-29)** : aucun commit `docs(mvp):` intermédiaire entre deux sous-commits d'un jalon ; **une seule revue groupée (`expert-cybersecurite` + `testeur`) à la fin du jalon** ;
  - [ ] toute migration touchant `audit.*`, une politique, un `GRANT`, un `REVOKE`, une fonction `SECURITY DEFINER`, un attribut de rôle ou `supabase/config.toml` (`[auth*]`, `[api*]`, `[storage*]`, `remotes.*`) porte le marqueur `security-reviewed: <date>` dans son message de commit (`03` I-4) ;
  - [ ] toute variable nouvelle est documentée dans le `.env.example` concerné (skill `env-secrets`).

### 2.4 Dépendances épinglées (versions exactes, `savePrefix: ""`)

Les `package.json` et `pnpm-lock.yaml` font foi pour les versions (aucune copie ici, qui se périme). Invariants : `@supabase/supabase-js` et `@supabase/postgrest-js` interdits (garde `test-witnesses/j3b`) ; `@supabase/auth-js` importé **uniquement** dans `apps/api/src/platform/supabase.ts` ; `@supabase/storage-js` admis au Lot 2 (2.117.2, importé par `apps/api/src/platform/storage.ts` seul) ; `sharp` 0.35.5 (`platform/images.ts` seul, ré-encodage sans métadonnée) ; `postgres` avec `prepare: false` ; `apps/api` exécuté directement par Node (effacement des types, D64). Toute dépendance nouvelle : `architecte`, suite locale complète (`CLAUDE.md` §7 règle 5).

---

## 3. Écarts (`EC-*`) des Lots 0 et 1

Tous tranchés et implémentés. Tableau d'origine : `archives/21-journal-lot1-archive.md` §3 (EC-8 à EC-62) ; écarts plus anciens : `archives/21-journal-j0-j3-archive.md` et `archives/21-journal-j4-archive.md`. Les écarts d'un jalon du Lot 2 vivent dans sa fiche (`jalons/<id>-fiche.md`).

---

## 4. Lot 0 — le socle (J0 à J4)

✅ Clos. Commits, revues et tickets : `archives/21-journal-j0-j3-archive.md`, `archives/21-journal-j4-archive.md`, résumé dans `archives/21-journal-lot1-archive.md` §4. Ticket encore ouvert : J4S-7 (§8), J4S-8 (avant production).

---

## 5. Lot 1 — le premier usage (J5 à J9)

✅ Clos (flux, contrat d'API du Lot 1, commits J5 à J9, DS, SN, RK : `archives/21-journal-lot1-archive.md` §5). Restent ici les portes de la mise en production.

### 5.8 Portes de la mise en production

| Porte | Qui | Référence |
|---|---|---|
| Société créée ; mentions légales possibles | Fondateur + avocat fiscaliste | D25 |
| Périmètre et base légale Apollo validés par un juriste ; pays de prospection renseignés | Fondateur + `expert-conformite-rgpd` (veto) | D33, `05` Q1 à Q3 |
| CGU FR et EN avec clause de non-contournement, supervision des conversations, conservation probatoire ; politique de confidentialité nommant Brevo et Apollo | Fondateur + juriste — *`draft-2` validés le 2026-10-08 ; marqueurs `[…]` en attente de la société* | D29, A5, A10, R-1 |
| Trois sous-domaines d'envoi authentifiés (SPF, DKIM, DMARC) sur le compte Brevo de production | Fondateur + `integrateur` | `16` RG9, `prerequis.md` §14.3 |
| Comptes Brevo et Apollo au nom de la société ; contrats de sous-traitance signés | Fondateur | `prerequis.md` §14.3 |
| *(2026-10-17, D67)* **Identifiants de listes et de modèles Brevo de production renseignés** dans `leads.sync_settings` de production (listes annonceurs et créateurs ; **tous** les modèles de `brevo_template_ids`, bienvenue comprise), par les variables du `worker` (D68) ou par SQL selon le runbook ; premier démarrage du worker de production accepté par le contrôle de `05` RG162 ; aucune ligne en échec de configuration au backoffice | Fondateur (confirmation) + `integrateur` | `05` RG160 à RG164, `02` §12.5 |
| *(2026-11-11, L2G commit 10, D69, D70)* **Attributs Brevo `NETWORKS`, `MAIN_AUDIENCE_BAND` et `MAIN_AUDIENCE_COUNTRY` créés sur le compte Brevo de production** (type texte, comme `VERIFIED_AT`), avant le premier créateur publié (`16` §M4, `07` RG107) ; **textes des e-mails de décision créateur relus** (`email.creatorProfileDecision`, `email.portfolioDecision`, FR et EN, écrits par le worker : aucun modèle Brevo à créer ; « arobase » et « at sign » écrits en toutes lettres, la vérification de sortie refusant le caractère, EC-L2G-10-1) | `expert-integrations-api` + fondateur (textes, D48) | `16` §M4, `07` RG96, RG79, `archives/jalons/l2g/textes.md` |
| *(2026-11-12, L2G fix-1, L2GU-3, 7, 16)* **Textes du profil créateur ajoutés à la relecture des textes D48** (FR et EN, formulations validées par le fondateur le 2026-11-12) : `frozen.pending_review` (« Votre profil est en cours de validation : il ne peut pas être modifié avant la réponse de l'équipe INFLUX. »), `frozen.suspended` (variante écrite par l'agent, à relire), `publish.review` (« Un commercial INFLUX relit votre profil avant de le publier. »), `portfolio.brandConsentHelp` (« Sans cette case, la légende est publiée sans le nom de la marque, ou refusée. »), `status.revisionKept` et `status.revisionRejected` coupée en deux phrases ; à ajouter la liste de L2GU-11 (`l2g/ux-constats.md`, un seul point) | `expert-ux` + fondateur | D48, `archives/jalons/l2g/ux-constats.md` L2GU-11 |
| *(2026-11-12, L2G fix-2, L2GU-4, 5, 6, 17, 18)* **Textes du portfolio créateur ajoutés à la relecture des textes D48** (FR et EN, formulations validées par le fondateur le 2026-11-12) : `portfolio.removeConfirm` (« Retirer ? »), `removeKeep` (« Garder »), `unsaved` (« Modification non enregistrée »), `errors.quota` (« … Réessayez plus tard. ») ; clés écrites par l'agent, à relire : les noms accessibles `portfolio.removeNamed`, `removeNow`, `removeKeepNamed`, `replaceNamed`, `saveCaptionNamed` (avec la position du visuel) et `visibility.saved` (« Enregistré ») | `expert-ux` + fondateur | D48, `archives/jalons/l2g/ux-constats.md` L2GU-11 |
| Textes de la landing relus ; revue visuelle du budget d'effets | `expert-marketing` + `expert-conformite-rgpd` ; `expert-ux` | D48, D59 |
| Exécution des demandes « mes données » (E-5 minimale, `account.deleted`) livrée | `dev-react-node` + `expert-cybersecurite` | Arbitrage `chef-de-projet` 2026-10-14, `15` RG79, RG80 |
| Aucune objection ouverte de `expert-cybersecurite` ni de `expert-conformite-rgpd` | Les deux experts | `CLAUDE.md` §7 règle 2 (D71) |
| **Accord explicite du fondateur** pour la mise en production | Fondateur | `CLAUDE.md` §7 règle 4 |

---

## 6. Configuration des services externes

- **Supabase** : projets `staging` (UE) et `production` (après D25, avec PITR D57) ; clés JWT ES256, réglages GoTrue du J3, aucun schéma métier exposé, mots de passe posés hors migration, `DIRECT_DATABASE_URL` dans GitHub Secrets uniquement.
- **Brevo** : attributs `16` §M4 + EC-11 ; listes par rôle et langue ; modèles transactionnels FR/EN (`auth.login_code`, `account.welcome_*`, `auth.new_device`, `auth.email_change_*`, `internal.critical_alert`) ; webhook (J7) ; deux clés API distinctes (`api` et `worker`, EC-19).
- **Apollo** : champs personnalisés du contexte INFLUX ; séquences activées uniquement après validation du juriste (D33).
- **Railway & GitHub** : 4 services (`web`, `backoffice`, `api` sans domaine public, `worker`), variables par service, secrets dans les environnements GitHub `staging` et `production`, trois sous-domaines DNS (`tx.`, `news.`, `pro.`).

---

## 7. Après le Lot 1 : la feuille de route (Lots 2 à 6bis)

Chaque lot commence par la même séquence : décisions obtenues, spécification relue, migrations et matrice des droits, tests de droits, puis écrans.

| Lot | Décisions à obtenir avant de coder | Première étape technique | Tests qui portent le lot |
|---|---|---|---|
| **2 — Profils, réseaux, badge** | D34, D61 (`07` Q15 et Q16), D24 instruite, `03` R-4 et R-5 | Migrations `0201` à `0207` : trois objets créateur, compartiments Storage privés ; création de `packages/domain` (`packages/ui` et `packages/web-platform` : jalon PL, PL-08 et PL-09, arbitrage PL-07, `02` §21.3 point 7) ; écrans construits dans la charte KEO (D73) | **T1** (anonymisation sur la charge brute), T9, T14, TM5, TM11 |
| **3 — Campagnes, recherche anonymisée** *(mode serré `00` §9)* | D38, facettes de `10` | Migrations `0301` à `0306` ; domaine `search` avec k-anonymat, pagination plafonnée, journal ; fil chronologique côté créateur | T1 rejoué, T15, TM12 ; mesure manuelle des 30 secondes |
| **4 — Mise en relation, messagerie à trois** | D30, apartés (`04` §5.7.1 A2), conditions mobiles de D58 | Migrations `0401` à `0406` ; `reveal_identity()` et affaire créée à la révélation | **T18**, T5, T19, TM2, TM3 |
| **5 — Backoffice, pipeline, e-mails** *(mode serré `00` §9)* | D35, D36, `03` R-7 | Migrations `0501` à `0503` ; interrupteur d'urgence ; traitement unitaire et exports (`00` §9) | TM4, TM6, TM8, TM9 |
| **6 — Recette, audit, ouverture** *(livraison mode serré fin oct.)* | Levée des deux vetos ; test d'intrusion (F-9) | Parcours de bout en bout en douze étapes (`18` §7) | Toutes les familles ; restauration répétée |
| **6bis — Rattrapage du mode normal** *(obligatoire sitôt le mode serré livré)* | Aucune (déjà spécifié dans `10`, `12`, `15`) | Reprise intégrale des 4 écarts entre mode normal et mode serré (`00` §9) : (1) recherche à facettes de campagnes côté créateur, (2) alertes automatiques de coordonnées dans la messagerie, (3) actions de masse au backoffice, (4) tableau de bord complet | Tests des facettes créateur, corpus de détection automatique, actions en lot (2V), indicateurs du tableau de bord |

> **✳️ Évolution en fin de MVP — D65 (arbitrage du fondateur du 2026-09-30) :** Intégration de la **connexion OAuth pour YouTube** (vérification directe de la chaîne et relevé automatique des métriques). Pour les autres réseaux (Instagram, TikTok), le challenge de code temporaire en bio reste la méthode de départ au lancement, avec pour trajectoire d'être progressivement remplacé par du OAuth au fur et à mesure des agréments API.

---

## 8. Lot 2 — entrée et jalon actif

**Avant le premier commit du Lot 2** : découpage validé par le fondateur le 2026-11-01 (`archives/jalons/lot2-plan.md`) ; chaque décision de §7 ne bloque que son jalon (questions ouvertes du lot tranchées le 2026-11-01 : D61, D78, D79 ; D34 en hypothèse de `staging` ; revue RGPD au Lot 6) ; fiche du premier jalon dans `jalons/`.

**Reliquat repris des jalons clos** (seule liste à jour ; détail à la ligne citée) :

| # | Correctif attendu | Échéance | Détail |
|---|---|---|---|
| DS-flaky | `t14-backoffice-invitations-route` (« a retry of the same link… ») vu rouge une fois ; aucune occurrence sur les passages de clôture L2A ni sur 5 runs CI. L2D : `brand-profile.spec.ts:169` (run 42243018278, L2DT-1), corrigée par `fix-2` ; `apps/backoffice` `relay-integration.artifacts.ts` T7.3, `EPIPE` intermittent (run 42269804425, vert après `gh run rerun --failed`, sans lien avec le diff), première occurrence ; L2E : `backoffice-queue.spec.ts:82` et `:418` (run 42318390996, L2ET-6), une occurrence ; L2F : `verification-creator.spec.ts:44` (runs 42681708083 et 42816747442, L2FT-1), corrigée par `fix-4` ; `relay-integration.artifacts.ts` T7.3, `EPIPE`, deuxième occurrence (run 42583733529, push `344eea5`, sans `rerun`) ; clôture L2F, passage local 1 : `backoffice-queue.spec.ts:82` et `:422` à nouveau rouges, verts aux deux passages suivants (L2ET-6, deuxième occurrence) | À surveiller | ligne DS de l'archive §5 ; `archives/jalons/l2d/run.md` lignes fix-2, C ; `archives/jalons/l2e-fiche.md` § Revue |
| PLS-2 | T12 : audit des dépendances qui échoue sur critique ou élevée (T12.1), hebdomadaire et CI, dérogations datées (T12.3, T12.4) | Avant production | idem |
| PLT-2 | `/v1/bo/alerts` : refus délibéré 42501 `forbidden` en 401 (cookie effacé, PLS-4) au lieu de 500 ; test db qui désactive le profil entre résolution et appel | Avant production | idem |
| PLT-4 | `run-tests.ts` : ne compter comme fichier qu'un argument existant ou en `.ts` ; `shell: true` sous Windows (= PLS-9) | Plus tard | idem |
| PLT-7 | `ci.yml:305` : commentaire « About 45 s locally » remplacé par la mesure de PL-12 | Plus tard | idem |
| PLS-4 | `/v1/bo/alerts` : 42501 `forbidden` → 401, cookie effacé (côté test : `fix-1`) ; avec PLT-2 | Plus tard | idem |
| PLS-8 | `SECURITY_FILES` : `packages/web-platform/eslint.config.mjs` et `eslint.front-rules.mjs` | Plus tard | idem |
| PLS-9 | = PLT-4 | Plus tard | idem |
| L2AT-2 | Deux des quatre liens soulignés de L2AU-3 (`fix-1`) n'ont aucun cas e2e | Avant production | `archives/jalons/l2a-fiche.md` § Revue |
| L2AT-3 | Liens « retour à l'accueil » de `error.tsx` et `global-error.tsx` encore en `TEXT_BUTTON_CLASSES` (sans signe de lien, WCAG 1.4.1) | Avant production | idem |
| L2AT-5 | Contiguïté des tranches par devise (`price_bands`) à prouver au premier chargement (les trois contraintes sont couvertes depuis L2B-01) | Au chargement des tranches (`price_bands` non chargée sous D78) | `archives/jalons/l2a-fiche.md` § Revue |
| L2AT-6 | Cas L2AU de `member-shell.spec.ts` : une seule combinaison rôle × langue par langue | Plus tard | idem |
| L2AS-1 | `/health` de `apps/web` : le `503` d'un passage limité reste partagé entre requêtes concurrentes | Plus tard | idem |
| L2AS-3 | `fastify` 5.12.6 et `fast-uri` (avis suivis, hors critique et élevée) | Plus tard | idem |
| L2AS-4 | `vitest` 4.1.12 et `zod` porté par `eslint-plugin-react-hooks` (avis suivis) | Plus tard | idem |
| L2BT-4 | Échec de l'autosave de M2 : cas e2e (entrée conservée, nouvelle tentative) | Avant production | idem |
| L2BT-5 | Largeurs de M2 croisées, FR et EN (375, 768, 1440) | Avant production | idem |
| L2BS-4 | Connexion S3 du Storage | Avant production | idem |
| L2BT-6, L2BT-8 | Horloge des tests de quota ; D76 à étendre | Plus tard | idem |
| L2BS-5, L2BS-6, L2BS-9 | `sharp` sans borne de temps ; 2 Mio sur tout le passe-plat ; `fastify` ≥ 5.12.6 | Plus tard | idem |
| L2C-HARNAIS | Deux exécutions superposées de la suite base échouent parfois en 401 : `db-tests/stale-fixtures.ts` désactive tous les agents actifs ; `setLocalRolePasswords` : « tuple concurrently updated » en lancement simultané. Décision : plus tard, une seule suite base à la fois (recommandation `testeur`) | Plus tard | `archives/jalons/l2c/run.md` ligne fix-1 |
| L2D-E2E | **Reste ouvert à la clôture de L2G (2026-11-13) :** F0 (option A, 2026-11-11) : budget révisé, chaque éclat CI ≤ 7 min 30 et le job ≤ 8 min font foi, somme des médianes indicative, cible de 20 s par jalon gardée ; L2G ajoute 30,5 s mesurées pour 19 s annoncées sur machine chargée (15,8 s au repos à la revue), suite entière 507 à 566 s pour 260 cas ; **job base 494 s en CI, 501 s en local, plafond de 8 min dépassé (L2GT-1, fix-5a ignoré par le fondateur, « clos sans la ligne fix-5a »)** : deux éclats à pile propre (`archives/jalons/l2g/fix-5a.md`, choix A) à poser **avant le Lot 3** ; `21` §2.3 non amendé ; CI bloquée par la facturation, éclats non mesurables (`archives/jalons/l2g/run.md` § Mesures de clôture). *Historique :* **Quatrième jalon de suite sous tension, ouvert** : L2F ajoute 19,5 s pour 20 visées (ligne 17 à 0,8 s au-dessus de 6 s, ligne 20 à +1,4 s pour 2 s, marge 0,5 s ; `archives/jalons/l2f/run.md` § Mesures de clôture) ; suite entière 475,6 s pour 254 cas (+10,4 s sur L2E) ; éclats CI 316 / 351 / 309 s ; job base 436 s, **seuil d'alerte 8 min** (L2FT-11). Le levier de L2F (amorce par l'API) est épuisé (gain 1,3 s) : ne pas le rouvrir ; le temps restant est le démarrage des serveurs. Avant L2G : arbitrage du fondateur sur un nouveau levier ou un budget révisé. *Historique :* budget dépassé trois jalons de suite, **accepté explicitement par le fondateur** (L2C, L2D, puis L2E le 2026-11-08 ; aucun plancher baissé). L2E : lignes 18 à 23 cumulent 35,8 s contre 20 s ; `verification.spec.ts` médiane 48,8 s à HEAD ; somme des médianes 465,2 s pour 251 cas contre 366,9 s pour 242 cas à la référence (+98 s ; bruit machine ±40 %) ; éclats CI 361 / 333 / 332 s sous 7 min 30. **Levier nommé pour L2F** : scinder `verification.spec.ts` et préparer les états par l'API plutôt que par les écrans | Avant le Lot 3 (job base) | `archives/jalons/l2e/run.md` § Mesures de clôture |
| EC-L2C-15-1 | Libellés membres tirés de RG9, RG10, absents de RG84 (`status.revisionRefused`, `review.*`, `logo.review.*`, `fieldErrors.emptied`, `statusText.published`, `suspended`) : relus avec les textes D48 (`21` §5.8) | Avant production | `archives/jalons/l2c/run.md` ligne 15 |
| L2C-09 | Rejeu d'une ligne transactionnelle déjà envoyée en défaut : journal `leads.transactional_sends`, `provider_message_id` unique (`0015` l. 83) | Avant production | `archives/jalons/l2c/run.md` ligne 09 |
| CA22 | RG71 (e-mail de correction, `15` RG44, `03` C(7)) reporté au Lot 5 (réponse 1 du fondateur, 2026-11-03) | Avant production | `archives/jalons/l2c-fiche.md` |
| L2CS-4 | `submit_own_advertiser_revision` aux contraintes de la colonne cible (domaine RG17, bornes, secteur actif), 22023 | Plus tard | `archives/jalons/l2c/revue-constats-securite.md` |
| L2CS-5 | Message « Autre » refusé en 400 par le `LINK_PATTERN` de RG158, partagé | Plus tard | idem |
| L2CS-6 | Index d'expression `normalized_brand_name(legal_name)`, `lower(website_domain)` sur `published` | Avant le Lot 3 | idem |
| L2CS-7 | `lead.updated` : dernière ligne en attente par `(subject_key, destination)`, ou plafond par compte | Plus tard | idem |
| EC-L2C-18c-1 | « Page précédente » perdue après rechargement d'une page ≥ 3 (seule « Première page ») | Plus tard | `archives/jalons/l2c/run.md` ligne 18c |
| L2DU-12 à L2DU-15 | Profil créateur, textes : reliquat « Autres » des genres ambigu, « Non renseigné » proposé, amende RG57 (`product-owner`) ; sans vitrine, message contradictoire, n'afficher que titre, notice et retour, aucune promesse de notification tant que rien ne l'envoie (`product-owner`) ; disponibilité : pléonasme « sous moins de 2 semaines » et tranches qui se recouvrent, correction de texte ; « Brouillon » avant L2G, « en cours de saisie » proposé (`product-owner`) | Avant production | `archives/jalons/l2d/ux-constats.md` |
| L2DU-16 | Profil créateur : passages axe `wcag22` à 375 en EN avec lignes et sur l'écran sans vitrine | Avant production | idem |
| L2DU-17, L2DU-18 | Blocs du profil créateur repliables sous lg (ou « Haut de page ») ; cible tactile de 44 px du lien « Modifier dans Mon compte » | Plus tard | idem |
| L2ES-1 | Dépôt de 8 Mio lu avant le contrôle de session (`relay.ts:204-240`, `verification/routes.ts:189-221`) ; limite de débit L2BS-6 | Avant production (limite de débit : Lot 6) | `archives/jalons/l2e-fiche.md` § Revue |
| L2ES-4 | Chiffres observés lisibles par les agents après effacement ; la conformité tranche | Avant production (conformité, Lot 6) | idem |
| L2ES-5 à L2ES-8 | Constats de sécurité mineurs de la revue de fin de L2E (détail non repris dans la fiche) | Plus tard | idem |
| L2ET-3 | Tests concurrents de la file 4 et du quota | Avant production | idem |
| L2ET-4 | E-mail de refus et aperçu du backoffice alignés sur l'écran (suite lue du seul motif, `verification-email.ts` l. 65-82 ; ligne 26 de L2E non lancée) | Avant production | idem |
| L2ET-7 | Constat mineur du testeur à la revue de fin de L2E (détail non repris dans la fiche) | Plus tard | idem |
| L2EU-9 à L2EU-15 | Textes et écrans de la vérification (`ux-constats.md`) : badge d'aperçu « Exemple » (D34), récapitulatif marque, « Ouvrir et prendre en charge », « (nouvel onglet) », pièce en colonne collante dès 1024 px, « Annuler la demande » confirmé, marque d'un pays sans source (`product-owner`) ; L2EU-4 (date de nouvelle demande : contrat et route), date de levée du plafond de 3 refus (migration), page de `06` RG51 | Avant production | `archives/jalons/l2e-fiche.md` § Revue |
| L2EU-16 à L2EU-18 | Backoffice en anglais (D36), aide dans l'espace membre, sources de registre (filtre par pays, confirmation près de la ligne) | Plus tard | idem |
| L2FT-2 | Tâche `badge_lifecycle` jamais exécutée de bout en bout (`periodic.ts:273-283`, `worker.ts:167`) : cas `createPeriodicStore` en base (`tm1-periodic-tasks.test.ts`), sinon preuve sur `staging` par un badge vieilli | Avant production | `archives/jalons/l2f/revue-constats-testeur.md` |
| L2FT-3, L2FS-4 | EC-L2F-08-10 : l'unicité compare `observed_handle_at_decision`, jamais l'identifiant confirmé en file 6 (`0228:169-179`, `0232:1617-1627`, `0233:1279-1286`, alerte `0234:1006-1016`) : `verification.verified_handle_of(badge_id)` pour les quatre, cas base (ancien identifiant repris, nouvel identifiant déclaré par un autre compte) | Avant production | `archives/jalons/l2f/revue-constats-securite.md`, `revue-constats-testeur.md` |
| L2FT-4 | Péremption : un badge juste avant chaque seuil (J-16, 89 j, grâce 29 j) qui reste intact ; `to_reconfirm` à échéance + 29 j et + 30 j (`0230:450-522`, `verification-lifecycle.test.ts:510-606`) | Avant production | `archives/jalons/l2f/revue-constats-testeur.md` |
| L2FS-2 | Second regard de D83 Q3 sans mécanisme avant le Lot 6bis : liste hebdomadaire au backoffice des accords `responsible_agent` ou `agent_opened` (après L2FS-1), revue tracée par un administrateur, patron de PD6 | Avant production | `archives/jalons/l2f/revue-constats-securite.md` |
| L2FS-3 | A-bis : liste des messageries trop courte (`0234:233-242`, `:624-655`) : liste publique maintenue des domaines gratuits et jetables ; `grant_brand_verified_by_login` réservé aux demandes ouvertes par un agent (amende `modele.md` §6, arbitrage du fondateur si refusé) | Avant production | idem |
| L2FS-5 | Autosave du handle d'un compte vérifié : une ligne de registre par changement sous le verrou de chaîne, `stale_token` sans fin (`0233:519-594`, `:873-891`) : limite par compte (L2DS-7 avancé à avant production), registre agrégé sur 10 min, `require_identifier_proof` sans jeton à jour | Avant production | idem |
| L2FT-7 à L2FT-10, L2FS-6 à L2FS-8 | Constats mineurs de la revue de fin de L2F : témoin de T1 structurel ; Apollo à 0 dans `queueOf` ; e2e « adresse de connexion » (D83) ; tâche arrêtée plus de 30 j (`product-owner`) ; droits agent colonne par colonne (files 5 et 6) ; détenteur hors « autre personne » ; dégradé du retrait refusé si un agent peut demander. L2FS-9 (déclencheur de la file 6) : passé « avant production » par L2GS-3 (ligne L2GS-1 à L2GS-4 ci-dessous). L2FT-5, L2FT-6, L2FT-11 : soldés à la ligne C de L2F (`archives/jalons/l2f/run.md`) | Plus tard | `archives/jalons/l2f/revue-constats-testeur.md`, `revue-constats-securite.md` |
| L2GS-1 à L2GS-4, L2FS-9 | Revue de sécurité de fin de L2G : couche I de la file 2 (pseudo, lien, chiffres exacts, valeurs proposées) servie hors détenteur, `closed` compris (`creator-queues-routes.ts:522-532`, `:605-611`) : à `claimed` et `held` seulement, cas T14 ; visuel approuvé sans avoir été affiché (`0244:1542-1599`) : lecture tracée exigée, 55000 `not_displayed`, arbitrage `product-owner` d'abord ; **L2FS-9 échu** (L2GS-3, `0244:991-1005`, `0233:510-517`) : `publish_creator_review_entry()` écrit le handle, le déclencheur de la file 6 doit voir le badge `account_verified` de tout compte (le 42501 prévu casserait la publication), cas base ; autosave d'un profil publié (L2GS-4, `creator/profile.ts:401-405`) : limite par compte (L2DS-7, L2FS-5) étendue aux routes de L2G, `lead.updated` coalescé par compte et destination, marque comprise | Avant production (conditions du verdict : `production` autorisée sous L2GS-1 à 4) | `archives/jalons/l2g/revue-constats-securite.md` |
| L2GT-4 à L2GT-9 | Revue `testeur` de fin de L2G : texte en révision absent de l'aperçu, servi après `approve` (L2G-P3) ; concurrence des portes à verrou (`profiles-creator-concurrency.test.ts`, quatre cas à deux connexions) ; verrou de 30 min et échéances des files 2 et 3 égaux à `business_deadline(…)` ; e2e de l'avis `preview.afterEmpty` (axe FR 375, EN 1 440), EC-L2G-09-3 arbitré par `product-owner` et ses trois tests réécrits ensemble ; libellé RG83 comparé à sa chaîne littérale FR et EN, version conservée avec la déclaration ; CI verte sur `de69db7` et `6f1aeed` (bloquée par la facturation, dérogation du fondateur du 2026-11-12) avant l'attestation `security-reviewed:` et tout merge vers `production` | Avant production | `archives/jalons/l2g/revue-constats-testeur.md` |
| L2GS-8 | Projection publique sans filtre (`public-projection.ts:8-14`, `:105-113`) : la recherche du Lot 3 filtre `published`, `is_searchable` et compte `active` en SQL avant tout appel (cas T1, T15) ; publication refusée (55000) d'un compte non `active` (`0244:503-512`) | Avant le Lot 3 | `archives/jalons/l2g/revue-constats-securite.md` |
| EC-L2G-16 | Hors périmètre de L2G, écrit : correction d'un champ par un agent (`07` RG100), suspension d'un profil créateur (comme CA22), action de masse de la file 3 (aucune au MVP serré) ; recherche et lecture annonceur du portfolio (D82 (7), E1-8) | Lot 5 (RG100, suspension) ; Lot 6bis (action de masse) ; Lot 3 (lecture annonceur) | `archives/jalons/l2g-fiche.md`, `archives/jalons/l2g/modele.md` |
| L2GT-3 | Réserve de clôture : « créateur `published` sur `staging` » et « dix visuels » non tracés, recette validée par le fondateur le 2026-11-12 sans les tracer ; T1.3 et T1.6 « après » au Lot 4 ; R-4, R-5 : revue RGPD au Lot 6 (D79) | Avant production (les deux traces) ; Lot 4 (T1.3) | `archives/jalons/l2g/revue-constats-testeur.md`, `18` §10 Lot 2 |
| L2GT-10 à L2GT-15, L2GS-5 à L2GS-7 | Constats mineurs de la revue de fin de L2G : « échéances neuves » de T9.10 creuse ; plancher `creator-preview-view.test.ts` 18 → 21 ; quotas au passage de minuit UTC ; hôte, jeton et URL interdits dans les lectures d'image de l'agent ; purge réelle d'un objet `portfolio` ; `L2G-U2` nommé, commentaire périmé de `t1-anonymisation.test.ts:456` ; lectures de `influx_creator_profile_definer` restreintes, assertion de fin ; T9.6-O suit les déclencheurs `prosecdef` ; droits agent colonne par colonne (files 2 et 3, comme L2FS-6) | Plus tard (L2GS-5 : avant toute porte neuve de `influx_creator_profile_definer`) | `archives/jalons/l2g/revue-constats-testeur.md`, `revue-constats-securite.md` |
| L2DT-5 | `t1-anonymisation.test.ts:585-600, 624-636` : ville, publications, commentaires, parts exactes en marqueurs distinctifs | Avant production | `archives/jalons/l2d/revue-constats-testeur.md` |
| L2DT-6 | `t1-anonymisation.test.ts:744-757` : balayage du routeur sans session | Avant production | `archives/jalons/l2d/revue-constats-testeur.md` |
| L2DS-3 | T1-R par dépendances, tous schémas (`profiles-creator-identity.test.ts:197-221`, `0217:600-629`) | Avant le Lot 3 | `archives/jalons/l2d/revue-constats-securite.md` |
| L2DS-5 | Aucun `execute` dynamique chez `influx_identity_definer` (`0218:271-376`, `03` l. 896) | Avant le Lot 3 | `archives/jalons/l2d/revue-constats-securite.md` |
| L2DS-4 | Vitrine modérée comme L2C, complétude recalculée à la soumission (`0216:318-322`, `creator/profile.ts:49-53`) | **Soldé à la clôture de L2G (2026-11-13)** : `0243`, ligne 03 (statut et champs modérés gelés en base, complétude recalculée par la base) | `archives/jalons/l2d/revue-constats-securite.md` |
| L2DS-6 | Tranches dérivées figées hors du chemin d'écriture : toute migration de bornes (`audience_bands`, `publication_frequencies`, `comment_bands`) rejoue la reprise de `0218` §8 ; L2G refuse `change_member_role()` hors `draft` (`0218:509-528, 730-733, 356-362`) | À toute migration de bornes de tranches ; `change_member_role()` au L2G *(soldé à la clôture de L2G, `0243`, ligne 03 : 55000 hors `draft` ; reste : toute migration de bornes de tranches)* | `archives/jalons/l2d/revue-constats-securite.md` |
| L2DS-7 | Aucune limite de débit sur les écritures membres : une ligne d'historique par requête, sans borne (`0218:825-831`, `creator/routes.ts:149-165`) | Lot 6 | `archives/jalons/l2d/revue-constats-securite.md` |
| L2DT-7 | `LayerBadge.tsx:231` : ordre de tabulation à `expert-ux`, dépassement en fonction pure testée | Plus tard | `archives/jalons/l2d/revue-constats-testeur.md` |
| L2DT-8 | `tm11-identifying-fields.test.ts:299-312` : exemption prouvée par le nom des cas T14, non par la chaîne `T14.3` | Plus tard | `archives/jalons/l2d/revue-constats-testeur.md` |
| L2DT-9 | Concurrence (`Promise.all` par invariant) dans `profiles-creator-*.test.ts`, crochet « un à la fois » de `use-creator-profile.ts:215-234` | Plus tard | `archives/jalons/l2d/revue-constats-testeur.md` |
| L2DT-10 | `profiles-creator-bands.test.ts:293-301` : bornes 499 999 et 999 999 (abonnés, portée) | Plus tard | `archives/jalons/l2d/revue-constats-testeur.md` |
| CGU | `apps/api/legal/` : « de façon anonyme » (`draft-3.md` l. 32) remplacé par « pseudonymisé » (D79), version nouvelle relue par le juriste | Avant production | `archives/jalons/l2d-fiche.md` § Écarts |

**Plus tard** (sans action au Lot 2) : *avant production* J9T-1, J9S-2, J9S-4, AL53, J4S-8, manques du commit J9-11 et points `expert-ux` du commit J9-5 (`archives/jalons/j9-fiche.md`) ; *Lot 3* T15.2, F3 ; *Lot 5* classement des groupes d'erreurs, J9T-3, J9T-10, J8S-8, J8S-9, RK-16, effacement Apollo, écran des identifiants Brevo (option) ; *Lot 6* F8, J7T-6 ; *Lot 6bis* reports D70 (`archives/jalons/d70-plan.md` l. 125 à 130) ; décisions DZ-1, 2, 4 à 7 (`decisions.md`).

**Jalons** (D77) : le Lot 2 est découpé en L2A à L2G (`archives/jalons/lot2-plan.md`, validé le 2026-11-01), clos le 2026-11-13 ; suite : préalable D78 (`archives/jalons/pre-l3-d78.md`), puis `/lot-decoupe 3`. Un jalon se suit dans `jalons/<id>/run.md` (une ligne par commit) ; ici, une ligne à son ouverture et une à sa clôture.

- **PL** (préparation du Lot 2, corrections K1 et K3 à K10 de `archives/revue-pre-lot2-2026-10-31.md`) : ouvert le 2026-10-31, **clos le 2026-10-31** (critère de fin prouvé, reliquat soldé ou reporté ci-dessus, revue attestée) ; `archives/jalons/pl-fiche.md`, `archives/jalons/pl/run.md`.
- **L2A** (reliquat RK-fin, PLS-1, PLS-3, PLT-6, SNT-3, J4S-7, listes de départ des référentiels, migration `0201`) : ouvert le 2026-11-01, **clos le 2026-11-01** (critère de fin prouvé, reliquat soldé ou reporté ci-dessus, revue attestée) ; `archives/jalons/l2a-fiche.md`, `archives/jalons/l2a/run.md`.
- **L2B** (profil marque : saisie, logo, soumission ; `packages/domain`, Storage en CI, migrations `0202` à `0205`) : ouvert le 2026-11-01, **clos le 2026-11-03** (critère de fin prouvé, reliquat soldé ou reporté ci-dessus, revue attestée, dérive du job « Browser journeys » acceptée par le fondateur) ; `archives/jalons/l2b-fiche.md`, `archives/jalons/l2b/run.md`.
- **L2C** (file 1, modération du profil marque, migrations `0206` à `0214` et `0215`) : ouvert le 2026-11-03, **clos le 2026-11-05** ; `archives/jalons/l2c-fiche.md`, `archives/jalons/l2c/run.md`.
- **L2D** (profil créateur, blocs 1 à 5, T1, TM11, migrations `0216` à `0219`) : ouvert le 2026-11-05, **clos le 2026-11-06** ; un attendu assoupli (`member-shell.spec.ts:193`, EC-L2D-15-1) ; `archives/jalons/l2d-fiche.md`, `archives/jalons/l2d/run.md`.
- **L2E** (propriété, pièces, constat, file 4, T9.6, migrations `0220` à `0227`) : ouvert le 2026-11-07, **clos le 2026-11-08** ; dépassement e2e accepté (L2D-E2E reste ouvert) ; `archives/jalons/l2e-fiche.md`, `archives/jalons/l2e/run.md`.
- **L2F** (péremption, retrait 2V, files 5 et 6, D83, migrations `0228` à `0241`) : ouvert le 2026-11-08, **clos le 2026-11-11** ; critère de fin prouvé, revue attestée (`988388e`, `c07e0b0`), L2D-E2E reste ouvert ; `archives/jalons/l2f-fiche.md`, `archives/jalons/l2f/run.md`.
- **L2G** (portfolio modéré, profil créateur publié, files 2 et 3, clôture du Lot 2, migrations `0242` à `0245`) : ouvert le 2026-11-11, **clos le 2026-11-13** ; critère de fin prouvé en local, réserves L2GT-1 (job base, fix-5a ignoré par le fondateur), L2GT-3 (`staging`, dix visuels) et L2GT-9 (CI bloquée par la facturation, attestation `security-reviewed:` différée) ; `archives/jalons/l2g-fiche.md`, `archives/jalons/l2g/run.md`.
- **L3A** (reliquat avant le Lot 3 : L2D-E2E, L2CS-6, L2GS-8, L2DS-3, L2DS-5, F3 ; skills allégés ; job base en deux éclats) : ouvert le 2026-11-13 ; `jalons/l3a-fiche.md`, `jalons/l3a/run.md`.

**Registre des décisions** (PL-11) : `decisions.md` ne garde que sujet et statut résumés de D1 à D79 ; le texte intégral (sujet, arbitre, statut, échéance, mot pour mot) est dans `decisions-detail.md` (§ Dxx), qui fait foi en cas d'écart.

**Guide de lecture** : session de jalon, sa fiche `jalons/<id>-fiche.md` d'abord (elle cite les tranches utiles) ; jalons clos, `archives/` seulement quand une tâche cite leur identifiant.
