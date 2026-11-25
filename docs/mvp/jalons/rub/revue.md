# RUB-R — revue groupée de fin de jalon
Plage : `<parent de X1>..HEAD`. Deux rapports de 10 Ko au plus : détail complet (fichier, ligne, scénario, correctif) pour
« bloquant » et « jalon » ; **une ligne** pour « avant production » et « plus tard ». Synthèse : `annexe.md` § Revue ;
une ligne `fix-n` dans `run.md` par constat bloquant ou jalon.

## Pour `testeur` (`sonnet` · `high`) — constats `RUBT-n`
- Invariants 4, 7 à 10, 14 à 16 : chaque preuve de l'annexe au bon niveau, plancher inscrit ; aucune assertion retirée
  (`git diff` des specs et gardes) ; cas négatif de chaque garde changée.
- 49 composants : module, `NomProps` conforme à `R02c`, planche, test, AN-2 si `R04` le porte ; aucun doublon
  (`R02b` §4) ; aucun appelant produit hors A ; poids JavaScript ≤ +5 % par route.
- Coquille : CA01 à CA08, N1 à N3 rejoués si la pile est là, sinon dit. Durées e2e et éclats.

## Pour `expert-cybersecurite` (`opus` · `xhigh`) — constats `RUBS-n`
- Invariants 2, 5, 11 à 13 : ni réseau, ni session, ni secret dans un composant ou la planche ; garde de X1 non
  contournable ; planche absente de l'artefact ; ni HTML brut ; schémas de `href` et `src`, `rel` des liens externes ;
  `alt` et nom de la carte photo sans identité (D45, D46).
- `TermsDialog` : version acceptée identique ; `OtpField` : code ni journalisé ni conservé ; déconnexion, garde de rôle.
- **Marqueur I-4** : diff vide sur `supabase/`, `apps/api/` ; rejouer `check-security-review.ts` sur la plage ; commit sur
  `.github/workflows/`, `check-*`, `next.config.ts` : attestation à proposer.
