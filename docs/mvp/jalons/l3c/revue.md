# L3C-R — revue groupée de fin de jalon (D71, `CLAUDE.md` §7 règle 5)
Plage : du commit d'ouverture de L3C à HEAD (`git log --oneline`) ; migrations `0307` à `0310`.
Rapport de 10 Ko au plus par revue : détail complet (fichier:ligne, scénario, correctif) pour les
seuls constats « bloquant » et « jalon » ; une ligne pour « avant production » et « plus tard ».

## Pour `testeur` (sonnet high)
- Annexe § Tests : chaque identifiant dans un titre, au plancher, vert ; aucun attendu affaibli
  (`git diff` des tests existants, ligne 01 comprise) ; aucun plancher baissé ; fichiers neufs dans
  `shards.ts` et `case-floors.ts`.
- TM5.1 : aucune écriture de `published` hors porte de décision (mutation vue rouge) ; CA57 : même
  personne refusée ; verrou en concurrence (deux prises ; décision contre levée forcée).
- Clôture automatique : veille et jour de l'échéance, acteur système, une période réclamée une fois.
- e2e : 18 s tenus (mesures de `run.md`), états préparés par l'API ; éclats CI e2e et base contre
  l'annexe ; DS-flaky noté.
- Sortie : constats `L3CT-n`, reportés dans l'annexe § Revue.

## Pour `expert-cybersecurite` (opus xhigh)
- Invariants 1 à 6, 8, 10, 11 : propriétaire et droits des portes (`03` P7, `search_path`, aucun
  `execute` dynamique) ; garde L3BS-2 ; instantané sans bloc interne (TM5.6) ; aucun droit créateur ;
  commentaire interne et premier avis jamais servis à la marque ni à Brevo ; conflit d'intérêts ;
  levée forcée ; T14 ; charges Brevo et Apollo (CA70, RG106) ; export sans agent nommé (L3BS-5).
- T16 : aucune exemption neuve, aucune opération sur un montant.
- Marqueur I-4 par le commit d'attestation (`security-reviewed: <date> covers <sha>…`), jamais en
  réécrivant `main` : lignes 02 à 05 au moins ; SHA complets prêts en fin de rapport.
- Sortie : constats `L3CS-n`, reportés dans l'annexe § Revue.

Un constat « jalon » ouvre une ligne `fix` dans `run.md` (arrêt pour validation du fondateur).
