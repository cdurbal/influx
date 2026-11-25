# E04 — Tableau de bord et coquille du backoffice (agent, administrateur)
> Maquette : `proto-bo-accueil.html` (états `matin`, `calme` ; dialogue `#keys`) · page de comparaison `ecran-4-bo-tableau-de-bord.html` · validée le 2026-11-23 ; rail mis à jour le 2026-11-24 (`07` l. 9 et l. 239) · Constats : U05, U38, U40, U44, U57.
> La coquille (C57) est décrite ici une fois ; E05, E06, E13, E16, E17, E21 y renvoient. Backoffice en français seul : libellés dans `apps/backoffice/src/messages/fr.ts`, aucun EN (D36 ouverte, Lot 5).

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E04.1 | Tableau de bord (et coquille) | `/accueil` | aucune (D36) | `HomeScreen.tsx`, `QueueSummary.tsx`, `Shell.tsx`, `BoNav.tsx`, `bo-nav.ts` | `matin`, `calme`, dialogue `#keys` | XL | C57, C58, C26, C27, C29 ; API compteurs (Q01, Q02) ; E16 (listes) ; E21 (échecs, actions) |

**À préserver** (chemins sous `apps/backoffice/src/components/`)

| Fonction | Fichier:ligne | Règle |
|---|---|---|
| Session lue au montage et à chaque changement de chemin, écran conservé | `Shell.tsx:98-117` | `02` §21.5 |
| Bande : environnement toujours écrit, mode d'envoi hors production | `Shell.tsx:204-228` | `16` RG118, D70 |
| Bandeaux code de secours et contrôle par les pairs | `Shell.tsx:292-305` | `15` RG107, CA71 |
| Entrées absentes pour un `agent` (Administration, double validation) | `bo-nav.ts:115-135`, `navItemsOf` | CA63 |
| Un seul `nav`, un seul `aria-current` par page | `BoNav.tsx:59-107` | D74 |
| Lien d'évitement ; focus du `h1` après navigation, jamais au premier chargement | `Shell.tsx:248-282` | `17b` §1.7 |
| États chargement, session illisible, déconnecté | `Shell.tsx:145-176` | `17b` §1.7 |
| Collecteur d'erreurs du navigateur | `Shell.tsx:94` | D60 |
| Compteurs du jour : inscrits, pays, parts Brevo et Apollo, échecs | `HomeScreen.tsx:52-107` | `05` RG105 |
| Alertes en mots, lien vers l'écran concerné | `HomeScreen.tsx:109-174`, `alert-words.ts:11-50` | `05` RG104, `15` RG66 |
| Connexion depuis un navigateur neuf, rôle administrateur accordé : administrateur seul | `HomeScreen.tsx:144-171` | RG145, RG101 |
| Revue hebdomadaire des confirmations seules : administrateur seul | `HomeScreen.tsx:177-253, 331` | PD6 |
| Entrées au-delà du seuil d'alerte d'ancienneté | `QueueSummary.tsx:137-158` | `06` RG7 |
| Tableau de bord en lecture seule | `HomeScreen.tsx` entier | `15` RG16 |

**API appelée aujourd'hui** : `GET /v1/bo/me` · `POST /v1/bo/auth/logout` · `GET /v1/bo/accounts/counters` · `GET /v1/bo/alerts` · `GET /v1/bo/queues/counters` (5 codes : `packages/contracts/src/backoffice-queues.ts:51-57`) · `GET …/entries?overdue=true` pour les files en retard (`QueueSummary.tsx:50-64`) · `GET /v1/bo/dual-control/degraded` (admin).

## 2. Structure

**Coquille** : `.bo-frame` grille `--grid-bo-shell` (rail 15 rem = 240 px, puis contenu `minmax(0,1fr)`), lignes `--grid-bo-shell-rows`. Rail : colonne 1, deux lignes, `sticky top 0`, 100 dvh, défilement propre. Bande : colonne 2, ligne 1, `sticky top 0`, `--z-header`. Contenu : colonne 2, ligne 2.

| Zone | 1440 | 1280 | 768 (mesure maquette) | 375 (mesure maquette) |
|---|---|---|---|---|
| Rail | 240 × 900 | 240 × 800 | 240 × 1024, remplacé par la bande horizontale (Q05) | illisible, remplacé par E19.1 |
| Bande | x 240, 1200 × 40,7 | 1040 × 40,7 | 528 × 66,4 (deux lignes) | hors cible |
| `main.bo-main` : `px` = `--spacing-page-gutter` | 48 px ; intérieur 1104 | 43,2 px ; intérieur 953,6 | 27,8 px ; intérieur 472,4 | hors cible |

`main` : `py` `--spacing-6` (32 px), `gap` `--spacing-5` (24 px), `max-width` `--container-max`, fond `--background-image-header-glow`, `min-height` `--size-header-glow`.

**Ordre de E04.1** : en-tête (h1 + « Arrêté à ») ; À traiter maintenant ; Files ; Alertes ; Aujourd'hui. Sections sans carte (C03) : `gap` `--spacing-3` (12 px) ; entre sections, 24 px + filet `border-default` + 24 px.
- « À traiter maintenant » et « Aujourd'hui » : 2 colonnes égales, `gap` `--spacing-8` (48 px) dès 1280 px (528 px chacune à 1440 ; 452,8 à 1280) ; une colonne, `gap` `--spacing-5` en dessous.
- Tableau des files à 1440 : colonnes 401,9 / 158,1 / 199 / 153,5 / 191,6 px ; en-tête 30,2 px ; lignes 36 px. À 768, table de 657,7 px dans une région de 472,4 px : défilement horizontal de la seule région.
- Ligne d'alerte : icône, code (`min-width` 3,25 rem), texte flexible, ancienneté à droite ; hauteur 38,7 px, 69 px avec le détail replié.

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E04.1-S01 | Coquille | C57 | Grille rail 240 px + contenu ; aucune barre horizontale de page | dès 1024 px | matin, `.bo-frame` | E04.1-CA01 | E04.1-T03 |
| E04.1-S02 | Coquille | C57 | Lien d'évitement « Aller au contenu » vers `#main`, visible au focus | toujours | non montré, conservé | E04.1-CA02 | E04.1-T03 |
| E04.1-S03 | Bande | C57 | Environnement en capitales `font-display`, puis mode d'envoi ; fond `feedback-warning-bg`, texte `feedback-warning-text` hors production ; `min-height` 36 px, `py` 8 px | toujours ; fond neutre en production | matin, `.bo-env` | E04.1-CA03 | E04.1-T03 |
| E04.1-S04 | Bande | C57 | Identité « Prénom N. · Rôle », à droite, texte 14 px | session lue | matin, `.bo-env > span:last-child` | E04.1-CA04 | E04.1-T03 |
| E04.1-S05 | Bande | C17 | Bandeaux code de secours et contrôle par les pairs, sous la barre 1 | conditions de `me` | non montré, conservé | E04.1-CA03 | E04.1-T03 |
| E04.1-S06 | Rail | C57 | `aside` 240 px, `surface-page`, filet droit `border-default`, défilement propre | dès 1024 px | matin, `.bo-rail` | E04.1-CA01 | E04.1-T07 |
| E04.1-S07 | Rail | C57 | INFLUX (`font-display` 16 px gras) et « Backoffice » (14 px 600 `text-secondary`), lien vers `/accueil` ; `p` 24 16 16 px | dès 1024 px | matin, `.bo-rail__head` | E04.1-CA01 | E04.1-T03 |
| E04.1-S08 | Rail | C57 | Entrée : icône 20 px + libellé 14 px, hauteur 36 px, `px` 12, `gap` 12, `radius-md` ; survol `nav-item-hover-bg` | entrées ouvertes au rôle | matin, `.bo-nav a` | E04.1-CA05 | E04.1-T02 |
| E04.1-S09 | Rail | C57 | Entrée courante : fond `nav-item-active-bg`, filet gauche 2 px `nav-item-active-indicator`, libellé 600, `aria-current="page"` | page courante | matin, `a.is-current` | E04.1-CA05 | E04.1-T02 |
| E04.1-S10 | Rail | C57, C16 | « Files » en ancêtre (600, sans surface) avec le total à traiter en chiffres tabulaires | toujours | matin, `#rail-total` | E04.1-CA06 | E04.1-T06 |
| E04.1-S11 | Rail | C16 | Nombre hors délai : drapeau 16 px + nombre, `feedback-warning-text` ; nom lu « 4 hors délai » | si nombre supérieur à 0 | matin, `.n--late` | E04.1-CA07 | E04.1-T08 |
| E04.1-S12 | Rail | C57 | Surtitre de groupe non cliquable, `overline`, retrait `--spacing-nav-sub-indent` (texte x 52), `p` 12 12 4 | sous « Files » dépliée (Q04) | matin, `.grp` | E04.1-CA08 | E04.1-T02 |
| E04.1-S13 | Rail | C57, C16 | Sous-entrée de file : libellé court + nombre à droite, hauteur 36 px | file servie | matin, `a.sub > .n` | E04.1-CA06 | E04.1-T06 |
| E04.1-S14 | Rail | C16 | File vide : coche 16 px `text-tertiary` + texte caché « vide » | nombre égal à 0 | matin, `.n.ok` | E04.1-CA07 | E04.1-T06 |
| E04.1-S15 | Rail | C57 | Groupes « Fonctionnement » (Échecs de synchronisation) et « Obligations et contrôles » (Actions à valider) ; libellé long sur deux lignes : hauteur minimale 36 px, jamais recouverte | Actions à valider : administrateur seul (Q06) | matin, `a.sub` 10 et 11 | E04.1-CA09 | E04.1-T03 |
| E04.1-S16 | Rail | C57 | Comptes, Créateurs, Administration, dans cet ordre | Administration : administrateur seul | matin, `.bo-nav > a` | E04.1-CA09 | E04.1-T01 |
| E04.1-S17 | Rail | C10, C27 | Pied : filet haut, `p` 16 px ; bouton texte « Raccourcis » précédé de la touche `?` (22 × 22) ; 207 × 28 | toujours | matin, `[data-dialog="keys"]` | E04.1-CA10 | E04.1-T06 |
| E04.1-S18 | Rail | C10 | « Se déconnecter », bouton secondaire, icône 16 px, 207 × 28 ; libellé d'attente pendant l'appel | toujours | matin, `.bo-rail__foot .btn--secondary` | E04.1-CA02 | E04.1-T03 |
| E04.1-S19 | Page | C01 | `main#main`, halo d'en-tête, marges de §2 | toujours | matin, `.bo-main` | E04.1-CA01 | E04.1-T07 |
| E04.1-S20 | Coquille | C57 | Fil d'Ariane des autres écrans : `nav` « Fil d'Ariane », 14 px `text-secondary`, chevron 16 px, `gap` 4, dernier élément `aria-current="page"` ; absent du tableau de bord | écrans E05, E06, E13, E16, E17, E21 | écrans 5 et 16, `.crumbs` | E04.1-CA11 | E04.1-T06 |
| E04.1-S21 | En-tête | C02 | h1 « Tableau de bord », 28 px 800 (27,6 px de haut à 768), `tabindex="-1"` | toujours | matin, `.t-page` | E04.1-CA11 | E04.1-T07 |
| E04.1-S22 | En-tête | C02 | « Arrêté à » + heure tabulaire, `text-secondary`, aligné à droite | après la première lecture | matin, `#stamp` | E04.1-CA12 | E04.1-T06 |
| E04.1-S23 | En-tête | C10 | « Actualiser », secondaire, icône, 126,4 × 28 | toujours | matin, `#refresh` | E04.1-CA12 | E04.1-T06 |
| E04.1-S24 | À traiter | C03 | h2 16 px 700 « À traiter maintenant » | toujours | matin, `#h-now` | E04.1-CA13 | E04.1-T07 |
| E04.1-S25 | À traiter | C13 | « 4 entrées hors délai », drapeau, `feedback-warning-text` 600 | au moins une entrée hors délai | matin, `.urgent p.late` | E04.1-CA13 | E04.1-T06 |
| E04.1-S26 | À traiter | C06 mini | Ligne 36 px : nom en lien étiré sur la ligne (600), « · file » en `text-secondary`, « depuis … » à droite en alerte ; survol `surface-raised` + filet 2 px | une ligne par entrée hors délai | matin, `.mini li` | E04.1-CA14 | E04.1-T06 |
| E04.1-S27 | À traiter | C03 | « Mes prises en charge (n) », `text-secondary` | au moins une prise en charge | matin, `.urgent p.c2` | E04.1-CA13 | E04.1-T06 |
| E04.1-S28 | À traiter | C06 mini | Ligne : nom en lien, « · file », « prise à HH h MM » | une par verrou de l'agent | matin, `.mini li` colonne 2 | E04.1-CA14 | E04.1-T06 |
| E04.1-S29 | À traiter | C08 | Une phrase, coche `feedback-success-icon`, sans boîte | aucune entrée hors délai ni prise en charge | calme, `p[data-when="calme"]` | E04.1-CA13 | E04.1-T06 |
| E04.1-S30 | Files | C03 | h2 « Files » et, à droite, « Délai de décision : 8 h ouvrées » | délai : même valeur pour toutes les files (Q14) | matin, `#h-files` | E04.1-CA15 | E04.1-T07 |
| E04.1-S31 | Files | C58 | En-tête de 5 colonnes, `surface-hover`, Manrope 700 14 px `text-secondary`, filet `border-strong`, nombres à droite, sans cadre | toujours | matin, `#files thead` | E04.1-CA15 | E04.1-T07 |
| E04.1-S32 | Files | C58 | Ligne 36 px, filet `border-subtle` ; nom en lien étiré (Manrope 700) ; 4 nombres tabulaires à droite ; survol et focus : `surface-raised` + filet vert 2 px sur la première cellule | une par file, 11 lignes, ordre du rail | matin, `#files tbody tr` | E04.1-CA16 | E04.1-T06 |
| E04.1-S33 | Files | C13 | Hors délai : drapeau + nombre, `feedback-warning-text` | nombre supérieur à 0 | matin, `td .late` | E04.1-CA07 | E04.1-T08 |
| E04.1-S34 | Files | C58 | « 0 » en `text-tertiary` | hors délai nul | matin, `td.c3` | E04.1-CA16 | E04.1-T07 |
| E04.1-S35 | Files | C58 | File vide : une cellule sur 4 colonnes, coche + « vide », à droite | en attente nul | matin, `td[colspan="4"]` | E04.1-CA16 | E04.1-T06 |
| E04.1-S36 | Files | C58 | « — » dans « Sans preneur » pour les deux files sans verrou (échecs, actions) | files sans verrou | matin, lignes 10 et 11 | E04.1-CA16 | E04.1-T06 |
| E04.1-S37 | Alertes | C03 | h2 « Alertes · 18, en 7 groupes » | au moins une alerte | matin, `#h-al` | E04.1-CA17 | E04.1-T06 |
| E04.1-S38 | Alertes | C06, C13 | Une ligne par code : triangle 16 px `feedback-warning-icon`, code mono 12 px, phrase, ancienneté à droite `text-secondary` sans retour à la ligne | par groupe | matin, `.alerts > li` | E04.1-CA17 | E04.1-T06 |
| E04.1-S39 | Alertes | C26 | « Voir les 12 comptes » replié ; chevron qui pivote ; liste de liens, « et 8 autres » | groupe de plusieurs comptes | matin, `.alerts details` | E04.1-CA18 | E04.1-T06 |
| E04.1-S40 | Alertes | C11 | Lien en fin de phrase vers l'écran concerné | AL22, AL23, AL26, AL65 | matin, `.alerts a.link` | E04.1-CA17 | E04.1-T10 |
| E04.1-S41 | Alertes | C06 | Ligne de sécurité : cadenas, « SÉCU », phrase, « Ce n'était pas moi », date (Q11) | administrateur seul (API) | matin, `.alerts li:last-child` | E04.1-CA17 | E04.1-T10 |
| E04.1-S42 | Aujourd'hui | C03 | h2 « Aujourd'hui · 22/11/2026, jour UTC » | compteurs lus | matin, `#h-day` | E04.1-CA19 | E04.1-T06 |
| E04.1-S43 | Aujourd'hui | C07 | Inscrits ; Principaux pays. Libellé 13 rem (208 px) 600 `text-secondary`, valeur tabulaire, `gap` 8 24 px | compteurs lus | matin, `.today dl:first-child` | E04.1-CA19 | E04.1-T07 |
| E04.1-S44 | Aujourd'hui | C07, C13 | Brevo en moins d'1 h ; Apollo en moins de 24 h (triangle d'alerte si sous l'objectif) ; Échecs à traiter + « Voir les échecs » | compteurs lus | matin, `.today dl:last-child` | E04.1-CA19 | E04.1-T06 |
| E04.1-S45 | Dialogue | C27 | `dialog` 30 rem maximum, `radius-card`, `surface-raised`, `shadow-lg` ; titre, croix « Fermer », 6 lignes, bouton « Fermer » focalisé | touche `?` ou bouton du rail | `#keys` | E04.1-CA10 | E04.1-T06 |
| E04.1-S46 | Page | C29 | Région d'annonce polie, unique, non visible | toujours | matin, `#announcer` | E04.1-CA12 | E04.1-T08 |
| E04.1-S47 | Page | C03 | Revue hebdomadaire des confirmations seules, rôle administrateur accordé, seuil d'ancienneté : conservés, forme non dessinée (Q12) | conditions actuelles | non montré | E04.1-CA20 | E04.1-T10 |
| E04.1-S48 | Page | C08, C09, C17 | Chargement et erreur par bloc, indépendants | lecture en cours, échec | non montré (§5) | E04.1-CA21 | E04.1-T06 |

## 4. Textes

Dans `E04b-bo-accueil-textes.md`.

## 5. Interactions, états, responsive, clavier

- **Actualiser** → relit compteurs, prises en charge, alertes ; heure mise à jour ; chaque nombre changé (tableau et rail) reçoit un fond `surface-active` qui s'estompe (`duration-slow`, 320 ms, `ease-standard`) ; annonce C29. Échec : bloc en erreur, heure inchangée (non montré).
- **Ligne** (S26, S28, S32) : toute la ligne est cliquable par le lien étiré, ouvrable dans un nouvel onglet. Un clic sur une entrée l'ouvre et la prend en charge (`15` RG27 C1) : jamais de préchargement qui ouvrirait l'entrée (aujourd'hui l'ouverture est un `POST` au montage, donc sans risque : `use-review-entry.ts:147-155`).
- **Voir les comptes** : `details` natif ; chevron `rotate` 90°, `duration-base` ; liste en `rise-in` 200 ms.
- **Dialogue** : `?` ou bouton ; `dialog` natif modal, focus sur « Fermer », Échap, clic sur le voile, croix ; focus rendu au déclencheur. Ouverture opacité et échelle 0,98 → 1, 200 ms ; fermeture 120 ms `ease-exit` ; sans échelle en mouvement réduit.
- **`g` puis `t`, `f`, `c`** : va à la rubrique, fenêtre de 1,2 s ; jamais depuis un champ, une zone de texte, une liste, un dialogue, ni avec Ctrl, Meta ou Alt (Q08).
- **`j`, `k`** : annoncés dans l'aide, sans effet sur le tableau de bord de la maquette (aucun code) : actifs dans les listes (E16) seulement.
- **États**

| État | Maquette | Décision |
|---|---|---|
| Chargement (session) | non montré | comportement actuel (`Shell.tsx:145-154`) ; `17b` §1.7 demande rail et bande avec squelette : écart à reporter |
| Chargement (bloc) | non montré | comportement actuel « Chargement… » (`HomeScreen.tsx:299-302`) ; représentation proposée : C09 de 5 lignes de 36 px pour le tableau, sans animation (`17b` §2.8) |
| Rien d'urgent | `calme` | S29 |
| File vide | `matin`, ligne 7 | S35 ; état « bloquée » de `15` RG24 non montré (Q13) |
| Aucune alerte | non montré | `home.noAlert` conservé, phrase sans boîte |
| Erreur d'un bloc | non montré | `ErrorNotice` actuel par bloc, sans masquer les autres |
| Session illisible, déconnecté | non montré | écrans actuels (`Shell.tsx:155-176`) |
| Refus | sans objet | les blocs administrateur ne sont pas demandés par un agent |
| Hors ligne | non montré | identique à « erreur » |

- **Responsive** : 1440 et 1280, §2. De 768 à 1023 px : la maquette garde le rail, la règle en vigueur impose la bande horizontale (`17b` §1.7, TD6.2) : Q05. Sous 768 px ou 500 px de haut : E19.1. Tableau : défile seul, horizontalement, première colonne collante (`17b` §1.7, non montré sur cet écran).
- **Clavier** : évitement → bande → rail → contenu ; `h1` focalisé après navigation ; anneau porté par la ligne entière (`tr:has(.id:focus-visible)`), jamais masqué par la bande collante.

## 6. Critères d'acceptation

- **E04.1-CA01** À 1440 × 900 : rail x 0, 240 px, bande x 240 de 40,7 px ± 1, contenu intérieur x 288 de 1104 px ; aucun défilement horizontal de page à 1440, 1280, 1024, 768.
- **E04.1-CA02** Lien d'évitement premier, déconnexion et écran déconnecté inchangés.
- **E04.1-CA03** L'environnement est écrit à chaque page ; hors production le fond et le mot changent ensemble ; les deux bandeaux conditionnels restent sous la barre 1.
- **E04.1-CA04** La bande affiche le prénom, l'initiale et le rôle ; aucune adresse e-mail.
- **E04.1-CA05** Exactement un `aria-current="page"` par page ; filet 2 px et surface sur l'entrée ou la sous-entrée courante seule.
- **E04.1-CA06** Le total de « Files » est égal à la somme des nombres des files visibles par le rôle ; chaque sous-entrée porte le nombre de son tableau.
- **E04.1-CA07** Hors délai et vide portent une icône et un mot (visible ou lu), jamais la couleur seule.
- **E04.1-CA08** Les surtitres de groupe ne sont pas des liens et ne reçoivent pas le focus.
- **E04.1-CA09** Un agent ne voit ni Administration, ni « Actions à valider » ; aucune requête réservée n'est émise pour lui.
- **E04.1-CA10** `?` et « Raccourcis » ouvrent le même dialogue ; le focus revient au déclencheur ; `?` dans un champ écrit un caractère.
- **E04.1-CA11** h1 unique ; fil d'Ariane sur tout écran de second niveau, absent du tableau de bord.
- **E04.1-CA12** « Arrêté à » vient de l'instant servi par l'API ; « Actualiser » le met à jour et annonce le résultat une fois ; aucun rafraîchissement automatique.
- **E04.1-CA13** La section affiche, dans l'ordre, hors délai puis mes prises en charge ; si les deux sont vides, la seule phrase S29.
- **E04.1-CA14** Chaque entrée est un lien direct vers sa décision ; une entrée d'un compte de l'agent n'apparaît pas (`15` RG36).
- **E04.1-CA15** Tableau sans cadre ni carte, en-tête 30,2 px, lignes 36 px, nombres alignés à droite en chiffres tabulaires.
- **E04.1-CA16** Les neuf files plus les deux files techniques sont dans l'ordre du rail ; jamais un « 0 » non servi par l'API.
- **E04.1-CA17** Une seule ligne par groupe d'alertes ; la somme des groupes est le nombre du titre ; chaque phrase dit quoi, combien et depuis quand.
- **E04.1-CA18** Le détail d'un groupe est replié par défaut et accessible au clavier ; aucun compte n'y est nommé sans droit de lecture.
- **E04.1-CA19** Les chiffres du jour sont ceux de `GET /v1/bo/accounts/counters`, sans recalcul.
- **E04.1-CA20** Les blocs administrateur existants restent présents et visibles de l'administrateur seul.
- **E04.1-CA21** Un bloc en échec n'empêche pas l'affichage des autres.
- **E04.1-CA22** Aucune action métier depuis le tableau de bord (`15` RG16) ; aucun montant ni pourcentage de commission.

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E04.1-T01 | unitaire | `apps/backoffice/tests/bo-nav.test.ts` (adapter TD2.7, TD2.8, TN3) | entrées, groupes, droits, ordre |
| E04.1-T02 | unitaire | `apps/backoffice/tests/bo-nav-ui.test.ts` (adapter TN5 : lignes 76 à 166) | un `nav`, un `aria-current`, 36 px, surtitres |
| E04.1-T03 | e2e | `apps/web/e2e/backoffice.spec.ts` (TD6.1 à TD6.4, TN7, TN8, CA63 ; adapter les textes exacts de liens, l. 1031) | coquille, bandeaux, droits, déconnexion |
| E04.1-T04 | e2e | `apps/web/e2e/backoffice-queue.spec.ts` (L2C-16 « the dashboard counts the queue ») | compteurs de file en tableau |
| E04.1-T05 | unitaire | `apps/backoffice/tests/queue-view-model.test.ts` (l. 259, ligne du tableau de bord) | nombres, seuil d'ancienneté, « vide » |
| E04.1-T06 | e2e | nouveau `apps/web/e2e/backoffice-home.spec.ts` | états matin et calme, Actualiser, annonces, dialogue, alertes groupées, erreurs par bloc |
| E04.1-T07 | visuel | nouveau, 1440, 1280 et 1024 px | mesures de §2 |
| E04.1-T08 | a11y | `backoffice.spec.ts` (DS-10) et T06 | axe WCAG 2.2 AA, noms des compteurs, région d'annonce |
| E04.1-T09 | unitaire | `apps/backoffice/tests/guards.test.ts`, `test-witnesses`, planchers `case-floors.ts` | aucune valeur en dur, gardes conservées |
| E04.1-T10 | e2e | `backoffice.spec.ts` (CA62, L3G-E2), `backoffice-identified-search.spec.ts` | alertes, liens, blocs administrateur |
| E04.1-T11 | unitaire (base) | nouveau, `db-tests` de `apps/api` | compteurs des 9 files, prises en charge et retards par rôle, RG36 |

Attributs à conserver : `data-theme`, `id="main"`, noms accessibles `nav.label` et `nav.skip`, `data-search-opening` (écran des réglages, l. 1935 de `backoffice.spec.ts`).

## 8. Écart avec l'existant

Dans `E04b-bo-accueil-textes.md`.

## 9. Contradictions, manques et décisions

| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E04-Q01 | Compteurs servis par 5 chemins ; rien pour l'ancienneté des échecs ni pour les actions ; le rail les demande sur toutes les pages | rail et tableau impossibles en un appel | `GET /v1/bo/dashboard` (ou `queues/counters` étendu) : 9 files + 2, un seul `asOf`, filtré par rôle et RG36 | architecte | oui |
| E04-Q02 | Retards et prises en charge transverses : 18 appels aujourd'hui, noms différents par file | section « À traiter » | lecture dédiée : `queue`, `entryId`, libellé déjà servi par la liste, échéance, `claimedAt` ; plafond à fixer | architecte | oui |
| E04-Q03 | Groupes : maquette (5, dont « Fonctionnement ») contre `17b` §1.3 (« Faire entrer… », « Faire se rencontrer », « Protéger », « Faire fonctionner la machine ») ; `07` l. 240 cite encore ce dernier nom | libellés et composition | la maquette fait foi, `17b` §1.3 amendé | product-owner | non |
| E04-Q04 | Maquette : sous-entrées de Files dépliées sur le tableau de bord ; D74 et `17b` §1.7 : sous l'entrée active seulement ; la même maquette les replie dans E16 Inscrits | règle d'ouverture du rail | dépliées sur « Tableau de bord » et sur les écrans de Files seulement ; amender D74 | expert-ux | oui |
| E04-Q05 | De 768 à 1023 px : rail de 240 px dans la maquette ; bande horizontale imposée (`02` §21.5 point 8, TD6.2) ; compteurs et surtitres n'y sont pas dessinés | coquille à ces largeurs | garder la bande ; compteurs après le libellé ; surtitres masqués visuellement | expert-ux | oui |
| E04-Q06 | Session « Commercial » qui voit Administration et « Actions à valider » : `adminOnly` (`actions-dual-control-routes.ts:280`), CA63 | total du rail faux pour un agent | masquées pour l'agent, hors du total | expert-cybersecurite | non |
| E04-Q07 | « Camille D. » : ni prénom ni nom dans `me` ; « Responsable » n'est que le prénom (`displayName`) ; casse « Commercial » ici, « commercial » dans E19 | identité de la bande | ajouter `firstName` et l'initiale au contrat ; rôle en minuscules comme la clé actuelle | architecte | oui |
| E04-Q08 | `g` puis lettre (maquette) contre `g` puis 1 à 7 et `b` puis n (`17b` §1.7, §4.11, arbitrage du 2026-10-28) | raccourcis | maquette pour `g`, en gardant `1…7` ; `b` non repris | product-owner | oui |
| E04-Q09 | Hors délai en `feedback-warning-text` (maquette) ; `17b` §6.3 et le code (`QueueCells.tsx:58`) : `feedback-error-text` | couleur de tous les retards (E04, E05, E16) | suivre la maquette, amender `17b` §6.3 | expert-ux | non |
| E04-Q10 | Noms des comptes sous AL21 non servis ; les lire ici sans journal créerait une lecture identifiée | détail S39 | servir le nom public de la marque avec l'alerte, sans lecture de fiche | architecte | oui |
| E04-Q11 | Code « SÉCU » et lien « Ce n'était pas moi » sans destination ni règle ; l'événement est réservé aux administrateurs (RG145) ; `adminRoleGrants` non dessiné | ligne S41 | ligne sans code ni lien, texte actuel ; même forme pour le rôle accordé | expert-cybersecurite | oui |
| E04-Q12 | Non dessinés : revue hebdomadaire (PD6), seuil d'ancienneté (RG7), « autres pays », `evaluatedAt`, état des services près des échecs | perte d'information si la maquette est suivie à la lettre | garder : section C03 en bas (PD6), phrase C13 sous le tableau (RG7), les autres en texte | product-owner | oui |
| E04-Q13 | `15` RG24 : deux états vides (« dernière traitée », « rien ne remonte ») ; maquette : « vide » seul | S35 | « vide » ; « bloquée » quand l'API servira le signal | product-owner | non |
| E04-Q14 | Un seul « Délai de décision : 8 h ouvrées » alors que chaque file a sa politique (`policy`) et que campagnes en a deux | S30 | affiché si toutes les files partagent la valeur, sinon retiré | product-owner | non |
| E04-Q15 | Fond qui s'estompe et `rise-in` : `15` RG17 et RG118 « aucune animation » | Actualiser, confirmations | exception du fondateur à écrire dans `15` ; mouvement réduit respecté | product-owner | non |
| E04-Q16 | Heures « 09 h 41 » (maquette) ; `formatTime` rend le format régional (`view-model.ts:49`) | tous les textes d'heure | format unique à fixer | expert-ux | non |
| E04-Q17 | `15` RG18 : blocs 1 et 2 plus riches (tâches, « pris par un collègue »), RG15 : tout chiffre est un lien ; maquette : seul le nom de file est un lien | colonnes et liens | maquette ; RG15 amendée pour le tableau | product-owner | non |
| E04-Q18 | Rail de 1049 px pour 900 px : « Raccourcis » et « Se déconnecter » sous la ligne de flottaison | pied atteint par défilement du rail | conserver la maquette (pied dans le flux) | expert-ux | non |
| E04-Q19 | Défauts axe : `.bo-band` hors repère (X11), `aria-label` sur `span` (X10) | a11y | bande en `header` (existant), texte caché à la place de `aria-label` | expert-ux | non |

## 10. Écrans du périmètre sans maquette

Aucun dessin ; règle proposée : écran actuel conservé, jetons et composants du catalogue seulement, validation `expert-ux` avant toute refonte.

| Écran | Composant actuel | Ce qui manque |
|---|---|---|
| Connexion (`/`) : mot de passe, code TOTP, code de secours | `LoginForm.tsx`, `(auth)/page.tsx` | tout ; C50 et C49 de E11 ne sont pas validés pour le backoffice |
| Activation (`/activation`) : mot de passe, second facteur, codes de secours, lien mort | `Activation.tsx` (574 lignes) | tout |
| Déconnecté, session illisible, chargement de session | `Shell.tsx:145-176` | tout |
| 404, erreur, erreur globale | `app/not-found.tsx`, `error.tsx`, `global-error.tsx` | tout |
| Les 8 décisions de file dérivées | voir `E05c-bo-decisions-derivees.md` | tout sauf le cadre C59 |
| Réglages de la recherche (`/reglages/recherche`) | `SearchSettingsScreen.tsx` | aucun état dans E21 |
| Sources de registre (`/reglages/sources-registre`) | `RegistrySourcesScreen.tsx`, `RegistrySourceEditor.tsx`, `RegistrySourceAdder.tsx` | aucun état dans E21 |
| Comptes internes, double validation, Apollo, santé, invitations, échecs | voir E21 | maquettés dans `proto-bo-admin` |
| Confirmation d'identité (`ReauthForm`, F4) | voir E06 et E21 | dialogue non dessiné ici |
| Catalogue des files (lien « Files » du rail, `17b` §1.7) | n'existe pas : le lien ouvre la première file | la maquette lie « Files » à `#` ; proposition : première file, comme aujourd'hui |
