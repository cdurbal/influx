# L3E-R — revue groupée de fin de jalon (D71, `CLAUDE.md` §7 règle 5)
Plage : du commit d'ouverture de L3E à HEAD (`git log --oneline`) ; migrations `0315` à `0320` (`0321`).
Rapport de 10 Ko au plus par revue : détail complet (fichier:ligne, scénario, correctif) pour les
seuls constats « bloquant » et « jalon » ; une ligne pour « avant production » et « plus tard ».

## Pour `testeur` (sonnet high)
- Annexe § Tests : chaque identifiant dans un titre, au plancher, vert ; aucun attendu affaibli
  (`git diff` des tests existants : `t15-campaign-feed-rate.test.ts`, `profiles-creator-identity.test.ts`,
  `t1-anonymisation.test.ts`, `t8-privacy-execution.test.ts`) ; fichiers neufs dans `shards.ts` et
  `case-floors.ts`.
- Bords : 4, 5 et 0 résultats ; bornes des tranches de nombre (4/5, 9/10, 24/25, 49/50) ; page 5 et
  6 ; 30e et 31e recherche de l'heure, 200e et 201e du jour ; quota froid avec 0, 1 et 2 froids ;
  passage du jour UTC (palier 8) ; 90 et 91 jours ; blocage levé puis reposé.
- Isolement : aucun décompte faussé par les profils publiés d'un autre fichier ou d'un run antérieur.
- Base : éclats CI et job ≤ 8 min contre l'annexe ; DS-flaky noté.
- Sortie : constats `L3ET-n`, reportés dans l'annexe § Revue.

## Pour `expert-cybersecurite` (opus xhigh)
- **D'abord RG80** : charge brute de la recherche (cartes, raisons, erreurs, en-têtes), invariants 1, 2,
  13 ; T1-R et les couples d'exception (aucun sur la couche I) ; porte (`03` P7, propriétaire neuf,
  `search_path = ''`, aucun `execute` dynamique, L2GS-5 non déclenché).
- Oracles : 0 et 4 identiques octet par octet ; nombre en tranche ; élargissements statiques ; aucune
  exclusion devinable (secteur refusé, blocage, compte suspendu) par le nombre, l'ordre ou le temps de
  réponse ; identifiant opaque, aucun séquentiel (CA49).
- C(17), T15 : débit compte et adresse, refus journalisés bornés (leçon L3DS-1), pagination, aucun
  export ; `party_blocks` illisible des parties ; export et effacement (05) ; D60 dans les journaux.
- T16 : aucune exemption neuve, aucun montant, aucun tarif (D78).
- Marqueur I-4 par le commit d'attestation (`security-reviewed: <date> covers <sha>…`), jamais en
  réécrivant `main` : lignes 01 (si une porte est recréée), 03 à 07, 10 (si `GRANT`) ; SHA complets
  prêts en fin de rapport.
- Sortie : constats `L3ES-n`, reportés dans l'annexe § Revue.

Un constat « jalon » ouvre une ligne `fix` dans `run.md` (arrêt pour validation du fondateur).
