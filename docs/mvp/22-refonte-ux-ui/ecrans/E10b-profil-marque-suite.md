# E10 — Profil de marque, vérifier, envoyé, liste de tâches, modification (marque)
> Maquette : `proto-profil-marque.html` (états verifier, verifier-complet, envoye, profil, modif-2) · page de comparaison `ecran-10-profil-marque.html` · validée le 2026-11-24 (07, « Écran 10 ») · Constats : U22, U63, U59
> Étapes 1 à 3 et éléments communs E10.1-S01 à S13 : `E10a-profil-marque-etapes.md`. Assistant : `E07a-campagne-etapes.md`.
## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E10.4 | Vérifier et envoyer | `/fr/compte/profil?step=verifier` (à créer) | `/en/account/profile?step=review` | `ProfileProgress`, `SubmitFeedback` (`BrandProfileScreen.tsx:288-384`) | verifier, verifier-complet | M | C20, C42, E05b |
| E10.5 | Profil envoyé | `/fr/compte/profil` après envoi | `/en/account/profile` | `ProfileStateNotice` (en attente) | envoye | S | C08, C51 |
| E10.6 | Mon profil de marque | `/fr/compte/profil` (profil publié) | `/en/account/profile` | `BrandProfileScreen` (publié) | profil | M | C06, badge |
| E10.7 | Modifier une étape | `/fr/compte/profil?step=1..3` (publié) | `/en/account/profile?step=1..3` | `BrandProfileScreen` (publié) | modif-2 | M | C41 |

À préserver :
- Envoi : enregistre d'abord, manques nommés, focus au premier ; `unavailable`, `unsaved`, `locked` (`BrandProfileScreen.tsx:194-203`, `:289-306`). `canSubmit` : jamais sur publié ni suspendu ; `isEditable` : jamais sur suspendu (`brand-profile-view.ts:430-436`).
- États de révision : 8 phrases (`noticeOf`, `brand-profile-view.ts:468-488`), motif typé et message de l'agent, jamais le commentaire interne ; champs modérés (nom, logo, présentation, site, fonction, secteur) signalés (`:497-504`, `review.*`, `logo.review.*`).
- `AccountStateBlock` (colonne, ≥ 1 024) : état, nombre de manques, une action. Accueil : même vocabulaire.
- Badge : bloc `BrandVerificationBlock`, parcours `/compte/profil/marque-verifiee`, accessible même suspendu.
- API : `GET`, `PATCH /v1/me/brand-profile`, `POST /v1/me/brand-profile/submit`, `GET /v1/me/brand-verification`.

## 2. Structure
- E10.4 : cadre C41 768, sans pied ni lien de manques ; contenu 702 ; en-tête 88,6 ; carte de marque `bcard` 544 max × 176 (`radius-card`, padding `spacing-4`, pastille 48, puces 26,6 px) ; récapitulatif 3 sections, `dl` 176 + 502 ; actions ; aide. Hauteur du cadre : 1 265 (verifier), 1 206 (verifier-complet). 375 : `bcard` 343 × 176 ; `dl` 176 + 143 ; actions empilées.
- E10.5 et E10.6 : `.sent`, 768, sans cadre, `gap: spacing-5`, x 304 à 1440 ; 343 à 375.
- E10.5 : en-tête 72,8 (`h1` 28 px 800, ligne d'état) ; notice 69,4 ; « La suite » 199,6.
- E10.6 : en-tête 90,8 : `h1` et « Ce que voit un créateur » (255,6 × 46,8) sur une ligne ≥ 768 ; à 375 bouton pleine largeur 343 × 46,8 dessous ; ligne identité 32 (pastille 32, nom 700, badge). Liste `ol.tasks` 768 × 256,5 : filet haut `border-default`, lignes de 60 px min (`size-touch-target + spacing-4`), padding `spacing-3 spacing-2`, grille `1fr auto` (une colonne sous 640, X3), filet bas, survol `surface-raised` ; lien étiré sur la ligne. À 375 : 350 px.
- E10.7 : écran E10.1, E10.2 ou E10.3 ; pied sans « Précédent » ni « Enregistrer et reprendre plus tard » ; principal 224,9 × 44,8 à 1440.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E10.4-S01 | Tête | C41 | « Vérification », « Plus que la relecture », segments ambre si manque | toujours | verifier `.wz-head` | E10.4-CA01 | E10.4-T01 |
| E10.4-S02 | En-tête | C02 | `h2` « Vérifier et envoyer » et phrase | toujours | `#hvs` | E10.4-CA01 | E10.4-T01 |
| E10.4-S03 | Manques | C20 | Résumé d'erreurs, liens « Étape {n} — {champ} » | après envoi avec manques (non capturé) | script `#errsum` | E10.4-CA02 | E10.4-T01 |
| E10.4-S04 | Aperçu | C18 | Libellé « Ce que voit un créateur » | toujours | `.label` | E10.4-CA03 | E10.4-T01 |
| E10.4-S05 | Aperçu | C04, C33, C38 | Carte de marque : logo ou pastille vide pointillée, nom, secteur · pays · taille, 2 lignes, puces | toujours | `.bcard` | E10.4-CA03 | E10.4-T01 |
| E10.4-S06 | Aperçu | C11 | « Voir la page complète, comme un créateur », nouvel onglet | toujours | `a.go` | E10.4-CA03 | E10.4-T01 |
| E10.4-S07 | Récapitulatif | C42, C07 | 1 : Logo, Nom, Pays · secteur · taille, Présentation, Site web (agents INFLUX) | toujours | `dl` 1 | E10.4-CA04 | E10.4-T01 |
| E10.4-S08 | Récapitulatif | C42, C07 | 2 : Thématiques, Réseaux et formats, Pays d'audience, Marchés, Langues de travail | toujours | `dl` 2 | E10.4-CA04 | E10.4-T01 |
| E10.4-S09 | Récapitulatif | C42, C14 | 3 : Interlocuteur, badge « interne » | toujours | `dl` 3 | E10.4-CA04 | E10.4-T01 |
| E10.4-S10 | Récapitulatif | C20 | « À compléter : {champ} » ambre | par manque | `.missing` | E10.4-CA02 | E10.4-T01 |
| E10.4-S11 | Récapitulatif | C11 | « Modifier » + nom d'étape masqué | chaque section | `[data-fix]` | E10.4-CA04 | E10.4-T01 |
| E10.4-S12 | Actions | C10 | « Envoyer à INFLUX pour validation » (300,1), « Revenir à l'étape 3 » | toujours | `#send`, `#back3` | E10.4-CA05 | E10.4-T01 |
| E10.4-S13 | Actions | C18 | Aide « Vous pourrez modifier… » | toujours | dernier `p.sm` | E10.4-CA05 | E10.4-T01 |
| E10.4-S14 | Retour d'envoi | C17 | Échec, saisie en attente, verrouillé : non montrés | selon réponse | code `BrandProfileScreen.tsx:289-306` | E10.4-CA05 | E10.4-T01 |
| E10.5-S01 | En-tête | C02, C13 | `h1` « Mon profil de marque », badge information sablier, heure | après envoi | envoye `.page-head` | E10.5-CA01 | E10.5-T01 |
| E10.5-S02 | Notice | C17 | Succès : envoyé, délai, e-mail | après envoi | `.notice--success` | E10.5-CA01 | E10.5-T01 |
| E10.5-S03 | La suite | C51 | Trois étapes numérotées | après envoi | `.steps-next` | E10.5-CA02 | E10.5-T01 |
| E10.5-S04 | Actions | C10, C11 | « Préparer une campagne en attendant », « Chercher des créateurs » | après envoi | `.actions` | E10.5-CA02 | E10.5-T01 |
| E10.6-S01 | En-tête | C02, C10 | `h1` et « Ce que voit un créateur » secondaire, œil | publié | profil `.page-head__row` | E10.6-CA01 | E10.6-T01 |
| E10.6-S02 | En-tête | C33, C13 | Pastille logo 32, nom, badge succès « Publié » | publié | `.row.g2` | E10.6-CA01 | E10.6-T01 |
| E10.6-S03 | Tâches | C06 | Lignes 1, 2, 3 : lien étiré, état à droite | publié | `.tasks li` | E10.6-CA02 | E10.6-T01 |
| E10.6-S04 | Tâches | C13 | « Complet » (coche), « À enrichir : {champ} », neutres | selon contenu | `.tstat` | E10.6-CA02 | E10.6-T01 |
| E10.6-S05 | Tâches | C06, C13 | Badge « Marque vérifiée », « À demander » ambre, phrase dessous | badge non demandé | `.tstat--todo`, `.sub` | E10.6-CA03 | E10.6-T02 |
| E10.6-S06 | Tâches | C06 | Badge demandé, en examen, refusé, accordé, à rafraîchir : non montrés | selon API | code `BrandVerificationBlock.tsx:60-95` | E10.6-CA03 | E10.6-T02 |
| E10.6-S07 | Aide | C18 | « Chaque ligne rouvre son étape seule… » 14 px | publié | dernier `p` | E10.6-CA02 | E10.6-T01 |
| E10.6-S08 | État | C17 | Modifications en validation, révision refusée, suspendu, refusé : non montrés | selon état | code `ProfileStateNotice.tsx` | E10.6-CA04 | E10.6-T03 |
| E10.7-S01 | Tête | C41 | `h1` « Modifier votre profil de marque », compteur « Étape n sur 3 », trois segments actifs | publié | modif-2 `#wz-title` | E10.7-CA01 | E10.7-T01 |
| E10.7-S02 | Tête | C41 | « Modification enregistrée au fil de la saisie » | publié | `#wz-time` | E10.7-CA01 | E10.7-T01 |
| E10.7-S03 | Tête | C13 | Ligne « Brouillon · personne d'autre… » (E10-Q15) | publié | `.wz-name` | E10.7-CA02 | E10.7-T01 |
| E10.7-S04 | Pied | C10 | « Revenir à mon profil », flèche ; ni Précédent ni reprise | publié | `#next` | E10.7-CA01 | E10.7-T01 |
| E10.7-S05 | Champs | C19 | Régime de validation et modification en attente par champ : non montrés | champ modéré | code `brand-profile-view.ts:497-520` | E10.7-CA03 | E10.6-T03 |

## 4. Textes
Clés : `apps/web/src/locales/{fr,en}/brand-profile.json`. EN absent : « à écrire (expert-marketing) ».
| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| E10.4-S02 | Vérifier et envoyer · Relisez votre profil. Un commercial INFLUX le relit avant de le publier, sous 1 jour ouvré. En attendant, vous pouvez déjà préparer une campagne. | à écrire | nouvelle |
| E10.4-S03 | Il manque {n} informations pour envoyer votre profil · Étape {n} — {champ} | à écrire | nouvelle (proche : `publish.missing`) |
| E10.4-S04, S06 | Ce que voit un créateur · Voir la page complète, comme un créateur | à écrire | nouvelle |
| E10.4-S07 | Logo · {fichier} ou pas encore ajouté (recommandé) · Nom · Pays · secteur · taille · Présentation · Site web (agents INFLUX) · — | `logo.label`, `fields.presentation.label` ; le reste à écrire | nouvelle sauf ces deux |
| E10.4-S08 | Thématiques · Réseaux et formats · Pays d'audience · Marchés · Langues de travail | Working languages ; le reste à écrire | `fields.workingLanguages.label` ; nouvelle |
| E10.4-S09 | Interlocuteur · interne · {prénom}, {fonction} · fonction à préciser | à écrire | nouvelle |
| E10.4-S10, S11 | À compléter : {champ} · Modifier | à écrire | nouvelle |
| E10.4-S12, S13 | Envoyer à INFLUX pour validation · Revenir à l'étape 3 · Vous pourrez modifier votre profil après sa publication, depuis « Mon profil de marque ». | à écrire | nouvelle (remplace `submit.label`) |
| E10.4-S14 | `submit.unavailable`, `submit.unsaved`, `submit.locked`, `submit.busy` | valeurs existantes | existantes |
| E10.5-S01 | Mon profil de marque · En cours de validation · envoyé aujourd'hui à {h} h {mm} | My brand profile · à écrire | `page.title` ; nouvelle (`state.pending_review` = « En attente de validation ») |
| E10.5-S02 | Votre profil est envoyé à INFLUX. Un commercial le relit sous 1 jour ouvré ; vous recevrez un e-mail à la publication ou s'il faut le corriger. | à écrire | nouvelle (`submit.done` diffère) |
| E10.5-S03 | La suite · Un commercial INFLUX relit votre profil : nom, logo, présentation, secteur. · Une fois publié, il est visible des créateurs, et vos campagnes peuvent être envoyées. · Vous pourrez ensuite demander le badge « Marque vérifiée ». | à écrire | nouvelle |
| E10.5-S04 | Préparer une campagne en attendant · Chercher des créateurs | à écrire | nouvelle |
| E10.6-S01, S02 | Mon profil de marque · Ce que voit un créateur · {marque} · Publié | My brand profile · à écrire · Published | `page.title` · nouvelle · `state.published` |
| E10.6-S03, S04 | 1. Votre marque · 2. Ce que vous cherchez · 3. Votre interlocuteur · Complet · À enrichir : {champ} | 3 : 3. Your contact person ; le reste à écrire | `section.contact` ; nouvelle |
| E10.6-S05 | Badge « Marque vérifiée » · À demander · Un agent INFLUX vérifie l'existence de la société. Le badge s'affiche sur votre page et sur vos campagnes. | à écrire | nouvelle (`verification.json` `brandBlock.*` diffère) |
| E10.6-S07 | Chaque ligne rouvre son étape seule ; vos modifications s'enregistrent au fil de la saisie. | à écrire | nouvelle |
| E10.7 | Modifier votre profil de marque · Modification enregistrée au fil de la saisie · Revenir à mon profil | à écrire | nouvelle |

## 5. Interactions, états, responsive, clavier
- E10.4 : comme E07.6 (E07b §5) ; annonce « Il manque n informations pour envoyer votre profil. » ; succès : « Profil envoyé à INFLUX. », focus `h1` de E10.5.
- E10.6 : ligne → E10.7 ; badge → `/compte/profil/marque-verifiee` (dans la maquette : « Demande du badge : écran non prototypé ici. »). « Ce que voit un créateur » → page marque (E05b), nouvel onglet.
- E10.7 : enregistrement au fil de la saisie ; « Revenir à mon profil » → E10.6, focus `h1`, annonce « Mon profil de marque. »
- États, tous non montrés, comportement actuel préservé (`ProfileStateNotice.tsx`, `brand-profile-view.ts:468-488`). Représentation proposée :
| État du profil | Écran | Représentation proposée |
|---|---|---|
| brouillon | E10.1 à E10.4 | montré |
| en attente, 1re fois | E10.6 | badge information, notice « Soumis le {date}… » ; lignes modifiables ; E10.5 une seule fois après envoi |
| publié avec modifications en attente | E10.6 | notice information `status.pendingWithPublished` sous l'identité |
| publié, modifications refusées | E10.6 | notice avertissement `status.revisionRefused` avec motif |
| refusé | E10.6 puis E10.7 | notice avertissement `status.rejected`, action « Corriger », envoi par E10.4 |
| refusé sans motif | idem | `statusText.rejectedReason` |
| suspendu | E10.6 lecture seule | notice neutre `statusText.suspended` ; lignes ouvertes en C07 ; aucun champ modifiable ; badge accessible |
- Chargement : C09 (titre, 4 lignes de 60) ; indisponible : C08 « Réessayer » (`page.unavailable`) ; hors ligne : C17.
- `AccountStateBlock` : la maquette montre « Profil : {état} » seul (et « Compléter mon profil » pour la marque neuve, E12) ; action « Soumettre mon profil » et nombre de manques non montrés : spécifiés en E01a (E01.0-S11 à S13), à suivre.
- Responsive : §2. Clavier : ligne entière cliquable, lien unique, anneau sur la ligne (`li:has(a:focus-visible)`). Animations : survol 120 ms.

## 6. Critères d'acceptation
- **E10.4-CA01** Compteur « Vérification », adresse propre, focus `h2`.
- **E10.4-CA02** Un seul résumé de manques, dans l'ordre du formulaire, liens vers le champ.
- **E10.4-CA03** La carte n'affiche ni interlocuteur ni coordonnée ; logo vide en pastille pointillée ; lien vers la page marque servie par l'API.
- **E10.4-CA04** Trois sections, valeur ou « À compléter » ; « Modifier » nommé par étape.
- **E10.4-CA05** Une action verte jamais désactivée ; un seul envoi ; échecs dits au-dessus des actions ; logo absent n'empêche pas l'envoi.
- **E10.5-CA01** Après succès : badge, heure, focus `h1`, annonce ; rechargement → E10.6.
- **E10.5-CA02** Liste ordonnée ; aucun bouton vert ; liens vers la création de campagne et la recherche.
- **E10.6-CA01** Publié, et seulement alors, sans notice d'état ; nom et logo validés, jamais la version en attente.
- **E10.6-CA02** Une ligne = un lien de 60 px min ; « À enrichir » nomme un champ facultatif vide, jamais un obligatoire.
- **E10.6-CA03** L'état du badge vient de `GET /v1/me/brand-verification`, en mots ; ni « solvabilité » ni « qualité » (`08` RG2).
- **E10.6-CA04** Les huit états de `noticeOf` ont chacun une phrase et un mot d'état.
- **E10.7-CA01** Une étape seule ; pied sans « Précédent » ; retour à E10.6.
- **E10.7-CA02** Aucun texte « Brouillon » sur un profil publié.
- **E10.7-CA03** Un champ modéré dit, avant et après la saisie, que la version publiée reste affichée.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E10.4-T01 | e2e, a11y | `apps/web/e2e/brand-profile.spec.ts` (« missing fields, autosave, reload, submission ») | manques, correction, envoi |
| E10.5-T01 | e2e, visuel | idem, `wizard-visual.spec.ts` (nouveau) | page envoyée, une seule fois |
| E10.6-T01 | e2e, a11y, visuel | `brand-profile.spec.ts` (« a published brand ») | liste de tâches, lien étiré |
| E10.6-T02 | e2e | `apps/web/e2e/verification-brand.spec.ts` | états du badge, accès au parcours |
| E10.6-T03 | e2e, unitaire | `brand-profile.spec.ts` (« refused then suspended », « published »), `tests/brand-profile-view.test.ts` | huit états, champs modérés |
| E10.7-T01 | e2e | `brand-profile.spec.ts` | modification, retour |

À conserver : `data-brand-verification`, `data-badge`, `data-reason`, `data-section="verification"` (à porter par la ligne badge), `copy.state.*`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| Colonne « Pour soumettre », barre | `BrandProfileScreen.tsx:268-284`, `:341-384` | E10.4 | supprimer |
| Notice d'état en tête | `:207` | E10.5, E10.6 | faire évoluer |
| Profil publié en formulaire | `:210-267` | E10.6, E10.7 | créer |
| Section Vérification | `:253-264`, `BrandVerificationBlock.tsx` | ligne de tâche | faire évoluer |
| Retour « Mon compte » | `:101-109` | absent de la maquette (E10-Q18) | à arbitrer |

Données requises : état, `submittedAt`, `underReview`, `refusal`, `pendingChanges`, `missingRequired` : servis. État du badge : servi. **Page marque vue par la marque elle-même** (E10.4-S06, E10.6-S01) : aucune route (seul `GET /v1/me/campaigns/:id/creator-view` sert une vue de marque, pour une campagne) → écart d'API, commun à E05b. **Valeurs validées** pour la carte : `creator-view` seulement → écart. Nom de fichier du logo : non servi. Hors lot : aucun.

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E10-Q14 | Six des huit états du profil non montrés durablement (en attente durable, révision en attente, révision refusée, refusé, refusé sans motif, suspendu) ; `17` §4.2 les impose | Écran incomplet | Table du §5 | expert-ux | oui |
| E10-Q15 | modif-2 (profil publié) affiche « Brouillon · personne d'autre que vous ne le voit avant la publication » | Texte faux | Badge « Publié » et règle de validation | expert-ux | oui |
| E10-Q16 | E10.7 : « Modification enregistrée au fil de la saisie » ; `06` RG9 : nom, logo, présentation, site, fonction, secteur partent en validation | Promesse incomplète | Ajouter `review.regime` sous ces champs | product-owner | non |
| E10-Q17 | « Ce que voit un créateur » et « Voir la page complète » : aucune route pour la marque ; RG102 n'existe que pour la campagne | Lien sans cible | Route `GET /v1/me/brand-profile/creator-view` et page E05b en mode aperçu | architecte | oui |
| E10-Q18 | Pas de retour « ‹ Compte » au-dessus du titre sous 1 024 px ; D74 (SN-A) l'impose | Navigation téléphone | Garder le retour sous 1 024 px | expert-ux | non |
| E10-Q19 | Badge : « vérifie l'existence de la société » ; texte `brandBlock.affirms` : domaine **et** immatriculation (`08` RG2), libellés D34 ouverts | Texte juridique | Garder les libellés actuels du badge | expert-conformite-rgpd | non |
| E10-Q20 | Badge demandable avant publication (`brandBlock.optional`) ; maquette : « ensuite », et seulement en E10.6 | Parcours retiré du brouillon | Ligne badge aussi visible avant publication | product-owner | non |
| E10-Q21 | « En cours de validation » contre `state.pending_review` « En attente de validation » | Deux mots pour un état | Un seul libellé partout | product-owner | non |
| E10-Q22 | « sous 1 jour ouvré » en dur (`06` RG7) ; « Complet » et « À enrichir » non définis par une règle ; récapitulatif sans les facultatifs | Calcul à inventer | « À enrichir » = premier facultatif vide de l'étape | product-owner | non |
| E10-Q23 | Heure « aujourd'hui à » : fuseau non dit ; X11 | i18n | Fuseau du navigateur | expert-ux | non |
