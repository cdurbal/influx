# DS-7 — `feat(web): KEO sign-in and sign-up screens`

Invoque le skill `design-system-influx`.

**Lire :** `17@560+36` (§3.5 et §3.6 ; le reste de §3 seulement au besoin), `18@1624+23` (§12.2),
`18@1647+30` (§12.3).

**Livrer :** les trois écrans du parcours (e-mail, code, informations complémentaires marque et
créateur) et leurs états, choix de porte, succès, dialogue des CGU (`<dialog>` natif sur place, focus
piégé, `Échap`, voile opaque TD3.6), rhabillés avec les primitives de DS-5. Aucun texte, aucune logique,
aucun appel réseau modifié (`05` RG113).

**Prouver :** axe selon §12.2 (état par défaut et soumission vide), reflow à 320 px.

**Gelés :** tests de `auth-steps`, `signup-form` et `journey-memory` ; e2e `signup-nominal`,
`journey-resume`, `landing-signup`.
