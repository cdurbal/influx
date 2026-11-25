# E20 — Mon compte : page-menu, informations, changement d'adresse (marque, créateur)
> Maquette : `proto-compte.html` (états `hub`, `infos`, `email`, `email-codes`, `email-fait`) · page de comparaison `ecran-20-compte.html` · validée le 2026-11-24 (07) · Constats : U33, U51, U63. E20.4 à E20.7 et les écrans sans maquette : `E20b-compte.md`. Coquille : E01.0. La maquette ne montre que la marque.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E20.1 | Page-menu | `/fr/compte` | `/en/account` | `account/AccountHub.tsx:45` | `hub` | S | E01.0 |
| E20.2 | Mes informations | `/fr/compte/informations` | `/en/account/details` | `account/DetailsScreen.tsx:43` | `infos` | M | C25, E10 |
| E20.3 | Changement d'adresse | même adresse que E20.2 | idem | `account/EmailChange.tsx:61`, `FreshCode.tsx:38` | `email`, `email-codes`, `email-fait` | L | C49, C51 |

Fonctionnalités existantes à préserver :
- Cadre du compte : retour « ‹ Mon compte » (« Retour à Mon compte » pour lecteur d'écran), bandeau hors ligne, notice des CGU en attente (`AccountShell.tsx:53-80`).
- Page-menu : liens seuls, aucune `nav`, ordre `accountPagesOf()` (`lib/member-paths.ts:232`) : profil, informations, préférences, sessions, données ; libellé du profil selon le rôle (`:241`) ; exemptée des CGU (`:256`).
- Informations : seuls les champs modifiés partent, ceux du rôle seulement (`account-view.ts:67`) ; `lead.updated` côté API (RG15, RG73) ; pays refusé : pays précédent gardé (`account.details.messages.countryUnavailable`) ; `refresh()` relit le compte (`DetailsScreen.tsx:86`).
- Nom de la marque publiée : le nouveau nom attend la relecture (`companyNamePending`, `packages/contracts/src/account.ts:50`).
- Adresse : code frais obligatoire, usage unique, 300 s (RG57) ; demande ouverte relue au montage (`EmailChange.tsx:78`) ; deux codes, 24 h, ancienne adresse valable d'ici là (RG58) ; refus 400 ou 503 : code frais consommé ; 429 : refus avant consommation ; fins de demande (`tooManyAttempts`, `expired`, `gone`, `addressUnavailable`) ; annulation ; autres sessions fermées à la fin.

API : GET `/v1/me`, PATCH `/v1/me`, GET et POST `/v1/me/email-change`, POST `/v1/me/email-change/confirm`, DELETE `/v1/me/email-change/:id`, POST `/v1/me/reauthenticate/request-code` et `/verify-code` (`account-api.ts:62-185`), POST `/v1/auth/logout`.

## 2. Structure
- Cadre E01.0-S17, colonne `.cp` : 768 px max (`container-narrow`), gap `spacing-6` (32 px) à toutes les largeurs.
- En-tête : gap `spacing-2` ; `h1` **20 px** (`title-section`) 800, 23 px de haut ; retour de 21,7 px sous 1 024 px.
- Section : filet haut `border-default`, padding haut `spacing-5` (24 px), gap `spacing-4` ; `h2` 16 px 700 ; aucune carte.
- E20.2 à 1440 : en-tête (48) → « Votre compte » (160,6 ; 387,6 de haut) → « Adresse e-mail de connexion » (580,1 ; 185,2). Deux colonnes de 372 px (gap `spacing-5`) pour pays et langue dès 640 px ; une colonne dessous.
- E20.3 à 1440 : même page ; la seconde section grandit (413,7 saisie ; 494,9 codes). Les deux codes : deux colonnes de 376 px (gap `spacing-4`) dès 640 px.
- E20.1 : en-tête (52,7) → liste (lignes de 75,5 px) → bouton. Aucune zone collante.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E20.1-S01 | En-tête | C02 | `h1` « Mon compte » 20 px 800 | Toujours | `hub`, `.t-page` | E20.1-CA01 | E20.1-T01 |
| E20.1-S02 | En-tête | C02 | « Connecté avec {e-mail} » `text-sm` `text-secondary` | Toujours | `hub`, `.cp-head p` | E20.1-CA01 | E20.1-T01 |
| E20.1-S03 | Menu | C06 | 5 lignes, filets `border-subtle`, min 60 px, padding `spacing-3 spacing-2` ; libellé `font-display` 16 px 700, lien étiré | Toujours | `.hubl li` | E20.1-CA02 | E20.1-T01 |
| E20.1-S04 | Menu | C06 | Phrase `text-sm` `text-secondary` sous le libellé | Par ligne | `.hubl .s` | E20.1-CA02 | E20.1-T01 |
| E20.1-S05 | Menu | C06 | Chevron 16 px `text-tertiary`, centré sur la ligne, décoratif | Par ligne | `.hubl .chev` | E20.1-CA02 | E20.1-T01 |
| E20.1-S06 | Bas | C10 | « Se déconnecter » secondaire, icône `log-out` 16 px, 195,2 × 46,8, à gauche | Toujours dans la maquette (E20-Q4) | `hub`, `.btn` | E20.1-CA03 | E20.1-T02 |
| E20.2-S01 | Retour | C11 | « ‹ Mon compte » `text-sm` 600, chevron 16 px | < 1 024 px | `infos`, `.go.lg-hide` | E20.2-CA01 | E20.2-T01 |
| E20.2-S02 | En-tête | C02 | `h1` 20 px 800 ; état d'enregistrement à droite, dessous à 375 | Toujours | `.row.between` | E20.2-CA01 | E20.2-T01 |
| E20.2-S03 | En-tête | C25 | `check` 16 px + « Enregistré automatiquement » `text-sm` `text-secondary` ; échec : `feedback-error-text` 600 et « Réessayer » | Toujours | `.save` | E20.2-CA02 | E20.2-T02 |
| E20.2-S04 | En-tête | C02 | Phrase `text-md` `text-secondary` + lien souligné vers la politique | Toujours | `.cp-head > .c2` | E20.2-CA01 | E20.2-T01 |
| E20.2-S05 | Compte | C03 | `h2` « Votre compte » | Toujours | `#h-acc` | E20.2-CA03 | E20.2-T01 |
| E20.2-S06 | Compte | C18 | Nom de l'entreprise : aide au-dessus avec lien « profil de marque », champ 48 px, 120 caractères | Marque | `#i-co` | E20.2-CA04 | E20.2-T03 |
| E20.2-S07 | Compte | C18 | Pays : aide, liste 48 px avec chevron (372 px à 1440) | Toujours | `#i-country` | E20.2-CA03 | E20.2-T03 |
| E20.2-S08 | Compte | C22 | Langue : segmenté 170 × 44 | Toujours | `.seg` | E20.2-CA05 | E20.2-T03 |
| E20.2-S09 | Compte | C21 | Statut : deux radios 24 px sur une ligne (gap `spacing-6`), empilées à 375 | Marque dans la maquette ; contredit (E20-Q2) ; créateur : oui | `.choices` | E20.2-CA06 | E20.2-T03 |
| E20.2-S10 | Adresse | C03 | `h2` « Adresse e-mail de connexion » | Toujours | `#h-mail` | E20.2-CA03 | E20.2-T01 |
| E20.2-S11 | Adresse | C05 | Bloc `surface-raised`, `radius-md`, padding `spacing-3 spacing-4` : « Vous vous connectez avec {e-mail gras} » | Sauf état final | `.ro` | E20.2-CA07 | E20.2-T04 |
| E20.2-S12 | Adresse | C10 | « Changer d'adresse » secondaire 193,4 × 36, à droite ; dessous à 375 | Aucune demande ouverte | `infos`, `.ro .btn` | E20.2-CA07 | E20.2-T04 |
| E20.2-S13 | Adresse | C18 | Explication `text-sm` `text-secondary` | Aucune demande ouverte | `infos`, `.sec > .sm` | E20.2-CA07 | E20.2-T04 |
| E20.3-S01 | Étapes | C51 | Liste ordonnée de 3, pastille 28 px `surface-raised`, numéro 12 px 700 ; lignes de 28 px, gap 8 | Demande en cours | `email`, `.eprog` | E20.3-CA01 | E20.3-T01 |
| E20.3-S02 | Étapes | C51 | Courante : pastille `surface-active`, texte `text-primary` 600 ; faite : « ✓ » `feedback-success-text` sur `feedback-success-bg` | Selon l'étape | `.cur`, `.done` | E20.3-CA01 | E20.3-T01 |
| E20.3-S03 | Étape 1 | C18 | « Nouvelle adresse e-mail » : champ 416 px (26 rem) × 48, `type=email`, `inputmode=email` | Étape 1 | `#new-mail` | E20.3-CA02 | E20.3-T02 |
| E20.3-S04 | Étape 1 | C19 | Erreur de format ou « déjà votre adresse » ; s'efface à la frappe | Clic refusé (script, non capturé) | `#nm-err` | E20.3-CA02 | E20.3-T02 |
| E20.3-S05 | Étape 1 | C18 | Phrase `text-xs` `text-secondary` | Étape 1 | `.xs` | E20.3-CA02 | E20.3-T01 |
| E20.3-S06 | Étape 1 | C10 | « Continuer » principal 127,2 × 44,8 ; « Annuler » bouton texte | Étape 1 | `#nm-go`, `.btn--text` | E20.3-CA03 | E20.3-T02 |
| E20.3-S07 | Étape 2 | C49 | Confirmation d'identité (écran du code de E11.4, purpose `email_change`) : non dessinée | Étape 2 | non montré | E20.3-CA04 | E20.3-T03 |
| E20.3-S08 | Étape 3 | C18 | Paragraphe `text-sm` `text-primary` : codes partis, adresse inchangée (gras) | Étape 3 | `email-codes`, `.estep > .sm` | E20.3-CA05 | E20.3-T03 |
| E20.3-S09 | Étape 3 | C49 | Côté confirmé : étiquette + `circle-check` « Code confirmé » `feedback-success-text` 600 `text-sm` | Côté confirmé | `.ok-line` | E20.3-CA05 | E20.3-T03 |
| E20.3-S10 | Étape 3 | C49 | Côté à confirmer : étiquette (mention entre parenthèses `text-sm` `text-secondary`), champ 192 px (12 rem) tabulaire, interlettrage 0,3 em, `one-time-code` | Côté non confirmé | `#c-new` | E20.3-CA05 | E20.3-T03 |
| E20.3-S11 | Étape 3 | C19 | Erreur sous le champ (script) | Code incomplet ou refusé | `#cn-err` | E20.3-CA06 | E20.3-T03 |
| E20.3-S12 | Étape 3 | C10 | « Confirmer ce code » secondaire 190,3 × 46,8, à gauche | Côté non confirmé | `#cn-go` | E20.3-CA06 | E20.3-T03 |
| E20.3-S13 | Étape 3 | C18 | « En attente de confirmation : {1} sur 2 · expire le {date}. » `text-sm` `text-secondary` | Étape 3 | `.estep > .sm.c2` | E20.3-CA07 | E20.3-T03 |
| E20.3-S14 | Étape 3 | C11 | « Annuler la demande » bouton-lien souligné `text-sm` | Étape 3 | `#e-cancel` | E20.3-CA07 | E20.3-T03 |
| E20.3-S15 | Fin | C17 | Notice `success`, `circle-check`, nouvelle adresse en gras ; remplace le bloc S11 et les étapes | Deux codes confirmés | `email-fait`, `.notice--success` | E20.3-CA08 | E20.3-T03 |

## 4. Textes
EN « à écrire » = à écrire (expert-marketing). Clés : `account.json`.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E20.1-S01 | Mon compte | My account | `hub.title` |
| E20.1-S02 | Connecté avec {claire.morel@example.test} | Signed in as {email} | `auth.json` `home.signedInAs` |
| E20.1-S03 | Profil de marque · Mes informations · Mes préférences · Mes sessions · Mes données | Brand profile · My details · My preferences · My sessions · My data | `nav.*` (créateur : `nav.accountProfileCreator`) |
| E20.1-S04 | Votre marque, ce que vous cherchez, votre interlocuteur · Adresse e-mail, pays, langue · Les e-mails que vous recevez · Les appareils connectés à votre compte · Exporter ou supprimer vos données | valeurs des clés | `hub.items.*` |
| E20.1-S06 | Se déconnecter | Sign out | `member.json` `shell.footer.signOut` |
| E20.2-S01 | Mon compte | My account | `hub.back` (+ `hub.backPrefix` masqué) |
| E20.2-S02 | Mes informations | My details | `details.title` |
| E20.2-S03 | Enregistré automatiquement · Enregistrement… · Enregistré à {9 h 41} · Non enregistré — nouvelle tentative dans 5 s · Réessayer | à écrire ou clés de l'enregistrement de E10 | C25 (commun) |
| E20.2-S04 | Les informations de votre compte. Elles servent à votre commercial INFLUX et à nos e-mails. Comment nous utilisons ces informations | The details of your account. Your INFLUX account manager and our emails use them. How we use these details | `details.lead`, `details.privacy` |
| E20.2-S05 | Votre compte | à écrire | nouvelle |
| E20.2-S06 | Nom de l'entreprise | Company name | `details.company.label` |
| E20.2-S06 | La raison sociale. Le nom que lisent les créateurs se change dans votre profil de marque. | à écrire | nouvelle (E20-Q1) |
| E20.2-S07 | Pays · Les mises en relation s'ouvrent pays par pays. | Country · Introductions open country by country. | `details.country.*` |
| E20.2-S08 | Langue de vos e-mails et de votre espace · Français · English | Language of your emails and your space · … | `details.language.*` |
| E20.2-S09 | Vous êtes inscrit en tant que · Particulier · Professionnel (société, entreprise individuelle, agence) | You signed up as · Individual · Professional (company, sole trader, agency) | `details.status.*` |
| E20.2-S10 | Adresse e-mail de connexion | Sign-in email address | `email.title` |
| E20.2-S11 | Vous vous connectez avec {e-mail} | You sign in with {email}. | `email.current` (avec point) |
| E20.2-S12 | Changer d'adresse | Change address | `email.start` |
| E20.2-S13 | Pour changer d'adresse, nous vérifions d'abord que c'est bien vous. Un code part ensuite à chacune des deux adresses : votre adresse ne change qu'une fois les deux codes saisis. | à écrire | diffère de `email.how` (« , dans les 24 heures » retiré) |
| E20.3-S01 | Saisir la nouvelle adresse · Confirmer que c'est bien vous · Saisir les deux codes reçus ; nom de la liste : Étapes du changement d'adresse | à écrire | nouvelles |
| E20.3-S03 | Nouvelle adresse e-mail | New email address | `email.newLabel` |
| E20.3-S04 | Cette adresse n'a pas un format valide (exemple : nom@exemple.com). · C'est déjà votre adresse de connexion. Saisissez une autre adresse. | valeurs des clés | `auth.json` `emailErrors.format` (E11-Q8) · `email.messages.sameAsCurrent` |
| E20.3-S05 | Nous vérifions l'adresse ici, avant de vous demander un code : une faute de frappe ne vous coûte rien. | à écrire | nouvelle |
| E20.3-S06 | Continuer · Annuler | à écrire · Cancel | nouvelle · `cancel` |
| E20.3-S08 | Un code vient de partir à chacune des deux adresses. Votre adresse de connexion reste {e-mail} tant que les deux codes n'ont pas été saisis. | à écrire · valeur de la clé | nouvelle · `email.pending.stays` |
| E20.3-S09 | Code confirmé | à écrire | diffère de `email.pending.confirmed` |
| E20.3-S09, S10 | Code reçu à {e-mail} (adresse actuelle) · Code reçu à {e-mail} (nouvelle adresse) | valeurs des clés | `email.pending.oldLabel`, `.newLabel` |
| E20.3-S11 | Le code comporte 6 chiffres. | The code has 6 digits. | `email.messages.format` |
| E20.3-S12 | Confirmer ce code | Confirm this code | `email.pending.confirm` (FR à changer, U63) |
| E20.3-S13 | En attente de confirmation : {1} sur 2 · expire le {25/11/2026 à 10 h 12}. | valeur de la clé | `email.pending.status` (date seule aujourd'hui) |
| E20.3-S14 | Annuler la demande | Cancel the request | `email.pending.cancel` |
| E20.3-S15 | C'est fait : vous vous connectez désormais avec {e-mail}. Vos autres sessions ont été fermées. | valeur de la clé | `email.completed` |
| Annonces | Vérification faite. Un code part à chacune des deux adresses. · Adresse changée. Vos autres sessions ont été fermées. · Demande annulée. Votre adresse de connexion n'a pas changé. | à écrire · à écrire · valeur de la clé | nouvelles · `email.pending.cancelled` |

## 5. Interactions, états, responsive, clavier
- **E20.1** : ligne → page ; « Se déconnecter » → page « Vous êtes déconnecté ».
- **E20.2** : saisie → enregistrement (600 ms dans la maquette), statut visible, annonce de l'échec seulement ; « Réessayer » → nouvel envoi, annonce « Modifications enregistrées. ». Lien du nom → `/compte/profil` (étape 1 de E10). Réponse refusée : message lié au champ, ancienne valeur gardée pour le pays. Changement de langue : langue enregistrée, la page ne change pas d'adresse (actuel).
- **E20.3** : « Changer d'adresse » → étape 1, focus au champ ; « Continuer » → contrôle local → étape 2 (code frais à l'adresse actuelle, phrase de correspondance) → à la vérification, POST `/v1/me/email-change` sans nouvelle saisie → étape 3. « Confirmer ce code » par côté. « Annuler » (étape 1) et « Annuler la demande » (étape 3) → E20.2. Aucune autre confirmation.
- **États non montrés, actuel préservé** : chargement de la demande (`EmailChange.tsx:136`) ; erreur de service, plafond, non délivrable (`:110`, `account.email.messages.*` ; proposé : retour à l'étape 1 avec C19) ; deux côtés à confirmer (proposé : S10 deux fois) ; fin de demande (`:259`, proposé C17 erreur dans la section) ; code frais : erreurs `freshCode.messages.*` (`FreshCode.tsx:158`) ; hors ligne : C17 `warning` sous l'en-tête (`AccountShell.tsx:67`) ; CGU en attente : C17 `info` (`:68`) ; nom en attente de relecture (`companyNamePending`) : non montré, aide proposée sous le champ.
- **Responsive** : 1440 et 1280 : colonne de navigation avec sous-menu, retour masqué. 768 : retour visible, deux colonnes. 375 : une colonne, état d'enregistrement sous le titre, bouton d'adresse sous l'adresse, codes empilés. Aucun débordement à 320 px.
- **Clavier et focus** : focus au titre de l'étape 2 (actuel `FreshCode.tsx:67`), puis au champ du code ; à l'étape 3, premier champ. **Animations** : survol de ligne `background-color` (non défini dans la maquette pour `.hubl` : garder l'existant `hover:bg-surface-raised`) ; aucune autre.

## 6. Critères d'acceptation
- **E20.1-CA01** `h1` « Mon compte » et adresse de connexion ; sur la page-menu l'entrée « Compte » est courante.
- **E20.1-CA02** Cinq lignes dans l'ordre, une seule cible par ligne, phrase du rôle ; aucune `nav` dans `main`.
- **E20.1-CA03** La déconnexion est possible sur téléphone sans la colonne.
- **E20.2-CA01** Titre 20 px, retour sous 1 024 px avec « Retour à » pour lecteur d'écran, cible ≥ 44 px.
- **E20.2-CA02** Statut visible à chaque enregistrement ; annonce vocale de l'échec et de la reprise seulement.
- **E20.2-CA03** Seuls les champs modifiés partent ; un refus n'efface aucune saisie.
- **E20.2-CA04** Le nom suit l'arbitrage E20-Q1 ; le lien mène au profil.
- **E20.2-CA05** Langue en deux radios segmentées, aux flèches.
- **E20.2-CA06** Statut au créateur seulement, sauf arbitrage E20-Q2 ; la marque n'envoie jamais `declaredStatus`.
- **E20.2-CA07** Adresse actuelle toujours écrite ; un seul bouton ouvre le changement.
- **E20.3-CA01** Trois étapes numérotées, l'étape courante en `aria-current="step"`, l'étape faite dite en texte.
- **E20.3-CA02** Une adresse mal formée ou identique ne déclenche aucun appel ni code (U33).
- **E20.3-CA03** « Annuler » à l'étape 1 n'a aucun effet serveur.
- **E20.3-CA04** Le code frais est demandé après l'adresse ; jeton gardé en mémoire seule, oublié après usage.
- **E20.3-CA05** L'adresse de connexion reste l'ancienne tant que les deux codes ne sont pas saisis, et l'écran le dit.
- **E20.3-CA06** Chaque côté se confirme séparément ; erreurs et essais restants sous le champ.
- **E20.3-CA07** L'échéance affiche date et heure dans la langue ; annulation confirmée par une annonce.
- **E20.3-CA08** À la fin, l'identité de la colonne montre la nouvelle adresse.
- **E20.3-CA09** axe sans défaut sur les cinq états, à 375, 768, 1024, 1440, FR et EN.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E20.1-T01 | e2e, a11y | `e2e/account.spec.ts` (page-menu, FR et EN), `e2e/member-shell.spec.ts` TN6, `e2e/account-screens.spec.ts` | Menu, une seule `nav` |
| E20.1-T02 | e2e | `e2e/member-shell.spec.ts` TD5.6 c, nouveau cas à 375 | Déconnexion |
| E20.2-T01 | visuel, a11y | `e2e/account-screens.spec.ts`, `e2e/member-shell.spec.ts` (`backToHub`) | Rendu, retour |
| E20.2-T02 | e2e | nouveau cas dans `e2e/account.spec.ts` | Enregistrement au fil de la saisie |
| E20.2-T03 | unitaire, e2e | `tests/account-view.test.ts` ; nouveau cas (aucun test e2e du bouton « Enregistrer » aujourd'hui) | Champs du rôle |
| E20.2-T04 | e2e | `e2e/account.spec.ts` (changement d'adresse) | Section adresse |
| E20.3-T01 | visuel | `e2e/account-screens.spec.ts`, nouveau cas | Étapes |
| E20.3-T02 | unitaire | `tests/account-view.test.ts` (contrôle local) | U33 |
| E20.3-T03 | e2e | `e2e/account.spec.ts:195` : ordre à inverser (adresse avant code) ; attend `email.newLabel`, `freshCode.*`, `pending.*` | RG57, RG58 |

`e2e/account.spec.ts:206-209` entre par `auth.goToSpace` et `account.homeLink`, retirés : passer par la navigation.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Menu | `AccountHub.tsx:54-76` : icône par ligne, chevron 20 px `text-secondary` | sans icône, chevron 16 px ; libellé `font-display` | faire évoluer |
| Adresse et déconnexion | absentes | S02, S06 | créer |
| Retour | `AccountShell.tsx:53` à toutes largeurs, 44 px | < 1 024 px, 21,7 px | faire évoluer (E20-Q6) |
| Ordre | adresse puis formulaire (`DetailsScreen.tsx:108`) | formulaire puis adresse | faire évoluer |
| Enregistrement | bouton (`:206`) | au fil de la saisie (C25) | faire évoluer |
| Langue | liste (`:136`) | segmenté | faire évoluer |
| Cartes | `CARD_CLASSES` | sections à filet | faire évoluer (C03) |
| Changement d'adresse | code frais puis adresse (`EmailChange.tsx:143-191`) | adresse puis code frais | faire évoluer |
| `updateMe` par bouton | `account-api.ts:62` | appels automatiques | faire évoluer (E20-Q3) |

Données requises : toutes servies (GET `/v1/me`, GET `/v1/me/email-change` ; `expiresAt` porte l'heure). Raison sociale distincte du nom public : non servie (E20-Q1). Hors lot : néant.

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E20-Q1 | « La raison sociale. Le nom que lisent les créateurs se change dans votre profil » ; `companyName` est **un seul** champ (compte et profil, `account.ts:49`, `brand-profile.ts:404`) et c'est le **nom commercial** (`06` RG15, ligne 132) ; la raison sociale est une donnée interne demandée au badge (`06` RG47) | Texte faux aujourd'hui ; une marque publiée qui modifie ce champ part en relecture | Nom en lecture seule ici, lien « Modifier dans mon profil » (U51, `03`) ; pas de second champ | product-owner | oui |
| E20-Q2 | Statut modifiable par la marque ; RG22 : toujours professionnel ; l'API l'interdit (`account-view.ts:64`) | PATCH refusé | Afficher au créateur seulement | product-owner | oui |
| E20-Q3 | Enregistrement au fil de la saisie ; chaque modification émet `lead.updated` (RG15, RG73) ; nom publié : relecture à chaque pause | Rafale d'événements Brevo et Apollo | Pays, langue, statut : au choix ; nom : au départ du champ | architecte | oui |
| E20-Q4 | « Se déconnecter » dans la page-menu à toutes largeurs (doublon du pied dès 1 024) ; `ecran-20` : téléphone | Doublon | Sous 1 024 px seulement | expert-ux | non |
| E20-Q5 | Icônes de ligne retirées ; 17 §6.0 et `20` §11.8 (page-menu) les exigent ; variante créateur non dessinée | Spec | Suivre la maquette ; `nav.accountProfileCreator` et `hub.items.accountProfileCreator` | expert-ux | non |
| E20-Q6 | Retour de 21,7 px (`min-height: auto`), masqué dès 1 024 ; 17 §2.3 et test : présent à toutes largeurs ; bouton d'adresse 36 px < `size-touch-target` | Cibles sous 44 px | Zone active de 44 px sans changer le dessin ; suivre le masquage ; amender 17 §2.3 | expert-ux | non |
| E20-Q7 | `h1` 20 px (E20) contre 28 px (E01, `20` §11.5 `text-title-page`) | Titres différents d'une page à l'autre | Confirmer 20 px pour le compte ou 28 px partout | expert-ux, fondateur | oui |
| E20-Q8 | Étape 2 « simulée » (`ecran-20` §3) ; non dessinée dans la section | Gabarit de l'étape | Contenu de E11.4 (phrase, cases, renvoi) dans la section, sans carte | expert-ux | non |
| E20-Q9 | « dans les 24 heures » retiré de l'explication ; RG58, 17 §6.1 | Information sur le délai | Garder la clé `email.how` | product-owner | non |
| E20-Q10 | Refus serveur après le code frais (adresse non délivrable, panne) toujours consommant : U33 traité en local seulement | Nouveau code demandé | Accepté ; message à l'étape 1 | architecte | non |
| E20-Q11 | Largeurs 26, 12 rem, pastille 1,75 rem, interlettrage 0,3 em hors tokens ; « ✓ » en contenu CSS (non lu, couleur) ; X3 | Tokens, accessibilité | Icône `check` + texte masqué « fait » ; tokens à nommer | expert-ux | non |
| E20-Q12 | Dates « 25/11/2026 à 10 h 12 » ; code : `dateStyle long` sans heure (`account-view.ts:30`) | Format | `dateStyle short` + `timeStyle short` dans la langue (à confirmer pour E20.4 à E20.6) | expert-ux | non |
| E20-Q13 | `companyNamePending`, pays refusé, hors ligne, CGU en attente, deux codes à saisir, fins de demande non dessinés ; X11 (`.m-state`), X13 | États | §5 | expert-ux | non |
