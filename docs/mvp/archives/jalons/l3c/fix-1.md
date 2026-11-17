# L3C-X1 — `fix(db): 0311 journal campaign decision e-mails under their catalogue code`
Grille `expert-database`. Skill : `supabase-schema`. Signalé I-4 (`SECURITY DEFINER` redéfinie).
**Lire :** `modele.md` « Arbitrage A2 » (l. 65-75, fait foi) ; fiche, invariant 10 ; `0111`
l. 357-545, 615-624, 633-635, 758-762 ; `0146` l. 120-128, 461-479 ; `0211` l. 1-14 (en-tête) ;
`db-tests/tm1-outbox-claim.test.ts` l. 84-125, 937-1024.
**Livrer :** `supabase/migrations/0311_leads_campaign_decision_journal.sql` :
- `create or replace` de `leads.complete_outbox_attempt` sous `influx_leads_definer` (fenêtre de
  `0146`), corps de `0111` recopié ; seuls changements : `o.event_type` lu (§2) ; un code calculé une
  fois, `campaign.decision` pour une ligne `campaign.decision`, sinon `payload ->> 'email_code'`,
  écrit dans `email_code` et `template_ref` (§7) ; nullité de la charge toujours testée (§3, 22023) ;
- signature, propriétaire, `EXECUTE` (`influx_worker` seul), commentaire, `search_path` identiques ;
  ni `GRANT`, colonne, contrainte assouplie ni code émis changé ; aucune reprise ; assertions de fin.
**Ne pas toucher :** la ligne 06 attend ce fix ; ses fichiers non commités sont dans l'arbre
(`apps/api/src/domains/{leads,maintenance,campaigns,profiles/creator}`, `src/worker.ts`,
`src/locales`, `tests/`, `db-tests/tm1-*` hors `tm1-outbox-claim`,
`docs/mvp/16-backoffice-emails-brevo.md`) : ni modifiés, ni indexés, ni remisés. Renumérotage de
la recherche (`0312` et suivants) : à la clôture, pas ici.
**Prouver :** `insertLine` reçoit `eventType` (défaut `lead.created`) ; cas neufs sous l. 937 :
`campaign.decision` (`published`) en succès réel → `succeeded`, journal et `template_ref`
`campaign.decision` ; `profile.decision` inchangé ; sans `email_code` → 22023. Plancher de
`case-floors.ts` l. 89 : 71 + cas ajoutés. Accueil (l. 978), E-3 (l. 1542) : aucun attendu changé.
`pnpm check:fast` ; `pnpm --filter @influx/api test:db -- --reporter=dot` (suite entière).
**Commit :** `git add` nominatif, jamais `-A` ; `case-floors.ts` porte déjà les planchers de 06 :
indexer sa seule ligne (`git apply --cached` d'un patch réduit) ; `git diff --cached --name-only` =
migration, test, `case-floors.ts`, `run.md`. Note : `I-4. …`.
**Arrêt si :** corps en vigueur autre que `0111` ; `GRANT` ou autre fonction nécessaire ; échec d'un
fichier de 06 sans lien avec `0311` (signaler, ne pas corriger).
