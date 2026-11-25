# Procédure pour un nouvel écran

À lire en **début de conception d'un écran** (étapes), puis en **fin de travail** pour le format de
sortie et le détail des montants.

## Étapes

1. **Identifier la population, la tâche et le registre** : annonceur · créateur · commercial,
   et vitrine · espace membre · backoffice (tableau des registres de `SKILL.md`) — le registre décide
   de la charte.
2. **Choisir le gabarit** (`references/gabarits-et-navigation.md`) et **la référence de comportement**
   dans `docs/mvp/20-direction-design.md` §3 — en notant ce qu'on ne lui prend pas.
3. **Structurer l'information** avant de dessiner : quoi d'abord, quoi ensuite, quoi jamais.
4. **Wireframer** en texte structuré ou schéma ASCII.
5. **Définir tous les états** — un écran sans état vide est incomplet :
   - [ ] Chargement
   - [ ] Vide (première utilisation, avec une action claire pour démarrer)
   - [ ] Nominal
   - [ ] Erreur (message actionnable, pas de trace technique)
   - [ ] Accès refusé
   - [ ] Succès / confirmation
6. **Écrire les microcopies** en **français et en anglais**, ton direct, sans jargon, orienté
   bénéfice. Aucun texte en dur : tout passe par les fichiers de traduction. Prévoir des libellés
   de longueur variable selon la langue, et des formulations neutres en genre.
7. **Vérifier l'accessibilité** (check-list de `SKILL.md`).
8. **Lister les tokens utilisés** et les nouveaux tokens proposés, en reprenant les composants de
   `20` §11.8 avant d'en créer un (nouveau token : `references/identite-et-tokens.md`).

## Affichage des montants — régime du pilote (D48)

Aucun taux et aucun net créateur estimé, ni côté marque ni côté créateur ; la commission est
« incluse, précisée par votre commercial ». Au backoffice, trois libellés jamais interchangeables :
*montant négocié*, *commission convenue*, *commission encaissée* — **toujours avec la devise**, jamais
de pourcentage, jamais de total toutes devises, **jamais un montant déduit d'un autre** : chaque
montant affiche **qui l'a saisi et quand**. Chiffres tabulaires, montant et devise insécables, montants
en `text-primary` (jamais en vert). *(Cible V2 : les trois notions montant du contrat / commission et
ses deux parts / net créateur, dans un même bloc — `17` §7.3.)*

## Format de sortie

**Population, tâche et registre** → **Référence de comportement (et ce qu'on n'en prend pas)** →
**Structure de l'information** → **Wireframe** → **États** → **Microcopies** →
**Tokens utilisés / proposés** → **Vérifications d'accessibilité** → **À valider par le fondateur**.
