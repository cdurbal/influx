# L2G-fix-3 — `fix(backoffice): creator queues show what the agent decides on`
Grille `dev-react-node`. Skill : `backoffice-ops`. L2GU-9, 10, 21 et le constat de la ligne 17 (validés par le fondateur le 2026-11-12).
**Lire :** `l2g/ux-constats.md` l. 76-82, 135-137 (font foi) ; `l2g/modele.md` point 9 ; `run.md` ligne 17 (EC-L2G-17-2) ; `CreatorReviewBlocks.tsx` l. 40-70 ; `CreatorVisual.tsx` ; `PortfolioReviewDecision.tsx` l. 115-150 ; raccourcis de `ClaimedEntryFrame` ; `apps/api/src/domains/backoffice/creator-queues/views/repository.ts` (`readReviewedLines`) et la lecture de la fiche de compte (`account-creator/repository.ts`) pour le badge tenant.
**Livrer :**
- Constat ligne 17 : `readReviewedLines` sert les chiffres du badge d'audience tenant (actif ou à rafraîchir, date d'octroi, source constatée), sinon les déclarés, par la même règle que la fiche de compte (une seule fonction partagée, pas de copie).
- L2GU-9 : titre du bloc ① « Le profil soumis » si `entry.kind === "submission"`, « Le profil validé (version en ligne) » sinon.
- L2GU-10 : à l'affichage, l'image prend le focus (`tabIndex={-1}`) ; « Visuel affiché » annoncé dans la région `status`.
- L2GU-21 : raccourci ‹i› « afficher le visuel » (files 2 et 3, liste des raccourcis) ; récapitulatif d'approbation : « Vous n'avez pas affiché ce visuel. » tant qu'il ne l'est pas (information, aucun blocage).
**Ne pas toucher :** base, journalisation de la lecture (D82 (7) inchangée), écrans membres, `tokens.css`.
**Prouver :** `db-tests/t14-creator-queue-route.test.ts` : un cas badge tenant (chiffres constatés servis) et un cas sans badge (déclarés), plancher relevé ; unitaires `creator-review-view` et `portfolio-review-view` (titre, avertissement) ; `pnpm --filter @influx/web exec playwright test creator-queue.spec.ts portfolio-queue.spec.ts --reporter=line`, ≤ + 0,3 s (file 2 déjà à ~5 s) ; `pnpm check:fast`.
**Arrêt si :** la règle du badge tenant exige un droit ou une migration.
