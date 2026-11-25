# E20 — Mon compte : préférences, sessions, données, suppression (marque, créateur)
> Maquette : `proto-compte.html` (états `preferences`, `sessions`, `donnees`, `supprimer`) · page de comparaison `ecran-20-compte.html` · validée le 2026-11-24 (07) · Constats : U31, U63. Page-menu, informations et adresse : `E20a-compte.md` (cadre §2, retour E20.2-S01 repris par chaque page). Coquille : E01.0.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E20.4 | Mes préférences | `/fr/compte/preferences` | `/en/account/preferences` | `account/PreferencesScreen.tsx:32` | `preferences` | S | C05 |
| E20.5 | Mes sessions | `/fr/compte/sessions` | `/en/account/sessions` | `account/SessionsScreen.tsx:36` | `sessions` | S | C06, C26 |
| E20.6 | Mes données | `/fr/compte/donnees` | `/en/account/data` | `account/DataScreen.tsx:81` | `donnees` | M | E20.7 |
| E20.7 | Supprimer mon compte | même adresse que E20.6 | idem | `DataScreen.tsx:424` (`ConfirmDeletion`), `FreshCode.tsx:38` | `supprimer` | M | C49 |

Fonctionnalités existantes à préserver :
- Préférences : valeur, date et origine en toutes lettres (RG95) ; un geste, effet immédiat (RG34) ; désinscription revenue de Brevo jamais une erreur (RG96) ; page accessible CGU en attente.
- Sessions : navigateur et dates, **jamais de pays** (RG143) ; session courante marquée ; fermeture d'une session (404 = déjà fermée, `SessionsScreen.tsx:84`) ; tout fermer = déconnexion annoncée avant (RG144), page « déconnecté » avec sa phrase.
- Données : demandes listées avec état et dates ; export demandé puis validé par l'équipe ; **code frais par téléchargement**, 3 téléchargements, 7 jours (`DataScreen.tsx:116`) ; fichier enregistré sur l'appareil ; une seule demande ouverte par type (`:246`).
- Suppression : mot à taper, puis code frais `account_deletion`, exécution sans approbation (D72) → page « Votre compte est supprimé » (`MemberShell.tsx:554`) ; avertissement « Téléchargez d'abord » seulement si un export existe ou est demandé (`:342`).

API : GET et PUT `/v1/me/consent` ; GET `/v1/me/sessions`, DELETE `/v1/me/sessions/:id` et `/v1/me/sessions` ; GET et POST `/v1/me/data-requests` ; GET `/v1/me/data-export`, GET ou POST `/v1/me/data-export/:id/download` ; POST `/v1/me/reauthenticate/*` (`account-api.ts:66-212`).

## 2. Structure
- Cadre et colonne : E20a §2 (768 px, gap 32, sections à filet haut, padding haut 24, gap 16, `h1` 20 px, `h2` 16 px).
- E20.4 à 1440 : `h1` (48) → section état (103 ; bloc `.ro` 47,7, bouton 46,8, aide) → section « Ce que le retrait ne change pas » (337,9).
- E20.5 : `h1` + phrase → liste (160,8 ; lignes de 74 à 77 px, colonnes 20 px + texte + action, gap `spacing-1 spacing-3`, padding `spacing-3 0`, filets `border-subtle`) → phrase → repli rouge (449,3). Double filet en haut (section puis liste, 25 px d'écart) : à reproduire.
- E20.6 : `h1` + phrase → « Vos demandes » (135,8) → « Exporter mes données » (307) → repli « Supprimer mon compte » (485,8). Sans demande, la première section est absente.
- E20.7 : repli ouvert, 462,7 px : avertissement → deux listes (376 px chacune, gap `spacing-4`, dès 640 px ; une colonne dessous) → champ 256 px (16 rem) → bouton rouge → phrase.
- Aucune zone collante.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E20.4-S01 | En-tête | C02 | Retour (< 1 024 px) puis `h1` 20 px 800 | Toujours | `preferences`, `.cp-head` | E20.4-CA01 | E20.4-T01 |
| E20.4-S02 | État | C03 | `h2` « E-mails commerciaux et prospection » | Toujours | `#h-pref` | E20.4-CA01 | E20.4-T01 |
| E20.4-S03 | État | C05 | Bloc `surface-raised` 47,7 px : « État : {accordé} » (valeur `font-display` gras) à gauche, date et origine `text-xs` `text-secondary` à droite ; à la ligne à 375 si besoin | Lecture faite | `.ro` | E20.4-CA02 | E20.4-T01 |
| E20.4-S04 | État | C10 | « Retirer mon consentement » secondaire 254,4 × 46,8 ; libellé alterné « Recevoir de nouveau ces e-mails » | Selon la valeur | `#pref-btn` | E20.4-CA03 | E20.4-T01 |
| E20.4-S05 | État | C18 | Aide `text-xs` `text-secondary`, alternée | Selon la valeur | `#pref-help` | E20.4-CA03 | E20.4-T01 |
| E20.4-S06 | État | C17 | Notice `success` `circle-check`, dernière de la section | Après un changement (script) | `#pref-done` | E20.4-CA03 | E20.4-T01 |
| E20.4-S07 | Inchangé | C03 | `h2` « Ce que le retrait ne change pas » | Toujours | `#h-keep` | E20.4-CA04 | E20.4-T01 |
| E20.4-S08 | Inchangé | C65 | 3 lignes `text-sm` `text-secondary`, `check` 16 px `feedback-success-icon`, gap 8 | Toujours | `.keeps` | E20.4-CA04 | E20.4-T01 |
| E20.5-S01 | En-tête | C02 | Retour, `h1` 20 px, phrase `text-md` `text-secondary` | Toujours | `sessions`, `.cp-head` | E20.5-CA01 | E20.5-T01 |
| E20.5-S02 | Liste | C03 | `h2` « Sessions ouvertes » masqué (`sr-only`) | Toujours | `#h-ses` | E20.5-CA01 | E20.5-T01 |
| E20.5-S03 | Ligne | C06 | Icône 20 px `text-secondary` : `monitor` ou `smartphone` | Par session | `.slist li > .i` | E20.5-CA02 | E20.5-T01 |
| E20.5-S04 | Ligne | C06 | « {navigateur} sur {système} » 600 ; dates `text-xs` `text-secondary` sur une ligne | Par session | `.slist .t`, `.s` | E20.5-CA02 | E20.5-T01 |
| E20.5-S05 | Ligne | C13 | Badge `info` « Cet appareil » à 8 px du nom | Session courante | `.badge--info` | E20.5-CA03 | E20.5-T01 |
| E20.5-S06 | Ligne | C10 | « Fermer » secondaire 103,5 × 36 à droite ; sous le texte < 480 px ; absent sur la courante | Autres sessions | `[data-close-s]` | E20.5-CA04 | E20.5-T01 |
| E20.5-S07 | Bas | C18 | Phrase de reconnaissance `text-xs` `text-secondary` | Toujours | `.sec > .xs` | E20.5-CA05 | E20.5-T01 |
| E20.5-S08 | Danger | C26 | Repli : filet haut, résumé 44 px `feedback-error-text` 600, chevron 16 px pivotant 90° | Toujours | `details.danger` | E20.5-CA06 | E20.5-T02 |
| E20.5-S09 | Danger | C26 | Avertissement `text-sm`, gap `spacing-3` | Déplié (non capturé ouvert) | `details.danger p` | E20.5-CA06 | E20.5-T02 |
| E20.5-S10 | Danger | C10 | « Oui, fermer toutes les sessions » rouge plein 286,8 × 44,8 | Déplié | `.btn--danger` | E20.5-CA06 | E20.5-T02 |
| E20.6-S01 | En-tête | C02 | Retour, `h1` 20 px, phrase | Toujours | `donnees`, `.cp-head` | E20.6-CA01 | E20.6-T01 |
| E20.6-S02 | Demandes | C03 | `h2` « Vos demandes » | Au moins une demande | `#h-req` | E20.6-CA02 | E20.6-T01 |
| E20.6-S03 | Demandes | C06 | Ligne : icône `list-checks` 20 px, « {type} · {état} » 600, dates `text-xs` | Par demande | `.slist` | E20.6-CA02 | E20.6-T01 |
| E20.6-S04 | Export | C03 | `h2`, paragraphe `text-sm` `text-primary` | Toujours | `#h-exp` | E20.6-CA03 | E20.6-T01 |
| E20.6-S05 | Export | C18 | Phrase « déjà en cours » `text-sm` `text-secondary` (sans notice) | Demande d'export ouverte | `.sec > .c2` | E20.6-CA03 | E20.6-T01 |
| E20.6-S06 | Export | C10 | Bouton « Exporter » (non dessiné ; actuel : secondaire) | Aucune demande ouverte | non montré | E20.6-CA04 | E20.6-T01 |
| E20.6-S07 | Export | C03 | « Votre export est prêt » et « Télécharger mes données » (non dessinés) | Export disponible | non montré | E20.6-CA05 | E20.6-T02 |
| E20.6-S08 | Danger | C26 | Repli « Supprimer mon compte » : filet haut, résumé 44 px `feedback-error-text` 600 | Toujours, en dernier | `donnees`, `#del` | E20.6-CA06 | E20.7-T01 |
| E20.7-S01 | Avertissement | C26 | `text-sm` : première phrase en gras, puis la suite | Déplié | `supprimer`, `#del > div > p` | E20.7-CA01 | E20.7-T01 |
| E20.7-S02 | Listes | C65 | `h3` `text-sm` 700 + 3 lignes `text-sm` `text-secondary`, sans puce, gap 8 | Déplié | `.two > div:nth-child(1)` | E20.7-CA02 | E20.7-T01 |
| E20.7-S03 | Listes | C65 | Seconde liste, même poids, à droite | Déplié | `.two > div:nth-child(2)` | E20.7-CA02 | E20.7-T01 |
| E20.7-S04 | Mot | C18 | « Tapez SUPPRIMER pour confirmer » : champ 256 × 48, `autocomplete=off` | Déplié | `#del-w` | E20.7-CA03 | E20.7-T01 |
| E20.7-S05 | Mot | C19 | Erreur ; s'efface à la frappe | Mot faux au clic (script) | `#del-err` | E20.7-CA03 | E20.7-T01 |
| E20.7-S06 | Action | C10 | « Demander la suppression définitive » rouge plein 321,6 × 44,8, à gauche | Déplié | `#del-go` | E20.7-CA04 | E20.7-T01 |
| E20.7-S07 | Action | C18 | « Un code de vérification vous sera ensuite demandé. » `text-xs` `text-secondary` | Déplié | `#del .xs` | E20.7-CA04 | E20.7-T01 |
| E20.7-S08 | Code | C49 | Code frais `account_deletion` : non dessiné | Mot juste | non montré | E20.7-CA05 | E20.7-T01 |

## 4. Textes
EN « à écrire » = à écrire (expert-marketing). Clés : `account.json`.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E20.4-S01 | Mes préférences de communication | My communication preferences | `preferences.title` |
| E20.4-S02 | E-mails commerciaux et prospection | Marketing emails and prospecting | `preferences.cardTitle` |
| E20.4-S03 | État : {accordé} (ou {retiré}) · Le {18/11/2026}, {par vous, à l'inscription}. | Status: given · On {date}, {origin}. | `preferences.stateLabel`, `.granted`, `.withdrawn`, `.since`, `.origin.*` |
| E20.4-S04 | Retirer mon consentement · Recevoir de nouveau ces e-mails | Withdraw my consent · Receive these emails again | `preferences.withdraw`, `.grant` |
| E20.4-S05 | Effet immédiat. Aucune justification demandée. · Vous pourrez retirer ce consentement à tout moment, ici ou depuis chaque e-mail. | valeurs des clés | `preferences.withdrawHelp`, `.grantHelp` |
| E20.4-S06 | C'est fait : vous ne recevez plus nos e-mails commerciaux ni nos messages de prospection. · C'est fait : vous recevrez de nouveau nos e-mails commerciaux. | valeurs des clés | `preferences.done.*` |
| E20.4-S07, S08 | Ce que le retrait ne change pas · Votre code de connexion continue d'arriver. · Les messages liés à vos mises en relation aussi. · Votre compte et vos accès sont inchangés. | valeurs des clés | `preferences.unchanged.*` |
| E20.5-S01 | Mes sessions · Les navigateurs où votre compte est ouvert. Si l'un d'eux ne vous dit rien, fermez-le. | valeurs des clés | `sessions.title`, `.lead` |
| E20.5-S02 | Sessions ouvertes | à écrire | nouvelle |
| E20.5-S04 | {Firefox} sur {Windows} · Ouverte le {22/11/2026} · dernière activité {aujourd'hui à 09 h 41 ou le 23/11/2026} | {family} on {system} · à écrire | `sessions.browser` ; `createdAt` + `lastActivityAt` (deux lignes aujourd'hui) |
| E20.5-S05 | Cet appareil | This device | `sessions.current` |
| E20.5-S06 | Fermer | à écrire (nom accessible : `sessions.close`) | diffère de `sessions.close` (« Fermer cette session ») |
| E20.5-S07 | Nous reconnaissons un navigateur à son type et à son système, jamais à votre position. | à écrire | diffère de `sessions.help` (E20-Q15) |
| E20.5-S08 à S10 | Fermer toutes les sessions · Toutes vos sessions seront fermées, y compris celle de cet appareil : vous devrez vous reconnecter avec un code. · Oui, fermer toutes les sessions | valeurs des clés | `sessions.closeAll`, `.closeAllWarning`, `.closeAllConfirm` |
| Annonce E20.5 | Session fermée. | Session closed. | `sessions.closed` |
| E20.6-S01 | Mes données · Demandez une copie de vos données, ou supprimez votre compte. | valeurs des clés | `data.title`, `.lead` |
| E20.6-S02 | Vos demandes | Your requests | `data.requests.title` |
| E20.6-S03 | {Export de vos données} · {En cours de traitement} · Déposée le {20/11/2026} · réponse au plus tard le {20/12/2026} | valeurs des clés (casse à adapter) | `data.requests.line`, `.type.*`, `.status.*`, `.receivedAt`, `.dueAt` |
| E20.6-S04 | Exporter mes données · Vous recevez un fichier lisible avec les données que nous détenons sur vous. Une personne de l'équipe INFLUX valide votre demande, puis le fichier apparaît ici : vous le téléchargez après un code envoyé à votre adresse. | valeurs des clés (réunies) | `data.export.title`, `.text`, `.how` (phrase finale « Il ne vous est jamais envoyé par e-mail. » retirée) |
| E20.6-S05 | Une demande d'export est déjà en cours : vous la suivez ci-dessus. | valeur de la clé | `data.export.open` |
| E20.6-S08 | Supprimer mon compte | Delete my account | `data.danger.deleteTitle` |
| E20.7-S01 | La suppression de votre compte est définitive. Elle ne peut pas être annulée. Vous serez déconnecté de tous vos appareils. Téléchargez d'abord votre export : il sera effacé avec votre compte. | valeurs des clés | `data.danger.warning` (« immédiate et définitive » aujourd'hui), `.exportFirst` |
| E20.7-S02 | Ce qui disparaît · Vos informations de compte : adresse e-mail, pays, langue, statut ou nom d'entreprise. · Votre contact chez Brevo et chez Apollo.io : la suppression leur est transmise en priorité. · Votre accès : vous ne pourrez plus vous connecter. | valeurs des clés | `data.confirm.goneTitle`, `.gone.*` |
| E20.7-S03 | Ce qui est conservé, et pourquoi · Les e-mails déjà envoyés : nous ne pouvons pas les rappeler. · Les écritures du journal d'activité, sous une forme qui ne vous nomme plus. · La trace de votre acceptation des conditions d'utilisation, sous une forme qui ne vous nomme plus. | titre et 3e : valeurs des clés ; 1re et 2e : à écrire | `data.confirm.keptTitle`, `.kept.*` (deux raccourcis, E20-Q18) |
| E20.7-S04 | Tapez SUPPRIMER pour confirmer | Type DELETE to confirm | `data.confirm.wordLabel`, `.word` |
| E20.7-S05 | Tapez SUPPRIMER, en capitales, pour confirmer. | Type DELETE, in capitals, to confirm. | `data.confirm.wordError` |
| E20.7-S06 | Demander la suppression définitive | Request permanent deletion | `data.confirm.submit` |
| E20.7-S07 | Un code de vérification vous sera ensuite demandé. | valeur de la clé | `data.confirm.next` |

## 5. Interactions, états, responsive, clavier
- **E20.4** : bouton → PUT consentement → état, date, libellé, aide et notice changent, annonce du message. Aucune confirmation.
- **E20.5** : « Fermer » → DELETE → la ligne disparaît, annonce « Session fermée. » ; focus sur la ligne suivante, sinon le titre. Repli → « Oui, fermer… » → DELETE de tout → page « déconnecté » avec sa phrase.
- **E20.6** : « Exporter » → code frais (`data_export`) → POST → ligne dans « Vos demandes », message `data.done.access` (C17 + annonce). « Télécharger » → code frais → fichier enregistré. Repli de suppression → E20.7.
- **E20.7** : bouton → mot faux : erreur, focus au champ, annonce ; mot juste → code frais → POST → page « Votre compte est supprimé ». Fermer le repli vaut annulation (aucun bouton « Annuler »).
- **États non montrés, actuel préservé** : chargement (`PreferencesScreen.tsx:84`, `SessionsScreen.tsx:124`, proposé C09) ; illisible (`:89`, `:129`, proposé C08) ; échec d'un envoi (`preferences.unavailable`, `sessions.unavailable`, `data.unavailable`, proposé C17 erreur dans la section) ; occupé (« Retrait… », « Fermeture… ») ; navigateur non identifié (`sessions.unidentified`, icône `monitor`) ; export disponible, périmé, téléchargement échoué (`DataScreen.tsx:280`, `:271`, `:276`) ; suppression déjà demandée (`data.delete.open`) ; demande close (`completedAt`) ; hors ligne et CGU en attente (`AccountShell.tsx:67-79`, sous l'en-tête).
- **Responsive** : 1440, 1280 : sous-menu dans la colonne, retour masqué. 768 : retour visible. 375 : « Fermer » sous le texte, listes de suppression empilées, boutons rouges en largeur de contenu (321,6 px : libellé sur deux lignes à 320 px).
- **Clavier** : replis à Entrée ou Espace ; ordre du document. **Animations** : chevron `rotate` `duration-base` `ease-standard` ; retrait de ligne sans animation.

## 6. Critères d'acceptation
- **E20.4-CA01** Un seul sujet, sans carte ; titre 20 px.
- **E20.4-CA02** Valeur, date et origine en toutes lettres, six origines possibles.
- **E20.4-CA03** Un seul bouton, qui dit ce qu'il fait ; retrait en un geste ; message annoncé une fois.
- **E20.4-CA04** Les trois effets inchangés sont toujours visibles.
- **E20.5-CA01** Une ligne par session, liste nommée.
- **E20.5-CA02** Icône décorative déduite du système (téléphone : iOS, Android) ; aucun pays.
- **E20.5-CA03** « Cet appareil » en mots sur la session courante.
- **E20.5-CA04** Chaque « Fermer » a un nom accessible qui cite la session ; cible ≥ 44 px ; une session déjà fermée disparaît sans erreur.
- **E20.5-CA05** Le texte d'aide de RG143 est conservé, selon E20-Q15.
- **E20.5-CA06** L'avertissement est lu avant le bouton rouge ; deux gestes au moins pour tout fermer.
- **E20.6-CA01** L'écran ne dit jamais qu'une donnée est exportée avant qu'elle le soit.
- **E20.6-CA02** « Vos demandes » absent s'il est vide ; état et dates de chaque demande.
- **E20.6-CA03** Une seule demande d'export ouverte ; la phrase remplace le bouton.
- **E20.6-CA04** « Exporter » exige un code frais à chaque demande.
- **E20.6-CA05** Téléchargement : code frais, nombre restant et échéance écrits.
- **E20.6-CA06** La suppression est le dernier élément de la page, replié à l'arrivée.
- **E20.7-CA01** L'avertissement dit que c'est définitif, en gras, et « Téléchargez d'abord » seulement si un export existe.
- **E20.7-CA02** Deux listes côte à côte dès 640 px, même poids typographique.
- **E20.7-CA03** SUPPRIMER (FR) ou DELETE (EN), exact ; erreur liée au champ.
- **E20.7-CA04** Le bouton rouge n'envoie rien sans le mot.
- **E20.7-CA05** Aucune suppression sans code frais `account_deletion` ; page finale sans navigation.
- **E20.7-CA06** axe sans défaut, replis ouverts et fermés, à 375, 768, 1024, 1440, FR et EN.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E20.4-T01 | e2e, a11y | `e2e/account.spec.ts:37` : attend le texte exact « État : accordé » et un `status` ; `e2e/account-screens.spec.ts` | RG34, RG95 |
| E20.5-T01 | e2e | `e2e/account.spec.ts:89` : attend `t.help`, une liste nommée `sessions.title`, le bouton `sessions.close` | RG143 |
| E20.5-T02 | e2e | idem : bouton `closeAll` puis `alert` ; devient un repli | RG144, CA33 |
| E20.6-T01 | e2e | `e2e/account-data.spec.ts:50` (export) | RG57 |
| E20.6-T02 | unitaire, e2e | `tests/account-view.test.ts` ; téléchargement : aucun e2e aujourd'hui, nouveau | Export disponible |
| E20.7-T01 | e2e | `e2e/account-data.spec.ts` : attend `section` finale, `h2` « Zone de danger », `h3`, notice à bordure rouge et bouton ouvrant un écran ; à réécrire selon E20-Q16 | D72, 17 §6.3 |

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Cartes | `CARD_CLASSES` partout | sections à filet | faire évoluer (C03) |
| État | `PreferencesScreen.tsx:97` lignes | bloc C05 | faire évoluer |
| « Ne change pas » | `:133` notice `info`, puces | liste à coches | faire évoluer (C65) |
| Sessions | `SessionsScreen.tsx:139` cartes, aide en tête, bouton texte | lignes, aide en bas, « Fermer » secondaire | faire évoluer (C06) |
| Fermer la session courante | `:163` | retiré (déconnexion au pied ou E20.1) | supprimer (E20-Q14) |
| Tout fermer | `:171` carte, bouton puis confirmation et « Annuler » | repli | faire évoluer (C26) |
| Demandes | `DataScreen.tsx:386` carte, 3 lignes | ligne à icône | faire évoluer |
| Zone de danger | `:332` `h2`, notice rouge, bouton | repli rouge | faire évoluer (E20-Q16) |
| Confirmation | `:424` écran à part, titre propre | dans le repli | faire évoluer |
| Icônes | `icons.ts` | ajouter `monitor`, `smartphone`, `list-checks` | créer |

Données requises : toutes servies (`packages/contracts/src/account.ts` : consentement, sessions, demandes, export). Icône d'appareil : déduite de `browser.system`. Hors lot : conversation ouverte close à la suppression (Lot 4, 17 §6.3).

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E20-Q14 | Session courante sans « Fermer » ; code : « Fermer cette session (vous serez déconnecté) » | Geste retiré | Suivre la maquette (« Se déconnecter » existe) | product-owner | non |
| E20-Q15 | Aide raccourcie ; RG143 fixe le texte FR et EN, lu par `expert-conformite-rgpd` (« Deux appareils du même type se ressemblent donc : vérifiez aussi les dates. ») | Texte réglé par la spec | Garder `sessions.help` en entier, à la place de la maquette | expert-conformite-rgpd | oui |
| E20-Q16 | Suppression dans un repli « Supprimer mon compte » ; 17 §6.3 et D72 : `h2` « Zone de danger », encadré à bordure rouge, icône triangle, bouton rouge, écran de confirmation | Spec, tests | Suivre la maquette validée ; amender 17 §6.3, `20` ; le résumé du repli reste un titre (`h2` dans `summary`) | fondateur | oui |
| E20-Q17 | « immédiate » retiré de l'avertissement ; l'effacement est immédiat (D72) ; « Il ne vous est jamais envoyé par e-mail. » retiré de l'export | Information de la personne | Garder `data.danger.warning` et `export.how` | expert-conformite-rgpd | oui |
| E20-Q18 | Conservé : deux textes raccourcis ; lien des durées et phrase « nouvelle inscription » (RG70) retirés ; 17 §6.3 les exige ; DZ-7, veto possible | Obligation d'information | Garder les clés entières, le lien et la phrase, dans la même mise en forme | expert-conformite-rgpd | oui |
| E20-Q19 | « Exporter » disponible, export prêt, téléchargement, suppression déjà demandée, code frais non dessinés | États | Secondaire `md` aligné à gauche ; « Votre export est prêt » en première section ; code : E20-Q8 | expert-ux | non |
| E20-Q20 | « Fermer » 36 px < `size-touch-target`, trois boutons de même nom ; 2,25 rem, 16 rem hors tokens ; `li` sans bouton : colonne vide | Accessibilité, tokens | Zone active 44 px, `aria-label` avec le navigateur et la date ; tokens à nommer | expert-ux | non |
| E20-Q21 | Dates numériques et « aujourd'hui à 09 h 41 » ; code : `dateStyle long` | Format | Voir E20-Q12 ; « aujourd'hui » dans le fuseau du navigateur, sinon date | expert-ux | non |
| E20-Q22 | Pas d'« Annuler » dans la suppression ni dans « tout fermer » ; 17 §6.3 : « Annuler » à côté | Retour en arrière | Fermer le repli ; accepté | product-owner | non |
| E20-Q23 | Notice de succès insérée sous l'aide (`E20.4`) ; U31 : annonce unique | Double annonce | Notice sans `role`, annonce par C29 seul | expert-ux | non |
| E20-Q24 | Axe : `.m-state` hors repère (X11) ; aucun autre défaut ; X3 (480, 640), X13 | — | Voir X3, X11, X13 | expert-ux | non |

## 10. Écrans du périmètre sans maquette
Représentation proposée : gabarit C50 (page autonome, `surface-page`, colonne 576 px, carte dès 640 px), textes actuels, sans navigation, sauf arbitrage `expert-ux`. Les écrans de l'entrée, les erreurs et la 404 sont au §10 de `E11b-entree.md`.

| Écran | Route | Fichier | Textes | Proposition |
|---|---|---|---|---|
| CGU à ré-accepter (bloquant) | toute page sauf `/compte`, `/compte/preferences`, `/compte/donnees` | `account/TermsGate.tsx` (monté par `MemberShell.tsx:214`) | `account.terms.*` | Titre, texte dans une zone lisible à 640 px, « J'accepte » principal, « Je refuse et je me déconnecte » secondaire, droits accessibles ; attributs et tests `e2e/account.spec.ts:138,174` et `member-shell.spec.ts` TD5.6 a gardés |
| CGU en attente sur les pages exemptées | `/compte/preferences`, `/compte/donnees` | `account/AccountShell.tsx:68` | `account.terms.pendingNotice`, `.pendingLink` | C17 `info` sous l'en-tête |
| Déconnecté | toute page d'espace | `MemberShell.tsx:533` | `account.signedOut.*` (+ phrase d'origine) | C50, lien « Se reconnecter » |
| Compte supprimé | `/compte/donnees` | `MemberShell.tsx:554` | `account.data.deleted.*` | C50, `role=status` gardé |
| Espace illisible | toute page d'espace | `MemberShell.tsx:489` | `account.unavailable`, `.retry` | C08 dans le cadre, sans navigation |
| Chargement de l'espace | toute page d'espace | `MemberShell.tsx:477` | `auth.home.loading` | C09, cadre stable (17 §2.3) |
| Code frais (adresse, export, téléchargement, suppression) | pages du compte | `account/FreshCode.tsx` | `account.freshCode.*` | Contenu de E11.4 dans la section ; « Valider » → libellé par geste (U63), à écrire |
| Profil (`/compte/profil` et enfants) | voir E03, E10, E14, E15 | `account/AccountProfileScreen.tsx` | — | Hors de ce fichier |
| « Faire vérifier ma marque » | `/compte/profil/marque-verifiee`, `/en/account/profile/verified-brand` | `components/verification/` | `verification.json` | Non prototypé (07, écran 10 ; D34) : à confier à E10 ou E14 |
| Routes anglaises | `/brand`, `/creator`, `/account/*`, `/sign-in`, `/signup/*`, `/campaigns`, `/creators/*` | pages jumelles sous `(member)` | locales `en` | Même composant ; contenu EN absent des maquettes (X13) |
| `contestation` FR | `/compte/profil/verification/contestation` déclaré (`member-paths.ts:107`), page `appeal` seule trouvée sous `account/…` | `app/[locale]/(member)/(space)/` | — | Vérifier l'existence de la page FR (voir E14) |
