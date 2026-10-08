# Landing page INFLUX : revue de conformité (étape 4, droit de veto)

> **Statut :** étape 4 du plan validé par le fondateur le 2026-09-16. Rédigé par
> `expert-conformite-rgpd` le 2026-09-17 (skill `security-rgpd-audit`, partie B).
> **Documents relus :** `CLAUDE.md` (§2, §3, §5.2, §8, §9, §13), `00-cadrage.md`, `01-architecture.md`
> §6, `02-ux-wireframes.md`, `04-contenus.md`, `05-images.md`, `docs/cadrage-mvp.md` (§5).
> **Destinataires :** `expert-marketing` (corrections de `04-contenus.md`), `expert-ux` (`02` et `05`),
> `chef-de-projet`, fondateur ; `testeur` (étape 6).
> **Ce document ne modifie aucun autre fichier.** Les corrections sont à reporter par les agents
> propriétaires des documents.

> **Je ne suis pas avocat.** Cette revue repère les risques, les qualifie et propose des solutions
> conformes. Tout document engageant (CGU, CGV, politique de confidentialité, mentions légales,
> contrat d'intermédiation) et l'évaluation finale du risque lié à la structure reprise de
> wekollab.fr doivent être validés par un professionnel du droit avant toute mise en ligne.

## 0. Méthode et limites

| Sujet | Ce qui a été fait | Limite |
|---|---|---|
| Comparaison avec wekollab.fr (CA4) | Page d'accueil consultée le 2026-09-17 avec l'outil de récupération web : menu, boutons, titres, chapeaux, étapes, cas d'usage, arguments, questions de FAQ, formulaire, bannière cookies, pied de page, ordre des blocs. Chaque clé de `04-contenus.md` a été confrontée à ces extraits. | Extraction automatique par courtes citations : quelques formulations peuvent être approchées ou manquer (contenu dynamique, pages secondaires non lues). Aucune comparaison des images ni du code source de wekollab. |
| Code (CA4) | Sans objet : aucun code n'existe encore. | À vérifier à l'étape 6 par `testeur` : aucune occurrence de « wekollab » ni aucun fichier, style ou nom de classe issu du site dans le dépôt. |
| Images | Relecture de `05-images.md` et de la licence Pexels (https://www.pexels.com/license/). | Photos non visionnées par moi : je m'appuie sur le contrôle visuel déclaré par `expert-ux`. |
| Marques fictives | Relecture de `04-contenus.md` §3.2 et recherche complémentaire de 4 noms (Pédalune, Kaffrune, Infuvelle, Aurifane) : aucune correspondance. | Recherche web simple, pas de recherche d'antériorité INPI, EUIPO ou USPTO. |
| Citations de wekollab.fr | Les extraits cités ici sont courts, attribués et utilisés à seule fin d'analyse. | Ils ne doivent jamais être repris dans le code ni dans les contenus. |

## 1. Verdict

### **OBJECTIONS NON BLOQUANTES** pour la maquette locale, avec un **veto préventif** sur tout déploiement et sur la mise en ligne

**Pourquoi pas de veto sur la maquette.** En l'état, la maquette ne collecte rien, ne dépose rien,
n'est pas publiée, porte un bandeau « Maquette », une consigne de non-indexation, et isole le fictif
dans un seul module. Elle ne crée pas d'exposition juridique tant qu'elle reste sur le poste du
fondateur. Les formats de pseudos masqués (D16), le pied de page sans identité inventée (D25),
l'exclusion des mineurs (D15), la transparence sur la commission et l'absence de promesse
d'algorithme sont conformes.

**Pourquoi des objections.** La comparaison avec wekollab.fr fait apparaître **plusieurs
rapprochements trop proches** : les quatre cas d'usage (mêmes catégories, même ordre, titres
paraphrasés), une phrase de la bannière cookies presque identique, l'écho du slogan « On s'occupe de
tout / du reste », le libellé du bouton annonceur, le surtitre du hero et le titre de la section
Problème en anglais. **CA4 n'est pas satisfait tant que les lignes « à corriger » 1 à 8 du tableau
ne sont pas intégrées.** S'y ajoutent des corrections de conformité (consentement marketing, mention
locale du fictif, conservation des messages, emplacement des photos).

**Conditions pour lever les objections (avant l'étape 5, au plus tard avant l'étape 6) :**

1. `expert-marketing` intègre dans `04-contenus.md` les lignes « à corriger » 1 à 8, 14, 18 et 23.
2. `expert-ux` reporte dans `02-ux-wireframes.md` le nouvel ordre des cas d'usage (ligne 1), les
   emplacements des mentions de source ajoutées (ligne 14) et les deux libellés de consentement
   (ligne 18) ; il corrige l'emplacement des photos dans `05-images.md` (ligne 16).
3. Je relis ces reports ; sans nouvelle objection, CA4 est tenu pour les textes.

**Veto préventif (bloquant dès qu'il s'applique) :**

- **Tout déploiement** de la page à une adresse accessible sans authentification, même en
  `staging` et même avec `noindex`, tant que le module `src/content/placeholders/` existe (ligne 15).
- **Toute mise en ligne du Lot 1** qui ne remplit pas les conditions de la section 5, en particulier :
  société créée (D25), fictif retiré, structure retravaillée et revue par un avocat (section 3),
  textes alignés sur les fonctions réellement ouvertes (ligne 25), documents légaux validés.

## 2. Constats

Gravité : **bloquant** = ne doit pas être livré ou publié en l'état ; **à corriger** = objection à
lever par une modification ; **suggestion** = amélioration recommandée, sans objection.
Les longueurs maximales de `04-contenus.md` ont été recomptées pour chaque texte proposé.
Les extraits de wekollab.fr sont notés « WK ».

### 2.1 Originalité face à wekollab.fr (CA4)

| # | Clé ou élément | Problème | Gravité | Correction FR proposée | Correction EN proposée |
|---|---|---|---|---|---|
| 1 | `landing.useCases.items.*.title`, ordre des cartes (`productLaunch`, `awareness`, `ugc`, `acquisition`), `landing.useCases.lead` | Rapprochement le plus net. WK présente exactement les mêmes quatre cas, dans le même ordre : « Lancement de produit », « Notoriété de marque », « Création de contenu UGC / influence », « Acquisition et conversion ». Nos titres en sont la transposition verbale (« Lancer un nouveau produit », « Gagner en notoriété », « Obtenir des contenus UGC », « Générer des ventes ») et le chapeau les énumère dans le même ordre. Catégories banales prises une à une, mais l'ensemble (mêmes catégories, même ordre, même emplacement) constitue une paraphrase de près. | à corriger | **Nouvel ordre** (report dans `02` §3.12 et `05` §4.6 par `expert-ux`) : `ugc`, `acquisition`, `productLaunch`, `awareness`. **Titres** : `ugc` « Des contenus pour vos canaux » ; `acquisition` « Mettre en avant une offre » ; `productLaunch` « Sortir un nouveau produit » ; `awareness` « Prendre place dans une communauté ». **Chapeau** : « Contenus pour vos canaux, offre à relayer, sortie d’un produit ou présence dans la durée : indiquez votre objectif dans le brief, l’équipe s’en sert pour choisir les profils. » (174) | **Titles**: `ugc` “Content for your own channels”; `acquisition` “Promote an offer”; `productLaunch` “Release a new product”; `awareness` “Become part of a community”. **Lead**: “Content for your channels, an offer to push, a product release or a lasting presence: state your goal in the brief, and our team uses it to pick profiles.” (154) |
| 2 | `landing.useCases.items.ugc.body`, `.acquisition.body`, `.productLaunch.body` | `ugc` : « à réutiliser sur vos propres canaux, selon les conditions prévues au contrat » paraphrase WK « Produire des contenus réutilisables selon les droits négociés ». `acquisition` : « Générer des ventes » reprend WK « générer du trafic ou des ventes », et le texte actuel répéterait le nouveau titre. `productLaunch` : « votre nouveauté » fait écho à WK « autour d’une nouveauté ». | à corriger | `ugc` : « Des photos et vidéos tournées par des créateurs, à publier sur vos pages et publicités. Durée et supports d’utilisation sont fixés dans le contrat. » (147) · `acquisition` : « Un code de réduction ou une offre limitée, relayés par des créateurs ; vous suivez les ventes avec vos propres outils. » (118) · `productLaunch` : « Faites découvrir votre produit dès sa sortie, à une audience déjà sensible à votre univers. » (91) | `ugc`: “Photos and videos shot by creators, to post on your pages and ads. How long and where you may use them is set out in the contract.” (130) · `acquisition`: “A discount code or limited-time offer shared by creators; you track sales with your own tools.” (94) · `productLaunch`: “Introduce your product from day one to an audience already drawn to your category.” (82) |
| 3 | `landing.useCases.title` | « Un objectif, des créateurs choisis pour l’atteindre » reprend la tournure WK « des créateurs choisis pour générer du trafic ou des ventes », dans la même section. | à corriger | « Votre objectif guide le choix des créateurs » (43) | “Your goal shapes which creators we suggest” (42) |
| 4 | `landing.cookieBanner.body` | « Vous pouvez accepter, refuser ou choisir » est presque mot pour mot WK « Vous pouvez accepter, refuser ou choisir précisément ». « Avec votre accord […] pour comprendre l’usage du site » suit aussi WK « mesurer l’audience du site […] sans votre accord ». En outre, le texte annonce une finalité (mesure d'usage) qui n'est pas décidée (R7). | à corriger | « Des cookies facultatifs nous aideraient à savoir quelles pages vous sont utiles. Ils ne sont utilisés que si vous les acceptez ; votre choix reste modifiable. » (159) | “Optional cookies would help us see which pages are useful to you. They are only used if you accept them, and you can change your choice later.” (142) |
| 5 | `landing.finalCta.lead` | « L’équipe INFLUX s’occupe de la mise en relation » / “takes care of the introductions” reprend, dans le même emplacement (appel final), le slogan de WK : « On s’occupe de tout. » (titre du hero) et « On s’occupe du reste. » (appel final). Un slogan est l'élément le plus identifiant d'un site. | à corriger | « Marques, publiez votre brief. Créateurs, complétez votre profil. L’équipe INFLUX fait les présentations. » (104) | “Brands, publish your brief. Creators, complete your profile. The INFLUX team makes the introductions.” (101) |
| 6 | `landing.common.cta.advertiser` (en-tête, hero, sections 7, 11, 15) | « Lancer une campagne » diffère d'un seul mot du bouton principal de WK « Lancer ma campagne », placé aux mêmes endroits (en-tête et hero), et fait écho au titre final WK « Prêt à lancer votre campagne ? ». Expression courante, mais c'est le bouton le plus visible de la page. Remplace la proposition F1 de `04` §4. | à corriger | « Créer une campagne » (18) ; variante alignée sur le discours INFLUX : « Publier un brief » (16) | “Create a campaign” (17); variant: “Post a brief” (12) |
| 7 | `landing.hero.overline`, `landing.meta.title` | « Marketplace du marketing d’influence » a la même construction et le même emplacement que le surtitre WK « Agence de marketing d’influence » ; le titre de page suit le même gabarit que celui de WK (« WeKollab — Agence de marketing d’influence en France »). Le mot-clé peut rester dans `landing.meta.description`. | à corriger | Surtitre : « Marketplace marques et créateurs » (32) · Titre de page : « INFLUX : la marketplace qui réunit marques et créateurs » (55) | Overline: “Brand and creator marketplace” (29) · Page title: “INFLUX: the marketplace for brands and creators” (47) |
| 8 | `landing.problem.title` | Le titre anglais “Finding the right creators can take longer than the campaign” contient la traduction littérale du titre WK de la même section (problème + conversation) : « Encore faut-il trouver les bons créateurs ». Le titre français développe la même idée que la douleur WK « Trop long à gérer ? ». | à corriger | « Entre relances et accords informels, les collaborations s’enlisent » (66) | “Between follow-ups and informal deals, collaborations stall” (59) |
| 9 | `landing.creatorNetwork.title` | « aux marques qui vous correspondent » rappelle WK « les profils qui correspondent exactement à votre marque », dans la section « réseau de créateurs » située au même rang. Rapprochement faible (verbe courant, point de vue inversé). | suggestion | « Votre profil présenté par l’équipe aux marques de votre univers » (63) | “Our team presents your profile to brands in your space” (54) |
| 10 | `landing.featuredResult.title` (et choix de l'indicateur) | « Des créateurs bien choisis, une audience qui s’engage » et un taux d'engagement en hausse occupent le même emplacement que WK « Des marques. Des audiences. Des résultats. » avec « 8,1 % Engagement » et une flèche de hausse. Idée banale, mais elle s'additionne aux autres ressemblances. | suggestion | « Quand le profil colle au produit, l’audience répond » (51) | “When the profile fits the product, the audience responds” (56) |
| 11 | `landing.caseStudies.title` | « Des campagnes menées de bout en bout dans INFLUX » ouvre comme WK « Des campagnes qui font la différence. », même section. Rapprochement faible. | suggestion | « Campagnes signées et livrées dans INFLUX » (40) | “Campaigns signed and delivered on INFLUX” (40) |
| 12 | `landing.footer.tagline` (avec `landing.method.title` et `landing.hero.title`) | Triple usage de la tournure « de X à Y » (« du brief au paiement », « Du brief au reversement », « de la rencontre au contrat »), comme WK (« De la stratégie, à la publication », « de l’idée aux résultats »). Tournure libre, mais la répétition crée un écho ; varier la signature suffit. | suggestion | « La marketplace qui réunit marques et créateurs, contrat et paiement compris. » (76) | “The marketplace bringing brands and creators together, contract and payment included.” (85) |
| 13 | `landing.startForm.reassurance.free` | « Inscription gratuite, sans abonnement » suit la construction de la réassurance WK voisine du formulaire « Échange gratuit et sans engagement ». Formule très répandue. | suggestion | « Aucun abonnement : l’inscription est gratuite » (45) | “No subscription: signing up is free” (35) |

**Rapprochements examinés, sans objection** (éléments génériques ou fonctionnels, formulation
différente) : entrée de menu « Créateurs » ; « Étape 1 sur 3 » ; adresse `contact@…` dans
l'en-tête ; « © 2026 » ; libellés « Mentions légales », « Politique cookies », « Personnaliser » ;
titre du carrousel « Ils publient leurs campagnes sur INFLUX » (face à « Ils nous font confiance ») ;
réponses de FAQ qui commencent par « Non. » ; enchaînement des six étapes de méthode (c'est le
parcours réel du MVP, titres et textes différents de « Stratégie », « Casting », « Négociation »…) ;
messages de la conversation (sujets, ton et vouvoiement différents) ; douleur `followUp` et argument
`allInInflux` (idée de dispersion des échanges, formulée autrement que « Vous ne gérez pas dix
conversations ») ; chapeau de FAQ « l’essentiel à savoir » ; `privacyNotice` (information imposée
par la loi, formulation propre) ; les huit questions de FAQ, toutes propres à INFLUX (commission,
devise, pays, pseudos, messagerie, majorité).

### 2.2 Preuve sociale fictive (CA13 à CA16, CA18)

**Ce qui est suffisant pour une maquette locale** : bandeau « Maquette : contenus fictifs » visible
sans défiler et commandé par une seule constante ; mention de source sous chaque chiffre inventé et
sous les études de cas ; `noindex, nofollow` ; module fictif unique avec test G6 (impossible de
masquer le bandeau en gardant du fictif) ; aucun déploiement ; aucune marque réelle (contrairement à
WK, qui affiche de vraies marques) ; 15 noms vérifiés sans correspondance.

**Risque si la page était publiée avec ce contenu** : de fausses références clients, de faux
résultats et un faux compteur de contrats sont des **pratiques commerciales trompeuses**
(Code de la consommation, art. L121-2, applicable aussi quand la cible est professionnelle,
art. L121-5). Sanction pénale : jusqu'à 2 ans d'emprisonnement et 300 000 € d'amende pour une
personne physique, montant pouvant être porté à 10 % du chiffre d'affaires ou 50 % des dépenses de
publicité (art. L132-2) ; enquête de la DGCCRF ; atteinte durable à la crédibilité auprès des marques.
Aux États-Unis, la règle de la FTC sur les faux avis et témoignages (2024) vise le même type de
contenu. Comme la société n'existe pas encore, c'est le fondateur qui serait exposé personnellement.

| # | Clé ou élément | Problème | Gravité | Correction FR proposée | Correction EN proposée |
|---|---|---|---|---|---|
| 14 | `ph.brandLogos.brands` (section 5), `ph.creatorShowcase.cards`, `ph.creatorNetwork.cards`, `ph.finalCta.cards` (sections 3, 9, 15), `ph.problem.conversation.messages` (section 7) | Contrairement aux chiffres et aux études de cas, ces blocs n'ont **aucune mention locale** de fictif. Le bandeau n'est pas collant : une capture d'écran de la section 5 (« Ils publient leurs campagnes sur INFLUX » + 15 marques) ou d'une carte « Vérifié » sortie de son contexte (présentation à un prospect, réseau social) ressemble à une vraie référence. | à corriger | Ajouter dans le module fictif (emplacement Small sous le bloc, Max 60, à définir par `expert-ux`) : `ph.brandLogos.sourceNote` « Marques fictives, inventées pour la maquette » (44) ; `ph.creatorCards.sourceNote`, affichée avec la légende « vérifié » des sections 3, 9 et 15 : « Profils fictifs, affichés pour la maquette » (42) ; `ph.problem.conversation.sourceNote` : « Conversation fictive, écrite pour la maquette » (45) | `ph.brandLogos.sourceNote`: “Fictitious brands, invented for the mockup” (42); `ph.creatorCards.sourceNote`: “Fictitious profiles, shown for the mockup” (41); `ph.problem.conversation.sourceNote`: “Fictitious conversation, written for the mockup” (47) |
| 15 | Déploiement envisagé de la page comme « page de test bilingue du Lot 0 » (`00-cadrage.md` §3) | `noindex` empêche le référencement, **pas l'accès** : toute personne qui a le lien voit de fausses références clients et de faux résultats. Le jour où la page est déployée à une adresse publique, le risque de pratique commerciale trompeuse devient réel. | à corriger (**bloquant** dès qu'un déploiement est décidé) | Règle à inscrire au plan de `integrateur` : aucun déploiement accessible sans authentification tant que `src/content/placeholders/` existe. Pour la page de test du Lot 0 : soit accès protégé (mot de passe ou réseau privé), soit déploiement sans le module fictif (sections vides non rendues, 02 §2.8). | — |

### 2.3 Images (CA26, licence Pexels, droit à l'image)

**Conforme pour la maquette** : 31 photos Pexels ; licence adaptée à un site (usage gratuit,
modification permise, attribution facultative mais faite dans `CREDITS.md`) ; **aucun visage**,
donc pas de question de droit à l'image (Code civil, art. 9) ; aucune marque lisible déclarée ;
photos des cartes créateurs décoratives (`alt=""`), ce qui évite de les présenter comme de vrais
créateurs INFLUX ; aucune image issue de wekollab.fr (dont le hero montre, d'après l'extraction,
le portrait d'une créatrice : notre choix de mains et d'objets s'en distingue nettement). L'interdit de la licence
qui compte ici, « laisser entendre que les personnes ou marques visibles soutiennent le produit »,
est respecté par construction.

Rappel utile : la licence d'un photographe **ne couvre jamais les droits des tiers** visibles sur la
photo (personne, marque, design de produit, œuvre). C'est à INFLUX de s'assurer qu'aucun n'est en jeu.

| # | Clé ou élément | Problème | Gravité | Correction FR proposée | Correction EN proposée |
|---|---|---|---|---|---|
| 16 | `05-images.md` §2 (exemple `curl` vers `public/images/placeholders/`) et §5 (« Nom de fichier suggéré dans `public/images/placeholders/` ») | Contredit `01-architecture.md` §6.1 : les photos doivent vivre dans `src/content/placeholders/images/`. Dans `public/`, elles échapperaient au module fictif (CA15) et **resteraient servies par URL** après le retrait du Lot 1. | à corriger | `expert-ux` corrige `05` §2 et §5 : téléchargement dans `src/content/placeholders/images/`, import statique depuis `index.ts`, rien dans `public/`. `testeur` vérifie à l'étape 6 que `public/` ne contient aucune photo. | — |
| 17 | IMG-HERO-01, IMG-CRE-04, IMG-CRE-05, IMG-CASE-03, IMG-CASE-05, IMG-USE-04 | Photos à recontrôler en grand format **dans le cadrage réellement affiché** : IMG-HERO-01 (la page Pexels mentionne une femme : visage hors cadre en 4:3 et 4:5 ?) ; IMG-CRE-04 (logo sur la chaussure ?) ; IMG-CRE-05 (touches personnalisées portant un logo ?) ; IMG-USE-04 (logo de banque ou de réseau sur la carte bancaire ?) ; IMG-CASE-03 et IMG-CASE-05 (design reconnaissable d'un produit de marque réelle, attribué à une marque fictive avec des résultats inventés ?). | suggestion | Contrôle visuel par `testeur` sur les captures 375 et 1440 px ; remplacement de toute photo douteuse par une autre photo Pexels, avec mise à jour de `CREDITS.md`. | — |

### 2.4 Formulaire factice (CA8, CA9, D15)

**Absence de collecte réelle : conforme.** `01` §6.4 interdit requêtes, stockage et cookies, retire
l'attribut `action`, désactive l'autocomplétion et exclut le mot de passe ; le message final dit que
rien n'a été envoyé. Champs minimaux et justifiés (profil, e-mail, entreprise côté annonceur, pays,
langue, majorité côté créateur) : la minimisation est bonne, et l'absence de téléphone sert aussi
le principe « tout se passe dans INFLUX ». **CGU et confidentialité (R3) : bonne approche** : on
accepte les CGU (contrat), on est **informé** de la politique de confidentialité, qui ne s'accepte pas.

**Réponse à R2 (une ou deux cases ?).** Une case par profil suffit, **à condition que son libellé
change selon le profil** (ligne 18). Justification :

- Les e-mails Brevo et les séquences commerciales Apollo.io poursuivent la même finalité :
  la prospection commerciale d'INFLUX par voie électronique. Un consentement unique est donc
  suffisamment « spécifique » (RGPD, art. 4.11 et 7 ; lignes directrices 05/2020 du CEPD), si le
  libellé nomme les deux formes de contact.
- **Décision recommandée : conditionner aussi la synchronisation Apollo.io au consentement**, dans
  tous les pays. `CLAUDE.md` envisage l'intérêt légitime pour Apollo ; or on ne peut pas demander un
  consentement puis, en cas de refus, prospecter quand même sur une autre base légale (principe de
  loyauté, art. 5.1.a). Le consentement est aussi la base la plus simple à tenir au Canada (CASL,
  consentement exprès) et dans les autres pays. Si le fondateur préfère l'intérêt légitime pour
  Apollo, alors la case ne doit **pas** mentionner le contact commercial, et l'information et le
  droit d'opposition doivent figurer au formulaire et dans la politique, pays par pays (hors Canada).
- L'**enrichissement** des fiches par Apollo.io (données ajoutées par un tiers) est un traitement
  distinct : il relève de l'information (art. 13 et 14), pas de la case.
- Deux cases côté annonceur (e-mails / contact commercial) restent possibles et légales : c'est un
  choix du fondateur (section 4).

| # | Clé ou élément | Problème | Gravité | Correction FR proposée | Correction EN proposée |
|---|---|---|---|---|---|
| 18 | `landing.startForm.marketingConsent.label` → deux clés `.labelAdvertiser` et `.labelCreator` (160 chacune) | Libellé unique pour les deux profils. Côté **créateur**, « propositions commerciales adaptées à mon profil » se confond avec les propositions de marques, c'est-à-dire le service lui-même (le bouton créateur dit « Recevoir des offres ») : le créateur peut croire qu'il doit cocher pour recevoir des offres. Le consentement ne serait alors ni libre ni éclairé (art. 4.11 et 7). Côté **annonceur**, le libellé ne dit pas clairement qu'une équipe commerciale peut le contacter (Apollo.io). | à corriger | `.labelAdvertiser` : « J’accepte de recevoir les e-mails commerciaux d’INFLUX (conseils, nouveautés, offres) et que son équipe commerciale me contacte (facultatif). » (141) · `.labelCreator` : « J’accepte de recevoir par e-mail les conseils, actualités et invitations d’INFLUX (facultatif). Les propositions de campagnes n’en dépendent pas. » (145) | `.labelAdvertiser`: “I agree to receive marketing emails from INFLUX (tips, news, offers) and to be contacted by its sales team (optional).” (118) · `.labelCreator`: “I agree to receive tips, news and invitations from INFLUX by email (optional). Campaign proposals don’t depend on this.” (119) |
| 19 | `landing.startForm.adult.label`, `.adult.errors.required` | **Remplacée par D15 précisée le 2026-10-08 (fondateur) : âge fixe « 18 ans ou plus » dans tous les pays ; libellés « J’atteste avoir 18 ans ou plus. » / « I confirm I am 18 or older. ».** Constat d'origine : « âge de la majorité dans mon pays de résidence » : dans les États fédéraux, la majorité se fixe par province ou par État (19 ans dans plusieurs provinces canadiennes et quelques États américains, 21 ans au Mississippi). La formulation doit viser le lieu de résidence, pas seulement le pays. L'attestation ne vaut pas contrôle : le contrôle avant signature (D15) reste à faire au Lot 4 (vérification d'identité via le prestataire). | suggestion | Libellé : « J’atteste avoir l’âge de la majorité selon la loi du lieu où je réside. » (71) · Erreur : « Confirmez avoir l’âge de la majorité pour continuer. » (52) | Label: “I confirm I am of legal age under the law where I live.” (55) · Error: “Confirm you are of legal age to continue.” (41) |
| 20 | `landing.startForm.marketingConsent.hint` | « depuis votre compte » : aucun écran de préférences n'est prévu au Lot 1 dans `cadrage-mvp.md` §5. Si la page est publiée sans cet écran, la promesse est fausse. Sans conséquence pour la maquette. | suggestion | Garder le texte si le Lot 1 prévoit le retrait depuis le compte ; sinon : « Vous pouvez retirer ce consentement à tout moment, via le lien présent dans chaque e-mail. » (90) | Keep if the account allows withdrawal in Lot 1; otherwise: “You can withdraw this consent at any time via the link in every email.” (70) |
| 21 | `landing.startForm.privacyNotice` | Acceptable pour la maquette. **Insuffisant pour le Lot 1** : il manque l'identité du responsable de traitement (D25), la prospection et l'enrichissement Apollo.io, les destinataires et transferts hors UE, et le renvoi explicite aux droits. Premier niveau d'information à porter à environ 330 caractères (`expert-ux`). | à corriger (Lot 1, pas la maquette) | « [Raison sociale, D25] traite ces données pour gérer votre compte, préparer vos mises en relation et, avec votre accord, vous adresser ses communications commerciales. Elles sont confiées à nos prestataires (hébergement, e-mailing, prospection), dont certains hors de l’Union européenne. Vos droits (accès, effacement, opposition…) : voir la politique de confidentialité. » | “[Company name, D25] processes this data to manage your account, prepare your introductions and, with your consent, send you marketing communications. It is shared with our service providers (hosting, email, sales outreach), some outside the European Union. Your rights (access, erasure, objection…): see the privacy policy.” |
| 22 | `landing.startForm.country.openCountriesInfo`, `landing.faq.items.openCountries.answer` (R5) | « Nous vous prévenons à l'ouverture de votre pays » : c'est un **message de service** lié au compte (exécution des CGU), pas de la prospection, **à condition** qu'il reste strictement informatif (aucune offre, aucune promotion). Il peut donc être envoyé sans consentement marketing. Au Canada (CASL), ce type de message est dispensé de consentement mais doit identifier l'expéditeur et proposer un moyen de s'en désabonner. La promesse doit être réellement tenue (Lot 4). | suggestion | Texte inchangé. Règle à inscrire dans la spécification du Lot 4 : e-mail transactionnel, contenu strictement factuel, expéditeur identifié, lien de désabonnement. | Text unchanged. |

### 2.5 Bannière cookies factice (CA11)

**Présentation : conforme.** Accepter, Refuser et Personnaliser ont le même style, la même taille et
le même poids : refuser est aussi simple qu'accepter (lignes directrices et recommandation de la CNIL
de septembre 2020). La bannière ne dépose rien (`localeCookie: false`, aucun stockage, aucune
ressource tierce), ne mémorise aucun choix, n'est pas bloquante. « Personnaliser » sans effet est
acceptable dans une maquette. Seul le texte est à corriger (ligne 4).

### 2.6 Pseudos masqués (D16), pied de page (D25)

- **D16 : conforme.** Les cartes n'affichent que thématique, tranche d'audience, pays et badge ; le
  type `CreatorCard` n'a aucun champ pseudo, nom, `@`, lien ou réseau (garantie par construction) ;
  la conversation affiche des rôles et ne contient ni coordonnée ni URL ; la FAQ explique le
  masquage sans ton menaçant (R10).
- **Pied de page : conforme.** Ni raison sociale, ni forme juridique, ni adresse, ni immatriculation
  (CA12). E-mail sur un domaine réservé `.example`. Les deux mentions de confiance ne nomment aucun
  prestataire ni label (R9) ; elles ne seront vraies qu'au Lot 4 (ligne 25).

### 2.7 Promesses (CA5, D21, D26)

**Conforme** : aucune mention d'algorithme, d'IA, de connexion automatique aux réseaux ni de
recherche libre ; aucun pays ouvert ni date d'ouverture ; aucun prestataire nommé ; aucune promesse
de revenu, de volume ou de délai ; la vérification décrite (statistiques contrôlées, code dans la
bio) et la sélection motivée par l'équipe correspondent à `cadrage-mvp.md`. **Transparence de la
commission** (exigence 7) : 35 % = 20 % + 15 %, incluse, net créateur de 65 %, exemple chiffré,
affichés avant toute inscription : conforme, sous réserve de l'avis de `expert-paiement-facturation`
sur CA19 à CA21. Les pays des cartes fictives sont présentés comme pays de résidence, jamais comme
pays ouverts : sans objection pour la maquette (F8).

| # | Clé ou élément | Problème | Gravité | Correction FR proposée | Correction EN proposée |
|---|---|---|---|---|---|
| 23 | `landing.method.steps.messaging.body` | « Tout y reste conservé. » / “Everything stays on record.” promet une conservation sans limite. C'est contraire au principe de limitation de la conservation (RGPD, art. 5.1.e), à la future politique de conservation des messages et au droit à l'effacement : la promesse deviendrait fausse le jour où la règle de purge s'applique. | à corriger | « Livrables, dates, ton : vous précisez les détails avec le créateur dans une messagerie dédiée à chaque mise en relation, où vos échanges sont conservés. » (152) | “Deliverables, dates, tone: you settle the details with the creator in a messaging space dedicated to each introduction, where your conversations are kept.” (154) |
| 24 | `landing.method.steps.securePayment.body`, `landing.faq.items.payment.answer` | « un prestataire […] qui conserve les fonds jusqu’à la validation de la publication » tient pour acquis le moment du paiement (D20, ouverte) et le mode de détention des fonds (D9). Si D20 tranche autrement, la promesse devient inexacte. Point partagé avec `expert-paiement-facturation` (P4), qui arbitre. | suggestion | Méthode : « Le paiement passe par un prestataire de paiement agréé. Le net créateur n’est reversé qu’une fois la publication validée. Le montant payé est celui du contrat, commission incluse. » (179) · FAQ : même logique, reformulation par `expert-paiement-facturation` | Method: “Payment goes through a licensed payment provider. The creator’s net amount is only paid out once the published content is approved. The amount paid is the contract amount, commission included.” (192) |
| 25 | Textes qui décrivent au présent des fonctions des Lots 2 à 5 : `landing.hero.lead`, `landing.creatorShowcase.*`, `landing.common.creatorCard.verifiedLegend`, `landing.problem.conversation.caption`, `landing.method.*`, `landing.creatorNetwork.lead`, `landing.howItWorks.steps.*`, `landing.pricing.lead`, `landing.whyInflux.*`, `landing.faq.items.payment`, `.hiddenHandles`, `.messaging`, `.eligibility`, `landing.footer.trust.*`, `landing.meta.description` | Sans effet pour la maquette. Mais la page est destinée à la **première mise en ligne (Lot 1)**, où n'existent que l'inscription et la synchronisation des leads : ni profils vérifiés (Lot 2), ni sélection ni messagerie (Lot 3), ni contrat ni paiement (Lot 4), ni reversement (Lot 5). Présenter ces services comme disponibles est une pratique commerciale trompeuse sur les caractéristiques essentielles et la disponibilité du service (C. conso, art. L121-2 et L121-5). | à corriger (**bloquant pour la mise en ligne du Lot 1**) | Au Lot 1, au choix du fondateur : (a) ajouter une mention visible dans le hero et près du formulaire, clé `landing.launchNotice` : « INFLUX ouvre par étapes : inscrivez-vous dès maintenant ; mises en relation, contrats et paiements arrivent progressivement. », et relire chaque clé listée pour ne rien affirmer d'indisponible ; (b) ou reporter la publication de ces sections jusqu'à l'ouverture effective des fonctions. | (a) `landing.launchNotice`: “INFLUX is opening in stages: sign up now; introductions, contracts and payments are rolling out step by step.”; review every listed key so nothing unavailable is stated as live; (b) or hold those sections until the features are live. |
| 26 | Nom de marque `landing.common.brandName` « INFLUX » | Une recherche web simple fait apparaître **plusieurs acteurs du marketing d'influence portant déjà ce nom** : « Datech Influx » (plateforme qui met en relation marques et influenceurs), « Influx Data » (plateforme de données d'influence), « Influx Catalysts » (UGC et partenariats d'influence). Même secteur, même clientèle : risque d'opposition ou d'action en contrefaçon de marque ou de nom commercial, et risque de confusion pour les utilisateurs. Sans effet pour la maquette. | à corriger (**avant tout investissement dans la marque et avant la mise en ligne**) | Mandater un conseil en propriété industrielle pour une recherche d'antériorité (France, UE, États-Unis, Canada, Brésil ; marques, dénominations, noms de domaine) ; préparer un nom de repli. Aucune modification de texte tant que la recherche n'est pas faite. | — |

## 3. Risque lié à la reprise de la structure de wekollab.fr

### 3.1 Ce qui est repris

D'après l'extraction du 2026-09-17, la page de WK enchaîne : bandeau d'annonce, en-tête, hero à deux
boutons (annonceur, créateur), chiffre clé, vitrine de créateurs, résultat chiffré, carrousel de
logos, carrousel de **5** études de cas, appel intermédiaire, problème + maquette de conversation,
accordéon de **6** étapes, réseau de créateurs avec filtres, **4** cas d'usage, « comment ça marche »
en **3** étapes, budget, **3** arguments, FAQ de **8** questions, appel final illustré, formulaire en
**3** étapes, pied de page, bannière cookies.

La maquette INFLUX reprend **19 de ces 21 blocs, dans le même ordre, avec le même nombre d'éléments**
(5, 6, 4, 3, 3, 8, 3), et place son bandeau « Maquette » à l'endroit du bandeau d'annonce. Écarts : pas d'appel intermédiaire, pas de filtres, pas de liens « en savoir
plus », section tarifs à la place du budget, accent vert, photos sans visage. Après les corrections du §2.1, les textes sont originaux.

### 3.2 Qualification juridique (droit français, à confirmer par un avocat)

| Fondement | Analyse | Probabilité |
|---|---|---|
| **Droit d'auteur** (Code de la propriété intellectuelle) | Une structure de site peut être protégée si son agencement est original, c'est-à-dire s'il porte l'empreinte de choix créatifs. Ici, les blocs (hero, logos, études de cas, FAQ, formulaire…) sont les briques standard des pages d'agences et de plateformes : ce sont des idées et des fonctions, libres de parcours. Seul l'enchaînement complet, avec ses nombres d'éléments, pourrait être plaidé comme original. | Faible |
| **Concurrence déloyale et parasitisme** (Code civil, art. 1240) | Principe : copier ce qui n'est pas protégé est libre, **sauf faute**. La faute peut résulter d'un risque de confusion ou d'une reprise systématique des choix d'un concurrent pour profiter de ses efforts sans en supporter le coût. Éléments défavorables : INFLUX et WK sont **concurrents** (mêmes marques, mêmes créateurs, même pays, même vocabulaire) ; la reprise est **systématique** (ordre et nombres) ; les documents du projet disent explicitement que la structure de WK est reprise, ce qui pourrait servir de preuve de l'intention (des mesures d'instruction permettent d'obtenir des documents internes avant procès). Éléments favorables : textes, images, code et couleur d'accent propres ; positionnement différent (marketplace à commission contre agence) ; blocs très répandus dans le secteur. | Moyenne si la structure est publiée telle quelle ; faible après restructuration |

**Sanctions et exposition** : mise en demeure, puis action en justice pouvant aboutir à l'obligation
de refondre la page sous astreinte, à des dommages et intérêts (les juges admettent qu'un acte de
concurrence déloyale cause au moins un préjudice moral) et à la publication de la décision. Le
risque le plus probable n'est pas financier mais **d'image** : dans un écosystème étroit, une jeune
plateforme accusée d'avoir copié une agence connue perd en crédibilité auprès des marques et des
créateurs qu'elle cherche à convaincre.

### 3.3 Évaluation et recommandation

| Situation | Exposition | Niveau | Recommandation |
|---|---|---|---|
| **Maquette locale**, non déployée | Aucune communication au public, aucun acte sur le marché, aucun préjudice possible. Étudier un concurrent pour s'en inspirer est licite. | Très faible | **Risque accepté, à surveiller.** Conditions : aucune ressource de WK dans le dépôt (texte, image, code, style, capture) ; corrections du §2.1 intégrées ; aucun déploiement. |
| Maquette **déployée** à une adresse accessible, même `noindex` | Communication au public de la structure, cumulée à la fausse preuve sociale (§2.2). | Moyen, plus risque pénal | **Veto** (ligne 15). |
| **Lot 1** publié avec la **même structure**, textes originaux | Faute de concurrence déloyale ou de parasitisme plausible. | Moyen | **Veto** tant que la structure n'est pas retravaillée et revue par un avocat. |
| **Lot 1** publié avec une **structure propre** et une identité visuelle affirmée | Éléments banals du secteur, organisés selon les choix d'INFLUX. | Faible | Mise en ligne possible après revue comparative par l'avocat. |

**Ce qui réduit le risque avant la mise en ligne**, par ordre d'efficacité :

1. **Le retrait du fictif change déjà la page** : sans données réelles, les sections 2, 4, 5 et 6 ne
   sont pas rendues (`02` §2.8). La page du Lot 1 ne reprendra donc plus l'enchaînement complet.
2. **Ne pas reproduire les nombres d'éléments** ni l'ordre des blocs restants : par exemple, tarifs
   plus haut (c'est l'argument distinctif d'INFLUX), vitrine et réseau de créateurs fusionnés,
   cartes retirées de l'appel final, nombre de questions de FAQ et d'étapes fixé par le besoin réel.
3. **Placer l'inscription sur une page dédiée** (ce que le Lot 1 prévoit avec les pages annonceurs et
   créateurs) plutôt qu'en formulaire en bas de page.
4. **Renforcer les blocs propres à INFLUX**, absents de WK : net créateur, pseudos masqués, pays
   ouverts, contrat et paiement dans la plateforme.
5. **Identité visuelle distincte** à la décision D6 (vert, typographie, formes, illustrations ou
   photos propres).
6. **Documenter la version publiée pour ses propres raisons** (besoins des deux publics, tests des
   10 secondes) et **conserver les brouillons datés des textes**, preuve d'une rédaction
   indépendante. Les documents existants ne doivent pas être réécrits pour masquer l'inspiration :
   ce serait plus dommageable en cas de litige que l'inspiration elle-même.
7. **Revue comparative par un avocat** (propriété intellectuelle et concurrence déloyale), captures
   des deux sites côte à côte, avant la mise en ligne. Coût modeste au regard du risque.

## 4. Points à faire trancher par le fondateur

| # | Décision | Options | Recommandation de la conformité |
|---|---|---|---|
| FC1 | Corrections d'originalité (§2.1), dont le **bouton annonceur** (remplace F1 de `04`) | « Créer une campagne » ou « Publier un brief » | Accepter les lignes 1 à 8 ; libellé du bouton au choix du fondateur, pas « Lancer une campagne ». |
| FC2 | **Consentement marketing** (ligne 18) | (a) une case par profil, libellé propre à chaque profil ; (b) deux cases côté annonceur (e-mails / contact commercial) | (a), plus simple et suffisante ; (b) légale aussi si vous voulez segmenter plus finement. |
| FC3 | **Base légale d'Apollo.io** | (a) prospection Apollo conditionnée au consentement, partout ; (b) intérêt légitime, documenté pays par pays, sans mention dans la case, avec information et droit d'opposition | (a). C'est la seule option cohérente avec une case qui mentionne le contact commercial, et la plus simple au Canada. Si (b) : mise à jour de `CLAUDE.md` §8 et §9, et Canada exclu de la prospection sans consentement. |
| FC4 | **Déploiement de la maquette** comme page de test du Lot 0 | (a) accès protégé ; (b) déploiement sans le module fictif ; (c) pas de déploiement | (a) ou (b). Jamais d'adresse publique avec le fictif, même `noindex`. |
| FC5 | **Usage des captures d'écran** de la maquette | — | Aucun usage externe (prospects, investisseurs, réseaux sociaux, dossier de levée) de captures montrant marques, chiffres, études de cas ou profils fictifs, sauf si la mention « Maquette » est visible sur chaque image. |
| FC6 | **Structure de la page publiée** au Lot 1 (§3) | (a) restructurer et faire relire par un avocat ; (b) publier la structure actuelle | (a). Sinon, veto sur la mise en ligne. |
| FC7 | **Nom INFLUX** (ligne 26) | Lancer la recherche d'antériorité maintenant, ou après la maquette | Maintenant : des homonymes existent dans le même secteur ; chaque semaine investie dans la marque augmente le coût d'un changement. |
| FC8 | **Présentation des fonctions non encore ouvertes** au Lot 1 (ligne 25) | (a) mention « INFLUX ouvre par étapes » et textes relus ; (b) sections publiées au fur et à mesure des lots | (a) si la page doit convaincre dès le Lot 1 ; (b) si vous préférez une page courte au départ. |
| FC9 | **Photos des cartes créateurs** au Lot 1 | (a) photos Pexels avec mention « Photo d'illustration » ; (b) photos de vrais créateurs avec leur autorisation écrite | (a) au lancement ; (b) quand des créateurs réels acceptent, avec une autorisation écrite précisant supports, durée et territoires, et sans compromettre le masquage des pseudos (D16). |

## 5. Avant toute mise en ligne (Lot 1)

Conditions de levée du veto préventif. Chaque point se vérifie par une preuve (document, recherche
dans le code, capture). Un point manquant = mise en ligne bloquée.

| # | Condition vérifiable | Porteur | Preuve attendue |
|---|---|---|---|
| L1 | **Société créée (D25)** ; mentions légales complètes (identité, forme, adresse, immatriculation, directeur de la publication, hébergeur) ; si la société est hors UE : représentant dans l'UE (RGPD art. 27), représentant légal et point de contact au sens du DSA, et au Royaume-Uni si ciblé | Fondateur + avocat ; `expert-conformite-rgpd` | Extrait d'immatriculation, page mentions légales FR/EN |
| L2 | **Fictif retiré** : `src/content/placeholders/` supprimé (procédure `01` §6.1), aucune photo dans `public/`, `IS_MOCKUP` absent ; tout chiffre, logo client ou étude de cas publié est réel, sourcé et autorisé par écrit par le client | `dev-react-node` ; `testeur` | Recherche des 15 noms fictifs et des valeurs `ph.*` sans résultat ; accords écrits des clients cités |
| L3 | **Structure retravaillée** (§3.3, points 1 à 6) et **revue comparative par un avocat** (propriété intellectuelle, concurrence déloyale) | `expert-ux` + `chef-de-projet` ; avocat mandaté par le fondateur | Avis écrit de l'avocat ; captures côte à côte |
| L4 | **Textes alignés sur les fonctions réellement ouvertes** (ligne 25) : option FC8 appliquée, aucune fonction des Lots 2 à 5 présentée comme disponible | `expert-marketing` ; relecture `expert-conformite-rgpd` | Liste des clés de la ligne 25 relue et validée |
| L5 | **Documents légaux FR/EN validés par un juriste** : CGU (tous utilisateurs majeurs, exclusion des mineurs, pays ouverts, pseudos masqués, non-contournement, modération), politique de confidentialité, mentions légales, politique cookies ; liens actifs dans le pied de page et le formulaire | Juriste ; trames `expert-conformite-rgpd` | Documents datés et versionnés, validation écrite du juriste |
| L6 | **Information RGPD complète au formulaire** : premier niveau (ligne 21) avec responsable, finalités, destinataires, transferts, droits ; politique détaillant Brevo, prospection et enrichissement Apollo.io, durées, réclamation auprès d'une autorité, responsable Loi 25 (Québec) | `expert-conformite-rgpd` + `expert-ux` | Écran du formulaire FR/EN ; politique en ligne |
| L7 | **Consentement et preuves** : libellés par profil (ligne 18) ; case non pré-cochée distincte des CGU ; preuve conservée (valeur, date, source, libellé exact, langue) ; version des CGU acceptée et date ; attestation de majorité horodatée | `expert-database` + `dev-react-node` ; validation `expert-conformite-rgpd` | Schéma et enregistrement de test |
| L8 | **Brevo et Apollo.io** : aucune synchronisation marketing sans consentement vérifié au moment de l'envoi (FC3) ; prospection Apollo validée pays par pays ; désinscriptions et suppressions propagées dans les deux sens ; e-mails avec expéditeur identifié, adresse postale et lien de désinscription | `expert-integrations-api` + `expert-marketing` ; validation `expert-conformite-rgpd` | Tests de bout en bout : désinscription et suppression visibles dans Brevo et Apollo |
| L9 | **Bannière cookies réelle** : inventaire des traceurs ; si seuls des traceurs exemptés (mesure d'audience configurée selon la CNIL), pas de bannière ; sinon bannière conforme, texte fidèle aux finalités réelles, lien « Gérer mes cookies » en pied de page ; aucun dépôt avant choix ; aucune ressource tierce hors inventaire | `expert-marketing` + `dev-react-node` ; `expert-cybersecurite` (CSP) | Onglet réseau et stockage au premier chargement, avant tout clic |
| L10 | **Sous-traitants et transferts** : registre des traitements ; contrats de sous-traitance signés (Brevo, Apollo.io, Supabase, Railway) ; mécanisme de transfert hors UE ; évaluation des facteurs relatifs à la vie privée pour les données communiquées hors du Québec | `expert-conformite-rgpd` + fondateur (signatures) | Registre ; contrats signés |
| L11 | **Droits des personnes opérationnels** : procédure écrite (accès, rectification, effacement, portabilité, opposition, limitation), effacement propagé à Brevo et Apollo, adresse de contact dédiée | `expert-conformite-rgpd` + `expert-integrations-api` | Procédure ; test d'effacement |
| L12 | **Influence commerciale, niveau de base (D21)** : qualification d'INFLUX (plateforme, ou agent d'influenceurs au sens de la loi française du 9 juin 2023) et textes publics cohérents avec cette qualification | Juriste + `expert-conformite-rgpd` | Note juridique |
| L13 | **Recherche d'antériorité de la marque INFLUX** (ligne 26) faite, sans obstacle, ou nom de repli adopté ; dépôt engagé | Fondateur + conseil en propriété industrielle | Rapport de recherche ; récépissé de dépôt |
| L14 | **Photos** : option FC9 appliquée ; `CREDITS.md` à jour pour chaque photo conservée | `expert-ux` | `CREDITS.md` ; captures des cartes |
| L15 | **Audit final** `security-rgpd-audit` conjoint, sans point bloquant ; non-indexation propre à `staging` | `expert-conformite-rgpd` + `expert-cybersecurite` | Rapport d'audit |

**À valider par un professionnel du droit** : structure face à wekollab.fr (L3) ; documents FR/EN
(L5) ; libellés de consentement et base légale Apollo.io par pays (L7, L8) ; formulation de
l'attestation de majorité (ligne 19) ; qualification d'INFLUX (L12) ; allégations « vérifié »,
« prestataire de paiement agréé », « contrat et paiement sécurisés » ; mentions légales selon D25
(L1) ; marque (L13).

**Vigilance pour les lots suivants** : Lot 2, procédure écrite du badge « vérifié » et de ses
limites, portfolios sans pseudo ni filigrane de réseau (D16), information DAC7 des créateurs (D24) ;
Lot 3, information sur la détection des coordonnées et l'accès des agents aux messages, durée de
conservation des messages ; Lot 4, prix affichés aux créateurs particuliers (D7, D24), langue des
contrats (Québec, France, Brésil), signature (D10).

## Sources consultées le 2026-09-17

- [wekollab.fr](https://wekollab.fr/) (comparaison, extraits courts)
- [Licence Pexels](https://www.pexels.com/license/)
- Homonymes du nom INFLUX : [Datech Influx](https://www.datech.ai/influx),
  [Influx Data](https://www.influxdata.co/), [Influx Catalysts](https://influxcatalysts.com/)

## 6. Relecture du 2026-09-17

Relecture des reports faits dans `04-contenus.md` (en-tête « Révisé le 2026-09-17 »),
`02-ux-wireframes.md` et `05-images.md` (condition 3 du verdict, §1).

### 6.1 Verdict mis à jour

**CA4 est tenu pour les textes. Sans objection pour la maquette locale** (textes, formulaire,
bannière cookies, images). Le §1 reste la trace de la première revue.

- **Lignes obligatoires 1 à 8, 14, 16, 18 et 23 reportées à l'identique.** Une recherche dans les
  documents `00` à `05` ne trouve plus aucune des formulations signalées (« Lancer une campagne »,
  « s’occupe de », “Finding the right creators”, « Marketplace du marketing d’influence »,
  « accepter, refuser ou choisir », « Tout y reste conservé », « Générer des ventes »…), sauf dans
  la trace de décision FC1 de `04` §4, qui les cite pour les écarter.
- **Ligne 24 close** : le texte de `06-revue-paiement.md` #2, qui prime, ne dit plus que le
  prestataire « conserve les fonds » (méthode et FAQ).
- **Suggestions 9 à 13, 17 et 19 reprises** (la 12 avec un autre texte, voir R11).
- **CA4 reste à vérifier pour le code et les images** à l'étape 6 (`testeur` : aucune occurrence de
  « wekollab », aucun fichier ni style issu du site ; contrôle visuel des 6 photos de `05` §6).
- **Inchangés** : le veto préventif sur tout déploiement accessible sans authentification tant que
  le fictif existe (ligne 15) et les conditions de mise en ligne du §5.

### 6.2 Ajouts examinés

| Point | Avis |
|---|---|
| R11, signature du pied de page « Sélection, contrat et paiement : la marketplace des marques et des créateurs. » | **Accepté.** Aucun rapprochement avec la signature de WK. Au Lot 1, elle annonce des fonctions pas encore ouvertes : à relire avec la ligne 25 (écart 2 ci-dessous). |
| R12, `awareness.body` réécrit | **Accepté.** Formulation propre, sans écho à WK (« Multiplier les prises de parole auprès d’audiences ciblées »). |
| R13, indicateur « taux de clic moyen des stories vers la boutique en ligne » | **Accepté.** WK affiche aussi des clics parmi ses trois indicateurs, mais c'est une mesure standard du secteur, exprimée ici autrement (taux, stories, boutique), sur un contenu fictif retiré au Lot 1. |
| R14, FAQ `eligibility` alignée sur « 18 ans ou plus » (D15 précisée le 2026-10-08) | **Accepté.** Cohérent avec D15 précisée. |
| R15, « depuis votre compte » maintenu dans `marketingConsent.hint` | **Accepté** : `cadrage-mvp.md` prévoit le retrait du consentement en libre-service dès le MVP. **Condition ajoutée à L7 (§5)** : ce retrait depuis le compte est livré au Lot 1 ; sinon, le texte de la ligne 20 s'applique avant la mise en ligne. |
| R16, lignes 21, 22, 25 et 26 sans modification pour la maquette | **Accepté.** Ces points restent des conditions du §5 (L4, L6, L8, L13). |
| `02` : ordre des cas d'usage, mentions `ph.*.sourceNote`, consentement propre au profil | **Conforme.** Les mentions sont des `<p>` visibles et lus dans l'ordre, sous chaque bloc. **La case de consentement décochée quand le profil change est une bonne pratique à conserver au Lot 1** : un accord donné sous un libellé ne vaut pas pour un autre. |
| `05` : photos dans `apps/web/src/content/placeholders/images/`, rien dans `public/`, clés `ph.images.*.alt`, tableau de contrôle visuel (§6) | **Conforme.** Ligne 16 close ; suggestion 17 confiée à `testeur`. |

### 6.3 Écarts restants

Aucun n'est bloquant ni ne conditionne le développement de la maquette.

| # | Clé ou élément | Problème | Correction FR proposée | Correction EN proposée |
|---|---|---|---|---|
| 1 | `04-contenus.md`, en-tête « Originalité (CA4) » | *Suggestion.* L'en-tête dit toujours que les textes ont été écrits « sans consulter » wekollab.fr et que seule la structure est reprise. Depuis la révision, plusieurs textes ont été remplacés **après** une comparaison avec le site. La documentation doit rester exacte : en cas de contestation, elle servirait à prouver une rédaction indépendante suivie d'une revue corrective, ce qui est favorable à INFLUX si c'est dit tel quel. | « **Originalité (CA4) :** textes écrits pour INFLUX sans consulter wekollab.fr, puis comparés au site par `expert-conformite-rgpd` le 2026-09-17 (`07-revue-conformite.md` §2.1) ; les formulations jugées trop proches ont été remplacées. La structure des blocs reprend celle de la référence (risque évalué en 07 §3). » | — (document interne en français) |
| 2 | `landing.footer.tagline` | *Au Lot 1.* « Sélection, contrat et paiement » présente comme disponibles des fonctions des Lots 3 et 4 : la clé s'ajoute à la liste de la ligne 25 et à la condition L4 du §5. | Texte inchangé pour la maquette ; relecture au Lot 1 avec la ligne 25. | Unchanged for the mockup; review in Lot 1 with line 25. |
| 3 | `ph.images.hero01.alt` | *Hors conformité, cohérence.* Le texte alternatif anglais diffère entre `04` (“freshly unboxed product”) et `05` §4.1 (“product just taken out of its parcel”). `04` fait foi pour les traductions. | Aucune. | Aligner `05` §4.1 sur `04` : “Hands photographing a freshly unboxed product with a smartphone” |
