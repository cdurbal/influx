# DS-3 — `feat(fonts): self-hosted Manrope and Source Sans 3 (OFL)`

**Lire :** `02@2374+40` (§21.4), `18@1077+29` (G4f, ESLint), `18@1611+13` (TD1.9, TD3.4, TD3.5).

**Livrer :**

- Quatre woff2 non modifiés (Manrope et Source Sans 3, `latin` et `latin-ext`) sous `src/styles/fonts/`
  des deux fronts (copies identiques), licences OFL, `FONTS.md` (source, version, SHA-256, poids).
- `src/styles/fonts.ts` (`next/font/local`) par front, importé par personne à ce stade.
- Règle ESLint (`next/font/local` hors `fonts.ts`, `lucide-react` hors `icons.ts`), G4f et TD1.9,
  budget de 120 Ko préchargés au plus, relevé puis figé.

**Vérifier** avec un script jetable dans le scratchpad, pas dans le dépôt : même nom de famille en
`latin` et `latin-ext`, chiffres tabulaires (`tnum`). Sinon `latin` seul, consigné en EC.

**Attention :** aucun changement de rendu ; TD3.4 (landing sans police) et `security-headers` verts.
