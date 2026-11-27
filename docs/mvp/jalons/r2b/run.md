# Exécution du jalon R2B
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | neon | high | dev-react-node | à faire | SigV4 natif, isObjectKey avant URL, If-None-Match "*", flux borné, `<Code>` seul (D60) ; 6 appels db-tests sur s3-double |
| 02 | 02.md | commit | carbon | high | testeur | fait | CA4–CA7/CA10 via queue(), purge 3 compartiments (`portfolio`, L2GT-13), `decision_blocked` file 4/5, gardes `r2.*`/`x-amz-` + témoin ; planchers +13 |
| 03 | 03.md | commit | carbon | high | dev-react-node | à faire | stagingR2() ; --reupload-images idempotent (412 → skipped), sans GoTrue ni outbox |
| 04 | 04.md | commit | carbon | high | testeur | à faire | 8 specs + recette sur :4111 ; CA5 LogoPlate ; /_double/delete + R2AS-5/R2AT-2 ; e2e ≤ +3 s, 3 passes |
| 05 | 05.md | commit | carbon | medium | integrateur | à faire | Après push 01–04 + Railway SUCCESS : staging:check, 2 passages --reupload-images, lectures, purge, storage.objects intact |
| F1 | F1.md | fondateur | — | — | fondateur | à faire | Accord avant R2C (vidage Supabase Storage irréversible) |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | testeur : carbon · high ; expert-cybersecurite : neon · xhigh |
| C | cloture.md | cloture | hydrogen | high | testeur | à faire | Clôture documentaire, cases annexe, archivage R2B (carbon si blocage) |
