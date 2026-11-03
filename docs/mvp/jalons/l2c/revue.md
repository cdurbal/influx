# Revue de fin du jalon L2C

Constats seulement : aucun fichier modifié hors constats. **Plage :** parent du commit d'ouverture `..HEAD`, diff fichier par
fichier. **Format :** `L2CT-n` ou `L2CS-n`, gravité (bloquant · à corriger dans le jalon · avant production · plus tard),
fichier:ligne, correctif en une phrase ; table courte en fiche § Revue, détail dans `l2c/revue-constats.md`.

## Pour `testeur`

- Aucun attendu affaibli, planchers jamais baissés ; 02 sans une ligne de test changée ; `tm3-backoffice-catalogue` étendu.
- 06, 07 : L2C-G1 à G5, L2C-V1 à V4, L2C-D1 à D6 vus rouges par mutation ; V1 vraiment concurrent.
- 07 : un seul `profile.completed` à travers refus, resoumission et publication ; 10 : CA41 à CA43 sur le corps brut.
- 09 : chaque motif de RG66, FR et EN, contre le texte de `06` l. 501-508.
- 11, 12, 13 : T14.3, T14.4 par route (code et corps identiques) ; CA15 à CA21 ; L2BT-3, L2BT-7 présents.
- 15 à 18 : un cas par page et par langue, durées ≤ 4, 6, 8 et 2 s ; somme ≤ 20 s ; DS-flaky ; « Browser journeys » selon `e2e.md`.
- Recommandation du levier e2e tenue (`e2e.md`).

## Pour `expert-cybersecurite`

- 04 à 07 : RLS activée et forcée ; rien à `public`, `anon`, `authenticated`, `service_role` ; `SECURITY DEFINER` inscrit en
  `03` P7, `search_path` vide ; décisions réservées à `agent`, `admin` en `aal2`, titulaire seul.
- L2BS-1 : gel non contournable, en direct, colonnes, listes, logo, nom, sur `published` et `suspended` ; jeton de version
  incontournable ; obligatoires recontrôlés.
- C(3), RG36 : aucun chemin sur son propre compte. RG6 : aucune publication sans décision humaine.
- L2BS-7, `15` RG35 : ouverture et lecture des coordonnées journalisées, sans donnée superflue (D60).
- 10 : RG80, `07` RG108 : charge sortante fermée ; aucune raison sociale, immatriculation, note ni coordonnée.
- 09 : message libre de l'agent échappé, sans lien ; aucune injection dans le HTML. 11, 12 : schémas fermés, IDOR, levée
  forcée refusée et journalisée pour un agent, pagination plafonnée, adresse sans donnée personnelle ; L2BS-8.
- Puis le texte de l'attestation `security-reviewed: <date> covers <sha des commits 04 à 07, et de tout commit I-4 ajouté>`
  (D71), à commiter en clôture si rien de bloquant ne reste.
