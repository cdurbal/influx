# L2G-C — clôture du jalon et du Lot 2
Grille `testeur`. Aucun code applicatif.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` trois fois ; mesures dans `run.md` § Mesures de clôture (somme des médianes des cas ajoutés, suite entière, éclats CI, job base, selon F0).
2. Fiche § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`). **L2GT-3 :** « créateur `published` sur `staging` » et « dix visuels » jamais cochées sans réserve : la réserve cite la phrase datée du fondateur (« je valide la recette », 2026-11-12, ligne F) : `staging` non préparé par un agent, dix visuels non tracés ; « T1 » cochée « adapté : T1.3 et T1.6 « après » au Lot 4 ».
3. `18` §10 Lot 2 (l. 1548-1560) : chaque case cochée avec sa preuve ou reportée avec son échéance, réserves de L2GT-3 reprises (l. 1552, 1559) ; R-4, R-5 : D79, revue RGPD au Lot 6.
4. Amendements de clôture : `04` (§5.2 portfolio et entrées créateur, §5.11), `07` (RG4, RG9, RG104 selon `modele.md`), `15` RG29 (files 2, 3 en service), `17b` §3.6, `21` §2.3 si F0 ou fix-5 (B) l'a changé, `21` §5.8 (modèles Brevo neufs).
5. **L2GT-1 / fix-5a ignoré** (fondateur, 2026-11-13, « clos sans la ligne fix-5a ») : job base à 494 s en CI, 501 s en local, plafond F0 de 8 min dépassé ; écrit aux cases « budget » comme réserve, et au reliquat de `21` §8 **avant le Lot 3** (deux éclats, `fix-5a.md`), `21` §2.3 non amendé.
   `21` §0 : Lot 2 clos ; §8 : ligne de clôture de L2G, reliquat repris (constats non soldés, EC-L2G-16), L2DS-4, L2DS-6, L2D-E2E mis à jour.
6. **L2GT-9 :** CI GitHub bloquée par la facturation depuis `de69db7` (dernier vert : run 43237619867 sur `5243ef6`), acceptée par le fondateur le 2026-11-12 (« on valide sans le CI ») : écrit aux cases « CI », avec les mesures locales de `revue-constats-testeur.md` l. 16-28. CI relancée dès la facturation rétablie, verte avant l'attestation `security-reviewed: <date> covers <sha>…` (SHA : `revue-constats-securite.md` § Marqueur I-4) et avant tout `git merge --no-ff main` vers `production`.
7. Fiche et dossier déplacés dans `docs/mvp/archives/jalons/` (`git mv`) ; renvois mis à jour.
**Prouver :** `check-security-review.ts` ok ; CI verte sur le dernier push, sinon dérogation écrite et attestation différée.
