# Landing page INFLUX : rapport de tests (étape 6)

> **Rédigé par :** `testeur` (skill `test-strategy`), le 2026-09-17.
> **Build testé :** `feat/landing-page`, non commité ; serveur de production local (`corepack pnpm --filter @influx/web start`, port 3000), arrêté en fin de session (port libéré, vérifié par `netstat`).
> **Outillage :** Playwright (`playwright-core`) + `@axe-core/playwright` installés dans le scratchpad uniquement, Chromium Playwright 1228. Aucune dépendance ajoutée au dépôt, aucun fichier du dépôt modifié hors ce rapport.
> Scripts et captures : `C:\Users\cdurb\AppData\Local\Temp\claude\c--Users-cdurb-Documents-Workspaces-influx\7ebd0b4c-de37-4395-a7c7-a645fa4b73c8\scratchpad\landing-qa\` et `...\scratchpad\landing-screens\` (appelés ci-dessous `qa/` et `screens/`).

## 1. Verdict

### « Prêt pour revue du fondateur » : **NON**

Points bloquants :

1. **Cartes créateurs illisibles sur mobile (A1).** En dessous de 480 px (320 et 375 px, FR et EN), les 10 cartes créateurs (sections 3, 9 et 15) n'affichent que la photo : la thématique, le badge « Vérifié », la tranche d'audience et le pays sont rejetés hors de la carte (`flex` en ligne + `overflow-hidden`) et invisibles. Le parcours mobile, prioritaire (CLAUDE.md §5.2), perd le contenu clé de trois sections. KO sur CA2, CA17 (affichage) et CA24.
2. **Le bouton pause du carrousel de logos ne fait rien (A2).** Après un clic, `aria-pressed="true"` et `data-paused="true"`, mais l'animation continue (`animation-play-state: running`, la piste se déplace de 60 px en 800 ms). La pause au survol et au focus est cassée aussi. Cause probable : la règle `animation-play-state: paused` est dans `@layer base` (`globals.css` l. 28-33), et l'utilitaire `animate-marquee` du calque `utilities` la réécrase avec le raccourci `animation`. Non-conformité WCAG 2.2.2 : KO sur CA25.
3. **Défilement horizontal à 320 et 375 px (A3).** `scrollWidth` 327 et 382 px, en FR et en EN. Même cause que le point 1 : les `sr-only` des cartes sont poussés hors de l'écran. Le correctif de A1 devrait régler A3 : un contrôle est à refaire.

Tout le reste est conforme ou mineur : qualité (typecheck, lint, 33 tests, build, format, audit), zéro requête tierce, formulaire sans aucune requête ni stockage, parité FR/EN, longueurs, `noindex`, clavier et focus, axe sans violation critique ou sérieuse. Après correction de A1 à A3 et un nouveau passage de `qa/screens.mjs` et `qa/mq.mjs`, le verdict peut passer à « oui » sans refaire toute la campagne.

## 2. Critères d'acceptation

| CA | Statut | Preuve |
|---|---|---|
| CA1 | OK | `qa/screens.mjs` à 1440 px FR/EN : ordre DOM = bandeau, en-tête, 16 sections (`aria-labelledby` hero … start-form), pied de page ; bannière cookies présente au chargement. Captures `screens/fr-1440.png`, `slice-fr-1440-00..06.png` |
| CA2 | **KO** | L'ordre est correct à 375 px et le menu mobile fonctionne (ouverture, 7 entrées, Échap referme et rend le focus). Mais les cartes créateurs sont vides de texte (A1). `screens/slice-en-375-00/01.png`, `fr-375-mobile-menu-open.png` |
| CA3 | Non vérifiable | Test humain à faire à la revue du fondateur. Constat : à 1440×900, la bannière cookies masque les boutons du hero (restent visibles dans l'en-tête) ; à 375 px, elle couvre la moitié de l'écran (A6) |
| CA4 (code) | OK | `grep -ri wekollab` dans `apps/` : une seule occurrence, dans `CREDITS.md` (mention de non-provenance). Aucune ressource, classe ni fichier issus du site. Comparaison des textes : hors de mon périmètre (07) |
| CA5 | Partiel | Relecture visuelle des captures : aucune promesse d'algorithme ou d'IA, aucun pays ouvert nommé. Pas de relecture éditoriale exhaustive |
| CA6 | OK | `grep -rnE "href\|mailto:\|tel:" apps/web/src` : 0. DOM : 0 `<a>`, 0 attribut `href` (5 largeurs × 2 langues) ; garde G1 verte |
| CA7 | Partiel | 25 boutons inactifs visibles cliqués (menu, CTA, pied de page, vidéo, Personnaliser) : URL, DOM et défilement inchangés, 0 requête. Accordéons, carrousel d'études de cas, FR/EN, menu mobile et bannière fonctionnent. **La pause du défilement des logos ne fonctionne pas** (A2). « Voir la vidéo » est inactif, comme prévu (A8) |
| CA8 | OK | Parcours annonceur puis créateur validés jusqu'au message final : **0 nouvelle requête** au clic de validation ; les seules requêtes après chargement sont 2 images en chargement différé du carrousel (localhost). Cookies 0, `localStorage` 0, `sessionStorage` 0, `document.cookie` vide. Message « Maquette : rien n'a été envoyé » / « Mockup: nothing was sent ». `screens/*-1440-form-notice.png` |
| CA9 | OK | Consentement marketing non coché au départ, distinct des CGU ; décoché après passage annonceur → créateur (CGU conservées). Champs : profil, e-mail, entreprise (annonceur seul), pays, langue, majorité (créateur seul), CGU |
| CA10 | OK | Champ vide → message texte relié par `aria-describedby`, `aria-invalid="true"` (sauf radios, choix documenté), focus sur le premier champ en erreur, aux 3 étapes et pour les 2 profils. Retour à l'étape 2 : e-mail, entreprise et pays conservés. Rechargement : étape 1, rien de coché. `screens/*-form-step2-errors.png`, `*-form-creator-step3-errors.png` |
| CA11 | OK | Accepter, Refuser et Personnaliser avec le même style (`fr-1440-viewport.png`). Refuser ferme la bannière, qui revient au rechargement. Hôtes contactés à chaque largeur et langue : `localhost:3000` uniquement |
| CA12 | OK | Pied de page (`slice-fr-1440-06.png`) : « © 2026 INFLUX », sans raison sociale, adresse ni immatriculation |
| CA13 | OK | `<meta name="robots" content="noindex, nofollow">` en FR et EN |
| CA14 | OK | Bandeau visible sans défiler à toutes les largeurs (bas du bandeau à 40-109 px). Constante `IS_MOCKUP`, garde G6 |
| CA15 | OK | Recherche des valeurs de 04 §3 (15 marques, e-mail, 1240, 2400, 3,6, +38/24/52/31/45, mentions) : présentes seulement dans `src/content/placeholders/` et dans `tests/guards.test.ts` (listes de garde). « 3.6 % » et « +38 % » apparaissent aussi dans deux commentaires de code (A9). Import du module limité à `layout.tsx` et `page.tsx` |
| CA16 | Partiel | Marques en texte seul, fictives (vérification web faite en 07). Pas de nouvelle recherche d'antériorité |
| CA17 | **KO** | D16 : aucun `@`, URL ni `www.` dans les sections 3, 9 et 15 (toutes largeurs). Mais sur mobile, thématique, audience, pays et badge ne sont pas affichés (A1) |
| CA18 | OK | Conversation en HTML/CSS (`slice-fr-1440-01/02.png`), sans e-mail, téléphone, pseudo ni URL |
| CA19 | OK | `slice-fr-1440-04.png` : 35 % = 20 % + 15 %, incluse ; 2 000,00 € → 400,00 + 300,00 = 700,00 → net créateur 1 300,00 € ; vérification affichée avec la devise |
| CA20 | OK | Montants en texte dans les JSON (garde G3, relecture de `PricingSection`) ; aucun simulateur |
| CA21 | Partiel | Montants de la section tarifs et de l'illustration du téléphone étiquetés et en euros. Les réponses de la FAQ n'ont pas été ouvertes une à une ; avis de `expert-paiement-facturation` à confirmer |
| CA22 | OK | Aucune couleur `#`, `rgb(`, `hsl(`, `oklch(` hors `tokens.css`. Seules longueurs littérales : `image-sizes.ts` (attribut `sizes`, exception G3 documentée). En-tête « PROVISOIRE (D6) » présent |
| CA23 | OK | Aucun texte JSX littéral trouvé (recherche + règle ESLint). Parité : 241 clés FR = 241 clés EN (`qa/lengths.mjs`). Bascule FR↔EN : URL, `html[lang]`, h1 et focus sur le bouton de langue, sans cookie ni stockage |
| CA24 | **KO** | Défilement horizontal à 320 et 375 px (FR/EN) et texte des cartes coupé (A1, A3). OK à 768, 1024 et 1440 px |
| CA25 | **KO** | axe : 0 critique, 0 sérieuse (seule `landmark-unique`, modérée, A5). Contraste : aucune violation axe. Clavier : 54 arrêts à 1440 px (55 éléments, les 2 radios comptant pour 1), focus visible sur 100 %, bouclage sans piège, y compris à 375 px avec le menu. `prefers-reduced-motion` : la piste animée est remplacée par une grille statique. **Pause des logos non fonctionnelle** (A2). Lighthouse non passé |
| CA26 | OK | 31 fichiers dans `images/`, 31 présents dans `CREDITS.md` ; `public/` inexistant ; 21 images décoratives `alt=""`. Contrôle visuel des 6 photos : §3, A4 |
| CA27 | OK | Voir tableau ci-dessous |
| CA28 | Non vérifiable | Rien n'est commité, comme prévu avant l'accord du fondateur |

**Qualité (A)**, commandes lancées le 2026-09-17 :

| Commande | Résultat |
|---|---|
| `corepack pnpm exec prettier --check .` | OK |
| `corepack pnpm -r run typecheck` | OK |
| `corepack pnpm -r run lint` | OK (0 avertissement) |
| `corepack pnpm -r run test` | OK : 2 fichiers, **33 tests** |
| `corepack pnpm -r run build` | OK, `/fr` et `/en` en SSG |
| `corepack pnpm audit --audit-level high` | No known vulnerabilities found |
| `grep ": any\|as any"` dans `src` | 0 |

**Longueurs (C)** : `qa/lengths.mjs` extrait 199 clés `landing.*` avec leur maximum dans 04 et réalise 384 contrôles FR/EN (balises riches retirées) : **0 dépassement, 0 clé manquante**. 7 gabarits ICU (pluriels, nombres) sont exclus du calcul, car leur rendu ne se mesure pas sur le texte brut ; la relecture des captures ne montre pas de débordement.

## 3. Anomalies

| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| A1 | **bloquant** | `src/components/ui/CreatorCard.tsx` l. 25-35 ; sections 3, 9 et 15 ; < 640 px (constaté à 320 et 375), FR et EN | Sous `sm`, la carte passe en `flex-row` avec une image prévue à `w-1/3`. Mais le cadre de l'image mesure 341 px pour une carte de 343 px (la largeur est probablement écrasée par `ResponsiveImage`). Le bloc texte commence à x = 382 px, hors de la carte en `overflow-hidden` : thématique, badge, audience et pays sont invisibles (`slice-en-375-00/01.png`). L'image est aussi floue : 123 px chargés pour 341 px affichés, car `sizes` vaut `33vw` | Carte lisible sur mobile, avec l'image au tiers de la largeur (ou empilée) et le texte visible ; `sizes` adapté à la largeur réelle |
| A2 | **bloquant** | `src/app/globals.css` l. 28-33 et `MarqueeCarousel.tsx` ; section 5 ; toutes largeurs, FR et EN | Pause par bouton, survol ou focus sans effet : `animation-play-state` reste `running` et la piste avance (`qa/mq.mjs`). La règle du calque `base` perd face à l'utilitaire `animate-marquee` | Défilement figé après un clic sur pause, au survol et au focus (WCAG 2.2.2, 02 §2.5) |
| A3 | **bloquant** | Page entière, 320 et 375 px, FR et EN | `document.documentElement.scrollWidth` = 327 et 382 px : les `span.sr-only` des cartes (A1) dépassent de 7 px | `scrollWidth` ≤ largeur de la fenêtre (CA24) |
| A4 | majeur (conformité, à arbitrer) | `img-case-03.jpg` (casque blanc) et `img-case-05.jpg` (clavier) ; section 6 | Aucun logo lisible, mais les designs ressemblent fortement à des produits réels : casque de type JBL Tune, clavier à touche orange de type Keychron K6. Ils illustrent des marques fictives avec des résultats inventés (`photo-case-03-1440.png`, `photo-case-05-1440.png`) | Décision de `expert-conformite-rgpd` : garder ou remplacer (05 §6) |
| A5 | mineur | `CaseStudiesSection.tsx` : `section` et `div` du carrousel tous deux libellés par `case-studies-title` ; 375 et 1440 px | axe `landmark-unique` (modérée) : deux régions portent le même nom accessible | Nom distinct pour la région du carrousel (ex. `aria-roledescription` + libellé propre) |
| A6 | mineur (UX, pour CA3) | Bannière cookies, 1440×900 et 375×740 | À 1440 px, la bannière recouvre les boutons du hero ; à 375 px, elle occupe environ 40 % de l'écran à l'arrivée (`fr-1440-viewport.png`, `en-375-viewport.png`) | Avis de `expert-ux` avant le test des 10 secondes |
| A7 | mineur | Menu mobile, 375 px | Un clic sur une entrée du menu ne le referme pas (aucun autre effet, conforme à CA7) | À confirmer par `expert-ux` |
| A8 | mineur | Section 6, « Voir la vidéo » ×5 | Bouton inactif qui annonce une vidéo, hors périmètre (00 §3) | Garder (maquette) ou retirer : décision `expert-ux` / fondateur |
| A9 | mineur | `landing-content.ts` l. 54 et 72, `FeaturedResultSection.tsx` l. 12 | Commentaires de code citant « 3.6 % » et « +38 % » (exemples de format) | Exemples neutres, pour que la recherche CA15 reste sans ambiguïté |

### Contrôle visuel des 6 photos (05 §6)

| Image | Cadrage réel | Résultat |
|---|---|---|
| IMG-HERO-01 | 4:3 à 375 px, 4:5 à 1440 px, `object-position 50% 35%` | Aucun visage visible (buste, mains, téléphone). OK |
| IMG-CRE-04 | Carte 4:5 | Aucun logo lisible sur la chaussure. OK (floue à 375 px, A1) |
| IMG-CRE-05 | Carte 4:5 | Touches « ENTER », « PgUp » et kana, sans logo de marque. OK |
| IMG-USE-04 | 3:2 | Carte bancaire sans logo de banque ni de réseau, texte illisible. OK |
| IMG-CASE-03 | Carré 1440 px | Aucun logo, mais le design d'un produit réel est reconnaissable. À arbitrer (A4) |
| IMG-CASE-05 | Carré 1440 px | Aucun logo, mais le design d'un produit réel est reconnaissable. À arbitrer (A4) |

Lisibilité générale à 1440 px (7 tranches relues) : pas de chevauchement, de texte tronqué ni d'image déformée. À 375 px : A1.

## 4. Captures produites

Dossier `C:\Users\cdurb\AppData\Local\Temp\claude\c--Users-cdurb-Documents-Workspaces-influx\7ebd0b4c-de37-4395-a7c7-a645fa4b73c8\scratchpad\landing-screens\` :

- Pages entières : `fr-320.png`, `fr-375.png`, `fr-768.png`, `fr-1024.png`, `fr-1440.png`, `en-320.png`, `en-375.png`, `en-768.png`, `en-1024.png`, `en-1440.png`
- Écran d'arrivée : `fr-375-viewport.png`, `fr-1440-viewport.png`, `en-375-viewport.png`, `en-1440-viewport.png`
- Tranches lisibles : `slice-fr-1440-00.png` à `slice-fr-1440-06.png` (sans bannière), `slice-en-375-00.png` à `slice-en-375-10.png`
- Formulaire : `fr-1440-form-step2-errors.png`, `fr-1440-form-creator-step3-errors.png`, `fr-1440-form-notice.png`, et les équivalents `en-*`
- Menu mobile : `fr-375-mobile-menu-open.png`
- Photos en densité 2x : `photo-{hero-01,cre-04,cre-05,use-04,case-03,case-05}-{375,1440}.png`

Scripts relançables dans `...\scratchpad\landing-qa\` : `screens.mjs` (largeurs, structure, axe), `interact.mjs` (clics, formulaire, réseau, stockage, langue, mouvement réduit, menu mobile), `keyboard.mjs`, `mq.mjs` (pause des logos), `photos.mjs`, `card.mjs` (A1), `lengths.mjs` (longueurs et parité).

## 5. Non couvert et pourquoi

| Point | Raison |
|---|---|
| CA3 (10 secondes) | Test humain à la revue du fondateur |
| CA4 textes, CA5 et CA16 en profondeur | Relecture éditoriale et comparaison avec wekollab.fr réservées à `expert-conformite-rgpd` et `expert-marketing` |
| CA21 : réponses de la FAQ | Panneaux non relus un à un ; avis de `expert-paiement-facturation` requis |
| Lighthouse | Non installé (aucune dépendance ajoutée) ; axe-core le remplace pour l'accessibilité |
| Contraste hors détection axe (textes sur images, états de survol) | Non mesuré à la main |
| Lecteur d'écran réel (NVDA, VoiceOver) | Non disponible ; seuls les attributs ARIA ont été vérifiés |
| Navigateurs Firefox et Safari, appareils réels | Seul Chromium est disponible |
| Longueur des clés `ph.*` et des 7 gabarits ICU | Hors JSON ou rendu non mesurable sur le texte brut ; relu à l'œil seulement |
| Mouvement réduit du carrousel d'études de cas (défilement doux) | Seul le défilement des logos a été testé |
| CA28 | Aucun commit attendu à ce stade |
| Mode `dev` | Tests faits sur le build de production (`next start`), plus proche du rendu final |
