# L2B-fix-1 — `fix(web): completeness message tied to the submission, CA38 and RG61 tested`
Grille `dev-react-node` (cas : grille `testeur`). Constat L2BT-1 : fiche § Revue.
**Lire :** `06` RG61 l. 468-480, RG84 l. 603, CA38 l. 876-877, Questions ouvertes l. 1005-1018 ;
`09` l. 808 ; `locales/{fr,en}/brand-profile.json` l. 3 et `submit` ; `BrandProfileScreen.tsx`
l. 336-359 ; `BrandHome.tsx` l. 135-145 ; `tests/brand-profile-form.test.ts` l. 1-40, 329-375.
**Livrer :**
- `06` d'abord, même commit : RG84 l. 603 et exemple autorisé de RG61 l. 473, « pour publier » →
  « pour soumettre », « to publish » → « to submit » (forme de `09` l. 808 : la marque soumet,
  INFLUX publie) ; écart `EC-L2B-fix-1-1` en fiche. Puis les deux `brand-profile.json`, mot pour mot.
- Cas neufs, section des libellés : `publish.missing` formaté par l'ICU de next-intl, FR et EN, avec
  un puis deux champs : chaque nom figure dans le texte, singulier et pluriel justes, verbe de
  soumission ; aucune promesse chiffrée (ni `%`, ni nombre hors `count`) — CA38.
- `06` Questions ouvertes, ligne **Q11** : « effet observable » (RG61 « dit ce que cela change »,
  CA38) ; hypothèse en attendant : le message nomme les manquants et l'action qu'ils bloquent, rien
  d'autre ; arbitre `product-owner` ; aucun texte d'effet proposé ni ajouté.
**Ne pas toucher :** `07` (créateur, L2D), `09` ; nom de la clé ; regex e2e l. 93 et 434 (préfixe
inchangé) ; aucun attendu affaibli.
**Prouver :** cas vus rouges par mutation (un nom retiré, « publier » remis) ; `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test brand-profile.spec.ts --reporter=line` ; plancher web
relevé.
**Arrêt si :** un autre écran lit `brandProfile.publish.missing` au sens « publier ».
