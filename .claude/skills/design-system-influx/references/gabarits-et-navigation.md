# Gabarits et navigation des espaces connectés

À lire avant de **choisir le gabarit d'un écran** ou de toucher à la navigation. Sources :
`docs/mvp/17-parcours-et-ecrans-espaces-membres.md` §2.2 et §2.3, `17b` §1.7, `20` §11.8, et **D74**
(sous-navigation dans la colonne, qui amende D73).

## Gabarits

| Gabarit | Règle | Source |
|---|---|---|
| Espaces membres < 1 024 px | En-tête (INFLUX, cloche, langue) + **barre du bas de 5 items**, libellés toujours visibles, zone de sécurité de l'appareil ; tablette : même gabarit, cellules plafonnées ; **pas de hamburger**. La barre du bas ne porte jamais de sous-entrée : une rubrique à plusieurs pages ouvre une **page-menu** (liste de liens pleine largeur, phrase d'explication, compteur éventuel), et chaque sous-page porte « ‹ rubrique » au-dessus du `h1` (D74 SN-A) | `17` §2.2 |
| Espaces membres ≥ 1 024 px | **Colonne à gauche** de 16 rem, collante, pleine hauteur, à filet : en-tête (INFLUX, espace et point de rôle), items icône + libellé, bloc d'état du compte, pied (aide, langue, identité, se déconnecter). Les pages d'une rubrique sont une **liste imbriquée dans l'entrée active seulement** (D74 SN-B) | `17` §2.3 |
| Backoffice ≥ 1 024 px | **Rail à gauche** de 15 rem (sept entrées de `17b` §1.2), bande de tête au-dessus du contenu, lignes de 36 px. Le lien d'une entrée ouvre son premier écran, sans page-menu (D74 SN-C) | `17b` §1.7 |
| Backoffice 768–1 023 px | Backoffice complet ; le même `<nav>` en liste horizontale compacte sous la bande, sous-entrées sur une seconde ligne (D74 SN-C) | `17b` §1.7 |
| Backoffice < 768 px ou hauteur < 500 px | Écran « poste de travail », aucun contenu métier, jusqu'aux vues D58 (D73 F7) | `17b` §1.7 |
| Page autonome KEO | Inscription, connexion, déconnecté, compte supprimé, CGU à ré-accepter : INFLUX et langue, une colonne, aucune navigation (les pages légales publiques gardent le gabarit de la vitrine) | `20` §11.8 |

## Règles communes

- **Un seul `<nav>` « Navigation principale », rendu une fois et restylé par le CSS** selon la
  largeur (`02` §21.5), sans détection de largeur en JavaScript ni second `<nav>` masqué ; un libellé
  par entrée, identique aux deux largeurs (≤ 11 caractères).
- **Pages d'une rubrique : sous-menu de la rubrique active** (colonne) ou page-menu (téléphone,
  tablette). **Ni pilules de section ni onglets de rubrique en tête de contenu** (D74 ; SN-D : les
  onglets de rubrique passent en sous-pages). **Exception unique** : les canaux d'une conversation
  (`20` §7) restent des onglets dans la conversation.
- Rubrique ancêtre sans `aria-current`, **un seul `aria-current` par page**.
- Entrées dont l'écran n'existe pas **masquées**, et une entrée apparue ne disparaît plus.
- **Aucun repli de colonne** : le front n'a aucun stockage pour le mémoriser (D37).
- Lien d'évitement en premier ; focus au `h1` après navigation (sans anneau sur un élément non
  interactif focalisé par programme, D75 RK-13).

## Effets des espaces connectés (D73 F6, amendé par D75)

Halo d'en-tête doux par token de rôle, sans bord, à 15 % au plus ; ombre lumineuse du bouton principal
par token (plus forte au survol, absente si désactivé) ; agrandissement à 103 % au survol et
**réduction à 98 % à l'appui**, sous `motion-safe:` seulement, jamais `transition: all` ; soulèvement
des seules **cartes cliquables** ; petits boutons des écrans du backoffice sans effet (RK-4) ; panneaux
flottants seulement s'ils sont pertinents ; aucun token de la vitrine (D59). Détail : `20` §11.5.
