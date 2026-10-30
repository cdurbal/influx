# Revue groupée du jalon RK

Findings seulement : aucun fichier modifié, aucun commit.

**Plage :** du parent de RK-1 (`git log --oneline --grep='rendered-state safety net'`) jusqu'à `HEAD`.
Lis le diff par fichier (`git diff --stat`, puis fichier par fichier), jamais en un seul bloc.

Fais la revue toi-même, avec les grilles de `.claude/agents/expert-cybersecurite.md` et
`.claude/agents/testeur.md`, sans les lancer en sous-agents :

- CSP à nonce et `security-headers.ts` inchangés ; aucune requête tierce ; polices servies par l'origine ;
  aucune API de stockage, aucun appel réseau hors du client d'API ;
- aucun changement sous `apps/api`, `supabase`, ni dans une clé de traduction ou un texte métier ;
- invariants de la fiche : `tokens.css` identique dans les deux fronts, une seule valeur de couleur
  nouvelle (RK-B), `color-mix` dans la liste RK-A, aucun `/NN` sur une couleur, `badge-error-bg`
  confiné ;
- filet : aucun `test.fail()` résiduel ; chaque cas TK a été vu rouge (R4) ; G3i (a) et (b), G8 étendue
  et la garde de confinement ont leur négatif ; rien d'assoupli dans G1 à G9 ; planchers jamais
  baissés ; attendus des e2e existants inchangés (diff des specs antérieures à RK-1) ;
- R3 : chaque phrase normative de `20` §11 a un identifiant de test ou la mention « recette humaine » ;
- durée e2e ajoutée ≤ 60 s.

**Sortie :** findings classés (`RKS-n` sécurité, `RKT-n` test ; bloquant / avant production / Lot 2),
puis le texte du commit d'attestation `security-reviewed: <date> covers <sha>…` (D71), à ne pas
commiter sans l'accord de l'utilisateur.
