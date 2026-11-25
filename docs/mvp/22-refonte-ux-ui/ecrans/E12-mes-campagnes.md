# E12 — Mes campagnes (marque)
> Maquette : `proto-mes-campagnes.html` (états liste, pause, un-brouillon, neuve) · page de comparaison `ecran-12-mes-campagnes.html` · validée le 2026-11-24 (07, « Écran 12 ») · Constats : U13, U59, U64
## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E12.1 | Mes campagnes | `/fr/campagnes` | `/en/campaigns` | `CampaignsScreen` → `CampaignListScreen` | liste, pause, un-brouillon, neuve | M | C06, D86, E07, E18 |

**Adresse partagée** : `CampaignsScreen.tsx` choisit par rôle. Créateur : fil E08 (`CampaignFeedScreen`), à ne pas toucher. Marque : cet écran. La redirection n'existe pas, l'API répond « introuvable » à l'autre rôle (T14).
À préserver (`apps/web/src/components/campaign/`) :
- `notFound()` hors rôle annonceur (`CampaignListScreen.tsx:53-57`) ; ordre de l'API (dernière modifiée d'abord), rien n'est recalculé.
- Création : `POST /v1/me/campaigns` (vide) puis navigation vers `/campagnes/[id]` ; un seul appel, échec `list.createFailed` (`:87-101`) ; session finie → déconnecté.
- Six états écrits ; refus : motif typé, message de l'agent, suite `fix` ou `contact` (`CampaignStatusText.tsx`).
- Titre vide : `list.untitled`. Chargement et erreur : `list.loading`, `list.unavailable`, `list.retry`.
- API : `GET /v1/me/campaigns` (`campaignListResponseSchema`), `POST /v1/me/campaigns`, profil par `useMember().brandProfile`.

## 2. Structure
- Coque C56, rubrique Campagnes, « Mes campagnes » courante ; `m-page` : E07a §2. Bloc d'état : « Profil : {état} » (E01a).
- `.camp` : colonne, `gap: spacing-6` (32), largeur max `container-narrow` : 768 à 1440 (x 304) et 1280 (x 299,2) ; 712,4 à 768 ; 343 à 375. Aucune carte de liste.
- Ordre : en-tête → À faire → En cours → Terminées ; ou (neuve) en-tête → notice → état vide.
- En-tête : `h1` 28 px 800 (24 à 768 et 375) et bouton (236,9 × 44,8) sur une ligne ≥ 768 (44,8 px de haut) ; à 375 : titre, puis bouton pleine largeur 343 × 44,8 (84,4 px).
- Groupe : `gap: spacing-2` ; titre Manrope 14 px 700 secondaire, compteur tertiaire tabulaire ; `ul.rows` filet haut `border-subtle`.
- Ligne `c-row` : grille `minmax(0,1fr) 15rem 5.5rem 1.25rem`, padding `spacing-3 spacing-2`, filet bas ; 76,2 px (une ligne de précision), 60 (terminée), 79,3 avec motif. Colonnes à 1440 : titre 356, état 240, date 88, chevron 16. Motif : toute la largeur.
- À 768 : mêmes colonnes (titre 300). Sous 768 : grille `1fr 1.25rem`, titre puis état en ligne, puis date préfixée « Modifiée le » ; chevron centré sur la première rangée ; 104 à 198 px de haut.
- Terminées : `details`, résumé 44 px (`size-touch-target`), chevron tourné 90° ouvert.
- Neuve : notice 768 × 99,1 ; carte `empty` 768 × 284,9, `radius-card`, padding `spacing-inset-card` (32 ; 24 à 375), `h2` 16 px 700, `ol` décimale 14 px.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E12.1-S01 | Cadre | C01 | Colonne 768, sections espacées de 32 | toujours | liste `.camp` | E12.1-CA01 | E12.1-T03 |
| E12.1-S02 | En-tête | C02 | `h1` « Mes campagnes » | toujours | `.page-head h1` | E12.1-CA01 | E12.1-T01 |
| E12.1-S03 | En-tête | C10 | « Créer une campagne », plus, seul vert | toujours, profil publié ou non (D86) | `.btn--primary` | E12.1-CA02 | E12.1-T02 |
| E12.1-S04 | À faire | C03, C16 | `h2` « À faire » et compteur | au moins une à corriger ou un brouillon | `#g-todo` | E12.1-CA03 | E12.1-T01 |
| E12.1-S05 | En cours | C03, C16 | `h2` « En cours » et compteur | validation, publiée ou en pause | `#g-cur` | E12.1-CA03 | E12.1-T01 |
| E12.1-S06 | Terminées | C26, C16 | Résumé « Terminées » et compteur, fermé | au moins une clôturée | `#g-done` | E12.1-CA04 | E12.1-T01 |
| E12.1-S07 | Ligne | C06 | Titre Manrope 700, lien étiré à la ligne, sur 2 lignes s'il le faut | toutes | `.r-title a.cover` | E12.1-CA05 | E12.1-T01 |
| E12.1-S08 | Ligne | C13 | Badge d'état (icône et mot) | toutes | `.st .badge` | E12.1-CA06 | E12.1-T01 |
| E12.1-S09 | Ligne | C06 | Précision 12 px secondaire | selon état | `.st .sub` | E12.1-CA07 | E12.1-T01 |
| E12.1-S10 | Ligne | C06 | Date courte 14 px tabulaire ; préfixe sous 768 | toutes | `.date` | E12.1-CA08 | E12.1-T01 |
| E12.1-S11 | Ligne | C06 | Chevron 16 px tertiaire, décoratif | toutes | `.chev` | E12.1-CA05 | E12.1-T03 |
| E12.1-S12 | À corriger | C19 | Motif 14 px ambre sur toute la largeur | état à corriger | `.why span` | E12.1-CA09 | E12.1-T01 |
| E12.1-S13 | À corriger | C11 | « Corriger » souligné, au-dessus du lien étiré, nom complété masqué | état à corriger | `.why a` | E12.1-CA09 | E12.1-T01 |
| E12.1-S14 | Brouillon | C13, C06 | Badge neutre « Brouillon » et « {n} informations manquantes » | brouillon | liste, ligne 2 | E12.1-CA07 | E12.1-T01 |
| E12.1-S15 | Validation | C13, C06 | Badge information, sablier ; « réponse sous 1 jour ouvré » | en validation | En cours, ligne 1 | E12.1-CA07 | E12.1-T01 |
| E12.1-S16 | Publiée | C13, C06 | Badge succès, coche ; « candidatures jusqu'au {date} » | publiée | liste, En cours ligne 2 | E12.1-CA07 | E12.1-T01 |
| E12.1-S17 | En pause | C13, C06 | Badge avertissement, horloge ; « candidatures suspendues » | en pause | pause | E12.1-CA07 | E12.1-T01 |
| E12.1-S18 | Terminée | C13 | Badge neutre « Clôturée », titre secondaire, sans précision | clôturée | `.is-done` | E12.1-CA04 | E12.1-T01 |
| E12.1-S19 | Note | C18 | Phrase de confidentialité du brouillon 14 px | une seule campagne, brouillon | un-brouillon `p.sm` | E12.1-CA10 | E12.1-T01 |
| E12.1-S20 | Neuve | C17 | Notice information : préparer dès maintenant | profil non publié et aucune campagne | neuve `.notice` | E12.1-CA11 | E12.1-T02 |
| E12.1-S21 | Neuve | C11 | « Compléter mon profil de marque », chevron | idem | `.notice .go` | E12.1-CA11 | E12.1-T02 |
| E12.1-S22 | Neuve | C08, C04 | Carte « Votre première campagne », phrase, 3 points numérotés, durée | aucune campagne | `.empty` | E12.1-CA12 | E12.1-T02 |
| E12.1-S23 | Colonne | C56 | « Profil : Brouillon » et « Compléter mon profil » | profil non publié, ≥ 1 024 | `.m-state` | E12.1-CA11 | E12.1-T02 |

## 4. Textes
Clés : `apps/web/src/locales/{fr,en}/campaign.json`. EN absent : « à écrire (expert-marketing) ».
| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S02 | Mes campagnes | My campaigns | `list.title` |
| S03 | Créer une campagne | Create a campaign | `list.create` |
| S04, S05, S06 | À faire · En cours · Terminées · {n} | à écrire | nouvelle |
| S07 | {titre} ou Campagne sans titre | Untitled campaign | `list.untitled` |
| S08, S14 à S18 | À corriger · Brouillon · En cours de validation · Publiée · En pause · Clôturée | To correct · Draft · Being reviewed · Published · Paused · Closed | `status.label.*` |
| S09 | {n} informations manquantes · réponse sous 1 jour ouvré · candidatures jusqu'au {date} · candidatures suspendues | à écrire | nouvelle |
| S10 | {date} · Modifiée le {date} | Changed on {date} | `list.updatedOn` (sous 768) ; date seule : nouvelle |
| S12 | Motif de votre commercial : « {motif} » | à écrire | nouvelle ; motif : `rejection.*` |
| S13 | Corriger (+ « : {titre} » masqué) | à écrire | nouvelle |
| S19 | Un brouillon n'est vu de personne d'autre que vous tant que vous ne l'avez pas envoyé à INFLUX. | à écrire | nouvelle (`status.draft` proche) |
| S20 | Vous pouvez préparer votre campagne dès maintenant. Vous l'enverrez à INFLUX une fois votre profil de marque publié, sous 1 jour ouvré après son envoi. | à écrire | nouvelle (remplace `publish.profileRequired` ici) |
| S21 | Compléter mon profil de marque | à écrire | nouvelle (`list.profileLink` diffère) |
| S22 | Votre première campagne · Une campagne décrit ce que vous proposez à des créateurs. Elle s'enregistre au fil de la saisie ; un commercial INFLUX la relit avant de l'ouvrir. · L'offre et le travail attendu · Les créateurs visés et votre budget, qui reste entre vous et INFLUX · Le calendrier, puis l'envoi à INFLUX · Environ 15 minutes. | Your first campaign ; le reste à écrire | `list.empty.title` ; nouvelle |
| S23 | Profil : Brouillon · Compléter mon profil | Complete my profile à confirmer | `member.json` `shell.accountState.*` |

## 5. Interactions, états, responsive, clavier
- « Créer une campagne » → POST, libellé `list.creating` et `aria-disabled` (non montré, préservé), puis E07.1 ; échec : C17 erreur sous l'en-tête (`list.createFailed`).
- Ligne entière → brouillon : E07 (étape de reprise : E07-Q8) ; à corriger, en validation, publiée, en pause, clôturée : E18. « Corriger » → E07.1 de la même campagne, par-dessus le lien étiré (`z-index: 1`).
- Terminées : `details`, `rise-in` 200 ms à l'ouverture, chevron `rotate` 200 ms.
- États. Chargement, erreur : non montrés : comportement préservé (`CampaignListScreen.tsx:134-147`) ; proposé : C09 (titre de groupe et 3 lignes de 76 px), C08 « Réessayer ». Hors ligne : `account.offline` absent de cet écran aujourd'hui, à laisser. Profil illisible : rien n'est affirmé (préservé), bouton visible. Profil publié et aucune campagne : S22 sans S20 (E12-Q4). Profil non publié avec des brouillons : non montré (E12-Q4). Refus « contact » : E12-Q3. Aucune annonce C29 propre.
- Responsive : §2 ; 1280 et 1440 identiques ; 768 garde les colonnes ; 375 sur deux niveaux, chevron conservé.
- Clavier : un arrêt par ligne, un de plus pour « Corriger », un pour Terminées ; anneau sur la ligne entière. Survol de ligne : fond `surface-raised`, 120 ms.

## 6. Critères d'acceptation
- **E12.1-CA01** À 1440 : contenu x 304, 768 de large, écart de 32 entre sections ; à 375 : 343, aucun défilement horizontal.
- **E12.1-CA02** Le bouton est toujours visible et actif quel que soit l'état du profil (D86) ; c'est la seule action verte.
- **E12.1-CA03** Groupes : à faire (`rejected`, puis `draft`), en cours (`pending_review`, `published`, `paused`), terminées (`closed`) ; ordre de l'API gardé dans chaque état ; un groupe vide disparaît ; le compteur est celui du groupe.
- **E12.1-CA04** Terminées fermée par défaut, libellé « Clôturée » partout.
- **E12.1-CA05** Un lien par ligne, ligne entière cliquable, 44 px au moins, aucun bouton « Reprendre » ni « Consulter ».
- **E12.1-CA06** Chaque état est un mot et une icône, jamais une couleur seule.
- **E12.1-CA07** Précision : manques (brouillon), délai (validation), date limite (publiée), « candidatures suspendues » (pause).
- **E12.1-CA08** Date au format court de la langue, année si elle diffère de l'année en cours.
- **E12.1-CA09** Motif : texte du code `rejection.*` et message de l'agent s'il existe ; « Corriger » mène au formulaire, sans ouvrir la fiche.
- **E12.1-CA10** La phrase S19 n'apparaît que s'il n'y a qu'un brouillon.
- **E12.1-CA11** Profil non publié : notice, lien vers le profil ; la création fonctionne.
- **E12.1-CA12** Aucune campagne : carte en trois points, sans second bouton vert.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E12.1-T01 | e2e, a11y | `apps/web/e2e/brand-campaign-states.spec.ts` (« six states in words ») | groupes, états, motif, liens, axe |
| E12.1-T02 | e2e, base | `apps/web/e2e/brand-campaign.spec.ts` (L3B-E1 : la création n'attend plus le profil publié) et un test base de création avec profil en brouillon (D86) | D86, CA2-bis |
| E12.1-T03 | visuel | `apps/web/e2e/wizard-visual.spec.ts` (nouveau) | 4 états, 1440 et 375 |
| E12.1-T04 | unitaire | `apps/web/tests/campaign-view.test.ts` (nouveau cas) | regroupement par état, précision, choix du lien |

À conserver : `list[aria-label = copy.list.title]` (par groupe), `copy.list.create`, `status.label.*` ; `copy.list.resume`, `list.view` et `copy.preview.link` (L3B-E3 « reached from the list ») disparaissent. Le fil créateur (`creator-campaigns.spec.ts`) ne change pas.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Carte par campagne, bouton, lien d'aperçu | `CampaignListScreen.tsx:158-221` | C06 `c-row` ; aperçu en E18 | faire évoluer, supprimer |
| Création conditionnée au profil publié | `:104-114` | toujours | faire évoluer (D86) |
| Notice `publish.profileRequired` | `:119-128` | S20 | faire évoluer |
| Regroupement | absent | 3 groupes | créer |
| Refus « contact » | `CampaignStatusText.tsx` | E12-Q3 | à arbitrer |
| État vide | `:149-153` | S22 | faire évoluer |

Données requises : titre, état, `updatedAt`, `applicationsCloseOn`, `refusal` : servis (`packages/contracts/src/campaign.ts:463-475`). **Nombre de manques d'un brouillon : non servi** dans la liste (`missingRequired` n'existe qu'à la lecture d'une campagne) → écart d'API (`missingCount`). Délai de réponse : paramètre non servi. Hors lot : nombre de candidatures et plafond atteint sur la ligne (Lot 4).

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E12-Q1 | « 3 informations manquantes » : donnée absente de `campaignSummarySchema` | Écart d'API ou N lectures | Champ `missingCount` (schéma et `missingCampaignFields` en liste) | architecte | oui |
| E12-Q2 | « réponse sous 1 jour ouvré » en dur ; RG6 : paramètre, 2 jours en revue renforcée, `EC-L3B-10-2` | Délai faux | Comme E07-Q17 | product-owner | non |
| E12-Q3 | « Corriger » pour tout refus ; code : `followUp` peut valoir `contact` (contenu illicite) | Action trompeuse | `contact` : `refusal.contact` à la place de « Corriger » | product-owner | oui |
| E12-Q4 | Cas non montrés : aucun dans le groupe « À faire » et profil non publié ; profil publié sans campagne ; profil refusé ou suspendu ; profil non publié avec brouillons | Notice : quand l'afficher ? | Notice dès que le profil n'est pas publié, texte selon l'état ; suspendu : neutre | product-owner | oui |
| E12-Q5 | « Motif de votre commercial : « … » » : le motif est un code typé, le message de l'agent est à part (RG90, RG92) | Attribution inexacte | Libellé « Motif : » puis message de l'agent | product-owner | non |
| E12-Q6 | « ouvre le formulaire » (page de comparaison) contre « ouvre la fiche » (07, écran 18) | Destination | Fiche E18, sauf brouillon | expert-ux | non |
| E12-Q7 | Texte `rejected` : « Coffret de fêtes » tronque le titre dans le nom masqué | A11y | Titre complet | expert-ux | non |
| E12-Q8 | Lien « Corriger » 21,7 px de haut ; compteur `.n` tertiaire | Cible tactile | Zone cliquable 44 | expert-ux | non |
| E12-Q9 | Ligne E07 de la maquette ouvre `#etape-1` sans tenir compte de la reprise (`?step`) | Reprise | Rouvrir à la dernière étape (E07-Q8) | product-owner | non |
