# Plan et stratégie de développement — du socle au premier usage

> **Date :** 2026-09-25 (allégé le 2026-09-29, puis le 2026-10-31 à l'ouverture du Lot 2) · **Rédigé par :** Claude Code, à la demande du fondateur
> **Public :** le développeur (ou l'agent `dev-react-node`) qui construit le produit réel sur `main`.
> **Statut :** feuille de route active. **Les journaux des jalons clos sont archivés** : J0 à J3 dans `archives/21-journal-j0-j3-archive.md`, J4 dans `archives/21-journal-j4-archive.md`, écarts `EC-*`, J5 à J9 et jalons extra DS, SN, RK dans `archives/21-journal-lot1-archive.md` (§3, §4 et §5 d'origine), fiches dans `archives/jalons/`. **Les agents IA ne lisent pas ces archives par défaut.**
> **Ce document ne remplace aucune spécification.** En cas d'écart, `CLAUDE.md` puis `docs/mvp/00` à `20` font foi.

---

## 0. L'essentiel

| Lot ou jalon | État au 2026-10-31 |
|---|---|
| **Lot 0** — socle (J0 à J4) | ✅ Clos le 2026-10-07 |
| **Lot 1** — inscription et leads (J5 à J9) | ✅ Clos le 2026-10-27 sur `staging` ; production préparée, non créée (portes §5.8, J9T-1) |
| Hors jalon — suppression de compte en libre-service (D72) | ✅ Livré (`0150`) |
| Extras **DS** (D73), **SN** (D74), **RK** (D75) | ✅ Clos les 2026-10-29, 2026-10-30 et 2026-10-30 ; reliquat RK au §8 |
| **Lot 2** — profils, réseaux, badge | Découpé en sept jalons L2A à L2G (`jalons/lot2-plan.md`, validé le 2026-11-01) ; L2A à préparer |

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

**Avant le premier commit du Lot 2** : découpage validé par le fondateur le 2026-11-01 (`jalons/lot2-plan.md`) ; chaque décision de §7 ne bloque que son jalon (questions ouvertes du lot tranchées le 2026-11-01 : D61, D78, D79 ; D34 en hypothèse de `staging` ; revue RGPD au Lot 6) ; fiche du premier jalon dans `jalons/`.

**Reliquat repris des jalons clos** (seule liste à jour ; détail à la ligne citée) :

| # | Correctif attendu | Échéance | Détail |
|---|---|---|---|
| DS-flaky | `t14-backoffice-invitations-route` (« a retry of the same link… ») vu rouge une fois ; aucune occurrence sur les passages de clôture L2A (suite base, puis deux passages du fichier) ni sur 5 runs CI | À surveiller | ligne DS de l'archive §5 |
| PLS-2 | T12 : audit des dépendances qui échoue sur critique ou élevée (T12.1), hebdomadaire et CI, dérogations datées (T12.3, T12.4) | Avant production | idem |
| PLT-2 | `/v1/bo/alerts` : refus délibéré 42501 `forbidden` en 401 (cookie effacé, PLS-4) au lieu de 500 ; test db qui désactive le profil entre résolution et appel | Avant production | idem |
| PLT-5 | Fonction 2V de `0141` (EC-PL-04a-1) : migration `@.value.type() != "string"`, test db « payload 2V refusé à la création » ; avec PLS-5 et PLS-6 | Avant production | idem |
| PLT-4 | `run-tests.ts` : ne compter comme fichier qu'un argument existant ou en `.ts` ; `shell: true` sous Windows (= PLS-9) | Plus tard | idem |
| PLT-7 | `ci.yml:305` : commentaire « About 45 s locally » remplacé par la mesure de PL-12 | Plus tard | idem |
| PLS-4 | `/v1/bo/alerts` : 42501 `forbidden` → 401, cookie effacé (côté test : `fix-1`) ; avec PLT-2 | Plus tard | idem |
| PLS-5 | `@.value.type() != "string"` dans la prochaine migration de la fonction 2V (= PLT-5) | Plus tard | idem |
| PLS-6 | `0151` : faille lax de `brevo_list_ids` et `brevo_template_ids`, même migration que PLT-5 | Plus tard | idem |
| PLS-7 | « Santé technique » : mention « source navigateur, texte non vérifié » sur la pile et la page | Plus tard | idem |
| PLS-8 | `SECURITY_FILES` : `packages/web-platform/eslint.config.mjs` et `eslint.front-rules.mjs` | Plus tard | idem |
| PLS-9 | = PLT-4 | Plus tard | idem |
| L2AT-2 | Deux des quatre liens soulignés de L2AU-3 (`fix-1`) n'ont aucun cas e2e | Avant production | `archives/jalons/l2a-fiche.md` § Revue |
| L2AT-3 | Liens « retour à l'accueil » de `error.tsx` et `global-error.tsx` encore en `TEXT_BUTTON_CLASSES` (sans signe de lien, WCAG 1.4.1) | Avant production | idem |
| L2AT-5 | Contiguïté des tranches par devise (`price_bands`) à prouver au premier chargement (les trois contraintes sont couvertes depuis L2B-01) | Plus tard (L2D ou L2E, avec le chargement) | `archives/jalons/l2a-fiche.md` § Revue |
| L2AT-6 | Cas L2AU de `member-shell.spec.ts` : une seule combinaison rôle × langue par langue | Plus tard | idem |
| L2AS-1 | `/health` de `apps/web` : le `503` d'un passage limité reste partagé entre requêtes concurrentes | Plus tard | idem |
| L2AS-3 | `fastify` 5.12.6 et `fast-uri` (avis suivis, hors critique et élevée) | Plus tard | idem |
| L2AS-4 | `vitest` 4.1.12 et `zod` porté par `eslint-plugin-react-hooks` (avis suivis) | Plus tard | idem |
| L2BT-3 | Double soumission simultanée du profil marque (deux `POST submit` concurrents) : cas db | Avant production | `archives/jalons/l2b/revue.md` |
| L2BT-4 | Échec de l'autosave de M2 : cas e2e (entrée conservée, nouvelle tentative) | Avant production | idem |
| L2BT-5 | Largeurs de M2 croisées, FR et EN (375, 768, 1440) | Avant production | idem |
| L2BS-1 | Gel de `published`/`suspended` en base (L2C) | Avant production | idem |
| L2BS-4 | Connexion S3 du Storage | Avant production | idem |
| L2BT-6 à L2BT-8 | Horloge des tests de quota ; cas `legal_name` et `country` de la soumission ; D76 à étendre | Plus tard | idem |
| L2BS-5 à L2BS-9 | `sharp` sans borne de temps ; 2 Mio sur tout le passe-plat ; lecture des coordonnées non journalisée (L2C) ; IDN homographes ; `fastify` ≥ 5.12.6 | Plus tard | idem |
| L2B-CI | Job « Browser journeys » : 359 s avant Storage, 429 à 481 s après (dispersion ≈ 50 s), borne 480 s (§2.3) dépassée une fois à `b5053ab` ; dérive acceptée par le fondateur le 2026-11-03, sans levier de CI ; borne sous surveillance, élargissement non décidé | Surveillance | `archives/jalons/l2b/run.md` ligne 03 |

**Plus tard** (sans action au Lot 2) : *avant production* J9T-1, J9S-2, J9S-4, AL53, J4S-8, manques du commit J9-11 et points `expert-ux` du commit J9-5 (`archives/jalons/j9-fiche.md`) ; *Lot 3* T15.2, F3 ; *Lot 5* classement des groupes d'erreurs, J9T-3, J9T-10, J8S-8, J8S-9, RK-16, effacement Apollo, écran des identifiants Brevo (option) ; *Lot 6* F8, J7T-6 ; *Lot 6bis* reports D70 (`archives/jalons/d70-plan.md` l. 125 à 130) ; décisions DZ-1, 2, 4 à 7 (`decisions.md`).

**Jalons** (D77) : le Lot 2 est découpé en L2A à L2G (`jalons/lot2-plan.md`, validé le 2026-11-01) ; suivant : `/jalon-prepare L2A`. Un jalon se suit dans `jalons/<id>/run.md` (une ligne par commit) ; ici, une ligne à son ouverture et une à sa clôture.

- **PL** (préparation du Lot 2, corrections K1 et K3 à K10 de `archives/revue-pre-lot2-2026-10-31.md`) : ouvert le 2026-10-31, **clos le 2026-10-31** (critère de fin prouvé, reliquat soldé ou reporté ci-dessus, revue attestée) ; `archives/jalons/pl-fiche.md`, `archives/jalons/pl/run.md`.
- **L2A** (reliquat RK-fin, PLS-1, PLS-3, PLT-6, SNT-3, J4S-7, listes de départ des référentiels, migration `0201`) : ouvert le 2026-11-01, **clos le 2026-11-01** (critère de fin prouvé, reliquat soldé ou reporté ci-dessus, revue attestée) ; `archives/jalons/l2a-fiche.md`, `archives/jalons/l2a/run.md`.
- **L2B** (profil marque : saisie, logo, soumission ; `packages/domain`, Storage en CI, migrations `0202` à `0205`) : ouvert le 2026-11-01, **clos le 2026-11-03** (critère de fin prouvé, reliquat soldé ou reporté ci-dessus, revue attestée, dérive du job « Browser journeys » acceptée par le fondateur) ; `archives/jalons/l2b-fiche.md`, `archives/jalons/l2b/run.md`.
- **L2C** (file 1 : un commercial valide ou refuse un profil marque ; reliquat PLK-1, PLS-7, L2BS-1, L2BS-7, L2BS-8, L2BT-3, L2BT-7) : ouvert le 2026-11-03 ; `jalons/l2c-fiche.md`, `jalons/l2c/run.md`.

**Registre des décisions** (PL-11) : `decisions.md` ne garde que sujet et statut résumés de D1 à D79 ; le texte intégral (sujet, arbitre, statut, échéance, mot pour mot) est dans `decisions-detail.md` (§ Dxx), qui fait foi en cas d'écart.

**Guide de lecture** : session de jalon, sa fiche `jalons/<id>-fiche.md` d'abord (elle cite les tranches utiles) ; jalons clos, `archives/` seulement quand une tâche cite leur identifiant.
