# Prompts de session du J9

> Pour le fondateur : un prompt par commit de `j9-fiche.md`, à coller dans une **session neuve**
> (`/clear` d'abord), avec le niveau d'effort indiqué (`/effort <niveau>`). Les agents de code ne
> lisent pas ce fichier : la fiche suffit. Chaque prompt se termine de la même façon (fin commune).

**Fin commune** (incluse dans chaque prompt par la phrase « Fin commune J9 ») : suite complète
(`pnpm typecheck`, `pnpm lint`, `pnpm test -- --reporter=dot`,
`pnpm --filter @influx/api test:db -- --reporter=dot`) ; commit Conventional en anglais ; puis
commit `docs(j9): record commit N (…)` : 1 ligne `[x] Commit N (\`sha\`) — …` dans `21` §J9, section
« Issu du commit N » de la fiche (5 lignes au plus) si un arbitrage a eu lieu, planchers relevés ;
push sur `main` ; suivre la CI (`gh run watch <id> --exit-status`) et corriger jusqu'au vert.

| Commit | Effort | Pourquoi ce niveau |
|---|---|---|
| 1 | `high` | RLS et fraîcheur R : sécurité en base, tests T2 |
| 2 | `high` | Cinq tickets backoffice, 2V, recherche hors URL |
| 3 | `xhigh` | GoTrue, purge destructive, session membre : erreurs coûteuses |
| 4 | `high` | Nonce Next.js sur deux fronts, levée de G2 |
| 5 | `medium` | Mécanique (retraits, gardes d'absence, liens) |
| 6 | `low` | Désactivation du bandeau, un commit court |
| 7 | `high` | T7 / T13 / T15 / T11 : couverture large |
| 8 | `xhigh` | Le plus gros : battement, sonde, alertes hors file, migration |
| 9 | `medium` | Un écran en lecture sur une API simple |
| 10 | `high` | Tests de fin, cas limites, planchers |
| 11 | `medium` | Documentation et configuration, aucun déploiement |
| Clôture | `high` | Revue groupée sécurité + tests, alignement des specs |

---

## Commit 1 — `high`

```
Jalon J9, commit 1. Lis docs/mvp/jalons/j9-fiche.md (sections « Commits prévus » point 1,
« Tickets », « Discipline de session ») et uniquement les tranches qu'elle cite pour ce commit.
Délègue à expert-database la migration 0139 : J8S-3 (assert_fresh_second_factor lié à la session
de la requête via request.jwt.claims → session_id, posé par apps/api/src/db/index.ts), J8S-5
(politique RLS de member_invitations : admin ou auteur, T2 étendu), fonction de lecture 7 jours
de account.role_granted pour J8S-4 (même forme que new_browser_sign_ins()), F4 (index
audit_events.actor_account_id). Lis 0130, 0131 et le test de new_browser_sign_ins par Grep avant
Read. Tests en base d'abord, puis l'API qui pose session_id. Nouveaux fichiers db-tests dans
case-floors.ts. Fin commune J9 (docs/mvp/jalons/j9-prompts.md).
```

## Commit 2 — `high`

```
Jalon J9, commit 2. Lis docs/mvp/jalons/j9-fiche.md (point 2, Tickets, EC applicables) et le
skill backoffice-ops. Livre : J8S-1 (GET /v1/bo/dual-control/degraded, admin, schémas zod dans
packages/contracts, bloc hebdomadaire sur apps/backoffice/src/app/accueil d'après
degradedConfirmationsByWeek) ; J8S-2 (portée exacte à la confirmation 2V dans
DualControlScreens.tsx ~l. 114 : compte visé pour invite_admin et approve_data_request, jamais un
UUID seul) ; J8S-4 (bloc d'accueil « rôle admin attribué » sur la fonction du commit 1) ; J8S-6
(seau backoffice_reauth_ip 60/h dans throttle-keys.ts, distinct de la connexion) ; J8S-7
(recherches exacte et partielle en POST, terme dans le corps, jamais dans l'URL ni les journaux)
et J8T-7 (e2e recherche exacte + filtres de période). T14 sur chaque nouvelle route. Fin commune
J9 (docs/mvp/jalons/j9-prompts.md).
```

## Commit 3 — `xhigh`

```
Jalon J9, commit 3. Lis docs/mvp/jalons/j9-fiche.md (point 3, Tickets). Retrouve le texte exact
de C5.c, A2, J7S-1, J7S-2, J7S-3 par Grep dans 21 et dans
`git show 5b977f7:docs/mvp/jalons/j7-fiche.md`, sans lire ces documents en entier. Livre :
C5.c (orphelin GoTrue de la nouvelle adresse supprimé puis nouvel essai) ; A2 (code de la
nouvelle adresse compté sur RG44) ; J7S-1 (withMemberSession pose influx.session,
consume_member_reauthentication l'exige ; migration par expert-database si nécessaire) ; J7S-2
(disjoncteur de la purge GoTrue : 55000 si identity.accounts paraît vide, abandon si plus de 50 %
d'une page de plus de 20, journalisé) ; J7S-3 (webhook Brevo 404 hors surface web, test, puis
03 A4 réaligné). Pour chaque ticket, écris d'abord le test qui échoue. Fin commune J9
(docs/mvp/jalons/j9-prompts.md).
```

## Commit 4 — `high`

```
Jalon J9, commit 4. Lis docs/mvp/jalons/j9-fiche.md (point 4, EC-J9-1), puis 03 §6.5 et 18 T10
et §5 aux lignes citées. CSP à nonce par requête : nonce posé par apps/web/src/proxy.ts et par un
proxy.ts à créer dans apps/backoffice, valeurs exactes de 03 §6.5, aucun 'unsafe-inline' en
script-src (en style-src seulement si Next l'impose, avec une note écrite) ; J3S-7 (backoffice
img-src 'self' blob:, sans hôte Supabase) ; partir de securityHeadersFor dans les deux
next.config.ts. Dans le même commit, lève G2 de apps/web/tests/guards.test.ts et remplace-la par
la garde resserrée (aucune URL littérale hors src/config/ et src/locales/). Tests T10 sur le build
de production (next build + next start), pas sur le serveur de dev. Vérifie que la landing et
l'inscription s'affichent sans violation CSP dans la console. Fin commune J9
(docs/mvp/jalons/j9-prompts.md).
```

## Commit 5 — `medium`

```
Jalon J9, commit 5. Lis docs/mvp/jalons/j9-fiche.md (point 5, EC-15, EC-J9-2), 02 §13 et 18 §5
aux lignes citées, et landing-page/01 §6.1 (procédure de retrait). Skill design-system-influx.
Un seul commit : supprime src/content/placeholders/, IS_MOCKUP et MockupBanner.tsx (typecheck
liste les usages) ; G4 ⇒ garde d'absence d'image hors manifeste de marque ; G6 et annexe 3 ⇒
garde d'absence du module, de la constante et du bandeau ; G1 resserrée par liste blanche de
fichiers nommés ; action/formAction levés dans ESLint ; AudienceDoors et boutons de la landing
branchés sur /fr/inscription/marque · /en/signup/brand (et créateur) par le lien localisé
next-intl ; section formulaire remplacée par un renvoi vers les deux portes ; pied de page légal
actif. Aucun texte nouveau sans clé FR et EN. Fin commune J9 (docs/mvp/jalons/j9-prompts.md).
```

## Commit 6 — `low`

```
Jalon J9, commit 6. Lis docs/mvp/jalons/j9-fiche.md (point 6, EC-J9-3) et landing-page/11 §8 aux
lignes citées. Refais l'inventaire des traceurs (Grep sur apps/web/src : scripts tiers, pixels,
mesure d'audience) ; s'il est vide, désactive globalement le bandeau cookies, garde le lien
« Cookies » du pied de page, laisse cookie-consent.ts en mémoire et la garde D37 intacte. Si un
traceur apparaît, arrête-toi et signale-le. Fin commune J9 (docs/mvp/jalons/j9-prompts.md).
```

## Commit 7 — `high`

```
Jalon J9, commit 7. Lis docs/mvp/jalons/j9-fiche.md (point 7) et 18 T7, T11, T13, T15, puis 03
§6.4 aux lignes citées. Fais d'abord l'inventaire de ce qui est déjà couvert (Grep des
identifiants T7.x, T13.x, T15.x dans les tests) et ne complète que les manques : T7 complet en
intégration (passe-plat, empreinte des quatre fichiers identique dans les deux fronts), T13
(aucune erreur détaillée vers le client, apps/api et fronts), T15 (débit sur chaque route
publique, 429 homogène), T11 (analyse des artefacts des trois builds). J4S-6 : client-errors en
texte strict, plafond de nouveaux groupes navigateur par compte et par heure, aucune alerte
« nouveau groupe » déclenchée par le seul navigateur. Fin commune J9
(docs/mvp/jalons/j9-prompts.md).
```

## Commit 8 — `xhigh`

```
Jalon J9, commit 8. Lis docs/mvp/jalons/j9-fiche.md (point 8, EC-22, EC-J9-4), puis 02 §11.3,
§20.4 à §20.8 et 15 §F + RG126 aux lignes citées. D'abord, délègue à product-owner un additif
court de 15 §F numérotant les alertes techniques à partir d'AL49 (site injoignable, worker
arrêté, nouvelle erreur / régression, 5xx, lenteur API, lenteur des pages, pic d'appels, 429,
saturation service et base, member_code_targeted, gotrue_realign_failed, webhook.brevo.ignored,
ip_drift, « exécutée non close 24 h »). Puis expert-database : 0140 (battement du worker,
résultats de sonde, lignes alert_definitions, purges). Puis le code : battement du worker ;
sonde chaque minute (accueils FR/EN par l'adresse publique, connexion backoffice, /health de
l'API en réseau privé) ; l'API surveille le battement (60 s, une instance sous verrou
consultatif) ; alertes de disponibilité directes vers Brevo via critical-alert.ts, jamais par
outbox_events, destinataires en base et en variable d'environnement (skill env-secrets) ;
déduplication 30 min + e-mail « rétabli » ; seuils en base ; liste blanche en staging (02 §12.4).
EC-22 : apps/web src/app/health/route.ts (200/503 à corps vide, hors matcher, ajoutée à la liste
blanche G5). Rien du 02 §20.8 dans ops ni dans un journal. Fin commune J9
(docs/mvp/jalons/j9-prompts.md).
```

## Commit 9 — `medium`

```
Jalon J9, commit 9. Lis docs/mvp/jalons/j9-fiche.md (point 9, EC-J9-5) et 02 §20.5 « Écran
Santé technique » aux lignes citées. Skills backoffice-ops et design-system-influx. Écran admin
seul, poste de travail, lecture seule : disponibilité de la sonde, groupes d'erreurs (new,
acknowledged, fixed, ignored, régression) et occurrences, appels par minute, p95 et taux
d'erreur par route (histogrammes agrégés à la lecture, jamais un p95 par instance), santé des
processus, connexions à la base, état du worker ; lien « état des services » depuis les files.
Route /v1/bo/ops/* avec schémas zod de réponse et T14. Libellés dans src/messages/fr.ts. Tokens
seulement. Fin commune J9 (docs/mvp/jalons/j9-prompts.md).
```

## Commit 10 — `high`

```
Jalon J9, commit 10. Lis docs/mvp/jalons/j9-fiche.md (point 10, Tickets) et 18 §10 « Lot 1 » aux
lignes citées. Playwright : landing ⇒ vraie inscription FR et EN, en-têtes T10 sur next start,
J8T-4 (axe sur liste, fiche, Apollo, 2V, invitations, santé technique). Base : J8T-2 (CA62,
requête AL25 destination_down / quota_exceeded, repository.ts ~l. 1310), J8T-3 (CA58, relis
d'abord tm1-brevo-connector et tm1-apollo-connector, n'ajoute que le manque), J8T-5 (overCap du
ReplayPanel), demandes testeur de 02 §20.12 (avalanche d'erreurs sans saturation, histogrammes
entre instances, worker arrêté ⇒ alerte par l'API, alerte sans la base). J8T-6 : planchers figés
pour tous les paquets. Rappel J8T-8 : l'e2e de 2V dégradée jamais en parallèle. Fin commune J9
(docs/mvp/jalons/j9-prompts.md).
```

## Commit 11 — `medium`

```
Jalon J9, commit 11. Lis docs/mvp/jalons/j9-fiche.md (point 11, EC-62, EC-J9-6), 21 §5.8, 02
§12 et §19, runbooks/staging.md (structure et procédure de retour arrière). Délègue à
integrateur (skill railway-deploy) : runbooks/production.md (projet Supabase UE avec PITR D57,
quatre services, variables par service, trois sous-domaines DNS, retour à la version précédente,
abonnement aux pages d'état Railway / Supabase / Brevo, rodage de 30 jours de 02 §20.7) et les
configurations deploy/railway/*.json pour production. Ajoute aux runbooks : « admin
indisponible » (J8S-9), invitation interne transmise hors e-mail et révocation
suspected_compromise, publication des CGU sous libellé définitif (action du fondateur), liste
des relectures humaines de 18 §10 « Lot 1 ». Aucune création de projet, de service ni de
déploiement : documentation et configuration seulement. Fin commune J9
(docs/mvp/jalons/j9-prompts.md).
```

## Clôture — `high`

```
Clôture du jalon J9. Lis docs/mvp/jalons/j9-fiche.md en entier (c'est la seule lecture
complète). Revue groupée de fin de jalon : expert-cybersecurite (en-têtes et CSP, collecteur,
/health, accès à l'écran Santé technique, seuils 429 et request-code, cookies) et testeur
(18 §10 « Lot 1 », planchers), en parallèle. Corrige les points bloquants, puis commit
d'attestation security-reviewed: <date> covers <sha>… (jamais de réécriture de main). Aligne :
additifs 15 et 17b (EC-J9-4, EC-J9-5), 18 §10 « Lot 1 » coché, 21 §J9 condensé (1 ligne par
commit + clôture + reportés), pnpm docs:index. Réduis la fiche au reliquat du Lot 2 sur le
modèle de la fiche J8 réduite (git show 7d7fd24:docs/mvp/jalons/j8-fiche.md). Liste-moi ce qui
reste à faire de mon côté avant la mise en production (21 §5.8). Fin commune J9
(docs/mvp/jalons/j9-prompts.md).
```
