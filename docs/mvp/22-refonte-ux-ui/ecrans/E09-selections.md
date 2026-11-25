# E09 — Sélections (marque)
> Maquette : `proto-selections.html` (états `liste`, `liste-vide`, `cible-equipe`, `selection`, `tableau`, `demande`, `demande-envoyee`) · page de comparaison `ecran-9-selections.html` · validée le 2026-11-24, option C (07) · Constats : U17, U64, U18

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E09.1 | Mes sélections | `/fr/createurs/selections` | `/en/creators/selections` | `creator-search/ShortlistsScreen.tsx`, `ShortlistForm.tsx` | liste, liste-vide (cible-equipe : hors lot) | M | C06, C45, C56 |
| E09.2 | Ma sélection | `/fr/createurs/selections/[id]` | `/en/creators/selections/[id]` | `creator-search/ShortlistScreen.tsx`, `ShortlistForm.tsx` | selection, tableau | XL | C31 (E02), C54, C55, E02b (cible) |
| E09.3 | Demande à l'équipe, dans la sélection | même page que E09.2 | même page que E09.2 | `creator-search/SelectionRequestScreen.tsx` (page distincte) | demande, demande-envoyee | L | API `shortlistId`, écran BO file 9 |

Fichiers sous `apps/web/src/components/creator-search/` (chemin omis). Voir §10 pour `/createurs/demande-de-selection`.

À préserver :
- Garde de rôle `notFound()` (`ShortlistsScreen.tsx:40`, `ShortlistScreen.tsx:60`).
- Nom de 1 à 80 caractères après coupe ; note 1 à 500, vide = efface ; message 1 à 1 000 ; comptés en caractères (`shortlists-view.ts:49-131`).
- `PUT` de la liste = remplacement complet (nom ET campagne) ; `campaignId` nul détache (`shortlists-api.ts`, `updateShortlist`).
- 25 créateurs et 10 listes au plus (`selection_limits`), refus 409 `shortlist_full`, `shortlist_limit` (`shortlists-view.ts:73-98`).
- Un créateur devenu invisible disparaît sans trace ni compte (`10` RG51 amendé).
- Liste d'une autre marque ou inconnue : 404, une seule réponse (CA49).
- Aucun export, aucun « tout sélectionner », aucune notification au créateur (RG63, D45, CA52).
- États `loading`, `closed`, `brand_not_published`, `gone`, `failed` (`ShortlistsScreen.tsx:98-138`, `ShortlistScreen.tsx:95-141`).
- Demande : réponse `requested` (échéance) ou `brand_not_published` ; 429 ; envoi unique par clic (`SelectionRequestScreen.tsx:90-120`) ; focus au titre de confirmation.

API : `GET|POST /v1/me/shortlists` ; `GET|PUT|DELETE /v1/me/shortlists/:id` ; `PUT|DELETE …/items/:alias` ; `PUT …/items/:alias/note` ; `POST /v1/me/selection-requests` ; visuels et campagnes comme E02.

## 2. Structure

E09.1 : colonne `container-narrow` (768 px à 1440 et 1280 ; 712,4 à 768 ; 343 à 375), écart `spacing-5`.

| Zone | 1440 | 1280 | 768 | 375 |
|---|---|---|---|---|
| Titre et bouton | y 48, h 46,8, bouton à droite | y 44,4 | y 96,8 | titre y 88, bouton dessous y 127,6 |
| Phrase privée | y 102,8 | idem | idem | y 182,4, 2 lignes |
| Liste | y 148,5 ; 768 × 144 (2 lignes) | x 299,2 | x 27,8 ; 712,4 | y 249,8 ; 343 |
| Ligne | 72 px : vignettes 120, texte, chevron | idem | idem | 83 px, vignettes masquées sous 640 px |
| État vide | max 640, y 148,5 | idem | idem | 343 |

E09.2 et E09.3 : pleine largeur de contenu (1088 à 1440, 937,6 à 1280, 712,4 à 768, 343 à 375), écart `spacing-5`.

| Zone, dans l'ordre | 1440 | 375 |
|---|---|---|
| 1. Retour | y 48 | y 88 |
| 2. En-tête (nom, campagne, phrase) | y 93,7, h 109,7 | y 133,7 ; nom h 55,2 |
| 3. Outils (ajouter, vue) | y 227,4, h 44 | y 315,6 ; sans sélecteur de vue |
| 4. Grille ou tableau | y 295,4 ; grille 886,8 (3 col. de 346,7, carte 442,2 ou 412,5) ; tableau 412,7 | y 361,3 ; 1 col., 2236 |
| 5. « Et ensuite ? » | h 165,3 (repos), 607,1 (demande), 165,1 (envoyée) | 251,1 ; 833,1 ; 270,4 |
| 6. Gérer la sélection | filet, h 43,6 replié | idem |

- Grille : `repeat(auto-fill, minmax(17rem,1fr))`, écart 32 et 24 px ; 1280 : 3 colonnes de 296,5 ; 768 : 2 de 344,2.
- Tableau : largeur naturelle 1276,5 px, défile dans un cadre `radius-card` à toute largeur (colonne « Votre note » hors écran à 1440) ; sous 768 px, masqué.
- Encadré 5 : carte `surface-card`, rembourrage 24 px ; formulaire dans un bloc intérieur `surface-raised`, rembourrage 16 px, champs max 32rem.

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E09.1-S01 | En-tête | C02 | `h1` « Mes sélections », 28 px dès 1024, 24 px en dessous | toujours | liste `.t-page` | E09.1-CA01 | E09.1-T01 |
| E09.1-S02 | En-tête | C10 | Bouton secondaire « Nouvelle sélection », icône `plus`, 219,5 × 46,8, `aria-expanded` | lecture prête | `#b-new` | E09.1-CA02 | E09.1-T02 |
| E09.1-S03 | En-tête | C02 | Icône `lock` et phrase privée, `text-sm` secondaire | toujours | `.lead` | E09.1-CA01 | E09.1-T01 |
| E09.1-S04 | Création | C05 | Bloc intérieur replié « Nouvelle sélection », sous l'en-tête | ouvert par S02 | `#new-form` | E09.1-CA02 | E09.1-T02 |
| E09.1-S05 | Création | C18 | Champ « Nom de la sélection » (80 caractères) | S04 ouvert | `#n-name` | E09.1-CA03 | E09.1-T02 |
| E09.1-S06 | Création | C18 | Liste « Campagne (facultatif) » | S04 ouvert | `#n-camp` | E09.1-CA03 | E09.1-T02 |
| E09.1-S07 | Création | C19 | Erreur « Donnez un nom à la sélection. », icône `circle-alert` | nom vide à l'envoi | `#n-err` | E09.1-CA03 | E09.1-T02 |
| E09.1-S08 | Création | C12 | « Créer la sélection » (principal), « Annuler » (texte) | S04 ouvert | `#n-ok` | E09.1-CA03 | E09.1-T02 |
| E09.1-S09 | Liste | C06 | Ligne entière cliquable, 72 px, filet `border-subtle`, chevron droit | au moins une liste | `.lists > li` | E09.1-CA04 | E09.1-T01 |
| E09.1-S10 | Liste | C45 | Trois vignettes 56 × 42, chevauchement −24 px, contour page | dès 640 px ; données : E09-Q2 | `.thumbs` | E09.1-CA05 | E09.1-T03 |
| E09.1-S11 | Liste | C06 | Nom en lien étiré, Manrope 700 | toujours | `.r-title` | E09.1-CA04 | E09.1-T01 |
| E09.1-S12 | Liste | C06 | Campagne, « · {n} créateurs », « · {date} », `text-sm` secondaire | date : E09-Q2 | `.r-sub` | E09.1-CA05 | E09.1-T01 |
| E09.1-S13 | Vide | C08 | Icône `heart` 24 px, titre, phrase, sans cadre | aucune liste | liste-vide `.empty-state` | E09.1-CA06 | E09.1-T01 |
| E09.1-S14 | Vide | C10 | Bouton principal « Chercher des créateurs » vers E02.1 | aucune liste | `.btn--primary` | E09.1-CA06 | E09.1-T01 |
| E09.1-S15 | Équipe | C13 | Ligne badge « Proposée par INFLUX » et note `info` | hors lot (cible-equipe) | `.badge--info` | E09.1-CA07 | E09.1-T01 |
| E09.2-S01 | Retour | C11 | Chevron gauche, « Mes sélections » | toujours | selection `.go` 1 | E09.2-CA01 | E09.2-T01 |
| E09.2-S02 | En-tête | C55 | `h1` nom + crayon 36 px « Renommer la sélection » | toujours | `#name-view` | E09.2-CA02 | E09.2-T02 |
| E09.2-S03 | En-tête | C55 | Champ nom, « Enregistrer », « Annuler » | S02 activé | `#name-edit` | E09.2-CA02 | E09.2-T02 |
| E09.2-S04 | En-tête | C55 | « Campagne : {titre} » et crayon 36 px « Changer la campagne » | toujours | `#camp-view` | E09.2-CA02 | E09.2-T02 |
| E09.2-S05 | En-tête | C55 | Liste des campagnes, « Enregistrer », « Annuler » | S04 activé | `#camp-edit` | E09.2-CA02 | E09.2-T02 |
| E09.2-S06 | En-tête | C02 | Icône `lock`, « {n} créateurs · privée : … », `text-sm` | toujours | `.lead` | E09.2-CA01 | E09.2-T01 |
| E09.2-S07 | Outils | C11 | Lien `plus` « Ajouter depuis la recherche » vers E02.1 avec `list` | toujours | `.tools .go` | E09.2-CA03 | E09.2-T01 |
| E09.2-S08 | Outils | C22 | Sélecteur « Affichage » : Cartes, Tableau (162 × 44) ; voir X6 | dès 768 px | `.view-switch` | E09.2-CA04 | E09.2-T03 |
| E09.2-S09 | Cartes | C31 | Carte photo de E02 sans carrousel ni « Proposé car », un visuel | au moins un créateur | `#grid .pc` | E09.2-CA05 | E09.2-T01 |
| E09.2-S10 | Cartes | C31 | Badge photo « Audience vérifiée » (149,7 × 26,6) | badge servi (E02-Q6) | `.ph__badge` | E09.2-CA05 | E09.2-T01 |
| E09.2-S11 | Cartes | C31 | Cœur plein 44 × 44 « Retirer Profil {alias} de la sélection » | toujours | `.heart` | E09.2-CA06 | E09.2-T04 |
| E09.2-S12 | Cartes | C31 | Alias en lien, icône `badge-check` (X2), titre, thématique et pays, réseau et tranche | valeurs servies | `.pc__body` | E09.2-CA05 | E09.2-T01 |
| E09.2-S13 | Note | C55 | Filet, icône `pen-line`, note entre guillemets, « Modifier la note » | note présente | `.note__text` | E09.2-CA07 | E09.2-T05 |
| E09.2-S14 | Note | C55 | « + Ajouter une note privée » | note vide | `.note .link` | E09.2-CA07 | E09.2-T05 |
| E09.2-S15 | Note | C55 | Zone de texte 3 lignes, 500 caractères, compteur, état, « Terminer » | S13 ou S14 activé | `#nt*`, `[data-note-done]` | E09.2-CA07 | E09.2-T05 |
| E09.2-S16 | Tableau | C54 | 8 colonnes : Créateur, Réseau principal, Abonnés, Rythme, Commentaires, Pays, Thématique, Votre note ; en-tête 46,2 px, lignes 73 px | vue Tableau, dès 768 px | tableau `.cmp` | E09.2-CA08 | E09.2-T03 |
| E09.2-S17 | Tableau | C54 | Vignette 64 px, alias en lien, icône « Audience vérifiée » (X2) | vue Tableau | `.cmp .who` | E09.2-CA08 | E09.2-T03 |
| E09.2-S18 | Suppression | C26 | « Gérer la sélection » (`settings`), replié, filet haut | toujours | `.danger-zone` | E09.2-CA09 | E09.2-T06 |
| E09.2-S19 | Suppression | C05 | Phrase de confirmation, bouton danger « Oui, supprimer » | déplié | `#b-del` | E09.2-CA09 | E09.2-T06 |
| E09.3-S01 | Et ensuite ? | C04 | Carte, `h2` « Et ensuite ? », phrase, bouton principal « Demander une sélection à l'équipe INFLUX » (371,8 px) | repos | selection `#next-idle` | E09.3-CA01 | E09.3-T01 |
| E09.3-S02 | Demande | C05 | Bloc intérieur, titre ; remplace S01 dans la carte | S01 activé | demande `#next-form` | E09.3-CA01 | E09.3-T01 |
| E09.3-S03 | Demande | C21 | Case cochée « Joindre cette sélection : {nom} ({n} créateurs). Vos notes restent privées. » | sélection non vide (RG61.1) | `#q-join` | E09.3-CA02 | E09.3-T02 |
| E09.3-S04 | Demande | C18 | Liste « Campagne concernée (facultatif) », campagne de la sélection présélectionnée | ouvert | `#q-camp` | E09.3-CA03 | E09.3-T01 |
| E09.3-S05 | Demande | C18 | Zone « Votre besoin en quelques mots (facultatif) », aide, compteur 1 000 | ouvert | `#q-msg` | E09.3-CA04 | E09.3-T01 |
| E09.3-S06 | Demande | C18 | Phrase RG61.6, `text-xs` secondaire | ouvert | `#next-form p.xs` | E09.3-CA05 | E09.3-T01 |
| E09.3-S07 | Demande | C12 | « Envoyer ma demande » (principal), « Annuler » (texte) ; pleine largeur à 375 | ouvert | `#q-ok` | E09.3-CA06 | E09.3-T03 |
| E09.3-S08 | Envoyée | C17 | Notice succès, échéance et avertissement | état `sent` | demande-envoyee `.notice--success` | E09.3-CA05 | E09.3-T03 |
| E09.3-S09 | Envoyée | C05 | Phrase « profils figés », `text-xs` secondaire | état `sent`, sélection jointe | `#next-done p.xs` | E09.3-CA07 | E09.3-T03 |
| E09.3-S10 | Annonces | C29 | Région polie unique | toujours | `#announcer` | E09.3-CA08 | E09.3-T01 |

## 4. Textes

Table complète : `E09-selections-textes.md`.

## 5. Interactions, états, responsive, clavier

Interactions :
- S02 (E09.1) : ouvre S04, focus au nom ; « Annuler » ferme, focus à S02. Création : `POST`, puis la ligne apparaît en tête (éclair 320 ms), annonce, focus sur le lien. Refus 409, 429 : message sous S08 (`shortlist.refusal.*`).
- S09 (E09.1) : ouvre E09.2.
- S02 à S05 (E09.2) : édition sur place ; « Enregistrer » → `PUT` avec nom ET campagne courants ; succès : éclair, annonce, focus au crayon ; Échap = Annuler, `Entrée` = Enregistrer (C55). Nom vide : champ invalide, annonce, rien n'est envoyé.
- S11 (E09.2) : `DELETE item` après la réponse ; la carte s'efface (200 ms), focus à la carte suivante, à défaut à S01 d'E09.3 ; annonce.
- S13 à S15 : note enregistrée 600 ms après la dernière frappe (`PUT …/note`) ; état « Enregistrement… » puis « Enregistrée à {heure} » ; « Terminer » referme. Échec : non montré (E09-Q4).
- S08 (E09.2) : bascule sans requête ; vue gardée pour la visite seulement (pas de stockage, D37).
- S19 : `DELETE` liste → E09.1, annonce. Un seul clic après dépliage (E09-Q7).
- E09.3 : S01 ouvre S02 (focus S03) ; « Annuler » revient à S01 ; S07 envoie `POST /v1/me/selection-requests` avec `shortlistId` (E09-Q1), puis S08, focus au titre ou à la notice, annonce.

États :

| État | Maquette | Représentation |
|---|---|---|
| Mes sélections remplies / vides | `liste`, `liste-vide` | §3 |
| Sélection, tableau | `selection`, `tableau` | §3 |
| Demande, envoyée | `demande`, `demande-envoyee` | §3 |
| Chargement (E09.1, E09.2) | non montré | actuel : phrase `lists.loading` (`ShortlistsScreen.tsx:98`) ; proposé : C09 de lignes, puis de cartes |
| Erreur | non montré | actuel `:103-113` avec « Réessayer » ; E09.2 sans reprise (`ShortlistScreen.tsx:100-104`) : proposé, l'ajouter |
| Fermé (D38) | non montré | actuel `lists.closed` ; C08 |
| Marque non publiée | non montré | actuel `lists.notPublished` ; C08 |
| Sélection introuvable | non montré | actuel `list.gone` (`:105-117`) ; C08 |
| Sélection vide | non montré | actuel `list.empty` (`:197-205`) ; proposé : C08 « Ajouter depuis la recherche », sans bascule ni case S03 |
| Pleine (25), limite (10) | non montré | `shortlist.refusal.full`, `.limit` ; E09.1 : sous S08 |
| Demande : 429 | non montré | actuel `selectionRequest.refusal.rate_limited` ; C17 erreur sous S05 |
| Demande : marque non publiée | non montré | actuel `SelectionRequestScreen.tsx:249-261` ; C17 alerte |
| Demande : campagne refusée | non montré | actuel `refusal.not_found` |
| Hors ligne | non montré | actuel : `Notice` `account.offline` |
| Une seule campagne | non montré | pluriel ICU |

Responsive : 1440 et 1280, trois colonnes ; 768, deux ; 375, une, tableau et S08 masqués, actions pleine largeur, formulaire d'un seul tenant. Aucune barre fixe.

Clavier et focus : E09.1 : S02, lignes ; E09.2 : S01, crayons, S07, S08, cartes (cœur, alias, note), S01 d'E09.3, S18. Tableau dans une région nommée focalisable (X8). Focus au `h1` après navigation.

Animations propres : carte qui part `opacity`, `scale` 0,96 en 200 ms ; S04 et S02 d'E09.3 entrée 200 ms ; éclair 320 ms ; rien sous mouvement réduit.

## 6. Critères d'acceptation

- **E09.1-CA01** Le `h1` et la phrase de confidentialité sont visibles à toute largeur.
- **E09.1-CA02** Le formulaire est fermé à l'ouverture de la page et S02 expose `aria-expanded`.
- **E09.1-CA03** Nom vide, trop long ou refusé : message relié au champ, rien n'est perdu.
- **E09.1-CA04** Une ligne entière est cliquable, focus visible, une liste par ligne, la plus récente en tête.
- **E09.1-CA05** Le nombre et la date affichés viennent de l'API ; aucune valeur inventée.
- **E09.1-CA06** L'état vide n'a ni cadre ni compteur et une seule action principale.
- **E09.1-CA07** Aucune sélection proposée par l'équipe n'apparaît tant qu'aucune règle ne la crée.
- **E09.2-CA01** Le nom, la campagne et le nombre restent exacts après chaque geste.
- **E09.2-CA02** Nom et campagne s'éditent séparément ; chaque enregistrement envoie les deux valeurs courantes.
- **E09.2-CA03** « Ajouter depuis la recherche » ouvre la recherche avec cette sélection active.
- **E09.2-CA04** Sous 768 px, seules les cartes existent, quel que soit l'état de la bascule.
- **E09.2-CA05** Les cartes ne montrent que la projection servie ; aucun montant, chiffre exact ni score.
- **E09.2-CA06** Le retrait prend effet après la réponse, est annoncé, et le focus ne tombe jamais sur `body`.
- **E09.2-CA07** La note est privée, bornée à 500 caractères, effaçable, son état d'enregistrement est écrit.
- **E09.2-CA08** Le tableau montre les trois métriques D61 dans l'ordre communauté, rythme, commentaires, et tient dans son cadre sans défilement de la page.
- **E09.2-CA09** Supprimer demande un dépliage puis une confirmation, et dit que rien n'est récupérable.
- **E09.3-CA01** Une seule action principale visible à la fois dans la carte « Et ensuite ? ».
- **E09.3-CA02** La sélection est jointe par défaut, décochable, une seule au plus (RG61.1) ; absente si la sélection est vide.
- **E09.3-CA03** La campagne proposée est celle de la sélection ; elle reste modifiable.
- **E09.3-CA04** Le message est borné à 1 000 caractères, demande de ne donner ni e-mail ni téléphone.
- **E09.3-CA05** Les textes suivent RG61.6 : aucun nombre garanti, aucune promesse de contact, aucune mention de lot.
- **E09.3-CA06** Un envoi = un appel, même en double clic ; le corps transporte l'identifiant de la sélection, jamais des alias (RG61.2, CA39.5).
- **E09.3-CA07** La phrase « profils figés » n'apparaît que si une sélection a été jointe (RG61.2).
- **E09.3-CA08** Ajout, retrait, note, création, demande et suppression sont annoncés une fois ; textes FR et EN.
- **E09.3-CA09** Une demande avec sélection n'écrit rien côté créateur ni dans l'outbox (CA39.4) ; sélection d'une autre marque : 404 (CA39.2).

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E09.1-T01 | e2e | `apps/web/e2e/brand-creator-shortlists.spec.ts` (ligne 148, à adapter) | Liste, ouverture, vide, FR 375 |
| E09.1-T02 | e2e | même fichier | Création, refus, focus |
| E09.1-T03 | visuel | nouveau `brand-selections.visual.spec.ts` | Mesures des quatre largeurs |
| E09.2-T01 | e2e | `brand-creator-shortlists.spec.ts` (lignes 218 à 260) | Cartes, retour, recherche liée |
| E09.2-T02 | e2e | même fichier | Nom, campagne, refus |
| E09.2-T03 | e2e | nouveau cas | Bascule, tableau, 768 |
| E09.2-T04 | e2e | même fichier | Retrait et focus |
| E09.2-T05 | e2e | même fichier (lignes 244 à 257) | Notes, 500, échec |
| E09.2-T06 | e2e | même fichier (lignes 261 à 270) | Suppression |
| E09.3-T01 | e2e | même fichier (ligne 275, à adapter) | Demande dans la sélection |
| E09.3-T02 | e2e | nouveau cas | Sélection jointe, décochée, vide |
| E09.3-T03 | e2e | même fichier | Échéance, double clic, refus |
| E09.2-T07 | a11y | même fichier (`expectNoAxeViolation`) | axe, X2, X6, X8 |
| E09.3-T04 | unitaire | `apps/api/db-tests/search-selection-requests.test.ts`, `selection-request-route.test.ts` | CA39.1 à CA39.5 |
| E09.2-T08 | unitaire | `apps/web/tests/shortlists-view.test.ts` (lignes 262 à 506) | Bornes, refus, réducteurs, FR/EN, mots interdits |

Sélecteurs attendus : `data-shortlist`, `data-open-shortlist`, `data-shortlist-form`, `data-shortlist-submit`, `data-shortlist-saved`, `data-shortlist-item`, `data-save-note`, `data-note-saved`, `data-remove-item`, `data-delete-list`, `data-delete-confirm`, `data-delete-confirmed`, `data-selection-failure`, `data-request-criteria`, `data-send-request`, `data-request-sent`, `data-request-failure`, `data-state`.

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Lectures, réducteurs, refus | `use-shortlists.ts`, `use-shortlist-detail.ts`, `shortlists-view.ts` | inchangé | réutiliser |
| Liste en cartes | `ShortlistsScreen.tsx:157-179` | C06 | faire évoluer |
| Formulaire toujours ouvert | `ShortlistsScreen.tsx:181-192` | C05 replié | faire évoluer |
| Formulaire « Nom et campagne » | `ShortlistScreen.tsx:145-156`, `ShortlistForm.tsx` | C55 | faire évoluer |
| Cartes de 1 400 px | `ShortlistScreen.tsx:207-233`, `CreatorCardView` | C31 | faire évoluer |
| Note avec bouton « Enregistrer » | `ShortlistScreen.tsx:277-334` | C55, enregistrement en frappe | faire évoluer |
| Comparaison | aucune | C54 | créer |
| Suppression | `ShortlistScreen.tsx:347-404` | C26 | faire évoluer |
| Demande (page à part) | `SelectionRequestScreen.tsx` | bloc E09.3 ; page : §10 | faire évoluer |

Données requises :

| Donnée affichée par la maquette | Servie aujourd'hui ? | Écart |
|---|---|---|
| Nom, campagne, nombre | oui, `shortlistSummarySchema` (`shortlists.ts:72-78`) | aucun |
| Date de modification, « hier » | non : `createdAt` seul | E09-Q2 |
| Vignettes de la liste | non : lire chaque liste, puis les images | E09-Q2 |
| Carte, note | oui, `shortlistItemSchema` | aucun |
| Réseau principal, tranches, rythme, commentaires, pays, thématique | oui, projection | libellés courts : E02-Q4 |
| Sélection jointe à la demande | non : `selectionRequestBodySchema` n'a pas `shortlistId` ; `0325` et `0330` l'excluent (`0330:55`) | E09-Q1 |
| Sélection jointe côté agent | non : `selections-equipe` ne la montre pas | E09-Q1 |

Hors lot : mise en relation depuis la sélection (Lot 4) ; sélection proposée par l'équipe (`cible-equipe`).

## 9. Contradictions, manques et décisions

Transverses : X2 (S12, S17), X3 (640 px), X4, X6 (S08), X7, X8, X11, X13.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E09-Q1 | `10` RG61.1 à RG61.6, CA39.1 à CA39.5 : sélection jointe, figée ; jamais codé : contrat strict sans `shortlistId`, `0325` sans paramètre, `0330` l. 55 « Not here », file 9 sans affichage | E09.3 ne peut pas joindre | Contrat + migration + écran BO file 9 avant E09.3 ; sinon case S03 masquée | architecte | oui |
| E09-Q2 | « modifiée hier », « 12 nov. » et vignettes : liste servie avec `createdAt` seul, sans visuel ; une lecture par liste et par visuel | S10, S12 | Ajouter à la liste une date de dernière modification et jusqu'à 3 visuels de `creator_layer_a` ; sinon date de création et aucune vignette | architecte | oui |
| E09-Q3 | `cible-equipe` : aucune règle (`RG61.6` : « revient avec une proposition ») ; constat déjà écrit dans la maquette | S15 | Hors lot ; `product-owner` spécifie ou abandonne | product-owner | non |
| E09-Q4 | Note enregistrée pendant la frappe : échec, hors ligne et limite de débit non montrés ; une frappe = jusqu'à un `PUT` toutes les 600 ms, plafond par adresse (`member-rate.ts`) | S15 | Délai 600 ms, état d'échec écrit avec « Réessayer », texte gardé | expert-ux | oui |
| E09-Q5 | Cartes sur téléphone : l'état `tableau` relevé à 375 montre le tableau (bascule masquée) | Contradiction interne avec 07 | Cartes seules sous 768 px (07 fait foi) | expert-ux | non |
| E09-Q6 | Les trois commentaires fictifs « 200–499 », « Tous les jours », « Environ une par semaine » : absents des tranches (`200_999`, `daily`, `weekly`) | S16 | Libellés de `creatorProfile.reference.*` | expert-matching | non |
| E09-Q7 | Suppression : un clic après dépliage, sans « Annuler » ; aujourd'hui demander puis confirmer (`ShortlistScreen.tsx:373-389`) | S19 | Conserver la confirmation en deux temps avec « Annuler » ; texte identique | expert-ux | non |
| E09-Q8 | Sélection vide : E09.3 jointe impossible (RG61.1 « non vides ») ; non montré | S03 | Case absente, demande envoyée sans sélection | product-owner | non |
| E09-Q9 | RG61.1 « pré-rempli avec la sélection active » : la demande ouverte depuis la recherche (page §10) doit aussi pré-remplir | §10 | Même composant, sélection active de l'adresse (`list`) | product-owner | oui |
| E09-Q10 | Le tableau déborde de 1276 px : la note n'est jamais visible sans défiler, même à 1440 | S16 | Garder le défilement dans le cadre ; première colonne fixe | expert-ux | non |
| E09-Q11 | Point de vigilance (RG42) et date des chiffres absents des cartes (idem E02-Q5, E02-Q8) | S09 | Suivre la décision d'E02 | expert-matching | oui |
| E09-Q12 | « Annuler » d'E09.3 efface-t-il le brouillon du message ? Non montré | S07 | Garder le brouillon en mémoire de page | expert-ux | non |

## 10. Écrans du périmètre sans maquette

| Écran existant | Route | Composant | Ce qu'il devient | Arbitre |
|---|---|---|---|---|
| Demander une sélection à l'équipe (depuis la recherche, le profil, les états fermé et plafond) | `/fr/createurs/demande-de-selection`, `/en/creators/selection-request` | `SelectionRequestScreen.tsx` | Garde sa route et sa fonction : seule entrée de RG61 hors sélection (recherche fermée, 429, sous le seuil). Forme proposée, sans maquette : C02, C42 pour les critères (`recap`, `recapNone`), champs et textes de S04 à S08 d'E09.3 ; case S03 pour la sélection active (RG61.1, E09-Q9) ; confirmation S08 au même endroit. Arrivée directe : critères vides acceptés | expert-ux |
| Choix et création d'une sélection dans la recherche | panneau `SelectionPanel.tsx` de `/createurs` | `SelectionPanel.tsx` | Disparaît de E02 (E02-Q10) ; création : E09.1 ; choix : E02b.1-S37 | expert-ux |
| Aucun | — | — | Les états `closed`, `brand_not_published`, `gone`, `rate_limited`, `failed`, `page_cap`, `forbidden` de E02, E02b, E09 n'ont pas de maquette : représentation proposée en §5 de chaque fiche | expert-ux |
