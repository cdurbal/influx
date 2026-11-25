# L3G-U — constats `expert-ux` (lignes 12 et 13)
Revue sur le code et les messages (`c358a68`, `45f0ae8`) : **aucune capture, aucun écran lancé** (l'agent n'avait
pas d'outil d'exécution) ; tout constat « rendu » est à confirmer à l'œil. Backoffice FR seul (D36) : pas de
contrôle EN. **Décompte : 0 bloquant · 8 jalon · 7 avant production · 3 plus tard.**
Invariants 6, 11 et 13 tenus : marqueur de vue identifiée sur tous les états (barre 4 px, chapeau écrit,
`color-bo-identified-accent`, contrastes 6,75 à 7,24) ; blocage en phrase seule, sans motif ni auteur ; message de
la marque en nœud texte brut `dir="auto"` ; aucun montant ni tarif ; vue téléphone D58 : cadre masqué (`bo-small:`).

## Jalon (→ ligne `fix-1`)
- **J1** Message faux avec des facettes internes seules (G9 = Japon, aucun résultat) : « Aucune facette n'est
  appliquée » (`IdentifiedResults.tsx:322-324`, `identified-search-view.ts:459-474`, `fr.ts:4484`) ;
  `wideningOf` ne connaît que F1, F3, F4, F6, F8, F11, F17. Correctif : facettes appliquées sans retrait proposé →
  « Retirez une des facettes appliquées ci-dessus » ; « aucune facette » seulement pour un filtre vide.
- **J2** Focus clavier perdu après recherche, réinitialisation ou retrait de chip (`IdentifiedSearchScreen.tsx:169`
  `key={JSON.stringify(current.filters)}` remonte le formulaire ; `IdentifiedResults.tsx:66-69`) ; WCAG 2.4.3.
  Correctif : ne pas remonter par `key` (resynchroniser le brouillon) ; focus sur le compte (`h2`, `tabIndex=-1`).
- **J3** « Vider le pré-remplissage » sans effet visible (`IdentifiedSearchScreen.tsx:160, 206-221`) : la ligne dit
  toujours « Pré-rempli depuis… », bouton actif. Correctif : « Pré-remplissage vidé. Campagne liée : « titre » »,
  bouton désactivé ; `prefillId` gardé (le diff reste journalisé).
- **J4** « Choisir une campagne » mène à la file de validation (`identified-search-view.ts:38`
  `/files/campagnes` ; `IdentifiedSearchScreen.tsx:229`), où ouvrir une entrée la prend en charge. À confirmer au
  rendu. Correctif : `/inscrits`, libellé « Trouver une campagne par sa marque », ou retirer le lien.
- **J5** Libellés de facettes en codes bruts ou en anglais sur écran FR (« Sport fitness », « Ugc video »,
  « Cbd », « Tiktok carousel ») : `identified-search-view.ts:66-84, 100-125, 154-181, 247, 275, 287`,
  `queue-review-facts.ts:21-24` (`humanCode`). Correctif : table FR (thématiques, formats, secteurs) dans
  `messages/fr.ts`, `humanCode` en repli.
- **J6** Microcopies de la file 9 : « Close le … par … » (`fr.ts:4564`) → « Clôturée le … par … » ;
  `.toLowerCase()` de `team-selection-view.ts:188` donne « Demande de X close : autre (commentaire obligatoire). » →
  libellé court dédié « Autre » (`fr.ts:4579`) ; « (Lot 4) » visible en interface (`fr.ts:4385`, `4586`) → « n'est
  pas encore disponible », sans numéro de lot.
- **J7** « Qui et quand » des réglages : phrase tout en bas, dans « Autres réglages » en lecture seule
  (`SearchSettingsScreen.tsx:469`, `fr.ts:4616-4617`), et renvoi à un « registre » qu'aucun écran ne lit. Correctif :
  sous le chapeau et dans la section Ouverture : « L'auteur et la date du dernier changement ne sont pas lus ici ;
  une demande en cours montre son demandeur à la double validation. »
- **J8** Double validation en demi-information (`DualControlScreens.tsx:215-228`, `fr.ts:1105, 1117-1118`) :
  `search.change_setting` sans valeur actuelle ; `search.change_facet` en code brut. Correctif : « Valeur actuelle →
  valeur demandée » (lecture admin comme `readSearchSettings`), libellé de `identifiedSearch.facets`.

## Avant production (une ligne)
- A1 pas de navigation ‹j›/‹k› ni ligne focalisable dans le tableau (`17b` l. 906) : `IdentifiedResults.tsx:143`.
- A2 le compte de résultats (`h2`, `IdentifiedResults.tsx:296`) n'est pas annoncé : `aria-live="polite"`.
- A3 métriques D61 (rythme de publication, commentaires moyens) seulement dans « Valeurs exactes » repliées.
- A4 clôture file 9 : « traitée hors de l'outil » (`fr.ts:4586`), « la marque n'est pas prévenue » (`fr.ts:4571`) :
  pousse hors plateforme, sans retour à la marque ; à remplacer au Lot 4 ou 5 (« Proposer », e-mail).
- A5 lecture du brief en échec : « Rien n'a été journalisé » (`fr.ts:4308`) alors que la recherche libre l'est :
  « Le pré-remplissage n'a pas été journalisé ».
- A6 `#a78bfa` et `#17121f` dans `tokens-backoffice.css:41-42`, pas `tokens.css` (D6) : le fondateur confirme
  l'exception (validées `17b` V1) ou `architecte` les déplace.
- A7 captures et rendu à 1 440 et 1 280 à faire.

## Plus tard (une ligne)
- P1 « Rechercher » en bas de la colonne des facettes : le rendre collant.
- P2 trois formulaires de réglages remplissables sans autre admin actif ; refus à l'envoi seulement.
- P3 l'encart d'alertes décale la page (`SearchSettingsScreen.tsx:567`) : réserver sa hauteur.
- P4 (à `expert-cybersecurite`) nom légal du créateur non passé par `plainText` : `identified-search-view.ts:722-725`.
