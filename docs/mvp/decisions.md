# INFLUX — Registre des décisions (D1 à D77)

> Déplacé depuis `CLAUDE.md` §13 le 2026-10-05. Registre résumé (sujet, statut) ; le texte intégral des colonnes d'origine est dans `decisions-detail.md` (§ Dxx), qui **fait foi en cas d'écart**. `CLAUDE.md` ne liste plus que les décisions ouvertes.


À trancher par l'agent indiqué, **avant** l'implémentation concernée. Ne pas inventer de réponse
hors de ce cadre ; mettre ce tableau et `decisions-detail.md` à jour à chaque arbitrage. Les lots cités sont ceux de
`docs/mvp/00-cadrage-mvp-v2.md` (7 lots, 0 à 6).

| # | Sujet | Statut | Détail |
|---|---|---|---|
| D1 | Framework React : Vite (SPA) ou Next.js (SSR/SEO) | Tranchée 2026-09-16 (`architecte`) : Next.js (App Router), pages publiques pré-rendues par langue. | § D1 |
| D2 | Framework backend Node : Express / Fastify / NestJS | Tranchée 2026-09-18 (`architecte`) : Fastify 5 dans `apps/api` + un worker du même paquet, service Railway distinct. | § D2 |
| D3 | Structure du dépôt : monorepo (front + back + backoffice) vs multi-repo | Tranchée 2026-09-16 (`architecte`) : monorepo pnpm 11 (`apps/*`, `packages/*`), sans orchestrateur. | § D3 |
| D4 | Librairie UI : headless + utilitaire CSS ou bibliothèque de composants | Tranchée 2026-09-16 (`architecte`) : Tailwind v4 alimenté par un fichier de tokens unique, sans bibliothèque de composants. | § D4 |
| D5 | Accès aux données : client Supabase direct, ORM ou couche maison | Tranchée 2026-09-18 (`expert-database`) : Drizzle, migrations SQL relues, `supabase-js` seulement dans `apps/api`, rôles Postgres sans `BYPASSRLS`, un schéma par domaine. | § D5 |
| D6 | Palette exacte : vert de marque, échelle de gris, tokens clair/sombre | Tranchée 2026-09-17 (`expert-ux` + fondateur) : dark theme partout, vert recalibré AA, succès en sarcelle. Amendée par D73 : ne régit plus que la vitrine ; vert unique `#1dd68a`. | § D6 |
| D7 | Traitement fiscal de la commission : montants hors taxes ou taxes comprises ; TVA / GST / sales tax sur chaque part, selon le pays de la société et celui des parties | `expert-paiement-facturation` + expert-comptable + Fondateur — Ouverte (dépend de D25) Échéance : Avant le Lot 4. | § D7 |
| D8 | Flux financier : INFLUX encaisse et reverse, ou facture sa seule commission | Tranchée 2026-09-16 (fondateur) : INFLUX encaisse le contrat et reverse le net créateur via un prestataire agréé. | § D8 |
| D9 | Prestataire de paiement (Stripe Connect ou équivalent) : compatible avec le pays de la société, les reversements internationaux et le multi-devises | `expert-paiement-facturation` + `architecte` — Ouverte, **bloquante** (dépend de D25) Échéance : Étude au Lot 2, tranchée avant le Lot 3. | § D9 |
| D10 | Signature électronique des contrats : solution tierce ou acceptation en ligne horodatée (valeur juridique selon les pays) | `expert-conformite-rgpd` + `architecte` — Ouverte Échéance : Avant le Lot 4. | § D10 |
| D11 | Version 1 du matching : règles explicites pondérées ou approche par score appris | `expert-matching` — Ouverte, repoussée : pas d'algorithme au MVP, collecte des données dès les Lots 2 et 3 Échéance : Après le MVP. | § D11 |
| D12 | Backoffice : application séparée ou espace protégé de l'app membres | Tranchée 2026-09-18 (`architecte`) : `apps/backoffice` séparée (hôte distinct, MFA) ; marque et créateur restent dans `apps/web`. | § D12 |
| D13 | Périmètre du MVP et ordre de livraison des lots | Re-tranchée 2026-09-18 (fondateur) : MVP place de marché courtée, 7 lots (`00`) ; abroge l'arbitrage du 2026-09-16. | § D13 |
| D14 | Modèle d'abonnement complémentaire à la commission (à moyen terme) | Fondateur — Ouverte Échéance : Après le pilote. | § D14 |
| D15 | Influenceurs mineurs : exclusion ou régime spécifique | Tranchée 2026-09-16 (fondateur) : mineurs exclus ; seule règle d'âge « 18 ans ou plus » (2026-10-08) ; CGU `draft-2` à aligner. | § D15 |
| D16 | Pseudos et liens réseaux visibles ou non avant la signature | Tranchée 2026-09-16, précisée 2026-09-24 (fondateur) : pseudos, liens, statistiques masqués jusqu'à la seconde acceptation (D45) ; symétrie : D40, D46. | § D16 |
| D17 | Qui peut signer un contrat | Tranchée 2026-09-16 (fondateur) : tout créateur majeur, particuliers compris. | § D17 |
| D18 | Mécanisme de file d'attente pour la synchronisation des leads | Tranchée 2026-09-18 (`architecte`) : `outbox_events` + worker `FOR UPDATE SKIP LOCKED`, priorité aux révocations. | § D18 |
| D19 | Règle d'arrondi sur les deux parts et dans chaque devise, attribution du reliquat | `expert-paiement-facturation` — Ouverte Échéance : Lot 4. | § D19 |
| D20 | Moment du paiement, annulation, litige, remboursement : sort de chaque part | `expert-paiement-facturation` + Fondateur — Ouverte Échéance : Lot 4. | § D20 |
| D21 | Règles de l'influence commerciale et statut d'INFLUX par pays ouvert (loi française du 9 juin 2023, FTC, ASA, Bureau de la concurrence du Canada, CONAR…) ; DSA pour les utilisateurs de l'UE | `expert-conformite-rgpd` + juristes — Ouverte Échéance : Niveau de base avant le Lot 1 ; chaque pays avant son ouverture. | § D21 |
| D22 | Facturation électronique selon le pays de la société | `expert-paiement-facturation` + expert-comptable — Ouverte (dépend de D25) Échéance : Lot 4. | § D22 |
| D23 | Structure des factures quand la commission est incluse dans le contrat : qui facture quoi à qui, mentions, taxes | `expert-paiement-facturation` + expert-comptable — Ouverte Échéance : Étude dès le Lot 1, tranchée avant le Lot 4. | § D23 |
| D24 | Créateurs particuliers : déclarations fiscales de la plateforme (DAC7, 1099…), part créateur facturée à un consommateur, risque de requalification | `expert-conformite-rgpd` + `expert-paiement-facturation` + expert-comptable — Ouverte Échéance : Lot 2. | § D24 |
| D25 | Pays d'établissement de la société. | Tranchée 2026-10-08 (fondateur) : société en Angleterre, CGU de droit anglais ; identité en marqueurs `[…]`. À instruire : D7, D9, D22, D23, représentant UE, data protection fee, solicitor. | § D25 |
| D26 | Pays ouverts aux contrats : première vague (1 à 3 pays recommandés) puis vagues suivantes | Fondateur + `expert-conformite-rgpd` + `expert-paiement-facturation` — Ouverte Échéance : Étude au Lot 2, tranchée avant le Lot 4. | § D26 |
| D27 | Devises : liste fermée liée aux pays ouverts, devise fixée par contrat, prise en charge des frais de conversion | `expert-paiement-facturation` + Fondateur — Ouverte Échéance : Avant le Lot 2. | § D27 |
| D28 | Librairie de traduction (français et anglais au lancement, formats de nombres et montants selon la langue) | Tranchée 2026-09-16 (`architecte`) : next-intl, messages JSON ICU, parité FR/EN vérifiée à la compilation. | § D28 |
| D29 | Durée de la fenêtre de non-contournement et régime de la clause (**rédaction asymétrique** : ferme côté annonceur B2B, loyauté et obligation de déclaration côté créateur particulier, où une clause pénale risque la nullité) | **Fondateur** + juriste, dossier par `expert-conformite-rgpd` — Ouverte Échéance : Avant le Lot 1 (CGU). | § D29 |
| D30 | Politique de signalement des coordonnées dans la messagerie (signaler / masquer / bloquer) et interdiction des pièces jointes | `product-owner` + `expert-ux` + Fondateur — Ouverte Échéance : Avant le Lot 4. | § D30 |
| D31 | *Sans objet.* La déclaration de la suite donnée par les utilisateurs est remplacée par la saisie de l'issue par le commercial (arbitrage A8) | — — **Close (2026-09-18)** | § D31 |
| D32 | Portée de la clause de non-contournement pendant le pilote | Tranchée 2026-09-18, A5 (fondateur) : clause posée dès les premières CGU, usage suspendu pendant le pilote (moratoire daté, révocable) ; rédaction à valider par un juriste. | § D32 |
| D33 | Périmètre de la synchronisation vers Apollo : tous les inscrits ou annonceurs + créateurs professionnels seulement | `expert-conformite-rgpd` (**veto**) + Fondateur — **Ouverte.** Orientation du fondateur (A7, 2026-09-18) : **tous les inscrits**, particuliers compris — **prise contre la recommandation**. Veto maintenu, **validation d'un juriste obligatoire avant la mise en ligne du Lot 1**. Périmètre lu en configuration, valeur d'attente conservatrice. **Pays (fondateur, 2026-10-19, contre le veto, qui reste opposable à l'entrée en `production`, D71)** : prospection Apollo ouverte **dans tous les pays par défaut**, `staging` et production ; un administrateur peut **exclure** des pays (`apollo_excluded_countries`, vide par défaut, migration 0141, motif `country_excluded`). La base légale (`apollo_legal_basis`, défaut `consentement_requis`) et le périmètre restent inchangés Échéance : Lot 1. | § D33 |
| D34 | Libellé, niveaux et péremption du badge « Vérifié » — ce qu'il affirme et ce qu'il n'affirme pas (**il ne garantit ni l'authenticité des abonnés, ni la performance**) | `product-owner` + `expert-conformite-rgpd` — Ouverte Échéance : Lot 2. | § D34 |
| D35 | Plafonds et conditions de la saisie libre d'adresses pour les e-mails du backoffice ; définition d'« adresse professionnelle » ; rôle habilité | `expert-conformite-rgpd` (**veto**) + Fondateur — Ouverte Échéance : Lot 5. | § D35 |
| D36 | Langue du backoffice (français confirmé ou bilingue) | Fondateur — Ouverte Échéance : Lot 5. | § D36 |
| D37 | Méthode d'authentification | Tranchée 2026-09-18 (`architecte`) : membres = code à 6 chiffres par e-mail ; backoffice = mot de passe + TOTP. Caduque côté membres dès l'encaissement dans l'application (V2) : second facteur obligatoire. | § D37 |
| D38 | Masse critique de profils publiés avant d'ouvrir la recherche libre aux marques (une recherche vide est pire que pas de recherche) | `chef-de-projet` + Fondateur — Ouverte Échéance : Lot 3. | § D38 |
| D39 | SLA de la file de validation | Tranchée 2026-09-18 (fondateur) : 1 jour ouvré par demande de contact ou candidature, délai affiché aux deux parties, alerte puis escalade. | § D39 |
| D40 | Masquage symétrique des coordonnées côté marque | Tranchée 2026-09-18, précisée 2026-09-24 (fondateur) : masquage symétrique ; e-mail, téléphone et page de contact de la marque jamais montrés (D46), interlocuteur révélé à l'ouverture. | § D40 |
| D41 | Un compte peut-il être à la fois annonceur et créateur ? | Tranchée 2026-09-18 (fondateur) : un rôle par compte au MVP ; le modèle prévoit dès le Lot 0 la liaison compte ↔ rôles. | § D41 |
| D42 | Renouvellement d'une collaboration entre deux parties déjà mises en relation sur une même campagne | Tranchée 2026-09-24 (fondateur) : uniquement par proposition INFLUX, affaire précédente terminée, lien vers la mise en relation d'origine ; créance (D29) rattachée à la première révélation. « Terminée » : `product-owner` + `expert-database`. | § D42 |
| D43 | Chemin d'envoi du code de connexion (e-mail transactionnel critique, priorité P0) | Tranchée 2026-09-19 (`architecte`) : envoi synchrone par `apps/api`, une tentative, `200` uniforme ; `leads.transactional_sends` est un journal, jamais une file. Limite assumée : panne durable de Brevo = aucune connexion. | § D43 |
| D44 | Statut du code existant | Tranchée 2026-09-24 (fondateur) : tout le code sauf la landing est une maquette jetable, jamais reprise ; le produit réel repart du Lot 0. | § D44 |
| D45 | **Moment de la révélation d'identité** | Tranchée 2026-09-24 (fondateur) : double acceptation après validation du commercial ; identités révélées à la seconde acceptation ; sans réponse sous 7 jours, clôture, rien n'est révélé. | § D45 |
| D46 | Coordonnées de contact après l'ouverture (portée de D40) | Tranchée 2026-09-24 (fondateur) : l'identité, jamais les coordonnées ; e-mail, téléphone et page de contact jamais montrés aux membres (`12` RG29). | § D46 |
| D47 | Apartés privés commercial ↔ une seule partie dans une conversation | Tranchée 2026-09-24 (fondateur ; veto `expert-conformite-rgpd`) : apartés conservés, annoncés, confidentiels par défaut, lus par les agents participants (journalisés). Reste : clause des CGU validée par un juriste avant le Lot 1 ; avis `expert-cybersecurite`. | § D47 |
| D48 | Discours public pendant le MVP | Tranchée 2026-09-24 (fondateur) : landing réécrite pour le MVP courté ; pendant le pilote, aucun pourcentage ni net estimé : « commission INFLUX incluse, précisée par votre commercial ». | § D48 |
| D49 | Dépassement du délai de la file de validation | Tranchée 2026-09-24 (fondateur) : l'entrée reste en file jusqu'à décision, marquée hors délai ; initiateur prévenu, administrateur alerté à J+1. | § D49 |
| D50 | Qui écrit sur une affaire | Tranchée 2026-09-24 (fondateur) : seuls le commercial responsable et l'administrateur écrivent ; un autre agent lit et demande la réattribution, journalisée. | § D50 |
| D51 | Qui retire un badge | Tranchée 2026-09-24 (fondateur) : un agent demande, un administrateur distinct approuve ; tant qu'une personne cumule les rôles, confirmation différée journalisée. | § D51 |
| D52 | Suivi de l'exécution après signature | Tranchée 2026-09-24 (fondateur) : suivi léger par le commercial (dates, lien de publication, validation par la marque) ; Lot 5. | § D52 |
| D53 | Affaires conclues hors plateforme, relations préexistantes et mesure de départ du pilote | Tranchée 2026-09-24 (fondateur) : mesure de départ avant le pilote, registre des relations préexistantes, clients du fondateur par invitation (D54) puis proposition INFLUX. | § D53 |
| D54 | Invitation nominative par un commercial | Tranchée 2026-09-24 (fondateur) : lien d'invitation nominatif ; l'inscription reste faite par la personne ; le commercial devient son responsable, source « invitation » (D55). | § D54 |
| D55 | Source d'acquisition à l'inscription | Tranchée 2026-09-24 (fondateur) : UTM, site d'origine et code d'invitation, sans traceur entre visites, plus une question facultative. | § D55 |
| D56 | Protection de la démonstration | Tranchée 2026-09-24 (fondateur) : maquette seulement sur URL protégée par mot de passe, non indexée, jamais sur le domaine de production. | § D56 |
| D57 | Politique de sauvegarde du produit réel | Tranchée 2026-09-24 (fondateur) : perte maximale de quelques minutes (restauration à un instant donné) dès la production, test de restauration régulier. | § D57 |
| D58 | Vue mobile du backoffice | Tranchée 2026-09-24 (fondateur) : vue limitée à deux gestes (répondre dans une conversation de l'agent ; prendre en charge, valider ou refuser une entrée de file). Conditions de session avant le Lot 4. | § D58 |
| D59 | Direction visuelle de la landing | Tranchée 2026-09-24 (fondateur) : carte métallisée conservée, un seul effet spectaculaire par écran visible ; revue `expert-ux` avant le Lot 1. | § D59 |
| D60 | Surveillance de production : journaux, erreurs, lenteurs et pics d'appels | Tranchée 2026-09-24 (fondateur) : surveillance entièrement interne, aucun outil externe (`pino`, schéma `ops`, sonde interne), sans enregistrement de session ; risque accepté : panne complète de Railway non signalée. Ouverts : alertes nuit et week-end, Railway Pro, rodage. | § D60 |
| D61 | Métriques prioritaires des créateurs | Tranchée 2026-09-25 (fondateur) : par réseau, trois chiffres obligatoires, constatés par l'agent : abonnés, publications sur 30 jours, commentaires moyens sur 12 publications. Ouverts : `07` Q15, Q16 (avant le Lot 2), Q17, Q18 (veto `expert-conformite-rgpd`), `10` Q13. | § D61 |
| D63 | **Consentement à l'enregistrement dans Brevo et Apollo obligatoire à l'inscription** | Tranchée 2026-09-25 (fondateur, contre la recommandation ; veto `expert-conformite-rgpd`) : sans consentement, aucun compte (abroge `05` RG30). Risque non levé : consentement non « libre » (RGPD art. 7 §4). Juriste obligatoire avant le Lot 1. | § D63 |
| D62 | Clés Brevo et Apollo sur le poste de développement | Tranchée 2026-09-25 (fondateur), amendée par D70 : le fichier local porte les valeurs de `staging` ; conditions de comptes de test limitées à la pile locale et à la CI. | § D62 |
| D64 | Socle technique du jalon J1 : exécution de `apps/api`, dépendances, passe-plat | Tranchée 2026-09-25 (`architecte`) : `apps/api` sans build (Node ≥ 24.12), versions exactes, un secret interne par front, à soumettre à `expert-cybersecurite` en fin de J2. | § D64 |
| D65 | Connexion OAuth YouTube et trajectoire de remplacement des challenges de bio | Tranchée 2026-09-30 (fondateur) : OAuth YouTube en fin de MVP ; autres réseaux : challenge de bio, remplacé progressivement par OAuth. | § D65 |
| D66 | Reprise du parcours d'inscription après rechargement ou changement de langue | Tranchée 2026-10-08 (`architecte`) : aucun stockage nouveau ; rechargement par `GET /v1/auth/journey` (jetons signés), changement de langue par variable de module en mémoire. | § D66 |
| D67 | Une configuration de synchronisation manquante est un incident, jamais un cas normal | Tranchée 2026-10-17 (`architecte`) : échec incident, alerté, rejouable, remis en file après correction ; refus de démarrage du worker en production pour les réglages indispensables ; identifiant Brevo jamais remis à `NULL` (`05` RG160 à RG164). | § D67 |
| D68 | Identifiants Brevo (listes) fournis par variables d'environnement du worker | Tranchée 2026-10-17 (fondateur), amendée par D69 : les deux `BREVO_LIST_ID_*` alimentent la base au démarrage du worker ; plus aucun identifiant de modèle. | § D68 |
| D69 | Tous les e-mails de la file sont rédigés par INFLUX, Brevo n'assure que le transport | Tranchée 2026-10-18 (fondateur) : bienvenue et avis de changement d'adresse rédigés par le worker, sans lien ; `BREVO_TEMPLATE_ID_*` refusées ; amende D68. Textes à relire par le fondateur avant la production (D48). | § D69 |
| D70 | `staging` se comporte exactement comme la production, et les agents IA l'exploitent seuls | Tranchée 2026-10-18 (fondateur, contre `03` §6.8), close 2026-10-19 : `staging` iso-production (liste fermée de différences) ; `.env.local` = `staging` seulement ; production sur confirmation, lecture comprise. Risques et dérogations : détail. | § D70 |
| D71 | Revues sécurité et RGPD bloquantes sur la seule branche `production` | Tranchée 2026-10-18 (fondateur) : vetos sécurité et RGPD et contrôle I-4 bloquants sur `production` seule (par `git merge --no-ff main` seul), non bloquants sur `main` et `staging`. Reste : déploiement Railway depuis `production` (confirmation du fondateur). | § D71 |
| D72 | La suppression d'un compte demandée depuis l'espace membre s'exécute sans approbation d'un `admin` | Tranchée 2026-10-27 (fondateur) : après double validation du membre, exécution sans `admin` par `identity.submit_member_erasure()` ; l'export et un effacement reçu autrement restent approuvés. Revue `expert-conformite-rgpd` au Lot 6, veto possible sur `production`. Points DZ : notes. | § D72 |
| D73 | Charte « KEO Emerald » pour les espaces membres marque et créateur et pour le backoffice | Tranchée 2026-10-28 (fondateur ; F1 à F7 le 2026-10-29) : vert `#1dd68a`, fond `#0a0b0a`, navigation en colonne à gauche ; amende D6 ; vitrine inchangée (D6, D59). | § D73 |
| D74 | Sous-navigation dans la colonne : sous-menu des pages d'une rubrique, page-menu sur téléphone et tablette | Tranchée 2026-10-29 (fondateur) : amende D73 ; sous-menu dans l'entrée active, page-menu sous 1 024 px, onglets de rubrique en sous-pages. Ouverts : SN-O1 (Lot 4), SN-O2 (Lot 5). | § D74 |
| D75 | Réalignement des espaces connectés sur la référence KEO Emerald | Tranchée 2026-10-30 (fondateur) : amende D73 (F6). RK-16 reporté au Lot 5 ; RK-B : fond rouge sombre du badge d'erreur (`#2e1213`, à confirmer par `expert-ux`). | § D75 |
| D76 | Cadence de validation et CI parallèle | Tranchée 2026-10-30 (fondateur) : avant commit `pnpm check:fast` + tests du domaine touché, suite complète en fin de jalon ; push par lot ; CI complète sur `main`. Amende `CLAUDE.md` §7. | § D76 |
| D77 | Chaîne automatisée lot → jalons → commits | Tranchée 2026-10-31 (fondateur) : `/lot-decoupe`, `/jalon-prepare`, `/jalon-commit`, `/jalon-run`, un sous-agent neuf par ligne ; arrêts obligatoires (validation, correctif demandé, `ETAT: arret`, CI rouge, recette, règle 4). | § D77 |

> **Points ouverts de D72 (fiche de la zone de danger, close le 2026-10-28).** Défaut appliqué
> entre parenthèses. **DZ-1** délai de grâce avant exécution (aucun ; fondateur après avis
> `expert-cybersecurite` : une boîte e-mail compromise suffit à supprimer un compte, `03` S-2) ·
> **DZ-2** suppression pendant une affaire ou une mise en relation ouverte (non bloquante, données
> pseudonymisées, commission traçable, commercial alerté ; fondateur + `expert-paiement-facturation`
> avant le Lot 4) · **DZ-4** valeurs hex du rouge « danger » (calées sur Railway, AA ; fondateur) ·
> **DZ-5** entrée « Zone de danger » dans la navigation du compte (non, section de « Mes données » ;
> fondateur, avis `expert-ux`) · **DZ-6** aligner succès, alerte et information sur le rouge opaque
> (non ; `expert-ux` puis fondateur) · **DZ-7** D72 lève la séparation de rôles de `15` RG76 et modifie
> EC-14 (appliqué sur `main`/`staging` ; `expert-conformite-rgpd` au Lot 6, veto possible sur
> `production`). DZ-3 (e-mail de confirmation) et DZ-8 (Apollo sans suppression de contact : suppression
> manuelle, `erasure_not_propagated` demeure, à revérifier si Apollo publie un point de suppression) sont tranchées.

> **Questions ouvertes des spécifications.** En plus des décisions ci-dessus, les documents `04` à
> `16` portent **environ 156 questions ouvertes** (tableaux « Questions ouvertes » de chaque
> document), et `17` / `17b` leurs propres points à valider. Elles ne sont pas recopiées ici pour
> éviter deux sources de vérité ; leur décompte par document et les plus urgentes sont dans
> `docs/mvp/archives/19-revue-de-coherence-2026-09-24.md`.

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

