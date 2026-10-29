# Fiche DS — Charte KEO Emerald des espaces connectés (jalon extra du MVP)

> **Jalon DS clos et archivé le 2026-10-29** (commits DS-1 à DS-14, bilan dans `21` § « Jalon DS »). Fiche conservée pour mémoire : ne plus la lire pour démarrer une session ; la recette humaine (`18` §12.4) et la revue groupée restent tracées dans `21`.

> **Point d'entrée de toute session du jalon DS.** Décision : `decisions.md` **D73** (fondateur,
> 2026-10-28). Jalon **extra**, placé **avant le Lot 2** : les écrans des Lots 2 à 5 se construiront
> directement dans la charte, sans reprise. Lire ensuite **seulement** les tranches citées :
> `02` §21 (mécanique), `20` §11 (charte, correspondance, contrastes, composants), `17` §2.2, §2.3
> et §8 (gabarits et tokens des espaces membres), `17b` §1.4, §1.7 et §6 (backoffice), `18` §5
> (gardes), skill `design-system-influx`. La maquette `design-proposals/proposition-4-keo-emerald.html`
> est une **référence visuelle**, jamais une source de code (`design-proposals/README.md`).

## Besoin reformulé

Les marques, les créateurs et les commerciaux INFLUX travaillent dans des écrans à la charte
**KEO Emerald** (vert `#1dd68a`, fond `#0a0b0a`, surfaces graduées, Manrope et Source Sans 3,
cartes arrondies, boutons en pilule), **lisibles sur téléphone comme sur poste de travail**, avec
la **navigation en colonne à gauche** sur grand écran (comportement de Railway). La vitrine (landing)
ne change pas.

| Population | Ce qui change pour elle | Valeur business |
|---|---|---|
| Marque (au bureau) | Colonne de navigation à gauche, écrans denses et sobres | Crédibilité au premier écran après l'inscription : la marque est celle qui paie la commission |
| Créateur (téléphone, 4G) | Barre du bas à cinq entrées, cibles tactiles, une décision par écran | Rétention de l'offre créateurs, sans laquelle aucune mise en relation n'existe |
| Commercial INFLUX | Rail à gauche, bande de tête, lignes de 36 px | Productivité de l'équipe qui porte chaque mise en relation (plafond de croissance humain) |
| Équipe produit | Gabarits et primitives posés une fois | Les Lots 2 à 5 ne codent plus de style : vélocité, aucune reprise visuelle |

Aucun effet sur la commission, la traçabilité ni les leads : **aucune règle métier, aucune donnée,
aucune migration** ne bouge. D48 (aucun taux, aucun net) reste appliqué tel quel.

## Critère de fin

Liste complète et cases vérifiables : `18` §10 « Jalon DS » ; tests par famille (TD1 à TD8, 44 cas),
matrice d'axe par largeur, plan par commit et recette : `18` §12. **Terminé quand** :

- [x] `pnpm check` puis `pnpm test:e2e` verts trois fois de suite ; le pas e2e ne prend pas plus de
      90 s de plus ; planchers en hausse depuis le parent de DS-1 (web 203, backoffice 62, test-kit
      134, e2e 56), chaque nouveau fichier de test avec son plancher ;
- [x] gardes G3, G3b à G3h, G4f, G8 et G9 vertes, chacune avec son cas négatif ; G1 à G7 jamais
      assouplies (`18` §5.1) ;
- [x] **vitrine inchangée** hors du vert de marque (F2, DS-14) : instantané G3e, empreinte de styles
      calculés (TD4) et sonde de cascade verts, fixtures touchées par DS-14 seul (liste explicite des noms) ; aucune police chargée sur la landing ;
- [x] **cascade prouvée dans le navigateur** : sur le parcours, une page membre et le backoffice, les
      couleurs calculées sous KEO égalent la table de `20` §11.3 ;
- [x] polices servies par l'origine seule, deux fichiers `latin` préchargés pour 120 Ko au plus,
      `latin-ext` absent d'une page en français ; aucune requête tierce ni violation de CSP dans aucun
      e2e (filet global A-7) ; `security-headers.ts` inchangé ;
- [x] axe WCAG 2.1 AA + 2.2 AA sans violation sur chaque écran rhabillé, aux largeurs de `18` §12.2 ;
      aucun défilement horizontal à 320, 375 et 768 px ;
- [x] un seul repère « Navigation principale », un seul `aria-current`, barre en bas à 1 023 px et
      colonne à gauche à 1 024 px, rien caché sous la barre ; lien d'évitement en premier, focus
      visible et jamais masqué, focus sur le `h1` après navigation ; mouvement réduit respecté ;
- [x] session et CGU relues à chaque navigation ; parité FR/EN ; e2e existants (`signup-nominal`,
      `journey-resume`, `landing-signup`, `account`, `account-data`, `backoffice.spec`,
      `security-headers.spec`) verts **sans modifier leurs attendus**, tests de logique inchangés ;
- [ ] recette humaine faite (`18` §12.4) : lecture en extérieur sur un vrai téléphone, test du logo,
      clavier seul et lecteur d'écran, zoom 200 % et 400 %, appareils réels ; **accord écrit du
      fondateur** sur les trois gabarits ;
- [ ] revue groupée `testeur` + `expert-cybersecurite` (non bloquante sur `main`, exigée avant
      `production`, D71) ; `21` § Jalon DS à jour, une ligne par commit.

Non couvert, accepté : rendu au pixel de la vitrine (pas de captures de référence en CI : rendu
différent entre systèmes, effets animés, garde G4 sur les images), Safari et Firefox, LCP et CLS réels
sur 4G, paires de couleurs hors matrice (`18` §8, lignes 15 à 22).

## Périmètre

| Dans le jalon | Hors du jalon |
|---|---|
| Bloc de tokens KEO dans `tokens.css` des deux fronts (`02` §21.3), `tokens-backoffice.css` | La **landing** et les **pages légales publiques** (vitrine D59, F1), sauf leur vert de marque aligné par DS-14 (F2) |
| Polices Manrope et Source Sans 3 auto-hébergées (`02` §21.4) | `packages/ui` (reste au Lot 2, `21` §7) |
| Gabarit des espaces membres : colonne gauche ≥ `lg`, barre du bas < `lg` (`17` §2.2, §2.3) | Les écrans des Lots 2 à 5 (construits plus tard, directement en KEO) |
| Gabarit du backoffice : rail, bande de tête, navigation compacte, écran « poste de travail » (`17b` §1.4, §1.7) | Les deux vues téléphone de D58 (Lot 4) |
| Primitives des deux registres (`20` §11.8) | Repli de la colonne, mode clair (`20` Q6) |
| Rhabillage : parcours d'inscription et de connexion, accueils de rôle, « Mon compte » (informations, préférences, sessions, données et zone de danger D72) | Gabarits d'e-mails (testés en clair et en sombre, `20` §8) |
| Rhabillage du backoffice v0 : connexion, activation, accueil, inscrits et fiche, invitations, double validation, réglages Apollo, comptes internes, santé technique | Tout changement de texte métier ou de parcours |

## Arbitrages appliqués

| Sujet | Décision | Par | Référence |
|---|---|---|---|
| Frontière dans `apps/web` | **KEO** : parcours d'inscription et de connexion, accueils, « Mon compte », Lots 2 à 5. **Vitrine** : landing, pages légales publiques, 404 et erreur de niveau `[locale]`, bandeau cookies. Le texte des CGU affiché *dans* le parcours est rendu en KEO | `chef-de-projet` (entre `architecte` et `expert-ux`) ; F1 tranché par le fondateur (2026-10-29) : pages légales publiques en vitrine | `02` §21.2, `20` §11.1 |
| Mécanique des tokens | Un seul `tokens.css` par front, deux chartes : `@theme static` (vitrine) + bloc `[data-theme="keo"]` qui re-valorise les rôles ; attribut posé par `app/[locale]/(member)/layout.tsx` et par `<html>` du backoffice ; alias redéclarés ; liste `KEO_INHERITS` | `architecte` | `02` §21.3 |
| Valeurs | Table KEO → rôles, **aucune nouvelle valeur de couleur** (KEO, D6, D72 ou violet `17b` V1) ; contrastes calculés sur chaque surface | `expert-ux` | `20` §11.3, §11.4 |
| Succès | Sous KEO, texte et icône de succès en **`#3ccfcf`** (teinte de la palette KEO réaffectée, aucune valeur nouvelle ; 180° contre 155° pour l'action, soit 25°), fond `#0d2b28` et bordure `#146b62` hérités ; vitrine inchangée (`#2dd4bf`). **G3d** : dans chaque charte, succès à **20° au moins** de l'action (repos, survol, appui) et de l'information ; un succès n'est jamais plein | `expert-ux`, sur le calcul de `architecte` (`#2dd4bf` à 17° du vert KEO) | `20` §11.3, §11.4, `02` §21.8 |
| Polices | `next/font/local`, woff2 non modifiés (OFL), `latin` + `latin-ext`, manifeste `FONTS.md`, ≤ 120 Ko préchargés, aucune requête tierce, CSP inchangée | `architecte` | `02` §21.4 |
| Navigation | Un seul `<nav>` « Navigation principale », rendu une fois et restylé en CSS (barre du bas < `lg`, colonne ≥ `lg`) ; aucun repli persisté (aucune API de stockage, D37) | `architecte`, `expert-ux` | `02` §21.5, `17` §2.2 |
| Entrées sans écran | **Masquées** jusqu'à leur lot ; une entrée apparue ne disparaît plus ; gabarit conçu et testé pour 5 entrées (membres) et 7 (backoffice) | `chef-de-projet` | `17` §2.1, `17b` §1.7 |
| Backoffice sous `lg` | Entre `md` et `lg` : backoffice complet, navigation compacte horizontale (fenêtre demi-écran d'un commercial). Sous `md`, ou sous 500 px de haut (téléphone en paysage) : écran « poste de travail », sans contenu métier, jusqu'aux vues D58 | `chef-de-projet` (compromis entre `architecte` et `expert-ux`) ; condition de hauteur ajoutée par le fondateur (F7, 2026-10-29) | `17b` §1.7, §7.2 M4 |
| Effets | **Halo d'en-tête, agrandissement au survol et soulèvement des cartes gardés**, sous `motion-safe:` seulement, jamais `transition: all`, durées et halo par tokens ; ombre lumineuse du bouton principal gardée (token) ; panneaux flottants autorisés là où ils sont pertinents (jugement `expert-ux`, écran par écran) ; réduction à l'appui écartée | Fondateur (F6, 2026-10-29, contre la recommandation ; amende l'arbitrage `chef-de-projet` du 2026-10-28) | `20` §11.5 à §11.7, `02` §21.5 point 7 |
| Pages autonomes | Parcours, CGU à ré-accepter, déconnecté, compte supprimé : aucune navigation principale | `expert-ux` | `20` §11.8, `02` §21.5 point 9 |
| Icônes | `lucide-react` (déjà épinglé) par le seul `icons.ts` de chaque front, règle ESLint | `architecte` | `02` §21.5 |

## Préalables du fondateur (avant DS-2)

DS-1 (gardes et instantané de la vitrine) peut commencer sans attendre.

| # | Question | Recommandation | Bloque |
|---|---|---|---|
| F1 | Frontière : faut-il passer aussi les pages légales publiques en KEO ? | **Tranché (2026-10-29) : non**, pages légales publiques en vitrine (défaut confirmé) | DS-4 |
| F2 | **Un seul vert de marque**, landing comprise (`#29e075` en vitrine, `#1dd68a` dans les espaces, deux écrans consécutifs) ? | **Tranché (2026-10-29) : oui**, `#1dd68a` partout, revue visuelle D59 ; commit DS-14 ajouté, G3e mise à jour par liste explicite | DS-14 |
| F3 | Badge « vérifié » en bleu, jamais une coche seule ni collée à un nom | **Tranché (2026-10-29) : oui** | DS-5 |
| F4 | Couleurs de rôle sable (marque) et rose (créateur) : marque visuelle seulement, liste fermée de quatre usages | **Tranché (2026-10-28) : oui** | DS-2 |
| F5 | Affectations différentes de la maquette, sans valeur nouvelle (succès, rouge D72, fonds opaques, contour secondaire `#78827d`, séquestre et surface 5 non repris) | **Tranché (2026-10-28) : oui** | DS-2 |
| F6 | Effets de type Spotify écartés | **Tranché (2026-10-29) : non**, halo, ombre lumineuse du bouton, agrandissement et soulèvement gardés (sous `motion-safe:`) ; panneaux flottants si pertinents | DS-5 |
| F7 | Backoffice : rien de métier sur téléphone avant D58, navigation compacte entre `md` et `lg` | **Tranché (2026-10-29) : oui, plus une condition de hauteur** (écran « poste de travail » sous 500 px de haut, téléphone en paysage compris) | DS-10 |

Le détail argumenté est dans `20` §11.9 ; la décision du fondateur s'inscrit dans D73.

## Commits prévus

Petits commits sur `main`, Conventional Commits, vérification par paliers avant chaque commit (`CLAUDE.md` §7
règle 5), plus `pnpm test:e2e` pour tout commit qui touche un écran. Une ligne par commit dans `21`
§ Jalon DS, à mesure. Exécution : `dev-react-node` ; gardes : `testeur` ; relecture visuelle :
`expert-ux`. Tests exacts de chaque commit et e2e à garder verts : `18` §12.3.

| # | Commit | Livre | Prouve |
|---|---|---|---|
| DS-1 | `test(guards): theme-aware token readers and a frozen vitrine` | Lecteur unique de valeur effective `effectiveTokens(css, charte)`, fermeture des alias, écart de teinte (`@influx/test-kit/guards`, auto-testés) ; G3e et l'instantané `apps/web/tests/fixtures/vitrine-tokens-d59.json` ; empreinte de styles calculés de la landing (TD4) ; filet global des e2e (A-7) ; planchers relevés | Vitrine épinglée et parcours propres **avant** toute modification ; aucun code de production |
| DS-2 | `feat(tokens): KEO theme block in tokens.css (D73)` | Bloc `[data-theme="keo"]` (table `20` §11.3), rôles nouveaux déclarés dans `@theme`, tokens de gabarit (colonne, barre du bas, `z-nav-bottom`) ; copie octet pour octet dans le backoffice ; G3c, G3d, G3b par charte | Palette AA par calcul, alias fermés, vitrine inchangée ; aucun écran modifié |
| DS-3 | `feat(fonts): self-hosted Manrope and Source Sans 3 (OFL)` | Quatre woff2, licences OFL, `FONTS.md`, `src/styles/fonts.ts` par front ; règle ESLint ; G4f | Licence, empreintes, budget, copies identiques ; nom de famille commun `latin`/`latin-ext` et chiffres tabulaires vérifiés (sinon `latin` seul, consigné) |
| DS-4 | `feat(web): KEO boundary for the member pages` | Groupes `(member)` et `(member)/(space)` (URL inchangées), attribut et polices, `error`/`not-found` de `(member)` ; G8 | Parcours, accueils et « Mon compte » en KEO ; landing et pages légales inchangées ; e2e existants verts |
| DS-5 | `feat(web): member primitives in the KEO theme` | `components/member/ui` (boutons pilule, carte, champs, notices, pastille d'état, compteur « 9+ », en-tête de page) ; `auth-classes.ts` et `account-classes.ts` repointés ; icônes ; G7 étendue ; G3g (couleurs de rôle confinées), G3h | Tokens seuls, aucun conflit de classes, transformation d'état sous `motion-safe:` seulement (F6, G8 assouplie), halo par token de rôle ; primitives partagées avec la landing sans changer son empreinte (TD4) |
| DS-6 | `feat(web): member shell with side column and bottom bar` | `(space)/layout.tsx`, `MemberShell` (session relue au montage et à chaque chemin, CGU), `member-nav.ts`, un seul `<nav>` restylé, bloc d'état à partir de `lg`, `member.json` FR/EN (garde de parité amendée) ; G9 (lecture de session confinée aux coquilles) | Un seul repère à 375 et 1 440 px, `aria-current`, rien sous la barre, redirections de rôle (`17` §2.5) et CGU (`05` RG28) intactes ; aucune navigation sur les pages autonomes |
| DS-7 | `feat(web): KEO sign-in and sign-up screens` | Les trois écrans du parcours et leurs états (`17` §3) | axe à chaque étape ; aucun appel réseau ajouté (`05` RG113) |
| DS-8 | `feat(web): KEO homes and account screens` | Accueils (`17` §2.4), informations, préférences, sessions, données et zone de danger (D72) | axe ; rouge opaque intact (G3b) |
| DS-9 | `feat(backoffice): KEO theme, fonts and density tokens` | `<html data-theme="keo">`, polices, `tokens-backoffice.css` (rail, ligne, cellules, contrôle) ; G3f | Backoffice entier en KEO sans écran modifié ; tokens `-bo-` isolés |
| DS-10 | `feat(backoffice): shell with rail and head band` | Groupes `(auth)` et `(app)`, `Shell` dans la mise en page, rail ≥ `lg`, bande `17b` §1.4, navigation compacte `md`–`lg`, écran « poste de travail » < `md` | Bandeaux relus à chaque navigation, entrées d'administration absentes pour un `agent` (CA63), un seul repère, axe |
| DS-11 | `feat(backoffice): KEO sign-in and activation screens` | Connexion, activation, codes de secours | Mot de passe + TOTP + codes de secours inchangés |
| DS-12 | `feat(backoffice): KEO operations screens` (scindable 12a listes et fiche / 12b administration) | Accueil, inscrits et fiche (tableau dense 36 px), invitations, double validation, réglages Apollo, comptes internes, santé technique | axe sur chaque écran ; e2e du backoffice verts |
| DS-14 | `feat(web): one brand green across the vitrine (F2)` | Vert de marque de la vitrine aligné sur `#1dd68a` ; G3e et la fixture TD4.2 mises à jour par une liste explicite des noms modifiés ; G3d recalculée pour la vitrine (le succès `#2dd4bf` y tombe à 17° du vert : à aligner sur `#3ccfcf` sans valeur nouvelle, sinon `expert-ux`) | Aucune autre déclaration de la vitrine ne bouge ; effets D59 relus par `expert-ux` |
| DS-13 | `docs(mvp): close the DS milestone` | `21` (une ligne), écarts `EC-DS-*` regroupés, specs alignées ; revue groupée | Revue `testeur` + `expert-cybersecurite` faite (non bloquante sur `main`, exigée avant `production`, D71) ; recette visuelle `expert-ux` |

## Agents et questions posées

| Ordre | Agent | Question |
|---|---|---|
| 1 | Fondateur | Aucune (F1 à F7 tranchés) ; accord écrit sur les trois gabarits à la recette |
| 2 | `testeur` | DS-1 : lecteur de valeur effective, instantané et empreinte de la vitrine, filet global A-7 ; puis les gardes G3c à G9 au fil des commits (`18` §5.1) |
| 3 | `dev-react-node` | DS-2 à DS-12 |
| 4 | `expert-ux` | Relecture visuelle à DS-6, DS-8, DS-10 et DS-12 (test du logo, `20` §11.7) ; recette en extérieur sur téléphone |
| 5 | `testeur` + `expert-cybersecurite` | Revue groupée de fin de jalon (CSP, polices servies par l'origine, aucune API de stockage, aucun portail) |

`expert-conformite-rgpd` n'intervient pas : aucune donnée personnelle ni aucun texte juridique ne
change (`CLAUDE.md` §7 règle 5).

## Ce qui ne change pas

- Aucune règle de gestion, aucune route d'API, aucune migration, aucun texte métier ; les clés de
  traduction existantes gardent leur sens (seul `member.json` est ajouté).
- D48 : aucun taux, aucun net, « commission incluse, précisée par votre commercial ».
- Rouge « danger » opaque et identique entre les deux fronts (D72, G3b) ; violet réservé au backoffice.
- La couleur ne porte jamais seule une information (`20` P7) ; WCAG AA calculé **et** vérifié par axe.
- Aucune API de stockage, aucun appel réseau hors du client d'API, CSP à nonce inchangée.
- La landing reste au pixel près celle d'aujourd'hui (G3e), hors du vert de marque aligné par DS-14 (F2).

## Décisions ouvertes

| Sujet | Arbitre | Échéance |
|---|---|---|
| Libellé « Candidatures » (12 caractères, limite de 11 de la barre du bas maintenue, `17` §2.2) | `expert-marketing` | Lot 3 (entrée masquée jusque-là) |
| Repli de la colonne, s'il est demandé : état non persisté | `expert-ux` + `architecte` | Après le pilote |

## Risques

| Risque | Parade |
|---|---|
| On reconnaît Spotify plutôt qu'INFLUX (P1), d'autant que les effets de la maquette sont gardés (F6) | Panneaux flottants réservés aux écrans où ils servent, vocabulaire et formes propres à INFLUX, test du logo à chaque relecture (`20` §11.7) ; un effet gardé ne se retire que par le fondateur |
| Vert d'action et succès confondus (teintes proches) | Seuil de teinte vérifié par G3d ; le plein réservé à l'action, le succès jamais en fond plein (`20` §11.3) |
| Un alias garde sa valeur vitrine sous KEO (résolu sur `:root`) | Redéclaration dans le bloc KEO, garde G3c (fermeture des alias) |
| Une modale rendue hors du conteneur perd la charte | Aucun `createPortal` sous KEO, `<dialog>` natif sur place (G8) |
| La landing bouge par effet de bord | Instantané G3e posé au DS-1, avant toute modification ; e2e « landing sans police » |
| Polices : décalage de mise en page, poids, licence | Repli métrique, préchargement `latin` seul, budget 120 Ko, manifeste et SHA-256 (G4f), fichiers non modifiés (OFL) |
| Régression des parcours pendant la refonte des gabarits | e2e existants verts à chaque commit ; la session et l'écran des CGU restent relus à chaque navigation |
| Contrastes insuffisants sur les surfaces hautes (`text-tertiary`, rouge D72 sur `surface-active`) | Paires interdites listées dans `20` §11.4 et refusées par G3d |
