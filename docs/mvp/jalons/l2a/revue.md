# Revue de fin du jalon L2A

Constats seulement : aucun fichier modifié hors constats. **Plage :** parent du commit d'ouverture
`..HEAD`, diff fichier par fichier. **Format :** `L2AT-n` ou `L2AS-n`, gravité (bloquant · à corriger
dans le jalon · avant production · plus tard), fichier:ligne, correctif en une phrase ; table courte en
fiche § Revue, détail dans `l2a/revue-constats.md`.

## Pour `testeur`

- Aucun attendu affaibli : diff de `journey-resume.spec.ts` limité aux attentes et à l'horloge (04) ;
  aucun `retries`, `waitForTimeout` ni délai relevé ; planchers jamais baissés.
- 04 : méthode et gain (trois invocations avant et après) ; l'horloge ne masque aucun comportement réel
  (plancher serveur de 1 s par code intact, abandon toujours déclenché par le délai).
- 06 : cas vus rouges par mutation (R4) ; un cas par page et par langue ; vitrine intacte ; ajout
  ≤ 8 s.
- 05 : les cas couvrent l'échéance au règlement, la levée synchrone et le 429, horloge injectée.
- 07 : la garde mord (cas négatif) et couvre les deux fronts.
- 09 : tranches contiguës prouvées par la base ; valeurs comparées à D79, RG114, RG115 ; T2.7 sans
  entrée superflue ; T16.5 voit `price_bands`.
- 01 : dix lignes de `18` §12.7 tirées au hasard rapprochées de leur test.
- DS-flaky (`t14-backoffice-invitations-route`) : occurrences sur les passages du jalon.

## Pour `expert-cybersecurite`

- 03 : diff du lockfile limité aux paquets visés ; `overrides` éventuels exacts et commentés ; aucun
  paquet `@supabase/*` interdit ; `pnpm audit --prod --audit-level high` exit 0.
- 09 : `0201` : RLS activée et forcée, politiques avec contexte (membres) et aal2 (internes), aucun
  `GRANT` d'écriture, `REVOKE` de `price_bands` à tous les rôles d'exécution, rien à `PUBLIC`, `anon`,
  `authenticated`, `service_role` ; aucune fonction `SECURITY DEFINER` ; T2.4 et T2.7 verts.
- 05 : aucun état partagé entre instances ; `/health` n'en dit pas plus ; un 429 d'une adresse ne
  devient plus un 503 pour tous.
- 07 : la garde empêche un nom ou un pseudo d'atteindre `ops` par le champ `page` (D60).
- Puis le texte du commit d'attestation `security-reviewed: <date> covers <sha de 03> <sha de 09>`
  (D71), à commiter en clôture si rien de bloquant ne reste.
