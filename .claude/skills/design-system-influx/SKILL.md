---
name: design-system-influx
description: Concevoir ou modifier un écran INFLUX en respectant la charte noir/vert et le niveau de finition de wekollab.fr — tokens de design, hiérarchie visuelle, états d'écran, accessibilité WCAG AA, affichage des montants. À utiliser avant toute création de composant ou d'interface, et pour étendre la palette.
---

# Design system INFLUX

Objectif : garantir qu'un écran produit aujourd'hui ressemble à ceux produits demain, et qu'il
est compréhensible, accessible et cohérent avec la marque.

Agents concernés : `expert-ux` (principal), `dev-react-node`, `expert-marketing`.

## Identité

| Élément | Règle |
|---|---|
| Nom | **INFLUX**, toujours en capitales |
| Couleur de marque | **Vert** — accent, action principale, succès |
| Texte | **Noir** — contraste fort, lisibilité maximale |
| Base | Fonds clairs, beaucoup de blanc, respiration généreuse |
| Référence | https://wekollab.fr/ — niveau de finition à égaler, jamais à copier |

> ⚠️ **Les valeurs hexadécimales exactes ne sont pas encore figées** (décision D6 de `CLAUDE.md`).
> Travaille en **tokens nommés**. Une nouvelle valeur de couleur doit être proposée, justifiée et
> validée par le fondateur avant d'entrer dans le code.

## Règle absolue

**Aucune couleur, taille de police, espacement ou rayon en dur dans un composant.** Tout passe
par un token. Un composant contenant une valeur littérale est refusé en revue.

## Structure des tokens attendue

Nommer par rôle, pas par apparence (`color-action-primary`, pas `color-green-500`) :

| Famille | Rôles à couvrir |
|---|---|
| Couleur — marque | action principale, survol, actif, désactivé |
| Couleur — texte | principal (noir), secondaire, tertiaire, inversé, sur fond de marque |
| Couleur — surface | fond de page, carte, surface surélevée, bordure, séparateur |
| Couleur — sémantique | succès, alerte, erreur, information |
| Typographie | échelle de tailles, graisses, hauteurs de ligne |
| Espacement | échelle unique, régulière, utilisée partout |
| Rayon / élévation | cohérents sur tous les composants |

**Le vert de marque et le vert « succès » sont deux tokens distincts**, même s'ils se ressemblent :
sinon toute évolution de la marque casse la sémantique des états.

## Procédure pour un nouvel écran

1. **Identifier la population et la tâche** : annonceur · influenceur · agent backoffice.
   Le registre visuel diffère : les surfaces publiques respirent, le backoffice est dense et
   productif (filtres, actions de masse, raccourcis).
2. **Structurer l'information** avant de dessiner : quoi d'abord, quoi ensuite, quoi jamais.
3. **Wireframer** en texte structuré ou schéma ASCII.
4. **Définir tous les états** — un écran sans état vide est incomplet :
   - [ ] Chargement
   - [ ] Vide (première utilisation, avec une action claire pour démarrer)
   - [ ] Nominal
   - [ ] Erreur (message actionnable, pas de trace technique)
   - [ ] Accès refusé
   - [ ] Succès / confirmation
5. **Écrire les microcopies** en **français et en anglais**, ton direct, sans jargon, orienté
   bénéfice. Aucun texte en dur : tout passe par les fichiers de traduction. Prévoir des libellés
   de longueur variable selon la langue.
6. **Vérifier l'accessibilité** (ci-dessous).
7. **Lister les tokens utilisés** et les nouveaux tokens proposés.

## Checklist accessibilité (WCAG AA minimum)

- [ ] Contraste texte/fond ≥ 4,5:1 (texte courant), ≥ 3:1 (texte large et composants d'interface).
- [ ] **Le vert n'est jamais le seul porteur d'information** : toujours doublé d'un texte, d'une
      icône ou d'une forme. Un utilisateur daltonien doit comprendre l'état.
- [ ] Navigation clavier complète, ordre de tabulation logique, focus visible.
- [ ] Chaque champ de formulaire a un libellé explicite associé (pas de placeholder seul).
- [ ] Messages d'erreur reliés au champ concerné et annoncés aux technologies d'assistance.
- [ ] Sémantique HTML correcte (titres hiérarchisés, listes, boutons vs liens).
- [ ] Cibles tactiles suffisamment grandes sur mobile.

## Checklist INFLUX spécifique

- [ ] **Mobile-first** sur tous les parcours influenceurs.
- [ ] **Affichage des montants** : impossible de confondre *montant du contrat*, *commission
      INFLUX (35 % : part annonceur 20 % + part créateur 15 %)* et *net créateur*. Chaque montant
      est étiqueté et affiché avec sa devise, au format de la langue de l'utilisateur.
      L'influenceur voit son net **avant** de signer.
- [ ] **Bilingue** : l'écran existe en français et en anglais, sans texte en dur.
- [ ] **Pas d'incitation à sortir de la plateforme** : aucun écran n'encourage l'échange de
      coordonnées directes.
- [ ] **Deux portes d'entrée** : le discours et le vocabulaire diffèrent entre annonceur et
      influenceur.
- [ ] **Complétude du profil visible et désirable** (elle améliore le matching).
- [ ] **Suggestions de matching explicables** : chaque proposition affiche pourquoi elle est faite.
- [ ] **Backoffice** : densité d'information, filtres, actions de masse, pas de clic superflu.

## Ajouter un token

1. Vérifier qu'aucun token existant ne couvre le besoin (c'est le cas le plus fréquent).
2. Nommer par rôle.
3. Vérifier les contrastes dans tous les usages prévus.
4. Documenter : nom, valeur, rôle, quand l'utiliser et quand ne pas l'utiliser.
5. Faire valider par `expert-ux` ; si la valeur touche la couleur de marque, par le fondateur.

## Format de sortie

**Population et tâche** → **Structure de l'information** → **Wireframe** → **États** →
**Microcopies** → **Tokens utilisés / proposés** → **Vérifications d'accessibilité** →
**À valider par le fondateur**.
