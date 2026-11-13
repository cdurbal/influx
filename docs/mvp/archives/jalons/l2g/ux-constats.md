# L2G-U — constats `expert-ux`

> `expert-ux`, 2026-11-12. Lecture des commits a5af2d5 (13), 9ce3a56 (14), 405d73e (15), f3992c6 (16), 4431048 (17), sans code ni commit. Grille : `l2g/ux.md`. Référence : invariant 17 de la fiche, `17` l. 1289-1395, `17b` l. 365-555 et 1125-1175, `07` RG90, RG91, RG112.

## Méthode et limites

- **Lu, non exécuté.** Cette passe n'avait ni navigateur ni shell : aucun axe, aucune capture. Les 375, 768 et 1440 sont jugés sur les classes (`lg:`, `sm:`, `md:`), les jetons (`tokens.css` l. 518-529, 597-693) et les largeurs de colonnes calculées. Les constats qui reposent sur un calcul portent « à mesurer ». Les e2e des lignes 13 et 14 ne couvrent que FR 375 puis EN 1440 : **768 n'est jamais rendu** (L2GU-27).
- **Backoffice sous 768 px :** `Shell.tsx` l. 324-350 ne sert aucun contenu métier (poste de travail seul, vues D58 au Lot 4). Les files 2 et 3 et la fiche ne sont donc évaluées qu'à 768 et 1440. Ce n'est pas un défaut de L2G.
- **Tokens :** aucune valeur en dur trouvée (recherche de `#hex`, `[Npx]`, `rgb(`, `text-white`, `green` dans les composants des lignes 13 à 17 : zéro occurrence). Aucune couleur nouvelle. Contrastes recalculés : ambre `#ffb020` sur `#2b2008` ≈ 8,7:1 ; `text-secondary` `#b4bbb7` sur `#121413` > 9:1 ; `border-strong` `#78827d` sur `#0a0b0a` ≈ 5:1. Seul `text-disabled` (≈ 3:1) est sous 4,5:1, ce qui est admis pour un contrôle inactif.
- **Principes tenus sans constat :** aucun montant, taux ni net affiché (D48, D78 ; « Aucun tarif saisi : les coûts se négocient avec le commercial » à la fiche) ; couleur jamais seule (états portés par texte + icône : `Approuvé` / `En cours de modération` / `Refusé : motif`, onglet actif = coche + remplissage, `Complet` / `À compléter`) ; succès en sarcelle (`feedback-success-icon`), jamais en vert de marque ; notice d'anonymat au-dessus de la zone de dépôt (`CreatorPortfolioBlock.tsx` l. 81-84, invariant 17) ; case RG83 jamais pré-cochée ; « Publier mon profil » jamais désactivé, liste nominative en liens ; aperçu sans pseudo ni lien ni chiffre exact avant la mise en relation, et sans e-mail ni téléphone après (D46) ; aucune sortie vers l'extérieur de la plateforme ; message au créateur affiché avant la décision (`CreatorReviewDecision.tsx` l. 197-213, `PortfolioReviewDecision.tsx` l. 184-191) ; compteurs, états glyphe + libellé et pagination hérités du gabarit.
- **Textes contre RG90, RG91, RG112 :** aucune formule interdite par RG90 (« plus d'offres », « multiplie vos chances ») ; `publish.missing` et `blocks.missing` nominatifs ; FR et EN présents pour chaque clé relue ; aucun texte web en dur (seuls `SEPARATOR` et l'espace avant `%` ou `:` de L2GU-17). Écarts : L2GU-11, 13, 15.

## Points déjà signalés par les lignes : verdict

| Point signalé | Verdict | Constat |
|---|---|---|
| Axe non passé, état EN (refus, publié, interrupteur), ligne 13 | **Non vérifié, à passer avant la recette.** La lecture ne montre aucune cause évidente (contrastes calculés suffisants) | L2GU-8 |
| Mobile : carte de publication avant le sommaire | **Confirmé**, et la même cause donne un ordre de tabulation faux sur poste | L2GU-1 |
| Textes au-delà de `textes.md`, lignes 13 et 14 | **Liste dressée**, dont deux phrases qui engagent le fondateur | L2GU-11 |
| « arobase » / « at sign » (EC-L2G-10-1) | **Acceptable pour l'e-mail, discutable à l'écran** | L2GU-15 |
| EC-L2G-15-4, libellé de ligne non listée | **Deux formulations pour un état**, une ambiguë | L2GU-20 |
| Aperçu « après » sans chiffre exact sur `agent_observed` (EC-L2G-09-3) | **Contredit la promesse « Exactement… »** | L2GU-13 |

---

## Constats

Gravités : **bloquant** (l'écran brise une règle non négociable ; ligne `fix` dans `run.md`) · **jalon** (à corriger avant la recette F) · **avant production** (relecture, décision, finition à solder avant `production`) · **plus tard**.

### Bloquant : aucun

Aucun écran ne fait fuir une identité, ne montre un montant, ne pousse à sortir de la plateforme, ni ne repose sur la couleur seule. Seul L2GU-8 (axe EN) **deviendrait** bloquant s'il révèle une violation AA réelle : à décider au résultat de son exécution.

### Jalon

**L2GU-1. L'ordre du DOM contredit l'ordre visuel : mobile (signalé) et clavier sur poste.**
- Écran : « Mon profil », 375, 768 et 1440. `CreatorProfileScreen.tsx` l. 245-254 : la colonne `aside` (complétude + carte de publication) précède `Summary` (l. 254) et le formulaire.
- Mobile et 768 (flex colonne) : avant le sommaire passent la complétude, l'état, un éventuel refus, le bouton et sa liste de manquants. Un refus avec motif plus un avis de révision font plus d'un écran. Cela annule le but de L2DU-2 (sommaire dans le premier écran, commentaire l. 421). `17` l. 1308-1317 place le bouton après le sommaire.
- Poste (≥ 1024) : `lg:col-start-3` met l'`aside` à droite, mais il reste le premier arrêt de tabulation et le premier lu au lecteur d'écran (WCAG 1.3.2, 2.4.3).
- Correction proposée : DOM dans l'ordre complétude compacte → sommaire → formulaire → carte de publication, avec `lg:order-*` / `col-start` pour la colonne de droite. Garder en tête le seul avis de refus (`refusalViewOf`) sur mobile, car le motif est l'information urgente. Séparer `PublicationCard` en « avis » (refus, attente, révisions) et « action » (état, bouton, manquants).

**L2GU-2. La carte de publication vit dans une colonne de 218 px à 1440 (à mesurer).**
- Écran : « Mon profil », 1440 (et 1024-1279, pire). `--grid-creator-profile` (`tokens.css` l. 526) : sommaire 9,5 rem, formulaire 3fr, progression 1fr, minimum 9 rem. Rail 16 rem + marges : colonne de droite ≈ 218 px à 1440, ≈ 144 px à 1024. Une `Notice` (padding, icône, gap) laisse ≈ 125 px de texte.
- La carte (`CreatorPublicationCard.tsx` l. 105-176) empile état, refus (motif + message + étape), révisions, liste nominative de manquants : 600 à 900 px de hauteur possibles dans une colonne `lg:sticky`. Un bloc collant plus haut que la fenêtre ne laisse jamais voir son pied : le bouton ou les liens restent coupés.
- Correction proposée : sortir refus et révisions de la colonne collante (bandeau pleine largeur sous le titre, comme un état de page), garder dans la colonne seulement état + bouton + manquants. À défaut, `lg:max-h` + défilement interne focalisable.

**L2GU-3. Un bloc gelé ne dit pas pourquoi (profil soumis).**
- Écran : bloc 6 et tous les blocs, état `pending_review`, 375 à 1440. `ProfileSection disabled={!editable}` (`CreatorProfileScreen.tsx` l. 256-302) grise le `fieldset` sans une phrase dans le bloc. La seule explication est `publish.submitted` (« Profil soumis à validation. Réponse sous 1 jour ouvré. »), dans la carte, hors de vue sur mobile à hauteur d'un bloc 6. Elle ne dit pas que la saisie est figée.
- Le créateur qui veut corriger une coquille trouve des champs grisés. Ce choix est mal tenu : `field-classes.ts` l. 28-31 écrit « jamais seulement grisé ».
- Correction proposée : une `Notice info` en tête de formulaire quand le statut est `pending_review` (texte à valider, par exemple « Votre profil est en cours de validation : il ne peut pas être modifié avant la réponse de l'équipe INFLUX. »), et la même variante pour `suspended`.

**L2GU-4. Retrait d'un visuel en un clic, sans confirmation ni retour.**
- Écran : bloc 6, 375 à 1440. `PortfolioItemCard.tsx` l. 259-273 : « Retirer ce visuel » est un bouton secondaire de 44 px, voisin de « Remplacer » et « Enregistrer la légende », qui supprime aussitôt. Le bloc 3 demande confirmation (`networks.removeConfirm` « Retirer X et son audience ? » + Garder), donc la même famille d'écran est incohérente.
- Un visuel approuvé retiré sort de la version anonyme et son fichier est purgé : action irréversible sans annulation.
- Correction proposée : même geste en deux temps que le bloc 3 (« Retirer ? » + « Garder »), libellés et clés `portfolio.removeConfirm` / `removeKeep` à écrire FR et EN.

**L2GU-5. Une légende non enregistrée ne se voit pas, alors que l'écran annonce « Enregistrement automatique ».**
- Écran : bloc 6. `PortfolioItemCard.tsx` l. 104-128, 204-211 : la légende et la case RG83 ne partent qu'au bouton ; l'état modifié se lit seulement à l'`aria-disabled` du bouton. Le reste du profil s'enregistre seul (barre d'état « Enregistré automatiquement à 14 h 07 », `CreatorProfileScreen.tsx` l. 440-475). Quitter, publier ou taper dans une autre carte perd la saisie sans un mot. Cela viole `17` l. 1392 (« aucune perte »).
- Le choix de ne pas auto-enregistrer un champ modéré (RG9) est bon ; il manque de le dire.
- Correction proposée : quand `changed`, une ligne écrite sous le champ (« Modification non enregistrée ») et le bouton rendu primaire ; et à l'inverse la notice déjà là (« Légende en cours de validation ») conservée. Texte à valider.

**L2GU-6. L'interrupteur « Visible dans la recherche » se désactive pendant l'enregistrement.**
- Écran : bloc 7, 375 à 1440. `CreatorTrustBlock.tsx` l. 74 : `disabled={disabled || saving}`. Un élément qui devient `disabled` perd le focus : l'utilisateur au clavier ou au lecteur d'écran est éjecté du contrôle qu'il vient d'actionner, sans annonce de la fin d'enregistrement.
- Correction proposée : `aria-disabled` à la place de `disabled` pendant `saving` (le reste du code applique déjà ce principe aux boutons), et un `role="status"` pour « Enregistré ».

**L2GU-7. Un refus de modification de type « autre » rompt la phrase.**
- Écran : « Mon profil » d'un profil publié dont une révision est refusée pour le motif `other`. `CreatorPublicationCard.tsx` l. 114-123 compose `status.revisionRejected` avec `{reason}` ; or `rejection.other` finit par « : » (FR l. 477, EN l. 477). Résultat : « Votre modification n'a pas été publiée : Le message de l'équipe INFLUX : Votre profil reste visible dans sa version précédente. », puis, en dessous seulement, le message de l'agent. La phrase rassurante s'intercale dans l'introduction du message.
- Pour une soumission refusée, le doublon « : … : » est sans conséquence ; pour une révision, le sens est brouillé.
- Correction proposée : rendre « reste visible dans sa version précédente » en paragraphe séparé après le message (clé `status.revisionKept`), et laisser `{reason}` seul dans la première phrase. Aucune nouvelle formulation à valider hors cette clé.

**L2GU-8. Axe non passé sur l'état EN de la ligne 13 (signalé).**
- Écran : « Mon profil » EN, 1440 : refus, publié, interrupteur. `creator-portfolio.spec.ts` ne lance axe qu'une fois, en FR 375, avant la soumission (l. 159) ; les états EN ne sont pas couverts, donc l'invariant 17 (WCAG AA) n'est pas démontré pour eux.
- La lecture ne trouve pas la cause (contrastes suffisants, `role="switch"` sur `checkbox` autorisé, icônes `aria-hidden`). Pistes à vérifier en exécutant : `region`/`landmark` de l'`aside` sans nom, `link-in-text-block` des liens soulignés dans l'avis ambre, `aria-allowed-attr` de l'interrupteur, `target-size` des liens d'une phrase.
- Action : exécuter axe `wcag22` sur les trois états EN (et FR) et fournir l'identifiant de règle. Si une violation sérieuse est confirmée, ce constat passe **bloquant** et appelle une ligne `fix`.

**L2GU-9. Backoffice : « Le profil validé » sur une première soumission.**
- Écran : file 2, écran de décision, 768 et 1440. `CreatorReviewBlocks.tsx` l. 43-69 intitule le bloc ① « Le profil validé » (`fr.ts` l. 3043) ; le bloc ③ dit pourtant « Première soumission : tout le profil est à examiner, aucune version validée n'existe encore. » (l. 3151). Deux phrases de la même page se contredisent, au moment où l'agent décide.
- Correction proposée : titre « Le profil soumis » quand `entry.kind === "submission"`, « Le profil validé (version en ligne) » sinon. Texte backoffice FR seul.

**L2GU-10. Backoffice : le focus est perdu quand le visuel s'affiche.**
- Écran : files 2 et 3, écrans de décision. `CreatorVisual.tsx` l. 82-102 remplace le bouton « Afficher le visuel » par l'image dès qu'elle est lue : l'élément qui portait le focus disparaît, le clavier retombe sur le corps de la page, et les raccourcis `‹v›` / `‹r›` qui dépendent du focus suivent la même fragilité. L'écran est l'outil d'une journée de modération.
- Correction proposée : l'image reçoit `tabIndex={-1}` et le focus à son apparition (ou le bouton reste et devient « Masquer »). Annoncer « Visuel affiché » dans la région `status`.

### Avant production

**L2GU-11. Textes ajoutés au-delà de `textes.md` (lignes 13 et 14, signalé).**
`textes.md` §3 liste huit clés reprises de `07` l. 972-994 et une vingtaine de clés nouvelles (`state.draft`, `required.*`, `portfolio.faceNotice` … `preview.explain`). Sont ajoutés en plus, donc à relire par le fondateur avant production (`21` §5.8, D48) :
- **Ligne 13**, `creator-profile.json` FR l. 380-497 : `portfolio.help`, `empty`, `loading`, `unavailable`, `reload`, `add`, `replace`, `remove`, `retry`, `moveUp`, `moveDown`, `saveCaption`, `item`, `imageLoading`, `replacementAlt`, `refusedTitle`, `refusedItem`, `deleteAfter`, `status.*`, `errors.*` ; `publish.failed` ; `status.published`, `status.pendingFields` ; `status.revisionRejected` ; `revisionField.*` ; `sections.trust` ; **`trust.verified`, `trust.missing`, `trust.go`** ; **`visibility.on`**, `visibility.failed`.
- **Ligne 14**, l. 498-566 : tout `preview.*` sauf `title`, `before`, `after`, `explain` (soit `tabs`, `back`, `loading`, `unavailable`, `notPublished`, `beforeIntro`, `afterIntro`, `noVisual`, `sections.*`, `metrics.*`, `exact`, `observed`, `source.*`, `figuresAt`, `figuresUndated`, `badge.*`, `shares`, `share.*`, `gender.*`, `age.*`, `engagementBand.*`, `mainAudience`, `audienceCountries`, `audienceAges`, `audienceGender`).
- **À signaler en priorité**, car elles affirment un fait ou un engagement : `visibility.on` (« Les marques pourront vous trouver dans la recherche, une fois votre profil publié » : la recherche n'existe qu'au Lot 3, RG91 demande une règle écrite : c'est RG8, mais la phrase promet un effet que le pilote ne produit pas encore) ; `trust.missing` (décrit un chemin, vrai) ; `preview.beforeIntro` (« ne voit que des tranches » : une marque lit aussi titre, bio, badges datés, formats, offre) ; `preview.afterIntro` (promet « vos chiffres exacts » : voir L2GU-13) ; `portfolio.errors.quota` (L2GU-17).
- Recommandation : la liste ci-dessus entre dans la relecture de `21` §5.8 en un seul point ; `visibility.on` à reformuler en fait vérifiable (« Une fois votre profil publié, il pourra apparaître dans la recherche des marques ») ou à ne pas afficher avant le Lot 3.

**L2GU-12. Bloc 7 « Confiance » : un état que le créateur ne peut pas faire avancer, mal dit.**
- Écran : bloc 7 et sommaire. `accountVerifiedOf` ne connaît qu'un booléen : tant que le badge n'est pas accordé, le texte dit « Vous le demandez depuis le bloc Réseaux sociaux… » (`trust.missing`) même si la demande est déposée et attend l'agent, et le sommaire affiche « À compléter » alors qu'il n'y a plus rien à saisir. Cela contredit l'esprit de RG88 (la complétude ne dépend jamais d'une action d'INFLUX).
- Le titre « Confiance » cache l'interrupteur de visibilité : `17` l. 1314 l'appelle « Visibilité » ; une créatrice qui veut se retirer de la recherche cherche ce mot. La phrase `trust.missing` renvoie à `#creator-section-networks` en deux sauts (lien de la carte → bloc 7 → lien).
- Correction proposée : lire l'état de la demande depuis `useCreatorVerification` (déjà chargé par le bloc 3) et dire « Demande déposée le {date} : réponse de l'équipe INFLUX attendue » ; titre « Confiance et visibilité » / *Trust and visibility* ; la liste des manquants de la carte pointe directement le bloc 3.

**L2GU-13. Aperçu : « Exactement ce que la plateforme sert… » n'est pas exact (EC-L2G-09-3, signalé).**
- Écran : « Ce que voit une marque », onglet « Après », 375 à 1440. `creator-preview-view.ts` l. 451-456 n'affiche aucun chiffre exact sur une ligne `agent_observed` et ajoute « Chiffres constatés par INFLUX : ils ne s'affichent pas dans cet aperçu » (`preview.observed`). Deux problèmes : (1) le titre promet « exactement… rien de plus » (`preview.explain`) alors que l'aperçu retranche ; (2) la phrase ne dit pas si la marque verra ou non ces chiffres, alors que `afterIntro` promet « vos chiffres exacts ». La créatrice ne peut pas savoir ce qui sera révélé, dans l'écran dont la seule raison d'être est de le lui montrer.
- Autre écart : la carte limite à trois visuels (`PREVIEW_VISUALS_SHOWN`, RG84) sans le dire ; le bloc 6 permet huit et l'ordre n'a de conséquence lisible nulle part.
- Correction proposée : décision `product-owner` sur la révélation des chiffres constatés ; puis soit afficher le chiffre, soit écrire « La marque verra ces chiffres exacts après la mise en relation ; ils ne sont pas détaillés ici ». Ajouter « La carte montre vos trois premiers visuels approuvés, dans votre ordre. » sous le titre de l'aperçu.

**L2GU-14. Vocabulaire EN incohérent pour une même notion.**
- `figures.source.agent_observed` EN : « verified by INFLUX » (`en/creator-profile.json` l. 227, `engagement.unverified` l. 327, qui reprend `07`) ; `preview.source.agent_observed` : « Observed by INFLUX » (l. 525) ; backoffice : « constatés ». En FR « constaté » partout. « Verified » recouvre aussi le badge « Account verified » (`preview.badge`), alors que « constaté » n'est pas « vérifié ».
- Même flottement « Refused » (`state.rejected`, l. 45) / « Rejected » (`portfolio.rejected`, l. 386, `portfolio.refusedTitle` l. 408).
- Correction proposée : glossaire EN unique : « observed by INFLUX » pour la source, réservé « verified » au badge ; « Refused » partout. À arbitrer avec `product-owner` (le texte de `07` l. 983 est en « verified »).

**L2GU-15. « arobase » / « at sign » (EC-L2G-10-1, signalé).**
- Les motifs affichés à l'écran sont les mêmes phrases que l'e-mail (`textes.md` l. 22, 45-46, 51) ; l'e-mail ne peut pas écrire `@` (RG158). À l'écran, `fields.headline.help` écrit déjà « sans @ » (FR l. 95, EN l. 95) : le même écran dit les deux.
- FR : « un arobase » hésite sur le genre (usage partagé) ; « le signe arobase » le contourne. EN : « at sign » est exact mais moins reconnu que « @ ».
- Position : conserver pour l'e-mail ; pour l'écran, introduire la clé d'affichage avec `@` littéral seulement si le fondateur accepte deux jeux de textes. Sinon harmoniser vers « le signe arobase » / *the @ sign* partout où l'écran n'est pas contraint, et accepter l'écart. Gravité faible, décision de cohérence.

**L2GU-16. Le bouton « Publier mon profil » ne dit pas ce qui va se passer ; la case RG83 non plus.**
- Écran : carte de publication, bloc 6. Avant le clic, aucune phrase ne dit qu'un commercial relit avant publication (la réponse « sous 1 jour ouvré » n'apparaît qu'après la soumission, `CreatorPublicationCard.tsx` l. 128-132). « Publier » promet une mise en ligne immédiate ; le créateur découvre l'attente après coup (principe 4 : rien ne se découvre en fin de parcours).
- La case « Je confirme être autorisé à citer cette marque… » (`PortfolioItemCard.tsx` l. 189-203) apparaît dès qu'une légende existe, même sans marque citée, et ne dit pas ce qui arrive si elle reste décochée (`07` l. 780-782 : légende publiée sans le nom ou refusée).
- Correction proposée : une ligne d'aide sous le bouton (« Un commercial INFLUX relit votre profil avant de le publier. »), une ligne sous la case (« Sans cette case, la légende est publiée sans le nom de la marque, ou refusée. »). Textes à valider, tirés de règles écrites.

**L2GU-17. Formats non localisés dans l'aperçu ; « demain » du quota.**
- `creator-preview-view.ts` l. 474 écrit `${nombre} %` avec une espace, en FR (espace sécable) comme en EN (« 30 % » alors que `preview.share` écrit « 50 to 80% ») ; l. 204 et 219 écrivent `pays : tranche` avec l'espace avant les deux-points (faux en EN) ; les listes (`listOf`) joignent par « , » au lieu d'`Intl.ListFormat`. Principe 9 (formats selon la langue).
- `portfolio.errors.quota` (« Réessayez demain ») : le quota est par jour UTC (`modele.md`, EC-L2G-4) ; « demain » est faux pour une créatrice dont minuit n'est pas minuit UTC. Écrire « Réessayez plus tard ».
- Les montants n'existent pas ; aucune devise concernée.

**L2GU-18. Noms accessibles identiques sur huit cartes.**
- `PortfolioItemCard.tsx` : « Enregistrer la légende » (l. 210), « Remplacer ce visuel » (l. 256), « Retirer ce visuel » (l. 272), champ « Légende (facultative…) » (l. 174), case RG83 (l. 201) sont identiques d'une carte à l'autre ; seuls « Monter / Descendre le visuel n » portent la position. Une liste de boutons au lecteur d'écran ou la commande vocale ne distingue pas les cartes (WCAG 2.4.6).
- Correction proposée : `aria-label` avec `{position}` (« Retirer le visuel 2 ») ou `aria-describedby` vers le titre `h3` de la carte. Les clés `portfolio.replaceNamed` / `removeNamed` / `saveCaptionNamed` seraient à ajouter (FR/EN).

**L2GU-19. Portfolio en deux colonnes sur une colonne étroite, entre 1024 et 1279 (à mesurer).**
- `CreatorPortfolioBlock.tsx` l. 154, 189 : `sm:grid-cols-2` est une classe de fenêtre (≥ 640), pas de conteneur. De 1024 à ≈ 1100, le formulaire fait ≈ 375 px (rail 16 rem, sommaire 9,5 rem, progression 9 rem au plus étroit) : deux cartes de ≈ 150 px de contenu, avec cinq boutons de 44 px et un champ de légende. À 768 (une colonne de formulaire, deux cartes de ≈ 330 px) et à 1440 (≈ 270 px) le rendu est correct.
- Correction proposée : `xl:grid-cols-2` ou requête de conteneur, et une colonne unique en dessous.

**L2GU-20. Backoffice : libellés de ligne non listée (EC-L2G-15-4, signalé).**
- Deux formulations d'un même état : file 2, `lines.unlisted` « En attente de validation : pas encore visible des marques » (`fr.ts` l. 3128) ; fiche, `accountCreator.unlisted` « Réseau ajouté, en attente de validation. » (l. 707, c'est la phrase de `textes.md` §4). Les deux sont lisibles ; la première, ajoutée, est plus informative dans le contexte de décision. À valider ou à aligner.
- `lines.listed` « Visible des marques » (l. 3127) sur un écran qui montre les chiffres exacts de la couche I peut se lire « ces chiffres sont visibles des marques ». Écrire « Réseau visible des marques (en tranches) ».

**L2GU-21. Backoffice : on peut approuver un visuel sans l'avoir affiché, et l'affichage coûte un clic de souris à chaque entrée.**
- Files 2 et 3, 1440. Rien dans le récapitulatif d'approbation (`PortfolioReviewDecision.tsx` l. 120-146) ne dit si le visuel a été lu : `‹v›` puis « Confirmer » l'approuve à l'aveugle, alors qu'un visuel approuvé devient public pour toute marque inscrite (`approveLead`). À l'inverse, l'affichage exige un clic sur « Afficher le visuel » à chaque entrée (lecture journalisée, D82 (7), voulu) sans raccourci, dans une file où la chaîne automatique est faite pour le tout-clavier. Pour dix visuels à la recette : ≈ dix passages à la souris.
- Correction proposée : touche `‹i›` « afficher le visuel » dans la liste des raccourcis ; ligne dans le récapitulatif « Vous n'avez pas affiché ce visuel. » tant qu'il ne l'est pas (information, pas blocage ; le blocage serait une règle à arbitrer par `product-owner`).

**L2GU-22. Backoffice : la fiche créateur n'a pas la barre « vue identifiée » ni l'alias en titre.**
- `AccountScreen.tsx` l. 704-707 : titre générique `t.title` et ligne « consultation enregistrée ». `17b` l. 1130-1133, 1159 : barre `⬥ VUE IDENTIFIÉE ▮` et en-tête « ⟨alias⟩ — ⟨nom réel⟩ ». Les blocs ② ajoutés portent bien le ▮ et un texte masqué (`AccountCreatorBlocks.tsx` l. 50-57), mais la page elle-même n'annonce pas qu'elle montre des chiffres exacts et l'identité. Pas de navigation interne alors que la page cumule une douzaine de sections.
- Correction proposée : en-tête de fiche selon `17b` §4.9, au titre du lot qui reprend la fiche (L2G a posé les blocs, pas l'enveloppe). Si hors périmètre de L2G, l'inscrire au reliquat de `21` §8.

### Plus tard

**L2GU-23. Backoffice : le nom de l'alias est un lien de filtre.** `PortfolioQueueScreen.tsx` l. 50-61 : la cellule la plus lisible de la ligne ne l'ouvre pas, elle filtre (`aria-label` « Ne voir que les visuels de … »), à côté du vrai lien d'ouverture. Le geste surprend ; un bouton « Voir les visuels de ce profil » dans la ligne ou sur l'écran de décision est plus clair.

**L2GU-24. Backoffice : panneaux de décision et page longue.** `ClaimedDecisionParts.tsx` l. 93-97 met le focus dans le commentaire interne facultatif : `‹v›` → focus textarea → `Tab` (Annuler) → `Tab` (Confirmer) → `Entrée`. Pour approuver huit visuels, mieux vaut focaliser le bouton de confirmation quand le commentaire n'est pas requis. Composant partagé L2F : à traiter avec la reprise du gabarit au Lot 6bis, avec l'action de masse de la file 3 (`17b` l. 518, hors L2G). La fiche de décision de la file 2 empile six sections avant la décision, sur une seule colonne à 1440 ; une barre de décision collante est à étudier.

**L2GU-25. Écarts de finition avec `17` §5.2.** Le sommaire n'affiche pas le compteur « 3/8 » de la ligne Portfolio (`17` l. 1313) ; le bloc 7 s'appelle « Confiance » (L2GU-12) ; l'état `suspended` n'a aucun texte d'explication ni contact (le cas n'apparaît qu'au Lot 5) ; après publication, aucune invitation vers « Ce que voit une marque » (le lien n'existe que dans le sommaire) ; la clé `portfolio.minimum` (FR l. 391) n'est utilisée que par son pendant d'erreur : afficher la règle avant le retrait plutôt qu'après.

**L2GU-26. Accessibilité, finitions.** `CreatorPreviewScreen.tsx` l. 221-232 : le `tabpanel` n'est pas focalisable (`tabIndex={0}` recommandé quand il n'a pas de contrôle focalisable) ; les visuels de l'aperçu sont `alt=""` (l. 273-279), la légende seule les décrit ; « Ordre enregistré. » ne dit pas la nouvelle position ; la `aside` n'a pas de nom ni de titre (`CreatorProfileScreen.tsx` l. 246) ; `role="status"` inséré avec son contenu (`CreatorPublicationCard.tsx` l. 129) n'est pas toujours annoncé : préférer une région déjà présente ; les images de visuels n'ont pas de hauteur réservée (saut de mise en page à l'arrivée) ; `portfolio.status.busy` « Enregistrement… » pour un dépôt.

**L2GU-27. 768 non couvert, listes denses à 768.** Aucune spec ne rend 768 pour les écrans de L2G ; la liste de la file 2 compte onze colonnes (`CreatorQueueScreen.tsx` l. 31-77) dans un tableau qui défile dans sa région : à 768, avec le rail, État et Alias quittent l'écran avant Responsable. Ajouter 768 à une des specs et fixer les deux premières colonnes à gauche.

**L2GU-28. Action de masse de la file 3.** `17b` l. 518 annonce « Oui, 20 max » ; L2G l'exclut (fiche, Lot 6bis). Pour une recette de dix visuels, c'est acceptable ; en exploitation, c'est la première demande des agents. Déjà au reliquat : rien à faire ici.

---

## Ce qui reste à valider par le fondateur

- La liste des textes de L2GU-11 (avant `production`, `21` §5.8) ; en particulier `visibility.on`, les trois phrases `trust.*`, `preview.beforeIntro`, `preview.afterIntro`, `preview.observed`.
- Les textes neufs proposés : avis de profil gelé (L2GU-3), confirmation de retrait (L2GU-4), légende non enregistrée (L2GU-5), aide sous « Publier » et sous la case RG83 (L2GU-16), état de la demande de badge et titre « Confiance et visibilité » (L2GU-12), titre du bloc ① du backoffice (L2GU-9).
- Aucune nouvelle couleur, aucun nouveau jeton proposés : tous les correctifs se font avec les tokens existants.

ETAT : 28 constats : 0 bloquant, 10 jalon, 12 avant production, 6 plus tard ; pas de bloquant (L2GU-8, axe EN, le deviendrait si une violation AA est confirmée : exécution requise ; aucune ligne `fix` ajoutée à `run.md`).
