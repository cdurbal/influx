# RUB-fix-9 — `test(kit): the raw request reads the 413 even when the relay closes during the upload`
Grille `integrateur`. RUBT-5 (classé jalon ; test antérieur à RUB, D82 : gardé car la clôture exige une CI verte).
**Lire :** annexe § Revue (RUBT-5) ; `packages/test-kit/src/relay-integration.ts` l. 155-210 (`rawRequest`), 548-600
(T7.3) ; `packages/web-platform/src/server/relay.ts` l. 117-123, 214, 322 ; `gh run view 45980239751 --log-failed`,
idem 45986965761.
**Constat :** « 8 MiB + 1 », `write EPIPE` l. 195, vert à la 2e tentative (web, backoffice). Cause probable : le relais
répond 413 et ferme pendant l'écriture ; `outgoing.on("error", reject)` rejette avant la lecture de la réponse.
**Livrer :**
- `rawRequest` : écriture par blocs avec `drain`, arrêt dès la réponse ; une erreur d'écriture (`EPIPE`, `ECONNRESET`)
  ne rejette que si aucune réponse n'arrive. Exigence du 413 et de son enveloppe entière.
- Constater sans commit : Chromium (`fetch` PUT de 8 MiB + 1 vers le relais du front construit) lit-il le 413 ou une
  erreur réseau ? Résultat dans le message ; erreur réseau = constat pour `architecte`, rien d'autre corrigé.
**Ne pas toucher :** `relay.ts`, code produit, assertions de T7.3. **R2B, non commités :**
`packages/test-kit/src/s3-double.ts`, `tests/case-floors.ts`, `tests/s3-double.test.ts`, `apps/web/e2e/*` : ni
modifiés ni stagés ; `git add` de vos seuls chemins, puis `git diff --cached --name-only`.
**Prouver :** auto-test dans `packages/test-kit/tests/artifacts.test.ts` : serveur local qui répond 413 puis détruit la
socket pendant l'envoi de 8 MiB + 1 ; rouge avant (`EPIPE`, `ECONNRESET`), vert après, dix exécutions. Plancher
relevé seulement si R2B a commité `tests/case-floors.ts` (sinon : le dire). `pnpm check:fast` ;
`pnpm --filter @influx/test-kit test`.
**Arrêt si :** l'auto-test ne reproduit pas l'échec (trace à l'appui) ; il faudrait toucher un fichier de R2B.
