# INFLUX — Guide projet pour Claude Code

> **Statut du projet : phase d'initialisation.** Aucun code applicatif n'existe encore.
> Ce document est la source de vérité pour toute session Claude Code travaillant sur INFLUX.
> Il est lu par les agents IA **et** par le fondateur : il doit rester compréhensible sans
> connaissance technique préalable dans ses parties produit/business.

---

## 1. À propos de ce document

| Public | Usage attendu |
|---|---|
| Sessions et agents Claude Code | Instructions système. À lire avant toute action. Les règles ici priment sur les habitudes par défaut. |
| Fondateur (non-développeur / développeur occasionnel) | Relecture de cohérence fonctionnelle et business. Toute divergence constatée doit être corrigée **ici d'abord**, puis répercutée dans le code. |

**Règle d'or :** si une décision structurante n'est pas tranchée dans ce document, elle ne doit
pas être inventée. Elle remonte en section [13. Décisions ouvertes](#13-décisions-ouvertes) et
est arbitrée par l'agent `architecte` (technique) ou `chef-de-projet` (fonctionnel/priorités).

---

## 2. Vision produit

**INFLUX est une marketplace B2B2C de mise en relation entre annonceurs et influenceurs.**

- Les **annonceurs** (marques, e-commerçants, PME) veulent lancer des campagnes ou promotions
  sur leurs produits et cherchent des audiences pertinentes.
- Les **influenceurs** (créateurs de contenu, micro à macro) proposent leur audience et leurs
  formats (post, story, vidéo, UGC, placement produit…).
- **INFLUX est l'intermédiaire** : il fait se rencontrer l'offre et la demande, sécurise la
  relation contractuelle, et se rémunère sur les contrats signés via la plateforme.

La mise en relation est **hybride** :

1. **Algorithmique** — un moteur de matching propose des candidats pertinents de part et d'autre.
2. **Humaine** — des agents internes d'INFLUX interviennent depuis un backoffice pour qualifier,
   arbitrer, relancer et closer les mises en relation à forte valeur.

Ces deux voies coexistent en permanence. L'algorithme **ne remplace pas** l'agent humain : il
le priorise et lui fait gagner du temps. Toute fonctionnalité de matching doit donc être
consultable, explicable et surchargeable manuellement depuis le backoffice.

### Portée internationale

INFLUX vend **à l'international dès le lancement** (arbitrage du fondateur, 2026-09-16).

| Règle | Détail |
|---|---|
| Zones visées | France et francophonie, reste de l'Europe, Amérique du Nord, Brésil |
| Inscriptions | Ouvertes **dans le monde entier** : tout inscrit est un lead Brevo / Apollo.io |
| Contrats | Possibles **uniquement entre parties situées dans des pays ouverts**. La liste est stockée en base et élargie pays par pays après validation juridique, fiscale et paiement (D26). |
| Langues au lancement | **Français et anglais**. Le portugais est recommandé avant l'ouverture des contrats au Brésil. |
| Société | Pas encore créée ; pays d'établissement à choisir, potentiellement hors UE et hors États-Unis (D25) |

Aucun agent ne suppose un cadre exclusivement français : droit, fiscalité, devise et langue
dépendent du pays de la société et de celui des utilisateurs.

Le périmètre et l'ordre de livraison du MVP sont détaillés dans **`docs/mvp/00-cadrage-mvp-v2.md`**
(2026-09-18), qui abroge `docs/cadrage-mvp.md`.

> **Au MVP, INFLUX est une place de marché *courtée*.** La découverte est libre — la marque cherche
> des créateurs, le créateur postule aux campagnes — mais **aucune négociation ne se déroule sans un
> commercial INFLUX présent dans la conversation**, et c'est lui qui peut aussi rapprocher lui-même
> une marque et un créateur sur une campagne. Ce métier est aujourd'hui exercé de façon informelle et
> physique par l'un des fondateurs : **la plateforme sert à le structurer et à le passer à
> l'échelle.** L'algorithme de matching (D11) reste reporté après le MVP.

### Positionnement concurrentiel

Référence UX/UI à égaler puis dépasser : **https://wekollab.fr/**.
Ce site sert de mètre étalon pour le niveau de finition attendu (clarté du parcours
d'inscription, lisibilité des profils, fluidité de la mise en relation). INFLUX doit être
**au moins aussi simple** à comprendre en 10 secondes sur la page d'accueil.

---

## 3. Modèle économique — INVARIANT MÉTIER

> ### 💰 **Commission de 35 % sur le montant de chaque contrat signé via INFLUX : 20 % à la charge de l'annonceur + 15 % à la charge du créateur.**

C'est l'invariant le plus structurant du projet. Il conditionne l'architecture données, les
écrans, les contrats, la facturation et le discours commercial.

| Règle | Détail |
|---|---|
| Assiette | Montant du contrat signé entre l'annonceur et l'influenceur **via l'intermédiaire d'INFLUX**. **Le montant du contrat est le coût total pour l'annonceur** : la commission est incluse, jamais ajoutée. Le traitement fiscal (hors taxes ou taxes comprises, TVA / GST / sales tax) dépend des pays : décision ouverte D7. |
| Taux | **35 % au total**, répartis en **part annonceur 20 %** et **part créateur 15 %**, valeurs par défaut de la plateforme (arbitrage du fondateur, 2026-09-16). |
| Paramétrabilité | **Les deux taux** sont **stockés en base et paramétrables**, jamais codés en dur. Des taux dérogatoires (partenariats, offres de lancement) seront nécessaires. Chaque contrat fige **les deux taux** appliqués **au moment de la signature** (historisation obligatoire). |
| Identité comptable | `montant du contrat = part annonceur + part créateur + net créateur`, toujours vraie, arrondis compris (règle d'arrondi : D19). |
| Devise | Une devise unique par contrat, choisie dans une liste fermée (D27). |
| Flux financier | **INFLUX encaisse et reverse via un prestataire de paiement agréé** (D8 tranchée ; choix du prestataire : D9). L'annonceur paie le montant du contrat, INFLUX retient les deux parts et reverse le net créateur après validation de la publication. |
| Pays | Un contrat n'est possible qu'entre parties situées dans des **pays ouverts** (D26). |
| Fait générateur | La **signature du contrat** via la plateforme. Un contrat conclu hors plateforme après mise en relation INFLUX constitue un contournement : la traçabilité de la mise en relation doit permettre de le détecter. |
| Conséquence produit | Toute campagne, tout échange, toute signature et **tout paiement** doivent être **traçables dans INFLUX**. Un parcours qui pousse les parties à s'échanger leurs coordonnées hors plateforme détruit le modèle économique : c'est un critère de rejet en revue UX. |

> *Note de cohérence (2026-09-18).* L'ancien cadrage `docs/cadrage-mvp.md` §1 indiquait à tort que
> « le prestataire retient les 35 % ». C'est **INFLUX** qui retient les deux parts et reverse le net
> créateur : la ligne « Flux financier » ci-dessus fait foi. L'erreur avait été relevée au point T10
> de `docs/landing-page/06-revue-paiement.md` sans jamais être corrigée ; elle l'est ici.

> ### ⏳ Régime transitoire du MVP (2026-09-18)
>
> Le **fait générateur reste la signature du contrat** : l'invariant ci-dessus ne bouge pas.
>
> Mais **au MVP, le contrat est envoyé et signé hors plateforme par le commercial** — par e-mail,
> via DocuSign ou en main propre, à sa discrétion — et **le paiement se fait à la confiance**
> (arbitrage A1 du fondateur). **La plateforme n'encaisse rien et ne calcule rien.** Elle
> **enregistre l'affaire et la commission convenue**, saisies par le commercial dans le pipeline
> commercial du backoffice (arbitrage A8).
>
> **Interdiction formelle au MVP : aucun taux et aucun calcul de commission dans le code.** La table
> `commission_rates` est créée, elle reste vide. Le commercial saisit le montant négocié et le
> montant de commission convenu ; l'application les enregistre et les additionne, elle ne les déduit
> jamais d'un taux.
>
> L'encaissement et le reversement **dans** la plateforme reviennent en **V2**, avec D9 (prestataire
> de paiement) et D25 (pays de la société).
>
> Régime complet : `docs/mvp/01-intermediation-courtee.md`. Périmètre :
> `docs/mvp/00-cadrage-mvp-v2.md`.

**Exemple de référence** (à reproduire dans toute spécification financière) :

| Élément | Valeur |
|---|---|
| Montant du contrat (coût total annonceur, dans la devise du contrat) | 2 000,00 |
| Part annonceur INFLUX (20 %) | 400,00 |
| Part créateur INFLUX (15 %) | 300,00 |
| Commission INFLUX totale (35 %) | 700,00 |
| Net créateur reversé | 1 300,00 |
| Vérification | 400 + 300 + 1 300 = 2 000 ✅ |

**Inscription libre et gratuite** pour les deux profils. La monétisation intervient uniquement
à la signature. Il n'y a pas d'abonnement au lancement (décision réversible, §13).

### Second pilier : la valeur des leads

Chaque inscription alimente la machine commerciale d'INFLUX :

- **Brevo** — emailing, nurturing, CRM, campagnes déclenchées depuis le backoffice.
- **Apollo.io** — prospection commerciale sortante, prioritairement sur les annonceurs.

Un lead qui n'arrive pas dans Brevo et Apollo est un lead perdu. La synchronisation est donc
une **fonctionnalité de premier plan**, pas un « nice to have » de fin de backlog.

---

## 4. Personas et parcours utilisateurs

> **Ces parcours sont la cible, pas le MVP.** Au MVP (2026-09-18), trois étapes diffèrent pour
> l'annonceur comme pour le créateur :
> - la **recherche** est ouverte, mais sur des **profils anonymisés** (A2) ;
> - **aucune conversation ne s'ouvre sans validation d'un commercial**, qui y participe ensuite comme
>   intermédiaire visible et nommé (A3, A9) — et qui peut aussi **initier lui-même** la mise en
>   relation sur une campagne (A3bis) ;
> - **le contrat et le paiement sortent de la plateforme** (A1, §3) : le commercial envoie le contrat
>   et le paiement se fait à la confiance.
>
> Périmètre exact par persona : `docs/mvp/00-cadrage-mvp-v2.md`.

### 4.1 Annonceur (marque / e-commerçant)

**Ce qu'il veut :** trouver vite des influenceurs crédibles, maîtriser son budget, mesurer.

Parcours cible :

1. **Découverte** — landing page, proposition de valeur claire, preuve sociale.
2. **Inscription libre** — création de compte, choix du profil « Annonceur », pays et langue.
3. **Création de profil** — entreprise, secteur, produits, budget indicatif, objectifs.
4. **Publication d'une campagne** — brief, produit à promouvoir, formats attendus, budget,
   période, cibles (audience, thématique, zone géographique).
5. **Mise en relation** — réception de profils proposés (algorithme + agent humain),
   consultation des profils influenceurs (pseudos masqués jusqu'à la signature, D16), shortlist.
6. **Négociation** — échanges via messagerie interne (traçables).
7. **Contractualisation** — génération du contrat (uniquement si les deux parties sont dans des
   pays ouverts), montant dans la devise du contrat, commission 35 % et ses deux parts explicites.
8. **Suivi** — paiement en ligne via INFLUX (moment exact : D20), livrables, validation, bilan de
   campagne.

### 4.2 Influenceur (créateur de contenu)

**Ce qu'il veut :** des opportunités rémunérées qui collent à sa ligne éditoriale, sans perdre
de temps en prospection.

Parcours cible :

1. **Découverte** — landing dédiée créateurs, promesse « des marques viennent à vous ».
2. **Inscription libre** — création de compte, choix du profil « Influenceur », pays et langue,
   attestation de majorité (mineurs exclus au MVP, D15).
3. **Création de profil** — réseaux, thématiques, audience (volume, démographie, pays), formats
   proposés, tarifs indicatifs (avec devise), portfolio / campagnes passées.
4. **Découverte de campagnes** — fil de campagnes ouvertes + propositions ciblées reçues.
5. **Candidature / réponse** à une proposition.
6. **Négociation** — messagerie interne.
7. **Contractualisation** — contrat signé, rémunération nette connue **avant** signature ;
   vérification d'identité et coordonnées bancaires auprès du prestataire de paiement au premier
   contrat. Tout créateur majeur peut signer, particuliers compris (D17).
8. **Exécution** — dépôt des livrables, validation par l'annonceur, reversement du net créateur
   par INFLUX.

> ⚠️ **Point UX sensible.** L'influenceur doit comprendre sans ambiguïté ce qu'il touche
> réellement. Toute interface affichant un montant doit lever le doute entre *montant du
> contrat*, *commission INFLUX* (et ses deux parts) et *net créateur*, toujours avec la devise.
> C'est un point de contrôle obligatoire pour `expert-ux` et `expert-paiement-facturation`.

### 4.3 Agent interne INFLUX (backoffice)

**Ce qu'il veut :** faire l'intermédiaire, conclure des affaires, et savoir combien elles rapportent.

Le commercial INFLUX n'est pas un modérateur qui surveille des échanges : **il est partie prenante de
chaque mise en relation**. C'est le métier que l'un des fondateurs exerce déjà de façon informelle et
physique ; la plateforme sert à le structurer et à le passer à l'échelle.

Parcours cible :

1. **Tableau de bord** — demandes à valider et leur ancienneté, affaires en cours, commission
   encaissée de la semaine.
2. **File de validation** — valider, refuser avec un motif typé, ou **s'attribuer** une demande de
   contact (venue d'une marque) ou une candidature (venue d'un créateur). **Rien ne circule entre
   deux membres sans son accord.**
3. **Proposition INFLUX** — **initier lui-même une mise en relation** entre une marque et un ou
   plusieurs créateurs, sur une campagne donnée, sans demande préalable d'aucune des deux parties.
   C'est le geste métier central : il doit être au moins aussi rapide dans l'outil qu'un coup de fil.
4. **Conversation à trois** — participer à la négociation comme **intermédiaire visible et nommé**,
   aux côtés de la marque et du créateur ; conduire la négociation jusqu'à l'accord. Toute lecture
   d'une conversation par un agent non participant est horodatée et attribuée.
5. **Contrat hors plateforme** — envoyer le contrat par le moyen de son choix (e-mail, DocuSign,
   en main propre) et suivre sa signature (voir le régime transitoire du MVP, §3).
6. **Pipeline commercial** — enregistrer l'affaire : montant négocié, devise, **commission due et
   commission encaissée**, dates, mode d'envoi du contrat, commercial responsable. L'application
   enregistre ce qui est saisi, **elle ne calcule rien**.
7. **Gestion des comptes** — valider les profils, attribuer et retirer le badge « vérifié »,
   suspendre, annoter, valider les campagnes avant publication.
8. **Suivi des leads** — état de synchronisation Brevo / Apollo.io, cause des échecs en clair,
   relance unitaire ou en lot.
9. **Envoi d'e-mails** — sélection d'un segment et **déclenchement d'envois via l'API Brevo
   directement depuis le backoffice**, à partir de trois sources encadrées (contacts de la
   plateforme, segments Brevo, saisie libre plafonnée), suivi des performances.

Le backoffice est un **produit à part entière**, pas un écran d'admin bricolé. Il est utilisé
tous les jours par l'équipe et porte la rentabilité opérationnelle.

---

## 5. Identité de marque et principes UX

### 5.1 Charte graphique

| Élément | Règle |
|---|---|
| Nom | **INFLUX** (toujours en capitales dans l'UI et les documents) |
| Couleur de marque | **Vert** — couleur d'accent, d'action et de succès, recalibrée pour rester lisible (WCAG AA) et premium sur fond sombre |
| Typographie | **Texte clair sur fond sombre** — contraste fort, lisibilité maximale |
| Base | **Dark theme par défaut** : fond noir profond nuancé (pas de noir pur), surfaces qui s'éclaircissent légèrement par élévation (carte, survol, panneau surélevé), respiration généreuse |
| Fond de page | **Aucune exception.** L'arrière-plan reste sombre sur toute la plateforme, y compris le footer et le CTA final — décision du fondateur qui abroge l'ancien principe de sections « inverse » claires (2026-09-17). Les tokens `*-inverse` ne servent plus qu'à des accents ponctuels de petite taille (puce, cadre de mockup), jamais à une section pleine largeur. |
| Référence | https://wekollab.fr/ — niveau de finition à égaler (sur wekollab, en clair ; l'exigence de finition et de clarté du parcours vaut aussi en dark) |

**Les valeurs hexadécimales sont figées (D6 tranchée par le fondateur, 2026-09-17)** : dark theme
par défaut sur toute la plateforme (landing, app membres, backoffice), vert de marque recalibré
pour le fond sombre, noir profond nuancé façon référence premium (Linear / Vercel / Apple), jamais
de noir pur. Implémentation de référence : `apps/web/src/styles/tokens.css`. Toute évolution de
palette reste soumise à la même règle : aucun agent ne doit inventer et disséminer des couleurs
arbitraires dans le code, toute couleur passe par les tokens du design system
(skill `design-system-influx`).

### 5.2 Principes UX non négociables

1. **Compréhension en 10 secondes.** La page d'accueil explique qui fait quoi et pour qui.
2. **Deux portes d'entrée assumées.** Annonceur et Influenceur ne partagent ni le même discours,
   ni le même onboarding, ni le même vocabulaire.
3. **Inscription sans friction.** Le minimum d'informations pour créer le compte ; le profil se
   complète progressivement (profil complété = meilleur matching, à rendre visible).
4. **Transparence financière permanente.** Le montant du contrat, la commission 35 % (part
   annonceur 20 %, part créateur 15 %) et le net créateur sont toujours explicites, avec leur
   devise. Jamais de coût découvert en fin de parcours.
5. **Tout se passe dans INFLUX.** Les parcours ne doivent pas encourager la sortie de plateforme.
6. **Mobile-first.** Les influenceurs consultent majoritairement sur mobile.
7. **Accessibilité.** Contrastes conformes WCAG AA au minimum — le vert de marque ne doit jamais
   être le seul porteur d'information (état, erreur, succès).
8. **Bilingue dès le lancement.** Chaque écran, e-mail et document existe en français et en
   anglais. Dates, nombres et montants suivent les formats de la langue de l'utilisateur.

---

## 6. Stack technique imposée

Ces choix sont **imposés par le fondateur** et ne sont pas rediscutables par les agents.

| Domaine | Technologie |
|---|---|
| Frontend | **React + TypeScript** |
| Backend | **Node.js + TypeScript** |
| Base de données | **Supabase** (PostgreSQL managé, Auth, Storage, RLS) |
| Hébergement du code | **GitHub** |
| Déploiement applicatif | **Railway** |
| Emailing / CRM | **Brevo** (API) |
| Prospection commerciale | **Apollo.io** (API) |

### Choix techniques tranchés (2026-09-16)

Décidés par `architecte` (options écartées, conséquences et réversibilité :
`docs/landing-page/01-architecture.md`).

| Domaine | Choix | Décision |
|---|---|---|
| Framework React | **Next.js** (App Router) : pages publiques pré-rendues par langue, servies par Node.js. `apps/web` rend des pages, sans logique métier ni secret | D1 |
| Structure du dépôt | **Monorepo** géré par **pnpm 11** (activé par corepack) : `apps/*` pour les applications, `packages/*` pour le code partagé (créé au premier besoin réel) ; pas d'outil d'orchestration | D3 |
| UI et styles | **Tailwind CSS v4** alimenté **uniquement** par le fichier de tokens `apps/web/src/styles/tokens.css` ; pas de bibliothèque de composants ; primitives accessibles « headless » choisies au premier besoin réel | D4 |
| Traduction | **next-intl** ; messages JSON au format ICU par langue (`apps/web/src/locales/<langue>/`) | D28 |
| Qualité | Node.js 22 LTS (passage à 24 LTS avant la première mise en ligne), TypeScript 6.0 strict, ESLint 9, Prettier, **Vitest** | — |

### Choix techniques tranchés (2026-09-18)

Décidés par `architecte` (options écartées, grilles d'arbitrage, conséquences et réversibilité :
**`docs/mvp/02-architecture-3-espaces.md`**).

| Domaine | Choix | Décision |
|---|---|---|
| Place du backoffice | **Deux applications, trois espaces** : `apps/backoffice` séparée (hôte distinct, `noindex`, MFA, session courte, inscription impossible) car elle voit toutes les identités, toutes les conversations et toutes les affaires. Marque et créateur restent dans `apps/web` | D12 |
| Framework backend | **Fastify 5** dans `apps/api`, plus un **worker** issu du même paquet, déployé comme service Railway distinct | D2 |
| Accès aux données | **Drizzle** comme constructeur de requêtes typé ; **migrations en SQL relu** dans `supabase/migrations` (`drizzle-kit push` interdit) ; `@supabase/supabase-js` cantonné à `apps/api`. Connexion sous **rôles Postgres dédiés, aucun avec `BYPASSRLS`** ; **un schéma par domaine, aucune table métier dans `public`**, `REVOKE ALL` sur `anon` et `authenticated` | D5 |
| File des leads | Table **`outbox_events`** + worker `FOR UPDATE SKIP LOCKED`, verrou consultatif **de transaction**, priorité aux révocations. Ni Redis, ni BullMQ. Elle transporte aussi **les e-mails transactionnels de révélation d'identité** | D18 |
| Authentification | **Membres : code à 6 chiffres par e-mail, aucun mot de passe.** Backoffice : mot de passe + **TOTP obligatoire**, second facteur vérifié côté serveur *et* en RLS. Pas de connexion Google / Instagram / TikTok au MVP. **Validée sous conditions par `expert-cybersecurite`, avec clause de caducité** : le jour où l'encaissement entre dans l'application (V2), un second facteur devient obligatoire côté membres | D37 |

> **Les rôles applicatifs doivent être de vrais rôles Postgres.** En configuration Supabase standard,
> `advertiser`, `creator`, `agent` et `admin` sont **le même rôle Postgres `authenticated`** : il n'y
> a alors aucun « rôle annonceur » à qui refuser un droit, et l'anonymisation ne tient plus que par
> un seul contrôle. Quatre rôles Postgres distincts et un `SET LOCAL ROLE` par transaction sont donc
> obligatoires. De même, **aucun rôle d'exécution ne doit porter `BYPASSRLS`** — sinon tous les tests
> de RLS deviennent facultatifs sans le moindre symptôme. Détail :
> `docs/mvp/03-matrice-des-droits-et-rls.md`.

**Emplacements figés** : `apps/web` (pages publiques + espace marque + espace créateur) ;
`apps/backoffice` (espace commercial et administrateur) ; `apps/api` (API Node, **seul détenteur de
la `service_role key`**) ; `packages/{contracts,domain,ui,i18n}` créés au premier besoin réel ;
`supabase/{migrations,seed}`.

> **Deux règles d'architecture non négociables.**
> 1. **Le front ne parle jamais à Supabase pour de la donnée métier**, et ne porte **aucune clé
>    Supabase, pas même `anon`**. Il parle à `apps/api`, qui n'est pas exposée publiquement et que
>    les fronts joignent par le réseau privé via un passe-plat sans logique. C'est la condition pour
>    que l'anonymisation des profils créateurs soit réellement exécutoire.
> 2. **L'anonymisation est une séparation d'objets, pas un filtre de colonnes en code** : profil
>    identifiant sans aucun `GRANT` au rôle annonceur d'un côté, profil public anonymisé de l'autre.
>    La révélation est une politique SQL, doublée d'un filtre de sortie et d'un test automatisé.

Reste **ouvert** : la gestion d'état côté front (aucune librairie tant qu'aucun besoin réel).

### Conventions de code attendues

- **TypeScript strict** (`strict: true`). Le `any` est interdit sauf justification en commentaire.
- **Nommage** : `camelCase` (variables/fonctions), `PascalCase` (composants/types),
  `SCREAMING_SNAKE_CASE` (constantes), `kebab-case` (fichiers non-composants).
- **Langue du code** : identifiants, commentaires et messages de commit **en anglais**. Les
  libellés affichés aux utilisateurs sont **en français et en anglais** dès le lancement,
  externalisés dans des fichiers de traduction (d'autres langues suivront, portugais en premier
  candidat).
- **International par défaut.** Pays (ISO 3166-1), langue, devise (ISO 4217) et fuseau horaire
  sont des données explicites. Aucune hypothèse implicite « France / euro / français » dans le code.
- **Pas de secret dans le code.** Toutes les clés (Supabase, Brevo, Apollo, Railway) passent par
  des variables d'environnement — voir la skill `env-secrets`.
- **Commits** : convention *Conventional Commits* (`feat:`, `fix:`, `chore:`, `docs:`…).
- **Branches** : **dérogation du fondateur (2026-09-17)** — développement directement sur `main`,
  sans branche ni Pull Request intermédiaire, tant que cette dérogation n'est pas levée. Le schéma
  `feat/<sujet>` / `fix/<sujet>` + PR reste la cible par défaut si l'on revient au fonctionnement
  standard.
- **Un module = une responsabilité.** Aucune logique métier dans les composants React.
- **Logique financière centralisée.** Le calcul de la commission (ses deux parts et le net
  créateur) n'existe qu'à **un seul endroit** dans tout le code. Toute duplication est un défaut
  bloquant.

---

## 7. Architecture cible (haut niveau)

```
                 ┌──────────────────────────────────────────────┐
                 │               Utilisateurs                   │
                 │  Annonceurs · Influenceurs · Agents INFLUX    │
                 └───────────────────┬──────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
   ┌──────▼───────┐          ┌───────▼────────┐        ┌────────▼────────┐
   │ App publique │          │  App membres   │        │   Backoffice    │
   │ React + TS   │          │  React + TS    │        │   React + TS    │
   │ (marketing)  │          │  (marketplace) │        │   (interne)     │
   └──────┬───────┘          └───────┬────────┘        └────────┬────────┘
          └──────────────────────────┴──────────────────────────┘
                                     │  HTTPS / API
                          ┌──────────▼───────────┐
                          │   API Node.js + TS   │
                          │  ┌────────────────┐  │
                          │  │ Auth & profils │  │
                          │  │ Campagnes      │  │
                          │  │ Matching       │  │
                          │  │ Messagerie     │  │
                          │  │ Contrats       │  │
                          │  │ Commission 35% │  │
                          │  │ Leads & sync   │  │
                          │  └────────────────┘  │
                          └───┬──────────────┬───┘
                              │              │
                   ┌──────────▼──┐      ┌────▼──────────────────────┐
                   │  Supabase   │      │  Intégrations externes    │
                   │  Postgres   │      │  ┌─────────┐ ┌──────────┐ │
                   │  Auth       │      │  │  Brevo  │ │ Apollo.io│ │
                   │  Storage    │      │  └─────────┘ └──────────┘ │
                   │  RLS        │      │  ┌──────────────────────┐ │
                   └─────────────┘      │  │ Paiement (D9)        │ │
                                        │  └──────────────────────┘ │
                                        │   (file d'événements)     │
                                        └───────────────────────────┘

        Code : GitHub  ──────►  CI/CD  ──────►  Déploiement : Railway
```

### Domaines fonctionnels

| Domaine | Rôle |
|---|---|
| `identity` | Comptes, authentification, rôles (annonceur / influenceur / agent / admin) |
| `profiles` | Profils annonceurs et influenceurs, complétude, vérification |
| `campaigns` | Campagnes, briefs, budgets, formats, statuts |
| `search` | Recherche de créateurs (anonymisée côté annonceur, identifiée côté commercial) et de campagnes, facettes, tri explicable |
| `verification` | Preuves d'audience et de propriété de compte, badge « Vérifié », péremption et contestation |
| `matching` | Mise en relation : les trois déclencheurs, file de validation, attribution, révélation d'identité, preuve d'intermédiation. Scoring algorithmique reporté après le MVP (D11) |
| `messaging` | Échanges traçables entre parties, **conversation à trois** avec le commercial INFLUX, lectures journalisées |
| `contracts` | Contrats, signature, montants et devise, taux de commission historisés (deux parts), contrôle des pays ouverts |
| `billing` | Parts de commission, encaissement et reversement via le prestataire de paiement, remboursements, facturation, exports |
| `leads` | Capture de leads et synchronisation Brevo / Apollo.io |
| `backoffice` | Pilotage interne, pays ouverts aux contrats, campagnes Brevo, supervision |

### Principes d'architecture

1. **La synchronisation externe est asynchrone et rejouable.** Un échec Brevo ou Apollo ne doit
   jamais bloquer une inscription. File d'événements + retries + journal d'audit.
2. **La base est la source de vérité**, pas les outils externes.
3. **Sécurité par défaut** : Row Level Security Supabase activée sur toutes les tables contenant
   des données personnelles ou financières.
4. **Traçabilité** : toute mise en relation, tout changement de statut de contrat et tout calcul
   de commission sont journalisés et auditables (obligation business et légale).

---

## 8. Intégrations externes requises

| Service | Rôle dans INFLUX | Points d'attention |
|---|---|---|
| **Supabase** | Base PostgreSQL, authentification, stockage de fichiers (portfolios, livrables, contrats), RLS | Ne jamais exposer la `service_role key` côté client. Migrations versionnées dans Git. Hébergement UE par défaut, à confirmer après D25. |
| **Brevo** | Emailing transactionnel, nurturing, CRM, **campagnes déclenchées depuis le backoffice via API** | Rate limits, idempotence, gestion des désinscriptions (obligation légale), segmentation par type de profil, **langue et pays**. Skill : `brevo-campaign`. |
| **Apollo.io** | Prospection commerciale sortante sur les leads annonceurs | Qualification avant envoi (ne pas polluer la base), mapping des champs, conformité de la prospection B2B **selon le pays** (UE, CASL au Canada…). Skill : `apollo-lead-sync`. |
| **Prestataire de paiement** (à choisir, D9) | Encaissement du montant du contrat, vérification d'identité des créateurs, conservation des fonds, reversement international du net créateur, remboursements | Compatible avec le pays de la société (D25), les pays ouverts (D26) et les devises (D27). Webhooks signés et idempotents. Aucune donnée de carte chez INFLUX. Skill : `contract-commission`. |
| **GitHub** | Hébergement du code, Pull Requests, revue, CI | `main` protégée, secrets dans GitHub Secrets. |
| **Railway** | Déploiement de l'API et des fronts, environnements | Séparation `staging` / `production`, variables d'environnement par environnement. Skill : `railway-deploy`. |

**Aucun de ces comptes n'est encore créé ni configuré** — voir §14, Prérequis.

### Règle de synchronisation des leads

À chaque inscription (annonceur ou influenceur), un événement `lead.created` est émis puis
consommé de façon asynchrone :

- → **Brevo** : création/mise à jour du contact, affectation à la bonne liste, entrée dans le
  scénario de nurturing correspondant au type de profil et à la langue.
- → **Apollo.io** : prioritairement pour les **annonceurs** qualifiés (cible de prospection
  commerciale), dans les pays où la base légale de la prospection est validée ; enrichissement et
  séquence commerciale.

Chaque tentative est journalisée avec son statut. Le backoffice expose les échecs et permet le
rejeu. **Le consentement de l'utilisateur conditionne l'envoi marketing** (cf. RGPD, §9).

---

## 9. Données personnelles et conformité

INFLUX traite des données personnelles des deux côtés du marché, dans plusieurs pays, et des
données financières.

| Sujet | Exigence |
|---|---|
| Cadre applicable | **Principe proposé** (à valider par `expert-conformite-rgpd`) : le **niveau RGPD s'applique à tous les utilisateurs**, complété par les exigences propres à chaque zone — LGPD (Brésil), Loi 25 (Québec), lois des États américains (ex. CCPA), CASL (prospection au Canada). Si la société est établie hors UE (D25) : représentant dans l'UE (art. 27 RGPD), et au Royaume-Uni si nécessaire. |
| Base légale | Consentement explicite pour le marketing (Brevo/Apollo), exécution du contrat pour le reste. Case à cocher non pré-cochée à l'inscription. La base légale de la prospection Apollo est validée pays par pays. |
| Droits des personnes | Accès, rectification, suppression, portabilité, opposition — à prévoir dès la conception, y compris la propagation de la suppression vers Brevo et Apollo. |
| Documents obligatoires | CGU, CGV, politique de confidentialité, mentions légales, politique cookies, **contrat d'intermédiation** matérialisant la commission de 35 % et ses deux parts — **en français et en anglais**, validés par un juriste pour chaque pays ouvert aux contrats. |
| Statut d'INFLUX | Intermédiaire de mise en relation — obligations d'information et de transparence des plateformes selon les pays (DSA dans l'UE…) ; règles de l'influence commerciale propres à chaque pays ouvert (D21). |
| Mineurs | **Exclus au MVP** (D15) : attestation de majorité selon le pays de résidence, contrôle avant signature, exclusion énoncée dans les CGU. Tout régime spécifique (ex. législation française sur les enfants influenceurs) est à traiter avant une éventuelle ouverture aux mineurs. |
| Fiscalité des utilisateurs | Déclarations de la plateforme selon les pays (DAC7 dans l'UE, formulaires 1099 aux États-Unis…), en particulier pour les créateurs particuliers (D24). |
| Sécurité | Chiffrement en transit et au repos, RLS Supabase, principe du moindre privilège, journalisation des accès aux données sensibles. |

Agents référents : `expert-conformite-rgpd` (conformité) et `expert-cybersecurite` (sécurité
technique). Skill dédiée : `security-rgpd-audit`.

---

## 10. Règles de collaboration entre agents

### 10.1 Chaîne de décision

```
   Fondateur (humain)
        │  valide : vision, business, budget, branding, mise en production
        ▼
   chef-de-projet ──── arbitre priorités, séquence, cohérence fonctionnelle
        │
        ├─► product-owner ........ spécifie, rédige user stories et critères d'acceptation
        ├─► architecte ........... tranche les choix techniques structurants
        │       └─► dev-react-node, expert-database, integrateur (exécution)
        ├─► expert-ux ............ tranche les parcours et le design system
        ├─► expert-marketing ..... tranche le funnel, les segments, le contenu CRM
        └─► experts transverses .. matching, intégrations, paiement, sécurité, RGPD
                                   (avis obligatoire dans leur domaine)
```

### 10.2 Qui décide quoi

| Domaine | Décide | Valide / droit de veto |
|---|---|---|
| Priorités, périmètre d'un lot | `chef-de-projet` | Fondateur |
| Spécification fonctionnelle, critères d'acceptation | `product-owner` | `chef-de-projet` |
| Choix techniques structurants (framework, structure, librairies) | `architecte` | `chef-de-projet` |
| Modèle de données, migrations, RLS | `expert-database` | `architecte` |
| Implémentation applicative | `dev-react-node` | `architecte` + `testeur` |
| Parcours, maquettes, design system | `expert-ux` | Fondateur (branding) |
| Funnel, segments, contenus CRM | `expert-marketing` | `chef-de-projet` |
| Recherche de créateurs, facettes, anonymisation, et règles de matching | `expert-matching` | `product-owner` |
| Preuve d'intermédiation, pipeline commercial, suivi de la commission | `expert-paiement-facturation` | Fondateur |
| Contrats d'API externes, mapping, résilience | `expert-integrations-api` | `architecte` |
| Commission, facturation, flux financiers | `expert-paiement-facturation` | Fondateur |
| Git, CI/CD, déploiement Railway | `integrateur` | `architecte` |
| Stratégie et couverture de tests | `testeur` | `architecte` |
| Sécurité applicative | `expert-cybersecurite` | **veto bloquant** |
| Conformité RGPD et contractuelle | `expert-conformite-rgpd` | **veto bloquant** |

### 10.3 Règles de fonctionnement

1. **Une session démarre par `chef-de-projet`** si la demande est floue, transverse ou touche
   plusieurs domaines. Une demande précise et cadrée peut aller directement au spécialiste.
2. **Vetos bloquants.** `expert-cybersecurite` et `expert-conformite-rgpd` peuvent bloquer une
   livraison. Leur objection ne se contourne pas : elle se traite, ou se fait arbitrer par le
   fondateur, explicitement.
3. **Pas d'invention hors périmètre.** Un agent qui manque d'une information structurante
   l'inscrit en décision ouverte (§13) et propose des options argumentées — il ne choisit pas seul.
4. **Toute décision structurante est écrite** dans ce CLAUDE.md (section concernée + §13 mise à jour).
5. **Aucun agent ne modifie le modèle économique.** Le taux de 35 %, sa répartition (20 %
   annonceur / 15 % créateur) et sa mécanique relèvent du fondateur seul.
6. **Aucun agent ne crée ni ne supprime de dépôt distant, et n'exécute de déploiement en
   production, sans confirmation explicite du fondateur.**
7. **Cohérence UI.** Toute contribution visuelle passe par les tokens du design system (skill
   `design-system-influx`). Pas de couleur ni d'espacement en dur.

---

## 11. Agents disponibles

Fichiers : `.claude/agents/<nom>.md`. Invocation : demander explicitement l'agent, ou laisser
Claude le sélectionner sur la base de sa `description`.

### Agents demandés au cadrage

| Agent | Quand le solliciter |
|---|---|
| `chef-de-projet` | Point d'entrée par défaut. Cadrage d'un besoin, arbitrage de priorités, découpage en lots, coordination multi-agents, point d'avancement. |
| `architecte` | Avant toute décision structurante : choix de framework, structure du code, découpage en modules, choix d'une librairie, revue de cohérence technique. |
| `dev-react-node` | Implémentation front React/TS et back Node/TS, refactoring, correction de bug, revue de code d'implémentation. |
| `expert-database` | Modélisation, schéma Supabase/PostgreSQL, migrations, index, politiques RLS, performance des requêtes. |
| `integrateur` | Git, branches, Pull Requests, CI/CD, configuration et déploiement Railway, environnements, variables d'environnement. |
| `testeur` | Stratégie de tests, tests unitaires/intégration/E2E, couverture, définition du « prêt à livrer ». |
| `expert-ux` | Parcours utilisateur, wireframes, design system, charte noir/vert, benchmark wekollab.fr, accessibilité. |
| `expert-marketing` | Funnel d'acquisition, conversion, segmentation, scénarios Brevo, séquences Apollo.io, contenus et messages. |
| `expert-cybersecurite` | Authentification, autorisation, protection des données, revue de sécurité avant livraison, gestion des secrets, dépendances. |

### Agents complémentaires ajoutés (et pourquoi)

| Agent | Justification de l'ajout |
|---|---|
| `product-owner` | Le fondateur n'est pas développeur. Sans traducteur entre l'intention métier et une spécification testable, chaque développement repose sur des suppositions. Cet agent produit user stories, règles de gestion et critères d'acceptation — le chaînon manquant entre `chef-de-projet` et `dev-react-node`. |
| `expert-matching` | La mise en relation **est** le produit. Ni l'architecte (technique) ni le développeur (implémentation) ne portent la logique métier des critères : facettes, pondérations, explicabilité, articulation avec l'intervention humaine. Depuis le 2026-09-18, il porte aussi **la recherche de créateurs et son anonymisation** — car les critères de recherche d'aujourd'hui deviendront les critères de score de demain, et une facette sans avenir dans le scoring ne doit pas être créée. |
| `expert-integrations-api` | Brevo et Apollo.io sont des dépendances externes critiques (un lead non synchronisé est un lead perdu) et fragiles (rate limits, pannes, évolutions d'API). Cet agent détient les contrats d'interface, le mapping des champs, l'idempotence et les stratégies de reprise sur erreur. |
| `expert-paiement-facturation` | La commission de 35 % (20 % annonceur + 15 % créateur) implique calcul, historisation des taux, facturation, taxes selon les pays, encaissement, reversement international au créateur, devises et exports comptables. Domaine à risque financier et légal qui ne se délègue ni au développeur ni au marketing. |
| `expert-conformite-rgpd` | Données personnelles des deux profils, envoi vers deux outils tiers, contrats d'intermédiation, présence possible d'influenceurs mineurs. La conformité conditionne le droit d'exploiter la plateforme : elle a besoin d'un porteur avec droit de veto, distinct de la sécurité technique. |

---

## 12. Skills disponibles

Fichiers : `.claude/skills/<nom>/SKILL.md`. Une skill est un **mode opératoire réutilisable**
pour une tâche récurrente ou spécialisée du projet.

| Skill | Quand l'invoquer | Agents principaux |
|---|---|---|
| `feature-spec` | Transformer un besoin exprimé en spécification exploitable (user stories, règles de gestion, critères d'acceptation). | `product-owner`, `chef-de-projet` |
| `design-system-influx` | Créer ou modifier un écran, définir/étendre les tokens (noir/vert), vérifier la cohérence visuelle et l'accessibilité. | `expert-ux`, `dev-react-node` |
| `supabase-schema` | Modéliser une entité, écrire une migration, définir des politiques RLS. | `expert-database`, `architecte` |
| `brevo-campaign` | Intégrer l'API Brevo, synchroniser un contact, construire l'envoi de campagne depuis le backoffice. | `expert-integrations-api`, `expert-marketing` |
| `apollo-lead-sync` | Synchroniser un lead vers Apollo.io, mapper les champs, gérer la qualification et les erreurs. | `expert-integrations-api`, `expert-marketing` |
| `lead-pipeline` | Concevoir ou modifier le pipeline événementiel de capture et de distribution des leads (émission, file, retries, supervision). | `architecte`, `expert-integrations-api` |
| `matching-spec` | Définir ou faire évoluer la **recherche de créateurs** (facettes, anonymisation par tranches, k-anonymat, tri explicable, vue commerciale identifiée) puis les critères et pondérations du futur moteur de mise en relation. | `expert-matching`, `product-owner` |
| `intermediation-tracking` | **Tracer une mise en relation courtée**, de son origine à la commission encaissée : les trois déclencheurs (dont la proposition initiée par le commercial), la file de validation, l'attribution, la révélation d'identité horodatée, le registre d'audit, le pipeline d'affaire. | `expert-paiement-facturation`, `chef-de-projet` |
| `messaging-spec` | Concevoir la **messagerie à trois** : conditions d'ouverture d'une conversation, commercial visible et nommé, visibilité avant et après révélation, notifications sans le texte, lecture journalisée. | `product-owner`, `expert-conformite-rgpd` |
| `profile-verification` | Vérifier un profil et attribuer le **badge « Vérifié »** à la main : niveaux, pièces acceptées, procédure de l'agent, motifs de refus, péremption, retrait et contestation. | `product-owner`, `expert-conformite-rgpd` |
| `backoffice-ops` | Concevoir un écran ou une opération du **backoffice** : file de validation, verrou anti-double-traitement, SLA, motifs typés, actions de masse, traçage des actions et lectures privilégiées. | `product-owner`, `expert-ux` |
| `contract-commission` | Générer un modèle de contrat, appliquer et historiser la commission 35 % (part annonceur et part créateur), calculer le net créateur, encadrer l'encaissement et le reversement. **Hors périmètre du MVP** (régime transitoire §3) : utile à partir de la V2. | `expert-paiement-facturation`, `expert-conformite-rgpd` |
| `railway-deploy` | Configurer un service, un environnement ou un déploiement Railway ; diagnostiquer un déploiement en échec. | `integrateur` |
| `env-secrets` | Ajouter, faire tourner ou documenter une variable d'environnement / un secret (Supabase, Brevo, Apollo, Railway, GitHub). | `integrateur`, `expert-cybersecurite` |
| `test-strategy` | Définir le plan de test d'une fonctionnalité, choisir le bon niveau de test, fixer le « prêt à livrer ». | `testeur`, `dev-react-node` |
| `security-rgpd-audit` | Revue avant livraison : sécurité applicative, données personnelles, consentement, droits des personnes. | `expert-cybersecurite`, `expert-conformite-rgpd` |

---

## 13. Décisions ouvertes

À trancher par l'agent indiqué, **avant** l'implémentation concernée. Ne pas inventer de réponse
hors de ce cadre ; mettre ce tableau à jour à chaque arbitrage. Les lots cités sont ceux de
`docs/mvp/00-cadrage-mvp-v2.md` (7 lots, 0 à 6).

| # | Sujet | Arbitre | Statut | Échéance |
|---|---|---|---|---|
| D1 | Framework React : Vite (SPA) vs Next.js (SSR/SEO) — impacte fortement le SEO de la partie publique, bilingue | `architecte` | **Tranchée (2026-09-16)** : Next.js (App Router), pages publiques pré-rendues par langue, sans logique métier dans le front — voir `docs/landing-page/01-architecture.md` | — |
| D2 | Framework backend Node : Express / Fastify / NestJS | `architecte` | **Tranchée (2026-09-18)** : Fastify 5 dans `apps/api`, plus un worker issu du même paquet déployé comme service Railway distinct — voir `docs/mvp/02-architecture-3-espaces.md` | — |
| D3 | Structure du dépôt : monorepo (front + back + backoffice) vs multi-repo | `architecte` | **Tranchée (2026-09-16)** : monorepo pnpm 11 (`apps/*`, `packages/*`), sans orchestrateur ; ne tranche pas D12 | — |
| D4 | Librairie UI : headless + utilitaire CSS, ou bibliothèque de composants — doit servir la charte noir/vert | `architecte` + `expert-ux` | **Tranchée (2026-09-16)** : Tailwind CSS v4 alimenté uniquement par un fichier de tokens unique, sans bibliothèque de composants ; nommage des tokens à confirmer par `expert-ux` | — |
| D5 | Accès aux données : client Supabase direct, ORM (Prisma/Drizzle) ou couche d'accès maison | `expert-database` + `architecte` | **Tranchée (2026-09-18)** : Drizzle, migrations en SQL relu dans `supabase/migrations` (`drizzle-kit push` interdit), `@supabase/supabase-js` cantonné à `apps/api`, connexion sous **rôles Postgres dédiés sans `BYPASSRLS`**, **un schéma par domaine** et rien dans `public` | — |
| D6 | Palette exacte : nuance de vert de marque, échelle de gris, tokens clair/sombre | `expert-ux` + Fondateur | **Tranchée (2026-09-17)** : dark theme par défaut sur toute la plateforme, noir profond nuancé, vert de marque recalibré pour le fond sombre (WCAG AA) — voir `apps/web/src/styles/tokens.css` et §5.1 | — |
| D7 | Traitement fiscal de la commission : montants hors taxes ou taxes comprises ; TVA / GST / sales tax sur chaque part, selon le pays de la société et celui des parties | `expert-paiement-facturation` + expert-comptable + Fondateur | Ouverte (dépend de D25) | Avant le Lot 4 |
| D8 | Flux financier : INFLUX encaisse et reverse, ou facture sa seule commission | `expert-paiement-facturation` + Fondateur | **Tranchée (2026-09-16)** : INFLUX encaisse le montant du contrat et reverse le net créateur via un prestataire de paiement agréé | — |
| D9 | Prestataire de paiement (Stripe Connect ou équivalent) : compatible avec le pays de la société, les reversements internationaux et le multi-devises | `expert-paiement-facturation` + `architecte` | Ouverte, **bloquante** (dépend de D25) | Étude au Lot 2, tranchée avant le Lot 3 |
| D10 | Signature électronique des contrats : solution tierce ou acceptation en ligne horodatée (valeur juridique selon les pays) | `expert-conformite-rgpd` + `architecte` | Ouverte | Avant le Lot 4 |
| D11 | Version 1 du matching : règles explicites pondérées ou approche par score appris | `expert-matching` | Ouverte, repoussée : pas d'algorithme au MVP, collecte des données dès les Lots 2 et 3 | Après le MVP |
| D12 | Backoffice : application séparée ou espace protégé de l'app membres | `architecte` + `product-owner` | **Tranchée (2026-09-18)** : **application séparée** `apps/backoffice`, hôte distinct, `noindex`, MFA, session courte, inscription impossible. Marque et créateur restent dans `apps/web` : deux applications, trois espaces | — |
| D13 | Périmètre du MVP et ordre de livraison des lots | `chef-de-projet` + Fondateur | **Re-tranchée (2026-09-18)** : MVP **place de marché courtée**, **7 lots (0 à 6)**, 18 à 25 semaines — voir `docs/mvp/00-cadrage-mvp-v2.md`. *Abroge l'arbitrage du 2026-09-16 (« MVP opéré par l'équipe », Lots 0 à 5, `docs/cadrage-mvp.md`, document périmé).* | — |
| D14 | Modèle d'abonnement complémentaire à la commission (à moyen terme) | Fondateur | Ouverte | Après le pilote |
| D15 | Influenceurs mineurs : exclusion ou régime spécifique | Fondateur + `expert-conformite-rgpd` | **Tranchée (2026-09-16)** : exclus au MVP | — |
| D16 | Pseudos et liens réseaux visibles ou non avant la signature | Fondateur + `expert-ux` + `expert-conformite-rgpd` | **Tranchée (2026-09-16), étendue le 2026-09-18 (A2)** : masqués (statistiques vérifiées, portfolio, badge). Le MVP n'ayant pas de signature dans la plateforme, le point de révélation devient **l'ouverture de la mise en relation par un commercial**. Voir D40 pour la symétrie côté marque | — |
| D17 | Qui peut signer un contrat | Fondateur + `expert-paiement-facturation` + `expert-conformite-rgpd` | **Tranchée (2026-09-16)** : tout créateur majeur, particuliers compris | — |
| D18 | Mécanisme de file d'attente pour la synchronisation des leads | `architecte` | **Tranchée (2026-09-18)** : table `outbox_events` + worker `FOR UPDATE SKIP LOCKED`, verrou consultatif de transaction, priorité aux révocations ; elle transporte aussi les e-mails transactionnels de révélation d'identité | — |
| D19 | Règle d'arrondi sur les deux parts et dans chaque devise, attribution du reliquat | `expert-paiement-facturation` | Ouverte | Lot 4 |
| D20 | Moment du paiement, annulation, litige, remboursement : sort de chaque part | `expert-paiement-facturation` + Fondateur | Ouverte | Lot 4 |
| D21 | Règles de l'influence commerciale et statut d'INFLUX par pays ouvert (loi française du 9 juin 2023, FTC, ASA, Bureau de la concurrence du Canada, CONAR…) ; DSA pour les utilisateurs de l'UE | `expert-conformite-rgpd` + juristes | Ouverte | Niveau de base avant le Lot 1 ; chaque pays avant son ouverture |
| D22 | Facturation électronique selon le pays de la société | `expert-paiement-facturation` + expert-comptable | Ouverte (dépend de D25) | Lot 4 |
| D23 | Structure des factures quand la commission est incluse dans le contrat : qui facture quoi à qui, mentions, taxes | `expert-paiement-facturation` + expert-comptable | Ouverte | Étude dès le Lot 1, tranchée avant le Lot 4 |
| D24 | Créateurs particuliers : déclarations fiscales de la plateforme (DAC7, 1099…), part créateur facturée à un consommateur, risque de requalification | `expert-conformite-rgpd` + `expert-paiement-facturation` + expert-comptable | Ouverte | Lot 2 |
| D25 | **Pays d'établissement de la société.** Critères : prestataire de paiement et reversements vers les zones visées, compte bancaire multi-devises, taxes sur les commissions, déclarations fiscales de la plateforme, droit applicable aux CGU, obligations RGPD, crédibilité auprès des annonceurs, coût | **Fondateur** + avocat fiscaliste international ; dossier préparé par `expert-paiement-facturation` + `expert-conformite-rgpd` | Ouverte, **la plus structurante** | Avant la mise en ligne du Lot 1 |
| D26 | Pays ouverts aux contrats : première vague (1 à 3 pays recommandés) puis vagues suivantes | Fondateur + `expert-conformite-rgpd` + `expert-paiement-facturation` | Ouverte | Étude au Lot 2, tranchée avant le Lot 4 |
| D27 | Devises : liste fermée liée aux pays ouverts, devise fixée par contrat, prise en charge des frais de conversion | `expert-paiement-facturation` + Fondateur | Ouverte | Avant le Lot 2 |
| D28 | Librairie de traduction (français et anglais au lancement, formats de nombres et montants selon la langue) | `architecte` | **Tranchée (2026-09-16)** : next-intl, messages JSON ICU par langue, parité des clés FR/EN vérifiée à la compilation | — |
| D29 | Durée de la fenêtre de non-contournement et régime de la clause (**rédaction asymétrique** : ferme côté annonceur B2B, loyauté et obligation de déclaration côté créateur particulier, où une clause pénale risque la nullité) | **Fondateur** + juriste, dossier par `expert-conformite-rgpd` | Ouverte | Avant le Lot 1 (CGU) |
| D30 | Politique de signalement des coordonnées dans la messagerie (signaler / masquer / bloquer) et interdiction des pièces jointes | `product-owner` + `expert-ux` + Fondateur | Ouverte | Avant le Lot 4 |
| D31 | *Sans objet.* La déclaration de la suite donnée par les utilisateurs est remplacée par la saisie de l'issue par le commercial (arbitrage A8) | — | **Close (2026-09-18)** | — |
| D32 | Portée de la clause de non-contournement pendant le pilote | **Fondateur** | **Tranchée (2026-09-18, A5)** : clause posée dès les premières CGU, **usage suspendu pendant le pilote** par un moratoire daté, révocable et conditionné à la déclaration de l'affaire. Rédaction à valider par un juriste | — |
| D33 | Périmètre de la synchronisation vers Apollo : tous les inscrits ou annonceurs + créateurs professionnels seulement | `expert-conformite-rgpd` (**veto**) + Fondateur | **Ouverte.** Orientation du fondateur (A7, 2026-09-18) : **tous les inscrits**, particuliers compris — **prise contre la recommandation**. Veto maintenu, **validation d'un juriste obligatoire avant la mise en ligne du Lot 1**. Périmètre lu en configuration, valeur d'attente conservatrice | Lot 1 |
| D34 | Libellé, niveaux et péremption du badge « Vérifié » — ce qu'il affirme et ce qu'il n'affirme pas (**il ne garantit ni l'authenticité des abonnés, ni la performance**) | `product-owner` + `expert-conformite-rgpd` | Ouverte | Lot 2 |
| D35 | Plafonds et conditions de la saisie libre d'adresses pour les e-mails du backoffice ; définition d'« adresse professionnelle » ; rôle habilité | `expert-conformite-rgpd` (**veto**) + Fondateur | Ouverte | Lot 5 |
| D36 | Langue du backoffice (français confirmé ou bilingue) | Fondateur | Ouverte | Lot 5 |
| D37 | Méthode d'authentification | `architecte` + `expert-cybersecurite` + `expert-ux` | **Tranchée (2026-09-18)** : membres = **code à 6 chiffres par e-mail, sans mot de passe** ; backoffice = mot de passe + **TOTP obligatoire** ; pas de connexion Google / Instagram / TikTok au MVP. **Validée sous conditions par `expert-cybersecurite`**, avec **clause de caducité** : l'absence de second facteur côté membres n'est acceptable que parce qu'un compte ne contient aucune coordonnée bancaire au MVP — **dès que l'encaissement entre dans l'application (V2), un second facteur devient obligatoire** | — |
| D38 | Masse critique de profils publiés avant d'ouvrir la recherche libre aux marques (une recherche vide est pire que pas de recherche) | `chef-de-projet` + Fondateur | Ouverte | Lot 3 |
| D39 | SLA de la file de validation | **Fondateur** + `product-owner` | **Tranchée (2026-09-18)** : **1 jour ouvré** pour traiter une demande de contact ou une candidature. Délai affiché aux deux parties, alerte interne au bout de quelques heures, escalade au-delà. Le respect du délai est un indicateur suivi : un délai affiché puis non tenu abîme plus la confiance qu'un délai plus long tenu | — |
| D40 | Masquage symétrique des coordonnées côté marque | Fondateur + `expert-ux` + `expert-conformite-rgpd` | **Tranchée (2026-09-18)** : **oui, masquage symétrique**. Nom, logo, site et secteur de la marque restent publics ; **e-mail et téléphone de l'interlocuteur ne sont visibles qu'après ouverture de la mise en relation**. Sans cela, un créateur contacte la marque en direct et le commercial est contourné dans l'autre sens | — |
| D41 | Un compte peut-il être à la fois annonceur et créateur ? | Fondateur + `product-owner` | **Tranchée (2026-09-18)** : **un rôle par compte au MVP**, parcours nets et anonymisation garantie ; mais **le modèle de données prévoit dès le Lot 0 la liaison compte ↔ rôles**, pour que l'ouverture ultérieure ne coûte qu'un écran au lieu d'une migration sur des données en production | — |
| D42 | **Renouvellement d'une collaboration** entre deux parties déjà mises en relation sur une même campagne. Aujourd'hui aucun chemin : une nouvelle mise en relation est bloquée tant que la précédente est active, et rien ne dit comment en ouvrir une nouvelle une fois la première close. C'est pourtant **le cas de contournement le plus probable** (les deux parties se connaissent déjà). Recommandation : renouvellement possible **uniquement par proposition INFLUX**, une fois la précédente en état terminal, avec lien vers la mise en relation d'origine ; la créance (D29) reste rattachée à la première révélation | Fondateur + `chef-de-projet` + `product-owner` (avis `expert-matching`) | Ouverte, **à trancher avant le Lot 4** | Avant le Lot 4 |

> **Décisions reportées en V2 par l'arbitrage A1 (2026-09-18).** Le contrat, la signature,
> l'encaissement, le reversement et la facturation sortent du MVP : le contrat est envoyé et signé
> hors plateforme par le commercial et le paiement se fait à la confiance (§3, régime transitoire).
> Sont donc **reportées après le MVP** : **D7** (fiscalité de la commission), **D9** (prestataire de
> paiement), **D10** (signature électronique), **D19** (arrondi), **D20** (annulation et litige),
> **D22** (facturation électronique), **D23** (structure des factures), **D26** (pays ouverts aux
> contrats) et **D27** (devises).
> **Deux réserves importantes.** **D25** (pays de la société) reste la décision la plus urgente du
> projet : sans société, pas de mentions légales ni de CGU, donc pas de mise en ligne du Lot 1 vers
> la semaine 5. Et **D7 / D23 se réactivent plus tôt que prévu** : si le commercial encaisse une
> commission dès le pilote, la question fiscale se pose au premier euro, pas en V2.
>
> **Deux préconditions ajoutées le 2026-09-19 (`docs/mvp/14-pipeline-commercial.md`).**
> **(1) Aucun encaissement de commission avant que D25 soit tranchée et la société créée :** sans
> société, compte professionnel et numéro de TVA, aucune facture valide n'est émissible ; encaisser
> au nom d'une personne physique crée un revenu à déclarer et un risque de requalification. Le
> pipeline peut enregistrer des encaissements dès le Lot 5, mais **le pilote ne doit pas en produire
> tant que la société n'existe pas** (arbitre : fondateur, expert-comptable, avocat fiscaliste).
> **(2) D20 (sort de chaque part en cas d'annulation, de litige ou de non-livraison) ne peut pas
> attendre la V2 :** le premier litige surviendra pendant le pilote. À instruire après les dix
> premières affaires signées, avant si un litige apparaît.

**Autres arbitrages du fondateur (2026-09-16)** : répartition de la commission 20 % / 15 % incluse
dans le contrat (§3) ; portée internationale, inscriptions partout et contrats par pays ouverts,
français et anglais au lancement (§2) ; pas de remise de lancement générale ; au moins une personne
à plein temps sur le backoffice ; ~~envoi des campagnes Brevo depuis le backoffice juste après le
MVP~~ — **abrogé le 2026-09-18 (arbitrage A4) : l'envoi des e-mails Brevo depuis le backoffice entre
dans le MVP, au Lot 5**, avec trois sources de destinataires encadrées (contacts de la plateforme,
segments Brevo, saisie libre plafonnée). Voir `docs/mvp/00-cadrage-mvp-v2.md`.

---

## 14. Prérequis et prochaines étapes

> ⚠️ **Ces actions ne doivent PAS être exécutées par un agent sans confirmation explicite du
> fondateur.** Elles sont listées comme checklist à valider, notamment parce qu'elles créent des
> ressources externes, engagent des coûts ou modifient des comptes.

### 14.1 Dépôt de code

- [x] Initialiser le dépôt Git local (`git init`, branche `main`) — **fait le 2026-09-16**
- [x] Créer le `.gitignore` (node_modules, `.env*` sauf `.env.example`, artefacts de build, `.claude/settings.local.json`)
- [ ] Créer le dépôt distant GitHub (privé)
- [ ] Protéger la branche `main` (PR obligatoire, revue requise)
- [ ] Configurer les GitHub Secrets nécessaires au CI/CD

### 14.2 Société, marque et conseils

À lancer en premier : ces étapes conditionnent la mise en ligne du Lot 1 et le paiement.

- [ ] Mandater un **avocat fiscaliste international** et choisir le pays d'établissement de la
      société (D25)
- [ ] Recherche d'antériorité et dépôt de la marque **INFLUX** dans les zones visées (UE,
      États-Unis, Canada, Brésil)
- [ ] Créer la société et ouvrir un compte bancaire multi-devises
- [ ] Mandater un juriste (numérique, consommation, influence commerciale) pour les documents en
      français et en anglais, puis des juristes locaux pour chaque pays ouvert aux contrats
- [ ] Mandater un expert-comptable dans le pays de la société
- [ ] Si la société est établie hors UE : désigner un représentant dans l'UE (et au Royaume-Uni si
      nécessaire)

### 14.3 Comptes et services externes

GitHub, Supabase et Railway peuvent être ouverts avant la création de la société, puis transférés.
Brevo, Apollo.io et le prestataire de paiement sont ouverts au nom de la société.

- [ ] Créer le projet **Supabase** (région UE par défaut, à confirmer après D25) et récupérer les clés
- [ ] Créer le compte **Railway**, les environnements `staging` et `production`
- [ ] Créer le compte **Brevo**, générer la clé API, préparer les listes et attributs de contact
      (dont langue et pays)
- [ ] Créer le compte **Apollo.io**, générer la clé API, définir les séquences commerciales
- [ ] ~~Ouvrir le compte chez le **prestataire de paiement** retenu (D9), pendant le Lot 2~~ —
      **reporté en V2** (A1 : le paiement sort du MVP)
- [ ] Réserver les noms de domaine et configurer les DNS, dont **un sous-domaine dédié au
      backoffice** (D12)
- [ ] **Authentifier les trois domaines d'envoi (SPF, DKIM, DMARC) — bloquant pour le Lot 1**, et
      non plus seulement recommandé : **trois flux, trois sous-domaines** (transactionnel,
      newsletter, prospection — `docs/mvp/16-backoffice-emails-brevo.md` RG9), tous authentifiés
      **avant le premier envoi**. Depuis D37, les membres se connectent par un **code à 6 chiffres
      reçu par e-mail** : une plainte de prospection sur un domaine partagé rendrait la plateforme
      **inaccessible**. Un e-mail qui n'arrive pas n'est plus une gêne marketing, c'est **une
      impossibilité de se connecter**. La délivrabilité devient la disponibilité du produit
- [ ] Signer les contrats de sous-traitance des données (Brevo, Apollo.io, Supabase, Railway,
      prestataire de paiement) et tenir le registre des traitements

### 14.4 Cadrage produit

- [x] Valider avec le fondateur le périmètre du **MVP** (D13) — **re-tranché le 2026-09-18**, place
      de marché courtée, 7 lots, voir `docs/mvp/00-cadrage-mvp-v2.md`
- [ ] Trancher D2, D5, D12, D18 et D37 (`architecte`) — voir `docs/mvp/02-architecture-3-espaces.md`
- [ ] Trancher D29, D32 (rédaction), D33, D39 et D40 — les cinq décisions qui bloquent les Lots 1 à 4
- [x] Figer la palette et les tokens (D6, `expert-ux` + fondateur) — **fait le 2026-09-17**, dark
      theme par défaut, voir `apps/web/src/styles/tokens.css`
- [ ] Trancher le modèle financier restant : D7, D9, D19, D20, D22, D23, D27
      (`expert-paiement-facturation` + fondateur)
- [ ] Trancher D24, D25 et D26 (fondateur, avec `expert-conformite-rgpd` et
      `expert-paiement-facturation`)
- [ ] Faire rédiger/valider les documents légaux par un juriste (CGU, CGV, contrat
      d'intermédiation, politique de confidentialité), en français et en anglais — les agents
      préparent, un professionnel valide

### 14.5 Ordre de travail : lots du MVP

Détail, agents, skills et dépendances dans **`docs/mvp/00-cadrage-mvp-v2.md`**
(`docs/cadrage-mvp.md` est périmé depuis le 2026-09-18).

**MVP « place de marché courtée », 7 lots, 18 à 25 semaines** (D13, re-tranchée le 2026-09-18).

| Lot | Contenu | Durée indicative |
|---|---|---|
| 0. Socle | D2, D5, D12, D18, D37 ; dépôt, CI, environnements, secrets ; `apps/api`, `apps/backoffice`, `packages/`, `supabase/` ; rôles et commercial responsable ; CGU versionnées ; journal d'audit append-only ; RLS testée ; sortie du mode maquette | 1–2 sem. |
| 1. Inscription et leads *(1re mise en ligne)* | Pages publiques bilingues, inscription réelle, synchronisation Brevo + Apollo, backoffice de suivi, documents légaux **dont la clause de non-contournement** | 3–4 sem. |
| 2. Profils, réseaux, audience, badge | Profil marque, profil créateur en deux couches (anonyme / identifiée), preuves, file de vérification, **badge « Vérifié » attribué à la main** | 3–4 sem. |
| 3. Campagnes et recherche anonymisée | Création et validation de campagnes, **recherche de créateurs anonymisée** côté marque et **identifiée côté commercial**, recherche de campagnes | 3–4 sem. |
| 4. Mise en relation courtée et messagerie | Les 3 déclencheurs **dont la proposition initiée par le commercial**, file de validation, révélation d'identité horodatée, **conversation à trois**, signalement des coordonnées | 4–5 sem. |
| 5. Backoffice, pipeline commercial et e-mails | Tableau de bord, files, **pipeline d'affaire et commission encaissée**, supervision des leads, envoi d'e-mails Brevo par 3 sources, demandes RGPD | 3–4 sem. |
| 6. Recette, audit, ouverture | Parcours de bout en bout, audit sécurité et conformité, procédures écrites, lancement du pilote | 1–2 sem. |

Le calendrier réel dépend d'abord de la création de la société (D25) et des validations juridiques
par pays. Avec la mise en ligne progressive (A6), **la société doit exister vers la semaine 5**.

> **Le plafond de croissance de ce MVP est humain, pas technique.** Chaque négociation mobilise un
> commercial. L'indicateur qui dira si la plateforme fait réellement passer le métier à l'échelle est
> le **nombre d'affaires traitées par commercial et par semaine**.

---

## 15. Glossaire

| Terme | Définition |
|---|---|
| **Annonceur** | Marque ou entreprise qui souhaite promouvoir ses produits via des influenceurs. |
| **Influenceur / Créateur** | Personne proposant son audience et ses formats de contenu. |
| **Mise en relation** | Mise en contact qualifiée entre un annonceur et un influenceur, algorithmique et/ou opérée par un agent INFLUX. |
| **Campagne** | Offre publiée par un annonceur : brief, produit, formats, budget, période. |
| **Contrat** | Accord signé via INFLUX entre un annonceur et un influenceur. Fait générateur de la commission. |
| **Commission** | Part revenant à INFLUX : **35 %** du montant du contrat par défaut, somme de la part annonceur et de la part créateur, taux historisés à la signature. |
| **Part annonceur** | Partie de la commission à la charge de l'annonceur : **20 %** du montant du contrat par défaut, incluse dans le montant du contrat. |
| **Part créateur** | Partie de la commission à la charge du créateur : **15 %** du montant du contrat par défaut. |
| **Net créateur** | Montant reversé à l'influenceur : montant du contrat − commission (65 % par défaut). |
| **Pays ouvert** | Pays dans lequel les contrats sont autorisés après validation juridique, fiscale et paiement (D26). Les inscriptions restent possibles partout. |
| **Prestataire de paiement** | Établissement agréé qui encaisse le montant du contrat pour INFLUX, vérifie l'identité des créateurs et reverse le net créateur (D9). |
| **Lead** | Inscription ou manifestation d'intérêt à synchroniser vers Brevo et/ou Apollo.io. |
| **Backoffice** | Application interne de pilotage utilisée par les agents INFLUX. |
| **Agent INFLUX** | Collaborateur humain de la plateforme (à ne pas confondre avec un agent Claude Code). |
| **RLS** | Row Level Security — contrôle d'accès aux lignes au niveau PostgreSQL/Supabase. |
