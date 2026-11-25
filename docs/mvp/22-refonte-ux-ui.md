# 22 — Lot 3bis : refonte UX/UI des écrans existants (code RU)

> **Date :** 2026-11-25 · **Rédigé par :** Claude Code, à la demande du fondateur · **Statut : lot validé par
> le fondateur le 2026-11-25 (D87, arbitrages partiels).** **Aucun code n'est commencé, ni permis sans accord distinct.** Place : après le Lot 3 (clos le 2026-11-21), **avant le Lot 4**.
> Sources : maquettes validées les 2026-11-23 et 2026-11-24 (`../audit-ux-ui/07-CONCEPTION-VISUELLE.md`,
> `../audit-ux-ui/prototypes/`), audit (`../audit-ux-ui/01` à `06`), code de `main` (`954e009`), `17`, `17b`, `20`.

## 1. Objectif

Donner aux écrans existants la forme exacte des maquettes validées, et poser les composants que les Lots 4 et
suivants réutiliseront.

**C'est une refonte de l'interface existante, pas une nouvelle implémentation des fonctions.** Règles métier,
droits, RLS, validations, machines à états, verrous, journaux, e-mails, synchronisations et contrats d'API
restent ceux d'aujourd'hui. Ce qui touche l'un d'eux est une décision écrite (`22-refonte-ux-ui/06a`), jamais une
conséquence de la maquette.

## 2. Documents du lot

| Document | Contenu |
|---|---|
| `22-refonte-ux-ui/01-inventaire-ecrans.md` | **B** — inventaire : routes, maquettes, variantes, composants, complexité |
| `22-refonte-ux-ui/ecrans/E…md` (40 fichiers) | **C** — spécification de chaque écran : structure mesurée, éléments, textes, états, responsive, critères, tests, écarts, questions |
| `22-refonte-ux-ui/02a-composants-fondations.md`, `02b-composants-metier.md` | **D** — 68 composants partagés ; propriétés et états : `02c` |
| `22-refonte-ux-ui/03-design-system-et-tokens.md` | **E** — tokens gardés, ajoutés, à arbitrer ; règles de composition |
| `22-refonte-ux-ui/04-animations.md` | **F** — 33 interactions, mouvement réduit |
| `22-refonte-ux-ui/07-matrice-tracabilite.md`, `07a`, `07b`, `matrice/` | **G** — 1 099 éléments tracés ; composants vers écrans ; textes |
| `22-refonte-ux-ui/08-plan-de-developpement.md`, `jalons/lot3bis-plan.md` | **H** — 12 jalons, 105 tâches |
| `22-refonte-ux-ui/05-recette-visuelle.md` | Comparaison aux maquettes, accessibilité, non-régression, critères de fin |
| `22-refonte-ux-ui/06a-decisions.md` | 45 décisions, 387 questions (171 bloquantes pour leur écran) |
| `22-refonte-ux-ui/06b-ecarts-et-anomalies.md` | Contradictions, anomalies, données non servies, spécifications à amender, journal des écarts |

**Lire pour une tâche** : sa ligne dans `08` → la fiche `ecrans/E…` (§1 à §3, puis le reste) → les composants cités
dans `02a` / `02b` → `05` §8. Aucun fichier ne dépasse 30 Ko. La maquette s'ouvre dans un navigateur :
`proto-x.html#etat`.

## 3. Périmètre

| | Contenu |
|---|---|
| **Inclus** | 78 écrans : 70 dessinés, 8 décisions de file sans maquette mais au même cadre. Membres communs 16 · marque 21 · créateur 17 · backoffice 24. Les deux coquilles. 147 états de maquette. FR et EN (membres), FR (backoffice, D36) |
| **Inclus, sans maquette** (§10 des fiches E04, E09, E11, E15, E18, E20, E21b) | CGU bloquantes, écrans autonomes (déconnecté, supprimé, suspendu, interne), erreurs et 404 membres, aperçu de campagne, marque vérifiée, demande de sélection, réglages de recherche, sources de registre, invitations internes. Règle : composants du catalogue, textes et comportements actuels, forme validée sur capture (RU-26 à RU-28) |
| **Exclus** | Vitrine (landing, pages légales publiques, bandeau cookies) · connexion et activation du backoffice (jetons seuls) · cible Lot 4 dessinée : candidature (8), sélection et proposition (13), backoffice sur téléphone (E19.2 à E19.4) · sélection préparée par l'équipe (`cible-equipe`, 9) · pipeline, e-mails et files 8, 10 à 16 (Lots 4 et 5) |
| **Nouveaux écrans ou routes** | « Mes vérifications » (E14.1), page de la marque (E05b.1, E05b.2), file des échecs de synchronisation (E21.1), « Vérifier et envoyer » par adresse d'étape (E07.6, E10.4) : RU-24, RU-24, RU-32, RU-40 |

## 4. Fidélité aux maquettes

1. La maquette fixe structure, dimensions, espacements, couleurs, typographie, libellés, icônes, états et
   enchaînements. Interdits : simplifier, réinterpréter, ajouter, retirer, garder un ancien composant « parce
   qu'il existe ».
2. En cas de conflit : sécurité, RGPD et règles métier d'abord, puis la maquette, puis la charte `20`, puis
   l'existant. Le conflit est **toujours** une question écrite ; l'écran attend.
3. Une valeur de maquette sans token devient un token (`03`), jamais un littéral.
4. Le bandeau jaune, les données d'exemple et les visuels en dégradé ne sont pas reproduits.
5. Tout écart accepté est inscrit dans `06b` §7 avec l'accord du fondateur.

## 5. Invariants et non-régression

- Anonymat avant révélation, k-anonymat, tranches (D45, D46, D61) ; ni e-mail, ni téléphone, ni site de
  l'autre partie. Aucun taux, net, score, ni montant côté créateur (D11, D48, D78).
- Textes de consentement, mentions et effacement : mot pour mot jusqu'à avis contraire (RU-30).
- Droits, RLS, journalisation des lectures privilégiées, double validation (D84), verrous (D81), limites de débit.
- Le front n'a ni clé Supabase ni logique métier ; aucune dépendance ajoutée.
- Specs, planchers, `data-*`, rôles et noms accessibles : `05` §7. Vitrine inchangée.

## 6. Dépendances

| Sens | Lot | Nature |
|---|---|---|
| Amont | 1 à 3 (clos) | Écrans refondus ; réserves de `21` §8 inchangées |
| Amont | D86 | Brouillon de campagne avant publication : réalisé ici (E12.1, E01.1) |
| Amont | L3G | Sélection jointe, RG61.1 à RG61.6, non codée (RU-22) |
| Aval | 4 | Emplacements prévus : encadré de E02b et E08, sélection de E13 ; `08` §15 |
| Aval | 5 | Files, fiches, pipeline et e-mails sur C57 à C63 |
| Aval | 6, 6bis | Recette intégrale ; filtres du fil (EC-L3D-2, RU-35) |
| Transverse | `expert-marketing`, juriste (D34), `expert-conformite-rgpd` | Textes EN, badges, consentement |

## 7. Conditions de validation du lot

Les dix critères de `22-refonte-ux-ui/05-recette-visuelle.md` §9, chacun avec sa preuve. Un écran est « fait »
quand ses critères `CA` sont prouvés, la comparaison N1 à N3 passe sur toutes ses largeurs et le fondateur l'a
validé sur `staging`.

## 8. Risques

| Risque | Gravité | Parade |
|---|---|---|
| Arbitrages en retard : 171 questions bloquantes | Forte | Trancher par lot de décisions (`06a` §1), dans l'ordre des jalons |
| Maquettes suivies à la lettre qui suppriment des champs ou gestes obligatoires | Forte | RU-26 ; contrôle champ par champ des fiches |
| Données non servies : écrans incomplets | Forte | RU-21, jalon `RUD` avant les écrans |
| Textes réglementaires réécrits dans les maquettes | Forte | RU-30 |
| Charge sous-estimée (audit : 36 à 54 jours ; ici 90 à 120, hors API) | Moyenne | Mesure après `RUB` ; jalons indépendants |
| Specs e2e couplées au DOM, budget e2e | Moyenne | Même commit ; +20 s par jalon |
| Régression d'accessibilité héritée des maquettes | Moyenne | RU-12, axe 0 |
| Dérive entre les deux fronts | Moyenne | RU-18, mêmes noms et props |
| Sessions concurrentes | Faible | Un jalon par zone |
