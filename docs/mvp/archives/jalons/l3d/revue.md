# L3D-R — revue groupée de fin de jalon (D71, `CLAUDE.md` §7 règle 5)
Plage : du commit d'ouverture de L3D à HEAD (`git log --oneline`) ; migration `0314`.
Rapport de 10 Ko au plus par revue : détail complet (fichier:ligne, scénario, correctif) pour les
seuls constats « bloquant » et « jalon » ; une ligne pour « avant production » et « plus tard ».

## Pour `testeur` (sonnet high)
- Annexe § Tests : chaque identifiant dans un titre, au plancher, vert ; aucun attendu affaibli
  (`git diff` des tests existants, ligne 01 et `t1-anonymisation.test.ts` compris) ; aucun plancher
  baissé ; fichiers neufs dans `shards.ts` et `case-floors.ts`.
- Bords : veille et jour de la date limite et de la fin de période ; 7 et 8 jours de RG26 ; même
  seconde sur deux pages (CA17) ; dernière page et page hors plafond ; débit au seuil et au-delà ;
  compte et adresse indépendants (T15.4).
- Fixtures : instantanés réels (ligne 01), aucune campagne `published` d'un run antérieur lue par le fil.
- e2e : 15 s tenus selon Q2 (mesures de `run.md`) ; éclats CI e2e et base contre l'annexe ; DS-flaky noté.
- Sortie : constats `L3DT-n`, reportés dans l'annexe § Revue.

## Pour `expert-cybersecurite` (opus xhigh)
- Invariants 1 à 8, 11 : propriétaire et droits des portes (`03` P7, `search_path = ''`, aucun
  `execute` dynamique) ; aucun droit `influx_creator` sur `campaigns.*` ni `profiles.advertiser_*`
  (TM5.6, T1-R) ; D46 sur la ligne publique de la marque ; charge brute du fil, de la fiche, du logo
  et des erreurs (T1.4) ; T14 sans oracle d'existence ; débit et plafond (C(17), T15) et valeurs en
  table ; journal RG22 sans donnée superflue (D60) ; logo servi pour une campagne visible seule.
- T16 : aucune exemption neuve, aucune opération sur un montant.
- Marqueur I-4 par le commit d'attestation (`security-reviewed: <date> covers <sha>…`), jamais en
  réécrivant `main` : ligne 02 au moins ; SHA complets prêts en fin de rapport.
- Sortie : constats `L3DS-n`, reportés dans l'annexe § Revue.

Un constat « jalon » ouvre une ligne `fix` dans `run.md` (arrêt pour validation du fondateur).
