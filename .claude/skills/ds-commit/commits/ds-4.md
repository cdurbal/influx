# DS-4 — `feat(web): KEO boundary for the member pages`

F1 et F2 tranchés (2026-10-29) : pages légales publiques en vitrine ; un seul vert, mais la vitrine ne
change qu'à DS-14 (DS-4 la laisse intacte).

**Lire :** `02@2314+12` (§21.2), `02@2326+48` (§21.3), `02@2414+68` (§21.5, points 7 et 9),
`20@391+39` (§11.1), `18@1611+13` (TD3, TD4.4), `18@1647+30` (§12.3 et attendus), `18@1077+29` (G8).

**Livrer :**

- Groupes `app/[locale]/(member)` et `(member)/(space)`, URL inchangées (`git mv`, aucun texte ni
  logique modifié).
- `data-theme="keo"` et polices posés par `(member)/layout.tsx` seul ; `error` et `not-found` propres à
  `(member)`.
- G8 en `it` distincts (TD1.10) ; `e2e/charter-cascade.spec.ts` (TD3.1, TD3.3 à TD3.6) ; TD4.4 (liste
  de frontière en données, à un seul endroit) ; T10.6 étendu à `/fr/connexion` et à l'accueil avec
  session ; inventaire des « incomplete » d'axe.

**Attention :** l'axe existant à 375 px devient le vrai filet des contrastes KEO. E2E à garder verts
sans toucher leurs attendus : `signup-nominal`, `journey-resume`, `landing-signup`, `account`,
`account-data`, `security-headers`.
