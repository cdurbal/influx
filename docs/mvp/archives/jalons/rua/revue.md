# RUA-R — revue groupée de fin de jalon
Plage : `<parent du commit de 00>..HEAD`. Deux rapports de 10 Ko au plus : détail complet (fichier, ligne,
scénario, correctif) pour « bloquant » et « jalon » seulement ; une ligne pour « avant production » et « plus
tard ». Synthèse dans `annexe.md` § Revue ; une ligne `fix-n` dans `run.md` par constat bloquant ou jalon.

## Pour `testeur` (`sonnet` · `high`) — constats `RUAT-n`
- Invariants 2, 3, 7, 8, 9, 10, 13 : chaque preuve de l'annexe § Tests présente, au bon niveau, plancher
  inscrit ; aucune assertion existante retirée ou assouplie (comparer `git diff` sur les specs et gardes) ; cas
  négatif de chaque garde changée (TD1).
- Outil N1 à N3 : un écart volontaire est-il vraiment vu (rejouer les trois) ; tolérances de `R05` §3 à la lettre ;
  masques hors liste ; référence jamais committée ; échantillon CI ≤ 8 s ; commande complète locale reproduite
  (147 états, 0 écart) ; durées e2e et éclats (`run.md`).
- Jeu de recette : aucune donnée réelle, aucun montant côté créateur, `NON_RECETTABLE` exact.

## Pour `expert-cybersecurite` (`opus` · `xhigh`) — constats `RUAS-n`
- Invariants 2, 10, 11 : planche d'états absente de la construction de production, sans session, sans donnée, sans
  clé ; `next.config` et `src/config` ne lisent aucun secret ; CSP et en-têtes inchangés ; règle ESLint `process.env`
  non contournée ; G8 (`data-theme`).
- Outil de comparaison : ouvre des fichiers locaux seulement, n'envoie rien sur le réseau, ne lit aucun secret
  (`.env.local`, `.operator-secrets`).
- **Marqueur I-4** : aucun commit du jalon ne touche `audit.*`, une politique, un `GRANT` ou `supabase/config.toml` ;
  confirmer par `git diff --stat` sur `supabase/` et `apps/api/` (vides). 596c18c touche `.github/workflows/ci.yml` et
  `apps/web/next.config.ts` (`SECURITY_PREFIXES`) : attestation requise, couverte par RUA-R.
