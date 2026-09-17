# Landing page publique INFLUX : cadrage

> **Statut :** étape 1 du plan validé par le fondateur le 2026-09-16.
> **Préparé par :** `chef-de-projet` (critères selon la skill `feature-spec`).
> **Sources :** `CLAUDE.md` (prime en cas d'écart), `docs/cadrage-mvp.md`, plan validé.
> **Documents suivants :** `01-architecture.md` à `05-images.md`, dans ce dossier.

## 1. Besoin reformulé

Le fondateur veut une première page d'accueil INFLUX, consultable en local, qui reprend
**l'organisation** de wekollab.fr (menu, boutons, ordre et type des sections) avec le nom INFLUX, la
charte noir/vert, **nos propres textes** en français et en anglais et **nos propres images**. Rien
n'est copié de wekollab : ni texte, ni visuel, ni code. C'est une maquette : boutons inactifs,
formulaire qui n'envoie rien, preuves (chiffres, marques, témoignages) inventées et signalées.

- En tant qu'**annonceur**, je veux comprendre en 10 secondes ce que fait INFLUX et où cliquer, afin
  de lancer une campagne.
- En tant que **créateur**, je veux voir ce que je toucherai réellement sur un contrat, afin de
  décider si je m'inscris.
- En tant que **fondateur**, je veux relire une page réaliste en FR et en EN, afin de valider le
  discours et le niveau de finition avant la mise en ligne du Lot 1.

## 2. Populations et impact business

| Population | Ce que la page doit faire comprendre | Impact business |
|---|---|---|
| Annonceur (bouton principal) | Des créateurs sélectionnés par l'équipe, un contrat et un paiement sécurisés, un coût total connu d'avance | Futur lead Brevo et, s'il est qualifié, Apollo.io : cible commerciale prioritaire |
| Créateur (bouton secondaire) | Des marques viennent à lui, pseudo masqué jusqu'à la signature, net créateur connu avant de signer | Futur lead Brevo ; alimente l'offre sans laquelle aucun contrat n'est signé |
| Agent INFLUX | Non concerné : aucun backoffice dans ce lot | — |

- **Leads** : aucune collecte ici, mais cette page sera la porte d'entrée du Lot 1. Une page mal
  comprise en 10 secondes, ce sont des inscriptions perdues.
- **Commission** : afficher dès la page publique 35 % = 20 % annonceur + 15 % créateur, incluse
  dans le montant du contrat, évite le rejet tardif du net de 65 % (risque identifié au MVP).
- **Traçabilité** : la page ne montre aucun moyen de contact direct entre annonceur et créateur.

## 3. Place dans les lots

**Lot 0 (maintenant)** : premier code du dépôt. La page pose le socle front définitif (D1, D3, D4),
les traductions FR/EN et les tokens provisoires. Elle pourra servir de page de test bilingue du
Lot 0 quand le déploiement sera autorisé par le fondateur.

**Lot 1 (réutilisation)** : sections et composants conservés ; restent à faire : retirer ou
remplacer tous les contenus fictifs ; brancher boutons et formulaire sur l'inscription réelle
(consentement, CGU, pays, langue, majorité) et la synchronisation Brevo / Apollo.io ; activer les
liens (pages annonceurs et créateurs, documents légaux) ; bannière cookies réelle ; palette
définitive (D6) ; référencement et mise en ligne.

**Hors périmètre** : inscription réelle et stockage ; synchronisation Brevo / Apollo.io ; pages
annonceur et créateur dédiées ; documents légaux ; backoffice ; simulateur de commission ; vidéo ;
outils de mesure d'audience ; portugais ; dépôt GitHub distant ; déploiement Railway ; palette
définitive (D6). Tout ajout passe par `chef-de-projet` et remplace autre chose.

## 4. Critères d'acceptation

**Hypothèses retenues** (corrigeables par l'arbitre indiqué) : langue par défaut français
(`expert-ux`) ; exemple de tarifs en euros dans les deux langues, formaté selon la langue (D27,
`expert-paiement-facturation`) ; e-mail de contact fictif sur un domaine réservé aux exemples
(`.example`).

**Ordre attendu** : bandeau « Maquette » · en-tête · 1 Hero · 2 Bandeau chiffre clé · 3 Vitrine de
créateurs · 4 Résultat mis en avant · 5 Carrousel de logos · 6 Études de cas · 7 Problème et
conversation · 8 Méthode en 6 étapes · 9 Réseau de créateurs · 10 Cas d'usage · 11 Comment ça
marche · 12 Tarifs transparents · 13 Pourquoi INFLUX · 14 FAQ · 15 Appel final · 16 Formulaire en
3 étapes · pied de page · bannière cookies.

### A. Structure et discours

- **CA1** : Étant donné la page à 1440 px, quand on la parcourt de haut en bas, alors tous les blocs
  de l'ordre attendu sont présents, dans cet ordre, et la bannière cookies s'affiche au chargement.
- **CA2** : Étant donné la page à 375 px, quand on la parcourt, alors les mêmes blocs sont présents
  dans le même ordre et le menu est accessible par le menu mobile.
- **CA3** : Étant donné une personne extérieure au projet, quand elle voit l'écran d'arrivée 10
  secondes sans défiler, alors elle sait dire ce que fait INFLUX, pour quels deux publics, et où
  cliquer (vérifié à la revue du fondateur).
- **CA4** : Étant donné les textes, images et code livrés, quand `expert-conformite-rgpd` les
  compare à wekollab.fr, alors aucun n'en est repris ni paraphrasé de près (aucune objection ouverte).
- **CA5** : Étant donné les textes, quand on les relit, alors ils décrivent le MVP réel (sélection
  par l'équipe, messagerie, contrat, paiement via un prestataire, reversement après validation) et
  ne promettent ni algorithme ou IA de matching, ni connexion automatique aux réseaux, ni recherche
  libre de créateurs, ni pays ouverts nommés ou date d'ouverture.

### B. Maquette sans effet réel

- **CA6** : Étant donné le code de la page, quand on recherche `href=`, alors aucun résultat ; menu,
  boutons, logos, liens du pied de page et e-mail de contact sont des `<button type="button">` ou du
  texte, sans navigation ni `mailto:`.
- **CA7** : Étant donné la page, quand on clique partout, alors seules ces actions ont un effet :
  sélecteur FR/EN, menu mobile, accordéons, carrousels, étapes du formulaire, fermeture de la bannière.
- **CA8** : Étant donné le formulaire, quand on remplit et valide les 3 étapes, alors aucune requête
  réseau n'est émise, rien n'est écrit (cookies, stockage local ou de session), et un message FR/EN
  indique qu'il s'agit d'une maquette et que rien n'a été envoyé.
- **CA9** : Étant donné le formulaire, quand on l'affiche, alors la case de consentement marketing
  est non pré-cochée et distincte de l'acceptation des CGU, et les champs reprennent ceux de
  l'inscription du Lot 1 (pays, langue, attestation de majorité côté créateur ; liste exacte fixée
  par `expert-ux` et `expert-marketing`).
- **CA10** : Étant donné un champ obligatoire vide, quand on passe à l'étape suivante, alors un
  message d'erreur en texte, relié au champ, s'affiche ; un retour à l'étape précédente conserve la
  saisie ; un rechargement de la page ne conserve rien.
- **CA11** : Étant donné la bannière cookies, quand elle s'affiche, alors Accepter, Refuser et
  Personnaliser sont également visibles ; la fermer ne mémorise aucun choix ; et aucune ressource
  tierce (police, vidéo, script de mesure, carte) n'est chargée par la page.
- **CA12** : Étant donné le pied de page, quand on le lit, alors il ne contient ni raison sociale,
  ni forme juridique, ni adresse, ni numéro d'immatriculation inventés (société non créée, D25).
- **CA13** : Étant donné que le bandeau « Maquette » est actif, quand on inspecte la page, alors elle
  porte une consigne de non-indexation par les moteurs de recherche.

### C. Contenus fictifs et pseudos masqués

- **CA14** : Étant donné la page en FR ou en EN, quand elle se charge, alors le bandeau « Maquette :
  contenus fictifs » (ou son équivalent anglais) est visible sans défiler ; il dépend d'une seule
  constante.
- **CA15** : Étant donné la liste des contenus fictifs de `04-contenus.md`, quand on recherche chaque
  valeur dans le code, alors elle n'apparaît que dans **un seul module**, dont la suppression retire
  tout le fictif (mécanisme exact, y compris pour les textes FR/EN, fixé par `architecte`).
- **CA16** : Étant donné le carrousel de logos, quand on l'affiche, alors les marques sont fictives,
  en texte uniquement, et leur nom ne correspond à aucune marque connue après recherche simple.
- **CA17** : Étant donné les cartes créateurs (sections 3, 9, 15), quand on les affiche, alors elles
  montrent thématique, tranche d'audience, pays et badge « vérifié », et **jamais** pseudo, nom,
  `@`, lien ou icône cliquable de réseau (D16).
- **CA18** : Étant donné la maquette de conversation (section 7), quand on la lit, alors elle ne
  contient ni e-mail, ni téléphone, ni pseudo de réseau, ni URL, et elle est construite en HTML/CSS.

### D. Tarifs et montants

- **CA19** : Étant donné la section 12, quand on la lit, alors elle affiche : commission INFLUX 35 %
  = part annonceur 20 % + part créateur 15 %, **incluse** dans le montant du contrat (coût total
  pour l'annonceur) ; l'exemple 2 000,00 → 400,00 + 300,00 = 700,00 de commission → 1 300,00 de net
  créateur, avec la vérification 400 + 300 + 1 300 = 2 000 et la devise.
- **CA20** : Étant donné le code de la page, quand on le relit, alors ces valeurs sont du texte écrit
  dans les fichiers de traduction, au format de la langue (`2 000,00 €` / `€2,000.00`) ; aucune
  opération arithmétique ni simulateur n'existe.
- **CA21** : Étant donné tout montant affiché ailleurs (FAQ, cas d'usage), quand on le lit, alors il
  précise s'il s'agit du montant du contrat, de la commission (ou d'une de ses parts) ou du net
  créateur, avec la devise ; `expert-paiement-facturation` n'a aucune objection ouverte.

### E. Design, bilinguisme, accessibilité, qualité

- **CA22** : Étant donné le code hors fichier de tokens, quand on recherche couleurs (`#`, `rgb(`,
  `hsl(`), tailles et espacements en dur, alors aucun résultat ; le fichier de tokens est unique et
  marqué « provisoire, D6 ».
- **CA23** : Étant donné les composants, quand on les relit, alors aucun texte affiché n'y est écrit
  en dur ; les fichiers FR et EN ont exactement les mêmes clés ; basculer la langue change tous les
  textes, textes alternatifs, libellés d'accessibilité et l'attribut `lang` de la page.
- **CA24** : Étant donné une largeur de 320 à 1440 px, en FR comme en EN, quand on affiche la page,
  alors aucun défilement horizontal ni texte tronqué n'apparaît.
- **CA25** : Étant donné la page, quand on la contrôle, alors contrastes WCAG AA respectés, vert
  jamais seul porteur d'une information, navigation au clavier complète avec focus visible
  (menu, accordéons, carrousels, formulaire, bannière), carrousels automatiques dotés d'un bouton
  pause et figés si l'utilisateur réduit les animations, et aucune erreur critique ou sérieuse à axe
  ou Lighthouse.
- **CA26** : Étant donné le dossier d'images de la maquette, quand on le compare à `CREDITS.md`,
  alors chaque image y figure (auteur, URL source, licence Unsplash ou Pexels) et possède un texte
  alternatif FR/EN (vide si décorative) ; aucune image ne provient de wekollab.fr.
- **CA27** : Étant donné le projet, quand on lance install, typecheck, lint et build
  (`01-architecture.md`), alors aucune erreur ; `npm audit` sans vulnérabilité haute ou critique ;
  aucun `any` sans commentaire justificatif.
- **CA28** : Étant donné le dépôt, quand on consulte l'historique, alors le travail est sur
  `feat/landing-page` en Conventional Commits, commité après accord du fondateur, sans dépôt
  distant ni déploiement.

## 5. Séquence d'agents

| Étape | Agent | Question posée | Livrable |
|---|---|---|---|
| 1 | `chef-de-projet` | Cadrage et critères | Ce document |
| 2 | `architecte` | Pour une page publique bilingue à bien référencer au Lot 1 et réutilisée telle quelle : quel framework (D1), quelle structure de dépôt qui ne ferme pas D12 (D3), quelle librairie UI compatible tokens (D4, avec `expert-ux`), quelle librairie de traduction, et comment isoler le fictif dans un seul module (CA15) et poser la non-indexation (CA13) ? | `01-architecture.md` + CLAUDE.md §6 et §13 |
| 2 | `expert-ux` | Quels wireframes mobile et desktop pour chaque bloc de l'ordre attendu (états, clavier, lecteur d'écran) ; quelle palette provisoire AA avec couleurs d'état distinctes du vert ; quelles 30 photos libres de droits, de préférence sans visage identifiable ni logo pour les cartes créateurs ? | `02-ux-wireframes.md`, `03-tokens-provisoires.md`, `05-images.md` |
| 3 | `expert-marketing` | Quels textes FR/EN originaux font comprendre INFLUX en 10 s aux deux publics, décrivent le MVP réel (CA5) et quelle liste à part de chaque contenu fictif ? | `04-contenus.md` |
| 4 | `expert-paiement-facturation` | La section tarifs, la devise et les réponses de FAQ sur l'argent respectent-elles CA19 à CA21 ? | Avis ; corrections dans `04` |
| 4 | `expert-conformite-rgpd` (veto) | Textes et visuels originaux face à wekollab.fr (CA4) ? Fictif signalé et isolé, licences et droit à l'image, formulaire et bannière sans collecte, D16, pied de page sans fausse identité légale ? | Avis ; objections levées avant l'étape 5 |
| 5 | `dev-react-node` | Implémenter selon `01` à `05` : quelles preuves que CA6 à CA28 sont tenus (commandes, recherches) ? | Code sur `feat/landing-page` |
| 6 | `testeur` | Chaque critère CA1 à CA28 et la vérification du plan sont-ils satisfaits, preuves à l'appui (captures 375 et 1440 px en FR et EN, recherches, rapport axe, onglet réseau) ? | Verdict « prêt pour revue du fondateur » |
| 6 | `expert-ux` | Le rendu est-il conforme aux wireframes et aux tokens ? | Liste d'écarts |
| 7 | Fondateur | Compréhensible en 10 s (CA3) ? Discours juste ? Accord pour commit ? | Accord ou corrections |

## 6. Décisions ouvertes concernées

| # | Sujet | Arbitre | Effet sur la page |
|---|---|---|---|
| D1 | Vite ou Next.js | `architecte` | Tranchée à l'étape 2 ; référencement des pages publiques bilingues au Lot 1 |
| D3 | Monorepo ou multi-repo | `architecte` | Tranchée à l'étape 2 ; emplacement définitif de la page |
| D4 | Librairie UI | `architecte` + `expert-ux` | Tranchée à l'étape 2 ; doit fonctionner uniquement par tokens |
| D6 | Palette définitive | `expert-ux` + Fondateur | **Reste ouverte** : tokens provisoires marqués « D6 » |
| D12 | Backoffice séparé ou non | `architecte` + `product-owner` | Non tranchée ici ; D3 ne doit pas la fermer par défaut |
| D25 | Pays de la société | Fondateur | Pied de page sans identité légale (CA12) |
| D26 | Pays ouverts aux contrats | Fondateur + experts | FAQ générique, aucun pays nommé (CA5) |
| D27 | Devises | `expert-paiement-facturation` + Fondateur | Devise de l'exemple de tarifs : euros proposés |
| — | Librairie de traduction | `architecte` | À inscrire au §13 si jugée structurante |

## 7. Risques

| Risque | Nature | Parade |
|---|---|---|
| Page trop proche de wekollab : textes ou visuels proches, et structure complète reprise à l'identique (parasitisme possible) | Légal | Veto `expert-conformite-rgpd` (CA4) ; aucune capture ni ressource de wekollab dans le dépôt ; **risque résiduel sur la structure à réévaluer avant toute mise en ligne** |
| Preuve sociale fictive publiée par erreur (fausses références clients, faux avis : pratique commerciale trompeuse) | Légal / réputation | Bandeau (CA14), module unique (CA15), non-indexation (CA13), aucun déploiement ; au Lot 1, module fictif vide = condition du « prêt à livrer » |
| Licences et droit à l'image : personnes réelles présentées comme créateurs INFLUX, logos visibles sur les photos | Légal | `CREDITS.md` (CA26) ; photos sans visage identifiable ni logo pour les cartes créateurs ; remplacement avant mise en ligne |
| Dérive vers l'inscription réelle (« brancher Supabase ou Brevo pour tester ») | Projet / RGPD | CA8 et hors périmètre ; aucune clé ni `.env` réel ; collecte réelle uniquement au Lot 1 après feu vert conformité |
| Promesses hors MVP (algorithme, IA, connexion aux réseaux) | Commercial / légal | CA5 ; relecture `expert-marketing` puis fondateur |
| Socle choisi pour une seule page, inadapté aux Lots 1 à 4 | Technique | `architecte` décide sur les besoins de tout le MVP, pas de la seule page |
| Palette provisoire prise pour définitive | Projet | Tokens marqués « provisoire, D6 » ; validation visuelle du fondateur |
| Nom INFLUX non vérifié (antériorité de marque) | Légal / commercial | Prérequis 2 de `cadrage-mvp.md` à lancer par le fondateur avant d'investir dans la marque |

## 8. Évolution — prototype cliquable (2026-09-17)

**Demande du fondateur** : pouvoir présenter à ses associés un parcours de création de compte
« à la Malt.fr » — un bouton « Créer mon compte » menant au choix marque / créateur, un bouton
« Me connecter », et des pages dédiées, avec une authentification simulée. Le bouton « Créer une
campagne » (porte annonceur) est conservé.

**Effet sur les critères d'acceptation ci-dessus** : la maquette n'est plus une page unique sans
navigation. En conséquence :

- **CA6 est abrogé.** `href`, `<a>` et le composant `Link` localisé (`src/i18n/navigation.ts`)
  sont désormais autorisés dans tout `apps/web`, pour la navigation entre les pages de la
  maquette uniquement. Restent interdits, à l'identique : `iframe`, `script`, `video`, `audio`,
  `embed`, `object`, et tout import `next/script` ou `next/font/google` (CA11).
- **CA7 est étendu** : les boutons « Créer une campagne », « Recevoir des offres », « Créer mon
  compte » et « Me connecter » ont désormais un effet (navigation vers une nouvelle page), en plus
  des interactions déjà listées.
- **CA8 reste tenu dans son esprit** sur les nouvelles pages (`/signup`, `/signup/advertiser`,
  `/signup/creator`, `/login`, `/space`) : aucune requête réseau (`fetch` et assimilés toujours
  interdits par ESLint), aucun stockage (cookies, `localStorage`, `sessionStorage`), aucun compte
  réellement créé. « Me connecter » accepte tout e-mail bien formé et tout mot de passe non vide
  et navigue vers `/space` : ce n'est pas une vérification d'identifiants. Chaque page concernée
  porte une mention « Maquette » explicite en FR et en EN.
- La liste « hors périmètre » du §3 (« pages annonceur et créateur dédiées ») est corrigée
  d'autant : ces pages existent maintenant comme coquilles de démonstration (formulaire de
  compte, page de connexion, espace membre générique), sans back-office, matching, messagerie ni
  contrat réels — toujours hors périmètre du Lot 1.
- CA1 à CA5, CA9 à CA28 restent inchangés et continuent de s'appliquer à la page d'accueil.

**Implémentation** : `apps/web/eslint.config.mjs` (règles `no-restricted-syntax` /
`no-restricted-imports` resserrées à CA11 pour les éléments interdits, navigation réautorisée) ;
nouvelles pages sous `src/app/[locale]/{signup,signup/advertiser,signup/creator,login,space}` ;
composants `src/components/auth/*` et `src/components/account/*` ; nouveau namespace de
traduction `auth` dans `src/locales/{fr,en}/landing.json`, parité FR/EN vérifiée au typecheck
(CA23) comme le reste du fichier.
