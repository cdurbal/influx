# L3G-R — revue groupée de fin de jalon (et de lot)
Plage : `7ca8c35..HEAD`. Deux rapports de 10 Ko au plus : détail complet (fichier, ligne, scénario,
correctif) pour « bloquant » et « jalon » seulement ; une ligne pour « avant production » et « plus
tard ». Synthèse dans `annexe.md` § Revue ; une ligne `fix-n` dans `run.md` par constat bloquant ou jalon.

## Pour `testeur` (`sonnet` · `high`) — constats `L3GT-n`
- Invariants 4, 5, 9, 11, 14, 15 : chaque preuve de l'annexe § Tests présente, au bon niveau, plancher
  inscrit, fichier déclaré dans `shards.ts`.
- Concurrence : prise de la file 9 à deux connexions ; calcul quotidien rejoué ; L3G-T2.
- Durées : éclats base CI ≤ 7 min 30 et job ≤ 8 min ; L3G-E1 + E2 ≤ 15 s en CI ; DS-flaky.
- `18` §10 Lot 3 : TM12 complet, cas non automatisables prêts pour la clôture.

## Pour `expert-cybersecurite` (`opus` · `xhigh`) — constats `L3GS-n`
- Invariants 2, 3, 6, 7, 8, 10 : TM12.5 en base ; aucune porte identifiée exécutable par un rôle membre ;
  propriétaire neuf, P7, aucun `execute` dynamique ; charge brute des routes identifiées (ni e-mail ni
  téléphone, D46) ; G10 jamais vers une marque ; double validation non contournable (même admin, demande
  rejouée ou expirée).
- Journal RG78 non contournable ; pré-remplissage, file 9 et compteurs comme oracle ; message de la marque
  (bidi, HTML, caractères de contrôle, L3FS-7).
- Reliquat L3FS-1 à -3 vérifié ; L3ES-2 soldé.
- **Attestation I-4** : SHA des lignes touchant `audit.*`, une politique, un `GRANT` ou la double
  validation (01, 04 à 08 au moins), vérifiés par `git cat-file -t` ; ligne
  `security-reviewed: <date> covers <sha>…` prête pour la clôture, dans l'annexe.
