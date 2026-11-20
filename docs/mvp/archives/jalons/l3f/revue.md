# L3F-R — revue groupée de fin de jalon (D71, `CLAUDE.md` §7 règle 5)
Plage : du commit d'ouverture de L3F à HEAD ; migrations `0322` à `0326`. Rapport ≤ 10 Ko par revue :
détail (fichier:ligne, scénario, correctif) pour « bloquant » et « jalon » seuls ; une ligne sinon.

## Pour `testeur` (sonnet high)
- Annexe § Tests : identifiants dans les titres, planchers, verts ; aucun attendu affaibli (`git diff`
  de `creator-search-door`, `t1-anonymisation`, `t9-evidence-unreachable`, `member-nav`,
  `member-shell`) ; fichiers neufs déclarés.
- Bords : 59e à 61e ouverture ; région à 4 et 5 ; CA45 à la 5e et 6e ; CA46 au seuil ; bornes des
  sélections ; alias exclu puis revenu ; chaque état de campagne (L3ES-1).
- Isolement des fichiers ; e2e par spec en CI (12 et 13 s) ; éclats base (EC-L3F-3) ; DS-flaky.
- Sortie : constats `L3FT-n` dans l'annexe § Revue.

## Pour `expert-cybersecurite` (opus xhigh)
- **D'abord RG80** : charge brute du profil, du visuel, des sélections, de la demande (clés, erreurs,
  en-têtes) ; invariants 1 à 4 ; couples T1-R ; portes (`03` P7, L2GS-5).
- Oracles : profil, visuel, ajout pour un alias inconnu ou exclu (code, corps, temps) ; décompte de
  région ; identifiants opaques (CA49).
- Visuel : ni URL, hôte, jeton ni `object_key` ; approuvé seul ; erreurs de Storage.
- C(17), T15 : ouvertures par compte et adresse, refus bornés ; aucun export ; texte de la demande
  jamais servi à un créateur (D46) ; D60 ; L3ES-1 ; T16, D78.
- I-4 par commit d'attestation, jamais en réécrivant `main` : lignes 02 à 06 (07, 08 si `GRANT`) ; SHA
  complets en fin de rapport. Sortie : constats `L3FS-n` dans l'annexe § Revue.

Un constat « jalon » ouvre une ligne `fix` dans `run.md` (arrêt pour validation du fondateur).
