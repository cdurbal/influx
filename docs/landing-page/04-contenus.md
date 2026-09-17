# Landing page INFLUX : contenus FR / EN

> **Révisé le 2026-09-17 après les revues 06 et 07** (`06-revue-paiement.md` §3 : points #1 à #17 ;
> `07-revue-conformite.md` §2 : lignes 1 à 14, 18, 19 et 23). Textes des points bloquants #1 à #4
> repris **à l'identique**.
>
> **Statut :** étape 3 du plan validé par le fondateur le 2026-09-16. Rédigé par `expert-marketing`
> le 2026-09-17.
> **Sources :** `CLAUDE.md` §2 à §5 (prime en cas d'écart), `docs/cadrage-mvp.md` §3 et §4,
> `00-cadrage.md` (CA4, CA5, CA12, CA14 à CA21), `01-architecture.md` §5 et §6,
> `02-ux-wireframes.md` (blocs, clés, longueurs), `05-images.md` (textes alternatifs).
> **Destinataires :** `expert-paiement-facturation` et `expert-conformite-rgpd` (étape 4),
> `dev-react-node` (étape 5), `testeur` (étape 6).
> **Originalité (CA4) :** tous les textes ont été écrits pour INFLUX à partir de sa proposition de
> valeur. La première version a été rédigée **sans consulter** les textes de wekollab.fr ; la
> révision du 2026-09-17 a été faite à partir de `07-revue-conformite.md`, qui cite de courts
> extraits du site pour signaler les rapprochements à supprimer. Seule la structure des blocs
> (fixée par `02-ux-wireframes.md`) est reprise.

## 0. Conventions

| Sujet | Règle |
|---|---|
| Colonne « Clé » | Clé suivie de sa longueur maximale entre parenthèses (espaces compris, texte **rendu**, en FR comme en EN). `landing.*` va dans `src/locales/{fr,en}/landing.json` ; `ph.*` va dans `src/content/placeholders/index.ts` (contenu fictif ou propre à la maquette). |
| Texte à copier | Le contenu de la cellule, tel quel. Les gabarits ICU sont entre backticks : copier sans les backticks. |
| Typographie FR | Apostrophe `’` (U+2019), déjà présente dans les cellules. **Espaces insécables : les cellules contiennent des espaces ordinaires, pour rester lisibles dans ce document.** En écrivant `landing.json` et le module fictif, `dev-react-node` remplace, dans les textes FR uniquement : l'espace avant `?`, `;`, `!`, `%` et l'espace entre les milliers (`2 000,00`, `1 300,00`) par U+202F ; l'espace avant `:` et avant `€`, et les espaces intérieurs de `« »`, par U+00A0. Les gabarits ICU (`::percent`, `::compact-short`) produisent eux-mêmes les bons espaces. |
| Typographie EN | Apostrophe `’` aussi (aucun piège d'échappement ICU). |
| Montants | Texte statique, jamais calculé : FR `2 000,00 €`, EN `€2,000.00` ; taux FR `35 %`, EN `35%`. Tout montant est étiqueté (montant du contrat, commission INFLUX ou une de ses parts, net créateur) avec sa devise (CA21). |
| Champs obligatoires | Les libellés ne contiennent pas l'astérisque : le composant l'ajoute (à confirmer par `expert-ux`). |

**Vocabulaire fixe FR / EN** (à reprendre à l'identique dans les écrans et e-mails des lots suivants) :

| FR | EN |
|---|---|
| marque (public) · annonceur (libellés financiers et formulaire) | brand · advertiser |
| créateur | creator |
| mise en relation | introduction |
| montant du contrat (coût total pour l'annonceur) | contract amount (total cost to the advertiser) |
| commission INFLUX | INFLUX commission |
| part annonceur · part créateur (sous « commission INFLUX totale ») | advertiser share · creator share |
| part annonceur INFLUX · part créateur INFLUX (libellé isolé, ex. légende de la barre) | INFLUX advertiser share · INFLUX creator share |
| net créateur (reversé) | net paid to the creator · creator’s net amount |
| prestataire de paiement agréé | licensed payment provider |
| vérifié (badge) | verified |

## 1. Message clé et ton

### Annonceurs (marques, e-commerçants, PME)

- **Message clé :** publiez votre brief ; l'équipe INFLUX vous propose des créateurs vérifiés, puis vous échangez, signez et payez au même endroit, pour un coût total connu avant de signer.
- **Bénéfices à répéter :** du temps gagné (la sélection est faite par l'équipe), un budget maîtrisé (commission incluse dans le montant du contrat), un cadre sûr (contrat et paiement dans INFLUX).
- **Ton :** direct, concret, vouvoiement, phrases courtes ; aucun superlatif invérifiable ; tout chiffre porte sa source.
- **Commission :** présentée d'emblée comme le prix d'un service, avec sa répartition 20 % / 15 %, jamais comme un détail à découvrir.
- **Interdits :** algorithme ou IA de mise en relation, recherche libre de créateurs, statistiques automatiques, pays ouverts nommés, dates d'ouverture ; « payer à INFLUX », qui détient les fonds, moment du paiement, sort de la commission en cas d'annulation (06, T2 et T3).

### Créateurs de contenu (majeurs, particuliers ou professionnels)

- **Message clé :** l'équipe vous présente à des marques qui correspondent à votre contenu ; vous connaissez votre net créateur avant de signer, et il vous est reversé via INFLUX une fois votre publication validée.
- **Bénéfices à répéter :** des opportunités rémunérées sans prospecter, un pseudo masqué jusqu'à la signature, un net connu d'avance.
- **Ton :** chaleureux et respectueux du métier ; vouvoiement sur cette page commune (le tutoiement pourra être testé sur la page créateurs du Lot 1).
- **Argent :** toujours distinguer montant du contrat, commission INFLUX et net créateur ; le net vaut 65 % du montant du contrat avec les taux standard.
- **Interdits :** promesse d'un volume de propositions ou d'un revenu, connexion automatique aux réseaux, délai de reversement.

## 2. Contenus par bloc

Ordre de `02-ux-wireframes.md` §3.

### 2.1 Bandeau « Maquette » (`MockupBanner`)

| Clé | FR | EN |
|---|---|---|
| `ph.mockupBanner.regionLabel` (20) | Avis de maquette | Mockup notice |
| `ph.mockupBanner.label` (40) | Maquette : contenus fictifs | Mockup: fictitious content |
| `ph.mockupBanner.detail` (110) | Chiffres, marques, études de cas, profils et messages sont inventés. Boutons inactifs. Rien n’est envoyé. | Figures, brands, case studies, profiles and messages are invented. Buttons are inactive. Nothing is sent. |

### 2.2 En-tête (`SiteHeader`)

| Clé | FR | EN |
|---|---|---|
| `landing.common.brandName` (6) | INFLUX | INFLUX |
| `landing.header.navLabel` (30) | Navigation principale | Main navigation |
| `landing.header.nav.method` (14) | Méthode | Our method |
| `landing.header.nav.creators` (14) | Créateurs | Creators |
| `landing.header.nav.useCases` (14) | Cas d’usage | Use cases |
| `landing.header.nav.pricing` (14) | Tarifs | Pricing |
| `landing.header.nav.faq` (14) | FAQ | FAQ |
| `landing.header.menuButton` (12) | Menu | Menu |
| `landing.header.contactLabel` (30) | Contact par e-mail : | Contact by email: |
| `ph.contact.email` (32) | contact@influx.example | contact@influx.example |
| `landing.header.languageSwitcher.label` (20) | Langue du site | Site language |
| `landing.header.languageSwitcher.fr` (3) | FR | FR |
| `landing.header.languageSwitcher.frName` (12) | Français | Français |
| `landing.header.languageSwitcher.en` (3) | EN | EN |
| `landing.header.languageSwitcher.enName` (12) | English | English |
| `landing.common.cta.advertiser` (20) | Créer une campagne | Create a campaign |
| `landing.common.cta.creator` (20) | Recevoir des offres | Get brand deals |

Les deux libellés de CTA se comprennent seuls (§2.2 des wireframes) : l'un nomme l'action de la
marque, l'autre celle du créateur. **Bouton annonceur** : « Créer une campagne » retenu par défaut
(07, ligne 6) en attendant l'arbitrage du fondateur (FC1, §4) ; variante « Publier un brief » /
« Post a brief ». `ph.contact.email` utilise le domaine réservé `.example`
(RFC 2606) : il ne peut appartenir à personne.

### 2.3 Section 1 : Hero (`HeroSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.hero.overline` (40) | Marketplace marques et créateurs | Brand and creator marketplace |
| `landing.hero.title` (70) | Marques et créateurs : de la rencontre au contrat, au même endroit | Brands and creators: from introduction to contract, in one place |
| `landing.hero.lead` (170) | L’équipe INFLUX propose aux marques des créateurs vérifiés et aux créateurs des campagnes qui leur ressemblent. Messagerie, contrat et paiement : tout se passe ici. | The INFLUX team introduces brands to verified creators, and creators to campaigns that fit them. Messaging, contract and payment all happen here. |
| `landing.common.doors.advertiserAudience` (30) | Vous êtes une marque | You’re a brand |
| `landing.common.doors.creatorAudience` (30) | Vous créez du contenu | You create content |
| `landing.common.cta.advertiser` (20) | *(voir 2.2)* | *(see 2.2)* |
| `landing.common.cta.creator` (20) | *(voir 2.2)* | *(see 2.2)* |
| `landing.hero.reassurance` (90) | Inscription gratuite. Commission INFLUX uniquement sur les contrats signés. | Free to sign up. INFLUX commission only on signed contracts. |
| `landing.hero.visualChip` (36) | Nouvelle proposition reçue | New proposal received |
| `ph.images.hero01.alt` (125) | Mains photographiant au smartphone un produit tout juste sorti de son colis | Hands photographing a freshly unboxed product with a smartphone |

Test des 10 secondes (CA3) : le surtitre dit la catégorie, le titre dit qui et quoi, le chapeau dit
comment (équipe, messagerie, contrat, paiement), les lignes de public disent où cliquer.

### 2.4 Section 2 : Bandeau chiffre clé (`KeyFigureSection`)

Le chiffre retenu est celui qui compte pour INFLUX : des **contrats signés**. Au Lot 1, le même
gabarit recevra la valeur réelle ; tant qu'elle n'existe pas, la section n'est pas rendue.

| Clé | FR | EN |
|---|---|---|
| `landing.keyFigure.srTitle` (30) | INFLUX en chiffres | INFLUX in numbers |
| `ph.keyFigure.value` (nombre) | 1240 | 1240 |
| `landing.keyFigure.statement` (90 rendu) | `{value, plural, one {# contrat signé} other {# contrats signés}} entre marques et créateurs dans INFLUX` | `{value, plural, one {# contract signed} other {# contracts signed}} between brands and creators on INFLUX` |
| *Rendu attendu* | 1 240 contrats signés entre marques et créateurs dans INFLUX | 1,240 contracts signed between brands and creators on INFLUX |
| `ph.keyFigure.sourceNote` (60) | Donnée fictive, affichée pour la maquette | Fictitious figure, shown for the mockup |

### 2.5 Section 3 : Vitrine de créateurs (`CreatorShowcaseSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.creatorShowcase.overline` (40) | Créateurs sélectionnés | Hand-picked creators |
| `landing.creatorShowcase.title` (70) | Des profils vérifiés, choisis pour votre brief | Verified profiles, chosen for your brief |
| `landing.creatorShowcase.lead` (180) | Pour chaque campagne, notre équipe vous propose des créateurs dont la thématique, l’audience et les formats répondent à votre brief. Vous décidez avec qui avancer. | For each campaign, our team suggests creators whose topics, audience and formats fit your brief. You decide who to move forward with. |

**Libellés communs des cartes créateurs** (sections 3, 9 et 15)

| Clé | FR | EN |
|---|---|---|
| `landing.common.creatorCard.audienceRange` (32 rendu) | `{min, number, ::compact-short} – {max, number, ::compact-short} abonnés` | `{min, number, ::compact-short}–{max, number, ::compact-short} followers` |
| *Rendu attendu* | 10 k – 50 k abonnés | 10K–50K followers |
| `landing.common.creatorCard.countryLabel` (12) | Pays : | Country: |
| `landing.common.creatorCard.verifiedBadge` (12) | Vérifié | Verified |
| `landing.common.creatorCard.verifiedLegend` (140) | Vérifié : statistiques et propriété du compte contrôlées par l’équipe. Les pseudos restent masqués jusqu’à la signature du contrat. | Verified: stats and account ownership checked by our team. Usernames stay hidden until the contract is signed. |
| `ph.creatorCards.sourceNote` (60) | Profils fictifs, affichés pour la maquette | Fictitious profiles, shown for the mockup |

`ph.creatorCards.sourceNote` est commune aux sections 3, 9 et 15 et s'affiche avec la légende
« vérifié » (07, ligne 14 ; emplacement exact fixé par `expert-ux`).

**Cartes fictives** : `ph.creatorShowcase.cards.<n>` ; `verified` vaut `true` pour les trois.
Ni pseudo, ni nom, ni lien (D16, CA17).

| Carte | `theme` (24) FR | `theme` EN | `audienceMin` | `audienceMax` | `country` (24) FR | `country` EN | Image |
|---|---|---|---|---|---|---|---|
| 1 | Beauté | Beauty | 10000 | 50000 | France | France | IMG-CRE-01 |
| 2 | Cuisine | Cooking | 50000 | 100000 | Belgique | Belgium | IMG-CRE-02 |
| 3 | Voyage | Travel | 100000 | 500000 | Canada | Canada | IMG-CRE-03 |

### 2.6 Section 4 : Résultat mis en avant (`FeaturedResultSection`)

Indicateur de performance uniquement, aucun montant (wireframes §2.7).

| Clé | FR | EN |
|---|---|---|
| `landing.featuredResult.overline` (40) | Résultat de campagne | Campaign result |
| `landing.featuredResult.title` (70) | Quand le profil colle au produit, l’audience répond | When the profile fits the product, the audience responds |
| `ph.featuredResult.value` (nombre) | 0.036 | 0.036 |
| `landing.featuredResult.valueDisplay` (10 rendu) | `{value, number, ::percent .0}` | `{value, number, ::percent .0}` |
| *Rendu attendu* | 3,6 % | 3.6% |
| `ph.featuredResult.metricLabel` (60) | Taux de clic moyen des stories vers la boutique en ligne | Average click-through rate from stories to the online shop |
| `ph.featuredResult.trend.value` (nombre) | 0.9 | 0.9 |
| `ph.featuredResult.trend.months` (nombre) | 3 | 3 |
| `landing.featuredResult.trendDisplay` (30 rendu) | `{value, number, ::sign-always .0} pt en {months, plural, one {# mois} other {# mois}}` | `{value, number, ::sign-always .0} pts in {months, plural, one {# month} other {# months}}` |
| *Rendu attendu* | +0,9 pt en 3 mois | +0.9 pts in 3 months |
| `landing.featuredResult.trendUp` (12) | en hausse | rising |
| `ph.featuredResult.context` (160) | Thés et infusions : 6 créateurs bien-être et cuisine, vidéos courtes et stories, sur 3 mois de campagne. | Teas and herbal infusions: 6 wellness and food creators, short videos and stories, over a 3-month campaign. |
| `ph.featuredResult.sourceNote` (60) | Résultat fictif, affiché pour la maquette | Fictitious result, shown for the mockup |

**Note pour `architecte` et `dev-react-node` :** `ph.featuredResult.trend` devient un objet à deux
nombres (`value`, `months`) pour que le gabarit ICU gère le signe, la décimale et le pluriel.

**Révision (07, ligne 10) :** titre changé et indicateur remplacé (taux de clic des stories au lieu
du taux d'engagement), pour ne pas cumuler les ressemblances avec la référence.

### 2.7 Section 5 : Carrousel de logos (`BrandLogosSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.brandLogos.title` (50) | Ils publient leurs campagnes sur INFLUX | Brands running their campaigns on INFLUX |
| `landing.common.carousel.pause` (40) | Mettre en pause le défilement | Pause the scrolling |
| `ph.brandLogos.sourceNote` (60) | Marques fictives, inventées pour la maquette | Fictitious brands, invented for the mockup |

**Marques fictives** : `ph.brandLogos.brands`, 15 noms identiques en FR et en EN (16 caractères
maximum), dans cet ordre. Le secteur est interne (cohérence avec les études de cas), il n'est pas
affiché. Vérification de non-correspondance : section 3.2.

| # | Nom | Secteur interne |
|---|---|---|
| 1 | Lysmouré | Soins de la peau (étude de cas 1) |
| 2 | Kaffrune | Café (étude de cas 2) |
| 3 | Ondarive | Audio (étude de cas 3) |
| 4 | Bolbruyère | Art de la table (étude de cas 4) |
| 5 | Clavembre | Accessoires tech (étude de cas 5) |
| 6 | Cousevaine | Mode |
| 7 | Pédalune | Vélo |
| 8 | Aurifane | Bijoux |
| 9 | Crêtenval | Plein air |
| 10 | Vuescarde | Lunettes |
| 11 | Fjelmora | Bagagerie |
| 12 | Flammoisy | Bougies |
| 13 | Croquembel | Biscuits |
| 14 | Semavrille | Jardinage |
| 15 | Infuvelle | Thés et infusions (résultat de la section 4) |

### 2.8 Section 6 : Études de cas (`CaseStudiesSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.caseStudies.overline` (40) | Études de cas | Case studies |
| `landing.caseStudies.title` (70) | Campagnes signées et livrées dans INFLUX | Campaigns signed and delivered on INFLUX |
| `landing.caseStudies.lead` (180) | Chaque exemple précise le secteur, les formats, la durée et le nombre de créateurs, avec l’indicateur suivi par la marque. | Each example shows the sector, formats, duration and number of creators, along with the metric the brand tracked. |
| `landing.caseStudies.metricDisplay` (10 rendu) | `{value, number, ::percent sign-always}` | `{value, number, ::percent sign-always}` |
| *Rendu attendu (cas 1)* | +38 % | +38% |
| `landing.caseStudies.videoButton` (20) | Voir la vidéo | Watch the video |
| `landing.common.carousel.previous` (30) | Diapositive précédente | Previous slide |
| `landing.common.carousel.next` (30) | Diapositive suivante | Next slide |
| `landing.common.carousel.roleDescription` (20) | carrousel | carousel |
| `landing.common.carousel.slideRoleDescription` (20) | diapositive | slide |
| `landing.common.carousel.slideLabel` (20 rendu) | `{current, number} sur {total, number}` | `{current, number} of {total, number}` |
| `ph.caseStudies.sourceNote` (60) | Études de cas fictives, créées pour la maquette | Fictitious case studies, created for the mockup |

**Diapositives fictives** : `ph.caseStudies.items.caseNN`. Les indicateurs sont des hausses mesurées
par la marque avec ses propres outils ; aucun montant.

| Champ (Max) | case01 | case02 | case03 | case04 | case05 |
|---|---|---|---|---|---|
| `sector` FR (24) | Cosmétique | Café de spécialité | Audio | Art de la table | Accessoires tech |
| `sector` EN | Cosmetics | Specialty coffee | Audio | Tableware | Tech accessories |
| `brandName` (24, FR = EN) | Lysmouré | Kaffrune | Ondarive | Bolbruyère | Clavembre |
| `metricValue` (nombre) | 0.38 | 0.24 | 0.52 | 0.31 | 0.45 |
| `metricLabel` FR (50) | Hausse des visites de la page produit | Hausse des abonnements à la box mensuelle | Hausse des ventes suivies par code promo | Hausse des ajouts au panier sur la collection | Hausse des inscriptions à la liste d’attente |
| `metricLabel` EN | Increase in product page visits | Increase in monthly box subscriptions | Increase in sales tracked by promo code | Increase in add-to-carts for the collection | Increase in waiting list sign-ups |
| `summary` FR (140) | Lancement d’un sérum : 8 créateurs beauté, vidéos courtes et tutoriels, sur 6 semaines. | Offre d’abonnement : 5 créateurs cuisine et lifestyle, recettes en vidéo et posts, sur 2 mois. | Casque sans fil : 12 créateurs tech et musique, tests en vidéo longue et stories, sur 4 semaines. | Collection de tasses : 6 créateurs maison et déco, contenus UGC et posts, sur 5 semaines. | Précommande d’un clavier : 4 créateurs tech et jeux vidéo, vidéos de montage et stories, sur 3 semaines. |
| `summary` EN | Serum launch: 8 beauty creators, short videos and tutorials, over 6 weeks. | Subscription offer: 5 food and lifestyle creators, recipe videos and posts, over 2 months. | Wireless headphones: 12 tech and music creators, long-form video reviews and stories, over 4 weeks. | Mug collection: 6 home and decor creators, UGC content and posts, over 5 weeks. | Keyboard pre-order: 4 tech and gaming creators, build videos and stories, over 3 weeks. |

**Textes alternatifs** (repris de `05-images.md` §4.4, clés `ph.images.*` conformément à 01 §6.1)

| Clé | FR | EN |
|---|---|---|
| `ph.images.case01.alt` (125) | Flacon de sérum à pipette posé sur un pot en verre, dans une lumière douce | Dropper serum bottle resting on a glass jar in soft light |
| `ph.images.case02.alt` (125) | Sachet ouvert rempli de grains de café torréfiés | Open bag filled with roasted coffee beans |
| `ph.images.case03.alt` (125) | Casque audio sans fil blanc sur fond blanc | White wireless headphones on a white background |
| `ph.images.case04.alt` (125) | Deux tasses en céramique blanches sur fond gris clair | Two white ceramic mugs on a light grey background |
| `ph.images.case05.alt` (125) | Clavier mécanique compact aux touches grises et orange sur une table en bois | Compact mechanical keyboard with grey and orange keys on a wooden table |

### 2.9 Section 7 : Problème et conversation (`ProblemSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.problem.overline` (40) | Ce qui freine vos campagnes | What slows your campaigns down |
| `landing.problem.title` (70) | Entre relances et accords informels, les collaborations s’enlisent | Between follow-ups and informal deals, collaborations stall |
| `landing.problem.lead` (180) | Messages sans réponse, tarifs flous, accords passés en quelques lignes : sans cadre commun, chaque collaboration repart de zéro. | Unanswered messages, unclear rates, deals agreed in a few lines: without a shared framework, every collaboration starts from scratch. |
| `landing.problem.painPoints.search` (90) | Des heures à repérer des profils, sans savoir si leurs statistiques sont fiables. | Hours spent spotting profiles, without knowing if their stats are reliable. |
| `landing.problem.painPoints.followUp` (90) | Des relances dispersées entre e-mails, réseaux et messageries. | Follow-ups scattered across emails, social networks and chat apps. |
| `landing.problem.painPoints.contract` (90) | Des accords informels, sans contrat écrit ni paiement sécurisé. | Informal deals, with no written contract and no secure payment. |
| `landing.problem.conversation.frameTitle` (30) | Messagerie INFLUX | INFLUX messaging |
| `landing.problem.conversation.advertiserRole` (16) | Marque | Brand |
| `landing.problem.conversation.creatorRole` (16) | Créateur | Creator |
| `landing.problem.conversation.systemEvent` (50) | Proposition de contrat envoyée dans INFLUX | Contract proposal sent in INFLUX |
| `landing.problem.conversation.caption` (120) | Échanges, contrat et paiement restent dans INFLUX : nul besoin de partager vos coordonnées. | Messages, contract and payment stay in INFLUX: no need to share your contact details. |
| `ph.problem.conversation.sourceNote` (60) | Conversation fictive, écrite pour la maquette | Fictitious conversation, written for the mockup |
| `landing.common.cta.advertiser` (20) | *(voir 2.2)* | *(see 2.2)* |

**Messages fictifs** : `ph.problem.conversation.messages.mN` (140 chacun). Aucun e-mail, téléphone,
URL, `@` ni pseudo (CA18). L'échange illustre la campagne de café de l'étude de cas 2.

| Message | `author` | `text` FR | `text` EN |
|---|---|---|---|
| m1 | `advertiser` | Bonjour ! Votre univers cuisine colle à notre lancement de café. Seriez-vous disponible pour deux vidéos courtes en mars ? | Hi! Your cooking content fits our coffee launch really well. Would you be up for two short videos in March? |
| m2 | `creator` | Avec plaisir. Je peux proposer une recette filmée et une story des coulisses. Le brief précise-t-il le ton attendu ? | Happy to. I can offer a filmed recipe and a behind-the-scenes story. Does the brief specify the tone you want? |
| m3 | `advertiser` | Oui : chaleureux et simple. Je vous envoie une proposition de contrat ici, avec le montant et les dates. | Yes: warm and simple. I’ll send you a contract proposal right here, with the amount and dates. |
| m4 | `creator` | Parfait, je la relirai ici. Pratique de voir mon net avant de signer. | Perfect, I’ll review it here. Handy to see my net amount before signing. |

### 2.10 Section 8 : Méthode en 6 étapes (`MethodSection`)

Parcours réel du MVP (`cadrage-mvp.md` §3 et §4) : validation du brief par l'équipe, sélection
humaine, messagerie, contrat entre pays ouverts, paiement via un prestataire agréé non nommé (D9),
reversement après validation. Aucun délai ni moment de paiement promis (D20), aucune mention de
qui détient les fonds (D9) ; conservation des messages sans promesse de durée (07, ligne 23).

| Clé | FR | EN |
|---|---|---|
| `landing.method.overline` (40) | Notre méthode | Our method |
| `landing.method.title` (70) | Du brief au reversement, six étapes suivies par l’équipe | From brief to payout, six steps overseen by our team |
| `landing.method.lead` (180) | L’équipe INFLUX intervient à chaque étape clé. Tout se passe dans la plateforme et reste tracé, pour protéger la marque comme le créateur. | The INFLUX team steps in at key stages. Everything happens on the platform and stays on record, protecting brands and creators alike. |
| `landing.method.steps.brief.title` (32) | Vous publiez votre brief | You publish your brief |
| `landing.method.steps.brief.body` (220) | Produit, objectifs, formats, budget (commission INFLUX incluse), période et public visé : vous décrivez votre campagne. L’équipe la relit et la valide avant sa mise en ligne. | Product, goals, formats, budget (INFLUX commission included), timing and target audience: you describe your campaign. Our team reviews and approves it before it goes live. |
| `landing.method.steps.teamSelection.title` (32) | Nous sélectionnons des créateurs | We hand-pick creators |
| `landing.method.steps.teamSelection.body` (220) | Une personne de l’équipe INFLUX choisit des créateurs vérifiés selon votre brief et motive chaque proposition. Vous acceptez ou refusez, pseudos masqués jusqu’à la signature. | Someone from the INFLUX team picks verified creators for your brief and explains each suggestion. You accept or decline, with usernames hidden until signing. |
| `landing.method.steps.messaging.title` (32) | Vous échangez dans INFLUX | You talk it through in INFLUX |
| `landing.method.steps.messaging.body` (220) | Livrables, dates, ton : vous précisez les détails avec le créateur dans une messagerie dédiée à chaque mise en relation, où vos échanges sont conservés. | Deliverables, dates, tone: you settle the details with the creator in a messaging space dedicated to each introduction, where your conversations are kept. |
| `landing.method.steps.contract.title` (32) | Le contrat se signe dans INFLUX | You sign the contract in INFLUX |
| `landing.method.steps.contract.body` (220) | Le contrat indique, dans une seule devise, son montant, la commission INFLUX incluse et ses deux parts, et le net créateur. Il n’est possible qu’entre parties situées dans des pays ouverts aux contrats. | The contract states, in a single currency, its amount, the included INFLUX commission and its two shares, and the creator’s net amount. It’s only available when both parties are in countries open to contracts. |
| `landing.method.steps.securePayment.title` (32) | La marque paie via INFLUX | The brand pays through INFLUX |
| `landing.method.steps.securePayment.body` (220) | Le paiement passe par un prestataire de paiement agréé. Le montant payé est celui du contrat, commission INFLUX incluse ; le net créateur est reversé après la validation de la publication. | Payment goes through a licensed payment provider. The amount paid is the contract amount, INFLUX commission included; the creator’s net amount is paid out after the publication is approved. |
| `landing.method.steps.publicationPayout.title` (32) | Validation, puis reversement | Approval, then payout |
| `landing.method.steps.publicationPayout.body` (220) | Le créateur dépose la preuve de publication, la marque la valide, puis le net créateur lui est reversé. Au premier contrat, il renseigne son identité et ses coordonnées bancaires auprès du prestataire. | The creator uploads proof of publication, the brand approves it, then the creator’s net amount is paid out. On a first contract, the creator verifies their identity and bank details with the provider. |

### 2.11 Section 9 : Réseau de créateurs (`CreatorNetworkSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.creatorNetwork.overline` (40) | Réseau de créateurs | Creator network |
| `landing.creatorNetwork.title` (70) | Votre profil présenté par l’équipe aux marques de votre univers | Our team presents your profile to brands in your space |
| `landing.creatorNetwork.lead` (180) | Complétez votre profil, faites vérifier vos statistiques et consultez les campagnes ouvertes. Votre pseudo reste masqué jusqu’à la signature du contrat. | Complete your profile, get your stats verified and browse open campaigns. Your username stays hidden until the contract is signed. |
| `ph.creatorNetwork.count` (nombre) | 2400 | 2400 |
| `landing.creatorNetwork.countLabel` (40 rendu) | `{count, plural, one {# créateur vérifié} other {# créateurs vérifiés}}` | `{count, plural, one {# verified creator} other {# verified creators}}` |
| *Rendu attendu* | 2 400 créateurs vérifiés | 2,400 verified creators |
| `ph.creatorNetwork.sourceNote` (60) | Nombre fictif, affiché pour la maquette | Fictitious number, shown for the mockup |
| `landing.common.cta.creator` (20) | *(voir 2.2)* | *(see 2.2)* |

**Cartes fictives** : `ph.creatorNetwork.cards.<n>`, `verified` à `true`. Le pays d'une carte est
celui du créateur fictif, jamais un pays ouvert aux contrats.

| Carte | `theme` FR | `theme` EN | `audienceMin` | `audienceMax` | `country` FR | `country` EN | Image |
|---|---|---|---|---|---|---|---|
| 1 | Sport | Sport | 5000 | 10000 | Suisse | Switzerland | IMG-CRE-04 |
| 2 | Tech et jeux vidéo | Tech & gaming | 10000 | 50000 | Espagne | Spain | IMG-CRE-05 |
| 3 | Musique | Music | 50000 | 100000 | Brésil | Brazil | IMG-CRE-06 |
| 4 | Maison et déco | Home & decor | 10000 | 50000 | États-Unis | United States | IMG-CRE-07 |

### 2.12 Section 10 : Cas d'usage (`UseCasesSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.useCases.overline` (40) | Cas d’usage | Use cases |
| `landing.useCases.title` (70) | Votre objectif guide le choix des créateurs | Your goal shapes which creators we suggest |
| `landing.useCases.lead` (180) | Contenus pour vos canaux, offre à relayer, sortie d’un produit ou présence dans la durée : indiquez votre objectif dans le brief, l’équipe s’en sert pour choisir les profils. | Content for your channels, an offer to push, a product release or a lasting presence: state your goal in the brief, and our team uses it to pick profiles. |
| `landing.useCases.formatsLabel` (12) | Formats : | Formats: |
| `landing.useCases.items.ugc.title` (36) | Des contenus pour vos canaux | Content for your own channels |
| `landing.useCases.items.ugc.body` (160) | Des photos et vidéos tournées par des créateurs, à publier sur vos pages et publicités. Durée et supports d’utilisation sont fixés dans le contrat. | Photos and videos shot by creators, to post on your pages and ads. How long and where you may use them is set out in the contract. |
| `landing.useCases.items.ugc.formats` (60) | photo produit, vidéo tutoriel, témoignage | product photo, tutorial video, testimonial |
| `landing.useCases.items.acquisition.title` (36) | Mettre en avant une offre | Promote an offer |
| `landing.useCases.items.acquisition.body` (160) | Un code de réduction ou une offre limitée, relayés par des créateurs ; vous suivez les ventes avec vos propres outils. | A discount code or limited-time offer shared by creators; you track sales with your own tools. |
| `landing.useCases.items.acquisition.formats` (60) | code promo en story, vidéo courte, post | promo code in stories, short video, post |
| `landing.useCases.items.productLaunch.title` (36) | Sortir un nouveau produit | Release a new product |
| `landing.useCases.items.productLaunch.body` (160) | Faites découvrir votre produit dès sa sortie, à une audience déjà sensible à votre univers. | Introduce your product from day one to an audience already drawn to your category. |
| `landing.useCases.items.productLaunch.formats` (60) | unboxing, vidéo courte, story | unboxing, short video, story |
| `landing.useCases.items.awareness.title` (36) | Prendre place dans une communauté | Become part of a community |
| `landing.useCases.items.awareness.body` (160) | Installez votre marque dans la durée, auprès de créateurs dont la ligne éditoriale vous ressemble. | Build a lasting presence with creators whose editorial style matches your brand. |
| `landing.useCases.items.awareness.formats` (60) | post, série de stories, vidéo longue | post, story series, long-form video |

**Révision (07, lignes 1 à 3) :** ordre d'affichage des cartes désormais `ugc`, `acquisition`,
`productLaunch`, `awareness` (report dans `02` §3.12 et `05` §4.6 par `expert-ux`) ; titres,
chapeau et trois textes réécrits. Le texte `awareness.body` a aussi été réécrit, pour ne pas
répéter le nouveau titre (« communauté » / “Become part of a community”). « Avec vos propres
outils » et « fixés dans le contrat » évitent de promettre des statistiques automatiques (hors MVP)
ou des droits d'usage non encore rédigés.

**Textes alternatifs** (repris de `05-images.md` §4.6 ; identifiants d'images inchangés, chaque photo
suit sa carte dans le nouvel ordre : `ugc` IMG-USE-03, `acquisition` IMG-USE-04, `productLaunch`
IMG-USE-01, `awareness` IMG-USE-02)

| Clé | FR | EN |
|---|---|---|
| `ph.images.use01.alt` (125) | Boîtes d’emballage en carton kraft sur fond orange | Kraft cardboard packaging boxes on an orange background |
| `ph.images.use02.alt` (125) | Public en silhouette filmant un concert avec des smartphones | Silhouetted audience filming a concert on smartphones |
| `ph.images.use03.alt` (125) | Main photographiant une tarte aux fruits avec un smartphone | Hand photographing a fruit pie with a smartphone |
| `ph.images.use04.alt` (125) | Mains tenant un smartphone et une carte bancaire pour un achat en ligne | Hands holding a smartphone and a bank card to shop online |

### 2.13 Section 11 : Comment ça marche (`HowItWorksSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.howItWorks.overline` (40) | Pour commencer | Getting started |
| `landing.howItWorks.title` (70) | Trois étapes pour démarrer, que vous soyez marque ou créateur | Three steps to get started, whether you’re a brand or a creator |
| `landing.howItWorks.lead` (180) | L’inscription est gratuite et ne demande que l’essentiel. Plus votre profil est complet, mieux l’équipe peut vous proposer des mises en relation pertinentes. | Signing up is free and only asks for the essentials. The more complete your profile, the better our team can suggest relevant introductions. |
| `landing.howItWorks.audience.advertiser` (16) | Marques : | Brands: |
| `landing.howItWorks.audience.creator` (16) | Créateurs : | Creators: |
| `landing.howItWorks.steps.createAccount.title` (36) | Créez votre compte gratuit | Create your free account |
| `landing.howItWorks.steps.createAccount.advertiser` (100) | Quelques informations suffisent pour ouvrir votre compte entreprise. | A few details are enough to open your company account. |
| `landing.howItWorks.steps.createAccount.creator` (100) | Quelques informations suffisent, avec l’attestation de votre majorité. | A few details are enough, plus confirming you’re of legal age. |
| `landing.howItWorks.steps.completeProfile.title` (36) | Complétez votre profil | Complete your profile |
| `landing.howItWorks.steps.completeProfile.advertiser` (100) | Secteur, produits, objectifs, budget indicatif : l’équipe cible mieux ses propositions. | Sector, products, goals, indicative budget: these help our team target its suggestions. |
| `landing.howItWorks.steps.completeProfile.creator` (100) | Réseaux, thématiques, audience, formats et tarifs, puis vérification de vos statistiques. | Social accounts, topics, audience, formats and rates, then a check of your stats. |
| `landing.howItWorks.steps.receiveProposals.title` (36) | Recevez des propositions | Receive proposals |
| `landing.howItWorks.steps.receiveProposals.advertiser` (100) | L’équipe vous propose des créateurs vérifiés, avec le motif de chaque choix. | Our team suggests verified creators and explains each choice. |
| `landing.howItWorks.steps.receiveProposals.creator` (100) | L’équipe vous propose des campagnes adaptées ; vous acceptez ou refusez. | Our team sends you relevant campaigns; you accept or decline. |
| `landing.howItWorks.completenessIllustration` (30) | Profil complété à 80 % | Profile 80% complete |
| `landing.common.doors.*`, `landing.common.cta.*` | *(voir 2.2 et 2.3)* | *(see 2.2 and 2.3)* |

### 2.14 Section 12 : Tarifs transparents (`PricingSection`)

Tout est dans `landing.json` (aucun fictif), en texte statique. Principes appliqués (CA19 à CA21) :
la commission est présentée comme le **prix d'un service** ; le montant du contrat est toujours
nommé « coût total pour l'annonceur » ; la commission totale précède ses deux parts, qui commencent
par « dont » ; le net créateur est nommé à chaque occurrence ; aucun « frais », « hors taxes »,
prestataire ni pays nommé.

| Clé | FR | EN |
|---|---|---|
| `landing.pricing.overline` (40) | Tarifs transparents | Transparent pricing |
| `landing.pricing.title` (70) | Gratuit à l’inscription, commission seulement sur contrat signé | Free to join, commission only on signed contracts |
| `landing.pricing.lead` (180) | La commission INFLUX est le prix d’un service : sélection des créateurs par l’équipe, messagerie dédiée, contrat et paiement sécurisés. Rien n’est dû à INFLUX sans contrat signé. | The INFLUX commission is the price of a service: team-selected creators, dedicated messaging, secure contract and payment. Nothing is owed to INFLUX without a signed contract. |
| `landing.pricing.rate.label` (30) | Commission INFLUX | INFLUX commission |
| `landing.pricing.rate.total` (6) | 35 % | 35% |
| `landing.pricing.rate.included` (70) | incluse dans le montant du contrat, jamais ajoutée | included in the contract amount, never added on top |
| `landing.pricing.rate.legend.advertiserShare.label` (24) | Part annonceur INFLUX | INFLUX advertiser share |
| `landing.pricing.rate.legend.advertiserShare.value` (6) | 20 % | 20% |
| `landing.pricing.rate.legend.creatorShare.label` (24) | Part créateur INFLUX | INFLUX creator share |
| `landing.pricing.rate.legend.creatorShare.value` (6) | 15 % | 15% |
| `landing.pricing.rate.legend.netCreator.label` (24) | Net créateur | Creator’s net amount |
| `landing.pricing.rate.legend.netCreator.value` (6) | 65 % | 65% |
| `landing.pricing.example.caption` (50) | Exemple : contrat de 2 000,00 € (en euros) | Example: a €2,000.00 contract (in euros) |
| `landing.pricing.example.columnItem` (20) | Élément | Item |
| `landing.pricing.example.columnAmount` (20) | Montant | Amount |
| `landing.pricing.example.contractAmount.label` (60) | Montant du contrat (coût total pour l’annonceur) | Contract amount (total cost to the advertiser) |
| `landing.pricing.example.contractAmount.value` (12) | 2 000,00 € | €2,000.00 |
| `landing.pricing.example.commissionTotal.label` (50) | Commission INFLUX totale (35 %) | Total INFLUX commission (35%) |
| `landing.pricing.example.commissionTotal.value` (12) | 700,00 € | €700.00 |
| `landing.pricing.example.advertiserShare.label` (50) | dont part annonceur (20 %) | of which advertiser share (20%) |
| `landing.pricing.example.advertiserShare.value` (12) | 400,00 € | €400.00 |
| `landing.pricing.example.creatorShare.label` (50) | dont part créateur (15 %) | of which creator share (15%) |
| `landing.pricing.example.creatorShare.value` (12) | 300,00 € | €300.00 |
| `landing.pricing.example.netCreator.label` (40) | Net créateur reversé | Net paid to the creator |
| `landing.pricing.example.netCreator.value` (12) | 1 300,00 € | €1,300.00 |
| `landing.pricing.example.check` (**140**, relevée de 70 : 06 #13) | Vérification : 400,00 € (part annonceur) + 300,00 € (part créateur) + 1 300,00 € (net créateur) = 2 000,00 € (montant du contrat) | Check: €400.00 (advertiser share) + €300.00 (creator share) + €1,300.00 (creator’s net amount) = €2,000.00 (contract amount) |
| `landing.pricing.audience.advertiser` (140) | Côté annonceur (la marque) : vous payez le montant du contrat, qui inclut déjà toute la commission INFLUX. | Advertiser (the brand): you pay the contract amount, which already includes the full INFLUX commission. |
| `landing.pricing.audience.creator` (140) | Côté créateur : vous connaissez votre net créateur avant de signer, soit 65 % du montant du contrat avec les taux standard. | Creator: you see your net amount before signing, which is 65% of the contract amount at standard rates. |
| `landing.pricing.notes.currency` (120) | Exemple en euros. Chaque contrat est établi dans une seule devise, choisie dans la liste proposée par INFLUX. | Example in euros. Each contract uses a single currency, chosen from the list offered by INFLUX. |
| `landing.pricing.notes.taxes` (160) | L’exemple ne détaille pas les taxes. Celles qui s’appliquent au contrat dépendent des pays et du statut de chacun ; elles sont indiquées avant la signature. | The example doesn’t break down taxes. Taxes that apply to the contract depend on the countries and each party’s status; they are shown before signing. |
| `landing.pricing.phone.caption` (120) | Illustration : avant de signer, le créateur voit le montant du contrat, la commission INFLUX incluse et le net créateur. | Illustration: before signing, the creator sees the contract amount, the included INFLUX commission and their net amount. |
| `landing.pricing.phone.screenTitle` (30) | Proposition de contrat | Contract proposal |
| `landing.pricing.phone.netLabel` (30) | Votre net créateur reversé | Your net amount paid out |
| `landing.pricing.phone.netValue` (12) | 1 300,00 € | €1,300.00 |
| `landing.pricing.phone.contractLine` (60) | sur un contrat de 2 000,00 €, commission INFLUX incluse | on a €2,000.00 contract, INFLUX commission included |
| `landing.pricing.phone.commissionLine` (60) **nouvelle** | Commission INFLUX (35 %) : 700,00 € | INFLUX commission (35%): €700.00 |
| `landing.pricing.phone.sharesLine` (60) **nouvelle** | dont part annonceur 400,00 € et part créateur 300,00 € | of which advertiser share €400.00 and creator share €300.00 |
| `landing.pricing.phone.fakeButton` (20) | Accepter le contrat | Accept the contract |

**Révision (06, #1 à #5 et #9 à #13) :** note sur les taxes (#1, bloquant, texte repris tel quel) ;
libellés de la légende (#3 et #4, bloquants, textes repris tels quels ; #5) ; titre (#9) ; écran du
téléphone : libellé du net (#10), deux nouvelles lignes `commissionLine` et `sharesLine` sous
`contractLine`, `aria-hidden` comme le reste de l'écran (#11, à reporter dans `02` §3.14 par
`expert-ux`), légende (#12, 120 caractères, à la limite) ; vérification étiquetée (#13) : longueur
maximale portée à **140**, à reporter dans `02` §3.14.

**Lecture de contrôle de l'exemple** (identité comptable de `CLAUDE.md` §3) : montant du contrat
2 000,00 € = part annonceur 400,00 € (20 %) + part créateur 300,00 € (15 %) + net créateur
1 300,00 € (65 %) ; commission INFLUX totale = 400,00 € + 300,00 € = 700,00 € (35 %).

### 2.15 Section 13 : Pourquoi INFLUX (`WhyInfluxSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.whyInflux.overline` (40) | Pourquoi INFLUX | Why INFLUX |
| `landing.whyInflux.title` (70) | Tout est fait pour que la collaboration aboutisse | Built to see every collaboration through |
| `landing.whyInflux.lead` (180) | Une équipe qui sélectionne, un cadre qui protège, un seul endroit pour tout suivre : voici ce que la commission INFLUX vous apporte. | A team that selects, a framework that protects, one place to follow everything: that’s what the INFLUX commission pays for. |
| `landing.whyInflux.items.qualifiedMatching.title` (40) | Une sélection faite par notre équipe | A selection made by our team |
| `landing.whyInflux.items.qualifiedMatching.body` (180) | Chaque proposition est préparée par l’équipe, à partir de votre brief et de profils aux statistiques vérifiées. Vous savez pourquoi chaque créateur vous est proposé. | Every suggestion is prepared by our team, based on your brief and on profiles with verified stats. You know why each creator is suggested to you. |
| `landing.whyInflux.items.secureContract.title` (40) | Un contrat et un paiement sécurisés | A secure contract and payment |
| `landing.whyInflux.items.secureContract.body` (180) | Le contrat affiche son montant, sa devise, la commission INFLUX incluse et le net créateur. Paiement via un prestataire agréé ; net reversé après validation de la publication. | The contract shows its amount, currency, the included INFLUX commission and the creator’s net amount. Payment via a licensed provider; net paid out once the content is approved. |
| `landing.whyInflux.items.allInInflux.title` (40) | Tout reste dans INFLUX | Everything stays in INFLUX |
| `landing.whyInflux.items.allInInflux.body` (180) | Messages, contrat et paiement sont réunis au même endroit, sans besoin d’échanger vos coordonnées. En cas de désaccord, ce qui a été convenu est facile à retrouver. | Messages, contract and payment sit in one place, with no need to swap contact details. If there’s a disagreement, what was agreed is easy to find. |

Le troisième argument explique pourquoi tout passe par la plateforme sous l'angle de la protection
des deux parties, sans menace ni allusion au contournement.

### 2.16 Section 14 : FAQ (`FaqSection`)

Huit questions propres à INFLUX, dans l'ordre et avec les identifiants des wireframes. Tout montant
est étiqueté et accompagné de sa devise ; aucun prestataire, pays ouvert ni délai n'est nommé.

| Clé | FR | EN |
|---|---|---|
| `landing.faq.overline` (40) | Questions fréquentes | Frequently asked questions |
| `landing.faq.title` (70) | Tout savoir avant de vous inscrire | What to know before you sign up |
| `landing.faq.lead` (180) | Argent, pays, profils, messagerie : l’essentiel à savoir, pour les marques comme pour les créateurs. | Money, countries, profiles, messaging: the essentials, for brands and creators alike. |
| `landing.faq.items.signupCost.question` (90) | L’inscription sur INFLUX est-elle payante ? | Does it cost anything to sign up for INFLUX? |
| `landing.faq.items.signupCost.answer` (400) | Non. L’inscription est gratuite pour les marques comme pour les créateurs, sans abonnement. INFLUX se rémunère uniquement par une commission sur les contrats signés dans la plateforme : tant qu’aucun contrat n’est signé, vous ne payez rien à INFLUX. | No. Signing up is free for brands and creators alike, with no subscription. INFLUX only earns money through a commission on contracts signed on the platform: as long as no contract is signed, you pay nothing to INFLUX. |
| `landing.faq.items.commission.question` (90) | Combien coûte INFLUX, et combien touche le créateur ? | How much does INFLUX cost, and what does the creator get? |
| `landing.faq.items.commission.answer` (400) | La commission INFLUX est de 35 % du montant du contrat : 20 % de part annonceur et 15 % de part créateur, incluses dans ce montant, qui est le coût total pour la marque. Exemple en euros : sur un contrat de 2 000,00 €, la commission INFLUX est de 700,00 € (dont 400,00 € de part annonceur et 300,00 € de part créateur) et le net créateur est de 1 300,00 €. Détail dans la section Tarifs. | The INFLUX commission is 35% of the contract amount: a 20% advertiser share and a 15% creator share, both included in that amount, which is the brand’s total cost. Example in euros: on a €2,000.00 contract, the INFLUX commission is €700.00 (of which €400.00 advertiser share and €300.00 creator share) and the net paid to the creator is €1,300.00. Details in the Pricing section. |
| `landing.faq.items.payment.question` (90) | Comment se passe le paiement, et quand le créateur est-il payé ? | How does payment work, and when is the creator paid? |
| `landing.faq.items.payment.answer` (400) | La marque paie le montant du contrat dans INFLUX, via un prestataire de paiement agréé. Le net créateur, soit le montant du contrat moins la commission INFLUX, est reversé au créateur via ce prestataire après la validation de la publication par la marque. Au premier contrat, le créateur vérifie son identité et renseigne ses coordonnées bancaires auprès du prestataire. | The brand pays the contract amount on INFLUX, through a licensed payment provider. The creator’s net amount, meaning the contract amount minus the INFLUX commission, is paid out to the creator through that provider once the brand approves the publication. On their first contract, creators verify their identity and add their bank details with the provider. |
| `landing.faq.items.currency.question` (90) | Dans quelle devise et quelle langue les contrats sont-ils établis ? | Which currency and language are contracts in? |
| `landing.faq.items.currency.answer` (400) | Chaque contrat est établi dans une seule devise, choisie parmi la liste proposée par INFLUX : le montant du contrat, la commission INFLUX et le net créateur sont tous exprimés dans cette devise. La plateforme et les contrats sont disponibles en français et en anglais. | Each contract uses a single currency, chosen from the list offered by INFLUX: the contract amount, the INFLUX commission and the creator’s net amount are all stated in that currency. The platform and contracts are available in French and English. |
| `landing.faq.items.openCountries.question` (90) | Puis-je signer un contrat depuis mon pays ? | Can I sign a contract from my country? |
| `landing.faq.items.openCountries.answer` (400) | L’inscription est ouverte partout dans le monde. Les contrats, eux, s’ouvrent pays par pays, après validation juridique, fiscale et de paiement ; un contrat n’est possible que si la marque et le créateur sont chacun situés dans un pays ouvert. Si le vôtre ne l’est pas encore, votre compte reste actif et nous vous prévenons dès son ouverture. | Anyone can sign up, wherever they are. Contracts, however, open country by country, after legal, tax and payment checks: a contract is only possible if the brand and the creator are each located in an open country. If yours isn’t open yet, your account stays active and we’ll let you know as soon as it opens. |
| `landing.faq.items.hiddenHandles.question` (90) | Pourquoi les pseudos des créateurs sont-ils masqués ? | Why are creators’ usernames hidden? |
| `landing.faq.items.hiddenHandles.answer` (400) | Pour que le choix repose sur des éléments vérifiés et que la collaboration se conclue dans INFLUX, où contrat et paiement protègent les deux parties. Avant la signature, la marque voit les thématiques, l’audience, les statistiques vérifiées, le portfolio et le badge « vérifié ». Le pseudo et les liens vers les réseaux lui sont communiqués une fois le contrat signé. | So that choices rest on verified information and the collaboration is concluded in INFLUX, where the contract and payment protect both parties. Before signing, the brand sees topics, audience, verified stats, portfolio and the “verified” badge. Usernames and social links are shared with the brand once the contract is signed. |
| `landing.faq.items.messaging.question` (90) | Pourquoi les échanges passent-ils par la messagerie INFLUX ? | Why do conversations go through INFLUX messaging? |
| `landing.faq.items.messaging.answer` (400) | Parce que c’est ce qui vous protège. Les messages sont conservés et rattachés à la mise en relation : en cas de désaccord sur ce qui a été convenu, chacun peut s’y référer. Le contrat et le paiement sécurisé n’existent que dans INFLUX, et c’est aussi ce qui permet à l’équipe de vous accompagner jusqu’au reversement du net créateur. | Because it protects you. Messages are kept and linked to the introduction, so if there’s a disagreement about what was agreed, everyone can refer back to them. The contract and secure payment only exist in INFLUX, which is also how our team can support you all the way to the creator’s payout. |
| `landing.faq.items.eligibility.question` (90) | Qui peut s’inscrire comme créateur, et comment les profils sont-ils vérifiés ? | Who can join as a creator, and how are profiles verified? |
| `landing.faq.items.eligibility.answer` (400) | Tout créateur majeur selon la loi du lieu où il réside, particulier ou professionnel. Les mineurs ne sont pas acceptés. L’équipe contrôle les statistiques transmises et la propriété de chaque compte, par exemple avec un code à placer dans la bio. Un profil contrôlé reçoit le badge « vérifié ». Au premier contrat, le créateur vérifie aussi son identité auprès du prestataire de paiement. | Any creator of legal age under the law where they live, whether an individual or a professional. Minors are not accepted. Our team checks the stats provided and the ownership of each account, for example with a code added to the bio. Checked profiles get the “verified” badge. On their first contract, creators also verify their identity with the payment provider. |
| `landing.faq.contactPrompt` (60) | Une autre question ? Écrivez-nous : | Another question? Write to us: |
| `ph.contact.email` (32) | *(voir 2.2)* | *(see 2.2)* |

Longueurs les plus proches de la limite : `eligibility.answer` (FR 388 / 400) et
`commission.answer` (FR 387 / 400). Toute retouche de ces deux réponses doit être recomptée.

**Révision :** `payment.answer` remplacée par le texte de 06 #2 (bloquant, repris tel quel ; il
prime sur 07 ligne 24) ; « commission INFLUX » dans `currency.answer` (06 #15) ; « net créateur » à
la fin de `messaging.answer` (06 #17) ; `eligibility.answer` alignée sur le nouveau libellé de
majorité (« selon la loi du lieu où il réside », 07 ligne 19).

### 2.17 Section 15 : Appel final (`FinalCtaSection`)

| Clé | FR | EN |
|---|---|---|
| `landing.finalCta.title` (60) | Votre prochaine collaboration commence ici | Your next collaboration starts here |
| `landing.finalCta.lead` (140) | Marques, publiez votre brief. Créateurs, complétez votre profil. L’équipe INFLUX fait les présentations. | Brands, publish your brief. Creators, complete your profile. The INFLUX team makes the introductions. |
| `landing.common.doors.*`, `landing.common.cta.*` | *(voir 2.2 et 2.3)* | *(see 2.2 and 2.3)* |

**Cartes fictives** : `ph.finalCta.cards.<n>`, `verified` à `true`.

| Carte | `theme` FR | `theme` EN | `audienceMin` | `audienceMax` | `country` FR | `country` EN | Image |
|---|---|---|---|---|---|---|---|
| 1 | Mode | Fashion | 10000 | 50000 | Maroc | Morocco | IMG-CRE-08 |
| 2 | Loisirs créatifs | Arts & crafts | 5000 | 10000 | Italie | Italy | IMG-CRE-09 |
| 3 | Bien-être | Wellness | 50000 | 100000 | Royaume-Uni | United Kingdom | IMG-CRE-10 |

### 2.18 Section 16 : Formulaire en 3 étapes (`StartFormSection`, `StartFormSteps`)

Clés sous `landing.startForm.` (préfixe omis ci-dessous), sauf `ph.*`. Le consentement marketing
est facultatif, non coché et distinct des CGU (CA9). **Révision (07, ligne 18) :** la clé unique
`marketingConsent.label` est remplacée par deux clés, affichées selon le profil choisi à l'étape 1 :
`labelAdvertiser` nomme les e-mails commerciaux (Brevo) et le contact par l'équipe commerciale
(Apollo.io) ; `labelCreator` précise que les propositions de campagnes ne dépendent pas de la case
(report dans `02` §3.18 par `expert-ux`). Autres révisions : réassurance « gratuit » (07, ligne 13),
libellé et erreur de majorité (07, ligne 19).

| Clé | FR | EN |
|---|---|---|
| `overline` (40) | Créer un compte | Create an account |
| `title` (70) | Créez votre compte en trois étapes | Create your account in three steps |
| `lead` (180) | Choisissez votre profil, indiquez l’essentiel, puis acceptez les conditions. Le reste de votre profil se complète ensuite, à votre rythme. | Choose your profile, enter the essentials, then accept the terms. You can complete the rest of your profile later, at your own pace. |
| `reassurance.free` (60) | Aucun abonnement : l’inscription est gratuite | No subscription: signing up is free |
| `reassurance.progressive` (60) | Profil à compléter à votre rythme | Complete your profile at your own pace |
| `reassurance.noPayment` (60) | Aucun moyen de paiement demandé à l’inscription | No payment details required to sign up |
| `progress` (20 rendu) | `Étape {current, number} sur {total, number}` | `Step {current, number} of {total, number}` |
| `steps.profile.title` (40) | Votre profil | Your profile |
| `steps.account.title` (40) | Votre compte | Your account |
| `steps.consents.title` (40) | Conditions et préférences | Terms and preferences |
| `requiredLegend` (40) | `* Champ obligatoire` | `* Required field` |
| `actions.back` (16) | Retour | Back |
| `actions.continue` (16) | Continuer | Continue |
| `actions.submit` (24) | Créer mon compte | Create my account |
| `profile.legend` (40) | Vous vous inscrivez en tant que | You are signing up as |
| `profile.advertiser.title` (20) | Marque ou annonceur | Brand or advertiser |
| `profile.advertiser.description` (70) | Vous cherchez des créateurs pour promouvoir vos produits | You’re looking for creators to promote your products |
| `profile.creator.title` (20) | Créateur de contenu | Content creator |
| `profile.creator.description` (70) | Vous proposez votre audience et vos formats aux marques | You offer your audience and formats to brands |
| `profile.errors.required` (80) | Choisissez un profil pour continuer. | Choose a profile to continue. |
| `email.label` (30) | Adresse e-mail | Email address |
| `email.errors.required` (80) | Indiquez votre adresse e-mail. | Enter your email address. |
| `email.errors.format` (80) | Vérifiez le format : une adresse e-mail contient un @ et un domaine. | Check the format: an email address contains an @ and a domain. |
| `company.label` (30) | Nom de l’entreprise | Company name |
| `company.errors.required` (80) | Indiquez le nom de votre entreprise. | Enter your company name. |
| `country.labelAdvertiser` (30) | Pays de l’entreprise | Company country |
| `country.labelCreator` (30) | Pays de résidence | Country of residence |
| `country.emptyOption` (30) | Sélectionnez un pays | Select a country |
| `country.openCountriesInfo` (160) | L’inscription est ouverte dans tous les pays. Les contrats s’ouvrent pays par pays : si le vôtre n’est pas encore ouvert, nous vous prévenons à son ouverture. | Sign-up is open in every country. Contracts open country by country: if yours isn’t open yet, we’ll let you know when it opens. |
| `country.errors.required` (80) | Sélectionnez votre pays. | Select your country. |
| `language.legend` (40) | Langue de communication | Communication language |
| `adult.label` (120) | J’atteste avoir l’âge de la majorité selon la loi du lieu où je réside. | I confirm I am of legal age under the law where I live. |
| `adult.hint` (100) | Les mineurs ne peuvent pas s’inscrire comme créateurs sur INFLUX. | Minors cannot sign up as creators on INFLUX. |
| `adult.errors.required` (100) | Confirmez avoir l’âge de la majorité pour continuer. | Confirm you are of legal age to continue. |
| `terms.label` (120) | J’accepte les conditions générales d’utilisation d’INFLUX. | I accept the INFLUX terms of use. |
| `terms.errors.required` (80) | Acceptez les conditions générales d’utilisation pour créer votre compte. | Accept the terms of use to create your account. |
| `marketingConsent.labelAdvertiser` (160) | J’accepte de recevoir les e-mails commerciaux d’INFLUX (conseils, nouveautés, offres) et que son équipe commerciale me contacte (facultatif). | I agree to receive marketing emails from INFLUX (tips, news, offers) and to be contacted by its sales team (optional). |
| `marketingConsent.labelCreator` (160) | J’accepte de recevoir par e-mail les conseils, actualités et invitations d’INFLUX (facultatif). Les propositions de campagnes n’en dépendent pas. | I agree to receive tips, news and invitations from INFLUX by email (optional). Campaign proposals don’t depend on this. |
| `marketingConsent.hint` (120) | Vous pouvez retirer ce consentement à tout moment, depuis votre compte ou via le lien présent dans chaque e-mail. | You can withdraw this consent at any time, from your account or via the link in every email. |
| `privacyNotice` (200) | INFLUX utilise ces informations pour gérer votre compte et, avec votre accord, vous envoyer ses e-mails commerciaux. Vos données et vos droits sont décrits dans la politique de confidentialité. | INFLUX uses this information to manage your account and, with your consent, to send you marketing emails. Your data and rights are described in the privacy policy. |
| `ph.startForm.mockupNotice.title` (50) | Maquette : rien n’a été envoyé | Mockup: nothing was sent |
| `ph.startForm.mockupNotice.body` (200) | Cette page est une maquette. Aucune donnée n’a été transmise ni enregistrée, et aucun compte n’a été créé. Les informations saisies disparaissent si vous rechargez la page. | This page is a mockup. No data was sent or stored, and no account was created. Anything you entered disappears when you reload the page. |
| `ph.startForm.mockupNotice.restart` (20) | Recommencer | Start over |

Les noms de langue des boutons radio reprennent `landing.header.languageSwitcher.frName` et
`.enName` (2.2).

### 2.19 Pied de page (`SiteFooter`)

Aucune raison sociale, forme juridique, adresse ni immatriculation (CA12, D25). Les deux mentions
de confiance ne décrivent que des faits du MVP, sans label ni nom de prestataire (D9).

| Clé | FR | EN |
|---|---|---|
| `landing.common.brandName` (6) | INFLUX | INFLUX |
| `landing.footer.tagline` (90) | Sélection, contrat et paiement : la marketplace des marques et des créateurs. | Selection, contract and payment: the marketplace for brands and creators. |
| `landing.footer.navTitle` (20) | Navigation | Navigation |
| `landing.footer.navLabel` (30) | Navigation du pied de page | Footer navigation |
| `landing.header.nav.*` (14) | *(voir 2.2)* | *(see 2.2)* |
| `landing.footer.legalTitle` (30) | Informations légales | Legal |
| `landing.footer.legal.terms` (30) | Conditions d’utilisation | Terms of use |
| `landing.footer.legal.salesTerms` (30) | Conditions de vente | Terms of sale |
| `landing.footer.legal.privacy` (30) | Confidentialité | Privacy policy |
| `landing.footer.legal.legalNotice` (30) | Mentions légales | Legal notice |
| `landing.footer.legal.cookies` (30) | Politique cookies | Cookie policy |
| `landing.footer.contactTitle` (20) | Contact | Contact |
| `ph.contact.email` (32) | *(voir 2.2)* | *(see 2.2)* |
| `landing.footer.copyright` (40) | © 2026 INFLUX | © 2026 INFLUX |
| `landing.footer.trust.contract` (50) | Contrats signés et conservés dans INFLUX | Contracts signed and stored in INFLUX |
| `landing.footer.trust.payment` (50) | Paiement via un prestataire de paiement agréé | Payments through a licensed payment provider |

L'année est écrite en dur (pas de date calculée dans le composant) ; elle se met à jour à chaque
changement d'année civile.

**Révision (07, ligne 12, avec objection sur le texte proposé) :** la signature ne reprend plus la
tournure « du brief au paiement ». Le texte suggéré, « contrat et paiement compris » / “contract and
payment included”, n'est pas retenu : en français, « compris » se lit comme « inclus dans le prix »
et laisse entendre que le paiement ne coûte rien de plus, ce que `06` (T5, T6) demande de ne pas
promettre tant que la prise en charge des frais du prestataire n'est pas tranchée (D9). Texte retenu
sans cette ambiguïté ; à confirmer par `expert-conformite-rgpd` et `expert-paiement-facturation`.

### 2.20 Bannière cookies (`CookieBanner`)

Texte générique : les finalités réelles des cookies seront fixées au Lot 1 avec
`expert-conformite-rgpd`. Les trois boutons ont des libellés de même longueur perçue.
**Révision (07, ligne 4) :** corps réécrit au conditionnel, sans finalité présumée.

| Clé | FR | EN |
|---|---|---|
| `landing.cookieBanner.regionLabel` (30) | Préférences de cookies | Cookie preferences |
| `landing.cookieBanner.title` (20) | Cookies | Cookies |
| `landing.cookieBanner.body` (180) | Des cookies facultatifs nous aideraient à savoir quelles pages vous sont utiles. Ils ne sont utilisés que si vous les acceptez ; votre choix reste modifiable. | Optional cookies would help us see which pages are useful to you. They are only used if you accept them, and you can change your choice later. |
| `landing.cookieBanner.accept` (16) | Accepter | Accept |
| `landing.cookieBanner.reject` (16) | Refuser | Reject |
| `landing.cookieBanner.customize` (16) | Personnaliser | Customize |
| `ph.cookieBanner.mockupNote` (80) | Maquette : aucun cookie n’est déposé et aucun choix n’est enregistré. | Mockup: no cookie is set and no choice is saved. |

### 2.21 Métadonnées de la page (`landing.meta`)

| Clé | FR | EN |
|---|---|---|
| `landing.meta.title` (60) | INFLUX : la marketplace qui réunit marques et créateurs | INFLUX: the marketplace for brands and creators |
| `landing.meta.description` (155) | Marques : des créateurs vérifiés, sélectionnés par notre équipe. Créateurs : des propositions de marques. Contrat et paiement sécurisés dans INFLUX. | Brands: verified creators, hand-picked by our team. Creators: proposals from brands. Secure contracts and payments on INFLUX. |

## 3. Inventaire du fictif

Tout ce qui suit vit **uniquement** dans `src/content/placeholders/` (CA15) et disparaît au Lot 1.
Règle de tri de `01-architecture.md` §6.1 : inventé, ou propre à la maquette.

### 3.1 Liste des contenus fictifs

| # | Clé `ph.*` | Contenu inventé | Nature | Bloc |
|---|---|---|---|---|
| 1 | `ph.mockupBanner.regionLabel`, `.label`, `.detail` | Textes du bandeau « Maquette » | Propre à la maquette | 2.1 |
| 2 | `ph.contact.email` | `contact@influx.example` (domaine réservé, RFC 2606) | E-mail fictif | 2.2, 2.16, 2.19 |
| 3 | `ph.images.hero01.alt` | Texte alternatif de IMG-HERO-01 (et la photo elle-même) | Photo d'illustration | 2.3 |
| 4 | `ph.keyFigure.value` | 1240 contrats signés | Compteur inventé | 2.4 |
| 5 | `ph.keyFigure.sourceNote` | « Donnée fictive, affichée pour la maquette » | Mention de source | 2.4 |
| 6 | `ph.creatorShowcase.cards` (3) | Beauté 10 k–50 k France ; Cuisine 50 k–100 k Belgique ; Voyage 100 k–500 k Canada ; badges « vérifié » | Profils inventés | 2.5 |
| 7 | `ph.featuredResult.value` | 3,6 % de taux de clic des stories | Chiffre inventé | 2.6 |
| 8 | `ph.featuredResult.metricLabel` | Nom de l'indicateur | Libellé du chiffre inventé | 2.6 |
| 9 | `ph.featuredResult.trend.value`, `.months` | +0,9 pt en 3 mois | Tendance inventée | 2.6 |
| 10 | `ph.featuredResult.context` | Campagne thés et infusions, 6 créateurs, 3 mois | Étude de cas inventée | 2.6 |
| 11 | `ph.featuredResult.sourceNote` | « Résultat fictif, affiché pour la maquette » | Mention de source | 2.6 |
| 12 | `ph.brandLogos.brands` (15) | Lysmouré, Kaffrune, Ondarive, Bolbruyère, Clavembre, Cousevaine, Pédalune, Aurifane, Crêtenval, Vuescarde, Fjelmora, Flammoisy, Croquembel, Semavrille, Infuvelle | Marques inventées | 2.7 |
| 13 | `ph.caseStudies.items.case01` à `.case05` | Secteur, marque, indicateur (+38 %, +24 %, +52 %, +31 %, +45 %), libellé, résumé | Études de cas inventées | 2.8 |
| 14 | `ph.caseStudies.sourceNote` | « Études de cas fictives, créées pour la maquette » | Mention de source | 2.8 |
| 15 | `ph.images.case01.alt` à `.case05.alt` | Textes alternatifs (et photos) | Photos d'illustration | 2.8 |
| 16 | `ph.problem.conversation.messages.m1` à `.m4` | Quatre messages entre une marque et un créateur | Conversation inventée | 2.9 |
| 17 | `ph.creatorNetwork.count` | 2400 créateurs vérifiés | Compteur inventé | 2.11 |
| 18 | `ph.creatorNetwork.sourceNote` | « Nombre fictif, affiché pour la maquette » | Mention de source | 2.11 |
| 19 | `ph.creatorNetwork.cards` (4) | Sport Suisse ; Tech et jeux vidéo Espagne ; Musique Brésil ; Maison et déco États-Unis ; badges | Profils inventés | 2.11 |
| 20 | `ph.images.use01.alt` à `.use04.alt` | Textes alternatifs (et photos) | Photos d'illustration | 2.12 |
| 21 | `ph.finalCta.cards` (3) | Mode Maroc ; Loisirs créatifs Italie ; Bien-être Royaume-Uni ; badges | Profils inventés | 2.17 |
| 22 | `ph.startForm.mockupNotice.title`, `.body`, `.restart` | Message « rien n'a été envoyé » | Propre à la maquette | 2.18 |
| 23 | `ph.cookieBanner.mockupNote` | « Aucun cookie déposé, aucun choix enregistré » | Propre à la maquette | 2.20 |
| 24 | Photos décoratives (IMG-HERO-02, IMG-CRE-01 à 10, IMG-RESULT-01, IMG-PROBLEM-01, IMG-METHOD-01, IMG-STEP-01 à 03, IMG-WHY-01 à 03, IMG-FORM-01) | Fichiers et crédits, texte alternatif vide | Photos d'illustration | `05-images.md` |
| 25 | `ph.brandLogos.sourceNote` | « Marques fictives, inventées pour la maquette » | Mention de source (**ajout 07, ligne 14**) | 2.7 |
| 26 | `ph.creatorCards.sourceNote` | « Profils fictifs, affichés pour la maquette » (sections 3, 9 et 15) | Mention de source (**ajout 07, ligne 14**) | 2.5 |
| 27 | `ph.problem.conversation.sourceNote` | « Conversation fictive, écrite pour la maquette » | Mention de source (**ajout 07, ligne 14**) | 2.9 |

Chaque bloc fictif porte désormais sa mention locale : chiffres, résultat, études de cas, compteur
(déjà prévus) ; marques, cartes créateurs et conversation (ajoutées). Une capture d'une seule
section reste ainsi identifiable comme maquette.

**Ne sont pas fictifs** (ils restent dans `landing.json`) mais sont des **illustrations** à relire
au Lot 1 : la puce « Nouvelle proposition reçue » (2.3), l'illustration « Profil complété à 80 % »
(2.13), l'écran du téléphone reprenant l'exemple de référence (2.14), les rôles « Marque » /
« Créateur » de la conversation (2.9).

### 3.2 Vérification des marques fictives (CA16)

Méthode : recherche web du nom exact entre guillemets, le 2026-09-17 (moteur de recherche
disponible dans l'environnement, résultats orientés États-Unis). Critère d'exclusion : marque,
entreprise, produit, personne connue ou œuvre portant le même nom ou un nom quasi identique.

| Nom retenu | Résultat |
|---|---|
| Lysmouré, Kaffrune, Ondarive, Bolbruyère, Clavembre, Cousevaine, Pédalune, Aurifane, Crêtenval, Vuescarde, Fjelmora, Flammoisy, Semavrille, Infuvelle | Aucune correspondance exacte ; seuls des mots, lieux ou noms de famille voisins remontent |
| Croquembel | Aucune marque ; le moteur rapproche le mot du dessert « croquembouche » (nom commun, pas une marque) |

| Nom écarté | Motif | Preuve |
|---|---|---|
| Velunia | Plusieurs marques de beauté, mode et parfum | [Crunchbase](https://www.crunchbase.com/organization/velunia), [veluniabeauty.com](https://veluniabeauty.com/) |
| Klavora | Application et entreprise existantes | [klavora.app](https://klavora.app/) |
| Norvelle | Marques de vêtements existantes | [norvellethelabel.com](https://norvellethelabel.com/) |
| Tidebrook | Marque de vin anglaise | [mousehall.com](https://www.mousehall.com/pages/tidebrook-wines) |
| Mirevo | Marques et produits existants | [Otsuka Pharmaceutical](https://www.otsuka.co.jp/en/company/newsreleases/2023/20231108_2.html), [LinkedIn](https://www.linkedin.com/company/mirevo) |
| Sonovelle | Trop proche de la boutique Sonivelle | [sonivelle.com](https://www.sonivelle.com/) |
| Lisérane | Quasi identique à l'événement cycliste L'Iserane | [valdisere.com](https://www.valdisere.com/en/experiences/liserane-iseran-and-cyclists-head-to-head/) |
| Hortavie | Prénom d'une actrice connue | [Wikipedia](https://en.wikipedia.org/wiki/Hortavie_Mpondo) |
| Tisserune | Nom d'un lieu et de personnages de World of Warcraft (version française) | [Wowhead](https://www.wowhead.com/zone=7896/runeweaver-square) |
| Pattivelle | Rapproché de la chanteuse Patti LaBelle, qui a sa propre marque | [pattilabelle.com](https://www.pattilabelle.com/) |
| Galetrin, Laineroche, Grain d'Orpin, Oudrelle, Brindaille | Entreprise ou produit existant, ou nom trop proche d'un nom commun ou d'une entreprise | Recherches du 2026-09-17 |

**Limite** : une recherche simple ne remplace pas une recherche d'antériorité de marque. Ces noms ne
sortent jamais de la maquette. `expert-conformite-rgpd` a refait la recherche pour quatre noms
(Pédalune, Kaffrune, Infuvelle, Aurifane) : aucune correspondance (07 §0).

## 4. Points à faire valider

### Fondateur

| # | Point | Proposition |
|---|---|---|
| FC1 | **Bouton annonceur** (07, ligne 6 ; remplace l'ancien F1). « Lancer une campagne » est écarté (trop proche de la référence) | « Créer une campagne » / « Create a campaign », **appliqué par défaut** dans ce document ; variante « Publier un brief » / « Post a brief ». Le bouton créateur « Recevoir des offres » / « Get brand deals » est inchangé |
| FC2 | **Consentement marketing** (07, ligne 18) : (a) une case par profil, libellé propre à chaque profil ; (b) deux cases côté annonceur (e-mails / contact commercial) | (a) **appliqué** dans ce document (`labelAdvertiser`, `labelCreator`) : plus simple et suffisant selon la conformité ; (b) reste possible si vous voulez segmenter plus finement. Lié à FC3 (base légale d'Apollo.io) |
| F2 | Titre du hero (test des 10 secondes, CA3) | « Marques et créateurs : de la rencontre au contrat, au même endroit » |
| F3 | Vocabulaire public | « marque » dans les textes ; « annonceur » réservé aux libellés financiers (part annonceur) et au choix de profil (« Marque ou annonceur ») |
| F4 | Vouvoiement pour les deux publics sur la page commune | Oui ; tutoiement à tester éventuellement sur la page créateurs du Lot 1 |
| F5 | « Sans abonnement » et « INFLUX se rémunère uniquement par une commission » (hero, FAQ, formulaire) | Maintenir s'ils sont vrais au lancement ; ils excluent aussi toute marge sur le change et toute refacturation des frais de paiement (06, T6) |
| F6 | « Avec les taux standard » (section 12, public créateur) | Maintenir en section 12 uniquement, recommandation de `expert-paiement-facturation` (06, T7) ; aucun taux particulier annoncé publiquement |
| F7 | Chiffre clé exprimé en **contrats signés** (fictif : 1 240) | Aligné sur la seule conversion qui compte ; la section disparaît tant qu'il n'y a pas de valeur réelle |

Les autres décisions demandées par les revues sont à trancher dans ces documents, sans être
recopiées ici : `06-revue-paiement.md` §4 (T1 à T10 : taxes, sort de la commission, détention des
fonds, devises, frais du prestataire…) et `07-revue-conformite.md` §4 (FC3 à FC9 : base légale
d'Apollo.io, déploiement de la maquette, captures d'écran, structure de la page du Lot 1, nom
INFLUX, fonctions non encore ouvertes, photos des cartes).

### `expert-paiement-facturation` (CA19 à CA21)

Revue rendue (`06-revue-paiement.md`). Points #1 à #17 reportés ; P1 à P6 sont clos. Les textes
des points bloquants #1 à #4 sont repris **sans reformulation** : aucun nouveau passage par la revue
n'est nécessaire pour eux.

| # | Point restant |
|---|---|
| P7 | Confirmer la nouvelle signature du pied de page (2.19), qui écarte « contrat et paiement compris » pour ne rien laisser entendre sur les frais du prestataire (T5, T6) |
| P8 | « Prestataire de paiement agréé » maintenu sous la condition T3 (agrément du prestataire retenu à D9 dans chaque pays ouvert), sinon retirer « agréé » de la méthode, de la FAQ, de `whyInflux` et du pied de page |

### `expert-conformite-rgpd` (veto)

Revue rendue (`07-revue-conformite.md`). Lignes obligatoires 1 à 8, 14, 18 et 23 reportées ;
suggestions 9 à 13 et 19 reprises ; R1 à R10 sont clos. Relecture des reports demandée (condition 3
de la revue) sur les points suivants :

| # | Point restant |
|---|---|
| R11 | Ligne 12 : texte proposé pour la signature du pied de page **non retenu** (ambiguïté « compris » sur le prix, voir 2.19) ; texte de remplacement à relire |
| R12 | Ligne 1 : `awareness.body` réécrit en plus des trois textes demandés, pour ne pas répéter le nouveau titre (2.12) |
| R13 | Ligne 10 : indicateur du résultat mis en avant remplacé (taux de clic des stories au lieu du taux d'engagement) en plus du titre (2.6) |
| R14 | Ligne 19 : réponse FAQ `eligibility` alignée sur le nouveau libellé (« selon la loi du lieu où il réside ») |
| R15 | Ligne 20 non reprise : « depuis votre compte » maintenu dans `marketingConsent.hint`, car `cadrage-mvp.md` §3 prévoit le retrait du consentement en libre-service dès le MVP ; à retirer si ce retrait n'est pas livré au Lot 1 |
| R16 | Lignes 21, 22, 25 et 26 : sans modification de texte pour la maquette (information complète, e-mail d'ouverture d'un pays, mention « INFLUX ouvre par étapes », recherche d'antériorité sur le nom) ; à traiter au Lot 1 |

### Autres agents

| Agent | Point |
|---|---|
| `architecte`, `dev-react-node` | `ph.featuredResult.trend` en objet `{ value, months }` ; squelettes ICU utilisés : `::percent .0`, `::percent sign-always`, `::sign-always .0`, `::compact-short` ; pluriels ICU pour le chiffre clé et le compteur de créateurs |
| `expert-ux` | Astérisque ajouté par le composant et non par les libellés ; tenue à 320 px des libellés les plus longs (`landing.hero.title`, `landing.pricing.example.contractAmount.label`, `landing.pricing.example.check`, `landing.faq.items.eligibility.question`) |
| `expert-ux` (reports dans `02` et `05`) | Nouvel ordre des cas d'usage (`02` §3.12, `05` §4.6) ; emplacement des trois nouvelles mentions `ph.*.sourceNote` ; deux libellés de consentement selon le profil (`02` §3.18) ; deux nouvelles lignes du téléphone et longueur maximale de `landing.pricing.example.check` portée à 140 (`02` §3.14) ; légende de la barre « Part annonceur INFLUX » / « Part créateur INFLUX » |
| `testeur` | Longueurs recomptées à la main dans ce document (pas d'exécution de script possible dans cette session) : à vérifier automatiquement à l'étape 6, en particulier `landing.pricing.phone.caption` (120 / 120), `landing.faq.items.eligibility.answer` (388 / 400) et `landing.faq.items.commission.answer` (387 / 400) |

