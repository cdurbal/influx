# Revue de fin du jalon L2E

Constats seulement : aucun fichier modifié hors constats. **Plage :** parent du commit d'ouverture `..HEAD`, diff fichier par fichier. **Format :** `L2ET-n` ou `L2ES-n`, gravité (bloquant · à corriger dans le jalon · avant production · plus tard), fichier:ligne, correctif en une phrase ; table courte en fiche § Revue, détail dans `l2e/revue-constats-testeur.md` et `l2e/revue-constats-securite.md`.

## Pour `testeur`

- Aucun attendu affaibli, planchers jamais baissés ; ligne 02 : couverture intacte, gain réellement mesuré.
- T9.6 : fuite provoquée vue rouge ; droit, routes et schémas tous couverts ; vert trois fois.
- T9.5 : octets relus, GPS absent. T9.7 : journal par ouverture.
- L2E-D1 à D24 vus rouges par mutation ; CA de `08` et `06` listées réellement couvertes, ou reportées avec leur jalon.
- L2CT-8 réglé ; T1 et TM11 voient les marqueurs neufs ; e2e ≤ 20 s sur trois passages ; éclats sous 7 min 30 ; DS-flaky.

## Pour `expert-cybersecurite`

- 01, 05 à 10 : RLS activée et forcée ; rien à `public`, `anon`, `authenticated`, `service_role` ; **rien à `influx_advertiser` sur `verification.*`** ; `SECURITY DEFINER` en `03` P7, `search_path` vide, aucun `execute` dynamique ; propriétaires signés (D82, A5).
- D82 : dépôt, plafond par chemin, mémoire et déni de service, `nosniff`, images piégées, durée de `sharp` (L2BS-5) ; aucune URL signée.
- Décision : verrou, jeton, `aal2`, compte propre et détenu, attribution sans agent impossible, liste de motifs.
- L2DS-1 et L2DS-2 fermées ; `profile_url` cliquable sans ouverture de redirection ; `rel`.
- Sortie : aucun handle, code, chiffre, raison sociale dans journaux, registre, `outbox`, Brevo, Apollo ; e-mails sans lien.
- 10 : effacement complet, conservation réellement pseudonyme.
- Puis le texte de l'attestation `security-reviewed: <date> covers <sha des commits I-4>` (D71), à commiter en clôture si rien de bloquant ne reste.
