# Revue de fin du jalon L2D

Constats seulement : aucun fichier modifié hors constats. **Plage :** parent du commit d'ouverture `..HEAD`, diff fichier par fichier. **Format :** `L2DT-n` ou `L2DS-n`, gravité (bloquant · à corriger dans le jalon · avant production · plus tard), fichier:ligne, correctif en une phrase ; table courte en fiche § Revue, détail dans `l2d/revue-constats-testeur.md` et `l2d/revue-constats-securite.md`.

## Pour `testeur`

- Aucun attendu affaibli, planchers jamais baissés ; le seul cas inversé est celui du créateur sur `/compte/profil` (12).
- T1 : inventaire réellement dérivé du routeur, aucune exclusion, T1-W et la fuite provoquée vus rouges ; marqueurs réellement en base ; erreurs comprises ; écarts T1.3, T1.5, T1.6 après bien écrits.
- TM11 : liste dérivée de Drizzle, témoin rouge ; exemptions par nom justifiées par T14.
- TM12.6 : test sans seed figée, 1 000 générations.
- L2D-D1 à D15 vus rouges par mutation ; RG116 (les trois valeurs, date immobile sinon) ; Q15 tenue ; 0 accepté, négatif refusé.
- T16-L2D ; somme e2e ≤ 20 s sur trois passages ; éclats sous 7 min 30 (01) ; DS-flaky.

## Pour `expert-cybersecurite`

- 03 à 06 : RLS activée et forcée ; aucun droit à `public`, `anon`, `authenticated`, `service_role` ; **aucun droit à `influx_advertiser` sur un objet créateur** ; `SECURITY DEFINER` inscrit en `03` P7, `search_path` vide, propriétaire signé.
- P5 tenu : `creator_public_*` sans valeur exacte, sans texte non modéré destiné à sortir ; `public_ref`, alias sans lien avec le compte (I-2, TM12.6) ; colonnes `status`, `alias`, tranches, date, source non écrivables par un membre.
- 04 : en-tête non réversible ; garde par nom de T1-R contourné ?
- 05 : dérivation incontournable ; aucun chemin d'écriture qui laisse une tranche fausse (ligne principale, pays, `correct_member_account`).
- 06 : effacement complet, aucun résidu ; export au seul propriétaire.
- 08, 09 : schémas fermés, IDOR sur l'identifiant de ligne ; aucun champ de `creator_identities` hors du créateur ; journaux (D60), avertissement de détection sans copie.
- Puis le texte de l'attestation `security-reviewed: <date> covers <sha des commits 03 à 06, et de tout commit I-4 ajouté>` (D71), à commiter en clôture si rien de bloquant ne reste. Relecture de `0215` (L2C-fix2) si elle est faite ici : à dire.
