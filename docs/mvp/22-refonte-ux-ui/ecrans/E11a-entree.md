# E11 — Inscription et connexion : porte, e-mail, code (visiteur, marque, créateur)
> Maquette : `proto-entree.html` (états `porte`, `email`, `email-erreur`, `connexion`, `code`, `code-connexion`, `code-erreur`, `code-aide`) · page de comparaison `ecran-11-entree.html` · validée le 2026-11-24 (07) · Constats : U25, U47, U48, U53, U63. E11.5 à E11.7 et les écrans sans maquette : `E11b-entree.md`. Questions numérotées en continu sur les deux fichiers.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E11.1 | Porte | `/fr/inscription` | `/en/signup` | `auth/DoorStep.tsx:13` dans `AuthFlow.tsx:269` | `porte` | S | C50 |
| E11.2 | E-mail, inscription | `/fr/inscription/marque`, `/createur` | `/en/signup/brand`, `/creator` | `auth/EmailStep.tsx:33` | `email`, `email-erreur` (et `email-createur`, non relevé) | M | C50 |
| E11.3 | E-mail, connexion | `/fr/connexion` | `/en/sign-in` | `auth/EmailStep.tsx:33` (`door` nul) | `connexion` | S | E11.2 |
| E11.4 | Code | même adresse que l'étape e-mail | idem | `auth/CodeStep.tsx:41`, `CodeNotReceived.tsx:29` | `code`, `code-connexion`, `code-erreur`, `code-aide` | M | C49 |

Fonctionnalités existantes à préserver :
- Un seul composant de parcours, réponses en mémoire, jamais stockées (`AuthFlow.tsx:72`, `journey-memory.ts`) ; reprise au rechargement par les cookies de parcours, délai 3 s (`:67`, `:137`) ; changement de langue sans perte (`:179`, D66).
- Porte choisie reportée dans l'adresse sans navigation (`:185`) ; changement de porte : consentement décoché, champs effacés (`signup-form.ts` `draftAfterDoorChange`, `05` RG4).
- Source d'acquisition et code d'invitation lus à l'arrivée, ancre retirée (`:118-133`, RG120).
- Double envoi sans effet, hors ligne expliqué, saisie conservée (`EmailStep.tsx:62`, RG110).
- Réponse identique quelle que soit l'adresse (RG46, RG113). Sixième chiffre = envoi ; code sélectionné après une erreur (`CodeStep.tsx:118,134`). Tentatives épuisées : champ retiré (`:202`, RG137).
- Compte à rebours annoncé toutes les 10 s (`auth-steps.ts:157`, RG50). Canal de secours : autre adresse exigée différente (`auth-steps.ts:270`, RG65).
- Après le code, l'espace suit le rôle réel (`AuthFlow.tsx:197`) ; adresse inconnue en connexion → choix de porte puis E11.5 (`:214`).

API : GET `/v1/auth/journey`, POST `/v1/auth/journey/reset`, POST `/v1/auth/request-code`, POST `/v1/auth/verify-code`, POST `/v1/support/code-not-received` (`member-auth.ts:33-87`).

## 2. Structure
- Page : `min-height 100dvh`, `surface-page`, colonne. En-tête : INFLUX à gauche, langue à droite ; padding `spacing-4 page-gutter` ; 78,8 px de haut ; pas de filet. `main` : padding `spacing-6 page-gutter section-header`, contenu centré horizontalement, commençant à 110,8 px à toutes les largeurs.
- E11.1 : colonne de 576 px (36 rem) : 432 → 1008 à 1440 ; 96 → 672 à 768 ; 343 px à 375. Titre, 24 px (`spacing-5`), portes (2 colonnes de 280 px, gap `spacing-4`, dès 640 px ; une colonne dessous), 24 px, ligne « Déjà inscrit ? ». Sans carte englobante.
- E11.2 à E11.4 : colonne de 448 px (28 rem) : 496 → 944 à 1440 ; 160 → 608 à 768 ; 343 à 375. Dès 640 px : carte (filet `border-default`, `radius-card`, `surface-card`, padding `inset-card` = 32 à partir de 1 024, 24 dessous) ; sous 640 px : ni filet, ni fond, ni padding. Gap interne `spacing-5` (24 px) ; en-tête d'étape : gap `spacing-2`.
- E11.4 : ordre : méta, `h1`, destinataire, phrase, champ code, aide, bouton, ligne renvoi/aide, panneau d'aide déplié (filet haut, padding haut `spacing-4`, gap `spacing-4`).
- Aucune zone collante. Aucun halo.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E11.1-S01 | En-tête | C50 | INFLUX `font-display` 700, cible 44 px | Toujours | tous, `.m-brand` | E11.1-CA01 | E11.1-T01 |
| E11.1-S02 | En-tête | C10 | Langue : pilule secondaire `md` 105,7 × 46,8 | Toutes étapes sauf écrans d'issue | tous, `.a-head .btn` | E11.1-CA05 | E11.1-T02 |
| E11.1-S03 | Titre | C02 | `h1` 20 px 700, `tracking-heading`, interligne 31 px | Toujours | `porte`, `h1` | E11.1-CA01 | E11.1-T01 |
| E11.1-S04 | Titre | C02 | Phrase `text-md` `text-secondary`, à 8 px | Toujours | `porte`, `.a-top p` | E11.1-CA01 | E11.1-T01 |
| E11.1-S05 | Portes | C04 | Carte cliquable : filet `border-strong`, padding `inset-card`, gap `spacing-3` ; 280 × 182,2 à 1440 ; 343 × 144,5 à 375 ; survol `surface-raised`, `border-hover`, `translate-lift` | Une par porte | `porte`, `.door` | E11.1-CA02 | E11.1-T01 |
| E11.1-S06 | Portes | C04 | Icône 24 px `text-brand-strong` : `megaphone` (marque), `sparkles` (créateur) | Par carte | `.door .i--lg` | E11.1-CA02 | E11.1-T01 |
| E11.1-S07 | Portes | C04 | `h2` 16 px 700, zone active étirée sur la carte | Par carte | `.door h2 .cover` | E11.1-CA03 | E11.1-T02 |
| E11.1-S08 | Portes | C04 | Public visé `text-sm` `text-secondary` | Par carte | `.door p` | E11.1-CA02 | E11.1-T01 |
| E11.1-S09 | Bas | C11 | « Déjà inscrit ? Me connecter » centré, `text-sm`, lien 600 souligné | Inscription ; pas après un code vérifié | `porte`, `.a-alt` | E11.1-CA04 | E11.1-T02 |
| E11.2-S01 | Méta | C50 | « Étape 1 sur 3 » · « Inscription marque » `text-sm` `text-secondary`, chiffres tabulaires | Inscription | `email`, `.a-meta` | E11.2-CA01 | E11.2-T01 |
| E11.2-S02 | Méta | C11 | « Changer » lien souligné 600 `text-sm` → E11.1 | Inscription | `email`, `.a-meta .link` | E11.2-CA02 | E11.2-T02 |
| E11.2-S03 | Titre | C02 | `h1` 20 px 700 | Inscription | `email`, `h1` | E11.2-CA01 | E11.2-T01 |
| E11.2-S04 | Titre | C02 | Phrase sans mot de passe, `text-secondary`, toujours visible | Toujours | `email`, `.a-top > .c2` | E11.2-CA01 | E11.2-T01 |
| E11.2-S05 | Champ | C18 | Étiquette 600, champ 48 px, filet `border-strong`, `surface-page`, `radius-md` ; sans astérisque | Toujours | `#mail` | E11.2-CA03 | E11.2-T01 |
| E11.2-S06 | Champ | C19 | Erreur : `circle-alert` 16 px + texte `text-sm` 600 `feedback-error-text` ; champ : filet 2 px `border-error` | Format invalide au clic ; s'efface dès la frappe | `email-erreur`, `#mail-err` | E11.2-CA04 | E11.2-T03 |
| E11.2-S07 | Action | C10 | « Recevoir mon code » principal pleine largeur 44,8 px | Toujours | `#send-code` | E11.2-CA05 | E11.2-T03 |
| E11.2-S08 | Mention | C26 | Replié : résumé `text-sm` 600 `text-secondary`, 44 px, chevron 16 px qui pivote de 90° ; corps `text-sm` `text-secondary`, lien | Toujours (E11-Q1) | `details.fold` | E11.2-CA06 | E11.2-T02 |
| E11.2-S09 | Bas | C11 | « Déjà inscrit ? Me connecter » sous la carte, centré | Inscription | `email`, `.a-alt` | E11.2-CA02 | E11.2-T02 |
| E11.3-S01 | Titre | C02 | `h1` « Me connecter » ; ni étape, ni rôle, ni « Changer » | Connexion | `connexion`, `h1` | E11.3-CA01 | E11.3-T01 |
| E11.3-S02 | Corps | C18 | Phrase, champ, bouton, mention repliée : identiques à E11.2-S04 à S08 | Connexion | `connexion`, `#f-email` | E11.3-CA01 | E11.3-T01 |
| E11.3-S03 | Bas | C11 | « Pas encore de compte ? Rejoindre INFLUX » → E11.1 | Connexion | `connexion`, `.a-alt` | E11.3-CA02 | E11.3-T02 |
| E11.4-S01 | Méta | C50 | « Étape 2 sur 3 · Inscription marque » ; « Connexion » en connexion | Selon parcours | `code`, `code-connexion`, `.a-meta` | E11.4-CA01 | E11.4-T01 |
| E11.4-S02 | Titre | C02 | `h1` 20 px 700 | Toujours | `code`, `h1` | E11.4-CA01 | E11.4-T01 |
| E11.4-S03 | Destinataire | C11 | « Nous avons écrit à {e-mail gras}. » + « Modifier » souligné | Toujours | `code`, `.a-top > .c2` | E11.4-CA02 | E11.4-T02 |
| E11.4-S04 | Phrase | C05 | Bloc `surface-raised`, `radius-md`, padding `spacing-3 spacing-4`, gap 4 : libellé `text-sm`, phrase `font-display` 16 px gras en minuscules, aide `text-xs` ; 97,1 px | Toujours, au-dessus du code | `code`, `.phrase` | E11.4-CA03 | E11.4-T02 |
| E11.4-S05 | Code | C49 | Étiquette 600 ; six cases 52 × 62,4 px, écart 8, 352 px max ; chiffres `title-section` 700 tabulaires ; filet `border-strong` 1 px ; un seul `input` transparent dessus | Toujours sauf code clos | `code`, `.otp` | E11.4-CA04 | E11.4-T03 |
| E11.4-S06 | Code | C49 | Case courante : filet 2 px `focus-ring` ; transition `border-color` 120 ms | Champ focalisé | `.otp span.cur` | E11.4-CA04 | E11.4-T03 |
| E11.4-S07 | Code | C19 | Erreur : six cases à filet 2 px `border-error` ; message `circle-alert` ; code conservé et sélectionné ; s'efface à la frappe | Code refusé | `code-erreur`, `.otp.bad`, `#otp-err` | E11.4-CA05 | E11.4-T03 |
| E11.4-S08 | Code | C18 | Aide `text-sm` `text-secondary` sous les cases (sous l'erreur) | Toujours | `#otp-help` | E11.4-CA04 | E11.4-T01 |
| E11.4-S09 | Action | C10 | Principal pleine largeur : « Continuer mon inscription » ou « Me connecter » | Selon parcours | `#verify` | E11.4-CA06 | E11.4-T02 |
| E11.4-S10 | Renvoi | C50 | Ligne à deux bouts `text-sm` : compte à rebours à gauche | Délai en cours | `#cd` | E11.4-CA07 | E11.4-T04 |
| E11.4-S11 | Renvoi | C11 | « Recevoir un nouveau code », bouton-lien souligné, à la place du compte à rebours | Délai écoulé (script, non capturé) | `#cd button` | E11.4-CA07 | E11.4-T04 |
| E11.4-S12 | Aide | C26 | « Je ne reçois pas le code », bouton-lien à droite (dessous à 375), `aria-expanded`, `aria-controls` | Toujours | `#no-code` | E11.4-CA08 | E11.4-T05 |
| E11.4-S13 | Aide | C51 | Panneau dans la carte : filet haut, titre `t-card`, liste numérotée décimale `text-sm`, gap 8, « Corriger mon adresse » lien | Déplié | `code-aide`, `#rescue` | E11.4-CA08 | E11.4-T05 |
| E11.4-S14 | Aide | C18 | Champ « Une autre adresse e-mail, où vous répondre » 48 px | Déplié | `#r-mail` | E11.4-CA09 | E11.4-T05 |
| E11.4-S15 | Aide | C18 | Zone « Précisions (facultatif) », 120 px mini, 500 caractères | Déplié | `#r-msg` | E11.4-CA09 | E11.4-T05 |
| E11.4-S16 | Aide | C10 | « Signaler que je ne reçois pas le code » secondaire, pleine largeur de la pile, 46,8 px | Déplié | `#r-send` | E11.4-CA09 | E11.4-T05 |
| E11.4-S17 | Aide | C18 | Promesse `text-xs` `text-secondary` | Déplié | `#rescue .xs` | E11.4-CA09 | E11.4-T05 |

## 4. Textes
EN « à écrire » = à écrire (expert-marketing). Clés : `auth.json`.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E11.1-S03 | Vous êtes une marque ou un créateur ? | Are you a brand or a creator? | `door.title` |
| E11.1-S04 | Choisissez votre espace. Vous pourrez encore changer jusqu'à la création de votre compte. | Choose your space. You can still change it until your account is created. | `door.lead` |
| E11.1-S07 | Je suis une marque · Je suis créateur | I am a brand · I am a creator | `door.*.action` |
| E11.1-S08 | Vous cherchez des créateurs pour vos campagnes. · Vous cherchez des campagnes rémunérées. | You are looking for creators for your campaigns. · You are looking for paid campaigns. | `door.*.audience` |
| E11.1-S09, E11.2-S09 | Déjà inscrit ? Me connecter | à écrire | nouvelle |
| E11.2-S01 | Étape 1 sur 3 · Inscription marque (ou Inscription créateur) | Step 1 of 3 · à écrire | `progress` · nouvelles |
| E11.2-S02 | Changer | Change | `step1.roleChange` |
| E11.2-S03 | Continuer avec votre e-mail | Continue with your email | `step1.title` |
| E11.2-S04 | Pas de mot de passe : nous vous envoyons un code à 6 chiffres. | No password: we send you a 6-digit code. | `step1.lead` |
| E11.2-S05 | Adresse e-mail | Email address | `step1.emailLabel` |
| E11.2-S06 | Cette adresse n'a pas un format valide (exemple : nom@exemple.com). | à écrire | diffère de `emailErrors.format` (E11-Q8) |
| E11.2-S07 | Recevoir mon code | Send me a code | `step1.submit` |
| E11.2-S08 | Ce que nous faisons de votre adresse | What we do with your address | `privacy.title` |
| E11.2-S08 | Votre adresse sert à vous envoyer un code et à gérer votre compte. À l'inscription, avec votre accord, elle est enregistrée dans Brevo (e-mails) et peut l'être dans Apollo.io (prospection commerciale). Elle est conservée tant que votre compte est ouvert. Vous pouvez y accéder, la corriger, la supprimer ou retirer votre accord à tout moment. | valeur de la clé | `privacy.notice` |
| E11.2-S08 | Politique de confidentialité | à écrire | `privacy.link` ajoute « (nouvel onglet) » : garder la clé |
| E11.3-S01 | Me connecter | à écrire | nouvelle |
| E11.3-S03 | Pas encore de compte ? Rejoindre INFLUX | à écrire | nouvelle |
| E11.4-S01 | Étape 2 sur 3 · Inscription marque · Connexion | Step 2 of 3 · à écrire | `progress` · nouvelles |
| E11.4-S02 | Entrez le code | Enter the code | `step2.title` |
| E11.4-S03 | Nous avons écrit à {e-mail}. Modifier | We have sent it to {email}. Change | `step2.sentTo`, `step2.changeEmail` |
| E11.4-S04 | Phrase de correspondance, à retrouver dans l'e-mail · {phare cerise} · Si l'e-mail porte une autre phrase, ne saisissez pas le code. | à écrire | diffèrent de `step2.phrase.*` (E11-Q8) |
| E11.4-S05 | Code à 6 chiffres | 6-digit code | `step2.codeLabel` |
| E11.4-S07 | Ce code est incorrect. Il vous reste {4} essais. · Le code comporte 6 chiffres. | valeurs des clés | `code.errors.invalid`, `.format` |
| E11.4-S08 | Restez dans cet onglet : le code ne fonctionne qu'ici. Le sixième chiffre envoie le code. | Stay in this tab: the code only works here. + à écrire | `step2.stayInTab` + nouvelle |
| E11.4-S09 | Continuer mon inscription · Me connecter | à écrire | nouvelles (remplacent `step2.submit`, U63) |
| E11.4-S10 | Nouveau code possible dans {42} s | à écrire | diffère de `code.resend.countdown` (E11-Q10) |
| E11.4-S11 | Recevoir un nouveau code | Send me a new code | `step2.resend` |
| E11.4-S12, S13 | Je ne reçois pas le code · Vous ne recevez pas le code ? | I haven't received the code · Not receiving the code? | `step2.notReceived.label`, `.title` |
| E11.4-S13 | Regardez vos courriers indésirables et les onglets « Promotions » ou « Notifications ». · L'adresse est-elle exacte ? {e-mail} · Corriger mon adresse · Toujours rien au bout de 2 minutes : signalez-le à l'équipe INFLUX. | 1 : à écrire ; 2 à 4 : valeurs des clés | 1 diffère de `.checklist` ; `.addressCheck`, `.fixAddress`, `.stillNothing` |
| E11.4-S14 à S17 | Une autre adresse e-mail, où vous répondre · Précisions (facultatif) · Signaler que je ne reçois pas le code · Un commercial INFLUX vous répondra à cette autre adresse. Ce formulaire ne donne jamais accès à un compte et ne délivre aucun code. | valeurs des clés ; Précisions : à écrire | `.contactLabel`, `.messageLabel` (diffère), `.submit`, `.promise` |
| Annonce | Votre signalement est enregistré. Un commercial INFLUX vous répondra à l'adresse indiquée. | valeur de la clé | `step2.notReceived.received` |

## 5. Interactions, états, responsive, clavier
- **E11.1** : carte → E11.2 de la porte (adresse remplacée, sans entrée d'historique) ; atteinte après un code vérifié (connexion, adresse inconnue) : mène à E11.5, sans « Déjà inscrit ? ».
- **E11.2, E11.3** : « Recevoir mon code » : contrôle local → erreur sous le champ, focus au champ, annonce « Cette adresse n'a pas un format valide. » ; sinon POST → E11.4, focus au `h1`. Frappe : l'erreur s'efface. Mention : déplie sur place. Aucune confirmation.
- **E11.4** : frappe non numérique ignorée, collage réparti, sixième chiffre → POST ; bouton avec moins de 6 chiffres → « Le code comporte 6 chiffres. », focus, annonce. Refus → cases rouges, code sélectionné, annonce. « Modifier » et « Corriger mon adresse » → étape e-mail de la même porte (adresse pré-remplie), parcours réinitialisé côté serveur. « Je ne reçois pas le code » → panneau, sans déplacer le focus. Signaler → contrôle (autre adresse, différente) → remplacé par le message enregistré.
- **États non montrés, comportement actuel préservé** : chargement du parcours (`AuthFlow.tsx:318`, proposé : texte dans la colonne) ; bouton occupé « Envoi du code… », « Vérification… » (`EmailStep.tsx:165`, `CodeStep.tsx:250`) ; service en panne, plafond, adresse non délivrable (`EmailStep.tsx:91`, proposé C19 sous le champ) ; code clos, expiré, parcours perdu, plafond réseau (`auth-steps.ts:125-151`, proposé : C19 et « Demander un nouveau code » à la place du champ) ; renvoi plafonné (`code.resend.limit`) ; hors ligne (`AuthScreen.tsx:80`, proposé C17 `warning` au-dessus de la carte) ; signalement refusé (`CodeNotReceived.tsx:155`).
- **Responsive** : 1440 et 1280 : carte centrée, padding 32. 768 : padding 24. 375 : sans carte, gouttière 16 ; titre de porte sur deux lignes ; ligne de renvoi sur deux lignes ; cases fluides (50,5 px de large). Aucun débordement à 320 px.
- **Clavier et focus** : INFLUX → langue → lien de méta → champ → bouton → mention → lien bas. `h1` focalisé à chaque étape (`AuthScreen.tsx:101`). Entrée dans le champ envoie.
- **Annonces** : erreurs et issue du signalement ; compte à rebours toutes les 10 s. **Animations** : chevron `rotate` 200 ms ; panneau d'aide `rise-in` `duration-base` `ease-standard` (opacité + 4 px ; opacité seule sous mouvement réduit) ; case `border-color` 120 ms ; carte de porte `transition-lift` 120 ms.

## 6. Critères d'acceptation
- **E11.1-CA01** Titre, phrase, deux portes, ligne de connexion, dans cet ordre, colonne de 576 px centrée ; `h1` à 110,8 px du haut.
- **E11.1-CA02** Deux colonnes dès 640 px, une dessous ; icône, titre, public ; plate au repos.
- **E11.1-CA03** Toute la carte est cliquable, un seul arrêt de tabulation par carte, anneau autour de la carte.
- **E11.1-CA04** « Me connecter » mène à la connexion ; absent quand la porte est choisie après un code.
- **E11.1-CA05** La langue est un lien `hreflang` qui conserve étape, saisie et paramètres d'acquisition.
- **E11.2-CA01** Le rôle est dit une seule fois (méta) ; ni pastille ni carte de rappel ; « Étape 1 sur 3 » à l'inscription seulement.
- **E11.2-CA02** « Changer » ramène à la porte sans perdre l'adresse ; RG4 appliquée au changement.
- **E11.2-CA03** `type=email`, `inputmode=email`, `autocomplete=email`, `spellcheck=false`, étiquette visible.
- **E11.2-CA04** L'erreur est liée au champ (`aria-describedby`, `aria-invalid`), porte icône, texte et filet 2 px, et disparaît à la première frappe.
- **E11.2-CA05** Double envoi sans effet ; même réponse pour une adresse inscrite, inconnue, interne ou suspendue.
- **E11.2-CA06** La mention nomme Brevo et Apollo.io et porte le lien vers la politique dès cet écran, selon l'arbitrage E11-Q1.
- **E11.3-CA01** Aucune étape numérotée ni rôle en connexion.
- **E11.3-CA02** « Rejoindre INFLUX » mène à E11.1.
- **E11.4-CA01** Méta selon le parcours ; `h1` focalisé.
- **E11.4-CA02** « Modifier » conserve la porte ; l'ancien code reste valable pour son adresse (RG51).
- **E11.4-CA03** La phrase est au-dessus du champ, en minuscules dans le DOM, avec `lang` de la demande, identique à l'e-mail.
- **E11.4-CA04** Un seul champ accessible ; collage et remplissage automatique ; six cases de 5/6 ; filet de 2 px sur la case courante.
- **E11.4-CA05** Après un refus : six cases rouges, texte du nombre d'essais, code sélectionné ; la frappe efface l'erreur.
- **E11.4-CA06** Le bouton dit ce qui se passe ; il fonctionne sans la sixième frappe.
- **E11.4-CA07** Renvoi impossible avant 60 s ; ensuite bouton ; plafond : message sans nouvel envoi.
- **E11.4-CA08** Le panneau s'ouvre dans la page et s'annonce par `aria-expanded`.
- **E11.4-CA09** Le signalement n'ouvre aucune session, refuse la même adresse et affiche la promesse.
- **E11.4-CA10** axe sans défaut, par défaut et en erreur, à 375, 768, 1440, FR et EN ; aucun débordement à 320 px.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E11.1-T01 | visuel, a11y | `e2e/journey-screens.spec.ts` (choix de porte, 320 px) | Rendu, axe |
| E11.1-T02 | e2e | `e2e/journey-resume.spec.ts` (porte = adresse), `e2e/landing-signup.spec.ts` ; attend un `button` nommé `door.*.action` | Choix de porte |
| E11.2-T01 | visuel, a11y | `e2e/journey-screens.spec.ts` : cas L2AU-1 (ligne de médiation, pastille) à réécrire selon E11-Q4 | Écran e-mail |
| E11.2-T02 | e2e | `e2e/journey-resume.spec.ts` (`step1.roleChange` bouton) | Changer, langue |
| E11.2-T03 | unitaire, e2e | `tests/auth-steps.test.ts` (garder) ; nouveau cas : l'erreur s'efface à la frappe | U25 |
| E11.3-T01 | visuel, a11y | `e2e/journey-screens.spec.ts` (page connexion) | Rendu |
| E11.3-T02 | e2e | `e2e/journey-screens.spec.ts` | Lien d'inscription |
| E11.4-T01 | visuel, a11y | `e2e/journey-resume.spec.ts`, nouveau cas axe en erreur | Rendu |
| E11.4-T02 | e2e | `e2e/journey-resume.spec.ts` (`step2.sentTo`, `changeEmail`), `e2e/support/journey.ts` (phrase, code) | Reprise, phrase |
| E11.4-T03 | e2e | `e2e/signup-nominal.spec.ts` ; nouveau cas collage et erreur | Champ unique |
| E11.4-T04 | unitaire | `tests/auth-steps.test.ts` (compte à rebours) | RG50 |
| E11.4-T05 | e2e | nouveau cas dans `e2e/journey-screens.spec.ts` | Canal de secours |

Attendus à conserver : rôles `alert` sur les erreurs, `getByLabel(step1.emailLabel)`, `getByLabel(step2.codeLabel)`, `#main`. Planchers : `e2e/case-floors.ts`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Gabarit | `auth-classes.ts:28-34` : `container-narrow` 768, halo, `h1` 28/24 px 800 | 28 ou 36 rem, sans halo, `h1` 20 px 700, carte dès 640 | faire évoluer (C50) |
| Portes | `DoorStep.tsx:23-36` : boutons empilés | deux cartes avec icône | faire évoluer |
| Pastille, médiation, carte de rôle | `EmailStep.tsx:111-138` | méta sur une ligne | supprimer / faire évoluer |
| Mention RG6 | `EmailStep.tsx:169` visible | repliée | faire évoluer (E11-Q1) |
| Notice `code.sent` | `CodeStep.tsx:178` | absente | supprimer (E11-Q6) |
| Phrase | `CodeStep.tsx:189` : carte, 20 px, capitales | bloc compact, minuscules | faire évoluer (C05) |
| Cases | `auth-classes.ts:118` : 48 px, vert | 5/6, filet `focus-ring` | faire évoluer (C49) |
| Erreurs | `ErrorNotice` encadré | C19 en ligne | faire évoluer |
| Aide | carte sous le formulaire | dans la carte ; formulaire au même niveau que la liste | faire évoluer |
| Icône | `icons.ts` | ajouter `sparkles` | créer |

Données requises : toutes servies (GET `/v1/auth/journey`, POST `request-code` : `matchingPhrase`, `retryAfterSeconds`). Le rôle de la méta vient de l'adresse. Aucun écart d'API. Hors lot : néant.

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E11-Q1 | Mention repliée ; `05` RG6 et 17 §3.1 : « visible dès cet écran, pas repliée dans un accordéon fermé » ; `EmailStep.tsx:168` « never folded away » | Non conforme en l'état | Mention visible sous le bouton, même typographie ; ou ouverte par défaut | expert-conformite-rgpd, fondateur | oui |
| E11-Q2 | « Déjà inscrit ? », « Pas encore de compte ? », titre « Me connecter » ; 17 §3 et `05` RG2 : aucun lien « déjà un compte », parcours jamais nommé « Se connecter » | Liens nouveaux | Suivre la maquette (deux adresses existent déjà) ; amender 17 §3 et RG2 | product-owner | non |
| E11-Q3 | « Étape 1 sur 3 » absente en connexion (U47) ; 17 §3.6 : l'étape est annoncée | Annonce | Étape dite à l'inscription seulement, hors du `h1` mais lue avec lui (`aria-describedby`) | expert-ux | non |
| E11-Q4 | Ligne de médiation `step1.mediation` et pastille de rôle retirées ; 17 §3.1 (L2AU-1), `20` §11.7 et le test les imposent | Test et spec | Maquette validée (U48) : retirer ; la médiation est dite sur la landing et l'accueil | fondateur | oui |
| E11-Q5 | « Modifier » de `code-connexion` mène à l'inscription (artefact) ; le code garde la porte | Navigation | Garder le comportement du code | product-owner | non |
| E11-Q6 | `code.sent` (neutre : « Si un compte peut être créé ou retrouvé… ») absent ; RG112, RG138, 17 §3.7 | Message neutre remplacé par « Nous avons écrit à {e-mail} » | Accepter (identique pour toute adresse) ou garder en `text-sm` | expert-cybersecurite | oui |
| E11-Q7 | Erreurs : C19 + annonce polie (`role=status`) ; 17 §3.6, tests : `role="alert"` ET relié | Accessibilité, tests | C19 avec `role="alert"` ; pas de double annonce C29 | expert-ux | non |
| E11-Q8 | Textes de la maquette différents de clés imposées : format d'e-mail (RG112), phrase et aide (RG136 s., 17 §3.2), liste d'aide, « Précisions » | Clés à changer en FR et EN | Adopter la maquette pour l'aide ; garder `emailErrors.format` et la consigne de sécurité de la phrase | product-owner, expert-cybersecurite | non |
| E11-Q9 | Largeurs 28, 36, 22 rem, `letter-spacing 0.02em`, rupture 640 px (X3), `--color-surface-input` inexistant (repli `surface-raised`), hors tokens | Tokens | Tokens `container-auth`, `container-auth-wide`, `size-otp` ; `surface-raised` ; 640 : X3 | expert-ux | non |
| E11-Q10 | Compte à rebours à la seconde, sans région ; 17 §3.2 : mise à jour toutes les 10 s ; 60 s réelles (maquette : 42) | Annonce | Chiffre visible à la seconde, annonce séparée toutes les 10 s | expert-ux | non |
| E11-Q11 | `connexion` garde un paragraphe méta vide (h1 8 px plus bas) ; `email` : double séparateur d'espace avant « · » | Rendu | Ne pas rendre l'élément vide ; un seul « · » | expert-ux | non |
| E11-Q12 | Code clos, expiré, perdu, plafonds, panne, hors ligne, occupé non dessinés | États | §5 | expert-ux | non |
| E11-Q13 | Filet de la case courante blanc (`focus-ring`) au lieu du vert `border-selected` | Rendu | Suivre la maquette (conforme 04 : vert réservé à l'action) | expert-ux | non |
| E11-Q14 | Cartes de porte : liens dans la maquette, boutons dans le code (état sans navigation, tests) | Sémantique | Lien vers l'adresse de la porte à l'étape 1 ; bouton après un code vérifié | architecte | non |
