# E16 — Listes des files et des inscrits (agent, administrateur)
> Maquette : `proto-bo-listes.html` (états `file`, `file-retard`, `file-vide`, `inscrits`, `inscrits-recherche` ; dialogue `#keys`) · page de comparaison `ecran-16-bo-listes.html` · validée le 2026-11-24 (`07` l. 182 à 193) · Constats : U38, U39, U56.
> E16.1 dessine la seule file « Profils marque à valider » et vaut gabarit des neuf files. Coquille : E04. Textes : `E16b-bo-listes-textes.md`.

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E16.1 | Liste d'une file (9 routes `/files/*`) | `/files/profils-marque` et 8 autres (§2) | aucune (D36) | `QueueTemplate.tsx`, `QueueFilterBar.tsx`, `QueueCells.tsx`, 8 `*QueueScreen(s).tsx`, `DenseTableRegion.tsx` | `file`, `file-retard`, `file-vide` | L | C58, C30, C32, C27, E04 (rail), E05 |
| E16.2 | Inscrits | `/inscrits` | aucune | `AccountsScreen.tsx`, `ReplayPanel.tsx` | `inscrits`, `inscrits-recherche` | L | C58, C30, C32 ; F3 (Q06) ; E21 (échecs) ; E06 (fiche) |

**À préserver** (`apps/backoffice/src/components/`)

| Fonction | Fichier:ligne | Règle |
|---|---|---|
| Adresse = filtres, période, page, curseur ; codes seuls | `QueueTemplate.tsx:189-206`, `queue-view-model.ts:60-160` | `15` RG121 |
| Page plafonnée à 50, curseur opaque, jamais de défilement infini | `QueueTemplate.tsx:619-655` | RG34, CA18 |
| Filtres et curseur dans le corps d'un POST de lecture | `QueueTemplate.tsx:226-260` | EC-L2C-16-1 |
| Période inversée : dite, jamais envoyée | `QueueTemplate.tsx:205, 505` | `05` RG97 |
| Compteurs affichés en dernier, jamais un « 0 » inventé | `QueueTemplate.tsx:468-482` | `17b` §2.8 |
| `j`, `k`, `?` hors champ, focus de ligne ; `a[data-entry-link]` | `QueueTemplate.tsx:339-378` | RG114 |
| Files 4, 5, 6 : hors délai dans une liste à part | `QueueTemplate.tsx:586-617` | `08` RG66, CA42 (Q03) |
| Entrées d'un compte de l'agent absentes (serveur) | API | RG36 |
| Profil en lien de filtre (visuels) | `PortfolioQueueScreen.tsx` colonne `alias` | L2G-16 |
| Inscrits : terme de recherche en mémoire et dans le corps, jamais dans l'adresse | `AccountsScreen.tsx:143, 205-216` | J8S-7 |
| Recherche exacte libre, partielle journalisée et limitée (20 par 15 min) | `accounts-routes.ts:244` ; `fr.ts:512-519` | `05` RG98 |
| Aucun export | `fr.ts:491` | RG106 |
| Rejeu : jamais sur un cas normal, lot plafonné | `ReplayPanel.tsx` | RG100 à RG103 ; déplacé vers E21 |

**API** : `GET /v1/bo/queues/counters` (5 files) ; `POST …/entries/search` de chaque file : `profiles-advertiser`, `profiles-creator`, `portfolio-moderation`, `verification-creators`, `verification-brands`, `verification-disputes`, `identifier-changes` sous `/v1/bo/queues/`, plus `/v1/bo/campaigns/entries/search` et `/v1/bo/team-selection/entries/search` ; `POST /v1/bo/accounts/search`.

## 2. Structure

Ordre E16.1 : fil d'Ariane, h1, phrase, résumé en une ligne ; ligne de filtres ; nombre et tri ; tableau ; pied.
Ordre E16.2 : fil d'Ariane, h1, phrase ; échecs ; ligne de filtres ; règle de recherche ; nombre et tri ; tableau ; pied.

| Mesure | 1440 | 1280 | 768 | 375 |
|---|---|---|---|---|
| Contenu | x 288, 1104 px | 953,6 px | 472,4 px (rail gardé par la maquette, E04-Q05) | remplacé par E19.1 |
| Filtres E16.1 | 1 ligne, 36 px | 2 lignes, 80 px | 3 lignes, 124 px | hors cible |
| Filtres E16.2 | 2 lignes, 80 px | 2 lignes | 3 lignes | hors cible |
| Table E16.1 (région / table) | 1104 / 1104 | 953,6 / 1059,9 : défile | 472,4 / 947,3 : défile | hors cible |
| Table E16.2 | 1104 / 1104 | 953,6 / 1013,7 : défile | 472,4 / 1013,7 : défile | hors cible |
| Ligne E16.1 | 36 px | 36 px | 36 px (51 px avec alerte) | |
| Ligne E16.2 | 51,3 px (nom, puis adresse) | 51,3 px | 51,3 px | ligne unique à partir de 1536 px (X3) |

Colonnes E16.1 à 1440 : Marque 304,1 · Échéance 159,5 · Origine 188,3 · Pays 78,7 · Complétude 113 (droite) · Responsable 116,6 · Verrou 143,8. Colonnes E16.2 : Inscrit 181,8 · Rôle 170,9 · Pays, langue 167,2 · Consentement 136,9 · Brevo 102,7 · Apollo 116 · Responsable 121,9 · Inscription 106,6 (droite). Cellules : `px` 12 px, `py` 4 px, sans retour à la ligne. Sous 1280 px : première colonne collante à gauche, `surface-page` ; l'alerte passe sous le nom.

**Colonnes des neuf files** (gabarit : première colonne = lien ; état et « Ouvrir » supprimés ; « → » = regroupée). La première colonne et les regroupements hors file 1 sont à valider (Q02).

| File (route) | Première colonne | Colonnes actuelles conservées | Filtres propres actuels |
|---|---|---|---|
| Profils marque (`/files/profils-marque`) | Marque + alerte | Échéance ; Origine → champ modifié ; Pays ; Complétude ; Responsable ; Verrou. Raison sociale → pied | Origine, Pays |
| Profils créateur (`/files/profils-createur`) | Alias + alerte | Échéance ; Origine → champs modifiés ; Pays ; Réseaux déclarés ; Complétude ; Badges ; Responsable ; Verrou | Origine, Pays, Réseau, Badge |
| Visuels (`/files/visuels`) | Alias (lien d'entrée ; le filtre par profil change de place) + alerte | Échéance ; Type ; Déposé le ; Visuels du profil ; Responsable ; Verrou | Profil, Type |
| Vérifications créateurs (`/files/verifications-createurs`) | Créateur + alerte ou réexamen | SLA ; Niveau ; Réseau ; Pays ; Déposée le ; Ouverte par ; Ancienneté ; Responsable ; Verrou | Tri, À réexaminer, Niveau, Réseau |
| Vérifications marques (`/files/verifications-marques`) | Marque + alerte ou réexamen | SLA ; Pays ; Déposée le ; Ouverte par ; Ancienneté ; Responsable ; Verrou | Tri, À réexaminer |
| Contestations (`/files/contestations`) | Créateur | SLA ; Décision contestée ; Niveau ; Réseau ; Pays ; Motif du membre ; Déposée le ; Ancienneté ; Responsable ; Verrou | Tri, Niveau, Réseau, Décision ; sans « Alerte » |
| Identifiants modifiés (`/files/identifiants-modifies`) | Créateur | SLA ; Réseau ; Pays ; Modifications ; Ouverte le ; Dernière modification ; Ancienneté ; Responsable ; Verrou | Tri, Réseau ; sans « Alerte » |
| Campagnes (`/files/campagnes`) | Titre (aujourd'hui Marque puis Titre) + alerte | Échéance ; Marque ; Catégorie ; Examen ; Responsable ; Verrou | aucun |
| Sélections (`/files/selections-equipe`) | Marque | Échéance ; Campagne d'origine ; Langue ; Responsable ; Verrou | aucun ; sans « Alerte » ni « Responsable » |

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E16.1-S01 | En-tête | C57 | Fil d'Ariane Files, file | toujours | file, `.crumbs` | E16.1-CA01 | E16.1-T01 |
| E16.1-S02 | En-tête | C02 | h1 28 px 800 et phrase `text-secondary` | toujours | file, `.lhead` | E16.1-CA01 | E16.1-T01 |
| E16.1-S03 | En-tête | C32 | Résumé en une ligne : en attente, plus ancienne, hors délai (drapeau), sans preneur, délais ; nombres 700, `gap` 4 16 | compteurs servis et file non vide | file, `.lsum` | E16.1-CA02 | E16.1-T02 |
| E16.1-S04 | Filtres | C30 | Groupe « Filtres de la file », pastilles 36 px, `gap` 8 px, retour à la ligne | file non vide ou filtrée | file, `.fbar` | E16.1-CA03 | E16.1-T03 |
| E16.1-S05 | Filtres | C30 | Bascule « Hors délai seuls » (drapeau, `aria-pressed`) ; active : bord `text-primary`, fond `surface-active` (X7), 600 | toujours | file-retard, `#late-only` | E16.1-CA03 | E16.1-T03 |
| E16.1-S06 | Filtres | C30 | Séparateur 1 × 24 px, `border-default` | toujours | file, `.fbar__sep` | E16.1-CA03 | E16.1-T07 |
| E16.1-S07 | Filtres | C30 | Pastilles Verrou, Responsable, Alerte, Origine, Pays : « Nom : valeur » + chevron | selon la file | file, `.pill` | E16.1-CA03 | E16.1-T03 |
| E16.1-S08 | Filtres | C30, C47 | Pastille « Période de dépôt », calendrier + chevron | toujours | file, dernière `.pill` | E16.1-CA04 | E16.1-T03 |
| E16.1-S09 | Filtres | C30 | Pastille active avec croix de retrait (règle CSS `.pill.is-active`, `.x`) ; contenu ouvert non dessiné | filtre actif | aucun état (CSS seul) | E16.1-CA04 | E16.1-T03 |
| E16.1-S10 | Liste | C32 | « n entrées · triées par échéance, la plus proche d'abord » ; filtré : « 1 entrée sur 6, filtre … » | entrées présentes | file, `#f-count` ; file-retard | E16.1-CA05 | E16.1-T01 |
| E16.1-S11 | Liste | C58 | En-tête de tableau `surface-hover`, filet `border-strong`, Manrope 700, 30,2 px, collant | toujours | file, `#tq thead` | E16.1-CA06 | E16.1-T07 |
| E16.1-S12 | Liste | C58 | Première colonne : nom Manrope 700 en lien étiré sur la ligne | par entrée | file, `.id` | E16.1-CA07 | E16.1-T04 |
| E16.1-S13 | Liste | C13 | Alerte en clair à côté du nom : triangle 14 px, 12 px 600 `feedback-warning-text`, au-dessus du lien étiré | entrée avec alerte | file, `.al` | E16.1-CA08 | E16.1-T01 |
| E16.1-S14 | Liste | C13, C58 | Échéance : « dans 2 h 56 » ou drapeau + « hors délai · 49 min » | par entrée | file, `.late` | E16.1-CA08 | E16.1-T02 |
| E16.1-S15 | Liste | C58 | Origine et champ modifié (`text-tertiary`) | par entrée | file, `td:nth-child(3)` | E16.1-CA09 | E16.1-T01 |
| E16.1-S16 | Liste | C58 | Pays ; Complétude à droite, tabulaire ; Responsable ou « aucun » | par entrée | file, `td` | E16.1-CA09 | E16.1-T01 |
| E16.1-S17 | Liste | C58, C13 | Verrou : « libre » tertiaire, ou cadenas + « nom · heure » | par entrée | file, `.lock` | E16.1-CA08 | E16.1-T02 |
| E16.1-S18 | Liste | C58 | Survol et focus de ligne : `surface-raised` + filet vert 2 px ; anneau autour de la ligne | interaction | file, `.tbl tr` | E16.1-CA07 | E16.1-T04 |
| E16.1-S19 | Pied | C32 | « 1 à 6 sur 6 · notes communes » à gauche ; touches `j`, `k`, Entrée à droite | entrées présentes | file, `.lfoot` | E16.1-CA05 | E16.1-T01 |
| E16.1-S20 | Pied | C32, C10 | Page précédente, suivante, première (existantes ; bouton dessiné dans E16.2 seul) | plusieurs pages | non montré | E16.1-CA10 | E16.1-T05 |
| E16.1-S21 | Vide | C08 | Coche, h2 « Aucune entrée à traiter. », phrase avec l'ancienneté, lien ; 640 px ; ni résumé ni filtres | aucune entrée, aucun filtre | file-vide, `.empty-state` | E16.1-CA11 | E16.1-T05 |
| E16.1-S22 | Dialogue | C27 | Raccourcis : 3 lignes | touche `?` ou rail | `#keys` | E16.1-CA12 | E16.1-T04 |
| E16.1-S23 | États | C09, C17 | Chargement, erreur, refus, aucun résultat, page vide (existants) | §5 | non montré | E16.1-CA10 | E16.1-T05 |
| E16.2-S01 | En-tête | C57, C02 | Fil d'Ariane Comptes, Inscrits ; h1 ; phrase qui annonce la lecture enregistrée et l'absence d'export | toujours | inscrits, `.lhead` | E16.2-CA01 | E16.2-T01 |
| E16.2-S02 | Échecs | C17 sans boîte | Icône erreur, « n échecs de synchronisation à traiter. », lien « Ouvrir la file » | nombre supérieur à 0 | inscrits, `p.row` | E16.2-CA02 | E16.2-T02 |
| E16.2-S03 | Filtres | C30, C18 | Champ recherche en pastille, loupe, 290 × 36, saisie de 15 rem, anneau au focus | toujours | inscrits, `.search` | E16.2-CA03 | E16.2-T03 |
| E16.2-S04 | Filtres | C30 | Pastilles Rôle, Pays, Langue, Statut déclaré, Consentement, Période d'inscription | toujours | inscrits, `.pill` | E16.2-CA04 | E16.2-T03 |
| E16.2-S05 | Filtres | C18 | Règle de recherche, 12 px `text-secondary`, sous les filtres | toujours | inscrits, `p.xs` | E16.2-CA03 | E16.2-T03 |
| E16.2-S06 | Liste | C32 | « n inscrits · les plus récents d'abord » ; recherche : « 1 inscrit pour « adresse » · recherche exacte, non enregistrée » | liste lue | inscrits, `#i-count` | E16.2-CA05 | E16.2-T03 |
| E16.2-S07 | Liste | C58 | Inscrit : nom de marque ou « Profil CODE » en lien étiré ; adresse masquée `c***@domaine` 12 px dessous | données F3 servies (Q06) | inscrits, `.id`, `.mail` | E16.2-CA06 | E16.2-T04 |
| E16.2-S08 | Liste | C58 | Rôle · statut déclaré ; Pays · langue ; secondaire en `text-tertiary` | par ligne | inscrits, `td .mute` | E16.2-CA07 | E16.2-T01 |
| E16.2-S09 | Liste | C58 | Consentement : « accordé », « retiré » ou « — » | par ligne | inscrits, colonne 4 | E16.2-CA07 | E16.2-T01 |
| E16.2-S10 | Liste | C13 | Brevo et Apollo : un mot et une icône (sablier, alerte rouge 600) ; sans icône si synchronisé ; tertiaire sinon | par ligne | inscrits, `.sync` | E16.2-CA08 | E16.2-T01 |
| E16.2-S11 | Liste | C58 | Responsable ou « aucun » ; date d'inscription à droite, tabulaire | par ligne | inscrits, colonnes 7 et 8 | E16.2-CA07 | E16.2-T01 |
| E16.2-S12 | Pied | C32, C10 | « 1 à 20 sur 28 » ; touches ; « Page suivante » secondaire 36 px | page suivante servie | inscrits, `.lfoot` | E16.2-CA05 | E16.2-T01 |
| E16.2-S13 | États | C08, C09, C17 | Chargement, aucun inscrit, erreur, débit dépassé, recherche invalide, partielle journalisée (existants) | §5 | non montré | E16.2-CA09 | E16.2-T03 |

## 4. Textes

Dans `E16b-bo-listes-textes.md`.

## 5. Interactions, états, responsive, clavier

- **Ligne** → ouvre l'entrée (prise en charge, C1) ou la fiche (journalisée). Lien étiré : clic milieu, nouvel onglet et menu contextuel fonctionnent.
- **« Hors délai seuls »** → `overdue=true` dans l'adresse, page 1 ; liste filtrée ; résumé inchangé (file entière).
- **Pastilles** : ouverture non dessinée. Proposé : liste native (C30 `inline-select`) pour les listes fermées ; pour la période, dialogue C28 à deux dates avec « Appliquer ». Filtre actif : pastille active + croix ; « Réinitialiser » dès un filtre actif (`17b` §4.2, non dessiné).
- **Recherche** : Entrée lance ; le terme reste dans le champ et en mémoire ; effacer et lancer rend la liste complète. Le bouton « Chercher » actuel n'est pas dessiné (Q07).
- **`j`, `k`, Entrée** : focus sur le lien de ligne, sans quitter les bornes ; inactifs dans un champ. `?` : dialogue. E16.2 écoute aujourd'hui sur le conteneur de la table (`AccountsScreen.tsx:224-242`) : passer à la fenêtre, comme E16.1.
- **Pagination** : suivante, précédente, première (E16.1) ; première et suivante (E16.2). `router.push`, focus au h1 ; annonce du nombre.

| État | Maquette | Comportement |
|---|---|---|
| Chargement | non montré | 5 lignes de squelette à hauteur fixe (`QueueTemplate.tsx:123-141`), sans animation (RG118 ; C09 de E02 a un balayage : ne pas l'utiliser ici) |
| File vide | `file-vide` | S21 |
| Aucun résultat | non montré | `queueList.noMatch`, plus « Réinitialiser » |
| File bloquée (RG32) | non montré | non servi (E04-Q13) |
| Page vide | non montré | `pageEmpty` + « Première page » |
| Erreur, refus | non montré | `ErrorNotice` + « Réessayer », phrase du rôle requis |
| Compteurs en échec | non montré | `queueSummary.error`, la liste reste |
| Débit dépassé, adresse invalide | non montré | `failure.rateLimited`, `accounts.searchInvalid` sous le champ |
| Hors ligne | non montré | erreur |

- **Responsive** : §2. De 768 à 1023 px : bande horizontale (E04-Q05) ; pleine largeur. Région de tableau nommée et focalisable (`DenseTableRegion.tsx`) : absente de la maquette (X8), conservée. Première colonne collante sous 1280 px ; à 1280 exactement la table déborde déjà (1059,9 pour 953,6) sans colonne collante (Q09).
- **Animations** : fond de ligne 120 ms ; rien d'autre. Après une décision, la ligne suivante reçoit un fond qui s'estompe (`ecran-5`, 320 ms) : non montré ici.

## 6. Critères d'acceptation

- **E16.1-CA01** Les neuf files ont le même gabarit, h1 = `queue.*`, fil d'Ariane à deux éléments.
- **E16.1-CA02** Résumé d'une ligne à 1440 ; durées calculées depuis `asOf` ; délais lus dans `policy`.
- **E16.1-CA03** Filtres communs dans l'ordre de RG33, puis ceux de la file ; chaque choix est dans l'adresse, en codes.
- **E16.1-CA04** Tout filtre actif est visible, retirable au clavier, et annulable d'un coup ; période inversée dite.
- **E16.1-CA05** Le nombre affiché est celui de la page ; le total vient des compteurs et n'est écrit que s'il est servi.
- **E16.1-CA06** Aucun cadre autour du tableau ; en-tête 30,2 px ; lignes 36 px à 1440 sans alerte débordante.
- **E16.1-CA07** Toute la ligne ouvre l'entrée ; `data-entry-link` porté par le lien de première colonne ; anneau visible sur la ligne.
- **E16.1-CA08** Hors délai, alerte et verrou portent icône et mot.
- **E16.1-CA09** Aucune coordonnée, aucun identifiant de réseau, aucun chiffre d'audience dans une liste (D45, RG47).
- **E16.1-CA10** Pages de 50 au plus, retour du navigateur, aucun défilement infini, états de §5 présents.
- **E16.1-CA11** File vide : phrase, ancienneté servie (`lastDecidedAt`), sans boîte de succès.
- **E16.1-CA12** `j`, `k`, Entrée, `?` fonctionnent dans les neuf files.
- **E16.1-CA13** Chaque colonne actuelle d'une file est conservée, regroupée, ou retirée par une décision écrite (Q02).
- **E16.2-CA01** L'absence d'export et la lecture enregistrée sont écrites.
- **E16.2-CA02** Le nombre d'échecs est celui de `accounts/counters` ; le lien ouvre la file d'E21 ; plus de case ni de rejeu ici.
- **E16.2-CA03** Le terme cherché n'entre ni dans l'adresse ni dans un journal ; la partielle journalisée est annoncée.
- **E16.2-CA04** Filtres de RG97, y compris l'état de synchronisation (Q08).
- **E16.2-CA05** Compte, tri et page écrits ; total seulement s'il est servi.
- **E16.2-CA06** Le nom et l'adresse masquée viennent de l'API ; l'écran ne reçoit jamais l'adresse entière ; sans accord RGPD, la colonne reste sans adresse (Q06).
- **E16.2-CA07** Aucune cellule blanche : « aucun », « — » ou « non renseigné ».
- **E16.2-CA08** L'état écrit est celui de `syncState` ; la cause reste lisible sur la fiche.
- **E16.2-CA09** Tous les états de §5 présents.
- **E16.2-CA10** Axe WCAG 2.2 AA à 1440, 1280, 1024, 768.

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E16.1-T01 | e2e | `apps/web/e2e/backoffice-queue.spec.ts` (L2C-16, `entryRows` l. 45 : l'alerte n'est plus une ligne à part) | contenu, retard en tête, aucune coordonnée |
| E16.1-T02 | unitaire | `apps/backoffice/tests/queue-view-model.test.ts` (l. 205 à 328 ; textes « HORS DÉLAI depuis », « depuis » changés) | résumé, échéance, verrou |
| E16.1-T03 | e2e | `backoffice-queue.spec.ts` (filtres et adresse), `queue-view-model.test.ts` (l. 84 à 189) | filtres, puces, adresse, période |
| E16.1-T04 | e2e | `backoffice-queue.spec.ts` (l. 261, `a[data-entry-link]`) | clavier, focus de ligne, axe |
| E16.1-T05 | e2e | `backoffice-queue.spec.ts` (refus, erreur, vide) | états |
| E16.1-T06 | e2e | `creator-queue`, `portfolio-queue`, `campaign-review`, `verification-backoffice`, `verification-queues-contest`, `backoffice-team-selection` (`.spec.ts`) | gabarit des huit autres files |
| E16.1-T07 | visuel | nouveau, 1440, 1280, 1024, 768 | colonnes, pastilles, colonne collante |
| E16.2-T01 | e2e | `apps/web/e2e/backoffice.spec.ts` (CA56 : titres de colonnes changés) ; `backoffice-ops-screens.spec.ts` (DS-12a) | colonnes, axe |
| E16.2-T02 | e2e | `backoffice.spec.ts` (CA57 à CA61, à déplacer vers E21) | plus de rejeu ici |
| E16.2-T03 | e2e | `backoffice.spec.ts` (J8T-7) | recherche, période, terme hors adresse |
| E16.2-T04 | unitaire (base) | nouveau, `db-tests` de `apps/api` | nom et adresse masquée, droits, journal |

À conserver : `data-entry-link`, noms accessibles des tables (`tableLabel`), région `accounts.title`, `TK6.1`, `TK6.2` (marque de survol sur la première cellule).

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| `QueueTemplate` | titre, carte de compteurs, filtres en deux rangs, table encadrée, colonne « Entrée » (`:428-440`), panneau de raccourcis | §2 | faire évoluer |
| `QueueFilterBar` | cases, listes de 28 px, dates, puces | pastilles C30 | remplacer |
| Alerte de ligne | ligne `colSpan` sous l'entrée (`:441-451`) | dans la première cellule | faire évoluer |
| `StateCell` | colonne État | supprimée (icône dans Échéance et Verrou) | supprimer |
| `DueCell` | échéance datée + seuil d'ancienneté | durée ; date exacte : non dessinée (Q04) | faire évoluer |
| `AccountsScreen` | 12 colonnes, carte de filtres, cases, rejeu | 8 colonnes, pastilles | faire évoluer |
| `ReplayPanel` | dans Inscrits | E21 | déplacer |

**Données requises**

| Donnée | Servie ? | Écart |
|---|---|---|
| Total d'une file | `counters.pending`, non filtré | « 1 sur 6 » possible pour le total ; total filtré non servi si plusieurs pages |
| Heure depuis laquelle la file est vide | `lastDecidedAt` (dernière décision, pas « vide depuis ») | Q05 |
| Nom d'affichage « Prénom N. » | prénom seul (`accountOwnerSchema`) | E04-Q07 |
| Total des inscrits, rang de page | non : `nextCursor` seul (`backoffice-accounts.ts:299-306`) | Q10 |
| Nom ou alias, adresse masquée | non, exclus par contrat : « NO address and NO name » (`backoffice-accounts.ts:6-7, 176`) | Q06 |
| Source, dernière activité, statut du compte | servis (`accountRowSchema`) | non affichés par la maquette : Q08 |
| Nombre d'échecs | `accounts/counters.unhandledFailures` | additionner Brevo et Apollo contredit RG100 (jamais un total) : Q08 |

Hors lot : action de masse des visuels ; files du Lot 4 et 5 ; lien « voir les traitées » (`17b` §2.3).

## 9. Contradictions, manques et décisions

| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E16-Q01 | Contenu ouvert des pastilles, filtre actif, « Réinitialiser », pages : non dessinés | filtres et pagination | formes de §5, communes à E02, E13, E21 | expert-ux | oui |
| E16-Q02 | Huit files sans maquette : première colonne, regroupements, 9 à 12 colonnes | neuf tableaux | table de §2 à valider | product-owner | oui |
| E16-Q03 | `08` RG66, CA42 : hors délai des vérifications dans une liste à part, « jamais noyés » ; gabarit : un seul tableau | files 4, 5, 6 | garder la liste à part en deux sections C03 sans carte | product-owner | oui |
| E16-Q04 | Non dessinés : seuil d'alerte d'ancienneté, échéance datée, `aria-sort`, « ▲ » | `DueCell` | date en infobulle interdite (`17b` §2.2) : durée seule ; seuil en mot dans l'alerte ; `aria-sort` gardé | product-owner | non |
| E16-Q05 | « vide depuis 10 h 12 » : la donnée est la dernière décision | S21 | « la dernière a été traitée il y a … » (texte existant) | product-owner | non |
| E16-Q06 | F3 : nom et adresse masquée dans la liste ; `05` RG97 et `03` C(17) l'excluent ; décision 0.7 ouverte ; domaine visible entier | première colonne | accord écrit, contrat modifié, lecture de liste journalisée ou non ; sinon nom public ou alias seul | expert-conformite-rgpd | oui |
| E16-Q07 | Bouton « Chercher » et « Réinitialiser » absents ; lancement par Entrée seul | clavier, tactile | bouton de soumission caché visuellement | expert-ux | non |
| E16-Q08 | Colonnes Source, dernière activité, statut du compte, filtres état et destination de synchronisation absents (RG97) ; « 3 échecs » additionne deux destinations | perte fonctionnelle | filtres gardés en pastilles ; colonnes retirées par amendement de RG97 ; « Brevo n · Apollo n » | product-owner | oui |
| E16-Q09 | À 1280 px la table défile sans première colonne collante (règle sous 1280) | lecture | colonne collante dès que la région défile | expert-ux | non |
| E16-Q10 | « 1 à 20 sur 28 » : aucun total servi ; RG34 anti-aspiration | pied | « Page n » ; total si l'API le sert | architecte | non |
| E16-Q11 | Vocabulaire : « exclu par pays » et « en file » mêlent cause et état (`syncState` = en attente, cas normal) | S10 | état écrit, cause seulement pour un cas normal | product-owner | non |
| E16-Q12 | `07` l. 189 : « vues en onglets gris avec leur nombre » ; `07` l. 242 et la maquette les retirent (`.views` inutilisé) | aucune vue | maquette | fondateur | non |
| E16-Q13 | « néerlandais » : langue hors `UI_LOCALES` (FR, EN) | donnée fictive | ignorer | expert-ux | non |
| E16-Q14 | Pastille active et croix en `surface-active` (X7) ; seuil 1536 px (X3) ; `.tbl-wrap` sans focus (X8) ; `.bo-band` (X11) | jetons et a11y | règles X | expert-ux | non |
| E16-Q15 | Terme recherché réaffiché dans « 1 inscrit pour « adresse » » : adresse complète à l'écran | donnée personnelle visible, saisie par l'agent | écrire « pour cette adresse » | expert-conformite-rgpd | non |
| E16-Q16 | Lien « Profil » des visuels (`onlyProfile`) : la première colonne ouvre l'entrée | filtre par profil perdu | second lien « Ses visuels » au-dessus du lien étiré | product-owner | non |
