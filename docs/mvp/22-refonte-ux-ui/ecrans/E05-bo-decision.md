# E05 — Décision d'une entrée de file (agent, administrateur)
> Maquette : `proto-bo-decision.html` (états `decision`, `modification`, `refus`, `publie` ; dialogue `#keys` ; volets `#p-pub` et `#p-rel` atteints par le script) · page de comparaison `ecran-5-bo-decision.html` · validée le 2026-11-24 (`07` l. 45 à 54) · Constats : U35, U36, U37, U06, U42, U44, U57.
> Seul E05.1 est dessiné. E05.2 à E05.9 : `E05c-bo-decisions-derivees.md`. Coquille : E04. Page publique : E05b. Textes : `E05d-bo-decision-textes.md`.

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E05.1 | Décision d'un profil marque | `/files/profils-marque/[id]` | aucune (D36) | `BrandReviewEntryScreen.tsx`, `ReviewBlocks.tsx`, `ReviewDecision.tsx`, `ReviewBanners.tsx`, `BoReasonPicker.tsx`, `use-review-entry.ts` | `decision`, `modification`, `refus`, `publie` | XL | C57, C59, C60, C62, C07, C27 ; E05b ; E06 (fiche) ; E16 (liste) |

**À préserver** (`apps/backoffice/src/components/`)

| Fonction | Fichier:ligne | Règle |
|---|---|---|
| Ouvrir = prendre en charge et journaliser ; trois modes (décide, lit, clos) | `use-review-entry.ts:84-130`, `queue-review-view.ts:33-40` | `15` RG27 C1, C2, RG35 ; D81 |
| Échéance figée à l'entrée, retard dit par la base | `queue-view-model.ts:315-327` | D81 (1), C5, C8 |
| Version examinée : jeton renvoyé avec la décision, refus si périmé, relecture, saisie conservée | `use-review-entry.ts:151-185, 206-260` | D81 (2), L2BS-1 |
| Rappel à 3 minutes, Prolonger, Reprendre | `ReviewBanners.tsx:53-90`, `use-review-entry.ts:273-310` | C3 |
| Levée du verrou par un administrateur, motif fermé ; titulaire informé | `ReviewBanners.tsx:157-235`, `queue-review-view.ts` (`forcedReleaseNotice`) | C4 |
| Motifs typés servis par l'API avec message et suite ; texte libre pour « Autre » seul (20 à 500) | `BoReasonPicker.tsx:33-170` | `06` RG66, C6 |
| Motif et commentaire : jamais perdus par Échap ni par une erreur | `use-review-entry.ts:344-400` | RG116 |
| Aucune touche ne décide seule | `queue-review-view.ts:447-475` | RG114, RG115 |
| Conflit d'intérêt, refus, entrée inconnue : une phrase | `fr.ts:1868-1876` | RG36, CA19 |
| Champ modifié après la première lecture | `ReviewBlocks.tsx:37-45`, `BrandReviewEntryScreen.tsx:270-277` | L2BS-1 |
| Lecture du logo journalisée, par identifiant | `use-review-logo.ts`, `ReviewLogo.tsx` | `0213` |
| Enchaînement : confirmation au-dessus de l'entrée suivante, annulable | `ReviewBanners.tsx:92-155`, `use-review-entry.ts:187-205, 331-350` | `17b` §2.6 (Q02) |
| Entrée close : qui, quand, motif, message, commentaire | `ReviewBlocks.tsx:211-254` | RG65, RG68 |

**API** : `POST /v1/bo/queues/profiles-advertiser/entries/:id/open`, `…/publish`, `…/reject`, `…/release`, `…/extend`, `…/force-release`, `GET …/:id/logo?logo=` (`queues-routes.ts`, `queues-decision-routes.ts`, `queues-logo-routes.ts` ; contrats `backoffice-queues.ts:289-585`). Aucun contrat d'écriture ne change.

## 2. Structure

Ordre : fil d'Ariane ; ligne de titre (h1, actions à droite) ; ligne de faits ; lien « Aller à la décision » (moins de 1024 px) ; grille C59.
Dossier : À savoir ; À contrôler ; Ce qu'elle recherche ; Entreprise et conditions ; Compte ; Interlocuteur ; Historique.

| Mesure | 1440 | 1280 | 768 | 375 |
|---|---|---|---|---|
| Grille `.d-grid` (dès 1024 px) : `minmax(0,1fr)` + `--spacing-bo-panel-w` (22 rem), `gap` `--spacing-8` | 704 + 48 + 352 | 553,6 + 48 + 352 | une colonne, 472,4 px, `gap` 32 px | remplacé par E19.1 |
| Colonne de décision | `sticky`, haut = `--spacing-bo-row-h` + `--spacing-6` (68 px) | idem | après le dossier, non collante | idem |
| `.check` | 9,5 rem / reste / 12 rem (152 / 312 / 192), `gap` 4 24 | 152 / 161,6 / 192 | une colonne (dès moins de 1280 px) | idem |
| Ligne de faits | une ligne, 21,7 px | une ligne | deux lignes, 47,4 px | idem |

À 1280 px la colonne de valeur ne fait que 161,6 px : la règle `< 1280px` ne s'applique pas à 1280 (Q12). Sections du dossier (`.dsect`) : sans cadre, `py` 24 px, filet haut `border-default`, `gap` 12 px, première sans filet. Colonne : `radius-card` (16 px), 1 px `border-default`, `surface-card`, `p` 24 px, `gap` 16 px ; blocs intérieurs C05 `surface-raised`, sans bordure, `radius` 12 px, `p` 12 px. Trois niveaux de surface au plus : page, colonne, bloc.

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E05.1-S01 | En-tête | C57 | Fil d'Ariane Files, file, nom ; liens `text-secondary` 14 px, chevrons 16 px | toujours | decision, `.crumbs` | E05.1-CA01 | E05.1-T01 |
| E05.1-S02 | En-tête | C02 | h1 = nom de la marque, 28 px 800 ; symbole de lecture enregistrée lu (existant) | entrée lue | decision, `.t-page` | E05.1-CA01 | E05.1-T01 |
| E05.1-S03 | En-tête | C10 | « Rendre la main » + touche `l`, secondaire, 161,8 × 28 | mode décision, avant décision | decision, `#release` | E05.1-CA02 | E05.1-T02 |
| E05.1-S04 | En-tête | C10, C62 | « Fiche du compte » + marque violette 8 × 14 ; infobulle et texte caché « lecture enregistrée » ; vers `/inscrits/{account.id}` | toujours | decision, `a.btn--secondary` | E05.1-CA03 | E05.1-T01 |
| E05.1-S05 | En-tête | C13 | Ligne de faits : origine, dépôt, échéance, « Hors délai depuis … » (drapeau, une seule fois), prise en charge | hors délai si `overdue` | decision, `.meta` | E05.1-CA04 | E05.1-T03 |
| E05.1-S06 | En-tête | C11 | « Aller à la décision », 44 px de haut, vers `#decision-panel` | moins de 1024 px | decision 768, `.skip` | E05.1-CA05 | E05.1-T04 |
| E05.1-S07 | À savoir | C03, C13 | h2 ; coche et « Aucune alerte sur cette entrée. » ou les alertes en phrases (triangle) | toujours ; alertes non dessinées (§5) | decision, `#h-know` | E05.1-CA06 | E05.1-T03 |
| E05.1-S08 | À savoir | C03 | Icône info et phrase « Première soumission… » | `kind = submission` | decision, `.dsect:first-child p` | E05.1-CA06 | E05.1-T03 |
| E05.1-S09 | À savoir | C03 | Icône info et « Modification d'un profil publié : n champs modifiés, … » | `kind = revision` | modification, même zone | E05.1-CA06 | E05.1-T03 |
| E05.1-S10 | À contrôler | C03, C14 | h2 « À contrôler » + badge « public » (globe, pastille 28,6 px de haut) | toujours | decision, `#h-check` | E05.1-CA07 | E05.1-T01 |
| E05.1-S11 | À contrôler | C11 | « Voir la page publique (version soumise) », icône lien externe, nouvel onglet | toujours (Q05) | decision, `#pub-link` | E05.1-CA08 | E05.1-T05 |
| E05.1-S12 | À contrôler | C03 | Phrase d'aide 12 px `text-secondary` | toujours | decision, `.dsect p.xs` | E05.1-CA07 | E05.1-T01 |
| E05.1-S13 | À contrôler | C60 | Nom commercial : valeur 16 px 700 ; motifs possibles | toujours | decision, `.check` 1 | E05.1-CA07 | E05.1-T01 |
| E05.1-S14 | À contrôler | C60 | Logo : cadre pointillé 48 × 48 + « Aucun logo déposé » ; image réelle non dessinée (§5) | selon logos | decision, `.check` 2 | E05.1-CA09 | E05.1-T06 |
| E05.1-S15 | À contrôler | C60 | Présentation 16 px, `max-width` `--size-measure`, sauts de ligne gardés ; « n caractères · langue du compte : … » 12 px | toujours | decision, `.check` 3 | E05.1-CA07 | E05.1-T01 |
| E05.1-S16 | À contrôler | C60 | Secteur principal 16 px 700, secteurs secondaires 12 px | toujours | decision, `.check` 4 | E05.1-CA07 | E05.1-T01 |
| E05.1-S17 | À contrôler | C60 | « À rapprocher : thèmes recherchés « … » et la présentation ci-dessus. », flèche, 12 px | au moins un thème | decision, `.check__near` | E05.1-CA07 | E05.1-T07 |
| E05.1-S18 | À contrôler | C60 | Colonne « Motif possible » ou « Motifs possibles » : questions 12 px `text-tertiary`, jamais un verdict | par ligne | decision, `.check__q` | E05.1-CA07 | E05.1-T07 |
| E05.1-S19 | À contrôler | C13 | Badge info « Modifié » sous le libellé | champ dans `revisions` | modification, `.badge--info` | E05.1-CA10 | E05.1-T03 |
| E05.1-S20 | À contrôler | C60 | « Avant : » + ancienne valeur barrée, 12 px ; la valeur proposée est la valeur principale | champ dans `revisions` | modification, `.was` | E05.1-CA10 | E05.1-T03 |
| E05.1-S21 | Recherche | C07, C14 | « Ce qu'elle recherche », badge public ; 5 propriétés, libellé 13 rem, `gap` 8 24 | valeur renseignée | decision, `#h-look` | E05.1-CA11 | E05.1-T01 |
| E05.1-S22 | Conditions | C07, C14 | « Entreprise et conditions », badge public ; propriétés renseignées seulement | valeur renseignée | decision, `#h-cond` | E05.1-CA11 | E05.1-T01 |
| E05.1-S23 | Conditions | C07 | « Non renseignés : … » sur une ligne, `text-tertiary` | au moins un champ vide | decision, `.emptyline` | E05.1-CA11 | E05.1-T07 |
| E05.1-S24 | Compte | C03, C14 | Badge « interne » (œil barré) ; une phrase : pays, langue, responsable, fonction, complétude | toujours | decision, `#h-acc` | E05.1-CA11 | E05.1-T01 |
| E05.1-S25 | Interlocuteur | C62 | h2 + marque ; cadre barre 4 px `bo-identified-accent`, fond `bo-identified-bg`, `p` 12 16, `radius` 12 px à droite ; chapeau capitales 12 px avec l'heure ; prénom, e-mail, téléphone ; phrase de confidentialité | entrée lue par un rôle interne | decision, `.idv` | E05.1-CA12 | E05.1-T08 |
| E05.1-S26 | Historique | C26, C53 | Replié ; titre + « n événements » ; liste date, acte, auteur (Q08) | toujours | decision, `#h-hist` | E05.1-CA13 | E05.1-T01 |
| E05.1-S27 | Décision | C59 | Carte 352 px, h2 « Décision » 16 px 700 ; contenu selon le volet actif | toujours | decision, `#decision-panel` | E05.1-CA14 | E05.1-T04 |
| E05.1-S28 | Décision repos | C18 | Phrase, commentaire interne facultatif (3 lignes, 83 px, 1 000 caractères), aide, compteur | mode décision | decision, `#note` | E05.1-CA15 | E05.1-T07 |
| E05.1-S29 | Décision repos | C12, C10 | « Valider » + touche `v`, seule pilule verte, 108,9 × 28 | mode décision | decision, `#b-pub` | E05.1-CA16 | E05.1-T02 |
| E05.1-S30 | Décision repos | C10 | « Refuser avec motif » + touche `r`, secondaire, 189 × 28, sous « Valider » | mode décision | decision, `#b-rej` | E05.1-CA16 | E05.1-T02 |
| E05.1-S31 | Décision | C27 | Rappel des touches `v`, `r`, `l`, Échap, 12 px ; masqué après décision | mode décision | decision, `#keys-line` | E05.1-CA17 | E05.1-T02 |
| E05.1-S32 | Publication | C05 | « Publier ce profil ? », récapitulatif (marque, langue), commentaire joint, « Confirmer la publication » puis « Annuler » | clic ou `v` | `#p-pub` (script) | E05.1-CA16 | E05.1-T02 |
| E05.1-S33 | Refus | C05, C21 | Motif en liste fermée : tous les motifs servis, 18 px, 29,7 px de haut au moins | clic ou `r` | refus, `.reasons-list` | E05.1-CA18 | E05.1-T02 |
| E05.1-S34 | Refus | C05 | Message envoyé à la marque : invitation, puis texte servi du motif choisi | volet ouvert | refus, `#why-msg` | E05.1-CA18 | E05.1-T02 |
| E05.1-S35 | Refus | C19 | Erreur sous la liste, sans boîte ; focus au premier motif | refus sans motif | `#why-err` (script) | E05.1-CA19 | E05.1-T02 |
| E05.1-S36 | Refus | C12 | « Refuser » (vert) puis « Annuler » (texte) | volet ouvert | refus, `#c-rej` | E05.1-CA18 | E05.1-T02 |
| E05.1-S37 | Refus | C18 | Message à la marque pour « Autre », 20 à 500 caractères, compteur (existant, non dessiné) | motif `other` | non montré | E05.1-CA18 | E05.1-T07 |
| E05.1-S38 | Rendre la main | C05 | Confirmation : « Rendre la main » puis « Garder la main » | commentaire saisi | `#p-rel` (script) | E05.1-CA02 | E05.1-T02 |
| E05.1-S39 | Décidé | C17 | Notice de succès avec l'heure et l'issue | décision enregistrée | publie, `#done-text` | E05.1-CA20 | E05.1-T02 |
| E05.1-S40 | Décidé | C10, C11 | « Entrée suivante : nom » pleine largeur (302 × 28), focalisée ; « Revenir à la file » 44 px | décision enregistrée ; suivante si `next` | publie, `#next` | E05.1-CA20 | E05.1-T02 |
| E05.1-S41 | Dialogue | C27 | Raccourcis de la décision, 5 lignes, libellé 8 rem | touche `?` ou rail | `#keys` | E05.1-CA17 | E05.1-T02 |
| E05.1-S42 | États | C17 | Lecture seule, verrou qui expire ou expiré, levée, relecture, modifié après examen, clos, erreur, chargement (existants, non dessinés) | §5 | non montré | E05.1-CA21 | E05.1-T03 |

## 4. Textes

Dans `E05d-bo-decision-textes.md`.

## 5. Interactions, états, responsive, clavier

- **Valider / `v`** → volet S32, focus sur « Confirmer la publication » → `POST publish` (jeton + commentaire) → S39, annonce C29, focus sur « Entrée suivante ».
- **Refuser / `r`** → volet S33, focus sur le premier motif (ou celui déjà choisi) → `POST reject` → S39. Le message affiché est celui servi avec le motif (`reasons[].message`, `nextStep`), jamais un texte composé à l'écran.
- **Annuler / Échap** → repos, commentaire et motif gardés ; focus sur le commentaire s'il est rempli, sinon « Valider ». Échap agit dans les champs, jamais quand un dialogue est ouvert.
- **Rendre la main / `l`** → sans saisie : `POST release`, retour à la file ; avec commentaire ou motif choisi : S38. Quitter par le fil d'Ariane ou le navigateur garde le verrou 30 min, comme aujourd'hui (Q09).
- **Ctrl + Entrée** dans le commentaire → ouvre S32 (n'enregistre rien). Nouveau.
- **Entrée suivante** → `/files/profils-marque/{next.entryId}`, qui la prend en charge (C1).
- **Fiche du compte** → même onglet ; écran journalisé (`15` RG40).

| État | Maquette | Comportement |
|---|---|---|
| Chargement | non montré | h1 de la file et « Ouverture de l'entrée… » (`BrandReviewEntryScreen.tsx:144-153`) ; proposé : en-tête et colonne en C09, hauteurs fixes |
| Erreur, refus, conflit d'intérêt, inconnue | non montré | phrases et « Réessayer » actuels (`:155-177`) dans C08, fil d'Ariane gardé |
| Lecture seule (collègue) | non montré | bandeau actuel dans la ligne de faits, colonne C59 avec `decision.readOnly` ; « Lever le verrou » (administrateur) à la place de « Rendre la main » ; volet C05 dans la colonne |
| Verrou à moins de 3 min, expiré | non montré | C17 en tête de la colonne, « Prolonger » / « Reprendre l'entrée » |
| Version périmée, modifié après examen | non montré | C17 en tête du dossier, badge « modifié après examen » par champ |
| Alertes présentes | non montré | une ligne par alerte dans S07 (triangle, texte `alerts.*`), plus `alerts.intro` ; à côté du champ visé : non dessiné (Q11) |
| Logo actif, en examen | non montré | image existante (`ReviewLogo`) sur C33, caractéristiques `logo.line` ; échec : `logo.failed` |
| Close | non montré | colonne : `ClosedBlock` actuel |
| Dernière entrée de la file | non montré | S39 + `chain.empty`, « Revenir à la file » seul |
| Décision en cours | non montré | libellé « Enregistrement… », second geste ignoré (existant) |
| Hors ligne, 409, 400 | non montré | C17 d'erreur dans le volet, saisie gardée |

- **Responsive** : 1440, 1280 §2. De 1024 à 1279 : deux colonnes, `.check` en une colonne. Moins de 1024 : une colonne, lien S06, coquille en bande (E04-Q05). Moins de 768 px ou 500 px de haut : E19.1, aucune ouverture.
- **Colonne collante plus haute que la fenêtre** (motifs à 8 entrées + « Autre ») : non montré ; proposé `max-height` 100 dvh moins la bande, défilement propre avec focus clavier.
- **Animations** : volets `rise-in` (opacité, −4 px, `duration-base` 200 ms, `ease-standard`) ; opacité seule en mouvement réduit ; aucune sortie animée.

## 6. Critères d'acceptation

- **E05.1-CA01** Fil d'Ariane à 3 éléments, h1 = nom ; un seul h1 ; aucun lien « Retour à la file » en bouton.
- **E05.1-CA02** « Rendre la main » libère le verrou et revient à la file ; avec une saisie, une confirmation s'ouvre dans la colonne ; après décision le bouton disparaît.
- **E05.1-CA03** « Fiche du compte » annonce la lecture enregistrée avant le clic (texte lu et marque).
- **E05.1-CA04** L'échéance vient de `slaDueAt` figée ; le retard est écrit une fois sur l'écran.
- **E05.1-CA05** Sous 1024 px, « Aller à la décision » amène et focalise la colonne.
- **E05.1-CA06** Première soumission et modification ont chacune leur phrase ; le nombre et les noms de champs sont ceux de `revisions`.
- **E05.1-CA07** Les quatre points de contrôle sont dans l'ordre nom, logo, présentation, secteur ; chaque motif possible existe dans `reasons`.
- **E05.1-CA08** La page publique s'ouvre dans un nouvel onglet sans libérer ni prolonger le verrou.
- **E05.1-CA09** Le logo affiché est celui servi par identifiant ; sa lecture est journalisée une fois par affichage.
- **E05.1-CA10** En modification : valeur proposée, badge « Modifié », ancienne valeur barrée et lue comme ancienne.
- **E05.1-CA11** Aucun champ vide en ligne propre ; chaque champ servi apparaît une fois ; couche « public » ou « interne » écrite.
- **E05.1-CA12** E-mail, téléphone, prénom et lien n'apparaissent que dans le cadre de vue identifiée.
- **E05.1-CA13** L'historique est replié, sans donnée non servie.
- **E05.1-CA14** À 1440 : dossier 704 px, écart 48 px, colonne 352 px collante à 68 px ; aucune carte dans le dossier ; aucune modale.
- **E05.1-CA15** Commentaire limité à 1 000 caractères, compteur à jour, jamais envoyé à la marque.
- **E05.1-CA16** Une seule pilule verte visible à la fois ; aucune touche ne publie ni ne refuse sans confirmation.
- **E05.1-CA17** `v`, `r`, `l`, `?` inactifs dans un champ ; Échap ferme sans perdre la saisie.
- **E05.1-CA18** Les 8 motifs servis sont tous listés ; le message affiché est le texte servi, caractère pour caractère.
- **E05.1-CA19** Refuser sans motif : message sous la liste, focus au premier motif, annonce, aucun appel.
- **E05.1-CA20** Après décision : notice, entrée suivante la plus urgente non verrouillée, focus, annonce ; aucune entrée prise sans geste.
- **E05.1-CA21** Les états non dessinés de §5 existent tous, avec leurs phrases actuelles.
- **E05.1-CA22** Aucun montant, taux, ni tarif sur l'écran (D48, D78).
- **E05.1-CA23** Contraste AA, dont `text-tertiary` 12 px sur la page ; `aria-label` sur `span` remplacé par un texte caché.

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E05.1-T01 | e2e | `apps/web/e2e/backoffice-queue.spec.ts` (L2C-17 « opening takes the entry ») | dossier, en-tête, fil d'Ariane |
| E05.1-T02 | e2e | `backoffice-queue.spec.ts` (L2C-17, L2C-18 ; l'enchaînement change, Q02) | valider, refuser, rendre la main, entrée suivante, clavier |
| E05.1-T03 | unitaire | `apps/backoffice/tests/queue-review-view.test.ts` (modes, bandeaux, faits, relecture) | états et phrases conservés |
| E05.1-T04 | visuel | nouveau, 1440, 1280, 1024, 768 px | grille, colonne collante, lien S06 |
| E05.1-T05 | e2e | nouveau, avec E05b | page publique en nouvel onglet, verrou intact |
| E05.1-T06 | e2e | `backoffice-queue.spec.ts` (logo) | image par identifiant, échec toléré |
| E05.1-T07 | unitaire | `queue-review-view.test.ts` (l. 230 à 321) + nouveau `decision-summary.test.ts` | motifs, longueurs, vides regroupés, rapprochements |
| E05.1-T08 | a11y | `backoffice-queue.spec.ts` (« the screen passes axe ») | axe, cadre identifié, focus des volets |
| E05.1-T09 | e2e | `backoffice-queue.spec.ts` (verrou d'un collègue, profil changé, levée par administrateur dans `backoffice.spec.ts`) | lecture seule, jeton périmé, levée |
| E05.1-T10 | unitaire | `guards.test.ts`, `case-floors.ts` | planchers et gardes inchangés |

À conserver pour les tests : `aria-keyshortcuts`, `aria-expanded`, `data-entry-link` (listes), `data-identified-frame` et `data-identified-bar` (C62), noms des régions `review-*`.

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Trois cadres de décision | `BrandReviewEntryScreen.tsx`, `ClaimedEntryFrame.tsx`, `VerificationEntryScreen.tsx` | un cadre C59 pour les 9 files | faire évoluer, supprimer deux copies |
| Contrôleurs | `use-review-entry.ts`, `use-claimed-entry.ts`, `use-verification-entry.ts` | conservés ; file 1 rejoint `use-claimed-entry` (E2) | faire évoluer |
| Bandeaux empilés | `StatusBanner`, 2 à 6 | faits en une ligne, bandeaux d'exception | faire évoluer |
| `BrandBlock`, `WrittenBlock` | 21 lignes, tableau comparatif | À savoir, À contrôler, propriétés | remplacer |
| `AlertsBlock` | carte | S07 | faire évoluer |
| `ContactBlock` | carte ordinaire | C62 | faire évoluer |
| `ReviewDecision`, `BoReasonPicker` | en bas, carte dans la carte, message sous le motif | colonne, C05, message unique | faire évoluer |
| « Retour à la file » | lien qui garde le verrou (`:214-217`) | fil d'Ariane | supprimer |
| Annuler / Confirmer | ordre variable (`ClaimedDecisionParts.tsx`) | confirmer puis annuler partout | faire évoluer |

**Données requises**

| Donnée | Servie ? | Écart |
|---|---|---|
| Dossier, révisions, alertes, motifs, contact, compte | oui, `POST …/open` (`backoffice-queues.ts:415-436`) | aucun |
| Nom de l'entrée suivante | non : `next.entryId` seul (`:541`) | Q03 |
| Historique complet | non : dépôt, prise actuelle, dernière levée, décision seulement | Q08 |
| Heure de la lecture enregistrée | `asOf` de l'ouverture | utilisable |
| Réseaux et formats liés | non : deux listes sans lien (`lists.networks`, `lists.formats`) | Q10 |
| Libellés des codes (secteurs, thèmes, rythmes) | non : `humanCode` (`queue-review-facts.ts:60`) | Q10 |
| Page publique, version soumise | aucune route | Q05 |

Hors lot : demandes de contact et candidatures (Lot 4) ; réattribution, note `n` (`17b` §4.11).

## 9. Contradictions, manques et décisions

| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E05-Q01 | Ordre du dossier et colonne contre `17b` §2.5 (① à ⑤) ; décision 0.6 ouverte | structure | maquette ; amender `17b` §2.5 | product-owner | oui |
| E05-Q02 | Après décision : volet « Entrée suivante » (maquette) contre ouverture et prise automatiques (`17b` §2.6) ; `ChainBanner` inutile alors | sortie d'une entrée, tests L2C-17 | maquette ; amender `17b` §2.6 ; aucun verrou pris sans geste | product-owner | oui |
| E05-Q03 | Nom de l'entrée suivante non servi | S40 | ajouter le libellé de liste à `next` pour les 9 files | architecte | oui |
| E05-Q04 | Maquette : 6 motifs ; liste servie : 8 (manquent « Contenu illicite ou contraire aux CGU », « Autre ») ; message composé par le script | refus | 8 motifs servis, message servi (RG66) | product-owner | non |
| E05-Q05 | « Voir la page publique » : aucune route ; hôte backoffice distinct ; `17b` §2.5 invariant 1 interdit l'ouverture d'un onglet | S11 | page interne du backoffice rendant E05b à partir du dossier ouvert, sans nouvel appel d'identité | architecte | oui |
| E05-Q06 | Site web listé sous une section « public » ; `07` l. 65 le retire de la vue des créateurs ; `06` RG17 et D40 le disent public | couche du site web | ligne du site avec couche « interne » jusqu'à décision | product-owner | non |
| E05-Q07 | Champs modérés `website_domain` et `contact_role` : sans ligne dans « À contrôler », donc sans « Modifié » ni « Avant » | modification de ces champs invisible | ligne de contrôle ajoutée quand le champ est dans `revisions` | product-owner | oui |
| E05-Q08 | Historique : prises antérieures et auteurs non servis | S26 | événements servis seulement, ou lecture `queue.*` du registre | architecte | non |
| E05-Q09 | Quitter la page par le fil d'Ariane garde le verrou (U35 en partie ouvert) | verrou fantôme | confirmer ou rendre à la sortie par le fil d'Ariane | product-owner | non |
| E05-Q10 | « Instagram : publication », libellés de listes | S21, S16 | deux propriétés séparées ; libellés dans `fr.ts` | architecte | non |
| E05-Q11 | Non dessinés : alertes, logo présent, lecture seule, expiration, levée, périmé, clos, « Lien » du contact, « État du profil » | S42 | formes de §5, à valider sur capture | expert-ux | oui |
| E05-Q12 | À 1280 px exactement, valeur à 161,6 px | lisibilité | empiler jusqu'à 1439 px, ou réduire la troisième colonne | expert-ux | non |
| E05-Q13 | Rail de cet écran sans « Fonctionnement » ni « Obligations et contrôles » (total 46 pourtant) | coquille | rail de E04 | expert-ux | non |
| E05-Q14 | Identifiants de décision (« D45, D46 ») dans un texte d'interface | S25 | texte existant `contact.lead`, sans identifiants | expert-ux | non |
| E05-Q15 | Bouton « Refuser » vert dans le volet, alors que E19 le rend rouge (`btn--danger`) | S36 | maquette E05 ; aligner E19 au Lot 4 | expert-ux | non |
| E05-Q16 | Bloc « motifs possibles » : correspondance champ / motif nouvelle, non spécifiée ; deux motifs visent un texte sans point propre | S18 | table fermée champ → motifs dans `queue-review-view.ts`, relue | product-owner | oui |
| E05-Q17 | Axe : `span[aria-label]` (X10), `.bo-band` (X11) | a11y | texte caché ; `header` | expert-ux | non |
