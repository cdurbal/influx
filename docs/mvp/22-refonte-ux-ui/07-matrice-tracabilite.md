# 07 — Matrices de traçabilité

> Produites par script ; à régénérer après toute modification d'une fiche. Chaîne :
> `Maquette → Écran → Section → Composant → Spécification → Critère d'acceptation → Test`.

## 1. Contrôles passés (2026-11-25)

- 1099 éléments, 621 critères, 258 tests ; aucun identifiant en double ; chaque élément cite au moins un critère et un test existants ; aucun critère ni test fantôme.
- **Contrôle inverse** : 1 084 textes structurants des maquettes (titres, boutons, libellés de champ, en-têtes, badges, notices, liens) recherchés dans les fiches. 922 retrouvés mot pour mot ; 162 restants, tous classés dans `07b-textes-complementaires.md` (coquille, donnée d'exemple, référentiel, clé existante, renvoi, hors lot).
- Chaque maquette validée (23) et chaque état (147) relève d'une fiche.

## 2. Détail

| Fichier | Lignes |
|---|---|
| `matrice/membres-entree.md` | 217 |
| `matrice/marque-recherche.md` | 134 |
| `matrice/marque-campagnes.md` | 220 |
| `matrice/createur.md` | 183 |
| `matrice/bo-travail.md` | 181 |
| `matrice/bo-fiches.md` | 164 |

## 3. Couverture par écran

| Écran | Maquette | Éléments | Critères | Tests | Questions (famille) |
|---|---|---|---|---|---|
| E01.0 | proto-accueils | 17 | 8 | 3 | 20 |
| E01.1 | proto-accueils | 33 | 14 | 5 | 20 |
| E01.2 | proto-accueils | 32 | 14 | 5 | 20 |
| E02.1 | proto-recherche | 46 | 30 | 11 | 16 |
| E02b.1 | proto-profil-anonyme | 44 | 25 | 9 | 12 |
| E03.1 | proto-profil | 18 | 12 | 5 | 21 |
| E03.2 | proto-profil | 3 | 3 | 1 | 21 |
| E03.3 | proto-profil | 12 | 8 | 3 | 21 |
| E03.4 | proto-profil | 5 | 3 | 1 | 21 |
| E03.5 | proto-profil | 7 | 5 | 2 | 21 |
| E03.6 | proto-profil | 8 | 6 | 3 | 21 |
| E03.7 | proto-profil | 7 | 6 | 2 | 21 |
| E03.8 | proto-profil | 5 | 3 | 1 | 21 |
| E04.1 | proto-bo-accueil | 48 | 22 | 11 | 19 |
| E05.1 | proto-bo-decision | 42 | 23 | 10 | 17 |
| E05.2 | proto-bo-decision | 7 | 5 | 2 | 17 |
| E05.3 | proto-bo-decision | 8 | 4 | 2 | 17 |
| E05.4 | proto-bo-decision | 6 | 4 | 2 | 17 |
| E05.5 | proto-bo-decision | 6 | 5 | 2 | 17 |
| E05.6 | proto-bo-decision | 5 | 3 | 2 | 17 |
| E05.7 | proto-bo-decision | 5 | 4 | 2 | 17 |
| E05.8 | proto-bo-decision | 4 | 3 | 2 | 17 |
| E05.9 | proto-bo-decision | 5 | 3 | 1 | 17 |
| E05b.1 | proto-marque | 28 | 16 | 7 | 13 |
| E05b.2 | proto-marque | 4 | 5 | 2 | 13 |
| E06.1 | proto-bo-fiche-compte | 33 | 17 | 8 | 18 |
| E06.2 | proto-bo-fiche-compte | 16 | 9 | 5 | 18 |
| E07.1 | proto-campagne | 30 | 16 | 3 | 25 |
| E07.2 | proto-campagne | 8 | 5 | 1 | 25 |
| E07.3 | proto-campagne | 6 | 3 | 1 | 25 |
| E07.4 | proto-campagne | 11 | 5 | 1 | 25 |
| E07.5 | proto-campagne | 8 | 4 | 2 | 25 |
| E07.6 | proto-campagne | 24 | 12 | 3 | 25 |
| E07.7 | proto-campagne | 7 | 3 | 1 | 25 |
| E08.1 | proto-campagnes-createur | 12 | 9 | 4 | 10 |
| E08.2 | proto-campagnes-createur | 13 | 10 | 3 | 10 |
| E09.1 | proto-selections | 15 | 7 | 3 | 12 |
| E09.2 | proto-selections | 19 | 9 | 8 | 12 |
| E09.3 | proto-selections | 10 | 9 | 4 | 12 |
| E10.1 | proto-profil-marque | 23 | 11 | 3 | 23 |
| E10.2 | proto-profil-marque | 10 | 4 | 1 | 23 |
| E10.3 | proto-profil-marque | 7 | 3 | 1 | 23 |
| E10.4 | proto-profil-marque | 14 | 5 | 1 | 23 |
| E10.5 | proto-profil-marque | 4 | 2 | 1 | 23 |
| E10.6 | proto-profil-marque | 8 | 4 | 3 | 23 |
| E10.7 | proto-profil-marque | 5 | 3 | 1 | 23 |
| E11.1 | proto-entree | 9 | 5 | 2 | 26 |
| E11.2 | proto-entree | 9 | 6 | 3 | 26 |
| E11.3 | proto-entree | 3 | 2 | 2 | 26 |
| E11.4 | proto-entree | 17 | 10 | 5 | 26 |
| E11.5 | proto-entree | 15 | 10 | 4 | 26 |
| E11.6 | proto-entree | 9 | 4 | 3 | 26 |
| E11.7 | proto-entree | 5 | 3 | 2 | 26 |
| E12.1 | proto-mes-campagnes | 23 | 12 | 4 | 9 |
| E13.1 | proto-bo-recherche | 32 | 14 | 6 | 15 |
| E14.1 | proto-verifications | 11 | 7 | 3 | 10 |
| E14.2 | proto-verifications | 9 | 6 | 2 | 10 |
| E14.3 | proto-verifications | 11 | 7 | 3 | 10 |
| E14.4 | proto-verifications | 8 | 5 | 3 | 10 |
| E15.1 | proto-apercu | 22 | 11 | 4 | 8 |
| E16.1 | proto-bo-listes | 23 | 13 | 7 | 16 |
| E16.2 | proto-bo-listes | 13 | 10 | 4 | 16 |
| E17.1 | proto-bo-campagne | 27 | 15 | 6 | 13 |
| E18.1 | proto-campagne-marque | 32 | 16 | 5 | 15 |
| E19.1 | proto-bo-mobile | 9 | 9 | 6 | 10 |
| E20.1 | proto-compte | 6 | 3 | 2 | 24 |
| E20.2 | proto-compte | 13 | 7 | 4 | 24 |
| E20.3 | proto-compte | 15 | 9 | 3 | 24 |
| E20.4 | proto-compte | 8 | 4 | 1 | 24 |
| E20.5 | proto-compte | 10 | 6 | 2 | 24 |
| E20.6 | proto-compte | 8 | 6 | 2 | 24 |
| E20.7 | proto-compte | 8 | 6 | 1 | 24 |
| E21.1 | proto-bo-admin | 13 | 6 | 3 | 25 |
| E21.2 | proto-bo-admin | 3 | 2 | 1 | 25 |
| E21.3 | proto-bo-admin | 11 | 7 | 4 | 25 |
| E21.4 | proto-bo-admin | 11 | 5 | 1 | 25 |
| E21.5 | proto-bo-admin | 8 | 4 | 3 | 25 |
| E21.6 | proto-bo-admin | 5 | 3 | 1 | 25 |
| E21.7 | proto-bo-admin | 5 | 4 | 2 | 25 |
