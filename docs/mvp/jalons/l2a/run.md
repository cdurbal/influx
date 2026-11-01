# Exécution du jalon L2A

| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | high | testeur | fait | RK-fin (R3) : 12 lignes ajoutées à `18` §12.7 (83 à 95), 73 identifiants relus, aucun manquant ; 10 captures logo masqué dans `apps/web/test-results/logo-test/` (non indexées) |
| 02 | 02.md | ux | sonnet | high | expert-ux | fait | RK-fin, test du logo ; sans commit. 10 captures lues : Spotify en premier sur `connexion` seule (pilule lumineuse + halo, sans signature INFLUX) ; parades tenues 10/10 ; L2AU-1 à L2AU-4 dans la fiche § Revue ; renforts additifs, aucun retrait d'effet (F6) : pas d'arrêt `fondateur`. Test à deux personnes extérieures à faire à la recette |
| 03 | 03.md | commit | sonnet | high | dev-react-node | fait | PLS-1 : `next` 16.4.3, `zod` 4.6.6 (épinglés exacts) ; `pnpm audit --prod --audit-level high` exit 0 (sharp 0.35.5 par la montée, `source-map-js` 1.2.2 par `overrides`, EC-L2A-03-1) ; `pnpm check` rouge sur un seul cas base préexistant (`tm9-ops-monitoring` AL63, identique sans le commit), e2e 214/214 en 3,5 min ; I-4 |
| 04 | 04.md | commit | sonnet | high | testeur | fait | abandon seul sur `page.clock` (installée avant `open()`, réponse retenue puis `fastForward(3 500)`), assertions inchangées ; cumul des 7 cas : avant 28,4 s (28,5 / 28,4 / 28,3), après 24,8 s (24,7 / 24,8 / 24,8), gain 3,6 s ; abandon 5,9 -> 2,5 s ; compte à rebours inchangé (10 s réelles) ; spec verte 5 invocations |
| 05 | 05.md | commit | sonnet | high | dev-react-node | fait | PLS-3, PLT-6 : fenêtre ouverte au règlement, `pending` partagé jusqu au règlement, levée synchrone rattrapée, 429 (`throttled`) jamais gardé -> 503 ce passage, amont au suivant ; `/health` reste 200/503 corps vide `no-store` ; 4 cas neufs status-cache (3 -> 7) + 1 relay (76 -> 77, ancien cas 429 gardé passé en 500 : le 429 gardé est le défaut corrigé) |
| 06 | 06.md | commit | sonnet | high | testeur | fait | SNT-3 : 4 cas e2e (`landing-navigation`, menu et liens de marque, fr/en, largeurs en boucle) + 5 cas unitaires (`brand-links`, `error.tsx` et `global-error.tsx`) ; cumul médian des 4 cas 7,9 s sur 5 invocations (7,7 / 7,9 / 7,9 / 7,7 / 8,1) ; 9 mutations vues rouges (R4) ; aucune entrée ne manque sa section, vitrine intacte ; planchers e2e 4 et web 5 |
| 07 | 07.md | commit | sonnet | high | dev-react-node | à faire | J4S-7 |
| 08 | 08.md | arbitrage | opus | xhigh | expert-matching | à faire | listes de départ des référentiels ; validées par le fondateur à la relecture (réponse 1) |
| 09 | 09.md | commit | opus | high | expert-database | à faire | `0201` ; I-4 ; suite base complète |
| 10 | fix-1.md | fix | opus | high | dev-react-node | à faire | logo test L2AU-1 à L2AU-3 ; ajouté à la demande du fondateur |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
