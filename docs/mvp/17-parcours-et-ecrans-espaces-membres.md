# Parcours et écrans des espaces membres — marque et créateur

> **Date :** 2026-09-19 · **Auteur :** agent `expert-ux` · **Statut :** conception UX complète des
> **deux espaces membres** du MVP (`apps/web`), soumise au fondateur (branding, §9),
> à `expert-conformite-rgpd` (veto : information des personnes, libellés du badge, texte
> d'acceptation) et à `product-owner` (cohérence avec les règles de gestion).
>
> **Skill appliquée :** `design-system-influx` (format de sortie, checklist d'accessibilité,
> procédure de token).
>
> **Documents qui contraignent celui-ci, et qui priment en cas d'écart :** `CLAUDE.md` §2 à §5 ·
> `docs/mvp/00-cadrage-mvp-v2.md` §6.1 et §6.2 · `03-matrice-des-droits-et-rls.md` (ce qu'un membre
> ne voit jamais) · `05-spec-inscription-et-leads.md` · `06-criteres-profil-marque.md` ·
> `07-criteres-profil-createur-reseaux-audience.md` · `08-verification-et-badge.md` ·
> `09-criteres-campagne.md` · `10-recherche-createurs-anonymisee.md` ·
> `11-recherche-campagnes-et-candidature.md` · `12-messagerie-a-trois.md` ·
> `13-file-de-validation-et-mise-en-relation.md`.
> Référence de forme : `docs/landing-page/02-ux-wireframes.md` §2 et §2.8.
> Tokens : `apps/web/src/styles/tokens.css` (**D6 tranchée, dark theme, 2026-09-17**).
>
> **Ce que ce document tranche :** l'architecture de l'information des deux espaces, la navigation,
> le routage, les wireframes, la hiérarchie de chaque écran, les états, les clés de traduction et
> les tokens employés.
>
> **Ce qu'il ne tranche pas :** les règles de gestion (elles sont **citées**, jamais redéfinies), la
> copie finale (`expert-marketing` pour le ton, juriste pour les mentions légales), le backoffice
> (`15` et `16`), l'implémentation (`dev-react-node`).
>
> **Invariant rappelé :** au MVP, **aucun taux et aucun calcul de commission dans le code**
> (`CLAUDE.md` §3, régime transitoire). Les montants nets affichés au créateur sont **lus dans le
> référentiel des tranches** (`07` RG72, `09` RG59, `11` RG57). Aucun écran de ce document ne
> multiplie un montant par un taux.

---

## 0. Conventions de lecture

| Notation | Sens |
|---|---|
| `espace.x.y` | Clé de `apps/web/src/locales/{fr,en}/<fichier>.json`, format ICU (D28, next-intl) |
| **Max** | Longueur maximale en caractères, espaces compris, **en FR comme en EN**. Au-delà on réécrit, on ne tronque jamais |
| `[■ Libellé]` / `[□ Libellé]` | Bouton principal / bouton secondaire |
| `[× Libellé]` | Bouton destructif ou de refus (secondaire + libellé explicite, jamais rouge seul) |
| `[◦ Libellé]` | Bouton texte |
| `[i:nom]` | Icône `lucide-react`, décorative (`aria-hidden`) sauf mention contraire |
| `( ) / (•)` | Choix exclusif non sélectionné / sélectionné |
| `[ ] / [x]` | Case à cocher non cochée / cochée |
| `▣` | Image (logo de marque, visuel de portfolio modéré) |
| `A` · `I` · `N` | Couche de visibilité d'un champ créateur : **A**nonyme · **I**dentifiée après révélation · i**N**terne (`07` RG16) |
| `06 RG73` | Renvoi à une règle de gestion existante. **Ce document ne crée aucune règle de gestion.** |
| Largeurs | Mobile 375 px (référence de conception) · Desktop 1440 px, contenu dans `container-max` |

**Trois règles de lecture des wireframes.**

1. Un schéma montre **la hiérarchie et l'ordre du DOM**, jamais la mise en forme finale.
2. Les mots inscrits indiquent **l'intention du texte**, pas sa formulation : la copie relève de
   `expert-marketing`, les mentions légales du juriste.
3. Tout ce qui est affiché à l'écran est **aussi contrôlé côté serveur**. Un champ absent de l'écran
   mais présent dans la réponse d'API est une fuite (`07` RG18, `10` RG48, `13` RG71) : ce document
   ne conçoit jamais un masquage d'affichage.

---

## 1. Cadrage : populations, tâches, enseignements du benchmark

### 1.1 Les deux populations et leur tâche réelle

| | **Marque** (rôle `advertiser`) | **Créateur** (rôle `creator`) |
|---|---|---|
| Contexte d'usage | Desktop en journée, au bureau, entre deux réunions. Session longue, multitâche | **Mobile, debout, entre deux tournages.** Session courte, interrompue, souvent en 4G |
| Tâche dominante | « Trouver 3 créateurs crédibles pour ma campagne, sans y passer la semaine » | « Est-ce que cette offre vaut mon temps, et **combien je touche** ? » |
| Ce qu'elle craint | Payer pour une audience achetée ; perdre du temps avec des profils hors sujet | Travailler pour rien ; découvrir une retenue après coup ; être fantôme |
| Rythme de retour | 1 à 3 fois par semaine pendant une campagne | 1 fois par jour au début, puis à la notification |
| Vocabulaire | campagne, brief, livrables, droits d'usage, budget | offre, contenu, tarif, **ce que je touche**, délai |
| Conséquence de conception | Densité acceptable, tableaux, filtres, prévisualisation | **Mobile-first strict**, une décision par écran, pouce atteignable, texte court |

**Conséquence non négociable** (`CLAUDE.md` §5.2 principe 2, D41) : **aucun écran n'est partagé
entre les deux rôles.** Pas de composant « profil » générique paramétré par un rôle, pas de
navigation commune conditionnée, pas de libellé mutualisé. Les seuls écrans réellement communs sont
ceux du §3 (inscription/connexion, avant que le rôle n'existe) et du §6 (mes données, mes sessions),
et même là le **vocabulaire diffère** dès que le rôle est connu.

### 1.2 Enseignements du benchmark

**wekollab.fr**, consulté pour la fonction des blocs, jamais pour le texte ni le visuel — complété
par ce que font les places de marché à deux faces (Malt, Upwork, Kolsquare) sur les points précis
traités ici.

| Ce qui fonctionne ailleurs | Ce qu'INFLUX fait autrement, et pourquoi |
|---|---|
| Profil créateur avec photo, pseudo, abonnés exacts | **Interdit** (`07` RG29, `10` RG48). L'attractivité est portée par le **titre court, le portfolio modéré, les tranches et les badges datés** — pas par un visage |
| Compteur exact de résultats (« 248 créateurs ») | **Tranche** (`10` RG59). Un compteur exact est un oracle de ré-identification. Contrepartie UX : la tranche doit être **affichée comme une information de confiance**, pas comme une excuse |
| « Contacter » directement depuis une carte | **Impossible** (A9). L'action est « demander une mise en relation », et le bouton **énonce le processus et son délai** (`10` RG52, D39) : promettre un contact immédiat fabrique la déception |
| Score de compatibilité en pourcentage | **Interdit** (`10` RG5). Remplacé par la ligne « Proposé car : … », 2 à 4 raisons **vérifiables sur la carte** (`10` RG41) |
| Onboarding en 8 étapes obligatoires avant d'entrer | Inscription en **3 écrans, sans mot de passe** (`05` RG2). Le profil se complète **après**, depuis l'espace, avec une complétude **factuelle et mesurable** (`06` RG61, `07` RG90) |
| Messagerie « comme WhatsApp », pièces jointes libres | **Conversation à trois, commercial nommé, aucune pièce jointe** (`12` RG2, RG36). Un canal de documents séparé, contrôlé, sans contrat ni facture (`12` §F) |
| Prix affiché « à partir de X € HT » | **Trois notions nommées côte à côte** côté créateur (`07` RG69), **coût total seul** côté marque (`06` RG32, `09` RG61). Jamais « HT » ni « TTC » tant que D7 est ouverte |
| Badge « Vérifié » générique | Badge **par réseau, daté, avec ce qu'il n'affirme pas** (`08` RG4, RG10). C'est moins flatteur et c'est défendable devant une marque mécontente |

### 1.3 Les six décisions de conception qui structurent tout le reste

1. **Une décision par écran sur mobile.** Le créateur n'a jamais deux actions principales à l'écran.
2. **Le montant ne se découvre jamais.** Partout où un chiffre d'argent apparaît côté créateur, les
   trois notions sont nommées **au même endroit, dans le même bloc, avec la devise** (§7.3).
3. **Le statut est toujours écrit.** Les 6 états d'une campagne, les 5 d'un profil, les 8 d'une
   candidature et les 8 d'une mise en relation portent chacun un **libellé textuel** ; la couleur ne
   fait que renforcer (`09` RG110, `11` RG80, `13` RG117).
4. **Aucun bouton désactivé sans explication adjacente** (`09` RG4, `11` RG46). Un bouton gris muet
   est un défaut de conception, pas une protection.
5. **Le brouillon se sauvegarde seul** (`06` RG83, `07` RG111, `09` RG108, `11` RG52). Aucun écran de
   ce document ne perd une saisie, y compris au dépôt d'un fichier et y compris sur erreur serveur.
6. **Rien n'invite à sortir de la plateforme.** Aucun `mailto:`, aucun lien cliquable dans un
   message (`12` RG41), aucun bouton « échanger nos coordonnées », aucune notification contenant un
   extrait de texte (`12` RG90).

---

<!-- SUITE -->
