# Matrice — bo-travail (1)

> Produite par script depuis le §3 de chaque fiche (colonne « Spécification » : identifiant de l'élément, à lire
> dans `ecrans/`). Critères : §6 ; tests : §7 de la même fiche.

| Maquette | Écran | Section | Composant | Spécification | Critère d'acceptation | Test |
|---|---|---|---|---|---|---|
| matin, `.bo-frame` | E04.1 | Coquille | C57 | E04.1-S01 | E04.1-CA01 | E04.1-T03 |
| non montré, conservé | E04.1 | Coquille | C57 | E04.1-S02 | E04.1-CA02 | E04.1-T03 |
| matin, `.bo-env` | E04.1 | Bande | C57 | E04.1-S03 | E04.1-CA03 | E04.1-T03 |
| matin, `.bo-env > span:last-child` | E04.1 | Bande | C57 | E04.1-S04 | E04.1-CA04 | E04.1-T03 |
| non montré, conservé | E04.1 | Bande | C17 | E04.1-S05 | E04.1-CA03 | E04.1-T03 |
| matin, `.bo-rail` | E04.1 | Rail | C57 | E04.1-S06 | E04.1-CA01 | E04.1-T07 |
| matin, `.bo-rail__head` | E04.1 | Rail | C57 | E04.1-S07 | E04.1-CA01 | E04.1-T03 |
| matin, `.bo-nav a` | E04.1 | Rail | C57 | E04.1-S08 | E04.1-CA05 | E04.1-T02 |
| matin, `a.is-current` | E04.1 | Rail | C57 | E04.1-S09 | E04.1-CA05 | E04.1-T02 |
| matin, `#rail-total` | E04.1 | Rail | C57 C16 | E04.1-S10 | E04.1-CA06 | E04.1-T06 |
| matin, `.n--late` | E04.1 | Rail | C16 | E04.1-S11 | E04.1-CA07 | E04.1-T08 |
| matin, `.grp` | E04.1 | Rail | C57 | E04.1-S12 | E04.1-CA08 | E04.1-T02 |
| matin, `a.sub > .n` | E04.1 | Rail | C57 C16 | E04.1-S13 | E04.1-CA06 | E04.1-T06 |
| matin, `.n.ok` | E04.1 | Rail | C16 | E04.1-S14 | E04.1-CA07 | E04.1-T06 |
| matin, `a.sub` 10 et 11 | E04.1 | Rail | C57 | E04.1-S15 | E04.1-CA09 | E04.1-T03 |
| matin, `.bo-nav > a` | E04.1 | Rail | C57 | E04.1-S16 | E04.1-CA09 | E04.1-T01 |
| matin, `[data-dialog="keys"]` | E04.1 | Rail | C10 C27 | E04.1-S17 | E04.1-CA10 | E04.1-T06 |
| matin, `.bo-rail__foot .btn--secondary` | E04.1 | Rail | C10 | E04.1-S18 | E04.1-CA02 | E04.1-T03 |
| matin, `.bo-main` | E04.1 | Page | C01 | E04.1-S19 | E04.1-CA01 | E04.1-T07 |
| écrans 5 et 16, `.crumbs` | E04.1 | Coquille | C57 | E04.1-S20 | E04.1-CA11 | E04.1-T06 |
| matin, `.t-page` | E04.1 | En-tête | C02 | E04.1-S21 | E04.1-CA11 | E04.1-T07 |
| matin, `#stamp` | E04.1 | En-tête | C02 | E04.1-S22 | E04.1-CA12 | E04.1-T06 |
| matin, `#refresh` | E04.1 | En-tête | C10 | E04.1-S23 | E04.1-CA12 | E04.1-T06 |
| matin, `#h-now` | E04.1 | À traiter | C03 | E04.1-S24 | E04.1-CA13 | E04.1-T07 |
| matin, `.urgent p.late` | E04.1 | À traiter | C13 | E04.1-S25 | E04.1-CA13 | E04.1-T06 |
| matin, `.mini li` | E04.1 | À traiter | C06 | E04.1-S26 | E04.1-CA14 | E04.1-T06 |
| matin, `.urgent p.c2` | E04.1 | À traiter | C03 | E04.1-S27 | E04.1-CA13 | E04.1-T06 |
| matin, `.mini li` colonne 2 | E04.1 | À traiter | C06 | E04.1-S28 | E04.1-CA14 | E04.1-T06 |
| calme, `p[data-when="calme"]` | E04.1 | À traiter | C08 | E04.1-S29 | E04.1-CA13 | E04.1-T06 |
| matin, `#h-files` | E04.1 | Files | C03 | E04.1-S30 | E04.1-CA15 | E04.1-T07 |
| matin, `#files thead` | E04.1 | Files | C58 | E04.1-S31 | E04.1-CA15 | E04.1-T07 |
| matin, `#files tbody tr` | E04.1 | Files | C58 | E04.1-S32 | E04.1-CA16 | E04.1-T06 |
| matin, `td .late` | E04.1 | Files | C13 | E04.1-S33 | E04.1-CA07 | E04.1-T08 |
| matin, `td.c3` | E04.1 | Files | C58 | E04.1-S34 | E04.1-CA16 | E04.1-T07 |
| matin, `td[colspan="4"]` | E04.1 | Files | C58 | E04.1-S35 | E04.1-CA16 | E04.1-T06 |
| matin, lignes 10 et 11 | E04.1 | Files | C58 | E04.1-S36 | E04.1-CA16 | E04.1-T06 |
| matin, `#h-al` | E04.1 | Alertes | C03 | E04.1-S37 | E04.1-CA17 | E04.1-T06 |
| matin, `.alerts > li` | E04.1 | Alertes | C06 C13 | E04.1-S38 | E04.1-CA17 | E04.1-T06 |
| matin, `.alerts details` | E04.1 | Alertes | C26 | E04.1-S39 | E04.1-CA18 | E04.1-T06 |
| matin, `.alerts a.link` | E04.1 | Alertes | C11 | E04.1-S40 | E04.1-CA17 | E04.1-T10 |
| matin, `.alerts li:last-child` | E04.1 | Alertes | C06 | E04.1-S41 | E04.1-CA17 | E04.1-T10 |
| matin, `#h-day` | E04.1 | Aujourd'hui | C03 | E04.1-S42 | E04.1-CA19 | E04.1-T06 |
| matin, `.today dl:first-child` | E04.1 | Aujourd'hui | C07 | E04.1-S43 | E04.1-CA19 | E04.1-T07 |
| matin, `.today dl:last-child` | E04.1 | Aujourd'hui | C07 C13 | E04.1-S44 | E04.1-CA19 | E04.1-T06 |
| `#keys` | E04.1 | Dialogue | C27 | E04.1-S45 | E04.1-CA10 | E04.1-T06 |
| matin, `#announcer` | E04.1 | Page | C29 | E04.1-S46 | E04.1-CA12 | E04.1-T08 |
| non montré | E04.1 | Page | C03 | E04.1-S47 | E04.1-CA20 | E04.1-T10 |
| non montré (§5) | E04.1 | Page | C08 C09 C17 | E04.1-S48 | E04.1-CA21 | E04.1-T06 |
| decision, `.crumbs` | E05.1 | En-tête | C57 | E05.1-S01 | E05.1-CA01 | E05.1-T01 |
| decision, `.t-page` | E05.1 | En-tête | C02 | E05.1-S02 | E05.1-CA01 | E05.1-T01 |
| decision, `#release` | E05.1 | En-tête | C10 | E05.1-S03 | E05.1-CA02 | E05.1-T02 |
| decision, `a.btn--secondary` | E05.1 | En-tête | C10 C62 | E05.1-S04 | E05.1-CA03 | E05.1-T01 |
| decision, `.meta` | E05.1 | En-tête | C13 | E05.1-S05 | E05.1-CA04 | E05.1-T03 |
| decision 768, `.skip` | E05.1 | En-tête | C11 | E05.1-S06 | E05.1-CA05 | E05.1-T04 |
| decision, `#h-know` | E05.1 | À savoir | C03 C13 | E05.1-S07 | E05.1-CA06 | E05.1-T03 |
| decision, `.dsect:first-child p` | E05.1 | À savoir | C03 | E05.1-S08 | E05.1-CA06 | E05.1-T03 |
| modification, même zone | E05.1 | À savoir | C03 | E05.1-S09 | E05.1-CA06 | E05.1-T03 |
| decision, `#h-check` | E05.1 | À contrôler | C03 C14 | E05.1-S10 | E05.1-CA07 | E05.1-T01 |
| decision, `#pub-link` | E05.1 | À contrôler | C11 | E05.1-S11 | E05.1-CA08 | E05.1-T05 |
| decision, `.dsect p.xs` | E05.1 | À contrôler | C03 | E05.1-S12 | E05.1-CA07 | E05.1-T01 |
| decision, `.check` 1 | E05.1 | À contrôler | C60 | E05.1-S13 | E05.1-CA07 | E05.1-T01 |
| decision, `.check` 2 | E05.1 | À contrôler | C60 | E05.1-S14 | E05.1-CA09 | E05.1-T06 |
| decision, `.check` 3 | E05.1 | À contrôler | C60 | E05.1-S15 | E05.1-CA07 | E05.1-T01 |
| decision, `.check` 4 | E05.1 | À contrôler | C60 | E05.1-S16 | E05.1-CA07 | E05.1-T01 |
| decision, `.check__near` | E05.1 | À contrôler | C60 | E05.1-S17 | E05.1-CA07 | E05.1-T07 |
| decision, `.check__q` | E05.1 | À contrôler | C60 | E05.1-S18 | E05.1-CA07 | E05.1-T07 |
| modification, `.badge--info` | E05.1 | À contrôler | C13 | E05.1-S19 | E05.1-CA10 | E05.1-T03 |
| modification, `.was` | E05.1 | À contrôler | C60 | E05.1-S20 | E05.1-CA10 | E05.1-T03 |
| decision, `#h-look` | E05.1 | Recherche | C07 C14 | E05.1-S21 | E05.1-CA11 | E05.1-T01 |
| decision, `#h-cond` | E05.1 | Conditions | C07 C14 | E05.1-S22 | E05.1-CA11 | E05.1-T01 |
| decision, `.emptyline` | E05.1 | Conditions | C07 | E05.1-S23 | E05.1-CA11 | E05.1-T07 |
| decision, `#h-acc` | E05.1 | Compte | C03 C14 | E05.1-S24 | E05.1-CA11 | E05.1-T01 |
| decision, `.idv` | E05.1 | Interlocuteur | C62 | E05.1-S25 | E05.1-CA12 | E05.1-T08 |
| decision, `#h-hist` | E05.1 | Historique | C26 C53 | E05.1-S26 | E05.1-CA13 | E05.1-T01 |
| decision, `#decision-panel` | E05.1 | Décision | C59 | E05.1-S27 | E05.1-CA14 | E05.1-T04 |
| decision, `#note` | E05.1 | Décision repos | C18 | E05.1-S28 | E05.1-CA15 | E05.1-T07 |
| decision, `#b-pub` | E05.1 | Décision repos | C12 C10 | E05.1-S29 | E05.1-CA16 | E05.1-T02 |
| decision, `#b-rej` | E05.1 | Décision repos | C10 | E05.1-S30 | E05.1-CA16 | E05.1-T02 |
| decision, `#keys-line` | E05.1 | Décision | C27 | E05.1-S31 | E05.1-CA17 | E05.1-T02 |
| `#p-pub` (script) | E05.1 | Publication | C05 | E05.1-S32 | E05.1-CA16 | E05.1-T02 |
| refus, `.reasons-list` | E05.1 | Refus | C05 C21 | E05.1-S33 | E05.1-CA18 | E05.1-T02 |
| refus, `#why-msg` | E05.1 | Refus | C05 | E05.1-S34 | E05.1-CA18 | E05.1-T02 |
| `#why-err` (script) | E05.1 | Refus | C19 | E05.1-S35 | E05.1-CA19 | E05.1-T02 |
| refus, `#c-rej` | E05.1 | Refus | C12 | E05.1-S36 | E05.1-CA18 | E05.1-T02 |
| non montré | E05.1 | Refus | C18 | E05.1-S37 | E05.1-CA18 | E05.1-T07 |
| `#p-rel` (script) | E05.1 | Rendre la main | C05 | E05.1-S38 | E05.1-CA02 | E05.1-T02 |
| publie, `#done-text` | E05.1 | Décidé | C17 | E05.1-S39 | E05.1-CA20 | E05.1-T02 |
| publie, `#next` | E05.1 | Décidé | C10 C11 | E05.1-S40 | E05.1-CA20 | E05.1-T02 |
| `#keys` | E05.1 | Dialogue | C27 | E05.1-S41 | E05.1-CA17 | E05.1-T02 |
| non montré | E05.1 | États | C17 | E05.1-S42 | E05.1-CA21 | E05.1-T03 |
| aucune (cadre E05.1) | E05.2 | Cadre | C59 | E05.2-S01 | E05.2-CA01 | E05.2-T01 |
| aucune | E05.2 | À savoir | C03 C13 | E05.2-S02 | E05.2-CA02 | E05.2-T02 |
| aucune | E05.2 | Profil | C07 | E05.2-S03 | E05.2-CA02 | E05.2-T02 |
| aucune | E05.2 | Réseaux | C62 C35 | E05.2-S04 | E05.2-CA03 | E05.2-T01 |
| aucune (forme E05.1-S19, S20) | E05.2 | Changement | C60 | E05.2-S05 | E05.2-CA02 | E05.2-T02 |
| aucune | E05.2 | Portfolio | C34 | E05.2-S06 | E05.2-CA04 | E05.2-T01 |
| aucune | E05.2 | Décision | C59 C21 | E05.2-S07 | E05.2-CA05 | E05.2-T01 |
| aucune | E05.3 | Cadre | C59 | E05.3-S01 | E05.3-CA01 | E05.3-T01 |
| aucune | E05.3 | À savoir | C17 | E05.3-S02 | E05.3-CA02 | E05.3-T02 |
| aucune | E05.3 | Second avis | C03 | E05.3-S03 | E05.3-CA02 | E05.3-T02 |
| aucune | E05.3 | Marque | C07 | E05.3-S04 | E05.3-CA01 | E05.3-T01 |
| aucune | E05.3 | Campagne | C07 C24 | E05.3-S05 | E05.3-CA03 | E05.3-T01 |
| aucune | E05.3 | Brief | C03 | E05.3-S06 | E05.3-CA01 | E05.3-T01 |
| aucune | E05.3 | Alertes | C13 | E05.3-S07 | E05.3-CA02 | E05.3-T02 |
| aucune | E05.3 | Décision | C59 C18 | E05.3-S08 | E05.3-CA04 | E05.3-T01 |
| aucune | E05.4 | Cadre | C59 | E05.4-S01 | E05.4-CA01 | E05.4-T01 |
| aucune | E05.4 | Visuel | C34 | E05.4-S02 | E05.4-CA02 | E05.4-T01 |
| aucune | E05.4 | Grille | C60 C58 | E05.4-S03 | E05.4-CA03 | E05.4-T02 |
| aucune | E05.4 | Légende | C03 | E05.4-S04 | E05.4-CA03 | E05.4-T01 |
| aucune | E05.4 | Profil | C07 | E05.4-S05 | E05.4-CA01 | E05.4-T01 |
| aucune | E05.4 | Décision | C59 C21 | E05.4-S06 | E05.4-CA04 | E05.4-T01 |
| aucune | E05.5 | Cadre | C59 | E05.5-S01 | E05.5-CA01 | E05.5-T01 |
| aucune | E05.5 | Demande | C07 C62 | E05.5-S02 | E05.5-CA02 | E05.5-T01 |
| aucune | E05.5 | Pièces | C64 | E05.5-S03 | E05.5-CA03 | E05.5-T01 |
| aucune | E05.5 | Procédure | C65 | E05.5-S04 | E05.5-CA02 | E05.5-T02 |
| aucune | E05.5 | Constat | C18 C47 | E05.5-S05 | E05.5-CA04 | E05.5-T01 |
| aucune | E05.5 | Décision | C59 C21 | E05.5-S06 | E05.5-CA05 | E05.5-T01 |
| aucune | E05.6 | Cadre | C59 | E05.6-S01 | E05.6-CA01 | E05.6-T01 |
| aucune | E05.6 | Demande | C07 | E05.6-S02 | E05.6-CA01 | E05.6-T01 |
| aucune | E05.6 | Procédure | C65 | E05.6-S03 | E05.6-CA02 | E05.6-T02 |
| aucune | E05.6 | Constat | C18 C21 | E05.6-S04 | E05.6-CA02 | E05.6-T01 |
| aucune | E05.6 | Décision | C59 C21 | E05.6-S05 | E05.6-CA03 | E05.6-T01 |
| aucune | E05.7 | Cadre | C59 | E05.7-S01 | E05.7-CA01 | E05.7-T01 |
| aucune | E05.7 | Contestation | C07 | E05.7-S02 | E05.7-CA01 | E05.7-T01 |
| aucune | E05.7 | Décision contestée | C03 | E05.7-S03 | E05.7-CA02 | E05.7-T02 |
| aucune | E05.7 | Pièces | C64 | E05.7-S04 | E05.7-CA03 | E05.7-T01 |
| aucune | E05.7 | Décision | C59 C21 C18 | E05.7-S05 | E05.7-CA04 | E05.7-T01 |
| aucune | E05.8 | Cadre | C59 | E05.8-S01 | E05.8-CA01 | E05.8-T01 |
| aucune | E05.8 | Changement | C62 C07 | E05.8-S02 | E05.8-CA02 | E05.8-T01 |
| aucune | E05.8 | Badges | C03 | E05.8-S03 | E05.8-CA01 | E05.8-T02 |
| aucune | E05.8 | Décision | C59 C18 | E05.8-S04 | E05.8-CA03 | E05.8-T01 |
| aucune | E05.9 | Cadre | C59 | E05.9-S01 | E05.9-CA01 | E05.9-T01 |
| aucune | E05.9 | Demande | C07 | E05.9-S02 | E05.9-CA01 | E05.9-T01 |
| aucune | E05.9 | Critères | C38 | E05.9-S03 | E05.9-CA02 | E05.9-T01 |
| aucune | E05.9 | Message | C03 | E05.9-S04 | E05.9-CA02 | E05.9-T01 |
| aucune | E05.9 | Décision | C59 C21 | E05.9-S05 | E05.9-CA03 | E05.9-T01 |
| file, `.crumbs` | E16.1 | En-tête | C57 | E16.1-S01 | E16.1-CA01 | E16.1-T01 |
| file, `.lhead` | E16.1 | En-tête | C02 | E16.1-S02 | E16.1-CA01 | E16.1-T01 |
| file, `.lsum` | E16.1 | En-tête | C32 | E16.1-S03 | E16.1-CA02 | E16.1-T02 |
| file, `.fbar` | E16.1 | Filtres | C30 | E16.1-S04 | E16.1-CA03 | E16.1-T03 |
| file-retard, `#late-only` | E16.1 | Filtres | C30 | E16.1-S05 | E16.1-CA03 | E16.1-T03 |
| file, `.fbar__sep` | E16.1 | Filtres | C30 | E16.1-S06 | E16.1-CA03 | E16.1-T07 |
| file, `.pill` | E16.1 | Filtres | C30 | E16.1-S07 | E16.1-CA03 | E16.1-T03 |
| file, dernière `.pill` | E16.1 | Filtres | C30 C47 | E16.1-S08 | E16.1-CA04 | E16.1-T03 |
| aucun état (CSS seul) | E16.1 | Filtres | C30 | E16.1-S09 | E16.1-CA04 | E16.1-T03 |
| file, `#f-count` ; file-retard | E16.1 | Liste | C32 | E16.1-S10 | E16.1-CA05 | E16.1-T01 |
| file, `#tq thead` | E16.1 | Liste | C58 | E16.1-S11 | E16.1-CA06 | E16.1-T07 |
| file, `.id` | E16.1 | Liste | C58 | E16.1-S12 | E16.1-CA07 | E16.1-T04 |
| file, `.al` | E16.1 | Liste | C13 | E16.1-S13 | E16.1-CA08 | E16.1-T01 |
| file, `.late` | E16.1 | Liste | C13 C58 | E16.1-S14 | E16.1-CA08 | E16.1-T02 |
| file, `td:nth-child(3)` | E16.1 | Liste | C58 | E16.1-S15 | E16.1-CA09 | E16.1-T01 |
| file, `td` | E16.1 | Liste | C58 | E16.1-S16 | E16.1-CA09 | E16.1-T01 |
| file, `.lock` | E16.1 | Liste | C58 C13 | E16.1-S17 | E16.1-CA08 | E16.1-T02 |
| file, `.tbl tr` | E16.1 | Liste | C58 | E16.1-S18 | E16.1-CA07 | E16.1-T04 |
| file, `.lfoot` | E16.1 | Pied | C32 | E16.1-S19 | E16.1-CA05 | E16.1-T01 |
| non montré | E16.1 | Pied | C32 C10 | E16.1-S20 | E16.1-CA10 | E16.1-T05 |
| file-vide, `.empty-state` | E16.1 | Vide | C08 | E16.1-S21 | E16.1-CA11 | E16.1-T05 |
| `#keys` | E16.1 | Dialogue | C27 | E16.1-S22 | E16.1-CA12 | E16.1-T04 |
| non montré | E16.1 | États | C09 C17 | E16.1-S23 | E16.1-CA10 | E16.1-T05 |
| inscrits, `.lhead` | E16.2 | En-tête | C57 C02 | E16.2-S01 | E16.2-CA01 | E16.2-T01 |
| inscrits, `p.row` | E16.2 | Échecs | C17 | E16.2-S02 | E16.2-CA02 | E16.2-T02 |
| inscrits, `.search` | E16.2 | Filtres | C30 C18 | E16.2-S03 | E16.2-CA03 | E16.2-T03 |
| inscrits, `.pill` | E16.2 | Filtres | C30 | E16.2-S04 | E16.2-CA04 | E16.2-T03 |
| inscrits, `p.xs` | E16.2 | Filtres | C18 | E16.2-S05 | E16.2-CA03 | E16.2-T03 |
| inscrits, `#i-count` | E16.2 | Liste | C32 | E16.2-S06 | E16.2-CA05 | E16.2-T03 |
| inscrits, `.id`, `.mail` | E16.2 | Liste | C58 | E16.2-S07 | E16.2-CA06 | E16.2-T04 |
| inscrits, `td .mute` | E16.2 | Liste | C58 | E16.2-S08 | E16.2-CA07 | E16.2-T01 |
| inscrits, colonne 4 | E16.2 | Liste | C58 | E16.2-S09 | E16.2-CA07 | E16.2-T01 |
| inscrits, `.sync` | E16.2 | Liste | C13 | E16.2-S10 | E16.2-CA08 | E16.2-T01 |
| inscrits, colonnes 7 et 8 | E16.2 | Liste | C58 | E16.2-S11 | E16.2-CA07 | E16.2-T01 |
| inscrits, `.lfoot` | E16.2 | Pied | C32 C10 | E16.2-S12 | E16.2-CA05 | E16.2-T01 |
| non montré | E16.2 | États | C08 C09 C17 | E16.2-S13 | E16.2-CA09 | E16.2-T03 |
| provisoire, `.ph-shell` | E19.1 | Garde | C67 | E19.1-S01 | E19.1-CA01 | E19.1-T01 |
| provisoire, `.ph-band` | E19.1 | Bande | C57 | E19.1-S02 | E19.1-CA02 | E19.1-T02 |
| provisoire, `.ph-band span:last-child` | E19.1 | Bande | C57 | E19.1-S03 | E19.1-CA02 | E19.1-T02 |
| provisoire, `.ph-h1` | E19.1 | Corps | C02 | E19.1-S04 | E19.1-CA03 | E19.1-T02 |
| provisoire, `p.c2` | E19.1 | Corps | C67 | E19.1-S05 | E19.1-CA03 | E19.1-T02 |
| provisoire, `p.xs` | E19.1 | Corps | C67 | E19.1-S06 | E19.1-CA03 | E19.1-T02 |
| provisoire, `.btn--secondary` | E19.1 | Corps | C10 | E19.1-S07 | E19.1-CA04 | E19.1-T03 |
| non montré | E19.1 | Garde | C67 | E19.1-S08 | E19.1-CA05 | E19.1-T01 |
| non montré | E19.1 | Garde | C67 | E19.1-S09 | E19.1-CA02 | E19.1-T02 |
