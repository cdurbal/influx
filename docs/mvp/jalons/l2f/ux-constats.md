# L2F-U — Constats `expert-ux`

> `expert-ux`, 2026-11-10. Skill `design-system-influx`. Aucun commit, aucun code. Périmètre : lignes 17 à 21 (commits `5aeaa31`, `68a7f19`, `3fd41fb`, `c9aa3cc`, `c7c8300`). Lu : `ux.md`, fiche § Invariants 15 et 16, `modele.md`, `textes.md`, `20` §11 (charte KEO, contrastes), `08` l. 705-724, `17` l. 1458-1466, `recette.md` § D83, et le code des écrans.
> **Méthode et limite.** Revue statique du code et des fichiers de traduction ; aucun rendu n'a été lancé. Les trois largeurs sont raisonnées d'après les classes et les gabarits (375 : web seul, le backoffice y est limité par D58 ; 768 et 1440 : web et backoffice). Ce qui demande une mesure au navigateur est marqué « non mesuré ».

## Récapitulatif

| Gravité | Nombre | Constats |
|---|---|---|
| **Bloquant** | **1** | L2FU-1 |
| Jalon | 5 | L2FU-2 à L2FU-6 |
| Avant production | 9 | L2FU-7 à L2FU-15 |
| Plus tard | 9 | L2FU-16 à L2FU-24 |
| **Total** | **24** | |

**Il y a un bloquant : L2FU-1.** Le parcours D83 « un créateur connu reçoit le code, le colle, l'agent accorde » (`recette.md` l. 5) ne peut pas s'accomplir à l'écran : le créateur n'a aucun endroit où lire le code d'une demande ouverte par un agent. `/jalon-run` ajoute une ligne `fix`.

## Ce qui tient (vérifié)

- **Textes mot pour mot.** `verif.badge.toRefresh`, `verif.badge.toReconfirm`, `verif.expiry.toRefresh`, `verif.revoked.notice`, `verif.dispute.open` (rendu par `appeal.window` à 30 jours) : FR et EN identiques à `08` l. 708-723 et `17` l. 1465 (`verification.json` l. 18, 19, 44, 52, 106).
- **Jamais la couleur seule.** Web : `BadgeLine.tsx` l. 60-66 écrit le libellé dans une `Notice` d'alerte (icône triangle) ; `BrandBadgeLine.tsx` l. 35-41 idem ; retrait en `ErrorNotice` (icône). Backoffice : l'état est un mot (`accountBadges.state`), `ErrorNotice` porte une icône, la bannière « CONTRÔLE AFFAIBLI » est écrite et encadrée en trait épais.
- **Tokens.** Aucune valeur de couleur, `rgba`, taille ou classe arbitraire dans les écrans revus ; aucun stockage navigateur (le texte de la contestation n'est conservé qu'en mémoire d'écran). **Aucune couleur nouvelle à faire valider** : tout passe par des tokens KEO existants.
- **Tout se passe dans INFLUX.** Contestation sans pièce jointe, sans coordonnée (`appeal.form.textHelp`, `directContact`), reprise d'une nouvelle pièce par une nouvelle demande. Aucun montant, taux ni net (D48, D78).
- **Quatre états** présents sur la contestation (chargement, indisponible avec « Réessayer », décision disparue `appeal.gone`, succès avec suivi), sur le bloc badges, le bloc « Lancer la vérification » et les sources.
- **Raccourcis (RG98).** `v` = issue favorable au membre, `r` = issue défavorable, dans les files 4, 5 et 6 : la mémoire musculaire tient d'une file à l'autre.
- **Parité FR/EN** du web sur toute la plage relue ; backoffice FR seul (D36).

## Constats

### Bloquant

**L2FU-1 — Bloquant — un créateur dont la vérification est lancée par un agent ne peut pas lire son code.**
`verification-view.ts:363-365` (`requested` → étape `confirm`), `:393-396` (`ownershipActionOf` renvoie `null` pour `requested`), `OwnershipScreen.tsx:491-527` (`ConfirmStep` n'affiche jamais `request.code`), `VerificationLineState.tsx:118-157` (aucun bouton), `verification.json:38` (`verif.request.pending` : « Votre demande est en cours d'examen »), `:80` (`line.cta.see` existe et n'est utilisé nulle part).
La demande d'un agent est `pending` aussitôt, code émis (`modele.md` §6). Le créateur reçoit l'e-mail « Retrouvez dans votre espace INFLUX le code à publier » (`textes.md` l. 37), ouvre son profil et lit « Demande en cours depuis le {date} » et « Nous répondons sous 1 jour ouvré », sans bouton ni code ; le code ne s'affiche qu'à l'étape `code` d'un brouillon (`OwnershipScreen.tsx:358-393`). Sans code publié, l'agent ne peut que refuser, ou laisser expirer. Le web ne connaît pas l'origine de la demande (`openedBy` absent de `apps/web`), et le texte « vous avez demandé » est faux pour le créateur invité. Même schéma côté marque pour le repli `TXT` (`BrandVerificationScreen.tsx:398, 438`) ; la marque connectée sur son domaine n'a aucun geste, c'est voulu.
**Correctif :** afficher, pour toute demande `requested` portant un code vivant, le bloc « code + Copier + valable jusqu'au » de l'étape `code` dans l'étape `confirm`, et rendre l'action `see` (« Voir la demande », clé existante) depuis la ligne du profil.
Microcopie proposée, à écrire seulement si le contrat porte l'origine : FR « Votre commercial INFLUX a lancé cette vérification. Publiez ce code dans la biographie de votre compte {network} ; nous le constatons nous-mêmes. » · EN "Your INFLUX salesperson started this verification. Paste this code into your {network} bio; we check it ourselves." À défaut d'origine, garder le texte neutre existant (`ownership.confirm.keepCode`) et ajouter seulement le code.

### Jalon

**L2FU-2 — Jalon — le rappel J-15 promet un geste que l'écran n'offre pas.**
`verification-view.ts:562-564` (badge `active` : aucune action), `verification.json:410` et `:511` (« Vous pourrez alors déposer une capture récente »), contre `verif.expiry.reminder` (`08` l. 719, mot pour mot en e-mail : « Déposez une capture récente pour la conserver ») et `modele.md` §3 (ouvrable sur un `active` dans la fenêtre de rappel).
Le créateur lit l'e-mail, ouvre son espace, et ne trouve ni bouton ni explication avant l'expiration. L'écran ne peut pas calculer la fenêtre (règle en base) : il faut que l'API la serve.
**Correctif :** servir un drapeau `renewable` (fenêtre de rappel) sur `OwnBadge` et offrir « Rafraîchir mon audience » / « Rafraîchir le badge » dès cet instant, en remplaçant « Vous pourrez alors » par « Vous pouvez dès maintenant ».

**L2FU-3 — Jalon — les erreurs de champ des sources de registre ne sont ni annoncées ni liées au champ (WCAG 3.3.1, 4.1.3).**
`RegistrySourceAdder.tsx:171-173, 195-197, 214-216, 239-241, 260-262` et `RegistrySourceEditor.tsx:159, 184, 205` : `ErrorNotice announce={false}` sans `id`, et `aria-describedby` ne pointe que l'aide. Le champ reçoit le focus avec `aria-invalid`, mais un lecteur d'écran n'entend pas le message.
**Correctif :** donner un `id` à chaque `ErrorNotice` et l'ajouter à `aria-describedby` du champ, comme `DisputeEntryScreen.tsx:247-259`.

**L2FU-4 — Jalon — le focus se perd à l'étape de relecture des sources (WCAG 2.4.3).**
`RegistrySourceAdder.tsx:285-298` : le bouton « Voir la source à ajouter » est remplacé dans le DOM par le panneau de relecture, donc le focus tombe sur `body` ; même chose au retour « Corriger » (`:349-358`). `RegistrySourceEditor.tsx:102, 235-250` : même mécanisme.
**Correctif :** à l'apparition du panneau, donner le focus à son titre (`tabIndex={-1}`), et au retour au premier champ en erreur ou au bouton de relecture.

**L2FU-5 — Jalon — la file 5 renvoie l'agent vers des gestes qu'elle n'offre pas.**
`fr.ts:2683-2684` (`handleMismatch` : « s'il diffère, exigez une nouvelle preuve ») est partagé avec la file 5 (`claimedReview`), dont l'écran ne propose que « Infirmer » et « Confirmer la décision » (`DisputeEntryScreen.tsx:293-331`) ; la preuve ne s'exige qu'en file 6. Par ailleurs `fr.ts:2672, 2680, 2682` disent « le motif « nouvelle demande » » alors que l'option s'intitule « Sans suite en l'état : nouvelle demande à déposer » (`fr.ts:2798`).
**Correctif :** séparer le message par file (en file 5 : « confirmez la décision avec le motif « Sans suite en l'état » ») et citer l'intitulé exact de l'option.

**L2FU-6 — Jalon — sur l'écran des sources, l'ajout et la modification peuvent s'ouvrir ensemble.**
`RegistrySourcesScreen.tsx:296-299` : le bouton « Modifier » du tableau des sources actives ne fait pas `setAdding(false)`, contrairement à `:285-290` ; deux formulaires s'affichent alors, avec deux focus initiaux concurrents. Même fichier `:80-82` : le tableau des sources actives n'a pas de `empty`, d'où un `<p>` vide si la liste se vide.
**Correctif :** appeler `setAdding(false)` dans les deux `onEdit` et passer un texte d'état vide au tableau des sources actives.

### Avant production

**L2FU-7 — Avant production — après expiration ou retrait, la ligne redit « jamais vérifié » et ne laisse aucune trace.**
Créateur : après expiration, `verification.json:71` (« Pas encore vérifiée. ») alors que `verif.expiry.removed` (`:46`, « Vos chiffres sont de nouveau affichés comme déclarés ») n'est utilisé nulle part (EC-L2F-17-2) ; après un retrait dont le délai de contestation est clos ou la contestation déposée, `DisputeNotice.tsx:239-243` ne montre plus rien. Marque : `BrandVerificationBlock.tsx:64-70` et `verification.json:415` écrivent « non demandé » pour un badge expiré ou retiré, sans motif ni excuses (`influx_error`), alors que l'e-mail promet de redemander « depuis votre espace INFLUX ».
**Correctif :** faire servir par l'API la fin du dernier badge de la ligne (cause, date, code de motif) et écrire « Badge « {badge} » expiré le {date}. {motif} » (FR) · "\"{badge}\" badge expired on {date}. {reason}" (EN), avec l'action de redépôt à côté.

**L2FU-8 — Avant production — impasse d'une audience « à rafraîchir » dont le compte est « à reconfirmer ».**
`verification-view.ts:556-561` renvoie `null` (propriété non établie) avant d'examiner `to_refresh` ; `VerificationLineState.tsx:169-173` ne dit rien puisque le badge est affiché. Le créateur voit « à rafraîchir », sans bouton et sans raison. Si l'audience est elle-même `to_reconfirm`, la ligne dit « L'audience se vérifie une fois la propriété du compte constatée » comme si elle n'avait jamais été vérifiée.
**Correctif :** quand la propriété est à reconfirmer, ajouter sous l'audience « Reconfirmez d'abord votre compte {network} : l'audience reprendra ensuite. » · "Reconfirm your {network} account first: your audience follows."

**L2FU-9 — Avant production — le délai de contestation affiché sur la ligne ne dit pas jusqu'à quand.**
`DisputeNotice.tsx:101-103, 111-118` écrit « pendant 30 jours » sans date (`decision.closesAt` est servi) ; le formulaire répète deux fois la même idée (`AppealScreen.tsx:280-285`). Un créateur qui revient au jour 29 relit « 30 jours ».
**Correctif :** sur la ligne, écrire « Vous pouvez contester cette décision jusqu'au {date} » (`appeal.until`), et au formulaire fusionner les deux phrases en une.

**L2FU-10 — Avant production — le suivi d'une contestation ne rappelle pas la décision contestée.**
`AppealScreen.tsx:348-407` (`Tracking`) n'écrit ni le réseau, ni la date, ni le motif de la décision (le composant `About`, l. 213-235, n'est monté que dans le formulaire). Avec Instagram et TikTok, « le badge « Compte vérifié » » est ambigu.
**Correctif :** monter une ligne `appeal.about.*` sous le titre du suivi, avec réseau et date de la décision.

**L2FU-11 — Avant production — EC-L2F-17-1 : la phrase d'issue d'un retrait maintenu est incomplète.**
`dispute-view.ts:243-245, 285-287` et `verification.json:152` (`decision_confirmedBare` : « Après réexamen, la décision est maintenue. ») ; `badge-notice-email.ts:212-218` nomme au contraire le motif dans l'e-mail. Les deux canaux disent donc deux choses, et `08` RG77 exige « l'issue notifiée avec un motif ». Retenu en « avant production » parce que l'e-mail porte le motif et que D34 fait relire les libellés avant `production`.
**Correctif :** servir le code du motif du retrait sur la contestation (migration) pour rendre `decision_confirmed` entier ; à défaut, remplacer la phrase nue par « Après réexamen, la décision est maintenue pour le motif indiqué dans votre e-mail de retrait. » · "After review, the decision stands for the reason given in your removal e-mail."

**L2FU-12 — Avant production — « Réversible : non » contredit la contestation, et dit deux choses selon l'écran.**
`DualControlScreens.tsx:475-477` + `fr.ts:938` (« Réversible : non. Cette action ne s'annule pas. ») pour `verification.revoke_badge`, alors que la même liste annonce « le créateur peut contester le retrait » (`fr.ts:994-995`) et que `overturn_revocation` rend le badge ; l'écran de demande dit autrement (`fr.ts:753-754`, « ne s'annule pas depuis le backoffice »).
**Correctif :** pour cette action, écrire un seul texte aux deux endroits : « Non annulable depuis le backoffice. Un créateur peut contester ; si la contestation aboutit, le badge est rendu. »

**L2FU-13 — Avant production — l'aperçu « Le membre recevra cette phrase » est incomplet.**
`AccountBadgesBlock.tsx:169-176` n'affiche que la phrase du motif ; le message de l'agent (champ l. 152-168, exigé pour `terms_breach`) et, pour un créateur, la phrase de contestation sur 30 jours (`textes.md` l. 33) ne sont pas montrés. L'écran 2V montre bien le message (`DualControlScreens.tsx:153-155`) mais pas la phrase du motif.
**Correctif :** composer l'aperçu avec la phrase, puis le message tapé, puis la phrase de contestation (créateur), et reprendre la phrase du motif dans le bloc cible de l'écran 2V.

**L2FU-14 — Avant production — le compte à rebours de l'écran 2V est annoncé chaque seconde.**
`DualControlScreens.tsx:516-518` : `aria-live="polite"` sur un texte qui change à chaque tick ; un lecteur d'écran lit en continu pendant 60 s.
**Correctif :** retirer `aria-live` du compteur et ne l'annoncer qu'à l'échéance (« Confirmation possible. »).

**L2FU-15 — Avant production — une demande ouverte par un agent ne dit ni lequel ni quand.**
`verification-opening-view.ts:23-33` et `fr.ts:2069-2070` (« Ouverte par l'équipe INFLUX »), colonne « Ouverte par » : `fr.ts:1626-1629` (« l'équipe »). Le second regard a posteriori (Q3, `modele.md` §6) et la règle « chaque saisie dit qui et quand » demandent un nom et une date, internes.
**Correctif :** ajouter au dossier « Ouverte par {prénom} le {date} » (valeurs déjà au registre `opened_by_agent`) et un filtre « Ouverte par : l'équipe ».

### Plus tard

**L2FU-16 — Plus tard — colonne « État » et saisie libre du code d'État.** `fr.ts:2948, 2974` : « État » désigne une subdivision (province, région) pour tous les pays et se confond avec « Statut » ou l'« État » d'un objet ailleurs ; EC-L2F-21-1 saisit le code à la main (trois messages d'erreur). **Correctif :** renommer « État ou province » et, quand une route servira les subdivisions, remplacer le champ par une liste filtrée par pays.

**L2FU-17 — Plus tard — aucune touche affichée sur les boutons des files 5 et 6, et le bouton « Infirmer » est le seul plein.** `DisputeEntryScreen.tsx:299-330` (`aria-keyshortcuts` sans `KeyHint`, contrairement à `ReviewDecision.tsx:132, 144`), `:309-313` (primaire = infirmer). **Correctif :** afficher ‹v› et ‹r› sur les boutons, et donner aux deux issues le même poids visuel (file 6 à vérifier de même).

**L2FU-18 — Plus tard — le texte du créateur est le huitième champ de la contestation.** `DisputeDossierBlocks.tsx:39-133` : pays, langue, responsable, réseau passent avant le motif et le texte. **Correctif :** placer « Motif du membre » et « Texte du membre » en tête du bloc.

**L2FU-19 — Plus tard — onze et douze colonnes dans les listes (non mesuré).** `DisputeQueueScreen.tsx:53-85`, `VerificationQueueScreens.tsx:59-95` : « Déposée le » et « Ancienneté » disent presque la même chose ; à 1440 le nom risque de défiler hors champ. **Correctif :** retirer « Ancienneté » (le SLA la porte) ou épingler la colonne nom.

**L2FU-20 — Plus tard — le texte de reconfirmation parle d'« espace INFLUX » à quelqu'un qui s'y trouve.** `verification.json:49` (repris de l'e-mail) ; « identifiant » (`:19`, `:49`) contre « pseudo » (`:68`). **Correctif :** sur l'écran : « Vous avez modifié l'identifiant de votre compte {network}. Pour conserver votre badge, refaites la preuve de propriété. » · "You changed the handle of your {network} account. To keep your badge, prove ownership again." ; choisir « pseudo » partout côté créateur.

**L2FU-21 — Plus tard — un retrait « erreur d'INFLUX » est dessiné comme une erreur du membre.** `DisputeNotice.tsx:121` (`ErrorNotice` rouge pour tous les motifs), `verification.json:52` + `:91-97` (« retiré : Une pièce… », majuscule après deux-points). **Correctif :** `Notice` d'alerte pour `influx_error`, et libellés de motif écrits pour suivre « : ».

**L2FU-22 — Plus tard — « (D54) » dans une option visible, et commentaire sans compteur.** `fr.ts:803` (repris de `textes.md` l. 25) ; `AccountOpeningBlock.tsx:218` (`maxLength` + 200, la limite n'apparaît qu'en erreur). **Correctif :** « Invité par l'agent » et « 1 000 caractères au plus » sous le champ.

**L2FU-23 — Plus tard — la fiche de compte est une page longue sans repères.** `AccountScreen.tsx:795-799` : deux blocs de plus (badges, lancement) dans une suite de dix sections ; à 768 la page s'allonge sans ancres. **Correctif :** une liste d'ancres en tête (« Badges », « Lancer la vérification », « Historique »).

**L2FU-24 — Plus tard — l'action qui sauve un badge est un bouton secondaire.** `VerificationLineState.tsx:145-147, 179-181` : « Reconfirmer ce compte » et « Rafraîchir mon audience » sont `secondary`, seul « start » est `primary`. **Correctif :** passer ces deux actions en `primary` tant que le badge est dans la grâce.

## États, par écran (contrôle de complétude)

| Écran | Vide | Chargement | Erreur | Succès | Refus de droit |
|---|---|---|---|---|---|
| C2 ligne de réseau | « Pas encore vérifié » (L2FU-7 pour les badges terminés) | `line.loading` | `line.unavailable` + Réessayer | badge écrit | sans objet |
| C3 contestation | `appeal.gone` | `ownership.loading` | échecs typés | suivi + issue | `notFound()` hors créateur |
| M2 bloc marque | « non demandé » (L2FU-7) | `line.loading` | `line.unavailable` | badge écrit | sans objet |
| Fiche : badges / lancement | `empty` / `emptyCreator`, `emptyBrand` | oui | oui | `sentAgent`, `created`, `takenOver` | `refused`, `refusals.*` |
| 2V | `noAction` | `common.loading` | `t.error`, `notFound`, `forbidden` | `done` | `forbidden` |
| Files 5 et 6 | `empty`, `emptySince` | `claimedReview.loading` | `errors.*` | `notices.*` | `forbidden`, `conflictOfInterest` |
| Sources | `inactiveNone` (actives : L2FU-6) | `common.loading` | `error` + Réessayer | `saved`, `added` | lecture seule pour l'agent |

## Hors périmètre

Les dépassements de budget e2e (ligne 17 : environ 0,5 s ; ligne 20 : +1,4 s) ne relèvent pas de l'UX : aucun constat. Aucun nouveau token n'est proposé ; rien à faire valider par le fondateur sur le branding. À arbitrer par le fondateur seulement : L2FU-11 (migration pour servir le motif initial) et L2FU-2 (champ d'API pour la fenêtre de rappel), qui touchent le modèle.
