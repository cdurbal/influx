# Revue de fin du jalon L2F

Constats seulement : aucun fichier modifié hors constats. **Plage :** parent du commit d'ouverture `..HEAD`, diff fichier par fichier. **Format :** `L2FT-n` ou `L2FS-n`, gravité (bloquant · à corriger dans le jalon · avant production · plus tard), fichier:ligne, correctif en une phrase ; table courte en fiche § Revue, détail **écrit** dans `l2f/revue-constats-testeur.md` et `l2f/revue-constats-securite.md` (à L2E, ces fichiers manquaient).

## Pour `testeur`

- Aucun attendu affaibli, aucun plancher baissé ; ligne 01 : assertions comptées avant et après, gain réellement mesuré.
- TM5.3 : transition par la seule tâche, rejouable, sans agent ; TM5.4 : chaque voie sans 2V refusée ; mutations vues rouges ; vert ×3.
- L2F-D1 à D20 vus rouges ; CA45 à CA54, `06` CA31, CA32 couvertes, ou reportées avec leur jalon.
- T9.6, T1, TM11 voient tables et marqueurs neufs ; e2e ≤ 20 s sur trois passages ; éclats sous 7 min 30 ; DS-flaky.

## Pour `expert-cybersecurite`

- 02, 03, 05 à 10 : RLS activée et forcée ; rien à `public`, `anon`, `authenticated`, `service_role` ; rien à `influx_advertiser`, `USAGE` compris ; `SECURITY DEFINER` en `03` P7, `search_path` vide, aucun `execute` dynamique ; propriétaires neufs signés mot pour mot en § Signatures.
- 2V : porte agent bornée à `verification.revoke_badge` ; charge canonique, consommation unique, expiration, forme dégradée (PD1 à PD7) ; PLT-5, PLS-5, PLS-6 fermées.
- Contestation : décideur exclu, 24 h ; files 5 et 6 : verrou, jeton, `aal2`, compte propre et détenu.
- Déclencheur de la file 6 : abus par l'autosave (L2DS-7), identifiants jamais hors de l'interne.
- D83 : abus, conflit d'intérêts (le commercial responsable valide son client), second regard a posteriori ; **A-bis** (avis demandé par D83) : force de la preuve, domaines grand public, adresse de connexion jamais exposée.
- Sorties : aucun identifiant, texte ni chiffre dans journaux, registre, `outbox`, Brevo, Apollo ; e-mails sans lien. 10 : effacement complet.
- Puis, en § Attestation, le texte `security-reviewed: <date> covers <sha des commits I-4>` (D71), commité en clôture si rien de bloquant ne reste.
