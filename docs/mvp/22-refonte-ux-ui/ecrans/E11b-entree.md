# E11 — Inscription : informations, compte existant (visiteur, marque, créateur)
> Maquette : `proto-entree.html` (états `infos-marque`, `infos-createur`, `autre-role`) · page de comparaison `ecran-11-entree.html` · validée le 2026-11-24 (07) · Constats : U47, U62, U25, U26. Porte, e-mail et code : `E11a-entree.md` (en-tête E11.1-S01 et S02, cadre §2, communs).

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E11.5 | Informations marque | `/fr/inscription/marque` (étape 3) | `/en/signup/brand` | `auth/SignupDetailsStep.tsx:79` (`door = advertiser`) | `infos-marque` | L | E01.1, C20 |
| E11.6 | Informations créateur | `/fr/inscription/createur` (étape 3) | `/en/signup/creator` | `auth/SignupDetailsStep.tsx:79` (`door = creator`) | `infos-createur` (3 manques) | L | E01.2, C20 |
| E11.7 | Compte existant, autre rôle | même adresse | idem | `auth/AuthFlow.tsx:327` (`roleMismatch`) | `autre-role` | S | E01 |

Fonctionnalités existantes à préserver :
- Affiché seulement si l'adresse vérifiée n'a aucun compte (RG2) ; compte créé en une transaction (RG5, RG7).
- Contrôles du contrat appliqués au front et à l'API (`signup-form.ts`, RG10) ; ordre de focus `SIGNUP_FIELDS` (`signup-form.ts`).
- CGU : version lue et acceptée par son identifiant (`SignupDetailsStep.tsx:128,199`, RG24) ; dialogue `TermsDialog` sans perte de saisie ; version périmée : case décochée, relecture (`:218`, RG25) ; CGU indisponibles + « Réessayer » (`:511`).
- Consentement : libellé exact envoyé comme preuve (`:201`, RG32) ; décoché au changement de porte et de langue (RG4, D66).
- Pays bloqué, panne, jeton expiré : `:213`, `:225`, `AuthFlow.tsx:241`.
- Source d'acquisition transmise (`:203`) ; jamais de champ interdit par RG16 et RG21.
- `roleMismatch` : la session est ouverte, le bandeau reste jusqu'à l'action (RG67).

API : GET `/v1/terms/current`, POST `/v1/signup`, POST `/v1/auth/journey/reset` ; POST `/v1/auth/logout` (E11-Q22).

## 2. Structure
- Colonne 576 px (36 rem) : 432 → 1008 à 1440 ; 96 → 672 à 768 ; 343 px à 375. Carte dès 640 px (padding `inset-card` 32 ou 24), nue dessous ; gap interne `spacing-5` (24 px).
- Ordre : en-tête d'étape → résumé des manques (si refus) → groupe « Vous » → groupe « Vos engagements » → question facultative (filet haut, padding haut `spacing-5`) → bouton → phrase d'arrivée.
- Groupes : `fieldset`, gap `spacing-4`, légende `font-display` 16 px 700, marge basse `spacing-1` ; le second porte un filet haut `border-default` **interrompu par la légende** (rendu natif) et un padding haut `spacing-5`.
- Listes déroulantes : 320 px max (20 rem), y compris à 375 px. Hauteur de page à 1440 : 1 431 px (marque), 1 512 px (créateur avec résumé).
- E11.7 : colonne et carte de 448 px. Aucune zone collante.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E11.5-S01 | Méta | C50 | « Étape 3 sur 3 » · icône `circle-check` 16 px `feedback-success-icon` + « {e-mail}, adresse vérifiée », `text-sm` `text-secondary` ; sur deux lignes à 375 | Toujours | `infos-marque`, `.a-meta` | E11.5-CA01 | E11.5-T01 |
| E11.5-S02 | Titre | C02 | `h1` 20 px 700 propre à la porte | Toujours | `h1` | E11.5-CA01 | E11.5-T01 |
| E11.5-S03 | Titre | C02 | Consigne `text-md` `text-secondary` (aucun astérisque) | Toujours | `.a-top > .c2` | E11.5-CA01 | E11.5-T01 |
| E11.5-S04 | Résumé | C20 | Encadré filet `feedback-error-border`, `radius-md`, padding `spacing-4`, titre `font-display` 700 `feedback-error-text` avec `circle-alert`, liens `text-sm` 600 | Après un clic refusé | `infos-createur`, `#errsum` | E11.5-CA02 | E11.5-T03 |
| E11.5-S05 | Vous | C18 | Nom de l'entreprise : champ 48 px, 120 caractères, `autocomplete=organization` | Marque | `#i-co` | E11.5-CA03 | E11.5-T02 |
| E11.5-S06 | Vous | C18 | Pays : étiquette, aide `text-sm` au-dessus du champ, liste 320 × 48 avec chevron | Toujours | `#i-country` | E11.5-CA04 | E11.5-T02 |
| E11.5-S07 | Vous | C19 | Erreur du pays : `circle-alert` + texte ; filet 2 px | Pays vide au clic | `infos-createur`, `#i-country-e` | E11.5-CA02 | E11.5-T03 |
| E11.5-S08 | Vous | C22 | Langue : légende, aide, choix segmenté 170 × 44 (Français, English ; `lang="en"`), actif `surface-active` | Toujours | `.seg` | E11.5-CA05 | E11.5-T02 |
| E11.5-S09 | Vous | C21 | Statut : deux boutons radio 24 px, 44 px de haut | Marque dans la maquette ; contredit par RG11, RG22 (E11-Q15) | `#i-status` | E11.5-CA06 | E11.5-T02 |
| E11.5-S10 | Engagements | C21 | Attestation 18 ans : case 24 px, texte, aide `text-sm` | Marque dans la maquette ; contredit par RG11 (E11-Q15) | `#c-age-l` | E11.5-CA06 | E11.5-T02 |
| E11.5-S11 | Engagements | C21 | CGU : case, texte, lien souligné « Lire les CGU » | Toujours | `#c-cgu-l` | E11.5-CA07 | E11.5-T04 |
| E11.5-S12 | Engagements | C21 | Consentement marque : case, texte, aide de retrait `text-sm` | Marque | `#c-mkt-l` | E11.5-CA08 | E11.5-T02 |
| E11.5-S13 | Facultatif | C18 | « Comment avez-vous connu INFLUX ? (facultatif) », liste 320 × 48 | Toujours | `#i-src` | E11.5-CA09 | E11.5-T02 |
| E11.5-S14 | Action | C10 | « Créer mon compte » principal pleine largeur 44,8 px, jamais désactivé | Toujours | `#create` | E11.5-CA10 | E11.5-T02 |
| E11.5-S15 | Action | C18 | Phrase d'arrivée `text-xs` `text-secondary` centrée | Toujours | `form > .xs` | E11.5-CA10 | E11.5-T01 |
| E11.6-S01 | Méta | C50 | Comme E11.5-S01 à S04 ; `h1` créateur | Toujours | `infos-createur` | E11.6-CA01 | E11.6-T01 |
| E11.6-S02 | Vous | C18 | Pays de résidence (étiquette propre), aide, liste | Toujours | `#i-country` | E11.6-CA01 | E11.6-T02 |
| E11.6-S03 | Vous | C22 | Langue : identique à E11.5-S08 | Toujours | `.seg` | E11.6-CA01 | E11.6-T02 |
| E11.6-S04 | Vous | C21 | Statut : légende 600, deux radios, rien de présélectionné ; empilés à 375 et dans la carte | Toujours | `#i-status` | E11.6-CA02 | E11.6-T02 |
| E11.6-S05 | Vous | C19 | Erreur de statut (non capturée, script) | Statut vide au clic | `#i-status-e` | E11.6-CA03 | E11.6-T03 |
| E11.6-S06 | Engagements | C21 | 18 ans : case + texte + aide ; en erreur : texte `feedback-error-text`, case cernée de 2 px `border-error` | Toujours | `infos-createur`, `#c-age-l.is-bad` | E11.6-CA03 | E11.6-T03 |
| E11.6-S07 | Engagements | C21 | CGU : comme E11.5-S11 | Toujours | `#c-cgu-l` | E11.5-CA07 | E11.6-T02 |
| E11.6-S08 | Engagements | C21 | Consentement créateur ; même état d'erreur que S06 | Toujours | `#c-mkt-l.is-bad` | E11.6-CA03 | E11.6-T03 |
| E11.6-S09 | Bas | C18 | Question facultative, bouton, phrase : comme E11.5-S13 à S15 | Toujours | `#i-src`, `#create` | E11.5-CA09 | E11.6-T02 |
| E11.7-S01 | Méta | C50 | « Inscription créateur » `text-sm` `text-secondary` | Toujours | `autre-role`, `.a-meta` | E11.7-CA01 | E11.7-T01 |
| E11.7-S02 | Titre | C02 | `h1` 20 px 700 | Toujours | `autre-role`, `h1` | E11.7-CA01 | E11.7-T01 |
| E11.7-S03 | Corps | C17 | Notice `info`, icône `info`, rôle du compte en gras | Toujours | `.notice--info` | E11.7-CA01 | E11.7-T01 |
| E11.7-S04 | Actions | C10 | « Accéder à mon espace marque » principal 284,1 × 44,8 | Toujours | `.btn--primary` | E11.7-CA02 | E11.7-T01 |
| E11.7-S05 | Actions | C10 | « Utiliser une autre adresse » bouton texte, à la ligne dessous | Toujours | `.btn--text` | E11.7-CA03 | E11.7-T02 |

## 4. Textes
EN « à écrire » = à écrire (expert-marketing). Clés : `auth.json`, sous `signup.*` sauf mention.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E11.5-S01 | Étape 3 sur 3 · {claire.morel@example.test}, adresse vérifiée | Step 3 of 3 · à écrire | `progress` ; diffère de `verifiedEmail` (« {email} — adresse vérifiée ») |
| E11.5-S02 | Créer votre compte marque · Créer votre compte créateur | Create your brand account · Create your creator account | `title.*` |
| E11.5-S03 | Tous les champs sont obligatoires, sauf la dernière question. | à écrire | nouvelle (remplace `requiredLegend`) |
| E11.5-S04 | Il manque {1} réponse pour créer votre compte · Il manque {3} réponses pour créer votre compte | à écrire | nouvelle, pluriel ICU (remplace `errors.summary`) |
| E11.5-S04 | Votre pays · Particulier ou professionnel · L'attestation de 18 ans ou plus · L'acceptation des conditions générales · L'accord pour l'enregistrement de vos coordonnées | à écrire | nouvelles ; nom de l'entreprise : manque (E11-Q20) |
| Légendes | Vous · Vos engagements | à écrire | nouvelles |
| E11.5-S05 | Nom de l'entreprise | Company name | `company.label` |
| E11.5-S06 | Pays de l'entreprise (E11.6 : Pays de résidence) | Company country · Country of residence | `country.label.*` |
| E11.5-S06 | L'inscription est ouverte partout ; les mises en relation s'ouvrent pays par pays. | Sign-up is open everywhere; introductions open country by country. | `country.help` |
| E11.5-S06, S13 | Choisir… | à écrire | diffère de `country.emptyOption` et `heardFrom.emptyOption` (« — Sélectionnez — ») |
| E11.5-S07 | Choisissez votre pays. | à écrire | diffère de `country.errors.required` |
| E11.5-S08 | Langue de communication · La langue de vos e-mails et de votre espace. · Français · English | valeurs des clés | `language.legend`, `.help` ; `auth.language.*` |
| E11.5-S09, E11.6-S04 | Vous vous inscrivez en tant que · Particulier · Professionnel (société, entreprise individuelle, agence) | You are signing up as · An individual · A business (company, sole trader, agency) | `status.*` |
| E11.6-S05 | Indiquez si vous êtes particulier ou professionnel. | à écrire | diffère de `status.errors.required` |
| E11.5-S10, E11.6-S06 | Je certifie avoir 18 ans ou plus. · Les personnes de moins de 18 ans ne peuvent pas utiliser INFLUX. | valeurs des clés | `adult.label`, `.help` |
| E11.5-S11 | J'accepte les conditions générales d'utilisation. · Lire les CGU | I accept the terms of use. · Read the terms | `terms.label`, `.read` |
| E11.5-S12 | J'accepte que mes coordonnées professionnelles soient enregistrées dans Brevo et Apollo.io, les outils d'INFLUX, pour recevoir les e-mails commerciaux d'INFLUX destinés aux marques et être contacté par un commercial. | à écrire | diffère de `consent.advertiser.label` (E11-Q16) |
| E11.6-S08 | J'accepte que mes coordonnées soient enregistrées dans Brevo et Apollo.io, les outils d'INFLUX, pour recevoir les e-mails commerciaux d'INFLUX destinés aux créateurs et être contacté par un commercial. | à écrire | diffère de `consent.creator.label` (E11-Q16) |
| E11.5-S12, E11.6-S08 | Vous pourrez retirer cet accord à tout moment depuis votre espace. | à écrire | nouvelle (dans le libellé aujourd'hui) |
| E11.5-S13 | Comment avez-vous connu INFLUX ? (facultatif) | How did you hear about INFLUX? (optional) | `heardFrom.label` |
| E11.5-S13 | Un moteur de recherche · Les réseaux sociaux · Un événement · Le bouche-à-oreille · Autre | valeurs des clés (6 réponses) | `heardFrom.options.*` (E11-Q19) |
| E11.5-S14 | Créer mon compte | Create my account | `submit` |
| E11.5-S15 | Vous arrivez ensuite directement sur votre accueil. | à écrire | nouvelle (remplace `success.*`) |
| E11.7-S01 | Inscription créateur (ou Inscription marque) | à écrire | nouvelles (communes E11.2-S01) |
| E11.7-S02 | Vous avez déjà un compte INFLUX | You already have an INFLUX account | `auth.roleMismatch.title` |
| E11.7-S03 | Cette adresse est déjà associée à un compte {marque}. Un compte INFLUX porte un seul rôle : utilisez une autre adresse pour créer un compte {créateur}. | à écrire | diffère de `auth.roleMismatch.notice` (« … pour créer un second compte. ») |
| E11.7-S04 | Accéder à mon espace {marque} | à écrire | diffère de `auth.goToSpace` |
| E11.7-S05 | Utiliser une autre adresse | à écrire | proche de `auth.restart` |

## 5. Interactions, états, responsive, clavier
- **Créer mon compte** : contrôle local de tous les champs → manques : résumé affiché, défilement au résumé, focus au résumé (`tabindex=-1`), annonce de son titre ; champs marqués. Ensuite, chaque modification recalcule résumé et marques ; le résumé disparaît à zéro manque. Succès : POST `/v1/signup` → accueil du rôle, sans écran intermédiaire, focus au `h1` de l'accueil.
- **Lien du résumé** : défile le champ au centre et y porte le focus (première radio pour le statut). **Lire les CGU** : dialogue existant `TermsDialog`, retour du focus au lien. **E11.7** : S04 → accueil du rôle réel ; S05 → E11.2 de la porte (E11-Q22).
- **États non montrés, actuel préservé** : CGU en chargement ou indisponibles (`SignupDetailsStep.tsx:507-521` ; proposé : sous la case, C19 + « Réessayer ») ; CGU périmées (`:245`, sous la case) ; pays bloqué et panne (`:280`, proposé C17 erreur à la place du résumé) ; occupé « Création du compte… » (`:567`) ; hors ligne (`AuthScreen.tsx:80`, C17 au-dessus de la carte) ; jeton expiré → E11.2 avec message (`AuthFlow.tsx:243`) ; compte suspendu ou interne : §10.
- **Responsive** : 1440, 1280, 768 : carte 576. 375 : sans carte ; méta sur deux lignes ; radios empilées ; listes 320 px ; résumé sur deux lignes de titre. Aucun débordement à 320 px.
- **Clavier** : ordre du document ; radios et segments aux flèches ; cases à l'espace ; toute l'étiquette est cliquable. **Animations** : segment `background-color`, `color` 120 ms ; aucune autre.

## 6. Critères d'acceptation
- **E11.5-CA01** Étape, e-mail vérifié, titre de la porte et consigne ; aucun astérisque ; les champs obligatoires portent `required`.
- **E11.5-CA02** Un seul résumé, nombre exact, un lien par manque, focus au résumé ; il se met à jour à la saisie ; chaque champ en erreur porte aussi son message lié.
- **E11.5-CA03** Nom : 2 à 120 caractères, erreurs `required`, `tooLong`, `invalid` distinctes.
- **E11.5-CA04** 249 pays triés dans la langue, première option vide, aucun marqué « ouvert » (RG14).
- **E11.5-CA05** Langue de la page présélectionnée, modifiable ; choix segmenté accessible comme deux radios.
- **E11.5-CA06** Marque : statut et attestation conformes à l'arbitrage E11-Q15 ; tant qu'il manque, absents (contrat `strictObject`).
- **E11.5-CA07** CGU et consentement : deux cases distinctes, jamais pré-cochées, l'une ne coche pas l'autre ; version acceptée = version lue.
- **E11.5-CA08** Le libellé enregistré comme preuve est exactement le texte affiché dans la case (RG32).
- **E11.5-CA09** La question est facultative et en dernier ; les codes envoyés restent ceux du contrat.
- **E11.5-CA10** Bouton jamais désactivé ; double envoi sans effet ; succès = accueil de première visite, aucun écran « compte créé ».
- **E11.6-CA01** Champs du créateur seulement, dans l'ordre pays, langue, statut, 18 ans, CGU, consentement.
- **E11.6-CA02** Statut sans présélection (RG18).
- **E11.6-CA03** Une case en erreur porte un texte d'erreur, pas seulement la couleur et le cerne.
- **E11.6-CA04** axe sans défaut avec et sans résumé, à 375, 768, 1440, FR et EN ; aucun débordement à 320 px.
- **E11.7-CA01** Jamais affiché avant la vérification du code ; le rôle réel est nommé dans les deux sens.
- **E11.7-CA02** Le bouton ouvre l'espace du rôle réel.
- **E11.7-CA03** « Utiliser une autre adresse » ne laisse aucune session ouverte (E11-Q22).

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E11.5-T01 | visuel, a11y | nouveau cas dans `e2e/journey-screens.spec.ts` (étape 3) | Rendu, axe |
| E11.5-T02 | e2e | `e2e/signup-nominal.spec.ts` (marque) : `signup.success.title` et lien `goToSpace` à retirer ; `e2e/support/journey.ts:278`, `e2e/landing-signup.spec.ts:96`, `e2e/account.spec.ts:206` idem | Inscription marque, arrivée directe |
| E11.5-T03 | unitaire, e2e | `tests/signup-form.test.ts` ; nouveau cas e2e du résumé et de ses liens | Manques, focus |
| E11.5-T04 | e2e | `e2e/signup-nominal.spec.ts` (cases non pré-cochées, CGU) | RG23, RG24 |
| E11.6-T01 | visuel, a11y | nouveau cas dans `e2e/journey-screens.spec.ts` (étape 3 en erreur) | Rendu, axe |
| E11.6-T02 | e2e | `e2e/signup-nominal.spec.ts` (créateur, EN), `e2e/journey-resume.spec.ts` (langue, décoche) | Inscription créateur |
| E11.6-T03 | unitaire, e2e | `tests/signup-form.test.ts`, nouveau cas | Erreurs par champ |
| E11.7-T01 | e2e | nouveau cas dans `e2e/journey-resume.spec.ts` | RG67 |
| E11.7-T02 | e2e | idem | Session fermée |

À conserver : `getByLabel(signup.company.label)`, `getByLabel(signup.country.label.*)`, rôles `radio` et `checkbox` nommés par leur libellé. Planchers : `e2e/case-floors.ts`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Rappel de porte + « Changer » | `SignupDetailsStep.tsx:253-268` | absent | supprimer (E11-Q18) |
| Astérisques et légende | `:269` | consigne | faire évoluer |
| Résumé inerte | `:270-279` | liens focalisants | créer (C20) |
| Langue | `:351` radios | segmenté C22 | faire évoluer |
| Info pays | `:341` notice sous le champ | aide au-dessus | faire évoluer |
| Ordre | 18 ans, connu par, filet, CGU, filet, consentement | groupes « Vous », « Vos engagements », facultatif | faire évoluer (C12) |
| « Lire les CGU » | `:499` bouton texte | lien dans la ligne | faire évoluer |
| Écran « compte créé » | `AuthFlow.tsx:232,337` | redirection | supprimer |
| Autre rôle | `AuthFlow.tsx:339` un seul bouton | carte, deux actions | faire évoluer |

Données requises : POST `/v1/signup` (`packages/contracts/src/signup.ts:189-206`) : `advertiserSignupBodySchema` est strict, sans `declaredStatus` ni `adultAttested` ; toute autre donnée est servie. Hors lot : néant.

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E11-Q15 | `infos-marque` montre « Particulier / Professionnel » et « 18 ans » ; RG11 (« exactement ces champs »), RG22 (marque professionnelle par construction), contrat strict, `SIGNUP_FIELDS` | Un envoi avec ces champs est refusé (400) | Ne pas les afficher à la marque | product-owner, expert-conformite-rgpd | oui |
| E11-Q16 | Consentement réécrit : « être contacté par un commercial » au lieu de « à des fins de prospection commerciale » ; « Cet accord est requis pour créer un compte » retiré ; retrait sorti du libellé. RG31 (finalité prospection citée), RG127, RG32, D63 (juriste) ; `ecran-11` §3 affirme reprendre le texte actuel | Preuve juridique modifiée | Garder mot pour mot `consent.*.label` ; aide de retrait supprimée | expert-conformite-rgpd, fondateur | oui |
| E11-Q17 | CGU et consentement sans filet entre eux ; 17 §3.4 et RG23 « séparées par un filet » | Séparation visuelle | Filet `border-subtle` entre les deux lignes | expert-conformite-rgpd | oui |
| E11-Q18 | Aucun « Changer » à l'étape 3 ; RG3 : rappelé et modifiable à l'écran 3 ; la porte le promet | Retour impossible | « Changer » dans la méta, comme à l'étape 1 | product-owner | oui |
| E11-Q19 | 5 réponses d'origine, libellés différents ; RG120 et contrat : 6 (« un commercial INFLUX » manque) | Donnée d'acquisition perdue | Garder les 6 clés | expert-marketing | non |
| E11-Q20 | Manques du nom d'entreprise et messages d'erreur par case absents ; 17 §3.5 exige liste ET message par champ ; couleur seule sur la case (WCAG 1.4.1) | Textes à ajouter | « Le nom de votre entreprise » ; message `errors.required` de chaque clé sous la case | expert-ux | non |
| E11-Q21 | Focus au résumé ; RG115 et 17 §3.4 : premier champ invalide | Comportement | Focus au résumé (07, C7) ; amender RG115 | product-owner | non |
| E11-Q22 | « Utiliser une autre adresse » : la session du compte existant est ouverte (RG67) ; aucun comportement défini ; 17 §2.5 veut un bandeau dans l'espace du rôle réel | Session fermée ou non ; sens créateur → marque non dessiné | POST logout puis étape e-mail de la porte ; textes symétriques | product-owner, expert-cybersecurite | oui |
| E11-Q23 | Textes divergents (« Choisir… », « Choisissez votre pays. », statut, « adresse vérifiée ») | Clés FR et EN | Adopter la maquette, EN à écrire | expert-marketing | non |
| E11-Q24 | `signup.success` retiré (U47) ; 17 §3.5 l'exige | Spec | Amender 17 §3.5 ; annonce du `h1` de l'accueil | product-owner | non |
| E11-Q25 | « · » orphelin en fin de ligne à 375 (méta étape 3) | Rendu | Séparateur masqué quand la ligne se coupe | expert-ux | non |
| E11-Q26 | Axe : aucun défaut relevé sur `entree`. X3 (640 px), X7 (segment actif `surface-active`, texte `text-primary` : admis), X13 | — | Voir X3, X7, X13 | expert-ux | non |

## 10. Écrans du périmètre sans maquette
Représentation proposée : gabarit C50 (colonne 448 px, carte dès 640 px) et textes actuels, sauf arbitrage `expert-ux`. Les écrans du compte sont au §10 de `E20b-compte.md`.

| Écran | Route | Fichier | Textes | Proposition |
|---|---|---|---|---|
| Reprise du parcours (chargement) | entrée, toutes adresses | `auth/AuthFlow.tsx:318` | `auth.journey.loading` | Ligne `role=status` dans la colonne |
| Porte après un code (adresse inconnue) | `/connexion` | `AuthFlow.tsx:217`, `DoorStep.tsx` | `door.*` | E11.1 sans « Déjà inscrit ? » |
| Compte interne | entrée, après code | `AuthFlow.tsx:360` | `auth.internalAccount.*`, `auth.restart` | Gabarit E11.7, notice `info`, bouton texte ; aucun lien interne (RG140) |
| Compte suspendu | entrée, après code | `AuthFlow.tsx:360` | `auth.suspended.*`, `auth.restart` | Idem, neutre |
| Panneau des CGU | étape 3, dialogue | `auth/TermsDialog.tsx` | `signup.terms.*` | C27, « Fermer » aussi en haut (U54) |
| Hors ligne | toute l'entrée | `AuthScreen.tsx:80` | `auth.offline` | C17 `warning` au-dessus de la carte |
| Erreur d'une page membre | toute page `(member)` | `app/[locale]/(member)/error.tsx`, `../error.tsx`, `app/global-error.tsx` (vitrine) | `errors.json` `error.*` | C50 sans carte ; « Réessayer » secondaire |
| 404 membre | page membre inconnue | `(member)/not-found.tsx`, `../not-found.tsx` ; adresse inconnue : vitrine (`[...rest]/page.tsx`) | `errors.json` `notFound.*` | Idem ; 17 §6.7 demande un texte « ou ne vous est pas accessible » : à arbitrer (product-owner) |
| Mauvais segment de langue | `/en/connexion`… | `AuthPage.tsx` `memberPageLocale` | — | Redirection, sans écran |
| Session expirée | toute page d'espace | `MemberShell.tsx:130` | aucun (17 §6.7 : « Votre session a expiré. Reconnectez-vous. » et destination mémorisée, non réalisés) | Hors refonte ; manque signalé |
