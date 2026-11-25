# Identité, tokens et pièges du dark theme

À lire avant de **nommer, valoriser ou ajouter un token**, ou de trancher une question de teinte, de
contraste ou de police. Les valeurs et contrastes calculés font foi dans `docs/mvp/20-direction-design.md`
§11.3 et §11.4 ; ce fichier en donne les règles d'usage.

## Identité

| Élément | Règle |
|---|---|
| Nom | **INFLUX**, toujours en capitales |
| Thème | **Dark theme par défaut sur toute la plateforme** (vitrine, espaces membres, backoffice) — D6, tranchée par le fondateur le 2026-09-17 |
| Charte par registre | **Vitrine** (landing, pages légales publiques, 404, bandeau cookies) : valeurs D6, direction D59 (carte métallisée, un seul effet spectaculaire par écran). **Espaces connectés** (espaces marque et créateur, inscription, connexion, texte des CGU affiché dans le parcours, backoffice) : **KEO Emerald**, D73 (`20` §11). Un seul `tokens.css` par front : `@theme` porte la vitrine, le bloc `[data-theme="keo"]` re-valorise les mêmes noms ; attribut posé par `app/[locale]/(member)/layout.tsx` (web) et sur `<html>` (backoffice) (`02` §21.3) |
| Fond | **Noir profond nuancé, jamais de noir pur** (`color-surface-page`, `#0a0b0a` en KEO). **Aucune section claire pleine largeur**. Les tokens `*-inverse` ne servent qu'à des accents de petite taille (pastille de compteur, pastille derrière un logo) |
| Texte | **Clair sur fond sombre** (`color-text-primary`, jamais de blanc pur), contraste fort |
| Élévation | Une surface plus haute est **plus claire** (`surface-card` → `surface-raised` → `surface-hover`), toujours doublée d'un filet `border-default` : la surface seule ne se voit pas (1,07 à 1,30:1). Cartes plates ; `shadow-lg` pour les dialogues et menus seulement |
| Couleur de marque | **Vert** — marque et action principale (`color-brand-*`, `color-action-primary-*`) : **`#1dd68a` partout, vitrine comprise** (D73, F2 tranché le 2026-10-29). Le vert reste **rare** : action principale, item actif, sélection |
| Succès | **Sarcelle**, famille distincte du vert de marque (`color-feedback-success-*`) : `#3ccfcf` sous KEO, `#2dd4bf` en vitrine. Teinte du texte et de l'icône de succès **à au moins 20°** de l'action principale (repos, survol, appui) et de l'information, dans chaque charte (garde G3d, `20` §11.3). Le plein reste réservé à l'action : un succès n'est jamais plein |
| Erreur | **Rouge opaque** (D72, garde G3b), jamais translucide ni teinté en fond |
| Polices | Espaces connectés : **Manrope** (titres, chiffres clés, boutons, surtitres) et **Source Sans 3** (corps, champs, navigation, tableaux), par `next/font/local` et fichiers versionnés (`02` §21.4) ; graisses Manrope 700 et 800, Source Sans 3 400 et 600. Vitrine : police système |
| Formes | Pilule pour les boutons, badges et pastilles ; carte à 16 px (`radius-card`) dans les espaces connectés |
| Références | Finition : https://wekollab.fr/, à égaler, jamais à copier. Navigation des espaces connectés : Railway, en comportement seulement (`20` §3) |

**Les valeurs sont figées (D6, D73).** Le choix de la maquette KEO par le fondateur vaut validation de
ses valeurs ; toute **autre** valeur de couleur (y compris une valeur KEO écartée qu'on voudrait
reprendre) est proposée, justifiée (contraste calculé) et validée par le fondateur avant d'entrer
dans le code. Une extension qui ne fait qu'**aliaser** un token existant relève d'`expert-ux`.

## Structure des tokens attendue

Nommer par rôle, pas par apparence (`color-action-primary-bg`, pas `color-green-500`), **ni par
registre ou par maquette** (jamais `keo-*`, `spotify-*`, `surface-3`). Les mêmes noms valent dans les
trois registres ; **la valeur dépend du registre** (`20` §11.1).

| Famille | Rôles à couvrir |
|---|---|
| Couleur — marque et action | action principale, survol, appui, désactivé, action secondaire (fond, contour ≥ 3:1, survol), danger |
| Couleur — texte | principal (clair), secondaire, tertiaire (jamais sur `surface-active`), sur action (sombre), inversé, désactivé |
| Couleur — surface | page, muette, carte, surélevée, survol, active, bordures (subtile, défaut, forte ≥ 3:1, sélection, erreur), focus |
| Couleur — sémantique | succès (sarcelle), alerte, erreur, information — chacune en texte, fond, bordure, icône. **Erreur = rouge opaque** : fond du conteneur (`transparent`), bordure pleine, icône et texte rouges, jamais de fond rouge teinté ni de rouge translucide ; action destructive = bouton `action-danger-*` plein (`20` §10, garde G3b). Succès, alerte et information gardent un fond teinté **opaque** (DZ-6). **Seule exception** : le fond du **badge de statut d'erreur** (`color-badge-error-bg`, D75 RK-B), jamais celui d'une notice |
| Couleur — rôles et vérifié | `role-advertiser` (sable), `role-creator` (rose) : **marque visuelle seulement**, point suivi du rôle écrit, liste fermée d'usages (`20` §11.3) ; `verified-text` (bleu) : badge « Vérifié · réseau · date », jamais une coche seule |
| Couleur — navigation | survol, item actif, indicateur, pastille de compteur |
| Couleur — données | trois couleurs de série, graphiques seulement, jamais pour un état ou un rôle |
| Couleur — backoffice | vue identifiée (violet, **seule teinte réservée au backoffice**), délais, alertes, environnement (`17b` §6) |
| Typographie | familles par registre (`font-display`, `font-base`), échelle fixe dans les espaces connectés (`text-title-page`, `text-title-section`, plancher `text-xs`), graisses, interlignes ; chiffres tabulaires pour les montants |
| Espacement | échelle unique de base 4 px, tokens sémantiques |
| Rayon / élévation | `radius-card`, `radius-md`, `radius-sm`, `radius-pill`, cohérents sur tous les composants ; cartes plates |

**Le vert de marque et le « succès » sont deux familles distinctes** : sinon toute évolution de la
marque casse la sémantique des états, et un état ressemble à une action.

## Pièges propres au dark theme

| Piège | Règle |
|---|---|
| **Logos de marques** | Beaucoup sont dessinés pour fond blanc et disparaissent sur fond noir. Tout logo déposé par une marque s'affiche sur une **pastille claire** (`color-logo-plate`), jamais directement sur une surface sombre |
| **Vert en texte** | Le vert vif est fait pour les boutons et les accents, avec du **texte sombre dessus** (`color-text-on-action`). En texte courant, un vert saturé vibre et fatigue : réserver `color-text-brand` aux mots-clés et aux liens survolés ; jamais sur un montant ni sur un état |
| **Gris trop pâles** | Ne jamais descendre sous `color-text-tertiary`, et ne l'utiliser que pour des aides, des dates et des provenances. Il tombe à 4,13:1 sur `surface-active` : interdit là |
| **Rouge sur surface claire** | Le texte d'erreur tient 4,53:1 sur `surface-hover`, 3,91:1 sur `surface-active` : jamais au-delà de `surface-hover` |
| **Translucide** | Pas de fond en `rgba` pour une couleur d'état : sa valeur change selon la surface et son contraste devient invérifiable. Interdit pour le rouge (G3b), évité partout ailleurs. Seul `color-mix(in srgb, var(--color-brand-primary) N%, transparent)` est admis, dans les tokens d'ombre du bouton et de halo d'en-tête du bloc KEO (D75 RK-A), jamais dans un `--color-*` |
| **Émeraude et sarcelle** | La sarcelle de la vitrine `#2dd4bf` n'est qu'à 17° du vert KEO : sous KEO, le succès est `#3ccfcf` (25°). Toute nouvelle teinte de succès ou d'action se vérifie contre le seuil de 20° (G3d) ; la forme reste un second séparateur (plein = action ; succès en contour + icône + mot) |
| **Ressemblance avec Spotify** | Vert vif sur noir, pilules, halo, ombre lumineuse du bouton, agrandissement, soulèvement et panneaux flottants (gardés, F6, D75) : les signatures INFLUX doivent se voir sur chaque gabarit ; panneau flottant seulement s'il sert l'écran (`20` §11.7) |
| **Polices** | `next/font/local`, fichiers variables versionnés, sous-ensembles latins, métriques de repli ajustées ; **aucun appel à Google Fonts** (`next/font/google` interdit) ; chargées par les deux seules mises en page KEO, jamais par la vitrine |
| **E-mails** | Les clients de messagerie inversent les couleurs à leur manière. Un e-mail (dont le **code de connexion**, D43) a son propre gabarit, **testé en clair et en sombre** ; ce n'est pas une copie du dark theme |
| **Lecture en extérieur** | Un fond sombre se lit moins bien en plein soleil. Les écrans créateur se testent **dehors, sur un vrai téléphone**, pas seulement au bureau |
| **Captures d'écran** | Une information portée par un fond teinté disparaît sur une capture recadrée ou une impression. La **forme et le texte** la portent ; la couleur ne fait que renforcer |

## Ajouter un token

1. Vérifier qu'aucun token existant ne couvre le besoin (c'est le cas le plus fréquent) ; un
   **alias** d'un token existant est préférable à une nouvelle valeur.
2. Nommer par rôle ; dire dans quel(s) registre(s) il vaut et, s'il diffère, sa valeur dans chacun.
3. Vérifier les contrastes dans tous les usages prévus, sur chaque surface sombre concernée.
4. Documenter : nom, valeur, rôle, quand l'utiliser et quand ne pas l'utiliser (`20` §11 pour les
   espaces connectés).
5. Faire valider par `expert-ux` ; toute **nouvelle valeur de couleur** par le fondateur (D6) — une
   valeur de la maquette KEO écartée en `20` §11.6 compte comme une nouvelle valeur.
