# RK-0 — `docs(mvp): amend the KEO charter for the RK milestone (D75)`

Documentation seule, aucun code. Trois grilles, appliquées toi-même dans cet ordre :
`expert-ux` (`20` §11), `architecte` (`02` §21), `testeur` (`18`).

**Lire :** `20` §11.3 à §11.8 ; `02` §21.3 et §21.5 ; `18` §5.1, §10 (structure d'un « Jalon »), §12
(structure des familles TD, pour calquer TK) ; `decisions.md` D75 (déjà écrite, ne pas la réécrire).

**Livrer :** exactement la liste « Amendements de spécification » de la fiche, ni plus ni moins :

- `20` §11.3 à §11.8 : rôles `border-hover`, `verified-bg`, `badge-error-bg` ; tableau des contrastes et
  les quatre paires interdites de la fiche ; lignes « titre de bloc dense BO » et « surtitre » ;
  graisses, approche, lissage, ombres et halo avec la borne de `color-mix` ; `scale-hover` 1,03 et
  `scale-press` 0,98 (jamais désactivé ni petit bouton BO) ; K8, K9, K10, K18 ; parades du risque
  Spotify en §11.7 ; règle du focus de RK-13 en §11.8.
- `02` §21.3 point 3 (piège de l'espace `--shadow-*` et des modificateurs `/NN`, tokens `--effect-*`
  neutres en `0 0 transparent`, jamais `none`) ; §21.5 point 7.
- `18` §5.1 (G3i a/b, gardes TK7) ; §10 « Jalon RK » (critère de fin de la fiche) ; §12 (TK1 à TK8,
  repris de la table « Tests » de la fiche, sans reformuler les mesures) ; **table de traçabilité R3** :
  chaque phrase normative de `20` §11 → un identifiant TK/TD/G ou « recette humaine ». Aucune ligne
  orpheline.
- **Trois valeurs à trancher** (grille `expert-ux`), écrites dans `20` §11 **et** dans la fiche :
  1. `badge-error-bg` : confirme `#2e1213` ou propose mieux ; recalcule le contraste du texte d'erreur
     (≥ 4,5, cible 5,19) et vérifie qu'il n'est pas un rouge D72 (G3b) ;
  2. `--size-header-glow` (hauteur de l'ellipse) : borne pour que le pic reste ≈ `#0d291d` et que le
     dégradé soit nul avant la barre du bas à 375 px ;
  3. seuil de TK2.2 (écart de luminance du pixel sous le centre, en /255), cohérent avec un pic à 15 %.
  Montre le calcul de chaque contraste en une ligne.

**Ne pas toucher :** code, tests, `tokens.css`, `decisions.md` hors coquille.

**Prouver :** `pnpm docs:index` puis `pnpm format:check`. Dans `21` § Jalon RK, remplace « Jalon RK
ouvert — une ligne par commit. » par la ligne de RK-0.
