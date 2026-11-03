# Revue de fin du jalon L2B

Constats seulement : aucun fichier modifié hors constats. **Plage :** parent du commit d'ouverture
`..HEAD`, diff fichier par fichier. **Format :** `L2BT-n` ou `L2BS-n`, gravité (bloquant · à corriger
dans le jalon · avant production · plus tard), fichier:ligne, correctif en une phrase ; table courte en
fiche § Revue, détail dans `l2b/revue-constats.md`.

## Pour `testeur`

- Aucun attendu affaibli, planchers jamais baissés ; cas vus rouges par mutation sur 01, 05, 06, 09.
- 04 : CA35 à CA38 contre des valeurs calculées à la main ; la parité de 06 lit vraiment les deux
  sources.
- 07 : CA1 à CA7, CA14 ; T14.3 et T14.4 (code et corps identiques à l'inexistant).
- 09 : T9.5 lit les octets, pas un booléen ; T9.4 couvre PDF et octets contraires ; T9.8 à la
  frontière exacte.
- 11, 12, 13 : un cas par page et par langue, largeurs dans le cas ; durées ≤ 12, 4 et 4 s ; CA44 par
  rechargement réel ; CA46 sans résidu.
- CI : durées avec Storage (03) ; DS-flaky sur les passages du jalon.

## Pour `expert-cybersecurite`

- 05, 06, 08 : RLS activée et forcée ; aucun droit créateur sur l'interlocuteur (D46) ; rien à
  `public`, `anon`, `authenticated`, `service_role` ; membre limité à ses colonnes ; transition non
  contournable ; `SECURITY DEFINER` absent ou inscrit en P7 ; effacement et export complets.
- 08, 09 : compartiments privés, limites au compartiment, chemin serveur sans nom d'origine,
  ré-encodage, quotas, URL signée ≤ 5 min et journalisée, journaux sans donnée superflue (D60).
- 09 : lockfile limité aux paquets visés, versions exactes, `pnpm audit --prod --audit-level high`,
  import unique de `storage-js`, CSP (hôte en configuration, backoffice inchangé).
- 03 : diff de `ci.yml` limité à Storage. 07 : schémas de sortie fermés, aucun identifiant d'objet
  dans un chemin.
- Puis le texte du commit d'attestation `security-reviewed: <date> covers <sha des commits I-4>`
  (D71), à commiter en clôture si rien de bloquant ne reste.
