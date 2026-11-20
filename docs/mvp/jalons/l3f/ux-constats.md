# L3F-U — constats `expert-ux` (non commité)

Lecture du code (`apps/web/src/components/creator-search/*`, `lib/member-*.ts`, `locales/{fr,en}/creator-search.json`), de `17` §4.4 et §7.1, et des deux specs e2e. **Les specs ne produisent aucune capture image** : elles n'ont que des assertions et des passes axe. Les constats de rendu (375 px) viennent donc du code et des classes, pas d'une image : le fondateur les confirme à la recette. Aucun fichier de code touché.

## Verdicts sur les points signalés

| Point | Verdict |
|---|---|
| EC-L3F-10-2, filtres en bloc repliable (375) | **Accepté**, à deux conditions : L3FU-1 et L3FU-2. |
| EC-L3F-11-3, barre collante repliable, `--size-selection-panel-max: 50dvh` | **Accepté** (barre au-dessus de la barre du bas, `data-action-bar`, jeton de taille, pas de couleur). Corrections : L3FU-3, L3FU-4, L3FU-8. |
| EC-L3F-11-2, région en code brut (« FR-IDF ») | **Accepté pour la recette seulement**, à traiter avant production : L3FU-6. |
| Demande de sélection sans sous-menu propre | **Accepté** : `PARENT_PAGES` la rattache à « Créateurs » (`member-paths.ts` l. 169), le retour garde critères et campagne. |

Vérifié conforme : tranche dite comme une information (`bands.*`) ; absence de barre de recherche expliquée (`page.explain`) ; sous le seuil identique pour 0 et 4, avec élargissements et demande ; fermé, plafond, limite de débit et profil non publié sans page blanche ; « Proposé car » sur fond surélevé, en affirmation d'INFLUX, sans score ; carte sans visuel sans emplacement vide (`noVisualText={null}`) ; sélection dite privée sur le profil, en desktop et sur « Mes sélections » ; confirmation de la demande = un jour de réponse, « pas un nombre de profils garanti » ; aucun montant ni taux ; cibles de 44 px (`min-h-(--size-touch-target)`) ; vert jamais seul (icône et texte) ; seuls des jetons dans les classes ; FR et EN alignés.

**Bloquant : aucun.**

## Constats « jalon » (une ligne `fix` chacun, arrêt pour validation)

**L3FU-1 — jalon — aucun résultat sur le premier écran à 375 px.**
`CreatorSearchScreen.tsx` l. 174-258 ; `Controls` l. 295-379.
Scénario : à 375 × 800 on empile le titre, un bouton « Demander une sélection… » de 42 caractères (deux lignes), le paragraphe d'explication, « Filtres », deux listes (campagne, tri), l'explication du tri (quatre lignes, l. 371-376), la tranche et les puces. La première carte est sous la ligne de flottaison, alors que la maquette `17` l. 913 met « Filtres » et « Tri » sur une ligne, puis la tranche, puis la carte.
Correctif : mettre « Filtres » et « Tri » sur une ligne sous `lg`, déplacer « Recherche liée à » dans le bloc des filtres, replier l'explication du tri derrière une info `[i]` (prévue par `17` l. 933) et l'explication de page à une ligne.

**L3FU-2 — jalon — focus et défilement perdus après « Voir les résultats » sous `lg`.**
`CreatorSearchScreen.tsx` l. 153-158 (`setFiltersOpen(false)`), l. 197-200 ; `SearchFiltersForm.tsx` l. 273-276.
Scénario : le bouton d'envoi est tout en bas d'un long formulaire ; on l'active, le bloc passe en `display: none`, le focus tombe sur `<body>` (WCAG 2.4.3) et le défilement reste au niveau de l'ancien bas du formulaire : on atterrit au milieu ou à la fin des résultats sans savoir ce qui a changé.
Correctif : après application sous `lg`, faire défiler vers la tranche (`tabIndex={-1}`) et lui donner le focus.

**L3FU-3 — jalon — « Mes sélections » n'est atteignable sur téléphone qu'en ouvrant la barre.**
`shell-classes.ts` l. 110 (`SUB_NAV_LIST_CLASSES … max-lg:hidden`) ; `member-nav.ts` l. 72-76 ; `SelectionPanel.tsx` l. 211-216.
Scénario : D74 prévoit un page-menu par rubrique sur téléphone. « Créateurs » ouvre directement la recherche et son sous-menu est masqué sous `lg` : la seconde page n'a pas d'entrée, sauf le lien tout en bas du corps replié de la barre (scroll imbriqué), et aucune quand la recherche est fermée.
Correctif : lien permanent « Mes sélections » sous `lg`, sous le titre des pages de recherche et de profil (page-menu complet de la rubrique si `expert-ux` le décide plus tard).

**L3FU-4 — jalon — la barre repliée ne dit pas « privée ».**
`SelectionPanel.tsx` l. 108-111 ; mention seulement en l. 134, dans le corps `max-lg:hidden`.
Scénario : à 375 px la marque ajoute des créateurs depuis les cartes ; elle ne lit « Privée : aucun créateur n'est prévenu » qu'en ouvrant la barre. `17` l. 934 exige que le libellé dise « privée ».
Correctif : titre « Ma sélection privée (3) » / « My private selection (3) » (clé `panel.title`), ou sous-titre visible dans la barre repliée.

**L3FU-5 — jalon — la confirmation d'envoi n'est annoncée à personne.**
`SelectionRequestScreen.tsx` l. 126-145.
Scénario : « Envoyer ma demande » remplace tout le formulaire par la carte de confirmation ; le bouton pressé disparaît, le focus tombe sur `<body>`, aucune région `role="status"` : un lecteur d'écran n'entend rien (WCAG 4.1.3, 2.4.3). L'e2e vérifie le texte, pas l'annonce.
Correctif : donner le focus au titre de la confirmation (`tabIndex={-1}`, `data-request-sent`) à l'affichage.

## Constats « avant production » (une ligne)

- **L3FU-6** — Région en code brut `FR-IDF` (`shortlists-view.ts` l. 415-426, `profile.region`) : illisible pour une marque anglophone. D'ici là, afficher le pays (`Intl.DisplayNames`) avec le code entre parenthèses ; ensuite une table de noms pour les pays ouverts (`product-owner`, `expert-database`).
- **L3FU-7** — D61 (`17` l. 2051) : les badges (`CreatorCardView.tsx` l. 117-129) précèdent les trois métriques (l. 130-153), et chaque métrique tient sur deux lignes ; la ligne « Instagram · 25 k – 100 k · plusieurs fois par semaine · 50 à 199 commentaires » demandée n'a jamais été dessinée. Carte partagée avec l'aperçu créateur : à traiter dans un jalon dédié.
- **L3FU-8** — Barre de sélection sous `lg` (`SelectionPanel.tsx` l. 177-203, `creator-search-classes.ts` l. 76) : le formulaire de création, doublon de « Mes sélections », se glisse entre les créateurs et le lien ; ordre cible : privée, liste, créateurs, « Mes sélections », puis « Nouvelle sélection » repliée. « Masquer » / « Hide » (l. 120, `panel.close`) n'a pas d'objet : « Masquer ma sélection ». Les 50 dvh ne bornent que le corps : avec l'entête et la barre du bas, la barre ouverte peut couvrir plus de la moitié d'un écran de 667 px.
- **L3FU-9** — Impasse du parcours « 3 à 5 profils » : la sélection est privée et la demande à l'équipe (`requestBodyOf`) ne la porte pas ; le commercial ne voit jamais ce que la marque a retenu. L'écran dit seulement « pour garder vos idées » (`lists.explain`). Décision `product-owner` : transmettre les alias de la sélection active dans la demande, ou dire clairement que la mise en relation arrive plus tard.
- **L3FU-10** — Un compte de marque non publié découvre l'obstacle à l'envoi (`SelectionRequestScreen.tsx` l. 237-249), alors que le lien de la demande est permanent (`CreatorSearchScreen.tsx` l. 176). Annoncer le blocage en tête de page avant la saisie (résumé de marque déjà disponible : `use-brand-summary`).
- **L3FU-11** — Sous `xl`/`lg` la carte « Ma sélection » est en fin de résultats (douze cartes longues) : l'ajout n'est confirmé que sur le bouton. Ajouter un compteur « Ma sélection (n) » dans la colonne collante.
- **L3FU-12** — Changer le tri ou la campagne remonte `SearchFiltersForm` (`key={queryKeyOf(query)}`, l. 202) : les critères cochés et non appliqués sont perdus sans avertissement. Appliquer ensemble, ou avertir.
- **L3FU-13** — Passes axe absentes pour : résultats à 375 px, bloc des filtres ouvert, barre de sélection ouverte, confirmation d'envoi, liste de « Mes sélections » à 375 px (la passe s'exécute après suppression, sur l'état vide).
- **L3FU-14** — Le compteur de la barre et l'ajout ne sont pas annoncés (`SelectionPanel.tsx` l. 109, `AddToSelectionButton.tsx`) : région `role="status"` sur « Ma sélection (n) ».

## Constats « plus tard » (une ligne)

- **L3FU-15** — Lien « Demander une sélection… » en double (en-tête et corps) à l'état fermé, trop précis ou limité (`CreatorSearchScreen.tsx` l. 176, 424, 476, 507) : masquer celui de l'en-tête.
- **L3FU-16** — Nom accessible des puces redondant (« Beauté Retirer le critère : Beauté », l. 244-251) : `aria-label` seul.
- **L3FU-17** — Bouton des filtres : libellé et `aria-expanded` changent ensemble (l. 184-195) ; garder un libellé fixe.
- **L3FU-18** — Colonne des filtres sticky `max-h-screen` avec `top` de 24 px (`creator-search-classes.ts` l. 15-18) : le bas du formulaire dépasse l'écran ; `calc(100dvh - 2 × top)`.
- **L3FU-19** — La page de demande n'a pas de bandeau « hors ligne » (les autres écrans de L3F en ont un).
- **L3FU-20** — `AddToSelectionButton` disparaît tant que les sélections ne sont pas lues (l. 27-29) : saut de mise en page ; réserver la place.
- **L3FU-21** — Barre ouverte : `Escape` pour la fermer, `overscroll-behavior: contain` sur son corps.
- **L3FU-22** — Visuels de portfolio `alt=""` (`CreatorCardView.tsx` l. 85) alors que la légende est facultative : prévoir un texte de repli.

## Décompte

Bloquant : **0** · Jalon : **5** · Avant production : **9** · Plus tard : **8** (22 constats).

Constats « jalon » ou « bloquant » : **L3FU-1, L3FU-2, L3FU-3, L3FU-4, L3FU-5.**

## À valider par le fondateur

Les quatre points des lignes 10 et 11 (verdicts ci-dessus) et le nouveau jeton `--size-selection-panel-max` (taille, aucune couleur nouvelle). Aucune couleur nouvelle proposée.
