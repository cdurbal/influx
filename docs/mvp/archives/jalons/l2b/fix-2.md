# L2B-fix-2 — `docs(mvp): 03 and 18 aligned with D80 and the definer roles of L2B`
Grille `expert-cybersecurite` (signé à sa revue du 2026-11-03). Constats L2BS-2, L2BS-3 : fiche
§ Revue. Documentation.
**Lire :** `03` l. 836-871 (E, motifs), 873-910 (rôles), 1064-1087 (P10), 1398 (PP-9),
1520-1539 (§6.6) ; `18` l. 643-663 (T9) ; `decisions-detail.md` (`Grep "^## D80 "` -A 6) ;
`l2b/stockage.md` §3, §4, l. 99-104 ; `0117` l. 50-75 ; `0205` l. 60-110, 340-350 ;
`web-platform/src/server/relay.ts` l. 36.
**Livrer :**
- L2BS-2 : `influx_maintenance_definer` aux rôles « créés plus tard » (l. 901-910) : `0117`
  (création, E-4), `0148` (lectures de l. 848-855), `0205` (colonnes nommées de
  `profiles.brand_logo_objects` en `select`, `update`, `delete` ; `storage_daily_usage` en `select
  (usage_day)`, `delete` ; jamais une ligne `active` ; `ops.claim_storage_purges`,
  `complete_storage_purges`, `purge_storage_usage`, `EXECUTE` à `influx_worker` seul) ; motif
  `storage_purge` dans l'opération d'E-4 (l. 841) ; la ligne neuve et l. 894 (« à signer » ôté)
  disent « signé par `expert-cybersecurite` le 2026-11-03, revue de fin de L2B ».
- L2BS-3, selon D80 : PP-9 (2 Mio au passe-plat pour le dépôt du logo, `apps/api` à 1 Mio sur toute
  autre route, délai inchangé) ; §6.6 : E1 non retenu au L2B (D80), ouvert avant L2E, noté sur E1-3
  et E1-8 ; P10.2 : `brand-logo` (sortie ré-encodée, WebP ≤ 1 Mio) ; `18` T9.2 (au L2B : aucune
  réponse du logo ne porte d'hôte Supabase ni de jeton) et T9.7 (aucune URL signée émise au L2B).
- `cloture.md`, amendements : `03`, `18` faits ici ; `02` §2.4 et `21` §2.4 (`stockage.md` l. 102)
  ajoutés.
**Ne pas toucher :** code, migrations, tests ; « Cinq entrées » d'E (un motif, pas une entrée) ;
rien d'autre dans `03`, `18`.
**Prouver :** `Grep` : plus de « à signer » en l. 894 ni de « 1 Mo » en PP-9 ; index par le hook ;
aucun test (D76).
**Arrêt si :** `03` ou `18` contredit le code au-delà de D80 (le nommer sans l'amender).
