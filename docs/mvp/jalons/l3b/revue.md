# L3B-R — revue groupée de fin de jalon (D71, `CLAUDE.md` §7 règle 5)
Plage : du commit d'ouverture de L3B à HEAD (`git log --oneline`) ; migrations `0303` à `0306`.
Rapport de 10 Ko au plus par revue : détail complet (fichier:ligne, scénario, correctif) pour les
seuls constats « bloquant » et « jalon » ; une ligne pour « avant production » et « plus tard ».

## Pour `testeur` (sonnet high)
- Annexe § Tests : chaque identifiant dans un titre, au plancher, vert ; aucun attendu affaibli
  (`git diff` des tests existants : t8, t16, référentiel, T1, T2) ; aucun plancher baissé ; fichiers
  neufs dans `shards.ts` et `case-floors.ts`.
- Parité domaine et base (05) : mêmes entrées, mêmes verdicts, mutation d'un seuil vue rouge.
- e2e : budget de 25 s tenu (mesures de `run.md`), états préparés par l'API, CA72 prouvé par un vrai
  rechargement ; éclats CI e2e et base contre l'annexe.
- DS-flaky noté.
- Sortie : `l3b/revue-constats-testeur.md`, constats `L3BT-n`.

## Pour `expert-cybersecurite` (opus xhigh)
- Invariants 1 à 4, 6, 7, 9 à 11 : aucun droit créateur sur `campaigns.*` ; vue créateur et charge
  brute sans tranche ni bloc interne ; RLS et droits de colonne de la marque au plus juste ; aucune
  porte membre vers `published` ; porte de soumission (propriétaire, `search_path`, droits, refus,
  RG85) ; `0306` : effacement complet, export sans donnée d'agent ; `export_class` des codes neufs.
- L3AS-6, L3AT-6 (01) et L3AS-3 (05, si échu) soldés.
- T16 : aucune exemption neuve, aucune opération sur un montant dans le code neuf.
- Marqueur I-4 à apposer par le commit d'attestation (`security-reviewed: <date> covers <sha>…`),
  jamais en réécrivant `main` : lignes 02, 05, 06 au moins ; SHA prêts en fin de rapport.
- Sortie : `l3b/revue-constats-securite.md`, constats `L3BS-n`.

Un constat « jalon » ouvre une ligne `fix` dans `run.md` (arrêt pour validation du fondateur).
