# L2G-C — clôture du jalon et du Lot 2
Grille `testeur`. Aucun code applicatif.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` trois fois ; mesures dans `run.md` § Mesures de clôture (somme des médianes des cas ajoutés, suite entière, éclats CI, job base, selon F0).
2. Fiche § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`).
3. `18` §10 Lot 2 (l. 1548-1560) : chaque case cochée avec sa preuve ou reportée avec son échéance ; R-4, R-5 : D79, revue RGPD au Lot 6.
4. Amendements de clôture : `04` (§5.2 portfolio et entrées créateur, §5.11), `07` (RG4, RG9, RG104 selon `modele.md`), `15` RG29 (files 2, 3 en service), `17b` §3.6, `21` §2.3 si F0 l'a changé, `21` §5.8 (modèles Brevo neufs).
5. `21` §0 : Lot 2 clos ; §8 : ligne de clôture de L2G, reliquat repris (constats non soldés, EC-L2G-16), L2DS-4, L2DS-6, L2D-E2E mis à jour.
6. Attestation `security-reviewed: <date> covers <sha>…` si la revue est soldée.
7. Fiche et dossier déplacés dans `docs/mvp/archives/jalons/` (`git mv`) ; renvois mis à jour.
**Prouver :** `check-security-review.ts` ok ; CI verte sur le dernier push.
