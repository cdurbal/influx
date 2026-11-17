# L3C-U — constats `expert-ux` (sans commit)
Revue du 2026-11-15, lignes 08-10 `fait`. Lu : code des écrans, `fr.ts` (`campaignQueue`, `campaignReview`,
`campaignRecord`), `campaign.json` FR/EN, trois specs e2e, `17b` §3.8, `17` §4.9, `09` RG109-110. Pas de
capture dans `test-results` : revue sur code et specs. Tokens : aucune valeur en dur, aucune couleur nouvelle.

**Décompte : bloquant 0 · jalon 0 · avant production 12 · plus tard 8.**

## Ce qui tient
- **Décision en 10 s** : ordre = `17b` §3.8 ; deux boutons ; responsable obligatoire, « moi » par défaut ;
  récapitulatif avant toute décision, ‹v›/‹r› ne décident jamais seuls.
- **Deux temps** : mots « examen / examinateur / transmettre », jamais « valider / confirmer » (réservés à
  `17b` §4.5) ; « Transmettre au 2ᵉ examinateur », jamais « Publier » ; avis rendu au seul détenteur.
- **RG95** : « Information, pas un refus. », rien n'est bloqué.
- **Clôture irréversible dite avant le geste** : BO (`fr.ts` 3846-3851) et marque (`closeWarning`, bouton `danger`).
- **Six états écrits** côté marque (badge + phrase, FR/EN en parité) ; chargement, vide, erreur présents.
- **Correction** : valeur actuelle, motif fermé obligatoire, e-mail qui nomme champ et motif.
- **D74** : file 7 = 8ᵉ page de « Files ». **WCAG** : étiquettes, `fieldset/legend`, `aria-invalid`, axe côté marque.

## Bloquant
Aucun.

## Jalon
Aucun. L3CU-1, -4 et -5 ont été examinés pour ce classement : récupérables, signalés par le texte, sans
effet sur la lisibilité d'une décision ni sur la confidentialité ; à traiter avant production.

## Avant production

**L3CU-1 — Fiche campagne sans porte d'entrée (EC-L3C-09-1 à -4).** `campaign-record-view.ts` l. 48 :
`recordHref` n'est lié que depuis `AccountCampaignsBlock.tsx` l. 139 (après une création). Ni liste des
campagnes d'une marque, ni lien depuis `CampaignReviewEntryScreen`, ni nav : correction, pause, reprise,
clôture d'agent ne s'atteignent que par URL ; le « [· Corriger un champ] » du wireframe `17b` §3.8 manque
sous le brief ; `fr.ts` 3854 « Campagnes de la marque » ne contient qu'un formulaire. Pas « jalon » : écrans
fonctionnels et testés, c'est la navigation qui manque. À fermer en tête : lien « Fiche de la campagne » sur
l'écran de décision, liste sous le formulaire, titre « Créer une campagne ».

**L3CU-2 — « Aucune alerte » contredit le doublon.** `CampaignReviewBlocks.tsx` l. 130-131 (`fr.ts` 3508)
écrit « Aucune alerte sur cette campagne. » alors que le bloc ① (l. 62-77) porte la ligne de doublon quand
seul `duplicateOf` existe ; idem sur la fiche. Correctif : « Aucune alerte de texte. » ; icône ambrée du
drapeau RG95 à passer en icône d'information.

**L3CU-3 — L'agent ne lit pas ce que la marque reçoit d'une intervention.** `CampaignActReason.tsx`
l. 47-65, `fr.ts` 3787-3799 : seul « informée par e-mail, en français » est dit ; l'e-mail ajoute une phrase
par motif (`api/locales/fr/email.json` l. 280-285 : « Elle corrige une erreur de saisie. »), y compris pour
une pause ou une clôture, où elle se lit mal. Le refus montre déjà « Message envoyé à la marque » (RG115).
Correctif : même aperçu par motif et par acte, phrases réécrites par acte.

**L3CU-4 — Confirmation de clôture BO sans signal sur le geste.** `CampaignRecordPanels.tsx` l. 403 (phrase
en texte simple) et l. 413-419 (bouton `SMALL_PRIMARY` « Confirmer la clôture », identique à la pause) ; côté
marque le bouton est `danger`. La phrase précède le geste (critère tenu), Entrée sur un motif coché soumet.
Correctif : bandeau d'alerte et bouton « Clore définitivement » en style destructif (token existant).

**L3CU-5 — Focus perdu à la fermeture d'un panneau de la fiche.** `CampaignRecordPanels.tsx` l. 42-63 : le
commentaire promet « ‹Échap› hands it back », rien ne rend le focus ; `CampaignRecordActions.tsx` l. 99, 117,
161, 174 démontent le panneau (succès, Annuler, Échap) : focus sur `body`. Côté marque il est géré. Pas
« jalon » : le `role="status"` reste lu, patron identique aux files livrées. Correctif : refocaliser le
bouton d'origine ou la note de succès.

**L3CU-6 — « Non modifiable » faux pour pause et clôture.** `CampaignFormScreen.tsx` l. 279, `campaign.json`
l. 131 FR/EN : « en cours d'examen ou déjà publiée » sous l'état « Clôturée » ; la pause est dite deux fois
(`StatusLine` et `lifecycle.paused`). Correctif : une phrase par état.

**L3CU-7 — « L'aide de l'écran de connexion » dite à une marque connectée.** `campaign.json` l. 97
(`refusal.contact`) et l. 121 (`pausedByInflux`), FR/EN : valable en e-mail, faux dans l'espace. Correctif :
« contactez votre commercial INFLUX ».

**L3CU-8 — « Reprendre » sur une pause d'INFLUX (EC-L3C-10-4).** `CampaignLifecyclePanel.tsx` l. 169-178 et
`lifecycle.paused` FR l. 102 (« Reprenez-la quand vous voulez ») mènent à un échec certain, ensuite bien
expliqué. Correctif : servir l'origine de la pause, masquer « Reprendre », dire « mise en pause par INFLUX ».

**L3CU-9 — Vocabulaire de la clôture.** BO : « close » (`fr.ts` 3486), « Close » (3718, lu comme un verbe),
« Clore » (3780) ; marque : « Clôturée / Clôturer ». Correctif : « clôturée / Clôturer » partout.

**L3CU-10 — Tranche sans devise (EC-L3C-08-1).** `campaign-review-view.ts` l. 164-169, `fr.ts` 3490-3502 :
« 100 à 250 » sans devise, alors que le budget est jugé (« Budget incohérent »). Principe 4 : devise
toujours ; D78 exclut les montants, pas la devise. Correctif : servir le code de devise, l'afficher.

**L3CU-11 — File bloquée AL4 non dessinée (EC-L3C-08-2).** `15` l. 331, `17b` l. 259 : deux états vides
distincts (pictogramme + texte) ; la file 7 n'a que le vide. À livrer avec la supervision AL4.

**L3CU-12 — Marque suspendue connue après le 409 (EC-L3C-08-5).** `CampaignReviewEntryScreen.tsx` l. 141-147,
196-198 ; `17b` l. 1290 veut le bandeau dès l'examen. Correctif : porter la publiabilité de la marque dans
l'ouverture de l'entrée.

## Plus tard
- **L3CU-13** BO en français seul (EC-L3C-08-3, D36, Lot 5).
- **L3CU-14** Avis saisi non rappelé au récapitulatif de transmission (EC-L3C-08-7) ; EC-L3C-08-4 et -6 non
  décrits dans la demande, non classés.
- **L3CU-15** Bloc ② : 22 lignes dont des « non renseigné » sans objet (`campaign-review-view.ts` l. 243-291).
- **L3CU-16** Specs marque : clôture et pause à 1 440 px seulement, liste FR seule à 375 ; ajouter 375 EN.
- **L3CU-17** « Ouvrir l'entrée dans la file » (`fr.ts` 3710) prend l'entrée 30 min sans le dire, contrairement
  à `correct.openEntry` (3831).
- **L3CU-18** « Reprendre » : continuer un brouillon (liste) et reprendre une pause (cycle de vie).
- **L3CU-19** « Publier » `aria-disabled` sans `aria-describedby` vers le bandeau (`CampaignReviewDecision.tsx`
  l. 169) ; introduction des alertes après la liste (`CampaignReviewBlocks.tsx` l. 143).
- **L3CU-20** Aucune trace in-app d'une correction d'agent côté marque (e-mail seul) ; à prévoir au Lot 4.
