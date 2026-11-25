# Matrice — membres-entree (1)

> Produite par script depuis le §3 de chaque fiche (colonne « Spécification » : identifiant de l'élément, à lire
> dans `ecrans/`). Critères : §6 ; tests : §7 de la même fiche.

| Maquette | Écran | Section | Composant | Spécification | Critère d'acceptation | Test |
|---|---|---|---|---|---|---|
| non montré (existant) | E01.0 | Coquille | C56 | E01.0-S01 | E01.0-CA05 | E01.0-T02 |
| tous, `.m-shell` | E01.0 | Coquille | C56 | E01.0-S02 | E01.0-CA01 | E01.0-T01 |
| tous, `.m-brand` | E01.0 | En-tête | C56 | E01.0-S03 | E01.0-CA01 | E01.0-T01 |
| tous, `.role` | E01.0 | En-tête | C15 | E01.0-S04 | E01.0-CA01 | E01.0-T01 |
| tous, `.m-head .btn` | E01.0 | En-tête | C10 | E01.0-S05 | E01.0-CA06 | E01.0-T02 |
| tous, `.m-nav__link` | E01.0 | Navigation | C56 | E01.0-S06 | E01.0-CA02 | E01.0-T01 |
| tous, `.is-current` | E01.0 | Navigation | C56 | E01.0-S07 | E01.0-CA02 | E01.0-T01 |
| `proto-compte`, `.is-ancestor` | E01.0 | Navigation | C56 | E01.0-S08 | E01.0-CA02 | E01.0-T01 |
| `proto-compte`, `.m-sub a` | E01.0 | Navigation | C56 | E01.0-S09 | E01.0-CA02 | E01.0-T01 |
| tous à 375, `.m-nav` | E01.0 | Barre du bas | C56 | E01.0-S10 | E01.0-CA03 | E01.0-T01 |
| tous, `.m-state b` | E01.0 | Bloc d'état | C56 | E01.0-S11 | E01.0-CA04 | E01.0-T03 |
| `marque-neuve`, `.m-state .c2` | E01.0 | Bloc d'état | C56 | E01.0-S12 | E01.0-CA04 | E01.0-T03 |
| `marque-neuve`, `.m-state .go` | E01.0 | Bloc d'état | C11 | E01.0-S13 | E01.0-CA04 | E01.0-T03 |
| tous, `.m-foot .btn` | E01.0 | Pied | C10 | E01.0-S14 | E01.0-CA06 | E01.0-T02 |
| tous, `.m-foot p` | E01.0 | Pied | C56 | E01.0-S15 | E01.0-CA04 | E01.0-T03 |
| tous, `.m-foot .btn` (2) | E01.0 | Pied | C10 | E01.0-S16 | E01.0-CA07 | E01.0-T02 |
| tous, `.m-page` | E01.0 | Contenu | C01 | E01.0-S17 | E01.0-CA08 | E01.0-T01 |
| tous, `.t-page` | E01.1 | En-tête | C02 | E01.1-S01 | E01.1-CA01 | E01.1-T01 |
| `marque-neuve`, `#mn-w` | E01.1 | Bienvenue | C03 | E01.1-S02 | E01.1-CA02 | E01.1-T01 |
| `marque-neuve`, `.measure` | E01.1 | Bienvenue | C03 | E01.1-S03 | E01.1-CA02 | E01.1-T01 |
| `marque-neuve`, `.card` | E01.1 | Bien démarrer | C04 | E01.1-S04 | E01.1-CA03 | E01.1-T01 |
| `.sect__bar` | E01.1 | Bien démarrer | C43 | E01.1-S05 | E01.1-CA03 | E01.1-T02 |
| `.bar` | E01.1 | Bien démarrer | C43 | E01.1-S06 | E01.1-CA03 | E01.1-T02 |
| `.todo .is-done` | E01.1 | Tâche 1 | C43 | E01.1-S07 | E01.1-CA04 | E01.1-T02 |
| `.todo > li:nth-child(2)` | E01.1 | Tâche 2 | C43 | E01.1-S08 | E01.1-CA05 | E01.1-T02 |
| `.t-act .btn--primary` | E01.1 | Tâche 2 | C10 | E01.1-S09 | E01.1-CA05 | E01.1-T02 |
| `.is-locked` (1) | E01.1 | Tâche 3 | C43 | E01.1-S10 | E01.1-CA06 | E01.1-T02 |
| `.todo > li:nth-child(4)` | E01.1 | Tâche 4 | C43 | E01.1-S11 | E01.1-CA07 | E01.1-T03 |
| `.t-act .go` | E01.1 | Tâche 4 | C11 | E01.1-S12 | E01.1-CA07 | E01.1-T03 |
| `.is-locked` (2) | E01.1 | Tâche 5 | C43 | E01.1-S13 | E01.1-CA06 | E01.1-T02 |
| `.todo > li` | E01.1 | Liste | C43 | E01.1-S14 | E01.1-CA03 | E01.1-T01 |
| `marque`, `#ma-todo` | E01.1 | À traiter | C03 | E01.1-S15 | E01.1-CA08 | E01.1-T04 |
| `marque`, `.notice--warning` | E01.1 | À traiter | C17 | E01.1-S16 | E01.1-CA08 | E01.1-T04 |
| `.notice .btn--primary` | E01.1 | À traiter | C10 | E01.1-S17 | E01.1-CA08 | E01.1-T04 |
| `#ma-camp` | E01.1 | Mes campagnes | C03 | E01.1-S18 | E01.1-CA09 | E01.1-T04 |
| `.sect__bar .btn` | E01.1 | Mes campagnes | C10 | E01.1-S19 | E01.1-CA07 | E01.1-T03 |
| `.rows--camp` | E01.1 | Mes campagnes | C06 | E01.1-S20 | E01.1-CA09 | E01.1-T04 |
| `.r-title` | E01.1 | Mes campagnes | C06 | E01.1-S21 | E01.1-CA09 | E01.1-T04 |
| `.badge` | E01.1 | Mes campagnes | C13 | E01.1-S22 | E01.1-CA10 | E01.1-T04 |
| `.r-meta`, `.r-chev` | E01.1 | Mes campagnes | C06 | E01.1-S23 | E01.1-CA09 | E01.1-T04 |
| `.sect > .go` | E01.1 | Mes campagnes | C11 | E01.1-S24 | E01.1-CA09 | E01.1-T04 |
| `#ma-find` | E01.1 | Trouver | C03 | E01.1-S25 | E01.1-CA11 | E01.1-T01 |
| `.actions .btn` | E01.1 | Trouver | C10 | E01.1-S26 | E01.1-CA11 | E01.1-T01 |
| `.actions .link` | E01.1 | Trouver | C11 | E01.1-S27 | E01.1-CA11 | E01.1-T01 |
| `h3.overline + .rows` | E01.1 | Mes sélections | C06 | E01.1-S28 | E01.1-CA12 | E01.1-T04 |
| `#ma-prof` | E01.1 | Mon profil | C03 | E01.1-S29 | E01.1-CA13 | E01.1-T04 |
| `.profile-line` | E01.1 | Mon profil | C13 | E01.1-S30 | E01.1-CA13 | E01.1-T04 |
| `.go` | E01.1 | Mon profil | C11 | E01.1-S31 | E01.1-CA13 | E01.1-T04 |
| non montré | E01.1 | Chargement | C09 | E01.1-S32 | E01.1-CA14 | E01.1-T05 |
| non montré | E01.1 | Erreur | C08 | E01.1-S33 | E01.1-CA14 | E01.1-T05 |
| tous, `.t-page` | E01.2 | En-tête | C02 | E01.2-S01 | E01.2-CA01 | E01.2-T01 |
| `createur`, `.page-head p` | E01.2 | En-tête | C02 | E01.2-S02 | E01.2-CA01 | E01.2-T01 |
| `createur-neuf`, `#cn-w` | E01.2 | Bienvenue | C03 | E01.2-S03 | E01.2-CA02 | E01.2-T01 |
| `createur-neuf`, `.card` | E01.2 | Bien démarrer | C04 | E01.2-S04 | E01.2-CA03 | E01.2-T01 |
| `.sect__bar`, `.bar` | E01.2 | Bien démarrer | C43 | E01.2-S05 | E01.2-CA03 | E01.2-T02 |
| `.is-done` | E01.2 | Tâche 1 | C43 | E01.2-S06 | E01.2-CA03 | E01.2-T02 |
| `.todo > li:nth-child(2)` | E01.2 | Tâche 2 | C43 | E01.2-S07 | E01.2-CA04 | E01.2-T02 |
| `.chips-inline .link` | E01.2 | Tâche 2 | C38 | E01.2-S08 | E01.2-CA04 | E01.2-T02 |
| `.t-act .btn--primary` | E01.2 | Tâche 2 | C10 | E01.2-S09 | E01.2-CA04 | E01.2-T02 |
| `.todo > li:nth-child(3)` | E01.2 | Tâche 3 | C43 | E01.2-S10 | E01.2-CA05 | E01.2-T02 |
| `.t-act .go` (1) | E01.2 | Tâche 3 | C11 | E01.2-S11 | E01.2-CA05 | E01.2-T03 |
| `.is-locked` | E01.2 | Tâche 4 | C43 | E01.2-S12 | E01.2-CA06 | E01.2-T02 |
| `.todo > li:nth-child(5)` | E01.2 | Tâche 5 | C43 | E01.2-S13 | E01.2-CA07 | E01.2-T02 |
| `.t-act .go` (2) | E01.2 | Tâche 5 | C11 | E01.2-S14 | E01.2-CA07 | E01.2-T03 |
| `createur`, `#ca-todo` | E01.2 | À faire | C03 | E01.2-S15 | E01.2-CA08 | E01.2-T04 |
| `.rows li:nth-child(1)` | E01.2 | À faire | C06 | E01.2-S16 | E01.2-CA09 | E01.2-T04 |
| `.rows li:nth-child(2)` | E01.2 | À faire | C06 | E01.2-S17 | E01.2-CA10 | E01.2-T04 |
| `#cn-feed`, `#ca-feed` | E01.2 | Campagnes | C03 | E01.2-S18 | E01.2-CA11 | E01.2-T03 |
| `createur`, `.sect__bar .btn` | E01.2 | Campagnes | C10 | E01.2-S19 | E01.2-CA11 | E01.2-T03 |
| `createur-neuf`, `.sect > .go` | E01.2 | Campagnes | C11 | E01.2-S20 | E01.2-CA11 | E01.2-T03 |
| `.logo-plate` | E01.2 | Campagnes | C33 | E01.2-S21 | E01.2-CA12 | E01.2-T01 |
| `.r-main .sm`, `.badge--verified` | E01.2 | Campagnes | C48 | E01.2-S22 | E01.2-CA12 | E01.2-T04 |
| `.r-title` | E01.2 | Campagnes | C48 | E01.2-S23 | E01.2-CA11 | E01.2-T03 |
| `.deadline` | E01.2 | Campagnes | C48 | E01.2-S24 | E01.2-CA12 | E01.2-T04 |
| `.rows--feed > li` | E01.2 | Campagnes | C06 | E01.2-S25 | E01.2-CA11 | E01.2-T01 |
| `#ca-prof` | E01.2 | Mon profil | C03 | E01.2-S26 | E01.2-CA13 | E01.2-T04 |
| `.profile-line` | E01.2 | Mon profil | C13 | E01.2-S27 | E01.2-CA13 | E01.2-T04 |
| `.sect__bar.sm`, `.bar` | E01.2 | Mon profil | C43 | E01.2-S28 | E01.2-CA13 | E01.2-T04 |
| `.go` (1) | E01.2 | Mon profil | C11 | E01.2-S29 | E01.2-CA13 | E01.2-T03 |
| `.go` (2) | E01.2 | Mon profil | C11 | E01.2-S30 | E01.2-CA13 | E01.2-T03 |
| non montré | E01.2 | Chargement | C09 | E01.2-S31 | E01.2-CA14 | E01.2-T05 |
| non montré | E01.2 | Erreur, vide | C08 | E01.2-S32 | E01.2-CA14 | E01.2-T05 |
| tous, `.m-brand` | E11.1 | En-tête | C50 | E11.1-S01 | E11.1-CA01 | E11.1-T01 |
| tous, `.a-head .btn` | E11.1 | En-tête | C10 | E11.1-S02 | E11.1-CA05 | E11.1-T02 |
| `porte`, `h1` | E11.1 | Titre | C02 | E11.1-S03 | E11.1-CA01 | E11.1-T01 |
| `porte`, `.a-top p` | E11.1 | Titre | C02 | E11.1-S04 | E11.1-CA01 | E11.1-T01 |
| `porte`, `.door` | E11.1 | Portes | C04 | E11.1-S05 | E11.1-CA02 | E11.1-T01 |
| `.door .i--lg` | E11.1 | Portes | C04 | E11.1-S06 | E11.1-CA02 | E11.1-T01 |
| `.door h2 .cover` | E11.1 | Portes | C04 | E11.1-S07 | E11.1-CA03 | E11.1-T02 |
| `.door p` | E11.1 | Portes | C04 | E11.1-S08 | E11.1-CA02 | E11.1-T01 |
| `porte`, `.a-alt` | E11.1 | Bas | C11 | E11.1-S09 | E11.1-CA04 | E11.1-T02 |
| `email`, `.a-meta` | E11.2 | Méta | C50 | E11.2-S01 | E11.2-CA01 | E11.2-T01 |
| `email`, `.a-meta .link` | E11.2 | Méta | C11 | E11.2-S02 | E11.2-CA02 | E11.2-T02 |
| `email`, `h1` | E11.2 | Titre | C02 | E11.2-S03 | E11.2-CA01 | E11.2-T01 |
| `email`, `.a-top > .c2` | E11.2 | Titre | C02 | E11.2-S04 | E11.2-CA01 | E11.2-T01 |
| `#mail` | E11.2 | Champ | C18 | E11.2-S05 | E11.2-CA03 | E11.2-T01 |
| `email-erreur`, `#mail-err` | E11.2 | Champ | C19 | E11.2-S06 | E11.2-CA04 | E11.2-T03 |
| `#send-code` | E11.2 | Action | C10 | E11.2-S07 | E11.2-CA05 | E11.2-T03 |
| `details.fold` | E11.2 | Mention | C26 | E11.2-S08 | E11.2-CA06 | E11.2-T02 |
| `email`, `.a-alt` | E11.2 | Bas | C11 | E11.2-S09 | E11.2-CA02 | E11.2-T02 |
| `connexion`, `h1` | E11.3 | Titre | C02 | E11.3-S01 | E11.3-CA01 | E11.3-T01 |
| `connexion`, `#f-email` | E11.3 | Corps | C18 | E11.3-S02 | E11.3-CA01 | E11.3-T01 |
| `connexion`, `.a-alt` | E11.3 | Bas | C11 | E11.3-S03 | E11.3-CA02 | E11.3-T02 |
| `code`, `code-connexion`, `.a-meta` | E11.4 | Méta | C50 | E11.4-S01 | E11.4-CA01 | E11.4-T01 |
| `code`, `h1` | E11.4 | Titre | C02 | E11.4-S02 | E11.4-CA01 | E11.4-T01 |
| `code`, `.a-top > .c2` | E11.4 | Destinataire | C11 | E11.4-S03 | E11.4-CA02 | E11.4-T02 |
| `code`, `.phrase` | E11.4 | Phrase | C05 | E11.4-S04 | E11.4-CA03 | E11.4-T02 |
| `code`, `.otp` | E11.4 | Code | C49 | E11.4-S05 | E11.4-CA04 | E11.4-T03 |
| `.otp span.cur` | E11.4 | Code | C49 | E11.4-S06 | E11.4-CA04 | E11.4-T03 |
| `code-erreur`, `.otp.bad`, `#otp-err` | E11.4 | Code | C19 | E11.4-S07 | E11.4-CA05 | E11.4-T03 |
| `#otp-help` | E11.4 | Code | C18 | E11.4-S08 | E11.4-CA04 | E11.4-T01 |
| `#verify` | E11.4 | Action | C10 | E11.4-S09 | E11.4-CA06 | E11.4-T02 |
| `#cd` | E11.4 | Renvoi | C50 | E11.4-S10 | E11.4-CA07 | E11.4-T04 |
| `#cd button` | E11.4 | Renvoi | C11 | E11.4-S11 | E11.4-CA07 | E11.4-T04 |
| `#no-code` | E11.4 | Aide | C26 | E11.4-S12 | E11.4-CA08 | E11.4-T05 |
| `code-aide`, `#rescue` | E11.4 | Aide | C51 | E11.4-S13 | E11.4-CA08 | E11.4-T05 |
| `#r-mail` | E11.4 | Aide | C18 | E11.4-S14 | E11.4-CA09 | E11.4-T05 |
| `#r-msg` | E11.4 | Aide | C18 | E11.4-S15 | E11.4-CA09 | E11.4-T05 |
| `#r-send` | E11.4 | Aide | C10 | E11.4-S16 | E11.4-CA09 | E11.4-T05 |
| `#rescue .xs` | E11.4 | Aide | C18 | E11.4-S17 | E11.4-CA09 | E11.4-T05 |
| `infos-marque`, `.a-meta` | E11.5 | Méta | C50 | E11.5-S01 | E11.5-CA01 | E11.5-T01 |
| `h1` | E11.5 | Titre | C02 | E11.5-S02 | E11.5-CA01 | E11.5-T01 |
| `.a-top > .c2` | E11.5 | Titre | C02 | E11.5-S03 | E11.5-CA01 | E11.5-T01 |
| `infos-createur`, `#errsum` | E11.5 | Résumé | C20 | E11.5-S04 | E11.5-CA02 | E11.5-T03 |
| `#i-co` | E11.5 | Vous | C18 | E11.5-S05 | E11.5-CA03 | E11.5-T02 |
| `#i-country` | E11.5 | Vous | C18 | E11.5-S06 | E11.5-CA04 | E11.5-T02 |
| `infos-createur`, `#i-country-e` | E11.5 | Vous | C19 | E11.5-S07 | E11.5-CA02 | E11.5-T03 |
| `.seg` | E11.5 | Vous | C22 | E11.5-S08 | E11.5-CA05 | E11.5-T02 |
| `#i-status` | E11.5 | Vous | C21 | E11.5-S09 | E11.5-CA06 | E11.5-T02 |
| `#c-age-l` | E11.5 | Engagements | C21 | E11.5-S10 | E11.5-CA06 | E11.5-T02 |
| `#c-cgu-l` | E11.5 | Engagements | C21 | E11.5-S11 | E11.5-CA07 | E11.5-T04 |
| `#c-mkt-l` | E11.5 | Engagements | C21 | E11.5-S12 | E11.5-CA08 | E11.5-T02 |
| `#i-src` | E11.5 | Facultatif | C18 | E11.5-S13 | E11.5-CA09 | E11.5-T02 |
| `#create` | E11.5 | Action | C10 | E11.5-S14 | E11.5-CA10 | E11.5-T02 |
| `form > .xs` | E11.5 | Action | C18 | E11.5-S15 | E11.5-CA10 | E11.5-T01 |
| `infos-createur` | E11.6 | Méta | C50 | E11.6-S01 | E11.6-CA01 | E11.6-T01 |
| `#i-country` | E11.6 | Vous | C18 | E11.6-S02 | E11.6-CA01 | E11.6-T02 |
| `.seg` | E11.6 | Vous | C22 | E11.6-S03 | E11.6-CA01 | E11.6-T02 |
| `#i-status` | E11.6 | Vous | C21 | E11.6-S04 | E11.6-CA02 | E11.6-T02 |
| `#i-status-e` | E11.6 | Vous | C19 | E11.6-S05 | E11.6-CA03 | E11.6-T03 |
| `infos-createur`, `#c-age-l.is-bad` | E11.6 | Engagements | C21 | E11.6-S06 | E11.6-CA03 | E11.6-T03 |
| `#c-cgu-l` | E11.6 | Engagements | C21 | E11.6-S07 | E11.5-CA07 | E11.6-T02 |
| `#c-mkt-l.is-bad` | E11.6 | Engagements | C21 | E11.6-S08 | E11.6-CA03 | E11.6-T03 |
| `#i-src`, `#create` | E11.6 | Bas | C18 | E11.6-S09 | E11.5-CA09 | E11.6-T02 |
| `autre-role`, `.a-meta` | E11.7 | Méta | C50 | E11.7-S01 | E11.7-CA01 | E11.7-T01 |
| `autre-role`, `h1` | E11.7 | Titre | C02 | E11.7-S02 | E11.7-CA01 | E11.7-T01 |
| `.notice--info` | E11.7 | Corps | C17 | E11.7-S03 | E11.7-CA01 | E11.7-T01 |
| `.btn--primary` | E11.7 | Actions | C10 | E11.7-S04 | E11.7-CA02 | E11.7-T01 |
| `.btn--text` | E11.7 | Actions | C10 | E11.7-S05 | E11.7-CA03 | E11.7-T02 |
| `hub`, `.t-page` | E20.1 | En-tête | C02 | E20.1-S01 | E20.1-CA01 | E20.1-T01 |
| `hub`, `.cp-head p` | E20.1 | En-tête | C02 | E20.1-S02 | E20.1-CA01 | E20.1-T01 |
| `.hubl li` | E20.1 | Menu | C06 | E20.1-S03 | E20.1-CA02 | E20.1-T01 |
| `.hubl .s` | E20.1 | Menu | C06 | E20.1-S04 | E20.1-CA02 | E20.1-T01 |
| `.hubl .chev` | E20.1 | Menu | C06 | E20.1-S05 | E20.1-CA02 | E20.1-T01 |
| `hub`, `.btn` | E20.1 | Bas | C10 | E20.1-S06 | E20.1-CA03 | E20.1-T02 |
| `infos`, `.go.lg-hide` | E20.2 | Retour | C11 | E20.2-S01 | E20.2-CA01 | E20.2-T01 |
| `.row.between` | E20.2 | En-tête | C02 | E20.2-S02 | E20.2-CA01 | E20.2-T01 |
| `.save` | E20.2 | En-tête | C25 | E20.2-S03 | E20.2-CA02 | E20.2-T02 |
| `.cp-head > .c2` | E20.2 | En-tête | C02 | E20.2-S04 | E20.2-CA01 | E20.2-T01 |
| `#h-acc` | E20.2 | Compte | C03 | E20.2-S05 | E20.2-CA03 | E20.2-T01 |
| `#i-co` | E20.2 | Compte | C18 | E20.2-S06 | E20.2-CA04 | E20.2-T03 |
| `#i-country` | E20.2 | Compte | C18 | E20.2-S07 | E20.2-CA03 | E20.2-T03 |
| `.seg` | E20.2 | Compte | C22 | E20.2-S08 | E20.2-CA05 | E20.2-T03 |
| `.choices` | E20.2 | Compte | C21 | E20.2-S09 | E20.2-CA06 | E20.2-T03 |
| `#h-mail` | E20.2 | Adresse | C03 | E20.2-S10 | E20.2-CA03 | E20.2-T01 |
| `.ro` | E20.2 | Adresse | C05 | E20.2-S11 | E20.2-CA07 | E20.2-T04 |
| `infos`, `.ro .btn` | E20.2 | Adresse | C10 | E20.2-S12 | E20.2-CA07 | E20.2-T04 |
| `infos`, `.sec > .sm` | E20.2 | Adresse | C18 | E20.2-S13 | E20.2-CA07 | E20.2-T04 |
| `email`, `.eprog` | E20.3 | Étapes | C51 | E20.3-S01 | E20.3-CA01 | E20.3-T01 |
| `.cur`, `.done` | E20.3 | Étapes | C51 | E20.3-S02 | E20.3-CA01 | E20.3-T01 |
| `#new-mail` | E20.3 | Étape 1 | C18 | E20.3-S03 | E20.3-CA02 | E20.3-T02 |
| `#nm-err` | E20.3 | Étape 1 | C19 | E20.3-S04 | E20.3-CA02 | E20.3-T02 |
| `.xs` | E20.3 | Étape 1 | C18 | E20.3-S05 | E20.3-CA02 | E20.3-T01 |
| `#nm-go`, `.btn--text` | E20.3 | Étape 1 | C10 | E20.3-S06 | E20.3-CA03 | E20.3-T02 |
| non montré | E20.3 | Étape 2 | C49 | E20.3-S07 | E20.3-CA04 | E20.3-T03 |
| `email-codes`, `.estep > .sm` | E20.3 | Étape 3 | C18 | E20.3-S08 | E20.3-CA05 | E20.3-T03 |
| `.ok-line` | E20.3 | Étape 3 | C49 | E20.3-S09 | E20.3-CA05 | E20.3-T03 |
| `#c-new` | E20.3 | Étape 3 | C49 | E20.3-S10 | E20.3-CA05 | E20.3-T03 |
| `#cn-err` | E20.3 | Étape 3 | C19 | E20.3-S11 | E20.3-CA06 | E20.3-T03 |
| `#cn-go` | E20.3 | Étape 3 | C10 | E20.3-S12 | E20.3-CA06 | E20.3-T03 |
| `.estep > .sm.c2` | E20.3 | Étape 3 | C18 | E20.3-S13 | E20.3-CA07 | E20.3-T03 |
| `#e-cancel` | E20.3 | Étape 3 | C11 | E20.3-S14 | E20.3-CA07 | E20.3-T03 |
| `email-fait`, `.notice--success` | E20.3 | Fin | C17 | E20.3-S15 | E20.3-CA08 | E20.3-T03 |
| `preferences`, `.cp-head` | E20.4 | En-tête | C02 | E20.4-S01 | E20.4-CA01 | E20.4-T01 |
| `#h-pref` | E20.4 | État | C03 | E20.4-S02 | E20.4-CA01 | E20.4-T01 |
| `.ro` | E20.4 | État | C05 | E20.4-S03 | E20.4-CA02 | E20.4-T01 |
| `#pref-btn` | E20.4 | État | C10 | E20.4-S04 | E20.4-CA03 | E20.4-T01 |
| `#pref-help` | E20.4 | État | C18 | E20.4-S05 | E20.4-CA03 | E20.4-T01 |
| `#pref-done` | E20.4 | État | C17 | E20.4-S06 | E20.4-CA03 | E20.4-T01 |
| `#h-keep` | E20.4 | Inchangé | C03 | E20.4-S07 | E20.4-CA04 | E20.4-T01 |
| `.keeps` | E20.4 | Inchangé | C65 | E20.4-S08 | E20.4-CA04 | E20.4-T01 |
| `sessions`, `.cp-head` | E20.5 | En-tête | C02 | E20.5-S01 | E20.5-CA01 | E20.5-T01 |
| `#h-ses` | E20.5 | Liste | C03 | E20.5-S02 | E20.5-CA01 | E20.5-T01 |
| `.slist li > .i` | E20.5 | Ligne | C06 | E20.5-S03 | E20.5-CA02 | E20.5-T01 |
| `.slist .t`, `.s` | E20.5 | Ligne | C06 | E20.5-S04 | E20.5-CA02 | E20.5-T01 |
| `.badge--info` | E20.5 | Ligne | C13 | E20.5-S05 | E20.5-CA03 | E20.5-T01 |
| `[data-close-s]` | E20.5 | Ligne | C10 | E20.5-S06 | E20.5-CA04 | E20.5-T01 |
| `.sec > .xs` | E20.5 | Bas | C18 | E20.5-S07 | E20.5-CA05 | E20.5-T01 |
| `details.danger` | E20.5 | Danger | C26 | E20.5-S08 | E20.5-CA06 | E20.5-T02 |
| `details.danger p` | E20.5 | Danger | C26 | E20.5-S09 | E20.5-CA06 | E20.5-T02 |
| `.btn--danger` | E20.5 | Danger | C10 | E20.5-S10 | E20.5-CA06 | E20.5-T02 |
| `donnees`, `.cp-head` | E20.6 | En-tête | C02 | E20.6-S01 | E20.6-CA01 | E20.6-T01 |
| `#h-req` | E20.6 | Demandes | C03 | E20.6-S02 | E20.6-CA02 | E20.6-T01 |
| `.slist` | E20.6 | Demandes | C06 | E20.6-S03 | E20.6-CA02 | E20.6-T01 |
| `#h-exp` | E20.6 | Export | C03 | E20.6-S04 | E20.6-CA03 | E20.6-T01 |
| `.sec > .c2` | E20.6 | Export | C18 | E20.6-S05 | E20.6-CA03 | E20.6-T01 |
| non montré | E20.6 | Export | C10 | E20.6-S06 | E20.6-CA04 | E20.6-T01 |
| non montré | E20.6 | Export | C03 | E20.6-S07 | E20.6-CA05 | E20.6-T02 |
| `donnees`, `#del` | E20.6 | Danger | C26 | E20.6-S08 | E20.6-CA06 | E20.7-T01 |
| `supprimer`, `#del > div > p` | E20.7 | Avertissement | C26 | E20.7-S01 | E20.7-CA01 | E20.7-T01 |
| `.two > div:nth-child(1)` | E20.7 | Listes | C65 | E20.7-S02 | E20.7-CA02 | E20.7-T01 |
| `.two > div:nth-child(2)` | E20.7 | Listes | C65 | E20.7-S03 | E20.7-CA02 | E20.7-T01 |
| `#del-w` | E20.7 | Mot | C18 | E20.7-S04 | E20.7-CA03 | E20.7-T01 |
| `#del-err` | E20.7 | Mot | C19 | E20.7-S05 | E20.7-CA03 | E20.7-T01 |
| `#del-go` | E20.7 | Action | C10 | E20.7-S06 | E20.7-CA04 | E20.7-T01 |
| `#del .xs` | E20.7 | Action | C18 | E20.7-S07 | E20.7-CA04 | E20.7-T01 |
| non montré | E20.7 | Code | C49 | E20.7-S08 | E20.7-CA05 | E20.7-T01 |
