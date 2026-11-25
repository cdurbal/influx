# L3B-U — constats `expert-ux` (lignes 09 à 11, sans commit)
Lu : fiche, `17` l. 131, 315-325, 788-865, `09` l. 483-504, 855-893, `20` §11.8, `components/campaign/`, `locales/{fr,en}/campaign.json`, `e2e/brand-campaign.spec.ts`. E2e et captures non rejoués : constats tirés du code, des textes et des assertions.
**Conforme :** tokens seuls (aucune valeur en dur) ; D74 (ni pilule ni onglet, étapes en liste latérale, `‹ Mes campagnes` au-dessus du `h1`) ; cinq étapes libres, focus au `h2` ; aucun champ fichier, `verified_only` absent ; étape 4 en trois cartes (publié, « Interne — jamais publié », « Ce que voit un créateur »), aide `bandBrand` avant la saisie, aucun montant ni taux côté créateur ; états écrits (CA74) ; FR/EN de même structure (449 lignes).

Bilan : 0 bloquant · 4 jalon · 12 avant production · 4 plus tard.

## Jalon
**L3BU-1 · jalon · Le retour de l'aperçu ramène à l'étape 1.** `CampaignPreviewScreen.tsx` l. 80-89 : lien = `memberPageHref("advertiserCampaign", locale, id)` sans `?step=` ; l'étape ne vit que par `replaceState` (`CampaignFormScreen.tsx` l. 210-213). Scénario : étape 4, « Voir ce que voit un créateur », retour : étape 1 (depuis la liste : le formulaire, pas la liste). Rompt la navigation libre (`17` l. 848), visible dès F2. Correctif : l'aperçu reçoit son origine (`?from=list` ou `?from=4`) et le retour la reprend, ou `router.back()` avec repli ; e2e d'aller-retour depuis l'étape 4.

**L3BU-2 · jalon · « Au total » sur l'étape 4, alors que le champ est une tranche par créateur.** `fr/campaign.json` l. 108 « Combien payez-vous au total ? », `en` l. 108. Le champ est `budgetBand` et le budget total n'est pas saisi. Scénario : trois créateurs, 6 000 EUR de budget, la marque choisit « 5 000 à 10 000 » : tranche fausse. Principe 4 (ambiguïté), critère de rejet. Correctif, clé `form.steps.4.question` : « Combien payez-vous par créateur, commission INFLUX incluse ? » / « How much do you pay per creator, INFLUX commission included? » ; aucun montant ni taux. Valider avec `expert-paiement-facturation`.

**L3BU-3 · jalon · Pas de barre collante sur téléphone.** `CampaignFormScreen.tsx` l. 303-330 : « Soumettre » arrive après toute l'étape ; `17` l. 839-841 veut un bouton principal collant à 375 px, et le profil de marque a déjà le gabarit (`BrandProfileScreen.tsx` l. 269, `ACTION_BAR_CLASSES`, au-dessus de la barre du bas, `lg:hidden`). Scénario : étape 1 à 375 px, défilement complet pour soumettre, enregistrement invisible. Ruling EC-L3B-10 : le panneau et sa liste restent dans le flux, sous la navigation d'étape. Correctif : sous `lg`, barre collante = `SaveStatus` + « Soumettre ma campagne » (même `submit()`), « Étape suivante » reste dans le flux ; e2e 375 : bouton visible sans défilement.

**L3BU-4 · jalon · Soumettre avec un champ refusé : aucun repère.** `use-campaign.ts` l. 335-338 : `unsavedInError` non vide, état `invalid`, retour `stopped`, pas de focus ; `CampaignSubmitPanel.tsx` l. 181-182 : « Corrigez d'abord les champs signalés dans les étapes », sans nom ni lien. Scénario : dates en désordre à l'étape 5, soumission depuis l'étape 2. Contredit RG110 (focus au premier invalide) et `17` l. 860. Correctif : `SubmitOutcome` gagne `{kind:"invalid", step, key}` (premier de `unsavedInError`, étape par `STEP_OF_KEY`), le panneau appelle `onGoTo` et nomme les champs, un lien chacun ; e2e : date refusée, soumission depuis l'étape 2.

## Avant production
- **L3BU-5** Refus sans motif (EC-09-4) : `status.rejected` (`fr` l. 76) n'a pas `{reason}` (RG109) ; état inatteignable avant L3C, mais « À corriger » sans motif ne se corrige pas : L3C sert le motif (RG90), liste et formulaire l'affichent.
- **L3BU-6** Succès sans délai ni suite (EC-10-2) : `Submitted()` (`CampaignFormScreen.tsx` l. 351-373) ne dit pas comment la marque sera prévenue ; aucun chiffre codé : délai lu du paramètre (RG6, Q9), « vous serez prévenu par e-mail » quand L3C l'envoie.
- **L3BU-7** Quatre messages pour un état : `Submitted` et `StatusLine` répètent `status.pending`, `form.locked` (« en cours d'examen ou déjà publiée ») s'ajoute ; masquer `form.locked` quand `Submitted` est là.
- **L3BU-8** Aperçu périmé possible (EC-11-1) : `use-campaign.ts` l. 424-432 envoie l'enregistrement au démontage, l'aperçu lit aussitôt `creator-view` ; la requête peut passer avant l'écriture, un refus ou un 409 est muet. Le lien attend `runSave()` (exposer `settle()`), ou l'aperçu relit au retour de focus.
- **L3BU-9** Deux boutons principaux voisins (`Étape suivante`, `Soumettre`, l. 311-324) : « Soumettre » secondaire tant qu'il manque quelque chose, principal sinon et à l'étape 5.
- **L3BU-10** Effacement muet : changer devise ou nature vide la tranche (et la valeur du produit, étape 1) (`campaign-view.ts` l. 244-245, 274-278) ; dire en `role="status"` « La tranche a été effacée : choisissez-la à nouveau ».
- **L3BU-11** Impasse sur la liste : profil `none` ou `unavailable`, ni « Créer » ni phrase (`CampaignListScreen.tsx` l. 99-111) ; ajouter « Réessayer » ou `profileRequired`.
- **L3BU-12** Lien sans effet : `budgetBand` est `disabled` sans devise (`CampaignBudgetFields.tsx` l. 129), `focus()` ne fait rien ; la liste suit l'ordre du domaine (`required.ts` l. 54-57), pas celui de l'écran. Replier le focus sur la devise.
- **L3BU-13** `datesOrder` tronquée : « Date limite de candidature doit précéder début de la période de publication. » (`campaign-field-texts.ts` l. 41-44) ; noms courts avec article, FR et EN.
- **L3BU-14** Mots : « Rémunération : Rémunération en numéraire » ; EN « compensation » au formulaire, « remuneration » à l'aperçu (`en` l. 124, 150, 179, 319) : un seul terme.
- **L3BU-15** Nom accessible doublé : « Retour à Retour à la campagne » (`CampaignPreviewScreen.tsx` l. 85-87, `form.backPrefix` + `preview.back`).
- **L3BU-16** Enregistrement automatique hors de vue sur poste de travail : `SaveStatus` sous le panneau (`CampaignFormScreen.tsx` l. 325-329) ; le mettre dans la carte latérale collante (`17` l. 806).

## Plus tard
- **L3BU-17** `publish.missing` (`CampaignSubmitPanel.tsx` l. 89-93) énumère jusqu'à une quinzaine de champs dès un brouillon vierge : nombre seul avant la première soumission.
- **L3BU-18** Budget total non saisi (EC-10-1) : accepté (T16.6) ; `internalPilot` dit « Votre budget » alors que seule la tranche est déclarée ; préciser ou réactiver avec T16.6.
- **L3BU-19** Axe : aucune passe sur les étapes 2 et 5, l'étape 4 à 375 px ou en anglais, ni le succès de soumission.
- **L3BU-20** Mineurs : dates natives au format du navigateur, non de la langue (principe 9) ; « Enregistrer et quitter » absent (l'autosave suffit) ; « Étape n sur 5 » sans barre ; aperçu sans lien vers le profil si non publié.

## À valider par le fondateur
Aucune couleur ni token neuf. L3BU-2 touche une microcopie de montant.
