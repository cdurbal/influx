# DS-6 — `feat(web): member shell with side column and bottom bar`

Invoque le skill `design-system-influx`.

**Lire :** `17@123+168` (§2.1 à §2.4), `17@291+23` (§2.5), `02@2414+69` (§21.5), `02@2529+11` (§21.9),
`20@758+45` (§11.8), `18@1611+13` (TD2, TD5), `18@1647+30` (§12.3 et attendus), `18@1693+15` (§12.5,
points 6 à 8), `18@1077+29` (G9, parité).

**Livrer :**

- `(space)/layout.tsx` ; `MemberShell` : session relue au montage et à chaque changement de chemin,
  écran bloquant des CGU, redirections de rôle de `17` §2.5.
- `member-nav.ts` : entrées sans écran omises, ordre fixe, 5 au plus, libellés de 11 caractères au plus.
- Un seul `<nav>` « Navigation principale », rendu une fois et restylé en CSS (barre du bas < `lg`,
  colonne ≥ `lg`, seuils lus dans les tokens) ; bloc d'état à partir de `lg` ; lien d'évitement ; focus
  sur le `h1` après navigation ; rien sous la barre.
- `locales/{fr,en}/member.json` et garde de parité amendée ; G9.
- `apps/web/tests/member-nav.test.ts` (TD2.1 à TD2.6) ; `e2e/member-shell.spec.ts` (TD5.1 à TD5.8) ; axe
  à 375, 768, 1024 et 1440 px sur l'accueil créateur.

**Règles :** pages autonomes (parcours, CGU à ré-accepter, déconnecté, compte supprimé) sans navigation
principale. Aucune API de stockage, aucun repli persisté.

**Attendus qui fixent la coquille :** `account` (navigation du compte absente aux CGU), `account-data`
(aucun repère `navigation` à « compte supprimé »), `journey-resume` (le sélecteur de langue garde son
repère `navigation`).
